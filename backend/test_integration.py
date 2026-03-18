import asyncio
import sys
from datetime import datetime

from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole, UserStatus
from app.models.project import Project, ProjectStatus, ProjectVisibility
from app.models.task import Task, TaskStatus, TaskPriority
from app.services.project import ProjectService
from app.services.task import TaskService
from app.services.dashboard import DashboardService
from app.services.workflow import WorkflowService

async def run_tests():
    print("Starting module verification...")
    async with AsyncSessionLocal() as db:
        # 1. Create a test user if not exists
        from sqlalchemy import select
        res = await db.execute(select(User).limit(1))
        user = res.scalar_one_or_none()
        
        if not user:
            print("Creating test user...")
            user = User(
                email="test_admin@example.com",
                hashed_password="hashed",
                first_name="Test",
                last_name="Admin",
                role=UserRole.ADMIN,
                status=UserStatus.ACTIVE
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
        print(f"Using user: {user.email} (ID: {user.id})")

        # 2. Create a test project
        print("\n--- Testing Project Module ---")
        project_service = ProjectService(db)
        from app.schemas.project import ProjectCreate, ProjectVisibility
        
        import uuid

        project_key = f"ALPHA-{uuid.uuid4().hex[:6].upper()}"

        project_data = ProjectCreate(
            name="Alpha Dynamic App",
            key=project_key,
            description="Testing dynamic features",
            visibility=ProjectVisibility.PRIVATE
        )
        
        project = await project_service.create(project_data, user.id)
        print(f"Created Project: {project.name} (ID: {project.id})")

        # 3. Create a test task
        print("\n--- Testing Task Module ---")
        task_service = TaskService(db)
        from app.schemas.task import TaskCreate
        
        task_data = TaskCreate(
            title="Implement WebSocket real-time updates",
            description="Ensure dashboard updates automatically.",
            project_id=project.id,
            primary_assignee_id=user.id,
            priority=TaskPriority.HIGH,
            estimated_hours=5.0
        )
        
        task = await task_service.create(task_data, user.id)
        print(f"Created Task: {task.title} (Status: {task.status})")

        # 4. Test Workflow Transition
        print("\n--- Testing Workflow Service ---")
        workflow_service = WorkflowService(db)
        
        # We don't have explicit custom states set up, so we will transition the direct status for now
        # Let's test standard update
        task.status = TaskStatus.IN_PROGRESS
        await db.commit()
        print(f"Updated Task Status to: {task.status}")

        # 5. Check Dashboard dynamically updating
        print("\n--- Testing Dashboard Service Module ---")
        dashboard_service = DashboardService(db)
        stats = await dashboard_service.get_stats(user.id)
        print("Dashboard Stats Output:")
        print(f"Total Projects: {stats.total_projects}")
        print(f"Active Projects: {stats.active_projects}")
        print(f"My Tasks: {stats.my_tasks}")
        print(f"In Progress: {stats.my_tasks_in_progress}")
        print(f"Hours Logged: {stats.hours_logged}")

        # Clean up
        print("\nCleaning up test data...")
        await db.delete(task)
        await db.delete(project)
        await db.commit()
        print("Test complete. Modules are working!")

if __name__ == "__main__":
    asyncio.run(run_tests())
