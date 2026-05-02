import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..core.database import get_db
from ..models.investigation import InvestigationResult
from ..services import context_aggregator, rag_service, llm_engine
from ..services.risk_scorer import RULE_INDEX

router = APIRouter(prefix="/investigations", tags=["investigations"])


# ── Queue (must be declared before /{id} to avoid route shadowing) ─────────────

@router.get("/queue")
async def get_queue(
    limit: int = 50,
    status: str = "pending",
    db: AsyncSession = Depends(get_db),
):
    order = "d.decided_at DESC" if status == "decided" else "i.risk_score DESC, i.created_at ASC"
    rows = await db.execute(
        text(f"""
            SELECT
                i.id, i.transaction_id, i.risk_score, i.risk_level,
                i.fraud_type, i.confidence, i.recommended_action, i.created_at,
                i.vulnerability_flag,
                t.amount_pence, t.currency, t.customer_id, t.customer_email, t.source,
                d.action  AS decision_action,
                d.analyst_id,
                d.decided_at
            FROM investigations i
            JOIN transactions t ON t.id = i.transaction_id
            LEFT JOIN decisions d ON d.investigation_id = i.id
            WHERE i.status = :status
            ORDER BY {order}
            LIMIT :limit
        """),
        {"status": status, "limit": limit},
    )
    items = []
    for r in rows.mappings():
        item = dict(r)
        for field in ("created_at", "decided_at"):
            if hasattr(item.get(field), "isoformat"):
                item[field] = item[field].isoformat()
        items.append(item)
    return {"items": items}


# ── Investigation detail ───────────────────────────────────────────────────────

@router.get("/{investigation_id}")
async def get_investigation(investigation_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.execute(
        text("""
            SELECT
                i.id, i.transaction_id, i.risk_score, i.risk_level,
                i.fraud_type, i.confidence, i.summary, i.recommended_action,
                i.risk_factors, i.retrieved_case_ids, i.policy_rules_triggered,
                i.vulnerability_flag, i.vulnerability_indicators,
                i.created_at, i.status, i.llm_provider, i.llm_model,
                t.amount_pence, t.currency, t.customer_id, t.customer_email,
                t.merchant_name, t.beneficiary_account, t.beneficiary_name,
                t.transfer_type, t.ip_address, t.device_fingerprint,
                t.geolocation, t.occurred_at, t.source, t.external_id,
                t.risk_score AS txn_risk_score, t.risk_level AS txn_risk_level
            FROM investigations i
            JOIN transactions t ON t.id = i.transaction_id
            WHERE i.id = :id
        """),
        {"id": investigation_id},
    )
    data = row.mappings().first()
    if not data:
        raise HTTPException(404, "Investigation not found")

    result = dict(data)
    # Serialize datetimes
    for field in ("created_at", "occurred_at"):
        if hasattr(result.get(field), "isoformat"):
            result[field] = result[field].isoformat()
    # JSONB fields come back from asyncpg as Python objects already
    result["id"] = str(result["id"])
    result["transaction_id"] = str(result["transaction_id"])
    return result


# ── Manual re-run ──────────────────────────────────────────────────────────────

@router.post("/{transaction_id}", response_model=InvestigationResult)
async def run_investigation(transaction_id: str, db: AsyncSession = Depends(get_db)):
    """Trigger or re-run an investigation for a stored transaction."""
    row = await db.execute(
        text("SELECT * FROM transactions WHERE id = :id"),
        {"id": transaction_id},
    )
    txn = row.mappings().first()
    if not txn:
        raise HTTPException(404, "Transaction not found")

    txn_dict = dict(txn)

    # Rebuild risk factors from stored signals
    stored_signals = txn_dict.get("fraud_signals") or []
    if not isinstance(stored_signals, list):
        stored_signals = []
    risk_factors = []
    for signal in stored_signals:
        if isinstance(signal, str) and signal in RULE_INDEX:
            pts, evidence = RULE_INDEX[signal]
            risk_factors.append({"label": signal, "score": pts, "evidence": evidence})
        elif isinstance(signal, dict):
            risk_factors.append(signal)

    ctx = await context_aggregator.aggregate(db, txn_dict)
    txn_dict["aggregated_context"] = ctx

    similar_cases, _ = await rag_service.retrieve_for_transaction(db, txn_dict, risk_factors)

    result = await llm_engine.investigate(txn_dict, risk_factors, similar_cases)

    await db.execute(
        text("""
            INSERT INTO investigations (
                transaction_id, risk_score, risk_level, fraud_type, confidence,
                summary, recommended_action, risk_factors, retrieved_case_ids,
                policy_rules_triggered, vulnerability_flag, vulnerability_indicators,
                llm_provider, llm_model
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
            "vulnerability_flag": result.vulnerability_flag,
            "vulnerability_indicators": json.dumps(result.vulnerability_indicators),
            "llm_provider": result.llm_provider,
            "llm_model": result.llm_model,
        },
    )
    await db.commit()
    return result
