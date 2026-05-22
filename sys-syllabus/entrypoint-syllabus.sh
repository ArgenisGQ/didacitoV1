#!/bin/sh
set -e

echo ">>> [Syllabus] Starting microservice..."

# Create syllabus_pdfs folder if not exists
mkdir -p /app/syllabus_pdfs

# Run Uvicorn
echo ">>> [Syllabus] Starting Uvicorn on port 8002..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8002
