'use strict';
/*
  عهدة حسن (بطلبه 29/10/2026) — بيتحمّل وقت الحاجة بس من accounts.html (hsLoad).
  - بيقرا تطبيق المرتبات بتاع حسن (pull من شيته، قراية بس) ويحفظ نسخة في db.pay. مبيكتبش في تطبيق المرتبات ولا شيته أبداً.
  - رقم حسن = اللي فاضل معاه في تطبيق المرتبات (العهدة − المرتبات اللي اتقبضت − السلف − المصاريف)، بنفس حسبة شاشة المصاريف هناك (drawExp).
  - الفلوس اللي اتكتبت "حسن" في الحسابات بتتفهم من المطابقة مع العهدة اللي حسن كتبها (مش من الكلمة):
      نفس المبلغ في حدود 3 أيام = عهدة، الفرق = مرتب الشريك = عهدة + مرتب حسن، مفيش عهدة والمبلغ = المرتب = مرتب، وغير كده بيتسأل.
    والمبلغ بيفضل نازل من نفس الخزنة ونفس اليوم (الرصيد مبيتغيرش)، الاسم بس اللي بيتغير. التعديل بيتحفظ في hist ومفيش مسح.
  - مصروف باسم شريك تاني (زي "أحمد فهيم") بنفس مبلغ المرتب = مرتب الشريك ده.
  - مصاريف حسن بتتنقل بإيد مصطفى (دوسة واحدة) سطر لكل نوع في الأسبوع: t_hs_<خميس>_<wk|adv|oth>، من غير خزنة (nv)،
    فبتدخل الأرباح بس ومبتظهرش في الخزنة. لو حسن عدّل بعد النقل، الأسبوع بيرجع يظهر "اتغيّر" وينفع يتنقل تاني.
*/
const HS_DAYS = 3;
const HS_K = ['wk', 'adv', 'oth'];
const HS_KN = {wk: 'مرتبات العمال', adv: 'سلف العمال', oth: 'مصاريف تانية'};
let hsAt = 0, hsErr = '', hsBusy = null, hsMon = 0;

/* ---------- السحب من شيت المرتبات ---------- */
function hsDb() { const c = payCreds(); let d = db.pay; if (!d || !c || d.u !== c.u) d = db.pay = {u: c ? c.u : '', cur: 0, recs: {}, bal: 0, at: 0}; return d; }
const HS_KEEP = {cus: 1, exp: 1, adv: 1, pd: 1, wk: 1};
async function hsPull(force) {
  const c = payCreds(); if (!c || !db) return false;
  if (hsBusy) return hsBusy;
  if (!force && Date.now() - Math.max(hsAt, (db.pay || {}).at || 0) < 60000 && db.pay && db.pay.u === c.u) return false;
  hsAt = Date.now();
  hsBusy = (async () => {
    const d = hsDb(); let ch = false;
    try {
      for (let i = 0; i < 20; i++) {
        const j = await callSheet({action: 'pull', since: d.cur}, c.u, c.k, 30000);
        if (!j || !j.ok) { hsErr = j && j.error === 'key' ? 'شيت المرتبات رفض المفتاح' : 'شيت المرتبات رد بخطأ'; break; }
        (j.rows || []).forEach(r => {
          if (!HS_KEEP[r.kind] || !r.data) return;
          const x = r.data, o = {k: r.kind, del: !!r.del, upd: r.upd};
          ['amt', 'date', 'note', 'to', 'w', 'thu', 'wk', 'name', 'at', 'by', 'paidBy'].forEach(f => { if (x[f] !== undefined && x[f] !== '') o[f] = x[f]; });
          d.recs[r.id] = o; ch = true;
        });
        d.cur = j.next; hsErr = '';
        if (!j.more) break;
      }
    } catch (e) { hsErr = 'مش قادر يوصل لشيت المرتبات'; }
    d.at = Date.now();
    const b = hsData().bal;
    if (b !== d.bal) { d.bal = b; ch = true; }
    if (ch) saveDB();
    return ch;
  })().finally(() => { hsBusy = null; });
  return hsBusy;
}

/* ---------- البيانات من تطبيق المرتبات (نفس حسبة شاشة المصاريف هناك) ---------- */
const hsWeek = d => thuOnOrAfter(d);   // الأسبوع سبت→خميس والجمعة للخميس الجاي (زي تطبيق المرتبات)
function hsData() {
  const R = Object.entries((db.pay || {}).recs || {}).filter(([, r]) => !r.del).map(([id, r]) => Object.assign({id}, r));
  const W = new Map(R.filter(r => r.k === 'wk').map(r => [r.id, r.name || '؟']));
  const cus = R.filter(r => r.k === 'cus' && r.amt > 0 && r.date), exp = R.filter(r => r.k === 'exp' && r.amt > 0 && r.date);
  const oldWk = new Set(exp.filter(x => x.wk).map(x => x.wk));
  const sp = [];   // كل حاجة حسن صرفها: {k, amt, date, week, who, note}
  exp.forEach(x => sp.push({k: x.wk ? 'wk' : 'oth', amt: x.amt, date: x.date, week: x.wk || hsWeek(x.date), who: x.to || '', note: x.note || ''}));
  R.filter(r => r.k === 'adv' && r.amt > 0 && r.date && W.has(r.w)).forEach(a => sp.push({k: 'adv', amt: a.amt, date: a.date, week: hsWeek(a.date), who: W.get(a.w), note: a.note || ''}));
  R.filter(r => r.k === 'pd' && r.amt > 0 && r.thu && !oldWk.has(r.thu)).forEach(p => sp.push({k: 'wk', amt: p.amt, date: p.date || isoOf(p.at || Date.now()), week: p.thu, who: W.get(p.w) || '؟', note: ''}));
  const tc = cus.reduce((s, r) => s + r.amt, 0), te = sp.reduce((s, r) => s + r.amt, 0);
  const start = [...cus, ...sp].map(r => r.date).sort()[0] || '';
  return {cus, sp, bal: tc - te, start};
}

/* ---------- الشركاء والمرتب ---------- */
const hsPid = () => { const s = partners(); const p = s && (s.list || []).find(x => !x.to && norm(x.name).includes('حسن')); return p ? p.id : ''; };
/* المرتب الثابت (من إعدادات الشركاء) ومرتب أسبوعين، وأي مبلغ اتسجل مرتب شريك قبل كده (لما المرتب بيزيد) */
function hsSals() {
  const s = partners(), out = new Set();
  if (s && s.amt > 0) { out.add(s.amt); out.add(2 * s.amt); }
  db.txs.forEach(t => { if (!t.del && t.cat === 'c_psal' && t.amt > 0) out.add(t.amt); });
  return out;
}
const hsWords = t => catWords(t || '');
const hsIsH = t => { const w = hsWords(t); return w.includes('حسن') && !(w.includes('ابو') && w.includes('شوشه')); };
function hsEnsureCats() {
  ensurePartCats();
  Object.values(HS_CATS).forEach(([id, name]) => { if (!IDX.cat.get(id)) { const r = {id, type: 'exp', name, ord: 98, upd: 1, del: false}; db.cats.push(r); IDX.cat.set(id, r); } });
}
const hsDist = (a, b) => Math.abs((new Date(a) - new Date(b)) / 864e5);

/* ---------- المطابقة: الفلوس اللي اتكتبت عندنا لحسن قصاد العهدة اللي كتبها ---------- */
/* بيرجّع العهدة اللي حسن كتبها ومش لاقية حركة عندنا، والحركات اللي عندنا (عهدة حسن) ومش مكتوبة عنده */
function hsMatch(D) {
  D = D || hsData();
  const from = D.start ? addDays(D.start, -HS_DAYS) : '9999';
  const ours = db.txs.filter(t => !t.del && t.cat === 'c_hsn' && t.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const free = D.cus.slice(), used = new Map();
  ours.forEach(t => {
    const c = free.filter(x => x.amt === t.amt && hsDist(x.date, t.date) <= HS_DAYS).sort((a, b) => hsDist(a.date, t.date) - hsDist(b.date, t.date))[0];
    if (c) { free.splice(free.indexOf(c), 1); used.set(t.id, c); }
  });
  return {theirs: free, ours: ours.filter(t => !used.has(t.id))};
}
/* الاقتراحات: sure = واضحة وبتتطبق بدوسة "صلّح الكل"، ask = محتاجة رأيك */
function hsPlan() {
  const D = hsData(), pid = hsPid(), sal = hsSals(), s = partners(), others = ((s && s.list) || []).filter(p => !p.to && p.id !== pid);
  const from = D.start ? addDays(D.start, -HS_DAYS) : '9999';
  const cand = db.txs.filter(t => !t.del && t.type === 'exp' && !t.nv && !t.pt && !t.iv && !t.hsk && !t.cfix && !SPECIAL_CATS.has(t.cat) && !NOT_PL.has(t.cat) && t.amt > 0 && !isLocked(t.date))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0));
  const free = hsMatch(D).theirs, take = c => free.splice(free.indexOf(c), 1);
  const near = (t, f) => free.filter(x => hsDist(x.date, t.date) <= HS_DAYS && f(x)).sort((a, b) => hsDist(a.date, t.date) - hsDist(b.date, t.date))[0];
  const sure = [], ask = [], left = [];
  cand.forEach(t => {
    if (hsIsH(t.note)) {
      if (t.date < from) { if (pid && sal.has(t.amt)) sure.push({t, kind: 'sal', pid, sal: t.amt}); return; }   // قبل ما حسن يبدأ يكتب في تطبيقه: المرتب بس، والباقي زي ما هو
      const c = near(t, x => x.amt === t.amt);
      if (c) { take(c); sure.push({t, kind: 'cus', cus: t.amt, c}); } else left.push(t);
      return;
    }
    const w = hsWords(t.note), p = others.find(p => { const f = hsWords(p.name)[0]; return f && w.includes(f); });
    if (p && sal.has(t.amt)) sure.push({t, kind: 'sal', pid: p.id, sal: t.amt});
  });
  left.forEach(t => {
    const c = pid && near(t, x => x.amt < t.amt && sal.has(t.amt - x.amt));
    if (c) { take(c); sure.push({t, kind: 'split', cus: c.amt, sal: t.amt - c.amt, pid, c}); return; }
    if (pid && sal.has(t.amt)) { sure.push({t, kind: 'sal', pid, sal: t.amt}); return; }   // نفس المرتب بالظبط = مرتب، حتى لو حسن كتب عهدة تانية قريبة
    const g = near(t, x => x.amt < t.amt);
    ask.push({t, cus: g ? g.amt : t.amt, g, pid});
  });
  return {sure, ask};
}
/* تطبيق اقتراح: نفس المبلغ ونفس الخزنة ونفس اليوم، الاسم بس اللي بيتغير (والقديم في hist) */
function hsApply(it) {
  const t = it.t; if (!t || t.del || isLocked(t.date)) return false;
  hsEnsureCats();
  (t.hist = t.hist || []).push({t: nowS(), date: t.date, desc: `${TXT[t.type]} ${cName(t.cat)} — ${t.nv ? 'من غير خزنة' : vName(t.vault)}${t.note ? ' — ' + t.note : ''}`, dr: t.amt, cr: 0});
  const sal = it.kind === 'sal' ? t.amt : it.kind === 'split' ? it.sal : 0;
  if (it.kind === 'keep') t.hsk = 'exp';
  else if (it.kind === 'sal') Object.assign(t, {cat: 'c_psal', pt: it.pid, pnote: t.pnote || '', hsk: 'sal'});
  else {
    Object.assign(t, {cat: 'c_hsn', hsk: 'cus'});
    if (sal > 0) {
      t.amt = t.amt - sal; t.hsx = sal;
      const id = 't_hss_' + t.id, old = IDX.tx.get(id);
      const r = Object.assign(old || {id, hist: []}, {type: 'exp', amt: sal, vault: t.vault, to: '', cat: 'c_psal', pt: it.pid, pnote: '', note: 'مرتب ' + partName(it.pid), date: t.date, at: t.at || nowS(), del: false, hsk: 'sal'});
      if (t.nv) r.nv = t.nv;
      touch(r); if (!old) { db.txs.push(r); IDX.tx.set(id, r); }
    }
  }
  touch(t);
  return true;
}

/* ---------- نقل مصاريف حسن كل أسبوع ---------- */
function hsWeeks() {
  const D = hsData(), by = new Map();
  D.sp.forEach(x => { const w = by.get(x.week) || {thu: x.week, wk: 0, adv: 0, oth: 0, n: {wk: 0, adv: 0, oth: 0}}; w[x.k] += x.amt; w.n[x.k]++; by.set(x.week, w); });
  db.txs.forEach(t => { const m = /^t_hs_(\d{4}-\d{2}-\d{2})_(wk|adv|oth)$/.exec(t.id); if (m && !by.has(m[1])) by.set(m[1], {thu: m[1], wk: 0, adv: 0, oth: 0, n: {wk: 0, adv: 0, oth: 0}}); });
  return [...by.values()].map(w => {
    const was = {};
    HS_K.forEach(k => { const r = IDX.tx.get(`t_hs_${w.thu}_${k}`); was[k] = r && !r.del ? r.amt : 0; });
    const st = HS_K.every(k => was[k] === w[k]) ? '' : HS_K.some(k => was[k]) ? 'chg' : 'new';   // new = لسه متنقلش، chg = حسن عدّل بعد النقل
    return Object.assign(w, {was, st, tot: w.wk + w.adv + w.oth, lock: isLocked(w.thu)});
  }).sort((a, b) => b.thu.localeCompare(a.thu));
}
const hsPend = () => hsWeeks().filter(w => w.st && !w.lock);
function hsMoveWeek(w) {
  hsEnsureCats();
  const day = w.thu > todayISO() ? todayISO() : w.thu;
  HS_K.forEach(k => {
    const id = `t_hs_${w.thu}_${k}`, r = IDX.tx.get(id), a = w[k];
    if (a > 0) {
      const note = `حسن — ${HS_KN[k]} أسبوع الخميس ${dispDate(w.thu)}`;
      if (r) { if (!r.del && r.amt === a && r.date === day) return; if (!r.del) (r.hist = r.hist || []).push({t: nowS(), date: r.date, desc: `مصروف ${cName(r.cat)} — من حسن`, dr: r.amt, cr: 0}); Object.assign(r, {amt: a, date: day, note, del: false}); touch(r); return; }
      const n = {id, type: 'exp', amt: a, vault: '', nv: 1, to: '', cat: HS_CATS[k][0], note, date: day, at: nowS(), del: false, hist: [], hs: w.thu};
      touch(n); db.txs.push(n); IDX.tx.set(id, n);
    } else if (r && !r.del) { r.del = true; r.delAt = nowS(); touch(r); }
  });
}
function hsMoveAll(ws) { ws = ws || hsPend(); ws.forEach(hsMoveWeek); if (ws.length) saveDB(); return ws.length; }

/* ---------- الشاشات ---------- */
const hsN = n => n === 1 ? 'حركة' : n === 2 ? 'حركتين' : n + ' حركات';
const hsSd = iso => fbSd(iso);   // نفس شكل التاريخ في الخزنة
function hsAfter() { if (document.body.dataset.pg === 'cash') renderCash(); if (document.body.dataset.pg === 'mkt') renderMkt(); hsChip(); }
/* نافذة "حسن": فاضل معاه كام، استلم وصرف كام في الشهر، صرفها في إيه، استلمها من مين، واللي مش راكب */
function hsWin() {
  const D = hsData(), M = hsMatch(D), t = todayISO(), mo = (() => { const [y, m] = t.split('-').map(Number), d = new Date(y, m - 1 - hsMon, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; })();
  const inM = r => r.date.slice(0, 7) === mo, sp = D.sp.filter(inM), cus = D.cus.filter(inM);
  const sum = a => a.reduce((s, r) => s + r.amt, 0), gv = db.txs.filter(x => !x.del && x.cat === 'c_hsn' && inM(x));
  const fromMe = gv.filter(x => !isMkv(x.vault)), fromAh = gv.filter(x => isMkv(x.vault)), lost = M.theirs.filter(inM);
  const P = hsPlan(), pend = hsPend(), [y, m] = mo.split('-');
  const line = (lbl, sub, amt, attr) => `<div class="kit"${attr || ''}><div><b>${lbl}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div><b class="n">${fmtP(amt)}</b></div>`;
  const weeks = n => n === 1 ? 'أسبوع' : n === 2 ? 'أسبوعين' : n + ' أسابيع';
  const wk = sp.filter(x => x.k === 'wk'), adv = sp.filter(x => x.k === 'adv'), oth = sp.filter(x => x.k === 'oth');
  const warn = [...M.theirs.slice(-3).map(c => `حسن كاتب إنه استلم ${fmtP(c.amt)} يوم ${hsSd(c.date)} ومش لاقيها عندك ولا عند ${MK_PN}.`),
    ...M.ours.slice(-3).map(x => `${isMkv(x.vault) ? MK_PN + ' كاتب' : 'إنت كاتب'} إنك اديته ${fmtP(x.amt)} يوم ${hsSd(x.date)} وهو مكتبهاش.`)];
  modal(`<div class="ksheet ksh-hs"><div class="ksh2"><button class="kback" id="hsB" type="button" aria-label="رجوع">→</button><span>حسن<small>فاضل معاه دلوقتي · من تطبيق المرتبات${hsErr ? ' · ⚠️ ' + esc(hsErr) : ''}</small></span><b class="n">${fmtP(D.bal)}</b></div>
    <div class="seg s2" id="hsM"><button type="button" data-v="1" class="${hsMon ? 'on' : ''}">الشهر اللي فات</button><button type="button" data-v="0" class="${hsMon ? '' : 'on'}">${AR_MONTHS[+m - 1]} ${y}</button></div>
    <div class="hsio"><div class="kin"><span>استلم</span><b class="n">${fmtP(sum(cus))}</b></div><div class="kout"><span>صرف</span><b class="n">${fmtP(sum(sp))}</b></div></div>
    ${warn.length ? `<div class="hsw"><b>⚠️ ${warn.length === 1 ? 'فيه حاجة مش راكبة' : 'فيه حاجات مش راكبة'}:</b>${warn.map(w => `<span>• ${esc(w)}</span>`).join('')}</div>` : ''}
    <div class="hsh">صرفها في إيه</div><div class="kits">
      ${wk.length ? line('مرتبات العمال', weeks(new Set(wk.map(x => x.week)).size) + ' · دوس تشوف العمال', sum(wk), ' data-k="wk" role="button" tabindex="0"') : ''}
      ${adv.length ? line('سلف العمال', hsN(adv.length), sum(adv), ' data-k="adv" role="button" tabindex="0"') : ''}
      ${oth.length ? line('مصاريف تانية', oth.slice(-3).map(x => x.note || x.who).filter(Boolean).join('، '), sum(oth), ' data-k="oth" role="button" tabindex="0"') : ''}
      ${sp.length ? '' : '<div class="kit"><div><small>مفيش مصاريف في الشهر ده</small></div></div>'}</div>
    <div class="hsh">استلم من مين</div><div class="kits">
      ${fromMe.length ? line('منك', hsN(fromMe.length), sum(fromMe)) : ''}${fromAh.length ? line('من ' + MK_PN, hsN(fromAh.length), sum(fromAh)) : ''}
      ${lost.length ? line('مش لاقيها عندك', lost.map(c => hsSd(c.date)).join('، '), sum(lost)) : ''}
      ${gv.length || lost.length ? '' : '<div class="kit"><div><small>مفيش فلوس راحتله في الشهر ده</small></div></div>'}</div>
    ${P.sure.length + P.ask.length ? `<button class="btn gold" id="hsRev" type="button">راجع الفلوس اللي راحت لحسن والشركاء (${P.sure.length + P.ask.length})</button>` : ''}
    ${pend.length ? `<button class="btn line" id="hsMv" type="button">انقل مصاريف حسن للأرباح (${weeks(pend.length)})</button>` : ''}
    <button class="btn line" id="hsX" type="button">رجوع</button></div>`);
  $('#hsX').onclick = $('#hsB').onclick = closeModal;
  $$('#hsM button').forEach(b => b.onclick = () => { hsMon = +b.dataset.v; hsWin(); });
  if ($('#hsRev')) $('#hsRev').onclick = hsReview;
  if ($('#hsMv')) $('#hsMv').onclick = hsMoveModal;
  $$('#modal .kit[data-k]').forEach(el => el.onclick = () => hsItems(el.dataset.k, sp.filter(x => x.k === el.dataset.k)));
  if (!hsBusy) hsPull().then(ch => { if (ch && $('#hsM')) hsWin(); }, () => {});
}
/* تفاصيل نوع: المرتبات أسبوع أسبوع والعمال تحت بعض، والسلف والمصاريف سطر سطر. قراية بس */
function hsItems(k, arr) {
  const rows = arr.slice().sort((a, b) => b.date.localeCompare(a.date) || b.week.localeCompare(a.week));
  let html = '';
  if (k === 'wk') {
    const by = new Map(); rows.forEach(x => by.set(x.week, (by.get(x.week) || []).concat(x)));
    by.forEach((l, w) => { html += `<div class="hsh">أسبوع الخميس ${hsSd(w)} <b class="n">${fmtP(l.reduce((s, x) => s + x.amt, 0))}</b></div><div class="kits">${l.map(x => `<div class="kit"><div><b>${esc(x.who || x.note || 'العمال')}</b></div><b class="n">${fmtP(x.amt)}</b></div>`).join('')}</div>`; });
  } else html = `<div class="kits">${rows.map(x => `<div class="kit"><div><b>${esc((k === 'adv' ? x.who : x.note || x.who) || HS_KN[k])}</b><small>${dispDate(x.date)}${k === 'adv' && x.note ? ' · ' + esc(x.note) : k === 'oth' && x.who ? ' · لـ ' + esc(x.who) : ''}</small></div><b class="n">${fmtP(x.amt)}</b></div>`).join('')}</div>`;
  modal(`<div class="ksheet ksh-hs"><div class="ksh2"><button class="kback" id="hiB" type="button" aria-label="رجوع">→</button><span>${HS_KN[k]}<small>من تطبيق المرتبات · ${hsN(rows.length)}</small></span><b class="n">${fmtP(rows.reduce((s, x) => s + x.amt, 0))}</b></div>
    ${html}<button class="btn line" id="hiX" type="button">رجوع</button></div>`);
  $('#hiX').onclick = $('#hiB').onclick = hsWin;
}
/* نقل الأسابيع اللي لسه متنقلتش أو اتغيرت (دوسة واحدة) */
function hsMoveModal() {
  const ws = hsPend(); if (!ws.length) { toast('مفيش حاجة لسه متنقلتش ✔'); return hsWin(); }
  const tot = k => ws.reduce((s, w) => s + w[k], 0);
  modal(`<div class="ksheet ksh-hs"><div class="ksh2"><button class="kback" id="hmB" type="button" aria-label="رجوع">→</button><span>مصاريف حسن<small>${ws.length === 1 ? 'أسبوع' : ws.length + ' أسابيع'} · بتدخل الأرباح بس ومبتلمسش الخزنة</small></span><b class="n">${fmtP(tot('wk') + tot('adv') + tot('oth'))}</b></div>
    <div class="kits">${HS_K.filter(k => tot(k)).map(k => `<div class="kit"><div><b>${HS_KN[k]}</b></div><b class="n">${fmtP(tot(k))}</b></div>`).join('')}</div>
    <div class="hsh">الأسابيع</div><div class="kits">${ws.map(w => `<div class="kit"><div><b>أسبوع الخميس ${hsSd(w.thu)}</b><small>${w.st === 'chg' ? `حسن عدّل بعد ما اتنقل (كان ${fmtP(w.was.wk + w.was.adv + w.was.oth)})` : HS_K.filter(k => w[k]).map(k => HS_KN[k] + ' ' + fmtP(w[k])).join(' · ')}</small></div><b class="n">${fmtP(w.tot)}</b></div>`).join('')}</div>
    <button class="btn gold" id="hmOk" type="button">انقلهم (دوسة واحدة)</button><button class="btn line" id="hmX" type="button">رجوع</button></div>`);
  $('#hmX').onclick = $('#hmB').onclick = hsWin;
  $('#hmOk').onclick = () => { const n = hsMoveAll(ws); closeModal(); hsAfter(); toast(`اتنقلت ✔ (${n === 1 ? 'أسبوع' : n + ' أسابيع'})`); };
}
/* مراجعة الفلوس اللي راحت لحسن والشركاء (القديم والجديد بنفس الطريقة) */
function hsLbl(it) {
  const pn = it.pid ? partName(it.pid) : '';
  return it.kind === 'cus' ? 'عهدة مع حسن' : it.kind === 'sal' ? 'مرتب ' + pn : `عهدة ${fmtP(it.cus)} + مرتب ${pn} ${fmtP(it.sal)}`;
}
function hsReview() {
  const P = hsPlan(), pid = hsPid(), ps = partners();
  if (!P.sure.length && !P.ask.length) { modal(`<div class="ksheet ksh-hs"><div class="ksh2"><span>فلوس حسن والشركاء</span></div><div class="kits"><div class="kit"><div><b>✔ كله متظبط، مفيش حاجة محتاجة مراجعة.</b></div></div></div><button class="btn line" id="hrX" type="button">رجوع</button></div>`); $('#hrX').onclick = closeModal; return; }
  const who = t => isMkv(t.vault) ? MK_PN : vName(t.vault);
  modal(`<div class="ksheet ksh-hs"><div class="ksh2"><button class="kback" id="hrB" type="button" aria-label="رجوع">→</button><span>فلوس حسن والشركاء<small>المبلغ بيفضل نازل من نفس الخزنة ونفس اليوم، الاسم بس اللي بيتغير</small></span></div>
    ${ps ? `<div class="hsin hssal"><label>مرتب الشريك في الأسبوع</label><input class="inp num amt" id="hrSal" value="${ps.amt > 0 ? fmtP(ps.amt) : ''}" placeholder="7,000"><small>أي فلوس لحسن أو أحمد بالمبلغ ده (أو ضعفه) بتتعرف مرتب لوحدها</small></div>` : ''}
    ${P.sure.length ? `<div class="hsh">واضحة (${P.sure.length})</div><div class="kits">${P.sure.map((it, i) => `<div class="kit hsr" data-s="${i}"><div><b>${esc(it.t.note || cName(it.t.cat))}</b><small>${dispDate(it.t.date)} · ${esc(who(it.t))} · كانت ${esc(cName(it.t.cat))}</small><small class="hsg">← ${esc(hsLbl(it))}</small></div><b class="n">${fmtP(it.t.amt)}</b></div>`).join('')}</div>
      <button class="btn gold" id="hrAll" type="button">صلّح الكل (${P.sure.length})</button>` : ''}
    ${P.ask.length ? `<div class="hsh">محتاجة رأيك (${P.ask.length})</div><div class="kits">${P.ask.map((it, i) => { const pn = pid ? partName(pid) : 'حسن', a = it.t.amt, g = it.g;
      return `<div class="kit hsq" data-a="${i}"><div><b>${esc(it.t.note || cName(it.t.cat))}</b><small>${dispDate(it.t.date)} · ${esc(who(it.t))}</small></div><b class="n">${fmtP(a)}</b><div class="hsqx">
        <p class="hsw2">${g ? `حسن كتب في تطبيقه إنه استلم عهدة <b>${fmtP(g.amt)}</b> بس (${dispDate(g.date)}).` : 'حسن مكتبش في تطبيقه إنه استلم الفلوس دي عهدة.'} الفلوس دي كانت إيه؟</p>
        <div class="hsbt">${pid ? `<button class="btn line sm" data-sal="${i}" type="button">كلها مرتب ${esc(pn)}</button>` : ''}
          ${g && pid ? `<button class="btn line sm" data-sp="${i}" type="button">عهدة ${fmtP(g.amt)} + مرتب ${esc(pn)} ${fmtP(a - g.amt)}</button>` : ''}
          <button class="btn line sm" data-cu="${i}" type="button">كلها عهدة مع حسن</button>
          <button class="btn line sm" data-kp="${i}" type="button">مصروف عادي، سيبه</button></div>
        <details class="hsman"><summary>قسّمها بإيدي</summary><div class="hsin"><label>منها عهدة</label><input class="inp num amt" data-c="${i}" value="${fmtP(it.cus)}"><small data-r="${i}"></small></div>
          <button class="btn line sm" data-ok="${i}" type="button">تمام</button></details></div></div>`; }).join('')}</div>` : ''}
    <button class="btn line" id="hrX" type="button">رجوع</button></div>`);
  $('#hrX').onclick = $('#hrB').onclick = closeModal;
  if ($('#hrSal')) { bindMoney($('#hrSal')); $('#hrSal').onchange = () => { const v = toP($('#hrSal').value); if (!(v > 0) || v === ps.amt) return; putSet('partners', Object.assign({}, ps, {amt: v})); saveDB(); hsAfter(); toast('اتحفظ المرتب ✔'); setTimeout(hsReview); }; }
  const done = n => { saveDB(); hsAfter(); toast(`اتصلّح ✔ (${n === 1 ? 'سطر' : n + ' سطور'})`); hsReview(); };
  if ($('#hrAll')) $('#hrAll').onclick = () => { let n = 0; P.sure.forEach(it => { if (hsApply(it)) n++; }); done(n); };
  const rest = i => { const it = P.ask[i], c = toP($(`[data-c="${i}"]`).value), r = it.t.amt - c; $(`[data-r="${i}"]`).textContent = c < 0 || r < 0 ? 'أكبر من المبلغ' : r ? `والباقي مرتب ${pid ? partName(pid) : '؟'}: ${fmtP(r)}` : 'كلها عهدة'; return [c, r]; };
  $$('#modal [data-c]').forEach(el => { bindMoney(el); el.oninput = () => rest(+el.dataset.c); rest(+el.dataset.c); });
  $$('#modal [data-ok]').forEach(b => b.onclick = () => {
    const i = +b.dataset.ok, it = P.ask[i], [c, r] = rest(i);
    if (c < 0 || r < 0) return toast('اكتب مبلغ أقل من ' + fmtP(it.t.amt));
    if (r && !pid) return toast('حسن مش في قايمة الشركاء (الخزنة ← ⋯ ← الشركاء)');
    if (hsApply(c ? {t: it.t, kind: r ? 'split' : 'cus', cus: c, sal: r, pid} : {t: it.t, kind: 'sal', pid})) done(1);
  });
  $$('#modal [data-kp]').forEach(b => b.onclick = () => { if (hsApply({t: P.ask[+b.dataset.kp].t, kind: 'keep'})) done(1); });
  $$('#modal [data-sal]').forEach(b => b.onclick = () => { if (hsApply({t: P.ask[+b.dataset.sal].t, kind: 'sal', pid})) done(1); });
  $$('#modal [data-cu]').forEach(b => b.onclick = () => { if (hsApply({t: P.ask[+b.dataset.cu].t, kind: 'cus'})) done(1); });
  $$('#modal [data-sp]').forEach(b => b.onclick = () => { const it = P.ask[+b.dataset.sp]; if (hsApply({t: it.t, kind: 'split', cus: it.g.amt, sal: it.t.amt - it.g.amt, pid})) done(1); });
}
/* كارت في الوارد لما يكون فيه حاجة لحسن: فلوس محتاجة تتظبط، أو مصاريف لسه متنقلتش */
function hsInbox() {
  const box = $('#mkBody'); if (!box || !payCreds()) return;
  const draw = () => {
    const old = $('#hsCard'); if (old) old.remove();
    const P = hsPlan(), n = P.sure.length + P.ask.length, ws = hsPend();
    if (!n && !ws.length) return;
    const tot = k => ws.reduce((s, w) => s + w[k], 0), all = tot('wk') + tot('adv') + tot('oth');
    box.insertAdjacentHTML('afterbegin', `<section class="hsc" id="hsCard"><div class="hsct"><b>🏭 حسن</b><small>من تطبيق المرتبات</small></div>
      ${ws.length ? `<div class="hsh">مصاريف لسه متنقلتش · ${ws.length === 1 ? `أسبوع الخميس ${hsSd(ws[0].thu)}` : `${ws.length} أسابيع`}<b class="n">${fmtP(all)}</b></div><div class="kits">${HS_K.filter(k => tot(k)).map(k => `<div class="kit"><div><b>${HS_KN[k]}</b></div><b class="n">${fmtP(tot(k))}</b></div>`).join('')}</div>
        <button class="btn gold" id="hsInMv" type="button">انقلها للأرباح (دوسة واحدة)</button>` : ''}
      ${n ? `<button class="btn line" id="hsInRv" type="button">فلوس راحت لحسن أو للشركاء محتاجة تتظبط (${n})</button>` : ''}</section>`);
    if ($('#hsInMv')) $('#hsInMv').onclick = hsMoveModal;
    if ($('#hsInRv')) $('#hsInRv').onclick = hsReview;
  };
  draw();
  hsPull().then(ch => { if (ch && $('#mkBody') === box) draw(); }, () => {});
}
Object.assign(window, {hsPull, hsWin, hsReview, hsInbox, hsData, hsPlan, hsApply, hsWeeks, hsMoveAll, hsMatch});
