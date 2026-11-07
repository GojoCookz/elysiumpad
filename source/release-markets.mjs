import { marketDirectory, marketIntro, marketHref } from './approved/elysium/market-directory.mjs';
import {evmDirectory} from './evm-directory.mjs';
import {aquaticMotion} from './aquatic-motion.mjs';
export async function releaseMarkets(target, { h, chain, current }) {
  const mode = new URLSearchParams(location.search).get('market') === 'all' ? 'all' : chain;
  const results = h('div'), coverage = h('details', { class: 'market-data-note' });
  const status = h('p', {role:'status'}, 'Loading verified launch records and market sources…');
  const mint = 'CsMF3EMEVm9ow925mtFVwnAvTYUgckcQJrFUWEFMpump';
  const copied = h('span', {role:'status','aria-live':'polite'});
   const ecosystem = h('section', {class:'hlys-feature','aria-label':'HLYS Solana ecosystem token'},
     h('div',{class:'hlys-feature-top'},h('span',{class:'market-eyebrow'},'THE ECOSYSTEM TOKEN'),h('span',{class:'hlys-network'},'Solana')),
     h('div',{class:'hlys-feature-heading'},h('img',{class:'hlys-emblem',src:'/purrlysium/mark.svg',alt:'',width:48,height:48}),
       h('div',{},h('h2',{},'$HLYS'),h('p',{},'Hypeliysium ecosystem token'))),
     h('details',{class:'hlys-feature-links'},h('summary',{},'Mint and links'),h('p', {class:'purr-address'}, h('code', {}, mint)),
    h('button', {class:'ely-btn',type:'button',onclick:async()=>{
      try { await navigator.clipboard.writeText(mint); copied.textContent=' Mint copied.'; }
      catch { copied.textContent=' Copy unavailable. Select the mint above to copy it.'; }
    }}, 'Copy HLYS mint'),
      h('a', {class:'ely-btn',href:'https://solscan.io/token/'+mint,target:'_blank',rel:'noopener noreferrer','aria-label':'View HLYS mint on Solscan (opens in a new tab)'}, 'View on Solscan'), copied),
     h('a',{class:'ely-btn primary hlys-explore',href:marketHref('solana','trade',mint)},'Explore HLYS →'));
    ecosystem.querySelector('.hlys-feature-links').open=matchMedia('(min-width:721px)').matches;
    const intro=marketIntro(h, mode);
   intro.querySelector('.market-actions')?.remove();
   intro.querySelector('.market-intro-copy > p')?.remove();
   intro.querySelector('.market-intro-copy > .market-eyebrow')?.remove();
  if(mode==='elysium'){const heading=intro.querySelector('h1,h2');if(heading)heading.textContent='Explore Elysium tokens';}
   const hero=h('section',{class:'hlys-hero'},h('div',{class:'hlys-hero-copy'},
     h('p',{class:'market-eyebrow'},mode==='elysium'?'ELYSIUM · 99901':'SOLANA LAUNCHPAD'),
     h('h1',{},'An idea.',h('br'),h('span',{},'A new market.')),
     h('p',{class:'hlys-hero-description'},mode==='elysium'?'Explore Elysium tokens. Create with creator, holder and burn allocations you control.':'Launch your coin. Find your community. Explore the Solana ecosystem with Hypeliysium.'),
     h('div',{class:'market-actions'},h('a',{class:'ely-btn primary',href:marketHref(chain,'create')},'Launch a coin ↗'),h('button',{class:'ely-btn',type:'button',onclick:()=>target.querySelector('#hlys-markets')?.scrollIntoView()},'Explore markets ↓')),
     h('p',{class:'hlys-identity'},'Hypeliysium is a Solana launchpad. HLYS is its ecosystem token.')),ecosystem);
   const water=aquaticMotion(h,hero);
    hero.querySelector('.market-actions').append(water.control);
    intro.append(coverage);
    const section=h('section',{id:'hlys-markets',class:'hlys-market-section'},intro,status,results);
   const introHeading=intro.querySelector('h1');if(introHeading){const heading=h('h2',{},mode==='elysium'?'Explore Elysium tokens':'Explore markets');introHeading.replaceWith(heading);}
   target.replaceChildren(hero,section);
  const load = async () => {
    const response = await fetch('/api/discovery');
    if (!response.ok) throw Error('Discovery unavailable. Existing coverage cannot be confirmed.');
    const snapshot = await response.json();
     const rows = snapshot.rows.filter(row => mode === 'all' || row.chain === mode).map(row=>mode==='all'&&row.chain==='elysium'?{...row,nativeMetrics:row,price:row.usd?.price??null,fdv:row.usd?.fdv??null,unit:'USD',pair:`${row.pair} · Elysium`}:row);
    if (current()) {
       status.textContent = '';
      coverage.replaceChildren(h('summary', {}, 'Discovery coverage and provenance'), ...Object.entries(snapshot.sources).map(([name, source]) => h('p',{}, `${name}: ${source.status}${source.count == null ? ' · count unknown' : ` · ${source.count} verified/returned`}${source.error ? ` · ${source.error}` : ''}${source.coverage ? ` · ${source.coverage}` : ''}${source.retainedStale ? ` · ${source.retainedStale} cached rows retained as stale` : ''}${source.warnings?.length ? ` · ${source.warnings.join(' ')}` : ''}`)));
      coverage.append(h('p', {}, 'Platform launch provenance is verified separately from ecosystem identity. HLYS is an ecosystem token, not a verified platform launch. Elysium is an early-live network; its official public-mainnet status has not been verified. Elysium prices use confirmed pool state; FDV uses total supply, not circulating supply. Discovery and history coverage are bounded. Missing artwork is not fabricated.'));
      if (!rows.length) status.textContent = snapshot.refreshing ? 'Discovery is still scanning. No verified rows available yet; this is not a confirmed zero.' : 'No rows available for this chain. Check source coverage before interpreting this as zero launches.';
    }
    return { rows, checkedAt:snapshot.checkedAt, partial:true, coverageNote:mode==='elysium'?'Pool records · see discovery coverage':'See discovery coverage' };
  };
   let directory,lastRefresh=0,refreshing=false;
   async function draw() {
     try { const data = await load();lastRefresh=Date.now();if(current()){if(mode==='elysium')directory=evmDirectory(results,{h,...data});else directory=marketDirectory(results,{h,chain:mode,...data,current,searchRemote:load,open:row=>{location.href=marketHref(row.chain,'trade',row.address);}});} }
    catch(e){if(current())status.replaceChildren(e.message,h('button',{class:'ely-btn',onclick:draw},'Retry discovery'));}
  }
  await draw();
    const timer = setInterval(async()=>{
      if(!current()||!target.isConnected){clearInterval(timer);water.destroy();return;}
      if(refreshing||document.hidden)return;
      if(directory&&Date.now()-lastRefresh>=60000){refreshing=true;try{const data=await load();if(current())directory.update(data);lastRefresh=Date.now();}catch{directory.markStale();status.textContent='Market refresh unavailable. Displayed values may be stale.';}finally{refreshing=false;}}
      else if(!directory&&!results.querySelector('.market-card,.market-table'))void draw();
    },10000);
}
