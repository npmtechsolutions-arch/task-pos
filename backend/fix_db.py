import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


def _async_db_url(raw: str) -> str:
    url = raw.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


async def fix_db():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise SystemExit("DATABASE_URL is not set")
    engine = create_async_engine(_async_db_url(db_url))
    async with engine.begin() as conn:
        # Add missing columns to projects table
        columns_to_add = [
            ("prd_url", "TEXT"),
            ("github_url", "VARCHAR(500)"),
            ("visibility", "VARCHAR(20) DEFAULT 'private'"),
            ("settings", "JSONB DEFAULT '{\"allow_task_creation\": true, \"allow_time_tracking\": true, \"default_task_status\": \"todo\", \"working_days\": [1, 2, 3, 4, 5], \"notification_rules\": {\"milestone_alert_days\": 3}, \"access_control\": {\"allow_member_invite\": true}}'"),
            ("custom_fields", "JSONB DEFAULT '{}'"),
            ("total_tasks", "INTEGER DEFAULT 0"),
            ("completed_tasks", "INTEGER DEFAULT 0"),
            ("in_progress_tasks", "INTEGER DEFAULT 0"),
            ("progress_percentage", "FLOAT DEFAULT 0.0"),
            ("total_estimated_hours", "FLOAT DEFAULT 0.0"),
            ("total_actual_hours", "FLOAT DEFAULT 0.0"),
            ("archived_at", "TIMESTAMP"),
        ]
        
        for col_name, col_type in columns_to_add:
            result = await conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='projects' AND column_name='{col_name}'"))
            if not result.fetchone():
                await conn.execute(text(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}"))
                print(f"Added {col_name} to projects")
            else:
                print(f"{col_name} already exists in projects")

        # Versioned PRD files (project_prd_files)
        await conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS project_prd_files (
                    id VARCHAR(36) PRIMARY KEY,
                    project_id VARCHAR(36) NOT NULL
                        REFERENCES projects(id) ON DELETE CASCADE,
                    version INTEGER NOT NULL DEFAULT 1,
                    file_name VARCHAR(512) NOT NULL,
                    storage_key TEXT NOT NULL,
                    file_type VARCHAR(255),
                    file_size_bytes INTEGER,
                    uploaded_by VARCHAR(36) NOT NULL
                        REFERENCES users(id),
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
                )
                """
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_project_prd_files_project_id ON project_prd_files (project_id)"
            )
        )
        print("Ensured project_prd_files table and index exist")

asyncio.run(fix_db())