import {PublicKey} from '@solana/web3.js';

export function creatorWalletAddress(value, mint) {
  let key;
  try { key = new PublicKey(value); } catch { throw new Error('Enter a valid Solana creator wallet address.'); }
  if (!PublicKey.isOnCurve(key.toBytes()) || key.equals(PublicKey.default)) throw new Error('Creator fee recipient must be a normal Solana wallet, not a program address.');
  if (mint && key.toBase58() === mint) throw new Error('Creator fee recipient cannot be the new token mint.');
  return key.toBase58();
}

export function resolveCreatorWallet(draft, signer, mint) {
  if (draft.creatorMode && !['self', 'wallet'].includes(draft.creatorMode)) throw new Error('Choose a supported creator wallet option.');
  return creatorWalletAddress(draft.creatorMode === 'wallet' ? draft.creatorAddress : signer, mint);
}

export function creatorWalletControls(h, signer, changed) {
  const key = 'hyperlysium.solana.creatorRecipient.v1';
  let saved = {};
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); if (value && ['self','wallet'].includes(value.mode) && typeof value.address === 'string') saved = value; } catch {}
  const mode = h('select', {id:'sol-creator-mode'}, h('option',{value:'self'},'Connected wallet'),h('option',{value:'wallet'},'Different creator wallet'));
  mode.value = saved.mode || 'self';
  const address = h('input',{id:'sol-creator-address',name:'creatorAddress',type:'text',autocomplete:'off',spellcheck:'false',value:saved.address || '',placeholder:'Solana wallet address','aria-describedby':'sol-creator-error'});
  const error = h('p',{id:'sol-creator-error',role:'status',class:'ely-bad'});
  const custom = h('div',{class:'creator-custom-wallet'},h('label',{for:address.id},'Creator fee recipient'),address,error);
  const recipient = h('dd');
  const panel = h('section',{class:'creator-wallet-options','aria-label':'Creator wallets'},h('h2',{},'Creator wallets'),
    h('p',{},'The signing wallet pays network fees and deploys the coin. The creator wallet receives the 3% buy / sell creator fee.'),
    h('dl',{class:'creator-wallet-roles'},h('div',{},h('dt',{},'Signing wallet / deployer'),h('dd',{},signer || 'Not connected')),h('div',{},h('dt',{},'Creator fee recipient'),recipient)),
    h('button',{class:'ely-btn',type:'button',onclick:()=>document.querySelector('.purr-wallet-picker')?.click()},'Choose signing wallet'),
    h('label',{for:mode.id},'Send creator fees to'),mode,custom,
    h('p',{class:'ely-muted'},'Holder pledges and creator-signed holder payouts are not available in this launch mode. No automatic holder distribution is enabled.'));
  function update(persist = false) {
    custom.hidden = mode.value !== 'wallet';
    let message = '';
    try { if (mode.value === 'wallet') creatorWalletAddress(address.value.trim()); } catch (e) { message = e.message; }
    error.textContent = message; address.setCustomValidity(message); address.setAttribute('aria-invalid',String(Boolean(message)));
    recipient.textContent = mode.value === 'wallet' ? address.value.trim() || 'Enter a recipient above' : signer || 'Connected wallet at review';
    if (persist) { try { localStorage.setItem(key,JSON.stringify({mode:mode.value,address:address.value.trim()})); } catch {} changed(); }
  }
  mode.addEventListener('change',()=>update(true));address.addEventListener('input',()=>update(true));update();
  return {panel, read:()=>({creatorMode:mode.value,creatorAddress:address.value.trim()}), valid:()=>mode.value==='self'||!address.validationMessage};
}
