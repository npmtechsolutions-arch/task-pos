"""Final clean seeder - all tables exist, just seed the data."""
import asyncio, sys, os, uuid, random, logging
from datetime import datetime, timedelta
sys.path.insert(0, '.')
os.environ["PYTHONIOENCODING"] = "utf-8"
from dotenv import load_dotenv; load_dotenv()
logging.basicConfig(level=logging.WARNING)

async def main():
    import asyncpg
    from passlib.context import CryptContext

    dsn = os.getenv('DATABASE_URL').replace('postgresql+asyncpg://','postgresql://').replace('?ssl=disable','')
    conn = await asyncpg.connect(dsn, ssl=False, command_timeout=120)
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    now = datetime.utcnow()

    print("Seeding database...")

    # TENANT
    tenant_id = str(uuid.uuid4())
    existing = await conn.fetchrow("SELECT id FROM tenants WHERE slug='projectflow'")
    if existing:
        tenant_id = existing['id']
        print(f"  Tenant: exists ({tenant_id[:8]}...)")
    else:
        await conn.execute("""
            INSERT INTO tenants (id, name, slug, plan, status, settings, branding, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5::tenantstatus,$6::jsonb,$7::jsonb,$8,$9)
        """, tenant_id, "ProjectFlow Corp", "projectflow", "enterprise", "ACTIVE",
            '{}', '{}', now, now)
        print(f"  Tenant: created")

    # USERS
    users_data = [
        ("admin",    "Super",   "Admin",    "admin@projectflow.com",    "271527",       "ADMIN"),
        ("pm",       "Project", "Manager",  "pm@projectflow.com",       "Password@123", "MANAGER"),
        ("dev1",     "Senior",  "Developer","dev1@projectflow.com",     "Password@123", "MEMBER"),
        ("designer", "Lead",    "Designer", "designer@projectflow.com", "Password@123", "MEMBER"),
        ("tester",   "QA",      "Engineer", "tester@projectflow.com",   "Password@123", "MEMBER"),
    ]
    user_ids = {}
    for key, fname, lname, email, pwd, role in users_data:
        ex = await conn.fetchrow("SELECT id FROM users WHERE email=$1", email)
        if ex:
            user_ids[key] = ex['id']
            print(f"  User: {email} (exists)")
        else:
            uid = str(uuid.uuid4())
            hashed = pwd_ctx.hash(pwd)
            await conn.execute("""
                INSERT INTO users (id, tenant_id, email, first_name, last_name, password_hash, role, status, is_active, is_verified, timezone, language, preferences, notification_settings, mfa_enabled, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7::userrole,$8::userstatus,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,$17)
            """, uid, tenant_id, email, fname, lname, hashed, role, "ACTIVE", True, True,
                "UTC", "en", '{}', '{}', False, now, now)
            user_ids[key] = uid
            tag = " <-- LOGIN: admin / 271527" if key == "admin" else ""
            print(f"  User: {email} created{tag}")

    # DEPARTMENTS
    dept_ids = {}
    for dept_name in ["Engineering", "Marketing", "HR", "Finance"]:
        ex = await conn.fetchrow("SELECT id FROM departments WHERE name=$1", dept_name)
        if ex:
            dept_ids[dept_name] = ex['id']
        else:
            did = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO departments (id, name, manager_id, created_by, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6)
            """, did, dept_name, user_ids["admin"], user_ids["admin"], now, now)
            dept_ids[dept_name] = did
            print(f"  Department: {dept_name} created")

    # PROJECTS + BOARDS + COLUMNS + TASKS
    projects = [
        ("Mobile App Development",  "MOB"),
        ("POS Billing System",      "POS"),
        ("Website Redesign",        "WEB"),
        ("Marketing Campaign Q1",   "MKT"),
        ("Internal HR System",      "HRS"),
    ]
    task_titles = [
        "Setup repository and CI/CD pipeline",
        "Design database schema and ERD",
        "Implement user authentication module",
        "Build REST API for core features",
        "Create responsive dashboard UI",
        "Write unit and integration tests",
        "Integrate third-party payment API",
        "Setup logging and monitoring",
        "Conduct code review sessions",
        "Deploy to production environment",
    ]
    priorities = ["LOW","MEDIUM","HIGH","URGENT"]
    assignee_keys = ["dev1","designer","tester"]
    col_status_map = {"Backlog":"TODO","To Do":"TODO","In Progress":"IN_PROGRESS","Review":"REVIEW","Done":"DONE"}
    columns_def = [
        ("Backlog","BACKLOG",1,"#94A3B8"),("To Do","TODO",2,"#60A5FA"),
        ("In Progress","IN_PROGRESS",3,"#F59E0B"),("Review","REVIEW",4,"#A78BFA"),
        ("Done","DONE",5,"#34D399"),
    ]
    total_proj = total_tasks = 0

    for proj_name, proj_key in projects:
        ex = await conn.fetchrow("SELECT id FROM projects WHERE key=$1", proj_key)
        if ex:
            print(f"  Project: {proj_name} (exists)")
            continue
        pid = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO projects (
                id, tenant_id, name, key, description, status, visibility, owner_id,
                budget, budget_spent, objectives, key_results, success_criteria,
                settings, custom_fields,
                total_tasks, completed_tasks, in_progress_tasks, progress_percentage,
                total_estimated_hours, total_actual_hours,
                created_at, updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6::projectstatus,$7::projectvisibility,$8,
                    $9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,
                    0,0,0,0.0,0.0,0.0,$16,$17)
        """, pid, tenant_id, proj_name, proj_key,
            f"{proj_name} - Managed via ProjectFlow.",
            "ACTIVE", "INTERNAL", user_ids["pm"],
            float(random.randint(50,200)*1000), float(random.randint(5,30)*1000),
            '[]', '[]', '[]', '{}', '{}', now, now)
        print(f"  Project: {proj_name} created")
        total_proj += 1

        # Members
        for uk, pr in [("admin","ADMIN"),("pm","MANAGER"),("dev1","MEMBER"),("designer","MEMBER"),("tester","MEMBER")]:
            if uk in user_ids:
                await conn.execute("""
                    INSERT INTO project_members (project_id, user_id, role, permissions, notification_settings, joined_at)
                    VALUES ($1,$2,$3::projectmemberrole,$4::jsonb,$5::jsonb,$6)
                    ON CONFLICT DO NOTHING
                """, pid, user_ids[uk], pr, '{}', '{}', now)

        # Board
        bid = str(uuid.uuid4())
        await conn.execute("""
            INSERT INTO boards (id, tenant_id, project_id, name, settings, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
        """, bid, tenant_id, pid, f"{proj_name} Board",
            '{"wip_limits_enabled":false,"show_card_cover":true,"compact_mode":false}', now, now)

        col_ids = {}
        for cname, ctype, pos, color in columns_def:
            cid = str(uuid.uuid4())
            await conn.execute("""
                INSERT INTO board_columns (id, board_id, name, position, column_type, color, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5::boardcolumntype,$6,$7,$8)
            """, cid, bid, cname, pos, ctype, color, now, now)
            col_ids[cname] = cid

        # Tasks
        col_names = list(col_ids.keys())
        for i, title in enumerate(task_titles):
            col_name = col_names[i % len(col_names)]
            status_val = col_status_map[col_name]
            assignee = user_ids.get(assignee_keys[i % len(assignee_keys)])
            priority = priorities[i % len(priorities)]
            task_id = str(uuid.uuid4())
            task_created = now - timedelta(days=random.randint(0,20))
            await conn.execute("""
                INSERT INTO tasks (id, tenant_id, project_id, title, description, task_type, status, priority, primary_assignee_id, reporter_id, board_column_id, estimated_hours, actual_hours, priority_score, position, custom_fields, created_at, updated_at)
                VALUES ($1,$2,$3,$4,$5,$6::tasktype,$7::taskstatus,$8::taskpriority,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18)
            """, task_id, tenant_id, pid, title,
                f"Task details: {title}. Complete per project guidelines.",
                "TASK", status_val, priority, assignee, user_ids["pm"], col_ids[col_name],
                float(random.randint(2,16)), float(random.randint(0,8)),
                float(random.randint(1,10)), float(i), '{}', task_created, now)

            await conn.execute("""
                INSERT INTO task_assignments (id, task_id, tenant_id, user_id, is_primary, assigned_by, assigned_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING
            """, str(uuid.uuid4()), task_id, tenant_id, assignee, True, user_ids["pm"], now)
            total_tasks += 1

    await conn.close()
    print("\n" + "=" * 55)
    print("  DATABASE SEEDING COMPLETE!")
    print("=" * 55)
    print(f"  Email    : admin@projectflow.com")
    print(f"  Password : 271527")
    print(f"  Role     : Super Admin")
    print(f"  Projects : {total_proj} | Tasks: {total_tasks}")
    print("=" * 55)

asyncio.run(main())
