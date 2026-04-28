"""
APP Fraud Investigation Copilot — conversational chat engine.
Retrieves entity evidence from Postgres, then calls Claude to answer analyst questions.
"""
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..core.config import settings

SYSTEM_PROMPT = """You are an APP (Authorised Push Payment) fraud investigation copilot.

An analyst is investigating a flagged transaction and asking follow-up questions to gather evidence before making a decision.

Rules:
- Answer using ONLY the evidence in the context provided — never speculate beyond it
- Lead with the key finding, then supporting detail
- Keep answers concise (2–4 sentences) unless the analyst explicitly asks for detail
- If the evidence is insufficient to answer, say exactly what data is missing
- Write in plain, direct prose — no JSON, no markdown headers
"""


def _s(obj):
    """JSON-safe serialiser for UUID / datetime objects."""
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return str(obj)


async def _get_entity_context(db: AsyncSession, txn: dict) -> dict:
    txn_id = str(txn.get("id", ""))
    ctx: dict = {}

    if txn.get("beneficiary_account"):
        rows = await db.execute(
            text("""
                SELECT t.customer_id, t.amount_pence, t.currency, t.risk_level,
                       t.risk_score, t.occurred_at,
                       i.fraud_type, i.recommended_action, i.confidence
                FROM transactions t
                LEFT JOIN investigations i ON i.transaction_id = t.id
                WHERE t.beneficiary_account = :acct AND t.id::text != :txn_id
                ORDER BY t.occurred_at DESC LIMIT 10
            """),
            {"acct": txn["beneficiary_account"], "txn_id": txn_id},
        )
        ctx["beneficiary_history"] = [dict(r) for r in rows.mappings()]

    if txn.get("device_fingerprint"):
        rows = await db.execute(
            text("""
                SELECT t.customer_id, t.amount_pence, t.risk_level, t.occurred_at,
                       i.fraud_type, i.recommended_action
                FROM transactions t
                LEFT JOIN investigations i ON i.transaction_id = t.id
                WHERE t.device_fingerprint = :fp AND t.id::text != :txn_id
                ORDER BY t.occurred_at DESC LIMIT 10
            """),
            {"fp": txn["device_fingerprint"], "txn_id": txn_id},
        )
        ctx["device_history"] = [dict(r) for r in rows.mappings()]

    if txn.get("customer_id"):
        rows = await db.execute(
            text("""
                SELECT t.amount_pence, t.beneficiary_account, t.beneficiary_name,
                       t.risk_level, t.occurred_at, i.fraud_type, i.recommended_action
                FROM transactions t
                LEFT JOIN investigations i ON i.transaction_id = t.id
                WHERE t.customer_id = :cid AND t.id::text != :txn_id
                ORDER BY t.occurred_at DESC LIMIT 10
            """),
            {"cid": txn["customer_id"], "txn_id": txn_id},
        )
        ctx["customer_history"] = [dict(r) for r in rows.mappings()]

    if txn.get("ip_address"):
        rows = await db.execute(
            text("""
                SELECT t.customer_id, t.amount_pence, t.risk_level, t.occurred_at,
                       i.fraud_type
                FROM transactions t
                LEFT JOIN investigations i ON i.transaction_id = t.id
                WHERE t.ip_address = :ip AND t.id::text != :txn_id
                ORDER BY t.occurred_at DESC LIMIT 5
            """),
            {"ip": txn["ip_address"], "txn_id": txn_id},
        )
        ctx["ip_history"] = [dict(r) for r in rows.mappings()]

    return ctx


def _build_context(inv: dict, txn: dict, entity_ctx: dict) -> str:
    def section(title: str, rows: list) -> str:
        return (
            f"\n{title} ({len(rows)} records):\n"
            + json.dumps(rows, indent=2, default=_s)
        )

    return (
        "=== TRANSACTION UNDER INVESTIGATION ===\n"
        + json.dumps(
            {k: v for k, v in txn.items() if k != "embedding"},
            indent=2,
            default=_s,
        )
        + "\n\n=== INITIAL AI ASSESSMENT ===\n"
        + f"Fraud type: {inv.get('fraud_type') or 'None identified'}\n"
        + f"Confidence: {inv.get('confidence')}\n"
        + f"Summary: {inv.get('summary')}\n"
        + f"Recommended action: {inv.get('recommended_action')}\n"
        + f"Risk signals: {json.dumps(inv.get('risk_factors') or [], default=_s)}\n"
        + "\n=== ENTITY HISTORY ==="
        + section(
            f"Beneficiary account '{txn.get('beneficiary_account')}' — other transactions",
            entity_ctx.get("beneficiary_history", []),
        )
        + section("Customer — other transactions", entity_ctx.get("customer_history", []))
        + section("Device fingerprint — other transactions", entity_ctx.get("device_history", []))
        + section(f"IP '{txn.get('ip_address')}' — other transactions", entity_ctx.get("ip_history", []))
    )


async def answer_stream(
    db: AsyncSession,
    question: str,
    history: list[dict],
    inv: dict,
    txn: dict,
):
    """Async generator that yields text tokens from Claude."""
    import anthropic

    entity_ctx = await _get_entity_context(db, txn)
    system = SYSTEM_PROMPT + "\n\n" + _build_context(inv, txn, entity_ctx)

    messages = []
    for msg in history[-20:]:
        messages.append(
            {
                "role": "user" if msg["role"] == "analyst" else "assistant",
                "content": msg["content"],
            }
        )
    messages.append({"role": "user", "content": question})

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    async with client.messages.stream(
        model="claude-opus-4-7",
        max_tokens=512,
        system=system,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
