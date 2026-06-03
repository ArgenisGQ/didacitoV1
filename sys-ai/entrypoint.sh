#!/bin/bash
echo "Waiting for PostgreSQL to start..."
sleep 5
echo "Applying database migrations..."
python manage.py migrate
if [ "$#" -eq 0 ]; then
    echo "Starting Django server..."
    exec python manage.py runserver 0.0.0.0:8003
else
    echo "Running command: $@"
    exec "$@"
fi
