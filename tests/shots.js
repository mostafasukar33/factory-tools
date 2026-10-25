/*
  صور الشاشات قبل وبعد أي تعديل شكل (بيانات تجريبية بس، مفيهاش أي اسم عميل حقيقي).
  التشغيل:
    node tests/shots.js <فولدر الصور>                 ← يصوّر النسخة اللي على الجهاز
    node tests/shots.js <فولدر الصور> --root=<فولدر>   ← يصوّر نسخة تانية (مثلاً git worktree من origin/main)
    --only=acc-list-m,mkt-home-m                       ← شاشات معينة بس
  كل شاشة بتتصور بنفس المقاس ونفس البيانات كل مرة، فالمقارنة بين "قبل" و"بعد" صورة بصورة.
*/
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const CHROME = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
const args = process.argv.slice(2), opt = k => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const OUT = path.resolve(args.find(a => !a.startsWith('--')) || 'shots');
const ROOT = path.resolve(opt('root') || path.join(__dirname, '..'));
const ONLY = opt('only') ? opt('only').split(',') : null;
const PASS = '246810';
/* يوم ثابت للصور كلها علشان التواريخ متتغيرش بين "قبل" و"بعد" */
const NOW = Date.UTC(2026, 9, 11, 9, 30);
const iso = d => new Date(NOW - d * 86400000).toISOString().slice(0, 10);

function serve() {
  const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'};
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, {'Content-Type': types[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(r);
    }).listen(0, () => res(srv));
  });
}

/* ====================== بيانات الحسابات التجريبية ====================== */
const L = (name, unit, qty, price) => ({name, unit, qty, price});
function accData() {
  const P = [
    ['c1', 'mkt', 'مؤسسة تجربة للمقاولات العمومية', '01000000001'],
    ['c2', 'mkt', 'معرض تجربة الأمل', '01000000002'],
    ['c3', 'mkt', 'محل تجربة الجديد', ''],
    ['c4', 'mkt', 'عميل تجربة واحد', '01000000004'],
    ['c5', 'mkt', 'عميل تجربة اتنين', ''],
    ['c6', 'mkt', 'ورشة تجربة', '01000000006'],
    ['c7', 'mkt', 'عميل تجربة تلاتة', ''],
    ['c8', 'mkt', 'شركة تجربة للتوريدات', ''],
    ['c9', 'mkt', 'عميل تجربة أربعة', ''],
    ['c10', 'mkt', 'عميل تجربة خمسة', ''],
    ['w1', 'site', 'موقع تجربة التجمع', ''],
    ['w2', 'site', 'موقع تجربة أكتوبر', ''],
    ['s1', 'sup', 'مورد تجربة الخامات', ''],
    ['s2', 'sup', 'مورد تجربة الكرتون', '']];
  const E = [];
  const inv = (p, d, lines, no) => E.push({party: p, kind: p[0] === 's' ? 'pur' : 'inv', date: iso(d), no: String(no || ''), lines});
  const pay = (p, d, amt, method) => E.push({party: p, kind: p[0] === 's' ? 'ppay' : 'pay', date: iso(d), amt, method: method || 'نقدي'});
  const open = (p, d, dr, cr) => E.push({party: p, kind: 'open', date: iso(d), dr: dr || 0, cr: cr || 0});
  /* العميل اللي بنصوّر صفحته: حركات كتير ومتنوعة */
  open('c1', 400, 4850000);
  inv('c1', 120, [L('خرطوم تجربة 16 مم', 'لفة', 40, 52500), L('خرطوم تجربة 20 مم', 'لفة', 25, 71000), L('وصلة تجربة', 'كرتونة', 6, 18500)]);
  pay('c1', 110, 3000000, 'تحويل');
  inv('c1', 95, [L('خرطوم تجربة 25 مم', 'لفة', 30, 94000)]);
  pay('c1', 80, 1500000);
  E.push({party: 'c1', kind: 'man', date: iso(70), cr: 125000, desc: 'خصم تسوية'});
  inv('c1', 60, [L('خرطوم تجربة 16 مم', 'لفة', 50, 53500), L('كوع تجربة', 'كرتونة', 10, 22000)]);
  pay('c1', 45, 2250000, 'تحويل');
  inv('c1', 30, [L('خرطوم تجربة 32 مم', 'لفة', 12, 148000), L('خرطوم تجربة 20 مم', 'لفة', 20, 72000)]);
  pay('c1', 21, 1000000);
  inv('c1', 12, [L('خرطوم تجربة 16 مم', 'لفة', 35, 54000)]);
  pay('c1', 6, 750000);
  inv('c1', 2, [L('وصلة تجربة', 'كرتونة', 8, 19000), L('خرطوم تجربة 25 مم', 'لفة', 10, 95000)]);
  /* باقي العملا: أرصدة بأحجام مختلفة */
  open('c2', 200, 1234500); inv('c2', 40, [L('خرطوم تجربة 20 مم', 'لفة', 15, 72000)]); pay('c2', 9, 500000);
  inv('c3', 33, [L('خرطوم تجربة 16 مم', 'لفة', 8, 54000)]); pay('c3', 15, 200000);
  open('c4', 300, 270000); inv('c4', 18, [L('كوع تجربة', 'كرتونة', 3, 22000)]);
  inv('c5', 50, [L('خرطوم تجربة 16 مم', 'لفة', 10, 53000)]); pay('c5', 20, 530000);
  open('c6', 250, 12500000); inv('c6', 25, [L('خرطوم تجربة 32 مم', 'لفة', 40, 148000)]); pay('c6', 3, 4000000);
  inv('c7', 14, [L('وصلة تجربة', 'كرتونة', 2, 19000)]);
  open('c8', 180, 0, 350000);
  open('c9', 90, 9875000);
  inv('c10', 7, [L('خرطوم تجربة 20 مم', 'لفة', 4, 72000)]); pay('c10', 1, 100000);
  open('w1', 150, 24500000); inv('w1', 20, [L('خرطوم تجربة 25 مم', 'لفة', 100, 92000)]); pay('w1', 4, 10000000, 'تحويل');
  inv('w2', 35, [L('خرطوم تجربة 16 مم', 'لفة', 60, 52000)]);
  open('s1', 365, 0, 9000000); inv('s1', 30, [L('خامة تجربة', 'كيلو', 2000, 5050)]); pay('s1', 10, 6000000);
  inv('s2', 22, [L('كرتون تجربة', 'كرتونة', 500, 1200)]); pay('s2', 5, 400000);
  /* الرصيد المتوقع لكل حساب (الملف بيترفض لو مش مطابق) */
  const exp = {};
  E.forEach(e => {
    const t = e.lines ? e.lines.reduce((s, l) => s + Math.round(l.qty * l.price), 0) : 0;
    const v = e.kind === 'inv' ? t : e.kind === 'pur' ? -t : e.kind === 'pay' ? -e.amt : e.kind === 'ppay' ? e.amt : (e.dr || 0) - (e.cr || 0);
    exp[e.party] = (exp[e.party] || 0) + v;
  });
  return {app: 'flash-on-accounts-import', v: 1, batch: 'SHOT1', made: NOW - 400 * 86400000,
    parties: P.map(([ref, sec, name, phone]) => ({ref, sec, name, phone, expected: exp[ref] || 0})), entries: E};
}

/* ====================== بيانات تطبيق الشريك التجريبية ====================== */
function mktState() {
  const day = (d, h, m) => NOW - d * 86400000 + ((h - 9) * 60 + m - 30) * 60000;
  const cust = {}, ops = {}, st = {};
  [['p1', 'مؤسسة تجربة للمقاولات العمومية', 6187500, 'y', iso(21)], ['p2', 'معرض تجربة الأمل', 1814500, '', iso(9)], ['p3', 'عميل تجربة واحد', 336000, '', ''],
   ['p4', 'محل تجربة الجديد', 232000, '', iso(15)], ['p5', 'ورشة تجربة', 14420000, 'r', iso(3)], ['p6', 'عميل تجربة تلاتة', 38000, '', ''],
   ['p7', 'عميل تجربة أربعة', 9875000, 'r', ''], ['p8', 'عميل تجربة خمسة', 188000, '', iso(1)], ['p9', 'عميل تجربة اتنين', -150000, '', iso(20)]]
    .forEach(([id, name, bal, lim, lp]) => { cust[id] = {id, name, bal, lim, lp, upd: NOW}; });
  cust.p2.want = {amt: 500000, at: NOW - 86400000, note: ''};
  cust.p7.want = {amt: 2000000, at: NOW - 86400000, note: 'وعد يدفع السبت'};
  let n = 0;
  const op = (o, state) => { const id = 'm_shot' + (++n); ops[id] = Object.assign({id, upd: o.ts, sy: o.ts, cr: o.ts}, o); if (state) st['st_' + id] = Object.assign({op: id}, state); };
  op({t: 'pay', cid: 'p2', cname: 'معرض تجربة الأمل', amt: 250000, m: 'cash', ts: day(0, 9, 10)});
  op({t: 'pay', cid: 'p8', cname: 'عميل تجربة خمسة', amt: 150000, m: 'tr', ts: day(0, 10, 5)}, {done: true});
  op({t: 'inv', cid: 'p3', cname: 'عميل تجربة واحد', amt: 66000, ts: day(0, 10, 40)});
  op({t: 'exp', cat: 'بنزين', note: '', amt: 30000, ts: day(0, 11, 15)});
  op({t: 'exp', cat: 'أكل', note: 'غدا العمال', amt: 18500, ts: day(0, 12, 0)});
  op({t: 'spay', sname: 'مورد تجربة الخامات', sid: 'v1', amt: 120000, ts: day(0, 12, 20)});
  op({t: 'cs', buyer: 'زبون تجربة', amt: 95000, ts: day(0, 13, 5)});
  op({t: 'pay', cid: 'p5', cname: 'ورشة تجربة', amt: 1000000, m: 'cash', ts: day(1, 9, 50)}, {done: true});
  op({t: 'pay', cid: 'p4', cname: 'محل تجربة الجديد', amt: 75000, m: 'cash', ts: day(1, 11, 30)}, {done: true});
  op({t: 'hand', amt: 900000, ts: day(1, 17, 0)}, {done: true});
  op({t: 'exp', cat: 'نقل', note: '', amt: 45000, ts: day(1, 14, 0)});
  op({t: 'pay', cid: 'p1', cname: 'مؤسسة تجربة للمقاولات العمومية', amt: 1250000, m: 'tr', ts: day(2, 10, 0)}, {done: true});
  op({t: 'rt', cid: 'p6', cname: 'عميل تجربة تلاتة', amt: 19000, note: 'كرتونة وصلات', ts: day(2, 12, 0)}, {done: true});
  /* الموردين: نسخة من الحسابات (رصيد سابق + كشف آخر 3 شهور) */
  const sup = {}, sp = (id, name, ob, from, r) => { sup[id] = {id, name, ob, from, r, bal: ob + r.reduce((a, x) => a + x[3], 0), upd: NOW}; };
  sp('v1', 'مورد تجربة الخامات', 9000000, iso(100), [[iso(80), 'ppay', 'دفعة نقدي', -2500000, ''], [iso(30), 'pur', 'فاتورة مشتريات', 10100000, 'خامة تجربة 2000 كيلو'], [iso(10), 'ppay', 'دفعة تحويل', -6000000, ''], [iso(2), 'pur', 'فاتورة مشتريات', 1850000, 'خامة تجربة 300 كيلو، صبغة تجربة 20 كيلو']]);
  sp('v2', 'مورد تجربة الكرتون', 0, iso(100), [[iso(22), 'pur', 'فاتورة مشتريات', 600000, 'كرتون تجربة 500 كرتونة'], [iso(5), 'ppay', 'دفعة نقدي', -400000, '']]);
  sp('v3', 'مورد تجربة النحاس', 4350000, iso(100), [[iso(40), 'pur', 'فاتورة مشتريات', 2200000, 'نحاس تجربة 50 كيلو']]);
  sp('v4', 'مورد تجربة البلاستيك', 0, iso(100), [[iso(6), 'ppay', 'دفعة نقدي زيادة', -300000, '']]);   // اتدفعله زيادة = عليه
  return {u: 'https://script.google.com/macros/s/SHOT-MKT/exec', k: 'Shot-Key', dev: 'sh01', cursor: 1, ops, st, cust, sup, newc: [], lastOk: NOW, cSort: 'owe'};
}

/* ====================== الشاشات ======================
   app: acc (الحسابات) / mkt (تطبيق الشريك). full = الصفحة كلها (موبايل بس). go = بيوصل للشاشة */
const MOB = {width: 390, height: 844}, LAP = {width: 1440, height: 900}, LAP2 = {width: 1100, height: 760};
const PNAME = 'مؤسسة تجربة';
const accGo = h => async A => { await A.evaluate(h => { if ($('#mask').classList.contains('on')) closeModal(); if (typeof cashSide !== 'undefined') { cashSide = 'me'; cashOpenV = false; cashVault = ''; } go(h); if (h === 'cash') renderCash(); }, h); };
const accEval = code => async A => { await A.evaluate(code => { if ($('#mask').classList.contains('on')) closeModal(); (0, eval)(code); }, code); };
const party = `liveParties().find(p => p.name.startsWith('${PNAME}'))`;
const mktGo = h => async M => { await M.evaluate(h => nav(h), h); };
/* مساهم تجريبي (أول مرة بس): رأس مال وشحنة بأصنافها ومصروف وسحب، علشان شاشة الجرد وكشف المساهم */
/* جرد قديم (بالإيد) من 60 يوم وجرد النهارده، لصور الجرد القديم وفرق المخزون في الأرباح */
const JRDSHOT = `if (!IDX.stk.get('jr_shot_o')) { const u = Date.now(), t = todayISO(), mk = (id, date, stock, n) => { const r = {id, date, stock, n, at: u, upd: u, del: false, hist: []}; db.stks.push(r); IDX.stk.set(id, r); };
  mk('jr_shot_o', addDays(t, -60), 15000000, {old: 1, mkt: 30000000, site: 0, sup: 0, vault: 0, mk: 0, cnt: {mkt: 0, site: 0, sup: 0}, ivs: [], rest: 5000000}); mk('jr_shot_n', t, 18000000, jrdCalc(t)); }; `;
const IVSHOT = `if (!IDX.ivp.get('ip_shot')) { const t = todayISO(), u = Date.now(), add = (k, r) => { const x = Object.assign({id: r.id, iv: 'ip_shot', k, note: '', at: u, upd: u, del: false, hist: []}, r); db.ivrs.push(x); IDX.ivr.set(x.id, x); };
  const v = {id: 'ip_shot', name: 'مساهم تجربة', mode: 'c', party: ${party}.id, from: addDays(t, -40), note: '', at: u, upd: u, del: false, hist: []}; db.ivps.push(v); IDX.ivp.set(v.id, v);
  add('cap', {id: 'ir_shot1', amt: 29000000, date: addDays(t, -60)});
  add('ship', {id: 'ir_shot2', date: addDays(t, -30), lines: [{n: 'لفة تجربة 16 مم', q: 300, w: 4.5, u: 2250}, {n: 'لفة تجربة 23 مم', q: 160, w: 7.25, u: 3625}], fr: 300000, site: 'المنيا'});
  add('exp', {id: 'ir_shot3', amt: 300000, date: addDays(t, -20), note: 'مصروف تجربة'});
  add('draw', {id: 'ir_shot4', amt: 1000000, date: addDays(t, -10)}); }
`;
/* المصنع والتجارة: مصاريف بكلام حر زي الحقيقة (القاموس بيفهمها لوحده)، وفاتورة فيها تجارة */
const FACSHOT = `if (!IDX.tx.get('t_fac0')) { const v = defVault(), d = n => addDays(todayISO(), -n);
  [[2500000, 1, 'كهربا المصنع'], [380000, 2, 'كساره'], [150000, 2, 'جاز العربيه'], [1200000, 3, 'حسن عيسي'], [500000, 4, 'جمعيه'], [90000, 4, 'سباكه الحمام'], [450000, 5, 'كسر ابيض']]
    .forEach(([amt, n, note], i) => { const r = {id: 't_fac' + i, at: Date.now(), upd: Date.now(), del: false, hist: [], type: 'exp', amt, date: d(n), note, vault: v, to: '', cat: ''}; db.txs.push(r); IDX.tx.set(r.id, r); });
  const c = liveParties().find(p => p.name === 'عميل تجربة اتنين'); const e = {id: 'e_fac1', party: c.id, kind: 'inv', date: d(3), lines: [{name: 'مواسير تجربة 4 بوصة', unit: 'ماسورة', qty: 20, price: 30000}, {name: 'خرطوم تجربة 16 مم', unit: 'لفة', qty: 10, price: 45000}], at: Date.now(), upd: Date.now(), del: false, hist: []};
  e.dr = docTotal(e); e.cr = 0; db.entries.push(e); E.set(e.id, e); saveDB(); }`;
const facGo = rev => async A => { await accEval(FACSHOT + "go('fac')")(A); await A.waitForSelector('#p-fac .fc'); if (rev) { await A.click('#fcRev'); await A.waitForSelector('#modal .ldr, #modal .fcs'); } if (rev === 'pick') { await A.click('#modal .csr .ldr'); await A.waitForSelector('#modal .fch'); } };
const ACC = (sfx, vp, extra = {}) => [
  {name: 'acc-list-' + sfx, go: accEval("tab = 'mkt'; go('home'); renderHome()"), full: true},
  {name: 'acc-site-' + sfx, go: accEval("tab = 'site'; go('home'); renderHome()")},
  {name: 'acc-sup-' + sfx, go: accEval("go(isWide() ? 'home' : 'sup'); tab = 'sup'; renderHome()")},
  {name: 'acc-party-' + sfx, go: accEval(`tab = 'mkt'; go('p/' + ${party}.id)`), full: true},
  {name: 'acc-entry-' + sfx, go: accEval(`entryModal(${party}, E.get([...E.values()].filter(e => e.party === ${party}.id && e.kind === 'inv').pop().id))`)},
  {name: 'acc-inv-' + sfx, go: accEval(`docModal(${party}, 'inv')`)},
  {name: 'acc-inv-edit-' + sfx, go: async A => { await accEval(`docModal(${party}, 'inv', [...E.values()].filter(e => e.party === ${party}.id && e.kind === 'inv' && !e.del && (e.lines || []).length > 1).pop())`)(A); await A.focus('#dcLines .li:nth-child(2) [data-f=qty]'); }},
  {name: 'acc-inv-sug-' + sfx, go: async A => { await accEval(`docModal(${party}, 'inv')`)(A); await A.focus('#dcLines [data-f=name]'); }},
  {name: 'acc-pay-' + sfx, go: accEval(`payModal(${party}, 'pay')`)},
  {name: 'acc-exp-' + sfx, go: accEval(`txModal('exp'); $('#txA').value = '350'; $('#txN').value = 'شحن كهرباء'; $('#txN').dispatchEvent(new Event('input'))`)},
  {name: 'acc-catfix-' + sfx, go: accEval(`(() => { const id = n => (catsL('exp').find(c => c.name === n) || {}).id, now = nowS(); [['كهربا الشهر', 'خامات', 'v_main'], ['سيور المكنة', 'خامات', 'v_main'], ['بنزين — العربية', '', 'v_mkt'], ['مخالفة', 'نثريات', 'v_main']].forEach(([note, c, vault], i) => { const r = {id: 't_cfs' + i, type: 'exp', amt: 25000 + i * 5000, date: addDays(todayISO(), -i), note, cat: c ? id(c) : 'c_mkexp', vault, to: '', at: now, upd: now, del: false, hist: []}; db.txs.push(r); IDX.tx.set(r.id, r); }); catFixOpen(); })()`)},
  {name: 'acc-quick-' + sfx, go: accEval('quickModal()')},
  {name: 'acc-cash-' + sfx, go: accEval(`cashView = 'type'; cashMode = 'week'; cashDay = ''; cashOpenV = false; go('cash'); renderCash()`), full: true},
  {name: 'acc-part-' + sfx, go: accGo('part'), full: true},
  {name: 'acc-mkt-' + sfx, go: accGo('mkt'), full: true},
  {name: 'acc-rep-' + sfx, go: accGo('rep'), full: true},
  {name: 'acc-rep-pft-' + sfx, go: accEval(`go('rep'); repKind = 'profit'; repMode = 'year'; renderReports()`), full: true},
  {name: 'acc-rep-cash-' + sfx, go: accEval(`go('rep'); repKind = 'cash'; repMode = 'month'; renderReports()`), full: true},
  {name: 'acc-col-' + sfx, go: async A => { await accGo('rep')(A); await A.evaluate(() => { repKind = 'col'; repColMode = 'month'; renderReports(); }); }, full: true},
  {name: 'acc-ldg-' + sfx, go: accEval(`cashView = 'date'; cashMode = 'week'; cashDay = ''; cashOpenV = false; go('cash'); renderCash()`), full: true},
  {name: 'acc-cash-srch-' + sfx, go: async A => { await accEval(`cashView = 'date'; cashMode = 'week'; cashDay = ''; go('cash'); renderCash(); $('#cSrch').click()`)(A); await A.fill('#csQ', 'عميل'); await A.waitForTimeout(150); }},
  {name: 'acc-ldg-mon-' + sfx, go: accEval(`cashView = 'date'; cashMode = 'month'; cashMonth = ''; cashOpenV = false; go('cash'); renderCash()`), full: true},
  {name: 'acc-set-' + sfx, go: accGo('set'), full: true},
  {name: 'acc-jrd-' + sfx, go: accEval(IVSHOT + "jrDate = ''; jrStock = null; go('jrd')"), full: true},
  {name: 'acc-jrd-old-' + sfx, go: accEval(JRDSHOT + "jrDate = ''; jrStock = null; go('jrd'); jrdOldModal()")},
  {name: 'acc-jrd-list-' + sfx, go: accEval(JRDSHOT + "jrDate = ''; jrStock = null; go('jrd')"), full: true},
  {name: 'acc-rep-stk-' + sfx, go: accEval(JRDSHOT + "go('rep'); repKind = 'profit'; repMode = 'range'; repFrom = addDays(todayISO(), -59); repTo = todayISO(); renderReports()"), full: true},
  {name: 'acc-fac-' + sfx, go: facGo(false), full: true},
  {name: 'acc-fac-rev-' + sfx, go: facGo(true)},
  {name: 'acc-fac-pick-' + sfx, go: facGo('pick')},
  {name: 'acc-iv-' + sfx, go: accEval(IVSHOT + "go('jrd/iv/ip_shot')"), full: true},
].map(x => Object.assign({app: 'acc', vp}, x, extra, vp.width > 999 ? {full: false} : {}));
const SCREENS = [
  ...ACC('m', MOB),
  {name: 'acc-rep-ah-m', app: 'acc', vp: MOB, full: true, go: accEval(`go('rep'); repKind = 'ah'; repMode = 'week'; repDay = addDays(todayISO(), -3); renderReports()`)},
  {name: 'acc-lock-m', app: 'acc', vp: MOB, go: accEval("$('#bLock').click()")},
  ...ACC('l', LAP),
  {name: 'acc-party-l1100', app: 'acc', vp: LAP2, go: accEval(`go('p/' + ${party}.id)`)},
  {name: 'acc-mkt-arch-m', app: 'acc', vp: MOB, full: true, go: accEval("mkView = 'arch'; mkDay = ''; go('mkt'); renderMkt()")},
  {name: 'acc-cash-wk-m', app: 'acc', vp: MOB, go: accEval("cashSide = 'me'; cashMode = 'week'; go('cash'); renderCash()")},
  {name: 'acc-cash-rng-m', app: 'acc', vp: MOB, go: accEval("cashSide = 'me'; cashMode = 'range'; go('cash'); renderCash()")},
  {name: 'acc-cash-open-m', app: 'acc', vp: MOB, full: true, go: accEval(`cashOpenV = true; cashVault = ''; go('cash'); renderCash()`)},
  {name: 'acc-cash-open-l', app: 'acc', vp: LAP, go: accEval(`cashOpenV = true; cashVault = ''; go('cash'); renderCash()`)},
  {name: 'acc-cash-sheet-m', app: 'acc', vp: MOB, go: async A => { await accEval(`cashView = 'type'; cashMode = 'week'; cashOpenV = false; go('cash'); renderCash()`)(A); await A.waitForTimeout(300); await A.evaluate(() => [...$$('#p-cash .fbk .fbr')].pop().click()); }},
  {name: 'acc-sync-log-m', app: 'acc', vp: MOB, go: accEval("syncNow = async () => {}; mkSync = async () => {}; db.cfg.sheetOk = true; db.cfg.sheetUrl = db.cfg.sheetUrl || 'x'; const t = Date.now(); db.cfg.syLog = [{at: t - 60000, s: 12.4, ok: true, why: '', n: 3, d: 'سحب 3.1 · إرسال 5.2 · تأكيد 4.1'}, {at: t - 300000, s: 45.1, ok: false, why: 'الشيت مردش في الوقت المحدد', n: 0}, {at: t - 900000, s: 1.8, ok: true, why: '', n: 1}]; go('set'); renderSettings(); setTimeout(() => { renderSetStat(); $('#sStat .sylog').open = true; }, 400)")},
  {name: 'acc-set-pass-m', app: 'acc', vp: MOB, full: true, go: accEval("go('set'); renderSettings(); $('#sBio').style.display='block'; $('#sBio').textContent='👆 بصمة الوجه'; $$('#p-set > .card').forEach(c => c.classList.toggle('shut', !/كلمة السر/.test(c.querySelector('h2').textContent)))")},
  {name: 'acc-party-scroll-m', app: 'acc', vp: MOB, go: async A => { await accEval(`tab = 'mkt'; go('p/' + ${party}.id)`)(A); await A.evaluate(() => { const b = $('#p-party'); b.scrollTo(0, b.scrollHeight / 2); }); await A.waitForTimeout(300); console.log('th top', await A.evaluate(() => Math.round($('#p-party .ldg th').getBoundingClientRect().top))); }},
  {name: 'acc-party-zoom-m', app: 'acc', vp: MOB, go: async A => { await accEval(`tab = 'mkt'; go('p/' + ${party}.id)`)(A); await A.evaluate(() => { document.documentElement.style.setProperty('--lz', 1.8); document.documentElement.setAttribute('data-lz', ''); const st = document.createElement('style'); st.textContent = '.ldgw .ldg{zoom:var(--lz)}'; document.head.appendChild(st); }); await A.waitForTimeout(300); }},
  {name: 'acc-cash-l1100', app: 'acc', vp: LAP2, go: accGo('cash')},
  {name: 'acc-cash-pick-m', app: 'acc', vp: MOB, go: accEval("cashOpenV = false; cashVault = ''; cashMode = 'day'; cashDay = addDays(todayISO(), -1); go('cash'); renderCash(); $('#cPer').classList.add('pk')")},
  {name: 'acc-list-m-dark', app: 'acc', vp: MOB, dark: true, go: accEval("tab = 'mkt'; go('home'); renderHome()")},
  {name: 'acc-party-m-dark', app: 'acc', vp: MOB, dark: true, go: accEval(`go('p/' + ${party}.id)`)},
  {name: 'acc-claude-m', app: 'acc', vp: MOB, go: async A => { await accGo('home')(A); await A.click('#bCl:visible, #nCl:visible'); await A.waitForSelector('#clGo'); }},
  {name: 'acc-inv-m-dark', app: 'acc', vp: MOB, dark: true, go: accEval(`docModal(${party}, 'inv')`)},
  {name: 'acc-cash-m-dark', app: 'acc', vp: MOB, dark: true, go: accGo('cash')},
  {name: 'acc-party-l-dark', app: 'acc', vp: LAP, dark: true, go: accEval(`go('p/' + ${party}.id)`)},
  {name: 'acc-mkt-l-dark', app: 'acc', vp: LAP, dark: true, go: accGo('mkt')},
  {name: 'mkt-home-m', app: 'mkt', vp: MOB, full: true, go: mktGo('')},
  {name: 'mkt-cust-m', app: 'mkt', vp: MOB, full: true, go: mktGo('c')},
  {name: 'mkt-pay-m', app: 'mkt', vp: MOB, full: true, go: async M => { await M.evaluate(() => { nav('p/p2'); document.activeElement && document.activeElement.blur(); }); }},
  {name: 'mkt-spend-m', app: 'mkt', vp: MOB, full: true, go: async M => { await M.evaluate(() => { nav('x'); document.activeElement && document.activeElement.blur(); }); }},
  {name: 'mkt-sup-m', app: 'mkt', vp: MOB, full: true, go: mktGo('v')},
  {name: 'mkt-supacc-m', app: 'mkt', vp: MOB, full: true, go: mktGo('v/v1')},
  {name: 'mkt-supneg-m', app: 'mkt', vp: MOB, full: true, go: mktGo('v/v4')},
  {name: 'mkt-suppay-m', app: 'mkt', vp: MOB, full: true, go: async M => { await M.evaluate(() => { spTab = 'spay'; spPick = ''; nav('x'); document.activeElement && document.activeElement.blur(); }); }},
  {name: 'mkt-suppick-m', app: 'mkt', vp: MOB, full: true, go: async M => { await M.evaluate(() => { spTab = 'spay'; spPick = 'v1'; spBack = 'v/v1'; nav('x'); document.activeElement && document.activeElement.blur(); }); }},
  {name: 'mkt-sup-m-dark', app: 'mkt', vp: MOB, dark: true, go: mktGo('v')},
  {name: 'mkt-sale-m', app: 'mkt', vp: MOB, go: async M => { await M.evaluate(() => { nav('b'); document.activeElement && document.activeElement.blur(); }); }},
  {name: 'mkt-ok-m', app: 'mkt', vp: MOB, go: mktGo('ok/m_shot1')},
  {name: 'mkt-arch-m', app: 'mkt', vp: MOB, full: true, go: mktGo('a')},
  {name: 'mkt-day-m', app: 'mkt', vp: MOB, full: true, go: mktGo('a/' + iso(1))},
  {name: 'mkt-mon-m', app: 'mkt', vp: MOB, full: true, go: mktGo('a/' + iso(0).slice(0, 7))},
  {name: 'mkt-set-m', app: 'mkt', vp: MOB, full: true, go: mktGo('s')},
  {name: 'mkt-edit-m', app: 'mkt', vp: MOB, go: async M => { await M.evaluate(() => { nav(''); editSheet(S.ops.m_shot1); }); }},
  {name: 'mkt-hand-m', app: 'mkt', vp: MOB, go: async M => { await M.evaluate(() => { nav(''); handModal(); document.activeElement && document.activeElement.blur(); }); }},
  {name: 'mkt-home-m-dark', app: 'mkt', vp: MOB, dark: true, full: true, go: mktGo('')},
  {name: 'mkt-homeinv-m', app: 'mkt', vp: MOB, full: true, go: async M => { await M.evaluate(() => { ldTab = 'inv'; nav(''); drawHome(); }); }},
  {name: 'mkt-homeinv-m-dark', app: 'mkt', vp: MOB, dark: true, full: true, go: async M => { await M.evaluate(() => { ldTab = 'inv'; nav(''); drawHome(); }); }},
  {name: 'mkt-cust-m-dark', app: 'mkt', vp: MOB, dark: true, go: mktGo('c')},
  {name: 'mkt-arch-m-dark', app: 'mkt', vp: MOB, dark: true, go: mktGo('a')},
  /* ورق الـ PDF (لازم ميتغيرش): بيتصور آخر حاجة في كل جهاز لأن الورقة بتتحط قدام الصفحة */
  {name: 'pdf-stmt', app: 'acc', vp: LAP, el: '#render .pg', go: accEval(`go('p/' + ${party}.id); buildStmtPages(${party}, stmtData(${party}.id, '', '')); Object.assign($('#render').style, {left: '0', zIndex: 9999})`)},
  {name: 'pdf-stmt-all', app: 'acc', vp: LAP, el: '#render', go: accEval(`go('p/' + ${party}.id); buildStmtPages(${party}, stmtData(${party}.id, '', '')); Object.assign($('#render').style, {left: '0', zIndex: 9999, width: 'auto', display: 'flex', gap: '24px', background: '#888', padding: '24px'})`)},
  {name: 'pdf-stmt-long', app: 'acc', vp: {width: 1800, height: 900}, el: '#render', go: accEval(`const src = ${party}, np = Object.assign({}, src, {id: 'p_long', name: 'عميل تجربة كشف طويل'}); db.parties.push(np);
    db.entries.filter(e => e.party === src.id && !e.del).forEach(e => { for (let k = 0; k < (e.type === 'open' ? 1 : 4); k++) { const c = JSON.parse(JSON.stringify(e)); c.id = e.id + '_L' + k; c.party = np.id; c.date = e.type === 'open' ? addDays(e.date, -700) : addDays(e.date, -k * 170); db.entries.push(c); } });
    reindex(); go('p/' + np.id); buildStmtPages(np, stmtData(np.id, '', '')); Object.assign($('#render').style, {left: '0', zIndex: 9999, width: 'auto', display: 'flex', flexWrap: 'wrap', width: '1750px', gap: '24px', background: '#888', padding: '24px'})`)},
  {name: 'pdf-stmt-wrap', app: 'acc', vp: {width: 1800, height: 900}, el: '#render', go: accEval(`const src = ${party}, np = Object.assign({}, src, {id: 'p_wrap', name: 'عميل تجربة بيان طويل'}); db.parties.push(np);
    db.entries.filter(e => e.party === src.id && !e.del).forEach(e => { for (let k = 0; k < (e.type === 'open' ? 1 : 4); k++) { const c = JSON.parse(JSON.stringify(e)); c.id = e.id + '_L' + k; c.party = np.id; (c.lines || []).forEach((it, q) => { if (q % 2 === 0) it.name = it.name + ' مقاس خاص للعميل مصطفى محمود'; }); c.date = e.type === 'open' ? addDays(e.date, -700) : addDays(e.date, -k * 170); db.entries.push(c); } });
    reindex(); go('p/' + np.id); buildStmtPages(np, stmtData(np.id, '', '')); Object.assign($('#render').style, {left: '0', zIndex: 9999, width: 'auto', display: 'flex', flexWrap: 'wrap', width: '1750px', gap: '24px', background: '#888', padding: '24px'})`)},
  {name: 'pdf-stmt-wrap1', app: 'acc', vp: LAP, el: '#render .pg', go: accEval(`const src = ${party}, np = Object.assign({}, src, {id: 'p_wrap1', name: 'عميل تجربة بيان طويل'}); db.parties.push(np);
    db.entries.filter(e => e.party === src.id && !e.del).forEach(e => { for (let k = 0; k < 1; k++) { const c = JSON.parse(JSON.stringify(e)); c.id = e.id + '_L' + k; c.party = np.id; (c.lines || []).forEach((it, q) => { if (q % 2 === 0) it.name = it.name + ' مقاس خاص للعميل مصطفى محمود'; }); c.date = e.type === 'open' ? addDays(e.date, -700) : addDays(e.date, -k * 170); db.entries.push(c); } });
    reindex(); go('p/' + np.id); buildStmtPages(np, stmtData(np.id, '', '')); Object.assign($('#render').style, {left: '0', zIndex: 9999})`)},
  {name: 'pdf-stmt-sup', app: 'acc', vp: LAP, el: '#render .pg', go: accEval(`const sp = liveParties().find(p => p.sec === 'sup'); go('p/' + sp.id); const s = stmtData(sp.id, todayISO().slice(0, 8) + '01', todayISO()); buildStmtPages(sp, s); Object.assign($('#render').style, {left: '0', zIndex: 9999})`)},
  {name: 'pdf-ldg', app: 'acc', vp: LAP, el: '#render .pg', go: accEval(`cashView = 'date'; cashMode = 'range'; cashFrom = addDays(todayISO(), -20); cashTo = todayISO(); cashOpenV = false; go('cash'); renderCash(); buildReportPages(ldgReport(ldgItems(cashRange()[0], cashRange()[1]), cashRange()[0], cashRange()[1])); Object.assign($('#render').style, {left: '0', zIndex: 9999})`)},
  {name: 'pdf-rep', app: 'acc', vp: LAP, el: '#render .pg', go: accEval(`go('rep'); buildReportPages(buildReport()); Object.assign($('#render').style, {left: '0', zIndex: 9999})`)},
];

const fixTime = t => { const D = Date, off = t - D.now(); class FD extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])); } static now() { return D.now() + off; } } window.Date = FD; };
async function newCtx(browser, vp, dark) {
  const ctx = await browser.newContext({viewport: vp, deviceScaleFactor: 2, locale: 'ar-EG', colorScheme: dark ? 'dark' : 'light'});
  await ctx.addInitScript(fixTime, NOW);
  return ctx;
}
/* حركات تجريبية لخزنة الحسابات ووارد السوق (بعد النقل) */
function accExtra(iso0, now) {
  ensureVaults();
  const v = defVault(), ce = catsL('exp'), ci = catsL('inc');
  const d = n => new Date(now - n * 86400000).toISOString().slice(0, 10);
  [['exp', 320000, 0, ce[0], 'نقل طلبية'], ['exp', 1800000, 0, ce[1] || ce[0], ''], ['inc', 475000, 0, ci[0], 'بيع نقدي'], ['exp', 95000, 1, ce[2] || ce[0], 'شاي وسكر'], ['inc', 1200000, 1, ci[0], ''], ['exp', 640000, 2, ce[3] || ce[0], 'يومية العمال']]
    .forEach(([type, amt, n, c, note], i) => { const r = {id: 't_shot' + i, at: now, upd: now, del: false, hist: [], type, amt, date: d(n), note, vault: v, to: '', cat: c ? c.id : ''}; db.txs.push(r); IDX.tx.set(r.id, r); });
  putSet('mktSheet', {u: 'https://script.google.com/macros/s/SHOT-MKT/exec', k: 'Shot-Key'});
  mkDb().u = 'https://script.google.com/macros/s/SHOT-MKT/exec';
  const P = n => liveParties().find(p => p.name === n), ops = mkDb().ops, ts = (n, h) => now - n * 86400000 + (h - 9) * 3600000;
  [['pay', 'معرض تجربة الأمل', 250000, 'cash', 0, 9], ['pay', 'عميل تجربة خمسة', 150000, 'tr', 0, 10], ['inv', 'عميل تجربة واحد', 66000, '', 0, 10.5], ['exp', '', 30000, '', 0, 11], ['spay', '', 120000, '', 0, 12], ['hand', '', 900000, '', 1, 17]]
    .forEach(([t, n, amt, m, dd, h], i) => { const p = n && P(n), id = 'mshot' + i; ops[id] = {id, t, amt, ts: ts(dd, h), cr: ts(dd, h), upd: ts(dd, h), cid: p ? p.id : '', cname: n, m, cat: t === 'exp' ? 'بنزين' : '', sname: t === 'spay' ? 'مورد تجربة الخامات' : '', del: false}; });
  /* حركات سوق اتنقلت فعلاً (علشان نص "حركة شريكي" في الخزنة): تحصيل كاش، تحويل دخل خزنتي، مصروف، دفعة مورد، وكاش سلّمه */
  ensureMktVault();
  [['pay', 'عميل تجربة اتنين', 180000, 'cash', 0, 9.5, 'v_mkt'], ['pay', 'عميل تجربة تلاتة', 95000, 'insta', 0, 10, v], ['exp', '', 15000, '', 0, 11.5, 'v_mkt'], ['spay', 'مورد تجربة الكرتون', 60000, '', 0, 13, 'v_mkt'], ['hand', '', 100000, '', 0, 16, 'v_mkt']]
    .forEach(([t, n, amt, m, dd, h, vv], i) => { const p = n && P(n), id = 'mdone' + i; ops[id] = {id, t, amt, ts: ts(dd, h), cr: ts(dd, h), upd: ts(dd, h), cid: t === 'pay' && p ? p.id : '', cname: n, m, cat: t === 'exp' ? 'أكل وشرب' : '', sname: t === 'spay' ? n : '', del: false};
      mkMove(ops[id], {pid: p ? p.id : '', amt, date: d(dd), vault: vv, to: t === 'hand' ? v : ''}); });
  saveDB();
}
async function accPage(browser, base, vp, dark) {
  const ctx = await newCtx(browser, vp, dark);
  await ctx.route('https://script.google.com/**', r => r.abort('failed'));
  const A = await ctx.newPage();
  await A.goto(base + 'accounts.html');
  await A.fill('#suP', PASS); await A.fill('#suP2', PASS); await A.click('#suGo');
  await A.waitForSelector('#lock', {state: 'hidden'});
  await A.evaluate(x => importModal(readImport(x)), accData());
  await A.click('#imGo'); await A.click('#cOk');
  await A.waitForFunction(() => db && db.parties.length >= 14);
  await A.evaluate(`(${accExtra})(${JSON.stringify(iso(0))}, ${NOW})`);
  return A;
}
async function mktPage(browser, base, vp, dark) {
  const ctx = await newCtx(browser, vp, dark);
  await ctx.addInitScript(s => { if (!localStorage.getItem('fo_mkt_v1')) localStorage.setItem('fo_mkt_v1', s); }, JSON.stringify(mktState()));
  await ctx.route('https://script.google.com/**', r => {
    const b = r.request().postData() || '';
    let j = {}; try { j = JSON.parse(b); } catch (e) {}
    const body = j.action === 'push' ? {ok: true, ack: (j.rows || []).map(x => x.id)} : {ok: true, rows: [], next: 1, more: false};
    r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  });
  const M = await ctx.newPage();
  await M.goto(base + 'market.html');
  return M;
}
(async () => {
  if (args.includes('--list')) { SCREENS.forEach(s => console.log(s.name)); return; }
  fs.mkdirSync(OUT, {recursive: true});
  const srv = await serve(), base = `http://localhost:${srv.address().port}/`;
  const browser = await pw.chromium.launch(CHROME ? {executablePath: CHROME} : {});
  const pages = {};
  try {
    for (const s of SCREENS) {
      if (ONLY && !ONLY.some(o => s.name === o || (o.endsWith('*') && s.name.startsWith(o.slice(0, -1))))) continue;
      const key = s.app + s.vp.width + (s.dark ? 'd' : '');
      if (!pages[key]) pages[key] = await {acc: accPage, mkt: mktPage}[s.app](browser, base, s.vp, s.dark);
      const X = pages[key];
      try {
        await s.go(X);
        await X.evaluate(() => document.fonts.ready);
        await X.addStyleTag({content: '#toast{display:none!important}*{caret-color:transparent!important}'});
        await X.waitForTimeout(1300);   // حركة الأرقام (العدّاد) بتخلص
        await X.evaluate(() => window.scrollTo(0, 0));
        if (process.env.SHOT_EVAL) console.log(s.name, await X.evaluate(process.env.SHOT_EVAL));   // للفحص: كود بيتشغل في الصفحة وبيطبع النتيجة
        if (process.env.SHOT_DUMP) fs.writeFileSync(path.join(OUT, s.name + '.json'), await X.evaluate(fs.readFileSync(process.env.SHOT_DUMP, 'utf8')));   // للفحص: نتيجة كود (JSON) جنب كل صورة
        const f = path.join(OUT, s.name + '.png');
        /* الصفحة كلها: الشاشة بتطول على قد الصفحة (علشان الشريط اللي تحت يفضل تحت) وبترجع زي ما كانت */
        if (s.full) { const h = await X.evaluate(() => Math.max(document.documentElement.scrollHeight, innerHeight)); await X.setViewportSize({width: s.vp.width, height: Math.min(h, 6000)}); await X.waitForTimeout(300); }
        if (s.el) await X.locator(s.el).first().screenshot({path: f}); else await X.screenshot({path: f});
        if (s.full) await X.setViewportSize(s.vp);
        console.log('✔', s.name);
      } catch (e) { console.log('✖', s.name, e.message.split('\n')[0]); }
    }
  } finally { await browser.close(); srv.close(); }
})();
