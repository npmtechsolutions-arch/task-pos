"""Time tracking logic and timesheet models."""

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
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TimesheetStatus(str, PyEnum):
    """Timesheet approval status."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class Timesheet(Base):
    """Weekly timesheet aggregation."""

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

    status: Mapped[TimesheetStatus] = mapped_column(default=TimesheetStatus.DRAFT)
    
    total_hours: Mapped[float] = mapped_column(Float, default=0.0)
    billable_hours: Mapped[float] = mapped_column(Float, default=0.0)

    # Approvals
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
        "TimesheetEntry", back_populates="timesheet", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Timesheet(user={self.user_id}, period={self.period_start} to {self.period_end})>"


class TimesheetEntry(Base):
    """Daily individual timesheet entry (aggregates TimeEntry records or serves as manual entry)."""

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

    task_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("tasks.id"))
    project_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("projects.id"))

    date_logged: Mapped[date] = mapped_column(Date, nullable=False)
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    is_billable: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<TimesheetEntry(task={self.task_id}, hours={self.hours}, date={self.date_logged})>"
