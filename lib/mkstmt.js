/* كشف الحساب من تطبيق أحمد (بطلبه 23/11/2026): «أحمد يبعت كشوفات حساب للموردين والعملاء، ويختار المدة».
   بيتحمّل وقت الحاجة بس (mkStOpen في market.html). البيانات جاية من الحسابات مع رصيد العميل/المورد (s/sf/so، mkStLines هناك):
   نفس سطور كشف الحسابات بالظبط، من أول الشهر من 3 شهور. وفوقها اللي أحمد سجّله ولسه منزلش عند مصطفى (زي الرصيد اللي ظاهر عنده).
   الورقة نفس شكل كشف الحسابات (buildStmtPages1)، ومبيكتبش أي حاجة ولا بيلمس أي تخزين ولا بيبعت لأي سيرفر: الملف للمشاركة بس. */
(() => {
  const q = s => document.querySelector(s);
  const ex = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const NF0 = new Intl.NumberFormat('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2}), NF2 = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const fP = p => { p = Math.round(+p || 0); const a = Math.abs(p); return (p < 0 ? '-' : '') + (a % 100 ? NF2 : NF0).format(a / 100); };
  const RLM = '‏', p2 = n => String(n).padStart(2, '0');
  const dd = iso => { const [y, m, d] = (iso || '').split('-'); return y ? `${d}${RLM}/${RLM}${m}${RLM}/${RLM}${y}` : ''; };
  const isoOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  const tmOf = ms => { const d = new Date(ms), h = d.getHours(); return `${p2(h % 12 || 12)}:${p2(d.getMinutes())} ${h < 12 ? 'ص' : 'م'}`; };
  const fQ = x => (+x || 0).toLocaleString('en-US', {maximumFractionDigits: 3});
  const WEB = 'www.flashoneg.com', CUR = 'ج.م';

  /* المبلغ بالحروف: نفس moneyWords في الحسابات */
  const AR1 = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const AR10 = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const AR100 = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const ar999 = n => { const r = n % 100; return [AR100[Math.floor(n / 100)], r < 20 ? AR1[r] : (r % 10 ? AR1[r % 10] + ' و' : '') + AR10[Math.floor(r / 10)]].filter(Boolean).join(' و'); };
  const AR_K = [[1e9, ['مليار', 'ملياران', 'مليارات', 'ملياراً', 'مليار']], [1e6, ['مليون', 'مليونان', 'ملايين', 'مليوناً', 'مليون']], [1e3, ['ألف', 'ألفان', 'آلاف', 'ألفاً', 'ألف']]];
  const arNoun = (n, f, end) => { const r = n % 100; return r >= 3 && r <= 10 ? f[2] : r >= 11 && !end ? f[3] : f[4]; };
  const arNum = n => { const out = []; AR_K.forEach(([d, f]) => { const k = Math.floor(n / d); n %= d; if (k) out.push(k === 1 ? f[0] : k === 2 ? f[1] : ar999(k) + ' ' + arNoun(k, f, !n)); }); if (n) out.push(ar999(n)); return out.join(' و'); };
  const arCounted = (n, f) => !n ? '' : n === 1 ? f[0] + ' واحد' : n === 2 ? f[1] : arNum(n) + ' ' + arNoun(n, f);
  const words = p => { p = Math.abs(Math.round(+p || 0)); if (!p) return 'لا يوجد رصيد مستحق'; return 'فقط ' + [arCounted(Math.floor(p / 100), ['جنيه', 'جنيهان', 'جنيهات', 'جنيهاً', 'جنيه']), arCounted(p % 100, ['قرش', 'قرشان', 'قروش', 'قرشاً', 'قرش'])].filter(Boolean).join(' و') + ' لا غير'; };

  /* سطور الكشف كلها: اللي جاي من الحسابات + اللي أحمد سجله ولسه منزلش (x = مدين − دائن زي الحسابات) */
  function allRows(a) {
    const R = (a.s || []).map(r => ({d: r[0], desc: r[1], qty: r[2], price: r[3], x: r[4], ref: r[5], k: r[6], g: r[7] ? 'a' + r[7] : ''}));
    let gi = 0;
    (a.pend || []).slice().sort((x, y) => x.ts - y.ts).forEach(o => {
      const d = isoOf(o.ts), n = o.note || '';
      if (a.sup && (o.t === 'sinv' || o.t === 'srt')) {
        const ret = o.t === 'srt', sg = ret ? 1 : -1, L = (o.lines || []).filter(l => l && l.name), g = L.length > 1 ? 'p' + (++gi) : '';
        if (!L.length) R.push({d, desc: ret ? 'مرتجع مشتريات' : 'فاتورة مشتريات', qty: '', price: 0, x: sg * o.amt, ref: n, k: ret ? 'ret' : '', g: ''});
        L.forEach(l => R.push({d, desc: (ret ? 'مرتجع: ' : '') + l.name, qty: `${fQ(l.qty)} ${l.unit || ''}`.trim(), price: l.price || 0, x: sg * Math.round((+l.qty || 0) * (l.price || 0)), ref: '', k: ret ? 'ret' : '', g}));
      } else if (a.sup) R.push({d, desc: 'دفعة', qty: '', price: 0, x: o.amt, ref: n, k: 'pay', g: ''});
      else if (o.t === 'inv') R.push({d, desc: 'فاتورة', qty: '', price: 0, x: o.amt, ref: n, k: '', g: ''});
      else if (o.t === 'rt') R.push({d, desc: 'مرتجع', qty: '', price: 0, x: -o.amt, ref: n, k: 'ret', g: ''});
      else R.push({d, desc: 'دفعة', qty: '', price: 0, x: -o.amt, ref: n, k: 'pay', g: ''});
    });
    /* الترتيب بالتاريخ وبيفضل زي ما هو جوه اليوم (الحسابات الأول وبعدها اللي لسه منزلش) */
    return R.map((r, i) => [r, i]).sort((x, y) => x[0].d < y[0].d ? -1 : x[0].d > y[0].d ? 1 : x[1] - y[1]).map(x => x[0]);
  }
  /* الكشف لفترة: الرصيد قبلها + سطورها، و sg زي الحسابات (المورد بيتكتب من ناحيته: اللي ليه موجب) */
  function stmtOf(a, from, to) {
    const sg = a.sup ? -1 : 1; let open = a.so || 0; const rows = [];
    allRows(a).forEach(r => { if (r.d < from) open += r.x; else if (r.d <= to) rows.push(r); });
    let run = open; rows.forEach(r => { run += r.x; r.run = run; const v = r.x * sg; r.gd = v > 0 ? v : 0; r.pd = v < 0 ? -v : 0; });
    return {open, rows, close: run, sg, from, to};
  }

  /* ورقة A4 بنفس شكل كشف الحسابات (#render و .pg في الحسابات) */
  const CSS = `#mstR{position:absolute;left:-12000px;top:0;width:794px;pointer-events:none;font-size:16px;line-height:1.5}
.mpg{width:794px;height:1123px;background:#fff;position:relative;display:flex;flex-direction:column;color:#111;direction:rtl;overflow:hidden;font-family:'Cairo',sans-serif}
.mpg .ms-s{height:12px;background:linear-gradient(90deg,#111 0 30%,#DAAE57 30% 100%);flex:none}
.mpg .ms-in{flex:1;min-height:0;display:flex;flex-direction:column;padding:18px 30px 0;overflow:hidden}
.mpg .ms-hd{display:flex;align-items:center;gap:16px;padding-bottom:10px;border-bottom:4px solid #DAAE57;margin-bottom:10px;flex:none}
.mpg .ms-hd img{width:112px;height:112px;object-fit:contain}
.mpg .ms-co b{display:block;font-size:36px;font-weight:800;line-height:1.2}
.mpg .ms-co span{display:block;font-size:17px;font-weight:600;color:#444}
.mpg .ms-co .ms-web{display:block;font-style:normal;font-size:15px;font-weight:700;color:#9C7420;direction:ltr;text-align:right;margin-top:4px}
.mpg .ms-ti{margin-right:auto;text-align:center;border:2.5px solid #111;border-radius:10px;padding:8px 18px;min-width:220px}
.mpg .ms-ti h3{margin:-8px -18px 8px;font-size:26px;font-weight:800;color:#111;background:#DAAE57;padding:4px 0;border-radius:7px 7px 0 0}
.mpg .ms-ti div{font-size:15px;font-weight:700;line-height:1.7}
.mpg .ms-ti div span{color:#9C7420}
.mpg .ms-mini{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #DAAE57;padding-bottom:8px;margin-bottom:12px;font-weight:700;font-size:15px;flex:none}
.mpg .ms-mini b{font-size:20px;font-weight:800}
.mpg .ms-cu{background:#FBF5E6;border-right:6px solid #DAAE57;border-radius:6px;padding:10px 16px;margin-bottom:14px;font-size:16px;display:flex;justify-content:space-between;align-items:center;flex:none}
.mpg .ms-cu b{font-size:22px;font-weight:800;margin-right:8px}
.mpg .ms-cu i{font-style:normal;font-weight:700;color:#9C7420;font-size:15px}
.mpg table{width:100%;border-collapse:collapse;font-size:17px;table-layout:fixed;flex:none}
.mpg th{background:#F4E6C2;color:#111;padding:7px 3px;font-weight:800;font-size:16px;text-align:center;border:1px solid #D9C79A;border-bottom:2px solid #DAAE57}
.mpg td{padding:3px 4px;text-align:center;border:1px solid #CBBE9B;word-wrap:break-word;vertical-align:middle;line-height:1.3;font-weight:600}
.mpg td.ms-b{background:#F7F2E4 !important;border-inline-start:2px solid #9C7420;direction:ltr;font-weight:800;font-size:17px}
.mpg td.ms-l{text-align:right;font-weight:600}
.mpg td.ms-dt{white-space:nowrap;font-size:15.5px;font-weight:700}
.mpg td:first-child{white-space:nowrap}
.mpg tr:nth-child(even) td{background:#FBF5E6}
.mpg tr.ms-op td{background:#EFE6CF;font-weight:800}
.mpg tr.ms-pay td{background:#DDF1E3;color:#14632C;font-weight:800;border-bottom-color:#B9DFC4}
.mpg tr.ms-ret td{background:#FFF1E0;color:#8A4B00}
.mpg tr.ms-bnc td{background:#FDE3E1;color:#B3261E;font-weight:800}
.mpg td.ms-n{direction:ltr;font-weight:800;font-size:16.5px}
.mpg td.ms-q{font-weight:700;font-size:15.5px}
.mpg td small.ms-rf{display:block;font-size:13.5px;color:#9C7420;font-weight:700;line-height:1.2}
.mpg tr.ms-it td{background:#fff !important;font-weight:600;font-size:15.5px}.mpg tr.ms-it td.ms-l{padding-right:18px}
.mpg tr.ms-it.ms-fi td{border-top:2px solid #9C7420}
.mpg tr.ms-is td{background:#F3EAD3 !important;font-weight:800;border-bottom:2px solid #9C7420}
.mpg .ms-tot{display:flex;gap:12px;align-items:stretch;margin-top:10px;flex:none}
.mpg .ms-tot .ms-wd{flex:1;border:2px solid #CBBE9B;border-radius:8px;padding:5px 12px;background:#FBF5E6;display:flex;flex-direction:column;justify-content:center}
.mpg .ms-tot .ms-wd span{font-size:13px;font-weight:700;color:#777}.mpg .ms-tot .ms-wd b{font-size:15.5px;font-weight:800}
.mpg .ms-sum{width:360px;flex:none}
.mpg .ms-sum .ms-f{display:flex;justify-content:space-between;align-items:center;background:#111;color:#DAAE57;padding:10px 14px;border-radius:8px;font-size:18px;font-weight:800;height:100%;box-sizing:border-box}
.mpg .ms-sum .ms-f b{font-size:26px;color:#fff;direction:ltr;font-weight:800}
.mpg .ms-gen{text-align:center;font-size:12.5px;font-weight:600;color:#888;padding:4px 30px;flex:none}
.mpg .ms-ft{display:flex;justify-content:space-between;align-items:center;background:#111;color:#DAAE57;padding:8px 30px;font-size:14px;font-weight:700;flex:none}
.mpg .ms-ft .ms-web{color:#fff;direction:ltr}`;
  const COLS = [12.5, 23.5, 14, 10.5, 13, 11.5, 15];
  function build(a, s) {
    let box = q('#mstR');
    if (!box) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); box = document.createElement('div'); box.id = 'mstR'; box.className = 'noei'; document.body.appendChild(box); }
    box.innerHTML = '';
    const issued = Date.now(), per = `من ${dd(s.from)} إلى ${dd(s.to)}`;
    const gen = `صدر هذا الكشف إلكترونياً من نظام فلاش أون بتاريخ ${dd(isoOf(issued))} الساعة ${tmOf(issued)}`;
    const shell = first => {
      const pg = document.createElement('div'); pg.className = 'mpg';
      pg.innerHTML = `<div class="ms-s"></div><div class="ms-in">` + (first
        ? `<div class="ms-hd"><img src="icons/logo-pdf.jpg" alt=""><div class="ms-co"><b>فلاش أون</b><span>لصناعة الخراطيم والكابلات الكهربائية</span><i class="ms-web" data-url="https://${WEB}">🌐 ${WEB}</i></div>
           <div class="ms-ti"><h3>كشف حساب</h3><div>تاريخ الإصدار: <span>${dd(isoOf(issued))}</span></div><div>الفترة: <span>${ex(per)}</span></div></div></div>
           <div class="ms-cu"><span>السادة / <b>${ex(a.name)}</b></span>${a.sup ? '<i>مورد</i>' : ''}</div>`
        : `<div class="ms-mini"><b>فلاش أون</b><span>كشف حساب — ${ex(a.name)} — ${ex(per)}</span></div>`) +
        `</div><div class="ms-gen">${gen}</div><div class="ms-ft"><span>عالم متكامل من احتياجاتك الكهربائية</span><span class="ms-web" data-url="https://${WEB}">${WEB}</span><span class="ms-pn"></span></div>`;
      box.appendChild(pg);
      return {pg, inn: pg.querySelector('.ms-in')};
    };
    const over = (inn, el, m = 16) => el.getBoundingClientRect().bottom > inn.getBoundingClientRect().bottom - m;
    const mkTable = () => { const t = document.createElement('table'); t.innerHTML = `<colgroup>${COLS.map(w => `<col style="width:${w}%">`).join('')}</colgroup>
      <thead><tr><th>التاريخ</th><th>البيان</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th>المدفوع</th><th>الرصيد</th></tr></thead><tbody></tbody>`; return t; };
    const balCell = b => `<td class="ms-b">${fP(b * s.sg)}</td>`;
    let pg = shell(true), tbl = mkTable(); pg.inn.appendChild(tbl);
    const put = (cls, html, d) => {
      const tr = document.createElement('tr'); tr.className = cls; tr.innerHTML = html; if (d) tr.dataset.d = d;
      tbl.tBodies[0].appendChild(tr);
      if (over(pg.inn, tr) && tbl.tBodies[0].rows.length > 1) {
        tr.remove(); pg = shell(false); tbl = mkTable(); pg.inn.appendChild(tbl);
        if (tr.dataset.d && !tr.cells[0].textContent) tr.cells[0].textContent = tr.dataset.d;
        tbl.tBodies[0].appendChild(tr);
      }
    };
    const nums = (gd, pd) => `<td class="ms-n">${gd ? fP(gd) : ''}</td><td class="ms-n">${pd ? fP(pd) : ''}</td>`;
    const qp = r => `<td class="ms-q">${ex(r.qty || '')}</td><td class="ms-n">${r.price ? fP(r.price) : ''}</td>`;
    put('ms-op', `<td class="ms-dt">${dd(s.from)}</td><td class="ms-l">رصيد أول المدة</td><td></td><td></td><td></td><td></td>${balCell(s.open)}`);
    const cnt = new Map(); s.rows.forEach(r => r.g && cnt.set(r.g, (cnt.get(r.g) || 0) + 1));
    let g = null;
    s.rows.forEach(r => {
      if (r.g && cnt.get(r.g) > 1) {
        const first = !g || g.id !== r.g;
        if (first) g = {id: r.g, left: cnt.get(r.g), gd: 0, pd: 0, ret: r.k === 'ret'};
        put('ms-it' + (first ? ' ms-fi' : '') + (r.k === 'ret' ? ' ms-ret' : ''), `<td class="ms-dt">${first ? dd(r.d) : ''}</td><td class="ms-l">${ex(String(r.desc).replace(/^مرتجع: /, ''))}</td>${qp(r)}${nums(r.gd, r.pd)}<td></td>`, dd(r.d));
        g.gd += r.gd; g.pd += r.pd;
        if (!--g.left) { const net = g.gd - g.pd; put('ms-is', `<td></td><td class="ms-l" colspan="3">${g.ret ? 'إجمالي المرتجع' : 'إجمالي الفاتورة'}</td>${nums(net > 0 ? net : 0, net < 0 ? -net : 0)}${balCell(r.run)}`); g = null; }
        return;
      }
      put(r.k ? 'ms-' + r.k : '', `<td class="ms-dt">${dd(r.d)}</td><td class="ms-l">${ex(r.desc)}${r.ref ? `<small class="ms-rf">${ex(r.ref)}</small>` : ''}</td>${qp(r)}${nums(r.gd, r.pd)}${balCell(r.run)}`);
    });
    if (!s.rows.length) put('', `<td colspan="7">لا توجد حركات خلال هذه الفترة</td>`);
    const v = s.close * s.sg, lbl = !v ? 'الرصيد' : (v > 0) !== !!a.sup ? 'الرصيد المستحق عليكم' : 'الرصيد المستحق لكم';
    const tot = document.createElement('div'); tot.className = 'ms-tot';
    tot.innerHTML = `<div class="ms-wd"><span>المبلغ بالحروف</span><b>${words(v)}</b></div><div class="ms-sum"><div class="ms-f"><span>${lbl}</span><b>${fP(Math.abs(v))} <small style="font-size:15px;color:#DAAE57">${CUR}</small></b></div></div>`;
    pg.inn.appendChild(tot); if (over(pg.inn, tot)) { tot.remove(); pg = shell(false); pg.inn.appendChild(tot); }
    const pages = [...box.children];
    pages.forEach((x, i) => x.querySelector('.ms-pn').textContent = `صفحة ${i + 1} من ${pages.length}`);
    return pages;
  }

  /* أداة الـ PDF بتتحمّل وقت الحاجة بس (نفس ملفات الحسابات) */
  let libsP = null;
  const libs = () => window.jspdf && window.html2canvas ? Promise.resolve() : libsP = libsP || Promise.all(['lib/html2canvas.min.js', 'lib/jspdf.umd.min.js'].map(src => new Promise((ok, no) => {
    const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = () => no(new Error('pdf')); document.head.appendChild(sc); }))).catch(e => { libsP = null; throw e; });
  async function makePdf(a, s) {
    await libs();
    await Promise.all(['400', '600', '700', '800'].map(w => document.fonts.load(w + ' 16px Cairo', 'نص عربي 123abc'))).catch(() => {});
    const pages = build(a, s);
    await Promise.all([...q('#mstR').querySelectorAll('img')].map(i => i.decode ? i.decode().catch(() => {}) : 0));
    await document.fonts.ready;
    const {jsPDF} = window.jspdf, doc = new jsPDF({unit: 'mm', format: 'a4', orientation: 'portrait', compress: true}), imgs = [];
    for (let i = 0; i < pages.length; i++) {
      const pr = pages[i].getBoundingClientRect(), k = 210 / 794;
      const links = [...pages[i].querySelectorAll('[data-url]')].map(el => { const r = el.getBoundingClientRect(); return [(r.left - pr.left) * k, (r.top - pr.top) * k, r.width * k, r.height * k, el.dataset.url]; });
      const cv = await html2canvas(pages[i], {scale: 2, backgroundColor: '#fff', logging: false, useCORS: true, width: 794, height: 1123, windowWidth: 794});
      const url = cv.toDataURL('image/jpeg', 0.9); if (i < 6) imgs.push(url);
      if (i) doc.addPage();
      doc.addImage(url, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      links.forEach(([x, y, w, h, u]) => doc.link(x, y, w, h, {url: u}));
      cv.width = cv.height = 0;
    }
    q('#mstR').innerHTML = '';
    const name = String(a.name).replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.pdf';
    return {blob: doc.output('blob'), imgs, name, pages: pages.length};
  }
  function dl(blob, name) { const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(l.href), 60000); }
  async function share(res) {
    const data = {files: [new File([res.blob], res.name, {type: 'application/pdf'})]};
    if (!(navigator.canShare && navigator.canShare(data))) { dl(res.blob, res.name); toast('الموبايل ده مش بيبعت على طول. الملف اتنزّل، ابعته من واتساب بإيدك.', 6000); return; }
    try { await navigator.share(data); }
    catch (e) {
      if (e.name === 'AbortError') return;
      if (e.name === 'NotAllowedError') {
        modal(`<p>الكشف جاهز. دوس علشان تبعته:</p><button class="big b-cash" id="mstGo" type="button">📲 ابعته واتساب</button><button class="big b-home" id="mstNo" type="button">رجوع</button>`);
        q('#mstNo').onclick = closeModal;
        q('#mstGo').onclick = async () => { try { await navigator.share(data); closeModal(); } catch (x) { closeModal(); if (x.name !== 'AbortError') dl(res.blob, res.name); } };
        return;
      }
      dl(res.blob, res.name); toast('حصلت مشكلة في الإرسال، الملف اتنزّل بداله.', 5000);
    }
  }

  /* النافذة: الفترة (الشهر ده / الشهر اللي فات / آخر 3 شهور / من – إلى) والزرارين */
  const addM = (iso, n) => { const [y, m] = iso.split('-').map(Number), d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-01`; };
  const endM = iso => { const [y, m] = iso.split('-').map(Number); return `${y}-${p2(m)}-${p2(new Date(y, m, 0).getDate())}`; };
  function open(a) {
    libs().catch(() => {});
    const t = isoOf(Date.now()), min = a.sf || t, cl = x => x < min ? min : x;
    const P = {m: [cl(addM(t, 0)), t], p: [cl(addM(t, -1)), endM(addM(t, -1))], a: [min, t]};
    let mode = 'a';
    modal(`<h3>📄 كشف حساب<small>${ex(a.name)}</small></h3>
      <div class="seg" id="mstP" style="--n:4">${[['m', 'الشهر ده'], ['p', 'اللي فات'], ['a', '3 شهور'], ['r', 'من – إلى']].map(([k, l]) => `<button type="button" data-k="${k}" class="${k === mode ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="mstR2" style="display:none;gap:8px;grid-template-columns:1fr 1fr"><input class="inp2" type="date" id="mstF" min="${min}" max="${t}" value="${min}"><input class="inp2" type="date" id="mstT" min="${min}" max="${t}" value="${t}"></div>
      <p class="hint" id="mstH"></p>
      <button class="big b-cash" id="mstS" type="button">📲 ابعت الكشف واتساب</button>
      <button class="big b-home" id="mstV" type="button">👁 شوف الورقة الأول</button>
      <button class="lnk" id="mstX" type="button">رجوع</button>`);
    const per = () => mode === 'r' ? [cl(q('#mstF').value || min), q('#mstT').value || t] : P[mode];
    const hint = () => {
      const [f, to] = per(), s = stmtOf(a, f, to), v = s.close * s.sg;
      q('#mstH').innerHTML = f > to ? 'التاريخ الأول لازم يبقى قبل التاني' : `من ${dd(f)} لـ ${dd(to)} · ${s.rows.length} ${s.rows.length === 1 ? 'سطر' : 'سطور'} · الرصيد في الآخر <b class="money">${fP(Math.abs(v))}</b> ${!v ? '' : (v > 0) !== !!a.sup ? 'عليه' : 'ليه'}<br>الكشف بيوصل لحد ${dd(min)} بس (آخر 3 شهور).`;
    };
    q('#mstP').querySelectorAll('button').forEach(b => b.onclick = () => {
      mode = b.dataset.k; q('#mstP').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      q('#mstR2').style.display = mode === 'r' ? 'grid' : 'none'; hint();
    });
    q('#mstF').onchange = q('#mstT').onchange = hint;
    hint();
    const go = async how => {
      const [f, to] = per(); if (f > to) return toast('التاريخ الأول لازم يبقى قبل التاني');
      const s = stmtOf(a, f, to);
      modal('<p style="text-align:center">جاري تجهيز الكشف…</p>');
      let res;
      try { res = await makePdf(a, s); }
      catch (e) { closeModal(); console.error(e); toast('مقدرتش أجهز الكشف. اتأكد من النت وجرب تاني.', 4000); return; }
      if (how === 'share') { closeModal(); return share(res); }
      modal(`<div style="max-height:62vh;overflow:auto">${res.imgs.map(u => `<img src="${u}" alt="" style="width:100%;display:block;margin-bottom:6px">`).join('')}</div>${res.pages > res.imgs.length ? `<p class="hint">(بيعرض أول ${res.imgs.length} صفحات من ${res.pages})</p>` : ''}
        <button class="big b-cash" id="mstS2" type="button">📲 ابعته واتساب</button><button class="lnk" id="mstX2" type="button">رجوع</button>`);
      q('#mstS2').onclick = () => { closeModal(); share(res); };
      q('#mstX2').onclick = () => open(a);
    };
    q('#mstS').onclick = () => go('share');
    q('#mstV').onclick = () => go('view');
    q('#mstX').onclick = closeModal;
  }
  window.MkStmt = {open, stmtOf, allRows, build};
})();
