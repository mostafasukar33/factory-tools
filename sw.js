// Service worker مشترك لكل الأدوات.
// القاعدة: الشبكة أولاً وبدون أي كاش للمتصفح (علشان دايماً يجيب آخر نسخة)،
// والنسخة المخزنة بتُستخدم بس لو مفيش نت. أي أداة جديدة بتتخزن لوحدها أول ما تتفتح.
const CACHE = 'flashon-tools-v3';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'index.html', 'manifest.webmanifest', 'icons/logo.jpg', 'icons/icon-192.png'])).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // مسح أي كاش قديم (من النسخ السابقة) وتولّي الصفحات المفتوحة فوراً
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req.url, {cache: 'no-store', credentials: 'same-origin'}).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('index.html')))
  );
});
