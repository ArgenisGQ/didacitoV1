#!/bin/sh

echo "[pg-start] Launching original PostgreSQL entrypoint..."
/usr/local/bin/docker-entrypoint.sh "$@" &
POSTGRES_PID=$!

echo "[pg-start] Waiting for PostgreSQL to accept connections (PID=$POSTGRES_PID)..."
for i in $(seq 1 60); do
    if pg_isready -q -h 127.0.0.1 2>/dev/null; then
        echo "[pg-start] PostgreSQL is ready."
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "[pg-start] ERROR: PostgreSQL did not start within 60 seconds."
        exit 1
    fi
    sleep 1
done

if [ -f /var/lib/postgresql/data/pg_hba.conf ]; then
    echo "[pg-start] Fixing pg_hba.conf: replacing hostssl with host entries..."
    sed -i 's/hostssl/host/g' /var/lib/postgresql/data/pg_hba.conf
    pg_ctl reload -D /var/lib/postgresql/data 2>/dev/null || true
    echo "[pg-start] pg_hba.conf fixed and PostgreSQL reloaded."
fi

echo "[pg-start] Waiting for PostgreSQL process to exit..."
wait $POSTGRES_PID
