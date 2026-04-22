import urllib.request
import json

# Login expects UserLoginRequest, which is JSON
login_data = json.dumps({
    'email': 'admin@projectflow.com',
    'password': 'Admin@123'
}).encode('utf-8')

login_req = urllib.request.Request(
    'http://localhost:8000/api/v1/auth/login',
    data=login_data,
    headers={'Content-Type': 'application/json'}
)

try:
    res = urllib.request.urlopen(login_req)
    token = json.loads(res.read())['access_token']
except Exception as e:
    print("Login failed:")
    if hasattr(e, 'read'):
        print(e.read().decode())
    else:
        print(e)
    exit(1)

print("Logged in!")

# 2. Upload PRD
body = (
    b"--boundary\r\n"
    b"Content-Disposition: form-data; name=\"file\"; filename=\"prd.txt\"\r\n"
    b"Content-Type: text/plain\r\n\r\n"
    b"Test PRD task\r\n"
    b"--boundary--\r\n"
)

req = urllib.request.Request(
    'http://localhost:8000/api/v1/documents/upload-prd', 
    data=body, 
    headers={
        'Content-Type': 'multipart/form-data; boundary=boundary',
        'Authorization': f'Bearer {token}'
    }
)

try:
    res = urllib.request.urlopen(req)
    print("SUCCESS:")
    print(res.read().decode())
except Exception as e:
    print("UPLOAD ERROR:")
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
    else:
        print(e)
