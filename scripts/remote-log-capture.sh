#!/usr/bin/env bash
set -euo pipefail

cd /var/www/sak-whatsapp-api

mkdir -p logs
: > logs/inbound_webhook_test.log

nohup bash -lc 'timeout 120 sudo docker compose logs -f --since 0m backend' > logs/inbound_webhook_test.log 2>&1 &

echo STARTED
