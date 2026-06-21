import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from .models import CoreSyllabusVersion, SyllabusChunk, AIProvider

logger = logging.getLogger(__name__)

def get_embeddings_model(provider_id: int = None):
    """
    Obtiene el modelo de embeddings configurado. Por defecto usa OpenAI, 
    pero soporta configuración desde AIProvider si está definido.
    """
    # Buscamos proveedor específico por ID, o por defecto el primero activo
    if provider_id:
        try:
            provider = AIProvider.objects.get(id=provider_id, is_active=True)
        except AIProvider.DoesNotExist:
            provider = AIProvider.objects.filter(is_active=True).first()
    else:
        provider = AIProvider.objects.filter(is_active=True).first()
    
    # Para embeddings, si no hay proveedor configurado, podríamos lanzar error
    if not provider or not provider.api_key:
        raise ValueError("No hay un proveedor de IA configurado o no tiene API Key")
    
    if provider.provider_type == "google":
        from langchain_core.embeddings import Embeddings
        class GoogleGenAIEmbeddings(Embeddings):
            def __init__(self, api_key: str, model_name: str):
                self.api_key = api_key
                self.model_name = model_name or "models/gemini-embedding-2"

            def embed_documents(self, texts: list[str]) -> list[list[float]]:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                response = genai.embed_content(
                    model=self.model_name,
                    content=texts,
                    task_type="retrieval_document"
                )
                return response.get('embedding', [])

            def embed_query(self, text: str) -> list[float]:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                response = genai.embed_content(
                    model=self.model_name,
                    content=text,
                    task_type="retrieval_query"
                )
                return response.get('embedding', [])
                
        emb_model = GoogleGenAIEmbeddings(provider.api_key, provider.embedding_model)
    else:
        # If it's LMStudio or a local server, we can pass a dummy model name
        # since the local server usually decides which model to use based on what's loaded.
        model_name = provider.embedding_model or "text-embedding-3-small"
        if provider.provider_type == "lmstudio" and not provider.embedding_model:
            model_name = "local-model"

        emb_model = OpenAIEmbeddings(
            openai_api_key=provider.api_key,
            openai_api_base=provider.base_url if provider.base_url else None,
            model=model_name,
            check_embedding_ctx_length=False,
            max_retries=0
        )

    return emb_model

def ingest_syllabus_task(syllabus_id: int, provider_id: int = None):
    """
    Tarea de Django-Q2. Lee un SyllabusVersion, hace el chunking, 
    obtiene los embeddings y los guarda en SyllabusChunk con pgvector.
    """
    from .models import AILog, SyllabusChunk
    from django.contrib.postgres.search import SearchVector
    
    doc_name = f"Syllabus #{syllabus_id}"
    syllabus = None
    try:
        syllabus = CoreSyllabusVersion.objects.get(id=syllabus_id)
        if syllabus.subject:
            doc_name = syllabus.subject.name
    except Exception:
        pass

    logger.info(f"Iniciando ingesta del syllabus ID: {syllabus_id}")
    log_entry = AILog.objects.create(
        action=f"Vectorización del Syllabus {syllabus_id}",
        status="started",
        details="Iniciando proceso de fragmentación y obtención de embeddings...",
        current_document_name=doc_name,
        processed_percent=0.0
    )
    
    try:
        if not syllabus:
            syllabus = CoreSyllabusVersion.objects.get(id=syllabus_id)
        if not syllabus.extracted_text:
            logger.warning(f"Syllabus {syllabus_id} no tiene texto extraido. Abortando ingesta.")
            log_entry.status = "failed"
            log_entry.details = "El syllabus no tiene texto extraído para vectorizar."
            log_entry.save()
            return

        # 1. Obtener chunks existentes para reutilizar contextualización (resiliencia)
        existing_chunks = {c.chunk_index: c for c in SyllabusChunk.objects.filter(syllabus_id=syllabus_id)}
        # NO borramos al inicio para poder reanudar y reutilizar
        
        # 2. Configurar el splitter con tamaño 800 y overlap 80
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=80,
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
        embeddings_model = get_embeddings_model(provider_id=provider_id)
        
        provider = None
        if provider_id:
            try:
                provider = AIProvider.objects.get(id=provider_id, is_active=True)
            except AIProvider.DoesNotExist:
                provider = AIProvider.objects.filter(is_active=True).first()
        else:
            provider = AIProvider.objects.filter(is_active=True).first()

        current_embedding_model = provider.embedding_model if provider else "unknown"

        # Estimate embedding tokens
        prompt_tokens = sum(len(t) for t in texts) // 4
        log_entry.prompt_tokens = prompt_tokens
        log_entry.completion_tokens = 0
        if provider:
            log_entry.provider_name = provider.name
            log_entry.model_name = provider.embedding_model or "gemini-embedding-2"
        log_entry.save()
        
        total_chunks = len(texts)
        batch_size = 10
        chunks_created = 0
        
        from django.core.cache import cache
        import time

        from django.db import transaction

        for i in range(0, total_chunks, batch_size):
            batch_texts = texts[i:i+batch_size]
            
            chunks_to_embed = []  # list of (chunk_index, contextualized_text)
            reused_chunks = []    # list of SyllabusChunk
            
            for j, text in enumerate(batch_texts):
                chunk_index = i + j
                existing_chunk = existing_chunks.get(chunk_index)
                
                contextualized_text = None
                if existing_chunk and existing_chunk.contextualized_content:
                    if text in existing_chunk.contextualized_content:
                        contextualized_text = existing_chunk.contextualized_content
                        # Si el embedding también existe y es válido
                        if existing_chunk.embedding is not None:
                            reused_chunks.append(existing_chunk)
                            # Reutilizado, decrementar contador de llamadas
                            try:
                                remaining = cache.get('rag_sync_remaining_llm_calls_syllabuses', 0)
                                if remaining > 0:
                                    cache.set('rag_sync_remaining_llm_calls_syllabuses', remaining - 1)
                            except Exception:
                                pass
                            continue
                
                if not contextualized_text:
                    if provider:
                        try:
                            start_time = time.time()
                            llm = get_llm_model(provider)
                            # Truncado inteligente del documento según context_limit
                            limit_chars = provider.context_limit if provider.context_limit else 3000
                            truncated_text = syllabus.extracted_text[:limit_chars]
                            
                            prompt = f"""Tendrás acceso al documento completo de un programa sinóptico universitario y a uno de sus fragmentos.
Tu tarea es escribir una descripción corta (máximo 2-3 oraciones) que explique qué parte del programa
sinóptico representa este fragmento y qué información pedagógica clave aporta.

<documento>
{truncated_text}
</documento>

<fragmento>
{text}
</fragmento>

Responde SOLO con la descripción contextual. No incluyas saludos ni explicaciones adicionales."""
                            from langchain_core.messages import HumanMessage, SystemMessage
                            response = llm.invoke([
                                SystemMessage(content="Eres un asistente experto en educación universitaria."),
                                HumanMessage(content=prompt)
                            ])
                            context = response.content.strip()
                            contextualized_text = f"{context}\n\n{text}"
                            
                            # Registrar duración
                            duration = time.time() - start_time
                            try:
                                durations = cache.get('last_context_durations_syllabuses', [])
                                durations.append(duration)
                                if len(durations) > 10:
                                    durations = durations[-10:]
                                cache.set('last_context_durations_syllabuses', durations)
                            except Exception:
                                pass
                        except Exception as e:
                            logger.error(f"Error generando contexto para chunk {chunk_index}: {e}")
                            # Fallback graceful a texto original si falla
                            contextualized_text = text
                    else:
                        contextualized_text = text
                    
                    # Decrementar contador de llamadas restantes
                    try:
                        remaining = cache.get('rag_sync_remaining_llm_calls_syllabuses', 0)
                        if remaining > 0:
                            cache.set('rag_sync_remaining_llm_calls_syllabuses', remaining - 1)
                    except Exception:
                        pass
                
                chunks_to_embed.append((chunk_index, contextualized_text))
            
            # Obtener embeddings para los chunks nuevos/modificados y guardarlos
            if chunks_to_embed:
                embed_texts = [item[1] for item in chunks_to_embed]
                vectors = embeddings_model.embed_documents(embed_texts)
                
                chunks_to_create = []
                chunk_indexes_to_delete = []
                for (chunk_idx, contextualized_text), vector in zip(chunks_to_embed, vectors):
                    chunks_to_create.append(
                        SyllabusChunk(
                            syllabus_id=syllabus.id,
                            chunk_index=chunk_idx,
                            content=contextualized_text,
                            contextualized_content=contextualized_text,
                            embedding_model=current_embedding_model,
                            embedding=vector
                        )
                    )
                    chunk_indexes_to_delete.append(chunk_idx)
                
                with transaction.atomic():
                    SyllabusChunk.objects.filter(syllabus_id=syllabus.id, chunk_index__in=chunk_indexes_to_delete).delete()
                    SyllabusChunk.objects.bulk_create(chunks_to_create)
            
            chunks_created += len(chunks_to_embed) + len(reused_chunks)
            
            # Actualizar progreso en el log
            log_entry.processed_percent = round((chunks_created / total_chunks) * 100, 1)
            log_entry.current_document_name = syllabus.subject.name if syllabus.subject else f"Syllabus {syllabus.id}"
            log_entry.details = f"Vectorizando... {chunks_created} de {total_chunks} fragmentos procesados."
            log_entry.save(update_fields=['processed_percent', 'current_document_name', 'details'])
            
        # Eliminar cualquier chunk excedente de versiones anteriores (si las hubiera)
        SyllabusChunk.objects.filter(syllabus_id=syllabus.id, chunk_index__gte=total_chunks).delete()

        # Actualizar search_vector para BM25 en lote de manera eficiente
        SyllabusChunk.objects.filter(syllabus_id=syllabus.id).update(
            search_vector=SearchVector('content', config='spanish')
        )
        
        logger.info(f"Ingesta exitosa. Syllabus {syllabus_id}: {chunks_created} chunks creados.")
        
        log_entry.status = "success"
        log_entry.processed_percent = 100.0
        log_entry.details = f"Ingesta exitosa. {chunks_created} fragmentos creados y vectorizados."
        log_entry.save(update_fields=['status', 'processed_percent', 'details'])

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

def ingest_lesson_plan_task(plan_id: int, provider_id: int = None):
    """
    Extrae, fragmenta y vectoriza el contenido de un CoreLessonPlan.
    """
    from .models import CoreLessonPlan, LessonPlanChunk, AILog
    from django.contrib.postgres.search import SearchVector
    
    doc_name = f"Plan #{plan_id}"
    plan = None
    try:
        plan = CoreLessonPlan.objects.get(id=plan_id)
        doc_name = plan.title if plan.title else f"Plan {plan.id}"
    except Exception:
        pass

    log_entry = AILog.objects.create(
        action=f"Vectorización de Plan de Clase #{plan_id}",
        status="started",
        details="Iniciando extracción y vectorización...",
        current_document_name=doc_name,
        processed_percent=0.0
    )
    
    try:
        if not plan:
            plan = CoreLessonPlan.objects.get(id=plan_id)
        
        if plan.status != 'APPROVED':
            log_entry.status = "failed"
            log_entry.details = "El plan no está aprobado. Se aborta la vectorización."
            log_entry.save()
            return
            
        # 1. Obtener chunks existentes para reutilizar contextualización (resiliencia)
        existing_chunks = {c.chunk_index: c for c in LessonPlanChunk.objects.filter(lesson_plan=plan)}
        # NO borramos al inicio para poder reanudar y reutilizar
        
        # 2. Extraer y concatenar texto del plan
        full_text = f"PLAN DE CLASE\n"
        full_text += f"Título: {plan.title}\n"
        full_text += f"Asignatura (Código): {plan.subject_code}\n"
        full_text += f"Sección: {plan.section}\n\n"
        
        full_text += "== CONTENIDOS SEMANALES ==\n"
        for wc in plan.weekly_contents.all().order_by('week_number'):
            full_text += f"Semana {wc.week_number}:\n"
            full_text += f"Contenido: {wc.content_description}\n"
            full_text += f"Estrategia Didáctica: {wc.teaching_strategy}\n"
            full_text += f"Recursos: {wc.resources}\n"
            full_text += f"Bibliografía: {wc.bibliography}\n\n"
            
        full_text += "== PLAN DE EVALUACIÓN ==\n"
        for ev in plan.evaluation_plans.all().order_by('due_week'):
            full_text += f"Semana de entrega {ev.due_week} (Unidad {ev.unit}):\n"
            full_text += f"Estrategia de evaluación: {ev.strategy}\n"
            full_text += f"Instrumento: {ev.instrument}\n"
            full_text += f"Ponderación: {ev.weight}%\n\n"
            
        if not full_text.strip():
            log_entry.status = "success"
            log_entry.details = "El plan de clase está vacío, no se crearon chunks."
            log_entry.save()
            return
            
        # 3. Fragmentación con tamaño 800 y overlap 80
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=80,
            length_function=len,
        )
        
        texts = text_splitter.split_text(full_text)
        
        # 4. Generar embeddings
        embeddings_model = get_embeddings_model(provider_id=provider_id)
        
        provider = None
        if provider_id:
            try:
                provider = AIProvider.objects.get(id=provider_id, is_active=True)
            except AIProvider.DoesNotExist:
                provider = AIProvider.objects.filter(is_active=True).first()
        else:
            provider = AIProvider.objects.filter(is_active=True).first()

        current_embedding_model = provider.embedding_model if provider else "unknown"

        # Estimate embedding tokens
        prompt_tokens = sum(len(t) for t in texts) // 4
        log_entry.prompt_tokens = prompt_tokens
        log_entry.completion_tokens = 0
        if provider:
            log_entry.provider_name = provider.name
            log_entry.model_name = provider.embedding_model or "gemini-embedding-2"
        log_entry.save()
        
        # Crear en lotes
        batch_size = 5
        chunks_created = 0
        total_chunks = len(texts)
        
        from django.core.cache import cache
        import time

        from django.db import transaction

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            
            chunks_to_embed = []  # list of (chunk_index, contextualized_text)
            reused_chunks = []    # list of LessonPlanChunk
            
            for j, text in enumerate(batch_texts):
                chunk_index = i + j
                existing_chunk = existing_chunks.get(chunk_index)
                
                contextualized_text = None
                if existing_chunk and existing_chunk.contextualized_content:
                    if text in existing_chunk.contextualized_content:
                        contextualized_text = existing_chunk.contextualized_content
                        # Si el embedding también existe y es válido
                        if existing_chunk.embedding is not None:
                            reused_chunks.append(existing_chunk)
                            # Reutilizado, decrementar contador de llamadas
                            try:
                                remaining = cache.get('rag_sync_remaining_llm_calls_plans', 0)
                                if remaining > 0:
                                    cache.set('rag_sync_remaining_llm_calls_plans', remaining - 1)
                            except Exception:
                                pass
                            continue
                
                if not contextualized_text:
                    if provider:
                        try:
                            start_time = time.time()
                            llm = get_llm_model(provider)
                            # Truncado inteligente del documento según context_limit
                            limit_chars = provider.context_limit if provider.context_limit else 3000
                            truncated_text = full_text[:limit_chars]
                            
                            prompt = f"""Tendrás acceso al contenido completo de un plan de clase universitario y a uno de sus fragmentos.
Tu tarea es escribir una descripción corta (máximo 2-3 oraciones) que explique qué semana,
unidad o sección del plan de clase representa este fragmento.

<documento>
{truncated_text}
</documento>

<fragmento>
{text}
</fragmento>

Responde SOLO con la descripción contextual. No incluyas saludos ni explicaciones adicionales."""
                            from langchain_core.messages import HumanMessage, SystemMessage
                            response = llm.invoke([
                                SystemMessage(content="Eres un asistente experto en educación universitaria."),
                                HumanMessage(content=prompt)
                            ])
                            context = response.content.strip()
                            contextualized_text = f"{context}\n\n{text}"
                            
                            # Registrar duración
                            duration = time.time() - start_time
                            try:
                                durations = cache.get('last_context_durations_plans', [])
                                durations.append(duration)
                                if len(durations) > 10:
                                    durations = durations[-10:]
                                cache.set('last_context_durations_plans', durations)
                            except Exception:
                                pass
                        except Exception as e:
                            logger.error(f"Error generando contexto para chunk {chunk_index}: {e}")
                            # Fallback graceful a texto original si falla
                            contextualized_text = text
                    else:
                        contextualized_text = text
                        
                    # Decrementar contador de llamadas restantes
                    try:
                        remaining = cache.get('rag_sync_remaining_llm_calls_plans', 0)
                        if remaining > 0:
                            cache.set('rag_sync_remaining_llm_calls_plans', remaining - 1)
                    except Exception:
                        pass
                
                chunks_to_embed.append((chunk_index, contextualized_text))
            
            # Obtener embeddings para los chunks nuevos/modificados y guardarlos
            if chunks_to_embed:
                embed_texts = [item[1] for item in chunks_to_embed]
                batch_embeddings = embeddings_model.embed_documents(embed_texts)
                
                chunks_to_create = []
                chunk_indexes_to_delete = []
                for (chunk_idx, contextualized_text), emb in zip(chunks_to_embed, batch_embeddings):
                    chunks_to_create.append(
                        LessonPlanChunk(
                            lesson_plan=plan,
                            chunk_index=chunk_idx,
                            content=contextualized_text,
                            contextualized_content=contextualized_text,
                            embedding_model=current_embedding_model,
                            embedding=emb
                        )
                    )
                    chunk_indexes_to_delete.append(chunk_idx)
                
                with transaction.atomic():
                    LessonPlanChunk.objects.filter(lesson_plan=plan, chunk_index__in=chunk_indexes_to_delete).delete()
                    LessonPlanChunk.objects.bulk_create(chunks_to_create)
            
            chunks_created += len(chunks_to_embed) + len(reused_chunks)
            
            # Actualizar progreso
            log_entry.processed_percent = round((chunks_created / total_chunks) * 100, 1)
            log_entry.current_document_name = plan.title if plan.title else f"Plan {plan.id}"
            log_entry.details = f"Vectorizando... {chunks_created} de {total_chunks} fragmentos procesados."
            log_entry.save(update_fields=['processed_percent', 'current_document_name', 'details'])
            
        # Eliminar cualquier chunk excedente de versiones anteriores (si las hubiera)
        LessonPlanChunk.objects.filter(lesson_plan=plan, chunk_index__gte=total_chunks).delete()

        # Actualizar search_vector para BM25 en lote de manera eficiente
        LessonPlanChunk.objects.filter(lesson_plan=plan).update(
            search_vector=SearchVector('content', config='spanish')
        )
        
        logger.info(f"Ingesta exitosa. Plan {plan_id}: {chunks_created} chunks creados.")
        
        log_entry.status = "success"
        log_entry.processed_percent = 100.0
        log_entry.details = f"Ingesta exitosa. {chunks_created} fragmentos creados y vectorizados."
        log_entry.save(update_fields=['status', 'processed_percent', 'details'])
        
    except CoreLessonPlan.DoesNotExist:
        logger.error(f"LessonPlan {plan_id} no encontrado en la DB.")
        log_entry.status = "failed"
        log_entry.details = "El plan no fue encontrado en la base de datos."
        log_entry.save()
    except Exception as e:
        logger.exception(f"Error procesando plan {plan_id}: {str(e)}")
        log_entry.status = "failed"
        log_entry.details = f"Error: {str(e)}"
        log_entry.save()
        raise

def get_llm_model(provider: AIProvider):
    disable_thinking = getattr(provider, 'disable_thinking', True)
    model_name = provider.llm_model or "gpt-4o"
    
    if provider.provider_type == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        if not provider.llm_model:
            model_name = "gemini-2.5-flash"
        else:
            model_name = provider.llm_model
        
        kwargs = {
            "google_api_key": provider.api_key,
            "model": model_name,
            "temperature": 0,
            "max_retries": 0,
            "timeout": 280
        }
        if disable_thinking:
            kwargs["thinking_budget"] = 0
            
        return ChatGoogleGenerativeAI(**kwargs)
            
    from langchain_openai import ChatOpenAI
    base_url = provider.base_url if provider.base_url else None
    if provider.provider_type == "lmstudio" and not provider.llm_model:
        model_name = "local-model"
    elif not provider.llm_model and ("deepseek" in provider.provider_type.lower() or "deepseek" in provider.name.lower()):
        model_name = "deepseek-chat"
        
    # Advertir si se detecta un modelo razonador de DeepSeek (R1)
    is_reasoner = any(x in model_name.lower() for x in ["r1", "reasoner"])
    if is_reasoner and disable_thinking:
        logger.warning(
            f"Modelo razonador detectado ({model_name}). "
            "Para RAG se recomienda usar 'deepseek-chat' en su lugar, ya que DeepSeek-R1 no permite desactivar thinking por parámetro."
        )

    extra_body = {"thinking": {"type": "disabled"}} if disable_thinking else {}

    return ChatOpenAI(
        api_key=provider.api_key or "not-needed",
        base_url=base_url,
        model=model_name,
        temperature=0,
        max_retries=0,
        timeout=280,
        **({"extra_body": extra_body} if extra_body else {})
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
        
        # 2. Buscar el agente asignado de forma jerárquica
        from .models import AgentAssignment, CoreDepartment
        agent = None
        
        # 2.1 Buscar asignación directa por asignatura y sección
        from django.db.models import Q
        assignment = None
        if plan.section:
            plan_sections = [s.strip() for s in plan.section.split(",") if s.strip()]
            # Buscar asignaciones para esta asignatura y filtrar en base a la lista de secciones (con soporte para comas)
            subj_assignments = AgentAssignment.objects.filter(subject_code=plan.subject_code, is_active=True).exclude(Q(section__isnull=True) | Q(section=''))
            for sa in subj_assignments:
                if sa.section:
                    sa_sections = [s.strip() for s in sa.section.split(",") if s.strip()]
                    # Si hay alguna coincidencia de sección entre el plan y la asignación
                    if any(sec in sa_sections for sec in plan_sections):
                        assignment = sa
                        break
        if not assignment:
            # Buscar asignación por asignatura de forma global (sección vacía/nula)
            assignment = AgentAssignment.objects.filter(subject_code=plan.subject_code, is_active=True).filter(Q(section__isnull=True) | Q(section='')).first()
            
        if assignment:
            agent = assignment.agent
            
        if not agent:
            # 2.2 Buscar departamento por subject_code
            dept = CoreDepartment.objects.filter(subject_codes__contains=plan.subject_code).first()
            if dept:
                # Buscar asignación por departamento
                assignment = AgentAssignment.objects.filter(department_id=dept.id, is_active=True).first()
                if assignment:
                    agent = assignment.agent
                
                # 2.3 Si no hay, buscar asignación por facultad del departamento
                if not agent and dept.faculty_id:
                    assignment = AgentAssignment.objects.filter(faculty_id=dept.faculty_id, is_active=True).first()
                    if assignment:
                        agent = assignment.agent

        # 2.4 Si sigue sin haber, usar el primer agente activo por defecto
        if not agent:
            agent = AgentTemplate.objects.filter(is_active=True).first()
            
        if not agent or not agent.provider:
            raise ValueError("No hay un Agente o Proveedor activo configurado aplicable para este plan.")
            
        eval_result.agent = agent
        eval_result.save()
        
        # 3. Extraer contenido del plan
        weekly_contents = list(plan.weekly_contents.all())
        eval_plans = list(plan.evaluation_plans.all())
        
        plan_text = f"Asignatura: {plan.subject_code}\n"
        for wc in weekly_contents:
            plan_text += f"Semana {wc.week_number}: {wc.content_description}\n"
            
        # 4. Recuperar contexto del sinóptico usando RAG
        embeddings_model = get_embeddings_model()
        context_limit = agent.provider.context_limit if getattr(agent.provider, 'context_limit', None) is not None else 2000
        query_vector = embeddings_model.embed_query(plan_text[:context_limit])
        
        chunks = SyllabusChunk.objects.filter(
            syllabus__subject__code=plan.subject_code
        ).order_by(L2Distance('embedding', query_vector))[:1]
        
        context_text = "\n\n".join([c.content for c in chunks])[:context_limit]
        
        if not context_text:
            context_text = "No se encontraron fragmentos de programa sinóptico en la base de datos."
            
        # 5. Armar el prompt
        prompt = f"""
Has sido asignado para realizar un análisis pedagógico y curricular exhaustivo y detallado de un plan de clase comparándolo contra el programa sinóptico oficial.

=== CONTEXTO DEL PROGRAMA SINÓPTICO ===
{context_text}

=== PLAN DE CLASE DEL DOCENTE ===
{plan_text}

Por favor, realiza una comparación minuciosa. Evalúa si el plan de clase cubre cabalmente los objetivos del programa sinóptico, la alineación de las competencias, la pertinencia de las estrategias didácticas propuestas por semana, la dosificación de contenidos y la coherencia del plan de evaluación. 
Identifica claramente cualquier desviación, inconsistencia, omisión o aspecto débil, explicando de manera detallada el motivo pedagógico o técnico. Formula recomendaciones constructivas y específicas que indiquen de forma práctica cómo corregir o mejorar dichos puntos.

Responde en formato JSON estrictamente, con esta estructura:
{{
  "cumple_objetivos": true/false,
  "observaciones": [
    "Descripción detallada y fundamentada de la observación 1...",
    "Descripción detallada y fundamentada de la observación 2..."
  ],
  "recomendaciones": [
    "Recomendación específica y accionable 1 para solventar la observación...",
    "Recomendación específica y accionable 2..."
  ]
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
        cumple = False
        observaciones_y_recos = ""
        try:
            clean_json = response.content.strip().strip('```json').strip('```').strip()
            result_data = json.loads(clean_json)
            cumple = result_data.get('cumple_objetivos', False)
            obs = result_data.get('observaciones', [])
            recs = result_data.get('recomendaciones', [])
            observaciones_y_recos = "Observaciones:\n" + "\n".join([f"- {o}" for o in obs]) + "\n\nRecomendaciones:\n" + "\n".join([f"- {r}" for r in recs])
        except json.JSONDecodeError:
            result_data = {"raw_response": response.content}
            content_lower = response.content.lower()
            if '"cumple_objetivos": true' in content_lower or 'cumple_objetivos: true' in content_lower or '"cumple_objetivos":true' in content_lower:
                cumple = True
            observaciones_y_recos = response.content
            
        # 7. Guardar resultado exitoso
        eval_result.result_data = result_data
        eval_result.status = "SUCCESS"
        
        # Extraer metadatos de tokens si están disponibles
        prompt_tokens = 0
        completion_tokens = 0
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            prompt_tokens = response.usage_metadata.get('input_tokens', 0) or response.usage_metadata.get('prompt_tokens', 0) or 0
            completion_tokens = response.usage_metadata.get('output_tokens', 0) or response.usage_metadata.get('completion_tokens', 0) or 0
        elif hasattr(response, 'response_metadata') and response.response_metadata:
            token_usage = response.response_metadata.get('token_usage')
            if token_usage:
                prompt_tokens = token_usage.get('prompt_tokens', 0) or token_usage.get('input_tokens', 0) or 0
                completion_tokens = token_usage.get('completion_tokens', 0) or token_usage.get('output_tokens', 0) or 0

        eval_result.prompt_tokens = prompt_tokens
        eval_result.completion_tokens = completion_tokens
        eval_result.save()

        # Log AI action with token consumption
        AILog.objects.create(
            action=f"Evaluación del Plan #{plan_id}",
            status="success",
            details=f"Evaluación exitosa. Respuesta: {'Aprobado' if cumple else 'Observado'}",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            provider_name=agent.provider.name if agent and agent.provider else "Desconocido",
            model_name=agent.provider.llm_model if agent and agent.provider else "Desconocido"
        )


        # 8. Transicionar estado del plan en CoreLessonPlan y guardar feedback
        if cumple:
            plan.status = "APPROVED"
        else:
            plan.status = "IN_REVIEW"
            
        plan.feedback = observaciones_y_recos
        plan.save(update_fields=['status', 'feedback'])

        # 9. Crear notificación para el Docente y Coordinador
        from .models import CoreNotification, CoreUser
        
        # Alerta al Docente
        docente_title = f"Planificación '{plan.title}' Aprobada" if cumple else f"Planificación '{plan.title}' en revisión (con observaciones de IA)"
        docente_msg = "La evaluación automática determinó que tu planificación cumple con los criterios pedagógicos." if cumple else "La evaluación automática detectó observaciones en tu planificación y ha sido turnada al coordinador para su revisión."
        
        CoreNotification.objects.create(
            user_id=plan.author_id,
            title=docente_title,
            message=docente_msg,
            lesson_plan_id=plan.id
        )

        # Alerta al Coordinador
        coordinators = CoreUser.objects.filter(role="COORDINADOR")
        if plan.coordinator_id:
            coordinators = coordinators.filter(id=plan.coordinator_id)
        
        coord_title = f"AI Aprobación: Plan de {plan.author_name}" if cumple else f"Alerta IA: Planificación '{plan.title}' Observada"
        coord_msg = f"El plan de clase '{plan.title}' ha sido aprobado automáticamente." if cumple else f"El docente {plan.author_name} ha cargado un plan con observaciones.\n\nFeedback:\n{observaciones_y_recos}"

        for coord in coordinators:
            CoreNotification.objects.create(
                user_id=coord.id,
                title=coord_title,
                message=coord_msg,
                lesson_plan_id=plan.id
            )
        
        logger.info(f"Evaluación exitosa para el plan {plan_id}. Cumple: {cumple}")

    except Exception as e:
        logger.exception(f"Error en la evaluación del plan {plan_id}: {str(e)}")
        if 'eval_result' in locals():
            eval_result.status = "ERROR"
            eval_result.error_message = str(e)
            eval_result.save()
        # Log failure
        AILog.objects.create(
            action=f"Evaluación Fallida del Plan #{plan_id}",
            status="failed",
            details=str(e),
            prompt_tokens=0,
            completion_tokens=0,
            provider_name=agent.provider.name if ('agent' in locals() and agent and agent.provider) else "Desconocido",
            model_name=agent.provider.llm_model if ('agent' in locals() and agent and agent.provider) else "Desconocido"
        )
        raise


