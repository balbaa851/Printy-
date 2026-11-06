import { L, settings, setSetting, VERSION } from '../core.js';
import { h, icon, refreshIcons, toast, confirmDialog } from '../util.js';
import * as db from '../db.js';

export async function mount(root) {
  let count = 0; try { count = (await db.listProjects()).length; } catch { /* ignore */ }
  const seg = (key, opts) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, label]) => h('button', { class: 'btn sm' + (settings[key] === v ? ' on' : ''), 'aria-pressed': settings[key] === v, onclick: () => { setSetting(key, v); if (key === 'lang') { location.reload(); } else rerender(); } }, label)));
  let est = ''; try { if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); est = ' · ' + (e.usage / 1048576).toFixed(1) + ' MB'; } } catch { /* ignore */ }
  const box = h('div', { class: 'page narrow' });
  function rerender() {
    box.replaceChildren(h('h1', null, L('Settings', 'الإعدادات')),
      h('div', { class: 'card setting' }, h('h3', null, L('Language', 'اللغة')), seg('lang', [['en', 'English'], ['ar', 'العربية']])),
      h('div', { class: 'card setting' }, h('h3', null, L('Theme', 'السمة')), seg('theme', [['light', L('Light', 'فاتح')], ['dark', L('Dark', 'داكن')], ['system', L('System', 'النظام')]])),
      h('div', { class: 'card setting' }, h('h3', null, L('Autosave', 'الحفظ التلقائي')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: settings.autosave, onchange: (e) => { setSetting('autosave', e.target.checked); toast(L('Autosave ', 'الحفظ التلقائي ') + (e.target.checked ? L('on', 'مفعّل') : L('off', 'متوقف'))); } }), L('Save design changes automatically', 'حفظ تغييرات التصميم تلقائياً')),
        h('label', { class: 'field' }, h('span', null, L('Delay before saving (seconds)', 'المهلة قبل الحفظ (ثوانٍ)')),
          h('input', { class: 'input', type: 'number', min: 1, max: 60, value: settings.autosaveSec, onchange: (e) => { setSetting('autosaveSec', clampN(e.target.value)); e.target.value = settings.autosaveSec; toast(L('Saved. Applies next time you open the studio.', 'تم الحفظ. يُطبَّق عند فتح الاستوديو في المرة القادمة.')); } }))),
      h('div', { class: 'card setting' }, h('h3', null, L('Local data', 'البيانات المحلية')),
        h('p', { class: 'muted' }, L(count + ' project(s) stored in ' + db.storageMode() + est + '. Data stays on this device and does not sync.', count + ' مشروع محفوظ في ' + db.storageMode() + est + '. تبقى البيانات على هذا الجهاز ولا تتزامن.')),
        h('button', { class: 'btn danger', onclick: async () => {
          if (!(await confirmDialog({ title: L('Clear all local project data?', 'مسح كل بيانات المشاريع المحلية؟'), message: L('All saved projects and earlier versions will be permanently deleted from this browser. This cannot be undone.', 'سيتم حذف كل المشاريع المحفوظة والنسخ السابقة نهائياً من هذا المتصفح. لا يمكن التراجع.'), confirmText: L('Delete everything', 'حذف كل شيء'), danger: true }))) return;
          try { await db.clearAll(); count = 0; toast(L('All project data cleared.', 'تم مسح كل بيانات المشاريع.'), 'success'); rerender(); } catch (e) { toast(e.message, 'error'); }
        } }, icon('trash-2'), L('Clear all project data', 'مسح كل بيانات المشاريع'))),
      h('div', { class: 'card setting' }, h('h3', null, L('About', 'حول')), h('p', null, 'PRINTY ' + L('version ', 'الإصدار ') + VERSION), h('p', { class: 'muted' }, L('Create. Edit. Print. — a free, private creative studio that runs entirely in your browser.', 'أنشئ. حرّر. اطبع. — استوديو إبداعي مجاني وخاص يعمل بالكامل داخل متصفحك.')), h('a', { href: '#/about' }, L('Learn more', 'اعرف المزيد'))));
    refreshIcons();
  }
  const clampN = (v) => Math.min(60, Math.max(1, parseInt(v) || 5));
  rerender(); root.append(box);
  return null;
}
