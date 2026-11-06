import { L } from '../core.js';
import { h, icon, refreshIcons, toast, confirmDialog, promptDialog, modal, spinner } from '../util.js';
import * as db from '../db.js';

export async function mount(root) {
  let all = [], q = '';
  const list = h('div', { class: 'grid cards' });
  const search = h('input', { class: 'input', type: 'search', placeholder: L('Search projects…', 'ابحث في المشاريع…'), 'aria-label': L('Search projects', 'ابحث في المشاريع') });
  root.append(h('div', { class: 'page' }, h('div', { class: 'row between' }, h('h1', null, L('Projects', 'مشاريعي')), h('a', { class: 'btn primary', href: '#/studio' }, icon('plus'), L('New design', 'تصميم جديد'))),
    h('p', { class: 'muted' }, L('Stored only in this browser on this device. They do not sync between devices, so export important work.', 'محفوظة في هذا المتصفح وعلى هذا الجهاز فقط. لا تتزامن بين الأجهزة، لذا صدّر أعمالك المهمة.')), search, list));
  list.replaceChildren(spinner());
  async function reload() {
    try { all = await db.listProjects(); } catch (e) { list.replaceChildren(h('div', { class: 'empty' }, h('p', null, L('Could not read saved projects: ', 'تعذّرت قراءة المشاريع المحفوظة: ') + e.message))); return; }
    draw();
  }
  function draw() {
    const k = q.trim().toLowerCase(), items = all.filter(p => !k || p.name.toLowerCase().includes(k));
    if (!items.length) { list.replaceChildren(h('div', { class: 'empty' }, icon('folder-open'), h('h3', null, all.length ? L('No matching projects', 'لا توجد مشاريع مطابقة') : L('No projects yet', 'لا توجد مشاريع بعد')),
      h('p', null, all.length ? L('Try a different search.', 'جرّب بحثاً مختلفاً.') : L('Create a design and it will be saved here automatically.', 'أنشئ تصميماً وسيُحفظ هنا تلقائياً.')), all.length ? null : h('a', { class: 'btn primary', href: '#/studio' }, L('Create a design', 'أنشئ تصميماً')))); refreshIcons(); return; }
    list.replaceChildren(...items.map(card)); refreshIcons();
  }
  const card = (p) => h('div', { class: 'card proj' },
    h('a', { href: '#/studio?id=' + p.id, 'aria-label': L('Open ', 'فتح ') + p.name }, p.thumb ? h('img', { src: p.thumb, alt: '', loading: 'lazy' }) : h('div', { class: 'thumb-ph' })),
    h('strong', { class: 'ellip' }, p.name), h('span', { class: 'muted small' }, p.w + ' × ' + p.h + ' px · ' + new Date(p.updated).toLocaleString()),
    h('div', { class: 'btn-row' },
      h('a', { class: 'btn sm primary', href: '#/studio?id=' + p.id }, L('Open', 'فتح')),
      h('button', { class: 'btn icon sm', 'aria-label': L('Rename', 'إعادة تسمية'), title: L('Rename', 'إعادة تسمية'), onclick: async () => { const n = await promptDialog({ title: L('Rename project', 'إعادة تسمية المشروع'), value: p.name }); if (n) { p.name = n; await db.saveProject(p); await reload(); } } }, icon('pencil')),
      h('button', { class: 'btn icon sm', 'aria-label': L('Duplicate', 'تكرار'), title: L('Duplicate', 'تكرار'), onclick: async () => { try { await db.duplicateProject(p, p.name + L(' copy', ' (نسخة)')); toast(L('Project duplicated.', 'تم تكرار المشروع.'), 'success'); await reload(); } catch (e) { toast(e.message, 'error'); } } }, icon('copy')),
      (p.versions && p.versions.length) ? h('button', { class: 'btn icon sm', 'aria-label': L('Recover earlier version', 'استرجاع نسخة سابقة'), title: L('Recover earlier version', 'استرجاع نسخة سابقة'), onclick: () => versions(p) }, icon('history')) : null,
      h('button', { class: 'btn icon sm danger-o', 'aria-label': L('Delete', 'حذف'), title: L('Delete', 'حذف'), onclick: async () => { if (await confirmDialog({ title: L('Delete project?', 'حذف المشروع؟'), message: L('"' + p.name + '" will be permanently deleted from this device.', 'سيتم حذف "' + p.name + '" نهائياً من هذا الجهاز.'), confirmText: L('Delete', 'حذف'), danger: true })) { await db.deleteProject(p.id); toast(L('Project deleted.', 'تم حذف المشروع.')); await reload(); } } }, icon('trash-2'))));
  function versions(p) {
    const m = modal({ title: L('Earlier versions of ', 'نسخ سابقة من ') + p.name, wide: true, body: h('div', { class: 'grid cards' }, p.versions.map(v => h('div', { class: 'card' }, v.thumb ? h('img', { src: v.thumb, alt: '' }) : null, h('p', { class: 'small' }, new Date(v.t).toLocaleString()),
      h('button', { class: 'btn sm', onclick: async () => { p.versions = [{ t: p.updated, json: p.json, thumb: p.thumb, w: p.w, h: p.h }, ...p.versions.filter(x => x !== v)].slice(0, 8); p.json = v.json; p.thumb = v.thumb; p.w = v.w || p.w; p.h = v.h || p.h; await db.saveProject(p); m.close(); toast(L('Version restored.', 'تمت استعادة النسخة.'), 'success'); await reload(); } }, L('Restore', 'استعادة'))))),
      actions: [h('button', { class: 'btn', onclick: () => m.close() }, L('Close', 'إغلاق'))] });
  }
  search.addEventListener('input', () => { q = search.value; draw(); });
  await reload();
  return null;
}
