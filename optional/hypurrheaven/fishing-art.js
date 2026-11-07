import {fishById,SEASONS} from './fishing-state.js';
// Original hand-authored pixel silhouettes. 0 transparent, 1 outline, 2 body,
// 3 pearl highlight, 4 deep fin, 5 eye. No remote or generated artwork.
const sprites=[
 ['000000000000000000','000001110000000000','000012231000000000','001112333111000010','012223333332100121','122233333335211231','012223333332122341','001112222111000121','000012241000000010','000001110000000000'],
 ['000000110000000000','000001231000000000','000012333100000000','000122333210000000','001223333322100000','122333553333221000','012223333322100000','000112222110000000','000001221000000000','000000121000000000','000000014100000000','000000001110000000'],
 ['000000011000000000','000000133100000000','000111122111000000','001223333332100000','012233333333210000','122333333353221100','122333333333224210','012223333332211100','001222222221000000','000112441110000000','000001110000000000'],
 ['0000001110000000000000','0000012231000000000000','0001123333110000000000','0112233333321100001110','1223333333353211112341','0122233333322222233410','0011222222211111234100','0000122411100001123410','0000011100000000012341','0000000000000000001110'],
 ['000001101101100000','000012312312310000','000123333333231000','001233333333332100','012223333333322100','122222333335222110','012222222222224210','001222222222211100','000112244221100000','000001111110000000'],
 ['0000010001000100000','0000121012101210000','0001232123212321000','0001233333333321000','0012233333333322100','0122333553333332210','1233333333333333321','0122223333332222210','0001122222222110000','0000011222211000000','0000000122100000000','0000000012100000000','0000000001110000000']
];
export function drawFish(g,id,x,y,scale=2,flip=false){const f=fishById(id);if(!f)return;const rows=sprites[f.shape],w=Math.max(...rows.map(r=>r.length));g.save();g.translate(Math.round(x),Math.round(y));g.scale(flip?-scale:scale,scale);const colors=['','#365e67',f.color,f.light,'#537d87','#233e50'];for(let yy=0;yy<rows.length;yy++)for(let xx=0;xx<rows[yy].length;xx++){const n=Number(rows[yy][xx]);if(n){g.fillStyle=colors[n];g.fillRect(xx-Math.floor(w/2),yy-Math.floor(rows.length/2),1,1);}}g.restore();}
export function drawHalo(g,id,x,y){if(id==='none')return;g.save();g.fillStyle=id==='crown'?'#e6cb7f':'#c4fff3';const px=(dx,dy,w,h)=>g.fillRect(Math.round(x+dx),Math.round(y+dy),w,h);px(-14,-2,28,2);px(-18,-6,4,4);px(14,-6,4,4);px(-14,-10,28,2);g.fillStyle='#fffdf0';px(-10,-9,15,1);if(id==='crown'){px(-12,-15,3,7);px(-1,-18,3,10);px(10,-15,3,7);}g.restore();}
export function drawWaterScene(canvas,{mode='pond',fishing,cat,phase='idle',time=0,reduced=false,selected=-1}){
  const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;const r=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
  // Scanline fill keeps diagonals on whole native pixels (Canvas paths antialias edges).
  const poly=(points,c)=>{g.fillStyle=c;for(let y=Math.min(...points.map(p=>p[1]));y<Math.max(...points.map(p=>p[1]));y++){const xs=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i<xs.length;i+=2)g.fillRect(Math.ceil(xs[i]),y,Math.floor(xs[i+1])-Math.ceil(xs[i])+1,1);}};
  const cloud=(x,y,w)=>{r(x+8,y,w-16,14,'#d6f7ed');r(x,y+8,w,12,'#eafff5');r(x+16,y-4,w-40,12,'#eafff5');r(x+8,y+20,w-16,3,'#a2d6d1');};
  r(0,0,384,288,'#a7ded9');r(0,0,384,60,'#94cfce');r(0,60,384,50,'#b6e5de');
  cloud(-20,34,105);cloud(274,48,125);cloud(96,13,76);
  for(const[x,y]of [[238,25],[330,100],[32,112],[290,16]]){r(x,y,2,10,'#effff4');r(x-4,y+4,10,2,'#effff4');}
  poly([[22,238],[36,220],[348,220],[366,238],[350,265],[306,275],[72,275],[36,260]],'#79b7b8');
  poly([[18,223],[32,201],[350,201],[370,223],[356,246],[314,260],[70,260],[28,244]],'#e0f4e8');
  poly([[26,218],[42,198],[344,198],[362,218],[350,238],[308,250],[74,250],[36,236]],'#f7fff1');
  r(80,252,228,3,'#c2e2d7');
  // Cloud bank has cool contact shade below and pearl light on its upper shelf.
  r(61,241,62,3,'#deeee0');r(264,241,50,3,'#deeee0');r(76,250,40,2,'#b7d8cf');r(276,248,33,2,'#b7d8cf');
  if(mode==='pond'){
    poly([[92,95],[272,95],[316,118],[336,151],[330,184],[292,217],[110,217],[62,188],[50,149],[65,119]],'#85bab5');
    poly([[92,86],[272,86],[316,109],[336,142],[328,175],[290,206],[110,206],[62,177],[50,140],[65,110]],'#f6fae8');
    poly([[99,98],[266,98],[306,118],[321,143],[314,170],[282,192],[116,192],[77,170],[66,142],[79,117]],'#478c98');
    poly([[103,102],[263,102],[301,122],[314,144],[307,164],[279,184],[120,184],[84,164],[74,143],[86,121]],SEASONS.find(s=>s.id===fishing.season)?.water||'#68bdbd');
    poly([[80,150],[310,150],[307,164],[279,184],[120,184],[84,164]],'#5cb0b7');
    poly([[86,163],[307,163],[279,184],[120,184]],'#58a4ae');
    poly([[121,105],[144,105],[120,148],[98,148]],'#90d2cb');
    poly([[243,105],[251,105],[222,166],[214,166]],'#81cbc5');
    poly([[106,108],[263,108],[287,120],[113,120],[86,140],[82,133]],'#b4e7d9');
    // Reflective pearl inlay follows the near edge rather than flattening the bowl.
    r(117,197,163,3,'#d6e6d2');r(119,201,159,2,'#b7d3c7');r(98,89,167,3,'#fffff4');r(78,103,15,3,'#fffff4');r(300,110,13,3,'#fffff4');
    for(const[x,y]of [[126,177],[161,165],[220,173],[250,160]]){r(x,y,13,1,'#97ddd3');r(x+10,y-3,8,1,'#97ddd3');r(x+4,y+3,2,1,'#c1eee0');}
    for(const[x,y]of [[175,135],[225,128],[203,153]]){r(x,y,3,1,'#d7f9e9');r(x-1,y+1,1,3,'#a7e4d9');r(x+3,y+1,1,3,'#d7f9e9');r(x,y+4,3,1,'#8ed3cc');}
    for(const[x,y,w]of [[120,143,28],[258,154,31],[194,173,34]]){r(x,y,w,2,'#a1dcd4');r(x+5,y+4,w-10,1,'#8bd3cd');}
    // Floating lily pads and pearl petals; every edge stays on the pixel grid.
    for(const[x,y]of [[100,135],[270,128],[288,169]]){r(x-9,y,22,5,'#459c8d');r(x-6,y-3,16,10,'#75c9a8');r(x+2,y-2,2,8,'#c3eed0');r(x-2,y-8,7,6,'#f6d8e6');r(x,y-10,3,9,'#fff4e8');}
    drawFish(g,'ribbon',155,150,1);drawFish(g,'moon',239,145,1,true);
    // Wooden cloud-bank casting deck, pearl fishing rod and rose bobber.
    poly([[44,189],[116,189],[142,212],[132,231],[54,231],[32,213]],'#9f8291');
    poly([[44,183],[116,183],[142,206],[132,220],[54,220],[32,207]],'#e4c9bc');
    for(let n=0;n<5;n++)r(45+n*17,189,2,25,'#bf9e9f');
    r(52,217,75,2,'#b59793');r(49,185,64,2,'#f8e8cc');r(67,202,43,5,'#a8ac9b');
    if(cat)g.drawImage(cat,57,143,64,64);drawHalo(g,fishing.halo,89,145);
    if(['cast','wait','bite','reel'].includes(phase)){poly([[104,170],[142,110],[145,111],[107,173]],'#fff3ca');r(144,112,1,35,'#faffed');r(144,147,14,1,'#faffed');r(157,147,1,13,'#faffed');const bob=!reduced&&phase==='bite'?Math.round(Math.sin(time/120)*2):0;r(153,159+bob,10,4,'#fff9eb');r(155,155+bob,6,6,'#da8daa');r(151,166,15,1,'#c1f9e6');}
  }else{
    // Pearl conservatory aquarium: stepped arch, glass depth and layered aquatic garden.
    poly([[69,76],[95,54],[289,54],[315,76],[324,211],[304,235],[80,235],[60,211]],'#689fa3');
    poly([[64,66],[89,43],[295,43],[320,66],[328,204],[307,226],[77,226],[56,204]],'#f5f9e9');
    poly([[75,74],[97,56],[287,56],[309,74],[315,197],[300,213],[84,213],[69,197]],'#55979f');
    poly([[79,79],[100,62],[284,62],[304,79],[309,192],[296,204],[88,204],[75,191]],'#83c9c4');
    r(81,132,222,28,'#79bdbb');r(84,160,220,26,'#6caaad');
    poly([[113,64],[137,64],[110,170],[92,170]],'#9edbd1');
    poly([[251,64],[259,64],[235,164],[227,164]],'#a9e1d4');
    r(82,90,222,3,'#c8f5e5');r(90,65,4,127,'#d5f9e5');r(96,66,2,90,'#b3e4d9');r(286,67,4,128,'#b1e4d9');
    poly([[77,184],[115,175],[158,185],[198,178],[248,184],[307,176],[309,197],[296,204],[88,204]],'#cfdec4');
    for(const[x,y]of [[104,183],[274,182],[249,188]]){r(x,y-30,3,32,'#3f8e83');r(x-7,y-22,7,4,'#65b39a');r(x+3,y-29,8,5,'#a7d9ae');r(x-6,y-12,8,4,'#8bc4a0');}
    // Layered pearl-leaf beds, sand ripples, little shells and glass bubbles.
    for(const[x,y]of [[94,192],[269,191],[252,195]]){r(x-10,y,25,3,'#8eae9b');for(let j=0;j<3;j++){poly([[x+j*4,y],[x-8+j*3,y-12-j*4],[x-4+j*3,y-15-j*4],[x+3+j*4,y-6]],j%2?'#9ed2ad':'#6daa91');r(x+j*4,y-8,1,8,'#cee5be');}}
    for(const[x,y]of [[150,191],[215,191],[188,198]]){r(x-6,y,16,2,'#a7c0aa');r(x-4,y-4,12,4,'#d4c1b3');r(x-2,y-7,8,4,'#f8e4cd');r(x+1,y-6,1,5,'#bd9d9f');}
    for(const[x,y]of [[107,142],[275,116],[264,96],[115,105]]){r(x,y,3,1,'#edfff0');r(x-1,y+1,1,3,'#ace9dc');r(x+3,y+1,1,3,'#edfff0');r(x,y+4,3,1,'#8dd3c9');}
    r(97,49,187,2,'#fffff3');r(65,91,3,103,'#e4e4d3');r(317,91,3,103,'#d3ddd0');r(85,209,213,2,'#e1e9d2');
    fishing.slots.forEach((id,i)=>{const x=124+(i%3)*67,y=117+Math.floor(i/3)*49;if(id){const drift=reduced?0:Math.round(Math.sin(time/1700+i)*2);drawFish(g,id,x,y+drift,2,i%2===1);}if(i===selected){g.strokeStyle='#365e67';g.lineWidth=1;g.strokeRect(x-27,y-18,54,36);}});
    r(100,216,184,3,'#d8cbbb');r(119,225,35,4,'#c6ac9c');r(230,225,35,4,'#c6ac9c');
    r(166,250,54,4,'#c5d7c3');r(174,253,38,2,'#b0c8ba');
    if(cat)g.drawImage(cat,161,190,64,64);drawHalo(g,fishing.halo,193,190);
  }
  if(fishing.pond==='lanterns'){for(const x of [42,340]){g.globalAlpha=.16;r(x-20,154,43,37,'#fff3bd');r(x-15,149,33,47,'#fff3bd');g.globalAlpha=.26;r(x-12,160,27,28,'#fff6cd');g.globalAlpha=1;r(x-5,225,14,3,'#b7c8b6');r(x,170,3,57,'#728e91');r(x-7,164,18,22,'#b0888f');r(x-5,168,14,14,'#fff0b3');r(x-9,161,22,4,'#ead8bd');r(x+1,171,3,8,'#fffce5');r(x-7,185,18,2,'#927e88');r(x-4,229,13,2,'#dce7cb');}}
  if(fishing.pond==='reeds'){for(const x of [38,335])for(let i=0;i<4;i++){r(x+i*4,207-i*4,2,28+i*4,'#579c89');r(x+i*4-2,201-i*4,6,8,'#e4c4da');r(x+i*4-1,201-i*4,2,3,'#fff8ed');}}
}
export function postcard(scene,frame,name){const c=document.createElement('canvas');c.width=1200;c.height=1008;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle={pearl:'#f8fffc',rose:'#efb7c9',teal:'#bff7ee'}[frame]||'#f8fffc';g.fillRect(0,0,c.width,c.height);g.drawImage(scene,24,24,1152,864);g.fillStyle='#204f50';g.textAlign='center';g.font='36px CloudTitle, serif';g.fillText('Hypurrheaven · Pearl aquarium',600,938);g.font='26px Cloud, sans-serif';g.fillText(`${name} · a little ocean above the clouds`,600,979);return c.toDataURL('image/png');}
