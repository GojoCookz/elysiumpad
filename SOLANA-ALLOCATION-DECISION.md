# Solana revenue allocation: verified boundary and required decision

## Outcome

**Creator-signed transfers are supported. Exact per-token creator-revenue allocation is not available from the current shared-recipient claim balance alone.** The requested controls and claim/distribute workflow are not implemented or deployed by this investigation. This is a concrete accounting/signing decision, not a claim that SPL payouts are impossible.

The current direct-Pump launch can name an ordinary fee-recipient wallet. It does not install Monerochan's per-mint vault, and its ordinary Pump fee claims have no launch-mint parameter. Applying a selected token's holder percentage to that wallet's complete claim can pay holders of one token with revenue earned by another. Implementing that silently would change the meaning of the requested allocation.

**Decision requested:** may the manual holder/split workflow distribute a creator-selected amount from the recipient wallet's quote balance, explicitly labeled a **wallet-funded payout budget, not verified revenue of this token**? If yes, that supports a contract-free creator-signed implementation. If the promise must instead be a percentage of each token's own revenue, select revenue isolation/accounting before enabling the controls.

No fee-policy change, funded transaction, contract deployment, or admin action is proposed as implicitly authorized.

## Original versus current implementation

| Area | Monerochan reference | Current Hypeliysium direct Pump |
| --- | --- | --- |
| Pump creator | Per-mint `coin-authority` PDA | Selected ordinary creator-fee recipient |
| Isolation | PDA seeds include mint | Ordinary vault seeds include creator, not mint |
| Revenue split | Custom vault separates deployer, liquidity, buyback, platform buckets | Existing 300-bps creator-fee policy; no custom pad vault |
| Holder choice | `holders-signed`, 25/50/100% of deployer's share; public commitment, not automatic enforcement | Only self/custom recipient controls currently implemented |
| Holder payout | Unsigned SPL transfer batches; creator signs | Not implemented |
| End-to-end wiring | Helper and tests found; no browser/API invocation of `prepareHolderPayouts` found in targeted reference search | No holder claim/distribute route |
| Graduated revenue | Keeper planner includes AMM handling; inspected public claim API still refuses AMM-only balances | Installed SDK can collect ordinary creator fees from Pump and PumpSwap, but pooled by creator/quote |

Evidence in the read-only reference checkout:

- `monerochan-launchpad/shared/vault.js:12–14`: `coinAuthority(programId, mint)` derives `['coin-authority', mint]`.
- `server/api-v1/builds.mjs:339–364`: that PDA is passed as Pump `creator`, followed by custom `registerCoinIx`.
- `server/api-v1/builds.mjs:94–105`: per-coin claim resolves the mint PDA and requires the curve's creator to equal it; the inspected route permits wXMR quotes only.
- `server/api-v1/builds.mjs:125–132`: public claim refuses AMM-only balances; do not equate keeper helper capability with complete public wiring.
- `server/keeper.mjs:111–160`: per-coin fee-run planning and custom-vault split.
- `shared/builder.js:185–239`: allocation plan and pro-rata holder arithmetic.
- `server/keeper.mjs:197–211`: quote ATA creation and `transferChecked`, creator authority and signer, no signing or broadcast by the helper.

Current source: `source/approved/backend/creator-wallet.mjs:11–13` accepts self/custom recipient only; `pump-creator.mjs` independently reconstructs the launch with `holderReward:false` and `creatorFeeBps:300`. These are creator trading fees on supported quotes, not a tax on ordinary token transfers. This investigation does not alter them.

## Measured protocol evidence

`node tools/check-solana-allocation.mjs <external-output.json>` ran successfully. It constructs unsigned instructions and asserts four boundaries:

1. Two different mint fixtures with the same creator resolve to the same Pump creator vault and the same PumpSwap creator vault. Their native holder-reward PDAs, in contrast, differ by mint.
2. The installed SDK's ordinary quote-claim instruction references the creator vault and neither launch mint.
3. A native holder payout instruction requires the supplied claim-authority signer. The installed IDL binds that account to `Global.holderRewardClaimAuthority`, not to the ordinary creator.
4. Two histories, `A=10/B=90` and `A=80/B=20`, both yield aggregate balance 100, but A's correct 50% holder allocation would be 5 or 40. The balance alone cannot distinguish them. This is an arithmetic counterexample, not a measured trading history.

Installed SDK evidence:

- `node_modules/@pump-fun/pump-sdk/dist/index.js:30719–30723`: creator-vault and holder-rewards PDA derivations.
- `index.js:27425–27463`: `collectCoinCreatorFeeV2Instructions(coinCreator, quoteMint, quoteTokenProgram, feePayer)` collects curve and optional AMM legs without a launch mint.
- `index.d.ts:40977–41034`: collection/balance APIs, quote ATA creation requirements, delisted-quote handling and fee-payer semantics.
- `index.d.ts:5341–5384`: `distributeFeeToHolders` requires the global holder-reward claim authority as a signer.
- `index.d.ts:3879–3897`: ordinary curve collection pays the creator; creator is writable but is not a required signer in that instruction. Collection does not authorize a caller to spend the recipient's funds afterward.

Live public RPC read captured at **2026-11-07T16:41:06.007Z**:

```text
genesis: 5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d (Solana mainnet)
holderRewardEnabled: true
holderRewardClaimAuthority: HckQ93Xqjjo8mwt5pNPWvyCTZXQZ858rvzmm7ZRrZg9t
maxConfigurableCreatorFeeBps: 300
```

Captured artifact: `C:/Users/shies/AppData/Local/Temp/opencode/solana-allocation-boundaries.json`. The enabled flag does **not** make payout authority permissionless. We have no authorization or signing capability for the configured global authority. Switching new coins to native holder-reward mode would not provide arbitrary creators with a working payout button.

## Original helper execution

The original `prepareHolderPayouts` was imported read-only and run without constructing or signing a transaction. Test input: 1,001 quote units, holder A balances 3 and 1, holder B balance 2, creator balance 100; one recipient per batch.

All assertions passed:

- Duplicate owner entries merged to A=4.
- Creator excluded.
- Payouts A=667, B=333; dust=1.
- Two batches, each containing an idempotent ATA instruction and a checked token transfer.
- Both transfers require the creator as the source owner/signing authority.

Captured at `2026-11-07T16:41:21.460Z` in `C:/Users/shies/AppData/Local/Temp/opencode/monerochan-payout-helper-evidence.json`. This proves unsigned helper behavior; it does not prove chain execution, complete snapshots, or browser/API integration.

## Supported choices and consequences

### A. Explicit wallet-funded payout budget — no new contract

The creator/fee recipient claims its available fees, selects a token's eligible-holder snapshot, enters a quote-token budget, and signs a distribution of that budget. Creator-only/holders/split percentages apply to the **selected budget**. Fees may have come from multiple coins or existing wallet funds. The UI and metadata must say this explicitly; no per-token earnings or automatic payout promise.

The fee-recipient wallet must sign payouts, even if another wallet deployed the token. Claiming and distributing are separate confirmed actions. A balance increase alone does not prove a particular token earned that money. Dust stays with the funding wallet, and ATA rent/network fees are separately disclosed.

This is feasible under current contracts, but is a narrower product promise than per-token revenue allocation. Approval of this basis is the requested decision; no on-chain authorization is needed merely to implement it.

### B. Token-specific revenue commitment

Use a dedicated fee-recipient wallet per coin, or build a complete per-token accrual/claim accounting ledger. A dedicated wallet only isolates revenue while it remains exclusive; the app cannot enforce that it will never be reused. A ledger must handle direct external claims, migrations, creator changes, historical coverage and reconciliation, and fail closed when attribution is incomplete. Neither may label an arbitrary shared balance as one coin's revenue.

Enforced per-mint escrow would require a separately authorized contract/deployer design, like the original vault. Native Pump holder mode instead requires the global authority's cooperation; ordinary creator signatures cannot substitute. These are not prerequisites for option A, and no new deployment is asserted necessary for voluntary manual payments.

## Implementation acceptance after the budget decision

- Preserve 300 bps and existing quote admission; separate allocation percentages from buy/sell fees.
- Persist a versioned mode, percentage, funding recipient, token/quote identity and the explicit budget basis in draft/request metadata; never advertise metadata as payment enforcement.
- Preview the actual budget, eligible holders, exclusions, recipient count, exact amounts, dust, ATA rent and network costs before signing.
- Obtain and validate a complete, slot-associated token-account snapshot before owner aggregation and exclusions. The current embedded holder reader (`runtime.mjs:94875–94892`) returns only the largest 20 token accounts and `complete:false`; it cannot be silently used as an all-holder distribution snapshot. Top-N selection, if supported, must be a separate explicit policy with excluded-holder counts.
- Reconstruct every claim/payout instruction independently, enforce token/quote programs and signer/source ownership, simulate unsigned envelopes, and reject substituted recipients or amounts.
- Persist a signed batch's exact bytes/signature before broadcast; reconcile pending signatures and expiry before rebuilding. Record partial completion and never silently retry paid batches. Browser-local receipts alone cannot guarantee cross-device exactly-once behavior; the final design must disclose or solve that boundary.
- Test conservation, invalid percentages/recipients, quote decimals/extensions, incomplete snapshots, owner aggregation, system exclusions, signers, substitution, batching, stale budgets, dust, and restart/retry behavior.
- Independent code/UI review and public verification are required before the feature is called shipped. No funded live transaction is authorized.

## Workstream preservation

Independent review returned **PASS**: shared-balance attribution is the actual boundary; creator-signed SPL transfers remain feasible. The reviewer independently re-ran all four protocol checks, re-read live global authority successfully, and checked the original helper and mint-isolating vault source. The mocked collection test excludes the optional AMM leg; its aggregation behavior was verified by SDK source inspection rather than a live AMM transaction. No end-to-end payout execution is claimed.

KNTQ admission/pricing decisions remain in `KNTQ-READINESS.md`. The deployed USD/spacing release and existing creator-recipient controls are unchanged. This record does not mark either new allocation controls or KNTQ launch support complete.
