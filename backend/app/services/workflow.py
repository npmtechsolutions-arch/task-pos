"""Task Workflow enforcement service."""

from typing import Dict, Any, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.task_workflow import TaskWorkflowState
from app.models.task import TaskActivity, ActivityAction

class WorkflowService:
    """Service to handle workflow rule enforcement and transition validation."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def validate_transition(self, task_id: str, new_state_id: str, user_id: str) -> Tuple[bool, str]:
        """
        Validates whether a task can be transitioned to a new state based on workflow rules.
        Returns (is_valid, error_message).
        """
        # Fetch task and its current state
        stmt = select(Task).where(Task.id == task_id)
        result = await self.db.execute(stmt)
        task = result.scalar_one_or_none()
        
        if not task:
            return False, "Task not found."
            
        if not task.workflow_state_id:
            # If the task isn't bound to an explicit workflow state, we fall back to generic enums, assuming valid.
            return True, ""
            
        if task.workflow_state_id == new_state_id:
            return True, ""

        # Fetch current state details
        current_state_stmt = select(TaskWorkflowState).where(TaskWorkflowState.id == task.workflow_state_id)
        current_state_res = await self.db.execute(current_state_stmt)
        current_state = current_state_res.scalar_one_or_none()

        if not current_state:
            return False, "Current workflow state defined on task does not exist."

        # Fetch target state details
        target_state_stmt = select(TaskWorkflowState).where(TaskWorkflowState.id == new_state_id)
        target_state_res = await self.db.execute(target_state_stmt)
        target_state = target_state_res.scalar_one_or_none()

        if not target_state:
            return False, "Target workflow state does not exist."
            
        # 1. Check mapping: Is new_state_id in the allowed_transitions list of current_state?
        if current_state.allowed_transitions and new_state_id not in current_state.allowed_transitions:
            return False, f"Invalid workflow transition: Cannot move from '{current_state.name}' to '{target_state.name}'."

        # 2. Check entry conditions on the target state (e.g., "require_estimate": true)
        if target_state.entry_conditions:
            if target_state.entry_conditions.get("require_estimate", False) and not task.estimated_hours:
                return False, f"Cannot transition to '{target_state.name}': Estimated hours must be provided."

        return True, ""

    async def log_transition_attempt(self, task_id: str, user_id: str, old_state_name: str, new_state_name: str, success: bool, reason: str = "") -> None:
        """
        Logs workflow transitions in the audit trail, including failed attempts.
        """
        description = f"Moved from {old_state_name} to {new_state_name}" if success else f"Failed to move from {old_state_name} to {new_state_name}: {reason}"
        
        log = TaskActivity(
            task_id=task_id,
            user_id=user_id,
            action=ActivityAction.STATUS_CHANGED,
            description=description,
            activity_metadata={
                "old_state": old_state_name,
                "new_state": new_state_name,
                "success": success,
                "reason": reason
            }
        )
        self.db.add(log)
        await self.db.flush()
