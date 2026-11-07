// Read-only deployed-contract probe. No wallet client, signer or transaction broadcast.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createPublicClient,http,fallback,parseAbi,encodeFunctionData,keccak256,encodeAbiParameters,zeroAddress} from 'viem';
import {ABI} from '../source/approved/elysium/abi.mjs';
import {matchesManager} from '../source/evm-managers.mjs';

const KNTQ='0xe45a355d9e9cAd2aD85F2d03E3eE3102A036acF0';
const PARENT='0x000000000000780555bD0BCA3791f89f9542c2d6';
const manifest=await (await fetch('https://hypeliysium.fun/elysium/manifest.json')).json();
assert.equal(manifest.chainId,99901);
const client=createPublicClient({transport:fallback(manifest.rpcFailover.map(url=>http(url,{timeout:20000,retryCount:1})),{retryCount:1})});
assert.equal(await client.getChainId(),99901);
const blockNumber=await client.getBlockNumber();
const abi=parseAbi([
 'function l1Address() view returns(address)',
 'function calculateL2TokenAddress(address) view returns(address)',
 'function getGateway(address) view returns(address)',
 'function isApproved(address) view returns(bool)',
 'function pairConfig(address) view returns(bool approved,address feed,uint32 maxStaleness,uint8 feedDecimals,uint8 tokenDecimals)',
 'function owner() view returns(address)',
 'function pairRegistry() view returns(address)',
 'function poolManager() view returns(address)',
 'function swap((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),bool,uint256,uint256,address) returns(uint256)',
 'function approvePairWithoutOracle(address,uint8)',
 'function extsload(bytes32,uint256) view returns(bytes32[])'
]);
const read=(address,functionName,args=[],contractAbi=abi)=>client.readContract({address,abi:contractAbi,functionName,args,blockNumber});
const optional=async fn=>{try{return {ok:true,value:await fn()};}catch(e){return {ok:false,error:e.shortMessage||e.message};}};
const metaResponse=await fetch('https://api.hyperliquid.xyz/info',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'spotMeta'})});
assert.ok(metaResponse.ok);
const meta=await metaResponse.json();
const parentIdentity=meta.tokens.find(t=>t.tokenId==='0xbd31bd605c0a1b82c72aae3587f9061f');
assert.equal(parentIdentity?.evmContract?.address.toLowerCase(),PARENT.toLowerCase());
const [decimals,l1Address,registry,approved,config,owner,whypeApproved,gateway,mappedToken,routerManager]=await Promise.all([
 read(KNTQ,'decimals',[],ABI.erc20),read(KNTQ,'l1Address'),read(manifest.carbon.launcher,'pairRegistry'),
 read(manifest.carbon.pairRegistry,'isApproved',[KNTQ]),read(manifest.carbon.pairRegistry,'pairConfig',[KNTQ]),
 read(manifest.carbon.pairRegistry,'owner'),read(manifest.carbon.pairRegistry,'isApproved',[manifest.whype]),
 optional(()=>read(manifest.bridge.l2GatewayRouter,'getGateway',[PARENT])),
 optional(()=>read(manifest.bridge.l2StandardGateway,'calculateL2TokenAddress',[PARENT])),
 optional(()=>read(manifest.carbon.tradeRouter,'poolManager'))
]);
assert.equal(decimals,18);assert.equal(l1Address.toLowerCase(),PARENT.toLowerCase());
assert.equal(registry.toLowerCase(),manifest.carbon.pairRegistry.toLowerCase());
if(mappedToken.ok)assert.equal(mappedToken.value.toLowerCase(),KNTQ.toLowerCase());
assert.ok(gateway.ok&&mappedToken.ok,'Bridge identity could not be fully verified');
assert.equal(gateway.value.toLowerCase(),manifest.bridge.l2StandardGateway.toLowerCase());
const z32='0x'+'0'.repeat(64);
// Hypothetical parameters test admission only. These are not an approved opening-price policy.
const params={name:'KNTQ read-only readiness probe',symbol:'PROBE',supply:10n**27n,pair:KNTQ,
 openingMarketCap:5000n*10n**18n,graduationThreshold:500000n*10n**18n,feeBps:300,sellFeeBps:300,
 burnBps:0,vestDuration:0n,vestCliff:0n,creatorBps:10000,maxWalletBps:0,tickSpacing:60,
 devBuyPairAmount:10n**18n,salt:keccak256(new TextEncoder().encode('kntq-readiness-'+blockNumber)),
 minPushPayout:10n**9n,minShareForQueue:5n*10n**24n,rewardCurrency:zeroAddress,feeRecipient:zeroAddress,
 referrer:zeroAddress,openingWindow:120,openingFeeBps:5000,metadata:{imageCid:'0x'+'1'.repeat(64),bannerCid:z32,infoCid:z32}};
let creation;
try {await client.simulateContract({address:manifest.carbon.launcher,abi:ABI.launcher,functionName:'launch',args:[params],account:manifest.deployer,blockNumber});creation={ok:true};}
catch(e){const decoded=e.walk?.(cause=>cause.data?.errorName)?.data;const causes=[];for(let cause=e;cause;cause=cause.cause)causes.push({name:cause.name,data:cause.data,details:cause.details});creation={ok:false,error:decoded?.errorName||e.shortMessage,args:decoded?.args,causes};}
if(!approved&&creation.error==='PairNotApproved')assert.equal(creation.args?.[0].toLowerCase(),KNTQ.toLowerCase());
const v3Pools=await Promise.all(manifest.swap.feeTiers.map(async fee=>({fee,pool:await read(manifest.swap.factory,'getPool',[KNTQ,manifest.whype,fee],ABI.v3Factory)})));
const discovery=await(await fetch('https://hypeliysium.fun/api/discovery')).json();
const observed=discovery.rows.find(r=>r.chain==='elysium'&&r.address?.toLowerCase()===KNTQ.toLowerCase()&&r.quoteAddress===zeroAddress);
let nativePool=null,tradingSimulation=null;
if(observed){
 const k=observed.key;
 const id=keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}],[k.currency0,k.currency1,k.fee,k.tickSpacing,k.hooks]));
 assert.equal(id,observed.poolId);
 const slot=keccak256(encodeAbiParameters([{type:'bytes32'},{type:'uint256'}],[id,6n]));
 const words=await read(observed.manager,'extsload',[slot,4n]);
 const managerRuntimeVerified=matchesManager(observed.manager,await client.getCode({address:observed.manager,blockNumber}));
 assert.ok(managerRuntimeVerified);
 const padWords=await read(manifest.carbon.poolManager,'extsload',[slot,4n]);
 nativePool={manager:observed.manager,poolId:id,key:k,managerRuntimeVerified,sqrtPriceX96:BigInt(words[0])&((1n<<160n)-1n),liquidity:BigInt(words[3])&((1n<<128n)-1n),sameAsPadManager:observed.manager.toLowerCase()===manifest.carbon.poolManager.toLowerCase(),padManagerSqrtPriceX96:BigInt(padWords[0])&((1n<<160n)-1n)};
 tradingSimulation=await optional(()=>client.simulateContract({address:manifest.carbon.tradeRouter,abi,functionName:'swap',args:[k,false,10n**18n,1n,manifest.deployer],account:manifest.deployer,blockNumber}).then(r=>r.result));
}
const code=await Promise.all(['launcher','pairRegistry','tradeRouter'].map(async name=>({name,address:manifest.carbon[name],runtimeHash:keccak256(await client.getCode({address:manifest.carbon[name],blockNumber}))})));
const result={observedAt:new Date().toISOString(),chainId:99901,blockNumber,identity:{address:KNTQ,decimals,parentChainId:999,parent:PARENT,parentIdentity,gateway,mappedToken},
 launcher:manifest.carbon.launcher,registry,owner,manifestOwner:manifest.owner,approved,config,whypeApproved,creation,routerManager,v3Pools,nativePool,tradingSimulation,code,
 proposedAdminAction:{broadcast:false,requiresExplicitAuthorization:true,chainId:99901,from:owner,to:registry,value:'0',function:'approvePairWithoutOracle(address,uint8)',args:[KNTQ,decimals],data:encodeFunctionData({abi,functionName:'approvePairWithoutOracle',args:[KNTQ,decimals]}),note:'Approval without an oracle requires a separately agreed KNTQ-denominated opening policy. This payload alone does not enable the app or prove trading readiness.'}};
const json=JSON.stringify(result,(_,v)=>typeof v==='bigint'?v.toString():v,2);
if(process.argv[2])await writeFile(process.argv[2],json+'\n');
console.log(json);
