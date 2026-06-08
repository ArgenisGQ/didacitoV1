import asyncio
from sqlalchemy.orm import selectinload
from app.database import get_task_db
from app.models import Subject, SyllabusVersion, SubjectUnit
from app.parser import parse_syllabus_pdf
import os
from sqlalchemy import select, delete

async def reparse():
    async with get_task_db() as db:
        result = await db.execute(select(SyllabusVersion).options(selectinload(SyllabusVersion.subject)))
        versions = result.scalars().all()
        for v in versions:
            if not v.file_path:
                continue
            pdf_path = v.file_path
            if not os.path.exists(pdf_path):
                continue
            with open(pdf_path, 'rb') as f:
                data = parse_syllabus_pdf(f.read(), os.path.basename(pdf_path))
            
            # Delete old units
            await db.execute(delete(SubjectUnit).where(SubjectUnit.subject_id == v.subject_id))
            
            # Insert new units
            for u in data['units']:
                db.add(SubjectUnit(
                    subject_id=v.subject_id,
                    unit_number=u['unit_number'],
                    unit_title=u['unit_title'],
                    contents=u.get('contents', ''),
                    performance_criteria=u.get('performance_criteria', '')
                ))
            await db.commit()
            code = getattr(v.subject, "code", "UNKNOWN")
            count = len(data.get("units", []))
            print(f"Reparsed {code} - added {count} units", flush=True)

asyncio.run(reparse())
