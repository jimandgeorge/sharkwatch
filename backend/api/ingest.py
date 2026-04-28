import json
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..core.database import get_db, AsyncSessionLocal
from ..models.transaction import IngestPayload, TransactionSummary
from ..services import risk_scorer

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/transaction", response_model=TransactionSummary, status_code=202)
async def ingest_transaction(
    payload: IngestPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    score, factors = risk_scorer.score(payload)
    level = risk_scorer.risk_level(score)
    txn_id = str(uuid.uuid4())

    result = await db.execute(
        text("""
            INSERT INTO transactions (
                id, external_id, source, amount_pence, currency,
                customer_id, customer_email, merchant_name,
                beneficiary_account, beneficiary_name, transfer_type,
                ip_address, device_fingerprint, geolocation,
                fraud_signals, triggered_rules, risk_score, risk_level,
                raw_payload, occurred_at
            ) VALUES (
                :id, :external_id, :source, :amount_pence, :currency,
                :customer_id, :customer_email, :merchant_name,
                :beneficiary_account, :beneficiary_name, :transfer_type,
                :ip_address, :device_fingerprint, :geolocation,
                :fraud_signals, :triggered_rules, :risk_score, :risk_level,
                :raw_payload, :occurred_at
            )
            ON CONFLICT (source, external_id) DO NOTHING
            RETURNING id
        """),
        {
            "id": txn_id,
            "external_id": payload.external_id,
            "source": payload.source,
            "amount_pence": payload.amount_pence,
            "currency": payload.currency,
            "customer_id": payload.customer_id,
            "customer_email": payload.customer_email,
            "merchant_name": payload.merchant_name,
            "beneficiary_account": payload.beneficiary_account,
            "beneficiary_name": payload.beneficiary_name,
            "transfer_type": payload.transfer_type,
            "ip_address": payload.ip_address,
            "device_fingerprint": payload.device_fingerprint,
            "geolocation": payload.geolocation,
            "fraud_signals": json.dumps(payload.fraud_signals or []),
            "triggered_rules": json.dumps(payload.triggered_rules or []),
            "risk_score": score,
            "risk_level": level.value,
            "raw_payload": json.dumps(payload.raw_payload) if payload.raw_payload is not None else None,
            "occurred_at": payload.occurred_at,
        },
    )
    row = result.fetchone()
    await db.commit()

    # If the transaction was a duplicate it was silently skipped — still return a summary.
    actual_id = str(row[0]) if row else txn_id

    # Fire-and-forget investigation so ingest returns immediately.
    background_tasks.add_task(_investigate_background, actual_id)

    return TransactionSummary(
        id=actual_id,
        external_id=payload.external_id,
        source=payload.source,
        amount_pence=payload.amount_pence,
        currency=payload.currency,
        customer_id=payload.customer_id,
        risk_score=score,
        risk_level=level,
        status="queued",
        created_at=payload.occurred_at,
    )


async def _investigate_background(transaction_id: str) -> None:
    import traceback
    from ..services import context_aggregator, rag_service, llm_engine
    from ..services.risk_scorer import RULE_INDEX

    try:
        async with AsyncSessionLocal() as db:
            row = await db.execute(
                text("SELECT * FROM transactions WHERE id = :id"),
                {"id": transaction_id},
            )
            txn = row.mappings().first()
            if not txn:
                return

            txn_dict = dict(txn)
            raw_signals = txn_dict.get("fraud_signals") or []
            if not isinstance(raw_signals, list):
                raw_signals = []

            structured_factors = []
            for signal in raw_signals:
                if isinstance(signal, str) and signal in RULE_INDEX:
                    pts, evidence = RULE_INDEX[signal]
                    structured_factors.append({"label": signal, "score": pts, "evidence": evidence})
                elif isinstance(signal, dict):
                    structured_factors.append(signal)

            ctx = await context_aggregator.aggregate(db, txn_dict)
            txn_dict["aggregated_context"] = ctx

            similar_cases, _ = await rag_service.retrieve_for_transaction(
                db, txn_dict, structured_factors
            )

            result = await llm_engine.investigate(txn_dict, structured_factors, similar_cases)

            await db.execute(
                text("""
                    INSERT INTO investigations (
                        transaction_id, risk_score, risk_level, fraud_type, confidence,
                        summary, recommended_action, risk_factors, retrieved_case_ids,
                        policy_rules_triggered, llm_provider, llm_model
                    ) VALUES (
                        :transaction_id, :risk_score, :risk_level, :fraud_type, :confidence,
                        :summary, :recommended_action,
                        :risk_factors, :retrieved_case_ids,
                        :policy_rules, :llm_provider, :llm_model
                    )
                """),
                {
                    "transaction_id": transaction_id,
                    "risk_score": result.risk_score,
                    "risk_level": result.risk_level,
                    "fraud_type": result.fraud_type,
                    "confidence": result.confidence,
                    "summary": result.summary,
                    "recommended_action": result.recommended_action,
                    "risk_factors": json.dumps([f.model_dump() for f in result.risk_factors]),
                    "retrieved_case_ids": json.dumps([c.case_id for c in result.retrieved_cases]),
                    "policy_rules": json.dumps(result.policy_rules_triggered),
                    "llm_provider": result.llm_provider,
                    "llm_model": result.llm_model,
                },
            )
            await db.commit()
    except Exception:
        traceback.print_exc()
        print(f"[bg] investigation failed for {transaction_id}", flush=True)
