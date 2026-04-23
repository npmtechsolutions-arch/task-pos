import asyncio
import os
import sys

sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv()

async def drop_tables():
    import asyncpg
    db_url = os.getenv("DATABASE_URL")
    dsn = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("?ssl=disable", "")
    print("Connecting...")
    conn = await asyncpg.connect(dsn, ssl=False)
    
    tables_to_drop = [
        "candidates",
        "interns",
        "leaves",
        "notifications"
    ]
    
    for table in tables_to_drop:
        try:
            await conn.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
            print(f"Dropped {table}")
        except Exception as e:
            print(f"Failed to drop {table}: {e}")

    await conn.close()
    print("Done dropping tables.")

if __name__ == "__main__":
    asyncio.run(drop_tables())
