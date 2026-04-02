"""Kanban board model definitions."""

import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.tenant import Tenant


class BoardColumnType(str, PyEnum):
    """Board column type enumeration."""

    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"
    ARCHIVE = "archive"


class Board(Base):
    """Kanban board model."""

    __tablename__ = "boards"
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id"),
        nullable=False,
        unique=True,
    )
    project: Mapped["Project"] = relationship("Project", lazy="selectin")

    name: Mapped[str] = mapped_column(String(255), default="Board")

    # Configuration
    settings: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "wip_limits_enabled": False,
            "swimlanes_enabled": False,
            "show_card_cover": True,
            "compact_mode": False,
        },
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    columns: Mapped[List["BoardColumn"]] = relationship(
        "BoardColumn",
        back_populates="board",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="BoardColumn.position",
    )
    swimlanes: Mapped[List["BoardSwimlane"]] = relationship(
        "BoardSwimlane",
        back_populates="board",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="BoardSwimlane.position",
    )

    def __repr__(self) -> str:
        return f"<Board(id={self.id}, project={self.project_id})>"


class BoardColumn(Base):
    """Board column model."""

    __tablename__ = "board_columns"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    board_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("boards.id"),
        nullable=False,
        index=True,
    )
    board: Mapped["Board"] = relationship(
        "Board",
        back_populates="columns",
        lazy="selectin",
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Position in board
    position: Mapped[int] = mapped_column(Integer, default=0)

    # WIP limit (Work In Progress)
    wip_limit: Mapped[Optional[int]] = mapped_column(Integer)

    # Column type for automation
    column_type: Mapped[BoardColumnType] = mapped_column(
        default=BoardColumnType.TODO,
    )

    # Color coding
    color: Mapped[str] = mapped_column(String(7), default="#E5E7EB")

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def __repr__(self) -> str:
        return f"<BoardColumn(id={self.id}, name={self.name}, board={self.board_id})>"


class BoardSwimlane(Base):
    """Board swimlane model for horizontal categorization."""

    __tablename__ = "board_swimlanes"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    board_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("boards.id"),
        nullable=False,
        index=True,
    )
    board: Mapped["Board"] = relationship(
        "Board",
        back_populates="swimlanes",
        lazy="selectin",
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Position in board
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Filter criteria for swimlane (e.g., priority=high, assignee=user_id)
    criteria: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Color coding
    color: Mapped[Optional[str]] = mapped_column(String(7))

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def __repr__(self) -> str:
        return f"<BoardSwimlane(id={self.id}, name={self.name}, board={self.board_id})>"
