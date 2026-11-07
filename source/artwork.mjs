import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createTokenMetadata,artworkCandidates,isPublicHttps} from './token-metadata.mjs';
const HOSTS=new Set(['cdn.dexscreener.com','dd.dexscreener.com','ipfs.io','ipfs.filebase.io','pump.mypinata.cloud','gateway.pinata.cloud','cloudflare-ipfs.com','arweave.net','static.jup.ag','raw.githubusercontent.com','assets.coingecko.com','coin-images.coingecko.com','metadata.jup.ag']);
export function allowedArtworkURL(value,extraHosts=new Set()) {
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(HOSTS.has(u.hostname)||extraHosts.has(u.hostname));}catch{return false;}
}
export function imageType(bytes){
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(/^GIF8[79]a$/.test(bytes.subarray(0,6).toString()))return 'image/gif';
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
 return null;
}
export const imageRoute=row=>row.chain==='solana'?`/api/discovery/art/solana/${row.address}`:row.image||'';
export function createArtwork({env,directory,getRows,getCachedArtwork=()=>null,getAccounts,metadataAddress,fetcher=fetch,resolveHost}){
 const extraHosts=new Set();
 for(const row of getRows())for(const url of getCachedArtwork(row.address)?.urls||[])try{extraHosts.add(new URL(url).hostname);}catch{}
 const allowed=u=>allowedArtworkURL(u,extraHosts);
 const metadata=createTokenMetadata({fetcher,env,infrastructure:{getAccounts},metadataAddress,allowedMetadata:allowed,resolveHost});
 const cache=new Map(),pending=new Map();
 const metadataBatch=mint=>metadata.resolve([{mint,image:getRows().find(r=>r.address===mint)?.image}],{fallbackLimit:1});
 let active=0;const waiters=[];
 const acquire=async()=>{if(active>=4)await new Promise(r=>waiters.push(r));active++;};
 const release=()=>{active--;waiters.shift()?.();};
 async function download(input){
  let url=input;
  for(let hop=0;hop<3;hop++){
   if(!allowed(url)||!await isPublicHttps(url,resolveHost))throw Error('Artwork host disallowed');
   const r=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{accept:'image/png,image/jpeg,image/webp,image/gif'}});
   if(r.status>=300&&r.status<400&&r.headers.get('location')){url=new URL(r.headers.get('location'),url).href;continue;}
   if(!r.ok||Number(r.headers.get('content-length'))>2000000)throw Error('Artwork unavailable or oversized');
   const reader=r.body.getReader(),chunks=[];let length=0;
   for(;;){const{done,value}=await reader.read();if(done)break;length+=value.length;if(length>2000000){await reader.cancel();throw Error('Oversized artwork');}chunks.push(value);}
   const body=Buffer.concat(chunks),type=imageType(body);if(!type)throw Error('Unsupported artwork type');return{body,type};
  }throw Error('Too many artwork redirects');
 }
 async function load(mint){
  const row=getRows().find(r=>r.chain==='solana'&&r.address===mint);if(!row)return null;
  const file=path.join(directory,mint+'.img');
  try{const body=await readFile(file),type=imageType(body);if(type&&body.length<=2000000)return{body,type};}catch{}
  const direct=[row.image,...row.imageCandidates||[],...getCachedArtwork(mint)?.urls||[]].filter(u=>typeof u==='string'&&u.startsWith('https:'));
  let candidates=[...new Set(direct.flatMap(u=>artworkCandidates(u)))].filter(allowed).slice(0,4);
  for(const url of candidates)try{const out=await download(url);await mkdir(directory,{recursive:true});await writeFile(file,out.body);return out;}catch{}
  const resolved=(await metadataBatch(mint)).get(mint);
  candidates=[...new Set(resolved?.images||[])].filter(allowed).slice(0,4);
  for(const url of candidates)try{const out=await download(url);await mkdir(directory,{recursive:true});await writeFile(file,out.body);return out;}catch{}
  return null;
 }
 async function get(mint){
  if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)||!getRows().some(r=>r.chain==='solana'&&r.address===mint))return null;
  const prior=cache.get(mint);if(prior&&Date.now()<prior.until)return prior.asset;
  if(pending.has(mint))return pending.get(mint);
  const promise=(async()=>{await acquire();try{const asset=await load(mint);cache.set(mint,{asset,until:Date.now()+(asset?21600000:120000)});if(cache.size>100)cache.delete(cache.keys().next().value);return asset;}finally{release();pending.delete(mint);}})();pending.set(mint,promise);return promise;
 }
 return {get,status:()=>({cached:cache.size,loaded:[...cache.values()].filter(x=>x.asset).length,...metadata.status()})};
}
