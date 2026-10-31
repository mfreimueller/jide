#!/usr/bin/env bash
# Builds the teacher app and syncs it into the domain's document root.
# The API lives on the same domain under /api, so no API URL is baked in.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

echo "==> Checking and building the teacher app"
cd "$ROOT"
npm ci
npm run typecheck -w @jide/teacher
npm test -w @jide/teacher
npm run build -w @jide/teacher

# Uberspace serves an added domain from /var/www/virtual/<user>/<domain>.
DOCROOT="$(ssh "$TARGET" "echo /var/www/virtual/\$USER/$DOMAIN")"

echo "==> Syncing build/ to the document root"
# --delete removes stale hashed assets; .htaccess comes from static/ and is part of build/.
rsync -az --delete "$ROOT/teacher/build/" "$TARGET:$DOCROOT/"

echo "==> Done. Open: https://$DOMAIN"
