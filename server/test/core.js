/* اختبار سيرفر المصنع (core.js) من غير نت ولا كلاود فلير: node server/test/core.js (أو من جوه server: node test/core.js)
   لازم "0 فشل" قبل أي رفع للسيرفر */
'use strict';
const {memServer} = require('./mem');
let fails = 0, oks = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { oks++; console.log('  ✔', name); } else { fails++; console.log('  ✖', name, '\n     المتوقع:', JSON.stringify(want), '\n     اللي طلع:', JSON.stringify(got)); }
}
const TOK = 'tok-'.padEnd(43, 'A'), OTHER = 'tok-'.padEnd(43, 'B');
const row = (id, upd, data = 'x' + upd, del = false, kind = 'party') => ({id, kind, upd, del, data});

(async () => {
  const S = await memServer(), call = b => S.handle(JSON.stringify(b));
  console.log('سيرفر المصنع (core.js)');
  eq('أول ما يتعمل: شغال ومحدش استلمه', S.core.info(), {ok: true, app: 'fo-srv', v: 1, owned: false});
  eq('من غير تذكرة: مرفوض', (await call({a: 'sync', since: 0, rows: []})).error, 'key');
  eq('تذكرة قصيرة: مرفوض', (await call({a: 'hello', k: 'short'})).error, 'key');
  eq('مزامنة قبل ما حد يستلمه: مرفوض', (await call({a: 'sync', k: TOK, since: 0, rows: []})).error, 'key');
  const h = await call({a: 'hello', k: TOK});
  eq('أول تذكرة استلمت السيرفر', [h.ok, h.claimed, typeof h.ep, h.ep.length, h.n], [true, true, 'string', 16, 0]);
  eq('بعد الاستلام: info بيقول متسلّم ومن غير أي رقم', S.core.info(), {ok: true, app: 'fo-srv', v: 1, owned: true});
  eq('تذكرة تانية بعد الاستلام: مرفوضة', (await call({a: 'hello', k: OTHER})).error, 'key');
  eq('تذكرة تانية متقدرش تسحب', (await call({a: 'sync', k: OTHER, ep: h.ep, since: 0, rows: []})).error, 'key');
  const h2 = await call({a: 'hello', k: TOK});
  eq('نفس التذكرة تاني: مقبولة ومش استلام جديد ونفس رقم القاعدة', [h2.ok, h2.claimed, h2.ep], [true, false, h.ep]);
  eq('رقم قاعدة غلط: بيقول ep ويدّي الصح', await call({a: 'sync', k: TOK, ep: 'old', since: 0, rows: []}), {ok: false, error: 'ep', ep: h.ep});
  eq('أمر مش معروف', (await call({a: 'drop', k: TOK})).error, 'action');

  const A = b => call(Object.assign({a: 'sync', k: TOK, ep: h.ep}, b));
  const r1 = await A({since: 0, rows: [row('p1', 100), row('p2', 100), row('e1', 100, 'z', false, 'entry')]});
  eq('3 سجلات: اتأكدوا كلهم والعدد 3', [r1.ok, r1.ack, r1.n, r1.rows.length, r1.more], [true, ['p1', 'p2', 'e1'], 3, 0, false]);
  eq('الجهاز اللي بعتهم مبيرجعلوش نفس السجلات (next بعدهم)', r1.next, 3);
  const r2 = await A({since: 0, rows: []});
  eq('جهاز تاني من الأول: سحب ال 3 بنفس البيانات والنوع والوقت', r2.rows, [row('p1', 100), row('p2', 100), row('e1', 100, 'z', false, 'entry')]);
  const r3 = await A({since: r2.next, rows: [row('p1', 90, 'قديم'), row('p2', 100, 'نفس الوقت')]});
  eq('نسخة أقدم أو بنفس الوقت: بتتأكد ومبتكتبش فوق الأحدث', [r3.ack, r3.n, r3.next], [['p1', 'p2'], 3, 3]);
  eq('اللي على السيرفر لسه الأحدث', (await A({since: 0, rows: []})).rows.map(r => r.data), ['x100', 'x100', 'z']);
  const r4 = await A({since: 3, rows: [row('p1', 200, 'جديد', true)]});
  eq('نسخة أحدث (ملغية): اتكتبت والعدد زي ما هو', [r4.ack, r4.n, r4.next], [['p1'], 3, 4]);
  const r5 = await A({since: 3, rows: []});
  eq('جهاز تاني بيسحب التعديل بعلامة الإلغاء', r5.rows, [row('p1', 200, 'جديد', true)]);
  eq('مفيش حاجة بتتمسح: النسختين محفوظين في ver', S.st.q("SELECT upd, data FROM ver WHERE id = 'p1' ORDER BY seq"), [{upd: 100, data: 'x100'}, {upd: 200, data: 'جديد'}]);

  const many = n => Array.from({length: n}, (_, i) => row('m' + i, 300 + i));
  eq('أكتر من 300 سجل في طلب واحد: مرفوض', (await A({since: 4, rows: many(301)})).error, 'big');
  eq('سجل من غير id أو وقت: مرفوض', (await A({since: 4, rows: [{id: '', kind: 'party', upd: 1, data: 'x'}]})).error, 'row');
  eq('سجل data مش نص (مش متشفر): مرفوض', (await A({since: 4, rows: [{id: 'q', kind: 'party', upd: 1, data: {a: 1}}]})).error, 'row');
  eq('سجل أكبر من 1.5 ميجا: مرفوض', (await A({since: 4, rows: [row('huge', 5, 'x'.repeat(1536 * 1024 + 1))]})).error, 'row');
  let since = 4; for (let i = 0; i < 6; i++) since = (await A({since, rows: many(1600).slice(i * 300, i * 300 + 300)})).next;
  since = (await A({since, rows: many(1600).slice(1800)})).next;
  eq('1600 سجل اتكتبوا', [since, (await A({since, rows: []})).n], [1604, 1603]);
  const p1 = await A({since: 0, rows: [row('late', 999)]});
  eq('سحب كتير (أكتر من 1500): بيسحب 1500 بس، ومبيكتبش اللي اتبعت لحد ما السحب يخلص', [p1.rows.length, p1.more, p1.ack, p1.next > 1000 && p1.next < 1604], [1500, true, [], true]);
  const p2 = await A({since: p1.next, rows: [row('late', 999)]});
  eq('الدفعة اللي بعدها: كمّل السحب وكتب', [p2.rows.length, p2.more, p2.ack, p2.n], [1603 - 1500, false, ['late'], 1604]);

  /* الخط المفتوح: "فيه جديد" بعد الكتابة بس، ومبيرجعش للجهاز اللي كتب، والتذكرة لازم تبقى بتاعة السيرفر */
  S.writes.length = 0;
  await A({since: 0, rows: [], d: 'dev1'});
  const w1 = S.writes.length;
  await A({since: 99999, rows: [row('late', 999)], d: 'dev1'});
  const w2 = S.writes.length;
  await A({since: 99999, rows: [row('late', 1000)], d: 'dev2'});
  eq('الخط المفتوح: مفيش إشارة من غير كتابة ولا من نسخة قديمة، والإشارة فيها رقم الكتابة واسم الجهاز اللي كتب', [w1, w2, S.writes], [0, 0, [[1606, 'dev2']]]);
  eq('الخط المفتوح: التذكرة الصح بس', [await S.core.auth(TOK), await S.core.auth(OTHER), await S.core.auth('x'), S.core.seq()], [true, false, false, 1606]);
  S.off = true;
  eq('زرار الطوارئ (OFF): كل حاجة بترد off', (await A({since: 0, rows: []})).error, 'off');
  S.off = false;
  console.log(`\n${oks} نجح، ${fails} فشل`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
