#!/bin/sh
set -e

# 1. Lanzar un bucle ligero en segundo plano que vigile la aparición de pg_hba.conf
(
    echo "[pg-watcher] Starting background pg_hba.conf monitor..."
    for i in $(seq 1 30); do
        if [ -f /var/lib/postgresql/data/pg_hba.conf ]; then
            if grep -q "hostssl" /var/lib/postgresql/data/pg_hba.conf; then
                echo "[pg-watcher] Found hostssl! Fixing pg_hba.conf: replacing hostssl with host..."
                sed -i 's/hostssl/host/g' /var/lib/postgresql/data/pg_hba.conf
                pg_ctl reload -D /var/lib/postgresql/data 2>/dev/null || true
                echo "[pg-watcher] pg_hba.conf successfully fixed and reloaded."
            else
                echo "[pg-watcher] pg_hba.conf already clean (no hostssl found)."
            fi
            break
        fi
        sleep 1
    done
    echo "[pg-watcher] Background monitor finished."
) &

# 2. Reemplazar el proceso actual por el entrypoint oficial de PostgreSQL (PID 1)
echo "[pg-start] Launching original PostgreSQL entrypoint (PID 1)..."
exec /usr/local/bin/docker-entrypoint.sh "$@"
