# Solana container recovery — 2026-11-07

## Correction and current outcome

The previous decision document was premature. dmno has a real per-token container architecture and recorded devnet executions. It is not an external container SaaS/API requiring an API key: the recovered implementation uses the project's Solana program, PDA accounts, Meteora DBC/DAMM v2, and Solana RPC. This conclusion applies to the recovered code; it does not rule out an additional integration elsewhere.

The original architecture has now been traced far enough to establish two concrete integration gates, rather than request another generic product choice:

1. **Deployment identity:** recovered program `J1UfA9xBHjkUG9qFakh5b9LXBkw4bqQrYALnQMhGJWZ2` is executable on devnet and absent on mainnet at the read below. Both inspected dmno local environment files select this devnet ID; neither contains a true `NEXT_PUBLIC_MAINNET_PROGRAM_LIVE` setting. A different mainnet deployment remains unverified, not disproved.
2. **Asset-compatible intake:** dmno's collector routes native SOL, or the launched base token through a separate instruction. Hypeliysium's fixed-300-bps Pump mode earns a distinct SPL quote token. Routing that quote to the recovered collector would not supply the instruction needed to move it onward. The copied `pad-revenue` module also handles base-token withholding, not quote-token creator fees.

**Exact missing integration artifact:** an existing mainnet program ID and corresponding source/ABI or verified deployment receipt whose per-mint collector can distribute the actual Pump quote mint independently of the launch mint, with the intended creator/holder split. No API credential alone resolves the recovered ABI mismatch. If such a deployment does not already exist, adapting/deploying a program is additional work requiring the currently excluded deployment authorization. Nothing in this report authorizes it.

No production allocation controls or payout workflow were enabled. Doing so with these recovered binaries would advertise an unsupported financial path. Existing creator-only launches remain implemented. KNTQ's separate admission/pricing blocker is preserved.

## Recovered architecture and exact source evidence

Paths below are relative to `C:/Users/shies/.kimaki/projects/solana-launch-pad` unless otherwise stated.

| Component | Evidence | Meaning |
|---|---|---|
| Per-mint Launch | `programs/launchpad-pino/src/ix/register_token.rs:79–86` | PDA `['launch', mint]`; registration requires mint authority or mint signature, not arbitrary first registration. |
| Per-mint FeeCollector | `programs/launchpad-pino/src/ix/fees.rs:23–43` | PDA `['fee_collector', mint]`; payer funds account creation/rent. This isolates accounts by token. |
| Treasury allocation | `register_token.rs:97–121` | 1–10 canonical `['treasury', mint, index]` accounts; treasury shares total 10,000 bps. |
| Native SOL routing | `ix/fees.rs:48–118` | Permissionless `collect_fees` moves lamports above rent only to recorded, program-owned treasuries; floor dust remains. |
| SPL routing limitation | `ix/swap.rs:39–87` | `split_fees` uses the same `mint` for Launch seeds, collector seeds and source/destination ATAs. It cannot take a distinct Pump quote mint for a launch. |
| Creator split field | `register_token.rs:54,100,138`; `state.rs:291,337,372` | `creator_fee_share_bps` is accepted and serialized. The inspected collector/split instructions do not apply that field or pay a creator wallet. A stored field is not proof of enforced creator/holder payout. |
| Distribution settings | `ix/launch.rs:128–161` | Mode, minimum holding, visibility and top-holder count are editable; these are distinct from a creator/holder percentage split. |
| DEX collection | `docs/audits/2026-10-02-fee-round-audit.md:13–34` | `harvest_damm_v2_fees` signs with the collector PDA, pins DAMM v2, claims into canonical accounts and unwraps wSOL to SOL. |
| Reward lifecycle | `docs/handoff/TOKEN-STRUCTURE-HANDOFF.md:24–32` | Treasuries, guarded conversion, Merkle challenge/finalization, proof-based claim/push and replay bitmap. This is the documented design, not a newly executed payout test. |

Program identities from `programs/launchpad-pino/src/ids.rs:8–14,64–82`:

- dmno devnet: `J1UfA9xBHjkUG9qFakh5b9LXBkw4bqQrYALnQMhGJWZ2`.
- Meteora DBC: `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`.
- Meteora DAMM v2: `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`.
- The mainnet build explicitly requires a non-devnet `LAUNCHPAD_PROGRAM_ID`; app resolution rejects the devnet ID on mainnet (`app/lib/network-config.ts:77–85`).

Configuration names inspected without disclosing credentials: `NEXT_PUBLIC_PROGRAM_ID`, `NEXT_PUBLIC_RPC_ENDPOINT`, `RPC_ENDPOINT`, `MAINNET_RPC_ENDPOINT`. Source additionally gates mainnet routing through `NEXT_PUBLIC_MAINNET_PROGRAM_LIVE` (`app/lib/launch-curve.ts:94–99`).

## Historical execution and current read-only verification

`docs/LIVE-TOKEN-E2E.md:1–17` records 198/198 devnet steps, including one intentional refusal. It distinguishes DBC fee routing, LP-seat custody, basket claims and creator-funded top-ups. It does not establish mainnet execution or arbitrary creator-signed Pump quote payouts. The LP/basket path is separate from the Launch/Merkle path; its documented mainnet gates must not be generalized to all reward containers.

Fresh read captured at **2026-11-07T17:19:51.048Z**:

| Read | Result |
|---|---|
| Mainnet genesis | `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d` |
| Recovered program on mainnet | Account absent |
| Devnet genesis | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` |
| Recovered program on devnet | Executable; upgradeable loader owner |
| ProgramData | `76qanVtvU2hZgqsmA5qq4fzUSKjQ2mBi71hwgPhZoWRz`; 2,005,373 bytes; 10,187,945,080 lamports |
| Historical upgrade | Finalized, `err:null`, slot **506671068**, matching the audit record |

Upgrade receipt: https://explorer.solana.com/tx/3kxu99zAVmVgv4wjh2b4BPEQgfDR9ArVm2syqCZUm6ffWZ7fw3uDiyBrxmVBwUo1Jv8rtPq3L3zLqPo19F1pzDP8?cluster=devnet

Artifact: `C:/Users/shies/AppData/Local/Temp/opencode/dmno-container-live-evidence.json`. This verifies deployment existence and that upgrade receipt, not byte-for-byte current deployed-code equivalence or every historical payout. The current ProgramData allocation is not the smaller compiled binary size in an old budget.

The historical **routing transaction itself** was also fetched from devnet, not merely accepted from the document: slot **506672148**, `err:null`, network fee **5,000 lamports**, collector `5h87xCCsRZcYN1HQhvwHNYntpEEt7bBfsgAMXGny6S2K` decreased by **4,674,474 lamports**, and treasury `8VRP8LV7NwTW3s7bofKjAwaihZSFCchtdiGwGgUY4Sof` increased by exactly that amount. Its program log reports the same distribution. The historical audit identifies this amount as 3,186,034 lamports of trading fees plus 1,488,440 lamports of returned wSOL-account rent; the entire delta must not be described as trading revenue. This is actual container-to-treasury routing, not proof of a holder payout.

Receipt: https://explorer.solana.com/tx/2ojbWrGteEjsYseX1FnYRn4E1HcC5E6qw1sCrVHXQ3BrAmq91YoWNkdAQc9zmnxXGbf1e95hLipy4wBhU6gXn3y3?cluster=devnet

Artifact: `C:/Users/shies/AppData/Local/Temp/opencode/dmno-container-routing-receipt.json`. Reproducible deployment probe: `node tools/check-dmno-containers.mjs <external-output.json>`. It passed cluster-genesis, loader-layout and ProgramData-owner checks at **2026-11-07T17:22:04.255Z**; mainnet read slot **466594550**, devnet read slot **519733581**. It performs only RPC reads and returns a failing exit code for RPC/validation errors.

Git provenance: `0f37e9a` (2026-10-02 handoff), `bbab1bd` (2026-10-02 audits/runbooks/E2E scripts), `0835ed6` (2026-09-29 Pinocchio port).

## Deposit, fees and refund semantics

**Approximately 0.65 SOL remains the owner's recollection, not a verified configured charge.** No matching fixed deposit constant was found in the targeted source/history search. Do not turn an estimate into a required transfer.

The recovered documents describe several different amounts:

- `docs/MAINNET-BUDGET.md:26–33`: an older 342,832-byte program's measured devnet deployment/handover cost was **1.748771240 SOL**. Program storage was recoverable only by closing the program; that is not a normal per-token refund.
- Same document, lines 54–62: abandoned upload-buffer rent was recovered in a rehearsal; transaction fees were spent. This is deployment-buffer recovery, not a container-provider deposit refund.
- Same document, lines 81–87: historical pool + registration + collector + one treasury cost **0.078376160 SOL** on devnet; separate round bond **0.1 SOL**. This report has not verified the bond-return path.
- `docs/LIVE-TOKEN-MAINNET-RUNBOOK.md:55–60`: approximately **0.065 SOL**, not 0.65, for a four-leg/four-reward setup excluding seed liquidity and optional DBC launch. This may explain a decimal-memory mismatch, but that is only a possibility.
- `docs/handoff/TOKEN-STRUCTURE-HANDOFF.md:40`: a separate **0.5 SOL all-in launch fee**, crediting created storage against the platform portion, plus a minimum dev buy. It is not a fixed refundable provider deposit.
- `docs/audits/2026-10-02-fee-round-audit.md:168–174`: a later 412,760-byte mainnet build estimated **2.096820800 SOL** storage deposit. None of these historic numbers is a current funding quote.

The collector deliberately retains rent (`ix/fees.rs:71–77`). No general user refund should be promised from this behavior.

## Monerochan and HypurrLabs reconciliation

- Monerochan's per-mint `coin-authority` vault already establishes that per-token Pump isolation is possible. Its creator-signed SPL payout helper was executed unsigned in the earlier investigation. That helper is not evidence of a deployed dmno/Pump quote intake adapter or complete holder snapshots.
- `getrektdonhype/deployments/HYPURRLABS.md:11–18,24` distinguishes direct Pump creator fees from the separate LaunchLab/revenue system, states no Monerochan program/treasury was copied, and already calls 0.65 SOL unverified.
- `getrektdonhype/REWARDS-RUNNER.md:9` explicitly says native Pump creator fees are quote tokens, while `pad-revenue` holds base-token transfer tax.
- Publication `source/approved/backend/revenue-wire.mjs:43–48,70–91` derives a per-mint container holding that same Token-2022 mint. `launch-flow.mjs:13–26` requires a taxed LaunchLab launch and verifies 300-bps transfer withholding. Reusing it as if it were native Pump revenue would change economics.
- `revenue-wire.mjs:52–68` requires both positive holder and positive developer allocations; even its existing ABI is not interchangeable with creator-only/holder-only/split controls.

## Search coverage and limits

Read-only investigation covered dmno source/docs/local configuration names/git history, original Monerochan, HypurrLabs and the publication's inherited revenue modules. OpenCode's local SQLite history was queried read-only for dmno container/deposit explanations and exact deposit strings. Relevant recovered parts include `prt_0f96ff632001s5hYHsNNn30osR` (DEX collector flow) and `prt_0fec218ee001Nwmex69XUfVY0w` (container handoff and storage deposits). No exact 0.65-SOL deposit explanation was returned by those historical text queries. That is a bounded search result, not proof of absence from all tools, providers, WSL checkouts or external conversation history.

The recovered source is useful and reusable, but no paid provisioning, deposits, funded transactions, ownership changes or deployment were performed. Application changes remain blocked on an asset-compatible deployed contract, not on KNTQ and not on a generic architecture preference.

## Independent review

Independent read-only review returned **PASS** for the recovered collector blocker. It checked adjacent paths rather than stopping at `split_fees`: DBC/DAMM harvesters require wSOL; creator-tax delivery spends its own escrow; reward-pool funding spends a treasury; `fund_basket_currency` accepts signer-owned funding; `route_lp_fees` spends BackingVault custody. The last two are genuine multi-currency reuse points, but neither spends this FeeCollector's quote balances or enforces the Launch creator percentage. Relevant source: `ix/basket.rs:331–378`, `ix/lp.rs:994–1044`, `ix/reward_pool.rs:258–293`, `ix/creator_tax.rs:1083–1107`.

The reviewer inspected source and the captured live evidence; it did not independently re-query RPC or compare deployed bytes. Verdict artifact: `C:/Users/shies/AppData/Local/Temp/opencode/dmno-container-review.out`. No runtime/UI change was made, so this is compatibility verification, not a shipped payout feature or a new full security audit.
