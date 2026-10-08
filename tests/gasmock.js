// محاكاة بسيطة لـ Google Apps Script علشان نختبر كود الشيت
const vm = require('vm');
function makeGas() {
  const sheets = {};
  const mkSheet = name => {
    const rows = [];
    const sh = {
      name, rows,
      getLastRow: () => rows.length,
      appendRow: r => { rows.push(r.slice()); },
      setFrozenRows: () => {},
      getRange: (r, c, nr, nc) => ({
        getValues: () => { const o = []; for (let i = 0; i < (nr || 1); i++) { const row = rows[r - 1 + i] || []; const x = []; for (let j = 0; j < (nc || 1); j++) x.push(row[c - 1 + j] ?? ''); o.push(x); } return o; },
        setValues: v => { v.forEach((row, i) => { const t = rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((val, j) => t[c - 1 + j] = val); }); },
        setValue: val => { const t = rows[r - 1] = rows[r - 1] || []; t[c - 1] = val; }
      }),
      getDataRange: () => sh.getRange(1, 1, rows.length, Math.max(0, ...rows.map(x => x.length)))
    };
    return sh;
  };
  const ss = {getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n))};
  const props = {};
  const ctx = {
    SpreadsheetApp: {getActiveSpreadsheet: () => ss},
    LockService: {getScriptLock: () => ({waitLock() {}, tryLock() { return true; }, releaseLock() {}})},
    PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }})},
    ContentService: {MimeType: {JSON: 'json'}, createTextOutput: t => ({t, setMimeType() { return this; }})},
    Utilities: {sleep() {}},
    MailApp: {sendEmail() {}},
    console, JSON, Date, Math
  };
  vm.createContext(ctx);
  return {
    sheets, ctx,
    load(src) { vm.runInContext(src, ctx); },
    post(body) { return ctx.doPost({postData: {contents: body}}).t; },
    get() { return ctx.doGet({parameter: {}}).t; }
  };
}
module.exports = {makeGas};
