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
from api.models import User, UserRole, SystemSetting, Invitation, AuditLog, AcademicPeriod, UserAcademicPeriod, CreationMethod
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
        if key == "SYSTEM_TIMEZONE":
            import zoneinfo
            try:
                zoneinfo.ZoneInfo(str_val)
            except Exception:
                raise HTTPException(status_code=400, detail=f"Zona horaria '{str_val}' invalida")
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

@router.get("/system-time")
async def get_system_time(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN])
    import zoneinfo
    from datetime import datetime
    
    common_tzs = sorted([
        "America/Caracas", "America/Bogota", "America/Lima", 
        "America/Santiago", "America/Mexico_City", "America/Argentina/Buenos_Aires", 
        "America/Guayaquil", "America/Sao_Paulo", "America/New_York", 
        "Europe/Madrid", "UTC"
    ])
    
    current_tz = SettingsManager.get_cached_setting("SYSTEM_TIMEZONE", "America/Caracas")
    
    try:
        tz = zoneinfo.ZoneInfo(current_tz)
    except Exception:
        tz = zoneinfo.ZoneInfo("America/Caracas")
        
    now_tz = datetime.now(tz)
    
    return {
        "current_timezone": current_tz,
        "server_utc_time": datetime.now(timezone.utc).isoformat(),
        "system_formatted_time": now_tz.strftime("%Y-%m-%d %H:%M:%S %Z %z"),
        "iso_time": now_tz.isoformat(),
        "available_timezones": common_tzs
    }

# Bulk User Import Endpoints
@router.post("/users/import", response_model=BulkImportPreviewResponse)
async def import_users_preview(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    
    max_size_mb = SettingsManager.get_setting_as_int("MAX_CSV_FILE_SIZE_MB", 5)
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
            # Assume CSV - Auto-detect delimiter
            csv_str = content.decode("utf-8", errors="ignore")
            sep = ";" if ";" in csv_str.split("\n")[0] else ","
            df = pd.read_csv(io.StringIO(csv_str), sep=sep)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo decodificar el archivo. Compruebe el formato CSV/Excel. Error: {str(e)}"
        )
    
    # Normalize column names to make import highly tolerant
    import unicodedata
    def normalize_col(col_name: str) -> str:
        c = col_name.strip().lower()
        c = "".join(
            ch for ch in unicodedata.normalize('NFKD', c)
            if not unicodedata.combining(ch)
        )
        return c

    df.columns = [normalize_col(c) for c in df.columns]
    
    # Check if this is a Teacher Bulk Import by checking for 'cedula' column
    is_teacher_import = "cedula" in df.columns
    
    if is_teacher_import:
        required_cols = ["usuario", "cedula", "nombre", "apellido", "email", "curso completo", "periodo academico"]
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400,
                detail=f"Faltan las siguientes columnas obligatorias para la importación de profesores: {', '.join(missing_cols)}"
            )
    else:
        required_cols = SettingsManager.get_setting_as_list("CSV_REQUIRED_COLUMNS", ["email", "full_name", "role"])
        norm_req_cols = [normalize_col(c) for c in required_cols]
        missing_cols = [required_cols[i] for i, norm in enumerate(norm_req_cols) if norm not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400,
                detail=f"Faltan las siguientes columnas obligatorias en el archivo: {', '.join(missing_cols)}"
            )
    
    preview_rows = []
    
    # Fetch existing data in db to prevent double checking in loop
    existing_users_res = await db.execute(select(User.email, User.id_user))
    existing_rows = existing_users_res.all()
    existing_emails = {r[0].lower() for r in existing_rows if r[0]}
    existing_cedulas = {str(r[1]).strip() for r in existing_rows if r[1]}
    
    # Fetch existing pending invitations to warn about them
    existing_invs_res = await db.execute(select(Invitation.email).where(Invitation.is_revoked == False))
    pending_emails = {inv[0].lower() for inv in existing_invs_res.all()}
    
    valid_count = 0
    invalid_count = 0
    emails_in_file = set()
    
    if is_teacher_import:
        teacher_records = {} # keyed by email
        
        for idx, row in df.iterrows():
            row_num = idx + 1
            email_val = str(row.get("email", "")).strip().lower()
            cedula_raw = str(row.get("cedula", "")).strip()
            if cedula_raw.endswith(".0"):
                cedula_raw = cedula_raw[:-2]
            username_val = str(row.get("usuario", "")).strip()
            first_name_val = str(row.get("nombre", "")).strip()
            last_name_val = str(row.get("apellido", "")).strip()
            curso_completo = str(row.get("curso completo", "")).strip()
            period_val = str(row.get("periodo academico", "")).strip()
            
            # Parse 'Curso Completo' (Subject code and Section separated by spaces)
            parts = [p for p in curso_completo.split() if p]
            subject_code_val = parts[0] if len(parts) > 0 and parts[0].lower() != "nan" else None
            section_val = parts[1] if len(parts) > 1 and parts[1].lower() != "nan" else None
            
            if not email_val or email_val == "nan":
                continue # Skip completely empty email rows
                
            if email_val not in teacher_records:
                errors = []
                warnings = []
                
                if not is_valid_email(email_val):
                    errors.append(f"Formato de correo invalido: '{email_val}'")
                if email_val in existing_emails:
                    warnings.append(f"El usuario ya esta registrado en la base de datos: '{email_val}'. Se asociará a este periodo académico.")
                if email_val in pending_emails:
                    warnings.append(f"Ya existe una invitacion pendiente enviada a '{email_val}'")
                    
                if not username_val or username_val == "nan":
                    errors.append("El usuario es obligatorio")
                if not cedula_raw or cedula_raw == "nan":
                    errors.append("La cédula es obligatoria")
                elif cedula_raw in existing_cedulas:
                    warnings.append(f"La cédula ya está registrada en la base de datos: '{cedula_raw}'. Se asociará a este periodo académico.")
                    
                if not first_name_val or first_name_val == "nan":
                    errors.append("El nombre es obligatorio")
                if not last_name_val or last_name_val == "nan":
                    errors.append("El apellido es obligatorio")
                    
                if not subject_code_val:
                    errors.append("El código de la materia (en el curso completo) es obligatorio")
                    
                subject_codes_set = {subject_code_val} if subject_code_val else set()
                sections_set = {section_val} if section_val else set()
                periods_set = {period_val} if period_val and period_val != "nan" else set()
                
                if subject_code_val:
                    # Soft relationship check with programs sinopticos
                    from api.models import Subject
                    subj_res = await db.execute(select(Subject).where(Subject.code == subject_code_val))
                    if not subj_res.scalars().first():
                        warnings.append(
                            f"La materia '{subject_code_val}' no se encuentra registrada en el sistema de programas sinópticos. "
                            "El usuario se cargará con éxito y se vinculará de manera reactiva tan pronto como se cargue el PDF del syllabus."
                        )
                        
                teacher_records[email_val] = {
                    "row_num": row_num,
                    "email": email_val,
                    "full_name": f"{first_name_val} {last_name_val}".strip(),
                    "username": username_val,
                    "id_user": cedula_raw,
                    "first_name": first_name_val,
                    "last_name": last_name_val,
                    "subject_codes_set": subject_codes_set,
                    "sections_set": sections_set,
                    "periods_set": periods_set,
                    "errors": errors,
                    "warnings": warnings,
                    "role": UserRole.DOCENTE
                }
            else:
                # Merge into existing record
                rec = teacher_records[email_val]
                if subject_code_val and subject_code_val not in rec["subject_codes_set"]:
                    rec["subject_codes_set"].add(subject_code_val)
                    from api.models import Subject
                    subj_res = await db.execute(select(Subject).where(Subject.code == subject_code_val))
                    if not subj_res.scalars().first():
                        rec["warnings"].append(
                            f"La materia '{subject_code_val}' no se encuentra registrada en el sistema de programas sinópticos. "
                            "El usuario se cargará con éxito y se vinculará de manera reactiva tan pronto como se cargue el PDF del syllabus."
                        )
                if section_val:
                    rec["sections_set"].add(section_val)
                if period_val and period_val != "nan":
                    rec["periods_set"].add(period_val)
                    
        for email_val, rec in teacher_records.items():
            status_str = "INVALID" if rec["errors"] else "VALID"
            if status_str == "VALID":
                valid_count += 1
            else:
                invalid_count += 1
                
            preview_rows.append(
                BulkImportRowPreview(
                    row_num=rec["row_num"],
                    email=email_val,
                    full_name=rec["full_name"],
                    role=rec["role"],
                    status=status_str,
                    errors=rec["errors"],
                    warnings=rec["warnings"],
                    username=rec["username"],
                    id_user=rec["id_user"],
                    first_name=rec["first_name"],
                    last_name=rec["last_name"],
                    subject_code=", ".join(sorted(rec["subject_codes_set"])),
                    section=", ".join(sorted(rec["sections_set"])),
                    academic_period=", ".join(sorted(rec["periods_set"]))
                )
            )
    else:
        # Standard Bulk Import
        for idx, row in df.iterrows():
            row_num = idx + 1
            errors = []
            warnings = []
            
            email_val = str(row.get("email", "")).strip().lower()
            
            if not email_val or email_val == "nan":
                errors.append("El correo electronico es obligatorio")
            elif not is_valid_email(email_val):
                errors.append(f"Formato de correo invalido: '{email_val}'")
            else:
                if email_val in emails_in_file:
                    errors.append(f"Correo duplicado dentro del mismo archivo CSV: '{email_val}'")
                emails_in_file.add(email_val)
                
                if email_val in existing_emails:
                    warnings.append(f"El usuario ya esta registrado en la base de datos: '{email_val}'. Se asociará a este periodo académico.")
                
                if email_val in pending_emails:
                    warnings.append(f"Ya existe una invitacion pendiente enviada a '{email_val}'")
                    
            name_val = str(row.get("full_name", "")).strip()
            role_val = str(row.get("role", "")).strip().upper()
            
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
    
    activation_method = payload.activation_method or "activate"
    auto_activate = (activation_method == "activate")
    expire_hours = SettingsManager.get_setting_as_int("INVITATION_TOKEN_EXPIRE_HOURS", 24)
    
    # Pre-fetch all academic periods to resolve IDs efficiently
    ap_res = await db.execute(select(AcademicPeriod))
    ap_map = {ap.name.strip().lower(): ap.id for ap in ap_res.scalars().all()}
    
    imported_count = 0
    invitations_created = []
    processed_periods = set()
    
    async with db.begin_nested(): # nested transaction for atomic operations
        for row in payload.users:
            email_clean = row.email.strip().lower()
            
            # Resolve period id
            resolved_ap_id = row.academic_period_id
            if not resolved_ap_id and row.academic_period:
                ap_clean = row.academic_period.strip().lower()
                resolved_ap_id = ap_map.get(ap_clean)
                
            if resolved_ap_id:
                processed_periods.add(resolved_ap_id)
            
            existing_res = await db.execute(select(User).where(User.email == email_clean))
            existing_user = existing_res.scalars().first()
            
            if existing_user:
                # User already exists globally. Check if they are associated with the selected period.
                if resolved_ap_id:
                    rel_res = await db.execute(
                        select(UserAcademicPeriod)
                        .where(
                            UserAcademicPeriod.user_id == existing_user.id,
                            UserAcademicPeriod.academic_period_id == resolved_ap_id
                        )
                    )
                    existing_rel = rel_res.scalars().first()
                    if not existing_rel:
                        # Associate existing user with new period
                        new_rel = UserAcademicPeriod(
                            user_id=existing_user.id,
                            academic_period_id=resolved_ap_id,
                            subject_code=row.subject_code.strip() if row.subject_code else None,
                            section=row.section.strip() if row.section else None,
                            is_active=True,
                            created_by_id=current_user.id,
                            creation_method=CreationMethod.BULK
                        )
                        db.add(new_rel)
                        imported_count += 1
                continue
                
            if row.id_user:
                # Teacher Bulk Import Flow
                if auto_activate:
                    # Initial password is Cédula (id_user)
                    hashed_pwd = get_password_hash(row.id_user.strip())
                    is_active_val = True
                    needs_pwd_change_val = True
                else:
                    # By Invitation
                    import secrets
                    rand_pwd = secrets.token_urlsafe(16)
                    hashed_pwd = get_password_hash(rand_pwd)
                    is_active_val = False
                    needs_pwd_change_val = False
                
                new_user = User(
                    email=email_clean,
                    full_name=row.full_name.strip(),
                    role=UserRole.DOCENTE,
                    password=hashed_pwd,
                    is_active=is_active_val,
                    is_staff=False,
                    is_superuser=False,
                    id_user=row.id_user.strip(),
                    username=row.username.strip() if row.username else None,
                    first_name=row.first_name.strip() if row.first_name else None,
                    last_name=row.last_name.strip() if row.last_name else None,
                    needs_password_change=needs_pwd_change_val
                )
                db.add(new_user)
                await db.flush() # get new_user.id
                
                # Now associate with the academic period
                if resolved_ap_id:
                    new_rel = UserAcademicPeriod(
                        user_id=new_user.id,
                        academic_period_id=resolved_ap_id,
                        subject_code=row.subject_code.strip() if row.subject_code else None,
                        section=row.section.strip() if row.section else None,
                        is_active=True,
                        created_by_id=current_user.id,
                        creation_method=CreationMethod.BULK
                    )
                    db.add(new_rel)
                
                if not auto_activate:
                    payload_jwt = {
                        "sub": email_clean,
                        "exp": datetime.now(timezone.utc) + timedelta(hours=expire_hours),
                        "type": "invitation"
                    }
                    inv_token = jwt.encode(payload_jwt, SECRET_KEY, algorithm=ALGORITHM)
                    
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
            else:
                # Standard Bulk Import Flow
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
                
                # Associate standard user if period is provided
                if resolved_ap_id:
                    new_rel = UserAcademicPeriod(
                        user_id=new_user.id,
                        academic_period_id=resolved_ap_id,
                        subject_code=row.subject_code.strip() if row.subject_code else None,
                        section=row.section.strip() if row.section else None,
                        is_active=True,
                        created_by_id=current_user.id,
                        creation_method=CreationMethod.BULK
                    )
                    db.add(new_rel)
                
                if not auto_activate:
                    payload_jwt = {
                        "sub": email_clean,
                        "exp": datetime.now(timezone.utc) + timedelta(hours=expire_hours),
                        "type": "invitation"
                    }
                    inv_token = jwt.encode(payload_jwt, SECRET_KEY, algorithm=ALGORITHM)
                    
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
            
        # Automatic deactivation logic for teachers not in the import list for the processed periods
        for period_id in processed_periods:
            # 1. Get emails of all users from payload who were explicitly associated with this period
            imported_emails = {
                row.email.strip().lower()
                for row in payload.users
                if (row.academic_period_id == period_id or (row.academic_period and ap_map.get(row.academic_period.strip().lower()) == period_id))
            }
            
            # 2. Get all existing teachers (role = 'DOCENTE') in the database
            teacher_res = await db.execute(
                select(User.id, User.email)
                .where(User.role == UserRole.DOCENTE)
            )
            all_teachers = teacher_res.all()
            
            # 3. For teachers not in the imported list, insert or update UserAcademicPeriod with is_active = False
            for t_id, t_email in all_teachers:
                t_email_clean = t_email.strip().lower()
                if t_email_clean not in imported_emails:
                    # Check if relationship already exists
                    rel_res = await db.execute(
                        select(UserAcademicPeriod)
                        .where(
                            UserAcademicPeriod.user_id == t_id,
                            UserAcademicPeriod.academic_period_id == period_id
                        )
                    )
                    existing_rel = rel_res.scalars().first()
                    if existing_rel:
                        # Update existing relationship to is_active = False
                        existing_rel.is_active = False
                    else:
                        # Create new relationship with is_active = False
                        new_inactive_rel = UserAcademicPeriod(
                            user_id=t_id,
                            academic_period_id=period_id,
                            is_active=False,
                            created_by_id=current_user.id,
                            creation_method=CreationMethod.BULK
                        )
                        db.add(new_inactive_rel)
            
    await db.commit()
    
    await log_audit(
        db,
        user_id=current_user.id,
        action="BULK_USER_IMPORT_CONFIRMED",
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", "unknown"),
        details={"imported_users_count": imported_count, "auto_activate": auto_activate}
    )
    
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
