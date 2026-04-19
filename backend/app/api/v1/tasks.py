"""Task API routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.models.project import ProjectMemberRole
from app.models.task import Task, TaskComment, TaskPriority, TaskStatus
from app.schemas.task import (
    TaskBatchUpdateRequest,
    TaskCommentCreate,
    TaskCommentResponse,
    TaskCreate,
    TaskDependencyCreate,
    TaskDependencyResponse,
    TaskDetailResponse,
    TaskFilterParams,
    TaskListResponse,
    TaskMoveRequest,
    TaskResponse,
    TaskUpdate,
    TimeEntryCreate,
    TimeEntryResponse,
    TimeEntryUpdate,
)
from app.services.project import ProjectService
from app.services.task import TaskService
from app.services.time_tracking import TimeTrackingService

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    project_id: Optional[str] = Query(None),
    status: Optional[TaskStatus] = Query(None),
    priority: Optional[TaskPriority] = Query(None),
    primary_assignee_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskListResponse:
    """List tasks with filters. Super Admin sees ALL tasks; others see only their own."""
    is_admin = getattr(current_user, 'role', '') in ('admin', 'super_admin', 'owner')

    # Non-admins: always scope to their own tasks unless caller explicitly passed a filter
    effective_assignee_id = primary_assignee_id
    if not is_admin and not primary_assignee_id and not project_id:
        effective_assignee_id = current_user.id

    filters = TaskFilterParams(
        project_id=project_id,
        status=status,
        priority=priority,
        primary_assignee_id=effective_assignee_id,
        search=search,
        page=page,
        per_page=per_page,
    )

    task_service = TaskService(db)
    tasks, total = await task_service.list_tasks(filters=filters)

    return TaskListResponse(
        items=[TaskResponse.model_validate(t) for t in tasks],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/my-tasks", response_model=List[TaskResponse])
async def get_my_tasks(
    status: Optional[TaskStatus] = Query(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[TaskResponse]:
    """Get tasks: Super Admin sees ALL tasks; regular users see only their own."""
    task_service = TaskService(db)
    is_admin = getattr(current_user, 'role', '') in ('admin', 'super_admin', 'owner')

    if is_admin:
        # Super Admin → return all tasks (no status filter unless specified)
        from app.schemas.task import TaskFilterParams
        filters = TaskFilterParams(status=status, per_page=200)
        tasks, _ = await task_service.list_tasks(filters=filters)
    else:
        tasks = await task_service.get_user_tasks(
            user_id=current_user.id,
            status=status,
        )

    return [TaskResponse.model_validate(t) for t in tasks]


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Create a new task."""
    # ✅ Inject tenant_id from the authenticated user — never trust the frontend
    if not task_data.tenant_id:
        task_data = task_data.model_copy(update={"tenant_id": current_user.tenant_id})

    # Check project membership
    project_service = ProjectService(db)
    if not await project_service.is_project_member(
        task_data.project_id, current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    task_service = TaskService(db)

    try:
        task = await task_service.create(task_data, current_user.id)
        return TaskResponse.model_validate(task)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{task_id}", response_model=TaskDetailResponse)
async def get_task(
    task_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskDetailResponse:
    """Get task by ID."""
    task_service = TaskService(db)
    task = await task_service.get_with_details(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Check project membership
    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return TaskDetailResponse.model_validate(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_data: TaskUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Update task."""
    task_service = TaskService(db)
    task = await task_service.get_by_id(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Check project membership
    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    updated_task = await task_service.update(task_id, task_data)
    return TaskResponse.model_validate(updated_task)


@router.post("/batch-update")
async def batch_update_tasks(
    update_data: TaskBatchUpdateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Batch update multiple tasks."""
    task_service = TaskService(db)

    # Verify access to all tasks
    for task_id in update_data.task_ids:
        task = await task_service.get_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_id} not found",
            )

        project_service = ProjectService(db)
        if not await project_service.is_project_member(
            task.project_id, current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for task {task_id}",
            )

    count = await task_service.batch_update(update_data)
    return {"message": f"Updated {count} tasks"}


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete task."""
    task_service = TaskService(db)
    task = await task_service.get_by_id(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Check permissions (admin or reporter can delete)
    project_service = ProjectService(db)
    if not await project_service.has_permission(
        task.project_id, current_user.id, ProjectMemberRole.ADMIN
    ) and task.reporter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    await task_service.delete(task_id)


# Comments

@router.post("/{task_id}/comments", response_model=TaskCommentResponse)
async def add_comment(
    task_id: str,
    comment_data: TaskCommentCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskCommentResponse:
    """Add comment to task."""
    task_service = TaskService(db)
    task = await task_service.get_by_id(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Check project membership
    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    comment = await task_service.add_comment(task_id, comment_data, current_user.id)
    return TaskCommentResponse.model_validate(comment)


@router.put("/{task_id}/comments/{comment_id}", response_model=TaskCommentResponse)
async def update_comment(
    task_id: str,
    comment_id: str,
    comment_data: TaskCommentCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskCommentResponse:
    """Update comment."""
    task_service = TaskService(db)
    comment = await task_service.update_comment(comment_id, comment_data.content)

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Only author can edit
    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only edit your own comments",
        )

    return TaskCommentResponse.model_validate(comment)


@router.delete("/{task_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    task_id: str,
    comment_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete comment."""
    task_service = TaskService(db)
    comment_result = await db.get(TaskComment, comment_id)

    if not comment_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Author or admin can delete
    task = await task_service.get_by_id(task_id)
    project_service = ProjectService(db)
    if (
        comment_result.author_id != current_user.id
        and not await project_service.has_permission(
            task.project_id, current_user.id, ProjectMemberRole.ADMIN
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    await task_service.delete_comment(comment_id)


# Time entries

@router.get("/{task_id}/time-entries", response_model=List[TimeEntryResponse])
async def get_time_entries(
    task_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[TimeEntryResponse]:
    """Get time entries for task."""
    task_service = TaskService(db)
    task = await task_service.get_by_id(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Check project membership
    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return [TimeEntryResponse.model_validate(te) for te in task.time_entries]


@router.post("/{task_id}/time-entries", response_model=TimeEntryResponse)
async def add_time_entry(
    task_id: str,
    entry_data: TimeEntryCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimeEntryResponse:
    """Add time entry to task."""
    task_service = TaskService(db)
    task = await task_service.get_by_id(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Check project membership
    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    entry = await task_service.add_time_entry(task_id, entry_data, current_user.id)
    return TimeEntryResponse.model_validate(entry)


@router.put("/{task_id}/time-entries/{entry_id}", response_model=TimeEntryResponse)
async def update_time_entry(
    task_id: str,
    entry_id: str,
    entry_data: TimeEntryUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TimeEntryResponse:
    """Update time entry."""
    task_service = TaskService(db)
    entry = await task_service.update_time_entry(entry_id, entry_data)

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time entry not found",
        )

    # Only owner can edit
    if entry.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only edit your own time entries",
        )

    return TimeEntryResponse.model_validate(entry)


@router.delete(
    "/{task_id}/time-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_time_entry(
    task_id: str,
    entry_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete time entry."""
    task_service = TaskService(db)

    # Get entry to check ownership
    from app.models.task import TimeEntry

    entry = await db.get(TimeEntry, entry_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time entry not found",
        )

    # Owner or admin can delete
    task = await task_service.get_by_id(task_id)
    project_service = ProjectService(db)
    if (
        entry.user_id != current_user.id
        and not await project_service.has_permission(
            task.project_id, current_user.id, ProjectMemberRole.ADMIN
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    await task_service.delete_time_entry(entry_id)


# Dependencies

@router.post("/{task_id}/dependencies", response_model=TaskDependencyResponse)
async def add_dependency(
    task_id: str,
    dependency_data: TaskDependencyCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskDependencyResponse:
    """Add a dependency relationship to a task."""
    task_service = TaskService(db)
    task = await task_service.get_by_id(task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Check project membership
    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    try:
        dependency = await task_service.add_dependency(task_id, dependency_data)
        return TaskDependencyResponse.model_validate(dependency)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{task_id}/dependencies/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_dependency(
    task_id: str,
    dependency_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a task dependency."""
    task_service = TaskService(db)
    
    # Check permissions logic same as the others
    task = await task_service.get_by_id(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
        
    project_service = ProjectService(db)
    if not await project_service.is_project_member(task.project_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    success = await task_service.remove_dependency(dependency_id)
    if not success:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dependency not found",
        )
@router.post("/{task_id}/log-time")
async def log_task_time(
    task_id: str,
    hours: float,
    description: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Log time against a task."""
    try:
        service = TimeTrackingService(db)
        entry = await service.log_time(
            task_id=task_id,
            user_id=current_user.id,
            duration_minutes=int(hours * 60),
            description=description or ""
        )
        return entry
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
