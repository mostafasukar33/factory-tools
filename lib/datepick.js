/* منتقي التاريخ: يوم / شهر / سنة (اليوم على اليمين)، وكل اختيار بيتسجل على طول من غير زرار تأكيد.
   بيحوّل أي input من نوع date أو month لثلاث (أو اتنين) قوايم، ويسيب الـ input الأصلي مخفي بنفس القيمة (YYYY-MM-DD أو YYYY-MM)
   فباقي الكود يفضل شغال زي ما هو (القيمة، وأحداث input و change). */
(function () {
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const css = document.createElement('style');
  css.textContent = '.dp{display:grid;gap:6px;direction:rtl;width:100%}.dp.d{grid-template-columns:1fr 1.5fr 1.2fr}.dp.m{grid-template-columns:1.5fr 1.2fr}' +
    '.dp select{min-height:54px;padding:6px 8px;border:1.5px solid #D6CDB5;border-radius:11px;background:#fff;font-weight:700;text-align:center;text-align-last:center;width:100%;min-width:0}' +
    '.dp select:focus{border-color:#DAAE57;outline:none;box-shadow:0 0 0 3px #DAAE5744}' +
    'input.dpx{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;min-height:0!important;padding:0!important;border:0!important;margin:0!important}';
  document.head.appendChild(css);
  const pad = n => String(n).padStart(2, '0');
  const opt = (v, t, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${t}</option>`;
  function upgrade(inp) {
    if (inp.dataset.dp) return;
    inp.dataset.dp = '1';
    const isDay = inp.type === 'date';
    let cur = desc.get.call(inp);
    const ph = document.createElement('div');
    ph.className = 'dp ' + (isDay ? 'd' : 'm');
    inp.after(ph);
    const y0 = new Date().getFullYear();
    const draw = () => {
      const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(cur || ''), Y = m ? +m[1] : 0, M = m ? +m[2] : 0, D = m && m[3] ? +m[3] : 0;
      const lo = Math.min(y0 - 6, Y || y0), hi = Math.max(y0 + 2, Y || y0);
      let h = '';
      if (isDay) h += `<select data-p="d" aria-label="اليوم">${opt('', 'يوم', !D)}${Array.from({length: 31}, (_, i) => opt(i + 1, i + 1, D === i + 1)).join('')}</select>`;
      h += `<select data-p="m" aria-label="الشهر">${opt('', 'شهر', !M)}${MONTHS.map((n, i) => opt(i + 1, n, M === i + 1)).join('')}</select>`;
      h += `<select data-p="y" aria-label="السنة">${opt('', 'سنة', !Y)}${Array.from({length: hi - lo + 1}, (_, i) => opt(hi - i, hi - i, Y === hi - i)).join('')}</select>`;
      ph.innerHTML = h;
      ph.querySelectorAll('select').forEach(s => s.onchange = commit);
    };
    const commit = () => {
      const g = p => { const s = ph.querySelector(`[data-p=${p}]`); return s ? +s.value : 1; };
      const y = g('y'), mo = g('m');
      let d = isDay ? g('d') : 1, v = '';
      if (y && mo && d) {
        d = Math.min(d, new Date(y, mo, 0).getDate());
        v = isDay ? `${y}-${pad(mo)}-${pad(d)}` : `${y}-${pad(mo)}`;
      }
      if (v === cur) { if (v) draw(); return; }
      cur = v; desc.set.call(inp, v); draw();
      inp.dispatchEvent(new Event('input', {bubbles: true})); inp.dispatchEvent(new Event('change', {bubbles: true}));
    };
    /* لو الكود غيّر القيمة (inp.value = ...) أو الاختبار كتبها، القوايم تلحقها */
    Object.defineProperty(inp, 'value', {configurable: true, get() { return cur; }, set(v) { cur = String(v || ''); desc.set.call(inp, cur); draw(); }});
    inp.addEventListener('input', () => { const v = desc.get.call(inp); if (v !== cur) { cur = v; draw(); } });
    inp.classList.add('dpx'); inp.tabIndex = -1;
    draw();
  }
  const scan = root => (root.querySelectorAll ? root.querySelectorAll('input[type=date],input[type=month]') : []).forEach(upgrade);
  scan(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches('input[type=date],input[type=month]')) upgrade(n); scan(n); } }))).observe(document.documentElement, {childList: true, subtree: true});
})();
