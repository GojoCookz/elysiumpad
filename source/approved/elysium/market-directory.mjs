import { routeURL } from './routes.mjs';
import { locale } from './i18n.mjs';
import { marketLayoutControls } from './market-layout.mjs';

export const metric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
export const numberLabel = value => metric(value) === null ? 'Unavailable' : new Intl.NumberFormat(locale(), { maximumSignificantDigits: 5, notation: Math.abs(value) >= 100000 ? 'compact' : 'standard' }).format(value);
export const changeLabel = value => metric(value) === null ? 'Unavailable' : new Intl.NumberFormat(locale(), { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(Number(value) / 100);
export function selectMarkets(rows, { query = '', sort = 'volume', pair = '', watched = false } = {}) {
  const q = query.trim().toLowerCase();
  const key = { volume: 'volume', cap: 'cap', price: 'price', change: 'change' }[sort] || 'volume';
  return rows.filter(row => (!q || [row.name, row.symbol, row.address].some(v => String(v || '').toLowerCase().includes(q))) && (!pair || row.pair === pair) && (!watched || row.watched)).sort((a, b) => {
    const x = metric(a[key]), y = metric(b[key]);
    return x === null ? y === null ? a.symbol.localeCompare(b.symbol) : 1 : y === null ? -1 : y - x || a.symbol.localeCompare(b.symbol);
  });
}
export function solanaMarket(row) {
  return { address: row.mint, name: row.name, symbol: row.symbol, image: row.image, pair: row.quoteSymbol || '', price: metric(row.priceUsd), change: metric(row.change24h), cap: metric(row.marketCapUsd), volume: metric(row.volume24hUsd), holders: null, series: [], unit: 'USD', original: row };
}
export function elysiumMarket(row) {
  return { address: row.token, name: row.name, symbol: row.symbol, image: row.image || '', pair: row.pair || 'WHYPE', price: metric(row.price), change: metric(row.change), cap: metric(row.mcap), volume: metric(row.vol), holders: null, series: Array.isArray(row.spark) ? row.spark : [], unit: 'HYPE', chain: 'elysium', original: row };
}
export function combineMarkets(...groups) {
  return groups.flatMap(group => Array.isArray(group) ? group : []).filter(row => row?.address && row?.chain).sort((a, b) => `${a.chain}:${a.symbol}`.localeCompare(`${b.chain}:${b.symbol}`));
}
export function marketHref(chain, section, token) {
  return routeURL(location.href, { chain, section, token, skin: document.documentElement.dataset.host === 'hypurrheaven' && document.documentElement.dataset.standalone !== 'angel' });
}
const amount = (value, unit) => metric(value) === null ? 'Unavailable' : `${unit === 'USD' ? '$' : ''}${numberLabel(value)}${unit === 'USD' ? '' : ` ${unit}`}`;
const safeImage = value => { try { const url = new URL(value, location.origin); return url.protocol === 'https:' || url.origin === location.origin ? url.href : ''; } catch { return ''; } };
function icon(h, row) {
  const src = row.image && safeImage(row.image);
  const badge = h('span', { class: 'market-token-icon', 'aria-hidden': 'true' }, (row.symbol || '?').slice(0, 2));
  if (src) { const img = h('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }); img.addEventListener('error', () => img.remove(), { once: true }); badge.append(img); }
  return badge;
}
function sparkline(values, h) {
  const points = (values || []).filter(v => metric(v) !== null).map(Number);
  if (points.length < 2) return h('span', { class: 'ely-muted' }, 'Unavailable');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 28'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Observed price history'); svg.classList.add('market-spark');
  const path = document.createElementNS(svg.namespaceURI, 'polyline'), low = Math.min(...points), range = Math.max(...points) - low || 1;
  path.setAttribute('points', points.map((n, i) => `${i / (points.length - 1) * 100},${26 - (n - low) / range * 24}`).join(' ')); svg.append(path); return svg;
}
export function marketIntro(h, chain) {
  const activeChain = chain === 'all' ? 'solana' : chain;
  const allHref = `/?chain=${activeChain}&market=all#markets`;
  const chainLinks = [['all', 'All'], ['solana', 'Solana'], ['elysium', 'Elysium']].map(([key, label]) => key === 'all'
    ? h('a', { class: `market-chain-link${chain === 'all' ? ' active' : ''}`, href: allHref }, label)
    : h('a', { class: `market-chain-link${chain === key ? ' active' : ''}`, href: marketHref(key, 'markets') }, label));
  return h('header', { class: 'market-intro' },
    h('div', { class: 'market-intro-mark' }, h('img', { src: '/purrlysium/mark.svg', alt: '', width: 56, height: 56 })),
    h('div', { class: 'market-intro-copy' }, h('span', { class: 'market-eyebrow' }, 'Hypeliysium markets'), h('h1', {}, 'Discover the next move'), h('p', {}, `${chain === 'all' ? 'Solana and Elysium discovery, kept separate through every trade.' : `${chain === 'solana' ? 'Solana' : 'Elysium'} markets, sourced from their active adapter. Review before signing.`}`)),
    h('nav', { class: 'market-chain-switch', 'aria-label': 'Market chain' }, ...chainLinks),
    h('div', { class: 'market-actions' }, h('a', { class: 'ely-btn primary', href: marketHref(chain, 'create') }, 'Launch a coin'), h('a', { class: 'ely-btn', href: marketHref(chain, 'referrals') }, 'Referral availability')));
}
export function tokenSummary(h, row, chain, explorer) {
  const note = h('span', { role: 'status', class: 'ely-muted' });
  const copy = h('button', { class: 'ely-btn', onclick: async () => { try { await navigator.clipboard.writeText(row.address); note.textContent = 'Address copied.'; } catch { note.textContent = 'Clipboard unavailable. Select the address below to copy.'; } } }, 'Copy CA');
  return h('section', { class: 'market-token-summary' }, h('div', { class: 'market-token-heading' }, icon(h, row), h('div', {}, h('h1', {}, `${row.name || row.symbol} · ${row.symbol}`), h('p', {}, `${chain === 'solana' ? 'Solana' : 'Elysium'} · ${row.symbol}/${row.pair || 'pair unavailable'}`))), h('p', { class: 'purr-address' }, row.address), h('div', { class: 'market-actions' }, copy, explorer ? h('a', { class: 'ely-btn', href: explorer, target: '_blank', rel: 'noopener noreferrer' }, 'Explorer') : null, h('a', { class: 'ely-btn', href: marketHref(chain, 'referrals') }, 'Referral availability'), note), h('dl', { class: 'market-stats' }, ...[['Price', amount(row.price, row.unit)], ['24h change', changeLabel(row.change)], ['Market cap', amount(row.cap, row.unit)], ['24h volume', amount(row.volume, row.unit)]].map(([name, value]) => h('div', {}, h('dt', {}, name), h('dd', {}, value)))));
}
export function marketDirectory(target, { h, chain, rows, checkedAt, partial = false, coverageNote = '', open, searchRemote, current = () => true }) {
  const state = { query: '', sort: 'volume', pair: '', view: 'cards', chain: 'all' };
  const search = h('input', { type: 'search', id: 'market-search', placeholder: 'Name, ticker or address', autocomplete: 'off' });
  const sort = h('select', { id: 'market-sort' }, ...[['volume', '24h volume'], ['cap', 'Market cap'], ['price', 'Price'], ['change', '24h change']].map(([value, text]) => h('option', { value }, text)));
  const pair = h('select', { id: 'market-pair' }, h('option', { value: '' }, 'All pairs'), ...[...new Set(rows.map(r => r.pair).filter(Boolean))].sort().map(value => h('option', { value }, value)));
  const submit = searchRemote ? h('button', { class: 'ely-btn', type: 'submit' }, 'Search network') : null;
  const view = h('div', { class: 'market-view-toggle', role: 'group', 'aria-label': 'Market display' });
  const chainFilter = h('select', { id: 'market-chain-filter', 'aria-label': 'Filter by chain' }, ...[['all', 'All chains'], ['solana', 'Solana'], ['elysium', 'Elysium']].map(([value, label]) => h('option', { value }, label)));
  const density = marketLayoutControls(h, target, () => { state.view = 'cards'; draw(); });
  const form = h('form', { class: 'market-controls' }, h('label', {}, 'Search tokens', search), h('label', {}, 'Chain filter', chainFilter), h('label', {}, 'Sort by', sort), h('label', {}, 'Pair', pair), view, density, submit);
  const status = h('p', { role: 'status', class: 'ely-muted' }), spotlight = h('section', { class: 'market-spotlight', 'aria-label': 'Featured observed market' }), pairRail = h('div', { class: 'market-pair-rail', role: 'group', 'aria-label': 'Observed quote pairs' }), list = h('div', { class: 'market-directory' });
  target.replaceChildren(spotlight, pairRail, form, status, list);
  function draw() {
     const filteredRows = state.chain === 'all' ? rows : rows.filter(row => row.chain === state.chain);
     const shown = selectMarkets(filteredRows, state);
     status.textContent = `${shown.length} / ${filteredRows.length} returned · ${partial ? coverageNote || 'Partial coverage' : 'Snapshot'}${checkedAt ? ` · ${new Date(checkedAt).toLocaleTimeString(locale())}` : ''}`;
     status.title = checkedAt ? `Snapshot checked ${checkedAt}. Missing metrics are unavailable. Active chain follows the header.` : 'No timestamp supplied. Missing metrics are unavailable.';
     view.replaceChildren(...[['cards', 'Cards'], ['table', 'Table']].map(([key, label]) => h('button', { type: 'button', class: `market-view-button${state.view === key ? ' active' : ''}`, 'aria-pressed': String(state.view === key), onclick: () => { state.view = key; draw(); } }, label)));
     const featured = shown[0];
     if (featured) {
       const featuredChain = featured.chain || chain;
       spotlight.replaceChildren(h('div', { class: 'market-spotlight-copy' }, h('span', { class: 'market-eyebrow' }, 'Observed market'), h('h2', {}, `${featured.symbol} · ${featured.name}`), h('p', {}, `${featuredChain === 'solana' ? 'Solana' : 'Elysium'} · ${featured.pair || 'Pair unavailable'} · ${featured.unit || 'native'} adapter units`), h('div', { class: 'market-spotlight-metrics' }, ...[['Price', amount(featured.price, featured.unit)], ['24h', changeLabel(featured.change)], ['Volume 24h', amount(featured.volume, featured.unit)]].map(([name, value]) => h('span', {}, h('small', {}, name), h('b', {}, value))))), h('div', { class: 'market-spotlight-action' }, h('span', { class: 'market-chain' }, featuredChain === 'solana' ? 'SOL' : 'ELY'), h('button', { class: 'ely-btn primary', type: 'button', onclick: () => open(featured) }, 'Review market')));
     } else spotlight.replaceChildren(h('div', { class: 'market-spotlight-copy' }, h('span', { class: 'market-eyebrow' }, 'Observed market'), h('h2', {}, 'No matching market'), h('p', {}, 'Choose another chain, pair, or search term.')));
     const pairs = [...new Set(filteredRows.map(row => row.pair).filter(Boolean))].sort();
     pairRail.replaceChildren(h('span', { class: 'market-pair-label' }, 'Quote'), h('button', { type: 'button', class: `market-pair-chip${state.pair ? '' : ' active'}`, onclick: () => { state.pair = ''; pair.value = ''; draw(); } }, 'All pairs'), ...pairs.map(value => h('button', { type: 'button', class: `market-pair-chip${state.pair === value ? ' active' : ''}`, onclick: () => { state.pair = value; pair.value = value; draw(); } }, value)));
     if (!shown.length) { list.replaceChildren(h('p', { class: 'market-empty' }, rows.length ? 'No tokens match these filters. Clear the search or choose another pair.' : 'No markets returned. Try another search or check again later.')); return; }
    const cell = (name, content, cls = '') => h('td', { class: cls, 'data-label': name }, content);
     const cards = h('div', { class: 'market-cards', role: 'list', 'aria-label': `${chain === 'all' ? 'Combined' : chain === 'solana' ? 'Solana' : 'Elysium'} token markets` }, ...shown.map(row => {
       const rowChain = row.chain || chain;
       const chainName = rowChain === 'solana' ? 'Solana' : 'Elysium';
       const link = h('a', { class: 'market-token-link', href: marketHref(rowChain, 'trade', row.address), onclick: event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return; event.preventDefault(); open(row); } }, icon(h, row), h('span', {}, h('b', {}, row.symbol), h('small', {}, row.name), h('small', { class: 'market-route' }, `${chainName} adapter route`)), h('span', { class: 'market-chain' }, `${rowChain === 'solana' ? 'SOL' : 'ELY'} · ${chainName}`));
       return h('div', { class: 'market-card', role: 'listitem' }, h('div', { class: 'market-card-head' }, link, h('span', { class: `market-change ${metric(row.change) === null ? '' : row.change >= 0 ? 'purr-pos' : 'purr-neg'}` }, changeLabel(row.change))), h('dl', { class: 'market-card-metrics' }, ...[['Price', amount(row.price, row.unit)], ['Market cap', amount(row.cap, row.unit)], ['Volume 24h', amount(row.volume, row.unit)], ['Pair', row.pair || 'Unavailable']].map(([name, value]) => h('div', {}, h('dt', {}, name), h('dd', {}, value)))), h('div', { class: 'market-card-foot' }, h('span', { class: 'market-adapter-badge' }, `${chainName} adapter`), sparkline(row.series, h), h('button', { class: 'ely-btn', type: 'button', onclick: () => open(row) }, 'Review trade')));
     }));
     const table = h('table', { class: 'market-table' }, h('caption', { class: 'market-caption' }, `${chain === 'all' ? 'Combined' : chain === 'solana' ? 'Solana' : 'Elysium'} token markets`), h('thead', {}, h('tr', {}, ...['Token / chain', 'Pair', 'Price', '24h', 'Market cap', 'Volume 24h', 'Holders', 'History'].map(text => h('th', { scope: 'col' }, text)))), h('tbody', {}, ...shown.map(row => {
       const rowChain = row.chain || chain;
       const link = h('a', { class: 'market-token-link', href: marketHref(rowChain, 'trade', row.address), onclick: event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return; event.preventDefault(); open(row); } }, icon(h, row), h('span', {}, h('b', {}, row.symbol), h('small', {}, row.name), h('small', { class: 'market-route' }, `${rowChain === 'solana' ? 'Solana' : 'Elysium'} adapter route`)), h('span', { class: 'market-chain' }, `${rowChain === 'solana' ? 'SOL' : 'ELY'} · ${rowChain === 'solana' ? 'Solana' : 'Elysium'}`));
      const details = h('details', { class: 'market-mobile-details' }, h('summary', {}, 'More metrics'), h('dl', {}, ...[['Pair', row.pair || 'Unavailable'], ['Market cap', amount(row.cap, row.unit)], ['24h volume', amount(row.volume, row.unit)], ['Holders', numberLabel(row.holders)]].map(([key, value]) => h('div', {}, h('dt', {}, key), h('dd', {}, value)))));
      return h('tr', {}, cell('Token', h('div', {}, link, details), 'market-identity'), cell('Pair', row.pair || 'Unavailable', 'market-secondary'), cell('Price', amount(row.price, row.unit), 'market-price'), cell('24h', changeLabel(row.change), `market-change ${metric(row.change) === null ? '' : row.change >= 0 ? 'purr-pos' : 'purr-neg'}`), cell('Market cap', amount(row.cap, row.unit), 'market-secondary'), cell('Volume 24h', amount(row.volume, row.unit), 'market-secondary'), cell('Holders', numberLabel(row.holders), 'market-secondary'), cell('History', sparkline(row.series, h), 'market-secondary'));
      })));
     list.replaceChildren(state.view === 'cards' ? cards : table);
  }
  search.addEventListener('input', () => { state.query = search.value; draw(); });
  chainFilter.addEventListener('change', () => { state.chain = chainFilter.value; draw(); });
  sort.addEventListener('change', () => { state.sort = sort.value; draw(); });
  pair.addEventListener('change', () => { state.pair = pair.value; draw(); });
  form.addEventListener('submit', async event => { event.preventDefault(); if (!searchRemote) return; submit.disabled = true; status.textContent = 'Searching the network…'; try { const data = await searchRemote(search.value); if (!current()) return; rows = data.rows; checkedAt = data.checkedAt; partial = data.partial; pair.replaceChildren(h('option', { value: '' }, 'All pairs'), ...[...new Set(rows.map(r => r.pair).filter(Boolean))].sort().map(value => h('option', { value }, value))); state.pair = ''; draw(); } catch (error) { if (current()) { list.replaceChildren(); status.textContent = `${error.message} Try Search network again.`; } } finally { submit.disabled = false; } });
  draw();
}
