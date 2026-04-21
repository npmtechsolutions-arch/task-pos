import asyncio
import os

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv()


def _async_db_url(raw: str) -> str:
    url = raw.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


async def fix_notifications_db():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise SystemExit("DATABASE_URL is not set")

    engine = create_async_engine(_async_db_url(db_url))
    async with engine.begin() as conn:
        # Add tenant_id if missing
        r = await conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='notifications' AND column_name='tenant_id'"
            )
        )
        if not r.fetchone():
            await conn.execute(
                text(
                    "ALTER TABLE notifications "
                    "ADD COLUMN tenant_id VARCHAR(36) "
                    "REFERENCES tenants(id) ON DELETE CASCADE"
                )
            )
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_tenant_id ON notifications (tenant_id)"))
            print("Added tenant_id to notifications")
        else:
            print("tenant_id already exists in notifications")

        # Add dedupe_key if missing
        r = await conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='notifications' AND column_name='dedupe_key'"
            )
        )
        if not r.fetchone():
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN dedupe_key VARCHAR(255)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_dedupe_key ON notifications (dedupe_key)"))
            print("Added dedupe_key to notifications")
        else:
            print("dedupe_key already exists in notifications")

        # Backfill tenant_id from users table where missing
        await conn.execute(
            text(
                "UPDATE notifications n "
                "SET tenant_id = u.tenant_id "
                "FROM users u "
                "WHERE n.user_id = u.id AND n.tenant_id IS NULL"
            )
        )
        print("Backfilled notifications.tenant_id from users")

        # Add unique constraint for (user_id, dedupe_key) if missing
        r = await conn.execute(
            text(
                "SELECT constraint_name FROM information_schema.table_constraints "
                "WHERE table_name='notifications' AND constraint_type='UNIQUE' "
                "AND constraint_name='uq_notifications_user_dedupe_key'"
            )
        )
        if not r.fetchone():
            await conn.execute(
                text(
                    "ALTER TABLE notifications "
                    "ADD CONSTRAINT uq_notifications_user_dedupe_key UNIQUE (user_id, dedupe_key)"
                )
            )
            print("Added unique constraint uq_notifications_user_dedupe_key")
        else:
            print("Unique constraint uq_notifications_user_dedupe_key already exists")

    await engine.dispose()


asyncio.run(fix_notifications_db())

