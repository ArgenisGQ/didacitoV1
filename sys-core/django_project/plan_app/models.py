from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Administrador"
    ADMIN_GESTION = "ADMIN_GESTION", "Administrador de Gestion"
    COORDINADOR = "COORDINADOR", "Coordinador"
    DOCENTE = "DOCENTE", "Docente"


class PlanStatus(models.TextChoices):
    DRAFT = "DRAFT", "Borrador"
    IN_REVIEW = "IN_REVIEW", "En Revision"
    OBSERVED = "OBSERVED", "Observado"
    APPROVED = "APPROVED", "Aprobado"
    TEST = "PRUEBA", "Prueba"


class CatalogType(models.TextChoices):
    FACULTY = "FACULTY", "Facultad"
    ACADEMIC_PROGRAM = "ACADEMIC_PROGRAM", "Programa Academico"
    MODALITY = "MODALITY", "Modalidad"


class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    module_name = models.CharField(max_length=100)

    class Meta:
        db_table = "plan_app_permission"
        verbose_name = "Permiso"
        verbose_name_plural = "Permisos"

    def __str__(self):
        return f"{self.code} - {self.name}"


class Role(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    permissions = models.ManyToManyField(Permission, related_name="roles", db_table="plan_app_role_permissions")

    class Meta:
        db_table = "plan_app_role"
        verbose_name = "Rol"
        verbose_name_plural = "Roles"

    def __str__(self):
        return self.name


class Widget(models.Model):
    code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    component_name = models.CharField(max_length=100)
    
    class Meta:
        db_table = "plan_app_widget"
        verbose_name = "Widget"
        verbose_name_plural = "Widgets"

    def __str__(self):
        return self.name


class DashboardWidgetRole(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="dashboard_widgets")
    widget = models.ForeignKey(Widget, on_delete=models.CASCADE, related_name="role_assignments")
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0)

    class Meta:
        db_table = "plan_app_dashboard_widget_role"
        unique_together = ("role", "widget")
        ordering = ["order"]
        verbose_name = "Widget por Rol"
        verbose_name_plural = "Widgets por Rol"

    def __str__(self):
        return f"{self.role.name} - {self.widget.name} ({'Activo' if self.is_active else 'Inactivo'})"


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("El email es obligatorio")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.SUPER_ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(max_length=255, unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(
        max_length=50,
        choices=UserRole.choices,
        default=UserRole.DOCENTE,
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    # Category A Security Fields
    mfa_secret = models.CharField(max_length=32, blank=True, null=True)
    mfa_enabled = models.BooleanField(default=False)
    failed_login_attempts = models.IntegerField(default=0)
    lockout_until = models.DateTimeField(blank=True, null=True)
    deactivated_at = models.DateTimeField(blank=True, null=True)
    deactivation_reason = models.TextField(blank=True, null=True)

    # Nuevos campos de gobernanza curricular para docentes
    id_user = models.CharField(max_length=50, unique=True, blank=True, null=True, verbose_name="Cédula")
    username = models.CharField(max_length=150, unique=True, blank=True, null=True, verbose_name="Usuario")
    first_name = models.CharField(max_length=150, blank=True, null=True)
    last_name = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Teléfono")
    
    # Asociación con departamentos para Coordinadores
    departments = models.ManyToManyField("Department", related_name="users", blank=True, verbose_name="Departamentos Asignados", db_table="plan_app_user_departments")
    
    # El usuario conserva sus datos generales; su carga académica y periodos se administran en la tabla pivot UserAcademicPeriod.
    
    # Bandera para forzar cambio de clave en primer inicio de sesión
    needs_password_change = models.BooleanField(default=False)
    
    roles = models.ManyToManyField(Role, related_name="users", db_table="plan_app_user_roles", blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        db_table = "plan_app_user"
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    def __str__(self):
        return self.email


class Catalog(models.Model):
    type = models.CharField(max_length=50, choices=CatalogType.choices)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "plan_app_catalog"
        verbose_name = "Catalogo"
        verbose_name_plural = "Catalogos"

    def __str__(self):
        return f"{self.get_type_display()}: {self.name}"


class Parameter(models.Model):
    hd_hours = models.IntegerField()
    hiv_hours = models.IntegerField()
    hde_hours = models.IntegerField()
    valid_from = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "plan_app_parameter"
        verbose_name = "Parametro Academico"
        verbose_name_plural = "Parametros Academicos"

    def __str__(self):
        return f"HD:{self.hd_hours} HIV:{self.hiv_hours} HDE:{self.hde_hours}"


class LessonPlan(models.Model):
    title = models.CharField(max_length=255)
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="authored_plans",
    )
    program = models.ForeignKey(
        Catalog,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lesson_plans",
    )
    status = models.CharField(
        max_length=20,
        choices=PlanStatus.choices,
        default=PlanStatus.DRAFT,
    )
    coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coordinated_plans",
    )
    
    # Nuevos campos para vincular la planificación a un curso y sección específicos del periodo académico
    subject_code = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    section = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    academic_period = models.ForeignKey(
        "AcademicPeriod",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="lesson_plans"
    )
    modality = models.CharField(max_length=50, blank=True, null=True)
    
    # Horas Override o copia del Subject para esta planificacion especifica
    hd_t = models.IntegerField(default=0, blank=True, null=True)
    hd_lt = models.IntegerField(default=0, blank=True, null=True)
    hd_iscp = models.IntegerField(default=0, blank=True, null=True)
    hiv_s = models.IntegerField(default=0, blank=True, null=True)
    hiv_a = models.IntegerField(default=0, blank=True, null=True)
    hde = models.IntegerField(default=0, blank=True, null=True)
    component_type = models.CharField(max_length=100, blank=True, null=True)
    feedback = models.TextField(blank=True, null=True)
    objectives = models.JSONField(blank=True, null=True)
    strategies = models.JSONField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "plan_app_lessonplan"
        verbose_name = "Plan de Clase"
        verbose_name_plural = "Planes de Clase"

    @property
    def author_name(self):
        if self.author:
            if getattr(self.author, 'full_name', None):
                return self.author.full_name
            name = f"{getattr(self.author, 'first_name', '') or ''} {getattr(self.author, 'last_name', '') or ''}".strip()
            return name if name else getattr(self.author, 'email', 'Desconocido')
        return "Desconocido"

    def __str__(self):
        return self.title


class EvaluationPlan(models.Model):
    lesson_plan = models.ForeignKey(
        LessonPlan,
        on_delete=models.CASCADE,
        related_name="evaluation_plans",
    )
    unit = models.IntegerField(null=True, blank=True)
    title = models.TextField(blank=True, null=True)
    competence = models.TextField(blank=True, null=True)
    performance_criterion = models.TextField(blank=True, null=True)
    strategy = models.TextField(blank=True, null=True)
    instrument = models.TextField(blank=True, null=True)
    evaluation_type = models.CharField(max_length=100, blank=True, null=True)
    evidence = models.TextField(blank=True, null=True)
    feedback_method = models.TextField(blank=True, null=True)
    weight = models.FloatField(null=True, blank=True)
    due_week = models.IntegerField(null=True, blank=True)
    due_date = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        db_table = "plan_app_evaluationplan"
        verbose_name = "Plan de Evaluacion"
        verbose_name_plural = "Planes de Evaluacion"

    def __str__(self):
        return f"Evaluacion #{self.id} - Plan #{self.lesson_plan_id}"


class WeeklyContent(models.Model):
    lesson_plan = models.ForeignKey(
        LessonPlan,
        on_delete=models.CASCADE,
        related_name="weekly_contents",
    )
    week_number = models.IntegerField()
    unit_content = models.CharField(max_length=255, blank=True, null=True)
    content_description = models.TextField(blank=True)
    specific_competence = models.TextField(blank=True, null=True)
    performance_criteria = models.TextField(blank=True, null=True)
    teaching_strategy = models.TextField(blank=True)
    evaluation_feedback = models.TextField(blank=True, null=True)
    resources = models.TextField(blank=True)
    bibliography = models.TextField(blank=True)

    class Meta:
        db_table = "plan_app_weeklycontent"
        verbose_name = "Contenido Semanal"
        verbose_name_plural = "Contenidos Semanales"
        constraints = [
            models.CheckConstraint(
                check=models.Q(week_number__gte=1) & models.Q(week_number__lte=18),
                name="check_week_number_range",
            )
        ]

    def __str__(self):
        return f"Semana {self.week_number} - Plan #{self.lesson_plan_id}"


class PasswordReset(models.Model):
    jti = models.CharField(max_length=255, unique=True, db_index=True)
    email = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "plan_app_password_resets"
        verbose_name = "Password Reset"
        verbose_name_plural = "Password Resets"

    def __str__(self):
        return f"Reset {self.email} - used: {self.used}"


class RefreshToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="refresh_tokens")
    token_hash = models.CharField(max_length=255, unique=True)
    jti = models.CharField(max_length=255, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    is_revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    parent_jti = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = "plan_app_refresh_tokens"
        verbose_name = "Refresh Token"
        verbose_name_plural = "Refresh Tokens"

    def __str__(self):
        return f"RefreshToken {self.jti} - user: {self.user.email}"


class SystemSetting(models.Model):
    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.TextField()
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=50, default="GENERAL", db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True)

    class Meta:
        db_table = "plan_app_system_settings"
        verbose_name = "Configuracion de Sistema"
        verbose_name_plural = "Configuraciones de Sistema"

    def __str__(self):
        return f"{self.key}: {self.value}"


class Invitation(models.Model):
    email = models.CharField(max_length=255, unique=True)
    token = models.TextField()
    expires_at = models.DateTimeField()
    is_revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="invitations", blank=True, null=True)

    class Meta:
        db_table = "plan_app_invitations"
        verbose_name = "Invitacion"
        verbose_name_plural = "Invitaciones"

    def __str__(self):
        return f"Invitacion {self.email} - is_revoked: {self.is_revoked}"


class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True)
    action = models.CharField(max_length=60, db_index=True)
    ip_address = models.CharField(max_length=45)
    user_agent = models.CharField(max_length=255)
    details = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "plan_app_audit_logs"
        verbose_name = "Log de Auditoria"
        verbose_name_plural = "Logs de Auditoria"

    def __str__(self):
        return f"{self.action} by {self.user.email if self.user else 'System'} at {self.created_at}"


class Subject(models.Model):
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    document_code = models.CharField(max_length=100, blank=True, null=True)
    program = models.CharField(max_length=255, blank=True, null=True)
    level = models.CharField(max_length=50, default="PREGRADO")
    identification_date = models.DateField(blank=True, null=True)
    syllabus_version_year = models.CharField(max_length=10, blank=True, null=True)
    academic_credits = models.IntegerField(default=0)
    had_hours = models.IntegerField(default=0)
    hd_t = models.IntegerField(default=0)
    hd_lt = models.IntegerField(default=0)
    hd_iscp = models.IntegerField(default=0)
    hde_hours = models.IntegerField(default=0)
    hts_hours = models.IntegerField(default=0)
    hiv_s = models.IntegerField(default=0)
    hiv_a = models.IntegerField(default=0)
    component_type = models.CharField(max_length=100, blank=True, null=True)
    academic_period = models.IntegerField(blank=True, null=True)
    prerequisite = models.TextField(blank=True, null=True)
    presentation = models.TextField(blank=True, null=True)
    purpose = models.TextField(blank=True, null=True)
    previous_competencies = models.TextField(blank=True, null=True)
    generic_competencies = models.TextField(blank=True, null=True)
    relation_other_subjects = models.TextField(blank=True, null=True)
    teaching_strategies = models.TextField(blank=True, null=True)
    eval_diagnostica = models.TextField(blank=True, null=True)
    eval_formativa = models.TextField(blank=True, null=True)
    eval_sumativa = models.TextField(blank=True, null=True)
    bibliographic_references = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "plan_app_subject"
        verbose_name = "Materia"
        verbose_name_plural = "Materias"

    def __str__(self):
        return f"{self.code} - {self.name}"


class SubjectUnit(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="units")
    unit_number = models.CharField(max_length=50)
    unit_title = models.CharField(max_length=512, blank=True, null=True)
    contents = models.TextField(blank=True, null=True)
    performance_criteria = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "plan_app_subjectunit"
        verbose_name = "Unidad de Aprendizaje"
        verbose_name_plural = "Unidades de Aprendizaje"

    def __str__(self):
        return f"{self.unit_number} - {self.subject.code}"


class SubjectCorrespondence(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="correspondences")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    requirements = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        db_table = "plan_app_subjectcorrespondence"
        verbose_name = "Correspondencia de Materia"
        verbose_name_plural = "Correspondencias de Materias"

    def __str__(self):
        return f"{self.code} equivalencia a {self.subject.code}"


class SyllabusVersion(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="syllabuses")
    version_number = models.IntegerField(default=1)
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=512)
    file_hash = models.CharField(max_length=64, unique=True, db_index=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="uploaded_syllabuses")
    extracted_text = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "plan_app_syllabusversion"
        verbose_name = "Version de Programa Sinoptico"
        verbose_name_plural = "Versiones de Programas Sinopticos"

    def __str__(self):
        return f"{self.subject.code} v{self.version_number} - Active: {self.is_active}"


class PeriodType(models.TextChoices):
    NORMAL = "NORMAL", "Periodo Normal"
    INTENSIVO = "INTENSIVO", "Periodo Intensivo"


class AcademicPeriod(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="Nombre del Periodo")
    start_date = models.DateField(verbose_name="Fecha de Inicio")
    end_date = models.DateField(verbose_name="Fecha de Fin")
    is_active = models.BooleanField(default=False, verbose_name="Vigente")
    type = models.CharField(
        max_length=20,
        choices=PeriodType.choices,
        default=PeriodType.NORMAL,
        verbose_name="Tipo de Periodo"
    )

    class Meta:
        db_table = "plan_app_academicperiod"
        verbose_name = "Periodo Academico"
        verbose_name_plural = "Periodos Academicos"

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class CreationMethod(models.TextChoices):
    BULK = "BULK", "Carga por Lote"
    MANUAL = "MANUAL", "Individual"


class UserAcademicPeriod(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="academic_period_assignments")
    academic_period = models.ForeignKey(AcademicPeriod, on_delete=models.CASCADE, related_name="user_assignments")
    subject_code = models.TextField(blank=True, null=True)
    section = models.TextField(blank=True, null=True)
    
    # Auditoría, control de activación y método de carga
    is_active = models.BooleanField(default=True, verbose_name="Activo en este periodo")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="Fecha de asignación")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_assignments",
        verbose_name="Asignado por"
    )
    creation_method = models.CharField(
        max_length=20,
        choices=CreationMethod.choices,
        default=CreationMethod.MANUAL,
        verbose_name="Método de Creación"
    )

    class Meta:
        db_table = "plan_app_user_academic_period"
        unique_together = ("user", "academic_period")
        verbose_name = "Relación Usuario - Periodo Académico"
        verbose_name_plural = "Relaciones Usuario - Periodos Académicos"

    def __str__(self):
        return f"{self.user.email} en {self.academic_period.name}"


class Faculty(models.Model):
    name = models.CharField(max_length=255, verbose_name="Nombre de Facultad")
    code = models.CharField(max_length=50, unique=True, db_index=True, verbose_name="Código de Facultad")
    is_active = models.BooleanField(default=True, verbose_name="Vigente")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "plan_app_faculty"
        verbose_name = "Facultad"
        verbose_name_plural = "Facultades"

    def __str__(self):
        return f"{self.code} - {self.name}"


class Career(models.Model):
    name = models.CharField(max_length=255, verbose_name="Nombre de Carrera")
    code = models.CharField(max_length=50, unique=True, db_index=True, verbose_name="Código de Carrera")
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name="careers", verbose_name="Facultad")
    is_active = models.BooleanField(default=True, verbose_name="Vigente")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "plan_app_career"
        verbose_name = "Carrera"
        verbose_name_plural = "Carreras"

    def __str__(self):
        return f"{self.code} - {self.name} ({self.faculty.code})"


class Department(models.Model):
    name = models.CharField(max_length=255, verbose_name="Nombre de Departamento")
    code = models.CharField(max_length=50, unique=True, db_index=True, verbose_name="Código de Departamento")
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name="departments", verbose_name="Facultad")
    subject_codes = models.TextField(blank=True, null=True, verbose_name="Códigos de Cursos Relacionados", help_text="Separados por coma")
    is_active = models.BooleanField(default=True, verbose_name="Vigente")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "plan_app_department"
        verbose_name = "Departamento"
        verbose_name_plural = "Departamentos"

    def __str__(self):
        return f"{self.code} - {self.name} ({self.faculty.code})"


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    lesson_plan_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "plan_app_notification"
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notif #{self.id} for {self.user.email} - Read: {self.is_read}"

