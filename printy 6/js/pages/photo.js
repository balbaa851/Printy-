import { L, isAr } from '../core.js';
import { h, icon, refreshIcons, toast, confirmDialog, modal, validateImage, fileToCanvas, canvasToBlob, downloadBlob, baseName, clamp, formatBytes } from '../util.js';
import { adjustPixels, FILTERS, DEFAULT_PARAMS } from '../pixels.js';

// Session state lives at module level so switching language or tabs does not lose the photo.
const S = { base: null, orig: null, name: '', overlays: [], params: { ...DEFAULT_PARAMS }, filter: 'none', amt: 100, hist: [], hi: -1, sel: -1, ver: 0, tab: 'adjust', compare: false, fx: { blur: 0, vignette: 0, grain: 0, pixelate: 0, hue: 0, invert: 0, border: 0, bc: '#ffffff', shadows: 0, highlights: 0, tint: 0, fade: 0 }, zoom: 1, rt: { tool: 'blur', size: 30, strength: 50, src: null, setSrc: false }, dr: { tool: 'pen', color: '#ef4444', size: 8, opacity: 100 } };
const FXD = { blur: 0, vignette: 0, grain: 0, pixelate: 0, hue: 0, invert: 0, border: 0, bc: '#ffffff', shadows: 0, highlights: 0, tint: 0, fade: 0 };
const FX = [['shadows', 'Shadows', 'الظلال', -100, 100], ['highlights', 'Highlights', 'الإضاءات العالية', -100, 100], ['tint', 'Tint (green–magenta)', 'الصبغة', -100, 100], ['fade', 'Fade', 'تلاشي', 0, 100], ['blur', 'Blur', 'ضبابية', 0, 40], ['pixelate', 'Pixelate', 'تبكسل', 0, 40], ['vignette', 'Vignette', 'تظليل الحواف', 0, 100], ['grain', 'Film grain', 'حبيبات الفيلم', 0, 100], ['hue', 'Hue shift', 'تدوير الألوان', -180, 180], ['invert', 'Invert', 'عكس الألوان', 0, 100], ['border', 'Border', 'إطار', 0, 40]];
const SWATCHES = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#000000'];
const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Lobster', 'Roboto Mono', 'Cairo', 'Tajawal', 'Amiri', 'Reem Kufi', 'Arial', 'Georgia'];
const STICKERS = ['⭐', '❤️', '🔥', '😀', '😎', '🎉', '✨', '👍', '🌈', '📌', '💡', '🌸', '🏆', '☀️', '🎈', '💬'];
const SHAPES = [['rect', 'square', 'Rectangle', 'مستطيل'], ['circle', 'circle', 'Circle', 'دائرة'], ['tri', 'triangle', 'Triangle', 'مثلث'], ['line', 'minus', 'Line', 'خط'], ['star', 'star', 'Star', 'نجمة'], ['arrow', '➜', 'Arrow', 'سهم'], ['heart', '♥', 'Heart', 'قلب']];
const MAX_DIM = 6000, PREV_DIM = 1400;
const FNAMES = { none: ['Original', 'الأصل'], grayscale: ['Grayscale', 'رمادي'], sepia: ['Sepia', 'بني قديم'], vintage: ['Vintage', 'عتيق'], vivid: ['Vivid', 'زاهٍ'], cool: ['Cool', 'بارد'], warm: ['Warm', 'دافئ'], cinematic: ['Cinematic', 'سينمائي'] };
const ADJ = [['brightness', 'Brightness', 'السطوع'], ['contrast', 'Contrast', 'التباين'], ['saturation', 'Saturation', 'التشبع'], ['exposure', 'Exposure', 'التعريض'], ['warmth', 'Warmth', 'الدفء'], ['sharpness', 'Sharpness', 'الحدة']];

const measure = document.createElement('canvas').getContext('2d');
const fontStr = (o, k = 1) => `${o.italic ? 'italic ' : ''}${o.bold ? 700 : 400} ${o.size * k}px "${o.font}", sans-serif`;
function bbox(o) {
  if (o.k === 'text') { measure.font = fontStr(o); const lines = o.text.split('\n'); return { w: Math.max(10, ...lines.map(l => measure.measureText(l).width)) + o.sw, h: lines.length * o.size * 1.2 }; }
  if (o.k === 'sticker') return { w: o.size * 1.2, h: o.size * 1.2 };
  return { w: o.w, h: o.shape === 'line' ? Math.max(o.h, o.sw * 3, 24) : o.h };
}
function drawOverlays(ctx, s, ui) {
  S.overlays.forEach((o, idx) => {
    ctx.save(); ctx.translate(o.x * s, o.y * s); ctx.rotate(o.rot * Math.PI / 180);
    if (o.k === 'text') {
      ctx.font = fontStr(o, s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = /[؀-ۿ]/.test(o.text) ? 'rtl' : 'ltr';
      const lines = o.text.split('\n');
      lines.forEach((l, i) => { const y = (i - (lines.length - 1) / 2) * o.size * 1.2 * s; if (o.sw > 0) { ctx.lineJoin = 'round'; ctx.lineWidth = o.sw * s; ctx.strokeStyle = o.stroke; ctx.strokeText(l, 0, y); } ctx.fillStyle = o.color; ctx.fillText(l, 0, y); });
    } else if (o.k === 'path') {
      ctx.globalAlpha = o.alpha; ctx.globalCompositeOperation = o.hl ? 'multiply' : 'source-over'; ctx.strokeStyle = o.color; ctx.lineWidth = o.size * s; ctx.lineCap = o.hl ? 'square' : 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      o.pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * s, y * s)); if (o.pts.length === 1) ctx.lineTo(o.pts[0][0] * s + 0.01, o.pts[0][1] * s); ctx.stroke();
    } else if (o.k === 'sticker') { ctx.font = `${o.size * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.text, 0, 0); }
    else {
      const w = o.w * s, hh = o.h * s; ctx.beginPath(); ctx.fillStyle = o.fill; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw * s; ctx.lineCap = 'round';
      if (o.shape === 'rect') ctx.rect(-w / 2, -hh / 2, w, hh);
      else if (o.shape === 'circle') ctx.ellipse(0, 0, w / 2, hh / 2, 0, 0, Math.PI * 2);
      else if (o.shape === 'tri') { ctx.moveTo(0, -hh / 2); ctx.lineTo(w / 2, hh / 2); ctx.lineTo(-w / 2, hh / 2); ctx.closePath(); }
      else if (o.shape === 'line') { ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); }
      else if (o.shape === 'arrow') { [[-.5, -.18], [.1, -.18], [.1, -.5], [.5, 0], [.1, .5], [.1, .18], [-.5, .18]].forEach(([a, b], i) => ctx[i ? 'lineTo' : 'moveTo'](a * w, b * hh)); ctx.closePath(); }
      else if (o.shape === 'heart') { ctx.moveTo(0, hh * .35); ctx.bezierCurveTo(-w * .6, -hh * .05, -w * .35, -hh * .5, 0, -hh * .2); ctx.bezierCurveTo(w * .35, -hh * .5, w * .6, -hh * .05, 0, hh * .35); ctx.closePath(); }
      else { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.45 : 1; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * w / 2, Math.sin(a) * r * hh / 2); } ctx.closePath(); }
      if (o.shape !== 'line' && o.fill !== 'transparent') ctx.fill(); if (o.sw > 0 && o.stroke) ctx.stroke();
    }
    if (ui && idx === S.sel) { const b = bbox(o); ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#7c3aed'; ctx.strokeRect(-b.w / 2 * s - 4, -b.h / 2 * s - 4, b.w * s + 8, b.h * s + 8); }
    ctx.restore();
  });
}
function applyFx(ctx, w, hh) {
  const f = S.fx, u = Math.max(w, hh), mk = () => { const t = document.createElement('canvas'); t.width = w; t.height = hh; return t; };
  if (f.pixelate > 0) { const b = Math.max(2, f.pixelate * u / 300), t = mk(), tc = t.getContext('2d'); t.width = Math.max(1, Math.round(w / b)); t.height = Math.max(1, Math.round(hh / b)); tc.drawImage(ctx.canvas, 0, 0, t.width, t.height); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, w, hh); ctx.drawImage(t, 0, 0, w, hh); ctx.imageSmoothingEnabled = true; }
  if ((f.blur || f.hue || f.invert) && 'filter' in ctx) { const t = mk(); t.getContext('2d').drawImage(ctx.canvas, 0, 0); ctx.clearRect(0, 0, w, hh); ctx.filter = `blur(${f.blur * u / 1000}px) hue-rotate(${f.hue}deg) invert(${f.invert}%)`; ctx.drawImage(t, 0, 0); ctx.filter = 'none'; }
  if (f.shadows || f.highlights || f.tint || f.fade) { const id = ctx.getImageData(0, 0, w, hh), d = id.data, fd = f.fade / 100; for (let i = 0; i < d.length; i += 4) { const l = (.3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2]) / 255, a = f.shadows / 100 * (1 - l) * (1 - l) * 70 + f.highlights / 100 * l * l * 70, tn = f.tint * .3; d[i] = d[i] * (1 - fd * .25) + fd * 50 + a + tn; d[i + 1] = d[i + 1] * (1 - fd * .25) + fd * 50 + a - tn; d[i + 2] = d[i + 2] * (1 - fd * .25) + fd * 50 + a + tn; } ctx.putImageData(id, 0, 0); }
  if (f.vignette > 0) { const g = ctx.createRadialGradient(w / 2, hh / 2, Math.min(w, hh) * .25, w / 2, hh / 2, Math.hypot(w, hh) / 2); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${f.vignette / 100 * .9})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh); }
  if (f.grain > 0) { const id = ctx.getImageData(0, 0, w, hh), d = id.data; let r = 12345; const a = f.grain * .8; for (let i = 0; i < d.length; i += 4) { r = (r * 1664525 + 1013904223) >>> 0; const n = ((r >>> 24) / 255 - .5) * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; } ctx.putImageData(id, 0, 0); }
  if (f.border > 0) { const b = f.border * u / 500; ctx.fillStyle = f.bc; ctx.fillRect(0, 0, w, b); ctx.fillRect(0, hh - b, w, b); ctx.fillRect(0, 0, b, hh); ctx.fillRect(w - b, 0, b, hh); }
}
function renderFull() {
  const c = document.createElement('canvas'); c.width = S.base.width; c.height = S.base.height;
  const ctx = c.getContext('2d'); ctx.drawImage(S.base, 0, 0);
  if (S.filter !== 'none' || Object.entries(S.params).some(([, v]) => v)) { const id = ctx.getImageData(0, 0, c.width, c.height); adjustPixels(id.data, c.width, c.height, S.params, S.filter, S.amt); ctx.putImageData(id, 0, 0); }
  applyFx(ctx, c.width, c.height);
  drawOverlays(ctx, 1, false);
  return c;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const snapshot = () => ({ base: S.base, overlays: clone(S.overlays), params: { ...S.params }, filter: S.filter, amt: S.amt, fx: { ...S.fx } });
function pushHist() { S.hist = S.hist.slice(0, S.hi + 1); S.hist.push(snapshot()); if (S.hist.length > 30) S.hist.shift(); S.hi = S.hist.length - 1; }

export async function mount(root) {
  let pvSrc = null, pvVer = -1, raf = 0, crop = null, cropRatio = 0, drag = null, disposed = false;
  const pv = h('canvas', { class: 'pe-canvas', 'aria-label': L('Photo preview', 'معاينة الصورة') });
  const cropBox = h('div', { class: 'crop-box', hidden: true }, ['nw', 'ne', 'sw', 'se'].map(c => h('i', { class: 'crop-h ' + c, 'data-h': c })));
  const inner = h('div', { class: 'pe-inner' }, pv, cropBox);
  const stage = h('div', { class: 'pe-stage' });
  const panel = h('aside', { class: 'st-panel pe-panel' });
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('div', { class: 'panel-body' });
  panel.append(tabsEl, body);
  const bt = (ic, label, fn, cls = '') => h('button', { class: 'btn icon ' + cls, 'aria-label': label, title: label, onclick: fn }, icon(ic));
  const undoB = bt('undo-2', L('Undo', 'تراجع'), () => go(S.hi - 1)), redoB = bt('redo-2', L('Redo', 'إعادة'), () => go(S.hi + 1));
  const cmpB = h('button', { class: 'btn sm', 'aria-pressed': 'false', title: L('Compare with original', 'قارن مع الأصل'), onclick: () => { S.compare = !S.compare; cmpB.setAttribute('aria-pressed', S.compare); cmpB.classList.toggle('on', S.compare); render(); } }, icon('columns-2'), h('span', null, L('Before / After', 'قبل / بعد')));
  const info = h('span', { class: 'muted small' });
  const setZoom = (z) => { S.zoom = clamp(z, 0.25, 8); render(); };
  const zoomLbl = h('button', { class: 'btn sm', title: L('Fit to screen', 'ملاءمة الشاشة'), onclick: () => setZoom(1) }, L('Fit', 'ملاءمة'));
  const zoomOutB = h('button', { class: 'btn sm', 'aria-label': L('Zoom out', 'تصغير'), onclick: () => setZoom(S.zoom / 1.5) }, '−'), zoomInB = h('button', { class: 'btn sm', 'aria-label': L('Zoom in', 'تكبير'), onclick: () => setZoom(S.zoom * 1.5) }, '+');
  function applyZoom() {
    if (S.zoom === 1) { pv.style.width = pv.style.maxWidth = inner.style.maxWidth = ''; zoomLbl.textContent = L('Fit', 'ملاءمة'); return; }
    const fw = Math.min(stage.clientWidth - 40, (stage.clientHeight - 40) * S.base.width / S.base.height); pv.style.maxWidth = inner.style.maxWidth = 'none'; pv.style.width = Math.max(60, fw * S.zoom) + 'px'; zoomLbl.textContent = Math.round(S.zoom * 100) + '%';
  }
  const fileBtn = h('button', { class: 'btn sm', onclick: () => dz.open() }, icon('image-plus'), h('span', { class: 'hide-sm' }, L('New photo', 'صورة جديدة')));
  const exportB = h('button', { class: 'btn primary sm', onclick: exportDialog }, icon('download'), h('span', { class: 'hide-sm' }, L('Export', 'تصدير')));
  const panelB = bt('sliders-horizontal', L('Panels', 'اللوحات'), () => panel.classList.toggle('open'), 'only-mobile');
  const top = h('div', { class: 'st-top' }, h('strong', { class: 'hide-sm' }, L('Photo Editor', 'محرر الصور')), fileBtn, h('span', { class: 'sep' }), undoB, redoB, zoomOutB, zoomLbl, zoomInB, cmpB, info, h('span', { class: 'grow' }), exportB, panelB);
  root.append(h('div', { class: 'studio photo' }, top, h('div', { class: 'st-body' }, stage, panel)));
  const picker = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  picker.addEventListener('change', () => { const f = [...picker.files]; picker.value = ''; if (f.length) openFiles(f); });
  root.append(picker);
  const dz = { open: () => picker.click() };
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('drag'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('drag'));
  stage.addEventListener('drop', (e) => { e.preventDefault(); stage.classList.remove('drag'); const f = [...(e.dataTransfer?.files || [])]; if (f.length) openFiles(f); });
  const onBeforeUnload = (e) => { if (S.base && S.hist.length > 1) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);
  const onKey = (e) => {
    if (!S.base || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const m = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (m && k === 'z') { e.preventDefault(); go(e.shiftKey ? S.hi + 1 : S.hi - 1); } else if (m && k === 'y') { e.preventDefault(); go(S.hi + 1); }
    else if (k === '[' || k === ']') { const o = S.tab === 'retouch' ? S.rt : S.dr; o.size = clamp(o.size + (k === ']' ? 3 : -3), 1, 100); renderPanel(); }
  };
  window.addEventListener('keydown', onKey);

  async function openFiles(files) {
    const f = files[0]; if (!f) return;
    if (S.base && S.hist.length > 1 && !(await confirmDialog({ title: L('Open a new photo?', 'فتح صورة جديدة؟'), message: L('Your current edits will be discarded.', 'سيتم تجاهل تعديلاتك الحالية.'), confirmText: L('Open', 'فتح'), danger: true }))) return;
    const v = await validateImage(f); if (!v.ok) return toast(v.error, 'error');
    stage.classList.add('busy');
    try {
      const c = await fileToCanvas(f, MAX_DIM);
      if (c.srcWidth > MAX_DIM || c.srcHeight > MAX_DIM) toast(L('Large photo reduced to ' + MAX_DIM + ' px on its longest side for stability.', 'تم تصغير الصورة الكبيرة إلى ' + MAX_DIM + ' بكسل للضلع الأطول لضمان الاستقرار.'));
      else if (c.width * c.height > 24e6) toast(L('This is a very large photo; editing may feel slower.', 'هذه صورة كبيرة جداً؛ قد يكون التحرير أبطأ.'));
      S.base = c; S.orig = c; S.name = baseName(f.name); S.overlays = []; S.params = { ...DEFAULT_PARAMS }; S.fx = { ...FXD }; S.filter = 'none'; S.amt = 100; S.sel = -1; S.ver++; S.hist = []; S.hi = -1; S.compare = false;
      pushHist(); build();
    } catch (e) { toast(e.message, 'error'); } finally { stage.classList.remove('busy'); }
  }

  // ---- preview
  function rebuildPrev() {
    const k = Math.min(1, PREV_DIM / Math.max(S.base.width, S.base.height));
    pvSrc = document.createElement('canvas'); pvSrc.width = Math.max(1, Math.round(S.base.width * k)); pvSrc.height = Math.max(1, Math.round(S.base.height * k));
    const c = pvSrc.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(S.base, 0, 0, pvSrc.width, pvSrc.height); pvVer = S.ver;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (!disposed) render(); }); };
  function render() {
    if (!S.base) return; if (pvVer !== S.ver || !pvSrc) rebuildPrev();
    const w = pvSrc.width, hh = pvSrc.height; if (pv.width !== w || pv.height !== hh) { pv.width = w; pv.height = hh; }
    const ctx = pv.getContext('2d'); ctx.clearRect(0, 0, w, hh); ctx.drawImage(pvSrc, 0, 0);
    if (!S.compare) {
      if (S.filter !== 'none' || Object.values(S.params).some(v => v)) { const id = ctx.getImageData(0, 0, w, hh); adjustPixels(id.data, w, hh, S.params, S.filter, S.amt); ctx.putImageData(id, 0, 0); }
      applyFx(ctx, w, hh);
      drawOverlays(ctx, w / S.base.width, !crop);
    }
    applyZoom(); info.textContent = S.base.width + ' × ' + S.base.height + ' px';
    undoB.disabled = S.hi <= 0; redoB.disabled = S.hi >= S.hist.length - 1; if (crop) placeCrop();
  }
  function go(i) {
    if (i < 0 || i >= S.hist.length) return; endCrop();
    const s = S.hist[i], baseChanged = s.base !== S.base; S.hi = i; S.base = s.base; S.overlays = clone(s.overlays); S.params = { ...s.params }; S.filter = s.filter; S.amt = s.amt; S.fx = { ...(s.fx || FXD) }; S.sel = -1; if (baseChanged) S.ver++;
    renderPanel(); render();
  }
  const commit = () => { pushHist(); render(); };

  // ---- overlay interaction
  const toBase = (e) => { const r = pv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * S.base.width, y: (e.clientY - r.top) / r.height * S.base.height }; };
  function hit(p) {
    for (let i = S.overlays.length - 1; i >= 0; i--) {
      const o = S.overlays[i]; if (o.k === 'path') continue; const b = bbox(o), a = -o.rot * Math.PI / 180, dx = p.x - o.x, dy = p.y - o.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= b.w / 2 + 6 && Math.abs(ly) <= b.h / 2 + 6) return i;
    }
    return -1;
  }
  pv.addEventListener('pointerdown', (e) => {
    if (crop || !S.base) return; if (S.tab === 'draw') return startStroke(e); if (S.tab === 'retouch') return startRt(e); const p = toBase(e), i = hit(p);
    if (i !== S.sel) { S.sel = i; renderPanel(); }
    if (i >= 0) { drag = { dx: S.overlays[i].x - p.x, dy: S.overlays[i].y - p.y, moved: false }; pv.setPointerCapture(e.pointerId); }
    render();
  });
  let stroke = null, rts = null;
  function dab(ctx, x, y, k, off, SRC, lp) {
    const R = S.rt, r = Math.max(2, R.size * uDim() / 1000 * k), a = R.strength / 100, t = R.tool, cl = () => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip(); };
    const reg = (cx = x, cy = y, m = 1) => { const c = document.createElement('canvas'), q = Math.ceil(2 * r * m); c.width = c.height = q; c.getContext('2d').drawImage(ctx.canvas, cx - r * m, cy - r * m, q, q, 0, 0, q, q); return c; };
    ctx.save();
    if (t === 'blur') { if ('filter' in ctx) { const c = reg(); cl(); ctx.globalAlpha = Math.min(1, a + .2); ctx.filter = `blur(${Math.max(1, r / 5)}px)`; ctx.drawImage(c, x - r, y - r); } }
    else if (t === 'mosaic') { const c = reg(), b = Math.max(3, r / 3), sm = document.createElement('canvas'); sm.width = sm.height = Math.max(1, Math.ceil(c.width / b)); sm.getContext('2d').drawImage(c, 0, 0, sm.width, sm.height); cl(); ctx.imageSmoothingEnabled = false; ctx.drawImage(sm, x - r, y - r, c.width, c.height); }
    else if (t === 'heal') { if ('filter' in ctx) { const c = reg(x, y, 2), o = document.createElement('canvas'); o.width = o.height = c.width; const oc = o.getContext('2d'); oc.filter = `blur(${Math.max(2, r / 2)}px)`; oc.drawImage(c, 0, 0); cl(); ctx.globalAlpha = Math.min(1, a + .4); ctx.drawImage(o, x - r * 2, y - r * 2); } }
    else if (t === 'sharpen' || t === 'redeye') {
      const c = reg(), cx = c.getContext('2d'), id = cx.getImageData(0, 0, c.width, c.height), d = id.data, q = c.width, src = new Uint8ClampedArray(d);
      if (t === 'redeye') { for (let i = 0; i < d.length; i += 4) if (d[i] > 80 && d[i] > 1.5 * Math.max(d[i + 1], d[i + 2])) d[i] = (d[i + 1] + d[i + 2]) / 2 * .8; }
      else { const w = a * .8; for (let yy = 1; yy < q - 1; yy++) for (let xx = 1; xx < q - 1; xx++) for (let ch = 0; ch < 3; ch++) { const i = (yy * q + xx) * 4 + ch; d[i] = src[i] * (1 + 4 * w) - w * (src[i - 4] + src[i + 4] + src[i - q * 4] + src[i + q * 4]); } }
      cx.putImageData(id, 0, 0); cl(); ctx.drawImage(c, x - r, y - r);
    }
    else if (t === 'smudge') { if (lp) { const c = reg(lp.x * k, lp.y * k); cl(); ctx.globalAlpha = Math.min(.9, a + .2); ctx.drawImage(c, x - r, y - r); } }
    else if (t === 'paint') { cl(); ctx.globalAlpha = a; ctx.fillStyle = S.dr.color; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
    else if (t === 'saturate' || t === 'desaturate') { const g = ctx.createRadialGradient(x, y, 0, x, y, r), col = t === 'saturate' ? '255,0,0' : '128,128,128'; ctx.globalCompositeOperation = 'saturation'; g.addColorStop(0, `rgba(${col},${a * .25})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
    else if (t === 'clone') { cl(); ctx.globalAlpha = Math.min(1, a + .3); ctx.drawImage(SRC, (x - r) / k + off.x, (y - r) / k + off.y, 2 * r / k, 2 * r / k, x - r, y - r, 2 * r, 2 * r); }
    else { const col = t === 'dodge' ? '255,255,255' : '0,0,0', g = ctx.createRadialGradient(x, y, 0, x, y, r); ctx.globalCompositeOperation = t === 'dodge' ? 'screen' : t === 'burn' ? 'multiply' : 'destination-out'; g.addColorStop(0, `rgba(${col},${t === 'erase' ? Math.min(1, a + .3) : a * .2})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function dabAt(p) { const k = pvSrc.width / S.base.width, lp = rts.dp; dab(rts.W.getContext('2d'), p.x, p.y, 1, rts.off, rts.SRC, lp); dab(pvSrc.getContext('2d'), p.x * k, p.y * k, k, rts.off, rts.SRC, lp); rts.dp = p; schedule(); }
  function startRt(e) {
    const p = toBase(e), R = S.rt; e.preventDefault();
    if (R.tool === 'clone' && (R.setSrc || !R.src)) { R.src = p; R.setSrc = false; toast(L('Clone source set. Now paint where you want to copy to.', 'تم تحديد المصدر. ارسم الآن حيث تريد النسخ.')); renderPanel(); return; }
    if (pvVer !== S.ver || !pvSrc) rebuildPrev(); pv.setPointerCapture(e.pointerId);
    const W = document.createElement('canvas'); W.width = S.base.width; W.height = S.base.height; W.getContext('2d').drawImage(S.base, 0, 0);
    rts = { W, SRC: S.base, off: R.tool === 'clone' ? { x: R.src.x - p.x, y: R.src.y - p.y } : null, last: p }; dabAt(p);
  }
  function moveRt(e) { const p = toBase(e), r = Math.max(2, S.rt.size * uDim() / 1000), n = Math.min(60, Math.ceil(Math.hypot(p.x - rts.last.x, p.y - rts.last.y) / (r / 3))); for (let i = 1; i <= n; i++) dabAt({ x: rts.last.x + (p.x - rts.last.x) * i / n, y: rts.last.y + (p.y - rts.last.y) * i / n }); rts.last = p; }
  const endRt = () => { if (!rts) return; S.base = rts.W; rts = null; S.ver++; commit(); };
  pv.addEventListener('pointerup', endRt); pv.addEventListener('pointercancel', endRt);
  const uDim = () => Math.max(S.base.width, S.base.height);
  function eraseAt(p) {
    const r = Math.max(S.dr.size * uDim() / 1000, 6) * 1.5; const n = S.overlays.length;
    S.overlays = S.overlays.filter(o => { if (o.k !== 'path') return true; return !o.pts.some(([x, y], i) => { const [x2, y2] = o.pts[i + 1] || [x, y], dx = x2 - x, dy = y2 - y, l = dx * dx + dy * dy || 1, t = clamp(((p.x - x) * dx + (p.y - y) * dy) / l, 0, 1); return Math.hypot(p.x - x - t * dx, p.y - y - t * dy) < r + o.size / 2; }); });
    if (S.overlays.length !== n) { stroke.hit = true; S.sel = -1; schedule(); }
  }
  function startStroke(e) {
    const p = toBase(e), D = S.dr; pv.setPointerCapture(e.pointerId); e.preventDefault();
    if (D.tool === 'eraser') { stroke = { erase: true, hit: false }; eraseAt(p); return; }
    const hl = D.tool === 'highlighter', o = { k: 'path', x: 0, y: 0, rot: 0, pts: [[p.x, p.y]], color: D.color, size: D.size * uDim() / 1000 * (hl ? 2.5 : 1), alpha: hl ? 0.45 : D.opacity / 100, hl };
    S.overlays.push(o); stroke = { o }; schedule();
  }
  pv.addEventListener('pointermove', (e) => { if (rts) return moveRt(e); if (stroke) { const p = toBase(e); if (stroke.erase) eraseAt(p); else { const q = stroke.o.pts[stroke.o.pts.length - 1]; if (Math.hypot(p.x - q[0], p.y - q[1]) > uDim() / 2000) { stroke.o.pts.push([p.x, p.y]); schedule(); } } return; } if (!drag) return; const p = toBase(e), o = S.overlays[S.sel]; o.x = p.x + drag.dx; o.y = p.y + drag.dy; drag.moved = true; schedule(); });
  const endStroke = () => { if (!stroke) return; const done = stroke; stroke = null; if (done.erase ? done.hit : true) commit(); };
  pv.addEventListener('pointerup', endStroke); pv.addEventListener('pointercancel', endStroke);
  const endDrag = () => { if (drag && drag.moved) { commit(); renderPanel(); } drag = null; };
  pv.addEventListener('pointerup', endDrag); pv.addEventListener('pointercancel', endDrag);

  // ---- crop
  function startCrop(ratio) {
    cropRatio = ratio; const bw = S.base.width, bh = S.base.height; let w = bw * 0.9, hh = bh * 0.9;
    if (ratio) { if (w / hh > ratio) w = hh * ratio; else hh = w / ratio; }
    crop = { x: (bw - w) / 2, y: (bh - hh) / 2, w, h: hh }; S.sel = -1; cropBox.hidden = false; render(); renderPanel();
  }
  function endCrop() { crop = null; cropBox.hidden = true; }
  function placeCrop() { const ds = pv.clientWidth / S.base.width; Object.assign(cropBox.style, { left: crop.x * ds + 'px', top: crop.y * ds + 'px', width: crop.w * ds + 'px', height: crop.h * ds + 'px' }); }
  let cd = null;
  cropBox.addEventListener('pointerdown', (e) => { cd = { x: e.clientX, y: e.clientY, c: { ...crop }, hnd: e.target.dataset.h || 'move' }; cropBox.setPointerCapture(e.pointerId); e.preventDefault(); });
  cropBox.addEventListener('pointermove', (e) => {
    if (!cd) return; const bw = S.base.width, bh = S.base.height, ds = pv.clientWidth / bw, dx = (e.clientX - cd.x) / ds, dy = (e.clientY - cd.y) / ds, c = cd.c, MIN = 20;
    if (cd.hnd === 'move') { crop = { ...c, x: clamp(c.x + dx, 0, bw - c.w), y: clamp(c.y + dy, 0, bh - c.h) }; }
    else {
      let x1 = c.x, y1 = c.y, x2 = c.x + c.w, y2 = c.y + c.h; const hn = cd.hnd;
      if (hn.includes('w')) x1 = clamp(x1 + dx, 0, x2 - MIN); if (hn.includes('e')) x2 = clamp(x2 + dx, x1 + MIN, bw);
      if (hn.includes('n')) y1 = clamp(y1 + dy, 0, y2 - MIN); if (hn.includes('s')) y2 = clamp(y2 + dy, y1 + MIN, bh);
      if (cropRatio) {
        let w = x2 - x1, hh = w / cropRatio;
        const maxH = hn.includes('n') ? y2 : bh - y1; if (hh > maxH) { hh = maxH; w = hh * cropRatio; }
        const maxW = hn.includes('w') ? x2 : bw - x1; if (w > maxW) { w = maxW; hh = w / cropRatio; }
        if (hn.includes('w')) x1 = x2 - w; else x2 = x1 + w; if (hn.includes('n')) y1 = y2 - hh; else y2 = y1 + hh;
      }
      crop = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    placeCrop();
  });
  const endCd = () => { cd = null; }; cropBox.addEventListener('pointerup', endCd); cropBox.addEventListener('pointercancel', endCd);
  function applyCrop() {
    const x = Math.round(crop.x), y = Math.round(crop.y), w = Math.max(1, Math.round(crop.w)), hh = Math.max(1, Math.round(crop.h));
    const c = document.createElement('canvas'); c.width = w; c.height = hh; c.getContext('2d').drawImage(S.base, x, y, w, hh, 0, 0, w, hh);
    S.overlays.forEach(o => { if (o.pts) o.pts = o.pts.map(([a, b]) => [a - x, b - y]); else { o.x -= x; o.y -= y; } }); S.base = c; S.ver++; S.sel = -1; endCrop(); commit(); renderPanel();
  }

  // ---- transforms
  function transform(kind) {
    const b = S.base, bw = b.width, bh = b.height, c = document.createElement('canvas'), rot = kind === 'cw' || kind === 'ccw';
    c.width = rot ? bh : bw; c.height = rot ? bw : bh; const ctx = c.getContext('2d');
    if (kind === 'cw') { ctx.translate(bh, 0); ctx.rotate(Math.PI / 2); } else if (kind === 'ccw') { ctx.translate(0, bw); ctx.rotate(-Math.PI / 2); }
    else if (kind === 'fh') { ctx.translate(bw, 0); ctx.scale(-1, 1); } else { ctx.translate(0, bh); ctx.scale(1, -1); }
    ctx.drawImage(b, 0, 0);
    S.overlays.forEach(o => {
      const f = (x, y) => kind === 'cw' ? [bh - y, x] : kind === 'ccw' ? [y, bw - x] : kind === 'fh' ? [bw - x, y] : [x, bh - y];
      if (o.pts) { o.pts = o.pts.map(([a, b]) => f(a, b)); return; }
      [o.x, o.y] = f(o.x, o.y); if (kind === 'cw') o.rot += 90; else if (kind === 'ccw') o.rot -= 90; else o.rot = -o.rot;
    });
    S.base = c; S.ver++; S.sel = -1; endCrop(); commit(); renderPanel();
  }
  function resizeTo(nw, nh) {
    const bw = S.base.width, bh = S.base.height;
    if (!(nw >= 1 && nh >= 1) || nw > 10000 || nh > 10000 || nw * nh > 60e6) return toast(L('Choose a size between 1 and 10,000 px (max 60 megapixels).', 'اختر مقاساً بين 1 و10,000 بكسل (حد أقصى 60 ميغابكسل).'), 'error');
    const c = document.createElement('canvas'); c.width = nw; c.height = nh; const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(S.base, 0, 0, nw, nh);
    const kx = nw / bw, ky = nh / bh;
    S.overlays.forEach(o => { if (o.pts) o.pts = o.pts.map(([a, b]) => [a * kx, b * ky]); o.x *= kx; o.y *= ky; if (o.size) o.size *= kx; if (o.w) { o.w *= kx; o.h *= ky; } o.sw = (o.sw || 0) * kx; });
    S.base = c; S.ver++; commit(); renderPanel(); toast(L('Resized to ' + nw + ' × ' + nh + ' px.', 'تم تغيير الحجم إلى ' + nw + ' × ' + nh + ' بكسل.'), 'success');
  }

  // ---- panel
  const TABS = [['adjust', L('Adjust', 'ضبط')], ['filters', L('Filters', 'فلاتر')], ['crop', L('Crop', 'قص')], ['transform', L('Transform', 'تحويل')], ['draw', L('Draw', 'رسم')], ['retouch', L('Retouch', 'لمس')], ['effects', L('Effects', 'تأثيرات')], ['add', L('Add', 'إضافة')]];
  function renderTabs() { pv.style.cursor = S.tab === 'draw' || S.tab === 'retouch' ? 'crosshair' : ''; pv.style.touchAction = S.tab === 'draw' || S.tab === 'retouch' ? 'none' : ''; if (S.tab === 'draw' || S.tab === 'retouch') S.sel = -1; tabsEl.style.cssText = 'flex-wrap:wrap;overflow:visible'; tabsEl.replaceChildren(...TABS.map(([k, l]) => h('button', { style: { flex: '1 1 auto' }, class: 'tab' + (S.tab === k ? ' active' : ''), role: 'tab', 'aria-selected': S.tab === k, onclick: () => { if (S.tab === 'crop' && k !== 'crop') { endCrop(); render(); } S.tab = k; renderTabs(); renderPanel(); } }, l))); }
  const field = (label, ...c) => h('label', { class: 'field' }, h('span', null, label), ...c);
  function slider(label, val, min, max, step, onIn, onChange, onReset) {
    const out = h('output', null, String(Math.round(val * 100) / 100));
    const i = h('input', { type: 'range', class: 'range', min, max, step, value: val, 'aria-label': label });
    i.addEventListener('input', () => { out.textContent = i.value; onIn(parseFloat(i.value)); }); i.addEventListener('change', onChange);
    return h('div', { class: 'field' }, h('span', { class: 'row between' }, label, h('span', { class: 'row' }, out, onReset ? h('button', { class: 'btn icon sm', 'aria-label': L('Reset ', 'إعادة ضبط ') + label, title: L('Reset', 'إعادة ضبط'), onclick: () => { onReset(); } }, icon('rotate-ccw')) : null)), i);
  }
  const numIn = (val, min, max, onIn, label) => { const i = h('input', { class: 'input', type: 'number', min, max, step: 1, value: Math.round(val), 'aria-label': label }); i.addEventListener('input', () => { if (i.value !== '') onIn(parseFloat(i.value)); }); i.addEventListener('change', commit); return i; };
  const colorIn = (val, onIn, label) => { const i = h('input', { type: 'color', class: 'color', value: val, 'aria-label': label }); i.addEventListener('input', () => onIn(i.value)); i.addEventListener('change', commit); return i; };

  function adjustView() {
    return h('div', null, h('button', { class: 'btn sm primary', onclick: autoEnhance }, icon('sparkles'), L('Auto enhance', 'تحسين تلقائي')), ADJ.map(([k, en, ar]) => slider(L(en, ar), S.params[k], k === 'sharpness' ? 0 : -100, 100, 1, v => { S.params[k] = v; schedule(); }, commit, () => { S.params[k] = 0; commit(); renderPanel(); })),
      h('button', { class: 'btn sm', onclick: () => { S.params = { ...DEFAULT_PARAMS }; S.fx = { ...FXD }; S.filter = 'none'; S.amt = 100; commit(); renderPanel(); toast(L('All adjustments reset.', 'تمت إعادة ضبط كل التعديلات.')); } }, icon('rotate-ccw'), L('Reset all adjustments', 'إعادة ضبط كل التعديلات')));
  }
  let thumbs = null, thumbVer = -1;
  function filtersView() {
    if (thumbVer !== S.ver || !thumbs) {
      thumbs = {}; const k = 96 / Math.max(S.base.width, S.base.height);
      FILTERS.forEach(f => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(S.base.width * k)); c.height = Math.max(1, Math.round(S.base.height * k)); const x = c.getContext('2d'); x.drawImage(S.base, 0, 0, c.width, c.height); if (f !== 'none') { const id = x.getImageData(0, 0, c.width, c.height); adjustPixels(id.data, c.width, c.height, DEFAULT_PARAMS, f, 100); x.putImageData(id, 0, 0); } thumbs[f] = c; }); thumbVer = S.ver;
    }
    return h('div', null, h('div', { class: 'grid filters' }, FILTERS.map(f => h('button', { class: 'filter' + (S.filter === f ? ' active' : ''), 'aria-pressed': S.filter === f, onclick: () => { S.filter = f; S.amt = 100; commit(); renderPanel(); } }, thumbs[f], h('span', null, L(...FNAMES[f]))))),
      S.filter !== 'none' ? slider(L('Intensity', 'الشدة'), S.amt, 0, 100, 1, v => { S.amt = v; schedule(); }, commit) : null);
  }
  function cropView() {
    const R = [[L('Free', 'حر'), 0], ['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['3:2', 3 / 2], ['4:5', 4 / 5], ['3:4', 3 / 4], ['2:3', 2 / 3], ['9:16', 9 / 16], ['21:9', 21 / 9]];
    return h('div', null, h('p', { class: 'muted small' }, L('Pick an aspect ratio, then drag the box or its corners on the photo.', 'اختر نسبة الأبعاد ثم اسحب الإطار أو زواياه على الصورة.')),
      h('div', { class: 'btn-row' }, R.map(([l, r]) => h('button', { class: 'btn sm' + (crop && cropRatio === r ? ' on' : ''), onclick: () => startCrop(r) }, l))),
      crop ? h('div', { class: 'btn-row' }, h('button', { class: 'btn primary sm', onclick: applyCrop }, icon('check'), L('Apply crop', 'تطبيق القص')), h('button', { class: 'btn sm', onclick: () => { endCrop(); render(); renderPanel(); } }, L('Cancel', 'إلغاء'))) : null);
  }
  function transformView() {
    const bw = S.base.width, bh = S.base.height; let lock = true;
    const wI = h('input', { class: 'input', type: 'number', min: 1, max: 10000, value: bw, 'aria-label': L('Width in pixels', 'العرض بالبكسل') });
    const hI = h('input', { class: 'input', type: 'number', min: 1, max: 10000, value: bh, 'aria-label': L('Height in pixels', 'الارتفاع بالبكسل') });
    wI.addEventListener('input', () => { if (lock && wI.value) hI.value = Math.max(1, Math.round(wI.value * bh / bw)); });
    hI.addEventListener('input', () => { if (lock && hI.value) wI.value = Math.max(1, Math.round(hI.value * bw / bh)); });
    const lk = h('input', { type: 'checkbox', checked: true, onchange: (e) => { lock = e.target.checked; } });
    return h('div', null, h('div', { class: 'sec' }, h('h4', null, L('Rotate & flip', 'تدوير وقلب')), h('div', { class: 'btn-row' },
      h('button', { class: 'btn sm', onclick: () => transform('ccw') }, icon('rotate-ccw'), L('Left', 'يسار')), h('button', { class: 'btn sm', onclick: () => transform('cw') }, icon('rotate-cw'), L('Right', 'يمين')),
      h('button', { class: 'btn sm', onclick: () => transform('fh') }, icon('flip-horizontal-2'), L('Flip H', 'قلب أفقي')), h('button', { class: 'btn sm', onclick: () => transform('fv') }, icon('flip-vertical-2'), L('Flip V', 'قلب رأسي')))),
      straightenSec(), h('div', { class: 'sec' }, h('h4', null, L('Resize (pixels)', 'تغيير الحجم (بكسل)')), h('div', { class: 'row' }, field(L('Width', 'العرض'), wI), field(L('Height', 'الارتفاع'), hI)),
        h('label', { class: 'check' }, lk, L('Maintain aspect ratio', 'الحفاظ على نسبة الأبعاد')), h('button', { class: 'btn sm', onclick: () => resizeTo(parseInt(wI.value), parseInt(hI.value)) }, L('Apply size', 'تطبيق الحجم'))),
      h('div', { class: 'sec' }, h('button', { class: 'btn sm danger-o', onclick: async () => { if (await confirmDialog({ title: L('Revert to original?', 'العودة للأصل؟'), message: L('All edits, including crops and overlays, will be removed.', 'ستتم إزالة كل التعديلات بما فيها القص والعناصر المضافة.'), confirmText: L('Revert', 'عودة'), danger: true })) { S.base = S.orig; S.overlays = []; S.params = { ...DEFAULT_PARAMS }; S.fx = { ...FXD }; S.filter = 'none'; S.sel = -1; S.ver++; endCrop(); commit(); renderPanel(); } } }, L('Revert to original', 'العودة إلى الأصل'))));
  }
  function drawView() {
    const D = S.dr, T = [['pen', 'pencil', L('Pen', 'قلم')], ['highlighter', 'brush', L('Highlighter', 'تظليل')], ['eraser', 'eraser', L('Eraser', 'ممحاة')]];
    const sw = h('div', { class: 'btn-row' }, SWATCHES.map(c => h('button', { class: 'btn icon sm', style: { background: c, border: '2px solid ' + (D.color === c ? '#7c3aed' : '#9ca3af') }, 'aria-label': c, onclick: () => { D.color = c; renderPanel(); } })));
    const n = S.overlays.filter(o => o.k === 'path').length;
    return h('div', null, h('p', { class: 'muted small' }, L('Pick a tool and draw directly on the photo. The eraser removes whole strokes you touch.', 'اختر أداة وارسم مباشرة على الصورة. الممحاة تحذف الخطوط التي تلمسها.')),
      h('div', { class: 'btn-row' }, T.map(([k, ic, l]) => h('button', { class: 'btn sm' + (D.tool === k ? ' on' : ''), 'aria-pressed': D.tool === k, onclick: () => { D.tool = k; renderPanel(); } }, icon(ic), l))),
      D.tool !== 'eraser' ? field(L('Color', 'اللون'), colorIn(D.color, v => { D.color = v; }, L('Brush color', 'لون الفرشاة'))) : null, D.tool !== 'eraser' ? sw : null,
      slider(L('Size', 'الحجم'), D.size, 1, 60, 1, v => { D.size = v; }, () => {}),
      D.tool === 'pen' ? slider(L('Opacity', 'الشفافية'), D.opacity, 10, 100, 1, v => { D.opacity = v; }, () => {}) : null,
      h('button', { class: 'btn sm danger-o', disabled: !n, onclick: () => { S.overlays = S.overlays.filter(o => o.k !== 'path'); commit(); renderPanel(); } }, icon('trash-2'), L('Clear all drawings', 'مسح كل الرسومات') + (n ? ' (' + n + ')' : '')));
  }
  function retouchView() {
    const R = S.rt, T = [['paint', L('Paint brush', 'فرشاة تلوين')], ['heal', L('Spot heal', 'علاج البقع')], ['sharpen', L('Sharpen', 'حدّة')], ['smudge', L('Smudge', 'تلطيخ')], ['saturate', L('Sponge +', 'إشباع +')], ['desaturate', L('Sponge −', 'إشباع −')], ['redeye', L('Red-eye fix', 'إزالة احمرار العين')], ['blur', L('Blur / smooth', 'تنعيم')], ['clone', L('Clone stamp', 'ختم الاستنساخ')], ['mosaic', L('Mosaic / hide', 'موزاييك / إخفاء')], ['dodge', L('Dodge (lighten)', 'تفتيح')], ['burn', L('Burn (darken)', 'تغميق')], ['erase', L('Erase to transparent', 'مسح للشفافية')]];
    return h('div', null, h('p', { class: 'muted small' }, L('These tools paint directly into the photo pixels. Use Undo to step back.', 'هذه الأدوات ترسم مباشرة على بكسلات الصورة. استخدم تراجع للعودة.')),
      h('div', { class: 'btn-row' }, T.map(([k, l]) => h('button', { class: 'btn sm' + (R.tool === k ? ' on' : ''), 'aria-pressed': R.tool === k, onclick: () => { R.tool = k; renderPanel(); } }, l))),
      R.tool === 'clone' ? h('div', { class: 'btn-row' }, h('button', { class: 'btn sm' + (R.setSrc || !R.src ? ' on' : ''), onclick: () => { R.setSrc = true; toast(L('Tap the photo to pick the area to copy from.', 'انقر على الصورة لاختيار منطقة النسخ.')); renderPanel(); } }, icon('pipette'), L('Set source point', 'تحديد نقطة المصدر')), h('span', { class: 'muted small' }, R.src ? L('Source set', 'تم تحديد المصدر') : L('Pick a source first', 'اختر مصدراً أولاً'))) : null,
      R.tool === 'paint' ? field(L('Color', 'اللون'), colorIn(S.dr.color, v => { S.dr.color = v; }, L('Brush color', 'لون الفرشاة'))) : null,
      slider(L('Brush size', 'حجم الفرشاة'), R.size, 3, 100, 1, v => { R.size = v; }, () => {}), slider(L('Strength', 'القوة'), R.strength, 5, 100, 1, v => { R.strength = v; }, () => {}));
  }
  function autoEnhance() {
    if (pvVer !== S.ver || !pvSrc) rebuildPrev(); const d = pvSrc.getContext('2d').getImageData(0, 0, pvSrc.width, pvSrc.height).data, hs = new Uint32Array(256); let n = 0, a = 0, lo = 0, hi = 255;
    for (let i = 0; i < d.length; i += 16) { hs[Math.round(.3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2])]++; n++; }
    for (let i = 0; i < 256; i++) { a += hs[i]; if (a > n * .01) { lo = i; break; } } a = 0; for (let i = 255; i >= 0; i--) { a += hs[i]; if (a > n * .01) { hi = i; break; } }
    S.params = { ...S.params, contrast: Math.round(clamp((255 / Math.max(40, hi - lo) - 1) * 70, 0, 60)), brightness: Math.round(clamp((128 - (lo + hi) / 2) / 2.55 * .7, -30, 30)), saturation: 12 }; commit(); renderPanel(); toast(L('Auto enhance applied.', 'تم التحسين التلقائي.'), 'success');
  }
  function straighten(deg) {
    if (!deg) return; const b = S.base, w = b.width, hh = b.height, a = deg * Math.PI / 180, sc = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)) * Math.max(w / hh, hh / w), c = document.createElement('canvas'); c.width = w; c.height = hh;
    const x = c.getContext('2d'); x.translate(w / 2, hh / 2); x.rotate(a); x.scale(sc, sc); x.drawImage(b, -w / 2, -hh / 2);
    const f = (px, py) => { const dx = (px - w / 2) * sc, dy = (py - hh / 2) * sc; return [w / 2 + dx * Math.cos(a) - dy * Math.sin(a), hh / 2 + dx * Math.sin(a) + dy * Math.cos(a)]; };
    S.overlays.forEach(o => { if (o.pts) o.pts = o.pts.map(([u, v]) => f(u, v)); else { [o.x, o.y] = f(o.x, o.y); o.rot += deg; if (o.w) { o.w *= sc; o.h *= sc; } o.sw = (o.sw || 0) * sc; } if (o.size) o.size *= sc; });
    S.base = c; S.ver++; commit(); renderPanel();
  }
  function straightenSec() {
    let ang = 0; const out = h('output', null, '0°'), i = h('input', { type: 'range', class: 'range', min: -45, max: 45, step: 0.5, value: 0, 'aria-label': L('Angle', 'الزاوية') }); i.addEventListener('input', () => { ang = parseFloat(i.value); out.textContent = ang + '°'; });
    return h('div', { class: 'sec' }, h('h4', null, L('Straighten / free rotate', 'تقويم / تدوير حر')), h('div', { class: 'field' }, h('span', { class: 'row between' }, L('Angle', 'الزاوية'), out), i), h('button', { class: 'btn sm', onclick: () => straighten(ang) }, L('Apply rotation', 'تطبيق التدوير')));
  }
  function effectsView() {
    const f = S.fx;
    return h('div', null, FX.map(([k, en, ar, mn, mx]) => slider(L(en, ar), f[k], mn, mx, 1, v => { f[k] = v; schedule(); }, commit, () => { f[k] = 0; commit(); renderPanel(); })),
      field(L('Border color', 'لون الإطار'), colorIn(f.bc, v => { f.bc = v; schedule(); }, L('Border color', 'لون الإطار'))),
      h('button', { class: 'btn sm', onclick: () => { S.fx = { ...FXD }; commit(); renderPanel(); } }, icon('rotate-ccw'), L('Reset effects', 'إعادة ضبط التأثيرات')),
      h('p', { class: 'muted small' }, L('Blur and hue need a browser with canvas filter support (Chrome, Edge, Firefox).', 'الضبابية وتدوير الألوان تحتاجان متصفحاً يدعم فلاتر الكانفاس (Chrome وEdge وFirefox).')));
  }
  function addOverlay(o) { o.rot = 0; S.overlays.push(o); S.sel = S.overlays.length - 1; commit(); renderPanel(); }
  function addView() {
    const bw = S.base.width, bh = S.base.height, u = Math.max(bw, bh);
    const sel = S.overlays[S.sel], out = [];
    out.push(h('div', { class: 'sec' }, h('button', { class: 'btn sm', onclick: () => addOverlay({ k: 'text', text: L('Your text', 'نصك هنا'), x: bw / 2, y: bh / 2, size: Math.round(u / 14), color: '#ffffff', stroke: '#000000', sw: Math.round(u / 300), font: isAr() ? 'Cairo' : 'Inter', bold: true, italic: false }) }, icon('type'), L('Add text', 'إضافة نص'))));
    out.push(h('div', { class: 'sec' }, h('h4', null, L('Stickers', 'ملصقات')), h('div', { class: 'stickers' }, STICKERS.map(s => h('button', { class: 'sticker', 'aria-label': s, onclick: () => addOverlay({ k: 'sticker', text: s, x: bw / 2, y: bh / 2, size: Math.round(u / 8) }) }, s)))));
    out.push(h('div', { class: 'sec' }, h('h4', null, L('Shapes', 'أشكال')), h('div', { class: 'btn-row' }, SHAPES.map(([s, ic, en, ar]) => h('button', { class: 'btn icon sm', 'aria-label': L(en, ar), title: L(en, ar), onclick: () => addOverlay({ k: 'shape', shape: s, x: bw / 2, y: bh / 2, w: Math.round(u / 4), h: s === 'line' ? 0 : Math.round(u / 4), fill: s === 'line' ? 'transparent' : '#7c3aed', stroke: s === 'line' ? '#7c3aed' : '#ffffff', sw: s === 'line' ? Math.round(u / 150) : 0 }) }, ic.length === 1 ? ic : icon(ic))))));
    if (sel) {
      const f = [];
      if (sel.k === 'text') {
        const ta = h('textarea', { class: 'input', rows: 2, maxlength: 300, 'aria-label': L('Text', 'النص') }); ta.value = sel.text; ta.addEventListener('input', () => { sel.text = ta.value || ' '; schedule(); }); ta.addEventListener('change', commit);
        const fs = h('select', { class: 'select', 'aria-label': L('Font', 'الخط') }, FONTS.map(x => h('option', { value: x, selected: x === sel.font }, x)));
        fs.addEventListener('change', async () => { await document.fonts.load('16px "' + fs.value + '"').catch(() => 0); sel.font = fs.value; commit(); });
        f.push(field(L('Text', 'النص'), ta), field(L('Font', 'الخط'), fs),
          h('div', { class: 'row' }, field(L('Size', 'الحجم'), numIn(sel.size, 4, 5000, v => { sel.size = v; schedule(); }, L('Size', 'الحجم'))), field(L('Color', 'اللون'), colorIn(sel.color, v => { sel.color = v; schedule(); }, L('Text color', 'لون النص')))),
          h('div', { class: 'row' }, field(L('Stroke', 'الحد'), colorIn(sel.stroke, v => { sel.stroke = v; schedule(); }, L('Stroke color', 'لون الحد'))), field(L('Stroke width', 'سماكة الحد'), numIn(sel.sw, 0, 200, v => { sel.sw = v; schedule(); }, L('Stroke width', 'سماكة الحد')))),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn icon sm' + (sel.bold ? ' on' : ''), 'aria-label': L('Bold', 'عريض'), onclick: () => { sel.bold = !sel.bold; commit(); renderPanel(); } }, icon('bold')), h('button', { class: 'btn icon sm' + (sel.italic ? ' on' : ''), 'aria-label': L('Italic', 'مائل'), onclick: () => { sel.italic = !sel.italic; commit(); renderPanel(); } }, icon('italic'))));
      } else if (sel.k === 'sticker') f.push(field(L('Size', 'الحجم'), numIn(sel.size, 8, 5000, v => { sel.size = v; schedule(); }, L('Size', 'الحجم'))));
      else f.push(h('div', { class: 'row' }, field(L('Width', 'العرض'), numIn(sel.w, 1, 10000, v => { sel.w = v; schedule(); }, L('Width', 'العرض'))), sel.shape !== 'line' ? field(L('Height', 'الارتفاع'), numIn(sel.h, 1, 10000, v => { sel.h = v; schedule(); }, L('Height', 'الارتفاع'))) : null),
        h('div', { class: 'row' }, sel.shape !== 'line' ? field(L('Fill', 'التعبئة'), colorIn(sel.fill === 'transparent' ? '#7c3aed' : sel.fill, v => { sel.fill = v; schedule(); }, L('Fill', 'التعبئة'))) : null, field(L('Stroke', 'الحد'), colorIn(sel.stroke, v => { sel.stroke = v; schedule(); }, L('Stroke', 'الحد'))), field(L('Width', 'السماكة'), numIn(sel.sw, 0, 500, v => { sel.sw = v; schedule(); }, L('Stroke width', 'سماكة الحد')))));
      f.push(slider(L('Rotation (°)', 'التدوير (°)'), Math.round(sel.rot), -180, 180, 1, v => { sel.rot = v; schedule(); }, commit),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn sm', onclick: () => { const c = clone(sel); c.x += 30; c.y += 30; S.overlays.push(c); S.sel = S.overlays.length - 1; commit(); renderPanel(); } }, icon('copy'), L('Duplicate', 'تكرار')),
          h('button', { class: 'btn sm danger-o', onclick: () => { S.overlays.splice(S.sel, 1); S.sel = -1; commit(); renderPanel(); } }, icon('trash-2'), L('Delete', 'حذف'))),
        h('p', { class: 'muted small' }, L('Drag the selected item on the photo to move it.', 'اسحب العنصر المحدد على الصورة لتحريكه.')));
      out.push(h('div', { class: 'sec' }, h('h4', null, L('Selected item', 'العنصر المحدد')), f));
    } else if (S.overlays.length) out.push(h('p', { class: 'muted small' }, L('Click an item on the photo to edit it.', 'انقر على عنصر في الصورة لتعديله.')));
    return h('div', null, out);
  }
  function renderPanel() {
    if (!S.base) return;
    const ae = document.activeElement; if (body.contains(ae) && ['number', 'text', 'textarea'].includes(ae.type || ae.tagName.toLowerCase()) && !drag) { /* keep focus while typing */ if (ae.tagName === 'TEXTAREA' || ae.type === 'number') return; }
    body.replaceChildren({ adjust: adjustView, filters: filtersView, crop: cropView, transform: transformView, draw: drawView, retouch: retouchView, effects: effectsView, add: addView }[S.tab]()); refreshIcons();
  }

  // ---- export
  function exportDialog() {
    if (!S.base) return toast(L('Open a photo first.', 'افتح صورة أولاً.'));
    const fmt = h('select', { class: 'select', 'aria-label': L('Format', 'الصيغة') }, h('option', { value: 'png' }, 'PNG'), h('option', { value: 'jpeg' }, 'JPG'), h('option', { value: 'webp' }, 'WebP'));
    const q = h('input', { type: 'range', class: 'range', min: 0.4, max: 1, step: 0.01, value: 0.92, 'aria-label': L('Quality', 'الجودة') }); const qo = h('output', null, '92%');
    const qw = h('div', { class: 'field' }, h('span', { class: 'row between' }, L('Quality', 'الجودة'), qo), q);
    const note = h('p', { class: 'muted small' }, S.base.width + ' × ' + S.base.height + ' px');
    const upd = () => { qw.style.display = fmt.value === 'png' ? 'none' : ''; qo.textContent = Math.round(q.value * 100) + '%'; }; fmt.addEventListener('input', upd); q.addEventListener('input', upd); upd();
    const btn = h('button', { class: 'btn primary', onclick: async () => {
      btn.disabled = true; btn.textContent = L('Exporting…', 'جارٍ التصدير…');
      try {
        await new Promise(r => setTimeout(r, 30)); let c = renderFull(); const type = 'image/' + fmt.value;
        if (fmt.value === 'jpeg') { const w = document.createElement('canvas'); w.width = c.width; w.height = c.height; const x = w.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w.width, w.height); x.drawImage(c, 0, 0); c = w; }
        const blob = await canvasToBlob(c, type, parseFloat(q.value)); let ext = fmt.value === 'jpeg' ? 'jpg' : fmt.value;
        if (blob.type !== type) { ext = blob.type.split('/')[1] || 'png'; toast(L('Your browser does not support ' + fmt.value.toUpperCase() + ' export; saved as ' + ext.toUpperCase() + ' instead.', 'متصفحك لا يدعم تصدير ' + fmt.value.toUpperCase() + '؛ تم الحفظ بصيغة ' + ext.toUpperCase() + '.')); }
        downloadBlob(blob, S.name + '-edited.' + ext); toast(L('Exported (' + formatBytes(blob.size) + ').', 'تم التصدير (' + formatBytes(blob.size) + ').'), 'success'); m.close();
      } catch (e) { toast(e.message, 'error'); } finally { btn.disabled = false; btn.textContent = L('Download', 'تنزيل'); }
    } }, L('Download', 'تنزيل'));
    const m = modal({ title: L('Export photo', 'تصدير الصورة'), body: h('div', null, field(L('Format', 'الصيغة'), fmt), qw, note, h('p', { class: 'muted small' }, L('All edits are rendered into the exported pixels at full resolution.', 'تُطبَّق كل التعديلات على بكسلات الصورة المصدّرة بالدقة الكاملة.'))), actions: [h('button', { class: 'btn', onclick: () => m.close() }, L('Cancel', 'إلغاء')), btn] });
  }

  // ---- layout
  function build() {
    renderTabs();
    stage.replaceChildren();
    if (!S.base) {
      stage.append(h('div', { class: 'drop-empty', role: 'button', tabindex: '0', 'aria-label': L('Choose a photo', 'اختر صورة') }, icon('image-up'), h('h2', null, L('Open a photo to start editing', 'افتح صورة لبدء التحرير')),
        h('p', null, L('Drag and drop here, or click to choose a file.', 'اسحب وأفلت هنا، أو انقر لاختيار ملف.')), h('p', { class: 'muted small' }, L('JPG, PNG or WebP · up to 30 MB · stays on your device', 'JPG أو PNG أو WebP · حتى 30 ميغابايت · تبقى على جهازك')),
        h('button', { class: 'btn primary', onclick: (e) => { e.stopPropagation(); dz.open(); } }, L('Choose photo', 'اختر صورة'))));
      body.replaceChildren(h('div', { class: 'empty small' }, icon('sliders-horizontal'), h('p', null, L('Tools appear here once a photo is open.', 'ستظهر الأدوات هنا بعد فتح صورة.')))); [undoB, redoB, cmpB, exportB].forEach(b => { b.disabled = true; });
    } else {
      [undoB, redoB, cmpB, exportB].forEach(b => { b.disabled = false; }); stage.append(inner); renderPanel(); render();
    }
    refreshIcons();
  }
  const ro = new ResizeObserver(() => { if (crop) placeCrop(); }); ro.observe(stage);
  build();
  if (S.tab === 'crop') S.tab = 'adjust';
  renderTabs();
  return () => { disposed = true; ro.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('beforeunload', onBeforeUnload); window.removeEventListener('keydown', onKey); };
}
