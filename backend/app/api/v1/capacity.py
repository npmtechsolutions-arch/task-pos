"""Capacity and workload API routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.org_team import OrgTeamMember
from app.schemas.capacity import (
    SmartAssignmentResponse,
    TeamWorkloadResponse,
    UserAvailabilityCreate,
    UserAvailabilityResponse,
    UserCapacityResponse,
    UserCapacityUpdate,
    WorkloadResponse,
)
from app.services.capacity import CapacityService

logger = get_logger(__name__)
router = APIRouter()


@router.get("/users/{user_id}/capacity", response_model=UserCapacityResponse)
async def get_user_capacity(
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = CapacityService(db)
    cap = await svc.get_or_create_capacity(user_id)
    overhead_factor = 1 - cap.overhead_percentage / 100
    return UserCapacityResponse(
        user_id=cap.user_id,
        daily_hours=cap.daily_hours,
        weekly_hours=cap.weekly_hours,
        overhead_percentage=cap.overhead_percentage,
        effective_daily_hours=round(cap.daily_hours * overhead_factor, 2),
        effective_weekly_hours=round(cap.weekly_hours * overhead_factor, 2),
    )


@router.put("/users/{user_id}/capacity", response_model=UserCapacityResponse)
async def update_user_capacity(
    user_id: str,
    data: UserCapacityUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user.id and current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    svc = CapacityService(db)
    cap = await svc.update_capacity(user_id, data)
    overhead_factor = 1 - cap.overhead_percentage / 100
    return UserCapacityResponse(
        user_id=cap.user_id,
        daily_hours=cap.daily_hours,
        weekly_hours=cap.weekly_hours,
        overhead_percentage=cap.overhead_percentage,
        effective_daily_hours=round(cap.daily_hours * overhead_factor, 2),
        effective_weekly_hours=round(cap.weekly_hours * overhead_factor, 2),
    )


@router.get("/users/{user_id}/workload", response_model=WorkloadResponse)
async def get_user_workload(
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Improvement 8: users can only view their own workload unless admin/manager/owner."""
    if user_id != current_user.id and current_user.role.value not in ("admin", "owner", "manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own workload.",
        )
    svc = CapacityService(db)
    try:
        return await svc.get_user_workload(user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/teams/{team_id}/workload", response_model=TeamWorkloadResponse)
async def get_team_workload(
    team_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Improvement 8: team workload restricted to managers and admins only."""
    if current_user.role.value not in ("admin", "owner", "manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and admins can view team workload.",
        )
    from sqlalchemy import select
    team_result = await db.execute(
        select(OrgTeamMember).where(OrgTeamMember.team_id == team_id)
    )
    members = team_result.scalars().all()
    if not members:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found or has no members")
    # Improvement 8: verify current user is actually in this team OR is an admin
    team_user_ids = {m.user_id for m in members}
    if current_user.id not in team_user_ids and current_user.role.value not in ("admin", "owner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this team to view its workload.",
        )
    svc = CapacityService(db)
    data = await svc.get_team_workload(list(team_user_ids), team_name=f"Team {team_id[:8]}")
    return TeamWorkloadResponse(**data)


@router.post("/users/{user_id}/availability", response_model=UserAvailabilityResponse, status_code=status.HTTP_201_CREATED)
async def set_user_availability(
    user_id: str,
    data: UserAvailabilityCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user.id and current_user.role.value not in ("admin", "owner"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    svc = CapacityService(db)
    avail = await svc.set_availability(user_id, data)
    return UserAvailabilityResponse.model_validate(avail)


@router.get("/users/{user_id}/availability", response_model=List[UserAvailabilityResponse])
async def get_user_availability(
    user_id: str,
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date
    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    svc = CapacityService(db)
    records = await svc.get_availability_range(user_id, start, end)
    return [UserAvailabilityResponse.model_validate(r) for r in records]


@router.get("/recommend")
async def recommend_assignees(
    task_id: str = Query(...),
    top_n: int = Query(5, ge=1, le=20),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Smart assignment: rank users by skill match + availability + workload."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.task import Task
    task_result = await db.execute(
        select(Task).options(selectinload(Task.labels)).where(Task.id == task_id)
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    svc = CapacityService(db)
    candidates = await svc.recommend_assignees(task_id, top_n=top_n)
    required_skills = [lbl.name for lbl in (task.labels or [])]
    return SmartAssignmentResponse(
        task_id=task_id,
        task_title=task.title,
        required_skills=required_skills,
        candidates=candidates,
    )
