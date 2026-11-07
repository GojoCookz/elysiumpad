// Native Pump creator trading fee. This is not a Token-2022 transfer tax.
export const PUMP_CREATOR_FEE_BPS=300;
// Measure simulated wallet debit without imposing an operator spend ceiling.
export function pumpSimulatedSolCost(before,after){
 const balance=value=>{if(typeof value==='bigint'&&value>=0n)return value;if(Number.isSafeInteger(value)&&value>=0)return BigInt(value);throw new Error('Simulation returned an invalid wallet balance.');};
 if(!before||!after)throw new Error('Simulation did not return the wallet balance.');
 const cost=balance(before.lamports)-balance(after.lamports);
 if(cost<0n)throw new Error('Unexpected wallet balance increase.');return cost;
}
export function pumpCreatorFeeSupport(global,quote){
 if(quote?.source!=='quoteControl')return {ok:false,reason:'Configured 3% creator fees require a Pump custom quote pair. SOL/USDC use their standard protocol fee schedule.'};
 if(global?.creatorFeeConfigurable!==true)return {ok:false,reason:'Pump currently disables configurable creator fees.'};
 const maximum=String(global.maxConfigurableCreatorFeeBps??'');
 if(!/^\d{1,10}$/.test(maximum)||BigInt(maximum)<BigInt(PUMP_CREATOR_FEE_BPS))return {ok:false,reason:'Pump’s verified maximum creator fee does not permit 3%.'};
 return {ok:true,reason:null};
}
