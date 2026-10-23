/* الطلبيات والتسعير: نفس الشاشات عند مصطفى (الحسابات) وعند أحمد (حركة السوق).
   - الطلبية: العميل، الأصناف (اسم حر + كام لفة + وزن اللفة = الكيلو)، ميعاد التسليم، ملاحظة. مفيش أسعار خالص.
     حالتها: لسه (st فاضي) أو اتسلمت (done) أو اتلغت (x). مبتتمسحش.
   - التسعير: خلطات بالاسم، كل خلطة لينيرين بسعر الكيلو ونسبة + تشغيل الكيلو + الربح = سعر البيع. حساب بس.
   - الاتنين مش حركة فلوس: مبيلمسوش أي رصيد ولا فاتورة ولا خزنة. بيتبعتوا على شيت السوق كسطور ord / prc، وآخر تعديل هو اللي بيفضل.
   الصفحة بتدّي الملف ده window.ORD_HOST قبل ما يتحمّل:
     who: 'مصطفى' أو 'أحمد'، dev: اسم الجهاز، box(): {ord, prc, oit} (الكائنات نفسها)، changed(): يحفظ ويبعت،
     names(): أسامي العملا، items(): أسامي أصناف من الفواتير، modal(html)، close()، toast(msg)، today()، now()
   الفلوس هنا مش حسابات: الأسعار بالقرش (أرقام صحيحة) والنسبة رقم من 0 لـ 100. */
(() => {
  const H = () => window.ORD_HOST;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const norm = s => String(s || '').trim().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,]/g, '.').replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
  const r2 = n => Math.round(n * 100) / 100;
  const nf = n => (Math.round(n * 100) / 100).toLocaleString('en-US', {maximumFractionDigits: 2});
  const pi = n => nf(n / 100);   // قرش ← جنيه للعرض
  const css = document.createElement('style');
  css.textContent = `
.od h3{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:var(--f3);font-weight:800}
.od h3 .sp{flex:1}
.od .ob{border:0;border-radius:10px;background:var(--gold);color:var(--ink);font:inherit;font-weight:800;font-size:var(--f2);padding:7px 14px;cursor:pointer}
.od .ox{border:0;background:var(--row);color:var(--sub);border-radius:10px;width:38px;height:38px;font:inherit;font-size:var(--f3);cursor:pointer}
.od .seg{margin-bottom:10px}
.od .oc{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px;cursor:pointer}
.od .oc.late{border-inline-start:4px solid var(--red)}
.od .oc .t{display:flex;justify-content:space-between;align-items:center;gap:8px}
.od .oc .t b{font-size:var(--f3);font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.od .who{flex:none;font-size:var(--f1);font-weight:800;border-radius:7px;padding:1px 8px;background:var(--tr-l);color:var(--tr)}
.od .who.m{background:var(--gold-l);color:var(--gold-d)}
.od .oi{font-size:var(--f2);font-weight:700;margin-top:4px;line-height:1.6;color:var(--ink)}
.od .onote{font-size:var(--f1);color:var(--sub);font-weight:600}
.od .ft{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px}
.od .ft .d{font-size:var(--f1);color:var(--sub);font-weight:700}.od .ft .d.late{color:var(--red);font-weight:800}
.od .ok{border:0;border-radius:10px;background:var(--green);color:var(--card);font:inherit;font-weight:800;font-size:var(--f2);padding:7px 14px;cursor:pointer;flex:none}
.od .ok.back{background:var(--row);color:var(--sub)}
.od .oempty{text-align:center;color:var(--sub);font-weight:700;font-size:var(--f2);padding:24px 0}
.od label{display:block;font-size:var(--f1);color:var(--sub);font-weight:800;margin:8px 2px 3px}
.od input{width:100%;height:46px;border:1.5px solid var(--field);border-radius:11px;background:var(--card);color:var(--ink);padding:0 12px;font:inherit;font-size:var(--f3);font-weight:700;outline:none}
.od input:focus{border-color:var(--gold)}
.od .sg{background:var(--card);border:1px solid var(--line);border-radius:10px;margin-top:4px;box-shadow:var(--shadow2);overflow:hidden}
.od .sg button{display:block;width:100%;text-align:right;border:0;border-top:1px solid var(--row);background:none;color:var(--ink);font:inherit;font-size:var(--f2);font-weight:800;padding:8px 10px;cursor:pointer}
.od .sg button:first-child{border-top:0}.od .sg small{color:var(--sub);font-weight:600;font-size:var(--f1)}
.od .ln{border:1.5px solid var(--line);border-radius:12px;padding:8px 10px;margin-bottom:8px}
.od .ln.on{border-color:var(--gold)}
.od .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px}
.od .g3 span{display:block;text-align:center;font-size:var(--f1);color:var(--sub);font-weight:800;margin-bottom:2px}
.od .g3 input{text-align:center;font-size:var(--f4);font-weight:800;padding:0 4px;direction:ltr}
.od .g3 input.k{background:var(--row)}
.od .chips{display:flex;flex-wrap:wrap;gap:6px}
.od .chips button{border:1.5px solid var(--gold);background:var(--gold-l);color:var(--ink);border-radius:20px;font:inherit;font-weight:800;font-size:var(--f2);padding:7px 14px;cursor:pointer}
.od .chips button.on{background:var(--gold)}
.od .sv{display:block;width:100%;border:0;border-radius:12px;background:var(--green);color:var(--card);font:inherit;font-weight:800;font-size:var(--f3);height:52px;margin-top:12px;cursor:pointer}
.od .lk{display:block;width:100%;border:0;background:none;color:var(--sub);font:inherit;font-weight:800;font-size:var(--f2);padding:10px;cursor:pointer;text-decoration:underline}
.od .lk.red{color:var(--red)}
.od .err{color:var(--red);font-weight:800;font-size:var(--f2);margin-top:8px;text-align:center}
.od .mx{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:10px}
.od .lr{display:grid;grid-template-columns:1fr 88px 70px;gap:6px;align-items:center;margin-bottom:6px}
.od .lr.two{grid-template-columns:1fr 100px}
.od .lr .h{font-size:var(--f1);color:var(--sub);font-weight:800;text-align:center}.od .lr .h:first-child{text-align:right}
.od .lr input{text-align:center;font-weight:800;padding:0 4px}
.od .lr input.nm{text-align:right;padding:0 10px;font-size:var(--f2)}
.od .lr input.pc{border-color:var(--tr);color:var(--tr)}
.od .lr b{font-size:var(--f2);font-weight:800}
.od .obar{height:12px;border-radius:6px;overflow:hidden;display:flex;margin:4px 0 6px;background:var(--row)}
.od .obar i{display:block;background:var(--gold)}.od .obar i+i{background:var(--tr)}
.od .onote2{font-size:var(--f1);color:var(--sub);font-weight:600;line-height:1.6}
.od .ores{background:var(--bar);color:var(--card);border-radius:12px;padding:12px;margin-bottom:10px}
.od .ores .r{display:flex;justify-content:space-between;align-items:baseline;font-size:var(--f2);font-weight:700;margin-bottom:4px}
.od .ores .r span{opacity:.75}
.od .ores .obig{background:var(--gold);color:var(--ink);border-radius:10px;text-align:center;font-size:var(--f5);font-weight:800;padding:4px;margin-top:6px}
.od .ores .r.w{color:var(--gold)}
.od .wn{background:var(--red-l);color:var(--red);border-radius:10px;padding:8px 10px;font-size:var(--f2);font-weight:800;margin-bottom:8px}
.od details summary{cursor:pointer;font-weight:800;font-size:var(--f2);padding:6px 2px;color:var(--gold-d)}
html[data-theme=dark] .od .ores{background:var(--row);color:var(--ink)}
`;
  document.head.appendChild(css);

  /* ====================== التواريخ ====================== */
  const D = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const addD = (iso, n) => new Date(D(iso) + n * 86400000).toISOString().slice(0, 10);
  const diffD = (a, b) => Math.round((D(a) - D(b)) / 86400000);
  const WD = ['الأحد', 'الاثنين', 'الثلاث', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
  const dm = iso => { const [, m, d] = iso.split('-').map(Number); return d + '/' + m; };
  const dueTxt = iso => { const n = diffD(iso, H().today()); return n === 0 ? 'النهارده' : n === 1 ? 'بكرة' : n === -1 ? 'امبارح' : WD[new Date(D(iso)).getUTCDay()] + ' ' + dm(iso); };

  /* ====================== الطلبيات ====================== */
  const box = () => H().box();
  const live = () => Object.values(box().ord).filter(o => o && !o.del && o.cname);
  const isOpen = o => !o.st;
  const lateBy = o => isOpen(o) && o.due ? diffD(H().today(), o.due) : 0;
  const kgOf = it => it.k || (it.c && it.w ? r2(it.c * it.w) : 0);
  const itTxt = it => [it.c ? `${nf(it.c)} ${/^لف[ةه]/.test(it.n) ? it.n : 'لفة ' + it.n}` : it.n, it.c && it.w ? `${nf(it.w)} ك` : '', kgOf(it) ? (it.c && it.w ? '= ' : '') + nf(kgOf(it)) + ' ك' : ''].filter(Boolean).join(' · ').replace(' · = ', ' = ');
  const openCount = () => live().filter(isOpen).length;
  window.ordOpenCount = () => { try { return openCount(); } catch (e) { return 0; } };
  const sortOpen = l => l.sort((a, b) => (lateBy(b) > 0) - (lateBy(a) > 0) || String(a.due || '9').localeCompare(String(b.due || '9')) || a.at - b.at);
  /* وزن اللفة من آخر مرة: لنفس العميل الأول، وبعدين أي عميل */
  function lastW(name, cname) {
    const n = norm(name); let best = null, any = null;
    live().sort((a, b) => b.at - a.at).forEach(o => (o.items || []).forEach(it => { if (norm(it.n) !== n || !it.w) return; if (!any) any = it.w; if (!best && norm(o.cname) === norm(cname)) best = it.w; }));
    return best || any || 0;
  }
  /* اقتراحات الأصناف: من الطلبيات القديمة (بالوزن) + أصناف الفواتير */
  function itemSugs(q, cname) {
    const m = new Map();
    live().sort((a, b) => b.at - a.at).forEach(o => (o.items || []).forEach(it => { const k = norm(it.n); if (it.n && !m.has(k)) m.set(k, it.n); }));
    (H().items() || []).forEach(n => { const k = norm(n); if (n && !m.has(k)) m.set(k, n); });
    const words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    return [...m.values()].filter(n => { const t = norm(n); return words.every(w => t.includes(w)) && t !== norm(q); }).slice(0, 6);
  }
  function custSugs(q) {
    const m = new Map();
    live().sort((a, b) => b.at - a.at).forEach(o => { const k = norm(o.cname); if (!m.has(k)) m.set(k, o.cname); });
    (H().names() || []).forEach(n => { const k = norm(n); if (n && !m.has(k)) m.set(k, n); });
    const words = norm(q).split(' ').filter(Boolean), all = [...m.values()];
    if (!words.length) return all.slice(0, 6);   // اللي طلبوا قريب الأول
    return all.filter(n => { const t = norm(n); return words.every(w => t.includes(w)) && t !== norm(q); }).slice(0, 6);
  }
  function put(o) {
    const h = H(), n = h.now();
    o.upd = Math.max(n, (o.upd || 0) + 1);
    box().ord[o.id] = o;
    h.changed();
  }

  let tab = 'open', view = '';
  function list() {
    view = 'list';
    const all = live(), op = sortOpen(all.filter(isOpen)), dn = all.filter(o => !isOpen(o)).sort((a, b) => (b.doneAt || b.upd) - (a.doneAt || a.upd)).slice(0, 80);
    const L = tab === 'open' ? op : dn, me = H().who;
    const card = o => { const lt = lateBy(o);
      return `<div class="oc ${lt > 0 ? 'late' : ''}" data-o="${esc(o.id)}"><div class="t"><b>${esc(o.cname)}</b><span class="who ${o.by === 'مصطفى' ? 'm' : ''}">${esc(o.by || '')}</span></div>
        <div class="oi">${(o.items || []).map(it => esc(itTxt(it))).join('<br>')}</div>${o.note ? `<div class="onote">${esc(o.note)}</div>` : ''}
        <div class="ft">${isOpen(o) ? `<span class="d ${lt > 0 ? 'late' : ''}">${o.due ? (lt > 0 ? `متأخرة ${lt === 1 ? 'يوم' : lt === 2 ? 'يومين' : lt + ' أيام'} (كانت ${dueTxt(o.due)})` : 'التسليم: ' + dueTxt(o.due)) : 'من غير ميعاد'}</span><button class="ok" type="button" data-done="${esc(o.id)}">✓ اتسلمت</button>`
          : `<span class="d">${o.st === 'x' ? '✖ اتلغت' : '✓ اتسلمت'} ${o.doneAt ? dm(new Date(o.doneAt).toISOString().slice(0, 10)) : ''}${o.doneBy ? ' · ' + esc(o.doneBy) : ''}</span><button class="ok back" type="button" data-back="${esc(o.id)}">رجّعها لسه</button>`}</div></div>`; };
    H().modal(`<div class="od" id="ordL"><h3>📋 الطلبيات<span class="sp"></span><button class="ob" id="oNew" type="button">＋ طلبية</button><button class="ox" id="oX" type="button">✕</button></h3>
      <div class="seg" id="oTabs" style="--n:2"><button type="button" data-v="open" class="${tab === 'open' ? 'on' : ''}">لسه متسلمتش (${op.length})</button><button type="button" data-v="done" class="${tab === 'done' ? 'on' : ''}">اتسلمت</button></div>
      ${L.length ? L.map(card).join('') : `<div class="oempty">${tab === 'open' ? 'مفيش طلبيات مستنية' : 'لسه مفيش طلبيات اتسلمت'}</div>`}</div>`);
    $('#oX').onclick = () => { view = ''; H().close(); };
    $('#oNew').onclick = () => form(null);
    $$('#oTabs button').forEach(b => b.onclick = () => { tab = b.dataset.v; list(); });
    $$('#ordL .oc').forEach(c => c.onclick = e => { if (e.target.closest('button')) return; form(box().ord[c.dataset.o]); });
    $$('#ordL [data-done]').forEach(b => b.onclick = () => { const o = Object.assign({}, box().ord[b.dataset.done], {st: 'done', doneAt: H().now(), doneBy: me}); put(o); H().toast('✓ اتسلمت'); list(); });
    $$('#ordL [data-back]').forEach(b => b.onclick = () => { const o = Object.assign({}, box().ord[b.dataset.back], {st: '', doneAt: 0, doneBy: ''}); put(o); tab = 'open'; list(); });
  }

  function form(o0) {
    view = 'form';
    const h = H(), t = h.today();
    const o = o0 ? JSON.parse(JSON.stringify(o0)) : {cname: '', items: [], due: addD(t, 1), note: ''};
    const lines = (o.items || []).map(it => Object.assign({}, it, {km: !!it.k && !(it.c && it.w)}));
    const blank = () => ({n: '', c: 0, w: 0, k: 0, km: false});
    if (!lines.length || lines[lines.length - 1].n) lines.push(blank());
    let due = o.due || '', other = !!due && ![0, 1, 2].some(n => addD(t, n) === due);
    const chips = () => [[addD(t, 0), 'النهارده'], [addD(t, 1), 'بكرة'], [addD(t, 2), 'بعد بكرة']].map(([d, l]) => `<button type="button" data-d="${d}" class="${!other && due === d ? 'on' : ''}">${l}</button>`).join('') + `<button type="button" data-d="x" class="${other ? 'on' : ''}">يوم تاني</button>`;
    const lineH = (it, i) => `<div class="ln ${it.n ? 'on' : ''}" data-i="${i}"><input class="n" placeholder="الصنف (اكتب أي حاجة)" value="${esc(it.n)}" autocomplete="off"><div class="sg" hidden></div>
      <div class="g3"><div><span>كام لفة</span><input class="c" inputmode="decimal" value="${it.c || ''}"></div><div><span>وزن اللفة</span><input class="w" inputmode="decimal" value="${it.w || ''}"></div><div><span>الكيلو</span><input class="k" inputmode="decimal" value="${kgOf(it) || ''}"></div></div></div>`;
    h.modal(`<div class="od" id="ordF"><h3>${o0 ? 'تعديل طلبية' : 'طلبية جديدة'}<span class="sp"></span><button class="ox" id="oBk" type="button">→</button></h3>
      <label>العميل</label><input id="oC" placeholder="اكتب أول حرفين من الاسم" value="${esc(o.cname)}" autocomplete="off"><div class="sg" id="oCS" hidden></div>
      <label>الأصناف</label><div id="oLs">${lines.map(lineH).join('')}</div>
      <label>عاوزها إمتى؟</label><div class="chips" id="oD">${chips()}</div><div id="oDw" style="margin-top:6px${other ? '' : ';display:none'}"><input type="date" id="oDx" value="${esc(due)}"></div>
      <label>ملاحظة (لو فيه)</label><input id="oN" value="${esc(o.note || '')}" autocomplete="off">
      <div class="err" id="oE"></div>
      <button class="sv" id="oSv" type="button">✓ احفظ الطلبية</button>
      ${o0 && isOpen(o0) ? '<button class="lk red" id="oCx" type="button">اتلغت (متتعملش)</button>' : ''}</div>`);
    const back = () => list();
    $('#oBk').onclick = back;
    /* العميل */
    const cIn = $('#oC'), cS = $('#oCS');
    const drawC = () => { const s = custSugs(cIn.value); cS.hidden = !s.length || (document.activeElement !== cIn && !!cIn.value); cS.innerHTML = s.map(n => `<button type="button">${esc(n)}</button>`).join(''); $$('#oCS button').forEach(b => b.onmousedown = b.onclick = e => { e.preventDefault(); cIn.value = b.textContent; cS.hidden = true; const f = $('#oLs .ln .n'); if (f && !f.value) f.focus(); }); };
    cIn.oninput = drawC; cIn.onfocus = drawC; cIn.onblur = () => setTimeout(() => cS.hidden = true, 150);
    if (!o0) setTimeout(() => { drawC(); }, 50);
    /* الأصناف */
    const bindLine = el => {
      const i = +el.dataset.i, it = lines[i], nI = el.querySelector('.n'), sg = el.querySelector('.sg'), cI = el.querySelector('.c'), wI = el.querySelector('.w'), kI = el.querySelector('.k');
      const calc = () => { if (!it.km) { it.k = it.c && it.w ? r2(it.c * it.w) : 0; kI.value = it.k || ''; } };
      const grow = () => { el.classList.toggle('on', !!it.n); if (it.n && i === lines.length - 1) { lines.push(blank()); const d = document.createElement('div'); d.innerHTML = lineH(lines[i + 1], i + 1); const ne = d.firstElementChild; $('#oLs').appendChild(ne); bindLine(ne); } };
      const pick = n => { nI.value = it.n = n; sg.hidden = true; if (!it.w) { it.w = lastW(n, cIn.value); wI.value = it.w || ''; calc(); } grow(); cI.focus(); };
      const drawS = () => { const s = itemSugs(nI.value, cIn.value); sg.hidden = !s.length; sg.innerHTML = s.map(n => { const w = lastW(n, cIn.value); return `<button type="button" data-n="${esc(n)}">${esc(n)}${w ? ` <small>· ${nf(w)} ك</small>` : ''}</button>`; }).join(''); sg.querySelectorAll('button').forEach(b => b.onmousedown = b.onclick = e => { e.preventDefault(); pick(b.dataset.n); }); };
      nI.oninput = () => { it.n = nI.value.trim(); drawS(); grow(); };
      nI.onblur = () => setTimeout(() => { sg.hidden = true; if (it.n && !it.w) { it.w = lastW(it.n, cIn.value); wI.value = it.w || ''; calc(); } }, 150);
      cI.oninput = () => { it.c = num(cI.value); calc(); };
      wI.oninput = () => { it.w = num(wI.value); calc(); };
      kI.oninput = () => { it.k = num(kI.value); it.km = !!kI.value; };
    };
    $$('#oLs .ln').forEach(bindLine);
    /* الميعاد */
    const dx = $('#oDx');
    const bindD = () => $$('#oD button').forEach(b => b.onclick = () => { if (b.dataset.d === 'x') { other = true; $('#oDw').style.display = ''; due = dx.value && ![0, 1, 2].some(n => addD(t, n) === dx.value) ? dx.value : addD(t, 3); dx.value = due; } else { other = false; $('#oDw').style.display = 'none'; due = b.dataset.d; } $('#oD').innerHTML = chips(); bindD(); });
    bindD(); dx.onchange = dx.oninput = () => { due = dx.value; };
    $('#oSv').onclick = () => {
      const cname = cIn.value.trim().replace(/\s+/g, ' '), items = lines.filter(it => it.n).map(it => { const r = {n: it.n}; if (it.c) r.c = it.c; if (it.w) r.w = it.w; const k = kgOf(it); if (k) r.k = k; return r; });
      const err = !cname ? 'اكتب اسم العميل' : !items.length ? 'اكتب صنف واحد على الأقل' : items.some(x => !x.c && !x.k) ? 'كل صنف محتاج عدد اللفف أو الكيلو' : '';
      $('#oE').textContent = err; if (err) return;
      const n = h.now(), rec = Object.assign({}, o0 || {id: 'o_' + (h.dev || 'x') + '_' + n.toString(36) + Math.random().toString(36).slice(2, 5), at: n, by: h.who, st: ''}, {cname, items, due, note: $('#oN').value.trim()});
      put(rec); h.toast(o0 ? '✓ اتعدّلت' : '✓ الطلبية اتحفظت'); tab = isOpen(rec) ? 'open' : tab; list();
    };
    if ($('#oCx')) $('#oCx').onclick = () => { put(Object.assign({}, o0, {st: 'x', doneAt: h.now(), doneBy: h.who})); h.toast('اتلغت'); list(); };
  }
  window.ordOpen = () => { tab = 'open'; list(); };
  /* جديد وصل من التاني والقايمة مفتوحة قدامه: نرسمها تاني (الفورم المفتوحة مبتتلمسش) */
  window.ordRefresh = () => { if (view === 'list' && $('#ordL')) list(); if (view === 'prc' && $('#prcV') && !$('#prcV').contains(document.activeElement)) prc(); };

  /* ====================== التسعير ====================== */
  const mixes = () => Object.values(box().prc).filter(m => m && !m.del).sort((a, b) => a.at - b.at);
  const blankMix = n => ({id: 'p_' + (H().dev || 'x') + '_' + H().now().toString(36), at: H().now(), name: n || 'الخلطة', n1: 'لينير أساسي', n2: 'لينير أرخص', p1: 0, p2: 0, a: 100, op: 0, pr: 0});
  /* كيلو الخلطة والتكلفة وسعر البيع (بالقرش، بكسور) */
  const calc = m => { const a = Math.min(100, Math.max(0, m.a)), mix = m.p1 * a / 100 + m.p2 * (100 - a) / 100, cost = mix + m.op; return {mix, cost, sale: cost * (1 + m.pr / 100)}; };
  /* العكس: عاوز تبيع بـ T بنفس الربح ← نسبة الأساسي كام */
  function reverse(m, T) {
    if (!T) return null;
    const mix = T / (1 + m.pr / 100) - m.op;
    if (m.p1 === m.p2) return {bad: 'السعرين زي بعض، النسبة مش هتفرق'};
    const a = (mix - m.p2) / (m.p1 - m.p2) * 100;
    if (a > 100) return {bad: 'حتى لو كلها ' + m.n1 + ' هتكسب أكتر من ربحك بالسعر ده'};
    if (a < 0) return {bad: 'حتى لو كلها ' + m.n2 + ' مش هتوصل للسعر ده بنفس الربح. ارفع السعر أو قلل الربح'};
    return {a: Math.round(a * 10) / 10};
  }
  let cur = '', saveT = 0, tgt = '';
  function savePrc(m) {
    clearTimeout(saveT);
    saveT = setTimeout(() => { saveT = 0; const h = H(); m.upd = Math.max(h.now(), (m.upd || 0) + 1); m.by = h.who; m.byAt = h.now(); box().prc[m.id] = m; h.changed(); }, 700);
  }
  function prc() {
    view = 'prc';
    let L = mixes();
    let m = L.find(x => x.id === cur) || L[0];
    if (!m) m = blankMix();
    cur = m.id;
    m = JSON.parse(JSON.stringify(m));
    const h = H();
    h.modal(`<div class="od" id="prcV"><h3>🏷️ التسعير<span class="sp"></span><button class="ox" id="pX" type="button">✕</button></h3>
      <div class="chips" id="pM" style="margin-bottom:10px">${(L.length ? L : [m]).map(x => `<button type="button" data-m="${esc(x.id)}" class="${x.id === m.id ? 'on' : ''}">${esc(x.name)}</button>`).join('')}<button type="button" id="pAdd">＋ خلطة</button></div>
      <div class="mx"><div class="lr"><span class="h">اللينير</span><span class="h">سعر الكيلو</span><span class="h">النسبة %</span></div>
        <div class="lr"><input class="nm" id="pN1" value="${esc(m.n1)}"><input id="pP1" inputmode="decimal" value="${m.p1 ? pi(m.p1) : ''}"><input class="pc" id="pA1" inputmode="decimal" value="${nf(m.a)}"></div>
        <div class="lr"><input class="nm" id="pN2" value="${esc(m.n2)}"><input id="pP2" inputmode="decimal" value="${m.p2 ? pi(m.p2) : ''}"><input class="pc" id="pA2" inputmode="decimal" value="${nf(100 - m.a)}"></div>
        <div class="obar"><i id="pB1"></i><i id="pB2"></i></div><div class="onote2" id="pBt"></div></div>
      <div class="mx"><div class="lr two"><b>تشغيل الكيلو (كهربا وعمالة وصبغة)</b><input id="pOp" inputmode="decimal" value="${m.op ? pi(m.op) : ''}"></div>
        <div class="lr two" style="margin:0"><b>ربحك %</b><input id="pPr" inputmode="decimal" value="${m.pr ? nf(m.pr) : ''}"></div></div>
      <div class="ores"><div class="r"><span>كيلو الخلطة</span><b id="pRm"></b></div><div class="r"><span>+ التشغيل = التكلفة</span><b id="pRc"></b></div><div class="r w"><b>سعر البيع للكيلو</b></div><div class="obig" id="pRs"></div></div>
      <details id="pRv"${tgt ? ' open' : ''}><summary>عاوز تبيع بسعر معين؟ اعرف تخلط بكام</summary>
        <div class="mx" style="margin-top:6px"><div class="lr two"><b>سعر البيع اللي في دماغك</b><input id="pT" inputmode="decimal" value="${esc(tgt)}"></div><div id="pTr"></div></div></details>
      <div class="onote2" id="pBy" style="text-align:center"></div>
      <button class="lk" id="pRen" type="button">غيّر اسم الخلطة</button>${L.length > 1 ? '<button class="lk red" id="pDel" type="button">امسح الخلطة دي</button>' : ''}</div>`);
    const draw = () => {
      const r = calc(m), a = Math.min(100, Math.max(0, m.a));
      $('#pB1').style.width = a + '%'; $('#pB2').style.width = (100 - a) + '%';
      $('#pBt').textContent = `يعني في كل 100 كيلو: ${nf(a)} ${m.n1} و${nf(100 - a)} ${m.n2}. غيّر نسبة واحد والتاني بيتظبط لوحده.`;
      $('#pRm').textContent = pi(r.mix); $('#pRc').textContent = pi(r.cost); $('#pRs').textContent = pi(r.sale);
      const T = Math.round(num($('#pT').value) * 100), v = reverse(m, T);
      $('#pTr').innerHTML = !v ? '' : v.bad ? `<div class="wn">${esc(v.bad)}</div>` : `<div class="ores" style="margin:6px 0 0"><div class="r w"><b>اخلط كده:</b></div><div class="r"><span>${esc(m.n1)} (${pi(m.p1)})</span><b>${nf(v.a)}%</b></div><div class="r"><span>${esc(m.n2)} (${pi(m.p2)})</span><b>${nf(r2(100 - v.a))}%</b></div></div>${100 - v.a > 50 ? `<div class="wn" style="margin-top:6px">⚠️ ${esc(m.n2)} أكتر من النص. لو بيأثر على الجودة، ارفع السعر أو قلل الربح.</div>` : ''}`;
      const s = box().prc[m.id];
      $('#pBy').textContent = s && s.by ? `آخر تغيير: ${s.by} · ${dueTxt(new Date(s.byAt || s.upd).toISOString().slice(0, 10))}` : '';
    };
    draw();
    const bind = (id, f) => { $(id).oninput = () => { f($(id).value); draw(); savePrc(m); }; };
    bind('#pN1', v => m.n1 = v.trim() || 'لينير أساسي'); bind('#pN2', v => m.n2 = v.trim() || 'لينير أرخص');
    bind('#pP1', v => m.p1 = Math.round(num(v) * 100)); bind('#pP2', v => m.p2 = Math.round(num(v) * 100));
    bind('#pA1', v => { m.a = Math.min(100, num(v)); $('#pA2').value = nf(100 - m.a); });
    bind('#pA2', v => { m.a = 100 - Math.min(100, num(v)); $('#pA1').value = nf(m.a); });
    bind('#pOp', v => m.op = Math.round(num(v) * 100)); bind('#pPr', v => m.pr = num(v));
    $('#pT').oninput = () => { tgt = $('#pT').value; draw(); };
    $('#pX').onclick = () => { view = ''; flush(m); h.close(); };
    $$('#pM button[data-m]').forEach(b => b.onclick = () => { flush(m); cur = b.dataset.m; prc(); });
    $('#pAdd').onclick = () => { flush(m); const n = blankMix('خلطة ' + (mixes().length + 1)); if (m) Object.assign(n, {n1: m.n1, n2: m.n2, p1: m.p1, p2: m.p2, op: m.op, pr: m.pr}); n.upd = h.now(); n.by = h.who; n.byAt = h.now(); if (!box().prc[m.id]) { m.upd = h.now(); m.by = h.who; m.byAt = h.now(); box().prc[m.id] = m; } box().prc[n.id] = n; h.changed(); cur = n.id; prc(); setTimeout(() => $('#pRen') && $('#pRen').click(), 50); };
    $('#pRen').onclick = () => { const el = $('#pRen'); el.outerHTML = `<div class="mx"><div class="lr two"><b>اسم الخلطة</b><input id="pNm" value="${esc(m.name)}"></div></div>`; const i = $('#pNm'); i.focus(); i.select(); i.oninput = () => { m.name = i.value.trim() || 'الخلطة'; const c = $(`#pM button[data-m="${CSS.escape(m.id)}"]`); if (c) c.textContent = m.name; savePrc(m); }; };
    if ($('#pDel')) $('#pDel').onclick = () => { clearTimeout(saveT); saveT = 0; const s = Object.assign({}, box().prc[m.id] || m, {del: true, upd: Math.max(h.now(), (m.upd || 0) + 1), by: h.who}); box().prc[m.id] = s; h.changed(); cur = ''; prc(); };
  }
  function flush(m) { if (!saveT) return; clearTimeout(saveT); saveT = 0; const h = H(); m.upd = Math.max(h.now(), (m.upd || 0) + 1); m.by = h.who; m.byAt = h.now(); box().prc[m.id] = m; h.changed(); }
  window.prcOpen = () => prc();
  window.ORD_T = {calc, reverse, kgOf, itTxt, lastW};   // للاختبارات
})();
