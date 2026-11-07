import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeMarkets,platformProof,sourceFailure,rank,retainPartialRows} from '../source/discovery-core.mjs';
const row=(address,kind,verified,volume=0,chain='solana')=>({address,chain,symbol:address,volume,provenance:{kind,verified}});
test('verified platform launches precede ecosystem and high-volume wider markets',()=>{
 const rows=mergeMarkets([row('market','market',true,1e9),row('ecosystem','ecosystem',true,20),row('own','platform',true,0)]);
 assert.deepEqual(rows.map(r=>r.address),['own','ecosystem','market']);
});
test('wallet/label-only platform assertions receive no priority',()=>{
 assert.equal(rank({...row('claimed','platform',false),wallet:'known-owner'}),2);
});
test('merging preserves stronger provenance and adds observed metrics',()=>{
 const rows=mergeMarkets([row('mint','platform',true)],[{...row('mint','market',false,100),price:2}]);
 assert.equal(rows.length,1);assert.equal(rows[0].provenance.kind,'platform');assert.equal(rows[0].volume,100);
});
test('EVM identity is case insensitive, Solana identity is case sensitive, chains never merge',()=>{
 assert.equal(mergeMarkets([row('0xAB','market',false,0,'elysium'),row('0xab','market',false,0,'elysium')]).length,1);
 assert.equal(mergeMarkets([row('Ab','market',false),row('ab','market',false),row('Ab','market',false,0,'elysium')]).length,3);
});
test('platform event proof requires exact emitter topic range and transaction',()=>{
 const log={address:'0xabc',topics:['topic'],transactionHash:'0x'+'1'.repeat(64),blockNumber:'0x64'};
 assert.equal(platformProof(log,'0xABC','topic',90,110),true);
 for(const bad of [{address:'0xdef'},{topics:['wrong']},{removed:true},{blockNumber:'0x1'},{transactionHash:null}])assert.equal(platformProof({...log,...bad},'0xabc','topic',90,110),false);
});
test('source outages preserve known rows and distinguish unknown from confirmed zero',()=>{
 const known=sourceFailure({count:4,checkedAt:'2026-11-07T00:00:00Z',complete:true},'RPC limited');
 assert.equal(known.status,'stale');assert.equal(known.count,4);assert.equal(known.complete,false);
 const unknown=sourceFailure({count:null},'registry unavailable');assert.equal(unknown.status,'unavailable');assert.equal(unknown.count,null);
 const confirmed=sourceFailure({count:0,checkedAt:'2026-11-07T00:00:00Z',complete:true},'RPC limited');assert.equal(confirmed.count,0);assert.equal(confirmed.complete,false);
});
test('conflicting external pools cannot inherit verified platform routing or metrics',()=>{
 const platform={...row('0xabc','platform',true,2,'elysium'),poolId:'platform-pool',pair:'own-pair',key:{hooks:'own-hook'}};
 const external={...row('0xabc','market',true,999,'elysium'),poolId:'external-pool',pair:'other-pair',key:{hooks:'other-hook'}};
 for(const groups of [[platform,external],[external,platform]]){const result=mergeMarkets(groups)[0];assert.equal(result.poolId,'platform-pool');assert.equal(result.pair,'own-pair');assert.equal(result.key.hooks,'own-hook');assert.equal(result.volume,2);}
});
test('partial successful scans retain missing cached rows with stale labels',()=>{
 const previous=[row('a','market',false,3),row('b','market',false,2)];
 const result=retainPartialRows(previous,[row('a','market',false,4)],['A quote-asset pool source is unavailable.']);
 assert.equal(result.retained,1);assert.equal(result.rows.find(r=>r.address==='b').stale,true);assert.equal(result.sourceFailed,true);
 assert.equal(retainPartialRows(previous,[],['Some token artwork is unavailable.']).rows.length,0);
 assert.equal(retainPartialRows(previous,[],['Name search is unavailable.'],1).rows.length,1);
});
test('conflicting pool cannot supply absent routing fields to platform record',()=>{
 const platform={...row('0xabc','platform',true,2,'elysium'),poolId:'platform-pool'};
 const external={...row('0xabc','market',true,999,'elysium'),poolId:'external-pool',manager:'external',key:{hooks:'external'}};
 for(const groups of [[platform,external],[external,platform]]){const result=mergeMarkets(groups)[0];assert.equal(result.manager,undefined);assert.equal(result.key,undefined);}
});
test('identical pool keys across different managers never share price or provenance',()=>{
 const platform={...row('0xabc','platform',true,2,'elysium'),poolId:'same-key',manager:'0x111',price:1};
 const external={...row('0xabc','market',true,999,'elysium'),poolId:'same-key',manager:'0x222',price:99};
 for(const groups of [[platform,external],[external,platform]]){const r=mergeMarkets(groups)[0];assert.equal(r.price,1);assert.equal(r.manager,'0x111');}
});
