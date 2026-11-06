// Original template definitions (no third-party assets) + lightweight preview renderer.
// Element DSL: rect, circle, line, text. Text can be {en, ar}.
const tx = (en, ar, x, y, w, size, fill, o = {}) => ({ t: 'text', en, ar, x, y, w, size, fill, ...o });
const rc = (x, y, w, h, fill, o = {}) => ({ t: 'rect', x, y, w, h, fill, ...o });
const ci = (cx, cy, r, fill, o = {}) => ({ t: 'circle', cx, cy, r, fill, ...o });
const ln = (x1, y1, x2, y2, stroke, sw = 2) => ({ t: 'line', x1, y1, x2, y2, stroke, sw });
const V = '#7c3aed', D = '#111827', G = '#6b7280';
const SERIF = { en: 'Playfair Display', ar: 'Amiri' }, SANS = { en: 'Inter', ar: 'Cairo' }, DISP = { en: 'Montserrat', ar: 'Cairo' };

function grid(x0, y0, cw, rh, cols, rows, stroke, head, bodyFill) {
  const out = [];
  out.push(rc(x0, y0, cw * cols, rh, head));
  for (let r = 0; r <= rows; r++) out.push(ln(x0, y0 + rh * r, x0 + cw * cols, y0 + rh * r, stroke, 1));
  for (let c = 0; c <= cols; c++) out.push(ln(x0 + cw * c, y0, x0 + cw * c, y0 + rh * rows, stroke, 1));
  if (bodyFill) out.unshift(rc(x0, y0 + rh, cw * cols, rh * (rows - 1), bodyFill));
  return out;
}
const DAYS = [['Mon', 'الاثنين'], ['Tue', 'الثلاثاء'], ['Wed', 'الأربعاء'], ['Thu', 'الخميس'], ['Fri', 'الجمعة'], ['Sat', 'السبت'], ['Sun', 'الأحد']];
const timetable = () => {
  const els = [tx('Study Timetable', 'جدول المذاكرة', 60, 40, 1000, 44, D, { f: DISP, bold: 1 }), tx('Semester plan', 'خطة الفصل الدراسي', 60, 96, 600, 20, G, { f: SANS })];
  const x0 = 60, y0 = 150, cw = 140, rh = 62, cols = 7, rows = 9;
  els.push(...grid(x0, y0, cw, rh, cols, rows, '#d1d5db', V));
  for (let r = 1; r < rows; r++) if (r % 2 === 0) els.splice(2, 0, rc(x0, y0 + rh * r, cw * cols, rh, '#f5f3ff'));
  DAYS.forEach((d, i) => els.push(tx(d[0], d[1], x0 + cw * i, y0 + 18, cw, 22, '#ffffff', { f: SANS, bold: 1, align: 'center' })));
  for (let r = 1; r < rows; r++) els.push(tx((7 + r) + ':00', (7 + r) + ':00', x0 + 8, y0 + rh * r + 20, 90, 16, G, { f: SANS }));
  return els;
};
const planner = () => {
  const els = [rc(0, 0, 794, 150, V), tx('Weekly Planner', 'المخطط الأسبوعي', 50, 40, 694, 52, '#ffffff', { f: DISP, bold: 1 }),
    tx('Week of: ____________', 'الأسبوع: ____________', 50, 104, 500, 22, '#ede9fe', { f: SANS })];
  DAYS.forEach((d, i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 50 + col * 360, y = 180 + row * 215, w = i === 6 ? 694 : 334;
    els.push(rc(x, y, w, 195, '#f9fafb', { stroke: '#e5e7eb', sw: 1, rx: 12 }), tx(d[0], d[1], x + 16, y + 12, w - 32, 22, V, { f: SANS, bold: 1 }));
    for (let k = 1; k <= 4; k++) els.push(ln(x + 16, y + 38 + k * 36, x + w - 16, y + 38 + k * 36, '#e5e7eb', 1));
  });
  return els;
};

export const CATEGORIES = [
  ['certificate', 'Certificates', 'الشهادات'], ['birthday', 'Birthday', 'أعياد الميلاد'], ['event', 'Events', 'الفعاليات'], ['poster', 'Posters', 'الملصقات'],
  ['business', 'Business', 'الأعمال'], ['resume', 'Resumes', 'السير الذاتية'], ['timetable', 'Timetables', 'الجداول'], ['planner', 'Planners', 'المخططات'],
  ['social', 'Social media', 'التواصل الاجتماعي'], ['card', 'Greeting cards', 'بطاقات التهنئة']
];

export const TEMPLATES = [
  { id: 'cert-classic', cat: 'certificate', w: 1123, h: 794, bg: '#fffdf7', title: ['Classic Certificate', 'شهادة كلاسيكية'], els: [
    rc(30, 30, 1063, 734, 'transparent', { stroke: '#b08d57', sw: 6 }), rc(50, 50, 1023, 694, 'transparent', { stroke: '#b08d57', sw: 2 }),
    tx('CERTIFICATE', 'شهادة', 100, 120, 923, 64, '#1f2937', { f: SERIF, bold: 1, align: 'center', spacing: 8 }),
    tx('of Achievement', 'تقدير وإنجاز', 100, 200, 923, 32, '#b08d57', { f: SERIF, italic: 1, align: 'center' }),
    tx('This certificate is proudly presented to', 'تُمنح هذه الشهادة بكل فخر إلى', 100, 290, 923, 22, G, { f: SANS, align: 'center' }),
    tx('Recipient Name', 'اسم المستلم', 100, 340, 923, 56, D, { f: SERIF, align: 'center', bold: 1 }), ln(340, 420, 783, 420, '#b08d57', 2),
    tx('in recognition of outstanding effort and dedication.', 'تقديراً للجهد المتميز والتفاني في العمل.', 150, 450, 823, 22, G, { f: SANS, align: 'center' }),
    ln(150, 640, 400, 640, D, 1), tx('Date', 'التاريخ', 150, 650, 250, 18, G, { f: SANS, align: 'center' }),
    ln(723, 640, 973, 640, D, 1), tx('Signature', 'التوقيع', 723, 650, 250, 18, G, { f: SANS, align: 'center' }),
    ci(561, 600, 44, '#b08d57'), ci(561, 600, 34, 'transparent', { stroke: '#fffdf7', sw: 2 })] },
  { id: 'cert-modern', cat: 'certificate', w: 1123, h: 794, bg: '#ffffff', title: ['Modern Certificate', 'شهادة عصرية'], els: [
    rc(0, 0, 260, 794, V), ci(130, 150, 70, '#a78bfa'), tx('2026', '2026', 30, 380, 200, 60, '#ffffff', { f: DISP, bold: 1, align: 'center' }),
    tx('Certificate of Completion', 'شهادة إتمام', 320, 110, 740, 54, D, { f: DISP, bold: 1 }),
    tx('Awarded to', 'تُمنح إلى', 320, 270, 740, 24, G, { f: SANS }), tx('Recipient Name', 'اسم المستلم', 320, 310, 740, 60, V, { f: DISP, bold: 1 }),
    tx('for successfully completing the course with distinction.', 'لإتمامه الدورة بنجاح وتميّز.', 320, 400, 700, 24, D, { f: SANS }),
    ln(320, 640, 600, 640, D, 1), tx('Instructor', 'المدرّب', 320, 650, 280, 18, G, { f: SANS })] },
  { id: 'bday-balloons', cat: 'birthday', w: 750, h: 1050, bg: '#fff7ed', title: ['Balloon Party', 'حفلة البالونات'], els: [
    ci(150, 160, 90, '#f472b6'), ci(330, 110, 70, '#60a5fa'), ci(540, 170, 95, '#fbbf24'), ci(650, 90, 50, '#34d399'),
    ln(150, 250, 250, 420, G, 2), ln(330, 180, 300, 420, G, 2), ln(540, 265, 400, 420, G, 2),
    tx("You're Invited!", 'أنتم مدعوون!', 50, 440, 650, 60, D, { f: DISP, bold: 1, align: 'center' }),
    tx('Sam turns 7', 'عيد ميلاد سامي السابع', 50, 530, 650, 40, V, { f: { en: 'Lobster', ar: 'Reem Kufi' }, align: 'center' }),
    tx('Saturday, 12 June · 4:00 PM', 'السبت ١٢ يونيو · ٤:٠٠ مساءً', 50, 650, 650, 26, D, { f: SANS, align: 'center', bold: 1 }),
    tx('123 Party Street\nBring your biggest smile!', 'شارع الاحتفال ١٢٣\nأحضروا أجمل ابتسامة!', 50, 710, 650, 22, G, { f: SANS, align: 'center', lh: 1.4 }),
    tx('RSVP by calling 000-0000', 'تأكيد الحضور على الرقم 000-0000', 50, 920, 650, 20, V, { f: SANS, align: 'center' })] },
  { id: 'bday-minimal', cat: 'birthday', w: 1080, h: 1350, bg: '#111827', title: ['Minimal Birthday', 'عيد ميلاد بسيط'], els: [
    rc(60, 60, 960, 1230, 'transparent', { stroke: '#a78bfa', sw: 3, rx: 24 }),
    tx('30', '٣٠', 100, 220, 880, 360, '#a78bfa', { f: DISP, bold: 1, align: 'center' }),
    tx('Happy Birthday', 'عيد ميلاد سعيد', 100, 640, 880, 88, '#ffffff', { f: DISP, bold: 1, align: 'center' }),
    tx('Join us for dinner and celebration', 'انضموا إلينا لعشاء واحتفال', 100, 780, 880, 34, '#d1d5db', { f: SANS, align: 'center' }),
    tx('Friday · 8 PM · Rooftop Lounge', 'الجمعة · ٨ مساءً · صالة السطح', 100, 1000, 880, 32, '#ffffff', { f: SANS, align: 'center', bold: 1 })] },
  { id: 'event-gala', cat: 'event', w: 794, h: 1123, bg: '#0f172a', title: ['Gala Evening', 'أمسية الحفل'], els: [
    ci(397, 330, 190, '#1e293b'), ci(397, 330, 130, 'transparent', { stroke: '#a78bfa', sw: 3 }),
    tx('ANNUAL', 'السنوي', 60, 250, 674, 30, '#a78bfa', { f: SANS, bold: 1, align: 'center', spacing: 10 }),
    tx('Gala Night', 'ليلة الحفل', 60, 300, 674, 80, '#ffffff', { f: SERIF, bold: 1, align: 'center' }),
    tx('You are cordially invited to an evening of music, dinner and celebration.', 'يسعدنا دعوتكم لأمسية من الموسيقى والعشاء والاحتفال.', 100, 620, 594, 26, '#cbd5e1', { f: SANS, align: 'center', lh: 1.4 }),
    ln(247, 760, 547, 760, '#a78bfa', 2),
    tx('Saturday, 20 September\n7:30 PM', 'السبت ٢٠ سبتمبر\n٧:٣٠ مساءً', 60, 790, 674, 30, '#ffffff', { f: SANS, align: 'center', bold: 1, lh: 1.5 }),
    tx('Grand Hall · Dress code: formal', 'القاعة الكبرى · الزي: رسمي', 60, 920, 674, 22, '#94a3b8', { f: SANS, align: 'center' })] },
  { id: 'event-summit', cat: 'event', w: 1080, h: 1080, bg: '#ede9fe', title: ['Design Summit', 'قمة التصميم'], els: [
    rc(0, 0, 1080, 20, V), ci(900, 200, 180, '#c4b5fd'), ci(980, 330, 90, V),
    tx('SUMMIT 2026', 'قمة ٢٠٢٦', 80, 140, 700, 28, V, { f: SANS, bold: 1, spacing: 6 }),
    tx('Design\nThinking\nLive', 'التفكير\nالتصميمي\nمباشر', 80, 220, 800, 130, D, { f: DISP, bold: 1, lh: 1 }),
    tx('Talks · Workshops · Networking', 'محاضرات · ورش عمل · تعارف', 80, 700, 800, 34, D, { f: SANS }),
    rc(80, 820, 360, 90, V, { rx: 45 }), tx('Register today', 'سجّل اليوم', 80, 846, 360, 30, '#ffffff', { f: SANS, bold: 1, align: 'center' }),
    tx('printy.example/summit', 'اكتب موقعك هنا', 80, 960, 700, 24, G, { f: SANS })] },
  { id: 'poster-bold', cat: 'poster', w: 1123, h: 1587, bg: '#fde047', title: ['Bold Poster', 'ملصق جريء'], els: [
    rc(60, 60, 1003, 1467, 'transparent', { stroke: D, sw: 10 }), ci(780, 470, 260, D), ci(780, 470, 160, '#fde047'),
    tx('LIVE\nMUSIC\nNIGHT', 'ليلة\nموسيقى\nحيّة', 110, 160, 700, 220, D, { f: DISP, bold: 1, lh: 0.95 }),
    tx('Friday 14 · Doors 8 PM', 'الجمعة ١٤ · الأبواب ٨ مساءً', 110, 1000, 900, 54, D, { f: DISP, bold: 1 }),
    ln(110, 1100, 1013, 1100, D, 6),
    tx('Three bands. One stage.\nFree entry for everyone.', 'ثلاث فرق. مسرح واحد.\nالدخول مجاني للجميع.', 110, 1140, 900, 44, D, { f: SANS, lh: 1.4 }),
    tx('The Old Warehouse · 55 River Road', 'المستودع القديم · ٥٥ شارع النهر', 110, 1420, 900, 30, D, { f: SANS, bold: 1 })] },
  { id: 'biz-sale', cat: 'business', w: 1080, h: 1080, bg: '#ffffff', title: ['Big Sale Ad', 'إعلان تخفيضات'], els: [
    rc(0, 0, 1080, 540, V), ci(920, 120, 150, '#8b5cf6'), ci(150, 520, 100, '#a78bfa'),
    tx('SEASON SALE', 'تخفيضات الموسم', 80, 120, 700, 36, '#ede9fe', { f: SANS, bold: 1, spacing: 6 }),
    tx('UP TO 50% OFF', 'خصم حتى ٥٠٪', 80, 190, 920, 110, '#ffffff', { f: DISP, bold: 1 }),
    tx('Everything in store. This week only.', 'كل ما في المتجر. هذا الأسبوع فقط.', 80, 400, 920, 34, '#ede9fe', { f: SANS }),
    tx('Fresh styles for every day', 'أناقة جديدة لكل يوم', 80, 640, 920, 64, D, { f: DISP, bold: 1 }),
    tx('Visit us in store or online. Free delivery on orders over 50.', 'زورونا في المتجر أو عبر الإنترنت. توصيل مجاني للطلبات فوق ٥٠.', 80, 740, 800, 30, G, { f: SANS, lh: 1.4 }),
    rc(80, 900, 320, 90, D, { rx: 45 }), tx('Shop now', 'تسوّق الآن', 80, 927, 320, 32, '#ffffff', { f: SANS, bold: 1, align: 'center' })] },
  { id: 'biz-flyer', cat: 'business', w: 794, h: 1123, bg: '#f9fafb', title: ['Service Flyer', 'نشرة خدمات'], els: [
    rc(0, 0, 794, 380, D), rc(0, 380, 794, 12, V),
    tx('Grow your business', 'نمِّ عملك', 60, 110, 674, 64, '#ffffff', { f: DISP, bold: 1 }),
    tx('Marketing · Branding · Web design', 'التسويق · الهوية · تصميم المواقع', 60, 250, 674, 26, '#c4b5fd', { f: SANS }),
    ...[0, 1, 2].flatMap(i => [rc(60, 450 + i * 150, 674, 120, '#ffffff', { stroke: '#e5e7eb', sw: 1, rx: 16 }), ci(120, 510 + i * 150, 28, V),
      tx(['Strategy', 'Design', 'Launch'][i], ['الاستراتيجية', 'التصميم', 'الإطلاق'][i], 170, 478 + i * 150, 540, 28, D, { f: SANS, bold: 1 }),
      tx('Clear plans that fit your goals and budget.', 'خطط واضحة تناسب أهدافك وميزانيتك.', 170, 520 + i * 150, 540, 20, G, { f: SANS })]),
    tx('hello@yourbusiness.com · +00 000 000 000', 'info@yourbusiness.com · ‎+00 000 000 000', 60, 1030, 674, 22, D, { f: SANS, bold: 1, align: 'center' })] },
  { id: 'resume-classic', cat: 'resume', w: 794, h: 1123, bg: '#ffffff', title: ['Classic Resume', 'سيرة ذاتية كلاسيكية'], els: [
    rc(0, 0, 260, 1123, '#1f2937'), ci(130, 120, 70, '#7c3aed'),
    tx('CONTACT', 'التواصل', 30, 250, 200, 16, '#a78bfa', { f: SANS, bold: 1, spacing: 3 }),
    tx('name@email.com\n+00 000 000 000\nYour City', 'name@email.com\n‎+00 000 000 000\nمدينتك', 30, 280, 210, 15, '#e5e7eb', { f: SANS, lh: 1.7 }),
    tx('SKILLS', 'المهارات', 30, 420, 200, 16, '#a78bfa', { f: SANS, bold: 1, spacing: 3 }),
    tx('Communication\nProject planning\nTeamwork\nProblem solving', 'التواصل\nتخطيط المشاريع\nالعمل الجماعي\nحل المشكلات', 30, 450, 210, 15, '#e5e7eb', { f: SANS, lh: 1.8 }),
    tx('Your Name', 'اسمك', 300, 60, 450, 48, D, { f: DISP, bold: 1 }), tx('Professional Title', 'المسمى الوظيفي', 300, 120, 450, 22, V, { f: SANS, bold: 1 }),
    ln(300, 170, 750, 170, '#e5e7eb', 2),
    tx('PROFILE', 'نبذة', 300, 195, 450, 16, V, { f: SANS, bold: 1, spacing: 3 }),
    tx('A short summary of your experience, strengths and what you are looking for.', 'ملخص قصير عن خبراتك ونقاط قوتك وما تبحث عنه.', 300, 225, 450, 16, D, { f: SANS, lh: 1.6 }),
    tx('EXPERIENCE', 'الخبرة', 300, 330, 450, 16, V, { f: SANS, bold: 1, spacing: 3 }),
    tx('Job Title — Company\n2022 – Present\nDescribe your main responsibilities and results.', 'المسمى — الشركة\n٢٠٢٢ – الآن\nصف مهامك الرئيسية ونتائجك.', 300, 360, 450, 16, D, { f: SANS, lh: 1.6 }),
    tx('Job Title — Company\n2019 – 2022\nDescribe your main responsibilities and results.', 'المسمى — الشركة\n٢٠١٩ – ٢٠٢٢\nصف مهامك الرئيسية ونتائجك.', 300, 480, 450, 16, D, { f: SANS, lh: 1.6 }),
    tx('EDUCATION', 'التعليم', 300, 640, 450, 16, V, { f: SANS, bold: 1, spacing: 3 }),
    tx('Degree — University\n2015 – 2019', 'الدرجة — الجامعة\n٢٠١٥ – ٢٠١٩', 300, 670, 450, 16, D, { f: SANS, lh: 1.6 })] },
  { id: 'resume-minimal', cat: 'resume', w: 794, h: 1123, bg: '#ffffff', title: ['Minimal Resume', 'سيرة ذاتية بسيطة'], els: [
    tx('Your Name', 'اسمك', 60, 60, 674, 56, D, { f: SERIF, bold: 1 }),
    tx('Professional Title · name@email.com · +00 000 000 000', 'المسمى الوظيفي · name@email.com', 60, 130, 674, 17, G, { f: SANS }),
    rc(60, 175, 60, 5, V),
    ...[['Profile', 'نبذة', 'A concise paragraph about who you are and the value you bring.', 'فقرة موجزة عن شخصيتك والقيمة التي تقدمها.', 210],
      ['Experience', 'الخبرة', 'Job Title, Company (2021 – Present)\nA key achievement with a measurable result.', 'المسمى، الشركة (٢٠٢١ – الآن)\nإنجاز رئيسي بنتيجة قابلة للقياس.', 380],
      ['Education', 'التعليم', 'Degree, University (2017 – 2021)', 'الدرجة، الجامعة (٢٠١٧ – ٢٠٢١)', 640],
      ['Skills', 'المهارات', 'Design · Research · Writing · Presenting', 'التصميم · البحث · الكتابة · العرض', 800]]
      .flatMap(([a, b, c, d, y]) => [tx(a, b, 60, y, 674, 22, V, { f: SANS, bold: 1 }), tx(c, d, 60, y + 40, 674, 17, D, { f: SANS, lh: 1.7 })])] },
  { id: 'timetable-study', cat: 'timetable', w: 1123, h: 794, bg: '#ffffff', title: ['Study Timetable', 'جدول المذاكرة'], els: timetable() },
  { id: 'planner-weekly', cat: 'planner', w: 794, h: 1123, bg: '#ffffff', title: ['Weekly Planner', 'مخطط أسبوعي'], els: planner() },
  { id: 'social-quote', cat: 'social', w: 1080, h: 1080, bg: '#7c3aed', title: ['Quote Post', 'منشور اقتباس'], els: [
    ci(900, 180, 220, '#8b5cf6'), ci(150, 950, 150, '#6d28d9'),
    tx('“', '“', 80, 120, 200, 260, '#c4b5fd', { f: SERIF, bold: 1 }),
    tx('Make something people love.', 'اصنع شيئاً يحبه الناس.', 100, 340, 880, 100, '#ffffff', { f: DISP, bold: 1, lh: 1.1 }),
    ln(100, 760, 260, 760, '#ffffff', 5), tx('@yourhandle', '@حسابك', 100, 790, 700, 36, '#ede9fe', { f: SANS })] },
  { id: 'social-story', cat: 'social', w: 1080, h: 1920, bg: '#111827', title: ['Story Announcement', 'ستوري إعلان'], els: [
    ci(540, 560, 380, '#1f2937'), ci(540, 560, 250, V),
    tx('NEW', 'جديد', 100, 480, 880, 160, '#ffffff', { f: DISP, bold: 1, align: 'center' }),
    tx('Out now', 'متوفر الآن', 100, 1060, 880, 90, '#ffffff', { f: DISP, bold: 1, align: 'center' }),
    tx('Swipe up to explore the collection', 'اسحب للأعلى لاستكشاف المجموعة', 100, 1200, 880, 40, '#c4b5fd', { f: SANS, align: 'center' }),
    rc(290, 1560, 500, 110, V, { rx: 55 }), tx('Learn more', 'اعرف المزيد', 290, 1590, 500, 44, '#ffffff', { f: SANS, bold: 1, align: 'center' })] },
  { id: 'card-thanks', cat: 'card', w: 1050, h: 750, bg: '#fdf2f8', title: ['Thank You Card', 'بطاقة شكر'], els: [
    ci(120, 120, 160, '#fbcfe8'), ci(950, 650, 200, '#f9a8d4'), ci(900, 110, 60, '#fde68a'),
    tx('Thank You', 'شكراً لك', 100, 230, 850, 130, '#9d174d', { f: { en: 'Lobster', ar: 'Reem Kufi' }, align: 'center' }),
    tx('for your kindness and generosity.', 'على لطفك وكرمك.', 100, 420, 850, 36, '#831843', { f: SANS, align: 'center' }),
    tx('With love, Your Name', 'مع المحبة، اسمك', 100, 540, 850, 30, '#9d174d', { f: SANS, align: 'center', italic: 1 })] },
  { id: 'card-holiday', cat: 'card', w: 750, h: 1050, bg: '#0f766e', title: ['Holiday Greeting', 'تهنئة بالعيد'], els: [
    ci(375, 330, 200, '#115e59'), ci(375, 330, 150, '#fbbf24'), ci(375, 330, 110, '#0f766e'),
    tx('Season’s\nGreetings', 'أجمل\nالتهاني', 50, 560, 650, 90, '#ffffff', { f: SERIF, bold: 1, align: 'center', lh: 1.1 }),
    tx('Wishing you peace, joy and good health.', 'نتمنى لكم السلام والفرح والصحة.', 100, 790, 550, 28, '#ccfbf1', { f: SANS, align: 'center', lh: 1.4 }),
    tx('From our family to yours', 'من عائلتنا إلى عائلتكم', 50, 920, 650, 24, '#fbbf24', { f: SANS, align: 'center', bold: 1 })] }
];
export const getTemplate = (id) => TEMPLATES.find(t => t.id === id);
export const tplTitle = (t, ar) => (ar ? t.title[1] : t.title[0]);
export const elText = (e, ar) => (ar && e.ar != null ? e.ar : e.en);
export const elFont = (e, ar) => (e.f ? (ar ? e.f.ar : e.f.en) : (ar ? 'Cairo' : 'Inter'));

// ---- lightweight preview renderer (no Fabric needed) ----
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}
export function drawTemplate(canvas, tpl, ar, targetW) {
  const k = targetW / tpl.w;
  canvas.width = Math.round(tpl.w * k); canvas.height = Math.round(tpl.h * k);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tpl.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.scale(k, k);
  for (const e of tpl.els) {
    if (e.t === 'rect') {
      ctx.beginPath();
      if (e.rx && ctx.roundRect) ctx.roundRect(e.x, e.y, e.w, e.h, e.rx); else ctx.rect(e.x, e.y, e.w, e.h);
      if (e.fill && e.fill !== 'transparent') { ctx.fillStyle = e.fill; ctx.fill(); }
      if (e.stroke) { ctx.strokeStyle = e.stroke; ctx.lineWidth = e.sw || 1; ctx.stroke(); }
    } else if (e.t === 'circle') {
      ctx.beginPath(); ctx.arc(e.cx, e.cy, e.r, 0, Math.PI * 2);
      if (e.fill && e.fill !== 'transparent') { ctx.fillStyle = e.fill; ctx.fill(); }
      if (e.stroke) { ctx.strokeStyle = e.stroke; ctx.lineWidth = e.sw || 1; ctx.stroke(); }
    } else if (e.t === 'line') {
      ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.strokeStyle = e.stroke; ctx.lineWidth = e.sw; ctx.stroke();
    } else if (e.t === 'text') {
      ctx.font = `${e.italic ? 'italic ' : ''}${e.bold ? 700 : 400} ${e.size}px "${elFont(e, ar)}", sans-serif`;
      ctx.fillStyle = e.fill; ctx.textBaseline = 'top';
      ctx.direction = ar ? 'rtl' : 'ltr';
      let al = e.align || 'left'; if (ar && al === 'left') al = 'right';
      const lines = wrap(ctx, elText(e, ar), e.w); const lh = e.size * (e.lh || 1.16);
      ctx.textAlign = al;
      const x = al === 'center' ? e.x + e.w / 2 : al === 'right' ? e.x + e.w : e.x;
      lines.forEach((ln_, i) => ctx.fillText(ln_, x, e.y + i * lh));
    }
  }
  ctx.restore();
}

// ---- Extra template packs: 12 designs x 7 colour palettes, generated from the same element DSL.
const PAL = [
  { bg: '#fff7ed', pr: '#ea580c', ac: '#fbbf24', tc: '#1f2937', on: '#ffffff', n: 'Sunset', a: 'غروب' },
  { bg: '#ecfeff', pr: '#0891b2', ac: '#67e8f9', tc: '#0f172a', on: '#ffffff', n: 'Ocean', a: 'محيط' },
  { bg: '#f0fdf4', pr: '#16a34a', ac: '#86efac', tc: '#14532d', on: '#ffffff', n: 'Forest', a: 'غابة' },
  { bg: '#fdf2f8', pr: '#db2777', ac: '#f9a8d4', tc: '#500724', on: '#ffffff', n: 'Rose', a: 'وردي' },
  { bg: '#0f172a', pr: '#a78bfa', ac: '#f472b6', tc: '#f8fafc', on: '#0f172a', n: 'Midnight', a: 'ليلي' },
  { bg: '#fefce8', pr: '#ca8a04', ac: '#fde047', tc: '#422006', on: '#ffffff', n: 'Gold', a: 'ذهبي' },
  { bg: '#111827', pr: '#34d399', ac: '#fbbf24', tc: '#f9fafb', on: '#0f172a', n: 'Neon', a: 'نيون' }
];
CATEGORIES.push(['invitation', 'Invitations', 'الدعوات'], ['bizcard', 'Business cards', 'بطاقات الأعمال'], ['thumbnail', 'Thumbnails', 'صور مصغرة'], ['menu', 'Menus', 'قوائم الطعام']);
const mkT = (id, cat, w, h, p, en, ar, els) => ({ id, cat, w, h, bg: p.bg, title: [p.n + ' ' + en, p.a + ' ' + ar], els });
const GENS = [
  ['cert', (p, n) => mkT('cert-' + n, 'certificate', 1123, 794, p, 'Certificate', 'شهادة', [
    rc(24, 24, 1075, 746, 'transparent', { stroke: p.pr, sw: 8 }), rc(48, 48, 1027, 698, 'transparent', { stroke: p.ac, sw: 2 }),
    ci(48, 48, 16, p.pr), ci(1075, 48, 16, p.pr), ci(48, 746, 16, p.pr), ci(1075, 746, 16, p.pr),
    tx('CERTIFICATE', 'شهادة', 100, 120, 923, 64, p.tc, { f: SERIF, bold: 1, align: 'center', spacing: 8 }), tx('of Appreciation', 'شكر وتقدير', 100, 200, 923, 32, p.pr, { f: SERIF, italic: 1, align: 'center' }),
    tx('Proudly presented to', 'تُقدَّم بكل فخر إلى', 100, 290, 923, 22, p.tc, { f: SANS, align: 'center' }), tx('Recipient Name', 'اسم المستلم', 100, 340, 923, 56, p.tc, { f: SERIF, bold: 1, align: 'center' }), ln(340, 420, 783, 420, p.pr, 2),
    tx('in recognition of outstanding contribution and effort.', 'تقديراً للمساهمة والجهد المتميز.', 150, 450, 823, 22, p.tc, { f: SANS, align: 'center' }),
    ln(150, 640, 400, 640, p.tc, 1), tx('Date', 'التاريخ', 150, 650, 250, 18, p.tc, { f: SANS, align: 'center' }), ln(723, 640, 973, 640, p.tc, 1), tx('Signature', 'التوقيع', 723, 650, 250, 18, p.tc, { f: SANS, align: 'center' }),
    ci(561, 600, 44, p.pr), ci(561, 600, 34, 'transparent', { stroke: p.bg, sw: 2 })])],
  ['bday', (p, n) => mkT('bday-' + n, 'birthday', 750, 1050, p, 'Birthday', 'عيد ميلاد', [
    ci(140, 170, 90, p.pr), ci(320, 110, 70, p.ac), ci(540, 170, 95, p.pr), ci(650, 80, 50, p.ac), ln(140, 260, 250, 420, p.tc, 2), ln(540, 265, 440, 420, p.tc, 2),
    tx('HAPPY', 'كل عام', 60, 470, 630, 70, p.tc, { f: DISP, bold: 1, align: 'center' }), tx('BIRTHDAY!', 'وأنت بخير!', 60, 550, 630, 88, p.pr, { f: DISP, bold: 1, align: 'center' }),
    tx('Name Here', 'الاسم هنا', 60, 690, 630, 52, p.tc, { f: SERIF, italic: 1, align: 'center' }), rc(175, 800, 400, 70, p.pr, { rx: 35 }),
    tx('Join the party!', 'انضم للحفلة!', 175, 818, 400, 28, p.on, { f: SANS, bold: 1, align: 'center' }), tx('Saturday · 6 PM · Your address', 'السبت · 6 مساءً · العنوان', 60, 920, 630, 22, p.tc, { f: SANS, align: 'center' })])],
  ['quote', (p, n) => mkT('quote-' + n, 'social', 1080, 1080, p, 'Quote Post', 'منشور اقتباس', [
    ci(130, 130, 220, p.pr), ci(960, 980, 150, p.ac), tx('“', '“', 80, 120, 200, 260, p.on, { f: SERIF, bold: 1 }),
    tx('Your inspiring quote goes right here.', 'اكتب اقتباسك الملهم هنا.', 110, 380, 860, 70, p.tc, { f: SERIF, bold: 1, lh: 1.25 }), ln(110, 800, 330, 800, p.pr, 6), tx('— Author Name', '— اسم الكاتب', 110, 830, 700, 30, p.pr, { f: SANS, bold: 1 })])],
  ['story', (p, n) => mkT('story-' + n, 'social', 1080, 1920, p, 'Story', 'ستوري', [
    ci(900, 260, 330, p.pr), ci(120, 1650, 260, p.ac), tx('NEW', 'جديد', 90, 560, 900, 150, p.pr, { f: DISP, bold: 1 }), tx('Collection', 'المجموعة', 90, 720, 900, 120, p.tc, { f: DISP, bold: 1 }),
    tx('Fresh arrivals are here. Swipe up to explore.', 'وصلت المنتجات الجديدة. اسحب للأعلى للاستكشاف.', 90, 900, 760, 44, p.tc, { f: SANS, lh: 1.3 }), rc(90, 1180, 520, 110, p.pr, { rx: 55 }), tx('Shop now', 'تسوّق الآن', 90, 1210, 520, 48, p.on, { f: SANS, bold: 1, align: 'center' })])],
  ['poster', (p, n) => mkT('poster-' + n, 'poster', 1123, 1587, p, 'Poster', 'ملصق', [
    rc(0, 1100, 1123, 487, p.pr), ci(850, 420, 280, p.ac), ci(850, 420, 190, p.pr), tx('BIG', 'حدث', 80, 180, 900, 220, p.tc, { f: DISP, bold: 1 }), tx('EVENT', 'كبير', 80, 410, 900, 220, p.pr, { f: DISP, bold: 1 }),
    tx('A short line that describes your event or message.', 'سطر قصير يصف فعاليتك أو رسالتك.', 80, 720, 700, 40, p.tc, { f: SANS, lh: 1.3 }), tx('12 · 06 · 2026', '12 · 06 · 2026', 80, 1180, 900, 80, p.on, { f: DISP, bold: 1 }), tx('Venue name · City · yourwebsite.com', 'المكان · المدينة · موقعك', 80, 1300, 900, 30, p.on, { f: SANS })])],
  ['sale', (p, n) => mkT('sale-' + n, 'business', 1080, 1080, p, 'Sale Ad', 'إعلان تخفيضات', [
    ci(760, 440, 330, p.pr), ci(760, 440, 300, 'transparent', { stroke: p.bg, sw: 4 }), tx('50%', '50%', 460, 330, 600, 190, p.on, { f: DISP, bold: 1, align: 'center' }), tx('OFF', 'خصم', 460, 520, 600, 80, p.on, { f: DISP, bold: 1, align: 'center' }),
    tx('MEGA', 'تخفيضات', 70, 140, 560, 100, p.tc, { f: DISP, bold: 1 }), tx('SALE', 'كبرى', 70, 250, 560, 130, p.pr, { f: DISP, bold: 1 }), tx('This weekend only. Limited stock.', 'نهاية هذا الأسبوع فقط. الكمية محدودة.', 70, 430, 520, 34, p.tc, { f: SANS, lh: 1.3 }),
    rc(70, 860, 420, 100, p.ac, { rx: 50 }), tx('Shop now', 'تسوّق الآن', 70, 888, 420, 44, '#111827', { f: SANS, bold: 1, align: 'center' })])],
  ['flyer', (p, n) => mkT('flyer-' + n, 'business', 794, 1123, p, 'Flyer', 'نشرة', [
    rc(0, 0, 794, 330, p.pr), ci(700, 60, 120, p.ac), tx('Your Business', 'عملك التجاري', 60, 100, 674, 64, p.on, { f: DISP, bold: 1 }), tx('Professional services you can trust', 'خدمات احترافية يمكنك الوثوق بها', 60, 190, 560, 28, p.on, { f: SANS }),
    ...[0, 1, 2].flatMap(i => [rc(50 + i * 233, 400, 211, 280, 'transparent', { stroke: p.pr, sw: 3, rx: 16 }), ci(155 + i * 233, 470, 36, p.ac), tx('Service ' + (i + 1), 'خدمة ' + (i + 1), 60 + i * 233, 530, 191, 24, p.tc, { f: SANS, bold: 1, align: 'center' }), tx('A short description of this service.', 'وصف قصير لهذه الخدمة.', 66 + i * 233, 575, 179, 17, p.tc, { f: SANS, align: 'center' })]),
    tx('Special offer: 20% off your first order', 'عرض خاص: خصم 20% على طلبك الأول', 60, 750, 674, 34, p.pr, { f: SANS, bold: 1, align: 'center' }), rc(0, 960, 794, 163, p.pr), tx('+000 000 0000  ·  hello@yourbrand.com', '+000 000 0000  ·  hello@yourbrand.com', 60, 1020, 674, 26, p.on, { f: SANS, align: 'center' })])],
  ['invite', (p, n) => mkT('invite-' + n, 'invitation', 750, 1050, p, 'Invitation', 'دعوة', [
    rc(30, 30, 690, 990, 'transparent', { stroke: p.pr, sw: 4, rx: 10 }), rc(50, 50, 650, 950, 'transparent', { stroke: p.ac, sw: 1.5, rx: 6 }), ci(375, 190, 60, p.pr), ci(375, 190, 46, 'transparent', { stroke: p.on, sw: 2 }),
    tx('YOU ARE INVITED', 'أنتم مدعوون', 80, 330, 590, 28, p.pr, { f: SANS, bold: 1, align: 'center', spacing: 6 }), tx('Celebration Name', 'اسم المناسبة', 80, 400, 590, 76, p.tc, { f: SERIF, bold: 1, align: 'center', lh: 1.15 }),
    ln(275, 610, 475, 610, p.pr, 2), tx('Saturday, 12 June 2026', 'السبت، 12 يونيو 2026', 80, 650, 590, 30, p.tc, { f: SANS, align: 'center' }), tx('7:00 PM', '7:00 مساءً', 80, 700, 590, 40, p.pr, { f: DISP, bold: 1, align: 'center' }),
    tx('Venue name, Street address, City', 'اسم المكان، العنوان، المدينة', 80, 790, 590, 24, p.tc, { f: SANS, align: 'center' }), tx('RSVP: +000 000 0000', 'تأكيد الحضور: +000 000 0000', 80, 900, 590, 22, p.pr, { f: SANS, bold: 1, align: 'center' })])],
  ['bcard', (p, n) => mkT('bizcard-' + n, 'bizcard', 1050, 600, p, 'Business Card', 'بطاقة أعمال', [
    rc(0, 0, 330, 600, p.pr), ci(165, 200, 70, p.on), tx('YB', 'عم', 95, 165, 140, 64, p.pr, { f: DISP, bold: 1, align: 'center' }), tx('Your Brand', 'علامتك', 20, 320, 290, 28, p.on, { f: SANS, bold: 1, align: 'center' }),
    tx('Full Name', 'الاسم الكامل', 390, 120, 600, 56, p.tc, { f: DISP, bold: 1 }), tx('Job Title', 'المسمى الوظيفي', 390, 195, 600, 28, p.pr, { f: SANS, bold: 1 }), ln(390, 260, 560, 260, p.ac, 4),
    tx('+000 000 0000', '+000 000 0000', 390, 310, 600, 26, p.tc, { f: SANS }), tx('hello@yourbrand.com', 'hello@yourbrand.com', 390, 355, 600, 26, p.tc, { f: SANS }), tx('www.yourbrand.com', 'www.yourbrand.com', 390, 400, 600, 26, p.tc, { f: SANS })])],
  ['thumb', (p, n) => mkT('thumb-' + n, 'thumbnail', 1280, 720, p, 'Thumbnail', 'صورة مصغرة', [
    rc(0, 0, 40, 720, p.pr), ci(1030, 360, 280, p.pr), ci(1030, 360, 200, p.ac), tx('EPIC', 'رائع', 90, 110, 700, 200, p.tc, { f: DISP, bold: 1 }), tx('VIDEO TITLE', 'عنوان الفيديو', 90, 320, 800, 110, p.pr, { f: DISP, bold: 1 }),
    rc(90, 520, 330, 80, p.ac, { rx: 14 }), tx('WATCH NOW', 'شاهد الآن', 90, 543, 330, 34, '#111827', { f: SANS, bold: 1, align: 'center' })])],
  ['menu', (p, n) => {
    const els = [rc(0, 0, 794, 200, p.pr), tx('RESTAURANT', 'المطعم', 60, 55, 674, 70, p.on, { f: DISP, bold: 1, align: 'center' }), tx('Fresh · Local · Delicious', 'طازج · محلي · لذيذ', 60, 140, 674, 24, p.on, { f: SANS, align: 'center' })];
    [['Starters', 'المقبلات'], ['Mains', 'الأطباق الرئيسية'], ['Desserts', 'الحلويات']].forEach(([en, ar], i) => {
      const y = 250 + i * 270; els.push(tx(en, ar, 60, y, 674, 34, p.pr, { f: SERIF, bold: 1 }), ln(60, y + 48, 734, y + 48, p.ac, 3));
      [0, 1, 2].forEach(k => els.push(tx('Dish name ' + (k + 1), 'اسم الطبق ' + (k + 1), 60, y + 70 + k * 56, 520, 24, p.tc, { f: SANS, bold: 1 }), tx('$' + (8 + i * 6 + k * 2), (8 + i * 6 + k * 2) + ' ر.س', 600, y + 70 + k * 56, 134, 24, p.pr, { f: SANS, bold: 1, align: 'right' })));
    });
    return mkT('menu-' + n, 'menu', 794, 1123, p, 'Menu', 'قائمة طعام', els);
  }]
];
GENS.forEach(([, g]) => PAL.forEach((p, i) => TEMPLATES.push(g(p, i + 1))));
