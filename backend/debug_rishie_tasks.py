
import asyncio
import os
import sys
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add the current directory to sys.path to import app modules
sys.path.insert(0, os.getcwd())

from app.models.user import User
from app.models.task import Task
from app.models.task import TaskAssignment

async def debug_tasks():
    from dotenv import load_dotenv
    load_dotenv()
    
    database_url = os.getenv("DATABASE_URL")
    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Find Rishie
        res = await session.execute(select(User).where(User.email.ilike("rishie%")))
        user = res.scalar_one_or_none()
        if not user:
            print("User Rishie not found")
            return
        
        print(f"Found user: {user.email} (ID: {user.id}) Role: {user.role} Tenant: {user.tenant_id}")
        
        # Check tasks where he is primary assignee
        res = await session.execute(select(Task).where(Task.primary_assignee_id == user.id))
        primary_tasks = res.scalars().all()
        print(f"Tasks as primary assignee: {len(primary_tasks)}")
        for t in primary_tasks:
            print(f" - {t.title} (Status: {t.status}, Tenant: {t.tenant_id})")
            
        # Check tasks where he is in assignments
        from app.models.task import TaskAssignment
        res = await session.execute(select(Task).join(TaskAssignment).where(TaskAssignment.user_id == user.id))
        assigned_tasks = res.scalars().all()
        print(f"Tasks as additional assignee: {len(assigned_tasks)}")
        for t in assigned_tasks:
            print(f" - {t.title} (Status: {t.status})")

if __name__ == "__main__":
    asyncio.run(debug_tasks())
