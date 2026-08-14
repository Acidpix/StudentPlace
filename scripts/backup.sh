#!/usr/bin/env bash
#
# Sauvegarde de la base SQLite de StudentPlace.
#
#   DB_PATH=/var/lib/studentplace/studentplace.db \
#   BACKUP_DIR=/var/lib/studentplace/backups \
#   bash scripts/backup.sh

set -euo pipefail

DB_PATH="${DB_PATH:-/var/lib/studentplace/studentplace.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/lib/studentplace/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

[ -f "${DB_PATH}" ] || { echo "Base introuvable : ${DB_PATH}" >&2; exit 1; }

mkdir -p "${BACKUP_DIR}"

STAMP="$(date +%Y-%m-%d_%H%M%S)"
TARGET="${BACKUP_DIR}/studentplace-${STAMP}.db"

# `.backup` produit une copie cohérente même pendant que l'application écrit,
# contrairement à un simple `cp` qui pourrait attraper une transaction à moitié
# écrite.
sqlite3 "${DB_PATH}" ".backup '${TARGET}'"
gzip -f "${TARGET}"

find "${BACKUP_DIR}" -name 'studentplace-*.db.gz' -type f -mtime "+${RETENTION_DAYS}" -delete

echo "Sauvegarde : ${TARGET}.gz"
