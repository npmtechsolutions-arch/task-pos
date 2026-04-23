import asyncio
import os
import sys

sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv()

async def fix_schema():
    import asyncpg
    db_url = os.getenv("DATABASE_URL")
    dsn = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("?ssl=disable", "")
    print("Connecting...")
    conn = await asyncpg.connect(dsn, ssl=False)
    
    queries = [
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255);",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS created_by_id VARCHAR(36);",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS approved_by_id VARCHAR(36);",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;",
        "ALTER TABLE interns ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE leaves ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE task_files ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
    ]
    
    for q in queries:
        try:
            await conn.execute(q)
            print(f"Executed: {q}")
        except Exception as e:
            print(f"Error on {q}: {e}")
            
    # Also, we should populate tenant_id for existing rows so we don't violate constraints later
    try:
        tenant_id = await conn.fetchval("SELECT id FROM tenants LIMIT 1")
        if tenant_id:
            await conn.execute(f"UPDATE notifications SET tenant_id = '{tenant_id}' WHERE tenant_id IS NULL;")
            await conn.execute(f"UPDATE candidates SET tenant_id = '{tenant_id}' WHERE tenant_id IS NULL;")
            await conn.execute(f"UPDATE interns SET tenant_id = '{tenant_id}' WHERE tenant_id IS NULL;")
            await conn.execute(f"UPDATE leaves SET tenant_id = '{tenant_id}' WHERE tenant_id IS NULL;")
    except Exception as e:
        print(f"Error updating existing rows: {e}")

    await conn.close()
    print("Done fixing schema.")

if __name__ == "__main__":
    asyncio.run(fix_schema())
