"""Task Hierarchy Engine."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.models.task import Task, TaskStatus

class HierarchyService:
    """Service to handle parent-child task aggregations and progress tracking."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def recalculate_parent_progress(self, parent_id: str) -> Optional[float]:
        """
        Recalculates the progress of a parent task based on the status of its direct subtasks.
        Returns the new progress percentage (0.0 to 100.0).
        """
        # Fetch the parent
        parent_stmt = select(Task).where(Task.id == parent_id)
        result = await self.db.execute(parent_stmt)
        parent = result.scalar_one_or_none()

        if not parent:
            return None

        # Fetch all subtasks
        subtasks_stmt = select(Task).where(Task.parent_id == parent_id)
        subtasks_result = await self.db.execute(subtasks_stmt)
        subtasks = subtasks_result.scalars().all()

        if not subtasks:
            # If no subtasks, progress is either 0 or 100 based on its own status
            new_progress = 100.0 if parent.status == TaskStatus.DONE else 0.0
        else:
            # Count-based completion for robust aggregation
            total_subtasks = len(subtasks)
            completed_subtasks = sum(1 for st in subtasks if st.status == TaskStatus.DONE)
            new_progress = (completed_subtasks / total_subtasks) * 100.0

        # Update the parent's custom_fields to store the derived progress directly for easy UI access
        if not parent.custom_fields:
            parent.custom_fields = {}
        
        parent.custom_fields["computed_progress"] = round(new_progress, 1)

        # Automatically close parent if 100% complete
        if new_progress == 100.0 and parent.status != TaskStatus.DONE:
            parent.status = TaskStatus.DONE
            
        return new_progress

    async def cascade_progress_update(self, base_task_id: str) -> None:
        """
        Given a task that was just updated, find its parent and recalculate progress.
        Recurses up the hierarchy to update the whole chain.
        """
        # Get current task to find parent
        stmt = select(Task).where(Task.id == base_task_id)
        result = await self.db.execute(stmt)
        task = result.scalar_one_or_none()

        if not task or not task.parent_id:
            return

        # Recalculate parent
        await self.recalculate_parent_progress(task.parent_id)

        # Recursively go up the tree
        await self.cascade_progress_update(task.parent_id)
