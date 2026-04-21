"""Task model definitions."""

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    Column,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.project import Project, ProjectPhase
    from app.models.tenant import Tenant


class TaskStatus(str, PyEnum):
    """Task status enumeration."""

    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(str, PyEnum):
    """Task priority enumeration."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskType(str, PyEnum):
    """Task type enumeration."""

    TASK = "task"
    BUG = "bug"
    FEATURE = "feature"
    EPIC = "epic"
    STORY = "story"
    SUBTASK = "subtask"


class ActivityAction(str, PyEnum):
    """Task activity action types."""

    CREATED = "created"
    UPDATED = "updated"
    STATUS_CHANGED = "status_changed"
    PRIORITY_CHANGED = "priority_changed"
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    MOVED = "moved"
    COMMENTED = "commented"
    COMMENT_EDITED = "comment_edited"
    LABEL_ADDED = "label_added"
    LABEL_REMOVED = "label_removed"
    DUE_DATE_CHANGED = "due_date_changed"
    ATTACHMENT_ADDED = "attachment_added"
    DELETED = "deleted"


class DependencyType(str, PyEnum):
    """Task dependency type enumeration."""

    BLOCKS = "blocks"
    BLOCKED_BY = "blocked_by"
    RELATES_TO = "relates_to"
    DUPLICATES = "duplicates"


class TaskDependency(Base):
    """Task dependency mapping model."""

    __tablename__ = "task_dependencies"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    depends_on_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dependency_type: Mapped[DependencyType] = mapped_column(
        default=DependencyType.BLOCKS, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<TaskDependency(task={self.task_id}, depends_on={self.depends_on_id}, type={self.dependency_type})>"

    task: Mapped["Task"] = relationship(
        "Task", foreign_keys=[task_id], back_populates="dependencies"
    )
    depends_on: Mapped["Task"] = relationship(
        "Task", foreign_keys=[depends_on_id], back_populates="dependent_tasks"
    )

# Association table for task tags
task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", String(36), ForeignKey("tasks.id"), primary_key=True),
    Column("tag_id", String(36), ForeignKey("tags.id"), primary_key=True),
)

# Association table for kanban labels on tasks
task_label_table = Table(
    "task_labels",
    Base.metadata,
    Column("task_id", String(36), ForeignKey("tasks.id"), primary_key=True),
    Column("label_id", String(36), ForeignKey("kanban_labels.id"), primary_key=True),
)


class Tag(Base):
    """Tag model for categorization."""

    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6366F1")
    project_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("projects.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class KanbanLabel(Base):
    """Kanban label model for task categorization."""

    __tablename__ = "kanban_labels"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6366F1")
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<KanbanLabel(id={self.id}, name={self.name})>"


class Task(Base):
    """Task model for task management."""

    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Project & Phase
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=False, index=True
    )
    project: Mapped["Project"] = relationship(
        "Project", back_populates="tasks", lazy="selectin"
    )
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="tasks")

    phase_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("project_phases.id", ondelete="SET NULL"), index=True
    )
    phase: Mapped[Optional["ProjectPhase"]] = relationship(
        "ProjectPhase", back_populates="tasks", lazy="selectin"
    )

    # Parent/Subtask relationship
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("tasks.id"), index=True
    )
    parent: Mapped[Optional["Task"]] = relationship(
        "Task", remote_side="Task.id", back_populates="subtasks", lazy="selectin"
    )
    subtasks: Mapped[List["Task"]] = relationship(
        "Task", back_populates="parent", lazy="selectin", cascade="all, delete-orphan"
    )

    # Content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    task_type: Mapped[TaskType] = mapped_column(default=TaskType.TASK)

    # Status & Priority
    status: Mapped[TaskStatus] = mapped_column(default=TaskStatus.TODO, index=True)
    priority: Mapped[TaskPriority] = mapped_column(default=TaskPriority.MEDIUM, index=True)

    # Assignment
    primary_assignee_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    primary_assignee: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[primary_assignee_id], lazy="selectin"
    )
    
    reporter_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    reporter: Mapped["User"] = relationship(
        "User", foreign_keys=[reporter_id], back_populates="reported_tasks", lazy="selectin"
    )

    # Timeline
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, index=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Time tracking
    estimated_hours: Mapped[Optional[float]] = mapped_column(Float)
    actual_hours: Mapped[float] = mapped_column(Float, default=0.0)

    # Board positioning
    position: Mapped[float] = mapped_column(Float, default=0.0)
    board_column_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("board_columns.id")
    )

    # Custom fields & Priority Scoring calculations
    custom_fields: Mapped[dict] = mapped_column(JSONB, default=dict)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Workflow Binding
    workflow_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("task_workflows.id")
    )
    workflow_state_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("task_workflow_states.id")
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    tags: Mapped[List["Tag"]] = relationship("Tag", secondary=task_tags, lazy="selectin")
    labels: Mapped[List["KanbanLabel"]] = relationship(
        "KanbanLabel", secondary=task_label_table, lazy="selectin"
    )
    dependencies: Mapped[List["TaskDependency"]] = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.task_id",
        back_populates="task",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    dependent_tasks: Mapped[List["TaskDependency"]] = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.depends_on_id",
        back_populates="depends_on",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    comments: Mapped[List["TaskComment"]] = relationship(
        "TaskComment",
        back_populates="task",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="TaskComment.created_at",
    )
    time_entries: Mapped[List["TimeEntry"]] = relationship(
        "TimeEntry", back_populates="task", lazy="selectin", cascade="all, delete-orphan"
    )
    assignments: Mapped[List["TaskAssignment"]] = relationship(
        "TaskAssignment", back_populates="task", lazy="selectin", cascade="all, delete-orphan"
    )
    activity_logs: Mapped[List["TaskActivity"]] = relationship(
        "TaskActivity",
        back_populates="task",
        lazy="noload",   # Loaded on demand — avoids N+1 on board fetch
        cascade="all, delete-orphan",
        order_by="TaskActivity.created_at.desc()",
    )

    @property
    def assignee_ids(self) -> List[str]:
        """List of active assignee IDs."""
        return [a.user_id for a in self.assignments]

    @property
    def assignees(self) -> List["User"]:
        """List of assigned User objects."""
        return [a.user for a in self.assignments]

    @property
    def is_overdue(self) -> bool:
        """Check if task is overdue."""
        if self.due_date and self.status != TaskStatus.DONE:
            return datetime.utcnow() > self.due_date
        return False

    @property
    def progress_percentage(self) -> float:
        """Calculate task progress based on subtasks."""
        if not self.subtasks:
            return 100.0 if self.status == TaskStatus.DONE else 0.0
        completed = sum(1 for s in self.subtasks if s.status == TaskStatus.DONE)
        return (completed / len(self.subtasks)) * 100

    def __repr__(self) -> str:
        return f"<Task(id={self.id}, title={self.title[:30]}, status={self.status})>"


class TaskAssignment(Base):
    """Task assignment model — supports multiple assignees per task."""

    __tablename__ = "task_assignments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task: Mapped["Task"] = relationship("Task", back_populates="assignments")

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")

    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    assigned_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))

    def __repr__(self) -> str:
        return f"<TaskAssignment(task={self.task_id}, user={self.user_id})>"


class TaskActivity(Base):
    """Task activity log — records every change for audit history."""

    __tablename__ = "task_activity"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task: Mapped["Task"] = relationship("Task", back_populates="activity_logs")

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    user: Mapped["User"] = relationship("User", lazy="selectin")

    # project_id for fast project-scope activity queries
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id"), nullable=True, index=True
    )

    action: Mapped[ActivityAction] = mapped_column(nullable=False)

    # Human-readable description, e.g. "moved from To Do → In Progress"
    description: Mapped[str] = mapped_column(String(500), nullable=False)

    # Machine-readable extra data (old/new values, column names, etc.)
    activity_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self) -> str:
        return f"<TaskActivity(task={self.task_id}, action={self.action})>"


class TaskComment(Base):
    """Task comment model."""

    __tablename__ = "task_comments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task: Mapped["Task"] = relationship("Task", back_populates="comments", lazy="selectin")

    author_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    author: Mapped["User"] = relationship("User", foreign_keys=[author_id], lazy="selectin")

    content: Mapped[str] = mapped_column(Text, nullable=False)
    mentions: Mapped[List[str]] = mapped_column(JSONB, default=list)

    # For threaded comments
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("task_comments.id"), index=True
    )
    replies: Mapped[List["TaskComment"]] = relationship(
        "TaskComment",
        primaryjoin="TaskComment.parent_id == TaskComment.id",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Resolve/close thread
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    resolved_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self) -> str:
        return f"<TaskComment(id={self.id}, task={self.task_id}, author={self.author_id})>"


class TimeEntry(Base):
    """Time entry model for time tracking."""

    __tablename__ = "time_entries"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task: Mapped["Task"] = relationship("Task", back_populates="time_entries", lazy="selectin")

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    user: Mapped["User"] = relationship("User", back_populates="time_entries", lazy="selectin")

    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    is_billable: Mapped[bool] = mapped_column(Boolean, default=True)
    hourly_rate: Mapped[Optional[float]] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(50), default="manual")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self) -> str:
        return f"<TimeEntry(id={self.id}, task={self.task_id}, duration={self.duration_minutes}m)>"
