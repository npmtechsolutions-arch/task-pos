"""Timesheet schemas for request/response validation."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.timesheet import ActivityType, TimesheetStatus
from app.schemas.user import UserResponse


# ─── Entry Schemas ─────────────────────────────────────────────────────────────

class TimesheetEntryCreate(BaseModel):
    """Create a new time entry."""
    date_logged: date
    hours: float = Field(..., gt=0, le=24, description="Hours worked (0–24)")
    description: Optional[str] = Field(None, max_length=1000)
    activity_type: ActivityType = ActivityType.DEVELOPMENT
    is_billable: bool = True
    task_id: Optional[str] = None
    project_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class TimesheetEntryUpdate(BaseModel):
    """Update an existing entry (partial)."""
    hours: Optional[float] = Field(None, gt=0, le=24)
    description: Optional[str] = Field(None, max_length=1000)
    activity_type: Optional[ActivityType] = None
    is_billable: Optional[bool] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class TaskSummary(BaseModel):
    """Minimal task info for entries."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str


class ProjectSummary(BaseModel):
    """Minimal project info for entries."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str


class TimesheetEntryResponse(BaseModel):
    """Full time entry response."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    timesheet_id: str
    tenant_id: str
    date_logged: date
    hours: float
    description: Optional[str] = None
    activity_type: ActivityType
    is_billable: bool
    task_id: Optional[str] = None
    project_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    task: Optional[TaskSummary] = None
    project: Optional[ProjectSummary] = None
    created_at: datetime
    updated_at: datetime


# ─── Timesheet Schemas ─────────────────────────────────────────────────────────

class TimesheetCreate(BaseModel):
    """Create a new timesheet for a period."""
    period_start: date
    period_end: date

    @field_validator('period_end')
    @classmethod
    def end_after_start(cls, v, info):
        if info.data.get('period_start') and v < info.data['period_start']:
            raise ValueError('period_end must be after period_start')
        return v


class TimesheetRejectRequest(BaseModel):
    """Admin rejection with mandatory reason."""
    reason: str = Field(..., min_length=5, max_length=500)


class TimesheetResponse(BaseModel):
    """Timesheet response without entries (list view)."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    user_id: str
    period_start: date
    period_end: date
    status: TimesheetStatus
    total_hours: float
    billable_hours: float
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    approved_by_id: Optional[str] = None
    user: Optional[UserResponse] = None
    approver: Optional[UserResponse] = None
    created_at: datetime
    updated_at: datetime


class TimesheetDetailResponse(TimesheetResponse):
    """Full timesheet with all entries."""
    entries: List[TimesheetEntryResponse] = Field(default_factory=list)


class TimesheetListResponse(BaseModel):
    """Paginated timesheet list."""
    items: List[TimesheetResponse]
    total: int
    page: int
    per_page: int


# ─── Report Schemas ───────────────────────────────────────────────────────────

class UserHoursSummary(BaseModel):
    """Per-user hours report."""
    user_id: str
    full_name: str
    total_hours: float
    billable_hours: float
    non_billable_hours: float
    timesheet_count: int


class ProjectHoursSummary(BaseModel):
    """Per-project hours report."""
    project_id: str
    project_name: str
    total_hours: float
    billable_hours: float
    user_count: int


class TimesheetReportResponse(BaseModel):
    """Admin analytics report."""
    period_start: date
    period_end: date
    total_hours: float
    billable_hours: float
    non_billable_hours: float
    submitted_count: int
    approved_count: int
    pending_count: int
    by_user: List[UserHoursSummary]
    by_project: List[ProjectHoursSummary]
