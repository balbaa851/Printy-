// Copies the pinned third-party libraries from node_modules into vendor/ so the app can run without a CDN.
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = [['node_modules/fabric/dist/fabric.min.js', 'vendor/fabric.min.js'], ['node_modules/jszip/dist/jszip.min.js', 'vendor/jszip.min.js']];
fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
let missing = 0;
for (const [from, to] of files) {
  const src = path.join(root, from);
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(root, to)); console.log('vendored', to); }
  else { missing++; console.warn('MISSING ' + from + ' — run "npm install" first. The app will fall back to the CDN for this library.'); }
}
process.exitCode = 0; if (missing) console.warn(missing + ' library file(s) not vendored.');
