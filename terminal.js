/* Shared four-product terminal. Source data only; Jupiter owns wallet approval and swap execution. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const productId=document.documentElement.dataset.product;
  const rektdPreview=productId==='leveragepad'&&(document.documentElement.dataset.brand==='getrektd'||new URLSearchParams(location.search).get('brand')==='getrektd');if(rektdPreview)document.documentElement.dataset.brand='getrektd';
  window.PadCleanUrl=url=>{if(rektdPreview){url.pathname='/';url.searchParams.delete('brand');if(url.searchParams.get('view')==='launchpad')url.searchParams.delete('view');if(url.searchParams.get('panel')==='discover')url.searchParams.delete('panel');}return url;};
 const offline=location.protocol==='file:';
 const USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
 const SOL='So11111111111111111111111111111111111111112';
 const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const labels={bitcoin:{name:'Bitcoin Pad',symbol:'B',title:'Bitcoin. Amplified.',description:'Bitcoin spot assets, Hylo xBTC, and coins from their Solana markets.'},hyper:{name:'Hyper Pad',symbol:'H',title:'The HYPE ecosystem.',description:'HYPE on Solana, Hylo xHYPE, and their quote-paired ecosystem coins.'},solana:{name:'Solana Pad',symbol:'S',title:'Solana. More exposure.',description:'SOL, Hylo xSOL, and a wider view of their Solana ecosystem markets.'},leveragepad:{name:'Leveragepad',symbol:'L',title:'Three ecosystems. One terminal.',description:'BTC, HYPE and SOL—with their leveraged forms and quote-paired coins.'}};
  const identity=rektdPreview?{...labels.leveragepad,name:'HypurrLabs',symbol:''}:labels[productId]||labels.bitcoin;
 let marketStatus={state:'loading'};
 let registry=[],products={},data=null,selected=null,category='all',sort='relevance',view='launchpad',watchOnly=false,limit=20,side='buy',funding=USDC,requestId=0,pluginPromise=null,pluginActive=false,tradeIntent=0,deployment=null,directCleanup=null,paperController=null,compactPaper=null,terminalShell=null,launchpad=null,executionMode='paper';
 let watch=new Set();try{watch=new Set(JSON.parse(localStorage.getItem(`terminal-watch-${productId}`)||'[]').filter(m=>typeof m==='string'&&MINT.test(m)));}catch{}
 const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=text;return el;};
 const money=value=>value==null||!Number.isFinite(value)?'—':new Intl.NumberFormat(window.PadI18n?.locale(),{style:'currency',currency:'USD',maximumSignificantDigits:value<1?5:6,notation:value>=1e6?'compact':'standard'}).format(value);
 const change=value=>value==null?'—':new Intl.NumberFormat(window.PadI18n?.locale(),{maximumFractionDigits:2,signDisplay:'exceptZero'}).format(value)+'%';
 const className=token=>token.assetClass||'discovery';
 const classLabel=token=>({leveraged:'Leveraged token · variable exposure',spot:'Spot asset',ecosystem:'Quote-paired ecosystem coin',discovery:'Name match · affiliation unverified'}[className(token)]);
 const asset=mint=>registry.find(item=>item.mint===mint);
  const href=id=>offline?`${id==='leveragepad'?'leveragepad':id+'-pad'}.html`:`/${id}${rektdPreview&&id==='leveragepad'?'?brand=getrektd':''}`;
 const localWatch=()=>{try{localStorage.setItem(`terminal-watch-${productId}`,JSON.stringify([...watch]));return true;}catch{return false;}};
  function setBanner(){
  const el=$('#mode-banner');el.replaceChildren();
   const title=node('strong','',offline?'OFFLINE SOURCE SNAPSHOT':view==='launchpad'&&productId==='leveragepad'?'':view==='launchpad'?'YOUR WALLET. YOUR CALL.':data?'SOURCE-VERIFIED SOLANA MINTS':'SOLANA MARKET DATA');
   const text=offline?' · Captured market data, not a live quote. Wallet trading is disabled in this file.':view==='launchpad'&&deployment?.pumpCreationConfigured?'Pump creation enabled. You review and sign each launch. Trading and rewards remain paused.':view==='launchpad'&&productId==='leveragepad'&&!deployment?.tradingConfigured?'Preview · Real trades, publishing and rewards are paused.':view==='launchpad'?(deployment?.tradingConfigured?' · Practice first. Real trades need separate wallet approval.':' · Preview: practice is available. Real trades and rewards are paused.'):' · Leveraged tokens and x-asset quote pools are different exposures. Every swap needs your wallet approval.';
  el.append(title,document.createTextNode(text));
 }
 function art(token){if(window.PadTokenArt)return window.PadTokenArt.art(token);const el=node('span','token-art',token.symbol.slice(0,2));if(token.image){try{const url=new URL(token.image);if(url.protocol==='https:'){const img=node('img');img.alt='';img.width=38;img.height=38;img.loading='lazy';img.referrerPolicy='no-referrer';img.hidden=true;img.onload=()=>{el.replaceChildren(img);img.hidden=false;};img.onerror=()=>img.remove();img.src=url.href;el.append(img);}}catch{}}return el;}
 function badge(token){return node('span',`asset-badge ${className(token)}`,classLabel(token));}
 function relevant(){
  let list=(data?.tokens||[]).filter(token=>(category==='all'||className(token)===category)&&(!watchOnly||watch.has(token.mint))&&(!$('#x-pair-only').checked||token.pairedLeveragedMints?.length));
  if(sort==='liquidity')list.sort((a,b)=>(b.liquidityUsd??-1)-(a.liquidityUsd??-1));
  if(sort==='volume')list.sort((a,b)=>(b.volume24hUsd??-1)-(a.volume24hUsd??-1));
  if(sort==='change')list.sort((a,b)=>(b.change24h??-Infinity)-(a.change24h??-Infinity));
  return list;
 }
 function toggleWatch(mint){watch.has(mint)?watch.delete(mint):watch.add(mint);if(!localWatch())$('#result-status').textContent='Browser storage is unavailable. Watchlist lasts for this session only.';renderMarkets();updateWatchButton();}
 function updateWatchButton(){const active=selected&&watch.has(selected.mint);$('#favorite-selected').textContent=active?'Remove from watchlist':'Add to watchlist';$('#favorite-selected').setAttribute('aria-pressed',String(Boolean(active)));}
 function renderRail(){
  const rail=$('#ecosystem-rail');rail.replaceChildren();
  const primary=new Set((products[productId]?.seeds||[]).filter(token=>token.kind==='leveraged').map(token=>token.mint));
  const selectedAssets=(data?.tokens||[]).filter(token=>token.assetClass==='leveraged'&&primary.has(token.mint));
  if(!selectedAssets.length){rail.hidden=true;return;}rail.hidden=false;
  for(const token of selectedAssets){const button=node('button','ecosystem-asset');button.type='button';button.append(art(token));const text=node('span','asset-identity');text.append(node('strong','',token.symbol),node('small','','Hylo leveraged token · variable leverage'));const price=node('span','rail-price',money(token.priceUsd));price.append(node('span',token.change24h==null?'':token.change24h<0?'negative':'positive',change(token.change24h)));button.append(text,price);button.addEventListener('click',()=>selectToken(token));rail.append(button);}
 }
 function renderMarkets(){
  const list=$('#market-list');list.replaceChildren();const filtered=relevant();
  $('#result-status').textContent=data?`${filtered.length} matching sourced tokens${watchOnly?' · Your watchlist':''} · Showing ${Math.min(limit,filtered.length)}`:'Waiting for source data…';
  $('#show-more').hidden=filtered.length<=limit;
  $('#token-count').textContent=data?data.tokens.length:'—';
  if(!data)return;
  $('#updated-at').textContent=data.checkedAt?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(data.checkedAt)):'Snapshot time unavailable';
  if(!filtered.length){const empty=node('div','empty-state');empty.append(node('h2','',watchOnly?'Your saved markets appear here.':'No sourced tokens match.'),node('p','',watchOnly?'Save a token using its watch button. No fabricated assets are added to fill the screen.':'Choose another category, clear the x-pair filter, or search a Solana mint.'));const reset=node('button','','Show all sourced markets');reset.addEventListener('click',()=>{category='all';watchOnly=false;$('#x-pair-only').checked=false;setView('markets');syncCategories();renderMarkets();});empty.append(reset);list.append(empty);return;}
  for(const token of filtered.slice(0,limit)){
   const row=node('article','market-row');row.dataset.mint=token.mint;
     const id=node('div','row-identity');id.append(art(token));const text=node('div','row-name'),sourcePair=node('p','market-pair-label',`${token.symbol} / ${token.quoteSymbol&&token.quoteSymbol!=='Unknown'?token.quoteSymbol:window.PadI18n?.t('Unknown quote')||'Unknown quote'}`);sourcePair.dataset.noTranslate='';text.append(node('h2','',token.name),sourcePair,node('p','',token.venue),badge(token));if(window.PadTokenAddress)text.append(window.PadTokenAddress(token));id.append(text);
   const star=node('button','row-watch',watch.has(token.mint)?'Saved':'Save');star.type='button';star.dataset.watchMint=token.mint;star.setAttribute('aria-label',`${star.textContent} ${token.symbol}${watch.has(token.mint)?' — activate to remove from watchlist':' to watchlist'}`);star.setAttribute('aria-pressed',String(watch.has(token.mint)));star.addEventListener('click',()=>{toggleWatch(token.mint);const target=[...$$('[data-watch-mint]')].find(el=>el.dataset.watchMint===token.mint)||$('[data-watch-mint]')||$('#watch-nav');target?.focus({preventScroll:true});});
   const metrics=node('dl','row-metrics');for(const [label,value,css] of [['Price USD',money(token.priceUsd),''],['24h',change(token.change24h),token.change24h==null?'':token.change24h<0?'negative':'positive'],['Market cap',money(token.marketCapUsd),''],['Pool liquidity',money(token.liquidityUsd),'']]){const item=node('div');item.append(node('dt','',label),node('dd',css,value));metrics.append(item);}
   const actions=node('div','row-actions'),pairs=node('div','pair-badges');
   if(token.pairedLeveragedMints?.length){for(const mint of token.pairedLeveragedMints)pairs.append(node('span','pair-badge x-pair',`${asset(mint)?.symbol||'x-asset'} quote pool`));}else pairs.append(node('span','pair-badge',`${token.quoteSymbol} source pool`));
   const trade=node('button','open-terminal','Open terminal →');trade.type='button';trade.addEventListener('click',()=>selectToken(token));actions.append(pairs,trade);row.append(id,star,metrics,actions);list.append(row);
  }
 }
 function syncCategories(){$$('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)));}
  function setView(next){const userNavigated=document.activeElement!==document.body;view=next;document.documentElement.dataset.view=next;$('#launchpad-view').hidden=next!=='launchpad';$('#markets-view').hidden=next!=='markets';$('#trade-view').hidden=next!=='trade';$('#paper-view').hidden=next!=='paper';$('#portfolio-view').hidden=next!=='portfolio';for(const [selector,active] of [['#launchpad-nav',next==='launchpad'],['#mobile-launchpad',next==='launchpad'],['#markets-nav',next==='markets'&&!watchOnly],['#watch-nav',next==='markets'&&watchOnly],['#terminal-nav',next==='trade'],['#paper-nav',next==='paper'],['#portfolio-nav',next==='portfolio'],['#mobile-markets',next==='markets'&&!watchOnly],['#mobile-watch',next==='markets'&&watchOnly],['#mobile-terminal',next==='trade'],['#mobile-paper',next==='paper'],['#mobile-portfolio',next==='portfolio']]){if(active)$(selector).setAttribute('aria-current','page');else $(selector).removeAttribute('aria-current');}if(!offline){const url=new URL(location.href);url.searchParams.set('view',next);url.searchParams.delete('mint');if(next==='trade'&&selected)url.searchParams.set('mint',selected.mint);history.replaceState(null,'',window.PadCleanUrl(url));}setBanner();window.scrollTo({top:0});if(userNavigated)$('#content').focus({preventScroll:true});}
 async function showPaper(mint,direction){
  stopPlugin();setView('paper');
  if(offline){$('#paper-root').replaceChildren(node('p','notice','Paper trading needs the running site and fresh source prices. No simulated fills are made against this downloaded snapshot.'));return;}
  if(!data&&!paperController){$('#paper-root').replaceChildren(node('p','notice','Load source markets first, then open Paper demo. No sample prices are substituted.'));return;}
  try{if(!paperController){const module=await import('/paper-ui.mjs');if(!paperController)paperController=module.mountPaper({target:$('#paper-root'),product:productId,market:data,preferredMint:mint,refreshMarkets:async()=>{await loadMarkets('',true);return data;}});}paperController.update(data,mint,direction);}
  catch{$('#paper-root').replaceChildren(node('p','notice error','Paper mode could not load. Refresh the page and try again. No wallet or real trade was requested.'));}
 }
 let widgetThemeTimer;
 function styleWidget(){
  clearInterval(widgetThemeTimer);let attempts=0;
  const apply=()=>{const host=$('#swap-widget-host');let found=false;for(const el of host.querySelectorAll('*')){if(!el.shadowRoot)continue;found=true;if(!el.shadowRoot.querySelector('[data-pad-geometry]')){const style=node('style');style.dataset.padGeometry='';style.textContent='*,*::before,*::after{border-radius:0!important}';el.shadowRoot.append(style);}}if(found||++attempts>=900)clearInterval(widgetThemeTimer);};
  widgetThemeTimer=setInterval(apply,100);apply();
 }
 function stopPlugin(){tradeIntent++;clearInterval(widgetThemeTimer);if(compactPaper){compactPaper.dispose();compactPaper=null;}if(directCleanup){directCleanup();directCleanup=null;}if(pluginActive&&window.Jupiter?.close){try{window.Jupiter.close();}catch{}}pluginActive=false;$('#swap-widget-host').classList.remove('plugin-mounted','compact-paper');}
 function resetSwapIntro(){
  stopPlugin();const target=$('#swap-widget-host');target.replaceChildren();const intro=node('div');intro.id='swap-intro';intro.append(node('h3','','Your wallet. Your approval.'),node('p','',offline?'This file is a captured design and market snapshot. Run the site on a secure origin to load real wallet-approved swaps.':'Load Jupiter’s official swap interface to check an executable route, fees, slippage and minimum received. No wallet signature is requested automatically.'));
  if(deployment)intro.querySelector('p').textContent='This pad’s own backend builds and simulates the route. Connect your wallet, review the minimum received, then approve separately. Nothing is signed automatically.';
  const button=node('button','primary',offline?'Live trading needs the running site':executionMode==='paper'?'Open paper demo':deployment?'Open wallet trade':'Load live swap');button.id='enable-trading';button.disabled=offline||!selected||(executionMode==='live'&&!window.isSecureContext);button.addEventListener('click',enableTrading);intro.append(button);const practice=node('button','','Try with demo funds');practice.type='button';practice.addEventListener('click',()=>showPaper(selected?.mint));intro.append(practice);if(!offline&&!window.isSecureContext)intro.append(node('p','','Wallet trading requires HTTPS or a local secure development origin.'));target.append(intro);$('#swap-status').textContent='';if(executionMode==='paper'&&!offline&&selected)queueMicrotask(enableTrading);
 }
 function setFunding(){
  const select=$('#funding-mint');select.replaceChildren();
  const options=[{mint:USDC,symbol:'USDC'},{mint:SOL,symbol:'SOL'},...registry.filter(a=>a.kind==='leveraged'),...(products[productId]?.seeds||[]).filter(a=>a.kind==='spot')];
  const seen=new Set();for(const option of options){if(seen.has(option.mint)||option.mint===selected?.mint)continue;seen.add(option.mint);const el=node('option','',option.symbol);el.value=option.mint;select.append(el);}
  if(!seen.has(funding))funding=seen.has(USDC)?USDC:[...seen][0];select.value=funding;
 }
 function swapContext(){if(!selected)return;$('#routing-mode').textContent=executionMode==='paper'?'PAPER · DEMO USD':'JUPITER ROUTING';$('#swap-context').textContent=executionMode==='paper'?`${selected.symbol} · Demo USD · No real tokens move. ${selected.assetClass==='leveraged'?'Variable leveraged long token.':'This coin is not inherently leveraged.'}`:`Initial route: ${side==='buy'?'buy':'sell'} ${selected.symbol} ${side==='buy'?'with':'for'} ${$('#funding-mint').selectedOptions[0]?.textContent||'the selected asset'}. Review the final route below. ${selected.assetClass==='leveraged'?'Leverage is variable.':'An x-asset quote pool does not make this token itself leveraged.'}`;$('#buy-side').setAttribute('aria-pressed',String(side==='buy'));$('#sell-side').setAttribute('aria-pressed',String(side==='sell'));}
 function renderTerminalList(){const list=$('#terminal-tokens');list.replaceChildren();const query=$('#terminal-filter').value.trim().toLowerCase();for(const token of (data?.tokens||[]).filter(token=>!query||`${token.symbol} ${token.name}`.toLowerCase().includes(query))){const button=node('button');button.type='button';if(token.mint===selected?.mint)button.setAttribute('aria-current','true');const identity=node('span','marketlist-identity');identity.append(art(token),node('span','',token.symbol));button.append(identity,node('small','',money(token.priceUsd)));button.addEventListener('click',()=>selectToken(token));list.append(button);}}
 function selectToken(token){
  selected=token;side='buy';funding=token.pairedLeveragedMints?.[0]||USDC;
  $('#selected-name').textContent=token.name;$('#selected-symbol').textContent=token.symbol;$('#selected-art').replaceChildren(art(token));
  $('#selected-price').textContent=money(token.priceUsd);$('#selected-change').textContent=change(token.change24h);$('#selected-change').className=token.change24h==null?'':token.change24h<0?'negative':'positive';
   $('#selected-liquidity').textContent=money(token.liquidityUsd);$('#selected-volume').textContent=money(token.volume24hUsd);$('#selected-quote').textContent=token.quoteSymbol;$('#selected-mint').textContent=token.mint;$('#mint-link').href=`https://solscan.io/token/${token.mint}`;$('#chart-link').href=token.sourceUrl;
   if(window.PadTokenAddress){let address=$('#selected-token-address');if(!address){address=node('div');address.id='selected-token-address';$('.selected-heading').after(address);}address.replaceChildren(window.PadTokenAddress(token));}
  $('#selected-class').className=`asset-badge ${token.assetClass}`;$('#selected-class').textContent=classLabel(token);
  const notices=[];if(token.assetClass==='leveraged')notices.push('Hylo leveraged token: variable exposure, not a fixed leverage promise. No margin calls does not mean no losses.');else notices.push('This token is not classified as a leveraged asset. A pool quoted in xBTC, xHYPE or xSOL does not change that.');
  if(token.association==='name-match')notices.push('Name-search match only. Ecosystem affiliation and collateral backing have not been established.');
  if(token.derivedPrice)notices.push('Displayed USD price is derived from this pool’s price ratio; no 24-hour return was inferred.');
  if(token.verification?.mintAuthorityPresent)notices.push('Mint authority is enabled.');if(token.verification?.freezeAuthorityPresent)notices.push('Freeze authority is enabled.');
  $('#asset-disclosure').textContent=notices.join(' ');
   const frame=$('#chart-frame');if(terminalShell&&!offline)terminalShell.select(token);else{frame.replaceChildren();frame.append(node('p','','Live charts need the running site. Open the source pool to view its actual chart.'));}
  updateWatchButton();setFunding();swapContext();resetSwapIntro();renderTerminalList();setView('trade');
 }
 async function loadPlugin(){
  if(window.Jupiter?.init)return;
  if(!pluginPromise)pluginPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://plugin.jup.ag/plugin-v1.js';script.setAttribute('data-preload','');script.referrerPolicy='no-referrer';const timer=setTimeout(()=>{script.remove();pluginPromise=null;reject(new Error('Jupiter’s swap interface did not load. Try again or use the official site.'));},25000);script.onload=()=>{clearTimeout(timer);if(window.Jupiter?.init)resolve();else{pluginPromise=null;reject(new Error('Jupiter’s swap interface is unavailable. Try again shortly.'));}};script.onerror=()=>{clearTimeout(timer);script.remove();pluginPromise=null;reject(new Error('Jupiter’s swap interface could not be reached. No transaction was created.'));};document.head.append(script);});
  return pluginPromise;
 }
 async function enableTrading(){
  if(offline||!selected||!MINT.test(selected.mint)||(executionMode==='live'&&(!window.isSecureContext||!MINT.test(funding))))return;
  const current=++tradeIntent;const button=$('#enable-trading');if(button)button.disabled=true;$('#swap-status').textContent=executionMode==='paper'?'Loading paper simulation…':'Loading Jupiter’s official wallet and swap interface…';
  try{
   if(executionMode==='paper'){const module=await import('/paper-ui.mjs');if(current!==tradeIntent)return;compactPaper=module.mountPaper({target:$('#swap-widget-host'),product:productId,market:data,preferredMint:selected.mint,compact:true,initialSide:side,refreshMarkets:async()=>{await loadMarkets('',true);return data;}});$('#swap-status').textContent='';return;}
   if(deployment?.execution==='monerochan-direct'){
    const adapter=await import('/direct-swap.js');if(current!==tradeIntent)return;
    const target=$('#swap-widget-host');directCleanup=adapter.mount({target,token:selected,fundingMint:funding,fundingSymbol:$('#funding-mint').selectedOptions[0]?.textContent||'tokens',side,deployment});$('#swap-status').textContent='Independent backend · User-signed transactions · No platform swap fee';return;
   }
   await loadPlugin();if(current!==tradeIntent)return;const target=$('#swap-widget-host');target.replaceChildren();target.classList.add('plugin-mounted');
   const mint=selected.mint,input=side==='buy'?funding:mint,output=side==='buy'?mint:funding;
   pluginActive=true;await window.Jupiter.init({displayMode:'integrated',integratedTargetId:'swap-widget-host',autoConnect:false,localStoragePrefix:`${productId}-jupiter`,containerStyles:{width:'100%',height:'520px',borderRadius:'0',overflow:'hidden'},formProps:{swapMode:'ExactInOrOut',initialInputMint:input,initialOutputMint:output,fixedMint:mint},onSwapError:()=>{$('#swap-status').textContent='Swap was not completed. Review the wallet or routing error before trying again.';},onSuccess:({txid})=>{const status=$('#swap-status');status.textContent='Jupiter reported a submitted swap. Verify its confirmation in the explorer.';if(typeof txid==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(txid)){const link=node('a','','View transaction on Solscan ↗');link.href=`https://solscan.io/tx/${txid}`;link.target='_blank';link.rel='noopener noreferrer';status.append(link);}}});
   if(current!==tradeIntent)return;styleWidget();
   $('#swap-status').textContent='Swap interface requested. Review Jupiter’s actual route and fees before approving anything in your wallet. No platform referral fee is configured.';
  }catch(error){if(current!==tradeIntent)return;resetSwapIntro();$('#swap-status').textContent=error.message;}
 }
  async function loadMarkets(query='',preserveView=false){
   if(!offline&&!launchpad){const module=await import('/launchpad.mjs');if(!launchpad)launchpad=module.mountLaunchpad({target:$('#launchpad-root'),product:productId,getMarket:()=>data,getMarketStatus:()=>marketStatus,products,getRegistry:()=>registry,onSelect:mint=>{const token=data?.tokens.find(token=>token.mint===mint);if(token)selectToken(token);},onPaper:showPaper,onPortfolio:showPortfolio,canTrade:()=>Boolean(deployment?.tradingConfigured),onLive:mint=>{const token=data?.tokens.find(token=>token.mint===mint);if(token){$('#global-live').click();selectToken(token);}},onRefresh:()=>loadMarkets('',true),onTerminal:()=>{const token=selected||data?.tokens.find(token=>token.mint===products[productId]?.preferredQuote)||data?.tokens[0];if(token)selectToken(token);}});}
   marketStatus={state:'loading'};launchpad?.update();
  const current=++requestId;$('#market-list').setAttribute('aria-busy','true');$('#market-error').hidden=true;$('#result-status').textContent='Loading source markets and verifying Solana mints…';for(const button of $$('#market-search-form button'))button.disabled=true;
  try{
   let body;
   if(offline){body=window.PAD_SNAPSHOT?.market;if(!body||!Array.isArray(body.tokens))throw new Error('No captured market data is available in this file. Run the site to load sources.');}
   else{const response=await fetch(`/api/scan?${new URLSearchParams({pad:productId,q:query})}`);body=await response.json();if(!response.ok)throw new Error(body.message||'Market data is unavailable. Try again shortly.');}
   if(current!==requestId)return;if(body.network!=='solana'||!Array.isArray(body.tokens))throw new Error('The market response is invalid. Try again shortly.');
   data={...body,tokens:body.tokens.filter(token=>MINT.test(token.mint)&&MINT.test(token.pair)&&token.verification)};marketStatus={state:'ready'};limit=20;renderRail();renderMarkets();renderTerminalList();setBanner();if(paperController)paperController.update(data);if(compactPaper)compactPaper.update(data,selected?.mint);terminalShell?.update();launchpad?.update();
   if(body.warnings?.length){$('#market-error').textContent=body.warnings.join(' ');$('#market-error').hidden=false;}
   const params=new URLSearchParams(location.search);if(!preserveView){const requested=params.get('view');if(requested==='paper')showPaper();else if(requested==='portfolio')showPortfolio();else if(requested==='markets')showMarkets(false);else if(requested==='trade'||offline){const token=data.tokens.find(t=>t.mint===params.get('mint'))||data.tokens.find(t=>t.mint===products[productId]?.preferredQuote)||data.tokens[0];if(token)selectToken(token);}else showLaunchpad();}
  }catch(error){if(current===requestId){data=null;marketStatus={state:'error'};selected=null;stopPlugin();if(paperController)paperController.update(null);terminalShell?.update();launchpad?.update();renderRail();renderTerminalList();$('#market-error').textContent=error.message;$('#market-error').hidden=false;$('#market-list').replaceChildren();$('#result-status').textContent='No live prices are substituted with sample data.';$('#token-count').textContent='—';if(!preserveView)setView(launchpad?'launchpad':'markets');}}
  finally{if(current===requestId){$('#market-list').setAttribute('aria-busy','false');for(const button of $$('#market-search-form button'))button.disabled=offline;}}
 }
  function showMarkets(onlyWatch=false){watchOnly=onlyWatch;limit=20;stopPlugin();setView('markets');renderMarkets();}
  function showLaunchpad(){if(offline){showMarkets(false);return;}stopPlugin();setView('launchpad');launchpad?.update();}
  function showPortfolio(){stopPlugin();setView('portfolio');if(offline)$('#portfolio-root').textContent='Wallet and portfolio APIs require the running site. This file is a source snapshot.';else terminalShell?.update();}
  for(const [parent,id] of [['.top>nav','launchpad-nav'],['.mobile-nav','mobile-launchpad']]){const button=node('button','','Launchpad');button.id=id;button.type='button';button.dataset.i18n='Launchpad';$(parent).prepend(button);}
  $('#brand-name').textContent=identity.name;$('#brand-symbol').textContent=identity.symbol;if(rektdPreview){const cat=node('img');cat.src='/assets/getrektd/announcer-avatar.webp';cat.alt='';cat.width=36;cat.height=36;$('#brand-symbol').append(cat);}$('#brand').href=rektdPreview?'/':href(productId);$('#market-title').textContent=identity.title;$('#market-subtitle').textContent=identity.description;$('#footer-brand').textContent=identity.name;document.title=rektdPreview?'HypurrLabs | HYPE-first pairs. Hosted by Rektd.':`${identity.name} · Solana trading terminal`;$('#product-picker').value=productId;
 $('#product-picker').addEventListener('change',event=>{location.href=href(event.target.value);});
 $('#market-search-form').addEventListener('submit',event=>{event.preventDefault();showMarkets(false);loadMarkets($('#market-search').value.trim());});$('#refresh-markets').addEventListener('click',()=>loadMarkets($('#market-search').value.trim()));
 $$('[data-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.category;limit=20;syncCategories();renderMarkets();}));$('#x-pair-only').addEventListener('change',()=>{limit=20;renderMarkets();});$('#market-sort').addEventListener('change',event=>{sort=event.target.value;renderMarkets();});$('#show-more').addEventListener('click',()=>{limit+=20;renderMarkets();});
  for(const selector of ['#markets-nav','#mobile-markets','#back-markets'])$(selector).addEventListener('click',()=>showMarkets(false));for(const selector of ['#watch-nav','#mobile-watch'])$(selector).addEventListener('click',()=>showMarkets(true));for(const selector of ['#terminal-nav','#mobile-terminal'])$(selector).addEventListener('click',()=>{if(selected)selectToken(selected);else if(data?.tokens[0])selectToken(data.tokens[0]);else{$('#market-error').textContent='Load a sourced market first, then open its terminal.';$('#market-error').hidden=false;$('#mode-banner').textContent='The desk needs a sourced market. Wait for loading to finish, or open Markets and retry the sources.';}});
 $('#favorite-selected').addEventListener('click',()=>{if(selected)toggleWatch(selected.mint);});$('#funding-mint').addEventListener('change',event=>{funding=event.target.value;swapContext();resetSwapIntro();});for(const [selector,direction] of [['#buy-side','buy'],['#sell-side','sell']])$(selector).addEventListener('click',()=>{side=direction;swapContext();resetSwapIntro();});
 for(const selector of ['#paper-nav','#mobile-paper'])$(selector).addEventListener('click',()=>showPaper());
 for(const selector of ['#portfolio-nav','#mobile-portfolio'])$(selector).addEventListener('click',showPortfolio);
  for(const selector of ['#launchpad-nav','#mobile-launchpad'])$(selector).addEventListener('click',()=>{showLaunchpad();launchpad?.showDiscover();});
  window.addEventListener('pad-open-create',()=>{showLaunchpad();if(launchpad)launchpad.showCreator();else{const url=new URL(location.href);url.searchParams.set('panel','create');location.href=url.href;}});
 $('#terminal-filter').addEventListener('input',renderTerminalList);
 window.addEventListener('pad-language-change',()=>{renderMarkets();renderRail();renderTerminalList();if(selected){$('#selected-price').textContent=money(selected.priceUsd);$('#selected-change').textContent=change(selected.change24h);$('#selected-liquidity').textContent=money(selected.liquidityUsd);$('#selected-volume').textContent=money(selected.volume24hUsd);}});
 setBanner();
 (async()=>{try{const config=offline?window.PAD_SNAPSHOT:await(await fetch('/api/products')).json();products=config.products||{};registry=config.assets||[];deployment=config.deployment||null;if(!products[productId])throw new Error('Product configuration is unavailable.');if(deployment){for(const option of [...$('#product-picker').options])if(!products[option.value])option.remove();$('#product-picker').disabled=true;$('.provider-link').href='https://developers.jup.ag/docs/swap';$('.provider-link').textContent='Jupiter route documentation ↗';}if(offline){$('#market-search').disabled=true;for(const button of $$('#market-search-form button,#global-paper,#global-live'))button.disabled=true;}else{const module=await import('/terminal-shell.mjs');terminalShell=module.mountTerminalShell({product:productId,getMarket:()=>data,deployment,refreshMarket:async()=>{await loadMarkets('',true);return data;},onSelect:async(mint,direction)=>{let token=data?.tokens.find(t=>t.mint===mint);if(!token){await loadMarkets(mint,true);token=data?.tokens.find(t=>t.mint===mint);}if(token){selectToken(token);if(direction==='sell')$('#sell-side').click();}else $('#mode-banner').textContent='No current source market is available for that wallet asset.';},onPaper:showPaper,onPortfolio:showPortfolio,onMode:mode=>{executionMode=mode;if(selected){swapContext();resetSwapIntro();}}});}await loadMarkets();}catch(error){$('#market-error').textContent=error.message;$('#market-error').hidden=false;$('#market-list').setAttribute('aria-busy','false');setView('markets');}})();
})();
