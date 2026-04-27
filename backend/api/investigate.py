from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..core.database import get_db
from ..models.investigation import InvestigationResult
from ..services import llm_engine

router = APIRouter(prefix="/investigations", tags=["investigations"])


@router.post("/{transaction_id}", response_model=InvestigationResult)
async def run_investigation(transaction_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.execute(
        text("SELECT * FROM transactions WHERE id = :id"),
        {"id": transaction_id},
    )
    txn = row.mappings().first()
    if not txn:
        raise HTTPException(404, "Transaction not found")

    # TODO: pull full context (device history, customer history, velocity)
    # TODO: RAG retrieval from fraud_cases + policy_docs
    context = dict(txn)
    risk_factors: list[dict] = []
    prior_cases: list[dict] = []

    result = await llm_engine.investigate(context, risk_factors, prior_cases)

    await db.execute(
        text("""
            INSERT INTO investigations (
                transaction_id, risk_score, risk_level, fraud_type, confidence,
                summary, recommended_action, risk_factors, policy_rules_triggered,
                llm_provider, llm_model
            ) VALUES (
                :transaction_id, :risk_score, :risk_level, :fraud_type, :confidence,
                :summary, :recommended_action, :risk_factors::jsonb, :policy_rules::jsonb,
                :llm_provider, :llm_model
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
            "risk_factors": str([f.model_dump() for f in result.risk_factors]),
            "policy_rules": str(result.policy_rules_triggered),
            "llm_provider": result.llm_provider,
            "llm_model": result.llm_model,
        },
    )
    await db.commit()
    return result


@router.get("/queue")
async def get_queue(
    limit: int = 50,
    status: str = "pending",
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        text("""
            SELECT i.id, i.transaction_id, i.risk_score, i.risk_level,
                   i.fraud_type, i.confidence, i.recommended_action, i.created_at,
                   t.amount_pence, t.currency, t.customer_id, t.customer_email, t.source
            FROM investigations i
            JOIN transactions t ON t.id = i.transaction_id
            WHERE i.status = :status
            ORDER BY i.risk_score DESC, i.created_at ASC
            LIMIT :limit
        """),
        {"status": status, "limit": limit},
    )
    return {"items": [dict(r) for r in rows.mappings()]}
