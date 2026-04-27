from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..core.database import get_db
from ..models.transaction import IngestPayload, TransactionSummary
from ..services import risk_scorer
import uuid

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/transaction", response_model=TransactionSummary, status_code=202)
async def ingest_transaction(payload: IngestPayload, db: AsyncSession = Depends(get_db)):
    score, factors = risk_scorer.score(payload)
    level = risk_scorer.risk_level(score)
    txn_id = str(uuid.uuid4())

    await db.execute(
        text("""
            INSERT INTO transactions (
                id, external_id, source, amount_pence, currency,
                customer_id, customer_email, merchant_name,
                beneficiary_account, beneficiary_name, transfer_type,
                ip_address, device_fingerprint, geolocation,
                fraud_signals, triggered_rules, raw_payload, occurred_at
            ) VALUES (
                :id, :external_id, :source, :amount_pence, :currency,
                :customer_id, :customer_email, :merchant_name,
                :beneficiary_account, :beneficiary_name, :transfer_type,
                :ip_address, :device_fingerprint, :geolocation,
                :fraud_signals, :triggered_rules, :raw_payload, :occurred_at
            )
            ON CONFLICT (source, external_id) DO NOTHING
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
            "fraud_signals": payload.model_dump_json(include={"fraud_signals"}) if payload.fraud_signals else "[]",
            "triggered_rules": payload.model_dump_json(include={"triggered_rules"}) if payload.triggered_rules else "[]",
            "raw_payload": str(payload.raw_payload) if payload.raw_payload else None,
            "occurred_at": payload.occurred_at,
        },
    )
    await db.commit()

    return TransactionSummary(
        id=txn_id,
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
