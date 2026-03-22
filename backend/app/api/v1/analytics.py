"""Analytics KPI and dashboard widget API routes."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.schemas.analytics import (
    ForecastResponse,
    OrgKPIResponse,
    ResourceReportResponse,
    TaskTrendResponse,
    TimeAnalyticsResponse,
    TopContributorsResponse,
)
from app.services.analytics import AnalyticsService, _invalidate_analytics_cache
from app.services.forecast import ForecastService

logger = get_logger(__name__)
router = APIRouter()


@router.get("/kpis", response_model=OrgKPIResponse)
async def get_org_kpis(
    force: bool = Query(False, description="Bypass 30-second cache (admin only)"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Org-level KPIs: project health, task throughput, utilization.
    Cached 30 seconds. Returns < 200ms on cache hit.
    """
    if force and current_user.role.value not in ("admin", "owner"):
        force = False   # silently ignore for non-admins
    svc = AnalyticsService(db)
    return await svc.get_org_kpis(force=force)


@router.get("/task-trend", response_model=TaskTrendResponse)
async def get_task_trend(
    days: int = Query(30, ge=7, le=365, description="Number of past days"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Daily task completion vs creation trend for line chart visualisation."""
    svc = AnalyticsService(db)
    return await svc.get_task_trend(days=days)


@router.get("/contributors", response_model=TopContributorsResponse)
async def get_top_contributors(
    days: int = Query(30, ge=7, le=365),
    limit: int = Query(10, ge=1, le=50),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Top contributors ranked by completed tasks (single JOIN+GROUP BY query)."""
    svc = AnalyticsService(db)
    return await svc.get_top_contributors(days=days, limit=limit)


@router.get("/time", response_model=TimeAnalyticsResponse)
async def get_time_analytics(
    days: int = Query(30, ge=1, le=365),
    user_id: Optional[str] = Query(None, description="Filter to a specific user"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Time analytics: billable vs non-billable, estimation accuracy per project."""
    # Non-admins can only see their own data
    if user_id and user_id != current_user.id and current_user.role.value not in ("admin", "owner", "manager"):
        user_id = current_user.id
    svc = AnalyticsService(db)
    return await svc.get_time_analytics(days=days, user_id=user_id)


@router.get("/resource", response_model=ResourceReportResponse)
async def get_resource_report(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resource allocation vs capacity for all active users. Cached 60 seconds."""
    svc = AnalyticsService(db)
    return await svc.get_resource_report()


@router.get("/forecast", response_model=ForecastResponse)
async def get_forecast(
    weeks: int = Query(8, ge=1, le=26),
    user_id: Optional[str] = Query(None, description="Per-user forecast (omit for org-level)"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Week-by-week resource forecast: predicted load vs capacity."""
    svc = ForecastService(db)
    if user_id:
        return await svc.get_user_forecast(user_id=user_id, weeks=weeks)
    return await svc.get_org_forecast(weeks=weeks)


@router.get("/widgets")
async def get_all_widgets(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    All widget data in a single call — reduces frontend waterfall requests.
    Returns KPIs + 30-day trend + top 5 contributors.
    """
    svc = AnalyticsService(db)
    kpis, trend, contributors = await __import__("asyncio").gather(
        svc.get_org_kpis(),
        svc.get_task_trend(days=30),
        svc.get_top_contributors(days=30, limit=5),
    )
    return {
        "kpis": kpis,
        "task_trend": trend,
        "top_contributors": contributors,
    }
