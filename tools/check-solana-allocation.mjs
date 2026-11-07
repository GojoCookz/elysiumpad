// Protocol boundary checks only: constructs unsigned instructions; never signs or sends.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Connection,PublicKey} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID,NATIVE_MINT} from '@solana/spl-token';
import {OnlinePumpSdk,PUMP_SDK,creatorVaultPda,holderRewardsPda,ammCreatorVaultPda} from '@pump-fun/pump-sdk';
import BN from 'bn.js';

const key=n=>new PublicKey(new Uint8Array(32).fill(n));
const creator=key(1),mintA=key(2),mintB=key(3),authority=key(4),recipient=key(5);
const checks=[];
// No real token mint enters either creator vault derivation.
const accountForCoin=(mint,creator)=>({mint:mint.toBase58(),curveVault:creatorVaultPda(creator).toBase58(),ammVault:ammCreatorVaultPda(creator).toBase58()});
const a=accountForCoin(mintA,creator),b=accountForCoin(mintB,creator);
assert.equal(a.curveVault,b.curveVault);assert.equal(a.ammVault,b.ammVault);
assert.notEqual(holderRewardsPda(mintA).toBase58(),holderRewardsPda(mintB).toBase58());
checks.push('Two mint fixtures with one creator share both ordinary creator vaults; holder-reward PDAs are per mint.');

const offline=new Connection('http://127.0.0.1:1','confirmed');
offline.getMultipleAccountsInfo=async()=>[null,null];
const sdk=new OnlinePumpSdk(offline);
const claim=await sdk.collectCoinCreatorFeeV2Instructions(creator,NATIVE_MINT,TOKEN_PROGRAM_ID,creator);
assert.ok(claim.length>0);
assert.ok(claim.some(ix=>ix.keys.some(k=>k.pubkey.equals(creatorVaultPda(creator)))));
for(const ix of claim)assert.ok(ix.keys.every(k=>!k.pubkey.equals(mintA)&&!k.pubkey.equals(mintB)));
checks.push('Installed SDK ordinary quote-claim instructions contain the creator vault but neither launch mint.');

const payout=await PUMP_SDK.distributeFeeToHoldersInstruction({holderRewardClaimAuthority:authority,mint:mintA,quoteMint:NATIVE_MINT,recipients:[{owner:recipient,amount:new BN(1)}]});
assert.ok(payout.keys.some(k=>k.pubkey.equals(authority)&&k.isSigner));
assert.ok(!payout.keys.some(k=>k.pubkey.equals(creator)&&k.isSigner));
checks.push('Native holder payout requires its supplied claim-authority signature, not the ordinary creator fixture. Global authority binding is specified by the installed IDL.');

// Same aggregate account state, different correct per-coin allocation: no balance-only algorithm can distinguish these histories.
const histories=[{a:10n,b:90n},{a:80n,b:20n}];
assert.equal(histories[0].a+histories[0].b,histories[1].a+histories[1].b);
const holderShare=histories.map(h=>h.a*50n/100n);
assert.notEqual(holderShare[0],holderShare[1]);
checks.push('Identical aggregate balance 100 can require either 5 or 40 for token A holders at 50%; aggregate claims alone cannot recover per-token revenue.');

let live;
try{
 const connection=new Connection('https://hypeliysium.fun/api/purrlysium/solana/rpc','confirmed');
 const genesis=await connection.getGenesisHash();assert.equal(genesis,'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
 const global=await new OnlinePumpSdk(connection).fetchGlobal();
 live={ok:true,observedAt:new Date().toISOString(),genesis,holderRewardClaimAuthority:global.holderRewardClaimAuthority.toBase58(),holderRewardEnabled:global.isHolderRewardEnabled,maxConfigurableCreatorFeeBps:global.maxConfigurableCreatorFeeBps.toString()};
}catch(error){live={ok:false,observedAt:new Date().toISOString(),error:error.message};}
const result={checks,fixtureOnly:{coins:[a,b],nativePayoutSigners:payout.keys.filter(k=>k.isSigner).map(k=>k.pubkey.toBase58()),sameAggregateHistories:histories,correctTokenAHolderAmounts:holderShare},live,scope:'No signing, transaction broadcast, funded simulation, or configuration change. These checks establish accounting/signing boundaries, not payout implementation readiness.'};
const json=JSON.stringify(result,(_,value)=>typeof value==='bigint'?value.toString():value,2);
if(process.argv[2])await writeFile(process.argv[2],json+'\n');
console.log(json);
