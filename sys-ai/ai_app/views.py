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
    con los programas sinópticos.
    """
    from .models import CoreSyllabusVersion, SyllabusChunk
    
    # Todos los sinópticos activos
    total_active_syllabuses = CoreSyllabusVersion.objects.filter(is_active=True).count()
    
    # Cuántos de esos tienen chunks asociados
    # Buscamos IDs de syllabuses que tienen al menos un chunk
    synced_syllabuses_ids = SyllabusChunk.objects.values_list('syllabus_id', flat=True).distinct()
    
    # Filtramos para asegurarnos de que contamos solo los activos
    total_synced = CoreSyllabusVersion.objects.filter(id__in=synced_syllabuses_ids, is_active=True).count()
    
    return JsonResponse({
        "total_active_syllabuses": total_active_syllabuses,
        "total_synced": total_synced,
        "is_fully_synced": total_active_syllabuses > 0 and total_active_syllabuses == total_synced
    })

@csrf_exempt
@require_http_methods(["POST"])
def sync_all_syllabuses(request):
    """
    Endpoint para que el Super Admin sincronice manualmente todos los programas sinópticos
    activos que aún no tienen vectores.
    """
    from .models import CoreSyllabusVersion, SyllabusChunk, AIProvider
    from django_q.tasks import async_task
    
    if not AIProvider.objects.filter(is_active=True).exists():
        return JsonResponse({"error": "El sistema no tiene un modelo de IA configurado o activo. Por favor configure uno en la sección de Proveedores."}, status=400)

    
    # Obtenemos los activos
    active_syllabuses = CoreSyllabusVersion.objects.filter(is_active=True)
    
    tasks_queued = 0
    for syllabus in active_syllabuses:
        # Podríamos sincronizar solo los que faltan o forzar todos. 
        # Aquí forzamos todos para estar seguros, la tarea ya borra los chunks viejos.
        async_task('ai_app.tasks.ingest_syllabus_task', syllabus.id)
        tasks_queued += 1
        
    return JsonResponse({
        "status": "success",
        "message": f"Se han encolado {tasks_queued} sinópticos para sincronización en segundo plano."
    })

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
            t = AgentTemplate.objects.create(
                name=data.get('name', 'Nuevo Agente'),
                description=data.get('description', ''),
                system_prompt=data.get('system_prompt', ''),
                is_active=data.get('is_active', True) == 'on' or data.get('is_active') is True
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
    
    logs_qs = AILog.objects.all()[:30]
    
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
        
        # Obtener lista de modelos usando el cliente base de openai
        models_list = []
        if test_target == 'all':
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
            if provider_type == "lmstudio" and not data.get('embedding_model'):
                emb_model_name = "local-model"
                
            from openai import OpenAI
            client = OpenAI(
                api_key=api_key or "dummy",
                base_url=base_url if base_url else None
            )
            # Intenta hacer un embedding de prueba directo con el cliente OpenAI
            res = client.embeddings.create(input=["Prueba de conexion"], model=emb_model_name)
            if len(res.data) > 0 and len(res.data[0].embedding) > 0:
                response_text = f"Embedding OK (Dim: {len(res.data[0].embedding)})"
        
        elif test_target == 'all':
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
            p.name = data.get('name', p.name)
            p.provider_type = data.get('provider_type', p.provider_type)
            p.base_url = data.get('base_url', p.base_url)
            p.embedding_model = data.get('embedding_model', p.embedding_model)
            p.llm_model = data.get('llm_model', p.llm_model)
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
            t.save()
            return JsonResponse({"id": t.id, "status": "success"})
        elif request.method == "DELETE":
            t.delete()
            return JsonResponse({"status": "success"})
    except AgentTemplate.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
