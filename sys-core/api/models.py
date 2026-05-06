from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Text, CheckConstraint
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
    date_joined = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

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
