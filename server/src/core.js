/* سيرفر حسابات المصنع (بطلبه 22/11/2026): المزامنة بين أجهزة مصطفى بتروح هنا بدل شيت جوجل، والشيت بقى نسخة بتتحدث كل ساعة في الخلفية.
   منفصل تماماً عن برنامج الشركات (ريبو hesabat-app): ريبو تاني، Worker تاني (factory-sync)، وقاعدة تانية.
   الأمان:
   - السيرفر مبيعرفش يقرا ولا رقم: data بتوصل متشفرة من الجهاز (AES-GCM بمفتاح طالع من مفتاح الشيت، srvKeys في accounts.html).
   - المفتاح نفسه مبيوصلش هنا. بيوصل "تذكرة" (k) طالعة من نفس المفتاح، والسيرفر شايل بصمتها (SHA-256) بس.
     أول تذكرة بتسلّم على السيرفر (hello) هي صاحبته، وبعد كده أي تذكرة تانية بتترفض (key).
   - مبيمسحش أي حاجة أبداً: كل نسخة من كل سجل بتتحفظ في ver، والسجل الملغي بيفضل بعلامة del زي الشيت.
   - الأحدث (upd أكبر) هو اللي بيكسب، زي الشيت بالظبط. نفس النسخة تاني = بتتأكد (ack) ومبتتكتبش.
   - ep = رقم القاعدة. لو القاعدة اتعملت من جديد لأي سبب الأجهزة بتعرف (error: ep) وبتبعت كل حاجة تاني.
   الدوال هنا من غير أي حاجة خاصة بكلاود فلير، علشان الاختبارات تشغّلها بـ node:sqlite (server/test/core.js وtests/run.js). */
'use strict';
const VER = 1, PAGE = 1500, OUT_MAX = 3 * 1024 * 1024, ROW_MAX = 1536 * 1024, ROWS_MAX = 300;

/* onWrite(seq, d) بيتنده بعد أي كتابة (بعد ما الـ transaction تخلص): السيرفر بيقول للأجهزة المفتوحة "فيه جديد" (الخط المفتوح، index.js)، ما عدا الجهاز d اللي كتب */
function makeCore({q, tx, onWrite}) {
  q(`CREATE TABLE IF NOT EXISTS rec (id TEXT PRIMARY KEY, kind TEXT, upd INTEGER, del INTEGER, data TEXT, seq INTEGER)`);
  q(`CREATE INDEX IF NOT EXISTS rec_seq ON rec (seq)`);
  q(`CREATE TABLE IF NOT EXISTS ver (seq INTEGER PRIMARY KEY, id TEXT, kind TEXT, upd INTEGER, del INTEGER, data TEXT, at INTEGER)`);
  q(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
  const get = k => { const r = q('SELECT v FROM meta WHERE k = ?', k)[0]; return r ? r.v : null; };
  const put = (k, v) => q('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', k, String(v));
  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const rnd = () => hex(crypto.getRandomValues(new Uint8Array(8)));
  const fmt = r => ({id: r.id, kind: r.kind, upd: Number(r.upd), del: !!r.del, data: r.data});
  const okRow = r => r && typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 300 && typeof r.kind === 'string' && r.kind.length > 0 && r.kind.length <= 20
    && Number.isSafeInteger(r.upd) && r.upd > 0 && typeof r.data === 'string' && r.data.length <= ROW_MAX;

  function sync(b) {
    const ep = get('ep');
    if (b.ep !== ep) return {ok: false, error: 'ep', ep};
    const since = Math.max(0, Math.floor(Number(b.since) || 0)), rows = Array.isArray(b.rows) ? b.rows : [];
    if (rows.length > ROWS_MAX) return {ok: false, error: 'big'};
    const bad = rows.find(r => !okRow(r)); if (bad) return {ok: false, error: 'row', id: bad && typeof bad.id === 'string' ? bad.id.slice(0, 60) : ''};
    const res = tx(() => {
      /* السحب الأول (زي الشيت): الجديد من بعد since. لو كتير (more) بنسحب بس ومبنكتبش، والجهاز بيكمّل */
      const got = q('SELECT id, kind, upd, del, data, seq FROM rec WHERE seq > ? ORDER BY seq LIMIT ?', since, PAGE + 1), out = [];
      let more = got.length > PAGE, size = 0;
      for (const r of got.slice(0, PAGE)) { size += r.data.length + 120; if (out.length && size > OUT_MAX) { more = true; break; } out.push(r); }
      let seq = Number(get('seq')) || 0, n = Number(get('n')) || 0; const seq0 = seq;
      if (more) return {ok: true, rows: out.map(fmt), next: Number(out[out.length - 1].seq), more: true, ack: [], n, ep};
      const ack = [], now = Date.now();
      for (const r of rows) {
        ack.push(r.id);
        const o = q('SELECT upd FROM rec WHERE id = ?', r.id)[0];
        if (o && Number(o.upd) >= r.upd) continue;   // اللي عندنا أحدث أو نفس النسخة
        seq++; if (!o) n++;
        q('INSERT OR REPLACE INTO rec (id, kind, upd, del, data, seq) VALUES (?, ?, ?, ?, ?, ?)', r.id, r.kind, r.upd, r.del ? 1 : 0, r.data, seq);
        q('INSERT INTO ver (seq, id, kind, upd, del, data, at) VALUES (?, ?, ?, ?, ?, ?, ?)', seq, r.id, r.kind, r.upd, r.del ? 1 : 0, r.data, now);
      }
      if (ack.length) { put('seq', seq); put('n', n); put('last', now); }
      /* next = آخر رقم دلوقتي: كل اللي قبله يا اتسحب في الرد ده يا الجهاز ده هو اللي كتبه (الطلب كله في transaction واحدة) */
      return {ok: true, rows: out.map(fmt), next: seq, more: false, ack, n, ep, wrote: seq !== seq0};
    });
    if (res.wrote && onWrite) try { onWrite(res.next, typeof b.d === 'string' ? b.d.slice(0, 40) : ''); } catch (e) {}
    delete res.wrote;
    return res;
  }

  return {
    VER,
    /* GET من غير تذكرة: السيرفر شغال؟ ومتسلّم ولا لأ (مبيقولش أي رقم) */
    info() { return {ok: true, app: 'fo-srv', v: VER, owned: !!get('own')}; },
    seq() { return Number(get('seq')) || 0; },
    /* الخط المفتوح: نفس التذكرة اللي بتستلم السيرفر بس (مبيستلمش لو لسه محدش استلمه) */
    async auth(k) { if (typeof k !== 'string' || k.length < 20 || k.length > 200) return false; const own = get('own'); return !!own && own === await sha('fo-srv|' + k); },
    async handle(text, off) {
      if (off) return {ok: false, error: 'off'};
      let b = null; try { b = JSON.parse(text); } catch (e) {}
      if (!b || typeof b !== 'object' || typeof b.k !== 'string' || b.k.length < 20 || b.k.length > 200) return {ok: false, error: 'key'};
      const h = await sha('fo-srv|' + b.k);
      if (b.a === 'hello') return tx(() => {
        let own = get('own'), claimed = false;
        if (!own) { own = h; put('own', h); put('ep', rnd()); put('at', Date.now()); claimed = true; }
        if (own !== h) return {ok: false, error: 'key'};
        return {ok: true, app: 'fo-srv', v: VER, ep: get('ep'), n: Number(get('n')) || 0, seq: Number(get('seq')) || 0, claimed};
      });
      if (get('own') !== h) return {ok: false, error: 'key'};
      if (b.a === 'sync') return sync(b);
      return {ok: false, error: 'action'};
    }
  };
}
export {makeCore, VER, PAGE, ROW_MAX, ROWS_MAX};
