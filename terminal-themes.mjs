// One contrast-tested token contract for every palette and both appearance modes.
export const PALETTES=Object.freeze({
 leveragepad:{name:'Cyberpunk Aqua',dark:['#060c0f','#0c191e','#142c32','#45efd1'],light:['#edf9f7','#d8eeeb','#006c63']},
 bitcoin:{name:'Bitcoin Orange',dark:['#100c08','#1b1510','#2c231a','#ff8533'],light:['#fff6ee','#f6e7d8','#a84000']},
 hyper:{name:'Hyper Mint',dark:['#071110','#10201d','#1b332d','#31dfbc'],light:['#eefaf6','#dcefe8','#006951']},
 solana:{name:'Solana Violet',dark:['#100c18','#1a1427','#2c2240','#c29bff'],light:['#f7f2ff','#ece3fa','#6433ae']},
 ember:{name:'Ember',dark:['#130d0c','#241613','#36221b','#ff9478'],light:['#fff3ee','#f7e4dc','#a52c19']},
 ocean:{name:'Ocean',dark:['#07121a','#102330','#1a3445','#60c8ff'],light:['#edf7fc','#ddecf6','#005b91']},
 forest:{name:'Forest',dark:['#0a1510','#14271b','#203c2a','#84dda0'],light:['#f0f8f1','#dfeddf','#236c3c']},
 rose:{name:'Rose',dark:['#170d15','#291724','#3b2434','#ff99c6'],light:['#fff1f7','#f4dfe9','#a42062']},
 gold:{name:'Gold',dark:['#16130a','#262111','#39301b','#f2cf69'],light:['#fff8df','#f1e8c7','#795800']},
 arctic:{name:'Arctic',dark:['#081517','#10282b','#1a3a3d','#8ae4ec'],light:['#ecfbfc','#d9edef','#006674']},
 graphite:{name:'Graphite',dark:['#101215','#1b1f25','#2b313a','#d1d7e0'],light:['#f3f5f7','#e2e7ed','#34465b']},
 crimson:{name:'Crimson',dark:['#180b10','#2a141d','#3c202b','#ff8f9b'],light:['#fff0f3','#f4dfe5','#a91b39']},
 cobalt:{name:'Cobalt',dark:['#0c1020','#171f35','#25304b','#9dacff'],light:['#f1f4ff','#e1e7fa','#334fba']}
});
export function themeTokens(palette='leveragepad',mode='dark'){
 const p=PALETTES[palette]||PALETTES.leveragepad,dark=mode!=='light';
 const [bg,panel,raised,accent]=dark?p.dark:[p.light[0],'#ffffff',p.light[1],p.light[2]];
 const rgb=hex=>hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)).join(',');
  const cyber=p===PALETTES.leveragepad;
  return {'--bg':bg,'--panel':panel,'--raised':raised,'--line':cyber?(dark?'#557f85':'#5f8582'):(dark?'#6d7c8f':'#7d8b9a'),'--ink':cyber?(dark?'#e7fbf7':'#102c2a'):(dark?'#f0f4fa':'#122033'),'--muted':cyber?(dark?'#a7c6c6':'#3c615c'):(dark?'#b3c1d2':'#46566a'),'--accent':accent,'--accent-ink':dark?'#071019':'#ffffff','--green':dark?'#75e8b3':'#006b47','--red':dark?'#ffa3b8':'#a9193d','--chart-up':dark?'#75e8b3':'#006b47','--chart-down':dark?'#ffa3b8':'#a9193d','--chart-grid':cyber?(dark?'#244448':'#c6dfdb'):(dark?'#344255':'#d1dbe6'),'--jupiter-plugin-primary':rgb(accent),'--jupiter-plugin-primaryText':rgb(cyber?(dark?'#e7fbf7':'#102c2a'):(dark?'#f0f4fa':'#122033')),'--jupiter-plugin-background':rgb(bg),'--jupiter-plugin-module':rgb(panel),'--jupiter-plugin-interactive':rgb(raised)};
}
export function applyThemeTokens({product,palette,mode='dark'}){
 const chosen=product==='leveragepad'&&Object.hasOwn(PALETTES,palette)?palette:product;
 const tokens=themeTokens(chosen,mode);for(const [key,value] of Object.entries(tokens))document.documentElement.style.setProperty(key,value);
 document.documentElement.dataset.palette=chosen;document.documentElement.dataset.theme=mode;document.documentElement.style.colorScheme=mode;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',tokens['--bg']);
}
