const Q96 = 2 ** 96;
const validDecimals = d => Number.isInteger(d) && d >= 0 && d <= 255;
const positive = n => Number.isFinite(n) && n > 0 ? n : null;
export function poolMetrics({sqrtPriceX96,liquidity,tokenIs0,tokenDecimals,quoteDecimals,supply}) {
  if (!validDecimals(tokenDecimals) || !validDecimals(quoteDecimals)) throw Error('Unverified decimals');
  const sqrt=BigInt(sqrtPriceX96),L=BigInt(liquidity);
  if(sqrt<=4295128739n||sqrt>=1461446703485210103287273052203988822378723970342n||L<=0n)return {price:null,fdv:null,activeDepth:null};
  const ratio=(Number(sqrt)/Q96)**2;
  const price=positive((tokenIs0?ratio:1/ratio)*10**(tokenDecimals-quoteDecimals));
  // Virtual quote-side reserves of current active L; NOT TVL or executable depth.
  const activeDepth=positive((tokenIs0?Number(L)*Number(sqrt)/Q96:Number(L)*Q96/Number(sqrt))/10**quoteDecimals);
  const total=supply==null?null:positive(Number(BigInt(supply))/10**tokenDecimals);
  return {price,fdv:price&&total?positive(price*total):null,activeDepth};
}
export const poolIdentity=p=>`${p.manager.toLowerCase()}:${p.poolId.toLowerCase()}`;
export function groupPools(pools,nativeQuotes=[]) {
  const depth=p=>{const rate=nativeQuotes.find(q=>q.verified&&q.chainId===99901&&q.address.toLowerCase()===p.quoteAddress?.toLowerCase());return rate?(p.activeDepth||0)*rate.nativePerQuote:null;};
  const compareDepth=(a,b)=>{
    const x=depth(a),y=depth(b);
    if(x!==null||y!==null)return (y??-1)-(x??-1);
    if(a.quoteAddress?.toLowerCase()===b.quoteAddress?.toLowerCase())return (b.activeDepth||0)-(a.activeDepth||0);
    return poolIdentity(a).localeCompare(poolIdentity(b));
  };
  const groups=new Map(),seen=new Set();
  for(const p of pools){const id=poolIdentity(p);if(seen.has(id))continue;seen.add(id);const key=p.address.toLowerCase();groups.set(key,[...(groups.get(key)||[]),p]);}
  return [...groups.values()].map(list=>{
    const platform=p=>p.provenance?.kind==='platform'&&p.provenance?.verified===true;
    list.sort((a,b)=>Number(platform(b))-Number(platform(a))||Number(b.price>0)-Number(a.price>0)||compareDepth(a,b));
    const best=list[0];
    // Keep quote-denominated volume separate across quotes; only selected venue's
    // window volume is shown. No synthetic cross-venue 24h aggregate.
    return {...best,pools:list.map(({pools,...p})=>p),poolCount:list.length};
  }).sort((a,b)=>Number(b.price>0)-Number(a.price>0)||compareDepth(a,b));
}
