"""Dashboard aggregation service."""

from datetime import datetime, timedelta
from typing import List

from sqlalchemy import func, select, and_, distinct, case, text
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
        try:
            await manager.send_to_user(
                user_id,
                {"type": "dashboard_update", "action": "reload"}
            )
        except Exception:
            # WebSocket broadcast failures must never crash the main request
            pass

    async def get_stats(self, user_id: str) -> DashboardStatsResponse:
        """Aggregate all dashboard stats for a user — single-pass approach."""

        now = datetime.utcnow()
        week_later = now + timedelta(days=7)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # --- Projects the user is a member of (single query) ---
        project_ids_stmt = select(ProjectMember.project_id).where(
            ProjectMember.user_id == user_id
        )
        project_ids_result = await self.db.execute(project_ids_stmt)
        project_ids = [r[0] for r in project_ids_result.fetchall()]

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

        # --- Task stats: all in one aggregated query (no Python loops) ---
        task_agg_stmt = select(
            func.count(Task.id).label("total"),
            func.count(case((Task.status == TaskStatus.DONE, 1))).label("completed"),
            func.count(case((Task.status == TaskStatus.IN_PROGRESS, 1))).label("in_progress"),
            func.count(case(
                (
                    and_(
                        Task.due_date != None,
                        Task.due_date < now,
                        Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
                    ),
                    1,
                )
            )).label("overdue"),
            func.count(case(
                (
                    and_(
                        Task.due_date != None,
                        Task.due_date >= now,
                        Task.due_date <= week_later,
                        Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
                    ),
                    1,
                )
            )).label("due_this_week"),
        ).where(Task.primary_assignee_id == user_id)

        task_result = await self.db.execute(task_agg_stmt)
        task_row = task_result.one()

        my_tasks_count = task_row.total or 0
        my_completed = task_row.completed or 0
        my_in_progress = task_row.in_progress or 0
        overdue = task_row.overdue or 0
        due_this_week = task_row.due_this_week or 0

        # --- Time entries (two queries, but fast with indexes) ---
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

        # --- Team members (single count query) ---
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
        """Get per-project progress summary — fixed N+1 using single aggregate query."""

        # Step 1: get projects the user is a member of
        stmt = (
            select(Project)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .where(ProjectMember.user_id == user_id)
            .order_by(Project.created_at.desc())
        )
        result = await self.db.execute(stmt)
        projects = result.scalars().all()

        if not projects:
            return DashboardProjectsResponse(
                projects=[], total=0, active=0, completed=0, avg_progress=0.0
            )

        project_id_list = [p.id for p in projects]
        now = datetime.utcnow()

        # Step 2: Single aggregated query for all projects at once (no Python loop)
        task_agg = (
            select(
                Task.project_id,
                func.count(Task.id).label("total"),
                func.count(case((Task.status == TaskStatus.DONE, 1))).label("completed"),
                func.count(case((Task.status == TaskStatus.IN_PROGRESS, 1))).label("in_progress"),
                func.count(case(
                    (
                        and_(
                            Task.due_date != None,
                            Task.due_date < now,
                            Task.status.not_in([TaskStatus.DONE, TaskStatus.CANCELLED]),
                        ),
                        1,
                    )
                )).label("overdue"),
            )
            .where(Task.project_id.in_(project_id_list))
            .group_by(Task.project_id)
        )

        agg_result = await self.db.execute(task_agg)
        # Build a lookup dict by project_id
        agg_map = {row.project_id: row for row in agg_result.all()}

        progress_list: List[ProjectProgressResponse] = []
        for project in projects:
            row = agg_map.get(project.id)
            total = row.total if row else 0
            completed = row.completed if row else 0
            in_progress = row.in_progress if row else 0
            overdue_count = row.overdue if row else 0
            progress_pct = round((completed / total * 100), 1) if total > 0 else 0.0

            progress_list.append(
                ProjectProgressResponse(
                    project_id=project.id,
                    name=project.name,
                    key=project.key,
                    status=project.status.value,
                    total_tasks=total,
                    completed_tasks=completed,
                    in_progress_tasks=in_progress,
                    overdue_tasks=overdue_count,
                    progress_percentage=progress_pct,
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
