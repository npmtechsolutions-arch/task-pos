import sys, asyncio, os
sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv()
import asyncpg

async def fix():
    dsn = os.getenv('DATABASE_URL').replace('postgresql+asyncpg://','postgresql://').replace('?ssl=disable','')
    conn = await asyncpg.connect(dsn, ssl=False)
    try:
        await conn.execute("CREATE TYPE hrrole AS ENUM ('manager', 'hr', 'team_leader', 'member')")
        print('hrrole enum created')
    except asyncpg.exceptions.DuplicateObjectError:
        print('hrrole exists')
    try:
        await conn.execute("""
            CREATE TABLE hr_assignments (
                id VARCHAR(36) PRIMARY KEY,
                department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                hr_role hrrole NOT NULL DEFAULT 'member',
                reports_to_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
                created_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_hr_dept_user UNIQUE (department_id, user_id)
            )
        """)
        print('hr_assignments created')
    except asyncpg.exceptions.DuplicateTableError:
        print('hr_assignments exists')
    await conn.close()

asyncio.run(fix())
