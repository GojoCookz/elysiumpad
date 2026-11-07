// Pure wire builders: no RPC, keys, signing, deployment, or broadcast.
// SHA-256 helpers are async; registration imports need no Node crypto module.
import {PublicKey, SystemProgram, TransactionInstruction} from '@solana/web3.js';
import {TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync} from '@solana/spl-token';

export const TAX_BPS = 300;
export const DECIMALS = 6;
export const BPS_DENOMINATOR = 10000;
export const CHALLENGE_SECONDS = 86400;
export const MAX_RECIPIENTS = 8;
export const MAX_HARVEST_SOURCES = 32;
export const MAX_PROOF_DEPTH = 32;
export const MAX_LEAVES = 1 << 20;
export const MAX_U64 = (1n << 64n) - 1n;
export const REVENUE_LEN = 416;
export const ROUND_LEN = 144;
export const CLAIM_LEN = 96;
export const TAGS = Object.freeze({register:1, harvest:2, post:3, finalize:4, cancel:5, claim:6,registerLaunchlab:7});
export const LAUNCHLAB_PROGRAM_ID=new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
export const LAUNCHLAB_FEE_AUTHORITY=new PublicKey('WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh');
export const LAUNCHLAB_QUOTES=Object.freeze(['2zCo6bUowJMvr89ajxuWsPadAqJ2F9akCkxumNsSdgsL','7ga6rtE9qSb3wdEiDCpTu2kHqoGVfT52jD8ign1rYTvx','4sWNB8zGWHkh6UnmwiEtzNxL4XrN7uK9tosbESbJFfVs']);
export const REVENUE_MAGIC = 'PADREV01';
export const ROUND_MAGIC = 'PADRND01';
export const CLAIM_MAGIC = 'PADCLM01';
export const LEAF_DOMAIN = 'pad-revenue:leaf:v1';
export const NODE_DOMAIN = 'pad-revenue:node:v1';
const pk = v => v instanceof PublicKey ? v : new PublicKey(v);
const bytes = v => Buffer.from(pk(v).toBytes());
const zeroKey = new PublicKey(new Uint8Array(32));
function integer(v,max,name) {if(!Number.isSafeInteger(v)||v<0||v>max)throw new RangeError(name);return v;}
export function u64(v) {
  if(typeof v==='number'&&!Number.isSafeInteger(v))throw new RangeError('Unsafe u64 number; use bigint');
  if(typeof v!=='number'&&typeof v!=='bigint')throw new TypeError('u64 requires bigint or safe integer');
  const n=BigInt(v);if(n<0n||n>MAX_U64)throw new RangeError('u64');return n;
}
function le64(v) {const b=Buffer.alloc(8);b.writeBigUInt64LE(u64(v));return b;}
function le32(v) {const b=Buffer.alloc(4);b.writeUInt32LE(integer(v,0xffffffff,'u32'));return b;}
function le16(v) {const b=Buffer.alloc(2);b.writeUInt16LE(integer(v,0xffff,'u16'));return b;}
function fixed32(v,name='hash') {const b=typeof v==='string'?Buffer.from(v,'hex'):Buffer.from(v??[]);if(b.length!==32||(typeof v==='string'&&!/^[0-9a-f]{64}$/i.test(v)))throw new RangeError(name);return b;}
function nonzero32(v,name) {const b=fixed32(v,name);if(!b.some(Boolean))throw new RangeError(name);return b;}
function derive(program,seeds) {return PublicKey.findProgramAddressSync(seeds,pk(program))[0];}
export const taxAuthority = program => derive(program,[Buffer.from('tax-authority')]);
export const revenueAddress = (program,mint) => derive(program,[Buffer.from('revenue'),bytes(mint)]);
export const roundAddress = (program,mint,epoch) => derive(program,[Buffer.from('round'),bytes(mint),le64(epoch)]);
// claimAddress binds round PDA + u32 leaf index, shared by claim and push.
export const claimAddress = (program,round,index) => derive(program,[Buffer.from('claim'),bytes(round),le32(index)]);
export const revenueAta = (program,mint) => ownerAta(revenueAddress(program,mint),mint);
export const ownerAta = (owner,mint) => getAssociatedTokenAddressSync(pk(mint),pk(owner),true,TOKEN_2022_PROGRAM_ID);
const meta=(key,isWritable=false,isSigner=false)=>({pubkey:pk(key),isWritable,isSigner});
const ix=(programId,keys,tag,data=Buffer.alloc(0))=>new TransactionInstruction({programId:pk(programId),keys,data:Buffer.concat([Buffer.from([tag]),data])});

export function validateRecipients({programId,mint,recipients,holderShareBps}) {
  integer(holderShareBps,9999,'holderShareBps');
  if(!holderShareBps||!Array.isArray(recipients)||!recipients.length||recipients.length>8)throw new RangeError('split bounds');
  const disallowed=[zeroKey,taxAuthority(programId),revenueAddress(programId,mint)];
  const seen=new Set();let total=holderShareBps;
  const out=recipients.map(({owner,bps})=>{
    const key=pk(owner);integer(bps,9999,'recipient bps');
    if(!bps||disallowed.some(p=>p.equals(key))||seen.has(key.toBase58()))throw new Error('Invalid or duplicate recipient');
    seen.add(key.toBase58());total+=bps;return {owner:key,bps};
  });
  if(total!==10000)throw new RangeError('split must total 10000 bps');return out;
}
export function splitGross(gross,recipients) {
  gross=u64(gross);if(!Array.isArray(recipients)||recipients.length<1||recipients.length>8)throw new RangeError('recipients');
  let total=0;const dev=recipients.map(({bps})=>{integer(bps,9999,'bps');if(!bps)throw new RangeError('positive recipient share required');total+=bps;return gross*BigInt(bps)/10000n;});
  if(total>=10000)throw new RangeError('positive holder share required');
  const devGross=dev.reduce((a,b)=>a+b,0n);return {dev,devGross,holderGross:gross-devGross};
}
export function registerRevenueIx({programId,mint,creator,recipients,holderShareBps}) {
  const list=validateRecipients({programId,mint,recipients,holderShareBps});
  return ix(programId,[meta(creator,true,true),meta(mint,false,true),meta(revenueAddress(programId,mint),true),
    meta(revenueAta(programId,mint)),meta(taxAuthority(programId)),meta(TOKEN_2022_PROGRAM_ID),meta(SystemProgram.programId)],TAGS.register,
    Buffer.concat([le16(holderShareBps),Buffer.from([list.length]),...list.map(({owner,bps})=>Buffer.concat([bytes(owner),le16(bps)]))]));
}
export function registerLaunchlabRevenueIx(input){
 const quote=pk(input.quoteMint);if(!LAUNCHLAB_QUOTES.includes(quote.toBase58()))throw new Error('Unsupported LaunchLab quote');
 const result=registerRevenueIx(input);result.data[0]=TAGS.registerLaunchlab;
 const pool=PublicKey.findProgramAddressSync([Buffer.from('pool'),bytes(input.mint),quote.toBuffer()],LAUNCHLAB_PROGRAM_ID)[0];
 result.keys.push(meta(pool));return result;
}
export function harvestRevenueIx({programId,mint,recipients,sources=[],cranker}) {
  // cranker is the transaction fee payer, not a program-authorized wallet.
  if(cranker!==undefined)pk(cranker);
  if(!Array.isArray(recipients)||!recipients.length||recipients.length>MAX_RECIPIENTS||!Array.isArray(sources)||sources.length>MAX_HARVEST_SOURCES)throw new RangeError('harvest bounds');
  const owners=recipients.map(r=>pk(r.owner??r));
  if(new Set(owners.map(o=>o.toBase58())).size!==owners.length)throw new Error('duplicate recipients');
  const sourceKeys=sources.map(pk);
  if(new Set(sourceKeys.map(o=>o.toBase58())).size!==sourceKeys.length||sourceKeys.some(o=>o.equals(pk(mint))))throw new Error('duplicate or invalid source');
  return ix(programId,[meta(mint,true),meta(revenueAddress(programId,mint),true),meta(revenueAta(programId,mint),true),
    meta(taxAuthority(programId)),meta(TOKEN_2022_PROGRAM_ID),...owners.map(o=>meta(ownerAta(o,mint),true)),...sourceKeys.map(o=>meta(o,true))],TAGS.harvest);
}
export function postRoundIx({programId,mint,creator,epoch,root,snapshotHash,grossBudget,leafCount}) {
  const budget=u64(grossBudget);integer(leafCount,MAX_LEAVES,'leafCount');if(!budget||!leafCount)throw new RangeError('positive budget and leafCount required');
  return ix(programId,[meta(creator,true,true),meta(mint),meta(revenueAddress(programId,mint),true),meta(roundAddress(programId,mint,epoch),true),meta(SystemProgram.programId)],TAGS.post,
    Buffer.concat([le64(epoch),nonzero32(root,'root'),nonzero32(snapshotHash,'snapshotHash'),le64(budget),le32(leafCount)]));
}
export function finalizeRoundIx({programId,mint,epoch}) {
  return ix(programId,[meta(mint),meta(revenueAddress(programId,mint)),meta(roundAddress(programId,mint,epoch),true)],TAGS.finalize,le64(epoch));
}
export function cancelRoundIx({programId,mint,epoch,creator}) {
  return ix(programId,[meta(mint),meta(revenueAddress(programId,mint),true),meta(roundAddress(programId,mint,epoch),true),meta(creator,false,true)],TAGS.cancel,le64(epoch));
}
function proofBytes(proof) {
  if(!Array.isArray(proof)||proof.length>32)throw new RangeError('proof depth');
  return proof.map(({hash,sum})=>Buffer.concat([fixed32(hash),le64(sum)]));
}
export function claimRoundIx({programId,mint,epoch,payer,owner,index,grossAmount,proof=[]}) {
  const round=roundAddress(programId,mint,epoch),amount=u64(grossAmount),key=pk(owner);
  if(!amount||key.equals(zeroKey)||key.equals(revenueAddress(programId,mint))||key.equals(taxAuthority(programId)))throw new RangeError('claim amount/owner');
  const items=proofBytes(proof);
  return ix(programId,[meta(payer,true,true),meta(mint),meta(revenueAddress(programId,mint),true),meta(revenueAta(programId,mint),true),
    meta(round,true),meta(claimAddress(programId,round,index),true),meta(ownerAta(key,mint),true),meta(TOKEN_2022_PROGRAM_ID),meta(SystemProgram.programId)],TAGS.claim,
    Buffer.concat([le64(epoch),le32(index),bytes(key),le64(amount),Buffer.from([items.length]),...items]));
}
export const pushRoundIx = claimRoundIx;

function accountData(input,programId) {
  if(input?.data!==undefined){if(programId===undefined)throw new Error('programId required to validate account owner');if(!pk(input.owner).equals(pk(programId)))throw new Error('account owner mismatch');return Buffer.from(input.data);}
  return Buffer.from(input);
}
export function decodeRevenue(input,programId) {
  const d=accountData(input,programId);if(d.length!==REVENUE_LEN||d.toString('ascii',0,8)!==REVENUE_MAGIC)throw new Error('Invalid revenue account');
  const mint=new PublicKey(d.subarray(8,40)),creator=new PublicKey(d.subarray(40,72)),n=d[74];
  if(n<1||n>8||d[75]>1||d.subarray(76,80).some(Boolean))throw new Error('Invalid revenue header');
  const recipients=Array.from({length:n},(_,i)=>({owner:new PublicKey(d.subarray(80+i*34,112+i*34)),bps:d.readUInt16LE(112+i*34)}));
  const holderShareBps=d.readUInt16LE(72);
  if(programId!==undefined)validateRecipients({programId,mint,recipients,holderShareBps});
  const names=['grossCollected','devGross','devNet','holderGross','claimedGross','claimedNet','reservedGross','nextEpoch'];
  const result={mint,creator,holderShareBps,recipients,mintPolicy:d[75]===1?'launchlab-protocol':'immutable'};names.forEach((name,i)=>{result[name]=d.readBigUInt64LE(352+i*8);});
  if(result.devGross+result.holderGross!==result.grossCollected||result.devNet>result.devGross||result.claimedNet>result.claimedGross||result.claimedGross+result.reservedGross>result.holderGross)throw new Error('Invalid revenue counters');
  result.availableGross=result.holderGross-result.claimedGross-result.reservedGross;return result;
}
export function decodeRound(input,programId) {
  const d=accountData(input,programId);if(d.length!==ROUND_LEN||d.toString('ascii',0,8)!==ROUND_MAGIC||d[136]>2||d.subarray(137,140).some(Boolean))throw new Error('Invalid round account');
  const r={container:new PublicKey(d.subarray(8,40)),epoch:d.readBigUInt64LE(40),root:Buffer.from(d.subarray(48,80)),snapshotHash:Buffer.from(d.subarray(80,112)),
    grossBudget:d.readBigUInt64LE(112),claimedGross:d.readBigUInt64LE(120),postedAt:d.readBigInt64LE(128),status:['pending','finalized','cancelled'][d[136]],leafCount:d.readUInt32LE(140)};
  if(!r.grossBudget||r.claimedGross>r.grossBudget||!r.leafCount||r.leafCount>MAX_LEAVES)throw new Error('Invalid round budget');
  r.maturesAt=r.postedAt+BigInt(CHALLENGE_SECONDS);r.remainingGross=r.grossBudget-r.claimedGross;return r;
}

// Uses platform SHA-256, never a handwritten hash. Dynamic fallback is not loaded
// by browser registration-only consumers and is not statically bundled into them.
async function sha(...parts) {
  const crypto=globalThis.crypto??(await import(['node','crypto'].join(':'))).webcrypto;
  return Buffer.from(await crypto.subtle.digest('SHA-256',Buffer.concat(parts)));
}
export async function leafHash({programId,container,round,index,owner,grossAmount}) {
  return sha(Buffer.from(LEAF_DOMAIN),bytes(programId),bytes(container),bytes(round),le32(index),bytes(owner),le64(grossAmount));
}
export async function nodeHash(left,right) {
  return sha(Buffer.from(NODE_DOMAIN),fixed32(left.hash),le64(left.sum),fixed32(right.hash),le64(right.sum));
}
export async function buildMerkleRound({programId,mint,epoch,allocations}) {
  if(!Array.isArray(allocations)||!allocations.length||allocations.length>MAX_LEAVES)throw new RangeError('leaf count');
  const container=revenueAddress(programId,mint),round=roundAddress(programId,mint,epoch),leafCount=allocations.length;
  let width=1;while(width<leafCount)width*=2;
  const leaves=[];
  for(let index=0;index<width;index++) {
    const owner=index<leafCount?pk(allocations[index].owner):zeroKey;
    const sum=index<leafCount?u64(allocations[index].grossAmount):0n;
    if(index<leafCount&&(!sum||owner.equals(zeroKey)||owner.equals(container)||owner.equals(taxAuthority(programId))))throw new RangeError('Invalid allocation');
    leaves.push({hash:await leafHash({programId,container,round,index,owner,grossAmount:sum}),sum});
  }
  const levels=[leaves];while(levels.at(-1).length>1){const old=levels.at(-1),next=[];
    for(let i=0;i<old.length;i+=2){const sum=u64(old[i].sum+old[i+1].sum);next.push({hash:await nodeHash(old[i],old[i+1]),sum});}levels.push(next);
  }
  const root=levels.at(-1)[0];
  return {root:root.hash,grossBudget:root.sum,leafCount,container,round,
    claims:allocations.map((a,index)=>{let path=index;const proof=[];for(let h=0;h<levels.length-1;h++){proof.push(levels[h][path^1]);path=Math.floor(path/2);}return {owner:pk(a.owner),grossAmount:u64(a.grossAmount),index,proof};})};
}
export async function verifyMerkleProof({programId,container,round,index,owner,grossAmount,proof,root,grossBudget,leafCount}) {
  try {
    integer(leafCount,MAX_LEAVES,'leafCount');integer(index,0xffffffff,'index');
    if(!leafCount||index>=leafCount||!u64(grossAmount)||!Array.isArray(proof)||proof.length>32||proof.length!==Math.ceil(Math.log2(leafCount)))return false;
    let current={hash:await leafHash({programId,container,round,index,owner,grossAmount}),sum:u64(grossAmount)},path=index;
    for(const sibling of proof){const other={hash:fixed32(sibling.hash),sum:u64(sibling.sum)};
      const [l,r]=path%2?[other,current]:[current,other];current={hash:await nodeHash(l,r),sum:u64(l.sum+r.sum)};path=Math.floor(path/2);
    }
    return current.sum===u64(grossBudget)&&current.hash.equals(fixed32(root));
  } catch {return false;}
}
