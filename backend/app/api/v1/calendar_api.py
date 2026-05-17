"""Calendar API — DB-backed events + task/milestone overlays."""

import uuid
from datetime import datetime, date, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.calendar import CalendarEvent, CalendarEventType
from app.models.task import Task
from app.models.milestone import Milestone, MilestoneStatus

router = APIRouter()


def _strip_tz(dt: datetime | None) -> datetime | None:
    """Convert any timezone-aware datetime to a naive UTC datetime.

    PostgreSQL TIMESTAMP WITHOUT TIME ZONE columns only accept naive datetimes.
    Pydantic parses ISO-8601 strings with +00:00/Z as aware datetimes, causing
    SQLAlchemy/asyncpg DataError: 'can\'t subtract offset-naive and offset-aware datetimes'.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        # Convert to UTC then drop tzinfo
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


# ── Schemas ───────────────────────────────────────────────────────────────────
class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    event_type: CalendarEventType = CalendarEventType.OTHER
    project_id: Optional[str] = None
    color: str = "#6366F1"
    all_day: bool = True


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    event_type: Optional[CalendarEventType] = None
    color: Optional[str] = None
    all_day: Optional[bool] = None


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    description: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    event_type: CalendarEventType
    project_id: Optional[str] = None
    color: str
    all_day: bool
    created_by: str
    source_task_id: Optional[str] = None
    source_milestone_id: Optional[str] = None
    created_at: datetime


# ── Unified event feed ────────────────────────────────────────────────────────
@router.get("/events")
async def list_events(
    start: Optional[str] = Query(None, description="ISO date filter start (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="ISO date filter end (YYYY-MM-DD)"),
    project_id: Optional[str] = Query(None),
    include_tasks: bool = Query(True),
    include_milestones: bool = Query(True),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all calendar events merged from:
      1. Manual CalendarEvents stored in DB
      2. Tasks with due_date (if include_tasks=True)
      3. Milestones with due_date (if include_milestones=True)
    """
    now = datetime.utcnow()
    start_dt = datetime.fromisoformat(start) if start else None
    end_dt = datetime.fromisoformat(end) if end else None

    events = []

    # 1. Manual events
    q = select(CalendarEvent)
    if start_dt:
        q = q.where(CalendarEvent.start_date >= start_dt)
    if end_dt:
        q = q.where(CalendarEvent.start_date <= end_dt)
    if project_id:
        q = q.where(CalendarEvent.project_id == project_id)
    q = q.order_by(CalendarEvent.start_date)
    result = await db.execute(q)
    for ev in result.scalars().all():
        events.append({
            "id": ev.id,
            "title": ev.title,
            "description": ev.description,
            "date": ev.start_date.strftime("%Y-%m-%d"),
            "start_date": ev.start_date.isoformat(),
            "end_date": ev.end_date.isoformat() if ev.end_date else None,
            "event_type": str(ev.event_type).split(".")[-1],
            "color": ev.color,
            "all_day": ev.all_day,
            "source": "manual",
            "source_id": ev.id,
            "project_id": ev.project_id,
        })

    # 2. Tasks with due dates
    if include_tasks:
        tq = select(Task).where(Task.due_date.isnot(None))
        if start_dt:
            tq = tq.where(Task.due_date >= start_dt)
        if end_dt:
            tq = tq.where(Task.due_date <= end_dt)
        if project_id:
            tq = tq.where(Task.project_id == project_id)
        tresult = await db.execute(tq)
        for t in tresult.scalars().all():
            is_overdue = t.due_date < now and t.status not in ("done", "cancelled")
            events.append({
                "id": f"task-{t.id}",
                "title": t.title,
                "description": t.description,
                "date": t.due_date.strftime("%Y-%m-%d"),
                "start_date": t.due_date.isoformat(),
                "end_date": None,
                "event_type": "overdue" if is_overdue else "task",
                "color": "#EF4444" if is_overdue else "#3B82F6",
                "all_day": True,
                "source": "task",
                "source_id": t.id,
                "project_id": t.project_id,
                "status": t.status,
                "is_overdue": is_overdue,
            })

    # 3. Milestones with due dates
    if include_milestones:
        mq = select(Milestone).where(Milestone.due_date.isnot(None))
        if start_dt:
            mq = mq.where(Milestone.due_date >= start_dt)
        if end_dt:
            mq = mq.where(Milestone.due_date <= end_dt)
        if project_id:
            mq = mq.where(Milestone.project_id == project_id)
        mresult = await db.execute(mq)
        for m in mresult.scalars().all():
            events.append({
                "id": f"ms-{m.id}",
                "title": m.name,
                "description": m.description,
                "date": m.due_date.strftime("%Y-%m-%d"),
                "start_date": m.due_date.isoformat(),
                "end_date": None,
                "event_type": "milestone",
                "color": "#10B981",
                "all_day": True,
                "source": "milestone",
                "source_id": m.id,
                "project_id": m.project_id,
            })

    # Sort merged list by date
    events.sort(key=lambda e: e["start_date"])
    return events


# ── Manual event CRUD ─────────────────────────────────────────────────────────
@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    data: EventCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ev = CalendarEvent(
        id=str(uuid.uuid4()),
        title=data.title,
        description=data.description,
        start_date=_strip_tz(data.start_date),
        end_date=_strip_tz(data.end_date),
        event_type=data.event_type,
        project_id=data.project_id,
        color=data.color,
        all_day=data.all_day,
        created_by=current_user.id,
    )
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return EventResponse.model_validate(ev)


@router.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    data: EventUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(404, "Event not found")
    if ev.created_by != current_user.id:
        from app.models.user import UserRole
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise HTTPException(403, "Can only edit your own events")
    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        # Strip timezone from any datetime fields before saving
        if isinstance(val, datetime):
            val = _strip_tz(val)
        setattr(ev, key, val)
    await db.commit()
    await db.refresh(ev)
    return EventResponse.model_validate(ev)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(404, "Event not found")
    if ev.created_by != current_user.id:
        from app.models.user import UserRole
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise HTTPException(403, "Can only delete your own events")
    await db.delete(ev)
    await db.commit()
