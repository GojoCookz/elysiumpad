import {keccak256} from 'viem';
// Observed on chain 99901, 2026-11-07. All four 24,009-byte runtimes are
// byte-identical to the authorized manifest manager except NoDelegateCall's
// immutable self-address at byte offset 13,618 (20 bytes). No proxy is admitted.
export const MANAGERS=Object.freeze({
 '0x06c63714fbf1f5753017123e2fcfdede4540b2c4':'0x7d6d330e9684ed9645780f0909ef4b9f0fbfcca00dd8bc0b8c8b9cadb834b59f',
 '0xe2e105d3f7209a9da11f83ccf3e7398a753823f1':'0xbb5fb2091cfd38e71f56d14a2b6b5e71a22ac2b8e5881faa422ccf92b40df7a1',
 '0x5fb015a49f5b35073f9ce01c2adb287a75f89600':'0xaac49acb10c57097b4926825b0cdf465f3c4037f9b20fe321924d19f89ac5a0c',
 '0xb308b5df891c300a5f5a5b8fdbc30108ba842490':'0x3779ef18b25dc9becd6ccebb4f7363af0308349a73bc250e0e32bacccf95e774'
});
export function matchesManager(address,code){return !!MANAGERS[address.toLowerCase()]&&/^0x[0-9a-f]+$/i.test(code)&&keccak256(code)===MANAGERS[address.toLowerCase()];}
