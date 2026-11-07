// Narrow LaunchLab ABI adapter. Verified against Raydium SDK revision recorded below.
// This is not a security audit or evidence of a funded launch.
import {PublicKey,SystemProgram,TransactionInstruction} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID,TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
export const LAUNCHLAB_PROGRAM=new PublicKey('LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj');
export const CPMM_PROGRAM=new PublicKey('CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C');
export const ABI_SOURCE='https://github.com/raydium-io/raydium-sdk-V2/tree/73e95fcb3cf5df55637286a573655e5f64182b62/src/raydium/launchpad';
export const QUOTE_CONFIGS=Object.freeze({
 '2zCo6bUowJMvr89ajxuWsPadAqJ2F9akCkxumNsSdgsL':'6kKxXTejzU7iWxEUUMEx22mREDjSg5VHvww6UNmX8U4Q',
 '7ga6rtE9qSb3wdEiDCpTu2kHqoGVfT52jD8ign1rYTvx':'HVQUb3bTSjhiGRrDihBaqx7xdTzeQK77XMwgPSykfJrr',
 '4sWNB8zGWHkh6UnmwiEtzNxL4XrN7uK9tosbESbJFfVs':'89Jix6Gj2s3UgMZLzDfbqVGB6h2tLhdhPxv8KzVFZzCE',
});
const key=value=>new PublicKey(value);
const pda=seeds=>PublicKey.findProgramAddressSync(seeds,LAUNCHLAB_PROGRAM)[0];
const discriminator=name=>Buffer.from({GlobalConfig:'95089ccaa0fcb0d9',PlatformConfig:'a04e8000f853e6a0',PoolState:'f7ede3f5d7c3de46'}[name],'hex');
export function taxAuthorityAddress(programId){return PublicKey.findProgramAddressSync([Buffer.from('tax-authority')],key(programId))[0];}
export function platformAddress(admin){return pda([Buffer.from('platform_config'),key(admin).toBuffer()]);}
export function launchlabAddresses(mint,quoteMint){
 const a=key(mint),b=key(quoteMint),pool=pda([Buffer.from('pool'),a.toBuffer(),b.toBuffer()]);
 return {pool,authority:pda([Buffer.from('vault_auth_seed')]),vaultA:pda([Buffer.from('pool_vault'),pool.toBuffer(),a.toBuffer()]),vaultB:pda([Buffer.from('pool_vault'),pool.toBuffer(),b.toBuffer()]),eventAuthority:pda([Buffer.from('__event_authority')])};
}
export function decodeLaunchlabConfig(data){
 const b=Buffer.from(data);if(b.length!==371||!b.subarray(0,8).equals(discriminator('GlobalConfig')))throw new Error('Invalid LaunchLab GlobalConfig account.');
 return {curveType:b[16],index:b.readUInt16LE(17),migrateFee:b.readBigUInt64LE(19),tradeFeeRate:b.readBigUInt64LE(27),maxShareFeeRate:b.readBigUInt64LE(35),minSupplyA:b.readBigUInt64LE(43),maxLockRate:b.readBigUInt64LE(51),minSellRateA:b.readBigUInt64LE(59),minMigrateRateA:b.readBigUInt64LE(67),minFundRaisingB:b.readBigUInt64LE(75),quoteMint:new PublicKey(b.subarray(83,115)).toBase58()};
}
export function decodeLaunchlabPlatform(data){
 const b=Buffer.from(data);if(b.length!==944||!b.subarray(0,8).equals(discriminator('PlatformConfig')))throw new Error('Invalid LaunchLab PlatformConfig account.');
 const pub=offset=>new PublicKey(b.subarray(offset,offset+32)).toBase58();
 return {feeWallet:pub(16),lockWallet:pub(48),platformScale:b.readBigUInt64LE(80),creatorScale:b.readBigUInt64LE(88),burnScale:b.readBigUInt64LE(96),feeRate:b.readBigUInt64LE(104),cpConfigId:pub(688),creatorFeeRate:b.readBigUInt64LE(720),taxAuthority:pub(728),vestingWallet:pub(760),vestingScale:b.readBigUInt64LE(792),cpCreator:pub(800),restrictGlobalConfig:b[832],restrictCurveParam:b[833],curveRuleManager:pub(834)};
}
export function decodeLaunchlabPool(data){
 const b=Buffer.from(data);if(b.length!==429||!b.subarray(0,8).equals(discriminator('PoolState')))throw new Error('Invalid LaunchLab pool account.');
 const pub=offset=>new PublicKey(b.subarray(offset,offset+32)).toBase58();
 return {status:b[17],baseDecimals:b[18],quoteDecimals:b[19],migrateType:b[20],supply:b.readBigUInt64LE(21),totalSellA:b.readBigUInt64LE(29),totalFundRaisingB:b.readBigUInt64LE(69),configId:pub(141),platformId:pub(173),mint:pub(205),quoteMint:pub(237),vaultA:pub(269),vaultB:pub(301),creator:pub(333)};
}
function u64(value){if(typeof value!=='bigint'||value<0n||value>0xffffffffffffffffn)throw new Error('Expected a bounded u64 bigint.');const b=Buffer.alloc(8);b.writeBigUInt64LE(value);return b;}
function text(value,max){if(typeof value!=='string'||!value||Buffer.byteLength(value)>max||/[\x00-\x1f<>]/.test(value))throw new Error('Invalid LaunchLab metadata text.');const b=Buffer.from(value),len=Buffer.alloc(4);len.writeUInt32LE(b.length);return Buffer.concat([len,b]);}
export function createIndependentPlatformIx({admin,feeWallet,lockWallet,vestingWallet,cpConfigId,revenueProgramId,name,web='',image='',platformFeeRate,creatorFeeRate,platformScale,creatorScale,burnScale}){
 const values=[platformFeeRate,creatorFeeRate,platformScale,creatorScale,burnScale];if(values.some(v=>typeof v!=='bigint'||v<0n||v>1000000n)||creatorFeeRate>5000n||platformScale+creatorScale+burnScale!==1000000n)throw new Error('Invalid platform rates or LP shares.');
 const string=(value,max)=>value===''?Buffer.alloc(4):text(value,max);for(const value of [web,image])if(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Platform links must use public HTTPS.');}
 const keys=[[admin,true,true],[feeWallet,false,false],[lockWallet,false,false],[platformAddress(admin),false,true],[cpConfigId,false,true],[SystemProgram.programId,false,false],[taxAuthorityAddress(revenueProgramId),false,false],[vestingWallet,false,false]];
 return new TransactionInstruction({programId:LAUNCHLAB_PROGRAM,keys:keys.map(([pubkey,isSigner,isWritable])=>({pubkey:key(pubkey),isSigner,isWritable})),data:Buffer.concat([Buffer.from([176,90,196,175,253,113,220,20]),u64(platformScale),u64(creatorScale),u64(burnScale),u64(platformFeeRate),text(name,64),string(web,256),string(image,256),u64(creatorFeeRate),u64(0n)])});
}
export function createTaxedLaunchIx({wallet,mint,quoteMint,platformId,name,symbol,uri,supply,totalSellA,totalFundRaisingB}){
 const quote=key(quoteMint).toBase58(),configId=QUOTE_CONFIGS[quote];if(!configId)throw new Error('Quote is not in the verified x-asset LaunchLab registry.');
 if(!/^[A-Z0-9]{1,10}$/.test(symbol))throw new Error('Invalid symbol.');
 const url=new URL(uri);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use a public HTTPS metadata URI.');
 if(typeof supply!=='bigint'||typeof totalSellA!=='bigint'||typeof totalFundRaisingB!=='bigint'||supply<=0n||totalSellA<=0n||totalSellA>=supply||totalFundRaisingB<=0n)throw new Error('Supply, sell allocation and quote raise must be explicit positive raw amounts.');
 const a=key(mint),b=key(quote),owner=key(wallet),platform=key(platformId),addresses=launchlabAddresses(a,b);
 if(a.equals(b)||a.equals(owner))throw new Error('Mint must be fresh and distinct.');
 // ConstantCurve index 0; migrateType 1 = CPMM. No vesting; OnlyTokenB = 0.
 const tail=Buffer.alloc(36);tail[24]=0;tail[25]=1;tail.writeUInt16LE(300,26);tail.writeBigUInt64LE(supply,28);
 // SDK tail span: three u64 + two u8 + u16 + u64 = 36 bytes.
 const data=Buffer.concat([Buffer.from([37,190,126,222,44,154,171,17]),Buffer.from([6]),text(name,32),text(symbol,10),text(uri,200),Buffer.from([0]),u64(supply),u64(totalSellA),u64(totalFundRaisingB),Buffer.from([1]),tail.subarray(0,36)]);
 const metas=[[owner,true,true],[owner,false,false],[key(configId),false,false],[platform,false,false],[addresses.authority,false,false],[addresses.pool,false,true],[a,true,true],[b,false,false],[addresses.vaultA,false,true],[addresses.vaultB,false,true],[TOKEN_2022_PROGRAM_ID,false,false],[TOKEN_PROGRAM_ID,false,false],[SystemProgram.programId,false,false],[addresses.eventAuthority,false,false],[LAUNCHLAB_PROGRAM,false,false]];
 return new TransactionInstruction({programId:LAUNCHLAB_PROGRAM,keys:metas.map(([pubkey,isSigner,isWritable])=>({pubkey,isSigner,isWritable})),data});
}
