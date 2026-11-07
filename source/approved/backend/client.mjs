import {Buffer} from 'buffer';
import {getBrowserWallet} from './browser-wallet.mjs';
export {mountCreator} from './launch-provider.mjs';
import bs58 from 'bs58';
import {Connection,PublicKey,VersionedTransaction} from '@solana/web3.js';
import {getMint,TOKEN_PROGRAM_ID,TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import {simulateSwap} from './framework/third_party/sapling/swapguard.js';
import {checkComputeBudget,TRADE_COMPUTE_CAPS} from './framework/server/api-v1/guard.mjs';
import {checkCost,SWAP_OVERHEAD_CAP_LAMPORTS,LEG_CAP_LAMPORTS,lamportsText} from './framework/third_party/sapling/costcap.js';
import {confirmByPolling} from './framework/third_party/sapling/confirm.js';
import {units,displayUnits} from './framework/shared/chain.js';
import {MAINNET_GENESIS} from './config.mjs';
import {validateQuote} from './swaps.mjs';
import {tradeHops} from './routes.mjs';
const SOL='So11111111111111111111111111111111111111112';
const el=(tag,text)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;return node;};
const equal=(a,b)=>a.length===b.length&&a.every((byte,i)=>byte===b[i]);

export function mount({target,token,fundingMint,fundingSymbol,side,deployment,onStatus=()=>{},apiBase='/api',getWallet:getWalletOverride,storageNamespace=deployment.product,showBalance=false}){
 let alive=true,wallet=null,plan=null,busy=false;const storageKey=`${storageNamespace}.pending-swap.v1`,recoveryKey=`${storageNamespace}.trade-recovery.v1`;
 const rpc=new Connection(new URL(`${apiBase}/rpc`,location.href).href,{commitment:'confirmed',disableRetryOnRateLimit:true,fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(25000)})});
 const form=el('form');form.className='direct-swap';
 const heading=el('h3',`${side==='buy'?'Buy':'Sell'} ${token.symbol}`);const note=el('p','Your pad’s backend builds the route. Your wallet signs only after a separate review.');
 const connect=el('button','Connect wallet');connect.type='button';
 const label=el('label',`Amount to ${side==='buy'?'pay':'sell'} (${side==='buy'?fundingSymbol:token.symbol})`);const amount=el('input');amount.id='direct-swap-amount';amount.name='amount';amount.inputMode='decimal';amount.autocomplete='off';amount.placeholder='0.00';amount.required=true;amount.maxLength=40;label.htmlFor=amount.id;
 const slipLabel=el('label','Maximum slippage');const slip=el('select');slip.id='direct-swap-slippage';slip.name='slippageBps';slipLabel.htmlFor=slip.id;for(const [value,text] of [[50,'0.5%'],[100,'1%'],[300,'3%']]){const option=el('option',text);option.value=String(value);slip.append(option);}slip.value='100';
 const review=el('button','Review swap');review.type='submit';review.className='primary';
  const summary=el('div');summary.className='notice';summary.hidden=true;
  const quotePanel=el('section');quotePanel.className='swap-quote-panel';quotePanel.hidden=true;const quoteHeading=el('h4','Verified route preview');const quoteMinimum=el('p');const quoteRoute=el('small');const quoteFee=el('small');quotePanel.append(quoteHeading,quoteMinimum,quoteRoute,quoteFee);
 const approve=el('button','Approve in wallet');approve.type='button';approve.className='primary';approve.hidden=true;
 const pendingButton=el('button','Check pending transaction');pendingButton.type='button';pendingButton.hidden=true;
 const resume=el('button','Review remaining conversion');resume.type='button';resume.hidden=true;
 const status=el('p');status.setAttribute('role','status');status.className='swap-status';
 const setStatus=text=>{if(alive){status.textContent=text;onStatus(text);}};
 const pending=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null');}catch{throw new Error('Browser storage is unavailable. Enable storage before trading so pending transactions can be tracked.');}};
 const recovery=()=>{try{return JSON.parse(localStorage.getItem(recoveryKey)||'null');}catch{throw new Error('Browser storage cannot read the conversion recovery record.');}};
 const complete=item=>{if(item.next)localStorage.setItem(recoveryKey,JSON.stringify(item.next));if(item.finishesRecovery)localStorage.removeItem(recoveryKey);localStorage.removeItem(storageKey);resume.hidden=!recovery();};
  const invalidate=()=>{plan=null;approve.hidden=true;summary.hidden=true;quotePanel.hidden=true;};
 const loading=value=>{busy=value;review.disabled=value||!deployment.tradingConfigured;connect.disabled=value;approve.disabled=value;amount.disabled=value;slip.disabled=value;pendingButton.disabled=value;resume.disabled=value||!deployment.tradingConfigured;};
  const getWallet=getWalletOverride||getBrowserWallet;
  let available=0n,availableDecimals=0;
  const exactBalance=(value,decimals)=>decimals===0?value.toString():displayUnits(value,decimals);
   const balance=el('small','Connect wallet to see balance'),max=el('button','Max'),amountTools=el('div');amountTools.className='purr-amount-tools';max.type='button';max.disabled=true;amountTools.append(balance,max);const amountPanel=el('div');amountPanel.className='swap-amount-panel';amountPanel.append(label,amount,amountTools);const slipPanel=el('div');slipPanel.className='swap-slippage-panel';slipPanel.append(slipLabel,slip);
  async function refreshBalance(){
   max.disabled=true;const address=wallet?.publicKey?.toBase58();if(!address)return;
   try{const inputMint=side==='buy'?fundingMint:token.mint;let raw;
    if(inputMint===SOL){const value=await rpc.getBalance(new PublicKey(address),'confirmed');if(!Number.isSafeInteger(value))throw new Error('Balance exceeds exact numeric range.');raw=BigInt(value);availableDecimals=9;available=raw>SWAP_OVERHEAD_CAP_LAMPORTS?raw-SWAP_OVERHEAD_CAP_LAMPORTS:0n;}
    else{const info=await mint(inputMint);availableDecimals=info.decimals;const accounts=await rpc.getParsedTokenAccountsByOwner(new PublicKey(address),{mint:new PublicKey(inputMint)},'confirmed');raw=accounts.value.reduce((sum,row)=>sum+BigInt(row.account.data.parsed.info.tokenAmount.amount),0n);available=raw;}
    if(!alive||wallet.publicKey?.toBase58()!==address)return;balance.textContent=`Balance ${exactBalance(raw,availableDecimals)} ${side==='buy'?fundingSymbol:token.symbol}`;max.disabled=false;
   }catch{if(alive)balance.textContent='Balance unavailable';}
  }
  max.addEventListener('click',()=>{if(busy||max.disabled)return;amount.value=exactBalance(available,availableDecimals);invalidate();});
 async function verifyNetwork(){if(await rpc.getGenesisHash()!==MAINNET_GENESIS)throw new Error('RPC is not Solana mainnet. Nothing was signed.');}
 async function mint(mintAddress){const pubkey=new PublicKey(mintAddress),info=await rpc.getAccountInfo(pubkey,'confirmed');if(!info||![TOKEN_PROGRAM_ID,TOKEN_2022_PROGRAM_ID].some(program=>program.equals(info.owner)))throw new Error('Token mint is missing or unsupported.');return getMint(rpc,pubkey,'confirmed',info.owner);}
  connect.addEventListener('click',async()=>{if(busy)return;loading(true);try{wallet=await getWallet();if(alive){connect.textContent=`Connected ${wallet.publicKey.toBase58().slice(0,6)}…`;setStatus('Wallet connected. Enter an amount and review the swap.');if(showBalance)await refreshBalance();}}catch(e){setStatus(e.message);}finally{if(alive)loading(false);}});
 amount.addEventListener('input',invalidate);slip.addEventListener('change',invalidate);
 async function reviewTrade(resuming=false){if(busy||!deployment.tradingConfigured)return;invalidate();loading(true);try{
  if(pending()){pendingButton.hidden=false;throw new Error('A previous swap is pending. Check its signature before creating another.');}
  const waiting=recovery();if(waiting&&!resuming){resume.hidden=false;throw new Error('A funding conversion is waiting. Reopen the same token, direction and funding asset to review its remaining step.');}
  wallet=await getWallet();await verifyNetwork();if(!alive)return;
  const hops=tradeHops({tokenMint:token.mint,fundingMint,side,quoteAssets:deployment.quoteAssets,preferredQuote:deployment.preferredQuote,pairedLeveragedMints:token.pairedLeveragedMints});
  if(resuming&&(!waiting||waiting.wallet!==wallet.publicKey.toBase58()||waiting.tokenMint!==token.mint||waiting.fundingMint!==fundingMint||waiting.side!==side||hops.length!==3||waiting.inputMint!==hops[1]||waiting.outputMint!==hops[2]))throw new Error('Connect the original wallet and select the original token, direction and funding asset to resume.');
  const inputMint=resuming?hops[1]:hops[0],outputMint=resuming?hops[2]:hops[1];
  const [inputInfo,outputInfo]=await Promise.all([mint(inputMint),mint(outputMint)]);
  const request={wallet:wallet.publicKey.toBase58(),inputMint,outputMint,amount:resuming?waiting.amount:units(amount.value,inputInfo.decimals).toString(),slippageBps:Number(slip.value)};
  if(BigInt(request.amount)<=0n)throw new Error('Enter an amount above zero.');
   setStatus('Building and simulating your route…');const response=await fetch(`${apiBase}/swap/build`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(60000)});const built=await response.json();if(!response.ok)throw new Error(built.error||'Route is unavailable.');
  if(built.product!==deployment.product)throw new Error('Backend belongs to another pad. Nothing was signed.');
  const minimum=validateQuote(built.quote,request);const tx=VersionedTransaction.deserialize(Buffer.from(built.transaction,'base64'));if(tx.signatures.some(s=>s.some(byte=>byte!==0)))throw new Error('A pre-signed transaction was refused.');checkComputeBudget(tx,TRADE_COMPUTE_CAPS);
  const intent={inputMint,outputMint,inputAmount:BigInt(request.amount),minOutput:minimum};const cap=inputMint===SOL?intent.inputAmount+SWAP_OVERHEAD_CAP_LAMPORTS:outputMint===SOL?SWAP_OVERHEAD_CAP_LAMPORTS-minimum:LEG_CAP_LAMPORTS;
  const sim=await simulateSwap(rpc,tx,new PublicKey(request.wallet),intent);checkCost(sim,cap);
  if(!alive)return;if(!Number.isSafeInteger(built.expiresAt)||built.expiresAt<=Date.now()||!Number.isSafeInteger(built.lastValidBlockHeight))throw new Error('Quote expired. Review a fresh swap.');
  const next=!resuming&&hops.length===3?{product:deployment.product,wallet:request.wallet,tokenMint:token.mint,fundingMint,side,inputMint:hops[1],outputMint:hops[2],amount:String(minimum)}:null;
  plan={request,tx,intent,cap,next,finishesRecovery:resuming,expiresAt:Math.min(built.expiresAt,Date.now()+45000),lastValidBlockHeight:built.lastValidBlockHeight};
  const outputSymbol=deployment.quoteAssets.find(a=>a.mint===outputMint)?.symbol||(outputMint===token.mint?token.symbol:fundingSymbol);
    const minimumText=`${displayUnits(minimum,outputInfo.decimals)} ${outputSymbol}`;summary.replaceChildren(el('span',next?'Step 1 of 2. The second swap needs a separate review and signature. If you stop, the intermediate tokens stay in your wallet.':resuming?'Step 2 of 2.':''),' ',el('span',`Minimum receive: ${minimumText}. Simulated network/rent cost: ${lamportsText(sim.cost)}. Platform swap fee: 0. Output mint: ${outputMint}.`));summary.hidden=false;quoteMinimum.textContent=`Minimum receive · ${minimumText}`;quoteRoute.textContent=`Route verified · ${inputMint} → ${outputMint}`;quoteFee.textContent=`Network/rent estimate · ${lamportsText(sim.cost)} · Platform swap fee · 0`;quotePanel.hidden=false;approve.hidden=false;setStatus('Route verified. No transaction has been signed or sent.');
 }catch(e){setStatus(e.message);}finally{if(alive)loading(false);}}
 form.addEventListener('submit',event=>{event.preventDefault();reviewTrade(false);});resume.addEventListener('click',()=>reviewTrade(true));
 approve.addEventListener('click',async()=>{if(busy||!plan)return;loading(true);const current=plan;try{
  if(pending())throw new Error('A previous swap is still pending.');if(Date.now()>=current.expiresAt)throw new Error('Quote expired. Review a fresh swap.');
  if(wallet?.publicKey?.toBase58()!==current.request.wallet)throw new Error('Wallet changed. Review a fresh swap.');await verifyNetwork();
  const sim=await simulateSwap(rpc,current.tx,new PublicKey(current.request.wallet),current.intent);checkCost(sim,current.cap);if(!alive)return;
  if(Date.now()>=current.expiresAt)throw new Error('Quote expired. Review a fresh swap.');const original=current.tx.message.serialize();
  setStatus('Review and approve in your wallet…');const signed=await wallet.signTransaction(current.tx);
  if(!equal(original,signed.message.serialize()))throw new Error('Wallet changed the transaction message. Nothing was sent.');
  if(!alive)throw new Error('Trade selection changed. Signed transaction was not submitted.');if(wallet.publicKey?.toBase58()!==current.request.wallet||Date.now()>=current.expiresAt)throw new Error('Wallet changed or quote expired. Nothing was sent.');
  const signature=bs58.encode(signed.signatures[0]);if(!signed.signatures[0].some(byte=>byte!==0))throw new Error('Wallet did not sign.');
  const receipt={product:deployment.product,wallet:current.request.wallet,signature,lastValidBlockHeight:current.lastValidBlockHeight,next:current.next,finishesRecovery:current.finishesRecovery};localStorage.setItem(storageKey,JSON.stringify(receipt));pendingButton.hidden=false;
  // Persist signature before submitting. An ambiguous network result must never invite a blind retry.
  await rpc.sendRawTransaction(signed.serialize(),{skipPreflight:false,maxRetries:2});setStatus(`Submitted ${signature}. Waiting for confirmation…`);
  await confirmByPolling(rpc,signature,current.lastValidBlockHeight);complete(receipt);pendingButton.hidden=true;invalidate();setStatus(current.next?`Funding conversion confirmed: ${signature}. Review the remaining conversion separately.`:`Swap confirmed: ${signature}`);
 }catch(e){if(e.definitive){localStorage.removeItem(storageKey);pendingButton.hidden=true;}invalidate();setStatus(e.message);}finally{if(alive)loading(false);}});
 pendingButton.addEventListener('click',async()=>{if(busy)return;loading(true);try{const item=pending();if(!item){pendingButton.hidden=true;return;}await verifyNetwork();await confirmByPolling(rpc,item.signature,item.lastValidBlockHeight,{timeoutMs:15000});complete(item);pendingButton.hidden=true;setStatus(item.next?`Funding conversion confirmed: ${item.signature}. Reopen its original token and funding asset to review the remaining step.`:`Swap confirmed: ${item.signature}`);}catch(e){if(e.definitive){localStorage.removeItem(storageKey);pendingButton.hidden=true;}setStatus(e.message);}finally{if(alive)loading(false);}});
 if(!deployment.tradingConfigured){review.disabled=true;note.textContent='Trading is paused. The operator must configure this pad’s RPC, routing key and trading switch.';}
 try{pendingButton.hidden=!pending();resume.hidden=!recovery();resume.disabled=!deployment.tradingConfigured;}catch(e){review.disabled=true;setStatus(e.message);}
   form.append(heading,note,connect,amountPanel,slipPanel,quotePanel,review,summary,approve,pendingButton,resume,status);target.replaceChildren(form);
  if(showBalance)amount.after(amountTools);
 return ()=>{alive=false;plan=null;};
}
