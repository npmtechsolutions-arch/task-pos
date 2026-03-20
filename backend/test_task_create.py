import asyncio
import httpx

BASE = "http://localhost:8000/api/v1"

async def main():
    async with httpx.AsyncClient(timeout=10) as client:
        # 1. Login
        r = await client.post(f"{BASE}/auth/login", json={"email": "admin", "password": "271527"})
        if r.status_code != 200:
            print(f"Login failed: {r.status_code} {r.text}")
            return
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get projects
        r = await client.get(f"{BASE}/projects", headers=headers)
        projects = r.json()["items"]
        if not projects:
            print("No projects")
            return
        project_id = projects[0]["id"]
        
        # 3. Create task using standard /tasks endpoint
        task_payload = {
            "title": "Manual UI Task Test",
            "project_id": project_id,
            "priority": "medium",
            "task_type": "task"
        }
        print(f"Submitting task to /tasks: {task_payload}")
        r = await client.post(f"{BASE}/tasks", json=task_payload, headers=headers)
        print(f"Response: {r.status_code} {r.text}")

asyncio.run(main())
