// Public accounting snapshot, not a wallet balance or an automatic chain verifier.
const CATEGORIES = ['platform-income', 'own-creator-income', 'other-creator-funds', 'referrer-funds', 'user-funds', 'development', 'kntq-buyback'];
const ELIGIBLE = new Set(['platform-income', 'own-creator-income']);
const SPENDING = new Set(['development', 'kntq-buyback']);
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const fail = message => { throw new Error(`Invalid funding ledger: ${message}`); };
function object(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail(`${name} fields`);
}
function text(value, pattern, name) { if (typeof value !== 'string' || !pattern.test(value)) fail(name); }
function timestamp(value) { text(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'UTC timestamp'); if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value || Date.parse(value) > Date.now()) fail('timestamp'); }
function evidence(value) { let url; try { url = new URL(value); } catch { fail('evidence URL'); } if (typeof value !== 'string' || value.length > 600 || url.protocol !== 'https:' || url.username || url.password) fail('HTTPS evidence URL'); }
function atomic(value, zero = true) { text(value, /^(0|[1-9]\d{0,77})$/, 'atomic amount string'); if (!zero && value === '0') fail('positive receipt amount'); }
function base58(value, bytes) {
  if (typeof value !== 'string' || value.length > 90 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) return false;
  let n = 0n; for (const ch of value) n = n * 58n + BigInt(BASE58.indexOf(ch));
  let length = 0; while (n) { length++; n >>= 8n; }
  return length + (value.match(/^1*/)[0].length) === bytes;
}
export const fundingAssetKey = row => `${row.chain}:${row.network}:${row.chain === 'elysium' ? row.asset.toLowerCase() : row.asset}`;
function asset(row, assets) {
  if (typeof row.asset !== 'string') fail('asset identity');
  if (!['solana', 'elysium'].includes(row.chain) || !(row.chain === 'solana' ? ['mainnet-beta'] : ['99801', '99901']).includes(row.network)) fail('chain/network');
  text(row.symbol, /^[A-Z][A-Z0-9._-]{0,15}$/, 'asset symbol');
  if (!Number.isInteger(row.decimals) || row.decimals < 0 || row.decimals > 18) fail('decimals');
  if (row.asset === 'native') { if (row.symbol !== (row.chain === 'solana' ? 'SOL' : 'HYPE') || row.decimals !== (row.chain === 'solana' ? 9 : 18)) fail('native asset identity'); }
  else if (row.chain === 'solana' ? !base58(row.asset, 32) : !/^0x[0-9a-fA-F]{40}$/.test(row.asset)) fail('asset mint/address');
  const key = fundingAssetKey(row), identity = `${row.symbol}:${row.decimals}`;
  if (assets.has(key) && assets.get(key) !== identity) fail('inconsistent asset decimals/symbol');
  assets.set(key, identity);
}
const ASSET_FIELDS = ['chain', 'network', 'asset', 'symbol', 'decimals'];
const counted = row => row.verification === 'verified' && (SPENDING.has(row.category) || row.chain === 'solana' && ELIGIBLE.has(row.category));
export function validateFundingLedger(input) {
  object(input, ['version', 'updatedAt', 'records', 'allocations', 'reconciliations'], 'snapshot');
  if (input.version !== 1) fail('version');
  for (const key of ['records', 'allocations', 'reconciliations']) if (!Array.isArray(input[key]) || input[key].length > 1000) fail(key);
  if (input.updatedAt !== null) timestamp(input.updatedAt);
  if (input.updatedAt === null && (input.records.length || input.allocations.length || input.reconciliations.length)) fail('missing update timestamp');
  const ids = new Set(), transactions = new Set(), assets = new Map(), reconciliationKeys = new Set();
  const id = row => { text(row.id, /^[a-zA-Z0-9_-]{1,64}$/, 'record id'); if (ids.has(row.id)) fail('duplicate id'); ids.add(row.id); };
  for (const row of input.records) {
    object(row, ['id', ...ASSET_FIELDS, 'amountAtomic', 'transaction', 'category', 'timestamp', 'verification', 'evidence'], 'receipt');
    id(row); asset(row, assets); atomic(row.amountAtomic, false); timestamp(row.timestamp);
    if (row.timestamp > input.updatedAt) fail('receipt newer than snapshot');
    if (!CATEGORIES.includes(row.category) || !['unverified', 'verified', 'rejected'].includes(row.verification)) fail('category/verification');
    if (row.verification === 'verified' || row.evidence !== null) evidence(row.evidence);
    if (row.chain === 'solana' ? !base58(row.transaction, 64) : !/^0x[0-9a-fA-F]{64}$/.test(row.transaction)) fail('transaction reference');
    const tx = `${row.chain}:${row.network}:${row.chain === 'elysium' ? row.transaction.toLowerCase() : row.transaction}`;
    if (transactions.has(tx)) fail('duplicate transaction'); transactions.add(tx);
  }
  for (const row of input.allocations) {
    object(row, ['id', ...ASSET_FIELDS, 'amountAtomic', 'purpose', 'status', 'timestamp', 'evidence'], 'allocation');
    id(row); asset(row, assets); atomic(row.amountAtomic, false); timestamp(row.timestamp);
    if (row.timestamp > input.updatedAt || !['development', 'kntq-buyback'].includes(row.purpose) || !['proposed', 'approved'].includes(row.status)) fail('allocation status/purpose/date');
    if (row.status === 'approved' || row.evidence !== null) evidence(row.evidence);
  }
  for (const row of input.reconciliations) {
    object(row, [...ASSET_FIELDS, 'balanceAtomic', 'asOf', 'recordIds', 'evidence'], 'reconciliation');
    asset(row, assets); atomic(row.balanceAtomic); timestamp(row.asOf); evidence(row.evidence);
    if (row.asOf > input.updatedAt) fail('reconciliation newer than snapshot');
    const key = fundingAssetKey(row); if (reconciliationKeys.has(key)) fail('duplicate asset reconciliation'); reconciliationKeys.add(key);
    if (!Array.isArray(row.recordIds) || !row.recordIds.length || new Set(row.recordIds).size !== row.recordIds.length) fail('reconciliation coverage');
    const applicable = input.records.filter(r => r.verification !== 'rejected' && fundingAssetKey(r) === key && r.timestamp <= row.asOf && (SPENDING.has(r.category) || r.chain === 'solana' && ELIGIBLE.has(r.category)));
    if (applicable.some(r => !counted(r)) || applicable.length !== row.recordIds.length || applicable.some(r => !row.recordIds.includes(r.id))) fail('unverified or incomplete reconciliation');
    const balance = applicable.reduce((total, r) => total + (SPENDING.has(r.category) ? -1n : 1n) * BigInt(r.amountAtomic), 0n);
    if (balance !== BigInt(row.balanceAtomic)) fail('reconciled balance mismatch');
  }
  return input;
}
export function fundingSummary(input) {
  validateFundingLedger(input);
  const groups = new Map();
  for (const row of input.records) {
    const key = fundingAssetKey(row);
    if (!groups.has(key)) groups.set(key, { chain: row.chain, network: row.network, asset: row.asset, symbol: row.symbol, decimals: row.decimals, income: null, spending: null, buybacks: null, balance: null, asOf: null });
    if (!counted(row)) continue;
    const group = groups.get(key), type = row.category === 'development' ? 'spending' : row.category === 'kntq-buyback' ? 'buybacks' : 'income';
    group[type] = ((group[type] === null ? 0n : BigInt(group[type])) + BigInt(row.amountAtomic)).toString();
  }
  for (const row of input.reconciliations) {
    const group = groups.get(fundingAssetKey(row));
    if (group) { group.balance = row.balanceAtomic; group.asOf = row.asOf; }
  }
  return [...groups.values()];
}
export function fundingAmount(amount, decimals) {
  if (amount === null) return null;
  text(amount, /^(0|[1-9]\d*)$/, 'display amount'); if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) fail('decimals');
  if (!decimals) return amount;
  const padded = amount.padStart(decimals + 1, '0');
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`.replace(/\.?0+$/, '');
}
