// حسابات فلاش أون (مقفول بمفتاح سري بيتحفظ أول مرة)
const SHEET = 'السجلات';
const HEAD = ['id','النوع','آخر تعديل','رقم المزامنة','ملغي','التاريخ','الحساب','القسم','البيان','مدين','دائن','البيانات (لا تعدّلها)'];
const W = HEAD.length;
const VER = 2;   /* 2 = السحب بيرد على طول لو مفيش جديد، وبيقرا عمود رقم المزامنة بس وبعدين السطور الجديدة بس */
const PAGE = 1500;
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
const seq_ = () => Number(PropertiesService.getScriptProperties().getProperty('SEQ')) || 0;
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ok: false, error: 'bad'}); }
  if (!req || !key_(req.key)) return out_({ok: false, error: 'key'});
  if (req.action === 'ping') return out_({ok: true, app: 'fo-acc', v: VER, n: Math.max(sh_().getLastRow() - 1, 0), seq: seq_(), url: SpreadsheetApp.getActiveSpreadsheet().getUrl()});
  if (req.action === 'push') return out_(push_(req.rows || []));
  if (req.action === 'pull') return out_(pull_(Number(req.since) || 0));
  return out_({ok: false, error: 'action'});
}
function push_(rows) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const s = sh_(), last = s.getLastRow();
    /* عمود الـ id بس. "آخر تعديل" بيتقرا للسطور اللي موجودة فعلاً بس (التعديلات)، مش للشيت كله */
    const ids = last > 1 ? s.getRange(2, 1, last - 1, 1).getValues() : [];
    const pos = {}; ids.forEach((r, i) => pos[String(r[0])] = i);
    const hit = [];
    rows.forEach(r => { if (pos[r.id] !== undefined) hit.push(pos[r.id]); });
    const upd = {};
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
      seq++;
      const v = (r.view || []).concat(['', '', '', '', '', '']).slice(0, 6);
      const line = [r.id, r.kind, r.upd, seq, r.del ? 'نعم' : ''].concat(v, [JSON.stringify(r.data)]);
      if (i !== undefined) { s.getRange(i + 2, 1, 1, W).setValues([line]); upd[i] = r.upd; }
      else if (addAt[r.id] !== undefined) add[addAt[r.id]] = line;
      else { addAt[r.id] = add.length; add.push(line); }
    });
    if (add.length) s.getRange(last + 1, 1, add.length, W).setValues(add);
    props.setProperty('SEQ', String(seq));
    return {ok: true, ack: ack, seq: seq};
  } catch (err) { return {ok: false, error: String(err)}; }
  finally { lock.releaseLock(); }
}
function pull_(since) {
  /* أسرع رد: لو مفيش جديد من آخر مرة مبنقراش الشيت خالص */
  const q = seq_();
  if (q && since >= q) return {ok: true, rows: [], next: since, more: false, v: VER};
  const s = sh_(), last = s.getLastRow();
  if (last < 2) return {ok: true, rows: [], next: since, more: false, v: VER};
  /* عمود رقم المزامنة بس، وبعدين السطور الجديدة بس (حتت ورا بعض، أو من أول جديد لآخر جديد لو متفرقة قوي) */
  const v = [];
  s.getRange(2, 4, last - 1, 1).getValues().forEach((r, i) => { const n = Number(r[0]); if (n > since) v.push([n, i]); });
  v.sort((a, b) => a[0] - b[0]);
  const page = v.slice(0, PAGE), at = page.map(x => x[1]).sort((a, b) => a - b), got = {};
  const runs = [];
  at.forEach(i => { const r = runs[runs.length - 1]; if (r && i - r[1] <= 30) r[1] = i; else runs.push([i, i]); });
  const read = (a, b) => s.getRange(a + 2, 1, b - a + 1, W).getValues().forEach((r, k) => got[a + k] = r);
  if (runs.length > 40) read(at[0], at[at.length - 1]); else runs.forEach(r => read(r[0], r[1]));
  const rows = page.map(x => { const r = got[x[1]]; try { return {id: String(r[0]), kind: String(r[1]), upd: Number(r[2]), del: r[4] === 'نعم', data: JSON.parse(r[W - 1])}; } catch (e) { return null; } }).filter(Boolean);
  return {ok: true, rows: rows, next: page.length ? page[page.length - 1][0] : since, more: v.length > page.length, v: VER};
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }