from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import logging

logger = logging.getLogger(__name__)

from api.routers import health, auth, plans, users, admin, syllabus_proxy
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from api.core.limiter import limiter



is_prod = os.getenv("APP_ENV", "local") == "production"
enable_docs = os.getenv("ENABLE_DOCS", "false").lower() == "true"
show_docs = not is_prod or enable_docs

app = FastAPI(
    title="DIDACTICO API",
    version="2.0.0",
    description="FastAPI async endpoints for DIDACTICO.",
    docs_url="/docs" if show_docs else None,
    redoc_url="/redoc" if show_docs else None,
    openapi_url="/openapi.json" if show_docs else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.on_event("startup")
async def startup_event():
    import asyncio
    from api.core.settings_manager import SettingsManager
    from api.core.scheduler import run_daily_inactivity_cleanup
    try:
        await SettingsManager.initialize()
        logger.info("SettingsManager initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize SettingsManager on startup: {e}. App will continue without cached settings.")
    asyncio.create_task(run_daily_inactivity_cleanup())



ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost,http://127.0.0.1,http://localhost:5173,http://localhost:80"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(plans.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(syllabus_proxy.router, prefix="/syllabus", tags=["Syllabus"])


