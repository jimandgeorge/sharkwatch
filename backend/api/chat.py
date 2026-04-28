import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..core.database import get_db
from ..services import chat_engine

router = APIRouter(prefix="/investigations", tags=["chat"])


class MessageRequest(BaseModel):
    question: str


@router.get("/{investigation_id}/messages")
async def get_messages(investigation_id: str, db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        text("""
            SELECT id::text, role, content, sources, created_at
            FROM investigation_messages
            WHERE investigation_id = :id
            ORDER BY created_at ASC
        """),
        {"id": investigation_id},
    )
    messages = []
    for r in rows.mappings():
        msg = dict(r)
        if hasattr(msg.get("created_at"), "isoformat"):
            msg["created_at"] = msg["created_at"].isoformat()
        messages.append(msg)
    return {"messages": messages}


@router.post("/{investigation_id}/messages")
async def post_message(
    investigation_id: str,
    body: MessageRequest,
    db: AsyncSession = Depends(get_db),
):
    inv_row = await db.execute(
        text("SELECT * FROM investigations WHERE id = :id"),
        {"id": investigation_id},
    )
    inv = inv_row.mappings().first()
    if not inv:
        raise HTTPException(404, "Investigation not found")
    inv = dict(inv)

    txn_row = await db.execute(
        text("SELECT * FROM transactions WHERE id = :id"),
        {"id": inv["transaction_id"]},
    )
    txn = dict(txn_row.mappings().first() or {})

    history_rows = await db.execute(
        text("""
            SELECT role, content FROM investigation_messages
            WHERE investigation_id = :id ORDER BY created_at ASC
        """),
        {"id": investigation_id},
    )
    history = [dict(r) for r in history_rows.mappings()]

    await db.execute(
        text("""
            INSERT INTO investigation_messages (investigation_id, role, content, sources)
            VALUES (:inv_id, 'analyst', :content, '[]')
        """),
        {"inv_id": investigation_id, "content": body.question},
    )
    await db.commit()

    async def event_stream():
        full_text = ""
        try:
            async for token in chat_engine.answer_stream(
                db=db,
                question=body.question,
                history=history,
                inv=inv,
                txn=txn,
            ):
                full_text += token
                yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return

        stored = await db.execute(
            text("""
                INSERT INTO investigation_messages (investigation_id, role, content, sources)
                VALUES (:inv_id, 'assistant', :content, '[]')
                RETURNING id::text, created_at
            """),
            {"inv_id": investigation_id, "content": full_text},
        )
        row = stored.fetchone()
        await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'id': row[0], 'sources': [], 'created_at': row[1].isoformat()})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
