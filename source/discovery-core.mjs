export const rank = row => row.provenance?.kind === 'platform' && row.provenance?.verified === true ? 0 : row.provenance?.kind === 'ecosystem' && row.provenance?.verified === true ? 1 : 2;
export const identity = row => `${row.chain}:${row.chain === 'elysium' ? row.address.toLowerCase() : row.address}`;
export function mergeMarkets(...groups) {
  const rows = new Map();
  for (const row of groups.flat()) {
    if (!row?.address || !['solana', 'elysium'].includes(row.chain)) continue;
    const key = identity(row), old = rows.get(key);
    if (!old) rows.set(key, row);
    else {
      const preferred = rank(row) <= rank(old) ? row : old;
      const other = preferred === row ? old : row;
      const poolA = preferred.poolId || preferred.original?.pairAddress;
      const poolB = other.poolId || other.original?.pairAddress;
      const conflict = poolA && poolB && (preferred.chain==='elysium' ? poolA.toLowerCase() !== poolB.toLowerCase() || (preferred.manager||'').toLowerCase()!==(other.manager||'').toLowerCase() : poolA !== poolB);
      const merged = conflict ? { ...preferred } : { ...other, ...preferred };
      // Never move a platform badge onto another venue's pool/key. Enrich only
      // compatible market observations; launch evidence and routing stay together.
      if (!conflict) for (const field of ['price','volume','cap','change','image']) if (row[field] !== null && row[field] !== undefined) merged[field] = row[field];
      rows.set(key, merged);
    }
  }
  return [...rows.values()].sort((a, b) => rank(a) - rank(b) || (a.chain==='elysium'&&b.chain==='elysium' ? Number(b.price>0)-Number(a.price>0)||(b.activeDepth||0)-(a.activeDepth||0) : 0) || (b.volume ?? -1) - (a.volume ?? -1) || a.address.localeCompare(b.address));
}
export function retainPartialRows(previous, incoming, warnings = [], limit = 100) {
  const failed = warnings.some(w => /(?:source|Name search).*is unavailable/i.test(w));
  if (!failed) return { rows: incoming, retained: 0, sourceFailed: false };
  const present = new Set(incoming.map(identity));
  const stale = previous.filter(row => !present.has(identity(row))).slice(0, Math.max(0, limit - incoming.length)).map(row => ({ ...row, stale: true }));
  return { rows: mergeMarkets(incoming, stale), retained: stale.length, sourceFailed: true };
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
