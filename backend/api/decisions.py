from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..core.database import get_db
from ..models.decision import DecisionPayload, DecisionRecord
import uuid
from datetime import datetime

router = APIRouter(prefix="/decisions", tags=["decisions"])


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

    decision_id = str(uuid.uuid4())
    now = datetime.utcnow()

    await db.execute(
        text("""
            INSERT INTO decisions (
                id, transaction_id, investigation_id, action,
                analyst_id, analyst_notes, ai_recommended_action,
                override_reason, risk_score, decided_at
            ) VALUES (
                :id, :txn_id, :inv_id, :action,
                :analyst_id, :notes, :ai_action,
                :override, :risk_score, :decided_at
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
            "risk_score": inv["risk_score"],
            "decided_at": now,
        },
    )
    await db.execute(
        text("UPDATE investigations SET status = 'decided' WHERE id = :id"),
        {"id": inv["id"]},
    )
    await db.commit()

    return DecisionRecord(
        id=decision_id,
        transaction_id=payload.transaction_id,
        action=payload.action,
        analyst_id=x_analyst_id,
        analyst_notes=payload.analyst_notes,
        ai_recommended_action=inv["recommended_action"],
        override_reason=payload.override_reason,
        risk_score=inv["risk_score"],
        decided_at=now,
    )
