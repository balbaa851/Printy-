import { L, isAr } from '../core.js';
import { h, icon, refreshIcons, toast, loadLib, validateImage, fileToCanvas, canvasToBlob, downloadBlob, baseName, safeName, clamp, dropzone, spinner } from '../util.js';
import * as db from '../db.js';
import { makePdf } from '../pdf.js';

const PAPERS = { A4: [210, 297], A3: [297, 420], A5: [148, 210], Letter: [215.9, 279.4] };
const MAX_PIXELS = 100e6, MAX_SIDE = 16000;
const FIT = [['fit', 'Fit inside margins', 'ملاءمة داخل الهوامش'], ['fill', 'Fill (crop overflow)', 'تعبئة (قص الزائد)'], ['stretch', 'Stretch', 'تمديد']];

// Compute geometry (mm) of the sheet and the content box for the given settings.
export function sheetGeometry(s) {
  let [pw, ph] = s.paper === 'custom' ? [s.cw, s.ch] : PAPERS[s.paper];
  if (s.orient === 'landscape' ? pw < ph : pw > ph) [pw, ph] = [ph, pw];
  const b = s.bleed, m = s.margin;
  const total = { w: pw + 2 * b, h: ph + 2 * b };
  // Where margin is 0 the content bleeds off the trim edge; otherwise it sits inside the margin.
  const e = m > 0 ? b + m : 0;
  const box = { x: e, y: e, w: total.w - 2 * e, h: total.h - 2 * e };
  return { pw, ph, b, m, total, box };
}
const px = (mm, dpi) => Math.round(mm / 25.4 * dpi);

// Place a source of size sw×sh (px) in a box (mm); returns {x,y,w,h,clip} in mm.
export function placeImage(sw, sh, box, mode) {
  if (mode === 'stretch') return { x: box.x, y: box.y, w: box.w, h: box.h };
  const k = mode === 'fill' ? Math.max(box.w / sw, box.h / sh) : Math.min(box.w / sw, box.h / sh);
  const w = sw * k, hh = sh * k;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - hh) / 2, w, h: hh };
}

export async function mount(root, params) {
  const S = { paper: 'A4', orient: 'portrait', cw: 210, ch: 297, margin: 10, bleed: 0, fit: 'fit', dpi: 300, bg: '#ffffff', src: null };
  let disposed = false, urlsToFree = [], rafId = 0;

  const preview = h('canvas', { class: 'pr-canvas', role: 'img', 'aria-label': L('Print preview', 'معاينة الطباعة') });
  const stageEl = h('div', { class: 'pr-stage' }, preview);
  const infoEl = h('div', { class: 'pr-info', 'aria-live': 'polite' });
  const warnEl = h('div', { class: 'pr-warn' });
  const panel = h('aside', { class: 'st-panel pr-panel' });
  const body = h('div', { class: 'panel-body' });
  panel.append(body);

  const field = (label, ...c) => h('label', { class: 'field' }, h('span', null, label), ...c);
  const sel = (opts, val, on, label) => { const e = h('select', { class: 'select', 'aria-label': label }, opts.map(([v, l]) => h('option', { value: v, selected: v === String(val) }, l))); e.addEventListener('change', () => on(e.value)); return e; };
  const num = (val, min, max, step, on, label) => { const e = h('input', { class: 'input', type: 'number', min, max, step, value: val, 'aria-label': label }); e.addEventListener('input', () => { const v = parseFloat(e.value); if (isFinite(v)) on(clamp(v, min, max)); }); return e; };

  // ---------------------------------------------------------------- sources
  async function loadImageFile(file) {
    const v = await validateImage(file);
    if (!v.ok) return toast(v.error, 'error');
    body.classList.add('busy');
    try {
      const c = await fileToCanvas(file, 0);
      S.src = { kind: 'image', name: baseName(file.name), canvas: c, w: c.width, h: c.height, minDpiK: null };
      projSel.value = '';
      toast(L('Image loaded.', 'تم تحميل الصورة.'), 'success');
      update();
    } catch (e) { toast(e.message, 'error'); } finally { body.classList.remove('busy'); }
  }
  async function loadProject(id) {
    if (!id) return;
    body.classList.add('busy');
    try {
      const p = await db.getProject(id);
      if (!p || !p.json) { toast(L('That project has no saved content yet. Open it in the Design Studio and save it first.', 'هذا المشروع لا يحتوي على محتوى محفوظ. افتحه في استوديو التصميم واحفظه أولاً.'), 'error'); projSel.value = ''; return; }
      const fabric = await loadLib('fabric');
      const sc = new fabric.StaticCanvas(null, { width: p.w, height: p.h, enableRetinaScaling: false });
      await new Promise((res) => sc.loadFromJSON(p.json, res));
      if (p.json.background) sc.setBackgroundColor(p.json.background, () => {});
      try { await Promise.all([...new Set(sc.getObjects().filter(o => o.fontFamily).map(o => o.fontFamily))].map(f => document.fonts.load('16px "' + f + '"'))); } catch { /* fonts optional */ }
      sc.renderAll();
      // lowest image resolution: dpi = 25.4 / (displayed mm per source pixel); mm-per-px depends on final placement, so keep the min scale factor
      let maxScale = 0;
      sc.getObjects().forEach(o => { if (o.type === 'image') maxScale = Math.max(maxScale, Math.abs(o.scaleX || 1), Math.abs(o.scaleY || 1)); });
      S.src = { kind: 'project', name: safeName(p.name), sc, fabric, w: p.w, h: p.h, bgFill: p.json.background || '#ffffff', maxImgScale: maxScale || null, cache: null };
      S.paper = S.paper; update();
      toast(L('Project loaded.', 'تم تحميل المشروع.'), 'success');
    } catch (e) { console.error(e); toast(e.message || L('Could not load the project.', 'تعذّر تحميل المشروع.'), 'error'); }
    finally { body.classList.remove('busy'); }
  }
  // Raster of the source at least `needPx` wide (project is re-rendered from vectors for sharpness).
  function sourceCanvas(needPx) {
    const s = S.src;
    if (s.kind === 'image') return s.canvas;
    const m = clamp(needPx / s.w, 1, 8);
    const mult = Math.round(m * 100) / 100;
    if (s.cache && s.cache.mult >= mult) return s.cache.canvas;
    if (Math.round(s.w * mult) * Math.round(s.h * mult) > MAX_PIXELS) throw new Error(L('This output is too large for your browser. Choose a lower resolution.', 'الناتج كبير جداً لمتصفحك. اختر دقة أقل.'));
    const el = s.sc.toCanvasElement ? s.sc.toCanvasElement(mult) : null;
    s.cache = { mult, canvas: el };
    return el;
  }

  // ---------------------------------------------------------------- drawing
  function drawSheet(dpi, preview_ = false) {
    const g = sheetGeometry(S);
    const W = px(g.total.w, dpi), H = px(g.total.h, dpi);
    if (W > MAX_SIDE || H > MAX_SIDE || W * H > MAX_PIXELS) throw new Error(L('This output is too large for your browser. Choose a lower resolution or smaller paper.', 'الناتج كبير جداً لمتصفحك. اختر دقة أقل أو ورقاً أصغر.'));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = S.bg; x.fillRect(0, 0, W, H);
    if (S.src) {
      const pl = placeImage(S.src.w, S.src.h, g.box, S.fit);
      const need = Math.ceil(pl.w / 25.4 * dpi);
      const src = sourceCanvas(preview_ ? Math.min(need, 1600) : need);
      x.save(); x.beginPath(); x.rect(px(g.box.x, dpi), px(g.box.y, dpi), px(g.box.w, dpi), px(g.box.h, dpi)); x.clip();
      x.imageSmoothingQuality = 'high';
      x.drawImage(src, px(pl.x, dpi), px(pl.y, dpi), px(pl.w, dpi), px(pl.h, dpi));
      x.restore();
    }
    return c;
  }
  function effectiveDpi() {
    const s = S.src; if (!s) return null;
    const g = sheetGeometry(S), pl = placeImage(s.w, s.h, g.box, S.fit);
    const mmPerPx = pl.w / s.w;
    if (s.kind === 'image') return 25.4 / mmPerPx;
    return s.maxImgScale ? 25.4 / (s.maxImgScale * mmPerPx) : null; // lowest-resolution embedded photo
  }
  function drawPreview() {
    const g = sheetGeometry(S);
    const avail = stageEl.clientWidth - 32, availH = stageEl.clientHeight - 32;
    const k = Math.max(0.1, Math.min(avail / g.total.w, availH / g.total.h, 3));
    const ratio = Math.min(devicePixelRatio || 1, 2);
    preview.style.width = g.total.w * k + 'px'; preview.style.height = g.total.h * k + 'px';
    const W = Math.round(g.total.w * k * ratio), H = Math.round(g.total.h * k * ratio);
    preview.width = W; preview.height = H;
    const x = preview.getContext('2d'), pxmm = W / g.total.w;
    x.fillStyle = S.bg; x.fillRect(0, 0, W, H);
    if (S.src) {
      try {
        const pl = placeImage(S.src.w, S.src.h, g.box, S.fit);
        const src = sourceCanvas(Math.min(Math.ceil(pl.w * pxmm), 1600));
        x.save(); x.beginPath(); x.rect(g.box.x * pxmm, g.box.y * pxmm, g.box.w * pxmm, g.box.h * pxmm); x.clip();
        x.imageSmoothingQuality = 'high'; x.drawImage(src, pl.x * pxmm, pl.y * pxmm, pl.w * pxmm, pl.h * pxmm); x.restore();
      } catch (e) { console.error(e); }
    }
    // guides: bleed (red), trim (dark), margin (violet)
    x.lineWidth = Math.max(1, ratio); x.setLineDash([6 * ratio, 4 * ratio]);
    if (g.b > 0) { x.fillStyle = 'rgba(239,68,68,.12)'; x.fillRect(0, 0, W, g.b * pxmm); x.fillRect(0, H - g.b * pxmm, W, g.b * pxmm); x.fillRect(0, g.b * pxmm, g.b * pxmm, H - 2 * g.b * pxmm); x.fillRect(W - g.b * pxmm, g.b * pxmm, g.b * pxmm, H - 2 * g.b * pxmm); x.strokeStyle = '#ef4444'; x.strokeRect(g.b * pxmm, g.b * pxmm, g.pw * pxmm, g.ph * pxmm); }
    if (g.m > 0) { x.strokeStyle = '#7c3aed'; x.strokeRect((g.b + g.m) * pxmm, (g.b + g.m) * pxmm, (g.pw - 2 * g.m) * pxmm, (g.ph - 2 * g.m) * pxmm); }
    x.setLineDash([]);
  }

  // ---------------------------------------------------------------- info + warnings
  function renderInfo() {
    const g = sheetGeometry(S), r1 = (v) => (Math.round(v * 10) / 10);
    const wpx = px(g.total.w, S.dpi), hpx = px(g.total.h, S.dpi);
    const rows = [
      [L('Trim size', 'مقاس القص'), r1(g.pw) + ' × ' + r1(g.ph) + ' mm'],
      [L('With bleed', 'مع الزيادة'), r1(g.total.w) + ' × ' + r1(g.total.h) + ' mm'],
      [L('Output at ', 'الناتج عند ') + S.dpi + ' dpi', wpx + ' × ' + hpx + ' px (' + (wpx * hpx / 1e6).toFixed(1) + ' MP)'],
      [L('Printable area', 'منطقة الطباعة'), r1(g.box.w) + ' × ' + r1(g.box.h) + ' mm']
    ];
    if (S.src) rows.push([L('Source', 'المصدر'), S.src.w + ' × ' + S.src.h + ' px']);
    const d = effectiveDpi();
    if (d) rows.push([L('Effective resolution', 'الدقة الفعلية'), Math.round(d) + ' dpi']);
    infoEl.replaceChildren(h('dl', null, rows.map(([a, b]) => [h('dt', null, a), h('dd', null, b)])));
    warnEl.replaceChildren();
    if (!S.src) return;
    const what = S.src.kind === 'project' ? L('The lowest-resolution photo in this design', 'أقل صورة دقةً في هذا التصميم') : L('This image', 'هذه الصورة');
    if (d && d < 150) warnEl.append(h('div', { class: 'note warn', role: 'alert' }, icon('triangle-alert'), h('p', null, what + L(' will print at only ' + Math.round(d) + ' dpi on this paper, so it may look blurry or pixelated. Use a larger source image, a smaller paper size, or a smaller design scale.', ' ستُطبع بدقة ' + Math.round(d) + ' نقطة/بوصة فقط على هذا الورق، وقد تبدو ضبابية أو منقّطة. استخدم صورة أكبر أو ورقاً أصغر.'))));
    else if (d && d < 300) warnEl.append(h('div', { class: 'note', role: 'status' }, icon('info'), h('p', null, what + L(' will print at ' + Math.round(d) + ' dpi. That is fine for most home and office printing; professional print usually wants 300 dpi.', ' ستُطبع بدقة ' + Math.round(d) + ' نقطة/بوصة. مناسبة للطباعة المنزلية والمكتبية، والطباعة الاحترافية تفضّل 300.'))));
    else if (d) warnEl.append(h('div', { class: 'note ok', role: 'status' }, icon('circle-check'), h('p', null, L('Resolution is good for print (' + Math.round(d) + ' dpi).', 'الدقة مناسبة للطباعة (' + Math.round(d) + ' نقطة/بوصة).'))));
  }
  function update() { if (disposed) return; cancelAnimationFrame(rafId); rafId = requestAnimationFrame(() => { renderInfo(); drawPreview(); refreshIcons(); }); }

  // ---------------------------------------------------------------- actions
  async function run(btn, label, fn) {
    if (!S.src) return toast(L('Choose an image or a project first.', 'اختر صورة أو مشروعاً أولاً.'), 'error');
    btn.disabled = true; const old = btn.innerHTML; btn.replaceChildren(h('span', { class: 'spin sm' }), L('Working…', 'جارٍ العمل…'));
    await new Promise(r => setTimeout(r, 30));
    try { await fn(); } catch (e) { console.error(e); toast(e.message || L('Export failed.', 'فشل التصدير.'), 'error'); }
    finally { btn.disabled = false; btn.innerHTML = old; }
  }
  const name = () => safeName(S.src.name) + '-' + S.paper + (S.paper === 'custom' ? '' : '-' + S.orient);
  const pdfBtn = h('button', { class: 'btn primary', onclick: () => run(pdfBtn, '', async () => {
    const g = sheetGeometry(S), c = drawSheet(S.dpi);
    const blob = await canvasToBlob(c, 'image/jpeg', 0.95);
    downloadBlob(await makePdf([{ w: g.total.w, h: g.total.h, jpeg: blob, x: 0, y: 0 }], S.src.name), name() + '.pdf');
    toast(L('PDF ready: ' + Math.round(g.total.w * 10) / 10 + ' × ' + Math.round(g.total.h * 10) / 10 + ' mm.', 'تم إنشاء PDF: ' + Math.round(g.total.w * 10) / 10 + ' × ' + Math.round(g.total.h * 10) / 10 + ' مم.'), 'success');
  }) }, icon('file-down'), L('Download PDF', 'تنزيل PDF'));
  const pngBtn = h('button', { class: 'btn', onclick: () => run(pngBtn, '', async () => { downloadBlob(await canvasToBlob(drawSheet(S.dpi), 'image/png'), name() + '.png'); toast(L('PNG ready.', 'تم إنشاء PNG.'), 'success'); }) }, icon('image-down'), 'PNG');
  const jpgBtn = h('button', { class: 'btn', onclick: () => run(jpgBtn, '', async () => { downloadBlob(await canvasToBlob(drawSheet(S.dpi), 'image/jpeg', 0.95), name() + '.jpg'); toast(L('JPG ready.', 'تم إنشاء JPG.'), 'success'); }) }, icon('image-down'), 'JPG');
  const printBtn = h('button', { class: 'btn', onclick: () => run(printBtn, '', async () => {
    const g = sheetGeometry(S), dpi = Math.min(S.dpi, 200);
    const blob = await canvasToBlob(drawSheet(dpi), 'image/jpeg', 0.92), url = URL.createObjectURL(blob);
    urlsToFree.push(url);
    const sheet = h('div', { id: 'print-sheet' }, h('img', { src: url, alt: '', style: { width: g.total.w + 'mm', height: g.total.h + 'mm' } }));
    const style = h('style', { id: 'print-page-style' }, '@page{size:' + g.total.w.toFixed(2) + 'mm ' + g.total.h.toFixed(2) + 'mm;margin:0}');
    document.body.append(sheet); document.head.append(style); document.body.classList.add('printing');
    await sheet.querySelector('img').decode().catch(() => {});
    const clean = () => { sheet.remove(); style.remove(); document.body.classList.remove('printing'); URL.revokeObjectURL(url); urlsToFree = urlsToFree.filter(u => u !== url); window.removeEventListener('afterprint', clean); };
    window.addEventListener('afterprint', clean);
    window.print();
    setTimeout(() => { if (document.body.classList.contains('printing') && !document.hasFocus()) return; }, 0);
  }) }, icon('printer'), L('Print…', 'طباعة…'));
  const actions = h('div', { class: 'btn-row' }, pdfBtn, pngBtn, jpgBtn, printBtn);

  // ---------------------------------------------------------------- panel
  const projSel = h('select', { class: 'select', 'aria-label': L('Saved project', 'مشروع محفوظ') }, h('option', { value: '' }, L('Choose a saved project…', 'اختر مشروعاً محفوظاً…')));
  projSel.addEventListener('change', () => loadProject(projSel.value));
  let projects = []; try { projects = (await db.listProjects()).filter(p => p.json); } catch { /* none */ }
  projects.forEach(p => projSel.append(h('option', { value: p.id }, p.name)));
  const drop = h('div', { class: 'drop-empty small', tabindex: '0', role: 'button', 'aria-label': L('Choose an image to print', 'اختر صورة للطباعة') }, icon('image-plus'), h('strong', null, L('Drop an image or click to browse', 'أفلت صورة أو انقر للاستعراض')), h('span', { class: 'muted small' }, 'JPG, PNG, WebP'));
  dropzone(drop, (f) => loadImageFile(f[0]));

  const customRow = h('div', { class: 'row' });
  const paperSel = sel([...Object.keys(PAPERS).map(k => [k, k]), ['custom', L('Custom', 'مخصص')]], S.paper, v => { S.paper = v; syncCustom(); update(); }, L('Paper size', 'مقاس الورق'));
  function syncCustom() { customRow.hidden = S.paper !== 'custom'; orientSel.disabled = false; }
  customRow.append(field(L('Width (mm)', 'العرض (مم)'), num(S.cw, 20, 2000, 1, v => { S.cw = v; update(); }, L('Custom width in millimetres', 'العرض بالمليمتر'))), field(L('Height (mm)', 'الارتفاع (مم)'), num(S.ch, 20, 2000, 1, v => { S.ch = v; update(); }, L('Custom height in millimetres', 'الارتفاع بالمليمتر'))));
  const orientSel = sel([['portrait', L('Portrait', 'طولي')], ['landscape', L('Landscape', 'عرضي')]], S.orient, v => { S.orient = v; update(); }, L('Orientation', 'الاتجاه'));
  const bgIn = h('input', { type: 'color', class: 'color', value: S.bg, 'aria-label': L('Paper background', 'خلفية الورقة') }); bgIn.addEventListener('input', () => { S.bg = bgIn.value; update(); });

  body.append(
    h('div', { class: 'sec' }, h('h4', null, L('Source', 'المصدر')), drop, h('p', { class: 'muted small center' }, L('or', 'أو')), projSel,
      projects.length ? null : h('p', { class: 'muted small' }, L('No saved designs yet. Create one in the Design Studio and it will appear here.', 'لا توجد تصاميم محفوظة بعد. أنشئ تصميماً في استوديو التصميم وسيظهر هنا.'))),
    h('div', { class: 'sec' }, h('h4', null, L('Paper', 'الورق')), field(L('Size', 'المقاس'), paperSel), customRow, field(L('Orientation', 'الاتجاه'), orientSel)),
    h('div', { class: 'sec' }, h('h4', null, L('Layout', 'التخطيط')),
      h('div', { class: 'row' }, field(L('Margin (mm)', 'الهامش (مم)'), num(S.margin, 0, 100, 1, v => { S.margin = v; update(); }, L('Margin in millimetres', 'الهامش بالمليمتر'))), field(L('Bleed (mm)', 'زيادة القص (مم)'), num(S.bleed, 0, 20, 0.5, v => { S.bleed = v; update(); }, L('Bleed in millimetres', 'زيادة القص بالمليمتر')))),
      field(L('Image fit', 'ملاءمة الصورة'), sel(FIT.map(([v, en, ar]) => [v, L(en, ar)]), S.fit, v => { S.fit = v; update(); }, L('Image fit', 'ملاءمة الصورة'))),
      field(L('Paper colour', 'لون الورقة'), bgIn),
      h('p', { class: 'muted small' }, L('Bleed adds extra area around the trim size for professional printing. With a margin of 0 the image extends into the bleed.', 'تضيف زيادة القص مساحة حول مقاس القص للطباعة الاحترافية. عند هامش 0 تمتد الصورة إلى منطقة الزيادة.'))),
    h('div', { class: 'sec' }, h('h4', null, L('Output quality', 'جودة الناتج')), field(L('Resolution', 'الدقة'), sel([['150', '150 dpi (draft)'], ['300', '300 dpi (print)'], ['600', '600 dpi (very large files)']], S.dpi, v => { S.dpi = +v; update(); }, L('Resolution in dpi', 'الدقة بالنقطة/بوصة')))),
    warnEl, infoEl,
    h('div', { class: 'sec' }, actions),
    h('p', { class: 'muted small' }, L('Everything is generated on your device. Nothing is uploaded.', 'يتم إنشاء كل شيء على جهازك. لا يُرفع أي شيء.')));
  syncCustom();

  root.append(h('div', { class: 'studio print' },
    h('div', { class: 'st-top' }, h('strong', null, L('Print Center', 'مركز الطباعة')), h('span', { class: 'sep' }), h('span', { class: 'muted small' }, L('Preview, prepare and print', 'معاينة وتجهيز وطباعة'))),
    h('div', { class: 'st-body' }, stageEl, panel)));
  const ro = new ResizeObserver(() => update()); ro.observe(stageEl);
  const pid = params && params.get('project'); if (pid) { projSel.value = pid; loadProject(pid); } else update();
  refreshIcons();
  return () => { disposed = true; ro.disconnect(); cancelAnimationFrame(rafId); urlsToFree.forEach(u => URL.revokeObjectURL(u)); document.getElementById('print-sheet')?.remove(); document.getElementById('print-page-style')?.remove(); document.body.classList.remove('printing'); if (S.src && S.src.sc) { try { S.src.sc.dispose(); } catch { /* ignore */ } } };
}
