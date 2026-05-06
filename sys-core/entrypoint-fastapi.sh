#!/bin/sh
set -e

echo ">>> [FastAPI] Waiting for Django + PostgreSQL to be ready..."
sleep 10

echo ">>> [FastAPI] Starting Uvicorn on port 8001..."
exec uvicorn api.main:app \
    --host 0.0.0.0 \
    --port 8001 \
    --reload \
    --log-level info
