/* ====================== اسأل Claude (ملف الحسابات) ======================
   زرار في شات "اسأل الحسابات": بيعمل ملف نص فيه الحسابات (الأرصدة والخزن والأرباح وكل الحركات للفترة اللي تختارها)
   وصفحة "اقراني الأول" بتشرح المصنع، ويبعته لتطبيق Claude من قايمة المشاركة بتاعة الموبايل (navigator.share).
   - قراية بس: مبيكتبش في db ولا بيلمس أي تخزين، والملف بيتعمل في الذاكرة ومبيتحفظش على الموبايل (اللاب: بيتنزل لو مفيش مشاركة).
   - كل رقم من نفس دوال البرنامج (allBalances/balance/vaultBal/profitOf)، فالرقم = رقم الشاشة.
   - "كل حاجة" = من الأول + الحركات الملغية وسجل التعديلات والمساهمين والجرد ووارد السوق.
   - بيتحمّل لما تدوس زرار Claude بس (loadClaude في accounts.html)، فمبيتقّلش فتح البرنامج. */
(() => {
'use strict';

const clean = x => String(x === undefined || x === null ? '' : x).replace(/[|\r\n]+/g, ' ').trim();
const row = a => a.map(clean).join(' | ');
const money = c => fmtP(c || 0);

/* تعليمات لـ Claude في أول الملف (بدل رسالة تتنسخ بإيد) */
const STARTER = `## تعليمات لـ Claude (اقراها قبل أي حاجة)
- الملف ده من برنامج حسابات مصنعي (فلاش أون). كل شوية هبعتلك نسخة جديدة منه في نفس المحادثة، وصفحة "اقراني الأول" تحت بتشرح كل حاجة.
- رد عليا بالعامية المصرية وبالجنيه، وبكلام بسيط من غير مصطلحات محاسبة صعبة.
- اعتمد على آخر ملف بعتهولك بس في الأرقام، ولو حاجة مش موجودة في الملف قولي إنها مش موجودة، متخمّنش.
- لما تحسب رقم قولي جبته منين (أنهي جدول أو أنهي حركات).
- لو لقيت حاجة غريبة (فاتورة متكررة، مبلغ غريب، عميل وقف فجأة) نبهني حتى لو مسألتش.
- لو بعتلك الملف من غير سؤال، قولي في سطرين أهم حاجة لاحظتها، واستنى سؤالي.
`;

const README = `## اقراني الأول (شرح الملف)
- ده ملف من برنامج حسابات مصنع "فلاش أون". الفلوس كلها بالجنيه المصري. صاحب المصنع اسمه ${MK_ME}، ورد عليه بالعامية المصرية.
- **الحسابات 3 أقسام:** "عميل سوق" (تجار السوق، و${MK_PN} هو اللي بيلف عليهم ويحصّل منهم)، "عميل مواقع" (عملاء المشاريع والمواقع)، و"مورد" (اللي بنشتري منهم خامات).
- **الرصيد:** موجب = "عليه" يعني الحساب مديون للمصنع. سالب = "ليه" يعني المصنع مديون له (غالباً الموردين). "خالص" = صفر.
- **"خارج الإجمالي":** حساب فرعي مش داخل في إجمالي المبيعات (غالباً فرع لعميل تاني وفواتيره بتتنقل لحسابه الأساسي).
- **أنواع الحركات في جدول الحركات:** فاتورة بيع (العميل خد بضاعة)، دفعة مستلمة (العميل دفع)، فاتورة شراء (اشترينا من مورد)، دفعة مدفوعة (دفعنا لمورد)، مرتجع بيع/شراء، خصم / تسوية، رصيد أول المدة (رصيد قديم قبل البرنامج)، حركة قديمة.
- **عمود "مدين" بيزوّد** اللي على الحساب، و**"دائن" بيقلله**. الرصيد = مجموع المدين - مجموع الدائن من أول الحساب.
- **دفعات العملا والموردين** هي نفسها اللي بتدخل أو تطلع من الخزنة (مكتوب جنبها اسم الخزنة)، ومش متكررة في جدول حركات الخزنة.
- **جدول حركات الخزنة:** المصروفات والإيرادات التانية والتحويلات بين الخزن. "تحويل" مش مصروف ولا دخل، فلوس بتتنقل من خزنة لخزنة.
- **${MK_PN} وحركة السوق:** خزنة اسمها "خزنة السوق" = الفلوس اللي مع ${MK_PN} من التحصيل. لما يسلّم فلوس لـ${MK_ME} بتبقى تحويل من خزنة السوق لخزنة ${MK_ME}. ومصاريف السوق بند لوحده.
- **توحيد الخزن:** كل الخزن اتوحدت في خزنة واحدة اسمها "كاش" بتاعة مصطفى. أي فلوس جاية فودافون أو إنستا أو بنك بتدخل فيها. أي تحويل من حركة السوق = فلوس وصلت لمصطفى.
- **دفعات السوق القديمة** اللي مكتوب فيها "إنستا" أو "تحويل" ومن غير خزنة (قبل 12/10/2026) دي من قبل توحيد الخزن، وفلوسها وصلت لمصطفى. جرد يوم 12/10/2026 صفّر الخزن القديمة وظبط الكاش على الواقع. متعتبرهاش غلطة ومتطلبش تعديلها.
- **جرد 17/10/2026 = نقطة البداية:** البرنامج كان لسه جديد وفيه تسجيلات غلط، وجرد يوم 17/10/2026 (عجز 102,015) ظبط الكاش على الواقع وبقى 607,800. أي فروق أو تسويات قبل اليوم ده معروفة ومتعتبرهاش غلطة ومتطلبش تعديلها. المراجعة والتنبيه على الغلط يبدأوا من الحركات اللي بعد 17/10/2026.
- **الشركاء:** مرتب الشريك ومسحوباته بتتخصم من الأرباح في سطر "الشركاء". **المساهمين:** رأس المال والسحب بتوعهم مش مصروف ولا إيراد، ونصيبهم من الربح بيتخصم في عمود "المساهمين".
- **تسوية الجرد** بتظبط رصيد الخزنة بس، ومش ربح ولا خسارة.
- **الأرباح:** المبيعات - المشتريات - المصروفات + الإيرادات التانية = "قبل الشركاء"، وبعدها يتخصم الشركاء والمساهمين = "بعد الشركاء".
- التواريخ يوم/شهر/سنة. الجداول مفصولة بعلامة |.
- في ملف "كل حاجة": الحركات الملغية (اتمسحت من الحسابات ومش داخلة في أي رصيد) وسجل التعديلات (القيم القديمة قبل التعديل) بس للمعلومة، والأرصدة والأرباح محسوبة من الحركات الشغالة بس.
`;

function rangeOf(k) {
  const t = todayISO();
  if (k === 'm') return [t.slice(0, 8) + '01', t, 'الشهر ده'];
  if (k === '3m') { const d = new Date(t); d.setMonth(d.getMonth() - 2); return [isoOf(d.getTime()).slice(0, 8) + '01', t, 'آخر 3 شهور']; }
  if (k === 'y') return [t.slice(0, 4) + '-01-01', t, 'السنة دي'];
  return ['', t, k === 'full' ? 'كل حاجة' : 'من الأول'];
}
function lastDates() {
  const inv = new Map(), pay = new Map();
  for (const e of db.entries) {
    if (e.del) continue;
    const m = e.kind === 'inv' || e.kind === 'pur' ? inv : isPay(e) ? pay : null;
    if (m && (!m.has(e.party) || m.get(e.party) < e.date)) m.set(e.party, e.date);
  }
  return {inv, pay};
}
const SEC_ORD = {mkt: 0, site: 1, sup: 2};
function entText(e) {
  if (isDoc(e)) return KIND[e.kind] + (e.disc ? ` (خصم ${money(e.disc)})` : '') + (e.note ? ' — ' + e.note : '');
  return noRef(docTitle(e)) + (isPay(e) && e.note ? ' — ' + e.note : '');
}
const linesText = e => (e.lines || []).map(l => `${l.name} ${fmtQ(l.qty)}${l.unit ? ' ' + l.unit : ''} × ${money(l.price)} = ${money(lineTot(l))}`).join('؛ ');

function build(k) {
  const [f, t, lbl] = rangeOf(k), bal = allBalances(), ld = lastDates(), out = [];
  const ents = db.entries.filter(e => !e.del && P.get(e.party) && (!f || e.date >= f) && e.date <= t)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0));
  const txs = db.txs.filter(x => !x.del && (!f || x.date >= f) && x.date <= t).sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0));
  out.push(`# حسابات مصنع فلاش أون — ${lbl}`, '',
    `اتعمل يوم ${dispDate(todayISO())}. الفترة: ${f ? `من ${dispDate(f)} لحد ${dispDate(t)}` : `من أول الحسابات لحد ${dispDate(t)}`}. فيه ${ents.length} حركة حساب و${txs.length} حركة خزنة.`, '', STARTER, README);

  /* الأرصدة دلوقتي */
  const ps = liveParties().slice().sort((a, b) => (SEC_ORD[a.sec] - SEC_ORD[b.sec]) || Math.abs(bal.get(b.id) || 0) - Math.abs(bal.get(a.id) || 0));
  out.push('## الأرصدة النهارده (كل الحسابات)', '', row(['الاسم', 'القسم', 'الرصيد', 'عليه/ليه', ...(f ? ['الرصيد أول الفترة'] : []), 'آخر فاتورة', 'آخر دفعة', 'ملاحظة']));
  for (const p of ps) {
    const b = bal.get(p.id) || 0;
    out.push(row([p.name, SEC1[p.sec], money(Math.abs(b)), balWord(b), ...(f ? [money(balance(p.id, f))] : []), dispDate(ld.inv.get(p.id)) || '—', dispDate(ld.pay.get(p.id)) || '—', p.noTot ? 'خارج الإجمالي' : '']));
  }
  const tot = s => ps.filter(p => p.sec === s && !p.noTot).reduce((n, p) => n + (bal.get(p.id) || 0), 0);
  out.push('', `الإجمالي: عملاء السوق ${money(tot('mkt'))}، عملاء المواقع ${money(tot('site'))}، الموردين ${money(Math.abs(tot('sup')))} ${balWord(tot('sup'))}.`, '');

  /* الخزن */
  out.push('## الخزن النهارده', '', row(['الخزنة', 'الرصيد']));
  vaultsL().forEach(v => out.push(row([v.name, money(vaultBal(v.id))])));
  out.push(row(['إجمالي خزن ' + MK_ME, money(vaultBal(''))]));
  if (IDX.vault.get(MKV)) out.push(row([`خزنة السوق (مع ${MK_PN})`, money(vaultBal(MKV))]));
  out.push('');

  /* الأرباح شهر بشهر */
  const first = f || [...db.entries.filter(e => !e.del).map(e => e.date), ...db.txs.filter(x => !x.del).map(x => x.date)].sort()[0] || t;
  out.push('## الأرباح شهر بشهر', '', row(['الشهر', 'المبيعات', 'المشتريات', 'المصروفات', 'إيرادات تانية', 'قبل الشركاء', 'الشركاء', 'المساهمين', 'بعد الشركاء']));
  for (let m = first.slice(0, 7); m <= t.slice(0, 7);) {
    const [y, mo] = m.split('-').map(Number), ms = m + '-01' < first ? first : m + '-01', me0 = m + '-' + pad2(new Date(y, mo, 0).getDate()), me = me0 > t ? t : me0, x = profitOf(ms, me);
    out.push(row([`${AR_MONTHS[mo - 1]} ${y}`, money(x.sales), money(x.purch), money(x.exp), money(x.inc), money(x.before), money(x.part), money(x.iv), money(x.after)]));
    m = mo === 12 ? `${y + 1}-01` : `${y}-${pad2(mo + 1)}`;
  }
  const all = profitOf(first, t);
  out.push(row(['الفترة كلها', money(all.sales), money(all.purch), money(all.exp), money(all.inc), money(all.before), money(all.part), money(all.iv), money(all.after)]), '');

  /* حركات الحسابات */
  out.push('## حركات الحسابات (الأقدم فوق)', '', row(['التاريخ', 'الحساب', 'القسم', 'النوع', 'البيان', 'مدين', 'دائن', 'الأصناف']));
  for (const e of ents) {
    const p = P.get(e.party);
    out.push(row([dispDate(e.date), p.name, SEC1[p.sec], KIND[e.kind] || 'حركة', entText(e), e.dr ? money(e.dr) : '', e.cr ? money(e.cr) : '', linesText(e)]));
  }
  out.push('');

  /* حركات الخزنة */
  out.push('## حركات الخزنة (مصروفات وإيرادات وتحويلات، الأقدم فوق)', '', row(['التاريخ', 'النوع', 'البند', 'من خزنة', 'لخزنة', 'المبلغ', 'ملاحظة']));
  for (const x of txs) {
    const who = x.pt ? 'الشريك ' + partName(x.pt) : x.iv && ivGet(x.iv) ? 'المساهم ' + ivGet(x.iv).name : '';
    out.push(row([dispDate(x.date), TXT[x.type] || x.type, x.type === 'tr' ? 'تحويل' : cName(x.cat) + (who ? ' — ' + who : ''), vName(x.vault), x.type === 'tr' ? vName(x.to) : '', money(x.amt), x.note || '']));
  }
  if (k === 'full') full(out);
  return {text: out.join('\n') + '\n', n: ents.length + txs.length, lbl};
}

/* "كل حاجة": الباقي اللي في الحسابات حرفياً */
const histTxt = h => (h || []).map(x => `${dispDate(x.date)} ${x.desc ? noRef(x.desc) + ' ' : ''}${x.dr ? 'مدين ' + money(x.dr) : x.cr ? 'دائن ' + money(x.cr) : x.amt ? money(x.amt) : ''}`.trim()).join('؛ ');
function full(out) {
  const edited = db.entries.filter(e => !e.del && P.get(e.party) && e.hist && e.hist.length);
  out.push('', '## سجل التعديلات (الحركات اللي اتعدّلت وقيمها القديمة)', '', row(['تاريخ الحركة', 'الحساب', 'النوع', 'دلوقتي', 'اتعدّلت كام مرة', 'القيم القديمة']));
  edited.forEach(e => out.push(row([dispDate(e.date), P.get(e.party).name, KIND[e.kind] || 'حركة', money(e.dr || e.cr), e.hist.length, histTxt(e.hist)])));
  db.txs.filter(x => !x.del && x.hist && x.hist.length).forEach(x => out.push(row([dispDate(x.date), 'الخزنة: ' + cName(x.cat), TXT[x.type] || '', money(x.amt), x.hist.length, histTxt(x.hist)])));
  out.push('', '## الحركات الملغية (مش داخلة في أي رصيد)', '', row(['التاريخ', 'الحساب', 'النوع', 'البيان', 'المبلغ']));
  db.entries.filter(e => e.del).forEach(e => { const p = P.get(e.party) || IDX.party.get(e.party); out.push(row([dispDate(e.date), p ? p.name : '؟', KIND[e.kind] || 'حركة', entText(e), money(e.dr || e.cr)])); });
  db.txs.filter(x => x.del).forEach(x => out.push(row([dispDate(x.date), 'الخزنة: ' + vName(x.vault), TXT[x.type] || '', x.type === 'tr' ? 'تحويل لـ ' + vName(x.to) : cName(x.cat) + (x.note ? ' — ' + x.note : ''), money(x.amt)])));
  db.parties.filter(p => p.del).forEach(p => out.push(row(['', p.name, 'حساب اتشال', SEC1[p.sec], ''])));
  const ivs = (db.ivps || []).filter(v => !v.del);
  if (ivs.length) {
    out.push('', '## المساهمين (حركاتهم)', '', row(['التاريخ', 'المساهم', 'النوع', 'المبلغ (+ له / − عليه)', 'ملاحظة']));
    (db.ivrs || []).filter(r => !r.del).sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(r => { const v = IDX.ivp.get(r.iv);
      out.push(row([dispDate(r.date), v ? v.name : '؟', {cap: 'رأس مال', prof: 'ربح', ship: 'شحنة', exp: 'مصروف', draw: 'سحب'}[r.k] || r.k, money(ivSign(r)), r.note || ''])); });
  }
  const stk = (db.stks || []).filter(r => !r.del).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (stk.length) { out.push('', '## الجرد (قيمة البضاعة اللي في المخزن يوم الجرد)', '', row(['التاريخ', 'قيمة المخزون'])); stk.forEach(r => out.push(row([dispDate(r.date), money(r.stock)]))); }
  const ops = db.mkt && db.mkt.ops ? Object.values(db.mkt.ops).filter(o => !o.del && o.t !== 'cust' && o.t !== 'sup') : [];
  if (ops.length && typeof mkWhat === 'function') {
    const ST = {new: 'مستنية في الوارد', back: 'رجعت لـ' + MK_PN, done: 'اتنقلت للحسابات', ign: 'اتجاهلت'};
    out.push('', `## وارد السوق (كل اللي سجّله ${MK_PN} في تطبيقه)`, '', row(['التاريخ', 'الحركة', 'المبلغ', 'الحالة']));
    ops.sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach(o => { let w = ''; try { w = mkWhat(o); } catch (e) { w = o.t; } let st = ''; try { st = ST[mkState(o)] || ''; } catch (e) {}
      out.push(row([o.ts ? dispDate(isoOf(o.ts)) : '', w, money(o.amt), st])); });
  }
}

let pick = 'y';
function open() {
  modal(`<h3>اسأل Claude عن حساباتك</h3>
    <p class="hint">البرنامج بيعمل ملف فيه حساباتك وتعليمات Claude، ويبعته لتطبيق Claude. من قايمة المشاركة اختار Claude، وبعدين اختار محادثة "حسابات المصنع" (أو ابدأ محادثة جديدة).</p>
    <div class="seg" id="clP">${[['m', 'الشهر ده'], ['3m', '3 شهور'], ['y', 'السنة دي'], ['all', 'من الأول'], ['full', 'كل حاجة']].map(([k, l]) => `<button type="button" data-k="${k}" class="${k === pick ? 'on' : ''}">${l}</button>`).join('')}</div>
    <p class="hint" id="clInfo" style="margin:8px 0"></p>
    <button class="btn gold" id="clGo" type="button">ابعت الملف لـ Claude</button>
    <p class="hint" style="margin-top:8px">الملف فيه كل أرقامك من غير تشفير، فمتبعتهوش لحد تاني. البرنامج مبيحفظهوش على الموبايل.</p>
    <button class="btn line" id="clX" type="button" style="margin-top:8px">رجوع</button>`);
  let cur = null;
  const info = () => { cur = build(pick); $('#clInfo').textContent = `${cur.lbl}: ${cur.n} حركة، حجم الملف ${Math.max(1, Math.round(new Blob([cur.text]).size / 1024))} كيلو.`; };
  $$('#clP button').forEach(b => b.onclick = () => { pick = b.dataset.k; $$('#clP button').forEach(x => x.classList.toggle('on', x === b)); info(); });
  info();
  $('#clX').onclick = closeModal;
  $('#clGo').onclick = async () => {
    const name = `flashon-accounts-${todayISO()}.txt`, file = new File([cur.text], name, {type: 'text/plain'});
    if (navigator.canShare && navigator.canShare({files: [file]})) {
      try { await navigator.share({files: [file], title: 'حسابات المصنع'}); closeModal(); }
      catch (e) { if (e && e.name !== 'AbortError') toast('المشاركة موقفتش. جرّب تاني.'); }
      return;
    }
    /* اللاب (مفيش مشاركة ملفات): بيتنزل وترفعه في Claude بإيدك */
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('الملف اتنزل ✔ ارفعه في محادثة Claude، وامسحه بعدها', 6000);
  };
}
window.claudeOpen = open;
window.claudeBuild = build;   // للاختبار
})();
