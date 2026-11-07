import {test} from 'node:test';import assert from 'node:assert/strict';
import {priceEvmMarkets,matchesManager} from '../discovery-runtime.mjs';
import {mergeMarkets} from '../source/discovery-core.mjs';
import {parseAbi,decodeFunctionData,encodeFunctionResult,keccak256,encodeAbiParameters,encodeEventTopics} from 'viem';
const ABI=parseAbi(['function extsload(bytes32 startSlot,uint256 nSlots) view returns (bytes32[])','function name() view returns (string)','function symbol() view returns (string)','function decimals() view returns (uint8)','function totalSupply() view returns (uint256)','function tokenURI() view returns (string)']);
const zero='0x'+'0'.repeat(40),token='0x'+'1'.repeat(40),manager='0x06c63714fbf1f5753017123e2fcfdede4540b2c4',whype='0x'+'3'.repeat(40);
const key={currency0:zero,currency1:token,fee:0,tickSpacing:60,hooks:zero};
const poolId=keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}],Object.values(key)));
const p={address:token,manager,poolId,key,block:90,transactionHash:'0x'+'4'.repeat(64)};
const word=n=>'0x'+n.toString(16).padStart(64,'0');
test('a temporary manager-code outage retains pool keys without admitting its price',async()=>{
 const rpc=async(method,params)=>{if(method==='eth_getCode'){if(params[0]===manager)throw Error('Temporary outage');return '0x1234';}if(method==='eth_getLogs')return [];if(method==='eth_getBlockByNumber')return {timestamp:'0xc8'};throw Error('Unauthenticated pool must not be read');};
 const result=await priceEvmMarkets({rpc,manifest:{whype},pools:[p],previous:[],block:100,managerVerifier:()=>true});
 assert.equal(result.rows.length,0);assert.equal(result.poolKeys.length,1);assert.equal(result.poolKeys[0].poolId,poolId);assert.equal(result.source.excludedPools,1);
});
test('recovered historical pool keys survive failed pricing independently of displayed rows',async()=>{
 const events=parseAbi(['event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)','event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)']);
 const swapTopic=encodeEventTopics({abi:events,eventName:'Swap'})[0];
 const log=(eventName,args,types,values)=>({address:manager,transactionHash:'0x'+'a'.repeat(64),logIndex:'0x0',blockNumber:'0x50',topics:encodeEventTopics({abi:events,eventName,args}),data:encodeAbiParameters(types.map(type=>({type})),values)});
 const rpc=async(method,params)=>{
  if(method==='eth_getCode')return '0x1234';if(method==='eth_getBlockByNumber')return {timestamp:'0xc8'};
  if(method==='eth_getLogs')return params[0].topics[0]===swapTopic
   ?[log('Swap',{id:poolId,sender:zero},['int128','int128','uint160','uint128','int24','uint24'],[1n,-1n,2n**96n,100n,0,0])]
   :[log('Initialize',{id:poolId,currency0:zero,currency1:token},['uint24','int24','address','uint160','int24'],[0,60,zero,2n**96n,0])];
  throw Error('State provider unavailable');
 };
 const result=await priceEvmMarkets({rpc,manifest:{whype},pools:[],previous:[],block:100,managerVerifier:address=>address===manager});
 assert.equal(result.rows.length,0);assert.equal(result.poolKeys.length,1);assert.equal(result.poolKeys[0].poolId,poolId);assert.deepEqual(result.poolKeys[0].key,key);
});
test('WHYPE conversion reads the exact Elysium native pair instead of assuming parity',async()=>{
 const conversionKey={currency0:zero,currency1:whype,fee:3000,tickSpacing:60,hooks:zero};
 const id=keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}],Object.values(conversionKey)));
 const slot=keccak256(encodeAbiParameters([{type:'bytes32'},{type:'uint256'}],[id,6n]));
 const rpc=async(method,params)=>{
  if(method==='eth_getCode')return '0x1234';if(method==='eth_getLogs')return [];if(method==='eth_getBlockByNumber')return {timestamp:'0xc8'};
  const {functionName,args}=decodeFunctionData({abi:ABI,data:params[0].data});
  assert.equal(params[1],'0x64');assert.equal(params[0].to.toLowerCase(),functionName==='extsload'?manager:whype);
  if(functionName==='extsload'){assert.equal(args[0],slot);return encodeFunctionResult({abi:ABI,functionName,result:[word(2n*2n**96n),word(0n),word(0n),word(10n**20n)]});}
  return encodeFunctionResult({abi:ABI,functionName,result:functionName==='decimals'?18:'WHYPE'});
 };
 const result=await priceEvmMarkets({rpc,manifest:{chainId:99901,bridge:{parentChainId:999},whype},pools:[],previous:[],block:100,managerVerifier:address=>address===manager});
 const rate=result.nativeQuotes.find(r=>r.address===whype);assert.equal(rate.nativePerQuote,0.25);assert.equal(rate.poolId,id);assert.equal(rate.chainId,99901);assert.equal(rate.stateTime,200000);assert.equal(rate.verified,true);
});
test('confirmed pool pricing uses pinned state, correct quote, FDV and incomplete-history null',async()=>{
 const tags=[];
 const rpc=async(method,params)=>{
  if(method==='eth_getCode')return '0x1234';
  if(method==='eth_getBlockByNumber')return {timestamp:params[0]==='0x0'?'0x64':'0xc8'};
  if(method==='eth_getLogs')throw Error('429 history unavailable');
  assert.equal(method,'eth_call');tags.push(params[1]);const d=decodeFunctionData({abi:ABI,data:params[0].data});
  if(d.functionName==='tokenURI')throw Error('no URI');
  const result={extsload:[word(2n**96n),word(0n),word(0n),word(10n**18n)],name:'Verified token',symbol:'REAL',decimals:6,totalSupply:10n**12n}[d.functionName];
  return encodeFunctionResult({abi:ABI,functionName:d.functionName,result});
 };
 const result=await priceEvmMarkets({rpc,manifest:{whype},pools:[p],previous:[],block:100,managerVerifier:()=>true});
 assert.equal(result.rows.length,1);const r=result.rows[0];assert.equal(r.price,1e-12);assert.equal(r.fdv,0.000001);assert.equal(r.cap,null);assert.equal(r.pair,'REAL / HYPE');assert.equal(r.observedVolume,null);assert.equal(r.volume,null);assert.equal(r.change,null);assert.equal(r.stateBlock,100);assert.ok(tags.every(t=>t==='0x64'));assert.equal(result.source.history.complete,false);assert.equal(result.source.status,'partial-error');
});
test('unrecognized or modified manager runtimes cannot authenticate',()=>{
 assert.equal(matchesManager(manager,'0x1234'),false);assert.equal(matchesManager(token,'0x1234'),false);assert.equal(matchesManager(manager,'0x'),false);
});
test('successful platform refresh clears stale; zero liquidity clears prior valuation',async()=>{
 let liquidity=10n**18n;
 const old={...p,chain:'elysium',name:'Real',symbol:'REAL',decimals:18,metadataVerified:true,stale:true,price:99,fdv:999,activeDepth:99,provenance:{kind:'platform',verified:true}};
 const rpc=async(method,params)=>{
  if(method==='eth_getCode')return '0x1234';if(method==='eth_getLogs')return [];if(method==='eth_getBlockByNumber')return {timestamp:'0x64'};
  const {functionName}=decodeFunctionData({abi:ABI,data:params[0].data});if(functionName==='tokenURI')throw Error('none');
  const result={extsload:[word(2n**96n),word(0n),word(0n),word(liquidity)],decimals:18,totalSupply:10n**24n}[functionName];return encodeFunctionResult({abi:ABI,functionName,result});
 };
 const run=()=>priceEvmMarkets({rpc,manifest:{whype},pools:[p],previous:[old],block:100,managerVerifier:()=>true});
 const fresh=(await run()).rows[0];assert.equal(fresh.stale,false);assert.equal(fresh.price,1);assert.equal(fresh.provenance.kind,'platform');
 liquidity=0n;const inactive=(await run()).rows[0];assert.equal(inactive.price,null);assert.equal(inactive.fdv,null);assert.equal(inactive.activeDepth,null);assert.equal(inactive.stale,false);assert.equal(inactive.provenance.kind,'platform');
 const rejected=await priceEvmMarkets({rpc,manifest:{whype},pools:[p],previous:[old],block:100,managerVerifier:a=>a!==manager});
 const merged=mergeMarkets([old],rejected.rows)[0];assert.equal(merged.price,null);assert.equal(merged.fdv,null);assert.equal(merged.stale,true);
});
test('expired verified artwork URI survives failed refresh outside previous ten pools',async()=>{
 const previous=Array.from({length:11},(_,i)=>{const address='0x'+(i+1).toString(16).padStart(40,'0'),k={...key,currency1:address};return {...p,address,key:k,poolId:keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}],Object.values(k))),price:1,name:'Known',symbol:'K',metadataVerified:true,metadataUri:'ipfs://existing-verified-uri',metadataCheckedAt:new Date(Date.now()-7*3600000).toISOString()};});
 const rpc=async(method,params)=>{
  if(method==='eth_getCode')return '0x1234';if(method==='eth_getLogs')return [];if(method==='eth_getBlockByNumber')return {timestamp:'0x64'};
  const {functionName}=decodeFunctionData({abi:ABI,data:params[0].data});if(functionName==='tokenURI')throw Error('temporary outage');
  const result={extsload:[word(2n**96n),word(0n),word(0n),word(10n**18n)],decimals:18,totalSupply:10n**24n}[functionName];return encodeFunctionResult({abi:ABI,functionName,result});
 };
 const result=await priceEvmMarkets({rpc,manifest:{whype},pools:previous.map(({address,key,poolId,manager,block})=>({address,key,poolId,manager,block})),previous,block:100,managerVerifier:()=>true});
 assert.equal(result.rows.length,11);assert.ok(result.rows.every(r=>r.metadataUri==='ipfs://existing-verified-uri'));
});
