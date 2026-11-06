import { settings, setSetting, applyDocument, L, bus, guard, hooks, isAr } from './core.js';
import { h, icon, refreshIcons, spinner, confirmDialog, loadFonts, $ } from './util.js';
import { watchRibbon } from './ribbon.js';
import './perf.js'; // sets <html data-perf="low|mid|high"> before the first page renders

applyDocument();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyDocument);

const ROUTES = {
  '': { load: () => import('./pages/home.js') },
  studio: { load: () => import('./pages/studio.js'), full: true },
  photo: { load: () => import('./pages/photo.js'), full: true },
  removebg: { load: () => import('./pages/removebg.js'), full: true },
  templates: { load: () => import('./pages/templates.js') },
  print: { load: () => import('./pages/print.js'), full: true },
  tools: { load: () => import('./pages/tools.js') },
  projects: { load: () => import('./pages/projects.js') },
  settings: { load: () => import('./pages/settings.js') },
  about: { load: () => import('./pages/static.js') },
  privacy: { load: () => import('./pages/static.js') },
  terms: { load: () => import('./pages/static.js') },
  contact: { load: () => import('./pages/static.js') }
};
const NAV = [
  ['', 'Home', 'الرئيسية'], ['studio', 'Design Studio', 'استوديو التصميم'], ['photo', 'Photo Editor', 'محرر الصور'],
  ['templates', 'Templates', 'القوالب'], ['print', 'Print Center', 'مركز الطباعة'], ['tools', 'Image Tools', 'أدوات الصور'], ['projects', 'Projects', 'مشاريعي']
];

const view = $('#main');
let cleanup = null, tok = 0, current = '';

export function logo() {
  return h('a', { class: 'logo', href: '#/', 'aria-label': 'PRINTY' },
    h('svg', { viewBox: '0 0 32 32', width: '28', height: '28', 'aria-hidden': 'true' }), h('span', null, 'PRINTY'));
}
function logoMark() {
  const a = logo();
  a.querySelector('svg').outerHTML = '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#7c3aed"/><path d="M10 24V8h7a5 5 0 010 10h-7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return a;
}

function renderHeader() {
  const hd = $('#header');
  const menu = h('nav', { id: 'nav', class: 'nav', 'aria-label': L('Main', 'الرئيسية') },
    NAV.map(([r, en, ar]) => h('a', { href: '#/' + r, class: 'nav-link' + (r === current ? ' active' : ''), 'aria-current': r === current ? 'page' : null }, L(en, ar))));
  const burger = h('button', { class: 'btn icon burger', 'aria-label': L('Menu', 'القائمة'), 'aria-expanded': 'false', 'aria-controls': 'nav',
    onclick: (e) => { const o = menu.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); } }, icon('menu'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  const dark = document.documentElement.dataset.theme === 'dark';
  hd.replaceChildren(h('div', { class: 'header-in' },
    logoMark(), menu,
    h('div', { class: 'header-tools' },
      h('button', { class: 'btn sm lang', 'aria-label': L('Switch language to Arabic', 'التبديل إلى الإنجليزية'), onclick: switchLang }, isAr() ? 'English' : 'العربية'),
      h('button', { class: 'btn icon', 'aria-label': L('Toggle theme', 'تبديل السمة'), onclick: () => { setSetting('theme', dark ? 'light' : 'dark'); renderHeader(); } }, icon(dark ? 'sun' : 'moon')),
      h('a', { class: 'btn icon', href: '#/settings', 'aria-label': L('Settings', 'الإعدادات') }, icon('settings')),
      burger)));
  refreshIcons();
}
function renderFooter() {
  $('#footer').replaceChildren(h('div', { class: 'footer-in' },
    h('div', null, logoMark(), h('p', { class: 'muted' }, L('Create. Edit. Print.', 'أنشئ. حرّر. اطبع.')),
      h('p', { class: 'muted small' }, L('Everything runs in your browser. Your files never leave your device.', 'كل شيء يعمل داخل متصفحك. ملفاتك لا تغادر جهازك.'))),
    h('nav', { class: 'footer-links', 'aria-label': L('Footer', 'التذييل') },
      [['about', 'About', 'حول'], ['privacy', 'Privacy', 'الخصوصية'], ['terms', 'Terms', 'الشروط'], ['contact', 'Contact', 'اتصل بنا']]
        .map(([r, en, ar]) => h('a', { href: '#/' + r }, L(en, ar))))));
}
async function switchLang() {
  for (const fn of [...hooks.beforeLang]) { try { await fn(); } catch (e) { console.error(e); } }
  setSetting('lang', isAr() ? 'en' : 'ar');
  renderHeader(); renderFooter();
  route({ relang: true });
}

async function route(opts = {}) {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const name = path.split('/')[0];
  const params = new URLSearchParams(qs || '');
  const def = ROUTES[name];
  const my = ++tok;
  if (cleanup) { try { await cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  guard.dirty = false;
  current = def ? name : '';
  renderHeader();
  document.body.classList.toggle('fullscreen', !!def?.full);
  view.replaceChildren(spinner());
  if (!def) { view.replaceChildren(notFound()); document.title = '404 — PRINTY'; refreshIcons(); return; }
  document.title = (NAV.find(n => n[0] === name)?.[1] || 'PRINTY') + ' — PRINTY';
  if (['studio', 'photo', 'templates', 'print'].includes(name)) loadFonts('design');
  try {
    const mod = await def.load();
    if (my !== tok) return;
    view.replaceChildren();
    const c = await mod.mount(view, params, { route: name, relang: !!opts.relang });
    if (my !== tok) { c && (await c()); return; }
    cleanup = c || null;
  } catch (e) {
    console.error(e);
    view.replaceChildren(h('div', { class: 'empty' }, icon('triangle-alert'), h('h2', null, L('Something went wrong', 'حدث خطأ ما')),
      h('p', null, e.message || String(e)), h('a', { class: 'btn primary', href: '#/' }, L('Back to home', 'العودة للرئيسية'))));
  }
  refreshIcons();
  if (!opts.relang) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
}
function notFound() {
  return h('div', { class: 'empty big' }, h('div', { class: 'nf' }, '404'), h('h2', null, L('Page not found', 'الصفحة غير موجودة')),
    h('p', null, L('The page you are looking for does not exist.', 'الصفحة التي تبحث عنها غير موجودة.')),
    h('a', { class: 'btn primary', href: '#/' }, L('Back to home', 'العودة للرئيسية')));
}

// Guard in-app navigation when there is unsaved work and autosave is off.
document.addEventListener('click', async (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a || !guard.dirty || settings.autosave) return;
  e.preventDefault();
  const ok = await confirmDialog({ title: L('Leave without saving?', 'المغادرة دون حفظ؟'), message: L('You have unsaved changes that will be lost.', 'لديك تغييرات غير محفوظة ستُفقد.'), confirmText: L('Leave', 'مغادرة'), danger: true });
  if (ok) { guard.dirty = false; location.hash = a.getAttribute('href'); }
});
window.addEventListener('beforeunload', (e) => { if (guard.dirty) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('hashchange', () => route());
bus.addEventListener('settings', (e) => { if (e.detail.key === 'theme') renderHeader(); });

renderHeader(); renderFooter();
route();
window.addEventListener('load', () => loadFonts('ui'));
watchRibbon(view);
