import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    url = os.getenv("DATABASE_URL")
    # Clean URL for asyncpg
    if "?" in url:
        dsn = url.split("?")[0]
    else:
        dsn = url
    
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")
    
    print(f"Testing direct connection to: {dsn} (ssl=False)")
    try:
        conn = await asyncpg.connect(dsn, ssl=False, timeout=10)
        print("Successfully connected!")
        version = await conn.fetchval("SELECT version()")
        print(f"Database version: {version}")
        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")
        # Try with ssl='require'
        print(f"Testing direct connection to: {dsn} (ssl='require')")
        try:
            conn = await asyncpg.connect(dsn, ssl='require', timeout=10)
            print("Successfully connected with ssl='require'!")
            await conn.close()
        except Exception as e2:
            print(f"Connection failed with ssl='require': {e2}")

if __name__ == "__main__":
    asyncio.run(test())
