// Foxit-style ribbon: tab strip + big icon buttons. It mirrors each page's existing toolbar and tab panel,
// so every editor (Studio, Photo, Print, Image Tools) gets the same top bar without changing its logic.
import { h } from './util.js';
import { L } from './core.js';

export function watchRibbon(main) {
  let rib = null, active = 'home', anchor = null, raf = 0;
  const OPTS = { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-pressed', 'aria-selected'] };
  const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; build(); }); });
  const text = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim();
  const label = (e) => { const t = text(e); return (t.length > 1 ? t : (e.getAttribute('aria-label') || e.title || t)).slice(0, 20); };
  const isOn = (e) => e.getAttribute('aria-pressed') === 'true' || e.classList.contains('on') || e.classList.contains('active');

  function mirror(src) {
    const lab = label(src), svg = src.querySelector('svg'), cv = src.querySelector('canvas'), bg = src.style.background; let ico;
    if (cv) { ico = document.createElement('canvas'); ico.width = cv.width; ico.height = cv.height; ico.getContext('2d').drawImage(cv, 0, 0); }
    else if (bg) ico = h('span', { class: 'glyph', style: { background: bg, borderColor: 'var(--line)' } });
    else if (svg) ico = svg.cloneNode(true);
    else ico = h('span', { class: 'glyph' }, (lab[0] || '•').toUpperCase());
    return h('button', { class: 'rb-btn' + (isOn(src) ? ' on' : ''), type: 'button', title: lab, disabled: src.disabled, 'aria-pressed': isOn(src) ? 'true' : null, onclick: () => src.click() },
      h('span', { class: 'rb-ico' }, ico), h('span', null, bg ? '' : lab));
  }

  function build() {
    mo.disconnect();
    try {
      const top = main.querySelector('.st-top'), tabsEl = main.querySelector('.tabs');
      const host = top ? top.parentElement : tabsEl ? (tabsEl.closest('.page') || tabsEl.parentElement) : null;
      if (!host) { rib?.remove(); rib = null; anchor = null; return; }
      const ptabs = tabsEl ? [...tabsEl.querySelectorAll('.tab')] : [];
      if (host !== anchor || !rib?.isConnected) {
        anchor = host; rib?.remove();
        active = top ? 'home' : Math.max(0, ptabs.findIndex(isOn));
        rib = h('div', { class: 'ribbon', role: 'toolbar', 'aria-label': L('Toolbar', 'شريط الأدوات') }, h('div', { class: 'rb-tabs' }), h('div', { class: 'rb-bar' }));
        host.insertBefore(rib, host.firstChild);
      }
      if (active !== 'home' && !ptabs[active]) active = top ? 'home' : 0;
      const tabBtns = [];
      if (top) tabBtns.push(h('button', { class: 'rb-tab' + (active === 'home' ? ' active' : ''), type: 'button', onclick: () => { active = 'home'; build(); } }, L('Home', 'الرئيسية')));
      ptabs.forEach((t, i) => tabBtns.push(h('button', { class: 'rb-tab' + (active === i ? ' active' : ''), type: 'button', onclick: () => { active = i; t.click(); build(); } }, text(t))));

      let items = [];
      if (active === 'home' && top) items = [...top.children].flatMap(c => c.classList.contains('sep') ? ['sep'] : c.matches('button,a.btn') && !c.classList.contains('only-mobile') ? [c] : []);
      else {
        const body = main.querySelector('.panel-body');
        items = body ? [...new Set(body.querySelectorAll('.btn-row button, .filter, .sticker, .sec > button.btn, :scope > div > button.btn, :scope > button.btn'))]
          : [...host.querySelectorAll('button.btn')].filter(b => !tabsEl?.contains(b) && !b.closest('.ribbon') && !b.classList.contains('only-mobile'));
      }
      const bar = rib.querySelector('.rb-bar'), sl = bar.scrollLeft;
      bar.replaceChildren(...items.slice(0, 40).map(i => i === 'sep' ? h('span', { class: 'rb-sep' }) : mirror(i)));
      bar.scrollLeft = sl;
      rib.querySelector('.rb-tabs').replaceChildren(...tabBtns);
      tabsEl?.classList.add('rb-hide');
      // Hide the original toolbar only when it holds nothing but buttons (so no control is lost).
      top?.classList.toggle('rb-hide', !top.querySelector('input,select,textarea'));
    } finally { mo.observe(main, OPTS); }
  }
  mo.observe(main, OPTS); build();
}
