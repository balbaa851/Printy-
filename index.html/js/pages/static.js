import { L } from '../core.js';
import { CONFIG } from '../config.js';
import { h, icon, refreshIcons, toast, copyText } from '../util.js';

const P = (en, ar) => h('p', null, L(en, ar));
const H2 = (en, ar) => h('h2', null, L(en, ar));
const LI = (en, ar) => h('li', null, L(en, ar));

const pages = {
  about: () => [h('h1', null, L('About PRINTY', 'حول PRINTY')),
    P('PRINTY is a simple, powerful creative studio that runs directly in your browser. It brings together a layered Design Studio, a Photo Editor, a manual Background Editor, a Template Library, a Print Center and a set of Image Tools.', 'PRINTY استوديو إبداعي بسيط وقوي يعمل مباشرة في متصفحك. يجمع بين استوديو تصميم بطبقات، ومحرر صور، ومحرر يدوي للخلفيات، ومكتبة قوالب، ومركز طباعة، وأدوات للصور.'),
    H2('Built for privacy', 'مصمم للخصوصية'),
    P('Everything is processed on your device. There is no account, no server that receives your images, and no tracking of your files.', 'تتم كل المعالجة على جهازك. لا يوجد حساب ولا خادم يستقبل صورك ولا تتبع لملفاتك.'),
    H2('Honest tools', 'أدوات صادقة'),
    P('Background removal in PRINTY is a manual tool (colour tolerance and brushes). It is not an AI cutout, because AI models need a model download or an online service.', 'إزالة الخلفية في PRINTY أداة يدوية (تسامح لوني وفرشاة). وهي ليست قصاً بالذكاء الاصطناعي لأن النماذج تحتاج إلى تنزيل أو خدمة عبر الإنترنت.'),
    h('a', { class: 'btn primary', href: '#/studio' }, L('Start creating', 'ابدأ الإبداع'))],
  privacy: () => [h('h1', null, L('Privacy Policy', 'سياسة الخصوصية')),
    P('PRINTY is designed so that your files stay on your device.', 'صُمم PRINTY بحيث تبقى ملفاتك على جهازك.'),
    H2('What we do not do', 'ما لا نفعله'),
    h('ul', null, LI('We do not upload your images, designs or exports to any server.', 'لا نرفع صورك أو تصاميمك أو ملفاتك المصدّرة إلى أي خادم.'), LI('We do not require an account or collect personal information.', 'لا نشترط حساباً ولا نجمع معلومات شخصية.'), LI('We do not run advertising or analytics scripts in the app.', 'لا نشغّل إعلانات أو سكربتات تحليلات داخل التطبيق.')),
    H2('What is stored on your device', 'ما يُخزَّن على جهازك'),
    h('ul', null, LI('Projects (design data, embedded images and thumbnails) are stored in your browser using IndexedDB, or localStorage if IndexedDB is unavailable.', 'تُخزَّن المشاريع (بيانات التصميم والصور المضمّنة والصور المصغرة) في متصفحك عبر IndexedDB أو localStorage عند عدم توفرها.'),
      LI('Your preferences (language, theme, autosave) are stored in localStorage.', 'تُخزَّن تفضيلاتك (اللغة والسمة والحفظ التلقائي) في localStorage.'),
      LI('This data does not sync between devices or browsers. Clearing your browser data, or using Settings → Clear local project data, permanently deletes it.', 'لا تتزامن هذه البيانات بين الأجهزة أو المتصفحات. مسح بيانات المتصفح أو استخدام الإعدادات ← مسح بيانات المشاريع يحذفها نهائياً.')),
    H2('Third-party resources', 'موارد من أطراف ثالثة'),
    P('To work, the app loads fonts from Google Fonts and code libraries (Fabric.js, and JSZip for ZIP downloads) from public CDNs, unless the site operator has bundled them. Your browser contacts those hosts to download these files, which may expose your IP address to them. Your images and designs are never sent to them.', 'لكي يعمل التطبيق، يحمّل الخطوط من Google Fonts والمكتبات البرمجية (Fabric.js وjsPDF وJSZip وLucide) من شبكات CDN عامة ما لم يكن مشغّل الموقع قد ضمّنها. يتصل متصفحك بهذه الجهات لتنزيل الملفات، وقد يكشف ذلك عنوان IP لها. لا تُرسل صورك أو تصاميمك إليها أبداً.'),
    P('The site host may keep standard server logs of page requests, as any web host does.', 'قد يحتفظ مضيف الموقع بسجلات خادم قياسية لطلبات الصفحات كأي استضافة ويب.')],
  terms: () => [h('h1', null, L('Terms of Use', 'شروط الاستخدام')),
    P('By using PRINTY you agree to these terms.', 'باستخدامك PRINTY فإنك توافق على هذه الشروط.'),
    h('ul', null, LI('PRINTY is provided free and "as is", without warranties of any kind.', 'يُقدَّم PRINTY مجاناً و"كما هو" دون أي ضمانات.'),
      LI('You keep all rights to the images and designs you create. You are responsible for having the right to use any images you import.', 'تحتفظ بكل حقوق الصور والتصاميم التي تنشئها. أنت مسؤول عن امتلاك حق استخدام أي صور تستوردها.'),
      LI('Template designs included in PRINTY are original and may be used freely in your own work.', 'تصاميم القوالب المضمّنة في PRINTY أصلية ويمكنك استخدامها بحرية في أعمالك.'),
      LI('Projects are stored only in your browser and can be lost if you clear browser data or lose the device. Export important work and keep your own backups.', 'تُحفظ المشاريع في متصفحك فقط وقد تُفقد عند مسح بيانات المتصفح أو فقدان الجهاز. صدّر أعمالك المهمة واحتفظ بنسخ احتياطية.'),
      LI('To the extent permitted by law, the operators are not liable for data loss or damages arising from use of the app.', 'بالقدر الذي يسمح به القانون، لا يتحمل المشغّلون مسؤولية فقدان البيانات أو الأضرار الناتجة عن استخدام التطبيق.'),
      LI('Do not use the app for unlawful purposes.', 'لا تستخدم التطبيق لأغراض غير قانونية.'))],
  contact: () => {
    const msg = h('textarea', { class: 'input', rows: 6, maxlength: 2000, 'aria-label': L('Your message', 'رسالتك') });
    const sub = h('input', { class: 'input', maxlength: 120, 'aria-label': L('Subject', 'الموضوع'), value: L('PRINTY feedback', 'ملاحظات حول PRINTY') });
    const send = () => {
      if (!msg.value.trim()) { toast(L('Please write a message first.', 'يرجى كتابة رسالة أولاً.'), 'error'); return msg.focus(); }
      if (CONFIG.contactEmail) location.href = 'mailto:' + CONFIG.contactEmail + '?subject=' + encodeURIComponent(sub.value) + '&body=' + encodeURIComponent(msg.value);
      else copyText(sub.value + '\n\n' + msg.value);
    };
    return [h('h1', null, L('Contact', 'اتصل بنا')),
      P('Questions or feedback? Write your message below.', 'لديك سؤال أو ملاحظة؟ اكتب رسالتك أدناه.'),
      CONFIG.contactEmail ? P('This opens your own email app; nothing is sent through this website.', 'يفتح هذا تطبيق البريد لديك؛ لا يُرسل شيء عبر هذا الموقع.') : P('No contact email is configured for this installation, so the button copies your message to the clipboard.', 'لم يُضبط بريد تواصل لهذا التثبيت، لذا يقوم الزر بنسخ رسالتك إلى الحافظة.'),
      h('label', { class: 'field' }, h('span', null, L('Subject', 'الموضوع')), sub), h('label', { class: 'field' }, h('span', null, L('Message', 'الرسالة')), msg),
      h('button', { class: 'btn primary', onclick: send }, icon(CONFIG.contactEmail ? 'mail' : 'copy'), CONFIG.contactEmail ? L('Open email app', 'فتح تطبيق البريد') : L('Copy message', 'نسخ الرسالة')),
      CONFIG.repoUrl ? h('p', null, h('a', { href: CONFIG.repoUrl, target: '_blank', rel: 'noopener noreferrer' }, L('Project repository', 'مستودع المشروع'))) : null];
  }
};
export async function mount(root, params, ctx) {
  root.append(h('article', { class: 'page narrow prose' }, ...pages[ctx.route]()));
  refreshIcons(); return null;
}
