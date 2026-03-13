"""Dashboard response schemas."""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ProjectProgressResponse(BaseModel):
    """Per-project progress summary."""

    model_config = ConfigDict(from_attributes=True)

    project_id: str
    name: str
    key: str
    status: str
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    overdue_tasks: int
    progress_percentage: float


class DashboardStatsResponse(BaseModel):
    """Top-level dashboard stats for the current user."""

    total_projects: int
    active_projects: int
    my_tasks: int
    my_tasks_completed: int
    my_tasks_in_progress: int
    overdue_tasks: int
    due_this_week: int
    hours_logged: float  # total hours for current user (all time)
    hours_this_month: float
    team_members: int  # total unique members across user's projects


class DashboardProjectsResponse(BaseModel):
    """List of per-project progress."""

    projects: List[ProjectProgressResponse]
    total: int
    active: int
    completed: int
    avg_progress: float
