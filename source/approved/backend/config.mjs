import {PublicKey} from '@solana/web3.js';
import {PRODUCTS} from '../server/market-scanner.mjs';

export const MAINNET_GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export const MONERO_PROGRAM='3zRgReVhKv6VwUjZi45ubHQ68YtnUREWpohvKDumNWR4';
export const MONERO_TREASURY='Euo2zD9hAbKcPZPDzLkeLYpo9oWbj5A9tTxDmZS8gK17';
const ROLES=['admin','treasury','liquidity','buyback','platform'];
export function address(value,label='address'){
 if(typeof value!=='string'||!value.trim())throw Object.assign(new Error(`Set ${label} to a Solana public address.`),{status:400});
 try{return new PublicKey(value.trim()).toBase58();}catch{throw Object.assign(new Error(`${label} is not a valid Solana public address.`),{status:400});}
}
export function loadConfig(product,env={}){
 if(!Object.hasOwn(PRODUCTS,product))throw new Error('Unknown product deployment.');
 if(env.PAD_PRODUCT&&env.PAD_PRODUCT!==product)throw new Error('Environment belongs to another product.');
 const wallets={};for(const role of ROLES){const value=env[`PAD_${role.toUpperCase()}_WALLET`];wallets[role]=value?address(value,`${role} wallet`):null;if(wallets[role]===MONERO_TREASURY)throw new Error('Monerochan production treasury cannot be reused by this deployment.');}
  const programId=env.PAD_PROGRAM_ID?address(env.PAD_PROGRAM_ID,'program ID'):null;
 const revenueProgramId=env.PAD_REVENUE_PROGRAM_ID?address(env.PAD_REVENUE_PROGRAM_ID,'revenue program ID'):null;
 const launchlabPlatformId=env.PAD_LAUNCHLAB_PLATFORM_ID?address(env.PAD_LAUNCHLAB_PLATFORM_ID,'LaunchLab platform ID'):null;
 if(revenueProgramId&&(revenueProgramId===MONERO_PROGRAM||revenueProgramId===programId||Object.values(wallets).includes(revenueProgramId)))throw new Error('Revenue program must be a fresh deployment, distinct from the inherited fee program and operator wallets.');
 if(programId===MONERO_PROGRAM)throw new Error('Configure a fresh program deployment, not Monerochan production.');
 if(programId&&Object.values(wallets).includes(programId))throw new Error('Program ID cannot also be an operator wallet.');
 let rpcUrl=null;if(env.SOLANA_RPC_URL){try{const url=new URL(env.SOLANA_RPC_URL);if(url.protocol!=='https:'||url.username||url.password)throw new Error();rpcUrl=url.href;}catch{throw new Error('SOLANA_RPC_URL must be an HTTPS endpoint without embedded user credentials.');}}
 let origin=null;if(env.PUBLIC_ORIGIN){try{const url=new URL(env.PUBLIC_ORIGIN);if((url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error();origin=url.origin;}catch{throw new Error('PUBLIC_ORIGIN must be an HTTPS origin (or local development origin).');}}
 const port=Number(env.PORT||({bitcoin:5201,hyper:5202,solana:5203,leveragepad:5204}[product]));if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be 1–65535.');
 const quoteAssets=PRODUCTS[product].seeds.map(a=>({...a}));
  const name=(env.PAD_BRAND_NAME||PRODUCTS[product].name).trim();if(name.length<1||name.length>40||/[\x00-\x1f<>]/.test(name))throw new Error('PAD_BRAND_NAME must be 1–40 plain-text characters.');
   const publicBrand=env.PAD_PUBLIC_BRAND||'';if(publicBrand&&!(product==='leveragepad'&&publicBrand==='getrektd'))throw new Error('PAD_PUBLIC_BRAND only permits getrektd on the multi-asset leveragepad product.');
   const pumpCreationOnly=env.PAD_PUMP_CREATION_ENABLED==='true';if(pumpCreationOnly&&(product!=='leveragepad'||publicBrand!=='getrektd'||['PAD_TRADING_ENABLED','PAD_REVENUE_ENABLED','PAD_FEES_ENABLED'].some(key=>env[key]==='true')))throw new Error('Pump creation-only mode cannot enable swaps, custom fees or rewards.');
   return Object.freeze({product,name,publicBrand,pumpCreationOnly,port,host:env.HOST||'127.0.0.1',origin,rpcUrl,jupiterKey:env.JUPITER_API_KEY||'',programId,revenueProgramId,launchlabPlatformId,revenueEnabled:env.PAD_REVENUE_ENABLED==='true',wallets:Object.freeze(wallets),quoteAssets:Object.freeze(quoteAssets),preferredQuote:PRODUCTS[product].preferredQuote,tradingEnabled:env.PAD_TRADING_ENABLED==='true',launchEnabled:env.PAD_LAUNCH_ENABLED==='true',feesEnabled:env.PAD_FEES_ENABLED==='true',metadataEnabled:env.PAD_METADATA_ENABLED==='true',pinataJwt:env.PINATA_JWT||'',storageDirectory:env.PAD_DATA_DIR||`./data/${product}`});
}
export function publicConfig(config){
 return {product:config.product,name:config.name,execution:'monerochan-direct',network:'solana-mainnet',programId:config.programId,wallets:config.wallets,quoteAssets:config.quoteAssets,preferredQuote:config.preferredQuote,tradingConfigured:Boolean(config.tradingEnabled&&config.rpcUrl&&config.jupiterKey),pumpCreationConfigured:Boolean(config.pumpCreationOnly&&config.launchEnabled&&config.metadataEnabled&&config.rpcUrl&&config.pinataJwt),missing:[...(!config.rpcUrl?['SOLANA_RPC_URL']:[]),...(!config.jupiterKey?['JUPITER_API_KEY']:[]),...(!config.programId?['PAD_PROGRAM_ID']:[]),...ROLES.filter(role=>!config.wallets[role]).map(role=>`PAD_${role.toUpperCase()}_WALLET`)],contractVerified:false,launchEnabled:false,platformSwapFeeBps:0};
}
