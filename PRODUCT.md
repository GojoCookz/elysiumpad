# Hypeliysium

## Verified USD market display

Elysium cards and tables show USD price, FDV and selected-pool window volume when a verified conversion exists. Details retain native amounts, exact quote address, chain ID 99901, pool ID, manager/currency explorer links and observation timestamps. V4 pool IDs are not presented as contract addresses. Virtual active quote depth is explicitly distinct from TVL.

Native HYPE uses CoinGecko's `hyperliquid` USD quote and provider timestamp. Elysium WHYPE requires an observed, authenticated native/WHYPE conversion pool; neither its peg nor its identity with HyperEVM WHYPE is assumed. Unsupported or expired rates show USD unavailable. Either conversion leg older than five minutes is cached; conversion rates older than one hour cannot produce dollar values. Pool states older than ten minutes are cached independently.

Market directories refresh every minute while retaining filters, view mode and expanded details. Refresh failures mark retained values as cached and expire old conversion rates. Pool discovery remains bounded; incomplete history does not produce a zero-volume claim.
<!-- impeccable:product-schema 1 -->

## Platform
web

Existing vanilla JavaScript/CSS UI, esbuild, frozen Node runtime.

## Product Purpose
Hypeliysium is a Solana launchpad with Elysium token discovery and creation.
HLYS is its Solana ecosystem token, not evidence of a platform-origin launch.
Visitors discover actual markets, inspect tokens, and prepare wallet-reviewed launches.

## Capabilities and Constraints
Solana defaults on a fresh visit; explicit and remembered chain choices survive.
Pump creation uses admitted custom quote assets and a 3% creator fee. Solana swaps
are currently disabled. No enforced Solana holder rewards are implemented.
The connected Solana wallet remains the signing payer and deployer. Creators may
use that wallet or a distinct, validated normal Solana wallet as the Pump creator
and fee recipient. The choice persists locally, enters the build request and
review, and is checked against reconstructed instructions and simulated state.
Monerochan holder pledges and its creator-signed payout helper are not implemented
in this direct Pump mode. The Elysium launcher has no separate recipient parameter.
Elysium creation exposes existing creator/holder/burn allocations; defaults are
3% buy/sell and 100% creator. Prices are authenticated pool snapshots; FDV is not
circulating market cap. No fabricated charts, metrics, transactions or partner claims.
Four themes and six languages, exact mint copying, official X, optional independent
Hypurrheaven game, wallet boundaries and current financial configuration must survive.

## Confirmed Brand Commitments
Owner explicitly authorized a full Stockium-inspired UI rebuild on 2026-11-07:
compact premium navigation, oversized editorial hero, teal depth and motion,
real HLYS feature, cohesive market/trade/create composition and mobile polish.
Keep our geometric H mark. Do not copy proprietary assets or source code.
The owner requests execution without another direction approval round. The prior
rounded redesign was rejected: the refinement must use sharp edges, soothing
aquatic movement, aligned compact spacing and persistent 3/6/9 grid choices.

## Delivery
Sole writer is this publication checkout. Dedicated Railway service only;
no DNS or marketing-routine changes. Live interaction checks and independent
visual review are required before completion. Wallet signing is outside this task.
