"""Project schemas for request/response validation."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.project import ProjectStatus, ProjectVisibility, ProjectMemberRole
from app.schemas.user import UserResponse


class ProjectBase(BaseModel):
    """Base project schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    key: str = Field(..., min_length=2, max_length=20)


class ProjectCreate(ProjectBase):
    """Project creation schema."""

    visibility: ProjectVisibility = ProjectVisibility.PRIVATE
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    settings: Optional[dict] = None
    tenant_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Project update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    visibility: Optional[ProjectVisibility] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    settings: Optional[dict] = None
    custom_fields: Optional[dict] = None


class ProjectMemberBase(BaseModel):
    """Base project member schema."""

    user_id: str
    role: ProjectMemberRole = ProjectMemberRole.MEMBER


class ProjectMemberCreate(ProjectMemberBase):
    """Project member creation schema."""

    notification_settings: Optional[dict] = None


class ProjectMemberUpdate(BaseModel):
    """Project member update schema."""

    role: Optional[ProjectMemberRole] = None
    notification_settings: Optional[dict] = None


class ProjectMemberResponse(BaseModel):
    """Project member response schema."""

    model_config = ConfigDict(from_attributes=True)

    user_id: str
    role: ProjectMemberRole
    joined_at: datetime
    user: UserResponse


class ProjectResponse(ProjectBase):
    """Project response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    status: ProjectStatus
    visibility: ProjectVisibility
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    owner_id: str
    tenant_id: str
    owner: UserResponse
    settings: dict
    custom_fields: dict

    # Metrics
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    progress_percentage: float
    total_estimated_hours: float
    total_actual_hours: float

    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None


class ProjectDetailResponse(ProjectResponse):
    """Detailed project response with members."""

    members: List[ProjectMemberResponse]


class ProjectListResponse(BaseModel):
    """Project list response schema."""

    items: List[ProjectResponse]
    total: int
    page: int
    per_page: int


class ProjectFilterParams(BaseModel):
    """Project filter parameters."""

    status: Optional[ProjectStatus] = None
    visibility: Optional[ProjectVisibility] = None
    search: Optional[str] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)
