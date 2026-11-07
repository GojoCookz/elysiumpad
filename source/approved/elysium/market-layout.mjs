const key = 'hyperlysium.market.columns';
const choices = [3, 6, 9];

export function marketLayoutControls(h, target, onChange = () => {}) {
  let columns = 3;
  try { const saved = Number(localStorage.getItem(key)); if (choices.includes(saved)) columns = saved; } catch {}
  target.classList.add('market-layout');
  const buttons = choices.map(value => h('button', {
    type: 'button', 'aria-label': `${value} columns`, 'aria-pressed': String(value === columns),
    onclick: () => {
      columns = value;
      try { localStorage.setItem(key, String(value)); } catch {}
      apply();
      onChange();
    },
  }, String(value)));
  function apply() {
    target.dataset.columns = String(columns);
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(choices[index] === columns)));
  }
  apply();
  return h('fieldset', { class: 'market-density' }, h('legend', {}, 'Grid columns'),
    h('div', { class: 'market-density-buttons' }, ...buttons),
    h('small', {}, 'Adapts on smaller screens'));
}
