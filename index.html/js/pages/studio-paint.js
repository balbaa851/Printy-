// Paint tools for the Design Studio: vector pen/marker (editable paths) and raster brush, airbrush,
// smudge, blur and eraser that paint into one "Paint layer" (a canvas-backed image object).
import { L } from '../core.js';
import { h, icon, toast, clamp } from '../util.js';

export const PALETTE = ['#000000', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#ffffff', '#7f1d1d', '#dc2626', '#f97316', '#facc15', '#84cc16', '#16a34a', '#14b8a6', '#06b6d4', '#2563eb', '#4f46e5', '#7c3aed', '#c026d3', '#ec4899', '#fb7185', '#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bae6fd', '#ddd6fe', '#78350f', '#a16207', '#365314', '#164e63', '#1e3a8a', '#4c1d95'];
const TOOLS = [['pen', 'pencil', 'Pen', 'قلم'], ['marker', 'brush', 'Marker', 'ماركر'], ['brush', 'brush', 'Soft brush', 'فرشاة ناعمة'], ['spray', 'sparkles', 'Airbrush', 'بخاخ'], ['smudge', 'wand', 'Smudge', 'تلطيخ'], ['blur', 'circle', 'Blur', 'ضبابية'], ['eraser', 'eraser', 'Eraser', 'ممحاة'], ['picker', 'pipette', 'Eyedropper', 'قطارة']];
// 1×1 transparent PNG. History snapshots store this instead of re-encoding the (large) paint layer on every stroke.
export const PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
// Paint-layer performance setup: draw the layer's canvas directly (no second cache canvas) and only encode it to a PNG when a
// real save needs it (cached until the pixels change again).
export function armPaintLayer(l) {
  l.objectCaching = false; if (l.pRev == null) l.pRev = 0;
  if (!l._armed) { l._armed = true; l.getSrc = function () { if (this._snap) return PLACEHOLDER; if (!this._sSrc || this._sRev !== this.pRev) { this._sSrc = this.getElement().toDataURL(); this._sRev = this.pRev; } return this._sSrc; }; }
}
// grow-only scratch canvas shared by smudge/blur dabs (no canvas allocation per dab)
let scratchCv = null;
const scratch = (q) => { if (!scratchCv) { scratchCv = document.createElement('canvas'); } if (scratchCv.width < q || scratchCv.height < q) { scratchCv.width = Math.max(scratchCv.width, q); scratchCv.height = Math.max(scratchCv.height, q); } return scratchCv; };
const mk = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; };
const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const toHex = (d) => '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');

// Pure-JS box blur (works in every browser, including Safari which has no canvas filter).
export function boxBlur(id, rad) {
  const { data: d, width: w, height: hh } = id, o = new Uint8ClampedArray(d.length), n = 2 * rad + 1;
  const pass = (src, dst, len, cnt, step, line) => { for (let l = 0; l < cnt; l++) for (let ch = 0; ch < 4; ch++) {
    const b = l * line * 4 + ch; let sum = 0; for (let k = -rad; k <= rad; k++) sum += src[b + clamp(k, 0, len - 1) * step * 4];
    for (let i = 0; i < len; i++) { dst[b + i * step * 4] = sum / n; sum += src[b + Math.min(len - 1, i + rad + 1) * step * 4] - src[b + Math.max(0, i - rad) * step * 4]; } } };
  pass(d, o, w, hh, 1, w); pass(o, d, hh, w, w, 1);
}

export function createPaint({ canvas, fabric, size, commit, rerender }) {
  const P = { tool: 'brush', color: '#7c3aed', size: 24, opacity: 100, hardness: 50, strength: 50, recent: [], on: false };
  let st = null, raf = 0, pool = { base: null, T: null, w: 0, h: 0, td: null };
  const vec = () => P.tool === 'pen' || P.tool === 'marker';
  const getLayer = () => canvas.getObjects().find(o => o.isPaint);
  function ensureLayer() {
    const [W, H] = size(); let l = getLayer();
    if (!l) { l = new fabric.Image(mk(W, H), { left: 0, top: 0, name: L('Paint layer', 'طبقة الرسم'), isPaint: true, selectable: false, evented: false, locked: true }); armPaintLayer(l); canvas.add(l); }
    else if (!(l.getElement() instanceof HTMLCanvasElement)) { const c = mk(W, H); c.getContext('2d').drawImage(l.getElement(), 0, 0, W, H); l.setElement(c); l.pRev = (l.pRev || 0) + 1; }
    armPaintLayer(l);
    return l;
  }
  function apply() {
    canvas.discardActiveObject(); canvas.isDrawingMode = P.on && vec(); canvas.selection = !P.on; canvas.skipTargetFind = P.on && !vec(); canvas.defaultCursor = P.on ? 'crosshair' : 'default';
    if (P.on && vec()) { const b = new fabric.PencilBrush(canvas); b.color = P.tool === 'marker' ? rgba(P.color, .4) : rgba(P.color, P.opacity / 100); b.width = P.tool === 'marker' ? P.size * 2.5 : Math.max(1, P.size / 3); canvas.freeDrawingBrush = b; canvas.freeDrawingCursor = 'crosshair'; }
    canvas.requestRenderAll();
  }
  const setColor = (c) => { P.color = c; P.recent = [c, ...P.recent.filter(x => x !== c)].slice(0, 8); apply(); rerender(); };

  function stamp(ctx, x, y) {
    const r = P.size / 2;
    if (P.tool === 'spray') { for (let i = 0; i < Math.ceil(r / 2); i++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(.6, r / 18), 0, 7); ctx.fill(); } return; }
    const g = ctx.createRadialGradient(x, y, 0, x, y, r), hd = P.hardness / 100; g.addColorStop(0, rgba(P.color, 1)); g.addColorStop(Math.min(.99, hd), rgba(P.color, 1)); g.addColorStop(1, rgba(P.color, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // Only the rectangle touched by new stamps is recomposited (not the whole W×H layer) — this is what keeps big canvases smooth.
  function composite(rc) {
    const c = st.LC.getContext('2d'), [W, H] = size();
    let x = 0, y = 0, w = W, hh = H; if (rc) { x = clamp(Math.floor(rc.x0), 0, W); y = clamp(Math.floor(rc.y0), 0, H); w = clamp(Math.ceil(rc.x1), 0, W) - x; hh = clamp(Math.ceil(rc.y1), 0, H) - y; if (w <= 0 || hh <= 0) return; }
    c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(x, y, w, hh); c.drawImage(st.base, x, y, w, hh, x, y, w, hh);
    c.globalAlpha = P.tool === 'spray' ? 1 : P.opacity / 100; c.globalCompositeOperation = P.tool === 'eraser' ? 'destination-out' : 'source-over'; c.drawImage(st.T, x, y, w, hh, x, y, w, hh); c.restore();
  }
  const grow = (rc, x, y, r) => { rc.x0 = Math.min(rc.x0, x - r); rc.y0 = Math.min(rc.y0, y - r); rc.x1 = Math.max(rc.x1, x + r); rc.y1 = Math.max(rc.y1, y + r); };
  function dab(p, lp) {
    const c = st.LC.getContext('2d'), r = Math.max(2, P.size / 2), q = Math.ceil(2 * r), t = scratch(q), tc = t.getContext('2d', { willReadFrequently: true }), s0 = P.tool === 'smudge' ? lp : p;
    tc.clearRect(0, 0, q, q); tc.drawImage(st.LC, s0.x - r, s0.y - r, q, q, 0, 0, q, q);
    if (P.tool === 'blur') { const id = tc.getImageData(0, 0, q, q); boxBlur(id, 1 + Math.round(P.strength / 100 * r / 4)); tc.putImageData(id, 0, 0); }
    c.save(); c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.clip(); c.globalAlpha = P.tool === 'smudge' ? clamp(P.strength / 100 * .8 + .1, .1, .9) : .6; c.drawImage(t, 0, 0, q, q, p.x - r, p.y - r, q, q); c.restore();
  }
  function down(e) {
    if (!P.on || vec()) return; const p = canvas.getPointer(e.e), [W, H] = size();
    if (P.tool === 'picker') {
      try { const lc = canvas.lowerCanvasEl, k = lc.width / canvas.getWidth() * canvas.getZoom(), d = lc.getContext('2d').getImageData(clamp(Math.round(p.x * k), 0, lc.width - 1), clamp(Math.round(p.y * k), 0, lc.height - 1), 1, 1).data; setColor(toHex(d)); }
      catch (err) { toast(L('Could not read the color here.', 'تعذّرت قراءة اللون هنا.'), 'error'); }
      return;
    }
    const l = ensureLayer(), LC = l.getElement(); st = { LC, l, last: p, pend: null };
    if (P.tool === 'smudge' || P.tool === 'blur') return;
    // reuse the two full-size work canvases between strokes (allocating + zeroing them every stroke was a visible stall)
    if (!pool.base || pool.w !== W || pool.h !== H) { pool = { base: mk(W, H), T: mk(W, H), w: W, h: H, td: null }; }
    else if (pool.td) { const d = pool.td; pool.T.getContext('2d').clearRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); }
    st.base = pool.base; st.T = pool.T; const bc = st.base.getContext('2d'); bc.globalCompositeOperation = 'copy'; bc.drawImage(LC, 0, 0); bc.globalCompositeOperation = 'source-over';
    st.tc = st.T.getContext('2d'); st.tc.fillStyle = rgba(P.color, 1); st.rc = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; stamp(st.tc, p.x, p.y); grow(st.rc, p.x, p.y, P.size / 2 + 2); pool.td = st.rc;
    composite(st.rc); st.rc = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; l.dirty = true; canvas.requestRenderAll();
  }
  // pointer events only store the newest position; the stroke is advanced once per animation frame
  function move(e) { if (!st) return; st.pend = canvas.getPointer(e.e); if (!raf) raf = requestAnimationFrame(step); }
  function step() {
    raf = 0; if (!st || !st.pend) return; const p = st.pend; st.pend = null;
    const n = clamp(Math.ceil(Math.hypot(p.x - st.last.x, p.y - st.last.y) / Math.max(1, P.size / 5)), 1, 80), rc = st.T ? st.rc : null, pd = pool.td;
    for (let i = 1; i <= n; i++) { const q = { x: st.last.x + (p.x - st.last.x) * i / n, y: st.last.y + (p.y - st.last.y) * i / n }, lp = i === 1 ? st.last : { x: st.last.x + (p.x - st.last.x) * (i - 1) / n, y: st.last.y + (p.y - st.last.y) * (i - 1) / n };
      if (st.T) { stamp(st.tc, q.x, q.y); grow(rc, q.x, q.y, P.size / 2 + 2); grow(pd, q.x, q.y, P.size / 2 + 2); } else dab(q, lp); }
    if (st.T) { composite(rc); rc.x0 = rc.y0 = Infinity; rc.x1 = rc.y1 = -Infinity; } st.last = p; st.l.dirty = true; canvas.requestRenderAll();
  }
  const up = () => { if (st) { if (st.pend) step(); const l = st.l; l.pRev = (l.pRev || 0) + 1; st = null; commit(); } };
  canvas.on('mouse:down', down); canvas.on('mouse:move', move); canvas.on('mouse:up', up);
  canvas.on('path:created', () => { if (P.on) commit(); });

  function flatten() {
    const [W, H] = size(); canvas.discardActiveObject(); const c = canvas.toCanvasElement(1, { left: 0, top: 0, width: W, height: H });
    canvas.getObjects().slice().forEach(o => canvas.remove(o)); { const nl = new fabric.Image(c, { left: 0, top: 0, name: L('Paint layer', 'طبقة الرسم'), isPaint: true, selectable: false, evented: false, locked: true }); armPaintLayer(nl); canvas.add(nl); }
    commit(); rerender(); toast(L('Everything is now one paint layer, so smudge and blur work on the whole artwork. Undo to go back.', 'أصبح كل شيء طبقة رسم واحدة، فيعمل التلطيخ والضبابية على كامل العمل. استخدم تراجع للعودة.'));
  }
  const slider = (label, key, min, max, show) => { if (!show) return null; const out = h('output', null, String(P[key])), i = h('input', { type: 'range', class: 'range', min, max, step: 1, value: P[key], 'aria-label': label }); i.addEventListener('input', () => { P[key] = +i.value; out.textContent = i.value; }); i.addEventListener('change', apply); return h('div', { class: 'field' }, h('span', { class: 'row between' }, label, out), i); };
  function view() {
    const t = P.tool, raster = !vec() && t !== 'picker';
    const col = h('input', { type: 'color', class: 'color', value: P.color, 'aria-label': L('Custom color', 'لون مخصص') }); col.addEventListener('change', () => setColor(col.value));
    const sw = (c) => h('button', { class: 'btn icon sm', style: { background: c, border: '2px solid ' + (P.color === c ? '#7c3aed' : '#9ca3af') }, 'aria-label': c, title: c, onclick: () => setColor(c) });
    return h('div', null, h('p', { class: 'muted small' }, L('Draw straight on the canvas. Pen and Marker make editable vector strokes; the other tools paint pixels into the Paint layer.', 'ارسم مباشرة على اللوحة. القلم والماركر ينتجان خطوطاً قابلة للتعديل؛ بقية الأدوات ترسم بكسلات في طبقة الرسم.')),
      h('div', { class: 'btn-row' }, TOOLS.map(([k, ic, en, ar]) => h('button', { class: 'btn sm' + (t === k ? ' on' : ''), 'aria-pressed': t === k, onclick: () => { P.tool = k; apply(); rerender(); } }, icon(ic), L(en, ar)))),
      h('div', { class: 'sec' }, h('h4', null, L('Colors', 'الألوان')), h('div', { class: 'btn-row' }, PALETTE.map(sw)), P.recent.length ? h('div', { class: 'btn-row' }, h('span', { class: 'muted small' }, L('Recent', 'الأخيرة')), P.recent.map(sw)) : null, h('label', { class: 'field' }, h('span', null, L('Custom color', 'لون مخصص')), col)),
      slider(L('Size', 'الحجم'), 'size', 2, 200, t !== 'picker'), slider(L('Opacity', 'الشفافية'), 'opacity', 5, 100, t !== 'picker' && t !== 'smudge' && t !== 'blur' && t !== 'marker'),
      slider(L('Hardness', 'الصلابة'), 'hardness', 0, 100, t === 'brush' || t === 'eraser'), slider(L('Strength', 'القوة'), 'strength', 5, 100, t === 'smudge' || t === 'blur'),
      h('div', { class: 'sec' }, h('div', { class: 'btn-row' },
        h('button', { class: 'btn sm', onclick: flatten }, L('Flatten all into paint layer', 'دمج الكل في طبقة الرسم')),
        h('button', { class: 'btn sm', onclick: () => { canvas.backgroundColor = P.color; canvas.requestRenderAll(); commit(); } }, L('Fill background', 'تعبئة الخلفية')),
        h('button', { class: 'btn sm danger-o', disabled: !getLayer(), onclick: () => { const l = getLayer(); if (l) { canvas.remove(l); commit(); rerender(); } } }, L('Clear paint layer', 'مسح طبقة الرسم'))),
        raster || t === 'picker' ? h('p', { class: 'muted small' }, L('Smudge and blur work on the Paint layer. Use “Flatten all” first to smudge or blur the whole design.', 'التلطيخ والضبابية يعملان على طبقة الرسم. استخدم «دمج الكل» أولاً لتطبيقهما على التصميم كاملاً.')) : null));
  }
  return { arm: armPaintLayer, view, enable: () => { if (!P.on) { P.on = true; apply(); } }, disable: () => { if (P.on) { P.on = false; apply(); } } };
}
