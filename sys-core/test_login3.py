import urllib.request
import urllib.parse
import json

url = "http://localhost:8001/token"
data = urllib.parse.urlencode({"username": "superadmin@didactico.edu", "password": "superadmin123"}).encode("utf-8")
req = urllib.request.Request(url, data=data)

try:
    with urllib.request.urlopen(req) as response:
        print(f"Status Code: {response.status}")
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode('utf-8'))
