#!/usr/bin/env bash
set -euo pipefail

SESSION_ID="${1:-}"
URL="${2:-}"
KEEP_WEBHOOK_ID="${3:-}"

if [[ -z "$SESSION_ID" || -z "$URL" || -z "$KEEP_WEBHOOK_ID" ]]; then
  echo "Usage: $0 <session_id> <webhook_url> <keep_webhook_id>" >&2
  exit 2
fi

cd /var/www/sak-whatsapp-api

sudo docker compose exec -T postgres psql -U postgres -d sak_whatsapp_api -v ON_ERROR_STOP=1 -c "
  update webhooks w
  set is_active = (w.id = '${KEEP_WEBHOOK_ID}')
  from sessions s
  where w.session_id = s.id
    and s.session_id = '${SESSION_ID}'
    and w.url = '${URL}';
"

sudo docker compose exec -T postgres psql -U postgres -d sak_whatsapp_api -t -A -c "
  select count(*) as active_webhooks
  from webhooks w
  join sessions s on s.id = w.session_id
  where s.session_id = '${SESSION_ID}'
    and w.url = '${URL}'
    and w.is_active = true;
" | sed '/^$/d'
