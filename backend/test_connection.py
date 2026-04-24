import asyncio
import asyncpg
import os
import sys
from dotenv import load_dotenv

# Ensure we can find the .env file
load_dotenv()

async def test_db_reachability():
    """Test if the database is reachable from this machine."""
    url = os.getenv("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not found in .env file.")
        return

    print("=" * 60)
    print("  DATABASE REACHABILITY TEST")
    print("=" * 60)
    print(f"URL: {url}")
    
    # Strip +asyncpg for direct asyncpg test
    clean_url = url.replace("postgresql+asyncpg://", "postgresql://")
    if "?" in clean_url:
        dsn = clean_url.split("?")[0]
        params = clean_url.split("?")[1]
    else:
        dsn = clean_url
        params = ""

    print(f"\n[1/2] Testing TCP Connection to Host...")
    # Extract host and port from DSN
    try:
        from urllib.parse import urlparse
        parsed = urlparse(dsn)
        host = parsed.hostname
        port = parsed.port or 5432
        print(f"      Host: {host}, Port: {port}")
    except Exception as e:
        print(f"      Failed to parse DSN: {e}")
        return

    print(f"\n[2/2] Testing asyncpg handshake...")
    try:
        # We try without SSL first, then with SSL
        print("      Attempting connection (ssl=False)...")
        conn = await asyncio.wait_for(asyncpg.connect(dsn, ssl=False), timeout=15)
        print("      SUCCESS: Connected to database!")
        version = await conn.fetchval("SELECT version()")
        print(f"      Database Version: {version}")
        await conn.close()
    except asyncio.TimeoutError:
        print("      FAILED: Connection timed out. The server or port is unreachable.")
    except Exception as e:
        print(f"      FAILED (ssl=False): {e}")
        print("\n      Attempting connection (ssl='require')...")
        try:
            conn = await asyncio.wait_for(asyncpg.connect(dsn, ssl='require'), timeout=15)
            print("      SUCCESS: Connected to database with SSL!")
            await conn.close()
        except Exception as e2:
            print(f"      FAILED (ssl='require'): {e2}")

    print("\n" + "=" * 60)
    print("  TEST COMPLETE")
    print("=" * 60)
    print("\nIf both failed with 'The network location cannot be reached', check:")
    print("1. Your internet connection and VPN.")
    print("2. If your firewall blocks port 5440.")
    print("3. If your current IP is whitelisted in the DB security settings.")

if __name__ == "__main__":
    asyncio.run(test_db_reachability())
