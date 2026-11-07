import {PublicKey,VersionedTransaction} from '@solana/web3.js';
import {address} from './config.mjs';
import {checkComputeBudget,TRADE_COMPUTE_CAPS} from './framework/server/api-v1/guard.mjs';
import {simulateSwap} from './framework/third_party/sapling/swapguard.js';
import {SWAP_OVERHEAD_CAP_LAMPORTS,LEG_CAP_LAMPORTS} from './framework/third_party/sapling/costcap.js';
const SOL='So11111111111111111111111111111111111111112';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function validateSwap(input,config){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Supply a swap request.');
 const keys=new Set(['wallet','inputMint','outputMint','amount','slippageBps']);if(Object.keys(input).some(key=>!keys.has(key)))fail('Unknown swap request field.');
 const wallet=address(input.wallet,'wallet'),inputMint=address(input.inputMint,'input mint'),outputMint=address(input.outputMint,'output mint');
 const allowed=new Set(config.quoteAssets.map(a=>a.mint));
 if(inputMint===outputMint||(!allowed.has(inputMint)&&!allowed.has(outputMint)))fail('One swap leg must use this product’s permitted quote assets.');
 if(typeof input.amount!=='string'||!/^([1-9]\d{0,19})$/.test(input.amount)||BigInt(input.amount)>18446744073709551615n)fail('Supply a positive u64 base-unit amount as a string.');
 const slippageBps=input.slippageBps??100;if(!Number.isInteger(slippageBps)||slippageBps<1||slippageBps>300)fail('Slippage must be 1–300 basis points.');
 return {wallet,inputMint,outputMint,amount:input.amount,slippageBps};
}
export function validateQuote(q,r){
 if(!q||q.inputMint!==r.inputMint||q.outputMint!==r.outputMint||q.inAmount!==r.amount||q.swapMode!=='ExactIn'||q.slippageBps!==r.slippageBps||!Array.isArray(q.routePlan)||!q.routePlan.length)fail('Router quote does not match the request.',502);
 if(q.platformFee&&(String(q.platformFee.amount)!=='0'||Number(q.platformFee.feeBps||0)!==0))fail('Unexpected platform fee was refused.',502);
 if(!/^[1-9]\d{0,19}$/.test(String(q.outAmount))||!/^[1-9]\d{0,19}$/.test(String(q.otherAmountThreshold)))fail('No positive bounded minimum output was quoted.',502);
 const quoted=BigInt(q.outAmount),min=BigInt(q.otherAmountThreshold);
 if(quoted>18446744073709551615n||min>quoted||min<quoted*BigInt(10000-r.slippageBps)/10000n)fail('Minimum output is outside the selected slippage bounds.',502);
 return min;
}
export function createSwapBuilder({config,connection,infrastructure,fetcher=fetch,simulate=simulateSwap,now=Date.now}){
 const remote=async(url,options={})=>{let response;try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(25000)});}catch{fail('Swap router could not be reached. Try again.',503);}if(!response.ok)fail('Swap router has no available response. Check funding and route availability.',502);try{return await response.json();}catch{fail('Swap router returned an invalid response.',502);}};
 return async input=>{
  const request=validateSwap(input,config);
  if(!config.tradingEnabled||!config.rpcUrl||!config.jupiterKey)fail('Operator must configure this deployment’s RPC, router key and trading switch.',503);
  if(!(await infrastructure.status()).ok)fail('Solana mainnet RPC verification failed.',503);
  const mints=await infrastructure.verifyMints([request.inputMint,request.outputMint]);if(mints.some(mint=>!mint))fail('Both swap assets must be verified Solana mints.');
  const headers={'x-api-key':config.jupiterKey};
  const query=new URLSearchParams({...request});query.delete('wallet');query.set('slippageBps',String(request.slippageBps));query.set('restrictIntermediateTokens','true');query.set('instructionVersion','V2');
  const quote=await remote(`https://api.jup.ag/swap/v1/quote?${query}`,{headers});const minimum=validateQuote(quote,request);
  const built=await remote('https://api.jup.ag/swap/v1/swap',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({quoteResponse:quote,userPublicKey:request.wallet,wrapAndUnwrapSol:true,useSharedAccounts:false,dynamicComputeUnitLimit:true,dynamicSlippage:false,prioritizationFeeLamports:{priorityLevelWithMaxLamports:{maxLamports:500000,priorityLevel:'high'}}})});
  if(built.simulationError||!Number.isSafeInteger(built.lastValidBlockHeight)||built.lastValidBlockHeight<=0||typeof built.swapTransaction!=='string'||built.swapTransaction.length>2000)fail('Router could not build a valid transaction.',502);
  let tx;try{tx=VersionedTransaction.deserialize(Buffer.from(built.swapTransaction,'base64'));}catch{fail('Router returned invalid transaction bytes.',502);}
  if(tx.serialize().length>1232||tx.signatures.some(signature=>signature.some(byte=>byte!==0)))fail('Only unsigned single-packet transactions are accepted.',502);
  const budget=checkComputeBudget(tx,TRADE_COMPUTE_CAPS);
  const intent={inputMint:request.inputMint,outputMint:request.outputMint,inputAmount:BigInt(request.amount),minOutput:minimum};
  const sim=await simulate(connection,tx,new PublicKey(request.wallet),intent);
  const cap=request.inputMint===SOL?BigInt(request.amount)+SWAP_OVERHEAD_CAP_LAMPORTS:request.outputMint===SOL?SWAP_OVERHEAD_CAP_LAMPORTS-minimum:LEG_CAP_LAMPORTS;
  if(sim.err||typeof sim.cost!=='bigint'||sim.cost>cap)fail('Swap simulation failed its balance or network-cost checks. Nothing was signed.',422);
  return {product:config.product,request,quote,transaction:built.swapTransaction,lastValidBlockHeight:built.lastValidBlockHeight,expiresAt:now()+45000,simulation:{ok:true,solCostLamports:String(sim.cost),priorityLamportsMax:String(budget.priorityLamports)}};
 };
}
