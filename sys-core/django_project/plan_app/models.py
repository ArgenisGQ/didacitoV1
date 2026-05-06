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


class CatalogType(models.TextChoices):
    FACULTY = "FACULTY", "Facultad"
    ACADEMIC_PROGRAM = "ACADEMIC_PROGRAM", "Programa Academico"
    MODALITY = "MODALITY", "Modalidad"


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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "plan_app_lessonplan"
        verbose_name = "Plan de Clase"
        verbose_name_plural = "Planes de Clase"

    def __str__(self):
        return self.title


class EvaluationPlan(models.Model):
    lesson_plan = models.ForeignKey(
        LessonPlan,
        on_delete=models.CASCADE,
        related_name="evaluation_plans",
    )
    unit = models.IntegerField(null=True, blank=True)
    competence = models.CharField(max_length=255, blank=True)
    strategy = models.CharField(max_length=255, blank=True)
    instrument = models.CharField(max_length=255, blank=True)
    evidence = models.CharField(max_length=255, blank=True)
    feedback_method = models.CharField(max_length=255, blank=True)
    weight = models.FloatField(null=True, blank=True)
    due_week = models.IntegerField(null=True, blank=True)

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
    content_description = models.TextField(blank=True)
    teaching_strategy = models.TextField(blank=True)
    resources = models.TextField(blank=True)
    bibliography = models.TextField(blank=True)

    class Meta:
        db_table = "plan_app_weeklycontent"
        verbose_name = "Contenido Semanal"
        verbose_name_plural = "Contenidos Semanales"
        constraints = [
            models.CheckConstraint(
                check=models.Q(week_number__gte=1) & models.Q(week_number__lte=12),
                name="check_week_number_range",
            )
        ]

    def __str__(self):
        return f"Semana {self.week_number} - Plan #{self.lesson_plan_id}"
