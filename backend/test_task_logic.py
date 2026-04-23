
import asyncio
import os
import sys
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add the current directory to sys.path to import app modules
sys.path.insert(0, os.getcwd())

from app.models.user import User
from app.services.task import TaskService
from app.schemas.task import TaskFilterParams

async def test_api_logic():
    from dotenv import load_dotenv
    load_dotenv()
    
    database_url = os.getenv("DATABASE_URL")
    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        task_service = TaskService(session)
        
        # Find Rishie
        res = await session.execute(select(User).where(User.email.ilike("rishie%")))
        user = res.scalar_one_or_none()
        if not user:
            print("User Rishie not found")
            return
        
        print(f"Testing for user: {user.email} (Role: {user.role})")
        
        # 1. Test get_user_tasks (used for regular users)
        print("\n--- Testing get_user_tasks (Regular User Logic) ---")
        tasks = await task_service.get_user_tasks(
            user_id=user.id,
            tenant_id=user.tenant_id,
            status=None
        )
        print(f"Result count: {len(tasks)}")
        for t in tasks:
            print(f" - {t.title} (Status: {t.status})")
            
        # 2. Test list_tasks (used for admins)
        print("\n--- Testing list_tasks (Admin Logic) ---")
        filters = TaskFilterParams(status=None, per_page=200)
        # Note: In api/v1/tasks.py, it DOES NOT pass tenant_id for admins!
        admin_tasks, total = await task_service.list_tasks(filters=filters)
        print(f"Result count: {len(admin_tasks)} (Total: {total})")
        for t in admin_tasks:
            # Only print tasks for this user's tenant for brevity
            if t.tenant_id == user.tenant_id:
                print(f" - [My Tenant] {t.title} (Status: {t.status})")

if __name__ == "__main__":
    asyncio.run(test_api_logic())
