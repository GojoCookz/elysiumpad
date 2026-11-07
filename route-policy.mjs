const EVM = /^0x[0-9a-fA-F]{40}$/;
const SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const validChainAddress = (chain, address) => (chain === 'elysium' ? EVM : SOL).test(address || '');
export const SECTIONS = { elysium: ['markets', 'trade', 'create', 'portfolio', 'docs', 'referrals', 'funding', 'lp', 'bridge', 'developers'], solana: ['markets', 'trade', 'create', 'portfolio', 'docs', 'referrals', 'funding'] };
export function resolveRoute(input, remembered = 'solana') {
  const url = new URL(input, 'https://purrlysium.fun');
  const parts = url.pathname.split('/').filter(Boolean), explicit = parts.find(p => p === 'elysium' || p === 'solana');
  const token = url.searchParams.get('token');
  // Legacy 0x token/ref links were Elysium links before the dual-chain UI existed.
  const chain = explicit || url.searchParams.get('chain') || (token && EVM.test(token) || url.searchParams.has('ref') && !url.searchParams.has('refChain') ? 'elysium' : remembered);
  if (!SECTIONS[chain]) throw new Error('Unknown chain in this link. Choose Solana or Elysium.');
  const hash = url.hash.slice(1).split('/')[0];
  const requested = parts.includes('docs') ? 'docs' : parts.includes('referrals') ? 'referrals' : hash === 'pools' ? 'lp' : hash || (token ? 'trade' : 'markets');
  const section = SECTIONS[chain].includes(requested) ? requested : 'markets';
  if (token && (!url.searchParams.has('chain') && !EVM.test(token) || !validChainAddress(chain, token))) throw new Error('Token link has a missing chain or an address from the wrong chain.');
  return { chain, section, token, fallback: section !== requested ? `${requested} is unavailable on ${chain === 'solana' ? 'Solana' : 'Elysium'}. Showing Markets.` : '' };
}
export function routeURL(input, { chain, section, token, skin, market }) {
  const url = new URL(input, 'https://purrlysium.fun');
  url.pathname = skin ? '/hypurrheaven/' : '/';
  if (['docs', 'referrals'].includes(section)) url.pathname += `${section}/${chain}`;
  url.searchParams.set('chain', chain);
  url.searchParams.delete('token');
  if (market === 'all') url.searchParams.set('market', 'all'); else url.searchParams.delete('market');
  if (token) { if (!validChainAddress(chain, token)) throw new Error('Wrong-chain token address.'); url.searchParams.set('token', token); }
  url.hash = ['docs', 'referrals'].includes(section) ? '' : section;
  return `${url.pathname}${url.search}${url.hash}`;
}
export function captureReferral(input, storage, network) {
  const url = new URL(input, 'https://purrlysium.fun'), ref = url.searchParams.get('ref');
  const chain = url.searchParams.get('refChain') || (url.searchParams.get('chain') === 'solana' ? 'solana' : 'elysium');
  const key = `purrlysium.elysium.${network}.referral-candidate`;
  if (ref) {
    if (chain !== 'elysium' || !EVM.test(ref) || /^0x0{40}$/i.test(ref)) return { address: null, error: 'Referral link is unsupported or belongs to the wrong chain. No binding was requested.' };
    storage.setItem(key, ref); return { address: ref, error: '' };
  }
  const stored = storage.getItem(key);
  return { address: EVM.test(stored || '') ? stored : null, error: '' };
}
export function effectiveReferrer({ account, bound, candidate }) {
  // Existing immutable binding always wins, even over a newly supplied referral link.
  if (bound && !/^0x0{40}$/i.test(bound)) return bound;
  if (!EVM.test(candidate || '') || candidate.toLowerCase() === account?.toLowerCase()) return null;
  return candidate;
}
