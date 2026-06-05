"""Platform admin service — workspaces registry, user accounts, invites, audit.

The invite flow is the critical path:
  create_workspace / invite_user -> creates an `invited` user + a tokenised invite +
  sends the email; accept_invite -> sets the password, activates the user, marks the
  invite accepted. verify_user backs the account login.
"""
import json
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..core.security import hash_password, new_token, verify_password
from .email import send_invite


def _invite_link(token: str) -> str:
    return f"{settings.app_base_url.rstrip('/')}/invite/{token}"


async def audit(db, *, admin_id, action, target_type=None, target_id=None, metadata=None):
    await db.execute(text("""
        INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, metadata)
        VALUES (:admin_id, :action, :tt, :tid, CAST(:meta AS jsonb))
    """), {"admin_id": admin_id, "action": action, "tt": target_type,
           "tid": target_id, "meta": json.dumps(metadata or {})})


def _iso(v):
    return v.isoformat() if hasattr(v, "isoformat") else v


# ── Workspaces ──────────────────────────────────────────────────────────────

async def list_workspaces(db: AsyncSession, *, search=None, org_type=None, tier=None) -> list[dict]:
    rows = (await db.execute(text("""
        SELECT w.*, (SELECT COUNT(*) FROM users u WHERE u.workspace_id = w.id) AS user_count
        FROM workspaces w
        WHERE (CAST(:search AS text) IS NULL OR w.name ILIKE '%' || :search || '%')
          AND (CAST(:org_type AS text) IS NULL OR w.org_type = :org_type)
          AND (CAST(:tier AS text) IS NULL OR w.tier = :tier)
        ORDER BY w.created_at DESC
    """), {"search": search, "org_type": org_type, "tier": tier})).mappings().all()
    out = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["created_by"] = str(d["created_by"]) if d["created_by"] else None
        for k in ("created_at", "last_active_at", "pilot_ends_at"):
            d[k] = _iso(d[k])
        out.append(d)
    return out


async def get_workspace(db: AsyncSession, workspace_id: str) -> dict | None:
    r = (await db.execute(text("SELECT * FROM workspaces WHERE id = :id"), {"id": workspace_id})).mappings().first()
    if not r:
        return None
    ws = dict(r)
    ws["id"] = str(ws["id"])
    ws["created_by"] = str(ws["created_by"]) if ws["created_by"] else None
    for k in ("created_at", "last_active_at", "pilot_ends_at"):
        ws[k] = _iso(ws[k])
    users = (await db.execute(text("""
        SELECT id, email, name, role, is_admin, status, last_login_at, created_at
        FROM users WHERE workspace_id = :id ORDER BY created_at
    """), {"id": workspace_id})).mappings().all()
    ws["users"] = [{**dict(u), "id": str(u["id"]), "last_login_at": _iso(u["last_login_at"]),
                    "created_at": _iso(u["created_at"])} for u in users]
    return ws


async def create_workspace(db: AsyncSession, payload: dict, admin_id: str | None) -> dict:
    wid = (await db.execute(text("""
        INSERT INTO workspaces (name, org_type, tier, products, is_pilot, pilot_ends_at, internal_notes, created_by)
        VALUES (:name, :org_type, :tier, :products, :is_pilot, :pilot_ends_at, :notes, :created_by)
        RETURNING id
    """), {
        "name": payload["name"], "org_type": payload.get("org_type"),
        "tier": payload.get("tier", "free"), "products": payload.get("products", []),
        "is_pilot": payload.get("is_pilot", False), "pilot_ends_at": payload.get("pilot_ends_at"),
        "notes": payload.get("internal_notes"), "created_by": admin_id,
    })).scalar()

    await audit(db, admin_id=admin_id, action="workspace.created", target_type="workspace",
                target_id=wid, metadata={"name": payload["name"], "tier": payload.get("tier")})

    invite_info = None
    admin = payload.get("admin_user") or {}
    if admin.get("email"):
        full_name = " ".join(p for p in [admin.get("first_name"), admin.get("last_name")] if p) or None
        invite_info = await _invite(db, workspace_id=str(wid), email=admin["email"],
                                    role="admin", name=full_name, admin_id=admin_id,
                                    org=payload["name"])
    await db.commit()
    return {"workspace_id": str(wid), "invite": invite_info}


async def update_workspace(db: AsyncSession, workspace_id: str, fields: dict, admin_id: str | None) -> bool:
    cols, params = [], {"id": workspace_id}
    for c in ("name", "org_type", "tier", "is_pilot", "pilot_ends_at", "internal_notes", "products"):
        if c in fields and fields[c] is not None:
            cols.append(f"{c} = :{c}")
            params[c] = fields[c]
    if not cols:
        return False
    await db.execute(text(f"UPDATE workspaces SET {', '.join(cols)} WHERE id = :id"), params)
    await audit(db, admin_id=admin_id, action="workspace.updated", target_type="workspace",
                target_id=workspace_id, metadata={"fields": list(params.keys())})
    await db.commit()
    return True


async def set_status(db: AsyncSession, workspace_id: str, status: str, admin_id: str | None):
    await db.execute(text("UPDATE workspaces SET status = :s WHERE id = :id"),
                     {"s": status, "id": workspace_id})
    await audit(db, admin_id=admin_id, action=f"workspace.{status}", target_type="workspace",
                target_id=workspace_id, metadata={"status": status})
    await db.commit()


# ── Users / invites ─────────────────────────────────────────────────────────

async def _invite(db, *, workspace_id, email, role, name, admin_id, org) -> dict:
    """Create (or reuse) an invited user + a fresh invite token, and send the email.
    Internal — caller commits."""
    email = email.strip().lower()
    existing = (await db.execute(text("SELECT id, status FROM users WHERE email = :e"), {"e": email})).mappings().first()
    if existing:
        user_id = existing["id"]
    else:
        user_id = (await db.execute(text("""
            INSERT INTO users (workspace_id, email, name, role, status)
            VALUES (:wid, :email, :name, :role, 'invited') RETURNING id
        """), {"wid": workspace_id, "email": email, "name": name, "role": role})).scalar()

    token = new_token()
    invite_id = (await db.execute(text("""
        INSERT INTO invites (workspace_id, email, role, token, invited_by)
        VALUES (:wid, :email, :role, :token, :by) RETURNING id
    """), {"wid": workspace_id, "email": email, "role": role, "token": token, "by": admin_id})).scalar()

    await audit(db, admin_id=admin_id, action="invite.sent", target_type="invite",
                target_id=invite_id, metadata={"email": email, "workspace_id": workspace_id})

    link = _invite_link(token)
    inviter = "Your EIGG administrator"
    if admin_id:
        nm = (await db.execute(text("SELECT name FROM users WHERE id = :id"), {"id": admin_id})).scalar()
        inviter = nm or inviter
    send_result = await send_invite(to=email, inviter=inviter, org=org, link=link)
    return {"invite_id": str(invite_id), "user_id": str(user_id), "email": email,
            "link": link, "email_result": send_result}


async def invite_user(db: AsyncSession, *, workspace_id, email, role, admin_id) -> dict:
    org = (await db.execute(text("SELECT name FROM workspaces WHERE id = :id"), {"id": workspace_id})).scalar()
    if not org:
        raise ValueError("Workspace not found")
    info = await _invite(db, workspace_id=workspace_id, email=email, role=role, name=None,
                         admin_id=admin_id, org=org)
    await db.commit()
    return info


async def remove_user(db: AsyncSession, user_id: str, admin_id: str | None):
    email = (await db.execute(text("SELECT email FROM users WHERE id = :id"), {"id": user_id})).scalar()
    await db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
    await audit(db, admin_id=admin_id, action="user.removed", target_type="user",
                target_id=user_id, metadata={"email": email})
    await db.commit()


async def list_invites(db: AsyncSession) -> list[dict]:
    # Lazily mark past-due pending invites as expired.
    await db.execute(text("UPDATE invites SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()"))
    await db.commit()
    rows = (await db.execute(text("""
        SELECT i.id, i.email, i.role, i.status, i.created_at, i.expires_at, i.accepted_at,
               w.name AS workspace_name, w.id AS workspace_id
        FROM invites i JOIN workspaces w ON w.id = i.workspace_id
        ORDER BY i.created_at DESC
    """))).mappings().all()
    return [{**dict(r), "id": str(r["id"]), "workspace_id": str(r["workspace_id"]),
             "created_at": _iso(r["created_at"]), "expires_at": _iso(r["expires_at"]),
             "accepted_at": _iso(r["accepted_at"])} for r in rows]


async def resend_invite(db: AsyncSession, invite_id: str, admin_id: str | None) -> dict:
    inv = (await db.execute(text("""
        SELECT i.email, i.role, i.workspace_id, w.name AS org
        FROM invites i JOIN workspaces w ON w.id = i.workspace_id WHERE i.id = :id
    """), {"id": invite_id})).mappings().first()
    if not inv:
        raise ValueError("Invite not found")
    token = new_token()
    await db.execute(text("""
        UPDATE invites SET token = :token, status = 'pending', created_at = NOW(),
            expires_at = NOW() + INTERVAL '72 hours', accepted_at = NULL
        WHERE id = :id
    """), {"token": token, "id": invite_id})
    await audit(db, admin_id=admin_id, action="invite.resent", target_type="invite",
                target_id=invite_id, metadata={"email": inv["email"]})
    link = _invite_link(token)
    result = await send_invite(to=inv["email"], inviter="Your EIGG administrator", org=inv["org"], link=link)
    await db.commit()
    return {"link": link, "email_result": result}


# ── Invite acceptance + login ───────────────────────────────────────────────

async def get_invite(db: AsyncSession, token: str) -> dict:
    r = (await db.execute(text("""
        SELECT i.email, i.role, i.status, i.expires_at, w.name AS org, w.id AS workspace_id
        FROM invites i JOIN workspaces w ON w.id = i.workspace_id WHERE i.token = :t
    """), {"t": token})).mappings().first()
    if not r:
        return {"valid": False, "reason": "not_found"}
    expired = r["expires_at"] and r["expires_at"] < datetime.now(timezone.utc)
    if r["status"] == "accepted":
        return {"valid": False, "reason": "accepted", "email": r["email"], "org": r["org"]}
    if r["status"] == "expired" or expired:
        return {"valid": False, "reason": "expired", "email": r["email"], "org": r["org"]}
    return {"valid": True, "email": r["email"], "org": r["org"], "role": r["role"]}


async def accept_invite(db: AsyncSession, token: str, password: str, name: str | None) -> dict:
    info = await get_invite(db, token)
    if not info.get("valid"):
        raise ValueError(info.get("reason", "invalid"))

    inv = (await db.execute(text(
        "SELECT id, email, workspace_id FROM invites WHERE token = :t"), {"t": token})).mappings().first()

    active_before = (await db.execute(text(
        "SELECT COUNT(*) FROM users WHERE workspace_id = :w AND status = 'active'"
    ), {"w": inv["workspace_id"]})).scalar() or 0

    await db.execute(text("""
        UPDATE users SET password_hash = :ph, status = 'active', name = COALESCE(:name, name)
        WHERE email = :email
    """), {"ph": hash_password(password), "name": name, "email": inv["email"]})
    await db.execute(text(
        "UPDATE invites SET status = 'accepted', accepted_at = NOW() WHERE id = :id"), {"id": inv["id"]})
    await audit(db, admin_id=None, action="invite.accepted", target_type="invite",
                target_id=inv["id"], metadata={"email": inv["email"]})
    await db.commit()
    return {"email": inv["email"], "first_user": active_before == 0}


async def verify_user(db: AsyncSession, email: str, password: str) -> dict | None:
    r = (await db.execute(text("""
        SELECT id, email, name, password_hash, role, is_admin, status, workspace_id
        FROM users WHERE email = :e
    """), {"e": email.strip().lower()})).mappings().first()
    if not r or r["status"] != "active" or not verify_password(password, r["password_hash"]):
        return None
    await db.execute(text("UPDATE users SET last_login_at = NOW() WHERE id = :id"), {"id": r["id"]})
    await db.commit()
    return {"id": str(r["id"]), "email": r["email"], "name": r["name"],
            "role": r["role"], "is_admin": r["is_admin"],
            "workspace_id": str(r["workspace_id"]) if r["workspace_id"] else None}
