/* سيرفر حسابات المصنع على كلاود فلير (Worker اسمه factory-sync). الشرح كله في core.js.
   الـ Worker بيعدّي الطلب زي ما هو لقاعدة واحدة (Durable Object اسمه factory) من غير ما يقراه، علشان وقته يفضل قليل.
   OFF = '1' في إعدادات كلاود فلير = السيرفر بيرد "off" والأجهزة بترجع للشيت لوحدها (زرار طوارئ من غير تحديث البرنامج). */
import {DurableObject} from 'cloudflare:workers';
import {makeCore} from './core.js';

const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'};
const J = (o, st = 200) => new Response(JSON.stringify(o), {status: st, headers: Object.assign({'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'}, CORS)});
const MAX = 4 * 1024 * 1024;

export class Factory extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const s = ctx.storage.sql;
    this.core = makeCore({q: (x, ...a) => s.exec(x, ...a).toArray(), tx: f => ctx.storage.transactionSync(f)});
  }
  handle(text, off) { return this.core.handle(text, off); }
  info() { return this.core.info(); }
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});
    const F = env.F.get(env.F.idFromName('factory'));
    try {
      if (req.method === 'GET') return J(await F.info());
      if (req.method !== 'POST') return J({ok: false, error: 'method'}, 405);
      if (Number(req.headers.get('content-length') || 0) > MAX) return J({ok: false, error: 'big'}, 413);
      const t = await req.text();
      if (t.length > MAX) return J({ok: false, error: 'big'}, 413);
      return J(await F.handle(t, env.OFF === '1'));
    } catch (e) { return J({ok: false, error: 'srv'}, 500); }
  }
};
