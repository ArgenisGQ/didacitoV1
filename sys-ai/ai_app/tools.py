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

# Lista de herramientas base disponibles para los agentes
AVAILABLE_TOOLS = [
    obtener_estadisticas_planes,
    obtener_estadisticas_sinopticos,
    busqueda_semantica_sinopticos,
    busqueda_semantica_planes,
]

def get_tools_by_names(tool_names: list) -> list:
    """
    Filtra y devuelve las funciones tool de LangChain basándose en los nombres proporcionados.
    """
    tool_map = {t.name: t for t in AVAILABLE_TOOLS}
    return [tool_map[name] for name in tool_names if name in tool_map]
