from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import engine

router = APIRouter(tags=["Health"])


@router.get("/")
async def root():
    return {
        "message": "Welcome to DIDACTICO API",
        "version": "2.0.0",
        "architecture": "Django (Migrations/Admin) + FastAPI (Async API)",
    }


@router.get("/health")
async def health_check():
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            result.fetchone()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "version": "2.0.0",
    }
