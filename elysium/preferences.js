// Blocking, same-origin head script: apply the saved theme before styles paint.
(() => {
  const root = document.documentElement;
  const media = matchMedia('(prefers-color-scheme: dark)');
  let theme = 'system', language = '';
  try { theme = localStorage.getItem('hyperlysium.theme') || 'system'; language = localStorage.getItem('hyperlysium.locale') || ''; } catch {}
  if (!['system', 'light', 'dark', 'blossom'].includes(theme)) theme = 'system';
  const apply = () => {
    root.dataset.themePreference = theme;
    root.dataset.theme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme;
    root.style.colorScheme = root.dataset.theme === 'dark' ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', root.dataset.theme === 'dark' ? '#10282c' : root.dataset.theme === 'blossom' ? '#fff5f7' : '#e9f8f3');
  };
  window.hyperlysiumPreferences = {
    language,
    setTheme(value) { if (!['system', 'light', 'dark', 'blossom'].includes(value)) return; theme = value; try { localStorage.setItem('hyperlysium.theme', value); } catch {} apply(); },
  };
  media.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  apply();
})();
