/* أيقونات مرسومة بدل الإيموجي (الحسابات والسوق والدفتر).
   الإيموجي بيترسم بشكل مختلف على كل موبايل، فبنلفّه في <i-c class="ei-اسم"> (عنصر خاص مش span، علشان ميتأثرش بأي ستايل مكتوب للـ span) وبنرسم مكانه أيقونة خطوط بلون الكلام.
   الإيموجي نفسه بيفضل جواه (مخفي)، فالكلام (textContent) زي ما هو بالظبط. ورقة الـ PDF (#render) واختيارات <select> مبتتلمسش.
   الشغل كله في الشاشة بس: مبيلمسش أي بيانات. */
(() => {
  const S = 'M12 3 2 21h20z', C = '<circle cx="12" cy="12" r="9"/>';
  const I = {
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
    outbox: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/>',
    ret: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    clock: C + '<path d="M12 7v5l3 2"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.3"/>',
    factory: '<path d="M2 20V9l6 4V9l6 4V5h6v15z"/><path d="M6 17h2M11 17h2M16 17h2"/>',
    store: '<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
    pen: '<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    pin: '<path d="M12 17v5"/><path d="M5 17h14l-2-4V5h1V3H6v2h1v8z"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    coins: '<circle cx="9" cy="9" r="6"/><path d="M18.1 10.4a6 6 0 1 1-7.7 7.7"/>',
    clip: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    pay: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 9v6M9 12l3 3 3-3"/>',
    fuel: '<path d="M3 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M2 22h14M6 7h6"/><path d="M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
    swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    ban: C + '<path d="M5.6 5.6l12.8 12.8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    warn: '<path d="' + S + '"/><path d="M12 10v5M12 18h.01"/>',
    no: C + '<path d="M15 9l-6 6M9 9l6 6"/>',
    yes: C + '<path d="M8 12l3 3 5-6"/>',
    sync: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    sort: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    dot: '',
  };
  const M = {'💵': 'cash', '🧾': 'receipt', '📥': 'inbox', '📤': 'outbox', '↩': 'ret', '💾': 'save', '⏳': 'clock', '⏰': 'clock', '🔒': 'lock', '🔓': 'unlock',
    '🏭': 'factory', '🏪': 'store', '✏': 'pen', '✎': 'pen', '📝': 'pen', '📌': 'pin', '📲': 'send', '🔍': 'search', '🔎': 'search', '📄': 'doc', '⚙': 'gear',
    '👥': 'users', '🔔': 'bell', '📊': 'chart', '🔗': 'link', '⬆': 'up', '⬇': 'down', '💰': 'coins', '📋': 'clip', '🛠': 'tool', '💸': 'pay', '⛽': 'fuel',
    '🤝': 'swap', '🗑': 'trash', '⚡': 'bolt', '⛔': 'ban', '☀': 'sun', '🌙': 'moon', '🚚': 'truck', '👁': 'eye', '🗄': 'archive', '📅': 'cal', '📦': 'box',
    '✂': 'cut', '⚠': 'warn', '❌': 'no', '✅': 'yes', '🔄': 'sync', '↕': 'sort', '🔴': 'dot ei-r', '🟡': 'dot ei-y', '📩': 'msg'};
  const url = d => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`)}")`;
  const dot = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/></svg>')}")`;
  const css = `i-t{display:inline}i-c{display:inline-block;width:1em;height:1em;vertical-align:-.14em;overflow:hidden;white-space:nowrap;text-indent:3em;line-height:1;
      background:currentColor;-webkit-mask:var(--ei) center/contain no-repeat;mask:var(--ei) center/contain no-repeat}
    i-c.ei-no{background:var(--red)}.ei-yes{background:var(--green)}.ei-dot.ei-r{background:var(--red)}.ei-dot.ei-y{background:var(--gold)}.ei-dot{--ei:${dot}}
    ${Object.entries(I).filter(([, d]) => d).map(([k, d]) => `.ei-${k}{--ei:${url(d)}}`).join('\n')}`;
  const st = document.createElement('style'); st.id = 'eiCss'; st.textContent = css; (document.head || document.documentElement).appendChild(st);

  const keys = Object.keys(M).sort((a, b) => b.length - a.length);
  const src = '(?:' + keys.join('|') + ')️?';
  const has = new RegExp(src, 'u'), all = new RegExp(src, 'gu');
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|OPTION|OPTGROUP|SELECT|TITLE|INPUT|NOSCRIPT)$/;
  function fix(n) {
    const p = n.parentNode, v = n.nodeValue;
    if (!p || p.nodeType !== 1 || !v || !has.test(v)) return;
    if (SKIP.test(p.nodeName) || p.nodeName === 'I-C' || p.nodeName === 'I-T' || p.closest('#render,svg,select,.noei')) return;
    /* كله في عنصر واحد علشان لو الأب flex بـ gap الأيقونة والكلام ميتبعدوش عن بعض */
    const f = document.createElement('i-t'); let last = 0;
    for (const m of v.matchAll(all)) {
      if (m.index > last) f.appendChild(document.createTextNode(v.slice(last, m.index)));
      const s = document.createElement('i-c'); s.className = 'ei-' + M[m[0].replace('️', '')]; s.textContent = m[0]; s.setAttribute('aria-hidden', 'true');
      f.appendChild(s); last = m.index + m[0].length;
    }
    if (last < v.length) f.appendChild(document.createTextNode(v.slice(last)));
    p.replaceChild(f, n);
  }
  function scan(r) {
    if (r.nodeType === 3) return fix(r);
    if (r.nodeType !== 1 || SKIP.test(r.nodeName) || !has.test(r.textContent || '')) return;
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT), list = [];
    while (w.nextNode()) if (has.test(w.currentNode.nodeValue)) list.push(w.currentNode);
    list.forEach(fix);
  }
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') fix(m.target); else m.addedNodes.forEach(scan); } })
    .observe(document.documentElement, {childList: true, subtree: true, characterData: true});
  if (document.body) scan(document.body);
})();
