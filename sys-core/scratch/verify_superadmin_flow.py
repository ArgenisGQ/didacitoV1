import asyncio
import httpx

BASE_URL = "http://localhost:8001"

async def main():
    print("Testing superadmin flow...")
    async with httpx.AsyncClient() as client:
        # Login
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

        # List users
        print("Listing users...")
        res_list = await client.get(f"{BASE_URL}/users", headers=headers)
        print(f"List Users Status: {res_list.status_code}")
        users = res_list.json()
        print(f"Total users in DB: {len(users)}")
        
        # Verify the created docente test user is in the list
        created_user = None
        for u in users:
            if u["email"] == "docentetest@didactico.edu":
                created_user = u
                break
                
        if created_user:
            print("SUCCESS: Found created user:")
            print(created_user)
        else:
            print("WARNING: docentetest@didactico.edu not found in users list!")

if __name__ == "__main__":
    asyncio.run(main())
