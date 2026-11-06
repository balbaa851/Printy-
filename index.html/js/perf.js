// Device capability tiers + adaptive-quality helpers.
// Goal: stay at full frame rate on very weak hardware. The editors read PERF for hard limits (preview size, canvas pixel
// ratio, history memory) and use makeGovernor() to shrink the *interactive* render resolution on the fly so a frame
// never costs more than a few milliseconds, then refine to full preview quality once the user pauses.
import { settings, bus } from './core.js';

const nav = navigator;
const ua = nav.userAgent || '';
const iOS = /iP(hone|ad|od)/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);

// Static limits per tier (MB values are bytes of pixel memory the history may keep alive).
export const TIERS = {
  low:  { prevDim: 900,  maxDim: 3200, dpr: 1,   histMB: 90,  jsonMB: 24, hist: 30, saveMin: 10, imgMax: 2048, targetMs: 7, dabs: 10, tplDim: 240, rbDim: 2000 },
  mid:  { prevDim: 1200, maxDim: 4500, dpr: 1.5, histMB: 220, jsonMB: 50, hist: 50, saveMin: 6,  imgMax: 2600, targetMs: 8, dabs: 20, tplDim: 300, rbDim: 2600 },
  high: { prevDim: 1400, maxDim: 6000, dpr: 2,   histMB: 600, jsonMB: 90, hist: 80, saveMin: 3,  imgMax: 3000, targetMs: 9, dabs: 40, tplDim: 360, rbDim: 3000 }
};

function detectTier() {
  const mem = nav.deviceMemory || 0, cores = nav.hardwareConcurrency || 0, touch = nav.maxTouchPoints > 0, conn = nav.connection || {};
  if (conn.saveData) return 'low';
  if (mem && mem <= 2) return 'low';
  if (cores && cores <= 2) return 'low';
  if (iOS) return 'high';                                  // iPhones/iPads: strong single-core, GPU canvas
  if (cores && cores <= 4 && (mem ? mem <= 4 : touch)) return 'low'; // budget phones / tablets
  if ((cores && cores <= 4) || (mem && mem <= 4) || (cores && cores <= 6)) return 'mid';
  return 'high';
}

export const PERF = { tier: 'high', mode: 'auto', dprCap: 1, calibrated: false };
const RANK = ['low', 'mid', 'high'];

// Tiny CPU probe (~2–40 ms depending on the device): per-pixel float math on 0.25 MP, the same kind of work the editors do.
// Used once to catch devices that under-report (or over-report) their hardware.
function probeMs() {
  try {
    const n = 256 * 256 * 4, a = new Uint8ClampedArray(n), b = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) a[i] = (i * 31) & 255;
    const t0 = performance.now();
    for (let rep = 0; rep < 6; rep++) for (let i = 0; i < n; i += 4) { const r = a[i] * 1.1 + 4, g = a[i + 1] * 1.1 + 4, bl = a[i + 2] * 1.1 + 4, y = .299 * r + .587 * g + .114 * bl; b[i] = y + (r - y) * 1.2; b[i + 1] = y + (g - y) * 1.2; b[i + 2] = y + (bl - y) * 1.2; }
    return performance.now() - t0 + (b[7] & 0);
  } catch { return 0; }
}

function apply(tier) {
  const t = TIERS[tier];
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  Object.assign(PERF, t, { tier, dprCap: Math.max(1, Math.min(dpr, t.dpr)) });
  if (typeof document !== 'undefined') document.documentElement.dataset.perf = tier; // (guarded so unit tests can import this in Node)
}
export function refreshPerf() {
  const m = settings.perf || 'auto';
  PERF.mode = m;
  let tier = m === 'low' || m === 'mid' || m === 'high' ? m : detectTier();
  if (m === 'auto' && PERF.calibrated && PERF.probe) { // downgrade-only correction from the measured probe
    const cap = PERF.probe > 28 ? 'low' : PERF.probe > 12 ? 'mid' : 'high';
    if (RANK.indexOf(cap) < RANK.indexOf(tier)) tier = cap;
  }
  apply(tier);
}
// Run the probe once, during idle time. Returns a promise; safe to call repeatedly.
let calP = null;
export function calibrate() {
  if (calP) return calP;
  calP = new Promise((res) => {
    const run = () => { PERF.probe = probeMs(); PERF.calibrated = true; if ((settings.perf || 'auto') === 'auto') refreshPerf(); res(PERF.probe); };
    ('requestIdleCallback' in window) ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 300);
  });
  return calP;
}
refreshPerf();
bus.addEventListener('settings', (e) => { if (e.detail.key === 'perf') refreshPerf(); });

// ---------------------------------------------------------------------------------------------------------------
// Adaptive interactive-resolution governor.
// record(ms, q) is called with the measured cost of an interactive frame rendered at scale q (0..1 of preview size).
// Cost scales with q², so we keep an estimate of the full-resolution cost and pick the largest q that fits the budget.
export function makeGovernor(minQ = 0.18) {
  let full = 0, q = PERF.tier === 'low' ? 0.5 : PERF.tier === 'mid' ? 0.75 : 1;
  return {
    get q() { return q; },
    get fullMs() { return full; },
    reset() { full = 0; },
    record(ms, usedQ) {
      const est = ms / Math.max(0.02, usedQ * usedQ);
      full = full ? full * 0.6 + est * 0.4 : est;
      const want = Math.min(1, Math.max(minQ, Math.sqrt(PERF.targetMs / Math.max(0.01, full))));
      // hysteresis: shrink promptly (avoid dropped frames), grow slowly (avoid flicker between qualities)
      if (want < q * 0.92) q = want; else if (want > q * 1.15 || (want >= 1 && q < 1)) q = Math.min(1, q * 1.12);
      q = Math.round(q * 100) / 100;
    }
  };
}

// Run a generator-based job in ≤ budget-ms slices so the main thread keeps handling input. Returns {flush, done}.
// flush() finishes the job synchronously (used when another action needs the result right now).
export function sliceJob(gen, budget = 8) {
  let finished = false, timer = 0, resolve; const done = new Promise((r) => { resolve = r; });
  const step = (ms) => { const end = performance.now() + ms; for (;;) { const r = gen.next(); if (r.done) { finished = true; resolve(); return; } if (ms !== Infinity && performance.now() >= end) return; } };
  const tick = () => { timer = 0; step(budget); if (!finished) timer = setTimeout(tick, 0); };
  timer = setTimeout(tick, 0);
  return { done, get finished() { return finished; }, flush() { if (finished) return; clearTimeout(timer); step(Infinity); } };
}

export const now = () => performance.now();
