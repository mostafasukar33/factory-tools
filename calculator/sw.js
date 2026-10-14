// الحاسبة بتفتح فوراً من المحفوظ (من غير ما تستنى النت)، والنسخة الجديدة بتتحمل في الخلفية وتظهر في الفتحة اللي بعدها.
// لما تعدّل أي ملف غيّر رقم النسخة دي.
const CACHE = 'flash-calc-v17';
const FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(new Request(f, {cache: 'reload'}))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, {ignoreSearch: true}).then(hit => {
    const net = fetch(e.request, {cache: 'no-store'}).then(res => {
      if (res && res.ok) c.put(e.request, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return net.then(res => res || c.match('./index.html') || Response.error());
  })));
});
