import { L, isAr } from '../core.js';
import { h, icon, refreshIcons, toast, loadLib, validateImage, fileToCanvas, canvasToBlob, downloadBlob, baseName, clamp, formatBytes, dropzone, copyText, uid, confirmDialog } from '../util.js';
import { dominantColors, adjustPixels } from '../pixels.js';
import { makePdf } from '../pdf.js';

const MAX_FILES = 30, MAX_BYTES = 40 * 1024 * 1024;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const NAMES = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP' };

// Target size for a resize setting. Never produces 0 and never exceeds 16000 px.
export function targetSize(w, h, o) {
  let tw = w, th = h;
  if (o.mode === 'percent') { tw = w * o.percent / 100; th = h * o.percent / 100; }
  else if (o.mode === 'max') { const k = Math.min(1, o.max / Math.max(w, h)); tw = w * k; th = h * k; }
  else if (o.mode === 'exact') {
    if (o.keep) { if (o.w && o.h) { const k = Math.min(o.w / w, o.h / h); tw = w * k; th = h * k; } else if (o.w) { tw = o.w; th = h * o.w / w; } else if (o.h) { th = o.h; tw = w * o.h / h; } }
    else { tw = o.w || w; th = o.h || h; }
  }
  return [clamp(Math.round(tw), 1, 16000), clamp(Math.round(th), 1, 16000)];
}

export async function mount(root) {
  const O = { tab: 'compress', format: 'keep', quality: 0.8, mode: 'none', percent: 50, max: 1600, w: 0, h: 0, keep: true, bg: '#ffffff', auto: true, up: '4k', sharp: 30, pdfSize: 'a4', pdfMargin: 10 };
  let items = [], disposed = false, busy = false, sel = null;

  const listEl = h('div', { class: 'tl-list' });
  const optEl = h('div', { class: 'tl-opts' });
  const resEl = h('div', { class: 'tl-detail' });
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
  const bar = h('div', { class: 'btn-row' });
  const TABS = [['compress', 'Compress', 'ضغط', 'file-archive'], ['resize', 'Resize', 'تغيير الحجم', 'scaling'], ['convert', 'Convert', 'تحويل', 'repeat'], ['pdf', 'JPG to PDF', 'صور إلى PDF', 'download'], ['enhance', 'Enhance / 4K', 'تحسين / 4K', 'sparkles'], ['colors', 'Colors', 'الألوان', 'palette'], ['info', 'Info', 'معلومات', 'info']];

  const revoke = (it) => { if (it.out && it.out.url) URL.revokeObjectURL(it.out.url); it.out = null; };

  // ------------------------------------------------------------- loading
  async function addFiles(files) {
    if (busy) return;
    const room = MAX_FILES - items.length;
    if (room <= 0) return toast(L('You can work with up to ' + MAX_FILES + ' images at a time.', 'يمكنك العمل على ' + MAX_FILES + ' صورة كحد أقصى في المرة الواحدة.'), 'error');
    if (files.length > room) toast(L('Only the first ' + room + ' images were added (limit ' + MAX_FILES + ').', 'تمت إضافة أول ' + room + ' صور فقط (الحد ' + MAX_FILES + ').'));
    let bad = 0;
    for (const f of files.slice(0, room)) {
      const v = await validateImage(f, MAX_BYTES);
      if (!v.ok) { toast(v.error, 'error'); bad++; continue; }
      try {
        const c = await fileToCanvas(f, 0);
        items.push({ id: uid(), file: f, type: v.type, name: f.name, size: f.size, w: c.width, h: c.height, modified: f.lastModified, out: null, err: null });
        c.width = c.height = 0; // release pixel memory right away
      } catch (e) { toast('"' + f.name + '": ' + e.message, 'error'); bad++; }
    }
    if (!sel && items.length) sel = items[0].id;
    drawAll();
    if (items.length > 0 && files.length > bad) toast(L('Added ' + (files.length - bad) + ' image(s).', 'تمت إضافة ' + (files.length - bad) + ' صورة.'), 'success');
  }

  // ------------------------------------------------------------- processing
  const outType = (it) => (O.tab === 'convert' || O.format !== 'keep') ? (O.format === 'keep' ? 'image/jpeg' : O.format) : it.type;
  function effective(it) {
    // Which settings apply for each tab.
    const resize = O.tab === 'resize' ? O : { mode: 'none' };
    let type = it.type, q = 0.92;
    if (O.tab === 'compress') { type = O.format === 'keep' ? it.type : O.format; q = O.quality; }
    else if (O.tab === 'convert') { type = O.format === 'keep' ? 'image/webp' : O.format; q = O.quality; }
    else if (O.tab === 'resize') { type = it.type; q = 0.92; }
    return { resize, type, q };
  }
  async function processOne(it) {
    revoke(it); it.err = null;
    const { resize, type, q } = effective(it);
    let src = null, dst = null;
    try {
      src = await fileToCanvas(it.file, 0);
      const [tw, th] = targetSize(src.width, src.height, resize);
      dst = document.createElement('canvas'); dst.width = tw; dst.height = th;
      const x = dst.getContext('2d');
      if (type === 'image/jpeg') { x.fillStyle = O.bg; x.fillRect(0, 0, tw, th); }
      x.imageSmoothingQuality = 'high';
      // Step down for big reductions so the result stays sharp.
      let cur = src;
      while (cur.width / 2 > tw && cur.height / 2 > th) {
        const t = document.createElement('canvas'); t.width = Math.round(cur.width / 2); t.height = Math.round(cur.height / 2);
        const tx = t.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(cur, 0, 0, t.width, t.height);
        if (cur !== src) cur.width = cur.height = 0; cur = t;
      }
      x.drawImage(cur, 0, 0, tw, th);
      if (cur !== src) cur.width = cur.height = 0;
      const blob = await canvasToBlob(dst, type, q);
      if (type !== 'image/png' && blob.type !== type) throw new Error(L('Your browser cannot encode ' + NAMES[type] + '. Choose another format.', 'متصفحك لا يدعم ترميز ' + NAMES[type] + '. اختر صيغة أخرى.'));
      const suffix = O.tab === 'compress' ? '-compressed' : O.tab === 'resize' ? '-resized' : '-converted';
      it.out = { blob, url: URL.createObjectURL(blob), type, w: tw, h: th, filename: baseName(it.name) + suffix + '.' + EXT[type] };
    } catch (e) { it.err = e.message || String(e); }
    finally { if (src) src.width = src.height = 0; if (dst) dst.width = dst.height = 0; }
  }
  async function processAll() {
    if (!items.length) return toast(L('Add some images first.', 'أضف بعض الصور أولاً.'), 'error');
    if (O.tab === 'resize' && O.mode === 'none') return toast(L('Choose how to resize first.', 'اختر طريقة تغيير الحجم أولاً.'), 'error');
    if (O.tab === 'resize' && O.mode === 'exact' && !O.w && !O.h) return toast(L('Enter a width or height.', 'أدخل العرض أو الارتفاع.'), 'error');
    busy = true; drawOpts();
    for (let i = 0; i < items.length && !disposed; i++) {
      items[i].working = true; drawList();
      await (O.tab === 'enhance' ? enhanceOne(items[i]) : processOne(items[i]));
      items[i].working = false; drawList();
    }
    busy = false; if (disposed) return;
    drawOpts(); drawList();
    const done = items.filter(i => i.out).length, fail = items.filter(i => i.err).length;
    if (done) toast(L('Processed ' + done + ' image(s).' + (fail ? ' ' + fail + ' failed.' : ''), 'تمت معالجة ' + done + ' صورة.' + (fail ? ' فشلت ' + fail + '.' : '')), fail ? 'error' : 'success');
    else if (fail) toast(L('No images could be processed.', 'تعذّرت معالجة الصور.'), 'error');
  }
  async function enhanceOne(it) {
    revoke(it); it.err = null; let src = null, cur = null;
    try {
      src = await fileToCanvas(it.file, 0); let tw = src.width, th = src.height;
      if (O.up === '4k') { const k = 3840 / Math.max(tw, th); if (k > 1) { tw = Math.round(tw * k); th = Math.round(th * k); } } else if (O.up === '2x') { tw *= 2; th *= 2; } else if (O.up === '4x') { tw *= 4; th *= 4; }
      if (tw * th > 36e6) throw new Error(L('The result would be too large (max 36 megapixels). Choose a smaller upscale.', 'الناتج كبير جداً (الحد 36 ميغابكسل). اختر تكبيراً أصغر.'));
      cur = src; const upscaled = tw > src.width;
      while (cur.width < tw) { const nw = Math.min(tw, Math.round(cur.width * 1.5)), nh = Math.round(th * nw / tw), t = document.createElement('canvas'); t.width = nw; t.height = nh; const x = t.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, nw, nh); if (cur !== src) cur.width = cur.height = 0; cur = t; }
      const w = cur.width, hh = cur.height, ctx = cur.getContext('2d'), id = ctx.getImageData(0, 0, w, hh), d = id.data, hs = new Uint32Array(256); let n = 0, a = 0, lo = 0, hi = 255;
      for (let i = 0; i < d.length; i += 16) { hs[Math.round(.3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2])]++; n++; }
      for (let i = 0; i < 256; i++) { a += hs[i]; if (a > n * .01) { lo = i; break; } } a = 0; for (let i = 255; i >= 0; i--) { a += hs[i]; if (a > n * .01) { hi = i; break; } }
      const p = { brightness: O.auto ? Math.round(clamp((128 - (lo + hi) / 2) / 2.55 * .7, -30, 30)) : 0, contrast: O.auto ? Math.round(clamp((255 / Math.max(40, hi - lo) - 1) * 70, 0, 60)) : 0, saturation: O.auto ? 12 : 0, exposure: 0, warmth: 0, sharpness: clamp(O.sharp + (upscaled ? 20 : 0), 0, 100) };
      adjustPixels(d, w, hh, p, 'none', 100); ctx.putImageData(id, 0, 0);
      const type = O.format === 'keep' ? 'image/png' : O.format; let out = cur;
      if (type === 'image/jpeg') { out = document.createElement('canvas'); out.width = w; out.height = hh; const x = out.getContext('2d'); x.fillStyle = O.bg; x.fillRect(0, 0, w, hh); x.drawImage(cur, 0, 0); }
      const blob = await canvasToBlob(out, type, O.quality);
      it.out = { blob, url: URL.createObjectURL(blob), type, w, h: hh, filename: baseName(it.name) + '-enhanced.' + EXT[type] };
    } catch (e) { it.err = e.message || String(e); } finally { if (src) src.width = src.height = 0; if (cur && cur !== src) cur.width = cur.height = 0; }
  }
  async function makePdfAll() {
    if (!items.length) return toast(L('Add some images first.', 'أضف بعض الصور أولاً.'), 'error');
    busy = true; drawOpts();
    try {
      const pages = [];
      for (const it of items) {
        const c = await fileToCanvas(it.file, 4000), w = document.createElement('canvas'); w.width = c.width; w.height = c.height; const x = w.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, w.width, w.height); x.drawImage(c, 0, 0);
        const blob = await canvasToBlob(w, 'image/jpeg', 0.92); let pw, ph, iw, ih, px = 0, py = 0;
        if (O.pdfSize === 'fit') { iw = pw = c.width * 25.4 / 150; ih = ph = c.height * 25.4 / 150; }
        else { const [a, b] = O.pdfSize === 'a4' ? [210, 297] : [215.9, 279.4], land = c.width > c.height, m = O.pdfMargin; pw = land ? b : a; ph = land ? a : b; const k = Math.min((pw - 2 * m) / c.width, (ph - 2 * m) / c.height); iw = c.width * k; ih = c.height * k; px = (pw - iw) / 2; py = (ph - ih) / 2; }
        pages.push({ w: pw, h: ph, jpeg: blob, x: px, y: py, iw, ih }); c.width = c.height = 0; w.width = w.height = 0;
      }
      downloadBlob(await makePdf(pages, 'PRINTY'), 'images.pdf'); toast(L('PDF ready (' + pages.length + ' page(s)).', 'ملف PDF جاهز (' + pages.length + ' صفحة).'), 'success');
    } catch (e) { toast(e.message || String(e), 'error'); } finally { busy = false; drawOpts(); }
  }
  async function zipAll() {
    const done = items.filter(i => i.out);
    if (!done.length) return;
    try {
      const JSZip = await loadLib('jszip'), z = new JSZip(), used = new Set();
      for (const it of done) { let n = it.out.filename, k = 1; while (used.has(n)) n = it.out.filename.replace(/(\.[^.]+)$/, '-' + (++k) + '$1'); used.add(n); z.file(n, it.out.blob); }
      downloadBlob(await z.generateAsync({ type: 'blob', compression: 'STORE' }), 'printy-images.zip');
      toast(L('ZIP ready.', 'تم إنشاء ملف ZIP.'), 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  // ------------------------------------------------------------- drawing
  const field = (label, ...c) => h('label', { class: 'field' }, h('span', null, label), ...c);
  function drawList() {
    if (!items.length) { listEl.replaceChildren(h('div', { class: 'empty small' }, icon('images'), h('p', null, L('No images yet. Add some above.', 'لا توجد صور بعد. أضف بعضها أعلاه.')))); return; }
    listEl.replaceChildren(h('ul', { class: 'tl-items' }, items.map(it => {
      const o = it.out, saved = o ? Math.round((1 - o.blob.size / it.size) * 100) : null;
      return h('li', { class: 'tl-item' + (sel === it.id ? ' active' : '') },
        h('button', { class: 'tl-name', onclick: () => { sel = it.id; drawList(); drawDetail(); }, 'aria-pressed': sel === it.id },
          h('strong', { class: 'ellip' }, it.name), h('span', { class: 'muted small' }, NAMES[it.type] + ' · ' + it.w + '×' + it.h + ' · ' + formatBytes(it.size))),
        it.working ? h('span', { class: 'spin sm', role: 'status', 'aria-label': L('Processing', 'جارٍ المعالجة') }) : null,
        it.err ? h('span', { class: 'badge err', title: it.err }, L('Failed', 'فشل')) : null,
        o ? h('span', { class: 'tl-res' }, h('span', { class: 'small' }, formatBytes(o.blob.size)), h('span', { class: 'badge ' + (saved >= 0 ? 'ok' : 'warn') }, saved >= 0 ? '−' + saved + '%' : '+' + Math.abs(saved) + '%'),
          h('a', { class: 'btn icon sm', href: o.url, download: o.filename, 'aria-label': L('Download ', 'تنزيل ') + o.filename, title: L('Download', 'تنزيل') }, icon('download'))) : null,
        h('button', { class: 'btn icon sm', 'aria-label': L('Remove ', 'إزالة ') + it.name, title: L('Remove', 'إزالة'), disabled: busy, onclick: () => { revoke(it); items = items.filter(x => x !== it); if (sel === it.id) sel = items[0]?.id || null; drawAll(); } }, icon('x')));
    })));
    refreshIcons();
  }
  function renderTabs() {
    tabsEl.replaceChildren(...TABS.map(([k, en, ar, ic]) => h('button', { class: 'tab' + (O.tab === k ? ' active' : ''), role: 'tab', 'aria-selected': O.tab === k, onclick: () => { O.tab = k; if (k === 'convert' && O.format === 'keep') O.format = 'image/webp'; if (k === 'compress' && O.format !== 'keep' && O.format === 'image/png') O.format = 'keep'; renderTabs(); drawOpts(); drawDetail(); } }, icon(ic), h('span', null, L(en, ar)))));
    refreshIcons();
  }
  const fmtSel = (withKeep) => {
    const opts = [...(withKeep ? [['keep', L('Same as original', 'نفس الأصل')]] : []), ['image/jpeg', 'JPEG (.jpg)'], ['image/png', 'PNG (.png)'], ['image/webp', 'WebP (.webp)']];
    const s = h('select', { class: 'select', 'aria-label': L('Output format', 'صيغة الناتج') }, opts.map(([v, l]) => h('option', { value: v, selected: v === O.format }, l)));
    s.addEventListener('change', () => { O.format = s.value; drawOpts(); });
    return s;
  };
  const qualityIn = () => {
    const out = h('output', null, Math.round(O.quality * 100) + '%');
    const i = h('input', { type: 'range', class: 'range', min: 10, max: 100, step: 1, value: Math.round(O.quality * 100), 'aria-label': L('Quality', 'الجودة') });
    i.addEventListener('input', () => { O.quality = i.value / 100; out.textContent = i.value + '%'; });
    return h('div', { class: 'field' }, h('span', { class: 'row between' }, L('Quality', 'الجودة'), out), i);
  };
  const numIn = (val, min, max, on, label) => { const i = h('input', { class: 'input', type: 'number', min, max, value: val || '', 'aria-label': label, placeholder: 'auto' }); i.addEventListener('input', () => on(i.value ? clamp(parseInt(i.value) || 0, min, max) : 0)); return i; };
  function drawOpts() {
    const parts = [];
    const lossy = (t) => t === 'image/jpeg' || t === 'image/webp';
    if (O.tab === 'compress') {
      parts.push(field(L('Output format', 'صيغة الناتج'), fmtSel(true)), qualityIn());
      const anyPng = O.format === 'keep' ? items.some(i => i.type === 'image/png') : O.format === 'image/png';
      if (anyPng) parts.push(h('div', { class: 'note' }, icon('info'), h('p', null, L('PNG is lossless, so quality does not apply and savings are small. Choose WebP or JPEG for much smaller files.', 'PNG بلا فقدان فلا تنطبق الجودة والتوفير قليل. اختر WebP أو JPEG لملفات أصغر بكثير.'))));
    } else if (O.tab === 'resize') {
      const modes = [['none', L('Choose…', 'اختر…')], ['percent', L('By percentage', 'بالنسبة المئوية')], ['max', L('Longest side', 'أطول ضلع')], ['exact', L('Exact pixels', 'بكسل محدد')]];
      const ms = h('select', { class: 'select', 'aria-label': L('Resize method', 'طريقة تغيير الحجم') }, modes.map(([v, l]) => h('option', { value: v, selected: v === O.mode }, l)));
      ms.addEventListener('change', () => { O.mode = ms.value; drawOpts(); });
      parts.push(field(L('Method', 'الطريقة'), ms));
      if (O.mode === 'percent') { const out = h('output', null, O.percent + '%'); const i = h('input', { type: 'range', class: 'range', min: 5, max: 200, value: O.percent, 'aria-label': L('Scale', 'النسبة') }); i.addEventListener('input', () => { O.percent = +i.value; out.textContent = i.value + '%'; }); parts.push(h('div', { class: 'field' }, h('span', { class: 'row between' }, L('Scale', 'النسبة'), out), i)); }
      if (O.mode === 'max') parts.push(field(L('Longest side (px)', 'أطول ضلع (بكسل)'), numIn(O.max, 16, 16000, v => { O.max = v || 1600; }, L('Longest side in pixels', 'أطول ضلع بالبكسل'))));
      if (O.mode === 'exact') {
        const lk = h('input', { type: 'checkbox', checked: O.keep }); lk.addEventListener('change', () => { O.keep = lk.checked; });
        parts.push(h('div', { class: 'row' }, field(L('Width', 'العرض'), numIn(O.w, 1, 16000, v => { O.w = v; }, L('Width in pixels', 'العرض بالبكسل'))), field(L('Height', 'الارتفاع'), numIn(O.h, 1, 16000, v => { O.h = v; }, L('Height in pixels', 'الارتفاع بالبكسل')))),
          h('label', { class: 'check' }, lk, L('Maintain aspect ratio (fits inside width × height)', 'الحفاظ على نسبة الأبعاد (ضمن العرض × الارتفاع)')));
      }
      parts.push(h('p', { class: 'muted small' }, L('Images keep their original format.', 'تبقى الصور بصيغتها الأصلية.')));
    } else if (O.tab === 'convert') {
      parts.push(field(L('Convert to', 'تحويل إلى'), fmtSel(false)), h('div', { class: 'btn-row' }, [['image/jpeg', 'PNG → JPG'], ['image/png', 'JPG → PNG']].map(([v, l]) => h('button', { class: 'btn sm' + (O.format === v ? ' on' : ''), onclick: () => { O.format = v; drawOpts(); } }, l))));
      if (lossy(O.format)) parts.push(qualityIn());
      if (O.format === 'image/jpeg') { const c = h('input', { type: 'color', class: 'color', value: O.bg, 'aria-label': L('Background for transparent areas', 'خلفية المناطق الشفافة') }); c.addEventListener('input', () => { O.bg = c.value; }); parts.push(field(L('Background for transparency', 'خلفية الشفافية'), c)); }
    }
    if (O.tab === 'pdf') {
      const ps = h('select', { class: 'select', 'aria-label': L('Page size', 'حجم الصفحة') }, [['a4', 'A4'], ['letter', 'Letter'], ['fit', L('Same size as image', 'نفس حجم الصورة')]].map(([v, l]) => h('option', { value: v, selected: v === O.pdfSize }, l))); ps.addEventListener('change', () => { O.pdfSize = ps.value; });
      const mi = h('input', { class: 'input', type: 'number', min: 0, max: 50, value: O.pdfMargin, 'aria-label': L('Margin (mm)', 'الهامش (مم)') }); mi.addEventListener('input', () => { O.pdfMargin = clamp(parseFloat(mi.value) || 0, 0, 50); });
      parts.push(field(L('Page size', 'حجم الصفحة'), ps), field(L('Margin (mm)', 'الهامش (مم)'), mi), h('p', { class: 'muted small' }, L('Each image becomes one page, in the order shown. JPG, PNG and WebP all work.', 'تصبح كل صورة صفحة واحدة بالترتيب الظاهر. تعمل صيغ JPG وPNG وWebP.')),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', disabled: busy || !items.length, onclick: makePdfAll }, busy ? h('span', { class: 'spin sm' }) : icon('download'), L('Create PDF', 'إنشاء PDF'))));
    }
    if (O.tab === 'enhance') {
      const chk = h('input', { type: 'checkbox', checked: O.auto }); chk.addEventListener('change', () => { O.auto = chk.checked; });
      const us = h('select', { class: 'select', 'aria-label': L('Upscale', 'التكبير') }, [['none', L('Original size', 'الحجم الأصلي')], ['2x', '2×'], ['4k', L('4K (3840 px longest side)', '4K (3840 بكسل للضلع الأطول)')], ['4x', '4×']].map(([v, l]) => h('option', { value: v, selected: v === O.up }, l))); us.addEventListener('change', () => { O.up = us.value; });
      const sv = h('output', null, String(O.sharp)), si = h('input', { type: 'range', class: 'range', min: 0, max: 100, value: O.sharp, 'aria-label': L('Detail', 'التفاصيل') }); si.addEventListener('input', () => { O.sharp = +si.value; sv.textContent = si.value; });
      parts.push(h('label', { class: 'check' }, chk, L('Auto enhance (light, contrast, color)', 'تحسين تلقائي (الإضاءة والتباين واللون)')), field(L('Upscale', 'التكبير'), us), h('div', { class: 'field' }, h('span', { class: 'row between' }, L('Detail / sharpen', 'التفاصيل / الحدة'), sv), si), field(L('Output format', 'صيغة الإخراج'), fmtSel(false)));
      if (lossy(O.format)) parts.push(qualityIn());
      parts.push(h('div', { class: 'note' }, icon('info'), h('p', null, L('Upscaling enlarges smoothly and sharpens, but it cannot invent detail that was never in the photo.', 'التكبير يضخّم الصورة بنعومة ويزيد الحدة، لكنه لا يستطيع ابتكار تفاصيل غير موجودة في الصورة.'))));
    }
    if (['compress', 'resize', 'convert', 'enhance'].includes(O.tab)) {
      const needBg = O.tab === 'compress' && (O.format === 'image/jpeg');
      if (needBg) { const c = h('input', { type: 'color', class: 'color', value: O.bg, 'aria-label': L('Background for transparent areas', 'خلفية المناطق الشفافة') }); c.addEventListener('input', () => { O.bg = c.value; }); parts.push(field(L('Background for transparency', 'خلفية الشفافية'), c)); }
      const done = items.filter(i => i.out).length;
      parts.push(h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', disabled: busy || !items.length, onclick: processAll }, busy ? h('span', { class: 'spin sm' }) : icon('play'), busy ? L('Processing…', 'جارٍ المعالجة…') : L('Process ' + items.length + ' image(s)', 'معالجة ' + items.length + ' صورة')),
        done > 1 ? h('button', { class: 'btn', onclick: zipAll }, icon('folder-archive'), L('Download all (ZIP)', 'تنزيل الكل (ZIP)')) : null));
    }
    optEl.replaceChildren(...parts); refreshIcons();
  }
  async function drawDetail() {
    const it = items.find(i => i.id === sel);
    resEl.replaceChildren();
    if (!it) { if (O.tab === 'colors' || O.tab === 'info') resEl.append(h('div', { class: 'empty small' }, icon('image'), h('p', null, L('Add an image to see details.', 'أضف صورة لعرض التفاصيل.')))); return; }
    if (O.tab === 'info') {
      const g = (a, b) => { while (b) [a, b] = [b, a % b]; return a; }, d = g(it.w, it.h);
      const rows = [[L('File name', 'اسم الملف'), it.name], [L('Format', 'الصيغة'), NAMES[it.type] + ' (' + it.type + ')'], [L('Dimensions', 'الأبعاد'), it.w + ' × ' + it.h + ' px'], [L('Megapixels', 'ميغابكسل'), (it.w * it.h / 1e6).toFixed(2) + ' MP'],
        [L('Aspect ratio', 'نسبة الأبعاد'), (it.w / d) + ':' + (it.h / d) + ' (' + (it.w / it.h).toFixed(3) + ')'], [L('File size', 'حجم الملف'), formatBytes(it.size) + ' (' + it.size.toLocaleString() + ' bytes)'],
        [L('Last modified', 'آخر تعديل'), it.modified ? new Date(it.modified).toLocaleString() : '—'], [L('Print size at 300 dpi', 'مقاس الطباعة عند 300'), (it.w / 300 * 25.4).toFixed(0) + ' × ' + (it.h / 300 * 25.4).toFixed(0) + ' mm']];
      resEl.append(h('dl', { class: 'info-dl' }, rows.map(([a, b]) => [h('dt', null, a), h('dd', null, b)])));
    } else if (O.tab === 'colors') {
      resEl.append(h('div', { class: 'loading' }, h('div', { class: 'spin' }), h('span', null, L('Analysing…', 'جارٍ التحليل…'))));
      let c;
      try { c = await fileToCanvas(it.file, 200); } catch (e) { resEl.replaceChildren(h('div', { class: 'note warn' }, e.message)); return; }
      if (disposed || sel !== it.id || O.tab !== 'colors') return;
      const cols = dominantColors(c.getContext('2d').getImageData(0, 0, c.width, c.height).data, 8); c.width = c.height = 0;
      if (!cols.length) return resEl.replaceChildren(h('p', { class: 'muted' }, L('No opaque pixels to analyse.', 'لا توجد بكسلات معتمة للتحليل.')));
      resEl.replaceChildren(h('div', { class: 'swatches' }, cols.map(k => {
        const rgb = 'rgb(' + k.r + ', ' + k.g + ', ' + k.b + ')', dark = (k.r * 299 + k.g * 587 + k.b * 114) / 1000 < 140;
        return h('div', { class: 'swatch' }, h('div', { class: 'swatch-c' + (dark ? ' dk' : ''), style: { background: k.hex } }, k.pct + '%'),
          h('button', { class: 'btn sm', onclick: () => copyText(k.hex), 'aria-label': L('Copy ', 'نسخ ') + k.hex }, icon('copy'), k.hex),
          h('button', { class: 'btn sm', onclick: () => copyText(rgb), 'aria-label': L('Copy ', 'نسخ ') + rgb }, icon('copy'), rgb));
      })));
      refreshIcons();
    } else {
      const it2 = it;
      if (it2.out) resEl.append(h('div', { class: 'tl-preview' }, h('img', { src: it2.out.url, alt: L('Processed preview of ', 'معاينة بعد المعالجة: ') + it2.name }),
        h('p', { class: 'muted small' }, it2.out.w + ' × ' + it2.out.h + ' px · ' + NAMES[it2.out.type] + ' · ' + formatBytes(it2.out.blob.size) + ' ← ' + formatBytes(it2.size))));
      else resEl.append(h('p', { class: 'muted small' }, L('Process the images to see a preview and the new file size.', 'عالج الصور لعرض المعاينة والحجم الجديد.')));
    }
  }
  function drawAll() { drawList(); drawOpts(); drawDetail(); }

  const dz = h('div', { class: 'drop-empty', tabindex: '0', role: 'button', 'aria-label': L('Add images', 'إضافة صور') }, icon('upload'), h('strong', null, L('Drop images here or click to browse', 'أفلت الصور هنا أو انقر للاستعراض')), h('span', { class: 'muted small' }, L('JPG, PNG or WebP · up to ' + MAX_FILES + ' files · max ' + formatBytes(MAX_BYTES) + ' each', 'JPG أو PNG أو WebP · حتى ' + MAX_FILES + ' ملفاً · الحد ' + formatBytes(MAX_BYTES) + ' للملف')));
  dropzone(dz, addFiles, { multiple: true });
  const clearBtn = h('button', { class: 'btn sm danger-o', onclick: async () => { if (!items.length || busy) return; if (await confirmDialog({ title: L('Remove all images?', 'إزالة كل الصور؟'), message: L('This clears the list. Your original files are untouched.', 'سيُفرغ هذا القائمة. ملفاتك الأصلية لا تتأثر.'), confirmText: L('Remove all', 'إزالة الكل'), danger: true })) { items.forEach(revoke); items = []; sel = null; drawAll(); } } }, icon('trash-2'), L('Clear list', 'مسح القائمة'));

  root.append(h('div', { class: 'page' },
    h('h1', null, L('Image Tools', 'أدوات الصور')),
    h('p', { class: 'muted' }, L('Compress, resize and convert images in batches, inspect them and pull out their colours. Processing happens in your browser — nothing is uploaded.', 'اضغط الصور وغيّر حجمها وحوّلها دفعةً واحدة، واستعرض معلوماتها واستخرج ألوانها. تتم المعالجة في متصفحك — لا يُرفع شيء.')),
    dz,
    h('div', { class: 'tl' },
      h('section', { class: 'card tl-col', 'aria-label': L('Images', 'الصور') }, h('div', { class: 'row between' }, h('h3', null, L('Images', 'الصور')), clearBtn), listEl),
      h('section', { class: 'card tl-col', 'aria-label': L('Tool', 'الأداة') }, tabsEl, optEl, resEl))));
  renderTabs(); drawAll();
  return () => { disposed = true; items.forEach(revoke); items = []; };
}
