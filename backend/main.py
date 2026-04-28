import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .api import ingest, investigate, decisions, chat, entities
from .core.config import settings
from .core.auth import APIKeyMiddleware

app = FastAPI(
    title="Shark Watch",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)

app.add_middleware(APIKeyMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(investigate.router)
app.include_router(decisions.router)
app.include_router(chat.router)
app.include_router(entities.router)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )


@app.get("/health")
async def health():
    return {"ok": True}
