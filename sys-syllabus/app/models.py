from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "plan_app_user"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)


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
    
    # Missing fields from Django migrations
    component_type = Column(String(100), nullable=True)
    hd_iscp = Column(Integer, default=0, nullable=False)
    hd_lt = Column(Integer, default=0, nullable=False)
    hd_t = Column(Integer, default=0, nullable=False)
    hiv_a = Column(Integer, default=0, nullable=False)
    hiv_s = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    units = relationship("SubjectUnit", back_populates="subject", cascade="all, delete-orphan", lazy="selectin")
    correspondences = relationship("SubjectCorrespondence", back_populates="subject", cascade="all, delete-orphan", lazy="selectin")
    syllabuses = relationship("SyllabusVersion", back_populates="subject", cascade="all, delete-orphan", lazy="selectin")


class SubjectUnit(Base):
    __tablename__ = "plan_app_subjectunit"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("plan_app_subject.id", ondelete="CASCADE"), nullable=False)
    unit_number = Column(String(50), nullable=False)
    unit_title = Column(String(255), nullable=True)
    contents = Column(Text, nullable=True)
    performance_criteria = Column(Text, nullable=True)

    subject = relationship("Subject", back_populates="units")


class SubjectCorrespondence(Base):
    __tablename__ = "plan_app_subjectcorrespondence"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("plan_app_subject.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    requirements = Column(String(255), nullable=True)

    subject = relationship("Subject", back_populates="correspondences")


class SyllabusVersion(Base):
    __tablename__ = "plan_app_syllabusversion"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("plan_app_subject.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, default=1, nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_hash = Column(String(64), unique=True, index=True, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    uploaded_by_id = Column(Integer, ForeignKey("plan_app_user.id", ondelete="SET NULL"), nullable=True)
    extracted_text = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    subject = relationship("Subject", back_populates="syllabuses")
    uploaded_by = relationship("User")

class Faculty(Base):
    __tablename__ = "plan_app_faculty"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)


class Career(Base):
    __tablename__ = "plan_app_career"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    faculty_id = Column(Integer, ForeignKey("plan_app_faculty.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)
