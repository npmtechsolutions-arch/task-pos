"""Task service for business logic."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.task import (
    DependencyType,
    Tag,
    Task,
    TaskComment,
    TaskDependency,
    TaskPriority,
    TaskStatus,
    TimeEntry,
)
from app.schemas.task import (
    TaskBatchUpdateRequest,
    TaskCommentCreate,
    TaskCreate,
    TaskDependencyCreate,
    TaskFilterParams,
    TaskMoveRequest,
    TaskUpdate,
    TimeEntryCreate,
    TimeEntryUpdate,
)
from app.services.project import ProjectService

logger = get_logger(__name__)


class TaskService:
    """Task service class."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.project_service = ProjectService(db)

    async def get_by_id(self, task_id: str) -> Optional[Task]:
        """Get task by ID."""
        result = await self.db.execute(
            select(Task).where(Task.id == task_id)
        )
        return result.scalar_one_or_none()

    async def get_with_details(self, task_id: str) -> Optional[Task]:
        """Get task with all details loaded."""
        result = await self.db.execute(
            select(Task).where(Task.id == task_id)
        )
        return result.scalar_one_or_none()

    async def list_tasks(
        self,
        filters: Optional[TaskFilterParams] = None,
    ) -> tuple[List[Task], int]:
        """List tasks with filters."""
        query = select(Task)

        if filters:
            if filters.project_id:
                query = query.where(Task.project_id == filters.project_id)

            if filters.status:
                query = query.where(Task.status == filters.status)

            if filters.priority:
                query = query.where(Task.priority == filters.priority)

            if filters.assignee_id:
                query = query.where(Task.assignee_id == filters.assignee_id)

            if filters.reporter_id:
                query = query.where(Task.reporter_id == filters.reporter_id)

            if filters.search:
                search_filter = or_(
                    Task.title.ilike(f"%{filters.search}%"),
                    Task.description.ilike(f"%{filters.search}%"),
                )
                query = query.where(search_filter)

            if filters.due_before:
                query = query.where(Task.due_date <= filters.due_before)

            if filters.due_after:
                query = query.where(Task.due_date >= filters.due_after)

            if filters.tag_ids:
                # Filter by tags - task must have at least one of the specified tags
                query = query.where(Task.tags.any(Tag.id.in_(filters.tag_ids)))

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply sorting
        if filters and filters.sort_by:
            sort_column = getattr(Task, filters.sort_by, Task.created_at)
            if filters.sort_order == "desc":
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(Task.created_at.desc())

        # Apply pagination
        page = filters.page if filters else 1
        per_page = filters.per_page if filters else 20
        query = query.offset((page - 1) * per_page).limit(per_page)

        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def get_user_tasks(
        self,
        user_id: str,
        status: Optional[TaskStatus] = None,
    ) -> List[Task]:
        """Get tasks assigned to user."""
        query = select(Task).where(Task.assignee_id == user_id)

        if status:
            query = query.where(Task.status == status)
        else:
            # Default to non-completed tasks
            query = query.where(Task.status != TaskStatus.DONE)

        query = query.order_by(Task.due_date.asc().nullslast())

        result = await self.db.execute(query)
        return result.scalars().all()

    async def create(self, task_data: TaskCreate, reporter_id: str) -> Task:
        """Create a new task."""
        logger.info(
            "Creating new task",
            title=task_data.title,
            project=task_data.project_id,
        )

        # Create task
        task = Task(
            project_id=task_data.project_id,
            parent_id=task_data.parent_id,
            title=task_data.title,
            description=task_data.description,
            task_type=task_data.task_type,
            priority=task_data.priority,
            assignee_id=task_data.assignee_id,
            reporter_id=reporter_id,
            due_date=task_data.due_date,
            start_date=task_data.start_date,
            estimated_hours=task_data.estimated_hours,
            custom_fields=task_data.custom_fields or {},
            status=TaskStatus.TODO,
        )

        self.db.add(task)
        await self.db.flush()

        # Add tags if specified
        if task_data.tag_ids:
            tags_result = await self.db.execute(
                select(Tag).where(Tag.id.in_(task_data.tag_ids))
            )
            task.tags = tags_result.scalars().all()

        await self.db.commit()
        await self.db.refresh(task)

        # Update project metrics
        await self.project_service.update_metrics(task_data.project_id)

        logger.info("Task created successfully", task_id=task.id)
        return task

    async def update(self, task_id: str, task_data: TaskUpdate) -> Optional[Task]:
        """Update task."""
        task = await self.get_by_id(task_id)
        if not task:
            return None

        update_data = task_data.model_dump(exclude_unset=True)

        # Handle status change
        old_status = task.status
        new_status = update_data.get("status")

        for field, value in update_data.items():
            if field == "tag_ids":
                # Handle tags separately
                if value:
                    tags_result = await self.db.execute(
                        select(Tag).where(Tag.id.in_(value))
                    )
                    task.tags = tags_result.scalars().all()
            else:
                setattr(task, field, value)

        # Update timestamps based on status changes
        if new_status and new_status != old_status:
            if new_status == TaskStatus.IN_PROGRESS and not task.started_at:
                task.started_at = datetime.utcnow()
            elif new_status == TaskStatus.DONE:
                task.completed_at = datetime.utcnow()

        task.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(task)

        # Update project metrics
        await self.project_service.update_metrics(task.project_id)

        logger.info("Task updated", task_id=task_id)
        return task

    async def batch_update(self, update_data: TaskBatchUpdateRequest) -> int:
        """Batch update multiple tasks."""
        result = await self.db.execute(
            select(Task).where(Task.id.in_(update_data.task_ids))
        )
        tasks = result.scalars().all()

        update_dict = update_data.model_dump(exclude={"task_ids"}, exclude_unset=True)

        for task in tasks:
            for field, value in update_dict.items():
                if value is not None:
                    setattr(task, field, value)
            task.updated_at = datetime.utcnow()

        await self.db.commit()

        # Update project metrics for affected projects
        project_ids = {task.project_id for task in tasks}
        for project_id in project_ids:
            await self.project_service.update_metrics(project_id)

        logger.info("Batch task update completed", count=len(tasks))
        return len(tasks)

    async def move(self, task_id: str, move_data: TaskMoveRequest) -> Optional[Task]:
        """Move task to different column/position."""
        task = await self.get_by_id(task_id)
        if not task:
            return None

        task.board_column_id = move_data.board_column_id
        task.position = move_data.new_position
        task.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(task)

        return task

    async def delete(self, task_id: str) -> bool:
        """Delete task."""
        task = await self.get_by_id(task_id)
        if not task:
            return False

        project_id = task.project_id
        await self.db.delete(task)
        await self.db.commit()

        # Update project metrics
        await self.project_service.update_metrics(project_id)

        logger.info("Task deleted", task_id=task_id)
        return True

    # Comments

    async def add_comment(
        self, task_id: str, comment_data: TaskCommentCreate, author_id: str
    ) -> TaskComment:
        """Add comment to task."""
        comment = TaskComment(
            task_id=task_id,
            author_id=author_id,
            content=comment_data.content,
            parent_id=comment_data.parent_id,
        )

        self.db.add(comment)
        await self.db.commit()
        await self.db.refresh(comment)

        logger.info("Comment added", task_id=task_id, comment_id=comment.id)
        return comment

    async def update_comment(
        self, comment_id: str, content: str
    ) -> Optional[TaskComment]:
        """Update comment."""
        result = await self.db.execute(
            select(TaskComment).where(TaskComment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        if not comment:
            return None

        comment.content = content
        comment.is_edited = True
        comment.edited_at = datetime.utcnow()
        comment.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(comment)
        return comment

    async def delete_comment(self, comment_id: str) -> bool:
        """Delete comment."""
        result = await self.db.execute(
            select(TaskComment).where(TaskComment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        if not comment:
            return False

        await self.db.delete(comment)
        await self.db.commit()
        return True

    # Time entries

    async def add_time_entry(
        self, task_id: str, entry_data: TimeEntryCreate, user_id: str
    ) -> TimeEntry:
        """Add time entry to task."""
        entry = TimeEntry(
            task_id=task_id,
            user_id=user_id,
            started_at=entry_data.started_at,
            ended_at=entry_data.ended_at,
            duration_minutes=entry_data.duration_minutes,
            description=entry_data.description,
            is_billable=entry_data.is_billable,
        )

        self.db.add(entry)

        # Update task actual hours
        task = await self.get_by_id(task_id)
        if task:
            hours = entry_data.duration_minutes / 60
            task.actual_hours += hours

        await self.db.commit()
        await self.db.refresh(entry)

        logger.info("Time entry added", task_id=task_id, entry_id=entry.id)
        return entry

    async def update_time_entry(
        self, entry_id: str, entry_data: TimeEntryUpdate
    ) -> Optional[TimeEntry]:
        """Update time entry."""
        result = await self.db.execute(
            select(TimeEntry).where(TimeEntry.id == entry_id)
        )
        entry = result.scalar_one_or_none()
        if not entry:
            return None

        old_duration = entry.duration_minutes

        update_data = entry_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(entry, field, value)

        # Update task actual hours if duration changed
        if entry_data.duration_minutes is not None:
            task = await self.get_by_id(entry.task_id)
            if task:
                diff = (entry_data.duration_minutes - old_duration) / 60
                task.actual_hours += diff

        entry.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def delete_time_entry(self, entry_id: str) -> bool:
        """Delete time entry."""
        result = await self.db.execute(
            select(TimeEntry).where(TimeEntry.id == entry_id)
        )
        entry = result.scalar_one_or_none()
        if not entry:
            return False

        # Update task actual hours
        task = await self.get_by_id(entry.task_id)
        if task:
            task.actual_hours -= entry.duration_minutes / 60

        await self.db.delete(entry)
        await self.db.commit()
        return True

    # Dependencies

    async def add_dependency(
        self, task_id: str, dependency_data: TaskDependencyCreate
    ) -> TaskDependency:
        """Add a dependency relationship between tasks."""
        depends_on_id = dependency_data.depends_on_id
        
        # Check if already exists
        result = await self.db.execute(
            select(TaskDependency).where(
                TaskDependency.task_id == task_id,
                TaskDependency.depends_on_id == depends_on_id
            )
        )
        if result.scalar_one_or_none():
            raise ValueError("Dependency relationship already exists")

        # Prevent circular dependency (basic check)
        if task_id == depends_on_id:
            raise ValueError("Task cannot depend on itself")

        # Verify both tasks exist
        task1 = await self.get_by_id(task_id)
        task2 = await self.get_by_id(depends_on_id)
        if not task1 or not task2:
            raise ValueError("One or both tasks not found")

        # Check they belong to the same project
        if task1.project_id != task2.project_id:
            raise ValueError("Cannot create dependency between tasks in different projects")

        dependency = TaskDependency(
            task_id=task_id,
            depends_on_id=depends_on_id,
            dependency_type=dependency_data.dependency_type,
        )

        self.db.add(dependency)
        await self.db.commit()
        await self.db.refresh(dependency)
        
        logger.info("Task dependency created", task_id=task_id, depends_on_id=depends_on_id)
        return dependency

    async def remove_dependency(self, dependency_id: str) -> bool:
        """Remove a task dependency."""
        result = await self.db.execute(
            select(TaskDependency).where(TaskDependency.id == dependency_id)
        )
        dependency = result.scalar_one_or_none()
        if not dependency:
            return False

        await self.db.delete(dependency)
        await self.db.commit()
        return True
