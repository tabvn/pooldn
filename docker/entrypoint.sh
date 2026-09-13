#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# PoolDN container entrypoint.
#
#   1. wait for Postgres
#   2. bring the schema up to date  (RESET_DB=true wipes it first)
#   3. bootstrap the single SUPER_ADMIN account — no demo seed
#   4. exec the CMD (next start)
#
# The CLIs are invoked by path, not through npx: package.json still lists
# prisma/tsx as devDependencies, so npx resolves their carets to a newer
# version than the one `npm install --no-save` pinned into the image and then
# refuses to run offline.
#
# Step 3 is idempotent: it upserts, so a restart never duplicates or
# clobbers a password the admin has since changed... unless you set
# ADMIN_FORCE_PASSWORD=true.
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCHEMA=prisma/schema.prisma

echo "▸ waiting for database…"
i=0
until ./node_modules/.bin/prisma db execute --schema "$SCHEMA" --stdin </dev/null >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "✖ database not reachable after 60s — giving up" >&2
    exit 1
  fi
  sleep 1
done
echo "▸ database is up"

if [ "$RESET_DB" = "true" ]; then
  # Drops and recreates the schema, replays every migration, and skips the
  # demo seed entirely. Destructive — guarded behind an explicit opt-in.
  echo "▸ RESET_DB=true — wiping the database (no seed)"
  ./node_modules/.bin/prisma migrate reset --force --skip-seed --skip-generate --schema "$SCHEMA"
else
  echo "▸ applying migrations"
  ./node_modules/.bin/prisma migrate deploy --schema "$SCHEMA"
fi

echo "▸ bootstrapping admin account"
./node_modules/.bin/tsx prisma/seed-admin.ts

echo "▸ starting app on :${PORT:-8084}"
exec "$@"
