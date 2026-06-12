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
    from .models import CoreSyllabusVersion, SyllabusChunk, CoreLessonPlan, LessonPlanChunk
    
    # Todos los sinópticos activos
    total_active_syllabuses = CoreSyllabusVersion.objects.filter(is_active=True).count()
    
    # Cuántos de esos tienen chunks asociados
    synced_syllabuses_ids = SyllabusChunk.objects.values_list('syllabus_id', flat=True).distinct()
    total_synced_syllabuses = CoreSyllabusVersion.objects.filter(id__in=synced_syllabuses_ids, is_active=True).count()

    # Todos los planes aprobados
    total_approved_plans = CoreLessonPlan.objects.filter(status='APPROVED').count()

    # Cuántos de esos tienen chunks
    synced_plans_ids = LessonPlanChunk.objects.values_list('lesson_plan_id', flat=True).distinct()
    total_synced_plans = CoreLessonPlan.objects.filter(id__in=synced_plans_ids, status='APPROVED').count()
    
    # Buscamos si hay alguna tarea de vectorización en progreso
    from .models import AILog
    latest_log = AILog.objects.filter(status='started', action__startswith='Vectorización').order_by('-created_at').first()
    current_task_detail = latest_log.details if latest_log else None
    
    return JsonResponse({
        "total_active_syllabuses": total_active_syllabuses,
        "total_synced": total_synced_syllabuses,
        "is_fully_synced": total_active_syllabuses > 0 and total_active_syllabuses == total_synced_syllabuses,
        "total_approved_plans": total_approved_plans,
        "total_synced_plans": total_synced_plans,
        "is_plans_fully_synced": total_approved_plans > 0 and total_approved_plans == total_synced_plans,
        "current_task_detail": current_task_detail
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
@require_http_methods(["POST"])
def sync_all_plans(request):
    """
    Endpoint para que el Super Admin sincronice manualmente todos los planes aprobados.
    """
    from .models import CoreLessonPlan, AIProvider
    from django_q.tasks import async_task
    
    if not AIProvider.objects.filter(is_active=True).exists():
        return JsonResponse({"error": "El sistema no tiene un modelo de IA configurado o activo."}, status=400)
    
    approved_plans = CoreLessonPlan.objects.filter(status='APPROVED')
    tasks_queued = 0
    for plan in approved_plans:
        async_task('ai_app.tasks.ingest_lesson_plan_task', plan.id)
        tasks_queued += 1
        
    return JsonResponse({
        "status": "success",
        "message": f"Se han encolado {tasks_queued} planes para sincronización en segundo plano."
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
                is_active=data.get('is_active', True) == 'on' or data.get('is_active') is True,
                agent_type=data.get('agent_type', 'chat'),
                enabled_tools=data.get('enabled_tools', []),
                provider_id=data.get('provider_id')
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
                t.provider_id = data.get('provider_id')
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
            from langchain.agents import create_tool_calling_agent, AgentExecutor
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
            # Flujo RAG TRADICIONAL FALLBACK (si no hay tools)
            embeddings_model = get_embeddings_model()
            try:
                query_vector = embeddings_model.embed_query(user_message)
            except Exception as emb_error:
                raise emb_error

            syllabus_chunks = list(SyllabusChunk.objects.select_related('syllabus__subject').annotate(distance=L2Distance('embedding', query_vector)).order_by('distance')[:5])
            plan_chunks = list(LessonPlanChunk.objects.select_related('lesson_plan').annotate(distance=L2Distance('embedding', query_vector)).order_by('distance')[:5])
            combined_chunks = sorted(syllabus_chunks + plan_chunks, key=lambda x: getattr(x, 'distance', 999))[:5]

            context_texts = []
            for c in combined_chunks:
                if isinstance(c, SyllabusChunk):
                    context_texts.append(f"[FUENTE: Sinóptico | Asignatura: {c.syllabus.subject.code}]\n{c.content}")
                else:
                    context_texts.append(f"[FUENTE: Plan Aprobado | Título: {c.lesson_plan.title}]\n{c.content}")
            
            context_str = "\n\n---\n\n".join(context_texts)
            full_prompt = f"{system_prompt}\n\nCONTEXTO DE BÚSQUEDA:\n{context_str}"
            
            messages = [SystemMessage(content=full_prompt)] + chat_history + [HumanMessage(content=user_message)]
            
            try:
                response = llm.invoke(messages)
                reply_text = response.content
            except Exception as llm_error:
                raise llm_error

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
    from .models import EvaluationResult, ChatSession, ChatMessage
    import datetime

    start_date_str = request.GET.get('start_date')
    end_date_str = request.GET.get('end_date')

    eval_qs = EvaluationResult.objects.all()
    chat_qs = ChatSession.objects.all()
    msg_qs = ChatMessage.objects.all()

    if start_date_str:
        try:
            dt_start = datetime.datetime.strptime(start_date_str, "%Y-%m-%d")
            eval_qs = eval_qs.filter(created_at__gte=dt_start)
            chat_qs = chat_qs.filter(created_at__gte=dt_start)
            msg_qs = msg_qs.filter(session__created_at__gte=dt_start)
        except Exception:
            pass
    if end_date_str:
        try:
            dt_end = datetime.datetime.strptime(end_date_str, "%Y-%m-%d") + datetime.timedelta(days=1)
            eval_qs = eval_qs.filter(created_at__lt=dt_end)
            chat_qs = chat_qs.filter(created_at__lt=dt_end)
            msg_qs = msg_qs.filter(session__created_at__lt=dt_end)
        except Exception:
            pass

    total_evals = eval_qs.count()
    success_evals = eval_qs.filter(status='SUCCESS').count()
    failed_evals = eval_qs.filter(status='ERROR').count()
    total_chats = chat_qs.count()
    total_messages = msg_qs.count()

    # Suma de tokens
    tokens_agg = eval_qs.aggregate(
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
    from collections import defaultdict
    import datetime
    
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
        
    tokens_series = []
    days_es = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    current_date = today.date()
    
    for w in range(13):
        for d in range(7):
            day_dt = period_start + datetime.timedelta(days=w*7 + d)
            is_future = day_dt.date() > current_date
            
            day_data = tokens_by_day[day_dt.date()]
            prompt_val = 0 if is_future else day_data["prompt_tokens"]
            comp_val = 0 if is_future else day_data["completion_tokens"]
            
            tokens_series.append({
                "name": f"S{w}-{days_es[d]}",
                "prompt_tokens": prompt_val,
                "completion_tokens": comp_val,
                "total_tokens": prompt_val + comp_val,
                "weekIndex": w,
                "is_today": day_dt.date() == current_date
            })

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
        "tokens_series": tokens_series
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


