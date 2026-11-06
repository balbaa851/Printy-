import { L } from '../core.js';
import { PERF } from '../perf.js';
import { h, icon, refreshIcons, toast, confirmDialog, validateImage, fileToCanvas, canvasToBlob, downloadBlob, baseName, clamp } from '../util.js';

// Manual background editing (colour tolerance + eraser/restore brush). Not automatic AI removal.
const S = { orig: null, cur: null, name: '', hist: [], hi: -1, tool: 'pick', tol: 40, feather: 10, contiguous: true, size: 30, zoom: 1 };

export function removeColor(data, w, h_, sx, sy, tol, feather, contiguous) {
  const i0 = (sy * w + sx) * 4, r0 = data[i0], g0 = data[i0 + 1], b0 = data[i0 + 2];
  // squared distances: no sqrt/hypot per pixel except inside the soft-edge band
  const lim = tol + feather, lim2 = lim * lim, tol2 = tol * tol;
  const apply = (i) => { const dr = data[i] - r0, dg = data[i + 1] - g0, db = data[i + 2] - b0, d2 = dr * dr + dg * dg + db * db; if (d2 > lim2) return false; const a = d2 <= tol2 || feather === 0 ? 0 : Math.round(255 * (Math.sqrt(d2) - tol) / feather); if (a < data[i + 3]) data[i + 3] = a; return true; };
  if (!contiguous) { for (let i = 0; i < data.length; i += 4) apply(i); return; }
  const seen = new Uint8Array(w * h_), stack = [sy * w + sx]; seen[sy * w + sx] = 1;
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p - x) / w;
    if (!apply(p * 4)) continue;
    if (x > 0 && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1 && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
    if (y < h_ - 1 && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
  }
}

export async function mount(root) {
  let painting = false, last = null, disposed = false, pend = null, raf = 0;
  const stage = h('div', { class: 'rb-stage checker' });
  const panel = h('aside', { class: 'st-panel' });
  const body = h('div', { class: 'panel-body' });
  panel.append(body);
  const bt = (ic, label, fn) => h('button', { class: 'btn icon', 'aria-label': label, title: label, onclick: fn }, icon(ic));
  const undoB = bt('undo-2', L('Undo', 'تراجع'), () => go(S.hi - 1)), redoB = bt('redo-2', L('Redo', 'إعادة'), () => go(S.hi + 1));
  const picker = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  picker.addEventListener('change', () => { const f = [...picker.files]; picker.value = ''; if (f.length) openFile(f[0]); });
  const exportB = h('button', { class: 'btn primary sm', onclick: exportPng }, icon('download'), h('span', { class: 'hide-sm' }, L('Download PNG', 'تنزيل PNG')));
  const panelB = bt('sliders-horizontal', L('Panels', 'اللوحات'), () => panel.classList.toggle('open')); panelB.classList.add('only-mobile');
  root.append(h('div', { class: 'studio' },
    h('div', { class: 'st-top' }, h('strong', { class: 'hide-sm' }, L('Remove Background', 'إزالة الخلفية')), h('span', { class: 'badge' }, L('Manual tool — not AI', 'أداة يدوية — وليست ذكاءً اصطناعياً')),
      h('button', { class: 'btn sm', onclick: () => picker.click() }, icon('image-plus'), h('span', { class: 'hide-sm' }, L('New photo', 'صورة جديدة'))), h('span', { class: 'sep' }), undoB, redoB,
      bt('zoom-out', L('Zoom out', 'تصغير'), () => setZoom(S.zoom / 1.25)), bt('zoom-in', L('Zoom in', 'تكبير'), () => setZoom(S.zoom * 1.25)), h('span', { class: 'grow' }), exportB, panelB),
    h('div', { class: 'st-body' }, stage, panel)), picker);
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('drag'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('drag'));
  stage.addEventListener('drop', (e) => { e.preventDefault(); stage.classList.remove('drag'); const f = [...(e.dataTransfer?.files || [])]; if (f[0]) openFile(f[0]); });

  async function openFile(f) {
    if (S.cur && S.hist.length > 1 && !(await confirmDialog({ title: L('Open a new photo?', 'فتح صورة جديدة؟'), message: L('Your current edits will be discarded.', 'سيتم تجاهل تعديلاتك الحالية.'), confirmText: L('Open', 'فتح'), danger: true }))) return;
    const v = await validateImage(f); if (!v.ok) return toast(v.error, 'error');
    try {
      const MAX_DIM = PERF.rbDim, c = await fileToCanvas(f, MAX_DIM);
      if (c.srcWidth > MAX_DIM || c.srcHeight > MAX_DIM) toast(L('Photo reduced to ' + MAX_DIM + ' px on its longest side so editing stays smooth.', 'تم تصغير الصورة إلى ' + MAX_DIM + ' بكسل للضلع الأطول ليبقى التحرير سلساً.'));
      S.orig = c; S.cur = document.createElement('canvas'); S.cur.width = c.width; S.cur.height = c.height; S.cur.getContext('2d', { willReadFrequently: true }).drawImage(c, 0, 0);
      S.name = baseName(f.name); S.hist = []; S.hi = -1; S.zoom = 1; push(); build();
    } catch (e) { toast(e.message, 'error'); }
  }
  const ctx = () => S.cur.getContext('2d', { willReadFrequently: true });
  function push() { S.hist = S.hist.slice(0, S.hi + 1); S.hist.push(ctx().getImageData(0, 0, S.cur.width, S.cur.height)); while (S.hist.length > 2 && (S.hist.length > 15 || S.hist.length * S.cur.width * S.cur.height * 4 > PERF.histMB * 1048576 * 0.5)) S.hist.shift(); S.hi = S.hist.length - 1; sync(); }
  function go(i) { if (i < 0 || i >= S.hist.length) return; S.hi = i; ctx().putImageData(S.hist[i], 0, 0); sync(); }
  function sync() { undoB.disabled = S.hi <= 0; redoB.disabled = S.hi >= S.hist.length - 1; }
  function setZoom(z) { S.zoom = clamp(z, 0.25, 6); layout(); }
  function layout() { if (!S.cur) return; const fit = Math.min(1, (stage.clientWidth - 32) / S.cur.width, (stage.clientHeight - 32) / S.cur.height); S.cur.style.width = Math.round(S.cur.width * fit * S.zoom) + 'px'; S.cur.style.height = 'auto'; }
  const pos = (e) => { const r = S.cur.getBoundingClientRect(); return { x: (e.clientX - r.left) * S.cur.width / r.width, y: (e.clientY - r.top) * S.cur.height / r.height, k: S.cur.width / r.width }; };

  function dot(p, rad) {
    const c = ctx(); c.save(); c.beginPath(); c.arc(p.x, p.y, rad, 0, Math.PI * 2);
    if (S.tool === 'erase') { c.globalCompositeOperation = 'destination-out'; c.fill(); }
    else { c.clip(); c.globalCompositeOperation = 'source-over'; const x0 = Math.floor(p.x - rad), y0 = Math.floor(p.y - rad), q = Math.ceil(rad * 2) + 2; c.clearRect(x0, y0, q, q); c.drawImage(S.orig, x0, y0, q, q, x0, y0, q, q); }
    c.restore();
  }
  function stroke(p) {
    const rad = Math.max(1, S.size * p.k / 2); let a = last || p; const d = Math.hypot(p.x - a.x, p.y - a.y), step = Math.max(1, rad / 3), n = Math.ceil(d / step);
    for (let i = 1; i <= n; i++) dot({ x: a.x + (p.x - a.x) * i / n, y: a.y + (p.y - a.y) * i / n }, rad); last = p;
  }
  function onDown(e) {
    if (!S.cur) return; const p = pos(e);
    if (S.tool === 'pick') {
      const x = clamp(Math.floor(p.x), 0, S.cur.width - 1), y = clamp(Math.floor(p.y), 0, S.cur.height - 1);
      const id = ctx().getImageData(0, 0, S.cur.width, S.cur.height); removeColor(id.data, id.width, id.height, x, y, S.tol, S.feather, S.contiguous); ctx().putImageData(id, 0, 0); push();
    } else { painting = true; last = null; S.cur.setPointerCapture(e.pointerId); stroke(p); }
  }
  // pointer events (up to 240 Hz) only record the newest position; strokes are drawn once per animation frame
  const onMove = (e) => { if (!painting) return; pend = pos(e); if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pend && painting) { stroke(pend); } pend = null; }); };
  const onUp = () => { if (painting) { if (pend) { stroke(pend); pend = null; } painting = false; last = null; push(); } };

  function panelView() {
    const seg = (k, ic, en, ar) => h('button', { class: 'btn sm' + (S.tool === k ? ' on' : ''), 'aria-pressed': S.tool === k, onclick: () => { S.tool = k; S.cur && (S.cur.style.cursor = k === 'pick' ? 'crosshair' : 'cell'); panelRender(); } }, icon(ic), L(en, ar));
    const sl = (label, v, min, max, set) => { const o = h('output', null, String(v)); const i = h('input', { type: 'range', class: 'range', min, max, value: v, 'aria-label': label }); i.addEventListener('input', () => { o.textContent = i.value; set(+i.value); }); return h('div', { class: 'field' }, h('span', { class: 'row between' }, label, o), i); };
    return h('div', null,
      h('div', { class: 'note' }, icon('info'), h('p', null, L('This is a manual background editor, not automatic AI removal. Click a background colour to remove it, then clean up with the brushes.', 'هذه أداة يدوية لتحرير الخلفية وليست إزالة تلقائية بالذكاء الاصطناعي. انقر على لون الخلفية لإزالته ثم نظّف التفاصيل بالفرشاة.'))),
      h('div', { class: 'btn-row' }, seg('pick', 'pipette', 'Pick color', 'اختيار لون'), seg('erase', 'eraser', 'Erase', 'ممحاة'), seg('restore', 'brush', 'Restore', 'استعادة')),
      S.tool === 'pick' ? h('div', null, sl(L('Tolerance', 'التسامح'), S.tol, 0, 200, v => { S.tol = v; }), sl(L('Edge softness', 'نعومة الحواف'), S.feather, 0, 80, v => { S.feather = v; }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S.contiguous, onchange: (e) => { S.contiguous = e.target.checked; } }), L('Only connected area (uncheck to remove this colour everywhere)', 'المنطقة المتصلة فقط (ألغِ التحديد لإزالة هذا اللون في كل مكان)')))
        : sl(L('Brush size', 'حجم الفرشاة'), S.size, 4, 200, v => { S.size = v; }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn sm danger-o', onclick: async () => { if (!S.cur) return; if (await confirmDialog({ title: L('Reset all changes?', 'إعادة ضبط كل التغييرات؟'), message: L('The original photo will be restored.', 'ستتم استعادة الصورة الأصلية.'), confirmText: L('Reset', 'إعادة ضبط'), danger: true })) { ctx().clearRect(0, 0, S.cur.width, S.cur.height); ctx().drawImage(S.orig, 0, 0); push(); } } }, icon('rotate-ccw'), L('Restore original', 'استعادة الأصل'))),
      h('p', { class: 'muted small' }, L('The checkerboard shows transparent areas. Export keeps transparency as a PNG. Nothing leaves your device.', 'تُظهر رقعة الشطرنج المناطق الشفافة. يحتفظ التصدير بالشفافية بصيغة PNG. لا شيء يغادر جهازك.')));
  }
  const panelRender = () => { body.replaceChildren(S.cur ? panelView() : h('div', { class: 'empty small' }, icon('eraser'), h('p', null, L('Open a photo to begin.', 'افتح صورة للبدء.')))); refreshIcons(); };
  async function exportPng() {
    if (!S.cur) return toast(L('Open a photo first.', 'افتح صورة أولاً.'));
    try { const b = await canvasToBlob(S.cur, 'image/png'); downloadBlob(b, S.name + '-transparent.png'); toast(L('Transparent PNG downloaded.', 'تم تنزيل PNG شفاف.'), 'success'); } catch (e) { toast(e.message, 'error'); }
  }
  function build() {
    stage.replaceChildren();
    if (!S.cur) {
      stage.classList.remove('checker');
      stage.append(h('div', { class: 'drop-empty', role: 'button', tabindex: '0', onclick: () => picker.click(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') picker.click(); } }, icon('eraser'), h('h2', null, L('Open a photo to edit its background', 'افتح صورة لتحرير خلفيتها')),
        h('p', null, L('Drag and drop here, or click to choose a file.', 'اسحب وأفلت هنا، أو انقر لاختيار ملف.')), h('p', { class: 'muted small' }, L('Manual tool: colour picking and brushes. No AI, no uploads.', 'أداة يدوية: اختيار الألوان والفرشاة. بدون ذكاء اصطناعي وبدون رفع.'))));
      [undoB, redoB, exportB].forEach(b => { b.disabled = true; });
    } else {
      S.cur.onpointerdown = onDown; S.cur.onpointermove = onMove; S.cur.onpointerup = onUp; S.cur.onpointercancel = onUp;
      stage.classList.add('checker'); S.cur.className = 'rb-canvas'; S.cur.style.cursor = S.tool === 'pick' ? 'crosshair' : 'cell'; stage.append(S.cur); layout(); [exportB].forEach(b => { b.disabled = false; }); sync();
    }
    panelRender();
  }
  const ro = new ResizeObserver(() => { if (!disposed) layout(); }); ro.observe(stage);
  build();
  return () => { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); if (S.cur) { S.cur.onpointerdown = S.cur.onpointermove = S.cur.onpointerup = S.cur.onpointercancel = null; } };
}
