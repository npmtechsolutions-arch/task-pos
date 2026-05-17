"""HR Lifecycle and Organizational Records."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, Integer, Float, Enum
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
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    role: Mapped[str] = mapped_column(String(100), nullable=False)  # UserRole mapping
    job_title: Mapped[Optional[str]] = mapped_column(String(150))
    join_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resume_url: Mapped[Optional[str]] = mapped_column(Text)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    
    # Generated credentials shown after approval
    generated_email: Mapped[Optional[str]] = mapped_column(String(255))
    generated_password: Mapped[Optional[str]] = mapped_column(String(100))

    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, native_enum=True, name="approval_status_enum"),
        default=ApprovalStatus.PENDING
    )
    
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
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    college: Mapped[Optional[str]] = mapped_column(String(255))
    duration_months: Mapped[int] = mapped_column(Integer, default=3)
    stipend: Mapped[Optional[str]] = mapped_column(String(50))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)

    # Manager tracking them
    mentor_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    # Approval flow — stored as VARCHAR to avoid enum DDL issues
    approval_status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )
    status: Mapped[InternStatus] = mapped_column(
        Enum(InternStatus, native_enum=True, name="intern_status_enum"),
        default=InternStatus.ACTIVE
    )
    generated_email: Mapped[Optional[str]] = mapped_column(String(255))
    generated_password: Mapped[Optional[str]] = mapped_column(String(100))
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class TerminationRequest(Base):
    """HR-initiated termination request requiring Super Admin approval."""

    __tablename__ = "termination_requests"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # The employee being terminated
    target_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason: Mapped[Optional[str]] = mapped_column(Text)
    last_working_day: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)

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


class LeaveRequest(Base):
    """Employee Leave and Vacation Records."""

    __tablename__ = "leaves"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
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
