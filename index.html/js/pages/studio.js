import { settings, guard, hooks, L, isAr } from '../core.js';
import { h, icon, refreshIcons, toast, confirmDialog, promptDialog, modal, popMenu, loadLib, spinner, validateImage, fileToCanvas, canvasToBlob, downloadBlob, safeName, uid, debounce, clamp, $, $$ } from '../util.js';
import * as db from '../db.js';
import { createPaint } from './studio-paint.js';
import { makePdf } from '../pdf.js';
import { getTemplate, TEMPLATES, elText, elFont, tplTitle } from '../templates-data.js';

const PROPS = ['isPaint', 'name', 'locked', 'selectable', 'evented', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'direction'];
const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Lobster', 'Roboto Mono', 'Cairo', 'Tajawal', 'Amiri', 'Reem Kufi', 'Arial', 'Georgia'];
const PRESETS = [['A4', 794, 1123], ['A3', 1123, 1587], ['A5', 559, 794], ['Square post', 1080, 1080, 'منشور مربع'], ['Instagram story', 1080, 1920, 'ستوري إنستغرام'], ['Presentation', 1920, 1080, 'عرض تقديمي']];
const VIOLET = '#7c3aed', INK = '#111827';
const MAX_DIM = 8000;

export async function mount(root, params) {
  const id = params.get('id'), tplId = params.get('tpl');
  if (id) {
    const p = await db.getProject(id);
    if (p) { await db.touchOpened(p); return startEditor(root, p); }
    toast(L('That project could not be found.', 'تعذّر العثور على هذا المشروع.'), 'error');
    return chooser(root);
  }
  if (tplId) {
    const t = getTemplate(tplId);
    if (!t) { toast(L('Template not found.', 'القالب غير موجود.'), 'error'); return chooser(root); }
    const p = db.newProject(tplTitle(t, isAr()), t.w, t.h);
    p.templateId = t.id;
    return startEditor(root, p, { template: t });
  }
  if (params.get('new')) {
    const w = clamp(parseInt(params.get('w')) || 794, 50, MAX_DIM), hh = clamp(parseInt(params.get('h')) || 1123, 50, MAX_DIM);
    const p = db.newProject(params.get('n') || L('Untitled design', 'تصميم بلا عنوان'), w, hh);
    return startEditor(root, p, { fresh: true });
  }
  return chooser(root);
}

// ------------------------------------------------------------------ chooser
async function chooser(root) {
  const name = h('input', { class: 'input', value: L('Untitled design', 'تصميم بلا عنوان'), maxlength: '80', 'aria-label': L('Design name', 'اسم التصميم') });
  const cw = h('input', { class: 'input', type: 'number', min: '50', max: String(MAX_DIM), value: '1080', 'aria-label': L('Width in pixels', 'العرض بالبكسل') });
  const ch = h('input', { class: 'input', type: 'number', min: '50', max: String(MAX_DIM), value: '1080', 'aria-label': L('Height in pixels', 'الارتفاع بالبكسل') });
  const go = (w, hh) => {
    w = parseInt(w); hh = parseInt(hh);
    if (!(w >= 50 && w <= MAX_DIM && hh >= 50 && hh <= MAX_DIM)) return toast(L('Width and height must be between 50 and ' + MAX_DIM + ' px.', 'يجب أن يكون العرض والارتفاع بين 50 و' + MAX_DIM + ' بكسل.'), 'error');
    location.hash = '#/studio?new=1&w=' + w + '&h=' + hh + '&n=' + encodeURIComponent(name.value.trim() || 'Untitled');
  };
  let recents = [];
  try { recents = (await db.listProjects()).slice(0, 4); } catch { /* ignore */ }
  root.append(h('div', { class: 'page narrow' },
    h('h1', null, L('New design', 'تصميم جديد')),
    h('p', { class: 'muted' }, L('Pick a size to start with a blank canvas, or use a template.', 'اختر مقاساً لبدء لوحة فارغة، أو استخدم قالباً.')),
    h('label', { class: 'field' }, h('span', null, L('Name', 'الاسم')), name),
    h('div', { class: 'grid presets' }, PRESETS.map(([n, w, hh, ar]) => {
      const r = w / hh, bw = r >= 1 ? 56 : 56 * r, bh = r >= 1 ? 56 / r : 56;
      return h('button', { class: 'card preset', onclick: () => go(w, hh) },
        h('div', { class: 'preset-box' }, h('div', { style: { width: bw + 'px', height: bh + 'px' } })),
        h('strong', null, isAr() && ar ? ar : n), h('span', { class: 'muted small' }, w + ' × ' + hh + ' px'));
    })),
    h('div', { class: 'card custom' }, h('h3', null, L('Custom size', 'مقاس مخصص')),
      h('div', { class: 'row' }, h('label', { class: 'field grow' }, h('span', null, L('Width (px)', 'العرض (بكسل)')), cw), h('label', { class: 'field grow' }, h('span', null, L('Height (px)', 'الارتفاع (بكسل)')), ch)),
      h('button', { class: 'btn primary', onclick: () => go(cw.value, ch.value) }, L('Create design', 'إنشاء التصميم'))),
    h('div', { class: 'row between' }, h('h2', null, L('Start from a template', 'ابدأ من قالب')), h('a', { class: 'btn', href: '#/templates' }, L('Browse templates', 'تصفح القوالب'))),
    recents.length ? h('div', null, h('h2', null, L('Recent projects', 'المشاريع الأخيرة')),
      h('div', { class: 'grid cards' }, recents.map(p => h('a', { class: 'card proj', href: '#/studio?id=' + p.id },
        p.thumb ? h('img', { src: p.thumb, alt: '', loading: 'lazy' }) : h('div', { class: 'thumb-ph' }), h('strong', null, p.name))))) : null));
  refreshIcons();
  return null;
}

// ------------------------------------------------------------------ editor
async function startEditor(root, project, init = {}) {
  root.replaceChildren(spinner());
  const fabric = await loadLib('fabric');
  const coarse = matchMedia('(pointer: coarse)').matches;
  fabric.Object.prototype.set({ transparentCorners: false, cornerColor: '#ffffff', cornerStrokeColor: VIOLET, borderColor: VIOLET, cornerSize: coarse ? 20 : 11, cornerStyle: 'circle', padding: 2, borderScaleFactor: 1.5 });

  let W = project.w, H = project.h, zoom = 1, tab = 'props', gridOn = false, snapOn = true, dirty = false, saving = false, savePending = false, lastVersion = 0, disposed = false;
  let hist = [], hi = -1, restoring = false, clip = null, guides = [], statusKind = 'saved';
  let sizeMeta = { w: W, h: H };

  // ---- DOM
  const nameInp = h('input', { class: 'input name-input', value: project.name, maxlength: '80', 'aria-label': L('Project name', 'اسم المشروع'), onchange: () => { project.name = nameInp.value.trim() || L('Untitled design', 'تصميم بلا عنوان'); nameInp.value = project.name; markDirty(); } });
  const status = h('span', { class: 'save-status', role: 'status' });
  const bt = (ic, label, fn, cls = '') => h('button', { class: 'btn icon ' + cls, 'aria-label': label, title: label, onclick: fn }, icon(ic));
  const undoBtn = bt('undo-2', L('Undo (Ctrl+Z)', 'تراجع (Ctrl+Z)'), () => undo());
  const redoBtn = bt('redo-2', L('Redo (Ctrl+Y)', 'إعادة (Ctrl+Y)'), () => redo());
  const zoomLbl = h('button', { class: 'btn sm zoom-lbl', 'aria-label': L('Fit to screen', 'ملاءمة الشاشة'), onclick: () => fit() }, '100%');
  const gridBtn = bt('grid-3x3', L('Toggle grid', 'إظهار الشبكة'), () => { gridOn = !gridOn; gridBtn.classList.toggle('on', gridOn); updateGrid(); }, '');
  const snapBtn = bt('magnet', L('Snap & alignment guides', 'المحاذاة والإرشادات'), () => { snapOn = !snapOn; snapBtn.classList.toggle('on', snapOn); }, 'on');
  const panelBtn = bt('sliders-horizontal', L('Panels', 'اللوحات'), () => panel.classList.toggle('open'), 'only-mobile');
  const saveBtn = h('button', { class: 'btn primary sm', onclick: () => saveNow(true, true) }, icon('save'), h('span', { class: 'hide-sm' }, L('Save', 'حفظ')));
  const exportBtn = h('button', { class: 'btn sm', onclick: () => exportDialog() }, icon('download'), h('span', { class: 'hide-sm' }, L('Export', 'تصدير')));

  const canvasEl = h('canvas');
  const gridEl = h('div', { class: 'cv-grid', 'aria-hidden': 'true' });
  const holder = h('div', { class: 'cv-holder' }, canvasEl, gridEl);
  const stage = h('div', { class: 'cv-stage', tabindex: '-1' }, holder);
  const panel = h('aside', { class: 'st-panel', 'aria-label': L('Design panels', 'لوحات التصميم') });
  const toolsEl = h('nav', { class: 'st-tools', 'aria-label': L('Tools', 'الأدوات') });

  const tool = (ic, label, fn) => h('button', { class: 'tool', onclick: fn, 'aria-label': label, title: label }, icon(ic), h('span', null, label));
  const polyBtn = tool('hexagon', L('Polygon', 'مضلع'), () => popMenu(polyBtn, [
    [L('Pentagon', 'خماسي'), 5], [L('Hexagon', 'سداسي'), 6], [L('Octagon', 'ثماني'), 8], [L('Star', 'نجمة'), 'star']].map(([label, v]) => ({ label, onClick: () => addPolygon(v) }))));
  const moreBtn = tool('shapes', L('More shapes', 'أشكال أكثر'), () => popMenu(moreBtn, MORE.map(([en, ar], i) => ({ label: L(en, ar), onClick: () => addMore(i) }))));
  const styleBtn = tool('square', L('Filled', 'ممتلئ'), () => { shape.filled = !shape.filled; styleBtn.querySelector('span').textContent = shape.filled ? L('Filled', 'ممتلئ') : L('Hollow', 'مفرغ'); styleBtn.classList.toggle('on', !shape.filled); });
  const shapeColor = h('input', { type: 'color', class: 'color', value: VIOLET, title: L('Shape color', 'لون الشكل'), 'aria-label': L('Shape color', 'لون الشكل') }); shapeColor.addEventListener('input', () => { shape.color = shapeColor.value; });
  toolsEl.append(
    tool('type', L('Text', 'نص'), () => addText()), tool('square', L('Rectangle', 'مستطيل'), () => addShape('rect')), tool('circle', L('Circle', 'دائرة'), () => addShape('circle')),
    tool('triangle', L('Triangle', 'مثلث'), () => addShape('tri')), tool('minus', L('Line', 'خط'), () => addShape('line')), polyBtn,
    tool('image-plus', L('Image', 'صورة'), () => pickImages()), moreBtn, styleBtn, shapeColor, tool('brush', L('Paint', 'رسم'), () => { tab = 'paint'; renderTabs(); renderPanel(); }));
  const filePick = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  filePick.addEventListener('change', () => { const f = [...filePick.files]; filePick.value = ''; addImageFiles(f); });
  const pickImages = () => filePick.click();

  const ws = h('div', { class: 'studio' },
    h('div', { class: 'st-top' }, nameInp, status, h('span', { class: 'sep' }), undoBtn, redoBtn, h('span', { class: 'sep hide-sm' }),
      bt('zoom-out', L('Zoom out', 'تصغير'), () => setZoom(zoom / 1.2)), zoomLbl, bt('zoom-in', L('Zoom in', 'تكبير'), () => setZoom(zoom * 1.2)),
      gridBtn, snapBtn, h('span', { class: 'grow' }), saveBtn, exportBtn, panelBtn),
    h('div', { class: 'st-body' }, toolsEl, stage, panel), filePick);
  root.replaceChildren(ws);

  // ---- canvas
  const canvas = new fabric.Canvas(canvasEl, { width: W, height: H, backgroundColor: '#ffffff', preserveObjectStacking: true, stopContextMenu: true, fireRightClick: false });
  const refreshFonts = async () => {
    const fams = new Set(); canvas.getObjects().forEach(o => o.fontFamily && fams.add(o.fontFamily));
    await Promise.all([...fams].map(f => document.fonts.load('16px "' + f + '"').catch(() => 0)));
    if (disposed) return;
    try { fabric.util.clearFabricFontCache(); } catch { /* ignore */ }
    canvas.getObjects().forEach(o => { if (o.type === 'textbox' || o.type === 'text' || o.type === 'i-text') { o.dirty = true; o.initDimensions && o.initDimensions(); o.setCoords(); } });
    canvas.requestRenderAll();
  };
  const loadJSON = (data) => new Promise((res) => canvas.loadFromJSON(data, () => { canvas.renderAll(); res(); }));

  // ---- zoom
  function applyZoom() {
    canvas.setZoom(zoom); canvas.setDimensions({ width: Math.round(W * zoom), height: Math.round(H * zoom) });
    holder.style.width = Math.round(W * zoom) + 'px'; holder.style.height = Math.round(H * zoom) + 'px';
    zoomLbl.textContent = Math.round(zoom * 100) + '%'; updateGrid();
  }
  function setZoom(z) { zoom = clamp(z, 0.05, 5); applyZoom(); }
  function fit() { const pad = 40; setZoom(Math.min((stage.clientWidth - pad) / W, (stage.clientHeight - pad) / H, 2)); stage.scrollTo(0, 0); }
  function updateGrid() { gridEl.style.display = gridOn ? 'block' : 'none'; gridEl.style.backgroundSize = 20 * zoom + 'px ' + 20 * zoom + 'px'; }
  stage.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9)); } }, { passive: false });
  const ro = new ResizeObserver(debounce(() => { if (!disposed && zoomAuto) fit(); }, 150)); ro.observe(stage);
  let zoomAuto = true;
  stage.addEventListener('wheel', () => { zoomAuto = false; }, { passive: true });
  zoomLbl.addEventListener('click', () => { zoomAuto = true; });

  // ---- history / saving
  const snap = () => JSON.stringify({ w: W, h: H, data: canvas.toJSON(PROPS) });
  function histBytes() { return hist.reduce((n, s) => n + s.length, 0); }
  function commit() {
    if (restoring || disposed) return;
    const s = snap(); if (hist[hi] === s) return;
    hist = hist.slice(0, hi + 1); hist.push(s);
    while (hist.length > 80 || (histBytes() > 90e6 && hist.length > 2)) hist.shift();
    hi = hist.length - 1; syncUndo(); markDirty();
  }
  function syncUndo() { undoBtn.disabled = hi <= 0; redoBtn.disabled = hi >= hist.length - 1; }
  async function goto(i) {
    if (i < 0 || i >= hist.length) return;
    restoring = true; hi = i;
    const s = JSON.parse(hist[i]); W = s.w; H = s.h;
    canvas.discardActiveObject(); await loadJSON(s.data); applyZoom();
    restoring = false; syncUndo(); markDirty(); renderPanel(); refreshFonts();
  }
  const undo = () => goto(hi - 1), redo = () => goto(hi + 1);
  const autosave = debounce(() => { if (settings.autosave) saveNow(false); }, Math.max(1, settings.autosaveSec) * 1000);
  function setStatus(kind) {
    statusKind = kind;
    const t = { dirty: L('Unsaved changes', 'تغييرات غير محفوظة'), saving: L('Saving…', 'جارٍ الحفظ…'), saved: L('Saved ', 'تم الحفظ ') + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), error: L('Save failed', 'فشل الحفظ') };
    status.textContent = t[kind]; status.dataset.kind = kind;
  }
  function markDirty() { dirty = true; guard.dirty = true; setStatus('dirty'); autosave(); }
  const thumb = () => { try { return canvas.toDataURL({ format: 'jpeg', quality: 0.6, multiplier: Math.min(1, 260 / (Math.max(W, H) * zoom)) }); } catch { return ''; } };
  async function saveNow(version = false, manual = false) {
    if (disposed && !dirty) return;
    if (saving) { savePending = true; return; }
    saving = true; setStatus('saving');
    try {
      const wasSel = canvas.getActiveObject();
      const prevJson = project.json, prevThumb = project.thumb;
      if (prevJson && (version || Date.now() - lastVersion > 10 * 60 * 1000)) {
        project.versions = [{ t: project.updated, json: prevJson, thumb: prevThumb, w: project.w, h: project.h }, ...(project.versions || [])].slice(0, 8); lastVersion = Date.now();
      }
      project.name = nameInp.value.trim() || project.name; project.w = W; project.h = H;
      project.json = canvas.toJSON(PROPS); project.json.background = canvas.backgroundColor; project.thumb = thumb();
      await db.saveProject(project);
      dirty = false; guard.dirty = false; setStatus('saved');
      if (!disposed && location.hash.startsWith('#/studio') && !location.hash.includes('id=')) history.replaceState(null, '', '#/studio?id=' + project.id);
      if (manual) toast(L('Project saved on this device.', 'تم حفظ المشروع على هذا الجهاز.'), 'success');
      void wasSel;
    } catch (e) {
      setStatus('error'); toast(e.message || L('Could not save the project.', 'تعذّر حفظ المشروع.'), 'error');
    } finally { saving = false; if (savePending) { savePending = false; saveNow(false); } }
  }
  const onBeforeLang = () => (dirty ? saveNow(true) : null);
  hooks.beforeLang.add(onBeforeLang);

  // ---- object helpers
  const fontDefault = () => (isAr() ? 'Cairo' : 'Inter');
  function place(o) {
    canvas.add(o); o.set({ left: W / 2 - o.getScaledWidth() / 2, top: H / 2 - o.getScaledHeight() / 2 }); o.setCoords();
    canvas.setActiveObject(o); canvas.requestRenderAll();
  }
  function addText() {
    const t = new fabric.Textbox(L('Double-click to edit', 'انقر مرتين للتعديل'), { width: Math.min(W * 0.7, 560), fontSize: clamp(Math.round(W / 16), 24, 96), fill: INK, fontFamily: fontDefault(), textAlign: isAr() ? 'right' : 'left', direction: isAr() ? 'rtl' : 'ltr', name: 'Text' });
    place(t); commit();
  }
  const shape = { filled: true, color: VIOLET };
  const sh = () => shape.filled ? { fill: shape.color, strokeWidth: 0 } : { fill: 'transparent', stroke: shape.color, strokeWidth: Math.max(4, Math.round(Math.min(W, H) / 100)), strokeUniform: true };
  const MORE = [['Heart', 'قلب', 'M50 88 C10 58 0 35 15 18 C30 2 46 10 50 24 C54 10 70 2 85 18 C100 35 90 58 50 88 Z'], ['Arrow', 'سهم', 'M0 38 H58 V15 L100 50 L58 85 V62 H0 Z'], ['Diamond', 'معين', 'M50 0 L100 50 L50 100 L0 50 Z'], ['Plus', 'علامة زائد', 'M35 0 H65 V35 H100 V65 H65 V100 H35 V65 H0 V35 H35 Z'],
    ['Speech bubble', 'فقاعة حوار', 'M10 5 H90 Q100 5 100 15 V60 Q100 70 90 70 H40 L20 95 V70 H10 Q0 70 0 60 V15 Q0 5 10 5 Z'], ['Moon', 'هلال', 'M65 5 A45 45 0 1 0 95 75 A38 38 0 0 1 65 5 Z'], ['Cloud', 'سحابة', 'M25 80 Q0 80 5 60 Q5 40 28 42 Q30 15 55 18 Q75 15 80 38 Q100 35 98 60 Q98 80 78 80 Z'], ['Lightning', 'برق', 'M60 0 L15 55 H45 L35 100 L85 40 H55 Z'],
    ['Parallelogram', 'متوازي أضلاع', 'M25 0 H100 L75 100 H0 Z'], ['Trapezoid', 'شبه منحرف', 'M20 0 H80 L100 100 H0 Z'], ['Right triangle', 'مثلث قائم', 'M0 0 V100 H100 Z'], ['Semicircle', 'نصف دائرة', 'M0 70 A50 50 0 0 1 100 70 Z'], ['Rounded square', 'مربع مدور', 'M25 0 H75 Q100 0 100 25 V75 Q100 100 75 100 H25 Q0 100 0 75 V25 Q0 0 25 0 Z'], ['Pill', 'حبة', 'M30 20 H70 A30 30 0 0 1 70 80 H30 A30 30 0 0 1 30 20 Z'], ['Chevron', 'شيفرون', 'M0 0 H60 L100 50 L60 100 H0 L40 50 Z'], ['Ellipse', 'بيضاوي', 'M0 50 A50 32 0 1 0 100 50 A50 32 0 1 0 0 50 Z']];
  function addMore(i) { const [en, , d] = MORE[i], k = Math.min(W, H) * 0.3 / 100; place(new fabric.Path(d, { ...sh(), scaleX: k, scaleY: k, name: en })); commit(); }
  function addShape(kind) {
    const s = Math.round(Math.min(W, H) * 0.3); let o;
    if (kind === 'rect') o = new fabric.Rect({ width: s * 1.3, height: s, ...sh(), rx: 0, ry: 0, name: 'Rectangle' });
    else if (kind === 'circle') o = new fabric.Circle({ radius: s / 2, ...sh(), name: 'Circle' });
    else if (kind === 'tri') o = new fabric.Triangle({ width: s, height: s * 0.9, ...sh(), name: 'Triangle' });
    else o = new fabric.Line([0, 0, s * 1.4, 0], { stroke: INK, strokeWidth: Math.max(4, Math.round(s / 30)), strokeLineCap: 'round', fill: INK, name: 'Line' });
    place(o); commit();
  }
  function addPolygon(v) {
    const r = Math.round(Math.min(W, H) * 0.16), pts = [];
    if (v === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push({ x: Math.cos(a) * rr + r, y: Math.sin(a) * rr + r }); } }
    else for (let i = 0; i < v; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / v; pts.push({ x: Math.cos(a) * r + r, y: Math.sin(a) * r + r }); }
    place(new fabric.Polygon(pts, { ...sh(), name: v === 'star' ? 'Star' : 'Polygon' })); commit();
  }
  async function addImageFiles(files) {
    if (!files.length) return;
    for (const f of files) {
      const v = await validateImage(f);
      if (!v.ok) { toast(v.error, 'error'); continue; }
      try {
        const c = await fileToCanvas(f, 3000);
        const url = c.toDataURL(v.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92);
        await new Promise((res) => fabric.Image.fromURL(url, (img) => {
          const k = Math.min(1, (W * 0.8) / img.width, (H * 0.8) / img.height); img.scale(k); img.set({ name: f.name.slice(0, 40) });
          place(img); commit(); res();
        }));
      } catch (e) { toast(e.message, 'error'); }
    }
  }
  const objs = () => canvas.getActiveObjects();
  function dup() {
    const a = canvas.getActiveObject(); if (!a) return;
    a.clone((c) => {
      canvas.discardActiveObject(); c.set({ left: a.left + 24, top: a.top + 24, evented: true });
      if (c.type === 'activeSelection') { c.canvas = canvas; c.forEachObject(o => canvas.add(o)); c.setCoords(); } else canvas.add(c);
      canvas.setActiveObject(c); canvas.requestRenderAll(); commit();
    }, PROPS);
  }
  function del() { const a = objs(); if (!a.length) return; canvas.discardActiveObject(); a.forEach(o => canvas.remove(o)); canvas.requestRenderAll(); commit(); }
  function setLock(o, v) { o.locked = v; o.set({ selectable: !v, evented: !v, lockMovementX: v, lockMovementY: v, lockScalingX: v, lockScalingY: v, lockRotation: v }); if (v && canvas.getActiveObject() === o) canvas.discardActiveObject(); }
  const isText = (o) => ['textbox', 'text', 'i-text'].includes(o.type);

  // ---- snapping & guides
  canvas.on('object:moving', (e) => {
    const o = e.target; guides = [];
    if (!snapOn) return;
    const T = 6 / zoom, br = o.getBoundingRect(true, true);
    const xs = [0, W / 2, W], ys = [0, H / 2, H];
    canvas.getObjects().forEach(x => { if (x !== o && x.visible && !(o._objects && o._objects.includes(x))) { const b = x.getBoundingRect(true, true); xs.push(b.left, b.left + b.width / 2, b.left + b.width); ys.push(b.top, b.top + b.height / 2, b.top + b.height); } });
    const mine = (a, s) => [a, a + s / 2, a + s];
    let bx = null, by = null;
    for (const m of mine(br.left, br.width)) for (const c of xs) { const d = c - m; if (Math.abs(d) < T && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, c }; }
    for (const m of mine(br.top, br.height)) for (const c of ys) { const d = c - m; if (Math.abs(d) < T && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, c }; }
    if (bx) { o.left += bx.d; guides.push({ x: bx.c }); } if (by) { o.top += by.d; guides.push({ y: by.c }); }
    o.setCoords();
  });
  canvas.on('before:render', () => { try { canvas.clearContext(canvas.contextTop); } catch { /* ignore */ } });
  canvas.on('after:render', () => {
    if (!guides.length) return;
    const ctx = canvas.contextTop; if (!ctx) return;
    ctx.save(); ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
    guides.forEach(g => { ctx.beginPath(); if (g.x != null) { ctx.moveTo(g.x * zoom, 0); ctx.lineTo(g.x * zoom, H * zoom); } else { ctx.moveTo(0, g.y * zoom); ctx.lineTo(W * zoom, g.y * zoom); } ctx.stroke(); });
    ctx.restore();
  });
  canvas.on('mouse:up', () => { if (guides.length) { guides = []; canvas.requestRenderAll(); } });
  canvas.on('object:modified', (e) => {
    if (gridOn && snapOn && e.target && e.action === 'drag') { e.target.set({ left: Math.round(e.target.left / 20) * 20, top: Math.round(e.target.top / 20) * 20 }); e.target.setCoords(); canvas.requestRenderAll(); }
    commit(); renderPanel(); renderLayers();
  });
  canvas.on('text:editing:exited', () => { commit(); renderLayers(); });
  canvas.on('selection:created', onSel); canvas.on('selection:updated', onSel); canvas.on('selection:cleared', onSel);
  function onSel() { renderPanel(); renderLayers(); }

  // ---- panel
  const panelBody = h('div', { class: 'panel-body' });
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
  panel.append(h('div', { class: 'panel-grab only-mobile' }, h('button', { class: 'btn sm', onclick: () => panel.classList.remove('open') }, L('Close', 'إغلاق'))), tabsEl, panelBody);
  const paint = createPaint({ canvas, fabric, size: () => [W, H], commit, rerender: () => renderPanel() });
  const TABS = [['paint', L('Paint', 'رسم')], ['props', L('Properties', 'الخصائص')], ['layers', L('Layers', 'الطبقات')], ['canvas', L('Canvas', 'اللوحة')]];
  function renderTabs() { tabsEl.replaceChildren(...TABS.map(([k, l]) => h('button', { class: 'tab' + (tab === k ? ' active' : ''), role: 'tab', 'aria-selected': tab === k, onclick: () => { tab = k; renderTabs(); renderPanel(); } }, l))); }
  function renderLayers() { if (tab === 'layers') renderPanel(); }
  const field = (label, ...c) => h('label', { class: 'field' }, h('span', null, label), ...c);
  function numInput(val, min, max, step, onIn, onChange, label) {
    const i = h('input', { class: 'input', type: 'number', min, max, step, value: val, 'aria-label': label });
    i.addEventListener('input', () => { if (i.value !== '') onIn(parseFloat(i.value)); }); i.addEventListener('change', () => onChange && onChange());
    return i;
  }
  function slider(label, val, min, max, step, onIn, onChange) {
    const out = h('output', null, String(Math.round(val * 100) / 100));
    const i = h('input', { type: 'range', class: 'range', min, max, step, value: val, 'aria-label': label });
    i.addEventListener('input', () => { out.textContent = i.value; onIn(parseFloat(i.value)); }); i.addEventListener('change', () => onChange());
    return h('div', { class: 'field' }, h('span', { class: 'row between' }, label, out), i);
  }
  const colorInput = (val, onIn, onChange, label) => {
    const i = h('input', { type: 'color', class: 'color', value: /^#[0-9a-f]{6}$/i.test(val) ? val : '#000000', 'aria-label': label });
    i.addEventListener('input', () => onIn(i.value)); i.addEventListener('change', onChange); return i;
  };
  const apply = (fn) => { objs().forEach(fn); canvas.requestRenderAll(); };
  const tgl = (ic, label, on, fn) => h('button', { class: 'btn icon sm' + (on ? ' on' : ''), 'aria-label': label, title: label, 'aria-pressed': on, onclick: fn }, icon(ic));

  function alignTo(kind) {
    const a = canvas.getActiveObject(); if (!a) return; const b = a.getBoundingRect(true, true);
    const m = { left: [-b.left, 0], center: [W / 2 - (b.left + b.width / 2), 0], right: [W - (b.left + b.width), 0], top: [0, -b.top], middle: [0, H / 2 - (b.top + b.height / 2)], bottom: [0, H - (b.top + b.height)] }[kind];
    a.set({ left: a.left + m[0], top: a.top + m[1] }); a.setCoords(); canvas.requestRenderAll(); commit();
  }
  function propsView() {
    const sel = objs(), a = canvas.getActiveObject();
    if (!sel.length) return h('div', { class: 'empty small' }, icon('mouse-pointer-click'), h('p', null, L('Select an object to edit it, or add one from the toolbar.', 'اختر عنصراً لتعديله، أو أضف عنصراً من شريط الأدوات.')));
    const first = sel[0], single = sel.length === 1, out = [];
    out.push(h('div', { class: 'btn-row' },
      h('button', { class: 'btn sm', onclick: dup }, icon('copy'), L('Duplicate', 'تكرار')), h('button', { class: 'btn sm danger-o', onclick: del }, icon('trash-2'), L('Delete', 'حذف')),
      h('button', { class: 'btn icon sm', 'aria-label': L('Bring forward', 'للأمام'), title: L('Bring forward', 'للأمام'), onclick: () => { sel.forEach(o => canvas.bringForward(o)); commit(); renderPanel(); } }, icon('arrow-up')),
      h('button', { class: 'btn icon sm', 'aria-label': L('Send backward', 'للخلف'), title: L('Send backward', 'للخلف'), onclick: () => { [...sel].reverse().forEach(o => canvas.sendBackwards(o)); commit(); renderPanel(); } }, icon('arrow-down')),
      h('button', { class: 'btn icon sm', 'aria-label': L('Flip horizontally', 'قلب أفقي'), title: L('Flip horizontally', 'قلب أفقي'), onclick: () => { apply(o => o.set('flipX', !o.flipX)); commit(); } }, icon('flip-horizontal-2')),
      h('button', { class: 'btn icon sm', 'aria-label': L('Flip vertically', 'قلب رأسي'), title: L('Flip vertically', 'قلب رأسي'), onclick: () => { apply(o => o.set('flipY', !o.flipY)); commit(); } }, icon('flip-vertical-2'))));
    out.push(h('div', { class: 'sec' }, h('h4', null, L('Align to canvas', 'محاذاة للوحة')), h('div', { class: 'btn-row' },
      [['left', 'align-horizontal-justify-start', L('Left', 'يسار')], ['center', 'align-horizontal-justify-center', L('Center', 'وسط')], ['right', 'align-horizontal-justify-end', L('Right', 'يمين')],
        ['top', 'align-vertical-justify-start', L('Top', 'أعلى')], ['middle', 'align-vertical-justify-center', L('Middle', 'منتصف')], ['bottom', 'align-vertical-justify-end', L('Bottom', 'أسفل')]]
        .map(([k, ic, l]) => h('button', { class: 'btn icon sm', 'aria-label': l, title: l, onclick: () => alignTo(k) }, icon(ic))))));
    if (single && isText(first)) {
      const fontSel = h('select', { class: 'select', 'aria-label': L('Font', 'الخط') }, FONTS.map(f => h('option', { value: f, selected: f === first.fontFamily }, f)));
      fontSel.addEventListener('change', async () => { await document.fonts.load('16px "' + fontSel.value + '"').catch(() => 0); first.set('fontFamily', fontSel.value); first.initDimensions && first.initDimensions(); canvas.requestRenderAll(); commit(); });
      const hasF = FONTS.includes(first.fontFamily); if (!hasF) fontSel.prepend(h('option', { value: first.fontFamily, selected: true }, first.fontFamily));
      out.push(h('div', { class: 'sec' }, h('h4', null, L('Text', 'النص')), field(L('Font', 'الخط'), fontSel),
        h('div', { class: 'row' }, field(L('Size', 'الحجم'), numInput(Math.round(first.fontSize * first.scaleY), 6, 800, 1, v => { first.set({ fontSize: v / first.scaleY }); canvas.requestRenderAll(); }, commit, L('Font size', 'حجم الخط'))),
          field(L('Color', 'اللون'), colorInput(first.fill, v => { first.set('fill', v); canvas.requestRenderAll(); }, commit, L('Text color', 'لون النص')))),
        h('div', { class: 'btn-row' }, tgl('bold', L('Bold', 'عريض'), first.fontWeight === 'bold' || first.fontWeight >= 600, () => { first.set('fontWeight', first.fontWeight === 'bold' ? 'normal' : 'bold'); canvas.requestRenderAll(); commit(); renderPanel(); }),
          tgl('italic', L('Italic', 'مائل'), first.fontStyle === 'italic', () => { first.set('fontStyle', first.fontStyle === 'italic' ? 'normal' : 'italic'); canvas.requestRenderAll(); commit(); renderPanel(); }),
          tgl('underline', L('Underline', 'تسطير'), !!first.underline, () => { first.set('underline', !first.underline); canvas.requestRenderAll(); commit(); renderPanel(); }),
          h('span', { class: 'sep' }),
          ...[['left', 'align-left', L('Align left', 'محاذاة لليسار')], ['center', 'align-center', L('Align center', 'توسيط')], ['right', 'align-right', L('Align right', 'محاذاة لليمين')], ['justify', 'align-justify', L('Justify', 'ضبط')]]
            .map(([k, ic, l]) => tgl(ic, l, first.textAlign === k, () => { first.set('textAlign', k); canvas.requestRenderAll(); commit(); renderPanel(); }))),
        slider(L('Line spacing', 'تباعد الأسطر'), first.lineHeight, 0.6, 3, 0.05, v => { first.set('lineHeight', v); canvas.requestRenderAll(); }, commit),
        slider(L('Letter spacing', 'تباعد الأحرف'), first.charSpacing || 0, -100, 1000, 10, v => { first.set('charSpacing', v); canvas.requestRenderAll(); }, commit),
        isAr() ? h('p', { class: 'muted small' }, 'للنص العربي، يفضل ترك تباعد الأحرف على صفر ليبقى اتصال الحروف سليماً.') : null));
    }
    const noFill = first.type === 'line' || first.type === 'image';
    out.push(h('div', { class: 'sec' }, h('h4', null, L('Appearance', 'المظهر')),
      h('div', { class: 'row' },
        !noFill && !isText(first) ? field(L('Fill', 'التعبئة'), colorInput(first.fill, v => apply(o => o.set('fill', v)), commit, L('Fill color', 'لون التعبئة'))) : null,
        !isText(first) && first.type !== 'image' ? field(L('Stroke', 'الحد'), colorInput(first.stroke || '#000000', v => apply(o => { o.set('stroke', v); if (!o.strokeWidth) o.set('strokeWidth', 2); }), commit, L('Stroke color', 'لون الحد'))) : null,
        !isText(first) && first.type !== 'image' ? field(L('Width', 'السماكة'), numInput(first.strokeWidth || 0, 0, 100, 1, v => apply(o => o.set('strokeWidth', v)), commit, L('Stroke width', 'سماكة الحد'))) : null),
      first.type === 'rect' && single ? slider(L('Corner radius', 'استدارة الزوايا'), first.rx || 0, 0, 200, 1, v => { first.set({ rx: v, ry: v }); canvas.requestRenderAll(); }, commit) : null,
      slider(L('Opacity', 'الشفافية'), (a.opacity ?? 1), 0, 1, 0.01, v => { a.set('opacity', v); canvas.requestRenderAll(); }, commit),
      slider(L('Rotation (°)', 'التدوير (°)'), Math.round(a.angle || 0), -180, 180, 1, v => { a.rotate(v); a.setCoords(); canvas.requestRenderAll(); }, commit)));
    return h('div', null, out);
  }
  function layersView() {
    const list = canvas.getObjects().slice().reverse();
    if (!list.length) return h('div', { class: 'empty small' }, icon('layers'), h('p', null, L('No layers yet. Add text, shapes or images.', 'لا توجد طبقات بعد. أضف نصاً أو أشكالاً أو صوراً.')));
    const label = (o) => (isText(o) ? (o.text || '').replace(/\s+/g, ' ').slice(0, 26) || 'Text' : (o.name || o.type));
    const ic = (o) => (isText(o) ? 'type' : o.type === 'image' ? 'image' : o.type === 'circle' ? 'circle' : o.type === 'line' ? 'minus' : o.type === 'rect' ? 'square' : 'shapes');
    return h('ul', { class: 'layers' }, list.map(o => h('li', { class: 'layer' + (canvas.getActiveObjects().includes(o) ? ' active' : '') + (o.visible === false ? ' dim' : '') },
      h('button', { class: 'layer-name', onclick: () => { if (o.locked || o.visible === false) return toast(L('Unlock or show this layer first.', 'ألغِ القفل أو أظهر هذه الطبقة أولاً.')); canvas.setActiveObject(o); canvas.requestRenderAll(); } }, icon(ic(o)), h('span', null, label(o))),
      h('button', { class: 'btn icon sm', 'aria-label': L('Move up', 'تحريك للأعلى'), title: L('Move up', 'تحريك للأعلى'), onclick: () => { canvas.bringForward(o); commit(); renderPanel(); } }, icon('chevron-up')),
      h('button', { class: 'btn icon sm', 'aria-label': L('Move down', 'تحريك للأسفل'), title: L('Move down', 'تحريك للأسفل'), onclick: () => { canvas.sendBackwards(o); commit(); renderPanel(); } }, icon('chevron-down')),
      h('button', { class: 'btn icon sm', 'aria-label': o.visible === false ? L('Show', 'إظهار') : L('Hide', 'إخفاء'), title: o.visible === false ? L('Show', 'إظهار') : L('Hide', 'إخفاء'), onclick: () => { o.visible = o.visible === false; if (o.visible === false) canvas.discardActiveObject(); canvas.requestRenderAll(); commit(); renderPanel(); } }, icon(o.visible === false ? 'eye-off' : 'eye')),
      h('button', { class: 'btn icon sm', 'aria-label': o.locked ? L('Unlock', 'فتح القفل') : L('Lock', 'قفل'), title: o.locked ? L('Unlock', 'فتح القفل') : L('Lock', 'قفل'), onclick: () => { setLock(o, !o.locked); canvas.requestRenderAll(); commit(); renderPanel(); } }, icon(o.locked ? 'lock' : 'lock-open')))));
  }
  function canvasView() {
    const wI = h('input', { class: 'input', type: 'number', min: 50, max: MAX_DIM, value: W, 'aria-label': L('Width', 'العرض') });
    const hI = h('input', { class: 'input', type: 'number', min: 50, max: MAX_DIM, value: H, 'aria-label': L('Height', 'الارتفاع') });
    const sel = h('select', { class: 'select', 'aria-label': L('Preset size', 'مقاس جاهز') }, h('option', { value: '' }, L('Preset…', 'مقاس جاهز…')), PRESETS.map(([n, w, hh, ar], i) => h('option', { value: i }, (isAr() && ar ? ar : n) + ' (' + w + '×' + hh + ')')));
    sel.addEventListener('change', () => { if (sel.value === '') return; const p = PRESETS[+sel.value]; wI.value = p[1]; hI.value = p[2]; });
    const bg = colorInput(canvas.backgroundColor || '#ffffff', v => { canvas.setBackgroundColor(v, () => canvas.requestRenderAll()); }, commit, L('Background color', 'لون الخلفية'));
    return h('div', null, h('div', { class: 'sec' }, h('h4', null, L('Background', 'الخلفية')), field(L('Color', 'اللون'), bg)),
      h('div', { class: 'sec' }, h('h4', null, L('Canvas size', 'حجم اللوحة')), sel, h('div', { class: 'row' }, field(L('Width (px)', 'العرض (بكسل)'), wI), field(L('Height (px)', 'الارتفاع (بكسل)'), hI)),
        h('button', { class: 'btn sm', onclick: () => { const w = parseInt(wI.value), hh = parseInt(hI.value); if (!(w >= 50 && w <= MAX_DIM && hh >= 50 && hh <= MAX_DIM)) return toast(L('Size must be between 50 and ' + MAX_DIM + ' px.', 'يجب أن يكون المقاس بين 50 و' + MAX_DIM + ' بكسل.'), 'error'); W = w; H = hh; applyZoom(); fit(); commit(); renderPanel(); } }, L('Apply size', 'تطبيق المقاس')),
        h('p', { class: 'muted small' }, L('Size in pixels at 96 dpi. A4 = 794 × 1123.', 'المقاس بالبكسل عند 96 نقطة/بوصة. A4 = 794 × 1123.'))),
      h('div', { class: 'sec' }, h('h4', null, L('History', 'السجل')), h('div', { class: 'btn-row' },
        h('button', { class: 'btn sm', onclick: showVersions }, icon('history'), L('Recover earlier versions', 'استرجاع نسخ سابقة')))),
      h('p', { class: 'muted small' }, L('Projects are saved in this browser only and do not sync between devices.', 'تُحفظ المشاريع في هذا المتصفح فقط ولا تتزامن بين الأجهزة.')));
  }
  function renderPanel() {
    if (disposed) return;
    const ae = document.activeElement;
    if (panelBody.contains(ae) && ae.tagName === 'INPUT' && ['number', 'text'].includes(ae.type)) return; // don't steal focus while typing
    if (tab === 'paint') paint.enable(); else paint.disable();
    panelBody.replaceChildren(tab === 'paint' ? paint.view() : tab === 'props' ? propsView() : tab === 'layers' ? layersView() : canvasView());
    refreshIcons();
  }
  async function showVersions() {
    const vs = project.versions || [];
    const body = vs.length ? h('div', { class: 'grid cards' }, vs.map((v) => h('div', { class: 'card' }, v.thumb ? h('img', { src: v.thumb, alt: '' }) : null,
      h('p', { class: 'small' }, new Date(v.t).toLocaleString()),
      h('button', { class: 'btn sm', onclick: async () => {
        m.close(); const cur = snap();
        W = v.w || W; H = v.h || H; canvas.discardActiveObject(); await loadJSON(v.json); applyZoom(); fit(); await refreshFonts(); void cur; commit(); renderPanel(); toast(L('Earlier version restored. Save to keep it.', 'تمت استعادة نسخة سابقة. احفظ للاحتفاظ بها.'), 'success');
      } }, L('Restore', 'استعادة'))))) : h('p', null, L('No earlier versions yet. A version is stored each time you press Save, and about every 10 minutes while you work.', 'لا توجد نسخ سابقة بعد. تُحفظ نسخة عند كل ضغطة حفظ وكل ١٠ دقائق تقريباً أثناء العمل.'));
    const m = modal({ title: L('Earlier versions', 'النسخ السابقة'), body, wide: true, actions: [h('button', { class: 'btn', onclick: () => m.close() }, L('Close', 'إغلاق'))] });
  }

  // ---- export
  function exportDialog() {
    canvas.discardActiveObject(); canvas.requestRenderAll();
    const fmt = h('select', { class: 'select', 'aria-label': L('Format', 'الصيغة') }, h('option', { value: 'png' }, 'PNG'), h('option', { value: 'jpeg' }, 'JPG'), h('option', { value: 'pdf' }, 'PDF'));
    const scale = h('select', { class: 'select', 'aria-label': L('Scale', 'المقياس') }, [1, 2, 3, 4].map(s => h('option', { value: s, selected: s === 2 }, s + '×')));
    const q = h('input', { type: 'range', class: 'range', min: 0.5, max: 1, step: 0.01, value: 0.92, 'aria-label': L('JPG quality', 'جودة JPG') });
    const qOut = h('output', null, '92%'); const qWrap = h('div', { class: 'field' }, h('span', { class: 'row between' }, L('Quality', 'الجودة'), qOut), q);
    const info = h('p', { class: 'muted small' });
    const upd = () => {
      const s = +scale.value; qWrap.style.display = fmt.value === 'png' ? 'none' : ''; qOut.textContent = Math.round(q.value * 100) + '%';
      const mm = (p) => Math.round(p * 25.4 / 96);
      info.textContent = fmt.value === 'pdf' ? L('PDF page: ', 'صفحة PDF: ') + mm(W) + ' × ' + mm(H) + ' mm — ' + L('image at ', 'الصورة بدقة ') + Math.round(96 * s) + ' dpi' : L('Output: ', 'الناتج: ') + W * s + ' × ' + H * s + ' px';
    };
    [fmt, scale, q].forEach(e => e.addEventListener('input', upd)); upd();
    const go = h('button', { class: 'btn primary', onclick: async () => {
      go.disabled = true; go.replaceChildren(L('Exporting…', 'جارٍ التصدير…'));
      try { await doExport(fmt.value, +scale.value, +q.value); m.close(); } catch (e) { toast(e.message || L('Export failed.', 'فشل التصدير.'), 'error'); } finally { go.disabled = false; go.replaceChildren(L('Download', 'تنزيل')); }
    } }, L('Download', 'تنزيل'));
    const m = modal({ title: L('Export design', 'تصدير التصميم'), body: h('div', null, field(L('Format', 'الصيغة'), fmt), field(L('Scale', 'المقياس'), scale), qWrap, info), actions: [h('button', { class: 'btn', onclick: () => m.close() }, L('Cancel', 'إلغاء')), go] });
  }
  async function doExport(fmt, s, q) {
    if (W * s > 16000 || H * s > 16000 || W * H * s * s > 120e6) throw new Error(L('That output is too large for your browser. Choose a smaller scale.', 'الناتج كبير جداً لمتصفحك. اختر مقياساً أصغر.'));
    const base = safeName(nameInp.value); const prevBg = canvas.backgroundColor;
    canvas.discardActiveObject();
    if ((fmt === 'jpeg' || fmt === 'pdf') && !prevBg) canvas.setBackgroundColor('#ffffff', () => {});
    try {
      await refreshFonts();
      const opts = { format: fmt === 'pdf' ? 'jpeg' : fmt, quality: fmt === 'png' ? 1 : q, multiplier: s / zoom, enableRetinaScaling: false };
      const url = canvas.toDataURL(opts);
      if (fmt === 'pdf') {
        const mw = W * 25.4 / 96, mh = H * 25.4 / 96;
        downloadBlob(await makePdf([{ w: mw, h: mh, jpeg: url, x: 0, y: 0, iw: mw, ih: mh }]), base + '.pdf');
      } else { const b = await (await fetch(url)).blob(); downloadBlob(b, base + (fmt === 'jpeg' ? '.jpg' : '.png')); }
      toast(L('Export ready.', 'تم التصدير.'), 'success');
    } finally { canvas.setBackgroundColor(prevBg, () => canvas.requestRenderAll()); }
  }

  // ---- keyboard / drop / paste
  const onKey = (e) => {
    if (document.querySelector('.modal-back')) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const a = canvas.getActiveObject(); if (a && a.isEditing) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === 'y') { e.preventDefault(); redo(); }
    else if (mod && k === 'd') { e.preventDefault(); dup(); }
    else if (mod && k === 's') { e.preventDefault(); saveNow(true, true); }
    else if (mod && k === 'a') { e.preventDefault(); canvas.discardActiveObject(); const l = canvas.getObjects().filter(o => o.selectable && o.visible !== false); if (l.length) { canvas.setActiveObject(new fabric.ActiveSelection(l, { canvas })); canvas.requestRenderAll(); } }
    else if (mod && k === 'c') { if (a) a.clone(c => { clip = c; }, PROPS); }
    else if (mod && k === 'v') { if (clip) { e.preventDefault(); clip.clone(c => { canvas.discardActiveObject(); c.set({ left: c.left + 24, top: c.top + 24, evented: true }); if (c.type === 'activeSelection') { c.canvas = canvas; c.forEachObject(o => canvas.add(o)); c.setCoords(); } else canvas.add(c); clip.top += 24; clip.left += 24; canvas.setActiveObject(c); canvas.requestRenderAll(); commit(); }, PROPS); } }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (a) { e.preventDefault(); del(); } }
    else if (e.key === 'Escape') { canvas.discardActiveObject(); canvas.requestRenderAll(); }
    else if (a && e.key.startsWith('Arrow')) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; a.set({ left: a.left + (e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0), top: a.top + (e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0) }); a.setCoords(); canvas.requestRenderAll(); commit(); }
  };
  document.addEventListener('keydown', onKey);
  stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('drag'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('drag'));
  stage.addEventListener('drop', (e) => { e.preventDefault(); stage.classList.remove('drag'); addImageFiles([...(e.dataTransfer?.files || [])]); });
  const onPaste = (e) => { if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return; const f = [...(e.clipboardData?.files || [])].filter(x => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); addImageFiles(f); } };
  document.addEventListener('paste', onPaste);

  // ---- initial content
  if (project.json) {
    W = project.w; H = project.h; await loadJSON(project.json);
  } else if (init.template) {
    const t = init.template, ar = isAr(); W = t.w; H = t.h;
    canvas.setBackgroundColor(t.bg, () => {});
    const fams = new Set(t.els.filter(e => e.t === 'text').map(e => elFont(e, ar)));
    await Promise.all([...fams].map(f => document.fonts.load('16px "' + f + '"').catch(() => 0)));
    t.els.forEach(e => {
      let o;
      if (e.t === 'rect') o = new fabric.Rect({ left: e.x, top: e.y, width: e.w, height: e.h, fill: e.fill || 'transparent', stroke: e.stroke || null, strokeWidth: e.stroke ? (e.sw || 1) : 0, rx: e.rx || 0, ry: e.rx || 0, name: 'Rectangle' });
      else if (e.t === 'circle') o = new fabric.Circle({ left: e.cx - e.r, top: e.cy - e.r, radius: e.r, fill: e.fill || 'transparent', stroke: e.stroke || null, strokeWidth: e.stroke ? (e.sw || 1) : 0, name: 'Circle' });
      else if (e.t === 'line') o = new fabric.Line([e.x1, e.y1, e.x2, e.y2], { stroke: e.stroke, strokeWidth: e.sw, name: 'Line' });
      else {
        let al = e.align || 'left'; if (ar && al === 'left') al = 'right';
        o = new fabric.Textbox(elText(e, ar), { left: e.x, top: e.y, width: e.w, fontSize: e.size, fill: e.fill, fontFamily: elFont(e, ar), fontWeight: e.bold ? 'bold' : 'normal', fontStyle: e.italic ? 'italic' : 'normal', textAlign: al, lineHeight: e.lh || 1.16, charSpacing: !ar && e.spacing ? Math.round(e.spacing / e.size * 1000) : 0, direction: ar ? 'rtl' : 'ltr', name: 'Text' });
      }
      canvas.add(o);
    });
    canvas.renderAll();
  }
  applyZoom(); await new Promise(r => requestAnimationFrame(r)); fit();
  renderTabs(); renderPanel(); refreshIcons();
  hist = [snap()]; hi = 0; syncUndo();
  refreshFonts();
  setStatus(project.json ? 'saved' : 'dirty');
  if (!project.json) { // first save so the project exists and the URL carries its id
    project.w = W; project.h = H; await saveNow(false); history.replaceState(null, '', '#/studio?id=' + project.id);
  }
  if (init.fresh || init.template) canvas.discardActiveObject();

  return async () => {
    disposed = true; autosave.cancel();
    hooks.beforeLang.delete(onBeforeLang);
    document.removeEventListener('keydown', onKey); document.removeEventListener('paste', onPaste); ro.disconnect();
    if (dirty && settings.autosave) { disposed = false; await saveNow(false); disposed = true; }
    try { canvas.dispose(); } catch { /* ignore */ }
    guard.dirty = false;
  };
}
