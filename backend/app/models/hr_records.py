"""HR Lifecycle and Organizational Records."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ApprovalStatus(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class InternStatus(str, PyEnum):
    ACTIVE = "active"
    CONVERTED = "converted"
    COMPLETED = "completed"


class Candidate(Base):
    """Potential employee proposed by HR, waiting for Super Admin approval."""

    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    role: Mapped[str] = mapped_column(String(100), nullable=False)  # UserRole mapping
    resume_url: Mapped[Optional[str]] = mapped_column(Text)
    
    status: Mapped[ApprovalStatus] = mapped_column(default=ApprovalStatus.PENDING)
    
    # Track who did what
    created_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    approved_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Intern(Base):
    """Internship tracking record."""

    __tablename__ = "interns"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    college: Mapped[Optional[str]] = mapped_column(String(255))
    duration_months: Mapped[int] = mapped_column(Integer, default=3)
    
    # Manager tracking them
    mentor_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    status: Mapped[InternStatus] = mapped_column(default=InternStatus.ACTIVE)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class LeaveRequest(Base):
    """Employee Leave and Vacation Records."""

    __tablename__ = "leaves"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    from_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    to_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    
    status: Mapped[ApprovalStatus] = mapped_column(default=ApprovalStatus.PENDING)
    
    approved_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
