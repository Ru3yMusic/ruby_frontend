const runtimeEnv = (globalThis as any).__env ?? {};

export const environment = {
  production: false,
  apiGatewayUrl: runtimeEnv.apiGatewayUrl || 'http://localhost:8080',
  // Gateway proxies /socket.io/** → realtime-ws-ms:3001 (direct, not via Eureka)
  realtimeWsUrl: runtimeEnv.realtimeWsUrl || 'http://localhost:8080',
  wsAuthRefreshEnabled:
    runtimeEnv.wsAuthRefreshEnabled === true || runtimeEnv.wsAuthRefreshEnabled === 'true',
};
