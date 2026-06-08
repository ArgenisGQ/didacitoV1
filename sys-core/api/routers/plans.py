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
    from sqlalchemy.orm import selectinload
    query = select(LessonPlan).options(
        selectinload(LessonPlan.author),
        selectinload(LessonPlan.evaluation_plans),
        selectinload(LessonPlan.weekly_contents)
    ).execution_options(populate_existing=True)
    if current_user.role == UserRole.DOCENTE:
        query = query.where(LessonPlan.author_id == current_user.id)
    elif current_user.role == UserRole.COORDINADOR:
        # Fetch the departments of the current user to get their subject_codes
        from api.models import user_departments, Department
        dept_result = await db.execute(
            select(Department.subject_codes)
            .join(user_departments, user_departments.c.department_id == Department.id)
            .where(user_departments.c.user_id == current_user.id)
        )
        codes_rows = dept_result.scalars().all()
        allowed_subjects = set()
        for codes_str in codes_rows:
            if codes_str:
                allowed_subjects.update(c.strip() for c in codes_str.split(',') if c.strip())
        
        if allowed_subjects:
            query = query.where(LessonPlan.subject_code.in_(allowed_subjects))
        else:
            # If the coordinator has no subjects assigned, they see nothing
            query = query.where(LessonPlan.id == -1)

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
        status=plan_in.status if plan_in.status else PlanStatus.DRAFT,
        subject_code=plan_in.subject_code,
        section=plan_in.section,
        academic_period_id=plan_in.academic_period_id,
        modality=plan_in.modality,
        component_type=plan_in.component_type,
        hd_t=plan_in.hd_t,
        hd_lt=plan_in.hd_lt,
        hd_iscp=plan_in.hd_iscp,
        hiv_s=plan_in.hiv_s,
        hiv_a=plan_in.hiv_a,
        hde=plan_in.hde,
        objectives=plan_in.objectives,
        strategies=plan_in.strategies,
    )
    db.add(new_plan)
    await db.commit()
    await db.refresh(new_plan)

    # Save evaluation_plans if provided
    if plan_in.evaluation_plans:
        for ev in plan_in.evaluation_plans:
            db.add(EvaluationPlan(lesson_plan_id=new_plan.id, **ev.model_dump()))

    # Save weekly_contents if provided
    if plan_in.weekly_contents:
        for wc in plan_in.weekly_contents:
            db.add(WeeklyContent(lesson_plan_id=new_plan.id, **wc.model_dump()))

    if plan_in.evaluation_plans or plan_in.weekly_contents:
        await db.commit()
    
    from sqlalchemy.orm import selectinload
    query = select(LessonPlan).options(
        selectinload(LessonPlan.evaluation_plans),
        selectinload(LessonPlan.weekly_contents)
    ).where(LessonPlan.id == new_plan.id)
    result = await db.execute(query)
    
    new_plan_with_rels = result.scalars().first()
    
    # Trigger real-time dashboard update (fire and forget)
    from api.routers.dashboard import trigger_dashboard_update
    import asyncio
    asyncio.create_task(trigger_dashboard_update())
    
    return new_plan_with_rels


@router.get("/{plan_id}", response_model=LessonPlanResponse)
async def get_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(LessonPlan).options(
            selectinload(LessonPlan.evaluation_plans),
            selectinload(LessonPlan.weekly_contents)
        ).where(LessonPlan.id == plan_id).execution_options(populate_existing=True)
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
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(LessonPlan).options(
            selectinload(LessonPlan.evaluation_plans),
            selectinload(LessonPlan.weekly_contents)
        ).where(LessonPlan.id == plan_id)
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
            
        # Trigger AI evaluation when plan is submitted for review
        if plan.status != PlanStatus.IN_REVIEW:
            import httpx
            import asyncio
            async def trigger_ai_eval():
                try:
                    import os
                    ai_service_url = os.getenv("AI_SERVICE_URL", "http://sys-ai:8003")
                    async with httpx.AsyncClient() as client:
                        await client.post(f"{ai_service_url}/api/ai/evaluate/{plan_id}/", timeout=5.0)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to trigger AI eval for plan {plan_id}: {e}")
            
            asyncio.create_task(trigger_ai_eval())

    if plan_in.title is not None:
        plan.title = plan_in.title
    if plan_in.program_id is not None:
        plan.program_id = plan_in.program_id
    if plan_in.status is not None:
        if plan_in.status == PlanStatus.APPROVED and plan.status != PlanStatus.APPROVED:
            # Lógica de aprobación jerárquica
            user_perms = getattr(current_user, "token_permissions", [])
            
            if "lesson_plan:approve_global" in user_perms:
                pass # Puede aprobar libremente
            elif "lesson_plan:approve_department" in user_perms:
                if not current_user.department_id:
                    raise HTTPException(status_code=403, detail="No tienes un departamento asignado para aprobar planes")
                
                from api.models import Department
                dept = await db.get(Department, current_user.department_id)
                if not dept or not dept.subject_codes:
                    raise HTTPException(status_code=403, detail="Tu departamento asignado no tiene asignaturas válidas configuradas")
                
                allowed_codes = [c.strip() for c in dept.subject_codes.split(",")]
                if not plan.subject_code or plan.subject_code not in allowed_codes:
                    raise HTTPException(status_code=403, detail="Este plan pertenece a una asignatura fuera de la jurisdicción de su departamento")
            else:
                raise HTTPException(status_code=403, detail="No tienes permisos para aprobar planes didácticos")
                
            # Trigger AI sync for this newly approved plan
            import httpx
            import asyncio
            async def trigger_ai_sync_plan():
                try:
                    import os
                    ai_service_url = os.getenv("AI_SERVICE_URL", "http://sys-ai:8003")
                    async with httpx.AsyncClient() as client:
                        await client.post(f"{ai_service_url}/api/ai/admin/sync-plan/{plan_id}/", timeout=5.0)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to trigger AI sync for plan {plan_id}: {e}")
            
            asyncio.create_task(trigger_ai_sync_plan())
                
        plan.status = plan_in.status
    if plan_in.subject_code is not None:
        plan.subject_code = plan_in.subject_code
    if plan_in.section is not None:
        plan.section = plan_in.section
    if plan_in.academic_period_id is not None:
        plan.academic_period_id = plan_in.academic_period_id
    if plan_in.modality is not None:
        plan.modality = plan_in.modality
    if plan_in.component_type is not None:
        plan.component_type = plan_in.component_type
    if plan_in.hd_t is not None:
        plan.hd_t = plan_in.hd_t
    if plan_in.hd_lt is not None:
        plan.hd_lt = plan_in.hd_lt
    if plan_in.hd_iscp is not None:
        plan.hd_iscp = plan_in.hd_iscp
    if plan_in.hiv_s is not None:
        plan.hiv_s = plan_in.hiv_s
    if plan_in.hiv_a is not None:
        plan.hiv_a = plan_in.hiv_a
    if plan_in.hde is not None:
        plan.hde = plan_in.hde
        
    if plan_in.objectives is not None:
        plan.objectives = plan_in.objectives
    if plan_in.strategies is not None:
        plan.strategies = plan_in.strategies

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
    
    result = await db.execute(
        select(LessonPlan).options(
            selectinload(LessonPlan.evaluation_plans),
            selectinload(LessonPlan.weekly_contents)
        ).where(LessonPlan.id == plan_id)
    )
    plan = result.scalars().first()
    
    # Trigger real-time dashboard update (fire and forget)
    from api.routers.dashboard import trigger_dashboard_update
    import asyncio
    asyncio.create_task(trigger_dashboard_update())
    
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

@router.get("/{plan_id}/pdf")
async def generate_plan_pdf(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse
    from fastapi import HTTPException
    import io
    import os
    try:
        from jinja2 import Environment, FileSystemLoader
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(status_code=500, detail="WeasyPrint or Jinja2 not installed.")

    from sqlalchemy.orm import selectinload
    from api.models import Subject
    
    query = select(LessonPlan).options(
        selectinload(LessonPlan.author),
        selectinload(LessonPlan.evaluation_plans),
        selectinload(LessonPlan.weekly_contents),
        selectinload(LessonPlan.academic_period)
    ).where(LessonPlan.id == plan_id)
    
    result = await db.execute(query)
    plan = result.scalars().first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    if current_user.role == UserRole.DOCENTE and plan.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Fetch subject details
    subject = None
    if plan.subject_code:
        subj_res = await db.execute(select(Subject).where(Subject.code == plan.subject_code))
        subject = subj_res.scalars().first()

    # Prepare template data
    templates_dir = os.path.join(os.path.dirname(__file__), "../../templates")
    env = Environment(loader=FileSystemLoader(templates_dir))
    template = env.get_template("lesson_plan_template.html")
    
    logo_url = os.getenv("INSTITUTION_LOGO_URL", "/static/img/university_logo.png")
    # For local testing inside docker weasyprint might need absolute file path or absolute URL
    # Usually absolute file path works best for weasyprint local resources
    static_dir = os.path.join(os.path.dirname(__file__), "../../static")
    logo_path = "file://" + os.path.abspath(os.path.join(static_dir, "img", "university_logo.png")).replace("\\", "/")
    
    context = {
        "logo_url": logo_path,
        "plan": {
            "subject_name": subject.name if subject else "",
            "subject_purpose": "",
            "subject_code": plan.subject_code or "",
            "section": plan.section or "",
            "pre_requisite": getattr(subject, 'pre_requisite', "") if subject else "",
            "total_hours": subject.academic_credits * 16 if subject else "",
            "total_hours_2": "",
            "hd_t": "",
            "hd_lt": "",
            "hiv_iscp": "",
            "hiv_s": "",
            "hiv_a": "",
            "hde": "",
            "academic_period": plan.academic_period.name if plan.academic_period else "",
        },
        "author": {
            "name": getattr(plan.author, 'first_name', '') + " " + getattr(plan.author, 'last_name', '') if getattr(plan.author, 'first_name', None) else plan.author.email,
            "id_document": getattr(plan.author, 'id_user', ''),
            "email": plan.author.email,
        },
        "evaluation_plans": plan.evaluation_plans,
        "weekly_contents": sorted(plan.weekly_contents, key=lambda x: x.week_number)
    }

    html_out = template.render(**context)
    pdf_bytes = HTML(string=html_out).write_pdf()

    return StreamingResponse(
        io.BytesIO(pdf_bytes), 
        media_type="application/pdf", 
        headers={"Content-Disposition": f'inline; filename="planificacion_{plan_id}.pdf"'}
    )


@router.post("/preview-pdf")
async def preview_plan_pdf(
    payload: LessonPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse
    from fastapi import HTTPException
    import io
    import os
    try:
        from jinja2 import Environment, FileSystemLoader
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(status_code=500, detail="WeasyPrint or Jinja2 not installed.")

    from api.models import Subject, AcademicPeriod
    
    # Fetch subject details
    subject = None
    if payload.subject_code:
        subj_res = await db.execute(select(Subject).where(Subject.code == payload.subject_code))
        subject = subj_res.scalars().first()
        
    academic_period_name = ""
    if payload.academic_period_id:
        ap_res = await db.execute(select(AcademicPeriod).where(AcademicPeriod.id == payload.academic_period_id))
        ap = ap_res.scalars().first()
        if ap:
            academic_period_name = ap.name

    # Prepare template data
    templates_dir = os.path.join(os.path.dirname(__file__), "../../templates")
    env = Environment(loader=FileSystemLoader(templates_dir))
    template = env.get_template("lesson_plan_template.html")
    
    logo_url = os.getenv("INSTITUTION_LOGO_URL", "/static/img/university_logo.png")
    static_dir = os.path.join(os.path.dirname(__file__), "../../static")
    logo_path = "file://" + os.path.abspath(os.path.join(static_dir, "img", "university_logo.png")).replace("\\", "/")
    
    context = {
        "logo_url": logo_path,
        "plan": {
            "subject_name": subject.name if subject else "",
            "subject_purpose": "",
            "subject_code": payload.subject_code or "",
            "section": payload.section or "",
            "pre_requisite": getattr(subject, 'pre_requisite', "") if subject else "",
            "total_hours": subject.academic_credits * 16 if subject else "",
            "total_hours_2": "",
            "hd_t": "",
            "hd_lt": "",
            "hiv_iscp": "",
            "hiv_s": "",
            "hiv_a": "",
            "hde": "",
            "academic_period": academic_period_name,
        },
        "author": {
            "name": getattr(current_user, 'first_name', '') + " " + getattr(current_user, 'last_name', '') if getattr(current_user, 'first_name', None) else current_user.email,
            "id_document": getattr(current_user, 'id_user', ''),
            "email": current_user.email,
        },
        "evaluation_plans": payload.evaluation_plans or [],
        "weekly_contents": sorted(payload.weekly_contents or [], key=lambda x: getattr(x, 'week_number', 0))
    }

    html_out = template.render(**context)
    pdf_bytes = HTML(string=html_out).write_pdf()

    return StreamingResponse(
        io.BytesIO(pdf_bytes), 
        media_type="application/pdf", 
        headers={"Content-Disposition": 'inline; filename="preview.pdf"'}
    )


