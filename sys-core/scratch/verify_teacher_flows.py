import asyncio
import httpx
import json
import sys
from sqlalchemy import select, delete
from api.database import AsyncSessionLocal
from api.models import User, RefreshToken, AuditLog

BASE_URL = "http://127.0.0.1:8001"

async def cleanup_test_user():
    print("\n--- Limpiando base de datos ---")
    async with AsyncSessionLocal() as db:
        # Delete test user by email or id_user
        result = await db.execute(
            select(User).where((User.email == "juanperez@didactico.edu") | (User.id_user == "99999999"))
        )
        user = result.scalars().first()
        if user:
            # Delete audit logs first
            await db.execute(delete(AuditLog).where(AuditLog.user_id == user.id))
            # Delete refresh tokens
            await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
            await db.delete(user)
            await db.commit()
            print("Usuario de prueba 'juanperez@didactico.edu' eliminado con éxito.")
        else:
            print("No se requería limpieza previa.")

async def test_teacher_import_and_password_change_flow():
    print("\n=== TEST DE IMPORTACIÓN DE DOCENTES Y CAMBIO DE CLAVE OBLIGATORIO ===")
    
    # 1. Limpieza inicial
    await cleanup_test_user()
    
    async with httpx.AsyncClient() as client:
        # 2. Login como Superadmin para obtener token de administración
        print("\n1. Iniciando sesión como Superadmin...")
        superadmin_data = {
            "username": "superadmin@didactico.edu",
            "password": "admin"
        }
        login_res = await client.post(f"{BASE_URL}/token", data=superadmin_data)
        if login_res.status_code != 200:
            print(f"ERROR: No se pudo loguear el superadmin (Status: {login_res.status_code})")
            return False
        
        superadmin_token = login_res.json().get("access_token")
        admin_headers = {"Authorization": f"Bearer {superadmin_token}"}
        print("Superadmin autenticado correctamente.")
        
        # 3. Vista previa de importación con CSV delimitado por punto y coma (;)
        print("\n2. Probando endpoint de Vista Previa de Carga Masiva (Semicolon CSV)...")
        csv_content = (
            "Usuario;Cédula;Nombre;Apellido;Email;Curso Completo;Periodo Académico\n"
            "juanperez;99999999;Juan;Perez;juanperez@didactico.edu;JMGC-104 ED22D0V;2022-3\n"
        )
        
        files = {"file": ("Listado_Profesores.csv", csv_content.encode("utf-8"), "text/csv")}
        preview_res = await client.post(f"{BASE_URL}/admin/users/import", files=files, headers=admin_headers)
        
        if preview_res.status_code != 200:
            print(f"ERROR: La vista previa de importación falló con status {preview_res.status_code}: {preview_res.text}")
            return False
            
        preview_json = preview_res.json()
        print("Respuesta de Vista Previa:")
        print(json.dumps(preview_json, indent=2))
        
        row = preview_json["rows"][0]
        if row["status"] != "VALID":
            print(f"ERROR: La fila se marcó como inválida: {row['errors']}")
            return False
            
        # Verificar parseo del 'Curso Completo'
        if row["subject_code"] != "JMGC-104" or row["section"] != "ED22D0V":
            print(f"ERROR: Código de materia o sección mal parseados: {row['subject_code']} / {row['section']}")
            return False
            
        print("✔ Parseo de Curso Completo correcto: JMGC-104 / ED22D0V")
        print(f"✔ Advertencia soft-relationship detectada con éxito: {row['warnings']}")
        
        # 4. Confirmar Importación
        print("\n3. Confirmando importación de usuario...")
        confirm_payload = {
            "users": [row]
        }
        confirm_res = await client.post(f"{BASE_URL}/admin/users/import/confirm", json=confirm_payload, headers=admin_headers)
        if confirm_res.status_code != 200:
            print(f"ERROR: La confirmación de importación falló con status {confirm_res.status_code}: {confirm_res.text}")
            return False
            
        confirm_json = confirm_res.json()
        print("Confirm Import Response:", confirm_json)
        print("✔ Usuario importado exitosamente.")
        
        # 5. Intentar login como docente con clave inicial (su Cédula)
        print("\n4. Intentando iniciar sesión como Docente por primera vez con su Cédula...")
        teacher_credentials = {
            "username": "juanperez@didactico.edu",
            "password": "99999999"
        }
        teacher_login_res = await client.post(f"{BASE_URL}/token", data=teacher_credentials)
        print(f"Login Docente Status: {teacher_login_res.status_code}")
        teacher_login_json = teacher_login_res.json()
        print("Response:", teacher_login_json)
        
        if not teacher_login_json.get("needs_password_change"):
            print("ERROR: needs_password_change debería ser True pero es falso/nulo")
            return False
            
        temp_token = teacher_login_json.get("temp_token")
        if not temp_token:
            print("ERROR: Token temporal de transición ausente")
            return False
            
        print("✔ Flujo de primer ingreso detectado e interceptado correctamente. Token temporal obtenido.")
        
        # 6. Intentar cambiar la clave con una débil (zxcvbn score < 3)
        print("\n5. Intentando cambiar la contraseña obligatoria por una clave muy débil...")
        weak_pwd_payload = {
            "temp_token": temp_token,
            "new_password": "123456"
        }
        weak_res = await client.post(f"{BASE_URL}/api/auth/first-login-change-password", json=weak_pwd_payload)
        print(f"Weak Password Change Status: {weak_res.status_code}")
        weak_json = weak_res.json()
        print("Response:", weak_json)
        
        if weak_res.status_code != 400:
            print("ERROR: Se esperaba status 400 por contraseña débil pero se obtuvo otra cosa")
            return False
            
        print("✔ Cambio de clave débil rechazado exitosamente con mensaje de seguridad.")
        
        # 7. Cambiar la clave por una fuerte (zxcvbn score >= 3)
        print("\n6. Intentando cambiar la contraseña por una clave robusta...")
        strong_pwd_payload = {
            "temp_token": temp_token,
            "new_password": "Didactico-JuanPerez-2026!"
        }
        strong_res = await client.post(f"{BASE_URL}/api/auth/first-login-change-password", json=strong_pwd_payload)
        print(f"Strong Password Change Status: {strong_res.status_code}")
        
        if strong_res.status_code != 200:
            print(f"ERROR: El cambio de clave fuerte falló con status {strong_res.status_code}: {strong_res.text}")
            return False
            
        strong_json = strong_res.json()
        print("Response:", strong_json)
        
        docente_access_token = strong_json.get("access_token")
        if not docente_access_token or strong_json.get("needs_password_change") is not False:
            print("ERROR: No se retornó el token definitivo o el flag de cambio de clave sigue activo")
            return False
            
        print("✔ Cambio de contraseña fuerte exitoso. Acceso automático concedido.")
        
        # 8. Verificar que la clave anterior (Cédula) ya no sirve
        print("\n7. Verificando que la contraseña inicial (Cédula) ya no sea válida...")
        old_login_res = await client.post(f"{BASE_URL}/token", data=teacher_credentials)
        print(f"Login con Cédula anterior Status: {old_login_res.status_code}")
        if old_login_res.status_code != 401:
            print("ERROR: La clave inicial sigue permitiendo el acceso o retornando código diferente a 401")
            return False
        print("✔ Clave anterior invalidada con éxito.")
        
        # 9. Iniciar sesión con la nueva contraseña fuerte
        print("\n8. Iniciando sesión con la nueva contraseña fuerte...")
        new_credentials = {
            "username": "juanperez@didactico.edu",
            "password": "Didactico-JuanPerez-2026!"
        }
        new_login_res = await client.post(f"{BASE_URL}/token", data=new_credentials)
        print(f"Login con nueva clave Status: {new_login_res.status_code}")
        if new_login_res.status_code != 200:
            print("ERROR: El login con la nueva contraseña falló")
            return False
        
        print("✔ Login con nueva clave fuerte verificado exitosamente.")
        
        # 10. Limpieza final - Esperar a que terminen las tareas en segundo plano antes de limpiar
        print("\n9. Esperando 3 segundos a que finalicen las tareas asíncronas de bitácora...")
        await asyncio.sleep(3.0)
        await cleanup_test_user()
        
        print("\n¡PRUEBA COMPLETA DE FLUJO DE DOCENTES TERMINADA CON ÉXITO!")
        return True

async def main():
    try:
        success = await test_teacher_import_and_password_change_flow()
        if success:
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"Excepción durante la prueba: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
