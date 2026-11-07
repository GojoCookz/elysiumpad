// Isolated product service. Provider reuse is explicit and opt-in; switches and data paths
// remain namespaced so a shared credential cannot silently activate another product.
export const SOLANA_PREFIX = '/api/purrlysium/solana';
const fields = {
  RPC_URL: 'SOLANA_RPC_URL', JUPITER_API_KEY: 'JUPITER_API_KEY',
  PUBLIC_ORIGIN: 'PUBLIC_ORIGIN', PINATA_JWT: 'PINATA_JWT',
  TRADING_ENABLED: 'PAD_TRADING_ENABLED', LAUNCH_ENABLED: 'PAD_LAUNCH_ENABLED',
  METADATA_ENABLED: 'PAD_METADATA_ENABLED', DATA_DIR: 'PAD_DATA_DIR',
};
export function purrSolanaEnvironment(env) {
  const own = { PAD_PRODUCT: 'leveragepad', PAD_BRAND_NAME: 'Hypeliysium', PAD_DATA_DIR: './data/purrlysium-solana', PORT: '3109' };
  for (const [suffix, key] of Object.entries(fields)) if (env[`PURRLYSIUM_SOLANA_${suffix}`]) own[key] = env[`PURRLYSIUM_SOLANA_${suffix}`];
  if (env.PURRLYSIUM_REUSE_AUTHORIZED === 'true') {
    const reuse = { RPC_URL: 'SOLANA_RPC_URL', JUPITER_API_KEY: 'JUPITER_API_KEY', PUBLIC_ORIGIN: 'PUBLIC_ORIGIN', PINATA_JWT: 'PINATA_JWT' };
    for (const [suffix, key] of Object.entries(reuse)) if (!own[fields[suffix]] && env[key]) own[fields[suffix]] = env[key];
  }
  return own;
}
export function purrSolanaReadiness(env) {
  const missing = (keys, switches = []) => [...keys.filter(k => !env[`PURRLYSIUM_SOLANA_${k}`]), ...switches.filter(k => env[`PURRLYSIUM_SOLANA_${k}`] !== 'true')].map(k => `PURRLYSIUM_SOLANA_${k}`);
  return { brand: 'Hypeliysium', network: 'solana-mainnet', product: 'leveragepad',
    launch: missing(['RPC_URL', 'PINATA_JWT', 'PUBLIC_ORIGIN'], ['LAUNCH_ENABLED', 'METADATA_ENABLED']),
    trade: missing(['RPC_URL', 'JUPITER_API_KEY', 'PUBLIC_ORIGIN'], ['TRADING_ENABLED']),
    balances: missing(['RPC_URL']), platformSwapFeeBps: 0, creatorFeeRecipient: 'connected-creator' };
}
export function purrSolanaHandler({ env, service }) {
  const readiness = purrSolanaReadiness(env);
  const json = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); return true; };
  const allowed = new Set(['status', 'products', 'deployment', 'capabilities', 'scan', 'portfolio', 'wallet/history', 'pump/quotes', 'pump/build', 'metadata', 'rpc', 'swap/build']);
  return (req, res, url) => {
    const route = url.pathname.slice(SOLANA_PREFIX.length + 1);
    if (!allowed.has(route)) return json(res, 404, { error: 'Unknown Hypeliysium Solana endpoint.' });
    if (route === 'status' && req.method === 'GET') return json(res, 200, readiness);
    const missing = route === 'swap/build' ? readiness.trade : ['pump/build', 'metadata'].includes(route) ? readiness.launch : ['portfolio', 'wallet/history', 'rpc', 'scan', 'pump/quotes'].includes(route) ? readiness.balances : [];
    if (missing.length) return json(res, 503, { error: `Configure ${missing.join(', ')} for Hypeliysium Solana.`, missing });
    // Reuse the existing service dispatcher and all its validators, with only the namespaced env.
    req.url = `/api/${route}${url.search}`;
    service.server.emit('request', req, res);
    return true;
  };
}
