"""Pydantic schemas for Analytics & Reporting module."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.analytics import ExportFormat, ReportFrequency, RetentionTier


# ── Report Definition (safe query DSL) ────────────────────────────────────────

class ReportFilter(BaseModel):
    field: str
    op: str = Field(..., pattern="^(=|!=|in|gte|lte|contains)$")
    value: Any


class ReportAggregation(BaseModel):
    func: str = Field(..., pattern="^(count|sum|avg|min|max)$")
    field: str
    alias: Optional[str] = None


class DateRange(BaseModel):
    field: str
    start: Optional[datetime] = None
    end: Optional[datetime] = None


class ReportDefinition(BaseModel):
    """Safe client-submitted report specification (no raw SQL accepted)."""
    entity: str = Field(..., pattern="^(tasks|projects|timesheets|users|time_entries)$")
    filters: List[ReportFilter] = []
    group_by: List[str] = []
    aggregations: List[ReportAggregation] = []
    calculated_fields: List[str] = []   # e.g. ["efficiency", "billable_ratio"]
    date_range: Optional[DateRange] = None
    order_by: Optional[str] = None
    order_dir: str = Field("desc", pattern="^(asc|desc)$")
    limit: int = Field(1000, ge=1, le=5000)


# ── Saved Report CRUD Schemas ─────────────────────────────────────────────────

class SavedReportCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    definition: ReportDefinition
    is_public: bool = False
    shared_with: List[str] = []


class SavedReportUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    definition: Optional[ReportDefinition] = None
    is_public: Optional[bool] = None
    shared_with: Optional[List[str]] = None


class SavedReportResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    definition: Dict[str, Any]
    owner_id: str
    is_public: bool
    shared_with: List[str]
    last_run_at: Optional[datetime]
    run_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Schedule Schemas ──────────────────────────────────────────────────────────

class ReportScheduleCreate(BaseModel):
    frequency: ReportFrequency
    timezone: str = "UTC"
    hour: int = Field(8, ge=0, le=23)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    recipient_emails: List[str] = []
    export_format: ExportFormat = ExportFormat.CSV


class ReportScheduleResponse(BaseModel):
    id: str
    report_id: str
    frequency: str
    timezone: str
    hour: int
    recipient_emails: List[str]
    export_format: str
    is_active: bool
    next_run_at: Optional[datetime]
    last_run_at: Optional[datetime]
    last_run_status: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Archive Schemas ───────────────────────────────────────────────────────────

class ReportArchiveResponse(BaseModel):
    id: str
    report_id: str
    row_count: int
    export_format: str
    retention_tier: str
    triggered_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Export Request ────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    definition: ReportDefinition
    format: ExportFormat = ExportFormat.CSV
    title: Optional[str] = "Report Export"


# ── KPI / Analytics Response Schemas ─────────────────────────────────────────

class ProjectHealthStats(BaseModel):
    total: int
    active: int
    on_track: int
    at_risk: int
    overdue_projects: int
    completed: int
    on_time_rate: float           # % of completed on or before due date


class TaskThroughput(BaseModel):
    completed_this_week: int
    completed_this_month: int
    avg_completion_days: float    # avg days from created → done


class OrgKPIResponse(BaseModel):
    project_health: ProjectHealthStats
    task_throughput: TaskThroughput
    total_users: int
    active_users_this_month: int
    avg_utilization_pct: float
    total_hours_this_month: float
    overdue_tasks: int
    generated_at: datetime


class TaskTrendPoint(BaseModel):
    date: str            # YYYY-MM-DD
    completed: int
    created: int
    overdue_delta: int   # new overdue items that day


class TaskTrendResponse(BaseModel):
    days: int
    points: List[TaskTrendPoint]


class ContributorRow(BaseModel):
    user_id: str
    full_name: str
    avatar_url: Optional[str]
    email: str
    completed_tasks: int
    total_tasks: int
    hours_logged: float
    efficiency: float    # completed / total, 0-1


class TopContributorsResponse(BaseModel):
    contributors: List[ContributorRow]
    period_days: int


# ── Time Analytics Schemas ────────────────────────────────────────────────────

class ProjectTimeRow(BaseModel):
    project_id: str
    project_name: str
    total_hours: float
    billable_hours: float
    non_billable_hours: float
    billable_ratio: float
    estimated_hours: float
    estimation_accuracy: float   # actual / estimated, 1.0 = perfect


class TimeAnalyticsResponse(BaseModel):
    period_days: int
    total_hours: float
    billable_hours: float
    non_billable_hours: float
    billable_ratio: float
    projects: List[ProjectTimeRow]


# ── Resource Report Schemas ───────────────────────────────────────────────────

class ResourceRow(BaseModel):
    user_id: str
    full_name: str
    avatar_url: Optional[str]
    capacity_hours: float
    allocated_hours: float
    utilization_pct: float
    is_overloaded: bool
    available_hours: float


class ResourceReportResponse(BaseModel):
    generated_at: datetime
    total_users: int
    avg_utilization_pct: float
    overloaded_count: int
    users: List[ResourceRow]


# ── Forecast Schemas ──────────────────────────────────────────────────────────

class ForecastWeek(BaseModel):
    week_start: str        # YYYY-MM-DD (Monday)
    predicted_hours: float
    capacity_hours: float
    surplus_hours: float   # negative = shortage
    overloaded_users: List[str]


class ForecastResponse(BaseModel):
    user_id: Optional[str]          # None = org-level
    weeks: int
    forecast: List[ForecastWeek]
