/*
  اختبارات تطبيق المرتبات (payroll.html) — بيانات تجريبية بس (عمال وأسامي وهمية).
  التشغيل:  node tests/payroll.js
  1) قواعد الحساب لوحدها (من غير متصفح): يوم ونص، الجمعة شغل، سلفة أكبر من المرتب (مرحّل)، تغيير الأجر.
  2) كود شيت جوجل (gasmock): المفتاح، الإرسال والسحب، والسجل مبيتعدلش.
  3) التطبيق نفسه في متصفح من غير شاشة على 3 موبايلات: الدخول، العمال، النهارده، الأسبوع، القفل، القبض، السجل، القفل التلقائي.
  لازم يطلع في الآخر "0 فشل".
*/
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const {makeGas} = require('./gasmock');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
const PAY_URL = 'https://script.google.com/macros/s/TEST-PAY/exec';

let fails = 0, oks = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { oks++; console.log('  ✔', name); } else { fails++; console.log('  ✖', name, '\n     المتوقع:', JSON.stringify(want), '\n     اللي طلع:', JSON.stringify(got)); }
}

/* ====================== 1) قواعد الحساب ====================== */
const html = fs.readFileSync(path.join(ROOT, 'payroll.html'), 'utf8');
const eng = vm.createContext({console});
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;this.E = {ownerThursday, weekDates, settle, unitsText, buildIdx, calcWeek, missingDays};', eng);
const E = eng.E;
const J = x => JSON.parse(JSON.stringify(x));
console.log('\n١) قواعد الحساب');
eq('الخميس بتاع السبت/الأربع/الخميس/الجمعة', ['2026-10-10', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'].map(E.ownerThursday), ['2026-10-15', '2026-10-15', '2026-10-15', '2026-10-15', '2026-10-22']);
eq('أيام الأسبوع: السبت..الخميس وبعدهم الجمعة', J(E.weekDates('2026-10-15')), ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
eq('الكلام عن عدد الأيام', [0, 0.5, 1, 1.5, 2, 2.5, 5, 5.5].map(E.unitsText), ['من غير أيام', 'نص يوم', 'يوم', 'يوم ونص', 'يومين', 'يومين ونص', '5 أيام', '5 أيام ونص']);
eq('settle: عادي', J(E.settle({daysPay: 150000, fridayPay: 25000, bonus: 5000, advances: 30000})), {wages: 180000, oldApplied: 0, net: 150000, carryOut: 0});
eq('settle: سلفة أكبر من المرتب = صافي 0 ومرحّل', J(E.settle({daysPay: 40000, advances: 70000})), {wages: 40000, oldApplied: 0, net: 0, carryOut: 30000});
eq('settle: المرحّل بيتخصم الأسبوع اللي بعده', J(E.settle({daysPay: 120000, carryIn: 30000})), {wages: 120000, oldApplied: 0, net: 90000, carryOut: 0});
eq('settle: الخصم القديم مبيعديش الباقي', J(E.settle({daysPay: 50000, advances: 10000, oldDeduct: 60000})), {wages: 50000, oldApplied: 40000, net: 0, carryOut: 0});

const W1 = {id: 'w1', k: 'wk', name: 'عامل تجربة أ', rate: 25000, fri: 30000, st: 'on', from: '2026-10-01', ord: 1};
const W2 = {id: 'w2', k: 'wk', name: 'عامل تجربة ب', rate: 20000, fri: 20000, st: 'on', from: '2026-10-01', ord: 2};
const day = (w, date, u, rate) => ({id: `d_${w}_${date}`, k: 'day', w, date, u, rate});
const wk1 = E.weekDates('2026-10-15').slice(0, 6), wk2 = E.weekDates('2026-10-22').slice(0, 6);
let recs = [W1, W2,
  ...[1, 1.5, 0.5, 0, 1, 1].map((u, i) => day('w1', wk1[i], u, 25000)),
  day('w2', wk1[0], 1, 20000), day('w2', wk1[1], 1, 20000), ...wk1.slice(2).map(d => day('w2', d, 0, 20000)),
  {id: 'ws_2026-10-15', k: 'wst', thu: '2026-10-15', fri: 'work'},
  {id: 'b1', k: 'bon', w: 'w1', thu: '2026-10-15', amt: 5000},
  {id: 'a1', k: 'adv', w: 'w1', date: '2026-10-12', amt: 20000},
  {id: 'a2', k: 'adv', w: 'w2', date: '2026-10-11', amt: 90000}];
let I = E.buildIdx(recs), c = E.calcWeek(I, '2026-10-15');
eq('يوم ونص + نص + غياب: 5 أيام = 1,250', [c.rows.w1.units, c.rows.w1.daysPay], [5, 125000]);
eq('الجمعة شغل: أجر الجمعة بيتزود مع الخميس', c.rows.w1.fridayPay, 30000);
eq('الصافي = الأيام + الجمعة + الحافز − السلف', c.rows.w1.net, 125000 + 30000 + 5000 - 20000);
eq('سلفة أكبر من المرتب: صافي 0 وعليه الفرق', [c.rows.w2.wages, c.rows.w2.net, c.rows.w2.carryOut], [60000, 0, 30000]);
eq('إجمالي اللي هيخرج', c.total, 140000);
/* الأسبوع اللي بعده: المرحّل بيتخصم، وتغيير اليومية بيأثر على الأيام الجديدة بس */
recs = recs.concat([...wk2.slice(0, 3).map(d => day('w2', d, 1, 20000)), ...wk2.slice(3).map(d => day('w2', d, 1, 30000)), ...wk2.map(d => day('w1', d, 1, 25000))]);
recs[1] = Object.assign({}, W2, {rate: 30000});
I = E.buildIdx(recs); c = E.calcWeek(I, '2026-10-22');
eq('تغيير الأجر: 3 أيام بالقديم (200) و3 بالجديد (300)', c.rows.w2.daysPay, 3 * 20000 + 3 * 30000);
eq('المرحّل من الأسبوع اللي فات اتخصم', [c.rows.w2.carryIn, c.rows.w2.net], [30000, 150000 - 30000]);
eq('الجمعة إجازة (الافتراضي): مفيش أجر جمعة', c.rows.w1.fridayPay, 0);
/* الأسبوع المقفول: الأرقام بتيجي من اللقطة حتى لو الحركات اتغيرت */
const snap = J(E.calcWeek(E.buildIdx(recs), '2026-10-15', true));
recs.push({id: 'lk_2026-10-15', k: 'lk', thu: '2026-10-15', snap: {fri: snap.fri, rows: snap.rows, total: snap.total}});
recs.push({id: 'a3', k: 'adv', w: 'w1', date: '2026-10-13', amt: 99900});
I = E.buildIdx(recs);
eq('الأسبوع المقفول ثابت على اللقطة', [E.calcWeek(I, '2026-10-15').closed, E.calcWeek(I, '2026-10-15').total], [true, 140000]);
eq('الأيام الناقصة: عامل جديد من الأربع ومتسجلوش حاجة', J(E.missingDays(E.buildIdx(recs.concat([{id: 'w3', k: 'wk', name: 'عامل تجربة ج', rate: 1, st: 'on', from: '2026-10-21', ord: 3}])), '2026-10-22')).map(m => m.w + ' ' + m.date), ['w3 2026-10-21', 'w3 2026-10-22']);
eq('العامل الواقف مبيتطلبش له أيام', E.missingDays(E.buildIdx([Object.assign({}, W1, {st: 'stop'})]), '2026-10-15').length, 0);


/* ---- المرحلة التانية: فرق الجمعة ---- */
console.log('\n١-ب) فرق الجمعة (اللي اتدفعلهم ومجوش)');
const wk3 = E.weekDates('2026-10-29').slice(0, 6);
const w1days = [wk1, wk2, wk3].flatMap(w => w.map(d => day('w1', d, 1, 25000)));
const lockOf = (rs, thu) => { const cc = E.calcWeek(E.buildIdx(rs), thu, true); return {id: 'lk_' + thu, k: 'lk', thu, snap: {fri: cc.fri, rows: cc.rows, total: cc.total, oldPaid: cc.oldPaid}}; };
const rowOf = (rs, thu, id = 'w1') => J(E.calcWeek(E.buildIdx(rs), thu).rows[id]);
let f0 = [W1, ...w1days, {id: 'ws_2026-10-15', k: 'wst', thu: '2026-10-15', fri: 'work'}];
f0 = f0.concat([lockOf(f0, '2026-10-15')]);
eq('الأسبوع اللي فيه جمعة شغل: 1,500 + 300', [rowOf(f0, '2026-10-15').wages, rowOf(f0, '2026-10-15').net], [180000, 180000]);
eq('من غير ما نعلّم حاجة: محسوب إنه جه، مفيش خصم', [rowOf(f0, '2026-10-22').prevFridayDelta, rowOf(f0, '2026-10-22').net], [0, 150000]);
const fdOf = done => ({id: 'fd_2026-10-22_w1', k: 'fdf', thu: '2026-10-22', w: 'w1', done});
eq('مجاش: أجر الجمعة بيتخصم من الخميس الجاي', [rowOf(f0.concat([fdOf(0)]), '2026-10-22').prevFridayDelta, rowOf(f0.concat([fdOf(0)]), '2026-10-22').net], [30000, 120000]);
eq('جه: مفيش خصم', rowOf(f0.concat([fdOf(1)]), '2026-10-22').prevFridayDelta, 0);
eq('مجاش وسلفة كبيرة: الفرق بيترحّل', J((({prevFridayDelta, net, carryOut}) => ({prevFridayDelta, net, carryOut}))(rowOf(f0.concat([fdOf(0), {id: 'a9', k: 'adv', w: 'w1', date: '2026-10-20', amt: 160000}]), '2026-10-22'))), {prevFridayDelta: 30000, net: 0, carryOut: 40000});
const fOff = [W1, ...w1days]; fOff.push(lockOf(fOff, '2026-10-15'));
eq('الجمعة إجازة: مفيش حاجة تتخصم حتى لو معلّم مجاش', rowOf(fOff.concat([fdOf(0)]), '2026-10-22').prevFridayDelta, 0);

/* ---- السلف القديمة ---- */
console.log('\n١-ج) السلف القديمة وطرق الخصم');
const o0 = [W1, ...w1days, {id: 'o1', k: 'old', w: 'w1', amt: 100000, eff: '2026-10-15', date: '2026-01-01'}];
const ruleOf = (mode, amt) => ({id: 'ru_w1', k: 'rule', w: 'w1', mode, amt: amt || 0, eff: '2026-10-15'});
const od = (rs, thu) => { const r = rowOf(rs, thu); return [r.oldApplied, r.oldLeft, r.net]; };
eq('مفيش خصم: السلف القديمة مبتتخصمش', od(o0.concat([ruleOf('none')]), '2026-10-15'), [0, 100000, 150000]);
eq('بدون قاعدة خالص: مفيش خصم برضه', od(o0, '2026-10-15'), [0, 100000, 150000]);
const fx = o0.concat([ruleOf('fixed', 40000)]);
eq('مبلغ ثابت: 400 كل أسبوع', [od(fx, '2026-10-15'), od(fx, '2026-10-22'), od(fx, '2026-10-29')], [[40000, 60000, 110000], [40000, 20000, 110000], [20000, 0, 130000]]);
const au = o0.concat([ruleOf('auto')]);
eq('تلقائي: كل الباقي من أول مرتب', [od(au, '2026-10-15'), od(au, '2026-10-22')], [[100000, 0, 50000], [0, 0, 150000]]);
eq('تلقائي ومرتب أقل من الباقي: بيخصم لحد المرتب وبيكمل بعدين', od(o0.concat([ruleOf('auto'), {id: 'a8', k: 'adv', w: 'w1', date: '2026-10-12', amt: 100000}]), '2026-10-15').concat(od(o0.concat([ruleOf('auto'), {id: 'a8', k: 'adv', w: 'w1', date: '2026-10-12', amt: 100000}]), '2026-10-22')), [50000, 50000, 0, 50000, 0, 100000]);
const wd = (mode, amt) => ({id: 'wd_2026-10-15_w1', k: 'wded', thu: '2026-10-15', w: 'w1', mode, amt: amt || 0});
eq('متخصمش الأسبوع ده بس: الأسبوع اللي بعده زي القاعدة', [od(fx.concat([wd('skip')]), '2026-10-15'), od(fx.concat([wd('skip')]), '2026-10-22')], [[0, 100000, 150000], [40000, 60000, 110000]]);
eq('رقم تاني للأسبوع ده بس', [od(fx.concat([wd('amt', 25000)]), '2026-10-15'), od(fx.concat([wd('amt', 25000)]), '2026-10-22')], [[25000, 75000, 125000], [40000, 35000, 110000]]);
eq('رقم تاني أكبر من الباقي: بيتقص للباقي', od(fx.concat([wd('amt', 999999)]), '2026-10-15'), [100000, 0, 50000]);
eq('السلف القديمة بتبدأ من eff: أسبوع قبلها مفيهوش خصم', od(o0.concat([ruleOf('auto')]).map(x => x.id === 'o1' ? Object.assign({}, x, {eff: '2026-10-22'}) : x), '2026-10-15'), [0, 0, 150000]);

/* ====================== 2 و 3) الشيت والتطبيق ====================== */
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
/* الوقت بتوقيت القاهرة (+03:00 في أكتوبر) */
const at = s => new Date(s + '+03:00');
async function device(browser, base, gas, url, when) {
  const ctx = await browser.newContext({viewport: {width: 380, height: 820}, permissions: ['clipboard-read', 'clipboard-write'], timezoneId: 'Africa/Cairo'});
  ctx.errs = [];
  await ctx.route('https://script.google.com/**', r => {
    if (ctx.netDown) return r.abort('failed');
    const q = r.request();
    if (!gas.ctx.doPost) return r.fulfill({status: 200, contentType: 'text/html', body: '<html>no script</html>'});
    r.fulfill({status: 200, contentType: 'application/json', body: q.method() === 'POST' ? gas.post(q.postData()) : gas.get()});
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => { ctx.errs.push(e.message); if (process.env.DBG) console.log('PAGEERR', e.message); });
  await p.clock.setFixedTime(when);
  await p.goto(base + url);
  p.ctx = ctx;
  return p;
}
const settle_ = async P => { for (let i = 0; i < 40; i++) { const n = await P.evaluate(async () => { await sync(); return pending().length + (syncing ? 1 : 0); }); if (!n) return; await P.waitForTimeout(100); } };
const closed = P => P.waitForSelector('#mask', {state: 'hidden'});
const rowsOf = gas => (gas.sheets['الحركات'] ? gas.sheets['الحركات'].rows.slice(1) : []);

(async () => {
  const srv = await serve(), base = `http://localhost:${srv.address().port}/`;
  const browser = await pw.chromium.launch(CHROME ? {executablePath: CHROME} : {});
  const gas = makeGas({noDrive: true});
  const pages = [];
  try {
    console.log('\n٢) الدخول وربط الشيت');
    const A = await device(browser, base, gas, 'payroll.html', at('2026-10-15T09:00:00'));
    pages.push(A);
    eq('أول مرة: شاشة الاسم', (await A.textContent('.gate')).includes('اكتب اسمك'), true);
    await A.click('#lgNew'); await A.fill('#lgN', 'مشرف تجربة 1'); await A.fill('#lgP', '1234'); await A.click('#lgGo');
    await A.waitForSelector('#tabs button');
    eq('دخل والتبويبات ظهرت', await A.$$eval('#tabs button', b => b.map(x => x.textContent.trim())), ['النهارده', 'الأسبوع', 'العمال', 'الأرشيف', 'السجل']);
    eq('الرقم السري متخزن hash مش نص', await A.evaluate(() => { const s = me(); return [s.ph.length, s.ph.includes('1234')]; }), [64, false]);
    /* العمال */
    const addW = async (name, rate, fri, from) => {
      await A.evaluate(() => nav('k')); await A.click('#kNew'); await A.fill('#wkN', name); await A.fill('#wkR', rate); await A.fill('#wkF', fri);
      if (from) await A.fill('#wkD', from);
      await A.click('#wkOk'); await closed(A);
    };
    await addW('عامل تجربة أ', '250', '300', '2026-10-10');
    await addW('عامل تجربة ب', '200', '200', '2026-10-10');
    eq('العمال اتضافوا', await A.$$eval('#main .row .m b', b => b.map(x => x.textContent)), ['عامل تجربة أ', 'عامل تجربة ب']);
    /* ربط الشيت */
    await A.evaluate(() => nav('s'));
    eq('قبل الربط: كارت ربط الشيت ظاهر', !!(await A.$('#sheetCard')), true);
    await A.click('#sHelp'); await A.waitForSelector('#hpCopy');
    const code = await A.evaluate(() => payScript());
    gas.load(code);
    await A.click('#hpX');
    await A.fill('#sUrl', 'https://script.google.com/macros/s/TEST-PAY/exec?x=1 '); await A.click('#sLink');
    await A.waitForFunction(() => S.u && !$('#sheetCard'), null, {timeout: 15000});
    await settle_(A);
    eq('اتربط واتبعت كل حاجة للشيت', [await A.evaluate(() => S.u), rowsOf(gas).length > 0, await A.evaluate(() => pending().length)], [PAY_URL, true, 0]);
    eq('doGet بيرد locked', JSON.parse(gas.get()), {ok: false, error: 'locked'});
    eq('مفتاح غلط بيترفض', JSON.parse(gas.post(JSON.stringify({key: 'WRONG-KEY-XX', action: 'ping'}))).error, 'key');
    const KEY = await A.evaluate(() => S.k);
    eq('ping: الشيت بتاع المرتبات', JSON.parse(gas.post(JSON.stringify({key: KEY, action: 'ping'}))).app, 'fo-pay');
    const logRow = rowsOf(gas).find(r => r[1] === 'log');
    gas.post(JSON.stringify({key: KEY, action: 'push', rows: [{id: logRow[0], kind: 'log', upd: Date.now() + 99999, data: {txt: 'تلاعب'}}]}));
    eq('سطر السجل مبيتعدلش في الشيت', JSON.parse(rowsOf(gas).find(r => r[0] === logRow[0])[11]).txt.includes('تلاعب'), false);
    eq('الشيت بيتقري بالعين: النوع، العامل، التاريخ، المبلغ، مين', rowsOf(gas).find(r => r[1] === 'wk').slice(5, 10), ['عامل', 'عامل تجربة أ', '2026-10-10', 250, 'مشرف تجربة 1']);
    eq('الكود مفيهوش أي لينك أو مفتاح', [code.includes('script.google.com/macros'), code.includes(KEY)], [false, false]);

    console.log('\n٣) النهارده: الكل يوم + يوم ونص');
    const wk = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];
    for (const d of wk) { await A.evaluate(d => nav('t/' + d, true), d); await A.click('#allDay'); }
    eq('الكل يوم: اتسجل 12 يوم', await A.evaluate(() => Object.values(S.recs).filter(r => r.k === 'day').length), 12);
    eq('الزرار بيتقفل لما الكل يتسجل', await A.$eval('#allDay', b => b.disabled), true);
    await A.evaluate(() => nav('t/2026-10-11', true));
    await A.click('#main .wr:nth-child(2) .ub button[data-u="1.5"]');
    eq('يوم ونص لعامل ب يوم الأحد وجنبه اسم اللي سجّل', await A.textContent('#main .wr:nth-child(2) small'), 'يوم ونص · مشرف تجربة 1 9:00 ص');
    /* سلفة من النهارده */
    await A.click('#qAdv'); await A.click('#pkW .chip:nth-child(1)'); await A.fill('#avA', '200'); await A.click('#avOk'); await closed(A);
    await settle_(A);

    console.log('\n٤) شريك على موبايل تاني باللينك');
    const link = await A.evaluate(() => joinLink());
    eq('لينك الربط شكله صح', /payroll\.html#payjoin=[\w-]+$/.test(link), true);
    const B = await device(browser, base, gas, 'payroll.html' + link.slice(link.indexOf('#')), at('2026-10-15T09:30:00'));
    pages.push(B);
    await B.waitForSelector('.gate .chip', {timeout: 15000});
    eq('الشريك شايف اسم المشرف الأول', await B.$$eval('.gate .chip', b => b.map(x => x.textContent)), ['مشرف تجربة 1']);
    await B.click('#lgNew'); await B.fill('#lgN', 'مشرف تجربة 2'); await B.fill('#lgP', '5678'); await B.click('#lgGo');
    await B.waitForSelector('#tabs button');
    eq('الشريك شايف نفس العمال والأيام', await B.evaluate(() => [idx().W.size, idx().day.size, idx().adv.length]), [2, 12, 1]);
    await B.evaluate(() => nav('t/2026-10-12', true));
    await B.click('#main .wr:nth-child(1) .ub button[data-u="0.5"]');
    await settle_(B); await settle_(A);
    eq('التعديل وصل للموبايل الأول باسم الشريك', await A.evaluate(() => { const r = idx().day.get([...idx().W.keys()][0] + '|2026-10-12'); return [r.u, r.by, r.rate]; }), [0.5, 'مشرف تجربة 2', 25000]);
    await A.evaluate(() => nav('l', true));
    const logTxt = await A.textContent('#main');
    eq('السجل: مين غيّر إيه ومن كام لكام', logTxt.includes('مشرف تجربة 2 غيّر الاتنين') && logTxt.includes('من "يوم" لـ "نص"'), true);
    eq('السجل: الكل يوم وسلفة وإضافة عامل', ['علّم الكل "يوم"', 'سجّل سلفة لـ عامل تجربة أ 200', 'ضاف عامل جديد: عامل تجربة ب'].map(t => logTxt.includes(t)), [true, true, true]);
    /* تعديل السلفة من الشريك */
    await B.evaluate(() => nav('w', true)); await B.click('#main tr[data-w]:nth-child(1)'); await B.click('#modal [data-adv]');
    await B.fill('#avA', '300'); await B.click('#avOk'); await B.waitForTimeout(150);
    await settle_(B); await settle_(A); await A.evaluate(() => drawLog());
    eq('السجل: "غيّر سلفة من 200 لـ 300"', (await A.textContent('#main')).includes('مشرف تجربة 2 غيّر سلفة عامل تجربة أ') && (await A.textContent('#main')).includes('من 200 لـ 300'), true);

    console.log('\n٥) الأسبوع والقفل والقبض');
    await addW('عامل تجربة ج', '100', '0', '2026-10-14');
    await A.evaluate(() => nav('w', true));
    await A.click('#fri button[data-v=work]');
    eq('الجمعة: اختيارين جنب بعض و"شغل" اتعلّم', await A.$$eval('#fri button', b => b.map(x => x.textContent + (x.classList.contains('on') ? '*' : ''))), ['شغل*', 'إجازة']);
    await A.click('#lockW');
    eq('القفل مبيشتغلش لو في يوم ناقص', (await A.textContent('#lockErr')).trim(), 'يوم ناقص عند عامل تجربة ج: الأربعيوم ناقص عند عامل تجربة ج: الخميس');
    await A.evaluate(() => nav('t/2026-10-14', true)); await A.click('#allDay');
    await A.evaluate(() => nav('t/2026-10-15', true)); await A.click('#main .wr:nth-child(3) .ub button[data-u="0"]');
    await A.evaluate(() => nav('w', true));
    /* أ: 5.5 يوم × 250 + جمعة 300 − سلفة 300 = 1,375؛ ب: 6.5 × 200 + 200 = 1,500؛ ج: يوم × 100 = 100 */
    const nets = await A.evaluate(() => { const c = calcWeek(idx(), '2026-10-15'); return Object.values(c.rows).map(r => [r.name, r.net]); });
    eq('الصافي لكل عامل', nets, [['عامل تجربة أ', 137500], ['عامل تجربة ب', 150000], ['عامل تجربة ج', 10000]]);
    eq('إجمالي "هيخرج من المصنع"', await A.textContent('.panel .p1 b'), '2,975');
    await A.click('#lockW'); await A.click('#aY'); await A.waitForTimeout(150);
    eq('بعد القفل: زرار قبض لكل عامل', (await A.$$('#main [data-pay]')).length, 3);
    await A.click('#main [data-pay]');
    eq('القبض اتعلّم باسم اللي سلّم', (await A.textContent('#main tr[data-w]:nth-child(1) .paid')).includes('مشرف تجربة 1'), true);
    await settle_(A); await settle_(B); await B.evaluate(() => nav('a', true));
    eq('الأرشيف عند الشريك: الأسبوع مقفول وقبض 1 من 3', [await B.textContent('#main .row .m b'), (await B.textContent('#main .row .a small')).trim()], ['أسبوع الخميس 15‏/‏10', 'قبض 1 من 3']);
    await B.evaluate(() => nav('t/2026-10-15', true));
    eq('النهارده بعد القفل: الأزرار مقفولة', await B.$eval('#main .ub button', b => b.disabled), true);

    console.log('\n٦) دخول على موبايل جديد بالرقم السري');
    const C = await device(browser, base, gas, 'payroll.html' + link.slice(link.indexOf('#')), at('2026-10-15T10:00:00'));
    pages.push(C);
    await C.waitForSelector('.gate .chip', {timeout: 15000});
    eq('الاسمين ظاهرين و"اسم جديد" لسه موجود (فيه مكان لتالت)', [await C.$$eval('.gate .chip', b => b.map(x => x.textContent)), !!(await C.$('#lgNew'))], [['مشرف تجربة 1', 'مشرف تجربة 2'], true]);
    await C.click('.gate .chip[data-s]'); await C.fill('#lgP', '9999'); await C.waitForTimeout(300);
    eq('رقم غلط بيترفض', await C.textContent('#lgErr'), 'الرقم ده غلط');
    await C.fill('#lgP', '1234'); await C.waitForSelector('#tabs button');
    eq('الرقم الصح بيدخل وعلى نفس الموبايل مبيطلبش تاني', await C.evaluate(() => { load(); return myName(); }), 'مشرف تجربة 1');

    console.log('\n٧) القفل التلقائي بعد الجمعة + المرحّل');
    /* الأسبوع الجاي: ب سلفة كبيرة، وأيام ناقصة */
    await A.clock.setFixedTime(at('2026-10-18T12:00:00'));
    await A.evaluate(() => nav('t/2026-10-17', true)); await A.click('#allDay');
    await A.click('#qAdv'); await A.click('#pkW .chip:nth-child(2)'); await A.fill('#avA', '700'); await A.click('#avOk'); await closed(A);
    await settle_(A);
    eq('قبل ما الجمعة تعدي: الأسبوع مفتوح', await A.evaluate(() => idx().lk.has('2026-10-22')), false);
    await A.clock.setFixedTime(at('2026-10-24T08:00:00'));
    await settle_(A); await A.waitForTimeout(200); await settle_(A);
    const auto = await A.evaluate(() => { const l = idx().lk.get('2026-10-22'), c = calcWeek(idx(), '2026-10-22'), b = Object.values(c.rows).find(r => r.name === 'عامل تجربة ب'); return [!!l, l && l.auto, l && l.by, b.wages, b.net, b.carryOut, idx().day.get(b.w + '|2026-10-19').u, idx().day.get(b.w + '|2026-10-19').by]; });
    eq('اتقفل تلقائي، والأيام الناقصة غياب باسم "تلقائي"، وب عليه مرحّل', auto, [true, true, 'تلقائي', 20000, 0, 50000, 0, 'تلقائي']);
    await settle_(B);
    eq('الشريك شاف القفل التلقائي', await B.evaluate(() => idx().lk.get('2026-10-22').auto), true);
    eq('المرحّل بيظهر في الأسبوع اللي بعده', await A.evaluate(() => { const c = calcWeek(idx(), '2026-10-29'), b = Object.values(c.rows).find(r => r.name === 'عامل تجربة ب'); return b.carryIn; }), 50000);
    eq('الشيت: كل حركة مرة واحدة', new Set(rowsOf(gas).map(r => r[0])).size, rowsOf(gas).length);

    console.log('\n٨) من غير نت');
    B.ctx.netDown = true;
    await B.clock.setFixedTime(at('2026-10-24T09:00:00'));
    await B.evaluate(() => nav('t/2026-10-24', true)); await B.click('#allDay');
    await B.evaluate(() => sync()); await B.waitForTimeout(300);
    eq('الحركة اتحفظت على الموبايل ومستنية', await B.evaluate(() => [pending().length > 0, online]), [true, false]);
    B.ctx.netDown = false; await settle_(B); await settle_(A);
    eq('أول ما النت رجع اتبعتت ووصلت', await A.evaluate(() => [...idx().day.values()].filter(d => d.date === '2026-10-24').length), 3);

    console.log('\n٩) التعديل بعد القفل وإعادة الحساب');
    await A.clock.setFixedTime(at('2026-10-24T11:00:00'));
    await A.evaluate(() => nav('w/2026-10-15', true));
    await A.click('#main tr[data-w]:nth-child(1)'); await A.waitForSelector('#modal .days button');
    await A.click('#modal .days button:nth-child(1)'); await A.waitForSelector('#modal .ub button[data-u="0"]');
    await A.click('#modal .ub button[data-u="0"]'); await A.waitForSelector('#modal .days');
    const aw = await A.evaluate(() => { const id = [...idx().W.values()].find(w => w.name === 'عامل تجربة أ').id, r = calcWeek(idx(), '2026-10-15').rows[id], p = idx().pd.get('2026-10-15|' + id); return [r.net, p.amt, idx().lk.get('2026-10-15').snap.rows[id].net, idx().lk.get('2026-10-15').closer]; });
    eq('تغيير يوم في أسبوع مقفول: الصافي اتحسب تاني (−250) واللقطة اتحدّثت واسم اللي قفل فضل', aw, [112500, 137500, 112500, 'مشرف تجربة 1']);
    eq('عامل اتعلّم إنه قبض والرقم اتغير: تحذير', (await A.textContent('#modal')).includes('اتعلّم إنه قبض 1,375 والصافي دلوقتي 1,125'), true);
    await A.click('#wsX');
    eq('الأسبوع في الأرشيف بيتحدّث: الإجمالي بقى 2,725', await A.evaluate(() => calcWeek(idx(), '2026-10-15').total), 297500 - 25000);
    /* سلفة كبيرة بعد القفل عند "ب": بتترحّل، والأسبوع المقفول اللي بعده بيتعدّل معاه */
    const bId = await A.evaluate(() => [...idx().W.values()].find(w => w.name === 'عامل تجربة ب').id);
    const c22 = await A.evaluate(id => { const r = calcWeek(idx(), '2026-10-22').rows[id]; return [r.carryIn, r.carryOut]; }, bId);
    await A.click('#main tr[data-w]:nth-child(2)'); await A.waitForSelector('#wsAdv');
    await A.click('#wsAdv'); await A.fill('#avA', '2000'); await A.click('#avOk');
    await A.waitForSelector('#modal .days');
    eq('قبل التعديل: ب ماكانش عليه مرحّل داخل الأسبوع التاني', c22, [0, 50000]);
    eq('بعد سلفة 2,000 في أسبوع مقفول: الأسبوع ده عليه 500، والأسبوع المقفول اللي بعده بيتعدل (المرحّل 500 دخل)', await A.evaluate(id => { const a = calcWeek(idx(), '2026-10-15').rows[id], b = calcWeek(idx(), '2026-10-22').rows[id]; return [a.net, a.carryOut, b.carryIn, b.carryOut]; }, bId), [0, 50000, 50000, 100000]);
    eq('السجل بيقول إنه بعد القفل', await A.evaluate(() => idx().log.some(l => l.txt.includes('سجّل سلفة لـ عامل تجربة ب 2,000') && l.txt.includes('بعد القفل'))), true);
    await A.click('#wsX');
    /* الجمعة في الأسبوع المقفول التاني: بتفتح كارت فرق الجمعة في الأسبوع الحالي */
    await A.evaluate(() => nav('w/2026-10-22', true));
    await A.click('#fri button[data-v=work]'); await A.waitForSelector('#aY'); await A.click('#aY'); await A.waitForTimeout(150);
    eq('تغيير الجمعة في أسبوع مقفول بيعيد حسابه (جمعة شغل بقت في اللقطة)', await A.evaluate(() => [idx().lk.get('2026-10-22').snap.fri, Object.values(idx().lk.get('2026-10-22').snap.rows).some(r => r.fridayPay > 0)]), ['work', true]);
    await A.evaluate(() => nav('w', true));
    eq('كارت فرق الجمعة ظهر في الأسبوع الحالي', (await A.textContent('#main')).includes('جمعة 23') || (await A.textContent('#main')).includes('اتدفعت مع الخميس اللي فات'), true);
    const aId = await A.evaluate(() => [...idx().W.values()].find(w => w.name === 'عامل تجربة أ').id);
    await A.click(`#main .ub button[data-fd="${aId}"][data-u="0"]`); await A.waitForTimeout(150);
    eq('علّمنا "أ" مجاش: أجر جمعته (300) اتخصم من الأسبوع الحالي (مرتبه يوم واحد بس فاتحول مرحّل 50)', await A.evaluate(id => { const r = calcWeek(idx(), '2026-10-29').rows[id]; return [r.prevFridayDelta, r.net, r.carryOut]; }, aId), [30000, 0, 5000]);
    eq('السجل: مجاش', await A.evaluate(() => idx().log.some(l => l.txt.includes('"مجاش"') && l.txt.includes('هيتخصم 300'))), true);

    console.log('\n١٠) السلف القديمة من شاشة العمال');
    await A.evaluate(id => { ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'].forEach(d => put('day', {id: 'd_' + id + '_' + d, w: id, date: d, u: 1, rate: 25000})); commit(); }, aId);
    await A.evaluate(id => oldModal(id), aId);
    await A.click('#olAdd'); await A.fill('#oeA', '1000'); await A.click('#oeOk'); await A.waitForSelector('#olMode');
    await A.click('#olMode button[data-v=fixed]'); await A.fill('#olA', '100'); await A.click('#olSave'); await A.waitForTimeout(150);
    eq('سلفة قديمة 1,000 وقاعدة 100 كل أسبوع', await A.evaluate(id => [oldLeftNow(id) > 0, idx().rule.get(id).mode, idx().rule.get(id).amt, idx().old.length], aId), [true, 'fixed', 10000, 1]);
    await A.evaluate(() => { closeModal(); nav('w', true); });
    const od1 = await A.evaluate(id => { const r = calcWeek(idx(), '2026-10-29').rows[id]; return [r.oldBefore, r.oldApplied, r.oldLeft]; }, aId);
    eq('الأسبوع الحالي: اتخصم 100 والباقي 900', od1, [100000, 10000, 90000]);
    await A.click(`#main tr[data-w="${aId}"]`); await A.click('#wsOld'); await A.click('#wdSkip'); await A.waitForSelector('#modal .days');
    eq('متخصمش الأسبوع ده: الخصم صفر والباقي زي ما هو', await A.evaluate(id => { const r = calcWeek(idx(), '2026-10-29').rows[id]; return [r.oldApplied, r.oldLeft, r.oldSkip]; }, aId), [0, 100000, true]);
    await A.click('#wsOld'); await A.fill('#wdA', '250'); await A.click('#wdAmt'); await A.waitForSelector('#modal .days');
    eq('رقم تاني للأسبوع ده: 250', await A.evaluate(id => calcWeek(idx(), '2026-10-29').rows[id].oldApplied, aId), 25000);
    await A.click('#wsOld'); await A.click('#wdRule'); await A.waitForSelector('#modal .days');
    eq('زي القاعدة: رجع 100', await A.evaluate(id => calcWeek(idx(), '2026-10-29').rows[id].oldApplied, aId), 10000);
    await A.click('#wsX');
    eq('السجل بيقول مين غيّر طريقة الخصم', await A.evaluate(() => idx().log.some(l => l.txt.includes('غيّر طريقة خصم السلف القديمة') && l.txt.includes('مبلغ ثابت 100'))), true);
    await settle_(A); await settle_(B);
    eq('الشريك شايف السلف القديمة والقاعدة', await B.evaluate(id => [idx().old.length, idx().rule.get(id).mode], aId), [1, 'fixed']);

    console.log('\n١١) الأرشيف: كل 4 أسابيع شهر');
    eq('المجموعات: 5 أسابيع = شهر كامل + شهر لسه', await A.evaluate(() => { const mk = (t, n) => ({thu: t, snap: {total: n}}); const g = archiveGroups(['2026-10-15', '2026-10-22', '2026-10-29', '2026-11-05', '2026-11-12'].map((t, i) => mk(t, (i + 1) * 100))); return g.map(x => [x.n, x.weeks.length, x.total, monthName(x.n)]); }), [[1, 4, 1000, 'الشهر الأول'], [2, 1, 500, 'الشهر التاني']]);
    await A.evaluate(() => nav('a', true));
    eq('شاشة الأرشيف: الشهر الأول (لسه) فيه الأسبوعين المقفولين بإجماليهم', await A.evaluate(() => { const t = $('#main').textContent; return [t.includes('الشهر الأول'), t.includes('(لسه)'), $$('#main .row[data-thu]').length]; }), [true, true, 2]);
    await settle_(A);

    console.log('\n١٢) تسهيلات التسجيل: زي امبارح، الأيام الناقصة، الأسابيع الفاضية، السجل');
    const D = await device(browser, base, makeGas({noDrive: true}), 'payroll.html', at('2026-10-21T09:00:00'));
    pages.push(D);
    await D.click('#lgNew'); await D.fill('#lgN', 'مشرف تجربة 4'); await D.fill('#lgP', '4321'); await D.click('#lgGo'); await D.waitForSelector('#tabs button');
    eq('قبل ربط الشيت: تنبيه أحمر في النهارده', !!(await D.$('#goLink')), true);
    for (const n of ['عامل د1', 'عامل د2', 'عامل د3']) {
      await D.evaluate(() => nav('k')); await D.click('#kNew'); await D.fill('#wkN', n); await D.fill('#wkR', '200'); await D.fill('#wkF', '0'); await D.fill('#wkD', '2026-09-20'); await D.click('#wkOk'); await closed(D);
    }
    await D.evaluate(() => { if (autoClose()) { save(); } });
    eq('عامل بتاريخ قديم: الأسابيع الفاضية اللي فاتت متقفلتش بأصفار', await D.evaluate(() => [idx().lk.size, idx().log.some(l => l.by === 'تلقائي')]), [0, false]);
    await D.evaluate(() => nav('t/2026-10-17', true)); await D.click('#allDay');
    await D.evaluate(() => nav('t/2026-10-18', true)); await D.click('#allDay'); await D.click('#main .wr:nth-child(2) .ub button[data-u="0"]');
    await D.evaluate(() => nav('t/2026-10-19', true));
    eq('زرار "زي امبارح" شغال', await D.$eval('#sameY', b => b.disabled), false);
    await D.click('#sameY');
    eq('زي امبارح: نقل حالة كل عامل من امبارح (التاني غاب)', await D.evaluate(() => [...idx().W.keys()].map(id => idx().day.get(id + '|2026-10-19').u)), [1, 0, 1]);
    await D.evaluate(() => nav('t/2026-10-21', true));
    eq('تنبيه الأيام الناقصة: التلات ناقص 3 عمال', (await D.textContent('#main .alert:not(.red) .chip')).trim(), 'التلات · 3 عمال');
    await D.click('#main .alert .chip[data-go]');
    eq('دوسة على اليوم الناقص بتفتحه', await D.evaluate(() => location.hash), '#t/2026-10-20');
    await D.click('#allDay');
    eq('الرسالة بتظهر تحت ومش بتغطي التاريخ', await D.evaluate(() => $('#toast').getBoundingClientRect().top > $('.dnav').getBoundingClientRect().bottom + 200), true);
    await D.evaluate(() => nav('l', true));
    eq('السجل: الأسامي الكتير بتتلم في "(3 عمال ▾)" والوقت لوحده', await D.evaluate(() => [!!$('#main button[data-x]'), $('#main button[data-x]').textContent, !!$('#main .lg .tm'), $('#main .lg .who').textContent]), [true, '3 عمال ▾', true, 'مشرف تجربة 4']);
    await D.click('#lgF button[data-c]');
    eq('فلتر "التعديلات والمسح بس" بيعرض التغيير بس', await D.evaluate(() => $$('#main .lg').length > 0 && $$('#main .lg').every(x => x.classList.contains('chg') || x.classList.contains('del'))), true);
    await D.evaluate(() => nav('w', true));
    eq('الأسبوع: صف الإجمالي تحت الجدول', await D.evaluate(() => [!!$('#main tfoot'), $('#main tfoot td.net').textContent]), [true, await D.evaluate(() => fmt(calcWeek(idx(), '2026-10-22').total))]);

    eq('مفيش أخطاء في الصفحات', pages.flatMap(p => p.ctx.errs), []);
  } catch (e) { fails++; console.log('  ✖ الاختبار وقف:', e.message.split('\n').slice(0, 6).join(' | ')); if (process.env.DBG) console.log(e.stack); }
  await browser.close(); srv.close();
  console.log(`\n${fails ? '✖' : '✔'} ${oks} نجح، ${fails} فشل\n`);
  process.exit(fails ? 1 : 0);
})();
