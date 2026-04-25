import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://postgres:r7UPnC2N67TIE5HjvJhR5oleeygZ1icwt9nvwuSar5bnvxyY8Oux1pRmAlCxSfp7@168.144.67.169:5440/postgres?ssl=disable"

async def run():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT id FROM users WHERE is_active = true LIMIT 1"))
        print(res.fetchall())
    await engine.dispose()

asyncio.run(run())
