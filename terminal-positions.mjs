import {createAccount,markPortfolio,portfolio,unitsText} from './paper-ledger.mjs';
import {t,locale} from './terminal-i18n.mjs';
import {tokenArt} from './token-art.mjs';
const n=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
const usd=value=>value==null?'—':new Intl.NumberFormat(locale(),{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
const price=value=>value==null?'—':new Intl.NumberFormat(locale(),{style:'currency',currency:'USD',maximumSignificantDigits:6}).format(value);
const micro=value=>value==null?null:Number(value)/1000000;
const sessionAccounts=new Map();
if(typeof window!=='undefined')window.addEventListener('pad-paper-updated',event=>{if(!event.detail?.product)return;try{portfolio(event.detail.account);if(event.detail.sessionOnly)sessionAccounts.set(event.detail.product,event.detail.account);else sessionAccounts.delete(event.detail.product);}catch{}});
export function readPaperAccount(product){
 if(sessionAccounts.has(product))return sessionAccounts.get(product);
 try{const raw=localStorage.getItem(`${product}.paper-account.v1`);const account=raw?JSON.parse(raw):createAccount(product);portfolio(account);if(account.product!==product)throw new Error();return account;}catch{return null;}
}
export function paperPositionRows(product,market){
 const account=readPaperAccount(product);if(!account)return {positions:[],orders:[],error:true,equity:null,cash:null,realized:null};
 const marked=markPortfolio(account,market);return {positions:marked.positions.map(position=>{const qty=Number(unitsText(position.quantityUnits,position.decimals)),basis=micro(position.costBasisMicro),value=micro(position.markedMicro),pnl=micro(position.unrealizedMicro);return {...position,entry:qty?basis/qty:null,mark:value!=null&&qty?value/qty:null,value,pnl,pnlPercent:basis>0&&pnl!=null?pnl/basis*100:null};}),orders:account.orders,error:false,equity:micro(marked.equityMicro),cash:micro(marked.cashMicro),realized:micro(marked.realizedMicro)};
}
export function mountPositions({target,product,getMarket,onSelect,onPaper,getWallet,connectWallet,getMode,compact=false,refreshMarket}){
 let tab='positions',selectedMint=null,filter='all',live=null,liveWallet=null,busy=false,error='';
 const toolbar=n('div','positions-toolbar'),tabs=n('div','positions-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Portfolio tabs');
 const positionsButton=n('button'),historyButton=n('button');positionsButton.type=historyButton.type='button';tabs.append(positionsButton,historyButton);
 const mode=n('span','positions-mode');const filterLabel=n('label','sr-only','Filter positions');filterLabel.htmlFor=compact?'terminal-position-filter':'portfolio-position-filter';const select=n('select','positions-filter');select.id=filterLabel.htmlFor;select.name='positionsFilter';
 const refresh=n('button','compact-button');refresh.type='button';toolbar.append(tabs,mode,filterLabel,select,refresh);
 const overview=n('dl','portfolio-overview'),content=n('div','positions-content'),status=n('p','positions-status');status.setAttribute('role','status');
 target.replaceChildren(toolbar,overview,content,status);
 const choose=t=>{tab=t;render();};positionsButton.addEventListener('click',()=>choose('positions'));historyButton.addEventListener('click',()=>choose('history'));select.addEventListener('change',()=>{filter=select.value;render();});
 async function loadLive(){const wallet=getWallet();if(!wallet)return;if(busy)return;busy=true;error='';render();try{const response=await fetch(`/api/portfolio?${new URLSearchParams({wallet})}`,{signal:AbortSignal.timeout(45000)});const result=await response.json();if(!response.ok||result.wallet!==wallet||result.product!==product)throw new Error('Wallet holdings API is unavailable. Check this deployment’s RPC configuration.');if(wallet!==getWallet())return;live=result;liveWallet=wallet;}catch(e){live=null;error=e.message;}finally{busy=false;if(getMode()==='live'&&getWallet()&&getWallet()!==wallet){void loadLive();}else render();}}
 refresh.addEventListener('click',async()=>{if(getMode()==='live'){await loadLive();return;}refresh.disabled=true;try{await refreshMarket?.();}finally{refresh.disabled=false;render();}});
 function render(){
  const paper=getMode()==='paper',paperState=paperPositionRows(product,getMarket());
  positionsButton.textContent=t('Positions');historyButton.textContent=t('History');positionsButton.setAttribute('aria-pressed',String(tab==='positions'));historyButton.setAttribute('aria-pressed',String(tab==='history'));refresh.textContent=t('Refresh');refresh.disabled=busy;mode.textContent=paper?t('SIMULATED · No real funds'):t('Live holdings');mode.dataset.mode=paper?'paper':'live';
  select.replaceChildren();for(const [value,label] of [['all','All positions'],['selected','Selected asset']]){const option=n('option','',t(label));option.value=value;select.append(option);}select.value=filter;
  let rows=paper?paperState.positions:[];
  if(!paper&&live&&liveWallet===getWallet()){rows=live.positions.map(position=>{const stamp=Date.parse(position.priceCheckedAt),fresh=Number.isFinite(stamp)&&Date.now()-stamp<120000&&stamp<=Date.now()+5000;const mark=fresh&&Number.isFinite(position.priceUsd)?position.priceUsd:null;return {...position,entry:null,mark,value:mark==null?null:Number(unitsText(position.quantityUnits,position.decimals))*mark,pnl:null,pnlPercent:null};});}
  if(filter==='selected')rows=rows.filter(row=>row.mint===selectedMint);
  overview.hidden=compact;overview.replaceChildren();for(const [name,value] of paper?[['Paper equity',paperState.equity],['Paper cash',paperState.cash],['Realized P/L',paperState.realized]]:[['Live holdings',rows.every(row=>row.value!=null)&&rows.length?rows.reduce((sum,row)=>sum+row.value,0):null],['Avg. entry',null],['Unrealized P/L',null]]){const cell=n('div');cell.append(n('dt','',t(name)),n('dd','',usd(value)));overview.append(cell);}
  status.textContent=error||(paper?(paperState.error?'Stored demo history is invalid. Open Paper demo to reset it explicitly.':'Paper P/L includes the recorded demo entry costs. Marks exclude future exit costs.'):t('RPC balances only. Acquisition history is required for live entry prices and P/L.'));
  content.replaceChildren();
  if(!paper&&!getWallet()){
   const empty=n('div','terminal-empty');empty.append(n('p','',t('Connect your wallet to read on-chain holdings.')));const connect=n('button','primary',t('Connect wallet'));connect.type='button';connect.addEventListener('click',async()=>{try{await connectWallet();await loadLive();}catch(e){error=e.message;render();}});empty.append(connect);content.append(empty);return;
  }
  if(tab==='history'){
   if(!paper){content.append(n('div','terminal-empty',busy?'Reading wallet holdings…':'Live transaction-history adapter is not configured. No trade history or entry price is invented.'));return;}
   const orders=paperState.orders.filter(order=>filter!=='selected'||order.mint===selectedMint).slice(-50).reverse();
   if(!orders.length){content.append(n('div','terminal-empty',t('No recorded trades')));return;}
   const table=n('table','position-table'),head=n('thead'),body=n('tbody'),tr=n('tr');for(const title of ['Asset','Action','Quantity','Position value','History'])tr.append(n('th','',t(title)));head.append(tr);
   for(const order of orders){const row=n('tr');for(const [title,text] of [['Asset',order.symbol],['Action',t(order.side==='buy'?'Buy':'Sell')],['Quantity',unitsText(order.quantityUnits,order.decimals)],['Position value',usd(Number(order.netMicro)/1000000)],['History',new Intl.DateTimeFormat(locale(),{dateStyle:'short',timeStyle:'short'}).format(order.time)]]){const td=n('td','',text);td.dataset.label=t(title);if(title==='Asset')td.dataset.noTranslate='';row.append(td);}body.append(row);}table.append(head,body);content.append(table);return;
  }
  if(!rows.length){const empty=n('div','terminal-empty');empty.append(n('strong','',busy?'Reading wallet holdings…':t('No open positions')));const button=n('button','text-button',paper?t('Open paper demo'):t('Refresh'));button.type='button';button.addEventListener('click',()=>paper?onPaper():loadLive());empty.append(button);content.append(empty);return;}
  const scroll=n('div','positions-scroll'),table=n('table','position-table'),head=n('thead'),body=n('tbody'),header=n('tr');for(const title of ['Asset','Quantity','Avg. entry','Mark','Position value','Unrealized P/L','Action'])header.append(n('th','',t(title)));head.append(header);
  for(const position of rows){const row=n('tr');row.dataset.mint=position.mint;
   const asset=n('td','position-asset');asset.dataset.label=t('Asset');const open=n('button','position-symbol',position.symbol);open.prepend(tokenArt({...position,image:getMarket()?.tokens?.find(token=>token.mint===position.mint)?.image},{size:24}));open.type='button';open.dataset.noTranslate='';open.addEventListener('click',()=>onSelect(position.mint));asset.append(open,n('small','',position.assetClass==='leveraged'?'xAsset · long':position.assetClass==='spot'?t('Spot asset'):'Ecosystem token'));row.append(asset);
   const values=[['Quantity',unitsText(position.quantityUnits,position.decimals)],['Avg. entry',price(position.entry)],['Mark',price(position.mark)],['Position value',usd(position.value)],['Unrealized P/L',position.pnl==null?'—':`${usd(position.pnl)} (${new Intl.NumberFormat(locale(),{maximumFractionDigits:2,signDisplay:'exceptZero'}).format(position.pnlPercent)}%)`]];
   for(const [title,text] of values){const td=n('td',title==='Unrealized P/L'&&position.pnl!=null?position.pnl<0?'negative':'positive':'',text);td.dataset.label=t(title);if(position.entry==null&&title==='Avg. entry')td.title=t('Unknown');row.append(td);}
   const actions=n('td','position-actions');actions.dataset.label=t('Action');const view=n('button','compact-button',t('View chart'));view.type='button';view.addEventListener('click',()=>onSelect(position.mint));const sell=n('button','compact-button',t('Sell'));sell.type='button';sell.disabled=position.frozen;sell.addEventListener('click',()=>paper?onPaper(position.mint,'sell'):onSelect(position.mint,'sell'));actions.append(view,sell);row.append(actions);body.append(row);
  }table.append(head,body);scroll.append(table);content.append(scroll);
 }
 const update=()=>{render();if(getMode()==='live'&&getWallet()&&getWallet()!==liveWallet&&!busy)loadLive();};
 window.addEventListener('pad-paper-updated',event=>{if(event.detail?.product===product)render();});window.addEventListener('pad-mode-change',update);window.addEventListener('pad-wallet-change',()=>{live=null;liveWallet=null;update();});window.addEventListener('pad-language-change',render);setInterval(()=>{if(document.visibilityState==='visible'&&!target.closest('[hidden]'))render();},30000);render();
 return {update,select(mint){selectedMint=mint;render();}};
}
