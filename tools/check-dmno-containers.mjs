// Read-only deployment/receipt probe. No keys, signing, simulation or broadcast.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Connection, PublicKey} from '@solana/web3.js';

const program = new PublicKey('J1UfA9xBHjkUG9qFakh5b9LXBkw4bqQrYALnQMhGJWZ2');
const loader = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const signature = '3kxu99zAVmVgv4wjh2b4BPEQgfDR9ArVm2syqCZUm6ffWZ7fw3uDiyBrxmVBwUo1Jv8rtPq3L3zLqPo19F1pzDP8';
const clusters = [
  ['mainnet', 'https://hypeliysium.fun/api/purrlysium/solana/rpc', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'],
  ['devnet', 'https://api.devnet.solana.com', 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'],
];
const results = await Promise.all(clusters.map(async ([cluster, url, expectedGenesis]) => {
  try {
    const connection = new Connection(url, {
      commitment: 'confirmed', disableRetryOnRateLimit: true,
      fetch: (input, options) => fetch(input, {...options, signal: AbortSignal.timeout(20000)}),
    });
    const genesis = await connection.getGenesisHash();
    assert.equal(genesis, expectedGenesis, 'Wrong cluster genesis');
    const {context, value: account} = await connection.getAccountInfoAndContext(program);
    let programData = null;
    if (account) {
      assert.ok(account.executable && account.owner.equals(loader), 'Not an executable upgradeable program');
      assert.equal(account.data.length, 36, 'Unexpected program layout');
      assert.equal(account.data.readUInt32LE(0), 2, 'Unexpected loader state');
      const address = new PublicKey(account.data.subarray(4));
      const data = await connection.getAccountInfo(address);
      assert.ok(data && data.owner.equals(loader), 'Missing or foreign ProgramData');
      assert.ok(data.data.length >= 45 && data.data.readUInt32LE(0) === 3, 'Unexpected ProgramData layout');
      programData = {address: address.toBase58(), bytes: data.data.length, lamports: data.lamports};
    }
    const receipt = cluster === 'devnet'
      ? (await connection.getSignatureStatuses([signature], {searchTransactionHistory: true})).value[0]
      : undefined;
    return {cluster, genesis, slot: context.slot, exists: Boolean(account), executable: account?.executable,
      programData, receipt: cluster === 'devnet' ? {signature, status: receipt} : undefined};
  } catch (error) {
    return {cluster, error: error.message};
  }
}));
const report = {
  checkedAt: new Date().toISOString(), program: program.toBase58(), results,
  scope: 'Account existence and historical upgrade status only. No deployed-byte equivalence, quote compatibility, payout execution or fee quote is established.',
};
const json = JSON.stringify(report, null, 2);
if (process.argv[2]) await writeFile(process.argv[2], json + '\n');
console.log(json);
if (results.some(result => result.error)) process.exitCode = 1;
