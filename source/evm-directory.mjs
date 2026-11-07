import {rank} from './discovery-core.mjs';
import {locale} from './approved/elysium/i18n.mjs';
import {marketLayoutControls} from './approved/elysium/market-layout.mjs';
const short=s=>s?`${s.slice(0,8)}…${s.slice(-6)}`:'';
const amount=(v,unit)=>Number.isFinite(v)?`${v.toLocaleString(locale(),{maximumSignificantDigits:6})} ${unit}`:'Not yet available';
export function evmDirectory(target,{h,rows,checkedAt}){
 const search=h('input',{type:'search',id:'ely-market-search',placeholder:'Name, symbol or contract'});
 const sort=h('select',{id:'ely-market-sort'},h('option',{value:'depth'},'Active depth'),h('option',{value:'price'},'Price'),h('option',{value:'fdv'},'FDV'));
 const pair=h('select',{id:'ely-market-quote'},h('option',{value:''},'All quotes'),...[...new Set(rows.map(r=>r.unit))].map(q=>h('option',{value:q},q)));
 const list=h('div',{class:'market-cards',role:'list','aria-label':'Elysium token markets'}),status=h('p',{role:'status',class:'ely-muted'});
 const controls=h('div',{class:'market-controls evm-market-controls'},h('label',{for:'ely-market-search'},'Search tokens',search),h('label',{for:'ely-market-sort'},'Sort by',sort),h('label',{for:'ely-market-quote'},'Quote asset',pair),marketLayoutControls(h,target));
 const draw=()=>{
  const q=search.value.toLowerCase();const shown=rows.filter(r=>(!pair.value||r.unit===pair.value)&&`${r.name} ${r.symbol} ${r.address}`.toLowerCase().includes(q)).sort((a,b)=>rank(a)-rank(b)||Number(b.price>0)-Number(a.price>0)||(b[sort.value==='depth'?'activeDepth':sort.value]||0)-(a[sort.value==='depth'?'activeDepth':sort.value]||0));
  status.textContent=`${shown.length} tokens · ${shown.filter(r=>r.price>0&&!r.stale).length} live pool prices${checkedAt?' · '+new Date(checkedAt).toLocaleTimeString():''}`;
  list.replaceChildren(...shown.map(row=>{
   const img=row.image?h('img',{src:row.image,alt:'',loading:'lazy',width:'40',height:'40'}):null;
   const badge=h('span',{class:'market-token-icon','aria-hidden':'true'},img||row.symbol.slice(0,2));if(img)img.onerror=()=>badge.replaceChildren(row.symbol.slice(0,2));
   const label=row.provenance?.kind==='platform'&&row.provenance?.verified?'Hypeliysium launch':'Elysium market';
   const head=h('div',{class:'market-card-head'},h('div',{class:'market-token-link'},badge,h('span',{},h('b',{},row.symbol),h('small',{},row.name),h('small',{title:row.address},short(row.address)))),h('span',{class:'market-chain'},row.stale?'Cached':'ELY'));
   const fields=[['Price',row.price],['FDV',row.fdv]];
   if(row.observedVolume!=null&&row.volumeWindow?.complete)fields.push([`Volume · ${Math.max(1,Math.round((row.volumeWindow.throughTime-row.volumeWindow.fromTime)/60))}m`,row.observedVolume]);
   const metrics=row.price>0?h('dl',{class:'market-card-metrics'},...fields.filter(([,v])=>v!=null).map(([name,value])=>h('div',{},h('dt',{},name),h('dd',{},amount(value,row.unit)))),h('div',{},h('dt',{},'Pair'),h('dd',{},row.pair))):h('p',{},'Waiting for an active pool price.');
   const detail=h('details',{class:'market-data-note'},h('summary',{},`Market details · ${row.poolCount||1} pool${row.poolCount>1?'s':''}`),
    h('p',{class:'purr-address'},`Contract: ${row.address}`),h('p',{},'FDV uses total token supply, not circulating supply. Pool spot price is not an executable trade quote.'),
    h('p',{},`Active quote depth: ${amount(row.activeDepth,row.unit)}. Virtual quote-side liquidity at the current price, not TVL.`),
    h('p',{},row.observedVolume==null?'Trade history is not yet available.':`Volume covers the selected pool from ${new Date(row.volumeWindow.fromTime*1000).toISOString()} to ${new Date(row.volumeWindow.throughTime*1000).toISOString()}. This is not a 24-hour total. 24-hour change is not yet available.`),
    ...((row.pools?.length?row.pools:[row]).map(p=>h('p',{class:'purr-address'},`${p.pair||row.pair} · pool ${p.poolId} · manager ${p.manager} · state block ${p.stateBlock||row.stateBlock}`))),
    h('p',{},row.provenance?.source||'Verified on-chain state'));
   return h('article',{class:'market-card',role:'listitem'},head,metrics,detail,h('div',{class:'market-card-foot'},h('span',{class:'market-adapter-badge'},label),h('a',{class:'ely-btn',href:`https://scan.elysp.com/address/${row.address}`,target:'_blank',rel:'noopener noreferrer'},'View contract')));
  }));
  if(!shown.length)list.append(h('p',{class:'market-empty'},rows.length?'No tokens match these filters.':'Market sources are still loading. See discovery coverage for current status.'));
 };
 for(const control of [search,sort,pair])control.addEventListener(control===search?'input':'change',draw);
 target.replaceChildren(controls,status,list);draw();
}
