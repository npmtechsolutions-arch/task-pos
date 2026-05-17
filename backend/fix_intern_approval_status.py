"""
fix_intern_approval_status.py
Adds approval_status column to interns table using text cast for the default.
Run once: python fix_intern_approval_status.py
"""
import asyncio
import asyncpg
import ssl as ssl_lib


DDL = [
    # Drop default first, add column, set default — avoids enum cast error
    """
    ALTER TABLE interns
        ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';
    """,
    # Backfill any NULLs
    "UPDATE interns SET approval_status = 'pending' WHERE approval_status IS NULL;",
]


async def run():
    from app.core.config import settings

    raw = str(settings.database_url)
    raw = raw.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")
    if "?" in raw:
        base, qs = raw.split("?", 1)
        params = [p for p in qs.split("&") if not p.startswith("ssl=")]
        raw = base + ("?" + "&".join(params) if params else "")

    ssl_ctx = ssl_lib.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl_lib.CERT_NONE

    try:
        conn = await asyncpg.connect(raw, ssl=ssl_ctx)
    except Exception:
        conn = await asyncpg.connect(raw)

    try:
        for sql in DDL:
            stmt = sql.strip()
            if not stmt:
                continue
            try:
                await conn.execute(stmt)
                print(f"[OK]  {stmt[:70].replace(chr(10), ' ')}")
            except Exception as e:
                print(f"[!!]  {stmt[:70].replace(chr(10), ' ')}\n      -> {str(e)[:120]}")
    finally:
        await conn.close()

    print("\n[DONE]")


if __name__ == "__main__":
    asyncio.run(run())
