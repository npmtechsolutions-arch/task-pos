"""Timesheet Management API."""

from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, get_db
from app.models.timesheet import Timesheet, TimesheetEntry, TimesheetStatus

router = APIRouter()

@router.get("", response_model=list[dict])
async def get_my_timesheets(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get weekly timesheets for the current user."""
    stmt = select(Timesheet).where(Timesheet.user_id == current_user.id).order_by(Timesheet.period_start.desc())
    result = await db.execute(stmt)
    sheets = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "period_start": s.period_start,
            "period_end": s.period_end,
            "status": s.status,
            "total_hours": s.total_hours,
            "billable_hours": s.billable_hours
        }
        for s in sheets
    ]


@router.post("/{timesheet_id}/submit")
async def submit_timesheet(
    timesheet_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit a timesheet for approval."""
    sheet = await db.get(Timesheet, timesheet_id)
    if not sheet or sheet.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Timesheet not found")
        
    sheet.status = TimesheetStatus.SUBMITTED
    from datetime import datetime
    sheet.submitted_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Timesheet submitted successfully."}


@router.post("/{timesheet_id}/approve")
async def approve_timesheet(
    timesheet_id: str,
    current_user=Depends(get_current_user), # In real app, check if manager
    db: AsyncSession = Depends(get_db)
):
    """Manager approval of timesheet."""
    sheet = await db.get(Timesheet, timesheet_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
        
    sheet.status = TimesheetStatus.APPROVED
    from datetime import datetime
    sheet.approved_at = datetime.utcnow()
    sheet.approved_by_id = current_user.id
    await db.commit()
    
    return {"message": "Timesheet approved."}
