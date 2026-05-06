#!/bin/sh
set -e

echo ">>> [Django] Waiting for PostgreSQL..."
while ! pg_isready -h db -U user -d planning_db -q; do
    echo "  DB not ready... retrying in 3s"
    sleep 3
done
echo ">>> [Django] PostgreSQL is ready!"

echo ">>> [Django] Generating migrations..."
cd /app/django_project
python manage.py makemigrations plan_app --noinput
echo ">>> [Django] Running migrations..."
python manage.py migrate --noinput

echo ">>> [Django] Collecting static files..."
python manage.py collectstatic --noinput || true

echo ">>> [Django] Creating superuser if not exists..."
python manage.py shell -c "
from plan_app.models import User
if not User.objects.filter(email='superadmin@didactico.edu').exists():
    User.objects.create_superuser(
        email='superadmin@didactico.edu',
        password='admin',
        full_name='IT System Admin'
    )
    print('Superuser created.')
else:
    print('Superuser already exists.')
"

echo ">>> [Django] Seeding initial data..."
python manage.py shell -c "
from plan_app.models import User
if not User.objects.filter(email='gestion@didactico.edu').exists():
    User.objects.create_user(email='gestion@didactico.edu', password='gestion123', full_name='Admin de Gestion Academica', role='ADMIN_GESTION')
    User.objects.create_user(email='coordinador@didactico.edu', password='coord2024', full_name='Coordinador de Area', role='COORDINADOR')
    for i in range(1, 4):
        User.objects.create_user(email=f'docente0{i}@didactico.edu', password=f'clave0{i}', full_name=f'Docente Autor 0{i}', role='DOCENTE')
    print('Seed data created.')
else:
    print('Seed data already exists.')
"

echo ">>> [Django] Starting Gunicorn on port 8000..."
exec gunicorn core_settings.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile -
