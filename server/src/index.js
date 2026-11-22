/* سيرفر حسابات المصنع على كلاود فلير (Worker اسمه factory-sync). الشرح كله في core.js.
   الـ Worker بيعدّي الطلب زي ما هو لقاعدة (Durable Object) من غير ما يقراه، علشان وقته يفضل قليل.
   قاعدتين منفصلين تماماً، كل واحدة بتذكرتها: factory (الحسابات) و market (حركة السوق، ?s=mkt، بطلبه 22/11/2026).
   الخط المفتوح (/live، WebSocket): الجهاز بيبعت تذكرته أول رسالة، وبعدها السيرفر بيقوله {seq} أول ما جهاز تاني يكتب حاجة،
   فالحركة بتظهر عند التاني في لحظتها. النبضة 'p' بيرد عليها كلاود فلير لوحده 'o' من غير ما يصحّي القاعدة.
   OFF = '1' في إعدادات كلاود فلير = السيرفر بيرد "off" والأجهزة بترجع للشيت لوحدها (زرار طوارئ من غير تحديث البرنامج). */
import {DurableObject} from 'cloudflare:workers';
import {makeCore} from './core.js';

const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'};
const J = (o, st = 200) => new Response(JSON.stringify(o), {status: st, headers: Object.assign({'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'}, CORS)});
const MAX = 4 * 1024 * 1024, LIVE_MAX = 20;

export class Factory extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const s = ctx.storage.sql;
    this.core = makeCore({q: (x, ...a) => s.exec(x, ...a).toArray(), tx: f => ctx.storage.transactionSync(f), onWrite: (seq, d) => this.tell(seq, d)});
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('p', 'o')); } catch (e) {}
  }
  handle(text, off) { return this.core.handle(text, off); }
  info() { return this.core.info(); }
  /* "فيه جديد" لكل الأجهزة اللي دخلت بالتذكرة، ما عدا اللي كتب */
  tell(seq, d) {
    for (const ws of this.ctx.getWebSockets()) {
      try { const a = ws.deserializeAttachment(); if (a && a.ok && a.d !== d) ws.send(JSON.stringify({seq})); } catch (e) {}
    }
  }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket', {status: 426});
    if (this.ctx.getWebSockets().length >= LIVE_MAX) return new Response('busy', {status: 429});
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, {status: 101, webSocket: pair[0]});
  }
  async webSocketMessage(ws, m) {
    let a = null; try { a = ws.deserializeAttachment(); } catch (e) {}
    if (a && a.ok) return;   // بعد الدخول مفيش رسايل غير النبضة (ردها لوحده)
    let b = null; try { b = JSON.parse(m); } catch (e) {}
    if (!b || !(await this.core.auth(b.k))) { try { ws.close(4003, 'key'); } catch (e) {} return; }
    ws.serializeAttachment({ok: 1, d: typeof b.d === 'string' ? b.d.slice(0, 40) : ''});
    ws.send(JSON.stringify({ok: 1, seq: this.core.seq()}));
  }
  webSocketClose(ws, code) { try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch (e) {} }
  webSocketError(ws) { try { ws.close(1011, 'err'); } catch (e) {} }
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});
    const u = new URL(req.url), F = env.F.get(env.F.idFromName(u.searchParams.get('s') === 'mkt' ? 'market' : 'factory'));
    try {
      if (u.pathname === '/live') {
        if (env.OFF === '1') return new Response('off', {status: 503});
        return F.fetch(req);
      }
      if (req.method === 'GET') return J(await F.info());
      if (req.method !== 'POST') return J({ok: false, error: 'method'}, 405);
      if (Number(req.headers.get('content-length') || 0) > MAX) return J({ok: false, error: 'big'}, 413);
      const t = await req.text();
      if (t.length > MAX) return J({ok: false, error: 'big'}, 413);
      return J(await F.handle(t, env.OFF === '1'));
    } catch (e) { return J({ok: false, error: 'srv'}, 500); }
  }
};
