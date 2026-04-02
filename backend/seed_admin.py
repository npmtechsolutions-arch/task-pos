import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent))

import asyncio
import logging
from app.db.session import AsyncSessionLocal
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_custom_admin():
    try:
        from app.services.user import UserService
        from app.schemas.user import UserCreate
        from app.models.user import UserRole
        from app.schemas.project import ProjectCreate, ProjectVisibility, ProjectFilterParams
        from app.schemas.task import TaskCreate, TaskPriority
        from app.services.tenant import TenantService
        from app.schemas.tenant import TenantCreate

        async with AsyncSessionLocal() as db:
            # Ensure default tenant exists
            tenant_service = TenantService(db)
            default_tenant = await tenant_service.get_by_slug("default")
            if not default_tenant:
                logger.info("Creating default tenant...")
                default_tenant = await tenant_service.create(TenantCreate(
                    name="Default Organization",
                    slug="default"
                ))
            
            user_service = UserService(db)
            user_data = UserCreate(
                email="admin", 
                password="271527",
                first_name="Super",
                last_name="Admin",
                role=UserRole.ADMIN,
                tenant_id=default_tenant.id
            )
            
            existing_user = await user_service.get_by_email(email="admin")
            if not existing_user:
                logger.info("Creating custom 'admin' user...")
                user = await user_service.create(user_data=user_data)
                existing_user = user
                logger.info("Super admin created successfully: admin / 271527")
            else:
                logger.info("User 'admin' already exists. Updating password...")
                from app.core.security import get_password_hash
                existing_user.password_hash = get_password_hash("271527")
                await db.commit()
                logger.info("Password updated to 271527 for user 'admin'.")

            # Initialize services
            from app.services.project import ProjectService
            from app.services.task import TaskService
            project_service = ProjectService(db)
            task_service = TaskService(db)

            # Check if any projects exist
            filters = ProjectFilterParams(status=None, search=None, page=1, per_page=1)
            existing_projects, _ = await project_service.list_projects(user_id=existing_user.id, filters=filters)
            
            if not existing_projects:
                logger.info("Seeding default Projects and Tasks into database...")
                # Project 1
                p1 = await project_service.create(ProjectCreate(
                    name="Website Redesign",
                    description="Complete overhaul of company website with modern design",
                    key="WEB",
                    visibility=ProjectVisibility.PRIVATE,
                    tenant_id=default_tenant.id
                ), owner_id=existing_user.id)

                # Project 2
                p2 = await project_service.create(ProjectCreate(
                    name="Mobile App Development",
                    description="Build native mobile apps for iOS and Android",
                    key="MOB",
                    visibility=ProjectVisibility.PRIVATE,
                    tenant_id=default_tenant.id
                ), owner_id=existing_user.id)

                # Project 3
                p3 = await project_service.create(ProjectCreate(
                    name="Marketing Campaign Q1",
                    description="First quarter marketing initiatives and campaigns",
                    key="MKT",
                    visibility=ProjectVisibility.PRIVATE,
                    tenant_id=default_tenant.id
                ), owner_id=existing_user.id)

                # Seed some tasks
                await task_service.create(TaskCreate(
                    title="Design homepage mockups",
                    description="Create 3 different design concepts for the new homepage",
                    project_id=p1.id,
                    tenant_id=default_tenant.id,
                    primary_assignee_id=existing_user.id,
                    priority=TaskPriority.HIGH,
                    estimated_hours=16.0
                ), reporter_id=existing_user.id)

                await task_service.create(TaskCreate(
                    title="Optimize images for web",
                    project_id=p1.id,
                    tenant_id=default_tenant.id,
                    primary_assignee_id=existing_user.id,
                    priority=TaskPriority.LOW,
                    estimated_hours=8.0
                ), reporter_id=existing_user.id)

                await task_service.create(TaskCreate(
                    title="Create app wireframes",
                    project_id=p2.id,
                    primary_assignee_id=existing_user.id,
                    priority=TaskPriority.HIGH,
                    estimated_hours=24.0
                ), reporter_id=existing_user.id)

                logger.info("Default Projects and Tasks seeded successfully.")
            
    except Exception as e:
        logger.error(f"Error seeding admin: {e}")

if __name__ == "__main__":
    asyncio.run(seed_custom_admin())
