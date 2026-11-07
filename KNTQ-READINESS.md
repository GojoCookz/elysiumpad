# KNTQ quote-pair readiness

## Decision and current status

The owner's priority is new Elysium token/KNTQ launches, while retaining HYPE and the existing fee policy. This is not a request to change the default chain or claim a Kinetiq partnership.

**Blocked by deployed admission, not ready to enable.** At Elysium block **2,037,764**, the launcher's actual PairRegistry returned `isApproved(KNTQ) = false`. No selectable KNTQ launch control, application release, funded transaction, admin call, liquidity seed, or new deployment was made for this task. The USD/spacing release remains deployed.

The publication checkout is `main`, separate from the workspace branch `feat/trading-ui-release` reported by the owner. All writes for this investigation are inside `elysiumpad-publish`.

## Identity evidence

Retrieved 2026-11-07; live probe completed at `2026-11-07T16:32:40.628Z`.

| Property | Verified value |
| --- | --- |
| Elysium chain ID | `99901` |
| KNTQ on Elysium | `0xe45a355d9e9cAd2aD85F2d03E3eE3102A036acF0` |
| ERC-20 decimals | `18`, read from the token at the pinned block |
| Token `l1Address()` | `0x000000000000780555bD0BCA3791f89f9542c2d6` |
| Parent chain | HyperEVM, `999` |
| Hyperliquid token ID | `0xbd31bd605c0a1b82c72aae3587f9061f` |
| Hyperliquid `spotMeta` EVM mapping | The same parent address; `weiDecimals = 8`, `evm_extra_wei_decimals = 10` |
| Elysium gateway router | `0x61EbbC3A29f1970aF2Ce862bA9c5364832E14d17` |
| Router `getGateway(parent)` | `0x5DC84e4Cb0F9082246E92a5585C5395592B1aF1f` |
| Gateway `calculateL2TokenAddress(parent)` | The exact Elysium KNTQ address above |

This identifies the deployed bridge representation through a first-party parent mapping and both directions of the on-chain bridge relationship; it does not rely on the ticker. Hyperliquid's response also contains `isCanonical: false`; that field is preserved in the evidence and is not being relabeled as true. No issuer-maintained mainnet address table for the Elysium representation was found in the reviewed pages. The issuer's contract-address page is explicitly **testnet** and its different gateway/WHYPE addresses must not be substituted into chain 99901.

First-party sources:

- https://kinetiq.xyz/docs/kntq — KNTQ governance-token identity and Hyperliquid context.
- https://api.hyperliquid.xyz/info — `POST {"type":"spotMeta"}`, token ID and parent EVM mapping above.
- https://elysium.kinetiq.xyz/docs/connecting-to-elysium — mainnet ID 99901, parent 999; testnet ID 99801. The page still describes mainnet as pre-launch.
- https://elysium.kinetiq.xyz/docs/contract-addresses — testnet-only addresses, not evidence for the deployed mainnet gateway.
- https://hypeliysium.fun/elysium/manifest.json — application deployment coordinates, independently checked against live contract getters rather than treated as proof of current ownership.

## Deployed contract gate

| Contract/read | Result at block 2,037,764 |
| --- | --- |
| Launcher | `0x0347cf846effafa2c3ed020abafcc986d83fb99e` |
| `launcher.pairRegistry()` | `0x8d49BC8A266B2160e080639759820ab0591B63f9` |
| Registry `isApproved(KNTQ)` | `false` |
| Registry `pairConfig(KNTQ)` | `(false, address(0), 0, 0, 0)` |
| Registry `isApproved(current WHYPE)` | `true` |
| Registry `owner()` | `0xDbd7Cca1D0541497eD9d552B21B16dDD7689b360` |
| Manifest `owner` | `0x0235006e02E93b23a45d95f2d66CED11d425CAe7`; **not the registry's current owner** |

Local reference source `hoodstonk/contracts-trader-referrals/src/Launcher.sol:547–548` gates new launches on `pairRegistry.isApproved(p.pair)`. `PairRegistry.sol:164–169` provides the owner-only no-oracle admission function; `:328–329` implements the address allowlist. These are reference-source findings, not a claim that every byte of the deployed runtime has been matched to that source.

The read-only launch simulation using the application's actual launch ABI reverted. The provider omitted revert data, so the simulation is **not** reported as a decoded `PairNotApproved` error. The rejection and the separately observed false admission flag are distinct evidence. The recorded runtime hashes identify the observed code; they are not a source-verification claim.

Runtime hashes:

- Launcher: `0xc08c71118ec66d3f638dc7f1490758664e1375705e96d942d1edef6be24fdce6`
- Registry: `0x412ff1ad93e7605823d20c04b2870904e40ac7e9e701d59f68d38c646b6ecddd`
- Trade router: `0xb7b5e42036434de931deffe6d8efe139fffdacccff2e7b81ba39a2214fb06ad4`

## Existing liquidity is not launch-route readiness

An existing KNTQ/native-HYPE pool was verified by recomputing its pool ID, authenticating its manager runtime against the application's manager reference, and reading current `extsload` state:

- Manager: `0xe2e105d3f7209a9da11f83ccf3e7398a753823f1`
- Pool ID: `0xc96bfd21d36f8e7252f0d80fcb5f3bcacdf47c8b927b20711104713ebeb383ac`
- Key: native HYPE / exact KNTQ address; fee `10000` pips, tick spacing `200`, no hook.
- `sqrtPriceX96 = 993660540195100478838225002102`, active liquidity `39201315396899735291859` (raw units).

The deployed pad trade router points instead to manager `0x06C63714fBf1F5753017123E2FcfdEde4540B2c4`. That manager has zero sqrt price for this pool ID. A read-only KNTQ sell attempt through that router reverted with `0x486aa307`, the selector of `PoolNotInitialized()`. The existing external pool cannot be routed through this router by copying its key.

The deployed V3 factory `0x4979271ccA58d29CeA1435BCe0aaeC3B4a506fD4` returned no KNTQ/current-WHYPE pool at fees 500, 3000 or 10000. This is a bounded check of those three tiers, not a claim that no other market exists.

Direct trading of a future token/KNTQ pool is a different route from native-HYPE onboarding into KNTQ. Neither new-pool execution nor a native-HYPE zap into that pool has passed an end-to-end test. Existing market-display USD prices do not prove either route works and are not a manipulation-resistant launch-price oracle.

## Prepared action — not executed

An explicit authorization is required before the registry owner submits any admission transaction. One available **candidate**, subject to choosing the opening-price policy, is:

```text
chainId: 99901
from: 0xDbd7Cca1D0541497eD9d552B21B16dDD7689b360
to: 0x8d49BC8A266B2160e080639759820ab0591B63f9
value: 0
function: approvePairWithoutOracle(address,uint8)
arguments: [0xe45a355d9e9cAd2aD85F2d03E3eE3102A036acF0, 18]
data: 0xf9304343000000000000000000000000e45a355d9e9cad2ad85f2d03e3ee3102a036acf00000000000000000000000000000000000000000000000000000000000000012
```

This payload was encoded only. It was not signed, submitted, or simulated as an owner action. Re-read ownership, token identity, and deployed code and simulate before an explicitly authorized submission. Existing HYPE admission and all financial fee parameters must remain intact.

The second decision is opening-price policy: no KNTQ oracle is configured. The current UI promises a $2,500 opening market cap and has HYPE-denominated caps. A no-oracle admission requires an explicit KNTQ-denominated opening policy and corresponding caps, or a separately verified pricing source that preserves the dollar target. Neither inventing a fixed conversion nor treating today's spot pool price as an oracle is authorized.

After resolving admission and pricing:

1. Recheck approval, exact decimals, and `minDevBuyFor(KNTQ)`; the current unapproved configuration returns 1 raw unit because its cached token decimals are zero. Do not use that as KNTQ's post-admission minimum.
2. Wire quote identity through the launch payload, preview, recipient review, and fee/reward currency labels. Parse amounts using verified quote decimals. Preserve the HYPE option.
3. Read KNTQ balance/allowance and prepare only the required KNTQ approval to the actual launcher. Never call WHYPE `deposit()` for KNTQ.
4. Verify direct token/KNTQ trading against the pad manager, exact spending approvals, slippage, and quote-unit caps. Treat native-HYPE routing as independently gated until its route is verified.
5. Add exact-address KNTQ discovery and USD cross-conversion with timestamped, authenticated conversion evidence. Keep display spot prices separate from launch price policy.
6. Run funded-state **local fork simulations**, meaningful negative tests, independent code/UI review, and public verification before enabling and deploying the app flow. No live funding is authorized.

## Reproduction and pending Solana scope

Verification completed: the live read-only probe and syntax check passed; a separate calldata round-trip check confirmed the exact token, 18 decimals, current owner, zero native value, and `PoolNotInitialized()` selector. Independent review found two evidence-presentation gaps, both removed; focused independent retest returned **PASS**. Public app, Solana bundle, and stylesheet SHA-256 hashes still matched the existing local release. This is a reviewed blocker report, not an implemented KNTQ launch release.

Run `node tools/check-kntq-readiness.mjs <external-output.json>`. It uses read-only RPC and `eth_call`, checks identity and bridge mapping, records admission and ownership, simulates launch/trading, and prints the unsigned candidate admin payload. Successful completion means **the probe ran**, not that KNTQ launches are ready. RPC rate limiting occurred on the primary endpoint; the probe uses the deployment's configured failover endpoints.

Solana creator-only / holders / split controls remain **unfinished**, retained as the next workstream. Verified findings so far:

- Original `monerochan-launchpad/shared/builder.js:185–239` implements creator-signed, unenforced holder allocations and integer pro-rata calculation.
- Original `server/keeper.mjs:197–211` builds unsigned quote-token payouts, including ATA creation, for the creator to sign. Targeted references found tests but no browser/API invocation of this helper.
- Installed Pump SDK's `node_modules/@pump-fun/pump-sdk/dist/index.d.ts:5341–5384` states that `distributeFeeToHolders` requires `Global.holderRewardClaimAuthority` as a signer. A subsequent attempt to capture live Solana evidence through the public RPC proxy returned HTTP 503, so current global configuration is not independently verified in this readiness record.
- Ordinary claim APIs collect by creator and quote asset across coins, including PumpSwap; they are not per-token revenue accounting. Manual creator-signed distribution remains technically possible, but pooled claims must not be represented as one token's revenue without explicit accounting.
- No holder-allocation implementation or release has been claimed complete. The existing separate creator-recipient feature is not a substitute.
