from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from api.database import get_db
from api.core.dependencies import get_current_user, check_role
from api.core.security import get_password_hash
from api.models import User, UserRole
from api.schemas import UserResponse, UserCreate, UserUpdate

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
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/profile-config")
async def get_profile_config():
    from api.core.settings_manager import SettingsManager
    editable_fields = SettingsManager.get_setting_as_list("EDITABLE_PROFILE_FIELDS", ["full_name"])
    support_email = SettingsManager.get_cached_setting("SUPPORT_EMAIL", "soporte@didactico.edu")
    audit_viewer_roles = SettingsManager.get_setting_as_list("AUDIT_LOG_VIEWER_ROLES", ["SUPER_ADMIN"])
    return {
        "editable_fields": editable_fields,
        "support_email": support_email,
        "audit_viewer_roles": audit_viewer_roles
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
    if "role" in payload and payload["role"]:
        current_user.role = str(payload["role"]).strip()
        
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


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



@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_role(current_user, [UserRole.SUPER_ADMIN])
    result = await db.execute(select(User))
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_role(current_user, [UserRole.SUPER_ADMIN])

    existing = await db.execute(select(User).where(User.email == user_in.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        role=user_in.role,
        password=get_password_hash(user_in.password),
        is_active=True,
        is_staff=False,
        is_superuser=False,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_role(current_user, [UserRole.SUPER_ADMIN])

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_in.email is not None:
        user.email = user_in.email
    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.password is not None:
        user.password = get_password_hash(user_in.password)
    if user_in.is_active is not None:
        if user_id == current_user.id and user_in.is_active is False:
            raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
        user.is_active = user_in.is_active

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_role(current_user, [UserRole.SUPER_ADMIN])

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
