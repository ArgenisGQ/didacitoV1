from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from api.database import get_db
from api.core.dependencies import get_current_user, RequirePermission
from api.core.security import get_password_hash
from api.models import User, UserRole, AcademicPeriod, UserAcademicPeriod, CreationMethod, Role, Department
from api.schemas import UserResponse, UserCreate, UserUpdate
from sqlalchemy.orm import selectinload

from pydantic import BaseModel
from typing import Optional
import zxcvbn
from sqlalchemy import update
from api.models import RefreshToken

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).options(selectinload(User.roles), selectinload(User.departments)).where(User.id == current_user.id))
    user = res.scalars().first()
    
    user_dict = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    user_dict["role"] = user.role
    user_dict["roles"] = [r.name for r in user.roles]
    return user_dict


@router.get("/me/profile-config")
async def get_profile_config():
    from api.core.settings_manager import SettingsManager
    editable_fields = SettingsManager.get_setting_as_list("EDITABLE_PROFILE_FIELDS", ["full_name"])
    support_email = SettingsManager.get_cached_setting("SUPPORT_EMAIL", "soporte@didactico.edu")
    audit_viewer_roles = SettingsManager.get_setting_as_list("AUDIT_LOG_VIEWER_ROLES", ["SUPER_ADMIN"])
    system_timezone = SettingsManager.get_cached_setting("SYSTEM_TIMEZONE", "America/Caracas")
    return {
        "editable_fields": editable_fields,
        "support_email": support_email,
        "audit_viewer_roles": audit_viewer_roles,
        "system_timezone": system_timezone
    }


@router.get("/me/academic-load")
async def get_my_academic_load(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Buscar periodo académico activo
    period_res = await db.execute(
        select(AcademicPeriod).where(AcademicPeriod.is_active == True)
    )
    active_period = period_res.scalar_one_or_none()
    
    if not active_period:
        return {
            "active_period": None,
            "section": None,
            "subjects": []
        }
        
    # 2. Buscar asignación del docente para este periodo activo
    assignment_res = await db.execute(
        select(UserAcademicPeriod)
        .where(
            UserAcademicPeriod.user_id == current_user.id,
            UserAcademicPeriod.academic_period_id == active_period.id,
            UserAcademicPeriod.is_active == True
        )
    )
    assignment = assignment_res.scalar_one_or_none()
    
    if not assignment or not assignment.subject_code:
        return {
            "active_period": {
                "id": active_period.id,
                "name": active_period.name,
                "start_date": active_period.start_date.isoformat(),
                "end_date": active_period.end_date.isoformat(),
                "type": active_period.type
            },
            "section": assignment.section if assignment else None,
            "subjects": []
        }
        
    # 3. Parsear códigos separados por coma
    codes = [c.strip() for c in assignment.subject_code.split(",") if c.strip()]
    
    # 4. Obtener detalles de la tabla Subject
    from api.models import Subject
    subjects_res = await db.execute(
        select(Subject).where(Subject.code.in_(codes))
    )
    subjects_dict = {s.code: s for s in subjects_res.scalars().all()}
    
    # 5. Mapear respuesta
    subjects_list = []
    for code in codes:
        if code in subjects_dict:
            s = subjects_dict[code]
            subjects_list.append({
                "id": s.id,
                "code": s.code,
                "name": s.name,
                "program": s.program,
                "level": s.level,
                "academic_credits": s.academic_credits,
                "has_syllabus": True
            })
        else:
            subjects_list.append({
                "id": None,
                "code": code,
                "name": "Asignatura Asignada (Syllabus pendiente de carga)",
                "program": "Pendiente",
                "level": "N/A",
                "academic_credits": 0,
                "has_syllabus": False
            })
        
    return {
        "active_period": {
            "id": active_period.id,
            "name": active_period.name,
            "start_date": active_period.start_date.isoformat(),
            "end_date": active_period.end_date.isoformat(),
            "type": active_period.type
        },
        "section": assignment.section,
        "subjects": subjects_list
    }


@router.patch("/me", response_model=UserResponse)
async def update_my_profile(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from api.core.settings_manager import SettingsManager
    editable_fields = SettingsManager.get_setting_as_list("EDITABLE_PROFILE_FIELDS", ["full_name"])
    support_email = SettingsManager.get_cached_setting("SUPPORT_EMAIL", "soporte@didactico.edu")
    
    # Non-superadmins are restricted to only editing fields in EDITABLE_PROFILE_FIELDS
    if current_user.role != UserRole.SUPER_ADMIN:
        for key in payload.keys():
            if key not in editable_fields:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"El campo '{key}' esta protegido por la administracion. Solicite cambios a {support_email}"
                )
                
    # Apply updates
    if "full_name" in payload and payload["full_name"]:
        current_user.full_name = str(payload["full_name"]).strip()
    if "email" in payload and payload["email"]:
        current_user.email = str(payload["email"]).strip().lower()
        
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    res = await db.execute(select(User).options(selectinload(User.roles), selectinload(User.departments)).where(User.id == current_user.id))
    user_refreshed = res.scalars().first()
    
    user_dict = {c.name: getattr(user_refreshed, c.name) for c in user_refreshed.__table__.columns}
    user_dict["role"] = user_refreshed.role
    user_dict["roles"] = [r.name for r in user_refreshed.roles]
    return user_dict


@router.post("/me/change-password")
async def change_my_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from api.core.settings_manager import SettingsManager
    from api.core.security import verify_password
    
    # 1. Check current password
    if not verify_password(payload.old_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contrasena actual es incorrecta"
        )
        
    # 2. Check password strength
    strength = zxcvbn.zxcvbn(payload.new_password)
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
        
    # 3. Hash and save new password
    current_user.password = get_password_hash(payload.new_password)
    db.add(current_user)
    
    # 4. Revoke all refresh tokens for this user
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == current_user.id)
        .values(is_revoked=True)
    )
    
    await db.commit()
    return {"success": True, "detail": "Contrasena actualizada con exito. Todas las sesiones activas han sido cerradas"}



from sqlalchemy.orm import selectinload, joinedload

from sqlalchemy import or_

@router.get("", response_model=List[UserResponse])
async def list_users(
    period_id: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(RequirePermission("users:read")),
):
    
    users_response = []
    if period_id is not None and period_id > 0:
        # Filter by a specific academic period
        query = (
            select(UserAcademicPeriod)
            .options(
                joinedload(UserAcademicPeriod.user).selectinload(User.roles),
                joinedload(UserAcademicPeriod.user).selectinload(User.departments),
                joinedload(UserAcademicPeriod.academic_period),
                joinedload(UserAcademicPeriod.creator)
            )
            .join(UserAcademicPeriod.user)
            .where(UserAcademicPeriod.academic_period_id == period_id)
        )
        if search:
            query = query.where(or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.id_user.ilike(f"%{search}%"),
                User.username.ilike(f"%{search}%")
            ))
        query = query.limit(500)
        res = await db.execute(query)
        assignments = res.scalars().all()
        
        for ass in assignments:
            u = ass.user
            if u:
                users_response.append(
                    UserResponse(
                        id=u.id,
                        email=u.email,
                        full_name=u.full_name,
                        role=u.role,
                        roles=[r.name for r in u.roles] if hasattr(u, "roles") else [],
                        is_active=ass.is_active,
                        is_staff=u.is_staff,
                        is_superuser=u.is_superuser,
                        mfa_enabled=u.mfa_enabled,
                        last_login=u.last_login,
                        date_joined=u.date_joined,
                        id_user=u.id_user,
                        username=u.username,
                        first_name=u.first_name,
                        last_name=u.last_name,
                        needs_password_change=u.needs_password_change,
                        department_ids=[d.id for d in u.departments] if hasattr(u, "departments") else [],
                        # Pivot relation details
                        subject_code=ass.subject_code,
                        section=ass.section,
                        academic_period=ass.academic_period.name,
                        academic_period_id=ass.academic_period_id,
                        period_is_active=ass.is_active,
                        period_created_at=ass.created_at,
                        period_created_by_email=ass.creator.email if ass.creator else None,
                        period_creation_method=ass.creation_method
                    )
                )
    elif period_id == 0:
        # Filter for users with "No Academic Period" (Sin Periodo Académico)
        # Find users who have NO associations in UserAcademicPeriod
        query = (
            select(User)
            .options(selectinload(User.roles), selectinload(User.departments))
            .outerjoin(UserAcademicPeriod, User.id == UserAcademicPeriod.user_id)
            .where(UserAcademicPeriod.id == None)
        )
        if search:
            query = query.where(or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.id_user.ilike(f"%{search}%"),
                User.username.ilike(f"%{search}%")
            ))
        query = query.limit(500)
        res = await db.execute(query)
        users = res.scalars().all()
        
        for u in users:
            users_response.append(
                UserResponse(
                    id=u.id,
                    email=u.email,
                    full_name=u.full_name,
                    role=u.role,
                    roles=[r.name for r in u.roles] if hasattr(u, "roles") else [],
                    is_active=u.is_active,
                    is_staff=u.is_staff,
                    is_superuser=u.is_superuser,
                    mfa_enabled=u.mfa_enabled,
                    last_login=u.last_login,
                    date_joined=u.date_joined,
                    id_user=u.id_user,
                    username=u.username,
                    first_name=u.first_name,
                    last_name=u.last_name,
                    needs_password_change=u.needs_password_change,
                    department_ids=[d.id for d in u.departments] if hasattr(u, "departments") else []
                )
            )
    else:
        # Return all users, and if they have any period associations, attach the first one
        query = (
            select(User)
            .options(
                selectinload(User.roles),
                selectinload(User.departments),
                selectinload(User.academic_period_assignments).joinedload(UserAcademicPeriod.academic_period),
                selectinload(User.academic_period_assignments).joinedload(UserAcademicPeriod.creator)
            )
        )
        if search:
            query = query.where(or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.id_user.ilike(f"%{search}%"),
                User.username.ilike(f"%{search}%")
            ))
        query = query.limit(500)
        res = await db.execute(query)
        users = res.scalars().all()
        
        for u in users:
            ass = u.academic_period_assignments[0] if u.academic_period_assignments else None
            users_response.append(
                UserResponse(
                    id=u.id,
                    email=u.email,
                    full_name=u.full_name,
                    role=u.role,
                    roles=[r.name for r in u.roles] if hasattr(u, "roles") else [],
                    is_active=u.is_active,
                    is_staff=u.is_staff,
                    is_superuser=u.is_superuser,
                    mfa_enabled=u.mfa_enabled,
                    last_login=u.last_login,
                    date_joined=u.date_joined,
                    id_user=u.id_user,
                    username=u.username,
                    first_name=u.first_name,
                    last_name=u.last_name,
                    needs_password_change=u.needs_password_change,
                    department_ids=[d.id for d in u.departments] if hasattr(u, "departments") else [],
                    # Pivot relation details (if any)
                    subject_code=ass.subject_code if ass else None,
                    section=ass.section if ass else None,
                    academic_period=ass.academic_period.name if ass else None,
                    academic_period_id=ass.academic_period_id if ass else None,
                    period_is_active=ass.is_active if ass else None,
                    period_created_at=ass.created_at if ass else None,
                    period_created_by_email=ass.creator.email if ass and ass.creator else None,
                    period_creation_method=ass.creation_method if ass else None
                )
            )
            
    return users_response


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(RequirePermission("users:create"))
):

    existing = await db.execute(select(User).where(User.email == user_in.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="El correo ya se encuentra registrado")

    primary_role = user_in.role if user_in.role else (user_in.roles[0] if user_in.roles else UserRole.DOCENTE)

    new_user = User(
        email=user_in.email.strip().lower(),
        full_name=user_in.full_name.strip(),
        role=primary_role,
        password=get_password_hash(user_in.password),
        is_active=True,
        is_staff=False,
        is_superuser=False,
    )
    
    if user_in.department_ids:
        dept_res = await db.execute(select(Department).where(Department.id.in_(user_in.department_ids)))
        new_user.departments.extend(dept_res.scalars().all())
    
    if user_in.roles:
        roles_res = await db.execute(select(Role).where(Role.name.in_(user_in.roles)))
        roles_db = roles_res.scalars().all()
        new_user.roles.extend(roles_db)

    db.add(new_user)
    await db.flush() # get new_user.id

    created_rel = None
    ap_name = None
    if user_in.academic_period_id:
        ap_res = await db.execute(select(AcademicPeriod).where(AcademicPeriod.id == user_in.academic_period_id))
        ap = ap_res.scalar_one_or_none()
        if not ap:
            raise HTTPException(status_code=404, detail="Periodo academico no encontrado")
        ap_name = ap.name
        
        created_rel = UserAcademicPeriod(
            user_id=new_user.id,
            academic_period_id=user_in.academic_period_id,
            is_active=True,
            created_by_id=current_user.id,
            creation_method=CreationMethod.MANUAL
        )
        db.add(created_rel)
        await db.flush()

    await db.commit()
    
    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        roles=[r.name for r in new_user.roles],
        is_active=new_user.is_active,
        is_staff=new_user.is_staff,
        is_superuser=new_user.is_superuser,
        mfa_enabled=new_user.mfa_enabled,
        last_login=new_user.last_login,
        date_joined=new_user.date_joined,
        id_user=new_user.id_user,
        username=new_user.username,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        needs_password_change=new_user.needs_password_change,
        department_ids=[d.id for d in new_user.departments] if hasattr(new_user, "departments") else [],
        # Pivot fields
        academic_period=ap_name,
        academic_period_id=user_in.academic_period_id if created_rel else None,
        period_is_active=created_rel.is_active if created_rel else None,
        period_created_at=created_rel.created_at if created_rel else None,
        period_created_by_email=current_user.email if created_rel else None,
        period_creation_method=created_rel.creation_method if created_rel else None
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(RequirePermission("users:update"))
):

    result = await db.execute(select(User).options(selectinload(User.roles), selectinload(User.departments)).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user_in.email is not None:
        user.email = user_in.email.strip().lower()
    if user_in.full_name is not None:
        user.full_name = user_in.full_name.strip()
    if user_in.roles is not None:
        if user_in.roles:
            user.role = user_in.roles[0] # primary role sync
            roles_res = await db.execute(select(Role).where(Role.name.in_(user_in.roles)))
            roles_db = roles_res.scalars().all()
            user.roles.clear()
            user.roles.extend(roles_db)
        else:
            user.role = None
            user.roles.clear()
    elif user_in.role is not None:
        user.role = user_in.role
        
    if user_in.password is not None and user_in.password.strip() != "":
        user.password = get_password_hash(user_in.password)
    if user_in.is_active is not None:
        if user_id == current_user.id and user_in.is_active is False:
            raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
        user.is_active = user_in.is_active
        
    update_data = user_in.model_dump(exclude_unset=True)
    if "department_ids" in update_data:
        val = update_data["department_ids"]
        user.departments.clear()
        if val and isinstance(val, list):
            dept_res = await db.execute(select(Department).where(Department.id.in_(val)))
            user.departments.extend(dept_res.scalars().all())

    ap_name = None
    period_rel = None
    
    # Check if period was updated
    if "academic_period_id" in update_data:
        val_ap = update_data["academic_period_id"]
        if val_ap is not None and val_ap > 0:
            ap_res = await db.execute(select(AcademicPeriod).where(AcademicPeriod.id == val_ap))
            ap = ap_res.scalar_one_or_none()
            if not ap:
                raise HTTPException(status_code=404, detail="Periodo academico no encontrado")
            ap_name = ap.name
            
            # Check if relationship already exists
            rel_res = await db.execute(
                select(UserAcademicPeriod)
                .where(
                    UserAcademicPeriod.user_id == user.id,
                    UserAcademicPeriod.academic_period_id == val_ap
                )
            )
            period_rel = rel_res.scalars().first()
            if not period_rel:
                # Create relation
                period_rel = UserAcademicPeriod(
                    user_id=user.id,
                    academic_period_id=val_ap,
                    is_active=True,
                    created_by_id=current_user.id,
                    creation_method=CreationMethod.MANUAL
                )
                db.add(period_rel)
            else:
                # Mark as active if already exists
                period_rel.is_active = True
                
        else:
            # academic_period_id is 0 or null (unassigned) -> delete all relationships for this user
            from sqlalchemy import delete
            await db.execute(delete(UserAcademicPeriod).where(UserAcademicPeriod.user_id == user.id))
    else:
        # Period not specified in update. Get the first existing relationship if any.
        rel_res = await db.execute(
            select(UserAcademicPeriod)
            .options(joinedload(UserAcademicPeriod.academic_period), joinedload(UserAcademicPeriod.creator))
            .where(UserAcademicPeriod.user_id == user.id)
        )
        period_rel = rel_res.scalars().first()
        if period_rel:
            ap_name = period_rel.academic_period.name

    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # If relationship was created/updated, refresh it or load creator
    creator_email = None
    if period_rel:
        if not getattr(period_rel, 'creator', None):
            c_res = await db.execute(select(User).where(User.id == period_rel.created_by_id))
            creator = c_res.scalar_one_or_none()
            creator_email = creator.email if creator else None
        else:
            creator_email = period_rel.creator.email if period_rel.creator else None
            
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        roles=[r.name for r in user.roles],
        is_active=user.is_active,
        is_staff=user.is_staff,
        is_superuser=user.is_superuser,
        mfa_enabled=user.mfa_enabled,
        last_login=user.last_login,
        date_joined=user.date_joined,
        id_user=user.id_user,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        needs_password_change=user.needs_password_change,
        department_ids=[d.id for d in user.departments] if hasattr(user, "departments") else [],
        # Pivot fields
        academic_period=ap_name,
        academic_period_id=user_in.academic_period_id if user_in.academic_period_id and user_in.academic_period_id > 0 else (period_rel.academic_period_id if period_rel else None),
        period_is_active=period_rel.is_active if period_rel else None,
        period_created_at=period_rel.created_at if period_rel else None,
        period_created_by_email=creator_email,
        period_creation_method=period_rel.creation_method if period_rel else None
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(RequirePermission("users:delete"))
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role != UserRole.DOCENTE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo los docentes pueden ser eliminados permanentemente del sistema"
        )

    await db.delete(user)
    await db.commit()
    return {"message": "Docente eliminado permanentemente de la base de datos"}
