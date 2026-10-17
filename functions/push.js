// وسيط إشعارات الأيفون (Web Push) — بيشتغل على كلاود فلير Pages: app.flashoneg.com/push
//
// شيت "حركة السوق" بيبعتله: {subs: [{s: اشتراك الجهاز, k: مفتاح الجهاز الخاص (JWK)}], m: {t: عنوان, b: كلام, n: رقم الأيقونة, u: صفحة}}
// وهو بيشفّر الرسالة (RFC 8291) ويوقّعها (VAPID، RFC 8292) ويبعتها لشركة الإشعارات (أبل/جوجل/موزيلا).
// مبيحفظش أي حاجة ومفيهوش أي مفتاح: المفتاح جاي من شيت السوق مع كل طلب، والأجهزة هي اللي عاملاه.
// بيرد {ok, st: [كود الرد لكل جهاز]}: 201 = وصل، 404/410 = الاشتراك اتلغى (الشيت بيشيله).

const PUSH_HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;
const SUB = 'https://app.flashoneg.com';
const enc = new TextEncoder();

const b64u = buf => {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = s => {
  const t = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
  const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b;
};
const cat = (...a) => { const n = a.reduce((x, y) => x + y.length, 0), o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/* VAPID: توقيع JWT بمفتاح الجهاز (ES256)، والمفتاح العام بيتبعت في k */
async function vapid(endpoint, jwk) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({typ: 'JWT', alg: 'ES256'})));
  const body = b64u(enc.encode(JSON.stringify({aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUB})));
  const key = await crypto.subtle.importKey('jwk', {kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true}, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, key, enc.encode(head + '.' + body));
  const pub = cat(new Uint8Array([4]), unb64u(jwk.x), unb64u(jwk.y));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${b64u(pub)}`;
}

/* تشفير الرسالة (aes128gcm، RFC 8291) */
async function encrypt(sub, text, fix) {   // fix = مفتاح وملح ثابتين للاختبار بس (مثال RFC 8291)
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  if (ua.length !== 65 || auth.length !== 16) throw new Error('keys');
  const as = fix ? fix.as : await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, {name: 'ECDH', namedCurve: 'P-256'}, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({name: 'ECDH', public: uaKey}, as.privateKey, 256));
  const ikm = (await hmac(await hmac(auth, shared), cat(enc.encode('WebPush: info\0'), ua, asPub, new Uint8Array([1])))).slice(0, 32);
  const salt = fix ? fix.salt : crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv: nonce}, key, cat(enc.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return cat(head, asPub, ct);
}

async function sendOne(x, text) {
  try {
    const s = x && x.s, k = x && x.k;
    if (!s || !s.endpoint || !s.keys || !k || !k.d) return 400;
    const u = new URL(s.endpoint);
    if (u.protocol !== 'https:' || !PUSH_HOSTS.test(u.hostname)) return 400;   // لشركات الإشعارات بس، مش لأي موقع
    const r = await fetch(s.endpoint, {method: 'POST', body: await encrypt(s, text), headers: {
      Authorization: await vapid(s.endpoint, k), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high'}});
    return r.status;
  } catch (e) { return 0; }
}

export async function onRequestPost({request}) {
  let j; try { j = await request.json(); } catch (e) { return Response.json({ok: false, error: 'bad'}, {status: 400}); }
  const subs = Array.isArray(j && j.subs) ? j.subs.slice(0, 10) : [];
  const text = JSON.stringify(j && j.m || {});
  if (!subs.length || text.length > 3000) return Response.json({ok: false, error: 'bad'}, {status: 400});
  const st = await Promise.all(subs.map(x => sendOne(x, text)));
  return Response.json({ok: true, st});
}
export const onRequestGet = () => Response.json({ok: true, app: 'fo-push'});

// للاختبارات بس
export const _t = {encrypt, vapid, sendOne};
