"""Timesheet models — production-ready with full workflow support."""

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum
from typing import List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.user import User
    from app.models.task import Task
    from app.models.project import Project

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TimesheetStatus(str, PyEnum):
    """Timesheet approval lifecycle."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class ActivityType(str, PyEnum):
    """Type of work activity."""
    DEVELOPMENT = "development"
    MEETING = "meeting"
    RESEARCH = "research"
    REVIEW = "review"
    TESTING = "testing"
    DESIGN = "design"
    DOCUMENTATION = "documentation"
    OTHER = "other"


class Timesheet(Base):
    """Weekly or custom-period timesheet aggregation per user."""

    __tablename__ = "timesheets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[TimesheetStatus] = mapped_column(
        Enum(TimesheetStatus, name="timesheet_status_enum", native_enum=False),
        default=TimesheetStatus.DRAFT,
        index=True,
    )

    total_hours: Mapped[float] = mapped_column(Float, default=0.0)
    billable_hours: Mapped[float] = mapped_column(Float, default=0.0)

    # Approval workflow
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    approved_by_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="timesheets")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")
    approver: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_id], lazy="selectin")
    entries: Mapped[List["TimesheetEntry"]] = relationship(
        "TimesheetEntry", back_populates="timesheet",
        cascade="all, delete-orphan", lazy="selectin",
        order_by="TimesheetEntry.date_logged",
    )

    def recalculate_hours(self) -> None:
        """Recompute total/billable hours from entries."""
        self.total_hours = sum(e.hours for e in self.entries)
        self.billable_hours = sum(e.hours for e in self.entries if e.is_billable)

    def __repr__(self) -> str:
        return f"<Timesheet(user={self.user_id}, {self.period_start}→{self.period_end}, {self.status})>"


class TimesheetEntry(Base):
    """Individual time log entry within a timesheet."""

    __tablename__ = "timesheet_entries"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timesheet_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("timesheets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    timesheet: Mapped["Timesheet"] = relationship("Timesheet", back_populates="entries")

    task_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("tasks.id", ondelete="SET NULL"))
    project_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("projects.id", ondelete="SET NULL"))

    date_logged: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Time range (optional for manual entries)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    hours: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1000))
    activity_type: Mapped[ActivityType] = mapped_column(
        Enum(ActivityType, name="activity_type_enum", native_enum=False),
        default=ActivityType.DEVELOPMENT,
    )
    is_billable: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    task: Mapped[Optional["Task"]] = relationship("Task", foreign_keys=[task_id], lazy="selectin")
    project: Mapped[Optional["Project"]] = relationship("Project", foreign_keys=[project_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<TimesheetEntry(date={self.date_logged}, hours={self.hours}, task={self.task_id})>"
