"""Notification model definitions."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NotificationType(str, PyEnum):
    """Notification type enumeration."""

    # Task notifications
    TASK_ASSIGNED = "task_assigned"
    TASK_UNASSIGNED = "task_unassigned"
    TASK_STATUS_CHANGED = "task_status_changed"
    TASK_COMMENTED = "task_commented"
    TASK_MENTIONED = "task_mentioned"
    TASK_DUE_SOON = "task_due_soon"
    TASK_OVERDUE = "task_overdue"

    # Project notifications
    PROJECT_INVITATION = "project_invitation"
    PROJECT_MEMBER_ADDED = "project_member_added"
    PROJECT_MEMBER_REMOVED = "project_member_removed"
    PROJECT_STATUS_CHANGED = "project_status_changed"

    # Time tracking
    TIME_ENTRY_APPROVED = "time_entry_approved"
    TIME_ENTRY_REJECTED = "time_entry_rejected"

    # System
    SYSTEM_ANNOUNCEMENT = "system_announcement"
    SYSTEM_MAINTENANCE = "system_maintenance"

    # User & General HR
    USER_HIRED = "user_hired"
    USER_FIRED = "user_fired"
    MESSAGE = "message"

    # Candidates & Leaves
    CANDIDATE_SUBMITTED = "candidate_submitted"
    CANDIDATE_APPROVED = "candidate_approved"
    CANDIDATE_REJECTED = "candidate_rejected"
    LEAVE_REQUESTED = "leave_requested"
    LEAVE_APPROVED = "leave_approved"
    LEAVE_REJECTED = "leave_rejected"

    # General system / HR
    SYSTEM_ALERT = "system_alert"
    HR_ACTION = "hr_action"

class NotificationChannel(str, PyEnum):
    """Notification channel enumeration."""

    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"
    SMS = "sms"


class Notification(Base):
    """Notification model."""

    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("user_id", "dedupe_key", name="uq_notifications_user_dedupe_key"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    user: Mapped["User"] = relationship("User", lazy="selectin")

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    notification_type: Mapped[NotificationType] = mapped_column(nullable=False)

    # Title and message
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Related entities
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("projects.id"),
    )
    task_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tasks.id"),
    )
    comment_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("task_comments.id"),
    )

    # Additional data
    extra_data: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    # Idempotency / de-dupe for at-least-once delivery paths
    dedupe_key: Mapped[Optional[str]] = mapped_column(String(255), index=True)

    # Channels delivered
    channels: Mapped[list] = mapped_column(
        JSONB,
        default=lambda: [NotificationChannel.IN_APP.value],
    )

    # Status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Action URL (for deep linking)
    action_url: Mapped[Optional[str]] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, user={self.user_id}, type={self.notification_type})>"


class NotificationPreference(Base):
    """User notification preferences."""

    __tablename__ = "notification_preferences"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
    )

    # Global preferences by channel
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Preferences by notification type
    type_preferences: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            NotificationType.TASK_ASSIGNED.value: {
                NotificationChannel.IN_APP.value: True,
                NotificationChannel.EMAIL.value: True,
                NotificationChannel.PUSH.value: True,
            },
            NotificationType.TASK_COMMENTED.value: {
                NotificationChannel.IN_APP.value: True,
                NotificationChannel.EMAIL.value: True,
                NotificationChannel.PUSH.value: False,
            },
            # ... other types
        },
    )

    # Quiet hours
    quiet_hours_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    quiet_hours_start: Mapped[Optional[str]] = mapped_column(String(5))  # HH:MM
    quiet_hours_end: Mapped[Optional[str]] = mapped_column(String(5))  # HH:MM
    quiet_hours_timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def __repr__(self) -> str:
        return f"<NotificationPreference(user={self.user_id})>"
