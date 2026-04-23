#!/bin/sh
set -eu

API_GATEWAY_URL="${API_GATEWAY_URL:-http://146.181.41.236:8080}"
REALTIME_WS_URL="${REALTIME_WS_URL:-$API_GATEWAY_URL}"

cat > /usr/share/nginx/html/assets/env.js <<EOF
window.__env = {
  apiGatewayUrl: '${API_GATEWAY_URL}',
  realtimeWsUrl: '${REALTIME_WS_URL}'
};
EOF
