#!/usr/bin/env bash
#
# Installation de StudentPlace sur un serveur Debian ou Ubuntu.
#
#   sudo bash scripts/install.sh [nom-de-domaine]
#
# Le script est idempotent : le relancer ne casse rien et ne régénère jamais
# les secrets d'un .env existant.

set -euo pipefail

APP_NAME="studentplace"
APP_USER="studentplace"
APP_DIR="/opt/studentplace"
DATA_DIR="/var/lib/studentplace"
BACKUP_DIR="${DATA_DIR}/backups"
DB_PATH="${DATA_DIR}/studentplace.db"
PORT="3000"
NODE_MAJOR="24"

DOMAIN="${1:-}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

info()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m /!\\ %s\033[0m\n' "$*"; }
die()   { printf '\033[1;31mErreur : %s\033[0m\n' "$*" >&2; exit 1; }

# --------------------------------------------------------------- contrôles

[ "$(id -u)" -eq 0 ] || die "à lancer avec sudo."
command -v apt-get >/dev/null || die "ce script vise Debian ou Ubuntu (apt-get introuvable)."
[ -f "${SOURCE_DIR}/package.json" ] || die "package.json introuvable dans ${SOURCE_DIR}."

if [ -z "${DOMAIN}" ]; then
  warn "Aucun domaine fourni : nginx écoutera sur l'adresse IP, sans HTTPS."
  warn "Usage recommandé : sudo bash scripts/install.sh plans.mon-etablissement.fr"
fi

# ------------------------------------------------------------- dépendances

info "Installation des paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg rsync sqlite3 nginx build-essential openssl

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "${NODE_MAJOR}" ]; then
  info "Installation de Node.js ${NODE_MAJOR} LTS"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
info "Node $(node -v), npm $(npm -v)"

# ------------------------------------------------------ utilisateur et dossiers

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  info "Création de l'utilisateur système ${APP_USER}"
  useradd --system --create-home --home-dir "/home/${APP_USER}" --shell /usr/sbin/nologin "${APP_USER}"
fi

mkdir -p "${APP_DIR}" "${DATA_DIR}" "${BACKUP_DIR}"

# ----------------------------------------------------------- copie du code

info "Copie du code vers ${APP_DIR}"
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'src/generated' \
  "${SOURCE_DIR}/" "${APP_DIR}/"

# ------------------------------------------------------------------ secrets

ENV_FILE="${APP_DIR}/.env"

if [ -f "${ENV_FILE}" ]; then
  info "Fichier .env existant conservé"
  # Régénérer ENCRYPTION_KEY rendrait illisibles tous les commentaires déjà
  # enregistrés : on n'y touche jamais automatiquement.
else
  info "Génération du fichier .env et des secrets"
  APP_URL="http://localhost:${PORT}"
  [ -n "${DOMAIN}" ] && APP_URL="https://${DOMAIN}"

  cat > "${ENV_FILE}" <<EOF
DATABASE_URL="file:${DB_PATH}"
BETTER_AUTH_URL="${APP_URL}"
NEXT_PUBLIC_APP_URL="${APP_URL}"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
ENCRYPTION_KEY="$(openssl rand -base64 32)"
PORT=${PORT}
NODE_ENV=production
EOF

  warn "SAUVEGARDEZ ${ENV_FILE} : sans ENCRYPTION_KEY, les commentaires sur les élèves sont définitivement illisibles."
fi

chmod 600 "${ENV_FILE}"

# ------------------------------------------------------------- construction

info "Installation des dépendances (quelques minutes)"
cd "${APP_DIR}"
npm ci --no-audit --no-fund

info "Préparation de la base de données"
# `db push` applique le schéma directement, sans fichiers de migration :
# c'est le mode adapté à une instance unique auto-hébergée.
npx prisma db push --skip-generate --accept-data-loss

# WAL : lectures et écritures concurrentes sans blocage. Réglage persistant,
# inscrit une fois pour toutes dans le fichier de base.
sqlite3 "${DB_PATH}" "PRAGMA journal_mode=WAL;" >/dev/null

info "Construction de l'application"
npm run build

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${DATA_DIR}"

# ----------------------------------------------------------------- systemd

info "Installation du service systemd"
cat > "/etc/systemd/system/${APP_NAME}.service" <<EOF
[Unit]
Description=StudentPlace — gestion des plans de classe
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=$(command -v npm) run start
Restart=always
RestartSec=5

# Cloisonnement : le service n'écrit que dans son dossier de données.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR} ${APP_DIR}/.next

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${APP_NAME}"
systemctl restart "${APP_NAME}"

# ------------------------------------------------------------------- nginx

info "Configuration de nginx"
SERVER_NAME="${DOMAIN:-_}"

cat > "/etc/nginx/sites-available/${APP_NAME}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${SERVER_NAME};

    # Les listes d'élèves collées à l'import peuvent être volumineuses.
    client_max_body_size 4M;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ------------------------------------------------------------------- HTTPS

if [ -n "${DOMAIN}" ]; then
  info "Obtention du certificat HTTPS"
  apt-get install -y -qq certbot python3-certbot-nginx
  if certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
    info "HTTPS actif"
  else
    warn "Certbot a échoué. Vérifiez que ${DOMAIN} pointe bien vers ce serveur, puis relancez :"
    warn "  sudo certbot --nginx -d ${DOMAIN}"
  fi
fi

# -------------------------------------------------------------- sauvegardes

info "Installation de la sauvegarde quotidienne"
install -m 755 "${APP_DIR}/scripts/backup.sh" /usr/local/bin/studentplace-backup

cat > /etc/systemd/system/studentplace-backup.service <<EOF
[Unit]
Description=Sauvegarde de la base StudentPlace

[Service]
Type=oneshot
User=${APP_USER}
Environment=DB_PATH=${DB_PATH}
Environment=BACKUP_DIR=${BACKUP_DIR}
ExecStart=/usr/local/bin/studentplace-backup
EOF

cat > /etc/systemd/system/studentplace-backup.timer <<EOF
[Unit]
Description=Sauvegarde quotidienne de StudentPlace

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now studentplace-backup.timer

# ------------------------------------------------------------------- bilan

info "Installation terminée"
cat <<EOF

  Application    : ${DOMAIN:+https://${DOMAIN}}${DOMAIN:-http://$(hostname -I | awk '{print $1}')}
  Code           : ${APP_DIR}
  Base           : ${DB_PATH}
  Sauvegardes    : ${BACKUP_DIR} (quotidiennes, 14 jours conservés)

  État du service   : systemctl status ${APP_NAME}
  Journaux          : journalctl -u ${APP_NAME} -f
  Mise à jour       : sudo bash ${APP_DIR}/scripts/update.sh

  Créez maintenant votre compte sur la page « Créer un compte ».

EOF
