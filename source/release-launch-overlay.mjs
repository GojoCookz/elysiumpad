// Presentation-only overlay on the approved Elysium launch source. The builder,
// default state, fee math, contracts, approvals, and send path are untouched.
export function exposeEvmRewards(source){
 const controls="h('div', { class: 'purr-field' }, h('span', {}, 'Where the fee goes'), bar, legend, presets, sH.el, sB.el),";
 for(const marker of [controls,'      cost, go,','  function preview() {',"      ['Anti-snipe', '50% → buy fee · 120 s']"])if(!source.includes(marker))throw Error('Approved Elysium launch source changed: '+marker);
 source=source.replace(controls,'');
 source=source.replace('  function preview() {',"  const allocationSummary = h('p', {role:'status', 'aria-live':'polite', class:'ely-muted'});\n  function preview() {\n    allocationSummary.textContent = `Allocation: ${st.you}% creator · ${st.holders}% holders · ${st.burn}% buyback & burn. Fees: ${st.buy}% buy / ${st.sell}% sell.`;");
 source=source.replace('      cost, go,',"      h('section', {class:'purr-field', 'aria-label':'Elysium rewards'}, h('h2', {}, 'Elysium rewards'), h('p', {}, 'Choose the allocation for your Elysium coin. Platform and keeper deductions still apply.'), "+controls.slice(0,-1)+", allocationSummary),\n      cost, go,");
 source=source.replace("      ['Anti-snipe', '50% → buy fee · 120 s']","      ['Selected allocation', `${st.you}% creator · ${st.holders}% holders · ${st.burn}% buyback & burn`],\n      ['Anti-snipe', '50% → buy fee · 120 s']");
 return source;
}
