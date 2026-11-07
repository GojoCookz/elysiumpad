import { marketDirectory, marketIntro, marketHref } from '../../getrektdonhype/source/elysium/market-directory.mjs';
export async function releaseMarkets(target, { h, chain, current }) {
  const mode = new URLSearchParams(location.search).get('market') === 'all' ? 'all' : chain;
  const results = h('div'), coverage = h('details', { class: 'market-data-note' });
  const status = h('p', {role:'status'}, 'Loading verified launch records and market sources…');
  const mint = 'CsMF3EMEVm9ow925mtFVwnAvTYUgckcQJrFUWEFMpump';
  const copied = h('span', {role:'status','aria-live':'polite'});
  const ecosystem = h('section', {class:'market-data-note','aria-label':'HLYS Solana ecosystem token'},
    h('strong', {}, 'HLYS · Solana ecosystem token'),
    h('p', {}, 'Ecosystem identity · not proof of a platform launch.'),
    h('p', {class:'purr-address'}, h('code', {}, mint)),
    h('button', {class:'ely-btn',type:'button',onclick:async()=>{
      try { await navigator.clipboard.writeText(mint); copied.textContent=' Mint copied.'; }
      catch { copied.textContent=' Copy unavailable. Select the mint above to copy it.'; }
    }}, 'Copy HLYS mint'),
    h('a', {class:'ely-btn',href:'https://solscan.io/token/'+mint,target:'_blank',rel:'noopener noreferrer','aria-label':'View HLYS mint on Solscan (opens in a new tab)'}, 'View on Solscan'), copied);
  target.replaceChildren(marketIntro(h, mode),...(mode==='solana'||mode==='all'?[ecosystem]:[]),status,coverage,results);
  const load = async () => {
    const response = await fetch('/api/discovery');
    if (!response.ok) throw Error('Discovery unavailable. Existing coverage cannot be confirmed.');
    const snapshot = await response.json();
    const rows = snapshot.rows.filter(row => mode === 'all' || row.chain === mode);
    if (current()) {
      status.textContent = 'Verified platform launches first, then ecosystem tokens and wider discovery. Coverage is partial.';
      coverage.replaceChildren(h('summary', {}, 'Discovery coverage and provenance'), ...Object.entries(snapshot.sources).map(([name, source]) => h('p',{}, `${name}: ${source.status}${source.count == null ? ' · count unknown' : ` · ${source.count} verified/returned`}${source.error ? ` · ${source.error}` : ''}${source.coverage ? ` · ${source.coverage}` : ''}${source.retainedStale ? ` · ${source.retainedStale} cached rows retained as stale` : ''}${source.warnings?.length ? ` · ${source.warnings.join(' ')}` : ''}`)));
      if (!rows.length) status.textContent = snapshot.refreshing ? 'Discovery is still scanning. No verified rows available yet; this is not a confirmed zero.' : 'No rows available for this chain. Check source coverage before interpreting this as zero launches.';
    }
    return { rows, checkedAt:snapshot.checkedAt, partial:true, coverageNote:'Platform-first ordering · bounded sources; see Discovery coverage and provenance' };
  };
  async function draw() {
    try { const data = await load(); if(current())marketDirectory(results,{h,chain:mode,...data,current,searchRemote:load,open:row=>{location.href=marketHref(row.chain,'trade',row.address);}}); }
    catch(e){if(current())status.replaceChildren(e.message,h('button',{class:'ely-btn',onclick:draw},'Retry discovery'));}
  }
  await draw();
  const timer = setInterval(()=>{if(!current()||!target.isConnected)clearInterval(timer);else if(!results.querySelector('.market-card'))void draw();},10000);
}
