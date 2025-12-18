#!/bin/bash
set -e
export SAK_API_KEY='sak_live_37f5462d00644fdebd7e5534b10767bb30b209d864174e44aed6fcd0ae3e8e09'
export SAK_SESSION_ID='b14c2ec9-ade4-4114-a1ed-35f753787fd2'

# Download test image if not exists
if [ ! -f /tmp/test.jpg ]; then
  wget -q -O /tmp/test.jpg 'https://picsum.photos/800/600'
  echo 'Downloaded test image'
fi

# Send image
curl -X POST http://wapi.saksolution.com/api/v1/messages/send-image \
  -H "x-api-key: $SAK_API_KEY" \
  -H "x-session-id: $SAK_SESSION_ID" \
  -F "to=971507055253" \
  -F "caption=Test image from SAK WhatsApp API (curl)" \
  -F "image=@/tmp/test.jpg"

echo
