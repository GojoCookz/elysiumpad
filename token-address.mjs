let nextId=0;
// Always copy the verified Solana mint, never the pool address or a shortened label.
export function tokenAddress({mint,symbol='Token'}){
 const root=document.createElement('div');root.className='token-address';
 if(typeof mint!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)){root.textContent='CA unavailable';return root;}
 const input=document.createElement('input');input.type='text';input.id=`token-ca-${++nextId}`;input.name='contractAddress';input.value=mint;input.readOnly=true;input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label',`CA for ${symbol} (Solana mint)`);input.dataset.noTranslate='';
 const label=document.createElement('label');label.htmlFor=input.id;label.textContent='CA';
 const button=document.createElement('button');button.type='button';button.textContent='Copy CA';button.setAttribute('aria-label',`Copy CA for ${symbol}`);
 const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');
 function select(){input.focus({preventScroll:true});input.select();input.setSelectionRange(0,mint.length);}
 input.addEventListener('click',select);
 button.addEventListener('click',async()=>{
  button.disabled=true;let copied=false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(mint);copied=true;}}catch{/* Browser permissions can require manual selection instead. */}
  if(!copied){select();try{copied=document.execCommand('copy');}catch{}}
  if(copied){button.textContent='Copied CA';button.setAttribute('aria-label',`Copied CA for ${symbol}`);status.className='sr-only';status.textContent=`${symbol} contract address copied.`;}
  else{button.textContent='Copy CA';button.setAttribute('aria-label',`Copy CA for ${symbol}`);status.className='ca-copy-error';status.textContent='Copy unavailable. The full address is selected; use your device’s Copy action.';}
  button.disabled=false;
 });
 root.append(label,input,button,status);return root;
}
