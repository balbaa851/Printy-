import { L } from './core.js';
import { CONFIG } from './config.js';
import { ICONS } from './icons.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'textContent', 'indeterminate']);

// Safe DOM builder: text is always inserted as text nodes, never HTML.
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return e;
}
// Inline Lucide icons (see icons.js) — no runtime icon library or network request.
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '18'); s.setAttribute('height', '18');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'ic'); s.innerHTML = ICONS[name] || ''; // trusted, build-time constant markup
  return s;
}
export function refreshIcons() { /* icons are inline SVG; nothing to refresh */ }
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function debounce(fn, ms) { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(t); return d; }
export function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

// ---------- Toasts ----------
export function toast(msg, type = 'info') {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + type, role: type === 'error' ? 'alert' : 'status' }, msg);
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, type === 'error' ? 6000 : 3500);
}

// ---------- Modals ----------
export function modal({ title, body, actions = [], wide = false }) {
  const prev = document.activeElement;
  const back = h('div', { class: 'modal-back' });
  const id = 'm' + uid();
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id },
    h('h2', { id }, title), h('div', { class: 'modal-body' }, body), h('div', { class: 'modal-actions' }, actions));
  back.append(box);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); prev && prev.focus && prev.focus(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); box.dispatchEvent(new Event('dismiss')); }
    if (e.key === 'Tab') {
      const f = $$('button,input,select,textarea,a[href]', box).filter(x => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('mousedown', (e) => { if (e.target === back) { close(); box.dispatchEvent(new Event('dismiss')); } });
  document.body.append(back);
  refreshIcons();
  const f = $('input,select,textarea,button.primary', box) || $('button', box);
  f && f.focus();
  return { close, el: box };
}
export function confirmDialog({ title, message, confirmText, danger = false }) {
  return new Promise((res) => {
    let m;
    const done = (v) => { m.close(); res(v); };
    m = modal({
      title, body: h('p', null, message),
      actions: [
        h('button', { class: 'btn', onclick: () => done(false) }, L('Cancel', 'إلغاء')),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, confirmText || L('Confirm', 'تأكيد'))
      ]
    });
    m.el.addEventListener('dismiss', () => res(false));
  });
}
export function promptDialog({ title, value = '', label = '' }) {
  return new Promise((res) => {
    let m;
    const inp = h('input', { class: 'input', type: 'text', value, maxlength: '80', 'aria-label': label || title });
    const done = (v) => { m.close(); res(v); };
    const ok = () => { const v = inp.value.trim(); if (v) done(v); else inp.focus(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    m = modal({
      title, body: inp,
      actions: [
        h('button', { class: 'btn', onclick: () => done(null) }, L('Cancel', 'إلغاء')),
        h('button', { class: 'btn primary', onclick: ok }, L('OK', 'حسناً'))
      ]
    });
    m.el.addEventListener('dismiss', () => res(null));
    inp.select();
  });
}
export function popMenu(anchor, items) {
  document.querySelectorAll('.menu').forEach(m => m.remove());
  const r = anchor.getBoundingClientRect();
  const rtl = document.documentElement.dir === 'rtl';
  const menu = h('div', { class: 'menu', role: 'menu' });
  const close = () => { menu.remove(); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', key, true); };
  const outside = (e) => { if (!menu.contains(e.target)) close(); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  items.forEach(it => menu.append(h('button', { class: 'menu-item', role: 'menuitem', onclick: () => { close(); it.onClick(); } }, it.label)));
  document.body.append(menu);
  const mw = menu.offsetWidth;
  menu.style.top = Math.min(r.bottom + 4, innerHeight - menu.offsetHeight - 8) + 'px';
  menu.style.left = Math.max(8, Math.min(rtl ? r.right - mw : r.left, innerWidth - mw - 8)) + 'px';
  setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', key, true); });
  const first = menu.querySelector('button'); first && first.focus();
}
export const spinner = () => h('div', { class: 'loading', role: 'status' }, h('div', { class: 'spin' }), h('span', null, L('Loading…', 'جارٍ التحميل…')));

// ---------- Library loading (lazy) ----------
const LIBS = {
  fabric: ['https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js', 'vendor/fabric.min.js', () => window.fabric],
  jszip: ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'vendor/jszip.min.js', () => window.JSZip]
};
const libCache = {};
function injectScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = res; s.onerror = () => { s.remove(); rej(new Error('Failed to load ' + src)); };
    document.head.append(s);
  });
}
export function loadLib(name) {
  const d = LIBS[name];
  if (d[2]()) return Promise.resolve(d[2]());
  if (!libCache[name]) {
    const order = CONFIG.useVendor ? [d[1], d[0]] : [d[0], d[1]];
    libCache[name] = (async () => {
      for (const src of order) {
        try { await injectScript(src); if (d[2]()) return d[2](); } catch { /* try next */ }
      }
      delete libCache[name];
      throw new Error(L('Could not load a required library (' + name + '). Check your connection and try again.', 'تعذّر تحميل مكتبة مطلوبة (' + name + '). تحقق من اتصالك وحاول مرة أخرى.'));
    })();
  }
  return libCache[name];
}

// ---------- Files & images ----------
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_PIXELS = 100e6;

async function sniff(file) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}
// Returns {ok, type, error}
export async function validateImage(file, maxBytes = MAX_FILE_BYTES) {
  if (!file) return { ok: false, error: L('No file selected.', 'لم يتم اختيار ملف.') };
  if (file.size === 0) return { ok: false, error: L('"' + file.name + '" is empty.', 'الملف "' + file.name + '" فارغ.') };
  if (file.size > maxBytes) return { ok: false, error: L('"' + file.name + '" is too large (max ' + formatBytes(maxBytes) + ').', 'الملف "' + file.name + '" كبير جداً (الحد الأقصى ' + formatBytes(maxBytes) + ').') };
  const type = await sniff(file);
  if (!type || !IMAGE_TYPES.includes(type)) return { ok: false, error: L('"' + file.name + '" is not a supported image. Use JPG, PNG or WebP.', 'الملف "' + file.name + '" ليس صورة مدعومة. استخدم JPG أو PNG أو WebP.') };
  return { ok: true, type };
}
// Decode a file to an HTMLCanvasElement, optionally downscaling. Releases the object URL.
export function fileToCanvas(file, maxDim = 0) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w0 = img.naturalWidth, h0 = img.naturalHeight;
        if (!w0 || !h0) throw new Error('empty');
        if (w0 * h0 > MAX_PIXELS) throw new Error('pixels');
        let k = 1;
        if (maxDim && Math.max(w0, h0) > maxDim) k = maxDim / Math.max(w0, h0);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.srcWidth = w0; c.srcHeight = h0;
        res(c);
      } catch (e) {
        rej(new Error(e.message === 'pixels' ? L('This image is too large to process (over 100 megapixels).', 'هذه الصورة كبيرة جداً للمعالجة (أكثر من 100 ميغابكسل).') : L('This image could not be read. It may be corrupted.', 'تعذّرت قراءة هذه الصورة. قد تكون تالفة.')));
      } finally { URL.revokeObjectURL(url); img.src = ''; }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(L('This image could not be read. It may be corrupted.', 'تعذّرت قراءة هذه الصورة. قد تكون تالفة.'))); };
    img.src = url;
  });
}
export const canvasToBlob = (c, type = 'image/png', q = 0.92) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error(L('Export failed. The image may be too large for this browser.', 'فشل التصدير. قد تكون الصورة كبيرة جداً لهذا المتصفح.'))), type, q));
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export const safeName = (s) => (s || 'printy').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'printy';
export const baseName = (n) => safeName((n || 'image').replace(/\.[^.]+$/, ''));

// Turn any element into a drop target / file picker. onFiles(FileList array)
export function dropzone(el, onFiles, { multiple = false } = {}) {
  const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  input.addEventListener('change', () => { const f = [...input.files]; input.value = ''; if (f.length) onFiles(f); });
  el.append(input);
  el.addEventListener('click', (e) => { if (e.target.closest('a')) return; input.click(); });
  el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.remove('drag'); }));
  el.addEventListener('drop', (e) => { const f = [...(e.dataTransfer?.files || [])]; if (f.length) onFiles(multiple ? f : f.slice(0, 1)); });
  return { open: () => input.click() };
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = h('textarea', { style: { position: 'fixed', opacity: '0' } }); t.value = text; document.body.append(t); t.select();
    try { document.execCommand('copy'); } finally { t.remove(); }
  }
  toast(L('Copied: ', 'تم النسخ: ') + text, 'success');
}

// ---------- Web fonts (lazy, non-blocking) ----------
// The old page loaded ten font families in a render-blocking stylesheet. Now the UI fonts load after first paint and the
// design fonts (used by text tools / templates) load only when an editor or template page opens.
const FONT_Q = {
  ui: 'family=Inter:wght@400;500;600;700&family=Cairo:wght@400;600;700',
  design: 'family=Poppins:wght@400;700&family=Playfair+Display:wght@400;700&family=Montserrat:wght@400;700&family=Lobster&family=Tajawal:wght@400;700&family=Amiri:wght@400;700&family=Reem+Kufi:wght@400;700&family=Roboto+Mono:wght@400;700'
};
const fontDone = {};
export function loadFonts(group = 'ui') {
  if (fontDone[group]) return;
  fontDone[group] = true;
  const go = () => document.head.append(h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?' + FONT_Q[group] + '&display=swap' }));
  group === 'ui' && 'requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 2500 }) : go();
}
