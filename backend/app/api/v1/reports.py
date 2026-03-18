"""Reports API router."""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.task import Task, TaskStatus, TimeEntry
from app.models.user import User
from app.schemas.reports import (
    ProjectProgressReport,
    TimeReportResponse,
    UserTimeReport,
    OverviewReportResponse,
)
from app.services.project import ProjectService

logger = get_logger(__name__)
router = APIRouter()


@router.get("/project-progress/{project_id}", response_model=ProjectProgressReport)
async def get_project_progress(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectProgressReport:
    """Get detailed progress report for a single project."""
    project_service = ProjectService(db)
    project = await project_service.get_by_id(project_id)

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    now = datetime.utcnow()
    tasks_result = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = tasks_result.scalars().all()

    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == TaskStatus.DONE)
    in_progress = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
    todo = sum(1 for t in tasks if t.status == TaskStatus.TODO)
    overdue = sum(
        1
        for t in tasks
        if t.due_date
        and t.due_date < now
        and t.status not in (TaskStatus.DONE, TaskStatus.CANCELLED)
    )
    progress_pct = round((completed / total * 100), 1) if total > 0 else 0.0

    return ProjectProgressReport(
        project_id=project.id,
        project_name=project.name,
        project_key=project.key,
        status=project.status.value,
        total_tasks=total,
        completed_tasks=completed,
        in_progress_tasks=in_progress,
        todo_tasks=todo,
        overdue_tasks=overdue,
        progress_percentage=progress_pct,
        total_estimated_hours=project.total_estimated_hours,
        total_actual_hours=project.total_actual_hours,
        start_date=project.start_date,
        end_date=project.end_date,
    )


@router.get("/time-summary", response_model=TimeReportResponse)
async def get_time_summary(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimeReportResponse:
    """
    Get time logged per team member for the current calendar month.
    Scoped to projects the current user belongs to.
    """
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Projects the current user is in
    project_ids_result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
    )
    project_ids = [r[0] for r in project_ids_result.fetchall()]

    if not project_ids:
        return TimeReportResponse(
            month=now.month, year=now.year, total_hours=0.0, user_reports=[]
        )

    # All users in those projects
    users_result = await db.execute(
        select(User)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id.in_(project_ids))
        .distinct()
    )
    users = users_result.scalars().all()

    user_reports: List[UserTimeReport] = []
    grand_total_minutes = 0

    for user in users:
        mins_result = await db.execute(
            select(func.sum(TimeEntry.duration_minutes))
            .join(Task, TimeEntry.task_id == Task.id)
            .where(
                and_(
                    TimeEntry.user_id == user.id,
                    Task.project_id.in_(project_ids),
                    TimeEntry.started_at >= first_of_month,
                )
            )
        )
        user_minutes = mins_result.scalar_one() or 0
        grand_total_minutes += user_minutes

        task_count_result = await db.execute(
            select(func.count(Task.id)).where(
                and_(Task.primary_assignee_id == user.id, Task.project_id.in_(project_ids))
            )
        )
        task_count = task_count_result.scalar_one() or 0

        user_reports.append(
            UserTimeReport(
                user_id=user.id,
                full_name=user.full_name,
                email=user.email,
                avatar_url=user.avatar_url,
                total_minutes=user_minutes,
                total_hours=round(user_minutes / 60, 2),
                task_count=task_count,
            )
        )

    # Sort by hours desc
    user_reports.sort(key=lambda x: x.total_hours, reverse=True)

    return TimeReportResponse(
        month=now.month,
        year=now.year,
        total_hours=round(grand_total_minutes / 60, 2),
        user_reports=user_reports,
    )


@router.get("/overview", response_model=OverviewReportResponse)
async def get_overview_report(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OverviewReportResponse:
    """
    Full overview report for all projects the current user is a member of.
    Returns project list, aggregate stats, and top contributors by hours.
    """
    # Get user's projects
    project_ids_result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
    )
    project_ids = [r[0] for r in project_ids_result.fetchall()]

    if not project_ids:
        return OverviewReportResponse(
            total_projects=0,
            active_projects=0,
            completed_projects=0,
            total_tasks=0,
            completed_tasks=0,
            overdue_tasks=0,
            overall_progress=0.0,
            projects=[],
            top_contributors=[],
        )

    projects_result = await db.execute(
        select(Project).where(Project.id.in_(project_ids))
    )
    projects = projects_result.scalars().all()

    now = datetime.utcnow()
    project_reports: List[ProjectProgressReport] = []
    all_tasks_total = 0
    all_tasks_completed = 0
    all_tasks_overdue = 0

    for project in projects:
        tasks_result = await db.execute(select(Task).where(Task.project_id == project.id))
        tasks = tasks_result.scalars().all()

        total = len(tasks)
        completed = sum(1 for t in tasks if t.status == TaskStatus.DONE)
        in_progress = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
        todo = sum(1 for t in tasks if t.status == TaskStatus.TODO)
        overdue = sum(
            1
            for t in tasks
            if t.due_date
            and t.due_date < now
            and t.status not in (TaskStatus.DONE, TaskStatus.CANCELLED)
        )
        progress_pct = round((completed / total * 100), 1) if total > 0 else 0.0

        all_tasks_total += total
        all_tasks_completed += completed
        all_tasks_overdue += overdue

        project_reports.append(
            ProjectProgressReport(
                project_id=project.id,
                project_name=project.name,
                project_key=project.key,
                status=project.status.value,
                total_tasks=total,
                completed_tasks=completed,
                in_progress_tasks=in_progress,
                todo_tasks=todo,
                overdue_tasks=overdue,
                progress_percentage=progress_pct,
                total_estimated_hours=project.total_estimated_hours,
                total_actual_hours=project.total_actual_hours,
                start_date=project.start_date,
                end_date=project.end_date,
            )
        )

    overall_progress = (
        round(all_tasks_completed / all_tasks_total * 100, 1) if all_tasks_total > 0 else 0.0
    )

    # Top contributors (all users, all time)
    users_result = await db.execute(
        select(User)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id.in_(project_ids))
        .distinct()
    )
    users = users_result.scalars().all()

    contributors: List[UserTimeReport] = []
    for user in users:
        mins_result = await db.execute(
            select(func.sum(TimeEntry.duration_minutes))
            .join(Task, TimeEntry.task_id == Task.id)
            .where(
                and_(
                    TimeEntry.user_id == user.id,
                    Task.project_id.in_(project_ids),
                )
            )
        )
        user_minutes = mins_result.scalar_one() or 0

        task_count_result = await db.execute(
            select(func.count(Task.id)).where(
                and_(Task.primary_assignee_id == user.id, Task.project_id.in_(project_ids))
            )
        )
        task_count = task_count_result.scalar_one() or 0

        contributors.append(
            UserTimeReport(
                user_id=user.id,
                full_name=user.full_name,
                email=user.email,
                avatar_url=user.avatar_url,
                total_minutes=user_minutes,
                total_hours=round(user_minutes / 60, 2),
                task_count=task_count,
            )
        )

    contributors.sort(key=lambda x: x.total_hours, reverse=True)
    top_contributors = contributors[:10]

    active_count = sum(1 for p in projects if p.status == ProjectStatus.ACTIVE)
    completed_count = sum(1 for p in projects if p.status == ProjectStatus.COMPLETED)

    return OverviewReportResponse(
        total_projects=len(project_reports),
        active_projects=active_count,
        completed_projects=completed_count,
        total_tasks=all_tasks_total,
        completed_tasks=all_tasks_completed,
        overdue_tasks=all_tasks_overdue,
        overall_progress=overall_progress,
        projects=project_reports,
        top_contributors=top_contributors,
    )
