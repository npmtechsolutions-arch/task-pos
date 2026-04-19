"""
Full Database Setup Script - v3
Creates ENUMs first, then tables, then seeds all data.
"""
import asyncio
import sys
import os
import uuid
import random
import logging
from datetime import datetime, timedelta

sys.path.insert(0, '.')
os.environ["PYTHONIOENCODING"] = "utf-8"

from dotenv import load_dotenv
load_dotenv()
logging.basicConfig(level=logging.WARNING)

DB_URL = os.getenv("DATABASE_URL")

async def main():
    import asyncpg
    from sqlalchemy.schema import CreateTable
    from sqlalchemy.dialects import postgresql as pg_dialect_module
    from sqlalchemy import Enum as SAEnum
    from app.db.base import Base

    dsn = DB_URL.replace("postgresql+asyncpg://", "postgresql://").replace("?ssl=disable", "")

    print("=" * 60)
    print("  TASK-POS ENTERPRISE DATABASE SETUP v3")
    print("=" * 60)
    print(f"\n[1/3] Connecting...")
    conn = await asyncpg.connect(dsn, ssl=False, command_timeout=300)
    print("      Connected!")

    dialect = pg_dialect_module.dialect()

    # ── STEP 1: CREATE ALL ENUM TYPES FIRST ─────────────────────
    print(f"\n[2/3] Creating ENUM types and tables...")
    enum_created = 0
    enum_skipped = 0

    # Collect all enum types from all tables
    seen_enums = set()
    for table in Base.metadata.sorted_tables:
        for col in table.columns:
            if isinstance(col.type, SAEnum) and col.type.name:
                enum_name = col.type.name
                if enum_name not in seen_enums:
                    seen_enums.add(enum_name)
                    values = col.type.enums
                    values_sql = ", ".join(f"'{v}'" for v in values)
                    try:
                        await conn.execute(f"CREATE TYPE {enum_name} AS ENUM ({values_sql})")
                        print(f"      [ENUM+] {enum_name}")
                        enum_created += 1
                    except asyncpg.exceptions.DuplicateObjectError:
                        print(f"      [ENUM=] {enum_name} (exists)")
                        enum_skipped += 1
                    except Exception as e:
                        print(f"      [ENUM!] {enum_name}: {str(e)[:60]}")

    # ── STEP 2: CREATE ALL TABLES ────────────────────────────────
    created = skipped = failed = 0
    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=dialect))
        # Remove inline enum definitions — they're already created above
        try:
            await conn.execute(ddl)
            print(f"      [TABLE+] {table.name}")
            created += 1
        except asyncpg.exceptions.DuplicateTableError:
            print(f"      [TABLE=] {table.name} (exists)")
            skipped += 1
        except Exception as e:
            err = str(e)[:80]
            print(f"      [TABLE!] {table.name}: {err}")
            failed += 1

    print(f"\n      Enums:  {enum_created} created, {enum_skipped} skipped")
    print(f"      Tables: {created} created, {skipped} skipped, {failed} failed")

    # ── STEP 3: SEED DATA ────────────────────────────────────────
    print(f"\n[3/3] Seeding enterprise data...")

    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

    now = datetime.utcnow()

    # --- Tenant ---
    tenant_id = str(uuid.uuid4())
    try:
        await conn.execute("""
            INSERT INTO tenants (id, name, slug, plan, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5::tenantstatus, $6, $7)
            ON CONFLICT (slug) DO NOTHING
        """, tenant_id, "ProjectFlow Corp", "projectflow", "enterprise", "ACTIVE", now, now)
        row = await conn.fetchrow("SELECT id FROM tenants WHERE slug = 'projectflow'")
        tenant_id = row['id']
        print(f"      [OK] Tenant: ProjectFlow Corp")
    except Exception as e:
        print(f"      [FAIL] Tenant: {e}")
        await conn.close()
        return

    # --- Users ---
    users_data = [
        ("admin",    "Super",   "Admin",    "admin@projectflow.com",     "271527",      "admin"),
        ("pm",       "Project", "Manager",  "pm@projectflow.com",        "Password@123","manager"),
        ("dev1",     "Senior",  "Developer","dev1@projectflow.com",      "Password@123","member"),
        ("designer", "Lead",    "Designer", "designer@projectflow.com",  "Password@123","member"),
        ("tester",   "QA",      "Engineer", "tester@projectflow.com",    "Password@123","member"),
    ]

    user_ids = {}
    for key, fname, lname, email, pwd, role in users_data:
        uid = str(uuid.uuid4())
        hashed = pwd_ctx.hash(pwd)
        try:
            await conn.execute("""
                INSERT INTO users (id, tenant_id, email, first_name, last_name, password_hash, role, status, is_active, is_verified, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7::userrole,$8::userstatus,$9,$10,$11,$12)
                ON CONFLICT (email) DO NOTHING
            """, uid, tenant_id, email, fname, lname, hashed, role.upper(), "ACTIVE", True, True, now, now)
            row = await conn.fetchrow("SELECT id FROM users WHERE email=$1", email)
            user_ids[key] = row['id']
            marker = " <-- SUPER ADMIN LOGIN" if key == "admin" else ""
            print(f"      [OK] User: {email}{marker}")
        except Exception as e:
            print(f"      [FAIL] User {email}: {e}")

    if not user_ids:
        print("      No users created, aborting seed.")
        await conn.close()
        return

    # --- Departments + HR Assignments ---
    dept_data = [
        ("Engineering", "admin"),
        ("Marketing",   "pm"),
        ("HR",          "admin"),
        ("Finance",     "admin"),
    ]
    dept_ids = {}
    for dept_name, mgr_key in dept_data:
        did = str(uuid.uuid4())
        mgr_id = user_ids.get(mgr_key, user_ids["admin"])
        try:
            await conn.execute("""
                INSERT INTO departments (id, name, manager_id, created_by, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING
            """, did, dept_name, mgr_id, user_ids["admin"], now, now)
            row = await conn.fetchrow("SELECT id FROM departments WHERE name=$1", dept_name)
            dept_ids[dept_name] = row['id']
            print(f"      [OK] Department: {dept_name}")
        except Exception as e:
            print(f"      [FAIL] Dept {dept_name}: {e}")

    # --- Projects + Members + Boards + Columns + Tasks ---
    projects = [
        ("Mobile App Development",  "MOB"),
        ("POS Billing System",      "POS"),
        ("Website Redesign",        "WEB"),
        ("Marketing Campaign Q1",   "MKT"),
        ("Internal HR System",      "HRS"),
    ]

    task_titles = [
        "Setup project repository and CI/CD pipeline",
        "Design database schema and ERD",
        "Implement user authentication module",
        "Build REST API for core features",
        "Create responsive dashboard UI components",
        "Write unit and integration tests",
        "Integrate third-party APIs",
        "Setup logging and monitoring tools",
        "Conduct code review sessions",
        "Deploy to production and run smoke tests",
    ]

    priorities = ["low", "medium", "high", "urgent"]
    assignee_keys = ["dev1", "designer", "tester"]

    total_projects = 0
    total_tasks = 0

    for proj_name, proj_key in projects:
        pid = str(uuid.uuid4())
        try:
            await conn.execute("""
                INSERT INTO projects (id, tenant_id, name, key, description, status, visibility, owner_id, budget, budget_spent, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6::projectstatus,$7::projectvisibility,$8,$9,$10,$11,$12)
                ON CONFLICT (key) DO NOTHING
            """, pid, tenant_id, proj_name, proj_key,
                f"{proj_name} - Managed by ProjectFlow Enterprise.",
                "ACTIVE", "INTERNAL", user_ids["pm"],
                float(random.randint(50,200)*1000), float(random.randint(5,30)*1000),
                now, now)

            row = await conn.fetchrow("SELECT id FROM projects WHERE key=$1", proj_key)
            pid = row['id']
            print(f"      [OK] Project: {proj_name}")
            total_projects += 1

            # Members
            for ukey, prole in [("admin","ADMIN"),("pm","MANAGER"),("dev1","MEMBER"),("designer","MEMBER"),("tester","MEMBER")]:
                if ukey in user_ids:
                    await conn.execute("""
                        INSERT INTO project_members (id, project_id, user_id, role, joined_at)
                        VALUES ($1,$2,$3,$4::projectmemberrole,$5) ON CONFLICT DO NOTHING
                    """, str(uuid.uuid4()), pid, user_ids[ukey], prole, now)

            # Board
            bid = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO boards (id, tenant_id, project_id, name, settings, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) ON CONFLICT DO NOTHING
            """, bid, tenant_id, pid, f"{proj_name} Board",
                '{"wip_limits_enabled":false,"show_card_cover":true,"compact_mode":false}', now, now)
            board_row = await conn.fetchrow("SELECT id FROM boards WHERE project_id=$1", pid)
            board_id = board_row['id']

            # Columns
            columns = [
                ("Backlog",     "BACKLOG",     1, "#94A3B8"),
                ("To Do",       "TODO",        2, "#60A5FA"),
                ("In Progress", "IN_PROGRESS", 3, "#F59E0B"),
                ("Review",      "REVIEW",      4, "#A78BFA"),
                ("Done",        "DONE",        5, "#34D399"),
            ]
            col_ids = {}
            for cname, ctype, pos, color in columns:
                cid = str(uuid.uuid4())
                await conn.execute("""
                    INSERT INTO board_columns (id, board_id, name, position, column_type, color, created_at, updated_at)
                    VALUES ($1,$2,$3,$4,$5::boardcolumntype,$6,$7,$8) ON CONFLICT DO NOTHING
                """, cid, board_id, cname, pos, ctype, color, now, now)
                row = await conn.fetchrow("SELECT id FROM board_columns WHERE board_id=$1 AND name=$2", board_id, cname)
                col_ids[cname] = row['id']

            # Tasks
            col_names = list(col_ids.keys())
            status_map = {"Backlog":"TODO","To Do":"TODO","In Progress":"IN_PROGRESS","Review":"REVIEW","Done":"DONE"}
            priorities_upper = [p.upper() for p in priorities]
            for i, title in enumerate(task_titles):
                col_name = col_names[i % len(col_names)]
                status_val = status_map[col_name]
                assignee_key = assignee_keys[i % len(assignee_keys)]
                assignee_id = user_ids.get(assignee_key)
                priority = priorities_upper[i % len(priorities_upper)]
                task_id = str(uuid.uuid4())
                task_created = now - timedelta(days=random.randint(0,20))
                await conn.execute("""
                    INSERT INTO tasks (id, tenant_id, project_id, title, description, task_type, status, priority, primary_assignee_id, reporter_id, board_column_id, estimated_hours, actual_hours, priority_score, created_at, updated_at)
                    VALUES ($1,$2,$3,$4,$5,$6::tasktype,$7::taskstatus,$8::taskpriority,$9,$10,$11,$12,$13,$14,$15,$16)
                    ON CONFLICT DO NOTHING
                """, task_id, tenant_id, pid, title,
                    f"Task: {title}. Follow the project guidelines and update status accordingly.",
                    "task", status_val, priority, assignee_id, user_ids["pm"],
                    col_ids[col_name],
                    float(random.randint(2,16)), float(random.randint(0,8)),
                    float(random.randint(1,10)), task_created, now)

                await conn.execute("""
                    INSERT INTO task_assignments (id, task_id, tenant_id, user_id, is_primary, assigned_by, assigned_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING
                """, str(uuid.uuid4()), task_id, tenant_id, assignee_id, True, user_ids["pm"], now)
                total_tasks += 1

        except Exception as e:
            print(f"      [FAIL] Project {proj_name}: {e}")

    await conn.close()

    print("\n" + "=" * 60)
    print("  DATABASE SETUP COMPLETE!")
    print("=" * 60)
    print(f"\n  LOGIN CREDENTIALS:")
    print(f"  ┌─────────────────────────────────────────────┐")
    print(f"  |  Super Admin : admin@projectflow.com        |")
    print(f"  |  Password    : 271527                       |")
    print(f"  └─────────────────────────────────────────────┘")
    print(f"\n  Projects : {total_projects}")
    print(f"  Tasks    : {total_tasks}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
