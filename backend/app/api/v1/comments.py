"""Comment API routes for task comments with real-time support."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.project import ProjectMember
from app.models.task import Task, TaskComment
from app.services.comment import CommentService
from sqlalchemy import and_, select

logger = get_logger(__name__)
router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None


class CommentUpdate(BaseModel):
    content: str


class ReactionRequest(BaseModel):
    emoji: str


# ── Auth helpers ──────────────────────────────────────────────────────────

async def _get_task_or_404(task_id: str, db: AsyncSession) -> Task:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def _get_comment_or_404(comment_id: str, db: AsyncSession) -> TaskComment:
    comment = await db.get(TaskComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


async def _require_project_member(project_id: str, user_id: str, db: AsyncSession):
    result = await db.execute(
        select(ProjectMember).where(
            and_(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this project")


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/tasks/{task_id}/comments")
async def list_comments(
    task_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    include_resolved: bool = Query(True),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get paginated top-level comments for a task (replies included in each comment)."""
    task = await _get_task_or_404(task_id, db)
    await _require_project_member(task.project_id, current_user.id, db)

    svc = CommentService(db)
    comments, total = await svc.list_comments(task_id, page, per_page, include_resolved)

    def _ser_comment(c: TaskComment) -> dict:
        return {
            "id": c.id,
            "task_id": c.task_id,
            "content": c.content,
            "author": {
                "id": c.author.id,
                "full_name": c.author.full_name,
                "email": c.author.email,
                "avatar_url": c.author.avatar_url,
            },
            "parent_id": c.parent_id,
            "mentions": c.mentions or [],
            "is_edited": c.is_edited,
            "edited_at": c.edited_at.isoformat() if c.edited_at else None,
            "is_resolved": c.is_resolved,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            "created_at": c.created_at.isoformat(),
            "replies": [_ser_comment(r) for r in (c.replies or [])],
        }

    return {
        "items": [_ser_comment(c) for c in comments],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("/tasks/{task_id}/comments", status_code=status.HTTP_201_CREATED)
async def create_comment(
    task_id: str,
    body: CommentCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a comment on a task. Parses @mentions and broadcasts via WebSocket."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")

    task = await _get_task_or_404(task_id, db)
    await _require_project_member(task.project_id, current_user.id, db)

    svc = CommentService(db)
    comment = await svc.create_comment(
        task=task,
        author_id=current_user.id,
        content=body.content.strip(),
        parent_id=body.parent_id,
    )

    return {
        "id": comment.id,
        "content": comment.content,
        "author_id": comment.author_id,
        "parent_id": comment.parent_id,
        "mentions": comment.mentions or [],
        "is_resolved": comment.is_resolved,
        "created_at": comment.created_at.isoformat(),
    }


@router.put("/tasks/{task_id}/comments/{comment_id}")
async def edit_comment(
    task_id: str,
    comment_id: str,
    body: CommentUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit your own comment."""
    comment = await _get_comment_or_404(comment_id, db)

    if comment.task_id != task_id:
        raise HTTPException(status_code=400, detail="Comment does not belong to this task")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit another user's comment")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    svc = CommentService(db)
    comment = await svc.edit_comment(comment, current_user.id, body.content.strip())

    return {
        "id": comment.id,
        "content": comment.content,
        "is_edited": comment.is_edited,
        "edited_at": comment.edited_at.isoformat() if comment.edited_at else None,
    }


@router.delete("/tasks/{task_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    task_id: str,
    comment_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete your own comment (admins can delete any)."""
    comment = await _get_comment_or_404(comment_id, db)

    if comment.task_id != task_id:
        raise HTTPException(status_code=400, detail="Comment does not belong to this task")
    if comment.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot delete another user's comment")

    svc = CommentService(db)
    await svc.delete_comment(comment)


@router.post("/tasks/{task_id}/comments/{comment_id}/resolve")
async def resolve_comment(
    task_id: str,
    comment_id: str,
    resolved: bool = True,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a top-level comment as resolved or reopen it."""
    comment = await _get_comment_or_404(comment_id, db)
    if comment.task_id != task_id:
        raise HTTPException(status_code=400, detail="Comment does not belong to this task")
    if comment.parent_id:
        raise HTTPException(status_code=400, detail="Only top-level comments can be resolved")

    # Must be project member
    task = await _get_task_or_404(task_id, db)
    await _require_project_member(task.project_id, current_user.id, db)

    svc = CommentService(db)
    comment = await svc.resolve_comment(comment, current_user.id, resolved)
    return {"id": comment.id, "is_resolved": comment.is_resolved}


@router.post("/tasks/{task_id}/comments/{comment_id}/reactions")
async def toggle_reaction(
    task_id: str,
    comment_id: str,
    body: ReactionRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle an emoji reaction on a comment. Safe under concurrent requests."""
    comment = await _get_comment_or_404(comment_id, db)
    if comment.task_id != task_id:
        raise HTTPException(status_code=400, detail="Comment does not belong to this task")

    svc = CommentService(db)
    result = await svc.toggle_reaction(comment_id, current_user.id, body.emoji)
    return result


@router.get("/tasks/{task_id}/comments/{comment_id}/reactions")
async def get_reactions(
    task_id: str,
    comment_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get reaction counts + which emojis the current user has reacted with."""
    comment = await _get_comment_or_404(comment_id, db)
    if comment.task_id != task_id:
        raise HTTPException(status_code=400, detail="Comment does not belong to this task")

    svc = CommentService(db)
    return await svc.get_comment_reactions(comment_id, current_user.id)
