// Wallet Standard discovery protocol. No keys, signing implementation or broadcasts.
// Reference: wallet-standard/wallet-standard packages/core/app/src/wallets.ts.
const standards=new Set();let started=false,active=null,off=null,generation=0,chooser=null;
const changed=()=>window.dispatchEvent(new Event('pad-wallet-change'));
function discover(){
 if(started)return;started=true;
 const api=Object.freeze({register(...wallets){wallets.forEach(wallet=>standards.add(wallet));window.dispatchEvent(new Event('pad-wallet-list'));return()=>{wallets.forEach(wallet=>standards.delete(wallet));window.dispatchEvent(new Event('pad-wallet-list'));};}});
 window.addEventListener('wallet-standard:register-wallet',event=>{if(typeof event.detail==='function')event.detail(api);});
 window.dispatchEvent(new CustomEvent('wallet-standard:app-ready',{detail:api}));
}
export function availableWallets(){
 discover();const rows=[...standards].filter(wallet=>wallet.chains?.includes('solana:mainnet')&&wallet.features?.['standard:connect']&&wallet.features?.['solana:signTransaction']).map(wallet=>({name:wallet.name,standard:wallet}));
 const injected=[['Jupiter',window.jupiter?.solana],['Phantom',window.phantom?.solana],['Solflare',window.solflare],['Solana wallet',window.solana]];
 for(const [name,provider]of injected)if(provider?.connect&&provider.signTransaction&&!rows.some(row=>row.name===name||row.provider===provider)&&!(name==='Solana wallet'&&rows.some(row=>row.provider===provider||row.name==='Phantom'&&provider.isPhantom)))rows.push({name,provider});
 return rows;
}
export const selectedWallet=()=>active?.provider||null;
export const connectedAddress=()=>active?.provider?.publicKey?.toBase58?.()||null;
export function setWalletChooser(callback){chooser=callback;discover();}
export async function disconnectWallet(){
 const old=active;++generation;active=null;off?.();off=null;changed();
 try{await old?.provider.disconnect?.();}catch{throw new Error('Disconnected from this site. Your wallet extension could not revoke its permission; manage that permission in the wallet.');}
}
export async function selectWallet(row){
 await disconnectWallet();const intent=++generation;let provider=row.provider,unsubscribe=null;
 if(row.standard){
  const wallet=row.standard;let account=null;
  const select=accounts=>accounts?.find(item=>item.chains?.includes('solana:mainnet')&&item.features?.includes('solana:signTransaction'))||null;
  const result=await wallet.features['standard:connect'].connect();account=select(result.accounts);
  if(!account)throw new Error('Choose a Solana mainnet account in this wallet.');
  provider={get publicKey(){return account?{toBase58:()=>account.address}:null;},async connect(){return {publicKey:this.publicKey};},async disconnect(){account=null;await wallet.features['standard:disconnect']?.disconnect();},async signTransaction(tx){
   if(active?.provider!==provider||!account)throw new Error('Wallet changed. Review the transaction again.');
   const selected=account;const [result]=await wallet.features['solana:signTransaction'].signTransaction({account:selected,chain:'solana:mainnet',transaction:tx.serialize()});
   if(active?.provider!==provider||account!==selected)throw new Error('Wallet changed. Nothing was sent.');
   return tx.constructor.deserialize(result.signedTransaction);
  }};
  unsubscribe=wallet.features['standard:events']?.on('change',event=>{if(event.accounts){account=select(event.accounts);if(active?.provider===provider)changed();}});
 }else{
  const injected=provider;await injected.connect();if(!injected.publicKey?.toBase58?.())throw new Error('Wallet connection was not completed.');
  provider={get publicKey(){return active?.provider===provider?injected.publicKey:null;},connect:()=>injected.connect(),disconnect:()=>injected.disconnect?.(),async signTransaction(tx){if(active?.provider!==provider)throw new Error('Wallet changed. Review again.');const address=injected.publicKey?.toBase58();const signed=await injected.signTransaction(tx);if(active?.provider!==provider||injected.publicKey?.toBase58()!==address)throw new Error('Wallet changed. Nothing was sent.');return signed;}};
   const account=()=>{if(active?.provider===provider)changed();},disconnected=()=>{if(active?.provider===provider){active=null;++generation;off?.();off=null;changed();}};
  injected.on?.('accountChanged',account);injected.on?.('disconnect',disconnected);
  unsubscribe=()=>{injected.removeListener?.('accountChanged',account);injected.removeListener?.('disconnect',disconnected);};
 }
 if(intent!==generation){unsubscribe?.();throw new Error('Wallet selection changed. Try connecting again.');}
 active={name:row.name,provider};off=unsubscribe;changed();return connectedAddress();
}
export async function ensureWallet(){if(connectedAddress())return connectedAddress();if(!chooser)throw new Error('Open Connect wallet to select your Solana wallet.');return chooser();}
