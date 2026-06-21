from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from pgvector.django import VectorField
from django.contrib.postgres.search import SearchVectorField


class CoreUser(models.Model):
    email = models.EmailField(max_length=255, unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50)
    id_user = models.CharField(max_length=50, unique=True, blank=True, null=True)

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

class CoreUserAcademicPeriod(models.Model):
    user = models.ForeignKey(CoreUser, on_delete=models.DO_NOTHING, related_name="academic_period_assignments")
    academic_period = models.ForeignKey(CoreAcademicPeriod, on_delete=models.DO_NOTHING, related_name="user_assignments")
    subject_code = models.TextField(blank=True, null=True)
    section = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "plan_app_user_academic_period"

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
    coordinator = models.ForeignKey(CoreUser, on_delete=models.DO_NOTHING, related_name="coordinated_plans", null=True, blank=True)
    feedback = models.TextField(blank=True, null=True)

    @property
    def author_name(self):
        if self.author:
            return self.author.full_name
        return "Docente"

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


class CoreFaculty(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "plan_app_faculty"


class CoreDepartment(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    faculty = models.ForeignKey(CoreFaculty, on_delete=models.DO_NOTHING)
    subject_codes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "plan_app_department"


class CoreCareer(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    faculty = models.ForeignKey(CoreFaculty, on_delete=models.DO_NOTHING)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "plan_app_career"


class CoreNotification(models.Model):
    user = models.ForeignKey(CoreUser, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    lesson_plan_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = "plan_app_notification"


# --- Modelos Propios de sys-ai ---

class AIProvider(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="Nombre del proveedor (ej. OpenAI, DeepSeek)")
    provider_type = models.CharField(max_length=50, default='openai-compatible')
    base_url = models.CharField(max_length=255, blank=True, null=True, help_text="URL base de la API, útil para compatibles con OpenAI")
    api_key_encrypted = models.TextField(help_text="Clave de API cifrada")
    embedding_model = models.CharField(max_length=255, blank=True, null=True, help_text="Modelo para embeddings")
    llm_model = models.CharField(max_length=255, blank=True, null=True, help_text="Modelo LLM")
    context_limit = models.IntegerField(
        default=2000,
        validators=[MinValueValidator(1000), MaxValueValidator(10000)],
        help_text="Límite de contexto en caracteres (Min 1000, Max 10000)"
    )
    disable_thinking = models.BooleanField(
        default=True,
        help_text="Si está activo, instruye al modelo a omitir el razonamiento extendido (thinking). Recomendado siempre para vectorización de documentos."
    )
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
    agent_type = models.CharField(max_length=50, default='chat', help_text="evaluator o chat")
    enabled_tools = models.JSONField(default=list, blank=True, help_text="Lista de nombres de herramientas habilitadas")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_app_agent_template"

    def __str__(self):
        return f"{self.name} - Provider: {self.provider.name if self.provider else 'None'}"


class AgentAssignment(models.Model):
    agent = models.ForeignKey(AgentTemplate, on_delete=models.CASCADE, related_name="assignments")
    faculty_id = models.IntegerField(null=True, blank=True, help_text="Facultad a la que aplica")
    department_id = models.IntegerField(null=True, blank=True, help_text="Departamento al que aplica")
    career_id = models.IntegerField(null=True, blank=True, help_text="Carrera a la que aplica")
    subject_code = models.CharField(max_length=50, blank=True, null=True, help_text="Código de asignatura específica")
    section = models.CharField(max_length=50, blank=True, null=True, help_text="Sección específica de la asignatura")
    is_active = models.BooleanField(default=True, help_text="Indica si la asignación está activa")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_app_agent_assignment"
        ordering = ["-created_at"]

    def __str__(self):
        target = f"Subject: {self.subject_code}"
        if self.section:
            target += f" Section: {self.section}"
        if not self.subject_code:
            target = f"Career: {self.career_id}" if self.career_id else \
                     f"Dept: {self.department_id}" if self.department_id else \
                     f"Faculty: {self.faculty_id}" if self.faculty_id else "Global/Ninguno"
        return f"Assignment of {self.agent.name} to {target}"


class SyllabusChunk(models.Model):
    syllabus = models.ForeignKey(CoreSyllabusVersion, on_delete=models.CASCADE, related_name="chunks")
    chunk_index = models.IntegerField()
    content = models.TextField()
    contextualized_content = models.TextField(
        null=True, blank=True,
        help_text="Texto contextualizado por LLM (contexto + chunk original). Persiste para re-indexación sin costo de LLM."
    )
    embedding_model = models.CharField(
        max_length=200, null=True, blank=True,
        help_text="Identificador del modelo de embeddings usado (ej. 'text-embedding-3-small')."
    )
    search_vector = SearchVectorField(
        null=True, blank=True,
        help_text="Vector BM25 para búsqueda de texto completo en PostgreSQL."
    )
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
    contextualized_content = models.TextField(
        null=True, blank=True,
        help_text="Texto contextualizado por LLM (contexto + chunk original). Persiste para re-indexación sin costo de LLM."
    )
    embedding_model = models.CharField(
        max_length=200, null=True, blank=True,
        help_text="Identificador del modelo de embeddings usado (ej. 'text-embedding-3-small')."
    )
    search_vector = SearchVectorField(
        null=True, blank=True,
        help_text="Vector BM25 para búsqueda de texto completo en PostgreSQL."
    )
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
    prompt_tokens = models.IntegerField(default=0, help_text="Tokens de entrada del prompt")
    completion_tokens = models.IntegerField(default=0, help_text="Tokens de salida de la respuesta")
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
    prompt_tokens = models.IntegerField(default=0)
    completion_tokens = models.IntegerField(default=0)
    provider_name = models.CharField(max_length=100, blank=True, null=True)
    model_name = models.CharField(max_length=100, blank=True, null=True)
    processed_percent = models.FloatField(default=0.0, help_text="Porcentaje de procesamiento actual")
    current_document_name = models.CharField(max_length=255, blank=True, null=True, help_text="Nombre del documento que se está analizando")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_app_ailog"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} - {self.status}"


class ChatSession(models.Model):
    user = models.ForeignKey(CoreUser, on_delete=models.CASCADE, related_name="chat_sessions")
    agent = models.ForeignKey(AgentTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=255, default="Conversación sin título")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_app_chat_session"
        ordering = ['-created_at']

    def __str__(self):
        return f"Session {self.id} for {self.user.email if self.user else 'Unknown'}"


class ChatMessage(models.Model):
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=20)  # user o assistant
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_app_chat_message"
        ordering = ['created_at']

    def __str__(self):
        return f"Msg from {self.sender} in Session {self.session_id}"



