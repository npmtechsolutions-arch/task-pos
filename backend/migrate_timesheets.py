"""
Migration: Add missing columns to timesheet_entries and fix timesheet ENUM types.
Run once: python migrate_timesheets.py
"""
# -*- coding: utf-8 -*-
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:r7UPnC2N67TIE5HjvJhR5oleeygZ1icwt9nvwuSar5bnvxyY8Oux1pRmAlCxSfp7@168.144.67.169:5440/postgres?ssl=disable"
)


async def run():
    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        print("=== Timesheet Migration Starting ===")

        # 1. Create activity_type_enum if missing
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type_enum') THEN
                    CREATE TYPE activity_type_enum AS ENUM (
                        'development', 'meeting', 'research', 'review',
                        'testing', 'design', 'documentation', 'other'
                    );
                END IF;
            END$$;
        """))
        print("OK: activity_type_enum ready")

        # 2. Create timesheet_status_enum if missing
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timesheet_status_enum') THEN
                    CREATE TYPE timesheet_status_enum AS ENUM (
                        'draft', 'submitted', 'approved', 'rejected'
                    );
                END IF;
            END$$;
        """))
        print("OK: timesheet_status_enum ready")

        # 3. Add missing columns to timesheet_entries
        cols = [
            ("timesheet_entries", "started_at",    "TIMESTAMP"),
            ("timesheet_entries", "ended_at",       "TIMESTAMP"),
            ("timesheet_entries", "updated_at",     "TIMESTAMP DEFAULT NOW()"),
            ("timesheet_entries", "activity_type",  "VARCHAR(50) DEFAULT 'development'"),
            ("timesheet_entries", "task_id",        "VARCHAR(36)"),
            ("timesheet_entries", "project_id",     "VARCHAR(36)"),
            ("timesheets",        "updated_at",     "TIMESTAMP DEFAULT NOW()"),
        ]
        for table, col, coltype in cols:
            try:
                await conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {coltype};"
                ))
                print(f"OK: {table}.{col} added")
            except Exception as e:
                print(f"SKIP: {table}.{col} -> {e}")

        print("=== Migration complete! Restart the backend server. ===")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
