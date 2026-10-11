// يخلي الحاسبة تشتغل من غير نت خالص. لما تعدّل أي ملف غيّر رقم النسخة دي.
const CACHE = 'flash-calc-v10';
const FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(new Request(f, {cache: 'reload'}))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// النت الأول (علشان دايماً آخر نسخة) لمدة 3 ثواني بس، وبعدها أو لو مفيش نت يفتح من المحفوظ
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const fallback = () => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match('./index.html'));
  e.respondWith(new Promise(resolve => {
    let done = false;
    const t = setTimeout(() => { if (!done) fallback().then(r => { if (!done && r) { done = true; resolve(r); } }); }, 3000);
    fetch(e.request, {cache: 'no-store'}).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      if (!done) { done = true; clearTimeout(t); resolve(res); }
    }).catch(() => { clearTimeout(t); if (!done) fallback().then(r => { done = true; resolve(r || Response.error()); }); });
  }));
});
