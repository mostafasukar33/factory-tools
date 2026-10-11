// نسخة 1 القديمة من كود شيت الحسابات (scriptFor) زي ما هي، علشان الاختبار يقارن بيها ويتأكد إن الأجهزة القديمة شغالة
// حسابات فلاش أون (مقفول بمفتاح سري بيتحفظ أول مرة)
const SHEET = 'السجلات';
const HEAD = ['id','النوع','آخر تعديل','رقم المزامنة','ملغي','التاريخ','الحساب','القسم','البيان','مدين','دائن','البيانات (لا تعدّلها)'];
const W = HEAD.length;
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
  if (req.action === 'ping') return out_({ok: true, app: 'fo-acc', v: 1, n: Math.max(sh_().getLastRow() - 1, 0)});
  if (req.action === 'push') return out_(push_(req.rows || []));
  if (req.action === 'pull') return out_(pull_(Number(req.since) || 0));
  return out_({ok: false, error: 'action'});
}
function push_(rows) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const s = sh_(), last = s.getLastRow();
    const cur = last > 1 ? s.getRange(2, 1, last - 1, 3).getValues() : [];
    const pos = {}; cur.forEach((r, i) => pos[String(r[0])] = i);
    const props = PropertiesService.getScriptProperties();
    let seq = Number(props.getProperty('SEQ')) || 0;
    const add = [], addAt = {}, ack = [];
    rows.forEach(r => {
      const i = pos[r.id];
      ack.push(r.id);
      if (i !== undefined && Number(cur[i][2]) >= Number(r.upd)) return;
      if (addAt[r.id] !== undefined && Number(add[addAt[r.id]][2]) >= Number(r.upd)) return;
      seq++;
      const v = (r.view || []).concat(['', '', '', '', '', '']).slice(0, 6);
      const line = [r.id, r.kind, r.upd, seq, r.del ? 'نعم' : ''].concat(v, [JSON.stringify(r.data)]);
      if (i !== undefined) { s.getRange(i + 2, 1, 1, W).setValues([line]); cur[i][2] = r.upd; }
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
  const s = sh_(), last = s.getLastRow();
  if (last < 2) return {ok: true, rows: [], next: since, more: false};
  const v = s.getRange(2, 1, last - 1, W).getValues().filter(r => Number(r[3]) > since);
  v.sort((a, b) => Number(a[3]) - Number(b[3]));
  const page = v.slice(0, 1500);
  const rows = page.map(r => { try { return {id: String(r[0]), kind: String(r[1]), upd: Number(r[2]), del: r[4] === 'نعم', data: JSON.parse(r[W - 1])}; } catch (e) { return null; } }).filter(Boolean);
  return {ok: true, rows: rows, next: page.length ? Number(page[page.length - 1][3]) : since, more: v.length > page.length};
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
