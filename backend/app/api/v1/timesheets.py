"""Timesheet Management API — production-ready with full workflow, notifications, and real-time."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.timesheet import TimesheetStatus
from app.models.user import User, UserRole
from app.schemas.timesheet import (
    TimesheetCreate,
    TimesheetDetailResponse,
    TimesheetEntryCreate,
    TimesheetEntryResponse,
    TimesheetEntryUpdate,
    TimesheetListResponse,
    TimesheetRejectRequest,
    TimesheetReportResponse,
    TimesheetResponse,
)
from app.services.timesheet import TimesheetService

logger = get_logger(__name__)
router = APIRouter()


def _is_admin(user: User) -> bool:
    return getattr(user, "role", None) in (UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)


# ─── STATIC PATHS FIRST (must come before /{timesheet_id}) ───────────────────

@router.get("/my", response_model=TimesheetListResponse)
async def get_my_timesheets(
    status_filter: Optional[TimesheetStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetListResponse:
    """Get paginated list of the current user's timesheets."""
    svc = TimesheetService(db)
    sheets, total = await svc.get_user_timesheets(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        skip=(page - 1) * per_page,
        limit=per_page,
        status=status_filter,
    )
    return TimesheetListResponse(
        items=[TimesheetResponse.model_validate(s) for s in sheets],
        total=total, page=page, per_page=per_page,
    )


@router.get("/current-week", response_model=TimesheetDetailResponse)
async def get_current_week(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetDetailResponse:
    """Get (or auto-create) the current ISO week's timesheet with all entries."""
    svc = TimesheetService(db)
    sheet = await svc.get_or_create_current_week(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
    )
    detail = await svc.get_timesheet_by_id(sheet.id, current_user.tenant_id)
    return TimesheetDetailResponse.model_validate(detail)


@router.get("/reports/summary", response_model=TimesheetReportResponse)
async def get_report(
    period_start: date = Query(...),
    period_end: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetReportResponse:
    """Admin: aggregate timesheet report for a date range."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    svc = TimesheetService(db)
    stats = await svc.get_summary_stats(current_user.tenant_id, period_start, period_end)
    return TimesheetReportResponse(
        period_start=period_start,
        period_end=period_end,
        by_user=[],
        by_project=[],
        **stats,
    )


# Entry patch/delete also use static prefixes — keep them before /{timesheet_id}

@router.patch("/entries/{entry_id}", response_model=TimesheetEntryResponse)
async def update_entry(
    entry_id: str,
    data: TimesheetEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetEntryResponse:
    """Update hours/description/billable on an existing entry."""
    svc = TimesheetService(db)
    entry = await svc.update_entry(current_user.tenant_id, entry_id, data)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found or timesheet is locked")
    return TimesheetEntryResponse.model_validate(entry)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a time entry. Blocked on approved timesheets."""
    svc = TimesheetService(db)
    deleted = await svc.delete_entry(current_user.tenant_id, entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found or timesheet is locked")


# ─── LIST / CREATE (root path) ────────────────────────────────────────────────

@router.get("", response_model=TimesheetListResponse)
async def list_timesheets(
    status_filter: Optional[TimesheetStatus] = Query(None, alias="status"),
    user_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetListResponse:
    """Admin: all timesheets. Non-admin: own timesheets only."""
    svc = TimesheetService(db)
    if _is_admin(current_user):
        sheets, total = await svc.get_all_timesheets(
            tenant_id=current_user.tenant_id,
            skip=(page - 1) * per_page,
            limit=per_page,
            status=status_filter,
            user_id=user_id,
        )
    else:
        sheets, total = await svc.get_user_timesheets(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            skip=(page - 1) * per_page,
            limit=per_page,
            status=status_filter,
        )
    return TimesheetListResponse(
        items=[TimesheetResponse.model_validate(s) for s in sheets],
        total=total, page=page, per_page=per_page,
    )


@router.post("", response_model=TimesheetDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_timesheet(
    data: TimesheetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetDetailResponse:
    """Create a timesheet for a custom period."""
    svc = TimesheetService(db)
    sheet = await svc.get_or_create_timesheet(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        period_start=data.period_start,
        period_end=data.period_end,
    )
    detail = await svc.get_timesheet_by_id(sheet.id, current_user.tenant_id)
    return TimesheetDetailResponse.model_validate(detail)


# ─── DYNAMIC PATHS (/{timesheet_id} last) ─────────────────────────────────────

@router.get("/{timesheet_id}", response_model=TimesheetDetailResponse)
async def get_timesheet(
    timesheet_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetDetailResponse:
    """Get timesheet with all entries."""
    svc = TimesheetService(db)
    sheet = await svc.get_timesheet_by_id(timesheet_id, current_user.tenant_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    if not _is_admin(current_user) and sheet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return TimesheetDetailResponse.model_validate(sheet)


@router.post("/{timesheet_id}/submit", response_model=TimesheetResponse)
async def submit_timesheet(
    timesheet_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetResponse:
    """Submit a draft timesheet for manager approval."""
    svc = TimesheetService(db)
    sheet = await svc.get_timesheet_by_id(timesheet_id, current_user.tenant_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    if sheet.user_id != current_user.id and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Not your timesheet")
    if sheet.status != TimesheetStatus.DRAFT:
        raise HTTPException(status_code=400, detail=f"Cannot submit a '{sheet.status}' timesheet")
    if not sheet.entries:
        raise HTTPException(status_code=400, detail="Cannot submit an empty timesheet — add time entries first")

    updated = await svc.submit_timesheet(timesheet_id, current_user.tenant_id)

    # Notify managers/admins
    try:
        from app.models.user import User as UserModel
        from app.services.notification import NotificationService
        from app.schemas.notification import NotificationCreate
        from app.models.notification import NotificationType

        mgr_q = select(UserModel).where(
            UserModel.tenant_id == current_user.tenant_id,
            UserModel.role.in_([UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER]),
            UserModel.is_active == True,
        )
        mgrs = (await db.execute(mgr_q)).scalars().all()
        ns = NotificationService(db)
        for mgr in mgrs:
            if mgr.id != current_user.id:
                await ns.create(NotificationCreate(
                    user_id=mgr.id,
                    notification_type=NotificationType.SYSTEM,
                    title="Timesheet Submitted for Approval",
                    message=f"{current_user.full_name} submitted timesheet ({sheet.period_start} → {sheet.period_end}) — {sheet.total_hours:.1f}h",
                    action_url=f"/timesheets?tab=admin&id={timesheet_id}",
                    extra_data={"timesheet_id": timesheet_id},
                ))

        from app.websocket.manager import manager as ws
        await ws.broadcast_to_users(
            [m.id for m in mgrs if m.id != current_user.id],
            {"type": "timesheet_submitted", "timesheet_id": timesheet_id, "user_name": current_user.full_name},
        )
    except Exception as e:
        logger.error("Timesheet submit notification failed", error=str(e))

    return TimesheetResponse.model_validate(updated)


@router.post("/{timesheet_id}/approve", response_model=TimesheetResponse)
async def approve_timesheet(
    timesheet_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetResponse:
    """Admin/manager approves a submitted timesheet."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only managers and admins can approve timesheets")

    svc = TimesheetService(db)
    updated = await svc.approve_timesheet(timesheet_id, current_user.tenant_id, current_user.id)
    if not updated:
        raise HTTPException(status_code=400, detail="Timesheet not found or not in 'submitted' state")

    try:
        from app.services.notification import NotificationService
        from app.schemas.notification import NotificationCreate
        from app.models.notification import NotificationType

        ns = NotificationService(db)
        await ns.create(NotificationCreate(
            user_id=updated.user_id,
            notification_type=NotificationType.SYSTEM,
            title="✅ Timesheet Approved",
            message=f"Your timesheet ({updated.period_start} → {updated.period_end}) was approved by {current_user.full_name}.",
            action_url=f"/timesheets?id={timesheet_id}",
            extra_data={"timesheet_id": timesheet_id},
        ))
        from app.websocket.manager import manager as ws
        await ws.send_to_user(updated.user_id, {"type": "timesheet_approved", "timesheet_id": timesheet_id})
    except Exception as e:
        logger.error("Timesheet approval notification failed", error=str(e))

    return TimesheetResponse.model_validate(updated)


@router.post("/{timesheet_id}/reject", response_model=TimesheetResponse)
async def reject_timesheet(
    timesheet_id: str,
    body: TimesheetRejectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetResponse:
    """Admin/manager rejects a submitted timesheet with a mandatory reason."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Only managers and admins can reject timesheets")

    svc = TimesheetService(db)
    updated = await svc.reject_timesheet(
        timesheet_id, current_user.tenant_id, current_user.id, body.reason
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Timesheet not found or not in 'submitted' state")

    try:
        from app.services.notification import NotificationService
        from app.schemas.notification import NotificationCreate
        from app.models.notification import NotificationType

        ns = NotificationService(db)
        await ns.create(NotificationCreate(
            user_id=updated.user_id,
            notification_type=NotificationType.SYSTEM,
            title="❌ Timesheet Rejected",
            message=f"Your timesheet was rejected. Reason: {body.reason}",
            action_url=f"/timesheets?id={timesheet_id}",
            extra_data={"timesheet_id": timesheet_id, "reason": body.reason},
        ))
        from app.websocket.manager import manager as ws
        await ws.send_to_user(updated.user_id, {
            "type": "timesheet_rejected", "timesheet_id": timesheet_id, "reason": body.reason,
        })
    except Exception as e:
        logger.error("Timesheet rejection notification failed", error=str(e))

    return TimesheetResponse.model_validate(updated)


@router.post("/{timesheet_id}/entries", response_model=TimesheetEntryResponse, status_code=status.HTTP_201_CREATED)
async def add_entry(
    timesheet_id: str,
    data: TimesheetEntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimesheetEntryResponse:
    """Log a time entry. Blocked on approved/locked timesheets."""
    svc = TimesheetService(db)
    sheet = await svc.get_timesheet_by_id(timesheet_id, current_user.tenant_id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    if not _is_admin(current_user) and sheet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if sheet.status == TimesheetStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Cannot edit an approved (locked) timesheet")

    entry = await svc.add_entry(current_user.tenant_id, timesheet_id, data)
    if not entry:
        raise HTTPException(status_code=400, detail="Could not create entry")
    return TimesheetEntryResponse.model_validate(entry)
