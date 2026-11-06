import { L, isAr } from '../core.js';
import { h, icon, refreshIcons } from '../util.js';
import { TEMPLATES, CATEGORIES, drawTemplate, tplTitle, elFont } from '../templates-data.js';

// Lazily draws previews when cards scroll into view.
export function observePreviews(scope) {
  const ar = isAr();
  const draw = async (cv) => {
    const t = TEMPLATES.find(x => x.id === cv.dataset.tpl); if (!t) return;
    const fams = new Set(t.els.filter(e => e.t === 'text').map(e => elFont(e, ar)));
    await Promise.all([...fams].map(f => document.fonts.load('16px "' + f + '"').catch(() => 0)));
    drawTemplate(cv, t, ar, 360); cv.classList.add('ready');
  };
  if (!('IntersectionObserver' in window)) { scope.querySelectorAll('canvas[data-tpl]').forEach(draw); return () => {}; }
  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); draw(e.target); } }), { rootMargin: '200px' });
  scope.querySelectorAll('canvas[data-tpl]').forEach(c => io.observe(c));
  return () => io.disconnect();
}
export function templateCard(t) {
  const cv = h('canvas', { 'data-tpl': t.id, class: 'tpl-canvas', role: 'img', 'aria-label': tplTitle(t, isAr()) });
  cv.width = 360; cv.height = Math.round(360 * t.h / t.w);
  const cat = CATEGORIES.find(c => c[0] === t.cat);
  return h('a', { class: 'card tpl', href: '#/studio?tpl=' + t.id }, h('div', { class: 'tpl-thumb' }, cv), h('strong', null, tplTitle(t, isAr())),
    h('span', { class: 'muted small' }, (isAr() ? cat[2] : cat[1]) + ' · ' + t.w + ' × ' + t.h));
}

export async function mount(root, params) {
  let cat = params.get('cat') || 'all', q = '', stop = () => {};
  const grid = h('div', { class: 'grid cards tpls' }), chips = h('div', { class: 'chips', role: 'group', 'aria-label': L('Categories', 'الفئات') });
  const search = h('input', { class: 'input', type: 'search', placeholder: L('Search templates…', 'ابحث في القوالب…'), 'aria-label': L('Search templates', 'ابحث في القوالب') });
  function draw() {
    stop(); const k = q.trim().toLowerCase();
    const list = TEMPLATES.filter(t => (cat === 'all' || t.cat === cat) && (!k || (t.title[0] + ' ' + t.title[1] + ' ' + t.cat).toLowerCase().includes(k)));
    grid.replaceChildren(...(list.length ? list.map(templateCard) : [h('div', { class: 'empty' }, icon('search-x'), h('h3', null, L('No templates found', 'لم يتم العثور على قوالب')), h('p', null, L('Try a different search or category.', 'جرّب بحثاً أو فئة مختلفة.')),
      h('button', { class: 'btn', onclick: () => { cat = 'all'; q = ''; search.value = ''; renderChips(); draw(); } }, L('Clear filters', 'مسح التصفية')))]));
    stop = observePreviews(grid); refreshIcons();
  }
  function renderChips() {
    chips.replaceChildren(...[['all', 'All', 'الكل'], ...CATEGORIES].map(([k, en, ar]) => h('button', { class: 'chip' + (cat === k ? ' active' : ''), 'aria-pressed': cat === k, onclick: () => { cat = k; renderChips(); draw(); } }, L(en, ar))));
  }
  search.addEventListener('input', () => { q = search.value; draw(); });
  root.append(h('div', { class: 'page' }, h('h1', null, L('Templates', 'القوالب')), h('p', { class: 'muted' }, L('Original, fully editable designs. Open one in the Design Studio and make it yours.', 'تصاميم أصلية قابلة للتعديل بالكامل. افتح أي قالب في استوديو التصميم وخصّصه.')), search, chips, grid));
  renderChips(); draw();
  return () => stop();
}
