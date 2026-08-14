#!/usr/bin/env bash
#
# Restauration d'une sauvegarde StudentPlace.
#
#   sudo bash scripts/restore.sh /var/lib/studentplace/backups/studentplace-2026-08-14_033000.db.gz

set -euo pipefail

ARCHIVE="${1:-}"
DB_PATH="${DB_PATH:-/var/lib/studentplace/studentplace.db}"
APP_NAME="studentplace"

[ -n "${ARCHIVE}" ] || { echo "Usage : sudo bash scripts/restore.sh <archive.db.gz>" >&2; exit 1; }
[ -f "${ARCHIVE}" ] || { echo "Archive introuvable : ${ARCHIVE}" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "À lancer avec sudo." >&2; exit 1; }

echo "La base actuelle (${DB_PATH}) va être REMPLACÉE par ${ARCHIVE}."
read -r -p "Confirmer ? [oui/NON] " answer
[ "${answer}" = "oui" ] || { echo "Annulé."; exit 0; }

systemctl stop "${APP_NAME}"

# La base actuelle est mise de côté plutôt qu'écrasée : une restauration
# lancée sur la mauvaise archive doit rester réparable.
if [ -f "${DB_PATH}" ]; then
  SAFETY="${DB_PATH}.avant-restauration-$(date +%Y%m%d_%H%M%S)"
  mv "${DB_PATH}" "${SAFETY}"
  echo "Base précédente conservée sous ${SAFETY}"
fi

# Les fichiers annexes du mode WAL doivent disparaître avec l'ancienne base.
rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"

gunzip -c "${ARCHIVE}" > "${DB_PATH}"
chown studentplace:studentplace "${DB_PATH}"
sqlite3 "${DB_PATH}" "PRAGMA journal_mode=WAL;" >/dev/null

systemctl start "${APP_NAME}"
echo "Restauration terminée."
