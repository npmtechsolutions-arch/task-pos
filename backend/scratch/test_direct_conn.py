import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    url = os.getenv("DATABASE_URL")
    print(f"Testing connection to: {url}")
    try:
        # We replace the driver for asyncpg direct connection if needed
        dsn = url.replace("postgresql+asyncpg://", "postgresql://")
        conn = await asyncpg.connect(dsn, timeout=10)
        print("Successfully connected!")
        version = await conn.fetchval("SELECT version()")
        print(f"Database version: {version}")
        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
