from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import StreamingResponse
from api.core.dependencies import get_current_user, check_role
from api.models import User, UserRole
import httpx
import os

router = APIRouter()

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://sys-ai:8003")

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_to_ai_service(
    path: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Transparent API gateway proxy forwarding request to the sys-ai microservice.
    Enforces JWT authentication and roles: SUPER_ADMIN for configuration.
    """
    # 1. Authorize role access
    # AI settings are strict to SUPER_ADMIN. If we need to let other roles view things, we check method.
    if path.startswith("admin/"):
        check_role(current_user, [UserRole.SUPER_ADMIN])
    else:
        # Endpoints like viewing analysis results can be accessible to coordinators or admins
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

    client = httpx.AsyncClient(timeout=60.0) 

    try:
        body_content = await request.body()
        
        req = client.build_request(
            method=request.method,
            url=url,
            headers=headers,
            content=body_content
        )
        
        response = await client.send(req, stream=True)
        
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
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Servicio AI inalcanzable: {str(exc)}"
        )
    except Exception as exc:
        await client.aclose()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en Proxy AI: {str(exc)}"
        )
