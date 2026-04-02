import asyncio
import asyncpg
import sys
from urllib.parse import urlparse, parse_qs

async def test_conn():
    # Use the expected URL
    url = "postgresql://akk24:W3Xn_q98I9_mO@84.247.168.106:5432/task-pos-db"
    
    print(f"Testing connection to {url}")
    try:
        # Try with ssl='require'
        conn = await asyncpg.connect(url, ssl='require')
        print("Success with ssl='require'!")
        await conn.close()
        return
    except Exception as e:
        print(f"Failed with ssl='require': {e}")

    try:
        # Try with ssl=True
        conn = await asyncpg.connect(url, ssl=True)
        print("Success with ssl=True!")
        await conn.close()
        return
    except Exception as e:
        print(f"Failed with ssl=True: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
