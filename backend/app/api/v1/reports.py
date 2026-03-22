"""Reports API — custom report builder, exports, schedules, and archive."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.analytics import ReportSchedule, SavedReport
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.task import Task, TaskStatus, TimeEntry
from app.models.user import User
from app.schemas.analytics import (
    ExportRequest,
    ReportArchiveResponse,
    ReportDefinition,
    ReportScheduleCreate,
    ReportScheduleResponse,
    SavedReportCreate,
    SavedReportResponse,
    SavedReportUpdate,
)
from app.schemas.reports import (
    OverviewReportResponse,
    ProjectProgressReport,
    TimeReportResponse,
    UserTimeReport,
)
from app.services.export_service import ExportService
from app.services.report_builder import ReportBuilderService

logger = get_logger(__name__)
router = APIRouter()


# ── Fixed Overview Report (N+1 eliminated) ────────────────────────────────────

@router.get("/overview", response_model=OverviewReportResponse)
async def get_overview_report(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Full overview for all projects the user is a member of.
    FIXED: single aggregated SQL query instead of Python loop per project.
    """
    now = __import__("datetime").datetime.utcnow()

    # Step 1: project IDs for this user (one query)
    pid_result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
    )
    project_ids = [r[0] for r in pid_result.fetchall()]

    if not project_ids:
        return OverviewReportResponse(
            total_projects=0, active_projects=0, completed_projects=0,
            total_tasks=0, completed_tasks=0, overdue_tasks=0,
            overall_progress=0.0, projects=[], top_contributors=[],
        )

    # Step 2: Projects metadata (one query)
    projs_result = await db.execute(
        select(Project).where(Project.id.in_(project_ids))
    )
    projects = projs_result.scalars().all()

    # Step 3: ALL task aggregations for ALL projects in ONE query
    task_agg = await db.execute(
        select(
            Task.project_id,
            func.count(Task.id).label("total"),
            func.count(case((Task.status == TaskStatus.DONE, 1))).label("done"),
            func.count(case((Task.status == TaskStatus.IN_PROGRESS, 1))).label("in_progress"),
            func.count(case((Task.status == TaskStatus.TODO, 1))).label("todo"),
            func.count(case((
                and_(Task.due_date != None, Task.due_date < now,
                     Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED])), 1)
            )).label("overdue"),
        )
        .where(Task.project_id.in_(project_ids))
        .group_by(Task.project_id)
    )
    agg_map = {row.project_id: row for row in task_agg.all()}

    project_reports: List[ProjectProgressReport] = []
    total_tasks = completed_tasks = overdue_tasks = 0

    for p in projects:
        row = agg_map.get(p.id)
        tot = row.total if row else 0
        done = row.done if row else 0
        ip = row.in_progress if row else 0
        todo = row.todo if row else 0
        ov = row.overdue if row else 0
        total_tasks += tot
        completed_tasks += done
        overdue_tasks += ov
        project_reports.append(ProjectProgressReport(
            project_id=p.id,
            project_name=p.name,
            project_key=p.key,
            status=p.status.value,
            total_tasks=tot,
            completed_tasks=done,
            in_progress_tasks=ip,
            todo_tasks=todo,
            overdue_tasks=ov,
            progress_percentage=round(done / max(tot, 1) * 100, 1),
            total_estimated_hours=p.total_estimated_hours,
            total_actual_hours=p.total_actual_hours,
            start_date=p.start_date,
            end_date=p.end_date,
        ))

    overall_progress = round(completed_tasks / max(total_tasks, 1) * 100, 1)

    # Step 4: Top contributors (single GROUP BY query — no per-user loop)
    contrib_agg = await db.execute(
        select(
            User.id,
            User.first_name,
            User.last_name,
            User.email,
            User.avatar_url,
            func.count(Task.id).label("task_count"),
            func.coalesce(
                select(func.sum(TimeEntry.duration_minutes))
                .join(Task, TimeEntry.task_id == Task.id)
                .where(and_(
                    TimeEntry.user_id == User.id,
                    Task.project_id.in_(project_ids),
                )).scalar_subquery(), 0
            ).label("minutes"),
        )
        .join(Task, Task.primary_assignee_id == User.id, isouter=True)
        .where(Task.project_id.in_(project_ids))
        .group_by(User.id, User.first_name, User.last_name, User.email, User.avatar_url)
        .order_by(func.count(Task.id).desc())
        .limit(10)
    )
    top_contributors = [
        UserTimeReport(
            user_id=row.id,
            full_name=f"{row.first_name or ''} {row.last_name or ''}".strip(),
            email=row.email,
            avatar_url=row.avatar_url,
            total_minutes=row.minutes or 0,
            total_hours=round((row.minutes or 0) / 60, 2),
            task_count=row.task_count or 0,
        )
        for row in contrib_agg.all()
    ]
    top_contributors.sort(key=lambda x: x.total_hours, reverse=True)

    active_count = sum(1 for p in projects if p.status == ProjectStatus.ACTIVE)
    completed_count = sum(1 for p in projects if p.status == ProjectStatus.COMPLETED)

    return OverviewReportResponse(
        total_projects=len(project_reports),
        active_projects=active_count,
        completed_projects=completed_count,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
        overall_progress=overall_progress,
        projects=project_reports,
        top_contributors=top_contributors,
    )


# ── Fixed Time Summary Report ─────────────────────────────────────────────────

@router.get("/time-summary", response_model=TimeReportResponse)
async def get_time_summary(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Time logged per team member for the current month.
    FIXED: single GROUP BY query instead of N+1 per-user loops.
    """
    import datetime as dt
    now = dt.datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    pid_result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
    )
    project_ids = [r[0] for r in pid_result.fetchall()]

    if not project_ids:
        return TimeReportResponse(month=now.month, year=now.year, total_hours=0.0, user_reports=[])

    # Single GROUP BY query (replaces per-user loop)
    agg = await db.execute(
        select(
            User.id,
            User.first_name,
            User.last_name,
            User.email,
            User.avatar_url,
            func.coalesce(func.sum(TimeEntry.duration_minutes), 0).label("minutes"),
            func.count(distinct(Task.id)).label("task_count"),
        )
        .join(Task, Task.primary_assignee_id == User.id, isouter=True)
        .join(TimeEntry, and_(TimeEntry.task_id == Task.id, TimeEntry.user_id == User.id, TimeEntry.started_at >= first_of_month), isouter=True)
        .where(Task.project_id.in_(project_ids))
        .group_by(User.id, User.first_name, User.last_name, User.email, User.avatar_url)
        .order_by(func.coalesce(func.sum(TimeEntry.duration_minutes), 0).desc())
    )

    user_reports = []
    grand_total = 0
    for row in agg.all():
        mins = row.minutes or 0
        grand_total += mins
        user_reports.append(UserTimeReport(
            user_id=row.id,
            full_name=f"{row.first_name or ''} {row.last_name or ''}".strip(),
            email=row.email,
            avatar_url=row.avatar_url,
            total_minutes=mins,
            total_hours=round(mins / 60, 2),
            task_count=row.task_count or 0,
        ))

    return TimeReportResponse(
        month=now.month,
        year=now.year,
        total_hours=round(grand_total / 60, 2),
        user_reports=user_reports,
    )


# ── Custom Report Builder ─────────────────────────────────────────────────────

@router.post("", response_model=SavedReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    data: SavedReportCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a custom report definition."""
    svc = ReportBuilderService(db)
    report = await svc.save_report(data, owner_id=current_user.id)
    return SavedReportResponse.model_validate(report)


@router.get("/{report_id}", response_model=SavedReportResponse)
async def get_report(
    report_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ReportBuilderService(db)
    try:
        report = await svc.get_report(report_id, requester_id=current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return SavedReportResponse.model_validate(report)


@router.get("", response_model=List[SavedReportResponse])
async def list_reports(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List reports accessible to the current user (own + shared + public)."""
    svc = ReportBuilderService(db)
    reports = await svc.list_reports(requester_id=current_user.id)
    return [SavedReportResponse.model_validate(r) for r in reports]


@router.post("/{report_id}/run")
async def run_saved_report(
    report_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a saved report definition and return rows."""
    svc = ReportBuilderService(db)
    try:
        report = await svc.get_report(report_id, requester_id=current_user.id)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    if not report:
        raise HTTPException(status_code=404, detail="Not found")
    definition = ReportDefinition.model_validate(report.definition)
    try:
        rows = await svc.run_report(definition, owner_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await svc.archive_run(report_id, rows, "json", triggered_by=current_user.id)
    return {"report_id": report_id, "row_count": len(rows), "rows": rows}


@router.post("/run")
async def run_ad_hoc_report(
    definition: ReportDefinition,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run an ad-hoc report definition without saving it first."""
    svc = ReportBuilderService(db)
    try:
        rows = await svc.run_report(definition, owner_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"row_count": len(rows), "rows": rows}


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ReportBuilderService(db)
    if not await svc.delete_report(report_id, requester_id=current_user.id):
        raise HTTPException(status_code=404, detail="Report not found or access denied")


# ── Export ────────────────────────────────────────────────────────────────────

@router.post("/export")
async def export_report(
    req: ExportRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run a report and stream the result as a downloadable file."""
    builder = ReportBuilderService(db)
    try:
        rows = await builder.run_report(req.definition)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    exporter = ExportService()
    try:
        file_bytes, content_type, filename = exporter.export(
            rows, fmt=req.format.value, title=req.title or "Report"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return Response(
        content=file_bytes,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Archives / History ────────────────────────────────────────────────────────

@router.get("/{report_id}/history", response_model=List[ReportArchiveResponse])
async def get_report_history(
    report_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ReportBuilderService(db)
    archives = await svc.list_archives(report_id)
    return [ReportArchiveResponse.model_validate(a) for a in archives]


# ── Schedules ─────────────────────────────────────────────────────────────────

@router.post("/{report_id}/schedule", response_model=ReportScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    report_id: str,
    data: ReportScheduleCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Schedule a report for automated periodic delivery."""
    # Verify report ownership
    report_result = await db.execute(
        select(SavedReport).where(and_(SavedReport.id == report_id, SavedReport.owner_id == current_user.id))
    )
    if not report_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Report not found or not owned by you")

    import datetime as dt
    from app.services.scheduler import compute_next_run
    next_run = compute_next_run(data.frequency.value, data.hour, data.timezone, data.day_of_week, data.day_of_month)

    schedule = ReportSchedule(
        report_id=report_id,
        frequency=data.frequency,
        timezone=data.timezone,
        hour=data.hour,
        day_of_week=data.day_of_week,
        day_of_month=data.day_of_month,
        recipient_emails=data.recipient_emails,
        export_format=data.export_format,
        next_run_at=next_run,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return ReportScheduleResponse.model_validate(schedule)


@router.get("/{report_id}/schedule", response_model=List[ReportScheduleResponse])
async def list_schedules(
    report_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReportSchedule).where(ReportSchedule.report_id == report_id)
    )
    return [ReportScheduleResponse.model_validate(s) for s in result.scalars().all()]


@router.delete("/schedule/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await db.delete(sched)
    await db.commit()
