// Purrlysium gate: the doors open once per browser session. Loaded synchronously in <head> so the
// class is set before first paint. Without this script (or storage) the gate simply never shows.
(() => {
  const root = document.documentElement;
  let seen = true;
  try {
    seen = sessionStorage.getItem('purrlysium-gate') === '1';
    sessionStorage.setItem('purrlysium-gate', '1');
  } catch { /* storage blocked: skip the gate */ }
  root.classList.add(seen ? 'purr-gate-seen' : 'purr-gate-play');
})();
