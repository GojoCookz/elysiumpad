// SPDX-License-Identifier: MIT
// Copyright (c) Sapling. Adapted from core/src/swapguard.ts, @saplingcash/sdk@0.1.0.
// Changes: audited SPL decoding, generic input/output mints, strict simulation results.
import {PublicKey,TransactionMessage,ComputeBudgetProgram,SystemProgram} from '@solana/web3.js';
import {ASSOCIATED_TOKEN_PROGRAM_ID,NATIVE_MINT,TOKEN_PROGRAM_ID,TOKEN_2022_PROGRAM_ID,getAssociatedTokenAddressSync,unpackAccount} from '@solana/spl-token';
import {Buffer} from 'buffer';
export const JUPITER_PROGRAM_ID=new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
const programs=[TOKEN_PROGRAM_ID.toBase58(),TOKEN_2022_PROGRAM_ID.toBase58()];
const is=(key,want)=>!!key&&key.equals(want);
const refuse=message=>{throw new Error('Swap refused: '+message+'. Nothing was sent.');};

export function checkSwapInstructions(instructions,user){
 const wsol=getAssociatedTokenAddressSync(NATIVE_MINT,user,true,TOKEN_PROGRAM_ID);
 let routes=0;
 for(const ix of instructions){
  for(const k of ix.keys)if(k.isSigner&&!k.pubkey.equals(user))refuse('another signer was requested');
  const p=ix.programId,d=ix.data;
  if(p.equals(JUPITER_PROGRAM_ID)){routes++;continue;}
  if(p.equals(ComputeBudgetProgram.programId))continue;
  if(p.equals(SystemProgram.programId)){
   if(d.length===12&&new DataView(d.buffer,d.byteOffset,d.byteLength).getUint32(0,true)===2&&is(ix.keys[0]?.pubkey,user)&&is(ix.keys[1]?.pubkey,wsol))continue;
   refuse('unexpected SOL transfer');
  }
  if(p.equals(ASSOCIATED_TOKEN_PROGRAM_ID)){
   const tag=d.length===0?0:d.length===1?d[0]:-1;
   const [payer,account,owner,mint,system,tokenProgram]=ix.keys.map(k=>k.pubkey);
   if(![0,1].includes(tag)||!is(payer,user)||!is(owner,user)||!is(system,SystemProgram.programId)||!mint||!tokenProgram||!programs.includes(tokenProgram.toBase58()))refuse('unexpected associated token account instruction');
   if(!is(account,getAssociatedTokenAddressSync(mint,user,true,tokenProgram)))refuse('token account does not belong to the connected wallet');
   continue;
  }
  if(p.equals(TOKEN_PROGRAM_ID)){
   if(d.length===1&&d[0]===17&&is(ix.keys[0]?.pubkey,wsol))continue;
   if(d.length===1&&d[0]===9&&is(ix.keys[0]?.pubkey,wsol)&&is(ix.keys[1]?.pubkey,user)&&is(ix.keys[2]?.pubkey,user))continue;
   refuse('unexpected token approval, transfer, authority change or close');
  }
  refuse('program '+p.toBase58()+' is not allowed');
 }
 if(routes!==1)refuse('expected exactly one Jupiter swap');
}

function decoded(address,info){
 if(!info||!programs.includes(info.owner.toBase58()))return null;
 return unpackAccount(new PublicKey(address),info,info.owner);
}

export function checkSwapTokenAccounts({user,accounts,inputMint,outputMint,inputAmount,minOutput}){
 const owner=user.toBase58(),wsol=getAssociatedTokenAddressSync(NATIVE_MINT,user,true,TOKEN_PROGRAM_ID).toBase58();
 let inputDelta=0n,outputDelta=0n;
 for(const {address,before,after} of accounts){
  if(!after){if(before&&address!==wsol)return 'an existing token account would close';continue;}
  if(after.owner.toBase58()!==owner)return 'a token account owner would change';
  if(before&&!before.mint.equals(after.mint))return 'a token account mint would change';
  if(after.delegate?.toBase58()!==(before?.delegate?.toBase58()))return 'a token delegate would change';
  if((after.delegatedAmount||0n)>(before?.delegatedAmount||0n))return 'a delegated spending allowance would increase';
  if(after.closeAuthority?.toBase58()!==(before?.closeAuthority?.toBase58()))return 'a close authority would change';
  const delta=after.amount-(before?.amount||0n),mint=after.mint.toBase58();
  if(mint===inputMint)inputDelta+=delta;
  else if(mint!==NATIVE_MINT.toBase58()&&delta<0n)return 'an unrelated token balance would decrease';
  if(mint===outputMint)outputDelta+=delta;
 }
 if(inputMint!==NATIVE_MINT.toBase58()&&inputDelta < -inputAmount)return 'token spend exceeds the requested amount';
 if(outputMint!==NATIVE_MINT.toBase58()&&outputDelta<minOutput)return 'output is below the requested minimum';
 return null;
}

export async function simulateSwap(conn,tx,user,{inputMint,outputMint,inputAmount,minOutput}){
 const signers=tx.message.staticAccountKeys.slice(0,tx.message.header.numRequiredSignatures);
 if(signers.length!==1||!signers[0].equals(user))refuse('unexpected fee payer or signers');
 const tables=await Promise.all(tx.message.addressTableLookups.map(async l=>{const table=(await conn.getAddressLookupTable(l.accountKey)).value;if(!table)refuse('lookup table is missing');return table;}));
 const message=TransactionMessage.decompile(tx.message,{addressLookupTableAccounts:tables});
 if(!message.payerKey.equals(user))refuse('fee payer does not match your wallet');
 checkSwapInstructions(message.instructions,user);
 const keys=tx.message.getAccountKeys({addressLookupTableAccounts:tables});
 const all=[...keys.staticAccountKeys,...(keys.accountKeysFromLookups?.writable||[]),...(keys.accountKeysFromLookups?.readonly||[])];
 const unique=[...new Map(all.map(k=>[k.toBase58(),k])).values()];
 const infos=[];for(let i=0;i<unique.length;i+=100)infos.push(...await conn.getMultipleAccountsInfo(unique.slice(i,i+100),'confirmed'));
 const tracked=[];
 for(let i=0;i<unique.length;i++){let before=null;try{before=decoded(unique[i],infos[i]);}catch{}if(before?.owner.equals(user))tracked.push({address:unique[i].toBase58(),before,program:infos[i].owner});}
 for(const ix of message.instructions.filter(i=>i.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID))){const address=ix.keys[1].pubkey.toBase58();if(!tracked.some(t=>t.address===address))tracked.push({address,before:null,program:ix.keys[5].pubkey});}
 if(tracked.length>90)refuse('too many token accounts to verify');
 const beforeLamports=BigInt(await conn.getBalance(user,'confirmed'));
 const sim=await conn.simulateTransaction(tx,{sigVerify:false,replaceRecentBlockhash:true,commitment:'confirmed',accounts:{encoding:'base64',addresses:[user.toBase58(),...tracked.map(t=>t.address)]}});
 if(sim.value.err)return {err:sim.value.err,logs:sim.value.logs,cost:null};
 if(BigInt(await conn.getBalance(user,'confirmed'))!==beforeLamports)refuse('your SOL balance changed during simulation; review a fresh quote');
 const post=sim.value.accounts;if(!post?.[0]||post.length!==tracked.length+1)refuse('incomplete simulation account results');
 let wrappedDelta=0n;
 const checked=tracked.map((t,i)=>{const a=post[i+1];let after=null;const closed=!a||(a.lamports===0&&a.data?.[0]==='');if(!closed){if(a.owner!==t.program.toBase58())refuse('token program ownership would change at '+t.address);after=decoded(t.address,{...a,owner:new PublicKey(a.owner),data:Buffer.from(a.data[0],'base64')});}
 if(t.before?.mint.equals(NATIVE_MINT)||after?.mint.equals(NATIVE_MINT))wrappedDelta+=(after?.amount||0n)-(t.before?.amount||0n);
 return {...t,after};});
 const why=checkSwapTokenAccounts({user,accounts:checked,inputMint,outputMint,inputAmount,minOutput});if(why)refuse(why);
 return {err:null,cost:beforeLamports-BigInt(post[0].lamports)-wrappedDelta,logs:sim.value.logs};
}
