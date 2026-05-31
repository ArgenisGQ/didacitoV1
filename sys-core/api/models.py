from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Text, CheckConstraint, JSON, Date, Table
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from api.database import Base
from datetime import datetime, timezone
import enum


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN_GESTION = "ADMIN_GESTION"
    COORDINADOR = "COORDINADOR"
    DOCENTE = "DOCENTE"


class PlanStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    OBSERVED = "OBSERVED"
    APPROVED = "APPROVED"
    TEST = "PRUEBA"


class CatalogType(str, enum.Enum):
    FACULTY = "FACULTY"
    ACADEMIC_PROGRAM = "ACADEMIC_PROGRAM"
    MODALITY = "MODALITY"


role_permissions = Table(
    'plan_app_role_permissions',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('role_id', Integer, ForeignKey('plan_app_role.id')),
    Column('permission_id', Integer, ForeignKey('plan_app_permission.id'))
)

user_roles = Table(
    'plan_app_user_roles',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('plan_app_user.id')),
    Column('role_id', Integer, ForeignKey('plan_app_role.id'))
)

user_departments = Table(
    'plan_app_user_departments',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('plan_app_user.id')),
    Column('department_id', Integer, ForeignKey('plan_app_department.id'))
)


class Permission(Base):
    __tablename__ = "plan_app_permission"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    module_name = Column(String(100), nullable=False)


class Role(Base):
    __tablename__ = "plan_app_role"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    permissions = relationship("Permission", secondary=role_permissions, backref="roles")


class Widget(Base):
    __tablename__ = "plan_app_widget"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True)
    name = Column(String(255))
    description = Column(String)
    component_name = Column(String(100))


class DashboardWidgetRole(Base):
    __tablename__ = "plan_app_dashboard_widget_role"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("plan_app_role.id", ondelete="CASCADE"))
    widget_id = Column(Integer, ForeignKey("plan_app_widget.id", ondelete="CASCADE"))
    is_active = Column(Boolean, default=True)
    order = Column(Integer, default=0)

    role = relationship("Role", backref="dashboard_widgets")
    widget = relationship("Widget", backref="role_assignments")


class User(Base):
    """Reads the Django-managed plan_app_user table. Do NOT run create_all."""
    __tablename__ = "plan_app_user"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column("password", String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.DOCENTE)
    is_active = Column(Boolean, default=True)
    is_staff = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Asociación con departamentos (Para Coordinadores u otros roles departamentales)
    # department_id eliminado para usar relación muchos a muchos

    # Category A Security Fields
    mfa_secret = Column(String(32), nullable=True)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    lockout_until = Column(DateTime(timezone=True), nullable=True)
    deactivated_at = Column(DateTime(timezone=True), nullable=True)
    deactivation_reason = Column(Text, nullable=True)
    date_joined = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Nuevos campos de gobernanza curricular para docentes
    id_user = Column(String(50), unique=True, nullable=True)
    username = Column(String(150), unique=True, nullable=True)
    first_name = Column(String(150), nullable=True)
    last_name = Column(String(150), nullable=True)
    
    # El usuario conserva sus datos generales; su carga académica y periodos se administran en la tabla pivot UserAcademicPeriod.
    
    # Bandera para forzar cambio de clave en primer inicio de sesión
    needs_password_change = Column(Boolean, default=False, nullable=False)

    roles = relationship("Role", secondary=user_roles, backref="users")
    departments = relationship("Department", secondary=user_departments, backref="users")

    authored_plans = relationship(
        "LessonPlan", back_populates="author",
        foreign_keys="LessonPlan.author_id"
    )
    coordinated_plans = relationship(
        "LessonPlan", back_populates="coordinator",
        foreign_keys="LessonPlan.coordinator_id"
    )


class Catalog(Base):
    __tablename__ = "plan_app_catalog"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)


class Parameter(Base):
    __tablename__ = "plan_app_parameter"

    id = Column(Integer, primary_key=True, index=True)
    hd_hours = Column(Integer, nullable=False)
    hiv_hours = Column(Integer, nullable=False)
    hde_hours = Column(Integer, nullable=False)
    valid_from = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )


class LessonPlan(Base):
    __tablename__ = "plan_app_lessonplan"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    author_id = Column(Integer, ForeignKey("plan_app_user.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("plan_app_catalog.id"), nullable=True)
    status = Column(String(20), default=PlanStatus.DRAFT)
    coordinator_id = Column(Integer, ForeignKey("plan_app_user.id"), nullable=True)
    
    # Nuevos campos de vinculación curricular y periodo académico
    subject_code = Column(String(50), nullable=True, index=True)
    section = Column(String(50), nullable=True, index=True)
    academic_period_id = Column(Integer, ForeignKey("plan_app_academicperiod.id"), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    author = relationship(
        "User", back_populates="authored_plans",
        foreign_keys=[author_id]
    )

    @property
    def author_name(self):
        if self.author:
            if getattr(self.author, 'full_name', None):
                return self.author.full_name
            name = f"{getattr(self.author, 'first_name', '') or ''} {getattr(self.author, 'last_name', '') or ''}".strip()
            return name if name else getattr(self.author, 'email', 'Desconocido')
        return "Desconocido"

    coordinator = relationship(
        "User", back_populates="coordinated_plans",
        foreign_keys=[coordinator_id]
    )
    academic_period = relationship(
        "AcademicPeriod",
        foreign_keys=[academic_period_id]
    )
    evaluation_plans = relationship(
        "EvaluationPlan", back_populates="lesson_plan",
        cascade="all, delete-orphan"
    )
    weekly_contents = relationship(
        "WeeklyContent", back_populates="lesson_plan",
        cascade="all, delete-orphan"
    )


class EvaluationPlan(Base):
    __tablename__ = "plan_app_evaluationplan"

    id = Column(Integer, primary_key=True, index=True)
    lesson_plan_id = Column(
        Integer,
        ForeignKey("plan_app_lessonplan.id"),
        nullable=False
    )
    unit = Column(Integer)
    competence = Column(String(255))
    strategy = Column(String(255))
    instrument = Column(String(255))
    evidence = Column(String(255))
    feedback_method = Column(String(255))
    weight = Column(Float)
    due_week = Column(Integer)

    lesson_plan = relationship("LessonPlan", back_populates="evaluation_plans")


class WeeklyContent(Base):
    __tablename__ = "plan_app_weeklycontent"

    id = Column(Integer, primary_key=True, index=True)
    lesson_plan_id = Column(
        Integer,
        ForeignKey("plan_app_lessonplan.id"),
        nullable=False
    )
    week_number = Column(Integer, nullable=False)
    content_description = Column(Text)
    teaching_strategy = Column(Text)
    resources = Column(Text)
    bibliography = Column(Text)

    __table_args__ = (
        CheckConstraint(
            'week_number >= 1 AND week_number <= 12',
            name='check_week_number_range'
        ),
    )

    lesson_plan = relationship("LessonPlan", back_populates="weekly_contents")


class PasswordReset(Base):
    __tablename__ = "plan_app_password_resets"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )


class RefreshToken(Base):
    __tablename__ = "plan_app_refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("plan_app_user.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), unique=True, nullable=False)
    jti = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    parent_jti = Column(String(255), nullable=True)

    user = relationship("User", backref="refresh_tokens")


class SystemSetting(Base):
    __tablename__ = "plan_app_system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="GENERAL", index=True, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_by = Column("updated_by_id", Integer, ForeignKey("plan_app_user.id", ondelete="SET NULL"), nullable=True)

    updater = relationship("User", backref="updated_settings", foreign_keys=[updated_by])


class Invitation(Base):
    __tablename__ = "plan_app_invitations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False)
    token = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    user_id = Column(Integer, ForeignKey("plan_app_user.id", ondelete="CASCADE"), nullable=True)

    invited_user = relationship("User", backref="invitations", foreign_keys=[user_id])


class AuditLog(Base):
    __tablename__ = "plan_app_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("plan_app_user.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(60), index=True, nullable=False)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(String(255), nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )


class Subject(Base):
    __tablename__ = "plan_app_subject"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    document_code = Column(String(100), nullable=True)
    program = Column(String(255), nullable=True)
    level = Column(String(50), default="PREGRADO")
    identification_date = Column(Date, nullable=True)
    syllabus_version_year = Column(String(10), nullable=True)
    academic_credits = Column(Integer, default=0)
    had_hours = Column(Integer, default=0)
    hde_hours = Column(Integer, default=0)
    hts_hours = Column(Integer, default=0)
    academic_period = Column(Integer, nullable=True)
    prerequisite = Column(Text, nullable=True)
    presentation = Column(Text, nullable=True)
    purpose = Column(Text, nullable=True)
    previous_competencies = Column(Text, nullable=True)
    generic_competencies = Column(Text, nullable=True)
    relation_other_subjects = Column(Text, nullable=True)
    teaching_strategies = Column(Text, nullable=True)
    eval_diagnostica = Column(Text, nullable=True)
    eval_formativa = Column(Text, nullable=True)
    eval_sumativa = Column(Text, nullable=True)
    bibliographic_references = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), onupdate=lambda: datetime.now(timezone.utc))


class AcademicPeriod(Base):
    __tablename__ = "plan_app_academicperiod"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    type = Column(String(20), default="NORMAL", nullable=False)


class CreationMethod(str, enum.Enum):
    BULK = "BULK"
    MANUAL = "MANUAL"


class UserAcademicPeriod(Base):
    __tablename__ = "plan_app_user_academic_period"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("plan_app_user.id", ondelete="CASCADE"), nullable=False)
    academic_period_id = Column(Integer, ForeignKey("plan_app_academicperiod.id", ondelete="CASCADE"), nullable=False)
    subject_code = Column(Text, nullable=True)
    section = Column(Text, nullable=True)
    
    # Nuevos campos de auditoría e historial
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False
    )
    created_by_id = Column("created_by_id", Integer, ForeignKey("plan_app_user.id", ondelete="SET_NULL"), nullable=True)
    creation_method = Column(String(20), default=CreationMethod.MANUAL, nullable=False)

    user = relationship("User", backref=backref("academic_period_assignments", cascade="all, delete-orphan"), foreign_keys=[user_id])
    academic_period = relationship("AcademicPeriod", backref=backref("user_assignments", cascade="all, delete-orphan"))
    creator = relationship("User", backref="created_assignments", foreign_keys=[created_by_id])


class Faculty(Base):
    __tablename__ = "plan_app_faculty"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    careers = relationship("Career", back_populates="faculty")
    departments = relationship("Department", back_populates="faculty")


class Career(Base):
    __tablename__ = "plan_app_career"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    faculty_id = Column(Integer, ForeignKey("plan_app_faculty.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    faculty = relationship("Faculty", back_populates="careers")


class Department(Base):
    __tablename__ = "plan_app_department"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    faculty_id = Column(Integer, ForeignKey("plan_app_faculty.id", ondelete="CASCADE"), nullable=False)
    subject_codes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    faculty = relationship("Faculty", back_populates="departments")
