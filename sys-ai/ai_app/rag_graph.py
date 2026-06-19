import logging
import torch
from sentence_transformers import CrossEncoder
from typing import List, Dict, Any, Optional, Annotated
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.runnables import RunnableConfig

from .models import SyllabusChunk, LessonPlanChunk, AIProvider
from .tasks import get_embeddings_model
from pgvector.django import L2Distance
from django.contrib.postgres.search import SearchQuery, SearchRank

logger = logging.getLogger(__name__)

# Singleton Cross-Encoder loaded at startup
device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Cargando modelo Cross-Encoder en dispositivo: {device}")
try:
    _reranker = CrossEncoder('cross-encoder/mmarco-mMiniLMv2-L12-H384-v1', device=device)
except Exception as e:
    logger.exception(f"Error al cargar el Cross-Encoder en {device}, reintentando en cpu: {e}")
    _reranker = CrossEncoder('cross-encoder/mmarco-mMiniLMv2-L12-H384-v1', device="cpu")

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    user_query: str
    vector_candidates: List[Any]
    bm25_candidates: List[Any]
    fused_candidates: List[Any]
    retrieved_context: List[str]
    error: Optional[str]

def hybrid_retriever(state: AgentState) -> Dict[str, Any]:
    user_query = state.get("user_query", "")
    if not user_query:
        return {"vector_candidates": [], "bm25_candidates": []}

    try:
        # Obtener embeddings del usuario
        embeddings_model = get_embeddings_model()
        query_vector = embeddings_model.embed_query(user_query)
    except Exception as e:
        logger.exception(f"Error al generar embeddings de la consulta: {e}")
        return {"error": f"Error al generar embeddings: {str(e)}", "vector_candidates": [], "bm25_candidates": []}

    # Recall Vectorial (top-20 en cada tabla, ordenado por distancia)
    try:
        vector_syllabus = list(
            SyllabusChunk.objects.select_related('syllabus__subject')
            .annotate(distance=L2Distance('embedding', query_vector))
            .order_by('distance')[:20]
        )
        vector_plan = list(
            LessonPlanChunk.objects.select_related('lesson_plan')
            .annotate(distance=L2Distance('embedding', query_vector))
            .order_by('distance')[:20]
        )
    except Exception as e:
        logger.exception(f"Error en consulta vectorial: {e}")
        vector_syllabus = []
        vector_plan = []

    # Recall Léxico BM25 (top-20 en cada tabla)
    try:
        fts_query = SearchQuery(user_query, config='spanish')
        bm25_syllabus = list(
            SyllabusChunk.objects.select_related('syllabus__subject')
            .annotate(rank=SearchRank('search_vector', fts_query))
            .filter(rank__gt=0.0)
            .order_by('-rank')[:20]
        )
        bm25_plan = list(
            LessonPlanChunk.objects.select_related('lesson_plan')
            .annotate(rank=SearchRank('search_vector', fts_query))
            .filter(rank__gt=0.0)
            .order_by('-rank')[:20]
        )
    except Exception as e:
        logger.exception(f"Error en consulta BM25: {e}")
        bm25_syllabus = []
        bm25_plan = []

    return {
        "vector_candidates": vector_syllabus + vector_plan,
        "bm25_candidates": bm25_syllabus + bm25_plan
    }

def rrf_fusion(state: AgentState) -> Dict[str, Any]:
    vector_candidates = state.get("vector_candidates", [])
    bm25_candidates = state.get("bm25_candidates", [])
    
    k = 60
    scores = {}
    
    # Fusionar lista vectorial
    for rank, item in enumerate(vector_candidates, start=1):
        key = (item.__class__.__name__, item.id)
        if key not in scores:
            scores[key] = {"item": item, "score": 0.0}
        scores[key]["score"] += 1.0 / (k + rank)
        
    # Fusionar lista léxica BM25
    for rank, item in enumerate(bm25_candidates, start=1):
        key = (item.__class__.__name__, item.id)
        if key not in scores:
            scores[key] = {"item": item, "score": 0.0}
        scores[key]["score"] += 1.0 / (k + rank)
        
    # Ordenar por puntaje descendente y tomar top 20
    sorted_keys = sorted(scores.keys(), key=lambda x: scores[x]["score"], reverse=True)
    fused = [scores[key]["item"] for key in sorted_keys[:20]]
    
    return {"fused_candidates": fused}

def reranker(state: AgentState) -> Dict[str, Any]:
    fused_candidates = state.get("fused_candidates", [])
    user_query = state.get("user_query", "")
    
    if not fused_candidates or not user_query:
        return {"retrieved_context": []}
        
    # Preparar pares para el Cross-Encoder (Query, Contenido Contextualizado)
    pairs = [(user_query, cand.content) for cand in fused_candidates]
    
    try:
        scores = _reranker.predict(pairs)
        scored_candidates = list(zip(fused_candidates, scores))
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        # Seleccionar top-5 definitivos
        top_candidates = [cand for cand, score in scored_candidates[:5]]
    except Exception as e:
        logger.exception(f"Error en re-ranking: {e}")
        # Fallback al top-5 de la fusión original
        top_candidates = fused_candidates[:5]
        
    # Formatear el contexto para el LLM
    context_texts = []
    for c in top_candidates:
        if c.__class__.__name__ == 'SyllabusChunk':
            context_texts.append(f"[FUENTE: Sinóptico | Asignatura: {c.syllabus.subject.code}]\n{c.content}")
        else:
            context_texts.append(f"[FUENTE: Plan Aprobado | Título: {c.lesson_plan.title}]\n{c.content}")
            
    return {"retrieved_context": context_texts}

def synthesizer(state: AgentState, config: RunnableConfig) -> Dict[str, Any]:
    llm = config.get("configurable", {}).get("llm")
    system_prompt = config.get("configurable", {}).get("system_prompt", "Eres un asistente experto en pedagogía universitaria.")
    
    if not llm:
        return {"error": "No LLM provided in config"}
        
    context_str = "\n\n---\n\n".join(state.get("retrieved_context", []))
    full_system_prompt = f"{system_prompt}\n\nCONTEXTO DE BÚSQUEDA:\n{context_str}"
    
    # Construir historial de mensajes con el system prompt modificado
    messages = [SystemMessage(content=full_system_prompt)]
    for msg in state.get("messages", []):
        if not isinstance(msg, SystemMessage):
            messages.append(msg)
            
    try:
        response = llm.invoke(messages)
        return {"messages": [response]}
    except Exception as e:
        logger.exception(f"Error en el LLM del synthesizer: {e}")
        return {"error": str(e)}

# Construir y compilar el grafo LangGraph
def build_rag_graph():
    builder = StateGraph(AgentState)
    
    builder.add_node("hybrid_retriever", hybrid_retriever)
    builder.add_node("rrf_fusion", rrf_fusion)
    builder.add_node("reranker", reranker)
    builder.add_node("synthesizer", synthesizer)
    
    builder.add_edge(START, "hybrid_retriever")
    builder.add_edge("hybrid_retriever", "rrf_fusion")
    builder.add_edge("rrf_fusion", "reranker")
    builder.add_edge("reranker", "synthesizer")
    builder.add_edge("synthesizer", END)
    
    return builder.compile()

# Exportable compiled graph instance
rag_graph = build_rag_graph()
