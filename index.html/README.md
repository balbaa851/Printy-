# PRINTY — Create. Edit. Print.

A browser-based design studio, photo editor, manual background editor, print center and image toolbox.
**Everything runs on the visitor's device.** There is no backend, no account, no API key and no analytics; images are never uploaded.

| Area | What it does |
|---|---|
| **Design Studio** | Layered canvas editor (Fabric.js): text, shapes, polygons, images, layers (reorder/hide/lock), undo/redo, snapping guides, grid, zoom, autosave, version recovery, PNG/JPG/PDF export |
| **Photo Editor** | Brightness, contrast, saturation, exposure, warmth, sharpness, 7 filters, **pen / highlighter / eraser drawing, retouch brushes (paint, spot heal, sharpen, smudge, sponge, red-eye, blur, clone stamp, mosaic, dodge, burn, erase), auto enhance, shadows/highlights/tint/fade, straighten, zoom, Ctrl+Z/Y, effects (blur, pixelate, vignette, grain, hue, invert, border)**, crop (free + 10 ratios), rotate/flip, resize, text/sticker/shape (incl. arrow, heart) overlays, before/after, undo/redo, PNG/JPG/WebP export. Edits are rendered into the exported pixels at full resolution |
| **Background Editor** | *Manual* background removal (colour tolerance + eraser/restore brush) → transparent PNG. It is **not** AI removal |
| **Templates** | 100+ original editable templates across 14 categories (EN + AR), with search and filters |
| **Print Center** | A4/A3/A5/Letter/custom, portrait/landscape, margins, bleed, 150/300/600 dpi, mm + px readout, low-resolution warning, PDF with exact page size, PNG/JPG, browser print dialog |
| **Image Tools** | Batch compress / resize / convert (PNG, JPG, WebP), format info, dominant colours with HEX/RGB copy, ZIP download |
| **Projects & Settings** | IndexedDB projects (localStorage fallback), rename/duplicate/delete, recover earlier versions, Arabic/English (RTL/LTR), light/dark, autosave options, clear data |

## Performance on low-end devices

`js/perf.js` rates the device (`<html data-perf="low|mid|high">`, overridable in **Settings → Performance**) and the editors adapt:

* **Photo Editor** – tone/filter/effect results are cached; slider drags render at an adaptive lower resolution (a governor keeps each frame inside a few ms) and refine to full preview quality when you pause. Pixel maths uses look-up tables and reusable buffers (no per-frame allocation). Brush strokes paint into the small preview first and are applied to the full-resolution photo in the background; undo/redo of strokes stores only the touched rectangle.
* **Design Studio** – canvas pixel ratio capped per tier, snap targets cached per drag, history snapshots intern image data and keep the paint layer as a canvas/Blob instead of re-encoding PNGs, autosave waits for idle time, paint tools recomposite only the dirty rectangle.
* **Everywhere** – the ribbon no longer rebuilds on every DOM change, web fonts load lazily, low tier drops blur/shadows/transitions, template previews are smaller.

Working-size limits per tier are in `TIERS` (js/perf.js). Benchmarks were taken with 6× CPU throttling: slider drag ≈155 → 20 ms/frame, brush ≈180 → 18 ms/frame.

## Run locally

```bash
npm install          # installs build tooling + fabric/jszip (to be self-hosted)
npm run vendor       # copies fabric.min.js and jszip.min.js into vendor/
npm run dev          # http://localhost:5173  (static server, no build step)
npm test             # unit tests for sizing, print geometry, PDF writer, pixel maths
```

The app is plain ES modules — no framework, no bundler needed in development. If `vendor/` is empty the
libraries are fetched from cdnjs instead, so the app still works.

## Production build

```bash
npm run build        # → dist/  (minified, code-split per page, vendored libraries, ~360 KB)
npm run preview      # serve dist/ locally
```

## Deploy (all free tiers)

* **Vercel** – import the repo. `vercel.json` sets build command, output dir and security headers.
* **Netlify** – import the repo. `netlify.toml` does the same.
* **GitHub Pages** – push to `main`; `.github/workflows/pages.yml` builds and publishes (enable *Settings → Pages → Source: GitHub Actions*).
  Routing uses `#/hash` URLs and relative asset paths, so it works under `/repo-name/` with no configuration.

Unknown URLs get the custom `404.html`; unknown in-app routes show an in-app 404.

## Configuration

`js/config.js` — optional `contactEmail` (enables the Contact page's mail link) and `repoUrl`.

## Privacy model

* Images, designs and exports stay in the browser (memory, IndexedDB, localStorage). Nothing is sent to a server.
* The only network requests are: the page's own files, **Google Fonts** (typefaces), and — only if `vendor/` was not built — cdnjs for Fabric.js/JSZip.
  To make the app fully self-contained, self-host the font files and drop the Google Fonts `<link>` and CSP entries.
* Projects do **not** sync between devices or browsers. Clearing browser data deletes them (Settings → Clear all project data).
* User text is always inserted with `textContent`/DOM nodes, never as HTML. Uploads are validated by file signature (not just extension) and size.

## Project layout

```
index.html, 404.html, manifest.webmanifest, favicon.svg
css/styles.css            design tokens, light/dark, RTL-safe layout, responsive
js/main.js                router, header/footer, language switch, unsaved-work guard
js/core.js, config.js     settings, bus, config
js/util.js                DOM builder, toasts, dialogs, file validation, image decode/export
js/db.js                  IndexedDB project store (+ localStorage fallback)
js/pdf.js                 dependency-free PDF writer (JPEG pages, exact mm size)
js/pixels.js              colour adjustments, filters, sharpen, dominant colours
js/icons.js               generated inline Lucide icons (npm run icons)
js/templates-data.js      template definitions + preview renderer
js/pages/*.js             one lazily-loaded module per page
tools/                    build, vendor, dev server, icon generator, unit tests
```

## Known limits

* Browsers cap canvas size; very large exports (>100 MP) are refused with a clear message.
* JPEG/WebP encoders are the browser's; a browser without WebP encoding falls back to PNG and says so.
* Output is RGB. For CMYK/press workflows, use the PDF with 3 mm bleed as a starting point for your printer's preflight.
