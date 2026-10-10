/*
  اختبارات برنامج الحسابات ودفتر الخزنة (بيانات تجريبية بس، مفيهاش أي اسم عميل حقيقي).
  التشغيل:  node tests/run.js
  بيشغّل الموقع على جهازك، ويفتحه في متصفح من غير شاشة، ويجرب كل حاجة ويقارن الأرقام بالأرقام المتوقعة بالقرش.
  لو أي اختبار فشل بيطبع ✖ وبيخرج بخطأ، فمتترفعش أي تعديل غير لما كله يبقى ✔.
  محتاج Playwright و Chromium (موجودين في بيئة Claude Code). المتصفح ممكن يتحدد بـ PW_CHROMIUM.
*/
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const {makeGas} = require('./gasmock');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
const ACC_URL = 'https://script.google.com/macros/s/TEST-ACC/exec', CASH_URL = 'https://script.google.com/macros/s/TEST-CASH/exec', MKT_URL = 'https://script.google.com/macros/s/TEST-MKT/exec';
const PASS = '246810', KEY = 'Test-Key-2026';

let fails = 0, oks = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { oks++; console.log('  ✔', name); } else { fails++; console.log('  ✖', name, '\n     المتوقع:', JSON.stringify(want), '\n     اللي طلع:', JSON.stringify(got)); }
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = iso(new Date()), inDays = n => iso(new Date(Date.now() + n * 86400000));

/* ملف نقل تجريبي (نفس شكل اللي بيتعمل من الإكسيل). الأرقام بالقرش */
function importFile() {
  return {app: 'flash-on-accounts-import', v: 1, batch: 'TST1', made: Date.UTC(2026, 0, 1),
    parties: [
      {ref: 'c1', sec: 'mkt', name: 'عميل تجربة واحد', expected: 270000},
      {ref: 'c2', sec: 'site', name: 'عميل تجربة اتنين', expected: 0},
      {ref: 's1', sec: 'sup', name: 'مورد تجربة', expected: -2950000}],
    entries: [
      {party: 'c1', kind: 'open', date: '2026-01-01', dr: 100000},
      {party: 'c1', kind: 'inv', date: '2026-01-05', no: '1', lines: [{name: 'لفة تجربة 16 مم', unit: 'لفة', qty: 10, price: 35000}, {name: 'كابل تجربة', unit: 'كيلو', qty: 2.5, price: 8000}]},
      {party: 'c1', kind: 'pay', date: '2026-01-06', amt: 200000, method: 'نقدي'},
      {party: 'c2', kind: 'inv', date: '2026-01-07', no: '2', lines: [{name: 'شكارة تجربة', unit: 'شكارة', qty: 1, price: 500000}]},
      {party: 'c2', kind: 'pay', date: '2026-01-08', amt: 500000, method: 'تحويل'},
      {party: 's1', kind: 'open', date: '2026-01-01', cr: 900000},
      {party: 's1', kind: 'pur', date: '2026-01-02', no: '1', lines: [{name: 'خامة تجربة', unit: 'كيلو', qty: 1000, price: 5050}]},
      {party: 's1', kind: 'ppay', date: '2026-01-03', amt: 3000000, method: 'نقدي'}]};
}

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

async function newDevice(browser, base, sheets) {
  const ctx = await browser.newContext({viewport: {width: 400, height: 860}, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write']});
  ctx.errs = [];
  await ctx.route('https://script.google.com/**', r => {
    if (ctx.netDown) return r.abort('failed');
    const q = r.request(), g = q.url().includes('TEST-CASH') ? sheets.cash : q.url().includes('TEST-MKT') ? sheets.mkt : sheets.acc;
    if (!g.ctx.doPost) return r.fulfill({status: 200, contentType: 'text/html', body: '<html>no script</html>'});
    r.fulfill({status: 200, contentType: 'application/json', body: q.method() === 'POST' ? g.post(q.postData()) : g.get()});
  });
  /* تليجرام من الجهاز نفسه (getMe): نفس الردود بتاعة الشيت التجريبي */
  await ctx.route('https://api.telegram.org/**', r => {
    const tok = (r.request().url().match(/bot([^/]+)\//) || [])[1] || '', v = sheets.mkt.tg.valid;
    r.fulfill({status: 200, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify(v && !v.includes(decodeURIComponent(tok)) ? {ok: false, error_code: 401, description: 'Unauthorized'} : {ok: true, result: {username: 'test_souq_bot'}})});
  });
  ctx.page = async url => { const p = await ctx.newPage(); p.on('pageerror', e => (ctx.errs.push(e.message), process.env.DBG && console.log('PAGEERR', e.message))); p.on('crash', () => process.env.DBG && console.log('CRASH')); p.on('close', () => process.env.DBG && console.log('PAGE CLOSED')); p.on('console', m => { if (process.env.DBG && m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 120)); }); p.on('framenavigated', f => { if (process.env.DBG && f === p.mainFrame()) console.log('NAV', new Date().toISOString().slice(14, 23), f.url().slice(0, 80)); }); await p.goto(base + url); return p; };
  return ctx;
}
async function unlock(A, first) {
  if (first) { await A.fill('#suP', PASS); await A.fill('#suP2', PASS); await A.click('#suGo'); }
  else { await A.fill('#lkP', PASS); await A.waitForSelector('#lock:not(.on)', {state: 'attached', timeout: 15000}); }
  await A.waitForSelector('#lock', {state: 'hidden'});
}
/* الدوال اللي بتكلم الشيت (مزامنة) بنشغلها في الصفحة من غير ما نستنى الـ Promise بتاعها من بره، وبنستنى علامة إنها خلصت.
   استنى الـ Promise الطويل من بره كان أحياناً بيقع بـ "Execution context was destroyed" من غير أي تنقل حقيقي (الصفحة نفسها سليمة). */
const bg = async (X, code) => {
  await X.evaluate(c => { window.__bg = 'run'; Promise.resolve().then(() => (0, eval)(c)).then(v => { window.__bgv = v; window.__bg = 'ok'; }, e => { window.__bgv = String(e && e.message || e); window.__bg = 'err'; }); }, code);
  await X.waitForFunction(() => window.__bg !== 'run', null, {timeout: 90000, polling: 100});
  return X.evaluate(() => window.__bgv);
};
const closed = A => A.waitForSelector('#mask', {state: 'hidden'});
const bal = (A, name) => A.evaluate(n => { const p = liveParties().find(x => x.name === n); return p ? balance(p.id) : null; }, name);
const vbal = (A, vid) => A.evaluate(v => vaultBal(v), vid || '');
const openParty = async (A, name) => { await A.evaluate(n => go('p/' + liveParties().find(x => x.name === n).id), name); await A.waitForTimeout(150); };

(async () => {
  const srv = await serve(), base = `http://localhost:${srv.address().port}/`;
  const browser = await pw.chromium.launch(CHROME ? {executablePath: CHROME} : {});
  const sheets = {acc: makeGas(), cash: makeGas(), mkt: makeGas()};
  let DM = null;
  const D1 = await newDevice(browser, base, sheets);
  const bad = importFile(); bad.parties[0].expected = 1;
  /* خانة ملف النقل اتشالت من الإعدادات، فبنفتح شاشة النقل مباشرة */
  const openImport = (A, d) => A.evaluate(x => importModal(readImport(x)), d);
  try {
    console.log('\n١) كلمة السر والتشفير');
    const A = await D1.page('accounts.html');
    await unlock(A, true);
    await A.click('#bLock'); await A.waitForSelector('#lkP'); await A.fill('#lkP', '999999'); await A.waitForTimeout(2000);
    eq('كلمة سر غلط وقت الكتابة مفيهاش رسالة ولا بتفتح', [await A.textContent('#lkErr'), await A.evaluate(() => $('#lock').classList.contains('on'))], ['', true]);
    await A.click('#lkGo'); await A.waitForTimeout(1500);
    eq('كلمة سر غلط بترفض', await A.textContent('#lkErr'), 'كلمة السر غلط');
    await unlock(A);

    console.log('\n٢) نقل البيانات القديمة');
    await openImport(A, bad); await A.waitForTimeout(300);
    eq('ملف فيه رصيد مش مطابق بيترفض', await A.$('#imGo'), null); await A.click('#imX');
    await openImport(A, importFile()); await A.waitForTimeout(300); await A.click('#imGo'); await A.click('#cOk'); await A.waitForTimeout(400);
    eq('رصيد عميل 1', await bal(A, 'عميل تجربة واحد'), 270000);
    eq('رصيد عميل 2', await bal(A, 'عميل تجربة اتنين'), 0);
    eq('رصيد المورد', await bal(A, 'مورد تجربة'), -2950000);
    await openImport(A, importFile()); await A.waitForTimeout(300); await A.click('#imGo'); await A.click('#cOk'); await A.waitForTimeout(400);
    eq('النقل مرتين مبيكررش', await A.evaluate(() => [db.parties.length, db.entries.length]), [3, 8]);
    const raw = await A.evaluate(async () => JSON.stringify(await idbGet('vault')));
    eq('البيانات على الجهاز متشفرة', raw.includes('عميل تجربة'), false);

    console.log('\n٣) فاتورة ودفعة ومرتجع وخصم');
    await A.click('nav button[data-go=cash]'); await A.click('#cNew'); await A.click('#cOpen2'); await A.fill('#modal [data-v]', '1000'); await A.click('#opOk'); await A.waitForTimeout(200);
    eq('رصيد بداية الخزنة', await vbal(A, 'v_main'), 100000);
    await openParty(A, 'عميل تجربة واحد');
    await A.click('#fbDoc'); await A.fill('.li [data-f=name]', 'لفة تجربة 16 مم'); await A.dispatchEvent('.li [data-f=name]', 'change');
    eq('آخر سعر للعميل بيتكتب لوحده', await A.inputValue('.li [data-f=price]'), '350');
    await A.fill('.li [data-f=qty]', '4'); await A.click('.mmore summary'); await A.fill('#dcDisc', '50'); await A.fill('#dcPaid', '400'); await A.click('#dcOk'); await closed(A);
    eq('بعد فاتورة 1400−50 ودفع 400', await bal(A, 'عميل تجربة واحد'), 270000 + 135000 - 40000);
    eq('الدفعة دخلت الخزنة', await vbal(A, 'v_main'), 140000);
    await A.click('#ppRet'); await A.fill('.li [data-f=name]', 'لفة تجربة 16 مم'); await A.fill('.li [data-f=qty]', '1'); await A.fill('.li [data-f=price]', '350'); await A.click('#dcOk'); await closed(A);
    await A.click('#ppAdj'); await A.fill('#adAmt', '15'); await A.fill('#adNote', 'جبر كسور'); await A.click('#adOk'); await closed(A);
    eq('بعد مرتجع 350 وخصم 15', await bal(A, 'عميل تجربة واحد'), 365000 - 35000 - 1500);
    await A.click('#fbPay'); await A.fill('#pyAmt', '100'); await A.click('#pyOk'); await closed(A);
    await A.click('#fbPay'); await A.fill('#pyAmt', '100'); await A.click('#pyOk'); await A.waitForTimeout(150);
    eq('تنبيه الدفعة المكررة', (await A.textContent('#pyWarn')).includes('بنفس المبلغ'), true); await A.click('#pyX');

    console.log('\n٤) الشيكات مقفولة واختيارات كشف الحساب');
    eq('مفيش زرار شيكات ولا طريقة دفع شيك', [!!(await A.$('nav button[data-go=chk]')), (await A.click('#fbPay'), !!(await A.$('#pyM button[data-v=شيك]')))], [false, false]); await A.click('#pyX');
    await A.click('#ppStmt'); await A.waitForTimeout(150);
    eq('الكشف بيفتح على آخر فاتورة والرصيد قبلها', [await A.getAttribute('#smMode .on', 'data-m'), (await A.textContent('#smOut')).includes('الرصيد قبل الفاتورة')], ['last', true]);
    eq('آخر فاتورة: الرصيد قبل وبعد', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'), l = partyEntries(p.id).filter(e => e.kind === 'inv').pop(), s = stmtData(p.id, '', '', l.id); return [s.open, s.close, s.rows[0].kind || s.lastInv.kind]; }), [270000, 318500, 'inv']);
    await A.click('#smMode button[data-m=prev]'); await A.waitForTimeout(100);
    eq('آخر شهر = من شهر فات لحد النهارده (مفيش حاجة بتتساب)', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'), d = new Date(); d.setMonth(d.getMonth() - 1);
      const n = partyEntries(p.id).filter(e => e.date >= isoOf(d.getTime()) && e.date <= todayISO() && e.kind !== 'open').length; return [+$('#smOut .stm div:nth-child(2) b').textContent, n]; }).then(([a, n]) => a === n && n > 0), true);
    eq('التاريخ يوم الأول على اليمين', await A.evaluate(() => dispDate('2026-02-05').replace(/\u200F/g, '|')), '05|/|02|/|2026');
    await A.click('#smX');
    eq('رابط الربط الملصوق بيتقري', await A.evaluate(() => { const o = parseJoin(' https://x/accounts.html#join=' + b64u(JSON.stringify({u: 'U', k: 'K'})) + ' '); return [o.u, o.k, parseJoin('كلام غلط')]; }), ['U', 'K', null]);

    await A.setViewportSize({width: 1300, height: 800}); await A.waitForTimeout(200);
    eq('اللاب توب: الحساب مفتوح جنب القايمة', await A.evaluate(() => [$('main').classList.contains('split'), getComputedStyle($('#p-home')).display, !!$('#hList .pt.cur'), getComputedStyle($('nav')).width]), [true, 'flex', true, '136px']);
    await A.setViewportSize({width: 400, height: 860}); await A.waitForTimeout(200);
    eq('الموبايل: صفحة واحدة', await A.evaluate(() => [$('main').classList.contains('split'), getComputedStyle($('#p-home')).display]), [false, 'none']);

    console.log('\n٥) الخزنة');
    await A.click('nav button[data-go=cash]'); await A.click('#cExp'); await A.fill('#txA', '30'); await A.click('#txOk'); await closed(A);
    await A.click('#cPayS'); await A.click('#pkList .pt'); await A.fill('#pyAmt', '500'); await A.click('#pyOk'); await closed(A);
    eq('مصروف 30 ودفعة مورد 500', await vbal(A, 'v_main'), 150000 - 3000 - 50000);
    eq('رصيد المورد نزل', await bal(A, 'مورد تجربة'), -2950000 + 50000);
    await A.click('#cOpen2'); await A.fill('#modal [data-v]', '960'); await A.click('#opOk'); await A.waitForTimeout(200);
    eq('الجرد سجّل الفرق تسوية', await vbal(A, 'v_main'), 96000);

    console.log('\n٦) دفتر الخزنة متصل بالحسابات');
    const C = await D1.page('cash.html'); await C.waitForTimeout(400);
    eq('الدفتر شايف نفس الرصيد', await C.evaluate(() => Math.round(balance(null) * 100)), 96000);
    await C.click('#bInc'); await C.fill('#tAmt', '70'); await C.selectOption('#tP', {label: 'عميل تجربة اتنين'}); await C.click('#tSave'); await C.waitForTimeout(800);
    eq('دفعة من الدفتر نزلت على العميل', await bal(A, 'عميل تجربة اتنين'), -7000);
    eq('ودخلت خزنة الحسابات', await vbal(A, 'v_main'), 103000);

    console.log('\n٧) كشف الحساب PDF');
    await openParty(A, 'عميل تجربة واحد'); await A.click('#ppStmt');
    await A.evaluate(() => { window.__sh = null; navigator.canShare = () => true; navigator.share = d => { window.__sh = d; return Promise.resolve(); }; });
    await A.click('#smShare'); await A.waitForFunction(() => window.__sh, null, {timeout: 90000});
    eq('الواتساب: الملف بس باسم الشخص ومن غير رسالة مكتوبة', await A.evaluate(() => [Object.keys(__sh), __sh.files[0].name, __sh.files[0].type]), [['files'], 'عميل تجربة واحد.pdf', 'application/pdf']);
    await A.evaluate(() => { navigator.canShare = () => false; });
    await A.waitForTimeout(300); if (!(await A.$('#smShare'))) await A.click('#ppStmt');
    await A.evaluate(() => { window.__dn = ''; const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dn = this.download; return o.call(this); }; });
    const [dl] = await Promise.all([A.waitForEvent('download', {timeout: 90000}), A.click('#smShare')]);
    eq('لو الجهاز مبيدعمش المشاركة الملف بينزل باسم الشخص', await A.evaluate(() => __dn), 'عميل تجربة واحد.pdf');
    const pdf = fs.readFileSync(await dl.path());
    eq('الـ PDF اتعمل', pdf.slice(0, 4).toString(), '%PDF');

    console.log('\n٨) التقارير');
    await A.click('nav button[data-go=rep]'); await A.waitForTimeout(200);
    const R = await A.evaluate(() => { repKind = 'debt'; repSide = 'mkt'; return buildReport(); });
    eq('رصيد السوق في التقرير = رصيد العميل', R.fin[1], await A.evaluate(n => fmtP(balance(liveParties().find(x => x.name === n).id)), 'عميل تجربة واحد'));
    eq('المسحوبات − المدفوعات = الرصيد', await A.evaluate(() => { const s = stmtData(liveParties().find(x => x.name === 'عميل تجربة واحد').id, '', ''); return s.tg - s.tp === s.close; }), true);
    eq('ملخص فوق كشف المورد بس', await A.evaluate(() => { const ps = liveParties(); const sup = ps.find(p => p.sec === 'sup'), cu = ps.find(p => p.sec === 'mkt');
      const a = buildStmtPages(sup, stmtData(sup.id, '', ''))[0].querySelector('.sbox'), b = buildStmtPages(cu, stmtData(cu.id, '', ''))[0].querySelector('.sbox'); $('#render').innerHTML = ''; return [!!a, !!b]; }), [true, false]);

    console.log('\n٩) قفل الفترة');
    await A.click('nav button[data-go=set]'); await A.evaluate(() => setOpenAll()); await A.fill('#sLockD', today); await A.click('#sLockGo'); await A.click('#cOk'); await A.waitForTimeout(200);
    await openParty(A, 'عميل تجربة واحد'); await A.click('#fbPay'); await A.fill('#pyAmt', '1'); await A.click('#pyOk'); await A.waitForTimeout(150);
    eq('مينفعش تسجل في فترة مقفولة', (await A.textContent('#toast')).includes('مقفولة'), true); await A.click('#pyX');
    await A.click('nav button[data-go=set]'); await A.evaluate(() => setOpenAll()); await A.click('#sUnlock'); await A.fill('#apP', PASS); await A.click('#apOk'); await A.waitForTimeout(600);

    console.log('\n١٠) المزامنة مع الشيت وجهاز تاني');
    await A.click('nav button[data-go=set]'); await A.evaluate(() => setOpenAll()); await A.fill('#shUrl', ACC_URL); await A.click('#sSheet details summary'); await A.fill('#shKey', KEY); await A.click('#shSave'); await A.waitForTimeout(300);
    await A.click('#shHelp'); await A.click('#hpCopy'); const accCode = await A.evaluate(() => navigator.clipboard.readText()); sheets.acc.load(accCode); await A.click('#hpX');
    eq('كود الشيت مفيهوش المفتاح', accCode.includes(KEY), false);
    eq('رقم تعريف النشر بيتحول للينك', await A.evaluate(() => normSheetUrl(' AKfycbxTEST1234567890abcdefghij ')), 'https://script.google.com/macros/s/AKfycbxTEST1234567890abcdefghij/exec');
    await A.click('#shSave'); await A.waitForTimeout(4000);
    eq('الشيت مقفول من غير المفتاح', JSON.parse(sheets.acc.get()).ok, false);
    eq('الشيت اتقفل على أول مفتاح', JSON.parse(sheets.acc.post(JSON.stringify({key: 'Other-Key-123', action: 'ping'}))).error, 'key');
    eq('الشيت بيرفض مفتاح غلط', JSON.parse(sheets.acc.post(JSON.stringify({key: 'x', action: 'pull'}))).error, 'key');
    const D2 = await newDevice(browser, base, sheets), B = await D2.page('accounts.html');
    await unlock(B, true);
    await B.click('nav button[data-go=set]'); await B.evaluate(() => setOpenAll()); await B.fill('#shUrl', ACC_URL); await B.click('#sSheet details summary'); await B.fill('#shKey', KEY); await B.click('#shSave'); await B.waitForTimeout(4000);
    const snap = X => X.evaluate(() => [liveParties().map(p => balance(p.id)).sort(), vaultBal(''), selfCheck().length]);
    eq('الجهاز التاني نزل نفس الأرصدة', await snap(B), await snap(A));
    await bg(B, 'syncNow()'); await bg(A, 'syncNow()'); await A.waitForTimeout(1500);
    const rows = sheets.acc.sheets['السجلات'].rows.slice(1).map(r => r[0]);
    eq('مفيش سجلات متكررة في الشيت', new Set(rows).size, rows.length);
    const link = await A.evaluate(() => joinLink());
    eq('رابط الربط مفيهوش المفتاح مكشوف', link.includes('Test-Key'), false);
    const D3 = await newDevice(browser, base, sheets), J = await D3.page('accounts.html' + link.slice(link.indexOf('#')));
    await unlock(J, true); await J.waitForTimeout(5000);
    eq('جهاز جديد برابط الربط بس نزلت عليه كل الحسابات', await snap(J), await snap(A));
    eq('الجهاز الجديد فضل مربوط', await J.evaluate(() => db.cfg.sheetOk), true);
    eq('الرابط اتشال من شريط العنوان', J.url().includes('join'), false);
    await A.click('nav button[data-go=set]'); await A.evaluate(() => setOpenAll()); await A.click('#shAudit'); await A.waitForTimeout(3000);
    eq('مراجعة الجهاز مع الشيت متطابقة', (await A.textContent('#modal .sync')).includes('متطابقين ('), true); await A.click('#saX');

    console.log('\n١٠ج) كود الشيت الأساسي والنسخة الاحتياطية المنفصلة، والمزامنة بدفعات');
    /* الكود الأساسي لوحده من غير أي خدمة درايف: لازم يشتغل ومفيهوش DriveApp ولا ScriptApp */
    const mainCode = await A.evaluate(() => scriptFor()), bkCode = await A.evaluate(() => backupScript());
    const G = makeGas({noDrive: true}); G.load(mainCode);
    const gp = o => JSON.parse(G.post(JSON.stringify(Object.assign({key: 'Some-Key-1234'}, o))));
    eq('الكود الأساسي مفيهوش درايف ولا مؤقّت، وبيشتغل من غيرهم', [/DriveApp|ScriptApp|dailyBackup/.test(mainCode), gp({action: 'ping'}).ok, gp({action: 'push', rows: [{id: 'x1', kind: 'tx', upd: 5, view: [], data: {a: 1}}]}).ack], [false, true, ['x1']]);
    const G2 = makeGas(); G2.load(mainCode);
    let clash = ''; try { G2.load(bkCode); } catch (e) { clash = String(e); }
    eq('ملف النسخة الاحتياطية مبيتعارضش مع الأساسي (مفيش SHEET مكرر)', [clash, /\bSHEET\b|\bHEAD\b|\bW\b|sh_|key_|out_/.test(bkCode)], ['', false]);
    G2.ctx.bkpSetup(); G2.ctx.bkpSetup(); for (let i = 0; i < 32; i++) G2.ctx.bkpRun();
    eq('النسخة الاحتياطية: مؤقّت واحد وفولدر واحد وآخر 30 بس', [G2.triggers, G2.folders.length, G2.folders[0].files.filter(f => !f.trashed).length], [['bkpRun'], 1, 30]);
    eq('الكود الأساسي لسه شغال بعد إضافة النسخة الاحتياطية', JSON.parse(G2.post(JSON.stringify({key: 'Some-Key-1234', action: 'ping'}))).ok, true);

    const posts = [], origPost = sheets.acc.post.bind(sheets.acc);
    sheets.acc.post = body => { const q = JSON.parse(body); if (q.action === 'push') posts.push(q.rows.length); return origPost(body); };
    const addBulk = (X, n, tag) => X.evaluate(([n, tag]) => { for (let i = 0; i < n; i++) { const now = Date.now() + i; const r = {id: 't_' + tag + i, type: 'exp', amt: 100, vault: 'v_main', to: '', cat: 'c_exp0', note: tag, date: todayISO(), at: now, upd: now, del: true, hist: []}; db.txs.push(r); IDX.tx.set(r.id, r); } saveDB(); }, [n, tag]);
    await addBulk(A, 130, 'bulk'); await bg(A, 'syncNow()'); await A.waitForTimeout(500);
    eq('المزامنة بتبعت دفعات 50 كحد أقصى (130 حركة)', [Math.max(...posts) <= 50, posts.reduce((a, b) => a + b, 0) >= 130, await A.evaluate(() => pendingRecs().length)], [true, true, 0]);
    sheets.acc.post = body => { const q = JSON.parse(body); return q.action === 'push' ? JSON.stringify({ok: false, error: 'boom'}) : origPost(body); };
    await addBulk(A, 3, 'fail'); await bg(A, 'syncNow()'); await A.waitForTimeout(300);
    eq('ok:false: بيعرض الخطأ اللي راجع والحركات تفضل مستنية ومفيش "تمام"', await A.evaluate(() => [syncErr, pendingRecs().length >= 3, $('#syncBox').textContent.includes('✔ كل حاجة')]), ['boom', true, false]);
    let lockTry = 0;
    sheets.acc.post = body => { const q = JSON.parse(body); if (q.action === 'push' && lockTry++ < 1) return JSON.stringify({ok: false, error: 'Exception: Lock timeout: another process was holding the lock for too long.'}); return origPost(body); };
    await bg(A, 'syncNow()'); await A.waitForTimeout(3500);
    eq('القفل بيستنى ويعيد بدل ما يرفض: اتبعت بعد المحاولة التانية', [lockTry >= 2, await A.evaluate(() => pendingRecs().length)], [true, 0]);
    sheets.acc.post = body => { const q = JSON.parse(body); if (q.action === 'push') return JSON.stringify({ok: true, ack: q.rows.map(r => r.id), seq: 1}); return origPost(body); };   // بيقول تمام وهو مكتبش حاجة
    await addBulk(A, 2, 'ghost'); await bg(A, 'syncNow()'); await A.waitForTimeout(500);
    eq('شيت بيرد ok وهو فاضي: التطبيق يكتشف الفرق ومبيقولش تمام', await A.evaluate(() => [/الشيت فيه/.test(syncErr), pendingRecs().length > 0, $('#syncBox').textContent.includes('✔ كل حاجة')]), [true, true, false]);
    sheets.acc.post = origPost;
    await bg(A, 'syncNow()'); await A.waitForTimeout(1500);
    eq('بعد ما الشيت يرجع سليم كل حاجة تتبعت وتبقى تمام', await A.evaluate(() => [syncErr, pendingRecs().length]), ['', 0]);

    console.log('\n١١) شيت دفتر الخزنة مقفول بالمفتاح');
    const C2 = await D1.page('cash.html'); await C2.click('nav button[data-go=set]');
    await C2.fill('#shUrl', CASH_URL); await C2.click('#shSave'); await C2.waitForTimeout(300);
    await C2.click('#shHelp'); await C2.click('#hpCopy'); const cashCode = await C2.evaluate(() => navigator.clipboard.readText()); sheets.cash.load(cashCode); await C2.click('#hpX');
    await C2.click('#shSave'); await C2.waitForTimeout(1500);
    const cKey = await C2.evaluate(() => db.sheetKey);
    eq('مفتاح الدفتر اتعمل لوحده ومش في الكود، والشيت اتقفل عليه', [cKey.length >= 8, cashCode.includes(cKey), await C2.evaluate(() => db.sheetLocked), JSON.parse(sheets.cash.post(JSON.stringify({key: 'Other-Key-123', action: 'ping'}))).error], [true, false, true, 'key']);
    eq('شيت الدفتر مقفول', JSON.parse(sheets.cash.get()).ok, false);

    console.log('\n١٠ب) رابط الربط مع نت بيقطع أو صفحة بتتعمل لها ريفرش');
    const D4 = await newDevice(browser, base, sheets); D4.netDown = true;
    const J2 = await D4.page('accounts.html' + link.slice(link.indexOf('#')));
    await J2.fill('#suP', PASS); await J2.fill('#suP2', PASS);
    await J2.reload(); await J2.waitForSelector('#suP');   // ريفرش قبل كلمة السر: الرابط لازم ميضيعش
    await J2.fill('#suP', PASS); await J2.fill('#suP2', PASS); await J2.click('#suGo'); await J2.waitForTimeout(9000);
    eq('النت واقع وقت الربط: الربط محفوظ ومستني وبيقول السبب', await J2.evaluate(() => [db.cfg.joinWait, db.cfg.sheetOk, !!db.cfg.sheetUrl, joinErr.length > 5]), [true, false, true, true]);
    D4.netDown = false;
    await bg(J2, 'finishJoin(false)'); await J2.waitForTimeout(3000);
    eq('النت رجع: كمّل الربط لوحده ونزّل نفس الأرصدة', [await J2.evaluate(() => [db.cfg.sheetOk, !!db.cfg.joinWait]), await snap(J2)], [[true, false], await snap(A)]);
    eq('رابط مقطوع بيطلع رسالة', await (async () => { const X = await D4.page('accounts.html#join=AAAA'); await X.waitForTimeout(1200); return (await X.textContent('#toast')).includes('ناقص'); })(), true);

    console.log('\n١١ب) الخزنة واحدة حتى لو الحسابات في تخزين لوحدها (أيقونة الأيفون)');
    eq('الحسابات بتتزامن مع شيت الدفتر وبتحفظ لينكه كإعداد مشترك', [await bg(A, 'cashSync(true)'), await A.evaluate(() => !!getSet('cashSheet', null))], [true, true]);
    await bg(A, 'syncNow()'); await A.waitForTimeout(1200);
    await bg(B, 'syncNow()'); await B.waitForTimeout(3500);
    eq('جهاز الحسابات التاني خد ربط الدفتر لوحده ونفس رصيد الخزنة', [await B.evaluate(() => !!cashCreds()), await B.evaluate(() => vaultBal(''))], [true, await A.evaluate(() => vaultBal(''))]);
    const cjoin = await B.evaluate(() => { const c = cashCreds(); return 'cash.html#cashjoin=' + b64u(JSON.stringify({u: c.u, k: c.k})); });
    const Saf = await D3.page(cjoin); await Saf.waitForTimeout(1500);
    eq('الدفتر على جهاز جديد اتربط برابط الربط بس', await Saf.evaluate(() => [db.sheetLocked, location.hash]), [true, '']);
    await Saf.evaluate(() => { const c = db.cats.find(x => x.type === 'exp' && !x.del); db.tx.push({id: 't_from_ledger', type: 'exp', amt: 77, ts: Date.now(), vault: 'v_main', cat: c.id, note: 'من الدفتر', upd: Date.now(), del: false, sy: 0}); saveDB(); return syncNow(true); });
    await Saf.waitForTimeout(800);
    eq('لينك شيت الحسابات أو مفتاح غلط بيطلع رسالة واضحة', [await B.evaluate(u => connectCash(u, 'Wrong-Key-1234'), CASH_URL), await B.evaluate(([u, k]) => connectCash(u, k), [ACC_URL, KEY])],
      ['المفتاح السري مش بتاع شيت الدفتر ده. استخدم زرار "انسخ رابط الربط" من الدفتر.', 'ده لينك شيت الحسابات، مش شيت دفتر الخزنة.']);
    await Saf.click('nav button[data-go=set]'); await Saf.click('#shAcc'); const cjl = await Saf.evaluate(() => navigator.clipboard.readText());
    eq('رابط الربط من الدفتر بيتقري في الحسابات', await B.evaluate(t => { const o = parseCashJoin(t); return !!(o && o.u && o.k); }, cjl), true);
    const vB0 = await B.evaluate(() => vaultBal(''));
    await bg(B, 'cashSync(true)'); await B.waitForTimeout(300);
    eq('مصروف من الدفتر (Safari) ظهر في الحسابات (الأيقونة)', [await B.evaluate(() => !!IDX.tx.get('t_from_ledger')), await B.evaluate(() => vaultBal(''))], [true, vB0 - 7700]);
    await B.evaluate(() => { const now = Date.now(); const r = {id: 't_from_app', type: 'exp', amt: 3300, vault: 'v_main', to: '', cat: 'c_exp0', note: 'من الحسابات', date: todayISO(), at: now, upd: now, del: false, hist: []}; db.txs.push(r); IDX.tx.set(r.id, r); saveDB(); });
    await bg(B, 'cashSync(true)'); await B.waitForTimeout(300);
    await bg(Saf, 'autoPull()'); await Saf.waitForTimeout(500);
    eq('مصروف من الحسابات ظهر في الدفتر', await Saf.evaluate(() => !!db.tx.find(t => t.id === 't_from_app' && !t.del)), true);

    console.log('\n١٢) الشركاء: مرتب كل خميس ومسحوبات');
    await bg(A, 'cashSync(true)');   // ياخد اللي اتسجل في الدفتر من الجهاز التاني الأول
    const vb0 = await A.evaluate(() => vaultBal(''));
    await A.click('nav button[data-go=part]'); await A.click('#psGo'); await A.fill('#psA', '10');
    await A.fill('#psS', await A.evaluate(() => addDays(lastThu(), -14))); await A.click('#psOk'); await A.waitForTimeout(200);
    const autoN = X => X.evaluate(() => db.txs.filter(t => t.id.startsWith('t_ps_') && !t.del).length);
    eq('اتسجل مرتب 3 خميسات لـ 3 شركاء بتواريخ الخميس', [await autoN(A), await A.evaluate(() => db.txs.filter(t => t.auto).every(t => dowOf(t.date) === 4)), await A.evaluate(() => vaultBal(''))], [9, true, vb0 - 9000]);
    eq('التشغيل تاني مبيكررش', await A.evaluate(() => autoPartners(true)), 0);
    await bg(A, 'syncNow()'); await bg(B, 'syncNow()'); await B.waitForTimeout(1500);
    eq('الجهاز التاني مسجلش تاني', [await B.evaluate(() => autoPartners(true)), await autoN(B)], [0, 9]);
    await A.click('#p-part tr[data-i]'); await A.click('#ptDel'); await A.click('#cOk'); await A.waitForTimeout(150);
    eq('المرتب الملغي مبيرجعش يتسجل', [await A.evaluate(() => autoPartners(true)), await autoN(A)], [0, 8]);
    await A.click('#ptNew'); await A.fill('#ptA', '50'); await A.fill('#ptN', 'سلفة'); await A.click('#ptOk'); await closed(A);
    eq('المسحوبات اتسجلت للشريك ونزلت الخزنة', await A.evaluate(() => [db.txs.filter(t => t.cat === 'c_pdraw' && !t.del).map(t => [partName(t.pt), t.amt, t.note]), vaultBal('')]), [[['مصطفى', 5000, 'مسحوبات مصطفى — سلفة']], vb0 - 8000 - 5000]);
    eq('حركات الشركاء ظاهرة في دفتر الخزنة', await A.evaluate(() => (bridgeOut(), readCash().tx.filter(t => t.pt && !t.del).length)), 9);
    eq('بنود الشركاء مش في قايمة المصروفات العادية', await A.evaluate(() => catsL('exp').some(c => c.id === 'c_psal' || c.id === 'c_pdraw')), false);

    console.log('\n١٣) الأرباح ولوحة النهارده والبحث');
    const PR = await A.evaluate(() => { const y = todayISO().slice(0, 4) + '-01-01', x = profitOf(y, todayISO()), ex = db.txs.filter(t => !t.del && t.type === 'exp' && !t.pt && !NOT_PL.has(t.cat) && t.date >= y).reduce((s, t) => s + t.amt, 0); return [x.sales, x.purch, x.part, x.exp === ex, x.before === x.sales - x.purch - x.exp + x.inc, x.after === x.before - x.part]; });
    eq('الأرباح: المبيعات والمشتريات والشركاء لوحدهم والربح قبل وبعد', PR, [968500, 5050000, 13000, true, true, true]);
    await A.click('nav button[data-go=rep]'); await A.click('#rpK button[data-v=profit]'); await A.waitForTimeout(200);
    eq('تقرير الأرباح هو أول تقرير', [await A.getAttribute('#rpK .on', 'data-v'), (await A.textContent('#p-rep .ldgf')).includes('بعد الشركاء')], ['profit', true]);
    await A.click('nav button[data-go=home]'); await A.waitForTimeout(200);
    eq('لوحة النهارده اتشالت من الرئيسية', await A.$('#hDash'), null);
    const SR = await A.evaluate(() => [searchAll('لفة تجربة').length, searchAll('1350').map(r => r.title)[0] || '', searchAll('سلفة').length, searchAll('x').length]);
    eq('البحث بالصنف وبالمبلغ', SR, [3, 'فاتورة بيع — عميل تجربة واحد', 1, 0]);
    await A.click('#bSearch'); await A.fill('#saQ', 'سلفة'); await A.waitForTimeout(400);
    eq('البحث في الحركات', (await A.textContent('#saR')).includes('مسحوبات الشركاء'), true); await A.click('#saX2');

    eq('مفيش أرقام فواتير: لا خانة ولا عرض في الكشف ولا العنوان', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'); docModal(p, 'inv'); const f = !!$('#dcNo'); closeModal();
      const e = partyEntries(p.id).find(x => x.kind === 'inv'); return [f, /رقم/.test(docTitle(e)), /رقم/.test(docDesc(e)), stmtData(p.id, '', '').rows.some(r => isDoc(r.e) && r.ref)]; }), [false, false, false, false]);
    const PGN = await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'); const pg = buildStmtPages(p, stmtData(p.id, '', '')); const c = pg[0].querySelectorAll('thead th').length; const fs = parseFloat(getComputedStyle(pg[0].querySelector('tbody td.l')).fontSize); $('#render').innerHTML = ''; return [c, fs >= 16]; });
    eq('كشف الـ PDF: 7 أعمدة وخط كبير', PGN, [7, true]);
    eq('كشف العميل مفيهوش "عميل سوق/مواقع"، والمورد فيه "مورد"', await A.evaluate(() => { const ps = liveParties(), c = ps.find(x => x.sec === 'mkt'), m = ps.find(x => x.sec === 'sup');
      const t = (p) => { const pg = buildStmtPages(p, stmtData(p.id, '', '')); const r = pg[0].querySelector('.cust i'); const v = r ? r.textContent : ''; $('#render').innerHTML = ''; return v; };
      return [t(c), t(m)]; }), ['', 'مورد']);
    console.log('\n١٤) التاريخ ورصيد أول المدة');
    const OP = await A.evaluate(() => {
      const now = Date.now(), p = {id: newId('p_'), sec: 'mkt', name: 'عميل ترتيب تجربة', phone: '', note: '', noTot: false, at: now, upd: now, del: false};
      db.parties.push(p); P.set(p.id, p);
      addEntry({party: p.id, kind: 'man', date: '2026-01-10', desc: 'بند قبل الرصيد', dr: 5000, cr: 0});
      addEntry({party: p.id, kind: 'open', date: '2026-03-01', desc: 'رصيد أول المدة', dr: 20000, cr: 0});
      const s = stmtData(p.id, '2026-02-01', '2026-12-31');
      return [partyEntries(p.id)[0].kind, stmtData(p.id, '', '').rows[0].run, s.open, s.n];
    });
    eq('رصيد أول المدة أول سطر حتى لو في بند بتاريخ قبله', OP, ['open', 20000, 25000, 0]);
    await A.click('nav button[data-go=cash]'); await A.click('#cExp'); await A.waitForTimeout(150);
    const DP = await A.evaluate(() => { const b = $('#txD').nextElementSibling; return [b.className, [...b.querySelectorAll('span')].slice(0, 5).map(x => x.textContent).join('') === dispDate(todayISO()).split('/').join('/') .replace(/\//g, '') || true, getComputedStyle(b).direction, b.firstElementChild.textContent === todayISO().slice(8)]; });
    eq('خانة التاريخ: اليوم أول واحد على اليمين', [DP[0], DP[2], DP[3]], ['dp', 'rtl', true]);
    await A.click('#txD + .dp'); await A.waitForSelector('.dpo');
    await A.click('.dpo [data-d="5"]');
    const T = await A.evaluate(() => todayISO().slice(0, 8) + '05');
    eq('أول ما تدوس على اليوم بيتسجل وبيتقفل الكليندر', [await A.inputValue('#txD'), await A.$('.dpo')], [T, null]);
    await A.click('#txX');


    console.log('\n١٦) حركة السوق: تطبيق الشريك ووارد السوق');
    const C1 = 'عميل تجربة واحد', bal0 = await bal(A, C1), pid1 = await A.evaluate(n => liveParties().find(x => x.name === n).id, C1);
    await A.click('nav button[data-go=home]'); await A.waitForTimeout(200);
    eq('قبل الربط: سطر "حركة السوق لسه متربطتش" في الرئيسية بيفتح الإعدادات على كارتها', [(await A.textContent('#mkRem')).includes('لسه متربطتش'), (await A.click('#mkGo'), await A.waitForTimeout(400), await A.evaluate(() => [location.hash, !!$('#sMkt #smHelp')]))], [true, ['#set', true]]);
    await A.click('nav button[data-go=set]'); await A.evaluate(() => setOpenAll());
    await A.click('#smHelp'); await A.click('#mhCopy'); const mkCode = await A.evaluate(() => navigator.clipboard.readText()); sheets.mkt.load(mkCode); await A.click('#mhX');
    await A.fill('#smUrl', MKT_URL); await A.click('#smGo'); await A.waitForTimeout(2500);
    const mkc = await A.evaluate(() => getSet('mktSheet', null));
    eq('شيت السوق اتربط ومقفول على مفتاح اتعمل لوحده ومش في الكود', [!!(mkc && mkc.k), mkCode.includes(mkc.k) || /TEST-|script\.google\.com\/macros/.test(mkCode), JSON.parse(sheets.mkt.post(JSON.stringify({key: 'Other-Key-123', action: 'ping'}))).error, JSON.parse(sheets.mkt.get()).ok], [true, false, 'key', false]);
    eq('كود شيت الحسابات الأساسي متلمسش (مفيش تليجرام ولا إذن زيادة)', await A.evaluate(() => /UrlFetchApp|telegram|DriveApp|ScriptApp/.test(scriptFor())), false);
    eq('خزنة السوق اتعملت مرة واحدة', await A.evaluate(() => db.vaults.filter(v => v.name === 'خزنة السوق' && !v.del).map(v => v.id)), ['v_mkt']);
    const mkRows = kind => sheets.mkt.sheets['الحركات'].rows.slice(1).filter(r => r[1] === kind);
    eq('الشيت فيه عملاء السوق بس بأرصدتهم (من غير مواقع ولا موردين)', mkRows('cust').map(r => JSON.parse(r[10]).name).sort(), ['عميل ترتيب تجربة', C1].sort());

    await A.fill('#tgTok', 'كلام مش توكن'); await A.click('#tgSave'); await A.waitForTimeout(300);
    eq('تليجرام: لو اللي اتلصق مش شكل توكن بيقول كده ومبيتحفظش', [sheets.mkt.props.TG_TOKEN || '', (await A.textContent('#tgSt')).includes('مش شكل توكن')], ['', true]);
    const TOK = '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';   // آخره 35 حرف زي تليجرام
    sheets.mkt.tg.valid = [TOK];
    await A.fill('#tgTok', '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghX'); await A.click('#tgSave'); await A.waitForTimeout(600);
    eq('تليجرام: توكن غلط فعلاً تليجرام بيرفضه ومبيتحفظش، والرسالة بتقول يجيبه منين', [sheets.mkt.props.TG_TOKEN || '', (await A.textContent('#tgSt')).includes('/mybots')], ['', true]);
    /* رسالة BotFather كلها اتلصقت في الخانة من غير سطور: "Keep" بتلزق في آخر التوكن */
    await A.evaluate(t => { $('#tgTok').value = '\u200F' + 'Use this token to access the HTTP API:' + t.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace(/[A-Za-z:]/g, x => x) + 'Keep your token secure and store it safely'; }, TOK.split(':')[0] + ':' + TOK.split(':')[1]);
    await A.click('#tgSave'); await A.waitForTimeout(800);
    sheets.mkt.tg.updates = [{update_id: 1, message: {chat: {id: 777}, text: 'ابدأ'}}];
    await A.click('#tgTest'); await A.waitForTimeout(800);
    eq('تليجرام: التوكن في الشيت بس، والـ chat id اتجاب لوحده من "ابدأ"', [sheets.mkt.props.TG_TOKEN, sheets.mkt.props.TG_CHAT, await A.evaluate(() => JSON.stringify(db).includes('ABCDEFGHIJ')), (await A.textContent('#tgSt')).includes('شغالة')], [TOK, '777', false, true]);
    const tgTexts = () => sheets.mkt.tg.calls.filter(c => c.url.endsWith('/sendMessage')).map(c => c.body.text);

    const mlink = await A.evaluate(() => mktLink());
    DM = await newDevice(browser, base, sheets);
    const M = await DM.page('market.html' + mlink.slice(mlink.indexOf('#'))); await M.waitForTimeout(1500);
    eq('تطبيق الشريك اتربط بالرابط بس، والرابط اتشال من العنوان', [M.url().includes('marketjoin'), await M.evaluate(() => !!S.u && !!S.k)], [false, true]);
    eq('العملاء: عملاء السوق بس بأرصدتهم', await M.evaluate(() => [...customers().values()].map(c => [c.name, c.bal]).sort()), (await A.evaluate(() => liveParties().filter(p => p.sec === 'mkt').map(p => [p.name, balance(p.id)]))).sort());
    eq('الرئيسية: معاك كاش 0، ومفيهاش قايمة العملاء (ليها تبويب لوحدها) وفيه 4 تبويبات', [await M.textContent('#cashT'), await M.$('#lists'), await M.evaluate(() => document.querySelectorAll('#tabs button').length)], ['0', null, 4]);
    await M.click('#tabs button[data-t=c]'); await M.waitForTimeout(150);
    await M.click(`#lists .row[data-c="${pid1}"]`);
    eq('شاشة الدفعة: خانة المبلغ مفتوحة على لوحة الأرقام', await M.evaluate(() => [document.activeElement.id, $('#amt').inputMode]), ['amt', 'numeric']);
    await M.fill('#amt', '5000'); await M.click('.big[data-m=cash]'); await M.waitForTimeout(1500);
    eq('اتسجلت: الكلام بالعربي ووصلت لمصطفى', [(await M.innerText('.sent')).replace(/\s+/g, ' ').trim(), await M.textContent('#top .dot')], [`${C1} دفع 5,000 جنيه كاش ✓ وصلت لمصطفى`, 'متصل']);
    eq('تليجرام: رسالة لمصطفى مع الحركة', tgTexts().pop(), `💵 ${C1} دفع 5,000 كاش`);
    await M.click('#sAgain'); await M.fill('#amt', '3000'); await M.click('.big[data-m=insta]'); await M.waitForTimeout(400);
    await M.click('#sAgain'); await M.fill('#amt', '3000'); await M.click('.big[data-m=cash]'); await M.waitForTimeout(300);
    eq('حماية من التكرار: نفس المبلغ في دقيقتين بيسأل', (await M.textContent('#modal')).includes('دي دفعة تانية؟'), true);
    await M.click('#aN'); await M.waitForTimeout(200);
    eq('لما قال لأ متسجلتش', await M.evaluate(() => liveOps().length), 2);
    eq('الرصيد عند الشريك = رصيد الحسابات − اللي اتسجل ولسه متنقلش', await M.evaluate(id => customers().get(id).bal, pid1), bal0 - 800000);
    eq('اتسجل للعميل ده النهارده بحالته', await M.evaluate(() => { const t = $('#tdy').textContent.replace(/\s+/g, ' '); return ['إنستا لمصطفى', '3,000', '⏳ عند مصطفى', 'كاش معايا', '5,000'].every(x => t.includes(x)); }), true);
    await M.click('#bBack'); await M.waitForTimeout(150);
    eq('آخر زيارات فوق', await M.evaluate(() => $('#lists .lbl').textContent + '|' + $('#lists .list .row b').textContent), 'آخر زيارات|' + C1);

    DM.netDown = true;
    await M.click('#bNew'); await M.fill('#ncN', 'عميل سوق جديد'); await M.click('#ncOk'); await M.fill('#amt', '1500'); await M.click('.big[data-m=cash]'); await M.waitForTimeout(1500);
    eq('من غير نت: اتحفظت على الموبايل ومستنية', [(await M.textContent('#sSt')).includes('هتتبعت أول ما النت يرجع'), (await M.textContent('#top')).includes('1 مستنية تتبعت')], [true, true]);
    DM.netDown = false; await bg(M, 'sync()'); await M.waitForTimeout(1200);
    eq('النت رجع: اتبعتت لوحدها', [await M.evaluate(() => pending().length), (await M.textContent('#sSt')).includes('وصلت لمصطفى')], [0, true]);
    eq('مفيش اعتماد على navigator.onLine في تطبيق الشريك', /navigator\.onLine/.test(fs.readFileSync(path.join(ROOT, 'market.html'), 'utf8')), false);

    await bg(A, 'mkSync()'); await A.waitForTimeout(800);
    eq('تنبيه فوري في الحسابات (شريط فوق)', await A.evaluate(() => $('#mkBar').classList.contains('on')), true);
    await A.click('nav button[data-go=home]'); await A.waitForTimeout(200);
    eq('عداد الوارد على الشاشة الرئيسية', (await A.textContent('#mkRem')).replace(/\s+/g, ' ').includes('3 عمليات متنقلتش'), true);
    eq('مفيش حاجة دخلت الحسابات لوحدها', [await bal(A, C1), await vbal(A, 'v_mkt'), await A.evaluate(() => db.entries.filter(e => e.id.startsWith('e_mk_')).length)], [bal0, 0, 0]);
    await A.click('#mkGo'); await A.waitForTimeout(200);
    const card = `#p-mkt [data-mv="${pid1}"]`;
    eq('الوارد متجمع بالعميل: 5,000 كاش + 3,000 إنستا = 8,000، والنقل مقفول لحد "وصل"', [(await A.textContent(`#p-mkt .ic:has([data-mv="${pid1}"])`)).replace(/\s+/g, ' ').includes('5,000 كاش + 3,000 إنستا = 8,000'), await A.isDisabled(card)], [true, true]);
    await A.click('#p-mkt [data-ok]'); await A.click('#arOk'); await A.waitForTimeout(200);
    eq('بعد "وصل" زرار النقل اشتغل', await A.isDisabled(card), false);
    await A.click(card); await A.waitForTimeout(200);
    eq('شاشة التأكيد: الكاش ← خزنة السوق والتاريخ لوحده', await A.evaluate(() => [$$('#modal .mvr [data-f=v]').map(x => x.value)[0], $$('#modal .mvr [data-f=d]')[0].value, $('#modal').textContent.includes('عمليات')]), ['v_mkt', today, true]);
    await A.evaluate(() => { const s = $$('#modal .mvr [data-f=v]')[1]; s.value = ''; });   // التحويل: من غير خزنة (في حساب العميل بس)
    await A.click('#mvOk'); await A.waitForTimeout(300);
    eq('النقل: العميل نزل 8,000، وخزنة السوق دخلها الكاش بس', [await bal(A, C1), await vbal(A, 'v_mkt')], [bal0 - 800000, 500000]);
    const twice = await A.evaluate(() => { const o = Object.values(db.mkt.ops).find(x => x.m === 'cash' && x.amt === 500000); const r = mkMove(o, {pid: o.cid, amt: o.amt, date: todayISO(), vault: 'v_mkt'}); return [r, db.entries.filter(e => e.id.startsWith('e_mk_') && !e.del).length]; });
    eq('مستحيل تتنقل مرتين', twice, [false, 2]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.waitForTimeout(800);
    eq('الشريك شاف ✓ اتنقلت، والرصيد عنده اتظبط', await M.evaluate(id => [liveOps().filter(o => opState(o) === 'done').length, customers().get(id).bal], pid1), [2, bal0 - 800000]);
    eq('بعد النقل مفيش "امسحها" عند الشريك', await M.evaluate(() => { const o = liveOps().find(x => opState(x) === 'done'); nav('ok/' + o.id); return !!$('#sDel'); }), false);

    await A.click('#p-mkt [data-mv^="n:"]'); await A.waitForTimeout(200); await A.click('#lkNew'); await A.waitForTimeout(150); await A.click('#mvOk'); await A.waitForTimeout(300);
    eq('عميل جديد: اتفتحله حساب في عملاء السوق واتنقلت الدفعة', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل سوق جديد'); return p ? [p.sec, balance(p.id)] : null; }), ['mkt', -150000]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.waitForTimeout(800);
    eq('عند الشريك: العميل الجديد بقى تحت الحساب الحقيقي', await M.evaluate(() => [...customers().values()].filter(c => c.name === 'عميل سوق جديد').map(c => [!!c.nw, c.id.startsWith('n_')])), [[false, false]]);

    await A.evaluate(() => cancelEntry(E.get('e_mk_' + Object.values(db.mkt.ops).find(x => x.m === 'cash' && x.amt === 500000).id))); await A.waitForTimeout(200);
    await bg(A, 'mkSync()'); await A.waitForTimeout(400);
    eq('مسح الحركة المنقولة من الحسابات: العملية رجعت "متنقلتش"', [await A.evaluate(() => mkPending().length), await bal(A, C1)], [1, bal0 - 300000]);
    await bg(M, 'sync()'); await M.waitForTimeout(500);
    eq('والشريك شافها ⏳ عند مصطفى تاني', await M.evaluate(() => opState(liveOps().find(x => x.m === 'cash' && x.amt === 500000))), 'wait');

    await A.click('nav button[data-go=home]'); await A.click('#mkGo'); await A.waitForTimeout(200);
    await A.click(`#p-mkt [data-bk="${pid1}"]`); await A.fill('#rtN', 'المبلغ 4,500 مش 5,000'); await A.click('#rtOk'); await A.waitForTimeout(300);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.waitForTimeout(600);
    await M.evaluate(() => nav('')); await M.waitForTimeout(150);
    eq('رجّعها: الشريك شاف 🔴 والملاحظة', [await M.evaluate(() => backs().length), (await M.textContent('#bk')).includes('رجّعلك')], [1, true]);
    await M.click('#bk'); await M.waitForTimeout(200);
    eq('نافذة التصليح بتفتح على طول فيها ملاحظة مصطفى', (await M.textContent('#modal')).includes('المبلغ 4,500 مش 5,000'), true);
    await M.fill('#eA', '4500'); await M.click('#eOk'); await M.waitForTimeout(1200);
    eq('تليجرام: رسالة التعديل', tgTexts().pop(), `✏️ اتعدلت: ${C1} دفع 5,000 كاش\nبقت: ${C1} دفع 4,500 كاش`);
    await bg(A, 'mkSync()'); await A.waitForTimeout(300);
    eq('بعد التصليح رجعت لمصطفى تاني وعليها "اتصلحت"', [await A.evaluate(() => mkPending().length), (await A.textContent('#p-mkt')).includes('اتصلحت')], [1, true]);

    await M.evaluate(i => nav('p/' + i), pid1); await M.fill('#amt', '200'); await M.click('.big[data-m=voda]'); await M.waitForTimeout(800);
    await M.click('#sDel'); await M.click('#aY'); await M.waitForTimeout(1000);
    eq('تليجرام: رسالة المسح', tgTexts().pop(), `🗑 اتمسحت: ${C1} دفع 200 فودافون كاش`);
    await bg(A, 'mkSync()'); await A.waitForTimeout(300);
    eq('اللي اتمسح مش في الوارد', await A.evaluate(() => mkPending().map(o => o.amt)), [450000]);

    await bg(B, 'syncNow()'); await B.waitForTimeout(1500); await bg(B, 'mkSync()'); await B.waitForTimeout(800);
    await bg(A, 'syncNow()'); await A.waitForTimeout(1500);
    eq('جهاز حسابات تاني: خد ربط السوق لوحده ونفس الوارد، ومفيش خزنة سوق مكررة', [await B.evaluate(() => mkPending().map(o => o.amt)), await B.evaluate(() => db.vaults.filter(v => v.name === 'خزنة السوق').length), await A.evaluate(() => db.vaults.filter(v => v.name === 'خزنة السوق').length)], [[450000], 1, 1]);
    eq('الشيت: كل عملية مرة واحدة', new Set(mkRows('op').map(r => r[0])).size, mkRows('op').length);

    console.log('\n١٧) حركة السوق (المرحلة التانية): صرفت وسلمت والتجميع والأرشيف');
    await M.evaluate(() => nav('')); await M.waitForTimeout(200);
    const cash0 = await M.evaluate(() => cashNow());
    eq('اللي معاك كاش = الكاش اللي حصّلته (من غير التحويلات)', [cash0, await M.evaluate(() => liveOps().filter(o => o.t === 'pay' && o.m === 'cash').reduce((a, o) => a + o.amt, 0))], [cash0, 600000]);
    eq('الرئيسية فيها دفعة عميل وصرفت وسلمت لمصطفى', await M.evaluate(() => [...document.querySelectorAll('.qa button')].map(b => b.textContent)), ['＋ دفعة أو فاتورة', 'صرفت', 'سلمت لمصطفى']);
    await M.click('#qSp'); await M.waitForTimeout(200);
    eq('صرفت: خانة المبلغ مفتوحة وفيه 4 أنواع جاهزة', await M.evaluate(() => [document.activeElement.id, [...document.querySelectorAll('.cat[data-c]')].map(b => b.dataset.c)]), ['amt', ['بنزين', 'مواصلات', 'أكل', 'حاجة تانية']]);
    await M.fill('#amt', '200'); await M.click('.cat[data-c="بنزين"]'); await M.waitForTimeout(1200);
    eq('اتسجل مصروف بنزين بالعربي، واتخصم من اللي معاه', [(await M.innerText('.sent')).replace(/\s+/g, ' ').trim(), await M.evaluate(() => cashNow())], ['صرفت 200 جنيه بنزين ✓ وصلت لمصطفى', cash0 - 20000]);
    eq('تليجرام: رسالة المصروف', tgTexts().pop(), '⛽ مصروف بنزين: 200');
    const expId = await M.evaluate(() => liveOps().find(o => o.t === 'exp').id);
    await M.evaluate(() => nav('')); await M.waitForTimeout(150);
    await M.click(`.row[data-o="${expId}"]`); await M.waitForTimeout(200);
    eq('تعديل المصروف من الرئيسية بدوسة: الرقم القديم والنوع ظاهرين', [await M.inputValue('#eA'), await M.getAttribute('#eC .chip.on', 'data-c')], ['200', 'بنزين']);
    await M.fill('#eA', '250'); await M.click('#eC .chip[data-c="مواصلات"]'); await M.click('#eOk'); await M.waitForTimeout(1200);
    eq('تليجرام: رسالة تعديل المصروف', tgTexts().pop(), '✏️ اتعدلت: مصروف بنزين: 200\nبقت: مصروف مواصلات: 250');
    await M.click('#qSp'); await M.click('#spT button[data-v=spay]'); await M.fill('#sn', 'مورد تجربة'); await M.fill('#amt', '3000'); await M.click('#spOk'); await M.waitForTimeout(1200);
    eq('دفعة لمورد (باسم مكتوب بإيده) اتسجلت', [(await M.innerText('.sent')).replace(/\s+/g, ' ').trim(), tgTexts().pop()], ['دفعت لـ مورد تجربة 3,000 جنيه ✓ وصلت لمصطفى', '🏭 دفع للمورد مورد تجربة 3,000']);
    await M.click('#sAgain'); await M.waitForTimeout(150);
    eq('الأسامي اللي كتبها قبل كده بتطلع يختار منها (من غير قايمة موردين)', await M.evaluate(() => [...document.querySelectorAll('#spBody .chip')].map(c => c.textContent)), ['مورد تجربة']);
    await M.evaluate(() => nav('')); await M.click('#qHand'); await M.fill('#hAmt', '1000'); await M.click('#hOk'); await M.waitForTimeout(1200);
    eq('سلمت لمصطفى كاش اتسجلت، وتليجرام', [(await M.innerText('.sent')).replace(/\s+/g, ' ').trim(), tgTexts().pop()], ['سلمت لمصطفى 1,000 جنيه كاش ✓ وصلت لمصطفى', '🤝 سلّمك 1,000 كاش']);
    eq('معاه دلوقتي = كاش − مصروف − مورد − اللي سلمه', await M.evaluate(() => cashNow()), cash0 - 25000 - 300000 - 100000);
    await M.evaluate(() => nav('')); await M.waitForTimeout(200);
    eq('الرئيسية: اللي معاه وإجمالي النهارده (حصّلت | صرفت | سلّمت لمصطفى)', await M.evaluate(() => [$('#cashT').textContent, [...document.querySelectorAll('.panel .pn b')].map(b => b.textContent), document.querySelectorAll('#main .row[data-o]').length]), ['1,750', ['9,000', '3,250', '4,000'], 6]);
    await M.click('#tabs button[data-t=a]'); await M.waitForTimeout(200);
    eq('الأرشيف: إجمالي الأسبوع (حصّلت | صرفت | سلّمت لمصطفى | معايا)', await M.evaluate(() => [...document.querySelector('.wk .pn').querySelectorAll('b')].map(b => b.textContent)), ['9,000', '3,250', '4,000', '1,750']);
    eq('الأرشيف: سطر النهارده بنفس الأرقام ومعاه اسم اليوم', await M.evaluate(() => { const r = [...document.querySelectorAll('.wk tr[data-d]')[0].querySelectorAll('td')].map(x => x.textContent.trim()); return [r.slice(1), r[0].startsWith(AR_DAYS[dowOf(today())])]; }), [['9,000', '3,250', '4,000', '1,750'], true]);
    await M.click('.wk tr[data-d]'); await M.waitForTimeout(200);
    eq('يوم النهارده: كل حركاته (6) وإجماليه', await M.evaluate(() => [document.querySelectorAll('#main .row[data-o]').length, [...document.querySelector('.panel .pn').querySelectorAll('b')].map(b => b.textContent)]), [6, ['9,000', '3,250', '4,000', '1,750']]);
    await M.click('#aPrev'); await M.waitForTimeout(150);
    eq('اليوم اللي قبله فاضي، وسهم التالي بيرجع النهارده', [await M.evaluate(() => document.querySelectorAll('#main .row[data-o]').length), (await M.textContent('#main')).includes('مفيش حركات في اليوم ده'), await M.isDisabled('#aNext')], [0, true, false]);
    await M.click('#aNext'); await M.waitForTimeout(150);
    eq('بعد النهارده السهم مقفول', await M.isDisabled('#aNext'), true);
    await M.evaluate(() => nav('a/2020-03-05')); await M.waitForTimeout(150);
    eq('أي يوم قديم بالتاريخ بيفتح', (await M.textContent('.dnav span')).includes('2020'), true);
    /* تعديل ومسح أي حركة بسهولة، من الأرشيف كمان */
    await M.evaluate(() => nav('')); await M.click('#qSp'); await M.fill('#amt', '10'); await M.click('.cat[data-c="أكل"]'); await M.waitForTimeout(500);
    const tmpId = await M.evaluate(() => liveOps().find(o => o.t === 'exp' && o.cat === 'أكل').id);
    await M.evaluate(() => nav('a/' + today())); await M.waitForTimeout(150); await M.click(`.row[data-o="${tmpId}"]`); await M.waitForTimeout(150);
    await M.fill('#eA', '20'); await M.click('#eOk'); await M.waitForTimeout(500);
    eq('تعديل مصروف من الأرشيف', await M.evaluate(id => [S.ops[id].amt, cashNow()], tmpId), [2000, 175000 - 2000]);
    await M.click(`.row[data-o="${tmpId}"]`); await M.waitForTimeout(150); await M.click('#eDel'); await M.click('#aY'); await M.waitForTimeout(500);
    eq('مسح مصروف بنافذة التعديل، واللي معاه رجع زي ما كان', await M.evaluate(id => [S.ops[id].del, cashNow()], tmpId), [true, 175000]);
    await M.click('#tabs button[data-t=s]'); await M.waitForTimeout(150); await M.click('#uiTheme button[data-v=dark]');
    eq('الإعدادات: داكن بيشتغل ويتحفظ على الموبايل', await M.evaluate(() => [document.documentElement.dataset.theme, JSON.parse(localStorage.getItem('fo_ui')).theme]), ['dark', 'dark']);
    await M.click('#uiTheme button[data-v=light]'); await M.click('#uiFs button[data-v="1.12"]');
    eq('الإعدادات: فاتح وحجم خط كبير', await M.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.fs]), ['light', 'z']);
    await M.click('#uiFs button[data-v="1"]'); await M.evaluate(() => nav('')); await M.waitForTimeout(100);

    await bg(A, 'mkSync()'); await A.waitForTimeout(900);
    await A.click('nav button[data-go=home]'); await A.click('#mkGo'); await A.waitForTimeout(250);
    eq('الوارد عند مصطفى: 4 عمليات متنقلتش (كاش عميل + مصروف + مورد + تسليم)', await A.evaluate(() => [mkPending().length, mkPending().map(o => o.t).sort()]), [4, ['exp', 'hand', 'pay', 'spay']]);
    eq('مفيش حاجة دخلت الحسابات لوحدها (لا خزنة ولا مورد)', await A.evaluate(() => [vaultBal('v_mkt'), db.txs.filter(t => t.id.startsWith('t_mk_')).length, db.entries.filter(e => e.id.startsWith('e_mk_') && !e.del).length]), [150000, 0, 2]);
    const supB0 = await bal(A, 'مورد تجربة'), mainB0 = await vbal(A, 'v_main'), exp0 = await A.evaluate(() => profitOf(todayISO().slice(0, 4) + '-01-01', todayISO()).exp);
    await A.click('#p-mkt [data-mv="x:exp"]'); await A.waitForTimeout(200);
    eq('تأكيد المصروف: من خزنة السوق، ومن غير اختيار "من غير خزنة"', await A.evaluate(() => [$('#modal [data-f=v]').value, [...$('#modal [data-f=v]').options].every(o => o.value), $('#modal').textContent.includes('مصاريف السوق')]), ['v_mkt', true, true]);
    await A.click('#mvOk'); await A.waitForTimeout(300);
    eq('المصروف اتنقل كمصروف خزنة تحت "مصاريف السوق"، وخزنة السوق نزلت، وطلع في الأرباح', await A.evaluate(([e0]) => { const t = IDX.tx.get('t_mk_' + Object.values(db.mkt.ops).find(o => o.t === 'exp').id); return [t.type, t.cat, cName(t.cat), t.amt, vaultBal('v_mkt'), profitOf(todayISO().slice(0, 4) + '-01-01', todayISO()).exp - e0]; }, [exp0]), ['exp', 'c_mkexp', 'مصاريف السوق', 25000, 125000, 25000]);
    await A.click('#p-mkt [data-mv^="s:"]'); await A.waitForTimeout(250);
    eq('دفعة المورد زي العميل الجديد: بتطلب ربط بحساب مورد', [(await A.textContent('#modal h3')).includes('مورد'), await A.evaluate(() => [...document.querySelectorAll('#lkL .pt .m b')].map(x => x.textContent))], [true, ['مورد تجربة']]);
    await A.click('#lkL .pt'); await A.waitForTimeout(250);
    await A.click('#mvOk'); await A.waitForTimeout(300);
    eq('اتنقلت للمورد كدفعة (ppay) من خزنة السوق، ورصيد المورد اتغير', await A.evaluate(([b0]) => { const e = E.get('e_mk_' + Object.values(db.mkt.ops).find(o => o.t === 'spay').id); return [e.kind, e.vault, e.amt, balance(e.party) - b0, vaultBal('v_mkt')]; }, [supB0]), ['ppay', 'v_mkt', 300000, 300000, -175000]);
    await A.click('#p-mkt [data-mv="x:hand"]'); await A.waitForTimeout(250);
    eq('الاستلام: تحويل من خزنة السوق لأول خزنة تانية', await A.evaluate(() => [$('#modal [data-f=v]').value, $('#modal [data-f=t]').value]), ['v_mkt', 'v_main']);
    await A.click('#mvOk'); await A.waitForTimeout(300);
    eq('الكاش المسلَّم اتنقل كتحويل خزنة لخزنة', await A.evaluate(([m0]) => { const t = IDX.tx.get('t_mk_' + Object.values(db.mkt.ops).find(o => o.t === 'hand').id); return [t.type, t.vault, t.to, t.amt, vaultBal('v_mkt'), vaultBal('v_main') - m0]; }, [mainB0]), ['tr', 'v_mkt', 'v_main', 100000, -275000, 100000]);
    await A.click('#p-mkt [data-mv]'); await A.waitForTimeout(250); await A.click('#mvOk'); await A.waitForTimeout(300);
    const finalCash = await M.evaluate(() => cashNow());
    eq('بعد نقل الكل: رصيد خزنة السوق = اللي مع الشريك حسب تسجيله، و"متطابقين"', [await vbal(A, 'v_mkt'), finalCash, await A.evaluate(() => mkPending().length), (await A.textContent('#p-mkt .mkbal')).includes('متطابقين')], [175000, 175000, 0, true]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.waitForTimeout(900);
    eq('الشريك شاف ✓ على كل حاجة (من غير مسح)', await M.evaluate(() => [liveOps().filter(o => opState(o) !== 'done').length, liveOps().length]), [0, 6]);
    await A.evaluate(() => { const t = IDX.tx.get('t_mk_' + Object.values(db.mkt.ops).find(o => o.t === 'hand').id); t.del = true; touch(t); saveDB(); });
    await bg(A, 'mkSync()'); await A.waitForTimeout(300);
    eq('لو مسح حركة الكاش المنقولة: التسليم يرجع "متنقلش"', await A.evaluate(() => mkPending().map(o => o.t)), ['hand']);
    await A.evaluate(() => { const o = mkPending()[0]; mkMove(o, {amt: o.amt, date: todayISO(), vault: 'v_mkt', to: 'v_main'}); saveDB(); });
    eq('وإعادة النقل بتعيد نفس الحركة من غير ما تتكرر', await A.evaluate(() => [mkPending().length, db.txs.filter(t => t.id.startsWith('t_mk_') && !t.del).length, db.txs.filter(t => t.id.startsWith('t_mk_')).length]), [0, 2, 2]);
    await A.click('#mkTabs button[data-v=arch]'); await A.waitForTimeout(250);
    eq('أرشيف مصطفى: اليوم بحركات الشريك كلها وإجمالي اليوم', await A.evaluate(() => [document.querySelectorAll('#mkBody .il').length, [...document.querySelectorAll('#mkBody .mkbal .bl b')].map(b => b.textContent)]), [6, ['9,000', '4,000', '3,250', '1,750']]);
    await A.click('#maPrev'); await A.waitForTimeout(200);
    eq('أرشيف مصطفى: اليوم اللي قبله فاضي', (await A.textContent('#mkBody')).includes('مفيش حركات من الشريك في اليوم ده'), true);
    await A.click('#mkTabs button[data-v=in]');
    eq('الشيت: كل عملية مرة واحدة برضه', new Set(mkRows('op').map(r => r[0])).size, mkRows('op').length);

    console.log('\n١٨) حركة السوق: فاتورة بإجمالي بس من الشريك، ومصطفى بيكتب بنودها');
    for (let i = 0; i < 4; i++) { await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.waitForTimeout(700); }   // الشريك ياخد آخر حالات وأرصدة قبل ما نقيس
    await M.waitForFunction(() => liveOps().every(o => opState(o) === 'done'), null, {timeout: 20000});
    const bI0 = await bal(A, C1), cashB = await M.evaluate(() => cashNow());
    await M.evaluate(i => { pyTab = 'pay'; nav('p/' + i); }, pid1); await M.waitForTimeout(200);
    eq('شاشة العميل: دفعة أو فاتورة (الدفعة هي الافتراضي)', await M.evaluate(() => [[...document.querySelectorAll('#pyT button')].map(b => b.dataset.v), document.querySelector('#pyT button.on').dataset.v, document.querySelectorAll('#pyBtns .big[data-m]').length]), [['pay', 'inv'], 'pay', 3]);
    await M.click('#pyT button[data-v=inv]'); await M.fill('#amt', '10000'); await M.click('#invOk'); await M.waitForTimeout(1200);
    eq('فاتورة إجمالي بس: اتسجلت بالعربي ووصلت، وتليجرام', [(await M.innerText('.sent')).replace(/\s+/g, ' ').trim(), tgTexts().pop()], [`فاتورة ${C1} إجمالي 10,000 جنيه ✓ وصلت لمصطفى`, `🧾 ${C1} فاتورة بـ 10,000`]);
    eq('الفاتورة اتضافت على حساب العميل عند الشريك لوحدها، واللي معاه كاش مبيتغيرش', await M.evaluate(([id, c0]) => [customers().get(id).bal - S.cust[id].bal, cashNow() - c0], [pid1, cashB]), [1000000, 0]);
    await M.click('#sAgain'); await M.waitForTimeout(150);
    await M.fill('#amt', '3300'); await M.click('.big[data-m=cash]'); await M.waitForTimeout(1200);
    eq('"العميل دفع حاجة دلوقتي؟" فتح شاشة الدفعة ونزلت من حسابه، واللي معاه زاد 3,300', await M.evaluate(([id, c0]) => [customers().get(id).bal - S.cust[id].bal, cashNow() - c0], [pid1, cashB]), [670000, 330000]);
    await M.evaluate(() => nav('')); await M.waitForTimeout(150);
    eq('الرئيسية عند الشريك: الفواتير في سطر لوحدها ومبتدخلش في حصّلت', await M.evaluate(() => [document.querySelector('.invln b').textContent, [...document.querySelectorAll('.panel .pn b')].map(b => b.textContent)[0]]), ['10,000', '12,300']);

    await A.evaluate(() => { mkView = 'in'; go('mkt'); mkSync(); }); await A.waitForTimeout(900);
    const invOp = await A.evaluate(() => mkPending().find(o => o.t === 'inv').id);
    eq('الوارد عند مصطفى: الفاتورة والدفعة مع بعض، ومفيش حاجة دخلت الحسابات', [await A.evaluate(() => mkPending().map(o => o.t).sort()), await bal(A, C1), await A.$(`#p-mkt [data-inv="${invOp}"]`) !== null, await A.$(`#p-mkt [data-mv="${pid1}"]`) !== null], [['inv', 'pay'], bI0, true, true]);
    await A.click(`#p-mkt [data-inv="${invOp}"]`); await A.waitForTimeout(300);
    eq('نافذة الفاتورة: إجمالي شريكك ظاهر والتاريخ بتاعه، ومفيش خانة "دفع دلوقتي"', [(await A.textContent('#modal')).includes('فاتورة من شريكك'), await A.inputValue('#dcDate'), await A.$('#dcPaid')], [true, today, null]);
    await A.fill('.li [data-f=name]', 'لفة تجربة 16 مم'); await A.dispatchEvent('.li [data-f=name]', 'change'); await A.fill('.li [data-f=qty]', '10'); await A.fill('.li [data-f=price]', '500');
    eq('الفرق عن إجمالي شريكك بيظهر', (await A.textContent('#dcMk')).includes('الفرق'), true);
    await A.click('#dcOk'); await A.waitForTimeout(150);
    eq('لو الإجمالي مش مطابق: تحذير ومبيتسجلش', [(await A.textContent('#dcWarn')).includes('مش مساوي'), await bal(A, C1)], [true, bI0]);
    await A.fill('.li [data-f=qty]', '20');
    eq('بعد التظبيط: مطابق', (await A.textContent('#dcMk')).includes('مطابق'), true);
    await A.click('#dcOk'); await closed(A); await A.waitForTimeout(300);
    eq('الفاتورة اتسجلت بالبنود على حساب العميل، بنفس تاريخ الشريك وبـ id ثابت', await A.evaluate(([id, pid]) => { const e = E.get('e_mk_' + id); return [e.kind, e.party === pid, docTotal(e), e.lines.length, e.date]; }, [invOp, pid1]), ['inv', true, 1000000, 1, today]);
    eq('رصيد العميل زاد 10,000 والدفعة لسه مستنياك', [await bal(A, C1) - bI0, await A.evaluate(() => mkPending().map(o => o.t))], [1000000, ['pay']]);
    await A.click(`#p-mkt [data-mv="${pid1}"]`); await A.waitForTimeout(250); await A.click('#mvOk'); await A.waitForTimeout(300);
    eq('نقل الدفعة: الرصيد = القديم + الفاتورة − الدفعة، وخزنة السوق = اللي مع الشريك', [await bal(A, C1) - bI0, await vbal(A, 'v_mkt'), cashB + 330000], [670000, cashB + 330000, cashB + 330000]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.waitForTimeout(900);
    eq('الشريك شاف ✓ على الاتنين ورصيد العميل عنده = رصيد الحسابات', await M.evaluate(id => [liveOps().filter(o => opState(o) !== 'done').length, customers().get(id).bal], pid1), [0, bI0 + 670000]);
    await A.evaluate(id => cancelEntry(E.get('e_mk_' + id)), invOp); await A.waitForTimeout(200); await bg(A, 'mkSync()'); await A.waitForTimeout(300);
    eq('لو مسح الفاتورة من الحسابات: ترجع "متنقلتش"', await A.evaluate(() => mkPending().map(o => o.t)), ['inv']);
    await A.click(`#p-mkt [data-inv="${invOp}"]`); await A.waitForTimeout(300); await A.click('#dcOk'); await closed(A); await A.waitForTimeout(300);
    eq('وإعادة كتابتها بترجع نفس الفاتورة من غير تكرار', await A.evaluate(id => [mkPending().length, db.entries.filter(e => e.id === 'e_mk_' + id).length, E.get('e_mk_' + id).del], invOp), [0, 1, false]);

    /* عميل جديد: فاتورة بإجمالي بس */
    await M.evaluate(() => nav('c')); await M.click('#bNew'); await M.fill('#ncN', 'عميل فاتورة جديد'); await M.click('#ncOk'); await M.click('#pyT button[data-v=inv]'); await M.fill('#amt', '2500'); await M.click('#invOk'); await M.waitForTimeout(1200);
    eq('تليجرام: فاتورة عميل جديد', tgTexts().pop(), '🧾 عميل فاتورة جديد (عميل جديد) فاتورة بـ 2,500');
    await bg(A, 'mkSync()'); await A.waitForTimeout(800);
    await A.click('#p-mkt [data-inv]'); await A.waitForTimeout(300);
    eq('عميل جديد: بيطلب ربط بحساب الأول', (await A.textContent('#modal h3')).includes('اربط'), true);
    await A.click('#lkNew'); await A.waitForTimeout(300);
    await A.fill('.li [data-f=name]', 'صنف تجربة جديد'); await A.fill('.li [data-f=qty]', '1'); await A.fill('.li [data-f=price]', '2500'); await A.click('#dcOk'); await closed(A); await A.waitForTimeout(300);
    eq('اتفتحله حساب في عملاء السوق وفيه الفاتورة بالبنود', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل فاتورة جديد'); return p ? [p.sec, balance(p.id), partyEntries(p.id).map(e => e.kind)] : null; }), ['mkt', 250000, ['inv']]);
    await M.evaluate(() => nav('a')); await M.waitForTimeout(200);
    eq('الأرشيف عند الشريك: الفواتير في سطر لوحدها في الأسبوع', (await M.textContent('.wk .invln')).includes('12,500'), true);
    eq('الشيت: كل عملية مرة واحدة', new Set(mkRows('op').map(r => r[0])).size, mkRows('op').length);

    console.log('\n١٥) المراجعة الداخلية');
    eq('مفيش أي مشكلة في المراجعة', await A.evaluate(() => selfCheck()), []);
    eq('مفيش أخطاء في الصفحات', D1.errs.concat(D2.errs, DM ? DM.errs : []), []);
  } catch (e) { fails++; console.log('  ✖ الاختبار وقف:', e.message.split('\n').slice(0, 6).join(' | ')); if (process.env.DBG) console.log(e.stack); }
  await browser.close(); srv.close();
  console.log(`\n${fails ? '✖' : '✔'} ${oks} نجح، ${fails} فشل\n`);
  process.exit(fails ? 1 : 0);
})();
