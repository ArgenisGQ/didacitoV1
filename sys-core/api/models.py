from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Text, CheckConstraint, JSON, Date
from sqlalchemy.orm import relationship
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


class CatalogType(str, enum.Enum):
    FACULTY = "FACULTY"
    ACADEMIC_PROGRAM = "ACADEMIC_PROGRAM"
    MODALITY = "MODALITY"


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
    
    # Relación lógica por código de materia con Subject
    subject_code = Column(Text, ForeignKey("plan_app_subject.code"), nullable=True)
    subject = relationship(
        "Subject",
        primaryjoin="User.subject_code == Subject.code",
        foreign_keys=[subject_code],
        backref="teachers"
    )
    
    section = Column(Text, nullable=True)
    academic_period = Column(Text, nullable=True)
    
    # Bandera para forzar cambio de clave en primer inicio de sesión
    needs_password_change = Column(Boolean, default=False, nullable=False)

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
    coordinator = relationship(
        "User", back_populates="coordinated_plans",
        foreign_keys=[coordinator_id]
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


