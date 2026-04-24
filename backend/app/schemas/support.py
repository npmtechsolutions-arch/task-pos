"""Support System schemas."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.support import TicketCategory, TicketPriority, TicketStatus
from app.schemas.user import UserResponse


class TicketMessageBase(BaseModel):
    """Base ticket message schema."""

    message: str = Field(..., min_length=1)
    attachments: Optional[dict] = Field(default_factory=dict)


class TicketMessageCreate(TicketMessageBase):
    """Ticket message creation schema."""

    ticket_id: str


class TicketMessageResponse(TicketMessageBase):
    """Ticket message response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    sender_id: str
    sender: Optional[UserResponse] = None
    timestamp: datetime


class TicketBase(BaseModel):
    """Base ticket schema."""

    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    priority: TicketPriority = TicketPriority.MEDIUM
    category: TicketCategory = TicketCategory.OTHER


class TicketCreate(TicketBase):
    """Ticket creation schema."""
    
    pass


class TicketUpdate(BaseModel):
    """Ticket update schema."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    category: Optional[TicketCategory] = None
    assigned_to_id: Optional[str] = None


class TicketResponse(TicketBase):
    """Ticket response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    ticket_id: str
    tenant_id: str
    status: TicketStatus
    created_by_id: str
    created_by: Optional[UserResponse] = None
    assigned_to_id: Optional[str] = None
    assigned_to: Optional[UserResponse] = None
    created_at: datetime
    updated_at: datetime


class TicketDetailResponse(TicketResponse):
    """Detailed ticket response including messages."""

    messages: List[TicketMessageResponse] = Field(default_factory=list)


class TicketListResponse(BaseModel):
    """Ticket list response schema."""

    items: List[TicketResponse]
    total: int
    page: int
    per_page: int
