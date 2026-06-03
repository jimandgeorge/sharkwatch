#!/usr/bin/env python3
"""
Make the decisions table append-only (PSR audit immutability).

Installs a trigger that blocks UPDATE and DELETE on `decisions`, so a recorded
analyst decision can never be silently rewritten — even by the application's own
database connection. This is the tamper-resistance half of PSR defensibility;
the per-claim SHA-256 hash in the PSR pack is the tamper-evidence half.

  python -m backend.db.harden_audit          # apply
  python -m backend.db.harden_audit --remove # lift (e.g. for a controlled migration)

NOTE — production hardening beyond this:
  For full separation of duties, run the app under a dedicated role that has only
  INSERT/SELECT on `decisions`, and reserve UPDATE/DELETE for a break-glass admin
  role. On Neon the app connects as the table owner (owners bypass GRANTs), so the
  trigger below is what actually enforces immutability in the current setup.
"""
import asyncio
import os
import ssl
from pathlib import Path

# Load .env
env_file = Path(__file__).parent.parent.parent / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

import asyncpg

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://fraud:changeme@localhost:5432/fraudcopilot",
)

APPLY_SQL = """
CREATE OR REPLACE FUNCTION block_decision_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION
        'decisions is append-only: % blocked on row %',
        TG_OP, COALESCE(OLD.id::text, '?')
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'Decisions are an immutable PSR audit record. Record a new decision instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decisions_immutable ON decisions;
CREATE TRIGGER trg_decisions_immutable
    BEFORE UPDATE OR DELETE ON decisions
    FOR EACH ROW EXECUTE FUNCTION block_decision_mutation();
"""

REMOVE_SQL = """
DROP TRIGGER IF EXISTS trg_decisions_immutable ON decisions;
DROP FUNCTION IF EXISTS block_decision_mutation();
"""


async def main(remove: bool) -> None:
    pg_url = DB_URL.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    conn = await asyncpg.connect(pg_url, ssl=ssl_ctx, statement_cache_size=0)
    try:
        if remove:
            await conn.execute(REMOVE_SQL)
            print("Audit immutability trigger REMOVED — decisions table is now mutable.")
        else:
            await conn.execute(APPLY_SQL)
            print("Audit immutability trigger applied — decisions table is now append-only.")
            installed = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_trigger
                    WHERE tgname = 'trg_decisions_immutable' AND NOT tgisinternal
                )
            """)
            print(f"  verified: trigger present = {installed}")
    finally:
        await conn.close()


if __name__ == "__main__":
    import sys
    asyncio.run(main(remove="--remove" in sys.argv))
