import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchHypeUsd,quoteUsdRates,convertEvmRow,NATIVE} from '../source/evm-usd.mjs';
import {mapPoolReads} from '../source/evm-markets.mjs';
import {groupPools} from '../source/evm-market-math.mjs';
const now=1794063600000,other='0x'+'b'.repeat(40);
const anchor={usd:77.78,observedAt:now-60000,source:'CoinGecko hyperliquid / USD',sourceUrl:'https://api.coingecko.com/'};
const native={chainId:99901,address:NATIVE,nativePerQuote:1,verified:true};
const cross={chainId:99901,address:other,nativePerQuote:0.75,verified:true,stateTime:now-30000,manager:'0x'+'c'.repeat(40),poolId:'0x'+'d'.repeat(64)};
const row={chain:'elysium',quoteAddress:NATIVE,price:0.006251454,fdv:10242.20868,observedVolume:422.997,activeDepth:2919.69,volumeWindow:{complete:true},stateTime:now-60000,unit:'HYPE'};
test('native USD arithmetic preserves native values and never calls virtual depth TVL',()=>{
 const value=convertEvmRow(row,quoteUsdRates(anchor,[native],now),now);
 assert.equal(value.usd.price,row.price*77.78);assert.equal(value.usd.fdv,row.fdv*77.78);assert.equal(value.usd.volume,row.observedVolume*77.78);assert.equal(value.price,row.price);assert.equal(value.unit,'HYPE');assert.equal(value.usd.activeDepth,row.activeDepth*77.78);assert.equal(value.usd.liquidity,null);assert.equal(value.usd.status,'fresh');
});
test('pool selection compares measured common-currency depth rather than raw quote numbers',()=>{
 const base={address:'0x'+'a'.repeat(40),manager:'0x'+'c'.repeat(40),price:1};
 const pools=[{...base,poolId:'0x'+'1'.repeat(64),quoteAddress:NATIVE,activeDepth:100},{...base,poolId:'0x'+'2'.repeat(64),quoteAddress:other,activeDepth:200}];
 assert.equal(groupPools(pools,[native,{...cross,nativePerQuote:0.25}])[0].quoteAddress,NATIVE);
 assert.equal(groupPools(pools,[native,{...cross,nativePerQuote:2}])[0].quoteAddress,other);
});
test('a distinct quote uses its own measured cross-rate and exact chain/address identity',()=>{
 const rates=quoteUsdRates(anchor,[native,cross],now);
 const value=convertEvmRow({...row,quoteAddress:other,unit:'WHYPE',price:2,liquidityQuote:100},rates,now);
 assert.equal(value.usd.price,2*0.75*77.78);assert.equal(value.usd.liquidity,100*0.75*77.78);
 assert.equal(convertEvmRow({...row,quoteAddress:'0x5555555555555555555555555555555555555555',unit:'WHYPE'},rates,now).usd.price,null);
 assert.equal(convertEvmRow({...row,chain:'hyperevm'},rates,now).usd.price,null);
 assert.equal(convertEvmRow({...row,quoteAddress:other},rates.map(r=>({...r,chainId:999})),now).usd.price,null);
});
test('stale source and pool data stay visibly stale; expired or missing rates cannot produce dollars',()=>{
 assert.equal(convertEvmRow(row,[],now).usd.status,'unavailable');
 assert.equal(convertEvmRow({...row,quoteAddress:other},quoteUsdRates(anchor,[{...cross,stateTime:now-360000}],now),now).usd.status,'stale');
 assert.equal(convertEvmRow(row,quoteUsdRates({...anchor,observedAt:NaN},[native],now),now).usd.status,'unavailable');
 assert.equal(convertEvmRow(row,quoteUsdRates({...anchor,observedAt:now-600000},[native],now),now).usd.status,'stale');
 assert.equal(convertEvmRow({...row,stale:true},quoteUsdRates(anchor,[native],now),now).usd.status,'stale');
 assert.equal(convertEvmRow({...row,stateTime:now-700000},quoteUsdRates(anchor,[native],now),now).usd.status,'stale');
 assert.equal(convertEvmRow(row,quoteUsdRates({...anchor,observedAt:now-3600001},[native],now),now).usd.price,null);
 assert.equal(convertEvmRow({...row,quoteAddress:other},quoteUsdRates(anchor,[{...cross,stateTime:now-3600001}],now),now).usd.price,null);
 assert.equal(convertEvmRow({...row,volumeWindow:{complete:false}},quoteUsdRates(anchor,[native],now),now).usd.volume,null);
});
test('USD feed validates real provider identity/value/timestamp and preserves failure age',async()=>{
 const valid=await fetchHypeUsd({now,fetcher:async()=>({ok:true,json:async()=>({hyperliquid:{usd:77.78,last_updated_at:(now-60000)/1000}})})});
 assert.equal(valid.usd,77.78);assert.equal(valid.observedAt,now-60000);
 for(const payload of [{hyperliquid:{usd:-1,last_updated_at:now/1000}},{HYPE:{usd:50,last_updated_at:now/1000}},{hyperliquid:{usd:50}},{hyperliquid:{usd:50,last_updated_at:(now+120000)/1000}}]){
  const failed=await fetchHypeUsd({now,previous:valid,fetcher:async()=>({ok:true,json:async()=>payload})});assert.equal(failed.observedAt,valid.observedAt);assert.ok(failed.error);assert.equal(quoteUsdRates(failed,[native],now)[0].stale,true);
 }
});
test('RPC pool reads are concurrent but bounded and retain result order',async()=>{
 let active=0,peak=0;const values=await mapPoolReads([0,1,2,3,4,5,6,7],async value=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,10));active--;return value*2;});
 assert.equal(peak,4);assert.equal(active,0);assert.deepEqual(values,[0,2,4,6,8,10,12,14]);
});
