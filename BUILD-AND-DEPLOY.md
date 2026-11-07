# Build and deployment record

## Aquatic and creator-wallet refinement — verified candidate, 2026-11-07

The owner rejected the prior visual approval below; it is historical, not approval
for this revision. Two independent code reviews passed. The visual review failed
twice, then passed after replacing the drawn water curves with refracted-light
texture, tightening density layouts, squaring mobile navigation and compacting
the hero/HLYS treatment. Deployment of this candidate is recorded separately.

The refinement adds sharp geometry, shared header/content gutters, persisted
3/6/9-column controls and pausable aquatic motion. Local browser checks exercised
20 route/viewport combinations without page errors or horizontal overflow.
Additional checks verified actual desktop column counts, persistence, keyboard
selection, reduced-motion disabling, offscreen pausing, creator address validation,
recipient persistence and the signing-wallet picker with no installed extension.
At 1440x1000, the shared frame measured x=80px and width=1280px; the first token
row began at approximately y=700px after review corrections (previously 909px).
The market accessibility scan reported zero violations. Six localized mobile
heroes had no horizontal overflow. An isolated clean install/build/test run
passed all 48 tests and reproduced all four generated outputs byte-for-byte.
Automated motion checks confirmed changing transforms across five seconds;
independent still-image review cannot establish smooth animation playback.

All 48 tests passed, including seven new creator-wallet tests. They execute the
maintained production builder with synthetic RPC responses and real SDK encoding,
curve decoding and client reconstruction. Global admission is mocked only for
the browser simulation fixture. No funded simulation, signing or broadcast occurred.
The runtime now accepts a validated custom creator recipient while preserving the
connected signing payer, 300 bps and holderReward:false. Provenance records retain
the separate creator and continue accepting historical same-wallet records.

Monerochan's original `shared/builder.js:184-209` distinguishes self/custom-wallet
recipients from non-enforced holder promises. Its creator-signed payout helper is
not restored here. The installed Pump SDK `src/sdk.ts:1048-1085` separates `creator`
instruction data from `user`; Elysium launch calldata has no equivalent separate
recipient parameter. The interface states both limitations explicitly.

## Stockium-inspired product redesign — 2026-11-07

The financial shell now uses an editorial hero with an original geometric HLYS
feature, a mobile route rail, three-column desktop market cards, a two-column
Solana create form and live preview, the existing Elysium allocation preview,
and an on-page documentation navigator. Themes remain preference-driven.
Optional game files and backend transaction builders are unchanged.

Local verification covered 20 chain/route/viewport combinations at 390 and
1440 pixels using actual public read-only API responses, with no JavaScript
errors or horizontal overflow. It also exercised name/symbol preview updates,
supported and unsupported quote selections, market filtering, the More menu,
four theme preferences and the presence of six language options. The financial
and discovery test suite passed all 41 tests. An AccessLint scan of the market
page ran 94 rules with zero violations after correcting the footer link name.
These checks do not establish funded transaction success or WCAG conformance.

Independent visual review passed after correcting mobile preview order and
clarifying that the selected market quote is separate from SOL network fees.
The final isolated clean install/build/test run reproduced all four outputs
byte-for-byte. Reference, before and after screenshots are retained outside the
repository in the local release evidence directory.

Rollback baseline for this visual release is commit `7108672`, Railway deployment
`4dfa6c2d-6d53-439d-8d14-e33885195cb6`. The older rollback below remains historical.

## Self-contained upgrade path

Use Node 24 and `npm ci --ignore-scripts`, then `npm run build` and `npm test`.
The lockfile pins the existing compiler and protocol libraries. Dependencies are
build/test-only; the production image executes the committed bundles without an
install. `source/approved` contains the 44 required source inputs from the previously
approved application, initially 666,195 bytes, not a sibling project snapshot.
Local fixes to these inputs are tracked in this repository. No sibling checkout is
required. `source/browser-buffer.mjs` supplies the explicit browser Buffer shim.

The build reproduces the main application, Solana application, discovery runtime and
route policy. `runtime.mjs` is the frozen, bundled server release, maintained here as
a deployment input; this command does not reconstruct that historical server bundle
from upstream. The small mounted-adapter metadata correction is readable in
`source/solana-public-api.mjs`. Transaction builders remain in the frozen runtime.

An isolated directory outside the workspace completed a clean dependency install,
build and all 41 tests on 2026-11-07. All four generated outputs matched the working
release byte-for-byte. Repeat this check when build inputs or dependencies change.

## Optional Hypurrheaven mount

`optional/hypurrheaven` contains exactly the 31 browser runtime files from the
reviewed standalone package at `monero-side/worlds/atlantis/play/heaven`.
`optional/hypurrheaven-sha256.json` records their frozen bytes. Imported total:
709,758 bytes. Its home and fishing art previously passed independent review in
`G2-standalone-r2.md` (2026-11-05) and `G2-cloud-fishing-r2.md` (2026-11-06).
No upstream file was edited. Reports and source-project tooling are not exposed.

`start.mjs` supplies the omitted `HYPURRHEAVEN_HOME_DIR`, restoring `/home/` and
`/home/fishing.html` through the server's existing strict allowlist. Hypurrheaven
remains an optional game with its own identity. Pad layouts contain no game art.
Game progress uses browser-local storage, not the Railway volume. Saves from a
different preview origin do not automatically migrate to the custom domain.

## Deployment truth and rollback

GitHub publication: `https://github.com/GojoCookz/elysiumpad`, branch `main`.
The publication checkout is separate from the wider workspace's branch.
Production releases in this work were uploaded with `railway up --ci`, explicitly
targeting project `a822f6ee-e4da-4e36-a1c6-0239d03d0cd1`, service
`dd6f939f-79ea-44d8-ab2f-a7a72e955d45`, environment `production`.
Pushing GitHub was not the deployment mechanism. A GitHub-triggered deployment
integration has not been verified; do not claim it is linked or automatic.

Known rollback point before the quote/API/build/game changes:
commit `eb169f4`, successful Railway deployment
`05de393c-5931-47a1-8a21-b5156348e986`. Use Railway's deployment rollback/redeploy
for that exact deployment, or check out that commit in a separate clean directory
and upload it to the same explicit service. Preserve all service variables and the
existing volume. Recheck root chain selection, APIs and custom-domain pages.
Rollback was documented, not exercised against production.

The persistent volume is configured at `/app/data`. Production survival across a
restart or redeploy has not been tested. Unit tests cover persistence behavior;
they are not evidence of production volume survival. No funded transaction,
wallet signing, broadcast, fee change or contract deployment was performed.
