#!/bin/sh
set -e

echo "[pg-start] Starting PostgreSQL via original entrypoint..."
/usr/local/bin/docker-entrypoint.sh "$@" &
POSTGRES_PID=$!

echo "[pg-start] Waiting for PostgreSQL to be ready..."
for i in $(seq 1 60); do
    if pg_isready -q -h 127.0.0.1 2>/dev/null; then
        echo "[pg-start] PostgreSQL is accepting connections."
        break
    fi
    if [ $i -eq 60 ]; then
        echo "[pg-start] ERROR: PostgreSQL did not start within 30 seconds."
        exit 1
    fi
    sleep 0.5
done

if [ -f /var/lib/postgresql/data/pg_hba.conf ]; then
    sed -i 's/hostssl/host/g' /var/lib/postgresql/data/pg_hba.conf
    pg_ctl reload -D /var/lib/postgresql/data
    echo "[pg-start] pg_hba.conf: hostssl entries converted to host."
fi

wait $POSTGRES_PID
