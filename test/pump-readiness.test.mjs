import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../runtime.mjs',import.meta.url),'utf8');
const code=source.match(/function publicConfig\(config\) \{[\s\S]*?\n\}/)[0];
const publicConfig=runInNewContext(code+';publicConfig',{ROLES:[]});
test('direct Pump readiness does not require Jupiter or the legacy fee vault',()=>{
 const config={wallets:{},pumpCreationOnly:false,launchEnabled:true,metadataEnabled:true,rpcUrl:'https://rpc.invalid',pinataJwt:'configured',jupiterKey:'',tradingEnabled:false};
 assert.equal(publicConfig(config).pumpCreationConfigured,true);
 assert.equal(publicConfig(config).tradingConfigured,false);
 for(const key of ['launchEnabled','metadataEnabled','rpcUrl','pinataJwt'])assert.equal(publicConfig({...config,[key]:false}).pumpCreationConfigured,false);
});
