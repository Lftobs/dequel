#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys

GRAFANA_URL = os.environ.get("GRAFANA_URL", "http://localhost/grafana")
GRAFANA_USER = os.environ.get("GRAFANA_USER", "admin")
GRAFANA_PASS = os.environ.get("GRAFANA_PASS", "admin")
API_URL = os.environ.get("API_URL", "http://localhost/api")

login = subprocess.run(
    [
        "curl",
        "-sk",
        "-X",
        "POST",
        f"{GRAFANA_URL}/login",
        "-H",
        "Content-Type: application/json",
        "-d",
        json.dumps({"user": GRAFANA_USER, "password": GRAFANA_PASS}),
        "-c",
        "/tmp/grafana_cookies",
    ],
    capture_output=True,
    text=True,
)
resp = json.loads(login.stdout) if login.stdout else {}
if "message" not in resp or resp.get("message") != "Logged in":
    print(f"Grafana login failed: {login.stdout[:200]}")
    sys.exit(1)
print("Logged into Grafana")

result = subprocess.run(
    ["curl", "-sk", f"{API_URL}/projects"], capture_output=True, text=True
)
if not result.stdout:
    print("API returned empty response")
    sys.exit(1)
projects = json.loads(result.stdout)
print(f"Found {len(projects)} projects")

# Get running containers
running = set()
result = subprocess.run(
    ["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True
)
for c in result.stdout.strip().split("\n"):
    if c:
        running.add(c)


def grafana_post(path, data):
    return subprocess.run(
        [
            "curl",
            "-sk",
            "-X",
            "POST",
            "-b",
            "/tmp/grafana_cookies",
            "-H",
            "Content-Type: application/json",
            "-d",
            json.dumps(data),
            f"{GRAFANA_URL}/api{path}",
        ],
        capture_output=True,
        text=True,
    )


created = 0
for p in projects:
    slug = p["name"].lower().replace(" ", "-").replace("_", "-")
    slug = re.sub(r"[^a-z0-9-]", "", slug).strip("-")[:63]

    matching = sorted(c for c in running if c.startswith(slug + "-"))
    if not matching:
        print(f"  Skip {p['name']}: no running containers")
        continue

    container_regex = slug + "-.*"
    print(f"  {p['name']} (containers: {', '.join(matching)})")

    dashboard = {
        "dashboard": {
            "title": f"Dequel \u2014 {p['name']}",
            "uid": f"dequel-project-{slug}",
            "tags": ["dequel", "project", slug],
            "schemaVersion": 39,
            "version": 1,
            "timezone": "browser",
            "refresh": "30s",
            "panels": [
                {
                    "type": "row",
                    "title": "Resource Usage",
                    "collapsed": False,
                    "gridPos": {"h": 1, "w": 24, "x": 0, "y": 0},
                },
                {
                    "id": 1,
                    "type": "timeseries",
                    "title": "CPU Usage",
                    "datasource": {"type": "prometheus", "uid": "prometheus"},
                    "gridPos": {"h": 9, "w": 12, "x": 0, "y": 1},
                    "fieldConfig": {
                        "defaults": {
                            "unit": "short",
                            "custom": {
                                "stacking": {"mode": "normal"},
                                "fillOpacity": 30,
                                "lineWidth": 1,
                            },
                        },
                        "overrides": [],
                    },
                    "options": {
                        "legend": {
                            "displayMode": "table",
                            "placement": "right",
                            "showLegend": True,
                        },
                        "tooltip": {"mode": "multi"},
                    },
                    "targets": [
                        {
                            "datasource": {"type": "prometheus", "uid": "prometheus"},
                            "expr": f'rate(container_cpu_usage_seconds_total{{name=~"{container_regex}"}}[$__rate_interval])',
                            "legendFormat": "{{name}}",
                            "refId": "A",
                        }
                    ],
                },
                {
                    "id": 2,
                    "type": "timeseries",
                    "title": "Memory Usage",
                    "datasource": {"type": "prometheus", "uid": "prometheus"},
                    "gridPos": {"h": 9, "w": 12, "x": 12, "y": 1},
                    "fieldConfig": {
                        "defaults": {
                            "unit": "bytes",
                            "custom": {
                                "stacking": {"mode": "normal"},
                                "fillOpacity": 30,
                                "lineWidth": 1,
                            },
                        },
                        "overrides": [],
                    },
                    "options": {
                        "legend": {
                            "displayMode": "table",
                            "placement": "right",
                            "showLegend": True,
                        },
                        "tooltip": {"mode": "multi"},
                    },
                    "targets": [
                        {
                            "datasource": {"type": "prometheus", "uid": "prometheus"},
                            "expr": f'container_memory_working_set_bytes{{name=~"{container_regex}"}}',
                            "legendFormat": "{{name}}",
                            "refId": "A",
                        }
                    ],
                },
                {
                    "type": "row",
                    "title": "Request Metrics",
                    "collapsed": False,
                    "gridPos": {"h": 1, "w": 24, "x": 0, "y": 10},
                },
                {
                    "id": 4,
                    "type": "timeseries",
                    "title": "Request Rate",
                    "datasource": {"type": "loki", "uid": "loki"},
                    "gridPos": {"h": 9, "w": 24, "x": 0, "y": 11},
                    "fieldConfig": {
                        "defaults": {
                            "unit": "reqps",
                            "custom": {"fillOpacity": 30, "lineWidth": 1},
                        },
                        "overrides": [],
                    },
                    "options": {
                        "legend": {
                            "displayMode": "table",
                            "placement": "right",
                            "showLegend": True,
                        },
                        "tooltip": {"mode": "multi"},
                    },
                    "targets": [
                        {
                            "datasource": {"type": "loki", "uid": "loki"},
                            "expr": f'sum by(host) (count_over_time({{container=~"{container_regex}"}} | json [5m]))',
                            "legendFormat": "{{host}}",
                            "refId": "A",
                        }
                    ],
                },
                {
                    "type": "row",
                    "title": "Logs",
                    "collapsed": False,
                    "gridPos": {"h": 1, "w": 24, "x": 0, "y": 20},
                },
                {
                    "id": 3,
                    "type": "logs",
                    "title": f"Container Logs",
                    "datasource": {"type": "loki", "uid": "loki"},
                    "gridPos": {"h": 12, "w": 24, "x": 0, "y": 21},
                    "options": {
                        "showLabels": True,
                        "showTime": True,
                        "wrapLogMessage": True,
                        "enableLogDetails": True,
                        "dedupStrategy": "none",
                    },
                    "targets": [
                        {
                            "datasource": {"type": "loki", "uid": "loki"},
                            "expr": f'{{container=~"{container_regex}"}}',
                            "refId": "A",
                        }
                    ],
                },
            ],
        },
        "overwrite": True,
    }

    r = grafana_post("/dashboards/db", dashboard)
    try:
        resp = json.loads(r.stdout)
        if resp.get("status") == "success":
            url = resp.get("url", "")
            full_url = (
                f"https://localhost{url}"
                if url.startswith("/grafana/")
                else f"{GRAFANA_URL}{url}"
            )
            print(f"    OK: {full_url}")
            created += 1
        else:
            print(f"    Error: {resp}")
    except json.JSONDecodeError:
        print(f"    Failed: {r.stdout[:300]}")

print(f"\nDone: {created} dashboard(s) created/updated")

subprocess.run(["rm", "-f", "/tmp/grafana_cookies"], capture_output=True)
