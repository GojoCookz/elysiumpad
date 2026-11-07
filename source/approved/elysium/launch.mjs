// Purrlysium launch: image, name, ticker, optional description and socials, buy and sell fee,
// where the fee goes (one bar, four presets, two sliders) and a first buy, with a live preview.
// Fixed for everyone: 1B supply, $2,500 opening market cap (converted at the live HYPE price),
// 120 s anti-snipe, liquidity locked forever. The image and the info are committed on chain as
// sha256 hashes and uploaded after launch; the server only keeps bytes that match the hash.
import { parseUnits, formatUnits, getAddress, isAddress, toHex, zeroAddress } from 'viem';
import { ABI } from './abi.mjs';
import { reviewTransaction } from './header.mjs';
import { validDecimalInput } from './i18n.mjs';

const OPEN_USD = 2500;
const SUPPLY = 1_000_000_000n * 10n ** 18n;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ZERO32 = `0x${'0'.repeat(64)}`;
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const sha = async (bytes) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));

export async function launchSimple(main, ctx) {
  const { S, h, read, send, call, approveIfNeeded, toast, guarded, connect, fmt } = ctx;
  const c = S.m.carbon;
  const [minBuy, hypeUsd, platformVolumeBps, keeperBps] = await Promise.all([
    read(c.launcher, ABI.launcher, 'minDevBuyFor', [S.m.whype]),
    fetch('/api/purrlysium/callouts').then((r) => r.json()).then((j) => Number(j.hypeUsd) || 0).catch(() => 0),
    read(c.feeHook, ABI.feeHook, 'PLATFORM_VOLUME_BPS'),
    read(c.feeHook, ABI.feeHook, 'SWEEP_BOUNTY_BPS'),
  ]);
  const ref = ctx.referral || new URLSearchParams(location.search).get('ref');
  // Shares are of the fee left after the platform's fixed 1% of volume.
  const st = { buy: 3, sell: 3, you: 100, holders: 0, burn: 0, digest: null, img: '', bytes: null };
  const openHype = hypeUsd ? OPEN_USD / hypeUsd : 0;
  const minDev = Number(formatUnits(minBuy, 18));

  const name = h('input', { maxlength: 32, placeholder: 'Sample Coin', autocomplete: 'off' });
  const ticker = h('input', { maxlength: 10, placeholder: 'COIN', autocomplete: 'off' });
  const desc = h('textarea', { maxlength: 280, rows: 2, placeholder: 'Description (optional)' });
  const web = h('input', { placeholder: 'yourcoin.xyz', autocomplete: 'off' });
  const xh = h('input', { placeholder: '@yourcoin', autocomplete: 'off' });
  const tg = h('input', { placeholder: '@yourcoin', autocomplete: 'off' });

  // ---- image
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', class: 'purr-sr', id: 'purr-launch-img' });
  const drop = h('label', { class: 'purr-drop', for: 'purr-launch-img' });
  const blankDrop = () => drop.replaceChildren(h('b', {}, '+'), h('strong', {}, 'Coin image'), h('span', {}, 'PNG, JPG, WEBP, GIF · 2 MB'));
  blankDrop();
  async function takeFile(f) {
    if (!f) return;
    if (f.size > 2_000_000) { toast('Image must be under 2 MB.', 'bad'); return; }
    st.bytes = new Uint8Array(await f.arrayBuffer());
    st.digest = await sha(st.bytes);
    st.img = URL.createObjectURL(f);
    drop.replaceChildren(h('img', { src: st.img, alt: 'Coin image' }));
    preview();
  }
  file.addEventListener('change', () => takeFile(file.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); takeFile(e.dataTransfer.files[0]); });

  // ---- fee steppers: type, tap − / +
  function stepper(label, key) {
    const box = h('input', { type: 'number', min: 1.5, max: 10, step: 0.5, value: st[key], inputmode: 'decimal', 'aria-label': `${label} %` });
    const set = (v) => { const n = clamp(Math.round(Number(v) * 2) / 2, 1.5, 10); if (!Number.isFinite(n)) return; st[key] = n; box.value = n; preview(); };
    box.addEventListener('change', () => set(box.value));
    return h('div', { class: 'purr-stepper' }, h('span', {}, label),
      h('button', { type: 'button', 'aria-label': `Lower ${label}`, onclick: () => set(st[key] - 0.5) }, '−'),
      h('label', { class: 'purr-stepper-val' }, box, h('em', {}, '%')),
      h('button', { type: 'button', 'aria-label': `Raise ${label}`, onclick: () => set(st[key] + 0.5) }, '+'));
  }

  // ---- where the fee goes
  const bar = h('div', { class: 'purr-feebar', 'aria-hidden': 'true' });
  const legend = h('div', { class: 'purr-feelegend' });
  const presets = h('div', { class: 'purr-presets', role: 'group', 'aria-label': 'Fee presets' });
  const PRESETS = [['All to me', 100, 0, 0], ['Reward holders', 0, 100, 0], ['Burn it', 0, 0, 100], ['Three ways', 50, 30, 20]];
  function slider(label, key, hint) {
    const r = h('input', { type: 'range', min: 0, max: 100, step: 5, value: st[key], 'aria-label': label });
    const out = h('b', {}, `${st[key]}%`);
    r.addEventListener('input', () => {
      st[key] = Number(r.value);
      const other = key === 'holders' ? 'burn' : 'holders';
      if (st.holders + st.burn > 100) st[other] = 100 - st[key];
      st.you = 100 - st.holders - st.burn;
      sync();
    });
    return { el: h('div', { class: 'purr-sl' }, h('div', {}, h('span', {}, label, h('small', {}, ` · ${hint}`)), out), r), r, out };
  }
  const sH = slider('Holders', 'holders', 'paid in HYPE to everyone holding, by balance');
  const sB = slider('Buyback & burn', 'burn', 'buys the coin back and burns it');
  function sync() {
    sH.r.value = st.holders; sH.out.textContent = `${st.holders}%`;
    sB.r.value = st.burn; sB.out.textContent = `${st.burn}%`;
    presets.replaceChildren(...PRESETS.map(([label, y, ho, bu]) => {
      const on = st.you === y && st.holders === ho && st.burn === bu;
      return h('button', { type: 'button', class: on ? 'on' : '', 'aria-pressed': String(on), onclick: () => { st.you = y; st.holders = ho; st.burn = bu; sync(); } }, label);
    }));
    preview();
  }
  function drawBar() {
    const platform = Math.floor(Number(platformVolumeBps) * 10000 / Math.round(st.buy * 100));
    const creatorRatio = st.you + st.holders ? Math.round(st.you / (st.you + st.holders) * 10000) : 0;
    const creator = Math.floor((10000 - platform) * creatorRatio / 10000);
    const afterKeeper = st.buy * (10000 - Number(keeperBps)) / 10000;
    const pool = afterKeeper * (100 - st.burn) / 100;
    const parts = [['Platform', pool * platform / 10000, 'p'], ['You', pool * creator / 10000, 'y'], ['Holders', pool * (10000 - platform - creator) / 10000, 'h'], ['Burn', afterKeeper * st.burn / 100, 'b'], ['Keeper', st.buy - afterKeeper, 'p']];
    bar.replaceChildren(...parts.filter(([, v]) => v > 0).map(([, v, k]) => { const i = h('i', { class: k }); i.style.flexGrow = String(v); return i; }));
    legend.replaceChildren(...parts.map(([label, v, k]) => h('span', { class: k }, `${label} `, h('b', {}, `≈ ${v.toFixed(4)}%`))));
  }

  // ---- first buy
  const dev = h('input', { inputmode: 'decimal', value: String(Math.max(minDev, 0.1)), 'aria-label': 'Initial buy (HYPE)' });
  const devUsd = h('small', {});
  dev.addEventListener('input', () => preview());
  const chips = h('div', { class: 'purr-quicks' }, ...['0.1', '0.5', '1', '2'].map((v) => h('button', { type: 'button', class: 'purr-quick', onclick: () => { dev.value = v; preview(); } }, `${v} HYPE`)));

  // ---- preview
  const pv = h('aside', { class: 'purr-panel purr-launch-preview', 'aria-label': 'Preview' });
  const cost = h('div', { class: 'purr-launch-cost', 'aria-live': 'polite' });
  function preview() {
    drawBar();
    const v = Number(dev.value) || 0;
    devUsd.textContent = hypeUsd ? `≈ $${(v * hypeUsd).toFixed(2)} · up to $${OPEN_USD / 10}` : `min ${minDev} HYPE`;
    const row = (k, val) => h('div', {}, h('dt', {}, k), h('dd', {}, val));
    const split = [st.you && `${st.you}% you`, st.holders && `${st.holders}% holders`, st.burn && `${st.burn}% burn`].filter(Boolean).join(' · ') || '—';
    cost.replaceChildren(h('p', {}, 'Total', ': ', h('b', { 'data-no-translate': '' }, `${validDecimalInput(dev.value) ? dev.value : '—'} HYPE`), ' + ', h('span', {}, 'network fees')),
      h('p', {}, 'Fees', ': ', `${st.buy}% buy · ${st.sell}% sell`), h('small', {}, 'Initial buy: 50% opening fee, falling to the buy fee over 120 s.'));
    pv.replaceChildren(
      h('p', { class: 'purr-pv-label' }, 'Preview'),
      h('div', { class: 'purr-pv-card' },
        st.img ? h('img', { src: st.img, alt: '' }) : h('span', { class: 'purr-pv-blank', 'aria-hidden': 'true' }, '?'),
        h('div', { 'data-no-translate': '' }, h('b', {}, name.value || 'Untitled'), h('span', {}, `$${ticker.value || 'TICKER'} / HYPE · now`)),
        h('div', { class: 'purr-pv-mc' }, h('small', {}, 'Opens at'), h('b', {}, `$${OPEN_USD.toLocaleString('en-US')}`))),
      desc.value.trim() ? h('p', { class: 'purr-pv-desc' }, desc.value.trim()) : '',
      h('dl', { class: 'purr-kv' },
        row('Launch fee', 'Free · gas only'), row('Supply', '1B, all in the pool'), row('Liquidity', 'Locked forever'),
        row('Fee', `${st.buy}% buy · ${st.sell}% sell`), row('Platform target', '1% before keeper deductions and rounding'), row('Your split', split),
        row('Anti-snipe', '50% → buy fee · 120 s'), row('Initial buy (HYPE)', dev.value || '0')));
  }
  for (const el of [name, desc]) el.addEventListener('input', preview);
  ticker.addEventListener('input', () => { ticker.value = ticker.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); preview(); });

  const go = h('button', { class: 'purr-go buy purr-launch-go', type: 'button' }, S.account ? 'Create coin' : 'Connect wallet');
  go.addEventListener('click', () => guarded(go, async () => {
    if (!S.account) { await connect(); return; }
    if (!name.value.trim() || !ticker.value.trim()) throw new Error('Add a name and a ticker.');
    if (!st.digest) throw new Error('Add a coin image.');
    if (!hypeUsd) throw new Error('HYPE price unavailable, so the $2,500 opening market cap cannot be set. Try again in a minute.');
    const mcap = parseUnits(openHype.toFixed(6), 18);
    let devWei;
    if (dev.value && (!validDecimalInput(dev.value) || (dev.value.split('.')[1]?.length || 0) > 18)) throw new Error('Use a decimal point, not commas or grouping separators.');
    try { devWei = parseUnits(dev.value || '0', 18); } catch { throw new Error('First buy is not a number.'); }
    if (devWei < minBuy) throw new Error(`First buy must be at least ${fmt(minBuy)} HYPE.`);
    if (devWei > mcap / 10n) throw new Error(`First buy is capped at 10% of the opening market cap ($${OPEN_USD / 10}).`);
    const caps = S.m.caps || {};
    if (caps.maxDevBuyHype && devWei > parseUnits(String(caps.maxDevBuyHype), 18)) throw new Error(`Mainnet-test cap: first buy ≤ ${caps.maxDevBuyHype} HYPE.`);
    const info = { description: desc.value.trim(), website: web.value.trim(), x: xh.value.trim().replace(/^@/, ''), telegram: tg.value.trim().replace(/^@/, '') };
    const infoBytes = Object.values(info).some(Boolean) ? new TextEncoder().encode(JSON.stringify(info)) : null;
    const infoCid = infoBytes ? await sha(infoBytes) : ZERO32;
    const kept = st.you + st.holders; // creatorBps splits what is left after the burn
    const p = {
      name: name.value.trim(), symbol: ticker.value.trim(), supply: SUPPLY, pair: S.m.whype,
      openingMarketCap: mcap, graduationThreshold: mcap * 100n, feeBps: Math.round(st.buy * 100), sellFeeBps: Math.round(st.sell * 100),
      burnBps: st.burn * 100, vestDuration: 0n, vestCliff: 0n, creatorBps: kept ? Math.round((st.you / kept) * 10000) : 0, maxWalletBps: 0, tickSpacing: 60,
      devBuyPairAmount: devWei, salt: toHex(crypto.getRandomValues(new Uint8Array(32))), minPushPayout: 10n ** 9n, minShareForQueue: SUPPLY / 200n, rewardCurrency: zeroAddress,
      feeRecipient: zeroAddress, referrer: ctx.getReferrer ? (await ctx.getReferrer()) || zeroAddress : ref && isAddress(ref) ? getAddress(ref) : zeroAddress, openingWindow: 120, openingFeeBps: 5000,
      metadata: { imageCid: st.digest, bannerCid: ZERO32, infoCid },
    };
    const data = call(ABI.launcher, 'launch', [p]), imageBytes = st.bytes;
    if (!await reviewTransaction({ h, title: 'Review coin', trigger: go, rows: [
      ['Name', p.name], ['Symbol', p.symbol], ['Network', `Elysium ${S.m.chainId}${S.m.local ? ' · local fork' : ''}`],
      ['Initial buy (HYPE)', formatUnits(devWei, 18)], ['Fees', `${p.feeBps / 100}% buy · ${p.sellFeeBps / 100}% sell`],
      ['Anti-snipe', '50% → buy fee · 120 s'], ['Creator share after platform', `${p.creatorBps / 100}%`], ['Holder share after platform', `${100 - p.creatorBps / 100}%`], ['Burn share', `${p.burnBps / 100}%`],
      ['Platform target', '1% before keeper deductions and rounding'], ['Total', `${formatUnits(devWei, 18)} HYPE + network fees`], ['Recipient', c.launcher],
    ] })) return;
    const wb = await read(S.m.whype, ABI.erc20, 'balanceOf', [S.account]);
    if (wb < devWei) await send('Wrap HYPE for your first buy', { to: S.m.whype, value: devWei - wb, data: call(ABI.whype, 'deposit', []) });
    await approveIfNeeded(S.m.whype, c.launcher, devWei, 'WHYPE');
    const r = await send(`Launch ${p.symbol}`, { to: c.launcher, data });
    const log = r.logs.find((l) => l.address.toLowerCase() === c.launcher.toLowerCase() && l.topics.length === 4);
    const token = log ? getAddress(`0x${log.topics[1].slice(26)}`) : null;
    if (token) {
      const up = (kind, bytes) => fetch('/api/purrlysium/coins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, kind, data: b64(bytes) }) }).then((x) => x.ok).catch(() => false);
        const ok = (await up('image', imageBytes)) && (!infoBytes || (await up('info', infoBytes)));
      if (!ok) toast('Coin is live. The image or links did not upload; open the coin page and try again.', 'bad');
    }
    toast(`${p.symbol} is live.`, 'good');
    if (token) { if (ctx.openCoin) ctx.openCoin({ token, poolId: null }); else { history.replaceState(null, '', `?token=${token}#trade`); S.tab = 'trade'; ctx.render(); } }
  }));

  sync();
  main.replaceChildren(h('section', { class: 'purr-launch-wrap' },
    h('section', { class: 'purr-panel purr-launch' },
      h('header', { class: 'purr-panel-head' }, h('h1', {}, 'Create coin')),
      h('div', { class: 'purr-launch-id' }, file, drop, h('div', { class: 'purr-launch-names' },
        h('label', { class: 'purr-field' }, h('span', {}, 'Name'), name),
        h('label', { class: 'purr-field' }, h('span', {}, 'Symbol'), ticker))),
      h('label', { class: 'purr-field' }, h('span', {}, 'Initial buy (HYPE)'), h('div', { class: 'purr-amount' }, dev, h('em', {}, 'HYPE')), devUsd),
      h('small', {}, minBuy === 0n ? 'Optional — zero is allowed.' : `Minimum ${formatUnits(minBuy, 18)} HYPE`),
      cost, go,
      h('details', { class: 'purr-form-details' }, h('summary', {}, 'Optional details'),
      h('label', { class: 'purr-field' }, h('span', {}, 'Description (optional)'), desc),
      h('div', { class: 'purr-socials' },
        h('label', { class: 'purr-field' }, h('span', {}, 'Website'), web),
        h('label', { class: 'purr-field' }, h('span', {}, 'X'), xh),
        h('label', { class: 'purr-field' }, h('span', {}, 'Telegram'), tg))),
      h('details', { class: 'purr-form-details' }, h('summary', {}, 'Advanced settings'),
      h('div', { class: 'purr-field' }, h('span', {}, 'Fee on every trade'), h('div', { class: 'purr-steppers' }, stepper('Buy', 'buy'), stepper('Sell', 'sell')), h('small', {}, '1.5–10% each way, paid in HYPE.')),
      h('div', { class: 'purr-field' }, h('span', {}, 'Where the fee goes'), bar, legend, presets, sH.el, sB.el),
      h('p', { class: 'purr-muted' }, 'Allocation targets before keeper deductions and rounding; actual payouts can differ.'),
      h('p', { class: 'purr-muted' }, `1B supply, all of it in the coin's own pool, liquidity locked forever. Opens at $${OPEN_USD.toLocaleString('en-US')} market cap. No launch fee.`),
      h('p', {}, 'Initial buy: 50% opening fee, falling to the buy fee over 120 s.')),
      ref ? h('p', { class: 'purr-muted purr-address' }, `Elysium referral candidate: ${ref}. Your existing on-chain binding takes precedence. Binding happens only with your launch transaction.`) : null,
      h('p', { class: 'purr-muted purr-fine' }, 'Unaudited contracts. Only use money you can lose.')),
    pv));
}
