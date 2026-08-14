#!/usr/bin/env bash
#
# Mise à jour de StudentPlace déjà installé.
#
#   sudo bash /opt/studentplace/scripts/update.sh
#
# À lancer depuis le dossier d'installation, ou depuis une copie à jour du
# code que l'on souhaite déployer.

set -euo pipefail

APP_NAME="studentplace"
APP_USER="studentplace"
APP_DIR="/opt/studentplace"
DATA_DIR="/var/lib/studentplace"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

info() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "À lancer avec sudo." >&2; exit 1; }
[ -f "${APP_DIR}/.env" ] || { echo "StudentPlace ne semble pas installé (${APP_DIR}/.env absent)." >&2; exit 1; }

info "Sauvegarde préalable de la base"
DB_PATH="${DATA_DIR}/studentplace.db" BACKUP_DIR="${DATA_DIR}/backups" bash "${SOURCE_DIR}/scripts/backup.sh"

if [ "${SOURCE_DIR}" != "${APP_DIR}" ]; then
  info "Copie du nouveau code vers ${APP_DIR}"
  rsync -a --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'src/generated' \
    "${SOURCE_DIR}/" "${APP_DIR}/"
fi

cd "${APP_DIR}"

info "Dépendances"
npm ci --no-audit --no-fund

info "Schéma de base"
npx prisma db push --skip-generate

info "Construction"
npm run build

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${DATA_DIR}"

info "Redémarrage du service"
systemctl restart "${APP_NAME}"
sleep 2
systemctl --no-pager --lines=10 status "${APP_NAME}" || true

info "Mise à jour terminée"
