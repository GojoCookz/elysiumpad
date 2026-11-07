// View epochs are distinct from wallet connections: switching never connects or signs.
export function createWalletContext(onChange = () => {}) {
  let active = 'elysium', epoch = 0;
  const sessions = { elysium: null, solana: null }, intents = { elysium: 0, solana: 0 };
  const changed = () => { epoch++; onChange(); };
  return {
    get active() { return active; },
    get sessions() { return sessions; },
    capture() { return { active, epoch, account: sessions[active]?.account || null }; },
    current(token) { return token.active === active && token.epoch === epoch && token.account === (sessions[active]?.account || null); },
    assert(token) { if (!this.current(token)) throw new Error('Chain or wallet changed. Review again; nothing further was submitted.'); },
    switch(chain) { if (!(chain in sessions)) throw new Error('Unknown chain.'); if (active !== chain) { intents[active]++; active = chain; changed(); } },
    begin(chain) { return ++intents[chain]; },
    accepts(chain, intent) { return intent === intents[chain] && active === chain; },
    accept(chain, intent, session) { if (intent !== intents[chain] || active !== chain) return false; sessions[chain] = session; changed(); return true; },
    update(chain, session) { sessions[chain] = session; changed(); },
    disconnect(chain) { intents[chain]++; const old = sessions[chain]; sessions[chain] = null; old?.off?.(); changed(); return old; },
  };
}
