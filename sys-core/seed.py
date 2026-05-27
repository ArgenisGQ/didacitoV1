#!/usr/bin/env python
"""
Standalone seed script using Django ORM.
Can be run as: python seed.py  (from sys-core, after setting PYTHONPATH)
"""
import os
import sys
import django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "django_project"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core_settings.settings")
django.setup()

from plan_app.models import User, Role, Permission


def seed_permissions_and_roles():
    print("Seeding permissions and roles...")
    perms = [
        ("users:read", "Ver Usuarios", "Usuarios"),
        ("users:create", "Crear Usuarios", "Usuarios"),
        ("users:update", "Editar Usuarios", "Usuarios"),
        ("users:delete", "Eliminar Usuarios", "Usuarios"),
        ("academic:read", "Ver Datos Académicos", "Académico"),
        ("academic:manage_periods", "Gestionar Periodos", "Académico"),
        ("academic:manage_distribution", "Gestionar Distribución", "Académico"),
        ("syllabus:read", "Ver Sílabos", "Sílabos"),
        ("syllabus:import", "Importar Sílabos", "Sílabos"),
        ("syllabus:manage", "Gestionar Sílabos", "Sílabos"),
        ("lesson_plan:read", "Ver Planes de Clase", "Planes de Clase"),
        ("lesson_plan:create", "Crear Planes de Clase", "Planes de Clase"),
        ("lesson_plan:update", "Actualizar Planes de Clase Propios", "Planes de Clase"),
        ("lesson_plan:update_all", "Actualizar Cualquier Plan de Clase", "Planes de Clase"),
        ("lesson_plan:review", "Revisar Planes de Clase", "Planes de Clase"),
        ("lesson_plan:approve", "Aprobar Planes de Clase", "Planes de Clase"),
        ("settings:manage", "Gestionar Configuración", "Sistema"),
        ("audit:read", "Ver Auditoría", "Sistema"),
        ("roles:manage", "Gestionar Roles", "Sistema"),
        ("roles:read", "Ver Roles", "Sistema"),
        ("periods:read", "Ver Periodos", "Académico"),
        ("distribution:read", "Ver Distribución", "Académico"),
    ]
    
    perm_objs = {}
    for code, name, mod in perms:
        p, _ = Permission.objects.get_or_create(code=code, defaults={"name": name, "module_name": mod})
        perm_objs[code] = p

    roles_def = {
        "SUPER_ADMIN": list(perm_objs.values()),
        "ADMIN_GESTION": [p for c, p in perm_objs.items() if c in ["users:read", "users:create", "users:update", "academic:read", "periods:read", "distribution:read", "academic:manage_periods", "academic:manage_distribution", "syllabus:read", "syllabus:manage", "lesson_plan:read"]],
        "COORDINADOR": [p for c, p in perm_objs.items() if c in ["academic:read", "syllabus:read", "lesson_plan:read", "lesson_plan:review"]],
        "DOCENTE": [p for c, p in perm_objs.items() if c in ["academic:read", "syllabus:read", "lesson_plan:read", "lesson_plan:create", "lesson_plan:update"]],
    }

    for role_name, role_perms in roles_def.items():
        role, _ = Role.objects.get_or_create(name=role_name, defaults={"is_system": True})
        role.permissions.set(role_perms)


def seed():
    seed_permissions_and_roles()
    
    print("Seeding initial users via Django ORM...")

    if not User.objects.filter(email="superadmin@didactico.edu").exists():
        superadmin = User.objects.create_user(
            email="superadmin@didactico.edu",
            password="superadmin123",
            full_name="Super Administrador",
            role="SUPER_ADMIN",
        )
        superadmin.roles.add(Role.objects.get(name="SUPER_ADMIN"))

    if not User.objects.filter(email="gestion@didactico.edu").exists():
        admin = User.objects.create_user(
            email="gestion@didactico.edu",
            password="gestion123",
            full_name="Admin de Gestion Academica",
            role="ADMIN_GESTION",
        )
        admin.roles.add(Role.objects.get(name="ADMIN_GESTION"))

    if not User.objects.filter(email="coordinador@didactico.edu").exists():
        coord = User.objects.create_user(
            email="coordinador@didactico.edu",
            password="coord2024",
            full_name="Coordinador de Area",
            role="COORDINADOR",
        )
        coord.roles.add(Role.objects.get(name="COORDINADOR"))

    if not User.objects.filter(email="docente@didactico.edu").exists():
        docente = User.objects.create_user(
            email="docente@didactico.edu",
            password="docente123",
            full_name="Docente de Ejemplo",
            role="DOCENTE",
        )
        docente.roles.add(Role.objects.get(name="DOCENTE"))

    print("Seed data created successfully.")


if __name__ == "__main__":
    seed()

