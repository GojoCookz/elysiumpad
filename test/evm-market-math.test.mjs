import {test} from 'node:test';import assert from 'node:assert/strict';
import {poolMetrics,groupPools} from '../source/evm-market-math.mjs';
const Q=2n**96n;
test('price orientation and unequal decimals use quote per whole token',()=>{
 const a=poolMetrics({sqrtPriceX96:2n*Q,liquidity:10n**18n,tokenIs0:true,tokenDecimals:6,quoteDecimals:18,supply:10n**12n});
 assert.equal(a.price,4e-12);assert.equal(a.fdv,0.000004);assert.equal(a.activeDepth,2);
 const b=poolMetrics({sqrtPriceX96:Q/2n,liquidity:10n**18n,tokenIs0:false,tokenDecimals:6,quoteDecimals:18,supply:10n**12n});
 assert.equal(b.price,a.price);assert.equal(b.fdv,a.fdv);assert.equal(b.activeDepth,a.activeDepth);
});
test('empty pools, invalid decimals and missing supply never fabricate price or cap',()=>{
 assert.deepEqual(poolMetrics({sqrtPriceX96:Q,liquidity:0n,tokenIs0:true,tokenDecimals:18,quoteDecimals:18,supply:10n**18n}),{price:null,fdv:null,activeDepth:null});
 assert.throws(()=>poolMetrics({sqrtPriceX96:Q,liquidity:1n,tokenIs0:true,quoteDecimals:18}),/decimals/);
 const m=poolMetrics({sqrtPriceX96:Q,liquidity:1n,tokenIs0:true,tokenDecimals:18,quoteDecimals:18});assert.equal(m.price,1);assert.equal(m.fdv,null);assert.equal(m.cap,undefined);
});
test('pool grouping keys manager plus pool and token address, not shared symbol',()=>{
 const p={address:'0xAA',symbol:'SAME',manager:'0x11',poolId:'0x01',price:2,activeDepth:1,observedVolume:3};
 const rows=groupPools([p,p,{...p,manager:'0x22',price:4,activeDepth:10,observedVolume:7},{...p,address:'0xBB',poolId:'0x02'}]);
 assert.equal(rows.length,2);const a=rows.find(r=>r.address==='0xAA');assert.equal(a.poolCount,2);assert.equal(a.manager,'0x22');assert.equal(a.price,4);assert.equal(a.observedVolume,7);
});
