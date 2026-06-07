from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Dict, Any
import asyncio

from api.database import get_db, get_task_db
from api.core.dependencies import get_current_user, RequirePermission
from api.models import User, Widget, DashboardWidgetRole, Role, AuditLog, LessonPlan, AcademicPeriod, UserAcademicPeriod
from api.core.websockets import dashboard_ws_manager

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

async def fetch_global_analytics(db: AsyncSession) -> dict:
    """Función helper para obtener las analíticas globales (útil para REST y WebSockets)"""
    # Usuarios Totales
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0
    
    # Planes Totales
    plans_result = await db.execute(select(func.count(LessonPlan.id)))
    total_plans = plans_result.scalar() or 0
    
    # Estado de Planes (DRAFT, IN_REVIEW, OBSERVED, APPROVED)
    # Calcular "NOT_STARTED" y status_counts para el periodo activo
    active_period_result = await db.execute(select(AcademicPeriod).where(AcademicPeriod.is_active == True))
    active_period = active_period_result.scalars().first()
    
    status_counts = {"DRAFT": 0, "IN_REVIEW": 0, "OBSERVED": 0, "APPROVED": 0}
    
    if active_period:
        status_query = await db.execute(
            select(LessonPlan.status, func.count(LessonPlan.id))
            .where(LessonPlan.academic_period_id == active_period.id)
            .group_by(LessonPlan.status)
        )
        status_counts_db = status_query.all()
        for status_val, count in status_counts_db:
            status_counts[status_val] = count
        uap_result = await db.execute(
            select(UserAcademicPeriod.section)
            .where(UserAcademicPeriod.academic_period_id == active_period.id, UserAcademicPeriod.is_active == True)
        )
        expected_plans = 0
        for (sec_str,) in uap_result.all():
            if sec_str:
                expected_plans += len([s for s in sec_str.split(',') if s.strip()])
        
        created_result = await db.execute(
            select(func.count(LessonPlan.id))
            .where(LessonPlan.academic_period_id == active_period.id)
        )
        created_plans = created_result.scalar() or 0
        status_counts["NOT_STARTED"] = max(0, expected_plans - created_plans)
    else:
        status_counts["NOT_STARTED"] = 0
            
    # Calculate REAL current online users based on AuditLog activity in the last 2 hours
    two_hours_ago = datetime.utcnow() - timedelta(hours=2)
    
    recent_logs_query = await db.execute(
        select(AuditLog.user_id)
        .where(AuditLog.created_at >= two_hours_ago)
        .where(AuditLog.user_id.isnot(None))
    )
    recent_logs = recent_logs_query.scalars().all()
    
    # Calculate real-time online users using WebSocket active connections
    current_online_users = len(dashboard_ws_manager.active_connections)
    
    # Calculate REAL weekly stats for the academic period (13 weeks = 91 days)
    from collections import defaultdict
    from datetime import date
    
    connections_by_day = defaultdict(int)
    plans_by_day = defaultdict(int)
    
    today = datetime.utcnow()
    if active_period and getattr(active_period, 'start_date', None):
        start_date_dt = datetime.combine(active_period.start_date, datetime.min.time())
        monday_offset = start_date_dt.weekday()
        period_start = start_date_dt - timedelta(days=monday_offset)
    else:
        monday_offset = today.weekday()
        period_start = today - timedelta(days=monday_offset + 91 - 7)
        period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
    period_end = period_start + timedelta(days=91)
    
    # Obtener conexiones del periodo
    logs_result = await db.execute(
        select(AuditLog.created_at)
        .where(AuditLog.created_at >= period_start, AuditLog.created_at < period_end)
    )
    logs_dates = logs_result.scalars().all()
    
    # Obtener planes creados del periodo
    recent_plans_result = await db.execute(
        select(LessonPlan.created_at)
        .where(LessonPlan.created_at >= period_start, LessonPlan.created_at < period_end)
    )
    plans_dates = recent_plans_result.scalars().all()

    for d in logs_dates:
        if d:
            connections_by_day[d.date()] += 1
            
    for d in plans_dates:
        if d:
            plans_by_day[d.date()] += 1
            
    # Generar la serie de 13 semanas (91 dias)
    active_users_series = []
    days_es = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    
    current_date = today.date()
    
    for w in range(13):
        for d in range(7):
            day_dt = period_start + timedelta(days=w*7 + d)
            is_future = day_dt.date() > current_date
            
            active_users_series.append({
                "name": f"S{w}-{days_es[d]}",
                "connections": 0 if is_future else connections_by_day[day_dt.date()],
                "plans": 0 if is_future else plans_by_day[day_dt.date()],
                "weekIndex": w,
                "is_today": day_dt.date() == current_date
            })
    
    average_creation_time = "1.2h" if total_plans > 0 else "0h"
    
    return {
        "total_users": total_users,
        "total_plans": total_plans,
        "status_counts": status_counts,
        "pending_approvals": status_counts.get("IN_REVIEW", 0),
        "current_online_users": current_online_users,
        "active_users_series": active_users_series,
        "average_creation_time": average_creation_time
    }

async def trigger_dashboard_update():
    """Dispara un broadcast WebSocket a los clientes conectados para actualizar el dashboard"""
    if not dashboard_ws_manager.active_connections:
        return # Si nadie está viendo el dashboard, no procesar
    
    try:
        async with get_task_db() as db:
            data = await fetch_global_analytics(db)
            await dashboard_ws_manager.broadcast({"type": "ANALYTICS_UPDATE", "data": data})
    except Exception as e:
        import logging
        logging.error(f"Error in trigger_dashboard_update: {e}")

@router.get("/widgets", response_model=List[Dict[str, Any]])
async def get_my_widgets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene la lista de widgets habilitados y ordenados para el usuario actual basándose en su rol."""
    # Obtenemos los roles del usuario
    result = await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == current_user.id)
    )
    user = result.scalars().first()
    
    if not user:
        return []
        
    primary_role_id = None
    if user.roles:
        primary_role_id = user.roles[0].id
    elif user.role:
        # Fallback to string role column
        role_result = await db.execute(select(Role).where(Role.name == user.role))
        fallback_role = role_result.scalars().first()
        if fallback_role:
            primary_role_id = fallback_role.id
            
    if not primary_role_id:
        return []
    
    widgets_query = await db.execute(
        select(DashboardWidgetRole)
        .options(selectinload(DashboardWidgetRole.widget))
        .where(
            DashboardWidgetRole.role_id == primary_role_id,
            DashboardWidgetRole.is_active == True
        )
        .order_by(DashboardWidgetRole.order)
    )
    
    assignments = widgets_query.scalars().all()
    
    return [
        {
            "id": a.widget.id,
            "code": a.widget.code,
            "name": a.widget.name,
            "description": a.widget.description,
            "component_name": a.widget.component_name,
            "order": a.order
        }
        for a in assignments
    ]

@router.get("/analytics/global")
async def get_global_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Datos globales para el Super Admin o Admin Gestión."""
    return await fetch_global_analytics(db)

@router.get("/analytics/coordinator")
async def get_coordinator_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Datos filtrados para el Coordinador según sus asignaturas."""
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
            
    if not allowed_subjects:
        return {
            "total_users": 0,
            "total_plans": 0,
            "status_counts": {"DRAFT": 0, "IN_REVIEW": 0, "OBSERVED": 0, "APPROVED": 0, "NOT_STARTED": 0},
            "pending_approvals": 0,
            "current_online_users": 0,
            "active_users_series": [],
            "average_creation_time": "0h",
            "rezagados": 0
        }

    plans_query = select(LessonPlan).where(LessonPlan.subject_code.in_(allowed_subjects))
    result = await db.execute(plans_query)
    plans = result.scalars().all()
    
    total_plans = len(plans)
    status_counts = {"DRAFT": 0, "IN_REVIEW": 0, "OBSERVED": 0, "APPROVED": 0}
    for p in plans:
        if p.status in status_counts:
            status_counts[p.status] += 1
            
    active_period_result = await db.execute(select(AcademicPeriod).where(AcademicPeriod.is_active == True))
    active_period = active_period_result.scalars().first()
    
    if active_period:
        from api.models import User
        uap_result = await db.execute(
            select(UserAcademicPeriod.subject_code, UserAcademicPeriod.section, User.first_name, User.last_name, User.email)
            .outerjoin(User, User.id == UserAcademicPeriod.user_id)
            .where(
                UserAcademicPeriod.academic_period_id == active_period.id, 
                UserAcademicPeriod.is_active == True
            )
        )
        expected_plans = 0
        expected_sections_list = []
        for sub_str, sec_str, f_name, l_name, email in uap_result.all():
            if not sub_str or not sec_str:
                continue
            row_subjects = [s.strip() for s in sub_str.split(',') if s.strip()]
            matched_subject = next((s for s in row_subjects if s in allowed_subjects), None)
            if matched_subject:
                sections = [s.strip() for s in sec_str.split(',') if s.strip()]
                expected_plans += len(sections)
                
                author_name = "Desconocido"
                if f_name or l_name:
                    author_name = f"{f_name or ''} {l_name or ''}".strip()
                elif email:
                    author_name = email
                    
                for sec in sections:
                    expected_sections_list.append({
                        "subject_code": matched_subject,
                        "section": sec,
                        "author_name": author_name
                    })
        
        created_result = await db.execute(
            select(func.count(LessonPlan.id))
            .where(
                LessonPlan.academic_period_id == active_period.id,
                LessonPlan.subject_code.in_(allowed_subjects)
            )
        )
        created_plans = created_result.scalar() or 0
        status_counts["NOT_STARTED"] = max(0, expected_plans - created_plans)
    else:
        status_counts["NOT_STARTED"] = 0

    global_data = await fetch_global_analytics(db)
    
    return {
        "total_users": global_data["total_users"],
        "total_plans": total_plans,
        "status_counts": status_counts,
        "pending_approvals": status_counts.get("IN_REVIEW", 0),
        "current_online_users": global_data["current_online_users"],
        "active_users_series": global_data["active_users_series"],
        "average_creation_time": "1.2h" if total_plans > 0 else "0h",
        "rezagados": status_counts["NOT_STARTED"],
        "expected_sections": expected_sections_list if active_period else []
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Endpoint para enviar actualizaciones en tiempo real del dashboard a clientes"""
    await dashboard_ws_manager.connect(websocket)
    await trigger_dashboard_update()
    try:
        while True:
            # Mantener la conexión abierta, si el frontend envía ping, respondemos pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        dashboard_ws_manager.disconnect(websocket)
        await trigger_dashboard_update()
    except Exception as e:
        dashboard_ws_manager.disconnect(websocket)
        await trigger_dashboard_update()

@router.get("/analytics/personal")
async def get_personal_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Datos filtrados para Docentes."""
    plans_result = await db.execute(
        select(LessonPlan).where(LessonPlan.author_id == current_user.id)
    )
    my_plans = plans_result.scalars().all()
    
    status_counts = {"DRAFT": 0, "IN_REVIEW": 0, "OBSERVED": 0, "APPROVED": 0}
    draft_plans = []
    approved_plans = []
    for p in my_plans:
        if p.status in status_counts:
            status_counts[p.status] += 1
        if p.status == "DRAFT":
            draft_plans.append({
                "id": p.id,
                "title": getattr(p, "title", getattr(p, "topic", f"Plan Borrador #{p.id}"))
            })
        if p.status == "APPROVED":
            approved_plans.append({
                "id": p.id,
                "title": getattr(p, "title", getattr(p, "topic", f"Plan Aprobado #{p.id}"))
            })
            
    # Calcular "NOT_STARTED" personal
    active_period_result = await db.execute(select(AcademicPeriod).where(AcademicPeriod.is_active == True))
    active_period = active_period_result.scalars().first()
    if active_period:
        expected_result = await db.execute(
            select(func.count(UserAcademicPeriod.id))
            .where(UserAcademicPeriod.user_id == current_user.id, UserAcademicPeriod.academic_period_id == active_period.id, UserAcademicPeriod.is_active == True)
        )
        expected_plans = expected_result.scalar() or 0
        
        created_result = await db.execute(
            select(func.count(LessonPlan.id))
            .where(LessonPlan.author_id == current_user.id, LessonPlan.academic_period_id == active_period.id)
        )
        created_plans = created_result.scalar() or 0
        status_counts["NOT_STARTED"] = max(0, expected_plans - created_plans)
    else:
        status_counts["NOT_STARTED"] = 0
            
    return {
        "my_total_plans": len(my_plans),
        "status_counts": status_counts,
        "needs_attention": status_counts.get("OBSERVED", 0),
        "draft_plans": draft_plans,
        "approved_plans": approved_plans
    }

from pydantic import BaseModel

class WidgetAssignmentUpdate(BaseModel):
    widget_id: int
    is_active: bool
    order: int

class RoleWidgetsUpdate(BaseModel):
    role_id: int
    assignments: List[WidgetAssignmentUpdate]

@router.get("/settings/roles-widgets")
async def get_roles_widgets(
    current_user: User = Depends(RequirePermission("users:read")),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene todos los roles y sus widgets asignados/disponibles (Solo Admin)"""
    roles_query = await db.execute(select(Role))
    roles = roles_query.scalars().all()
    
    widgets_query = await db.execute(select(Widget))
    all_widgets = widgets_query.scalars().all()
    
    assignments_query = await db.execute(select(DashboardWidgetRole))
    all_assignments = assignments_query.scalars().all()
    
    response = []
    for r in roles:
        role_assignments = [a for a in all_assignments if a.role_id == r.id]
        role_widgets = []
        for w in all_widgets:
            assignment = next((a for a in role_assignments if a.widget_id == w.id), None)
            role_widgets.append({
                "widget_id": w.id,
                "code": w.code,
                "name": w.name,
                "description": w.description,
                "component_name": w.component_name,
                "is_active": assignment.is_active if assignment else False,
                "order": assignment.order if assignment else 999
            })
        role_widgets.sort(key=lambda x: x["order"])
        response.append({
            "role_id": r.id,
            "role_name": r.name,
            "widgets": role_widgets
        })
        
    return response

@router.post("/settings/roles-widgets")
async def update_roles_widgets(
    data: RoleWidgetsUpdate,
    current_user: User = Depends(RequirePermission("users:read")),
    db: AsyncSession = Depends(get_db)
):
    """Actualiza la asignación y orden de widgets para un rol (Solo Admin)"""
    for assignment in data.assignments:
        query = await db.execute(
            select(DashboardWidgetRole).where(
                DashboardWidgetRole.role_id == data.role_id,
                DashboardWidgetRole.widget_id == assignment.widget_id
            )
        )
        existing = query.scalars().first()
        if existing:
            existing.is_active = assignment.is_active
            existing.order = assignment.order
        else:
            new_assignment = DashboardWidgetRole(
                role_id=data.role_id,
                widget_id=assignment.widget_id,
                is_active=assignment.is_active,
                order=assignment.order
            )
            db.add(new_assignment)
    
    await db.commit()
    return {"status": "success"}

class TaxonomyUpdate(BaseModel):
    strategies: List[str]
    instruments: List[str]
    evidences: List[str]
    feedback_methods: List[str]
    predictive_rules: Dict[str, Dict[str, str]]

@router.get("/settings/taxonomies")
async def get_taxonomies(db: AsyncSession = Depends(get_db)):
    """Obtiene las listas estáticas de taxonomía y reglas predictivas."""
    from api.core.settings_manager import SettingsManager
    val = SettingsManager.get_cached_setting("evaluation_taxonomies")
    if not val:
        # Default fallback dictionary
        return {
            "strategies": ['Foro de socialización', 'Estudio de caso', 'Elaboración de organizadores gráficos', 'Relatoría crítico-reflexiva', 'Proyecto prospectivo', 'Cuestionario virtual'],
            "instruments": ['Rúbrica de evaluación', 'Lista de cotejo', 'Escala de estimación', 'Prueba escrita'],
            "evidences": ['Participación', 'Informe del Estudio de caso', 'Infografía', 'Revista digital', 'Proyecto + video', 'Prueba escrita'],
            "feedback_methods": ['Criterios de la rúbrica', 'Análisis de los resultados obtenidos', 'Nivel de participación'],
            "predictive_rules": {
              'Foro de socialización': {
                "evidence": 'Participación',
                "instrument": 'Rúbrica de evaluación',
                "feedback_method": 'Nivel de participación'
              },
              'Estudio de caso': {
                "evidence": 'Informe del Estudio de caso',
                "instrument": 'Rúbrica de evaluación',
                "feedback_method": 'Análisis de los resultados obtenidos'
              },
              'Cuestionario virtual': {
                "evidence": 'Prueba escrita',
                "instrument": 'Prueba escrita',
                "feedback_method": 'Análisis de los resultados obtenidos'
              }
            }
        }
    import json
    try:
        return json.loads(val)
    except:
        return {}

from api.models import SystemSetting

@router.post("/settings/taxonomies")
async def update_taxonomies(
    data: TaxonomyUpdate,
    current_user: User = Depends(RequirePermission("taxonomies:manage")),
    db: AsyncSession = Depends(get_db)
):
    """Actualiza las taxonomías (Solo usuarios con taxonomies:manage)"""
    import json
    
    query = await db.execute(select(SystemSetting).where(SystemSetting.key == "evaluation_taxonomies"))
    setting = query.scalars().first()
    
    val_str = json.dumps(data.model_dump())
    
    if setting:
        setting.value = val_str
    else:
        setting = SystemSetting(key="evaluation_taxonomies", value=val_str, description="Catálogos y reglas predictivas de Evaluación")
        db.add(setting)
        
    await db.commit()
    from api.core.settings_manager import SettingsManager
    await SettingsManager.reload(db)
    
    return {"status": "success"}
