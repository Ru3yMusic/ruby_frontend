const runtimeEnv = (globalThis as any).__env ?? {};

export const environment = {
  production: true,
  apiGatewayUrl: runtimeEnv.apiGatewayUrl || 'http://146.181.41.236:8080',
  realtimeWsUrl: runtimeEnv.realtimeWsUrl || 'http://146.181.41.236:8080',
  enableMockLogin: false,
};
