import {rank} from './discovery-core.mjs';
import {convertEvmRow} from './evm-usd.mjs';
import {locale} from './approved/elysium/i18n.mjs';
import {marketLayoutControls} from './approved/elysium/market-layout.mjs';
const short=s=>s?`${s.slice(0,8)}…${s.slice(-6)}`:'';
const amount=(v,unit)=>Number.isFinite(v)?`${v.toLocaleString(locale(),{maximumSignificantDigits:6})} ${unit}`:'Not yet available';
const dollars=v=>Number.isFinite(v)?new Intl.NumberFormat(locale(),{style:'currency',currency:'USD',maximumSignificantDigits:6}).format(v):'USD unavailable';
const time=value=>Number.isFinite(value)?new Date(value).toISOString():'Not yet available';
export function usdStatusLabel(row){
 if(row.usd?.status==='unavailable'||!Number.isFinite(row.usd?.price))return 'USD unavailable';
 if(row.usd.status!=='stale')return 'USD';
 const times=[row.stateTime??Date.parse(row.checkedAt),row.usd.rate?.observedAt,row.usd.rate?.stateTime].filter(Number.isFinite);
 return times.length?`Cached USD · ${Math.max(0,Math.floor((Date.now()-Math.min(...times))/60000))}m`:'Cached USD';
}
const explorer=(h,address,label)=>/^0x[\da-f]{40}$/i.test(address||'')?h('a',{href:`https://scan.elysp.com/address/${address}`,target:'_blank',rel:'noopener noreferrer'},label):h('span',{},'Not yet available');
export function evmMarketDetails(h,row){
 const rate=row.usd?.rate;
 return h('details',{class:'market-data-note evm-market-details','data-token':row.address},h('summary',{},`Market details · ${row.poolCount||1} pool${row.poolCount>1?'s':''}`),
  h('p',{},`${row.pair||'Pair unavailable'} · Elysium · 99901`),
  h('p',{class:'purr-address'},`Contract: ${row.address}`),
  h('dl',{class:'evm-native-metrics'},...[
   ['Price (USD)',row.usd?.price],['FDV (USD)',row.usd?.fdv],['Window volume (USD)',row.usd?.volume],['Active quote depth (USD)',row.usd?.activeDepth],['Liquidity (TVL, USD)',row.usd?.liquidity],
  ].map(([name,value])=>h('div',{},h('dt',{},name),h('dd',{},dollars(value))))),
  h('p',{},'Native quote values'),
  h('dl',{class:'evm-native-metrics'},...[
   ['Price',row.price],['FDV',row.fdv],['Window volume',row.volumeWindow?.complete?row.observedVolume:null],['Active quote depth',row.activeDepth],['Liquidity (TVL)',row.liquidityQuote],
  ].map(([name,value])=>h('div',{},h('dt',{},name),h('dd',{},amount(value,row.unit))))),
  h('p',{},'FDV uses total token supply, not circulating supply. Pool spot price is not an executable trade quote.'),
  h('p',{},'Active quote depth is virtual quote-side liquidity, not TVL. TVL is unavailable unless separately verified.'),
  h('p',{},row.volumeWindow?.complete?`Volume covers the selected pool from ${time(row.volumeWindow.fromTime*1000)} to ${time(row.volumeWindow.throughTime*1000)}. This is not a 24-hour total. 24-hour change is not yet available.`:'Trade history is not yet available.'),
  h('p',{},`Pool observed: ${time(row.stateTime??Date.parse(row.checkedAt))}`),
  ...(rate?[
   h('p',{},`Quote USD rate: ${amount(rate.usd,'USD')} / ${row.unit}`),
   h('p',{},`USD source observed: ${time(rate.observedAt)}`),
   h('p',{},h('a',{href:rate.sourceUrl,target:'_blank',rel:'noopener noreferrer'},rate.source)),
   ...(rate.address!=='0x0000000000000000000000000000000000000000'?[
    h('p',{},`Quote conversion: ${amount(rate.nativePerQuote,'HYPE')} / ${row.unit} × ${amount(rate.anchorUsd,'USD')} / HYPE`),
    h('p',{class:'purr-address'},`Conversion pool ID: ${rate.poolId}`),
    h('p',{},explorer(h,rate.manager,'Conversion pool manager'),` · ${time(rate.stateTime)} · block ${rate.stateBlock}`),
   ]:[]),
  ]:[h('p',{},'No verified, unexpired USD conversion is available for this quote asset.')]),
  ...((row.pools?.length?row.pools:[row]).map(p=>h('section',{class:'evm-pool-identity'},
   h('p',{},`${p.pair||row.pair} · Elysium`),
   h('p',{class:'purr-address'},`Pool ID: ${p.poolId}`),
   h('p',{},'Pool manager: ',explorer(h,p.manager,p.manager)),
   h('p',{},'Currency 0: ',p.key?.currency0==='0x0000000000000000000000000000000000000000'?'Native HYPE':explorer(h,p.key?.currency0,p.key?.currency0)),
   h('p',{},'Currency 1: ',explorer(h,p.key?.currency1,p.key?.currency1)),
   h('p',{},`State block: ${p.stateBlock||row.stateBlock}`),
   h('p',{},'V4 pools share a manager contract; the pool ID is not a separate contract address.'),
  ))),h('p',{},row.provenance?.source||'Verified on-chain state'));
}
export function evmDirectory(target,{h,rows,checkedAt}){
 const search=h('input',{type:'search',id:'ely-market-search',placeholder:'Name, symbol or contract'});
 const sort=h('select',{id:'ely-market-sort'},h('option',{value:'activeDepth'},'Active depth'),h('option',{value:'price'},'Price'),h('option',{value:'fdv'},'FDV'));
 const quoteKey=r=>`${r.chain}:${r.quoteAddress?.toLowerCase()||'unknown'}`;
 const quotes=[...new Map(rows.map(r=>[quoteKey(r),r])).entries()];
 const pair=h('select',{id:'ely-market-quote'},h('option',{value:''},'All quotes'),...quotes.map(([key,r])=>h('option',{value:key},`${r.unit} · Elysium${r.unit==='HYPE'?'':' · '+short(r.quoteAddress)}`)));
 const list=h('div'),status=h('p',{role:'status',class:'ely-muted'});let view='cards';
 const toggle=h('div',{class:'market-view-toggle',role:'group','aria-label':'Market display'});
 const density=marketLayoutControls(h,target,()=>{view='cards';draw();});
 const controls=h('div',{class:'market-controls evm-market-controls'},h('label',{for:search.id},'Search tokens',search),h('label',{for:sort.id},'Sort by',sort),h('label',{for:pair.id},'Quote asset',pair),h('fieldset',{class:'market-control-group'},h('legend',{},'View'),toggle),density);
 function draw(){
  const expanded=new Set([...list.querySelectorAll('.evm-market-details[open]')].map(el=>el.dataset.token));
  const q=search.value.toLowerCase(),shown=rows.filter(r=>(!pair.value||quoteKey(r)===pair.value)&&`${r.name} ${r.symbol} ${r.address}`.toLowerCase().includes(q)).sort((a,b)=>rank(a)-rank(b)||(b.usd?.[sort.value]??-1)-(a.usd?.[sort.value]??-1));
  status.textContent=`${shown.length} tokens · ${shown.filter(r=>r.price>0&&!r.stale).length} live pool prices · ${shown.filter(r=>r.usd?.price>0&&r.usd.status==='fresh').length} fresh USD prices${checkedAt?' · '+new Date(checkedAt).toLocaleTimeString(locale()):''}`;
  toggle.replaceChildren(...['cards','table'].map(value=>h('button',{type:'button',class:`market-view-button${view===value?' active':''}`,'aria-pressed':String(view===value),onclick:()=>{view=value;draw();}},value==='cards'?'Cards':'Table')));
  const identity=row=>h('div',{class:'market-token-link'},h('span',{class:'market-token-icon','aria-hidden':'true'},row.image?h('img',{src:row.image,alt:'',loading:'lazy',onerror:event=>{event.target.replaceWith(document.createTextNode(row.symbol.slice(0,2)));}}):row.symbol.slice(0,2)),h('span',{},h('b',{},row.symbol),h('small',{},row.name),h('small',{title:row.address},short(row.address))));
  const state=usdStatusLabel;
  const fields=row=>[['Price',row.usd?.price],['FDV',row.usd?.fdv],[row.volumeWindow?.complete?`Volume · ${Math.max(1,Math.round((row.volumeWindow.throughTime-row.volumeWindow.fromTime)/60))}m`:'Window volume',row.usd?.volume],...(row.liquidityQuote!=null?[['Liquidity (TVL)',row.usd?.liquidity]]:[])];
  const pairing=row=>`${row.pair||'Pair unavailable'} · Elysium`;
  if(view==='cards')list.replaceChildren(h('div',{class:'market-cards',role:'list','aria-label':'Elysium token markets'},...shown.map(row=>h('div',{class:'market-card',role:'listitem'},
   h('div',{class:'market-card-head'},identity(row),h('span',{class:'market-chain'},state(row))),
   h('dl',{class:'market-card-metrics'},...fields(row).map(([name,value])=>h('div',{},h('dt',{},name),h('dd',{},dollars(value)))),h('div',{},h('dt',{},'On-chain liquidity pair'),h('dd',{class:'evm-pair'},pairing(row)))),
   h('div',{class:'market-card-foot evm-card-actions'},evmMarketDetails(h,row),explorer(h,row.address,'View contract'))))));
  else list.replaceChildren(h('div',{class:'evm-table-scroll',tabindex:'0',role:'region','aria-label':'Elysium token markets'},h('table',{class:'market-table evm-usd-table'},h('caption',{},'Elysium markets · USD'),h('thead',{},h('tr',{},...['Token / chain','Price','FDV','Window volume','On-chain liquidity pair','Details'].map(name=>h('th',{scope:'col'},name)))),h('tbody',{},...shown.map(row=>h('tr',{},h('td',{},identity(row),h('small',{},state(row))),...['price','fdv','volume'].map(key=>h('td',{},dollars(row.usd?.[key]))),h('td',{class:'evm-pair'},pairing(row)),h('td',{},evmMarketDetails(h,row))))))));
  if(!shown.length)list.replaceChildren(h('p',{class:'market-empty'},rows.length?'No tokens match these filters.':'Market sources are still loading. See discovery coverage for current status.'));
  for(const detail of list.querySelectorAll('.evm-market-details'))detail.open=expanded.has(detail.dataset.token);
 }
 for(const control of [search,sort,pair])control.addEventListener(control===search?'input':'change',draw);
 target.replaceChildren(controls,status,list);draw();
 return {update(next){
  rows=next.rows;checkedAt=next.checkedAt;const selected=pair.value,quotes=[...new Map(rows.map(r=>[quoteKey(r),r])).entries()];
  pair.replaceChildren(h('option',{value:''},'All quotes'),...quotes.map(([key,r])=>h('option',{value:key},`${r.unit} · Elysium${r.unit==='HYPE'?'':' · '+short(r.quoteAddress)}`)));
  pair.value=quotes.some(([key])=>key===selected)?selected:'';draw();
 },markStale(){rows=rows.map(row=>convertEvmRow({...row,stale:true},row.usd?.rate?[row.usd.rate]:[]));draw();}};
}
