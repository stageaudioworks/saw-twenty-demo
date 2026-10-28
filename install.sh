#!/usr/bin/env bash
# Installs the SAW Twenty CRM demo on a Debian/Ubuntu host (LXC or VM) with Docker.
# Usage: ./install.sh [public-url]     e.g. ./install.sh https://crm.stageaudioworks.com
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || { echo "Docker Compose plugin missing"; exit 1; }

if [ ! -f .env ]; then
  say "Creating .env with fresh secrets"
  cp .env.example .env
  rnd() { openssl rand -base64 32 | tr -d '\n'; }
  hex() { openssl rand -hex "$1"; }
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(rnd)|; s|^APP_SECRET=.*|APP_SECRET=$(rnd)|" .env
  sed -i "s|^PG_DATABASE_PASSWORD=.*|PG_DATABASE_PASSWORD=$(hex 24)|; s|^WEBHOOK_SECRET=.*|WEBHOOK_SECRET=$(hex 24)|" .env
  sed -i "s|^B1_PASSWORD=.*|B1_PASSWORD=$(hex 12)|; s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=Saw-$(hex 8)|" .env
  if [ "${1:-}" != "" ]; then sed -i "s|^SERVER_URL=.*|SERVER_URL=${1%/}|" .env; fi
fi
mkdir -p state && chmod 700 state

say "Pulling images"
docker compose pull --quiet || echo "Some images could not be pulled (registry limit?); using any already on this host."

say "Starting Twenty, the mock SAP B1 and the sync service (first start takes a few minutes)"
docker compose up -d

say "Configuring the workspace for SAW"
docker compose run --rm setup

val() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }
SERVER_URL=$(val SERVER_URL); ADMIN_EMAIL=$(val ADMIN_EMAIL); ADMIN_PASSWORD=$(val ADMIN_PASSWORD)
B1_MOCK_PORT=$(val B1_MOCK_PORT); SYNC_STATUS_PORT=$(val SYNC_STATUS_PORT)
IP=$(hostname -I 2>/dev/null | awk '{print $1}'); IP=${IP:-localhost}
say "Done"
cat <<EOF
  Twenty CRM ............ ${SERVER_URL}
  Sign in as ............ ${ADMIN_EMAIL}
  Password .............. ${ADMIN_PASSWORD}   (in .env — change it after first sign-in)
  Mock SAP B1 ........... http://${IP}:${B1_MOCK_PORT:-50000}/
  Sync status ........... http://${IP}:${SYNC_STATUS_PORT:-8088}/

  Demo script: see README.md, "Running the demo".
EOF
