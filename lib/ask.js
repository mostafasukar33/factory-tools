/* ====================== اسأل الحسابات (شات) ======================
   مصطفى بيكتب سؤاله بكلامه (عامية مصرية)، والشات بيجاوب من بيانات الحسابات اللي على الموبايل.
   - قراية بس: مفيش أي كتابة في db ولا مزامنة ولا شيت. الأسئلة اللي مفهمهاش بس بتتحفظ متشفرة على الجهاز (askmiss).
   - كل رقم من نفس دوال التقارير والكشف والخزنة (tradeSums/profitOf/cashSums/stmtData/vaultBal/kstHtml/jrdCalc)، فالرقم = رقم الشاشة.
   - بيتحمّل لما تفتح #ask بس (loadAsk في accounts.html)، فمبيتقّلش فتح البرنامج.
   - الكلام: التطبيع (norm + ث→ت ذ→د ...) ← الفترة ← نوع السؤال (كلمات) ← الاسم (عميل/مورد/صنف/بند/خزنة/شريك/مساهم) ← الإجابة.
   - "أحمد" = حركة السوق (خزنة السوق ووارد الشريك)، "السوق" = عملاء السوق، "الموقع/المواقع" = عملاء المواقع.
   الأسئلة والألفاظ في الجداول تحت (K)، وأي لفظ جديد يتضاف هناك + سطر في اختبار "اسأل الحسابات" (tests/run.js). */
(() => {
'use strict';

/* ---------------- التطبيع ---------------- */
const FOLD = s => s.replace(/ث/g, 'ت').replace(/ذ/g, 'د').replace(/ظ/g, 'ض').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '');
const AN = s => FOLD(norm(String(s || '')).replace(/[ً-ٰٟـ]/g, ''))
  .replace(/[؟?!.,،:;"'()\[\]«»_*+=~`|<>{}…]+/g, ' ').replace(/\s+/g, ' ').trim();
const escR = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* كلمات بتتشال قبل الفهم (حشو) */
const FILL = ['شوفلي', 'شوف لي', 'شوف', 'بص', 'بصلي', 'قولي', 'قوللي', 'قلي', 'اديني', 'هاتلي', 'هات', 'طلعلي', 'عاوز اعرف', 'عايز اعرف', 'عاوزه اعرف', 'عاوز', 'عايز', 'محتاج اعرف', 'ممكن', 'لو سمحت', 'من فضلك', 'ياريت', 'يا ريت', 'طب', 'طيب', 'بقي', 'بقا', 'حضرتك', 'يا باشا', 'يابا', 'يسطا', 'عرفني', 'فهمني', 'احسبلي', 'احسب', 'اعرف'].map(AN).sort((a, b) => b.length - a.length);
const unfill = t => { let s = ' ' + t + ' '; FILL.forEach(f => { s = s.split(' ' + f + ' ').join(' '); }); return s.replace(/\s+/g, ' ').trim(); };

/* ---------------- الألفاظ (كل نوع سؤال وكلماته). الكلمة بتتمسك في أول الكلمة (بعد و/ف/ب/ل/ال) ---------------- */
const K = {
  hi: ['ازيك', 'ازيكم', 'اهلا', 'السلام', 'سلام عليكم', 'صباح', 'مساء', 'هاي', 'هلو', 'عامل ايه', 'ايه الاخبار'],
  thx: ['شكرا', 'متشكر', 'تسلم', 'ميرسي', 'الله ينور', 'تمام كده', 'جميل', 'حلو'],
  help: ['مساعده', 'بتعرف تعمل', 'تعرف تعمل', 'تقدر تعمل', 'بتفهم ايه', 'اسال ايه', 'اسأل ايه', 'امتله', 'ازاي استخدم', 'بتعمل ايه', 'انت مين'],
  /* بضاعة/فواتير (العميل خد = مبيعات، المورد جاب = مشتريات) */
  take: ['سحب', 'مسحوب', 'خد', 'اخد', 'ياخد', 'بياخد', 'بتاخد', 'هياخد', 'اشتر', 'بيشتر', 'بتشتر', 'بضاع', 'بضايع', 'فاتور', 'فواتير', 'جاب', 'بيجيب', 'جابت', 'جابو', 'ورد', 'بيورد', 'توريد', 'جبنا', 'خدنا', 'اخدنا', 'شرينا', 'اتعامل', 'تعامل', 'معامل', 'طلبي', 'طلب', 'بعناله', 'بعنالها', 'بعنا له', 'بعتله', 'بعتلها', 'بيعنا له', 'شغل'],
  sales: ['مبيعات', 'المبيعات', 'بعنا', 'بيعنا', 'بنبيع', 'البيع', 'بيع', 'مسحوبات', 'اتباع', 'بيتباع', 'بتتباع', 'بايعين', 'سحبو', 'بيع العملاء'],
  purch: ['مشتريات', 'المشتريات', 'اشترينا', 'شرينا', 'جبنا', 'اخدنا', 'خدنا', 'وردلنا', 'توريدات', 'جه من الموردين', 'خامات', 'الخامات'],
  paid: ['دفع', 'مدفوع', 'ادي', 'ادت', 'ادو', 'سدد', 'سداد', 'حول', 'تحويل', 'حصل', 'تحصيل', 'استلمت', 'استلمنا', 'وصل منه', 'وصلني', 'جه منه', 'جت منه', 'فلوس جت', 'قبضت', 'قبضنا', 'جاب فلوس', 'دفعات'],
  bal: ['عليه', 'عليها', 'عليهم', 'عليا', 'علينا', 'ليه عندي', 'ليه عندنا', 'ليها عندي', 'ليه كام', 'ليها كام', 'له كام', 'له عندي', 'ليا عنده', 'ليا عندها', 'لينا عنده', 'رصيد', 'حساب', 'فاضل', 'باقي', 'متبقي', 'المتبقي', 'مديون', 'مطلوب منه', 'عنده كام', 'كام عنده', 'المستحق', 'مستحق'],
  lastpay: ['اخر دفعه', 'اخر مره دفع', 'اخر مره ادي', 'اخر مره حول', 'اخر مره سدد', 'اخر فلوس', 'دفع امتي', 'دفعت امتي', 'امتي دفع', 'امتي اخر', 'اخر تحويل', 'اخر سداد', 'اخر مبلغ', 'اخر تحصيل', 'اخر مره جاب فلوس'],
  lastinv: ['اخر فاتوره', 'اخر مره سحب', 'اخر مره خد', 'اخر مره اخد', 'اخر بضاعه', 'اخر طلبيه', 'اخر مره اشتري', 'سحب امتي', 'خد امتي', 'اخد امتي', 'اخر سحب', 'اخر توريد', 'اخر مره جاب', 'اخر مره ورد'],
  late: ['اتاخر', 'بيتاخر', 'متاخر', 'تاخير', 'بيدفع بعد', 'بيسدد بعد', 'مده السداد', 'متوسط الدفع', 'متوسط السداد', 'بيقعد قد ايه', 'بيطول', 'بيماطل', 'ملتزم', 'التزام', 'منتظم', 'بيدفع بسرعه', 'بيدفع امتي', 'تقيل في الدفع', 'وحش في الدفع'],
  stale: ['مدفعش', 'مادفعش', 'ما دفعش', 'مسددش', 'مبيدفعش', 'ما بيدفعش', 'بقاله كتير', 'بقالهم كتير', 'من زمان', 'موقف', 'واقف', 'مختفي', 'اختفي', 'مجاش', 'محصلتش'],
  items: ['صنف', 'اصناف', 'بياخد ايه', 'سحب ايه', 'خد ايه', 'اخد ايه', 'بيشتري ايه', 'بنبيع ايه', 'اكتر حاجه', 'منتج', 'منتجات', 'بضاعه ايه', 'كميه', 'كميات', 'متر', 'لفه', 'لفات', 'كيلو'],
  price: ['سعر', 'اسعار', 'بكام بنبيع', 'بنبيعه بكام', 'بعناه بكام', 'اخر سعر'],
  stmt: ['كشف', 'وريني حساب', 'افتح حساب', 'افتحلي'],
  ret: ['مرتجع', 'رجع', 'رجعت', 'رجعو', 'مرتجعات'],
  disc: ['خصم', 'خصومات', 'تسويه'],
  profit: ['ربح', 'ارباح', 'كسب', 'مكسب', 'كسبنا', 'كسبت', 'خسر', 'خساره', 'خسرنا', 'صافي الربح', 'الصافي', 'فايده', 'الفايده', 'طلعنا بكام'],
  exp: ['مصاريف', 'مصروف', 'صرفنا', 'صرفت', 'صرف', 'اتصرف', 'نتريات', 'بند'],
  col: ['تحصيل', 'حصلنا', 'حصلت', 'لمينا', 'جمعنا', 'دفعات العملاء', 'الفلوس اللي دخلت', 'دخلنا من العملاء', 'قبضنا'],
  suppay: ['دفعنا للموردين', 'دفعات الموردين', 'دفعنا', 'ادينا', 'سددنا', 'حولنا', 'دفعت للموردين'],
  cash: ['خزنه', 'خزن', 'كاش', 'معايا كام', 'معاي كام', 'عندي كام', 'فلوس معايا', 'الفلوس اللي معايا', 'سيوله', 'الفلوس اللي عندي', 'في الدرج', 'البنك', 'انستا', 'فودافون'],
  cashio: ['دخل وطلع', 'الداخل والخارج', 'داخل وخارج', 'دخل كام', 'طلع كام', 'الداخل', 'الخارج', 'حركه الخزنه', 'وارد ومنصرف', 'دخل وخرج'],
  debtors: ['مين عليه', 'مين عليهم', 'الناس عليها', 'الناس عليهم', 'ليا كام عند', 'ليا عند الناس', 'ليا برا', 'الديون', 'ديون', 'الفلوس اللي برا', 'اللي ليا', 'فلوسي اللي', 'المديونيات', 'مديونيه', 'مين مديون', 'ليا كام', 'لينا كام', 'السوق شايل', 'عند العملاء'],
  creditors: ['عليا كام', 'انا عليا', 'اللي عليا', 'عليا للموردين', 'الموردين ليهم', 'مين ليه عندي', 'ليهم كام', 'مستحقات الموردين', 'علينا كام', 'احنا علينا'],
  net: ['الصافي ليا', 'ليا وعليا', 'ليا ولا عليا', 'صافي ليا'],
  top: ['اكتر', 'اكبر', 'احسن', 'اعلي', 'اقوي', 'افضل', 'ترتيب', 'الاوائل', 'توب', 'اهم'],
  low: ['اقل', 'اصغر', 'اوحش', 'اضعف', 'اسوا', 'انيل'],
  who: ['مين', 'انهي', 'اي عميل', 'اي مورد', 'مين اللي', 'اسامي', 'قايمه', 'لسته'],
  cmp: ['قارن', 'مقارنه', 'قصاد', 'مقابل', 'بالنسبه ل', 'احسن ولا', 'اكتر ولا', 'اقل ولا', 'الفرق بين', 'زاد', 'قل', 'نقص', 'زياده', 'نمو', 'اتحسن', 'ولا ', 'ضد'],
  part: ['شريك', 'الشركاء', 'شركاء', 'مرتب', 'مرتبات', 'مسحوبات الشركاء', 'سحب الشركاء', 'مسحوبات شريك'],
  inv: ['مساهم', 'المساهمين', 'مساهمين', 'مساهمه'],
  jrd: ['جرد', 'مخزون', 'الاصول', 'اصول', 'راس المال', 'راس مالي', 'قيمه المصنع', 'صافي الجرد', 'تروه', 'تروتي', 'المصنع يسوي', 'بضاعه في المخزن', 'المخزن'],
  mkin: ['الوارد', 'مستني', 'مستنيه', 'بعت ايه', 'لسه منقلتش', 'محتاج انقل'],
  count: ['عدد', 'كام عميل', 'كام مورد', 'كام حساب', 'كام فاتوره', 'كام زبون'],
  today: ['ملخص', 'عملنا ايه', 'حصل ايه', 'ملخص اليوم', 'الدنيا ماشيه', 'اخبار', 'تقرير اليوم', 'ايه الجديد'],
  /* أحمد / حركة السوق */
  mkSell: ['باع', 'بيع', 'بايع', 'بعت', 'مبيعات', 'المبيعات', 'فواتير', 'فاتوره', 'سحب', 'سحبو'],
  mkBring: ['جاب', 'جايب', 'حصل', 'لم الفلوس', 'لم فلوس', 'لمه', 'جمع', 'دخل', 'حصله', 'جه', 'وصل', 'قبض', 'استلم', 'تحصيل', 'جابه', 'كسب'],
  mkSpend: ['صرف', 'مصاريف', 'مصروف', 'بنزين', 'اكل', 'صرفه', 'خرج'],
  mkSup: ['دفع للموردين', 'دفع لمورد', 'دفعات موردين', 'ادي المورد', 'ادي للمورد', 'سدد', 'دفع'],
  mkHand: ['سلم', 'سلمني', 'سلملي', 'ادالي', 'اداني', 'اديلي', 'حولي', 'حولي', 'حول', 'وصلني منه', 'بعتلي', 'ادي مصطفي', 'سلم مصطفي'],
  mkHold: ['معاه', 'عهده', 'عهدت', 'شايل', 'في جيبه', 'فاضل معاه', 'رصيده', 'رصيد', 'عنده كام', 'معاه كام']
};
const RX = {};
for (const k in K) RX[k] = new RegExp('(?:^|\\s)(?:و|ف)?(?:ب|ل|ك)?(?:ال|ل)?(?:' + K[k].map(s => escR(AN(s))).sort((a, b) => b.length - a.length).join('|') + ')', '');
const hit = (k, t) => { const m = RX[k].exec(t); return m ? m.index : -1; };

/* ---------------- الأرقام بالكلام ---------------- */
const NUMW = {واحد: 1, واحده: 1, اتنين: 2, اتنان: 2, تلاته: 3, تلات: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6, سبعه: 7, سبع: 7, تمانيه: 8, تمنيه: 8, تمان: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10, حداشر: 11, اتناشر: 12};
const NUMRX = Object.keys(NUMW).sort((a, b) => b.length - a.length).join('|');
const numOf = s => s == null || s === '' ? null : /^\d+$/.test(s) ? +s : NUMW[s] || null;

/* ---------------- الفترات ---------------- */
const MN = [['يناير'], ['فبراير', 'فبرايِر'], ['مارس'], ['ابريل', 'ابرايل'], ['مايو', 'ماي'], ['يونيو', 'يونيه'], ['يوليو', 'يوليه'], ['اغسطس', 'اغسطوس'], ['سبتمبر'], ['اكتوبر'], ['نوفمبر'], ['ديسمبر']];
const MNRX = MN.flat().map(AN).sort((a, b) => b.length - a.length).join('|');
const monOf = s => MN.findIndex(a => a.map(AN).includes(s)) + 1;
const dim = (y, m) => new Date(y, m, 0).getDate();
const isoD = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const T = () => todayISO();
const clampT = d => d > T() ? T() : d;
const yy = s => { const n = +s; return n < 100 ? 2000 + n : n; };
function addMonths(iso, n) { const [y, m, d] = iso.split('-').map(Number), x = new Date(y, m - 1 + n, 1, 12); return isoD(x.getFullYear(), x.getMonth() + 1, Math.min(d, dim(x.getFullYear(), x.getMonth() + 1))); }
const sd = iso => { const [, m, d] = iso.split('-'); return `${+d}/${+m}`; };
const per = (f, t, label, unit) => ({f, t: clampT(t), label, unit});
const monthP = (y, m) => per(isoD(y, m, 1), isoD(y, m, dim(y, m)), `${AR_MONTHS[m - 1]} ${y}`, 'month');
const yearP = y => per(`${y}-01-01`, `${y}-12-31`, `سنة ${y}`, 'year');
const weekP = s => per(s, addDays(s, 6), `الأسبوع من ${sd(s)} لـ ${sd(clampT(addDays(s, 6)))}`, 'week');
const dayP = (d, l) => per(d, d, l || dispDate(d), 'day');
const ALL = () => ({f: '', t: T(), label: 'من الأول', unit: 'all', all: true});
const thisMonth = () => { const t = T(); return Object.assign(per(t.slice(0, 8) + '01', t, 'الشهر ده (لحد النهارده)', 'month'), {cur: 1}); };
const thisYear = () => { const t = T(); return Object.assign(per(t.slice(0, 5) + '01-01', t, `سنة ${t.slice(0, 4)} (لحد النهارده)`, 'year'), {cur: 1}); };
const thisWeek = () => { const s = weekStart(T()); return Object.assign(per(s, T(), 'الأسبوع ده (من السبت)', 'week'), {cur: 1}); };
function lastN(n, u) {
  const t = T();
  const f = u === 'day' ? addDays(t, -(n - 1)) : u === 'week' ? addDays(t, -(7 * n - 1)) : u === 'month' ? addMonths(t, -n) : addMonths(t, -12 * n);
  const nm = {day: ['يوم', 'يومين', 'أيام'], week: ['أسبوع', 'أسبوعين', 'أسابيع'], month: ['شهر', 'شهرين', 'شهور'], year: ['سنة', 'سنتين', 'سنين']}[u];
  return per(f, t, `آخر ${n === 1 ? nm[0] : n === 2 ? nm[1] : n + ' ' + (n <= 10 ? nm[2] : nm[0])} (من ${sd(f)} لـ ${sd(t)})`, u === 'day' && n <= 1 ? 'day' : 'range');
}
const UNIT = {يوم: 'day', ايام: 'day', يومين: 'day', اسبوع: 'week', اسابيع: 'week', اسبوعين: 'week', جمعه: 'week', شهر: 'month', شهور: 'month', اشهر: 'month', شهرين: 'month', سنه: 'year', سنين: 'year', سنوات: 'year', سنتين: 'year', عام: 'year', اعوام: 'year'};
const URX = Object.keys(UNIT).sort((a, b) => b.length - a.length).join('|');
const dualN = w => /ين$/.test(w) && !/سنين/.test(w) ? 2 : null;
function seasonP(name, ys) {
  const t = T(), Y = +t.slice(0, 4), M = +t.slice(5, 7);
  const S = {الصيف: [6, 8, 'الصيف'], صيف: [6, 8, 'الصيف'], الربيع: [3, 5, 'الربيع'], الخريف: [9, 11, 'الخريف'], الشتا: [12, 2, 'الشتا'], الشتاء: [12, 2, 'الشتا'], شتا: [12, 2, 'الشتا']}[name];
  if (!S) return null;
  let y = ys ? yy(ys) : (S[0] <= M || (S[0] === 12 && M <= 2) ? Y : Y - 1);
  if (S[0] === 12) { const ye = !ys && M === 12 ? Y + 1 : y; return per(isoD(ye - 1, 12, 1), isoD(ye, 2, dim(ye, 2)), `${S[2]} (ديسمبر ${ye - 1} لـ فبراير ${ye})`, 'range'); }
  return per(isoD(y, S[0], 1), isoD(y, S[1], dim(y, S[1])), `${S[2]} ${y}`, 'range');
}
/* بيلقط كل الفترات المكتوبة في الجملة بالترتيب، وبيشيلها من الكلام علشان متتلخبطش مع الأسامي */
function periods(t0) {
  /* "طب شهر" / "واسبوع" لوحدها (متابعة) = آخر شهر / آخر أسبوع */
  const bare = {شهر: 'month', اسبوع: 'week', سنه: 'year', يوم: 'day'}[t0.trim().replace(/^و(?=\S)/, '')];
  if (bare) return {list: [lastN(1, bare)], rest: ''};
  let w = ' ' + t0 + ' ';
  const out = [], take = (re, fn) => { re.lastIndex = 0; let m; const g = new RegExp(re.source, 'g'); while ((m = g.exec(w))) { const p = fn(m); if (p) { out.push({i: m.index, p}); w = w.slice(0, m.index) + ' '.repeat(m[0].length) + w.slice(m.index + m[0].length); g.lastIndex = m.index + m[0].length; } } };
  const t = T(), Y = +t.slice(0, 4), M = +t.slice(5, 7);
  const okD = (d, m) => d >= 1 && d <= 31 && m >= 1 && m <= 12;
  const mkD = (d, m, y) => { const yr = y ? yy(y) : Y; let r = isoD(yr, +m, Math.min(+d, dim(yr, +m))); if (!y && r > t) r = isoD(yr - 1, +m, Math.min(+d, dim(yr - 1, +m))); return r; };
  /* من 1/3 لـ 15/4 */
  take(/من\s*(?:يوم\s*)?(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?\s*(?:لحد|لغايه|الي|حتي|ل|و|-)\s*(?:يوم\s*)?(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/, m => okD(+m[1], +m[2]) && okD(+m[4], +m[5]) ? (() => { const f = mkD(m[1], m[2], m[3]), e = mkD(m[4], m[5], m[6] || m[3]); return per(f, e, `من ${dispDate(f)} لـ ${dispDate(e)}`, 'range'); })() : null);
  /* يوم 5/10 */
  take(/(?:يوم\s*)?(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/, m => okD(+m[1], +m[2]) ? dayP(mkD(m[1], m[2], m[3])) : null);
  /* نفس الشهر/الفترة السنة اللي فاتت (بيتحسب بعدين من الفترة اللي قبله) */
  take(/نفس\s*(?:ال)?(?:شهر|فتره|اسبوع|الوقت|المده|يوم)\s*(?:في|من)?\s*(?:السنه|العام)\s*(?:اللي|الي)?\s*(?:فاتت|فات|الماضيه|الماضي|السابقه)/, () => ({sameLY: 1}));
  /* شهر 10 سنة 26 / أكتوبر / شهر 3 السنادي */
  const yTail = '(?:\\s*(?:سنه|عام|لسنه|من سنه)?\\s*(\\d{4}|\\d{2})(?!\\s*[\\/\\d]))?(\\s*(?:من\\s*)?(?:السنه|العام)\\s*(?:دي|ده|دا|الحاليه)|\\s*السناد[يه]|\\s*هده السنه)?(\\s*(?:من\\s*)?(?:السنه|العام)\\s*(?:اللي|الي)?\\s*(?:فاتت|فات|الماضيه|الماضي|السابقه|قبلها))?';
  take(new RegExp('(?:شهر\\s*(\\d{1,2})|(?:^|\\s)(?:في|ف|ب|ل|و)?(?:شهر\\s*)?(' + MNRX + '))' + yTail), m => {
    const mo = m[1] ? +m[1] : monOf(m[2]); if (!(mo >= 1 && mo <= 12)) return null;
    const y = m[3] ? yy(m[3]) : m[5] ? Y - 1 : m[4] ? Y : (mo > M ? Y - 1 : Y);
    return monthP(y, mo);
  });
  /* سنة 2025 / 2026 */
  take(/(?:سنه|عام|لسنه)\s*(\d{4}|\d{2})(?!\s*[\/\d])|(?:^|\s)(20[1-4]\d)(?=\s|$)/, m => yearP(yy(m[1] || m[2])));
  /* آخر 6 شهور / آخر شهرين / خلال 3 أسابيع */
  take(new RegExp('(?:في\\s*)?(?:اخر|خلال|طول|من)\\s*(\\d{1,3}|' + NUMRX + ')?\\s*(' + URX + ')(?!\\s*(?:ده|دا|دي|اللي|الي|الماضي|الحالي|السابق|\\d))(?:\\s*(?:اللي|الي)\\s*(?:فاتو|فاتت|فات|عدو|عدت))?'), m => {
    const u = UNIT[m[2]], n = numOf(m[1]) || dualN(m[2]) || (/^(ايام|اسابيع|شهور|اشهر|سنين|سنوات|اعوام)$/.test(m[2]) ? 3 : 1);
    return lastN(n, u);
  });
  take(/(?:الاسبوع|الجمعه)\s*(?:اللي|الي)\s*(?:فات|قبله)|(?:الاسبوع|الجمعه)\s*(?:الماضي|السابق|اللي فات)/, () => { const s = addDays(weekStart(T()), -7); return weekP(s); });
  take(/الشهر\s*(?:اللي|الي)\s*(?:فات|قبله)|الشهر\s*(?:الماضي|السابق)/, () => { const x = addMonths(T().slice(0, 8) + '01', -1); return monthP(+x.slice(0, 4), +x.slice(5, 7)); });
  take(/(?:السنه|العام)\s*(?:اللي|الي)\s*(?:فاتت|فات|قبلها)|(?:السنه|العام)\s*(?:الماضيه|الماضي|السابقه|السابق)/, () => yearP(Y - 1));
  take(/(?:الاسبوع|الجمعه)\s*(?:ده|دا|دي|الحالي)|هدا الاسبوع|(?:^|\s)(?:و|ف|في)?الاسبوع(?=\s|$)/, thisWeek);
  take(/الشهر\s*(?:ده|دا|دي|الحالي)|هدا الشهر|من اول الشهر|(?:^|\s)(?:و|ف|في)?الشهر(?=\s|$)/, thisMonth);
  take(/(?:السنه|العام)\s*(?:دي|ده|دا|الحاليه|الحالي)|السناد[يه]|هده السنه|من اول السنه|(?:^|\s)(?:و|ف|في)?السنه(?=\s|$)/, thisYear);
  take(/اول\s*(?:امبارح|امس)/, () => dayP(addDays(T(), -2), 'أول امبارح'));
  take(/امبارح[اه]?|(?:^|\s)امس(?=\s|$)|البارحه/, () => dayP(addDays(T(), -1), 'امبارح'));
  take(/النهارد[اه]|انهارد[اه]|النهار\s*ده|(?:^|\s)(?:و|ف|في)?اليوم(?=\s|$)/, () => dayP(T(), 'النهارده'));
  take(new RegExp('(?:^|\\s)(?:في|ف|و)?(الصيف|صيف|الربيع|الخريف|الشتاء|الشتا|شتا)(?:\\s*(?:سنه|عام)?\\s*(\\d{4}|\\d{2}))?'), m => seasonP(m[1], m[2]));
  take(/من الاول|من البدايه|من اول ما|طول الوقت|طول عمره|الحساب كله|كل الفترات|كل الوقت|من يوم ما|علي طول الخط|من اول يوم|اجمالي كله/, ALL);
  out.sort((a, b) => a.i - b.i);
  /* "نفس الشهر السنة اللي فاتت" = الفترة اللي قبله بس من سنة */
  const L = [];
  out.forEach(x => { if (x.p.sameLY) { const b = L[L.length - 1] || thisMonth(); L.push(per(addMonths(b.f, -12), addMonths(b.t, -12), b.label.replace(/\d{4}/, y => y - 1).replace(/الشهر ده.*|الأسبوع ده.*/, 'نفس الفترة السنة اللي فاتت'), b.unit)); } else L.push(x.p); });
  return {list: L, rest: w.replace(/\s+/g, ' ').trim()};
}
/* أكتر/أقل أسبوع أو شهر (ترتيب الفترات) */
function rankUnit(t) {
  const m = /(?:^|\s)(اكتر|اكبر|احسن|اعلي|اقل|اصغر|اوحش|اضعف|انهي|اي|كل|بال)\s*(يوم|اسبوع|جمعه|شهر|سنه|ايام|اسابيع|شهور)(?=\s|$)/.exec(t);
  if (!m) return null;
  const u = {يوم: 'day', ايام: 'day', اسبوع: 'week', اسابيع: 'week', جمعه: 'week', شهر: 'month', شهور: 'month', سنه: 'year'}[m[2]];
  const dir = /اقل|اصغر|اوحش|اضعف/.test(m[1]) ? 'min' : /كل|بال/.test(m[1]) ? 'list' : 'max';
  return {u, dir};
}

/* ---------------- الأسامي ---------------- */
const GEN = new Set(['شركه', 'مؤسسه', 'مكتب', 'محل', 'معرض', 'ورشه', 'مصنع', 'حاج', 'حاجه', 'استاد', 'م', 'مهندس', 'دكتور', 'د', 'للتوريدات', 'توريدات', 'للتجاره', 'تجاريه', 'للمقاولات', 'مقاولات', 'عموميه', 'العموميه', 'وشركاه', 'وشركاوه', 'للتوزيع', 'عميل', 'مورد', 'اولاد', 'واولاده', 'اخوان', 'جروب', 'سوق', 'موقع', 'مخزن']);
const STOP = new Set(['كام', 'بكام', 'ايه', 'في', 'ف', 'من', 'م', 'علي', 'عن', 'مع', 'و', 'ده', 'دي', 'دا', 'اللي', 'الي', 'هو', 'هي', 'هم', 'انا', 'احنا', 'كان', 'كانت', 'بتاع', 'بتاعه', 'بتاعت', 'بتاعها', 'ولا', 'او', 'لو', 'ان', 'انه', 'اني', 'بس', 'كمان', 'برضه', 'امتي', 'فين', 'ازاي', 'قد', 'اد', 'لحد', 'منه', 'منها', 'منهم', 'ليه', 'ليها', 'له', 'لها', 'عليه', 'عليها', 'عنده', 'عندها', 'عندي', 'معاه', 'معاها', 'كله', 'كلها', 'كلهم', 'كل', 'اكتر', 'اقل', 'مين', 'انهي', 'اي', 'يوم', 'شهر', 'سنه', 'اسبوع', 'مبلغ', 'فلوس', 'جنيه', 'الف', 'مليون', 'حاجه', 'حد', 'واحد', 'ناس', 'الناس', 'عملاء', 'العملاء', 'عملا', 'العملا', 'شركا', 'الشركا', 'عميل', 'زباين', 'زبون', 'موردين', 'الموردين', 'مورد', 'السوق', 'سوق', 'المواقع', 'مواقع', 'الموقع', 'موقع', 'بين', 'نفس', 'عشان', 'علشان', 'لان', 'بقاله', 'دلوقتي', 'خالص', 'تاني', 'اول', 'اخر', 'جديد', 'قديم', 'ب', 'ل', 'ك', 'ال', 'يا', 'اه', 'لا', 'مش', 'مفيش', 'فيه', 'فيها', 'عليا', 'ليا', 'لينا', 'علينا', 'هنا', 'هناك', 'قبل', 'بعد', 'الشهر', 'السنه', 'الاسبوع', 'النهارده', 'حساب', 'رصيد', 'كشف', 'فاتوره', 'دفعه', 'صنف', 'بند', 'خزنه', 'سعر']);
for (const k in K) K[k].forEach(s => AN(s).split(' ').forEach(w => w.length > 1 && STOP.add(w)));
/* صيغ الكلمة من غير و/ف/ب/ل/ال في أولها */
function vars(w) {
  const o = new Set([w]);
  const strip = x => { [/^و/, /^ف/, /^ب/, /^ل/, /^ك/].forEach(r => { if (x.length > 3 && r.test(x)) o.add(x.replace(r, '')); }); };
  strip(w); [...o].forEach(x => { if (/^ال/.test(x) && x.length > 3) o.add(x.slice(2)); if (/^لل/.test(x) && x.length > 3) o.add(x.slice(2)); });
  [...o].forEach(strip); [...o].forEach(x => { if (/^ال/.test(x) && x.length > 3) o.add(x.slice(2)); });
  return [...o];
}
const core = w => w.replace(/^ال(?=..)/, '');
function lev(a, b) { if (Math.abs(a.length - b.length) > 1) return 9; const d = Array.from({length: a.length + 1}, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
const tokEq = (qv, pt) => qv.some(v => v === pt || (pt.length >= 5 && v.length >= 5 && lev(v, pt) <= 1));
/* فهرس أسامي (بيتعمل تاني بس لو البيانات اتغيرت) */
let IXv = -1, IX = null;
function index() {
  if (IX && IXv === dataVer) return IX;
  const mk = (list, gen) => list.map(o => { const full = AN(o.name), toks = full.split(' ').filter(Boolean).map(core); let c = toks.filter(x => !(gen || GEN).has(x) && !GEN.has(x)); if (!c.length) c = toks; return Object.assign({toks, core: c, full}, o); });
  const ps = partners(), items = [...itemBook().values()].filter(x => x.name);
  IX = {
    party: mk(liveParties().map(p => ({id: p.id, name: p.name, p}))),
    item: mk(items.map(x => ({id: norm(x.name), name: x.name, x})), new Set()),
    cat: mk(db.cats.filter(c => !c.del && !ADJ_CATS.has(c.id)).map(c => ({id: c.id, name: c.name, c}))),
    vault: mk(db.vaults.filter(v => !v.del).map(v => ({id: v.id, name: v.name, v}))),
    part: mk(ps && ps.list ? ps.list.map(p => ({id: p.id, name: p.name})) : []),
    iv: mk(ivList().map(v => ({id: v.id, name: v.name, v})))
  };
  IXv = dataVer; return IX;
}
/* أحسن تطابق: كام كلمة من الاسم موجودة في السؤال. ties = أكتر من واحد بنفس الدرجة */
function findIn(list, qtoks, opt = {}) {
  const Q = qtoks.filter(w => !STOP.has(w) || opt.loose).map(w => ({w, v: vars(w)}));
  const R = [];
  list.forEach(o => {
    if (opt.only && !opt.only(o)) return;
    const used = [];
    let n = 0, num = 0;
    o.core.forEach(pt => { const q = Q.find(x => !used.includes(x.w) && tokEq(x.v, pt)); if (q) { used.push(q.w); n++; if (/^\d/.test(pt)) num++; } });
    if (!n || (n === num && !opt.nums)) return;
    const nums = o.core.filter(x => /^\d/.test(x));
    if (opt.nums && nums.length && Q.some(q => /^\d/.test(q.w)) && !nums.some(x => Q.some(q => q.w === x))) return;   // الصنف فيه مقاس والسؤال فيه مقاس تاني
    const gen = o.toks.filter(pt => !o.core.includes(pt) && Q.some(x => !used.includes(x.w) && tokEq(x.v, pt))).length;
    R.push({o, n, full: n === o.core.length, sc: n + (n === o.core.length ? 0.5 : n / o.core.length * 0.4) + gen * 0.1 + (opt.full && o.full && (' ' + opt.full + ' ').includes(' ' + o.full + ' ') ? 0.3 : 0), used});
  });
  R.sort((a, b) => b.sc - a.sc);
  if (!R.length) return null;
  /* نفس عدد الكلمات = نفس الدرجة، إلا لو واحد بس اسمه كله مكتوب (أو أعلى بوضوح) */
  let top = R.filter(r => r.n === R[0].n);
  const fulls = top.filter(r => r.full);
  if (top.length > 1 && R[0].sc - top[1].sc >= 0.3 - 1e-9) top = [R[0]];
  else if (fulls.length === 1 && R[0] === fulls[0] && top.every(r => r === R[0] || r.sc < R[0].sc - 0.05)) top = [R[0]];
  return {best: top[0], ties: top, all: R};
}

/* ---------------- حسابات (نفس دوال الشاشات) ---------------- */
const inR = (d, p) => (!p.f || d >= p.f) && (!p.t || d <= p.t);
const secOk = (p, sec) => !sec || (sec === 'cust' ? p.sec !== 'sup' : p.sec === sec);
const isSup = p => p.sec === 'sup';
function partySum(pid, p) {
  const s = stmtData(pid, p.all ? '' : p.f, p.all ? '' : p.t), sup = isSup(P.get(pid));
  const r = {s, inv: 0, nInv: 0, ret: 0, pay: 0, nPay: 0, disc: 0, other: 0, open: 0};
  const seen = new Set();   // الكشف بيعرض سطر لكل بند، فالفاتورة الواحدة بتتكرر
  s.rows.forEach(x => { (x.grp || [x.e]).forEach(e => {
    if (!e || seen.has(e.id)) return; seen.add(e.id);
    const k = e.kind, v = Math.abs((e.dr || 0) - (e.cr || 0));
    if (k === 'open') r.open += ((e.dr || 0) - (e.cr || 0)) * s.sg;
    else if (k === (sup ? 'pur' : 'inv')) { r.inv += v; r.nInv++; }
    else if (k === (sup ? 'rpur' : 'rinv')) r.ret += v;
    else if (isPay(e)) { r.pay += e.amt || v; r.nPay++; }
    else if (k === 'adj') r.disc += ((e.cr || 0) - (e.dr || 0)) * s.sg;
    else r.other += ((e.dr || 0) - (e.cr || 0)) * s.sg;
  }); });
  if (s.rows.some(x => !x.grp && !x.e)) { r.inv = s.tg; r.pay = s.tp; }   // احتياط: لو شكل الصفوف اتغير نرجع لأعمدة الكشف
  return r;
}
const pBal = pid => balance(pid) * (isSup(P.get(pid)) ? -1 : 1);   // موجب = الطرف التاني عليه (عميل عليه ليك / مورد ليه عندك)
const balTxt = (pid, b) => { const sup = isSup(P.get(pid)); return b === 0 ? 'خالص' : sup ? (b > 0 ? 'ليه عندك' : 'عليه ليك') : (b > 0 ? 'عليه ليك' : 'ليه عندك'); };
const ents = (pid, kinds, p) => db.entries.filter(e => !e.del && e.party === pid && kinds.includes(e.kind) && (!p || inR(e.date, p))).sort(entCmp);
const ago = d => { const n = Math.round((new Date(T()) - new Date(d)) / 864e5); return n <= 0 ? 'النهارده' : n === 1 ? 'امبارح' : n === 2 ? 'من يومين' : n <= 10 ? `من ${n} أيام` : `من ${n} يوم`; };
const daysN = n => n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? n + ' أيام' : n + ' يوم';
/* متوسط التأخير: الفواتير بالترتيب، وكل دفعة (أو مرتجع أو خصم) بتسدد الأقدم الأول. بيرجع متوسط أيام السداد (موزون بالمبلغ) وأقدم فاتورة لسه مفتوحة */
function payDays(pid, p) {
  const sg = isSup(P.get(pid)) ? -1 : 1, q = [];
  let wsum = 0, wamt = 0, n = 0;
  partyEntries(pid).forEach(e => {
    const x = ((e.dr || 0) - (e.cr || 0)) * sg;
    if (x > 0) q.push({d: e.date, left: x, amt: x, inv: e.kind !== 'open'});
    else if (x < 0) { let c = -x; while (c > 0 && q.length) { const h = q[0], u = Math.min(c, h.left); h.left -= u; c -= u; if (h.left <= 0) { q.shift(); if (h.inv && (!p || inR(h.d, p))) { const dd = Math.max(0, Math.round((new Date(e.date) - new Date(h.d)) / 864e5)); wsum += dd * h.amt; wamt += h.amt; n++; } } } }
  });
  const open = q.filter(h => h.left > 0), old = open[0];
  return {avg: wamt ? Math.round(wsum / wamt) : null, n, openN: open.length, oldest: old ? old.d : '', oldAmt: old ? old.left : 0};
}
function colSum(p, sec) {   // زي تقرير التحصيل: دفعات عملاء السوق والمواقع (من غير الحساب الفرعي)
  const r = {mkt: 0, site: 0, n: 0, list: []};
  db.entries.forEach(e => { if (e.del || e.kind !== 'pay' || !inR(e.date, p)) return; const x = P.get(e.party); if (!x || x.noTot || (x.sec !== 'mkt' && x.sec !== 'site') || !secOk(x, sec)) return; r[x.sec] += e.amt; r.n++; r.list.push(e); });
  r.tot = r.mkt + r.site; return r;
}
function supPaySum(p) { let s = 0, n = 0; const list = []; db.entries.forEach(e => { if (e.del || e.kind !== 'ppay' || !inR(e.date, p)) return; const x = P.get(e.party); if (!x || x.noTot) return; s += e.amt; n++; list.push(e); }); return {s, n, list}; }
function salesBySec(p, kind) {   // صافي المبيعات (أو المشتريات) لكل قسم ولكل حساب، زي tradeSums
  const by = {mkt: 0, site: 0, sup: 0}, per = new Map(), cnt = {mkt: 0, site: 0, sup: 0};
  db.entries.forEach(e => {
    if (e.del || !inR(e.date, p)) return; const x = P.get(e.party); if (!x || x.noTot) return;
    let v = 0;
    if (x.sec === 'sup') { if (PUR_K.has(e.kind)) v = (e.cr || 0) - (e.dr || 0); } else if (SALE_K.has(e.kind)) v = (e.dr || 0) - (e.cr || 0);
    if (!v) return; by[x.sec] += v; per.set(x.id, (per.get(x.id) || 0) + v); if (e.kind === 'inv' || e.kind === 'pur') cnt[x.sec]++;
  });
  return {by, per, cnt};
}
function itemSum(keys, p, kind, pid) {   // زي تقرير "بالصنف": المرتجع بيتخصم
  const ret = kind === 'inv' ? 'rinv' : 'rpur', m = new Map(), who = new Set(), docs = new Set();
  let last = null;
  db.entries.filter(e => !e.del && (e.kind === kind || e.kind === ret) && inR(e.date, p) && (!pid || e.party === pid)).sort(entCmp).forEach(e => {
    const sg = e.kind === ret ? -1 : 1;
    (e.lines || []).forEach(l => { const k = norm(l.name); if (!keys.has(k)) return; const x = m.get(k + '|' + l.unit) || {name: l.name, unit: l.unit, q: 0, v: 0}; x.q += sg * (+l.qty || 0); x.v += sg * lineTot(l); m.set(k + '|' + l.unit, x); who.add(e.party); docs.add(e.id); if (sg > 0) last = {l, e}; });
  });
  const list = [...m.values()].sort((a, b) => b.v - a.v);
  return {list, v: list.reduce((s, x) => s + x.v, 0), who, docs, last};
}
const mkOn = () => db.vaults.some(v => v.id === MKV && !v.del);
function mkCard(p) {   // نفس كارت "حركة السوق" في الخزنة
  const k = kstHtml('mk', '', 'mkt', vaultMoves(MKV, p.f, p.t).concat(mkXfers(p.f, p.t)), 'mk'), s = g => (k.by[g] || []).reduce((n, m) => n + m.amt, 0), c = g => (k.by[g] || []).length;
  return {in: k.in, out: k.out, col: s('col'), nCol: c('col'), cs: s('cs'), nCs: c('cs'), exp: s('mkexp'), nExp: c('mkexp'), sup: s('mkspay'), nSup: c('mkspay'), hand: s('hand') + s('mkTr'), nHand: c('hand') + c('mkTr'), got: s('toMkIn'), by: k.by};
}
function meCard(p) { const k = kstHtml('me', '', 'me', vaultMoves('', p.f, p.t).map(m => Object.assign(m, {mk: isMkRec(m.r)})), 'me'); return k; }

/* ---------------- شكل الإجابة ---------------- */
const fm = v => typeof v === 'number' ? fmtP(v) : String(v);
const pct = (a, b) => b ? Math.round((a - b) * 100 / Math.abs(b)) : null;
const card = (title, sub, rows, more) => Object.assign({t: 'card', title, sub, rows: rows || []}, more || {});
const txt = (h, more) => Object.assign({t: 'text', h}, more || {});
const row = (l, v, cls, s) => ({l, v, cls, s});
const cnt = (n, one, two, many) => !n ? 'مفيش' : n === 1 ? one : n === 2 ? two : `${n} ${many}`;
const fatN = n => cnt(n, 'فاتورة', 'فاتورتين', 'فواتير');
const payN = n => cnt(n, 'دفعة', 'دفعتين', 'دفعات');
const pName = id => (P.get(id) || {name: '؟'}).name;
const stAct = (pid, p) => ({l: 'افتح الكشف' + (p && !p.all ? ' على الفترة دي' : ''), a: `s|${pid}|${p && !p.all ? p.f : ''}|${p && !p.all ? p.t : ''}`});
const repAct = (k, p, l) => ({l: l || 'افتح التقرير', a: `r|${k}|${p ? p.f : ''}|${p ? p.t : ''}`});

/* ---------------- الإجابات ---------------- */
const A = {};
A.partySum = (pid, p, focus) => {
  const x = P.get(pid), sup = isSup(x), r = partySum(pid, p), b = pBal(pid), diff = r.inv - r.ret - r.pay - r.disc + r.other;
  const rows = [];
  if (r.open && p.all) rows.push(row('رصيد أول المدة', r.open, '', ''));
  rows.push(row(sup ? 'جبنا منه بضاعة' : 'خد بضاعة', r.inv, '', fatN(r.nInv)));
  if (r.ret) rows.push(row('مرتجع', r.ret, 'in'));
  rows.push(row(sup ? 'دفعناله' : 'دفع', r.pay, sup ? 'out' : 'in', payN(r.nPay)));
  if (r.disc) rows.push(row('خصومات وتسويات', r.disc, ''));
  if (!p.all) rows.push(row('الفرق في الفترة دي', diff, diff > 0 ? 'out' : 'in', diff > 0 ? (sup ? 'زاد اللي ليه' : 'زاد اللي عليه') : diff < 0 ? (sup ? 'قل اللي ليه' : 'قل اللي عليه') : ''));
  rows.push(row('رصيده كله دلوقتي', Math.abs(b), 'tot', balTxt(pid, b)));
  return card(x.name, p.label + (focus ? '' : ''), rows, {acts: [stAct(pid, p)]});
};
A.payList = (pid, p) => {
  const x = P.get(pid), L = ents(pid, ['pay', 'ppay'], p.all ? null : p), tot = L.reduce((s, e) => s + e.amt, 0);
  const rows = L.slice(-8).reverse().map(e => row(dispDate(e.date), e.amt, isSup(x) ? 'out' : 'in', [e.method && e.method !== 'نقدي' ? e.method : (e.vault ? vName(e.vault) : ''), e.note || ''].filter(Boolean).join(' · ')));
  if (L.length > 8) rows.push(row(`و${cnt(L.length - 8, 'دفعة كمان', 'دفعتين كمان', 'دفعات كمان')}`, '', ''));
  rows.push(row(`الإجمالي (${payN(L.length)})`, tot, 'tot'));
  return card((isSup(x) ? 'دفعنا لـ ' : 'دفعات ') + x.name, p.label, L.length ? rows : [], {h: L.length ? '' : 'مفيش دفعات في الفترة دي.', acts: [stAct(pid, p)]});
};
A.bal = pid => { const b = pBal(pid), x = P.get(pid), lp = ents(pid, ['pay', 'ppay']).pop();
  return card(x.name, SEC1[x.sec], [row('الرصيد دلوقتي', Math.abs(b), 'tot', balTxt(pid, b)), ...(lp ? [row('آخر دفعة', lp.amt, isSup(x) ? 'out' : 'in', `${dispDate(lp.date)} · ${ago(lp.date)}`)] : [])], {acts: [stAct(pid, null), {l: 'افتح الحساب', a: 'p|' + pid}]}); };
A.lastpay = pid => { const x = P.get(pid), e = ents(pid, ['pay', 'ppay']).pop();
  if (!e) return txt(`${esc(x.name)}: مفيش ولا دفعة متسجلة.`);
  return card('آخر دفعة: ' + x.name, '', [row(dispDate(e.date), e.amt, isSup(x) ? 'out' : 'in', [ago(e.date), e.method || '', e.vault ? vName(e.vault) : '', e.note || ''].filter(Boolean).join(' · '))], {acts: [{l: 'افتح الحساب', a: 'p|' + pid}]}); };
A.lastinv = pid => { const x = P.get(pid), e = ents(pid, [isSup(x) ? 'pur' : 'inv']).pop();
  if (!e) return txt(`${esc(x.name)}: مفيش ولا فاتورة متسجلة.`);
  const rows = [row(dispDate(e.date), e.dr || e.cr || 0, 'tot', ago(e.date))].concat((e.lines || []).slice(0, 6).map(l => row(l.name, lineTot(l), '', `${fmtQ(l.qty)} ${l.unit || ''} × ${fmtP(l.price)}`)));
  return card('آخر فاتورة: ' + x.name, '', rows, {acts: [{l: 'افتح الحساب', a: 'p|' + pid}]}); };
A.late = (pid, p) => { const x = P.get(pid), d = payDays(pid, p.all ? null : p);
  const rows = [row('متوسط الأيام لحد ما الفاتورة تتدفع', d.avg === null ? '—' : daysN(d.avg), d.avg > 30 ? 'out' : '', d.n ? `من ${fatN(d.n)} اتدفعت` : 'لسه مفيش فاتورة اتدفعت كلها')];
  if (d.openN) rows.push(row('أقدم فاتورة لسه مفتوحة', d.oldAmt, 'out', `${dispDate(d.oldest)} · ${ago(d.oldest)}`));
  return card(x.name + ': بيدفع بعد كام يوم', p.all ? 'من الأول' : p.label, rows, {acts: [stAct(pid, null)]}); };
A.items = (pid, p, keys) => { const x = P.get(pid), kind = isSup(x) ? 'pur' : 'inv', all = keys || new Set([...itemBook().keys()]);
  const s = itemSum(all, p, kind, pid);
  if (!s.list.length) return txt(`${esc(x.name)}: مفيش أصناف في ${esc(p.label)}.`);
  return card(x.name + ': الأصناف', p.label, s.list.slice(0, 8).map(i => row(i.name, i.v, '', i.unit ? `${fmtQ(i.q)} ${i.unit}` : '')).concat([row('الإجمالي', s.v, 'tot')]), {acts: [stAct(pid, p)]}); };
A.overview = pid => { const x = P.get(pid), b = pBal(pid), m = thisMonth(), r = partySum(pid, m), lp = ents(pid, ['pay', 'ppay']).pop(), li = ents(pid, [isSup(x) ? 'pur' : 'inv']).pop();
  const rows = [row('الرصيد دلوقتي', Math.abs(b), 'tot', balTxt(pid, b)), row(isSup(x) ? 'جبنا منه الشهر ده' : 'خد الشهر ده', r.inv, '', fatN(r.nInv)), row(isSup(x) ? 'دفعناله الشهر ده' : 'دفع الشهر ده', r.pay, isSup(x) ? 'out' : 'in', payN(r.nPay))];
  if (li) rows.push(row('آخر فاتورة', li.dr || li.cr || 0, '', `${dispDate(li.date)} · ${ago(li.date)}`));
  if (lp) rows.push(row('آخر دفعة', lp.amt, '', `${dispDate(lp.date)} · ${ago(lp.date)}`));
  return card(x.name, SEC1[x.sec], rows, {acts: [stAct(pid, null), {l: 'افتح الحساب', a: 'p|' + pid}]}); };
A.cmpParties = (ids, p) => {
  const R = ids.map(id => ({id, r: partySum(id, p), b: pBal(id), d: payDays(id, p.all ? null : p)}));
  const sup = isSup(P.get(ids[0]));
  const rows = [];
  const line = (l, f, cls) => R.forEach((x, i) => rows.push(row(i ? '' : l, f(x), cls, pName(x.id))));
  line(sup ? 'جبنا منه' : 'خد بضاعة', x => x.r.inv, ''); line(sup ? 'دفعناله' : 'دفع', x => x.r.pay, 'in'); line('الرصيد دلوقتي', x => Math.abs(x.b), 'tot'); line('متوسط أيام الدفع', x => x.d.avg === null ? '—' : daysN(x.d.avg), '');
  const w = R[0].r.inv === R[1].r.inv ? 'زي بعض في البضاعة' : `${pName(R[0].r.inv > R[1].r.inv ? R[0].id : R[1].id)} خد أكتر بفرق ${fmtP(Math.abs(R[0].r.inv - R[1].r.inv))}`;
  return card('مقارنة: ' + ids.map(pName).join(' و '), p.label, rows, {h: esc(w), grp: true});
};
/* --- إجماليات --- */
A.sales = (p, sec) => { const t = tradeSums(p.f || '0000', p.t), s = salesBySec(p);
  const rows = [row('صافي المبيعات', sec && sec !== 'cust' ? s.by[sec] : t.sales, 'tot', sec && sec !== 'cust' ? fatN(s.cnt[sec]) : fatN(s.cnt.mkt + s.cnt.site))];
  if (!sec || sec === 'cust') { rows.push(row(SECS.mkt, s.by.mkt, '', fatN(s.cnt.mkt)), row(SECS.site, s.by.site, '', fatN(s.cnt.site))); }
  return card('المبيعات' + (sec && sec !== 'cust' ? ': ' + SECS[sec] : ''), p.label, rows, {acts: [repAct('profit', p, 'افتح تقرير الأرباح')]}); };
A.purch = p => { const t = tradeSums(p.f || '0000', p.t), s = salesBySec(p);
  return card('المشتريات', p.label, [row('صافي المشتريات', t.purch, 'tot', fatN(s.cnt.sup))], {acts: [repAct('profit', p, 'افتح تقرير الأرباح')]}); };
A.salesPurch = p => { const t = tradeSums(p.f || '0000', p.t), s = salesBySec(p);
  return card('المبيعات والمشتريات', p.label, [row('المبيعات', t.sales, 'in', fatN(s.cnt.mkt + s.cnt.site)), row('المشتريات', t.purch, 'out', fatN(s.cnt.sup)), row('الفرق', t.sales - t.purch, 'tot')], {acts: [repAct('profit', p, 'افتح تقرير الأرباح')]}); };
A.profit = p => { const x = profitOf(p.f || '0000', p.t);
  const rows = [row('المبيعات', x.sales, ''), row('المشتريات', x.purch, 'out'), row('المصروفات', x.exp - x.inc, 'out', x.inc ? 'بعد الإيرادات التانية' : ''), row('الربح قبل الشركاء', x.before, '')];
  if (x.part) rows.push(row('مرتبات ومسحوبات الشركاء', x.part, 'out'));
  if (x.iv) rows.push(row('أرباح المساهمين', x.iv, 'out'));
  rows.push(row(x.after >= 0 ? 'صافي الربح' : 'خسارة', Math.abs(x.after), 'tot', x.part || x.iv ? 'بعد الشركاء' : ''));
  return card('الأرباح', p.label + ' · نفس رقم تقرير الأرباح', rows, {acts: [repAct('profit', p, 'افتح تقرير الأرباح')], note: 'من غير حساب المخزون، زي التقرير.'}); };
A.exp = (p, cats) => { const c = cashSums(p.f || '0000', p.t);
  if (cats && cats.length) {
    const ids = new Set(cats.map(x => x.id)), L = db.txs.filter(x => !x.del && x.type !== 'tr' && ids.has(x.cat) && inR(x.date, p)).sort((a, b) => b.date.localeCompare(a.date));
    const tot = L.reduce((s, x) => s + (x.type === 'exp' ? x.amt : -x.amt), 0);
    return card('بند ' + cats.map(x => x.name).join(' و '), p.label, L.slice(0, 8).map(x => row(dispDate(x.date), x.amt, x.type === 'exp' ? 'out' : 'in', [x.note, vName(x.vault)].filter(Boolean).join(' · '))).concat(L.length > 8 ? [row(`و${L.length - 8} كمان`, '', '')] : []).concat([row(`الإجمالي (${L.length})`, Math.abs(tot), 'tot')]), {acts: [{l: 'افتح الخزنة', a: 'c'}]});
  }
  const by = [...c.byCat.entries()].filter(([k]) => k.startsWith('−')).sort((a, b) => b[1] - a[1]);
  return card('المصروفات', p.label, [row('المصروفات', c.exp, 'tot', 'من غير الشركاء والتحويلات')].concat(by.slice(0, 8).map(([k, v]) => row(k.replace(/^− /, ''), v, ''))).concat(c.part ? [row('الشركاء (لوحدهم)', c.part, '')] : []), {acts: [repAct('profit', p, 'افتح تقرير الأرباح')]}); };
A.col = (p, sec) => { const c = colSum(p, sec), last = c.list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, p.unit === 'day' ? 8 : 0);
  const rows = [row('التحصيل', sec === 'mkt' ? c.mkt : sec === 'site' ? c.site : c.tot, 'tot', payN(c.n))];
  if (!sec || sec === 'cust') rows.push(row(SECS.mkt, c.mkt, 'in'), row(SECS.site, c.site, 'in'));
  last.forEach(e => rows.push(row(pName(e.party), e.amt, 'in', dispDate(e.date))));
  return card('التحصيل من العملاء' + (sec === 'mkt' || sec === 'site' ? ': ' + SECS[sec] : ''), p.label + ' · زي تقرير التحصيل', rows, {acts: [repAct('col', p)]}); };
A.suppay = p => { const s = supPaySum(p); return card('دفعنا للموردين', p.label, [row('الإجمالي', s.s, 'tot', payN(s.n))].concat(s.list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(e => row(pName(e.party), e.amt, 'out', dispDate(e.date))))); };
A.cash = vs => { if (!db.vaults.length) return txt('الخزنة لسه متفعلتش.');
  if (vs && vs.length) return card('رصيد ' + vs.map(v => v.name).join(' و '), 'دلوقتي', vs.map(v => row(v.name, vaultBal(v.id), 'tot')), {acts: [{l: 'افتح الخزنة', a: 'c'}]});
  const L = vaultsL(), rows = L.map(v => row(v.name, vaultBal(v.id), ''));
  rows.push(row('رصيد الخزن (معاك)', vaultBal(''), 'tot'));
  if (mkOn()) rows.push(row('مع ' + MK_PN + ' (خزنة السوق)', vaultBal(MKV), ''));
  return card('الخزنة', 'دلوقتي', rows, {acts: [{l: 'افتح الخزنة', a: 'c'}]}); };
A.cashio = p => { const k = meCard(p), rows = [row('داخل', k.in, 'in'), row('خارج', k.out, 'out')];
  CG_ORD.filter(g => k.by[g] && CG[g][1] === 'in').forEach(g => rows.push(row('  ' + CG[g][0].replace(/^\S+\s(?=\S)/u, s => /[؀-ۿ]/.test(s) ? s : ''), k.by[g].reduce((n, m) => n + m.amt, 0), 'in', String(k.by[g].length))));
  CG_ORD.filter(g => k.by[g] && CG[g][1] === 'out').forEach(g => rows.push(row('  ' + CG[g][0].replace(/^\S+\s(?=\S)/u, s => /[؀-ۿ]/.test(s) ? s : ''), k.by[g].reduce((n, m) => n + m.amt, 0), 'out', String(k.by[g].length))));
  return card('حركة خزني: دخل وطلع', p.label + ' · زي كارت "حركتي" في الخزنة', rows, {acts: [{l: 'افتح الخزنة', a: 'c'}]}); };
function balList(sec, owe) {
  const bal = allBalances(), L = liveParties().filter(x => !x.noTot && secOk(x, sec || (owe ? 'sup' : 'cust'))).map(x => ({x, b: (bal.get(x.id) || 0) * (isSup(x) ? -1 : 1)})).filter(o => o.b > 0).sort((a, b) => b.b - a.b);
  return L;
}
A.debtors = (sec, n) => { const L = balList(sec, false), tot = L.reduce((s, o) => s + o.b, 0);
  return card('الناس اللي عليها فلوس' + (sec === 'mkt' || sec === 'site' ? ': ' + SECS[sec] : ''), `لحد النهارده · ${L.length} حساب`, L.slice(0, n || 8).map(o => row(o.x.name, o.b, 'out', SECS[o.x.sec]))
    .concat([row('الإجمالي (ليك عند الناس)', tot, 'tot')]), {acts: [repAct('tot', null, 'افتح تقرير ليا وعليا')], go: L.slice(0, n || 8).map(o => o.x.id)}); };
A.creditors = () => { const L = balList('sup', true), tot = L.reduce((s, o) => s + o.b, 0);
  return card('اللي عليك للموردين', `لحد النهارده · ${L.length} حساب`, L.slice(0, 8).map(o => row(o.x.name, o.b, 'out')).concat([row('الإجمالي', tot, 'tot')]), {acts: [repAct('tot', null, 'افتح تقرير ليا وعليا')], go: L.slice(0, 8).map(o => o.x.id)}); };
A.net = () => { const bal = allBalances(); let ly = 0, al = 0; liveParties().forEach(x => { if (x.noTot) return; const v = bal.get(x.id) || 0; if (v > 0) ly += v; else al -= v; });
  return card('ليا وعليا', 'لحد النهارده · زي تقرير ليا وعليا', [row('ليا عند الناس', ly, 'in'), row('عليا للناس', al, 'out'), row(ly - al >= 0 ? 'الصافي ليا' : 'الصافي عليا', Math.abs(ly - al), 'tot')], {acts: [repAct('tot', null, 'افتح تقرير ليا وعليا')]}); };
A.topParties = (p, mode, sec, dir) => {
  const sup = sec === 'sup' || mode === 'purch', s = salesBySec(p);
  let L;
  if (mode === 'pay') { const m = new Map(); db.entries.forEach(e => { if (e.del || !isPay(e) || !inR(e.date, p)) return; const x = P.get(e.party); if (!x || x.noTot || !secOk(x, sup ? 'sup' : sec || 'cust')) return; m.set(x.id, (m.get(x.id) || 0) + e.amt); }); L = [...m.entries()]; }
  else L = [...s.per.entries()].filter(([id]) => secOk(P.get(id), sup ? 'sup' : sec || 'cust'));
  L.sort((a, b) => dir === 'min' ? a[1] - b[1] : b[1] - a[1]);
  const what = mode === 'pay' ? (sup ? 'دفعنالهم' : 'دفعوا') : sup ? 'جبنا منهم' : 'سحبوا';
  return card(`${dir === 'min' ? 'أقل' : 'أكتر'} ${sup ? 'الموردين' : 'العملاء'} ${what}`, p.label, L.slice(0, 8).map(([id, v], i) => row(`${i + 1}. ${pName(id)}`, v, i ? '' : 'tot', SECS[P.get(id).sec])), {h: L.length ? '' : 'مفيش حركة في الفترة دي.', go: L.slice(0, 8).map(([id]) => id), note: mode === 'profit' ? 'الربح مش بيتحسب لكل عميل (مفيش تكلفة للصنف)، فالترتيب بالمبيعات.' : ''});
};
A.topItems = (p, kind, dir) => { const s = itemSum(new Set([...itemBook().keys()]), p, kind || 'inv');
  const L = s.list.filter(x => x.unit).sort((a, b) => dir === 'min' ? a.v - b.v : b.v - a.v);
  return card(`${dir === 'min' ? 'أقل' : 'أكتر'} الأصناف ${kind === 'pur' ? 'اللي اشتريناها' : 'مبيعاً'}`, p.label + ' · زي تقرير "بالصنف"', L.slice(0, 8).map((x, i) => row(`${i + 1}. ${x.name}`, x.v, i ? '' : 'tot', `${fmtQ(x.q)} ${x.unit}`)), {h: L.length ? '' : 'مفيش أصناف في الفترة دي.', acts: [repAct('item', p, 'افتح تقرير الأصناف')]}); };
A.item = (keys, p, kind, pid) => { const s = itemSum(keys, p, kind, pid);
  if (!s.list.length) return txt(`مفيش ${kind === 'pur' ? 'مشتريات' : 'مبيعات'} للصنف ده${pid ? ' لـ ' + esc(pName(pid)) : ''} في ${esc(p.label)}.`);
  const rows = s.list.slice(0, 8).map(x => row(x.name, x.v, '', x.unit ? `${fmtQ(x.q)} ${x.unit}${x.q ? ' · متوسط ' + fmtP(Math.round(x.v / x.q)) : ''}` : ''));
  if (s.list.length > 1) rows.push(row('الإجمالي', s.v, 'tot'));
  if (s.last) rows.push(row('آخر مرة', s.last.l.price, '', `${s.last.l.name} · ${pName(s.last.e.party)} · ${dispDate(s.last.e.date)}`));
  return card((kind === 'pur' ? 'اشترينا: ' : pid ? pName(pid) + ' خد: ' : 'بعنا: ') + (s.list.length === 1 ? s.list[0].name : 'الأصناف دي'), p.label, rows, {acts: pid ? [stAct(pid, p)] : [repAct('item', p, 'افتح تقرير الأصناف')], note: `${fatN(s.docs.size)} · ${s.who.size} ${kind === 'pur' ? 'مورد' : 'عميل'}`}); };
A.price = (keys, pid) => { const kind = pid && isSup(P.get(pid)) ? 'pur' : 'inv', L = [];
  db.entries.filter(e => !e.del && e.kind === kind && (!pid || e.party === pid)).sort(entCmp).forEach(e => (e.lines || []).forEach(l => { if (keys.has(norm(l.name))) L.push({l, e}); }));
  if (!L.length) return txt('مفيش سعر متسجل للصنف ده.');
  const by = new Map(); L.forEach(o => by.set(norm(o.l.name), o));
  return card('آخر سعر' + (pid ? ' لـ ' + pName(pid) : ''), '', [...by.values()].slice(0, 8).map(o => row(o.l.name, o.l.price, 'tot', `${pName(o.e.party)} · ${dispDate(o.e.date)}`))); };
A.lateList = (p, sec) => { const L = liveParties().filter(x => !x.noTot && secOk(x, sec || 'cust')).map(x => ({x, d: payDays(x.id, p)})).filter(o => o.d.avg !== null).sort((a, b) => b.d.avg - a.d.avg);
  return card('أكتر ناس بتتأخر في الدفع', p.label + ' · متوسط الأيام من الفاتورة لحد ما اتدفعت', L.slice(0, 8).map(o => row(o.x.name, daysN(o.d.avg), o.d.avg > 30 ? 'out' : '', fatN(o.d.n))), {h: L.length ? '' : 'مفيش فواتير اتدفعت في الفترة دي لسه.', go: L.slice(0, 8).map(o => o.x.id)}); };
A.stale = sec => { const bal = allBalances(), L = liveParties().filter(x => !x.noTot && secOk(x, sec || 'cust') && (bal.get(x.id) || 0) * (isSup(x) ? -1 : 1) > 0).map(x => { const lp = ents(x.id, ['pay', 'ppay']).pop(); return {x, d: lp ? lp.date : '', b: Math.abs(bal.get(x.id))}; }).sort((a, b) => (a.d || '0') < (b.d || '0') ? -1 : 1);
  return card('عليهم فلوس ومدفعوش من فترة', 'الأقدم في الدفع فوق', L.slice(0, 8).map(o => row(o.x.name, o.b, 'out', o.d ? 'آخر دفعة ' + ago(o.d) : 'مدفعش ولا مرة')), {go: L.slice(0, 8).map(o => o.x.id)}); };
A.partners = (p, ids) => { const s = partners(); if (!s || !s.list || !s.list.length) return txt('الشركاء مش متفعلين.');
  const per = new Map(s.list.map(x => [x.id, {x, sal: 0, draw: 0}])); db.txs.forEach(t => { if (t.del || !t.pt || !inR(t.date, p)) return; const r = per.get(t.pt); if (r) r[ptKind(t)] += t.amt; });
  const L = [...per.values()].filter(r => (!ids || ids.includes(r.x.id)) && (!r.x.to || r.sal || r.draw));
  const rows = []; L.forEach(r => rows.push(row(r.x.name, r.sal + r.draw, 'tot', `مرتب ${fmtP(r.sal)}${r.draw ? ' · مسحوبات ' + fmtP(r.draw) : ''}`)));
  if (L.length > 1) rows.push(row('الإجمالي', L.reduce((a, r) => a + r.sal + r.draw, 0), 'tot'));
  return card('الشركاء', p.label, rows, {acts: [{l: 'افتح الشركاء', a: 'pt'}]}); };
A.inv = ids => { const L = ivList().filter(v => !ids || ids.includes(v.id)); if (!L.length) return txt('مفيش مساهمين متسجلين.');
  const rows = []; L.forEach(v => { const s = ivSums(v.id); rows.push(row(v.name, s.bal, 'tot', `رأس مال ${fmtP(s.cap)} · أرباح ${fmtP(s.prof)} · سحب ${fmtP(s.draw)}`)); });
  return card('المساهمين', 'الرصيد = رأس المال والأرباح اللي لسه متسحبتش', rows, {acts: [{l: 'افتح المساهمين', a: 'iv'}]}); };
A.jrd = () => { const last = jrdSaved()[0], n = jrdCalc(T()), stock = last ? last.stock : 0, X = jrdTot(n, stock);
  const rows = [row('أرصدة العملاء', n.mkt + n.site, ''), row('النقدية بالخزن', n.vault, ''), row('قيمة المخزون', stock, '', last ? 'من جرد ' + dispDate(last.date) : 'لسه متسجلتش'), row('− الموردين', n.sup, 'out')];
  if (X.iv) rows.push(row('− المساهمين', X.iv, 'out'));
  rows.push(row('صافي الجرد النهارده', X.net, 'tot'));
  if (last) { const pv = jrdTot(last.n || jrdCalc(last.date), last.stock).net; rows.push(row('الفرق عن آخر جرد', X.net - pv, X.net >= pv ? 'in' : 'out', dispDate(last.date))); }
  return card('الجرد', 'محسوب لحد النهارده بقيمة المخزون من آخر جرد', rows, {acts: [{l: 'افتح الجرد', a: 'j'}]}); };
A.mkin = () => { if (!mkCreds()) return txt('حركة السوق مش مربوطة على الجهاز ده.');
  const L = mkPending(); if (!L.length) return txt('مفيش حاجة مستنية في الوارد، كله اتنقل.', {acts: [{l: 'افتح الوارد', a: 'm'}]});
  const nm = {pay: 'تحصيل', spay: 'دفعة مورد', exp: 'مصروف', hand: 'سلّم كاش', inv: 'فاتورة', cs: 'بيع كاش', rt: 'مرتجع'};
  return card('الوارد من ' + MK_PN, `${L.length} حاجة مستنية تتنقل`, L.slice(0, 8).map(o => row(nm[o.t] || o.t, o.amt, '', o.cname || o.sname || o.cat || '')), {acts: [{l: 'افتح الوارد', a: 'm'}]}); };
A.rets = p => { const L = db.entries.filter(e => !e.del && (e.kind === 'rinv' || e.kind === 'rpur') && inR(e.date, p) && P.get(e.party)).sort((a, b) => b.date.localeCompare(a.date)), sm = k => L.filter(e => e.kind === k).reduce((n, e) => n + (e.dr || e.cr || 0), 0);
  return card('المرتجعات', p.label, [row('مرتجع من العملاء', sm('rinv'), 'out', String(L.filter(e => e.kind === 'rinv').length)), row('مرتجع للموردين', sm('rpur'), 'in', String(L.filter(e => e.kind === 'rpur').length))].concat(L.slice(0, 6).map(e => row(pName(e.party), e.dr || e.cr || 0, '', dispDate(e.date)))), {go: [null, null].concat(L.slice(0, 6).map(e => e.party))}); };
A.count = sec => { const L = liveParties(); const c = s => L.filter(x => x.sec === s).length;
  return card('عدد الحسابات', '', sec && sec !== 'cust' ? [row(SECS[sec], String(c(sec)), 'tot')] : [row(SECS.mkt, String(c('mkt')), ''), row(SECS.site, String(c('site')), ''), row(SECS.sup, String(c('sup')), ''), row('الكل', String(L.length), 'tot')]); };
A.invCount = (p, sec) => { const s = salesBySec(p); return card('عدد الفواتير', p.label, [row('فواتير بيع', String(s.cnt.mkt + s.cnt.site), ''), row('فواتير شراء', String(s.cnt.sup), '')]); };
A.today = () => { const p = dayP(T(), 'النهارده'), t = tradeSums(p.f, p.t), c = colSum(p), s = supPaySum(p), x = cashSums(p.f, p.t);
  const rows = [row('مبيعات', t.sales, ''), row('تحصيل', c.tot, 'in', payN(c.n)), row('دفعنا للموردين', s.s, 'out'), row('مصروفات', x.exp + x.part, 'out')];
  if (db.vaults.length) rows.push(row('رصيد الخزن دلوقتي', vaultBal(''), 'tot'));
  if (mkCreds() && mkPending().length) rows.push(row('مستني في الوارد', String(mkPending().length), ''));
  return card('ملخص النهارده', dispDate(T()), rows); };
/* أحمد (حركة السوق) */
A.ahmed = (p, what, word) => { if (!mkOn()) return txt('حركة السوق مش متفعلة على الحسابات دي.');
  if (what === 'hold') return card('مع ' + MK_PN + ' دلوقتي', 'رصيد خزنة السوق (العهدة)', [row('معاه', vaultBal(MKV), 'tot')].concat(lastHand() ? [row('آخر مرة سلّم كاش', '', '', lastHand())] : []), {acts: [{l: 'افتح الخزنة', a: 'c'}]});
  if (what === 'sell') { const s = salesBySec(p), m = mkCard(p), c = colSum(p);
    return card(MK_PN + ': باع كام', p.label + ' · فواتير عملاء السوق', [row('باع (فواتير)', s.by.mkt, 'tot', fatN(s.cnt.mkt)), row('حصّل من عملاء السوق (كل التحصيل)', c.mkt, 'in'), row('اللي ' + MK_PN + ' حصّله بإيده', m.col, '', String(m.nCol)), row(s.by.mkt >= c.mkt ? 'زاد على العملاء (باع أكتر ما حصّل)' : 'قل على العملاء (حصّل أكتر ما باع)', Math.abs(s.by.mkt - c.mkt), s.by.mkt >= c.mkt ? 'out' : 'in')],
      {acts: [repAct('sales', p, 'افتح تقرير المبيعات')], note: 'باع = فواتير البضاعة اللي خدها عملاء السوق. حصّل = الفلوس اللي دفعوها فعلاً.'}); }
  const m = mkCard(p), rows = [];
  if (what === 'bring') { rows.push(row('جاب من السوق', m.col + m.cs, 'tot'), row('تحصيل من العملاء', m.col, 'in', String(m.nCol)), ...(m.cs ? [row('بيع كاش', m.cs, 'in', String(m.nCs))] : [])); }
  else if (what === 'spend' && word) { const L = (m.by.mkexp || []).filter(x => { const n = AN(x.who + ' ' + (x.what || '') + ' ' + (x.r.note || '') + ' ' + cName(x.r.cat)); return word.some(w => vars(w).some(v => n.includes(v))); });
    rows.push(row(`مصروفات "${word.join(' ')}"`, L.reduce((n, x) => n + x.amt, 0), 'tot', String(L.length))); L.slice(0, 6).forEach(x => rows.push(row(x.who, x.amt, 'out', dispDate(x.date)))); rows.push(row('كل مصروفات ' + MK_PN, m.exp, '', String(m.nExp))); }
  else if (what === 'spend') { rows.push(row('مصروفات ' + MK_PN, m.exp, 'tot', String(m.nExp))); ((m.by.mkexp) || []).slice(0, 6).forEach(x => rows.push(row(x.who, x.amt, 'out', dispDate(x.date)))); if (m.sup) rows.push(row('ودفع للموردين (لوحدها)', m.sup, '', String(m.nSup))); }
  else if (what === 'sup') rows.push(row('دفع للموردين', m.sup, 'tot', String(m.nSup)));
  else if (what === 'hand') rows.push(row('سلّملك', m.hand, 'tot', String(m.nHand)));
  else { rows.push(row('داخل', m.in, 'in'), row('خارج', m.out, 'out'));
    CG_ORD.filter(g => m.by[g]).forEach(g => rows.push(row('  ' + CG[g][0].replace(/^[^؀-ۿ]+/, ''), m.by[g].reduce((n, x) => n + x.amt, 0), CG[g][1] === 'in' ? 'in' : 'out', String(m.by[g].length))));
    rows.push(row('معاه دلوقتي', vaultBal(MKV), 'tot')); }
  return card(MK_PN + ': ' + ({bring: 'جاب كام', spend: 'صرف كام', sup: 'دفع للموردين', hand: 'سلّم كام'}[what] || 'حركة السوق'), p.label + ' · زي كارت "حركة السوق"', rows, {acts: [{l: 'افتح الخزنة', a: 'c'}]}); };

/* ترتيب الفترات (أكتر/أقل أسبوع أو شهر) لأي رقم */
function bins(u, p) {
  const t = T(), out = [];
  let f = p && !p.all && p.f ? p.f : null, to = p && p.t ? p.t : t;
  if (!f) f = u === 'day' ? addDays(t, -29) : u === 'week' ? addDays(weekStart(t), -7 * 11) : u === 'month' ? t.slice(0, 5) + '01-01' : '2000-01-01';
  if (u === 'year') { const y0 = Math.max(+f.slice(0, 4), +((db.entries.map(e => e.date).filter(Boolean).sort()[0] || t).slice(0, 4))); for (let y = y0; y <= +to.slice(0, 4); y++) out.push(yearP(y)); return out; }
  if (u === 'month') { for (let m = f.slice(0, 7); m <= to.slice(0, 7); m = nextMonth(m)) out.push(monthP(+m.slice(0, 4), +m.slice(5, 7))); return out; }
  if (u === 'week') { for (let s = weekStart(f); s <= to; s = addDays(s, 7)) out.push(weekP(s)); return out; }
  for (let d = f; d <= to; d = addDays(d, 1)) out.push(dayP(d)); return out;
}
function rankCard(title, u, dir, p, fn, unitLabel) {
  const B = bins(u, p).map(b => ({b, v: fn(b)})), nz = B.filter(x => x.v);
  const L = (dir === 'min' ? nz.slice().sort((a, b) => a.v - b.v) : dir === 'list' ? B.slice().reverse() : B.slice().sort((a, b) => b.v - a.v));
  const nm = {day: 'يوم', week: 'أسبوع', month: 'شهر', year: 'سنة'}[u];
  const span = B.length ? `من ${dispDate(B[0].b.f)} لـ ${dispDate(B[B.length - 1].b.t)}` : '';
  if (!nz.length) return txt(`مفيش ${esc(unitLabel || 'حركة')} في الفترة دي (${esc(span)}).`);
  const top = L[0];
  return card(dir === 'list' ? title + ' ' + ({day: 'باليوم', week: 'بالأسبوع', month: 'بالشهر', year: 'بالسنة'}[u]) : `${dir === 'min' ? 'أقل' : 'أكتر'} ${nm}: ${title}`, span + (dir === 'min' ? ' · من غير الفترات الفاضية' : ''),
    (dir === 'list' ? L.slice(0, 14) : L.filter(x => x.v).slice(0, 5)).map((x, i) => row(x.b.label, x.v, dir !== 'list' && !i ? 'tot' : '', '')), {h: dir === 'list' ? '' : `${dir === 'min' ? 'أقل' : 'أكتر'} ${nm} كان <b>${esc(top.b.label)}</b> بـ <b class="n">${fmtP(top.v)}</b>`}); }
/* مقارنة فترتين لنفس الرقم */
function cmpCard(title, a, b, fn, more) {
  const x = fn(a), y = fn(b), d = x - y, pc = pct(x, y);
  return card(title, `${a.label} قصاد ${b.label}`, [row(a.label, x, 'tot'), row(b.label, y, ''), row(d >= 0 ? 'زيادة' : 'نقص', Math.abs(d), d >= 0 ? 'in' : 'out', pc === null ? '' : Math.abs(pc) + '%')], more); }
/* الفترة اللي قبلها بنفس الطول (الشهر ده لحد النهارده ← الشهر اللي فات لنفس اليوم، زي لوحة النهارده) */
function prevOf(p) {
  if (p.unit === 'month') { const f = addMonths(p.f, -1), [y, m] = f.split('-').map(Number), d = +p.t.slice(8); const t = isoD(y, m, Math.min(p.cur ? d : dim(y, m), dim(y, m))); return per(f, t, p.cur ? `الشهر اللي فات لحد ${sd(t)}` : monthP(y, m).label, 'month'); }
  if (p.unit === 'year') { const y = +p.f.slice(0, 4) - 1; return p.cur ? per(`${y}-01-01`, addMonths(p.t, -12), `سنة ${y} لنفس اليوم`, 'year') : yearP(y); }
  if (p.unit === 'week') return Object.assign(weekP(addDays(p.f, -7)), p.cur ? {t: addDays(p.t, -7)} : {});
  if (p.unit === 'day') return dayP(addDays(p.f, -1));
  const n = Math.round((new Date(p.t) - new Date(p.f)) / 864e5) + 1, t = addDays(p.f, -1), f = addDays(t, -(n - 1));
  return per(f, t, `الفترة اللي قبلها (من ${sd(f)} لـ ${sd(t)})`, 'range');
}

/* ---------------- الفهم ---------------- */
const PFX = '(?:^|\\s)(?:و|ف)?(?:ب|ل|ك)?(?:ال|ل)?';
const SECRX = {site: new RegExp(PFX + '(?:مواقع|موقع)(?=\\s|$)'), mkt: new RegExp(PFX + 'سوق(?=\\s|$)'), sup: new RegExp(PFX + '(?:موردين|مورد)(?=\\s|$)'), cust: new RegExp(PFX + '(?:عملاء|عميل|زباين|زبون)(?=\\s|$)')};
const SECW = q => { const s = new Set(); for (const k in SECRX) if (SECRX[k].test(q)) s.add(k); return s; };
const AHM = () => AN(MK_PN);
/* الكلمة دي نفسها كلمة سؤال (صرف، دفع، ...)؟ */
const hitAny = w => Object.keys(K).some(k => hit(k, ' ' + w + ' ') >= 0);
function understand(raw, ctx, force) {
  const X = index();
  let t0 = unfill(AN(raw));
  /* الاسم الكامل المكتوب زي ما هو بيتحجز الأول (علشان "موقع أكتوبر" مايتفهمش شهر، و"الخامات" ماتتفهمش مشتريات) */
  const prot = [];
  if (!force) X.party.slice().sort((a, b) => b.full.length - a.full.length).forEach(o => { if (o.full.length < 3) return; const k = ' ' + t0 + ' '; let i = k.indexOf(' ' + o.full + ' '), w = 0; if (i < 0) { i = k.search(new RegExp(' [وب]' + o.full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' ')); w = 1; } if (i >= 0 && prot.length < 2) { prot.push(o); t0 = (k.slice(0, i) + ' ¤' + prot.length + ' ' + k.slice(i + o.full.length + 1 + w)).trim(); } });
  const PR = periods(t0), toks = PR.rest.split(' ').filter(Boolean).filter(w => !/^¤/.test(w));
  const X2 = index(), secs0 = SECW(' ' + PR.rest + ' ');
  const ah = toks.some(w => vars(w).includes(AHM())) || /عهده|عهدت|خزنه السوق|شريك السوق|تطبيق السوق|حركه السوق/.test(PR.rest);
  let party = null, party2 = null;
  if (force) party = {best: {o: X.party.find(o => o.id === force) || {id: force}, used: []}, ties: []};
  else if (prot.length) { party = {best: {o: prot[0], used: [], n: 9}, ties: []}; if (prot[1]) party2 = {best: {o: prot[1], used: []}, ties: []}; }
  else party = findIn(X.party, toks, {full: PR.rest});
  if (party && !force && !prot.length && secs0.has('sup') && !secs0.has('cust')) { const f = party.all.filter(r => r.o.p.sec === 'sup'); if (f.length) party = {best: f[0], ties: f.filter(r => r.n === f[0].n), all: f}; }
  if (party && !force && !prot.length && ah && party.best.used.length === 1 && vars(party.best.used[0]).includes(AHM())) party = null;
  if (party && !force && !prot.length) { const it0 = findIn(X.item, toks, {nums: true}); if (it0 && it0.best.n > party.best.n && party.best.used.every(w => it0.best.used.includes(w))) party = null; }
  if (party && !force && party.ties.length > 1) {   // عميل ومورد بنفس الاسم + كلمة "عميل"/"مورد" تحسم
    const want = secs0.has('sup') ? 'sup' : secs0.has('cust') || secs0.has('mkt') || secs0.has('site') ? 'cust' : '';
    if (want) { const f = party.ties.filter(r => want === 'sup' ? r.o.p.sec === 'sup' : r.o.p.sec !== 'sup'); if (f.length) party = Object.assign({}, party, {best: f[0], ties: f}); }
  }
  const usedP = party ? party.best.used : [];
  const rest = toks.filter(w => !usedP.includes(w));
  /* الكلام من غير اسم الحساب: هو اللي بيتفهم منه نوع السؤال */
  const q = ' ' + PR.rest.split(' ').filter(w => !usedP.includes(w) && !/^¤/.test(w)).join(' ') + ' ';
  const I = {}; for (const k in K) { const i = hit(k, q); if (i >= 0) I[k] = i; }
  if (I.late >= 0 || I.stale >= 0 || I.lastpay >= 0) { delete I.paid; delete I.col; if (I.lastpay >= 0) delete I.suppay; }
  if (I.lastinv >= 0) { delete I.take; delete I.sales; }
  if (I.items >= 0 && I.sales >= 0 && !(I.take >= 0)) delete I.sales;
  const secs = party ? SECW(q) : secs0;
  /* مقارنة حسابين: الاسم التاني من الكلام اللي فاضل */
  if (party && !party2 && party.ties.length <= 1 && I.cmp >= 0) { const p2 = findIn(X.party.filter(o => o.id !== party.best.o.id), rest, {}); if (p2) party2 = p2; }
  if (party && !party2 && party.ties.length === 2 && I.cmp >= 0) { const a = party.ties[0], b = party.ties[1]; if (a.used.join() !== b.used.join()) { party2 = {best: b, ties: [b]}; party = {best: a, ties: [a]}; } }
  const item = findIn(X.item, rest, {nums: true});
  const cat = findIn(X.cat.filter(o => o.c.type === 'exp' || o.c.type === 'inc'), rest, {});
  const vlt = findIn(X.vault, rest, {});
  const part = findIn(X.part, rest, {});
  const iv = findIn(X.iv, rest, {});
  return {raw, t: t0, q, P: PR.list.length || !ctx || !ctx.forceP ? PR.list : ctx.forceP, I, secs, ah, party, party2, item, cat, vlt, part, iv, rank: rankUnit(q), toks, rest};
}
const has = (U, ...ks) => ks.some(k => U.I[k] >= 0);
const first = (U, ...ks) => ks.filter(k => U.I[k] >= 0).sort((a, b) => U.I[a] - U.I[b]);
const itemKeys = U => U.item ? new Set(U.item.ties.map(r => r.o.id)) : null;
const metricOf = U => has(U, 'profit') ? 'profit' : has(U, 'exp') ? 'exp' : has(U, 'purch') ? 'purch' : has(U, 'col') || (has(U, 'paid') && !has(U, 'suppay')) ? 'col' : has(U, 'suppay') ? 'suppay' : has(U, 'cashio') ? 'cashio' : 'sales';
const METRIC = {
  sales: [p => tradeSums(p.f || '0000', p.t).sales, 'المبيعات'], purch: [p => tradeSums(p.f || '0000', p.t).purch, 'المشتريات'], profit: [p => profitOf(p.f || '0000', p.t).after, 'صافي الربح'],
  exp: [p => cashSums(p.f || '0000', p.t).exp, 'المصروفات'], col: [p => colSum(p).tot, 'التحصيل'], suppay: [p => supPaySum(p).s, 'دفعات الموردين'], cashio: [p => meCard(p).in, 'الداخل للخزنة']
};
function secMetric(U, sec) {
  const m = metricOf(U);
  if (m === 'col') return [p => colSum(p, sec)[sec] || 0, 'التحصيل من ' + SECS[sec]];
  return [p => salesBySec(p).by[sec], (sec === 'sup' ? 'المشتريات من ' : 'المبيعات لـ ') + SECS[sec]];
}

/* بيرجّع قايمة كروت للإجابة + السياق الجديد */
function answer(raw, ctx, force) {
  const U = understand(raw, ctx, force), out = [], P0 = U.P[0], P1 = U.P[1];
  const nctx = Object.assign({}, ctx); delete nctx.forceP;
  const pd = def => P0 || (ctx.per && ctx.keepPer ? ctx.per : null) || def();
  const done = (cards, extra) => { Object.assign(nctx, extra || {}); if (P0) nctx.per = P0; return {cards, ctx: nctx, U}; };
  const noIntent = !Object.keys(U.I).some(k => !['who', 'top', 'low', 'hi', 'thx'].includes(k));
  /* تحية وشكر */
  if (has(U, 'thx') && noIntent && !U.party && !U.P.length) return done([txt('العفو يا ' + esc(MK_ME) + '، تحت أمرك في أي سؤال.')]);
  if (has(U, 'hi') && noIntent && !U.party && !U.P.length) return done([txt('أهلاً يا ' + esc(MK_ME) + '، اسأل عن أي حاجة في الحسابات.'), helpCard()]);
  if (has(U, 'help') && !U.party) return done([helpCard()]);
  /* اسم عليه أكتر من حساب: اسأل تقصد مين */
  if (U.party && U.party.ties.length > 1 && !U.party2) {
    return done([card('تقصد مين؟', `فيه ${U.party.ties.length} حسابات بالاسم ده`, [], {picks: U.party.ties.slice(0, 8).map(r => ({l: r.o.p.name, s: SEC1[r.o.p.sec], a: 'pk|' + r.o.id}))})], {pending: raw});
  }
  const pid = U.party ? U.party.best.o.id : null;
  /* ===== أحمد (حركة السوق) ===== */
  if (U.ah && !pid) {
    if (has(U, 'mkin')) return done([A.mkin()]);
    const W = first(U, 'mkSell', 'mkBring', 'mkSpend', 'mkSup', 'mkHand', 'mkHold').map(k => ({mkSell: 'sell', mkBring: 'bring', mkSpend: 'spend', mkSup: 'sup', mkHand: 'hand', mkHold: 'hold'}[k]));
    if (W.includes('sup') && W.includes('spend') && U.I.mkSup === U.I.mkSpend) W.splice(W.indexOf('sup'), 1);
    if (W[0] === 'hold' && (U.P.length || U.rank) && W.length > 1) W.shift();
    const what = W[0] || '';
    const fn = {sell: p => salesBySec(p).by.mkt, bring: p => { const m = mkCard(p); return m.col + m.cs; }, spend: p => mkCard(p).exp, sup: p => mkCard(p).sup, hand: p => mkCard(p).hand, '': p => mkCard(p).in, hold: p => mkCard(p).col + mkCard(p).cs}[what];
    const lbl = {sell: MK_PN + ' باع', bring: MK_PN + ' جاب', spend: MK_PN + ' صرف', sup: MK_PN + ' دفع للموردين', hand: MK_PN + ' سلّم', '': 'داخل خزنة السوق', hold: MK_PN + ' جاب'}[what];
    if (U.rank) return done([rankCard(lbl, U.rank.u, U.rank.dir, P0, fn, lbl)], {last: {k: 'ahmed', what}});
    if (P0 && P1) return done([cmpCard(lbl, P0, P1, fn)]);
    if (has(U, 'cmp') && P0) return done([cmpCard(lbl, P0, prevOf(P0), fn)]);
    const SPW = new Set(['بنزين', 'سولار', 'اكل', 'غدا', 'فطار', 'عربيه', 'نقل', 'شحن', 'مواصلات', 'تحميل', 'شيال', 'كارته']);
    const word = U.rest.filter(x => (SPW.has(x) || !vars(x).some(v => STOP.has(v) || hitAny(v))) && x.length > 2 && !vars(x).includes(AHM()) && !/^\d/.test(x));
    const out2 = [...new Set(W.length ? W : [''])].slice(0, 3).map(w => A.ahmed(w === 'hold' && !U.P.length ? null : pd(thisWeek), w, w === 'spend' && word.length ? word : null));
    return done(out2, {last: {k: 'ahmed', what}, party: null, lastQ: raw});
  }
  /* ===== مقارنة حسابين ===== */
  if (pid && U.party2) return done([A.cmpParties([pid, U.party2.best.o.id], pd(thisYear))], {party: pid});
  /* ===== مقارنة السوق بالمواقع ===== */
  if (!pid && U.secs.has('mkt') && U.secs.has('site') && (has(U, 'cmp') || !U.P.length || true) && !has(U, 'debtors', 'bal')) {
    const p = pd(thisYear), s = salesBySec(p), c = colSum(p), bl = allBalances(), ow = sec => liveParties().filter(x => x.sec === sec && !x.noTot).reduce((n, x) => n + (bl.get(x.id) || 0), 0), n = sec => liveParties().filter(x => x.sec === sec).length;
    const rows = [row('المبيعات: السوق', s.by.mkt, '', fatN(s.cnt.mkt)), row('المبيعات: المواقع', s.by.site, '', fatN(s.cnt.site)), row('التحصيل: السوق', c.mkt, 'in'), row('التحصيل: المواقع', c.site, 'in'), row('عليهم دلوقتي: السوق', ow('mkt'), 'out', n('mkt') + ' حساب'), row('عليهم دلوقتي: المواقع', ow('site'), 'out', n('site') + ' حساب')];
    const w = s.by.mkt === s.by.site ? 'المبيعات زي بعض' : `${s.by.mkt > s.by.site ? 'السوق' : 'المواقع'} أكتر في المبيعات بفرق ${fmtP(Math.abs(s.by.mkt - s.by.site))}`;
    if (U.rank) { const sec = U.I.mkt >= 0 ? 'mkt' : 'site'; }
    return done([card('السوق قصاد المواقع', p.label, rows, {h: esc(w)})]);
  }
  /* ===== حساب واحد ===== */
  if (pid) {
    const x = P.get(pid), keys = itemKeys(U);
    nctx.party = pid;
    const ks = first(U, 'take', 'sales', 'purch', 'paid', 'col', 'suppay', 'bal', 'lastpay', 'lastinv', 'late', 'stale', 'items', 'price', 'stmt', 'ret', 'disc');
    if (U.rank) { const sup = isSup(x), payQ = has(U, 'paid', 'col', 'suppay') && !has(U, 'take', 'sales', 'purch');
      const fn = payQ ? b => ents(pid, ['pay', 'ppay'], b).reduce((s, e) => s + e.amt, 0) : b => partySum(pid, b).inv; return done([rankCard(x.name + (payQ ? (sup ? ': دفعناله' : ': دفع') : (sup ? ': جبنا منه' : ': خد')), U.rank.u, U.rank.dir, P0, fn)]); }
    if (P0 && P1) { const payQ = has(U, 'paid') && !has(U, 'take', 'sales'); return done([cmpCard(x.name + (payQ ? ': الدفعات' : ': البضاعة'), P0, P1, payQ ? b => ents(pid, ['pay', 'ppay'], b).reduce((s, e) => s + e.amt, 0) : b => partySum(pid, b).inv)]); }
    if (has(U, 'cmp') && P0) return done([cmpCard(x.name + ': البضاعة', P0, prevOf(P0), b => partySum(pid, b).inv)]);
    const pp = pd(ALL), seen = new Set();
    ks.forEach(k => {
      const g = {take: 'sum', sales: 'sum', purch: 'sum', ret: 'sum', disc: 'sum', paid: 'pay', col: 'pay', suppay: 'pay'}[k] || k;
      if (seen.has(g) || (g === 'pay' && seen.has('sum'))) return;
      if (g === 'sum' && seen.has('pay')) { const i = out.findIndex(c => c.kind === 'pay'); if (i >= 0) out.splice(i, 1); }
      seen.add(g);
      if (g === 'sum') { if (keys && (has(U, 'items') || !has(U, 'paid'))) out.push(A.item(keys, pp, isSup(x) ? 'pur' : 'inv', pid)); else out.push(A.partySum(pid, pp)); }
      else if (g === 'pay') out.push(Object.assign(A.payList(pid, pp), {kind: 'pay'}));
      else if (g === 'bal') out.push(A.bal(pid));
      else if (g === 'lastpay') out.push(A.lastpay(pid));
      else if (g === 'lastinv') out.push(A.lastinv(pid));
      else if (g === 'late' || g === 'stale') { if (!seen.has('late2')) { seen.add('late2'); out.push(A.late(pid, pd(ALL))); } }
      else if (g === 'items') out.push(keys ? A.item(keys, pp, isSup(x) ? 'pur' : 'inv', pid) : A.items(pid, pp));
      else if (g === 'price') out.push(keys ? A.price(keys, pid) : A.items(pid, pp));
      else if (g === 'stmt') out.push(A.partySum(pid, pp));
    });
    /* lastpay بيغطي "دفع" اللي جواه */
    const seenC = new Set(), cl = out.filter((c, i) => !(c.kind === 'pay' && out.some(o => o.title && o.title.startsWith('آخر دفعة')))).filter(c => { const k = JSON.stringify([c.title, c.h, c.rows]); if (seenC.has(k)) return false; seenC.add(k); return true; });
    if (!cl.length) cl.push(keys ? A.item(keys, pp, isSup(x) ? 'pur' : 'inv', pid) : P0 ? A.partySum(pid, P0) : A.overview(pid));
    const perKs = ks.filter(k => ['take', 'sales', 'purch', 'paid', 'col', 'suppay', 'ret', 'disc', 'items', 'late'].includes(k));
    return done(cl, Object.assign({last: {k: 'party', ks}}, perKs.length || !ctx.perKs ? {perKs: perKs.length ? perKs : ['take']} : {}));
  }
  /* ===== من غير اسم ===== */
  const sec = U.secs.has('mkt') ? 'mkt' : U.secs.has('site') ? 'site' : U.secs.has('sup') ? 'sup' : U.secs.has('cust') ? 'cust' : '';
  const keys = itemKeys(U);
  const globalQ = has(U, 'who', 'top', 'low') || sec || /(?:^|\s)(?:كل|كلهم|اجمالي|الاجمالي|كله)(?=\s|$)/.test(U.q);
  /* سؤال متابعة عن نفس الحساب: "وآخر دفعة امتى؟" "وعليه كام؟" "وطب السنة اللي فاتت؟" */
  if (ctx.party && P.get(ctx.party) && !globalQ && !keys && !U.cat && !U.vlt && !U.part && !U.iv && (has(U, 'bal', 'lastpay', 'lastinv', 'late', 'stale', 'items', 'price', 'stmt') || ((has(U, 'take', 'paid', 'ret') || (noIntent && U.P.length && ctx.last && ctx.last.k === 'party')) && !has(U, 'profit', 'exp', 'cash', 'cashio', 'jrd', 'part', 'inv', 'mkin', 'today', 'count')) )) {
    if (noIntent && U.P.length) return answer(raw + ' ' + (ctx.perKs || ['take']).map(k => ({take: 'خد', paid: 'دفع', bal: 'عليه', lastpay: 'اخر دفعه', lastinv: 'اخر فاتوره', late: 'بيتاخر', items: 'اصناف'}[k] || '')).join(' '), Object.assign({}, ctx, {forceP: U.P}), ctx.party);
    return answer(raw, ctx, ctx.party);
  }
  /* متابعة بفترة بس: نفس السؤال اللي فات بفترة تانية */
  if (noIntent && U.P.length && !keys && !U.cat && ctx.lastQ) return answer(periods(unfill(AN(ctx.lastQ))).rest + ' ' + raw, Object.assign({}, ctx, {lastQ: '', forceP: U.P}));
  /* ترتيب الفترات: أكتر شهر / أقل أسبوع */
  if (U.rank && !has(U, 'who') && !(has(U, 'items') && !U.rank.u)) {
    let [fn, lbl] = METRIC[metricOf(U)];
    if ((sec === 'mkt' || sec === 'site' || sec === 'sup') && ['sales', 'col', 'purch'].includes(metricOf(U))) [fn, lbl] = secMetric(U, sec === 'sup' && metricOf(U) === 'sales' ? 'sup' : sec);
    if (keys) { fn = b => itemSum(keys, b, has(U, 'purch') ? 'pur' : 'inv').v; lbl = 'مبيعات ' + (U.item.ties.length === 1 ? U.item.best.o.name : 'الأصناف دي'); }
    if (U.cat && has(U, 'exp')) { const ids = new Set(U.cat.ties.map(r => r.o.id)); fn = b => db.txs.filter(x => !x.del && x.type === 'exp' && ids.has(x.cat) && inR(x.date, b)).reduce((s, x) => s + x.amt, 0); lbl = 'بند ' + U.cat.best.o.name; }
    return done([rankCard(lbl, U.rank.u, U.rank.dir, P0, fn, lbl)], {lastQ: raw});
  }
  /* مقارنة فترتين */
  if ((P0 && P1) || (has(U, 'cmp') && !has(U, 'who'))) {
    let [fn, lbl] = METRIC[metricOf(U)];
    if ((sec === 'mkt' || sec === 'site') && ['sales', 'col'].includes(metricOf(U))) [fn, lbl] = secMetric(U, sec);
    if (keys) { fn = b => itemSum(keys, b, 'inv').v; lbl = 'مبيعات ' + (U.item.ties.length === 1 ? U.item.best.o.name : 'الأصناف دي'); }
    const a = P0 || thisMonth(), b = P1 || prevOf(a);
    return done([cmpCard(lbl, a, b, fn)], {lastQ: raw});
  }
  const p = def => pd(def);
  const L = [];
  if (has(U, 'part', 'inv', 'jrd', 'mkin', 'cash', 'cashio', 'exp', 'profit', 'today', 'count') && !has(U, 'sales', 'purch')) delete U.I.take;
  /* اسم مكتوب ومش لاقيه: قول كده واقترح أقرب أسامي */
  const lost = U.rest.filter(x => !vars(x).some(v => STOP.has(v) || hitAny(v)) && x.length > 2 && !/^\d/.test(x));
  if (lost.length && has(U, 'bal', 'lastpay', 'lastinv', 'take', 'paid', 'late', 'stmt') && !has(U, 'who', 'top', 'low', 'debtors', 'creditors', 'net') && !U.rank && !U.item && !U.cat && !U.vlt && !U.part && !U.iv) {
    const near = X0().party.map(o => ({o, d: Math.min(...lost.map(w => Math.min(...o.core.map(c => c.includes(core(w)) || core(w).includes(c) ? 0 : lev(core(w), c)))))})).filter(x => x.d <= 2).sort((a, b) => a.d - b.d).slice(0, 5);
    return done([card('', '', [], {h: `مش لاقي حساب اسمه "${esc(lost.join(' '))}".${near.length ? ' تقصد حد من دول؟' : ' اكتب الاسم زي ما هو متسجل.'}`, picks: near.map(x => ({l: x.o.p.name, s: SEC1[x.o.p.sec], a: 'pk|' + x.o.id}))})], {pending: raw});
  }
  const ks = first(U, 'today', 'mkin', 'jrd', 'inv', 'part', 'net', 'creditors', 'debtors', 'stale', 'late', 'profit', 'items', 'price', 'take', 'sales', 'purch', 'exp', 'col', 'suppay', 'paid', 'cashio', 'cash', 'count', 'bal', 'lastpay', 'lastinv', 'ret');
  const did = new Set();
  const add = (k, c) => { if (!did.has(k)) { did.add(k); L.push(c); } };
  const top = has(U, 'top', 'low') || (has(U, 'who') && !has(U, 'debtors', 'stale', 'late'));
  const dir = has(U, 'low') && !has(U, 'top') ? 'min' : 'max';
  ks.forEach(k => {
    if (k === 'today') add(k, A.today());
    else if (k === 'mkin') add(k, A.mkin());
    else if (k === 'jrd') add(k, A.jrd());
    else if (k === 'inv') add(k, A.inv(U.iv ? U.iv.ties.map(r => r.o.id) : null));
    else if (k === 'part') add(k, A.partners(p(thisMonth), U.part ? U.part.ties.map(r => r.o.id) : null));
    else if (k === 'net') add(k, A.net());
    else if (k === 'creditors' || (k === 'bal' && (sec === 'sup' || / عليا| علينا/.test(U.q)))) add('cred', A.creditors());
    else if (k === 'debtors' || (k === 'bal' && (has(U, 'who') || sec))) add('debt', A.debtors(sec === 'sup' ? '' : sec, has(U, 'top') ? 10 : 8));
    else if (k === 'stale') add(k, A.stale(sec === 'sup' ? '' : sec));
    else if (k === 'late') add(k, A.lateList(p(() => lastN(12, 'month')), sec === 'sup' ? '' : sec));
    else if (k === 'profit') { if (top && has(U, 'who', 'top') && (sec === 'cust' || sec === 'mkt' || sec === 'site' || has(U, 'who'))) add('topP', A.topParties(p(thisYear), 'profit', sec, dir)); else add(k, A.profit(p(thisMonth))); }
    else if (k === 'items' || k === 'price') { if (keys) add('item', k === 'price' ? A.price(keys) : A.item(keys, p(thisYear), has(U, 'purch') ? 'pur' : 'inv')); else if (k === 'items') add('topI', A.topItems(p(thisYear), has(U, 'purch') ? 'pur' : 'inv', dir)); }
    else if (k === 'take' || k === 'sales') { if (did.has('topI') || did.has('item')) return; if (keys) add('item', A.item(keys, p(thisYear), 'inv')); else if (top) add('topS', A.topParties(p(thisYear), 'sales', sec === 'sup' ? 'sup' : sec, dir)); else if (has(U, 'purch') && !has(U, 'sales')) add('purch', A.purch(p(thisMonth))); else if (has(U, 'sales') && has(U, 'purch')) add('sp', A.salesPurch(p(thisMonth))); else add('sales', sec === 'sup' ? A.purch(p(thisMonth)) : A.sales(p(thisMonth), sec)); }
    else if (k === 'purch') { if (keys) add('item', A.item(keys, p(thisYear), 'pur')); else if (top) add('topS', A.topParties(p(thisYear), 'purch', 'sup', dir)); else if (did.has('sales')) { L.splice(L.findIndex(c => c.title === 'المبيعات'), 1); add('sp', A.salesPurch(p(thisMonth))); } else if (!did.has('sp')) add('purch', A.purch(p(thisMonth))); }
    else if (k === 'exp') add(k, A.exp(p(thisMonth), U.cat ? U.cat.ties.map(r => r.o.c) : null));
    else if (k === 'col' || k === 'paid') { if (top) add('topPay', A.topParties(p(thisYear), 'pay', sec, dir)); else if (sec === 'sup' || (k === 'paid' && has(U, 'suppay'))) add('suppay', A.suppay(p(thisMonth))); else add('col', A.col(p(thisMonth), sec)); }
    else if (k === 'suppay') add(k, A.suppay(p(thisMonth)));
    else if (k === 'cashio') add(k, A.cashio(p(thisMonth)));
    else if (k === 'cash') { if (/ بنك| انستا| فودافون/.test(U.q) && !U.vlt) add(k, A.cash()); else add(k, A.cash(U.vlt ? U.vlt.ties.map(r => r.o.v) : null)); }
    else if (k === 'ret') add(k, A.rets(p(thisMonth)));
    else if (k === 'count') { if (/فاتور/.test(U.q)) add(k, A.invCount(p(thisMonth))); else add(k, A.count(sec)); }
  });
  /* "صرفنا كام على البنزين": مفيش بند بالاسم ده، يبقى ندور في ملاحظات المصروفات */
  if (did.has('exp') && !U.cat) { const w = U.rest.filter(x => !STOP.has(x) && x.length > 2 && !/^\d/.test(x)); if (w.length) { const pp = p(thisMonth), hitT = x => { const n = AN((x.note || '') + ' ' + cName(x.cat)); return w.some(k => vars(k).some(v => n.includes(v))); };
    const T2 = db.txs.filter(x => !x.del && x.type === 'exp' && !x.pt && inR(x.date, pp) && hitT(x)).sort((a, b) => b.date.localeCompare(a.date));
    L.splice(L.findIndex(c => c.title === 'المصروفات'), 1, T2.length ? card(`مصروفات فيها "${w.join(' ')}"`, pp.label + ' · مفيش بند بالاسم ده، فدورت في الملاحظات', T2.slice(0, 8).map(x => row(x.note || cName(x.cat), x.amt, 'out', `${dispDate(x.date)} · ${cName(x.cat)}`)).concat([row(`الإجمالي (${T2.length})`, T2.reduce((n, x) => n + x.amt, 0), 'tot')]), {acts: [{l: 'افتح الخزنة', a: 'c'}]})
      : txt(`مفيش بند ولا مصروف فيه "${esc(w.join(' '))}" في ${esc(pp.label)}. البنود اللي عندك: ${esc(catsL('exp').map(c => c.name).join('، '))}.`)); } }
  if (!L.length && keys) L.push(A.item(keys, p(thisYear), has(U, 'purch') ? 'pur' : 'inv'));
  if (!L.length && U.cat) L.push(A.exp(p(thisMonth), U.cat.ties.map(r => r.o.c)));
  if (!L.length && U.vlt) L.push(A.cash(U.vlt.ties.map(r => r.o.v)));
  if (!L.length && U.part) L.push(A.partners(p(thisMonth), U.part.ties.map(r => r.o.id)));
  if (!L.length && U.iv) L.push(A.inv(U.iv.ties.map(r => r.o.id)));
  if (!L.length && (has(U, 'bal', 'lastpay', 'lastinv'))) return done([txt('عن مين؟ اكتب اسم العميل أو المورد.')], {pending: raw});
  if (!L.length) return done([], {miss: 1});
  const seenC = new Set();
  return done(L.filter(c => { const k = JSON.stringify([c.title, c.h, c.rows]); if (seenC.has(k)) return false; seenC.add(k); return true; }), {lastQ: raw, party: null});
}
const X0 = () => index();
function helpCard() {
  return card('أمثلة تسألها', 'اكتب بكلامك العادي، والاسم يكفي جزء منه', [], {picks: [
    'فلان سحب كام الشهر ده ودفع كام', 'فلان عليه كام', 'آخر دفعة دفعها فلان', 'مين عليه فلوس كتير', 'مين بيتأخر في الدفع',
    'أرباح الشهر اللي فات', 'مبيعات ومشتريات شهر 3', 'صرفنا كام في بند كذا', 'الخزنة فيها كام', MK_PN + ' جاب كام الأسبوع ده وصرف كام',
    'أكتر شهر حصلنا فيه من عملاء المواقع', 'قارن السوق بالمواقع', 'أكتر صنف بيتباع السنة دي', 'صافي الجرد'].map(l => ({l, a: 'q|' + l.replace(/فلان/g, '').replace(/كذا/g, '')}))});
}

/* ---------------- الأسئلة اللي مفهمهاش (متشفرة على الجهاز) ---------------- */
let MISS = null;
async function missLoad() { if (MISS) return MISS; MISS = []; try { const b = await idbGet('askmiss'); if (b && cryptoKey) MISS = await unseal(cryptoKey, b) || []; } catch (e) { MISS = []; } return MISS; }
async function missAdd(q) { await missLoad(); if (MISS.some(x => x.q === q)) return; MISS.push({q, at: nowS()}); if (MISS.length > 100) MISS.shift(); try { await idbPut('askmiss', await seal(cryptoKey, saltU8, MISS)); } catch (e) {} }
async function missClear() { MISS = []; try { await idbDel('askmiss'); } catch (e) {} }

/* ---------------- الشاشة ---------------- */
/* الشكل (متغيرات lib/ui.css بس: الألوان والخمس أحجام) */
const CSS = `
#p-ask .aqw{display:flex;flex-direction:column;gap:10px;padding:4px 0 8px;min-height:45vh}
.aqm{scroll-margin-top:72px;align-self:flex-start;max-width:85%;background:var(--gold-l);border:1px solid var(--line);border-radius:16px 16px 16px 6px;padding:8px 14px;font-weight:700;font-size:var(--f3);line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.aqb{align-self:flex-end;width:94%;background:var(--card);border:1px solid var(--line);border-radius:16px 16px 6px 16px;box-shadow:var(--shadow2);overflow:hidden}
html:not([data-theme=dark]) .aqb{border-color:transparent}
.aqb h4{margin:0;padding:10px 14px 6px;font-size:var(--f3);font-weight:800;line-height:1.4}
.aqb h4 small{display:block;font-size:var(--f1);color:var(--sub);font-weight:600}
.aqb p{margin:0;padding:10px 14px;font-size:var(--f3);font-weight:600;line-height:1.6}
.aqb p .n{direction:ltr;unicode-bidi:isolate}
.aqr{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--line)}
.aqr span{font-weight:700;font-size:var(--f2);min-width:0;white-space:pre-wrap}
.aqr small{display:block;font-size:var(--f1);color:var(--sub);font-weight:600}
.aqr .n{flex:none;font-weight:800;font-size:var(--f3);direction:ltr;unicode-bidi:isolate;white-space:nowrap;font-variant-numeric:tabular-nums lining-nums}
.aqr .n[dir=rtl]{direction:rtl}
.aqr .n.in{color:var(--green)}.aqr .n.out{color:var(--red)}
.aqr.tot{background:var(--gold-l)}.aqr.tot .n{color:var(--gold-d);font-size:var(--f4)}
.aqr.lnk{cursor:pointer}
.aqn{padding:6px 14px 10px;font-size:var(--f1);color:var(--sub);font-weight:600}
.aqb p.aqn{padding-top:0;font-size:var(--f1)}
.aqa{display:flex;flex-wrap:wrap;border-top:1px solid var(--line)}
.aqa button{flex:1;border:0;background:none;color:var(--gold-d);font-weight:800;font-size:var(--f2);padding:10px;cursor:pointer;font-family:inherit;min-height:44px}
.aqa button+button{border-inline-start:1px solid var(--line)}
.aqp{display:flex;flex-direction:column;gap:6px;padding:6px 14px 12px}
.aqp button{border:1.5px solid var(--gold);background:var(--gold-l);border-radius:12px;padding:8px 12px;font-weight:800;font-size:var(--f2);display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:pointer;color:var(--ink);text-align:start;font-family:inherit;min-height:44px}
.aqp button small{color:var(--sub);font-weight:600;font-size:var(--f1)}
.aqc{position:sticky;bottom:calc(67px + env(safe-area-inset-bottom));background:var(--bg);padding:8px 0 10px;z-index:5;border-top:1px solid var(--line)}
.aqk{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}
.aqk::-webkit-scrollbar{display:none}
.aqk button{flex:none;white-space:nowrap;border:1px solid var(--line);background:var(--card);border-radius:20px;padding:4px 12px;font-size:var(--f2);font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit;min-height:34px}
#aqMiss{color:var(--red)}
.aqf{display:flex;gap:8px;align-items:center}
.aqf .inp{flex:1;border-radius:24px;margin:0;min-height:46px}
.aqf .btn{width:auto;margin:0;border-radius:24px;padding:0 20px;min-height:46px}
@media (max-width:999px){.aqm{font-size:var(--f2);padding:7px 12px}.aqb{width:100%}.aqb h4,.aqb p{font-size:var(--f2)}.aqb h4{padding:8px 12px 4px}.aqr{padding:7px 12px}.aqr .n{font-size:var(--f2)}.aqr.tot .n{font-size:var(--f3)}.aqp,.aqn{padding-inline:12px}.aqr span,.aqr small{line-height:1.35}.aqk button{font-size:var(--f1);min-height:30px;padding:2px 10px}
  body.aqkb nav{display:none}body.aqkb .aqc{position:fixed;inset-inline:0;bottom:0;padding:8px 16px 10px}body.aqkb #p-ask .aqw{padding-bottom:130px}}
@media (min-width:1000px){#p-ask{max-width:820px;margin:0 auto}.aqc{bottom:0}}
`;
function css() { if (!document.getElementById('askCss')) { const st = document.createElement('style'); st.id = 'askCss'; st.textContent = CSS; document.head.appendChild(st); } }

const S = {db: null, msgs: [], ctx: {}};
const CHIPS = ['مين عليه فلوس كتير', 'مبيعات الشهر ده', 'أرباح الشهر اللي فات', 'الخزنة فيها كام', MK_PN + ' جاب كام الأسبوع ده', 'أمثلة'];
function cardHtml(c) {
  if (c.t === 'text') return `<div class="aqb"><p>${c.h}</p>${actsHtml(c)}</div>`;
  return `<div class="aqb">${c.title ? `<h4>${esc(c.title)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</h4>` : ''}
    ${c.h ? `<p>${c.h}</p>` : ''}
    ${c.rows.map((r, i) => `<div class="aqr ${r.cls === 'tot' ? 'tot' : ''}${c.go && c.go[i] ? ' lnk' : ''}"${c.go && c.go[i] ? ` data-a="p|${esc(c.go[i])}" role="button"` : ''}><span>${esc(r.l)}${r.s ? `<small>${esc(r.s)}</small>` : ''}</span>${r.v === '' ? '' : `<b class="n ${r.cls === 'in' ? 'in' : r.cls === 'out' ? 'out' : ''}"${typeof r.v === 'number' ? '' : ' dir="rtl"'}>${esc(fm(r.v))}</b>`}</div>`).join('')}
    ${c.picks ? `<div class="aqp">${c.picks.map(k => `<button type="button" data-a="${esc(k.a)}">${esc(k.l)}${k.s ? `<small>${esc(k.s)}</small>` : ''}</button>`).join('')}</div>` : ''}
    ${c.note ? `<div class="aqn">${esc(c.note)}</div>` : ''}${actsHtml(c)}</div>`;
}
const actsHtml = c => c.acts && c.acts.length ? `<div class="aqa">${c.acts.map(a => `<button type="button" data-a="${esc(a.a)}">${esc(a.l)}</button>`).join('')}</div>` : '';
function msgHtml(m) { return m.me ? `<div class="aqm">${esc(m.q)}</div>` : m.cards.map(cardHtml).join(''); }
/* آخر سؤال يطلع فوق علشان الإجابة تتقري من أولها (لو قصيرة الصفحة بتقف عند آخرها لوحدها) */
/* الآيفون: الكيبورد بيغطي الصفحة من غير ما يصغّرها، فالخانة بتتحط فوقه بالظبط (visualViewport) */
function kbPos() { const c = $('#p-ask .aqc'), vv = window.visualViewport; if (!c || !vv || !document.body.classList.contains('aqkb')) return; c.style.bottom = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)) + 'px'; }
if (window.visualViewport) { visualViewport.addEventListener('resize', kbPos); visualViewport.addEventListener('scroll', kbPos); }
function scrollEnd() { const q = [...document.querySelectorAll('#aqW .aqm')].pop() || $('#aqEnd'); if (q) q.scrollIntoView({block: 'start'}); }
function draw() {
  css();
  const pg = $('#p-ask');
  pg.innerHTML = `${isWide() ? '' : `<div class="sech ppbar tb" style="margin-top:0"><a id="aqBack">→<em> رجوع</em></a><b class="tt">اسأل الحسابات</b><span></span></div>`}
    <div class="aqw" id="aqW">${S.msgs.length ? '' : `<div class="aqb aqhi"><p>اسألني عن أي حاجة في الحسابات بكلامك العادي: عميل سحب كام، مين عليه فلوس، أرباح شهر، ${esc(MK_PN)} جاب كام، الخزنة فيها كام…</p><p class="aqn">الإجابة من نفس أرقام التقارير والكشوف، والكلام بيتمسح لما تقفل البرنامج.</p></div>`}${S.msgs.map(msgHtml).join('')}<div id="aqEnd"></div></div>
    <div class="aqc"><div class="aqk">${CHIPS.map(c => `<button type="button" data-a="q|${esc(c)}">${esc(c)}</button>`).join('')}<button type="button" data-a="miss" id="aqMiss">مفهمتهاش</button></div>
    <form class="aqf" id="aqF" autocomplete="off"><input class="inp" id="aqI" placeholder="اكتب سؤالك…" enterkeyhint="send" autocomplete="off"><button class="btn gold" type="submit" aria-label="ابعت">ابعت</button></form></div>`;
  if ($('#aqBack')) $('#aqBack').onclick = () => history.length > 1 ? history.back() : go('home');
  /* وانت بتكتب على الموبايل الشريط اللي تحت بيستخبى علشان ميطلعش فوق الكيبورد */
  $('#aqI').onfocus = () => { document.body.classList.add('aqkb'); kbPos(); }; $('#aqI').onblur = () => setTimeout(() => { if (document.activeElement === $('#aqI')) return; document.body.classList.remove('aqkb'); const c = $('#p-ask .aqc'); if (c) c.style.bottom = ''; }, 250);
  /* الدوسة على "ابعت" أو اقتراح: الكيبورد يفضل مفتوح والخانة متتحركش، فالدوسة توصل من أول مرة (كانت بتقفل الكيبورد بس) */
  $$('#aqF button, #p-ask .aqk button').forEach(b => b.addEventListener('pointerdown', e => { if (document.activeElement === $('#aqI')) e.preventDefault(); }));
  /* الآيفون: منع pointerdown مش كفاية، الكيبورد بيتقفل مع آخر اللمسة والدوسة بتضيع (كان لازم يدوس مرتين).
     فاللمسة بتتنفذ في touchend نفسه ومن غير click بعدها، لو الصباع متحركش (يعني مش بيمرر الاقتراحات) */
  $$('#aqF button, #p-ask .aqk button').forEach(b => { let x0 = 0, y0 = 0;
    b.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, {passive: true});
    b.addEventListener('touchend', e => { const t = e.changedTouches[0]; if (!e.cancelable || !t || Math.abs(t.clientX - x0) > 10 || Math.abs(t.clientY - y0) > 10) return; e.preventDefault(); b.click(); }); });
  $('#aqF').onsubmit = e => { e.preventDefault(); const v = $('#aqI').value.trim(); if (!v) return; $('#aqI').value = ''; ask(v); };
  pg.onclick = e => { const b = e.target.closest('[data-a]'); if (b && pg.contains(b)) act(b.dataset.a); };
  missLoad().then(L => { const b = $('#aqMiss'); if (b) { b.textContent = `مفهمتهاش (${L.length})`; b.style.display = L.length ? '' : 'none'; } });
  requestAnimationFrame(scrollEnd);
}
function push(m) { S.msgs.push(m); const w = $('#aqW'); if (!w) return; const hi = w.querySelector('.aqhi'); if (hi) hi.remove(); const d = document.createElement('div'); d.innerHTML = msgHtml(m); $('#aqEnd').before(...d.childNodes); requestAnimationFrame(scrollEnd); }
function ask(q, force) {
  if (!force) push({me: true, q});
  let r;
  try { r = force ? answer(S.ctx.pending || q, Object.assign({}, S.ctx, {pending: ''}), force) : answer(q, S.ctx); }
  catch (e) { console.error(e); r = {cards: [txt('حصلت مشكلة وأنا بحسب. جرّب تكتب السؤال بشكل تاني.')], ctx: S.ctx}; }
  S.ctx = r.ctx || {};
  if (!r.cards.length) { missAdd(q).then(() => missLoad()).then(L => { const b = $('#aqMiss'); if (b) { b.textContent = `مفهمتهاش (${L.length})`; b.style.display = ''; } }); r.cards = [txt('السؤال ده لسه مش فاهمه، وحفظته في "مفهمتهاش" علشان يتعلّمه. جرّب واحد من دول:'), suggest(r.U)]; }
  delete S.ctx.miss;
  push({cards: r.cards});
}
function suggest(U) {
  const L = [];
  if (U && U.party) L.push(U.party.best.o.p.name + ' عليه كام', U.party.best.o.p.name + ' سحب كام الشهر ده');
  L.push('مبيعات الشهر ده', 'مين عليه فلوس كتير', 'أرباح الشهر اللي فات', 'الخزنة فيها كام');
  return card('', '', [], {picks: L.slice(0, 5).map(l => ({l, a: 'q|' + l}))});
}
function act(a) {
  const [k, x, f, t] = a.split('|');
  if (k === 'q') { if (x === 'أمثلة') { push({me: true, q: 'أمثلة'}); push({cards: [helpCard()]}); return; } $('#aqI').value = x; if (/ $|^ /.test(x) || x.split(' ').length < 2) { $('#aqI').focus(); return; } $('#aqI').value = ''; ask(x); return; }
  if (k === 'pk') { const p = P.get(x); push({me: true, q: p ? p.name : ''}); ask(p ? p.name : '', x); return; }
  if (k === 'p') return go('p/' + x);
  if (k === 's') { const p = P.get(x); if (!p) return; stmtModal(p); const m = f ? 'range' : 'all', b = $(`#smMode [data-m="${m}"]`); if (b) b.click(); if (f && $('#smFrom')) { $('#smFrom').value = f; $('#smTo').value = t; $('#smFrom').onchange(); } return; }
  if (k === 'r') { repKind = x; if (f) { repMode = 'range'; repFrom = f; repTo = t; } if (x === 'col') { repColMode = f && f.slice(0, 7) === t.slice(0, 7) ? 'week' : 'month'; if (f) { repMonth = f.slice(0, 7); repYear = f.slice(0, 4); } } go('rep'); return; }
  if (k === 'c') return go('cash');
  if (k === 'j') return go('jrd');
  if (k === 'iv') return go('jrd/iv');
  if (k === 'm') return go('mkt');
  if (k === 'pt') return go('part');
  if (k === 'miss') return missModal();
}
async function missModal() {
  const L = await missLoad();
  modal(`<h3>أسئلة مفهمتهاش (${L.length})</h3><p class="hint">ابعتها لمصطفى/المبرمج علشان الشات يتعلّمها. محفوظة متشفرة على الجهاز ده بس.</p>
    <div style="max-height:50vh;overflow:auto">${L.slice().reverse().map(x => `<div class="aqr"><span>${esc(x.q)}<small>${dispDate(isoOf(x.at))}</small></span></div>`).join('') || '<div class="empty">مفيش</div>'}</div>
    <div class="stack" style="margin-top:10px"><button class="btn green" id="amShare" type="button">انسخ / ابعتهم</button><button class="btn line" id="amClr" type="button">امسح القايمة</button><button class="btn line" id="amX" type="button">رجوع</button></div>`);
  $('#amX').onclick = closeModal;
  $('#amClr').onclick = async () => { await missClear(); closeModal(); draw(); };
  $('#amShare').onclick = async () => { const s = 'أسئلة الشات اللي مفهمهاش:\n' + L.map(x => '- ' + x.q).join('\n');
    try { if (navigator.share) await navigator.share({text: s}); else { await navigator.clipboard.writeText(s); toast('اتنسخوا ✔'); } } catch (e) { try { await navigator.clipboard.writeText(s); toast('اتنسخوا ✔'); } catch (x) {} } };
}
/* نافذة الصفحة: الكلام بيتمسح لما البرنامج يتقفل (db بيتغير) */
window.askRender = () => { if (S.db !== db) { S.db = db; S.msgs = []; S.ctx = {}; MISS = null; } draw(); setTimeout(() => { if (!matchMedia('(pointer:coarse)').matches && $('#aqI')) $('#aqI').focus(); }, 50); };
/* للاختبارات: الإجابة كنص بسيط من غير شاشة */
window.askText = (q, ctx) => { const r = answer(q, ctx || {}); return {cards: r.cards.map(c => ({title: c.title || '', sub: c.sub || '', h: (c.h || '').replace(/<[^>]+>/g, ''), rows: (c.rows || []).map(x => [x.l, x.v === '' ? '' : fm(x.v), x.s || '']), picks: (c.picks || []).map(k => k.l), acts: (c.acts || []).map(k => k.a)})), ctx: r.ctx}; };
window.askAnswer = answer;
window.askPeriods = t => periods(unfill(AN(t))).list;
})();
