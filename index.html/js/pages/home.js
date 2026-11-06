import { L } from '../core.js';
import { h, icon, refreshIcons } from '../util.js';
import * as db from '../db.js';
import { TEMPLATES } from '../templates-data.js';
import { templateCard, observePreviews } from './templates.js';

export async function mount(root) {
  const feat = (ic, href, en, ar, den, dar) => h('a', { class: 'card feature', href }, h('div', { class: 'f-ic' }, icon(ic)), h('h3', null, L(en, ar)), h('p', { class: 'muted' }, L(den, dar)));
  let recents = []; try { recents = (await db.listProjects()).slice(0, 4); } catch { /* storage unavailable */ }
  const tpls = h('div', { class: 'grid cards tpls' }, TEMPLATES.slice(0, 6).map(templateCard));
  const step = (n, en, ar, den, dar) => h('li', { class: 'step' }, h('span', { class: 'num' }, String(n)), h('div', null, h('h3', null, L(en, ar)), h('p', { class: 'muted' }, L(den, dar))));
  root.append(
    h('section', { class: 'hero' }, h('div', { class: 'hero-in' },
      h('span', { class: 'badge' }, L('Create. Edit. Print.', 'أنشئ. حرّر. اطبع.')),
      h('h1', null, L('Your ideas. Your canvas.', 'أفكارك. لوحتك.')),
      h('p', { class: 'lead' }, L('PRINTY is a free creative studio in your browser: design posters and cards, edit photos, prepare files for print and optimise images. No sign-up, and your files never leave your device.', 'PRINTY استوديو إبداعي مجاني داخل متصفحك: صمّم الملصقات والبطاقات، حرّر الصور، جهّز الملفات للطباعة وحسّن الصور. بدون تسجيل، وملفاتك لا تغادر جهازك.')),
      h('div', { class: 'btn-row center' }, h('a', { class: 'btn primary lg', href: '#/studio' }, L('Start Creating', 'ابدأ الإبداع')), h('a', { class: 'btn lg', href: '#/templates' }, L('Explore Templates', 'استكشف القوالب'))))),
    h('section', { class: 'page' }, h('div', { class: 'grid features' },
      feat('palette', '#/studio', 'Design Studio', 'استوديو التصميم', 'Layered canvas editor with text, shapes, images and PDF export.', 'محرر لوحات بطبقات مع نصوص وأشكال وصور وتصدير PDF.'),
      feat('sliders-horizontal', '#/photo', 'Photo Editor', 'محرر الصور', 'Crop, adjust, filter and annotate photos at full resolution.', 'قصّ وعدّل وطبّق الفلاتر وأضف تعليقات بدقة كاملة.'),
      feat('printer', '#/print', 'Print Center', 'مركز الطباعة', 'Paper sizes, margins, bleed, resolution checks and print-ready PDF.', 'مقاسات الورق والهوامش والقص وفحص الدقة وPDF جاهز للطباعة.'),
      feat('wand-sparkles', '#/tools', 'Image Tools', 'أدوات الصور', 'Compress, resize, convert and extract colours in batches.', 'ضغط وتغيير حجم وتحويل واستخراج ألوان لعدة صور.'),
      feat('eraser', '#/removebg', 'Background Editor', 'محرر الخلفية', 'Manual background removal with colour tolerance and brushes.', 'إزالة يدوية للخلفية بالتسامح اللوني والفرشاة.'))),
    h('section', { class: 'page' }, h('div', { class: 'row between' }, h('h2', null, L('Popular templates', 'قوالب شائعة')), h('a', { class: 'btn sm', href: '#/templates' }, L('All templates', 'كل القوالب'))), tpls),
    h('section', { class: 'page' }, h('div', { class: 'row between' }, h('h2', null, L('Recent projects', 'المشاريع الأخيرة')), h('a', { class: 'btn sm', href: '#/projects' }, L('All projects', 'كل المشاريع'))),
      recents.length ? h('div', { class: 'grid cards' }, recents.map(p => h('a', { class: 'card proj', href: '#/studio?id=' + p.id }, p.thumb ? h('img', { src: p.thumb, alt: '', loading: 'lazy' }) : h('div', { class: 'thumb-ph' }), h('strong', null, p.name), h('span', { class: 'muted small' }, new Date(p.updated).toLocaleDateString()))))
        : h('div', { class: 'empty' }, icon('folder-open'), h('h3', null, L('No projects yet', 'لا توجد مشاريع بعد')), h('p', null, L('Your saved designs will appear here.', 'ستظهر تصاميمك المحفوظة هنا.')), h('a', { class: 'btn primary', href: '#/studio' }, L('Create your first design', 'أنشئ أول تصميم')))),
    h('section', { class: 'page' }, h('h2', null, L('How it works', 'كيف يعمل')), h('ol', { class: 'steps' },
      step(1, 'Choose', 'اختر', 'Start from a blank canvas or an editable template.', 'ابدأ بلوحة فارغة أو قالب قابل للتعديل.'),
      step(2, 'Edit', 'حرّر', 'Add text, shapes and photos. Everything autosaves on your device.', 'أضف النصوص والأشكال والصور. كل شيء يُحفظ تلقائياً على جهازك.'),
      step(3, 'Print or share', 'اطبع أو شارك', 'Export PNG, JPG or PDF, or print directly from the Print Center.', 'صدّر PNG أو JPG أو PDF، أو اطبع مباشرة من مركز الطباعة.'))),
    h('section', { class: 'page' }, h('div', { class: 'note big' }, icon('shield-check'), h('p', null, L('Private by design: all processing happens in your browser. Projects are stored locally on this device and do not sync between devices.', 'خصوصية بالتصميم: تتم كل المعالجة داخل متصفحك. تُحفظ المشاريع محلياً على هذا الجهاز ولا تتزامن بين الأجهزة.')))));
  refreshIcons();
  const stop = observePreviews(root);
  return () => stop();
}
