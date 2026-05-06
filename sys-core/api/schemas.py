from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from api.models import UserRole, PlanStatus


# ---------------------------------------------------------------------------
# User Schemas (aligned with Django's plan_app_user table)
# ---------------------------------------------------------------------------
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.DOCENTE


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    password: Optional[str] = Field(None, min_length=6)


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    is_staff: bool
    is_superuser: bool
    last_login: Optional[datetime] = None
    date_joined: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Weekly Content Schemas
# ---------------------------------------------------------------------------
class WeeklyContentBase(BaseModel):
    week_number: int = Field(..., ge=1, le=12)
    content_description: Optional[str] = None
    teaching_strategy: Optional[str] = None
    resources: Optional[str] = None
    bibliography: Optional[str] = None


class WeeklyContentResponse(WeeklyContentBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Evaluation Plan Schemas
# ---------------------------------------------------------------------------
class EvaluationPlanBase(BaseModel):
    unit: Optional[int] = None
    competence: Optional[str] = None
    strategy: Optional[str] = None
    instrument: Optional[str] = None
    evidence: Optional[str] = None
    feedback_method: Optional[str] = None
    weight: Optional[float] = None
    due_week: Optional[int] = None


class EvaluationPlanResponse(EvaluationPlanBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Lesson Plan Schemas
# ---------------------------------------------------------------------------
class LessonPlanCreate(BaseModel):
    title: str


class LessonPlanUpdate(BaseModel):
    title: Optional[str] = None
    program_id: Optional[int] = None
    status: Optional[PlanStatus] = None
    evaluation_plans: Optional[List[EvaluationPlanBase]] = None
    weekly_contents: Optional[List[WeeklyContentBase]] = None


class LessonPlanResponse(BaseModel):
    id: int
    title: str
    author_id: int
    program_id: Optional[int] = None
    status: str
    coordinator_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    evaluation_plans: List[EvaluationPlanResponse] = []
    weekly_contents: List[WeeklyContentResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Auth Schemas
# ---------------------------------------------------------------------------
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str
