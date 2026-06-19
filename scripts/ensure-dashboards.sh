#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRAFANA_URL="${1:-https://localhost/grafana}"
GRAFANA_USER="${2:-admin}"
GRAFANA_PASS="${3:-admin}"
API_URL="${4:-https://localhost/api}"

export GRAFANA_URL GRAFANA_USER GRAFANA_PASS API_URL

exec python3 "$SCRIPT_DIR/ensure-dashboards.py"