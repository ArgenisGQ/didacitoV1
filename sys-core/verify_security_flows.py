import asyncio
import httpx
import pyotp
from sqlalchemy import select
from api.database import AsyncSessionLocal
from api.models import User, RefreshToken, PasswordReset
from api.core.security import create_reset_token
import os
import sys

BASE_URL = "http://localhost:8001"

async def test_normal_login_and_refresh():
    print("\n=== TEST 1: LOGIN NORMAL Y REFRESH SILENCIOSO ===")
    async with httpx.AsyncClient() as client:
        # 1. Login exitoso
        login_data = {
            "username": "gestion@didactico.edu",
            "password": "gestion123"
        }
        response = await client.post(f"{BASE_URL}/token", data=login_data)
        print(f"Status Login: {response.status_code}")
        if response.status_code != 200:
            print("ERROR: Login fallido")
            return False
        
        res_json = response.json()
        print("Login Response JSON:", res_json)
        access_token = res_json.get("access_token")
        mfa_required = res_json.get("mfa_required")
        
        if not access_token or mfa_required:
            print("ERROR: Token de acceso no retornado o MFA inesperadamente requerido")
            return False
            
        print("Múltiples cookies de respuesta:", response.cookies)
        refresh_cookie = response.cookies.get("refresh_token")
        if not refresh_cookie:
            print("ERROR: Cookie refresh_token no seteada")
            return False
        print("Cookie refresh_token recibida correctamente!")

        # 2. Refresh de Token
        refresh_response = await client.post(f"{BASE_URL}/api/auth/refresh", cookies={"refresh_token": refresh_cookie})
        print(f"Status Refresh: {refresh_response.status_code}")
        if refresh_response.status_code != 200:
            print("ERROR: Refresh de token fallido")
            return False
            
        refresh_json = refresh_response.json()
        print("Refresh Response JSON:", refresh_json)
        new_access_token = refresh_json.get("access_token")
        if not new_access_token:
            print("ERROR: Nuevo token de acceso no retornado en refresh")
            return False
            
        new_refresh_cookie = refresh_response.cookies.get("refresh_token")
        if not new_refresh_cookie:
            print("ERROR: Nueva cookie refresh_token no rotada")
            return False
            
        print("Refresh Token Rotation (RTR) verificado exitosamente!")
        return True

async def test_brute_force_lockout():
    print("\n=== TEST 2: PROTECCIÓN DE FUERZA BRUTA Y BLOQUEO DE CUENTA ===")
    
    # Resetear el estado del usuario para que la prueba sea idempotente
    email = "docente02@didactico.edu"
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalars().first()
        if user:
            user.failed_login_attempts = 0
            user.lockout_until = None
            await db.commit()
            print(f"Estado de fuerza bruta reseteado para {email}")

    async with httpx.AsyncClient() as client:
        # 1. Realizar 5 intentos fallidos (el 5to define el bloqueo y retorna 401)
        for i in range(1, 6):
            login_data = {"username": email, "password": "wrongpassword"}
            res = await client.post(f"{BASE_URL}/token", data=login_data)
            print(f"Intento fallido #{i} - Status: {res.status_code} - Detail: {res.json().get('detail')}")
            if res.status_code != 401:
                print(f"ERROR: Se esperaba 401 pero se obtuvo {res.status_code}")
                return False
            
        # 2. El 6to intento (con clave correcta) debe retornar 423 (Locked)
        login_data = {"username": email, "password": "clave02"}
        res = await client.post(f"{BASE_URL}/token", data=login_data)
        print(f"Intento con clave correcta en bloqueo - Status: {res.status_code} - Detail: {res.json().get('detail')}")
        if res.status_code != 423:
            print("ERROR: La cuenta permitió el login o no devolvió 423 con contraseña correcta durante el bloqueo")
            return False
            
        # 3. El 7mo intento (con clave incorrecta) debe seguir retornando 423 (Locked)
        login_data = {"username": email, "password": "wrongpassword"}
        res = await client.post(f"{BASE_URL}/token", data=login_data)
        print(f"Intento con clave incorrecta en bloqueo - Status: {res.status_code} - Detail: {res.json().get('detail')}")
        if res.status_code != 423:
            print("ERROR: La cuenta no devolvió 423 con contraseña incorrecta durante el bloqueo")
            return False
            
        print("Bloqueo de cuenta por fuerza bruta e inhabilitación temporal verificado exitosamente!")
        return True

async def test_mfa_flow():
    print("\n=== TEST 3: CONFIGURACIÓN Y AUTENTICACIÓN MFA/2FA (TOTP) ===")
    
    # Resetear el estado de MFA para que la prueba sea idempotente
    email = "docente01@didactico.edu"
    password = "clave01"
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalars().first()
        if user:
            user.mfa_enabled = False
            user.mfa_secret = None
            await db.commit()
            print(f"Estado MFA reseteado para {email}")

    async with httpx.AsyncClient() as client:
        # 1. Login inicial
        login_data = {"username": email, "password": password}
        res = await client.post(f"{BASE_URL}/token", data=login_data)
        if res.status_code != 200:
            print(f"ERROR: Login inicial de docente01 fallido ({res.status_code})")
            return False
        
        access_token = res.json().get("access_token")
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # 2. Configurar MFA Setup
        setup_res = await client.post(f"{BASE_URL}/api/auth/mfa/setup", headers=headers)
        if setup_res.status_code != 200:
            print("ERROR: Setup de MFA fallido")
            return False
            
        setup_json = setup_res.json()
        secret = setup_json.get("secret")
        print(f"MFA Secret Generado: {secret}")
        
        # 3. Verificar y Habilitar MFA con TOTP real
        totp = pyotp.TOTP(secret)
        code = totp.now()
        print(f"Código TOTP calculado: {code}")
        
        verify_res = await client.post(
            f"{BASE_URL}/api/auth/mfa/verify-and-enable",
            headers=headers,
            json={"token": code}
        )
        print(f"MFA Verify Response ({verify_res.status_code}): {verify_res.json()}")
        if verify_res.status_code != 200:
            print("ERROR: Verificación de MFA fallida")
            return False
            
        # 4. Logout / Limpiar cookies
        await client.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        print("Sesión cerrada.")
        
        # 5. Volver a iniciar sesión (Ahora con MFA activo!)
        res_mfa_req = await client.post(f"{BASE_URL}/token", data=login_data)
        print(f"Login con MFA activo status: {res_mfa_req.status_code}")
        res_mfa_json = res_mfa_req.json()
        print("Login con MFA activo response:", res_mfa_json)
        
        if not res_mfa_json.get("mfa_required"):
            print("ERROR: MFA debería ser requerido pero no lo fue")
            return False
            
        mfa_token = res_mfa_json.get("mfa_token")
        if not mfa_token:
            print("ERROR: Token MFA temporal no devuelto")
            return False
            
        # 6. Validar código TOTP para completar login
        code_login = totp.now()
        login_mfa_res = await client.post(
            f"{BASE_URL}/token/mfa",
            json={"mfa_token": mfa_token, "code": code_login}
        )
        print(f"Login MFA final status: {login_mfa_res.status_code}")
        login_mfa_json = login_mfa_res.json()
        print("Login MFA final response:", login_mfa_json)
        
        if login_mfa_res.status_code != 200 or not login_mfa_json.get("access_token"):
            print("ERROR: Login final MFA falló")
            return False
            
        print("MFA / Doble Factor de Autenticación verificado exitosamente!")
        return True

async def test_password_recovery_and_reset():
    print("\n=== TEST 4: RECUPERACIÓN Y REESTABLECIMIENTO DE CONTRASEÑA ===")
    async with httpx.AsyncClient() as client:
        email = "docente03@didactico.edu"
        
        # 1. Solicitar recuperación
        forgot_res = await client.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": email}
        )
        print(f"Forgot password status ({forgot_res.status_code}): {forgot_res.json()}")
        if forgot_res.status_code != 200:
            print("ERROR: Solicitud de recuperación fallida")
            return False
            
        token = None
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(PasswordReset).where(PasswordReset.email == email).order_by(PasswordReset.id.desc())
            )
            reset_record = result.scalars().first()
            if reset_record:
                token = reset_record.jti
                
        if not token:
            print("ERROR: No se encontró el registro de reset token en la base de datos")
            return False
            
        print(f"Reset token recuperado de la base de datos: {token}")
        
        # Generar el JWT firmado usando la función create_reset_token
        token_jwt = create_reset_token(email, token)
        print(f"JWT de restablecimiento generado: {token_jwt}")
        
        # 3. Validar el reset token
        validate_res = await client.post(
            f"{BASE_URL}/api/auth/validate-reset-token",
            json={"token": token_jwt}
        )
        print(f"Validate token status ({validate_res.status_code}): {validate_res.json()}")
        if validate_res.status_code != 200:
            print("ERROR: Validación del token de recuperación fallida")
            return False
            
        # 4. Restablecer la contraseña
        new_password = "nuevaclavedocente03"
        reset_res = await client.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={"token": token_jwt, "password": new_password}
        )
        print(f"Reset password status ({reset_res.status_code}): {reset_res.json()}")
        if reset_res.status_code != 200:
            print("ERROR: Restablecimiento de contraseña fallido")
            return False
            
        # 5. Iniciar sesión con la nueva contraseña
        login_data = {"username": email, "password": new_password}
        login_res = await client.post(f"{BASE_URL}/token", data=login_data)
        print(f"Login con nueva clave status: {login_res.status_code}")
        if login_res.status_code != 200:
            print("ERROR: No se pudo iniciar sesión con la nueva contraseña restablecida")
            return False
            
        print("Recuperación y Restablecimiento de Contraseña verificado exitosamente!")
        return True

async def main():
    success = True
    
    try:
        t1 = await test_normal_login_and_refresh()
        success = success and t1
        
        t2 = await test_brute_force_lockout()
        success = success and t2
        
        t3 = await test_mfa_flow()
        success = success and t3
        
        t4 = await test_password_recovery_and_reset()
        success = success and t4
        
        print("\n=============================================")
        if success:
            print("¡TODAS LAS PRUEBAS DE SEGURIDAD PASARON CON ÉXITO!")
            sys.exit(0)
        else:
            print("ALGUNAS PRUEBAS DE SEGURIDAD FALLARON.")
            sys.exit(1)
            
    except Exception as e:
        print(f"\nExcepción durante la ejecución de las pruebas: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
