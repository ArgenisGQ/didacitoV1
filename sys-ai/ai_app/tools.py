from langchain.tools import tool
from .models import CoreLessonPlan, CoreSyllabusVersion, SyllabusChunk, LessonPlanChunk
from django.db.models import Count

@tool
def obtener_estadisticas_planes() -> str:
    """
    Obtiene las estadísticas globales de los planes de clase (Lesson Plans) en el sistema.
    Devuelve la cantidad total de planes aprobados.
    """
    count = CoreLessonPlan.objects.filter(status='APPROVED').count()
    return f"Actualmente hay {count} planes de clase aprobados en el sistema."

@tool
def obtener_estadisticas_sinopticos() -> str:
    """
    Obtiene las estadísticas globales de los programas sinópticos (Syllabus) en el sistema.
    Devuelve la cantidad total de sinópticos activos.
    """
    count = CoreSyllabusVersion.objects.filter(is_active=True).count()
    return f"Actualmente hay {count} programas sinópticos activos en el sistema."

@tool
def busqueda_semantica_sinopticos(query: str) -> str:
    """
    Busca información cualitativa y detallada dentro del texto de los programas sinópticos (Syllabuses) utilizando búsqueda semántica.
    Usa esta herramienta cuando necesites saber el contenido, temas, competencias o estrategias de una asignatura.
    """
    from .tasks import get_embeddings_model
    from pgvector.django import L2Distance
    
    embeddings_model = get_embeddings_model()
    try:
        query_vector = embeddings_model.embed_query(query)
    except Exception as e:
        return f"Error al generar embeddings: {str(e)}"

    chunks = list(SyllabusChunk.objects.select_related('syllabus__subject').annotate(
        distance=L2Distance('embedding', query_vector)
    ).order_by('distance')[:5])

    if not chunks:
        return "No se encontró información relevante en los sinópticos."

    context_texts = []
    for c in chunks:
        subj = c.syllabus.subject
        context_texts.append(f"[Asignatura: {subj.code} - {subj.name}]\n{c.content}")
    
    return "\n\n---\n\n".join(context_texts)

@tool
def busqueda_semantica_planes(query: str) -> str:
    """
    Busca información cualitativa dentro de los planes de clase aprobados utilizando búsqueda semántica.
    Usa esta herramienta para encontrar cómo se impartió un tema, qué recursos se usaron o detalles de evaluaciones en planes pasados.
    """
    from .tasks import get_embeddings_model
    from pgvector.django import L2Distance
    
    embeddings_model = get_embeddings_model()
    try:
        query_vector = embeddings_model.embed_query(query)
    except Exception as e:
        return f"Error al generar embeddings: {str(e)}"

    chunks = list(LessonPlanChunk.objects.select_related('lesson_plan').annotate(
        distance=L2Distance('embedding', query_vector)
    ).order_by('distance')[:5])

    if not chunks:
        return "No se encontró información relevante en los planes de clase."

    context_texts = []
    for c in chunks:
        plan = c.lesson_plan
        context_texts.append(f"[Plan: {plan.title} | Asignatura: {plan.subject_code}]\n{c.content}")
    
    return "\n\n---\n\n".join(context_texts)

@tool
def buscar_asignaturas_por_area(area: str) -> str:
    """
    Busca y lista las asignaturas activas en el sistema asociadas a un área temática (ej. 'matematicas', 'cálculo', 'álgebra').
    Retorna el código, nombre y propósito/presentación de cada asignatura encontrada.
    """
    from .models import CoreSubject
    from django.db.models import Q
    
    subjects = CoreSubject.objects.filter(
        Q(name__icontains=area) | 
        Q(code__icontains=area) | 
        Q(presentation__icontains=area) | 
        Q(purpose__icontains=area)
    )[:10]
    
    if not subjects.exists():
        return f"No se encontraron asignaturas relacionadas con el área '{area}'."
        
    res = []
    for s in subjects:
        res.append(f"Código: {s.code}\nNombre: {s.name}\nPresentación: {s.presentation or 'N/A'}\nPropósito: {s.purpose or 'N/A'}")
    return "\n\n---\n\n".join(res)

@tool
def buscar_planes_por_tema_evaluacion(tema: str) -> str:
    """
    Busca en los planes de clase aprobados qué evaluaciones, evidencias o instrumentos
    hacen uso de un tema o palabra clave específico (ej. 'IA', 'Inteligencia Artificial', 'exposicion oral').
    """
    from .models import CoreEvaluationPlan
    from django.db.models import Q
    
    evals = CoreEvaluationPlan.objects.filter(
        lesson_plan__status='APPROVED'
    ).filter(
        Q(competence__icontains=tema) |
        Q(strategy__icontains=tema) |
        Q(instrument__icontains=tema) |
        Q(evidence__icontains=tema) |
        Q(feedback_method__icontains=tema)
    ).select_related('lesson_plan')[:10]
    
    if not evals.exists():
        return f"No se encontraron evaluaciones que utilicen el tema/criterio '{tema}'."
        
    res = []
    for e in evals:
        plan = e.lesson_plan
        res.append(
            f"Plan: {plan.title} (Código: {plan.subject_code})\n"
            f"Unidad: {e.unit or 'N/A'}\n"
            f"Competencia: {e.competence or 'N/A'}\n"
            f"Estrategia: {e.strategy or 'N/A'}\n"
            f"Instrumento: {e.instrument or 'N/A'}\n"
            f"Evidencia: {e.evidence or 'N/A'}"
        )
    return "\n\n---\n\n".join(res)

@tool
def busqueda_semantica_planes_filtrada(subject_code: str, query: str) -> str:
    """
    Realiza una búsqueda semántica cualitativa de contenidos únicamente dentro de las planificaciones didácticas
    pertenecientes al código de asignatura indicado (ej. 'MAT-101').
    """
    from .tasks import get_embeddings_model
    from pgvector.django import L2Distance
    
    embeddings_model = get_embeddings_model()
    try:
        query_vector = embeddings_model.embed_query(query)
    except Exception as e:
        return f"Error al generar embeddings: {str(e)}"

    chunks = list(LessonPlanChunk.objects.filter(
        lesson_plan__subject_code__iexact=subject_code.strip(),
        lesson_plan__status='APPROVED'
    ).select_related('lesson_plan').annotate(
        distance=L2Distance('embedding', query_vector)
    ).order_by('distance')[:5])

    if not chunks:
        return f"No se encontró información relevante en los planes para la asignatura '{subject_code}'."

    context_texts = []
    for c in chunks:
        plan = c.lesson_plan
        context_texts.append(f"[Plan: {plan.title} | Asignatura: {plan.subject_code}]\n{c.content}")
    
    return "\n\n---\n\n".join(context_texts)

@tool
def buscar_recursos_y_bibliografia(query: str) -> str:
    """
    Busca términos específicos dentro de los campos de recursos y bibliografía en las planificaciones
    didácticas aprobadas para saber qué materiales de apoyo se utilizan.
    """
    from .models import CoreWeeklyContent
    from django.db.models import Q
    
    contents = CoreWeeklyContent.objects.filter(
        lesson_plan__status='APPROVED'
    ).filter(
        Q(resources__icontains=query) |
        Q(bibliography__icontains=query)
    ).select_related('lesson_plan')[:10]
    
    if not contents.exists():
        return f"No se encontró bibliografía o recursos relacionados con '{query}'."
        
    res = []
    for c in contents:
        plan = c.lesson_plan
        res.append(
            f"Plan: {plan.title} (Asignatura: {plan.subject_code}) - Semana {c.week_number}\n"
            f"Recursos: {c.resources or 'N/A'}\n"
            f"Bibliografía: {c.bibliography or 'N/A'}"
        )
    return "\n\n---\n\n".join(res)

@tool
def buscar_asignatura_por_codigo(codigo: str) -> str:
    """
    Busca una asignatura específica en el sistema a partir de su código exacto o parcial (ej. 'MAT-101' o 'MAT').
    Retorna los detalles curriculares completos del programa sinóptico asociado y sus unidades.
    """
    from .models import CoreSubject
    
    subjects = CoreSubject.objects.filter(code__icontains=codigo.strip())[:5]
    if not subjects.exists():
        return f"No se encontró ninguna asignatura con el código '{codigo}'."
        
    res = []
    for s in subjects:
        units_str = ""
        # Traer unidades si existen
        units = s.units.all().order_by('unit_number')
        if units.exists():
            units_list = []
            for u in units:
                units_list.append(f"  - Unidad {u.unit_number}: {u.unit_title or 'Sin título'} (Contenidos: {u.contents or 'N/A'})")
            units_str = "\nUnidades Curriculares:\n" + "\n".join(units_list)
            
        res.append(
            f"Código: {s.code}\n"
            f"Nombre: {s.name}\n"
            f"Presentación: {s.presentation or 'N/A'}\n"
            f"Propósito: {s.purpose or 'N/A'}\n"
            f"Estrategias de Enseñanza: {s.teaching_strategies or 'N/A'}"
            f"{units_str}"
        )
    return "\n\n---\n\n".join(res)

@tool
def buscar_asignatura_por_nombre(nombre: str) -> str:
    """
    Busca materias/asignaturas activas en el sistema a partir de su nombre o parte de su nombre (ej. 'Matemática', 'Algoritmos').
    Retorna el código, nombre, propósito, presentación y detalles de las unidades de cada materia encontrada.
    """
    from .models import CoreSubject
    
    subjects = CoreSubject.objects.filter(name__icontains=nombre.strip())[:10]
    if not subjects.exists():
        return f"No se encontró ninguna asignatura con el nombre '{nombre}'."
        
    res = []
    for s in subjects:
        units_str = ""
        # Traer unidades si existen
        units = s.units.all().order_by('unit_number')
        if units.exists():
            units_list = []
            for u in units:
                units_list.append(f"  - Unidad {u.unit_number}: {u.unit_title or 'Sin título'} (Contenidos: {u.contents or 'N/A'})")
            units_str = "\nUnidades Curriculares:\n" + "\n".join(units_list)
            
        res.append(
            f"Código: {s.code}\n"
            f"Nombre: {s.name}\n"
            f"Presentación: {s.presentation or 'N/A'}\n"
            f"Propósito: {s.purpose or 'N/A'}\n"
            f"Estrategias de Enseñanza: {s.teaching_strategies or 'N/A'}"
            f"{units_str}"
        )
    return "\n\n---\n\n".join(res)

@tool
def buscar_asignatura_multicampo(codigo: str = None, nombre: str = None, presentacion: str = None, proposito: str = None) -> str:
    """
    Busca materias/asignaturas activas en el sistema aplicando filtros concurrentes en múltiples campos de interés.
    Puedes filtrar por código (coincidencia exacta o parcial), nombre (coincidencia parcial), presentación o propósito (palabras clave).
    Todos los parámetros son opcionales.
    """
    from .models import CoreSubject
    from django.db.models import Q
    
    query = Q()
    if codigo:
        query &= Q(code__icontains=codigo.strip())
    if nombre:
        query &= Q(name__icontains=nombre.strip())
    if presentacion:
        query &= Q(presentation__icontains=presentacion.strip())
    if proposito:
        query &= Q(purpose__icontains=proposito.strip())
        
    if not (codigo or nombre or presentacion or proposito):
        return "Debes proveer al menos un parámetro de búsqueda (codigo, nombre, presentacion o proposito)."
        
    subjects = CoreSubject.objects.filter(query)[:10]
    if not subjects.exists():
        return "No se encontró ninguna asignatura que coincida con los criterios especificados."
        
    res = []
    for s in subjects:
        units_str = ""
        # Traer unidades si existen
        units = s.units.all().order_by('unit_number')
        if units.exists():
            units_list = []
            for u in units:
                units_list.append(f"  - Unidad {u.unit_number}: {u.unit_title or 'Sin título'} (Contenidos: {u.contents or 'N/A'})")
            units_str = "\nUnidades Curriculares:\n" + "\n".join(units_list)
            
        res.append(
            f"Código: {s.code}\n"
            f"Nombre: {s.name}\n"
            f"Presentación: {s.presentation or 'N/A'}\n"
            f"Propósito: {s.purpose or 'N/A'}\n"
            f"Estrategias de Enseñanza: {s.teaching_strategies or 'N/A'}"
            f"{units_str}"
        )
    return "\n\n---\n\n".join(res)

@tool
def buscar_usuario_multicampo(nombre: str = None, email: str = None, rol: str = None, cedula: str = None) -> str:
    """
    Busca usuarios en el sistema aplicando filtros concurrentes por nombre completo, correo, rol y cédula/ID.
    Para cada usuario encontrado, retorna además las materias y secciones asociadas en periodos académicos activos.
    Todos los parámetros son opcionales.
    """
    from .models import CoreUser, CoreUserAcademicPeriod
    from django.db.models import Q
    
    query = Q()
    if nombre:
        query &= Q(full_name__icontains=nombre.strip())
    if email:
        query &= Q(email__icontains=email.strip())
    if rol:
        query &= Q(role__icontains=rol.strip())
    if cedula:
        query &= Q(id_user__icontains=cedula.strip())
        
    if not (nombre or email or rol or cedula):
        return "Debes proveer al menos un criterio de búsqueda (nombre, email, rol o cedula)."
        
    users = CoreUser.objects.filter(query)[:10]
    if not users.exists():
        return "No se encontraron usuarios que coincidan con los criterios especificados."
        
    res = []
    for u in users:
        # Buscar asignaciones académicas vigentes en periodos activos
        assignments = CoreUserAcademicPeriod.objects.filter(
            user=u,
            is_active=True,
            academic_period__is_active=True
        ).select_related('academic_period')
        
        assigns_list = []
        for a in assignments:
            assigns_list.append(
                f"  - Periodo: {a.academic_period.name} | Materia(s): {a.subject_code or 'Ninguna'} | Sección(es): {a.section or 'Ninguna'}"
            )
        assigns_str = "\nAsignaciones Activas:\n" + "\n".join(assigns_list) if assigns_list else "\nSin asignaciones activas en este periodo."
        
        res.append(
            f"Nombre Completo: {u.full_name}\n"
            f"Email: {u.email}\n"
            f"Rol: {u.role}\n"
            f"Cédula: {u.id_user or 'N/A'}"
            f"{assigns_str}"
        )
    return "\n\n---\n\n".join(res)

@tool
def buscar_plan_multicampo(titulo: str = None, autor: str = None, estado: str = None, codigo_materia: str = None, seccion: str = None, periodo_academico: str = None) -> str:
    """
    Busca planes de clase (Lesson Plans) en el sistema aplicando filtros concurrentes en múltiples campos de interés.
    Puedes filtrar por título (coincidencia parcial), autor (coincidencia parcial en nombre completo o email), estado (ej. APPROVED, DRAFT),
    código de asignatura, sección o nombre de periodo académico.
    Todos los parámetros son opcionales.
    """
    from .models import CoreLessonPlan
    from django.db.models import Q
    
    query = Q()
    if titulo:
        query &= Q(title__icontains=titulo.strip())
    if autor:
        query &= (Q(author__full_name__icontains=autor.strip()) | Q(author__email__icontains=autor.strip()))
    if estado:
        query &= Q(status__iexact=estado.strip())
    if codigo_materia:
        query &= Q(subject_code__iexact=codigo_materia.strip())
    if seccion:
        query &= Q(section__iexact=seccion.strip())
    if periodo_academico:
        query &= Q(academic_period__name__icontains=periodo_academico.strip())
        
    if not (titulo or autor or estado or codigo_materia or seccion or periodo_academico):
        return "Debes proveer al menos un parámetro de búsqueda (titulo, autor, estado, codigo_materia, seccion o periodo_academico)."
        
    plans = CoreLessonPlan.objects.filter(query)[:10]
    if not plans.exists():
        return "No se encontró ningún plan de clase que coincida con los criterios especificados."
        
    res = []
    for p in plans:
        res.append(
            f"ID Plan: {p.id}\n"
            f"Título: {p.title}\n"
            f"Autor: {p.author_name} ({p.author.email if p.author else 'N/A'})\n"
            f"Estado: {p.status}\n"
            f"Código Materia: {p.subject_code or 'N/A'}\n"
            f"Sección: {p.section or 'N/A'}\n"
            f"Periodo Académico: {p.academic_period.name if p.academic_period else 'N/A'}"
        )
    return "\n\n---\n\n".join(res)

# Lista de herramientas base disponibles para los agentes
AVAILABLE_TOOLS = [
    obtener_estadisticas_planes,
    obtener_estadisticas_sinopticos,
    busqueda_semantica_sinopticos,
    busqueda_semantica_planes,
    buscar_asignaturas_por_area,
    buscar_planes_por_tema_evaluacion,
    busqueda_semantica_planes_filtrada,
    buscar_recursos_y_bibliografia,
    buscar_asignatura_por_codigo,
    buscar_asignatura_por_nombre,
    buscar_asignatura_multicampo,
    buscar_usuario_multicampo,
    buscar_plan_multicampo,
]

def get_tools_by_names(tool_names: list) -> list:
    """
    Filtra y devuelve las funciones tool de LangChain basándose en los nombres proporcionados.
    """
    tool_map = {t.name: t for t in AVAILABLE_TOOLS}
    return [tool_map[name] for name in tool_names if name in tool_map]
