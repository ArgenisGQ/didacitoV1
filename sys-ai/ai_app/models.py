from django.db import models
from pgvector.django import VectorField


class CoreUser(models.Model):
    email = models.EmailField(max_length=255, unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50)

    class Meta:
        managed = False
        db_table = "plan_app_user"

class CoreAcademicPeriod(models.Model):
    name = models.CharField(max_length=100, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField()
    type = models.CharField(max_length=20)

    class Meta:
        managed = False
        db_table = "plan_app_academicperiod"

class CoreSubject(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    presentation = models.TextField(blank=True, null=True)
    purpose = models.TextField(blank=True, null=True)
    previous_competencies = models.TextField(blank=True, null=True)
    generic_competencies = models.TextField(blank=True, null=True)
    teaching_strategies = models.TextField(blank=True, null=True)
    eval_diagnostica = models.TextField(blank=True, null=True)
    eval_formativa = models.TextField(blank=True, null=True)
    eval_sumativa = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "plan_app_subject"

class CoreSubjectUnit(models.Model):
    subject = models.ForeignKey(CoreSubject, on_delete=models.DO_NOTHING, related_name="units")
    unit_number = models.CharField(max_length=50)
    unit_title = models.CharField(max_length=255, blank=True, null=True)
    contents = models.TextField(blank=True, null=True)
    performance_criteria = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "plan_app_subjectunit"

class CoreLessonPlan(models.Model):
    title = models.CharField(max_length=255)
    author = models.ForeignKey(CoreUser, on_delete=models.DO_NOTHING, related_name="authored_plans")
    status = models.CharField(max_length=20)
    subject_code = models.CharField(max_length=50, blank=True, null=True)
    section = models.CharField(max_length=50, blank=True, null=True)
    academic_period = models.ForeignKey(CoreAcademicPeriod, on_delete=models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = "plan_app_lessonplan"

class CoreEvaluationPlan(models.Model):
    lesson_plan = models.ForeignKey(CoreLessonPlan, on_delete=models.DO_NOTHING, related_name="evaluation_plans")
    unit = models.IntegerField(null=True, blank=True)
    competence = models.CharField(max_length=255, blank=True)
    strategy = models.CharField(max_length=255, blank=True)
    instrument = models.CharField(max_length=255, blank=True)
    evidence = models.CharField(max_length=255, blank=True)
    feedback_method = models.CharField(max_length=255, blank=True)
    weight = models.FloatField(null=True, blank=True)
    due_week = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "plan_app_evaluationplan"

class CoreWeeklyContent(models.Model):
    lesson_plan = models.ForeignKey(CoreLessonPlan, on_delete=models.DO_NOTHING, related_name="weekly_contents")
    week_number = models.IntegerField()
    content_description = models.TextField(blank=True)
    teaching_strategy = models.TextField(blank=True)
    resources = models.TextField(blank=True)
    bibliography = models.TextField(blank=True)

    class Meta:
        managed = False
        db_table = "plan_app_weeklycontent"

class CoreSyllabusVersion(models.Model):
    subject = models.ForeignKey(CoreSubject, on_delete=models.DO_NOTHING, related_name="syllabuses")
    version_number = models.IntegerField()
    extracted_text = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "plan_app_syllabusversion"

# --- Modelos Propios de sys-ai ---

class AIProvider(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="Nombre del proveedor (ej. OpenAI, DeepSeek)")
    provider_type = models.CharField(max_length=50, default='openai-compatible')
    base_url = models.CharField(max_length=255, blank=True, null=True, help_text="URL base de la API, útil para compatibles con OpenAI")
    api_key_encrypted = models.TextField(help_text="Clave de API cifrada")
    embedding_model = models.CharField(max_length=255, blank=True, null=True, help_text="Modelo para embeddings")
    llm_model = models.CharField(max_length=255, blank=True, null=True, help_text="Modelo LLM")
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_app_provider"

    @property
    def api_key(self):
        from .utils import decrypt_value
        return decrypt_value(self.api_key_encrypted)

    @api_key.setter
    def api_key(self, value):
        from .utils import encrypt_value
        self.api_key_encrypted = encrypt_value(value)

    def __str__(self):
        return f"{self.name} ({'Activo' if self.is_active else 'Inactivo'})"

class AgentTemplate(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)
    system_prompt = models.TextField(help_text="Instrucciones base (Directrices) que el agente seguirá para evaluar planes.")
    json_schema_output = models.JSONField(blank=True, null=True, help_text="Formato esperado de salida (schema JSON)")
    provider = models.ForeignKey(AIProvider, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_app_agent_template"

    def __str__(self):
        return f"{self.name} - Provider: {self.provider.name if self.provider else 'None'}"

class SyllabusChunk(models.Model):
    syllabus = models.ForeignKey(CoreSyllabusVersion, on_delete=models.CASCADE, related_name="chunks")
    chunk_index = models.IntegerField()
    content = models.TextField()
    # No limitamos la dimensión para que pueda soportar modelos de OpenAI (1536) o locales de LM Studio (ej. 1024 o 768).
    embedding = VectorField(help_text="Vector de embeddings del fragmento")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_app_syllabus_chunk"
        ordering = ['syllabus', 'chunk_index']

    def __str__(self):
        return f"Chunk {self.chunk_index} of Syllabus {self.syllabus_id}"

class LessonPlanChunk(models.Model):
    lesson_plan = models.ForeignKey(CoreLessonPlan, on_delete=models.CASCADE, related_name="chunks")
    chunk_index = models.IntegerField()
    content = models.TextField()
    # No limitamos la dimensión para que pueda soportar modelos de OpenAI (1536) o locales de LM Studio (ej. 1024 o 768).
    embedding = VectorField(help_text="Vector de embeddings del fragmento del plan")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_app_lessonplan_chunk"
        ordering = ['lesson_plan', 'chunk_index']

    def __str__(self):
        return f"Chunk {self.chunk_index} of LessonPlan {self.lesson_plan_id}"

class EvaluationResult(models.Model):
    lesson_plan = models.ForeignKey(CoreLessonPlan, on_delete=models.CASCADE, related_name="ai_evaluations")
    agent = models.ForeignKey(AgentTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=50, default="PENDING") # PENDING, SUCCESS, ERROR
    result_data = models.JSONField(blank=True, null=True, help_text="Respuesta estructurada del LLM")
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_app_evaluation_result"
        ordering = ['-created_at']

    def __str__(self):
        return f"Eval for Plan {self.lesson_plan_id} - {self.status}"

class AILog(models.Model):
    action = models.CharField(max_length=150, help_text="Acción realizada (ej. Prueba de Conexión, Vectorización)")
    status = models.CharField(max_length=50, help_text="Estado (ej. success, failed, started)")
    details = models.TextField(blank=True, null=True, help_text="Detalles o traza del error")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_app_ailog"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} - {self.status}"


