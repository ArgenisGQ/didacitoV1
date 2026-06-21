from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from django_q.tasks import async_task

@csrf_exempt
@require_http_methods(["POST"])
def ingest_syllabus(request, subject_id):
    """
    Endpoint para encolar la tarea de ingesta de un programa sinóptico.
    El backend de sys-syllabus puede llamar esto mediante webhook.
    """
    from .models import AIProvider
    if not AIProvider.objects.filter(is_active=True).exists():
        return JsonResponse({"error": "El sistema no tiene un modelo de IA configurado o activo."}, status=400)
        
    # Verificación muy básica, idealmente se debe chequear un token interno
    # o confiar en la red interna de docker.
    
    task_id = async_task('ai_app.tasks.ingest_syllabus_task', subject_id)
    
    return JsonResponse({
        "status": "success",
        "message": f"Tarea de ingesta encolada para el syllabus {subject_id}",
        "task_id": task_id
    })

@csrf_exempt
@require_http_methods(["POST"])
def evaluate_plan(request, plan_id):
    """
    Endpoint para encolar la tarea de evaluación de un LessonPlan con IA.
    """
    from .models import AIProvider
    if not AIProvider.objects.filter(is_active=True).exists():
        return JsonResponse({"error": "El sistema no tiene un modelo de IA configurado o activo."}, status=400)
        
    task_id = async_task('ai_app.tasks.evaluate_plan_task', plan_id)
    
    return JsonResponse({
        "status": "success",
        "message": f"Tarea de evaluación encolada para el plan {plan_id}",
        "task_id": task_id
    })

@require_http_methods(["GET"])
def get_evaluation(request, plan_id):
    """
    Endpoint para obtener el último resultado de evaluación de IA para un plan.
    """
    from .models import EvaluationResult
    result = EvaluationResult.objects.filter(lesson_plan_id=plan_id).order_by('-created_at').first()
    
    if not result:
        return JsonResponse({"error": "No se encontró evaluación para este plan"}, status=404)
        
    return JsonResponse({
        "status": result.status,
        "result_data": result.result_data,
        "error_message": result.error_message,
        "created_at": result.created_at.isoformat()
    })

@require_http_methods(["GET"])
def rag_status(request):
    """
    Endpoint para que el Super Admin revise el estado de sincronización del RAG
    con los programas sinópticos y planes de clase.
    """
    from .models import CoreSyllabusVersion, SyllabusChunk, CoreLessonPlan, LessonPlanChunk
    from django.core.cache import cache
    
    # Todos los sinópticos activos
    total_active_syllabuses = CoreSyllabusVersion.objects.filter(is_active=True).count()
    
    # Cuántos de esos tienen chunks asociados (Vectores Listos)
    embedded_syllabuses_ids = SyllabusChunk.objects.filter(embedding__isnull=False).values_list('syllabus_id', flat=True).distinct()
    total_embedded_syllabuses = CoreSyllabusVersion.objects.filter(id__in=embedded_syllabuses_ids, is_active=True).count()

    # Cuántos tienen contextos listos (Contextos generados)
    contextualized_syllabuses_ids = SyllabusChunk.objects.filter(contextualized_content__isnull=False).values_list('syllabus_id', flat=True).distinct()
    total_contextualized_syllabuses = CoreSyllabusVersion.objects.filter(id__in=contextualized_syllabuses_ids, is_active=True).count()

    # Todos los planes aprobados
    total_approved_plans = CoreLessonPlan.objects.filter(status='APPROVED').count()

    # Cuántos de esos tienen chunks (Vectores Listos)
    embedded_plans_ids = LessonPlanChunk.objects.filter(embedding__isnull=False).values_list('lesson_plan_id', flat=True).distinct()
    total_embedded_plans = CoreLessonPlan.objects.filter(id__in=embedded_plans_ids, status='APPROVED').count()
    
    # Cuántos tienen contextos listos (Contextos generados)
    contextualized_plans_ids = LessonPlanChunk.objects.filter(contextualized_content__isnull=False).values_list('lesson_plan_id', flat=True).distinct()
    total_contextualized_plans = CoreLessonPlan.objects.filter(id__in=contextualized_plans_ids, status='APPROVED').count()

    # Conteo a nivel de fragmentos (para progreso fino y estimación)
    total_chunks_syllabuses = SyllabusChunk.objects.filter(syllabus__is_active=True).count()
    contextualized_chunks_syllabuses = SyllabusChunk.objects.filter(syllabus__is_active=True, contextualized_content__isnull=False).count()

    total_chunks_plans = LessonPlanChunk.objects.filter(lesson_plan__status='APPROVED').count()
    contextualized_chunks_plans = LessonPlanChunk.objects.filter(lesson_plan__status='APPROVED', contextualized_content__isnull=False).count()

    # Buscamos si hay alguna tarea de vectorización en progreso por separado, u obtener la última realizada/cancelada
    from .models import AILog
    
    active_logs_syllabuses = AILog.objects.filter(status='started', action__startswith='Vectorización del Syllabus').order_by('-created_at')
    syllabuses_sync_active = active_logs_syllabuses.exists()
    
    if not syllabuses_sync_active:
        active_logs_syllabuses = AILog.objects.filter(action__startswith='Vectorización del Syllabus').order_by('-created_at')[:1]
        
    processes_syllabuses = []
    for log in active_logs_syllabuses:
        processes_syllabuses.append({
            "id": log.id,
            "current_document_name": log.current_document_name,
            "processed_percent": log.processed_percent,
            "status": log.status,
            "details": log.details
        })

    active_logs_plans = AILog.objects.filter(status='started', action__startswith='Vectorización de Plan').order_by('-created_at')
    plans_sync_active = active_logs_plans.exists()
    
    if not plans_sync_active:
        active_logs_plans = AILog.objects.filter(action__startswith='Vectorización de Plan').order_by('-created_at')[:1]
        
    processes_plans = []
    for log in active_logs_plans:
        processes_plans.append({
            "id": log.id,
            "current_document_name": log.current_document_name,
            "processed_percent": log.processed_percent,
            "status": log.status,
            "details": log.details
        })

    # Campos de compatibilidad hacia atrás
    latest_s = processes_syllabuses[0] if processes_syllabuses else None
    latest_p = processes_plans[0] if processes_plans else None
    
    processed_percent_syllabuses = latest_s["processed_percent"] if latest_s else 0.0
    current_document_name_syllabuses = latest_s["current_document_name"] if latest_s else None
    status_syllabuses = latest_s["status"] if latest_s else None
    current_task_detail_syllabuses = latest_s["details"] if latest_s else None

    processed_percent_plans = latest_p["processed_percent"] if latest_p else 0.0
    current_document_name_plans = latest_p["current_document_name"] if latest_p else None
    status_plans = latest_p["status"] if latest_p else None
    current_task_detail_plans = latest_p["details"] if latest_p else None
    
    # Parámetros de estimación de tiempo para syllabus
    remaining_llm_calls_syllabuses = cache.get('rag_sync_remaining_llm_calls_syllabuses', 0)
    if remaining_llm_calls_syllabuses < 0:
        remaining_llm_calls_syllabuses = 0
    durations_syllabuses = cache.get('last_context_durations_syllabuses', [])
    avg_context_time_syllabuses = sum(durations_syllabuses) / len(durations_syllabuses) if durations_syllabuses else 2.5
    estimated_time_seconds_syllabuses = remaining_llm_calls_syllabuses * avg_context_time_syllabuses if remaining_llm_calls_syllabuses > 0 else 0

    # Parámetros de estimación de tiempo para planes
    remaining_llm_calls_plans = cache.get('rag_sync_remaining_llm_calls_plans', 0)
    if remaining_llm_calls_plans < 0:
        remaining_llm_calls_plans = 0
    durations_plans = cache.get('last_context_durations_plans', [])
    avg_context_time_plans = sum(durations_plans) / len(durations_plans) if durations_plans else 2.5
    estimated_time_seconds_plans = remaining_llm_calls_plans * avg_context_time_plans if remaining_llm_calls_plans > 0 else 0

    return JsonResponse({
        "total_active_syllabuses": total_active_syllabuses,
        "total_synced": total_embedded_syllabuses,
        "total_contexts_syllabuses": total_contextualized_syllabuses,
        "is_fully_synced": total_active_syllabuses > 0 and total_active_syllabuses == total_embedded_syllabuses,
        
        "total_approved_plans": total_approved_plans,
        "total_synced_plans": total_embedded_plans,
        "total_contexts_plans": total_contextualized_plans,
        "is_plans_fully_synced": total_approved_plans > 0 and total_approved_plans == total_embedded_plans,
        
        "total_chunks_syllabuses": total_chunks_syllabuses,
        "contextualized_chunks_syllabuses": contextualized_chunks_syllabuses,
        "total_chunks_plans": total_chunks_plans,
        "contextualized_chunks_plans": contextualized_chunks_plans,
        
        "syllabuses_sync_active": syllabuses_sync_active,
        "plans_sync_active": plans_sync_active,
        "current_task_detail_syllabuses": current_task_detail_syllabuses,
        "current_task_detail_plans": current_task_detail_plans,
        "processed_percent_syllabuses": processed_percent_syllabuses,
        "current_document_name_syllabuses": current_document_name_syllabuses,
        "status_syllabuses": status_syllabuses,
        "processed_percent_plans": processed_percent_plans,
        "current_document_name_plans": current_document_name_plans,
        "status_plans": status_plans,
        "active_processes_syllabuses": processes_syllabuses,
        "active_processes_plans": processes_plans,
        "remaining_llm_calls_syllabuses": remaining_llm_calls_syllabuses,
        "avg_context_time_seconds_syllabuses": avg_context_time_syllabuses,
        "estimated_time_seconds_syllabuses": estimated_time_seconds_syllabuses,
        "remaining_llm_calls_plans": remaining_llm_calls_plans,
        "avg_context_time_seconds_plans": avg_context_time_plans,
        "estimated_time_seconds_plans": estimated_time_seconds_plans
    })

@csrf_exempt
@require_http_methods(["POST"])
def clear_embeddings(request):
    """
    Elimina los vectores de embeddings de la base de datos para forzar la re-vectorización.
    Permite filtrar por target ('syllabuses' o 'plans') para granularidad.
    """
    import json
    from .models import SyllabusChunk, LessonPlanChunk
    
    target = None
    try:
        data = json.loads(request.body)
        target = data.get('target')
    except:
        pass
        
    if target == 'syllabuses':
        SyllabusChunk.objects.all().update(embedding=None, embedding_model=None)
        msg = "Vectores de embeddings de Programas Sinópticos eliminados correctamente."
    elif target == 'plans':
        LessonPlanChunk.objects.all().update(embedding=None, embedding_model=None)
        msg = "Vectores de embeddings de Planes de Clase eliminados correctamente."
    else:
        SyllabusChunk.objects.all().update(embedding=None, embedding_model=None)
        LessonPlanChunk.objects.all().update(embedding=None, embedding_model=None)
        msg = "Todos los vectores de embeddings del RAG fueron eliminados correctamente."
        
    return JsonResponse({
        "status": "success",
        "message": msg
    })

@csrf_exempt
@require_http_methods(["POST"])
def clear_contexts(request):
    """
    Elimina los contextos generados por el LLM en la base de datos.
    Permite filtrar por target ('syllabuses' o 'plans') para granularidad.
    """
    import json
    from .models import SyllabusChunk, LessonPlanChunk
    
    target = None
    try:
        data = json.loads(request.body)
        target = data.get('target')
    except:
        pass
        
    if target == 'syllabuses':
        SyllabusChunk.objects.all().update(contextualized_content=None)
        msg = "Contextos de LLM de Programas Sinópticos eliminados correctamente."
    elif target == 'plans':
        LessonPlanChunk.objects.all().update(contextualized_content=None)
        msg = "Contextos de LLM de Planes de Clase eliminados correctamente."
    else:
        SyllabusChunk.objects.all().update(contextualized_content=None)
        LessonPlanChunk.objects.all().update(contextualized_content=None)
        msg = "Todos los contextos de LLM del RAG fueron eliminados correctamente."
        
    return JsonResponse({
        "status": "success",
        "message": msg
    })

@csrf_exempt
@require_http_methods(["POST"])
def sync_all_syllabuses(request):
    """
    Endpoint para que el Super Admin sincronice manualmente todos los programas sinópticos
    activos que aún no tienen vectores.
    """
    from .models import CoreSyllabusVersion, AIProvider
    from django_q.tasks import async_task
    from django.core.cache import cache
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    
    if not AIProvider.objects.filter(is_active=True).exists():
        return JsonResponse({"error": "El sistema no tiene un modelo de IA configurado o activo. Por favor configure uno en la sección de Proveedores."}, status=400)

    # Obtener provider_id opcional de los parámetros POST
    provider_id = None
    try:
        data = json.loads(request.body)
        provider_id = data.get('provider_id')
    except:
        pass
    
    # Obtenemos los activos
    active_syllabuses = CoreSyllabusVersion.objects.filter(is_active=True)
    
    # Inicializar el conteo estimado de fragmentos a procesar en la caché
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=80,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    total_chunks = 0
    for syllabus in active_syllabuses:
        if syllabus.extracted_text:
            try:
                chunks = text_splitter.split_text(syllabus.extracted_text)
                total_chunks += len(chunks)
            except Exception:
                pass
                
    cache.set('rag_sync_remaining_llm_calls_syllabuses', total_chunks)
    
    tasks_queued = 0
    for syllabus in active_syllabuses:
        async_task('ai_app.tasks.ingest_syllabus_task', syllabus.id, provider_id=provider_id)
        tasks_queued += 1
        
    return JsonResponse({
        "status": "success",
        "message": f"Se han encolado {tasks_queued} sinópticos para sincronización en segundo plano."
    })

@csrf_exempt
@require_http_methods(["POST"])
def sync_all_plans(request):
    """
    Endpoint para que el Super Admin sincronice manualmente todos los planes aprobados.
    """
    from .models import CoreLessonPlan, AIProvider
    from django_q.tasks import async_task
    from django.core.cache import cache
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    
    if not AIProvider.objects.filter(is_active=True).exists():
        return JsonResponse({"error": "El sistema no tiene un modelo de IA configurado o activo."}, status=400)
    
    # Obtener provider_id opcional de los parámetros POST
    provider_id = None
    try:
        data = json.loads(request.body)
        provider_id = data.get('provider_id')
    except:
        pass

    approved_plans = CoreLessonPlan.objects.filter(status='APPROVED')
    
    # Inicializar el conteo estimado de fragmentos en la caché (agregando al existente)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=80,
        length_function=len
    )
    total_chunks = 0
    for plan in approved_plans:
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
            
        if full_text.strip():
            try:
                chunks = text_splitter.split_text(full_text)
                total_chunks += len(chunks)
            except Exception:
                pass
                
    curr_remaining = cache.get('rag_sync_remaining_llm_calls_plans', 0)
    cache.set('rag_sync_remaining_llm_calls_plans', curr_remaining + total_chunks)

    tasks_queued = 0
    for plan in approved_plans:
        async_task('ai_app.tasks.ingest_lesson_plan_task', plan.id, provider_id=provider_id)
        tasks_queued += 1
        
    return JsonResponse({
        "status": "success",
        "message": f"Se han encolado {tasks_queued} planes para sincronización en segundo plano."
    })

@csrf_exempt
@require_http_methods(["POST"])
def cancel_sync(request):
    """
    Endpoint para cancelar la sincronización actual vaciando la cola de Django Q y marcando logs como cancelados.
    Admite {"target": "syllabuses" | "plans"} para cancelación parcial.
    """
    from django_q.models import OrmQ
    from django_q.signing import SignedPackage
    from .models import AILog
    from django.core.cache import cache
    
    target = None
    try:
        data = json.loads(request.body)
        target = data.get('target')
    except:
        pass
        
    deleted_count = 0
    updated_count = 0
    
    if target == 'syllabuses':
        # Eliminar solo tareas de syllabus de la cola
        for task in OrmQ.objects.all():
            try:
                task_dict = SignedPackage.loads(task.payload)
                if task_dict.get('func') == 'ai_app.tasks.ingest_syllabus_task':
                    task.delete()
                    deleted_count += 1
            except Exception:
                pass
                
        # Cancelar logs de syllabus activos
        updated_count = AILog.objects.filter(
            status='started', 
            action__startswith='Vectorización del Syllabus'
        ).update(
            status='stopped',
            details='Sincronización detenida por el usuario.'
        )
        
        # Eliminar caché de syllabus
        cache.delete('rag_sync_remaining_llm_calls_syllabuses')
        msg = f"Sincronización de sinópticos cancelada. Se eliminaron {deleted_count} tareas de la cola y se actualizaron {updated_count} logs."
        
    elif target == 'plans':
        # Eliminar solo tareas de planes de la cola
        for task in OrmQ.objects.all():
            try:
                task_dict = SignedPackage.loads(task.payload)
                if task_dict.get('func') == 'ai_app.tasks.ingest_lesson_plan_task':
                    task.delete()
                    deleted_count += 1
            except Exception:
                pass
                
        # Cancelar logs de planes activos
        updated_count = AILog.objects.filter(
            status='started', 
            action__startswith='Vectorización de Plan'
        ).update(
            status='stopped',
            details='Sincronización detenida por el usuario.'
        )
        
        # Eliminar caché de planes
        cache.delete('rag_sync_remaining_llm_calls_plans')
        msg = f"Sincronización de planes cancelada. Se eliminaron {deleted_count} tareas de la cola y se actualizaron {updated_count} logs."
        
    else:
        # Cancelar todo
        deleted_count, _ = OrmQ.objects.all().delete()
        updated_count = AILog.objects.filter(status='started').update(
            status='stopped',
            details='Sincronización detenida por el usuario.'
        )
        cache.delete('rag_sync_remaining_llm_calls_syllabuses')
        cache.delete('rag_sync_remaining_llm_calls_plans')
        cache.delete('rag_sync_remaining_llm_calls')
        msg = f"Sincronización general cancelada. Se eliminaron {deleted_count} tareas de la cola y se actualizaron {updated_count} logs."
        
    return JsonResponse({
        "status": "success",
        "message": msg
    })

@csrf_exempt
@require_http_methods(["POST"])
def sync_single_plan(request, plan_id):
    """
    Endpoint invocado automáticamente cuando se aprueba un plan.
    """
    from .models import AIProvider
    from django_q.tasks import async_task
    
    if not AIProvider.objects.filter(is_active=True).exists():
        return JsonResponse({"error": "El sistema no tiene un modelo de IA configurado o activo."}, status=400)

    async_task('ai_app.tasks.ingest_lesson_plan_task', plan_id)
    return JsonResponse({"status": "success", "message": "Plan encolado para vectorización."})

@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_providers(request):
    """
    Endpoint temporal para listar/crear proveedores (usado por el frontend).
    """
    from .models import AIProvider
    import json
    
    if request.method == "GET":
        providers = AIProvider.objects.all().values()
        return JsonResponse(list(providers), safe=False)
    
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            p = AIProvider.objects.create(
                name=data.get('name', 'Nuevo'),
                provider_type=data.get('provider_type', 'openai'),
                base_url=data.get('base_url', ''),
                embedding_model=data.get('embedding_model', ''),
                llm_model=data.get('llm_model', ''),
                context_limit=int(data.get('context_limit', 2000)) if data.get('context_limit') else 2000,
                disable_thinking=data.get('disable_thinking', True) is True or data.get('disable_thinking') == 'on',
                is_active=data.get('is_active', True) == 'on' or data.get('is_active') is True
            )
            p.api_key = data.get('api_key', '***')
            p.save()
            return JsonResponse({"id": p.id, "status": "success"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_templates(request):
    """
    Endpoint temporal para listar/crear agentes (templates).
    """
    from .models import AgentTemplate
    import json
    
    if request.method == "GET":
        templates = AgentTemplate.objects.all().values()
        return JsonResponse(list(templates), safe=False)
        
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            provider_id = data.get('provider_id')
            if not provider_id or provider_id in ('', 'none', 'null', 'undefined'):
                provider_id = None
            else:
                try:
                    provider_id = int(provider_id)
                except (ValueError, TypeError):
                    provider_id = None

            t = AgentTemplate.objects.create(
                name=data.get('name', 'Nuevo Agente'),
                description=data.get('description', ''),
                system_prompt=data.get('system_prompt', ''),
                is_active=data.get('is_active', True) == 'on' or data.get('is_active') is True,
                agent_type=data.get('agent_type', 'chat'),
                enabled_tools=data.get('enabled_tools', []),
                provider_id=provider_id
            )
            return JsonResponse({"id": t.id, "status": "success"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)


@require_http_methods(["GET"])
def rag_logs(request):
    """
    Endpoint para obtener los últimos logs desde la nueva tabla AILog.
    """
    from .models import AILog
    
    logs_qs = AILog.objects.all().order_by('-id')[:30]
    
    logs = []
    for t in logs_qs:
        logs.append({
            "id": t.id,
            "status": t.status,
            "name": t.action,
            "started": t.created_at.isoformat() if t.created_at else None,
            "result": t.details or ""
        })
        
    return JsonResponse(logs, safe=False)

@csrf_exempt
@require_http_methods(["POST"])
def test_provider_connection(request):
    """
    Endpoint para probar la conexión con un proveedor de IA.
    """
    from .models import AIProvider
    import json
    from .tasks import get_llm_model
    from langchain_core.messages import HumanMessage
    
    try:
        data = json.loads(request.body)
        provider_id = data.get('provider_id')
        
        # Soportar testeo desde ID (existente) o pasando params (nuevo provider)
        api_key = data.get('api_key')
        base_url = data.get('base_url')
        provider_type = data.get('provider_type', 'openai-compatible')
        
        if provider_id:
            provider = AIProvider.objects.get(id=provider_id)
            api_key = api_key if api_key and api_key != '***' else provider.api_key
            base_url = base_url if base_url is not None else provider.base_url
            provider_type = provider_type if 'provider_type' in data else provider.provider_type
        elif not api_key and provider_type != 'lmstudio':
            return JsonResponse({"error": "API Key requerida"}, status=400)
            
        test_target = data.get('test_target', 'all')
        
        # Obtener lista de modelos usando el cliente base de openai o google genai
        models_list = []
        if test_target == 'all':
            if provider_type == "google":
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                try:
                    models_response = genai.list_models()
                    models_list = [m.name for m in models_response]
                except Exception as e:
                    pass
            else:
                from openai import OpenAI
                client = OpenAI(
                    api_key=api_key or "dummy",
                    base_url=base_url if base_url else None
                )
                try:
                    models_response = client.models.list()
                    models_list = [m.id for m in models_response]
                except Exception as e:
                    pass # Ignoramos si falla el listado pero el chat funciona
            
        # Instanciamos el modelo para la prueba usando LangChain
        from langchain_openai import ChatOpenAI, OpenAIEmbeddings
        
        response_text = "OK"
        
        if test_target == 'llm':
            model_name = data.get('llm_model') or "gpt-4o"
            if provider_type == "google":
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                if not data.get('llm_model'):
                    model_name = "gemini-2.5-flash"
                elif "models/" in model_name:
                    model_name = model_name.replace("models/", "")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content("Responde solo con la palabra OK")
                response_text = f"LLM OK: {response.text.strip()}"
            else:
                if provider_type == "lmstudio" and not data.get('llm_model'):
                    model_name = "local-model"
                elif "deepseek" in provider_type.lower() and not data.get('llm_model'):
                    model_name = "deepseek-chat"
                    
                llm = ChatOpenAI(
                    api_key=api_key or "dummy",
                    base_url=base_url if base_url else None,
                    model=model_name,
                    temperature=0.2
                )
                
                messages = [HumanMessage(content="Responde solo con la palabra OK")]
                response = llm.invoke(messages)
                response_text = f"LLM OK: {response.content.strip()}"
                    
        elif test_target == 'embedding':
            emb_model_name = data.get('embedding_model') or "text-embedding-3-small"
            if provider_type == "google":
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                if not data.get('embedding_model'):
                    emb_model_name = "models/gemini-embedding-2"
                res = genai.embed_content(
                    model=emb_model_name,
                    content="Prueba de conexion",
                    task_type="retrieval_document"
                )
                embedding_vector = res.get('embedding', [])
                if len(embedding_vector) > 0:
                    response_text = f"Embedding OK (Dim: {len(embedding_vector)})"
            else:
                if provider_type == "lmstudio" and not data.get('embedding_model'):
                    emb_model_name = "local-model"
                    
                from openai import OpenAI
                client = OpenAI(
                    api_key=api_key or "dummy",
                    base_url=base_url if base_url else None
                )
                # Intenta hacer un embedding de prueba directo con el cliente OpenAI
                try:
                    res = client.embeddings.create(input=["Prueba de conexion"], model=emb_model_name)
                    if len(res.data) > 0 and len(res.data[0].embedding) > 0:
                        response_text = f"Embedding OK (Dim: {len(res.data[0].embedding)})"
                except Exception as e:
                    error_str = str(e)
                    if "No models loaded" in error_str or "Model unloaded" in error_str:
                        return JsonResponse({"error": "No hay un modelo de Embeddings cargado en LM Studio. Debes cargar un modelo especializado (ej. nomic-embed-text) para vectorización."}, status=400)
                    raise e
        
        elif test_target == 'all':
            if provider_type == "google":
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                genai.list_models()
            else:
                if not models_list:
                    # If we couldn't list models, we still want to verify connection works at all
                    client.models.list() # Let it throw exception so UI shows error
            response_text = "Conexión a la API y listado de modelos OK"
        
        from .models import AILog
        AILog.objects.create(
            action=f"Prueba de Conexión: {test_target.upper()}",
            status="success",
            details=f"Provider ID: {provider_id or 'Nuevo'}. Respuesta: {response_text}"
        )
        
        return JsonResponse({
            "status": "success",
            "message": "Conexión exitosa",
            "response": response_text,
            "models": models_list
        })
        
    except AIProvider.DoesNotExist:
        return JsonResponse({"error": "Proveedor no encontrado"}, status=404)
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Ensure we return a 400 bad request with the error message so the UI can display it
        error_msg = str(e)
        if hasattr(e, 'response') and hasattr(e.response, 'json'):
            try:
                error_msg = e.response.json().get('error', {}).get('message', error_msg)
            except:
                pass
        elif hasattr(e, 'message'):
            error_msg = e.message
            
        from .models import AILog
        # Obtener test_target si es posible, sino genérico
        try:
            target = json.loads(request.body).get('test_target', 'all')
        except:
            target = "all"
            
        AILog.objects.create(
            action=f"Prueba de Conexión Fallida: {target.upper()}",
            status="failed",
            details=error_msg
        )
            
        return JsonResponse({"error": f"Error de conexión: {error_msg}"}, status=400)

@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def admin_providers_detail(request, provider_id):
    from .models import AIProvider
    import json
    try:
        p = AIProvider.objects.get(id=provider_id)
        if request.method == "PUT":
            data = json.loads(request.body)
            
            # Warning logic if embedding model changes
            old_model = p.embedding_model
            new_model = data.get('embedding_model', p.embedding_model)
            if old_model != new_model and request.GET.get('confirm') != 'true':
                from .models import SyllabusChunk, LessonPlanChunk
                chunks_filter = {"embedding_model": old_model}
                total_chunks = (
                    SyllabusChunk.objects.filter(**chunks_filter).count() +
                    LessonPlanChunk.objects.filter(**chunks_filter).count()
                )
                if total_chunks > 0:
                    syllabi_count = SyllabusChunk.objects.filter(**chunks_filter).values('syllabus_id').distinct().count()
                    plans_count = LessonPlanChunk.objects.filter(**chunks_filter).values('lesson_plan_id').distinct().count()
                    return JsonResponse({
                        "warning": "embedding_model_change",
                        "message": (
                            f"Cambiar el modelo de embeddings de '{old_model or 'Ninguno'}' a '{new_model or 'Ninguno'}' "
                            f"requiere re-indexar {syllabi_count} sinóptico(s) y {plans_count} plan(es) de clase. "
                            f"Esta operación procesará {total_chunks} chunk(s) en segundo plano usando el texto "
                            f"contextualizado ya almacenado (sin costo adicional de LLM). "
                            f"¿Desea continuar?"
                        ),
                        "syllabi_affected": syllabi_count,
                        "plans_affected": plans_count,
                        "chunks_affected": total_chunks,
                        "old_model": old_model,
                        "new_model": new_model,
                    }, status=409)

            p.name = data.get('name', p.name)
            p.provider_type = data.get('provider_type', p.provider_type)
            p.base_url = data.get('base_url', p.base_url)
            p.embedding_model = data.get('embedding_model', p.embedding_model)
            p.llm_model = data.get('llm_model', p.llm_model)
            if 'context_limit' in data and data.get('context_limit') is not None:
                try:
                    p.context_limit = int(data.get('context_limit'))
                except (ValueError, TypeError):
                    pass
            if 'disable_thinking' in data:
                p.disable_thinking = data.get('disable_thinking') is True or data.get('disable_thinking') == 'on'
            new_key = data.get('api_key', '')
            if new_key and new_key != '***':
                p.api_key = new_key
            p.is_active = data.get('is_active', True) == 'on' or data.get('is_active') is True
            p.save()
            return JsonResponse({"id": p.id, "status": "success"})
        elif request.method == "DELETE":
            p.delete()
            return JsonResponse({"status": "success"})
    except AIProvider.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def admin_templates_detail(request, template_id):
    from .models import AgentTemplate
    import json
    try:
        t = AgentTemplate.objects.get(id=template_id)
        if request.method == "PUT":
            data = json.loads(request.body)
            t.name = data.get('name', t.name)
            t.description = data.get('description', t.description)
            t.system_prompt = data.get('system_prompt', t.system_prompt)
            t.is_active = data.get('is_active', True) == 'on' or data.get('is_active') is True
            t.agent_type = data.get('agent_type', t.agent_type)
            t.enabled_tools = data.get('enabled_tools', t.enabled_tools)
            if 'provider_id' in data:
                provider_id = data.get('provider_id')
                if not provider_id or provider_id in ('', 'none', 'null', 'undefined'):
                    t.provider_id = None
                else:
                    try:
                        t.provider_id = int(provider_id)
                    except (ValueError, TypeError):
                        t.provider_id = None
            t.save()
            return JsonResponse({"id": t.id, "status": "success"})
        elif request.method == "DELETE":
            t.delete()
            return JsonResponse({"status": "success"})
    except AgentTemplate.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_assignments(request):
    """
    Endpoint para listar y crear asignaciones de agentes.
    """
    from .models import AgentAssignment, AgentTemplate
    import json
    
    if request.method == "GET":
        assignments_qs = AgentAssignment.objects.select_related('agent').all()
        assignments_list = []
        
        # Cargar nombres de facultades/deptos/carreras para enriquecer la respuesta
        from .models import CoreFaculty, CoreDepartment, CoreCareer
        faculties = {f.id: f.name for f in CoreFaculty.objects.all()}
        departments = {d.id: d.name for d in CoreDepartment.objects.all()}
        careers = {c.id: c.name for c in CoreCareer.objects.all()}
        
        for a in assignments_qs:
            assignments_list.append({
                "id": a.id,
                "agent_id": a.agent_id,
                "agent_name": a.agent.name,
                "faculty_id": a.faculty_id,
                "faculty_name": faculties.get(a.faculty_id) if a.faculty_id else None,
                "department_id": a.department_id,
                "department_name": departments.get(a.department_id) if a.department_id else None,
                "career_id": a.career_id,
                "career_name": careers.get(a.career_id) if a.career_id else None,
                "subject_code": a.subject_code,
                "section": a.section,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat()
            })
        return JsonResponse(assignments_list, safe=False)
        
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            agent_id = data.get('agent_id')
            if not agent_id:
                return JsonResponse({"error": "Debe especificar un agente."}, status=400)
            
            fac_id = data.get('faculty_id')
            dep_id = data.get('department_id')
            car_id = data.get('career_id')
            sub_code = data.get('subject_code')
            sect = data.get('section')
            
            if not any([fac_id, dep_id, car_id, sub_code]):
                return JsonResponse({"error": "Debe especificar al menos un criterio de asignación (Facultad, Departamento, Carrera o Asignatura)."}, status=400)
                
            a = AgentAssignment.objects.create(
                agent_id=int(agent_id),
                faculty_id=int(fac_id) if (fac_id and fac_id != 'none') else None,
                department_id=int(dep_id) if (dep_id and dep_id != 'none') else None,
                career_id=int(car_id) if (car_id and car_id != 'none') else None,
                subject_code=sub_code.strip() if (sub_code and sub_code.strip() and sub_code.strip() != 'none') else None,
                section=sect.strip() if (sect and sect.strip() and sect.strip() != 'none') else None,
                is_active=True
            )
            return JsonResponse({"id": a.id, "status": "success"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["DELETE", "PUT"])
def admin_assignments_detail(request, assignment_id):
    """
    Endpoint para eliminar o actualizar una asignación de agente específica.
    """
    from .models import AgentAssignment
    import json
    try:
        a = AgentAssignment.objects.get(id=assignment_id)
        if request.method == "DELETE":
            a.delete()
            return JsonResponse({"status": "success"})
        elif request.method == "PUT":
            data = json.loads(request.body)
            if 'is_active' in data and len(data) == 1:
                a.is_active = data['is_active']
                a.save()
                return JsonResponse({"status": "success", "is_active": a.is_active})
            else:
                if 'agent_id' in data:
                    a.agent_id = int(data['agent_id'])
                if 'faculty_id' in data:
                    fac_id = data['faculty_id']
                    a.faculty_id = int(fac_id) if (fac_id and fac_id != 'none') else None
                if 'department_id' in data:
                    dep_id = data['department_id']
                    a.department_id = int(dep_id) if (dep_id and dep_id != 'none') else None
                if 'career_id' in data:
                    car_id = data['career_id']
                    a.career_id = int(car_id) if (car_id and car_id != 'none') else None
                if 'subject_code' in data:
                    sub_code = data['subject_code']
                    a.subject_code = sub_code.strip() if (sub_code and sub_code.strip() and sub_code.strip() != 'none') else None
                if 'section' in data:
                    sect = data['section']
                    a.section = sect.strip() if (sect and sect.strip() and sect.strip() != 'none') else None
                a.save()
                return JsonResponse({"status": "success"})
    except AgentAssignment.DoesNotExist:
        return JsonResponse({"error": "Asignación no encontrada"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


def get_request_user(request):
    """
    Obtiene el usuario basándose en los headers enviados por el core gateway API.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None
    from .models import CoreUser
    try:
        return CoreUser.objects.get(id=int(user_id))
    except (CoreUser.DoesNotExist, ValueError):
        return None


@csrf_exempt
@require_http_methods(["POST"])
def chat_rag(request):
    """
    Endpoint para Chat RAG interactivo.
    """
    import json
    import os
    from .models import AIProvider, SyllabusChunk, LessonPlanChunk, ChatSession, ChatMessage
    from .tasks import get_embeddings_model, get_llm_model
    from pgvector.django import L2Distance
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
    
    if not AIProvider.objects.filter(is_active=True).exists():
        return JsonResponse({"error": "No hay un proveedor de IA activo configurado."}, status=400)

    try:
        user = get_request_user(request)
        if not user:
            return JsonResponse({"error": "Usuario no identificado."}, status=401)

        data = json.loads(request.body)
        user_message = data.get('message', '')
        session_id = data.get('session_id')
        agent_id = data.get('agent_id')

        if not user_message:
            return JsonResponse({"error": "El mensaje no puede estar vacío."}, status=400)

        # 1. Determinar o crear la sesión
        if session_id and session_id != 'new' and session_id != 'none':
            session = ChatSession.objects.filter(id=session_id, user=user).first()
            if not session:
                return JsonResponse({"error": "Sesión de chat no encontrada o inaccesible."}, status=404)
            
            # Sincronizar el agente seleccionado para la sesión actual si se envía en el request
            if 'agent_id' in data:
                req_agent_id = data.get('agent_id')
                new_agent_id = req_agent_id if (req_agent_id and req_agent_id != 'none') else None
                if session.agent_id != new_agent_id:
                    session.agent_id = new_agent_id
                    session.save(update_fields=['agent_id'])
        else:
            # Nueva sesión
            title = user_message[:50] + ("..." if len(user_message) > 50 else "")
            session = ChatSession.objects.create(
                user=user,
                title=title,
                agent_id=agent_id if agent_id and agent_id != 'none' else None
            )

        # 2. Cargar historial desde la DB
        db_messages = ChatMessage.objects.filter(session=session).order_by('created_at')
        chat_history = []
        for msg in db_messages:
            if msg.sender == 'user':
                chat_history.append(HumanMessage(content=msg.content))
            elif msg.sender == 'assistant':
                chat_history.append(AIMessage(content=msg.content))

        # Guardar mensaje actual del usuario en la DB
        ChatMessage.objects.create(session=session, sender='user', content=user_message)

        # 3. Inicializar LLM
        provider = AIProvider.objects.filter(is_active=True).first()
        llm = get_llm_model(provider)

        agent_template = None
        current_agent_id = session.agent_id
        if current_agent_id:
            from .models import AgentTemplate
            agent_template = AgentTemplate.objects.filter(id=current_agent_id).first()

        # Configurar prompt del sistema
        system_prompt = "Eres un asistente experto en pedagogía universitaria."
        if agent_template and agent_template.system_prompt:
            system_prompt = agent_template.system_prompt
        elif os.environ.get("CHAT_RAG_SYSTEM_PROMPT"):
            system_prompt = os.environ.get("CHAT_RAG_SYSTEM_PROMPT")

        if agent_template and agent_template.enabled_tools:
            # Flujo AGENTIC RAG
            from .tools import get_tools_by_names
            from langchain_classic.agents import create_tool_calling_agent, AgentExecutor
            from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
            
            tools = get_tools_by_names(agent_template.enabled_tools)
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ])
            
            agent = create_tool_calling_agent(llm, tools, prompt)
            agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
            
            try:
                response = agent_executor.invoke({
                    "input": user_message,
                    "chat_history": chat_history
                })
                reply_text = response["output"]
            except Exception as llm_error:
                error_str = str(llm_error)
                if 'Model unloaded' in error_str:
                    return JsonResponse({"error": "El modelo de texto no está cargado."}, status=400)
                raise llm_error
                
        else:
            # Flujo RAG TRADICIONAL AVANZADO con LangGraph, Hybrid Search y Re-ranking
            from .rag_graph import rag_graph
            try:
                initial_state = {
                    "messages": chat_history + [HumanMessage(content=user_message)],
                    "user_query": user_message
                }
                graph_result = rag_graph.invoke(
                    initial_state,
                    config={"configurable": {"llm": llm, "system_prompt": system_prompt}}
                )
                if graph_result.get("error"):
                    raise ValueError(graph_result["error"])
                last_msg = graph_result["messages"][-1]
                reply_text = last_msg.content
            except Exception as graph_error:
                raise graph_error

        # Convertir respuesta a string y dar formato al razonamiento ("thought" / "thinking")
        if isinstance(reply_text, list):
            text_parts = []
            thought_parts = []
            for part in reply_text:
                if isinstance(part, dict):
                    part_type = part.get("type")
                    part_text = part.get("text", "")
                    if part_type == "thought" or part_type == "reasoning":
                        thought_parts.append(part_text)
                    else:
                        text_parts.append(part_text)
                elif isinstance(part, str):
                    text_parts.append(part)
            
            final_text = "".join(text_parts)
            if thought_parts:
                thought_text = "".join(thought_parts).strip()
                if thought_text:
                    reply_text = (
                        f"<details class=\"mb-4 bg-muted/40 border p-3 rounded-lg\">\n"
                        f"  <summary class=\"cursor-pointer text-xs font-bold text-muted-foreground select-none\">💡 Ver razonamiento del agente...</summary>\n"
                        f"  <div class=\"text-xs text-muted-foreground mt-2 whitespace-pre-wrap font-sans\">{thought_text}</div>\n"
                        f"</details>\n\n"
                        f"{final_text}"
                    )
                else:
                    reply_text = final_text
            else:
                reply_text = final_text
        elif not isinstance(reply_text, str):
            reply_text = str(reply_text)

        # Guardar respuesta de la IA en la DB
        ChatMessage.objects.create(session=session, sender='assistant', content=reply_text)

        return JsonResponse({
            "status": "success",
            "reply": reply_text,
            "session_id": session.id,
            "session_title": session.title
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": f"Error en el chat: {str(e)}"}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def list_chat_sessions(request):
    """
    Lista las sesiones del usuario agrupadas por temporalidad.
    """
    user = get_request_user(request)
    if not user:
        return JsonResponse({"error": "Usuario no identificado."}, status=401)

    from .models import ChatSession
    from datetime import date, timedelta
    
    sessions = ChatSession.objects.filter(user=user).order_by('-created_at')
    
    today = date.today()
    yesterday = today - timedelta(days=1)
    seven_days_ago = today - timedelta(days=7)
    thirty_days_ago = today - timedelta(days=30)
    
    grouped = {
        "Hoy": [],
        "Ayer": [],
        "Esta semana": [],
        "Hace un mes": [],
        "Más antiguos": []
    }
    
    for s in sessions:
        s_date = s.created_at.date()
        item = {
            "id": s.id,
            "title": s.title,
            "agent_id": s.agent_id,
            "created_at": s.created_at.isoformat()
        }
        if s_date == today:
            grouped["Hoy"].append(item)
        elif s_date == yesterday:
            grouped["Ayer"].append(item)
        elif s_date > seven_days_ago:
            grouped["Esta semana"].append(item)
        elif s_date > thirty_days_ago:
            grouped["Hace un mes"].append(item)
        else:
            grouped["Más antiguos"].append(item)
            
    filtered_grouped = {k: v for k, v in grouped.items() if v}
    return JsonResponse(filtered_grouped)


@csrf_exempt
@require_http_methods(["GET"])
def get_chat_messages(request, session_id):
    """
    Obtiene todos los mensajes de una sesión de chat.
    """
    user = get_request_user(request)
    if not user:
        return JsonResponse({"error": "Usuario no identificado."}, status=401)

    from .models import ChatSession, ChatMessage
    session = ChatSession.objects.filter(id=session_id, user=user).first()
    if not session:
        return JsonResponse({"error": "Sesión de chat no encontrada."}, status=404)

    messages = ChatMessage.objects.filter(session=session).order_by('created_at')
    output = []
    for msg in messages:
        output.append({
            "id": msg.id,
            "role": msg.sender,
            "content": msg.content,
            "created_at": msg.created_at.isoformat()
        })
    return JsonResponse({"session_title": session.title, "messages": output})


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_chat_session(request, session_id):
    """
    Elimina una sesión de chat específica.
    """
    user = get_request_user(request)
    if not user:
        return JsonResponse({"error": "Usuario no identificado."}, status=401)

    from .models import ChatSession
    session = ChatSession.objects.filter(id=session_id, user=user).first()
    if not session:
        return JsonResponse({"error": "Sesión no encontrada."}, status=404)

    session.delete()
    return JsonResponse({"status": "success", "message": "Sesión de chat eliminada."})


@csrf_exempt
@require_http_methods(["DELETE"])
def clear_all_chats(request):
    """
    Limpia todas las sesiones de chat de este usuario (borrado masivo).
    """
    user = get_request_user(request)
    if not user:
        return JsonResponse({"error": "Usuario no identificado."}, status=401)

    from .models import ChatSession
    ChatSession.objects.filter(user=user).delete()
    return JsonResponse({"status": "success", "message": "Historial de chat completamente limpio."})


@csrf_exempt
@require_http_methods(["GET"])
def ai_metrics_summary(request):
    """
    Retorna resumen analítico de métricas de IA para Super Admins y Administradores de Gestión.
    """
    user = get_request_user(request)
    if not user or user.role not in ['SUPER_ADMIN', 'ADMIN_GESTION']:
        return JsonResponse({"error": "No autorizado"}, status=403)

    from django.db.models import Count, Sum
    from django.utils.dateparse import parse_datetime
    from .models import EvaluationResult, ChatSession, ChatMessage, AILog
    import datetime
    from collections import defaultdict

    start_date_str = request.GET.get('start_date')
    end_date_str = request.GET.get('end_date')

    eval_qs = EvaluationResult.objects.all()
    chat_qs = ChatSession.objects.all()
    msg_qs = ChatMessage.objects.all()
    log_qs = AILog.objects.all()

    if start_date_str:
        try:
            dt_start = datetime.datetime.strptime(start_date_str, "%Y-%m-%d")
            eval_qs = eval_qs.filter(created_at__gte=dt_start)
            chat_qs = chat_qs.filter(created_at__gte=dt_start)
            msg_qs = msg_qs.filter(session__created_at__gte=dt_start)
            log_qs = log_qs.filter(created_at__gte=dt_start)
        except Exception:
            pass
    if end_date_str:
        try:
            dt_end = datetime.datetime.strptime(end_date_str, "%Y-%m-%d") + datetime.timedelta(days=1)
            eval_qs = eval_qs.filter(created_at__lt=dt_end)
            chat_qs = chat_qs.filter(created_at__lt=dt_end)
            msg_qs = msg_qs.filter(session__created_at__lt=dt_end)
            log_qs = log_qs.filter(created_at__lt=dt_end)
        except Exception:
            pass

    total_evals = eval_qs.count()
    success_evals = eval_qs.filter(status='SUCCESS').count()
    failed_evals = eval_qs.filter(status='ERROR').count()
    total_chats = chat_qs.count()
    total_messages = msg_qs.count()

    # Suma de tokens desde AILog para cubrir vectorización y evaluaciones
    tokens_agg = log_qs.aggregate(
        total_prompt=Sum('prompt_tokens'),
        total_completion=Sum('completion_tokens')
    )
    total_prompt_tokens = tokens_agg.get('total_prompt') or 0
    total_completion_tokens = tokens_agg.get('total_completion') or 0
    total_tokens = total_prompt_tokens + total_completion_tokens

    # Distrubución por agente
    agent_evals = []
    for ae in eval_qs.values('agent__name').annotate(count=Count('id')).order_by('-count'):
        agent_evals.append({
            "name": ae['agent__name'] or "Por Defecto",
            "count": ae['count']
        })

    # Top chatters
    top_chatters = []
    for tc in chat_qs.values('user__full_name', 'user__email', 'user__role').annotate(count=Count('id')).order_by('-count')[:5]:
        top_chatters.append({
            "full_name": tc['user__full_name'],
            "email": tc['user__email'],
            "role": tc['user__role'],
            "count": tc['count']
        })

    # Últimas 10 evaluaciones
    last_evaluations = []
    for ev in eval_qs.select_related('lesson_plan', 'lesson_plan__author', 'agent').order_by('-created_at')[:10]:
        obs_count = 0
        if ev.result_data and isinstance(ev.result_data, dict):
            obs = ev.result_data.get('observaciones') or ev.result_data.get('observations') or ev.result_data.get('deficiencies') or []
            if isinstance(obs, list):
                obs_count = len(obs)

        last_evaluations.append({
            "id": ev.id,
            "lesson_plan_title": ev.lesson_plan.title if ev.lesson_plan else "N/A",
            "subject_code": ev.lesson_plan.subject_code if ev.lesson_plan else "N/A",
            "author_name": ev.lesson_plan.author.full_name if ev.lesson_plan and ev.lesson_plan.author else "N/A",
            "agent_name": ev.agent.name if ev.agent else "Por Defecto",
            "status": ev.status,
            "observations_count": obs_count,
            "prompt_tokens": ev.prompt_tokens,
            "completion_tokens": ev.completion_tokens,
            "created_at": ev.created_at.isoformat()
        })

    # Historial diario de tokens para el gráfico estructurado por semanas académicas (S0-S12)
    from .models import CoreAcademicPeriod
    
    active_period = CoreAcademicPeriod.objects.filter(is_active=True).first()
    today = datetime.datetime.utcnow()
    
    if active_period and active_period.start_date:
        start_date_dt = datetime.datetime.combine(active_period.start_date, datetime.time.min)
        monday_offset = start_date_dt.weekday()
        period_start = start_date_dt - datetime.timedelta(days=monday_offset)
    else:
        monday_offset = today.weekday()
        period_start = today - datetime.timedelta(days=monday_offset + 91 - 7)
        period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
    period_end = period_start + datetime.timedelta(days=91)
    
    # Obtener lista de proveedores y modelos que tienen consumo registrado en los logs
    available_providers = list(log_qs.exclude(provider_name__isnull=True).exclude(provider_name='').values_list('provider_name', flat=True).distinct())
    available_models = list(log_qs.exclude(model_name__isnull=True).exclude(model_name='').values_list('model_name', flat=True).distinct())

    # Agrupar logs del periodo
    logs_in_period = list(log_qs.filter(created_at__gte=period_start, created_at__lt=period_end))

    # Agrupar tokens por fecha total
    tokens_by_day = defaultdict(lambda: {"prompt_tokens": 0, "completion_tokens": 0})
    for log in logs_in_period:
        d = log.created_at.date()
        tokens_by_day[d]["prompt_tokens"] += log.prompt_tokens
        tokens_by_day[d]["completion_tokens"] += log.completion_tokens

    # Agrupar tokens por fecha y proveedor
    tokens_by_day_provider = defaultdict(lambda: defaultdict(lambda: {"prompt_tokens": 0, "completion_tokens": 0}))
    for log in logs_in_period:
        if log.provider_name:
            d = log.created_at.date()
            tokens_by_day_provider[log.provider_name][d]["prompt_tokens"] += log.prompt_tokens
            tokens_by_day_provider[log.provider_name][d]["completion_tokens"] += log.completion_tokens

    # Agrupar tokens por fecha y modelo
    tokens_by_day_model = defaultdict(lambda: defaultdict(lambda: {"prompt_tokens": 0, "completion_tokens": 0}))
    for log in logs_in_period:
        if log.model_name:
            d = log.created_at.date()
            tokens_by_day_model[log.model_name][d]["prompt_tokens"] += log.prompt_tokens
            tokens_by_day_model[log.model_name][d]["completion_tokens"] += log.completion_tokens
        
    days_es = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    current_date = today.date()
    
    # 1. Serie Total
    tokens_series = []
    for w in range(13):
        for d in range(7):
            day_dt = period_start + datetime.timedelta(days=w*7 + d)
            is_future = day_dt.date() > current_date
            
            day_data = tokens_by_day[day_dt.date()]
            prompt_val = 0 if is_future else day_data["prompt_tokens"]
            comp_val = 0 if is_future else day_data["completion_tokens"]
            
            tokens_series.append({
                "name": f"S{w}-{days_es[d]}",
                "date": day_dt.strftime("%d/%m"),
                "full_date": day_dt.strftime("%d/%m/%Y"),
                "prompt_tokens": prompt_val,
                "completion_tokens": comp_val,
                "total_tokens": prompt_val + comp_val,
                "weekIndex": w,
                "is_today": day_dt.date() == current_date
            })

    # 2. Series por Proveedor
    tokens_series_by_provider = {}
    for prov in available_providers:
        prov_series = []
        for w in range(13):
            for d in range(7):
                day_dt = period_start + datetime.timedelta(days=w*7 + d)
                is_future = day_dt.date() > current_date
                
                day_data = tokens_by_day_provider[prov][day_dt.date()]
                prompt_val = 0 if is_future else day_data["prompt_tokens"]
                comp_val = 0 if is_future else day_data["completion_tokens"]
                
                prov_series.append({
                    "name": f"S{w}-{days_es[d]}",
                    "date": day_dt.strftime("%d/%m"),
                    "full_date": day_dt.strftime("%d/%m/%Y"),
                    "prompt_tokens": prompt_val,
                    "completion_tokens": comp_val,
                    "total_tokens": prompt_val + comp_val,
                    "weekIndex": w,
                    "is_today": day_dt.date() == current_date
                })
        tokens_series_by_provider[prov] = prov_series

    # 3. Series por Modelo
    tokens_series_by_model = {}
    for mod in available_models:
        mod_series = []
        for w in range(13):
            for d in range(7):
                day_dt = period_start + datetime.timedelta(days=w*7 + d)
                is_future = day_dt.date() > current_date
                
                day_data = tokens_by_day_model[mod][day_dt.date()]
                prompt_val = 0 if is_future else day_data["prompt_tokens"]
                comp_val = 0 if is_future else day_data["completion_tokens"]
                
                mod_series.append({
                    "name": f"S{w}-{days_es[d]}",
                    "date": day_dt.strftime("%d/%m"),
                    "full_date": day_dt.strftime("%d/%m/%Y"),
                    "prompt_tokens": prompt_val,
                    "completion_tokens": comp_val,
                    "total_tokens": prompt_val + comp_val,
                    "weekIndex": w,
                    "is_today": day_dt.date() == current_date
                })
        tokens_series_by_model[mod] = mod_series

    return JsonResponse({
        "total_evaluations": total_evals,
        "success_evaluations": success_evals,
        "failed_evaluations": failed_evals,
        "total_chats": total_chats,
        "total_messages": total_messages,
        "total_prompt_tokens": total_prompt_tokens,
        "total_completion_tokens": total_completion_tokens,
        "total_tokens": total_tokens,
        "agent_evaluations": agent_evals,
        "top_chatters": top_chatters,
        "last_evaluations": last_evaluations,
        "tokens_series": tokens_series,
        "available_providers": available_providers,
        "available_models": available_models,
        "tokens_series_by_provider": tokens_series_by_provider,
        "tokens_series_by_model": tokens_series_by_model
    })



@csrf_exempt
@require_http_methods(["GET"])
def ai_metrics_evaluations_export(request):
    """
    Exporta el historial de evaluaciones de IA en CSV compatible con Excel.
    """
    user = get_request_user(request)
    if not user or user.role not in ['SUPER_ADMIN', 'ADMIN_GESTION']:
        return HttpResponse("No autorizado", status=403)

    from .models import EvaluationResult
    import datetime
    import csv
    from django.http import HttpResponse

    start_date_str = request.GET.get('start_date')
    end_date_str = request.GET.get('end_date')

    eval_qs = EvaluationResult.objects.all()
    if start_date_str:
        try:
            dt_start = datetime.datetime.strptime(start_date_str, "%Y-%m-%d")
            eval_qs = eval_qs.filter(created_at__gte=dt_start)
        except Exception:
            pass
    if end_date_str:
        try:
            dt_end = datetime.datetime.strptime(end_date_str, "%Y-%m-%d") + datetime.timedelta(days=1)
            eval_qs = eval_qs.filter(created_at__lt=dt_end)
        except Exception:
            pass

    eval_qs = eval_qs.select_related('lesson_plan', 'lesson_plan__author', 'agent').order_by('-created_at')

    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = 'attachment; filename="reporte_evaluaciones_ia.csv"'
    
    # Escribir BOM UTF-8 para compatibilidad absoluta con Excel en español
    response.write('\ufeff'.encode('utf-8'))

    writer = csv.writer(response, delimiter=';')
    writer.writerow([
        "ID Evaluacion", "Plan de Clase", "Codigo Asignatura", 
        "Docente", "Correo Docente", "Agente Utilizado", 
        "Estado", "Obs Encontradas", "Tokens Entrada", "Tokens Salida", "Tokens Totales", "Fecha Evaluacion", "Mensaje Error"
    ])

    for ev in eval_qs:
        obs_count = 0
        if ev.result_data and isinstance(ev.result_data, dict):
            obs = ev.result_data.get('observaciones') or ev.result_data.get('observations') or ev.result_data.get('deficiencies') or []
            if isinstance(obs, list):
                obs_count = len(obs)

        writer.writerow([
            ev.id,
            ev.lesson_plan.title if ev.lesson_plan else "N/A",
            ev.lesson_plan.subject_code if ev.lesson_plan else "N/A",
            ev.lesson_plan.author.full_name if ev.lesson_plan and ev.lesson_plan.author else "N/A",
            ev.lesson_plan.author.email if ev.lesson_plan and ev.lesson_plan.author else "N/A",
            ev.agent.name if ev.agent else "Por Defecto",
            ev.status,
            obs_count,
            ev.prompt_tokens,
            ev.completion_tokens,
            ev.prompt_tokens + ev.completion_tokens,
            ev.created_at.strftime("%Y-%m-%d %H:%M:%S") if ev.created_at else "",
            ev.error_message or ""
        ])

    return response



@csrf_exempt
@require_http_methods(["GET"])
def ai_metrics_chats_export(request):
    """
    Exporta el historial de chats de IA en CSV compatible con Excel.
    """
    user = get_request_user(request)
    if not user or user.role not in ['SUPER_ADMIN', 'ADMIN_GESTION']:
        return HttpResponse("No autorizado", status=403)

    from .models import ChatSession
    import datetime
    import csv
    from django.http import HttpResponse

    start_date_str = request.GET.get('start_date')
    end_date_str = request.GET.get('end_date')

    chat_qs = ChatSession.objects.all()
    if start_date_str:
        try:
            dt_start = datetime.datetime.strptime(start_date_str, "%Y-%m-%d")
            chat_qs = chat_qs.filter(created_at__gte=dt_start)
        except Exception:
            pass
    if end_date_str:
        try:
            dt_end = datetime.datetime.strptime(end_date_str, "%Y-%m-%d") + datetime.timedelta(days=1)
            chat_qs = chat_qs.filter(created_at__lt=dt_end)
        except Exception:
            pass

    chat_qs = chat_qs.select_related('user', 'agent').order_by('-created_at')

    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = 'attachment; filename="reporte_chats_ia.csv"'
    
    response.write('\ufeff'.encode('utf-8'))

    writer = csv.writer(response, delimiter=';')
    writer.writerow([
        "ID Sesion", "Usuario", "Correo Usuario", "Rol", 
        "Agente Utilizado", "Titulo Sesion", "Cantidad Mensajes", "Fecha Creacion"
    ])

    for ch in chat_qs:
        msg_count = ch.messages.count()
        writer.writerow([
            ch.id,
            ch.user.full_name if ch.user else "N/A",
            ch.user.email if ch.user else "N/A",
            ch.user.role if ch.user else "N/A",
            ch.agent.name if ch.agent else "Por Defecto",
            ch.title,
            msg_count,
            ch.created_at.strftime("%Y-%m-%d %H:%M:%S") if ch.created_at else ""
        ])

    return response


@csrf_exempt
@require_http_methods(["GET"])
def ai_metrics_tokens_export(request):
    """
    Exporta el reporte del consumo de tokens agrupado por día/semana académica en CSV compatible con Excel.
    """
    user = get_request_user(request)
    if not user or user.role not in ['SUPER_ADMIN', 'ADMIN_GESTION']:
        return HttpResponse("No autorizado", status=403)

    from .models import CoreAcademicPeriod, EvaluationResult
    import datetime
    import csv
    from django.http import HttpResponse
    from collections import defaultdict

    eval_qs = EvaluationResult.objects.all()

    active_period = CoreAcademicPeriod.objects.filter(is_active=True).first()
    today = datetime.datetime.utcnow()
    
    if active_period and active_period.start_date:
        start_date_dt = datetime.datetime.combine(active_period.start_date, datetime.time.min)
        monday_offset = start_date_dt.weekday()
        period_start = start_date_dt - datetime.timedelta(days=monday_offset)
    else:
        monday_offset = today.weekday()
        period_start = today - datetime.timedelta(days=monday_offset + 91 - 7)
        period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
    period_end = period_start + datetime.timedelta(days=91)
    
    # Agrupar tokens por fecha
    tokens_by_day = defaultdict(lambda: {"prompt_tokens": 0, "completion_tokens": 0})
    evals_in_period = eval_qs.filter(created_at__gte=period_start, created_at__lt=period_end)
    for ev in evals_in_period:
        d = ev.created_at.date()
        tokens_by_day[d]["prompt_tokens"] += ev.prompt_tokens
        tokens_by_day[d]["completion_tokens"] += ev.completion_tokens
        
    response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
    response['Content-Disposition'] = 'attachment; filename="reporte_consumo_tokens_ia.csv"'
    response.write('\ufeff'.encode('utf-8'))

    writer = csv.writer(response, delimiter=';')
    writer.writerow([
        "Semana Academica", "Dia", "Fecha Calendario", "Tokens Entrada (Prompt)", "Tokens Salida (Completion)", "Tokens Totales"
    ])

    days_es = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    current_date = today.date()
    
    for w in range(13):
        for d in range(7):
            day_dt = period_start + datetime.timedelta(days=w*7 + d)
            is_future = day_dt.date() > current_date
            
            day_data = tokens_by_day[day_dt.date()]
            prompt_val = 0 if is_future else day_data["prompt_tokens"]
            comp_val = 0 if is_future else day_data["completion_tokens"]
            
            writer.writerow([
                f"Semana {w}",
                days_es[d],
                day_dt.strftime("%Y-%m-%d"),
                prompt_val,
                comp_val,
                prompt_val + comp_val
            ])

    return response


