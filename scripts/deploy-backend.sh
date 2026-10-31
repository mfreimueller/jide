#!/usr/bin/env bash
# Builds the API and ships it to the server, then restarts the service.
# First-time server setup is described in docs/deployment.md.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

REMOTE_DIR="jide-backend"   # relative to the remote home directory
SERVICE="jide-backend"

echo "==> Checking and building the backend"
cd "$ROOT"
npm ci
npm run typecheck -w @jide/backend
npm test -w @jide/backend
npm run build -w @jide/backend

echo "==> Uploading dist/ (self-contained bundle, no node_modules needed on the server)"
rsync -az --delete "$ROOT/backend/dist/" "$TARGET:$REMOTE_DIR/dist/"

echo "==> Restarting $SERVICE (migrations run on start)"
ssh "$TARGET" "supervisorctl restart $SERVICE"

echo "==> Waiting for the health check"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "https://$DOMAIN/api/health"; then
    echo
    echo "==> Done."
    exit 0
  fi
  sleep 2
done
echo "Health check failed: https://$DOMAIN/api/health. See: ssh $TARGET supervisorctl status $SERVICE" >&2
exit 1
