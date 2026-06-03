"""
Outbound webhook service.

fire(event, data) is the public interface — call it from any request handler.
It schedules delivery as a background asyncio task so the API response is never
held up. Each delivery attempt is logged; retries use exponential backoff.

Signature scheme (Slack-style):
  HMAC-SHA256(secret, f"v0:{timestamp}:{delivery_id}:{body}")
  Header: X-Shark-Watch-Signature: v0=<hex>
"""

import asyncio
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import text

from ..core.database import AsyncSessionLocal

RETRY_DELAYS = [0, 15, 60]  # attempt 1 immediate, attempt 2 after 15s, attempt 3 after 60s


# ── Signing ───────────────────────────────────────────────────────────────────

def _sign(secret: str, timestamp: str, delivery_id: str, body: str) -> str:
    msg = f"v0:{timestamp}:{delivery_id}:{body}".encode()
    return "v0=" + hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


# ── Database helpers ──────────────────────────────────────────────────────────

async def _get_config() -> dict | None:
    async with AsyncSessionLocal() as db:
        row = await db.execute(text("SELECT * FROM workspace_settings LIMIT 1"))
        r = row.mappings().first()
        return dict(r) if r else None


async def _log_attempt(
    delivery_id: str, event: str, url: str, payload: dict,
    attempt: int, status: str, response_code: int | None, error: str | None,
):
    async with AsyncSessionLocal() as db:
        await db.execute(text("""
            INSERT INTO webhook_deliveries
              (delivery_id, event_type, webhook_url, payload, attempt, status, response_code, error)
            VALUES
              (:delivery_id, :event, :url, CAST(:payload AS jsonb), :attempt, :status, :code, :error)
        """), {
            "delivery_id": delivery_id,
            "event":        event,
            "url":          url,
            "payload":      json.dumps(payload, default=str),
            "attempt":      attempt,
            "status":       status,
            "code":         response_code,
            "error":        error,
        })
        await db.commit()


# ── HTTP delivery ─────────────────────────────────────────────────────────────

async def _post(url: str, headers: dict, body: str) -> tuple[int, str | None]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, content=body, headers=headers)
            return r.status_code, None
    except Exception as exc:
        return 0, str(exc)


async def _deliver_with_retry(
    event: str, delivery_id: str, url: str, secret: str,
    payload: dict, payload_json: str,
):
    timestamp = datetime.now(timezone.utc).isoformat()
    sig = _sign(secret, timestamp, delivery_id, payload_json)
    headers = {
        "Content-Type":               "application/json",
        "X-Shark-Watch-Event":        event,
        "X-Shark-Watch-Delivery":     delivery_id,
        "X-Shark-Watch-Signature":    sig,
        "X-Shark-Watch-Timestamp":    timestamp,
    }

    for attempt, delay in enumerate(RETRY_DELAYS, 1):
        if delay:
            await asyncio.sleep(delay)

        code, error = await _post(url, headers, payload_json)
        success = 200 <= code < 300

        await _log_attempt(
            delivery_id, event, url, payload, attempt,
            "success" if success else "failed",
            code if code else None,
            error,
        )

        if success:
            return


# ── Background task ───────────────────────────────────────────────────────────

async def _fire_task(event: str, data: dict):
    config = await _get_config()
    if not config:
        return
    if not config.get("webhook_url") or not config.get("webhook_enabled"):
        return

    events = config.get("webhook_events") or []
    if isinstance(events, str):
        events = json.loads(events)
    if event not in events:
        return

    delivery_id = str(uuid.uuid4())
    payload = {
        "event":       event,
        "delivery_id": delivery_id,
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "data":        data,
    }
    payload_json = json.dumps(payload, default=str)

    await _deliver_with_retry(
        event, delivery_id,
        config["webhook_url"], config["webhook_secret"],
        payload, payload_json,
    )


# ── Public interface ──────────────────────────────────────────────────────────

def fire(event: str, data: dict) -> None:
    """Schedule a webhook delivery. Safe to call from any async handler."""
    asyncio.create_task(_fire_task(event, data))
