// Wallet-provided Wallet Standard brand icons; local fallbacks avoid remote tracking.
const known=Object.freeze({Phantom:'phantom',MetaMask:'metamask',Solflare:'solflare',Jupiter:'jupiter'});
export function walletIconSource(row){
 if(Object.hasOwn(known,row.name))return `/assets/wallets/${known[row.name]}.png`;
 const icon=row.icon??row.standard?.icon;
 return typeof icon==='string'&&icon.length<=262144&&/^data:image\/(?:png|webp|jpeg|gif|svg\+xml)(?:;base64)?,/i.test(icon)?icon:null;
}
export function appendWalletIcon(button,row,document=globalThis.document){
 const source=walletIconSource(row);const icon=document.createElement(source?'img':'span');
 icon.className='wallet-brand-icon';icon.setAttribute('aria-hidden','true');
 if(source){icon.src=source;icon.alt='';icon.width=icon.height=28;icon.addEventListener('error',()=>{const fallback=document.createElement('span');fallback.className='wallet-brand-icon wallet-brand-fallback';fallback.setAttribute('aria-hidden','true');fallback.textContent='◈';icon.replaceWith(fallback);},{once:true});}
 else{icon.classList.add('wallet-brand-fallback');icon.textContent='◈';}
 const label=document.createElement('span');label.textContent=row.name;button.replaceChildren(icon,label);
}
