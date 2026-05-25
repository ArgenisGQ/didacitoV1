from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.responses import StreamingResponse
from api.core.dependencies import get_current_user, check_role
from api.models import User, UserRole
import httpx

router = APIRouter()

SYLLABUS_SERVICE_URL = "http://syllabus-service:8002"

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_to_syllabus_service(
    path: str,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Transparent API gateway proxy forwarding request to the syllabus-service microservice.
    Enforces JWT authentication and roles: SUPER_ADMIN and ADMIN_GESTION.
    Injects custom header fields detailing the actor's system attributes.
    """
    # 1. Authorize role access
    if request.method != "GET":
        check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION])
    else:
        check_role(current_user, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GESTION, UserRole.COORDINADOR, UserRole.DOCENTE])

    # 2. Build target URL with incoming query string
    url = f"{SYLLABUS_SERVICE_URL}/{path}"
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

    client = httpx.AsyncClient(timeout=600.0) # Long timeout for zip uploads/processing

    try:
        # Read request body content (safe for PDFs and ZIP archives under ~50MB)
        body_content = await request.body()
        
        # Build and send proxy request
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
            detail=f"Servicio Syllabus inalcanzable: {str(exc)}"
        )
    except Exception as exc:
        await client.aclose()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en Proxy Syllabus: {str(exc)}"
        )
