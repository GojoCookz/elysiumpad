// Two static vector textures move on the compositor. No frame loop, animated
// filters, pointer tracking, canvas, or market-data animation.
export function aquaticMotion(h, hero) {
  const preference = 'hyperlysium.waterMotion';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true, visible = true;
  try { enabled = localStorage.getItem(preference) !== 'off'; } catch {}
  const state = h('span', { class: 'hlys-motion-state' });
  const control = h('button', { class: 'hlys-motion-control', type: 'button', 'aria-pressed': 'true',
    onclick: () => { enabled = !enabled; try { localStorage.setItem(preference, enabled ? 'on' : 'off'); } catch {} apply(); },
  }, h('span', {}, 'Water motion'), state);
  const water = h('div', { class: 'hlys-water', 'aria-hidden': 'true' },
    h('div', { class: 'hlys-water-light hlys-water-near' }),
    h('div', { class: 'hlys-water-light hlys-water-far' }));
  hero.prepend(water);
  function apply() {
    hero.dataset.waterState = reduced.matches ? 'reduced' : enabled && visible && !document.hidden ? 'running' : 'paused';
    control.setAttribute('aria-pressed', String(enabled && !reduced.matches));
    control.disabled = reduced.matches;
    state.textContent = reduced.matches ? 'Reduced motion' : enabled ? 'On' : 'Off';
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; apply(); });
  observer.observe(hero);
  reduced.addEventListener('change', apply);
  document.addEventListener('visibilitychange', apply);
  apply();
  return { control, destroy() { observer.disconnect(); reduced.removeEventListener('change', apply); document.removeEventListener('visibilitychange', apply); } };
}
