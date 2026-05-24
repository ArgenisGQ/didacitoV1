import asyncio
import httpx

BASE_URL = "http://localhost:8001"

async def main():
    print(">>> Iniciando pruebas de verificación de Gestión de Identidades...")
    
    async with httpx.AsyncClient() as client:
        # 1. Login como Super Admin
        login_data = {
            "username": "superadmin@didactico.edu",
            "password": "admin"
        }
        res = await client.post(f"{BASE_URL}/token", data=login_data)
        if res.status_code != 200:
            print("❌ Error de login:", res.text)
            return

        token_data = res.json()
        access_token = token_data.get("access_token")
        headers = {"Authorization": f"Bearer {access_token}"}
        print("✅ Login exitoso como Super Admin.")

        # Obtener datos del Super Admin para pruebas de autodesactivación
        res_me = await client.get(f"{BASE_URL}/users/me", headers=headers)
        super_admin = res_me.json()
        super_admin_id = super_admin["id"]
        print(f"   Super Admin ID: {super_admin_id}, Email: {super_admin['email']}")

        # 2. Intentar autodesactivar el Super Admin logueado (Debe fallar)
        print(">>> Probando seguridad de autodesactivación...")
        res_self = await client.put(f"{BASE_URL}/users/{super_admin_id}", json={"is_active": False}, headers=headers)
        if res_self.status_code == 400:
            print("✅ Exito: Se bloqueó la autodesactivación correctamente con status 400.")
            print("   Mensaje de error:", res_self.json()["detail"])
        else:
            print(f"❌ Error: La autodesactivación debería haber fallado, pero retornó {res_self.status_code}: {res_self.text}")

        # 3. Crear un docente temporal para pruebas
        docente_email = "docentetemporal@didactico.edu"
        user_payload = {
            "email": docente_email,
            "full_name": "Docente Temporal Pruebas",
            "role": "DOCENTE",
            "password": "clave_temporal_123"
        }
        print(">>> Creando docente temporal...")
        res_create = await client.post(f"{BASE_URL}/users", json=user_payload, headers=headers)
        if res_create.status_code not in (200, 201):
            if "Email already registered" in res_create.text:
                # Si ya existía, lo buscamos para usarlo
                print("   El usuario ya existía. Obteniendo de la lista...")
                res_list = await client.get(f"{BASE_URL}/users", headers=headers)
                docente = [u for u in res_list.json() if u["email"] == docente_email][0]
            else:
                print("❌ Error al crear docente:", res_create.text)
                return
        else:
            docente = res_create.json()
        
        docente_id = docente["id"]
        print(f"✅ Docente temporal listo. ID: {docente_id}, Email: {docente['email']}")

        # 4. Desactivar al docente temporal
        print(">>> Desactivando al docente...")
        res_deact = await client.put(f"{BASE_URL}/users/{docente_id}", json={"is_active": False}, headers=headers)
        if res_deact.status_code == 200:
            docente_updated = res_deact.json()
            if docente_updated["is_active"] is False:
                print("✅ Exito: Docente desactivado (is_active = False) correctamente.")
            else:
                print("❌ Error: is_active no cambió a False.")
        else:
            print("❌ Error al desactivar docente:", res_deact.text)

        # 5. Volver a activar al docente temporal
        print(">>> Volviendo a activar al docente...")
        res_act = await client.put(f"{BASE_URL}/users/{docente_id}", json={"is_active": True}, headers=headers)
        if res_act.status_code == 200:
            docente_updated = res_act.json()
            if docente_updated["is_active"] is True:
                print("✅ Exito: Docente reactivado (is_active = True) correctamente.")
            else:
                print("❌ Error: is_active no cambió a True.")
        else:
            print("❌ Error al reactivar docente:", res_act.text)

        # 6. Intentar ELIMINAR al Super Admin (Debe fallar, no es docente)
        print(">>> Probando restricción de eliminación para roles administrativos...")
        res_del_admin = await client.delete(f"{BASE_URL}/users/{super_admin_id}", headers=headers)
        if res_del_admin.status_code == 400:
            print("✅ Exito: Se bloqueó la eliminación del Administrador correctamente.")
            print("   Mensaje de error:", res_del_admin.json()["detail"])
        else:
            print(f"❌ Error: La eliminación debería haber fallado con 400, pero retornó {res_del_admin.status_code}: {res_del_admin.text}")

        # 7. Eliminar físicamente al docente temporal (Debe tener éxito)
        print(">>> Eliminando físicamente al docente temporal...")
        res_del_doc = await client.delete(f"{BASE_URL}/users/{docente_id}", headers=headers)
        if res_del_doc.status_code == 200:
            print("✅ Exito: Docente eliminado físicamente del sistema.")
            print("   Respuesta del API:", res_del_doc.json()["message"])
        else:
            print("❌ Error al eliminar docente:", res_del_doc.text)

        # 8. Verificar que el docente ya no está en la base de datos
        res_list_final = await client.get(f"{BASE_URL}/users", headers=headers)
        users_final = res_list_final.json()
        found = any(u["id"] == docente_id for u in users_final)
        if not found:
            print("✅ Verificación final: El docente fue removido por completo de la lista de usuarios.")
        else:
            print("❌ Error de verificación final: El docente aún figura en la lista de usuarios.")

if __name__ == "__main__":
    asyncio.run(main())
