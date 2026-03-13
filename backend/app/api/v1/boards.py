"""Board API routes."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.project import ProjectMemberRole
from app.schemas.board import (
    BoardColumnCreate,
    BoardColumnResponse,
    BoardColumnUpdate,
    BoardCreate,
    BoardDetailResponse,
    BoardResponse,
    BoardSwimlaneCreate,
    BoardSwimlaneResponse,
    BoardSwimlaneUpdate,
    BoardUpdate,
    CardMoveRequest,
)
from app.services.board import BoardService
from app.services.project import ProjectService

logger = get_logger(__name__)
router = APIRouter()


@router.get("/project/{project_id}", response_model=BoardDetailResponse)
async def get_project_board(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardDetailResponse:
    """Get board for project."""
    # Check project membership
    project_service = ProjectService(db)
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    board_service = BoardService(db)
    board = await board_service.get_by_project(project_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    return BoardDetailResponse.model_validate(board)


@router.post("", response_model=BoardResponse, status_code=status.HTTP_201_CREATED)
async def create_board(
    board_data: BoardCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardResponse:
    """Create a new board for project."""
    # Check project permissions
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        board_data.project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    board_service = BoardService(db)

    try:
        board = await board_service.create(board_data)
        return BoardResponse.model_validate(board)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{board_id}", response_model=BoardDetailResponse)
async def get_board(
    board_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardDetailResponse:
    """Get board by ID."""
    board_service = BoardService(db)
    board = await board_service.get_by_id(board_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check project membership
    project_service = ProjectService(db)
    if not await project_service.is_project_member(board.project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return BoardDetailResponse.model_validate(board)


@router.put("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: str,
    board_data: BoardUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardResponse:
    """Update board."""
    board_service = BoardService(db)
    board = await board_service.get_by_id(board_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check project permissions
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        board.project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    updated_board = await board_service.update(board_id, board_data)
    return BoardResponse.model_validate(updated_board)


# Column management

@router.post("/{board_id}/columns", response_model=BoardColumnResponse)
async def add_column(
    board_id: str,
    column_data: BoardColumnCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardColumnResponse:
    """Add column to board."""
    board_service = BoardService(db)
    board = await board_service.get_by_id(board_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check project permissions
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        board.project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    column = await board_service.add_column(board_id, column_data)
    return BoardColumnResponse.model_validate(column)


@router.put("/{board_id}/columns/{column_id}", response_model=BoardColumnResponse)
async def update_column(
    board_id: str,
    column_id: str,
    column_data: BoardColumnUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardColumnResponse:
    """Update board column."""
    board_service = BoardService(db)
    board = await board_service.get_by_id(board_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check project permissions
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        board.project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    column = await board_service.update_column(column_id, column_data)

    if not column:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Column not found",
        )

    return BoardColumnResponse.model_validate(column)


@router.delete("/{board_id}/columns/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(
    board_id: str,
    column_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete board column."""
    board_service = BoardService(db)
    board = await board_service.get_by_id(board_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check project permissions
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        board.project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    success = await board_service.delete_column(column_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Column not found",
        )


# Swimlane management

@router.post("/{board_id}/swimlanes", response_model=BoardSwimlaneResponse)
async def add_swimlane(
    board_id: str,
    swimlane_data: BoardSwimlaneCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardSwimlaneResponse:
    """Add swimlane to board."""
    board_service = BoardService(db)
    board = await board_service.get_by_id(board_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check project permissions
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        board.project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    swimlane = await board_service.add_swimlane(board_id, swimlane_data)
    return BoardSwimlaneResponse.model_validate(swimlane)


@router.put("/{board_id}/swimlanes/{swimlane_id}", response_model=BoardSwimlaneResponse)
async def update_swimlane(
    board_id: str,
    swimlane_id: str,
    swimlane_data: BoardSwimlaneUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BoardSwimlaneResponse:
    """Update board swimlane."""
    board_service = BoardService(db)
    board = await board_service.get_by_id(board_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check project permissions
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        board.project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    swimlane = await board_service.update_swimlane(swimlane_id, swimlane_data)

    if not swimlane:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Swimlane not found",
        )

    return BoardSwimlaneResponse.model_validate(swimlane)


@router.delete(
    "{board_id}/swimlanes/{swimlane_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_swimlane(
    board_id: str,
    swimlane_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete board swimlane."""
    board_service = BoardService(db)
    board = await board_service.get_by_id(board_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check project permissions
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        board.project_id, current_user.id, ProjectMemberRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    success = await board_service.delete_swimlane(swimlane_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Swimlane not found",
        )


# Card movement

@router.post("/{board_id}/cards/move")
async def move_card(
    board_id: str,
    move_data: CardMoveRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Move card between columns."""
    board_service = BoardService(db)
    board = await board_service.get_by_id(board_id)

    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )

    # Check project membership (any member can move cards)
    project_service = ProjectService(db)
    if not await project_service.is_project_member(board.project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    success = await board_service.move_card(move_data)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return {"message": "Card moved successfully"}
