"""Reports schemas for request/response validation."""

from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ProjectProgressReport(BaseModel):
    """Project progress report."""

    project_id: str
    project_name: str
    project_key: str
    status: str
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    todo_tasks: int
    overdue_tasks: int
    progress_percentage: float
    total_estimated_hours: float
    total_actual_hours: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class UserTimeReport(BaseModel):
    """Time logged per user."""

    user_id: str
    full_name: str
    email: str
    avatar_url: Optional[str] = None
    total_minutes: int
    total_hours: float
    task_count: int


class TimeReportResponse(BaseModel):
    """Monthly time report response."""

    month: int
    year: int
    total_hours: float
    user_reports: List[UserTimeReport]


class OverviewReportResponse(BaseModel):
    """Full overview report across all projects."""

    total_projects: int
    active_projects: int
    completed_projects: int
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    overall_progress: float
    projects: List[ProjectProgressReport]
    top_contributors: List[UserTimeReport]
