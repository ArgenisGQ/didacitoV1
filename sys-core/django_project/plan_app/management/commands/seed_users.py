from django.core.management.base import BaseCommand
from plan_app.models import User


class Command(BaseCommand):
    help = "Seed initial users into the database."

    def handle(self, *args, **options):
        if User.objects.filter(email="gestion@didactico.edu").exists():
            self.stdout.write(self.style.WARNING("Seed data already exists."))
            return

        self.stdout.write("Seeding initial users...")

        User.objects.create_user(
            email="gestion@didactico.edu",
            password="gestion123",
            full_name="Admin de Gestion Academica",
            role="ADMIN_GESTION",
        )
        self.stdout.write("  Created gestion@didactico.edu")

        User.objects.create_user(
            email="coordinador@didactico.edu",
            password="coord2024",
            full_name="Coordinador de Area",
            role="COORDINADOR",
        )
        self.stdout.write("  Created coordinador@didactico.edu")

        for i in range(1, 4):
            User.objects.create_user(
                email=f"docente0{i}@didactico.edu",
                password=f"clave0{i}",
                full_name=f"Docente Autor 0{i}",
                role="DOCENTE",
            )
            self.stdout.write(f"  Created docente0{i}@didactico.edu")

        self.stdout.write(self.style.SUCCESS("Seed completed successfully."))
