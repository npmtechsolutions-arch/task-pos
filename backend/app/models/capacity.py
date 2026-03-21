"""Capacity and availability models for workload planning."""

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AvailabilityStatus(str, PyEnum):
    """User availability status for a given day."""
    AVAILABLE = "available"
    LEAVE = "leave"          # Annual/sick leave
    BUSY = "busy"            # Fully committed
    PARTIAL = "partial"      # Partially available
    HOLIDAY = "holiday"      # Public holiday


class UserCapacity(Base):
    """Defines standard working hours for a user (used in utilization calculations)."""

    __tablename__ = "user_capacity"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    daily_hours: Mapped[float] = mapped_column(Float, default=8.0)
    weekly_hours: Mapped[float] = mapped_column(Float, default=40.0)
    # Fraction of time nominally allocated to meetings/overhead (subtracted from capacity)
    overhead_percentage: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<UserCapacity(user={self.user_id}, daily={self.daily_hours}h)>"


class UserAvailability(Base):
    """Day-level availability override — leave, holidays, partial availability."""

    __tablename__ = "user_availability"
    __table_args__ = (
        UniqueConstraint("user_id", "availability_date", name="uq_user_availability_date"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    availability_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[AvailabilityStatus] = mapped_column(
        default=AvailabilityStatus.AVAILABLE
    )
    # Available hours on this specific day (overrides daily_hours when set)
    available_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<UserAvailability(user={self.user_id}, date={self.availability_date}, status={self.status})>"
