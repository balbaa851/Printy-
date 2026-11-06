// Production build: bundles + minifies JS (code-split per page) and CSS, copies static assets and vendored libraries into dist/.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), dist = path.join(root, 'dist');
const { build } = await import('esbuild');
execFileSync(process.execPath, [path.join(root, 'tools/vendor.mjs')], { stdio: 'inherit' });
fs.rmSync(dist, { recursive: true, force: true }); fs.mkdirSync(dist, { recursive: true });
// In the production bundle, prefer the self-hosted vendor/ copies over the CDN.
const vendorFirst = { name: 'vendor-first', setup(b) { b.onLoad({ filter: /js[\\/]config\.js$/ }, (a) => ({ contents: fs.readFileSync(a.path, 'utf8').replace('useVendor: false', 'useVendor: true'), loader: 'js' })); } };
await build({ entryPoints: [path.join(root, 'js/main.js')], bundle: true, splitting: true, format: 'esm', outdir: path.join(dist, 'js'), minify: true, target: 'es2020', legalComments: 'none', plugins: [vendorFirst], logLevel: 'info' });
await build({ entryPoints: [path.join(root, 'css/styles.css')], bundle: true, minify: true, outdir: path.join(dist, 'css'), logLevel: 'info' });
for (const f of ['index.html', '404.html', 'favicon.svg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'robots.txt']) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(dist, f));
if (fs.existsSync(path.join(root, 'vendor'))) fs.cpSync(path.join(root, 'vendor'), path.join(dist, 'vendor'), { recursive: true });
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
const size = (d) => fs.readdirSync(d, { recursive: true }).filter(f => fs.statSync(path.join(d, f)).isFile()).reduce((n, f) => n + fs.statSync(path.join(d, f)).size, 0);
console.log('\nBuilt dist/ — ' + (size(dist) / 1024).toFixed(0) + ' KB total');
