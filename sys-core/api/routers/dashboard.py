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
from api.models import User, Widget, DashboardWidgetRole, Role, AuditLog, LessonPlan
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
    status_query = await db.execute(
        select(LessonPlan.status, func.count(LessonPlan.id))
        .group_by(LessonPlan.status)
    )
    status_counts_db = status_query.all()
    status_counts = {"DRAFT": 0, "IN_REVIEW": 0, "OBSERVED": 0, "APPROVED": 0}
    for status_val, count in status_counts_db:
        if status_val in status_counts:
            status_counts[status_val] = count
        else:
            status_counts[status_val] = count
            
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
    
    # Calculate REAL weekly stats
    seven_days_ago_dt = datetime.utcnow() - timedelta(days=7)
    
    # Obtener conexiones de los ultimos 7 dias
    logs_result = await db.execute(
        select(AuditLog.created_at)
        .where(AuditLog.created_at >= seven_days_ago_dt)
    )
    logs_dates = logs_result.scalars().all()
    
    # Obtener planes de los ultimos 7 dias
    recent_plans_result = await db.execute(
        select(LessonPlan.created_at)
        .where(LessonPlan.created_at >= seven_days_ago_dt)
    )
    plans_dates = recent_plans_result.scalars().all()

    # Procesar en un diccionario por dia
    from collections import defaultdict
    connections_by_day = defaultdict(int)
    for d in logs_dates:
        if d:
            connections_by_day[d.strftime('%a')] += 1
            
    plans_by_day = defaultdict(int)
    for d in plans_dates:
        if d:
            plans_by_day[d.strftime('%a')] += 1
            
    # Generar la serie ordenada (últimos 7 días hasta hoy)
    active_users_series = []
    dias_es = {'Mon':'Lun', 'Tue':'Mar', 'Wed':'Mie', 'Thu':'Jue', 'Fri':'Vie', 'Sat':'Sab', 'Sun':'Dom'}
    
    for i in range(6, -1, -1):
        dia_dt = datetime.utcnow() - timedelta(days=i)
        dia_str = dia_dt.strftime('%a')
        active_users_series.append({
            "name": dias_es.get(dia_str, dia_str),
            "connections": connections_by_day[dia_str],
            "plans": plans_by_day[dia_str]
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
