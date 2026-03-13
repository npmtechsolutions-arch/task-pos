"""User model definition."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import ProjectMember
    from app.models.task import Task, TaskComment, TimeEntry


class UserRole(str, PyEnum):
    """User role enumeration."""

    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    MEMBER = "member"
    VIEWER = "viewer"


class UserStatus(str, PyEnum):
    """User status enumeration."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class User(Base):
    """User model for authentication and profile."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Profile
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    language: Mapped[str] = mapped_column(String(10), default="en")
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    bio: Mapped[Optional[str]] = mapped_column(Text)

    # Status
    status: Mapped[UserStatus] = mapped_column(
        default=UserStatus.PENDING,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Role
    role: Mapped[UserRole] = mapped_column(default=UserRole.MEMBER)

    # MFA
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_secret: Mapped[Optional[str]] = mapped_column(String(255))

    # Settings
    preferences: Mapped[dict] = mapped_column(JSONB, default=dict)
    notification_settings: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "email": True,
            "push": True,
            "in_app": True,
            "mentions": True,
            "task_assignments": True,
            "project_updates": True,
        },
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    project_memberships: Mapped[List["ProjectMember"]] = relationship(
        "ProjectMember",
        foreign_keys="ProjectMember.user_id",
        back_populates="user",
        lazy="selectin",
    )
    assigned_tasks: Mapped[List["Task"]] = relationship(
        "Task",
        foreign_keys="Task.assignee_id",
        back_populates="assignee",
        lazy="selectin",
    )
    reported_tasks: Mapped[List["Task"]] = relationship(
        "Task",
        foreign_keys="Task.reporter_id",
        back_populates="reporter",
        lazy="selectin",
    )
    comments: Mapped[List["TaskComment"]] = relationship(
        "TaskComment",
        back_populates="author",
        lazy="selectin",
    )
    time_entries: Mapped[List["TimeEntry"]] = relationship(
        "TimeEntry",
        back_populates="user",
        lazy="selectin",
    )

    @property
    def full_name(self) -> str:
        """Get user's full name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or self.last_name or self.email.split("@")[0]

    @property
    def initials(self) -> str:
        """Get user's initials."""
        if self.first_name and self.last_name:
            return f"{self.first_name[0]}{self.last_name[0]}".upper()
        return self.email[0:2].upper()

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"
