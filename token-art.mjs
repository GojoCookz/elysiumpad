// Logos come only from mint-matched provider metadata. Monograms are explicit fallbacks.
export function artworkUrlForSize(value,size=40){
 try{const url=new URL(value);if(url.protocol!=='https:')return null;if(size>=160&&url.hostname==='cdn.dexscreener.com'){const pixels=Math.min(320,Math.max(160,Math.ceil(size)));url.searchParams.set('width',String(pixels));url.searchParams.set('height',String(pixels));url.searchParams.set('quality','85');url.searchParams.set('format','auto');}return url.href;}catch{return null;}
}
export function tokenArt(token,{size=40}={}){
 const el=document.createElement('span');el.className='token-art';el.dataset.noTranslate='';el.dataset.artState='fallback';el.style.setProperty('--art-size',`${size}px`);el.style.position='relative';el.textContent=String(token.symbol||'?').slice(0,2);el.title=`${token.symbol||'Token'} · artwork unavailable`;
 const sources=[...new Set([token.image,...(Array.isArray(token.imageCandidates)?token.imageCandidates:[])].map(value=>artworkUrlForSize(value,size)).filter(Boolean))].slice(0,3);let generation=0;
 function load(index){if(!sources[index])return;const attempt=++generation,img=document.createElement('img');let timer=null;img.alt='';img.width=size;img.height=size;img.loading=size>=160?'eager':'lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.style.position='absolute';img.style.inset='0';img.style.opacity='0';
  const fail=()=>{if(attempt!==generation)return;generation++;if(timer)clearTimeout(timer);img.remove();img.src='';el.dataset.artState='fallback';load(index+1);};
  img.addEventListener('load',()=>{if(attempt!==generation)return;if(timer)clearTimeout(timer);el.replaceChildren(img);img.style.opacity='1';el.dataset.artState='loaded';el.title=token.symbol||'Token';});img.addEventListener('error',fail);if(size>=160)timer=setTimeout(fail,4000);img.src=sources[index];el.append(img);
 }load(0);
 return el;
}
