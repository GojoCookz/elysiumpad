# Build and deployment record

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
