"""Project model definitions — extended for Enterprise features."""

import uuid
from datetime import date, datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.task import Task
    from app.models.milestone import Milestone
    from app.models.tenant import Tenant
    from app.models.workflow import WorkflowTemplate


class ProjectStatus(str, PyEnum):
    """Project lifecycle states."""

    DRAFT = "draft"
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class ProjectVisibility(str, PyEnum):
    """Project visibility enumeration."""

    PRIVATE = "private"
    INTERNAL = "internal"
    PUBLIC = "public"


class TemplateType(str, PyEnum):
    """Project template scope types."""

    ORGANIZATION = "organization"
    PERSONAL = "personal"
    SYSTEM = "system"


class PhaseStatus(str, PyEnum):
    """Phase status enumeration."""

    PLANNED = "planned"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectTemplate(Base):
    """Project template storing reusable project structures."""

    __tablename__ = "project_templates"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    template_type: Mapped[TemplateType] = mapped_column(default=TemplateType.ORGANIZATION)

    # Who created this template (null = system)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Template structure stored as JSONB for flexibility
    task_hierarchy: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Example: [{"name": "Setup", "subtasks": ["Repo setup", "CI/CD"], "estimated_days": 3}]
    milestone_definitions: Mapped[dict] = mapped_column(JSONB, default=dict)
    phase_definitions: Mapped[dict] = mapped_column(JSONB, default=dict)
    default_workflow_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("workflow_templates.id")
    )
    estimated_duration_days: Mapped[Optional[int]] = mapped_column()
    custom_fields_schema: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    projects: Mapped[List["Project"]] = relationship("Project", back_populates="template", lazy="noload")

    def __repr__(self) -> str:
        return f"<ProjectTemplate(id={self.id}, name={self.name}, type={self.template_type})>"


class Project(Base):
    """Enterprise project model."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    key: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    prd_url: Mapped[Optional[str]] = mapped_column(Text)
    github_url: Mapped[Optional[str]] = mapped_column(String(500))

    # --- Lifecycle & Status ---
    status: Mapped[ProjectStatus] = mapped_column(default=ProjectStatus.DRAFT, index=True)
    visibility: Mapped[ProjectVisibility] = mapped_column(default=ProjectVisibility.PRIVATE)

    # --- Timeline ---
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_start_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_end_date: Mapped[Optional[date]] = mapped_column(Date)

    # --- Owner ---
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    owner: Mapped["User"] = relationship("User", lazy="selectin")

    # --- Template & Workflow ---
    template_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("project_templates.id")
    )
    template: Mapped[Optional["ProjectTemplate"]] = relationship(
        "ProjectTemplate", back_populates="projects", lazy="selectin"
    )
    workflow_template_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("workflow_templates.id")
    )
    workflow_template: Mapped[Optional["WorkflowTemplate"]] = relationship(
        "WorkflowTemplate", back_populates="projects", lazy="selectin"
    )
    current_stage_id: Mapped[Optional[str]] = mapped_column(String(36))

    # --- Strategic Alignment (JSONB) ---
    objectives: Mapped[dict] = mapped_column(JSONB, default=list)
    key_results: Mapped[dict] = mapped_column(JSONB, default=list)
    success_criteria: Mapped[dict] = mapped_column(JSONB, default=list)

    # --- Organizational Context ---
    department: Mapped[Optional[str]] = mapped_column(String(100))
    business_unit: Mapped[Optional[str]] = mapped_column(String(100))
    client_name: Mapped[Optional[str]] = mapped_column(String(200))

    # --- Budget ---
    budget: Mapped[Optional[float]] = mapped_column(Float)
    budget_spent: Mapped[float] = mapped_column(Float, default=0.0)

    # --- Configuration (JSONB) ---
    settings: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "allow_task_creation": True,
            "allow_time_tracking": True,
            "default_task_status": "todo",
            "working_days": [1, 2, 3, 4, 5],
            "notification_rules": {"milestone_alert_days": 3},
            "access_control": {"allow_member_invite": True},
        },
    )
    custom_fields: Mapped[dict] = mapped_column(JSONB, default=dict)

    # --- Metrics (denormalized for performance) ---
    total_tasks: Mapped[int] = mapped_column(Integer, default=0)
    completed_tasks: Mapped[int] = mapped_column(Integer, default=0)
    in_progress_tasks: Mapped[int] = mapped_column(Integer, default=0)
    progress_percentage: Mapped[float] = mapped_column(Float, default=0.0)
    total_estimated_hours: Mapped[float] = mapped_column(Float, default=0.0)
    total_actual_hours: Mapped[float] = mapped_column(Float, default=0.0)

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # --- Relationships ---
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="projects")
    members: Mapped[List["ProjectMember"]] = relationship(
        "ProjectMember", back_populates="project", lazy="selectin", cascade="all, delete-orphan"
    )
    tasks: Mapped[List["Task"]] = relationship(
        "Task", back_populates="project", lazy="noload", cascade="all, delete-orphan"
    )
    phases: Mapped[List["ProjectPhase"]] = relationship(
        "ProjectPhase", back_populates="project", lazy="selectin",
        cascade="all, delete-orphan", order_by="ProjectPhase.position"
    )
    milestones: Mapped[List["Milestone"]] = relationship(
        "Milestone", back_populates="project", lazy="selectin",
        cascade="all, delete-orphan", order_by="Milestone.due_date"
    )
    prd_files: Mapped[List["ProjectPrdFile"]] = relationship(
        "ProjectPrdFile",
        back_populates="project",
        lazy="noload",
        cascade="all, delete-orphan",
    )

    @property
    def budget_utilization(self) -> float:
        if not self.budget or self.budget == 0:
            return 0.0
        return round((self.budget_spent / self.budget) * 100, 1)

    @property
    def is_over_budget(self) -> bool:
        return self.budget is not None and self.budget_spent > self.budget

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name={self.name}, key={self.key})>"


class ProjectMemberRole(str, PyEnum):
    """Project member role enumeration."""

    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    MEMBER = "member"
    VIEWER = "viewer"


class ProjectMember(Base):
    """Project membership model."""

    __tablename__ = "project_members"

    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), primary_key=True
    )
    role: Mapped[ProjectMemberRole] = mapped_column(default=ProjectMemberRole.MEMBER)
    permissions: Mapped[Optional[dict]] = mapped_column(JSONB)
    notification_settings: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "task_assigned": True,
            "task_commented": True,
            "status_changed": True,
            "deadline_approaching": True,
        },
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    invited_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="members", lazy="selectin")
    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="project_memberships", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<ProjectMember(project={self.project_id}, user={self.user_id}, role={self.role})>"


class ProjectPrdFile(Base):
    """Versioned PRD document attached to a project."""

    __tablename__ = "project_prd_files"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[Optional[str]] = mapped_column(String(255))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="prd_files")
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by], lazy="selectin")

    def __repr__(self) -> str:
        return f"<ProjectPrdFile(id={self.id}, project={self.project_id}, v={self.version})>"


class ProjectPhase(Base):
    """Project phase model for structured progression."""

    __tablename__ = "project_phases"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[PhaseStatus] = mapped_column(default=PhaseStatus.PLANNED, index=True)
    color: Mapped[str] = mapped_column(String(7), default="#6366F1")

    # Timeline
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_start_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_end_date: Mapped[Optional[date]] = mapped_column(Date)

    # Budget
    phase_budget: Mapped[Optional[float]] = mapped_column(Float)
    budget_spent: Mapped[float] = mapped_column(Float, default=0.0)

    # Phase owner
    owner_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))

    # Progress (0–100)
    progress_percentage: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="phases")
    owner: Mapped[Optional["User"]] = relationship("User", foreign_keys=[owner_id], lazy="selectin")
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="phase",
        lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<ProjectPhase(id={self.id}, name={self.name}, project={self.project_id})>"
