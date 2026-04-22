import urllib.request
import json

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
    headers={'Content-Type': 'multipart/form-data; boundary=boundary'}
)

try:
    res = urllib.request.urlopen(req)
    print(res.read())
except Exception as e:
    print("ERROR:")
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
    else:
        print(e)
