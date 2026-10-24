#!/usr/bin/env bash
# The Playwright E2E on a fresh Compose stack, as CI runs it: installs Chromium, builds and starts the stack under its
# own project name (so the dev stack's volumes are untouched), runs the tests, then always takes the stack down with
# its volumes. On failure the stack logs land in compose.log. Extra arguments go to Playwright (a file, --grep...).
set -euo pipefail
cd "$(dirname "$0")/.."

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ocop-e2e}"

docker info >/dev/null 2>&1 || { echo "Docker is not running" >&2; exit 1; }
if command -v lsof >/dev/null && lsof -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 8080 is taken (the dev stack?): stop it with 'docker compose down' first" >&2
  exit 1
fi

finish() {
  status=$?
  if [ "$status" -ne 0 ]; then docker compose logs --no-color > compose.log 2>&1 || true; fi
  docker compose down -v >/dev/null 2>&1 || true
  exit "$status"
}
trap finish EXIT

pnpm --filter @ocop/e2e exec playwright install ${CI:+--with-deps} chromium
docker compose down -v >/dev/null 2>&1 || true
docker compose up -d --build --wait --wait-timeout 600 web worker caddy
pnpm --filter @ocop/e2e e2e ${@+"$@"}
