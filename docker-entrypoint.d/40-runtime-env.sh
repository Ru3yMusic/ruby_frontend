#!/bin/sh
set -eu

API_GATEWAY_URL="${API_GATEWAY_URL:-http://146.181.41.236:8080}"
REALTIME_WS_URL="${REALTIME_WS_URL:-$API_GATEWAY_URL}"
WS_AUTH_REFRESH_ENABLED="${WS_AUTH_REFRESH_ENABLED:-false}"

# mkdir -p ensures the assets dir exists even if a future Angular build
# strips it (defensive — without this the cat > would fail with ENOENT
# and the SPA would silently fall back to environment.ts defaults
# (= localhost:8080) which is catastrophic in prod).
mkdir -p /usr/share/nginx/html/assets

cat > /usr/share/nginx/html/assets/env.js <<EOF
window.__env = {
  apiGatewayUrl: '${API_GATEWAY_URL}',
  realtimeWsUrl: '${REALTIME_WS_URL}',
  wsAuthRefreshEnabled: '${WS_AUTH_REFRESH_ENABLED}'
};
EOF
