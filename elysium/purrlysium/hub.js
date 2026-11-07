// Purrlysium front screen: the golden doors, Rektd's dialogue and the command bar lead straight into
// the product. Dialogue rules: text types out; a tap or Enter first completes the line, the next one
// advances, so nobody skips a line by accident. Esc closes. Reduced motion shows lines at once.
(() => {
  const ready = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn());
  ready(() => {
    const portal = document.querySelector('.purr-portal');
    if (!portal) return;
    const app = !!document.getElementById('ely-tabs');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (s) => portal.querySelector(s);
    const host = $('.purr-host-btn'), box = $('.purr-dialog'), textEl = $('.purr-dialog-text'), choicesEl = $('.purr-dialog-choices'), nextEl = $('.purr-dialog-next');
    const doorway = $('.purr-doorway'), flash = $('.purr-flash'), hearts = $('.purr-hearts');
    const stats = { coins: null, king: null, kingMc: null, vol: null };
    const once = (k) => { try { if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, '1'); return true; } catch { return true; } };

    // ------------------------------------------------------------ navigation
    function go(where) {
      if (!app) { location.href = '/docs'; return; }
      if (where === 'callouts') { try { sessionStorage.setItem('purr-focus', 'callouts'); } catch {} }
      const hash = where === 'create' ? '#create' : '#markets';
      if (location.hash !== hash) location.hash = hash; else window.dispatchEvent(new HashChangeEvent('hashchange'));
      const tabs = document.getElementById('ely-tabs');
      if (tabs) setTimeout(() => tabs.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }), 80);
    }
    function enter(where) {
      if (still) return go(where);
      doorway.classList.add('entering', where === 'create' ? 'to-r' : 'to-l');
      flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
      setTimeout(() => { go(where); doorway.classList.remove('entering', 'to-l', 'to-r'); }, 520);
    }
    for (const a of portal.querySelectorAll('[data-purr-go]')) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const where = a.dataset.purrGo;
        if (a.classList.contains('purr-door')) enter(where); else go(where);
      });
    }
    const form = $('.purr-ca');
    if (form && !app) form.addEventListener('submit', (e) => { e.preventDefault(); talk('ca-soon'); });

    // ------------------------------------------------------------ live numbers from the Markets board
    window.addEventListener('purr-stats', (e) => Object.assign(stats, e.detail || {}));
    const fmtUsd = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${Math.round(v)}`);

    // ------------------------------------------------------------ the script
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const hasWorld = !!document.querySelector('a.purr-cmd.world');
    const MENU = app
      ? [['Show me the markets', 'go:markets'], ['I want to launch a coin', 'launch'], ['How does this place work?', 'how'], hasWorld ? ['What is the World?', 'world'] : ['Who are you?', 'who']]
      : [['When does it open?', 'soon'], ['How will it work?', 'how'], ['Who are you?', 'who'], ['Read the docs', 'go:docs']];
    const S = {
      hello: () => ({ lines: app
        ? [stats.king ? `Gm, trader. ${stats.coins} coins are live. ${stats.king} is king of the hill at ${fmtUsd(stats.kingMc)}.` : 'Gm, trader. Welcome to Hyperlysium, the paradise planet above Atlantis.', 'Doors open on hover. Left one is the Markets, right one is Launch. Or just ask me.']
        : ['Gm. Welcome to Hyperlysium, the paradise planet above Atlantis.', 'The gates open when Elysium mainnet goes live. Until then, I can tell you how it works.'], choices: MENU }),
      who: () => ({ lines: ['I\'m Rektd. I host this place.', 'The gods up here pour gold all day. Traders catch it. Some catch it twice.', 'Some get rekt. That\'s my name, not my advice.'], choices: [['Fair. What can I do here?', 'how'], ['Back', 'menu']] }),
      how: () => ({ lines: ['Three things. Launch a coin, trade coins, and call them out.', 'Every coin starts at a $2,500 market cap, and its liquidity is locked forever. Nobody can pull it, not even the creator.', 'Each trade pays a fee. 1% goes to the platform. The creator picks where the rest goes: to themselves, to holders, or split.'], choices: [['What are callouts?', 'callouts'], ['Any risks?', 'risk'], ['Take me to the markets', 'go:markets'], ['Back', 'menu']] }),
      launch: () => ({ lines: ['Easy. Name, ticker, image, and who gets the fees.', 'Your coin opens at $2,500 with the liquidity locked. Make a first buy if you like, then share the link.'], choices: [['Open Launch', 'go:create'], ['Back', 'menu']] }),
      callouts: () => ({ lines: ['The wall where holders call their coins.', 'Hold $50 of a coin and you can post about it. I check your bag on chain when you sign. No bag, no voice.'], choices: [['Show me the wall', 'go:callouts'], ['Back', 'menu']] }),
      risk: () => ({ lines: ['Real talk: the contracts are unaudited and the caps are small on purpose.', 'Only bring what you can lose. Holder payouts can count as dividends where you live.'], choices: [['Got it', 'menu']] }),
      soon: () => ({ lines: ['When Elysium mainnet goes live. Then the doors open for real.', 'Follow along on the docs until then.'], choices: [['Read the docs', 'go:docs'], ['Back', 'menu']] }),
      atlantis: () => ({ lines: ['Down there? That\'s Atlantis. The old city under the waterline.', 'Walk it as me. The Lift takes you up to the floating city.'], choices: hasWorld ? [['Take me in', 'go:world'], ['Later', 'menu']] : [['Back', 'menu']] }),
      world: () => ({ lines: ['The World is where Hyperlysium lives. Atlantis below, the floating city above.', 'Walk it as me, pick an outfit, visit Lumi\'s shop. Other traders show up soon.'], choices: [['Take me in', 'go:world'], ['Who are you?', 'who'], ['Back', 'menu']] }),
      'ca-soon': () => ({ lines: ['Coin pages open with Elysium mainnet. Keep that address handy.'], choices: [['OK', 'close']] }),
      menu: () => ({ lines: [pick(['What else?', 'Where to, trader?', 'Anything else?'])], choices: MENU }),
      pet: () => ({ lines: [pick(['Purrrr.', 'Careful, I bite bad trades.', 'Prrt. Okay, one more pet.', 'That tickles. Buy something.'])], choices: [['Back to business', 'menu'], ['Pet again', 'pet']] }),
    };

    // ------------------------------------------------------------ dialogue box
    let lines = [], idx = 0, choices = [], typing = null, full = '';
    function type(str) {
      clearInterval(typing); full = str; nextEl.hidden = true; choicesEl.replaceChildren();
      if (still) { textEl.textContent = str; return done(); }
      let i = 0; textEl.textContent = '';
      typing = setInterval(() => { i += 2; textEl.textContent = str.slice(0, i); if (i >= str.length) { clearInterval(typing); typing = null; done(); } }, 24);
    }
    function done() {
      const last = idx >= lines.length - 1;
      nextEl.hidden = last;
      if (last) drawChoices();
    }
    function drawChoices() {
      choicesEl.replaceChildren(...choices.map(([label, to], k) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = label; b.dataset.k = String(k + 1);
        b.addEventListener('click', (e) => { e.stopPropagation(); choose(to); });
        return b;
      }));
      choicesEl.querySelector('button')?.focus({ preventScroll: true });
    }
    function choose(to) {
      if (to === 'close') return close();
      if (to.startsWith('go:')) { const w = to.slice(3); close(); if (w === 'docs') location.href = '/docs'; else if (w === 'world') location.href = '/world/'; else enter(w); return; }
      talk(to);
    }
    function talk(node) {
      const solana = document.documentElement.dataset.activeChain === 'solana';
      const solanaLines = { hello: 'Welcome to Hyperlysium on Solana. Your Elysium wallet stays separate.', how: 'Browse Solana markets, review a swap, or create a Pump coin. Each action uses its own wallet review. Check operator readiness in the form.', launch: 'Choose a name, ticker, artwork and quote asset. Pump quote support and creator fees are verified before your wallet signs.', callouts: 'Holder callouts belong to the Elysium pad. Switch to Elysium to use them.' };
      const n = solana && solanaLines[node] ? { lines: [solanaLines[node]], choices: MENU } : S[node]();
      lines = n.lines; idx = 0; choices = n.choices || [['OK', 'close']];
      box.hidden = false; host.classList.add('talking'); host.setAttribute('aria-expanded', 'true');
      type(lines[0]);
    }
    function advance() {
      if (typing) { clearInterval(typing); typing = null; textEl.textContent = full; return done(); }
      if (idx < lines.length - 1) { idx += 1; type(lines[idx]); }
    }
    function close() { clearInterval(typing); typing = null; box.hidden = true; host.classList.remove('talking'); host.setAttribute('aria-expanded', 'false'); }
    window.addEventListener('purr-chain-change', close);
    box.addEventListener('click', (e) => { if (!e.target.closest('button')) advance(); });
    $('.purr-dialog-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') { close(); host.focus(); }
      else if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button, input, textarea, select, a')) { e.preventDefault(); advance(); }
      else if (/^[1-4]$/.test(e.key) && !e.target.closest('input, textarea') && !choicesEl.hidden) { choicesEl.querySelector(`[data-k="${e.key}"]`)?.click(); }
    });

    // ------------------------------------------------------------ Rektd
    let pets = 0, petTimer;
    host.addEventListener('click', () => {
      host.classList.remove('hop'); void host.offsetWidth; host.classList.add('hop');
      pets += 1; clearTimeout(petTimer); petTimer = setTimeout(() => { pets = 0; }, 900);
      if (pets >= 3) { pets = 0; hearts.classList.remove('on'); void hearts.offsetWidth; hearts.classList.add('on'); return talk('pet'); }
      if (box.hidden) talk(once('purr-met') ? 'hello' : 'menu');
    });
    portal.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      host.classList.toggle('face-left', e.clientX < r.left + r.width / 2 - 8);
      const d = doorway.getBoundingClientRect();
      doorway.classList.toggle('near', Math.hypot(e.clientX - (d.left + d.width / 2), e.clientY - (d.top + d.height / 2)) < Math.max(d.width, d.height) * 1.5);
    });
    portal.addEventListener('pointerleave', () => doorway.classList.remove('near'));

    // Hovering a door makes Rektd look and comment (only when he is not mid-conversation).
    const peek = $('.purr-peek') || Object.assign(document.createElement('p'), { className: 'purr-peek', hidden: true });
    if (!peek.isConnected) portal.append(peek);
    let peekT;
    const say = (str) => { if (!box.hidden) return; clearTimeout(peekT); peek.textContent = str; peek.hidden = false; peekT = setTimeout(() => { peek.hidden = true; }, 2600); };
    for (const d of portal.querySelectorAll('.purr-door')) {
      d.addEventListener('pointerenter', () => {
        host.classList.toggle('face-left', d.classList.contains('l'));
        if (!app) return say('Opens with Elysium mainnet.');
        say(d.classList.contains('l') ? (stats.coins ? `Markets. ${stats.coins} coins trading.` : 'Markets. Every coin, live.') : 'Launch. $2,500 start, locked forever.');
      });
    }
    $('.purr-scene')?.parentElement?.addEventListener('dblclick', (e) => { if (e.target === portal || e.target.classList?.contains('purr-scene')) talk('atlantis'); });

    // First visit this session: Rektd greets once the arrival gate has opened.
    if (once('purr-greet')) setTimeout(() => { if (box.hidden) talk('hello'); try { sessionStorage.setItem('purr-met', '1'); } catch {} }, still ? 300 : 1400);
  });
})();
