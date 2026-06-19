#!/bin/sh
set -e

for block in /prometheus/01*/; do
    if [ -d "$block" ]; then
        missing=""
        [ ! -f "$block/index" ] && missing="$missing index"
        [ ! -f "$block/meta.json" ] && missing="$missing meta.json"
        [ ! -d "$block/chunks" ] && missing="$missing chunks"
        if [ -n "$missing" ]; then
            echo "warning: corrupted block $(basename "$block") (missing:$missing), moving to quarantine"
            mkdir -p /prometheus/quarantine
            mv "$block" /prometheus/quarantine/
        fi
    fi
done

exec prometheus \
    --config.file=/etc/prometheus/prometheus.yml \
    --storage.tsdb.path=/prometheus \
    --web.console.libraries=/usr/share/prometheus/console_libraries \
    --web.console.templates=/usr/share/prometheus/consoles \
    --storage.tsdb.retention.time=30d \
    --storage.tsdb.wal-compression
