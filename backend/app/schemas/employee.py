"""Pydantic schemas for Employee profiles and Skills."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SkillCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    color: str
    parent_id: Optional[str] = None
    # Recursive children (populated from selectin relationship)
    children: List["SkillCategoryResponse"] = []

SkillCategoryResponse.model_rebuild()


class SkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    category: Optional[SkillCategoryResponse] = None
    is_active: bool


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category_id: Optional[str] = None
    description: Optional[str] = None


class UserSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    skill_id: str
    skill: SkillResponse
    proficiency_level: int   # 1-5
    validation_status: str
    validated_by: Optional[str] = None
    validated_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserSkillCreate(BaseModel):
    skill_id: str
    proficiency_level: int = Field(default=1, ge=1, le=5)
    notes: Optional[str] = None


class UserSkillUpdate(BaseModel):
    proficiency_level: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = None


class ValidateSkillRequest(BaseModel):
    validation_status: str  # "peer" or "certified"
    notes: Optional[str] = None


class SkillMatrixCell(BaseModel):
    """Single cell in the org-wide skill matrix."""
    skill_id: str
    skill_name: str
    proficiency_level: int
    validation_status: str


class SkillMatrixRow(BaseModel):
    """One row in the skill matrix (one employee)."""
    user_id: str
    full_name: str
    email: str
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    skills: List[SkillMatrixCell] = []


class SkillMatrixResponse(BaseModel):
    """Full org-wide skill matrix."""
    rows: List[SkillMatrixRow]
    skill_columns: List[SkillResponse]   # Ordered list of skill columns
    total_employees: int
    total_skills: int


class SkillMatchResult(BaseModel):
    """A user ranked for skill-based task assignment."""
    user_id: str
    full_name: str
    email: str
    avatar_url: Optional[str] = None
    department: Optional[str] = None
    match_score: float       # 0.0 – 1.0 (higher = better match)
    matched_skills: List[SkillMatrixCell] = []
    missing_skills: List[str] = []      # Skill names the user is missing


class EmployeeProfileResponse(BaseModel):
    """Full employee profile including user + extended fields + skills."""
    model_config = ConfigDict(from_attributes=True)

    # From User model
    id: str
    email: str
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    is_active: bool
    # From EmployeeProfile
    title: Optional[str] = None
    department: Optional[str] = None
    hire_date: Optional[datetime] = None
    location: Optional[str] = None
    preferences: dict = {}
    # Skills
    skills: List[UserSkillResponse] = []


class EmployeeProfileUpdate(BaseModel):
    """Fields that can be updated on an employee's professional profile."""
    title: Optional[str] = Field(None, max_length=150)
    department: Optional[str] = Field(None, max_length=100)
    hire_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=150)
    preferences: Optional[dict] = None


class EmployeeListResponse(BaseModel):
    """Paginated list of employees for the org directory."""
    items: List[EmployeeProfileResponse]
    total: int
    page: int
    per_page: int
