from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import StreamingResponse
from api.core.dependencies import get_current_user, check_role
from api.models import User, UserRole, AICopilotUsage, AcademicPeriod
from api.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
import os
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://sys-ai:8003")

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_to_ai_service(
    path: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Transparent API gateway proxy forwarding request to the sys-ai microservice.
    Enforces JWT authentication and roles.
    """
    # 1. Authorize role access
    is_copilot_path = path in ["suggest-objectives/", "suggest-weekly-content/", "suggest-evaluations/", "suggest-full-plan/", "agent-assignment-status/"]
    
    if path.startswith("admin/"):
        check_role(current_user, [UserRole.SUPER_ADMIN])
    elif is_copilot_path:
        # Permitir a Docentes usar el Copiloto Académico
        check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION, UserRole.COORDINADOR, UserRole.DOCENTE])
    else:
        check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION, UserRole.COORDINADOR])

    # 2. Build target URL with incoming query string
    url = f"{AI_SERVICE_URL}/{path}"
    if request.url.query:
        url += f"?{request.url.query}"

    # 3. Clean and prepare forwarding headers
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)  # Let httpx recalculate correctly

    # 4. Inject administrator audit headers
    headers["X-User-Id"] = str(current_user.id)
    headers["X-User-Email"] = current_user.email
    headers["X-User-Role"] = current_user.role

    client = httpx.AsyncClient(timeout=300.0) 

    try:
        body_content = await request.body()
        
        # Interceptar y validar consumo de Copiloto de IA si el rol es DOCENTE
        is_generation_path = path in ["suggest-objectives/", "suggest-weekly-content/", "suggest-evaluations/", "suggest-full-plan/"]
        
        copilot_usage_record = None
        
        if current_user.role == UserRole.DOCENTE and is_generation_path and request.method == "POST":
            try:
                body_data = json.loads(body_content) if body_content else {}
                subject_code = body_data.get("subject_code")
                section = body_data.get("section")
                academic_period_id = body_data.get("academic_period_id")
                
                if not subject_code or not section:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Faltan parámetros requeridos: subject_code y section."
                    )
                
                # Buscar periodo activo si no se especificó uno
                if not academic_period_id:
                    period_res = await db.execute(
                        select(AcademicPeriod).where(AcademicPeriod.is_active == True)
                    )
                    active_period = period_res.scalar_one_or_none()
                    if not active_period:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="No hay un período académico activo en el sistema."
                        )
                    academic_period_id = active_period.id
                
                # Consultar uso del Copiloto
                usage_res = await db.execute(
                    select(AICopilotUsage).where(
                        AICopilotUsage.user_id == current_user.id,
                        AICopilotUsage.academic_period_id == academic_period_id,
                        AICopilotUsage.subject_code == subject_code,
                        AICopilotUsage.section == section
                    )
                )
                copilot_usage_record = usage_res.scalar_one_or_none()
                
                attempts = copilot_usage_record.attempts_used if copilot_usage_record else 0
                if attempts >= 2:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Has alcanzado el límite de 2 sugerencias de IA para esta asignatura."
                    )
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cuerpo de solicitud inválido."
                )

        req = client.build_request(
            method=request.method,
            url=url,
            headers=headers,
            content=body_content
        )
        
        response = await client.send(req, stream=True)
        
        # Si la respuesta de sys-ai fue exitosa (200 OK) y es una llamada de Copiloto para Docente, incrementamos el contador
        if response.status_code == 200 and current_user.role == UserRole.DOCENTE and is_generation_path and request.method == "POST":
            # Consumir el stream para poder procesar la respuesta y el incremento
            # Para StreamingResponse, debemos tener cuidado de no romper el streaming.
            # En su lugar, podemos realizar el incremento de inmediato al recibir el estado 200 del servicio de IA
            if copilot_usage_record:
                copilot_usage_record.attempts_used += 1
            else:
                new_usage = AICopilotUsage(
                    user_id=current_user.id,
                    academic_period_id=academic_period_id,
                    subject_code=subject_code,
                    section=section,
                    attempts_used=1
                )
                db.add(new_usage)
            await db.commit()
            logger.info(f"Intento de Copiloto de IA registrado para {current_user.email} en {subject_code} - {section}")

        async def response_streamer():
            try:
                async for chunk in response.aiter_bytes():
                    yield chunk
            finally:
                await response.aclose()
                await client.aclose()
                
        # Forward safe headers
        resp_headers = dict(response.headers)
        for h in ["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]:
            resp_headers.pop(h, None)

        return StreamingResponse(
            response_streamer(),
            status_code=response.status_code,
            headers=resp_headers
        )
    except httpx.RequestError as exc:
        await client.aclose()
        logger.error(f"httpx RequestError connecting to sys-ai: {type(exc).__name__}: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Servicio AI inalcanzable: {str(exc)}"
        )
    except HTTPException as exc:
        await client.aclose()
        raise exc
    except Exception as exc:
        await client.aclose()
        logger.error(f"Exception connecting to sys-ai: {type(exc).__name__}: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en Proxy AI: {str(exc)}"
        )

