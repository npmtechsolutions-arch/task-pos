"""
add_notification_enum_values.py
Adds new notification type enum values to the PostgreSQL enum type.
Safe to re-run — uses ADD VALUE IF NOT EXISTS.
Run: python add_notification_enum_values.py
"""
import asyncio
import asyncpg
import ssl as ssl_lib

NEW_VALUES = [
    "system_alert",
    "hr_action",
]

# Common names SQLAlchemy may generate for the enum type
POSSIBLE_TYPE_NAMES = [
    "notificationtype",
    "notification_type",
    "notificationtypeenum",
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
        # Discover the actual enum type name
        rows = await conn.fetch("""
            SELECT typname FROM pg_type
            WHERE typtype = 'e'
              AND typname ILIKE '%notification%'
        """)
        found_types = [r['typname'] for r in rows]
        print(f"Found enum types: {found_types}")

        if not found_types:
            print("[INFO] No native notification enum type found — column is VARCHAR, no migration needed.")
            return

        for type_name in found_types:
            for val in NEW_VALUES:
                sql = f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{val}';"
                try:
                    await conn.execute(sql)
                    print(f"[OK]  Added '{val}' to {type_name}")
                except Exception as e:
                    err = str(e)
                    if "already exists" in err.lower():
                        print(f"[--]  '{val}' already in {type_name}")
                    else:
                        print(f"[!!]  {sql[:60]} -> {err[:80]}")

        # Also check if notification_type column is VARCHAR — if so, nothing needed
        col_type = await conn.fetchval("""
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'notifications'
              AND column_name = 'notification_type'
        """)
        print(f"\n[INFO] notifications.notification_type column type = {col_type}")

    finally:
        await conn.close()

    print("\n[DONE]")


if __name__ == "__main__":
    asyncio.run(run())
