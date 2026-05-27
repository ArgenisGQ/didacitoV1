import requests

url = "http://localhost:8001/token"
data = {
    "username": "superadmin@didactico.edu",
    "password": "superadmin123"
}
response = requests.post(url, data=data)
print(f"Status Code: {response.status_code}")
if response.status_code != 200:
    print(f"Error: {response.text}")
else:
    print("Success!")
    print(response.json())
