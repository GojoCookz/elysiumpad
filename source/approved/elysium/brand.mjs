// Brand per build. tools/build-elysium.mjs bundles the app twice with __PURRLYSIUM__ defined as
// false (hypurrlabs.fun/elysium) or true (purrlysium.fun). The minifier drops the other branch, so
// the Purrlysium bundle carries no HypurrLabs names and reads the DEX section of its own manifest.
/* global __PURRLYSIUM__ */
const PURR = typeof __PURRLYSIUM__ !== 'undefined' && __PURRLYSIUM__;

export const BRAND = PURR
  ? { dex: 'Hypeliysium Swap', hook: 'Hypeliysium', file: 'purrlysium', sampleName: 'Sample Coin', chainId: false, terminal: true }
  : { dex: 'HypurrSwap', hook: 'HypurrLabs', file: 'hypurrlabs-elysium', sampleName: 'Hypurr Cat', chainId: true, terminal: false };

// Manifest section holding the V3 DEX deployment.
export const swapOf = (m) => (PURR ? m.swap : m.hypurrswap);
