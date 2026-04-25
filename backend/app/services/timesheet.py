"""Timesheet service — business logic for the full timesheet workflow."""

from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.timesheet import Timesheet, TimesheetEntry, TimesheetStatus
from app.schemas.timesheet import (
    TimesheetCreate, TimesheetEntryCreate, TimesheetEntryUpdate,
    TimesheetRejectRequest,
)

logger = get_logger(__name__)


class TimesheetService:
    """Core business logic for the timesheet workflow."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── Timesheet CRUD ───────────────────────────────────────────────────────

    async def get_or_create_current_week(self, tenant_id: str, user_id: str) -> Timesheet:
        """Get or create the timesheet for the current ISO week."""
        today = date.today()
        # Monday as week start
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        return await self.get_or_create_timesheet(tenant_id, user_id, week_start, week_end)

    async def get_or_create_timesheet(
        self, tenant_id: str, user_id: str, period_start: date, period_end: date
    ) -> Timesheet:
        """Get an existing timesheet for the given period or create a new draft."""
        query = select(Timesheet).where(
            and_(
                Timesheet.tenant_id == tenant_id,
                Timesheet.user_id == user_id,
                Timesheet.period_start == period_start,
            )
        ).options(selectinload(Timesheet.entries))
        result = await self.db.execute(query)
        sheet = result.scalar_one_or_none()
        if sheet:
            return sheet

        sheet = Timesheet(
            tenant_id=tenant_id,
            user_id=user_id,
            period_start=period_start,
            period_end=period_end,
            status=TimesheetStatus.DRAFT,
        )
        self.db.add(sheet)
        await self.db.commit()
        await self.db.refresh(sheet)
        return sheet

    async def get_timesheet_by_id(self, timesheet_id: str, tenant_id: str) -> Optional[Timesheet]:
        query = (
            select(Timesheet)
            .where(and_(Timesheet.id == timesheet_id, Timesheet.tenant_id == tenant_id))
            .options(
                selectinload(Timesheet.user),
                selectinload(Timesheet.approver),
                selectinload(Timesheet.entries).selectinload(TimesheetEntry.task),
                selectinload(Timesheet.entries).selectinload(TimesheetEntry.project),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_user_timesheets(
        self,
        tenant_id: str,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        status: Optional[TimesheetStatus] = None,
    ) -> Tuple[List[Timesheet], int]:
        conditions = [Timesheet.tenant_id == tenant_id, Timesheet.user_id == user_id]
        if status:
            conditions.append(Timesheet.status == status)

        total = (await self.db.execute(
            select(func.count(Timesheet.id)).where(and_(*conditions))
        )).scalar() or 0

        query = (
            select(Timesheet)
            .where(and_(*conditions))
            .options(selectinload(Timesheet.user), selectinload(Timesheet.approver))
            .order_by(desc(Timesheet.period_start))
            .offset(skip).limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def get_all_timesheets(
        self,
        tenant_id: str,
        skip: int = 0,
        limit: int = 50,
        status: Optional[TimesheetStatus] = None,
        user_id: Optional[str] = None,
    ) -> Tuple[List[Timesheet], int]:
        conditions = [Timesheet.tenant_id == tenant_id]
        if status:
            conditions.append(Timesheet.status == status)
        if user_id:
            conditions.append(Timesheet.user_id == user_id)

        total = (await self.db.execute(
            select(func.count(Timesheet.id)).where(and_(*conditions))
        )).scalar() or 0

        query = (
            select(Timesheet)
            .where(and_(*conditions))
            .options(selectinload(Timesheet.user), selectinload(Timesheet.approver))
            .order_by(desc(Timesheet.submitted_at.nulls_last()), desc(Timesheet.period_start))
            .offset(skip).limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    # ─── Workflow ─────────────────────────────────────────────────────────────

    async def submit_timesheet(self, timesheet_id: str, tenant_id: str) -> Optional[Timesheet]:
        sheet = await self.get_timesheet_by_id(timesheet_id, tenant_id)
        if not sheet or sheet.status != TimesheetStatus.DRAFT:
            return None
        sheet.status = TimesheetStatus.SUBMITTED
        sheet.submitted_at = datetime.utcnow()
        sheet.updated_at = datetime.utcnow()
        await self.db.commit()
        return await self.get_timesheet_by_id(timesheet_id, tenant_id)

    async def approve_timesheet(
        self, timesheet_id: str, tenant_id: str, approver_id: str
    ) -> Optional[Timesheet]:
        sheet = await self.get_timesheet_by_id(timesheet_id, tenant_id)
        if not sheet or sheet.status != TimesheetStatus.SUBMITTED:
            return None
        sheet.status = TimesheetStatus.APPROVED
        sheet.approved_at = datetime.utcnow()
        sheet.approved_by_id = approver_id
        sheet.rejection_reason = None
        sheet.updated_at = datetime.utcnow()
        await self.db.commit()
        return await self.get_timesheet_by_id(timesheet_id, tenant_id)

    async def reject_timesheet(
        self, timesheet_id: str, tenant_id: str, approver_id: str, reason: str
    ) -> Optional[Timesheet]:
        sheet = await self.get_timesheet_by_id(timesheet_id, tenant_id)
        if not sheet or sheet.status != TimesheetStatus.SUBMITTED:
            return None
        sheet.status = TimesheetStatus.REJECTED
        sheet.rejection_reason = reason
        sheet.approved_by_id = approver_id
        sheet.updated_at = datetime.utcnow()
        await self.db.commit()
        return await self.get_timesheet_by_id(timesheet_id, tenant_id)

    # ─── Entry CRUD ───────────────────────────────────────────────────────────

    async def add_entry(
        self, tenant_id: str, timesheet_id: str, data: TimesheetEntryCreate
    ) -> Optional[TimesheetEntry]:
        sheet = await self.get_timesheet_by_id(timesheet_id, tenant_id)
        if not sheet or sheet.status == TimesheetStatus.APPROVED:
            return None

        entry = TimesheetEntry(
            tenant_id=tenant_id,
            timesheet_id=timesheet_id,
            date_logged=data.date_logged,
            hours=data.hours,
            description=data.description,
            activity_type=data.activity_type,
            is_billable=data.is_billable,
            task_id=data.task_id,
            project_id=data.project_id,
            started_at=data.started_at,
            ended_at=data.ended_at,
        )
        self.db.add(entry)

        # Recalculate totals
        sheet.total_hours = (sheet.total_hours or 0) + data.hours
        if data.is_billable:
            sheet.billable_hours = (sheet.billable_hours or 0) + data.hours
        sheet.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(entry)

        # Load relationships
        from sqlalchemy.orm import selectinload
        q = (
            select(TimesheetEntry)
            .where(TimesheetEntry.id == entry.id)
            .options(
                selectinload(TimesheetEntry.task),
                selectinload(TimesheetEntry.project),
            )
        )
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def update_entry(
        self, tenant_id: str, entry_id: str, data: TimesheetEntryUpdate
    ) -> Optional[TimesheetEntry]:
        q = select(TimesheetEntry).where(
            and_(TimesheetEntry.id == entry_id, TimesheetEntry.tenant_id == tenant_id)
        )
        result = await self.db.execute(q)
        entry = result.scalar_one_or_none()
        if not entry:
            return None

        # Check sheet not locked
        sheet = await self.db.get(Timesheet, entry.timesheet_id)
        if sheet and sheet.status == TimesheetStatus.APPROVED:
            return None

        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(entry, field, value)
        entry.updated_at = datetime.utcnow()

        # Recalculate parent sheet totals
        if sheet:
            sheet.recalculate_hours()
            sheet.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def delete_entry(self, tenant_id: str, entry_id: str) -> bool:
        q = select(TimesheetEntry).where(
            and_(TimesheetEntry.id == entry_id, TimesheetEntry.tenant_id == tenant_id)
        )
        result = await self.db.execute(q)
        entry = result.scalar_one_or_none()
        if not entry:
            return False

        sheet = await self.db.get(Timesheet, entry.timesheet_id)
        if sheet and sheet.status == TimesheetStatus.APPROVED:
            return False

        await self.db.delete(entry)

        if sheet:
            # Refresh entries then recalculate
            await self.db.refresh(sheet)
            sheet.recalculate_hours()

        await self.db.commit()
        return True

    # ─── Analytics ────────────────────────────────────────────────────────────

    async def get_summary_stats(
        self,
        tenant_id: str,
        period_start: date,
        period_end: date,
    ) -> dict:
        """Return aggregate hours and status counts for the report view."""
        from sqlalchemy import case

        conds = [
            Timesheet.tenant_id == tenant_id,
            Timesheet.period_start >= period_start,
            Timesheet.period_end <= period_end,
        ]
        result = await self.db.execute(
            select(
                func.sum(Timesheet.total_hours).label("total_hours"),
                func.sum(Timesheet.billable_hours).label("billable_hours"),
                func.count(
                    case((Timesheet.status == TimesheetStatus.SUBMITTED, 1))
                ).label("submitted_count"),
                func.count(
                    case((Timesheet.status == TimesheetStatus.APPROVED, 1))
                ).label("approved_count"),
                func.count(
                    case((Timesheet.status.in_([TimesheetStatus.DRAFT, TimesheetStatus.SUBMITTED]), 1))
                ).label("pending_count"),
            ).where(and_(*conds))
        )
        row = result.one()
        return {
            "total_hours": float(row.total_hours or 0),
            "billable_hours": float(row.billable_hours or 0),
            "non_billable_hours": float((row.total_hours or 0) - (row.billable_hours or 0)),
            "submitted_count": row.submitted_count or 0,
            "approved_count": row.approved_count or 0,
            "pending_count": row.pending_count or 0,
        }
