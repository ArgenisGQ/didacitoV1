from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any

from api.database import get_db
from api.models import Role, Permission, User
from api.core.dependencies import RequirePermission
from pydantic import BaseModel

router = APIRouter(prefix="/roles", tags=["Roles"])

class RoleCreate(BaseModel):
    name: str
    description: str = ""
    permission_ids: List[int] = []

class RoleUpdate(BaseModel):
    name: str
    description: str = ""
    permission_ids: List[int] = []


@router.get("", response_model=List[Dict[str, Any]])
async def get_roles(
    db: AsyncSession = Depends(get_db),
    _=Depends(RequirePermission("roles:manage"))
):
    result = await db.execute(select(Role).options(selectinload(Role.permissions)))
    roles = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "is_system": r.is_system,
            "is_active": r.is_active,
            "permissions": [{"id": p.id, "code": p.code, "name": p.name, "module": p.module_name} for p in r.permissions]
        }
        for r in roles
    ]


@router.post("", response_model=Dict[str, Any])
async def create_role(
    role_data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(RequirePermission("roles:manage"))
):
    # Check name unique
    result = await db.execute(select(Role).where(Role.name == role_data.name))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="El rol ya existe")

    new_role = Role(name=role_data.name, description=role_data.description, is_system=False)
    
    if role_data.permission_ids:
        perms_result = await db.execute(select(Permission).where(Permission.id.in_(role_data.permission_ids)))
        perms = perms_result.scalars().all()
        new_role.permissions.extend(perms)
        
    db.add(new_role)
    await db.commit()
    return {"message": "Rol creado exitosamente", "id": new_role.id}


@router.put("/{role_id}")
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(RequirePermission("roles:manage"))
):
    result = await db.execute(select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id))
    role = result.scalars().first()
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    role.name = role_data.name
    role.description = role_data.description
    
    # Update permissions
    perms_result = await db.execute(select(Permission).where(Permission.id.in_(role_data.permission_ids)))
    perms = perms_result.scalars().all()
    
    # Using set assignment is not straightforward in async SQLA without proper session management, but we can clear and extend
    role.permissions.clear()
    role.permissions.extend(perms)
    
    await db.commit()
    return {"message": "Rol actualizado"}


@router.delete("/{role_id}")
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(RequirePermission("roles:manage"))
):
    result = await db.execute(select(Role).options(selectinload(Role.users)).where(Role.id == role_id))
    role = result.scalars().first()
    
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
        
    if role.is_system:
        raise HTTPException(status_code=400, detail="No se puede eliminar un rol del sistema")
        
    if len(role.users) > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar un rol asignado a usuarios")
        
    await db.delete(role)
    await db.commit()
    return {"message": "Rol eliminado"}


@router.get("/permissions")
async def get_permissions(
    db: AsyncSession = Depends(get_db),
    _=Depends(RequirePermission("roles:manage"))
):
    result = await db.execute(select(Permission))
    perms = result.scalars().all()
    
    return [
        {"id": p.id, "code": p.code, "name": p.name, "module": p.module_name}
        for p in perms
    ]
