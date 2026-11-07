import { mount as mountSwap } from '../backend/client.mjs';
import { mountPumpCreator } from '../backend/pump-creator.mjs';
import { combineMarkets, elysiumMarket, marketDirectory, marketHref, marketIntro, solanaMarket, tokenSummary } from './market-directory.mjs';
import { locale, t } from './i18n.mjs';
const apiBase = '/api/purrlysium/solana';
const json = async path => {
  const response = await fetch(`${apiBase}/${path}`, { signal: AbortSignal.timeout(60000) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Solana service unavailable.');
  return value;
};
const money = value => value == null ? 'Unknown' : new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD', maximumSignificantDigits: 5 }).format(value);
export async function mountSolana(target, { h, tab, account, getWallet, isCurrent, openTrade, token, query = '', tokenAddress, marketMode = 'solana' }) {
  let cleanup = null;
  const panel = h('section', { class: 'ely-card purr-solana' }, h('h1', {}, `${({ markets: 'Markets', create: 'Create a coin', trade: 'Trade', portfolio: 'Portfolio' })[tab]} on Solana`));
  target.replaceChildren(panel);
  const status = await json('status');
  if (!isCurrent()) return;
  const missing = tab === 'create' ? status.launch : tab === 'trade' ? status.trade : tab === 'portfolio' ? status.balances : [];
  if (missing.length) panel.append(h('p', { class: 'ely-bad', role: 'status' }, `${tab === 'portfolio' ? 'Balances are' : tab === 'create' ? 'Publishing is' : 'Trading is'} unavailable. Hypeliysium’s Solana configuration is incomplete.`),
    h('details', { class: 'purr-config' }, h('summary', {}, 'Exact operator prerequisites'), h('ul', {}, ...missing.map(key => h('li', {}, key)))));
  panel.append(h('details', { class: 'purr-form-details' }, h('summary', {}, 'Network details'), h('p', { class: 'ely-muted' }, 'Solana mainnet. No bridging occurs when you change chains. Wallet disconnect removes this site’s session; wallet permissions and on-chain approvals may remain.')));
  if (tab === 'trade' && tokenAddress && !token) {
    const data = await json(`scan?q=${encodeURIComponent(tokenAddress)}`);
    if (!isCurrent()) return;
    token = data.tokens.find(row => row.mint === tokenAddress);
    if (!token) { panel.append(h('p', { class: 'ely-bad' }, 'This Solana mint was not returned by the verified market scanner. Choose a listed market; no trade was prepared.')); return; }
  }
  if (tab === 'create') {
    const products = await json('products');
    if (!isCurrent()) return;
    const fields = {};
    const form = h('div', { class: 'purr-solana-fields' });
    const optional = h('details', { class: 'purr-form-details' }, h('summary', {}, 'Optional details'));
    for (const [key, label, max] of [['name', 'Name', 32], ['symbol', 'Symbol', 10], ['description', 'Description (optional)', 280]]) {
      const input = h(key === 'description' ? 'textarea' : 'input', { id: `sol-${key}`, name: key, autocomplete: 'off', maxlength: max }); fields[key] = input;
      (key === 'description' ? optional : form).append(h('label', { for: input.id }, label), input);
    }
    const image = h('input', { id: 'sol-artwork', type: 'file', accept: 'image/png,image/jpeg,image/webp' });
    let artwork = '', artworkIntent = 0;
    image.addEventListener('change', async () => {
      artwork = ''; const intent = ++artworkIntent, file = image.files[0];
      if (!file) return;
      if (file.size > 8_000_000) { image.setCustomValidity(t('Choose artwork smaller than 8 MB.')); image.reportValidity(); return; }
      image.setCustomValidity('');
      const result = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Artwork could not be read.')); reader.readAsDataURL(file); }).catch(() => '');
       if (isCurrent() && intent === artworkIntent) { artwork = result; updatePreview(); creator.update(); }
    });
      form.prepend(h('label', { for: image.id, class:'hlys-upload' },h('strong',{},'Give your coin a face'),h('span',{},'Choose PNG, JPG or WebP · up to 8 MB'),image));
      const quote = h('select', { id: 'sol-quote' }, ...products.deployment.quoteAssets.map(asset => h('option', { value: asset.mint }, asset.symbol)));
      let explicitQuote = false;
      quote.value = '';
      quote.addEventListener('change', () => { explicitQuote = true; });
     const previewImage = h('div', { class: 'solana-preview-art', 'aria-hidden': 'true' }, h('span', {}, 'Artwork preview'));
     const previewName = h('h2', {}, 'Your coin name');
     const previewSymbol = h('p', { class: 'solana-preview-symbol' }, 'TICKER');
     const previewQuote = h('p', { class: 'ely-muted' }, 'Quote asset · Solana');
     const preview = h('aside', { class: 'solana-live-preview', 'aria-label': 'Live coin preview' }, previewImage, h('div', { class: 'solana-preview-copy' }, h('span', { class: 'market-eyebrow' }, 'Solana adapter preview'), previewName, previewSymbol, previewQuote, h('small', {}, 'Preview uses only entered values. No market data is inferred.')));
     const updatePreview = () => {
       previewName.textContent = fields.name.value.trim() || 'Your coin name';
       previewSymbol.textContent = fields.symbol.value.trim().toUpperCase() || 'TICKER';
        previewQuote.textContent = `${quote.options[quote.selectedIndex]?.textContent || 'Quote asset'} pair · Solana`;
       previewImage.replaceChildren(artwork ? h('img', { src: artwork, alt: '' }) : h('span', {}, 'Artwork preview'));
       preview.classList.remove('is-updating'); requestAnimationFrame(() => preview.classList.add('is-updating'));
     };
     const advanced = h('details', { class: 'purr-form-details' }, h('summary', {}, 'Advanced settings'), h('label', { for: quote.id }, 'Quote asset'), quote);
    const initial = h('input', { id: 'sol-initial-buy', value: '0', readonly: true, 'aria-describedby': 'sol-initial-note' });
    form.append(h('label', { for: initial.id }, 'Initial buy · not included'), initial, h('small', { id: 'sol-initial-note' }, 'No initial purchase. SOL covers network fees; the quote asset sets your market pair.'));
      const review = h('div',{class:'hlys-launch-review'});
      const workspace=h('div',{class:'hlys-create-form'},form,optional,advanced,review);
      panel.append(h('p',{class:'hlys-create-intro'},'Make it yours. Add artwork, choose a name, then review every detail before your wallet opens.'),h('div', { class: 'solana-create-layout' },workspace,preview));
    // Account-scoped pending records survive switches, but unsent drafts do not.
     const creator = mountPumpCreator({ target: review, product: status.product, apiBase,
      getQuoteMint: () => quote.value,
      onQuotes: quotes => { if (!explicitQuote) { const admitted = quotes.filter(q => q.admitted && q.admissionVerified && q.launchSupported); quote.value = (admitted.find(q => q.mint === products.deployment.preferredQuote) || admitted[0])?.mint || ''; updatePreview(); } },
      storageNamespace: `purrlysium.solana.${account || 'disconnected'}`, getWallet, isActive: isCurrent, compact: true, hasAccount: () => Boolean(account),
      getDraft: () => fields.name.value.trim() && fields.symbol.value.trim() && artwork ? { name: fields.name.value.trim(), symbol: fields.symbol.value.trim(), description: fields.description.value.trim(), image: artwork, quoteMint: quote.value } : null });
     form.addEventListener('input', () => { updatePreview(); creator.update(); }); form.addEventListener('change', () => { updatePreview(); creator.update(); });
     optional.addEventListener('input', creator.update); advanced.addEventListener('change', () => { updatePreview(); creator.update(); });
     updatePreview();
    cleanup = () => creator.destroy();
  } else if (tab === 'portfolio') {
    if (!account) { panel.append(h('p', {}, 'Connect your Solana wallet to read its balances and transaction history.')); return; }
    panel.append(h('p', { class: 'purr-address' }, account));
    if (missing.length) { panel.append(h('p', {}, 'Balances and transaction history will appear after a dedicated Solana RPC is configured. No balance is assumed to be zero.')); return; }
    const results = await Promise.allSettled([json(`portfolio?wallet=${encodeURIComponent(account)}`), json(`wallet/history?wallet=${encodeURIComponent(account)}`)]);
    if (!isCurrent()) return;
    const [balances, history] = results;
    if (balances.status === 'fulfilled') {
      panel.append(h('h3', {}, 'Tracked balances'), h('p', {}, balances.value.notice));
      const list = h('ul');
      for (const row of balances.value.positions) { const raw = row.quantityUnits.padStart(row.decimals + 1, '0'); const amount = row.decimals ? `${raw.slice(0, -row.decimals)}.${raw.slice(-row.decimals)}` : raw; list.append(h('li', {}, `${row.symbol}: ${amount}`)); }
      panel.append(list, h('p', {}, `${balances.value.untrackedMintCount} untracked mints. Native and wrapped SOL may be combined.`));
    } else panel.append(h('p', { class: 'ely-bad' }, balances.reason.message));
    panel.append(h('h3', {}, 'Transaction history'));
    if (history.status === 'fulfilled') panel.append(h('p', {}, history.value.coverage), h('ul', {}, ...history.value.history.map(row => h('li', {}, h('a', { href: row.sourceUrl || `https://solscan.io/tx/${row.signature}`, target: '_blank', rel: 'noopener noreferrer' }, `${row.status} · ${row.signature}`)))), history.value.history.length ? null : h('p', {}, 'No transactions returned for this address.'));
    else panel.append(h('p', { class: 'ely-bad' }, history.reason.message));
  } else if (tab === 'trade' && token) {
    const { deployment } = await json('products');
    if (!isCurrent()) return;
    const notices = [...panel.children].filter(node => node.tagName !== 'H1');
    panel.replaceChildren(tokenSummary(h, solanaMarket(token), 'solana', `https://solscan.io/token/${token.mint}`));
    const history = h('section', { class: 'market-history' }, h('h2', {}, 'Chart and transaction activity'), h('p', { class: 'ely-muted' }, 'This scanner provides a market snapshot, not a verified candle series or token trade feed. Open the market source for its chart and activity. Holder counts are unavailable.'));
    if (token.sourceUrl && /^https:\/\/dexscreener\.com\/solana\//.test(token.sourceUrl)) history.append(h('a', { class: 'ely-btn', href: token.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open market chart and activity'));
    const trading = h('section', { class: 'market-trade-panel' }, h('h2', {}, 'Buy / Sell'), ...notices);
    panel.append(h('div', { class: 'market-detail-grid' }, history, trading));
    const side = h('select', { id: 'sol-side' }, h('option', { value: 'buy' }, 'Buy'), h('option', { value: 'sell' }, 'Sell'));
    const funding = h('select', { id: 'sol-funding' }, ...deployment.quoteAssets.map(asset => h('option', { value: asset.mint }, asset.symbol)));
    const trade = h('div'); trading.append(h('label', { for: side.id }, 'Direction'), side, h('label', { for: funding.id }, 'Funding asset'), funding, trade);
    const mount = () => { cleanup?.(); cleanup = mountSwap({ target: trade, token, deployment, apiBase, getWallet, showBalance: true, storageNamespace: `purrlysium.solana.${account || 'disconnected'}`, side: side.value, fundingMint: funding.value, fundingSymbol: deployment.quoteAssets.find(a => a.mint === funding.value).symbol }); };
    side.addEventListener('change', mount); funding.addEventListener('change', mount); mount();
  } else {
    panel.replaceChildren(marketIntro(h, 'solana'));
    const results = h('div', {}, h('p', { role: 'status' }, 'Loading market snapshot…')); panel.append(results);
     const scanSolana = async text => { const data = await json(`scan?q=${encodeURIComponent(text)}`); return { rows: data.tokens.map(row => ({ ...solanaMarket(row), chain: 'solana' })), checkedAt: data.checkedAt, partial: data.partial }; };
     const scanElysium = async () => { const response = await fetch('/api/purrlysium/elysium-coins', { signal: AbortSignal.timeout(8000) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Elysium discovery unavailable.'); return { rows: (data.coins || []).map(elysiumMarket), checkedAt: data.checkedAt || null, partial: Boolean(data.partial) }; };
     const searchRemote = async text => {
       const sources = marketMode === 'all' ? [['Solana', scanSolana(text)], ['Elysium', scanElysium()]] : [['Solana', scanSolana(text)]];
       const wanted = await Promise.all(sources.map(async ([name, promise]) => { try { return { name, status: 'fulfilled', value: await promise }; } catch (reason) { return { name, status: 'rejected', reason }; } }));
       const good = wanted.filter(result => result.status === 'fulfilled').map(result => ({ ...result.value, name: result.name }));
       const failed = wanted.filter(result => result.status === 'rejected');
       if (!good.length) throw new Error(failed.map(result => result.reason.message).join(' '));
       return { rows: combineMarkets(...good.map(result => result.rows)), checkedAt: good.map(result => result.checkedAt).filter(Boolean).sort().at(-1) || null, partial: failed.length > 0 || good.some(result => result.partial), coverageNote: failed.length ? `${failed.map(result => result.name).join(' and ')} unavailable; ${good.map(result => result.name).join(' and ')} adapter active.` : 'Solana and Elysium adapters active; native units stay separate.' };
     };
     const load = async () => { try { const data = await searchRemote(query); if (isCurrent()) marketDirectory(results, { h, chain: marketMode === 'all' ? 'all' : 'solana', ...data, current: isCurrent, searchRemote, open: row => row.chain === 'solana' ? openTrade(row.original) : location.href = marketHref('elysium', 'trade', row.address) }); } catch (error) { if (isCurrent()) results.replaceChildren(h('p', { role: 'alert' }, error.message), h('button', { class: 'ely-btn', onclick: load }, 'Retry markets')); } };
    await load();
  }
  return () => cleanup?.();
}
