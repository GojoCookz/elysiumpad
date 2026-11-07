import {KEY,encode,decode} from './state.js';
import {localSave} from './save.js';
import {FISH,SEASONS,UNLOCKS,FishingLoop,totalCatch,recordCatch,placeFish,equip,setSeason,fishById} from './fishing-state.js';
import {drawWaterScene,drawFish,postcard} from './fishing-art.js';
const $=s=>document.querySelector(s),loop=new FishingLoop(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let storage;try{storage=localStorage;}catch{storage={getItem(){throw Error('unavailable');}};}
const store=localSave(storage),home=store.home;let visiting=null,invalidVisit=false,mode='pond',selected=0,cat=null,last=performance.now(),lastUI='',caughtId=null;
try{const params=new URLSearchParams(location.hash.slice(1));if(params.has('home')){visiting=decode(params.get('home'));mode='aquarium';}}catch(e){invalidVisit=true;$('#visit-note').hidden=false;$('#visit-note').textContent=e.message;}
const displayed=()=>visiting||home,s=()=>displayed().fishing,readonly=()=>!!visiting||invalidVisit;
$('#home-link').href='./'+location.search+(visiting?location.hash:'');
if(visiting){$('#visit-note').hidden=false;$('#visit-note').textContent=`${visiting.name}’s aquarium snapshot · read-only. Your own collection is safe.`;$('#aquarium-tab').textContent='Visited aquarium';}
if(invalidVisit){$('#visit-note').textContent+=' Return to Cloud home to leave this invalid visit.';}
function persist(){if(!readonly())store.write(home);$('#save-note').textContent=readonly()?'Read-only visit · no changes to your save':store.message;}
function counter(k){if(readonly())return;s().counters[k]=Math.min(9999,s().counters[k]+1);persist();}
function draw(now=performance.now()){drawWaterScene($('#waters'),{mode,fishing:s(),cat,phase:loop.phase,time:now,reduced:reduced.matches||loop.paused,selected:mode==='aquarium'?selected:-1});}
new ResizeObserver(()=>{const scale=Math.max(1,Math.floor($('.scene-wrap').clientWidth/384));$('#waters').style.width=(384*scale)+'px';$('#waters').style.height=(288*scale)+'px';}).observe($('.scene-wrap'));
function renderCollection(){
  const season=SEASONS.find(x=>x.id===s().season);$('#season').replaceChildren(...SEASONS.map(x=>new Option(x.name,x.id)));$('#season').value=s().season;$('#season').disabled=readonly();
  $('#collection-title').textContent=season.name+' collection';$('#season-note').textContent=season.description;
  $('#collection-progress').textContent=`${season.fish.filter(id=>s().owned[id]).length} / ${season.fish.length} discovered · ${totalCatch(s())} total catches`;
  $('#fish-list').replaceChildren(...season.fish.map(id=>{const f=fishById(id),card=document.createElement('article');card.className='fish-card';const c=document.createElement('canvas');c.width=96;c.height=64;c.setAttribute('aria-hidden','true');drawFish(c.getContext('2d'),id,48,30,3);const title=document.createElement('h3');title.textContent=f.name;const note=document.createElement('p');note.textContent=f.note;const quantity=document.createElement('p');quantity.className='quantity';quantity.textContent=s().owned[id]?`${s().owned[id]} caught`:'Not caught yet';card.append(c,title,note,quantity);return card;}));
  $('#unlock-list').replaceChildren(...UNLOCKS.map(u=>{const row=document.createElement('div');row.className='unlock';const text=document.createElement('div'),title=document.createElement('h3'),note=document.createElement('p'),button=document.createElement('button');title.textContent=u.name;note.textContent=`${u.at} catches · ${u.kind==='halo'?'angel styling':'pond & aquarium decoration'}`;button.textContent=s()[u.kind]===u.id?'Equipped':totalCatch(s())>=u.at?'Equip':`${totalCatch(s())} / ${u.at}`;button.disabled=readonly()||totalCatch(s())<u.at;button.setAttribute('aria-label',`${button.textContent} ${u.name}`);button.setAttribute('aria-pressed',String(s()[u.kind]===u.id));button.onclick=()=>{if(equip(s(),u.id,u.kind)){persist();renderCollection();draw();$('#cosmetic-status').textContent=u.name+' equipped. See it in the pond, aquarium'+(u.kind==='halo'?' and cloud home.':'.');}};text.append(title,note);row.append(text,button);return row;}));
  $('#no-halo').disabled=$('#no-pond').disabled=readonly();
  $('#counters').textContent=`This browser: ${s().counters.casts} casts · ${s().counters.catches} catches · ${s().counters.aquarium} aquarium visits · ${s().counters.postcards} postcards made.`;
}
function renderSlots(){
  $('#slots').replaceChildren(...s().slots.map((id,i)=>{const b=document.createElement('button');b.textContent=`${i+1}. ${id?fishById(id).name:'Empty'}`;b.setAttribute('aria-pressed',String(selected===i));b.onclick=()=>{selected=i;renderSlots();draw();};return b;}));
  $('#slot-fish').replaceChildren(new Option('Leave empty',''),...FISH.filter(f=>s().owned[f.id]).map(f=>new Option(f.name,f.id)));$('#slot-fish').value=s().slots[selected]||'';
  $('#slot-fish').disabled=$('#place-fish').disabled=readonly();$('#postcard-frame').value=s().frame;
  $('#tank-note').textContent=readonly()?'Read-only display. You can choose a frame and export a keepsake.':totalCatch(s())?'Choose a numbered spot, then a fish to place there.':'Your aquarium is waiting. Catch your first fish at the Floating pond.';
}
function setMode(next){loop.pause();mode=next;$('#pond-controls').hidden=mode!=='pond';$('#aquarium-controls').hidden=mode!=='aquarium';$('#pond-tab').setAttribute('aria-pressed',String(mode==='pond'));$('#aquarium-tab').setAttribute('aria-pressed',String(mode==='aquarium'));$('#waters').setAttribute('aria-label',mode==='pond'?'Floating pearl pond with angel, lilies and original cloud fish':'Pearl conservatory aquarium. Fish and positions are listed in the aquarium controls.');if(next==='aquarium')counter('aquarium');renderSlots();renderCollection();syncLoop();draw();}
function syncLoop(){
  const phase=loop.phase,active=['cast','wait','bite','reel'].includes(phase),state=[phase,loop.paused,loop.result,caughtId].join(':');
  $('#pause').hidden=!active;$('#pause').textContent=loop.paused?'Resume fishing':'Pause fishing';$('#relaxed').disabled=active||readonly();$('#fish-action').disabled=readonly();$('#fish-action').setAttribute('aria-disabled',String(readonly()||loop.paused||['cast','wait'].includes(phase)||(phase==='reel'&&loop.elapsed<250)||(phase==='result'&&loop.elapsed<700)));
  $('#timing').hidden=phase!=='reel';
  if(state!==lastUI){lastUI=state;let text,label;
    if(loop.paused){text='Fishing paused. Resume when you are ready; your timing is safe.';label='Fishing paused';}
    else if(phase==='idle'){text='Cast your line. Watch for a bite, then hook and reel.';label='Cast a line';}
    else if(phase==='cast'){text='Your line sails into the cloud water…';label='Casting…';}
    else if(phase==='wait'){text='A little patience. Watch for “A bite!”';label='Waiting for a bite…';}
    else if(phase==='bite'){text='A bite! Hook your fish now.';label='Hook the fish';}
    else if(phase==='reel'){text=loop.relaxed?'Your fish is ready. Reel whenever you like.':'Reel inside the striped window. Two slow passes.';label='Reel in';}
    else if(loop.result==='caught'){text=`Caught ${fishById(caughtId)?.name||'a cloud fish'}! ${totalCatch(s())===1?'Dew halo unlocked. Find it under Earned cosmetics below.':'Your collection and catch progress grew.'}`;label='Cast again';}
    else{text='It slipped away. Nothing lost — try again, or turn on relaxed timing.';label='Try another cast';}
    $('#fishing-status').textContent=readonly()?'Snapshot visits are read-only. Return to Cloud home to fish in your own collection.':text;$('#fish-action').textContent=label;
    $('#timing-copy').textContent=loop.relaxed?'Relaxed timing: no moving target and no deadline.':'Striped window = safe to reel. Outside it = fish slips away.';
  }
  const[a,b]=loop.target;$('#target-zone').style.left=(a*100)+'%';$('#target-zone').style.width=((b-a)*100)+'%';const w=$('.meter').clientWidth;$('#needle').style.transform=`translateX(${Math.round(loop.cursor*Math.max(0,w-18))}px)`;
}
$('#fish-action').onclick=()=>{if(readonly()||$('#fish-action').getAttribute('aria-disabled')==='true')return;if(['idle','result'].includes(loop.phase)){caughtId=null;loop.start({relaxed:s().relaxed||reduced.matches,first:totalCatch(s())===0});counter('casts');}else loop.act();settle();syncLoop();draw();};
$('#fish-action').addEventListener('keydown',e=>{if(e.repeat)e.preventDefault();});
function settle(){if(loop.takeReward()&&!readonly()){caughtId=recordCatch(s());persist();renderCollection();renderSlots();const unlock=UNLOCKS.find(u=>u.at===totalCatch(s()));$('#catch-summary').textContent=`Latest catch: ${fishById(caughtId).name}. ${unlock?unlock.name+' unlocked — equip it under Earned cosmetics below.':`${totalCatch(s())} catches; duplicates count toward cosmetics.`}`;}}
$('#pause').onclick=()=>{if(loop.paused){last=performance.now();loop.resume();}else loop.pause();syncLoop();};
$('#relaxed').checked=s().relaxed||reduced.matches;$('#relaxed').onchange=()=>{s().relaxed=$('#relaxed').checked;persist();};
reduced.addEventListener('change',()=>{loop.pause();$('#relaxed').checked=s().relaxed||reduced.matches;syncLoop();draw();});
$('#pond-tab').onclick=()=>setMode('pond');$('#aquarium-tab').onclick=()=>setMode('aquarium');
$('#place-fish').onclick=()=>{if(readonly())return;if(placeFish(s(),$('#slot-fish').value||null,selected)){persist();renderSlots();draw();}else $('#tank-note').textContent='Every caught fish is already displayed. Clear another spot or catch a duplicate first.';};
$('#postcard-frame').onchange=()=>{if(!readonly()){s().frame=$('#postcard-frame').value;persist();}};
$('#season').onchange=()=>{if(readonly())return;loop.pause();setSeason(s(),$('#season').value);persist();renderCollection();syncLoop();draw();};
for(const kind of ['halo','pond'])$(`#no-${kind}`).onclick=()=>{if(readonly())return;equip(s(),'none',kind);persist();renderCollection();draw();$('#cosmetic-status').textContent=`Earned ${kind==='halo'?'halo':'pond decoration'} removed. You can equip it again any time.`;};
$('#export').onclick=()=>{try{const c=document.createElement('canvas');c.width=384;c.height=288;drawWaterScene(c,{mode:'aquarium',fishing:s(),cat,reduced:true});const url=postcard(c,$('#postcard-frame').value,displayed().name);$('#postcard-image').src=url;$('#download').href=url;$('#postcard-result').hidden=false;counter('postcards');renderCollection();$('#export-status').textContent='Postcard ready. Choose Save aquarium PNG below.';}catch{$('#export-status').textContent='This browser could not make the PNG. Try again or keep a snapshot link instead.';}};
$('#snapshot').onclick=async()=>{const u=new URL('fishing.html',location.href);u.hash=new URLSearchParams({home:encode(displayed())}).toString();$('#snapshot-result').hidden=false;$('#snapshot-link').value=u.href;try{await navigator.clipboard.writeText(u.href);$('#snapshot-status').textContent='Copied a read-only aquarium snapshot.';}catch{$('#snapshot-link').select();$('#snapshot-status').textContent='Copy this read-only aquarium snapshot link.';}};
const pause=()=>{loop.pause();syncLoop();};window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=performance.now();});window.addEventListener('pagehide',pause);
// Full navigation safely reloads immutable snapshot context, including same-tab fragment changes.
window.addEventListener('hashchange',()=>location.reload());
const image=new Image();image.onload=()=>{cat=image;draw();};image.onerror=()=>{$('#scene-caption').textContent='Angel image unavailable. Fishing and collection still work; reload to retry art.';};image.src=`assets/a-${String(displayed().outfit).padStart(2,'0')}.png`;
function frame(now){const dt=now-last;last=now;if(!document.hidden){loop.advance(dt);settle();syncLoop();draw(now);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
$('#save-note').textContent=store.message;if(totalCatch(s()))$('#catch-summary').textContent=`${totalCatch(s())} catches saved · ${FISH.filter(f=>s().owned[f.id]).length} fish kinds. Your earned cosmetics are below.`;setMode(mode);document.body.dataset.ready='1';
// Read-only diagnostics for regression evidence; never a mutation or reward hook.
window.__fishing={state:()=>({phase:loop.phase,paused:loop.paused,cursor:loop.cursor,mode,visiting:!!visiting,home:structuredClone(home)})};
