import asyncio
import sys
from sqlalchemy import text, select, delete
from api.database import AsyncSessionLocal
from api.models import User, RefreshToken, Invitation, AuditLog

async def purge():
    print("=== INICIANDO PURGA COMPLETA DE LA BASE DE DATOS ===")
    async with AsyncSessionLocal() as db:
        try:
            # 1. Eliminar todos los refresh tokens
            print("Eliminando plan_app_refreshtoken...")
            await db.execute(delete(RefreshToken))
            
            # 2. Eliminar todas las invitaciones
            print("Eliminando plan_app_invitations...")
            await db.execute(delete(Invitation))
            
            # 3. Eliminar todas las bitácoras de auditoría
            print("Eliminando plan_app_audit_log...")
            await db.execute(delete(AuditLog))
            
            # 4. Eliminar todos los usuarios excepto superadmin@didactico.edu
            print("Eliminando plan_app_user (excepto superadmin)...")
            await db.execute(delete(User).where(User.email != "superadmin@didactico.edu"))
            
            await db.commit()
            print("✔ Base de datos purgada completamente con éxito.")
        except Exception as e:
            await db.rollback()
            print(f"❌ Error durante la purga: {e}")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(purge())
