"""Project Templates API routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, get_db
from app.models.project import ProjectTemplate, TemplateType

router = APIRouter()


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_type: TemplateType = TemplateType.ORGANIZATION
    task_hierarchy: dict = {}
    milestone_definitions: dict = {}
    phase_definitions: dict = {}
    default_workflow_id: Optional[str] = None
    estimated_duration_days: Optional[int] = None


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str] = None
    template_type: TemplateType
    task_hierarchy: dict
    milestone_definitions: dict
    phase_definitions: dict
    default_workflow_id: Optional[str] = None
    estimated_duration_days: Optional[int] = None


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: TemplateCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project template."""
    template = ProjectTemplate(created_by=current_user.id, **data.model_dump())
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateResponse.model_validate(template)


@router.get("", response_model=List[TemplateResponse])
async def list_templates(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List available project templates."""
    result = await db.execute(
        select(ProjectTemplate).where(
            (ProjectTemplate.template_type == TemplateType.SYSTEM) |
            (ProjectTemplate.template_type == TemplateType.ORGANIZATION) |
            (ProjectTemplate.created_by == current_user.id)
        )
    )
    return [TemplateResponse.model_validate(t) for t in result.scalars().all()]


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific project template."""
    result = await db.execute(select(ProjectTemplate).where(ProjectTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateResponse.model_validate(template)
