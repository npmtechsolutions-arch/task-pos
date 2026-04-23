import asyncio
import os
import sys

sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv()

async def fix_enums():
    import asyncpg
    db_url = os.getenv("DATABASE_URL")
    dsn = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("?ssl=disable", "")
    print("Connecting...")
    conn = await asyncpg.connect(dsn, ssl=False)
    
    missing_user_roles = ['hr']
    # Wait, in the check_enums output, the userrole values are UPPERCASE!
    # userrole: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']
    # If they are uppercase in Postgres but lowercase in Python, wait...
    # In app/models/user.py:
    # class UserRole(str, PyEnum):
    #     OWNER = "owner"
    # SQLAlchemy maps the Python Enum name or value? If native_enum=False, it stores the value. If native_enum=True, it stores the NAME of the enum by default unless values_callable is used.
    # Ah! SQLAlchemy by default uses the Enum KEY (e.g. OWNER, ADMIN), NOT the value (e.g. 'owner', 'admin') for native Postgres enums!
    # So we need to add the UPPERCASE keys to the enum!
    
    queries = [
        "ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'HR';",
        
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'USER_HIRED';",
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'USER_FIRED';",
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'MESSAGE';",
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'CANDIDATE_SUBMITTED';",
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'CANDIDATE_APPROVED';",
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'CANDIDATE_REJECTED';",
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'LEAVE_REQUESTED';",
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'LEAVE_APPROVED';",
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'LEAVE_REJECTED';",
        "ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'PRD_UPLOADED';",
    ]
    
    for q in queries:
        try:
            # asyncpg can't run ALTER TYPE inside a transaction block in some cases, so we run them individually
            # with autocommit
            await conn.execute(q)
            print(f"Executed: {q}")
        except Exception as e:
            print(f"Error on {q}: {e}")

    await conn.close()
    print("Done fixing enums.")

if __name__ == "__main__":
    asyncio.run(fix_enums())
