import { TRANSLATIONS } from '../terminal-locales.mjs';
import { LAUNCHPAD_TRANSLATIONS } from '../launchpad-locales.mjs';
import { PAD_DICTIONARIES } from './locales.mjs';
import { CREATOR_DICTIONARIES } from './creator-locales.mjs';
import { PAD_LANGUAGES, preferredPadLanguage } from './preferences.mjs';
const aliases = { 'pt-BR': 'pt', 'zh-CN': 'zh' };
const dictionaries = Object.fromEntries(Object.keys(PAD_LANGUAGES).map(language => [language, {
  ...(TRANSLATIONS[aliases[language] || language] || {}),
  ...(LAUNCHPAD_TRANSLATIONS[aliases[language] || language] || {}),
  ...PAD_DICTIONARIES[language],
  ...CREATOR_DICTIONARIES[language],
}]));
let language = 'en';
export const locale = () => typeof document !== 'undefined' && Object.hasOwn(PAD_LANGUAGES, document.documentElement.lang) ? document.documentElement.lang : language;
export function setLanguage(value) {
  language = preferredPadLanguage(value);
  if (typeof document !== 'undefined') { document.documentElement.lang = language; document.documentElement.dir = 'ltr'; }
}
const templates = Object.keys({...PAD_DICTIONARIES.en,...CREATOR_DICTIONARIES.en}).filter(key => key.includes('{')).map(key => {
  const parameters = [];
  const pattern = key.split(/(\{\w+\})/g).map(part => {
    if (/^\{\w+\}$/.test(part)) { parameters.push(part.slice(1, -1)); return '(.+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { key, parameters, pattern: new RegExp(`^${pattern}$`) };
});
export function t(text) {
  const language = locale();
  if (typeof text !== 'string' || language === 'en') return text;
  if (Object.hasOwn(dictionaries[language], text)) return dictionaries[language][text] || text;
  for (const { key, parameters, pattern } of templates) {
    const match = text.match(pattern); if (!match) continue;
    return (dictionaries[language][key] || key).replace(/\{(\w+)\}/g, (_, name) => {
      const value = match[parameters.indexOf(name) + 1];
      return ['section', 'label', 'mode'].includes(name) ? t(value) : value;
    });
  }
  return text;
}
// Exact display formatting without converting transaction units through Number.
export function formatDecimal(value, chosen = locale()) {
  const match = String(value).match(/^(-?\d+)(?:\.(\d+))?$/); if (!match) return String(value);
  const integer = new Intl.NumberFormat(chosen, { maximumFractionDigits: 0 }).format(BigInt(match[1]));
  const decimal = new Intl.NumberFormat(chosen).formatToParts(1.1).find(part => part.type === 'decimal')?.value || '.';
  return integer + (match[2] ? decimal + match[2] : '');
}
export const validDecimalInput = text => /^(?:\d+\.?\d*|\.\d+)$/.test(text);
const PROTECTED = 'script,style,code,input,textarea,[data-no-translate],[translate="no"],.purr-post-text,.purr-coin-id h2,.purr-coin-id span,.purr-coin-desc,.purr-pv-desc,.purr-tick>b,.purr-tick-item>b,.purr-board-coin,.purr-chip,.purr-pad-tag,.purr-king-body,.market-token-icon,.market-token-heading h1,.market-token-link,.purr-wallet-option,#sol-quote,#sol-funding,.purr-config li';
export function watchPadCopy() {
  const records = new WeakMap(), attributes = new WeakMap(); let queued = false;
  const apply = () => {
    queued = false;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest(PROTECTED)) continue;
      const current = node.textContent, record = records.get(node);
      const original = record?.written === current ? record.original : current;
      const text = original.trim(), rendered = text ? original.replace(text, t(text)) : original;
      records.set(node, { original, written: rendered });
      if (current !== rendered) node.textContent = rendered;
    }
    for (const element of document.querySelectorAll('[aria-label],[placeholder],[title],[data-label]')) {
      if (element.closest(PROTECTED.replace('input,textarea,', ''))) continue;
      let saved = attributes.get(element); if (!saved) { saved = new Map(); attributes.set(element, saved); }
      for (const name of ['aria-label', 'placeholder', 'title', 'data-label']) {
        if (!element.hasAttribute(name)) continue;
        const current = element.getAttribute(name), record = saved.get(name);
        const original = record?.written === current ? record.original : current, rendered = t(original);
        saved.set(name, { original, written: rendered });
        if (current !== rendered) element.setAttribute(name, rendered);
      }
    }
  };
  const observer = new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(apply); } });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder', 'title', 'data-label'] });
  apply(); return apply;
}
