#!/bin/bash
# Script para restaurar semillas (seeds) en producción/VPS de forma segura

echo "========================================================="
echo "Restaurando Semillas de Didacito (Usuarios, Roles e IA)"
echo "========================================================="

# Detectar modo SSL (por defecto 'require' para producción VPS)
DB_SSLMODE=${DB_SSLMODE:-require}
export DB_SSLMODE

echo "1. Restaurando Usuarios, Roles, Permisos y Widgets..."
# Buscar contenedor que contenga 'fastapi-api' o 'fastapi' y esté corriendo
FASTAPI_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'fastapi-api|fastapi' | head -n 1)
# Buscar contenedor que contenga 'django-admin' o 'django' y esté corriendo
DJANGO_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'django-admin|django' | head -n 1)

if [ -n "$FASTAPI_CONTAINER" ]; then
    echo "Ejecutando en $FASTAPI_CONTAINER..."
    docker exec -e DB_SSLMODE=$DB_SSLMODE -i "$FASTAPI_CONTAINER" python seed.py
elif [ -n "$DJANGO_CONTAINER" ]; then
    echo "Ejecutando en $DJANGO_CONTAINER..."
    docker exec -e DB_SSLMODE=$DB_SSLMODE -i "$DJANGO_CONTAINER" python /app/seed.py
else
    echo "Error: No se encontró ningún contenedor de backend activo (fastapi o django)."
fi

echo ""
echo "2. Restaurando Agentes Base de Inteligencia Artificial..."
# Buscar contenedor que contenga 'sys-ai' y esté corriendo (excluyendo el worker)
AI_CONTAINER=$(docker ps --format '{{.Names}}' | grep 'sys-ai' | grep -v 'worker' | head -n 1)

if [ -n "$AI_CONTAINER" ]; then
    echo "Ejecutando en $AI_CONTAINER..."
    docker exec -e DB_SSLMODE=$DB_SSLMODE -i "$AI_CONTAINER" python seed_agents.py
else
    echo "Error: No se encontró el contenedor de IA activo (sys-ai)."
fi

echo "========================================================="
echo "Proceso finalizado."
echo "========================================================="
