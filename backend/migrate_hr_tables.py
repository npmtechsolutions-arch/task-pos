"""
migrate_hr_tables.py — Add new HR columns and create termination_requests table.
Run once: python migrate_hr_tables.py
"""
import asyncio
import asyncpg
import ssl as ssl_lib


DDL = [
    # candidates — new columns
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS job_title VARCHAR(150);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS join_date TIMESTAMP;",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS rejection_reason TEXT;",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS generated_email VARCHAR(255);",
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS generated_password VARCHAR(100);",

    # interns — new columns
    "ALTER TABLE interns ADD COLUMN IF NOT EXISTS stipend VARCHAR(50);",
    "ALTER TABLE interns ADD COLUMN IF NOT EXISTS rejection_reason TEXT;",
    "ALTER TABLE interns ADD COLUMN IF NOT EXISTS created_by_id VARCHAR(36);",
    "ALTER TABLE interns ADD COLUMN IF NOT EXISTS approved_by_id VARCHAR(36);",
    "ALTER TABLE interns ADD COLUMN IF NOT EXISTS generated_email VARCHAR(255);",
    "ALTER TABLE interns ADD COLUMN IF NOT EXISTS generated_password VARCHAR(100);",

    # interns — add approval_status enum column
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intern_approval_status_enum') THEN
            CREATE TYPE intern_approval_status_enum AS ENUM ('pending', 'approved', 'rejected');
        END IF;
    END$$;
    """,
    """
    ALTER TABLE interns ADD COLUMN IF NOT EXISTS
        approval_status intern_approval_status_enum DEFAULT 'pending';
    """,

    # termination_requests — new table
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'termination_status_enum') THEN
            CREATE TYPE termination_status_enum AS ENUM ('pending', 'approved', 'rejected');
        END IF;
    END$$;
    """,
    """
    CREATE TABLE IF NOT EXISTS termination_requests (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
        target_user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT,
        last_working_day TIMESTAMP,
        status termination_status_enum DEFAULT 'pending',
        rejection_reason TEXT,
        created_by_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        approved_by_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_terminations_tenant  ON termination_requests(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_terminations_target  ON termination_requests(target_user_id);",
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

    ok = err = 0
    try:
        for sql in DDL:
            stmt = sql.strip()
            if not stmt:
                continue
            try:
                await conn.execute(stmt)
                label = stmt[:60].replace("\n", " ")
                print(f"[OK]  {label}")
                ok += 1
            except Exception as e:
                label = stmt[:60].replace("\n", " ")
                print(f"[!!]  {label}\n      -> {str(e)[:100]}")
                err += 1
    finally:
        await conn.close()

    print(f"\n[DONE] {ok} succeeded, {err} failed.")


if __name__ == "__main__":
    asyncio.run(run())
