/*
  اختبار السرعة: حسابات تجريبية كبيرة (أكبر من الشغل الحقيقي بكتير) على معالج أبطأ 4 مرات زي الموبايل،
  وبيقيس وقت أهم الحاجات (فتح البرنامج، الحفظ، فحص البيانات، القوايم والكشف والخزنة والتقارير).
  لو أي حاجة عدّت الحد بيفشل، علشان أي تعديل يبطّأ البرنامج يتمسك قبل ما يوصل الموبايل (زي فحص البيانات 19/10/2026: كان 7 ثواني).
  التشغيل:  node tests/speed.js        (حوالي نص دقيقة، و--changed في run.js بيشغّله لوحده لما الحسابات أو lib تتغير)
  بيانات تجريبية بس، مفيهاش أي اسم عميل حقيقي.
*/
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.PW_CHROMIUM || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
const PASS = '246810';
const SLOW = 4;                         // المعالج أبطأ كام مرة (الموبايل المتوسط)
const LIMIT = +process.env.SPEED_LIMIT || 4000;   // أقصى وقت لأي حاجة (ملّي ثانية على المعالج البطيء)، حوالي 3 أضعاف وقتها دلوقتي علشان جهاز GitHub ممكن يبقى أبطأ
const OPEN_LIMIT = 8000;   // الفتح: فك تشفير الحسابات كلها مرة واحدة (~3.6 ثانية هنا للحجم ده، يعني حوالي ثانية على الموبايل)
const SIZE = {parties: 300, entries: 30000, txs: 8000};
const T00 = Date.now();

const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml'};
const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, {'Content-Type': types[path.extname(f)] || 'application/octet-stream'}); r.end(fs.readFileSync(f));
});

(async () => {
  await new Promise(r => srv.listen(0, r));
  const base = 'http://localhost:' + srv.address().port;
  const browser = await pw.chromium.launch(CHROME ? {executablePath: CHROME} : {});
  const ctx = await browser.newContext({viewport: {width: 400, height: 860}});
  await ctx.route(/^https:/, r => r.abort());   // مفيش نت: الشيت وتليجرام وGitHub برّه الاختبار ده
  const A = await ctx.newPage(), errs = [];
  A.on('pageerror', e => errs.push(e.message));
  const navs = []; A.on('framenavigated', f => { if (f === A.mainFrame()) navs.push(((Date.now() - T00) / 1000).toFixed(1) + ' ' + f.url().replace(base, '')); });   // لو وقف: مين عمل تحميل للصفحة
  global.__navs = navs;
  await A.goto(base + '/accounts.html');
  await A.fill('#suP', PASS); await A.fill('#suP2', PASS); await A.click('#suGo');
  await A.waitForSelector('#lock', {state: 'hidden'});

  /* البيانات التجريبية: عملا وموردين، فواتير بأصناف ودفعات على الخزن، ومصاريف، من 2023 لحد النهارده */
  const info = await A.evaluate(async S => {
    ensureVaults();
    const vs = ['v_main', 'v_sp1', 'v_sp2'];
    db.vaults.push({id: 'v_sp1', name: 'خزنة تجربة ١', open: 0, ord: 1, upd: 1, del: false}, {id: 'v_sp2', name: 'خزنة تجربة ٢', open: 0, ord: 2, upd: 1, del: false});
    const days = Math.max(1, Math.round((Date.now() - Date.UTC(2023, 0, 1)) / 864e5));
    const ds = i => new Date(Date.UTC(2023, 0, 1) + (i % days) * 864e5).toISOString().slice(0, 10);
    for (let i = 0; i < S.parties; i++) db.parties.push({id: 'p_sp' + i, name: (i % 6 ? 'عميل سرعة ' : 'مورد سرعة ') + i, sec: i % 6 ? (i % 2 ? 'mkt' : 'site') : 'sup', upd: 1, at: 1, del: false});
    const exp = db.cats.filter(c => c.type === 'exp').map(c => c.id);
    let at = Date.UTC(2023, 0, 1);
    for (let i = 0; i < S.entries; i++) {
      const pi = i % S.parties, sup = !(pi % 6), date = ds(Math.floor(i * days / S.entries)), id = 'e_sp' + i; at += 60000;
      if (i % 3) {
        const lines = [{name: 'صنف تجربة ' + (i % 40), unit: 'لفة', qty: 1 + i % 9, price: 5000 + i % 700}, {name: 'صنف تجربة ' + (i % 13), unit: 'كيلو', qty: 2.5, price: 8000}];
        const tot = Math.round(lines.reduce((s, l) => s + l.qty * l.price, 0));
        db.entries.push(sup ? {id, party: 'p_sp' + pi, kind: 'pur', date, lines, dr: 0, cr: tot, at, upd: at, del: false, hist: []} : {id, party: 'p_sp' + pi, kind: 'inv', date, lines, dr: tot, cr: 0, at, upd: at, del: false, hist: i % 10 ? [] : [{dr: tot - 100, upd: at - 1}]});
      } else {
        const amt = 20000 + i % 5000;
        db.entries.push(sup ? {id, party: 'p_sp' + pi, kind: 'ppay', date, amt, dr: amt, cr: 0, vault: vs[i % 3], at, upd: at, del: false, hist: [], desc: 'دفعة'} : {id, party: 'p_sp' + pi, kind: 'pay', date, amt, dr: 0, cr: amt, vault: vs[i % 3], at, upd: at, del: false, hist: [], desc: 'دفعة'});
      }
    }
    for (let i = 0; i < S.txs; i++) db.txs.push({id: 't_sp' + i, type: i % 4 ? 'exp' : 'inc', amt: 1000 + i % 900, vault: vs[i % 3], cat: i % 4 ? exp[i % exp.length] : 'c_inc2', date: ds(Math.floor(i * days / S.txs)), at: Date.UTC(2023, 0, 1) + i * 1e5, upd: 1, del: false});
    reindex(); await flushSave();
    await drLoad();
    return {mb: +(JSON.stringify(db).length / 1e6).toFixed(1), n: db.entries.length + db.txs.length};
  }, SIZE);
  console.log(`حسابات تجريبية: ${SIZE.parties} حساب و${info.n} حركة (${info.mb} ميجا)، والمعالج أبطأ ${SLOW} مرات\n`);

  const cdp = await ctx.newCDPSession(A);
  await cdp.send('Emulation.setCPUThrottlingRate', {rate: SLOW});

  /* كل حاجة بتتقاس مرتين وبناخد الأقل (علشان لحظة زحمة في الجهاز متفشّلش الاختبار) */
  const R = [];
  const measure = async (name, code, arg) => {
    global.__step = name;
    let best = Infinity;
    for (let k = 0; k < 2; k++) best = Math.min(best, await A.evaluate(async ([c, a]) => { const f = (0, eval)(c); const t = performance.now(); await f(a); return performance.now() - t; }, [code, arg]));
    R.push([name, Math.round(best)]);
  };
  const pg = h => `async () => { history.replaceState(null, '', '#${h}'); route(); }`;
  const big = await A.evaluate(() => { const n = new Map(); db.entries.forEach(e => n.set(e.party, (n.get(e.party) || 0) + 1)); return [...n].sort((a, b) => b[1] - a[1])[0][0]; });

  await measure('الحفظ (تشفير الحسابات كلها)', 'async () => { saveDB(); await flushSave(); }');
  await measure('فحص البيانات بعد الحفظ', 'async () => { await docRun(false); }');
  await measure('قايمة العملا', pg('home'));
  await measure('كشف حساب عميل كبير', pg('p/' + big));
  await measure('الخزنة', pg('cash'));
  await measure('التقارير', pg('rep'));
  await measure('مكسب البضاعة بالفاتورة (سنة)', `async () => { repKind = 'gm'; repGmKind = 'doc'; repMode = 'year'; history.replaceState(null, '', '#rep'); route(); }`);
  await measure('نافذة تكلفة الأصناف (ومصنعية الكيلو لوحدها)', 'async () => { costModal(); closeModal(); }');
  await measure('الإعدادات', pg('set'));

  /* فتح البرنامج: من بعد كلمة السر لحد ما القايمة تظهر (فيها فك التشفير، وده ثابت ومقصود علشان الأمان) */
  let open = Infinity; global.__step = 'الفتح';
  for (let k = 0; k < 2; k++) {
    await A.reload(); await A.waitForSelector('#lkP');
    await A.fill('#lkP', PASS);
    open = Math.min(open, await A.evaluate(() => new Promise(res => {
      const t = performance.now();
      new MutationObserver((m, o) => { if (getComputedStyle($('#lock')).display === 'none') { o.disconnect(); res(performance.now() - t); } }).observe(document.body, {attributes: true, subtree: true, childList: true});
      $('#lkGo').click();
    })));
  }
  /* كلمة السر نفسها (deriveKey، 250 ألف لفة) وقت ثابت مقصود للأمان ومبيكبرش مع الحسابات، فبيتشال من وقت الفتح */
  const kdf = await A.evaluate(async () => { const t = performance.now(); await deriveKey('x', new Uint8Array(16)); return performance.now() - t; });
  R.push(['فتح البرنامج بكلمة السر (من غير وقت كلمة السر الثابت ' + (kdf / 1000).toFixed(1) + ' ثانية)', Math.round(open - kdf), OPEN_LIMIT]);
  let fails = 0;
  for (const [n, ms, lim = LIMIT] of R) { const ok = ms <= lim; if (!ok) fails++; console.log(`  ${ok ? '✔' : '✖'} ${n}: ${(ms / 1000).toFixed(2)} ثانية${ok ? '' : ` (الحد ${lim / 1000} ثانية)`}`); }
  if (errs.length) { fails++; console.log('  ✖ أخطاء في الصفحة:', errs.slice(0, 3).join(' | ')); }
  await browser.close(); srv.close();
  console.log(fails ? `\n✖ ${fails} حاجة أبطأ من الحد` : '\n✔ كله أسرع من الحد');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('✖ اختبار السرعة وقف:', e.message, '|', (e.stack || '').split('\n').filter(l => /speed\.js/.test(l)).slice(0, 2).join(' | '), '| تحميل الصفحة:', (global.__navs || []).join(' , '), '| مرحلة:', global.__step || ''); process.exit(1); });
