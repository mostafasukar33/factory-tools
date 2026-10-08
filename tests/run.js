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
const ACC_URL = 'https://script.google.com/macros/s/TEST-ACC/exec', CASH_URL = 'https://script.google.com/macros/s/TEST-CASH/exec';
const PASS = '246810', KEY = 'Test-Key-2026';

let fails = 0, oks = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { oks++; console.log('  ✔', name); } else { fails++; console.log('  ✖', name, '\n     المتوقع:', JSON.stringify(want), '\n     اللي طلع:', JSON.stringify(got)); }
}
const iso = d => d.toISOString().slice(0, 10);
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
    const q = r.request(), g = q.url().includes('TEST-CASH') ? sheets.cash : sheets.acc;
    if (!g.ctx.doPost) return r.fulfill({status: 200, contentType: 'text/html', body: '<html>no script</html>'});
    r.fulfill({status: 200, contentType: 'application/json', body: q.method() === 'POST' ? g.post(q.postData()) : g.get()});
  });
  ctx.page = async url => { const p = await ctx.newPage(); p.on('pageerror', e => (ctx.errs.push(e.message), process.env.DBG && console.log('PAGEERR', e.message))); await p.goto(base + url); return p; };
  return ctx;
}
async function unlock(A, first) {
  if (first) { await A.fill('#suP', PASS); await A.fill('#suP2', PASS); await A.click('#suGo'); }
  else { await A.fill('#lkP', PASS); await A.waitForSelector('#lock:not(.on)', {state: 'attached', timeout: 15000}); }
  await A.waitForSelector('#lock', {state: 'hidden'});
}
const closed = A => A.waitForSelector('#mask', {state: 'hidden'});
const bal = (A, name) => A.evaluate(n => { const p = liveParties().find(x => x.name === n); return p ? balance(p.id) : null; }, name);
const vbal = (A, vid) => A.evaluate(v => vaultBal(v), vid || '');
const openParty = async (A, name) => { await A.evaluate(n => go('p/' + liveParties().find(x => x.name === n).id), name); await A.waitForTimeout(150); };

(async () => {
  const srv = await serve(), base = `http://localhost:${srv.address().port}/`;
  const browser = await pw.chromium.launch(CHROME ? {executablePath: CHROME} : {});
  const sheets = {acc: makeGas(), cash: makeGas()};
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
    await A.click('#ppDoc'); await A.fill('.li [data-f=name]', 'لفة تجربة 16 مم'); await A.dispatchEvent('.li [data-f=name]', 'change');
    eq('آخر سعر للعميل بيتكتب لوحده', await A.inputValue('.li [data-f=price]'), '350');
    await A.fill('.li [data-f=qty]', '4'); await A.fill('#dcDisc', '50'); await A.fill('#dcPaid', '400'); await A.click('#dcOk'); await closed(A);
    eq('بعد فاتورة 1400−50 ودفع 400', await bal(A, 'عميل تجربة واحد'), 270000 + 135000 - 40000);
    eq('الدفعة دخلت الخزنة', await vbal(A, 'v_main'), 140000);
    await A.click('#ppRet'); await A.fill('.li [data-f=name]', 'لفة تجربة 16 مم'); await A.fill('.li [data-f=qty]', '1'); await A.fill('.li [data-f=price]', '350'); await A.click('#dcOk'); await closed(A);
    await A.click('#ppAdj'); await A.fill('#adAmt', '15'); await A.fill('#adNote', 'جبر كسور'); await A.click('#adOk'); await closed(A);
    eq('بعد مرتجع 350 وخصم 15', await bal(A, 'عميل تجربة واحد'), 365000 - 35000 - 1500);
    await A.click('#ppPay'); await A.fill('#pyAmt', '100'); await A.click('#pyOk'); await closed(A);
    await A.click('#ppPay'); await A.fill('#pyAmt', '100'); await A.click('#pyOk'); await A.waitForTimeout(150);
    eq('تنبيه الدفعة المكررة', (await A.textContent('#pyWarn')).includes('بنفس المبلغ'), true); await A.click('#pyX');

    console.log('\n٤) الشيكات مقفولة واختيارات كشف الحساب');
    eq('مفيش زرار شيكات ولا طريقة دفع شيك', [!!(await A.$('nav button[data-go=chk]')), (await A.click('#ppPay'), !!(await A.$('#pyM button[data-v=شيك]')))], [false, false]); await A.click('#pyX');
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
    eq('اللاب توب: الحساب مفتوح جنب القايمة', await A.evaluate(() => [$('main').classList.contains('split'), getComputedStyle($('#p-home')).display, !!$('#hList .pt.cur'), getComputedStyle($('nav')).width]), [true, 'block', true, '210px']);
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
    const [dl] = await Promise.all([A.waitForEvent('download', {timeout: 90000}), A.click('#smShare')]);
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
    await A.click('nav button[data-go=set]'); await A.fill('#sLockD', today); await A.click('#sLockGo'); await A.click('#cOk'); await A.waitForTimeout(200);
    await openParty(A, 'عميل تجربة واحد'); await A.click('#ppPay'); await A.fill('#pyAmt', '1'); await A.click('#pyOk'); await A.waitForTimeout(150);
    eq('مينفعش تسجل في فترة مقفولة', (await A.textContent('#toast')).includes('مقفولة'), true); await A.click('#pyX');
    await A.click('nav button[data-go=set]'); await A.click('#sUnlock'); await A.fill('#apP', PASS); await A.click('#apOk'); await A.waitForTimeout(600);

    console.log('\n١٠) المزامنة مع الشيت وجهاز تاني');
    await A.click('nav button[data-go=set]'); await A.fill('#shUrl', ACC_URL); await A.click('#sSheet details summary'); await A.fill('#shKey', KEY); await A.click('#shSave'); await A.waitForTimeout(300);
    await A.click('#shHelp'); await A.click('#hpCopy'); const accCode = await A.evaluate(() => navigator.clipboard.readText()); sheets.acc.load(accCode); await A.click('#hpX');
    eq('كود الشيت مفيهوش المفتاح', accCode.includes(KEY), false);
    eq('رقم تعريف النشر بيتحول للينك', await A.evaluate(() => normSheetUrl(' AKfycbxTEST1234567890abcdefghij ')), 'https://script.google.com/macros/s/AKfycbxTEST1234567890abcdefghij/exec');
    await A.click('#shSave'); await A.waitForTimeout(4000);
    eq('الشيت مقفول من غير المفتاح', JSON.parse(sheets.acc.get()).ok, false);
    eq('الشيت اتقفل على أول مفتاح', JSON.parse(sheets.acc.post(JSON.stringify({key: 'Other-Key-123', action: 'ping'}))).error, 'key');
    eq('الشيت بيرفض مفتاح غلط', JSON.parse(sheets.acc.post(JSON.stringify({key: 'x', action: 'pull'}))).error, 'key');
    const D2 = await newDevice(browser, base, sheets), B = await D2.page('accounts.html');
    await unlock(B, true);
    await B.click('nav button[data-go=set]'); await B.fill('#shUrl', ACC_URL); await B.click('#sSheet details summary'); await B.fill('#shKey', KEY); await B.click('#shSave'); await B.waitForTimeout(4000);
    const snap = X => X.evaluate(() => [liveParties().map(p => balance(p.id)).sort(), vaultBal(''), selfCheck().length]);
    eq('الجهاز التاني نزل نفس الأرصدة', await snap(B), await snap(A));
    await B.evaluate(() => syncNow()); await A.evaluate(() => syncNow()); await A.waitForTimeout(1500);
    const rows = sheets.acc.sheets['السجلات'].rows.slice(1).map(r => r[0]);
    eq('مفيش سجلات متكررة في الشيت', new Set(rows).size, rows.length);
    const link = await A.evaluate(() => joinLink());
    eq('رابط الربط مفيهوش المفتاح مكشوف', link.includes('Test-Key'), false);
    const D3 = await newDevice(browser, base, sheets), J = await D3.page('accounts.html' + link.slice(link.indexOf('#')));
    await unlock(J, true); await J.waitForTimeout(5000);
    eq('جهاز جديد برابط الربط بس نزلت عليه كل الحسابات', await snap(J), await snap(A));
    eq('الجهاز الجديد فضل مربوط', await J.evaluate(() => db.cfg.sheetOk), true);
    eq('الرابط اتشال من شريط العنوان', J.url().includes('join'), false);
    await A.click('nav button[data-go=set]'); await A.click('#shAudit'); await A.waitForTimeout(3000);
    eq('مراجعة الجهاز مع الشيت متطابقة', (await A.textContent('#modal .sync')).includes('متطابقين ('), true); await A.click('#saX');

    await A.evaluate(() => checkBackup()); 
    eq('النسخة اليومية: الشيت عمل المؤقت لوحده', [await A.evaluate(() => bkState()), sheets.acc.triggers], ['wait', ['dailyBackup']]);
    for (let i = 0; i < 32; i++) sheets.acc.ctx.dailyBackup();
    await A.evaluate(() => checkBackup());
    eq('النسخة اليومية اتعملت في فولدر Drive وبيفضل آخر 30', [await A.evaluate(() => bkState()), sheets.acc.folders.length, sheets.acc.folders[0].files.filter(f => !f.trashed).length, sheets.acc.triggers.length], ['ok', 1, 30, 1]);
    await A.click('nav button[data-go=home]'); await A.waitForTimeout(150);
    eq('مفيش تنبيه نسخة احتياطية لما اليومية شغالة', (await A.textContent('#bkRem')).trim(), '');

    console.log('\n١١) شيت دفتر الخزنة مقفول بالمفتاح');
    const C2 = await D1.page('cash.html'); await C2.click('nav button[data-go=set]');
    await C2.fill('#shUrl', CASH_URL); await C2.fill('#shKey', KEY); await C2.click('#shSave'); await C2.waitForTimeout(300);
    await C2.click('#shHelp'); await C2.click('#hpCopy'); sheets.cash.load(await C2.evaluate(() => navigator.clipboard.readText())); await C2.click('#hpX');
    await C2.click('#shSave'); await C2.waitForTimeout(1500);
    eq('شيت الدفتر مقفول', JSON.parse(sheets.cash.get()).ok, false);

    console.log('\n١١ب) الخزنة واحدة حتى لو الحسابات في تخزين لوحدها (أيقونة الأيفون)');
    eq('الحسابات بتتزامن مع شيت الدفتر وبتحفظ لينكه كإعداد مشترك', [await A.evaluate(() => cashSync(true)), await A.evaluate(() => !!getSet('cashSheet', null))], [true, true]);
    await A.evaluate(() => syncNow()); await A.waitForTimeout(1200);
    await B.evaluate(() => syncNow()); await B.waitForTimeout(3500);
    eq('جهاز الحسابات التاني خد ربط الدفتر لوحده ونفس رصيد الخزنة', [await B.evaluate(() => !!cashCreds()), await B.evaluate(() => vaultBal(''))], [true, await A.evaluate(() => vaultBal(''))]);
    const Saf = await D3.page('cash.html'); await Saf.waitForTimeout(300);
    await Saf.evaluate(([u, k]) => { db.sheetUrl = u; db.sheetKey = k; db.sheetLocked = true; saveDB(); }, [CASH_URL, KEY]);
    await Saf.evaluate(() => autoPull()); await Saf.waitForTimeout(800);
    await Saf.evaluate(() => { const c = db.cats.find(x => x.type === 'exp' && !x.del); db.tx.push({id: 't_from_ledger', type: 'exp', amt: 77, ts: Date.now(), vault: 'v_main', cat: c.id, note: 'من الدفتر', upd: Date.now(), del: false, sy: 0}); saveDB(); return syncNow(true); });
    await Saf.waitForTimeout(800);
    eq('لينك شيت الحسابات أو مفتاح غلط بيطلع رسالة واضحة', [await B.evaluate(u => connectCash(u, 'Wrong-Key-1234'), CASH_URL), await B.evaluate(([u, k]) => connectCash(u, k), [ACC_URL, KEY])],
      ['المفتاح السري مش بتاع شيت الدفتر ده. استخدم زرار "انسخ رابط الربط" من الدفتر.', 'ده لينك شيت الحسابات، مش شيت دفتر الخزنة.']);
    await Saf.click('nav button[data-go=set]'); await Saf.click('#shAcc'); const cjl = await Saf.evaluate(() => navigator.clipboard.readText());
    eq('رابط الربط من الدفتر بيتقري في الحسابات', await B.evaluate(t => { const o = parseCashJoin(t); return !!(o && o.u && o.k); }, cjl), true);
    const vB0 = await B.evaluate(() => vaultBal(''));
    await B.evaluate(() => cashSync(true)); await B.waitForTimeout(300);
    eq('مصروف من الدفتر (Safari) ظهر في الحسابات (الأيقونة)', [await B.evaluate(() => !!IDX.tx.get('t_from_ledger')), await B.evaluate(() => vaultBal(''))], [true, vB0 - 7700]);
    await B.evaluate(() => { const now = Date.now(); const r = {id: 't_from_app', type: 'exp', amt: 3300, vault: 'v_main', to: '', cat: 'c_exp0', note: 'من الحسابات', date: todayISO(), at: now, upd: now, del: false, hist: []}; db.txs.push(r); IDX.tx.set(r.id, r); saveDB(); });
    await B.evaluate(() => cashSync(true)); await B.waitForTimeout(300);
    await Saf.evaluate(() => autoPull()); await Saf.waitForTimeout(500);
    eq('مصروف من الحسابات ظهر في الدفتر', await Saf.evaluate(() => !!db.tx.find(t => t.id === 't_from_app' && !t.del)), true);

    console.log('\n١٢) الشركاء: مرتب كل خميس ومسحوبات');
    await A.evaluate(() => cashSync(true));   // ياخد اللي اتسجل في الدفتر من الجهاز التاني الأول
    const vb0 = await A.evaluate(() => vaultBal(''));
    await A.click('nav button[data-go=part]'); await A.click('#psGo'); await A.fill('#psA', '10');
    await A.fill('#psS', await A.evaluate(() => addDays(lastThu(), -14))); await A.click('#psOk'); await A.waitForTimeout(200);
    const autoN = X => X.evaluate(() => db.txs.filter(t => t.id.startsWith('t_ps_') && !t.del).length);
    eq('اتسجل مرتب 3 خميسات لـ 3 شركاء بتواريخ الخميس', [await autoN(A), await A.evaluate(() => db.txs.filter(t => t.auto).every(t => dowOf(t.date) === 4)), await A.evaluate(() => vaultBal(''))], [9, true, vb0 - 9000]);
    eq('التشغيل تاني مبيكررش', await A.evaluate(() => autoPartners(true)), 0);
    await A.evaluate(() => syncNow()); await B.evaluate(() => syncNow()); await B.waitForTimeout(1500);
    eq('الجهاز التاني مسجلش تاني', [await B.evaluate(() => autoPartners(true)), await autoN(B)], [0, 9]);
    await A.click('#p-part .cm'); await A.click('#ptDel'); await A.click('#cOk'); await A.waitForTimeout(150);
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
    eq('البحث بالصنف وبالمبلغ', SR, [3, 'فاتورة بيع رقم 3 — عميل تجربة واحد', 1, 0]);
    await A.click('#bSearch'); await A.fill('#saQ', 'سلفة'); await A.waitForTimeout(400);
    eq('البحث في الحركات', (await A.textContent('#saR')).includes('مسحوبات الشركاء'), true); await A.click('#saX2');

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

    console.log('\n١٥) المراجعة الداخلية');
    eq('مفيش أي مشكلة في المراجعة', await A.evaluate(() => selfCheck()), []);
    eq('مفيش أخطاء في الصفحات', D1.errs.concat(D2.errs), []);
  } catch (e) { fails++; console.log('  ✖ الاختبار وقف:', e.message.split('\n').slice(0, 6).join(' | ')); }
  await browser.close(); srv.close();
  console.log(`\n${fails ? '✖' : '✔'} ${oks} نجح، ${fails} فشل\n`);
  process.exit(fails ? 1 : 0);
})();
