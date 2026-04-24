"""Support ticket service."""

import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.support import Ticket, TicketMessage, TicketStatus, TicketPriority, TicketCategory
from app.schemas.support import TicketCreate, TicketUpdate, TicketMessageCreate

logger = get_logger(__name__)


class SupportService:
    """Support service class."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_ticket_id(self, tenant_id: str) -> str:
        """Generate a unique ticket ID like TKT-0001."""
        query = select(func.count(Ticket.id)).where(Ticket.tenant_id == tenant_id)
        count = (await self.db.execute(query)).scalar() or 0
        return f"TKT-{(count + 1):04d}"

    async def get_ticket_by_id(self, ticket_id: str, tenant_id: str) -> Optional[Ticket]:
        """Get ticket by UUID and tenant."""
        query = (
            select(Ticket)
            .where(and_(Ticket.id == ticket_id, Ticket.tenant_id == tenant_id))
            .options(
                selectinload(Ticket.created_by),
                selectinload(Ticket.assigned_to),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_ticket_with_messages(self, ticket_id: str, tenant_id: str) -> Optional[Ticket]:
        """Get ticket with all its messages."""
        query = (
            select(Ticket)
            .where(and_(Ticket.id == ticket_id, Ticket.tenant_id == tenant_id))
            .options(
                selectinload(Ticket.created_by),
                selectinload(Ticket.assigned_to),
                selectinload(Ticket.messages).selectinload(TicketMessage.sender)
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_tickets(
        self,
        tenant_id: str,
        skip: int = 0,
        limit: int = 50,
        status: Optional[TicketStatus] = None,
        priority: Optional[TicketPriority] = None,
        category: Optional[TicketCategory] = None,
        user_id: Optional[str] = None,
    ) -> Tuple[List[Ticket], int]:
        """Get tickets with filters."""
        conditions = [Ticket.tenant_id == tenant_id]
        
        if status:
            conditions.append(Ticket.status == status)
        if priority:
            conditions.append(Ticket.priority == priority)
        if category:
            conditions.append(Ticket.category == category)
        if user_id:
            # User can see tickets they created or are assigned to
            conditions.append(
                (Ticket.created_by_id == user_id) | (Ticket.assigned_to_id == user_id)
            )

        where_clause = and_(*conditions)
        
        # Get total count
        total_query = select(func.count(Ticket.id)).where(where_clause)
        total = (await self.db.execute(total_query)).scalar() or 0

        # Get items
        query = (
            select(Ticket)
            .where(where_clause)
            .options(
                selectinload(Ticket.created_by),
                selectinload(Ticket.assigned_to),
            )
            .order_by(desc(Ticket.created_at))
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        
        return list(result.scalars().all()), total

    async def create_ticket(
        self, tenant_id: str, user_id: str, data: TicketCreate
    ) -> Ticket:
        """Create a new support ticket."""
        ticket_id_str = await self._generate_ticket_id(tenant_id)
        
        ticket = Ticket(
            ticket_id=ticket_id_str,
            tenant_id=tenant_id,
            title=data.title,
            description=data.description,
            priority=data.priority,
            category=data.category,
            created_by_id=user_id,
            status=TicketStatus.OPEN,
        )
        
        self.db.add(ticket)
        await self.db.commit()
        await self.db.refresh(ticket)
        
        # Load relationships
        return await self.get_ticket_by_id(ticket.id, tenant_id)

    async def update_ticket(
        self, ticket_id: str, tenant_id: str, data: TicketUpdate
    ) -> Optional[Ticket]:
        """Update a ticket."""
        ticket = await self.get_ticket_by_id(ticket_id, tenant_id)
        if not ticket:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(ticket, field, value)

        ticket.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(ticket)
        
        return await self.get_ticket_by_id(ticket.id, tenant_id)

    async def add_message(
        self, tenant_id: str, user_id: str, data: TicketMessageCreate
    ) -> Optional[TicketMessage]:
        """Add a message to a ticket."""
        ticket = await self.get_ticket_by_id(data.ticket_id, tenant_id)
        if not ticket:
            return None

        message = TicketMessage(
            ticket_id=ticket.id,
            tenant_id=tenant_id,
            sender_id=user_id,
            message=data.message,
            attachments=data.attachments or {},
        )
        
        self.db.add(message)
        
        # Update ticket timestamp and possibly status if it's waiting on user
        ticket.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(message)
        
        # Return with loaded sender
        query = (
            select(TicketMessage)
            .where(TicketMessage.id == message.id)
            .options(selectinload(TicketMessage.sender))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
