#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Royal 1 — PostgreSQL restore from a pg-backup.sh archive.
#
#   ./deploy/backup/pg-restore.sh ./backups/royal1-YYYYMMDD-HHMMSS.dump.gz
#
# ⚠ DESTRUCTIVE: --clean --if-exists drops and recreates the archived objects
# in the target database before restoring their data.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"
[[ -f .env ]] && { set -a; . ./.env; set +a; }

ARCHIVE="${1:-}"
: "${DATABASE_URL:?DATABASE_URL is required}"
[[ -n "${ARCHIVE}" && -s "${ARCHIVE}" ]] || { echo "Usage: $0 <dump.gz>" >&2; exit 1; }
NET="${COMPOSE_NETWORK:-$(basename "${ROOT}")_appnet}"

echo "⚠ This will DROP and replace tables in the target database."
read -r -p "Type 'RESTORE' to continue: " confirm
[[ "${confirm}" == "RESTORE" ]] || { echo "Aborted."; exit 1; }

echo "==> Restoring ${ARCHIVE}"
gunzip -c "${ARCHIVE}" | docker run --rm -i --network "${NET}" \
  --add-host host.docker.internal:host-gateway \
  postgres:16-alpine \
  pg_restore --dbname="${DATABASE_URL}" --clean --if-exists --no-owner

echo "✓ Restore complete."
