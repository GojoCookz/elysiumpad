# Hypeliysium

Standalone Hypeliysium web release for Elysium chain `99901` and Solana market
discovery. This export contains only public runtime code, reviewed assets, and the
authorized early-live `99901` manifests.

## Deployment

Railway runs `Dockerfile` and starts `start.mjs`. Set provider credentials only in
Railway variables, never in GitHub. `PUBLIC_ORIGIN` must be the generated Railway
HTTPS origin and may be used to populate `PURRLYSIUM_HOSTS`.

Solana launch, metadata publishing, and trading default to disabled. Jupiter remains
unavailable until an authorized key is supplied and capability checks pass.

This deployment does not sign, transfer, deploy contracts, fund wallets, accept
ownership, bridge, mint, or change fees.
