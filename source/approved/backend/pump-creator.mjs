import {Buffer} from 'buffer';
import bs58 from 'bs58';
import {Connection,Keypair,PublicKey,TransactionMessage,VersionedTransaction,ComputeBudgetProgram} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID,TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import {PUMP_SDK,PUMP_PROGRAM_ID,GLOBAL_PDA,OnlinePumpSdk,bondingCurvePda} from '@pump-fun/pump-sdk';
import {PUMP_CREATOR_FEE_BPS,pumpCreatorFeeSupport,pumpSimulatedSolCost} from './pump-policy.mjs';
import {simulate} from './framework/server/api-v1/guard.mjs';
import {confirmByPolling} from './framework/third_party/sapling/confirm.js';
import {signLaunchWalletFirst,persistLaunchPending,encodeLaunchArtwork} from './creator-client.mjs';
import {MAINNET_GENESIS} from './config.mjs';
import {creatorWalletAddress,resolveCreatorWallet} from './creator-wallet.mjs';
const node=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
const equal=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
export async function validatePumpEnvelope({built,request,product,programId,now=Date.now()}){
  const payee=creatorWalletAddress(request.payee??request.wallet,request.mint);
  if(built?.product!==product||built.kind!=='direct-pump-launch'||built.provider!=='pump'||built.unsigned!==true||built.wallet!==request.wallet||built.mint!==request.mint||built.payee!==payee||built.quote?.mint!==request.quoteMint||built.creatorFeeBps!==PUMP_CREATOR_FEE_BPS||built.launchFeeLamports!=='0'||built.maxSolCostLamports!==null||built.simulation?.ok!==true||!/^\d+$/.test(built.simulation?.solCostLamports??'')||built.signers?.length!==2||built.signers[0]!==request.wallet||built.signers[1]!==request.mint||!Number.isSafeInteger(built.expiresAt)||built.expiresAt<=now||built.expiresAt>now+60000||!Number.isSafeInteger(built.lastValidBlockHeight)||built.lastValidBlockHeight<0)throw new Error('Pump response identity, fees, signers or expiry mismatch. Nothing was signed.');
 const creator=new PublicKey(payee),curve=bondingCurvePda(new PublicKey(request.mint));if(built.creator!==payee||built.curve!==curve.toBase58())throw new Error('Pump creator or curve address mismatch.');
 const create=await PUMP_SDK.createV2Instruction({mint:new PublicKey(request.mint),name:request.name,symbol:request.symbol,uri:request.uri,creator,user:new PublicKey(request.wallet),mayhemMode:false,cashback:false,holderReward:false,creatorFeeBps:PUMP_CREATOR_FEE_BPS,quoteMint:new PublicKey(request.quoteMint),quoteTokenProgram:TOKEN_PROGRAM_ID});
 const instructions=[ComputeBudgetProgram.setComputeUnitLimit({units:400000}),ComputeBudgetProgram.setComputeUnitPrice({microLamports:20000}),create];
 const tx=VersionedTransaction.deserialize(Buffer.from(built.transaction,'base64'));if(tx.version!==0||tx.signatures.length!==2||tx.signatures.some(s=>s.some(Boolean)))throw new Error('Pre-signed or unsupported Pump transaction refused.');
 const expected=new TransactionMessage({payerKey:new PublicKey(request.wallet),recentBlockhash:tx.message.recentBlockhash,instructions}).compileToV0Message();if(!equal(tx.message.serialize(),expected.serialize()))throw new Error('Pump transaction differs from locally reconstructed instructions. Nothing was signed.');return tx;
}
export async function verifyPumpSimulation({rpc,tx,request,programId}){
 const [globalInfo,quote]=await Promise.all([rpc.getAccountInfo(GLOBAL_PDA,'confirmed'),new OnlinePumpSdk(rpc).resolveQuoteMint(new PublicKey(request.quoteMint))]);
 if(!globalInfo?.owner.equals(PUMP_PROGRAM_ID)||quote.mint.toBase58()!==request.quoteMint||!quote.quoteTokenProgram.equals(TOKEN_PROGRAM_ID))throw new Error('Independent Pump fee-policy or quote-program verification failed.');
 const support=pumpCreatorFeeSupport(PUMP_SDK.decodeGlobal(globalInfo),quote);if(!support.ok)throw new Error(support.reason);
 const creator=new PublicKey(creatorWalletAddress(request.payee??request.wallet,request.mint)),curve=bondingCurvePda(new PublicKey(request.mint));const sim=await simulate(rpc,tx,[request.wallet,request.mint,curve.toBase58()]);
 const [,mint,curveInfo]=sim.after;const decoded=curveInfo?.owner===PUMP_PROGRAM_ID.toBase58()?PUMP_SDK.decodeBondingCurveNullable({owner:PUMP_PROGRAM_ID,data:curveInfo.data}):null;
  if(mint?.owner!==TOKEN_2022_PROGRAM_ID.toBase58()||!decoded?.creator.equals(creator)||decoded.quoteMint.toBase58()!==request.quoteMint||decoded.creatorFeeBps.toString()!==String(PUMP_CREATOR_FEE_BPS)||decoded.complete)throw new Error('Independent Pump simulation rejected mint, curve, quote or creator fees.');return pumpSimulatedSolCost(sim.before[0],sim.after[0]);
}
export function mountPumpCreator({target,product,getDraft,getQuoteMint=()=>getDraft()?.quoteMint,onQuotes=()=>{},isActive=()=>true,connectWallet,apiBase='/api',getWallet,storageNamespace=product,compact=false,hasAccount=()=>true}){
 let alive=true,generation=0,busy=false,readiness=null,quotes=[],plan=null,wallet=null;const key=`${storageNamespace}.pending-pump-launch.v1`;
 const rpc=new Connection(new URL(`${apiBase}/rpc`,location.href).href,{commitment:'confirmed',disableRetryOnRateLimit:true,fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(30000)})});
 const title=node('h2','Review launch'),note=node('p','Solana execution. A 3% native creator trading fee applies to each buy and sell on supported Pump custom-quote pairs and goes directly to the creator. Protocol and network fees are separate. This does not tax ordinary wallet transfers or enable automatic xHYPE rewards. SOL/USDC use their standard fee schedule and cannot use this fixed-3% launch mode.');
 const feeLabel=node('p','3% buy / 3% sell · creator trading fee');feeLabel.className='pump-creator-fee';
 const state=node('p','Checking quote support…');state.setAttribute('role','status');state.className='pump-readiness';const quotesList=node('ul');quotesList.className='pump-quote-status';const refresh=node('button','Refresh Pump readiness');refresh.type='button';
  const risk=node('p','Launching spends real SOL on fees and account rent. No per-launch spend cap is imposed. Review simulated costs and your wallet before signing. Tokens can lose all value; liquidity and successful trading are not guaranteed. Published metadata may remain public even if you cancel.');
  const protocol=node('details');protocol.className='pump-protocol-details';const protocolSummary=node('summary','Quote availability');protocol.append(protocolSummary,quotesList,refresh);const selectedQuote=node('p');selectedQuote.className='pump-selected-quote';
 const form=node('form');form.className='launch-live-form';const consent=node('input');consent.type='checkbox';consent.id='pump-metadata-consent';const label=node('label');label.htmlFor=consent.id;label.append(consent,' Publish my token artwork and metadata publicly before transaction review.');
  const review=node('button','Upload metadata & review Pump launch');review.type='submit';review.className='primary';review.disabled=true;const approve=node('button','Approve Pump launch in wallet');approve.type='button';approve.hidden=true;approve.className='primary';const pending=node('button','Check pending Pump launch');pending.type='button';const summary=node('div');summary.className='notice';summary.hidden=true;const status=node('p');status.setAttribute('role','status');form.append(label,review,summary,approve,pending,status);target.replaceChildren(title,feeLabel,note,risk,state,selectedQuote,protocol,form);
  if(compact){const details=node('details');details.className='purr-form-details';details.append(node('summary','Fees'),note,risk,selectedQuote,protocol);title.remove();target.replaceChildren(feeLabel,node('p','Total: network fees and account rent, estimated at review.'),state,form,details);review.textContent='Create coin';approve.textContent='Continue to wallet';}
  const current=()=>alive&&isActive();const readPending=()=>{const raw=localStorage.getItem(key);if(!raw)return null;const receipt=JSON.parse(raw);if(receipt.product!==product||receipt.provider!=='pump'||typeof receipt.signature!=='string'||!Number.isSafeInteger(receipt.lastValidBlockHeight))throw new Error('Stored Pump receipt is invalid; it was not discarded.');return receipt;};
  const supported=()=>{const q=quotes.find(q=>q.mint===getQuoteMint());return q?.admitted===true&&q?.admissionVerified===true&&q?.launchSupported===true;};
 const enabled=()=>Boolean(readiness?.enabled&&supported());
   function reset(){generation++;plan=null;approve.hidden=true;summary.hidden=true;const draft=getDraft(),quote=quotes.find(row=>row.mint===getQuoteMint());review.disabled=busy||!enabled()||!draft;if(compact)review.textContent=!enabled()?'Unavailable':!draft?'Add coin details':hasAccount()?'Create coin':'Connect wallet';selectedQuote.textContent=supported()?`${quote.symbol} pair · available for this launch mode`:`${quote?.symbol||'Selected quote'}: ${quote?.reason||'quote support has not been verified'}`;if(readiness)state.textContent=!readiness.enabled?'Publishing is paused. Metadata storage and launch activation are required.':!supported()?selectedQuote.textContent:`${quote.symbol} is available. ${draft?'Review your launch in your wallet.':'Add your coin name, symbol and artwork to continue.'}`;}
  const loading=value=>{busy=value;consent.disabled=refresh.disabled=approve.disabled=pending.disabled=value;review.disabled=value||!enabled()||!getDraft();};
 const json=async(path,body)=>{const endpoint=apiBase+(path==='/api/launch/build'?'/pump/build':path.slice(4));const response=await fetch(endpoint,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Pump service unavailable.');return result;};
 async function network(){if(await rpc.getGenesisHash()!==MAINNET_GENESIS)throw new Error('RPC is not Solana mainnet. Nothing was signed.');}
 async function check(){
   refresh.disabled=true;readiness=null;quotes=[];reset();state.textContent='Checking quote support…';
  try{
   const [deployment,cap,admission]=await Promise.all([json('/api/deployment'),json('/api/capabilities'),json('/api/pump/quotes')]);
   if(!current())return;if([deployment,cap,admission].some(r=>r.product!==product))throw new Error('Wrong product backend.');
    quotes=admission.quotes;onQuotes(quotes);readiness={enabled:Boolean(deployment.rpcVerified&&cap.launchBuildSwitch&&cap.metadataUploadConfigured&&admission.launchSwitch)};
   quotesList.replaceChildren(...[...quotes].sort((a,b)=>Number(b.symbol.includes('HYPE'))-Number(a.symbol.includes('HYPE'))).map(q=>node('li',`${q.symbol}: ${q.launchSupported?'protocol admission verified':q.reason||'not available'}`)));
   state.textContent=readiness.enabled?'Ready for metadata upload and a separate wallet review.':'Publishing is paused in this preview. Metadata storage and operator activation are required.';reset();
  }catch(e){if(current())state.textContent=`Pump checks unavailable: ${e.message} Local drafts still work.`;}
  finally{if(current())refresh.disabled=false;}
 }
 function links(receipt){const link=node('a','Inspect transaction ↗');link.href=`https://solscan.io/tx/${receipt.signature}`;link.target='_blank';link.rel='noopener noreferrer';status.append(' ',link);}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;reset();const intent=generation;loading(true);
  try{
   if(readPending())throw new Error('Check the existing pending Pump signature before creating another token.');
   if(!enabled())throw new Error('This quote or operator is not ready for Pump creation.');
   if(compact&&!hasAccount()){await getWallet();return;}
   const draft=getDraft();if(!draft)throw new Error('Review your token draft first.');
   if(!consent.checked)throw new Error('Public metadata upload requires explicit consent.');
   if(new TextEncoder().encode(draft.name).length>32||draft.description.length>280)throw new Error('Live metadata requires a name within 32 UTF-8 bytes and description within 280 characters.');
   const image=await encodeLaunchArtwork(draft.image);if(connectWallet)await connectWallet();
     wallet=getWallet?await getWallet():await (await import('./browser-wallet.mjs')).getBrowserWallet();
   if(!wallet.publicKey)await wallet.connect();await network();const address=wallet.publicKey?.toBase58();if(!address)throw new Error('Wallet connection was not completed.');
   const mintKeypair=Keypair.generate(),request={wallet:address,mint:mintKeypair.publicKey.toBase58(),name:draft.name,symbol:draft.symbol,quoteMint:draft.quoteMint,payee:resolveCreatorWallet(draft,address,mintKeypair.publicKey.toBase58())};
   if(intent!==generation||!current())throw new Error('Draft changed. Review again.');
   status.textContent='Publishing the metadata you approved…';const metadata=await json('/api/metadata',{name:draft.name,symbol:draft.symbol,description:draft.description,image});
   if(intent!==generation||!current())throw new Error('Draft changed. Nothing was signed; published metadata may remain public.');
   request.uri=metadata.uri;const built=await json('/api/pump/build',request),tx=await validatePumpEnvelope({built,request,product});
    const independentCost=await verifyPumpSimulation({rpc,tx,request});if(independentCost!==BigInt(built.simulation.solCostLamports))throw new Error('Simulated cost changed. Review again.');if(intent!==generation||!current())throw new Error('Draft changed. Review again.');
   plan={built,tx,request,mintKeypair,intent};
   summary.replaceChildren(...[
    `${request.name} (${request.symbol}) · ${request.mint}`,
    `Pump.fun on Solana. Quote mint: ${request.quoteMint}. No creator buy.`,
    `Signing wallet / deployer: ${request.wallet}. Creator fee recipient: ${request.payee}.`,
    'Creator trading fee: 3% on each buy and 3% on each sell, paid directly to the selected creator wallet. Pump protocol fees are additional. Ordinary wallet transfers are not taxed; automatic holder rewards are not enabled.',
     `Simulated payer cost: ${Number(built.simulation.solCostLamports)/1e9} SOL. No operator spend cap. This is an estimate, not a fixed charge; review your wallet before signing.`
   ].map(text=>node('p',text)));
   summary.hidden=false;approve.hidden=false;status.textContent='Review this Pump launch. Nothing has been signed or sent.';
  }catch(e){plan=null;approve.hidden=true;status.textContent=e.message;}
  finally{if(current()){loading(false);try{pending.hidden=!readPending();}catch(e){status.textContent=e.message;review.disabled=true;}}}
 });
 approve.addEventListener('click',async()=>{if(busy||!plan)return;const launch=plan;loading(true);try{if(readPending())throw new Error('A Pump launch is already pending.');await network();await verifyPumpSimulation({rpc,tx:launch.tx,request:launch.request,programId:launch.programId});const signed=await signLaunchWalletFirst({wallet,tx:launch.tx,mintKeypair:launch.mintKeypair,expectedWallet:launch.request.wallet,expiresAt:launch.built.expiresAt,isCurrent:()=>current()&&generation===launch.intent});const receipt={product,provider:'pump',wallet:launch.request.wallet,mint:launch.request.mint,quoteMint:launch.request.quoteMint,signature:bs58.encode(signed.signatures[0]),lastValidBlockHeight:launch.built.lastValidBlockHeight,createdAt:Date.now()};persistLaunchPending(localStorage,key,receipt);plan=null;approve.hidden=true;pending.hidden=false;await rpc.sendRawTransaction(signed.serialize(),{skipPreflight:false,maxRetries:2});status.textContent='Pump launch submitted; checking its existing signature…';links(receipt);await confirmByPolling(rpc,receipt.signature,receipt.lastValidBlockHeight);localStorage.removeItem(key);pending.hidden=true;status.textContent=`Pump launch confirmed. Mint ${receipt.mint}.`;links(receipt);}catch(e){plan=null;approve.hidden=true;if(e.definitive)localStorage.removeItem(key);status.textContent=e.message;try{const receipt=readPending();pending.hidden=!receipt;if(receipt)links(receipt);}catch{review.disabled=true;}}finally{if(current())loading(false);}});
 pending.addEventListener('click',async()=>{if(busy)return;loading(true);try{const receipt=readPending();if(!receipt){pending.hidden=true;return;}await network();await confirmByPolling(rpc,receipt.signature,receipt.lastValidBlockHeight,{timeoutMs:15000});localStorage.removeItem(key);pending.hidden=true;status.textContent=`Pump launch confirmed. Mint ${receipt.mint}.`;links(receipt);}catch(e){if(e.definitive){localStorage.removeItem(key);pending.hidden=true;}status.textContent=e.message;}finally{if(current())loading(false);}});
 refresh.addEventListener('click',check);consent.addEventListener('change',reset);try{pending.hidden=!readPending();}catch(e){status.textContent=e.message;pending.hidden=true;}check();return {update:reset,cancel:reset,destroy(){alive=false;reset();}};
}
