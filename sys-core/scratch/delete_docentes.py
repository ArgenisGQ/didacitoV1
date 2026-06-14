#!/usr/bin/env python
"""
Script para eliminar todos los usuarios con el rol 'DOCENTE' utilizando Django ORM.
"""
import os
import sys
import django

# Bootstrap Django settings
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "django_project"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core_settings.settings")
django.setup()

from plan_app.models import User

from django.db import connection
from plan_app.models import User, LessonPlan

def clear_docentes():
    print(">>> Iniciando limpieza de docentes en la base de datos...")
    
    # Filtrar usuarios con rol DOCENTE
    docentes_qs = User.objects.filter(role='DOCENTE')
    count = docentes_qs.count()
    
    if count == 0:
        print("No se encontraron usuarios con el rol 'DOCENTE' para eliminar.")
        return
        
    print(f"Se encontraron {count} docentes. Eliminando dependencias de AI...")
    
    docente_ids = list(docentes_qs.values_list('id', flat=True))
    plan_ids = list(LessonPlan.objects.filter(author_id__in=docente_ids).values_list('id', flat=True))
    
    with connection.cursor() as cursor:
        if plan_ids:
            print(f"Eliminando chunks de planes de clase ({len(plan_ids)} planes)...")
            # Delete lesson plan chunks
            cursor.execute("DELETE FROM ai_app_lessonplan_chunk WHERE lesson_plan_id = ANY(%s)", [plan_ids])
            # Delete evaluation results
            cursor.execute("DELETE FROM ai_app_evaluation_result WHERE lesson_plan_id = ANY(%s)", [plan_ids])
            
        print("Eliminando sesiones de chat...")
        # Get chat session ids
        cursor.execute("SELECT id FROM ai_app_chat_session WHERE user_id = ANY(%s)", [docente_ids])
        session_ids = [row[0] for row in cursor.fetchall()]
        if session_ids:
            cursor.execute("DELETE FROM ai_app_chat_message WHERE session_id = ANY(%s)", [session_ids])
            cursor.execute("DELETE FROM ai_app_chat_session WHERE id = ANY(%s)", [session_ids])
            
    print(f"Eliminando {count} docentes de plan_app_user...")
    # El delete de Django ORM maneja automáticamente el borrado en cascada
    # para relaciones como planes de clase, refresh tokens, etc.
    deleted_info = docentes_qs.delete()
    
    print(f"Limpieza completada exitosamente. Detalles de objetos eliminados: {deleted_info}")

if __name__ == "__main__":
    clear_docentes()

