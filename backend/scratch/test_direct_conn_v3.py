import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    url = os.getenv("DATABASE_URL")
    print(f"Testing connection to: {url}")
    try:
        # Use the URL EXACTLY as provided
        conn = await asyncpg.connect(url, timeout=10)
        print("Successfully connected!")
        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
