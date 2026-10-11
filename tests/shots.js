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
   ['p7', 'عميل تجربة أربعة', 9875000, 'r', ''], ['p8', 'عميل تجربة خمسة', 188000, '', iso(1)], ['p9', 'عميل تجربة اتنين', 0, '', iso(20)]]
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
  op({t: 'spay', sname: 'مورد تجربة', amt: 120000, ts: day(0, 12, 20)});
  op({t: 'cs', buyer: 'زبون تجربة', amt: 95000, ts: day(0, 13, 5)});
  op({t: 'pay', cid: 'p5', cname: 'ورشة تجربة', amt: 1000000, m: 'cash', ts: day(1, 9, 50)}, {done: true});
  op({t: 'pay', cid: 'p4', cname: 'محل تجربة الجديد', amt: 75000, m: 'cash', ts: day(1, 11, 30)}, {done: true});
  op({t: 'hand', amt: 900000, ts: day(1, 17, 0)}, {done: true});
  op({t: 'exp', cat: 'نقل', note: '', amt: 45000, ts: day(1, 14, 0)});
  op({t: 'pay', cid: 'p1', cname: 'مؤسسة تجربة للمقاولات العمومية', amt: 1250000, m: 'tr', ts: day(2, 10, 0)}, {done: true});
  op({t: 'rt', cid: 'p6', cname: 'عميل تجربة تلاتة', amt: 19000, note: 'كرتونة وصلات', ts: day(2, 12, 0)}, {done: true});
  return {u: 'https://script.google.com/macros/s/SHOT-MKT/exec', k: 'Shot-Key', dev: 'sh01', cursor: 1, ops, st, cust, newc: [], lastOk: NOW, cSort: 'owe'};
}

/* ====================== الشاشات ====================== */
const MOB = {width: 390, height: 844}, LAP = {width: 1440, height: 900};
const SCREENS = [
  {name: 'acc-list-m', app: 'acc', vp: MOB, full: true, go: async A => { await A.evaluate(() => { tab = 'mkt'; go('home'); }); }},
  {name: 'acc-party-l', app: 'acc', vp: LAP, go: async A => { await A.evaluate(() => go('p/' + liveParties().find(p => p.name.startsWith('مؤسسة تجربة')).id)); }},
  {name: 'mkt-home-m', app: 'mkt', vp: MOB, full: true, go: async () => {}},
  {name: 'acc-list-m-dark', app: 'acc', vp: MOB, dark: true, go: async A => { await A.evaluate(() => { tab = 'mkt'; go('home'); }); }},
  {name: 'acc-party-l-dark', app: 'acc', vp: LAP, dark: true, go: async A => { await A.evaluate(() => go('p/' + liveParties().find(p => p.name.startsWith('مؤسسة تجربة')).id)); }},
  {name: 'mkt-home-m-dark', app: 'mkt', vp: MOB, dark: true, go: async () => {}},
];

async function accPage(browser, base, vp, dark) {
  const ctx = await browser.newContext({viewport: vp, deviceScaleFactor: 2, locale: 'ar-EG', colorScheme: dark ? 'dark' : 'light'});
  await ctx.addInitScript(t => { const D = Date, off = t - D.now(); class FD extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])); } static now() { return D.now() + off; } } window.Date = FD; }, NOW);
  await ctx.route('https://script.google.com/**', r => r.abort('failed'));
  const A = await ctx.newPage();
  await A.goto(base + 'accounts.html');
  await A.fill('#suP', PASS); await A.fill('#suP2', PASS); await A.click('#suGo');
  await A.waitForSelector('#lock', {state: 'hidden'});
  await A.evaluate(x => importModal(readImport(x)), accData());
  await A.click('#imGo'); await A.click('#cOk');
  await A.waitForFunction(() => db && db.parties.length >= 14);
  return A;
}
async function mktPage(browser, base, vp, dark) {
  const ctx = await browser.newContext({viewport: vp, deviceScaleFactor: 2, locale: 'ar-EG', colorScheme: dark ? 'dark' : 'light'});
  await ctx.addInitScript(t => { const D = Date, off = t - D.now(); class FD extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])); } static now() { return D.now() + off; } } window.Date = FD; }, NOW);
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
  fs.mkdirSync(OUT, {recursive: true});
  const srv = await serve(), base = `http://localhost:${srv.address().port}/`;
  const browser = await pw.chromium.launch(CHROME ? {executablePath: CHROME} : {});
  const pages = {};
  try {
    for (const s of SCREENS) {
      if (ONLY && !ONLY.includes(s.name)) continue;
      const key = s.app + s.vp.width + (s.dark ? 'd' : '');
      if (!pages[key]) pages[key] = s.app === 'acc' ? await accPage(browser, base, s.vp, s.dark) : await mktPage(browser, base, s.vp, s.dark);
      const X = pages[key];
      await s.go(X);
      await X.evaluate(() => document.fonts.ready);
      await X.addStyleTag({content: '#toast{display:none!important}'});
      await X.waitForTimeout(1300);   // حركة الأرقام (العدّاد) بتخلص
      const f = path.join(OUT, s.name + '.png');
      /* الصفحة كلها: الشاشة بتطول على قد الصفحة (علشان الشريط اللي تحت يفضل تحت) وبترجع زي ما كانت */
      if (s.full) { const h = await X.evaluate(() => Math.max(document.documentElement.scrollHeight, innerHeight)); await X.setViewportSize({width: s.vp.width, height: Math.min(h, 6000)}); await X.waitForTimeout(300); }
      await X.screenshot({path: f});
      if (s.full) await X.setViewportSize(s.vp);
      console.log('✔', s.name);
    }
  } finally { await browser.close(); srv.close(); }
})();
