#!/usr/bin/env bash
# Deploy (or update) BlinkScore on the VPS. Run on the server:
#     sudo /srv/blinkscore/app/deploy/deploy.sh [git-ref]      # default: origin/main
#
# What it does, in order, stopping at the first failure:
#   1. backs up the SQLite database (kept: last 30)
#   2. checks out the requested git ref
#   3. installs backend dependencies into the venv
#   4. builds the frontend and swaps it into the web root
#   5. restarts the API and checks /health; on failure it says how to roll back
set -euo pipefail

# git checkout below rewrites this very file, and bash reads scripts as it
# runs them, so run from a private copy.
if [ -z "${BLINKSCORE_DEPLOY_COPY:-}" ]; then
  copy=$(mktemp)
  cp "$0" "$copy"
  BLINKSCORE_DEPLOY_COPY=1 exec bash "$copy" "$@"
fi

BASE=/srv/blinkscore
APP=$BASE/app
DATA=$BASE/data
WWW=$BASE/www
VENV=$BASE/venv
REF=${1:-origin/main}
SERVICE=blinkscore

log() { printf '\n==> %s\n' "$*"; }
as_app() { sudo -u blinkscore -H "$@"; }

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }

log "Backing up the database"
mkdir -p "$DATA/backups"
if [ -f "$DATA/data.db" ]; then
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  # sqlite3's .backup is safe while the app is running (WAL mode)
  sqlite3 "$DATA/data.db" ".backup '$DATA/backups/data-$stamp.db'"
  ls -1t "$DATA"/backups/data-*.db | tail -n +31 | xargs -r rm --
  echo "Saved $DATA/backups/data-$stamp.db"
else
  echo "No database yet (first deploy)"
fi
chown -R blinkscore:blinkscore "$DATA"

log "Checking out $REF"
previous=$(as_app git -C "$APP" rev-parse HEAD)
as_app git -C "$APP" fetch --prune origin
as_app git -C "$APP" checkout --detach "$REF"
current=$(as_app git -C "$APP" rev-parse HEAD)
echo "Was $previous, now $current"

log "Installing backend dependencies"
[ -d "$VENV" ] || as_app python3 -m venv "$VENV"
as_app "$VENV/bin/pip" install --quiet --upgrade pip
as_app "$VENV/bin/pip" install --quiet -r "$APP/backend/requirements.txt"

log "Building the frontend"
as_app bash -c "cd '$APP/frontend' && npm ci --no-audit --no-fund && npm run build"
rm -rf "$WWW.new"
cp -r "$APP/frontend/dist" "$WWW.new"
rm -rf "$WWW.old"
[ -d "$WWW" ] && mv "$WWW" "$WWW.old"
mv "$WWW.new" "$WWW"

log "Restarting the API"
systemctl restart "$SERVICE"
for _ in $(seq 30); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    log "Deployed $current. https://blinkscore.in is live."
    exit 0
  fi
  sleep 1
done

echo
echo "!! The API did not come back healthy. Recent logs:"
journalctl -u "$SERVICE" -n 40 --no-pager || true
echo
echo "To roll back:  sudo $APP/deploy/deploy.sh $previous"
echo "and if the database needs restoring, see deploy/README.md (Rolling back)."
exit 1
