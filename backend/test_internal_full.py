import asyncio
import httpx
from app.main import app
import traceback
import sys

async def test_task_creation():
    print("--- Starting in-process ASGITransport full payload test ---")
    
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            r = await client.post("/api/v1/auth/login", json={"email": "admin", "password": "271527"})
            if r.status_code != 200:
                print(f"Login failed: {r.status_code} {r.text}")
                return
            token = r.json()["access_token"]
            user_id = r.json()["user"]["id"]
            headers = {"Authorization": f"Bearer {token}"}
            
            r = await client.get("/api/v1/projects", headers=headers)
            projects = r.json().get("items", [])
            mob_project = next((p for p in projects if "Mobile App Development" in p["name"]), projects[0])
            project_id = mob_project["id"]
            
            payload = {
                "title": "landing page for ps billing software",
                "description": "svnsjfa",
                "project_id": project_id,
                "priority": "high",
                "primary_assignee_id": user_id,
                "due_date": "2026-03-05T00:00:00.000Z",
                "estimated_hours": 6.0
            }
            
            print(f"Sending full payload: {payload}")
            r = await client.post("/api/v1/tasks", json=payload, headers=headers)
            print(f"Response code: {r.status_code}")
            if r.status_code != 201:
                print("--- ERROR CAUGHT ---")
                print(r.text)
            else:
                print("SUCCESS:", r.text[:200])
                    
    except Exception as e:
        print("EXCEPTION IN FASTAPI APP:")
        traceback.print_exc()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_task_creation())
