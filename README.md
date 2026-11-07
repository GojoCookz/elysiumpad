# Hypeliysium

Standalone Hypeliysium web release for Elysium chain `99901` and Solana market
discovery. This export contains only public runtime code, reviewed assets, and the
authorized early-live `99901` manifests.

Hypeliysium is a Solana launchpad; HLYS is its ecosystem token. Optional
Hypurrheaven home and cloud fishing live at `/home/` and `/home/fishing.html`.

Build with Node 24: `npm ci --ignore-scripts`, `npm run build`, `npm test`.
See [BUILD-AND-DEPLOY.md](BUILD-AND-DEPLOY.md) for frozen inputs, deployment
provenance, rollback and untested persistence limitations.

## Deployment

Railway runs `Dockerfile` and starts `start.mjs`. Set provider credentials only in
Railway variables, never in GitHub. `PUBLIC_ORIGIN` must be the generated Railway
HTTPS origin and may be used to populate `PURRLYSIUM_HOSTS`.

Solana launch, metadata publishing, and trading default to disabled. Jupiter remains
unavailable until an authorized key is supplied and capability checks pass.

This deployment does not sign, transfer, deploy contracts, fund wallets, accept
ownership, bridge, mint, or change fees.
