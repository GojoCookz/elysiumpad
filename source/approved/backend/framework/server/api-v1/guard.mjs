/* The build guard. Every unsigned transaction the public API returns passes
 * guardTransaction (static checks on the compiled message) and then simulate
 * (the network's own answer). A build that fails either is refused, never
 * returned "with a warning".
 *
 * Static checks:
 *   - v0 message, no address lookup tables (we never need them, so any is foreign)
 *   - fee payer is the requesting wallet; required signers are exactly the expected list
 *   - every top-level program is on the allowlist for this build kind
 *   - compute budget: at most one unit limit and one unit price, both under caps
 *   - System program: only exact, pre-declared transfers from the payer
 *   - Associated Token program: only create-idempotent for pre-declared accounts
 *   - every writable account is on the allowlist for this build (when one is given)
 *   - serialized size fits one packet */
import { PublicKey, SystemProgram, ComputeBudgetProgram, VersionedTransaction } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { simulationReason, lamportsText } from '../../third_party/sapling/costcap.js';
import { ApiError } from './errors.mjs';

export const COMPUTE_CAPS = { maxUnitLimit: 600_000, maxMicroLamportsPerUnit: 200_000 };
/** Jupiter sets its own compute budget; these caps bound what it may ask for. */
export const TRADE_COMPUTE_CAPS = { maxUnitLimit: 1_400_000, maxMicroLamportsPerUnit: 10_000_000, maxPriorityLamports: 1_000_000 };
const CB = ComputeBudgetProgram.programId.toBase58();
const SYSTEM = SystemProgram.programId.toBase58();
const ATA = ASSOCIATED_TOKEN_PROGRAM_ID.toBase58();
const PACKET = 1232;

const refuse = (why) => new ApiError('refused', `Build refused by the safety check: ${why}. Nothing was returned to sign.`);

/**
 * @param {VersionedTransaction} tx
 * @param {object} rules
 * @param {string} rules.payer
 * @param {string[]} rules.signers  exact required signers, in order (payer first)
 * @param {Set<string>} rules.programs
 * @param {Set<string>|null} rules.writable  null = skip (only for builds whose program re-checks destinations)
 * @param {{to: string, lamports: bigint}[]} [rules.transfers]
 * @param {{owner: string, mint: string, tokenProgram: string}[]} [rules.ataCreates]
 * @param {typeof COMPUTE_CAPS} [rules.caps]
 */
export function guardTransaction(tx, { payer, signers, programs, writable, transfers = [], ataCreates = [], caps = COMPUTE_CAPS }) {
  if (!(tx instanceof VersionedTransaction) || tx.version !== 0) throw refuse('not a v0 transaction');
  const m = tx.message;
  if (m.addressTableLookups.length) throw refuse('address lookup tables are not allowed');
  const keys = m.staticAccountKeys.map((k) => k.toBase58());
  if (keys[0] !== payer) throw refuse('fee payer is not the requesting wallet');
  const required = keys.slice(0, m.header.numRequiredSignatures);
  if (required.length !== signers.length || required.some((k, i) => k !== signers[i])) throw refuse('unexpected signers');

  const { unitLimit, microLamportsPerUnit: unitPrice } = checkComputeBudget(tx, caps);
  const transfersLeft = [...transfers];
  const ataLeft = ataCreates.map((a) => ({ ...a, ata: getAssociatedTokenAddressSync(new PublicKey(a.mint), new PublicKey(a.owner), true, new PublicKey(a.tokenProgram)).toBase58() }));
  for (const ix of m.compiledInstructions) {
    const program = keys[ix.programIdIndex];
    if (!programs.has(program)) throw refuse(`program ${program} is not allowed here`);
    const data = Buffer.from(ix.data);
    const acct = (i) => keys[ix.accountKeyIndexes[i]];
    if (program === CB) {
      continue; // checked by checkComputeBudget above
    } else if (program === SYSTEM) {
      if (data.length !== 12 || data.readUInt32LE(0) !== 2) throw refuse('only plain SOL transfers are allowed');
      const lamports = data.readBigUInt64LE(4);
      const i = transfersLeft.findIndex((t) => acct(0) === payer && acct(1) === t.to && t.lamports === lamports);
      if (i < 0) throw refuse('SOL transfer to an undeclared account or amount');
      transfersLeft.splice(i, 1);
    } else if (program === ATA) {
      if (data.length !== 1 || data[0] !== 1) throw refuse('only idempotent token-account creation is allowed');
      const i = ataLeft.findIndex((a) => acct(0) === payer && acct(1) === a.ata && acct(2) === a.owner && acct(3) === a.mint && acct(5) === a.tokenProgram);
      if (i < 0) throw refuse('token-account creation for an undeclared account');
      ataLeft.splice(i, 1);
    }
  }
  if (transfersLeft.length) throw refuse('a declared transfer is missing');

  if (writable) {
    for (let i = 0; i < keys.length; i++) {
      if (m.isAccountWritable(i) && i !== 0 && !writable.has(keys[i])) throw refuse(`account ${keys[i]} must not be writable`);
    }
  }
  const size = tx.serialize().length;
  if (size > PACKET) throw refuse('transaction is too large');
  return { size, unitLimit, microLamportsPerUnit: unitPrice };
}

/**
 * Compute budget: exactly one unit limit and one unit price, nothing else from the
 * Compute Budget program, all under the caps. Works on transactions that use lookup
 * tables too, because a program id is always a static account key.
 * caps.maxPriorityLamports (optional) also caps limit x price, the most the
 * priority fee can cost.
 */
export function checkComputeBudget(tx, caps = COMPUTE_CAPS) {
  const m = tx.message;
  let unitLimit = null, unitPrice = null;
  for (const ix of m.compiledInstructions) {
    if (!m.staticAccountKeys[ix.programIdIndex]?.equals(ComputeBudgetProgram.programId)) continue;
    const data = Buffer.from(ix.data);
    if (data[0] === 2 && data.length === 5) {
      if (unitLimit !== null) throw refuse('duplicate compute unit limit');
      unitLimit = data.readUInt32LE(1);
      if (unitLimit > caps.maxUnitLimit) throw refuse('compute unit limit above the cap');
    } else if (data[0] === 3 && data.length === 9) {
      if (unitPrice !== null) throw refuse('duplicate compute unit price');
      unitPrice = data.readBigUInt64LE(1);
      if (unitPrice > BigInt(caps.maxMicroLamportsPerUnit)) throw refuse('priority fee above the cap');
    } else throw refuse('unsupported compute budget instruction');
  }
  if (unitLimit === null || unitPrice === null) throw refuse('compute budget must be explicit');
  const priorityLamports = (BigInt(unitLimit) * unitPrice + 999_999n) / 1_000_000n;
  if (caps.maxPriorityLamports != null && priorityLamports > BigInt(caps.maxPriorityLamports)) throw refuse('priority fee above the cap');
  return { unitLimit, microLamportsPerUnit: unitPrice, priorityLamports };
}

/**
 * Simulate against the current chain and return the watched accounts before and
 * after. Refuses on any simulation error, or if the network did not return every
 * watched account (a missing result is treated as failure, never as "fine").
 */
export async function simulate(conn, tx, watch) {
  const keys = watch.map((k) => new PublicKey(k));
  let before, sim;
  try {
    before = await conn.getMultipleAccountsInfo(keys, 'confirmed');
    sim = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed', accounts: { encoding: 'base64', addresses: watch } });
  } catch {
    throw new ApiError('upstream', 'Solana RPC could not simulate the transaction.');
  }
  const v = sim?.value;
  if (!v) throw new ApiError('upstream', 'Solana RPC returned no simulation result.');
  if (v.err) throw new ApiError('refused', simulationReason(v.err, v.logs ?? []));
  if (!Array.isArray(v.accounts) || v.accounts.length !== watch.length) throw refuse('simulation did not return every watched account');
  const after = v.accounts.map((a) => (a ? { lamports: BigInt(a.lamports), owner: String(a.owner), data: Buffer.from(a.data[0], 'base64') } : null));
  return { before, after, unitsConsumed: v.unitsConsumed ?? null, logs: v.logs ?? [] };
}

/** Refuse if the payer's SOL cost (fee + rent + priority) is above the cap. */
export function checkSolCost(beforeInfo, afterAccount, cap) {
  if (!beforeInfo || !afterAccount) throw refuse('simulation did not return the wallet balance');
  const cost = BigInt(beforeInfo.lamports) - afterAccount.lamports;
  if (cost > cap) throw refuse(`simulated SOL cost ${lamportsText(cost)} is above the limit ${lamportsText(cap)}`);
  return cost;
}
