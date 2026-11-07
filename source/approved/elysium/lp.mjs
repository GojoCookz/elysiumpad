// HypurrSwap LP terminal: pool discovery, pool detail, strategy deposits and position management
// for the unmodified Uniswap V3 pools on Elysium. Every figure comes from contract reads or event
// logs (eth_getLogs through the read-only proxy); unknown values show as "—", never an estimate.
// No APR or yield projection is shown anywhere: only observed past fees (owner rule, 2026-11-03).
import { decodeEventLog, decodeFunctionResult, encodeEventTopics, getAddress, isAddress, zeroAddress, toHex, parseUnits } from 'viem';
import { ABI } from './abi.mjs';
import * as M from './lpmath.mjs';
import { BRAND, swapOf } from './brand.mjs';

let C; // helpers from app.mjs: S, h, rpc, read, send, call, approveIfNeeded, chainDeadline, toast, guarded, field, fmt, short, explainError, tokenInfo, render

export const IL_WARNING = 'Impermanent loss: when the price moves, your position ends up holding more of the token that fell and less of the one that rose, so it can be worth less than simply holding what you put in. Outside your range the position stops earning fees and sits 100% in one token. Fees can offset this, or not. Past fees are not a forecast.';

// ------------------------------------------------------------------------------------------
// small helpers
// ------------------------------------------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  for (const k of kids.flat()) if (k !== null && k !== undefined) el.append(k.nodeType ? k : String(k));
  return el;
}
const fp = (x) => (!Number.isFinite(x) || x <= 0 ? '—' : x >= 1e15 || x < 1e-12 ? x.toExponential(4) : x.toLocaleString('en-US', { maximumSignificantDigits: 6 }));
const pctf = (x, d = 2) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)}%` : '—');
const MAXU128 = M.MAX_U128;
const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* quota: just refetch next time */ } },
};
const topic = (abi, eventName, args) => encodeEventTopics({ abi, eventName, args });
const hs = () => swapOf(C.S.m);
const isW = (a) => a.toLowerCase() === C.S.m.whype.toLowerCase();
const sym = (t) => (isW(t.address) ? 'HYPE' : t.symbol);

async function pmap(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j], j); } }));
  return out;
}

async function getLogs(address, topics, from, to) {
  const ranges = [];
  for (let f = from; f <= to; f += 50_000n) ranges.push([f, f + 49_999n > to ? to : f + 49_999n]);
  const parts = await pmap(ranges, 4, ([a, b]) => C.rpc('eth_getLogs', [{ address, topics, fromBlock: toHex(a), toBlock: toHex(b) }]));
  return parts.flat().map((l) => ({ b: Number(l.blockNumber), i: Number(l.logIndex), x: l.transactionHash, t: l.topics, d: l.data }));
}

/// Incremental, sessionStorage-cached log scan from `from` (fixed) to head.
async function cachedLogs(key, address, topics, from, head) {
  const k = `ely:${C.S.m.chainId}:${key}`;
  const c = store.get(k);
  let logs, start;
  if (c && BigInt(c.from) <= from && BigInt(c.to) <= head) { logs = c.logs.filter((l) => l.b >= Number(from)); start = BigInt(c.to) + 1n; }
  else { logs = []; start = from; }
  if (start <= head) logs.push(...await getLogs(address, topics, start, head));
  store.set(k, { from: String(from), to: String(head), logs });
  return logs;
}
const dec = (abi, l) => decodeEventLog({ abi, data: l.d, topics: l.t }).args;

async function blockTs(n) { return Number(BigInt((await C.rpc('eth_getBlockByNumber', [toHex(n), false])).timestamp)); }

/// First block with timestamp >= ts, by binary search between lo and hi.
async function blockAt(ts, lo, hi) {
  const k = `ely:${C.S.m.chainId}:blockAt:${Math.floor(ts / 300)}`;
  const c = store.get(k);
  if (c) return BigInt(c);
  // The window only moves forward, so the last answer is a lower bound: a few probes, not ~25.
  const lastK = `ely:${C.S.m.chainId}:blockAt:last`, last = store.get(lastK);
  if (last && ts >= last.ts && BigInt(last.b) > lo && BigInt(last.b) <= hi) lo = BigInt(last.b);
  if (await blockTs(lo) >= ts) return lo;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (await blockTs(mid) >= ts) hi = mid; else lo = mid + 1n;
  }
  store.set(k, String(lo));
  store.set(lastK, { ts, b: String(lo) });
  return lo;
}

// ------------------------------------------------------------------------------------------
// data
// ------------------------------------------------------------------------------------------

async function chainHead() {
  const b = await C.rpc('eth_getBlockByNumber', ['latest', false]);
  return { head: BigInt(b.number), now: Number(BigInt(b.timestamp)) };
}

async function poolState(p) {
  const [slot0, liquidity, bal0, bal1] = await Promise.all([
    C.read(p.pool, ABI.v3Pool, 'slot0'), C.read(p.pool, ABI.v3Pool, 'liquidity'),
    C.read(p.token0.address, ABI.erc20, 'balanceOf', [p.pool]), C.read(p.token1.address, ABI.erc20, 'balanceOf', [p.pool]),
  ]);
  return { sqrtP: slot0[0], tick: Number(slot0[1]), feeProtocol: Number(slot0[5]), liquidity, bal0, bal1 };
}

async function discoverPools(head) {
  const logs = await cachedLogs(`created:${hs().factory}`, hs().factory, topic(ABI.v3Factory, 'PoolCreated'), BigInt(hs().deployBlock), head);
  return pmap(logs, 4, async (l) => {
    const a = dec(ABI.v3Factory, l);
    const [token0, token1] = await Promise.all([C.tokenInfo(getAddress(a.token0)), C.tokenInfo(getAddress(a.token1))]);
    return { pool: getAddress(a.pool), token0, token1, fee: Number(a.fee), spacing: Number(a.tickSpacing), block: l.b };
  });
}

/// HYPE pricing: WHYPE is 1:1; any other token is priced through its deepest WHYPE pool
/// (most WHYPE held). Returns a function amount → HYPE wei, or null when unpriceable.
function makePricer(pools) {
  const best = new Map();
  for (const p of pools) {
    if (!p.st || p.st.liquidity === 0n) continue;
    const w0 = isW(p.token0.address), w1 = isW(p.token1.address);
    if (w0 === w1) continue;
    const other = w0 ? p.token1.address : p.token0.address, depth = w0 ? p.st.bal0 : p.st.bal1;
    if (!best.has(other) || best.get(other).depth < depth) best.set(other, { depth, p, otherIs0: !w0 });
  }
  return (token, amount) => {
    if (amount === 0n) return 0n;
    if (isW(token)) return amount;
    const b = best.get(token);
    if (!b) return null;
    return b.otherIs0 ? M.valueInToken1(amount, 0n, b.p.st.sqrtP) : M.valueInToken0(0n, amount, b.p.st.sqrtP);
  };
}

function swapStats(p, logs, priceHype) {
  let vol0 = 0n, vol1 = 0n, fee0 = 0n, fee1 = 0n, volHype = 0n, volKnown = true;
  const fp0 = p.st.feeProtocol % 16, fp1 = p.st.feeProtocol >> 4;
  const swaps = [];
  for (const l of logs) {
    const a = dec(ABI.v3Pool, l);
    const in0 = a.amount0 > 0n;
    const amtIn = in0 ? a.amount0 : a.amount1;
    let f = (amtIn * BigInt(p.fee)) / 1_000_000n;
    const proto = in0 ? fp0 : fp1;
    if (proto) f -= f / BigInt(proto);
    if (in0) { vol0 += amtIn; fee0 += f; } else { vol1 += amtIn; fee1 += f; }
    // HYPE-paired pools: the HYPE leg of each swap is the exact HYPE volume.
    if (isW(p.token0.address)) volHype += a.amount0 < 0n ? -a.amount0 : a.amount0;
    else if (isW(p.token1.address)) volHype += a.amount1 < 0n ? -a.amount1 : a.amount1;
    else { const v = priceHype(in0 ? p.token0.address : p.token1.address, amtIn); if (v === null) volKnown = false; else volHype += v; }
    swaps.push({ b: l.b, x: l.x, in0, amount0: a.amount0, amount1: a.amount1, sqrtP: a.sqrtPriceX96, sender: a.sender });
  }
  const f0h = priceHype(p.token0.address, fee0), f1h = priceHype(p.token1.address, fee1);
  return { vol0, vol1, fee0, fee1, volHype: volKnown ? volHype : null, feeHype: f0h === null || f1h === null ? null : f0h + f1h, swaps };
}

/// Net liquidity per range from every Mint/Burn since the pool was created; in-range share is the
/// value of ranges that contain the price over the value of all ranges, at the current price.
function occupancy(p, logs) {
  const net = new Map();
  for (const l of logs) {
    const isMint = l.t[0] === topic(ABI.v3Pool, 'Mint')[0];
    const a = dec(ABI.v3Pool, l);
    const k = `${a.tickLower}:${a.tickUpper}`;
    net.set(k, (net.get(k) || 0n) + (isMint ? a.amount : -a.amount));
  }
  let inV = 0n, allV = 0n, ranges = 0;
  for (const [k, L] of net) {
    if (L <= 0n) continue;
    const [lo, hi] = k.split(':').map(Number);
    const [x, y] = M.getAmountsForLiquidity(p.st.sqrtP, M.getSqrtRatioAtTick(lo), M.getSqrtRatioAtTick(hi), L);
    const v = M.valueInToken1(x, y, p.st.sqrtP);
    allV += v; ranges++;
    if (lo <= p.st.tick && p.st.tick < hi) inV += v;
  }
  return { ranges, inRange: allV === 0n ? null : Number((inV * 10000n) / allV) / 10000 };
}

// Pool types ("venues"). Each one discovers its pools, returns rows the shared list can rank
// (venue, pool, token0, token1, tvlHype, stats, occ) and owns its own detail view and positions.
// A venue appears only when the manifest carries its deployed addresses. DLMM (Liquidity Book)
// and DAMM (v4 fee hook) plug in here once a deploy produces them; their spec, manifest keys and
// required disclosures are in labs/evm-dex/LP-TERMINAL-VENUES.md.
const VENUES = {
  v3: {
    label: 'V3',
    enabled: (m) => isAddress(swapOf(m)?.factory || ''),
    view: (main, market, p) => poolView(main, market, p),
    positions: (market, limit) => loadPositions(market, limit),
    row: (x, market) => positionRow(x, market),
  },
};
const venuesOn = () => Object.entries(VENUES).filter(([, v]) => v.enabled(C.S.m));

async function loadMarket(head, now) {
  const pools = VENUES.v3.enabled(C.S.m) ? (await discoverPools(head)).filter(Boolean).map((p) => ({ ...p, venue: 'v3' })) : [];
  await pmap(pools, 4, async (p) => { p.st = await poolState(p); });
  const priceHype = makePricer(pools);
  const b24 = await blockAt(now - 86_400, BigInt(hs().deployBlock), head);
  const mintT = topic(ABI.v3Pool, 'Mint')[0], burnT = topic(ABI.v3Pool, 'Burn')[0];
  await pmap(pools, 3, async (p) => {
    const from = BigInt(p.block) > b24 ? BigInt(p.block) : b24;
    const swapLogs = await cachedLogs(`swaps:${p.pool}`, p.pool, topic(ABI.v3Pool, 'Swap'), from, head);
    p.stats = swapStats(p, swapLogs.filter((l) => BigInt(l.b) >= b24), priceHype);
    p.youngerThan24h = BigInt(p.block) > b24;
    const lp = await cachedLogs(`mintburn:${p.pool}`, p.pool, [[mintT, burnT]], BigInt(p.block), head);
    p.occ = occupancy(p, lp);
    const v0 = priceHype(p.token0.address, p.st.bal0), v1 = priceHype(p.token1.address, p.st.bal1);
    p.tvlHype = v0 === null || v1 === null ? null : v0 + v1;
  });
  return { pools, head, now, b24, priceHype };
}

// ------------------------------------------------------------------------------------------
// orientation: show price as quote per base (HYPE per token on HYPE pairs)
// ------------------------------------------------------------------------------------------

function orient(p) {
  // Base = the non-HYPE token (token0 when neither is HYPE, unless the user flipped the pair).
  let b0 = !isW(p.token0.address);
  if (!isW(p.token0.address) && !isW(p.token1.address) && C.S.lpInvert?.[p.pool]) b0 = !b0;
  const base = b0 ? p.token0 : p.token1, quote = b0 ? p.token1 : p.token0;
  const d0 = p.token0.decimals, d1 = p.token1.decimals;
  const disp = (sqrtP) => { const x = M.sqrtToPriceFloat(sqrtP, d0, d1); return b0 ? x : 1 / x; };
  const tickDisp = (t) => { const x = M.tickToPriceFloat(t, d0, d1); return b0 ? x : 1 / x; };
  // display price → (unsnapped) tick
  const dispTick = (x) => { const p1 = b0 ? x : 1 / x; return Math.floor(Math.log(p1 * 10 ** (d1 - d0)) / Math.log(1.0001)); };
  return { b0, base, quote, disp, tickDisp, dispTick, pair: `${sym(base)}/${sym(quote)}` };
}

// ------------------------------------------------------------------------------------------
// charts (SVG attributes only: the page CSP forbids inline styles)
// ------------------------------------------------------------------------------------------

function distributionChart(p, o, segs, view, overlay = []) {
  const W = 600, H = 170;
  const [vlo, vhi] = view;
  const X = (t) => { const r = (Math.min(Math.max(t, vlo), vhi) - vlo) / (vhi - vlo); return (o.b0 ? r : 1 - r) * W; };
  const maxL = [...segs, ...overlay].reduce((m, s) => (s.L > m ? s.L : m), 1n);
  const Y = (L) => H - Number((L * BigInt(H - 12)) / maxL);
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ely-chart', role: 'img', preserveAspectRatio: 'none', 'aria-label': `Liquidity by price for ${o.pair}` });
  for (const s of segs) {
    if (s.hi <= vlo || s.lo >= vhi || s.L <= 0n) continue;
    const x1 = X(s.lo), x2 = X(s.hi);
    g.append(svg('rect', { x: Math.min(x1, x2), y: Y(s.L), width: Math.max(1, Math.abs(x2 - x1) - 0.5), height: H - Y(s.L), class: s.lo <= p.st.tick && p.st.tick < s.hi ? 'bar on' : 'bar' }));
  }
  for (const s of overlay) {
    if (s.hi <= vlo || s.lo >= vhi || s.L <= 0n) continue;
    const x1 = X(s.lo), x2 = X(s.hi);
    g.append(svg('rect', { x: Math.min(x1, x2), y: Y(s.L), width: Math.max(1, Math.abs(x2 - x1)), height: H - Y(s.L), class: 'mine' }));
  }
  const xc = X(p.st.tick);
  g.append(svg('line', { x1: xc, x2: xc, y1: 0, y2: H, class: 'now' }));
  return g;
}

function priceChart(o, swaps) {
  const W = 600, H = 140;
  if (swaps.length < 2) return null;
  const pts = swaps.map((s) => [s.b, o.disp(s.sqrtP)]);
  const b0 = pts[0][0], b1 = pts.at(-1)[0] || b0 + 1;
  const ys = pts.map((q) => q[1]), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || hi || 1;
  const d = pts.map(([b, y], i) => `${i ? 'L' : 'M'}${(((b - b0) / Math.max(1, b1 - b0)) * W).toFixed(1)},${(H - 8 - ((y - lo) / span) * (H - 16)).toFixed(1)}`).join(' ');
  return { el: svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ely-chart', role: 'img', preserveAspectRatio: 'none', 'aria-label': `${o.pair} price from swaps` }, svg('path', { d, class: 'line' })), lo, hi, from: b0, to: b1 };
}

async function tickSegments(p) {
  const word = Math.floor(Math.floor(p.st.tick / p.spacing) / 256);
  const words = [-2, -1, 0, 1, 2].map((d) => word + d).filter((w) => w >= -32768 && w <= 32767);
  const lens = hs().tickLens;
  const ticks = (await Promise.all(words.map((w) => C.read(lens, ABI.tickLens, 'getPopulatedTicksInWord', [p.pool, w])))).flat()
    .map((t) => ({ tick: Number(t.tick), net: t.liquidityNet })).sort((a, b) => a.tick - b.tick);
  const lo = words[0] * 256 * p.spacing, hi = (words.at(-1) + 1) * 256 * p.spacing;
  if (!ticks.length) return { segs: [{ lo, hi, L: p.st.liquidity }], window: [lo, hi] };
  // Active L applies to the segment holding the current tick; walk outward with liquidityNet.
  const bounds = [lo, ...ticks.map((t) => t.tick), hi];
  const L = new Array(bounds.length - 1).fill(0n);
  let idx = 0;
  for (let i = 0; i < ticks.length; i++) if (ticks[i].tick <= p.st.tick) idx = i + 1;
  L[idx] = p.st.liquidity;
  for (let j = idx + 1; j < L.length; j++) L[j] = L[j - 1] + ticks[j - 1].net;
  for (let j = idx - 1; j >= 0; j--) L[j] = L[j + 1] - ticks[j].net;
  return { segs: L.map((v, j) => ({ lo: bounds[j], hi: bounds[j + 1], L: v })), window: [lo, hi] };
}

/// Summed L of a set of legs as non-overlapping segments (for the overlay).
function legSegments(legs) {
  const pts = [...new Set(legs.flatMap((l) => [l.tickLower, l.tickUpper]))].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const L = legs.reduce((s, l) => (l.tickLower <= pts[i] && pts[i + 1] <= l.tickUpper ? s + l.liquidity : s), 0n);
    out.push({ lo: pts[i], hi: pts[i + 1], L });
  }
  return out;
}

// ------------------------------------------------------------------------------------------
// entry
// ------------------------------------------------------------------------------------------

export async function lp(main, ctx) {
  C = ctx;
  C.S.lpInvert ||= {};
  // Everything is a pure function of chain state, so one load per block is enough: switching
  // views or tabs inside the same block reuses it; any confirmed transaction moves the head.
  const { head, now } = await chainHead();
  let market = C.S.lpMarket;
  if (!market || market.head !== head) { market = await loadMarket(head, now); C.S.lpMarket = market; }
  const sel = C.S.lpPool && market.pools.find((p) => p.pool.toLowerCase() === C.S.lpPool.toLowerCase());
  if (C.S.lpPool && C.S.lpPool.startsWith('new:')) return newPoolView(main, market);
  if (sel) return VENUES[sel.venue].view(main, market, sel);
  return listView(main, market);
}

const go = (pool) => { C.S.lpPool = pool; history.replaceState(null, '', pool ? `#lp/${pool}` : '#lp'); C.render(); };

function listView(main, market) {
  const { h, fmt } = C;
  const rows = [...market.pools].sort((a, b) => ((b.tvlHype ?? -1n) > (a.tvlHype ?? -1n) ? 1 : -1));
  const head = ['Pool', 'TVL', '24h volume', '24h fees', 'Fees ÷ TVL (24h)', 'Price', 'In range'];
  const cards = rows.map((p) => {
    const o = orient(p);
    const ratio = p.tvlHype && p.stats.feeHype !== null && p.tvlHype > 0n ? Number((p.stats.feeHype * 1_000_000n) / p.tvlHype) / 1e6 : null;
    const age = p.youngerThan24h ? ' (pool younger than 24h: since creation)' : '';
    const cells = [
      h('span', { class: 'ely-pair' }, o.pair, h('small', {}, `${VENUES[p.venue].label} · ${p.fee / 10000}%`)),
      p.tvlHype === null ? '—' : `${fmt(p.tvlHype, 18, 4)} HYPE`,
      p.stats.volHype === null ? '—' : `${fmt(p.stats.volHype, 18, 4)} HYPE${age}`,
      p.stats.feeHype === null ? '—' : `${fmt(p.stats.feeHype, 18, 6)} HYPE`,
      ratio === null ? '—' : `${(ratio * 100).toFixed(3)}%`,
      `${fp(o.disp(p.st.sqrtP))} ${sym(o.quote)}`,
      p.occ.inRange === null ? '—' : `${(p.occ.inRange * 100).toFixed(1)}% · ${p.occ.ranges} range${p.occ.ranges === 1 ? '' : 's'}`,
    ];
    return h('button', { class: 'ely-pool', onclick: () => go(p.pool), 'aria-label': `Open ${o.pair} ${p.fee / 10000}% pool` },
      ...cells.map((c, i) => h('span', { class: 'ely-cell', 'data-k': head[i] }, c)));
  });
  const openTok = h('input', { placeholder: 'Token address (paired with HYPE)', value: '' });
  const openFee = h('select', {}, ...hs().feeTiers.map((x) => h('option', { value: x, selected: x === 3000 }, `${x / 10000}%`)));
  const openBtn = h('button', { class: 'ely-btn' }, 'Open pool');
  openBtn.addEventListener('click', () => C.guarded(openBtn, async () => {
    const a = openTok.value.trim();
    if (!isAddress(a)) throw new Error('Enter a token address.');
    const t = getAddress(a);
    const pool = await C.read(hs().factory, ABI.v3Factory, 'getPool', [C.S.m.whype, t, Number(openFee.value)]);
    go(pool !== zeroAddress ? pool : `new:${t}:${openFee.value}`);
  }));
  main.replaceChildren(
    h('section', { class: 'ely-card' }, h('h2', {}, `${BRAND.dex} liquidity`),
      h('p', { class: 'ely-muted' }, `Concentrated-liquidity pools (Uniswap V3, unmodified). All figures from chain: TVL is the pool's token balances valued in HYPE through HYPE pools; volume and fees are summed from Swap events since block ${market.b24} (24 h by chain time). Past fees only, never a forecast. "In range" is the share of deposited value whose range holds the current price.`),
      rows.length ? h('div', { class: 'ely-pools', role: 'list' }, h('div', { class: 'ely-pool head', 'aria-hidden': 'true' }, ...head.map((x) => h('span', { class: 'ely-cell' }, x))), ...cards)
        : h('p', { class: 'ely-muted' }, `No ${BRAND.dex} pools yet. Open the first one below.`),
      h('div', { class: 'ely-row' }, C.field('Open a pool for a token', openTok), C.field('Fee tier', openFee), openBtn)),
    positionsCard(market));
}

// ------------------------------------------------------------------------------------------
// pool detail + add liquidity
// ------------------------------------------------------------------------------------------

async function newPoolView(main, market) {
  const [, token, fee] = C.S.lpPool.split(':');
  const t = await C.tokenInfo(getAddress(token)), w = await C.tokenInfo(getAddress(C.S.m.whype));
  const [token0, token1] = BigInt(t.address) < BigInt(w.address) ? [t, w] : [w, t];
  const p = { venue: 'v3', pool: zeroAddress, token0, token1, fee: Number(fee), spacing: M.TICK_SPACING[fee], fresh: true, st: null, stats: { swaps: [] }, occ: { ranges: 0, inRange: null } };
  return poolView(main, market, p);
}

async function poolView(main, market, p) {
  const { h, fmt } = C;
  const o = orient(p);
  const back = h('button', { class: 'ely-btn', onclick: () => go(null) }, '← All pools');
  const flip = !isW(p.token0.address) && !isW(p.token1.address)
    ? h('button', { class: 'ely-btn', onclick: () => { C.S.lpInvert[p.pool] = !C.S.lpInvert[p.pool]; C.render(); } }, 'Flip price')
    : null;
  const headCard = h('section', { class: 'ely-card' }, h('div', { class: 'ely-row' }, back, flip),
    h('h2', {}, `${o.pair} · ${p.fee / 10000}%`, p.fresh ? ' · new pool' : ''));
  if (p.fresh) {
    headCard.append(h('p', { class: 'ely-muted' }, `No ${o.pair} pool at this fee tier yet. Your deposit creates it at the starting price you enter. Check that price carefully: the first deposit sets it for everyone.`));
    main.replaceChildren(headCard, addCard(p, o, null));
    return;
  }
  const dist = await tickSegments(p);
  const priceNow = o.disp(p.st.sqrtP);
  const stat = (k, v) => h('div', { class: 'ely-stat' }, h('small', {}, k), h('b', {}, v));
  headCard.append(h('div', { class: 'ely-stats' },
    stat('Price', `${fp(priceNow)} ${sym(o.quote)} per ${sym(o.base)}`),
    stat('TVL', p.tvlHype === null ? '—' : `${fmt(p.tvlHype, 18, 4)} HYPE`),
    stat('Pool holds', `${fmt(p.st.bal0, p.token0.decimals, 4)} ${sym(p.token0)} + ${fmt(p.st.bal1, p.token1.decimals, 4)} ${sym(p.token1)}`),
    stat(p.youngerThan24h ? 'Volume since creation' : '24h volume', p.stats.volHype === null ? '—' : `${fmt(p.stats.volHype, 18, 4)} HYPE`),
    stat(p.youngerThan24h ? 'LP fees since creation' : '24h LP fees', `${fmt(p.stats.fee0, p.token0.decimals, 6)} ${sym(p.token0)} + ${fmt(p.stats.fee1, p.token1.decimals, 6)} ${sym(p.token1)}`),
    stat('Active liquidity (L)', p.st.liquidity.toLocaleString('en-US')),
    stat('In range', p.occ.inRange === null ? '—' : `${(p.occ.inRange * 100).toFixed(1)}% of value · ${p.occ.ranges} ranges`),
    stat('Tick · spacing', `${p.st.tick} · ${p.spacing}`)));

  const chartBox = h('div', { class: 'ely-chartbox' });
  const pc = priceChart(o, p.stats.swaps);
  const priceCard = h('section', { class: 'ely-card' }, h('h3', {}, 'Price (from swaps in the last 24 h)'),
    pc ? [pc.el, h('div', { class: 'ely-axis' }, h('span', {}, `block ${pc.from}`), h('span', {}, `low ${fp(pc.lo)} · high ${fp(pc.hi)} ${sym(o.quote)}`), h('span', {}, `block ${pc.to}`))]
      : h('p', { class: 'ely-muted' }, p.stats.swaps.length ? 'One swap in the window: not enough points for a chart.' : 'No swaps in the last 24 h.'));
  const swapsCard = h('section', { class: 'ely-card' }, h('h3', {}, 'Recent swaps'),
    p.stats.swaps.length ? h('table', { class: 'ely-table' }, h('tr', {}, ...['Block', 'Side', sym(p.token0), sym(p.token1), `Price (${sym(o.quote)})`, 'Trader'].map((x) => h('th', {}, x))),
      ...p.stats.swaps.slice(-25).reverse().map((s) => {
        const baseIn = o.b0 ? s.in0 : !s.in0;
        return h('tr', {}, h('td', {}, String(s.b)), h('td', { class: baseIn ? 'ely-bad' : 'ely-good' }, baseIn ? `Sell ${sym(o.base)}` : `Buy ${sym(o.base)}`),
          h('td', {}, fmt(s.amount0 < 0n ? -s.amount0 : s.amount0, p.token0.decimals, 4)), h('td', {}, fmt(s.amount1 < 0n ? -s.amount1 : s.amount1, p.token1.decimals, 4)),
          h('td', {}, fp(o.disp(s.sqrtP))), h('td', { class: 'ely-mono' }, C.short(s.sender)));
      }))
      : h('p', { class: 'ely-muted' }, 'No swaps in the last 24 h.'));
  main.replaceChildren(headCard,
    h('section', { class: 'ely-card' }, h('h3', {}, 'Liquidity by price'), chartBox,
      h('p', { class: 'ely-muted' }, 'Bars: active liquidity L per tick range, read with TickLens and walked out from the pool\'s current L. Line: current price. Outline: the shape you are about to add.')),
    addCard(p, o, { dist, chartBox }), priceCard, swapsCard, positionsCard(market, p.pool));
}

function addCard(p, o, chart) {
  const { h, fmt } = C;
  const s = p.spacing;
  const native = isW(p.token0.address) || isW(p.token1.address);
  const startPrice = h('input', { inputmode: 'decimal', placeholder: `${sym(o.quote)} per ${sym(o.base)}` });
  const refPrice = h('input', { inputmode: 'decimal', placeholder: `${sym(o.quote)} per ${sym(o.base)}` });
  const kind = h('div', { class: 'ely-seg', role: 'radiogroup', 'aria-label': 'Strategy' });
  const legsSel = h('select', {}, ...[2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: n === 4 }, `${n} positions`)));
  const minP = h('input', { inputmode: 'decimal' }), maxP = h('input', { inputmode: 'decimal' });
  const amtBase = h('input', { inputmode: 'decimal', placeholder: '0.0', autocomplete: 'off' });
  const amtQuote = h('input', { inputmode: 'decimal', placeholder: '0.0', autocomplete: 'off' });
  const useNative = h('input', { type: 'checkbox', checked: native });
  const slip = h('select', {}, ...[50, 100, 300, 500].map((b) => h('option', { value: b, selected: BigInt(b) === C.S.slippageBps }, `${b / 100}%`)));
  const ack = h('input', { type: 'checkbox' });
  const preview = h('div', { class: 'ely-quote', 'aria-live': 'polite' }, '—');
  const ilBox = h('div', { class: 'ely-il', role: 'note' });
  const balBase = h('small', {}), balQuote = h('small', {});
  const go2 = h('button', { class: 'ely-btn primary', disabled: true }, 'Add liquidity');
  const f = { kind: 'spot', tl: 0, tu: 0, pct: 0.1 };
  let plan = null;

  const st = () => {
    if (!p.fresh) return p.st;
    let sqrtP;
    try { sqrtP = M.priceToSqrtX96(startPrice.value, p.token0.decimals, p.token1.decimals, !o.b0); } catch { return null; }
    return { sqrtP, tick: M.getTickAtSqrtRatio(sqrtP), liquidity: 0n };
  };
  const baseIdx = o.b0 ? 0 : 1;
  const setRangeFromPct = (pct) => {
    const cur = st(); if (!cur) return;
    f.pct = pct;
    if (pct === 'full') { f.tl = M.minUsableTick(s); f.tu = M.maxUsableTick(s); }
    else {
      const P = o.disp(cur.sqrtP);
      const a = o.dispTick(P * (1 - pct)), b = o.dispTick(P * (1 + pct));
      f.tl = M.floorTick(Math.min(a, b), s); f.tu = M.floorTick(Math.max(a, b), s) + s;
      if (f.tu > M.maxUsableTick(s)) f.tu = M.maxUsableTick(s);
    }
    syncPrices(); refresh();
  };
  const oneSided = (which) => {
    const cur = st(); if (!cur) return;
    const w = Math.max(s, Math.round(((f.tu - f.tl) || 20 * s) / 2 / s) * s);
    // token0-only ranges sit above the price's tick, token1-only at or below it.
    const want0 = (which === 'base') === o.b0;
    if (want0) { f.tl = M.floorTick(cur.tick, s) + s; f.tu = Math.min(M.maxUsableTick(s), f.tl + w); }
    else { f.tu = M.floorTick(cur.tick, s); f.tl = Math.max(M.minUsableTick(s), f.tu - w); }
    if (f.kind === 'curve') setKind('spot');
    syncPrices(); refresh();
  };
  const syncPrices = () => {
    const a = o.tickDisp(f.tl), b = o.tickDisp(f.tu);
    const full = f.tl === M.minUsableTick(s) && f.tu === M.maxUsableTick(s);
    minP.value = full ? '0' : String(Number(Math.min(a, b).toPrecision(8)));
    maxP.value = full ? '∞' : String(Number(Math.max(a, b).toPrecision(8)));
  };
  const priceEdited = () => {
    const lo = Number(minP.value), hi = maxP.value.trim() === '∞' ? Infinity : Number(maxP.value);
    if (!(lo >= 0) || !(hi > lo)) return;
    const ta = lo === 0 ? (o.b0 ? M.MIN_TICK : M.MAX_TICK) : o.dispTick(lo);
    const tb = hi === Infinity ? (o.b0 ? M.MAX_TICK : M.MIN_TICK) : o.dispTick(hi);
    f.tl = M.floorTick(Math.min(ta, tb), s); f.tu = Math.min(M.maxUsableTick(s), M.floorTick(Math.max(ta, tb), s) + s);
    if (f.tl >= f.tu) f.tu = f.tl + s;
    syncPrices(); refresh();
  };
  const setKind = (k) => {
    f.kind = k;
    for (const b of kind.children) b.setAttribute('aria-checked', String(b.dataset.k === k));
    legsSel.disabled = k === 'spot';
    refresh();
  };
  for (const [k, label, hint] of [['spot', 'Spot', 'one range, even liquidity'], ['curve', 'Curve', 'nested ranges, most liquidity near the price'], ['bidask', 'Bid-Ask', 'single-sided ranges, most liquidity at the edges']]) {
    kind.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === 'spot'), 'data-k': k, title: hint, onclick: () => setKind(k) }, h('b', {}, label), h('small', {}, hint)));
  }
  const presets = h('div', { class: 'ely-chips' },
    ...[0.01, 0.05, 0.1, 0.25, 0.5].map((x) => h('button', { type: 'button', class: 'ely-chip', onclick: () => setRangeFromPct(x) }, `±${x * 100}%`)),
    h('button', { type: 'button', class: 'ely-chip', onclick: () => setRangeFromPct('full') }, 'Full range'),
    h('button', { type: 'button', class: 'ely-chip', onclick: () => oneSided('base') }, `Only ${sym(o.base)} (above price)`),
    h('button', { type: 'button', class: 'ely-chip', onclick: () => oneSided('quote') }, `Only ${sym(o.quote)} (below price)`));

  const parse = (inp, t) => { try { return parseUnits((inp.value || '0').trim(), t.decimals); } catch { return null; } };
  const amounts = () => {
    const b = parse(amtBase, o.base), q = parse(amtQuote, o.quote);
    if (b === null || q === null) return null;
    return o.b0 ? [b, q] : [q, b];
  };
  const autoPair = (from) => {
    const cur = st(); if (!cur || f.kind === 'bidask' || f.tl >= f.tu) return;
    const src = from === 'base' ? amtBase : amtQuote, dst = from === 'base' ? amtQuote : amtBase;
    const t = from === 'base' ? o.base : o.quote, other = from === 'base' ? o.quote : o.base;
    const v = parse(src, t); if (v === null) return;
    const side = (from === 'base') === o.b0 ? 0 : 1;
    try {
      const x = M.pairedAmount({ kind: f.kind, sqrtP: cur.sqrtP, tick: cur.tick, spacing: s, lower: f.tl, upper: f.tu, n: Number(legsSel.value), side, amount: v });
      dst.value = x === 0n ? '0' : C.fmt(x, other.decimals, Math.min(other.decimals, 12)).replace(/,/g, '');
    } catch { /* curve outside price etc.: refresh() explains */ }
  };

  async function balances() {
    if (!C.S.account) { balBase.textContent = ''; balQuote.textContent = ''; return; }
    const bal = async (t) => (isW(t.address) && useNative.checked ? BigInt(await C.rpc('eth_getBalance', [C.S.account, 'latest'])) : C.read(t.address, ABI.erc20, 'balanceOf', [C.S.account]));
    const [b, q] = await Promise.all([bal(o.base), bal(o.quote)]);
    balBase.textContent = `Wallet: ${fmt(b, o.base.decimals, 6)} ${sym(o.base)}${isW(o.base.address) && !useNative.checked ? ' (WHYPE)' : ''}`;
    balQuote.textContent = `Wallet: ${fmt(q, o.quote.decimals, 6)} ${sym(o.quote)}${isW(o.quote.address) && !useNative.checked ? ' (WHYPE)' : ''}`;
  }

  function refresh() {
    plan = null; go2.disabled = true;
    const cur = st();
    if (!cur) { preview.textContent = p.fresh ? 'Enter a starting price.' : '—'; return; }
    const am = amounts();
    if (!am) { preview.textContent = 'Enter amounts as numbers.'; return; }
    if (f.tl >= f.tu) { preview.textContent = 'Pick a range.'; return; }
    let legs;
    try { legs = M.splitStrategy({ kind: f.kind, amount0: am[0], amount1: am[1], sqrtP: cur.sqrtP, tick: cur.tick, spacing: s, lower: f.tl, upper: f.tu, n: Number(legsSel.value) }); }
    catch (e) { preview.textContent = e.message; return; }
    const rows = legs.map((l) => {
      let pm; try { pm = M.previewMint(cur.sqrtP, cur.tick, l.tickLower, l.tickUpper, l.amount0, l.amount1); } catch { pm = { liquidity: 0n, amount0: 0n, amount1: 0n }; }
      return { ...l, ...pm };
    });
    const used0 = rows.reduce((a, r) => a + r.amount0, 0n), used1 = rows.reduce((a, r) => a + r.amount1, 0n);
    const live = rows.filter((r) => r.liquidity > 0n);
    const dispRange = (r) => { const a = o.tickDisp(r.tickLower), b = o.tickDisp(r.tickUpper); return `${fp(Math.min(a, b))} – ${r.tickUpper >= M.maxUsableTick(s) || r.tickLower <= M.minUsableTick(s) ? (r.tickLower <= M.minUsableTick(s) && r.tickUpper >= M.maxUsableTick(s) ? 'full range' : fp(Math.max(a, b))) : fp(Math.max(a, b))}`; };
    const t0 = p.token0, t1 = p.token1;
    preview.replaceChildren(
      h('table', { class: 'ely-table' }, h('caption', {}, `Exact preview from LiquidityAmounts at the current price (tick ${cur.tick})`),
        h('tr', {}, ...['Range', 'Liquidity', `Uses ${sym(t0)}`, `Uses ${sym(t1)}`].map((x) => h('th', {}, x))),
        ...rows.map((r) => h('tr', {}, h('td', {}, dispRange(r)), h('td', {}, r.liquidity === 0n ? 'too small' : r.liquidity.toLocaleString('en-US')), h('td', {}, fmt(r.amount0, t0.decimals, 6)), h('td', {}, fmt(r.amount1, t1.decimals, 6))))),
      h('span', {}, `Total in: ${fmt(used0, t0.decimals, 6)} ${sym(t0)} + ${fmt(used1, t1.decimals, 6)} ${sym(t1)}. Not used (stays in your wallet${native && useNative.checked ? ', HYPE refunded in the same transaction' : ''}): ${fmt(am[0] - used0, t0.decimals, 6)} ${sym(t0)} + ${fmt(am[1] - used1, t1.decimals, 6)} ${sym(t1)}.`));
    // IL scenarios for the whole shape (illustration, fees excluded).
    const ks = [0.5, 0.75, 1.25, 2];
    const baseMove = (k) => (o.b0 ? k : 1 / k); // a k× move in the displayed price
    ilBox.replaceChildren(h('strong', {}, 'Before you deposit'), h('p', {}, IL_WARNING),
      live.length ? h('table', { class: 'ely-table' }, h('caption', {}, `Your shape vs just holding the same tokens if the ${sym(o.base)} price moves (math, fees excluded, not a forecast)`),
        h('tr', {}, ...ks.map((k) => h('th', {}, `${pctf(k - 1, 0)}`))),
        h('tr', {}, ...ks.map((k) => h('td', {}, pctf(M.shapeVsHodlFloat(live, cur.tick, baseMove(k)), 2))))) : null);
    if (chart) {
      const view0 = chart.dist.window;
      const pad = Math.max(10 * s, Math.round((f.tu - f.tl) * 0.15));
      const lo = Math.max(view0[0], Math.min(f.tl - pad, cur.tick - 40 * s)), hi = Math.min(view0[1], Math.max(f.tu + pad, cur.tick + 40 * s));
      const a = o.tickDisp(lo), b = o.tickDisp(hi);
      chart.chartBox.replaceChildren(distributionChart(p, o, chart.dist.segs, [lo, hi], legSegments(live)),
        h('div', { class: 'ely-axis' }, h('span', {}, fp(Math.min(a, b))), h('span', {}, `now ${fp(o.disp(cur.sqrtP))} ${sym(o.quote)}`), h('span', {}, fp(Math.max(a, b)))));
    }
    if (!live.length) { preview.append(h('p', { class: 'ely-bad' }, 'Nothing to add: amounts are zero or too small for this range.')); return; }
    plan = { cur, legs: live, am, native: native && useNative.checked };
    go2.disabled = !ack.checked;
  }

  go2.addEventListener('click', () => C.guarded(go2, async () => {
    if (!C.S.account) throw new Error('Connect a wallet first.');
    if (!ack.checked) throw new Error('Tick the impermanent-loss box first.');
    if (!plan) throw new Error('Nothing to add.');
    const slipBps = BigInt(slip.value);
    const t0 = p.token0, t1 = p.token1;
    let poolAddr = p.pool;
    let cur = plan.cur;
    // Price guard: the pool must still be where the preview was computed, within slippage.
    if (p.fresh) {
      poolAddr = await C.read(hs().factory, ABI.v3Factory, 'getPool', [t0.address, t1.address, p.fee]);
      if (poolAddr !== zeroAddress) { go(poolAddr); throw new Error('Someone created this pool meanwhile. Reloaded: check its price before adding.'); }
    } else {
      const [slot0, liq] = await Promise.all([C.read(p.pool, ABI.v3Pool, 'slot0'), C.read(p.pool, ABI.v3Pool, 'liquidity')]);
      const a = slot0[0] * slot0[0], b = plan.cur.sqrtP * plan.cur.sqrtP;
      if ((a > b ? a - b : b - a) * 10000n > b * slipBps) throw new Error(`Pool price moved more than ${Number(slipBps) / 100}% since the preview. Not adding; the preview has been refreshed.`);
      if (liq === 0n) {
        // Empty but initialised pool: anyone could have set a bad price. Make the LP confirm it.
        const ref = Number(refPrice.value);
        const now = o.disp(slot0[0]);
        if (!(ref > 0)) throw new Error(`This pool is empty: type the price you expect (${sym(o.quote)} per ${sym(o.base)}) in "Reference price" so a bad starting price cannot catch you.`);
        if (Math.abs(now - ref) / ref > 0.02) throw new Error(`Pool price ${fp(now)} is more than 2% from your ${ref}. Someone may have initialised it at a bad price. Not adding liquidity.`);
      }
      cur = { sqrtP: slot0[0], tick: Number(slot0[1]) };
    }
    // d = desired (what the NPM may pull), u = exact amounts the pool takes at this price. A token
    // a leg cannot use (out-of-range side) is not offered to it, so it is never approved or sent.
    const legs = M.splitStrategy({ kind: f.kind, amount0: plan.am[0], amount1: plan.am[1], sqrtP: cur.sqrtP, tick: cur.tick, spacing: s, lower: f.tl, upper: f.tu, n: Number(legsSel.value) })
      .map((l) => {
        const pm = M.previewMint(cur.sqrtP, cur.tick, l.tickLower, l.tickUpper, l.amount0, l.amount1);
        return { tickLower: l.tickLower, tickUpper: l.tickUpper, liquidity: pm.liquidity, u0: pm.amount0, u1: pm.amount1, d0: pm.amount0 ? l.amount0 : 0n, d1: pm.amount1 ? l.amount1 : 0n };
      }).filter((l) => l.liquidity > 0n);
    if (!legs.length) throw new Error('Nothing to add at the current price.');
    const want0 = legs.reduce((a, l) => a + l.d0, 0n), want1 = legs.reduce((a, l) => a + l.d1, 0n);
    const npm = hs().positionManager;
    let value = 0n;
    for (const [t, want] of [[t0, want0], [t1, want1]]) {
      if (want === 0n) continue;
      if (isW(t.address) && plan.native) {
        const bal = BigInt(await C.rpc('eth_getBalance', [C.S.account, 'latest']));
        if (bal < want) throw new Error(`Not enough HYPE: need ${fmt(want)} plus gas.`);
        value = want;
      } else {
        const bal = await C.read(t.address, ABI.erc20, 'balanceOf', [C.S.account]);
        if (bal < want) throw new Error(`Not enough ${sym(t)}${isW(t.address) ? ' (WHYPE)' : ''}: have ${fmt(bal, t.decimals, 6)}, need ${fmt(want, t.decimals, 6)}.`);
        await C.approveIfNeeded(t.address, npm, want, isW(t.address) ? 'WHYPE' : t.symbol);
      }
    }
    const deadline = await C.chainDeadline();
    const calls = [];
    if (p.fresh) calls.push(C.call(ABI.npm, 'createAndInitializePoolIfNecessary', [t0.address, t1.address, p.fee, cur.sqrtP]));
    for (const l of legs) {
      calls.push(C.call(ABI.npm, 'mint', [{
        token0: t0.address, token1: t1.address, fee: p.fee, tickLower: l.tickLower, tickUpper: l.tickUpper,
        amount0Desired: l.d0, amount1Desired: l.d1,
        amount0Min: (l.u0 * (10000n - slipBps)) / 10000n, amount1Min: (l.u1 * (10000n - slipBps)) / 10000n,
        recipient: C.S.account, deadline,
      }]));
    }
    if (value > 0n) calls.push(C.call(ABI.npm, 'refundETH', []));
    await C.send(`Add ${o.pair} liquidity (${legs.length} position${legs.length === 1 ? '' : 's'})`, { to: npm, value, data: C.call(ABI.npm, 'multicall', [calls]) });
    if (p.fresh) go(await C.read(hs().factory, ABI.v3Factory, 'getPool', [t0.address, t1.address, p.fee]));
    else C.render();
  }));

  amtBase.addEventListener('input', () => { autoPair('base'); refresh(); });
  amtQuote.addEventListener('input', () => { autoPair('quote'); refresh(); });
  for (const el of [minP, maxP]) el.addEventListener('change', priceEdited);
  legsSel.addEventListener('change', () => { autoPair('base'); refresh(); });
  slip.addEventListener('change', () => { C.S.slippageBps = BigInt(slip.value); });
  ack.addEventListener('change', () => { go2.disabled = !(ack.checked && plan); });
  useNative.addEventListener('change', () => { balances().catch(() => {}); refresh(); });
  startPrice.addEventListener('input', () => { if (st()) setRangeFromPct(f.pct); else refresh(); });
  legsSel.disabled = true;

  const card = h('section', { class: 'ely-card' }, h('h2', {}, 'Add liquidity'),
    p.fresh ? C.field(`Starting price (${sym(o.quote)} per ${sym(o.base)})`, startPrice, 'Sets the pool\'s first price. Arbitrageurs will trade against a wrong price at your expense.') : null,
    C.field('Strategy', kind, 'Curve and Bid-Ask are built from several V3 positions (one NFT each; more positions cost more gas).'),
    h('div', { class: 'ely-row' }, C.field('Positions', legsSel)),
    C.field('Range', presets),
    h('div', { class: 'ely-row' }, C.field(`Min price (${sym(o.quote)} per ${sym(o.base)})`, minP), C.field(`Max price (${sym(o.quote)} per ${sym(o.base)})`, maxP)),
    h('div', { class: 'ely-row' }, C.field(`${sym(o.base)} amount`, amtBase, balBase), C.field(`${sym(o.quote)} amount`, amtQuote, balQuote)),
    h('div', { class: 'ely-row' },
      native ? h('label', { class: 'ely-check' }, useNative, ' Pay with native HYPE (wrapped in the same transaction, unused HYPE refunded)') : null,
      C.field('Slippage', slip, 'Each position\'s minimums, and the pool price must not move further than this before you sign.')),
    !p.fresh && p.st.liquidity === 0n ? C.field(`Reference price (${sym(o.quote)} per ${sym(o.base)})`, refPrice, 'This pool is initialised but empty. Type the price you expect: deposits are refused if the pool is more than 2% away.') : null,
    preview, ilBox,
    h('label', { class: 'ely-check' }, ack, ' I understand impermanent loss and that out-of-range positions earn nothing.'),
    go2);
  setRangeFromPct(0.1);
  balances().catch(() => {});
  return card;
}

// ------------------------------------------------------------------------------------------
// positions
// ------------------------------------------------------------------------------------------

const POS_PAGE = 12;

/// Core position state, newest first, `limit` at a time. Every read here is a plain view call, so
/// Multicall3 folds the whole page into a handful of eth_calls: one round for the NFT ids, one for
/// positions(), one for pool state. History and the collect() simulation come later (enrichPositions)
/// so the list never waits on log scans or per-position simulations.
async function loadPositions(market, limit = POS_PAGE) {
  const npm = hs().positionManager, me = C.S.account;
  const n = Number(await C.read(npm, ABI.npm, 'balanceOf', [me]));
  const idx = Array.from({ length: Math.min(n, limit) }, (_, i) => BigInt(n - 1 - i));
  const ids = await Promise.all(idx.map((i) => C.read(npm, ABI.npm, 'tokenOfOwnerByIndex', [me, i])));
  const raw = await Promise.all(ids.map((id) => C.read(npm, ABI.npm, 'positions', [id])));
  await Promise.all(raw.flatMap((r) => [C.tokenInfo(getAddress(r[2])), C.tokenInfo(getAddress(r[3]))]));
  const poolOf = new Map();
  await Promise.all(raw.map(async (r) => {
    const k = `${r[2]}:${r[3]}:${r[4]}`;
    if (!poolOf.has(k)) {
      const known = market.pools.find((p) => p.token0.address === getAddress(r[2]) && p.token1.address === getAddress(r[3]) && p.fee === Number(r[4]));
      poolOf.set(k, known ? known.pool : C.read(hs().factory, ABI.v3Factory, 'getPool', [r[2], r[3], r[4]]));
    }
  }));
  for (const [k, v] of poolOf) poolOf.set(k, await v);
  const pstate = new Map();
  for (const pool of new Set(poolOf.values())) {
    pstate.set(pool, Promise.all([C.read(pool, ABI.v3Pool, 'slot0'), C.read(pool, ABI.v3Pool, 'feeGrowthGlobal0X128'), C.read(pool, ABI.v3Pool, 'feeGrowthGlobal1X128')]));
  }
  const list = await Promise.all(raw.map(async (r, j) => {
    const id = ids[j];
    const token0 = C.S.tokens.get(getAddress(r[2])), token1 = C.S.tokens.get(getAddress(r[3]));
    const fee = Number(r[4]), tl = Number(r[5]), tu = Number(r[6]), L = r[7];
    const pool = poolOf.get(`${r[2]}:${r[3]}:${r[4]}`);
    const mp = market.pools.find((x) => x.pool === pool) || { pool, token0, token1, fee, spacing: M.TICK_SPACING[fee] };
    const [[slot0, g0, g1], lo, hi] = await Promise.all([pstate.get(pool), C.read(pool, ABI.v3Pool, 'ticks', [tl]), C.read(pool, ABI.v3Pool, 'ticks', [tu])]);
    const sqrtP = slot0[0], tick = Number(slot0[1]);
    const inside = (g, i) => M.feeGrowthInside({ tick, tickLower: tl, tickUpper: tu, global: g, outsideLower: lo[i], outsideUpper: hi[i] });
    const fees0 = L === 0n ? r[10] : M.uncollectedFees({ liquidity: L, inside: inside(g0, 2), insideLast: r[8], tokensOwed: r[10] });
    const fees1 = L === 0n ? r[11] : M.uncollectedFees({ liquidity: L, inside: inside(g1, 3), insideLast: r[9], tokensOwed: r[11] });
    const [now0, now1] = L === 0n ? [0n, 0n] : M.amountsForDelta(sqrtP, tick, tl, tu, L, false);
    return { venue: 'v3', id, token0, token1, fee, tl, tu, L, pool, mp, sqrtP, tick, fees0, fees1, now0, now1, hist: null, sim: undefined };
  }));
  return { total: n, list };
}

/// Per-wallet NPM event history (deposits, withdrawals, collects), scanned incrementally: ids seen
/// before only need the new blocks; ids new to this cache get one back-scan.
async function positionHistory(ids, head) {
  const npm = hs().positionManager, me = C.S.account;
  const k = `ely:${C.S.m.chainId}:npmhist:${me}`;
  const c = store.get(k) || { to: null, ids: [], logs: [] };
  const ev = [topic(ABI.npm, 'IncreaseLiquidity')[0], topic(ABI.npm, 'DecreaseLiquidity')[0], topic(ABI.npm, 'Collect')[0]];
  const tid = (id) => toHex(id, { size: 32 });
  const known = new Set(c.ids), fresh = ids.map(tid).filter((t) => !known.has(t)), old = ids.map(tid).filter((t) => known.has(t));
  const from = BigInt(hs().deployBlock), to = c.to === null ? null : BigInt(c.to);
  const parts = [];
  if (fresh.length) parts.push(getLogs(npm, [ev, fresh], from, head));
  if (old.length && to !== null && to < head) parts.push(getLogs(npm, [ev, old], to + 1n, head));
  const logs = [...c.logs.filter((l) => old.includes(l.t[1]) || fresh.includes(l.t[1])), ...(await Promise.all(parts)).flat()];
  const seen = new Set();
  const uniq = logs.filter((l) => { const key = `${l.x}:${l.i}`; if (seen.has(key)) return false; seen.add(key); return true; });
  store.set(k, { to: String(head), ids: [...new Set([...old, ...fresh])], logs: uniq });
  const by = new Map();
  for (const l of uniq) {
    const h0 = by.get(l.t[1]) || { dep0: 0n, dep1: 0n, wd0: 0n, wd1: 0n, col0: 0n, col1: 0n };
    const a = dec(ABI.npm, l);
    if (l.t[0] === ev[0]) { h0.dep0 += a.amount0; h0.dep1 += a.amount1; }
    else if (l.t[0] === ev[1]) { h0.wd0 += a.amount0; h0.wd1 += a.amount1; }
    else { h0.col0 += a.amount0; h0.col1 += a.amount1; }
    by.set(l.t[1], h0);
  }
  return (id) => by.get(tid(id)) || { dep0: 0n, dep1: 0n, wd0: 0n, wd1: 0n, col0: 0n, col1: 0n };
}

/// collect() must be simulated from the owner (Multicall3 would be msg.sender), so these run in
/// parallel after the list is on screen.
async function simulateCollect(x) {
  const npm = hs().positionManager, me = C.S.account;
  try {
    const ret = await C.rpc('eth_call', [{ from: me, to: npm, data: C.call(ABI.npm, 'collect', [{ tokenId: x.id, recipient: me, amount0Max: MAXU128, amount1Max: MAXU128 }]) }, 'latest']);
    return decodeFunctionResult({ abi: ABI.npm, functionName: 'collect', data: ret });
  } catch { return null; }
}

function positionsCard(market, onlyPool) {
  const { h } = C;
  const box = h('div', {}, C.S.account ? h('p', { class: 'ely-muted' }, 'Loading positions…') : h('p', { class: 'ely-muted' }, 'Connect a wallet to see your positions.'));
  const card = h('section', { class: 'ely-card' }, h('h2', {}, onlyPool ? 'Your positions in this pool' : 'Your positions'), box);
  if (!C.S.account) return card;
  const limit = C.S.lpPosLimit || POS_PAGE;
  const c = C.S.lpPositions;
  if (!c || c.head !== market.head || c.account !== C.S.account || c.limit !== limit) {
    const load = Promise.all(venuesOn().map(([, v]) => v.positions(market, limit)))
      .then((xs) => ({ total: xs.reduce((s, x) => s + x.total, 0), list: xs.flatMap((x) => x.list) }));
    C.S.lpPositions = { head: market.head, account: C.S.account, limit, load };
    load.catch(() => { C.S.lpPositions = null; });
  }
  C.S.lpPositions.load.then(({ total, list }) => {
    const mine = list.filter((x) => !onlyPool || x.pool === onlyPool);
    const rows = mine.map((x) => VENUES[x.venue].row(x, market));
    const more = total > limit
      ? h('button', { class: 'ely-btn', onclick: () => { C.S.lpPosLimit = limit + POS_PAGE; C.render(); } }, `Show older positions (${total - limit} more)`)
      : null;
    box.replaceChildren(...(rows.length ? rows : [h('p', { class: 'ely-muted' }, onlyPool && total > limit ? 'None among your newest positions.' : 'No positions.')]),
      total > limit ? h('p', { class: 'ely-muted' }, `Showing your newest ${limit} of ${total} positions.`) : null, more);
    // Enrich in place: history (deposited, IL, fees collected) and the collect() cross-check.
    const v3 = mine.filter((x) => x.venue === 'v3');
    const hist = v3.length ? positionHistory(v3.map((x) => x.id), market.head).catch(() => null) : Promise.resolve(null);
    v3.forEach((x, i) => {
      Promise.all([hist, simulateCollect(x)]).then(([hf, sim]) => {
        const y = { ...x, sim, hist: hf ? hf(x.id) : null };
        rows[mine.indexOf(x)].update?.(y);
      });
    });
  }).catch((e) => box.replaceChildren(h('p', { class: 'ely-bad' }, C.explainError(e))));
  return card;
}

function positionRow(x, market) {
  const { h, fmt } = C;
  const p = { ...x.mp, st: { sqrtP: x.sqrtP, tick: x.tick } };
  const o = orient(p);
  const t0 = x.token0, t1 = x.token1;
  const inRange = x.L > 0n && x.tl <= x.tick && x.tick < x.tu;
  const a = o.tickDisp(x.tl), b = o.tickDisp(x.tu);
  const status = x.L === 0n ? 'Closed (no liquidity)' : inRange ? 'In range: collecting fees' : `Out of range: 100% ${x.tick < x.tl ? sym(t0) : sym(t1)}, not collecting fees`;
  const valQ = M.valueInToken1(x.now0, x.now1, x.sqrtP);
  const hype = market.priceHype ? (v1) => market.priceHype(t1.address, v1) : () => null;
  const vh = hype(valQ);
  const amt = (v0, v1) => `${fmt(v0, t0.decimals, 6)} ${sym(t0)} + ${fmt(v1, t1.decimals, 6)} ${sym(t1)}`;
  const kv = (k, v) => h('div', { class: 'ely-kv' }, h('small', {}, k), h('span', {}, v));
  const actions = h('div', { class: 'ely-row' });
  const slipBps = () => C.S.slippageBps;
  const whypeSide = isW(t0.address) ? 0 : isW(t1.address) ? 1 : -1;
  const npm = hs().positionManager;
  const payout = (calls) => {
    // HYPE pairs: collect into the manager, unwrap to native HYPE and sweep the other token.
    if (whypeSide >= 0) {
      calls.push(C.call(ABI.npm, 'collect', [{ tokenId: x.id, recipient: zeroAddress, amount0Max: MAXU128, amount1Max: MAXU128 }]));
      calls.push(C.call(ABI.npm, 'unwrapWETH9', [0n, C.S.account]));
      calls.push(C.call(ABI.npm, 'sweepToken', [whypeSide === 0 ? t1.address : t0.address, 0n, C.S.account]));
    } else calls.push(C.call(ABI.npm, 'collect', [{ tokenId: x.id, recipient: C.S.account, amount0Max: MAXU128, amount1Max: MAXU128 }]));
  };
  const decreaseCalls = async (liq) => {
    const [slot0] = await Promise.all([C.read(x.pool, ABI.v3Pool, 'slot0')]);
    const [e0, e1] = M.amountsForDelta(slot0[0], Number(slot0[1]), x.tl, x.tu, liq, false);
    return C.call(ABI.npm, 'decreaseLiquidity', [{ tokenId: x.id, liquidity: liq, amount0Min: (e0 * (10000n - slipBps())) / 10000n, amount1Min: (e1 * (10000n - slipBps())) / 10000n, deadline: await C.chainDeadline() }]);
  };
  const btn = (label, fn, opts = {}) => { const b2 = h('button', { class: 'ely-btn', ...opts }, label); b2.addEventListener('click', () => C.guarded(b2, fn)); actions.append(b2); return b2; };

  btn('Collect fees', async () => {
    const calls = []; payout(calls);
    await C.send(`Collect fees #${x.id}`, { to: npm, data: C.call(ABI.npm, 'multicall', [calls]) }); C.render();
  }, { disabled: x.fees0 === 0n && x.fees1 === 0n });
  const pctSel = h('select', { 'aria-label': `Withdraw share of position ${x.id}` }, ...[25, 50, 75, 100].map((v) => h('option', { value: v, selected: v === 50 }, `${v}%`)));
  if (x.L > 0n) {
    actions.append(pctSel);
    btn('Withdraw', async () => {
      const liq = (x.L * BigInt(pctSel.value)) / 100n;
      const calls = [await decreaseCalls(liq)]; payout(calls);
      await C.send(`Withdraw ${pctSel.value}% of #${x.id}`, { to: npm, data: C.call(ABI.npm, 'multicall', [calls]) }); C.render();
    });
  }
  btn('Close', async () => {
    const calls = [];
    if (x.L > 0n) calls.push(await decreaseCalls(x.L));
    payout(calls);
    calls.splice(x.L > 0n ? 2 : 1, 0, C.call(ABI.npm, 'burn', [x.id]));
    await C.send(`Close position #${x.id}`, { to: npm, data: C.call(ABI.npm, 'multicall', [calls]) }); C.render();
  });
  if (x.L > 0n) btn('Rebalance around price', () => rebalance(x, o));
  // Increase: same range, amounts paired at the current price.
  const incBase = h('input', { inputmode: 'decimal', placeholder: `${sym(o.base)}`, 'aria-label': `Add ${sym(o.base)} to position ${x.id}` });
  const incQuote = h('input', { inputmode: 'decimal', placeholder: `${sym(o.quote)}`, 'aria-label': `Add ${sym(o.quote)} to position ${x.id}` });
  const pair = (from) => {
    const src = from === 'base' ? incBase : incQuote, dst = from === 'base' ? incQuote : incBase;
    const t = from === 'base' ? o.base : o.quote, other = from === 'base' ? o.quote : o.base;
    let v; try { v = parseUnits(src.value || '0', t.decimals); } catch { return; }
    const side = (from === 'base') === o.b0 ? 0 : 1;
    const y = M.pairedAmount({ kind: 'spot', sqrtP: x.sqrtP, tick: x.tick, spacing: p.spacing, lower: x.tl, upper: x.tu, side, amount: v });
    dst.value = C.fmt(y, other.decimals, Math.min(other.decimals, 12)).replace(/,/g, '');
  };
  incBase.addEventListener('input', () => pair('base'));
  incQuote.addEventListener('input', () => pair('quote'));
  const inc = h('button', { class: 'ely-btn' }, 'Increase');
  inc.addEventListener('click', () => C.guarded(inc, async () => {
    const pb = parseUnits(incBase.value || '0', o.base.decimals), pq = parseUnits(incQuote.value || '0', o.quote.decimals);
    const [d0, d1] = o.b0 ? [pb, pq] : [pq, pb];
    const slot0 = await C.read(x.pool, ABI.v3Pool, 'slot0');
    const pm = M.previewMint(slot0[0], Number(slot0[1]), x.tl, x.tu, d0, d1);
    if (pm.liquidity === 0n) throw new Error('Amounts too small for this range.');
    let value = 0n;
    for (const [t, need] of [[t0, pm.amount0 ? d0 : 0n], [t1, pm.amount1 ? d1 : 0n]]) {
      if (need === 0n) continue;
      if (isW(t.address)) value = need; else await C.approveIfNeeded(t.address, npm, need, t.symbol);
    }
    const calls = [C.call(ABI.npm, 'increaseLiquidity', [{ tokenId: x.id, amount0Desired: pm.amount0 ? d0 : 0n, amount1Desired: pm.amount1 ? d1 : 0n, amount0Min: (pm.amount0 * (10000n - slipBps())) / 10000n, amount1Min: (pm.amount1 * (10000n - slipBps())) / 10000n, deadline: await C.chainDeadline() }])];
    if (value) calls.push(C.call(ABI.npm, 'refundETH', []));
    await C.send(`Increase #${x.id}`, { to: npm, value, data: C.call(ABI.npm, 'multicall', [calls]) }); C.render();
  }));

  const article = h('article', { class: `ely-pos ${inRange ? 'in' : 'out'}`, 'data-id': String(x.id) },
    h('header', {}, h('b', {}, `#${x.id} ${o.pair} · ${x.fee / 10000}%`), h('span', { class: `ely-badge ${inRange ? 'good' : 'warn'}` }, status)),
    h('div', { class: 'ely-kvs' },
      kv('Range', `${fp(Math.min(a, b))} – ${fp(Math.max(a, b))} ${sym(o.quote)} per ${sym(o.base)} · now ${fp(o.disp(x.sqrtP))}`),
      kv('In the position now', amt(x.now0, x.now1)),
      kv('Value now', `${fmt(valQ, t1.decimals, 6)} ${sym(t1)}${vh !== null && !isW(t1.address) ? ` ≈ ${fmt(vh, 18, 4)} HYPE` : ''}`),
      ...extras(x)),
    actions,
    x.L > 0n ? h('div', { class: 'ely-row' }, C.field(`Add ${sym(o.base)}`, incBase), C.field(`Add ${sym(o.quote)}`, incQuote), inc) : null);
  // History and the collect() check arrive after first paint; swap only those cells so anything the
  // user is typing into the row survives.
  let cells = article.querySelectorAll('.ely-kv[data-late]');
  article.update = (y) => { const next = extras(y); cells.forEach((el, i) => el.replaceWith(next[i])); cells = next; };
  return article;

  function extras(y) {
    const late = (k, v) => { const el = kv(k, v); el.dataset.late = ''; return el; };
    const simOk = y.sim && y.sim[0] === y.fees0 && y.sim[1] === y.fees1;
    const simText = y.sim === undefined ? 'checking against a simulated collect()…' : simOk ? '✓ matches a simulated collect()' : y.sim ? `simulation says ${amt(y.sim[0], y.sim[1])}` : 'simulation unavailable';
    const out = [late('Uncollected fees', [amt(y.fees0, y.fees1), ' ', h('small', { class: simOk ? 'ely-good' : 'ely-muted' }, simText)])];
    if (!y.hist) {
      const wait = y.sim === undefined ? 'loading history…' : '—';
      return [...out, late('Fees collected so far', wait), late('You put in (net of withdrawals)', wait), late('vs holding (IL, fees excluded)', wait), late('Net vs holding, with fees', wait)];
    }
    const hi = y.hist, earned0 = hi.col0 - hi.wd0, earned1 = hi.col1 - hi.wd1;
    const net0 = hi.dep0 - hi.wd0, net1 = hi.dep1 - hi.wd1;
    const il = net0 >= 0n && net1 >= 0n && (net0 > 0n || net1 > 0n) ? M.ilVsHodl(y.now0, y.now1, net0, net1, y.sqrtP) : null;
    const feesQ = M.valueInToken1(y.fees0 + (earned0 > 0n ? earned0 : 0n), y.fees1 + (earned1 > 0n ? earned1 : 0n), y.sqrtP);
    return [...out,
      late('Fees collected so far', amt(earned0 > 0n ? earned0 : 0n, earned1 > 0n ? earned1 : 0n)),
      late('You put in (net of withdrawals)', amt(net0, net1)),
      late('vs holding (IL, fees excluded)', il ? `${pctf(Number(il.ppm) / 1e6, 2)} · LP ${fmt(il.lp, t1.decimals, 6)} vs hold ${fmt(il.hodl, t1.decimals, 6)} ${sym(t1)}` : '—'),
      late('Net vs holding, with fees', il ? `${fmt(il.lp + feesQ - il.hodl < 0n ? il.hodl - il.lp - feesQ : il.lp + feesQ - il.hodl, t1.decimals, 6)} ${sym(t1)} ${il.lp + feesQ >= il.hodl ? 'ahead' : 'behind'}` : '—')];
  }
}

/// Rebalance = close the old position, optionally swap to the new range's ratio, open a range of
/// the same width around the current price. Three wallet-signed transactions, each re-reading
/// the chain first; nothing is held by us in between (the tokens sit in the user's wallet).
async function rebalance(x, o) {
  const npm = hs().positionManager, router = hs().swapRouter, me = C.S.account;
  const t0 = x.token0, t1 = x.token1, s = x.mp.spacing, slipBps = C.S.slippageBps;
  const deadline = async () => C.chainDeadline();
  let slot0 = await C.read(x.pool, ABI.v3Pool, 'slot0');
  const [e0, e1] = M.amountsForDelta(slot0[0], Number(slot0[1]), x.tl, x.tu, x.L, false);
  const r = await C.send(`Rebalance 1/3: close #${x.id}`, { to: npm, data: C.call(ABI.npm, 'multicall', [[
    C.call(ABI.npm, 'decreaseLiquidity', [{ tokenId: x.id, liquidity: x.L, amount0Min: (e0 * (10000n - slipBps)) / 10000n, amount1Min: (e1 * (10000n - slipBps)) / 10000n, deadline: await deadline() }]),
    C.call(ABI.npm, 'collect', [{ tokenId: x.id, recipient: me, amount0Max: MAXU128, amount1Max: MAXU128 }]),
    C.call(ABI.npm, 'burn', [x.id]),
  ]]) });
  const colT = topic(ABI.npm, 'Collect')[0];
  const log = r.logs.find((l) => l.address.toLowerCase() === npm.toLowerCase() && l.topics[0] === colT);
  if (!log) throw new Error('Close confirmed but no Collect event found; open a new position manually.');
  let { amount0: h0, amount1: h1 } = decodeEventLog({ abi: ABI.npm, data: log.data, topics: log.topics }).args;
  slot0 = await C.read(x.pool, ABI.v3Pool, 'slot0');
  const [nl, nu] = M.recentre(x.tl, x.tu, Number(slot0[1]), s);
  const sw = M.rebalanceSwap({ amount0: h0, amount1: h1, sqrtP: slot0[0], tickLower: nl, tickUpper: nu, fee: x.fee });
  const value = sw.zeroForOne ? M.valueInToken1(sw.amountIn, 0n, slot0[0]) : sw.amountIn;
  const total = M.valueInToken1(h0, h1, slot0[0]);
  if (sw.amountIn > 0n && value * 1000n > total) { // skip swaps under 0.1% of the holdings
    const [tin, tout] = sw.zeroForOne ? [t0, t1] : [t1, t0];
    const quoteData = C.call(ABI.quoter, 'quoteExactInputSingle', [{ tokenIn: tin.address, tokenOut: tout.address, amountIn: sw.amountIn, fee: x.fee, sqrtPriceLimitX96: 0n }]);
    const out = BigInt((await C.rpc('eth_call', [{ to: hs().quoterV2, data: quoteData }, 'latest'])).slice(0, 66));
    await C.approveIfNeeded(tin.address, router, sw.amountIn, isW(tin.address) ? 'WHYPE' : tin.symbol);
    await C.send(`Rebalance 2/3: swap ${sym(tin)} → ${sym(tout)}`, { to: router, data: C.call(ABI.router, 'exactInputSingle', [{ tokenIn: tin.address, tokenOut: tout.address, fee: x.fee, recipient: me, deadline: await deadline(), amountIn: sw.amountIn, amountOutMinimum: (out * (10000n - slipBps)) / 10000n, sqrtPriceLimitX96: 0n }]) });
    if (sw.zeroForOne) { h0 -= sw.amountIn; h1 += (out * (10000n - slipBps)) / 10000n; } else { h1 -= sw.amountIn; h0 += (out * (10000n - slipBps)) / 10000n; }
  } else C.toast('Rebalance 2/3: no swap needed.');
  slot0 = await C.read(x.pool, ABI.v3Pool, 'slot0');
  const pm = M.previewMint(slot0[0], Number(slot0[1]), nl, nu, h0, h1);
  if (pm.liquidity === 0n) throw new Error('Nothing left to reopen with.');
  for (const [t, v] of [[t0, h0], [t1, h1]]) if (v > 0n) await C.approveIfNeeded(t.address, npm, v, isW(t.address) ? 'WHYPE' : t.symbol);
  await C.send(`Rebalance 3/3: open ${o.pair} around price`, { to: npm, data: C.call(ABI.npm, 'mint', [{
    token0: t0.address, token1: t1.address, fee: x.fee, tickLower: nl, tickUpper: nu, amount0Desired: h0, amount1Desired: h1,
    amount0Min: (pm.amount0 * (10000n - slipBps)) / 10000n, amount1Min: (pm.amount1 * (10000n - slipBps)) / 10000n, recipient: me, deadline: await deadline(),
  }]) });
  C.render();
}
