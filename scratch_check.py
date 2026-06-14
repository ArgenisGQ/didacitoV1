import requests

# Test login
login_url = "http://fastapi-api:8001/auth/login"
login_payload = {
    "username": "superadmin@didactico.edu",
    "password": "superadmin123"
}

try:
    print("Testing login...")
    r = requests.post(login_url, json=login_payload)
    print("Login status:", r.status_code)
    if r.status_code == 200:
        token = r.json().get("access_token")
        print("Token retrieved successfully.")
        
        # Test get settings
        settings_url = "http://fastapi-api:8001/admin/settings"
        headers = {"Authorization": f"Bearer {token}"}
        r_settings = requests.get(settings_url, headers=headers)
        print("Settings status:", r_settings.status_code)
        if r_settings.status_code == 200:
            print("Settings data:")
            for item in r_settings.json():
                print(f"- {item.get('key')}: {item.get('value')} (category: {item.get('category')})")
        else:
            print("Failed to get settings:", r_settings.text)
    else:
        print("Login failed:", r.text)
except Exception as e:
    print("Error:", e)
