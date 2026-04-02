"""Milestone model definitions."""

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User
    from app.models.tenant import Tenant


class MilestoneType(str, PyEnum):
    """Milestone type enumeration."""

    DATE_BASED = "date_based"
    DURATION_BASED = "duration_based"
    CONDITIONAL = "conditional"
    DECISION = "decision"


class MilestoneStatus(str, PyEnum):
    """Milestone status enumeration."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    AT_RISK = "at_risk"
    COMPLETED = "completed"
    MISSED = "missed"


class MilestoneRisk(str, PyEnum):
    """Milestone risk indicator."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Milestone(Base):
    """Milestone model for project key achievements."""

    __tablename__ = "milestones"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    phase_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("project_phases.id", ondelete="SET NULL"), index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    milestone_type: Mapped[MilestoneType] = mapped_column(default=MilestoneType.DATE_BASED)
    status: Mapped[MilestoneStatus] = mapped_column(default=MilestoneStatus.PENDING, index=True)

    # Timeline
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    days_from_start: Mapped[Optional[int]] = mapped_column()  # For duration-based milestones

    # Progress tracking
    completion_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    risk_indicator: Mapped[MilestoneRisk] = mapped_column(default=MilestoneRisk.LOW)

    # Owner / Approver
    owner_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    approver_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))

    # For conditional / decision milestones
    condition_description: Mapped[Optional[str]] = mapped_column(Text)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Flexible metadata
    criteria: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="milestones")
    project: Mapped["Project"] = relationship("Project", back_populates="milestones", lazy="selectin")
    owner: Mapped[Optional["User"]] = relationship("User", foreign_keys=[owner_id], lazy="selectin")
    approver: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approver_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<Milestone(id={self.id}, name={self.name}, status={self.status})>"
