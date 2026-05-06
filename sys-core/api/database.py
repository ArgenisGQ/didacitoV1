import os
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://user:password@localhost:5432/planning_db"
)

# FastAPI connects directly to the same DB that Django manages.
# Tables are created by Django migrations -- FastAPI never runs create_all.
engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency injector for linear HTTP requests"""
    async with AsyncSessionLocal() as session:
        yield session

@asynccontextmanager
async def get_task_db():
    """Context manager for concurrent asyncio tasks (e.g., asyncio.gather).
    Usage: async with get_task_db() as session: ...
    """
    async with AsyncSessionLocal() as session:
        yield session
