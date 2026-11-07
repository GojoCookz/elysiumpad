/* global __PURRLYSIUM__ */
// HypurrLabs on Elysium: HYPE pad (Carbon V4 hook launches) + HypurrSwap (V3) in one page.
// Every number on screen is read from chain or from the deployment manifest. Every write is a
// wallet-signed transaction; this page never sees a key and the server never broadcasts.
import {
  createPublicClient, createWalletClient, custom, http, defineChain, encodeFunctionData,
  decodeErrorResult, decodeEventLog, decodeFunctionResult, encodeAbiParameters, keccak256, parseUnits, formatUnits,
  getAddress, isAddress, maxUint256, zeroAddress, toHex,
} from 'viem';
import { ABI, SOURCES } from './abi.mjs';
import { lp as lpTab } from './lp.mjs';
import { BRAND, swapOf } from './brand.mjs';
import { terminal, markets, liveStrip } from './terminal.mjs';
import { launchSimple } from './launch.mjs';
import { createWalletContext } from './wallet-context.mjs';
import { availableWallets, selectWallet, selectedWallet, connectedAddress, disconnectWallet } from '../wallet-session.mjs';
import { dedupeWallets, walletDialog } from './header.mjs';
import { appendWalletIcon } from '../wallet-icons.mjs';
import { resolveRoute, routeURL, captureReferral, effectiveReferrer, SECTIONS } from './routes.mjs';
import { helpPage } from './help.mjs';
import { mountPreferences } from './preferences.mjs';
import { fundingPage } from './funding.mjs';
import { locale, setLanguage, watchPadCopy, formatDecimal } from './i18n.mjs';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
};
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const fmt = (v, d = 18, p = 6) => {
  const s = formatUnits(v ?? 0n, d);
  const [i, f = ''] = s.split('.');
  const t = f.slice(0, p).replace(/0+$/, '');
  return formatDecimal(`${i}${t ? '.' + t : ''}`);
};
const pct = (bps) => `${(Number(bps) / 100).toFixed(2)}%`;
// Deadlines come from the chain's clock, not the browser's, so a skewed device clock (or a local
// fork that has been time-travelled) cannot make every trade revert as expired.
async function chainDeadline() { const b = await rpc('eth_getBlockByNumber', ['latest', false]); return BigInt(b.timestamp) + 600n; }

const S = {
  m: null, account: null, chainId: null, provider: null, pub: null, wallet: null,
  launches: [], tokens: new Map(), slippageBps: 100n, tab: __PURRLYSIUM__ ? 'markets' : 'trade',
};
let disposeSolana = null, viewGeneration = 0, operation = null, connecting = false;
const chosenWallet = { elysium: null, solana: null };
let referral = { address: null, error: '' }, routeError = '', closeWalletMenu = null;
const wallets = createWalletContext(() => {
  const evm = wallets.sessions.elysium;
  S.account = evm?.account || null; S.provider = evm?.provider || null; S.chainId = evm?.chainId || null;
  S.wallet = S.account ? createWalletClient({ account: S.account, chain: chainDef(), transport: custom(S.provider) }) : null;
  if (S.m) render();
});
window.addEventListener('pad-wallet-change', () => {
  wallets.update('solana', connectedAddress() ? { account: connectedAddress(), provider: selectedWallet() } : null);
});
async function chooseWallet(rows) {
  if (!rows.length) throw new Error('No compatible wallet found. Install a wallet for this chain.');
  if (rows.length === 1) return rows[0];
  return new Promise(resolve => {
    const dlg = h('dialog', { class: 'ely-dialog', 'aria-label': 'Choose a wallet' });
    const finish = row => { dlg.close(); dlg.remove(); resolve(row); };
    dlg.append(h('h2', {}, 'Choose a wallet'), ...rows.map(row => { const button = h('button', { class: 'ely-btn purr-wallet-option', onclick: () => finish(row) }); appendWalletIcon(button, { ...row, name: row.name || row.info.name, icon: row.info?.icon || row.icon }); return button; }), h('button', { class: 'ely-btn', onclick: () => finish(null) }, 'Cancel'));
    dlg.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    document.body.append(dlg); dlg.showModal();
  });
}
async function disconnect(chain = wallets.active) {
  wallets.disconnect(chain);
  if (chain === 'solana') await disconnectWallet();
}
async function getSolanaWallet() {
  if (wallets.active !== 'solana') throw new Error('Select Solana before connecting.');
  if (!connectedAddress()) await connect();
  if (!selectedWallet()?.publicKey) throw new Error('Connect a Solana wallet first.');
  return selectedWallet();
}

// ------------------------------------------------------------------------------------------
// RPC + wallet
// ------------------------------------------------------------------------------------------

async function rpc(method, params, chain = '') {
  const r = await fetch(`/api/elysium/rpc${chain ? `?chain=${chain}` : ''}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message || 'RPC error'); e.data = j.error.data; throw e; }
  return j.result;
}

const read = (address, abi, functionName, args = []) => S.pub.readContract({ address, abi, functionName, args });

function chainDef() {
  const m = S.m;
  return defineChain({
    id: m.chainId, name: m.chainName, nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
    rpcUrls: { default: { http: m.walletRpcs || [m.walletRpc] } },
    blockExplorers: m.explorer ? { default: { name: 'Explorer', url: m.explorer } } : undefined,
  });
}

function discoverWallets() {
  const found = [];
  const announce = e => { if (!found.some(w => w.provider === e.detail.provider)) found.push(e.detail); };
  window.addEventListener('eip6963:announceProvider', announce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  return new Promise((res) => setTimeout(() => {
    window.removeEventListener('eip6963:announceProvider', announce);
    if (!found.length && window.ethereum) found.push({ info: { name: window.ethereum.isRabby ? 'Rabby' : window.ethereum.isMetaMask ? 'MetaMask' : window.ethereum.isPhantom ? 'Phantom' : 'Browser wallet', rdns: 'injected' }, provider: window.ethereum });
    if (window.phantom?.ethereum && !found.some(w => w.provider === window.phantom.ethereum)) found.push({ info: { name: 'Phantom', rdns: 'app.phantom' }, provider: window.phantom.ethereum });
    res(dedupeWallets(found));
  }, 250));
}

async function connect(row = null) {
  if (connecting) return;
  connecting = true;
  const chain = wallets.active, intent = wallets.begin(chain);
  try {
    const available = chain === 'solana' ? dedupeWallets(availableWallets()) : await discoverWallets();
    const wanted = row?.provider || row?.standard ? row : chosenWallet[chain];
    const pick = wanted ? available.find(item => wanted.provider && item.provider === wanted.provider || wanted.standard && item.standard === wanted.standard) : await chooseWallet(available);
    if (wanted && !pick) throw new Error('Selected wallet is no longer available. Choose an available wallet.');
    if (!pick || !wallets.accepts(chain, intent)) return;
    chosenWallet[chain] = pick;
    if (chain === 'solana') {
      await selectWallet(pick);
      if (!wallets.accept(chain, intent, { account: connectedAddress(), provider: selectedWallet() })) await disconnectWallet();
    } else {
      const provider = pick.provider, [acct] = await provider.request({ method: 'eth_requestAccounts' });
      if (!acct) throw new Error('Wallet connection was cancelled.');
      const session = { provider, name: pick.name || pick.info?.name, account: getAddress(acct), chainId: Number(await provider.request({ method: 'eth_chainId' })) };
      const accounts = a => { if (wallets.sessions.elysium !== session) return; if (!a[0]) { wallets.disconnect('elysium'); return; } session.account = getAddress(a[0]); wallets.update('elysium', session); };
      const network = c => { if (wallets.sessions.elysium === session) { session.chainId = Number(c); wallets.update('elysium', session); } };
      const gone = () => { if (wallets.sessions.elysium === session) wallets.disconnect('elysium'); };
      session.off = () => { provider.removeListener?.('accountsChanged', accounts); provider.removeListener?.('chainChanged', network); provider.removeListener?.('disconnect', gone); };
      wallets.sessions.elysium?.off?.();
      if (wallets.accept(chain, intent, session)) { provider.on?.('accountsChanged', accounts); provider.on?.('chainChanged', network); provider.on?.('disconnect', gone); }
    }
  } catch (e) { toast(explainError(e), 'bad'); }
  finally { connecting = false; render(); }
}

async function ensureChain(id = S.m.chainId, params) {
  if (wallets.active !== 'elysium' || !S.provider) throw new Error('Connect the Elysium wallet first.');
  const session = wallets.sessions.elysium;
  if (S.chainId === id) return;
  const hex = toHex(id);
  try {
    await S.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (e) {
    if (e.code !== 4902 && e?.data?.originalError?.code !== 4902) throw e;
    const p = params || { chainId: hex, chainName: S.m.chainName, nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 }, rpcUrls: S.m.walletRpcs || [S.m.walletRpc], blockExplorerUrls: S.m.explorer ? [S.m.explorer] : [] };
    await S.provider.request({ method: 'wallet_addEthereumChain', params: [p] });
  }
  if (wallets.sessions.elysium !== session) throw new Error('Wallet changed during network selection.');
  session.chainId = Number(await session.provider.request({ method: 'eth_chainId' }));
  wallets.update('elysium', session);
  if (session.chainId !== id) throw new Error(`Select network ${id} in your wallet.`);
}

/// Sends one wallet-signed tx on the manifest chain. Gas is estimated and padded 1.5x (ledger
/// I-02: the first trade after a sweep initialises reward slots inside the swap).
async function send(label, { to, data, value = 0n }, onParent = false) {
  const context = operation || wallets.capture();
  wallets.assert(context);
  if (wallets.active !== 'elysium') throw new Error('Select Elysium before submitting.');
  if (!S.account) throw new Error('Connect a wallet first.');
  const provider = S.provider, account = S.account;
  const b = S.m.bridge;
  const via = onParent ? String(b.parentChainId) : '';
  const targetChain = onParent ? b.parentChainId : S.m.chainId;
  label = `${label} · EVM ${targetChain} · ${short(account)}`;
  if (__PURRLYSIUM__) {
    if (Number(await provider.request({ method: 'eth_chainId' })) !== targetChain) throw new Error(`Wrong network. Select ${targetChain} explicitly before reviewing.`);
    wallets.assert(context);
  } else if (onParent) await ensureChain(b.parentChainId, parentParams());
  else await ensureChain();
  const pendingKey = `purrlysium.evm.${targetChain}.${account.toLowerCase()}.pending`;
  if (__PURRLYSIUM__ && localStorage.getItem(pendingKey)) throw new Error('A transaction is pending for this account. Check Portfolio before submitting again.');
  const tx = { from: account, to, data, value: toHex(value) };
  const est = BigInt(await rpc('eth_estimateGas', [tx], via));
  const gas = (est * 3n) / 2n;
  if (__PURRLYSIUM__) wallets.assert(context);
  toast(`${label}: confirm in your wallet…`);
  // Record an unresolved wallet request before opening it. Switching cannot cause a duplicate.
  if (__PURRLYSIUM__) localStorage.setItem(pendingKey, JSON.stringify({ label, account, chainId: targetChain, hash: null }));
  let hash;
  try { hash = await provider.request({ method: 'eth_sendTransaction', params: [{ ...tx, gas: toHex(gas) }] }); }
  catch (e) { if (__PURRLYSIUM__ && e.code === 4001) localStorage.removeItem(pendingKey); throw e; }
  if (__PURRLYSIUM__) localStorage.setItem(pendingKey, JSON.stringify({ label, account, chainId: targetChain, hash }));
  toast(`${label}: sent ${short(hash)}, waiting…`);
  for (let i = 0; i < 240; i++) {
    const r = await rpc('eth_getTransactionReceipt', [hash], via);
    if (r) {
      if (__PURRLYSIUM__) localStorage.removeItem(pendingKey);
      if (__PURRLYSIUM__) localStorage.setItem(`${pendingKey}.last`, JSON.stringify({ label, hash, status: r.status === '0x1' ? 'confirmed' : 'reverted' }));
      if (r.status !== '0x1') throw new Error(`${label} reverted (${short(hash)}).`);
      toast(`${label}: confirmed in block ${Number(r.blockNumber)}.`, 'good');
      return r;
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`${label}: no receipt after 4 minutes (${hash}).`);
}

const call = (abi, functionName, args) => encodeFunctionData({ abi, functionName, args });
const parentParams = () => ({ chainId: toHex(S.m.bridge.parentChainId), chainName: 'HyperEVM', nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 }, rpcUrls: [S.m.bridge.parentRpc], blockExplorerUrls: [] });
/// Read on HyperEVM (the parent chain) through the same read-only proxy.
async function readParent(address, abi, functionName, args = []) {
  const ret = await rpc('eth_call', [{ to: address, data: call(abi, functionName, args) }, 'latest'], String(S.m.bridge.parentChainId));
  return decodeFunctionResult({ abi, functionName, data: ret });
}

async function approveIfNeeded(token, spender, amount, symbol) {
  const a = await read(token, ABI.erc20, 'allowance', [S.account, spender]);
  if (a >= amount) return;
  await send(`Approve ${symbol}`, { to: token, data: call(ABI.erc20, 'approve', [spender, maxUint256]) });
}

function explainError(e) {
  const data = e?.data || e?.cause?.data;
  if (typeof data === 'string' && data.startsWith('0x') && data.length >= 10) {
    for (const abi of [ABI.launcher, ABI.zap]) {
      try { const d = decodeErrorResult({ abi, data }); return `${d.errorName}(${(d.args || []).map(String).join(', ')})`; } catch {}
    }
  }
  return e?.shortMessage || e?.message || String(e);
}

// ------------------------------------------------------------------------------------------
// Chain data
// ------------------------------------------------------------------------------------------

async function tokenInfo(addr) {
  if (S.tokens.has(addr)) return S.tokens.get(addr);
  const [name, symbol, decimals] = await Promise.all([
    read(addr, ABI.erc20, 'name'), read(addr, ABI.erc20, 'symbol'), read(addr, ABI.erc20, 'decimals'),
  ]);
  const t = { address: addr, name, symbol, decimals: Number(decimals) };
  S.tokens.set(addr, t);
  return t;
}

const SPACINGS = [60, 200, 10, 1, 100, 2000, 50, 20, 120];
function padKey(token, pair, spacing) {
  const [c0, c1] = BigInt(token) < BigInt(pair) ? [token, pair] : [pair, token];
  return { currency0: c0, currency1: c1, fee: 0, tickSpacing: spacing, hooks: S.m.carbon.feeHook };
}
const keyId = (k) => keccak256(encodeAbiParameters(
  [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
  [k.currency0, k.currency1, k.fee, k.tickSpacing, k.hooks]));

async function loadLaunches() {
  const c = S.m.carbon;
  const head = BigInt(await rpc('eth_blockNumber', []));
  const out = [];
  const topic = keccak256(new TextEncoder().encode('Launched(address,address,address,bytes32,uint256,uint256,uint16)'));
  for (let from = BigInt(c.deployBlock); from <= head; from += 50000n) {
    const to = from + 49999n > head ? head : from + 49999n;
    const logs = await rpc('eth_getLogs', [{ address: c.launcher, topics: [topic], fromBlock: toHex(from), toBlock: toHex(to) }]);
    for (const l of logs) {
      const ev = decodeEventLog({ abi: ABI.launcher, data: l.data, topics: l.topics });
      const { token, creator, pair, poolId, supply, openingMarketCap, feeBps } = ev.args;
      const spacing = SPACINGS.find((s) => keyId(padKey(token, pair, s)) === poolId);
      if (spacing === undefined) continue;
      out.push({ token, creator, pair, poolId, supply, openingMarketCap, feeBps, key: padKey(token, pair, spacing), block: Number(l.blockNumber) });
    }
  }
  out.sort((a, b) => b.block - a.block);
  await Promise.all(out.map((x) => tokenInfo(x.token)));
  S.launches = out;
}

const ethKeys = () => [{ currency0: zeroAddress, currency1: S.m.whype, fee: 3000, tickSpacing: 60, hooks: zeroAddress }];

async function quoteZap(buy, key, amountIn) {
  const data = call(ABI.zap, buy ? 'quoteZapBuy' : 'quoteZapSell', [ethKeys(), key, amountIn]);
  try {
    await rpc('eth_call', [{ to: S.m.carbon.zapRouter, data, from: S.account || '0x000000000000000000000000000000000000dEaD' }, 'latest']);
  } catch (e) {
    if (typeof e.data === 'string') {
      const d = decodeErrorResult({ abi: ABI.zap, data: e.data });
      if (d.errorName === 'ZapQuote') return d.args[0];
      throw new Error(d.errorName);
    }
    throw e;
  }
  throw new Error('Quote did not return.');
}

async function quoteV3(tokenIn, tokenOut, amountIn) {
  let best = null;
  for (const fee of swapOf(S.m).feeTiers) {
    const pool = await read(swapOf(S.m).factory, ABI.v3Factory, 'getPool', [tokenIn, tokenOut, fee]);
    if (pool === zeroAddress) continue;
    if ((await read(pool, ABI.v3Pool, 'liquidity')) === 0n) continue;
    try {
      const data = call(ABI.quoter, 'quoteExactInputSingle', [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }]);
      const ret = await rpc('eth_call', [{ to: swapOf(S.m).quoterV2, data }, 'latest']);
      const out = BigInt(ret.slice(0, 66));
      if (!best || out > best.out) best = { fee, out, pool };
    } catch {}
  }
  return best;
}

// ------------------------------------------------------------------------------------------
// UI shell
// ------------------------------------------------------------------------------------------

function toast(msg, kind = '') {
  const box = $('#ely-toasts');
  const t = h('div', { class: `ely-toast ${kind}`, role: kind === 'bad' ? 'alert' : 'status' }, msg);
  box.append(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), kind === 'bad' ? 12000 : 6000);
  const log = $('#ely-log');
  if (log) { log.prepend(h('li', { class: kind }, h('time', {}, new Date().toLocaleTimeString(locale())), ' · ', h('span', {}, msg))); while (log.children.length > 30) log.lastChild.remove(); }
}

async function guarded(btn, fn) {
  if (__PURRLYSIUM__ && operation) { toast('Finish the current review or pending transaction first.', 'bad'); return; }
  if (__PURRLYSIUM__) operation = wallets.capture();
  btn.disabled = true;
  try { await fn(); } catch (e) { toast(explainError(e), 'bad'); } finally { btn.disabled = false; operation = null; }
}

const TABS = [...(__PURRLYSIUM__ ? [['markets', 'Markets']] : []), ['trade', 'Trade'], ['create', 'Create'], ['lp', 'LP'], ['portfolio', 'Portfolio'], ['bridge', 'Bridge'], ['developers', 'Developers'], ...(__PURRLYSIUM__ ? [['docs', 'Docs'], ['referrals', 'Referrals'], ['funding', 'Funding']] : [])];
const heavenPreview = document.documentElement.dataset.host === 'hypurrheaven';
const standaloneAngel = document.documentElement.dataset.standalone === 'angel';
const arrivalRoute = () => false;
let showArrival = arrivalRoute();
  const hrefFor = (section, chain = wallets.active, token) => routeURL(location.href, { chain, section, token, market: section === 'markets' && new URLSearchParams(location.search).get('market') === 'all' ? 'all' : '', skin: heavenPreview && !standaloneAngel });
function navigatePad(url) {
  showArrival = false;
  if (!__PURRLYSIUM__) { history.replaceState(null, '', url); return; }
  const target = new URL(url, location.href), section = target.hash.slice(1).split('/')[0] || S.tab;
  history.pushState(null, '', hrefFor(section, wallets.active, target.searchParams.get('token')));
}
function goSection(section, chain = wallets.active, token) {
  showArrival = false;
  const supported = SECTIONS[chain].includes(section);
  if (!supported) { toast(`${section} is unavailable on ${chain}. Showing Markets.`); section = 'markets'; }
  const switched = chain !== wallets.active;
  S.tab = section; S.term = null; S.lpPool = null; S.solQuery = token || ''; S.solToken = null;
  routeError = ''; closeWalletMenu?.(); closeWalletMenu = null;
  history.pushState(null, '', hrefFor(section, chain, token));
  try { sessionStorage.setItem('purrlysium.active-chain', chain); } catch {}
  if (switched) wallets.switch(chain); else render();
  window.dispatchEvent(new Event('purr-chain-change'));
}
// "#lp/<pool>" deep-links a pool; the old "#pools" link lands on the LP terminal.
function routeFromHash() {
  showArrival = arrivalRoute();
  if (__PURRLYSIUM__) {
    try {
      let remembered = 'elysium'; try { remembered = sessionStorage.getItem('purrlysium.active-chain') || remembered; } catch {}
      const route = resolveRoute(location.href, remembered);
      S.tab = route.section; S.solQuery = route.chain === 'solana' ? route.token || '' : ''; S.solToken = null;
      S.lpPool = location.hash.startsWith('#lp/') ? location.hash.slice(4) : null;
      routeError = ''; if (route.fallback) toast(route.fallback);
      wallets.switch(route.chain); return true;
    } catch (e) { routeError = e.message; return true; }
  }
  const [t, sub] = location.hash.slice(1).split('/');
  const id = t === 'pools' ? 'lp' : t;
  if (!TABS.some(([x]) => x === id)) return false;
  const changed = id !== S.tab || (id === 'lp' && (sub || null) !== (S.lpPool || null));
  S.tab = id;
  if (id === 'lp') S.lpPool = sub || null;
  return changed;
}
const lp = (box) => lpTab(box, { S, h, rpc, read, send, call, approveIfNeeded, chainDeadline, toast, guarded, field, fmt, short, explainError, tokenInfo, render });

function render() {
  closeWalletMenu?.(); closeWalletMenu = null;
  disposeSolana?.(); disposeSolana = null;
  const generation = ++viewGeneration;
  const m = S.m;
  document.documentElement.dataset.activeChain = wallets.active;
  document.documentElement.dataset.arrival = String(showArrival);
  if (document.documentElement.dataset.section !== S.tab && ['markets', 'trade'].includes(S.tab)) { const risk = document.querySelector('.ely-risk'); if (risk) risk.open = false; }
  document.documentElement.dataset.section = S.tab;
  if (__PURRLYSIUM__) {
    const addressInput = $('#purr-ca-input');
    if (addressInput) {
      addressInput.placeholder = wallets.active === 'solana' ? 'Paste Solana mint…' : 'Paste coin address 0x…';
      addressInput.pattern = wallets.active === 'solana' ? '[1-9A-HJ-NP-Za-km-z]{32,44}' : '0x[0-9a-fA-F]{40}';
      addressInput.form.onsubmit = event => { event.preventDefault(); goSection('trade', wallets.active, addressInput.value); };
    }
    const intro = $('.purr-hero-copy > p:not(.ely-sub):not(.ely-badge)');
    if (intro) intro.textContent = 'Launch and trade on Solana or Elysium, hosted by Rektd.';
    const sub = $('.purr-hero-copy > .ely-sub');
    if (sub) sub.textContent = 'Separate wallets and network configuration. Not affiliated with Kinetiq or Hyperliquid.';
    let switcher = $('#purr-chains');
    if (!switcher) { switcher = h('div', { id: 'purr-chains', class: 'purr-chain-controls', role: 'group', 'aria-label': 'Active chain' }); $('.ely-top').append(switcher); }
    switcher.replaceChildren(...['elysium', 'solana'].map(chain => h('button', { class: 'ely-btn' + (wallets.active === chain ? ' primary' : ''), 'aria-pressed': String(wallets.active === chain), onclick: () => { if (wallets.active === chain) return; if (addressInput) addressInput.value = ''; goSection(S.tab, chain); } }, chain === 'solana' ? 'Solana' : 'Elysium')));
  }
  $('#ely-net').textContent = `${m.chainName}${BRAND.chainId ? ` · ${m.chainId}` : ''}${m.local ? ' · LOCAL FORK' : ''}`;
  const w = $('#ely-wallet');
  const activeAccount = wallets.active === 'solana' ? connectedAddress() : S.account;
  w.replaceChildren(wallets.active === 'solana' ? activeAccount ? h('span', { class: 'ely-pill', title: activeAccount }, `Solana · ${short(activeAccount)}`) : h('button', { class: 'ely-btn primary', onclick: connect }, 'Connect Solana') : S.account
    ? h('span', { class: 'ely-pill' + (S.chainId === m.chainId ? '' : ' warn'), title: S.account }, S.chainId === m.chainId ? short(S.account) : `${short(S.account)} · Wrong network (${S.chainId})`)
    : h('button', { class: 'ely-btn primary', onclick: connect }, 'Connect wallet'));
  if (wallets.active === 'solana') $('#ely-net').textContent = 'Solana · mainnet';
  if (wallets.active === 'elysium' && S.account && S.chainId !== m.chainId) w.append(h('button', { class: 'ely-btn', onclick: () => ensureChain().catch((e) => toast(explainError(e), 'bad')) }, 'Switch network'));
  if (activeAccount) w.append(h('button', { class: 'ely-btn', onclick: () => disconnect().catch(e => toast(e.message, 'bad')) }, 'Disconnect'));
  if (S.account && connectedAddress()) w.append(h('button', { class: 'ely-btn', onclick: () => Promise.all(['elysium', 'solana'].map(disconnect)).catch(e => toast(e.message, 'bad')) }, 'Disconnect all'));
  if (__PURRLYSIUM__) {
    w.replaceChildren();
    const chain = wallets.active, chosen = chosenWallet[chain];
    const picker = h('button', { class: 'ely-btn purr-wallet-picker', 'aria-haspopup': 'dialog', onclick: async () => {
      const rows = chain === 'solana' ? dedupeWallets(availableWallets()) : await discoverWallets();
      if (chain !== wallets.active || !picker.isConnected) return;
      closeWalletMenu = walletDialog({ h, trigger: picker, title: `Select ${chain === 'solana' ? 'Solana' : 'EVM'} wallet`, rows: rows.map(row => ({ ...row, selected: Boolean(chosen && (row.provider && row.provider === chosen.provider || row.standard && row.standard === chosen.standard)) })), note: rows.length ? 'Available in this browser. Selecting a wallet does not connect it. Network compatibility is checked separately.' : 'No compatible wallet detected. Enable an installed wallet extension and try again.', choose: row => { chosenWallet[chain] = row; render(); } });
    } }, chosen?.name || 'Select wallet');
    if (chosen) { picker.dataset.noTranslate = ''; appendWalletIcon(picker, chosen); }
    w.append(picker);
    if (!activeAccount) w.append(h('button', { class: 'ely-btn primary', onclick: () => connect() }, chain === 'solana' ? 'Connect Solana' : 'Connect wallet'));
    else {
      const accountButton = h('button', { class: 'ely-btn', title: activeAccount, 'aria-haspopup': 'dialog', onclick: () => {
        const explorer = chain === 'solana' ? `https://solscan.io/account/${activeAccount}` : m.explorer && /^https:\/\//.test(m.explorer) ? `${m.explorer.replace(/\/$/, '')}/address/${activeAccount}` : null;
        closeWalletMenu = walletDialog({ h, trigger: accountButton, title: `${chain === 'solana' ? 'Solana' : 'Elysium'} account`, note: activeAccount, actions: [
          { label: 'Copy address', run: () => navigator.clipboard.writeText(activeAccount).then(() => toast('Address copied.')).catch(() => toast('Clipboard unavailable. Copy the address shown in the account menu.', 'bad')) },
          ...(explorer ? [{ label: 'View on explorer', href: explorer }] : []),
          ...(chain === 'elysium' && S.chainId !== m.chainId ? [{ label: `Switch wallet to ${m.chainId}`, run: () => ensureChain().catch(e => toast(e.message, 'bad')) }] : []),
          { label: 'Disconnect', run: () => disconnect(chain).catch(e => toast(e.message, 'bad')) },
          ...(S.account && connectedAddress() ? [{ label: 'Disconnect all', run: () => Promise.all(['elysium', 'solana'].map(disconnect)).catch(e => toast(e.message, 'bad')) }] : []),
        ] });
      } }, `${short(activeAccount)}${chain === 'elysium' && S.chainId !== m.chainId ? ' · Wrong network' : ''}`);
      w.append(accountButton);
    }
    $('#ely-net').textContent = chain === 'solana' ? 'Solana mainnet' : m.local ? `Elysium ${m.chainId} · local fork` : `Elysium ${m.chainId} · unverified network`;
    if(document.documentElement.dataset.host==='hypurrheaven'&&!$('.pad-network')){
      const network=h('div',{class:'pad-network'});$('.ely-top').append(network);network.append($('#purr-chains'),$('#ely-net'));
    }
    const risk = document.querySelector('.ely-risk');
    if (risk) { risk.open = false; risk.querySelector('summary').textContent = 'Risks and network details'; }
  }
  const nav = $('#ely-tabs');
  const tabs = wallets.active === 'solana' ? TABS.filter(([id]) => SECTIONS.solana.includes(id)) : TABS;
  if (!tabs.some(([id]) => id === S.tab)) S.tab = 'markets';
  nav.replaceChildren(...tabs.map(([id, label]) => h('button', {
    class: 'ely-tab' + (S.tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(S.tab === id),
    onclick: () => { S.tab = id; if (id === 'lp') S.lpPool = null; navigatePad(`#${id}`); render(); },
  }, label)));
  if (__PURRLYSIUM__) {
    nav.classList.add('purr-header-nav'); $('.ely-top').append(nav);
    const primary = ['markets', 'trade', 'create', 'portfolio'];
    const link = ([id, label]) => h('a', { class: 'ely-tab' + (S.tab === id ? ' on' : ''), href: hrefFor(id), role: 'tab', 'aria-selected': String(S.tab === id), onclick: event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return; event.preventDefault(); goSection(id); } }, label);
    const more = h('details', { class: 'purr-more' }, h('summary', {}, 'More'), h('div', { class: 'purr-more-panel' }, ...tabs.filter(([id]) => !primary.includes(id)).map(link), h('a',{class:'ely-tab',href:'/home/'},'Hypurrheaven'),h('a',{class:'ely-tab',href:'/home/fishing.html'},'Cloud fishing')));
    more.addEventListener('keydown', event => { if (event.key === 'Escape') { more.open = false; more.querySelector('summary').focus(); } });
    more.addEventListener('focusout', event => { if (!more.contains(event.relatedTarget)) more.open = false; });
    nav.replaceChildren(...tabs.filter(([id]) => primary.includes(id)).map(link), more);
    nav.onkeydown = event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; const links = [...nav.querySelectorAll('[role="tab"]')].filter(el => el.getClientRects().length); const index = links.indexOf(document.activeElement); if (index < 0) return; event.preventDefault(); links[event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + links.length) % links.length].focus(); };
  }
  // Each render gets its own container: a slow, superseded render writes into a detached box
  // instead of overwriting the tab the user has since switched to.
  const box = h('div', {}, h('p', { class: 'ely-muted' }, 'Loading…'));
  $('#ely-main').replaceChildren(box);
  if (routeError) { box.replaceChildren(h('p', { class: 'ely-card ely-bad', role: 'alert' }, routeError)); return; }
  if (__PURRLYSIUM__ && S.tab === 'funding') { fundingPage(box, { h, S, href: hrefFor }); return; }
  if (__PURRLYSIUM__ && ['docs', 'referrals'].includes(S.tab)) {
    helpPage(box, { h, S, chain: wallets.active, section: S.tab, account: activeAccount, read, send, call, guarded, fmt, toast, candidate: referral.address, referralError: referral.error, href: hrefFor, current: () => generation === viewGeneration, refresh: render }).catch(e => { if (generation === viewGeneration) box.append(h('p', { class: 'ely-bad' }, `Chain data unavailable: ${explainError(e)}`)); });
    return;
  }
  if (__PURRLYSIUM__ && wallets.active === 'solana') {
    const path = '/purrlysium/solana.js';
    import(path).then(async module => {
      if (generation !== viewGeneration) return;
       const cleanup = await module.mountSolana(box, { h, tab: S.tab, account: activeAccount, getWallet: getSolanaWallet, isCurrent: () => generation === viewGeneration, openTrade: token => { goSection('trade', 'solana', token.mint); }, token: S.solToken, query: S.solQuery || '', tokenAddress: new URLSearchParams(location.search).get('token'), marketMode: new URLSearchParams(location.search).get('market') === 'all' ? 'all' : 'solana' });
      if (generation !== viewGeneration) cleanup?.(); else disposeSolana = cleanup;
    }).catch(e => { if (generation === viewGeneration) box.replaceChildren(h('p', { class: 'ely-bad' }, explainError(e))); });
    return;
  }
  const pctx = __PURRLYSIUM__ && { S, h, rpc, read, send, call, approveIfNeeded, chainDeadline, quoteZap, ethKeys, feeTable, toast, guarded, connect, explainError, fmt, loadLaunches, tokenInfo, short, render, referral: referral.address, getReferrer: async () => { const context = wallets.capture(), account = S.account; const bound = await read(S.m.carbon.referralVault, ABI.vault, 'referrerOf', [account]); wallets.assert(context); return effectiveReferrer({ account, bound, candidate: referral.address }); },
    openCoin: (l) => { navigatePad(`?token=${l.token}#trade`); S.tab = 'trade'; S.term = l.poolId; render(); scrollTo({ top: $('#ely-tabs').getBoundingClientRect().top + scrollY - 70 }); } };
  (__PURRLYSIUM__ ? { markets: (b) => markets(b, pctx), trade: (b) => terminal(b, pctx), create: (b) => launchSimple(b, pctx), lp, portfolio, bridge, developers } : { trade, create, lp, portfolio, bridge, developers })[S.tab](box).catch((e) => box.replaceChildren(h('p', { class: 'ely-bad' }, explainError(e))));
}

function field(label, input, hint) {
  const id = `f-${Math.random().toString(36).slice(2)}`;
  input.id = id;
  return h('div', { class: 'ely-field' }, h('label', { for: id }, label), input, hint ? h('small', {}, hint) : null);
}

// ------------------------------------------------------------------------------------------
// Trade
// ------------------------------------------------------------------------------------------

async function feeTable(l) {
  const hook = S.m.carbon.feeHook;
  const [cfg, split, buyNow, platVol, bountyBps] = await Promise.all([
    read(hook, ABI.feeHook, 'poolConfig', [l.poolId]), read(hook, ABI.feeHook, 'effectiveSplitBps', [l.poolId]),
    read(hook, ABI.feeHook, 'currentBuyFeeBps', [l.poolId]), read(hook, ABI.feeHook, 'PLATFORM_VOLUME_BPS'),
    read(hook, ABI.feeHook, 'SWEEP_BOUNTY_BPS'),
  ]);
  const [, , feeBps, creator, , , sellFeeBps, burnBps] = cfg;
  const [platformBps, creatorBps, holderBps] = split;
  const ref = S.m.carbon.referralDirectBps;
  const ofVol = (feeBpsX, shareBps) => (Number(feeBpsX) * Number(shareBps) * (10000 - Number(bountyBps)) * (10000 - Number(burnBps))) / 1e14;
  return h('table', { class: 'ely-table' },
    h('caption', {}, 'What this trade pays, read from the FeeHook config'),
    h('tr', {}, h('th', {}, 'Buy fee now'), h('td', {}, pct(buyNow), buyNow > feeBps ? ' (anti-snipe window, extra goes to platform)' : '')),
    h('tr', {}, h('th', {}, 'Sell fee'), h('td', {}, pct(sellFeeBps))),
    h('tr', {}, h('th', {}, 'Keeper bounty (paid first, from the pot)'), h('td', {}, pct(bountyBps), ' of fees')),
    burnBps ? h('tr', {}, h('th', {}, 'Buyback & burn'), h('td', {}, pct(burnBps), ' of fees')) : null,
    h('tr', {}, h('th', {}, `Platform (target ${pct(platVol)} of volume)`), h('td', {}, `${pct(platformBps)} of fees ≈ ${ofVol(feeBps, platformBps).toFixed(4)}% of volume; referrer ${pct(ref)} of that, treasury the rest`)),
    h('tr', {}, h('th', {}, `Creator ${short(creator)}`), h('td', {}, `${pct(creatorBps)} of fees ≈ ${ofVol(feeBps, creatorBps).toFixed(4)}% of volume`)),
    h('tr', {}, h('th', {}, 'Holders (80% pro-rata, 20% equal per eligible wallet)'), h('td', {}, `${pct(holderBps)} of fees ≈ ${ofVol(feeBps, holderBps).toFixed(4)}% of volume`)));
}

async function trade(main, pin) {
  if (!pin) await loadLaunches();
  const extra = new URLSearchParams(location.search).get('token');
  const v3 = [...(swapOf(S.m).listedTokens || []), ...(extra && isAddress(extra) ? [getAddress(extra)] : [])];
  await Promise.all(v3.map(tokenInfo));
  const opts = pin ? [{ id: pin.token, label: `${S.tokens.get(pin.token).symbol} · HYPE pad`, pad: pin }] : [
    ...S.launches.map((l) => ({ id: l.token, label: `${S.tokens.get(l.token).symbol} · HYPE pad`, pad: l })),
    ...v3.filter((a) => !S.launches.some((l) => l.token === a)).map((a) => ({ id: a, label: `${S.tokens.get(a).symbol} · ${BRAND.dex}` })),
  ];
  if (!opts.length) { main.replaceChildren(h('p', { class: 'ely-muted' }, 'No markets yet. Launch one on the Create tab.')); return; }
  const sel = h('select', {}, ...opts.map((o) => h('option', { value: o.id }, o.label)));
  const side = h('select', {}, h('option', { value: 'buy' }, 'Buy with HYPE'), h('option', { value: 'sell' }, 'Sell for HYPE'));
  const amt = h('input', { inputmode: 'decimal', placeholder: '0.0', value: '0.1', autocomplete: 'off' });
  const quoteBox = h('div', { class: 'ely-quote', 'aria-live': 'polite' }, '—');
  const feesBox = h('div', {});
  const go = h('button', { class: 'ely-btn primary' }, 'Trade');
  let q = null;
  const pick = () => opts.find((o) => o.id === sel.value);

  async function refresh() {
    q = null; quoteBox.textContent = 'Quoting…';
    const o = pick(); const t = S.tokens.get(o.id);
    const buy = side.value === 'buy';
    let amountIn;
    try { amountIn = parseUnits(amt.value || '0', buy ? 18 : t.decimals); } catch { quoteBox.textContent = 'Enter a number.'; return; }
    if (amountIn === 0n) { quoteBox.textContent = '—'; return; }
    if (buy && S.m.caps?.maxTradeHype && amountIn > parseUnits(String(S.m.caps.maxTradeHype), 18)) {
      quoteBox.textContent = `Mainnet-test cap: max ${S.m.caps.maxTradeHype} HYPE per trade in this UI.`; return;
    }
    try {
      if (o.pad) {
        const out = await quoteZap(buy, o.pad.key, amountIn);
        q = { venue: 'pad', out, amountIn, buy, o };
        feesBox.replaceChildren(await feeTable(o.pad));
      } else {
        const best = await quoteV3(buy ? S.m.whype : o.id, buy ? o.id : S.m.whype, amountIn);
        if (!best) { quoteBox.textContent = `No ${BRAND.dex} pool with liquidity for this token yet.`; return; }
        q = { venue: 'v3', out: best.out, fee: best.fee, amountIn, buy, o };
        feesBox.replaceChildren(h('p', { class: 'ely-muted' }, `${BRAND.dex} V3 pool, LP fee ${best.fee / 10000}% (to liquidity providers). Protocol fee: off.`));
      }
      const min = (q.out * (10000n - S.slippageBps)) / 10000n;
      quoteBox.replaceChildren(h('strong', {}, `${fmt(q.out, buy ? t.decimals : 18)} ${buy ? t.symbol : 'HYPE'}`),
        h('span', {}, ` · minimum ${fmt(min, buy ? t.decimals : 18)} at ${pct(S.slippageBps)} slippage`));
    } catch (e) { quoteBox.textContent = `Quote failed: ${explainError(e)}`; }
  }

  go.addEventListener('click', () => guarded(go, async () => {
    if (!q) await refresh();
    if (!q) return;
    const min = (q.out * (10000n - S.slippageBps)) / 10000n || 1n;
    const deadline = (await chainDeadline());
    const t = S.tokens.get(q.o.id);
    if (q.venue === 'pad') {
      if (q.buy) await send(`Buy ${t.symbol}`, { to: S.m.carbon.zapRouter, value: q.amountIn, data: call(ABI.zap, 'zapBuy', [ethKeys(), q.o.pad.key, min, S.account, deadline]) });
      else {
        await approveIfNeeded(t.address, S.m.carbon.zapRouter, q.amountIn, t.symbol);
        await send(`Sell ${t.symbol}`, { to: S.m.carbon.zapRouter, data: call(ABI.zap, 'zapSell', [ethKeys(), q.o.pad.key, q.amountIn, min, S.account, deadline]) });
      }
    } else {
      const r = swapOf(S.m).swapRouter;
      if (q.buy) await send(`Buy ${t.symbol}`, { to: r, value: q.amountIn, data: call(ABI.router, 'exactInputSingle', [{ tokenIn: S.m.whype, tokenOut: t.address, fee: q.fee, recipient: S.account, deadline, amountIn: q.amountIn, amountOutMinimum: min, sqrtPriceLimitX96: 0n }]) });
      else {
        await approveIfNeeded(t.address, r, q.amountIn, t.symbol);
        const swap = call(ABI.router, 'exactInputSingle', [{ tokenIn: t.address, tokenOut: S.m.whype, fee: q.fee, recipient: zeroAddress, deadline, amountIn: q.amountIn, amountOutMinimum: min, sqrtPriceLimitX96: 0n }]);
        await send(`Sell ${t.symbol}`, { to: r, data: call(ABI.router, 'multicall', [[swap, call(ABI.router, 'unwrapWETH9', [min, S.account])]]) });
      }
    }
    await refresh();
  }));

  for (const el of [sel, side]) el.addEventListener('change', refresh);
  amt.addEventListener('change', refresh);
  const slip = h('select', {}, ...[50, 100, 300, 500].map((b) => h('option', { value: b, selected: BigInt(b) === S.slippageBps }, pct(b))));
  slip.addEventListener('change', () => { S.slippageBps = BigInt(slip.value); refresh(); });
  main.replaceChildren(h('section', { class: 'ely-card' }, h('h2', {}, pin ? `Trade ${S.tokens.get(pin.token).symbol}` : 'Trade'),
    pin ? null : field('Market', sel, `HYPE pad tokens trade on their Carbon pool (V4 hook). Everything else routes through ${BRAND.dex} V3. No HYPE on Elysium yet? Bridge it from HyperEVM on the Bridge tab.`),
    h('div', { class: 'ely-row' }, field('Side', side), field('Amount', amt), field('Slippage', slip)),
    quoteBox, go, feesBox));
  refresh();
}

// ------------------------------------------------------------------------------------------
// Create (Carbon launch)
// ------------------------------------------------------------------------------------------

function cidFromDigest(hex) {
  // CIDv1, raw codec (0x55), sha2-256 multihash, base32 lower ("b" prefix)
  const bytes = [0x01, 0x55, 0x12, 0x20, ...hex.slice(2).match(/../g).map((b) => parseInt(b, 16))];
  const alpha = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, val = 0, out = 'b';
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += alpha[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += alpha[(val << (5 - bits)) & 31];
  return out;
}

async function create(main) {
  const c = S.m.carbon;
  const minBuy = await read(c.launcher, ABI.launcher, 'minDevBuyFor', [S.m.whype]);
  const caps = S.m.caps || {};
  const ref = new URLSearchParams(location.search).get('ref');
  const f = {
    name: h('input', { maxlength: 32, required: true, placeholder: BRAND.sampleName }),
    symbol: h('input', { maxlength: 10, required: true, placeholder: 'HCAT' }),
    supply: h('input', { inputmode: 'numeric', value: '1000000000' }),
    mcap: h('input', { inputmode: 'decimal', value: String(caps.defaultOpeningMarketCapHype ?? 20) }),
    fee: h('select', {}, ...[200, 250, 300, 400, 500, 1000].map((b) => h('option', { value: b, selected: b === 300 }, pct(b)))),
    sell: h('select', {}, ...[200, 250, 300, 400, 500, 1000].map((b) => h('option', { value: b, selected: b === 300 }, pct(b)))),
    creator: h('select', {}, ...[0, 1000, 2000, 3000, 5000].map((b) => h('option', { value: b, selected: b === 2000 }, `${b / 100}% of the post-platform fee`))),
    dev: h('input', { inputmode: 'decimal', value: formatUnits(minBuy > parseUnits('0.01', 18) ? minBuy : parseUnits('0.01', 18), 18) }),
    image: h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif' }),
    referrer: h('input', { value: ref && isAddress(ref) ? ref : '', placeholder: '0x… (optional)' }),
  };
  const preview = h('div', { class: 'ely-quote', 'aria-live': 'polite' });
  let digest = null;
  f.image.addEventListener('change', async () => {
    const file = f.image.files[0];
    if (!file) return;
    if (file.size > 2_000_000) { toast('Image must be under 2 MB.', 'bad'); f.image.value = ''; return; }
    digest = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())));
    preview.replaceChildren(h('img', { src: URL.createObjectURL(file), alt: 'Token image preview', class: 'ely-thumb' }),
      h('small', {}, `Image CID committed on-chain: ${cidFromDigest(digest)}. Pin this exact file to IPFS so wallets and screeners can show it.`));
  });
  const go = h('button', { class: 'ely-btn primary' }, 'Launch');
  go.addEventListener('click', () => guarded(go, async () => {
    if (!S.account) throw new Error('Connect a wallet first.');
    if (!f.name.value.trim() || !f.symbol.value.trim()) throw new Error('Name and symbol are required.');
    if (!digest) throw new Error('Pick an image; its hash is committed on-chain (ImageRequired).');
    const supply = parseUnits(f.supply.value || '0', 18);
    const mcap = parseUnits(f.mcap.value || '0', 18);
    const dev = parseUnits(f.dev.value || '0', 18);
    if (caps.maxOpeningMarketCapHype && mcap > parseUnits(String(caps.maxOpeningMarketCapHype), 18)) throw new Error(`Mainnet-test cap: opening market cap ≤ ${caps.maxOpeningMarketCapHype} HYPE.`);
    if (caps.maxDevBuyHype && dev > parseUnits(String(caps.maxDevBuyHype), 18)) throw new Error(`Mainnet-test cap: opening buy ≤ ${caps.maxDevBuyHype} HYPE.`);
    if (dev < minBuy) throw new Error(`Opening buy must be at least ${fmt(minBuy)} HYPE.`);
    if (dev > mcap / 10n) throw new Error('Opening buy is capped at 10% of the opening market cap.');
    const refAddr = f.referrer.value.trim();
    if (refAddr && !isAddress(refAddr)) throw new Error('Referrer is not an address.');
    const salt = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const p = {
      name: f.name.value.trim(), symbol: f.symbol.value.trim().toUpperCase(), supply, pair: S.m.whype,
      openingMarketCap: mcap, graduationThreshold: mcap * 100n, feeBps: Number(f.fee.value), sellFeeBps: Number(f.sell.value),
      burnBps: 0, vestDuration: 0n, vestCliff: 0n, creatorBps: Number(f.creator.value), maxWalletBps: 0, tickSpacing: 60,
      devBuyPairAmount: dev, salt, minPushPayout: 10n ** 9n, minShareForQueue: supply / 200n, rewardCurrency: zeroAddress,
      feeRecipient: zeroAddress, referrer: refAddr ? getAddress(refAddr) : zeroAddress, openingWindow: 120, openingFeeBps: 5000,
      metadata: { imageCid: digest, bannerCid: `0x${'0'.repeat(64)}`, infoCid: `0x${'0'.repeat(64)}` },
    };
    const data = call(ABI.launcher, 'launch', [p]);
    const wb = await read(S.m.whype, ABI.erc20, 'balanceOf', [S.account]);
    if (wb < dev) await send('Wrap HYPE for the opening buy', { to: S.m.whype, value: dev - wb, data: call(ABI.whype, 'deposit', []) });
    await approveIfNeeded(S.m.whype, c.launcher, dev, 'WHYPE');
    const r = await send(`Launch ${p.symbol}`, { to: c.launcher, data });
    const log = r.logs.find((l) => l.address.toLowerCase() === c.launcher.toLowerCase() && l.topics.length === 4);
    const token = log ? getAddress(`0x${log.topics[1].slice(26)}`) : null;
    toast(`Launched ${p.symbol}${token ? ` at ${token}` : ''}.`, 'good');
  }));
  main.replaceChildren(h('section', { class: 'ely-card' }, h('h2', {}, 'Launch a token on the HYPE pad'),
    h('p', { class: 'ely-muted' }, `Straight to a locked pool: the whole supply is seeded single-sided into a Uniswap V4 pool with the ${BRAND.hook} fee hook. Liquidity can never be removed. Anti-snipe: buy fee starts at 50% and decays to your rate over 120 s, the extra goes to the platform.`),
    h('div', { class: 'ely-row' }, field('Name', f.name), field('Symbol', f.symbol)),
    h('div', { class: 'ely-row' }, field('Supply', f.supply), field('Opening market cap (HYPE)', f.mcap, caps.maxOpeningMarketCapHype ? `Cap during mainnet test: ${caps.maxOpeningMarketCapHype} HYPE` : null)),
    h('div', { class: 'ely-row' }, field('Buy fee', f.fee, 'Must be above 1%: the platform takes a flat 1% of volume.'), field('Sell fee', f.sell), field('Creator share', f.creator)),
    h('div', { class: 'ely-row' }, field('Opening buy (HYPE)', f.dev, `Required. Min ${fmt(minBuy)}, max 10% of the opening market cap${caps.maxDevBuyHype ? `, and ${caps.maxDevBuyHype} HYPE during the mainnet test` : ''}.`), field('Referrer', f.referrer, 'Receives 30% of the platform cut from this launch.')),
    field('Image', f.image), preview, go));
}

// ------------------------------------------------------------------------------------------
// Portfolio + claims
// ------------------------------------------------------------------------------------------

async function portfolio(main) {
  if (!S.account) { main.replaceChildren(h('section', { class: 'ely-card' }, h('p', {}, 'Connect a wallet to see balances and claims.'))); return; }
  const account = S.account, context = wallets.capture();
  const history = h('section', { class: 'ely-card' }, h('h2', {}, `Elysium ${S.m.chainId} · transaction status`), h('p', { class: 'purr-address' }, account));
  if (__PURRLYSIUM__) {
    for (const chainId of [S.m.chainId, ...(S.m.bridge ? [S.m.bridge.parentChainId] : [])]) {
      const key = `purrlysium.evm.${chainId}.${account.toLowerCase()}.pending`, raw = localStorage.getItem(key), last = localStorage.getItem(`${key}.last`);
      if (last) { const item = JSON.parse(last); history.append(h('p', { class: 'purr-address' }, `${item.status} · ${item.label} · ${item.hash}`)); }
      if (!raw) continue;
      const item = JSON.parse(raw);
      history.append(h('p', { class: 'purr-address' }, `${item.label}: ${item.hash || 'Wallet request unresolved. Check wallet activity before resolving this record.'}`));
      const check = h('button', { class: 'ely-btn', onclick: async () => {
        check.disabled = true;
        try {
          if (!item.hash) { toast('Inspect your wallet activity. An unresolved send cannot safely be retried automatically.', 'bad'); return; }
          const receipt = await rpc('eth_getTransactionReceipt', [item.hash], chainId === S.m.chainId ? '' : String(chainId));
          if (!receipt) { toast(`Still pending on EVM ${chainId}: ${item.hash}`); return; }
          localStorage.setItem(`${key}.last`, JSON.stringify({ ...item, status: receipt.status === '0x1' ? 'confirmed' : 'reverted' })); localStorage.removeItem(key);
          if (wallets.current(context)) render();
        } catch (e) { toast(explainError(e), 'bad'); } finally { check.disabled = false; }
      } }, 'Check pending transaction');
      history.append(check);
    }
    history.append(h('p', { class: 'ely-muted' }, 'This browser’s latest transaction per chain/account only; not a complete on-chain history. Disconnect does not revoke wallet permissions or approvals.'));
  }
  await loadLaunches();
  const [native, whype, owed] = await Promise.all([
    rpc('eth_getBalance', [S.account, 'latest']).then(BigInt), read(S.m.whype, ABI.erc20, 'balanceOf', [S.account]),
    read(S.m.carbon.referralVault, ABI.vault, 'owed', [S.account, S.m.whype]),
  ]);
  const claimRef = h('button', { class: 'ely-btn', disabled: owed === 0n }, 'Claim');
  claimRef.addEventListener('click', () => guarded(claimRef, async () => { await send('Claim referral share', { to: S.m.carbon.referralVault, data: call(ABI.vault, 'claim', [S.m.whype]) }); render(); }));
  const unwrap = h('button', { class: 'ely-btn', disabled: whype === 0n }, 'Unwrap all');
  unwrap.addEventListener('click', () => guarded(unwrap, async () => { await send('Unwrap WHYPE', { to: S.m.whype, data: call(ABI.whype, 'withdraw', [whype]) }); render(); }));
  const rows = [];
  for (const l of S.launches) {
    const t = S.tokens.get(l.token);
    const dist = await read(l.token, ABI.launchToken, 'distributor');
    const [bal, w] = await Promise.all([read(l.token, ABI.erc20, 'balanceOf', [S.account]), read(dist, ABI.distributor, 'withdrawableOf', [S.account])]);
    if (bal === 0n && w === 0n && l.creator !== S.account) continue;
    const btn = h('button', { class: 'ely-btn', disabled: w === 0n }, 'Claim');
    btn.addEventListener('click', () => guarded(btn, async () => { await send(`Claim ${t.symbol} holder rewards`, { to: dist, data: call(ABI.distributor, 'withdraw', []) }); render(); }));
    // Anyone may sweep a pool's pending fees into creator/holders/platform and receive the 0.5% bounty.
    const [pf, ptf] = await Promise.all([read(S.m.carbon.feeHook, ABI.feeHook, 'pendingFees', [l.poolId]), read(S.m.carbon.feeHook, ABI.feeHook, 'pendingTokenFees', [l.poolId])]);
    const sw = h('button', { class: 'ely-btn', disabled: pf === 0n && ptf === 0n, title: 'Distribute pending fees; the caller receives the 0.5% keeper bounty' }, 'Sweep fees');
    sw.addEventListener('click', () => guarded(sw, async () => { await send(`Sweep ${t.symbol} fees`, { to: S.m.carbon.feeHook, data: call(ABI.feeHook, 'sweep', [l.key]) }); render(); }));
    rows.push(h('tr', {}, h('td', {}, t.symbol, l.creator === S.account ? ' (your launch: creator fees arrive automatically at each sweep)' : ''), h('td', {}, fmt(bal, t.decimals, 2)), h('td', {}, `${fmt(w)} WHYPE`), h('td', {}, `${fmt(pf)} WHYPE + ${fmt(ptf, t.decimals, 2)} ${t.symbol}`), h('td', {}, btn, ' ', sw)));
  }
  main.replaceChildren(...(__PURRLYSIUM__ ? [history] : []), h('section', { class: 'ely-card' }, h('h2', {}, 'Wallet'),
    h('table', { class: 'ely-table' },
      h('tr', {}, h('th', {}, 'HYPE'), h('td', {}, fmt(native)), h('td', {})),
      h('tr', {}, h('th', {}, 'WHYPE'), h('td', {}, fmt(whype)), h('td', {}, unwrap)),
      h('tr', {}, h('th', {}, 'Referral share (30% of platform cut)'), h('td', {}, `${fmt(owed)} WHYPE`), h('td', {}, claimRef)))),
  h('section', { class: 'ely-card' }, h('h2', {}, 'HYPE pad holdings & holder rewards'),
    rows.length ? h('table', { class: 'ely-table' }, h('tr', {}, ...['Token', 'Balance', 'Claimable', 'Pending pool fees', ''].map((x) => h('th', {}, x))), ...rows) : h('p', { class: 'ely-muted' }, 'No pad tokens held.'),
    h('p', { class: 'ely-muted' }, 'Holder rewards stream over 24 h. 20% is split equally among wallets that held at least 0.5% of supply for 24 h; 80% is pro-rata. Legal note: fee-share payouts to holders are dividend-like; check your local rules.')));
}

// ------------------------------------------------------------------------------------------
// Bridge (canonical Kinetiq Arbitrum-Orbit bridge; never our own)
// ------------------------------------------------------------------------------------------

async function bridge(main) {
  const b = S.m.bridge;
  if (!b) {
    main.replaceChildren(h('section', { class: 'ely-card' }, h('h2', {}, 'Bridge'), h('p', {}, 'The canonical Kinetiq bridge is configured for Elysium mainnet (99901) only. On this network get test HYPE from the official faucet.')));
    return;
  }
  const dep = h('input', { inputmode: 'decimal', value: '0.1' });
  const wd = h('input', { inputmode: 'decimal', value: '0.1' });
  const dBtn = h('button', { class: 'ely-btn primary' }, 'Deposit HyperEVM → Elysium');
  const wBtn = h('button', { class: 'ely-btn' }, 'Withdraw Elysium → HyperEVM');
  dBtn.addEventListener('click', () => guarded(dBtn, async () => {
    await send('Deposit HYPE (HyperEVM)', { to: b.inbox, value: parseUnits(dep.value, 18), data: call(ABI.inbox, 'depositEth', []) }, true);
    toast('Deposit included on HyperEVM. HYPE arrives on Elysium once the sequencer picks it up, usually within minutes.', 'good');
    await ensureChain();
  }));
  wBtn.addEventListener('click', () => guarded(wBtn, async () => {
    await send('Start withdrawal', { to: b.arbSys, value: parseUnits(wd.value, 18), data: call(ABI.arbSys, 'withdrawEth', [S.account]) });
    render();
  }));

  // ERC-20s use the Arbitrum token bridge: L1GatewayRouter.outboundTransfer on HyperEVM creates a
  // retryable ticket; L2GatewayRouter.outboundTransfer on Elysium starts a withdrawal.
  const tok = h('input', { value: b.l1Whype, placeholder: 'HyperEVM token address' });
  const tAmt = h('input', { inputmode: 'decimal', value: '0.1' });
  const tIn = h('button', { class: 'ely-btn primary' }, 'Deposit token HyperEVM → Elysium');
  const tOut = h('button', { class: 'ely-btn' }, 'Withdraw token Elysium → HyperEVM');
  const tInfo = h('div', { class: 'ely-quote', 'aria-live': 'polite' });
  async function tokenRoute() {
    const l1 = getAddress(tok.value.trim());
    const [[sym], [dec], [gw], [l2]] = await Promise.all([
      readParent(l1, ABI.erc20, 'symbol').then((x) => [x]), readParent(l1, ABI.erc20, 'decimals').then((x) => [x]),
      readParent(b.l1GatewayRouter, ABI.l1Router, 'getGateway', [l1]).then((x) => [x]),
      read(b.l2GatewayRouter, ABI.l2Router, 'calculateL2TokenAddress', [l1]).then((x) => [x]),
    ]);
    tInfo.textContent = `${sym}: HyperEVM ${short(l1)} → Elysium ${short(l2)} via gateway ${short(gw)}${gw.toLowerCase() === b.l1WhypeGateway.toLowerCase() ? ' (Kinetiq WHYPE gateway)' : ''}`;
    return { l1, sym, dec: Number(dec), gw, l2 };
  }
  tok.addEventListener('change', () => tokenRoute().catch((e) => { tInfo.textContent = explainError(e); }));
  tIn.addEventListener('click', () => guarded(tIn, async () => {
    const r = await tokenRoute();
    const amount = parseUnits(tAmt.value, r.dec);
    await ensureChain(b.parentChainId, parentParams());
    const [allow] = [await readParent(r.l1, ABI.erc20, 'allowance', [S.account, r.gw])];
    if (allow < amount) await send(`Approve ${r.sym} for the bridge`, { to: r.l1, data: call(ABI.erc20, 'approve', [r.gw, amount]) }, true);
    // Retryable ticket pricing: submission fee for the gateway's own calldata (x3 buffer), L2
    // execution gas 300k at 2x the current Elysium gas price. Unused HYPE is refunded on Elysium.
    const callData = await readParent(r.gw, ABI.l1Gateway, 'getOutboundCalldata', [r.l1, S.account, S.account, amount, '0x']);
    const parentBase = BigInt((await rpc('eth_getBlockByNumber', ['latest', false], String(b.parentChainId))).baseFeePerGas || '0x0');
    const subFee = (await readParent(b.inbox, ABI.inbox, 'calculateRetryableSubmissionFee', [BigInt((callData.length - 2) / 2), parentBase])) * 3n;
    const l2Price = BigInt(await rpc('eth_gasPrice', [])) * 2n;
    const maxGas = 300_000n;
    const data = encodeAbiParameters([{ type: 'uint256' }, { type: 'bytes' }], [subFee, '0x']);
    await send(`Deposit ${r.sym} (HyperEVM)`, { to: b.l1GatewayRouter, value: subFee + maxGas * l2Price, data: call(ABI.l1Router, 'outboundTransfer', [r.l1, S.account, amount, maxGas, l2Price, data]) }, true);
    toast(`${r.sym} deposit submitted. It is minted on Elysium at ${short(r.l2)} once the retryable executes (minutes).`, 'good');
    await ensureChain();
  }));
  tOut.addEventListener('click', () => guarded(tOut, async () => {
    const r = await tokenRoute();
    const amount = parseUnits(tAmt.value, r.dec);
    await send(`Withdraw ${r.sym}`, { to: b.l2GatewayRouter, data: call(ABI.l2Router, 'outboundTransfer', [r.l1, S.account, amount, '0x']) });
    render();
  }));
  const pending = h('div', {}, S.account ? 'Loading withdrawals…' : 'Connect a wallet to see pending withdrawals.');
  main.replaceChildren(h('section', { class: 'ely-card' }, h('h2', {}, 'Bridge HYPE (canonical Kinetiq bridge)'),
    h('p', { class: 'ely-muted' }, `Contracts verified on chain: Inbox ${short(b.inbox)} → Bridge ${short(b.bridge)} → Rollup ${short(b.rollup)} (chainId ${S.m.chainId}). Withdrawals wait for the rollup's challenge period (${b.confirmPeriodBlocks.toLocaleString()} HyperEVM blocks), then must be claimed on HyperEVM.`),
    h('div', { class: 'ely-row' }, field('Deposit amount (HYPE)', dep), dBtn), h('div', { class: 'ely-row' }, field('Withdraw amount (HYPE)', wd), wBtn)),
  h('section', { class: 'ely-card' }, h('h2', {}, 'Bridge tokens (Arbitrum token bridge)'),
    h('p', { class: 'ely-muted' }, `Gateway routers verified on chain: HyperEVM ${short(b.l1GatewayRouter)} ⇄ Elysium ${short(b.l2GatewayRouter)}. WHYPE uses Kinetiq's custom gateway and arrives as Elysium WHYPE. Deposits pay a small HYPE fee for the retryable ticket (unused part refunded on Elysium).`),
    field('Token on HyperEVM', tok), h('div', { class: 'ely-row' }, field('Amount', tAmt), tIn, tOut), tInfo),
  h('section', { class: 'ely-card' }, h('h2', {}, 'Withdrawals'), pending));
  if (!S.account) return;
  const topic = keccak256(new TextEncoder().encode('L2ToL1Tx(address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes)'));
  const head = BigInt(await rpc('eth_blockNumber', []));
  const logs = [];
  // L2ToL1Tx indexes destination (topic 2), not caller; withdrawals here always send to self.
  const dest = `0x${S.account.slice(2).toLowerCase().padStart(64, '0')}`;
  for (let to = head, i = 0; i < 40 && to > 0n; i++, to -= 50_000n) {
    const from = to >= 49_999n ? to - 49_999n : 0n;
    logs.push(...await rpc('eth_getLogs', [{ address: b.arbSys, topics: [topic, dest], fromBlock: toHex(from), toBlock: toHex(to) }]).catch(() => []));
  }
  pending.replaceChildren(logs.length ? h('table', { class: 'ely-table' }, h('tr', {}, ...['Block', 'Amount', 'Status'].map((x) => h('th', {}, x))),
    ...logs.map((l) => { const ev = decodeEventLog({ abi: ABI.arbSys, data: l.data, topics: l.topics }); return h('tr', {}, h('td', {}, String(Number(l.blockNumber))), h('td', {}, `${fmt(ev.args.callvalue)} HYPE`), h('td', {}, 'Pending challenge period → claim on HyperEVM with the official Kinetiq bridge UI')); }))
    : h('p', { class: 'ely-muted' }, 'No withdrawals in the last 2,000,000 blocks.'));
}

// ------------------------------------------------------------------------------------------
// Developers
// ------------------------------------------------------------------------------------------

async function developers(main) {
  const m = S.m;
  const rows = [];
  const add = (group, name, addr) => addr && rows.push([group, name, addr]);
  for (const [k, v] of Object.entries(m.carbon)) if (typeof v === 'string' && isAddress(v)) add('HYPE pad (Carbon)', k, v);
  for (const [k, v] of Object.entries(swapOf(m))) if (typeof v === 'string' && isAddress(v) && k !== 'factoryOwner') add(`${BRAND.dex} V3`, k, v);
  if (swapOf(m).factoryOwner) add('Admin', `${BRAND.dex} factory owner`, swapOf(m).factoryOwner);
  add('Canonical', 'WHYPE (Kinetiq aeWETH proxy)', m.whype);
  add('Canonical', 'Uniswap V4 PoolManager', m.carbon.poolManager);
  const tbody = rows.map(([g, n, a]) => {
    const td = h('td', { class: 'ely-mono' }, '…');
    rpc('eth_getCode', [a, 'latest']).then((c) => { td.textContent = c === '0x' ? (g === 'Admin' ? 'EOA (no code): use a multisig on mainnet' : 'NO CODE') : `${(c.length - 2) / 2} B · ${keccak256(c).slice(0, 18)}…`; }).catch(() => { td.textContent = 'n/a'; });
    return h('tr', {}, h('td', {}, g), h('td', {}, n), h('td', { class: 'ely-mono' }, m.explorer ? h('a', { href: `${m.explorer}/address/${a}`, target: '_blank', rel: 'noopener' }, a) : a), td);
  });
  const abiBlob = URL.createObjectURL(new Blob([JSON.stringify(SOURCES, null, 2)], { type: 'application/json' }));
  const manBlob = URL.createObjectURL(new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' }));
  main.replaceChildren(h('section', { class: 'ely-card' }, h('h2', {}, 'Developers'),
    h('p', { class: 'ely-muted' }, `Chain ${m.chainId}. Runtime size and keccak256(runtime) are read live from the chain. DEX name: ${BRAND.dex} (V3, fee tiers ${swapOf(m).feeTiers.map((x) => x / 10000 + '%').join(' / ')}); pool init code hash ${swapOf(m).poolInitCodeHash}.`),
    h('table', { class: 'ely-table' }, h('tr', {}, ...['System', 'Contract', 'Address', 'Runtime'].map((x) => h('th', {}, x))), ...tbody),
    h('p', {}, h('a', { href: abiBlob, download: `${BRAND.file}-abis.json`, class: 'ely-btn' }, 'Download ABIs'), ' ', h('a', { href: manBlob, download: `${BRAND.file}-${m.chainId}.json`, class: 'ely-btn' }, 'Download manifest')),
    h('h3', {}, 'Admin surface (what we can and cannot do)'),
    h('ul', {}, ...m.disclosures.map((d) => h('li', {}, d)))));
}

// ------------------------------------------------------------------------------------------

async function boot() {
  if (standaloneAngel) { const translate = watchPadCopy(); mountPreferences({ setLanguage, translate }); }
  const r = await fetch('/elysium/manifest.json');
  if (!r.ok) { $('#ely-main').textContent = 'Hypeliysium is not enabled on this deployment.'; return; }
  S.m = await r.json();
  // Reads are batched through Multicall3 (canonical address, deployed on Elysium testnet and
  // mainnet) so the LP terminal stays far below the proxy's per-IP rate limit. Without it on
  // chain, every read is its own eth_call.
  const mc3 = S.m.multicall3 || '0xcA11bde05977b3631167028862bE2a173976CA11';
  const hasMc3 = (await rpc('eth_getCode', [mc3, 'latest']).catch(() => '0x')) !== '0x';
  const chain = hasMc3 ? { ...chainDef(), contracts: { multicall3: { address: mc3 } } } : chainDef();
  S.pub = createPublicClient({ chain, transport: http(`${location.origin}/api/elysium/rpc`), batch: hasMc3 ? { multicall: { wait: 16, batchSize: 4096 } } : undefined });
  if (__PURRLYSIUM__) {
    try { referral = captureReferral(location.href, sessionStorage, S.m.chainId); } catch { referral = { address: null, error: 'Session storage is unavailable; referral attribution cannot be retained.' }; }
    if (referral.address && new URLSearchParams(location.search).has('ref')) { const url = new URL(location.href); url.searchParams.set('refChain', 'elysium'); history.replaceState(null, '', url); }
  }
  routeFromHash();
  if (__PURRLYSIUM__ && !routeError && !showArrival) history.replaceState(null, '', hrefFor(S.tab, wallets.active, new URLSearchParams(location.search).get('token')));
  window.addEventListener('hashchange', () => { if (routeFromHash()) render(); });
  if (__PURRLYSIUM__) {
    window.addEventListener('popstate', () => { routeFromHash(); render(); });
    document.addEventListener('click', event => {
      const anchor = event.target.closest('a');
      if (!anchor || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      const raw = anchor.getAttribute('href');
      if (raw?.startsWith('#') || ['/docs', '/', '/hypurrheaven/'].includes(raw)) {
        if (raw === '/' && heavenPreview || raw === '/hypurrheaven/' && !heavenPreview) return;
        event.preventDefault(); goSection(raw === '/docs' ? 'docs' : raw.startsWith('#') ? raw.slice(1).split('/')[0] : 'markets');
      }
    });
  }
  if (heavenPreview) {
    const revealPad = () => $('#ely-tabs').scrollIntoView({ block: 'start', behavior: 'instant' });
    // pushState navigation needs popstate as well as hashchange; Back must restore content,
    // including coin-to-coin entries whose tab name is unchanged.
    window.addEventListener('popstate', () => {
      if (location.hash) revealPad(); else scrollTo({ top: 0, behavior: 'instant' });
    });
    document.addEventListener('click', (event) => {
      if (__PURRLYSIUM__) return;
      const a = event.target.closest('.heaven-pad a[href^="#"], .ely-dock a[href^="#"]');
      if (!a || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      if (location.hash !== a.hash) navigatePad(a.hash);
      routeFromHash(); render(); revealPad();
    });
  }
  $('#ely-risk').replaceChildren(...S.m.risk.map((x) => h('li', {}, x)));
  render();
  if (__PURRLYSIUM__ && S.tab !== 'funding') liveStrip({ S, h, rpc, loadLaunches, tokenInfo });
}

boot().catch((e) => { $('#ely-main').textContent = explainError(e); });
