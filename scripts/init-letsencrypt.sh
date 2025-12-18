#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-wapi.saksolution.com}"
EMAIL="${2:-admin@example.com}"

if [ ! -f docker-compose.yml ]; then
  echo "Run this from the repo root (where docker-compose.yml is)." >&2
  exit 1
fi

mkdir -p ./certbot/www/.well-known/acme-challenge
mkdir -p ./certbot/conf

LIVE_DIR="./certbot/conf/live/${DOMAIN}"

# Create a temporary self-signed cert so nginx can start on 443.
if [ ! -f "${LIVE_DIR}/fullchain.pem" ] || [ ! -f "${LIVE_DIR}/privkey.pem" ]; then
  echo "Creating temporary self-signed cert for ${DOMAIN} (needed for first boot)..."
  mkdir -p "${LIVE_DIR}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${LIVE_DIR}/privkey.pem" \
    -out "${LIVE_DIR}/fullchain.pem" \
    -subj "/CN=${DOMAIN}" >/dev/null 2>&1
fi

# Ensure nginx is running so the HTTP-01 challenge can be served.
echo "Starting nginx (and dependencies)..."
sudo docker compose up -d nginx

echo "Requesting/renewing Let's Encrypt certificate for ${DOMAIN}..."
sudo docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d "${DOMAIN}" \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

echo "Reloading nginx..."
sudo docker compose exec nginx nginx -s reload

echo "Done. Test: curl -vk https://${DOMAIN}/health"
