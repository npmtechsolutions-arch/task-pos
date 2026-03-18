"""Task Workflows API."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, get_db
from app.models.task_workflow import TaskWorkflow, TaskWorkflowState
from app.schemas.task import TaskResponse
from app.services.workflow import WorkflowService
from app.services.task import TaskService

router = APIRouter()

@router.get("", response_model=list[dict])
async def list_workflows(
    project_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all custom workflows."""
    stmt = select(TaskWorkflow)
    if project_id:
        stmt = stmt.where(TaskWorkflow.project_id == project_id)
        
    result = await db.execute(stmt)
    workflows = result.scalars().all()
    
    # Very basic manual serialization for now
    out = []
    for wf in workflows:
        out.append({
            "id": wf.id,
            "name": wf.name,
            "is_default": wf.is_default,
            "states": [{"id": s.id, "name": s.name, "category": s.category, "color": s.color} for s in wf.states]
        })
    return out


@router.post("/{task_id}/transition", response_model=TaskResponse)
async def transition_task(
    task_id: str,
    new_state_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Transition a task through its workflow safely."""
    workflow_service = WorkflowService(db)
    
    # Validate
    is_valid, error = await workflow_service.validate_transition(task_id, new_state_id, current_user.id)
    if not is_valid:
        await workflow_service.log_transition_attempt(task_id, current_user.id, "Unknown", "Unknown", False, error)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
        
    # Apply
    task_service = TaskService(db)
    task = await task_service.get_by_id(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_state_id = task.workflow_state_id
    task.workflow_state_id = new_state_id
    await db.flush()

    await workflow_service.log_transition_attempt(task_id, current_user.id, str(old_state_id), new_state_id, True)

    return TaskResponse.model_validate(task)
