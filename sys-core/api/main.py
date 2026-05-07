from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from api.routers import health, auth, plans, users

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
