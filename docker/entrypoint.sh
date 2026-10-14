#!/bin/bash
set -e

# entrypoint.sh — starts the API server, crew scheduler, and optional email monitor.
# Usage:
#   docker/entrypoint.sh schedule   → crew scheduler only
#   docker/entrypoint.sh serve      → REST API + dashboard only
#   docker/entrypoint.sh both       → API + scheduler + email (default)

MODE="${1:-both}"

echo "╔══════════════════════════════════════╗"
echo "║   Super Job Agent — Docker Server    ║"
echo "╚══════════════════════════════════════╝"
echo "  Mode: $MODE"
echo "  Data: $SUPERJOB_HOME"
echo ""

build_crew_args() {
  local args=(
    --keywords "${SEARCH_KEYWORDS:-software engineer}"
    --location "${SEARCH_LOCATION:-Remote}"
    --interval "${SCHEDULE_INTERVAL_MIN:-360}"
    --runs "${SCHEDULE_MAX_RUNS:-0}"
    --min-score "${SEARCH_MIN_SCORE:-50}"
    --max "${SEARCH_MAX_APPS:-5}"
  )
  if [ "${SEARCH_SCRAPE:-true}" != "false" ]; then
    args+=(--scrape)
    if [ -n "${SEARCH_BOARDS:-}" ]; then
      args+=(--boards "${SEARCH_BOARDS}")
    fi
    if [ -n "${SEARCH_COMPANY_BOARDS:-}" ]; then
      args+=(--company-boards "${SEARCH_COMPANY_BOARDS}")
    fi
  fi
  if [ "${DRY_RUN:-true}" != "false" ]; then
    args+=(--dry-run)
  fi
  printf '%s\0' "${args[@]}"
}

start_email_monitor() {
  if [ -n "${SUPERJOB_IMAP_USER}" ] && [ -n "${SUPERJOB_IMAP_PASSWORD}" ]; then
    echo "Starting email monitor (every ${EMAIL_SCAN_INTERVAL_MIN:-30} min)..."
    npx tsx packages/email-monitor/src/cli/index.ts watch \
      --provider "${SUPERJOB_IMAP_PROVIDER:-gmail}" \
      --user "${SUPERJOB_IMAP_USER}" \
      --pass "${SUPERJOB_IMAP_PASSWORD}" \
      --interval "${EMAIL_SCAN_INTERVAL_MIN:-30}" &
    EMAIL_PID=$!
  fi
}

start_scheduler() {
  echo "Starting crew scheduler..."
  mapfile -d '' CREW_ARGS < <(build_crew_args)
  npx tsx packages/crew/src/cli/index.ts schedule "${CREW_ARGS[@]}" &
  SCHED_PID=$!
}

start_api() {
  echo "Starting API server on :3000..."
  npx tsx docker/api-server.ts &
  API_PID=$!
}

case "$MODE" in
  schedule)
    start_scheduler
    start_email_monitor
    trap "kill ${SCHED_PID:-} ${EMAIL_PID:-} 2>/dev/null; exit 0" SIGTERM SIGINT
    wait
    ;;
  serve)
    exec npx tsx docker/api-server.ts
    ;;
  both)
    start_api
    start_scheduler
    start_email_monitor
    trap "kill ${API_PID:-} ${SCHED_PID:-} ${EMAIL_PID:-} 2>/dev/null; exit 0" SIGTERM SIGINT
    wait
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Use: schedule | serve | both"
    exit 1
    ;;
esac
