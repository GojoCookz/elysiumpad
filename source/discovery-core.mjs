export const rank = row => row.provenance?.kind === 'platform' && row.provenance?.verified === true ? 0 : row.provenance?.kind === 'ecosystem' && row.provenance?.verified === true ? 1 : 2;
export const identity = row => `${row.chain}:${row.chain === 'elysium' ? row.address.toLowerCase() : row.address}`;
export function mergeMarkets(...groups) {
  const rows = new Map();
  for (const row of groups.flat()) {
    if (!row?.address || !['solana', 'elysium'].includes(row.chain)) continue;
    const key = identity(row), old = rows.get(key);
    if (!old) rows.set(key, row);
    else {
      const preferred = rank(row) < rank(old) ? row : old;
      rows.set(key, { ...old, ...Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined && v !== '')), provenance: preferred.provenance });
    }
  }
  return [...rows.values()].sort((a, b) => rank(a) - rank(b) || (b.volume ?? -1) - (a.volume ?? -1) || a.address.localeCompare(b.address));
}
export function sourceFailure(previous, error, now = new Date().toISOString()) {
  return { ...previous, status: previous?.checkedAt ? 'stale' : 'unavailable', complete: false, error: String(error).slice(0, 180), attemptedAt: now };
}
export function platformProof(log, launcher, topic, from, to) {
  return !log.removed && log.address?.toLowerCase() === launcher.toLowerCase() && log.topics?.[0] === topic && /^0x[0-9a-f]{64}$/i.test(log.transactionHash || '') && Number(BigInt(log.blockNumber)) >= from && Number(BigInt(log.blockNumber)) <= to;
}
export function sourceNote(sources) {
  return Object.entries(sources).map(([name, s]) => `${name}: ${s.status}${s.count === null || s.count === undefined ? '' : ` (${s.count})`}${s.error ? ` — ${s.error}` : ''}`).join(' · ');
}
