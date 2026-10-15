// Service worker مشترك لكل الأدوات. مبيلمسش البيانات المحفوظة خالص (localStorage وIndexedDB)، الكاش هنا للملفات بس.
//
// الحسابات والسوق (والملفات اللي محتاجينها): بنستنى النت WAIT بس. لو الملف وصل كامل قبلها بيتفتح الجديد،
// ولو اتأخر بتتفتح النسخة المحفوظة على طول ونكمّل نجيب الجديد في الخلفية. لما يوصل ويطلع مختلف بنقول للصفحة
// 'sw-stale'، و lib/swup.js بيعمل reload لوحده في وقت آمن (مش والحد بيكتب).
// الخطوط والأيقونات والـ manifest: المحفوظة على طول، وبنجددها في الخلفية.
// باقي الأدوات زي الأول: الشبكة أولاً، والمحفوظ لما مفيش نت بس.
// كل ملفات الحسابات والسوق بتتخزن من أول فتحة (SHELL).
const CACHE = 'flashon-tools-v3';   // نفس الاسم القديم علشان النسخ المحفوظة من الأدوات التانية متتمسحش
const WAIT = 3000;
const FONTS = [400, 600, 700, 800].flatMap(w => ['arabic', 'latin'].map(l => `fonts/cairo-${l}-${w}-normal.woff2`));
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'accounts.html', 'accounts.webmanifest', 'market.html', 'market.webmanifest',
  'lib/ui.css', 'lib/datepick.js', 'lib/swup.js', 'lib/icons.js', 'fonts/fonts.css', ...FONTS,
  'icons/logo.jpg', 'icons/logo-pdf.jpg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const FAST = /^(accounts\.html|market\.html|lib\/(ui\.css|datepick\.js|swup\.js|icons\.js)|fonts\/fonts\.css)$/;
const STATIC = /^(fonts\/[^/]+\.woff2|icons\/[^/]+|[^/]+\.webmanifest)$/;

const SCOPE = new URL(self.registration.scope);
const rel = u => { const x = new URL(u); return x.origin === SCOPE.origin && x.pathname.startsWith(SCOPE.pathname) ? x.pathname.slice(SCOPE.pathname.length) : null; };
const key = u => { const x = new URL(u); x.search = ''; x.hash = ''; return x.href; };
const same = (a, b) => { if (a.byteLength !== b.byteLength) return false; const x = new Uint8Array(a), y = new Uint8Array(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false; return true; };
// الصفحة اللي اتفتحت بالنسخة المحفوظة والجديد طلع مختلف: بنقولها هي بالذات
const tell = id => self.clients.get(id).then(c => c && c.postMessage('sw-stale'));

// بيجيب الملف كامل من النت (مش أوله بس) ويحفظه. بنبعت علامة النسخة المحفوظة (ETag)، فلو الملف متغيرش
// السيرفر بيرد بـ 304 صغير ونستخدم المحفوظ بدل ما ننزّل الملف كله تاني.
// كلاود فلير بيحوّل x.html لـ /x (لفة زيادة كل فتحة)، فبنفتكر العنوان اللي حوّل عليه (ALIAS) ونطلبه على طول
const ALIAS = new URL('__alias', SCOPE).href;
let alias = null;
const aliases = () => alias || (alias = caches.match(ALIAS).then(r => r ? r.json() : {}).catch(() => ({})));
const setAlias = (u, to) => aliases().then(m => { if (m[u] === to) return; if (to) m[u] = to; else delete m[u];
  return caches.open(CACHE).then(c => c.put(ALIAS, new Response(JSON.stringify(m), {headers: {'Content-Type': 'application/json'}}))); }).catch(() => {});
function grab(u) {
  const k = key(u);
  return Promise.all([aliases(), caches.match(k)]).then(([m, old]) => {
    const tag = old && old.headers.get('X-Etag'), to = m[k];
    const get = url => fetch(url, tag ? {cache: 'no-store', credentials: 'same-origin', headers: {'If-None-Match': tag}} : {cache: 'no-cache', credentials: 'same-origin'});
    // لو العنوان المحفوظ مبقاش شغال نرجع للأصلي وننساه
    return (to ? get(to).then(r => r.ok || r.status === 304 ? r : (setAlias(k, null), get(u)), () => get(u)) : get(u)).then(r => {
      if (r.redirected && r.url && rel(r.url) !== null) setAlias(k, key(r.url));
      if (r.status === 304 && old) return old.arrayBuffer().then(b => ({b, res: () => new Response(b, {status: 200, headers: old.headers})}));
      if (!r.ok) throw new Error(r.status);
      const h = {}, type = r.headers.get('content-type'), et = r.headers.get('etag');
      if (type) h['Content-Type'] = type;
      if (et) h['X-Etag'] = et;
      return r.arrayBuffer().then(b => {
        const res = () => new Response(b, {status: 200, headers: h});
        return caches.open(CACHE).then(c => c.put(k, res())).then(() => ({b, res}));
      });
    });
  });
}
const saved = u => caches.match(key(u), {ignoreSearch: true});
// كلاود فلير (app.flashoneg.com) بيحوّل x.html لـ /x. الرد اللي جه بعد تحويل مينفعش يترجع للصفحة زي ما هو
// (سفاري وكروم بيرفضوا يفتحوها)، فبنرجّع نسخة منه من غير علامة التحويل
const plain = r => r.redirected ? new Response(r.body, {status: r.status, statusText: r.statusText, headers: r.headers}) : r;
const offline = req => req.mode === 'navigate' ? caches.match('index.html') : Response.error();

self.addEventListener('install', e => {
  e.waitUntil(Promise.all(SHELL.map(p => grab(new URL(p, SCOPE).href).catch(() => {}))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // مسح أي كاش من النسخ القديمة، والنسخ اللي متخزنة بـ ?... (بقت بتتخزن من غيرها)، وتولّي الصفحات المفتوحة فوراً
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => caches.open(CACHE)).then(c => c.keys().then(rs => Promise.all(rs.filter(r => new URL(r.url).search).map(r => c.delete(r)))))
    .catch(() => {}).then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') return self.skipWaiting();
  // lib/swup.js بيسأل (لما الصفحة ترجع قدامك أو كل شوية): هات آخر نسخة من ملفاتي وقولي لما تخلص
  if (e.data && e.data.t === 'sw-check') e.waitUntil(Promise.all((e.data.urls || []).filter(u => rel(u) !== null).map(u => grab(u).catch(() => {})))
    .then(() => e.source && e.source.postMessage('sw-new')));
});

// الحسابات والسوق: النت لحد WAIT، وبعدها المحفوظ على طول والجديد بيكمّل في الخلفية
function fast(e) {
  const u = e.request.url, id = e.resultingClientId || e.clientId, old = saved(u), net = grab(u);
  let sent = false, stale = null;
  const res = new Promise(done => {
    const send = r => { if (!sent) { sent = true; done(r); } };
    net.then(x => send(x.res()), () => old.then(r => sent || send(r || offline(e.request))));
    setTimeout(() => old.then(r => { if (r && !sent) { stale = r.clone(); send(r); } }), WAIT);
  });
  e.waitUntil(Promise.all([net, res]).then(([x]) => stale && stale.arrayBuffer().then(b => { if (!same(b, x.b) && id) return tell(id); })).catch(() => {}));
  return res;
}
// الخطوط والأيقونات: المحفوظ على طول، والتجديد في الخلفية
function quick(e) {
  const net = grab(e.request.url);
  e.waitUntil(net.catch(() => {}));
  return saved(e.request.url).then(r => r || net.then(x => x.res()));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const p = rel(req.url);
  if (p !== null && FAST.test(p)) return e.respondWith(fast(e));
  if (p !== null && STATIC.test(p)) return e.respondWith(quick(e));
  e.respondWith(
    fetch(req.url, {cache: 'no-store', credentials: 'same-origin'}).then(r => {
      if (r.ok) { const copy = plain(r.clone()); caches.open(CACHE).then(c => c.put(key(req.url), copy)); }
      return plain(r);
    }).catch(() => saved(req.url).then(r => r || caches.match('index.html')).then(r => r && plain(r)))
  );
});
