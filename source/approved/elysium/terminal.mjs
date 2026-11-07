// Purrlysium trading terminal: coin ticker, coin bar, candle chart, trades / holders / callouts,
// a buy-sell panel and the callouts feed. Every number is read from chain: prices from the
// PoolManager's Swap events for each pad pool, holders from the coin's Transfer events, quotes from
// the ZapRouter. USD figures use the HYPE/USD mid the server reads from Hyperliquid; without it the
// terminal shows HYPE only. Nothing is estimated or made up.
import { decodeEventLog, keccak256, toHex, toBytes, parseUnits, formatUnits, getAddress } from 'viem';
import { locale, validDecimalInput } from './i18n.mjs';
import { ABI } from './abi.mjs';
import { reviewTransaction } from './header.mjs';
import { marketIntro, marketHref, tokenSummary, metric } from './market-directory.mjs';

const SWAP_TOPIC = keccak256(toBytes('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)'));
const TRANSFER_TOPIC = keccak256(toBytes('Transfer(address,address,uint256)'));
const RANGE = 50000n;
const INTERVALS = [['5m', 300], ['15m', 900], ['1h', 3600], ['4h', 14400], ['1d', 86400]];
const swapCache = new Map();
const holderCache = new Map();
const blockTimes = new Map();
const MIN_USD = 50;

const num = (wei, d = 18) => Number(wei) / 10 ** d;
export function fmtPrice(p) {
  if (!Number.isFinite(p) || p <= 0) return '—';
  if (p >= 1) return p.toLocaleString(locale(), { maximumFractionDigits: p >= 1000 ? 0 : 4 });
  const z = Math.max(0, -Math.floor(Math.log10(p)) - 1);
  if (z >= 4) return `0.0${String.fromCharCode(0x2080 + Math.min(z, 9))}${Math.round(p * 10 ** (z + 4)).toString().slice(0, 4)}`;
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: z + 4 }).format(p);
}
export function compact(v) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e3) return new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 2 }).format(v);
  if (a >= 1) return new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(v);
  return fmtPrice(v);
}
const ago = (t) => { const s = Math.max(0, Math.floor(Date.now() / 1000 - t)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
const hue = (addr) => parseInt(addr.slice(2, 8), 16) % 360;
const WL_KEY = 'purr-watch';
const watch = () => { try { return new Set(JSON.parse(localStorage.getItem(WL_KEY) || '[]')); } catch { return new Set(); } };
const toggleWatch = (a) => { const w = watch(); a = a.toLowerCase(); w.has(a) ? w.delete(a) : w.add(a); try { localStorage.setItem(WL_KEY, JSON.stringify([...w])); } catch {} return w.has(a); };
const META = new Map(); // token(lower) -> { image, description, website, x, telegram }
let metaAt = 0;
export async function loadMeta() {
  if (Date.now() - metaAt < 15000) return META;
  metaAt = Date.now();
  try { const j = await (await fetch('/api/purrlysium/coins')).json(); for (const [k, v] of Object.entries(j.coins || {})) META.set(k, v); } catch {}
  return META;
}
const tint = (el, addr) => {
  el.style.setProperty('--h', String(hue(addr)));
  if (el.classList.contains('purr-coin-badge') && META.get(addr.toLowerCase())?.image) { el.style.backgroundImage = `url(/purrlysium/img/${addr.toLowerCase()})`; el.classList.add('has-img'); }
  return el;
};
const txFrom = new Map();

async function timeOf(rpc, log) {
  if (log.blockTimestamp) return Number(BigInt(log.blockTimestamp));
  const n = log.blockNumber;
  if (!blockTimes.has(n)) blockTimes.set(n, rpc('eth_getBlockByNumber', [n, false]).then((b) => Number(BigInt(b.timestamp))));
  return blockTimes.get(n);
}

async function scan(rpc, filter, fromBlock, onLogs) {
  const head = BigInt(await rpc('eth_blockNumber', []));
  for (let from = fromBlock; from <= head; from += RANGE) {
    const to = from + RANGE - 1n > head ? head : from + RANGE - 1n;
    await onLogs(await rpc('eth_getLogs', [{ ...filter, fromBlock: toHex(from), toBlock: toHex(to) }]));
  }
  return head;
}

async function loadSwaps({ S, rpc }, l) {
  const c = swapCache.get(l.poolId) || { last: BigInt(l.block) - 1n, swaps: [] };
  const d0 = S.tokens.get(l.key.currency0)?.decimals ?? 18, d1 = S.tokens.get(l.key.currency1)?.decimals ?? 18;
  const tokenIs0 = BigInt(l.token) === BigInt(l.key.currency0);
  c.last = await scan(rpc, { address: S.m.carbon.poolManager, topics: [SWAP_TOPIC, l.poolId] }, c.last + 1n, async (logs) => {
    const times = await Promise.all(logs.map((x) => timeOf(rpc, x)));
    logs.forEach((x, i) => {
      const e = decodeEventLog({ abi: ABI.v4pm, data: x.data, topics: x.topics }).args;
      const raw = (Number(e.sqrtPriceX96) / 2 ** 96) ** 2 * 10 ** (d0 - d1);
      const tokenDelta = tokenIs0 ? e.amount0 : e.amount1, pairDelta = tokenIs0 ? e.amount1 : e.amount0;
      c.swaps.push({
        t: times[i], tx: x.transactionHash, who: x.topics[2] ? getAddress(`0x${x.topics[2].slice(26)}`) : '', side: tokenDelta > 0n ? 'buy' : 'sell',
        price: tokenIs0 ? raw : 1 / raw, tokens: num(tokenDelta < 0n ? -tokenDelta : tokenDelta, tokenIs0 ? d0 : d1), hype: num(pairDelta < 0n ? -pairDelta : pairDelta, tokenIs0 ? d1 : d0),
      });
    });
  });
  swapCache.set(l.poolId, c);
  return c.swaps;
}

async function loadHolders({ S, rpc }, l) {
  const c = holderCache.get(l.token) || { last: BigInt(l.block) - 1n, bal: new Map() };
  c.last = await scan(rpc, { address: l.token, topics: [TRANSFER_TOPIC] }, c.last + 1n, async (logs) => {
    for (const x of logs) {
      const from = `0x${x.topics[1].slice(26)}`, to = `0x${x.topics[2].slice(26)}`, v = BigInt(x.data);
      if (!/^0x0{40}$/.test(from)) c.bal.set(from, (c.bal.get(from) || 0n) - v);
      c.bal.set(to, (c.bal.get(to) || 0n) + v);
    }
  });
  holderCache.set(l.token, c);
  const pm = S.m.carbon.poolManager.toLowerCase();
  return [...c.bal.entries()].filter(([a, v]) => v > 0n && !/^0x0{40}$/.test(a)).sort((a, b) => (b[1] > a[1] ? 1 : -1))
    .map(([a, v]) => ({ address: a, amount: num(v, S.tokens.get(l.token).decimals), pool: a === pm }));
}

function stats(l, swaps, holders) {
  const supply = num(l.supply);
  const open = num(l.openingMarketCap) / supply;
  const now = Date.now() / 1000;
  const price = swaps.length ? swaps[swaps.length - 1].price : open;
  const before = swaps.filter((s) => s.t <= now - 86400);
  const ref = before.length ? before[before.length - 1].price : open;
  const day = swaps.filter((s) => s.t > now - 86400);
  const buys = day.filter((s) => s.side === 'buy');
  const ath = Math.max(open, ...swaps.map((s) => s.price));
  const at = (sec) => { const b = swaps.filter((x) => x.t <= now - sec); const p = b.length ? b[b.length - 1].price : open; return p ? (price / p - 1) * 100 : 0; };
  return { price, supply, mcap: price * supply, ath: ath * supply, ch5m: at(300), ch1h: at(3600), ch4h: at(14400), change: ref ? (price / ref - 1) * 100 : 0, vol: day.reduce((a, s) => a + s.hype, 0),
    buys: buys.length, sells: day.length - buys.length, buyVol: buys.reduce((a, s) => a + s.hype, 0), sellVol: day.filter((s) => s.side === 'sell').reduce((a, s) => a + s.hype, 0),
    holders: holders ? holders.filter((x) => !x.pool).length : null, open, trades: day.length };
}

function candles(swaps, open, step, n = 60) {
  if (!swaps.length) return [];
  const end = Math.floor(Math.max(Date.now() / 1000, swaps[swaps.length - 1].t) / step) * step;
  const start = Math.max(end - (n - 1) * step, Math.floor(swaps[0].t / step) * step);
  const out = [];
  let i = 0, prev = open;
  while (i < swaps.length && swaps[i].t < start) prev = swaps[i++].price;
  for (let b = start; b <= end; b += step) {
    const c = { t: b, o: prev, h: prev, l: prev, c: prev, v: 0 };
    while (i < swaps.length && swaps[i].t < b + step) { const p = swaps[i].price; c.h = Math.max(c.h, p); c.l = Math.min(c.l, p); c.c = p; c.v += swaps[i].hype; i++; }
    prev = c.c; out.push(c);
  }
  return out;
}

const SVGNS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); el.append(...kids); return el; };

function chart(cs, { W, H, scale, unit, info }) {
  const PAD = { l: 6, r: 74, t: 14, b: 24 }, VH = Math.round(H * 0.16);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'purr-chart', role: 'img', 'aria-label': `Candle chart in ${unit}, from on-chain swaps` });
  if (!cs.length) { svg.append(s('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'purr-chart-empty' }, 'No trades yet. Candles start with the first swap.')); return svg; }
  const v = (p) => p * scale;
  const hi = Math.max(...cs.map((c) => v(c.h))), lo = Math.min(...cs.map((c) => v(c.l)));
  const span = hi - lo || hi * 0.02 || 1;
  const top = hi + span * 0.1, bot = Math.max(0, lo - span * 0.1);
  const ph = H - PAD.t - PAD.b - VH;
  const y = (p) => PAD.t + ((top - p) / (top - bot)) * ph;
  const cw = (W - PAD.l - PAD.r) / cs.length;
  const vmax = Math.max(...cs.map((c) => c.v)) || 1;
  const defs = s('defs', {}, s('linearGradient', { id: 'purr-glow', x1: 0, x2: 0, y1: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#E8C86A', 'stop-opacity': '.22' }), s('stop', { offset: 1, 'stop-color': '#E8C86A', 'stop-opacity': 0 })));
  svg.append(defs);
  for (let k = 0; k <= 4; k++) {
    const p = bot + ((top - bot) * k) / 4, yy = y(p);
    svg.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: yy, y2: yy, class: 'purr-grid' }), s('text', { x: W - PAD.r + 8, y: yy + 4, class: 'purr-axis' }, compact(p)));
  }
  const area = cs.map((c, i) => `${i ? 'L' : 'M'}${PAD.l + i * cw + cw / 2},${y(v(c.c))}`).join('');
  svg.append(s('path', { d: `${area}L${PAD.l + (cs.length - 0.5) * cw},${PAD.t + ph}L${PAD.l + cw / 2},${PAD.t + ph}Z`, fill: 'url(#purr-glow)' }));
  const cross = s('line', { class: 'purr-cross', x1: 0, x2: 0, y1: PAD.t, y2: H - PAD.b, visibility: 'hidden' });
  cs.forEach((c, i) => {
    const x = PAD.l + i * cw, mid = x + cw / 2, up = c.c >= c.o;
    const g = s('g', { class: up ? 'purr-up' : 'purr-down' });
    g.append(s('line', { x1: mid, x2: mid, y1: y(v(c.h)), y2: y(v(c.l)), class: 'purr-wick' }));
    const y1 = y(v(Math.max(c.o, c.c))), y2 = y(v(Math.min(c.o, c.c)));
    g.append(s('rect', { x: x + cw * 0.16, width: Math.max(1, cw * 0.68), y: y1, height: Math.max(1.2, y2 - y1), rx: Math.min(1.5, cw * 0.1), class: 'purr-body' }));
    if (c.v) g.append(s('rect', { x: x + cw * 0.16, width: Math.max(1, cw * 0.68), y: H - PAD.b - (c.v / vmax) * (VH - 4), height: (c.v / vmax) * (VH - 4), class: 'purr-vol' }));
    const hit = s('rect', { x, y: PAD.t, width: cw, height: H - PAD.t - PAD.b, class: 'purr-hit' });
    const show = () => { cross.setAttribute('x1', mid); cross.setAttribute('x2', mid); cross.setAttribute('visibility', 'visible'); info.textContent = `${new Date(c.t * 1000).toLocaleString(locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}   O ${compact(v(c.o))}  H ${compact(v(c.h))}  L ${compact(v(c.l))}  C ${compact(v(c.c))}  ·  Vol ${compact(c.v)} HYPE`; };
    hit.addEventListener('pointerenter', show); hit.addEventListener('pointerdown', show);
    g.append(hit);
    svg.append(g);
  });
  svg.append(cross);
  const last = v(cs[cs.length - 1].c), ly = y(last), up = cs[cs.length - 1].c >= cs[cs.length - 1].o;
  svg.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: ly, y2: ly, class: 'purr-last' }), s('rect', { x: W - PAD.r + 3, y: ly - 10, width: PAD.r - 6, height: 20, rx: 4, class: up ? 'purr-last-tag up' : 'purr-last-tag down' }), s('text', { x: W - PAD.r + 8, y: ly + 4, class: 'purr-last-text' }, compact(last)));
  const ticks = Math.max(2, Math.min(6, Math.floor(W / 140)));
  for (let k = 0; k < ticks; k++) {
    const i = Math.round((k * (cs.length - 1)) / (ticks - 1));
    svg.append(s('text', { x: PAD.l + i * cw + cw / 2, y: H - 6, 'text-anchor': k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle', class: 'purr-axis' }, new Date(cs[i].t * 1000).toLocaleString(locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })));
  }
  return svg;
}

export async function terminal(main, ctx) {
  await loadMeta();
  const { S, h, loadLaunches, tokenInfo, short, read, send, call, approveIfNeeded, chainDeadline, quoteZap, ethKeys, feeTable, toast, guarded, connect, explainError, fmt, rpc } = ctx;
  await loadLaunches();
  const requestedToken = new URLSearchParams(location.search).get('token');
  if (requestedToken && !S.launches.some(l => l.token.toLowerCase() === requestedToken.toLowerCase())) {
    const response = await fetch('/api/purrlysium/elysium-coins');
    if (!response.ok) throw new Error('Elysium market index unavailable. Try again.');
    const index = await response.json(), coin = index.coins?.find(c => c.token.toLowerCase() === requestedToken.toLowerCase());
    if (!coin) { main.replaceChildren(h('section', { class: 'ely-card' }, h('h1', {}, 'Token unavailable'), h('p', {}, 'This address is not in the current Elysium index. No other token was substituted.'))); return; }
    const row = { address: coin.token, name: coin.name, symbol: coin.symbol, pair: 'WHYPE', price: metric(coin.price), change: metric(coin.change), cap: null, volume: metric(coin.vol), unit: 'HYPE' };
    main.replaceChildren(tokenSummary(h, row, 'elysium', S.m.explorer ? `${S.m.explorer.replace(/\/$/, '')}/token/${coin.token}` : null), h('section', { class: 'ely-card' }, h('h2', {}, 'Buy / Sell'), h('p', {}, 'In-app execution and detailed activity are unavailable for this indexed external pool. Use its verified venue to review the trade.'), coin.url && /^https:\/\//.test(coin.url) ? h('a', { class: 'ely-btn', href: coin.url, target: '_blank', rel: 'noopener noreferrer' }, `Open ${coin.padName || 'market source'}`) : null)); return;
  }
  if (!S.launches.length) { main.replaceChildren(h('section', { class: 'ely-card purr-empty' }, h('h2', {}, 'No coins yet'), h('p', {}, 'Be the first: launch a coin on the Create tab.'))); return; }
  await Promise.all(S.launches.flatMap((l) => [tokenInfo(l.key.currency0), tokenInfo(l.key.currency1)]));
  const want = new URLSearchParams(location.search).get('token');
  let cur = S.launches.find((l) => want && l.token.toLowerCase() === want.toLowerCase()) || S.launches.find((l) => l.poolId === S.term) || S.launches[0];
  S.term = cur.poolId;
  const pref = S.termPref || (S.termPref = { step: 3600, mode: 'mcap', usd: true, tab: 'trades', side: 'buy', slip: 100n });
  let hypeUsd = 0;
  let feed = [];
  const st = new Map();
  const usd = () => pref.usd && hypeUsd > 0;
  const money = (hype) => (usd() ? `$${compact(hype * hypeUsd)}` : `${compact(hype)} HYPE`);
  const sym = () => S.tokens.get(cur.token).symbol;

  async function refreshFeed() {
    try { const r = await (await fetch('/api/purrlysium/callouts')).json(); feed = r.posts || []; hypeUsd = r.hypeUsd || 0; } catch {}
  }

  // ---------------------------------------------------------------- layout
  const ticker = h('div', { class: 'purr-ticker', role: 'listbox', 'aria-label': 'Coins' });
  const bar = h('div', { class: 'purr-coinbar' });
  const tools = h('div', { class: 'purr-tools' });
  const info = h('p', { class: 'purr-chart-info', 'aria-live': 'polite' }, 'Tap or hover a candle for open, high, low, close and volume.');
  const chartBox = h('div', { class: 'purr-chart-box' });
  const tabsBar = h('div', { class: 'purr-subtabs', role: 'tablist' });
  const tabBody = h('div', { class: 'purr-subtab-body' });
  const tradeCard = h('section', { class: 'purr-panel purr-trade-panel', 'aria-label': 'Buy or sell' });
  const statsCard = h('section', { class: 'purr-panel purr-stats' });
  const feedCard = h('aside', { class: 'purr-panel purr-feed', 'aria-label': 'Callouts' });

  main.replaceChildren(h('section', { class: 'purr-term' },
    ticker, bar,
    h('div', { class: 'purr-term-grid' },
      feedCard,
      h('section', { class: 'purr-panel purr-chart-panel' }, tools, chartBox, info),
      h('section', { class: 'purr-panel purr-tabs-panel' }, tabsBar, tabBody),
      h('div', { class: 'purr-side' }, tradeCard, statsCard))));

  function drawTicker() {
    ticker.replaceChildren(...S.launches.map((l) => {
      const x = st.get(l.poolId); const t = S.tokens.get(l.token);
      return h('button', { class: 'purr-tick' + (l.poolId === cur.poolId ? ' on' : ''), role: 'option', 'aria-selected': String(l.poolId === cur.poolId), onclick: () => select(l) },
        tint(h('span', { class: 'purr-coin-badge' }, t.symbol[0]), l.token),
        h('b', {}, t.symbol), x ? h('span', {}, money(x.mcap)) : '', x ? h('span', { class: x.change >= 0 ? 'purr-pos' : 'purr-neg' }, `${x.change >= 0 ? '+' : ''}${x.change.toFixed(1)}%`) : '');
    }));
  }

  function drawBar(x) {
    const t = S.tokens.get(cur.token);
    const copy = h('button', { class: 'purr-icon-btn', title: 'Copy coin address', 'aria-label': 'Copy coin address', onclick: async () => { try { await navigator.clipboard.writeText(cur.token); toast('Coin address copied.', 'good'); } catch { toast(`Copy this address: ${cur.token}`); } } }, 'Copy CA');
    const stat = (label, value, cls = '') => h('div', { class: 'purr-bstat' }, h('small', {}, label), h('b', { class: cls }, value));
    bar.replaceChildren(
      h('div', { class: 'purr-coin-id' }, tint(h('span', { class: 'purr-coin-badge big' }, t.symbol[0]), cur.token),
        h('div', {}, h('h2', {}, t.symbol), h('p', {}, h('span', {}, t.name), ' ', h('span', { class: 'ely-mono' }, short(cur.token)), copy, ...coinLinks(META.get(cur.token.toLowerCase()))),
          h('p', {}, `Elysium · ${t.symbol}/${S.tokens.get(cur.pair)?.symbol || 'WHYPE'}`, ' · ', h('a', { href: marketHref('elysium', 'referrals') }, 'Referral availability'), S.m.explorer ? h('a', { class: 'ely-btn', href: `${S.m.explorer.replace(/\/$/, '')}/token/${cur.token}`, target: '_blank', rel: 'noopener noreferrer' }, 'Explorer') : null),
          META.get(cur.token.toLowerCase())?.description ? (() => { const d = h('p', { class: 'purr-coin-desc' }); d.textContent = META.get(cur.token.toLowerCase()).description; return d; })() : '')),
      h('div', { class: 'purr-bstats' },
         stat('FDV · total supply', money(x.mcap), 'purr-big'),
        stat('Price', usd() ? `$${fmtPrice(x.price * hypeUsd)}` : `${fmtPrice(x.price)} HYPE`),
        stat('24h', `${x.change >= 0 ? '+' : ''}${x.change.toFixed(2)}%`, x.change >= 0 ? 'purr-pos' : 'purr-neg'),
        stat('24h vol', money(x.vol)),
        stat('Holders', x.holders === null ? '…' : String(x.holders)),
        stat('ATH MC', money(x.ath))),
      h('div', { class: 'purr-windows' }, ...[['5m', x.ch5m], ['1h', x.ch1h], ['4h', x.ch4h], ['24h', x.change]].map(([k, v]) => h('div', {}, h('small', {}, k), h('b', { class: v >= 0 ? 'purr-pos' : 'purr-neg' }, `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)))));
  }

  function drawTools() {
    const seg = (items, on, set, label) => h('div', { class: 'purr-seg', role: 'group', 'aria-label': label }, ...items.map(([k, lab]) => h('button', { class: k === on ? 'on' : '', 'aria-pressed': String(k === on), onclick: () => { set(k); drawChart(); drawBar(st.get(cur.poolId)); drawTicker(); } }, lab)));
    tools.replaceChildren(
      seg(INTERVALS.map(([l, sec]) => [sec, l]), pref.step, (v) => { pref.step = v; }, 'Candle interval'),
      h('div', { class: 'purr-tools-right' },
        seg([['mcap', 'MCap'], ['price', 'Price']], pref.mode, (v) => { pref.mode = v; }, 'Show market cap or price'),
        hypeUsd > 0 ? seg([[true, 'USD'], [false, 'HYPE']], pref.usd, (v) => { pref.usd = v; }, 'Currency') : ''));
  }

  function drawChart() {
    drawTools();
    const x = st.get(cur.poolId);
    const swaps = swapCache.get(cur.poolId)?.swaps || [];
    const scale = (pref.mode === 'mcap' ? x.supply : 1) * (usd() ? hypeUsd : 1);
    const W = Math.max(300, Math.floor(chartBox.clientWidth || 700)), H = W < 560 ? 280 : 400;
    chartBox.replaceChildren(chart(candles(swaps, x.open, pref.step), { W, H, scale, unit: `${pref.mode === 'mcap' ? 'market cap' : 'price'} (${usd() ? 'USD' : 'HYPE'})`, info }));
  }

  // ---------------------------------------------------------------- tabs under the chart
  async function drawTab() {
    const tabs = [['trades', 'Trades'], ['holders', 'Holders'], ['callouts', `Callouts`]];
    tabsBar.replaceChildren(...tabs.map(([k, l]) => h('button', { role: 'tab', class: pref.tab === k ? 'on' : '', 'aria-selected': String(pref.tab === k), onclick: () => { pref.tab = k; drawTab(); } }, l,
      k === 'callouts' ? h('span', { class: 'purr-count' }, String(feed.filter((p) => p.token === cur.token.toLowerCase()).length)) : '')));
    const t = S.tokens.get(cur.token);
    if (pref.tab === 'trades') {
      const rows = (swapCache.get(cur.poolId)?.swaps || []).slice(-40).reverse();
      await Promise.all(rows.filter((r) => !txFrom.has(r.tx)).map((r) => rpc('eth_getTransactionByHash', [r.tx]).then((x) => txFrom.set(r.tx, getAddress(x.from))).catch(() => {})));
      const allSw = swapCache.get(cur.poolId)?.swaps || [];
      await Promise.all(allSw.filter((r) => !txFrom.has(r.tx)).slice(-200).map((r) => rpc('eth_getTransactionByHash', [r.tx]).then((x) => txFrom.set(r.tx, getAddress(x.from))).catch(() => {})));
      const book = new Map(); const pnl = new Map();
      for (const r of allSw) {
        const w = txFrom.get(r.tx); if (!w) continue;
        const b = book.get(w) || { tok: 0, cost: 0 };
        if (r.side === 'buy') { b.tok += r.tokens; b.cost += r.hype; }
        else if (b.tok > 0) { const avg = b.cost / b.tok, sold = Math.min(r.tokens, b.tok), basis = avg * sold; pnl.set(r.tx, { v: r.hype - basis, p: basis ? (r.hype / basis - 1) * 100 : 0 }); b.tok -= sold; b.cost -= basis; }
        book.set(w, b);
      }
      const scan = S.m.explorer ? S.m.explorer.replace(/\/$/, '') : '';
      const link = (path, text) => (scan ? h('a', { href: `${scan}/${path}`, target: '_blank', rel: 'noopener noreferrer' }, text) : text);
      tabBody.replaceChildren(rows.length ? h('div', { class: 'purr-table-wrap' }, h('table', { class: 'purr-table' },
        h('thead', {}, h('tr', {}, ...['Age', 'Type', usd() ? 'USD' : 'HYPE', t.symbol, 'MCap', 'PnL', 'Trader', 'Tx'].map((c) => h('th', {}, c)))),
        h('tbody', {}, ...rows.map((r) => { const p = pnl.get(r.tx); const w = txFrom.get(r.tx); return h('tr', {}, h('td', {}, ago(r.t)), h('td', { class: r.side === 'buy' ? 'purr-pos' : 'purr-neg' }, r.side === 'buy' ? 'Buy' : 'Sell'),
          h('td', {}, money(r.hype)), h('td', {}, compact(r.tokens)), h('td', {}, money(r.price * st.get(cur.poolId).supply)),
          h('td', { class: p ? (p.v >= 0 ? 'purr-pos' : 'purr-neg') : '' }, p ? `${p.v >= 0 ? '+' : ''}${money(Math.abs(p.v)).replace(/^/, p.v < 0 ? '-' : '')} (${p.p >= 0 ? '+' : ''}${p.p.toFixed(1)}%)` : ''),
          h('td', { class: 'ely-mono' }, w ? link(`address/${w}`, short(w)) : '—'), h('td', { class: 'ely-mono' }, link(`tx/${r.tx}`, short(r.tx)))); })))) : h('p', { class: 'purr-muted' }, 'No trades yet.'));
    } else if (pref.tab === 'holders') {
      tabBody.replaceChildren(h('p', { class: 'purr-muted' }, 'Reading holders from chain…'));
      const list = await loadHolders(ctx, cur); const x = st.get(cur.poolId);
      x.holders = list.filter((y) => !y.pool).length; drawBar(x);
      tabBody.replaceChildren(h('div', { class: 'purr-table-wrap' }, h('table', { class: 'purr-table' },
        h('thead', {}, h('tr', {}, ...['#', 'Holder', 'Held', '% supply', 'Value'].map((c) => h('th', {}, c)))),
        h('tbody', {}, ...list.slice(0, 50).map((y, i) => h('tr', { class: y.pool ? 'purr-pool-row' : '' },
          h('td', {}, i === 0 && !y.pool ? h('span', { class: 'purr-crown', title: 'Top holder' }, '♛') : String(i + 1)),
          h('td', { class: 'ely-mono' }, y.pool ? 'Pool (locked liquidity)' : short(getAddress(y.address)), y.address === cur.creator?.toLowerCase() ? h('span', { class: 'purr-tag' }, 'creator') : '', S.account && y.address === S.account.toLowerCase() ? h('span', { class: 'purr-tag you' }, 'you') : ''),
          h('td', {}, compact(y.amount)), h('td', {}, `${((y.amount / x.supply) * 100).toFixed(2)}%`), h('td', {}, money(y.amount * x.price))))))));
    } else {
      tabBody.replaceChildren(composer(), feedList(feed.filter((p) => p.token === cur.token.toLowerCase()), false));
    }
  }

  // ---------------------------------------------------------------- callouts
  function feedList(posts, showCoin) {
    if (!posts.length) return h('p', { class: 'purr-muted' }, showCoin ? 'No callouts yet. Hold $50+ of a coin to post the first one.' : `No callouts for ${sym()} yet.`);
    return h('ol', { class: 'purr-posts' }, ...posts.map((p) => {
      const l = S.launches.find((x) => x.token.toLowerCase() === p.token);
      const t = l && S.tokens.get(l.token);
      const body = h('p', { class: 'purr-post-text' }); body.textContent = p.text;
      const now = l && st.get(l.poolId);
      return h('li', { class: 'purr-post' },
        tint(h('span', { class: 'purr-avatar', 'aria-hidden': 'true' }), p.address),
        h('div', { class: 'purr-post-main' },
          h('div', { class: 'purr-post-head' }, h('b', { class: 'ely-mono' }, short(getAddress(p.address))), h('time', { datetime: new Date(p.at * 1000).toISOString() }, ago(p.at))),
          body,
          h('div', { class: 'purr-post-foot' },
            showCoin && t ? h('button', { class: 'purr-chip', onclick: () => select(l) }, tint(h('span', { class: 'purr-coin-badge' }, t.symbol[0]), l.token), t.symbol, now ? h('span', {}, ` · MC ${money(now.mcap)}`) : '') : '',
            h('span', { class: 'purr-held' }, `Held $${compact(p.valueUsd)} when posted`))));
    }));
  }

  function composer() {
    const ta = h('textarea', { maxlength: 280, rows: 2, placeholder: `Call out ${sym()}… (hold $${MIN_USD}+ to post)`, 'aria-label': `Write a callout for ${sym()}` });
    const count = h('small', {}, '0/280');
    ta.addEventListener('input', () => { count.textContent = `${ta.value.length}/280`; });
    const go = h('button', { class: 'ely-btn primary' }, 'Post callout');
    go.addEventListener('click', () => guarded(go, async () => {
      if (!S.account) { await connect(); if (!S.account) return; }
      const text = ta.value.trim();
      if (!text) throw new Error('Write something first.');
      const ts = Math.floor(Date.now() / 1000);
      const msg = `Purrlysium callout\nCoin: ${cur.token.toLowerCase()}\nChain: ${S.m.chainId}\nTime: ${ts}\n\n${text}`;
      const signature = await S.provider.request({ method: 'personal_sign', params: [toHex(toBytes(msg)), S.account] });
      const r = await fetch('/api/purrlysium/callouts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: cur.token, text, ts, tickSpacing: cur.key.tickSpacing, address: S.account, signature }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not post.');
      ta.value = ''; count.textContent = '0/280';
      toast(`Callout posted. Your ${sym()} was worth $${compact(j.post.valueUsd)}.`, 'good');
      await refreshFeed(); drawFeed(); drawTab();
    }));
    return h('div', { class: 'purr-composer' }, ta, h('div', { class: 'purr-composer-row' }, h('span', { class: 'purr-muted' }, `Only holders with $${MIN_USD}+ of ${sym()} can post. Checked on chain when you sign.`), count, go));
  }

  function drawFeed() {
    feedCard.replaceChildren(h('header', { class: 'purr-panel-head' }, h('h2', {}, 'Hot callouts'), h('span', { class: 'purr-live' }, 'Live')),
      h('p', { class: 'purr-muted purr-feed-rule' }, `Posts from wallets holding $${MIN_USD}+ of the coin they call.`), feedList(feed.slice(0, 40), true));
  }

  // ---------------------------------------------------------------- buy / sell
  async function drawTrade() {
    const t = S.tokens.get(cur.token);
    const buy = pref.side === 'buy';
    const amt = h('input', { inputmode: 'decimal', autocomplete: 'off', placeholder: '0.0', 'aria-label': buy ? 'Amount in HYPE' : `Amount in ${t.symbol}` });
    const quote = h('div', { class: 'purr-quote', 'aria-live': 'polite' }, 'Enter an amount');
    const bal = h('small', { class: 'purr-bal' }, 'Connect wallet to see balance');
    const go = h('button', { class: `purr-go ${buy ? 'buy' : 'sell'}` }, S.account ? `${buy ? 'Buy' : 'Sell'} ${t.symbol}` : 'Connect wallet to trade');
    let q = null, myToken = 0n, myHype = 0n, seq = 0;
    if (S.account) {
      [myHype, myToken] = await Promise.all([rpc('eth_getBalance', [S.account, 'latest']).then(BigInt), read(cur.token, ABI.erc20, 'balanceOf', [S.account])]);
      bal.textContent = buy ? `Balance ${fmt(myHype, 18, 4)} HYPE` : `Balance ${fmt(myToken, t.decimals, 2)} ${t.symbol}`;
    }
    async function requote() {
      const my = ++seq; q = null;
      let amountIn;
      if (amt.value && (!validDecimalInput(amt.value) || (amt.value.split('.')[1]?.length || 0) > (buy ? 18 : t.decimals))) { quote.textContent = 'Use a decimal point, not commas or grouping separators.'; return; }
      try { amountIn = parseUnits(amt.value || '0', buy ? 18 : t.decimals); } catch { quote.textContent = 'Enter a number.'; return; }
      if (amountIn === 0n) { quote.textContent = 'Enter an amount'; return; }
      if (buy && S.m.caps?.maxTradeHype && amountIn > parseUnits(String(S.m.caps.maxTradeHype), 18)) { quote.textContent = `Mainnet-test cap: max ${S.m.caps.maxTradeHype} HYPE per trade.`; return; }
      quote.textContent = 'Quoting…';
      try {
        const out = await quoteZap(buy, cur.key, amountIn);
        if (my !== seq) return;
        q = { out, amountIn };
        const min = (out * (10000n - pref.slip)) / 10000n;
        const outNum = num(out, buy ? t.decimals : 18);
        quote.replaceChildren(h('span', {}, 'You get'), h('b', {}, `${buy ? compact(outNum) : fmt(out, 18, 4)} ${buy ? t.symbol : 'HYPE'}`),
          h('small', {}, `min ${fmt(min, buy ? t.decimals : 18, 4)} · ${(Number(pref.slip) / 100).toFixed(1)}% slippage${hypeUsd ? ` · ≈ $${compact((buy ? num(amountIn) : outNum) * hypeUsd)}` : ''}`));
      } catch (e) { if (my === seq) quote.textContent = `Quote failed: ${explainError(e)}`; }
    }
    let timer; amt.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(requote, 250); });
    const quick = buy
      ? (hypeUsd ? [5, 25, 100].map((d) => h('button', { class: 'purr-quick', onclick: () => { amt.value = (d / hypeUsd).toFixed(4); requote(); } }, `$${d}`)) : ['0.1', '0.5', '1'].map((v) => h('button', { class: 'purr-quick', onclick: () => { amt.value = v; requote(); } }, `${v} HYPE`)))
        .concat(h('button', { class: 'purr-quick', onclick: () => { const keep = 10n ** 16n; amt.value = myHype > keep ? formatUnits(myHype - keep, 18) : '0'; requote(); } }, 'Max'))
      : [25, 50, 100].map((p) => h('button', { class: 'purr-quick', onclick: () => { amt.value = formatUnits((myToken * BigInt(p)) / 100n, t.decimals); requote(); } }, p === 100 ? 'Max' : `${p}%`));
    const max = quick.pop(); max.disabled = !S.account;
    const slips = h('div', { class: 'purr-slip', role: 'group', 'aria-label': 'Slippage' }, h('small', {}, 'Slippage'), ...[50n, 100n, 300n, 500n].map((b) => h('button', { class: b === pref.slip ? 'on' : '', 'aria-pressed': String(b === pref.slip), onclick: () => { pref.slip = b; drawTrade(); } }, `${Number(b) / 100}%`)));
    go.addEventListener('click', () => guarded(go, async () => {
      if (!S.account) { await connect(); return drawTrade(); }
      if (!q) await requote();
      if (!q) return;
      const min = (q.out * (10000n - pref.slip)) / 10000n || 1n;
      const reviewed = q, entered = amt.value;
      const feeDetails = await feeTable(cur);
      if (!await reviewTransaction({ h, title: 'Review trade', trigger: go, rows: [
        ['Network', `Elysium ${S.m.chainId}${S.m.local ? ' · local fork' : ''}`],
        ['Amount', `${formatUnits(reviewed.amountIn, buy ? 18 : t.decimals)} ${buy ? 'HYPE' : t.symbol}`],
        ['Minimum receive', `${formatUnits(min, buy ? t.decimals : 18)} ${buy ? t.symbol : 'HYPE'}`],
        ['Fees', [...feeDetails.querySelectorAll('tr')].map(row => [...row.children].map(cell => cell.textContent).join(': ')).join('\n')],
        ['Recipient', S.account], ['Network fees', 'Estimated by your wallet'],
      ] })) return;
      if (q !== reviewed || amt.value !== entered) throw new Error('Amount changed. Review again.');
      const deadline = await chainDeadline();
      if (buy) await send(`Buy ${t.symbol}`, { to: S.m.carbon.zapRouter, value: q.amountIn, data: call(ABI.zap, 'zapBuy', [ethKeys(), cur.key, min, S.account, deadline]) });
      else {
        await approveIfNeeded(t.address, S.m.carbon.zapRouter, q.amountIn, t.symbol);
        await send(`Sell ${t.symbol}`, { to: S.m.carbon.zapRouter, data: call(ABI.zap, 'zapSell', [ethKeys(), cur.key, q.amountIn, min, S.account, deadline]) });
      }
      swapCache.delete(cur.poolId); holderCache.delete(cur.token);
      await refreshCoin(); drawTrade();
    }));
    const fees = h('details', { class: 'purr-fees' }, h('summary', {}, 'Fees on this coin'), h('p', { class: 'purr-muted' }, 'Loading…'));
    fees.addEventListener('toggle', () => { if (fees.open && fees.children.length === 2 && fees.lastChild.tagName === 'P') feeTable(cur).then((tb) => fees.lastChild.replaceWith(tb)).catch((e) => { fees.lastChild.textContent = explainError(e); }); }, { once: false });
    tradeCard.replaceChildren(
      h('div', { class: 'purr-side-toggle', role: 'tablist' }, ...['buy', 'sell'].map((k) => h('button', { role: 'tab', class: `${k}${pref.side === k ? ' on' : ''}`, 'aria-selected': String(pref.side === k), onclick: () => { pref.side = k; drawTrade(); } }, k === 'buy' ? 'Buy' : 'Sell'))),
      h('label', { class: 'purr-amount' }, h('span', {}, 'Amount'), amt, h('em', {}, buy ? 'HYPE' : t.symbol)), h('div', { class: 'purr-amount-tools' }, bal, max),
      h('div', { class: 'purr-quicks' }, ...quick), slips, quote, go,
      S.account ? h('div', { class: 'purr-holding' }, h('span', {}, 'Your holding'), h('b', {}, `${compact(num(myToken, t.decimals))} ${t.symbol}`, hypeUsd ? h('small', {}, ` · $${compact(num(myToken, t.decimals) * st.get(cur.poolId).price * hypeUsd)}`) : '')) : '',
      h('p', { class: 'purr-muted purr-fine' }, 'Unaudited contracts. Only use money you can lose.'), fees);
  }

  function drawStats(x) {
    const total = x.buys + x.sells || 1, vt = x.buyVol + x.sellVol || 1;
    const meter = (label, a, b, fa, fb) => h('div', { class: 'purr-meter' },
      h('div', { class: 'purr-meter-top' }, h('span', { class: 'purr-pos' }, `${fa} ${label[0]}`), h('span', { class: 'purr-neg' }, `${fb} ${label[1]}`)),
      h('div', { class: 'purr-meter-bar' }, (() => { const i = h('i', {}); i.style.width = `${(a * 100).toFixed(1)}%`; return i; })()));
    const creator = cur.creator ? short(getAddress(cur.creator)) : '—';
    statsCard.replaceChildren(h('header', { class: 'purr-panel-head' }, h('h2', {}, '24h flow')),
      meter(['buys', 'sells'], x.buys / total, 0, x.buys, x.sells),
      meter(['buy vol', 'sell vol'], x.buyVol / vt, 0, money(x.buyVol), money(x.sellVol)),
      h('dl', { class: 'purr-kv' },
        h('div', {}, h('dt', {}, 'Pool'), h('dd', {}, `${sym()} / HYPE · locked forever`)),
        h('div', {}, h('dt', {}, 'Supply'), h('dd', {}, compact(x.supply))),
        h('div', {}, h('dt', {}, 'Opening MC'), h('dd', {}, money(num(cur.openingMarketCap)))),
        h('div', {}, h('dt', {}, 'Creator'), h('dd', { class: 'ely-mono' }, creator))));
  }

  // ---------------------------------------------------------------- data + selection
  async function refreshCoin() {
    const swaps = await loadSwaps(ctx, cur);
    const hc = holderCache.get(cur.token);
    const prev = st.get(cur.poolId);
    const x = stats(cur, swaps, hc ? await loadHolders(ctx, cur) : null);
    if (x.holders === null && prev?.holders != null) x.holders = prev.holders;
    st.set(cur.poolId, x);
    drawBar(x); drawChart(); drawStats(x); drawTicker();
    if (pref.tab !== 'callouts') drawTab();
  }
  async function refreshAll() {
    await refreshFeed();
    await Promise.all(S.launches.map(async (l) => { if (l === cur) return; st.set(l.poolId, stats(l, await loadSwaps(ctx, l), null)); }));
    await refreshCoin(); drawFeed();
    if (pref.tab === 'callouts') drawTab();
  }
  async function select(l) {
    cur = l; S.term = l.poolId;
    history.replaceState(null, '', marketHref('elysium', 'trade', l.token));
    await refreshCoin(); drawTrade(); drawTab();
    loadHolders(ctx, cur).then((list) => { const x = st.get(cur.poolId); x.holders = list.filter((y) => !y.pool).length; drawBar(x); }).catch(() => {});
  }

  await refreshFeed();
  await Promise.all(S.launches.map(async (l) => st.set(l.poolId, stats(l, await loadSwaps(ctx, l), null))));
  drawFeed(); drawTicker();
  await select(cur);
  const ro = new ResizeObserver(() => { if (st.get(cur.poolId)) drawChart(); });
  ro.observe(chartBox);
  const timer = setInterval(() => {
    if (!main.isConnected) { clearInterval(timer); ro.disconnect(); return; }
    refreshAll().catch(() => {});
  }, 15000);
}

function spark(swaps, open, up) {
  const now = Date.now() / 1000;
  const pts = swaps.filter((x) => x.t > now - 86400).map((x) => x.price);
  if (pts.length < 2) { const missing = document.createElement('span'); missing.textContent = 'Unavailable'; return missing; }
  const W = 96, H = 28, lo = Math.min(...pts), hi = Math.max(...pts), sp = hi - lo || 1;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, pts.length - 1)) * W).toFixed(1)},${(H - 2 - ((p - lo) / sp) * (H - 4)).toFixed(1)}`).join('');
  return s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: `purr-spark-line ${up ? 'up' : 'down'}`, 'aria-hidden': 'true' }, s('path', { d }));
}

/// Markets board: every coin, sorted the way traders scan (trending, new, top, gainers), plus the
/// live callouts wall. Paste an address or type a name to filter.
export async function markets(main, ctx) {
  const { S, h, loadLaunches, tokenInfo, short, openCoin } = ctx;
  main.replaceChildren(h('p', { class: 'purr-muted' }, 'Reading the markets from chain…'));
  await Promise.all([loadLaunches(), loadMeta()]);
  await Promise.all(S.launches.flatMap((l) => [tokenInfo(l.key.currency0), tokenInfo(l.key.currency1)]));
  let hypeUsd = 0, feed = [];
  try { const r = await (await fetch('/api/purrlysium/callouts')).json(); feed = r.posts || []; hypeUsd = r.hypeUsd || 0; } catch {}
  const rows = await Promise.all(S.launches.map(async (l) => { const sw = await loadSwaps(ctx, l); return { l, t: S.tokens.get(l.token), x: stats(l, sw, null), sw, calls: feed.filter((p) => p.token === l.token.toLowerCase()).length }; }));
  const money = (v) => metric(v) === null ? 'Unavailable' : `${compact(v)} HYPE`;
  const pref = S.mkPref || (S.mkPref = { sort: 'trending', q: '', src: 'all' });
  let ext = { coins: [], pads: [], ready: false };
  try { ext = await (await fetch('/api/purrlysium/elysium-coins')).json(); } catch {}
  const own = new Set(rows.map((r) => r.l.token.toLowerCase()));
  const extRows = (ext.coins || []).filter((c) => !own.has(c.token));
  const srcBar = h('div', { class: 'purr-srcs', role: 'tablist', 'aria-label': 'Launchpad' });
  const SORTS = [['watch', '★ Watchlist', (a, b) => b.x.mcap - a.x.mcap], ['trending', 'Trending', (a, b) => b.x.vol - a.x.vol || b.x.trades - a.x.trades], ['new', 'New', (a, b) => b.l.block - a.l.block], ['top', 'Top FDV', (a, b) => b.x.mcap - a.x.mcap], ['gainers', 'Gainers', (a, b) => b.x.change - a.x.change]];
  const search = h('input', { type: 'search', placeholder: 'Search name, ticker or paste 0x address', value: pref.q, 'aria-label': 'Search coins', autocomplete: 'off', spellcheck: 'false' });
  const tabs = h('div', { class: 'purr-seg', role: 'tablist', 'aria-label': 'Sort coins' });
  const list = h('div', { class: 'purr-board-list' });
  const king = rows.slice().sort((a, b) => b.x.mcap - a.x.mcap)[0];
  function draw() {
    tabs.replaceChildren(...SORTS.map(([k, label]) => h('button', { role: 'tab', class: pref.sort === k ? 'on' : '', 'aria-selected': String(pref.sort === k), onclick: () => { pref.sort = k; draw(); } }, label)));
    const q = pref.q.trim().toLowerCase();
    // Named pads get their own chip; unnamed pads and plain DEX pools share one "Other" chip.
    const others = (ext.pads || []).filter((p) => p.key !== 'purrlysium');
    const named = others.filter((p) => !/^(Pad|DEX) 0x/.test(p.name));
    const namedKeys = new Set(named.map((p) => p.key));
    const otherCount = others.filter((p) => !namedKeys.has(p.key)).reduce((a, p) => a + p.coins, 0);
    const total = rows.length + others.reduce((a, p) => a + p.coins, 0);
    const PADCHIPS = [['all', 'All Elysium', total], ['purrlysium', 'Hypeliysium', rows.length], ...named.map((p) => [p.key, p.name, p.coins]), ...(otherCount ? [['other', 'Other pads', otherCount]] : [])];
    const inSrc = (c) => pref.src === 'all' || (pref.src === 'other' ? !namedKeys.has(c.pad) : c.pad === pref.src);
    const srcTotal = (PADCHIPS.find(([k]) => k === pref.src) || PADCHIPS[0])[2];
    const wl = watch();
    const qx = pref.q.trim().toLowerCase();
    const extShown = pref.src === 'purrlysium' || pref.sort === 'watch' ? [] : extRows.filter((c) => inSrc(c) && (!qx || c.token === qx || c.symbol.toLowerCase().includes(qx) || c.name.toLowerCase().includes(qx)));
    const capped = Math.min(extShown.length, 100) + (pref.src === 'all' || pref.src === 'purrlysium' ? rows.length : 0);
    srcBar.replaceChildren(...PADCHIPS.map(([k, label, n]) => h('button', { role: 'tab', class: pref.src === k ? 'on' : '', 'aria-selected': String(pref.src === k), onclick: () => { pref.src = k; draw(); } }, label, h('span', { class: 'purr-count' }, String(n)))),
      !ext.ready && ext.error !== undefined ? h('span', { class: 'purr-muted' }, 'Other pads: indexing Elysium…') : '',
      !qx && pref.sort !== 'watch' && capped < srcTotal ? h('span', { class: 'purr-muted purr-src-note' }, `Top ${capped} of ${srcTotal} traded in 24h`) : '');
    const ownShown = pref.src === 'all' || pref.src === 'purrlysium' ? rows : [];
    const shown = ownShown.filter((r) => pref.sort !== 'watch' || wl.has(r.l.token.toLowerCase())).filter((r) => !q || r.l.token.toLowerCase() === q || r.t.symbol.toLowerCase().includes(q) || r.t.name.toLowerCase().includes(q)).sort(SORTS.find(([k]) => k === pref.sort)[2]);
    const XS = { trending: (a, b) => b.vol - a.vol, new: (a, b) => b.first - a.first, top: (a, b) => b.mcap - a.mcap, gainers: (a, b) => b.change - a.change, watch: () => 0 };
    const extSorted = extShown.slice().sort(XS[pref.sort] || XS.trending).slice(0, 100);
    list.replaceChildren(shown.length || extSorted.length ? h('div', { class: 'purr-table-wrap' }, h('table', { class: 'purr-table purr-board' },
      h('thead', {}, h('tr', {}, ...['Watch', 'Token / chain', 'Price', '24h', 'FDV', '24h vol', 'Trades', 'Chart', 'Callouts', 'Age', ''].map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, ...shown.map((r) => {
        const open = () => openCoin(r.l);
        const on = wl.has(r.l.token.toLowerCase());
        const star = h('button', { class: 'purr-star' + (on ? ' on' : ''), 'aria-pressed': String(on), 'aria-label': `${on ? 'Remove' : 'Add'} ${r.t.symbol} ${on ? 'from' : 'to'} watchlist`, onclick: (e) => { e.stopPropagation(); toggleWatch(r.l.token); draw(); } }, on ? '★' : '☆');
        const tr = h('tr', { tabindex: 0, onclick: open, onkeydown: (e) => { if (e.target === e.currentTarget && e.key === 'Enter') open(); } },
          h('td', {}, star),
          h('td', {}, h('div', { class: 'purr-board-coin' }, tint(h('span', { class: 'purr-coin-badge' }, r.t.symbol[0]), r.l.token), h('div', {}, h('a', { href: marketHref('elysium', 'trade', r.l.token), onclick: e => { if (e.ctrlKey || e.metaKey || e.shiftKey) { e.stopPropagation(); return; } e.preventDefault(); e.stopPropagation(); open(); } }, r.t.symbol), h('small', {}, `${r.t.name} · ELY`))), h('details', { onclick: e => e.stopPropagation(), onkeydown: e => e.stopPropagation() }, h('summary', {}, 'Pair & metrics'), h('p', {}, `Pair: ${S.tokens.get(r.l.key.currency0.toLowerCase() === r.l.token.toLowerCase() ? r.l.key.currency1 : r.l.key.currency0)?.symbol || 'Unavailable'} · FDV: ${money(r.x.mcap)} · Volume: ${money(r.x.vol)} · Holders: unavailable in directory`))),
          h('td', { class: 'purr-strong' }, money(r.x.price)),
          h('td', { class: r.x.change >= 0 ? 'purr-pos' : 'purr-neg' }, `${r.x.change >= 0 ? '+' : ''}${r.x.change.toFixed(1)}%`),
          h('td', {}, money(r.x.mcap)), h('td', {}, money(r.x.vol)), h('td', {}, String(r.x.buys + r.x.sells)),
          h('td', {}, spark(r.sw, r.x.open, r.x.change >= 0)),
          h('td', {}, r.calls ? h('span', { class: 'purr-count' }, String(r.calls)) : '—'),
          h('td', {}, ago(Number(r.sw[0]?.t || 0) || Date.now() / 1000)),
          h('td', {}, h('button', { class: 'purr-trade-btn', onclick: (e) => { e.stopPropagation(); open(); } }, 'Trade')));
        return tr;
      }), ...extSorted.map((c) => {
        const link = c.url || (S.m.explorer ? `${S.m.explorer.replace(/\/$/, '')}/token/${c.token}` : '');
        const go = () => openCoin({ token: c.token, poolId: null });
        const coin = h('div', { class: 'purr-board-coin' }, tint(h('span', { class: 'purr-coin-badge' }, (c.symbol || '?')[0]), c.token), h('div', {}, h('b', {}, c.symbol), h('small', {}, c.name), h('span', { class: 'purr-pad-tag' }, c.padName)));
        const sp = (() => { const pts = c.spark || []; const W = 96, H = 28, lo = Math.min(...pts), hi = Math.max(...pts), r = hi - lo || 1; const d = pts.map((p, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, pts.length - 1)) * W).toFixed(1)},${(H - 2 - ((p - lo) / r) * (H - 4)).toFixed(1)}`).join(''); return s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: `purr-spark-line ${c.change >= 0 ? 'up' : 'down'}`, 'aria-hidden': 'true' }, s('path', { d })); })();
        return h('tr', { tabindex: 0, class: 'purr-ext', onclick: go, onkeydown: (e) => { if (e.key === 'Enter') go(); } },
          h('td', {}, ''), h('td', {}, coin, h('details', { onclick: e => e.stopPropagation(), onkeydown: e => e.stopPropagation() }, h('summary', {}, 'Pair & metrics'), h('p', {}, `Elysium · WHYPE · FDV: ${money(c.mcap)} · Volume: ${money(c.vol)} · Holders: unavailable`))), h('td', { class: 'purr-strong' }, metric(c.price) === null ? 'Unavailable' : money(c.price)),
          h('td', { class: c.change >= 0 ? 'purr-pos' : 'purr-neg' }, `${c.change >= 0 ? '+' : ''}${c.change.toFixed(1)}%`),
           h('td', {}, money(c.mcap)), h('td', {}, money(c.vol)), h('td', {}, String(c.trades)), h('td', {}, sp), h('td', {}, '—'), h('td', {}, c.first ? ago(c.first) : '—'),
          h('td', {}, h('a', { class: 'purr-trade-btn', href: marketHref('elysium', 'trade', c.token), onclick: e => { e.preventDefault(); e.stopPropagation(); go(); } }, 'View token')));
      })))) : h('p', { class: 'purr-muted' }, pref.sort === 'watch' ? 'Star a coin to follow it here.' : q && /^0x[0-9a-f]{40}$/.test(q) ? 'No Hypeliysium coin at that address.' : 'No coins match.'));
  }
  search.addEventListener('input', () => { pref.q = search.value; draw(); });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = rows.find((x) => x.l.token.toLowerCase() === search.value.trim().toLowerCase()); if (r) openCoin(r.l); } });
  const kingCard = king ? h('button', { class: 'purr-king', onclick: () => openCoin(king.l) },
    h('span', { class: 'purr-king-crown', 'aria-hidden': 'true' }, '♛'),
    h('div', { class: 'purr-king-body' }, h('small', {}, 'King of the hill'), h('b', {}, king.t.symbol), h('span', {}, king.t.name)),
    h('div', { class: 'purr-king-stats' }, h('b', {}, money(king.x.mcap)), h('span', { class: king.x.change >= 0 ? 'purr-pos' : 'purr-neg' }, `${king.x.change >= 0 ? '+' : ''}${king.x.change.toFixed(1)}% 24h`)),
    spark(king.sw, king.x.open, king.x.change >= 0)) : '';
  if (king) window.dispatchEvent(new CustomEvent('purr-stats', { detail: { coins: rows.length, king: `${king.t.symbol}`, kingMc: king.x.mcap * (hypeUsd || 0) } }));
  const totals = rows.reduce((a, r) => ({ vol: a.vol + r.x.vol, trades: a.trades + r.x.buys + r.x.sells }), { vol: 0, trades: 0 });
  const wall = h('aside', { class: 'purr-panel purr-feed', id: 'purr-callouts' }, h('header', { class: 'purr-panel-head' }, h('h2', {}, 'Hot callouts'), h('span', { class: 'purr-live' }, 'Live')),
    feed.length ? h('ol', { class: 'purr-posts' }, ...feed.slice(0, 30).map((p) => {
      const r = rows.find((x) => x.l.token.toLowerCase() === p.token);
      const body = h('p', { class: 'purr-post-text' }); body.textContent = p.text;
      return h('li', { class: 'purr-post' }, tint(h('span', { class: 'purr-avatar', 'aria-hidden': 'true' }), p.address),
        h('div', { class: 'purr-post-main' }, h('div', { class: 'purr-post-head' }, h('b', { class: 'ely-mono' }, short(getAddress(p.address))), h('time', {}, ago(p.at))), body,
          h('div', { class: 'purr-post-foot' }, r ? h('button', { class: 'purr-chip', onclick: () => openCoin(r.l) }, tint(h('span', { class: 'purr-coin-badge' }, r.t.symbol[0]), r.l.token), r.t.symbol, h('span', {}, ` · MC ${money(r.x.mcap)}`)) : '', h('span', { class: 'purr-held' }, `Held $${compact(p.valueUsd)} when posted`))));
    })) : h('p', { class: 'purr-muted purr-feed-rule' }, 'No callouts yet. Hold $50+ of a coin to post the first one.'));
  main.replaceChildren(h('section', { class: 'purr-term purr-markets-page' },
    marketIntro(h, 'elysium'),
    ...(S.m.local ? [h('p', { class: 'ely-muted pad-fixture-note' }, 'Local-fork preview: own-pad coins and callouts are test fixtures.')] : []),
    h('div', { class: 'purr-board-top' }, h('div', { class: 'purr-board-totals' },
      h('div', { class: 'purr-bstat' }, h('small', {}, 'Coins'), h('b', {}, String(rows.length))),
      h('div', { class: 'purr-bstat' }, h('small', {}, 'Hypeliysium 24h volume'), h('b', {}, money(totals.vol))),
      h('div', { class: 'purr-bstat' }, h('small', {}, '24h trades'), h('b', {}, String(totals.trades))),
      h('button', { class: 'purr-go buy purr-launch-cta', onclick: () => { location.hash = '#create'; } }, 'Launch a coin'))),
    h('div', { class: 'purr-board-grid' },
      h('section', { class: 'purr-panel purr-board-panel' }, h('div', { class: 'purr-board-tools' }, search, tabs), srcBar, list),
       wall),
     h('details', { class: 'market-data-note' }, h('summary', {}, 'Market data'), h('p', { class: 'ely-muted' }, 'Elysium-only snapshot. Valuations use total supply (FDV), not verified circulating market cap. Prices and volume are in HYPE; no cross-chain totals are combined.'))));
  draw();
  const extTimer = setInterval(async () => { if (!main.isConnected) return clearInterval(extTimer); try { ext = await (await fetch('/api/purrlysium/elysium-coins')).json(); draw(); } catch {} }, 30000);
  try { if (sessionStorage.getItem('purr-focus') === 'callouts') { sessionStorage.removeItem('purr-focus'); wall.scrollIntoView({ block: 'start' }); } } catch {}
}

/// Front screen: live trade ticker across every coin, and platform totals. Refreshes every 20 s.
export async function liveStrip(ctx) {
  const { S, h, loadLaunches, tokenInfo } = ctx;
  const portal = document.querySelector('.purr-portal');
  if (!portal) return;
  const strip = h('div', { class: 'purr-ticker-strip', 'aria-label': 'Live trades' });
  const statsEl = h('div', { class: 'purr-platform', 'aria-label': 'Platform stats' });
  portal.prepend(strip); portal.append(statsEl);
  async function tick() {
    await Promise.all([loadLaunches(), loadMeta()]);
    await Promise.all(S.launches.flatMap((l) => [tokenInfo(l.key.currency0), tokenInfo(l.key.currency1)]));
    let usd = 0; try { usd = Number((await (await fetch('/api/purrlysium/callouts')).json()).hypeUsd) || 0; } catch {}
    const all = [];
    let vol = 0, allVol = 0, trades = 0;
    const now = Date.now() / 1000;
    for (const l of S.launches) {
      const sw = await loadSwaps(ctx, l);
      const x = stats(l, sw, null);
      for (const t of sw) { allVol += t.hype; if (t.t > now - 86400) { vol += t.hype; trades += 1; } }
      for (const t of sw.slice(-6)) all.push({ ...t, l, change: x.change });
    }
    const money = (v) => (usd ? `$${compact(v * usd)}` : `${compact(v)} HYPE`);
    all.sort((a, b) => b.t - a.t);
    const items = all.slice(0, 16).map((t) => {
      const sym = S.tokens.get(t.l.token).symbol;
      const a = h('a', { href: `?token=${t.l.token}#trade`, class: 'purr-tick-item' }, tint(h('span', { class: 'purr-coin-badge' }, sym[0]), t.l.token), h('b', {}, `$${sym}`), h('span', { class: t.side === 'buy' ? 'purr-pos' : 'purr-neg' }, t.side === 'buy' ? 'bought' : 'sold'), h('span', {}, `${compact(t.hype)} HYPE`), h('small', { class: t.change >= 0 ? 'purr-pos' : 'purr-neg' }, `${t.change >= 0 ? '+' : ''}${t.change.toFixed(1)}%`));
      return a;
    });
    strip.replaceChildren(items.length ? h('div', { class: 'purr-ticker-track' }, ...items, ...items.map((n) => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; return c; })) : h('span', { class: 'purr-muted' }, 'No trades yet.'));
    statsEl.replaceChildren(
      h('div', {}, h('small', {}, 'Coins launched'), h('b', {}, String(S.launches.length))),
      h('div', {}, h('small', {}, '24h volume'), h('b', {}, money(vol))),
      h('div', {}, h('small', {}, '24h trades'), h('b', {}, String(trades))),
      h('div', {}, h('small', {}, 'All-time volume'), h('b', {}, money(allVol))));
  }
  await tick().catch(() => {});
  setInterval(() => tick().catch(() => {}), 20000);
}

function coinLinks(m) {
  if (!m) return [];
  const a = (href, label) => { const el = document.createElement('a'); el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer nofollow'; el.className = 'purr-social'; el.textContent = label; return el; };
  return [m.website && a(m.website, 'Web'), m.x && a(`https://x.com/${m.x}`, 'X'), m.telegram && a(`https://t.me/${m.telegram}`, 'TG')].filter(Boolean);
}
