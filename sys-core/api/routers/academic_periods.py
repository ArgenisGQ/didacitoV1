import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update
from typing import List, Optional
from datetime import date

from api.database import get_db
from api.models import AcademicPeriod, User, UserRole, UserAcademicPeriod
from api.schemas import AcademicPeriodCreate, AcademicPeriodUpdate, AcademicPeriodResponse
from api.core.dependencies import get_current_user

router = APIRouter(
    prefix="/academic-periods",
    tags=["Academic Periods"],
)

TEST_MODE = os.getenv("TEST_MODE", "false").lower() == "true"

async def require_super_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación no permitida. Solo Super Admin puede gestionar los periodos académicos."
        )
    return current_user

@router.get("", response_model=List[AcademicPeriodResponse])
async def get_academic_periods(
    limit: Optional[int] = None,
    skip: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    query = (
        select(AcademicPeriod, func.count(UserAcademicPeriod.user_id).label("user_count"))
        .outerjoin(UserAcademicPeriod, UserAcademicPeriod.academic_period_id == AcademicPeriod.id)
        .group_by(AcademicPeriod.id)
        .order_by(AcademicPeriod.start_date.desc())
    )
    if limit is not None:
        query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    
    periods = []
    for row in result.all():
        period, count = row
        period.user_count = count
        periods.append(period)
    return periods

@router.get("/suggest-dates")
async def suggest_dates(type: str = "NORMAL", db: AsyncSession = Depends(get_db), current_user: User = Depends(require_super_admin)):
    # Find the most recent period of the same type
    result = await db.execute(
        select(AcademicPeriod)
        .where(AcademicPeriod.type == type)
        .order_by(AcademicPeriod.start_date.desc())
        .limit(1)
    )
    latest_period = result.scalar_one_or_none()

    if latest_period:
        # Suggest dates by adding 1 to the year
        try:
            suggested_start = latest_period.start_date.replace(year=latest_period.start_date.year + 1)
            suggested_end = latest_period.end_date.replace(year=latest_period.end_date.year + 1)
        except ValueError:
            # Handle leap year issue if start_date is Feb 29
            suggested_start = latest_period.start_date.replace(year=latest_period.start_date.year + 1, day=28)
            suggested_end = latest_period.end_date.replace(year=latest_period.end_date.year + 1, day=28)
        
        return {"start_date": suggested_start, "end_date": suggested_end}
    else:
        # Fallback if no period exists
        today = date.today()
        return {"start_date": today, "end_date": today}

@router.post("", response_model=AcademicPeriodResponse)
async def create_academic_period(period_in: AcademicPeriodCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_super_admin)):
    today = date.today()

    # Skip validations if in test mode
    if not TEST_MODE:
        # Validate Max 3 future periods
        if period_in.start_date > today:
            result = await db.execute(
                select(func.count(AcademicPeriod.id))
                .where(AcademicPeriod.start_date > today)
            )
            future_count = result.scalar()
            if future_count >= 3:
                raise HTTPException(status_code=400, detail="No se pueden registrar más de 3 periodos futuros en el sistema.")

        # Validate Max 3 past periods
        if period_in.start_date < today:
            result = await db.execute(
                select(func.count(AcademicPeriod.id))
                .where(AcademicPeriod.start_date < today)
            )
            past_count = result.scalar()
            if past_count >= 3:
                raise HTTPException(status_code=400, detail="No se pueden registrar más de 3 periodos anteriores a la fecha actual en el sistema.")
    
    # Check uniqueness
    result = await db.execute(select(AcademicPeriod).where(AcademicPeriod.name == period_in.name))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un periodo con ese nombre.")

    if period_in.is_active:
        # Deactivate all others
        await db.execute(update(AcademicPeriod).values(is_active=False))

    new_period = AcademicPeriod(**period_in.model_dump())
    db.add(new_period)
    await db.commit()
    await db.refresh(new_period)
    new_period.user_count = 0
    return new_period

@router.put("/{id}", response_model=AcademicPeriodResponse)
async def update_academic_period(id: int, period_in: AcademicPeriodUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_super_admin)):
    result = await db.execute(select(AcademicPeriod).where(AcademicPeriod.id == id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Periodo no encontrado.")

    today = date.today()
    new_start_date = period_in.start_date if period_in.start_date is not None else period.start_date

    # Skip validations if in test mode
    if not TEST_MODE:
        # Validation: Max 3 future periods (exclude self if it was already future)
        if new_start_date > today:
            result = await db.execute(
                select(func.count(AcademicPeriod.id))
                .where(and_(AcademicPeriod.start_date > today, AcademicPeriod.id != id))
            )
            future_count = result.scalar()
            if future_count >= 3:
                raise HTTPException(status_code=400, detail="No se pueden registrar más de 3 periodos futuros en el sistema.")

        # Validation: Max 3 past periods (exclude self if it was already past)
        if new_start_date < today:
            result = await db.execute(
                select(func.count(AcademicPeriod.id))
                .where(and_(AcademicPeriod.start_date < today, AcademicPeriod.id != id))
            )
            past_count = result.scalar()
            if past_count >= 3:
                raise HTTPException(status_code=400, detail="No se pueden registrar más de 3 periodos anteriores a la fecha actual en el sistema.")

    if period_in.name and period_in.name != period.name:
        result = await db.execute(select(AcademicPeriod).where(AcademicPeriod.name == period_in.name))
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un periodo con ese nombre.")

    if period_in.is_active is True:
        await db.execute(update(AcademicPeriod).where(AcademicPeriod.id != id).values(is_active=False))

    update_data = period_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(period, key, value)

    await db.commit()
    await db.refresh(period)
    
    count_res = await db.execute(select(func.count(UserAcademicPeriod.user_id)).where(UserAcademicPeriod.academic_period_id == id))
    period.user_count = count_res.scalar() or 0
    return period

@router.delete("/{id}")
async def delete_academic_period(id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_super_admin)):
    result = await db.execute(select(AcademicPeriod).where(AcademicPeriod.id == id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Periodo no encontrado.")
    
    await db.delete(period)
    await db.commit()
    return {"message": "Periodo eliminado exitosamente."}
