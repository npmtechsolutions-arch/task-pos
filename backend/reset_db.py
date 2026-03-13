"""Script to completely drop and recreate all tables in the remote database."""

import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.db.base import Base

# Import all models to ensure they are registered with Base metadata
from app.models.landing import *
from app.models.user import *
from app.models.task import *
from app.models.project import *
from app.models.board import *
from app.models.notification import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def reset_database():
    """Drops all tables and recreates them."""
    
    logger.info(f"Connecting to database: {settings.async_database_url}")
    
    # We create a temporary engine to drop and create things
    engine = create_async_engine(settings.async_database_url, echo=False)
    
    try:
        async with engine.begin() as conn:
            # PostgreSQL specific: drop all tables in public schema cascade
            logger.info("Dropping all existing tables with CASCADE...")
            await conn.execute(text("DROP SCHEMA public CASCADE;"))
            await conn.execute(text("CREATE SCHEMA public;"))
            await conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
            logger.info("Schema public reset.")
            
            logger.info("Creating all tables from current models...")
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Tables created successfully.")
    
    except Exception as e:
        logger.error(f"Error resetting database: {e}")
    finally:
        await engine.dispose()
        logger.info("Database reset process finished.")

if __name__ == "__main__":
    asyncio.run(reset_database())
