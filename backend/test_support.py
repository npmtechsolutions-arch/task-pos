import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.security import create_access_token
from app.models.user import UserRole
import urllib.request
import urllib.error

def test():
    # Adding 'type': 'access' to bypass that specific check!
    token = create_access_token({"sub": "d4e34634-3a4d-45cf-b3ed-6a0dff533ce5", "role": "admin", "type": "access"})
    req = urllib.request.Request(
        "http://localhost:8000/api/v1/support",
        headers={"Authorization": f"Bearer {token}"}
    )
    try:
        resp = urllib.request.urlopen(req)
        print("Status:", resp.status)
        print(resp.read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code)
        print(e.read().decode())
    except Exception as e:
        print("Error:", e)

test()
