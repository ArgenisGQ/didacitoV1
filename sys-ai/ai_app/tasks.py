import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from .models import CoreSyllabusVersion, SyllabusChunk, AIProvider

logger = logging.getLogger(__name__)

def get_embeddings_model():
    """
    Obtiene el modelo de embeddings configurado. Por defecto usa OpenAI, 
    pero soporta configuración desde AIProvider si está definido.
    """
    # Buscamos proveedor por defecto para embeddings, o el primer openai-compatible activo
    provider = AIProvider.objects.filter(is_active=True).first()
    
    # Para embeddings, si no hay proveedor configurado, podríamos lanzar error
    if not provider or not provider.api_key:
        raise ValueError("No hay un proveedor de IA configurado o no tiene API Key")
    
    # If it's LMStudio or a local server, we can pass a dummy model name
    # since the local server usually decides which model to use based on what's loaded.
    model_name = provider.embedding_model or "text-embedding-3-small"
    if provider.provider_type == "lmstudio" and not provider.embedding_model:
        model_name = "local-model"

    return OpenAIEmbeddings(
        openai_api_key=provider.api_key,
        openai_api_base=provider.base_url if provider.base_url else None,
        model=model_name,
        check_embedding_ctx_length=False,
        max_retries=0
    )

def ingest_syllabus_task(syllabus_id: int):
    """
    Tarea de Django-Q2. Lee un SyllabusVersion, hace el chunking, 
    obtiene los embeddings y los guarda en SyllabusChunk con pgvector.
    """
    from .models import AILog
    
    logger.info(f"Iniciando ingesta del syllabus ID: {syllabus_id}")
    log_entry = AILog.objects.create(
        action=f"Vectorización del Syllabus {syllabus_id}",
        status="started",
        details="Iniciando proceso de fragmentación y obtención de embeddings..."
    )
    
    try:
        syllabus = CoreSyllabusVersion.objects.get(id=syllabus_id)
        if not syllabus.extracted_text:
            logger.warning(f"Syllabus {syllabus_id} no tiene texto extraido. Abortando ingesta.")
            log_entry.status = "failed"
            log_entry.details = "El syllabus no tiene texto extraído para vectorizar."
            log_entry.save()
            return

        # 1. Limpiar chunks anteriores si se está re-procesando
        SyllabusChunk.objects.filter(syllabus_id=syllabus_id).delete()
        
        # 2. Configurar el splitter
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        
        # 3. Fragmentar el texto
        texts = text_splitter.split_text(syllabus.extracted_text)
        
        if not texts:
            logger.warning(f"Syllabus {syllabus_id} generó 0 fragmentos.")
            log_entry.status = "failed"
            log_entry.details = "El syllabus generó 0 fragmentos (texto muy corto o vacío)."
            log_entry.save()
            return

        # 4. Obtener embeddings usando el proveedor configurado y procesar en lotes
        embeddings_model = get_embeddings_model()
        
        total_chunks = len(texts)
        batch_size = 10
        chunks_created = 0
        
        for i in range(0, total_chunks, batch_size):
            batch_texts = texts[i:i+batch_size]
            
            # Obtener embeddings para el lote actual
            vectors = embeddings_model.embed_documents(batch_texts)
            
            # Guardar el lote en la DB
            chunks_to_create = []
            for j, (text, vector) in enumerate(zip(batch_texts, vectors)):
                chunks_to_create.append(
                    SyllabusChunk(
                        syllabus_id=syllabus.id,
                        chunk_index=i + j,
                        content=text,
                        embedding=vector
                    )
                )
            
            SyllabusChunk.objects.bulk_create(chunks_to_create)
            chunks_created += len(chunks_to_create)
            
            # Actualizar progreso en el log
            log_entry.details = f"Vectorizando... {chunks_created} de {total_chunks} fragmentos procesados."
            log_entry.save()
            
        logger.info(f"Ingesta exitosa. Syllabus {syllabus_id}: {chunks_created} chunks creados.")
        
        log_entry.status = "success"
        log_entry.details = f"Ingesta exitosa. {chunks_created} fragmentos creados y vectorizados."
        log_entry.save()

    except CoreSyllabusVersion.DoesNotExist:
        logger.error(f"Syllabus {syllabus_id} no encontrado en la DB.")
        log_entry.status = "failed"
        log_entry.details = "El syllabus no fue encontrado en la base de datos."
        log_entry.save()
    except Exception as e:
        logger.exception(f"Error procesando syllabus {syllabus_id}: {str(e)}")
        log_entry.status = "failed"
        log_entry.details = f"Error: {str(e)}"
        log_entry.save()
        raise

def get_llm_model(provider: AIProvider):
    from langchain_openai import ChatOpenAI
    
    model_name = provider.llm_model or "gpt-4o"
    if provider.provider_type == "lmstudio" and not provider.llm_model:
        model_name = "local-model"
    elif not provider.llm_model and ("deepseek" in provider.provider_type.lower() or "deepseek" in provider.name.lower()):
        model_name = "deepseek-chat"
        
    return ChatOpenAI(
        api_key=provider.api_key or "not-needed",
        base_url=provider.base_url if provider.base_url else None,
        model=model_name,
        temperature=0.2,
        max_retries=0,
        timeout=280
    )

def evaluate_plan_task(plan_id: int):
    from .models import CoreLessonPlan, AgentTemplate, EvaluationResult
    from pgvector.django import L2Distance
    from langchain_core.messages import HumanMessage, SystemMessage
    import json
    
    logger.info(f"Iniciando evaluación del plan: {plan_id}")
    
    try:
        plan = CoreLessonPlan.objects.get(id=plan_id)
        
        # 1. Crear el registro de resultado pendiente
        eval_result = EvaluationResult.objects.create(
            lesson_plan=plan,
            status="PROCESSING"
        )
        
        # 2. Buscar el agente activo
        agent = AgentTemplate.objects.filter(is_active=True).first()
        if not agent or not agent.provider:
            raise ValueError("No hay Agente o Proveedor activo configurado.")
            
        eval_result.agent = agent
        eval_result.save()
        
        # 3. Extraer contenido del plan
        weekly_contents = list(plan.weekly_contents.all())
        eval_plans = list(plan.evaluation_plans.all())
        
        plan_text = f"Asignatura: {plan.subject_code}\n"
        for wc in weekly_contents:
            plan_text += f"Semana {wc.week_number}: {wc.content_description}\n"
            
        # 4. Recuperar contexto del sinóptico usando RAG
        # Creamos vector de búsqueda de las primeras líneas del plan para traer el contexto general
        embeddings_model = get_embeddings_model()
        query_vector = embeddings_model.embed_query(plan_text[:1000])
        
        # Búsqueda en pgvector (K=5)
        chunks = SyllabusChunk.objects.filter(
            syllabus__subject__code=plan.subject_code
        ).order_by(L2Distance('embedding', query_vector))[:5]
        
        context_text = "\n\n".join([c.content for c in chunks])
        
        if not context_text:
            context_text = "No se encontraron fragmentos de programa sinóptico en la base de datos."
            
        # 5. Armar el prompt
        prompt = f"""
Has sido asignado para evaluar un plan de clase contra el programa sinóptico oficial.

=== CONTEXTO DEL PROGRAMA SINÓPTICO ===
{context_text}

=== PLAN DE CLASE DEL DOCENTE ===
{plan_text}

Por favor, evalúa si el plan de clase cubre los objetivos del programa sinóptico, identifica desviaciones e indica sugerencias.
Responde en formato JSON estrictamente, con esta estructura:
{{
  "cumple_objetivos": true/false,
  "observaciones": ["obs1", "obs2"],
  "recomendaciones": ["rec1"]
}}
"""
        # 6. Llamar al LLM
        llm = get_llm_model(agent.provider)
        messages = [
            SystemMessage(content=agent.system_prompt),
            HumanMessage(content=prompt)
        ]
        
        response = llm.invoke(messages)
        
        # Parsear respuesta JSON
        try:
            # Eliminar backticks si el LLM los pone
            clean_json = response.content.strip().strip('```json').strip('```').strip()
            result_data = json.loads(clean_json)
        except json.JSONDecodeError:
            # Fallback si no retorna JSON puro
            result_data = {"raw_response": response.content}
            
        # 7. Guardar resultado exitoso
        eval_result.result_data = result_data
        eval_result.status = "SUCCESS"
        eval_result.save()
        
        logger.info(f"Evaluación exitosa para el plan {plan_id}")

    except Exception as e:
        logger.exception(f"Error en la evaluación del plan {plan_id}: {str(e)}")
        if 'eval_result' in locals():
            eval_result.status = "ERROR"
            eval_result.error_message = str(e)
            eval_result.save()
        raise

