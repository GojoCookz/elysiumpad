// Shared server/browser construction and simulation validation. No signing or RPC.
import {PublicKey,ComputeBudgetProgram} from '@solana/web3.js';
import {TOKEN_2022_PROGRAM_ID,createAssociatedTokenAccountIdempotentInstruction,unpackAccount,unpackMint,getTransferFeeConfig} from '@solana/spl-token';
import {LAUNCHLAB_PROGRAM,QUOTE_CONFIGS,createTaxedLaunchIx,decodeLaunchlabPool,launchlabAddresses} from './launchlab-wire.mjs';
import {revenueAddress,revenueAta,taxAuthority,registerLaunchlabRevenueIx,decodeRevenue,validateRecipients,LAUNCHLAB_FEE_AUTHORITY,MAX_U64} from './revenue-wire.mjs';
export const LAUNCH_COST_CAP=50000000n;
export const LAUNCH_COMPUTE={units:600000,microLamports:20000};
export function rawAmount(value){if(typeof value!=='string'||!/^[1-9][0-9]{0,19}$/.test(value)||BigInt(value)>MAX_U64)throw new Error('Use a positive bounded raw decimal amount.');return BigInt(value);}
export function launchInstructions({request,programId,platformId}){
 const wallet=new PublicKey(request.wallet),mint=new PublicKey(request.mint),container=revenueAddress(programId,mint);
 validateRecipients({programId,mint,recipients:request.recipients,holderShareBps:request.holderShareBps});
 return [ComputeBudgetProgram.setComputeUnitLimit({units:LAUNCH_COMPUTE.units}),ComputeBudgetProgram.setComputeUnitPrice({microLamports:LAUNCH_COMPUTE.microLamports}),
  createTaxedLaunchIx({...request,platformId,supply:rawAmount(request.supply),totalSellA:rawAmount(request.totalSellA),totalFundRaisingB:rawAmount(request.totalFundRaisingB)}),
  createAssociatedTokenAccountIdempotentInstruction(wallet,revenueAta(programId,mint),container,mint,TOKEN_2022_PROGRAM_ID),
  registerLaunchlabRevenueIx({programId,mint,creator:wallet,quoteMint:request.quoteMint,recipients:request.recipients,holderShareBps:request.holderShareBps})];
}
export function verifyLaunchSimulation({after,request,programId,platformId}){
 if(!Array.isArray(after)||after.length!==5)throw new Error('Every requested launch account must be simulated.');
 const [,mintInfo,poolInfo,revenueInfo,vaultInfo]=after;const mint=new PublicKey(request.mint);
 const acc=info=>{if(!info)throw new Error('Launch simulation omitted an account.');return {...info,owner:new PublicKey(info.owner),data:Buffer.from(info.data)};};
 const decoded=unpackMint(mint,acc(mintInfo),TOKEN_2022_PROGRAM_ID),fee=getTransferFeeConfig(decoded);
 if(!decoded.isInitialized||decoded.decimals!==6||decoded.mintAuthority||decoded.freezeAuthority||decoded.supply!==rawAmount(request.supply)||!fee||!fee.transferFeeConfigAuthority.equals(LAUNCHLAB_FEE_AUTHORITY)||!fee.withdrawWithheldAuthority.equals(taxAuthority(programId))||[fee.olderTransferFee,fee.newerTransferFee].some(f=>f.transferFeeBasisPoints!==300||f.maximumFee<decoded.supply))throw new Error('Simulated mint supply, 3% tax or authority policy mismatch.');
 const poolAccount=acc(poolInfo);if(!poolAccount.owner.equals(LAUNCHLAB_PROGRAM))throw new Error('Simulated pool owner mismatch.');const pool=decodeLaunchlabPool(poolAccount.data),addresses=launchlabAddresses(mint,request.quoteMint);
 if(pool.status!==0||pool.baseDecimals!==6||pool.quoteDecimals!==6||pool.migrateType!==1||pool.mint!==request.mint||pool.quoteMint!==request.quoteMint||pool.configId!==QUOTE_CONFIGS[request.quoteMint]||pool.platformId!==platformId||pool.creator!==request.wallet||pool.vaultA!==addresses.vaultA.toBase58()||pool.vaultB!==addresses.vaultB.toBase58()||pool.supply!==rawAmount(request.supply)||pool.totalSellA!==rawAmount(request.totalSellA)||pool.totalFundRaisingB!==rawAmount(request.totalFundRaisingB))throw new Error('Simulated pool identity, curve or migration mismatch.');
 const record=decodeRevenue(acc(revenueInfo),programId);
 if(!record.mint.equals(mint)||!record.creator.equals(new PublicKey(request.wallet))||record.mintPolicy!=='launchlab-protocol'||record.holderShareBps!==request.holderShareBps||record.recipients.length!==request.recipients.length||record.recipients.some((r,i)=>r.owner.toBase58()!==request.recipients[i].owner||r.bps!==request.recipients[i].bps)||record.grossCollected!==0n||record.nextEpoch!==0n)throw new Error('Simulated immutable revenue registration mismatch.');
 const vault=unpackAccount(revenueAta(programId,mint),acc(vaultInfo),TOKEN_2022_PROGRAM_ID);if(vault.mint.toBase58()!==request.mint||!vault.owner.equals(revenueAddress(programId,mint))||vault.amount!==0n||vault.delegate||vault.closeAuthority||vault.isFrozen)throw new Error('Simulated holder container ATA mismatch.');
 return {pool,record};
}
