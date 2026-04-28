from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..core.database import get_db

router = APIRouter(prefix="/entities", tags=["entities"])

# Whitelist — col is never user-supplied directly in SQL
_ENTITY_COL = {
    "device":   "t.device_fingerprint",
    "account":  "t.beneficiary_account",
    "ip":       "t.ip_address",
    "customer": "t.customer_id",
}


@router.get("/{entity_type}")
async def get_entity(
    entity_type: str,
    value: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    col = _ENTITY_COL.get(entity_type)
    if not col:
        raise HTTPException(400, f"Unknown entity type '{entity_type}'. Use: device, account, ip, customer")

    rows = await db.execute(
        text(f"""
            SELECT
                t.id            AS transaction_id,
                t.customer_id,
                t.customer_email,
                t.amount_pence,
                t.currency,
                t.beneficiary_name,
                t.beneficiary_account,
                t.device_fingerprint,
                t.ip_address,
                t.geolocation,
                t.risk_level    AS txn_risk_level,
                t.risk_score    AS txn_risk_score,
                t.occurred_at,
                i.id            AS investigation_id,
                i.fraud_type,
                i.confidence,
                i.status,
                i.recommended_action,
                i.risk_score,
                i.risk_level,
                d.action        AS decision_action,
                d.analyst_id,
                d.decided_at
            FROM transactions t
            LEFT JOIN investigations i ON i.transaction_id = t.id
            LEFT JOIN decisions      d ON d.investigation_id = i.id
            WHERE {col} = :value
            ORDER BY t.occurred_at DESC
        """),
        {"value": value},
    )

    transactions = []
    total_exposure = 0
    customers: set[str] = set()
    pending = decided = 0

    for r in rows.mappings():
        row = dict(r)
        for field in ("occurred_at", "decided_at"):
            if hasattr(row.get(field), "isoformat"):
                row[field] = row[field].isoformat()
        for field in ("transaction_id", "investigation_id"):
            if row.get(field) is not None:
                row[field] = str(row[field])

        total_exposure += row.get("amount_pence") or 0
        if row.get("customer_id"):
            customers.add(row["customer_id"])
        if row.get("status") == "pending":
            pending += 1
        elif row.get("status") == "decided":
            decided += 1

        transactions.append(row)

    return {
        "entity_type": entity_type,
        "entity_value": value,
        "transactions": transactions,
        "summary": {
            "total_transactions": len(transactions),
            "total_exposure_pence": total_exposure,
            "unique_customers": len(customers),
            "pending": pending,
            "decided": decided,
        },
    }
