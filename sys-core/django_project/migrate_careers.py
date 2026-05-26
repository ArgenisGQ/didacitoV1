import os
import sys
import django

# Setup django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_project.settings')
django.setup()

from django.db import connection

def migrate():
    with connection.cursor() as cursor:
        # 1. Create a Base Faculty if it doesn't exist
        cursor.execute("SELECT id FROM plan_app_faculty WHERE code = 'FAC-BASE'")
        row = cursor.fetchone()
        if row:
            faculty_id = row[0]
        else:
            cursor.execute("INSERT INTO plan_app_faculty (name, code, is_active, created_at, updated_at) VALUES ('Facultad Base', 'FAC-BASE', true, NOW(), NOW()) RETURNING id")
            faculty_id = cursor.fetchone()[0]

        # 2. Get distinct programs from subjects
        cursor.execute("SELECT DISTINCT program FROM plan_app_subject WHERE program IS NOT NULL AND program != ''")
        programs = cursor.fetchall()

        # 3. Insert each as a career if it doesn't exist
        inserted = 0
        for p in programs:
            program_name = p[0].strip()
            # create a slug-like code
            code = "CAR-" + "".join(word[0] for word in program_name.split() if len(word)>2)[:5].upper()
            # append index or something to avoid conflict? It's fine for this demo.
            
            # Check if exists
            cursor.execute("SELECT id FROM plan_app_career WHERE name = %s", [program_name])
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO plan_app_career (name, code, faculty_id, is_active, created_at, updated_at) VALUES (%s, %s, %s, true, NOW(), NOW())",
                    [program_name, code + str(inserted), faculty_id]
                )
                inserted += 1

        print(f"Migración completada. Carreras nuevas añadidas: {inserted}")

if __name__ == '__main__':
    migrate()
