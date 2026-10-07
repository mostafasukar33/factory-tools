const CACHE = 'flashon-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './fonts/fonts.css', './lib/html2canvas.min.js', './lib/jspdf.umd.min.js', './icons/logo.jpg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'].concat(
  [400, 600, 700, 800].flatMap(w => ['arabic', 'latin'].map(n => `./fonts/cairo-${n}-${w}-normal.woff2`)));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// الشبكة أولاً (علشان التحديثات توصل) وبعدين النسخة المخزنة لو مفيش نت
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
