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
  const ss = {getId: () => 'ss1', getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n))};
  const props = {}, triggers = [], folders = [];
  const ctx = {
    SpreadsheetApp: {getActiveSpreadsheet: () => ss},
    LockService: {getScriptLock: () => ({waitLock() {}, tryLock() { return true; }, releaseLock() {}})},
    PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }})},
    ScriptApp: {getProjectTriggers: () => triggers.map(h => ({getHandlerFunction: () => h})), newTrigger: h => { const b = {timeBased: () => b, everyDays: () => b, atHour: () => b, create: () => { triggers.push(h); }}; return b; }},
    DriveApp: {
      getFoldersByName: n => { const f = folders.filter(x => x.name === n); return {hasNext: () => f.length > 0, next: () => f.shift()}; },
      createFolder: n => { const f = {name: n, files: [], getFiles() { const l = f.files.filter(x => !x.trashed); return {hasNext: () => l.length > 0, next: () => l.shift()}; }}; folders.push(f); return f; },
      getFileById: () => ({makeCopy: (name, folder) => { const t = Date.now() + folder.files.length; folder.files.push({name, trashed: false, getDateCreated: () => new Date(t), setTrashed(v) { this.trashed = v; }}); }})
    },
    Session: {getScriptTimeZone: () => 'Africa/Cairo'},
    ContentService: {MimeType: {JSON: 'json'}, createTextOutput: t => ({t, setMimeType() { return this; }})},
    Utilities: {sleep() {}, formatDate: d => d.toISOString().slice(0, 10)},
    MailApp: {sendEmail() {}},
    console, JSON, Date, Math
  };
  vm.createContext(ctx);
  return {
    sheets, ctx, triggers, folders,
    load(src) { vm.runInContext(src, ctx); },
    post(body) { return ctx.doPost({postData: {contents: body}}).t; },
    get() { return ctx.doGet({parameter: {}}).t; }
  };
}
module.exports = {makeGas};
