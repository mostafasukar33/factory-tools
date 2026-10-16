/* ====================== المصنع والتجارة (صفحة #fac جوه الحسابات) ======================
   بتقسم المبيعات والمشتريات والمصاريف لـ: المصنع / التجارة / نثريات وعامة (والجمعيات والمكن مش مصروف)،
   من غير ما حد يغيّر طريقة كتابته (بطلب صاحب المشروع 16/10/2026، الخطة في reviews/production-cost/PLAN.md).
   - عرض بس: مبيكتبش في أي حركة ولا رصيد، وتقرير الأرباح زي ما هو. الحاجة الوحيدة اللي بتتحفظ إعداد set اسمه facMap
     {w: {ملاحظة أو صنف: بند}, d: {id حركة أو فاتورة: بند أو 'j:<شغلانة>'}, s: {id مورد: prod|trade|asset}, j: [{id, name}]}.
   - التقسيمة بتتحسب كل مرة الصفحة بتتفتح، فأي فاتورة قديمة أو جديدة بتدخل لوحدها.
   - مجموع الأقسام = "قبل الشركاء" في تقرير الأرباح، والفرق بس "برّه الحسبة" (جمعيات وأصول) ومكتوب تحت.
   - بيتحمّل لما تفتح الصفحة بس (loadFac في accounts.html). */
(() => {
'use strict';

/* البنود. dir: فين بتظهر */
const B = {
  raw: 'خامات ومستلزمات', labor: 'عمالة', power: 'كهربا', run: 'تشغيل (كسارة، تسخين، تصنيع، صيانة)', hassan: 'عهدة حسن (مرتبات ونثريات)',
  gen: 'مصاريف عامة (عربية، نقل، سفر، نثريات)', out: 'برّه الحسبة (جمعيات وغيره)', asset: 'أصول (مكن وأجهزة)'
};
/* الاختيارات بكلامه هو، وقليلة (بطلبه 16/10/2026: "تشعيب رهيب"، ومفيش شغلانات لوحدها) */
const PICK = [['raw', 'خامات'], ['power', 'كهربا'], ['run', 'تشغيل'], ['labor', 'عمالة'], ['hassan', 'عهدة حسن'], ['gen', 'نثريات وعامة'], ['out', 'مش مصروف (جمعية، مكنة)']];
const PICKD = [['prod', 'إنتاجنا'], ['trade', 'تجارة']];
const BN = {raw: 'خامات', power: 'كهربا', run: 'تشغيل', labor: 'عمالة', hassan: 'عهدة حسن', gen: 'نثريات وعامة', out: 'مش مصروف', asset: 'مكن وأجهزة', prod: 'إنتاج', trade: 'تجارة', cash: 'بيع نقدي', unk: 'مش فاهمها', nl: 'البنود لسه', adj: 'خصم / تسوية'};
const n = s => norm(String(s || ''));
const has = (t, ws) => ws.some(w => t.includes(n(w)));
/* القاموس الأول، من كلام المصنع الحقيقي (ملف أكتوبر 2026) */
const W = {
  out: ['جمعيه', 'جمعية'],
  run: ['كساره', 'كسارة', 'تسخين', 'احبار', 'أحبار', 'حبر', 'مذيب', 'تصنيع', 'صيانه', 'صيانة', 'فني', 'لحام', 'رولمان', 'سير مكن', 'المخرز'],
  power: ['كهرب'],
  raw: ['كسر', 'مبلور', 'مخرز', 'لينير', 'صبغه', 'صبغة', 'ماستر', 'خامات', 'خامه', 'بلاستيك', 'بكر', 'كرتون', 'شكاير', 'نحاس'],
  labor: ['يوميه', 'يومية', 'مرتب', 'عمال', 'حافز', 'قبض'],
  gen: ['جاز', 'بنزين', 'سولار', 'سواق', 'ميكانيكي', 'ميكانيكى', 'فتيس', 'عربيه', 'عربية', 'تروسيكل', 'نقل', 'شحن', 'نولون', 'حميدو', 'عاشور', 'سفر', 'شاي', 'شاى', 'شايات', 'مخلل', 'اكل', 'فطار', 'مياه', 'ايجار', 'إيجار', 'دومين', 'تحويل', 'تليفون', 'كارت', 'مكتب', 'مصاريف', 'مصروف', 'نثري']
};
/* البند من اسم البند في الخزنة لو الملاحظة مقالتش حاجة */
const CAT = [['out', ['جمعي']], ['power', ['كهرب']], ['raw', ['خامات', 'صبغ']], ['labor', ['أجور', 'اجور', 'مرتبات']], ['run', ['صيانه', 'صيانة']], ['gen', ['نقل', 'إيجار', 'ايجار']]];
/* بند عام زي "مصاريف السوق" بيتاخد بس لو مفيش ملاحظة، لكن لو فيها اسم البرنامج ميعرفوش بيسأل عليه */
const GENCAT = ['نثريات', 'مصاريف السوق', 'مصروفات'];
/* الأصناف: التجارة بالاسم، والإنتاج خرطوم أو لفة بمقاس (الختم مالوش دعوة) */
const TR = /مواسير|سلك|سوست|ماجيك|مفتاح|مفاتيح|بواط|لمب|كشاف|لقم|جرس|شاسيه|وش |سداد|كوس|دوايه|بريز|اتوماتيك|تكييف|فيش|علب|طبه|كوع|لوحه|فانوس|شكاره|كابل/;
const PROD = /خرطوم|لف[هة]|\d+\s*مم/;
const RAWI = /لينير|مخرز|مبلور|كسر|ماستر|صبغ|بولي|خام/;
const itemKey = s => n(s).replace(/[\d.,]+/g, '#').replace(/\s+/g, ' ').trim();

const map = () => { const m = getSet('facMap', null) || {}; return {w: m.w || {}, d: m.d || {}, s: m.s || {}, j: m.j || []}; };
const save = m => putSet('facMap', m);
/* الشغلانات اتشالت من الشاشة: أي حاجة اتحطت في شغلانة بترجع لبند باسمها (نثريات = عامة، تجارة = تجارة) مرة واحدة */
function tidy() {
  const m = map(); if (!m.j.length) return;
  const jb = {}; m.j.forEach(j => { const nm = n(j.name); jb[j.id] = {tx: expBucket({id: '', note: j.name, cat: ''}, {d: {}, w: {}}).b || 'gen', doc: /تجار/.test(nm) || TR.test(nm) ? 'trade' : /انتاج|خرطوم|مصنع/.test(nm) ? 'prod' : ''}; });
  Object.keys(m.d).forEach(id => { const v = m.d[id]; if (!v.startsWith('j:')) return; const b = jb[v.slice(2)] || {tx: 'gen', doc: ''}, t = IDX.tx.has(id) ? b.tx : b.doc; if (t) m.d[id] = t; else delete m.d[id]; });
  m.j = []; save(m);
}

/* بند المصروف: اختيار على الحركة نفسها > اختيار على نفس الملاحظة > حسن > القاموس > اسم البند */
function expBucket(t, m) {
  if (m.d[t.id]) return {b: m.d[t.id], how: 'you'};
  const note = n(t.note), cat = n(cName(t.cat));
  if (note && m.w['x:' + note]) return {b: m.w['x:' + note], how: 'you'};
  const toks = note.split(' ');
  if (toks.includes('حسن') && !note.includes('ابو شوشه') && !note.includes('أبو شوشه')) return {b: 'hassan', how: 'auto'};
  for (const k of ['out', 'run', 'power', 'raw', 'labor', 'gen']) if (note && has(note, W[k])) return {b: k, how: 'auto'};
  for (const [k, ws] of CAT) if (has(cat, ws)) return {b: k, how: 'auto'};
  if (!note && has(cat, GENCAT)) return {b: 'gen', how: 'auto'};
  return {b: '', how: ''};
}
/* نوع سطر الفاتورة: prod | trade | '' (مش فاهم) */
function lineKind(l, m, sup, pid) {
  const k = itemKey(l.name);
  if (m.w['i:' + k]) return m.w['i:' + k];
  if (sup) { const s = m.s[pid]; if (s) return s; if (RAWI.test(n(l.name))) return 'prod'; if (TR.test(n(l.name))) return 'trade'; return ''; }
  return TR.test(n(l.name)) ? 'trade' : 'prod';   // العملا كلهم إنتاج (بطلبه 16/10/2026)، إلا الصنف المعروف إنه تجارة
}

/* الحسبة كلها للفترة. كل رقم بالقرش، ومعاه الحاجات اللي جواه علشان الدوس يفتحها */
function calc(f, t) {
  const m = map(), R = {}, add = (k, amt, it) => { const x = R[k] || (R[k] = {amt: 0, it: []}); x.amt += amt; if (it) x.it.push(Object.assign({amt, bk: k}, it)); };
  for (const e of db.entries) {
    if (e.del || e.date < f || e.date > t) continue;
    const p = P.get(e.party); if (!p || p.noTot) continue;
    const sup = p.sec === 'sup', K = sup ? PUR_K : SALE_K; if (!K.has(e.kind)) continue;
    const val = sup ? (e.cr || 0) - (e.dr || 0) : (e.dr || 0) - (e.cr || 0), side = sup ? 'p' : 's';
    const base = {id: e.id, date: e.date, who: p.name, kind: 'doc', sec: p.sec};
    if (m.d[e.id] && m.d[e.id].startsWith('j:')) { add('j' + side + ':' + m.d[e.id].slice(2), val, base); continue; }
    if (e.kind === 'adj') { add(side + ':adj', val, Object.assign({what: 'خصم / تسوية'}, base)); continue; }
    if (sup && m.d[e.id]) { add('p:' + m.d[e.id], val, base); continue; }
    if (!sup && m.d[e.id]) { add('s:' + m.d[e.id], val, base); continue; }
    const ls = (e.lines || []).filter(l => lineTot(l));
    if (e.mkNL || !ls.length) { add(side + ':' + (sup ? m.s[p.id] || 'nl' : 'prod'), val, Object.assign({what: e.mkNL ? 'البنود لسه' : 'من غير أصناف'}, base)); continue; }
    const sum = ls.reduce((a, l) => a + lineTot(l), 0);
    let left = val;
    ls.forEach((l, i) => {
      const part = i === ls.length - 1 ? left : Math.round(val * lineTot(l) / sum); left -= part;
      add(side + ':' + (lineKind(l, m, sup, p.id) || 'unk'), part, Object.assign({what: l.name, key: itemKey(l.name)}, base));
    });
  }
  for (const x of db.txs) {
    if (x.del || x.type === 'tr' || x.date < f || x.date > t || NOT_PL.has(x.cat)) continue;
    if (x.iv || x.cat === 'c_ivdraw' || x.cat === 'c_ivcap' || x.pt || x.cat === 'c_psal' || x.cat === 'c_pdraw') continue;   // زي cashSums بالظبط
    const base = {id: x.id, date: x.date, who: x.note || cName(x.cat), what: cName(x.cat), kind: 'tx', mk: isMkv(x.vault)};
    if (m.d[x.id] && m.d[x.id].startsWith('j:')) { add('j' + (x.type === 'exp' ? 'e' : 's') + ':' + m.d[x.id].slice(2), x.amt, base); continue; }
    if (x.type === 'inc') { add(x.cat === 'c_inc1' ? 's:cash' : 'inc', x.amt, base); continue; }
    const {b} = expBucket(x, m); add('e:' + (b || 'unk'), x.amt, base);
  }
  const g = k => (R[k] || {amt: 0}).amt;
  const jobs = m.j.map(j => ({id: j.id, name: j.name, s: g('js:' + j.id), p: g('jp:' + j.id), e: g('je:' + j.id)})).filter(j => j.s || j.p || j.e).map(j => Object.assign(j, {net: j.s - j.p - j.e}));
  const fac = {s: g('s:prod') + g('s:cash'), raw: g('p:prod') + g('e:raw'), labor: g('e:labor'), hassan: g('e:hassan'), power: g('e:power'), run: g('e:run')};
  fac.net = fac.s - fac.raw - fac.labor - fac.hassan - fac.power - fac.run;
  const tr = {s: g('s:trade'), p: g('p:trade')}; tr.net = tr.s - tr.p;
  const unk = {s: g('s:unk') + g('s:nl'), p: g('p:unk') + g('p:nl'), e: g('e:unk'), adj: g('s:adj') - g('p:adj'), inc: g('inc')};
  const gen = g('e:gen'), out = g('e:out') + g('p:asset') + g('e:asset');
  const total = fac.net + tr.net + jobs.reduce((a, j) => a + j.net, 0) - gen + unk.s - unk.p - unk.e + unk.adj + unk.inc;
  return {R, m, fac, tr, jobs, unk, gen, out, total};
}

/* ---------- الشاشة ---------- */
let facM = '';   // الشهر المعروض YYYY-MM أو 'y:YYYY'
const range = () => { const t = todayISO(); if (!facM) facM = t.slice(0, 7); return facM.startsWith('y:') ? [facM.slice(2) + '-01-01', facM.slice(2) + '-12-31'] : monthRange(facM); };
const label = () => facM.startsWith('y:') ? 'سنة ' + facM.slice(2) : MONTHS[+facM.slice(5) - 1] + ' ' + facM.slice(0, 4);
const stepM = d => { if (facM.startsWith('y:')) { facM = 'y:' + (+facM.slice(2) + d); return; } let [y, mo] = facM.split('-').map(Number); mo += d; if (mo < 1) { mo = 12; y--; } if (mo > 12) { mo = 1; y++; } facM = y + '-' + pad2(mo); };
const row = (k, nm, v, cls) => `<div class="fr${k ? ' go' : ''}"${k ? ` data-k="${esc(k)}" role="button" tabindex="0"` : ''}><span>${nm}</span><b class="n${cls ? ' ' + cls : ''}">${fmtP(v)}</b></div>`;

function render() {
  tidy();
  const pg = $('#p-fac'), [f, t] = range(), C = calc(f, t), U = review(f, t, C).length;
  const prev = (() => { const s = facM; stepM(-1); const r = range(); facM = s; return calc(r[0], r[1]); })();
  const diff = (a, b) => { const d = a - b; return d ? `<small class="fd ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'} ${fmtP(Math.abs(d))} عن اللي قبله</small>` : ''; };
  const fe = C.fac.labor + C.fac.hassan + C.fac.power + C.fac.run, oth = C.unk.s - C.unk.p - C.unk.e + C.unk.adj + C.unk.inc;
  const tot = (nm, v, d) => `<div class="fr tot"><span>${nm} ${d || ''}</span><b class="n${v < 0 ? ' neg' : ''}">${fmtP(v)}</b></div>`;
  pg.innerHTML = `${isWide() ? '' : `<div class="sech ppbar tb" style="margin-top:0"><a id="fcBack">→<em> التقارير</em></a><b class="tt">🏭 المصنع والتجارة</b></div>`}
    <div class="card"><div class="dnav"><button type="button" id="fcPrev" title="اللي قبله">›</button><span>${esc(label())}</span><button type="button" id="fcNext" title="اللي بعده">‹</button></div>
      <div class="seg s2" id="fcMode" style="margin:8px 0 0"><button type="button" data-v="m" class="${facM.startsWith('y:') ? '' : 'on'}">شهر</button><button type="button" data-v="y" class="${facM.startsWith('y:') ? 'on' : ''}">سنة</button></div></div>
    ${U ? `<a class="fcu" id="fcRev" role="button" tabindex="0">❓ ${U} ${U === 1 ? 'حاجة' : U === 2 ? 'حاجتين' : 'حاجات'} البرنامج مش فاهمها، دوس واختار</a>` : ''}
    <section class="fc"><h3>🏭 المصنع</h3>
      ${row('s:prod', 'بعت إنتاج', C.fac.s, 'in')}
      ${row('raw', 'خامات', C.fac.raw, 'out')}
      ${row('fexp', 'مصاريف المصنع<small class="fd">كهربا، تشغيل، عمالة، عهدة حسن</small>', fe, 'out')}
      ${tot('ربح المصنع', C.fac.net, diff(C.fac.net, prev.fac.net))}</section>
    <section class="fc"><h3>🛒 التجارة</h3>
      ${row('s:trade', 'بعت تجارة', C.tr.s, 'in')}
      ${row('p:trade', 'اشتريت تجارة', C.tr.p, 'out')}
      ${tot('ربح التجارة', C.tr.net, diff(C.tr.net, prev.tr.net))}</section>
    <section class="fc"><h3>📋 الصافي</h3>
      ${row('e:gen', 'نثريات ومصاريف عامة', C.gen, 'out')}
      ${oth ? row('oth', 'لسه مش متقسم', oth, oth < 0 ? 'out' : 'in') : ''}
      ${tot('الصافي', C.total)}</section>
    ${C.out ? `<p class="fcn">الجمعيات والمكن (<b>${fmtP(C.out)}</b>) مش محسوبين مصروف.</p>` : ''}`;
  const tap = (el, fn) => { if (!el) return; el.onclick = fn; el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fn(); } }; };
  tap($('#fcPrev'), () => { stepM(-1); render(); }); tap($('#fcNext'), () => { stepM(1); render(); });
  $$('#fcMode button').forEach(b => b.onclick = () => { const t0 = todayISO(); facM = b.dataset.v === 'y' ? 'y:' + (facM.startsWith('y:') ? facM.slice(2) : facM.slice(0, 4)) : (facM.startsWith('y:') ? (facM.slice(2) === t0.slice(0, 4) ? t0.slice(0, 7) : facM.slice(2) + '-12') : facM); render(); });
  tap($('#fcBack'), () => go('rep')); tap($('#fcRev'), () => reviewModal(f, t));
  $$('#p-fac .fr.go').forEach(el => tap(el, () => drill(el.dataset.k, el.querySelector('span').firstChild.textContent, f, t)));
}
const keys = k => k === 'raw' ? ['p:prod', 'e:raw'] : k === 's:prod' ? ['s:prod', 's:cash'] : k === 'fexp' ? ['e:power', 'e:run', 'e:labor', 'e:hassan'] : k === 'oth' ? ['s:unk', 's:nl', 'p:unk', 'p:nl', 'e:unk', 's:adj', 'p:adj', 'inc'] : [k];
const isIn = bk => bk.startsWith('s:') || bk === 'inc';
/* الدوس على رقم: الحاجات اللي جواه، والدوس على أي واحدة بيغيّر بندها */
function drill(k, title, f, t) {
  const C = calc(f, t), its = keys(k).flatMap(x => (C.R[x] || {it: []}).it).sort((a, b) => b.date.localeCompare(a.date) || b.amt - a.amt);
  modal(`<h3>${esc(title)}<small class="fsm">${its.length} · ${fmtP(its.reduce((a, x) => a + x.amt, 0))}</small></h3><div class="csr">${its.slice(0, 150).map((x, i) => `<div class="ldr" data-i="${i}" role="button" tabindex="0"><div class="ldm"><b>${esc(x.kind === 'doc' ? x.what || x.who : x.who)}</b><small class="fsm">${dispDate(x.date)} · ${esc(x.kind === 'doc' ? x.who : x.what)}${x.mk ? ' · ' + esc(MK_PN) : ''}${keys(k).length > 1 ? ' · ' + esc(BN[x.bk.split(':')[1]] || '') : ''}</small></div><b class="n ${isIn(x.bk) ? 'in' : 'out'}">${fmtP(x.amt)}</b></div>`).join('') || '<div class="kno">مفيش حاجة</div>'}</div>
    <p class="fcn" style="margin:8px 2px 0">دوس على أي سطر لو متحط في مكان غلط.</p>
    <button class="btn line" id="fcX" type="button" style="margin-top:10px">إغلاق</button>`);
  $('#fcX').onclick = closeModal;
  $$('#modal .ldr').forEach(el => el.onclick = () => choose(its.slice(0, 150)[+el.dataset.i], () => { render(); drill(k, title, f, t); }));
}
/* اختيار بند لحاجة واحدة: المصروف = بنده (ويتحفظ على نفس الملاحظة)، الصنف = إنتاج/تجارة (ويتحفظ على اسمه) */
function choose(x, done) {
  const m = map(), isTx = x.kind === 'tx', opts = isTx ? PICK : PICKD;
  modal(`<h3>${esc(isTx ? x.who : x.what || x.who)}<small class="fsm">${dispDate(x.date)} · ${fmtP(x.amt)}${isTx ? '' : ' · ' + esc(x.who)}</small></h3>
    <h4 class="fch4">${isTx ? 'المصروف ده إيه؟' : 'الصنف ده إيه؟'}</h4>
    <div class="fch">${opts.map(([v, nm]) => `<button type="button" class="btn line" data-v="${v}">${nm}</button>`).join('')}</div>
    ${m.d[x.id] ? '<button type="button" class="btn line" id="fcRst" style="margin-top:8px">↺ رجّعها زي ما البرنامج فهمها</button>' : ''}
    <button class="btn line" id="fcX" type="button" style="margin-top:8px">إلغاء</button>`);
  const fin = () => { save(m); closeModal(); toast('اتحفظ ✔'); done && done(); };
  $$('#modal .fch [data-v]').forEach(b => b.onclick = () => {
    const v = b.dataset.v;
    if (isTx) { const note = n(x.who); if (note && x.who !== x.what) { m.w['x:' + note] = v; delete m.d[x.id]; } else m.d[x.id] = v; }
    else if (x.key) { m.w['i:' + x.key] = v; delete m.d[x.id]; }
    else m.d[x.id] = v;
    fin();
  });
  if ($('#fcRst')) $('#fcRst').onclick = () => { delete m.d[x.id]; fin(); };
  $('#fcX').onclick = closeModal;
}
/* "مش فاهم دول": مصاريف وأصناف مالهاش بند، وموردين لسه مالهمش علامة */
function review(f, t, C) {
  C = C || calc(f, t);
  const out = [], seen = new Set();
  ['e:unk', 's:unk', 'p:unk'].forEach(k => (C.R[k] || {it: []}).it.forEach(x => { const key = x.kind === 'tx' ? 'x' + n(x.who) : 'i' + x.key + x.sec; if (seen.has(key)) return; seen.add(key); out.push(x); }));
  return out;
}
function reviewModal(f, t) {
  const C = calc(f, t), L = review(f, t, C), m = map();
  const sups = [...new Set((C.R['p:unk'] || {it: []}).it.map(x => P.get((db.entries.find(e => e.id === x.id) || {}).party)).filter(Boolean))].filter(p => !m.s[p.id]);
  modal(`<h3>❓ مش فاهم دول<small class="fsm">اختار مرة واحدة، والبرنامج هيفتكر</small></h3>
    ${sups.length ? `<h4 class="fch4">موردين: بيوردولك إيه؟</h4>${sups.map(p => `<div class="fcs"><b>${esc(p.name)}</b><div class="fch">${[['prod', 'خامات للمصنع'], ['trade', 'بضاعة تجارة']].map(([v, nm]) => `<button type="button" class="btn line" data-s="${esc(p.id)}" data-v="${v}">${nm}</button>`).join('')}</div></div>`).join('')}` : ''}
    <div class="csr">${L.map((x, i) => `<div class="ldr" data-i="${i}" role="button" tabindex="0"><div class="ldm"><b>${esc(x.kind === 'tx' ? x.who : x.what)}</b><small class="fsm">${dispDate(x.date)} · ${esc(x.kind === 'tx' ? x.what : x.who)}</small></div><b class="n">${fmtP(x.amt)}</b></div>`).join('') || (sups.length ? '' : '<div class="kno">البرنامج فاهم كله ✔</div>')}</div>
    <button class="btn line" id="fcX" type="button" style="margin-top:10px">خلصت</button>`);
  $('#fcX').onclick = () => { closeModal(); render(); };
  $$('#modal .fcs [data-s]').forEach(b => b.onclick = () => { const mm = map(); mm.s[b.dataset.s] = b.dataset.v; save(mm); render(); reviewModal(f, t); });
  $$('#modal .csr .ldr').forEach(el => el.onclick = () => choose(L[+el.dataset.i], () => { render(); reviewModal(f, t); }));
}

window.facOpen = render;
window.facCalc = calc;
window.facExpBucket = (t) => expBucket(t, map()).b;
window.facLineKind = (name, sup) => lineKind({name}, map(), !!sup, '');
})();
