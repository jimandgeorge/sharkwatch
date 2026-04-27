from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import ingest, investigate, decisions
from .core.config import settings
from .core.auth import APIKeyMiddleware

app = FastAPI(
    title="Fraud Copilot",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)

app.add_middleware(APIKeyMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten per-deployment via nginx
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(investigate.router)
app.include_router(decisions.router)


@app.get("/health")
async def health():
    return {"ok": True}
