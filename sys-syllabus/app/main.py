import os
import shutil
import tempfile
import zipfile
from datetime import date, datetime
from typing import List, Optional
import io

import pandas as pd
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select, update, and_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, engine
from app.models import Subject, SubjectUnit, SubjectCorrespondence, SyllabusVersion, User
from app.parser import parse_syllabus_pdf, calculate_sha256

app = FastAPI(
    title="DIDACTICO SYLLABUS API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Physical PDF storage folder inside the shared volume
STORAGE_DIR = "/app/syllabus_pdfs"
os.makedirs(STORAGE_DIR, exist_ok=True)


# Dependency to resolve current user from proxy headers
def get_proxy_user_id(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
) -> Optional[int]:
    if x_user_id:
        try:
            return int(x_user_id)
        except ValueError:
            pass
    return None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "syllabus-service"}


@app.post("/upload/pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: Optional[int] = Depends(get_proxy_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a single PDF syllabus.
    - Validates PyMuPDF text & structure.
    - Performs SHA-256 duplicate validation.
    - Performs automatic version control.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se admiten archivos PDF."
        )

    # Read bytes and calculate SHA-256
    pdf_bytes = await file.read()
    file_hash = calculate_sha256(pdf_bytes)

    # Check if this exact file hash already exists in DB
    existing_hash_res = await db.execute(
        select(SyllabusVersion).where(SyllabusVersion.file_hash == file_hash)
    )
    existing_version = existing_hash_res.scalars().first()
    if existing_version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo PDF subido es idéntico a una versión existente del sistema."
        )

    # Parse document details
    try:
        parsed = parse_syllabus_pdf(pdf_bytes, file.filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo procesar el PDF. Asegúrese de que no esté protegido o corrupto. Error: {str(e)}"
        )

    code = parsed["code"]
    name = parsed["name"]

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo extraer el Código de la materia del PDF ni del nombre del archivo."
        )

    # Execute DB operations in atomic block
    try:
        # Check if subject already exists
        subject_res = await db.execute(
            select(Subject).where(Subject.code == code)
        )
        subject = subject_res.scalars().first()

        version_num = 1
        if subject:
            # Subject exists, check if there's an active version
            active_ver_res = await db.execute(
                select(SyllabusVersion)
                .where(and_(SyllabusVersion.subject_id == subject.id, SyllabusVersion.is_active == True))
            )
            active_ver = active_ver_res.scalars().first()
            
            if active_ver:
                # Mark previous active version as inactive
                active_ver.is_active = False
                db.add(active_ver)
                
            # Get max version number
            max_ver_res = await db.execute(
                select(func.max(SyllabusVersion.version_number))
                .where(SyllabusVersion.subject_id == subject.id)
            )
            max_v = max_ver_res.scalar()
            if max_v is not None:
                version_num = max_v + 1
        else:
            # Create Subject
            subject = Subject(
                code=code,
                name=name,
                document_code=parsed["document_code"],
                program=parsed["program"],
                level=parsed["level"],
                identification_date=parsed["identification_date"],
                syllabus_version_year=parsed["syllabus_version_year"],
                academic_credits=parsed["academic_credits"],
                had_hours=parsed["had_hours"],
                hde_hours=parsed["hde_hours"],
                hts_hours=parsed["hts_hours"],
                academic_period=parsed["academic_period"],
                prerequisite=parsed["prerequisite"],
                presentation=parsed["presentation"],
                purpose=parsed["purpose"],
                previous_competencies=parsed["previous_competencies"],
                generic_competencies=parsed["generic_competencies"],
                relation_other_subjects=parsed["relation_other_subjects"],
                teaching_strategies=parsed["teaching_strategies"],
                eval_diagnostica=parsed["eval_diagnostica"],
                eval_formativa=parsed["eval_formativa"],
                eval_sumativa=parsed["eval_sumativa"],
                bibliographic_references=parsed["bibliographic_references"]
            )
            db.add(subject)
            await db.flush() # get subject.id

        # Clear existing units and correspondences to write fresh ones
        if version_num > 1:
            await db.execute(
                delete(SubjectUnit).where(SubjectUnit.subject_id == subject.id)
            )
            await db.execute(
                delete(SubjectCorrespondence).where(SubjectCorrespondence.subject_id == subject.id)
            )

        # Write learning units
        for u in parsed["units"]:
            unit = SubjectUnit(
                subject_id=subject.id,
                unit_number=u["unit_number"],
                unit_title=u["unit_title"],
                contents=u["contents"],
                performance_criteria=u["performance_criteria"]
            )
            db.add(unit)

        # Write correspondences
        for c in parsed["correspondences"]:
            corr = SubjectCorrespondence(
                subject_id=subject.id,
                code=c["code"],
                name=c["name"],
                requirements=c["requirements"]
            )
            db.add(corr)

        # Physical file saving
        final_filename = f"{code}_v{version_num}.pdf"
        file_path = os.path.join(STORAGE_DIR, final_filename)
        with open(file_path, "wb") as f:
            f.write(pdf_bytes)

        # Create Syllabus Version
        syllabus_version = SyllabusVersion(
            subject_id=subject.id,
            version_number=version_num,
            filename=file.filename,
            file_path=file_path,
            file_hash=file_hash,
            uploaded_by_id=user_id,
            extracted_text=parsed["extracted_text"],
            is_active=True
        )
        db.add(syllabus_version)
        await db.commit()

        return {
            "success": True,
            "subject": {
                "id": subject.id,
                "code": subject.code,
                "name": subject.name,
                "program": subject.program,
                "version": version_num
            }
        }
    except Exception as e:
        await db.rollback()
        # Clean up disk file if created in this transaction
        try:
            final_filename = f"{code}_v{version_num}.pdf"
            file_path = os.path.join(STORAGE_DIR, final_filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al guardar los datos del syllabus: {str(e)}"
        )


@app.post("/upload/zip")
async def upload_zip(
    file: UploadFile = File(...),
    user_id: Optional[int] = Depends(get_proxy_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Decompress a ZIP archive containing multiple syllabus PDFs.
    - Extracts all files.
    - Validates duplicates via SHA-256 (deletes and ignores duplicates).
    - Processes and imports valid syllabus files.
    - Deletes all temporary unzipped files immediately.
    """
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se admiten archivos ZIP."
        )

    # Save zip to a temp file
    temp_zip_fd, temp_zip_path = tempfile.mkstemp(suffix=".zip")
    try:
        with os.fdopen(temp_zip_fd, 'wb') as tmp:
            shutil.copyfileobj(file.file, tmp)
            
        # Decompress in temporary directory
        unzip_dir = tempfile.mkdtemp(prefix="unzip_didactico_")
        try:
            with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
                zip_ref.extractall(unzip_dir)
                
            total_processed = 0
            inserted = 0
            updated = 0
            ignored_duplicates = 0
            errors = []

            # Traverse directory looking for PDFs
            for root, _, files in os.walk(unzip_dir):
                for f_name in files:
                    if not f_name.lower().endswith(".pdf") or f_name.startswith("._"):
                        continue
                        
                    total_processed += 1
                    pdf_path = os.path.join(root, f_name)
                    
                    try:
                        with open(pdf_path, 'rb') as pdf_file:
                            pdf_bytes = pdf_file.read()
                            
                        # Calculate SHA-256
                        file_hash = calculate_sha256(pdf_bytes)
                        
                        # Validate Duplicate Hash in Database
                        hash_res = await db.execute(
                            select(SyllabusVersion).where(SyllabusVersion.file_hash == file_hash)
                        )
                        existing_hash = hash_res.scalars().first()
                        if existing_hash:
                            ignored_duplicates += 1
                            continue # Skip processing entirely

                        # Parse PDF
                        parsed = parse_syllabus_pdf(pdf_bytes, f_name)
                        code = parsed["code"]
                        name = parsed["name"]
                        
                        if not code:
                            errors.append(f"{f_name}: No se encontró código de materia.")
                            continue

                        # Check Subject
                        sub_res = await db.execute(select(Subject).where(Subject.code == code))
                        subject = sub_res.scalars().first()
                        
                        version_num = 1
                        is_update = False
                        
                        if subject:
                            is_update = True
                            # Subject exists, check active version
                            active_ver_res = await db.execute(
                                select(SyllabusVersion)
                                .where(and_(SyllabusVersion.subject_id == subject.id, SyllabusVersion.is_active == True))
                            )
                            active_ver = active_ver_res.scalars().first()
                            if active_ver:
                                active_ver.is_active = False
                                db.add(active_ver)
                                
                            max_ver_res = await db.execute(
                                select(func.max(SyllabusVersion.version_number))
                                .where(SyllabusVersion.subject_id == subject.id)
                            )
                            max_v = max_ver_res.scalar()
                            if max_v is not None:
                                version_num = max_v + 1
                        else:
                            # Create Subject
                            subject = Subject(
                                code=code,
                                name=name,
                                document_code=parsed["document_code"],
                                program=parsed["program"],
                                level=parsed["level"],
                                identification_date=parsed["identification_date"],
                                syllabus_version_year=parsed["syllabus_version_year"],
                                academic_credits=parsed["academic_credits"],
                                had_hours=parsed["had_hours"],
                                hde_hours=parsed["hde_hours"],
                                hts_hours=parsed["hts_hours"],
                                academic_period=parsed["academic_period"],
                                prerequisite=parsed["prerequisite"],
                                presentation=parsed["presentation"],
                                purpose=parsed["purpose"],
                                previous_competencies=parsed["previous_competencies"],
                                generic_competencies=parsed["generic_competencies"],
                                relation_other_subjects=parsed["relation_other_subjects"],
                                teaching_strategies=parsed["teaching_strategies"],
                                eval_diagnostica=parsed["eval_diagnostica"],
                                eval_formativa=parsed["eval_formativa"],
                                eval_sumativa=parsed["eval_sumativa"],
                                bibliographic_references=parsed["bibliographic_references"]
                            )
                            db.add(subject)
                            await db.flush()

                        # Clear old units and correspondences if updating
                        if is_update:
                            await db.execute(delete(SubjectUnit).where(SubjectUnit.subject_id == subject.id))
                            await db.execute(delete(SubjectCorrespondence).where(SubjectCorrespondence.subject_id == subject.id))

                        # Save Units
                        for u in parsed["units"]:
                            unit = SubjectUnit(
                                subject_id=subject.id,
                                unit_number=u["unit_number"],
                                unit_title=u["unit_title"],
                                contents=u["contents"],
                                performance_criteria=u["performance_criteria"]
                            )
                            db.add(unit)

                        # Save Correspondences
                        for c in parsed["correspondences"]:
                            corr = SubjectCorrespondence(
                                subject_id=subject.id,
                                code=c["code"],
                                name=c["name"],
                                requirements=c["requirements"]
                            )
                            db.add(corr)

                        # Physical save PDF
                        final_filename = f"{code}_v{version_num}.pdf"
                        file_path = os.path.join(STORAGE_DIR, final_filename)
                        with open(file_path, "wb") as pf:
                            pf.write(pdf_bytes)

                        # Save Version
                        version = SyllabusVersion(
                            subject_id=subject.id,
                            version_number=version_num,
                            filename=f_name,
                            file_path=file_path,
                            file_hash=file_hash,
                            uploaded_by_id=user_id,
                            extracted_text=parsed["extracted_text"],
                            is_active=True
                        )
                        db.add(version)
                        
                        if is_update:
                            updated += 1
                        else:
                            inserted += 1
                            
                    except Exception as ex:
                        import traceback
                        traceback.print_exc()
                        errors.append(f"{f_name}: Error al importar. {str(ex)}")

            await db.commit()
            return {
                "success": True,
                "total": total_processed,
                "inserted": inserted,
                "updated": updated,
                "ignored_duplicates": ignored_duplicates,
                "errors": errors
            }
        finally:
            # Clean up the unzipped files immediately
            shutil.rmtree(unzip_dir, ignore_errors=True)
    finally:
        # Clean up the temp zip file
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)


@app.get("/subjects", response_model=List[dict])
async def list_subjects(db: AsyncSession = Depends(get_db)):
    """List all subjects with active versions and classifications."""
    query = select(Subject).order_by(Subject.code)
    res = await db.execute(query)
    subjects = res.scalars().all()
    
    response = []
    for s in subjects:
        # Get active version
        active_ver = next((v for v in s.syllabuses if v.is_active), None)
        
        response.append({
            "id": s.id,
            "code": s.code,
            "name": s.name,
            "program": s.program,
            "level": s.level,
            "academic_credits": s.academic_credits,
            "had_hours": s.had_hours,
            "hde_hours": s.hde_hours,
            "hts_hours": s.hts_hours,
            "academic_period": s.academic_period,
            "prerequisite": s.prerequisite,
            "document_code": s.document_code,
            "identification_date": s.identification_date.isoformat() if s.identification_date else None,
            "syllabus_version_year": s.syllabus_version_year,
            "active_version": active_ver.version_number if active_ver else None,
            "filename": active_ver.filename if active_ver else None,
            "version_id": active_ver.id if active_ver else None,
            "uploaded_at": active_ver.uploaded_at.isoformat() if active_ver else None,
            "units_count": len(s.units),
            "correspondences_count": len(s.correspondences)
        })
    return response


@app.get("/subjects/{id}", response_model=dict)
async def get_subject_detail(id: int, db: AsyncSession = Depends(get_db)):
    """Get subject full details, units, correspondences, and active version."""
    query = select(Subject).where(Subject.id == id)
    res = await db.execute(query)
    s = res.scalars().first()
    
    if not s:
        raise HTTPException(status_code=404, detail="Materia no encontrada")
        
    active_ver = next((v for v in s.syllabuses if v.is_active), None)
    
    return {
        "id": s.id,
        "code": s.code,
        "name": s.name,
        "document_code": s.document_code,
        "program": s.program,
        "level": s.level,
        "identification_date": s.identification_date.isoformat() if s.identification_date else None,
        "syllabus_version_year": s.syllabus_version_year,
        "academic_credits": s.academic_credits,
        "had_hours": s.had_hours,
        "hde_hours": s.hde_hours,
        "hts_hours": s.hts_hours,
        "academic_period": s.academic_period,
        "prerequisite": s.prerequisite,
        "presentation": s.presentation,
        "purpose": s.purpose,
        "previous_competencies": s.previous_competencies,
        "generic_competencies": s.generic_competencies,
        "relation_other_subjects": s.relation_other_subjects,
        "teaching_strategies": s.teaching_strategies,
        "eval_diagnostica": s.eval_diagnostica,
        "eval_formativa": s.eval_formativa,
        "eval_sumativa": s.eval_sumativa,
        "bibliographic_references": s.bibliographic_references,
        "active_version": active_ver.version_number if active_ver else None,
        "version_id": active_ver.id if active_ver else None,
        "units": [
            {
                "unit_number": u.unit_number,
                "unit_title": u.unit_title,
                "contents": u.contents,
                "performance_criteria": u.performance_criteria
            }
            for u in s.units
        ],
        "correspondences": [
            {
                "code": c.code,
                "name": c.name,
                "requirements": c.requirements
            }
            for c in s.correspondences
        ]
    }


@app.get("/subjects/{id}/versions", response_model=List[dict])
async def get_subject_versions(id: int, db: AsyncSession = Depends(get_db)):
    """Get the full history of uploaded versions for a subject."""
    query = select(SyllabusVersion).where(SyllabusVersion.subject_id == id).order_by(SyllabusVersion.version_number.desc())
    res = await db.execute(query)
    versions = res.scalars().all()
    
    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "filename": v.filename,
            "file_hash": v.file_hash,
            "uploaded_at": v.uploaded_at.isoformat(),
            "uploaded_by": v.uploaded_by.full_name if v.uploaded_by else "Sistema",
            "is_active": v.is_active
        }
        for v in versions
    ]


@app.put("/subjects/{id}")
async def update_subject(id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    """Update subject classifications or text fields manually."""
    query = select(Subject).where(Subject.id == id)
    res = await db.execute(query)
    s = res.scalars().first()
    
    if not s:
        raise HTTPException(status_code=404, detail="Materia no encontrada")
        
    for k, v in payload.items():
        if k in [
            "name", "document_code", "program", "level", 
            "academic_credits", "had_hours", "hde_hours", "hts_hours", 
            "academic_period", "prerequisite", "presentation", "purpose", 
            "previous_competencies", "generic_competencies", 
            "relation_other_subjects", "teaching_strategies", 
            "eval_diagnostica", "eval_formativa", "eval_sumativa", 
            "bibliographic_references", "syllabus_version_year"
        ]:
            if k == "identification_date" and v:
                setattr(s, k, datetime.strptime(v, "%Y-%m-%d").date())
            else:
                setattr(s, k, v)
                
    db.add(s)
    await db.commit()
    return {"success": True, "detail": "Materia actualizada correctamente"}


@app.get("/download/{version_id}")
async def download_file(version_id: int, db: AsyncSession = Depends(get_db)):
    """Download the physical PDF file associated with a syllabus version."""
    query = select(SyllabusVersion).where(SyllabusVersion.id == version_id)
    res = await db.execute(query)
    v = res.scalars().first()
    
    if not v:
        raise HTTPException(status_code=404, detail="Archivo de Programa Sinóptico no encontrado")
        
    if not os.path.exists(v.file_path):
        raise HTTPException(status_code=404, detail="El archivo físico no se encuentra en el servidor compartida.")
        
    return FileResponse(
        path=v.file_path,
        media_type="application/pdf",
        filename=v.filename
    )


@app.get("/export/excel")
async def export_excel(db: AsyncSession = Depends(get_db)):
    """Generate and stream Excel sheet with total subjects summary."""
    query = select(Subject).order_by(Subject.code)
    res = await db.execute(query)
    subjects = res.scalars().all()
    
    rows = []
    for s in subjects:
        active_ver = next((v for v in s.syllabuses if v.is_active), None)
        rows.append({
            "Código Asignatura": s.code,
            "Unidad Curricular": s.name,
            "Programa Académico": s.program or "No registrado",
            "Nivel": s.level,
            "HAD": s.had_hours,
            "HDE": s.hde_hours,
            "HTS": s.hts_hours,
            "Créditos": s.academic_credits,
            "Periodo": s.academic_period or 0,
            "Prelación": s.prerequisite or "Ninguna",
            "Versión Programa": s.syllabus_version_year or "2024",
            "Versión Carga Activa": active_ver.version_number if active_ver else 0,
            "Fecha Última Carga": active_ver.uploaded_at.strftime("%d/%m/%Y %H:%M") if active_ver else "No cargado"
        })
        
    df = pd.DataFrame(rows)
    
    # Write to Excel in memory
    excel_io = io.BytesIO()
    with pd.ExcelWriter(excel_io, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Programas Sinópticos")
        
    excel_io.seek(0)
    response_headers = {
        'Content-Disposition': 'attachment; filename="consolidado_programas_sinopticos.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
    return StreamingResponse(io.BytesIO(excel_io.read()), headers=response_headers)


@app.get("/export/csv")
async def export_csv(db: AsyncSession = Depends(get_db)):
    """Generate and stream CSV sheet with total subjects summary."""
    query = select(Subject).order_by(Subject.code)
    res = await db.execute(query)
    subjects = res.scalars().all()
    
    rows = []
    for s in subjects:
        active_ver = next((v for v in s.syllabuses if v.is_active), None)
        rows.append({
            "Código Asignatura": s.code,
            "Unidad Curricular": s.name,
            "Programa Académico": s.program or "No registrado",
            "Nivel": s.level,
            "HAD": s.had_hours,
            "HDE": s.hde_hours,
            "HTS": s.hts_hours,
            "Créditos": s.academic_credits,
            "Periodo": s.academic_period or 0,
            "Prelación": s.prerequisite or "Ninguna",
            "Versión Programa": s.syllabus_version_year or "2024",
            "Versión Carga Activa": active_ver.version_number if active_ver else 0,
            "Fecha Última Carga": active_ver.uploaded_at.strftime("%d/%m/%Y %H:%M") if active_ver else "No cargado"
        })
        
    df = pd.DataFrame(rows)
    csv_str = df.to_csv(index=False, encoding="utf-8")
    
    response_headers = {
        'Content-Disposition': 'attachment; filename="consolidado_programas_sinopticos.csv"',
        'Content-Type': 'text/csv; charset=utf-8'
    }
    return StreamingResponse(io.BytesIO(csv_str.encode("utf-8")), headers=response_headers)
