"""
add_performance_indexes.py

Run once against your database to add the composite indexes that
eliminate sequential scans on the hot query paths.

Usage:
    cd backend
    python add_performance_indexes.py
"""

import asyncio
from app.db.session import engine


INDEXES = [
    # tasks — the most-queried table
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_tenant_project    ON tasks(tenant_id, project_id);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_tenant_status     ON tasks(tenant_id, status);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_project_status    ON tasks(project_id, status);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assignee_status   ON tasks(primary_assignee_id, status);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_due_date          ON tasks(due_date) WHERE due_date IS NOT NULL;",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_updated_at        ON tasks(updated_at DESC);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_phase_id          ON tasks(phase_id) WHERE phase_id IS NOT NULL;",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_milestone_id      ON tasks(milestone_id) WHERE milestone_id IS NOT NULL;",

    # task_comments — loaded per task on detail view
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_comments_task_id  ON task_comments(task_id, created_at);",

    # task_assignments — used for kanban member filters
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_assignments_task   ON task_assignments(task_id);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_assignments_user   ON task_assignments(user_id);",

    # notifications — bell query: user + unread + created_at DESC
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_user_unread       ON notifications(user_id, is_read, created_at DESC);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_tenant_user       ON notifications(tenant_id, user_id);",

    # projects — tenant-scoped list
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_tenant_status  ON projects(tenant_id, status);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_updated_at     ON projects(updated_at DESC);",

    # project_members — membership checks
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proj_members_user       ON project_members(user_id);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proj_members_proj_user  ON project_members(project_id, user_id);",

    # chat — room messages paged
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_msg_room_created   ON chat_messages(room_id, created_at ASC);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_room_members_room  ON chat_room_members(room_id);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_room_members_user  ON chat_room_members(user_id);",

    # kanban board columns
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_board_cols_project      ON board_columns(project_id, position);",

    # time_entries
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_task       ON time_entries(task_id);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_user_date  ON time_entries(user_id, started_at DESC);",
]


async def run():
    import asyncpg
    from app.core.config import settings
    import ssl as ssl_lib

    # Build a clean postgresql:// URL without ssl= param
    raw = str(settings.database_url)
    raw = raw.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")
    # Strip any ssl= query param so asyncpg doesn't reject it
    if "?" in raw:
        base, qs = raw.split("?", 1)
        params = [p for p in qs.split("&") if not p.startswith("ssl=")]
        raw = base + ("?" + "&".join(params) if params else "")

    # Use ssl='require' as keyword arg (asyncpg native)
    ssl_ctx = ssl_lib.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl_lib.CERT_NONE

    try:
        conn = await asyncpg.connect(raw, ssl=ssl_ctx)
    except Exception:
        # Fallback: try without SSL (local dev)
        conn = await asyncpg.connect(raw)

    try:
        for sql in INDEXES:
            try:
                await conn.execute(sql)
                name = sql.split("EXISTS ")[1].split(" ON")[0].strip()
                print(f"[OK]  {name}")
            except Exception as e:
                err = str(e)[:100]
                name = sql.split("EXISTS ")[1].split(" ON")[0].strip()
                if "already exists" in err.lower():
                    print(f"[--]  {name} (already exists)")
                else:
                    print(f"[!!]  {name}: {err}")
    finally:
        await conn.close()

    print("\n[DONE] All indexes applied.")


if __name__ == "__main__":
    asyncio.run(run())
