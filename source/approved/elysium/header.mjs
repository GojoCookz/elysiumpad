import { appendWalletIcon } from '../wallet-icons.mjs';
export function reviewTransaction({ h, title, rows, trigger }) {
  return new Promise(resolve => {
    const dialog = h('dialog', { class: 'ely-dialog purr-review-dialog', 'aria-label': title });
    const finish = accepted => { dialog.close(); dialog.remove(); trigger?.focus(); resolve(accepted); };
    dialog.append(h('h2', {}, title), h('dl', { class: 'purr-kv' }, ...rows.map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, String(value))))),
      h('button', { class: 'ely-btn primary', type: 'button', onclick: () => finish(true) }, 'Continue to wallet'),
      h('button', { class: 'ely-btn', type: 'button', onclick: () => finish(false) }, 'Cancel'));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    document.body.append(dialog); dialog.showModal();
  });
}
export function dedupeWallets(rows) {
  const found = [], ids = new Set();
  for (const row of rows) {
    const name = row.name || row.info?.name || 'Browser wallet';
    const id = (row.info?.rdns || name.replace(/\s*wallet$/i, '')).toLowerCase();
    if (ids.has(id) || found.some(x => row.provider && x.provider === row.provider || row.standard && x.standard === row.standard)) continue;
    ids.add(id); found.push({ ...row, name, icon: row.icon || row.info?.icon });
  }
  return found;
}
export function walletDialog({ h, trigger, title, rows, choose, actions = [], note = '' }) {
  const dialog = h('dialog', { class: 'ely-dialog purr-wallet-dialog', 'aria-label': title });
  const close = () => { dialog.close(); dialog.remove(); if (trigger?.isConnected) trigger.focus(); };
  dialog.append(h('h2', {}, title));
  if (note) dialog.append(h('p', { class: 'ely-muted' }, note));
  for (const row of rows || []) {
    const button = h('button', { class: 'ely-btn purr-wallet-option', 'aria-pressed': String(Boolean(row.selected)), onclick: () => { close(); choose(row); } });
    appendWalletIcon(button, row); dialog.append(button);
  }
  for (const action of actions) dialog.append(action.href ? h('a', { class: 'ely-btn', href: action.href, target: '_blank', rel: 'noopener noreferrer' }, action.label) : h('button', { class: 'ely-btn', onclick: () => { close(); action.run(); } }, action.label));
  dialog.append(h('button', { class: 'ely-btn', onclick: close }, 'Close'));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  dialog.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...dialog.querySelectorAll('button,a')], index = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    event.preventDefault(); items[next]?.focus();
  });
  document.body.append(dialog); dialog.showModal(); return close;
}
