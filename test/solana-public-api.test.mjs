import{test}from'node:test';import assert from'node:assert/strict';
import{publicSolanaResponse}from'../source/solana-public-api.mjs';
const readiness={launch:[],trade:['PURRLYSIUM_SOLANA_JUPITER_API_KEY']};
test('mounted Pump capabilities never advertise unmounted LaunchLab or fee builders',()=>{
 const v=publicSolanaResponse('capabilities',{pumpCreationConfigured:true,pump:{creatorFeeBps:300,holderRewardsImplemented:false},routes:{'GET /api/launchlab/status':[]}},readiness);
 assert.equal(v.launchReadinessEndpoint,'/api/purrlysium/solana/pump/quotes');assert.equal(v.launchEnabled,true);
 assert.ok(Object.keys(v.routes).every(k=>!k.includes('launchlab')&&!k.includes('/fees/')));assert.equal(v.pump.creatorFeeBps,300);assert.equal(v.pump.holderRewardsImplemented,false);
});
test('legacy vault absence does not contradict direct Pump readiness or enable swaps',()=>{
 const v=publicSolanaResponse('deployment',{pumpCreationConfigured:true,tradingConfigured:false,rpcVerified:true,launchEnabled:false,vault:{ok:false},programId:null,contractVerified:false},readiness);
 assert.equal(v.launchEnabled,true);assert.equal(v.tradingConfigured,false);assert.equal(v.vault.required,false);assert.deepEqual(v.launchMissing,[]);assert.deepEqual(v.missing,readiness.trade);
});
