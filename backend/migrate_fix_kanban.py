"""Apply the task_activity.tenant_id nullable migration."""
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def run():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("ALTER TABLE task_activity ALTER COLUMN tenant_id DROP NOT NULL"))
            await db.commit()
            print("✅ Migration applied: task_activity.tenant_id is now nullable")
        except Exception as e:
            print(f"⚠️  Migration skipped (already nullable or error): {e}")

asyncio.run(run())
