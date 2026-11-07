const DEX='https://api.dexscreener.com';
import cachedArtwork from './token-artwork.json' with {type:'json'};
const artworkByMint=new Map(cachedArtwork.assets.map(asset=>[asset.mint,asset]));
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const ASSET_REGISTRY=Object.freeze([
 {mint:'2zCo6bUowJMvr89ajxuWsPadAqJ2F9akCkxumNsSdgsL',symbol:'xBTC',name:'Hylo Leveraged BTC',kind:'leveraged',ecosystem:'bitcoin'},
 {mint:'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij',symbol:'cbBTC',name:'Coinbase Wrapped BTC',kind:'spot',ecosystem:'bitcoin'},
 {mint:'3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',symbol:'WBTC',name:'Wrapped BTC (Portal)',kind:'spot',ecosystem:'bitcoin'},
 {mint:'7ga6rtE9qSb3wdEiDCpTu2kHqoGVfT52jD8ign1rYTvx',symbol:'xHYPE',name:'Hylo Leveraged HYPE',kind:'leveraged',ecosystem:'hyper'},
 {mint:'98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g',symbol:'HYPE',name:'HYPE (Solana token)',kind:'spot',ecosystem:'hyper'},
 {mint:'4sWNB8zGWHkh6UnmwiEtzNxL4XrN7uK9tosbESbJFfVs',symbol:'xSOL',name:'Hylo Leveraged SOL',kind:'leveraged',ecosystem:'solana'},
 {mint:'So11111111111111111111111111111111111111112',symbol:'SOL',name:'Solana',kind:'spot',ecosystem:'solana'}
]);
const registry=new Map(ASSET_REGISTRY.map(asset=>[asset.mint,asset]));
// HypurrLabs' own community coin. Always fetched so it is listed even below the name-search cut.
export const FEATURED_MINTS=Object.freeze(['Fgv57qrp8R1Ps6QyeCFxxxPCcZpwhaaKCgNB18gkpump']);
export const PRODUCTS=Object.freeze({
 bitcoin:{name:'Bitcoin Pad',query:'BTC',preferredQuote:ASSET_REGISTRY[0].mint,seeds:ASSET_REGISTRY.filter(a=>a.ecosystem==='bitcoin')},
 hyper:{name:'Hyper Pad',query:'HYPE',preferredQuote:ASSET_REGISTRY[3].mint,seeds:ASSET_REGISTRY.filter(a=>a.ecosystem==='hyper')},
 solana:{name:'Solana Pad',query:'SOL',preferredQuote:ASSET_REGISTRY[5].mint,seeds:ASSET_REGISTRY.filter(a=>a.ecosystem==='solana')},
 leveragepad:{name:'Leveragepad',query:'',queries:['HYPE','BTC','SOL'],preferredQuote:ASSET_REGISTRY[4].mint,seeds:ASSET_REGISTRY,featured:FEATURED_MINTS}
});
const number=(n,negative=false)=>n!=null&&n!==''&&Number.isFinite(Number(n))&&(negative||Number(n)>=0)?Number(n):null;
const text=(s,max=80)=>typeof s==='string'?s.trim().slice(0,max):'';
const safeImage=url=>{try{const u=new URL(url);if(u.protocol!=='https:')return null;if(u.hostname==='cdn.dexscreener.com'){u.searchParams.set('width','96');u.searchParams.set('height','96');u.searchParams.set('quality','80');u.searchParams.set('format','auto');}return u.href;}catch{return null;}};
const failure=(code,status=503)=>Object.assign(new Error(code),{code,status});
export const SOL_MEME_MIN_MARKET_CAP_USD=200000;
export function marketLane(token){
 if(token.assetClass==='leveraged')return 'leveraged';
 if(token.assetClass==='spot')return 'spot';
 if(token.pairedLeveragedMints?.length||token.ecosystems?.some(name=>name==='bitcoin'||name==='hyper'))return 'exotic';
 return 'solana-memes';
}
export function passesMarketPolicy(token,pad){
 return !['leveragepad','solana'].includes(pad)||marketLane(token)!=='solana-memes'||(Number.isFinite(token.marketCapUsd)&&token.marketCapUsd>SOL_MEME_MIN_MARKET_CAP_USD);
}

export function createMarketScanner({infrastructure,fetcher=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map(),metadata=new Map();
 let budgetStart=now(),builds=0;
 async function json(url){const r=await fetcher(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw failure('MARKET_SOURCE_UNAVAILABLE');return r.json();}
 async function build(pad,query){
  const status=await infrastructure.status();if(!status.ok)throw failure(status.error||'RPC_UNAVAILABLE');
  const product=PRODUCTS[pad],seeds=new Map(product.seeds.map(seed=>[seed.mint,seed]));
  const featured=new Set(product.featured||[]);
  const jobs=[...product.seeds.map(seed=>({kind:'pools',url:`${DEX}/token-pairs/v1/solana/${seed.mint}`})),...[...featured].map(mint=>({kind:'featured',url:`${DEX}/token-pairs/v1/solana/${mint}`}))];
  for(const term of query?[query]:product.queries||[product.query])jobs.push({kind:'search',url:`${DEX}/latest/dex/search?${new URLSearchParams({q:term})}`});
  const upstream=await Promise.allSettled(jobs.map(async job=>{const data=await json(job.url),pairs=job.kind==='search'?data?.pairs:data;if(!Array.isArray(pairs))throw failure('MARKET_SOURCE_UNAVAILABLE');return pairs.slice(0,100);}));
  const warnings=[],pairs=[];
  upstream.forEach((result,i)=>{if(result.status==='fulfilled')pairs.push(...result.value);else warnings.push(`${jobs[i].kind==='search'?'Name search':jobs[i].kind==='featured'?'The featured community coin source':'A quote-asset pool source'} is unavailable.`);});
  if(upstream.every(result=>result.status==='rejected'))throw failure('MARKET_SOURCE_UNAVAILABLE');
  const byMint=new Map(),pairedQuotes=new Map(),poolFamilies=new Map();
  const funding=new Set(['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','So11111111111111111111111111111111111111112']);
  const expanded=pairs.flatMap(p=>{if(p?.chainId!=='solana'||!seeds.has(p.baseToken?.address)||seeds.has(p.quoteToken?.address)||funding.has(p.quoteToken?.address))return [p];const usd=number(p.priceUsd),ratio=number(p.priceNative);return [p,{...p,baseToken:p.quoteToken,quoteToken:p.baseToken,priceUsd:usd!=null&&ratio>0?usd/ratio:null,priceChange:null,marketCap:null,info:null,derivedPrice:true}];});
  for(const p of expanded){
   if(p?.chainId!=='solana'||!MINT.test(p.baseToken?.address||'')||!MINT.test(p.quoteToken?.address||'')||!MINT.test(p.pairAddress||'')||p.baseToken.address===p.quoteToken.address)continue;
   const seed=seeds.get(p.baseToken.address),canonical=registry.get(p.baseToken.address),quoteAsset=registry.get(p.quoteToken.address),direct=Boolean(seed||seeds.has(p.quoteToken.address));
   if(query&&p.baseToken.address!==query&&!`${seed?.name||p.baseToken.name||''} ${seed?.symbol||p.baseToken.symbol||''}`.toLowerCase().includes(query.toLowerCase()))continue;
   if(quoteAsset?.kind==='leveraged'){if(!pairedQuotes.has(p.baseToken.address))pairedQuotes.set(p.baseToken.address,new Set());pairedQuotes.get(p.baseToken.address).add(quoteAsset.mint);}
   if(!poolFamilies.has(p.baseToken.address))poolFamilies.set(p.baseToken.address,new Set());
   if(canonical)poolFamilies.get(p.baseToken.address).add(canonical.ecosystem);
   if(quoteAsset&&direct)poolFamilies.get(p.baseToken.address).add(quoteAsset.ecosystem);
   const token={mint:p.baseToken.address,name:canonical?.name||text(p.baseToken.name)||'Unnamed token',symbol:canonical?.symbol||text(p.baseToken.symbol,24)||'TOKEN',image:safeImage(p.info?.imageUrl),association:seed?'selected-asset':direct?'quote-market':'name-match',assetClass:canonical?.kind||(direct?'ecosystem':'discovery'),derivedPrice:Boolean(p.derivedPrice),priceUsd:number(p.priceUsd),change24h:number(p.priceChange?.h24,true),liquidityUsd:number(p.liquidity?.usd),volume24hUsd:number(p.volume?.h24),marketCapUsd:number(p.marketCap),pair:p.pairAddress,quoteMint:p.quoteToken.address,quoteSymbol:quoteAsset?.symbol||text(p.quoteToken.symbol,24)||'Unknown',venue:text(p.dexId,32)||'Unknown',sourceUrl:`https://dexscreener.com/solana/${p.pairAddress}`};
   const previous=byMint.get(token.mint),preferred=PRODUCTS[pad].preferredQuote;
   // Featured coins display their preferred-quote (HYPE) market even when another pool is deeper.
   if(previous&&featured.has(token.mint)&&(previous.quoteMint===preferred)!==(token.quoteMint===preferred)){if(token.quoteMint===preferred)byMint.set(token.mint,token);continue;}
   if(!previous||(direct&&previous.association==='name-match')||((direct||previous.association==='name-match')&&(token.liquidityUsd??-1)>(previous.liquidityUsd??-1)))byMint.set(token.mint,token);
  }
  const rank=token=>featured.has(token.mint)?-1:token.association==='selected-asset'?0:token.association==='quote-market'?1:2;
   const ranked=[...byMint.values()].sort((a,b)=>rank(a)-rank(b)||(b.liquidityUsd??-1)-(a.liquidityUsd??-1)).slice(0,120);
   const missing=ranked.filter(token=>!metadata.has(token.mint)||now()-metadata.get(token.mint).at>=60000);
   // Keep encoded address batches below common provider URL/query limits.
   for(let start=0;start<missing.length;start+=20){
    const group=missing.slice(start,start+20);
    try{
     let base='https://api.jup.ag/tokens/v2/search',records;const query=new URLSearchParams({query:group.map(token=>token.mint).join(',')});
     try{records=await json(`${base}?${query}`);}catch{base='https://lite-api.jup.ag/tokens/v2/search';records=await json(`${base}?${query}`);}
     if(!Array.isArray(records))throw new Error();const wanted=new Set(group.map(token=>token.mint));
     for(const record of records){if(!wanted.has(record?.id))continue;metadata.set(record.id,{at:now(),image:safeImage(record.icon),marketCapUsd:number(record.mcap),sourceUrl:`${base}?query=${record.id}`});}
     if(metadata.size>400)for(const mint of [...metadata.keys()].slice(0,metadata.size-400))metadata.delete(mint);
    }catch{warnings.push('Some token artwork and market cap metadata is unavailable. Missing values are not invented.');}
   }
   const enriched=ranked.map(token=>{const info=metadata.get(token.mint),fresh=info&&now()-info.at<60000,cachedArt=artworkByMint.get(token.mint);const cap=token.marketCapUsd??(fresh?info.marketCapUsd:null),images=[...new Set([info?.image,token.image,...(cachedArt?.urls||[])].filter(Boolean))].slice(0,3);const value={...token,image:images[0]||null,imageCandidates:images,imageSourceUrl:info?.image?info.sourceUrl:token.image?token.sourceUrl:cachedArt?.sourceUrl||null,marketCapUsd:cap,marketCapSourceUrl:token.marketCapUsd!=null?token.sourceUrl:cap!=null?info.sourceUrl:null,pairedLeveragedMints:[...(pairedQuotes.get(token.mint)||[])],ecosystems:[...(poolFamilies.get(token.mint)||[])]};return {...value,marketLane:marketLane(value)};});
   const eligible=enriched.filter(token=>passesMarketPolicy(token,pad));
   const omitted=enriched.length-eligible.length;
   const candidates=eligible.slice(0,40);
  const verification=await infrastructure.verifyMints(candidates.map(token=>token.mint));
  const tokens=candidates.flatMap((token,i)=>verification[i]?[{...token,pairedLeveragedMints:[...(pairedQuotes.get(token.mint)||[])],ecosystems:[...(poolFamilies.get(token.mint)||[])],verification:verification[i]}]:[]);
  const rejected=candidates.length-tokens.length;
  if(rejected)warnings.push(`${rejected} candidate mint${rejected===1?' was':'s were'} omitted because on-chain mint verification failed.`);
   return {pad,network:'solana',readOnly:true,complete:false,marketPolicy:{solMemeMinMarketCapUsd:['leveragepad','solana'].includes(pad)?SOL_MEME_MIN_MARKET_CAP_USD:null,strictlyAbove:true,missingCapExcluded:true,leveragedAndExoticExempt:true,omitted,notice:'SOL-side non-leveraged memes require a sourced market cap above $200,000. This is a listing filter, not a safety or quality certification. FDV is not used as market cap.'},coverage:'Selected quote-asset pools and Solana name matches, bounded to returned sources. Not an exhaustive ecosystem index.',associationNotice:'Name matches do not establish ecosystem affiliation, backing, or tradeability against the selected quote asset.',query:query||product.query,checkedAt:new Date(now()).toISOString(),sources:jobs.map(job=>job.url),seedMints:product.seeds.map(seed=>seed.mint),partial:warnings.length>0,warnings,tokens};
 }
 return {async scan({pad,query=''}={}){
  if(!Object.hasOwn(PRODUCTS,pad))throw failure('INVALID_PRODUCT',400);
  if(typeof query!=='string'||query.trim().length>64)throw failure('INVALID_QUERY',400);
  query=query.trim();const key=`${pad}:${MINT.test(query)?query:query.toLowerCase()}`,hit=cache.get(key);
  if(hit&&now()-hit.at<60000)return {...hit.value,cached:true};
  if(pending.has(key))return pending.get(key);
  if(now()-budgetStart>=60000){budgetStart=now();builds=0;}
  if(builds>=8)throw failure('SCAN_RATE_LIMIT',429);
  builds++;
  const task=build(pad,query).then(value=>{if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,{at:now(),value});return {...value,cached:false};}).finally(()=>pending.delete(key));
  pending.set(key,task);return task;
 }};
}
