"""Pydantic schemas for Capacity Planning and Workload."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.capacity import AvailabilityStatus


class UserCapacityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    daily_hours: float
    weekly_hours: float
    overhead_percentage: float
    # Effective available hours (after overhead deduction)
    effective_daily_hours: float = 0.0
    effective_weekly_hours: float = 0.0


class UserCapacityUpdate(BaseModel):
    daily_hours: Optional[float] = Field(None, ge=1.0, le=24.0)
    weekly_hours: Optional[float] = Field(None, ge=1.0, le=168.0)
    overhead_percentage: Optional[float] = Field(None, ge=0.0, le=100.0)


class UserAvailabilityCreate(BaseModel):
    availability_date: date
    status: AvailabilityStatus
    available_hours: Optional[float] = Field(None, ge=0.0, le=24.0)
    notes: Optional[str] = None


class UserAvailabilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    availability_date: date
    status: AvailabilityStatus
    available_hours: Optional[float] = None
    notes: Optional[str] = None


class AllocationBreakdown(BaseModel):
    """Per-project allocation for the workload response."""
    project_id: str
    project_name: str
    allocated_hours: float
    task_count: int


class WorkloadResponse(BaseModel):
    """Current workload and utilization for a single user."""
    user_id: str
    full_name: str
    avatar_url: Optional[str] = None
    # Capacity
    capacity_hours_per_week: float
    effective_capacity_hours: float
    # Current allocation (based on open tasks' estimated_hours)
    allocated_hours: float
    utilization_percentage: float       # 0–100+
    available_hours: float              # Can go negative (overloaded)
    is_overloaded: bool
    # Breakdown
    project_breakdown: List[AllocationBreakdown] = []
    open_task_count: int


class TeamWorkloadResponse(BaseModel):
    """Team-level workload overview."""
    team_id: Optional[str] = None
    team_name: str
    members: List[WorkloadResponse]
    overloaded_count: int
    avg_utilization: float


class SmartAssignmentCandidate(BaseModel):
    """A ranked candidate for smart task assignment."""
    user_id: str
    full_name: str
    email: str
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    # Scoring components
    overall_score: float              # 0.0–1.0 (higher = better)
    skill_match_score: float
    availability_score: float
    workload_score: float
    # Details
    matched_skill_count: int
    utilization_percentage: float
    available_hours: float
    matched_skills: List[str] = []    # Names of matched skills
    missing_skills: List[str] = []


class SmartAssignmentResponse(BaseModel):
    """Ranked list of recommended assignees for a task."""
    task_id: str
    task_title: str
    required_skills: List[str]
    candidates: List[SmartAssignmentCandidate]


class AvailabilityRangeRequest(BaseModel):
    start_date: date
    end_date: date
