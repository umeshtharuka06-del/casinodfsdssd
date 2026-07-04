#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Royal 1 — PostgreSQL backup (works for the host's Postgres and the optional
# bundled postgres container).
#
# Runs pg_dump via a throwaway postgres:16-alpine container attached to the app
# network (with host.docker.internal mapped, so host-installed Postgres works
# too), streaming a gzipped custom-format dump to ./backups, then prunes old
# archives.
#
#   ./deploy/backup/pg-backup.sh
#
# Env (from .env): DATABASE_URL (required), BACKUP_RETAIN_DAYS (7),
#   BACKUP_DIR (./backups), COMPOSE_NETWORK (default <project>_appnet).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"
[[ -f .env ]] && { set -a; . ./.env; set +a; }

: "${DATABASE_URL:?DATABASE_URL is required (set it in .env)}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
NET="${COMPOSE_NETWORK:-$(basename "${ROOT}")_appnet}"

mkdir -p "${BACKUP_DIR}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/royal1-${STAMP}.dump.gz"

echo "==> Dumping to ${OUT}"
# Custom format (-Fc) supports selective/parallel restore; gzip on top for size.
# pg_dump reads the connection string directly from the DATABASE_URL argument.
docker run --rm --network "${NET}" \
  --add-host host.docker.internal:host-gateway \
  postgres:16-alpine \
  pg_dump --dbname="${DATABASE_URL}" -Fc | gzip > "${OUT}"

# Fail loudly on an empty/aborted dump.
if [[ ! -s "${OUT}" ]]; then
  echo "!! Backup is empty — removing ${OUT}" >&2
  rm -f "${OUT}"; exit 1
fi

echo "==> Pruning archives older than ${RETAIN_DAYS} days"
find "${BACKUP_DIR}" -name 'royal1-*.dump.gz' -mtime "+${RETAIN_DAYS}" -delete

echo "✓ Backup complete: ${OUT} ($(du -h "${OUT}" | cut -f1))"
