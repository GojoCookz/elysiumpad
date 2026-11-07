import {parseAbi,decodeEventLog,encodeEventTopics,encodeFunctionData,decodeFunctionResult,keccak256,encodeAbiParameters} from 'viem';
import {poolMetrics,groupPools,poolIdentity} from './evm-market-math.mjs';
import {MANAGERS,matchesManager} from './evm-managers.mjs';
export {matchesManager} from './evm-managers.mjs';
const INIT=parseAbi(['event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)']);
const SWAP=parseAbi(['event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)']);
const ABI=parseAbi(['function extsload(bytes32 startSlot,uint256 nSlots) view returns (bytes32[])','function name() view returns (string)','function symbol() view returns (string)','function decimals() view returns (uint8)','function totalSupply() view returns (uint256)','function tokenURI() view returns (string)','function metadataURI() view returns (string)']);
const zero='0x0000000000000000000000000000000000000000';
const hex=n=>'0x'+n.toString(16);
const clean=s=>String(s).replace(/[\u0000-\u001f\u007f\u202a-\u202e]/g,'').slice(0,80);
export async function priceEvmMarkets({rpc,manifest,pools,previous,block,managerVerifier=matchesManager}){
 const at=hex(block),from=Math.max(0,block-50000),warnings=[];
 const supported=[];
 for(const manager of Object.keys(MANAGERS))try{if(managerVerifier(manager,await rpc('eth_getCode',[manager,at])))supported.push(manager);else warnings.push('A supported manager runtime did not match its pinned deployment.');}catch{warnings.push('A supported manager bytecode check was unavailable.');}
 if(!supported.length)throw Error('No authenticated pool managers available');
 const admitted=p=>supported.includes(p.manager.toLowerCase());
 const excludedPools=pools.filter(p=>!admitted(p)).length;
 pools=pools.filter(admitted);previous=previous.filter(p=>p.manager&&admitted(p));
 let calls=0;const read=async(to,functionName,args=[],tag=at)=>{if(++calls>440)throw Error('Read budget reached');const data=await rpc('eth_call',[{to,data:encodeFunctionData({abi:ABI,functionName,args})},tag]);return decodeFunctionResult({abi:ABI,functionName,data});};
 const [start,end]=await Promise.all([rpc('eth_getBlockByNumber',[hex(from),false]),rpc('eth_getBlockByNumber',[at,false])]);
 const window={fromBlock:from,throughBlock:block,fromTime:Number(BigInt(start.timestamp)),throughTime:Number(BigInt(end.timestamp)),complete:false};
 const activity=new Map(),seen=new Set();
 try{
  for(let n=from;n<=block;n+=10000){
   const logs=await rpc('eth_getLogs',[{address:supported,topics:encodeEventTopics({abi:SWAP,eventName:'Swap'}),fromBlock:hex(n),toBlock:hex(Math.min(block,n+9999))}]);
   for(const log of logs){if(log.removed||!supported.includes(log.address.toLowerCase()))continue;const unique=log.transactionHash+':'+log.logIndex;if(seen.has(unique))continue;seen.add(unique);
    try{const {args:a}=decodeEventLog({abi:SWAP,data:log.data,topics:log.topics});const key=poolIdentity({manager:log.address,poolId:a.id});const old=activity.get(key)||{manager:log.address,poolId:a.id,trades:0,amount0:0n,amount1:0n};old.trades++;old.amount0+=a.amount0<0n?-a.amount0:a.amount0;old.amount1+=a.amount1<0n?-a.amount1:a.amount1;activity.set(key,old);}catch{}
   }
  }
  window.complete=true;
 }catch{warnings.push('Recent swap history is incomplete; window volumes are withheld.');}
 const known=new Map(pools.map(p=>[poolIdentity(p),p]));
 // Active pools may predate the bounded Initialize window. Recover exact keys for
 // the 40 busiest missing pools, scoped to their emitting manager and pool ID.
 const missing=[...activity.values()].filter(p=>!known.has(poolIdentity(p))).sort((a,b)=>b.trades-a.trades).slice(0,40);
 const byManager=new Map();for(const p of missing)byManager.set(p.manager,[...(byManager.get(p.manager)||[]),p.poolId]);
 for(const [manager,ids]of byManager)try{
  const logs=await rpc('eth_getLogs',[{address:manager,topics:[encodeEventTopics({abi:INIT,eventName:'Initialize'})[0],ids],fromBlock:'0x0',toBlock:at}]);
  for(const log of logs){if(log.removed)continue;const {args:a}=decodeEventLog({abi:INIT,data:log.data,topics:log.topics});const native=[zero,manifest.whype.toLowerCase()];const address=native.includes(a.currency0.toLowerCase())?a.currency1:native.includes(a.currency1.toLowerCase())?a.currency0:null;if(address&&!native.includes(address.toLowerCase())){const p={address,poolId:a.id,manager:log.address,block:Number(BigInt(log.blockNumber)),transactionHash:log.transactionHash,key:{currency0:a.currency0,currency1:a.currency1,fee:a.fee,tickSpacing:a.tickSpacing,hooks:a.hooks}};known.set(poolIdentity(p),p);}}
 }catch{warnings.push('Some older active pool keys could not be recovered.');}
 const priority=p=>(activity.get(poolIdentity(p))?.trades||0);
 const ordered=[...known.values()].sort((a,b)=>priority(b)-priority(a)||b.block-a.block);
 const chosen=new Map();
 for(const p of previous.filter(p=>p.provenance?.kind==='platform')){if(p.manager&&p.key)chosen.set(poolIdentity(p),p);}
 for(const p of ordered.filter(p=>priority(p)>0).slice(0,40))if(!chosen.has(poolIdentity(p)))chosen.set(poolIdentity(p),p);
 for(const p of previous.filter(p=>p.price>0).slice(0,10)){if(p.manager&&p.key)chosen.set(poolIdentity(p),p);}
 for(const p of ordered){if(chosen.size>=60)break;if(!chosen.has(poolIdentity(p)))chosen.set(poolIdentity(p),p);}
 const tokens=new Map(),result=[],failedIdentities=new Set();let empty=0,failed=0;
 const meta=async address=>{
  const id=address.toLowerCase();if(tokens.has(id))return tokens.get(id);
  const old=previous.find(p=>p.address.toLowerCase()===id&&p.metadataVerified);
  const name=old?.name||await read(address,'name'),symbol=old?.symbol||await read(address,'symbol'),decimals=Number(await read(address,'decimals'));
  let supply=null;try{supply=(await read(address,'totalSupply')).toString();}catch{}
  const value={name:clean(name),symbol:clean(symbol).slice(0,24),decimals,totalSupply:supply,metadataVerified:true};tokens.set(id,value);return value;
 };
 for(const p of chosen.values()){
  try{
   const expected=keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}],[p.key.currency0,p.key.currency1,p.key.fee,p.key.tickSpacing,p.key.hooks]));
   if(expected.toLowerCase()!==p.poolId.toLowerCase())throw Error('Pool key mismatch');
   const slot=keccak256(encodeAbiParameters([{type:'bytes32'},{type:'uint256'}],[p.poolId,6n]));
   const words=await read(p.manager,'extsload',[slot,4n]);
   const sqrtPriceX96=BigInt(words[0])&((1n<<160n)-1n),liquidity=BigInt(words[3])&((1n<<128n)-1n);
   if(!liquidity){empty++;if(p.provenance?.kind==='platform')result.push({...p,stale:false,price:null,fdv:null,activeDepth:null,activeLiquidity:'0',observedVolume:null,volume:null,cap:null,change:null,series:[],stateBlock:block,checkedAt:new Date().toISOString()});continue;}
   const m=await meta(p.address),tokenIs0=p.address.toLowerCase()===p.key.currency0.toLowerCase(),quote=tokenIs0?p.key.currency1:p.key.currency0;
   const quoteDecimals=quote.toLowerCase()===zero?18:Number(await read(quote,'decimals'));
   const quoteSymbol=quote.toLowerCase()===zero?'HYPE':quote.toLowerCase()===manifest.whype.toLowerCase()?'WHYPE':clean(await read(quote,'symbol'));
   const metrics=poolMetrics({sqrtPriceX96,liquidity,tokenIs0,tokenDecimals:m.decimals,quoteDecimals,supply:m.totalSupply});
   if(!metrics.price)throw Error('Invalid live state');
   const a=activity.get(poolIdentity(p));const observedVolume=window.complete?Number(a?(tokenIs0?a.amount1:a.amount0):0n)/10**quoteDecimals:null;
   const old=previous.find(r=>r.address.toLowerCase()===p.address.toLowerCase());
   result.push({...p,...m,...metrics,stale:false,chain:'elysium',unit:quoteSymbol,pair:`${m.symbol} / ${quoteSymbol}`,quoteAddress:quote,quoteDecimals,cap:null,volume:null,change:null,holders:null,series:[],observedVolume,volumeWindow:window,activeLiquidity:liquidity.toString(),sqrtPriceX96:sqrtPriceX96.toString(),stateBlock:block,checkedAt:new Date().toISOString(),image:old?.image||'',imageCandidates:old?.imageCandidates||[],provenance:p.provenance?.kind==='platform'?p.provenance:{kind:'market',verified:true,source:'Pinned canonical manager runtime; pool key matched to Initialize; current extsload state at confirmed block',transactionHash:p.transactionHash,block:p.block}});
  }catch{failed++;failedIdentities.add(p.address.toLowerCase());}
  await new Promise(r=>setTimeout(r,100));
 }
 // The legacy SHA-256 coin-image store remains the authority for platform artwork.
 // A tokenURI is only consulted on-chain; artwork retrieval is handled by the
 // existing bounded, allowlisted same-origin image service.
 let metadataProbes=0;
 for(const row of result){
  const old=previous.find(r=>r.address.toLowerCase()===row.address.toLowerCase());
  if(old?.metadataCheckedAt&&Date.now()-Date.parse(old.metadataCheckedAt)<21600000){row.metadataUri=old.metadataUri;row.metadataCheckedAt=old.metadataCheckedAt;continue;}
  if(row.imageCandidates?.length||row.price==null)continue;
  if(metadataProbes>=24||calls>436)break;metadataProbes++;
  for(const getter of ['tokenURI','metadataURI'])try{const uri=await read(row.address,getter);if(/^https:\/\//.test(uri)||uri.startsWith('ipfs://')){row.metadataUri=uri;break;}}catch{}
  row.metadataCheckedAt=new Date().toISOString();
 }
 if(failed)warnings.push(`${failed} candidate pool reads failed or had unsupported state; prior priced records retained as stale.`);
 const grouped=groupPools(result);
 if(failed)for(const old of previous.filter(r=>r.price>0&&failedIdentities.has(r.address.toLowerCase())&&!grouped.some(x=>x.address.toLowerCase()===r.address.toLowerCase())))grouped.push({...old,stale:true});
 return {rows:grouped,source:{status:warnings.length?'partial-error':'partial',complete:false,count:grouped.length,priced:grouped.filter(r=>r.price>0).length,authenticatedManagers:supported.length,excludedPools,observedCandidates:known.size,examinedPools:chosen.size,liquidPools:result.filter(r=>r.price>0).length,emptyPools:empty,failedPools:failed,readCalls:calls,limit:60,checkedAt:new Date().toISOString(),history:window,warnings,coverage:'Up to 60 active/recent pools from four runtime-authenticated managers, ranked by observed trading activity; one token row with the deepest observed active pool selected. Price and FDV use confirmed pool state and token supply. Active depth is virtual quote liquidity, not TVL. Window volume is selected-pool volume only; no 24h change claimed.'}};
}
