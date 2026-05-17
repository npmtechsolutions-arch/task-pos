"""
Add B-tree indexes on users.first_name, last_name (prefix-search optimized)
and a GIN trigram index on email for fast substring search.
Run once: cd backend && python migrate_user_search_index.py
"""
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def run():
    async with AsyncSessionLocal() as db:
        ops = [
            # Regular B-tree indexes for prefix-match (term%) on names
            ("idx_users_first_name_lower",
             "CREATE INDEX IF NOT EXISTS idx_users_first_name_lower ON users (lower(first_name) varchar_pattern_ops)"),
            ("idx_users_last_name_lower",
             "CREATE INDEX IF NOT EXISTS idx_users_last_name_lower ON users (lower(last_name) varchar_pattern_ops)"),
            ("idx_users_email_lower",
             "CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email) varchar_pattern_ops)"),
            # Composite covering index for tenant_id + is_active (most frequent filter)
            ("idx_users_tenant_active",
             "CREATE INDEX IF NOT EXISTS idx_users_tenant_active ON users (tenant_id, is_active) WHERE is_active = true"),
        ]

        for name, sql in ops:
            try:
                await db.execute(text(sql))
                await db.commit()
                print(f"OK: {name}")
            except Exception as e:
                print(f"SKIP {name}: {e}")
                await db.rollback()

        # Try pg_trgm for email substring search (optional, needs extension)
        try:
            await db.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
            await db.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops)"
            ))
            await db.commit()
            print("OK: pg_trgm email index created")
        except Exception as e:
            print(f"SKIP trigram (pg_trgm not available): {e}")
            await db.rollback()

        print("\nDone. User search indexes applied.")

asyncio.run(run())
