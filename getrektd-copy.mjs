import {locale,t} from './terminal-i18n.mjs';

// Owned English interface copy only. Never rewrite user content, source token
// identities, figures, transaction reviews, signing/consent or documentation.
export const REKTD_INTERFACE_COPY=Object.freeze({
 'Launchpad':'The stage',
 'Markets':'The trenches',
 'Terminal':'The trading desk',
 'Portfolio':'The receipts',
 'Watchlist':'Bad influences',
 'Paper demo':'Fake-money rehearsal',
 'Settings':'Fiddle with it',
 'Learn':'Remedial class',
 'Connect':'Connect, genius.',
 'Disconnect':'Disconnect wallet',
 'Color palette':'Pick a colour. It is not an edge.',
 'Theme':'Choose the lighting, genius.',
 'Discover coins':'The contestants',
 'Trade x-assets':'Trade the x-assets',
 'Create a token':'Create your bad idea',
 'Create a token ↗':'Create your bad idea ↗',
 'Explore coins':'Show me the damn coins',
 'Community spotlights':'The usual suspects',
 'All pools':'Every damn pool',
 'Leveraged assets':'x-assets. Read the label.',
 'Spot assets':'Spot. Not rocket science.',
 'Exotic quote pools':'Exotic quotes. Pay attention.',
 'Refresh':'Refresh, genius.',
 'Search these coins…':'Coin or mint, genius…',
 'Search this ecosystem or paste a Solana mint…':'Coin name or Solana mint. Use your words…',
 'Search sources':'Find the damn coin',
 'Show more pools':'More questionable choices',
 'Show more tokens':'More contestants',
 'Source pool':'Inspect the pool, genius',
 'Copy CA':'Copy CA. Correctly.',
 'Copied CA':'CA copied. Public address. Not your seed.',
 'Market coverage & risks':'The fine print you will pretend you read',
 'Partial source coverage · Details under Market coverage & risks.':'Some sources flaked. The fine print has the excuses.',
 'No sourced pools in this lane':'Nothing here. Try another damn filter.',
 'Try another lane or clear your search. Missing prices, artwork and market caps are never fabricated.':'Try another filter or clear the search. Missing data stays missing. We are not making up numbers to keep you entertained.',
 'Source pools unavailable. Refresh failed; no substitute prices were added.':'The sources flaked. Refresh failed. No, we did not invent prices for you.',
 'No source pools returned.':'The source returned nothing. Thrilling.',
 'Loading source pools…':'Interrogating the sources…',
 'Retry source pools':'Ask the sources again',
 'Open terminal':'Open the trading desk',
 'Token metadata':'Describe the alleged innovation',
 'Create your token.':'So you are the founder.',
 'Token name':'Name your bad idea',
 'Ticker':'Ticker. Keep it short.',
 'Description':'Explain the thesis. Try words.',
 'Quote pool':'What this thing trades against',
 'Token artwork':'Upload the alleged innovation',
 'Your next obsession…':'Name the thing. Not your life story…',
 'Tell the story behind your token…':'Explain why this needed to exist. We will wait…',
 'Review launch draft':'Check your questionable idea',
 'Save draft':'Save the damn draft',
 'Download draft JSON':'Download the draft. It is JSON, not magic.',
 'Back to coins':'Back to the contestants',
 'Fees & rewards ↓':'Fees. Yes, those. ↓',
 'LOCAL DRAFT · NOT PUBLISHED':'BROWSER DRAFT. NOT A FUCKING LAUNCH.',
 'Saving metadata stays in this browser. Publishing needs separate consent and wallet approval.':'Saved here, in this browser. Publishing still needs separate consent and wallet approval. Clicking is not a deployment strategy.',
 'Add metadata, artwork and fee allocation. Nothing publishes without your consent and wallet approval.':'Name it, upload the picture and choose your launch provider. Nothing publishes without your consent and wallet approval. Yes, you still have to read.',
 'Draft reviewed. Save it in this browser or download its JSON. This does not launch a token.':'Draft checked. Save it here or download the JSON. No token was launched. Browser storage is not a blockchain.',
 'Launch draft saved in this browser. No token was deployed.':'Draft saved here. Still not launched. Browser storage is not a blockchain.',
 'Draft changed. Review it again before saving or downloading.':'You changed the draft. Review it again. Yes, again.',
 'Draft JSON downloaded. No token was deployed.':'JSON downloaded. Still no token deployed. Astonishing how words mean things.',
 'Fees & rewards':'Fees. Your confidence is not legal tender.',
 'Token transfer tax':'Transfer tax. Read the number.',
 'Developer / holder split of collected tax':'Who gets the tax. Pick deliberately.',
 'Choose an allocation…':'Pick a split. We are not guessing…',
 'Choose explicitly; no allocation is selected by default.':'Pick it yourself. There is no silent default to blame later.',
 'Supply & quote raise target':'Supply and raise target. Actual numbers, please.',
 'Save fee settings':'Save the damn fee settings',
 'Fee settings changed. Save them to keep this local draft.':'You changed the fees. Save the settings. We are not telepathic.',
 'Fee settings saved in this browser. No upload, fee charge or transaction occurred.':'Fee settings saved here. No upload, charge or transaction. You configured it; you did not pay it.',
 'Saved fee settings restored. Review them before publishing.':'Your saved fee settings are back. Read them before publishing. Revolutionary, we know.',
 'Configure the token transfer-tax allocation here. Native creator trading fees are separate; their rewards funding adapter is not finished. Saving settings stays local and never charges a fee.':'Split the transfer tax here. Native creator trading fees are a different bucket, and their rewards adapter is not finished. Saving this is local and free. You are configuring it, not paying it.',
 'The tax rate is fixed, not an editable trading-fee slider. Protocol, platform and native creator trading fees are additional and require operator verification.':'The transfer-tax rate is fixed. This is not a trading-fee slider, genius. Protocol, platform and native creator trading fees are additional and still need operator verification.',
 'Recipient shares are immutable. Custom developer rows must sum to the selected developer share of 10,000 basis points of collected tax. Payouts are taxed again; gross allocation is not net receipts.':'These shares are immutable. That means no “my bad” button. Custom developer rows must total the selected developer share out of 10,000 basis points of collected tax. Payouts are taxed again. Gross is not what lands in the wallet.',
 'Live launches are paused. Review the operator details below.':'Real launches are OFF. The operator details below explain the holdup.',
 'Operator details (original language)':'Operator receipts. Original language.',
 'Preview · Real trades, publishing and rewards are paused.':'Show preview. Real trades, publishing and rewards are OFF. No money moves.',
 'Start with a draft. No wallet or payment needed.':'A draft. Not a transaction. No wallet or payment needed, genius.',
 'No open positions':'No positions on record. We do not invent a portfolio for the bit.',
 'No recorded trades':'No trades on record. No fan fiction either.',
 'Your wallet. Your approval.':'Your wallet. Read the damn request.',
 'Price details & refresh':'Price receipts. Actually look at them.',
 'Your practice holdings →':'Your fake-money receipts →',
 'How rewards will work':'The rewards bit. Currently not paying you.',
 'Rewards are not live. Nothing is accruing in this preview.':'Rewards are OFF. Nothing is accruing. The joke does not print money.',
 'Try with demo funds':'Rehearse with fake money',
 'View wallet holdings':'Show the wallet receipts',
});

const protectedContent='script,style,svg,code,input,textarea,[contenteditable],.education-dialog,.learn-dialog,.token-art,.launch-token-identity,.row-name,.selected-heading,.launch-draft-preview h3,.launch-draft-preview>p:not(.draft-quote),.launch-live-summary,.launch-live-status,#swap-widget-host,#swap-status,#selected-mint';
const candidates='button,a,label,summary,h1,h2,h3,p,span,strong,small,dt,option';
export function mountRektdCopy(root=document){
 const records=new WeakMap(),ariaRecords=new WeakMap();let scheduled=false;
 function apply(){
  scheduled=false;const english=locale()==='en',reverse=new Map(Object.keys(REKTD_INTERFACE_COPY).map(key=>[t(key),key]));
   for(const el of root.querySelectorAll(candidates)){
    if(el.closest('.launch-creator[data-layout="pump"]'))continue;
   if(el.children.length||el.closest(protectedContent))continue;
   const blocked=el.closest('[data-no-translate]');if(blocked&&!records.has(blocked))continue;
   const current=el.textContent.trim(),record=records.get(el),original=record&&current===record.rendered?record.original:Object.hasOwn(REKTD_INTERFACE_COPY,current)?current:reverse.get(current);
   if(!original)continue;
   const next=english?REKTD_INTERFACE_COPY[original]:t(original);records.set(el,{original,rendered:next});el.removeAttribute('data-i18n');el.dataset.noTranslate='';if(el.textContent!==next)el.textContent=next;
   if(el.hasAttribute('placeholder'))el.setAttribute('placeholder',next);
   const control=el.matches('button,a')?el:el.parentElement?.matches('button,a')?el.parentElement:null;
   if(control){const aria=control.getAttribute('aria-label'),saved=ariaRecords.get(control),base=saved&&aria===saved.written?saved.base:aria;if(base){const written=english?`${next} — ${t(base)}`:t(base);ariaRecords.set(control,{base,written});if(aria!==written)control.setAttribute('aria-label',written);}if(control.hasAttribute('title'))control.title=next;}
  }
  const banner=root.querySelector('#mode-banner');if(banner){for(const node of banner.childNodes){if(node.nodeType!==3)continue;const current=node.textContent.trim(),record=records.get(node),original=record&&current===record.rendered?record.original:Object.hasOwn(REKTD_INTERFACE_COPY,current)?current:reverse.get(current);if(!original)continue;const next=english?REKTD_INTERFACE_COPY[original]:t(original);records.set(node,{original,rendered:next});banner.dataset.noTranslate='';if(node.textContent!==next)node.textContent=next;}}
   for(const input of root.querySelectorAll('#launch-search,#market-search,#launch-name,#launch-description')){
    if(input.closest('.launch-creator[data-layout="pump"]'))continue;
   const key=input.id==='launch-search'?'Search these coins…':input.id==='market-search'?'Search this ecosystem or paste a Solana mint…':input.id==='launch-name'?'Your next obsession…':'Tell the story behind your token…';const next=english?REKTD_INTERFACE_COPY[key]:t(key);if(input.placeholder!==next)input.placeholder=next;
  }
 }
 const update=()=>{if(!scheduled){scheduled=true;queueMicrotask(apply);}};
 const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true,characterData:true});window.addEventListener('pad-language-change',update);apply();
 return {update,dispose(){observer.disconnect();window.removeEventListener('pad-language-change',update);}};
}
