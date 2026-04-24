"""Support Ticket API routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.support import TicketCategory, TicketPriority, TicketStatus
from app.models.user import User
from app.schemas.support import (
    TicketCreate,
    TicketDetailResponse,
    TicketListResponse,
    TicketMessageCreate,
    TicketMessageResponse,
    TicketResponse,
    TicketUpdate,
)
from app.services.support import SupportService

logger = get_logger(__name__)
router = APIRouter()


@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    ticket_data: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Create a new support ticket."""
    support_service = SupportService(db)
    ticket = await support_service.create_ticket(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        data=ticket_data,
    )
    return TicketResponse.model_validate(ticket)


@router.get("", response_model=TicketListResponse)
async def list_tickets(
    status: Optional[TicketStatus] = Query(None),
    priority: Optional[TicketPriority] = Query(None),
    category: Optional[TicketCategory] = Query(None),
    mine_only: bool = Query(False, description="Show only tickets assigned to or created by me"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketListResponse:
    """List support tickets."""
    support_service = SupportService(db)
    
    user_id_filter = current_user.id if mine_only else None
    
    # If not admin, maybe restrict to their own tickets depending on role,
    # but for now we follow mine_only flag or tenant scope.
    
    tickets, total = await support_service.get_tickets(
        tenant_id=current_user.tenant_id,
        skip=(page - 1) * per_page,
        limit=per_page,
        status=status,
        priority=priority,
        category=category,
        user_id=user_id_filter,
    )
    
    return TicketListResponse(
        items=[TicketResponse.model_validate(t) for t in tickets],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
async def get_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketDetailResponse:
    """Get ticket details with messages."""
    support_service = SupportService(db)
    ticket = await support_service.get_ticket_with_messages(
        ticket_id=ticket_id,
        tenant_id=current_user.tenant_id,
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    return TicketDetailResponse.model_validate(ticket)


@router.put("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Update ticket status, priority, etc."""
    support_service = SupportService(db)
    ticket = await support_service.update_ticket(
        ticket_id=ticket_id,
        tenant_id=current_user.tenant_id,
        data=update_data,
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    return TicketResponse.model_validate(ticket)


@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse)
async def add_message(
    ticket_id: str,
    message_data: TicketMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketMessageResponse:
    """Add a message to a ticket."""
    if message_data.ticket_id != ticket_id:
        raise HTTPException(status_code=400, detail="Ticket ID mismatch")
        
    support_service = SupportService(db)
    message = await support_service.add_message(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        data=message_data,
    )
    
    if not message:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    return TicketMessageResponse.model_validate(message)
