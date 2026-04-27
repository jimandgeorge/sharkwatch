"""
Context Aggregation Engine — the moat.

Given a stored transaction dict, pulls velocity patterns, device history,
beneficiary history, and prior analyst decisions into one enriched object.
Target: <500ms on warm Postgres with proper indexes.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def aggregate(db: AsyncSession, transaction: dict) -> dict:
    customer_id = transaction.get("customer_id")
    device_fp = transaction.get("device_fingerprint")
    beneficiary_account = transaction.get("beneficiary_account")
    amount_pence = int(transaction.get("amount_pence") or 0)

    occurred_at = transaction.get("occurred_at")
    if isinstance(occurred_at, str):
        occurred_at = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
    if occurred_at is None:
        occurred_at = datetime.now(timezone.utc)
    # Ensure tz-aware for comparison
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)

    velocity = await _velocity(db, customer_id, occurred_at)
    device_history = await _device_history(db, device_fp) if device_fp else []
    beneficiary_history = (
        await _beneficiary_history(db, beneficiary_account)
        if beneficiary_account
        else []
    )
    prior_decisions = await _prior_decisions(db, customer_id)
    avg_pence = await _avg_transfer_amount(db, customer_id, occurred_at)

    return {
        "velocity": velocity,
        "device_history": device_history,
        "beneficiary_history": beneficiary_history,
        "prior_decisions": prior_decisions,
        "avg_transfer_pence": avg_pence,
        "transfer_vs_avg_ratio": (
            round(amount_pence / avg_pence, 2)
            if avg_pence and avg_pence > 0
            else None
        ),
    }


async def _velocity(db: AsyncSession, customer_id: str, reference: datetime) -> dict:
    """Count of transactions + total value in 1h / 24h / 7d windows before reference."""
    windows = {"1h": 1, "24h": 24, "7d": 168}
    result = {}
    for label, hours in windows.items():
        since = reference - timedelta(hours=hours)
        row = await db.execute(
            text("""
                SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_pence), 0) AS total
                FROM transactions
                WHERE customer_id = :cid
                  AND occurred_at >= :since
                  AND occurred_at < :ref
            """),
            {"cid": customer_id, "since": since, "ref": reference},
        )
        r = row.mappings().first()
        result[label] = {"count": int(r["cnt"]), "total_pence": int(r["total"])}
    return result


async def _device_history(db: AsyncSession, device_fingerprint: str) -> list[dict]:
    """Other customer accounts seen on this device — mule account detection."""
    rows = await db.execute(
        text("""
            SELECT
                customer_id,
                customer_email,
                COUNT(*) AS txn_count,
                MAX(created_at) AS last_seen
            FROM transactions
            WHERE device_fingerprint = :fp
            GROUP BY customer_id, customer_email
            ORDER BY last_seen DESC
            LIMIT 10
        """),
        {"fp": device_fingerprint},
    )
    return [
        {
            "customer_id": r["customer_id"],
            "customer_email": r["customer_email"],
            "txn_count": int(r["txn_count"]),
            "last_seen": r["last_seen"].isoformat() if r["last_seen"] else None,
        }
        for r in rows.mappings()
    ]


async def _beneficiary_history(db: AsyncSession, beneficiary_account: str) -> list[dict]:
    """Prior transactions to this beneficiary, with any linked analyst decisions."""
    rows = await db.execute(
        text("""
            SELECT
                t.customer_id,
                t.amount_pence,
                t.occurred_at,
                d.action AS decision_action,
                i.fraud_type
            FROM transactions t
            LEFT JOIN decisions d ON d.transaction_id = t.id
            LEFT JOIN investigations i ON i.id = d.investigation_id
            WHERE t.beneficiary_account = :account
            ORDER BY t.occurred_at DESC
            LIMIT 10
        """),
        {"account": beneficiary_account},
    )
    return [
        {
            "customer_id": r["customer_id"],
            "amount_pence": int(r["amount_pence"]),
            "occurred_at": r["occurred_at"].isoformat() if r["occurred_at"] else None,
            "decision_action": r["decision_action"],
            "fraud_type": r["fraud_type"],
        }
        for r in rows.mappings()
    ]


async def _prior_decisions(db: AsyncSession, customer_id: str) -> list[dict]:
    """Last 5 analyst decisions for this customer — pattern context."""
    rows = await db.execute(
        text("""
            SELECT
                d.action,
                d.decided_at,
                d.ai_recommended_action,
                i.fraud_type,
                i.risk_score,
                i.confidence
            FROM decisions d
            JOIN investigations i ON i.id = d.investigation_id
            JOIN transactions t ON t.id = d.transaction_id
            WHERE t.customer_id = :cid
            ORDER BY d.decided_at DESC
            LIMIT 5
        """),
        {"cid": customer_id},
    )
    return [
        {
            "action": r["action"],
            "decided_at": r["decided_at"].isoformat() if r["decided_at"] else None,
            "ai_recommended_action": r["ai_recommended_action"],
            "fraud_type": r["fraud_type"],
            "risk_score": r["risk_score"],
            "confidence": r["confidence"],
        }
        for r in rows.mappings()
    ]


async def _avg_transfer_amount(
    db: AsyncSession, customer_id: str, reference: datetime
) -> int | None:
    """90-day rolling average transfer amount — baseline for anomaly detection."""
    since = reference - timedelta(days=90)
    row = await db.execute(
        text("""
            SELECT AVG(amount_pence)::BIGINT AS avg_pence
            FROM transactions
            WHERE customer_id = :cid
              AND occurred_at >= :since
              AND occurred_at < :ref
        """),
        {"cid": customer_id, "since": since, "ref": reference},
    )
    r = row.mappings().first()
    return int(r["avg_pence"]) if r and r["avg_pence"] else None
