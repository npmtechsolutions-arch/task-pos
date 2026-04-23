"""Project schemas for request/response validation."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.project import ProjectStatus, ProjectVisibility, ProjectMemberRole
from app.schemas.user import UserResponse


class ProjectBase(BaseModel):
    """Base project schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    key: str = Field(..., min_length=2, max_length=20)
    prd_url: Optional[str] = None
    github_url: Optional[str] = Field(None, max_length=500)


class ProjectCreate(ProjectBase):
    """Project creation schema."""

    visibility: ProjectVisibility = ProjectVisibility.PRIVATE
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = None
    department: Optional[str] = Field(None, max_length=100)
    business_unit: Optional[str] = Field(None, max_length=100)
    settings: Optional[dict] = None
    tenant_id: Optional[str] = None

    @field_validator("github_url")
    @classmethod
    def github_must_be_github_com(cls, v: Optional[str]) -> Optional[str]:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        s = v.strip()
        if not (s.startswith("https://github.com/") or s.startswith("http://github.com/")):
            raise ValueError("GitHub URL must start with https://github.com/")
        return s


class ProjectUpdate(BaseModel):
    """Project update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    visibility: Optional[ProjectVisibility] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = None
    department: Optional[str] = Field(None, max_length=100)
    business_unit: Optional[str] = Field(None, max_length=100)
    github_url: Optional[str] = Field(None, max_length=500)
    settings: Optional[dict] = None
    custom_fields: Optional[dict] = None

    @field_validator("github_url")
    @classmethod
    def github_must_be_github_com(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        s = v.strip()
        if not (s.startswith("https://github.com/") or s.startswith("http://github.com/")):
            raise ValueError("GitHub URL must start with https://github.com/")
        return s


class ProjectMemberBase(BaseModel):
    """Base project member schema."""

    user_id: str
    role: ProjectMemberRole = ProjectMemberRole.MEMBER


class ProjectMemberCreate(ProjectMemberBase):
    """Project member creation schema."""

    notification_settings: Optional[dict] = None


class ProjectMembersBulkCreate(BaseModel):
    """Bulk add members to a project."""

    user_ids: List[str] = Field(..., min_length=1, max_length=50)
    role: ProjectMemberRole = ProjectMemberRole.MEMBER


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


class ProjectPrdFileResponse(BaseModel):
    """Latest / versioned PRD metadata (no direct file path)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    file_name: str
    version: int
    file_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    uploaded_by: str
    created_at: datetime


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
    budget: Optional[float] = None
    budget_spent: float = 0.0
    department: Optional[str] = None
    business_unit: Optional[str] = None
    prd_file: Optional[ProjectPrdFileResponse] = None

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
