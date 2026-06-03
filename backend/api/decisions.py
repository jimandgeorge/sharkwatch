from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..core.database import get_db
from ..models.decision import DecisionPayload, DecisionRecord
from ..services import webhook
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/decisions", tags=["decisions"])


async def _next_claim_ref(db: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    row = await db.execute(
        text("""
            INSERT INTO claim_sequences (year, next_val)
            VALUES (:year, 2)
            ON CONFLICT (year) DO UPDATE
                SET next_val = claim_sequences.next_val + 1
            RETURNING next_val - 1 AS n
        """),
        {"year": year},
    )
    n = row.scalar()
    await db.commit()
    return f"SW-{year}-{n:05d}"


@router.get("/next-ref")
async def next_claim_ref(db: AsyncSession = Depends(get_db)):
    ref = await _next_claim_ref(db)
    return {"claim_reference": ref}


@router.post("", response_model=DecisionRecord, status_code=201)
async def submit_decision(
    payload: DecisionPayload,
    db: AsyncSession = Depends(get_db),
    x_analyst_id: str = Header(..., description="Analyst user ID"),
):
    inv_row = await db.execute(
        text("""
            SELECT i.id, i.recommended_action, i.risk_score
            FROM investigations i
            WHERE i.transaction_id = :txn_id AND i.status = 'pending'
            ORDER BY i.created_at DESC LIMIT 1
        """),
        {"txn_id": payload.transaction_id},
    )
    inv = inv_row.mappings().first()
    if not inv:
        raise HTTPException(404, "No pending investigation for this transaction")

    claim_ref = payload.claim_reference or await _next_claim_ref(db)
    decision_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    await db.execute(
        text("""
            INSERT INTO decisions (
                id, transaction_id, investigation_id, action,
                analyst_id, analyst_notes, ai_recommended_action,
                override_reason, claim_reference, risk_score, decided_at
            ) VALUES (
                :id, :txn_id, :inv_id, :action,
                :analyst_id, :notes, :ai_action,
                :override, :claim_reference, :risk_score, :decided_at
            )
        """),
        {
            "id": decision_id,
            "txn_id": payload.transaction_id,
            "inv_id": inv["id"],
            "action": payload.action,
            "analyst_id": x_analyst_id,
            "notes": payload.analyst_notes,
            "ai_action": inv["recommended_action"],
            "override": payload.override_reason,
            "claim_reference": claim_ref,
            "risk_score": inv["risk_score"],
            "decided_at": now,
        },
    )
    await db.execute(
        text("UPDATE investigations SET status = 'decided' WHERE id = :id"),
        {"id": inv["id"]},
    )
    await db.commit()

    record = DecisionRecord(
        id=decision_id,
        transaction_id=payload.transaction_id,
        action=payload.action,
        analyst_id=x_analyst_id,
        analyst_notes=payload.analyst_notes,
        ai_recommended_action=inv["recommended_action"],
        override_reason=payload.override_reason,
        claim_reference=claim_ref,
        risk_score=inv["risk_score"],
        decided_at=now,
    )

    is_override = payload.action != inv["recommended_action"]
    event_data = {
        "decision_id":         decision_id,
        "investigation_id":    str(inv["id"]),
        "transaction_id":      payload.transaction_id,
        "action":              payload.action,
        "analyst_id":          x_analyst_id,
        "ai_recommended":      inv["recommended_action"],
        "override":            is_override,
        "risk_score":          inv["risk_score"],
        "claim_reference":     claim_ref,
        "decided_at":          now.isoformat(),
    }
    webhook.fire("decision.submitted", event_data)
    if is_override:
        webhook.fire("decision.overridden", event_data)
    if payload.action == "escalate":
        webhook.fire("case.escalated", event_data)

    return record
