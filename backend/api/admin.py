from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.internal import require_internal
from ..services import admin as svc

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_internal)])


class AdminUser(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None


class WorkspaceCreate(BaseModel):
    name: str
    org_type: str | None = None
    products: list[str] = []
    tier: str = "free"
    is_pilot: bool = False
    pilot_ends_at: date | None = None
    internal_notes: str | None = None
    admin_user: AdminUser | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    org_type: str | None = None
    tier: str | None = None
    is_pilot: bool | None = None
    pilot_ends_at: date | None = None
    internal_notes: str | None = None
    products: list[str] | None = None


class StatusUpdate(BaseModel):
    status: str  # active | suspended


class InviteUser(BaseModel):
    email: str
    role: str = "analyst"


@router.get("/workspaces")
async def workspaces(search: str | None = None, type: str | None = None,
                     tier: str | None = None, db: AsyncSession = Depends(get_db)):
    return {"workspaces": await svc.list_workspaces(db, search=search, org_type=type, tier=tier)}


@router.post("/workspaces")
async def create_workspace(body: WorkspaceCreate, db: AsyncSession = Depends(get_db),
                           x_admin_id: str | None = Header(default=None)):
    return await svc.create_workspace(db, body.model_dump(), x_admin_id)


@router.get("/workspaces/{workspace_id}")
async def get_workspace(workspace_id: str, db: AsyncSession = Depends(get_db)):
    ws = await svc.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws


@router.patch("/workspaces/{workspace_id}")
async def update_workspace(workspace_id: str, body: WorkspaceUpdate, db: AsyncSession = Depends(get_db),
                           x_admin_id: str | None = Header(default=None)):
    await svc.update_workspace(db, workspace_id, body.model_dump(exclude_none=True), x_admin_id)
    return {"ok": True}


@router.post("/workspaces/{workspace_id}/status")
async def workspace_status(workspace_id: str, body: StatusUpdate, db: AsyncSession = Depends(get_db),
                           x_admin_id: str | None = Header(default=None)):
    if body.status not in ("active", "suspended"):
        raise HTTPException(400, "Invalid status")
    await svc.set_status(db, workspace_id, body.status, x_admin_id)
    return {"ok": True}


@router.post("/workspaces/{workspace_id}/invite")
async def invite(workspace_id: str, body: InviteUser, db: AsyncSession = Depends(get_db),
                 x_admin_id: str | None = Header(default=None)):
    try:
        return await svc.invite_user(db, workspace_id=workspace_id, email=body.email,
                                     role=body.role, admin_id=x_admin_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/users/{user_id}")
async def remove_user(user_id: str, db: AsyncSession = Depends(get_db),
                      x_admin_id: str | None = Header(default=None)):
    await svc.remove_user(db, user_id, x_admin_id)
    return {"ok": True}


@router.get("/invites")
async def invites(db: AsyncSession = Depends(get_db)):
    return {"invites": await svc.list_invites(db)}


@router.post("/invites/{invite_id}/resend")
async def resend(invite_id: str, db: AsyncSession = Depends(get_db),
                 x_admin_id: str | None = Header(default=None)):
    try:
        return await svc.resend_invite(db, invite_id, x_admin_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
