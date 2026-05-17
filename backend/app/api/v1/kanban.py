"""Kanban Board API router — full CRUD for tasks, comments, assignments, labels, activity."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.board import Board, BoardColumn
from app.models.project import ProjectMemberRole
from app.models.task import (
    ActivityAction,
    KanbanLabel,
    Task,
    TaskActivity,
    TaskAssignment,
    TaskComment,
    TaskPriority,
    TaskStatus,
    TaskType,
    task_label_table,
)
from app.models.user import User
from app.schemas.kanban import (
    AssigneeResponse,
    ColumnReorderRequest,
    KanbanBoardViewResponse,
    KanbanCardMoveRequest,
    KanbanColumnWithTasksResponse,
    KanbanLabelCreate,
    KanbanLabelResponse,
    KanbanTaskCardResponse,
    KanbanTaskCreate,
    KanbanTaskDetailResponse,
    KanbanTaskUpdate,
    PaginatedActivityResponse,
    PaginatedCommentsResponse,
    TaskActivityResponse,
    TaskAssignmentResponse,
    TaskAssignRequest,
    TaskCommentCreate,
    TaskCommentResponse,
    TaskCommentUpdate,
    TaskReorderRequest,
)
from app.services.board import BoardService
from app.services.project import ProjectService

logger = get_logger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _user_to_assignee(user: User) -> AssigneeResponse:
    return AssigneeResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
    )


async def _log_activity(
    db: AsyncSession,
    task_id: str,
    user_id: str,
    action: ActivityAction,
    description: str,
    metadata: dict = None,
    project_id: str = None,
    tenant_id: str = None,
) -> None:
    log = TaskActivity(
        task_id=task_id,
        user_id=user_id,
        action=action,
        description=description,
        activity_metadata=metadata or {},
        project_id=project_id,
        tenant_id=tenant_id or "",  # fallback to empty string to avoid NOT NULL error
    )
    db.add(log)
    # Note: caller must commit


async def _task_to_card(task: Task, db: AsyncSession) -> KanbanTaskCardResponse:
    comment_count_result = await db.execute(
        select(func.count(TaskComment.id)).where(TaskComment.task_id == task.id)
    )
    comment_count = comment_count_result.scalar_one() or 0
    assignee_count = len(task.assignments) if task.assignments else 0

    return KanbanTaskCardResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        task_type=task.task_type,
        position=task.position,
        board_column_id=task.board_column_id,
        project_id=task.project_id,
        primary_assignee_id=task.primary_assignee_id,
        assignee=_user_to_assignee(task.primary_assignee) if task.primary_assignee else None,
        labels=[
            KanbanLabelResponse(
                id=lbl.id,
                name=lbl.name,
                color=lbl.color,
                project_id=lbl.project_id,
                created_at=lbl.created_at,
            )
            for lbl in (task.labels or [])
        ],
        due_date=task.due_date,
        estimated_hours=task.estimated_hours,
        actual_hours=task.actual_hours,
        is_overdue=task.is_overdue,
        comment_count=comment_count,
        assignee_count=assignee_count,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


# ═══════════════════════════════════════════════════════════════════════════
# Board Init (auto-create default board for a project)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/boards/init/{project_id}", status_code=status.HTTP_201_CREATED)
async def init_project_board(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Auto-initialize a Kanban board for a project.
    Creates default columns (To Do, In Progress, Review, Done) if no board exists.
    Returns the board_id whether newly created or already existing.
    """
    project_service = ProjectService(db)
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    board_service = BoardService(db)
    existing = await board_service.get_by_project(project_id)
    if existing:
        return {"board_id": existing.id, "created": False, "message": "Board already exists"}

    from app.schemas.board import BoardCreate
    board = await board_service.create(
        BoardCreate(project_id=project_id, name="Kanban Board", settings={})
    )
    return {"board_id": board.id, "created": True, "message": "Board initialized with default columns"}


# ═══════════════════════════════════════════════════════════════════════════
# Board View
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/board/{project_id}", response_model=KanbanBoardViewResponse)
async def get_kanban_board(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KanbanBoardViewResponse:
    """
    Get the full Kanban board for a project.

    Returns all columns with their task cards, ordered by column position
    and task position. This is the primary endpoint for rendering the board.
    """
    project_service = ProjectService(db)
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    board_service = BoardService(db)
    board = await board_service.get_by_project(project_id)
    if not board:
        # Auto-init board if missing (idempotent)
        from app.schemas.board import BoardCreate
        board = await board_service.create(
            BoardCreate(project_id=project_id, name="Kanban Board", settings={})
        )

    # Fetch all tasks in the project with their labels loaded
    tasks_result = await db.execute(
        select(Task)
        .options(selectinload(Task.labels), selectinload(Task.assignments), selectinload(Task.primary_assignee))
        .where(Task.project_id == project_id, Task.tenant_id == current_user.tenant_id)
        .order_by(Task.position)
    )
    all_tasks = tasks_result.scalars().all()

    # Group tasks by board_column_id.
    # Tasks created outside Kanban may have no board_column_id; map them to a default column
    # so they are still visible on the board.
    sorted_columns = sorted(board.columns, key=lambda c: c.position)
    default_column = next(
        (c for c in sorted_columns if c.column_type.value in ("todo", "backlog")),
        sorted_columns[0] if sorted_columns else None,
    )
    default_column_id = default_column.id if default_column else None

    tasks_by_column: dict = {}
    for task in all_tasks:
        col_id = task.board_column_id or default_column_id or "unassigned"
        tasks_by_column.setdefault(col_id, []).append(task)

    # Build column responses
    column_responses: List[KanbanColumnWithTasksResponse] = []
    total_tasks = 0

    for col in sorted_columns:
        col_tasks = tasks_by_column.get(col.id, [])
        cards = []
        for task in col_tasks:
            card = await _task_to_card(task, db)
            cards.append(card)
        total_tasks += len(cards)

        column_responses.append(
            KanbanColumnWithTasksResponse(
                id=col.id,
                name=col.name,
                position=col.position,
                color=col.color,
                wip_limit=col.wip_limit,
                column_type=col.column_type.value,
                tasks=cards,
                task_count=len(cards),
            )
        )

    settings = board.settings or {}
    return KanbanBoardViewResponse(
        board_id=board.id,
        board_name=board.name,
        project_id=project_id,
        columns=column_responses,
        total_tasks=total_tasks,
        wip_limits_enabled=settings.get("wip_limits_enabled", False),
    )




# ═══════════════════════════════════════════════════════════════════════════
# Task Card CRUD
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/tasks", response_model=KanbanTaskCardResponse, status_code=status.HTTP_201_CREATED)
async def create_kanban_task(
    task_data: KanbanTaskCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KanbanTaskCardResponse:
    """Create a new task card on the Kanban board."""
    project_service = ProjectService(db)
    if not await project_service.is_project_member(task_data.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Validate board column if provided
    if task_data.board_column_id:
        col = await db.get(BoardColumn, task_data.board_column_id)
        if not col:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")

    task = Task(
        title=task_data.title,
        description=task_data.description,
        project_id=task_data.project_id,
        tenant_id=current_user.tenant_id,
        board_column_id=task_data.board_column_id,
        status=task_data.status,
        priority=task_data.priority,
        task_type=task_data.task_type,
        primary_assignee_id=task_data.primary_assignee_id,
        due_date=task_data.due_date,
        estimated_hours=task_data.estimated_hours,
        position=task_data.position,
        reporter_id=current_user.id,
    )
    db.add(task)
    await db.flush()

    # Attach labels
    if task_data.label_ids:
        labels_result = await db.execute(
            select(KanbanLabel).where(KanbanLabel.id.in_(task_data.label_ids))
        )
        task.labels = labels_result.scalars().all()

    await _log_activity(db, task.id, current_user.id, ActivityAction.CREATED, "Task created")
    await db.commit()
    await db.refresh(task)

    # 🔔 Notify assignee (if task assigned to someone else)
    if task.primary_assignee_id and task.primary_assignee_id != current_user.id:
        try:
            from app.services.notification import NotificationService
            from app.websocket.manager import manager

            assigned_by = (
                f"{getattr(current_user, 'first_name', '')} {getattr(current_user, 'last_name', '')}".strip()
                or getattr(current_user, "full_name", "")
                or getattr(current_user, "email", "")
                or current_user.id
            )
            notif_service = NotificationService(db)
            notif = await notif_service.notify_task_assigned(
                user_id=task.primary_assignee_id,
                task_id=task.id,
                task_title=task.title,
                project_id=task.project_id,
                project_name="",
                assigned_by_name=assigned_by,
            )
            await manager.send_to_user(task.primary_assignee_id, {
                "type": "notification",
                "data": {
                    "id": notif.id,
                    "notification_type": notif.notification_type.value if hasattr(notif.notification_type, 'value') else str(notif.notification_type),
                    "title": notif.title,
                    "message": notif.message,
                    "action_url": notif.action_url,
                    "is_read": False,
                    "created_at": notif.created_at.isoformat(),
                }
            })
        except Exception as e:
            logger.warning("Notification dispatch failed (non-critical)", error=str(e))

    return await _task_to_card(task, db)


@router.get("/tasks/{task_id}", response_model=KanbanTaskDetailResponse)
async def get_kanban_task(
    task_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KanbanTaskDetailResponse:
    """Get full task details (for the task detail modal)."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Eager load comments and assignments
    task_result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.comments),
            selectinload(Task.assignments),
            selectinload(Task.labels),
            selectinload(Task.primary_assignee),
            selectinload(Task.reporter),
        )
        .where(Task.id == task_id)
    )
    task = task_result.scalar_one()

    card = await _task_to_card(task, db)
    comments = [
        TaskCommentResponse(
            id=c.id,
            task_id=c.task_id,
            author_id=c.author_id,
            author={"id": c.author.id, "full_name": c.author.full_name, "avatar_url": c.author.avatar_url},
            content=c.content,
            mentions=c.mentions or [],
            parent_id=c.parent_id,
            is_edited=c.is_edited,
            edited_at=c.edited_at,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in (task.comments or [])
    ]
    assignments = [
        TaskAssignmentResponse(
            id=a.id,
            task_id=a.task_id,
            user_id=a.user_id,
            user=_user_to_assignee(a.user),
            assigned_at=a.assigned_at,
        )
        for a in (task.assignments or [])
    ]

    return KanbanTaskDetailResponse(
        **card.model_dump(),
        reporter_id=task.reporter_id,
        reporter=_user_to_assignee(task.reporter) if task.reporter else None,
        comments=comments,
        assignments=assignments,
        subtask_count=len(task.subtasks) if task.subtasks else 0,
        progress_percentage=task.progress_percentage,
    )


@router.put("/tasks/{task_id}", response_model=KanbanTaskCardResponse)
async def update_kanban_task(
    task_id: str,
    task_data: KanbanTaskUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KanbanTaskCardResponse:
    """Update a task card (title, description, status, priority, due date, etc.)"""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    update_data = task_data.model_dump(exclude_unset=True)

    # Track status changes
    if "status" in update_data and update_data["status"] != task.status:
        await _log_activity(
            db, task.id, current_user.id, ActivityAction.STATUS_CHANGED,
            f"Status changed from {task.status.value} to {update_data['status'].value}",
            {"old": task.status.value, "new": update_data["status"].value},
        )
    if "priority" in update_data and update_data["priority"] != task.priority:
        await _log_activity(
            db, task.id, current_user.id, ActivityAction.PRIORITY_CHANGED,
            f"Priority changed to {update_data['priority'].value}",
        )
    if "due_date" in update_data:
        await _log_activity(db, task.id, current_user.id, ActivityAction.DUE_DATE_CHANGED, "Due date updated")

    for field, value in update_data.items():
        setattr(task, field, value)
    task.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task)
    return await _task_to_card(task, db)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kanban_task(
    task_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a task card from the board."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.has_permission(task.project_id, current_user.id, ProjectMemberRole.MEMBER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(task)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# Drag-and-Drop Card Move
# ═══════════════════════════════════════════════════════════════════════════

@router.put("/tasks/{task_id}/move", response_model=KanbanTaskCardResponse)
async def move_kanban_task(
    task_id: str,
    move_data: KanbanCardMoveRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KanbanTaskCardResponse:
    """
    Move a task card to a different column (drag-and-drop).

    Updates `board_column_id`, `status` (matched from column type), and `position`.
    Logs a MOVED activity.
    """
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Validate target column
    target_col = await db.get(BoardColumn, move_data.target_column_id)
    if not target_col:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target column not found")

    old_col_name = "unassigned"
    if move_data.source_column_id:
        src = await db.get(BoardColumn, move_data.source_column_id)
        if src:
            old_col_name = src.name

    # Map column type → task status
    col_to_status = {
        "backlog": TaskStatus.TODO,
        "todo": TaskStatus.TODO,
        "in_progress": TaskStatus.IN_PROGRESS,
        "review": TaskStatus.REVIEW,
        "done": TaskStatus.DONE,
        "archive": TaskStatus.CANCELLED,
    }
    new_status = col_to_status.get(target_col.column_type.value, task.status)

    await _log_activity(
        db, task.id, current_user.id, ActivityAction.MOVED,
        f"Moved from '{old_col_name}' to '{target_col.name}'",
        {"from_column": old_col_name, "to_column": target_col.name},
        project_id=task.project_id,
        tenant_id=current_user.tenant_id,
    )

    # Re-fetch with a FOR UPDATE lock to prevent concurrent move race conditions
    result = await db.execute(
        select(Task).where(Task.id == task_id).with_for_update()
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found after lock")

    old_board_column_id = task.board_column_id
    old_status = task.status

    task.board_column_id = move_data.target_column_id
    task.position = move_data.new_position
    task.status = new_status
    task.updated_at = datetime.utcnow()

    logger.info(
        "Kanban move — pre-commit",
        task_id=task_id,
        old_col=old_board_column_id,
        new_col=move_data.target_column_id,
        old_status=str(old_status),
        new_status=str(new_status),
    )

    await db.commit()
    await db.refresh(task)

    logger.info(
        "Kanban move — post-commit (persisted)",
        task_id=task_id,
        board_column_id=task.board_column_id,
        status=str(task.status),
        updated_at=str(task.updated_at),
    )

    card = await _task_to_card(task, db)

    # Broadcast to all project members so their boards update instantly.
    # The event carries updated_at so the frontend timestamp guard knows
    # this is the authoritative state (newer than any optimistic local copy).
    try:
        from app.websocket.manager import manager
        await manager.broadcast_to_project(task.project_id, {
            "type": "task.moved",
            "data": {
                "id": task.id,
                "task_id": task.id,
                "project_id": task.project_id,
                "board_column_id": task.board_column_id,
                "status": task.status.value if hasattr(task.status, "value") else str(task.status),
                "position": task.position,
                "updated_at": task.updated_at.isoformat(),
                "moved_by": current_user.id,
                "target_column_id": move_data.target_column_id,
                "source_column_id": move_data.source_column_id,
            },
        })
    except Exception as ws_err:
        logger.warning("Kanban move WS broadcast failed (non-critical)", error=str(ws_err))

    return card



# ═══════════════════════════════════════════════════════════════════════════
# Task Assignments (multiple assignees)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/tasks/{task_id}/assign", response_model=TaskAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_task(
    task_id: str,
    assign_data: TaskAssignRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskAssignmentResponse:
    """Assign a user to a task (supports multiple assignees)."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Check if already assigned
    existing = await db.execute(
        select(TaskAssignment).where(
            and_(TaskAssignment.task_id == task_id, TaskAssignment.user_id == assign_data.user_id)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already assigned to this task")

    user = await db.get(User, assign_data.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    assignment = TaskAssignment(
        task_id=task_id,
        user_id=assign_data.user_id,
        assigned_by=current_user.id,
    )
    db.add(assignment)

    await _log_activity(
        db, task_id, current_user.id, ActivityAction.ASSIGNED,
        f"Assigned to {user.full_name}",
        {"user_id": assign_data.user_id, "user_name": user.full_name},
    )

    await db.commit()
    await db.refresh(assignment)

    return TaskAssignmentResponse(
        id=assignment.id,
        task_id=assignment.task_id,
        user_id=assignment.user_id,
        user=_user_to_assignee(user),
        assigned_at=assignment.assigned_at,
    )


@router.get("/tasks/{task_id}/assignees", response_model=List[TaskAssignmentResponse])
async def get_task_assignees(
    task_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[TaskAssignmentResponse]:
    """List all assignees of a task."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(TaskAssignment).where(TaskAssignment.task_id == task_id)
    )
    assignments = result.scalars().all()

    return [
        TaskAssignmentResponse(
            id=a.id,
            task_id=a.task_id,
            user_id=a.user_id,
            user=_user_to_assignee(a.user),
            assigned_at=a.assigned_at,
        )
        for a in assignments
    ]


@router.delete("/tasks/{task_id}/assignees/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_task(
    task_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove an assignee from a task."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(TaskAssignment).where(
            and_(TaskAssignment.task_id == task_id, TaskAssignment.user_id == user_id)
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    user = await db.get(User, user_id)
    await _log_activity(
        db, task_id, current_user.id, ActivityAction.UNASSIGNED,
        f"Unassigned {user.full_name if user else user_id}",
    )

    await db.delete(assignment)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# Comments (with pagination)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/tasks/{task_id}/comments", response_model=TaskCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    task_id: str,
    comment_data: TaskCommentCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskCommentResponse:
    """Add a comment to a task."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=comment_data.content,
        mentions=comment_data.mentions,
        parent_id=comment_data.parent_id,
    )
    db.add(comment)

    await _log_activity(
        db, task_id, current_user.id, ActivityAction.COMMENTED,
        f"Added a comment",
    )

    await db.commit()
    await db.refresh(comment)

    return TaskCommentResponse(
        id=comment.id,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author={"id": current_user.id, "full_name": current_user.full_name, "avatar_url": current_user.avatar_url},
        content=comment.content,
        mentions=comment.mentions or [],
        parent_id=comment.parent_id,
        is_edited=comment.is_edited,
        edited_at=comment.edited_at,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.get("/tasks/{task_id}/comments", response_model=PaginatedCommentsResponse)
async def get_comments(
    task_id: str,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedCommentsResponse:
    """List comments for a task (paginated — newest last)."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    total_result = await db.execute(
        select(func.count(TaskComment.id)).where(TaskComment.task_id == task_id)
    )
    total = total_result.scalar_one() or 0

    comments_result = await db.execute(
        select(TaskComment)
        .where(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
        .limit(per_page)
        .offset((page - 1) * per_page)
    )
    comments = comments_result.scalars().all()

    items = [
        TaskCommentResponse(
            id=c.id,
            task_id=c.task_id,
            author_id=c.author_id,
            author={"id": c.author.id, "full_name": c.author.full_name, "avatar_url": c.author.avatar_url},
            content=c.content,
            mentions=c.mentions or [],
            parent_id=c.parent_id,
            is_edited=c.is_edited,
            edited_at=c.edited_at,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in comments
    ]

    return PaginatedCommentsResponse(
        items=items, total=total, page=page, per_page=per_page,
        has_more=(page * per_page) < total
    )


@router.put("/tasks/{task_id}/comments/{comment_id}", response_model=TaskCommentResponse)
async def edit_comment(
    task_id: str,
    comment_id: str,
    comment_data: TaskCommentUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskCommentResponse:
    """Edit your own comment."""
    result = await db.execute(
        select(TaskComment).where(
            and_(TaskComment.id == comment_id, TaskComment.task_id == task_id)
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if comment.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own comments")

    comment.content = comment_data.content
    comment.is_edited = True
    comment.edited_at = datetime.utcnow()

    await _log_activity(db, task_id, current_user.id, ActivityAction.COMMENT_EDITED, "Edited a comment")
    await db.commit()
    await db.refresh(comment)

    return TaskCommentResponse(
        id=comment.id,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author={"id": comment.author.id, "full_name": comment.author.full_name, "avatar_url": comment.author.avatar_url},
        content=comment.content,
        mentions=comment.mentions or [],
        parent_id=comment.parent_id,
        is_edited=comment.is_edited,
        edited_at=comment.edited_at,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.delete("/tasks/{task_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    task_id: str,
    comment_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a comment (author only or admin)."""
    result = await db.execute(
        select(TaskComment).where(
            and_(TaskComment.id == comment_id, TaskComment.task_id == task_id)
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    task = await db.get(Task, task_id)
    project_service = ProjectService(db)
    is_admin = await project_service.has_permission(task.project_id, current_user.id, ProjectMemberRole.ADMIN)

    if comment.author_id != current_user.id and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    await db.delete(comment)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# Labels
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/labels/{project_id}", response_model=List[KanbanLabelResponse])
async def list_labels(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[KanbanLabelResponse]:
    """List all labels for a project."""
    project_service = ProjectService(db)
    if not await project_service.is_project_member(project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(KanbanLabel).where(KanbanLabel.project_id == project_id).order_by(KanbanLabel.name)
    )
    labels = result.scalars().all()
    return [KanbanLabelResponse.model_validate(l) for l in labels]


@router.post("/labels", response_model=KanbanLabelResponse, status_code=status.HTTP_201_CREATED)
async def create_label(
    label_data: KanbanLabelCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KanbanLabelResponse:
    """Create a new label for a project."""
    if label_data.project_id:
        project_service = ProjectService(db)
        if not await project_service.is_project_member(label_data.project_id, current_user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    label = KanbanLabel(
        name=label_data.name,
        color=label_data.color,
        project_id=label_data.project_id,
    )
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return KanbanLabelResponse.model_validate(label)


@router.post("/tasks/{task_id}/labels/{label_id}", response_model=KanbanTaskCardResponse)
async def add_label_to_task(
    task_id: str,
    label_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KanbanTaskCardResponse:
    """Attach a label to a task card."""
    task_result = await db.execute(
        select(Task).options(selectinload(Task.labels)).where(Task.id == task_id)
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    label = await db.get(KanbanLabel, label_id)
    if not label:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")

    if label not in task.labels:
        task.labels.append(label)
        await _log_activity(db, task_id, current_user.id, ActivityAction.LABEL_ADDED, f"Added label '{label.name}'")
        await db.commit()
        await db.refresh(task)

    return await _task_to_card(task, db)


@router.delete("/tasks/{task_id}/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_label_from_task(
    task_id: str,
    label_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a label from a task card."""
    task_result = await db.execute(
        select(Task).options(selectinload(Task.labels)).where(Task.id == task_id)
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    label = await db.get(KanbanLabel, label_id)
    if label and label in task.labels:
        task.labels.remove(label)
        await _log_activity(db, task_id, current_user.id, ActivityAction.LABEL_REMOVED, f"Removed label '{label.name}'")
        await db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# Activity History
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/tasks/{task_id}/activity", response_model=PaginatedActivityResponse)
async def get_task_activity(
    task_id: str,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedActivityResponse:
    """
    Get activity history for a task (paginated — newest first).

    Shows all changes: status moves, assignments, comments, label changes, etc.
    """
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    total_result = await db.execute(
        select(func.count(TaskActivity.id)).where(TaskActivity.task_id == task_id)
    )
    total = total_result.scalar_one() or 0

    activity_result = await db.execute(
        select(TaskActivity)
        .where(TaskActivity.task_id == task_id)
        .order_by(TaskActivity.created_at.desc())
        .limit(per_page)
        .offset((page - 1) * per_page)
    )
    logs = activity_result.scalars().all()

    items = [
        TaskActivityResponse(
            id=a.id,
            task_id=a.task_id,
            user_id=a.user_id,
            user={"id": a.user.id, "full_name": a.user.full_name, "avatar_url": a.user.avatar_url},
            action=a.action,
            description=a.description,
            metadata=a.activity_metadata or {},
            created_at=a.created_at,
        )
        for a in logs
    ]

    return PaginatedActivityResponse(
        items=items, total=total, page=page, per_page=per_page,
        has_more=(page * per_page) < total
    )


# ═══════════════════════════════════════════════════════════════════════════
# Bulk Reorder (for drag-and-drop column/task reordering)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/board/{board_id}/reorder-columns", status_code=status.HTTP_200_OK)
async def reorder_columns(
    board_id: str,
    reorder_data: ColumnReorderRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reorder columns on the board after drag-and-drop."""
    board = await db.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")

    project_service = ProjectService(db)
    if not await project_service.has_permission(board.project_id, current_user.id, ProjectMemberRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    for idx, col_id in enumerate(reorder_data.column_ids):
        col = await db.get(BoardColumn, col_id)
        if col and col.board_id == board_id:
            col.position = idx

    await db.commit()
    return {"message": "Columns reordered successfully"}


@router.post("/board/{board_id}/columns/{column_id}/reorder-tasks", status_code=status.HTTP_200_OK)
async def reorder_tasks_in_column(
    board_id: str,
    column_id: str,
    reorder_data: TaskReorderRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reorder tasks within a column after drag-and-drop."""
    board = await db.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")

    project_service = ProjectService(db)
    if not await project_service.is_project_member(board.project_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    for idx, task_id in enumerate(reorder_data.task_ids):
        task = await db.get(Task, task_id)
        if task and task.board_column_id == column_id:
            task.position = float(idx)

    await db.commit()
    return {"message": "Tasks reordered successfully"}
