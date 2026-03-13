"""Workflow template model definitions."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project


class WorkflowTemplateType(str, PyEnum):
    """Workflow template types."""

    SOFTWARE_DEVELOPMENT = "software_development"
    MARKETING_CAMPAIGN = "marketing_campaign"
    PRODUCT_LAUNCH = "product_launch"
    RESEARCH = "research"
    CUSTOM = "custom"


class WorkflowTemplate(Base):
    """Workflow template defining process structure."""

    __tablename__ = "workflow_templates"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    template_type: Mapped[WorkflowTemplateType] = mapped_column(default=WorkflowTemplateType.CUSTOM)

    # Owner - None means system template
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"))
    is_system_template: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Configuration
    configuration: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    stages: Mapped[List["WorkflowStage"]] = relationship(
        "WorkflowStage", back_populates="workflow", lazy="selectin", cascade="all, delete-orphan",
        order_by="WorkflowStage.position"
    )
    projects: Mapped[List["Project"]] = relationship(
        "Project", back_populates="workflow_template", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<WorkflowTemplate(id={self.id}, name={self.name})>"


class WorkflowStage(Base):
    """Individual stage within a workflow."""

    __tablename__ = "workflow_stages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workflow_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(7), default="#6366F1")

    # Stage gates
    entry_criteria: Mapped[dict] = mapped_column(JSONB, default=dict)
    exit_criteria: Mapped[dict] = mapped_column(JSONB, default=dict)
    approval_required: Mapped[bool] = mapped_column(Boolean, default=False)
    approver_role: Mapped[Optional[str]] = mapped_column(String(50))

    # Automated actions on stage transition
    automated_actions: Mapped[dict] = mapped_column(JSONB, default=dict)
    # e.g. {"on_enter": ["notify_stakeholders", "assign_tasks"], "on_exit": ["update_status"]}

    # Escalation
    max_duration_days: Mapped[Optional[int]] = mapped_column()
    escalation_rules: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    workflow: Mapped["WorkflowTemplate"] = relationship("WorkflowTemplate", back_populates="stages")
    transitions_from: Mapped[List["WorkflowTransition"]] = relationship(
        "WorkflowTransition", foreign_keys="WorkflowTransition.from_stage_id",
        back_populates="from_stage", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<WorkflowStage(id={self.id}, name={self.name}, pos={self.position})>"


class WorkflowTransition(Base):
    """Transition between workflow stages."""

    __tablename__ = "workflow_transitions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    from_stage_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_stages.id", ondelete="CASCADE"), nullable=False
    )
    to_stage_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_stages.id", ondelete="CASCADE"), nullable=False
    )
    # Conditions that must be met for transition
    conditions: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Actions triggered when transition happens
    actions: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Relationships
    from_stage: Mapped["WorkflowStage"] = relationship(
        "WorkflowStage", foreign_keys=[from_stage_id], back_populates="transitions_from"
    )
    to_stage: Mapped["WorkflowStage"] = relationship(
        "WorkflowStage", foreign_keys=[to_stage_id]
    )

    def __repr__(self) -> str:
        return f"<WorkflowTransition({self.from_stage_id} -> {self.to_stage_id})>"
