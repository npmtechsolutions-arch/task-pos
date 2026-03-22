"""Calendar events DB model."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CalendarEventType(str, PyEnum):
    TASK = "task"
    MILESTONE = "milestone"
    MEETING = "meeting"
    DEADLINE = "deadline"
    OTHER = "other"


class CalendarEvent(Base):
    """Persisted calendar event. Also serves as aggregation point for task/milestone events."""

    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    start_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, index=True)
    event_type: Mapped[CalendarEventType] = mapped_column(
        default=CalendarEventType.OTHER, index=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Reference to source entity (task_id or milestone_id) — null for manual events
    source_task_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True
    )
    source_milestone_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("milestones.id", ondelete="CASCADE"), nullable=True
    )
    color: Mapped[str] = mapped_column(String(7), default="#6366F1")
    all_day: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
