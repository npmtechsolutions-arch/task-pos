"""Project Phases API routes."""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, get_db
from app.models.project import PhaseStatus, ProjectPhase
from app.services.project import ProjectService

router = APIRouter()


class PhaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    position: int = 0
    color: str = "#6366F1"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    phase_budget: Optional[float] = None
    owner_id: Optional[str] = None


class PhaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[PhaseStatus] = None
    color: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    phase_budget: Optional[float] = None
    budget_spent: Optional[float] = None
    progress_percentage: Optional[float] = None
    owner_id: Optional[str] = None


class PhaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    position: int
    status: PhaseStatus
    color: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    phase_budget: Optional[float] = None
    budget_spent: float
    progress_percentage: float
    owner_id: Optional[str] = None


@router.post("/{project_id}/phases", response_model=PhaseResponse, status_code=status.HTTP_201_CREATED)
async def create_phase(
    project_id: str,
    data: PhaseCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a phase within a project."""
    project_service = ProjectService(db)
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    phase = ProjectPhase(project_id=project_id, **data.model_dump())
    db.add(phase)
    await db.commit()
    await db.refresh(phase)
    return PhaseResponse.model_validate(phase)


@router.get("/{project_id}/phases", response_model=List[PhaseResponse])
async def list_phases(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all phases of a project."""
    project_service = ProjectService(db)
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(ProjectPhase)
        .where(ProjectPhase.project_id == project_id)
        .order_by(ProjectPhase.position)
    )
    return [PhaseResponse.model_validate(p) for p in result.scalars().all()]


@router.put("/phases/{phase_id}", response_model=PhaseResponse)
async def update_phase(
    phase_id: str,
    data: PhaseUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a project phase."""
    result = await db.execute(select(ProjectPhase).where(ProjectPhase.id == phase_id))
    phase = result.scalar_one_or_none()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")

    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(phase, key, val)
    await db.commit()
    await db.refresh(phase)
    return PhaseResponse.model_validate(phase)


@router.delete("/phases/{phase_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_phase(
    phase_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a project phase."""
    result = await db.execute(select(ProjectPhase).where(ProjectPhase.id == phase_id))
    phase = result.scalar_one_or_none()
    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")
    await db.delete(phase)
    await db.commit()
