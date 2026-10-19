/* ====================== دكتور البيانات (فحص الحسابات) ======================
   بيعدّي على قواعد لازم تبقى صح دايماً (كل حركة ليها صاحب، الرقم المحسوب بطريقتين لازم يطلع واحد، مفيش تاريخ أو مبلغ مستحيل).
   - قراية بس: مبيصلّحش ولا بيغيّر أي حركة أو رصيد. بيرجّع قايمة، وaccounts.html هو اللي بيعرضها ويبعتها تليجرام (docSoon/docWeek).
   - bad = غلط أكيد (قاعدة اتكسرت). warn = حاجة تستاهل تبص عليها (ممكن تكون صح). info = أرقام للعلم بس، مبتعملش تنبيه.
   - كل مشكلة ليها k ثابت: نفس المشكلة = نفس k، فالتنبيه "على طول" بيتبعت مرة واحدة لكل مشكلة جديدة بس.
   - الحاجات المشكوك فيها (المتكرر والخزنة بالسالب) من يوم الجرد اللي بدأنا منه (DOC_FROM) بس، زي "اقراني الأول" في lib/claude.js.
   - full = الفحص الأسبوعي وزرار "افحص دلوقتي": بيزود سرعة الحفظ ومساحة الموبايل (أتقل شوية). */
(() => {
'use strict';

const DOC_FROM = '2026-10-17';
const DAY = 86400000;
const okDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(new Date(d + 'T12:00:00')) && isoOf(new Date(d + 'T12:00:00').getTime()) === d;
const pName = id => (P.get(id) || {name: '؟'}).name;
const amtOf = e => e.dr || e.cr || 0;

window.docRun = async function docRun(full) {
  const bad = [], warn = [], info = [];
  const B = (k, t, go) => bad.push({k, t, go}), W = (k, t, go) => warn.push({k, t, go});
  const now = nowS(), today = todayISO(), far = isoOf(now + 31 * DAY), live = db.entries.filter(e => !e.del), txs = db.txs.filter(t => !t.del);

  /* ١) المراجعة القديمة (selfCheck): حركة على حساب مش موجود، مبلغ مش سليم، إجمالي فاتورة مش مساوي لأصنافها... */
  selfCheck().forEach(t => B('sc:' + t, t));

  /* ٢) كل سجل ليه رقم لوحده (لو اتكرر، واحد منهم مش بيبان في الحسابات) */
  Object.entries(STORE).forEach(([k, a]) => {
    const seen = new Set(), dup = new Set();
    db[a].forEach(r => { if (seen.has(r.id)) dup.add(r.id); seen.add(r.id); });
    dup.forEach(id => B('dupid:' + k + id, `سجل متكرر مرتين بنفس الرقم (${k})`));
  });

  /* ٣) الدفعة رقم واحد في الحساب وفي الخزنة (الحساب بيقرا dr/cr والخزنة بتقرا amt) */
  live.forEach(e => {
    if (e.kind === 'pay' && (e.cr || 0) !== (e.amt || 0) || e.kind === 'ppay' && (e.dr || 0) !== (e.amt || 0))
      B('payamt:' + e.id, `دفعة "${pName(e.party)}" يوم ${dispDate(e.date)}: رقمها في الحساب (${fmtP(amtOf(e))}) غير رقمها في الخزنة (${fmtP(e.amt)})`, 'p/' + e.party);
  });

  /* ٤) رصيد أول المدة سطر واحد بس في كل حساب */
  const opens = new Map();
  live.forEach(e => { if (e.kind === 'open') opens.set(e.party, (opens.get(e.party) || 0) + 1); });
  opens.forEach((n, pid) => { if (n > 1 && P.get(pid) && !P.get(pid).del) B('open2:' + pid, `حساب "${pName(pid)}" فيه ${n} رصيد أول المدة (المفروض واحد)`, 'p/' + pid); });

  /* ٥) نفس الرقم بطريقتين: رصيد كل عميل = جمع حركاته واحدة واحدة من أول الكشف */
  const bal = allBalances(), run = new Map();
  db.entries.forEach(e => { if (!e.del && bal.has(e.party)) run.set(e.party, (run.get(e.party) || 0) + (e.dr || 0) - (e.cr || 0)); });
  bal.forEach((v, pid) => { if (v !== (run.get(pid) || 0) || v !== balance(pid)) B('bal2:' + pid, `رصيد "${pName(pid)}" طالع رقمين مختلفين لما يتحسب بطريقتين`, 'p/' + pid); });

  /* ٦) نفس الرقم بطريقتين: رصيد كل خزنة = رصيدها الأول + كل حركة في كشفها (vaultMoves اللي بيترسم في الشاشة) */
  db.vaults.filter(v => !v.del).forEach(v => {
    const sum = vaultMoves(v.id).reduce((s, m) => s + m.sign * m.amt, v.open || 0) - (txs.filter(t => t.type === 'tr' && !t.nv && t.vault === v.id && t.to === v.id).reduce((s, t) => s + t.amt, 0));
    if (sum !== vaultBal(v.id)) B('vb2:' + v.id, `خزنة "${v.name}": الرصيد مش مساوي لمجموع حركاتها`, 'cash');
  });

  /* ٧) حركات الخزنة: التحويل لنفس الخزنة، والبند اللي مش موجود */
  txs.forEach(t => {
    if (t.type === 'tr' && t.vault === t.to) B('trself:' + t.id, `تحويل ${fmtP(t.amt)} يوم ${dispDate(t.date)} من خزنة لنفسها`, 'cash');
    if ((t.type === 'exp' || t.type === 'inc') && t.cat && !IDX.cat.get(t.cat)) B('cat:' + t.id, `${t.type === 'exp' ? 'مصروف' : 'إيراد'} ${fmtP(t.amt)} يوم ${dispDate(t.date)} على بند مش موجود`, 'cash');
  });

  /* ٨) التواريخ: مكتوبة غلط = غلط أكيد، وبعد أكتر من شهر قدام = غالباً غلطة في السنة */
  /* الوصف بيتعمل بس لو فيه مشكلة (كان بيتعمل لكل حركة وده كان أبطأ جزء في الفحص) */
  const dateChk = (r, what, go) => {
    if (!okDate(r.date)) B('date:' + r.id, `${what()} تاريخها مش سليم (${r.date || 'فاضي'})`, go());
    else if (r.date > far) W('future:' + r.id, `${what()} بتاريخ ${dispDate(r.date)} (لسه بعد أكتر من شهر)`, go());
    else if (r.date < '2015-01-01') W('old:' + r.id, `${what()} بتاريخ ${dispDate(r.date)} (قديم أوي، يمكن السنة غلط)`, go());
  };
  live.forEach(e => dateChk(e, () => `حركة "${pName(e.party)}" ${fmtP(amtOf(e))}`, () => 'p/' + e.party));
  txs.forEach(t => dateChk(t, () => `حركة خزنة ${fmtP(t.amt)}`, () => 'cash'));

  /* ٩) خزنة رصيدها بالسالب (مستحيل في الحقيقة: الفلوس اللي طلعت أكتر من اللي فيها) */
  vaultsAll().forEach(v => { const b = vaultBal(v.id); if (b < 0) W('neg:' + v.id, `خزنة "${v.name}" رصيدها بالسالب (${fmtP(b)})، يمكن فيه حركة ناقصة أو زيادة`, 'cash'); });

  /* ١٠) شكلها متكررة: نفس الحساب ونفس النوع ونفس المبلغ ونفس اليوم، واتسجلوا ورا بعض في أقل من 10 دقايق */
  const twin = (list, key, title) => {
    const g = new Map();
    list.filter(r => r.date >= DOC_FROM).forEach(r => { const k = key(r); g.set(k, (g.get(k) || []).concat(r)); });
    g.forEach(a => {
      if (a.length < 2) return;
      a.sort((x, y) => (x.at || 0) - (y.at || 0));
      for (let i = 1; i < a.length; i++) if ((a[i].at || 0) - (a[i - 1].at || 0) < 10 * 60000) { title(a[i - 1], a[i]); break; }
    });
  };
  twin(live.filter(e => e.kind !== 'open'), e => [e.party, e.kind, amtOf(e), e.date].join('|'),
    (a, b) => W('twin:' + a.id + b.id, `"${pName(a.party)}": حركتين ${fmtP(amtOf(a))} يوم ${dispDate(a.date)} ورا بعض، ممكن تكون متكررة؟`, 'p/' + a.party));
  twin(txs, t => [t.type, t.vault, t.to || '', t.cat || '', t.amt, t.date].join('|'),
    (a, b) => W('twin:' + a.id + b.id, `حركتين خزنة ${fmtP(a.amt)} يوم ${dispDate(a.date)} ورا بعض، ممكن تكون متكررة؟`, 'cash'));

  /* ١١) حركة في فترة مقفولة اتغيرت بعد ما اتقفلت */
  const lk = lockDate(), lr = IDX.set.get('lock');
  if (lk && lr) {
    live.forEach(e => { if (e.date <= lk && (e.upd || 0) > lr.upd && (e.hist || []).length) W('lock:' + e.id + e.upd, `حركة "${pName(e.party)}" يوم ${dispDate(e.date)} في الفترة المقفولة واتعدلت بعد القفل`, 'p/' + e.party); });
    txs.forEach(t => { if (t.date <= lk && (t.upd || 0) > lr.upd && (t.hist || []).length) W('lock:' + t.id + t.upd, `حركة خزنة يوم ${dispDate(t.date)} في الفترة المقفولة واتعدلت بعد القفل`, 'cash'); });
  }

  /* ١٢) الوارد من الشريك مستني بقاله أكتر من أسبوع */
  try {
    if (mkCreds()) { const old = mkPending().filter(o => now - (o.ts || o.upd || now) > 7 * DAY).length; if (old) W('mkold', `${old} حاجة في وارد السوق مستنية تتنقل بقالها أكتر من أسبوع`, 'mkt'); }
  } catch (e) {}

  /* ١٣) المزامنة والنسخة الاحتياطية */
  const c = db.cfg, tg = c.tg || {};
  if (c.sheetOk && pendingRecs().length && now - (c.lastSync || 0) > 2 * DAY) W('sync', `${pendingRecs().length} حركة لسه موصلتش الشيت، وآخر مزامنة من ${Math.floor((now - (c.lastSync || 0)) / DAY)} يوم`, 'set');
  if (c.audit && !c.audit.ok) W('audit', c.audit.msg, 'set');
  if (tg.rt && tg.rt.ok === false) B('rt', 'تجربة استرجاع النسخة الاحتياطية الشهرية فشلت', 'set');
  if (c.lastBackup && now - c.lastBackup > 3 * DAY) W('bk', `آخر نسخة احتياطية من ${Math.floor((now - c.lastBackup) / DAY)} يوم`, 'set');

  /* للعلم بس: العملا اللي عدّوا الحد الأحمر */
  let red = 0; bal.forEach((v, pid) => { const p = P.get(pid); if (p && p.sec !== 'sup' && v > 0 && v >= limitsOf(p).r) red++; });
  if (red) info.push(`${red} عميل عدّوا الحد الأحمر`);

  /* الأسبوعي بس: سرعة الحفظ (بتطوّل مع السنين، ولما تقرّب من 3 ثواني يبقى وقت "قفل السنة") ومساحة الموبايل */
  let ms = 0;
  if (full) {
    try { const t0 = performance.now(); await seal(cryptoKey, saltU8, db); ms = Math.round(performance.now() - t0); } catch (e) {}
    if (ms > 2500) W('slow', `الحفظ بقى بياخد ${(ms / 1000).toFixed(1)} ثانية. قول لـ Claude: "وقت قفل السنة"`, 'set');
    try { const s = await navigator.storage.estimate(); if (s.quota && s.usage / s.quota > 0.8) W('disk', `مساحة البرنامج على الموبايل قرّبت تتملي (${Math.round(s.usage / s.quota * 100)}%)`, 'set'); } catch (e) {}
  }
  return {bad, warn, info, ms, at: now, n: {p: bal.size, e: live.length, t: txs.length, v: vaultsAll().length}};
};

/* نص الرسالة (تليجرام والنافذة بيستخدموا نفس الكلام) */
window.docText = function docText(r, head) {
  const L = [head];
  if (!r.bad.length && !r.warn.length) L.push('✅ كله سليم');
  r.bad.slice(0, 15).forEach((x, i) => L.push(`❌ ${i + 1}) ${x.t}`));
  r.warn.slice(0, 15).forEach((x, i) => L.push(`⚠️ ${i + 1}) ${x.t}`));
  const more = Math.max(0, r.bad.length - 15) + Math.max(0, r.warn.length - 15);
  if (more) L.push(`… و${more} كمان، افتح البرنامج ← الإعدادات ← فحص البيانات`);
  L.push(`${r.n.e} حركة · ${r.n.p} حساب · ${r.n.t} حركة خزنة · ${r.n.v} خزن` + (r.ms ? ` · الحفظ ${(r.ms / 1000).toFixed(1)} ثانية` : ''));
  r.info.forEach(t => L.push('ℹ️ ' + t));
  if (r.bad.length || r.warn.length) L.push('الفحص مبيغيّرش حاجة لوحده، انت اللي تقرر.');
  return L.join('\n');
};
})();
