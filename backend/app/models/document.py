"""Document and task attachment models for PRD upload system."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.task import Task
    from app.models.project import Project


class DocumentStatus(str, PyEnum):
    """Document processing status."""
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class Document(Base):
    """Uploaded PRD document — links to a project and stores extracted text."""

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    uploaded_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )

    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)

    # AI-extracted content
    extracted_text: Mapped[Optional[str]] = mapped_column(Text)
    extracted_project_name: Mapped[Optional[str]] = mapped_column(String(255))
    tasks_generated: Mapped[int] = mapped_column(Integer, default=0)

    status: Mapped[DocumentStatus] = mapped_column(default=DocumentStatus.PENDING)

    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by], lazy="selectin")

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, name={self.file_name}, status={self.status})>"


class TaskFile(Base):
    """File attachment on a specific task."""

    __tablename__ = "task_files"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )

    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)

    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by], lazy="selectin")

    def __repr__(self) -> str:
        return f"<TaskFile(id={self.id}, task={self.task_id}, name={self.file_name})>"
