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
    eq('الجمعة: اختيارين جنب بعض و"شغل" اتعلّم', await A.$$eval('#fri button', b => b.map(x => x.textContent + (x.classList.contains('on') ? '*' : ''))), ['شغل ✓*', 'إجازة']);
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

    eq('مفيش أخطاء في الصفحات', pages.flatMap(p => p.ctx.errs), []);
  } catch (e) { fails++; console.log('  ✖ الاختبار وقف:', e.message.split('\n').slice(0, 6).join(' | ')); if (process.env.DBG) console.log(e.stack); }
  await browser.close(); srv.close();
  console.log(`\n${fails ? '✖' : '✔'} ${oks} نجح، ${fails} فشل\n`);
  process.exit(fails ? 1 : 0);
})();
