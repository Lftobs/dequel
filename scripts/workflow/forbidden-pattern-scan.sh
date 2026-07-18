#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

FORBIDDEN=$'global[\'!\']'
EXCLUDE=${2:-":(exclude).github/workflows/forbidden-pattern-scan.yml"}

matches=$(git grep -lF "$FORBIDDEN" -- . "$EXCLUDE" || true)
if [[ -n "$matches" ]]; then
  echo "::error::Blocked literal pattern detected in repository files." >&2
  echo "Affected file(s):" >&2
  printf '%s\n' "$matches" >&2
  echo "" >&2
  git grep -nF "$FORBIDDEN" -- . "$EXCLUDE" >&2 || true
  exit 1
fi

echo "OK: no files contain the forbidden pattern."
