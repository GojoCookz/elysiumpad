// Simulation only. Actual source-token prices, never an underlying price times leverage.
export const PAPER_VERSION=1;
export const QUOTE_MAX_AGE_MS=120000;
const USD=1000000n,PRICE=1000000000000n,U64=18446744073709551615n;
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PRODUCTS=new Set(['bitcoin','hyper','solana','leveragepad']);
const PROGRAMS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const fail=message=>{throw new Error(message);};
const ceil=(a,b)=>(a+b-1n)/b;
const integer=value=>typeof value==='string'&&/^\d{1,60}$/.test(value);
export function decimalUnits(value,decimals){
 if(typeof value!=='string'||value.length>60||!/^\d+(\.\d+)?$/.test(value.trim()))fail('Enter a positive decimal amount without exponent notation.');
 const [whole,fraction='']=value.trim().split('.');if(fraction.length>decimals)fail(`Use at most ${decimals} decimal places.`);
 return BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
}
export function unitsText(value,decimals){const n=BigInt(value),negative=n<0n,x=negative?-n:n,base=10n**BigInt(decimals);return `${negative?'-':''}${x/base}${decimals?'.'+(x%base).toString().padStart(decimals,'0'):''}`.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');}
export const moneyText=value=>unitsText(value,6);
export function createAccount(product){if(!PRODUCTS.has(product))fail('Unknown paper product.');return {version:PAPER_VERSION,product,initialCashMicro:String(10000n*USD),feeBps:30,slippageBps:10,orders:[]};}
function costs(quantity,price,decimals,side,feeBps,slippageBps){
 const denominator=10n**BigInt(decimals)*1000000n*10000n;
 const numerator=quantity*price*BigInt(side==='buy'?10000+slippageBps:10000-slippageBps);
 const gross=side==='buy'?ceil(numerator,denominator):numerator/denominator;
 const fee=ceil(gross*BigInt(feeBps),10000n);
 return {gross,fee,net:side==='buy'?gross+fee:gross-fee};
}
export function portfolio(account){
 if(!account||account.version!==PAPER_VERSION||!PRODUCTS.has(account.product)||account.initialCashMicro!==String(10000n*USD)||account.feeBps!==30||account.slippageBps!==10||!Array.isArray(account.orders)||account.orders.length>2000)fail('Paper history is invalid or from an unsupported version. Reset only this demo to start again.');
 let cash=BigInt(account.initialCashMicro),realized=0n;const positions=new Map();
 for(const [index,order] of account.orders.entries()){
  if(!order||order.id!==`paper-${index+1}`||!['buy','sell'].includes(order.side)||!MINT.test(order.mint)||!Number.isInteger(order.decimals)||order.decimals<0||order.decimals>18||typeof order.symbol!=='string'||order.symbol.length>24||!integer(order.quantityUnits)||!integer(order.sourcePricePico)||!Number.isSafeInteger(order.time)||!Number.isSafeInteger(order.sourceTime))fail('Paper history is corrupt. No balances were substituted.');
  const quantity=BigInt(order.quantityUnits),price=BigInt(order.sourcePricePico);if(quantity<=0n||quantity>U64||price<=0n||price>1000000000n*PRICE)fail('Paper history contains an invalid fill.');
  const c=costs(quantity,price,order.decimals,order.side,account.feeBps,account.slippageBps);
  if(String(c.gross)!==order.grossMicro||String(c.fee)!==order.feeMicro||String(c.net)!==order.netMicro||c.net<=0n)fail('Paper history arithmetic does not match its recorded assumptions.');
  const position=positions.get(order.mint)||{mint:order.mint,symbol:order.symbol,decimals:order.decimals,assetClass:order.assetClass,quantity:0n,basis:0n};
  if(position.decimals!==order.decimals)fail('Recorded token decimals changed.');
  if(order.side==='buy'){
   if(c.net>cash||position.quantity+quantity>U64)fail('Paper history overspends its virtual balance.');cash-=c.net;position.quantity+=quantity;position.basis+=c.net;
  }else{
   if(quantity>position.quantity)fail('Paper history sells more units than it owns.');
   const basis=quantity===position.quantity?position.basis:position.basis*quantity/position.quantity;position.basis-=basis;position.quantity-=quantity;cash+=c.net;realized+=c.net-basis;
  }
  positions.set(order.mint,position);
 }
 return {cashMicro:String(cash),realizedMicro:String(realized),positions:[...positions.values()].filter(p=>p.quantity>0n).map(p=>({...p,quantityUnits:String(p.quantity),costBasisMicro:String(p.basis),quantity:undefined,basis:undefined}))};
}
function sourceToken(account,market,mint,now){
 if(!market||market.network!=='solana'||market.pad!==account.product||!Array.isArray(market.tokens))fail('Load this product’s Solana source markets first.');
 const sourceTime=Date.parse(market.checkedAt);if(!Number.isSafeInteger(now)||!Number.isFinite(sourceTime)||sourceTime>now+5000||now-sourceTime>QUOTE_MAX_AGE_MS)fail('Source prices are stale. Refresh markets before a paper fill.');
 const token=market.tokens.find(t=>t.mint===mint),verification=token?.verification;
 if(!token||!MINT.test(token.mint)||verification?.mint!==mint||!PROGRAMS.has(verification?.program)||!Number.isInteger(verification.decimals)||verification.decimals<0||verification.decimals>18)fail('This asset does not have a supported verified Solana mint.');
 if(typeof token.priceUsd!=='number'||!Number.isFinite(token.priceUsd)||token.priceUsd<=0||token.priceUsd>1000000000)fail('No usable source-token price is available.');
 const price=BigInt(Math.round(token.priceUsd*Number(PRICE)));if(price<=0n)fail('This source price is below demo precision.');
 return {token,price,sourceTime,decimals:verification.decimals};
}
export function previewTrade(account,{market,mint,side,spendUSD='',quantity='',now=Date.now()}){
 const state=portfolio(account);if(account.orders.length>=2000)fail('This demo has reached 2,000 fills. Reset the demo to start another session.');if(!['buy','sell'].includes(side))fail('Choose paper buy or paper sell.');
 const {token,price,sourceTime,decimals}=sourceToken(account,market,mint,now);let units;
 if(side==='buy'){
  const budget=decimalUnits(spendUSD,6);if(budget<=0n||budget>BigInt(state.cashMicro))fail('Choose a positive spend within your Demo USD balance.');
  const grossBudget=budget*10000n/BigInt(10000+account.feeBps);
  units=grossBudget*10n**BigInt(decimals)*1000000n*10000n/(price*BigInt(10000+account.slippageBps));
 }else{
  units=decimalUnits(quantity,decimals);const held=state.positions.find(p=>p.mint===mint);if(units<=0n||!held||units>BigInt(held.quantityUnits))fail('Choose a positive quantity within your paper holding. Short positions are not supported.');
 }
 if(units<=0n||units>U64)fail('Amount is too small or exceeds supported token units.');
 const c=costs(units,price,decimals,side,account.feeBps,account.slippageBps);if(c.net<=0n||c.gross<=0n)fail('Amount is below demo fill precision.');
 const order={id:`paper-${account.orders.length+1}`,side,mint,symbol:String(token.symbol||'TOKEN').slice(0,24),assetClass:token.assetClass||'discovery',decimals,quantityUnits:String(units),sourcePricePico:String(price),sourceTime,time:now,grossMicro:String(c.gross),feeMicro:String(c.fee),netMicro:String(c.net)};
 portfolio({...account,orders:[...account.orders,order]});return order;
}
export function executeTrade(account,request,reviewed){
 const order=previewTrade(account,request);
 const fields=['id','side','mint','quantityUnits','sourcePricePico','sourceTime','grossMicro','feeMicro','netMicro'];
 if(!reviewed||fields.some(field=>reviewed[field]!==order[field]))fail('Source price or order changed. Review a fresh paper fill.');
 return {...account,orders:[...account.orders,order]};
}
export function markPortfolio(account,market,now=Date.now()){
 const state=portfolio(account);let value=0n;const positions=state.positions.map(position=>{
  try{const {price,decimals}=sourceToken(account,market,position.mint,now);if(decimals!==position.decimals)throw new Error();const marked=BigInt(position.quantityUnits)*price/(10n**BigInt(decimals)*1000000n);value+=marked;return {...position,markedMicro:String(marked),unrealizedMicro:String(marked-BigInt(position.costBasisMicro)),markAvailable:true};}
  catch{return {...position,markedMicro:null,unrealizedMicro:null,markAvailable:false};}
 });
 const incomplete=positions.some(p=>!p.markAvailable);
 return {...state,positions,equityMicro:incomplete?null:String(BigInt(state.cashMicro)+value),unrealizedMicro:incomplete?null:String(positions.reduce((sum,p)=>sum+BigInt(p.unrealizedMicro),0n)),incomplete};
}
