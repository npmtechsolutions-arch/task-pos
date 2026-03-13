"""Board service for Kanban board operations."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.board import Board, BoardColumn, BoardColumnType, BoardSwimlane
from app.schemas.board import (
    BoardColumnCreate,
    BoardColumnUpdate,
    BoardCreate,
    BoardSwimlaneCreate,
    BoardSwimlaneUpdate,
    BoardUpdate,
    CardMoveRequest,
)

logger = get_logger(__name__)


class BoardService:
    """Board service class."""

    DEFAULT_COLUMNS = [
        {"name": "To Do", "column_type": BoardColumnType.TODO, "color": "#E5E7EB"},
        {"name": "In Progress", "column_type": BoardColumnType.IN_PROGRESS, "color": "#BFDBFE"},
        {"name": "Review", "column_type": BoardColumnType.REVIEW, "color": "#FED7AA"},
        {"name": "Done", "column_type": BoardColumnType.DONE, "color": "#BBF7D0"},
    ]

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, board_id: str) -> Optional[Board]:
        """Get board by ID."""
        result = await self.db.execute(
            select(Board).where(Board.id == board_id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: str) -> Optional[Board]:
        """Get board by project ID."""
        result = await self.db.execute(
            select(Board).where(Board.project_id == project_id)
        )
        return result.scalar_one_or_none()

    async def create(self, board_data: BoardCreate) -> Board:
        """Create a new board for project."""
        logger.info("Creating board for project", project_id=board_data.project_id)

        # Check if board already exists for project
        existing = await self.get_by_project(board_data.project_id)
        if existing:
            raise ValueError("Board already exists for this project")

        # Create board
        board = Board(
            project_id=board_data.project_id,
            name=board_data.name,
            settings=board_data.settings or {},
        )

        self.db.add(board)
        await self.db.flush()

        # Create default columns if not provided
        columns_data = board_data.columns or self.DEFAULT_COLUMNS
        for idx, col_data in enumerate(columns_data):
            column = BoardColumn(
                board_id=board.id,
                name=col_data["name"],
                position=idx,
                column_type=col_data.get("column_type", BoardColumnType.TODO),
                color=col_data.get("color", "#E5E7EB"),
                wip_limit=col_data.get("wip_limit"),
            )
            self.db.add(column)

        await self.db.commit()
        await self.db.refresh(board)

        logger.info("Board created successfully", board_id=board.id)
        return board

    async def update(self, board_id: str, board_data: BoardUpdate) -> Optional[Board]:
        """Update board."""
        board = await self.get_by_id(board_id)
        if not board:
            return None

        update_data = board_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(board, field, value)

        board.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(board)

        logger.info("Board updated", board_id=board_id)
        return board

    # Column management

    async def add_column(
        self, board_id: str, column_data: BoardColumnCreate
    ) -> BoardColumn:
        """Add column to board."""
        # Get max position
        result = await self.db.execute(
            select(BoardColumn.position)
            .where(BoardColumn.board_id == board_id)
            .order_by(BoardColumn.position.desc())
        )
        max_position = result.scalar() or -1

        column = BoardColumn(
            board_id=board_id,
            name=column_data.name,
            position=column_data.position or (max_position + 1),
            wip_limit=column_data.wip_limit,
            column_type=column_data.column_type,
            color=column_data.color,
        )

        self.db.add(column)
        await self.db.commit()
        await self.db.refresh(column)

        logger.info("Column added to board", board_id=board_id, column_id=column.id)
        return column

    async def update_column(
        self, column_id: str, column_data: BoardColumnUpdate
    ) -> Optional[BoardColumn]:
        """Update board column."""
        result = await self.db.execute(
            select(BoardColumn).where(BoardColumn.id == column_id)
        )
        column = result.scalar_one_or_none()
        if not column:
            return None

        update_data = column_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(column, field, value)

        column.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(column)
        return column

    async def delete_column(self, column_id: str) -> bool:
        """Delete board column."""
        result = await self.db.execute(
            select(BoardColumn).where(BoardColumn.id == column_id)
        )
        column = result.scalar_one_or_none()
        if not column:
            return False

        await self.db.delete(column)
        await self.db.commit()
        return True

    async def reorder_columns(self, board_id: str, column_ids: List[str]) -> bool:
        """Reorder columns on board."""
        for idx, column_id in enumerate(column_ids):
            result = await self.db.execute(
                select(BoardColumn).where(
                    BoardColumn.id == column_id,
                    BoardColumn.board_id == board_id,
                )
            )
            column = result.scalar_one_or_none()
            if column:
                column.position = idx

        await self.db.commit()
        return True

    # Swimlane management

    async def add_swimlane(
        self, board_id: str, swimlane_data: BoardSwimlaneCreate
    ) -> BoardSwimlane:
        """Add swimlane to board."""
        # Get max position
        result = await self.db.execute(
            select(BoardSwimlane.position)
            .where(BoardSwimlane.board_id == board_id)
            .order_by(BoardSwimlane.position.desc())
        )
        max_position = result.scalar() or -1

        swimlane = BoardSwimlane(
            board_id=board_id,
            name=swimlane_data.name,
            position=swimlane_data.position or (max_position + 1),
            criteria=swimlane_data.criteria,
            color=swimlane_data.color,
        )

        self.db.add(swimlane)
        await self.db.commit()
        await self.db.refresh(swimlane)

        logger.info("Swimlane added to board", board_id=board_id, swimlane_id=swimlane.id)
        return swimlane

    async def update_swimlane(
        self, swimlane_id: str, swimlane_data: BoardSwimlaneUpdate
    ) -> Optional[BoardSwimlane]:
        """Update board swimlane."""
        result = await self.db.execute(
            select(BoardSwimlane).where(BoardSwimlane.id == swimlane_id)
        )
        swimlane = result.scalar_one_or_none()
        if not swimlane:
            return None

        update_data = swimlane_data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(swimlane, field, value)

        swimlane.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(swimlane)
        return swimlane

    async def delete_swimlane(self, swimlane_id: str) -> bool:
        """Delete board swimlane."""
        result = await self.db.execute(
            select(BoardSwimlane).where(BoardSwimlane.id == swimlane_id)
        )
        swimlane = result.scalar_one_or_none()
        if not swimlane:
            return False

        await self.db.delete(swimlane)
        await self.db.commit()
        return True

    # Card movement

    async def move_card(self, move_data: CardMoveRequest) -> bool:
        """Move card between columns."""
        from app.models.task import Task

        result = await self.db.execute(
            select(Task).where(Task.id == move_data.task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            return False

        task.board_column_id = move_data.target_column_id
        task.position = move_data.new_position
        task.updated_at = datetime.utcnow()

        await self.db.commit()

        logger.info(
            "Card moved",
            task_id=move_data.task_id,
            from_column=move_data.source_column_id,
            to_column=move_data.target_column_id,
        )
        return True
