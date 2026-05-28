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
        ("lesson_plan:approve_global", "Aprobar Cualquier Plan de Clase", "Planes de Clase"),
        ("lesson_plan:approve_department", "Aprobar Planes de Su Departamento", "Planes de Clase"),
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
        "COORDINADOR": [p for c, p in perm_objs.items() if c in ["academic:read", "syllabus:read", "lesson_plan:read", "lesson_plan:review", "lesson_plan:approve_department"]],
        "DOCENTE": [p for c, p in perm_objs.items() if c in ["academic:read", "syllabus:read", "lesson_plan:read", "lesson_plan:create", "lesson_plan:update"]],
    }

    for role_name, role_perms in roles_def.items():
        role, _ = Role.objects.get_or_create(name=role_name, defaults={"is_system": True})
        role.permissions.set(role_perms)


def seed():
    def seed_widgets_and_assignments():
        print("Seeding widgets...")
        widgets_data = [
            ("active_users", "Usuarios Activos", "Gráfico de accesos al sistema", "LineChartWidget"),
            ("total_plans", "Planes Totales", "Total de planes creados", "StatCard"),
            ("plan_status", "Estado de Planes", "Proporción por estados", "DonutChartWidget"),
            ("pending_approvals", "Aprobación Pendiente", "Planes esperando revisión", "StatCard"),
            ("creation_time", "Tiempo Promedio", "Tiempo promedio de creación", "StatCard"),
            ("my_progress", "Mis Planes en Progreso", "Acceso rápido a borradores", "TeacherProgressWidget"),
            ("my_rejected", "Mis Planes Observados", "Planes que requieren atención", "TeacherAlertWidget"),
            ("my_semester", "Mi Progreso", "Progreso del semestre", "TeacherSemesterWidget"),
            ("my_history", "Últimos Accesos", "Historial de conexiones", "TeacherHistoryWidget"),
            ("coordinator_inbox", "Bandeja de Aprobación", "Planes por revisar", "CoordInboxWidget"),
            ("teacher_productivity", "Productividad Docente", "Planes subidos por docente", "CoordProductivityWidget"),
        ]

        from plan_app.models import Widget, DashboardWidgetRole
        
        widget_objs = {}
        for code, name, desc, comp in widgets_data:
            w, _ = Widget.objects.get_or_create(code=code, defaults={
                "name": name,
                "description": desc,
                "component_name": comp
            })
            widget_objs[code] = w

        role_widgets = {
            "SUPER_ADMIN": ["active_users", "total_plans", "plan_status", "pending_approvals", "creation_time"],
            "ADMIN_GESTION": ["active_users", "total_plans", "plan_status"],
            "COORDINADOR": ["coordinator_inbox", "teacher_productivity", "plan_status", "pending_approvals"],
            "DOCENTE": ["my_progress", "my_rejected", "my_semester", "my_history"],
        }

        print("Seeding dashboard widget roles...")
        for role_name, w_codes in role_widgets.items():
            try:
                role = Role.objects.get(name=role_name)
                for order, w_code in enumerate(w_codes):
                    DashboardWidgetRole.objects.get_or_create(
                        role=role, 
                        widget=widget_objs[w_code],
                        defaults={"order": order, "is_active": True}
                    )
            except Role.DoesNotExist:
                continue

    seed_permissions_and_roles()
    seed_widgets_and_assignments()
    
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

