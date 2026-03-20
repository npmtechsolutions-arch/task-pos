"""Communication models: CommentReaction, EmailLog."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CommentReaction(Base):
    """Emoji reaction on a task comment.

    Using a dedicated table instead of JSONB to avoid race conditions when
    multiple users react concurrently (DB-level upsert handles concurrency).
    """

    __tablename__ = "comment_reactions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    comment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_comments.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<CommentReaction(comment={self.comment_id}, user={self.user_id}, emoji={self.emoji})>"


class EmailStatus(str, PyEnum):
    """Email delivery status."""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"


class EmailLog(Base):
    """Track all outgoing emails with retry support.

    Retention policy: keep for 90 days, archive for 7 years.
    """

    __tablename__ = "email_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    to_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)

    # What triggered this email
    notification_type: Mapped[Optional[str]] = mapped_column(String(100))
    related_user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )

    status: Mapped[EmailStatus] = mapped_column(
        default=EmailStatus.PENDING, index=True
    )
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self) -> str:
        return f"<EmailLog(to={self.to_email}, status={self.status}, subject={self.subject[:30]})>"
