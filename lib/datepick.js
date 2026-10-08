/* منتقي التاريخ: كليندر عادي بيفتح لما تدوس على خانة التاريخ، وأول ما تدوس على اليوم بيتسجل ويتقفل من غير زرار تأكيد.
   الخانة بتعرض يوم/شهر/سنة (اليوم على اليمين). الـ input الأصلي (date أو month) بيفضل مخفي بنفس القيمة (YYYY-MM-DD أو YYYY-MM)،
   فباقي الكود يفضل شغال زي ما هو (القيمة، وأحداث input و change). */
(function () {
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const WD = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];   // الأسبوع بيبدأ سبت، على اليمين
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const css = document.createElement('style');
  css.textContent = '.dp{direction:rtl;display:flex;align-items:center;justify-content:center;gap:4px;width:100%;min-height:54px;padding:8px 12px;border:1.5px solid #D6CDB5;border-radius:11px;background:#fff;font:inherit;font-size:18px;font-weight:800;cursor:pointer;color:inherit}' +
    '.dp:focus{outline:none;border-color:#DAAE57;box-shadow:0 0 0 3px #DAAE5744}.dp .ph{color:#999;font-weight:700}.dp .sp{color:#999}.dp .ic{margin-inline-end:auto;font-size:18px}' +
    'input.dpx{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;min-height:0!important;padding:0!important;border:0!important;margin:0!important}' +
    '.dpm{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:300;display:flex;align-items:center;justify-content:center;padding:14px}' +
    '.dpo{direction:rtl;background:#fff;border-radius:16px;padding:12px;width:100%;max-width:360px;box-shadow:0 10px 40px rgba(0,0,0,.4);font-family:inherit}' +
    '.dph{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:4px;margin-bottom:6px}' +
    '.dph b{text-align:center;font-size:18px;font-weight:800}.dph button{height:44px;border:0;border-radius:10px;background:#EFE9D8;font-size:22px;font-weight:800;cursor:pointer;color:#111}' +
    '.dpy{display:grid;grid-template-columns:44px 1fr 44px;gap:4px;margin-bottom:8px;align-items:center}.dpy span{text-align:center;font-weight:800;font-size:16px;color:#555}.dpy button{height:36px;border:0;border-radius:10px;background:#F5F2EA;font-size:18px;font-weight:800;cursor:pointer;color:#111}' +
    '.dpg{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.dpg.m{grid-template-columns:repeat(3,1fr)}.dpg i{font-style:normal;text-align:center;font-size:13px;font-weight:800;color:#9C7420;padding:2px 0}' +
    '.dpg button{height:44px;border:0;border-radius:10px;background:#fff;font:inherit;font-size:17px;font-weight:700;cursor:pointer;color:#111}.dpg.m button{height:52px;font-size:16px}' +
    '.dpg button:hover{background:#FBF5E6}.dpg button.t{box-shadow:inset 0 0 0 2px #DAAE57}.dpg button.on{background:#111;color:#DAAE57}.dpg button.x{visibility:hidden}' +
    '.dpf{display:flex;gap:6px;margin-top:8px}.dpf button{flex:1;height:44px;border:1.5px solid #111;border-radius:10px;background:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer;color:#111}';
  document.head.appendChild(css);
  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m)}${d ? '-' + pad(d) : ''}`;
  const today = () => { const t = new Date(); return [t.getFullYear(), t.getMonth() + 1, t.getDate()]; };

  /* نافذة الكليندر: pick(value) بيتنفذ أول ما تختار */
  function openCal(isDay, cur, pick) {
    const m0 = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(cur || ''), [ty, tm, td] = today();
    let Y = m0 ? +m0[1] : ty, M = m0 ? +m0[2] : tm;
    const selY = m0 ? +m0[1] : 0, selM = m0 ? +m0[2] : 0, selD = m0 && m0[3] ? +m0[3] : 0;
    const mask = document.createElement('div'); mask.className = 'dpm';
    const close = () => mask.remove();
    const done = v => { close(); pick(v); };
    const draw = () => {
      let h = '';
      if (isDay) {
        const first = (new Date(Y, M - 1, 1).getDay() + 1) % 7, n = new Date(Y, M, 0).getDate();   // السبت = 0
        h = `<div class="dph"><button type="button" data-a="pm" aria-label="الشهر اللي فات">›</button><b>${MONTHS[M - 1]} ${Y}</b><button type="button" data-a="nm" aria-label="الشهر الجاي">‹</button></div>` +
          `<div class="dpg">${WD.map(w => `<i>${w}</i>`).join('')}${'<button type="button" class="x" tabindex="-1"></button>'.repeat(first)}` +
          Array.from({length: n}, (_, i) => { const d = i + 1, c = (Y === selY && M === selM && d === selD ? ' on' : '') + (Y === ty && M === tm && d === td ? ' t' : ''); return `<button type="button" class="${c.trim()}" data-d="${d}">${d}</button>`; }).join('') + '</div>' +
          `<div class="dpf"><button type="button" data-a="today">النهارده</button><button type="button" data-a="x">إغلاق</button></div>`;
      } else {
        h = `<div class="dph"><button type="button" data-a="py" aria-label="السنة اللي فات">›</button><b>${Y}</b><button type="button" data-a="ny" aria-label="السنة الجاية">‹</button></div>` +
          `<div class="dpg m">${MONTHS.map((n, i) => `<button type="button" class="${Y === selY && i + 1 === selM ? 'on' : ''}${Y === ty && i + 1 === tm ? ' t' : ''}" data-mo="${i + 1}">${n}</button>`).join('')}</div>` +
          `<div class="dpf"><button type="button" data-a="today">الشهر ده</button><button type="button" data-a="x">إغلاق</button></div>`;
      }
      mask.firstChild.innerHTML = h;
      mask.querySelectorAll('button').forEach(b => b.onclick = () => {
        const a = b.dataset.a;
        if (b.dataset.d) return done(iso(Y, M, +b.dataset.d));
        if (b.dataset.mo) return done(iso(Y, +b.dataset.mo));
        if (a === 'x') return close();
        if (a === 'today') return done(isDay ? iso(ty, tm, td) : iso(ty, tm));
        if (a === 'pm') { M--; if (M < 1) { M = 12; Y--; } }
        if (a === 'nm') { M++; if (M > 12) { M = 1; Y++; } }
        if (a === 'py') Y--; if (a === 'ny') Y++;
        draw();
      });
      if (isDay) {   // دوس على الشهر/السنة في العنوان علشان تقفز للسنة اللي قبلها أو بعدها بسرعة
        const y = document.createElement('div'); y.className = 'dpy';
        y.innerHTML = '<button type="button" data-yy="-1" aria-label="سنة فاتت">−</button><span>السنة</span><button type="button" data-yy="1" aria-label="سنة جاية">+</button>';
        y.querySelectorAll('button').forEach(b => b.onclick = () => { Y += +b.dataset.yy; draw(); });
        mask.firstChild.insertBefore(y, mask.firstChild.children[1]);
      }
    };
    mask.innerHTML = '<div class="dpo" role="dialog"></div>';
    mask.addEventListener('click', e => { if (e.target === mask) close(); });
    document.body.appendChild(mask); draw();
  }

  function upgrade(inp) {
    if (inp.dataset.dp) return;
    inp.dataset.dp = '1';
    const isDay = inp.type === 'date';
    let cur = desc.get.call(inp);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'dp';
    inp.after(btn);
    const draw = () => {
      const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(cur || '');
      // في RTL أول عنصر على اليمين: اليوم ثم الشهر ثم السنة
      btn.innerHTML = (m ? (isDay ? `<span>${m[3]}</span><span class="sp">/</span>` : '') + `<span>${m[2]}</span><span class="sp">/</span><span>${m[1]}</span>` : `<span class="ph">${isDay ? 'اختار التاريخ' : 'اختار الشهر'}</span>`) + '<span class="ic">📅</span>';
    };
    const set = v => {
      if (v === cur) return;
      cur = v; desc.set.call(inp, v); draw();
      inp.dispatchEvent(new Event('input', {bubbles: true})); inp.dispatchEvent(new Event('change', {bubbles: true}));
    };
    btn.onclick = () => openCal(isDay, cur, set);
    /* لو الكود غيّر القيمة (inp.value = ...) أو اتكتبت من برا، الخانة تلحقها */
    Object.defineProperty(inp, 'value', {configurable: true, get() { return cur; }, set(v) { cur = String(v || ''); desc.set.call(inp, cur); draw(); }});
    inp.addEventListener('input', () => { const v = desc.get.call(inp); if (v !== cur) { cur = v; draw(); } });
    inp.classList.add('dpx'); inp.tabIndex = -1;
    draw();
  }
  const scan = root => (root.querySelectorAll ? root.querySelectorAll('input[type=date],input[type=month]') : []).forEach(upgrade);
  scan(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches('input[type=date],input[type=month]')) upgrade(n); scan(n); } }))).observe(document.documentElement, {childList: true, subtree: true});
})();
