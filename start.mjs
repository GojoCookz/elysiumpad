import {pathToFileURL} from 'node:url';

const root = process.cwd();
const host = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_HOST || 'localhost';
const originHost = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).host : host;

Object.assign(process.env, {
  HOST: process.env.HOST || '0.0.0.0',
  PORT: process.env.PORT || '3000',
  PAD_PRODUCT: 'leveragepad',
  PAD_BRAND_NAME: 'Hypeliysium',
  PAD_DATA_DIR: process.env.PAD_DATA_DIR || '/app/data/hypeliysium',
  PAD_ELYSIUM_ENABLED: 'true',
  ELYSIUM_CHAIN_ID: '99901',
  ELYSIUM_RPC_URL: process.env.ELYSIUM_RPC_URL || 'https://rpc-live.elysp.com',
  ELYSIUM_MANIFEST: pathToFileURL(`${root}/elysium/manifest-99901.json`).href,
  PURRLYSIUM_MANIFEST: pathToFileURL(`${root}/elysium/manifest-purrlysium-99901.json`).href,
  PURRLYSIUM_HOSTS: process.env.PURRLYSIUM_HOSTS || `${host},${originHost},localhost,127.0.0.1`,
  PURRLYSIUM_REUSE_AUTHORIZED: 'true',
  PURRLYSIUM_SOLANA_RPC_URL: process.env.PURRLYSIUM_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  PURRLYSIUM_SOLANA_LAUNCH_ENABLED: process.env.PURRLYSIUM_SOLANA_LAUNCH_ENABLED || 'false',
  PURRLYSIUM_SOLANA_METADATA_ENABLED: process.env.PURRLYSIUM_SOLANA_METADATA_ENABLED || 'false',
  PURRLYSIUM_SOLANA_TRADING_ENABLED: process.env.PURRLYSIUM_SOLANA_TRADING_ENABLED || 'false'
});

await import('./runtime.mjs');
