"""Attendance API — check-in/out, history, monthly view."""

import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.user import User, UserRole

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    date: date
    check_in: Optional[datetime]
    check_out: Optional[datetime]
    status: AttendanceStatus
    notes: Optional[str]
    is_remote: bool
    hours_worked: float
    user_name: Optional[str] = None
    user_email: Optional[str] = None


class CheckInRequest(BaseModel):
    notes: Optional[str] = None
    is_remote: bool = False


class CheckOutRequest(BaseModel):
    notes: Optional[str] = None


class MarkAttendanceRequest(BaseModel):
    user_id: str
    date: date
    status: AttendanceStatus
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    notes: Optional[str] = None


def _to_response(a: Attendance) -> AttendanceResponse:
    return AttendanceResponse(
        id=a.id,
        user_id=a.user_id,
        date=a.date,
        check_in=a.check_in,
        check_out=a.check_out,
        status=a.status,
        notes=a.notes,
        is_remote=a.is_remote,
        hours_worked=a.hours_worked,
        user_name=f"{a.user.first_name or ''} {a.user.last_name or ''}".strip() if a.user else None,
        user_email=a.user.email if a.user else None,
    )


# ── Today's Status ────────────────────────────────────────────────────────────

@router.get("/today", response_model=Optional[AttendanceResponse])
async def get_today_status(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's attendance record for today."""
    today = date.today()
    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == current_user.id,
            Attendance.date == today,
        )
    )
    record = result.scalar_one_or_none()
    return _to_response(record) if record else None


# ── Check In ──────────────────────────────────────────────────────────────────

@router.post("/check-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def check_in(
    data: CheckInRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record check-in for today. Returns existing record if already checked in."""
    today = date.today()
    now = datetime.utcnow()

    # Check if already checked in today
    existing = await db.execute(
        select(Attendance).where(
            Attendance.user_id == current_user.id,
            Attendance.date == today,
        )
    )
    record = existing.scalar_one_or_none()

    if record:
        if record.check_in:
            # Already checked in — return existing without error
            return _to_response(record)
        record.check_in = now
        record.status = AttendanceStatus.PRESENT
    else:
        record = Attendance(
            id=str(uuid.uuid4()),
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            date=today,
            check_in=now,
            status=AttendanceStatus.PRESENT,
            notes=data.notes,
            is_remote=data.is_remote,
        )
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return _to_response(record)


# ── Check Out ─────────────────────────────────────────────────────────────────

@router.post("/check-out", response_model=AttendanceResponse)
async def check_out(
    data: CheckOutRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record check-out for today."""
    today = date.today()
    now = datetime.utcnow()

    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == current_user.id,
            Attendance.date == today,
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(400, "No check-in found for today. Please check in first.")

    if record.check_out:
        return _to_response(record)  # Already checked out

    record.check_out = now
    if data.notes:
        record.notes = data.notes

    await db.commit()
    await db.refresh(record)
    return _to_response(record)


# ── History (monthly view) ────────────────────────────────────────────────────

@router.get("/history", response_model=List[AttendanceResponse])
async def get_attendance_history(
    month: int = Query(default=None, ge=1, le=12),
    year: int = Query(default=None, ge=2020),
    user_id: Optional[str] = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get attendance history. Admins can view any user; others see only themselves."""
    import datetime as dt
    now = dt.datetime.utcnow()
    month = month or now.month
    year = year or now.year

    # Access control
    target_user_id = current_user.id
    if user_id and user_id != current_user.id:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise HTTPException(403, "Cannot view other users' attendance")
        target_user_id = user_id

    # Build date range
    from calendar import monthrange
    _, days_in_month = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, days_in_month)

    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == target_user_id,
            Attendance.date >= start,
            Attendance.date <= end,
        ).order_by(Attendance.date)
    )
    records = result.scalars().all()
    return [_to_response(r) for r in records]


# ── Team Attendance (admin view) ──────────────────────────────────────────────

@router.get("/team", response_model=List[AttendanceResponse])
async def get_team_attendance(
    target_date: Optional[date] = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get attendance for all tenant users on a given date (admin only)."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER):
        raise HTTPException(403, "Manager/Admin access required")

    check_date = target_date or date.today()

    result = await db.execute(
        select(Attendance).where(
            Attendance.tenant_id == current_user.tenant_id,
            Attendance.date == check_date,
        ).order_by(Attendance.user_id)
    )
    records = result.scalars().all()
    return [_to_response(r) for r in records]


# ── Admin Mark Attendance ─────────────────────────────────────────────────────

@router.post("/mark", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def admin_mark_attendance(
    data: MarkAttendanceRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin can mark attendance for any user."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        raise HTTPException(403, "Admin access required")

    existing = await db.execute(
        select(Attendance).where(
            Attendance.user_id == data.user_id,
            Attendance.date == data.date,
        )
    )
    record = existing.scalar_one_or_none()

    if record:
        record.status = data.status
        record.check_in = data.check_in or record.check_in
        record.check_out = data.check_out or record.check_out
        record.notes = data.notes or record.notes
    else:
        record = Attendance(
            id=str(uuid.uuid4()),
            tenant_id=current_user.tenant_id,
            user_id=data.user_id,
            date=data.date,
            check_in=data.check_in,
            check_out=data.check_out,
            status=data.status,
            notes=data.notes,
        )
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return _to_response(record)


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def attendance_stats(
    month: int = Query(default=None, ge=1, le=12),
    year: int = Query(default=None, ge=2020),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Monthly attendance stats for the current user."""
    import datetime as dt
    now = dt.datetime.utcnow()
    month = month or now.month
    year = year or now.year

    from calendar import monthrange
    _, days_in_month = monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, days_in_month)

    result = await db.execute(
        select(Attendance).where(
            Attendance.user_id == current_user.id,
            Attendance.date >= start,
            Attendance.date <= end,
        )
    )
    records = result.scalars().all()

    stats = {s.value: 0 for s in AttendanceStatus}
    total_hours = 0.0
    for r in records:
        stats[r.status.value] = stats.get(r.status.value, 0) + 1
        total_hours += r.hours_worked

    return {
        "month": month,
        "year": year,
        "total_days_recorded": len(records),
        "working_days_in_month": days_in_month,
        "total_hours_worked": round(total_hours, 2),
        "by_status": stats,
    }


# ── Admin All Attendance (Super Admin full view) ───────────────────────────────

@router.get("/all", response_model=List[AttendanceResponse])
async def get_all_attendance(
    target_date: Optional[date] = Query(default=None),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2020),
    user_id: Optional[str] = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super admin view: all attendance records for ALL users in the tenant."""
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER):
        raise HTTPException(403, "Admin access required to view all attendance")

    import datetime as dt
    from calendar import monthrange
    conditions = [Attendance.tenant_id == current_user.tenant_id]

    if target_date:
        conditions.append(Attendance.date == target_date)
    elif month and year:
        _, days = monthrange(year, month)
        conditions.append(Attendance.date >= date(year, month, 1))
        conditions.append(Attendance.date <= date(year, month, days))

    if user_id:
        conditions.append(Attendance.user_id == user_id)

    result = await db.execute(
        select(Attendance)
        .where(and_(*conditions))
        .order_by(Attendance.date.desc(), Attendance.user_id)
        .limit(1000)
    )
    records = result.scalars().all()
    return [_to_response(r) for r in records]
