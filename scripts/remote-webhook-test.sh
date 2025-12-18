#!/usr/bin/env bash
set -euo pipefail

SESSION_ID="${1:-}"
URL="${2:-}"

if [[ -z "$SESSION_ID" || -z "$URL" ]]; then
  echo "Usage: $0 <session_id> <webhook_url>" >&2
  exit 2
fi

cd /var/www/sak-whatsapp-api

rows=$(sudo docker compose exec -T postgres psql -U postgres -d sak_whatsapp_api -t -A -c "
  select w.id || '|' || w.secret
  from webhooks w
  join sessions s on s.id = w.session_id
  where s.session_id = '${SESSION_ID}'
    and w.url = '${URL}'
    and w.is_active = true
  order by w.created_at asc;
")

count=$(printf '%s\n' "$rows" | sed '/^$/d' | wc -l | tr -d ' ')
echo "active_webhooks=${count}"

payload=$(printf '{"event":"message.received","sessionId":"%s","timestamp":"%s","test":true,"text":"SAK live webhook test"}' \
  "$SESSION_ID" "$(date -Is)")

while IFS='|' read -r wid secret; do
  [[ -z "${wid:-}" ]] && continue

  sig=$(printf '%s' "$payload" | openssl dgst -sha256 -hmac "$secret" -hex | awk '{print $2}')

  code=$(curl -s -o "/tmp/webhook_resp_${wid}.txt" -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Secret: ${secret}" \
    -H "X-Webhook-Signature: sha256=${sig}" \
    -H "X-Webhook-Event: message.received" \
    -d "$payload" \
    "$URL" || true)

  echo "webhookId=${wid} status=${code}"
  head -c 300 "/tmp/webhook_resp_${wid}.txt" 2>/dev/null || true
  echo

done <<< "$rows"
