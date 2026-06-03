"""
API key authentication middleware.

Two modes:
  API_KEY_HASH  — SHA-256 hash of the key (preferred, safe to commit)
  API_KEY       — plaintext key (legacy, still supported)

Leave both blank to disable auth (local dev only).
Clients must send:  X-API-Key: <key>

Generate a hash:
  python -c "import hashlib; print(hashlib.sha256(b'your-key').hexdigest())"

/health and /docs are always exempt so Docker healthchecks and OpenAPI work.
"""
import hashlib
import hmac

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .config import settings

_EXEMPT = {"/health", "/api/v1/docs", "/api/v1/openapi.json"}


def _auth_enabled() -> bool:
    return bool(settings.api_key_hash or settings.api_key)


def _verify(provided: str) -> bool:
    if not provided:
        return False
    if settings.api_key_hash:
        digest = hashlib.sha256(provided.encode()).hexdigest()
        return hmac.compare_digest(digest, settings.api_key_hash)
    if settings.api_key:
        # Legacy plaintext — timing-safe comparison
        return hmac.compare_digest(provided, settings.api_key)
    return False


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not _auth_enabled() or request.url.path in _EXEMPT:
            return await call_next(request)

        key = request.headers.get("X-API-Key", "")
        if not _verify(key):
            return JSONResponse(
                {"detail": "Invalid or missing API key"},
                status_code=401,
            )

        return await call_next(request)
