"""Tenant model for multi-tenancy architecture."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.project import Project
    from app.models.task import Task
    from app.models.org_team import OrgTeam
    from app.models.milestone import Milestone
    from app.models.timesheet import Timesheet


class TenantStatus(str, PyEnum):
    """Tenant status enumeration."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    EXPIRED = "expired"


class Tenant(Base):
    """Tenant model for organization/company accounts."""

    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    
    # Billing/Plan Info
    plan: Mapped[str] = mapped_column(String(50), default="free")
    status: Mapped[TenantStatus] = mapped_column(default=TenantStatus.ACTIVE)
    
    # Settings & Branding
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    branding: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User", back_populates="tenant", cascade="all, delete-orphan"
    )
    projects: Mapped[List["Project"]] = relationship(
        "Project", back_populates="tenant", cascade="all, delete-orphan"
    )
    tasks: Mapped[List["Task"]] = relationship(
        "Task", back_populates="tenant", cascade="all, delete-orphan"
    )
    teams: Mapped[List["OrgTeam"]] = relationship(
        "OrgTeam", back_populates="tenant", cascade="all, delete-orphan"
    )
    milestones: Mapped[List["Milestone"]] = relationship(
        "Milestone", back_populates="tenant", cascade="all, delete-orphan"
    )
    timesheets: Mapped[List["Timesheet"]] = relationship(
        "Timesheet", back_populates="tenant", cascade="all, delete-orphan"
    )


    def __repr__(self) -> str:
        return f"<Tenant {self.name} ({self.id})>"
