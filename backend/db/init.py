"""Idempotent core-schema init — run on backend startup.

Applies schema.sql (tables, pgvector extension, indexes) only if the schema isn't
already present. No-op on an existing database (e.g. the managed Neon instance), and a
one-time setup on a fresh self-hosted Postgres. Demo data is NOT inserted (that's
backend.db.seed, run manually).

Run:  python -m backend.db.init
"""
import asyncio
import ssl
from pathlib import Path

import asyncpg

from backend.core.config import settings

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def _dsn() -> str:
    return settings.database_url.replace("+asyncpg", "").split("?")[0]


def _ssl_arg():
    if not settings.db_ssl:
        return None
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def main():
    conn = await asyncpg.connect(_dsn(), ssl=_ssl_arg())
    try:
        exists = await conn.fetchval("SELECT to_regclass('public.transactions')")
        if exists:
            print("[init] schema already present — skipping", flush=True)
            return
        print("[init] applying core schema…", flush=True)
        await conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))
        print("[init] schema applied", flush=True)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
