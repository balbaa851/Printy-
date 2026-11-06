// Settings, language helper, shared state.
const KEY = 'printy.settings.v1';
const defaults = {
  lang: (navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en',
  theme: 'light',
  autosave: true,
  autosaveSec: 5,
  perf: 'auto' // auto | low | mid | high — see js/perf.js
};
function load() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...defaults }; }
}
export const VERSION = '1.0.0';
export const settings = load();
export const bus = new EventTarget();
export const guard = { dirty: false };
// Pages register async callbacks here to persist state before the language re-renders the view.
export const hooks = { beforeLang: new Set() };

export function applyDocument() {
  const d = document.documentElement;
  d.lang = settings.lang;
  d.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
  let theme = settings.theme;
  if (theme === 'system') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  d.dataset.theme = theme;
}
export function setSetting(k, v) {
  settings[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage may be blocked */ }
  applyDocument();
  bus.dispatchEvent(new CustomEvent('settings', { detail: { key: k } }));
}
// Pick the string for the current language.
export const L = (en, ar) => (settings.lang === 'ar' && ar != null ? ar : en);
export const isAr = () => settings.lang === 'ar';
