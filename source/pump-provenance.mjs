import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
export const messageHash = message => createHash('sha256').update(Buffer.from(message,'base64')).digest('hex');
let writes=Promise.resolve();
export function recordPumpBuild({directory,built,message}) {
  const write=async()=>{
    await mkdir(directory,{recursive:true});const file=path.join(directory,'pump-builds.json');let rows=[];
    try{rows=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    const hash=messageHash(message);
    rows=rows.filter(row=>row.messageHash!==hash);
    rows.push({mint:built.mint,wallet:built.wallet,creator:built.creator??built.wallet,quoteMint:built.quote.mint,messageHash:hash,createdAt:new Date().toISOString()});
    await writeFile(file+'.tmp',JSON.stringify(rows.slice(-500)));await rename(file+'.tmp',file);
  };
  const pending=writes.then(write,write);writes=pending.catch(()=>{});return pending;
}
export function matchesPumpReceipt(candidate, transaction, message, curve) {
  return transaction?.meta?.err === null && messageHash(message) === candidate.messageHash && curve?.creator === (candidate.creator??candidate.wallet) && curve?.quoteMint === candidate.quoteMint && curve?.creatorFeeBps === 300 && !!curve?.curve;
}
