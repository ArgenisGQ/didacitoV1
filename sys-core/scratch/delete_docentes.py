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

def clear_docentes():
    print(">>> Iniciando limpieza de docentes en la base de datos...")
    
    # Filtrar usuarios con rol DOCENTE
    docentes_qs = User.objects.filter(role='DOCENTE')
    count = docentes_qs.count()
    
    if count == 0:
        print("No se encontraron usuarios con el rol 'DOCENTE' para eliminar.")
        return
        
    print(f"Se encontraron {count} docentes. Eliminando...")
    
    # El delete de Django ORM maneja automáticamente el borrado en cascada
    # para relaciones como planes de clase, refresh tokens, etc.
    deleted_info = docentes_qs.delete()
    
    print(f"Limpieza completada exitosamente. Detalles de objetos eliminados: {deleted_info}")

if __name__ == "__main__":
    clear_docentes()
