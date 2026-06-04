import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..core.database import get_db
from ..core.config import settings as app_settings
from ..services.llm_engine import provider_availability

router = APIRouter(prefix="/settings", tags=["settings"])

SUPPORTED_EVENTS = [
    "case.created",
    "case.investigated",
    "decision.submitted",
    "decision.overridden",
    "case.escalated",
    "psr_pack.generated",
]


# ── Schema ────────────────────────────────────────────────────────────────────

class WebhookConfig(BaseModel):
    webhook_url:     str | None
    webhook_enabled: bool
    webhook_events:  list[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _ensure_settings(db: AsyncSession) -> dict:
    row = await db.execute(text("SELECT * FROM workspace_settings LIMIT 1"))
    r = row.mappings().first()
    if r:
        return dict(r)
    secret = str(uuid.uuid4())
    await db.execute(
        text("INSERT INTO workspace_settings (webhook_secret) VALUES (:s)"),
        {"s": secret},
    )
    await db.commit()
    return {"webhook_url": None, "webhook_secret": secret,
            "webhook_events": [], "webhook_enabled": False}


def _parse_events(raw) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    import json
    try:
        return json.loads(raw)
    except Exception:
        return []


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/webhook")
async def get_webhook(db: AsyncSession = Depends(get_db)):
    cfg = await _ensure_settings(db)
    return {
        "webhook_url":     cfg.get("webhook_url"),
        "webhook_secret":  cfg.get("webhook_secret"),
        "webhook_enabled": bool(cfg.get("webhook_enabled")),
        "webhook_events":  _parse_events(cfg.get("webhook_events")),
        "supported_events": SUPPORTED_EVENTS,
    }


@router.put("/webhook")
async def update_webhook(body: WebhookConfig, db: AsyncSession = Depends(get_db)):
    import json
    await _ensure_settings(db)
    await db.execute(text("""
        UPDATE workspace_settings
        SET webhook_url     = :url,
            webhook_enabled = :enabled,
            webhook_events  = CAST(:events AS jsonb),
            updated_at      = NOW()
    """), {
        "url":     body.webhook_url,
        "enabled": body.webhook_enabled,
        "events":  json.dumps(body.webhook_events),
    })
    await db.commit()
    return {"ok": True}


@router.post("/webhook/rotate-secret")
async def rotate_secret(db: AsyncSession = Depends(get_db)):
    await _ensure_settings(db)
    new_secret = str(uuid.uuid4())
    await db.execute(
        text("UPDATE workspace_settings SET webhook_secret = :s, updated_at = NOW()"),
        {"s": new_secret},
    )
    await db.commit()
    return {"webhook_secret": new_secret}


@router.get("/webhook/deliveries")
async def get_deliveries(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(text("""
        SELECT delivery_id, event_type, webhook_url, attempt,
               status, response_code, error, created_at
        FROM webhook_deliveries
        ORDER BY created_at DESC
        LIMIT 50
    """))
    entries = []
    for r in rows.mappings():
        item = dict(r)
        if hasattr(item.get("created_at"), "isoformat"):
            item["created_at"] = item["created_at"].isoformat()
        entries.append(item)
    return {"deliveries": entries}


# ── LLM provider switcher ───────────────────────────────────────────────────────

class LlmConfig(BaseModel):
    provider: str


@router.get("/llm")
async def get_llm(db: AsyncSession = Depends(get_db)):
    cfg = await _ensure_settings(db)
    active = cfg.get("llm_provider") or app_settings.llm_provider
    return {
        "active":    active,
        "default":   app_settings.llm_provider,   # env LLM_PROVIDER
        "providers": provider_availability(),
    }


@router.put("/llm")
async def set_llm(body: LlmConfig, db: AsyncSession = Depends(get_db)):
    providers = {p["id"]: p for p in provider_availability()}
    if body.provider not in providers:
        raise HTTPException(400, f"Unknown provider: {body.provider}")
    if not providers[body.provider]["available"]:
        raise HTTPException(400, f"Provider '{body.provider}' is not configured on this server")
    await _ensure_settings(db)
    await db.execute(
        text("UPDATE workspace_settings SET llm_provider = :p, updated_at = NOW()"),
        {"p": body.provider},
    )
    await db.commit()
    return {"ok": True, "active": body.provider}
