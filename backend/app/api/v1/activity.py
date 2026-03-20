"""Activity feed API — personal and project-scoped."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.project import ProjectMember
from app.models.task import TaskActivity

router = APIRouter()


def _serialize_activity(a: TaskActivity) -> dict:
    return {
        "id": a.id,
        "task_id": a.task_id,
        "project_id": a.project_id,
        "action": a.action,
        "description": a.description,
        "metadata": a.activity_metadata or {},
        "created_at": a.created_at.isoformat(),
        "actor": {
            "id": a.user.id,
            "full_name": a.user.full_name,
            "email": a.user.email,
            "avatar_url": a.user.avatar_url,
        } if a.user else None,
    }


@router.get("/personal")
async def personal_feed(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="ISO timestamp for cursor pagination"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activity feed: actions DONE BY or ABOUT the current user.
    
    Supports both offset pagination (page/per_page) and cursor pagination
    (cursor = created_at ISO timestamp of last seen item for infinite scroll).
    """
    from sqlalchemy import or_
    from app.models.task import Task

    # Tasks the user is involved in (reporter or assignee)
    subq = (
        select(Task.id)
        .where(
            or_(
                Task.primary_assignee_id == current_user.id,
                Task.reporter_id == current_user.id,
            )
        )
        .scalar_subquery()
    )

    query = (
        select(TaskActivity)
        .where(
            or_(
                TaskActivity.user_id == current_user.id,
                TaskActivity.task_id.in_(subq),
            )
        )
        .order_by(TaskActivity.created_at.desc())
    )

    if cursor:
        from datetime import datetime
        cursor_dt = datetime.fromisoformat(cursor)
        query = query.where(TaskActivity.created_at < cursor_dt)

    offset = (page - 1) * per_page
    result = await db.execute(query.offset(offset).limit(per_page))
    items = result.scalars().all()

    next_cursor = items[-1].created_at.isoformat() if items else None

    return {
        "items": [_serialize_activity(a) for a in items],
        "page": page,
        "per_page": per_page,
        "next_cursor": next_cursor,
    }


@router.get("/project/{project_id}")
async def project_feed(
    project_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    cursor: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activity feed for a project. Only accessible to project members."""
    # Security: must be a member
    member_check = await db.execute(
        select(ProjectMember).where(
            and_(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == current_user.id,
            )
        )
    )
    if not member_check.scalar_one_or_none():
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not a member of this project")

    query = (
        select(TaskActivity)
        .where(TaskActivity.project_id == project_id)
        .order_by(TaskActivity.created_at.desc())
    )

    if cursor:
        from datetime import datetime
        cursor_dt = datetime.fromisoformat(cursor)
        query = query.where(TaskActivity.created_at < cursor_dt)

    offset = (page - 1) * per_page
    result = await db.execute(query.offset(offset).limit(per_page))
    items = result.scalars().all()

    next_cursor = items[-1].created_at.isoformat() if items else None

    return {
        "items": [_serialize_activity(a) for a in items],
        "page": page,
        "per_page": per_page,
        "next_cursor": next_cursor,
    }
