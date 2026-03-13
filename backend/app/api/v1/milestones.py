"""Milestone API routes."""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.milestone import MilestoneStatus, MilestoneType
from app.services.milestone import MilestoneService
from app.services.project import ProjectService

router = APIRouter()


class MilestoneCreate(BaseModel):
    project_id: str
    phase_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    milestone_type: MilestoneType = MilestoneType.DATE_BASED
    due_date: Optional[datetime] = None
    days_from_start: Optional[int] = None
    owner_id: Optional[str] = None
    requires_approval: bool = False
    condition_description: Optional[str] = None
    completion_percentage: float = 0.0
    criteria: dict = {}


class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[MilestoneStatus] = None
    due_date: Optional[datetime] = None
    completion_percentage: Optional[float] = None
    owner_id: Optional[str] = None
    condition_description: Optional[str] = None
    is_approved: Optional[bool] = None
    criteria: Optional[dict] = None


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    phase_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    milestone_type: MilestoneType
    status: MilestoneStatus
    due_date: Optional[datetime] = None
    completion_percentage: float
    risk_indicator: str
    requires_approval: bool
    is_approved: bool
    created_at: datetime
    updated_at: datetime


@router.post("", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
async def create_milestone(
    data: MilestoneCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a milestone for a project."""
    project_service = ProjectService(db)
    if not await project_service.is_project_member(data.project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    milestone_service = MilestoneService(db)
    milestone = await milestone_service.create(data.model_dump())
    return MilestoneResponse.model_validate(milestone)


@router.get("", response_model=List[MilestoneResponse])
async def list_milestones(
    project_id: str = Query(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all milestones for a project."""
    project_service = ProjectService(db)
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    milestone_service = MilestoneService(db)
    milestones = await milestone_service.list_by_project(project_id)
    return [MilestoneResponse.model_validate(m) for m in milestones]


@router.get("/{milestone_id}", response_model=MilestoneResponse)
async def get_milestone(
    milestone_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    milestone_service = MilestoneService(db)
    milestone = await milestone_service.get_by_id(milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return MilestoneResponse.model_validate(milestone)


@router.put("/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    milestone_id: str,
    data: MilestoneUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    milestone_service = MilestoneService(db)
    updated = await milestone_service.update(
        milestone_id, data.model_dump(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return MilestoneResponse.model_validate(updated)


@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    milestone_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    milestone_service = MilestoneService(db)
    success = await milestone_service.delete(milestone_id)
    if not success:
        raise HTTPException(status_code=404, detail="Milestone not found")
