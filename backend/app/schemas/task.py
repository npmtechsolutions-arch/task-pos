"""Task schemas for request/response validation."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.task import DependencyType, TaskPriority, TaskStatus, TaskType
from app.schemas.user import UserResponse


class TagBase(BaseModel):
    """Base tag schema."""

    name: str = Field(..., min_length=1, max_length=100)
    color: str = "#6366F1"


class TagCreate(TagBase):
    """Tag creation schema."""

    project_id: Optional[str] = None


class TagResponse(TagBase):
    """Tag response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: Optional[str] = None
    created_at: datetime


class TaskDependencyCreate(BaseModel):
    """Task dependency creation schema."""

    depends_on_id: str
    dependency_type: DependencyType = DependencyType.BLOCKS


class TaskDependencyResponse(BaseModel):
    """Task dependency response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    depends_on_id: str
    dependency_type: DependencyType
    created_at: datetime


class TaskCommentBase(BaseModel):
    """Base task comment schema."""

    content: str = Field(..., min_length=1)


class TaskCommentCreate(TaskCommentBase):
    """Task comment creation schema."""

    parent_id: Optional[str] = None


class TaskCommentUpdate(BaseModel):
    """Task comment update schema."""

    content: str = Field(..., min_length=1)


class TaskCommentResponse(TaskCommentBase):
    """Task comment response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    author_id: str
    author: UserResponse
    mentions: List[str]
    is_edited: bool
    edited_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class TimeEntryBase(BaseModel):
    """Base time entry schema."""

    description: Optional[str] = None
    is_billable: bool = True


class TimeEntryCreate(TimeEntryBase):
    """Time entry creation schema."""

    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: int = 0


class TimeEntryUpdate(BaseModel):
    """Time entry update schema."""

    description: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    is_billable: Optional[bool] = None


class TimeEntryResponse(TimeEntryBase):
    """Time entry response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    user_id: str
    user: UserResponse
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: int
    source: str
    created_at: datetime


class TaskBase(BaseModel):
    """Base task schema."""

    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    task_type: TaskType = TaskType.TASK
    priority: TaskPriority = TaskPriority.MEDIUM


class TaskCreate(TaskBase):
    """Task creation schema."""

    project_id: str
    parent_id: Optional[str] = None
    primary_assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
    start_date: Optional[date] = None
    estimated_hours: Optional[float] = None
    tag_ids: Optional[List[str]] = None
    custom_fields: Optional[dict] = None


class TaskUpdate(BaseModel):
    """Task update schema."""

    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    primary_assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
    start_date: Optional[date] = None
    estimated_hours: Optional[float] = None
    tag_ids: Optional[List[str]] = None
    custom_fields: Optional[dict] = None


class TaskMoveRequest(BaseModel):
    """Task move request schema."""

    board_column_id: Optional[str] = None
    new_position: float


class TaskResponse(TaskBase):
    """Task response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    parent_id: Optional[str] = None
    status: TaskStatus
    primary_assignee_id: Optional[str] = None
    primary_assignee: Optional[UserResponse] = None
    reporter_id: str
    reporter: UserResponse
    due_date: Optional[datetime] = None
    start_date: Optional[date] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: float
    position: float
    board_column_id: Optional[str] = None
    priority_score: float
    workflow_id: Optional[str] = None
    workflow_state_id: Optional[str] = None
    custom_fields: dict
    tags: List[TagResponse]
    is_overdue: bool
    progress_percentage: float
    created_at: datetime
    updated_at: datetime


class TaskDetailResponse(TaskResponse):
    """Detailed task response with comments and subtasks."""

    subtasks: List["TaskResponse"]
    comments: List[TaskCommentResponse]
    dependencies: List[TaskDependencyResponse]


class TaskListResponse(BaseModel):
    """Task list response schema."""

    items: List[TaskResponse]
    total: int
    page: int
    per_page: int


class TaskFilterParams(BaseModel):
    """Task filter parameters."""

    project_id: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    primary_assignee_id: Optional[str] = None
    reporter_id: Optional[str] = None
    search: Optional[str] = None
    due_before: Optional[datetime] = None
    due_after: Optional[datetime] = None
    tag_ids: Optional[List[str]] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)
    sort_by: str = "created_at"
    sort_order: str = "desc"


class TaskBatchUpdateRequest(BaseModel):
    """Batch update request schema."""

    task_ids: List[str]
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
