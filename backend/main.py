import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .api import ingest, investigate, decisions, chat, entities, audit
from .api import settings as settings_api
from .core.config import settings
from .core.auth import APIKeyMiddleware

from contextlib import asynccontextmanager
from .core.database import engine
from sqlalchemy import text as _text

@asynccontextmanager
async def lifespan(_app):
    async with engine.begin() as conn:
        await conn.execute(_text("""
            CREATE TABLE IF NOT EXISTS workspace_settings (
                id              SERIAL PRIMARY KEY,
                webhook_url     TEXT,
                webhook_secret  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
                webhook_enabled BOOLEAN NOT NULL DEFAULT false,
                webhook_events  JSONB NOT NULL DEFAULT '[]'::jsonb,
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(_text("""
            CREATE TABLE IF NOT EXISTS webhook_deliveries (
                id            SERIAL PRIMARY KEY,
                delivery_id   TEXT NOT NULL,
                event_type    TEXT NOT NULL,
                webhook_url   TEXT NOT NULL,
                payload       JSONB NOT NULL,
                attempt       INTEGER NOT NULL DEFAULT 1,
                status        TEXT NOT NULL,
                response_code INTEGER,
                error         TEXT,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(_text("""
            CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created
            ON webhook_deliveries (created_at DESC)
        """))
        await conn.execute(_text("""
            CREATE TABLE IF NOT EXISTS claim_sequences (
                year     INTEGER PRIMARY KEY,
                next_val INTEGER NOT NULL DEFAULT 1
            )
        """))
        # Audit immutability: block UPDATE/DELETE on decisions (PSR tamper-resistance).
        # See backend/db/harden_audit.py for the standalone migration + docs.
        await conn.execute(_text("""
            CREATE OR REPLACE FUNCTION block_decision_mutation()
            RETURNS trigger AS $fn$
            BEGIN
                RAISE EXCEPTION 'decisions is append-only: % blocked', TG_OP
                    USING ERRCODE = 'insufficient_privilege',
                          HINT = 'Decisions are an immutable PSR audit record.';
            END;
            $fn$ LANGUAGE plpgsql
        """))
        await conn.execute(_text("DROP TRIGGER IF EXISTS trg_decisions_immutable ON decisions"))
        await conn.execute(_text("""
            CREATE TRIGGER trg_decisions_immutable
                BEFORE UPDATE OR DELETE ON decisions
                FOR EACH ROW EXECUTE FUNCTION block_decision_mutation()
        """))
    yield

API_PREFIX = "/api/v1"

app = FastAPI(
    lifespan=lifespan,
    title="EIGG",
    version="0.1.0",
    docs_url=f"{API_PREFIX}/docs" if settings.environment != "production" else None,
    openapi_url=f"{API_PREFIX}/openapi.json",
    redoc_url=None,
)

app.add_middleware(APIKeyMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix=API_PREFIX)
app.include_router(investigate.router, prefix=API_PREFIX)
app.include_router(decisions.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(entities.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)
app.include_router(settings_api.router, prefix=API_PREFIX)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    import uuid as _uuid
    error_id = _uuid.uuid4().hex[:12]
    # Full detail to server logs only — may contain SQL, connection strings, PII.
    print(f"[error {error_id}] {request.method} {request.url.path}", flush=True)
    traceback.print_exc()

    if settings.environment == "production":
        # Generic message to the client; correlate via error_id in the logs.
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error_id": error_id},
        )
    # Dev: surface detail to speed debugging.
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__, "error_id": error_id},
    )


@app.get("/health")
async def health():
    return {"ok": True}


@app.get(f"{API_PREFIX}/system")
async def system_info():
    from .services.llm_engine import _model_name
    return {
        "version": "1.0.0",
        "llm_provider": settings.llm_provider,
        "llm_model": _model_name(),
        "environment": settings.environment,
    }
