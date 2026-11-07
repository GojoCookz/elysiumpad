// Token artwork and market-cap metadata for the Solana markets list.
// Order per mint: Jupiter tokens v2 (batched), then Pump.fun coin metadata for pump mints, then the
// on-chain metadata URI (Token-2022 metadata extension or the Metaplex metadata account).
// Resolved artwork is cached in memory so one failing provider does not blank the list.
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CID=/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/;
export const DEFAULT_IPFS_GATEWAYS=Object.freeze(['https://ipfs.filebase.io/ipfs/','https://pump.mypinata.cloud/ipfs/']);
const METAPLEX='metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
// Token creators control metadata URIs, so the server only fetches public https hosts: no IP literals,
// no internal names, and every DNS answer must be a public address (blocks cloud metadata/private nets).
const PRIVATE_IP=[/^0\./,/^10\./,/^127\./,/^169\.254\./,/^172\.(1[6-9]|2\d|3[01])\./,/^192\.168\./,/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,/^(22[4-9]|2[3-5]\d)\./,/^::1?$/,/^f[c-d]/i,/^fe[89ab]/i,/^::ffff:/i,/^64:ff9b:/i];
export async function isPublicHttps(value,resolveHost=host=>lookup(host,{all:true})){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(u.hostname.replace(/^\[|\]$/g,''))||!u.hostname.includes('.')||/(^|\.)(localhost|local|internal|lan|home|arpa|corp)$/i.test(u.hostname))return false;
  const addrs=await resolveHost(u.hostname);
  return Array.isArray(addrs)&&addrs.length>0&&addrs.every(a=>!PRIVATE_IP.some(r=>r.test(a.address)));
 }catch{return false;}
}
const ART_TTL=6*3600_000,MISS_TTL=120_000,EMPTY_TTL=1800_000,CAP_TTL=60_000,MAX_ENTRIES=2000;

// PDA derivation is injected from the already-installed Solana SDK.
export function parseMetaplexUri(data){
 // key(1) update_authority(32) mint(32) name(4+n) symbol(4+n) uri(4+n); strings are NUL-padded.
 let o=65;const str=()=>{const n=data.readUInt32LE(o);o+=4;if(n>1000||o+n>data.length)throw new Error('metadata');const s=data.subarray(o,o+n).toString('utf8').replace(/\0+$/,'').trim();o+=n;return s;};
 str();str();return str();
}

// ---- IPFS rewriting ----------------------------------------------------------------------------
export function ipfsParts(value){
 try{
  if(typeof value!=='string')return null;
  if(value.startsWith('ipfs://')){const [cid,...rest]=value.slice(7).replace(/^ipfs\//,'').split('/');return CID.test(cid)?{cid,path:rest.length?`/${rest.join('/')}`:''}:null;}
  const u=new URL(value);
  const sub=u.hostname.match(/^([a-z0-9]+)\.ipfs\./i);if(sub&&CID.test(sub[1]))return {cid:sub[1],path:u.pathname==='/'?'':u.pathname};
  const m=u.pathname.match(/^\/ipfs\/([^/]+)(\/.*)?$/);if(m&&CID.test(m[1]))return {cid:m[1],path:m[2]||''};
 }catch{}
 return null;
}
// Fast gateways first, then the original https URL as the last candidate.
export function artworkCandidates(value,gateways=DEFAULT_IPFS_GATEWAYS){
 const ipfs=ipfsParts(value),out=ipfs?gateways.map(g=>`${g}${ipfs.cid}${ipfs.path}`):[];
 try{const u=new URL(value);if(u.protocol==='https:')out.push(u.href);}catch{}
 return [...new Set(out)];
}

export function createTokenMetadata({fetcher=fetch,env={},now=Date.now,infrastructure=null,resolveHost,metadataAddress,allowedMetadata=isPublicHttps,log=()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const jupKey=env.JUP_API_KEY||env.JUPITER_API_KEY||'';
 const gateways=(env.IPFS_GATEWAYS||'').split(',').map(s=>s.trim()).filter(s=>/^https:\/\/[^/]+\/(ipfs\/)?$/.test(s)).map(s=>s.endsWith('ipfs/')?s:`${s}ipfs/`);
 const gw=gateways.length?gateways:DEFAULT_IPFS_GATEWAYS;
 const art=new Map();
 const breaker={jupiter:{until:0,fails:0},pump:{until:0,fails:0}};
 const trip=(name,why)=>{const b=breaker[name];if(now()<b.until)return;b.fails++;const wait=Math.min(600_000,15_000*2**(b.fails-1));b.until=now()+wait;log(`${name} unavailable (${why}); backing off ${Math.round(wait/1000)}s`);};
 const ok=name=>{breaker[name].fails=0;breaker[name].until=0;};
 const open=name=>now()<breaker[name].until;
 const entry=mint=>art.get(mint)||{};
 function put(mint,patch){const prev=entry(mint);art.delete(mint);art.set(mint,{...prev,...patch});if(art.size>MAX_ENTRIES)art.delete(art.keys().next().value);}
 async function getJson(url,{headers={},timeout=8000,limit=0,follow=null}={}){
  let r;
  for(let hop=0;;hop++){
   try{r=await fetcher(url,{headers:{accept:'application/json',...headers},redirect:'manual',signal:AbortSignal.timeout(timeout)});}
   catch(e){throw Object.assign(new Error(`${e.name}: ${e.message}${e.cause?.code?` (${e.cause.code})`:''}`),{transport:true});}
   // Redirects are only followed to hosts the caller allows (e.g. arweave.net -> <id>.arweave.net).
   const next=r.status>=300&&r.status<400&&r.headers.get('location');
   if(!next||!follow||hop>=2)break;
   const target=new URL(next,url).href;if(!await follow(target))break;url=target;
  }
  if(!r.ok){let body='';try{body=(await r.text()).replace(/\s+/g,' ').slice(0,160);}catch{}throw Object.assign(new Error(`HTTP ${r.status}${body?` ${body}`:''}`),{status:r.status});}
  const reader=r.body.getReader(),chunks=[];let size=0;const cap=limit||500000;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>cap){await reader.cancel();throw new Error('response too large');}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }

 async function jupiter(mints){
  const hosts=jupKey?['https://api.jup.ag']:['https://api.jup.ag','https://lite-api.jup.ag'];
  for(let start=0;start<mints.length;start+=20){
   if(open('jupiter'))return;
   const group=mints.slice(start,start+20),q=new URLSearchParams({query:group.join(',')});let records=null,errors=[];
   for(const host of hosts){
    for(let attempt=0;attempt<2&&!records;attempt++){
     try{const data=await getJson(`${host}/tokens/v2/search?${q}`,{headers:jupKey?{'x-api-key':jupKey}:{}});if(!Array.isArray(data))throw new Error('unexpected response shape');records={host,data};}
     catch(e){errors.push(`${host.replace('https://','')}: ${e.message}`);if(e.status===429&&attempt===0)await sleep(750);else break;}
    }
    if(records)break;
   }
   if(!records){trip('jupiter',errors.join(' | '));return;}
   ok('jupiter');const wanted=new Set(group);
   for(const r of records.data){
    if(!wanted.has(r?.id))continue;
    const images=artworkCandidates(r.icon,gw),cap=Number.isFinite(Number(r.mcap))&&Number(r.mcap)>=0?Number(r.mcap):null;
    const sourceUrl=`${records.host}/tokens/v2/search?query=${r.id}`;
    put(r.id,{answeredAt:now(),capAt:now(),marketCapUsd:cap,capSourceUrl:sourceUrl,...(images.length?{images,artAt:now(),source:'jupiter',sourceUrl}:{})});
   }
  }
 }
 async function pump(mint){
  if(open('pump'))return false;
  try{
   const c=await getJson(`https://frontend-api-v3.pump.fun/coins/${mint}`,{timeout:6000,limit:200_000});ok('pump');
   if(c?.mint!==mint)return false;
   const images=artworkCandidates(c.image_uri,gw),cap=Number.isFinite(Number(c.usd_market_cap))&&Number(c.usd_market_cap)>0?Number(c.usd_market_cap):null;
   const sourceUrl=`https://pump.fun/coin/${mint}`;
   put(mint,{answeredAt:now(),...(cap!=null&&!(entry(mint).capAt>now()-CAP_TTL)?{marketCapUsd:cap,capAt:now(),capSourceUrl:sourceUrl}:{}),...(images.length?{images,artAt:now(),source:'pump.fun',sourceUrl}:{})});
   return images.length>0;
  }catch(e){if(e.status===403||e.status===429||e.status>=500||e.transport)trip('pump',e.message);return false;}
 }
 async function metadataJson(uri){
  const allowed=async u=>await allowedMetadata(u)&&await isPublicHttps(u,resolveHost);
  const ipfs=ipfsParts(uri),urls=ipfs?gw.map(g=>`${g}${ipfs.cid}${ipfs.path}`):await allowed(uri)?[uri]:[];
  for(const url of urls){try{if(!await allowed(url))continue;return await getJson(url,{timeout:5000,limit:64_000,follow:allowed});}catch(e){log(`metadata JSON ${new URL(url).hostname}: ${e.message}`);}}
  return null;
 }
 async function onChain(mints){
  if(!infrastructure?.getAccounts||!mints.length)return;
  const uris=new Map();
  try{
   const mintAccounts=await infrastructure.getAccounts(mints,'jsonParsed');
   mintAccounts.forEach((a,i)=>{if(!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(a?.owner))return;const ext=a?.data?.parsed?.info?.extensions?.find?.(x=>x?.extension==='tokenMetadata');if(typeof ext?.state?.uri==='string'&&ext.state.uri)uris.set(mints[i],ext.state.uri);});
  }catch(e){log(`token-2022 metadata read failed: ${e.message}`);}
  const rest=mints.filter(m=>!uris.has(m));
  if(rest.length){
   try{
    const pdas=rest.map(metadataAddress),accounts=await infrastructure.getAccounts(pdas,'base64');
    accounts.forEach((a,i)=>{if(a?.owner!==METAPLEX||!Array.isArray(a.data))return;try{const uri=parseMetaplexUri(Buffer.from(a.data[0],'base64'));if(uri)uris.set(rest[i],uri);}catch{}});
   }catch(e){log(`metaplex metadata read failed: ${e.message}`);}
  }
  await pool([...uris],4,async([mint,uri])=>{
   const json=await metadataJson(uri);if(!json)return;
   const images=artworkCandidates(typeof json.image==='string'?json.image:'',gw);
   put(mint,{answeredAt:now(),...(images.length?{images,artAt:now(),source:'on-chain metadata',sourceUrl:`https://solscan.io/token/${mint}`}:{})});
  });
 }
 async function pool(items,size,fn){let i=0;await Promise.all(Array.from({length:Math.min(size,items.length)},async()=>{while(i<items.length)await fn(items[i++]);}));}

 return {
  gateways:gw,
  candidates:value=>artworkCandidates(value,gw),
  // tokens: [{mint,image}] where image is the DexScreener artwork (may be null). Returns the cache view.
  async resolve(tokens,{fallbackLimit=60}={}){
   const t=now(),mints=[...new Set(tokens.map(x=>x.mint).filter(m=>MINT.test(m)))];
   const capStale=mints.filter(m=>!(entry(m).capAt>t-CAP_TTL));
   const artStale=m=>{const e=entry(m);if(e.images?.length)return !(e.artAt>t-ART_TTL);return !(e.answeredAt>t-EMPTY_TTL)&&!(e.missAt>t-MISS_TTL);};
   if(capStale.length)await jupiter(capStale);
   const dexImage=new Map(tokens.map(x=>[x.mint,x.image]));
   const need=mints.filter(artStale).slice(0,fallbackLimit);
   const pumpMints=need.filter(m=>m.endsWith('pump'));
   await pool(pumpMints,4,pump);
   await onChain(need.filter(m=>!(entry(m).images?.length&&entry(m).artAt>=t)));
   for(const m of need)if(!(entry(m).answeredAt>=t)&&!dexImage.get(m))put(m,{missAt:now()});
   return new Map(mints.map(m=>[m,entry(m)]));
  },
  status(){return {jupiterKeyConfigured:Boolean(jupKey),jupiterBackoffUntil:breaker.jupiter.until||null,pumpBackoffUntil:breaker.pump.until||null,cachedArtwork:[...art.values()].filter(e=>e.images?.length).length};},
 };
}
