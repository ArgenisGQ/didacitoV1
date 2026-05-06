from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from api.database import get_db
from api.core.dependencies import get_current_user, check_role
from api.models import User, UserRole, LessonPlan, PlanStatus, EvaluationPlan, WeeklyContent
from api.schemas import (
    LessonPlanResponse, LessonPlanCreate, LessonPlanUpdate,
)

router = APIRouter(prefix="/plans", tags=["Plans"])


@router.get("", response_model=List[LessonPlanResponse])
async def list_plans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(LessonPlan)
    if current_user.role == UserRole.DOCENTE:
        query = query.where(LessonPlan.author_id == current_user.id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=LessonPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    plan_in: LessonPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Super Admins cannot be authors of lesson plans",
        )

    new_plan = LessonPlan(
        title=plan_in.title,
        author_id=current_user.id,
        status=PlanStatus.DRAFT,
    )
    db.add(new_plan)
    await db.commit()
    await db.refresh(new_plan)
    return new_plan


@router.get("/{plan_id}", response_model=LessonPlanResponse)
async def get_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LessonPlan).where(LessonPlan.id == plan_id)
    )
    plan = result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if current_user.role == UserRole.DOCENTE and plan.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return plan


@router.put("/{plan_id}", response_model=LessonPlanResponse)
async def update_plan(
    plan_id: int,
    plan_in: LessonPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LessonPlan).where(LessonPlan.id == plan_id)
    )
    plan = result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if current_user.role == UserRole.DOCENTE and plan.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this plan")

    if plan.status == PlanStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Cannot edit an approved plan")

    # Business rule: IN_REVIEW requires 100% weights and 12 weeks
    if plan_in.status == PlanStatus.IN_REVIEW:
        weight_result = await db.execute(
            select(func.sum(EvaluationPlan.weight)).where(
                EvaluationPlan.lesson_plan_id == plan_id
            )
        )
        total_weight = weight_result.scalar() or 0
        if abs(total_weight - 100.0) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Evaluation plan must sum to 100%. Current: {total_weight}%",
            )

        weeks_result = await db.execute(
            select(func.count(WeeklyContent.id)).where(
                WeeklyContent.lesson_plan_id == plan_id
            )
        )
        weeks_count = weeks_result.scalar() or 0
        if weeks_count != 12:
            raise HTTPException(
                status_code=400,
                detail=f"Must have exactly 12 weeks. Current: {weeks_count}",
            )

    if plan_in.title is not None:
        plan.title = plan_in.title
    if plan_in.program_id is not None:
        plan.program_id = plan_in.program_id
    if plan_in.status is not None:
        plan.status = plan_in.status

    # Replace evaluation plans
    if plan_in.evaluation_plans is not None:
        from sqlalchemy import delete
        await db.execute(
            delete(EvaluationPlan).where(EvaluationPlan.lesson_plan_id == plan_id)
        )
        for ev in plan_in.evaluation_plans:
            db.add(EvaluationPlan(lesson_plan_id=plan_id, **ev.model_dump()))

    # Replace weekly contents
    if plan_in.weekly_contents is not None:
        from sqlalchemy import delete
        await db.execute(
            delete(WeeklyContent).where(WeeklyContent.lesson_plan_id == plan_id)
        )
        for wc in plan_in.weekly_contents:
            db.add(WeeklyContent(lesson_plan_id=plan_id, **wc.model_dump()))

    await db.commit()
    await db.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_200_OK)
async def delete_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LessonPlan).where(LessonPlan.id == plan_id)
    )
    plan = result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if current_user.role == UserRole.DOCENTE and plan.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(plan)
    await db.commit()
    return {"message": "Plan deleted"}
