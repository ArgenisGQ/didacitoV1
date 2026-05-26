from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from typing import List
import csv
import io

from api.database import get_db
from api.models import Faculty, Career, Department, User
from api.schemas import (
    FacultyCreate, FacultyUpdate, FacultyResponse,
    CareerCreate, CareerUpdate, CareerResponse,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse
)
from api.core.dependencies import get_current_user

router = APIRouter()

def is_super_admin(current_user: User):
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación exclusiva para Super Administradores",
        )

# --- FACULTIES ---

@router.get("/faculties", response_model=List[FacultyResponse])
async def list_faculties(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    result = await db.execute(select(Faculty))
    return result.scalars().all()

@router.post("/faculties", response_model=FacultyResponse)
async def create_faculty(faculty: FacultyCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    db_faculty = Faculty(**faculty.model_dump())
    try:
        db.add(db_faculty)
        await db.commit()
        await db.refresh(db_faculty)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una facultad con este código")
    return db_faculty

@router.put("/faculties/{id}", response_model=FacultyResponse)
async def update_faculty(id: int, faculty: FacultyUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    result = await db.execute(select(Faculty).filter(Faculty.id == id))
    db_faculty = result.scalars().first()
    if not db_faculty:
        raise HTTPException(status_code=404, detail="Facultad no encontrada")
        
    for key, value in faculty.model_dump(exclude_unset=True).items():
        setattr(db_faculty, key, value)
        
    try:
        await db.commit()
        await db.refresh(db_faculty)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad, posible código duplicado")
    return db_faculty

# --- CAREERS ---

@router.get("/careers", response_model=List[CareerResponse])
async def list_careers(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    # Using joinedload or simple scalars
    result = await db.execute(select(Career))
    careers = result.scalars().all()
    # To populate faculty_code, we need faculty loaded
    # Since relationships might be lazy in async, we should explicitly load or query
    # A quick fix is manually fetching faculties
    fac_result = await db.execute(select(Faculty))
    faculties = {f.id: f.code for f in fac_result.scalars().all()}
    
    for career in careers:
        career.faculty_code = faculties.get(career.faculty_id)
    return careers

@router.post("/careers", response_model=CareerResponse)
async def create_career(career: CareerCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    result = await db.execute(select(Faculty).filter(Faculty.id == career.faculty_id))
    db_faculty = result.scalars().first()
    if not db_faculty:
        raise HTTPException(status_code=404, detail="Facultad no encontrada")
        
    db_career = Career(**career.model_dump())
    try:
        db.add(db_career)
        await db.commit()
        await db.refresh(db_career)
        db_career.faculty_code = db_faculty.code
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una carrera con este código")
    return db_career

@router.put("/careers/{id}", response_model=CareerResponse)
async def update_career(id: int, career: CareerUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    result = await db.execute(select(Career).filter(Career.id == id))
    db_career = result.scalars().first()
    if not db_career:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
        
    if career.faculty_id is not None:
        fac_res = await db.execute(select(Faculty).filter(Faculty.id == career.faculty_id))
        if not fac_res.scalars().first():
            raise HTTPException(status_code=404, detail="Facultad padre no encontrada")
            
    for key, value in career.model_dump(exclude_unset=True).items():
        setattr(db_career, key, value)
        
    try:
        await db.commit()
        await db.refresh(db_career)
        
        # Populate faculty_code for response
        fac_res = await db.execute(select(Faculty).filter(Faculty.id == db_career.faculty_id))
        fac = fac_res.scalars().first()
        if fac:
            db_career.faculty_code = fac.code
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad, posible código duplicado")
    return db_career

# --- DEPARTMENTS ---

@router.get("/departments", response_model=List[DepartmentResponse])
async def list_departments(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    result = await db.execute(select(Department))
    departments = result.scalars().all()
    
    fac_result = await db.execute(select(Faculty))
    faculties = {f.id: f.code for f in fac_result.scalars().all()}
    
    for dep in departments:
        dep.faculty_code = faculties.get(dep.faculty_id)
    return departments

@router.post("/departments", response_model=DepartmentResponse)
async def create_department(dep: DepartmentCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    result = await db.execute(select(Faculty).filter(Faculty.id == dep.faculty_id))
    db_faculty = result.scalars().first()
    if not db_faculty:
        raise HTTPException(status_code=404, detail="Facultad no encontrada")
        
    db_dep = Department(**dep.model_dump())
    try:
        db.add(db_dep)
        await db.commit()
        await db.refresh(db_dep)
        db_dep.faculty_code = db_faculty.code
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe un departamento con este código")
    return db_dep

@router.put("/departments/{id}", response_model=DepartmentResponse)
async def update_department(id: int, dep: DepartmentUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    result = await db.execute(select(Department).filter(Department.id == id))
    db_dep = result.scalars().first()
    if not db_dep:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")
        
    if dep.faculty_id is not None:
        fac_res = await db.execute(select(Faculty).filter(Faculty.id == dep.faculty_id))
        if not fac_res.scalars().first():
            raise HTTPException(status_code=404, detail="Facultad padre no encontrada")
            
    for key, value in dep.model_dump(exclude_unset=True).items():
        setattr(db_dep, key, value)
        
    try:
        await db.commit()
        await db.refresh(db_dep)
        
        fac_res = await db.execute(select(Faculty).filter(Faculty.id == db_dep.faculty_id))
        fac = fac_res.scalars().first()
        if fac:
            db_dep.faculty_code = fac.code
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad, posible código duplicado")
    return db_dep

@router.delete("/departments/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    result = await db.execute(select(Department).filter(Department.id == id))
    db_dep = result.scalars().first()
    if not db_dep:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")
        
    try:
        await db.delete(db_dep)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo eliminar el departamento. Puede que esté en uso.")
    return None

# --- BULK IMPORT ---

@router.post("/bulk-import")
async def bulk_import_structure(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_super_admin(current_user)
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser un CSV")
        
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("iso-8859-1")
        
    reader = csv.DictReader(io.StringIO(text))
    expected_fields = ["tipo", "codigo", "nombre", "codigo_facultad_padre", "codigos_cursos"]
    
    if not reader.fieldnames or not all(field in [f.strip().lower() for f in reader.fieldnames] for field in ["tipo", "codigo", "nombre", "codigo_facultad_padre"]):
        raise HTTPException(status_code=400, detail="Las cabeceras del CSV no son correctas. Se requiere al menos: tipo, codigo, nombre, codigo_facultad_padre")
    
    faculties_created = 0
    careers_created = 0
    deps_created = 0
    
    # We will fetch all faculties into memory to avoid awaiting inside a loop optimally, 
    # but for simplicity we can just query inside if needed. Let's prefetch.
    fac_res = await db.execute(select(Faculty))
    fac_cache = {f.code: f for f in fac_res.scalars().all()}
    
    for idx, row in enumerate(reader, start=2):
        row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        
        tipo = row.get("tipo", "").lower()
        codigo = row.get("codigo", "")
        nombre = row.get("nombre", "")
        padre_codigo = row.get("codigo_facultad_padre", "")
        codigos_cursos = row.get("codigos_cursos", "")
        
        if not tipo or not codigo or not nombre:
            continue
            
        if tipo == "facultad":
            if codigo not in fac_cache:
                new_fac = Faculty(name=nombre, code=codigo, is_active=True)
                db.add(new_fac)
                await db.flush() # get ID
                fac_cache[codigo] = new_fac
                faculties_created += 1
                
        elif tipo == "carrera":
            if not padre_codigo:
                raise HTTPException(status_code=400, detail=f"Fila {idx}: Carrera sin codigo_facultad_padre")
            fac = fac_cache.get(padre_codigo)
            if not fac:
                raise HTTPException(status_code=400, detail=f"Fila {idx}: Facultad padre '{padre_codigo}' no encontrada en la BD")
            
            # Check existing career
            car_res = await db.execute(select(Career).filter(Career.code == codigo))
            car = car_res.scalars().first()
            if not car:
                db.add(Career(name=nombre, code=codigo, faculty_id=fac.id, is_active=True))
                careers_created += 1
                
        elif tipo == "departamento":
            if not padre_codigo:
                raise HTTPException(status_code=400, detail=f"Fila {idx}: Departamento sin codigo_facultad_padre")
            fac = fac_cache.get(padre_codigo)
            if not fac:
                raise HTTPException(status_code=400, detail=f"Fila {idx}: Facultad padre '{padre_codigo}' no encontrada en la BD")
                
            dep_res = await db.execute(select(Department).filter(Department.code == codigo))
            dep = dep_res.scalars().first()
            if not dep:
                db.add(Department(name=nombre, code=codigo, faculty_id=fac.id, subject_codes=codigos_cursos, is_active=True))
                deps_created += 1
            else:
                # Actualizar si ya existe
                dep.subject_codes = codigos_cursos
                
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error insertando datos: {str(e)}")
        
    return {
        "message": "Importación completada con éxito",
        "faculties_created": faculties_created,
        "careers_created": careers_created,
        "departments_created": deps_created
    }
