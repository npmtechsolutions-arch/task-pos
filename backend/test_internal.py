import asyncio
import httpx
from app.main import app
import traceback
import sys

async def test_task_creation():
    print("--- Starting in-process ASGITransport test ---")
    
    try:
        # ASGITransport avoids needing external server
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            print("1. Logging in...")
            r = await client.post("/api/v1/auth/login", json={"email": "admin", "password": "271527"})
            if r.status_code != 200:
                print(f"Login failed: {r.status_code} {r.text}")
                return
            token = r.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            print("2. Getting projects...")
            r = await client.get("/api/v1/projects", headers=headers)
            projects = r.json().get("items", [])
            if not projects:
                print("No projects exist.")
                return
            project_id = projects[0]["id"]
            
            print(f"3. Creating task for project {project_id}...")
            # We match the EXACT payload sent by TaskForm.tsx
            payload = {
                "title": "Manual UI Task Test",
                "project_id": project_id,
                "priority": "medium",
            }
            
            r = await client.post("/api/v1/tasks", json=payload, headers=headers)
            print(f"Response code: {r.status_code}")
            if r.status_code == 500:
                print("--- 500 ERROR CAUGHT ---")
                print(r.text)
            else:
                print("SUCCESS:", r.text)
                    
    except Exception as e:
        print("EXCEPTION IN FASTAPI APP:")
        traceback.print_exc()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_task_creation())
