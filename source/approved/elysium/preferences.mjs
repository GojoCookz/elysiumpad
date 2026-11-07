export const PAD_LANGUAGES = { en: 'English', es: 'Español', 'pt-BR': 'Português (Brasil)', 'zh-CN': '简体中文', ja: '日本語', ko: '한국어' };
export function preferredPadLanguage(saved, languages = []) {
  if (Object.hasOwn(PAD_LANGUAGES, saved)) return saved;
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'zh') return 'zh-CN';
    if (Object.hasOwn(PAD_LANGUAGES, base)) return base;
  }
  return 'en';
}
export function mountPreferences({ setLanguage, translate }) {
  const language = preferredPadLanguage(window.hyperlysiumPreferences?.language, navigator.languages || [navigator.language]);
  setLanguage(language);
  const blossomMark = document.createElement('span'); blossomMark.className = 'pad-blossom-mark'; blossomMark.setAttribute('aria-hidden', 'true'); blossomMark.textContent = '♡';
  document.querySelector('.ely-brand')?.append(blossomMark);
  const menu = document.createElement('details'); menu.className = 'pad-settings';
  const summary = document.createElement('summary'); summary.textContent = 'Settings'; menu.append(summary);
  const bar = document.createElement('section'); bar.className = 'pad-preferences'; bar.setAttribute('aria-label', 'Display preferences'); menu.append(bar);
  menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; summary.focus(); } });
  menu.addEventListener('focusout', event => { if (!menu.contains(event.relatedTarget)) menu.open = false; });
  const choice = (title, id, values, selected, change) => {
    const label = document.createElement('label'); label.htmlFor = id;
    const caption = document.createElement('span'); caption.textContent = title;
    const select = document.createElement('select'); select.id = id; select.name = id;
    for (const [value, text] of Object.entries(values)) {
      const option = new Option(text, value); if (id === 'pad-language') { option.lang = value; option.dataset.noTranslate = ''; } select.append(option);
    }
    select.value = selected; select.addEventListener('change', () => change(select.value));
    label.append(caption, select); bar.append(label);
  };
  choice('Language', 'pad-language', PAD_LANGUAGES, language, value => {
    try { localStorage.setItem('hyperlysium.locale', value); } catch {}
    setLanguage(value); translate();
  });
  choice('Theme', 'pad-theme', { system: 'System', light: 'Light', dark: 'Dark', blossom: 'Blossom' }, document.documentElement.dataset.themePreference || 'system', value => window.hyperlysiumPreferences?.setTheme(value));
  const note = document.createElement('small'); note.textContent = 'Initial language set · machine-translated'; bar.append(note);
  const risk = document.querySelector('.ely-risk'); if (risk) { risk.open = false; bar.append(risk); }
  document.querySelector('.ely-top').append(menu);
  translate();
}
