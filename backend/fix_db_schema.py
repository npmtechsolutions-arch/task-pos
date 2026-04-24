import asyncio
import os
import sys

sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv()

async def fix_schema():
    import asyncpg
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found.")
        return

    dsn = db_url.replace("postgresql+asyncpg://", "postgresql://")
    if "?" in dsn:
        dsn = dsn.split("?")[0]

    print("=" * 60)
    print("  DATABASE SCHEMA REPAIR")
    print("=" * 60)
    print(f"Connecting to: {dsn}")
    
    try:
        conn = await asyncpg.connect(dsn, ssl=False, timeout=15)
        print("Connected!")
    except Exception as e:
        print(f"Connection failed: {e}")
        print("Attempting with SSL...")
        try:
            conn = await asyncpg.connect(dsn, ssl='require', timeout=15)
            print("Connected with SSL!")
        except Exception as e2:
            print(f"Failed to connect: {e2}")
            return

    # Columns to ensure exist
    queries = [
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255);",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE interns ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE leaves ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
        "ALTER TABLE task_files ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);",
    ]
    
    print("\n[1/2] Adding missing columns...")
    for q in queries:
        try:
            await conn.execute(q)
            print(f"      [OK] {q.split(' ')[2]}.{q.split(' ')[5]}")
        except Exception as e:
            print(f"      [!] Error on {q.split(' ')[2]}.{q.split(' ')[5]}: {e}")
            
    print("\n[2/2] Updating existing rows with default tenant...")
    try:
        # Get the first tenant
        tenant_row = await conn.fetchrow("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
        if tenant_row:
            tenant_id = tenant_row['id']
            tables = ["notifications", "candidates", "interns", "leaves", "documents", "task_files"]
            for table in tables:
                res = await conn.execute(f"UPDATE {table} SET tenant_id = $1 WHERE tenant_id IS NULL", tenant_id)
                print(f"      [OK] Updated {table}: {res}")
        else:
            print("      [SKIP] No tenants found to use as default.")
    except Exception as e:
        print(f"      [!] Error updating rows: {e}")

    await conn.close()
    print("\n" + "=" * 60)
    print("  SCHEMA REPAIR COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(fix_schema())
