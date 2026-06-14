import urllib.request
import json

# Test login
login_url = "http://fastapi-api:8001/auth/login"
login_payload = json.dumps({
    "username": "superadmin@didactico.edu",
    "password": "superadmin123"
}).encode("utf-8")

req = urllib.request.Request(
    login_url,
    data=login_payload,
    headers={"Content-Type": "application/json"}
)

try:
    print("Testing login...")
    with urllib.request.urlopen(req) as response:
        login_res = json.loads(response.read().decode())
        print("Login status: 200")
        token = login_res.get("access_token")
        print("Token retrieved successfully.")
        
        # Test get settings
        settings_url = "http://fastapi-api:8001/admin/settings"
        req_settings = urllib.request.Request(
            settings_url,
            headers={"Authorization": f"Bearer {token}"}
        )
        with urllib.request.urlopen(req_settings) as resp_settings:
            settings_data = json.loads(resp_settings.read().decode())
            print("Settings status: 200")
            print("Settings data:")
            for item in settings_data:
                print(f"- {item.get('key')}: {item.get('value')} (category: {item.get('category')})")
except Exception as e:
    print("Error:", e)
