#!/usr/bin/env bash
#
# Mise à jour de StudentPlace depuis le dépôt Git.
#
#   sudo bash /opt/studentplace/scripts/update.sh            # dernière version de main
#   sudo bash /opt/studentplace/scripts/update.sh v1.2.0     # une étiquette ou une branche précise
#
# Variables d'environnement acceptées :
#   REPO_URL   dépôt source (défaut : celui du projet)
#   BRANCH     branche ou étiquette (défaut : main, ou le premier argument)
#   LOCAL_DIR  déployer depuis un dossier local au lieu de Git
#
# Le code est récupéré dans un dossier temporaire puis recopié : le serveur n'a
# jamais besoin d'être un dépôt Git, et une éventuelle modification faite sur
# place ne bloque jamais la mise à jour.
#
# TOUT le script tient dans une fonction appelée en dernière ligne. Ce n'est pas
# une coquetterie : rsync réécrit ce fichier pendant son exécution, et bash lit
# ses scripts au fil de l'eau. Encapsuler force l'analyse complète avant le
# premier effet de bord.

set -euo pipefail

main() {
  local APP_NAME="studentplace"
  local APP_USER="studentplace"
  local APP_DIR="/opt/studentplace"
  local DATA_DIR="/var/lib/studentplace"

  local REPO_URL="${REPO_URL:-https://github.com/Acidpix/StudentPlace.git}"
  local BRANCH="${BRANCH:-${1:-main}}"
  local LOCAL_DIR="${LOCAL_DIR:-}"

  local TMP_DIR=""

  info()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
  warn()  { printf '\033[1;33m /!\\ %s\033[0m\n' "$*"; }
  die()   { printf '\033[1;31mErreur : %s\033[0m\n' "$*" >&2; exit 1; }

  cleanup() {
    [ -n "${TMP_DIR}" ] && [ -d "${TMP_DIR}" ] && rm -rf "${TMP_DIR}"
  }
  trap cleanup EXIT

  # ------------------------------------------------------------- contrôles

  [ "$(id -u)" -eq 0 ] || die "à lancer avec sudo."
  [ -f "${APP_DIR}/.env" ] || die "StudentPlace ne semble pas installé (${APP_DIR}/.env absent). Utilisez scripts/install.sh."

  command -v git >/dev/null || {
    info "Installation de git"
    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git
  }

  # --------------------------------------------------- sauvegarde préalable

  info "Sauvegarde de la base avant mise à jour"
  if [ -x /usr/local/bin/studentplace-backup ]; then
    DB_PATH="${DATA_DIR}/studentplace.db" BACKUP_DIR="${DATA_DIR}/backups" \
      /usr/local/bin/studentplace-backup
  else
    DB_PATH="${DATA_DIR}/studentplace.db" BACKUP_DIR="${DATA_DIR}/backups" \
      bash "${APP_DIR}/scripts/backup.sh"
  fi

  # ------------------------------------------------- récupération du code

  local SOURCE_DIR

  if [ -n "${LOCAL_DIR}" ]; then
    [ -f "${LOCAL_DIR}/package.json" ] || die "package.json introuvable dans ${LOCAL_DIR}."
    info "Déploiement depuis le dossier local ${LOCAL_DIR}"
    SOURCE_DIR="${LOCAL_DIR}"
  else
    TMP_DIR="$(mktemp -d)"
    info "Récupération de ${REPO_URL} (${BRANCH})"

    # Clone superficiel : on ne déploie qu'un état, l'historique est inutile ici.
    git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${TMP_DIR}/source" \
      || die "clone impossible. Vérifiez l'URL du dépôt et l'existence de la branche « ${BRANCH} »."

    SOURCE_DIR="${TMP_DIR}/source"

    local COMMIT
    COMMIT="$(git -C "${SOURCE_DIR}" rev-parse --short HEAD)"
    info "Version déployée : ${BRANCH} @ ${COMMIT}"
    printf '%s %s %s\n' "${BRANCH}" "${COMMIT}" "$(date -Iseconds)" > "${SOURCE_DIR}/.deployed"
  fi

  [ -f "${SOURCE_DIR}/package.json" ] || die "le code récupéré ne contient pas de package.json."

  # -------------------------------------------------------------- copie

  info "Copie du code vers ${APP_DIR}"
  # Les exclusions protègent aussi de --delete : le .env, la base générée par
  # Prisma et les dépendances déjà installées survivent à la synchronisation.
  rsync -a --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'src/generated' \
    "${SOURCE_DIR}/" "${APP_DIR}/"

  # ---------------------------------------------------------- construction

  cd "${APP_DIR}"

  info "Dépendances"
  # Même repli qu'à l'installation : `npm ci` échoue tant que le dépôt ne
  # versionne pas de package-lock.json.
  if [ -f "${APP_DIR}/package-lock.json" ]; then
    npm ci --no-audit --no-fund
  else
    warn "package-lock.json absent : résolution des versions par npm install."
    npm install --no-audit --no-fund
  fi

  info "Schéma de base"
  npx prisma db push --skip-generate

  info "Construction"
  npm run build

  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${DATA_DIR}"

  # ------------------------------------------------------------ redémarrage

  info "Redémarrage du service"
  systemctl restart "${APP_NAME}"
  sleep 3

  if systemctl is-active --quiet "${APP_NAME}"; then
    info "Mise à jour terminée"
    systemctl --no-pager --lines=5 status "${APP_NAME}" || true
  else
    warn "Le service n'a pas redémarré correctement."
    warn "Journaux : journalctl -u ${APP_NAME} -n 50 --no-pager"
    warn "Restauration : sudo bash ${APP_DIR}/scripts/restore.sh ${DATA_DIR}/backups/<archive>.db.gz"
    exit 1
  fi
}

main "$@"
