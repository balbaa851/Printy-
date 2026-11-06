// Pure pixel operations (no DOM) so they can be unit-tested.
export const FILTERS = ['none', 'grayscale', 'sepia', 'vintage', 'vivid', 'cool', 'warm', 'cinematic'];
export const DEFAULT_PARAMS = { brightness: 0, contrast: 0, saturation: 0, exposure: 0, warmth: 0, sharpness: 0 };
const out = [0, 0, 0];

function satur(r, g, b, s) { const y = 0.299 * r + 0.587 * g + 0.114 * b; out[0] = y + (r - y) * s; out[1] = y + (g - y) * s; out[2] = y + (b - y) * s; }
const FILTER_FN = {
  grayscale(r, g, b) { const y = 0.299 * r + 0.587 * g + 0.114 * b; out[0] = out[1] = out[2] = y; },
  sepia(r, g, b) { out[0] = 0.393 * r + 0.769 * g + 0.189 * b; out[1] = 0.349 * r + 0.686 * g + 0.168 * b; out[2] = 0.272 * r + 0.534 * g + 0.131 * b; },
  vintage(r, g, b, vig) {
    let R = 0.393 * r + 0.769 * g + 0.189 * b, G = 0.349 * r + 0.686 * g + 0.168 * b, B = 0.272 * r + 0.534 * g + 0.131 * b;
    R = R * 0.6 + r * 0.4; G = G * 0.6 + g * 0.4; B = B * 0.6 + b * 0.4;
    R = (R - 128) * 0.88 + 128 + 12; G = (G - 128) * 0.88 + 128 + 6; B = (B - 128) * 0.88 + 128 - 6;
    const v = 1 - 0.35 * vig; out[0] = R * v; out[1] = G * v; out[2] = B * v;
  },
  vivid(r, g, b) { satur(r, g, b, 1.45); out[0] = (out[0] - 128) * 1.1 + 128; out[1] = (out[1] - 128) * 1.1 + 128; out[2] = (out[2] - 128) * 1.1 + 128; },
  cool(r, g, b) { out[0] = r * 0.9; out[1] = g * 1.0 + 2; out[2] = b * 1.1 + 12; },
  warm(r, g, b) { out[0] = r * 1.08 + 10; out[1] = g * 1.02 + 3; out[2] = b * 0.88; },
  cinematic(r, g, b, vig) {
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    let R = r + 26 * l - 10 * (1 - l), G = g + 4 * (1 - l), B = b + 24 * (1 - l) - 20 * l;
    R = (R - 128) * 1.14 + 128; G = (G - 128) * 1.14 + 128; B = (B - 128) * 1.14 + 128;
    satur(R, G, B, 0.88); const v = 1 - 0.28 * vig; out[0] *= v; out[1] *= v; out[2] *= v;
  }
};
// ---- fast path helpers -------------------------------------------------------------------------------------
// Per-channel look-up tables. Exposure, brightness, contrast and warmth are all per-channel affine maps, so one 256-entry
// table per channel gives exactly the same numbers as evaluating them per pixel — at a fraction of the cost.
const lR = new Float64Array(256), lG = new Float64Array(256), lB = new Float64Array(256);
const qR = new Uint8ClampedArray(256), qG = new Uint8ClampedArray(256), qB = new Uint8ClampedArray(256);
let sharpBuf = null; // scratch copy for the sharpen kernel, reused between frames (no per-frame allocation / GC)

// d: Uint8ClampedArray RGBA written to. src (optional): read from here instead of d, so callers can keep a pristine
// source buffer and re-render into a reusable output buffer without copying first. src === d (default) = in place.
export function adjustPixels(d, w, h, p, filter = 'none', amt = 100, src = d) {
  const tone = p.brightness || p.contrast || p.saturation || p.exposure || p.warmth;
  const f = filter !== 'none' ? amt / 100 : 0;
  const n = d.length;
  if (tone || f) {
    const br = p.brightness * 2.55, ex = Math.pow(2, p.exposure / 50), C = p.contrast * 2.55;
    const cf = (259 * (C + 255)) / (255 * (259 - C)), sat = 1 + p.saturation / 100, wm = p.warmth * 0.6;
    for (let v = 0; v < 256; v++) {
      let b = v * ex + br; if (p.contrast) b = (b - 128) * cf + 128;
      lR[v] = b + wm; lG[v] = b + wm * 0.1; lB[v] = b - wm;
    }
    if (!p.saturation && !f) { // most common case: pure table lookups
      for (let v = 0; v < 256; v++) { qR[v] = lR[v]; qG[v] = lG[v]; qB[v] = lB[v]; }
      for (let i = 0; i < n; i += 4) { d[i] = qR[src[i]]; d[i + 1] = qG[src[i + 1]]; d[i + 2] = qB[src[i + 2]]; d[i + 3] = src[i + 3]; }
    } else {
      const fn = f ? FILTER_FN[filter] : null, needVig = f && (filter === 'vintage' || filter === 'cinematic');
      const cx = w / 2, cy = h / 2, vn = cx * cx + cy * cy || 1, hasSat = !!p.saturation;
      let x = 0, y = 0;
      for (let i = 0; i < n; i += 4) {
        let r = lR[src[i]], g = lG[src[i + 1]], b = lB[src[i + 2]];
        if (hasSat) { const l = 0.299 * r + 0.587 * g + 0.114 * b; r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
        if (fn) {
          let vig = 0; if (needVig) { const dx = x - cx, dy = y - cy; vig = (dx * dx + dy * dy) / vn; }
          fn(r < 0 ? 0 : r > 255 ? 255 : r, g < 0 ? 0 : g > 255 ? 255 : g, b < 0 ? 0 : b > 255 ? 255 : b, vig);
          r += (out[0] - r) * f; g += (out[1] - g) * f; b += (out[2] - b) * f;
        }
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = src[i + 3]; // Uint8ClampedArray clamps + rounds
        if (++x === w) { x = 0; y++; }
      }
    }
  } else if (src !== d) d.set(src);
  if (p.sharpness > 0) sharpen(d, w, h, (p.sharpness / 100) * 0.8);
}
export function sharpen(d, w, h, a) {
  if (w < 3 || h < 3) return;
  if (!sharpBuf || sharpBuf.length < d.length) sharpBuf = new Uint8ClampedArray(d.length);
  const src = sharpBuf; src.set(d);
  const s4 = w * 4, k = 1 + 4 * a;
  for (let y = 1; y < h - 1; y++) {
    let i = (y * w + 1) * 4;
    for (let x = 1; x < w - 1; x++, i += 4) {
      d[i] = src[i] * k - a * (src[i - 4] + src[i + 4] + src[i - s4] + src[i + s4]);
      d[i + 1] = src[i + 1] * k - a * (src[i - 3] + src[i + 5] + src[i - s4 + 1] + src[i + s4 + 1]);
      d[i + 2] = src[i + 2] * k - a * (src[i - 2] + src[i + 6] + src[i - s4 + 2] + src[i + s4 + 2]);
    }
  }
}
// ---- color utilities (used by Image Tools) ----
export const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
export function dominantColors(d, count = 6) {
  const buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; buckets.set(key, b);
  }
  const list = [...buckets.values()].sort((a, b) => b.n - a.n).map(b => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n), n: b.n }));
  const total = list.reduce((s, c) => s + c.n, 0) || 1, picked = [];
  for (const c of list) {
    if (picked.every(p => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) > 48)) picked.push(c);
    if (picked.length >= count) break;
  }
  return picked.map(c => ({ r: c.r, g: c.g, b: c.b, hex: toHex(c.r, c.g, c.b), pct: Math.round((c.n / total) * 100) }));
}
