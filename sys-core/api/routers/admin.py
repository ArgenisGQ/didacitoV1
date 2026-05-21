import io
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import re

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, BackgroundTasks
from sqlalchemy import select, delete, update, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt

from api.database import get_db
from api.models import User, UserRole, SystemSetting, Invitation, AuditLog
from api.core.dependencies import get_current_user, check_role, get_current_audit_viewer
from api.core.settings_manager import SettingsManager
from api.core.security import SECRET_KEY, ALGORITHM, get_password_hash
from api.schemas import (
    SystemSettingResponse,
    InvitationResponse,
    BulkImportPreviewResponse,
    BulkImportConfirmRequest,
    BulkImportRowPreview,
    AuditLogResponse,
    UserInactivityResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Administration"])

# Helper to log audit actions
async def log_audit(db: AsyncSession, user_id: Optional[int], action: str, ip_address: str, user_agent: str, details: dict = None):
    try:
        audit = AuditLog(
            user_id=user_id,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details
        )
        db.add(audit)
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")

async def log_audit_background(user_id: Optional[int], action: str, ip_address: str, user_agent: str, details: dict = None):
    from api.database import get_task_db
    try:
        async with get_task_db() as db:
            audit = AuditLog(
                user_id=user_id,
                action=action,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details
            )
            db.add(audit)
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to write background audit log: {e}")

async def update_last_login(user_id: int):
    from api.database import get_task_db
    from api.models import User
    try:
        async with get_task_db() as db:
            await db.execute(
                update(User)
                .where(User.id == user_id)
                .values(last_login=datetime.now(timezone.utc))
            )
            await db.commit()
    except Exception as e:
        logger.error(f"Failed to update last login in background: {e}")

# helper to check if email is valid syntax
EMAIL_REGEX = re.compile(r"^[^@]+@[^@]+\.[^@]+$")
def is_valid_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email))

# Settings Management Endpoints
@router.get("/settings", response_model=List[SystemSettingResponse])
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN])
    result = await db.execute(select(SystemSetting).order_by(SystemSetting.key))
    return result.scalars().all()

@router.patch("/settings", response_model=List[SystemSettingResponse])
async def update_settings(
    settings_data: dict,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN])
    
    for key, val in settings_data.items():
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = res.scalars().first()
        if not setting:
            raise HTTPException(status_code=404, detail=f"Configuracion '{key}' no encontrada")
        
        # Validation checks
        str_val = str(val).strip()
        if key in ("SUPPORT_EMAIL", "SMTP_USER") and not is_valid_email(str_val):
            raise HTTPException(status_code=400, detail=f"Email invalido para la configuracion '{key}'")
        if key in ("DEFAULT_PAGINATION_LIMIT", "INVITATION_TOKEN_EXPIRE_HOURS", "MAX_CSV_FILE_SIZE_MB", "MAX_INVITATIONS_PER_DAY", "SMTP_PORT"):
            try:
                int(str_val)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Valor para '{key}' debe ser un numero entero")
        
        setting.value = str_val
        setting.updated_by = current_user.id
        db.add(setting)
    
    await db.commit()
    await SettingsManager.reload(db)
    
    await log_audit(
        db,
        user_id=current_user.id,
        action="SYSTEM_SETTINGS_UPDATED",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"updated_keys": list(settings_data.keys())}
    )
    
    result = await db.execute(select(SystemSetting).order_by(SystemSetting.key))
    return result.scalars().all()

# Bulk User Import Endpoints
@router.post("/users/import", response_model=BulkImportPreviewResponse)
async def import_users_preview(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    
    max_size_mb = SettingsManager.get_setting_as_int("MAX_CSV_FILE_SIZE_MB", 5)
    # Check file size (rough check via spooling or reading)
    content = await file.read()
    if len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo excede el tamano maximo permitido de {max_size_mb} MB"
        )
    
    # Load DataFrame
    try:
        filename = file.filename.lower()
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
        else:
            # Assume CSV
            df = pd.read_csv(io.StringIO(content.decode("utf-8", errors="ignore")))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo decodificar el archivo. Compruebe el formato CSV/Excel. Error: {str(e)}"
        )
    
    required_cols = SettingsManager.get_setting_as_list("CSV_REQUIRED_COLUMNS", ["email", "full_name", "role"])
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan las siguientes columnas obligatorias en el archivo: {', '.join(missing_cols)}"
        )
    
    preview_rows = []
    emails_in_file = set()
    
    # Fetch existing emails in db to prevent double checking in loop
    existing_users_res = await db.execute(select(User.email))
    existing_emails = {email[0].lower() for email in existing_users_res.all()}
    
    # Fetch existing pending invitations to warn about them
    existing_invs_res = await db.execute(select(Invitation.email).where(Invitation.is_revoked == False))
    pending_emails = {inv[0].lower() for inv in existing_invs_res.all()}
    
    valid_count = 0
    invalid_count = 0
    
    for idx, row in df.iterrows():
        row_num = idx + 1
        email_val = str(row.get("email", "")).strip().lower()
        name_val = str(row.get("full_name", "")).strip()
        role_val = str(row.get("role", "")).strip().upper()
        
        errors = []
        warnings = []
        
        if not email_val or email_val == "nan":
            errors.append("El correo electronico es obligatorio")
        elif not is_valid_email(email_val):
            errors.append(f"Formato de correo invalido: '{email_val}'")
        else:
            if email_val in emails_in_file:
                errors.append(f"Correo duplicado dentro del mismo archivo CSV: '{email_val}'")
            emails_in_file.add(email_val)
            
            if email_val in existing_emails:
                errors.append(f"El usuario ya esta registrado en la base de datos: '{email_val}'")
            
            if email_val in pending_emails:
                warnings.append(f"Ya existe una invitacion pendiente enviada a '{email_val}'")
                
        if not name_val or name_val == "nan":
            errors.append("El nombre completo es obligatorio")
            
        allowed_roles = [r.value for r in UserRole]
        if not role_val or role_val == "NAN":
            errors.append("El rol es obligatorio")
        elif role_val not in allowed_roles:
            errors.append(f"Rol invalido: '{role_val}'. Roles permitidos: {', '.join(allowed_roles)}")
            
        status_str = "INVALID" if errors else "VALID"
        if status_str == "VALID":
            valid_count += 1
        else:
            invalid_count += 1
            
        preview_rows.append(
            BulkImportRowPreview(
                row_num=row_num,
                email=email_val if email_val != "nan" else None,
                full_name=name_val if name_val != "nan" else None,
                role=role_val if role_val != "NAN" else None,
                status=status_str,
                errors=errors,
                warnings=warnings
            )
        )
        
    return BulkImportPreviewResponse(
        total_rows=len(df),
        valid_rows=valid_count,
        invalid_rows=invalid_count,
        rows=preview_rows
    )

@router.post("/users/import/confirm")
async def import_users_confirm(
    payload: BulkImportConfirmRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    
    if not payload.users:
        raise HTTPException(status_code=400, detail="No se proporcionaron usuarios para importar")
    
    auto_activate = SettingsManager.get_setting_as_bool("CSV_AUTO_ACTIVATE_USERS", False)
    expire_hours = SettingsManager.get_setting_as_int("INVITATION_TOKEN_EXPIRE_HOURS", 24)
    
    imported_count = 0
    invitations_created = []
    
    async with db.begin_nested(): # nested transaction for atomic operations
        for row in payload.users:
            email_clean = row.email.strip().lower()
            # Double check existence to avoid race conditions
            existing_res = await db.execute(select(User).where(User.email == email_clean))
            if existing_res.scalars().first():
                continue
                
            # Create user
            # Provide a secure long random placeholder password
            import secrets
            rand_pwd = secrets.token_urlsafe(16)
            hashed_pwd = get_password_hash(rand_pwd)
            
            new_user = User(
                email=email_clean,
                full_name=row.full_name.strip(),
                role=row.role,
                password=hashed_pwd,
                is_active=auto_activate,
                is_staff=False,
                is_superuser=False
            )
            db.add(new_user)
            await db.flush() # get new_user.id
            
            if not auto_activate:
                # Generate invitation token
                payload_jwt = {
                    "sub": email_clean,
                    "exp": datetime.now(timezone.utc) + timedelta(hours=expire_hours),
                    "type": "invitation"
                }
                inv_token = jwt.encode(payload_jwt, SECRET_KEY, algorithm=ALGORITHM)
                
                # Revoke any previous active invitations for this email
                await db.execute(
                    update(Invitation)
                    .where(Invitation.email == email_clean)
                    .values(is_revoked=True)
                )
                
                invitation = Invitation(
                    email=email_clean,
                    token=inv_token,
                    expires_at=datetime.now(timezone.utc) + timedelta(hours=expire_hours),
                    is_revoked=False,
                    user_id=new_user.id
                )
                db.add(invitation)
                invitations_created.append({
                    "email": email_clean,
                    "token": inv_token
                })
            
            imported_count += 1
            
    await db.commit()
    
    await log_audit(
        db,
        user_id=current_user.id,
        action="BULK_USER_IMPORT_CONFIRMED",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"imported_users_count": imported_count, "auto_activate": auto_activate}
    )
    
    # In reality we would queue an email background task here.
    # For this application, we return the counts and the invitation links/tokens for confirmation display.
    return {
        "success": True,
        "imported_count": imported_count,
        "auto_activate": auto_activate,
        "invitations": invitations_created
    }

# Invitation Management Endpoints
@router.get("/invitations", response_model=List[InvitationResponse])
async def list_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    result = await db.execute(select(Invitation).order_by(Invitation.created_at.desc()))
    return result.scalars().all()

@router.post("/invitations/{id}/resend")
async def resend_invitation(
    id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    
    res = await db.execute(select(Invitation).where(Invitation.id == id))
    inv = res.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitacion no encontrada")
        
    expire_hours = SettingsManager.get_setting_as_int("INVITATION_TOKEN_EXPIRE_HOURS", 24)
    
    # Generate new token
    payload_jwt = {
        "sub": inv.email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=expire_hours),
        "type": "invitation"
    }
    new_token = jwt.encode(payload_jwt, SECRET_KEY, algorithm=ALGORITHM)
    
    inv.token = new_token
    inv.expires_at = datetime.now(timezone.utc) + timedelta(hours=expire_hours)
    inv.is_revoked = False
    db.add(inv)
    await db.commit()
    
    await log_audit(
        db,
        user_id=current_user.id,
        action="USER_INVITATION_RESENT",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"email": inv.email}
    )
    
    return {"success": True, "new_token": new_token, "expires_at": inv.expires_at}

@router.delete("/invitations/{id}")
async def delete_invitation(
    id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    
    res = await db.execute(select(Invitation).where(Invitation.id == id))
    inv = res.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitacion no encontrada")
        
    # Delete the associated user ONLY if they are inactive (never activated)
    user_res = await db.execute(select(User).where(User.email == inv.email))
    user = user_res.scalars().first()
    if user and not user.is_active:
        await db.execute(delete(User).where(User.id == user.id))
        
    await db.execute(delete(Invitation).where(Invitation.id == id))
    await db.commit()
    
    await log_audit(
        db,
        user_id=current_user.id,
        action="USER_INVITATION_REVOKED",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"email": inv.email}
    )
    
    return {"success": True, "detail": "Invitacion y usuario inactivo asociado eliminados"}

# Audit Logs query
@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    limit: Optional[int] = None,
    skip: int = 0,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_audit_viewer),
    db: AsyncSession = Depends(get_db)
):
    if limit is None:
        limit = SettingsManager.get_setting_as_int("DEFAULT_PAGINATION_LIMIT", 20)
        
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        query = query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if start_date:
        try:
            if 'T' in start_date:
                dt_start = datetime.fromisoformat(start_date)
            else:
                dt_start = datetime.strptime(start_date, "%Y-%m-%d")
            if dt_start.tzinfo is None:
                dt_start = dt_start.replace(tzinfo=timezone.utc)
            query = query.where(AuditLog.created_at >= dt_start)
        except Exception as e:
            logger.error(f"Error parsing start_date: {e}")
    if end_date:
        try:
            if 'T' in end_date:
                dt_end = datetime.fromisoformat(end_date)
            else:
                dt_end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
            if dt_end.tzinfo is None:
                dt_end = dt_end.replace(tzinfo=timezone.utc)
            query = query.where(AuditLog.created_at <= dt_end)
        except Exception as e:
            logger.error(f"Error parsing end_date: {e}")
    if search:
        query = query.where(cast(AuditLog.details, String).ilike(f"%{search}%"))
        
    query = query.offset(skip).limit(limit)
    res = await db.execute(query)
    logs = res.scalars().all()
    
    # Hydrate email
    response_logs = []
    for log in logs:
        email = None
        if log.user_id:
            user_res = await db.execute(select(User.email).where(User.id == log.user_id))
            user_email_row = user_res.first()
            if user_email_row:
                email = user_email_row[0]
        response_logs.append(
            AuditLogResponse(
                id=log.id,
                user_id=log.user_id,
                user_email=email,
                action=log.action,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                details=log.details,
                created_at=log.created_at
            )
        )
        
    return response_logs

# Export Audit Logs
@router.get("/audit-logs/export")
async def export_audit_logs(
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_audit_viewer),
    db: AsyncSession = Depends(get_db)
):
    from fastapi.responses import StreamingResponse
    import csv
    
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        query = query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if start_date:
        try:
            if 'T' in start_date:
                dt_start = datetime.fromisoformat(start_date)
            else:
                dt_start = datetime.strptime(start_date, "%Y-%m-%d")
            if dt_start.tzinfo is None:
                dt_start = dt_start.replace(tzinfo=timezone.utc)
            query = query.where(AuditLog.created_at >= dt_start)
        except Exception as e:
            pass
    if end_date:
        try:
            if 'T' in end_date:
                dt_end = datetime.fromisoformat(end_date)
            else:
                dt_end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
            if dt_end.tzinfo is None:
                dt_end = dt_end.replace(tzinfo=timezone.utc)
            query = query.where(AuditLog.created_at <= dt_end)
        except Exception as e:
            pass
    if search:
        query = query.where(cast(AuditLog.details, String).ilike(f"%{search}%"))
        
    res = await db.execute(query)
    logs = res.scalars().all()
    
    def generate_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Fecha", "Accion", "ID Usuario", "IP Address", "User Agent", "Detalles"])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        
        for log in logs:
            writer.writerow([
                log.id,
                log.created_at.isoformat() if log.created_at else "",
                log.action,
                log.user_id if log.user_id else "Anonimo",
                log.ip_address,
                log.user_agent,
                log.details or ""
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
            
    response_headers = {
        'Content-Disposition': 'attachment; filename="bitacora_auditoria.csv"',
        'Content-Type': 'text/csv; charset=utf-8'
    }
    return StreamingResponse(generate_csv(), headers=response_headers)

# Inactivity manual actions
@router.post("/users/{id}/deactivate-inactivity")
async def deactivate_user_inactivity(
    id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    
    res = await db.execute(select(User).where(User.id == id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    user.is_active = False
    user.deactivated_at = datetime.now(timezone.utc)
    user.deactivation_reason = "Inactividad prolongada (Desactivación manual)"
    db.add(user)
    
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == id)
        .values(is_revoked=True)
    )
    await db.commit()
    
    print("\n" + "="*80)
    print(" [EMAIL SIMULATION] CUENTA SUSPENDIDA POR INACTIVIDAD")
    print(f" Para el usuario: {user.email}")
    print(" Motivo: Inactividad prolongada. Contacte al administrador para reactivar.")
    print("="*80 + "\n")
    
    background_tasks.add_task(
        log_audit_background,
        user_id=current_user.id,
        action="USER_DEACTIVATED",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"deactivated_user_id": id, "deactivated_user_email": user.email, "type": "manual_inactivity"}
    )
    
    return {"success": True, "detail": f"Cuenta de {user.full_name} desactivada por inactividad."}

@router.post("/users/{id}/warn-inactivity")
async def warn_user_inactivity(
    id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    
    res = await db.execute(select(User).where(User.id == id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    print("\n" + "="*80)
    print(" [EMAIL SIMULATION] ADVERTENCIA DE INACTIVIDAD DE CUENTA")
    print(f" Para el usuario: {user.email}")
    print(" Mensaje: Su cuenta no ha registrado actividad recientemente. Se suspenderá pronto.")
    print("="*80 + "\n")
    
    background_tasks.add_task(
        log_audit_background,
        user_id=current_user.id,
        action="USER_INACTIVITY_WARNING",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"warned_user_id": id, "warned_user_email": user.email}
    )
    
    return {"success": True, "detail": f"Advertencia de inactividad enviada a {user.full_name}."}

# Users inactivity analytics
@router.get("/analytics/inactivity", response_model=List[UserInactivityResponse])
async def list_inactive_users(
    threshold_days: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    
    if threshold_days is None:
        threshold_days = SettingsManager.get_setting_as_int("INACTIVE_ACCOUNT_THRESHOLD_DAYS", 90)
        
    limit_date = datetime.now(timezone.utc) - timedelta(days=threshold_days)
    
    # Query active users who haven't logged in since limit_date, or never logged in and registered > threshold_days ago
    query = select(User).where(
        User.is_active == True,
        User.role != UserRole.SUPER_ADMIN,
        (User.last_login < limit_date) | ((User.last_login == None) & (User.date_joined < limit_date))
    )
    
    res = await db.execute(query)
    users = res.scalars().all()
    
    response = []
    for u in users:
        date_ref = u.last_login or u.date_joined
        # make offset-aware datetime if naive
        if date_ref.tzinfo is None:
            date_ref = date_ref.replace(tzinfo=timezone.utc)
        days_inactive = (datetime.now(timezone.utc) - date_ref).days
        response.append(
            UserInactivityResponse(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                last_login=u.last_login,
                days_inactive=days_inactive
            )
        )
        
    return sorted(response, key=lambda x: x.days_inactive, reverse=True)
