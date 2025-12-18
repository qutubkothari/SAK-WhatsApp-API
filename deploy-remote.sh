#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/sak-whatsapp-api"
PACKAGE="$PACKAGE"

echo "========================================="
echo "SAK WhatsApp API - EC2 Deployment (Docker)"
echo "========================================="
echo ""

echo "Extracting package..."
sudo mkdir -p "$APP_DIR"
sudo chown -R ubuntu:ubuntu "$APP_DIR"

if ! command -v unzip >/dev/null 2>&1; then
    echo "Installing unzip..."
    sudo apt-get update -qq
    sudo apt-get install -y unzip
fi

cd "$APP_DIR"

# Preserve an existing .env (contains secrets)
if [ -f .env ]; then
    cp -f .env /tmp/sak.env.backup
fi

set +e
sudo unzip -oq "/tmp/${PACKAGE}" -d "$APP_DIR"
UNZIP_RC=$?
set -e
if [ "$UNZIP_RC" -gt 1 ]; then
    echo "Unzip failed (exit=$UNZIP_RC)"
    exit "$UNZIP_RC"
fi
sudo chown -R ubuntu:ubuntu "$APP_DIR"
rm -f "/tmp/${PACKAGE}"

if [ -f /tmp/sak.env.backup ]; then
    mv -f /tmp/sak.env.backup .env
fi

echo "Ensuring Docker is installed..."
if ! command -v docker >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
    sudo apt-get update -qq
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker ubuntu || true
fi

echo "Ensuring docker compose is available..."
sudo docker compose version >/dev/null

echo ""
echo "Pre-deploy cleanup (disk/RAM)..."
echo "Disk before:"; df -h / || true
echo "Memory before:"; free -m || true

# Ensure swap exists (helps prevent builds from stalling on small instances)
if ! swapon --show | grep -q .; then
    echo "No swap found -> creating 1G swapfile..."
    sudo fallocate -l 1G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile >/dev/null
    sudo swapon /swapfile
    if ! grep -q '^/swapfile ' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
    fi
fi

# Free Docker build cache + unused images/containers (do NOT prune volumes)
echo "Pruning Docker build cache..."
sudo docker builder prune -af >/dev/null || true
echo "Pruning unused Docker images..."
sudo docker image prune -af >/dev/null || true
echo "Pruning stopped Docker containers..."
sudo docker container prune -f >/dev/null || true

echo "Disk after:"; df -h / || true
echo "Memory after:"; free -m || true

mkdir -p logs whatsapp_sessions

if [ ! -f .env ]; then
    echo "Creating .env for Docker Compose..."
    DB_PASSWORD="$(openssl rand -hex 16)"
    JWT_SECRET="$(openssl rand -hex 32)"
    cat > .env <<EOF
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=admin@example.com
EOF
fi

echo "Rebuilding and restarting services..."
sudo docker compose build backend frontend
sudo docker compose up -d --remove-orphans

echo "Services status:"
sudo docker compose ps

echo ""
echo "=========================================="
echo "Deployment Complete"
echo "=========================================="
echo "Frontend: http://$EC2IP"
echo "Backend:  http://$EC2IP/api/v1"
echo "Health:   http://$EC2IP/health"
echo ""
echo "Note: Using HTTP-only configuration"
