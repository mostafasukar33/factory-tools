/* قاعدة في الذاكرة (node:sqlite) بنفس شكل قاعدة كلاود فلير، علشان الاختبارات تشغّل كود السيرفر الحقيقي (core.js) من غير نت */
'use strict';
const {DatabaseSync} = require('node:sqlite');
function memStore() {
  const d = new DatabaseSync(':memory:');
  const q = (s, ...a) => { const st = d.prepare(s); return /^\s*select/i.test(s) ? st.all(...a) : (st.run(...a), []); };
  const tx = f => { d.exec('BEGIN'); try { const r = f(); d.exec('COMMIT'); return r; } catch (e) { d.exec('ROLLBACK'); throw e; } };
  return {q, tx, d};
}
/* السيرفر كله في الذاكرة: handle(نص الطلب) بيرد زي الـ Worker بالظبط */
async function memServer() {
  const {makeCore} = await import('../src/core.js');
  const st = memStore(), core = makeCore(st);
  return {core, st, off: false, handle(text) { return core.handle(text, this.off); }};
}
module.exports = {memStore, memServer};
