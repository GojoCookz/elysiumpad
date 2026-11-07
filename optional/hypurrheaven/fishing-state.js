// Stable collection identities. Future seasons append data; never rename owned fish IDs.
export const FISH = [
  {id:'ribbon',name:'Ribbon minnow',note:'A rose ribbon that gathers morning dew.',color:'#dc8ca8',light:'#ffe6ed',shape:0},
  {id:'moon',name:'Moon manta',note:'A little moon with wings of sea glass.',color:'#779eae',light:'#def9ed',shape:1},
  {id:'lantern',name:'Lantern puff',note:'Carries a warm glow beneath the clouds.',color:'#c6a45e',light:'#fff3b8',shape:2},
  {id:'comet',name:'Comet koi',note:'Two long tails trace a quiet constellation.',color:'#a082b8',light:'#f0defa',shape:3},
  {id:'shell',name:'Shell skipper',note:'A scalloped sail and a very small smile.',color:'#619c94',light:'#c4f3d9',shape:4},
  {id:'crown',name:'Crown ray',note:'A pearl crest for the keeper of the pond.',color:'#be8a77',light:'#ffe6c6',shape:5}
];
export const SEASONS = [{id:'pearl-tide',name:'Pearl tide',description:'Six little wonders above the clouds. No end date or streak reset.',fish:FISH.map(f=>f.id),water:'#68bdbd'}];
export const UNLOCKS = [
  {id:'dew',name:'Dew halo',kind:'halo',at:1},
  {id:'lanterns',name:'Pond lanterns',kind:'pond',at:3},
  {id:'crown',name:'Pearl crown',kind:'halo',at:6},
  {id:'reeds',name:'Pearl reeds',kind:'pond',at:9}
];
export const fishById=id=>FISH.find(f=>f.id===id);
const count=n=>Number.isSafeInteger(n)?Math.min(9999,Math.max(0,n)):0;
export const freshFishing=()=>({v:1,season:SEASONS[0].id,owned:{},slots:[null,null,null,null,null,null],halo:'none',pond:'none',frame:'pearl',relaxed:false,counters:{casts:0,catches:0,aquarium:0,postcards:0}});
export const totalCatch=s=>Object.values(s.owned).reduce((a,b)=>a+b,0);
export function sanitizeFishing(raw){
  const s=freshFishing();if(raw==null)return s;
  if(typeof raw!=='object'||Array.isArray(raw)||raw.v!==1)throw new Error('This fish collection uses an unsupported format. Existing data is safe.');
  for(const f of FISH){const n=count(raw.owned?.[f.id]);if(n)s.owned[f.id]=n;}
  s.season=SEASONS.some(x=>x.id===raw.season)?raw.season:s.season;
  const used={};s.slots=s.slots.map((_,i)=>{const id=raw.slots?.[i];if(!fishById(id)||!s.owned[id]||(used[id]||0)>=s.owned[id])return null;used[id]=(used[id]||0)+1;return id;});
  for(const kind of ['halo','pond'])if(UNLOCKS.some(u=>u.id===raw[kind]&&u.kind===kind&&totalCatch(s)>=u.at))s[kind]=raw[kind];
  s.frame=['pearl','rose','teal'].includes(raw.frame)?raw.frame:'pearl';s.relaxed=raw.relaxed===true;
  for(const k of Object.keys(s.counters))s.counters[k]=count(raw.counters?.[k]);
  return s;
}
export function setSeason(s,id){if(!SEASONS.some(x=>x.id===id))return false;s.season=id;return true;}
export function recordCatch(s){
  const season=SEASONS.find(x=>x.id===s.season)||SEASONS[0];
  const caught=season.fish.reduce((n,id)=>n+(s.owned[id]||0),0),id=season.fish[caught%season.fish.length];
  s.owned[id]=Math.min(9999,(s.owned[id]||0)+1);s.counters.catches=Math.min(9999,s.counters.catches+1);
  const slot=s.slots.indexOf(null);if(slot!==-1)s.slots[slot]=id;return id;
}
export function placeFish(s,id,slot){
  if(!Number.isInteger(slot)||slot<0||slot>=6||!(id===null||fishById(id)))return false;
  if(id&&s.slots.filter((x,i)=>x===id&&i!==slot).length>=(s.owned[id]||0))return false;
  s.slots[slot]=id;return true;
}
export function equip(s,id,kind){if(!['halo','pond'].includes(kind))return false;if(id!=='none'&&!UNLOCKS.some(u=>u.id===id&&u.kind===kind&&totalCatch(s)>=u.at))return false;s[kind]=id;return true;}

// Pure, elapsed-time state machine: no wall clock, frame count or storage side effects.
export class FishingLoop {
  phase='idle';elapsed=0;paused=false;relaxed=false;first=true;reward=false;result='';
  start({relaxed=false,first=false}={}){if(!['idle','result'].includes(this.phase))return false;this.phase='cast';this.elapsed=0;this.paused=false;this.relaxed=relaxed;this.first=first;this.reward=false;this.result='';return true;}
  advance(ms){
    if(this.paused||!Number.isFinite(ms)||ms<0)return;
    this.elapsed+=ms;
    if(this.phase==='cast'&&this.elapsed>=700){this.elapsed-=700;this.phase='wait';}
    if(this.phase==='wait'&&this.elapsed>=1100){this.elapsed-=1100;this.phase='bite';}
    if(!this.relaxed&&((this.phase==='bite'&&this.elapsed>6000)||(this.phase==='reel'&&this.elapsed>6000)))this.finish(false);
  }
  get cursor(){if(this.relaxed)return .5;const n=(this.elapsed%2400)/1200;return n<=1?n:2-n;}
  get target(){return this.first?[.08,.92]:[.28,.72];}
  act(){if(this.paused)return false;if(this.phase==='bite'){this.phase='reel';this.elapsed=0;return true;}if(this.phase==='reel'&&this.elapsed>=250){const[a,b]=this.target;this.finish(this.cursor>=a&&this.cursor<=b);return true;}return false;}
  finish(won){this.phase='result';this.elapsed=0;this.result=won?'caught':'missed';this.reward=won;}
  takeReward(){if(!this.reward)return false;this.reward=false;return true;}
  pause(){if(['cast','wait','bite','reel'].includes(this.phase))this.paused=true;}
  resume(){this.paused=false;}
}
