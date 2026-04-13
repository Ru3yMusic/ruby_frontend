export const environment = {
  production: false,
  apiGatewayUrl: 'http://localhost:8080',
  // Gateway proxies /socket.io/** → realtime-ws-ms:3001 (direct, not via Eureka)
  realtimeWsUrl: 'http://localhost:8080',
};
