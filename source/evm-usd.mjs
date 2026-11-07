export const NATIVE = '0x0000000000000000000000000000000000000000';
export const HYPE_USD_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=hyperliquid&vs_currencies=usd&include_last_updated_at=true';
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const age = (time, now) => Number.isFinite(time) ? now - time : Infinity;
// Provider timestamps, not fetch times, determine rate freshness. Never use the
// launcher's operator override or an unbounded last-known rate for market USD.
export async function fetchHypeUsd({fetcher=fetch,previous,now=Date.now()}) {
  try {
    const response = await fetcher(HYPE_USD_URL,{signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw Error(`USD provider HTTP ${response.status}`);
    const data = (await response.json()).hyperliquid;
    const observedAt = data?.last_updated_at * 1000;
    if (!finite(data?.usd) || data.usd <= 0 || !Number.isFinite(observedAt) || age(observedAt,now) < -60000 || age(observedAt,now) > 3600000) throw Error('USD provider returned invalid or expired data');
    return {usd:data.usd,observedAt,receivedAt:now,source:'CoinGecko hyperliquid / USD',sourceUrl:HYPE_USD_URL};
  } catch (error) {
    return previous ? {...previous,error:error.message,attemptedAt:now} : {usd:null,error:error.message,attemptedAt:now};
  }
}
export function quoteUsdRates(anchor,nativeQuotes,now=Date.now()) {
  if (!finite(anchor?.usd) || anchor.usd <= 0 || age(anchor.observedAt,now) < -60000 || age(anchor.observedAt,now) > 3600000) return [];
  return nativeQuotes.filter(q=>q.chainId===99901 && finite(q.nativePerQuote) && q.nativePerQuote>0 && q.verified===true).map(q=>({
    ...q,usd:q.nativePerQuote*anchor.usd,anchorUsd:anchor.usd,observedAt:anchor.observedAt,
    source:anchor.source,sourceUrl:anchor.sourceUrl,
    stale:Boolean(anchor.error)||age(anchor.observedAt,now)>300000||q.address!==NATIVE&&age(q.stateTime,now)>300000,
  }));
}
export function convertEvmRow(row,rates,now=Date.now()) {
  const quote = row.quoteAddress?.toLowerCase();
  const rate = rates.find(r=>r.chainId===99901 && r.address?.toLowerCase()===quote);
  const unavailable = {status:'unavailable',price:null,fdv:null,volume:null,activeDepth:null,liquidity:null,rate:null};
  if(row.chain!=='elysium'||!quote||!rate||!finite(rate.usd)||rate.usd<=0||age(rate.observedAt,now)>3600000||age(rate.observedAt,now)<-60000||quote!==NATIVE&&age(rate.stateTime,now)>3600000)return {...row,usd:unavailable};
  const multiply=value=>finite(value)&&Number.isFinite(value*rate.usd)?value*rate.usd:null;
  const stale = Boolean(row.stale||rate.stale)||age(rate.observedAt,now)>300000||quote!==NATIVE&&age(rate.stateTime,now)>300000||age(row.stateTime??Date.parse(row.checkedAt),now)>600000;
  return {...row,usd:{status:stale?'stale':'fresh',price:multiply(row.price),fdv:multiply(row.fdv),volume:row.volumeWindow?.complete?multiply(row.observedVolume):null,activeDepth:multiply(row.activeDepth),
    // Only an explicitly quote-denominated TVL field can be converted. Active
    // concentrated liquidity is virtual depth, never relabelled as TVL.
    liquidity:multiply(row.liquidityQuote),rate}};
}
