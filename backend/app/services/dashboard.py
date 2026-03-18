"""Dashboard aggregation service."""

from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple

from sqlalchemy import func, select, and_, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.task import Task, TaskStatus, TimeEntry
from app.models.user import User
from app.schemas.dashboard import (
    DashboardStatsResponse,
    DashboardProjectsResponse,
    ProjectProgressResponse,
)
from app.websocket.manager import manager



class DashboardService:
    """Service for aggregating dashboard statistics."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def broadcast_dashboard_update(self, user_id: str) -> None:
        """Trigger a real-time WebSocket reload of the dashboard for this user."""
        await manager.send_to_user(
            user_id,
            {"type": "dashboard_update", "action": "reload"}
        )

    async def get_stats(self, user_id: str) -> DashboardStatsResponse:
        """Aggregate all dashboard stats for a user."""

        # --- Projects the user is a member of ---
        user_project_ids_stmt = select(ProjectMember.project_id).where(
            ProjectMember.user_id == user_id
        )
        project_ids_result = await self.db.execute(user_project_ids_stmt)
        project_ids = [r[0] for r in project_ids_result.fetchall()]

        # Total & active projects
        total_projects = len(project_ids)
        active_projects = 0
        if project_ids:
            active_stmt = select(func.count(Project.id)).where(
                and_(
                    Project.id.in_(project_ids),
                    Project.status == ProjectStatus.ACTIVE,
                )
            )
            active_result = await self.db.execute(active_stmt)
            active_projects = active_result.scalar_one() or 0

        # --- Tasks assigned to user ---
        now = datetime.utcnow()
        week_later = now + timedelta(days=7)

        my_tasks_stmt = select(Task).where(Task.primary_assignee_id == user_id)
        my_tasks_result = await self.db.execute(my_tasks_stmt)
        my_tasks = my_tasks_result.scalars().all()

        my_tasks_count = len(my_tasks)
        my_completed = sum(1 for t in my_tasks if t.status == TaskStatus.DONE)
        my_in_progress = sum(1 for t in my_tasks if t.status == TaskStatus.IN_PROGRESS)
        overdue = sum(
            1
            for t in my_tasks
            if t.due_date
            and t.due_date < now
            and t.status not in (TaskStatus.DONE, TaskStatus.CANCELLED)
        )
        due_this_week = sum(
            1
            for t in my_tasks
            if t.due_date
            and now <= t.due_date <= week_later
            and t.status not in (TaskStatus.DONE, TaskStatus.CANCELLED)
        )

        # --- Time entries for user ---
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_hours_stmt = select(func.sum(TimeEntry.duration_minutes)).where(
            TimeEntry.user_id == user_id
        )
        total_hours_result = await self.db.execute(total_hours_stmt)
        total_minutes = total_hours_result.scalar_one() or 0
        hours_all_time = round(total_minutes / 60, 2)

        month_hours_stmt = select(func.sum(TimeEntry.duration_minutes)).where(
            and_(
                TimeEntry.user_id == user_id,
                TimeEntry.started_at >= first_of_month,
            )
        )
        month_hours_result = await self.db.execute(month_hours_stmt)
        month_minutes = month_hours_result.scalar_one() or 0
        hours_this_month = round(month_minutes / 60, 2)

        # --- Team members (unique users across all of user's projects) ---
        team_members = 0
        if project_ids:
            team_stmt = select(func.count(distinct(ProjectMember.user_id))).where(
                ProjectMember.project_id.in_(project_ids)
            )
            team_result = await self.db.execute(team_stmt)
            team_members = team_result.scalar_one() or 0

        return DashboardStatsResponse(
            total_projects=total_projects,
            active_projects=active_projects,
            my_tasks=my_tasks_count,
            my_tasks_completed=my_completed,
            my_tasks_in_progress=my_in_progress,
            overdue_tasks=overdue,
            due_this_week=due_this_week,
            hours_logged=hours_all_time,
            hours_this_month=hours_this_month,
            team_members=team_members,
        )

    async def get_projects_progress(self, user_id: str) -> DashboardProjectsResponse:
        """Get per-project progress summary for current user's projects."""

        # Get projects the user is member of
        stmt = (
            select(Project)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .where(ProjectMember.user_id == user_id)
            .order_by(Project.created_at.desc())
        )
        result = await self.db.execute(stmt)
        projects = result.scalars().all()

        now = datetime.utcnow()
        progress_list: List[ProjectProgressResponse] = []

        for project in projects:
            tasks_stmt = select(Task).where(Task.project_id == project.id)
            tasks_result = await self.db.execute(tasks_stmt)
            tasks = tasks_result.scalars().all()

            total = len(tasks)
            completed = sum(1 for t in tasks if t.status == TaskStatus.DONE)
            in_progress = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
            overdue = sum(
                1
                for t in tasks
                if t.due_date
                and t.due_date < now
                and t.status not in (TaskStatus.DONE, TaskStatus.CANCELLED)
            )
            progress_pct = (completed / total * 100) if total > 0 else 0.0

            progress_list.append(
                ProjectProgressResponse(
                    project_id=project.id,
                    name=project.name,
                    key=project.key,
                    status=project.status.value,
                    total_tasks=total,
                    completed_tasks=completed,
                    in_progress_tasks=in_progress,
                    overdue_tasks=overdue,
                    progress_percentage=round(progress_pct, 1),
                )
            )

        total_count = len(progress_list)
        active_count = sum(1 for p in projects if p.status == ProjectStatus.ACTIVE)
        completed_count = sum(1 for p in projects if p.status == ProjectStatus.COMPLETED)
        avg_progress = (
            round(sum(p.progress_percentage for p in progress_list) / total_count, 1)
            if total_count > 0
            else 0.0
        )

        return DashboardProjectsResponse(
            projects=progress_list,
            total=total_count,
            active=active_count,
            completed=completed_count,
            avg_progress=avg_progress,
        )
