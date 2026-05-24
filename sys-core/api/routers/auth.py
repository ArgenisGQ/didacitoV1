from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import uuid
import hashlib
import pyotp
import qrcode
import base64
import asyncio
from io import BytesIO
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError

from api.database import get_db
from api.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    create_mfa_temp_token,
    decode_access_token,
    SECRET_KEY,
    ALGORITHM,
)
from api.models import User, RefreshToken, PasswordReset
from api.schemas import (
    LoginResponse,
    ForgotPasswordRequest,
    ValidateTokenRequest,
    ResetPasswordRequest,
    MFASetupResponse,
    MFAVerifyRequest,
    MFATokenLoginRequest,
    TokenResponse,
    AccountActivationRequest,
    TeacherFirstPasswordChangeRequest,
)
from api.core.dependencies import get_current_user
from api.core.limiter import limiter

router = APIRouter(tags=["Auth"])

# Configuration helper
import os
is_prod = os.getenv("APP_ENV", "local") == "production"


@router.post("/token", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    from api.routers.admin import log_audit_background, update_last_login
    
    result = await db.execute(
        select(User).where(User.email == form_data.username)
    )
    user = result.scalars().first()

    # 1. Anti-brute force / Account lockout check
    if user and user.lockout_until:
        now = datetime.now(timezone.utc)
        lockout_until = user.lockout_until
        if lockout_until.tzinfo is None:
            lockout_until = lockout_until.replace(tzinfo=timezone.utc)

        if now < lockout_until:
            seconds_left = int((lockout_until - now).total_seconds())
            background_tasks.add_task(
                log_audit_background,
                user_id=user.id,
                action="LOGIN_FAILED",
                ip_address=request.client.host if request.client else "unknown",
                user_agent=request.headers.get("user-agent", "unknown"),
                details={"email": user.email, "reason": "Cuenta bloqueada temporalmente"}
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Cuenta bloqueada temporalmente. Intente de nuevo en {seconds_left} segundos.",
            )

    # 2. Check credentials
    if not user or not verify_password(form_data.password, user.password):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.lockout_until = datetime.now(timezone.utc) + timedelta(minutes=15)
                background_tasks.add_task(
                    log_audit_background,
                    user_id=user.id,
                    action="ACCOUNT_LOCKOUT",
                    ip_address=request.client.host if request.client else "unknown",
                    user_agent=request.headers.get("user-agent", "unknown"),
                    details={"email": user.email, "reason": "Demasiados intentos fallidos"}
                )
            await db.commit()
            
            background_tasks.add_task(
                log_audit_background,
                user_id=user.id,
                action="LOGIN_FAILED",
                ip_address=request.client.host if request.client else "unknown",
                user_agent=request.headers.get("user-agent", "unknown"),
                details={"email": user.email, "reason": "Contraseña incorrecta"}
            )
        else:
            background_tasks.add_task(
                log_audit_background,
                user_id=None,
                action="LOGIN_FAILED",
                ip_address=request.client.host if request.client else "unknown",
                user_agent=request.headers.get("user-agent", "unknown"),
                details={"email": form_data.username, "reason": "Usuario no encontrado"}
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Successful primary auth: reset failed attempts
    user.failed_login_attempts = 0
    user.lockout_until = None
    await db.commit()

    # 3.5. First-login password change check
    if getattr(user, "needs_password_change", False):
        temp_token = jwt.encode(
            {
                "sub": str(user.id),
                "email": user.email,
                "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
                "type": "password_change_pending"
            },
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        return {
            "access_token": None,
            "token_type": "bearer",
            "mfa_required": False,
            "mfa_token": None,
            "needs_password_change": True,
            "temp_token": temp_token
        }

    # 4. MFA transition check
    if user.mfa_enabled:
        mfa_token = create_mfa_temp_token(user_id=user.id, email=user.email)
        return {
            "access_token": None,
            "token_type": "bearer",
            "mfa_required": True,
            "mfa_token": mfa_token,
        }

    # 5. Issue access & refresh tokens
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    jti = uuid.uuid4().hex
    refresh_token_jwt = create_refresh_token(data={"sub": user.email}, jti=jti)
    token_hash = hashlib.sha256(refresh_token_jwt.encode()).hexdigest()

    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        jti=jti,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        is_revoked=False,
        parent_jti=None,
    )
    db.add(db_refresh_token)
    await db.commit()

    # Set cookie HttpOnly
    response.set_cookie(
        key="refresh_token",
        value=refresh_token_jwt,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )

    background_tasks.add_task(update_last_login, user_id=user.id)
    background_tasks.add_task(
        log_audit_background,
        user_id=user.id,
        action="LOGIN_SUCCESS",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"email": user.email, "mfa_used": False}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "mfa_required": False,
    }


@router.post("/token/mfa", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login_mfa(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    mfa_req: MFATokenLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    from api.routers.admin import log_audit_background, update_last_login

    # Validate MFA temp token
    try:
        payload = jwt.decode(mfa_req.mfa_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "mfa_pending":
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token MFA temporal inválido o expirado",
        )

    user_id = int(payload.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inválido",
        )

    # Brute force checks
    if user.lockout_until:
        now = datetime.now(timezone.utc)
        lockout_until = user.lockout_until
        if lockout_until.tzinfo is None:
            lockout_until = lockout_until.replace(tzinfo=timezone.utc)

        if now < lockout_until:
            seconds_left = int((lockout_until - now).total_seconds())
            background_tasks.add_task(
                log_audit_background,
                user_id=user.id,
                action="LOGIN_FAILED",
                ip_address=request.client.host if request.client else "unknown",
                user_agent=request.headers.get("user-agent", "unknown"),
                details={"email": user.email, "reason": "Cuenta bloqueada temporalmente"}
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Cuenta bloqueada temporalmente. Intente de nuevo en {seconds_left} segundos.",
            )

    # Verify TOTP code
    if not user.mfa_secret or not user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA no está configurado para este usuario",
        )

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(mfa_req.code):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.lockout_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            background_tasks.add_task(
                log_audit_background,
                user_id=user.id,
                action="ACCOUNT_LOCKOUT",
                ip_address=request.client.host if request.client else "unknown",
                user_agent=request.headers.get("user-agent", "unknown"),
                details={"email": user.email, "reason": "Demasiados intentos fallidos (MFA)"}
            )
        await db.commit()
        
        background_tasks.add_task(
            log_audit_background,
            user_id=user.id,
            action="MFA_VERIFICATION_FAILED",
            ip_address=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("user-agent", "unknown"),
            details={"email": user.email}
        )
        background_tasks.add_task(
            log_audit_background,
            user_id=user.id,
            action="LOGIN_FAILED",
            ip_address=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("user-agent", "unknown"),
            details={"email": user.email, "reason": "MFA invalido"}
        )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código de verificación incorrecto",
        )

    # Success
    user.failed_login_attempts = 0
    user.lockout_until = None
    await db.commit()

    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    jti = uuid.uuid4().hex
    refresh_token_jwt = create_refresh_token(data={"sub": user.email}, jti=jti)
    token_hash = hashlib.sha256(refresh_token_jwt.encode()).hexdigest()

    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        jti=jti,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        is_revoked=False,
        parent_jti=None,
    )
    db.add(db_refresh_token)
    await db.commit()

    # Set cookie HttpOnly
    response.set_cookie(
        key="refresh_token",
        value=refresh_token_jwt,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )

    background_tasks.add_task(update_last_login, user_id=user.id)
    background_tasks.add_task(
        log_audit_background,
        user_id=user.id,
        action="LOGIN_SUCCESS",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"email": user.email, "mfa_used": True}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "mfa_required": False,
    }


@router.post("/api/auth/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    url = totp.provisioning_uri(current_user.email, issuer_name="DIDACTICO")

    # Generate QR Code image in memory
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    try:
        img.save(buffered, format="PNG")
    except TypeError:
        img.save(buffered)
    qr_base64 = base64.b64encode(buffered.getvalue()).decode()

    # Temporarily store secret (but don't enable yet)
    current_user.mfa_secret = secret
    await db.commit()

    return {
        "qr_code_base64": f"data:image/png;base64,{qr_base64}",
        "secret": secret,
    }


@router.post("/api/auth/mfa/verify-and-enable")
async def verify_and_enable_mfa(
    verify_req: MFAVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA Setup no iniciado",
        )

    totp = pyotp.TOTP(current_user.mfa_secret)
    if totp.verify(verify_req.token):
        current_user.mfa_enabled = True
        await db.commit()
        return {"message": "Autenticación multifactor activada exitosamente"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código de verificación incorrecto",
        )


@router.post("/api/auth/mfa/disable")
async def disable_mfa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    await db.commit()
    return {"message": "Autenticación multifactor desactivada exitosamente"}


@router.post("/api/auth/first-login-change-password", response_model=LoginResponse)
async def first_login_change_password(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    payload_data: TeacherFirstPasswordChangeRequest,
    db: AsyncSession = Depends(get_db)
):
    from api.routers.admin import log_audit_background, update_last_login
    import zxcvbn
    from api.core.settings_manager import SettingsManager
    
    # 1. Decode and validate the temporary password change pending token
    try:
        payload = jwt.decode(payload_data.temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_change_pending":
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token temporal de cambio de clave inválido o expirado"
        )
        
    user_id = int(payload.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inválido o inactivo"
        )
        
    # 2. Robustness check of the new password using zxcvbn
    strength = zxcvbn.zxcvbn(payload_data.new_password)
    min_score = SettingsManager.get_setting_as_int("MINIMUM_PASSWORD_STRENGTH_SCORE", 3)
    if strength.get("score", 0) < min_score:
        crack_time = strength.get("crack_times_display", {}).get("offline_fast_hashing_1e10_per_second", "instantaneamente")
        warning = strength.get("feedback", {}).get("warning", "")
        suggestions = ", ".join(strength.get("feedback", {}).get("suggestions", []))
        detail_msg = f"Contraseña muy débil (Fortaleza {strength.get('score')}/{min_score}). Se crackearía {crack_time}."
        if warning:
            detail_msg += f" Advertencia: {warning}."
        if suggestions:
            detail_msg += f" Sugerencias: {suggestions}."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail_msg
        )
        
    # 3. Save new password and remove mandatory change password flag
    user.password = get_password_hash(payload_data.new_password)
    user.needs_password_change = False
    await db.commit()
    
    # 4. Generate definitive session tokens (RTR cookie refresh token)
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    jti = uuid.uuid4().hex
    refresh_token_jwt = create_refresh_token(data={"sub": user.email}, jti=jti)
    token_hash = hashlib.sha256(refresh_token_jwt.encode()).hexdigest()
    
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        jti=jti,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        is_revoked=False,
        parent_jti=None
    )
    db.add(db_refresh_token)
    await db.commit()
    
    # Set Cookie HttpOnly securely
    response.set_cookie(
        key="refresh_token",
        value=refresh_token_jwt,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=7 * 24 * 3600
    )
    
    background_tasks.add_task(update_last_login, user_id=user.id)
    background_tasks.add_task(
        log_audit_background,
        user_id=user.id,
        action="PASSWORD_MANDATORY_CHANGED",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"email": user.email}
    )
    background_tasks.add_task(
        log_audit_background,
        user_id=user.id,
        action="LOGIN_SUCCESS",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"email": user.email, "mfa_used": False}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "mfa_required": False,
        "needs_password_change": False
    }


@router.post("/api/auth/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token_jwt = request.cookies.get("refresh_token")
    if not refresh_token_jwt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cookie refresh_token no encontrada",
        )

    # Decode and validate token JWT structure
    try:
        payload = jwt.decode(refresh_token_jwt, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de refresco inválido o expirado",
        )

    jti = payload.get("jti")
    email = payload.get("sub")

    # Look up in database
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.jti == jti)
    )
    token_record = result.scalars().first()

    # RTR Violation check
    if not token_record or token_record.is_revoked:
        if token_record:
            # Replay attack: revoke all tokens for this user
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == token_record.user_id)
                .values(is_revoked=True)
            )
            await db.commit()

        # Clear cookie
        response.delete_cookie("refresh_token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Alerta de seguridad: Intento de reutilización de token detectado.",
        )

    # Success: verify user
    result_user = await db.execute(select(User).where(User.id == token_record.user_id))
    user = result_user.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inválido o inactivo",
        )

    # Revoke old token
    token_record.is_revoked = True

    # Issue new token pair
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    new_jti = uuid.uuid4().hex
    new_refresh_token_jwt = create_refresh_token(data={"sub": user.email}, jti=new_jti)
    new_token_hash = hashlib.sha256(new_refresh_token_jwt.encode()).hexdigest()

    db_new_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=new_token_hash,
        jti=new_jti,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        is_revoked=False,
        parent_jti=jti,
    )
    db.add(db_new_refresh_token)
    await db.commit()

    # Set cookie HttpOnly
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token_jwt,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/api/auth/logout")
async def logout(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    from api.routers.admin import log_audit_background
    user_id = None
    refresh_token_jwt = request.cookies.get("refresh_token")
    if refresh_token_jwt:
        try:
            payload = jwt.decode(refresh_token_jwt, SECRET_KEY, algorithms=[ALGORITHM])
            jti = payload.get("jti")
            result = await db.execute(
                select(RefreshToken).where(RefreshToken.jti == jti)
            )
            token_record = result.scalars().first()
            if token_record:
                user_id = token_record.user_id
                token_record.is_revoked = True
                await db.commit()
        except JWTError:
            pass

    response.delete_cookie("refresh_token")
    
    background_tasks.add_task(
        log_audit_background,
        user_id=user_id,
        action="LOGOUT",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={}
    )
    
    return {"message": "Sesión cerrada exitosamente"}


@router.post("/api/auth/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    forgot_req: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    from api.routers.admin import log_audit_background
    result = await db.execute(
        select(User).where(User.email == forgot_req.email)
    )
    user = result.scalars().first()

    if user:
        jti = uuid.uuid4().hex
        reset_token_jwt = create_reset_token(user.email, jti)

        db_reset = PasswordReset(
            jti=jti,
            email=user.email,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
            used=False,
        )
        db.add(db_reset)
        await db.commit()

        # Simulate SMTP sending by printing in logs
        print("\n" + "="*80)
        print(" [EMAIL SIMULATION] ENLACE DE RECUPERACIÓN DE CONTRASEÑA")
        print(f" Para el usuario: {user.email}")
        print(f" Enlace: http://localhost/reset-password?token={reset_token_jwt}")
        print("="*80 + "\n")
        
        background_tasks.add_task(
            log_audit_background,
            user_id=user.id,
            action="PASSWORD_RESET_REQUESTED",
            ip_address=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("user-agent", "unknown"),
            details={"email": user.email}
        )
    else:
        # Anti user-enumeration timing mitigation
        await asyncio.sleep(0.3)
        
        background_tasks.add_task(
            log_audit_background,
            user_id=None,
            action="PASSWORD_RESET_REQUESTED_FAILED",
            ip_address=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("user-agent", "unknown"),
            details={"email": forgot_req.email, "reason": "Usuario no registrado"}
        )

    return {
        "message": "Si la cuenta existe, se ha enviado un enlace para restablecer la contraseña."
    }


@router.post("/api/auth/validate-reset-token")
async def validate_reset_token(
    validate_req: ValidateTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = jwt.decode(validate_req.token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "reset":
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado",
        )

    jti = payload.get("jti")
    result = await db.execute(
        select(PasswordReset).where(PasswordReset.jti == jti)
    )
    reset_record = result.scalars().first()

    if not reset_record or reset_record.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o ya utilizado",
        )

    now = datetime.now(timezone.utc)
    expires_at = reset_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token expirado",
        )

    return {
        "valid": True,
        "email": reset_record.email,
    }


@router.post("/api/auth/reset-password")
async def reset_password(
    reset_req: ResetPasswordRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    from api.routers.admin import log_audit_background
    # 1. Validate token first
    try:
        payload = jwt.decode(reset_req.token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "reset":
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o expirado",
        )

    jti = payload.get("jti")
    result = await db.execute(
        select(PasswordReset).where(PasswordReset.jti == jti)
    )
    reset_record = result.scalars().first()

    if not reset_record or reset_record.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido o ya utilizado",
        )

    now = datetime.now(timezone.utc)
    expires_at = reset_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token expirado",
        )

    # 2. Update user credentials
    result_user = await db.execute(
        select(User).where(User.email == reset_record.email)
    )
    user = result_user.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario asociado al token no existe",
        )

    user.password = get_password_hash(reset_req.password)
    user.failed_login_attempts = 0
    user.lockout_until = None

    reset_record.used = True
    await db.commit()

    background_tasks.add_task(
        log_audit_background,
        user_id=user.id,
        action="PASSWORD_RESET_SUCCESS",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"email": user.email}
    )

    return {"message": "La contraseña ha sido restablecida exitosamente."}


@router.post("/activate")
async def activate_account(
    payload: AccountActivationRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    from api.core.settings_manager import SettingsManager
    from api.models import Invitation
    import zxcvbn
    from jose import jwt, JWTError
    from api.core.security import SECRET_KEY, ALGORITHM
    
    support_email = SettingsManager.get_cached_setting("SUPPORT_EMAIL", "soporte@didactico.edu")
    
    # 1. Decode token
    try:
        decoded = jwt.decode(payload.token, SECRET_KEY, algorithms=[ALGORITHM])
        if decoded.get("type") != "invitation":
            raise HTTPException(
                status_code=400,
                detail=f"Token de invitacion invalido. Solicite soporte a {support_email}"
            )
        email = decoded.get("sub")
    except JWTError:
        raise HTTPException(
            status_code=400,
            detail=f"El enlace de invitacion es invalido o ha expirado. Por favor, solicite un nuevo enlace de acceso o contacte a {support_email}"
        )
        
    # 2. Check if the invitation exists, is not revoked, and not expired
    res_inv = await db.execute(select(Invitation).where(Invitation.token == payload.token))
    inv = res_inv.scalars().first()
    if not inv or inv.is_revoked:
        raise HTTPException(
            status_code=400,
            detail=f"Esta invitacion ya ha sido utilizada, revocada o es invalida. Por favor, contacte a {support_email}"
        )
        
    now = datetime.now(timezone.utc)
    expires_at = inv.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if now > expires_at:
        raise HTTPException(
            status_code=400,
            detail=f"El enlace de invitacion ha expirado. Contacte a la administracion o soporte en {support_email} para recibir un nuevo enlace."
        )
        
    # 3. Check associated user
    res_user = await db.execute(select(User).where(User.email == email))
    user = res_user.scalars().first()
    if not user:
        raise HTTPException(
            status_code=400,
            detail=f"El usuario asociado a esta invitacion no existe. Contacte a {support_email}"
        )
        
    # 4. Password strength check
    strength = zxcvbn.zxcvbn(payload.password)
    min_score = SettingsManager.get_setting_as_int("MINIMUM_PASSWORD_STRENGTH_SCORE", 3)
    if strength.get("score", 0) < min_score:
        crack_time = strength.get("crack_times_display", {}).get("offline_fast_hashing_1e10_per_second", "instantaneamente")
        warning = strength.get("feedback", {}).get("warning", "")
        suggestions = ", ".join(strength.get("feedback", {}).get("suggestions", []))
        detail_msg = f"Contrasena muy debil (Score {strength.get('score')}/{min_score}). Se crackearia {crack_time}."
        if warning:
            detail_msg += f" Advertencia: {warning}."
        if suggestions:
            detail_msg += f" Sugerencias: {suggestions}."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail_msg
        )
        
    # 5. Activate user and set password
    user.password = get_password_hash(payload.password)
    user.is_active = True
    db.add(user)
    
    # 6. Revoke invitation
    inv.is_revoked = True
    db.add(inv)
    
    await db.commit()
    
    # 7. Write audit log
    from api.routers.admin import log_audit_background
    background_tasks.add_task(
        log_audit_background,
        user_id=user.id,
        action="USER_ACTIVATION_SUCCESS",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"email": email}
    )
    
    return {"success": True, "detail": "Cuenta activada exitosamente. Ya puede iniciar sesion."}

