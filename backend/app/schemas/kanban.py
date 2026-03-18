"""Kanban board schemas — tasks, comments, assignments, labels, activity."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.task import ActivityAction, TaskPriority, TaskStatus, TaskType


# ─── Label ──────────────────────────────────────────────────────────────────

class KanbanLabelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#6366F1", pattern=r"^#[0-9A-Fa-f]{6}$")
    project_id: Optional[str] = None


class KanbanLabelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    color: str
    project_id: Optional[str] = None
    created_at: datetime


# ─── Task Assignment ─────────────────────────────────────────────────────────

class AssigneeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    avatar_url: Optional[str] = None
    role: str


class TaskAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    user_id: str
    user: AssigneeResponse
    assigned_at: datetime


class TaskAssignRequest(BaseModel):
    user_id: str


# ─── Task Comment ─────────────────────────────────────────────────────────

class CommentAuthorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    avatar_url: Optional[str] = None


class TaskCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    mentions: List[str] = []
    parent_id: Optional[str] = None


class TaskCommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class TaskCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    author_id: str
    author: CommentAuthorResponse
    content: str
    mentions: List[str]
    parent_id: Optional[str] = None
    is_edited: bool
    edited_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PaginatedCommentsResponse(BaseModel):
    items: List[TaskCommentResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


# ─── Task Activity ────────────────────────────────────────────────────────

class ActivityUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    avatar_url: Optional[str] = None


class TaskActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    user_id: str
    user: ActivityUserResponse
    action: ActivityAction
    description: str
    metadata: dict
    created_at: datetime


class PaginatedActivityResponse(BaseModel):
    items: List[TaskActivityResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


# ─── Kanban Task Card ─────────────────────────────────────────────────────

class KanbanTaskCreate(BaseModel):
    """Create a new task card on the Kanban board."""
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    project_id: str
    board_column_id: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    task_type: TaskType = TaskType.TASK
    primary_assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    position: float = 0.0
    label_ids: List[str] = []


class KanbanTaskUpdate(BaseModel):
    """Update a Kanban task card."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    task_type: Optional[TaskType] = None
    primary_assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    board_column_id: Optional[str] = None
    position: Optional[float] = None


class KanbanCardMoveRequest(BaseModel):
    """Drag-and-drop card move payload."""
    task_id: str
    target_column_id: str
    new_position: float = 0.0
    source_column_id: Optional[str] = None


class KanbanTaskCardResponse(BaseModel):
    """Compact task card — returned when listing tasks on a board column."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    task_type: TaskType
    position: float
    board_column_id: Optional[str] = None
    project_id: str
    primary_assignee_id: Optional[str] = None
    assignee: Optional[AssigneeResponse] = None
    labels: List[KanbanLabelResponse] = []
    due_date: Optional[datetime] = None
    estimated_hours: Optional[float] = None
    actual_hours: float
    is_overdue: bool = False
    comment_count: int = 0
    assignee_count: int = 0
    created_at: datetime
    updated_at: datetime


class KanbanTaskDetailResponse(KanbanTaskCardResponse):
    """Full task detail — returned when opening a task card."""
    reporter_id: str
    reporter: Optional[AssigneeResponse] = None
    comments: List[TaskCommentResponse] = []
    assignments: List[TaskAssignmentResponse] = []
    subtask_count: int = 0
    progress_percentage: float = 0.0


class KanbanColumnWithTasksResponse(BaseModel):
    """Board column with its task cards — used for the full board view."""
    id: str
    name: str
    position: int
    color: str
    wip_limit: Optional[int] = None
    column_type: str
    tasks: List[KanbanTaskCardResponse] = []
    task_count: int = 0


class KanbanBoardViewResponse(BaseModel):
    """Full board view with all columns and their cards."""
    board_id: str
    board_name: str
    project_id: str
    columns: List[KanbanColumnWithTasksResponse]
    total_tasks: int
    wip_limits_enabled: bool = False


# ─── Bulk Reorder ─────────────────────────────────────────────────────────

class ColumnReorderRequest(BaseModel):
    """Reorder columns on a board."""
    column_ids: List[str]  # Ordered list


class TaskReorderRequest(BaseModel):
    """Reorder tasks within a column."""
    task_ids: List[str]  # Ordered list
