// Original cutout lettering; user-supplied cat illustration has local provenance.
// Cue states are fictional commentary, never portfolio diagnostics.
const n=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
export const HOST_REACTIONS=Object.freeze([
  Object.freeze({id:'thesis',cue:'NICE THESIS. NOW MAKE IT YOUR TIME TO SHINE. HIT THE STAGE.'}),
  Object.freeze({id:'founder',cue:'YOU PICKED A TICKER. SHOW US THE IDEA. CREATE YOUR COIN.'}),
  Object.freeze({id:'charts',cue:'ALL THOSE CHARTS. MAKE A FUCKING PLAN. TRY THE REHEARSAL.'}),
]);

export function pirateWordmark(){
 return '<svg viewBox="0 0 780 116" role="img" aria-label="HypurrLabs — hosted by Rektd"><text x="390" y="89" text-anchor="middle" textLength="730" lengthAdjust="spacingAndGlyphs" fill="currentColor" font-family="Arial Black,Arial,sans-serif" font-size="102" font-weight="900" letter-spacing="-4">HypurrLabs</text></svg>';
}

export function pirateHost(index=0){
 const reaction=HOST_REACTIONS[((index%HOST_REACTIONS.length)+HOST_REACTIONS.length)%HOST_REACTIONS.length];
 const expression=['welcome','shocked','disappointed'][((index%3)+3)%3],portrait=expression==='welcome'?'/assets/getrektd/announcer-avatar.webp':`/assets/getrektd/reaction-${expression}.webp`,full=expression==='welcome'?'/assets/getrektd/announcer.webp':portrait;
 return `<picture data-cue="${reaction.id}"><source media="(max-width:759px)" srcset="${portrait}"><img src="${full}" width="768" height="768" alt="Rektd, HypurrLabs’ ${expression} white and cyan chibi cat game-show host" decoding="async" fetchpriority="high"></picture>`;
}

export function mountPirateScene({title,heading,aside,art,label,asideCopy}){
 const appearance=document.querySelector('#appearance-toggle');
 const renderAppearance=()=>{if(!appearance)return;const shape=document.documentElement.dataset.theme==='dark'?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>':'<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>';appearance.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>`;};
 window.addEventListener('pad-theme-change',renderAppearance);renderAppearance();
 const wordmark=n('div','rekt-pirate-wordmark');wordmark.dataset.noTranslate='';wordmark.innerHTML=pirateWordmark();heading.before(wordmark);
 const stamp=n('span','rekt-pirate-stamp','BAD IDEAS. ACTUAL TOOLS.');stamp.dataset.noTranslate='';title.append(stamp);
 const reaction=n('button','rekt-host-reaction');reaction.type='button';reaction.setAttribute('aria-label','Change the cat announcer’s cue');reaction.title='Click the cat. He has notes.';const picture=n('span','rekt-mascot');picture.innerHTML=pirateHost();reaction.append(picture);art.replaceWith(reaction);
 const cueLabel=n('p','rekt-cue-label','REKTD / YOUR HYPURRLABS HOST');label.before(cueLabel);label.setAttribute('aria-live','polite');asideCopy.textContent='Hyperliquid parody. Solana execution. Not affiliated with Hyperliquid.';
 const mobileCue=n('p','rekt-mobile-cue');mobileCue.dataset.noTranslate='';mobileCue.setAttribute('aria-live','polite');heading.parentElement.querySelector('.launch-entry').before(mobileCue);
 let selected=0;
 const setReaction=index=>{selected=((index%HOST_REACTIONS.length)+HOST_REACTIONS.length)%HOST_REACTIONS.length;picture.innerHTML=pirateHost(selected);label.textContent=HOST_REACTIONS[selected].cue;mobileCue.textContent=`HOST: ${HOST_REACTIONS[selected].cue}`;reaction.dataset.reaction=HOST_REACTIONS[selected].id;};
 reaction.addEventListener('click',()=>setReaction(selected+1));setReaction(0);
 return {setReaction,setPanel(panel){wordmark.hidden=stamp.hidden=mobileCue.hidden=panel!=='discover';}};
}
