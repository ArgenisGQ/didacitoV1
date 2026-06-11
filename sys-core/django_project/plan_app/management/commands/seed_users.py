from django.core.management.base import BaseCommand
from plan_app.models import User, Role


class Command(BaseCommand):
    help = "Seed initial users into the database."

    def handle(self, *args, **options):
        self.stdout.write("Seeding initial users and assigning roles...")

        # Ensure system roles exist
        admin_role, _ = Role.objects.get_or_create(name="ADMIN_GESTION", defaults={"is_system": True})
        coord_role, _ = Role.objects.get_or_create(name="COORDINADOR", defaults={"is_system": True})
        docente_role, _ = Role.objects.get_or_create(name="DOCENTE", defaults={"is_system": True})

        # ADMIN_GESTION
        admin, created = User.objects.get_or_create(
            email="gestion@didactico.edu",
            defaults={
                "full_name": "Admin de Gestion Academica",
                "role": "ADMIN_GESTION",
            }
        )
        if created:
            admin.set_password("gestion123")
            admin.save()
        else:
            admin.role = "ADMIN_GESTION"
            admin.save()
        if admin_role not in admin.roles.all():
            admin.roles.add(admin_role)
        self.stdout.write("  Ensured gestion@didactico.edu has ADMIN_GESTION role")

        # COORDINADOR
        coord, created = User.objects.get_or_create(
            email="coordinador@didactico.edu",
            defaults={
                "full_name": "Coordinador de Area",
                "role": "COORDINADOR",
            }
        )
        if created:
            coord.set_password("coord2024")
            coord.save()
        else:
            coord.role = "COORDINADOR"
            coord.save()
        if coord_role not in coord.roles.all():
            coord.roles.add(coord_role)
        self.stdout.write("  Ensured coordinador@didactico.edu has COORDINADOR role")

        # DOCENTES
        for i in range(1, 4):
            doc, created = User.objects.get_or_create(
                email=f"docente0{i}@didactico.edu",
                defaults={
                    "full_name": f"Docente Autor 0{i}",
                    "role": "DOCENTE",
                }
            )
            if created:
                doc.set_password(f"clave0{i}")
                doc.save()
            else:
                doc.role = "DOCENTE"
                doc.save()
            if docente_role not in doc.roles.all():
                doc.roles.add(docente_role)
            self.stdout.write(f"  Ensured docente0{i}@didactico.edu has DOCENTE role")

        self.stdout.write(self.style.SUCCESS("Seed completed successfully."))
