// حركة السوق — فلاش أون (مقفول بمفتاح سري بيتحفظ أول مرة). شيت منفصل عن الحسابات.
const SHEET = 'الحركات';
const HEAD = ['id','النوع','آخر تعديل','رقم المزامنة','ملغي','الوقت','الاسم','المبلغ','الطريقة','الحالة','البيانات (لا تعدّلها)'];
const W = HEAD.length;
const TG = 'https://api.telegram.org/bot';
const PUSH = 'https://app.flashoneg.com/push';   // وسيط إشعارات الأيفون (functions/push.js في نفس المشروع)
const VER = 6;   /* 6 = إشعارات الأيفون (رقم الوارد على أيقونة الحسابات): psub/pseen/ptest، وبعد تليجرام بيبعت للوسيط PUSH. 5 = كل رد فيه وقت الشيت t. 2 = نص تليجرام بييجي جاهز من تطبيق الشريك (data.tg). 3 = رسايل من الحسابات لمصطفى (نسخة احتياطية وملخص وتنبيه: tgmsg/tgdoc). 4 = السحب بيقرا عمود رقم المزامنة بس وبعدين السطور الجديدة بس، والإرسال بيقرا عمود الـ id بس */
const MW = {cash: 'كاش', insta: 'إنستا', voda: 'فودافون كاش'};
function sh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(SHEET);
  if (!s) { s = ss.insertSheet(SHEET); s.appendRow(HEAD); s.setFrozenRows(1); }
  return s;
}
function doGet() { return out_({ok: false, error: 'locked'}); }
function key_(k) {
  if (typeof k !== 'string' || k.length < 8) return false;
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('KEY');
  if (!s) {
    const l = LockService.getScriptLock(); l.waitLock(10000);
    try { s = p.getProperty('KEY'); if (!s) { p.setProperty('KEY', k); s = k; } } finally { l.releaseLock(); }
  }
  return s === k;
}
function resetKey() { PropertiesService.getScriptProperties().deleteProperty('KEY'); }
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ok: false, error: 'bad'}); }
  if (!req || !key_(req.key)) return out_({ok: false, error: 'key'});
  const p = PropertiesService.getScriptProperties();
  if (req.action === 'ping') return out_({ok: true, app: 'fo-mkt', v: VER, n: Math.max(sh_().getLastRow() - 1, 0), seq: Number(p.getProperty('SEQ')) || 0});
  if (req.action === 'push') return out_(push_(req.rows || [], req.who));
  if (req.action === 'pull') return out_(pull_(Number(req.since) || 0));
  if (req.action === 'tg') return out_(tgSet_(req.token));
  if (req.action === 'tgtest') return out_(tgTest_());
  if (req.action === 'tgstate') return out_(tgState_());
  if (req.action === 'tgmsg') return out_(tgOnce_(req, () => tgSend_(String(req.text || '').slice(0, 4000))));
  if (req.action === 'psub') return out_(pSub_(req));
  if (req.action === 'pseen') { p.setProperty('PUSH_N', String(Math.max(0, Math.round(Number(req.n) || 0)))); return out_({ok: true, v: VER}); }
  if (req.action === 'ptest') return out_(Object.assign({ok: true, v: VER}, pSend_({t: '✅ تجربة', b: 'إشعارات وارد السوق شغالة. أي حاجة شريكك يسجلها هتوصلك هنا.', n: Number(p.getProperty('PUSH_N')) || 0, u: 'accounts.html#mkt'}, String(req.dev || ''))));
  if (req.action === 'tgdoc') return out_(tgOnce_(req, () => tgDoc_(String(req.name || 'backup.json'), String(req.text || ''), String(req.caption || '').slice(0, 1000))));
  return out_({ok: false, error: 'action'});
}
function push_(rows, who) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  const msgs = [];
  let res, nNew = 0;
  try {
    const s = sh_(), last = s.getLastRow();
    /* عمود الـ id بس. "آخر تعديل" بيتقرا للسطور اللي موجودة فعلاً بس (التعديلات)، مش للشيت كله */
    const ids = last > 1 ? s.getRange(2, 1, last - 1, 1).getValues() : [];
    const pos = {}; ids.forEach((r, i) => pos[String(r[0])] = i);
    const hit = [], upd = {};
    rows.forEach(r => { if (pos[r.id] !== undefined) hit.push(pos[r.id]); });
    if (hit.length) {
      const lo = Math.min.apply(null, hit), hi = Math.max.apply(null, hit);
      if (hit.length * 20 < hi - lo) hit.forEach(i => upd[i] = s.getRange(i + 2, 3, 1, 1).getValues()[0][0]);
      else s.getRange(lo + 2, 3, hi - lo + 1, 1).getValues().forEach((r, k) => upd[lo + k] = r[0]);
    }
    const props = PropertiesService.getScriptProperties();
    let seq = Number(props.getProperty('SEQ')) || 0;
    const add = [], addAt = {}, ack = [];
    rows.forEach(r => {
      const i = pos[r.id];
      ack.push(r.id);
      if (i !== undefined && Number(upd[i]) >= Number(r.upd)) return;
      if (addAt[r.id] !== undefined && Number(add[addAt[r.id]][2]) >= Number(r.upd)) return;
      /* تنبيه تليجرام لكل حركة جديدة أو تعديل أو مسح من الشريك */
      if (r.kind === 'op' && who === 'm') {
        let old = null;
        if (i !== undefined) { try { old = JSON.parse(s.getRange(i + 2, W, 1, 1).getValues()[0][0]); old.del = s.getRange(i + 2, 5, 1, 1).getValues()[0][0] === 'نعم'; } catch (x) { old = null; } }
        const m = opMsg_(old, r.data || {}, !!r.del); if (m) msgs.push(m);
        if (!r.del && (!old || old.del)) nNew++;
      }
      seq++;
      const v = (r.view || []).concat(['', '', '', '', '']).slice(0, 5);
      const line = [r.id, r.kind, r.upd, seq, r.del ? 'نعم' : ''].concat(v, [JSON.stringify(r.data)]);
      if (i !== undefined) { s.getRange(i + 2, 1, 1, W).setValues([line]); upd[i] = r.upd; }
      else if (addAt[r.id] !== undefined) add[addAt[r.id]] = line;
      else { addAt[r.id] = add.length; add.push(line); }
    });
    if (add.length) s.getRange(last + 1, 1, add.length, W).setValues(add);
    props.setProperty('SEQ', String(seq));
    res = {ok: true, ack: ack, seq: seq};
  } catch (err) { res = {ok: false, error: String(err)}; }
  finally { lock.releaseLock(); }
  if (res.ok && msgs.length) tgSend_(msgs.length > 4 ? msgs.join('\n') : msgs);
  if (res.ok && msgs.length) pushOps_(msgs, nNew);
  return res;
}
function pull_(since) {
  /* أسرع رد: لو مفيش جديد من آخر مرة مبنقراش الشيت خالص */
  const seq = Number(PropertiesService.getScriptProperties().getProperty('SEQ')) || 0;
  if (since >= seq) return {ok: true, rows: [], next: since, more: false};
  const s = sh_(), last = s.getLastRow();
  if (last < 2) return {ok: true, rows: [], next: since, more: false};
  /* عمود رقم المزامنة بس، وبعدين السطور الجديدة بس (حتت ورا بعض، أو من أول جديد لآخر جديد لو متفرقة قوي) */
  const v = [];
  s.getRange(2, 4, last - 1, 1).getValues().forEach((r, i) => { const n = Number(r[0]); if (n > since) v.push([n, i]); });
  v.sort((a, b) => a[0] - b[0]);
  const page = v.slice(0, 1500), at = page.map(x => x[1]).sort((a, b) => a - b), got = {}, runs = [];
  at.forEach(i => { const r = runs[runs.length - 1]; if (r && i - r[1] <= 30) r[1] = i; else runs.push([i, i]); });
  const read = (a, b) => s.getRange(a + 2, 1, b - a + 1, W).getValues().forEach((r, k) => got[a + k] = r);
  if (runs.length > 40) read(at[0], at[at.length - 1]); else runs.forEach(r => read(r[0], r[1]));
  const rows = page.map(x => { const r = got[x[1]]; try { return {id: String(r[0]), kind: String(r[1]), upd: Number(r[2]), del: r[4] === 'نعم', data: JSON.parse(r[W - 1])}; } catch (e) { return null; } }).filter(Boolean);
  return {ok: true, rows: rows, next: page.length ? page[page.length - 1][0] : since, more: v.length > page.length};
}
function money_(q) {
  const n = Math.round(Number(q) || 0) / 100, t = String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), f = Math.round((n % 1) * 100);
  return t + (f ? '.' + (f < 10 ? '0' : '') + f : '');
}
/* نص الحركة بالعربي (كل الأنواع: دفعة عميل، مصروف، دفعة مورد، تسليم لمصطفى) */
function opText_(d) {
  const a = money_(d.amt);
  if (d.t === 'pay') return (d.cname || 'عميل') + (d.newc ? ' (عميل جديد)' : '') + ' دفع ' + a + ' ' + (MW[d.m] || '');
  if (d.t === 'inv') return (d.cname || 'عميل') + (d.newc ? ' (عميل جديد)' : '') + ' فاتورة بـ ' + a;
  if (d.t === 'exp') return 'مصروف' + (d.cat ? ' ' + d.cat : '') + ': ' + a + (d.note ? ' — ' + d.note : '');
  if (d.t === 'spay') return 'دفع للمورد ' + (d.sname || '') + ' ' + a;
  if (d.t === 'hand') return 'سلّمك ' + a + ' كاش';
  if (d.t === 'cs') return 'بيع كاش من المصنع ' + a + (d.buyer ? ' — ' + d.buyer : '') + (d.m === 'tr' ? ' (تحويل)' : '');
  return 'حركة ' + a;
}
const ICON = {pay: '💵', inv: '🧾', exp: '⛽', spay: '🏭', hand: '🤝', cs: '🏭', rt: '↩️'};
function txt_(d) { return d.tg || opText_(d); }
function opMsg_(old, d, del) {
  const ic = ICON[d.t] || '•';
  if (del) return old && !old.del ? '🗑 اتمسحت: ' + txt_(old) : '';
  if (!old || old.del) return ic + ' ' + txt_(d);
  const a = txt_(old), b = txt_(d);
  return a === b ? '' : '✏️ اتعدلت: ' + a + '\nبقت: ' + b;
}
function tgGet_(t, method, payload) {
  const o = {muteHttpExceptions: true};
  if (payload) { o.method = 'post'; o.contentType = 'application/json'; o.payload = JSON.stringify(payload); }
  return JSON.parse(UrlFetchApp.fetch(TG + t + '/' + method, o).getContentText());
}
/* الـ chat id بيتجاب لوحده من آخر رسالة اتبعتت للبوت (زي "ابدأ") */
function tgChat_(t) {
  const p = PropertiesService.getScriptProperties();
  let c = p.getProperty('TG_CHAT');
  if (c) return c;
  try {
    const u = (tgGet_(t, 'getUpdates').result || []).filter(x => x.message && x.message.chat).pop();
    if (u) { c = String(u.message.chat.id); p.setProperty('TG_CHAT', c); return c; }
  } catch (x) {}
  return '';
}
function tgSend_(texts) {
  const t = PropertiesService.getScriptProperties().getProperty('TG_TOKEN');
  if (!t) return false;
  const c = tgChat_(t); if (!c) return false;
  let ok = true;
  [].concat(texts).forEach(x => { try { const r = tgGet_(t, 'sendMessage', {chat_id: c, text: x}); ok = ok && !!(r && r.ok); } catch (e) { ok = false; } });
  return ok;
}
function tgSet_(token) {
  token = String(token || '').trim();
  if (!/^\d{5,}:[\w-]{20,}$/.test(token)) return {ok: false, error: 'token'};
  let me; try { me = tgGet_(token, 'getMe'); } catch (e) { return {ok: false, error: 'net'}; }
  if (!me || !me.ok) return {ok: false, error: 'token'};
  const p = PropertiesService.getScriptProperties();
  p.setProperty('TG_TOKEN', token); p.setProperty('TG_BOT', me.result.username || ''); p.deleteProperty('TG_CHAT');
  return {ok: true, bot: me.result.username || '', chat: !!tgChat_(token)};
}
/* رسايل من برنامج الحسابات لمصطفى بس (نسخة احتياطية، ملخص اليوم، تنبيه). مبيتكتبش منها أي حاجة في شيت الحركات، فتطبيق الشريك مبيشوفهاش.
   once = {k, v}: لو نفس القيمة اتبعتت قبل كده (من أي جهاز) مبتتبعتش تاني */
function tgOnce_(req, send) {
  const p = PropertiesService.getScriptProperties(), o = req.once && req.once.k ? 'ONCE_' + String(req.once.k).replace(/[^a-z0-9]/gi, '').slice(0, 20) : '';
  if (o && p.getProperty(o) === String(req.once.v)) return {ok: true, v: VER, sent: false, dup: true};
  const sent = send();
  if (sent && o) p.setProperty(o, String(req.once.v));
  return {ok: true, v: VER, sent: !!sent};
}
function tgDoc_(name, text, caption) {
  const t = PropertiesService.getScriptProperties().getProperty('TG_TOKEN');
  if (!t || !text) return false;
  const c = tgChat_(t); if (!c) return false;
  try {
    const r = UrlFetchApp.fetch(TG + t + '/sendDocument', {method: 'post', muteHttpExceptions: true, payload: {chat_id: c, caption: caption, document: Utilities.newBlob(text, 'application/json', name)}});
    const j = JSON.parse(r.getContentText()); return !!(j && j.ok);
  } catch (e) { return false; }
}
function tgState_() {
  const p = PropertiesService.getScriptProperties(), t = p.getProperty('TG_TOKEN');
  let url = ''; try { url = SpreadsheetApp.getActiveSpreadsheet().getUrl(); } catch (e) {}
  return {ok: true, v: VER, token: !!t, bot: p.getProperty('TG_BOT') || '', chat: !!(t && tgChat_(t)), url: url};
}
function tgTest_() {
  const st = tgState_();
  if (!st.token || !st.chat) return Object.assign(st, {sent: false});
  return Object.assign(st, {sent: tgSend_('✅ تنبيهات حركة السوق شغالة. أي حاجة شريكك يسجلها هتوصلك هنا.')});
}
/* إشعارات الأيفون: كل جهاز حسابات فعّلها بيبعت اشتراكه ومفتاحه (psub)، ويتحفظوا هنا في Script Properties (زي توكن تليجرام).
   PUSH_N = رقم الأيقونة: الوارد المستني وقت آخر فتح للحسابات (pseen) + اللي جه من الشريك بعدها. الشريك ملوش دعوة بأي حاجة هنا */
function pSubs_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('PUSH_SUBS') || '{}') || {}; } catch (e) { return {}; } }
function pSub_(req) {
  const p = PropertiesService.getScriptProperties(), all = pSubs_(), dev = String(req.dev || '').slice(0, 20);
  if (!dev) return {ok: false, v: VER, error: 'dev'};
  if (req.sub && req.sub.endpoint && req.jwk && req.jwk.d) all[dev] = {s: req.sub, k: req.jwk, at: Date.now()};
  else delete all[dev];
  p.setProperty('PUSH_SUBS', JSON.stringify(all));
  return {ok: true, v: VER, n: Object.keys(all).length};
}
function pSend_(m, only) {
  const p = PropertiesService.getScriptProperties(), all = pSubs_(), ids = Object.keys(all).filter(d => !only || d === only);
  if (!ids.length) return {sent: 0, none: true};
  let r; try { r = UrlFetchApp.fetch(PUSH, {method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify({subs: ids.map(d => ({s: all[d].s, k: all[d].k})), m: m})}); } catch (e) { return {sent: 0, err: 'net'}; }
  let j = null; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (!j || !Array.isArray(j.st)) return {sent: 0, err: 'relay', code: r.getResponseCode()};
  let sent = 0, gone = 0;
  j.st.forEach((c, i) => { if (c >= 200 && c < 300) sent++; else if (c === 404 || c === 410) { delete all[ids[i]]; gone++; } });
  if (gone) p.setProperty('PUSH_SUBS', JSON.stringify(all));
  return {sent: sent, gone: gone, st: j.st};
}
function pushOps_(msgs, nNew) {
  try {
    const p = PropertiesService.getScriptProperties();
    if (p.getProperty('PUSH_SUBS') === null) return;
    const n = (Number(p.getProperty('PUSH_N')) || 0) + nNew;
    if (nNew) p.setProperty('PUSH_N', String(n));
    const b = msgs.length > 3 ? msgs.slice(0, 3).join('\n') + '\n… و' + (msgs.length - 3) + ' كمان' : msgs.join('\n');
    pSend_({t: '📥 حركة السوق', b: b.slice(0, 1500), n: n, u: 'accounts.html#mkt'});
  } catch (e) {}
}
function out_(o) { o.t = Date.now(); return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }   // t = وقت الشيت، التطبيق بيستخدمه بدل ساعة الجهاز