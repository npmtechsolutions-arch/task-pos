"""Task workflow models."""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TaskWorkflow(Base):
    """Custom task workflow definition (e.g. Bug Workflow vs Content Workflow)."""

    __tablename__ = "task_workflows"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500))
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    states: Mapped[List["TaskWorkflowState"]] = relationship(
        "TaskWorkflowState",
        back_populates="workflow",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="TaskWorkflowState.position",
    )


class TaskWorkflowState(Base):
    """Specific status steps inside a workflow."""

    __tablename__ = "task_workflow_states"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workflow_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workflow: Mapped["TaskWorkflow"] = relationship("TaskWorkflow", back_populates="states")

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6b7280")
    position: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(20), default="todo") # todo, in_progress, done
    
    # Enforced restrictions / automations
    entry_conditions: Mapped[dict] = mapped_column(JSONB, default=dict)
    exit_conditions: Mapped[dict] = mapped_column(JSONB, default=dict)
    allowed_transitions: Mapped[List[str]] = mapped_column(JSONB, default=list) # List of valid target state IDs

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
