"""
Standalone schema creation script.
Uses a persistent asyncpg connection to create all tables in one shot.
"""
import asyncio
import sys
import os
import logging
sys.path.insert(0, '.')
os.environ["PYTHONIOENCODING"] = "utf-8"

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.WARNING)

async def main():
    db_url = os.getenv("DATABASE_URL")
    dsn = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("?ssl=disable", "")

    import asyncpg
    print("Connecting to database...")
    conn = await asyncpg.connect(dsn, ssl=False, command_timeout=300)
    print("Connected! Creating schema...")

    from app.db.base import Base
    import app.models  # noqa

    from sqlalchemy.schema import CreateTable
    from sqlalchemy.dialects import postgresql

    ddl_statements = []
    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
        ddl_statements.append((table.name, ddl))

    created = 0
    skipped = 0
    failed = 0

    for table_name, ddl in ddl_statements:
        try:
            await conn.execute(ddl)
            print(f"  [OK] Created: {table_name}")
            created += 1
        except asyncpg.exceptions.DuplicateTableError:
            print(f"  [--] Skipped (exists): {table_name}")
            skipped += 1
        except asyncpg.exceptions.DuplicateObjectError:
            print(f"  [--] Skipped (type exists): {table_name}")
            skipped += 1
        except Exception as e:
            print(f"  [FAIL] Failed: {table_name} -> {str(e)[:100]}")
            failed += 1

    await conn.close()
    print(f"\nDone! Created: {created}, Skipped: {skipped}, Failed: {failed}")


if __name__ == "__main__":
    asyncio.run(main())
