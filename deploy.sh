#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PoolDN — rebuild and re-run the production docker stack from the working tree.
#
#   ./deploy.sh                  rebuild the image, restart, keep the data
#   ./deploy.sh --reset          … and wipe the schema first (no seed, admin only)
#   ./deploy.sh --fresh          … and delete the Postgres/Redis/uploads volumes
#   ./deploy.sh --no-build       restart the existing image, skip the build
#   ./deploy.sh --logs           follow the app log after it comes up
#
# Host ports stay in the 9xxx range (app 9084, postgres 9432, redis 9379) so
# this never fights the bare-metal `npm run start` on :8084.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=".env.docker"
COMPOSE=(docker compose --env-file "$ENV_FILE")
APP_URL="http://localhost:9084"

RESET=false
FRESH=false
BUILD=true
FOLLOW=false

for arg in "$@"; do
  case "$arg" in
    --reset)    RESET=true ;;
    --fresh)    FRESH=true ;;
    --no-build) BUILD=false ;;
    --logs)     FOLLOW=true ;;
    -h|--help)  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $arg (try --help)" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ── Preflight ───────────────────────────────────────────────────────────────
[ -f "$ENV_FILE" ] || fail "$ENV_FILE is missing. Start from the template:
    cp .env.docker.example $ENV_FILE
  then fill in AUTH_SECRET, AUTH_REFRESH_SECRET and ADMIN_PASSWORD."

if grep -qE '^(AUTH_SECRET|AUTH_REFRESH_SECRET|ADMIN_PASSWORD)="?CHANGE_ME' "$ENV_FILE"; then
  fail "$ENV_FILE still has CHANGE_ME placeholders. Generate secrets with:
    openssl rand -hex 32"
fi

docker info >/dev/null 2>&1 || fail "Docker is not running."

# lib/graphql/generated is gitignored, so a clean checkout has no copy to send
# in the build context. Produce one here rather than inside the image, where a
# codegen failure is much harder to read.
if [ ! -f lib/graphql/generated/index.ts ]; then
  step "graphql codegen (generated client is missing)"
  npm run codegen
fi

# ── Danger zones ────────────────────────────────────────────────────────────
if [ "$FRESH" = true ]; then
  step "deleting the postgres, redis and uploads volumes"
  read -r -p "  This destroys all data in the docker stack. Type 'yes' to continue: " ok
  [ "$ok" = "yes" ] || fail "aborted."
  "${COMPOSE[@]}" down -v
elif [ "$RESET" = true ]; then
  step "database will be wiped on boot (RESET_DB=true) — migrations replay, no seed"
  read -r -p "  This drops every table in the docker database. Type 'yes' to continue: " ok
  [ "$ok" = "yes" ] || fail "aborted."
  export RESET_DB=true
fi

# ── Build + start ───────────────────────────────────────────────────────────
if [ "$BUILD" = true ]; then
  step "building the production image"
  # NEXT_PUBLIC_APP_URL is inlined into the client bundle at build time, which
  # is exactly why the domain has to be baked here and not just restarted in.
  "${COMPOSE[@]}" build app
fi

step "starting the stack"
"${COMPOSE[@]}" up -d --force-recreate app
"${COMPOSE[@]}" up -d db redis

# ── Wait for health ─────────────────────────────────────────────────────────
step "waiting for the app to become healthy"
for i in $(seq 1 90); do
  status="$("${COMPOSE[@]}" ps app --format '{{.Status}}' 2>/dev/null || true)"
  case "$status" in
    *healthy*)     printf '  up after %ss\n' "$i"; break ;;
    *Restarting*|*Exited*)
      "${COMPOSE[@]}" logs app --tail 40
      fail "the app container is not staying up (status: $status)" ;;
  esac
  [ "$i" -eq 90 ] && { "${COMPOSE[@]}" logs app --tail 40; fail "timed out waiting for health"; }
  sleep 1
done

# ── Smoke test ──────────────────────────────────────────────────────────────
step "smoke test"
code="$(curl -s -o /dev/null -w '%{http_code}' "$APP_URL/" || true)"
[ "$code" = "200" ] || { "${COMPOSE[@]}" logs app --tail 40; fail "GET / returned $code"; }
printf '  GET /        → 200\n'
code="$(curl -s -o /dev/null -w '%{http_code}' "$APP_URL/sign-in" || true)"
printf '  GET /sign-in → %s\n' "$code"

"${COMPOSE[@]}" logs app 2>&1 | grep -E 'seed-admin:' | tail -2 || true

step "done"
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
cat <<TXT

  app        $APP_URL   (point the pooldn.com proxy / tunnel here)
  postgres   127.0.0.1:9432
  redis      127.0.0.1:9379

  Auth cookies are Secure and the session is gated on APP_ORIGIN_ALLOWLIST,
  so $APP_URL renders signed-out until HTTPS on the real
  domain sits in front of it. That is expected, not a broken deploy.
TXT

if [ "$FOLLOW" = true ]; then
  step "following app logs (ctrl-c to stop)"
  "${COMPOSE[@]}" logs -f app
fi
