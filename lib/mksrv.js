/* ====================== حركة السوق على سيرفر المصنع (بطلبه 22/11/2026) ======================
   "عايز اللي أحمد يكتبه يوصلني في لحظتها، وأحمد ميحسش بأي حاجة غير السرعة، ولينكه يفضل زي ما هو".
   الملف ده بيستخدمه تطبيق أحمد (market.html) والوارد في الحسابات (accounts.html، mkSyncOnce)، ومبيغيّرش أي منطق فيهم:
   بيغيّر بس المكان اللي "push"/"pull" بيروحوا له (call). باقي الأوامر (تليجرام، الإشعارات، ping) بتروح للشيت زي ما هي.
   - السيرفر: نفس سيرفر المصنع (server/)، قاعدة لوحدها اسمها market (?s=mkt) بتذكرة لوحدها طالعة من مفتاح شيت السوق.
     البيانات بتوصل متشفرة (AES-GCM) ومقفولة على نوعها|اسمها|وقتها|ملغي (AAD)، فالسيرفر ميقدرش يقراها ولا يبدّلها.
   - رقم المزامنة: الشيت والسيرفر كل واحد ليه أرقامه، فرقم السيرفر عند البرنامج = OFF + رقمه. أي رقم أقل = رقم شيت.
   - الكتابة على السيرفر بتروح للشيت وراها على طول في الخلفية (toSh، بنفس who) علشان الإشعارات وتليجرام ونسخة جوجل زي ما هم.
   - السيرفر وقع أو رفض = نفس الطلب بيروح للشيت في نفس اللحظة، واللي اتكتب على الشيت بس بيروح للسيرفر بعدين (toSv).
     ممنوع أي رد من السيرفر يوصل البرنامج كـ "key" (عند أحمد ده بيكتب "الربط اتغير" ويوقف المزامنة).
   - جهاز لسه على النسخة القديمة (بيكتب على الشيت بس): كل دقيقتين بنقرا الجديد من الشيت ونبعته للسيرفر (bridge).
   - النقل (boot): نسخة كاملة من الشيت ← السيرفر، وبعدين نقرا السيرفر كله ونتأكد إن كل سطر موجود بنفس الوقت أو أحدث واتفك سليم.
     بس ساعتها on. ولو اتقطع بيحاول تاني بعد دقيقة.
   - كل يوم مرة (reconcile): الشيت والسيرفر كلهم، اللي ناقص في أي واحد بيتبعتله.
   - الخط المفتوح (/live): أول ما جهاز تاني يكتب، السيرفر بيقول {seq} فالبرنامج بيسحب على طول (onLive).
   - شغال على عنوانين البرنامج بس. الاختبارات بتدّي window.__srvUrl (ممنوع توصل السيرفر الحقيقي). */
(() => {
'use strict';
const HOSTS = /^(app\.flashoneg\.com|mostafasukar33\.github\.io)$/;
const BASE = window.__srvUrl || (HOSTS.test(location.hostname) ? 'https://factory-sync.mostafasukar33.workers.dev/' : '');
const OFF = 1e12, REST = 120000, BRIDGE_MS = 120000, DAY = 86400000, TRY_MS = 60000, BAD_MS = 6 * 3600000, ITER = 250000, ROWS = 200, BODY = 900000;
const te = new TextEncoder(), td = new TextDecoder();
const b64 = u8 => { let s = ''; const a = new Uint8Array(u8); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const err = (c, m) => Object.assign(new Error(m || 'mkx:' + c), {mkx: c});
const WHY = {net: 'النت أو السيرفر مش واصل', slow: 'السيرفر اتأخر', page: 'رد مش مفهوم', key: 'السيرفر رفض المفتاح', off: 'السيرفر متوقف بالقصد',
  ep: 'السيرفر اتعمل من جديد', ack: 'السيرفر مأكدش الاستلام', open: 'بيانات مش مطابقة للتشفير', sheet: 'الشيت مردش', miss: 'المقارنة لقت سطور ناقصة'};
const why = e => WHY[e && e.mkx] || (e && e.message) || String(e);
const ALL = new Set();
document.addEventListener('visibilitychange', () => ALL.forEach(x => document.hidden ? x.sleep() : x.wake()));

/* h = {st(): مكان حفظ الحالة، save()، sheet(body) = نفس طلب الشيت اللي البرنامج بيستخدمه، key()، dev()، ok() = البرنامج جاهز، onLive()} */
function MkSrv(h) {
  let K = null, failAt = 0, ws = null, wsT = null, wsP = null, wsN = 0, alive = false, stopped = false;
  const busy = {sh: 0, sv: 0, boot: 0, br: 0, rc: 0};
  const S = () => { const s = h.st(); if (!s.toSh) s.toSh = {}; if (!s.toSv) s.toSv = {}; return s; };
  const on = () => !!(BASE && !stopped && S().on && Date.now() - failAt > REST);
  async function keys() {
    const k = h.key(); if (!k) throw err('key');
    if (K && K.k === k) return K;
    const base = await crypto.subtle.importKey('raw', te.encode(k), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', salt: te.encode('fo-srv-mkt-v1'), iterations: ITER, hash: 'SHA-256'}, base, 512));
    const enc = await crypto.subtle.importKey('raw', bits.slice(0, 32), {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
    return K = {k, enc, tok: b64(bits.slice(32)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')};
  }
  const aad = (kind, id, upd, del) => te.encode(`${kind}|${id}|${upd}|${del ? 1 : 0}`);
  async function seal(k, r) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: aad(r.kind, r.id, r.upd, r.del)}, k.enc, te.encode(JSON.stringify(r.data))));
    const o = new Uint8Array(12 + ct.length); o.set(iv); o.set(ct, 12); return b64(o);
  }
  async function open(k, x) {
    try { const u = unb64(x.data); return JSON.parse(td.decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: u.slice(0, 12), additionalData: aad(x.kind, x.id, x.upd, x.del)}, k.enc, u.slice(12)))); }
    catch (e) { throw err('open'); }
  }
  async function srv(b, ms = 15000) {
    const k = await keys(), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(BASE + '?s=mkt', {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(Object.assign({k: k.tok, d: String(h.dev() || '')}, b)), signal: ctl.signal, cache: 'no-store'});
      let j = null; try { j = await r.json(); } catch (e) {}
      if (!j || typeof j !== 'object') throw err('page');
      return j;
    } catch (e) { if (e.mkx) throw e; throw err(ctl.signal.aborted ? 'slow' : 'net'); }
    finally { clearTimeout(t); }
  }
  /* رد السيرفر مش تمام: ep = القاعدة اتعملت من جديد (كل حاجة تتنقل تاني)، key/off = نفضل على الشيت ونجرب كل 6 ساعات */
  function ok(j) {
    if (j && j.ok === true && Array.isArray(j.rows)) return;
    const e = (j && j.error) || 'page', s = S();
    if (e === 'ep') { s.on = false; delete s.ep; s.svc = 0; s.toSv = {}; s.tryAt = 0; }
    if (e === 'key' || e === 'off') { s.on = false; s.bad = {at: Date.now(), why: e}; }
    throw err(e);
  }
  const plain = r => ({id: r.id, kind: r.kind, upd: Number(r.upd), del: !!r.del, data: r.data});
  /* بعت سطور للسيرفر (دفعات)، ويرجّع الـ ids اللي اتأكدت */
  async function up(list) {
    const k = await keys(), s = S(), got = new Set();
    for (let i = 0; i < list.length;) {
      const part = []; let sz = 0;
      while (i < list.length && part.length < ROWS) {
        const r = list[i], row = {id: r.id, kind: r.kind, upd: Number(r.upd), del: !!r.del, data: await seal(k, r)};
        if (part.length && sz + row.data.length > BODY) break;
        part.push(row); sz += row.data.length; i++;
      }
      const j = await srv({a: 'sync', ep: s.ep, since: Number.MAX_SAFE_INTEGER, rows: part}, 15000 + Math.round(sz / 20));
      ok(j);
      const ack = new Set(j.ack || []);
      if (part.some(r => !ack.has(r.id))) throw err('ack');
      part.forEach(r => got.add(r.id + '|' + r.upd));
    }
    return got;
  }
  /* كل اللي على السيرفر (للمقارنة): id ← {upd, del} بعد ما كل سطر اتفك سليم */
  async function svAll() {
    const k = await keys(), s = S(), m = new Map(); let since = 0;
    for (let g = 0; g < 1000; g++) {
      const j = await srv({a: 'sync', ep: s.ep, since, rows: []}, 30000); ok(j);
      for (const x of j.rows) { const d = await open(k, x); m.set(x.id, {id: x.id, kind: x.kind, upd: Number(x.upd), del: !!x.del, data: d}); }
      since = j.next; if (!j.more) break;
    }
    return m;
  }
  /* الشيت كله (للنقل والمقارنة اليومية) */
  async function shAll() {
    const m = new Map(); let nx = 0, more = true;
    for (let g = 0; more && g < 1000; g++) {
      const j = await h.sheet({action: 'pull', since: nx});
      if (!j || j.ok !== true || !Array.isArray(j.rows)) throw err('sheet');
      j.rows.forEach(r => { if (r && r.id && r.data) { const c = m.get(r.id); if (!c || c.upd <= Number(r.upd)) m.set(r.id, plain(r)); } });
      nx = j.next || nx; more = !!j.more;
    }
    return {m, next: nx};
  }

  async function svPush(body) {
    const s = S(), rows = body.rows || [];
    const got = await up(rows.map(plain));
    const ack = rows.filter(r => got.has(r.id + '|' + Number(r.upd))).map(r => r.id);
    rows.forEach(r => { if (got.has(r.id + '|' + Number(r.upd))) { const c = s.toSh[r.id]; if (!c || Number(c.r.upd) <= Number(r.upd)) s.toSh[r.id] = {r, w: body.who || ''}; } });
    h.save(); setTimeout(flushSh, 0);
    return {ok: true, ack, seq: OFF + (s.svc || 0)};
  }
  async function svPull(body) {
    const s = S(), k = await keys(), since = Number(body.since) || 0;
    const from = since >= OFF ? since - OFF : since === 0 ? 0 : (s.svc || 0);
    const j = await srv({a: 'sync', ep: s.ep, since: from, rows: []}, 30000); ok(j);
    const rows = [];
    for (const x of j.rows) rows.push({id: x.id, kind: x.kind, upd: Number(x.upd), del: !!x.del, data: await open(k, x)});
    if (!j.more || j.next > (s.svc || 0)) s.svc = Math.max(s.svc || 0, j.next);
    return {ok: true, rows, next: OFF + j.next, more: !!j.more};
  }
  /* الشيت ورا السيرفر: اللي اتكتب على السيرفر من الجهاز ده بيروح للشيت بنفس who (الإشعارات وتليجرام زي الأول) */
  async function flushSh() {
    const s = S(); if (busy.sh || stopped || !Object.keys(s.toSh).length) return;
    busy.sh = 1;
    try {
      for (const w of ['m', 'a', '']) {
        const ids = Object.keys(s.toSh).filter(id => (s.toSh[id].w || '') === w);
        for (let i = 0; i < ids.length; i += 40) {
          const part = ids.slice(i, i + 40).map(id => s.toSh[id]).filter(Boolean), rows = part.map(x => x.r);
          const j = await h.sheet(w ? {action: 'push', who: w, rows} : {action: 'push', rows});
          if (!j || j.ok !== true) throw err('sheet');
          const ack = new Set(j.ack || []);
          part.forEach(x => { const c = s.toSh[x.r.id]; if (c && ack.has(x.r.id) && Number(c.r.upd) === Number(x.r.upd)) delete s.toSh[x.r.id]; });
        }
      }
      s.shOk = Date.now(); delete s.shErr;
    } catch (e) { s.shErr = Date.now(); }
    finally { busy.sh = 0; h.save(); }
  }
  /* اللي راح للشيت بس (السيرفر كان واقع، أو جهاز لسه على النسخة القديمة) بيروح للسيرفر */
  async function flushSv() {
    const s = S(); if (busy.sv || !on() || !Object.keys(s.toSv).length) return;
    busy.sv = 1;
    try {
      const list = Object.values(s.toSv), got = await up(list);
      list.forEach(r => { const c = s.toSv[r.id]; if (c && got.has(r.id + '|' + c.upd)) delete s.toSv[r.id]; });
    } catch (e) { if (!e.mkx || /^(net|slow|page)$/.test(e.mkx)) failAt = Date.now(); s.err = why(e); }
    finally { busy.sv = 0; h.save(); }
  }
  async function bridge() {
    const s = S(); if (busy.br || !on() || Date.now() - (s.brAt || 0) < BRIDGE_MS) return;
    busy.br = 1; s.brAt = Date.now();
    let n = 0;
    try {
      let nx = s.bgc || 0, more = true;
      for (let g = 0; more && g < 100; g++) {
        const j = await h.sheet({action: 'pull', since: nx});
        if (!j || j.ok !== true || !Array.isArray(j.rows)) throw err('sheet');
        j.rows.forEach(r => { if (r && r.id && r.data) { const c = s.toSv[r.id]; if (!c || c.upd < Number(r.upd)) { s.toSv[r.id] = plain(r); n++; } } });
        nx = j.next || nx; more = !!j.more;
      }
      s.bgc = nx;
    } catch (e) {} finally { busy.br = 0; h.save(); }
    await flushSv();
    if (n && on()) h.onLive();   // اللي جه من الشيت ممكن يكون جديد على الجهاز ده كمان (السيرفر مبيقولش للجهاز اللي كتب)
  }
  /* النقل: نسخة الشيت كلها ← السيرفر، ومقارنة، وبعدين on */
  async function boot() {
    const s = S(), now = Date.now();
    if (!BASE || stopped || busy.boot || on() || !h.ok()) return;
    if (s.on && now - failAt <= REST) return;
    if (s.bad && now - s.bad.at < BAD_MS) return;
    if (now - (s.tryAt || 0) < TRY_MS) return;
    busy.boot = 1; s.tryAt = now;
    try {
      const hj = await srv({a: 'hello'}, 20000);
      if (!hj || hj.ok !== true) { if (hj && (hj.error === 'key' || hj.error === 'off')) s.bad = {at: Date.now(), why: hj.error}; throw err(hj && hj.error || 'page'); }
      delete s.bad;
      if (s.ep && s.ep !== hj.ep) { s.svc = 0; s.toSv = {}; }
      s.ep = hj.ep;
      const sh = await shAll();
      await up([...sh.m.values()]);
      const sv = await svAll(), miss = [...sh.m.values()].filter(r => { const x = sv.get(r.id); return !x || x.upd < r.upd; });
      if (miss.length) throw err('miss', `المقارنة لقت ${miss.length} سطر ناقص، هيتبعتوا تاني`);
      s.on = true; s.onAt = s.rcAt = Date.now(); s.svc = 0; s.bgc = sh.next; failAt = 0; delete s.err;
      h.save(); live(); setTimeout(() => h.onLive(), 0);   // أول سحب من السيرفر على طول
    } catch (e) { s.err = why(e); }
    finally { busy.boot = 0; h.save(); }
  }
  /* كل يوم مرة: الشيت والسيرفر كلهم، والناقص في أي واحد بيتبعتله (اللي رايح للشيت من غير who: مبيعملش إشعار) */
  async function reconcile() {
    const s = S(); if (busy.rc || !on() || Date.now() - (s.rcAt || 0) < DAY) return;
    busy.rc = 1; s.rcAt = Date.now();
    try {
      const sh = await shAll(), sv = await svAll(), toSv = [];
      sh.m.forEach(r => { const x = sv.get(r.id); if (!x || x.upd < r.upd) toSv.push(r); });
      let nSh = 0;
      sv.forEach(x => { const r = sh.m.get(x.id); if ((!r || r.upd < x.upd) && !s.toSh[x.id]) { s.toSh[x.id] = {r: Object.assign({view: []}, x), w: ''}; nSh++; } });
      if (toSv.length) await up(toSv);
      s.rc = {at: Date.now(), sv: toSv.length, sh: nSh};
      if (nSh) setTimeout(flushSh, 0);
    } catch (e) { s.rcErr = why(e); }
    finally { busy.rc = 0; h.save(); }
  }
  /* الخط المفتوح */
  function live() {
    if (!BASE || stopped || ws || !on() || document.hidden) return;
    clearTimeout(wsT);
    let w; try { w = new WebSocket(BASE.replace(/^http/, 'ws') + 'live?s=mkt'); } catch (e) { return later(); }
    ws = w; alive = false;
    w.onopen = async () => { try { const k = await keys(); if (ws === w) w.send(JSON.stringify({k: k.tok, d: String(h.dev() || '')})); } catch (e) { try { w.close(); } catch (x) {} } };
    w.onmessage = ev => {
      const m = String(ev.data); if (m === 'o') return;
      let j = null; try { j = JSON.parse(m); } catch (e) { return; }
      if (j.ok) { alive = true; wsN = 0; clearInterval(wsP); wsP = setInterval(() => { try { w.send('p'); } catch (e) {} }, 25000); }
      if (typeof j.seq === 'number' && j.seq > (S().svc || 0)) h.onLive();
    };
    w.onclose = () => { if (ws === w) { ws = null; alive = false; clearInterval(wsP); later(); } };
    w.onerror = () => {};
  }
  function later() { clearTimeout(wsT); if (stopped || !on() || document.hidden) return; wsT = setTimeout(live, Math.min(60000, 2000 * Math.pow(2, wsN++))); }
  const X = {
    OFF,
    /* نفس شكل رد الشيت بالظبط */
    async call(body) {
      const a = body && body.action;
      if (a !== 'push' && a !== 'pull') return h.sheet(body);
      const s = S();
      if (on()) {
        try { return a === 'push' ? await svPush(body) : await svPull(body); }
        catch (e) { if (!e.mkx || /^(net|slow|page|ack|open|miss)$/.test(e.mkx)) failAt = Date.now(); s.err = why(e); h.save(); close(); }
      }
      if (a === 'pull') {
        const since = Number(body.since) || 0;
        const j = await h.sheet(Object.assign({}, body, {since: since >= OFF ? (s.shc || 0) : since}));
        if (j && j.ok === true && typeof j.next === 'number' && j.next > (s.shc || 0) && !j.more) s.shc = j.next;
        return j;
      }
      const j = await h.sheet(body);
      if (s.on && j && j.ok === true) { const ack = new Set(j.ack || []); (body.rows || []).forEach(r => { if (ack.has(r.id)) s.toSv[r.id] = plain(r); }); h.save(); }
      return j;
    },
    /* بعد كل مزامنة ناجحة: الشيت ورا السيرفر، والجديد من الشيت، والمقارنة اليومية، والنقل لو لسه، والخط المفتوح */
    tick() {
      if (stopped) return;
      flushSh().then(() => flushSv()).then(() => bridge()).then(() => reconcile()).then(() => boot()).then(() => live()).catch(() => {});
    },
    on, alive: () => !!(ws && alive), state: () => S(),
    retry() { failAt = 0; },   // جرّب السيرفر تاني على طول (الاختبارات)
    sleep() { close(); },
    wake() { if (on()) live(); },
    stop() { stopped = true; close(); ALL.delete(X); }
  };
  function close() { clearTimeout(wsT); clearInterval(wsP); const w = ws; ws = null; alive = false; if (w) try { w.close(); } catch (e) {} }
  ALL.add(X);
  return X;
}
window.MkSrv = BASE ? MkSrv : null;
})();
