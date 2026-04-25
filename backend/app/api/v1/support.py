"""Support Ticket API routes — production-ready with real-time and notifications."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.support import TicketCategory, TicketPriority, TicketStatus
from app.models.user import User, UserRole
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
    """Create a new support ticket and notify all tenant admins."""
    support_service = SupportService(db)
    ticket = await support_service.create_ticket(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        data=ticket_data,
    )

    # Notify all admins in the tenant
    try:
        from app.services.notification import NotificationService
        from app.schemas.notification import NotificationCreate
        from app.models.notification import NotificationType

        admin_query = select(User).where(
            User.tenant_id == current_user.tenant_id,
            User.role.in_([UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER]),
            User.is_active == True,
        )
        admin_result = await db.execute(admin_query)
        admins = admin_result.scalars().all()

        ns = NotificationService(db)
        for admin in admins:
            if admin.id != current_user.id:
                await ns.create(NotificationCreate(
                    user_id=admin.id,
                    notification_type=NotificationType.SYSTEM,
                    title="New Support Ticket",
                    message=f"{current_user.first_name} opened ticket #{ticket.ticket_id}: {ticket.title}",
                    action_url=f"/settings?tab=support&ticket={ticket.id}",
                    extra_data={"ticket_id": ticket.id, "ticket_ref": ticket.ticket_id},
                ))
    except Exception as e:
        logger.error("Failed to send ticket creation notifications", error=str(e))

    return TicketResponse.model_validate(ticket)


@router.get("", response_model=TicketListResponse)
async def list_tickets(
    status: Optional[TicketStatus] = Query(None),
    priority: Optional[TicketPriority] = Query(None),
    category: Optional[TicketCategory] = Query(None),
    mine_only: bool = Query(False, description="Show only tickets created by me"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketListResponse:
    """List support tickets. Non-admins always get their own tickets only."""
    support_service = SupportService(db)

    is_admin = getattr(current_user, "role", None) in (
        UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER
    )

    # Non-admins can only see their own tickets
    user_id_filter = current_user.id if (mine_only or not is_admin) else None

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


@router.get("/my", response_model=TicketListResponse)
async def get_my_tickets(
    status: Optional[TicketStatus] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketListResponse:
    """Get tickets created by the current user."""
    support_service = SupportService(db)
    tickets, total = await support_service.get_tickets(
        tenant_id=current_user.tenant_id,
        skip=(page - 1) * per_page,
        limit=per_page,
        status=status,
        user_id=current_user.id,
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

    # Non-admins can only see their own tickets
    is_admin = getattr(current_user, "role", None) in (
        UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER
    )
    if not is_admin and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return TicketDetailResponse.model_validate(ticket)


@router.put("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    update_data: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Update ticket. Status changes are admin-only."""
    is_admin = getattr(current_user, "role", None) in (
        UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER
    )

    if update_data.status and not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can change ticket status")

    support_service = SupportService(db)
    old_ticket = await support_service.get_ticket_by_id(ticket_id, current_user.tenant_id)
    if not old_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket = await support_service.update_ticket(
        ticket_id=ticket_id,
        tenant_id=current_user.tenant_id,
        data=update_data,
    )

    # Notify the ticket creator of status change
    if update_data.status and ticket and ticket.created_by_id != current_user.id:
        try:
            from app.services.notification import NotificationService
            from app.schemas.notification import NotificationCreate
            from app.models.notification import NotificationType

            ns = NotificationService(db)
            await ns.create(NotificationCreate(
                user_id=ticket.created_by_id,
                notification_type=NotificationType.SYSTEM,
                title="Ticket Status Updated",
                message=f"Your ticket #{ticket.ticket_id} status changed to {update_data.status.value.replace('_', ' ').title()}",
                action_url=f"/settings?tab=support&ticket={ticket.id}",
                extra_data={"ticket_id": ticket.id, "new_status": str(update_data.status)},
            ))

            # WebSocket broadcast
            from app.websocket.manager import manager
            await manager.send_to_user(ticket.created_by_id, {
                "type": "ticket_update",
                "ticket_id": ticket.id,
                "ticket_ref": ticket.ticket_id,
                "new_status": str(update_data.status),
            })
        except Exception as e:
            logger.error("Failed to notify on status update", error=str(e))

    return TicketResponse.model_validate(ticket)


@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse)
async def add_message(
    ticket_id: str,
    message_data: TicketMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TicketMessageResponse:
    """Add a message to a ticket (user or admin). Broadcasts via WebSocket."""
    support_service = SupportService(db)

    # Build the create payload with correct ticket_id
    msg_data = TicketMessageCreate(ticket_id=ticket_id, message=message_data.message)

    message = await support_service.add_message(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        data=msg_data,
    )

    if not message:
        raise HTTPException(status_code=404, detail="Ticket not found")

    is_admin = getattr(current_user, "role", None) in (
        UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER
    )

    # Broadcast via WebSocket to all users in this ticket's room
    try:
        from app.websocket.manager import manager
        ws_payload = {
            "type": "new_message",
            "ticket_id": ticket_id,
            "message": {
                "id": message.id,
                "sender_id": current_user.id,
                "sender_name": current_user.full_name,
                "message": message.message,
                "timestamp": message.timestamp.isoformat(),
                "is_admin": is_admin,
            },
        }
        await manager.send_to_room(f"ticket:{ticket_id}", ws_payload)
    except Exception as e:
        logger.error("Failed to broadcast message via WebSocket", error=str(e))

    # Send DB notification to the other party
    try:
        ticket = await support_service.get_ticket_by_id(ticket_id, current_user.tenant_id)
        if ticket:
            from app.services.notification import NotificationService
            from app.schemas.notification import NotificationCreate
            from app.models.notification import NotificationType

            ns = NotificationService(db)
            # Admin reply → notify user; User reply → notify assigned admin
            if is_admin and ticket.created_by_id != current_user.id:
                await ns.create(NotificationCreate(
                    user_id=ticket.created_by_id,
                    notification_type=NotificationType.SYSTEM,
                    title="New Reply on Your Ticket",
                    message=f"Support replied to #{ticket.ticket_id}: {message.message[:80]}...",
                    action_url=f"/settings?tab=support&ticket={ticket.id}",
                    extra_data={"ticket_id": ticket.id},
                ))
            elif not is_admin and ticket.assigned_to_id and ticket.assigned_to_id != current_user.id:
                await ns.create(NotificationCreate(
                    user_id=ticket.assigned_to_id,
                    notification_type=NotificationType.SYSTEM,
                    title="User Replied to Ticket",
                    message=f"#{ticket.ticket_id}: {message.message[:80]}...",
                    action_url=f"/settings?tab=support&ticket={ticket.id}",
                    extra_data={"ticket_id": ticket.id},
                ))
    except Exception as e:
        logger.error("Failed to send reply notification", error=str(e))

    return TicketMessageResponse.model_validate(message)


@router.get("/{ticket_id}/messages", response_model=list[TicketMessageResponse])
async def get_messages(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TicketMessageResponse]:
    """Get all messages for a ticket."""
    support_service = SupportService(db)
    ticket = await support_service.get_ticket_with_messages(
        ticket_id=ticket_id,
        tenant_id=current_user.tenant_id,
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    is_admin = getattr(current_user, "role", None) in (
        UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER
    )
    if not is_admin and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return [TicketMessageResponse.model_validate(m) for m in ticket.messages]
