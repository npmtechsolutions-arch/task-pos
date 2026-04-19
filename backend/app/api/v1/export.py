"""
Simple direct export endpoints — GET-based, no complex schema required.
Fixes the 422 error from frontend.
"""
from datetime import date
from typing import Optional
import csv
import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.project import Project, ProjectMember
from app.models.task import Task, TaskStatus
from app.models.user import User

router = APIRouter()


def _make_csv(rows: list[dict], title: str = "report") -> StreamingResponse:
    if not rows:
        rows = [{"message": "no data"}]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M")
    safe = "".join(c if c.isalnum() else "_" for c in title)[:30]
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{safe}_{ts}.csv"'},
    )


def _make_json(rows: list[dict], title: str = "report") -> StreamingResponse:
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M")
    safe = "".join(c if c.isalnum() else "_" for c in title)[:30]
    payload = json.dumps(
        {"title": title, "generated_at": datetime.utcnow().isoformat(), "rows": rows},
        indent=2, default=str,
    )
    return StreamingResponse(
        iter([payload]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe}_{ts}.json"'},
    )


# ── Project Report ─────────────────────────────────────────────────────────────

@router.get("/projects")
async def export_projects(
    fmt: str = Query("csv", pattern="^(csv|json)$"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export projects visible to the current user."""
    pid_result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
    )
    project_ids = [r[0] for r in pid_result.fetchall()]

    result = await db.execute(
        select(Project).where(Project.id.in_(project_ids)).order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    rows = [
        {
            "id": p.id,
            "name": p.name,
            "key": p.key,
            "status": p.status.value if p.status else "",
            "start_date": str(p.start_date) if p.start_date else "",
            "end_date": str(p.end_date) if p.end_date else "",
            "total_estimated_hours": p.total_estimated_hours or 0,
            "total_actual_hours": p.total_actual_hours or 0,
            "created_at": str(p.created_at)[:10] if p.created_at else "",
        }
        for p in projects
    ]
    if fmt == "json":
        return _make_json(rows, "projects_report")
    return _make_csv(rows, "projects_report")


# ── Tasks Report ───────────────────────────────────────────────────────────────

@router.get("/tasks")
async def export_tasks(
    fmt: str = Query("csv", pattern="^(csv|json)$"),
    project_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export tasks for projects the user belongs to."""
    pid_result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
    )
    project_ids = [r[0] for r in pid_result.fetchall()]

    stmt = select(Task).where(Task.project_id.in_(project_ids))
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    stmt = stmt.order_by(Task.created_at.desc())

    result = await db.execute(stmt)
    tasks = result.scalars().all()
    rows = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status.value if t.status else "",
            "priority": t.priority.value if t.priority else "",
            "project_id": t.project_id,
            "assignee_id": t.primary_assignee_id or "",
            "estimated_hours": t.estimated_hours or 0,
            "due_date": str(t.due_date)[:10] if t.due_date else "",
            "created_at": str(t.created_at)[:10] if t.created_at else "",
        }
        for t in tasks
    ]
    if fmt == "json":
        return _make_json(rows, "tasks_report")
    return _make_csv(rows, "tasks_report")


# ── Users Report (admin only) ──────────────────────────────────────────────────

@router.get("/users")
async def export_users(
    fmt: str = Query("csv", pattern="^(csv|json)$"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all users in the tenant (admin/owner only)."""
    from app.models.user import UserRole
    if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
        from fastapi import HTTPException
        raise HTTPException(403, "Admin access required")

    result = await db.execute(
        select(User).where(User.tenant_id == current_user.tenant_id).order_by(User.created_at)
    )
    users = result.scalars().all()
    rows = [
        {
            "id": u.id,
            "email": u.email,
            "first_name": u.first_name or "",
            "last_name": u.last_name or "",
            "role": u.role.value if u.role else "",
            "status": u.status.value if u.status else "",
            "is_active": u.is_active,
            "created_at": str(u.created_at)[:10] if u.created_at else "",
        }
        for u in users
    ]
    if fmt == "json":
        return _make_json(rows, "users_report")
    return _make_csv(rows, "users_report")
