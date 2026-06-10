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
    role: Optional[str] = None
    roles: List[str] = []


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    academic_period_id: Optional[int] = None
    department_ids: List[int] = []
    subject_code: Optional[str] = None
    section: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    roles: Optional[List[str]] = None
    password: Optional[str] = Field(None, min_length=6)
    is_active: Optional[bool] = None
    academic_period_id: Optional[int] = None
    department_ids: Optional[List[int]] = None
    subject_code: Optional[str] = None
    section: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: Optional[str] = None
    roles: List[str] = []
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
    phone: Optional[str] = None
    subject_code: Optional[str] = None
    section: Optional[str] = None
    academic_period: Optional[str] = None
    academic_period_id: Optional[int] = None
    department_ids: List[int] = []
    needs_password_change: bool = False
    
    # Period-specific relation attributes (from pivot table UserAcademicPeriod)
    period_is_active: Optional[bool] = None
    period_created_at: Optional[datetime] = None
    period_created_by_email: Optional[str] = None
    period_creation_method: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Weekly Content Schemas
# ---------------------------------------------------------------------------
class WeeklyContentBase(BaseModel):
    week_number: int = Field(..., ge=1, le=18)
    unit_content: Optional[str] = None
    content_description: Optional[str] = None
    specific_competence: Optional[str] = None
    performance_criteria: Optional[str] = None
    teaching_strategy: Optional[str] = None
    evaluation_feedback: Optional[str] = None
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
    title: Optional[str] = None
    competence: Optional[str] = None
    performance_criterion: Optional[str] = None
    strategy: Optional[str] = None
    instrument: Optional[str] = None
    evaluation_type: Optional[str] = None
    evidence: Optional[str] = None
    feedback_method: Optional[str] = None
    weight: Optional[float] = None
    due_week: Optional[int] = None
    due_date: Optional[str] = None


class EvaluationPlanResponse(EvaluationPlanBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Lesson Plan Schemas
# ---------------------------------------------------------------------------
class LessonPlanCreate(BaseModel):
    title: str
    subject_code: Optional[str] = None
    section: Optional[str] = None
    academic_period_id: Optional[int] = None
    modality: Optional[str] = None
    status: Optional[PlanStatus] = None
    
    # Horas override
    hd_t: Optional[int] = 0
    hd_lt: Optional[int] = 0
    hd_iscp: Optional[int] = 0
    hiv_s: Optional[int] = 0
    hiv_a: Optional[int] = 0
    hde: Optional[int] = 0
    component_type: Optional[str] = None

    objectives: Optional[List[str]] = None
    strategies: Optional[List[str]] = None
    evaluation_plans: Optional[List[EvaluationPlanBase]] = None
    weekly_contents: Optional[List[WeeklyContentBase]] = None


class LessonPlanUpdate(BaseModel):
    title: Optional[str] = None
    program_id: Optional[int] = None
    status: Optional[PlanStatus] = None
    evaluation_plans: Optional[List[EvaluationPlanBase]] = None
    weekly_contents: Optional[List[WeeklyContentBase]] = None
    subject_code: Optional[str] = None
    section: Optional[str] = None
    academic_period_id: Optional[int] = None
    modality: Optional[str] = None
    
    # Horas override
    hd_t: Optional[int] = None
    hd_lt: Optional[int] = None
    hd_iscp: Optional[int] = None
    hiv_s: Optional[int] = None
    hiv_a: Optional[int] = None
    hde: Optional[int] = None
    component_type: Optional[str] = None

    objectives: Optional[List[str]] = None
    strategies: Optional[List[str]] = None


class LessonPlanResponse(BaseModel):
    id: int
    title: str
    author_id: int
    author_name: Optional[str] = None
    program_id: Optional[int] = None
    status: str
    objectives: Optional[List[str]] = None
    strategies: Optional[List[str]] = None
    coordinator_id: Optional[int] = None
    subject_code: Optional[str] = None
    section: Optional[str] = None
    academic_period_id: Optional[int] = None
    modality: Optional[str] = None
    
    # Horas
    hd_t: Optional[int] = 0
    hd_lt: Optional[int] = 0
    hd_iscp: Optional[int] = 0
    hiv_s: Optional[int] = 0
    hiv_a: Optional[int] = 0
    hde: Optional[int] = 0
    component_type: Optional[str] = None
    
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    evaluation_plans: List[EvaluationPlanResponse] = []
    weekly_contents: List[WeeklyContentResponse] = []
    
    subject_purpose: Optional[str] = None
    pre_requisite: Optional[str] = None
    total_hours: Optional[int] = None
    program: Optional[str] = None

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
    roles: List[str] = []
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
    role: Optional[str] = None
    roles: List[str] = []
    username: Optional[str] = None
    id_user: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    subject_code: Optional[str] = None
    section: Optional[str] = None
    academic_period: Optional[str] = None
    academic_period_id: Optional[int] = None


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
    user_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class FacultyBase(BaseModel):
    name: str
    code: str
    is_active: bool = True

class FacultyCreate(FacultyBase):
    pass

class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None

class FacultyResponse(FacultyBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class CareerBase(BaseModel):
    name: str
    code: str
    faculty_id: int
    is_active: bool = True

class CareerCreate(CareerBase):
    pass

class CareerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    faculty_id: Optional[int] = None
    is_active: Optional[bool] = None

class CareerResponse(CareerBase):
    id: int
    faculty_code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class DepartmentBase(BaseModel):
    name: str
    code: str
    faculty_id: int
    subject_codes: Optional[str] = None
    is_active: bool = True

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    faculty_id: Optional[int] = None
    subject_codes: Optional[str] = None
    is_active: Optional[bool] = None

class DepartmentResponse(DepartmentBase):
    id: int
    faculty_code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class SubjectBase(BaseModel):
    code: str
    name: str
    program: Optional[str] = None
    level: Optional[str] = None
    academic_credits: Optional[int] = 0
    had_hours: Optional[int] = 0
    hd_t: Optional[int] = 0
    hd_lt: Optional[int] = 0
    hd_iscp: Optional[int] = 0
    hde_hours: Optional[int] = 0
    hts_hours: Optional[int] = 0
    hiv_s: Optional[int] = 0
    hiv_a: Optional[int] = 0
    component_type: Optional[str] = None
    purpose: Optional[str] = None
    prerequisite: Optional[str] = None
    presentation: Optional[str] = None
    previous_competencies: Optional[str] = None
    generic_competencies: Optional[str] = None
    relation_other_subjects: Optional[str] = None
    teaching_strategies: Optional[str] = None
    eval_diagnostica: Optional[str] = None
    eval_formativa: Optional[str] = None
    eval_sumativa: Optional[str] = None
    bibliographic_references: Optional[str] = None

class SubjectResponse(SubjectBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
