import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import * as web3 from '@solana/web3.js';
import {TOKEN_PROGRAM_ID,TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import {PUMP_SDK,PUMP_PROGRAM_ID,GLOBAL_PDA,OnlinePumpSdk,bondingCurvePda} from '@pump-fun/pump-sdk';
import {guardTransaction,simulate} from '../source/approved/backend/framework/server/api-v1/guard.mjs';
import {PUMP_CREATOR_FEE_BPS,pumpCreatorFeeSupport,pumpSimulatedSolCost} from '../source/approved/backend/pump-policy.mjs';
import {validatePumpEnvelope,verifyPumpSimulation} from '../source/approved/backend/pump-creator.mjs';
import {creatorWalletAddress,resolveCreatorWallet} from '../source/approved/backend/creator-wallet.mjs';
import {recordPumpBuild,matchesPumpReceipt} from '../source/pump-provenance.mjs';

// Execute the exact maintained production builder with synthetic RPC responses.
// No wallet signing, network RPC, funded simulation, or broadcast occurs here.
const runtime=await readFile(new URL('../runtime.mjs',import.meta.url),'utf8');
const start=runtime.indexOf('  async function buildDirect(value) {');
assert.ok(start>0);
const end=runtime.indexOf('\n  return { admission, quoteStatus, directQuoteStatus',start);
assert.ok(end>start);
const body=runtime.slice(start,end);
const wallet=web3.Keypair.generate().publicKey.toBase58(),mint=web3.Keypair.generate().publicKey.toBase58(),payee=web3.Keypair.generate().publicKey.toBase58();
const quoteMint='98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g';
const request={wallet,mint,payee,quoteMint,name:'Wallet fixture',symbol:'TEST',uri:'https://ipfs.io/ipfs/'+'a'.repeat(46)};
function curveData(creator,fee=300){
  const data=Buffer.alloc(125);Buffer.from([23,183,248,55,96,216,172,96]).copy(data);
  new web3.PublicKey(creator).toBuffer().copy(data,49);new web3.PublicKey(quoteMint).toBuffer().copy(data,83);data.writeBigUInt64LE(BigInt(fee),115);return data;
}
function fixture({creator=payee,fee=300,enabled=true}={}){
  let simulations=0,reads=0;
  const rpc={getAccountInfo:async()=>{reads++;return null;},getLatestBlockhash:async()=>({blockhash:web3.Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100}),getMultipleAccountsInfo:async()=>[{lamports:1000000000},null,null],simulateTransaction:async()=>{simulations++;return {value:{err:null,unitsConsumed:120000,accounts:[{lamports:999000000,owner:web3.PublicKey.default.toBase58(),data:['','base64']},{lamports:1,owner:TOKEN_2022_PROGRAM_ID.toBase58(),data:['','base64']},{lamports:1,owner:PUMP_PROGRAM_ID.toBase58(),data:[curveData(creator,fee).toString('base64'),'base64']}]}};}};
  const deps={import_web332:web3,object:(v,fields)=>{if(Object.keys(v).some(k=>!fields.includes(k)))throw Error('Unexpected field');},launchFields:v=>({name:v.name,symbol:v.symbol}),publicAddress:v=>new web3.PublicKey(v).toBase58(),failure2:(message,status)=>Object.assign(Error(message),{status}),config:{launchEnabled:enabled,product:'leveragepad'},admission:async()=>({mint:quoteMint,tokenProgram:TOKEN_PROGRAM_ID.toBase58(),source:'quoteControl'}),token:TOKEN_PROGRAM_ID.toBase58(),pumpCreatorFeeSupport,directFeePolicy:async()=>({creatorFeeConfigurable:true,maxConfigurableCreatorFeeBps:300}),connection:rpc,bondingCurvePda2:bondingCurvePda,offline:PUMP_SDK,TOKEN_PROGRAM_ID,PUMP_CREATOR_FEE_BPS,guardTransaction,simulate,PUMP_PROGRAM_ID2:PUMP_PROGRAM_ID,TOKEN_2022_PROGRAM_ID,pumpSimulatedSolCost,now:Date.now,Buffer,pump:PUMP_PROGRAM_ID.toBase58()};
  const build=new Function(...Object.keys(deps),`return (${body.trim()});`)(...Object.values(deps));
  return {build,rpc,counts:()=>({simulations,reads})};
}
function mockAdmission(t,rpc){
  const getAccountInfo=rpc.getAccountInfo;
  t.mock.method(rpc,'getAccountInfo',async(key,...args)=>key.equals(GLOBAL_PDA)?{owner:PUMP_PROGRAM_ID,data:Buffer.alloc(0)}:getAccountInfo(key,...args));
  t.mock.method(OnlinePumpSdk.prototype,'resolveQuoteMint',async()=>({mint:new web3.PublicKey(quoteMint),quoteTokenProgram:TOKEN_PROGRAM_ID,source:'quoteControl'}));
  t.mock.method(PUMP_SDK,'decodeGlobal',()=>({creatorFeeConfigurable:true,maxConfigurableCreatorFeeBps:300}));
}
test('different creator wallet survives exact backend encoding, unsigned response, client reconstruction and independent simulation',async(t)=>{
  const f=fixture(),built=await f.build(request);assert.equal(built.wallet,wallet);assert.equal(built.creator,payee);assert.equal(built.payee,payee);assert.equal(built.creatorFeeBps,300);assert.deepEqual(built.signers,[wallet,mint]);
  const tx=await validatePumpEnvelope({built,request,product:'leveragepad'});assert.equal(tx.message.staticAccountKeys[0].toBase58(),wallet);assert(tx.signatures.every(s=>s.every(byte=>byte===0)));
  mockAdmission(t,f.rpc);
  assert.equal(await verifyPumpSimulation({rpc:f.rpc,tx,request}),1000000n);assert.equal(f.counts().simulations,2);
});
test('connected-wallet default still pays the signing creator and preserves 300 bps',async()=>{
  const f=fixture({creator:wallet}),value={...request};delete value.payee;const built=await f.build(value);assert.equal(built.payee,wallet);assert.equal(built.creator,wallet);await validatePumpEnvelope({built,request:value,product:'leveragepad'});
});
test('invalid, zero, PDA and mint fee recipients fail before simulation; a disabled builder stays paused',async()=>{
  const pda=bondingCurvePda(new web3.PublicKey(mint)).toBase58();
  for(const address of ['bad-address',web3.PublicKey.default.toBase58(),pda,mint]){const f=fixture();await assert.rejects(()=>f.build({...request,payee:address}));assert.equal(f.counts().simulations,0);assert.throws(()=>creatorWalletAddress(address,mint));}
  const f=fixture({enabled:false});await assert.rejects(()=>f.build(request),/paused/);assert.equal(f.counts().reads,0);
});
test('backend and browser refuse a different simulated creator or fee',async(t)=>{
  for(const options of [{creator:wallet},{fee:200}]){await assert.rejects(()=>fixture(options).build(request),/simulation rejected/);}
  const built=await fixture().build(request),tx=await validatePumpEnvelope({built,request,product:'leveragepad'});
  const wrong=fixture({creator:wallet});mockAdmission(t,wrong.rpc);
  await assert.rejects(()=>verifyPumpSimulation({rpc:wrong.rpc,tx,request}),/simulation rejected/);
});
test('response or instruction recipient redirection cannot pass the independent envelope check',async()=>{
  const built=await fixture().build(request);
  for(const change of [{creator:wallet},{payee:wallet},{wallet:payee},{creatorFeeBps:200},{signers:[payee,mint]}])await assert.rejects(()=>validatePumpEnvelope({built:{...built,...change},request,product:'leveragepad'}));
  const alternate=await fixture({creator:wallet}).build({...request,payee:wallet});
  await assert.rejects(()=>validatePumpEnvelope({built:{...built,transaction:alternate.transaction},request,product:'leveragepad'}),/reconstructed/);
  const tx=web3.VersionedTransaction.deserialize(Buffer.from(built.transaction,'base64'));tx.signatures[0][0]=1;
  await assert.rejects(()=>validatePumpEnvelope({built:{...built,transaction:Buffer.from(tx.serialize()).toString('base64')},request,product:'leveragepad'}),/Pre-signed/);
});
test('self uses the current signing wallet, custom uses the explicit public recipient, unsupported pledge mode rejects',()=>{
  assert.equal(resolveCreatorWallet({creatorMode:'self',creatorAddress:payee},wallet,mint),wallet);
  assert.equal(resolveCreatorWallet({creatorMode:'self'},payee,mint),payee);
  assert.equal(resolveCreatorWallet({creatorMode:'wallet',creatorAddress:payee},wallet,mint),payee);
  assert.throws(()=>resolveCreatorWallet({creatorMode:'holders-signed'},wallet,mint),/supported/);
});
test('platform provenance binds the recorded creator and exact message while retaining old same-wallet records',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'creator-provenance-'));
  try{const built=await fixture().build(request),tx=web3.VersionedTransaction.deserialize(Buffer.from(built.transaction,'base64')),message=Buffer.from(tx.message.serialize()).toString('base64');await recordPumpBuild({directory,built,message});const [candidate]=JSON.parse(await readFile(path.join(directory,'pump-builds.json'),'utf8'));
    const curve={creator:payee,quoteMint,creatorFeeBps:300,curve:built.curve};assert.equal(candidate.creator,payee);assert(matchesPumpReceipt(candidate,{meta:{err:null}},message,curve));assert(!matchesPumpReceipt(candidate,{meta:{err:null}},message,{...curve,creator:wallet}));assert(matchesPumpReceipt({...candidate,creator:undefined},{meta:{err:null}},message,{...curve,creator:wallet}));
  }finally{await rm(directory,{recursive:true,force:true});}
});
