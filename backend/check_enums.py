import asyncio, sys, os
sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv()
import asyncpg

async def check():
    dsn = os.getenv('DATABASE_URL').replace('postgresql+asyncpg://','postgresql://').replace('?ssl=disable','')
    conn = await asyncpg.connect(dsn, ssl=False)
    r1 = await conn.fetch("SELECT unnest(enum_range(NULL::tenantstatus))")
    print('tenantstatus:', [r[0] for r in r1])
    r2 = await conn.fetch("SELECT unnest(enum_range(NULL::userrole))")
    print('userrole:', [r[0] for r in r2])
    r3 = await conn.fetch("SELECT unnest(enum_range(NULL::projectstatus))")
    print('projectstatus:', [r[0] for r in r3])
    r4 = await conn.fetch("SELECT unnest(enum_range(NULL::notificationtype))")
    print('notificationtype:', [r[0] for r in r4])
    await conn.close()

asyncio.run(check())
