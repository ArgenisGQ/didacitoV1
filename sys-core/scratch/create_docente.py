import asyncio
import httpx

BASE_URL = "http://localhost:8001"

async def main():
    print("Trying to login as superadmin...")
    async with httpx.AsyncClient() as client:
        # Login
        login_data = {
            "username": "superadmin@didactico.edu",
            "password": "admin"
        }
        res = await client.post(f"{BASE_URL}/token", data=login_data)
        print(f"Login Status: {res.status_code}")
        if res.status_code != 200:
            print("Login failed:", res.text)
            return

        token_data = res.json()
        print("Login response:", token_data)
        access_token = token_data.get("access_token")
        if not access_token:
            print("No access token found.")
            return

        # Headers
        headers = {"Authorization": f"Bearer {access_token}"}

        # Create user
        user_payload = {
            "email": "docentetest@didactico.edu",
            "full_name": "Usuario Tipo Docente",
            "role": "DOCENTE",
            "password": "clave_docente_123"
        }
        print("Creating user docente...")
        res_create = await client.post(f"{BASE_URL}/users", json=user_payload, headers=headers)
        print(f"Create User Status: {res_create.status_code}")
        print("Create User Response:", res_create.text)

if __name__ == "__main__":
    asyncio.run(main())
