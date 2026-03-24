import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent))

import asyncio
import uuid
import datetime
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession

# Adjust imports to match the backend structure
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.project import Project, ProjectMember, ProjectMemberRole

async def seed_users():
    async with AsyncSessionLocal() as db:
        # Check if users already exist
        u1_email = 'john@test.com'
        u2_email = 'priya@test.com'
        
        result1 = await db.execute(select(User).where(User.email == u1_email))
        u1 = result1.scalars().first()
        if not u1:
            u1_id = str(uuid.uuid4())
            new_u1 = User(
                id=u1_id,
                email=u1_email,
                first_name='John',
                last_name='Doe',
                password_hash='temp_password',
                is_active=True,
                role='member'
            )
            db.add(new_u1)
            u1 = new_u1
        
        result2 = await db.execute(select(User).where(User.email == u2_email))
        u2 = result2.scalars().first()
        if not u2:
            u2_id = str(uuid.uuid4())
            new_u2 = User(
                id=u2_id,
                email=u2_email,
                first_name='Priya',
                last_name='Sharma',
                password_hash='temp_password',
                is_active=True,
                role='member'
            )
            db.add(new_u2)
            u2 = new_u2
            
        await db.commit()
        await db.refresh(u1)
        await db.refresh(u2)
        
        print(f"Users created: {u1.first_name} ({u1.id}), {u2.first_name} ({u2.id})")

        # Get first project
        result_proj = await db.execute(select(Project))
        project = result_proj.scalars().first()
        if not project:
            print("No project found to add members to!")
            return
            
        print(f"Adding users to project: {project.name}")
        
        for user in [u1, u2]:
            res_mem = await db.execute(select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == user.id
            ))
            member = res_mem.scalars().first()
            if not member:
                new_member = ProjectMember(
                    project_id=project.id,
                    user_id=user.id,
                    role='member'
                )
                db.add(new_member)
                print(f"Added {user.first_name} to project.")
            else:
                print(f"{user.first_name} is already in the project.")
                
        await db.commit()
        print("Done seeding users!")

if __name__ == "__main__":
    asyncio.run(seed_users())
