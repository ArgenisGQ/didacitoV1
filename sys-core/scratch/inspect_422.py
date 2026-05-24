import asyncio
import httpx

BASE_URL = "http://localhost:8001"

async def main():
    async with httpx.AsyncClient() as client:
        # 1. Login as superadmin to get token
        login_data = {
            "username": "superadmin@didactico.edu",
            "password": "admin"
        }
        res = await client.post(f"{BASE_URL}/token", data=login_data)
        if res.status_code != 200:
            print("Login failed:", res.text)
            return

        token_data = res.json()
        access_token = token_data.get("access_token")
        headers = {"Authorization": f"Bearer {access_token}"}

        # 2. Get user with ID 16 first to see their current values
        res_get = await client.get(f"{BASE_URL}/users", headers=headers)
        users = res_get.json()
        target_user = None
        for u in users:
            if u["id"] == 16:
                target_user = u
                break
        
        if not target_user:
            print("User 16 not found, using first user instead")
            target_user = users[0] if users else None

        if not target_user:
            print("No users found at all.")
            return

        print("Target User Details:", target_user)

        # 3. Simulate PUT request exactly like frontend does when saving edits
        # Let's see what happens if we PUT to /users/{id} with various payloads
        user_id = target_user["id"]
        
        # Test A: standard payload with empty password (but wait, what does the frontend actually send?)
        # Let's test what happens when password is not included:
        payload_no_pass = {
            "email": target_user["email"],
            "full_name": target_user["full_name"],
            "role": target_user["role"]
        }
        res_put = await client.put(f"{BASE_URL}/users/{user_id}", json=payload_no_pass, headers=headers)
        print(f"\nTest A (No password field): Status={res_put.status_code}")
        print("Response:", res_put.text)

        # Test B: payload where password is empty string ""
        payload_empty_pass = {
            "email": target_user["email"],
            "full_name": target_user["full_name"],
            "role": target_user["role"],
            "password": ""
        }
        res_put_empty = await client.put(f"{BASE_URL}/users/{user_id}", json=payload_empty_pass, headers=headers)
        print(f"\nTest B (Password is empty string): Status={res_put_empty.status_code}")
        print("Response:", res_put_empty.text)

        # Test C: payload where password is None
        payload_none_pass = {
            "email": target_user["email"],
            "full_name": target_user["full_name"],
            "role": target_user["role"],
            "password": None
        }
        res_put_none = await client.put(f"{BASE_URL}/users/{user_id}", json=payload_none_pass, headers=headers)
        print(f"\nTest C (Password is None): Status={res_put_none.status_code}")
        print("Response:", res_put_none.text)

if __name__ == "__main__":
    asyncio.run(main())
