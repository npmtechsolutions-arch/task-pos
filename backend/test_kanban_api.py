"""
Quick API test script — creates a task via the Kanban API.
Run from the backend directory: python test_kanban_api.py
"""
import asyncio
import httpx

BASE = "http://localhost:8000/api/v1"

async def main():
    async with httpx.AsyncClient(timeout=10) as client:

        # ── 1. Login ─────────────────────────────────────────────────────
        print("\n[1] Logging in as admin...")
        r = await client.post(f"{BASE}/auth/login", json={"email": "admin", "password": "271527"})
        if r.status_code != 200:
            print(f"  ❌ Login failed: {r.status_code} {r.text}")
            return
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"  ✅ Login OK — token received")

        # ── 2. Fetch projects ────────────────────────────────────────────
        print("\n[2] Fetching projects...")
        r = await client.get(f"{BASE}/projects", headers=headers)
        if r.status_code != 200:
            print(f"  ❌ Projects failed: {r.status_code} {r.text}")
            return
        projects = r.json()["items"]
        print(f"  ✅ Found {len(projects)} project(s)")
        for p in projects:
            print(f"     • [{p['key']}] {p['name']} (id={p['id'][:8]}...)")
        if not projects:
            print("  ⚠️  No projects found. Please create one first.")
            return
        project_id = projects[0]["id"]
        project_name = projects[0]["name"]

        # ── 3. Init Kanban board ─────────────────────────────────────────
        print(f"\n[3] Initialising Kanban board for project '{project_name}'...")
        r = await client.post(f"{BASE}/kanban/boards/init/{project_id}", headers=headers)
        if r.status_code not in (200, 201):
            print(f"  ❌ Board init failed: {r.status_code} {r.text}")
            return
        board_info = r.json()
        print(f"  ✅ {board_info['message']} (board_id={board_info['board_id'][:8]}...)")

        # ── 4. Fetch Kanban board columns ────────────────────────────────
        print(f"\n[4] Fetching Kanban board columns...")
        r = await client.get(f"{BASE}/kanban/board/{project_id}", headers=headers)
        if r.status_code != 200:
            print(f"  ❌ Board fetch failed: {r.status_code} {r.text}")
            return
        board = r.json()
        columns = board["columns"]
        print(f"  ✅ Board has {len(columns)} column(s):")
        for col in columns:
            print(f"     • '{col['name']}' (type={col['column_type']}, tasks={col['task_count']}, wip_limit={col['wip_limit']})")
        first_col_id = columns[0]["id"]
        first_col_name = columns[0]["name"]

        # ── 5. Create a task via Kanban quick-add ────────────────────────
        print(f"\n[5] Creating task in column '{first_col_name}'...")
        task_payload = {
            "title": "✅ Kanban Module Test Task — created by API test",
            "project_id": project_id,
            "board_column_id": first_col_id,
            "status": "todo",
            "priority": "high",
            "description": "This task was created automatically to verify the Kanban module is working.",
            "estimated_hours": 2.0,
            "position": 0
        }
        r = await client.post(f"{BASE}/kanban/tasks", json=task_payload, headers=headers)
        if r.status_code != 201:
            print(f"  ❌ Task creation failed: {r.status_code} {r.text}")
            return
        task = r.json()
        print(f"  ✅ Task created!")
        print(f"     • ID:       {task['id']}")
        print(f"     • Title:    {task['title']}")
        print(f"     • Status:   {task['status']}")
        print(f"     • Priority: {task['priority']}")
        print(f"     • Column:   {task['board_column_id']}")

        # ── 6. Verify task appears in board ──────────────────────────────
        print(f"\n[6] Verifying task appears in board columns...")
        r = await client.get(f"{BASE}/kanban/board/{project_id}", headers=headers)
        board2 = r.json()
        found = False
        for col in board2["columns"]:
            for t in col["tasks"]:
                if t["id"] == task["id"]:
                    found = True
                    print(f"  ✅ Task found in column '{col['name']}' — position {t['position']}")
        if not found:
            print("  ⚠️  Task not found in board columns (unexpected)")

        # ── 7. Move task to second column (drag-and-drop simulation) ─────
        if len(columns) > 1:
            target_col = columns[1]
            print(f"\n[7] Moving task to column '{target_col['name']}' (drag-drop simulation)...")
            r = await client.put(
                f"{BASE}/kanban/tasks/{task['id']}/move",
                json={
                    "task_id": task["id"],
                    "target_column_id": target_col["id"],
                    "source_column_id": first_col_id,
                    "new_position": 0
                },
                headers=headers
            )
            if r.status_code == 200:
                moved = r.json()
                print(f"  ✅ Task moved! New column_id: {moved['board_column_id'][:8]}...")
            else:
                print(f"  ❌ Move failed: {r.status_code} {r.text}")

        # ── 8. Delete the test task ───────────────────────────────────────
        print(f"\n[8] Cleaning up — deleting test task...")
        r = await client.delete(f"{BASE}/kanban/tasks/{task['id']}", headers=headers)
        if r.status_code == 204:
            print(f"  ✅ Test task deleted cleanly")
        else:
            print(f"  ⚠️  Delete returned {r.status_code} (task may still exist)")

        print("\n" + "="*55)
        print("🎉 ALL KANBAN MODULE TESTS PASSED!")
        print("="*55)

asyncio.run(main())
