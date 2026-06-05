from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.internal import require_internal
from ..services import admin as svc

router = APIRouter(tags=["auth"])


class VerifyRequest(BaseModel):
    email: str
    password: str


class AcceptRequest(BaseModel):
    password: str
    name: str | None = None


# Internal: backs the NextAuth "account" credentials provider (server-side only).
@router.post("/auth/verify", dependencies=[Depends(require_internal)])
async def verify(body: VerifyRequest, db: AsyncSession = Depends(get_db)):
    user = await svc.verify_user(db, body.email, body.password)
    if not user:
        raise HTTPException(401, "Invalid credentials")
    return user


# Public (token-gated): invite validation + acceptance.
@router.get("/invite/{token}")
async def get_invite(token: str, db: AsyncSession = Depends(get_db)):
    return await svc.get_invite(db, token)


@router.post("/invite/{token}/accept")
async def accept_invite(token: str, body: AcceptRequest, db: AsyncSession = Depends(get_db)):
    if len(body.password or "") < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    try:
        return await svc.accept_invite(db, token, body.password, body.name)
    except ValueError as e:
        raise HTTPException(400, f"Invite {str(e)}")
