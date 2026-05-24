#!/bin/sh
set -e

echo ">>> [Django] Waiting for PostgreSQL..."
DB_URI="${DATABASE_URL_SYNC:-$DATABASE_URL}"
if [ -n "$DB_URI" ]; then
    CLEAN_URI=$(echo "$DB_URI" | sed 's/postgresql+asyncpg/postgresql/g' | sed 's/postgres/postgresql/g')
    while ! pg_isready -d "$CLEAN_URI" -q; do
        echo "  DB (URI) not ready... retrying in 3s"
        sleep 3
    done
else
    while ! pg_isready -h "${DB_HOST:-planning-db}" -U "${DB_USER:-user}" -d "${DB_NAME:-planning_db}" -q; do
        echo "  DB not ready... retrying in 3s"
        sleep 3
    done
fi
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
from plan_app.models import User, SystemSetting
if not User.objects.filter(email='gestion@didactico.edu').exists():
    User.objects.create_user(email='gestion@didactico.edu', password='gestion123', full_name='Admin de Gestion Academica', role='ADMIN_GESTION')
    User.objects.create_user(email='coordinador@didactico.edu', password='coord2024', full_name='Coordinador de Area', role='COORDINADOR')
    print('Seed data created.')
else:
    print('Seed data already exists.')

# Seed system settings
settings_to_seed = {
    'SUPPORT_EMAIL': ('soporte@didactico.edu', 'Correo de soporte institucional para solicitudes de cambio de campos protegidos', 'GENERAL'),
    'DEFAULT_PAGINATION_LIMIT': ('20', 'Limite de paginacion por defecto para consultas del sistema', 'GENERAL'),
    'INVITATION_TOKEN_EXPIRE_HOURS': ('24', 'Horas de expiracion para los tokens de invitacion', 'SECURITY'),
    'ENFORCE_MFA_ROLES': ('SUPER_ADMIN,ADMIN_GESTION', 'Roles obligados a utilizar autenticacion de doble factor (MFA)', 'SECURITY'),
    'CSV_REQUIRED_COLUMNS': ('email,full_name,role', 'Columnas requeridas separadas por coma en la plantilla de carga masiva CSV', 'IMPORT'),
    'MAX_CSV_FILE_SIZE_MB': ('5', 'Tamano maximo en MB permitido para archivos CSV de carga masiva', 'IMPORT'),
    'CSV_AUTO_ACTIVATE_USERS': ('false', 'Si es true, los usuarios importados se activan inmediatamente sin invitacion por correo', 'IMPORT'),
    'REGISTRATION_METHOD': ('INVITATION', 'Metodo de registro del sistema (INVITATION o OPEN)', 'SECURITY'),
    'MAX_INVITATIONS_PER_DAY': ('50', 'Numero maximo de invitaciones que se pueden enviar por dia', 'SECURITY'),
    'EDITABLE_PROFILE_FIELDS': ('full_name', 'Campos del perfil docente que el usuario puede editar autonomamente (separados por coma)', 'UX'),
    'ENABLE_PASSWORD_CHANGE_BY_USER': ('true', 'Habilita o deshabilita la capacidad del usuario para cambiar su contrasena', 'SECURITY'),
    'MINIMUM_PASSWORD_STRENGTH_SCORE': ('3', 'Puntuacion de entropia minima requerida para contrasenas (0 a 4)', 'SECURITY'),
    'SMTP_HOST': ('smtp.gmail.com', 'Servidor SMTP para notificaciones', 'SMTP'),
    'SMTP_PORT': ('587', 'Puerto SMTP', 'SMTP'),
    'SMTP_USER': ('notificaciones@didactico.edu', 'Usuario del servidor SMTP', 'SMTP'),
    'AUDIT_LOG_VIEWER_ROLES': ('SUPER_ADMIN', 'Roles autorizados a visualizar el panel de auditoria en el dashboard', 'SECURITY'),
    'INACTIVE_ACCOUNT_THRESHOLD_DAYS': ('90', 'Cantidad de dias sin iniciar sesion para marcar una cuenta como inactiva', 'SECURITY'),
    'AUTO_DEACTIVATE_INACTIVE_ACCOUNTS': ('false', 'Desactivacion automatica diaria de cuentas inactivas (true/false)', 'SECURITY'),
}
seeded_settings = 0
for key, (val, desc, cat) in settings_to_seed.items():
    if not SystemSetting.objects.filter(key=key).exists():
        SystemSetting.objects.create(key=key, value=val, description=desc, category=cat)
        seeded_settings += 1
if seeded_settings > 0:
    print(f'Seeded {seeded_settings} system settings.')
else:
    print('System settings already exist.')
"

echo ">>> [Django] Starting Gunicorn on port 8000..."
exec gunicorn core_settings.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile -
