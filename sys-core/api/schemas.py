from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import List, Optional, Any
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
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    is_staff: bool
    is_superuser: bool
    mfa_enabled: bool = False
    last_login: Optional[datetime] = None
    date_joined: Optional[datetime] = None
    id_user: Optional[str] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    subject_code: Optional[str] = None
    section: Optional[str] = None
    academic_period: Optional[str] = None
    needs_password_change: bool = False

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


class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    mfa_required: bool = False
    mfa_token: Optional[str] = None
    needs_password_change: bool = False
    temp_token: Optional[str] = None


class TeacherFirstPasswordChangeRequest(BaseModel):
    temp_token: str
    new_password: str = Field(..., min_length=6)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ValidateTokenRequest(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=6)


class MFASetupResponse(BaseModel):
    qr_code_base64: str
    secret: str


class MFAVerifyRequest(BaseModel):
    token: str


class MFATokenLoginRequest(BaseModel):
    mfa_token: str
    code: str


# ---------------------------------------------------------------------------
# Category B - Governance and Admin Schemas
# ---------------------------------------------------------------------------
class SystemSettingResponse(BaseModel):
    id: int
    key: str
    value: str
    description: Optional[str] = None
    category: str
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SystemSettingUpdate(BaseModel):
    value: str


class InvitationCreate(BaseModel):
    email: EmailStr


class InvitationResponse(BaseModel):
    id: int
    email: str
    expires_at: datetime
    is_revoked: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AccountActivationRequest(BaseModel):
    token: str
    password: str


class BulkImportRowPreview(BaseModel):
    row_num: int
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    status: str  # "VALID" or "INVALID"
    errors: List[str] = []
    warnings: List[str] = []
    username: Optional[str] = None
    id_user: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    subject_code: Optional[str] = None
    section: Optional[str] = None
    academic_period: Optional[str] = None


class BulkImportPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    rows: List[BulkImportRowPreview]


class BulkImportRowInput(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    username: Optional[str] = None
    id_user: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    subject_code: Optional[str] = None
    section: Optional[str] = None
    academic_period: Optional[str] = None


class BulkImportConfirmRequest(BaseModel):
    users: List[BulkImportRowInput]
    activation_method: Optional[str] = "activate"  # "activate" or "invite"


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    ip_address: str
    user_agent: str
    details: Optional[Any] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserInactivityResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    last_login: Optional[datetime] = None
    days_inactive: int


# ---------------------------------------------------------------------------
# Academic Period Schemas
# ---------------------------------------------------------------------------
from datetime import date

class AcademicPeriodBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: bool = False
    type: str = "NORMAL"

class AcademicPeriodCreate(AcademicPeriodBase):
    pass

class AcademicPeriodUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    type: Optional[str] = None

class AcademicPeriodResponse(AcademicPeriodBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
