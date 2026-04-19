import argparse
import asyncio
import logging
import sys

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Add backend dir to python path
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from app.db.session import AsyncSessionLocal, engine
from app.db.base import Base

from app.scripts.seeds.tenant_seed import seed_tenants
from app.scripts.seeds.user_seed import seed_users
from app.scripts.seeds.org_seed import seed_org
from app.scripts.seeds.project_seed import seed_projects
from app.scripts.seeds.task_seed import seed_tasks
from app.scripts.seeds.activity_seed import seed_activities

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


async def reset_database(session: AsyncSession):
    """Dangerous: Wipes all tables. Only used with --reset flag."""
    logger.warning("🧨 RESETTING DATABASE: Truncating all tables!")
    await session.execute(text("""
        TRUNCATE TABLE 
        tenants,
        users,
        departments,
        org_teams,
        roles,
        projects,
        tasks,
        task_comments,
        notifications,
        time_entries,
        calendar_events,
        boards,
        board_columns
        CASCADE;
    """))
    await session.flush()
    logger.info("Database reset successful.")


async def run_seed(reset: bool = False):
    """Run all seeder functions sequentially."""
    
    # Optional: Automatically prepare DB metadata 
    # Use Alembic usually instead, but this acts as fallback
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        try:
            if reset:
                await reset_database(session)
                
            tenant = await seed_tenants(session)
            users_dict = await seed_users(session, tenant)
            dept_map = await seed_org(session, tenant, users_dict)
            projects = await seed_projects(session, tenant, users_dict)
            tasks = await seed_tasks(session, tenant, users_dict, projects)
            await seed_activities(session, tenant, users_dict, tasks)
            
            await session.commit()
            logger.info("✅ Database seeding complete!")
        except Exception as e:
            await session.rollback()
            logger.error(f"❌ Error during seeding: {e}")
            raise e

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Database Seeding Script")
    parser.add_argument("--reset", action="store_true", help="Truncate tables before seeding")
    args = parser.parse_args()

    asyncio.run(run_seed(reset=args.reset))
