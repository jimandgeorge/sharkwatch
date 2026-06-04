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
    """Async generator that yields text tokens from the active LLM provider."""
    entity_ctx = await _get_entity_context(db, txn)
    system = SYSTEM_PROMPT + "\n\n" + _build_context(inv, txn, entity_ctx)

    # Build alternating user/assistant history.
    # If a previous stream failed, the analyst message was inserted into the DB
    # without a corresponding assistant reply — leaving a trailing orphaned user
    # message that would make the Anthropic API reject with a 400.
    raw = [
        {"role": "user" if m["role"] == "analyst" else "assistant", "content": m["content"]}
        for m in history[-20:]
    ]
    messages: list[dict] = []
    for msg in raw:
        if messages and messages[-1]["role"] == msg["role"]:
            messages[-1] = msg  # deduplicate consecutive same-role entries
        else:
            messages.append(msg)
    # If history ends with an orphaned user message, replace it with the current
    # question (the old question was never answered so dropping it is fine).
    if messages and messages[-1]["role"] == "user":
        messages[-1] = {"role": "user", "content": question}
    else:
        messages.append({"role": "user", "content": question})

    # Active provider — runtime-switchable, same source as the investigation engine.
    row = await db.execute(text("SELECT llm_provider FROM workspace_settings LIMIT 1"))
    provider = row.scalar() or settings.llm_provider

    if provider == "anthropic":
        gen = _stream_anthropic(system, messages)
    elif provider == "ollama":
        gen = _stream_ollama(system, messages)
    elif provider == "azure":
        gen = _stream_azure(system, messages)
    elif provider == "bedrock":
        gen = _stream_bedrock(system, messages)
    elif provider == "mock":
        gen = _stream_mock(messages)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")

    async for token in gen:
        yield token


# ── Provider-specific streaming ─────────────────────────────────────────────────

async def _stream_anthropic(system: str, messages: list[dict]):
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=system,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def _stream_ollama(system: str, messages: list[dict]):
    import httpx
    payload = {
        "model": settings.ollama_model,
        "messages": [{"role": "system", "content": system}, *messages],
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", f"{settings.ollama_base_url}/api/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                data = json.loads(line)
                chunk = (data.get("message") or {}).get("content")
                if chunk:
                    yield chunk


async def _stream_azure(system: str, messages: list[dict]):
    from openai import AsyncAzureOpenAI
    client = AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_key,
        api_version="2024-08-01-preview",
    )
    stream = await client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "system", "content": system}, *messages],
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def _stream_bedrock(system: str, messages: list[dict]):
    import boto3, asyncio
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "system": system,
        "messages": messages,
    })
    client = boto3.client("bedrock-runtime", region_name=settings.aws_bedrock_region)
    loop = asyncio.get_event_loop()
    resp = await loop.run_in_executor(
        None,
        lambda: client.invoke_model_with_response_stream(
            modelId=settings.aws_bedrock_model_id, body=body
        ),
    )
    it = iter(resp["body"])

    def _next():
        try:
            return next(it)
        except StopIteration:
            return None

    while True:
        event = await loop.run_in_executor(None, _next)
        if event is None:
            break
        chunk = event.get("chunk")
        if not chunk:
            continue
        data = json.loads(chunk["bytes"].decode())
        if data.get("type") == "content_block_delta":
            text_delta = (data.get("delta") or {}).get("text")
            if text_delta:
                yield text_delta


async def _stream_mock(messages: list[dict]):
    import asyncio
    reply = (
        "[MOCK] Based on the evidence in context, this is consistent with the "
        "flagged pattern. Switch to a real provider in Settings → Model for "
        "genuine analysis."
    )
    for word in reply.split(" "):
        yield word + " "
        await asyncio.sleep(0.02)
