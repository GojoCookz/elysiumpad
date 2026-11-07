import {tokenArt} from './token-art.mjs';
import {mountPaper} from './paper-ui.mjs';
import {moneyText,QUOTE_MAX_AGE_MS} from './paper-ledger.mjs';
import {connectedWallet,connectTerminalWallet} from './terminal-shell.mjs';
import {locale} from './terminal-i18n.mjs';
const n=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
const format=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat(locale(),{style:'currency',currency:'USD',maximumSignificantDigits:5}).format(value):'Price unavailable';
export const ENTRY_COPY=Object.freeze({title:'Small stack. Big energy.',risk:'Variable leverage. Real downside. No promised returns.',rewards:'Rewards are not live. Nothing is accruing in this preview.'});
export function entryAssets(products,product){return (products[product]?.seeds||[]).filter(a=>a.kind==='leveraged').sort((a,b)=>['bitcoin','solana','hyper'].indexOf(a.ecosystem)-['bitcoin','solana','hyper'].indexOf(b.ecosystem));}
export function mountSimpleEntry({target,product,products,getMarket,getMarketStatus,onRefresh,onPaper,onPortfolio,onCreate,onExplore,onLive,canTrade=()=>false}){
 const assets=entryAssets(products,product);let selected=products[product]?.preferredQuote||assets[0]?.mint,mode='practice',paper=null,mountedMint=null;
 const hero=n('section','entry-hero');hero.setAttribute('aria-labelledby','entry-title');
 const intro=n('div','entry-story'),eyebrow=n('p','entry-kicker','LEVERAGE, MINUS THE CONTROL ROOM.'),title=n('h1','entry-title');title.id='entry-title';title.append(document.createTextNode('Small stack.'),n('span','','Big energy.'));
 const description=n('p','entry-description','Actual leveraged tokens. Pick a ride. Practice before real money.');
 if(assets.length===1)description.textContent=`Choose your amount. Explore ${assets[0].symbol}, the actual variable leveraged token—not a meme paired with it.`;
 const steps=n('ol','entry-steps');for(const [label,detail]of [['Pick your exposure','The actual x-token.'],['Choose your amount','Practice first. No wallet needed.'],['Review before you commit','You stay in control.']]){const li=n('li');li.append(n('strong','',label),n('span','',detail));steps.append(li);}
 const aside=n('p','entry-meme','Small-stack chads. Big x energy.');intro.append(eyebrow,title,description,steps,aside);
 const ticket=n('section','entry-ticket');ticket.setAttribute('aria-label','Simple trade entry');
 const ticketHeading=n('div','entry-ticket-heading');ticketHeading.append(n('h2','','Pick your ride.'),n('span','entry-chain','ON SOLANA'));
 const modes=n('div','entry-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','Simple entry account mode');const practice=n('button','','Practice'),live=n('button','','Wallet');practice.type=live.type='button';practice.setAttribute('aria-pressed','true');live.setAttribute('aria-pressed','false');modes.append(practice,live);
 const choices=n('div','entry-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Choose leveraged asset');
 const choiceButtons=assets.map(asset=>{const b=n('button','entry-choice');b.type='button';b.dataset.entryMint=asset.mint;b.append(tokenArt(asset,{size:28}),n('strong','',({bitcoin:'Bitcoin',solana:'SOL',hyper:'HYPE'})[asset.ecosystem]||asset.symbol),n('small','',asset.symbol));b.addEventListener('click',()=>{selected=asset.mint;update();});choices.append(b);return b;});
 const selectedRow=n('div','entry-selected'),selectedArt=n('div'),selectedText=n('div'),selectedName=n('strong'),selectedKind=n('span','','Variable leveraged long token'),price=n('span','entry-price');selectedText.append(selectedName,selectedKind);selectedRow.append(selectedArt,selectedText,price);
 const accountRow=n('div','entry-account'),accountType=n('span'),balance=n('strong');accountRow.append(accountType,balance);
 const demo=n('div','entry-paper'),wallet=n('div','entry-wallet');wallet.hidden=true;
 const walletCopy=n('p'),connect=n('button','primary','Connect wallet'),holdings=n('button','entry-text-button','View wallet holdings'),walletReview=n('button','primary','Open wallet review');connect.type=holdings.type=walletReview.type='button';
 const walletStatus=n('p','entry-feedback');walletStatus.setAttribute('role','status');wallet.append(walletCopy,connect,walletReview,holdings,walletStatus);
 const presets=n('div','entry-presets');presets.setAttribute('role','group');presets.setAttribute('aria-label','Practice spend presets');for(const amount of ['25','100','250']){const button=n('button','',`${amount} Demo USD`);button.type='button';button.addEventListener('click',()=>paper?.setAmount(amount));presets.append(button);}
 const status=n('p','entry-source-status');status.setAttribute('role','status');const retry=n('button','entry-text-button','Refresh prices');retry.type='button';retry.addEventListener('click',async()=>{retry.disabled=true;try{await onRefresh();}catch{status.textContent='Prices could not refresh. Try again; no sample price is substituted.';}finally{retry.disabled=false;update();}});
 const costs=n('p','entry-cost-note','Demo costs: 0.30% fee + 0.10% adverse slippage.'),risk=n('p','entry-risk',ENTRY_COPY.risk);
 const manage=n('button','entry-text-button','Your practice holdings →');manage.type='button';manage.addEventListener('click',()=>onPaper(selected));
 ticket.append(ticketHeading,modes,choices,selectedRow,accountRow,presets,demo,wallet,status,retry,costs,manage,risk);hero.append(intro,ticket);
 const next=n('div','entry-next');next.append(n('p','','Your wallet is your balance. There is no separate pad deposit.'));const links=n('div','entry-next-actions');for(const [label,action]of [['Explore community coins',onExplore],['Create a token',onCreate]]){const b=n('button','entry-text-button',label+' ↗');b.type='button';b.addEventListener('click',action);links.append(b);}next.append(links);
 const community=n('section','entry-community');community.setAttribute('aria-label','Community rewards status');const communityIntro=n('div');communityIntro.append(n('p','entry-kicker','FOR THE SMALL-STACK CROWD.'),n('h2','','Chad energy. Clear rules.'),n('p','',ENTRY_COPY.rewards));
 const rewardDetails=n('details','entry-reward-details'),summary=n('summary','','How rewards will work');rewardDetails.append(summary,n('p','','A separately disclosed share of collected revenue can fund community rewards. Holder eligibility and trading-volume eligibility are different policies. The launch creator must approve the applicable policy.'),n('p','','Payout asset, costs and available funding must be shown before activation. No guaranteed payout, token price or protection against losses.'));community.append(communityIntro,rewardDetails);target.replaceChildren(hero,next,community);
 function showMode(next){mode=next;practice.setAttribute('aria-pressed',String(mode==='practice'));live.setAttribute('aria-pressed',String(mode==='wallet'));update();}
 practice.addEventListener('click',()=>showMode('practice'));live.addEventListener('click',()=>showMode('wallet'));
 connect.addEventListener('click',async()=>{connect.disabled=true;try{await connectTerminalWallet();walletStatus.textContent='Wallet connected for viewing. No signature requested and no funds deposited.';}catch(e){walletStatus.textContent=e.message;}finally{connect.disabled=false;update();}});
 holdings.addEventListener('click',onPortfolio);walletReview.addEventListener('click',()=>onLive(selected));
 function updateBalance(){const state=paper?.summary();balance.textContent=mode==='practice'?state?`${new Intl.NumberFormat(locale(),{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(moneyText(state.cashMicro)))} Demo USD`:'Demo balance unavailable':connectedWallet()?'Connected · view holdings':'Not connected';}
 function update(){
  const market=getMarket(),source=getMarketStatus(),asset=assets.find(a=>a.mint===selected)||assets[0],token=market?.tokens?.find(t=>t.mint===asset?.mint&&t.assetClass==='leveraged'),ready=Boolean(token?.verification&&typeof token.priceUsd==='number'&&Number.isFinite(token.priceUsd)&&token.priceUsd>0);
  selectedName.textContent=asset?.symbol||'No supported asset';selectedArt.replaceChildren(...(asset?[tokenArt(token||asset,{size:38})]:[]));price.textContent=format(token?.priceUsd);
  for(const button of choiceButtons){button.setAttribute('aria-pressed',String(button.dataset.entryMint===selected));const identity=market?.tokens?.find(t=>t.mint===button.dataset.entryMint)||assets.find(a=>a.mint===button.dataset.entryMint);if(identity)button.querySelector('.token-art')?.replaceWith(tokenArt(identity,{size:28}));}
  accountType.textContent=mode==='practice'?'PRACTICE · NO REAL MONEY':'YOUR SOLANA WALLET · REAL ASSETS';demo.hidden=mode!=='practice';wallet.hidden=mode!=='wallet';presets.hidden=costs.hidden=manage.hidden=mode!=='practice';
  if(ready&&(!paper||mountedMint!==asset.mint)){
   paper?.dispose();mountedMint=asset.mint;paper=mountPaper({target:demo,product,market,preferredMint:asset.mint,refreshMarkets:onRefresh,compact:true,simple:true,idPrefix:'entry-paper'});
   const form=demo.querySelector('.paper-order'),details=n('details','entry-cost-details'),summary=n('summary','','Price details & refresh');details.append(summary);for(const selector of ['.paper-source','.paper-assumptions','.paper-refresh']){const el=demo.querySelector(selector);if(el)details.append(el);}form.append(details);form.querySelector('input').after(presets);
  }else if(ready&&paper)paper.update(market,asset.mint);
  else if(!ready){paper?.dispose();paper=null;mountedMint=null;demo.replaceChildren(n('p','entry-unavailable',source.state==='loading'?'Loading the actual token price…':'This token’s source price is unavailable. Refresh prices or choose another exposure.'));}
  presets.querySelectorAll('button').forEach(b=>{b.disabled=!paper;});
  connect.hidden=Boolean(connectedWallet());holdings.hidden=!connectedWallet();walletReview.hidden=!canTrade();walletReview.disabled=!ready||!connectedWallet();
  walletCopy.textContent=canTrade()?'Real token swaps require your wallet approval. Open the wallet ticket to choose a funding asset and inspect actual fees and minimum received.':'Wallet trading is paused in this preview. You can connect to view holdings, or switch to Practice. No deposit is needed.';
  const time=Date.parse(market?.checkedAt),stale=ready&&(!Number.isFinite(time)||time>Date.now()+5000||Date.now()-time>QUOTE_MAX_AGE_MS);
  status.textContent=source.state==='error'?'Source refresh failed. No replacement prices are invented.':source.state==='loading'?'Checking source prices…':stale?'Prices expired. Refresh before reviewing a practice buy.':market?.partial?'Partial market coverage. Missing prices stay unavailable.':'';
  retry.hidden=ready&&!stale&&source.state!=='error';updateBalance();
 }
 window.addEventListener('pad-paper-updated',updateBalance);window.addEventListener('pad-wallet-change',update);update();
 return {update,dispose(){paper?.dispose();window.removeEventListener('pad-paper-updated',updateBalance);window.removeEventListener('pad-wallet-change',update);}};
}
