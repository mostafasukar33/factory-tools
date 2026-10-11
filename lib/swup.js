/* النسخة الجديدة بتوصل لوحدها (الحسابات والسوق، مع sw.js).
   أول ما الصفحة تفتح بتحفظ "بصمة" النسخة اللي فتحت بيها (ملفها وملفات الشكل والسكربت، من كاش sw.js).
   لو sw.js قال 'sw-stale' (فتحت بالمحفوظ لأن النت اتأخر والجديد وصل مختلف) = في نسخة جديدة أكيد.
   ولما sw.js يقول 'sw-new'، أو الصفحة ترجع قدامك، أو كل 10 دقايق وهي مفتوحة: بنجيب آخر نسخة ونقارن البصمة.
   لو اتغيرت بنستنى وقت آمن تقوله الصفحة نفسها (window.swSafe) ونعمل reload مرة واحدة.
   مبيلمسش أي بيانات محفوظة (localStorage / IndexedDB). */
(() => {
  const SW = navigator.serviceWorker;
  if (!SW || !window.caches || !window.crypto || !crypto.subtle) return;
  const clean = u => { const x = new URL(u, location.href); x.search = ''; x.hash = ''; return x; };
  const urls = [...new Set([location.href, ...[...document.querySelectorAll('link[rel=stylesheet][href],script[src]')].map(x => x.href || x.src)]
    .map(clean).filter(x => x.origin === location.origin).map(x => x.href))];
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const print = () => Promise.all(urls.map(u => caches.match(u, {ignoreSearch: true})
    .then(r => r ? r.arrayBuffer().then(b => crypto.subtle.digest('SHA-256', b)).then(hex) : '-'))).then(a => a.join('|'));
  let mine = null, want = false, idleAt = Date.now(), askedAt = Date.now();
  /* أول مرة خالص (الصفحة اتفتحت قبل sw.js): البصمة بعد ما يخلص تخزين الملفات */
  const ready = (SW.controller ? Promise.resolve() : SW.ready).then(print).then(v => { mine = v; }).catch(() => {});
  const apply = () => {
    if (!want) return;
    let ok = false; try { ok = !!(window.swSafe && window.swSafe(Date.now() - idleAt)); } catch (e) {}
    if (!ok) return;
    try { const t = +sessionStorage.getItem('sw_up') || 0; if (Math.abs(Date.now() - t) < 30000) return; sessionStorage.setItem('sw_up', String(Date.now())); } catch (e) {}
    want = false; location.reload();
  };
  const compare = () => ready.then(print).then(v => { if (mine && v !== mine) { want = true; apply(); } }).catch(() => {});
  const ask = gap => { if (!SW.controller || Date.now() - askedAt < gap) return; askedAt = Date.now(); SW.controller.postMessage({t: 'sw-check', urls}); };
  SW.addEventListener('message', e => { if (e.data === 'sw-stale') { want = true; apply(); } else if (e.data === 'sw-new') compare(); });
  SW.addEventListener('controllerchange', compare);
  ['pointerdown', 'keydown', 'input', 'scroll'].forEach(t => addEventListener(t, () => { idleAt = Date.now(); }, {passive: true, capture: true}));
  document.addEventListener('visibilitychange', () => { if (document.hidden) apply(); else ask(60000); });
  setInterval(() => { apply(); if (!document.hidden) ask(600000); }, 3000);
  window.swCheck = () => ask(0);   // للاختبار
})();
