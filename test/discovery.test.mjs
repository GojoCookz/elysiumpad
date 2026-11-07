import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeMarkets,platformProof,sourceFailure,rank} from '../source/discovery-core.mjs';
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
