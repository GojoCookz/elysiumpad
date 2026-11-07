import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMarketDiscovery} from '../discovery-runtime.mjs';
test('provider outage retains verified records across restart and reports stale instead of zero',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pad-discovery-'));
 const manifest={chainId:99901,carbon:{launcher:'0x'+'1'.repeat(40),deployBlock:100},rpcFailover:['https://rpc.invalid'],whype:'0x'+'2'.repeat(40)};
 const seed=path.join(dir,'seed.json');
 const existing={chain:'elysium',address:'0x'+'3'.repeat(40),symbol:'KNOWN',provenance:{kind:'platform',verified:true,transactionHash:'0x'+'4'.repeat(64)}};
 await writeFile(seed,JSON.stringify({version:1,chainId:99901,launcher:manifest.carbon.launcher,cursor:200,launches:[{token:existing.address}],rows:[existing],sources:{platformEvm:{status:'complete',complete:true,count:1,checkedAt:new Date().toISOString()}}}));
 const fetcher=async(url,options)=>new Response(JSON.stringify(url==='https://rpc.invalid'?{jsonrpc:'2.0',result:'0x1'}:{error:'provider unavailable'}),{status:200});
 try{
  const app=await createMarketDiscovery({manifest,seedPath:seed,env:{PAD_DATA_DIR:dir},fetcher,autoStart:false});
  await app.refresh();
  assert.equal(app.snapshot().rows[0].symbol,'KNOWN');
  assert.equal(app.snapshot().sources.platformEvm.status,'stale');
  assert.equal(app.snapshot().sources.platformEvm.complete,false);
  const restarted=await createMarketDiscovery({manifest,seedPath:path.join(dir,'absent'),env:{PAD_DATA_DIR:dir},fetcher,autoStart:false});
  assert.equal(restarted.snapshot().rows[0].address,existing.address);
  assert.equal(restarted.snapshot().sources.platformEvm.count,1);
  assert.equal(restarted.snapshot().sources.platformSolana.count,null);
 }finally{await rm(dir,{recursive:true,force:true});}
});
