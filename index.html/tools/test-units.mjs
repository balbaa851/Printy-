// Dependency-free unit tests for the pure logic. Run: npm test
import assert from 'node:assert/strict';
const { targetSize } = await import('../js/pages/tools.js');
const { sheetGeometry, placeImage } = await import('../js/pages/print.js');
const { makePdf } = await import('../js/pdf.js');
const { adjustPixels, DEFAULT_PARAMS, dominantColors, toHex } = await import('../js/pixels.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('resize: percent', () => assert.deepEqual(targetSize(1000, 500, { mode: 'percent', percent: 50 }), [500, 250]));
t('resize: longest side never upscales', () => assert.deepEqual(targetSize(400, 200, { mode: 'max', max: 1600 }), [400, 200]));
t('resize: longest side downscales', () => assert.deepEqual(targetSize(4000, 2000, { mode: 'max', max: 1000 }), [1000, 500]));
t('resize: exact width keeps aspect', () => assert.deepEqual(targetSize(1000, 500, { mode: 'exact', keep: true, w: 200, h: 0 }), [200, 100]));
t('resize: exact box fits inside', () => assert.deepEqual(targetSize(1000, 500, { mode: 'exact', keep: true, w: 300, h: 300 }), [300, 150]));
t('resize: exact stretch', () => assert.deepEqual(targetSize(1000, 500, { mode: 'exact', keep: false, w: 300, h: 300 }), [300, 300]));
t('resize: clamps to >=1', () => assert.deepEqual(targetSize(10, 10, { mode: 'percent', percent: 1 }), [1, 1]));

const base = { paper: 'A4', orient: 'portrait', cw: 100, ch: 100, margin: 10, bleed: 0 };
t('print: A4 portrait', () => { const g = sheetGeometry(base); assert.equal(g.pw, 210); assert.equal(g.ph, 297); });
t('print: A4 landscape swaps', () => { const g = sheetGeometry({ ...base, orient: 'landscape' }); assert.equal(g.pw, 297); assert.equal(g.ph, 210); });
t('print: Letter', () => { const g = sheetGeometry({ ...base, paper: 'Letter' }); assert.equal(g.pw, 215.9); assert.equal(g.ph, 279.4); });
t('print: bleed grows the sheet', () => { const g = sheetGeometry({ ...base, bleed: 3 }); assert.equal(g.total.w, 216); assert.equal(g.total.h, 303); });
t('print: margin box sits inside trim', () => { const g = sheetGeometry({ ...base, bleed: 3 }); assert.deepEqual(g.box, { x: 13, y: 13, w: 190, h: 277 }); });
t('print: zero margin extends into bleed', () => { const g = sheetGeometry({ ...base, margin: 0, bleed: 3 }); assert.deepEqual(g.box, { x: 0, y: 0, w: 216, h: 303 }); });
t('print: custom size', () => { const g = sheetGeometry({ ...base, paper: 'custom', cw: 100, ch: 150 }); assert.equal(g.pw, 100); assert.equal(g.ph, 150); });
t('print: fit keeps aspect inside box', () => { const p = placeImage(200, 100, { x: 0, y: 0, w: 100, h: 100 }, 'fit'); assert.deepEqual([p.w, p.h, p.y], [100, 50, 25]); });
t('print: fill covers box', () => { const p = placeImage(200, 100, { x: 0, y: 0, w: 100, h: 100 }, 'fill'); assert.deepEqual([p.w, p.h], [200, 100]); });

// Minimal valid JPEG header: SOI, SOF0 with 4x3, 3 components.
const jpg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xC0, 0, 17, 8, 0, 3, 0, 4, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xFF, 0xD9]);
const pdf = await makePdf([{ w: 210, h: 297, jpeg: new Blob([jpg]) }, { w: 100, h: 50, jpeg: new Blob([jpg]) }], 'Test (x)');
const txt = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
t('pdf: header + 2 pages', () => { assert.ok(txt.startsWith('%PDF-1.4')); assert.match(txt, /\/Count 2/); assert.ok(txt.trimEnd().endsWith('%%EOF')); });
t('pdf: A4 MediaBox in points', () => assert.match(txt, /\/MediaBox \[0 0 595\.276 841\.890\]/));
t('pdf: image dimensions parsed from JPEG', () => assert.match(txt, /\/Width 4 \/Height 3/));
t('pdf: xref offsets point at objects', () => {
  const x = txt.indexOf('xref\n'), lines = txt.slice(x).split('\n').slice(3);
  for (let i = 0; i < 4; i++) { const off = +lines[i].slice(0, 10); assert.ok(txt.startsWith((i + 1) + ' 0 obj', off), 'object ' + (i + 1)); }
});

const px = new Uint8ClampedArray([100, 100, 100, 255]);
t('pixels: brightness raises values', () => { const d = new Uint8ClampedArray(px); adjustPixels(d, 1, 1, { ...DEFAULT_PARAMS, brightness: 50 }); assert.ok(d[0] > 100); });
t('pixels: saturation -100 is grey', () => { const d = new Uint8ClampedArray([200, 50, 20, 255]); adjustPixels(d, 1, 1, { ...DEFAULT_PARAMS, saturation: -100 }); assert.ok(Math.abs(d[0] - d[1]) <= 1 && Math.abs(d[1] - d[2]) <= 1); });
t('pixels: grayscale filter', () => { const d = new Uint8ClampedArray([200, 50, 20, 255]); adjustPixels(d, 1, 1, DEFAULT_PARAMS, 'grayscale', 100); assert.ok(Math.abs(d[0] - d[1]) <= 1 && Math.abs(d[1] - d[2]) <= 1); });
t('pixels: toHex', () => assert.equal(toHex(255, 0, 128), '#FF0080'));
t('pixels: dominant colour', () => { const d = new Uint8ClampedArray(400); for (let i = 0; i < 100; i++) d.set([255, 0, 0, 255], i * 4); assert.equal(dominantColors(d, 3)[0].hex, '#FF0000'); });

// ---- performance helpers
const { sharpen } = await import('../js/pixels.js');
const { makeGovernor, sliceJob, PERF } = await import('../js/perf.js');
t('pixels: LUT fast path equals per-pixel maths', () => {
  const d = new Uint8ClampedArray(4 * 256); for (let i = 0; i < 256; i++) d.set([i, 255 - i, (i * 7) & 255, 255], i * 4);
  const p = { ...DEFAULT_PARAMS, brightness: 17, contrast: 33, exposure: -20, warmth: 25 }, out = new Uint8ClampedArray(d.length); adjustPixels(out, 256, 1, p, 'none', 100, d);
  const br = 17 * 2.55, ex = Math.pow(2, -20 / 50), C = 33 * 2.55, cf = (259 * (C + 255)) / (255 * (259 - C)), wm = 25 * 0.6;
  for (let i = 0; i < 256; i++) { const f = (v, k) => (((v * ex + br) - 128) * cf + 128) + k; const e = new Uint8ClampedArray([f(d[i * 4], wm), f(d[i * 4 + 1], wm * .1), f(d[i * 4 + 2], -wm)]); assert.deepEqual([out[i * 4], out[i * 4 + 1], out[i * 4 + 2], out[i * 4 + 3]], [e[0], e[1], e[2], 255]); }
});
t('pixels: separate source buffer is left untouched', () => { const src = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]), keep = new Uint8ClampedArray(src), dst = new Uint8ClampedArray(8); adjustPixels(dst, 2, 1, { ...DEFAULT_PARAMS, brightness: 40 }, 'sepia', 80, src); assert.deepEqual(src, keep); assert.notDeepEqual(dst, keep); });
t('pixels: no-op copies source', () => { const src = new Uint8ClampedArray([1, 2, 3, 4]), dst = new Uint8ClampedArray(4); adjustPixels(dst, 1, 1, DEFAULT_PARAMS, 'none', 100, src); assert.deepEqual(dst, src); });
t('governor: slow device lowers interactive resolution, fast device keeps full', () => {
  const slow = makeGovernor(); for (let i = 0; i < 12; i++) slow.record(80 * slow.q * slow.q, slow.q); assert.ok(slow.q < 0.5, 'slow q=' + slow.q);
  const fast = makeGovernor(); for (let i = 0; i < 40; i++) fast.record(1 * fast.q * fast.q, fast.q); assert.ok(fast.q >= 0.95, 'fast q=' + fast.q);
});
t('perf: tier table sane', () => assert.ok(['low', 'mid', 'high'].includes(PERF.tier) && PERF.prevDim >= 900 && PERF.dabs > 0));
await new Promise((res) => { let k = 0; function* g() { for (let i = 0; i < 5; i++) { k++; yield; } } const j = sliceJob(g(), 1); j.flush(); t('sliceJob: flush runs the job to completion synchronously', () => { assert.equal(k, 5); assert.ok(j.finished); }); res(); });
console.log('\n' + n + ' tests passed');
