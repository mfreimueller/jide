# Sourced by the deploy scripts. Everything that identifies a deployment is configuration, never code.
#
#   DEPLOY_TARGET  SSH login of the server, user@host
#   DEPLOY_DOMAIN  public domain the API and teacher app are served from, e.g. exams.example.org
#
# Each comes from, in this order: the environment, then the gitignored file ".deploy.env" in the
# repo root (copy .deploy.env.example). DEPLOY_TARGET may also be given as the first argument.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT/.deploy.env" ]; then
  # shellcheck disable=SC1091
  . "$ROOT/.deploy.env"
fi

TARGET="${1:-${DEPLOY_TARGET:-}}"
DOMAIN="${DEPLOY_DOMAIN:-}"
if [ -z "$TARGET" ] || [ -z "$DOMAIN" ]; then
  echo "Usage: $0 [user@host]" >&2
  echo "Set DEPLOY_TARGET and DEPLOY_DOMAIN in the environment or in .deploy.env (see .deploy.env.example)." >&2
  exit 1
fi
