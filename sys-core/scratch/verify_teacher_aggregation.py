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
        result = await db.execute(
            select(User).where((User.email == "juanperez@didactico.edu") | (User.id_user == "99999999"))
        )
        user = result.scalars().first()
        if user:
            await db.execute(delete(AuditLog).where(AuditLog.user_id == user.id))
            await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
            await db.delete(user)
            await db.commit()
            print("Usuario de prueba 'juanperez@didactico.edu' eliminado.")
        else:
            print("No se requería limpieza previa.")

async def test_teacher_aggregation_flow():
    print("\n=== TEST DE AGREGACIÓN DE MATERIAS Y SECCIONES REPETIDAS ===")
    
    # 1. Limpieza inicial
    await cleanup_test_user()
    
    async with httpx.AsyncClient() as client:
        # 2. Login como Superadmin
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
        print("Superadmin autenticado.")
        
        # 3. Vista previa de importación con CSV con un docente en 3 filas distintas
        print("\n2. Subiendo CSV con docente repetido en 3 materias/secciones diferentes...")
        csv_content = (
            "Usuario;Cédula;Nombre;Apellido;Email;Curso Completo;Periodo Académico\n"
            "juanperez;99999999;Juan;Perez;juanperez@didactico.edu;JMGC-104 ED22D0V;2022-3\n"
            "juanperez;99999999;Juan;Perez;juanperez@didactico.edu;MAT-101 ED22D0W;2022-3\n"
            "juanperez;99999999;Juan;Perez;juanperez@didactico.edu;ED-200 ED22D0X;2022-3\n"
        )
        
        files = {"file": ("Listado_Profesores_Duplicados.csv", csv_content.encode("utf-8"), "text/csv")}
        preview_res = await client.post(f"{BASE_URL}/admin/users/import", files=files, headers=admin_headers)
        
        if preview_res.status_code != 200:
            print(f"ERROR: La vista previa falló con status {preview_res.status_code}: {preview_res.text}")
            return False
            
        preview_json = preview_res.json()
        print("Respuesta de Vista Previa:")
        print(json.dumps(preview_json, indent=2))
        
        # Assertions on preview aggregation
        if preview_json["total_rows"] != 3:
            print(f"ERROR: Se procesaron {preview_json['total_rows']} filas, se esperaban 3.")
            return False
            
        rows = preview_json["rows"]
        if len(rows) != 1:
            print(f"ERROR: Debería haberse colapsado a 1 solo docente en la lista de vista previa, pero hay {len(rows)}.")
            return False
            
        row = rows[0]
        print(f"Fila única obtenida para: {row['email']}")
        print(f"Asignaturas parseadas: '{row['subject_code']}'")
        print(f"Secciones parseadas:   '{row['section']}'")
        print(f"Periodos parseados:    '{row['academic_period']}'")
        
        # Verificar ordenamiento y unificación por comas
        expected_subjects = "ED-200, JMGC-104, MAT-101"
        expected_sections = "ED22D0V, ED22D0W, ED22D0X"
        
        if row["subject_code"] != expected_subjects or row["section"] != expected_sections:
            print(f"ERROR: Las asignaturas o secciones no corresponden a la unificación esperada.")
            return False
            
        print("✔ Colapsado y unificación por comas en Vista Previa exitoso.")
        
        # 4. Confirmar Importación
        print("\n3. Confirmando importación del docente colapsado...")
        confirm_payload = {
            "users": [row]
        }
        confirm_res = await client.post(f"{BASE_URL}/admin/users/import/confirm", json=confirm_payload, headers=admin_headers)
        if confirm_res.status_code != 200:
            print(f"ERROR: La confirmación falló con status {confirm_res.status_code}: {confirm_res.text}")
            return False
            
        print("✔ Usuario importado en la base de datos.")
        
        # 5. Consultar el usuario en la base de datos para certificar la persistencia
        print("\n4. Consultando el registro en la base de datos PostgreSQL...")
        async with AsyncSessionLocal() as db:
            db_res = await db.execute(select(User).where(User.email == "juanperez@didactico.edu"))
            db_user = db_res.scalars().first()
            if not db_user:
                print("ERROR: El usuario no se encontró en la base de datos.")
                return False
                
            print(f"Registro en DB - Email: {db_user.email}")
            print(f"Registro en DB - Cédula: {db_user.id_user}")
            print(f"Registro en DB - subject_code: '{db_user.subject_code}'")
            print(f"Registro en DB - section: '{db_user.section}'")
            
            if db_user.subject_code != expected_subjects or db_user.section != expected_sections:
                print("ERROR: La base de datos no contiene las materias/secciones unificadas correctas.")
                return False
                
        print("✔ Persistencia de columnas de texto largo (TextField/Text) certificada correctamente.")
        
        # 6. Limpieza final
        print("\n5. Esperando 3 segundos a que finalicen las tareas asíncronas...")
        await asyncio.sleep(3.0)
        await cleanup_test_user()
        
        print("\n¡PRUEBA DE AGREGACIÓN DE DOCENTES DUPLICADOS TERMINADA CON ÉXITO!")
        return True

async def main():
    try:
        success = await test_teacher_aggregation_flow()
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
