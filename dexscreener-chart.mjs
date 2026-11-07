import {mountChart as mountSourceChart} from './terminal-chart.mjs';
const base58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function dexChartUrl(token,theme='dark'){
 if(!base58.test(token?.pair||''))throw new Error('A verified Solana source-pool address is required.');
 const url=new URL('https://dexscreener.com/solana/'+token.pair);
 url.search=new URLSearchParams({embed:'1',theme:theme==='light'?'light':'dark',trades:'0',info:'0',chartLeftToolbar:'0',chartDefaultOnMobile:'1',chartStyle:'1',chartType:'usd',interval:'60'});
 return url.href;
}
export function mountChart(options){
 const {target,onData=()=>{}}=options;let selected=null,provider='dexscreener';
 const controls=document.createElement('div');controls.className='chart-provider-tabs';controls.setAttribute('role','group');controls.setAttribute('aria-label','Chart provider');
 const embed=document.createElement('div');embed.className='dex-chart-panel';
 const source=document.createElement('div');source.className='source-chart-panel';source.hidden=true;
 const buttons=['DEX Screener','Source candles'].map((name,index)=>{const button=document.createElement('button');button.type='button';button.textContent=name;button.setAttribute('aria-pressed',String(index===0));button.addEventListener('click',()=>{provider=index===0?'dexscreener':'source';show();if(provider==='source'&&selected)native.select(selected);else onData(null);});controls.append(button);return button;});
 target.classList.add('provider-chart');target.replaceChildren(controls,embed,source);
 const native=mountSourceChart({...options,target:source,onData:value=>{if(provider==='source')onData(value);}});
 function show(){embed.hidden=provider!=='dexscreener';source.hidden=provider!=='source';buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String((i===0)===(provider==='dexscreener'))));}
 function renderEmbed(){embed.replaceChildren();if(!selected)return;
  try{const url=dexChartUrl(selected,document.documentElement.dataset.theme),frame=document.createElement('iframe');frame.title=`${selected.symbol||'Selected token'} source-pool chart on DEX Screener`;frame.src=url;frame.loading='lazy';frame.referrerPolicy='no-referrer';frame.setAttribute('allow','fullscreen');frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');frame.setAttribute('allowfullscreen','');
   const note=document.createElement('p');note.className='embed-chart-note';note.append('Embedded provider chart. Blank or blocked? Use Source candles or ');const link=document.createElement('a');link.textContent='open DEX Screener';link.href='https://dexscreener.com/solana/'+selected.pair;link.target='_blank';link.rel='noopener noreferrer';note.append(link,'. External charts do not include your wallet or paper-trade overlays.');embed.append(frame,note);
  }catch(error){const note=document.createElement('p');note.textContent=error.message+' Use Source candles.';embed.append(note);}
 }
 window.addEventListener('pad-theme-change',renderEmbed);
 return {select(token){selected=token;onData(null);renderEmbed();if(provider==='source')native.select(token);show();}};
}
