"""Chat API — rooms, messages, notifications."""

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.chat import ChatRoom, ChatRoomMember, ChatMessage, MessageType
from app.models.notification import Notification, NotificationType

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    member_ids: List[str] = []


class RoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str]
    project_id: Optional[str]
    task_id: Optional[str]
    is_direct: bool
    created_by: str
    created_at: datetime
    unread_count: int = 0
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None


class MessageSend(BaseModel):
    content: str
    message_type: MessageType = MessageType.TEXT
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    reply_to_id: Optional[str] = None
    mentions: List[str] = []


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    room_id: str
    sender_id: str
    sender_name: str = ""
    sender_avatar: Optional[str] = None
    message_type: MessageType
    content: str
    file_url: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    reply_to_id: Optional[str]
    is_edited: bool
    is_deleted: bool
    mentions: Optional[list]
    created_at: datetime
    updated_at: datetime


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime
    link_url: Optional[str] = None

    @classmethod
    def from_orm_obj(cls, n: Notification) -> 'NotificationResponse':
        return cls(
            id=n.id, title=n.title, message=n.message,
            notification_type=n.notification_type.value if hasattr(n.notification_type, 'value') else str(n.notification_type),
            is_read=n.is_read,
            created_at=n.created_at,
            link_url=getattr(n, 'action_url', None),
        )


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_room_or_404(room_id: str, user_id: str, db: AsyncSession) -> ChatRoom:
    result = await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Chat room not found")
    # Check membership
    mem = await db.execute(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id == user_id,
        )
    )
    if not mem.scalar_one_or_none():
        raise HTTPException(403, "Not a member of this room")
    return room


def _msg_to_resp(msg: ChatMessage, user_map: dict) -> MessageResponse:
    u = user_map.get(msg.sender_id, {})
    return MessageResponse(
        id=msg.id,
        room_id=msg.room_id,
        sender_id=msg.sender_id,
        sender_name=u.get("name", ""),
        sender_avatar=u.get("avatar"),
        message_type=msg.message_type,
        content=msg.content if not msg.is_deleted else "[Message deleted]",
        file_url=msg.file_url,
        file_name=msg.file_name,
        file_size=msg.file_size,
        reply_to_id=msg.reply_to_id,
        is_edited=msg.is_edited,
        is_deleted=msg.is_deleted,
        mentions=msg.mentions,
        created_at=msg.created_at,
        updated_at=msg.updated_at,
    )


from app.services.notification import NotificationService
from app.schemas.notification import NotificationCreate

async def _create_notification(
    db: AsyncSession, user_id: str, title: str, message: str,
    ntype: str = NotificationType.TASK_MENTIONED, link_url: Optional[str] = None
):
    """Create an in-app notification using the global real-time service."""
    ns = NotificationService(db)
    await ns.create(
        NotificationCreate(
            user_id=user_id,
            notification_type=ntype,
            title=title,
            message=message,
            action_url=link_url,
        )
    )


# ── Room Endpoints ─────────────────────────────────────────────────────────────

@router.get("/rooms", response_model=List[RoomResponse])
async def list_rooms(
    project_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all chat rooms the user is a member of."""
    # Get rooms via membership
    mem_result = await db.execute(
        select(ChatRoomMember.room_id).where(ChatRoomMember.user_id == current_user.id)
    )
    room_ids = [r[0] for r in mem_result.fetchall()]

    stmt = select(ChatRoom).where(ChatRoom.id.in_(room_ids))
    if project_id:
        stmt = stmt.where(ChatRoom.project_id == project_id)
    stmt = stmt.order_by(ChatRoom.created_at.desc())

    result = await db.execute(stmt)
    rooms = result.scalars().all()

    # Unread counts
    out = []
    for r in rooms:
        mem = await db.execute(
            select(ChatRoomMember).where(
                ChatRoomMember.room_id == r.id,
                ChatRoomMember.user_id == current_user.id
            )
        )
        member = mem.scalar_one_or_none()
        last_read = member.last_read_at if member else None

        unread_q = select(func.count(ChatMessage.id)).where(
            ChatMessage.room_id == r.id,
            ChatMessage.is_deleted == False,
        )
        if last_read:
            unread_q = unread_q.where(ChatMessage.created_at > last_read)
        unread_count = (await db.execute(unread_q)).scalar() or 0

        # Last message
        last_msg_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.room_id == r.id, ChatMessage.is_deleted == False)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        out.append(RoomResponse(
            id=r.id, name=r.name, description=r.description,
            project_id=r.project_id, task_id=r.task_id,
            is_direct=r.is_direct, created_by=r.created_by, created_at=r.created_at,
            unread_count=unread_count,
            last_message=last_msg.content if last_msg and not last_msg.is_deleted else None,
            last_message_at=last_msg.created_at if last_msg else None,
        ))

    return out


@router.post("/rooms", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    data: RoomCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new chat room (project or general)."""
    room = ChatRoom(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        name=data.name,
        description=data.description,
        project_id=data.project_id,
        task_id=data.task_id,
        created_by=current_user.id,
    )
    db.add(room)

    # Add creator as member
    member_ids = list(set([current_user.id] + (data.member_ids or [])))
    for uid in member_ids:
        db.add(ChatRoomMember(
            id=str(uuid.uuid4()),
            room_id=room.id,
            user_id=uid,
        ))

    await db.commit()
    await db.refresh(room)
    return RoomResponse(
        id=room.id, name=room.name, description=room.description,
        project_id=room.project_id, task_id=room.task_id,
        is_direct=room.is_direct, created_by=room.created_by, created_at=room.created_at,
        unread_count=0,
    )


@router.get("/rooms/{room_id}", response_model=RoomResponse)
async def get_room(
    room_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await _get_room_or_404(room_id, current_user.id, db)
    return RoomResponse(
        id=room.id, name=room.name, description=room.description,
        project_id=room.project_id, task_id=room.task_id,
        is_direct=room.is_direct, created_by=room.created_by, created_at=room.created_at,
        unread_count=0,
    )


@router.post("/rooms/{room_id}/members")
async def add_room_member(
    room_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await _get_room_or_404(room_id, current_user.id, db)
    existing = await db.execute(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == room_id, ChatRoomMember.user_id == user_id
        )
    )
    if not existing.scalar_one_or_none():
        db.add(ChatRoomMember(id=str(uuid.uuid4()), room_id=room_id, user_id=user_id))
        await db.commit()
    return {"status": "added"}


# ── Message Endpoints ──────────────────────────────────────────────────────────

@router.get("/rooms/{room_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    room_id: str,
    limit: int = Query(50, ge=1, le=200),
    before_id: Optional[str] = Query(None),
    mark_read: bool = Query(False, description="If true, updates last_read_at (avoid on polling)"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get messages in a room (newest first, paginated)."""
    await _get_room_or_404(room_id, current_user.id, db)

    stmt = select(ChatMessage).where(
        ChatMessage.room_id == room_id,
    ).order_by(ChatMessage.created_at.asc()).limit(limit)

    if before_id:
        ref = await db.execute(select(ChatMessage).where(ChatMessage.id == before_id))
        ref_msg = ref.scalar_one_or_none()
        if ref_msg:
            stmt = stmt.where(ChatMessage.created_at < ref_msg.created_at)

    result = await db.execute(stmt)
    messages = result.scalars().all()

    # Fetch sender info
    sender_ids = list({m.sender_id for m in messages})
    from app.models.user import User
    users_result = await db.execute(select(User).where(User.id.in_(sender_ids)))
    users = {u.id: {"name": f"{u.first_name or ''} {u.last_name or ''}".strip(), "avatar": None} for u in users_result.scalars().all()}

    if mark_read:
        mem_result = await db.execute(
            select(ChatRoomMember).where(
                ChatRoomMember.room_id == room_id,
                ChatRoomMember.user_id == current_user.id,
            )
        )
        member = mem_result.scalar_one_or_none()
        if member:
            member.last_read_at = datetime.utcnow()
            await db.commit()

    return [_msg_to_resp(m, users) for m in messages]


@router.post("/rooms/{room_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_room_read(
    room_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark the current user's position in this room as read (call when opening a room)."""
    await _get_room_or_404(room_id, current_user.id, db)
    mem_result = await db.execute(
        select(ChatRoomMember).where(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.user_id == current_user.id,
        )
    )
    member = mem_result.scalar_one_or_none()
    if member:
        member.last_read_at = datetime.utcnow()
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/rooms/{room_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    room_id: str,
    data: MessageSend,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to a room."""
    await _get_room_or_404(room_id, current_user.id, db)

    msg = ChatMessage(
        id=str(uuid.uuid4()),
        room_id=room_id,
        sender_id=current_user.id,
        message_type=data.message_type,
        content=data.content,
        file_url=data.file_url,
        file_name=data.file_name,
        file_size=data.file_size,
        reply_to_id=data.reply_to_id,
        mentions=data.mentions or [],
    )
    db.add(msg)

    # Create notifications for mentioned users
    for uid in (data.mentions or []):
        if uid != current_user.id:
            sender_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
            await _create_notification(
                db, uid,
                title=f"@{sender_name} mentioned you",
                message=data.content[:100],
                ntype=NotificationType.TASK_MENTIONED,
                link_url=f"/chat/rooms/{room_id}",
            )

    await db.commit()
    await db.refresh(msg)

    sender_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
    msg_resp = MessageResponse(
        id=msg.id, room_id=msg.room_id, sender_id=msg.sender_id,
        sender_name=sender_name, sender_avatar=None,
        message_type=msg.message_type, content=msg.content,
        file_url=msg.file_url, file_name=msg.file_name, file_size=msg.file_size,
        reply_to_id=msg.reply_to_id, is_edited=msg.is_edited, is_deleted=msg.is_deleted,
        mentions=msg.mentions, created_at=msg.created_at, updated_at=msg.updated_at,
    )

    try:
        from app.websocket.manager import manager

        mem_rows = await db.execute(
            select(ChatRoomMember.user_id).where(ChatRoomMember.room_id == room_id)
        )
        user_ids = [r[0] for r in mem_rows.fetchall()]
        await manager.broadcast_to_users(
            user_ids,
            {
                "type": "chat_message",
                "room_id": room_id,
                "message": msg_resp.model_dump(mode="json"),
            },
        )
    except Exception:
        pass

    return msg_resp


@router.delete("/messages/{message_id}", status_code=200)
async def delete_message(
    message_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "Cannot delete others' messages")
    msg.is_deleted = True
    await db.commit()
    return {"status": "deleted"}


# ── Notifications ──────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(30, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
    ).order_by(Notification.created_at.desc()).limit(limit)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return [NotificationResponse.from_orm_obj(n) for n in items]


@router.get("/notifications/unread-count")
async def notification_unread_count(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )).scalar() or 0
    return {"count": count}


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    n = result.scalar_one_or_none()
    if n and n.user_id == current_user.id:
        n.is_read = True
        await db.commit()
    return {"status": "ok"}


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import update
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}
