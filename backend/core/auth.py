"""
API key authentication middleware.

Set API_KEY in the environment to enable. Leave blank to disable (local dev).
Clients must send:  X-API-Key: <key>

/health and /docs are always exempt so Docker healthchecks and OpenAPI work.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from .config import settings

_EXEMPT = {"/health", "/docs", "/openapi.json", "/redoc"}


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.api_key or request.url.path in _EXEMPT:
            return await call_next(request)

        key = request.headers.get("X-API-Key", "")
        if key != settings.api_key:
            return JSONResponse({"detail": "Invalid or missing API key"}, status_code=401)

        return await call_next(request)
