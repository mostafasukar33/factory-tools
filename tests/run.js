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

/* للاختبار sw.js: down = النت مقطوع، slow[ملف] = الملف بيتأخر (ملّي)، body[ملف] = نسخة جديدة اترفعت من الملف */
const SRV = {down: false, slow: {}, body: {}};
function serve() {
  const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'};
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      if (SRV.down) return q.socket.destroy();
      const rel = path.relative(ROOT, f).split(path.sep).join('/'), send = () => {
        r.writeHead(200, {'Content-Type': types[path.extname(f)] || 'application/octet-stream'});
        if (rel in SRV.body) r.end(SRV.body[rel]); else fs.createReadStream(f).pipe(r);
      };
      if (SRV.slow[rel]) setTimeout(send, SRV.slow[rel]); else send();
    }).listen(0, () => res(srv));
  });
}

async function newDevice(browser, base, sheets) {
  const ctx = await browser.newContext({viewport: {width: 400, height: 860}, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write']});
  ctx.errs = [];
  await ctx.addInitScript(TRACKER);
  ctx.on('page', p => { p.settle = settle; });
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
  ctx.page = async url => { const p = await ctx.newPage(); await p.addInitScript(v => { window.__tkOff0 = v; }, OFF); p.on('pageerror', e => (ctx.errs.push(e.message), process.env.DBG && console.log('PAGEERR', e.message))); p.on('crash', () => process.env.DBG && console.log('CRASH')); p.on('close', () => process.env.DBG && console.log('PAGE CLOSED')); p.on('console', m => { if (process.env.DBG && m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 120)); }); p.on('framenavigated', f => { if (process.env.DBG && f === p.mainFrame()) console.log('NAV', new Date().toISOString().slice(14, 23), f.url().slice(0, 80)); }); await p.goto(base + url); return p; };
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
const openParty = async (A, name) => { await A.evaluate(n => go('p/' + liveParties().find(x => x.name === n).id), name); await A.settle(150); };

/* ====================== أنهي أقسام تتشغل ======================
   node tests/run.js              → كله
   node tests/run.js --changed    → بيختار لوحده من الملفات اللي اتغيرت عن origin/main (الطريقة العادية)
   node tests/run.js --only=mkt   → حركة السوق: ١ و٢ وأول ١٠ و١٦–٢٢ (زي MARKET_ONLY=1 القديم)
   node tests/run.js --only=acc   → كل حاجة ما عدا السوق (١–١٤): الحسابات والدفتر والـPDF والمزامنة
   node tests/run.js --only=smoke → ١ و٢ + كل الصفحات بتفتح من غير أخطاء (لتعديلات الشكل بس)
   ممكن أكتر من واحد بفاصلة: --only=acc,mkt = كله
   --dry مع أي واحد منهم = يقول هيشغّل إيه بس */
const {execSync, spawnSync} = require('child_process');
function changedModes() {
  const sh = c => { try { return execSync(c, {cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore']}).toString(); } catch (e) { return null; } };
  const files = new Set(((sh('git diff --name-only origin/main') || '') + (sh('git ls-files --others --exclude-standard') || '')).split('\n').filter(Boolean));
  if (!files.size) { console.log('مفيش ملفات اتغيرت عن origin/main، هشغّل كله'); return ['full']; }
  const modes = new Set(), why = [];
  /* سطور accounts.html اللي اتغيرت: لو كلها جوه الـ style = شكل بس، ولو كلها في بلوك وارد السوق (آخر script) = سوق */
  const accKind = () => {
    const d = sh('git diff -U0 origin/main -- accounts.html'); if (d === null) return 'full';
    const src = fs.readFileSync(path.join(ROOT, 'accounts.html'), 'utf8').split('\n');
    const at = re => src.findIndex(l => re.test(l)) + 1;
    const stEnd = at(/^<\/style>/), mkStart = src.findIndex((l, i) => /^<script>/.test(l) && /وارد السوق/.test(src.slice(i, i + 3).join('\n'))) + 1;
    const hunks = [...d.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)].map(m => [+m[1], +m[1] + Math.max(+(m[2] ?? 1), 1) - 1]);
    if (!hunks.length) return null;
    if (hunks.every(([a, b]) => b < stEnd)) return 'smoke';
    if (mkStart > 0 && hunks.every(([a]) => a > mkStart)) return 'mkt';
    return 'full';
  };
  for (const f of files) {
    let m = null;
    if (f === 'accounts.html') m = accKind();
    else if (f === 'market.html' || f === 'market.webmanifest') m = 'mkt';
    else if (f === 'cash.html') m = 'acc';
    else if (f === 'payroll.html' || f === 'payroll.webmanifest' || f === 'tests/payroll.js') m = 'payroll';
    else if (/^(tests\/(run|gasmock)\.js|lib\/|sw\.js|fonts\/)/.test(f)) m = 'full';
    else if (/\.(html|webmanifest)$/.test(f) || /^(icons|calculator)\//.test(f)) m = 'smoke';
    if (m) { modes.add(m); why.push(`${f} → ${m}`); }
  }
  console.log('الملفات اللي اتغيرت:\n  ' + (why.join('\n  ') || 'ملفات كلام بس (md وغيره)، ملهاش اختبار'));
  return [...modes];
}
let MODES = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
if (process.env.MARKET_ONLY) MODES = ['mkt'];
if (process.argv.includes('--changed')) MODES = changedModes();
if (MODES.includes('payroll')) {
  console.log('\n— المرتبات: node tests/payroll.js —');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'payroll.js')], {stdio: 'inherit'});
  MODES = MODES.filter(m => m !== 'payroll');
  if (r.status) process.exit(r.status);
  if (!MODES.length) process.exit(0);
}
if (process.argv.includes('--changed') && !MODES.length) { console.log('\n✔ مفيش اختبار مطلوب للتغيير ده'); process.exit(0); }
if (!MODES.length || MODES.includes('full') || (MODES.includes('acc') && MODES.includes('mkt'))) MODES = ['full'];
const FULL = MODES.includes('full');
const RUN = {base: FULL || MODES.includes('acc'), sync: FULL || MODES.includes('acc') || MODES.includes('mkt'), mkt: FULL || MODES.includes('mkt'), smoke: MODES.includes('smoke')};
const MO = MODES.includes('mkt') && !FULL;   // وضع السوق لوحده (بيضيف عميل سوق تجريبي مكان اللي بيتعمل في الأقسام اللي اتخطت)
console.log('الأقسام:', FULL ? 'كله' : MODES.join(' + '));
if (process.argv.includes('--dry')) process.exit(0);   // يقول هيشغّل إيه بس من غير ما يشغّل

/* ====================== الانتظار الذكي (settle) ======================
   بدل "استنى 300 ملّي" بوقت ثابت: بنستنى لحد ما كل الصفحات المفتوحة تخلص شغلها (مؤقتات قصيرة، طلبات شيت،
   تشفير، IndexedDB، صور وسكربتات، رجوع في التاريخ، حركة الأرقام)، وبعدها فترة هدوء قصيرة.
   أقصى انتظار = الرقم المكتوب، فعمره ما يبقى أبطأ من الانتظار الثابت القديم.
   الساعة: لو رجعنا بدري، ساعة كل الصفحات (Date) بتتقدم بباقي الوقت اللي متستناش، فالبرنامج بيشوف إن الوقت
   المكتوب عدّى فعلاً (زي "دوستين ورا بعض في أقل من 700 ملّي = دوسة واحدة" و"نفس المبلغ في دقيقتين").
   كل الصفحات بتتقدم مع بعض بنفس المقدار، فترتيب الحركات بين الأجهزة زي ما هو. */
const TRACKER = `(() => {
  if (window.__tk) return;
  const T = window.__tk = {n: 0, last: 0};
  const RD = Date; let off = null;
  const getOff = () => { if (off === null) { try { off = +sessionStorage.getItem('__tkOff') || +window.__tkOff0 || 0; } catch (e) { off = +window.__tkOff0 || 0; } } return off; };
  window.__tkSetOff = v => { off = v; try { sessionStorage.setItem('__tkOff', String(v)); } catch (e) {} };
  const realNow = RD.now.bind(RD), nowFn = () => realNow() + getOff();
  let nowOv = null;   // لو الاختبار نفسه غيّر Date.now مؤقتاً (زي "بكرة")
  window.Date = new Proxy(RD, {
    construct: (t, a, nt) => Reflect.construct(t, a.length ? a : [nowFn()], nt),
    apply: () => new RD(nowFn()).toString(),
    get: (t, k) => k === 'now' ? (nowOv || nowFn) : Reflect.get(t, k),
    set: (t, k, v) => { if (k === 'now') { nowOv = v === nowFn ? null : v; return true; } return Reflect.set(t, k, v); }
  });
  const inc = () => { T.n++; T.last = performance.now(); }, dec = () => { T.n = Math.max(0, T.n - 1); T.last = performance.now(); };
  const once = () => { let d = false; return () => { if (!d) { d = true; dec(); } }; };
  const st = window.setTimeout, ct = window.clearTimeout, raf = window.requestAnimationFrame, caf = window.cancelAnimationFrame, pend = new Set(), pr = new Set();
  window.setTimeout = function (fn, ms, ...a) {
    const d = +ms || 0;
    if (typeof fn !== 'function' || d > 2500) return st.call(window, fn, ms, ...a);
    inc(); const id = st.call(window, function () { if (pend.delete(id)) dec(); return fn.apply(this, a); }, ms); pend.add(id); return id;
  };
  window.clearTimeout = function (id) { if (pend.delete(id)) dec(); return ct.call(window, id); };
  window.requestAnimationFrame = function (fn) { inc(); const id = raf.call(window, t => { if (pr.delete(id)) dec(); fn(t); }); pr.add(id); return id; };
  window.cancelAnimationFrame = function (id) { if (pr.delete(id)) dec(); return caf.call(window, id); };
  const wrapP = (obj, k) => { const f = obj && obj[k]; if (typeof f !== 'function') return; obj[k] = function (...a) { inc(); let p; try { p = f.apply(this, a); } catch (e) { dec(); throw e; } return Promise.resolve(p).finally(dec); }; };
  wrapP(window, 'fetch');
  ['text', 'json', 'blob', 'arrayBuffer'].forEach(k => wrapP(Response.prototype, k));
  if (window.crypto && crypto.subtle) ['encrypt', 'decrypt', 'deriveKey', 'deriveBits', 'importKey', 'exportKey', 'digest', 'sign', 'verify', 'generateKey'].forEach(k => {
    const f = crypto.subtle[k]; if (typeof f !== 'function') return;
    crypto.subtle[k] = (...a) => { inc(); let p; try { p = f.apply(crypto.subtle, a); } catch (e) { dec(); throw e; } return Promise.resolve(p).finally(dec); };
  });
  if (navigator.clipboard) ['writeText', 'readText', 'write', 'read'].forEach(k => wrapP(navigator.clipboard, k));
  const tx = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (...a) { const t = tx.apply(this, a); inc(); const d = once(); ['complete', 'error', 'abort'].forEach(e => t.addEventListener(e, d)); return t; };
  const op = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (...a) { const r = op.apply(this, a); inc(); const d = once(); ['success', 'error', 'blocked'].forEach(e => r.addEventListener(e, d)); return r; };
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {configurable: true, enumerable: src.enumerable, get: src.get, set(v) {
    if (v) { inc(); const d = once(); this.addEventListener('load', d, {once: true}); this.addEventListener('error', d, {once: true}); st.call(window, d, 3000); }
    src.set.call(this, v);
  }});
  const watch = el => { if (el && ((el.tagName === 'SCRIPT' && el.src) || el.tagName === 'IFRAME')) { inc(); const d = once(); el.addEventListener('load', d); el.addEventListener('error', d); st.call(window, d, 3000); } };
  const ap = Node.prototype.appendChild, ib = Node.prototype.insertBefore;
  Node.prototype.appendChild = function (el) { watch(el); return ap.call(this, el); };
  Node.prototype.insertBefore = function (el, ref) { watch(el); return ib.call(this, el, ref); };
  ['back', 'forward', 'go'].forEach(k => { const f = history[k]; history[k] = function (...a) { inc(); const d = once(); addEventListener('popstate', d, {once: true}); st.call(window, d, 400); return f.apply(history, a); }; });
})();`;
let BROWSER = null, settleCaps = 0, settleN = 0, OFF = 0;
const QUIET = 60;   // لازم الصفحات تفضل هادية المدة دي ورا بعض
async function settle(ms) {
  settleN++;
  const t0 = Date.now(), end = t0 + ms, min = t0 + Math.min(ms, 40);
  let quiet = 0;
  while (Date.now() < end) {
    let busy = false;
    for (const p of BROWSER.contexts().flatMap(c => c.pages())) {
      if (p.isClosed()) continue;
      try { if (await p.evaluate(() => !!window.__tk && (window.__tk.n > 0 || performance.now() - window.__tk.last < 25))) { busy = true; break; } }
      catch (e) { if (!p.isClosed()) { busy = true; break; } }   // الصفحة بتتنقل/بتتحمّل
    }
    if (busy) quiet = 0; else if (!quiet) quiet = Date.now(); else if (Date.now() - quiet >= QUIET && Date.now() >= min) {
      OFF += Math.max(0, ms - (Date.now() - t0));   // الوقت اللي وفّرناه: ساعة الصفحات بتتقدم بيه
      for (const p of BROWSER.contexts().flatMap(c => c.pages())) if (!p.isClosed()) await p.evaluate(v => window.__tkSetOff && window.__tkSetOff(v), OFF).catch(() => {});
      return;
    }
    await new Promise(r => setTimeout(r, 10));
  }
  settleCaps++;
}

/* وقت كل قسم بيتطبع في الآخر */
const secT = [];
const sec = name => { const n = Date.now(); if (secT.length) secT[secT.length - 1].s = (n - secT[secT.length - 1].t) / 1000; secT.push({name, t: n}); console.log('\n' + name); };
const T0 = Date.now();

(async () => {
  const srv = await serve(), base = `http://localhost:${srv.address().port}/`;
  const browser = BROWSER = await pw.chromium.launch(CHROME ? {executablePath: CHROME} : {});
  const sheets = {acc: makeGas(), cash: makeGas(), mkt: makeGas()};
  let DM = null, D2 = null, B = null;
  const D1 = await newDevice(browser, base, sheets);
  const bad = importFile(); bad.parties[0].expected = 1;
  /* خانة ملف النقل اتشالت من الإعدادات، فبنفتح شاشة النقل مباشرة */
  const openImport = (A, d) => A.evaluate(x => importModal(readImport(x)), d);
  try {
    /* أدوات الشكل (الخط والتبويبات والأرقام): متعرّفة هنا فوق علشان أقسام قبل قسم الشكل تستخدمها */
    const fs5 = X => X.evaluate(() => {
      const tok = ['--f1', '--f2', '--f3', '--f4', '--f5'].map(v => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(v)));
      const ICON = '#bSearch,#bNewParty,.dnav button,.dpk button,.dph button,.chk,.qkm .btn,#lkPad .pk,.qa2 .qb i,.fabn';
      const bad = new Set();
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('#render,svg') || el.closest(ICON)) continue;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        const f = parseFloat(getComputedStyle(el).fontSize);
        if (!tok.some(t => Math.abs(t - f) < 0.1)) bad.add(f + 'px ' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + String(el.className).trim().replace(/\s+/g, '.'));
      }
      return [tok.every(t => t > 0), [...bad].slice(0, 6)];
    });
    const segOk = (X, name) => X.evaluate(() => [...document.querySelectorAll('.seg')].filter(g => g.getClientRects().length).flatMap(g => {
      const bs = [...g.querySelectorAll('button')].filter(b => b.getClientRects().length), hs = bs.map(b => Math.round(b.getBoundingClientRect().height));
      const bad = [];
      if (Math.max(...hs) - Math.min(...hs) > 1) bad.push((g.id || 'seg') + ': ارتفاعات ' + [...new Set(hs)].join('/'));
      bs.forEach(b => { const r = document.createRange(); r.selectNodeContents(b); const tops = new Set([...r.getClientRects()].map(x => Math.round(x.top))); if (tops.size > 1 || b.scrollWidth > b.clientWidth + 1) bad.push((g.id || 'seg') + ': ' + b.textContent.trim()); });
      return bad;
    })).then(b => eq(name + ': التبويبات منظمة', b, []));
    const numCol = (X, root, sel) => X.evaluate(([root, sel]) => {
      const L = [...document.querySelectorAll(root + ' ' + sel.split(',').join(',' + root + ' '))].filter(e => e.getClientRects().length && e.textContent.trim())
        .map(e => { const g = document.createRange(); g.selectNodeContents(e); return [g.getBoundingClientRect().left, e.className + ':' + e.textContent.trim().slice(0, 12) + '@' + (e.closest('section,.list,.ctab') || {}).className + '|' + e.parentElement.className + '|' + e.parentElement.parentElement.className]; });
      const xs = L.map(x => x[0]), lo = Math.min(...xs);
      return [L.length, L.length ? Math.round(Math.max(...xs) - lo) : 0, L.filter(x => x[0] - lo > 1).slice(0, 4).map(x => Math.round(x[0] - lo) + ' ' + x[1])];
    }, [root, sel]);
    const colOk = async (name, X, root, sel) => { const [n, spread, off] = await numCol(X, root, sel); if (n < 2 && !RUN.base) return;   // --only=smoke/mkt بيتخطى إدخال البيانات (٣–٩)، فمفيش أرقام كفاية تتقارن
      eq(`${name}: الأرقام تحت بعض (${n} رقم)`, [n >= 2, spread <= 1, off], [true, true, []]); };
    sec('١) كلمة السر والتشفير');
    const A = await D1.page('accounts.html');
    await unlock(A, true);
    await A.click('#bLock'); await A.waitForSelector('#lkP'); await A.fill('#lkP', '999999'); await A.settle(2000);
    eq('كلمة سر غلط وقت الكتابة مفيهاش رسالة ولا بتفتح', [await A.textContent('#lkErr'), await A.evaluate(() => $('#lock').classList.contains('on'))], ['', true]);
    await A.click('#lkGo'); await A.settle(1500);
    eq('كلمة سر غلط بترفض', await A.textContent('#lkErr'), 'كلمة السر غلط');
    {   // لوحة الأرقام على الموبايل: دوسة عادية بتمسح رقم، ومطوّلة بتمسح ورا بعض
      const T = await D1.page('accounts.html?nobio');
      await T.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => /pointer:\s*coarse/.test(q) ? {matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}} : mm(q); });
      await T.reload(); await T.waitForSelector('#lkPad .pk');
      const val = () => T.evaluate(() => $('#lkP').value), key = k => T.click(`#lkPad [data-k="${k}"]`);
      await key('1'); await key('2'); await key('3'); await key('4'); await key('⌫');
      const tap = await val();
      await key('1'); await key('2'); await key('3');
      const bb = await T.locator('#lkPad [data-k="⌫"]').boundingBox();
      await T.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await T.mouse.down();
      await T.waitForFunction(() => $('#lkP').value === '', null, {timeout: 5000}).catch(() => {});
      const held = await val(); await T.mouse.up(); await T.settle(300);
      eq('لوحة الأرقام: ⌫ دوسة عادية بتمسح رقم، ومطوّلة بتمسح كله ورا بعض', [tap, held, await val()], ['123', '', '']);
      await T.close();
    }
    await unlock(A);

    sec('٢) نقل البيانات القديمة');
    await openImport(A, bad); await A.settle(300);
    eq('ملف فيه رصيد مش مطابق بيترفض', await A.$('#imGo'), null); await A.click('#imX');
    await openImport(A, importFile()); await A.settle(300); await A.click('#imGo'); await A.click('#cOk'); await A.settle(400);
    eq('رصيد عميل 1', await bal(A, 'عميل تجربة واحد'), 270000);
    eq('رصيد عميل 2', await bal(A, 'عميل تجربة اتنين'), 0);
    eq('رصيد المورد', await bal(A, 'مورد تجربة'), -2950000);
    await openImport(A, importFile()); await A.settle(300); await A.click('#imGo'); await A.click('#cOk'); await A.settle(400);
    eq('النقل مرتين مبيكررش', await A.evaluate(() => [db.parties.length, db.entries.length]), [3, 8]);
    const raw = await A.evaluate(async () => JSON.stringify(await idbGet('vault')));
    eq('البيانات على الجهاز متشفرة', raw.includes('عميل تجربة'), false);

    if (RUN.base) {   // ← وضع السوق (mkt) ووضع الشكل (smoke) بيتخطوا ٣ لحد ٩
    sec('٣) فاتورة ودفعة ومرتجع وخصم');
    await A.evaluate(() => go('cash')); await A.click('#cNew'); await A.click('#cOpen2'); await A.fill('#modal [data-v]', '1000'); await A.click('#opOk'); await A.settle(200);
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
    await A.click('#fbPay'); await A.fill('#pyAmt', '100'); await A.click('#pyOk'); await A.settle(150);
    eq('تنبيه الدفعة المكررة', (await A.textContent('#pyWarn')).includes('بنفس المبلغ'), true); await A.click('#pyX');

    sec('٤) الشيكات مقفولة واختيارات كشف الحساب');
    eq('مفيش زرار شيكات ولا طريقة دفع شيك', [!!(await A.$('nav button[data-go=chk]')), (await A.click('#fbPay'), !!(await A.$('#pyM button[data-v=شيك]')))], [false, false]); await A.click('#pyX');
    await A.click('#ppStmt'); await A.settle(150);
    eq('الكشف بيفتح على آخر فاتورة والرصيد قبلها', [await A.getAttribute('#smMode .on', 'data-m'), (await A.textContent('#smOut')).includes('الرصيد قبل الفاتورة')], ['last', true]);
    eq('آخر فاتورة: الرصيد قبل وبعد', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'), l = partyEntries(p.id).filter(e => e.kind === 'inv').pop(), s = stmtData(p.id, '', '', l.id); return [s.open, s.close, s.rows[0].kind || s.lastInv.kind]; }), [270000, 318500, 'inv']);
    await A.click('#smMode button[data-m=prev]'); await A.settle(100);
    eq('آخر شهر = من شهر فات لحد النهارده (مفيش حاجة بتتساب)', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'), d = new Date(); d.setMonth(d.getMonth() - 1);
      const n = partyEntries(p.id).filter(e => e.date >= isoOf(d.getTime()) && e.date <= todayISO() && e.kind !== 'open').length; return [+$('#smOut .stm div:nth-child(2) b').textContent, n]; }).then(([a, n]) => a === n && n > 0), true);
    eq('التاريخ يوم الأول على اليمين', await A.evaluate(() => dispDate('2026-02-05').replace(/\u200F/g, '|')), '05|/|02|/|2026');
    await A.click('#smX');
    eq('رابط الربط الملصوق بيتقري', await A.evaluate(() => { const o = parseJoin(' https://x/accounts.html#join=' + b64u(JSON.stringify({u: 'U', k: 'K'})) + ' '); return [o.u, o.k, parseJoin('كلام غلط')]; }), ['U', 'K', null]);

    await A.setViewportSize({width: 1300, height: 800}); await A.settle(200);
    eq('اللاب توب: الحساب مفتوح جنب القايمة', await A.evaluate(() => [$('main').classList.contains('split'), getComputedStyle($('#p-home')).display, !!$('#hList .pt.cur'), getComputedStyle($('nav')).width]), [true, 'flex', true, '184px']);
    /* زرار "احفظ نسخة" في القايمة الجانبية: بيختار المكان ويكتب ملف متشفر بكل البيانات */
    await A.evaluate(() => { window.__bkFile = null; window.showSaveFilePicker = async o => ({createWritable: async () => { let d = ''; return {write: async b => { d += await b.text(); }, close: async () => { window.__bkFile = {name: o.suggestedName, d}; }}; }}); });
    await A.click('#bBk'); await A.waitForFunction(() => window.__bkFile, null, {timeout: 10000});
    eq('اللاب: احفظ نسخة بيكتب ملف متشفر فيه كل الحسابات', await A.evaluate(async () => { const f = window.__bkFile, box = JSON.parse(f.d), d = await unseal(cryptoKey, box); return [f.name.startsWith('flash-on-accounts-'), box.app, f.d.includes('عميل تجربة'), d.entries.length === db.entries.length, d.parties.length === db.parties.length]; }), [true, 'flash-on-accounts-backup', false, true, true]);
    eq('زرار احفظ نسخة ظاهر على اللاب', await A.evaluate(() => getComputedStyle($('#bBk')).display !== 'none'), true);
    await A.setViewportSize({width: 400, height: 860}); await A.settle(200);
    eq('الموبايل: صفحة واحدة', await A.evaluate(() => [$('main').classList.contains('split'), getComputedStyle($('#p-home')).display]), [false, 'none']);
    eq('زرار احفظ نسخة مخفي على الموبايل', await A.evaluate(() => getComputedStyle($('#bBk')).display), 'none');

    sec('٥) الخزنة');
    await A.evaluate(() => go('cash')); await A.click('#cExp'); await A.fill('#txA', '30'); await A.click('#txOk'); await closed(A);
    await A.click('#cPayS'); await A.click('#pkList .pt'); await A.fill('#pyAmt', '500'); await A.click('#pyOk'); await closed(A);
    eq('مصروف 30 ودفعة مورد 500', await vbal(A, 'v_main'), 150000 - 3000 - 50000);
    eq('رصيد المورد نزل', await bal(A, 'مورد تجربة'), -2950000 + 50000);
    await A.click('#cOpen2'); await A.fill('#modal [data-v]', '960'); await A.click('#opOk'); await A.settle(200);
    eq('الجرد سجّل الفرق تسوية', await vbal(A, 'v_main'), 96000);

    sec('٦) دفعة عميل بتدخل الخزنة');
    await openParty(A, 'عميل تجربة اتنين'); await A.click('#fbPay'); await A.fill('#pyAmt', '70'); await A.click('#pyOk'); await closed(A);
    eq('الدفعة نزلت على العميل', await bal(A, 'عميل تجربة اتنين'), -7000);
    eq('ودخلت خزنة الحسابات', await vbal(A, 'v_main'), 103000);

    sec('٧) كشف الحساب PDF');
    await openParty(A, 'عميل تجربة واحد');
    eq('الزوم: مقفول على الصفحة (viewport)، ومتاح بقرص إصبعين على جدول الكشف بس', await A.evaluate(() => {
      const pt = (x, y) => new Touch({identifier: x, target: w, clientX: x, clientY: y}), w = $('.ldgw'), fire = (t, ts, el) => (el || w).dispatchEvent(new TouchEvent(t, {touches: ts, bubbles: true, cancelable: true}));
      const meta = document.querySelector('meta[name=viewport]').content, lz = () => +getComputedStyle(document.documentElement).getPropertyValue('--lz') || 1;
      fire('touchstart', [pt(100, 100), pt(200, 100)]); fire('touchmove', [pt(50, 100), pt(250, 100)]); const onTable = lz(); fire('touchend', []);
      fire('touchstart', [pt(100, 100), pt(200, 100)], document.body); fire('touchmove', [pt(50, 100), pt(250, 100)], document.body); fire('touchend', [], document.body);
      return [/user-scalable=no/.test(meta), onTable > 1.5 && onTable <= 2.5, lz() === onTable]; }), [true, true, true]);
    await A.evaluate(() => { location.hash = '#x'; history.back(); }); await A.settle(200);
    await A.click('#ppStmt');
    await A.evaluate(() => { window.__sh = null; navigator.canShare = () => true; navigator.share = d => { window.__sh = d; return Promise.resolve(); }; });
    await A.click('#smShare'); await A.waitForFunction(() => window.__sh, null, {timeout: 90000});
    eq('الواتساب: الملف بس باسم الشخص ومن غير رسالة مكتوبة', await A.evaluate(() => [Object.keys(__sh), __sh.files[0].name, __sh.files[0].type]), [['files'], 'عميل تجربة واحد.pdf', 'application/pdf']);
    await A.evaluate(() => { navigator.canShare = () => false; });
    await A.settle(300); if (!(await A.$('#smShare'))) await A.click('#ppStmt');
    await A.evaluate(() => { window.__dn = ''; const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dn = this.download; return o.call(this); }; });
    const [dl] = await Promise.all([A.waitForEvent('download', {timeout: 90000}), A.click('#smShare')]);
    eq('لو الجهاز مبيدعمش المشاركة الملف بينزل باسم الشخص', await A.evaluate(() => __dn), 'عميل تجربة واحد.pdf');
    const pdf = fs.readFileSync(await dl.path());
    eq('الـ PDF اتعمل', pdf.slice(0, 4).toString(), '%PDF');
    /* آخر فاتورة بس: بنودها والإجمالي من غير الرصيد اللي قبلها، والكشف زي ما هو */
    await A.evaluate(() => closeModal()); await A.click('#ppStmt'); await A.settle(150);
    eq('الكشف لسه بيفتح على آخر فاتورة بالرصيد اللي قبلها', [await A.getAttribute('#smMode .on', 'data-m'), (await A.textContent('#smOut')).includes('الرصيد قبل الفاتورة')], ['last', true]);
    await A.click('#smInv'); await A.settle(150);
    eq('آخر فاتورة بس: إجماليها = إجمالي آخر فاتورة', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'), l = partyEntries(p.id).filter(e => e.kind === 'inv').pop(); return $('#modal .stm .k b').textContent === fmtP(docTotal(l)); }), true);
    eq('صفحة الفاتورة: من غير رصيد سابق ولا دفعات ولا عمود رصيد', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'), l = partyEntries(p.id).filter(e => e.kind === 'inv').pop();
      const pg = buildStmtPages(p, invOnlyData(p, l))[0], r = [pg.querySelector('h3').textContent, pg.querySelectorAll('thead th').length, pg.querySelectorAll('tbody tr').length === rowsOf(l).length, !pg.textContent.includes('الرصيد قبل'), !pg.textContent.includes('دفعة'), pg.querySelector('.sum b').textContent.includes(fmtP(docTotal(l)))]; $('#render').innerHTML = ''; return r; }), ['فاتورة', 5, true, true, true, true]);
    await A.evaluate(() => { window.__sh = null; navigator.canShare = () => true; navigator.share = d => { window.__sh = d; return Promise.resolve(); }; });
    await A.click('#ivShare'); await A.waitForFunction(() => window.__sh, null, {timeout: 90000});
    eq('واتساب الفاتورة: الملف بس واسمه "فاتورة" + اسم الشخص', await A.evaluate(() => [Object.keys(__sh), __sh.files[0].name]), [['files'], 'فاتورة عميل تجربة واحد.pdf']);

    sec('٧ب) نقل فواتير الحساب الفرعي لحسابه الأساسي (زي الهاشمية قنا)');
    await A.evaluate(() => closeModal());
    const [fwM, fwS] = await A.evaluate(() => { const now = Date.now(), mk = (name, noTot) => { const p = {id: newId('p_'), sec: 'site', name, phone: '', note: '', noTot, at: now, upd: now, del: false}; db.parties.push(p); P.set(p.id, p); return p.id; };
      const m = mk('حساب أساسي تجربة', false), s = mk('فرع تجربة', true); P.get(s).fwd = m; saveDB(); return [m, s]; });
    await A.evaluate(id => go('p/' + id), fwS); await A.settle(200);
    await A.click('#fbDoc'); await A.fill('.li [data-f=name]', 'صنف فرع تجربة'); await A.fill('.li [data-f=qty]', '2'); await A.fill('.li [data-f=price]', '100'); await A.click('#dcOk'); await closed(A); await A.settle(200);
    const fwInv = await A.evaluate(id => partyEntries(id).find(e => e.kind === 'inv').id, fwS);
    eq('الفرعي: شريط "لسه 1" وعلامة "لسه متنقلتش" على الفاتورة، والأساسي لسه صفر', [(await A.textContent('.fwbar')).includes('لسه: 1'), (await A.textContent('#p-party .ldg')).includes('⏳ متنقلتش'), await A.evaluate(id => balance(id), fwM)], [true, true, 0]);
    await A.click('#fwAll'); await A.click('#cOk'); await A.settle(300);
    eq('بعد النقل: الفاتورة كاملة في الأساسي، وفاضلة في الفرعي بعلامة "اتنقلت"', await A.evaluate(([m, s, id]) => { const c = E.get('e_fw_' + id); return [balance(m), balance(s), c.lines[0].name, c.party === m, fwState(E.get(id)), $('.fwbar').textContent.includes('اتنقلت: 1'), $('#p-party .ldg').textContent.includes('✓ اتنقلت'), !$('#fwAll')]; }, [fwM, fwS, fwInv]), [20000, 20000, 'صنف فرع تجربة', true, 'ok', true, true, true]);
    eq('الفرعي برا الإجماليات والأساسي جواها (مفيش حساب مرتين)', await A.evaluate(([m, s]) => { const b = allBalances(); return [P.get(s).noTot, b.get(m)]; }, [fwM, fwS]), [true, 20000]);
    await A.evaluate(id => openEntry(P.get(E.get(id).party), E.get(id)), fwInv); await A.settle(150);
    eq('جوه الفاتورة: مكتوب إنها اتنقلت', (await A.textContent('#modal .fwbox')).includes('اتنقلت للحساب الأساسي'), true);
    await A.fill('.li [data-f=qty]', '3'); await A.click('#dcOk'); await closed(A); await A.settle(200);
    eq('لو الأصل اتعدل: "اتعدلت بعد النقل" والأساسي لسه بالقديم', [await A.evaluate(id => fwState(E.get(id)), fwInv), (await A.textContent('#p-party .ldg')).includes('⚠ اتعدلت'), await A.evaluate(id => balance(id), fwM)], ['chg', true, 20000]);
    await A.evaluate(id => openEntry(P.get(E.get(id).party), E.get(id)), fwInv); await A.settle(150); await A.click('#fwOne'); await A.settle(250);
    eq('"انقل التعديل": الأساسي اتعدل ومفيش نسخة مكررة', await A.evaluate(([m, id]) => [balance(m), fwState(E.get(id)), db.entries.filter(e => e.fwFrom === id).length], [fwM, fwInv]), [30000, 'ok', 1]);
    await A.evaluate(id => cancelEntry(E.get('e_fw_' + id)), fwInv); await A.settle(200);
    eq('لو اتلغت من الأساسي: ترجع "لسه متنقلتش"', await A.evaluate(([m, id]) => [balance(m), fwState(E.get(id))], [fwM, fwInv]), [0, 'no']);
    /* فاتورة كانت اتنقلت بإيده قبل الزرار: بيعرفها من التاريخ والبنود، ومبيعملش نسخة تانية */
    const [fwA, fwB, fwMan] = await A.evaluate(([m, s]) => { const mk = (party, qty, d) => { const e = addEntry({party, kind: 'inv', date: d, lines: [{name: 'صنف يدوي تجربة', unit: 'لفة', qty, price: 5000}]}); applyAmounts(e); return e.id; };
      const a = mk(s, 4, '2026-03-03'), b = mk(s, 6, '2026-03-04'), man = mk(m, 4, '2026-03-03'); mk(m, 7, '2026-03-04'); saveDB(); return [a, b, man]; }, [fwM, fwS]);
    await A.evaluate(id => go('p/' + id), fwS); await A.settle(250);
    eq('بيعرف الفاتورة المنقولة بإيده من التاريخ والبنود (واللي بنودها مختلفة لسه)', await A.evaluate(([a, b, man]) => [fwState(E.get(a)), fwState(E.get(b)), E.get(man).fwFrom === a], [fwA, fwB, fwMan]), ['ok', 'no', true]);
    const nM0 = await A.evaluate(m => partyEntries(m).filter(e => e.kind === 'inv').length, fwM);
    await A.click('#fwAll'); await A.click('#cOk'); await A.settle(300);
    eq('"انقل اللي لسه" مبيكررش اليدوية (اتنقلت بس اللي لسه)', await A.evaluate(([m, a, b]) => [partyEntries(m).filter(e => e.kind === 'inv').length, fwState(E.get(a)), fwState(E.get(b))], [fwM, fwA, fwB]), [nM0 + 2, 'ok', 'ok']);
    await A.evaluate(([a]) => { const e = E.get(a); e.lines[0].qty = 5; applyAmounts(e); touch(e); saveDB(); route(); }, [fwA]); await A.settle(200);
    eq('تعديل الأصل: "اتعدلت"، و"انقل التعديل" بيعدّل اليدوية نفسها', await A.evaluate(([s, a, man, m]) => { const st = fwState(E.get(a)); fwMove(P.get(s), E.get(a)); return [st, E.get(man).dr, db.entries.filter(x => x.fwFrom === a && !x.del).length, !E.get('e_fw_' + a)]; }, [fwS, fwA, fwMan, fwM]), ['chg', 25000, 1, true]);
    const fwC = await A.evaluate(s => { const e = addEntry({party: s, kind: 'inv', date: '2026-03-09', lines: [{name: 'صنف مكتوب مختلف', unit: 'لفة', qty: 1, price: 1000}]}); applyAmounts(e); saveDB(); return e.id; }, fwS);
    await A.evaluate(id => openEntry(P.get(E.get(id).party), E.get(id)), fwC); await A.settle(150); await A.click('#fwMk'); await A.settle(250);
    eq('"دي متنقلة بالفعل": بقت اتنقلت من غير ما تتنسخ', await A.evaluate(([m, c]) => [fwState(E.get(c)), db.entries.some(x => x.fwFrom === c), !E.get('e_fw_' + c)], [fwM, fwC]), ['ok', false, true]);
    await A.evaluate(id => openEntry(P.get(E.get(id).party), E.get(id)), fwC); await A.settle(150); await A.click('#fwUn'); await A.settle(250);
    eq('"رجّعها متنقلتش" بترجّعها', await A.evaluate(c => fwState(E.get(c)), fwC), 'no');
    /* المسح من الفرعي: المنقولة تتمسح عادي من غير تحذير والأساسي زي ما هو، واللي لسه متنقلتش تحذير مرة واحدة وقت المسح */
    const mBal = await A.evaluate(m => balance(m), fwM);
    await A.evaluate(a => { cancelEntry(E.get(a)); }, fwA); await A.settle(250);
    eq('مسح فاتورة منقولة: من غير سؤال، والأساسي زي ما هو، ومفيش تحذير فاضل', await A.evaluate(([a, m]) => [E.get(a).del, !$('#cOk'), balance(m), $('.fwbar').textContent.includes('اتلغت')], [fwA, fwM]), [true, true, mBal, false]);
    await A.evaluate(c => { cancelEntry(E.get(c)); }, fwC); await A.settle(200);
    eq('مسح فاتورة لسه متنقلتش: بيسأل الأول', [(await A.textContent('#modal')).includes('لسه متنقلتش'), await A.evaluate(c => E.get(c).del, fwC)], [true, false]);
    await A.click('#cNo'); await A.settle(150);
    eq('"إلغاء" = الفاتورة فاضلة', await A.evaluate(c => E.get(c).del, fwC), false);
    await A.evaluate(c => { cancelEntry(E.get(c)); }, fwC); await A.settle(200); await A.click('#cOk'); await A.settle(250);
    eq('"امسحها" = اتمسحت', await A.evaluate(c => E.get(c).del, fwC), true);
    const fwA2 = await A.evaluate(([s, a]) => { const o = E.get(a), e = addEntry({party: s, kind: 'inv', date: o.date, lines: JSON.parse(JSON.stringify(o.lines))}); applyAmounts(e); saveDB(); route(); return e.id; }, [fwS, fwA]); await A.settle(250);
    eq('فاتورة جديدة بنفس التاريخ والبنود بعد المسح: بتتعرف "اتنقلت" على نفس اللي في الأساسي (من غير تكرار)', await A.evaluate(([a2, m, b]) => [fwState(E.get(a2)), balance(m)], [fwA2, fwM, mBal]), ['ok', mBal]);
    await A.evaluate(([m, s]) => { [m, s].forEach(id => partyEntries(id).forEach(e => { e.del = true; e.delAt = Date.now(); touch(e); })); saveDB(); }, [fwM, fwS]);
    await openParty(A, 'عميل تجربة واحد');
    eq('باقي العملا مفيهمش الشريط ولا العلامات', [await A.$('.fwbar'), (await A.textContent('#p-party .ldg')).includes('متنقلتش')], [null, false]);
    await A.evaluate(([m, s, id]) => { const e = E.get(id); e.del = true; e.delAt = Date.now(); touch(e); [m, s].forEach(x => { P.get(x).del = true; touch(P.get(x)); }); saveDB(); }, [fwM, fwS, fwInv]);

    sec('٨) التقارير');
    await A.evaluate(() => go('rep')); await A.settle(200);
    const R = await A.evaluate(() => { repKind = 'debt'; repSide = 'mkt'; return buildReport(); });
    eq('رصيد السوق في التقرير = رصيد العميل', R.fin[1], await A.evaluate(n => fmtP(balance(liveParties().find(x => x.name === n).id)), 'عميل تجربة واحد'));
    eq('المسحوبات − المدفوعات = الرصيد', await A.evaluate(() => { const s = stmtData(liveParties().find(x => x.name === 'عميل تجربة واحد').id, '', ''); return s.tg - s.tp === s.close; }), true);
    eq('ملخص فوق كشف المورد بس', await A.evaluate(() => { const ps = liveParties(); const sup = ps.find(p => p.sec === 'sup'), cu = ps.find(p => p.sec === 'mkt');
      const a = buildStmtPages(sup, stmtData(sup.id, '', ''))[0].querySelector('.sbox'), b = buildStmtPages(cu, stmtData(cu.id, '', ''))[0].querySelector('.sbox'); $('#render').innerHTML = ''; return [!!a, !!b]; }), [true, false]);

    sec('٩) قفل الفترة');
    await A.click('#bSet:visible, nav button[data-go=set]:visible'); await A.evaluate(() => setOpenAll()); await A.fill('#sLockD', today); await A.click('#sLockGo'); await A.click('#cOk'); await A.settle(200);
    await openParty(A, 'عميل تجربة واحد'); await A.click('#fbPay'); await A.fill('#pyAmt', '1'); await A.click('#pyOk'); await A.settle(150);
    eq('مينفعش تسجل في فترة مقفولة', (await A.textContent('#toast')).includes('مقفولة'), true); await A.click('#pyX');
    await A.click('#bSet:visible, nav button[data-go=set]:visible'); await A.evaluate(() => setOpenAll()); await A.click('#sUnlock'); await A.fill('#apP', PASS); await A.click('#apOk'); await A.settle(600);

    }
    if (RUN.sync) {   // ← وضع الشكل (smoke) بيتخطى ١٠ لحد ٢٢
    sec('١٠) المزامنة مع الشيت وجهاز تاني');
    await A.click('#bSet:visible, nav button[data-go=set]:visible'); await A.evaluate(() => setOpenAll()); await A.fill('#shUrl', ACC_URL); await A.click('#sSheet details summary'); await A.fill('#shKey', KEY); await A.click('#shSave'); await A.settle(300);
    await A.click('#shHelp'); await A.click('#hpCopy'); const accCode = await A.evaluate(() => navigator.clipboard.readText()); sheets.acc.load(accCode); await A.click('#hpX');
    eq('كود الشيت مفيهوش المفتاح', accCode.includes(KEY), false);
    eq('رقم تعريف النشر بيتحول للينك', await A.evaluate(() => normSheetUrl(' AKfycbxTEST1234567890abcdefghij ')), 'https://script.google.com/macros/s/AKfycbxTEST1234567890abcdefghij/exec');
    await A.click('#shSave'); await A.settle(4000);
    eq('الشيت مقفول من غير المفتاح', JSON.parse(sheets.acc.get()).ok, false);
    eq('الشيت اتقفل على أول مفتاح', JSON.parse(sheets.acc.post(JSON.stringify({key: 'Other-Key-123', action: 'ping'}))).error, 'key');
    eq('الشيت بيرفض مفتاح غلط', JSON.parse(sheets.acc.post(JSON.stringify({key: 'x', action: 'pull'}))).error, 'key');
    D2 = await newDevice(browser, base, sheets); B = await D2.page('accounts.html');
    await unlock(B, true);
    await B.click('#bSet:visible, nav button[data-go=set]:visible'); await B.evaluate(() => setOpenAll()); await B.fill('#shUrl', ACC_URL); await B.click('#sSheet details summary'); await B.fill('#shKey', KEY); await B.click('#shSave'); await B.settle(4000);
    if (MO) await A.evaluate(() => { const now = Date.now(), p = {id: newId('p_'), sec: 'mkt', name: 'عميل ترتيب تجربة', phone: '', note: '', noTot: false, at: now, upd: now, del: false}; db.parties.push(p); P.set(p.id, p); saveDB(); });
    if (RUN.base) {   // ← وضع السوق بيتخطى باقي ١٠ لحد ١٤
    const snap = X => X.evaluate(() => [liveParties().map(p => balance(p.id)).sort(), vaultBal(''), selfCheck().length]);
    eq('الجهاز التاني نزل نفس الأرصدة', await snap(B), await snap(A));
    await bg(B, 'syncNow()'); await bg(A, 'syncNow()'); await A.settle(1500);
    const rows = sheets.acc.sheets['السجلات'].rows.slice(1).map(r => r[0]);
    eq('مفيش سجلات متكررة في الشيت', new Set(rows).size, rows.length);
    const link = await A.evaluate(() => joinLink());
    eq('رابط الربط مفيهوش المفتاح مكشوف', link.includes('Test-Key'), false);
    const D3 = await newDevice(browser, base, sheets), J = await D3.page('accounts.html' + link.slice(link.indexOf('#')));
    await unlock(J, true); await J.settle(5000);
    eq('جهاز جديد برابط الربط بس نزلت عليه كل الحسابات', await snap(J), await snap(A));
    eq('الجهاز الجديد فضل مربوط', await J.evaluate(() => db.cfg.sheetOk), true);
    eq('الرابط اتشال من شريط العنوان', J.url().includes('join'), false);
    await A.click('#bSet:visible, nav button[data-go=set]:visible'); await A.evaluate(() => setOpenAll()); await A.click('#shAudit'); await A.settle(3000);
    eq('مراجعة الجهاز مع الشيت متطابقة', (await A.textContent('#modal .sync')).includes('متطابقين ('), true); await A.click('#saX');

    sec('١٠ج) كود الشيت الأساسي والنسخة الاحتياطية المنفصلة، والمزامنة بدفعات');
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

    /* كود الشيت نسخة 2 قدام نسخة 1 القديمة (tests/fixtures) بآلاف السطور: نفس الطلبات = نفس الردود ونفس الشيت بالظبط، والقراية من الشيت أقل بكتير */
    const oldAcc = fs.readFileSync(path.join(__dirname, 'fixtures/acc-sheet-v1.gs'), 'utf8');
    const GN = makeGas({noDrive: true}), GO = makeGas({noDrive: true}); GN.load(mainCode); GO.load(oldAcc);
    const cost = {old: {}, neu: {}}, diff = [];
    const both = (tag, o) => {
      const b = JSON.stringify(Object.assign({key: 'Bench-Key-1234'}, o)), c0 = GO.reads.cells, c1 = GN.reads.cells;
      const a = JSON.parse(GO.post(b)), n = JSON.parse(GN.post(b));
      if (typeof n.t !== 'number' || n.t < 1e12) diff.push(tag + ': مفيش وقت الشيت t'); delete n.t; delete a.t;   // وقت الشيت (t) جديد في النسخة 3
      cost.old[tag] = (cost.old[tag] || 0) + GO.reads.cells - c0; cost.neu[tag] = (cost.neu[tag] || 0) + GN.reads.cells - c1;
      const nv = Object.assign({}, n); if (o.action === 'pull') { if (nv.v !== 3) diff.push(tag + ': مفيش v'); delete nv.v; }
      if (o.action === 'ping') { delete a.v; ['v', 'seq', 'url'].forEach(k => delete nv[k]); }   // ping الجديد بيزود النسخة ولينك الجدول بس
      if (JSON.stringify(a) !== JSON.stringify(nv)) diff.push(tag);
      return n;
    };
    const benchRow = (i, upd, del) => ({id: 'e_b' + i, kind: i % 9 ? 'entry' : 'tx', upd, del: !!del, view: ['2026-01-' + String(1 + i % 28).padStart(2, '0'), 'عميل تجربة ' + (i % 60), 'السوق', 'بيان تجربة ' + i, (i * 37 % 5000) + '.25', ''], data: {party: 'p_b' + (i % 60), dr: i * 3725, date: '2026-01-01', desc: 'حركة تجربة '.repeat(1 + i % 6), hist: []}});
    const N = 6000;
    for (let i = 0; i < N; i += 500) both('push', {action: 'push', rows: Array.from({length: 500}, (_, k) => benchRow(i + k, 1000 + i + k))});
    const pullAll = (tag, since) => { const out = []; let more = true, nx = since, pages = 0; while (more && pages++ < 50) { const j = both(tag, {action: 'pull', since: nx}); out.push(...j.rows); nx = j.next; more = j.more; } return {out, nx, pages}; };
    const full = pullAll('pull0', 0);
    const seqNow = Number(GN.props.SEQ);
    both('idle', {action: 'pull', since: seqNow});
    /* تعديلات متفرقة على الشيت كله (منها القديم اللي لازم يتجاهل، ومتكرر في نفس الدفعة) + حركات جديدة */
    const ed = [];
    for (let k = 0; k < 25; k++) ed.push(benchRow(k * 233, k % 5 ? 900000 + k : 5, k % 7 === 0));
    ed.push(benchRow(466, 900500)); ed.push(benchRow(466, 900400));
    for (let k = 0; k < 30; k++) ed.push(benchRow(N + k, 950000 + k));
    ed.push(benchRow(N + 3, 960000));
    both('push2', {action: 'push', rows: ed});
    const inc = pullAll('pull1', seqNow);
    both('ping', {action: 'ping'});
    const shOf = G => JSON.stringify(G.sheets['السجلات'].rows);
    eq('كود الشيت الجديد: بآلاف السطور نفس الردود بالظبط زي القديم، ونفس الشيت خانة بخانة، ونفس الرقم', [diff, shOf(GN) === shOf(GO), GN.props.SEQ === GO.props.SEQ, full.out.length, full.pages, inc.out.length, new Set(inc.out.map(r => r.id)).size],
      [[], true, true, N, 4, 25 - 5 + 30, 25 - 5 + 30]);
    const pp = JSON.parse(GN.post(JSON.stringify({key: 'Bench-Key-1234', action: 'ping'})));
    eq('ping الجديد بيقول النسخة 3 ولينك الجدول نفسه، والقديم نسخة 1', [pp.v, pp.url, pp.n, JSON.parse(GO.post(JSON.stringify({key: 'Bench-Key-1234', action: 'ping'}))).v], [3, 'https://docs.google.com/spreadsheets/d/ss1/edit', N + 30, 1]);
    console.log('     خانات اتقرت من الشيت (القديم ← الجديد):', Object.keys(cost.old).map(k => `${k}: ${cost.old[k]} ← ${cost.neu[k]}`).join(' | '));
    eq('السحب لو مفيش جديد مبيقراش ولا خانة، والسحب العادي والكامل والإرسال أخف بكتير', [cost.neu.idle, cost.neu.pull1 * 8 < cost.old.pull1, cost.neu.pull0 * 2 < cost.old.pull0, cost.neu.push * 2 < cost.old.push, cost.neu.push2 * 2 < cost.old.push2], [0, true, true, true, true]);

    /* جهاز بالبرنامج الجديد على شيت لسه عليه الكود القديم: بيتزامن عادي، وبيظهر تحذير أصفر وزرار التحديث بخطوات من جوه الجدول */
    const GOLD = makeGas(), accNew = sheets.acc; GOLD.load(oldAcc);
    GOLD.sheets['السجلات'] = accNew.sheets['السجلات']; Object.assign(GOLD.props, accNew.props);
    sheets.acc = GOLD;
    await A.evaluate(() => { const now = Date.now(), r = {id: 't_oldsheet', type: 'exp', amt: 700, vault: 'v_main', to: '', cat: 'c_exp0', note: 'كود قديم', date: todayISO(), at: now, upd: now, del: true, hist: []}; db.txs.push(r); IDX.tx.set(r.id, r); saveDB(); });
    await bg(A, 'syncNow()'); await A.settle(500);
    eq('شيت بالكود القديم: المزامنة شغالة عادي والتحذير الأصفر ظاهر', await A.evaluate(() => [syncErr, pendingRecs().length, db.cfg.accV, $('#syncBox').classList.contains('warn'), !!$('#syUpd')]), ['', 0, 1, true, true]);
    eq('الحركة وصلت الشيت القديم', GOLD.sheets['السجلات'].rows.some(r => r[0] === 't_oldsheet'), true);
    await A.click('#bSet:visible, nav button[data-go=set]:visible'); await A.evaluate(() => setOpenAll()); await A.settle(800);
    eq('الإعدادات: تحذير "الكود قديم" وزرار ثابت "تحديث كود شيت الحسابات"', [!!(await A.$('#accOld')), (await A.textContent('#shUpd')).includes('تحديث كود شيت الحسابات')], [true, true]);
    await A.click('#shUpd'); await A.settle(150);
    eq('خطوات التحديث من جوه الجدول: إزاي تعرفه (بدون عنوان، ورقة السجلات جنب الورقة1، العناوين) ولينك الجدول نفسه', await A.evaluate(() => { const t = $('#modal').textContent; return [t.includes('الإضافات (Extensions)'), t.includes('جدول بيانات بدون عنوان'), t.includes('السجلات') && t.includes('الورقة1') && t.includes('رقم المزامنة'), t.includes('New version'), !!$('#modal a[href*="docs.google.com/spreadsheets/d/ss1"]')]; }), [true, true, true, true, true]);
    await A.click('#auCopy'); const updCode = await A.evaluate(() => navigator.clipboard.readText()); await A.click('#auX');
    eq('زرار "انسخ الكود" بينسخ الكود الجديد نفسه (من غير أي إذن زيادة)', [updCode === mainCode, /DriveApp|ScriptApp|UrlFetchApp/.test(updCode)], [true, false]);
    accNew.sheets['السجلات'] = GOLD.sheets['السجلات']; Object.assign(accNew.props, GOLD.props); sheets.acc = accNew;   // "حدّث" الكود
    await bg(A, 'syncNow()'); await A.evaluate(() => renderSettings()); await A.settle(800);
    eq('بعد التحديث: التحذير بيختفي من الرئيسية والإعدادات', await A.evaluate(() => [db.cfg.accV, $('#syncBox').classList.contains('warn'), !!$('#accOld')]), [3, false, false]);

    const posts = [], origPost = sheets.acc.post.bind(sheets.acc);
    sheets.acc.post = body => { const q = JSON.parse(body); if (q.action === 'push') posts.push(q.rows.length); return origPost(body); };
    const addBulk = (X, n, tag) => X.evaluate(([n, tag]) => { for (let i = 0; i < n; i++) { const now = Date.now() + i; const r = {id: 't_' + tag + i, type: 'exp', amt: 100, vault: 'v_main', to: '', cat: 'c_exp0', note: tag, date: todayISO(), at: now, upd: now, del: true, hist: []}; db.txs.push(r); IDX.tx.set(r.id, r); } saveDB(); }, [n, tag]);
    await addBulk(A, 130, 'bulk'); await bg(A, 'syncNow()'); await A.settle(500);
    eq('المزامنة بتبعت دفعات 50 كحد أقصى (130 حركة)', [Math.max(...posts) <= 50, posts.reduce((a, b) => a + b, 0) >= 130, await A.evaluate(() => pendingRecs().length)], [true, true, 0]);
    sheets.acc.post = body => { const q = JSON.parse(body); return q.action === 'push' ? JSON.stringify({ok: false, error: 'boom'}) : origPost(body); };
    await addBulk(A, 3, 'fail'); await bg(A, 'syncNow()'); await A.settle(300);
    eq('ok:false: بيعرض الخطأ اللي راجع والحركات تفضل مستنية ومفيش "تمام"', await A.evaluate(() => [syncErr, pendingRecs().length >= 3, $('#syncBox').textContent.includes('✔ كل حاجة')]), ['boom', true, false]);
    let lockTry = 0;
    sheets.acc.post = body => { const q = JSON.parse(body); if (q.action === 'push' && lockTry++ < 1) return JSON.stringify({ok: false, error: 'Exception: Lock timeout: another process was holding the lock for too long.'}); return origPost(body); };
    await bg(A, 'syncNow()'); await A.settle(3500);
    eq('القفل بيستنى ويعيد بدل ما يرفض: اتبعت بعد المحاولة التانية', [lockTry >= 2, await A.evaluate(() => pendingRecs().length)], [true, 0]);
    sheets.acc.post = body => { const q = JSON.parse(body); if (q.action === 'push') return JSON.stringify({ok: true, ack: q.rows.map(r => r.id), seq: 1}); return origPost(body); };   // بيقول تمام وهو مكتبش حاجة
    await addBulk(A, 2, 'ghost'); await bg(A, 'syncNow()'); await A.settle(500);
    eq('شيت بيرد ok وهو فاضي: التطبيق يكتشف الفرق ومبيقولش تمام', await A.evaluate(() => [/الشيت فيه/.test(syncErr), pendingRecs().length > 0, $('#syncBox').textContent.includes('✔ كل حاجة')]), [true, true, false]);
    sheets.acc.post = origPost;
    await bg(A, 'syncNow()'); await A.settle(1500);
    eq('بعد ما الشيت يرجع سليم كل حاجة تتبعت وتبقى تمام', await A.evaluate(() => [syncErr, pendingRecs().length]), ['', 0]);

    sec('١٠د) خانة الشيت (50 ألف حرف) وتنبيه التعارض بين جهازين');
    eq('الشيت التجريبي بيرفض خانة أكبر من 50 ألف حرف زي جوجل', gp({action: 'push', rows: [{id: 'x2', kind: 'tx', upd: 6, view: [], data: {a: 'س'.repeat(50001)}}]}).ok, false);
    /* حركة سجل تعديلاتها كبير (90 تعديل × ~1000 حرف): لازم تتبعت والمزامنة متقفش، والجهاز يفضل شايل كل التعديلات */
    const mkTx = (X, id, o) => X.evaluate(([id, o]) => { const now = Date.now(); const r = Object.assign({id, type: 'exp', amt: 100, vault: 'v_main', to: '', cat: 'c_exp0', note: 'تجربة', date: todayISO(), at: now, upd: now, del: true, hist: []}, o); db.txs.push(r); IDX.tx.set(r.id, r); saveDB(); }, [id, o]);
    await A.evaluate(() => { const now = Date.now(); const r = {id: 't_bighist', type: 'exp', amt: 100, vault: 'v_main', to: '', cat: 'c_exp0', note: 'تعديلات كتير', date: todayISO(), at: now, upd: now, del: true,
      hist: Array.from({length: 90}, (_, i) => ({t: now - (90 - i) * 1000, date: todayISO(), desc: 'تعديل رقم ' + i + ' ' + 'ب'.repeat(1000), dr: i, cr: 0}))}; db.txs.push(r); IDX.tx.set(r.id, r); saveDB(); });
    await mkTx(A, 't_small1', {note: 'حركة عادية في نفس الدفعة'});
    await bg(A, 'syncNow()');
    const cellOf = id => { const r = sheets.acc.sheets['السجلات'].rows.find(x => x[0] === id); return r ? String(r[r.length - 1]) : ''; };
    eq('سجل تعديلات كبير: اتبعت والمزامنة مكملة، والخانة أقل من 50 ألف، والجهاز لسه فيه الـ 90 تعديل', await A.evaluate(() => [syncErr, pendingRecs().length, IDX.tx.get('t_bighist').hist.length]).then(r => r.concat([cellOf('t_bighist').length > 0 && cellOf('t_bighist').length <= 50000, !!cellOf('t_small1')])), ['', 0, 90, true, true]);
    const shH = JSON.parse(cellOf('t_bighist')).hist;
    eq('الشيت خد أحدث التعديلات (الأقدم اتقص)', [shH.length > 10 && shH.length < 90, shH[shH.length - 1].dr], [true, 89]);
    await bg(B, 'syncNow()');
    eq('الجهاز التاني نزلت عليه الحركة بأحدث التعديلات', await B.evaluate(() => { const r = IDX.tx.get('t_bighist'); return [!!r, r.hist.length < 90, r.hist[r.hist.length - 1].dr]; }), [true, true, 89]);
    await B.evaluate(() => { const t = IDX.tx.get('t_bighist'); t.hist.push({t: Date.now(), date: t.date, desc: 'تعديل من الجهاز التاني', dr: 999, cr: 0}); t.note = 'اتعدلت من التاني'; touch(t); saveDB(); });
    await bg(B, 'syncNow()'); await bg(A, 'syncNow()');
    eq('تعديل من الجهاز التاني: الأول خد التعديل ومخسرش ولا تعديل قديم', await A.evaluate(() => { const t = IDX.tx.get('t_bighist'); return [t.note, t.hist.length, t.hist[0].dr, t.hist[t.hist.length - 1].dr, syncErr]; }), ['اتعدلت من التاني', 91, 0, 999, '']);
    /* سجل أكبر من الخانة حتى من غير تعديلات (مستحيل تقريباً): ميوقفش الباقي ويتقال عليه */
    await mkTx(A, 't_huge', {note: 'ج'.repeat(60000)}); await mkTx(A, 't_small2', {note: 'بعد الكبير'});
    await bg(A, 'syncNow()'); await A.evaluate(() => { closeModal(); go('home'); });
    eq('سجل أكبر من الخانة: الباقي اتبعت عادي ومفيش خطأ، ومتعلّم ومكتوب عليه فوق', await A.evaluate(() => [syncErr, pendingRecs().length, bigRecs().map(r => r.id), $('#syncBox').textContent.includes('كبير')]).then(r => r.concat([!!cellOf('t_small2'), !cellOf('t_huge')])), ['', 0, ['t_huge'], true, true, true]);
    await A.evaluate(() => { const t = IDX.tx.get('t_huge'); t.note = 'اتصغرت'; touch(t); saveDB(); }); await bg(A, 'syncNow()');
    eq('لما يصغر بيتبعت عادي والتنبيه يروح', await A.evaluate(() => [syncErr, bigRecs().length, pendingRecs().length]).then(r => r.concat([JSON.parse(cellOf('t_huge') || '{}').note])), ['', 0, 0, 'اتصغرت']);

    /* التعارض: نفس الحركة اتعدلت على الجهازين قبل ما يتزامنوا */
    await mkTx(A, 't_cf', {amt: 100}); await bg(A, 'syncNow()'); await bg(B, 'syncNow()');
    let lastUpd = 0;   // تعديلين على جهازين في نفس الملّي ثانية بياخدوا نفس الوقت ومبيبانش تعارض (ده اللي كان بيفشّل GitHub لأنه أسرع): كل تعديل بيستنى الساعة تعدّي اللي قبله
    const setAmt = async (X, a) => { await X.waitForFunction(t => Date.now() > t, lastUpd, {polling: 1}); lastUpd = await X.evaluate(a => { srvOff = 0; const t = IDX.tx.get('t_cf'); t.amt = a; touch(t); saveDB(); return t.upd; }, a); };   // الصفحتين على نفس الجهاز: نثبّت فرق الساعة علشان الترتيب بين تعديلين متقاربين ميتهزّش بفروق ملّي ثانية
    await B.evaluate(() => { closeModal(); go('home'); }); await A.evaluate(() => { closeModal(); go('home'); });
    await setAmt(A, 11100); await bg(A, 'syncNow()');
    await setAmt(B, 22200); await bg(B, 'syncNow()');
    eq('تعارض: الجهاز التاني طلّع تنبيه "تعارض" فيه التعديلين، والأحدث (بتاعه) اتحفظ', await B.evaluate(() => { const c = db.cfg.clash[0]; return [c.id, c.here, c.mine.includes('222'), c.theirs.includes('111'), $('#modal').textContent.includes('تعارض'), IDX.tx.get('t_cf').amt, pendingRecs().length]; }), ['t_cf', true, true, true, true, 22200, 0]);
    await B.click('#clX');
    eq('بعد "تمام، شفته" التنبيه بيروح من فوق', await B.evaluate(() => [$('#mask').classList.contains('on'), $('#syncBox').textContent.includes('تعارض'), db.cfg.clash[0].seen]), [false, false, true]);
    await setAmt(A, 33300); await setAmt(B, 44400); await bg(B, 'syncNow()'); await bg(A, 'syncNow()');
    eq('تعارض والتاني أحدث: الجهاز ده عرف إن تعديله اتلغى، والاتنين على نفس الرقم', [await A.evaluate(() => { const c = db.cfg.clash[0]; return [c.here, c.mine.includes('333'), c.theirs.includes('444'), IDX.tx.get('t_cf').amt]; }), await B.evaluate(() => IDX.tx.get('t_cf').amt)], [[false, true, true, 44400], 44400]);
    await A.evaluate(() => { closeModal(); db.cfg.clash.forEach(c => c.seen = true); renderSyncBox(); });
    const nCl = X => X.evaluate(() => (db.cfg.clash || []).length);
    const cl0 = [await nCl(A), await nCl(B)];
    await setAmt(A, 55500); await bg(A, 'syncNow()'); await bg(B, 'syncNow()');
    await setAmt(B, 66600); await setAmt(A, 66600); await bg(B, 'syncNow()'); await bg(A, 'syncNow()');
    eq('مفيش تعارض غلط: تعديل عادي بعد مزامنة، أو نفس التعديل على الجهازين', [await nCl(A), await nCl(B), await A.evaluate(() => IDX.tx.get('t_cf').amt), await B.evaluate(() => IDX.tx.get('t_cf').amt)], cl0.concat([66600, 66600]));

    sec('١٠ب) رابط الربط مع نت بيقطع أو صفحة بتتعمل لها ريفرش');
    const D4 = await newDevice(browser, base, sheets); D4.netDown = true;
    const J2 = await D4.page('accounts.html' + link.slice(link.indexOf('#')));
    await J2.fill('#suP', PASS); await J2.fill('#suP2', PASS);
    await J2.reload(); await J2.waitForSelector('#suP');   // ريفرش قبل كلمة السر: الرابط لازم ميضيعش
    await J2.fill('#suP', PASS); await J2.fill('#suP2', PASS); await J2.click('#suGo'); await J2.settle(9000);
    eq('النت واقع وقت الربط: الربط محفوظ ومستني وبيقول السبب', await J2.evaluate(() => [db.cfg.joinWait, db.cfg.sheetOk, !!db.cfg.sheetUrl, joinErr.length > 5]), [true, false, true, true]);
    D4.netDown = false;
    await bg(J2, 'finishJoin(false)'); await J2.settle(3000);
    eq('النت رجع: كمّل الربط لوحده ونزّل نفس الأرصدة', [await J2.evaluate(() => [db.cfg.sheetOk, !!db.cfg.joinWait]), await snap(J2)], [[true, false], await snap(A)]);
    eq('رابط مقطوع بيطلع رسالة', await (async () => { const X = await D4.page('accounts.html#join=AAAA'); await X.settle(1200); return (await X.textContent('#toast')).includes('ناقص'); })(), true);

    sec('١١ب) دفتر الخزنة اتشال: مفيش نسخة مكشوفة ولا ربط بشيت الدفتر');
    eq('الحفظ مبيكتبش نسخة للدفتر، ورابط الربط فيه شيت الحسابات بس، ومفيش قسم الدفتر في الإعدادات', await B.evaluate(async () => {
      saveDB(); await flushSave(); const o = JSON.parse(unb64u(joinLink().split('#join=')[1]));
      return [localStorage.getItem('fo_cash_v1'), localStorage.getItem('fo_acc_names'), Object.keys(o).sort().join(','), !!document.querySelector('#sCash')]; }), [null, null, 'k,u', false]);
    eq('النسخة القديمة اللي كل حركاتها هنا بتتمسح، ولينك شيت الدفتر بيتشال من الإعدادات المشتركة', await B.evaluate(() => {
      const t = db.txs.find(x => !x.del); localStorage.setItem('fo_cash_v1', JSON.stringify({v: 1, vaults: [], cats: [], tx: [{id: t.id}]})); localStorage.setItem('fo_acc_names', '[]');
      putSet('cashSheet', {u: 'https://script.google.com/macros/s/OLD/exec', k: 'Old-Key'}); forgetCashBook();
      return [localStorage.getItem('fo_cash_v1'), localStorage.getItem('fo_acc_names'), getSet('cashSheet', 'x'), IDX.set.get('cashSheet').val]; }), [null, null, 'x', null]);
    eq('نسخة قديمة فيها حركة مش موجودة هنا مبتتمسحش', await B.evaluate(() => {
      localStorage.setItem('fo_cash_v1', JSON.stringify({v: 1, vaults: [], cats: [], tx: [{id: 't_not_here'}]})); forgetCashBook();
      const k = !!localStorage.getItem('fo_cash_v1'); localStorage.removeItem('fo_cash_v1'); return k; }), true);
    eq('صفحة الدفتر بقت ورقة "اتقفل" فيها زرار للحسابات بس', (() => { const h = fs.readFileSync(path.join(ROOT, 'cash.html'), 'utf8');
      return [h.includes('href="accounts.html"'), /localStorage\.(setItem|removeItem)|fo_cash_v1|webmanifest/.test(h), fs.existsSync(path.join(ROOT, 'cash.webmanifest'))]; })(), [true, false, false]);
    await B.evaluate(() => { db.cats = db.cats.filter(c => c.id !== 'c_payout' && c.id !== 'c_inc0'); reindex(); lockNow(); }); await unlock(B);
    eq('الخزنة الداخلية: بندين "تحصيل من عميل" و"دفعات للموردين" بيتعملوا لوحدهم وقت الفتح زي الأول', await B.evaluate(() => [cName('c_inc0'), cName('c_payout')]), ['تحصيل من عميل', 'دفعات للموردين']);
    /* نفس المصروفين اللي كانوا بييجوا من الدفتر قبل كده، علشان أرقام الأقسام الجاية متتغيرش */
    await B.evaluate(() => { const now = Date.now(), c = catsL('exp')[0];
      [['t_from_ledger', 7700, c.id, 'من الدفتر'], ['t_from_app', 3300, 'c_exp0', 'من الحسابات']].forEach(([id, amt, cat, note]) => { const r = {id, type: 'exp', amt, vault: 'v_main', to: '', cat, note, date: todayISO(), at: now, upd: now, del: false, hist: []}; db.txs.push(r); IDX.tx.set(id, r); });
      saveDB(); });
    await bg(B, 'syncNow()');

    /* الأجهزة دي خلصت دورها: قفلها بيوقف المزامنة اللي شغالة فيها في الخلفية (كانت بتبطّأ كل الأقسام اللي بعدها) */
    await D3.close(); await D4.close();
    sec('١٢) الشركاء: مرتب كل خميس ومسحوبات');
    await bg(A, 'syncNow()');   // ياخد اللي اتسجل في الجهاز التاني الأول
    const vb0 = await A.evaluate(() => vaultBal(''));
    eq('الموبايل: حركة السوق في الشريط اللي تحت مكان الشركاء، والشركاء جوه الخزنة', await A.evaluate(() => [...document.querySelectorAll('nav button[data-go]')].filter(b => getComputedStyle(b).display !== 'none').sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(b => b.dataset.go).reverse()), ["home", "sup", "mkt", "cash"]);
    await A.evaluate(() => go('cash')); await A.click('#cPart'); await A.waitForSelector('#ptBack', {timeout: 3000}).catch(() => {});   // الصفحة بتفتح بعد تغيير العنوان
    eq('الشركاء من الخزنة: الخزنة متعلّمة تحت وفيه رجوع', [await A.evaluate(() => $('nav button.on').dataset.go), !!await A.$('#ptBack')], ['cash', true]);
    await A.click('#psGo'); await A.fill('#psA', '10');
    await A.fill('#psS', await A.evaluate(() => addDays(lastThu(), -14))); await A.click('#psOk'); await A.settle(200);
    const autoN = X => X.evaluate(() => db.txs.filter(t => t.id.startsWith('t_ps_') && !t.del).length);
    eq('اتسجل مرتب 3 خميسات لـ 3 شركاء بتواريخ الخميس', [await autoN(A), await A.evaluate(() => db.txs.filter(t => t.auto).every(t => dowOf(t.date) === 4)), await A.evaluate(() => vaultBal(''))], [9, true, vb0 - 9000]);
    eq('التشغيل تاني مبيكررش', await A.evaluate(() => autoPartners(true)), 0);
    await bg(A, 'syncNow()'); await bg(B, 'syncNow()'); await B.settle(1500);
    eq('الجهاز التاني مسجلش تاني', [await B.evaluate(() => autoPartners(true)), await autoN(B)], [0, 9]);
    await A.click('#p-part tr[data-i]'); await A.click('#ptDel'); await A.click('#cOk'); await A.settle(150);
    eq('المرتب الملغي مبيرجعش يتسجل', [await A.evaluate(() => autoPartners(true)), await autoN(A)], [0, 8]);
    await A.click('#ptNew'); await A.fill('#ptA', '50'); await A.fill('#ptN', 'سلفة'); await A.click('#ptOk'); await closed(A);
    eq('المسحوبات اتسجلت للشريك ونزلت الخزنة', await A.evaluate(() => [db.txs.filter(t => t.cat === 'c_pdraw' && !t.del).map(t => [partName(t.pt), t.amt, t.note]), vaultBal('')]), [[['مصطفى', 5000, 'مسحوبات مصطفى — سلفة']], vb0 - 8000 - 5000]);
    eq('بنود الشركاء مش في قايمة المصروفات العادية', await A.evaluate(() => catsL('exp').some(c => c.id === 'c_psal' || c.id === 'c_pdraw')), false);

    sec('١٣) الأرباح ولوحة النهارده والبحث');
    const PR = await A.evaluate(() => { const y = todayISO().slice(0, 4) + '-01-01', x = profitOf(y, todayISO()), ex = db.txs.filter(t => !t.del && t.type === 'exp' && !t.pt && !NOT_PL.has(t.cat) && t.date >= y).reduce((s, t) => s + t.amt, 0); return [x.sales, x.purch, x.part, x.exp === ex, x.before === x.sales - x.purch - x.exp + x.inc, x.after === x.before - x.part]; });
    eq('الأرباح: المبيعات والمشتريات والشركاء لوحدهم والربح قبل وبعد', PR, [968500, 5050000, 13000, true, true, true]);
    await A.evaluate(() => go('rep')); await A.click('#rpK button[data-v=profit]'); await A.settle(200);
    eq('تقرير الأرباح هو أول تقرير', [await A.getAttribute('#rpK .on', 'data-v'), (await A.textContent('#p-rep .ldgf')).includes('بعد الشركاء')], ['profit', true]);
    /* تقرير التحصيل: دفعات عملاء السوق والمواقع (من غير الموردين والحساب الفرعي)، أسبوعي وشهري */
    await A.evaluate(() => { const p = liveParties().find(x => x.sec === 'site'), now = Date.now();
      if (p) { const e = addEntry({id: 'e_colsite', party: p.id, kind: 'pay', amt: 33300, date: todayISO(), method: 'نقدي', vault: 'v_main', note: ''}); applyAmounts(e); saveDB(); } });
    await A.click('#rpK button[data-v=col]'); await A.settle(200);
    const CR = await A.evaluate(() => {
      const t = todayISO(), m = t.slice(0, 7), want = {mkt: 0, site: 0};
      db.entries.forEach(e => { const p = P.get(e.party); if (!e.del && e.kind === 'pay' && e.date.startsWith(m) && p && !p.noTot && want[p.sec] !== undefined) want[p.sec] += e.amt; });
      const W = buildReport(), wk = W.rows.map(r => r.cells[0]);
      repColMode = 'month'; renderReports(); const M = buildReport(), row = M.rows.find(r => r.cells[0].startsWith(AR_MONTHS[+m.slice(5) - 1]));
      repColMode = 'week'; renderReports();
      return [W.title, W.fin[1] === fmtP(want.mkt + want.site), W.sum[0][1].startsWith(fmtP(want.mkt) + ' ('), W.sum[1][1].startsWith(fmtP(want.site) + ' ('), want.site >= 33300, row && row.cells[4] === W.fin[1] && row.cells[3] === (want.mkt > want.site ? 'السوق' : want.site > want.mkt ? 'المواقع' : '—'), M.title, wk.every(n => /^من |^[^\d]/.test(n)), $('#p-rep .ldg th').textContent];
    });
    eq('تقرير التحصيل: أسبوعي = دفعات السوق والمواقع بالظبط، والشهري نفس الرقم للشهر ده', CR, ['التحصيل الأسبوعي', true, true, true, true, true, 'التحصيل الشهري', true, 'الأسبوع']);
    await A.click('nav button[data-go=home]'); await A.settle(200);
    eq('لوحة النهارده اتشالت من الرئيسية', await A.$('#hDash'), null);
    const SR = await A.evaluate(() => [searchAll('لفة تجربة').length, searchAll('1350').map(r => r.title)[0] || '', searchAll('سلفة').length, searchAll('x').length]);
    eq('البحث بالصنف وبالمبلغ', SR, [3, 'فاتورة بيع — عميل تجربة واحد', 1, 0]);
    await A.evaluate(() => go('home')); await A.settle(150); await A.click('#bSearch'); await A.click('#bSearchAll'); await A.fill('#saQ', 'سلفة'); await A.settle(400);
    eq('البحث في الحركات', (await A.textContent('#saR')).includes('مسحوبات الشركاء'), true); await A.click('#saX2'); await A.click('#bSearch');

    eq('مفيش أرقام فواتير: لا خانة ولا عرض في الكشف ولا العنوان', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'); docModal(p, 'inv'); const f = !!$('#dcNo'); closeModal();
      const e = partyEntries(p.id).find(x => x.kind === 'inv'); return [f, /رقم/.test(docTitle(e)), /رقم/.test(docDesc(e)), stmtData(p.id, '', '').rows.some(r => isDoc(r.e) && r.ref)]; }), [false, false, false, false]);
    eq('دوسة على بند في الكشف بتفتح البند لوحده وتعدّله من غير ما تلمس باقي الفاتورة', await A.evaluate(() => {
      const p = liveParties().find(x => x.name === 'عميل تجربة واحد');
      const e = partyEntries(p.id).find(x => x.kind === 'inv' && x.lines.length > 1);
      if (!e) return 'no multi-line invoice';
      const r = [ledgerTable(p).includes('data-li="1"')], tot0 = docTotal(e), l1 = JSON.stringify(e.lines[1]), l0 = e.lines[0], h0 = (e.hist || []).length;
      lineModal(p, e, 0);
      r.push(!!$('#lnName') && !$('#dcLines') && $('#lnName').value === l0.name);
      $('#lnQty').value = String(l0.qty + 1); $('#lnQty').dispatchEvent(new Event('input')); $('#lnOk').click();
      r.push(docTotal(e) === tot0 + l0.price, JSON.stringify(e.lines[1]) === l1, e.hist.length === h0 + 1);
      lineModal(p, e, 0); $('#lnQty').value = String(l0.qty); $('#lnQty').dispatchEvent(new Event('input')); $('#lnOk').click();
      r.push(docTotal(e) === tot0);
      return r; }), [true, true, true, true, true, true]);
    eq('اقتراحات الفاتورة: أصناف الحساب بسعرها القديم، والدوسة تملّي الاسم والسعر، والكتابة بتفلتر', await A.evaluate(() => {
      const p = liveParties().find(x => x.name === 'عميل تجربة واحد'); docModal(p, 'inv');
      const mine = custItems(p.id, 'inv'), n = $('#dcLines [data-f=name]'), box = $('#dcLines .sg');
      n.dispatchEvent(new Event('focus'));
      const first = box.querySelector('.sr'), shown = box.classList.contains('on'), showsPrice = first.textContent.includes(fmtP(mine[0].price));
      first.click();
      const r = [mine.length > 0, shown, showsPrice, n.value === mine[0].name, $('#dcLines [data-f=price]').value === fmtP(mine[0].price), !box.classList.contains('on')];
      n.value = 'zzzz'; n.dispatchEvent(new Event('input')); r.push(!box.classList.contains('on'));
      closeModal(); return r; }), [true, true, true, true, true, true, true]);
    const PGN = await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل تجربة واحد'); const pg = buildStmtPages(p, stmtData(p.id, '', '')); const c = pg[0].querySelectorAll('thead th').length; const fs = parseFloat(getComputedStyle(pg[0].querySelector('tbody td.l')).fontSize); $('#render').innerHTML = ''; return [c, fs >= 16]; });
    eq('كشف الـ PDF: 7 أعمدة وخط كبير', PGN, [7, true]);
    eq('كشف العميل مفيهوش "عميل سوق/مواقع"، والمورد فيه "مورد"', await A.evaluate(() => { const ps = liveParties(), c = ps.find(x => x.sec === 'mkt'), m = ps.find(x => x.sec === 'sup');
      const t = (p) => { const pg = buildStmtPages(p, stmtData(p.id, '', '')); const r = pg[0].querySelector('.cust i'); const v = r ? r.textContent : ''; $('#render').innerHTML = ''; return v; };
      return [t(c), t(m)]; }), ['', 'مورد']);
    eq('المبلغ بالحروف (تفقيط)', await A.evaluate(() => [12134000, 100, 200, 300000, 1105050, 1100000000, 0].map(moneyWords)),
      ['فقط مائة وواحد وعشرون ألفاً وثلاثمائة وأربعون جنيهاً لا غير', 'فقط جنيه واحد لا غير', 'فقط جنيهان لا غير', 'فقط ثلاثة آلاف جنيه لا غير', 'فقط أحد عشر ألفاً وخمسون جنيهاً وخمسون قرشاً لا غير', 'فقط أحد عشر مليون جنيه لا غير', 'لا يوجد رصيد مستحق']);
    eq('كشف احترافي: الفاتورة متجمعة، بيانات الشركة، المبلغ بالحروف، سطر الإصدار', await A.evaluate(() => {
      const p = liveParties().find(x => x.sec === 'mkt' && partyEntries(x.id).some(e => e.kind === 'inv' && (e.lines || []).length > 1));
      const inv = partyEntries(p.id).find(e => e.kind === 'inv' && (e.lines || []).length > 1), c = db.cfg, old = [c.coAddr, c.coCr, c.coTax];
      const run = () => { const pg = buildStmtPages(p, stmtData(p.id, '', '')), all = pg.flatMap(x => [...x.querySelectorAll('tbody tr')]); const r = {pg, all}; return r; };
      c.coAddr = c.coCr = c.coTax = ''; const a = run(), noBar = !a.pg[0].querySelector('.coi'); $('#render').innerHTML = '';
      Object.assign(c, {coAddr: 'عنوان تجربة', coCr: '111', coTax: '222'}); const {pg, all} = run();
      const bar = pg[0].querySelector('.coi').textContent, items = all.filter(tr => tr.classList.contains('it')), firsts = items.filter(tr => tr.classList.contains('f'));
      const subs = all.filter(tr => tr.classList.contains('is')), last = pg[pg.length - 1], s = stmtData(p.id, '', '');
      const r = [noBar, bar.includes('عنوان تجربة') && bar.includes('111') && bar.includes('222'), firsts.length === subs.length && subs.length > 0,
        items.filter(tr => !tr.classList.contains('f')).every(tr => !tr.cells[0].textContent && !tr.cells[6].textContent),
        subs.some(tr => tr.cells[1].textContent === 'إجمالي الفاتورة' && tr.querySelector('td.b').textContent === fmtP(s.rows.filter(x => x.e === inv).pop().run * s.sg)),
        last.querySelector('.tot .wd b').textContent === moneyWords(s.close * s.sg), /المستحق (عليكم|لكم)/.test(last.querySelector('.sum .f span').textContent),
        pg.every(x => x.querySelector('.gen').textContent.startsWith('صدر هذا الكشف إلكترونياً')), last.querySelector('.note').textContent.includes('سبعة أيام'), pg[0].querySelector('thead').textContent.includes('المدفوع')];
      [c.coAddr, c.coCr, c.coTax] = old; $('#render').innerHTML = ''; return r; }), [true, true, true, true, true, true, true, true, true, true]);
    sec('١٣ب) الجرد والمساهمين');
    eq('الموبايل: مفيش زرار جديد تحت، والجرد زرار جوه التقارير', await A.evaluate(() => { go('rep'); renderReports(); return [getComputedStyle($('nav button[data-go=jrd]')).display, !!$('#rpJrd')]; }), ['none', true]);
    await A.click('#rpJrd'); await A.waitForSelector('#jrS', {timeout: 3000});
    /* الأرقام اللي جاية لوحدها = نفس اللي بيتحسب من الحسابات والخزنة بطريقة تانية */
    eq('الجرد: العملا والموردين والخزن من الحسابات (من غير الحساب الفرعي)', await A.evaluate(() => {
      const n = jrdCalc(todayISO()), b = allBalances(), w = {mkt: 0, site: 0, sup: 0};
      b.forEach((v, id) => { const p = P.get(id); if (!p.noTot) w[p.sec] += v; });
      return [n.mkt === w.mkt, n.site === w.site, n.sup === -w.sup, n.vault === vaultBal(''), !!$('#jrBack')]; }), [true, true, true, true, true]);
    await A.fill('#jrS', '1000'); await A.settle(100);
    const J1 = await A.evaluate(() => { const n = jrdCalc(todayISO()), T = jrdTot(n, 100000); return [$('#jrStockV').textContent, $('#jrNet').textContent.trim().startsWith(fmtP(T.net)), T.net === n.mkt + n.site + n.vault + 100000 - n.sup]; });
    eq('المخزون بيتكتب مبلغ والصافي بيتحسب على طول', J1, ['1,000', true, true]);
    await A.click('#jrSave'); await A.settle(200);
    eq('الجرد اتحفظ بأرقامه', await A.evaluate(() => { const s = jrdSaved(); return [s.length, s[0].stock, s[0].date === todayISO(), !!$('#p-jrd tr[data-s]')]; }), [1, 100000, true, true]);
    await A.click('#jrSave'); await A.settle(200);
    eq('حفظ نفس اليوم تاني بيحدّث نفس الجرد مش جرد جديد', await A.evaluate(() => jrdSaved().length), 1);

    /* مساهم شهري: رأس مال من غير خزنة، وسحب من الخزنة مش مصروف */
    const vb1 = await vbal(A), pf0 = await A.evaluate(() => profitOf(todayISO().slice(0, 4) + '-01-01', todayISO()));
    await A.evaluate(() => go('jrd/iv')); await A.waitForSelector('#ivNew', {timeout: 3000});
    await A.click('#ivNew'); await A.fill('#ipN', 'مساهم تجربة شهري'); await A.fill('#ipA', '100000'); await A.click('#ipOk'); await A.waitForSelector('#ivDraw', {timeout: 3000});
    const IV1 = () => A.evaluate(() => ivList().find(v => v.name === 'مساهم تجربة شهري'));
    eq('رأس المال الأول مبيلمسش الخزنة', [await A.evaluate(id => ivSums(id).bal, (await IV1()).id), await vbal(A)], [10000000, vb1]);
    await A.click('#ivDraw'); await A.fill('#imA', '500'); await A.click('#imOk'); await closed(A);
    const pf1 = await A.evaluate(() => profitOf(todayISO().slice(0, 4) + '-01-01', todayISO()));
    eq('السحب من الخزنة: الخزنة نقصت والرصيد قل، ومش مصروف في الأرباح', [await vbal(A), await A.evaluate(id => ivSums(id).bal, (await IV1()).id), pf1.exp === pf0.exp, pf1.after === pf0.after, await A.evaluate(() => catsL('exp').some(c => c.id === 'c_ivdraw'))], [vb1 - 50000, 9950000, true, true, false]);
    eq('السحب ظاهر في الخزنة وبيتفتح في نافذة المساهم', await A.evaluate(() => { const t = db.txs.find(x => x.iv && !x.del); ivTxModal(t); const ok = !!$('#imOk') && $('#imA').value === '500'; closeModal(); return [!!t, ok]; }), [true, true]);
    /* ربح الشهر: الاقتراح من الشهور اللي فاتت */
    const SG = await A.evaluate(() => {
      const v = ivList().find(x => x.name === 'مساهم تجربة شهري'), t = todayISO(), m1 = t.slice(0, 7), [y, mo] = m1.split('-').map(Number), d = new Date(y, mo, 1), m2 = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      const before = ivSuggest(v, m2), now = Date.now(), r = {id: newId('ir_'), iv: v.id, k: 'prof', m: m1, amt: 300000, date: t, note: '', at: now, upd: now, del: false, hist: []};
      db.ivrs.push(r); IDX.ivr.set(r.id, r);
      const s = ivSuggest(v, m2), p1 = profitOf(...monthRange(m1)).before, p2 = profitOf(...monthRange(m2)).before, f = p1 > 0 && p2 > 0 ? Math.min(2, Math.max(.5, p2 / p1)) : 1;
      const want = Math.round(300000 / 10000000 * ivSums(v.id).cap * f / 10000) * 10000;
      r.del = true; touch(r);
      return [before, !!s && s.amt === want, !!s && s.why.includes('%')]; });
    eq('اقتراح ربح الشهر: مفيش من غير تاريخ، وبعده نفس نسبة رأس المال × حركة الشغل', SG, [null, true, true]);
    eq('الربح الشهري بيتخصم في تقرير الأرباح، والشهر مبيتكررش', await A.evaluate(() => {
      const v = ivList().find(x => x.name === 'مساهم تجربة شهري'), t = todayISO();
      ivMoveModal(v, 'prof'); $('#imM').value = t.slice(0, 7); $('#imA').value = '200'; $('#imD').value = t; $('#imOk').click();
      const x = profitOf(t.slice(0, 7) + '-01', t);
      ivMoveModal(v, 'prof'); $('#imM').value = t.slice(0, 7); $('#imA').value = '50'; $('#imD').value = t; $('#imOk').click(); const dup = !!$('#imOk'); closeModal();
      return [x.iv >= 20000, x.after === x.before - x.part - x.iv, dup, db.ivrs.filter(r => !r.del && r.iv === v.id && r.k === 'prof').length]; }), [true, true, true, 1]);

    /* مساهم مربوط بعميل: الفواتير بتنزل بأصنافها وأعدادها، وانت بتكتب ربح الواحدة */
    const CI = await A.evaluate(() => {
      const p = liveParties().find(x => x.name === 'عميل تجربة واحد'), inv = db.entries.filter(e => !e.del && e.party === p.id && (e.kind === 'inv' || e.kind === 'rinv')).sort(entCmp);
      ivpModal(null); $('#ipN').value = 'مساهم تجربة عميل'; $$('#ipM button')[1].click(); $('#ipP').value = p.id; $('#ipF').value = inv[0].date; $('#ipOk').click();
      const v = ivList().find(x => x.name === 'مساهم تجربة عميل');
      return [inv.length, ivPending(v).length, inv.length > 0]; });
    eq('كل فواتير العميل من تاريخ البداية نازلة "مستنية الربح"', CI[1], CI[0]);
    const SH = await A.evaluate(() => {
      const v = ivList().find(x => x.name === 'مساهم تجربة عميل'), e = ivPending(v).find(x => x.kind === 'inv' && (x.lines || []).length);
      ivShipModal(v, null, e);
      const names = $$('#shL [data-f=n]').map(i => i.value), qs = $$('#shL [data-f=q]').map(i => num(i.value));
      const want = e.lines.map(l => l.name), wq = e.lines.map(l => +l.qty);
      $('#shOk').click(); const blocked = !!$('#shOk');   // ربح الواحدة لسه متكتبش
      $$('#shL [data-f=u]').forEach(i => { i.value = '2.5'; i.dispatchEvent(new Event('input')); });
      $('#shF').value = '10'; $('#shF').dispatchEvent(new Event('input'));
      $('#shAdd').click(); const last = $('#shL [data-i]:last-child'); last.querySelector('[data-f=n]').value = 'صنف زيادة تجربة'; last.querySelector('[data-f=q]').value = '2'; last.querySelector('[data-f=u]').value = '1';
      $('#shOk').click();
      const r = db.ivrs.find(x => !x.del && x.src === e.id), gross = e.lines.reduce((s, l) => s + Math.round(l.qty * 250), 0) + 200;
      return [JSON.stringify(names) === JSON.stringify(want), JSON.stringify(qs) === JSON.stringify(wq), blocked, !!r && r.lines.length === e.lines.length + 1, !!r && ivShipNet(r) === gross - 1000, ivPending(v).some(x => x.id === e.id), ivSums(v.id).prof === gross - 1000]; });
    eq('الشحنة: الأصناف والأعداد من الفاتورة، ربح الواحدة إجباري، سطر زيادة، والنقل بيتخصم', SH, [true, true, true, true, true, false, true]);
    eq('شيل سطر من الشحنة بيعدّل الصافي، وإلغاء الشحنة بيرجّع الفاتورة مستنية', await A.evaluate(() => {
      const v = ivList().find(x => x.name === 'مساهم تجربة عميل'), r = db.ivrs.find(x => !x.del && x.iv === v.id && x.k === 'ship'), n0 = ivShipNet(r);
      ivShipModal(v, r); $('#shL [data-i]:last-child [data-rm]').click(); $('#shOk').click();
      const n1 = ivShipNet(r), h = r.hist.length;
      ivShipModal(v, r); $('#shDel').click(); $('#cOk').click();
      return new Promise(res => setTimeout(() => res([n0 - n1, h, r.del, ivPending(v).some(x => x.id === r.src)]), 50)); }), [200, 1, true, true]);
    eq('كشف المساهم المربوط بعميل: أعمدة الـ PDF (الصنف والعدد والوزن وربح الواحدة والإجمالي)', await A.evaluate(() => {
      const v = ivList().find(x => x.name === 'مساهم تجربة عميل'), R = ivReport(v); go('jrd/iv/' + v.id); renderJrd();
      const pg = buildReportPages(R), th = [...pg[0].querySelectorAll('thead th')].map(x => x.textContent); $('#render').innerHTML = '';
      return [th.join('|'), !!$('#p-jrd tr[data-pe]'), R.fin[0]]; }), ['الصنف|العدد|الوزن|ربح الوحدة|الإجمالي', true, 'إجمالي المستحق للمساهم']);

    /* نقل كشف قديم من ملف (نفس شكل الملف اللي بيتعمل من الإكسيل)، ونقله مرتين مبيكررش */
    const IMP = {app: 'flash-on-investors', v: 1, list: [{id: 'ip_imp_t', name: 'مساهم تجربة قديم', mode: 'c', hint: 'تجربة واحد', from: '2026-09-11', at: 1, upd: 1760000000000, rows: [
      {id: 'ir_imp_t_cap', k: 'cap', date: '2025-05-04', amt: 29000000, note: 'رأس المال', at: 1, upd: 1760000000000},
      {id: 'ir_imp_t_s1', k: 'ship', date: '2025-05-04', lines: [{n: 'لفة تجربة 16', q: 300, w: 4.5, u: 2250}, {n: 'لفة تجربة 23', q: 160, w: 7.25, u: 3625}], fr: 300000, site: 'المنيا', note: '', at: 2, upd: 1760000000000},
      {id: 'ir_imp_t_s2', k: 'ship', date: '2026-08-11', lines: [{n: 'ماسورة تجربة', q: 52, u: 10000}], fr: 100000, site: '', note: '', at: 3, upd: 1760000000000},
      {id: 'ir_imp_t_e1', k: 'exp', date: '2026-03-15', amt: 300000, note: 'مصروف تجربة', at: 4, upd: 1760000000000},
      {id: 'ir_imp_t_d1', k: 'draw', date: '2026-07-05', amt: 1000000, note: '', at: 5, upd: 1760000000000}]}]};
    const IM = async () => { await A.evaluate(f => ivImport(JSON.stringify(f)), IMP); await A.waitForSelector('#iiGo'); const sel = await A.evaluate(() => { const s = $('[data-ipp="0"]'); return s.options[s.selectedIndex].text; }); await A.click('#iiGo'); await A.settle(200); return sel; };
    eq('النقل: بيختار العميل اللي اسمه شبه الملف لوحده', await IM(), 'عميل تجربة واحد');
    const IR = await A.evaluate(() => { const v = ivGet('ip_imp_t'), s = ivSums(v.id); return [s.cap, s.gross, s.fr, s.exp, s.draw, s.bal, db.ivrs.filter(r => r.iv === v.id).length, v.from, P.get(v.party).name]; });
    eq('النقل: رأس المال والعمولة (العدد × ربح الواحدة) والنقل والمصاريف والسحب والباقي', IR, [29000000, 300 * 2250 + 160 * 3625 + 52 * 10000, 400000, 300000, 1000000, 29000000 + 300 * 2250 + 160 * 3625 + 52 * 10000 - 400000 - 300000 - 1000000, 5, '2026-09-11', 'عميل تجربة واحد']);
    await IM();
    eq('النقل مرتين مبيكررش حاجة', await A.evaluate(() => [db.ivps.filter(v => v.id === 'ip_imp_t').length, db.ivrs.filter(r => r.iv === 'ip_imp_t').length]), [1, 5]);
    eq('الجرد بالترتيب: الأصول ← مستحقات الموردين ← صافي الأصول ← أرصدة المساهمين ← صافي الجرد، وكل مجموع = اللي فوقه', await A.evaluate(() => {
      const n = jrdCalc(todayISO()), L = jrdLines(n, 12300), T = jrdTot(n, 12300), sub = L.filter(x => x.t === 's').map(x => x.n);
      const own = L.slice(0, 4).reduce((a, x) => a + x.a, 0), iv = L.filter(x => x.iv).reduce((a, x) => a + x.a, 0);
      const R = jrdReport(todayISO(), n, 12300, null);
      return [L.slice(0, 4).map(x => x.n), sub, own === T.own, L.find(x => x.n === '= إجمالي الأصول').a === T.own, L.find(x => x.n === '= صافي الأصول قبل المساهمين').a === T.own - n.sup, L[L.length - 1].a === T.net && T.net === T.own - n.sup - iv, R.rows.length === L.length - 1, R.rows.filter(r => r.cls === 'sub').length]; }),
      [['أرصدة عملاء السوق', 'أرصدة عملاء المواقع', 'النقدية بالخزن', 'قيمة المخزون'], ['= إجمالي الأصول', '= صافي الأصول قبل المساهمين'], true, true, true, true, true, 2]);
    eq('كشف أحمد: رأس المال ثم كل شحنة (أصنافها والنقل وصافيها) ثم المصاريف ثم المسحوبات، والأرقام بتجمع صح', await A.evaluate(() => {
      const v = ivGet('ip_imp_t'), R = ivReport(v), g = R.rows.filter(r => r.grp !== undefined).map(r => r.grp), nt = R.rows.filter(r => r.cls === 'nt'), ships = ivMoves(v.id).filter(m => m.k === 'ship');
      const items = R.rows.filter(r => r.cells).reduce((a, r) => a + Math.round(parseFloat(r.cells[4].replace(/,/g, '')) * 100), 0);
      return [g[0], g[1], g.length, g[g.length - 2], g[g.length - 1], nt.map(r => r.foot[1]), items === ships.reduce((a, m) => a + ivGross(m.r), 0), R.sum.filter(x => x[2] === 'sub').length]; }),
      ['رأس المال', 'الشحنات (2)', 6, 'المصروفات', 'المسحوبات', ['9,550', '4,200'], true, 2]);
    eq('شاشة كشف المساهم: كارت لكل شحنة (التاريخ والصافي فوق، الأصناف تحتها، النقل في آخرها)', await A.evaluate(() => { go('jrd/iv/ip_imp_t'); renderJrd();
      const cs = [...document.querySelectorAll('#p-jrd .cwrap .ctab.inc')].filter(c => c.querySelector('td.w small bdi')), c = cs[0];
      return [cs.length, c.querySelectorAll('tbody tr').length, !!c.querySelector('td.am.neg'), c.querySelector('.cth b').textContent, !document.querySelector('#p-jrd table.ldg')]; }), [2, 3, true, '9,550', true]);
    eq('الجرد: فلوس المساهمين في "عليك"، والجرد المحفوظ أرقامه ثابتة', await A.evaluate(() => {
      const n = jrdCalc(todayISO()), s = jrdSaved()[0], iv = ivList().reduce((a, v) => a + ivSums(v.id).bal, 0);
      return [n.ivs.length, n.ivs.reduce((a, x) => a + x.amt, 0) === iv, s.n.ivs.length, jrdTot(n, 0).owe === n.sup + iv]; }), [3, true, 0, true]);

    /* الشكل: التبويبات والأرقام تحت بعض والخط */
    await A.evaluate(() => { jrDate = ''; go('jrd'); }); await A.settle(300);
    await segOk(A, 'الحسابات — الجرد'); await colOk('الحسابات — الجرد', A, '#p-jrd', '.cmt td.am,.cth b');
    eq('الجرد: الخط بالخمس أحجام بس', await fs5(A), [true, []]);
    await A.evaluate(() => go('jrd/iv')); await A.settle(300);
    await segOk(A, 'الحسابات — المساهمين'); await colOk('الحسابات — المساهمين', A, '#p-jrd', '.cmt td.am,.cth b');
    await A.evaluate(() => go('jrd/iv/ip_imp_t')); await A.settle(300); await colOk('الحسابات — كشف المساهم (كروت الشحنات)', A, '#p-jrd', '.cmt td.am,.cth b');
    await A.evaluate(() => go('jrd/iv/ip_imp_t')); await A.settle(300);
    eq('كشف المساهم: الخط بالخمس أحجام بس', await fs5(A), [true, []]);

    /* المزامنة: الجهاز التاني بياخد المساهمين والكشوف والجرد */
    await bg(A, 'syncNow()'); await bg(B, 'syncNow()'); await B.settle(1500);
    eq('الجهاز التاني: نفس المساهمين والكشوف والجرد ونفس الأرقام', await B.evaluate(() => [ivList().length, db.ivrs.filter(r => !r.del).length, jrdSaved().length, ivSums('ip_imp_t').bal]),
      await A.evaluate(() => [ivList().length, db.ivrs.filter(r => !r.del).length, jrdSaved().length, ivSums('ip_imp_t').bal]));
    await A.evaluate(() => go('home')); await A.settle(200);

    sec('١٤) التاريخ ورصيد أول المدة');
    const OP = await A.evaluate(() => {
      const now = Date.now(), p = {id: newId('p_'), sec: 'mkt', name: 'عميل ترتيب تجربة', phone: '', note: '', noTot: false, at: now, upd: now, del: false};
      db.parties.push(p); P.set(p.id, p);
      addEntry({party: p.id, kind: 'man', date: '2026-01-10', desc: 'بند قبل الرصيد', dr: 5000, cr: 0});
      addEntry({party: p.id, kind: 'open', date: '2026-03-01', desc: 'رصيد أول المدة', dr: 20000, cr: 0});
      const s = stmtData(p.id, '2026-02-01', '2026-12-31');
      return [partyEntries(p.id)[0].kind, stmtData(p.id, '', '').rows[0].run, s.open, s.n];
    });
    eq('رصيد أول المدة أول سطر حتى لو في بند بتاريخ قبله', OP, ['open', 20000, 25000, 0]);
    await A.evaluate(() => go('cash')); await A.click('#cExp'); await A.settle(150);
    const DP = await A.evaluate(() => { const b = $('#txD').nextElementSibling; return [b.className, [...b.querySelectorAll('span')].slice(0, 5).map(x => x.textContent).join('') === dispDate(todayISO()).split('/').join('/') .replace(/\//g, '') || true, getComputedStyle(b).direction, b.firstElementChild.textContent === todayISO().slice(8)]; });
    eq('خانة التاريخ: اليوم أول واحد على اليمين', [DP[0], DP[2], DP[3]], ['dp', 'rtl', true]);
    await A.click('#txD + .dp'); await A.waitForSelector('.dpo');
    await A.click('.dpo [data-d="5"]');
    const T = await A.evaluate(() => todayISO().slice(0, 8) + '05');
    eq('أول ما تدوس على اليوم بيتسجل وبيتقفل الكليندر', [await A.inputValue('#txD'), await A.$('.dpo')], [T, null]);
    await A.click('#txX');

    sec('١٤ب) راحة العين واستغلال المساحة (ماتدوسش حاجة مكان حاجة)');
    await A.setViewportSize({width: 400, height: 860}); await A.settle(200);
    await openParty(A, 'عميل تجربة واحد');
    eq('الموبايل: كشف الحساب 5 عواميد، الكمية × السعر تحت البيان، والسنة سطر لوحده مش جنب كل تاريخ', await A.evaluate(() => {
      const vis = el => getComputedStyle(el).display !== 'none', th = [...$$('#p-party .ldg thead th')].filter(vis).map(x => x.textContent);
      return [th.join('|'), $$('#p-party .ldg tr.yr').length > 0 && vis($('#p-party .ldg tr.yr')), [...$$('#p-party .ldg td.dt small')].some(vis), [...$$('#p-party .ldg td.l .qp')].some(vis),
        $('#p-party .ldgw').scrollWidth <= $('#p-party .ldgw').clientWidth + 1]; }), ['التاريخ|البيان|الإجمالي|دفعة|الرصيد', true, false, true, true]);
    eq('الموبايل: كل زراير صفحة العميل جوه الشاشة', await A.evaluate(() => [...$$('#p-party .acts .btn')].filter(b => b.offsetParent).every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })), true);
    eq('رسالة التراجع: صغيرة فوق مكان الاسم، مش فوق أي زرار، وبتختفي في أقل من 5 ثواني', await A.evaluate(async () => {
      toastUndo('اتلغت حركة تجربة طويلة شوية علشان نشوف الاسم بيتقص ولا لأ', () => {});
      const t = $('#toast').getBoundingClientRect(), hit = [...$$('.top button')].filter(b => b.offsetParent).some(b => { const r = b.getBoundingClientRect(); return r.right > t.left && r.left < t.right && r.bottom > t.top && r.top < t.bottom; });
      return [t.top < 20, t.height < 50, hit]; }), [true, true, false]);
    eq('رسالة التراجع اختفت لوحدها في أقل من 5 ثواني', await A.waitForFunction(() => getComputedStyle($('#toast')).display === 'none', null, {timeout: 5000}).then(() => true, () => false), true);
    await A.evaluate(() => { tab = 'mkt'; go('home'); }); await A.settle(200);
    eq('الموبايل: مفيش زرار الليلي فوق، وزرار الحساب الجديد مش نفس ＋ بتاع التسجيل السريع، وسطر "آخر دفعة" تحت الاسم', await A.evaluate(() => [!!$('#bTheme').offsetParent, $('#bNewParty').textContent.includes('＋'), !!$('#bNewParty svg'),
      [...$$('#hList .lpy')].some(x => x.offsetParent && x.textContent.startsWith('آخر دفعة'))]), [false, false, true, true]);
    eq('الموبايل: مفيش خانة بحث كبيرة، والزراير (بحث، التقارير، الجرد، حساب جديد) في سطر واحد كبار ومتباعدين', await A.evaluate(() => {
      const bs = ['#bSearch', '#hRep', '#hJrd', '#bNewParty'].map(x => $(x).getBoundingClientRect());
      return [getComputedStyle($('#hSearch')).display, bs.every(r => Math.abs(r.top - bs[0].top) < 2 && r.height >= 52 && r.width >= 70), bs.slice(1).every((r, i) => Math.abs(r.right - bs[i].left) >= 6 || Math.abs(bs[i].right - r.left) >= 6)]; }), ['none', true, true]);
    await A.click('#bSearch'); await A.fill('#hSearch', 'تجربة واحد'); await A.settle(200);
    eq('العدسة بتفتح خانة الاسم وبتفلتر القايمة', await A.evaluate(() => [getComputedStyle($('#hSearch')).display !== 'none', $$('#hList .pt').length]), [true, 1]);
    await A.click('#bSearchAll'); await A.settle(400);
    eq('"في الحركات" بيدوّر في كل الحركات على اللي مكتوب', await A.evaluate(() => [$('#saQ').value, $$('#saR .cm').length > 0]), ['تجربة واحد', true]);
    await A.evaluate(() => closeModal()); await A.click('#bSearch'); await A.settle(150);
    eq('دوسة تانية على العدسة بتقفل الخانة وترجع القايمة كلها', await A.evaluate(() => [getComputedStyle($('#hSearch')).display, $('#hSearch').value, $$('#hList .pt').length > 1]), ['none', '', true]);
    await A.click('#hSortB'); await A.settle(150);
    eq('زرار الترتيب الصغير فوق القايمة بيغيّر الترتيب', await A.evaluate(() => [$('#hSort').value, $('#hSortB').textContent.includes('بالاسم')]), ['name', true]);
    await A.click('#hSortB'); await A.click('#hSortB'); await A.settle(150);
    await A.evaluate(() => { const now = Date.now(), p = {id: newId('p_'), sec: 'mkt', name: 'عميل طويل تجربة', phone: '', note: '', noTot: false, at: now, upd: now, del: false}; db.parties.push(p); P.set(p.id, p);
      for (let i = 0; i < 45; i++) addEntry({party: p.id, kind: 'man', date: '2026-0' + (1 + i % 9) + '-1' + (i % 9), desc: 'بند ' + i, dr: 1000, cr: 0}); go('p/' + p.id); }); await A.settle(300);
    eq('كشف حساب طويل على الموبايل: سطر "أقدم" مبيعملش عمود فاضي', await A.evaluate(() => { const t = $('#p-party .ldg'), th = [...t.querySelectorAll('thead th')].filter(x => getComputedStyle(x).display !== 'none');
      return [!!$('#ldgOld'), Math.abs(th.reduce((n, x) => n + x.getBoundingClientRect().width, 0) - t.getBoundingClientRect().width) <= 4]; }), [true, true]);
    await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل طويل تجربة'); db.entries.filter(e => e.party === p.id).forEach(e => { e.del = true; e.delAt = nowS(); touch(e); }); p.del = true; touch(p); saveDB(); go('home'); }); await A.settle(150);   // الحساب ده للاختبار بس، ميدخلش في أقسام السوق
    await A.evaluate(() => { go('rep'); repKind = 'profit'; repMode = 'year'; repYear = ''; renderReports(); }); await A.settle(300);
    eq('تقرير الأرباح: الشهور الفاضية مش ظاهرة، والجدول جوه الشاشة على الموبايل (والـ PDF فيه السنة كلها)', await A.evaluate(() => {
      const R = buildReport(), tb = $('#p-rep table.pft'), w = tb.closest('.ldgw');
      return [tb.querySelectorAll('tbody tr').length === R.rows.filter(r => !r.empty).length, R.rows.length, R.rows.some(r => r.empty), w.scrollWidth <= w.clientWidth + 1]; }), [true, 12, true, true]);
    await A.evaluate(() => go('cash')); await A.settle(200);
    eq('زرار عدّ الفلوس في الخزنة (مش "جرد" زي صفحة الجرد)', (await A.textContent('#cOpen2')).trim(), '✎ عدّ الفلوس');
    await A.setViewportSize({width: 1280, height: 760}); await A.settle(300);
    eq('اللاب: عملاء السوق/المواقع/الموردين مش متكررين في القايمة الجانبية، وآخر زرار فيها بيوصله من غير ما القفل يغطيه', await A.evaluate(() => {
      const nav = document.querySelector('nav'), last = [...nav.querySelectorAll('button')].filter(b => b.offsetParent).pop(); nav.scrollTop = nav.scrollHeight;
      const r = last.getBoundingClientRect(), l = $('#bLock').getBoundingClientRect(); return [getComputedStyle(nav.querySelector('.qk')).display, r.bottom <= l.top]; }), ['none', true]);
    await A.setViewportSize({width: 400, height: 860}); await A.evaluate(() => go('home')); await A.settle(300);


    }   // نهاية الأقسام اللي بتتخطى في وضع السوق
    if (RUN.mkt) {   // ← وضع الحسابات (acc) بيتخطى أقسام السوق ١٦–٢٢
    sec('١٦) حركة السوق: تطبيق الشريك ووارد السوق');
    const C1 = 'عميل تجربة واحد', bal0 = await bal(A, C1), pid1 = await A.evaluate(n => liveParties().find(x => x.name === n).id, C1);
    await A.click('nav button[data-go=home]'); await A.settle(200);
    eq('قبل الربط: مفيش سطر في الرئيسية، وتبويب حركة السوق بيوديه للإعدادات على كارتها', [(await A.textContent('#mkRem')).trim(), (await A.click('nav button[data-go=mkt]'), await A.click('#mkSet'), await A.settle(400), await A.evaluate(() => [location.hash, !!$('#sMkt #smHelp')]))], ['', ['#set', true]]);
    await A.click('#bSet:visible, nav button[data-go=set]:visible'); await A.evaluate(() => setOpenAll());
    await A.click('#smHelp'); await A.click('#mhCopy'); const mkCode = await A.evaluate(() => navigator.clipboard.readText()); sheets.mkt.load(mkCode); await A.click('#mhX');
    await A.fill('#smUrl', MKT_URL); await A.click('#smGo'); await A.settle(2500);
    await A.evaluate(() => putSet('tgOpts', {bk: false, sum: false, al: false, wk: false, mo: false, nl: false}));   // رسايل الحسابات على تليجرام بتتجرب لوحدها تحت، علشان متدخلش وسط رسايل الشريك
    const mkc = await A.evaluate(() => getSet('mktSheet', null));
    eq('شيت السوق اتربط ومقفول على مفتاح اتعمل لوحده ومش في الكود', [!!(mkc && mkc.k), mkCode.includes(mkc.k) || /TEST-|script\.google\.com\/macros/.test(mkCode), JSON.parse(sheets.mkt.post(JSON.stringify({key: 'Other-Key-123', action: 'ping'}))).error, JSON.parse(sheets.mkt.get()).ok], [true, false, 'key', false]);
    eq('كود شيت الحسابات الأساسي متلمسش (مفيش تليجرام ولا إذن زيادة)', await A.evaluate(() => /UrlFetchApp|telegram|DriveApp|ScriptApp/.test(scriptFor())), false);
    eq('خزنة السوق اتعملت مرة واحدة', await A.evaluate(() => db.vaults.filter(v => v.name === 'خزنة السوق' && !v.del).map(v => v.id)), ['v_mkt']);
    const mkRows = kind => sheets.mkt.sheets['الحركات'].rows.slice(1).filter(r => r[1] === kind);
    eq('الشيت فيه عملاء السوق بس بأرصدتهم (من غير مواقع ولا موردين)', mkRows('cust').map(r => JSON.parse(r[10]).name).sort(), ['عميل ترتيب تجربة', C1].sort());

    await A.fill('#tgTok', 'كلام مش توكن'); await A.click('#tgSave'); await A.settle(300);
    eq('تليجرام: لو اللي اتلصق مش شكل توكن بيقول كده ومبيتحفظش', [sheets.mkt.props.TG_TOKEN || '', (await A.textContent('#tgSt')).includes('مش شكل توكن')], ['', true]);
    const TOK = '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';   // آخره 35 حرف زي تليجرام
    sheets.mkt.tg.valid = [TOK];
    await A.fill('#tgTok', '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghX'); await A.click('#tgSave'); await A.settle(600);
    eq('تليجرام: توكن غلط فعلاً تليجرام بيرفضه ومبيتحفظش، والرسالة بتقول يجيبه منين', [sheets.mkt.props.TG_TOKEN || '', (await A.textContent('#tgSt')).includes('/mybots')], ['', true]);
    /* رسالة BotFather كلها اتلصقت في الخانة من غير سطور: "Keep" بتلزق في آخر التوكن */
    await A.evaluate(t => { $('#tgTok').value = '\u200F' + 'Use this token to access the HTTP API:' + t.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]).replace(/[A-Za-z:]/g, x => x) + 'Keep your token secure and store it safely'; }, TOK.split(':')[0] + ':' + TOK.split(':')[1]);
    await A.click('#tgSave'); await A.settle(800);
    sheets.mkt.tg.updates = [{update_id: 1, message: {chat: {id: 777}, text: 'ابدأ'}}];
    await A.click('#tgTest'); await A.settle(800);
    eq('تليجرام: التوكن في الشيت بس، والـ chat id اتجاب لوحده من "ابدأ"', [sheets.mkt.props.TG_TOKEN, sheets.mkt.props.TG_CHAT, await A.evaluate(() => JSON.stringify(db).includes('ABCDEFGHIJ')), (await A.textContent('#tgSt')).includes('شغالة')], [TOK, '777', false, true]);
    const tgTexts = () => sheets.mkt.tg.calls.filter(c => c.url.endsWith('/sendMessage')).map(c => c.body.text);

    /* تليجرام من الحسابات لمصطفى: نسخة يومية وملخص وتنبيه. على نفس البوت، ومن غير ما يتكتب أي حاجة في شيت الحركات (الشريك مبيشوفهاش) */
    const tgDocs = () => sheets.mkt.tg.calls.filter(c => c.url.endsWith('/sendDocument'));
    const mkRows0 = sheets.mkt.sheets['الحركات'].rows.length;
    eq('كود شيت السوق نسخة 5، ومفيش تحذير "الكود قديم"', [JSON.parse(sheets.mkt.post(JSON.stringify({key: mkc.k, action: 'tgstate'}))).v, await A.$('#mkOld')], [5, null]);
    {
      /* كود شيت السوق نسخة 4 قدام نسخة 3 القديمة بآلاف السطور: نفس الردود ونفس الشيت بالظبط، والقراية أقل بكتير */
      const oldMk = fs.readFileSync(path.join(__dirname, 'fixtures/mkt-sheet-v3.gs'), 'utf8'), newMk = await A.evaluate(() => marketScript());
      const GN = makeGas(), GO = makeGas(); GN.load(newMk); GO.load(oldMk);
      const cost = {old: {}, neu: {}}, diff = [];
      const both = (tag, o) => {
        const b = JSON.stringify(Object.assign({key: 'Bench-Key-1234'}, o)), c0 = GO.reads.cells, c1 = GN.reads.cells;
        const a = GO.post(b), n0 = GN.post(b), nj = JSON.parse(n0); if (typeof nj.t !== 'number' || nj.t < 1e12) diff.push(tag + ': مفيش وقت الشيت t'); delete nj.t; const aj = JSON.parse(a); delete aj.t; const n = JSON.stringify(nj), a2 = JSON.stringify(aj);
        cost.old[tag] = (cost.old[tag] || 0) + GO.reads.cells - c0; cost.neu[tag] = (cost.neu[tag] || 0) + GN.reads.cells - c1;
        if (a2 !== n) diff.push(tag);
        return JSON.parse(n);
      };
      const mr = (i, upd, del) => ({id: (i % 3 ? 'op_b' : 'cust_b') + i, kind: i % 3 ? 'op' : 'cust', upd, del: !!del, view: ['2026-01-01', 'عميل تجربة ' + (i % 40), 'دفعة', String(i * 50), ''], data: {cid: 'p_b' + (i % 40), amt: i * 5000, m: 'cash', note: 'تجربة '.repeat(1 + i % 5)}});
      const N = 5000;
      for (let i = 0; i < N; i += 500) both('push', {action: 'push', rows: Array.from({length: 500}, (_, k) => mr(i + k, 1000 + i + k))});
      const pullAll = (tag, since) => { const out = []; let more = true, nx = since, n = 0; while (more && n++ < 50) { const j = both(tag, {action: 'pull', since: nx}); out.push(...j.rows); nx = j.next; more = j.more; } return out; };
      const full = pullAll('pull0', 0), seq0 = Number(GN.props.SEQ);
      both('idle', {action: 'pull', since: seq0});
      const ed = [];
      for (let k = 0; k < 20; k++) ed.push(mr(k * 241, k % 4 ? 900000 + k : 3, k % 6 === 0));
      for (let k = 0; k < 15; k++) ed.push(mr(N + k, 950000 + k));
      ed.push(mr(N + 2, 960000));
      both('push2', {action: 'push', rows: ed});
      const inc = pullAll('pull1', seq0);
      eq('كود شيت السوق الجديد: بآلاف السطور نفس الردود ونفس الشيت خانة بخانة زي القديم', [diff, JSON.stringify(GN.sheets['الحركات'].rows) === JSON.stringify(GO.sheets['الحركات'].rows), full.length, inc.length], [[], true, N, 15 + 15]);
      console.log('     شيت السوق — خانات اتقرت (القديم ← الجديد):', Object.keys(cost.old).map(k => `${k}: ${cost.old[k]} ← ${cost.neu[k]}`).join(' | '));
      eq('شيت السوق: السحب والإرسال أخف بكتير', [cost.neu.idle, cost.neu.pull1 * 8 < cost.old.pull1, cost.neu.pull0 * 2 < cost.old.pull0, cost.neu.push * 2 < cost.old.push], [0, true, true, true]);
      eq('شيت السوق نسخة 3: تحذير أصفر إنه هيبطأ بس (مش إن التنبيهات ناقصة)', await A.evaluate(() => { tgInfo = {ok: true, v: 3, token: false}; renderMktSettings(); const t = $('#mkOld') ? $('#mkOld').textContent : ''; return [t.includes('هيبطأ'), t.includes('ناقصة')]; }), [true, false]);
      await A.evaluate(() => { tgInfo = null; });
    }
    await A.evaluate(() => renderMktSettings()); await A.settle(600);
    await A.click('#smUpd'); await A.settle(150);
    eq('تحديث كود الشيت: زرار ثابت في الإعدادات بيفتح الخطوات (من جوه الجدول، ولو مش لاقيه) وفيه لينك جدول حركة السوق نفسه', await A.evaluate(() => [$('#modal').textContent.includes('الإضافات (Extensions)'), $('#modal').textContent.includes('بحساب جوجل تاني'), !!$('#modal a[href*="docs.google.com/spreadsheets/d/ss1"]'), db.cfg.mkSheetUrl]), [true, true, true, 'https://docs.google.com/spreadsheets/d/ss1/edit']);
    await A.click('#muX');
    const TD = await A.evaluate(() => db.entries.filter(e => !e.del && e.kind === 'pay').map(e => e.date).sort().pop());
    /* الإرسال اللوحده بعد المزامنة (من غير تاريخ) بيستخدم الساعة الحقيقية، فلو الاختبار اشتغل بعد 8 بالليل كان بيبعت نسخة النهارده في النص. هنا بنجرب بتواريخ ثابتة بس */
    await A.evaluate(() => { window.__tgA = tgAfterSync; window.tgAfterSync = d => d ? window.__tgA(d) : Promise.resolve(); });
    await A.evaluate(() => { putSet('tgOpts', {bk: true, sum: true, al: true, wk: false, mo: false, nl: false}); db.cfg.tg = {}; });
    const d0 = tgDocs().length, m0 = tgTexts().length;
    await bg(A, `tgAfterSync(new Date('${TD}T21:00:00'))`);
    const doc = tgDocs()[d0], bk = doc ? JSON.parse(doc.body.document.data) : {};
    eq('تليجرام: النسخة اليومية اتبعتت ملف متقفل بكلمة السر (مفيهوش أسامي مكشوفة)', [tgDocs().length - d0, doc && doc.body.document.name, bk.app, !!bk.ct, doc && doc.body.document.data.includes('عميل تجربة واحد'), doc && doc.body.caption.includes('استرجاع نسخة احتياطية')],
      [1, `flash-on-accounts-${TD}.json`, 'flash-on-accounts-backup', true, false, true]);
    eq('تليجرام: ملخص اليوم بعد 8 بالليل بأرقام البرنامج', [tgTexts().length - m0, tgTexts().pop() === await A.evaluate(d => daySum(d).text, TD), (await A.evaluate(d => daySum(d).text, TD)).includes('رصيد الخزن آخر اليوم')], [1, true, true]);
    await bg(A, `tgAfterSync(new Date('${TD}T22:00:00'))`);
    await A.evaluate(() => { db.cfg.tg = {}; });   // كأنه جهاز تاني لسه مبعتش
    await bg(A, `tgAfterSync(new Date('${TD}T22:30:00'))`);
    eq('تليجرام: النسخة والملخص مرة واحدة في اليوم حتى من جهاز تاني', [tgDocs().length - d0, tgTexts().length - m0, await A.evaluate(() => [db.cfg.tg.bk, db.cfg.tg.sum])], [1, 1, [TD, TD]]);
    await A.evaluate(() => { window.tgAfterSync = window.__tgA; });
    eq('تليجرام: يوم مفيهوش أي حركة مبيتبعتلوش ملخص', await A.evaluate(() => daySum('2001-01-01').empty), true);
    await A.evaluate(() => { db.cfg.tg.fail0 = Date.now() - 31 * 60000; syncErr = 'تجربة'; syncWhy = 'الشيت رد بخطأ تجربة'; tgSyncFail(); });
    await A.settle(600);
    const al1 = tgTexts().length; await A.evaluate(() => tgSyncFail()); await A.settle(300);
    eq('تليجرام: تنبيه لو المزامنة واقفة أكتر من نص ساعة، ومرة واحدة بس', [tgTexts()[al1 - 1].includes('المزامنة مع شيت الحسابات واقفة'), tgTexts().length - al1], [true, 0]);
    await A.evaluate(() => { putSet('tgOpts', {bk: false, sum: true, al: true, wk: false, mo: false, nl: false}); db.cfg.tg = {}; });
    const d1 = tgDocs().length;
    await bg(A, `tgAfterSync(new Date('2001-01-02T21:00:00'))`);
    eq('تليجرام: لو النسخة اليومية مقفولة من الإعدادات مبتتبعتش', tgDocs().length - d1, 0);
    eq('تليجرام: الأسبوع بيخلص الخميس 8 بالليل (الجمعة→الخميس) والشهر آخر يوم 8 بالليل', await A.evaluate(() => [weekDone(new Date('2026-10-15T21:00:00')), weekDone(new Date('2026-10-15T19:00:00')).to, weekDone(new Date('2026-10-12T10:00:00')).to, monthDone(new Date('2026-10-31T21:00:00')).m, monthDone(new Date('2026-10-31T19:00:00')).m, monthDone(new Date('2026-01-05T10:00:00'))]),
      [{f: '2026-10-09', to: '2026-10-15'}, '2026-10-08', '2026-10-08', '2026-10', '2026-09', {f: '2025-12-01', to: '2025-12-31', m: '2025-12'}]);
    {
      const thu = await A.evaluate(d => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + (4 - x.getDay() + 7) % 7); return isoOf(x.getTime()); }, TD);
      const nlId = await A.evaluate(() => { const e = db.entries.find(e => !e.del && e.kind === 'inv' && P.get(e.party) && !P.get(e.party).del); e.mkNL = 1; return e.id; });
      await A.evaluate(() => { putSet('tgOpts', {bk: false, sum: false, al: false, wk: true, mo: false, nl: true}); db.cfg.tg = {}; });
      const w0 = tgTexts().length;
      await bg(A, `tgAfterSync(new Date('${thu}T21:00:00'))`);
      const got = tgTexts().slice(w0);
      await A.evaluate(() => { db.cfg.tg = {}; });   // جهاز تاني
      await bg(A, `tgAfterSync(new Date('${thu}T21:30:00'))`);
      eq('تليجرام: ملخص الأسبوع بالمصروفات وتنبيه الفواتير اللي بنودها متكتبتش، مرة واحدة حتى من جهاز تاني', [got.length, got.some(x => x.startsWith('🗓 ملخص الأسبوع') && x.includes('تحصيل من العملاء') && x.includes('رصيد الخزن آخر الأسبوع')), got.some(x => x.startsWith('📝 فواتير بنودها لسه متكتبتش: 1')), tgTexts().length - w0], [2, true, true, 2]);
      await A.evaluate(id => { delete db.entries.find(e => e.id === id).mkNL; }, nlId);
      eq('تليجرام: الصبح مفيش فواتير ناقصة = مفيش رسالة', await A.evaluate(() => nlSum().empty || nlSum().text.startsWith('📥')), true);
    }
    eq('تليجرام: مفيش أي سطر اتكتب في شيت الحركات بتاع الشريك', sheets.mkt.sheets['الحركات'].rows.length, mkRows0);
    eq('آخر تحديث للبرنامج: بيظهر بوقت النشر، ومبيظهرش لو المتصفح معرفوش', await A.evaluate(() => { const lm = new Date('2026-10-11T15:40:00').getTime(); return [verText(lm, lm + 60000).includes(dispDate('2026-10-11')), verText(lm, lm + 500)]; }), [true, '']);
    await A.evaluate(() => { putSet('tgOpts', {bk: false, sum: false, al: false, wk: false, mo: false, nl: false}); db.cfg.tg = {}; });

    const mlink = await A.evaluate(() => mktLink());
    DM = await newDevice(browser, base, sheets);
    const M = await DM.page('market.html' + mlink.slice(mlink.indexOf('#'))); await M.settle(1500);
    eq('تطبيق الشريك اتربط بالرابط بس، والرابط اتشال من العنوان', [M.url().includes('marketjoin'), await M.evaluate(() => !!S.u && !!S.k)], [false, true]);
    eq('العملاء: عملاء السوق بس بأرصدتهم', await M.evaluate(() => [...customers().values()].map(c => [c.name, c.bal]).sort()), (await A.evaluate(() => liveParties().filter(p => p.sec === 'mkt').map(p => [p.name, balance(p.id)]))).sort());
    eq('الرئيسية: معاك كاش 0، ومفيهاش قايمة العملاء (ليها تبويب لوحدها) وفيه 4 تبويبات', [await M.textContent('#cashT'), await M.$('#lists'), await M.evaluate(() => document.querySelectorAll('#tabs button').length)], ['0', null, 4]);
    await M.click('#tabs button[data-t=c]'); await M.settle(150);
    await M.click(`#lists .pt[data-c="${pid1}"]`);
    eq('شاشة الدفعة: خانة المبلغ مفتوحة على لوحة الأرقام', await M.evaluate(() => [document.activeElement.id, $('#amt').inputMode]), ['amt', 'decimal']);
    eq('خانة المبلغ: الكسور بالقرش (12.5 = 1250 قرش مش 125 جنيه) والفاصلة العربي، والفاصلة الإنجليزي فاصل آلاف', await (async () => { const o = []; for (const v of ['12.5', '12٫5', '١٢٫٧٥', '1,250.5', '7.', '0.05', '12.999', '5000']) { await M.fill('#amt', v); o.push(await M.evaluate(() => [$('#amt').value, amtOf($('#amt'))])); } await M.fill('#amt', ''); return o; })(), [['12.5', 1250], ['12.5', 1250], ['12.75', 1275], ['1,250.5', 125050], ['7.', 700], ['0.05', 5], ['12.99', 1299], ['5,000', 500000]]);
    await M.fill('#amt', '5000'); await M.click('.big[data-m=cash]'); await M.settle(1500);
    eq('اتسجلت: إشعار صغير بس وفضل في صفحة العميل (المبلغ اتمسح) ووصلت لمصطفى', [await M.textContent('#toast'), await M.evaluate(() => [scr.v, $('#amt').value, !!$('.done')]), await M.textContent('#top .dot')], ['✔ اتسجلت دفعة 5,000 — كاش معايا', ['pay', '', false], 'متصل']);
    eq('الدفعة: زرارين بس (فلوس معايا / تحويل لمصطفى)', await M.evaluate(() => $$('#pyBtns .big[data-m]').map(b => [b.dataset.m, b.textContent])), [['cash', '💵 فلوس معايا'], ['tr', '📲 تحويل لمصطفى']]);
    eq('تليجرام: رسالة لمصطفى مع الحركة', tgTexts().pop(), `💵 ${C1} دفع 5,000 كاش`);
    await M.fill('#amt', '3000'); await M.click('.big[data-m=tr]'); await M.settle(900);
    await M.fill('#amt', '3000'); await M.click('.big[data-m=cash]'); await M.settle(300);
    eq('حماية من التكرار: نفس المبلغ في دقيقتين بيسأل', (await M.textContent('#modal')).includes('دي دفعة تانية؟'), true);
    await M.click('#aN'); await M.settle(200);
    eq('لما قال لأ متسجلتش', await M.evaluate(() => liveOps().length), 2);
    eq('الرصيد عند الشريك = رصيد الحسابات − اللي اتسجل ولسه متنقلش', await M.evaluate(id => customers().get(id).bal, pid1), bal0 - 800000);
    eq('اتسجل للعميل ده النهارده بحالته', await M.evaluate(() => { const t = $('#tdy').textContent.replace(/\s+/g, ' '); return ['تحويل لمصطفى', '3,000', '⏳ عند مصطفى', 'كاش معايا', '5,000'].every(x => t.includes(x)); }), true);
    await M.click('#bBack'); await M.settle(150);
    eq('مفيش آخر زيارات، العملاء في جدول واحد', await M.evaluate(n => [$$('#lists .ctb').length, $('#lists .lbl span').textContent.replace(/ \(\d+\)$/, ''), $$('#lists .ctb .nm').some(x => x.firstChild.textContent === n)], C1), [1, 'كل العملاء', true]);

    DM.netDown = true;
    await M.click('#bNew'); await M.fill('#ncN', 'عميل سوق جديد'); await M.click('#ncOk'); await M.fill('#amt', '1500'); await M.click('.big[data-m=cash]'); await M.settle(1500);
    eq('من غير نت: اتحفظت على الموبايل ومستنية', [(await M.textContent('#tdy .row')).includes('لسه متبعتتش'), (await M.textContent('#top')).includes('1 مستنية تتبعت')], [true, true]);
    DM.netDown = false; await bg(M, 'sync()'); await M.settle(1200);
    eq('النت رجع: اتبعتت لوحدها', [await M.evaluate(() => pending().length), (await M.textContent('#tdy .row')).includes('عند مصطفى')], [0, true]);
    eq('مفيش اعتماد على navigator.onLine في تطبيق الشريك', /navigator\.onLine/.test(fs.readFileSync(path.join(ROOT, 'market.html'), 'utf8')), false);
    /* تخزين دائم: التطبيق بيطلبه أول ما يفتح */
    const MP = await DM.newPage();
    await MP.addInitScript(() => { window.__pc = 0; Object.defineProperty(navigator, 'storage', {configurable: true, value: {persisted: () => Promise.resolve(false), persist: () => { window.__pc++; return Promise.resolve(true); }}}); });
    await MP.goto(base + 'market.html'); await MP.waitForFunction(() => stoP !== null);
    eq('تطبيق الشريك بيطلب تخزين دائم (navigator.storage.persist)', await MP.evaluate(() => [window.__pc, stoP]), [1, true]);
    await MP.close();
    /* حركة مستنية من أكتر من ساعة: تنبيه أحمر واضح فوق */
    DM.netDown = true;
    const stId = await M.evaluate(() => { const id = newId(); S.ops[id] = {id, t: 'exp', amt: 100, cat: 'تجربة تأخير', note: '', ts: Date.now(), upd: Date.now() - 2 * 3600000, del: true}; drawTop(); return id; });
    const stuckSt = () => M.evaluate(() => [getComputedStyle($('#stuck')).display !== 'none', $('#stuck').textContent.includes('من أكتر من ساعة'), $('#stuck').classList.contains('alert')]);
    eq('حركة مستنية من أكتر من ساعة: تنبيه أحمر فوق', await stuckSt(), [true, true, true]);
    await M.evaluate(id => { bump(S.ops[id]); drawTop(); }, stId);
    eq('لو لسه مستنية من دقايق: مفيش تنبيه', (await stuckSt())[0], false);
    await M.evaluate(id => { delete S.ops[id]; save(); drawTop(); }, stId); DM.netDown = false;
    /* السحب بيهدى لوحده لو مفيش حركة، وأول لمسة بترجّعه سريع */
    eq('تطبيق الشريك: كل 5 ثواني وانت شغال، و15 بعد دقيقة، ودقيقة بعد 5 دقايق', await M.evaluate(() => { const g = []; [0, 120000, 400000].forEach(b => { lastAct = lastNew = Date.now() - b; poll(); g.push(pollMs); }); return g; }), [5000, 15000, 60000]);
    eq('أول لمسة: رجع كل 5 ثواني وسحب على طول', await M.evaluate(() => { lastAct = lastNew = Date.now() - 400000; poll(); syncAt = 0; again = false; document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); return [pollMs, syncAt > 0 || again]; }), [5000, true]);
    await M.settle(800);
    eq('الحسابات: سحب وارد السوق بيهدى لوحده ويرجع كل 8 ثواني مع أول لمسة', await A.evaluate(() => { lastAct = mkNew = Date.now() - 400000; mkPoll(); const slow = mkSlow; lastAct = mkNew = Date.now() - 120000; mkPoll(); const mid = mkSlow; mkAt = 0; document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); return [slow, mid, mkSlow, mkAt > 0 || !!mkQ]; }), [60000, 20000, 8000, true]);
    await A.settle(800);

    await bg(A, 'mkSync()'); await A.settle(800);
    eq('تنبيه فوري في الحسابات (شريط فوق)', await A.evaluate(() => $('#mkBar').classList.contains('on')), true);
    await A.click('nav button[data-go=home]'); await A.settle(200);
    eq('عداد الوارد على زرار حركة السوق تحت (مش سطر في الرئيسية)', [await A.evaluate(() => $('#nbMkt').textContent), (await A.textContent('#mkRem')).trim()], ['3', '']);
    /* اللاب: العداد على زرار "حركة السوق" في القايمة الجانبية والجرس فوق، ودوسة الجرس بتعرض العمليات وبتفتح الوارد */
    await A.setViewportSize({width: 1300, height: 800}); await A.settle(200);
    eq('اللاب: عداد حركة السوق على زرارها وعلى الجرس', await A.evaluate(() => [$('#nbMkt').textContent, $('#bellN').textContent, getComputedStyle($('nav button[data-go=mkt]')).display !== 'none']), ['3', '3', true]);
    await A.click('#bBell'); await A.settle(150);
    eq('الجرس: بيعرض العمليات اللي مستنية', await A.evaluate(() => [$('#mkPop').classList.contains('on'), $$('#mkPop .mpi').length]), [true, 3]);
    await A.click('#mpGo'); await A.settle(250);
    eq('الجرس ← افتح الوارد، والزرار الجانبي هو اللي متعلّم', await A.evaluate(() => [location.hash, $('#mkPop').classList.contains('on'), $('nav button.on').dataset.go]), ['#mkt', false, 'mkt']);
    await A.setViewportSize({width: 400, height: 860}); await A.settle(200);
    eq('الموبايل: زرار حركة السوق تحت مكان الشركاء (بطلب صاحب المشروع) ومفيش جرس', await A.evaluate(() => [getComputedStyle($('nav button[data-go=mkt]')).display, getComputedStyle($('nav button[data-go=part]')).display, getComputedStyle($('#bBell')).display]), ['flex', 'none', 'none']);
    eq('الموبايل: الإعدادات ترس فوق (مش تحت) والتقارير والجرد زراير في العملاء', await A.evaluate(() => [getComputedStyle($('#bSet')).display !== 'none', getComputedStyle($('nav button[data-go=set]')).display, getComputedStyle($('nav')).gridTemplateColumns.split(' ').length]), [true, 'none', 4]);
    await A.click('nav button[data-go=home]'); await A.settle(200);
    eq('الموبايل: زراير التقارير والجرد جنب بعض فوق في العملاء', await A.evaluate(() => { const r = $('#hRep').getBoundingClientRect(), j = $('#hJrd').getBoundingClientRect(); return [Math.abs(r.top - j.top) < 4, r.left !== j.left]; }), [true, true]);
    await A.click('#hJrd'); await A.settle(200);
    eq('زرار الجرد فوق بيفتح الجرد', await A.evaluate(() => location.hash), '#jrd');
    eq('الوقت المتسجل من ساعة الموبايل (حتى لو الشيت رد بوقت مختلف)', await A.evaluate(() => { const t0 = Date.now(); srvClock({t: t0 + 5 * 36e5}, t0); const r = {}; touch(r); return [Math.abs(r.upd - Date.now()) < 3000, Math.abs(nowS() - Date.now()) < 3000]; }), [true, true]);
    await A.click('#bSet'); await A.settle(200);
    eq('ترس الإعدادات فوق بيفتح الإعدادات', await A.evaluate(() => location.hash), '#set');
    await A.click('nav button[data-go=mkt]'); await A.settle(300);
    eq('سطر الوارد: المستني نقل ظاهر فوق الوارد', await A.evaluate(() => [!!$('#mkStat'), /مستنياك/.test($('#mkStat').textContent), $('#mkStat').getBoundingClientRect().top < $('#mkBody').getBoundingClientRect().top]), [true, true, true]);
    eq('أول شاشة بعد القفل: الوارد لو فيه حاجة مستنية', await A.evaluate(() => landingHash()), '#mkt');
    await A.setViewportSize({width: 1300, height: 800}); await A.settle(200);
    eq('اللاب: أول سطرين في القايمة الوارد وبعده الجرس وبعدهم العملاء', await A.evaluate(() => { const b = [...$('nav').children].filter(x => x.tagName === 'BUTTON' && getComputedStyle(x).display !== 'none'); return [b[0].dataset.go, b[1].id, b[2].dataset.go]; }), ['mkt', 'bBell', 'home']);
    await A.setViewportSize({width: 400, height: 860}); await A.settle(200);
    await A.click('nav button[data-go=home]'); await A.settle(200);
    eq('مفيش حاجة دخلت الحسابات لوحدها', [await bal(A, C1), await vbal(A, 'v_mkt'), await A.evaluate(() => db.entries.filter(e => e.id.startsWith('e_mk_')).length)], [bal0, 0, 0]);
    await A.click('nav button[data-go=mkt]'); await A.settle(200);
    const card = `#p-mkt [data-mv="${pid1}"]`;
    eq('الوارد متجمع بالعميل: 5,000 كاش + 3,000 تحويل = 8,000، والتحويل محسوب واصل من الأول (مفيش "وصل؟")', [(await A.textContent(`#p-mkt .mqg:has([data-mv="${pid1}"])`)).replace(/\s+/g, ' ').includes('5,000 كاش + 3,000 تحويل = 8,000'), await A.isDisabled(card), await A.$('#p-mkt [data-ok]')], [true, false, null]);
    eq('الوارد: "اتأخروا عن الدفع" من عملاء السوق بس', await A.evaluate(() => [mkLate().every(p => p.sec === 'mkt'), mkStatParts().late === lateParties().filter(p => p.sec === 'mkt').length]), [true, true]);
    eq('الوارد متقسم (جاهزين للنقل / محتاجين قرارك)، ومفيش زرار "رجّعها" في الوارد نفسه: جوه نافذة السطر', await A.evaluate(async () => {
      const r = [!!document.querySelector('#mkBody .mqsec [data-gs]'), !document.querySelector('#mkBody [data-bk]')];
      document.querySelector('#mkBody [data-gs] .mqw').click(); r.push(!!document.querySelector('#modal [data-bk]') && !!document.querySelector('#modal .mqop')); closeModal(); return r; }), [true, true, true]);
    await A.click(card); await A.settle(200);
    eq('شاشة التأكيد: الكاش ← خزنة السوق والتاريخ لوحده', await A.evaluate(() => [$$('#modal .mvr [data-f=v]').map(x => x.value)[0], $$('#modal .mvr [data-f=d]')[0].value, $('#modal').textContent.includes('عمليات')]), ['v_mkt', today, true]);
    await A.evaluate(() => { const s = $$('#modal .mvr [data-f=v]')[1]; s.value = ''; });   // التحويل: من غير خزنة (في حساب العميل بس)
    await A.click('#mvOk'); await A.settle(300);
    eq('النقل: العميل نزل 8,000، وخزنة السوق دخلها الكاش بس', [await bal(A, C1), await vbal(A, 'v_mkt')], [bal0 - 800000, 500000]);
    const twice = await A.evaluate(() => { const o = Object.values(db.mkt.ops).find(x => x.m === 'cash' && x.amt === 500000); const r = mkMove(o, {pid: o.cid, amt: o.amt, date: todayISO(), vault: 'v_mkt'}); return [r, db.entries.filter(e => e.id.startsWith('e_mk_') && !e.del).length]; });
    eq('مستحيل تتنقل مرتين', twice, [false, 2]);
    /* الكاش والتحويل من نفس العميل اتنقلوا مع بعض: في حسابه وكشفه سطر واحد "دفعة" بالإجمالي، والحركات نفسها لسه في خزنها */
    eq('حساب العميل: "دفعة" واحدة بـ 8,000 من غير تفاصيل (كاش/تحويل/حركة السوق)', await A.evaluate(pid => { const s = stmtData(pid, '', ''), mk = s.rows.filter(r => r.grp); const r = mk[mk.length - 1];
      return [mk.length, r.desc, r.ref, r.cr, r.grp.length, s.rows.some(x => /حركة السوق|إنستا|تحويل/.test(x.desc + x.ref))]; }, pid1), [1, 'دفعة', '', 800000, 2, false]);
    await openParty(A, C1);
    const gRow = await A.$('#p-party .ldg tr[data-g]');
    eq('سطر الدفعة المتجمعة في الجدول', [!!gRow, gRow && (await gRow.textContent()).includes('8,000')], [true, true]);
    await gRow.click(); await A.settle(150);
    eq('دوسة عليه: تفاصيله لمصطفى بس (جزئين بخزنهم)', await A.evaluate(() => [$$('#modal .pt[data-e]').length, $('#modal .dtot b').textContent]), [2, '8,000']);
    await A.evaluate(() => { closeModal(); go('mkt'); }); await A.settle(250);
    await M.evaluate(() => { lastAct = lastNew = Date.now() - 400000; poll(); });
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.settle(800);
    eq('لما يوصل جديد من مصطفى السحب بيرجع سريع لوحده', await M.evaluate(() => [Date.now() - lastNew < 60000, pollGap()]), [true, 5000]);
    eq('الشريك شاف ✓ اتنقلت، والرصيد عنده اتظبط', await M.evaluate(id => [liveOps().filter(o => opState(o) === 'done').length, customers().get(id).bal], pid1), [2, bal0 - 800000]);
    eq('بعد النقل الشريك لسه يقدر يعدّل ويمسح', await M.evaluate(() => { const o = liveOps().find(x => opState(x) === 'done'); nav('ok/' + o.id); return [!!$('#sDel'), !!$('#sEdit')]; }), [true, true]);

    await A.click('#p-mkt [data-mv^="n:"]'); await A.settle(200); await A.click('#lkNew'); await A.settle(150); await A.click('#mvOk'); await A.settle(300);
    eq('عميل جديد: اتفتحله حساب في عملاء السوق واتنقلت الدفعة', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل سوق جديد'); return p ? [p.sec, balance(p.id)] : null; }), ['mkt', -150000]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.settle(800);
    eq('عند الشريك: العميل الجديد بقى تحت الحساب الحقيقي', await M.evaluate(() => [...customers().values()].filter(c => c.name === 'عميل سوق جديد').map(c => [!!c.nw, c.id.startsWith('n_')])), [[false, false]]);

    await A.evaluate(() => cancelEntry(E.get('e_mk_' + Object.values(db.mkt.ops).find(x => x.m === 'cash' && x.amt === 500000).id))); await A.settle(200);
    await bg(A, 'mkSync()'); await A.settle(400);
    eq('مسح الحركة المنقولة من الحسابات: العملية رجعت "متنقلتش"', [await A.evaluate(() => mkPending().length), await bal(A, C1)], [1, bal0 - 300000]);
    await bg(M, 'sync()'); await M.settle(500);
    eq('والشريك شافها "مصطفى شالها" ومبتتحسبش في رصيد العميل', await M.evaluate(() => opState(liveOps().find(x => x.m === 'cash' && x.amt === 500000))), 'rm');

    await A.click('nav button[data-go=mkt]'); await A.settle(200);
    await A.click(`#p-mkt [data-gs="${pid1}"] .mqw`); await A.waitForSelector(`#modal [data-bk="${pid1}"]`); await A.click(`#modal [data-bk="${pid1}"]`); await A.fill('#rtN', 'المبلغ 4,500 مش 5,000'); await A.click('#rtOk'); await A.settle(300);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.settle(600);
    await M.evaluate(() => nav('')); await M.settle(150);
    eq('رجّعها: الشريك شاف 🔴 والملاحظة', [await M.evaluate(() => backs().length), (await M.textContent('#bk')).includes('رجّعلك')], [1, true]);
    await M.click('#bk'); await M.settle(200);
    eq('نافذة التصليح بتفتح على طول فيها ملاحظة مصطفى', (await M.textContent('#modal')).includes('المبلغ 4,500 مش 5,000'), true);
    await M.fill('#eA', '4500'); await M.click('#eOk'); await M.settle(1200);
    eq('تليجرام: رسالة التعديل', tgTexts().pop(), `✏️ اتعدلت: ${C1} دفع 5,000 كاش\nبقت: ${C1} دفع 4,500 كاش`);
    await bg(A, 'mkSync()'); await A.settle(300);
    eq('بعد التصليح رجعت لمصطفى تاني وعليها "اتصلحت"', [await A.evaluate(() => mkPending().length), (await A.textContent('#p-mkt')).includes('اتصلحت')], [1, true]);

    await M.evaluate(i => nav('p/' + i), pid1); await M.fill('#amt', '200'); await M.click('.big[data-m=tr]'); await M.settle(800);
    await M.click('#tdy .row[data-o]'); await M.settle(150); await M.click('#eDel'); await M.click('#aY'); await M.settle(1000);
    eq('تليجرام: رسالة المسح (من نفس صفحة العميل)', tgTexts().pop(), `🗑 اتمسحت: ${C1} دفع 200 تحويل`);
    await bg(A, 'mkSync()'); await A.settle(300);
    eq('اللي اتمسح مش في الوارد', await A.evaluate(() => mkPending().map(o => o.amt)), [450000]);

    await bg(B, 'syncNow()'); await B.settle(1500); await bg(B, 'mkSync()'); await B.settle(800);
    await bg(A, 'syncNow()'); await A.settle(1500);
    eq('جهاز حسابات تاني: خد ربط السوق لوحده ونفس الوارد، ومفيش خزنة سوق مكررة', [await B.evaluate(() => mkPending().map(o => o.amt)), await B.evaluate(() => db.vaults.filter(v => v.name === 'خزنة السوق').length), await A.evaluate(() => db.vaults.filter(v => v.name === 'خزنة السوق').length)], [[450000], 1, 1]);
    eq('الشيت: كل عملية مرة واحدة', new Set(mkRows('op').map(r => r[0])).size, mkRows('op').length);

    await D2.close();   // الجهاز التاني (B) خلص دوره في ١٦
    sec('١٧) حركة السوق (المرحلة التانية): صرفت وسلمت والتجميع والأرشيف');
    await M.evaluate(() => nav('')); await M.settle(200);
    const cash0 = await M.evaluate(() => cashNow());
    eq('اللي معاك كاش = الكاش اللي حصّلته (من غير التحويلات)', [cash0, await M.evaluate(() => liveOps().filter(o => o.t === 'pay' && o.m === 'cash').reduce((a, o) => a + o.amt, 0))], [cash0, 600000]);
    eq('الرئيسية فيها دفعة عميل وصرفت وسلمت لمصطفى', await M.evaluate(() => [...document.querySelectorAll('.qa2 button')].map(b => b.textContent)), ['💵دفعة أو فاتورة', '🏭بيع كاش من المصنع', '⛽صرفت', '🤝سلمت لمصطفى']);
    await M.click('#qSp'); await M.settle(200);
    eq('صرفت: خانة المبلغ مفتوحة وخانة يكتب فيها المصروف (من غير أنواع جاهزة)', await M.evaluate(() => [document.activeElement.id, document.querySelectorAll('.cat').length, !!$('#nt')]), ['amt', 0, true]);
    await M.fill('#amt', '200'); await M.click('#spOk'); await M.settle(300);
    eq('من غير اسم للمصروف: مبيتسجلش', [(await M.textContent('#toast')).includes('اكتب المصروف'), await M.evaluate(() => liveOps().filter(o => o.t === 'exp').length)], [true, 0]);
    await M.fill('#nt', 'بنزين'); await M.click('#spOk'); await M.settle(1200);
    eq('اتسجل مصروف بنزين: إشعار صغير ونفس الشاشة (مفيش صفحة كاملة) واتخصم من اللي معاه', [(await M.textContent('#toast')).includes('اتسجل: بنزين'), await M.evaluate(() => [scr.v, $('#nt').value, $$('#spList .row').length]), await M.evaluate(() => cashNow())], [true, ['spend', '', 1], cash0 - 20000]);
    eq('تليجرام: رسالة المصروف', tgTexts().pop(), '⛽ مصروف بنزين: 200');
    const expId = await M.evaluate(() => liveOps().find(o => o.t === 'exp').id);
    await M.evaluate(() => nav('')); await M.settle(150);
    await M.click(`.row[data-o="${expId}"]`); await M.settle(200);
    eq('تعديل المصروف من الرئيسية بدوسة: الرقم القديم والنوع ظاهرين', [await M.inputValue('#eA'), await M.inputValue('#eNt')], ['200', 'بنزين']);
    await M.fill('#eA', '250'); await M.fill('#eNt', 'مواصلات'); await M.click('#eOk'); await M.settle(1200);
    eq('تليجرام: رسالة تعديل المصروف', tgTexts().pop(), '✏️ اتعدلت: مصروف بنزين: 200\nبقت: مصروف مواصلات: 250');
    await M.evaluate(() => nav('')); await M.click('#qSp'); await M.click('#spT button[data-v=spay]'); await M.fill('#sn', 'مورد تجربة'); await M.fill('#amt', '3000'); await M.click('#spOk'); await M.settle(1200);
    eq('دفعة لمورد (باسم مكتوب بإيده) اتسجلت: إشعار وفي القايمة تحت', [(await M.textContent('#toast')).includes('اتسجل: مورد تجربة'), tgTexts().pop(), await M.evaluate(() => $$('#spList .row').length)], [true, '🏭 دفع للمورد مورد تجربة 3,000', 1]);
    eq('الأسامي اللي كتبها قبل كده بتطلع يختار منها (من غير قايمة موردين)', await M.evaluate(() => [...document.querySelectorAll('#spBody .chip')].map(c => c.textContent)), ['مورد تجربة']);
    await M.evaluate(() => nav('')); await M.click('#qHand'); await M.fill('#hAmt', '1000'); await M.click('#hOk'); await M.settle(1200);
    eq('سلمت لمصطفى كاش اتسجلت (إشعار وفضل في الرئيسية)، وتليجرام', [await M.textContent('#toast'), await M.evaluate(() => scr.v), tgTexts().pop()], ['✔ اتسجل: سلمت لمصطفى 1,000', 'home', '🤝 سلّمك 1,000 كاش']);
    eq('معاه دلوقتي = كاش − مصروف − مورد − اللي سلمه', await M.evaluate(() => cashNow()), cash0 - 25000 - 300000 - 100000);
    await M.evaluate(() => nav('')); await M.settle(200);
    eq('الرئيسية: اللي معاه وإجمالي النهارده (حصّلت | صرفت | سلّمت لمصطفى)', await M.evaluate(() => [$('#cashT').textContent, [...document.querySelectorAll('.panel .pn b')].map(b => b.textContent), document.querySelectorAll('#main .row[data-o]').length]), ['1,750', ['9,000', '3,250', '4,000'], 6]);
    await M.click('#tabs button[data-t=a]'); await M.settle(200);
    eq('الأرشيف: إجمالي الأسبوع (حصّلت | صرفت | سلّمت لمصطفى | معايا)', await M.evaluate(() => [...document.querySelector('.wk tfoot tr').querySelectorAll('td')].slice(1).map(b => b.textContent.trim())), ['9,000', '3,250', '4,000', '1,750']);
    eq('الأرشيف: سطر النهارده بنفس الأرقام ومعاه اسم اليوم', await M.evaluate(() => { const r = [...document.querySelectorAll('.wk tr[data-d]')[0].querySelectorAll('td')].map(x => x.textContent.trim()); return [r.slice(1), r[0].startsWith(AR_DAYS[dowOf(today())])]; }), [['9,000', '3,250', '4,000', '1,750'], true]);
    await M.click('.wk tr[data-d]'); await M.settle(200);
    eq('يوم النهارده: كل حركاته (6) وإجماليه', await M.evaluate(() => [document.querySelectorAll('#main .row[data-o]').length, [...document.querySelector('.panel .pn').querySelectorAll('b')].map(b => b.textContent)]), [6, ['9,000', '3,250', '4,000', '1,750']]);
    await M.click('#aPrev'); await M.settle(150);
    eq('اليوم اللي قبله فاضي، وسهم التالي بيرجع النهارده', [await M.evaluate(() => document.querySelectorAll('#main .row[data-o]').length), (await M.textContent('#main')).includes('مفيش حركات في اليوم ده'), await M.isDisabled('#aNext')], [0, true, false]);
    await M.click('#aNext'); await M.settle(150);
    eq('بعد النهارده السهم مقفول', await M.isDisabled('#aNext'), true);
    await M.evaluate(() => nav('a/2020-03-05')); await M.settle(150);
    eq('أي يوم قديم بالتاريخ بيفتح', (await M.textContent('.dnav span')).includes('2020'), true);
    /* تعديل ومسح أي حركة بسهولة، من الأرشيف كمان */
    await M.evaluate(() => nav('')); await M.click('#qSp'); await M.fill('#amt', '10'); await M.fill('#nt', 'أكل'); await M.click('#spOk'); await M.settle(500);
    const tmpId = await M.evaluate(() => liveOps().find(o => o.t === 'exp' && o.cat === 'أكل').id);
    await M.evaluate(() => nav('a/' + today())); await M.settle(150); await M.click(`.row[data-o="${tmpId}"]`); await M.settle(150);
    await M.fill('#eA', '20'); await M.click('#eOk'); await M.settle(500);
    eq('تعديل مصروف من الأرشيف', await M.evaluate(id => [S.ops[id].amt, cashNow()], tmpId), [2000, 175000 - 2000]);
    await M.click(`.row[data-o="${tmpId}"]`); await M.settle(150); await M.click('#eDel'); await M.click('#aY'); await M.settle(500);
    eq('مسح مصروف بنافذة التعديل، واللي معاه رجع زي ما كان', await M.evaluate(id => [S.ops[id].del, cashNow()], tmpId), [true, 175000]);
    await M.click('#tabs button[data-t=s]'); await M.settle(150); await M.click('#uiTheme button[data-v=dark]');
    eq('الإعدادات: داكن بيشتغل ويتحفظ على الموبايل', await M.evaluate(() => [document.documentElement.dataset.theme, JSON.parse(localStorage.getItem('fo_ui')).theme]), ['dark', 'dark']);
    await M.click('#uiTheme button[data-v=light]'); await M.click('#uiFs button[data-v="1.12"]');
    eq('الإعدادات: فاتح وحجم خط كبير', await M.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.fs]), ['light', 'z']);
    await M.click('#uiFs button[data-v="1"]');     /* قفل السوق بكلمة سر */
    await M.fill('#pin1', '123456'); await M.fill('#pin2', '123456'); await M.click('#pinOn'); await M.waitForSelector('#pinNow');
    eq('قفل السوق: اتحفظ ملح وبصمة من غير كلمة السر نفسها', await M.evaluate(() => { const o = JSON.parse(localStorage.getItem('fo_mkt_lock')); return [!!o.s, !!o.h, JSON.stringify(o).includes('123456')]; }), [true, true, false]);
    await M.click('#pinNow'); await M.waitForSelector('#lock.on #lkP');
    await M.evaluate(() => { const i = document.querySelector('#lkP'); i.readOnly = false; i.value = '111111'; }); await M.click('#lkGo');
    await M.waitForFunction(() => /غلط/.test(document.querySelector('#lkErr').textContent));
    eq('قفل السوق: كلمة غلط متفتحش', await M.evaluate(() => document.querySelector('#lock').classList.contains('on')), true);
    await M.evaluate(() => { const i = document.querySelector('#lkP'); i.value = '123456'; }); await M.click('#lkGo');
    await M.waitForFunction(() => !document.querySelector('#lock').classList.contains('on'));
    await M.click('#pinOff'); await M.fill('#apP', '123456'); await M.click('#apOk'); await M.waitForSelector('#pinOn');
    eq('قفل السوق: اتشال', await M.evaluate(() => localStorage.getItem('fo_mkt_lock')), null);
    await M.evaluate(() => nav('')); await M.settle(100);

    await bg(A, 'mkSync()'); await A.settle(900);
    await A.click('nav button[data-go=mkt]'); await A.settle(250);
    eq('الوارد عند مصطفى: 4 عمليات متنقلتش (كاش عميل + مصروف + مورد + تسليم)', await A.evaluate(() => [mkPending().length, mkPending().map(o => o.t).sort()]), [4, ['exp', 'hand', 'pay', 'spay']]);
    eq('مفيش حاجة دخلت الحسابات لوحدها (لا خزنة ولا مورد)', await A.evaluate(() => [vaultBal('v_mkt'), db.txs.filter(t => t.id.startsWith('t_mk_')).length, db.entries.filter(e => e.id.startsWith('e_mk_') && !e.del).length]), [150000, 0, 2]);
    const supB0 = await bal(A, 'مورد تجربة'), mainB0 = await vbal(A, 'v_main'), exp0 = await A.evaluate(() => profitOf(todayISO().slice(0, 4) + '-01-01', todayISO()).exp);
    await A.click('#p-mkt [data-mv="x:exp"]'); await A.settle(200);
    eq('تأكيد المصروف: من فلوس الشريك لوحده من غير اختيار خزنة', await A.evaluate(() => [$('#modal [data-f=v]').value, !$('#modal select[data-f=v]'), $('#modal').textContent.includes('مع شريكك'), $('#modal').textContent.includes('مصاريف السوق')]), ['v_mkt', true, true, true]);
    await A.click('#mvOk'); await A.settle(300);
    eq('المصروف اتنقل كمصروف خزنة تحت "مصاريف السوق"، وخزنة السوق نزلت، وطلع في الأرباح', await A.evaluate(([e0]) => { const t = IDX.tx.get('t_mk_' + Object.values(db.mkt.ops).find(o => o.t === 'exp').id); return [t.type, t.cat, cName(t.cat), t.amt, vaultBal('v_mkt'), profitOf(todayISO().slice(0, 4) + '-01-01', todayISO()).exp - e0]; }, [exp0]), ['exp', 'c_mkexp', 'مصاريف السوق', 25000, 125000, 25000]);
    await A.click('#p-mkt [data-mv^="s:"]'); await A.settle(250);
    eq('دفعة المورد زي العميل الجديد: بتطلب ربط بحساب مورد', [(await A.textContent('#modal h3')).includes('مورد'), await A.evaluate(() => [...document.querySelectorAll('#lkL .pt .m b')].map(x => x.textContent))], [true, ['مورد تجربة']]);
    await A.click('#lkL .pt'); await A.settle(250);
    await A.click('#mvOk'); await A.settle(300);
    eq('اتنقلت للمورد كدفعة (ppay) من خزنة السوق، ورصيد المورد اتغير', await A.evaluate(([b0]) => { const e = E.get('e_mk_' + Object.values(db.mkt.ops).find(o => o.t === 'spay').id); return [e.kind, e.vault, e.amt, balance(e.party) - b0, vaultBal('v_mkt')]; }, [supB0]), ['ppay', 'v_mkt', 300000, 300000, -175000]);
    await A.click('#p-mkt [data-mv="x:hand"]'); await A.settle(250);
    eq('الاستلام: بيختار بس الخزنة اللي استلم فيها (خزنة السوق مش في الاختيارات)', await A.evaluate(() => [$('#modal [data-f=v]').value, $('#modal [data-f=t]').value, [...$('#modal select[data-f=t]').options].some(o => o.value === 'v_mkt')]), ['v_mkt', 'v_main', false]);
    await A.click('#mvOk'); await A.settle(300);
    eq('الكاش المسلَّم اتنقل كتحويل خزنة لخزنة', await A.evaluate(([m0]) => { const t = IDX.tx.get('t_mk_' + Object.values(db.mkt.ops).find(o => o.t === 'hand').id); return [t.type, t.vault, t.to, t.amt, vaultBal('v_mkt'), vaultBal('v_main') - m0]; }, [mainB0]), ['tr', 'v_mkt', 'v_main', 100000, -275000, 100000]);
    await A.click('#p-mkt [data-mv]'); await A.settle(250); await A.click('#mvOk'); await A.settle(300);
    const finalCash = await M.evaluate(() => cashNow());
    eq('بعد نقل الكل: خزنة السوق (المخفية) = اللي مع الشريك، ورصيدها ظاهر فوق في حركة السوق للعرض بس', [await vbal(A, 'v_mkt'), finalCash, await A.evaluate(() => mkPending().length), (await A.textContent('#mkStat [data-st=cash] b')).replace(/\D/g, '') === String(finalCash / 100), !!(await A.$('#mkStat input, #mkStat button'))], [175000, 175000, 0, true, false]);
    eq('خزنة السوق: مش في الاختيارات ولا vaultBal("")، بس ليها سطر أزرق فوق و"إجمالي النقدية" فيه فلوسها (زي الدفتر)', await A.evaluate(() => {
      const all = db.vaults.filter(v => !v.del && v.id !== 'v_mkt').reduce((s, v) => s + vaultBal(v.id), 0);
      cashVault = ''; go('cash'); renderCash(); const r = [vaultsL().some(v => v.id === 'v_mkt'), vaultOpts('').includes('v_mkt'), vaultBal('') === all, !!$('#p-cash .kbk'), +$('#p-cash [data-ck="c:total"]').dataset.cnt === all + vaultBal('v_mkt'), +$('#p-cash [data-ck="c:me"]').dataset.cnt === all,
        vaultMoves('', todayISO(), todayISO()).some(m => m.who === 'كاش من شريك السوق' && m.sign === 1), vaultMoves('', todayISO(), todayISO()).some(m => m.r.vault === 'v_mkt' && m.r.type !== 'tr')];
      go('mkt'); return r; }), [false, false, true, true, true, true, true, false]);
    eq('الدوس على خزنة السوق: آخر أسبوعين بترتيب التسجيل (الأحدث فوق)، ومفيش "سلّمك"', await A.evaluate(() => {
      cashVault = ''; go('cash'); renderCash(); const k = $('#kMk'), noHand = !k.textContent.includes('سلّمك'); k.click();
      const at = m => m.at || Date.parse(m.date + 'T12:00:00'), exp = vaultMoves('v_mkt').filter(m => at(m) >= Date.now() - 14 * 864e5).sort((a, b) => at(b) - at(a));
      const rows = [...$$('#modal .kit b:first-child')].map(b => b.textContent), ok = rows.length === exp.length && rows.length > 0 && rows.every((w, i) => w === exp[i].who);
      closeModal(); go('mkt'); return [noHand, ok]; }), [true, true]);
    eq('الخزنة: كارت حركتي وكارت السوق مع بعض: دخل/طلع = مجموع الأنواع، مفيش رصيد أول/آخر، والدوس على نوع بيفتح حركاته، والدوس على خزنة بيفلتر عليها', await A.evaluate(() => {
      cashMode = 'day'; cashDay = ''; cashVault = ''; cashOpenV = false; go('cash'); renderCash();
      const tx = k => [...$$('#kst-' + k + ' .kty .l')].map(x => x.textContent);
      const sumOk = k => { const rows = t => [...$$('#kst-' + k + ' .kty.kt' + t + ' .n')].reduce((n, e) => n + Math.round(parseFloat(e.textContent.replace(/,/g, '')) * 100), 0);
        return +$('#kst-' + k + ' .kin .n').dataset.cnt === rows('in') && +$('#kst-' + k + ' .kout .n').dataset.cnt === rows('out'); };
      const me = tx('me'), mk = tx('mk');
      const r = [!!$('#kst-mk'), $('#p-cash .kvs').hidden, me.some(x => x.includes('استلام من أحمد')), !me.some(x => x.includes('مصروفات من')), mk.some(x => x.includes('تحصيل من العملاء')), mk.some(x => x.includes('دفعات موردين من أحمد')), mk.some(x => x.includes('مصروفات من أحمد')), mk.some(x => x.includes('سلّم لمصطفى كاش')), sumOk('me'), sumOk('mk'), !/رصيد أول|رصيد آخر/.test($('#p-cash .kss').textContent)];
      const ty = $('#kst-me .kty'); ty.click();
      r.push($('#mask').classList.contains('on') && $$('#modal .kit').length === +ty.querySelector('em').textContent); closeModal();
      $('#kMe').click(); r.push($('#p-cash .kvs').hidden);
      const v = $('#p-cash .kv'), id = v.dataset.v; v.click();
      r.push(cashVault === id, $('#kst-me .ksh').textContent.includes(vName(id)), sumOk('me'));
      cashVault = ''; cashOpenV = false; go('mkt'); return r; }), [true, true, true, true, true, true, true, true, true, true, true, true, false, true, true, true]);
    eq('تسوية الجرد: بتظبط الرصيد بس، ومش بتبان في الخزنة ولا في مصروفات الأرباح', await A.evaluate(() => {
      const y0 = todayISO().slice(0, 4) + '-01-01', p0 = profitOf(y0, todayISO()).exp, b0 = vaultBal('');
      const t = {id: 'x_adjtest', type: 'exp', amt: 12300, vault: vaultsL()[0].id, cat: ensureAdjCat('exp'), note: 'جرد تجربة', date: todayISO(), at: nowS(), upd: nowS(), del: false, hist: []};
      db.txs.push(t); IDX.tx.set(t.id, t); cashVault = ''; cashMode = 'day'; cashDay = ''; go('cash'); renderCash();
      const r = [vaultBal('') === b0 - 12300, profitOf(y0, todayISO()).exp === p0, !$('#p-cash .kss').textContent.includes('تسوية'), !$('#p-cash .kss').textContent.includes('جرد تجربة')];
      t.del = true; touch(t); saveDB(); go('mkt'); return r; }), [true, true, true, true]);
    eq('الخزنة: "عملاء السوق" في حركتي (كريم حوّلك وتحته إجمالي الدفعة)، وفي حركة السوق التحصيل كامل سطر لكل عميل وتحته "تحويل لمصطفى و عهدة مع أحمد" وقصاده "تحويل لمصطفى"، والشركاء سطر لوحده، واللي مفيهوش حركة مبيظهرش (حتى كارت السوق)', await A.evaluate(() => {
      const d = todayISO(), now = nowS(), pid = mkEnsureParty('mkt', {newName: 'عميل سوق تجربة التحويل'});
      const e1 = addEntry({party: pid, kind: 'pay', amt: 100000, date: d, vault: 'v_mkt', method: 'نقدي', note: 'حركة السوق'}), e2 = addEntry({party: pid, kind: 'pay', amt: 50000, date: d, vault: 'v_main', method: 'تحويل', note: 'حركة السوق — إنستا'});
      [e1, e2].forEach(applyAmounts);
      const t = {id: 'x_pttest', type: 'exp', amt: 7700, vault: 'v_main', cat: 'c_pdraw', pt: 'pt_x', note: 'مسحوبات تجربة', date: d, at: now, upd: now, del: false, hist: []};
      db.txs.push(t); IDX.tx.set(t.id, t);
      const me = kstHtml('me', '', 'me', vaultMoves('', d, d), 'me'), mk = kstHtml('mk', '', 'mkt', vaultMoves('v_mkt', d, d).concat(mkXfers(d, d)), 'mk');
      const g = (mk.by.col || []).find(m => m.parts && m.r.party === pid);
      cashMode = 'day'; cashDay = ''; cashVault = ''; go('cash'); renderCash();
      const mc = (me.by.mkcol || []).find(m => m.r === e2);
      const r = [!!mc && [mc.who, mc.what, mc.amt].join('|'), !(me.by.col || []).some(m => m.r === e2), !!g && g.amt, g && g.what, (mk.by.mkTr || []).some(m => m.r === e2 && m.amt === 50000),
        (me.by.part || []).some(m => m.r === t), !(me.by.exp || []).some(m => m.r === t), !!$('#kst-me [data-k="me:mkcol"]'), !!$('#kst-mk [data-k="mk:mkTr"]'), $$('#kst-me .kty').length === Object.keys(me.by).length && Object.values(me.by).every(a => a.length) && !!$('#kst-me [data-k="me:ivcap"]') === !!me.by.ivcap];
      $('#kst-mk [data-k="mk:col"]').click();
      const kit = [...$$('#modal .kit')].find(x => x.textContent.includes('عميل سوق تجربة التحويل')); kit.click();
      r.push($$('#modal .kit').length); closeModal();
      cashDay = '2001-01-01'; renderCash(); r.push(!$('#kst-mk'), $('#p-cash .kss').className); cashDay = '';
      [e1, e2, t].forEach(x => { x.del = true; touch(x); }); P.get(pid).del = true; touch(P.get(pid)); saveDB(); go('mkt'); return r; }),
      ['عميل سوق تجربة التحويل حوّلك|إجمالي الدفعة 1,500|50000', true, 150000, '500 تحويل لمصطفى و 1,000 عهدة مع أحمد', true, true, true, true, true, true, 2, true, 'kss']);
    /* الشريك كتب مصروف وهو دفعة لمورد: مصطفى بيحوّلها من عنده، وبيرجّعها لو غلط */
    const cv0 = await A.evaluate(() => { const o = Object.values(db.mkt.ops).find(o => o.t === 'exp'); return {id: o.id, mk: vaultBal('v_mkt'), exp: profitOf(todayISO().slice(0, 4) + '-01-01', todayISO()).exp}; });
    await A.evaluate(() => { cashSide = 'mkt'; go('cash'); }); await A.settle(300);   // الصفحة بتفتح بعد تغيير العنوان (وبتقفل أي نافذة)
    await A.evaluate(id => mkOpMenu(db.mkt.ops[id]), cv0.id); await A.settle(150);
    await A.click('#omS'); await A.settle(150); await A.fill('#spQ', 'مورد تجربة'); await A.settle(100); await A.click('#spL .pt'); await A.settle(300);
    eq('تحويل مصروف الشريك لدفعة مورد: المصروف اتشال، ودفعة مورد من خزنة السوق بنفس المبلغ، ورصيد السوق زي ما هو، والأرباح نزل منها', await A.evaluate(c => {
      const o = db.mkt.ops[c.id], t = IDX.tx.get('t_mk_' + c.id), e = E.get('e_mk_' + c.id);
      return [t.del, e.kind, e.vault, e.amt, mkT(o), mkState(o), vaultBal('v_mkt') === c.mk, c.exp - profitOf(todayISO().slice(0, 4) + '-01-01', todayISO()).exp, $$('#kst-mk .kty .l').some(x => x.textContent.includes('مصروفات من'))]; }, cv0), [true, 'ppay', 'v_mkt', 25000, 'spay', 'done', true, 25000, false]);
    await A.evaluate(id => mkOpMenu(db.mkt.ops[id]), cv0.id); await A.settle(150); await A.click('#omE'); await A.settle(150); await A.click('#aeOk'); await A.settle(300);
    eq('"رجّعها مصروف" بترجّعها زي ما كانت', await A.evaluate(c => { const o = db.mkt.ops[c.id]; return [IDX.tx.get('t_mk_' + c.id).del, E.get('e_mk_' + c.id).del, mkT(o), mkState(o), vaultBal('v_mkt') === c.mk, profitOf(todayISO().slice(0, 4) + '-01-01', todayISO()).exp === c.exp]; }, cv0), [false, true, 'exp', 'done', true, true]);
    await A.evaluate(() => { cashSide = 'me'; go('mkt'); });
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.settle(900);
    eq('الشريك شاف ✓ على كل حاجة (من غير مسح)', await M.evaluate(() => [liveOps().filter(o => !['done', 'exp'].includes(opState(o))).length, liveOps().length]), [0, 6]);
    await A.evaluate(() => { const t = IDX.tx.get('t_mk_' + Object.values(db.mkt.ops).find(o => o.t === 'hand').id); t.del = true; touch(t); saveDB(); });
    await bg(A, 'mkSync()'); await A.settle(300);
    eq('لو مسح حركة الكاش المنقولة: التسليم يرجع "متنقلش"', await A.evaluate(() => mkPending().map(o => o.t)), ['hand']);
    await A.evaluate(() => { const o = mkPending()[0]; mkMove(o, {amt: o.amt, date: todayISO(), vault: 'v_mkt', to: 'v_main'}); saveDB(); });
    eq('وإعادة النقل بتعيد نفس الحركة من غير ما تتكرر', await A.evaluate(() => [mkPending().length, db.txs.filter(t => t.id.startsWith('t_mk_') && !t.del).length, db.txs.filter(t => t.id.startsWith('t_mk_')).length]), [0, 2, 2]);
    await A.click('#mkTabs button[data-v=arch]'); await A.settle(250);
    eq('أرشيف مصطفى: اليوم بحركات الشريك كلها وإجمالي اليوم', await A.evaluate(() => [document.querySelectorAll('#mkBody .mqr').length, [...document.querySelectorAll('#mkBody .mkbal .bl b')].map(b => b.textContent)]), [6, ['9,000', '4,000', '3,250', '1,750']]);
    await A.click('#maPrev'); await A.settle(200);
    eq('أرشيف مصطفى: اليوم اللي قبله فاضي', (await A.textContent('#mkBody')).includes('مفيش حركات من الشريك في اليوم ده'), true);
    eq('أرشيف مصطفى: يوم/أسبوع/شهر/من–إلى، والأسبوع والشهر والفترة فيهم حركات النهارده بنفس الحساب، والشهر اللي قبله فاضي', await A.evaluate(() => {
      mkDay = todayISO(); mkArch();
      const r = [[...$$('#maMode button')].map(b => b.textContent).join(',')], tot = () => [$$('#mkBody .mqr').length, [...$$('#mkBody .mkbal .bl b')].map(b => b.textContent).join(' ')];
      for (const m of ['week', 'month', 'range']) { $(`#maMode [data-m=${m}]`).click(); r.push(m, ...tot(), !!$('#maPrev'), $('#mkBody .mqsh b').textContent); }
      $('#maMode [data-m=month]').click(); $('#maPrev').click(); r.push($('#mkBody').textContent.includes('مفيش حركات من الشريك في الشهر ده'));
      $('#maMode [data-m=day]').click(); r.push(mkAMode, !!$('#maDay')); mkDay = ''; return r; }),
      ['يوم,أسبوع,شهر,من–إلى', 'week', 6, '9,000 4,000 3,250 1,750', true, 'حساب الأسبوع عند شريكك', 'month', 6, '9,000 4,000 3,250 1,750', true, 'حساب الشهر عند شريكك',
        'range', 6, '9,000 4,000 3,250 1,750', false, 'حساب الفترة عند شريكك', true, 'day', true]);
    await A.click('#mkTabs button[data-v=in]');
    eq('الشيت: كل عملية مرة واحدة برضه', new Set(mkRows('op').map(r => r[0])).size, mkRows('op').length);

    sec('١٨) حركة السوق: فاتورة بإجمالي بس من الشريك، ومصطفى بيكتب بنودها');
    for (let i = 0; i < 4; i++) { await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.settle(700); }   // الشريك ياخد آخر حالات وأرصدة قبل ما نقيس
    await M.waitForFunction(() => liveOps().every(o => ['done', 'exp'].includes(opState(o))), null, {timeout: 20000});
    const bI0 = await bal(A, C1), cashB = await M.evaluate(() => cashNow());
    await M.evaluate(i => { pyTab = 'pay'; nav('p/' + i); }, pid1); await M.settle(200);
    eq('شاشة العميل: دفعة أو فاتورة (الدفعة هي الافتراضي)', await M.evaluate(() => [[...document.querySelectorAll('#pyT button')].map(b => b.dataset.v), document.querySelector('#pyT button.on').dataset.v, document.querySelectorAll('#pyBtns .big[data-m]').length]), [['pay', 'inv', 'rt'], 'pay', 2]);
    await M.click('#pyT button[data-v=inv]'); await M.fill('#amt', '10000'); await M.click('#invOk'); await M.settle(1200);
    eq('فاتورة إجمالي بس: إشعار وفضل في صفحة العميل، وتليجرام', [await M.textContent('#toast'), await M.evaluate(() => [scr.v, $('#amt').value, $('#tdy').textContent.includes('10,000')]), tgTexts().pop()], ['✔ اتسجلت فاتورة 10,000', ['pay', '', true], `🧾 ${C1} فاتورة بـ 10,000`]);
    eq('الفاتورة اتضافت على حساب العميل عند الشريك لوحدها، واللي معاه كاش مبيتغيرش', await M.evaluate(([id, c0]) => [customers().get(id).bal - S.cust[id].bal, cashNow() - c0], [pid1, cashB]), [1000000, 0]);
    await M.click('#pyT button[data-v=pay]'); await M.settle(150);
    await M.fill('#amt', '3300'); await M.click('.big[data-m=cash]'); await M.settle(1200);
    eq('"العميل دفع حاجة دلوقتي؟" فتح شاشة الدفعة ونزلت من حسابه، واللي معاه زاد 3,300', await M.evaluate(([id, c0]) => [customers().get(id).bal - S.cust[id].bal, cashNow() - c0], [pid1, cashB]), [670000, 330000]);
    await M.evaluate(() => nav('')); await M.settle(150);
    eq('الرئيسية عند الشريك: الفواتير في سطر لوحدها ومبتدخلش في حصّلت', await M.evaluate(() => [document.querySelector('.invln b').textContent, [...document.querySelectorAll('.panel .pn b')].map(b => b.textContent)[0]]), ['10,000', '12,300']);

    await A.evaluate(() => { mkView = 'in'; go('mkt'); mkSync(); }); await A.settle(900);
    const invOp = await A.evaluate(() => mkPending().find(o => o.t === 'inv').id);
    eq('الوارد عند مصطفى: الفاتورة والدفعة مع بعض، ومفيش حاجة دخلت الحسابات', [await A.evaluate(() => mkPending().map(o => o.t).sort()), await bal(A, C1), await A.$(`#p-mkt [data-inv="${invOp}"]`) !== null, await A.$(`#p-mkt [data-mv="${pid1}"]`) !== null], [['inv', 'pay'], bI0, true, true]);
    await A.click(`#p-mkt [data-inv="${invOp}"]`); await A.settle(300); await A.click('#iqItems'); await A.settle(300);
    eq('نافذة الفاتورة: إجمالي شريكك ظاهر والتاريخ بتاعه، ومفيش خانة "دفع دلوقتي"', [(await A.textContent('#modal')).includes('فاتورة من شريكك'), await A.inputValue('#dcDate'), await A.$('#dcPaid')], [true, today, null]);
    await A.fill('.li [data-f=name]', 'لفة تجربة 16 مم'); await A.dispatchEvent('.li [data-f=name]', 'change'); await A.fill('.li [data-f=qty]', '10'); await A.fill('.li [data-f=price]', '500');
    eq('الفرق عن إجمالي شريكك بيظهر', (await A.textContent('#dcMk')).includes('الفرق'), true);
    await A.click('#dcOk'); await A.settle(150);
    eq('لو الإجمالي مش مطابق: تحذير ومبيتسجلش', [(await A.textContent('#dcWarn')).includes('مش مساوي'), await bal(A, C1)], [true, bI0]);
    await A.fill('.li [data-f=qty]', '20');
    eq('بعد التظبيط: مطابق', (await A.textContent('#dcMk')).includes('مطابق'), true);
    await A.click('#dcOk'); await closed(A); await A.settle(300);
    eq('الفاتورة اتسجلت بالبنود على حساب العميل، بنفس تاريخ الشريك وبـ id ثابت', await A.evaluate(([id, pid]) => { const e = E.get('e_mk_' + id); return [e.kind, e.party === pid, docTotal(e), e.lines.length, e.date]; }, [invOp, pid1]), ['inv', true, 1000000, 1, today]);
    eq('رصيد العميل زاد 10,000 والدفعة لسه مستنياك', [await bal(A, C1) - bI0, await A.evaluate(() => mkPending().map(o => o.t))], [1000000, ['pay']]);
    await A.click(`#p-mkt [data-mv="${pid1}"]`); await A.settle(250); await A.click('#mvOk'); await A.settle(300);
    eq('نقل الدفعة: الرصيد = القديم + الفاتورة − الدفعة، وخزنة السوق = اللي مع الشريك', [await bal(A, C1) - bI0, await vbal(A, 'v_mkt'), cashB + 330000], [670000, cashB + 330000, cashB + 330000]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.settle(900);
    await M.waitForFunction(([id, v]) => liveOps().every(o => ['done', 'exp'].includes(opState(o))) && customers().get(id).bal === v, [pid1, bI0 + 670000], {timeout: 15000}).catch(() => {});
    eq('الشريك شاف ✓ على الاتنين ورصيد العميل عنده = رصيد الحسابات', await M.evaluate(id => [liveOps().filter(o => !['done', 'exp'].includes(opState(o))).length, customers().get(id).bal], pid1), [0, bI0 + 670000]);
    await A.evaluate(id => cancelEntry(E.get('e_mk_' + id)), invOp); await A.settle(200); await bg(A, 'mkSync()'); await A.settle(300);
    eq('لو مسح الفاتورة من الحسابات: ترجع "متنقلتش"', await A.evaluate(() => mkPending().map(o => o.t)), ['inv']);
    await bg(M, 'sync()'); await M.waitForFunction(id => customers().get(id).bal === S.cust[id].bal && S.cust[id].bal !== undefined, pid1, {timeout: 15000}).catch(() => {});
    eq('والشريك: رصيد العميل عنده = رصيد الحسابات بعد المسح، والفاتورة عليها "مصطفى شالها"', [await M.evaluate(id => customers().get(id).bal, pid1), await bal(A, C1), await M.evaluate(id => [opState(S.ops[id]), stHtml(S.ops[id]).includes('شالها')], invOp)], [bI0 - 330000, bI0 - 330000, ['rm', true]]);
    await A.click(`#p-mkt [data-inv="${invOp}"]`); await A.settle(300); await A.click('#iqItems'); await A.settle(300); await A.click('#dcOk'); await closed(A); await A.settle(300);
    eq('وإعادة كتابتها بترجع نفس الفاتورة من غير تكرار', await A.evaluate(id => [mkPending().length, db.entries.filter(e => e.id === 'e_mk_' + id).length, E.get('e_mk_' + id).del], invOp), [0, 1, false]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.waitForFunction(id => opState(S.ops[id]) === 'done', invOp, {timeout: 15000}).catch(() => {});
    eq('بعد ما اتنقلت تاني: الشريك شايفها اتنقلت والرصيد زي الحسابات', await M.evaluate(([id, pid]) => [opState(S.ops[id]), customers().get(pid).bal], [invOp, pid1]), ['done', bI0 + 670000]);

    /* مرتجع / شغل: مبلغ + ملاحظة بيتخصم من حساب العميل، من غير ما يلمس الكاش ولا أي خزنة */
    const rB0 = await bal(A, C1), rV0 = await vbal(A, 'v_mkt'), rC0 = await M.evaluate(() => cashNow());
    await M.evaluate(i => { pyTab = 'pay'; nav('p/' + i); }, pid1); await M.settle(200);
    eq('صفحة العميل: 3 تابات (دفعة / فاتورة / مرتجع-شغل)', await M.evaluate(() => $$('#pyT button').map(b => b.dataset.v)), ['pay', 'inv', 'rt']);
    await M.click('#pyT button[data-v=rt]'); await M.fill('#amt', '1500'); await M.click('#rtOk'); await M.settle(300);
    eq('مرتجع من غير ملاحظة: بيطلب الملاحظة ومبيتسجلش', [(await M.textContent('#toast')).includes('ملاحظة'), await M.evaluate(() => liveOps().filter(o => o.t === 'rt').length)], [true, 0]);
    await M.fill('#rtN', 'مرتجع 2 لفة 16 مم'); await M.click('#rtOk'); await M.settle(1200);
    const rtOp = await M.evaluate(() => liveOps().find(o => o.t === 'rt').id);
    eq('مرتجع/شغل اتسجل: إشعار وفضل في صفحة العميل، واتخصم من رصيده عند الشريك، والكاش زي ما هو، وتليجرام', [await M.textContent('#toast'), await M.evaluate(() => [scr.v, pyTab, $('#amt').value, $('#rtN').value, $('#tdy').textContent.includes('مرتجع 2 لفة')]), await M.evaluate(([id, c0]) => [customers().get(id).bal - S.cust[id].bal, cashNow() - c0], [pid1, rC0]), tgTexts().pop().replace(/^\S+ /, '')],
      ['✔ اتسجل مرتجع/شغل 1,500 — اتخصم من حسابه', ['pay', 'rt', '', '', true], [-150000, 0], `${C1} مرتجع/شغل بـ 1,500 — مرتجع 2 لفة 16 مم`]);
    await A.evaluate(() => { mkView = 'in'; go('mkt'); mkSync(); }); await A.settle(900);
    eq('عند مصطفى: في كارت العميل بزرار "انقلها"، ومدخلش الحسابات لوحده', [await A.$(`#p-mkt [data-rt="${rtOp}"]`) !== null, (await A.textContent('#p-mkt')).includes('مرتجع 2 لفة 16 مم'), await bal(A, C1)], [true, true, rB0]);
    await A.click(`#p-mkt [data-rt="${rtOp}"]`); await A.settle(250);
    eq('شاشة التأكيد: خصم على الحساب من غير خزنة', [(await A.textContent('#modal')).includes('من غير خزنة'), await A.$('#modal select[data-f=v]')], [true, null]);
    await A.click('#mvOk'); await A.settle(300);
    eq('اتنقلت خصم على حساب العميل بالملاحظة، والخزنة متأثرتش', [await A.evaluate(id => { const e = E.get('e_mk_' + id); return [e.kind, e.dir, e.amt, e.note, !e.vault]; }, rtOp), await bal(A, C1) - rB0, await vbal(A, 'v_mkt') - rV0],
      [['adj', 'dn', 150000, 'مرتجع/شغل (السوق) — مرتجع 2 لفة 16 مم', true], -150000, 0]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.waitForFunction(id => opState(S.ops[id]) === 'done', rtOp, {timeout: 15000}).catch(() => {});
    eq('الشريك: اتنقلت والرصيد عنده = رصيد الحسابات', await M.evaluate(([id, pid]) => [opState(S.ops[id]), customers().get(pid).bal], [rtOp, pid1]), ['done', rB0 - 150000]);

    /* الشريك بيعدّل حركة اتنقلت: بتتعدل في الحسابات لوحدها ومصطفى يوصله إشعار */
    await M.evaluate(i => { pyTab = 'pay'; nav('p/' + i); }, pid1); await M.settle(200);
    await M.click(`#tdy .row[data-o="${rtOp}"]`); await M.settle(150);
    eq('نافذة التعديل بتفتح على حركة اتنقلت، وفيها إن التعديل هيوصل لمصطفى', [!!(await M.$('#eOk')), (await M.textContent('#modal')).includes('يوصله إشعار')], [true, true]);
    await M.fill('#eA', '2000'); await M.click('#eOk'); await M.settle(300);
    eq('عند الشريك: "التعديل عند مصطفى" لحد ما يتطبق', await M.evaluate(id => stHtml(S.ops[id]).includes('التعديل عند مصطفى'), rtOp), true);
    await bg(M, 'sync()'); await A.evaluate(() => go('home')); await A.settle(200); await bg(A, 'mkSync()'); await A.settle(300);
    eq('عند مصطفى: الخصم اتعدل لوحده لـ 2,000 والرصيد اتظبط، وطلعله إشعار بالتعديل', [await A.evaluate(id => E.get('e_mk_' + id).amt, rtOp), await bal(A, C1) - rB0, (await A.textContent('#mkBar')).includes('شريكك عدّل'), await A.evaluate(() => $('#mkBar').classList.contains('on'))], [200000, -200000, true, true]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.waitForFunction(([id, v]) => !editPend(S.ops[id]) && customers().get(S.ops[id].cid).bal === v, [rtOp, rB0 - 200000], {timeout: 15000}).catch(() => {});
    eq('عند الشريك: رجعت "اتنقلت" والرصيد = الحسابات', await M.evaluate(([id, pid]) => [stHtml(S.ops[id]).includes('✓ اتنقلت'), customers().get(pid).bal], [rtOp, pid1]), [true, rB0 - 200000]);
    await M.click(`#tdy .row[data-o="${rtOp}"]`); await M.settle(150); await M.click('#eDel'); await M.click('#aY'); await M.settle(300);
    await bg(M, 'sync()'); await bg(A, 'mkSync()'); await A.settle(300);
    eq('الشريك مسح حركة اتنقلت: اتشالت من الحسابات لوحدها وإشعار', [await A.evaluate(id => E.get('e_mk_' + id).del, rtOp), await bal(A, C1), (await A.textContent('#mkBar')).includes('شريكك مسح')], [true, rB0, true]);
    await A.evaluate(() => { $('#mkBar').classList.remove('on'); mkView = 'in'; go('mkt'); }); await A.settle(200);
    /* دفعة كاش اتنقلت: الشريك غيّر المبلغ وخلاها تحويل، وبعدين رجّعها زي ما كانت */
    const pyOp = await M.evaluate(() => liveOps().find(o => o.t === 'pay' && o.amt === 330000 && opState(o) === 'done').id), pV0 = await vbal(A, 'v_mkt'), pB0 = await bal(A, C1);
    const editPay = async (amt, m) => { await M.evaluate(i => { pyTab = 'pay'; nav('p/' + i); }, pid1); await M.settle(150); await M.click(`#tdy .row[data-o="${pyOp}"]`); await M.settle(150); await M.fill('#eA', amt); await M.click(`#eM button[data-m=${m}]`); await M.click('#eOk'); await M.settle(200); await bg(M, 'sync()'); await bg(A, 'mkSync()'); await A.settle(200); };
    await editPay('3000', 'tr');
    eq('دفعة كاش اتنقلت والشريك خلاها تحويل 3,000: اتعدلت في الحساب وطلعت من خزنة السوق', [await A.evaluate(id => { const e = E.get('e_mk_' + id); return [e.amt, e.method, e.vault === 'v_mkt']; }, pyOp), await bal(A, C1) - pB0, await vbal(A, 'v_mkt') - pV0], [[300000, 'تحويل', false], 30000, -330000]);
    await editPay('3300', 'cash');
    eq('ورجّعها كاش 3,300: رجعت زي ما كانت', [await A.evaluate(id => { const e = E.get('e_mk_' + id); return [e.amt, e.method, e.vault]; }, pyOp), await bal(A, C1) - pB0, await vbal(A, 'v_mkt') - pV0], [[330000, 'نقدي', 'v_mkt'], 0, 0]);
    await A.evaluate(() => { $('#mkBar').classList.remove('on'); mkView = 'in'; go('mkt'); }); await A.settle(200);

    /* عميل جديد: فاتورة بإجمالي بس */
    await M.evaluate(() => nav('c')); await M.click('#bNew'); await M.fill('#ncN', 'عميل فاتورة جديد'); await M.click('#ncOk'); await M.click('#pyT button[data-v=inv]'); await M.fill('#amt', '2500'); await M.click('#invOk'); await M.settle(1200);
    eq('تليجرام: فاتورة عميل جديد', tgTexts().pop(), '🧾 عميل فاتورة جديد (عميل جديد) فاتورة بـ 2,500');
    await bg(A, 'mkSync()'); await A.settle(800);
    await A.click('#p-mkt [data-inv]'); await A.settle(300); await A.click('#iqItems'); await A.settle(300);
    eq('عميل جديد: بيطلب ربط بحساب الأول', (await A.textContent('#modal h3')).includes('اربط'), true);
    await A.click('#lkNew'); await A.settle(300);
    await A.fill('.li [data-f=name]', 'صنف تجربة جديد'); await A.fill('.li [data-f=qty]', '1'); await A.fill('.li [data-f=price]', '2500'); await A.click('#dcOk'); await closed(A); await A.settle(300);
    eq('اتفتحله حساب في عملاء السوق وفيه الفاتورة بالبنود', await A.evaluate(() => { const p = liveParties().find(x => x.name === 'عميل فاتورة جديد'); return p ? [p.sec, balance(p.id), partyEntries(p.id).map(e => e.kind)] : null; }), ['mkt', 250000, ['inv']]);
    await M.evaluate(() => nav('a')); await M.settle(200);
    eq('الأرشيف عند الشريك: الفواتير في سطر لوحدها في الأسبوع', (await M.textContent('.wk .inr')).includes('12,500'), true);
    eq('الشيت: كل عملية مرة واحدة', new Set(mkRows('op').map(r => r[0])).size, mkRows('op').length);

    /* فاتورة تتنقل بالإجمالي بس، والبنود بتتكتب بعدين من حساب العميل (وعليها تنبيه لحد ما تتكتب) */
    await M.evaluate(() => nav('c')); await M.click('#bNew'); await M.fill('#ncN', 'عميل فاتورة سريعة'); await M.click('#ncOk'); await M.click('#pyT button[data-v=inv]'); await M.fill('#amt', '4000'); await M.click('#invOk'); await M.settle(1200);
    await bg(A, 'mkSync()'); await A.settle(800);
    await A.evaluate(() => { mkView = 'in'; go('mkt'); }); await A.settle(300);
    const qOp = await A.evaluate(() => (mkPending().find(o => o.t === 'inv') || {}).id);
    await A.click(`#p-mkt [data-inv="${qOp}"]`); await A.settle(300);
    eq('زرار الفاتورة بيسأل: انقلها بالإجمالي ولا اكتب البنود دلوقتي', [!!await A.$('#iqGo'), !!await A.$('#iqItems')], [true, true]);
    await A.click('#iqGo'); await A.settle(300); await A.click('#lkNew'); await A.settle(400);
    const qp = await A.evaluate(() => (liveParties().find(x => x.name === 'عميل فاتورة سريعة') || {}).id);
    eq('اتنقلت بالإجمالي: الرصيد 4,000 والوارد فاضي وعليها "البنود لسه"', await A.evaluate(([id, pid]) => { const e = E.get('e_mk_' + id); return [e.mkNL, e.party === pid, balance(pid), mkPending().length, nlList().length]; }, [qOp, qp]), [true, true, 400000, 0, 1]);
    await A.evaluate(() => go('home')); await A.settle(300);
    eq('مفيش تنبيه في الرئيسية (في الوارد بس)', (await A.textContent('#nlRem')).includes('من غير بنود'), false);
    await A.evaluate(pid => go('p/' + pid), qp); await A.settle(300);
    eq('في الحساب: مفيش تنبيه فوق، والعلامة "البنود لسه" على الفاتورة نفسها', [!!(await A.$('#p-party .nlb')), (await A.textContent('#p-party .ldg')).includes('البنود لسه')], [false, true]);
    await A.evaluate(() => { mkView = 'in'; go('mkt'); renderMkt(); }); await A.settle(300);
    eq('التنبيه في الوارد', (await A.textContent('#mkBody .nlb')).includes('من غير بنود'), true);
    await A.click('#mkBody .nlb'); await A.settle(300);
    eq('نافذة البنود بتفتح فاضية وإجمالي الشريك ظاهر', [await A.inputValue('.li [data-f=name]'), (await A.textContent('#dcMk')).includes('الفرق')], ['', true]);
    await A.fill('.li [data-f=name]', 'صنف سريع'); await A.fill('.li [data-f=qty]', '4'); await A.fill('.li [data-f=price]', '1000');
    eq('البنود مطابقة', (await A.textContent('#dcMk')).includes('مطابق'), true);
    await A.click('#dcOk'); await closed(A); await A.settle(300);
    eq('بعد كتابة البنود: التنبيه راح والرصيد زي ما هو ومن غير "اتعدّلت"', await A.evaluate(([id, pid]) => { const e = E.get('e_mk_' + id); return [!!e.mkNL, e.lines.length, e.lines[0].name, balance(pid), nlList().length, (e.hist || []).length]; }, [qOp, qp]), [false, 1, 'صنف سريع', 400000, 0, 0]);

    sec('١٩) حركة السوق: بيع كاش من المصنع (اسم مشتري ومبلغ بس، من غير عملاء)');
    const csC0 = await M.evaluate(() => cashNow()), csP0 = await A.evaluate(() => db.parties.length);
    await M.evaluate(() => nav('')); await M.settle(200);
    eq('زرار بيع كاش من المصنع في الرئيسية', await M.evaluate(() => !!$('#qSale')), true);
    await M.click('#qSale'); await M.settle(200);
    await M.fill('#bn', 'مشتري تجربة'); await M.fill('#amt', '4500');
    eq('خانة التاريخ بأسهم يمين وشمال', await M.evaluate(() => [$$('.dpk button').length, $('#bDT').textContent.includes('النهارده'), $('.dpk [data-st="1"]').disabled]), [2, true, true]);
    await M.click('.dpk [data-st="-1"]');
    eq('السهم الأيمن بيجيب اليوم اللي قبله', await M.evaluate(() => $('#bD').value === addDays(today(), -1)), true);
    eq('زرارين زي الدفعة: فلوس معايا / تحويل لمصطفى', await M.evaluate(() => $$('#main .big[data-m]').map(b => b.textContent)), ['💵 فلوس معايا', '📲 تحويل لمصطفى']);
    await M.click('.big[data-m=cash]'); await M.settle(1200);
    eq('اتسجل البيع: إشعار وفضل في نفس الشاشة فاضية', [(await M.textContent('#toast')).includes('اتسجل بيع 4,500 — مشتري تجربة'), await M.evaluate(() => [scr.v, $('#amt').value, $('#bn').value])], [true, ['sale', '', '']]);
    eq('اللي معاه كاش زاد 4,500 ومفيش عميل اتضاف', await M.evaluate(([c0]) => [cashNow() - c0, [...customers().values()].some(c => c.name === 'مشتري تجربة')], [csC0]), [450000, false]);
    eq('تاريخ البيع اللي اختاره (إمبارح)', await M.evaluate(() => { const o = liveOps().find(x => x.t === 'cs'); return dayOf(o.ts) === addDays(today(), -1); }), true);
    await M.evaluate(() => nav('c')); await M.settle(200);
    eq('صفحة العملاء: إجمالي اللي على العملاء ظاهر', await M.evaluate(() => { const t = [...customers().values()].reduce((a, c) => a + (c.bal > 0 ? c.bal : 0), 0); return $('#main .ctot .money').textContent === fmt(t); }), true);
    await bg(M, 'sync()'); await bg(A, 'mkSync()'); await A.settle(500);
    eq('وصل لمصطفى في الوارد', await A.evaluate(() => mkPending().filter(o => o.t === 'cs').map(o => [o.buyer, o.amt])), [['مشتري تجربة', 450000]]);
    eq('تليجرام: نص البيع الكاش جاي جاهز من التطبيق، وكود الشيت نسخة 5', [tgTexts().pop(), await A.evaluate(async () => (await tgCall('tgstate')).v)], ['🏭 بيع كاش من المصنع 4,500 — مشتري تجربة', 5]);
    const csV0 = await A.evaluate(() => vaultBal('v_mkt'));
    await A.evaluate(() => { const o = mkPending().find(x => x.t === 'cs'); mkMove(o, {amt: o.amt, date: todayISO(), vault: 'v_mkt', to: ''}); saveDB(); });
    eq('اتنقل إيراد في خزنة السوق (مبيعات نقدي) من غير ما يتعمل عميل', await A.evaluate(([v0, p0]) => [vaultBal('v_mkt') - v0, db.txs.filter(t => t.id.startsWith('t_mk_') && t.type === 'inc' && t.cat === 'c_inc1' && !t.del).length > 0, db.parties.length], [csV0, csP0]), [450000, true, csP0]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.settle(500);
    eq('الشريك شاف إنها اتنقلت', await M.evaluate(() => opState(liveOps().find(x => x.t === 'cs'))), 'done');
    /* بيع كاش بتحويل لمصطفى: مش بيزود اللي مع الشريك، وعند مصطفى بيدخل خزنة تحويلات مش خزنة السوق */
    const trC0 = await M.evaluate(() => cashNow());
    await M.evaluate(() => nav('b', true)); await M.settle(100); await M.fill('#bn', 'مشتري تحويل'); await M.fill('#amt', '1200'); await M.click('.big[data-m=tr]'); await M.settle(400);
    eq('بيع بتحويل: اتسجل m=tr واللي مع الشريك مزادش، وراح في "سلّمت"', await M.evaluate(([c0]) => { const o = liveOps().find(x => x.buyer === 'مشتري تحويل'); return [o.m, cashNow() - c0, sums([o]).toM, dirOf(o)]; }, [trC0]), ['tr', 0, 120000, 'd-to']);
    await bg(M, 'sync()'); await bg(A, 'mkSync()'); await A.settle(400);
    const trV0 = await A.evaluate(() => vaultBal('v_mkt'));
    eq('عند مصطفى: تاج تحويل ومش من خزنة السوق', await A.evaluate(() => { const o = mkPending().find(x => x.buyer === 'مشتري تحويل'); return [o.m, mkCashOp(o), mkSign(o), mkLTag(o).includes('تحويل')]; }), ['tr', false, 0, true]);
    await A.evaluate(() => { const o = mkPending().find(x => x.buyer === 'مشتري تحويل'); mkConfirm([o], {}); }); await A.waitForSelector('#mvOk');
    const trTo = await A.evaluate(() => $('#modal [data-f=v]').value);
    await A.click('#mvOk'); await A.settle(300);
    eq('اتنقل إيراد في خزنة التحويل اللي اختارها مش خزنة السوق', await A.evaluate(([v0, tv]) => { const o = Object.values(db.mkt.ops).find(x => x.buyer === 'مشتري تحويل'), t = IDX.tx.get('t_mk_' + o.id); return [!!t && t.vault === tv && !isMkv(tv), t && t.cat, vaultBal('v_mkt') - v0]; }, [trV0, trTo]), [true, 'c_inc1', 0]);
    await M.evaluate(() => { const o = liveOps().find(x => x.buyer === 'مشتري تحويل'); o.m = 'cash'; bump(o); save(); sync(); }); await M.settle(400); await bg(A, 'mkSync()'); await A.settle(400);
    eq('الشريك غيّرها لكاش بعد النقل: رجعت خزنة السوق لوحدها', await A.evaluate(() => { const o = Object.values(db.mkt.ops).find(x => x.buyer === 'مشتري تحويل'); return isMkv(IDX.tx.get('t_mk_' + o.id).vault); }), true);

    sec('٢٠) المصروف: إشعار عند مصطفى (يسجّله أو يتجاهله) ومن غير أي حالة عند الشريك');
    const exA = async (name, amt) => { await M.evaluate(() => nav('')); await M.click('#qSp'); await M.fill('#amt', String(amt)); await M.fill('#nt', name); await M.click('#spOk'); await M.settle(400); await bg(M, 'sync()'); await bg(A, 'mkSync()'); await A.settle(400); await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.settle(300); };
    const exO = n => A.evaluate(n => { const o = Object.values(db.mkt.ops).find(x => x.t === 'exp' && x.cat === n), t = IDX.tx.get('t_mk_' + o.id); return [t ? !t.del : null, t ? t.amt : null, mkState(o), mkPending().some(x => x.id === o.id)]; }, n);
    await exA('غدا', 700);
    eq('المصروف مبيتسجلش لوحده: مستني مصطفى في الوارد', await exO('غدا'), [null, null, 'new', true]);
    const exW = n => A.evaluate(n => { const id = Object.values(db.mkt.ops).find(x => x.t === 'exp' && x.cat === n).id, at = v => { mkView = v; mkDay = todayISO(); go('mkt'); renderMkt(); return !!$(`#mkBody [data-op="${id}"]`); }; const r = [at('in'), at('arch'), !!$('#maIn')]; at('in'); return r; }, n);   // [في الوارد، في الأرشيف، تنبيه "لسه" فوق الأرشيف]
    eq('اللي لسه متنقلش في الوارد بس ومش في الأرشيف، والأرشيف بيقول إن فيه حاجة لسه', await exW('غدا'), [true, false, true]);
    eq('الشريك: مفيش حالة ولا انتظار على المصروف، وينفع يتعدل', await M.evaluate(() => { const o = liveOps().find(x => x.cat === 'غدا'); document.body.dataset.t = ''; nav(''); return [opState(o), stHtml(o)]; }), ['exp', '']);
    await M.evaluate(() => nav('')); await M.settle(150);
    eq('الشريك: سطر المصروف في الرئيسية من غير أي نص حالة', await M.evaluate(() => { const r = [...document.querySelectorAll('.row.t-exp')].find(x => x.textContent.includes('غدا')); return [!!r, r.querySelectorAll('.st').length]; }), [true, 0]);
    eq('عند مصطفى: زرار تجاهل جنب المصروف ومفيش رجّعها', await A.evaluate(() => { mkView = 'in'; go('mkt'); return new Promise(r => setTimeout(() => r([document.querySelectorAll('#mkBody [data-ig]').length > 0, !document.querySelector('#mkBody [data-bk="x:exp"]')]), 400)); }), [true, true]);
    await A.click('#p-mkt [data-mv="x:exp"]'); await A.settle(250); await A.click('#mvOk'); await A.settle(300);
    eq('"سجّلها مصروف": اتسجلت في خزنة السوق تحت مصاريف السوق', await exO('غدا'), [true, 70000, 'done', false]);
    eq('أول ما اتنقل: خرج من الوارد وراح الأرشيف', (await exW('غدا')).slice(0, 2), [false, true]);
    await M.evaluate(() => { const o = liveOps().find(x => x.cat === 'غدا'); o.amt = 80000; bump(o); save(); sync(); }); await M.settle(500); await bg(A, 'mkSync()'); await A.settle(400);
    eq('الشريك عدّل بعد ما اتسجلت: الحركة عند مصطفى اتعدلت', await exO('غدا'), [true, 80000, 'done', false]);
    eq('والشريك لسه ينفع يعدّل (مفيش قفل)', await M.evaluate(() => { const o = liveOps().find(x => x.cat === 'غدا'); editSheet(o); const ok = !!$('#eOk'); closeModal(); return ok; }), true);
    await M.evaluate(() => { const o = liveOps().find(x => x.cat === 'غدا'); o.del = true; bump(o); save(); sync(); }); await M.settle(500); await bg(A, 'mkSync()'); await A.settle(400);
    eq('الشريك مسحها: اتشالت من الخزنة عند مصطفى', await A.evaluate(() => { const o = Object.values(db.mkt.ops).find(x => x.cat === 'غدا'); return IDX.tx.get('t_mk_' + o.id).del; }), true);
    await exA('تاكسي', 300);
    await A.evaluate(() => { mkIgnore(Object.values(db.mkt.ops).find(x => x.cat === 'تاكسي')); }); await A.click('#igOk'); await A.settle(400);
    eq('تجاهل: مش في اللي متنقلش ومفيش حركة خزنة', await exO('تاكسي'), [null, null, 'ign', false]);
    await bg(A, 'mkSync()'); await bg(M, 'sync()'); await M.settle(300);
    eq('الشريك مشافش أي تغيير في المصروف المتجاهَل، وينفع يعدّله', await M.evaluate(() => { const o = liveOps().find(x => x.cat === 'تاكسي'); return [opState(o), stHtml(o), cashNow() < 0 || true]; }), ['exp', '', true]);
    eq('دفعة المورد والتسليم لسه بموافقته (متسجلوش لوحدهم)', await A.evaluate(() => db.txs.filter(t => t.id.startsWith('t_mk_') && !t.del).every(t => t.type === 'tr' || t.cat === 'c_inc1' || t.cat === 'c_mkexp')), true);

    sec('٢١) حركة السوق: زرار الرجوع بتاع الموبايل');
    await M.evaluate(() => nav('', true)); await M.settle(150);
    await M.click('#tabs button[data-t=c]'); await M.click('#tabs button[data-t=a]');
    await M.goBack(); await M.settle(150);
    eq('الرجوع من الأرشيف بيرجع للعملاء (مش بيخرج)', await M.evaluate(() => scr.v), 'c');
    await M.evaluate(() => handModal()); await M.waitForSelector('#hAmt');
    await M.goBack(); await M.settle(150);
    eq('الرجوع وفي نافذة مفتوحة بيقفلها ويفضل في نفس الصفحة', await M.evaluate(() => [scr.v, $('#mask').classList.contains('on')]), ['c', false]);
    await M.evaluate(() => handModal()); await M.waitForSelector('#hAmt'); await M.click('#hX'); await M.settle(300);
    await M.goBack(); await M.settle(150);
    eq('قفل النافذة بزرارها مبيسيبش خانة زيادة: الرجوع بيروح للصفحة اللي قبلها', await M.evaluate(() => scr.v), 'home');

    sec('٢٢) ترتيب العملاء وآخر دفعة، "حصّل من دول"، تقفيل اليوم، انقل كل الجاهز، التسجيل السريع، والمطلوب منك النهارده');
    const sync2 = async () => { await bg(M, 'sync()'); await bg(A, 'mkSync()'); await A.settle(300); await bg(M, 'sync()'); await M.settle(200); };
    await sync2();
    /* آخر دفعة: بتيجي من الحسابات مع رصيد العميل */
    eq('الحسابات بتبعت تاريخ آخر دفعة مع رصيد عميل السوق', JSON.parse(mkRows('cust').find(r => r[0] === pid1)[10]).lp, await A.evaluate(id => lastPays().get(id) || '', pid1));
    await M.evaluate(() => nav('c', true)); await M.settle(150);
    eq('العملاء: زرار ترتيب في العنوان والافتراضي "الأكبر"، وتحت كل اسم "آخر دفعة"', await M.evaluate(() => [$('#cSortB').textContent.trim(), $$('#lists .pt[data-c]').length === $$('#lists .pt .lp').length, $('#lists .pth span:last-child').textContent]), ['⇅ الأكبر', true, 'عليه']);
    eq('الأكتر عليه: مترتبين بالرصيد من الكبير للصغير', await M.evaluate(() => { const b = $$('#lists .pt[data-c]').map(r => customers().get(r.dataset.c).bal); return b.every((x, i) => !i || b[i - 1] >= x); }), true);
    eq('"آخر دفعة" لسه بتظهر في صفحة العميل', await M.evaluate(id => { nav('p/' + id); const t = $('#cBox .lp').textContent; nav('c', true); return t; }, pid1), 'دفع النهارده');
    await M.evaluate(() => { while (S.cSort !== 'abc') $('#cSortB').click(); }); await M.settle(100);
    eq('بالحروف: بيترتبوا بالاسم والاختيار بيتحفظ', await M.evaluate(() => { const n = $$('#lists .pt[data-c] .nm').map(x => x.firstChild.textContent); return [n.every((x, i) => !i || n[i - 1].localeCompare(x, 'ar') <= 0), S.cSort, JSON.parse(localStorage.getItem('fo_mkt_v1')).cSort]; }), [true, 'abc', 'abc']);
    await M.evaluate(() => { while (S.cSort !== 'owe') $('#cSortB').click(); });

    /* أقسام العملاء عند الشريك (على الموبايل بس) */
    eq('"كل العملاء" أول تبويب ومفيش أقسام', await M.evaluate(() => $$('#gTabs button[data-g]').map(b => b.textContent)), ['كل العملاء']);
    await M.click('#gAdd'); await M.fill('#gN', 'منطقة تجربة'); await M.click(`#gL input[data-c="${pid1}"]`); await M.click('#gOk'); await M.settle(150);
    eq('قسم جديد: بقى تبويب فوق وفيه العميل اللي اختاره بس', await M.evaluate(() => [$$('#gTabs button[data-g]').map(b => b.textContent), $('#gTabs button.on').textContent, $$('#lists .pt[data-c]').length, JSON.parse(localStorage.getItem('fo_mkt_v1')).groups.length]), [['كل العملاء', 'منطقة تجربة'], 'منطقة تجربة', 1, 1]);
    await M.click('#gTabs button[data-g=""]'); await M.settle(100);
    eq('"كل العملاء" لسه فيه الكل', await M.evaluate(() => $$('#lists .pt[data-c]').length === customers().size), true);
    await M.click('#gTabs button:nth-child(2)'); await M.click('#gEdit'); await M.click('#gDel'); await M.click('#aY'); await M.settle(150);
    eq('مسح القسم: العملاء فضلوا والتبويب اتشال', await M.evaluate(() => [$$('#gTabs button[data-g]').length, $$('#lists .pt[data-c]').length === customers().size]), [1, true]);
    eq('الأقسام مبتروحش الشيت ولا الحسابات', sheets.mkt.sheets['الحركات'].rows.some(r => String(r[10]).includes('منطقة تجربة')), false);
    /* حصّل من دول: مصطفى بيعلّم من الحسابات، والشريك بيشوفها في الرئيسية وبتتشطب لما يسجل دفعة */
    await openParty(A, C1); await A.click('#ppWant'); await A.fill('#wqA', '1,000'); await A.fill('#wqN', 'قبل الخميس'); await A.click('#wqOk'); await A.settle(200);
    eq('الحسابات: العميل اتعلّم "مطلوب" وظهر سطر في صفحته', [await A.evaluate(id => mkWants()[id] && mkWants()[id].amt, pid1), (await A.textContent('#ppWantL')).includes('لسه')], [100000, true]);
    await sync2(); await M.evaluate(() => nav('', true)); await M.settle(150);
    eq('الشريك: "مطلوب تحصّل من دول" فوق في الرئيسية بالمبلغ والملاحظة', await M.evaluate(id => { const r = $(`#want .wr[data-c="${id}"]`); return r && [r.querySelector('.a .money').textContent, r.textContent.includes('قبل الخميس'), r.classList.contains('ok'), $('#want .wh2 span').textContent]; }, pid1), ['1,000', true, false, '0 من 1']);
    await M.click(`#want .wr[data-c="${pid1}"]`); await M.settle(150);
    eq('دوسة على العميل بتفتح الدفعة وفيها سطر "مصطفى عاوز منه"', [await M.evaluate(() => scr.v), (await M.textContent('#cBox .cwant')).includes('1,000')], ['pay', true]);
    await M.fill('#amt', '700'); await M.click('.big[data-m=cash]'); await M.settle(400);
    await M.evaluate(() => nav('', true)); await M.settle(150);
    eq('سجّل دفعة: اتشطبت عنده "✓ حصّلت"', await M.evaluate(id => { const r = $(`#want .wr[data-c="${id}"]`); return [r.classList.contains('ok'), r.textContent.includes('حصّلت 700')]; }, pid1), [true, true]);
    await sync2(); await A.click('nav button[data-go=home]'); await A.settle(200);
    eq('الحسابات: كارت "حصّل من دول" في الوارد بيقول "1 من 1"', await A.evaluate(() => { go('mkt'); return new Promise(r => setTimeout(() => r($('#mkBody .mkw .mkwh span').textContent), 300)); }), '1 من 1');
    eq('بكرة اللي اتحصّل بيتشال من القايمة لوحده', await A.evaluate(() => { const n0 = Date.now, r0 = mkWantPrune(); Date.now = () => n0() + 86400000 * 1.1; let r; try { r = [r0, mkWantPrune(), Object.keys(mkWants()).length]; } finally { Date.now = n0; } return r; }), [false, true, 0]);

    /* تقفيل اليوم */
    await M.evaluate(() => nav('', true)); await M.settle(150);
    const cn0 = await M.evaluate(() => cashNow());
    await M.click('#kBtn'); await M.waitForSelector('#kAmt');
    eq('تقفيل اليوم: بيقول المفروض معاك كام', await M.evaluate(() => $('.kexp .money').textContent), await M.evaluate(() => fmtN(cashNow())));
    await M.fill('#kAmt', String((cn0 - 20000) / 100)); await M.click('#kOk'); await M.settle(100);
    eq('فيه فرق: بينبّه الأول ومبيقفلش', [(await M.textContent('#kRes')).includes('ناقص 200'), await M.evaluate(() => !!cntOf(today()))], [true, false]);
    await M.click('#kOk'); await M.settle(300);
    eq('"قفّل برضه": اتسجل التقفيل والفرق ظاهر، و"معاك كاش" متغيرش', await M.evaluate(() => { const k = cntOf(today()); return [k.amt - k.sys, $('#kBtn').classList.contains('bad'), cashNow(), liveOps().some(o => o.t === 'cnt')]; }), [-20000, true, cn0, false]);
    await sync2();
    eq('تليجرام: مصطفى عرف بالفرق', tgTexts().some(t => t.includes('قفّل يومه') && t.includes('ناقص 200')), true);
    await A.click('nav button[data-go=home]'); await A.settle(200);
    eq('الحسابات: مفيش تنبيه في الرئيسية (التقفيل في الوارد بس)', await A.evaluate(() => !!document.querySelector('#hAlerts .mkcnt, #tkRows')), false);
    eq('الوارد: كارت التقفيل فوق ومش محسوب عملية', await A.evaluate(() => { go('mkt'); return new Promise(r => setTimeout(() => r([!!document.querySelector('#mkBody .mkcnt.bad'), mkLive().some(o => o.t === 'cnt')]), 300)); }), [true, false]);
    await M.click('#kBtn'); await M.waitForSelector('#kAmt'); await M.fill('#kAmt', String(cn0 / 100)); await M.click('#kOk'); await M.settle(300);
    eq('قفّل تاني مظبوط: نفس التقفيل اتكتب فوق القديم', await M.evaluate(() => [Object.values(S.ops).filter(o => o.t === 'cnt').length, cntOf(today()).amt === cntOf(today()).sys, $('#kBtn').classList.contains('ok')]), [1, true, true]);

    /* انقل كل الجاهز */
    await M.evaluate(id => { pyTab = 'pay'; nav('p/' + id, true); }, pid1); await M.settle(150);
    await M.fill('#amt', '110'); await M.click('.big[data-m=cash]'); await M.settle(800);
    await M.fill('#amt', '220'); await M.click('.big[data-m=tr]'); await M.settle(400);
    await M.evaluate(() => nav('b', true)); await M.settle(100); await M.fill('#bn', 'مشتري جاهز'); await M.fill('#amt', '330'); await M.click('.big[data-m=cash]'); await M.settle(300);
    await sync2();
    const bB = await bal(A, C1), vB = await vbal(A, 'v_mkt');
    const rdy = await A.evaluate(() => mkReady().map(o => o.amt)), [eC, eV] = await A.evaluate(id => { const R = mkReady(); return [R.filter(o => o.t === 'pay' && mkPid(o) === id).reduce((s, o) => s + o.amt, 0), R.filter(o => o.t === 'cs' || (o.t === 'pay' && o.m === 'cash')).reduce((s, o) => s + o.amt, 0)]; }, pid1);
    eq('الجاهز للنقل فيه الدفعتين والبيع الكاش', [rdy.includes(11000), rdy.includes(22000), rdy.includes(33000)], [true, true, true]);
    await A.evaluate(() => { mkView = 'in'; go('mkt'); }); await A.settle(300);
    await A.click('#mkAll'); await A.waitForSelector('#mbOk'); await A.click('#mbOk'); await A.settle(400);
    eq('انقل كل الجاهز: اتنقلوا كلهم بشاشة واحدة', await A.evaluate(() => [mkReady().length, Object.values(db.mkt.ops).filter(o => [11000, 22000, 33000].includes(o.amt) && !o.del).map(o => mkState(o))]), [0, ['done', 'done', 'done']]);
    eq('العميل نزل بكل دفعاته الجاهزة والكاش (دفعات + بيع) في خزنة السوق', [bB - await bal(A, C1), await vbal(A, 'v_mkt') - vB], [eC, eV]);
    eq('دفعتين نفس العميل = "دفعة" واحدة في حسابه', await A.evaluate(() => { const L = db.entries.filter(e => e.id.startsWith('e_mk_') && !e.del && [11000, 22000].includes(e.amt)); return [L.length, new Set(L.map(e => e.mkg)).size, !!L[0].mkg]; }), [2, 1, true]);

    /* التسجيل السريع (＋) */
    await A.click('nav button[data-go=home]'); await A.settle(200);
    eq('الموبايل: زرار ＋ ظاهر في الرئيسية ومخفي في صفحة الحساب', [await A.isVisible('#fabNew'), (await openParty(A, C1), await A.isVisible('#fabNew'))], [true, false]);
    await A.click('nav button[data-go=home]'); await A.settle(150);
    await A.click('#fabNew'); await A.click('#qmPay'); await A.fill('#qpQ', C1); await A.settle(100);
    await A.press('#qpQ', 'Enter'); await A.settle(200);
    eq('＋ ← دفعة ← اكتب حرفين ← Enter: نافذة الدفعة للعميل', [!!(await A.$('#pyAmt')), (await A.textContent('#modal')).includes(C1)], [true, true]);
    await A.evaluate(() => closeModal());
    await A.click('#fabNew'); await A.click('#qmExp'); await A.settle(150);
    eq('＋ ← مصروف: نافذة مصروف الخزنة', (await A.textContent('#modal h3')).includes('مصروف'), true);
    await A.evaluate(() => closeModal());
    await A.setViewportSize({width: 1300, height: 800}); await A.settle(200);
    eq('اللاب: "تسجيل سريع" في القايمة الجانبية والزرار العايم مخفي، وF4 بيفتحه', [await A.isVisible('#nQuick'), await A.isVisible('#fabNew'), (await A.keyboard.press('F4'), await A.settle(150), await A.isVisible('#qmDoc'))], [true, false, true]);
    await A.evaluate(() => closeModal()); await A.setViewportSize({width: 400, height: 860}); await A.settle(200);

    /* الشريط اللي تحت على الموبايل: العملاء | الموردين | حركة السوق | التقارير | الإعدادات */
    eq('الموبايل: ترتيب الشريط اللي تحت', await A.evaluate(() => $$('nav button[data-go]').filter(b => getComputedStyle(b).display !== 'none').sort((a, b) => (+getComputedStyle(a).order) - (+getComputedStyle(b).order)).map(b => b.innerText.trim())), ['العملاء', 'الموردين', 'الوارد', 'الخزنة']);
    await A.click('nav button[data-go=home]'); await A.settle(150);
    eq('العملاء: عملاء السوق والمواقع بس + زرار الخزنة، والبحث مبيجيبش موردين', await A.evaluate(() => { const t = $$('#hTabs button[data-t]').map(b => b.dataset.t); $('#hSearch').value = 'مورد'; renderList(); const n = $$('#hList .pt.sup').length; $('#hSearch').value = ''; renderList(); return [t, !!$('#hRep'), n]; }), [['mkt', 'site'], true, 0]);
    await A.click('nav button[data-go=sup]'); await A.settle(150);
    eq('الموردين تبويب لوحده تحت وفيه موردين بس', await A.evaluate(() => [$('nav button.on').dataset.go, $$('#hList .pt').length > 0 && $$('#hList .pt').every(x => x.classList.contains('sup')), $$('#hTabs button[data-t]').length]), ['sup', true, 0]);
    await A.click('#hList .pt'); await A.settle(150);
    eq('صفحة المورد: الموردين هو المتعلّم والرجوع بيرجع للموردين', [await A.evaluate(() => $('nav button.on').dataset.go), (await A.click('#ppBack'), await A.settle(150), await A.evaluate(() => location.hash))], ['sup', '#sup']);
    await A.click('nav button[data-go=home]'); await A.click('#hRep'); await A.settle(150);
    eq('زرار التقارير في العملاء بيفتح التقارير', await A.evaluate(() => location.hash), '#rep');
    eq('حساب طويل: آخر 30 سطر بس وزرار واحد للأقدم، والرصيد السابق في عمود الرصيد، وكل دوسة بتفرد 30 وفيه طي', await A.evaluate(async () => {
      const p = liveParties()[0], bal = balance(p.id), made = [];
      for (let i = 0; i < 60; i++) made.push(addEntry({party: p.id, kind: 'man', date: '2019-01-' + pad2(1 + i % 28), desc: 'حركة طويلة ' + i, dr: 100, cr: 0}));
      const at = () => new Promise(r => setTimeout(r, 120)), n = () => $$('#p-party .ldg tbody tr[data-id]').length;
      go('p/' + p.id); await at(); const a = [n(), $$('#ldgOld').length, !!$('#ldgFold'), $('tr.more td.b').textContent.trim() !== '', $('tr.more small').textContent];
      $('#ldgOld').click(); await at(); const b = [n(), !!$('#ldgFold')];
      $('#ldgFold').click(); await at(); const c = [n(), !$('#ldgFold')];
      made.forEach(e => { e.del = true; touch(e); }); saveDB(); ldgAll.delete(p.id); go('home'); await at();
      return [a, b, c, balance(p.id) === bal];
    }), [[30, 1, false, true, 'الرصيد السابق'], [60, true], [30, true], true]);
    await A.click('nav button[data-go=cash]'); await A.settle(150);
    eq('الخزنة في التابات تحت، والتقارير مش فيها', [await A.evaluate(() => location.hash), await A.isVisible('nav button[data-go=cash]'), await A.isVisible('nav button[data-go=rep]')], ['#cash', true, false]);
    /* المطلوب منك النهارده + الألوان */
    await A.click('nav button[data-go=home]'); await A.settle(200);
    eq('الرئيسية: مفيش تنبيهات (لا الفواتير اللي بنودها لسه ولا وارد السوق ولا الحد الأحمر ولا النسخة)', await A.evaluate(() => [$('#nlRem').textContent.trim() === '', $('#mkRem').textContent.trim(), !!$('#bkRem'), !!$('#tkRows')]), [true, '', false, false]);
    /* الألوان من نظام الشكل الموحد (lib/ui.css): نفس الأخضر والأزرق والأحمر في التطبيقين */
    const tokC = X => X.evaluate(() => { const d = document.createElement('i'); document.body.appendChild(d); const g = v => (d.style.color = `var(${v})`, getComputedStyle(d).color); const r = [g('--green'), g('--tr'), g('--red')]; d.remove(); return r; });
    const mTok = await tokC(M);
    eq('الألوان واحدة في التطبيقين: الكاش أخضر والتحويل أزرق والمصروف أحمر', [await M.evaluate(() => { nav('', true); const c = k => { const r = document.querySelector('.row.' + k + ' .a .money'); return r ? getComputedStyle(r).color : null; }; return [c('d-in'), c('d-to')]; }), await tokC(A)], [mTok.slice(0, 2), mTok]);

    }   // نهاية أقسام السوق
    }   // نهاية RUN.sync
    if (RUN.smoke) {
      sec('الشكل: كل الصفحات بتفتح من غير أخطاء');
      /* بعد تعديل شكل بس: البرنامج بيفتح، الحسابات والخزنة والتقارير والإعدادات بترسم، والصفحات التانية بتفتح من غير أخطاء */
      for (const g of ['home', 'cash', 'rep', 'set', 'mkt']) { await A.evaluate(x => go(x), g); await A.settle(400); }
      await A.evaluate(n => go('p/' + liveParties().find(x => x.name === n).id), 'عميل تجربة واحد'); await A.settle(400);
      eq('صفحة الحساب بترسم والرصيد سليم', [await A.evaluate(() => !!document.querySelector('main table')), await bal(A, 'عميل تجربة واحد')], [true, 270000]);
      await A.setViewportSize({width: 1280, height: 860}); await A.settle(400);
      eq('اللاب توب: القايمة الجانبية ظاهرة', await A.evaluate(() => getComputedStyle(document.querySelector('nav')).display !== 'none'), true);
      await A.setViewportSize({width: 400, height: 860});
      for (const f of ['index.html', 'market.html', 'quote.html', 'delivery.html', 'cost.html', 'calculator/index.html', 'payroll.html']) { const X = await D1.page(f); await X.settle(800); await X.close(); }
    }
    sec('٢٣) sw.js: الحسابات والسوق بيفتحوا بسرعة والنت مقطوع أو بطيء، والنسخة الجديدة بتوصل لوحدها');
    {
      const SWD = await newDevice(browser, base, sheets), now = () => Date.now();
      /* بنستنى الحاجة نفسها (الصفحة بتتعمل لها reload في النص، فـ waitForFunction بيقع) */
      const until = async (X, fn, arg, ms = 20000) => { const end = now() + ms; while (now() < end) { try { if (await X.evaluate(fn, arg)) return true; } catch (e) {} await new Promise(r => setTimeout(r, 100)); } return false; };
      const ctl = X => until(X, () => !!navigator.serviceWorker.controller);
      const hide = X => X.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'}); document.dispatchEvent(new Event('visibilitychange')); });
      const inCache = (X, f, mark) => until(X, ([f, m]) => caches.match(f).then(r => r ? r.text() : '').then(t => t.includes(m)), [f, mark]);
      const orig = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
      const v = (f, n) => orig(f).replace('</body>', `<script>window.__v=${n}</script></body>`);
      const open = async f => { const t = now(); const X = await SWD.page(f); return [X, now() - t]; };

      const [S1] = await open('market.html'); await ctl(S1);
      const fonts = [400, 600, 700, 800].flatMap(w => ['arabic', 'latin'].map(l => `fonts/cairo-${l}-${w}-normal.woff2`));
      const need = ['accounts.html', 'accounts.webmanifest', 'market.html', 'market.webmanifest', 'lib/ui.css', 'lib/datepick.js', 'lib/swup.js', 'fonts/fonts.css', ...fonts, 'icons/logo.jpg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
      const keys = await S1.evaluate(() => caches.open('flashon-tools-v3').then(c => c.keys()).then(ks => ks.map(k => new URL(k.url).pathname.slice(1))));
      eq('من أول فتحة للسوق: كل ملفات الحسابات والسوق اتخزنت (الصفحتين والخطوط وui.css وdatepick.js والأيقونات والـ manifest)', need.filter(f => !keys.includes(f)), []);
      const [Q0] = await open('quote.html'); await Q0.close();
      await S1.close();

      SRV.down = true;
      let [X, ms] = await open('market.html');
      eq('النت مقطوع: السوق بيفتح من المحفوظ في أقل من 2 ثانية', [ms < 2000, await X.evaluate(() => $('#main').children.length > 0)], [true, true]);
      await X.close();
      [X, ms] = await open('accounts.html');
      eq('النت مقطوع: الحسابات بتفتح من المحفوظ في أقل من 2 ثانية (شاشة إنشاء كلمة السر)', [ms < 2000, await X.evaluate(() => !!$('#suP'))], [true, true]);
      [X, ms] = await open('quote.html');
      eq('النت مقطوع: باقي الأدوات (عرض السعر) بتفتح من المحفوظ زي الأول', await X.evaluate(() => document.body.children.length > 0), true);
      await X.close();
      SRV.down = false;

      /* نت بطيء: الملف بياخد 6 ثواني ونسخة جديدة اترفعت. بيفتح المحفوظ بعد 3 ثواني، والجديد بيوصل لوحده لما مفيش شغل مفتوح */
      SRV.slow = {'market.html': 6000}; SRV.body = {'market.html': v('market.html', 2)};
      [X, ms] = await open('market.html');
      eq('نت بطيء: السوق بيفتح بالمحفوظ في أقل من 4.5 ثانية (مش مستني النت)', [ms < 4500, await X.evaluate(() => $('#main').children.length > 0 && !window.__v)], [true, true]);
      const ls0 = await X.evaluate(() => Object.keys(localStorage).sort());
      await X.evaluate(() => modal('<p>نافذة تجربة</p>'));
      await inCache(X, 'market.html', '__v=2'); await hide(X); await X.settle(800);
      eq('السوق: النسخة الجديدة وصلت بس مستنية (نافذة مفتوحة = شغل)', await X.evaluate(() => [!window.__v, $('#mask').classList.contains('on')]), [true, true]);
      await X.evaluate(() => { closeModal(); $('#main').insertAdjacentHTML('beforeend', '<input id="swT" type="text" value="12">'); }); await hide(X); await X.settle(800);
      eq('السوق: مستنية برضه وفيه خانة مكتوب فيها رقم', await X.evaluate(() => !window.__v), true);
      await X.evaluate(() => $('#swT').remove()); await hide(X);
      eq('السوق: النسخة الجديدة اتفتحت لوحدها أول ما مفيش شغل والتطبيق في الخلفية', await until(X, () => window.__v === 2), true);
      eq('السوق: البيانات المحفوظة زي ما هي', await X.evaluate(() => Object.keys(localStorage).sort()), ls0);
      await X.close();

      /* التطبيق مفتوح على طول (نت كويس) ونسخة جديدة اترفعت: بيلاقيها لما يرجع قدامك وبتتفتح لوحدها */
      SRV.slow = {}; SRV.body = {'market.html': v('market.html', 2)};
      [X] = await open('market.html'); await ctl(X);
      eq('نت كويس: السوق بيفتح الجديد على طول', await X.evaluate(() => window.__v), 2);
      SRV.body = {'market.html': v('market.html', 3)};
      await X.evaluate(() => swCheck()); await inCache(X, 'market.html', '__v=3'); await hide(X);
      eq('السوق مفتوح ونسخة جديدة اترفعت: بتوصل لوحدها', await until(X, () => window.__v === 3), true);
      await X.close();

      /* الحسابات: نت بطيء ونسخة جديدة. بتتفتح لوحدها بس على شاشة القفل وخانة كلمة السر فاضية */
      SRV.body = {};
      [X] = await open('accounts.html'); await ctl(X); await unlock(X, true); await X.click('#bLock'); await X.waitForSelector('#lkP'); await X.close();
      SRV.slow = {'accounts.html': 6000}; SRV.body = {'accounts.html': v('accounts.html', 2)};
      [X, ms] = await open('accounts.html'); await X.waitForSelector('#lkP');
      eq('نت بطيء: الحسابات بتفتح بالمحفوظ في أقل من 4.5 ثانية', [ms < 4500, await X.evaluate(() => !window.__v)], [true, true]);
      await X.fill('#lkP', '24'); await inCache(X, 'accounts.html', '__v=2'); await X.settle(800);
      eq('الحسابات: النسخة الجديدة مستنية وانت بتكتب كلمة السر', await X.evaluate(() => [!window.__v, $('#lkP').value]), [true, '24']);
      await X.fill('#lkP', '');
      eq('الحسابات: اتفتحت لوحدها أول ما الخانة فضيت', await until(X, () => window.__v === 2), true);
      await X.waitForSelector('#lkP'); await unlock(X);
      eq('الحسابات: البيانات زي ما هي (كلمة السر بتفتح نفس القاعدة)', await X.evaluate(() => [!!db, $('#lock').classList.contains('on')]), [true, false]);
      await X.close();
      SRV.slow = {}; SRV.body = {};

      /* باقي الأدوات: الشبكة أولاً زي الأول (نسخة جديدة بتظهر على طول) */
      SRV.body = {'quote.html': v('quote.html', 5)};
      [X] = await open('quote.html');
      eq('باقي الأدوات (عرض السعر): النسخة الجديدة بتظهر على طول زي الأول', await X.evaluate(() => window.__v), 5);
      SRV.body = {};
      await SWD.close();
    }

    sec('الشكل الموحد (lib/ui.css): 5 أحجام خط بس');
    /* كل كلام وأرقام الشاشة بأحجام النظام الخمسة بس (--f1..--f5)، ماعدا الأيقونات والأسهم وورقة الـ PDF */
    if (await A.$('#mask.on')) await A.evaluate(() => closeModal());
    await A.evaluate(() => go('home')); await A.settle(300);
    eq('الحسابات (الرئيسية): الخط بالخمس أحجام بس', await fs5(A), [true, []]);
    await A.evaluate(n => go('p/' + liveParties().find(x => x.name === n).id), 'عميل تجربة واحد'); await A.settle(300);
    eq('الحسابات (صفحة الحساب): الخط بالخمس أحجام بس', await fs5(A), [true, []]);
    for (const f of ['market.html']) { const X = await D1.page(f); await X.settle(800); eq(`${f}: الخط بالخمس أحجام بس`, await fs5(X), [true, []]); await X.close(); }

    sec('قاعدة التبويبات: سطر واحد ونفس الارتفاع ومفيش كلام مقطوع');
    /* أي مجموعة تبويبات (.seg) ظاهرة: كل زرار نفس الارتفاع، الكلام مش ملفوف على سطرين ولا متقطع */
    for (const k of ['profit', 'col', 'debt', 'tot', 'cash', 'item']) { await A.evaluate(k => { go('rep'); repKind = k; renderReports(); }, k); await A.settle(150); await segOk(A, 'الحسابات — التقارير (' + k + ')'); }
    await A.evaluate(() => go('cash')); await A.settle(200); await segOk(A, 'الحسابات — الخزنة');
    await A.evaluate(() => { mkView = 'arch'; mkAMode = 'day'; go('mkt'); renderMkt(); }); await A.settle(200); if (await A.$('#maMode')) await segOk(A, 'الحسابات — أرشيف الوارد'); await A.evaluate(() => { mkView = 'in'; });
        await A.evaluate(() => go('set')); await A.settle(200); await segOk(A, 'الحسابات — الإعدادات');
    if (DM) { const MX = DM.pages().find(p => p.url().includes('market.html')); if (MX) for (const h of ['', 'a', 's']) { await MX.evaluate(h => nav(h), h); await MX.settle(300); await segOk(MX, 'حركة السوق (' + (h || 'الرئيسية') + ')'); } }

    sec('قاعدة الأرقام: تحت بعض في عمود واحد (الحسابات والخزنة والسوق)');
    /* كل رقم في القايمة (وإجمالي القسم بتاعها) بيبدأ من نفس الخط على الشمال بالظبط: مفيش رقم داخل ورقم خارج */
    await A.evaluate(() => { go('cash'); cashMode = 'year'; renderCash(); }); await A.settle(300);
    await colOk('الحسابات — الخزنة (حركتي)', A, '#kst-me', '.kty .n');
    if (await A.$('#kst-mk')) await colOk('الحسابات — الخزنة (حركة السوق)', A, '#kst-mk', '.kty .n');
    if (await A.evaluate(() => !isWide() && !$('#p-cash .kb.two'))) await colOk('الحسابات — الخزنة (الأرصدة فوق)', A, '#p-cash .kb', '.kbm>.n,.kbk>.n,.kbt>.n');   // مع خزنة السوق الأرصدة صف واحد جنب بعض
    if (await A.evaluate(() => !isWide())) { await colOk('الحسابات — الخزنة (الملخص: الخزنة)', A, '#p-cash .ksum', 'td.m'); await colOk('الحسابات — الخزنة (الملخص: السوق)', A, '#p-cash .ksum', 'td.k');
      eq('الخزنة على الموبايل: الملخص = داخل وخارج كارت حركتي', await A.evaluate(() => { const v = s => $('#p-cash .ksum tr.' + s + ' td.m').textContent; return [v('in') === fmtP(+$('#kst-me .kin .n').dataset.cnt), v('out') === fmtP(+$('#kst-me .kout .n').dataset.cnt)]; }), [true, true]); }
    await A.evaluate(() => { mkView = 'in'; go('mkt'); renderMkt(); }); await A.settle(300);
    for (const [nm, root] of [['الوارد (جاهزين للنقل)', '#mqReady'], ['الوارد (محتاجين قرارك)', '#mqDec']]) if (await A.evaluate(r => $$(r + ' .mqa>.n').length >= 2, root)) await colOk('الحسابات — ' + nm, A, root, '.mqa>.n');
    await A.evaluate(() => { cashMode = 'day'; go('home'); }); await A.settle(300);
    await colOk('الحسابات — قايمة العملاء', A, '#hList', '.pt .a b');
    if (DM) { const MX = DM.pages().find(p => p.url().includes('market.html')); if (MX) { await MX.evaluate(() => nav('')); await MX.settle(400); await colOk('حركة السوق — الرئيسية', MX, '#main', '.gh .money,.row .a .money,.lbl.dh .money'); } }

    sec('١٥) المراجعة الداخلية');
    eq('مفيش أي مشكلة في المراجعة', await A.evaluate(() => selfCheck()), []);
    eq('مفيش أخطاء في الصفحات', D1.errs.concat(D2 ? D2.errs : [], DM ? DM.errs : []), []);
  } catch (e) { fails++; console.log('  ✖ الاختبار وقف:', e.message.split('\n').slice(0, 6).join(' | ')); if (process.env.DBG) console.log(e.stack); }
  await browser.close(); srv.close();
  if (secT.length) secT[secT.length - 1].s = (Date.now() - secT[secT.length - 1].t) / 1000;
  console.log('\n— الوقت —');
  secT.forEach(x => console.log(`  ${String(Math.round(x.s || 0)).padStart(4)} ث  ${x.name}`));
  console.log(`  الإجمالي ${Math.round((Date.now() - T0) / 1000)} ثانية (الانتظار الذكي: ${settleN} مرة، وصل للحد الأقصى ${settleCaps} مرة)`);
  console.log(`\n${fails ? '✖' : '✔'} ${oks} نجح، ${fails} فشل\n`);
  process.exit(fails ? 1 : 0);
})();
