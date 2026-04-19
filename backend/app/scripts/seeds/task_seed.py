import logging
import uuid
import random
from typing import Dict, List
from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.tenant import Tenant
from app.models.user import User
from app.models.project import Project
from app.models.task import Task, TaskStatus, TaskPriority, TaskType, TaskAssignment
from app.models.board import Board, BoardColumn

logger = logging.getLogger(__name__)
fake = Faker()

async def seed_tasks(session: AsyncSession, tenant: Tenant, users: Dict[str, User], projects: List[Project]) -> List[Task]:
    """Seed Tasks and Subtasks."""
    logger.info("Seeding Tasks and Subtasks...")
    
    all_users = list(users.values())
    created_tasks = []
    
    status_mapping = {
        "Backlog": TaskStatus.TODO,
        "To Do": TaskStatus.TODO,
        "In Progress": TaskStatus.IN_PROGRESS,
        "Review": TaskStatus.REVIEW,
        "Done": TaskStatus.DONE
    }
    
    for project in projects:
        # Get board columns
        result = await session.execute(select(BoardColumn).join(Board).where(Board.project_id == project.id).order_by(BoardColumn.position))
        columns = result.scalars().all()
        if not columns:
            continue
            
        # Create 10-15 tasks per project
        num_tasks = random.randint(10, 15)
        
        for i in range(num_tasks):
            col = random.choice(columns)
            status_val = status_mapping.get(col.name, TaskStatus.TODO)
            assignee = random.choice(all_users)
            reporter = users["pm"]
            
            task = Task(
                id=str(uuid.uuid4()),
                tenant_id=tenant.id,
                project_id=project.id,
                title=fake.sentence(nb_words=6),
                description=fake.paragraph(),
                task_type=TaskType.TASK,
                status=status_val,
                priority=random.choice(list(TaskPriority)),
                primary_assignee_id=assignee.id,
                reporter_id=reporter.id,
                board_column_id=col.id,
                estimated_hours=random.randint(2, 20),
                actual_hours=random.randint(0, 10)
            )
            session.add(task)
            await session.flush()
            created_tasks.append(task)
            
            # Task Assignment
            assignment = TaskAssignment(
                task_id=task.id,
                tenant_id=tenant.id,
                user_id=assignee.id,
                is_primary=True,
                assigned_by=reporter.id
            )
            session.add(assignment)
            
            # Add 2-3 Subtasks
            num_subtasks = random.randint(2, 3)
            for j in range(num_subtasks):
                sub_assignee = random.choice(all_users)
                subtask = Task(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant.id,
                    project_id=project.id,
                    parent_id=task.id,
                    title=f"Subtask: {fake.sentence(nb_words=4)}",
                    task_type=TaskType.SUBTASK,
                    status=TaskStatus.TODO,
                    priority=task.priority,
                    primary_assignee_id=sub_assignee.id,
                    reporter_id=reporter.id
                )
                session.add(subtask)
                await session.flush()
                session.add(TaskAssignment(
                    task_id=subtask.id,
                    tenant_id=tenant.id,
                    user_id=sub_assignee.id,
                    is_primary=True,
                    assigned_by=reporter.id
                ))
                
    await session.flush()
    logger.info(f"Created {len(created_tasks)} parent tasks across projects.")
    return created_tasks
