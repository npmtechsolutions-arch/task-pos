"""Dashboard API router."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.schemas.dashboard import DashboardStatsResponse, DashboardProjectsResponse
from app.services.dashboard import DashboardService

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardStatsResponse:
    """
    Aggregate dashboard statistics for the current user.

    Returns:
    - total_projects / active_projects
    - my_tasks, completed, in_progress, overdue, due_this_week
    - hours_logged (all time) / hours_this_month
    - team_members (across all projects user belongs to)
    """
    service = DashboardService(db)
    return await service.get_stats(current_user.id)


@router.get("/projects", response_model=DashboardProjectsResponse)
async def get_dashboard_projects(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardProjectsResponse:
    """
    Get per-project progress for all projects the current user belongs to.

    Returns project list with task counts and progress percentages.
    """
    service = DashboardService(db)
    return await service.get_projects_progress(current_user.id)
