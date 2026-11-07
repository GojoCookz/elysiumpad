// SPDX-License-Identifier: MIT
// Copyright (c) Sapling. Adapted from core/src/costcap.ts, @saplingcash/sdk@0.1.0.
export const SWAP_OVERHEAD_CAP_LAMPORTS=3000000n;
export const LEG_CAP_LAMPORTS=10000000n;
export const LAUNCH_EXTRA_CAP_LAMPORTS=30000000n;
export const lamportsText=value=>`${value<0n?'-':''}${(value<0n?-value:value)/1000000000n}.${((value<0n?-value:value)%1000000000n).toString().padStart(9,'0')} SOL`;
export function simulationReason(err,logs=[]){
  for(const line of logs){const m=/insufficient lamports (\d+), need (\d+)/.exec(line);if(m)return `This wallet needs ${lamportsText(BigInt(m[2])-BigInt(m[1]))} more for account rent and fees.`;}
  if(/InsufficientFunds|AccountNotFound/i.test(JSON.stringify(err))||logs.some(l=>/insufficient funds/i.test(l)))return 'This wallet does not hold enough SOL or tokens for this transaction.';
  return `Simulation failed: ${JSON.stringify(err).slice(0,180)}`;
}
export function checkCost(sim,maxCost){
  if(sim.err)throw new Error(simulationReason(sim.err,sim.logs));
  if(typeof sim.cost!=='bigint')throw new Error('Simulation did not return the wallet balance. Nothing was sent.');
  if(sim.cost>maxCost)throw new Error(`Cost ${lamportsText(sim.cost)} exceeds the limit ${lamportsText(maxCost)}. Nothing was sent.`);
}
