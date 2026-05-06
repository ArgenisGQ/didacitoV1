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

from plan_app.models import User


def seed():
    if User.objects.filter(email="gestion@didactico.edu").exists():
        print("Seed data already exists. Skipping.")
        return

    print("Seeding initial users via Django ORM...")

    User.objects.create_user(
        email="gestion@didactico.edu",
        password="gestion123",
        full_name="Admin de Gestion Academica",
        role="ADMIN_GESTION",
    )

    User.objects.create_user(
        email="coordinador@didactico.edu",
        password="coord2024",
        full_name="Coordinador de Area",
        role="COORDINADOR",
    )

    for i in range(1, 4):
        User.objects.create_user(
            email=f"docente0{i}@didactico.edu",
            password=f"clave0{i}",
            full_name=f"Docente Autor 0{i}",
            role="DOCENTE",
        )

    print("Seed data created successfully.")


if __name__ == "__main__":
    seed()
