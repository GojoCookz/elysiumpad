// Original pixel scenery, authored in code. Existing angel PNG provenance: assets/PROVENANCE.md.
export const PALETTES={teal:{wall:'#d6f4ec',shade:'#acd9d0',floor:'#edf8ec',trim:'#5faaa0',cloth:'#efb7c9'},rose:{wall:'#f6dfe5',shade:'#e0b9cd',floor:'#fff0e9',trim:'#aa718b',cloth:'#b1dfd4'},lavender:{wall:'#e3dff5',shade:'#bfb9dc',floor:'#f6f0fa',trim:'#8580b1',cloth:'#f0c5d4'}};
export function renderer(canvas){
 const c=canvas.getContext('2d'); c.imageSmoothingEnabled=false;
 const depth=document.createElement('canvas'),bloom=document.createElement('canvas');depth.width=bloom.width=384;depth.height=bloom.height=288;const bc=bloom.getContext('2d');
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 // Scanline rasterization avoids Canvas's fractional antialias edges on pixel geometry.
 const poly=(points,color)=>{const p=points.map(([x,y])=>[Math.round(x),Math.round(y)]);for(let y=Math.min(...p.map(v=>v[1]));y<Math.max(...p.map(v=>v[1]));y++){const crosses=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))crosses.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}crosses.sort((a,b)=>a-b);for(let i=0;i+1<crosses.length;i+=2)rect(Math.ceil(crosses[i]),y,Math.ceil(crosses[i+1])-Math.ceil(crosses[i]),1,color);}};
 const line=(x,y,w,color)=>rect(x,y,w,1,color);
 function cloud(x,y,s=1){const parts=[[0,8,44,12],[6,3,30,23],[14,0,14,28],[-6,12,56,7]];for(const [a,b,w,h]of parts)rect(x+a*s,y+b*s,w*s,h*s,'#eafff8');rect(x+5*s,y+24*s,33*s,3*s,'#caeee6');}
 function star(x,y,color='#eac170'){rect(x-1,y-4,2,10,color);rect(x-4,y-1,8,3,color);}
 function windowAt(x,y,p){rect(x-3,y+10,48,53,p.trim);rect(x+3,y+2,36,68,p.trim);rect(x+10,y-3,22,78,p.trim);rect(x,y+12,42,45,'#8ed9d3');rect(x+6,y+5,30,60,'#a9ece1');rect(x+13,y+1,16,67,'#bff7ee');cloud(x+9,y+25,.5);rect(x+20,y+3,3,62,'#f7fff4');rect(x,y+37,42,3,'#f7fff4');rect(x-6,y+64,54,5,'#f7fff4');rect(x-6,y+69,54,3,p.shade);}
 function pot(x,y){rect(x-7,y-13,14,14,'#c8ac96');rect(x-9,y-15,18,4,'#f0d9be');rect(x-4,y-10,3,8,'#f9e6d1');}
 function fern(x,y){pot(x,y);rect(x-1,y-36,2,23,'#519a83');for(let i=0;i<4;i++){let yy=y-20-i*5;poly([[x,yy+2],[x-13+i*2,yy-8],[x-10+i,yy-1]],i%2?'#82baa0':'#589d84');poly([[x,yy],[x+14-i*2,yy-9],[x+10-i,yy]],i%2?'#589d84':'#82baa0');}}
 function furniture(item,p){const{x,y,type}=item;
  if(type==='rug'){poly([[x-38,y-14],[x+35,y-14],[x+43,y+9],[x+34,y+16],[x-36,y+16],[x-44,y+9]],p.cloth);rect(x-30,y-10,60,22,'#f9e4e5');for(let i=-24;i<=24;i+=12)star(x+i,y+1,p.cloth);return;}
  rect(x-20,y-1,40,5,'#b4cfc126');
  if(type==='sofa'){rect(x-26,y-25,52,25,p.trim);rect(x-24,y-27,48,17,p.cloth);rect(x-25,y-10,50,14,'#d08fa8');rect(x-22,y-10,44,9,p.cloth);rect(x-30,y-17,8,22,'#f5d6df');rect(x+22,y-17,8,22,'#f5d6df');rect(x-24,y+5,4,5,'#8f796d');rect(x+20,y+5,4,5,'#8f796d');rect(x-17,y-22,13,11,'#fff3e9');rect(x+3,y-22,13,11,'#f4dc95');}
  if(type==='table'){rect(x-19,y-5,4,15,'#a48c71');rect(x+15,y-5,4,15,'#a48c71');rect(x-24,y-13,48,9,'#d7be96');rect(x-21,y-16,42,6,'#f9e3ba');rect(x-9,y-22,9,7,'#fffdf2');rect(x-1,y-21,3,4,'#c69c78');rect(x+7,y-20,8,4,'#c47e87');rect(x+6,y-17,12,2,'#fffdf2');}
  if(type==='plant')fern(x,y);
  if(type==='lamp'){rect(x-1,y-40,3,43,'#c29c64');rect(x-10,y+1,21,3,'#aa997f');rect(x-12,y-45,25,13,'#fff0bc');rect(x-8,y-50,17,7,'#fff7d6');star(x,y-39,'#d4aa61');}
  if(type==='shelf'){rect(x-20,y-33,40,37,p.trim);rect(x-17,y-30,34,12,'#e6eee0');rect(x-17,y-15,34,12,'#e6eee0');for(let i=0;i<5;i++)rect(x-14+i*5,y-28,4,10,['#d699ae','#dfc789','#9cbfba'][i%3]);rect(x-12,y-11,8,8,'#eeb8cc');rect(x+5,y-9,11,6,'#d5b190');}
 }
 function background(room,p){
  rect(0,0,384,288,'#ade7df');for(let i=0;i<5;i++)rect(0,i*14,384,14,['#a5dcd8','#aee4de','#b5eae1','#bfefe5','#c9f3e8'][i]);
  cloud(15,36,1.25);cloud(304,18,1.5);cloud(260,236,1);cloud(-20,214,1.5);
  // Scalloped cloud foundation and a visible lower rim make this a small floating place.
  poly([[35,101],[348,101],[358,238],[339,258],[318,262],[302,274],[79,274],[64,265],[42,262],[24,242]],'#8bc6bf');
  poly([[35,96],[348,96],[354,233],[337,251],[312,254],[300,265],[83,265],[65,256],[43,251],[29,236]],'#f8fff4');
  poly([[48,111],[335,111],[340,229],[322,245],[62,245],[43,229]],p.floor);
  for(let y=136;y<239;y+=16){line(49,y,284,'#d5e8dc');for(let x=56+(y%32?0:16);x<330;x+=32)rect(x,y,1,15,'#dcebe0');}
  if(room==='garden'){
   rect(51,95,281,8,p.trim);for(let x=54;x<332;x+=22)rect(x,96,3,22,p.trim);
   for(const x of [70,310]){fern(x,150);fern(x,217);}
   poly([[133,137],[248,137],[267,185],[244,208],[137,208],[117,185]],'#72bdb7');poly([[141,144],[241,144],[258,184],[239,199],[141,199],[126,184]],'#b4f4e7');
   for(let y=154;y<194;y+=9)line(147+(y%3)*4,y,74,'#e9fff5');
   for(const[x,y]of[[90,166],[290,185],[81,232],[301,233]]){rect(x,y,3,9,'#7baa7d');rect(x-3,y-3,9,6,p.cloth);rect(x,y-5,3,10,'#f5ccdc');}
   furniture({type:'sofa',x:190,y:119},p);
  }else{
   rect(48,39,288,88,p.shade);rect(51,36,282,84,p.wall);rect(48,118,288,7,p.trim);rect(48,125,288,4,'#fafff5');
   rect(44,32,296,7,'#f8fff4');rect(54,25,276,7,'#eafff4');rect(66,21,252,4,'#f8fff4');
   windowAt(78,44,p);windowAt(263,44,p);
   rect(157,48,68,45,p.trim);rect(160,51,62,39,'#fdf9e9');rect(164,55,54,31,'#c2e8dc');cloud(172,61,.65);star(204,62);
   rect(146,100,89,5,p.trim);pot(157,100);rect(155,73,3,13,'#73ac8b');rect(150,75,11,5,'#e8aac5');
   for(let i=0;i<4;i++)rect(188+i*7,88-i%2*2,5,12+i%2*2,['#d7a4bd','#dcca92','#a7c7be'][i%3]);
   if(room==='cafe'){rect(93,139,198,21,p.trim);rect(89,132,206,8,'#f5e2c5');for(let x=107;x<284;x+=45){rect(x,121,12,10,'#fff9e9');rect(x+11,122,4,6,'#c39876');}furniture({type:'table',x:116,y:209},p);furniture({type:'table',x:270,y:209},p);furniture({type:'sofa',x:192,y:232},p);fern(66,158);fern(319,158);}
  }
  for(const[x,y]of[[25,104],[356,83],[21,169],[365,213]])star(x,y,'#f5fff3');
 }
 function text(t,x,y,size=8,color='#345f58'){c.font=`${size}px CloudTitle`;c.textAlign='center';c.fillStyle=color;c.fillText(t,x,y);}
 return {draw({room,home,cat,x,y,selected=-1,placing=null,hover=null,guest=false}){
   const p=PALETTES[home.palette];background(room,p);
   const items=room==='home'?home.items:[];items.filter(i=>i.type==='rug').forEach(i=>furniture(i,p));
   const layers=items.map((item,index)=>({item,index,y:item.y})).filter(o=>o.item.type!=='rug');layers.push({y,cat:true});layers.sort((a,b)=>a.y-b.y);
   for(const o of layers){if(o.cat){rect(x-13,y-2,26,4,'#6eaca34d');if(cat)c.drawImage(cat,Math.round(x-32),Math.round(y-59),64,64);}else{furniture(o.item,p);if(o.index===selected){c.strokeStyle='#b24c70';c.lineWidth=1;c.strokeRect(o.item.x-31,o.item.y-49,62,58);}}}
   if(placing&&hover&&room==='home'){c.globalAlpha=.6;furniture({type:placing,x:hover.x,y:hover.y},p);c.globalAlpha=1;}
   if(room==='cafe'){text('Pearl café',192,117,11);}
   // Lighting sits over the crisp native pixels, never rescales the sprites.
   c.save();c.globalCompositeOperation='multiply';rect(0,0,384,288,'#f0f8ff');c.globalCompositeOperation='screen';
   const lamps=room==='home'?items.filter(i=>i.type==='lamp').map(i=>[i.x,i.y-38]):room==='cafe'?[[110,115],[273,115]]:[[192,160]];
   for(const[lx,ly]of lamps){const glow=c.createRadialGradient(lx,ly,1,lx,ly,53);glow.addColorStop(0,'#ffd77a90');glow.addColorStop(.4,'#ffc45b35');glow.addColorStop(1,'#ffc45b00');c.fillStyle=glow;c.fillRect(lx-53,ly-53,106,106);c.save();c.translate(lx,ly+48);c.scale(1,.34);const pool=c.createRadialGradient(0,0,2,0,0,52);pool.addColorStop(0,'#ffdc8650');pool.addColorStop(1,'#ffdc8600');c.fillStyle=pool;c.fillRect(-52,-52,104,104);c.restore();}
   c.globalCompositeOperation='source-over';const shade=c.createRadialGradient(192,152,100,192,152,245);shade.addColorStop(0,'#30695b00');shade.addColorStop(1,'#30695b25');c.fillStyle=shade;c.fillRect(0,0,384,288);c.restore();
   // Authored emissive-only bloom is independent of the pixel layer and floor light map.
   bc.clearRect(0,0,384,288);bc.fillStyle='#fff1a4';for(const[lx,ly]of lamps)bc.fillRect(lx-8,ly-4,16,8);c.save();c.globalCompositeOperation='screen';c.globalAlpha=.4;c.filter='blur(5px)';c.drawImage(bloom,0,0);c.restore();
   // Separate depth-of-field composite: only distant sky and foreground cloud rim soften.
   depth.getContext('2d').drawImage(canvas,0,0);c.save();c.beginPath();c.rect(0,0,384,35);c.rect(0,266,384,22);c.clip();c.filter='blur(1.2px)';c.globalAlpha=.65;c.drawImage(depth,0,0);c.restore();
   if(guest)text('HOME SNAPSHOT · READ ONLY',192,281,7);
 },photo(frame,sticker){const out=document.createElement('canvas');out.width=1152;out.height=frame==='none'?864:936;const g=out.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle=frame==='teal'?'#bff7ee':'#f8fffc';g.fillRect(0,0,out.width,out.height);g.drawImage(canvas,0,0,1152,864);if(frame!=='none'){g.strokeStyle=frame==='teal'?'#236c66':'#f8fffc';g.lineWidth=24;g.strokeRect(12,12,1128,912);g.fillStyle='#204f50';g.font='38px Cloud';g.textAlign='center';g.fillText('Hypurrheaven · wish you were here',576,910);}if(sticker!=='none'){g.fillStyle='#efb7c9';for(const[x,y]of[[80,70],[1040,740]]){g.save();g.translate(x,y);g.scale(4,4);if(sticker==='heart'){for(const[a,b,w,h]of[[0,2,5,5],[7,2,5,5],[2,0,2,2],[8,0,2,2],[2,7,8,2],[4,9,4,2],[5,11,2,2]])g.fillRect(a,b,w,h);}else{g.fillRect(5,0,3,15);g.fillRect(0,6,13,3);}g.restore();}}return out.toDataURL('image/png');}}
}
