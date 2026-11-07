import {test} from 'node:test';import assert from 'node:assert/strict';
import {priceEvmMarkets,matchesManager} from '../discovery-runtime.mjs';
import {parseAbi,decodeFunctionData,encodeFunctionResult,keccak256,encodeAbiParameters} from '../../hoodstonk/app/node_modules/viem/_esm/index.js';
const ABI=parseAbi(['function extsload(bytes32 startSlot,uint256 nSlots) view returns (bytes32[])','function name() view returns (string)','function symbol() view returns (string)','function decimals() view returns (uint8)','function totalSupply() view returns (uint256)','function tokenURI() view returns (string)']);
const zero='0x'+'0'.repeat(40),token='0x'+'1'.repeat(40),manager='0x06c63714fbf1f5753017123e2fcfdede4540b2c4',whype='0x'+'3'.repeat(40);
const key={currency0:zero,currency1:token,fee:0,tickSpacing:60,hooks:zero};
const poolId=keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}],Object.values(key)));
const p={address:token,manager,poolId,key,block:90,transactionHash:'0x'+'4'.repeat(64)};
const word=n=>'0x'+n.toString(16).padStart(64,'0');
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
});
