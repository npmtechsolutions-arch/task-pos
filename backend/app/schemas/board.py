"""Board schemas for request/response validation."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.board import BoardColumnType


class BoardColumnBase(BaseModel):
    """Base board column schema."""

    name: str = Field(..., min_length=1, max_length=255)
    wip_limit: Optional[int] = Field(None, ge=0)
    column_type: BoardColumnType = BoardColumnType.TODO
    color: str = "#E5E7EB"


class BoardColumnCreate(BoardColumnBase):
    """Board column creation schema."""

    position: int = 0


class BoardColumnUpdate(BaseModel):
    """Board column update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    position: Optional[int] = None
    wip_limit: Optional[int] = Field(None, ge=0)
    column_type: Optional[BoardColumnType] = None
    color: Optional[str] = None


class BoardColumnResponse(BoardColumnBase):
    """Board column response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    board_id: str
    position: int
    created_at: datetime
    updated_at: datetime


class BoardSwimlaneBase(BaseModel):
    """Base board swimlane schema."""

    name: str = Field(..., min_length=1, max_length=255)
    criteria: dict = {}
    color: Optional[str] = None


class BoardSwimlaneCreate(BoardSwimlaneBase):
    """Board swimlane creation schema."""

    position: int = 0


class BoardSwimlaneUpdate(BaseModel):
    """Board swimlane update schema."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    position: Optional[int] = None
    criteria: Optional[dict] = None
    color: Optional[str] = None


class BoardSwimlaneResponse(BoardSwimlaneBase):
    """Board swimlane response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    board_id: str
    position: int
    created_at: datetime
    updated_at: datetime


class BoardBase(BaseModel):
    """Base board schema."""

    name: str = Field(default="Board", max_length=255)
    settings: dict = {}


class BoardCreate(BoardBase):
    """Board creation schema."""

    project_id: str
    columns: Optional[List[BoardColumnCreate]] = None


class BoardUpdate(BaseModel):
    """Board update schema."""

    name: Optional[str] = Field(None, max_length=255)
    settings: Optional[dict] = None


class BoardResponse(BoardBase):
    """Board response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime


class BoardDetailResponse(BoardResponse):
    """Detailed board response with columns and swimlanes."""

    columns: List[BoardColumnResponse]
    swimlanes: List[BoardSwimlaneResponse]


class CardMoveRequest(BaseModel):
    """Card move request schema."""

    task_id: str
    source_column_id: str
    target_column_id: str
    new_position: float
