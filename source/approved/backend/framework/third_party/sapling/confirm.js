// SPDX-License-Identifier: MIT
// Copyright (c) Sapling. Adapted from core/src/confirm.ts, @saplingcash/sdk@0.1.0.
export async function confirmByPolling(conn,signature,lastValidBlockHeight,{intervalMs=1200,timeoutMs=90000}={}){
  const deadline=Date.now()+timeoutMs;
  for(let i=0;;i++){
    const status=(await conn.getSignatureStatuses([signature])).value[0];
    if(status?.err)throw Object.assign(new Error('Transaction failed on-chain: '+JSON.stringify(status.err)),{signature,definitive:true});
    if(status?.confirmationStatus==='confirmed'||status?.confirmationStatus==='finalized')return;
    if(i%5===4&&(await conn.getBlockHeight('confirmed'))>lastValidBlockHeight){
      const found=await conn.getTransaction(signature,{commitment:'confirmed',maxSupportedTransactionVersion:0});
      if(found?.meta?.err)throw Object.assign(new Error('Transaction failed on-chain: '+JSON.stringify(found.meta.err)),{signature,definitive:true});
      if(found)return;
      throw Object.assign(new Error('The blockhash expired. Check the signature on an explorer before starting another transaction.'),{signature});
    }
    if(Date.now()>deadline)throw Object.assign(new Error('Confirmation is pending. Check the existing signature before retrying.'),{signature});
    await new Promise(resolve=>setTimeout(resolve,intervalMs));
  }
}
