// Minimal dependency-free PDF writer: one JPEG image per page, exact page size in millimetres.
// pages: [{ w, h, jpeg (dataURL | Blob), x, y, iw, ih, bg? }]  (all units mm; x,y = image top-left)
const MM = 72 / 25.4;
async function toBytes(j) {
  if (typeof j === 'string') { const b = atob(j.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  return new Uint8Array(await j.arrayBuffer());
}
function jpegInfo(u) {
  if (u[0] !== 0xFF || u[1] !== 0xD8) throw new Error('Not a JPEG');
  let i = 2;
  while (i < u.length) {
    if (u[i] !== 0xFF) { i++; continue; }
    const m = u[i + 1];
    if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) return { h: (u[i + 5] << 8) | u[i + 6], w: (u[i + 7] << 8) | u[i + 8], comps: u[i + 9] };
    i += 2 + ((u[i + 2] << 8) | u[i + 3]);
  }
  throw new Error('Bad JPEG');
}
export async function makePdf(pages, title = 'PRINTY') {
  const enc = new TextEncoder(), chunks = []; let len = 0; const offs = [];
  const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; put(n + ' 0 obj\n'); put(body); put('\nendobj\n'); };
  const n = pages.length, f = (v) => (+v).toFixed(3);
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Count ' + n + ' /Kids [' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>');
  for (let i = 0; i < n; i++) {
    const p = pages[i], pw = p.w * MM, ph = p.h * MM, base = 3 + i * 3;
    const bytes = await toBytes(p.jpeg), inf = jpegInfo(bytes);
    const iw = (p.iw ?? p.w) * MM, ih = (p.ih ?? p.h) * MM, x = (p.x || 0) * MM, y = ph - (p.y || 0) * MM - ih;
    let c = '';
    if (p.bg) c += p.bg.map(v => (v / 255).toFixed(3)).join(' ') + ' rg 0 0 ' + f(pw) + ' ' + f(ph) + ' re f\n';
    c += 'q ' + f(iw) + ' 0 0 ' + f(ih) + ' ' + f(x) + ' ' + f(y) + ' cm /Im0 Do Q';
    obj(base, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f(pw) + ' ' + f(ph) + '] /Resources << /XObject << /Im0 ' + (base + 1) + ' 0 R >> >> /Contents ' + (base + 2) + ' 0 R >>');
    offs[base + 1] = len; put((base + 1) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + inf.w + ' /Height ' + inf.h + ' /ColorSpace /' + (inf.comps === 1 ? 'DeviceGray' : inf.comps === 4 ? 'DeviceCMYK' : 'DeviceRGB') + ' /BitsPerComponent 8 /Filter /DCTDecode' + (inf.comps === 4 ? ' /Decode [1 0 1 0 1 0 1 0]' : '') + ' /Length ' + bytes.length + ' >>\nstream\n'); put(bytes); put('\nendstream\nendobj\n');
    obj(base + 2, '<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream');
  }
  const infoN = 3 + n * 3;
  obj(infoN, '<< /Title (' + title.replace(/[()\\]/g, '') + ') /Producer (PRINTY) >>');
  const xref = len; let x = 'xref\n0 ' + (infoN + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= infoN; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  put(x + 'trailer\n<< /Size ' + (infoN + 1) + ' /Root 1 0 R /Info ' + infoN + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  return new Blob(chunks, { type: 'application/pdf' });
}
