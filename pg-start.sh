#!/bin/sh
set -e

# 1. Corregir pg_hba.conf de forma síncrona antes de arrancar Postgres
if [ -f /var/lib/postgresql/data/pg_hba.conf ]; then
    echo "[pg-start] Fixing pg_hba.conf: replacing hostssl with host entries..."
    sed -i 's/hostssl/host/g' /var/lib/postgresql/data/pg_hba.conf
    echo "[pg-start] pg_hba.conf successfully fixed."
fi

# 2. Reemplazar el proceso actual por el entrypoint oficial de PostgreSQL
echo "[pg-start] Launching original PostgreSQL entrypoint (PID 1)..."
exec /usr/local/bin/docker-entrypoint.sh "$@"
