from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..core.database import get_db

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
async def get_audit_log(
    limit: int = 500,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        text("""
            SELECT
                d.id              AS decision_id,
                d.action,
                d.analyst_id,
                d.analyst_notes,
                d.override_reason,
                d.ai_recommended_action,
                d.risk_score,
                d.decided_at,
                i.id              AS investigation_id,
                i.fraud_type,
                i.confidence,
                i.summary,
                t.id              AS transaction_id,
                t.external_id,
                t.amount_pence,
                t.currency,
                t.customer_id,
                t.customer_email,
                t.source,
                t.occurred_at,
                t.beneficiary_name,
                t.beneficiary_account
            FROM decisions d
            JOIN investigations i ON i.id = d.investigation_id
            JOIN transactions t  ON t.id = d.transaction_id
            ORDER BY d.decided_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"limit": limit, "offset": offset},
    )

    entries = []
    for r in rows.mappings():
        item = dict(r)
        for field in ("decided_at", "occurred_at"):
            if hasattr(item.get(field), "isoformat"):
                item[field] = item[field].isoformat()
        for field in ("decision_id", "investigation_id", "transaction_id"):
            item[field] = str(item[field])
        entries.append(item)

    stats_row = await db.execute(
        text("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE action != ai_recommended_action) AS overrides
            FROM decisions
        """)
    )
    stats = dict(stats_row.mappings().first())

    return {
        "entries": entries,
        "total": int(stats["total"]),
        "overrides": int(stats["overrides"]),
    }
