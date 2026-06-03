#!/usr/bin/env python3
"""
Wipe all operational data and reseed with fresh pending cases.

  python -m backend.db.reset
"""
import asyncio
import ssl
import sys
from pathlib import Path
import os

# Load .env
env_file = Path(__file__).parent.parent.parent / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

import asyncpg
from backend.db.seed import seed

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://fraud:changeme@localhost:5432/fraudcopilot",
)
OLLAMA = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


async def reset():
    pg_url = DB_URL.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    conn = await asyncpg.connect(pg_url, ssl=ssl_ctx, statement_cache_size=0)
    try:
        print("Wiping operational tables...")
        await conn.execute("""
            TRUNCATE TABLE
                decisions,
                investigation_messages,
                investigations,
                transactions
            RESTART IDENTITY CASCADE
        """)
        print("  decisions               — cleared")
        print("  investigation_messages  — cleared")
        print("  investigations          — cleared")
        print("  transactions            — cleared")
    finally:
        await conn.close()

    print("\nReseeding...")
    await seed(DB_URL, generate_embeddings=False, ollama_url=OLLAMA)


if __name__ == "__main__":
    asyncio.run(reset())
