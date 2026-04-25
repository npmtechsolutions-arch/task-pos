"""Support System model definitions."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.tenant import Tenant


class TicketStatus(str, PyEnum):
    """Ticket status enumeration."""
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    WAITING_FOR_USER = "WAITING_FOR_USER"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class TicketPriority(str, PyEnum):
    """Ticket priority enumeration."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TicketCategory(str, PyEnum):
    """Ticket category enumeration."""
    BUG = "BUG"
    FEATURE = "FEATURE"
    PERFORMANCE = "PERFORMANCE"
    ACCOUNT = "ACCOUNT"
    OTHER = "OTHER"


class Ticket(Base):
    """Support Ticket model."""

    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    ticket_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant: Mapped["Tenant"] = relationship("Tenant")

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, native_enum=False, name="ticket_status_enum"),
        default=TicketStatus.OPEN,
        index=True
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, native_enum=False, name="ticket_priority_enum"),
        default=TicketPriority.MEDIUM,
        index=True
    )
    category: Mapped[TicketCategory] = mapped_column(
        Enum(TicketCategory, native_enum=False, name="ticket_category_enum"),
        default=TicketCategory.OTHER,
        index=True
    )
    
    created_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    
    assigned_to_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    assigned_to: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_to_id], lazy="selectin")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    messages: Mapped[List["TicketMessage"]] = relationship(
        "TicketMessage",
        back_populates="ticket",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="TicketMessage.timestamp",
    )

    def __repr__(self) -> str:
        return f"<Ticket(id={self.ticket_id}, title={self.title[:30]}, status={self.status})>"


class TicketMessage(Base):
    """Ticket message for communication inside a ticket."""

    __tablename__ = "ticket_messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    ticket_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="messages")
    
    sender_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id], lazy="selectin")
    
    message: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[dict] = mapped_column(JSONB, default=list)
    
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self) -> str:
        return f"<TicketMessage(ticket_id={self.ticket_id}, sender_id={self.sender_id})>"
