import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Subject, SubjectUnit

async def verify_db_data():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(SubjectUnit)
            .join(Subject, Subject.id == SubjectUnit.subject_id)
            .where(Subject.code == 'THS-1200')
            .order_by(SubjectUnit.unit_number)
        )
        units = result.scalars().all()
        print(f"Found {len(units)} units for THS-1200:")
        for u in units:
            print("=" * 60)
            print(f"Unit Number: {u.unit_number}")
            print(f"Unit Title: {u.unit_title}")
            print(f"Contents:\n{u.contents}")
            print(f"Performance Criteria:\n{u.performance_criteria}")
            print("=" * 60)

asyncio.run(verify_db_data())
