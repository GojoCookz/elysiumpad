import {CURRICULUM,getLesson} from './education/curriculum.mjs';
import {PATTERN_DEFINITIONS,indexCandlePatterns} from './education/candle-patterns.mjs';
const n=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
const button=(text,action)=>{const el=n('button','utility-button',text);el.type='button';el.addEventListener('click',action);return el;};
const intervals={'1m':60000,'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};
export function sourcePatternIndex({data,frame,now=Date.now()}){
 const intervalMs=intervals[frame],checkedAt=Date.parse(data?.checkedAt);
 if(data?.synthetic!==false||!Array.isArray(data.candles)||data.candles.length>2000||!intervalMs||!Number.isSafeInteger(checkedAt)||!Number.isSafeInteger(now))throw new Error('A bounded, timestamped source-candle response is required.');
 const asOf=Math.min(now,checkedAt);
 const bars=data.candles.map(bar=>({...bar,time:bar.time*1000,closeTime:bar.time*1000+intervalMs}));
 return {...indexCandlePatterns(bars,{asOf,intervalMs,maxExamples:3}),asOf};
}
export function mountTradingLibrary({product,onPaper,onTour}){
 const dialog=n('dialog','education-dialog');dialog.setAttribute('aria-labelledby','education-title');
 const header=n('div','education-header'),heading=n('h2','','Trading field notes');heading.id='education-title';
 header.append(heading,button('Close',()=>dialog.close()));
 const intro=n('p','education-intro','Learn the mechanics. Test the hypothesis. Keep the evidence.');
 const language=n('small','','Lessons are currently in English. Terminal language preferences are unchanged.');
 const tools=n('div','education-tools');tools.append(button('Quick terminal tour',()=>{dialog.close();onTour();}),button('Open paper demo',()=>{dialog.close();onPaper();}));
 const exportData=button('Export learning data',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({curriculum:CURRICULUM,patterns:PATTERN_DEFINITIONS},null,2)],{type:'application/json'}));const link=n('a');link.href=url;link.download=`${product}-trading-fundamentals.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});tools.append(exportData);
 const label=n('label','','Search lessons and exercises');label.htmlFor='education-search';const search=n('input');search.id='education-search';search.name='lesson-search';search.autocomplete='off';search.type='search';search.placeholder='Try risk, supply, order blocks…';
 const layout=n('div','education-layout'),nav=n('nav','education-index'),article=n('article','education-lesson');nav.setAttribute('aria-label','Trading lessons');article.setAttribute('aria-label','Selected lesson');
 const results=n('p','education-results');results.setAttribute('role','status');let selected=CURRICULUM.lessons[0].id,chart=null;
 const patterns=n('section','education-patterns');patterns.setAttribute('aria-label','Candle geometry index');
 const risk=n('p','education-risk',CURRICULUM.riskNotice);layout.append(nav,article);dialog.append(header,intro,language,tools,label,search,results,layout,patterns,risk);document.body.append(dialog);
 function renderLesson(id){
  const lesson=getLesson(id);if(!lesson)return;selected=id;article.replaceChildren();
  article.append(n('small','education-evidence',`${lesson.category} · ${lesson.evidence}`),n('h3','',lesson.title),n('p','',lesson.body));
  const example=n('section','education-example');example.append(n('h4','',lesson.example.label),n('p','',lesson.example.body));article.append(example);
  article.append(n('h4','','Work the problem before opening the answer'));
  article.append(n('small','','Practice responses are not saved and clear when you switch lessons.'));
  for(const exercise of lesson.exercises){const item=n('section','education-exercise'),answer=n('details'),summary=n('summary','','Reveal worked answer');const response=n('textarea');response.rows=2;response.name=exercise.id;response.autocomplete='off';response.setAttribute('aria-label',`Your practice response: ${exercise.id}`);response.placeholder='Your reasoning (not saved)…';answer.append(summary,n('p','',exercise.answer),n('p','',exercise.explanation));item.append(n('p','',exercise.prompt),response,answer);article.append(item);}
  for(const refId of lesson.references){const ref=CURRICULUM.references.find(row=>row.id===refId),link=n('a','education-reference',`${ref.publisher}: ${ref.title} ↗`);link.href=ref.url;link.target='_blank';link.rel='noopener noreferrer';article.append(link,n('small','',ref.limits));}
  nav.querySelectorAll('button').forEach(el=>el.setAttribute('aria-current',String(el.dataset.lesson===id)));
 }
 function renderIndex(){
  const normalize=value=>value.toLowerCase().replace(/-/g,' '),query=normalize(search.value.trim()),rows=CURRICULUM.lessons.filter(lesson=>normalize(JSON.stringify(lesson)).includes(query));nav.replaceChildren();results.textContent=`${rows.length} of ${CURRICULUM.lessons.length} lessons · ${CURRICULUM.lessons.reduce((sum,row)=>sum+row.exercises.length,0)} exercises`;
  for(const lesson of rows){const item=button(lesson.title,()=>renderLesson(lesson.id));item.dataset.lesson=lesson.id;item.setAttribute('aria-current',String(selected===lesson.id));nav.append(item);}
  if(!rows.length){article.replaceChildren(n('p','','No matching lessons. Try a broader term.'));return;}renderLesson(rows.some(row=>row.id===selected)?selected:rows[0].id);
 }
 function renderPatterns(){
  patterns.replaceChildren(n('h3','','Candle geometry lab'),n('p','','Shapes describe closed-bar geometry, not trade signals or institutional orders. No performance or predictive edge is claimed.'));
  const definitions=n('details'),summary=n('summary','','Read all 10 exact definitions');definitions.append(summary);for(const row of PATTERN_DEFINITIONS)definitions.append(n('h4','',row.title),n('p','',row.body));patterns.append(definitions);
  if(!chart){patterns.append(n('p','','Select a market and load its source chart to index observed candle shapes. No substitute history is generated.'));return;}
  patterns.append(n('p','',`${chart.token.symbol} · ${chart.frame} · ${chart.data.source}. Completion is inferred from interval boundaries and source retrieval time, not exchange-confirmed closure.`));
  try{const result=sourcePatternIndex(chart);patterns.append(n('small','',`${result.eligibleBars} eligible bars · ${result.totalMatches} shape matches (a bar may have multiple labels). Cutoff ${new Date(result.asOf).toISOString()}.`));const list=n('ul');for(const row of result.patterns){const definition=PATTERN_DEFINITIONS.find(item=>item.id===row.id);list.append(n('li','',`${definition.title}: ${row.count}${row.examples.length?` · examples ${row.examples.map(example=>new Date(example.time).toISOString()).join(', ')}`:''}`));}patterns.append(list);}
  catch{patterns.append(n('p','','This source response could not be indexed safely. Check OHLC consistency, timestamps and timeframe; no bars were repaired or invented.'));}
 }
 search.addEventListener('input',renderIndex);renderIndex();renderPatterns();
 return {open(){dialog.showModal();dialog.scrollTop=0;},setChart(value){chart=value;renderPatterns();}};
}
