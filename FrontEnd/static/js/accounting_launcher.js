// ── مستخدم الجلسة ──
(async function() {
  try {
    const r = await fetch('/api/me/');
    const d = await r.json();
    if (d.success) {
      const name = d.name || d.username || 'مدير النظام';
      const role = d.roleName || d.role || 'الإدارة العامة';
      ['al-username'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = name; });
      ['al-user-role'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = role; });
      const mn = document.getElementById('al-menu-name'); if(mn) mn.textContent = name;
      const mr = document.getElementById('al-menu-role'); if(mr) mr.textContent = role;
      const fu = document.getElementById('al-footer-user'); if(fu) fu.textContent = name;
      const fr = document.getElementById('al-footer-role'); if(fr) fr.textContent = role;
    }
  } catch {}
})();

// ── الساعة ──
function alClock() {
  const now    = new Date();
  const days   = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const dateStr = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  const ct = document.getElementById('al-clock-top');
  const dt = document.getElementById('al-date-top');
  if (ct) ct.textContent = timeStr;
  if (dt) dt.textContent = dateStr;
}
alClock();
setInterval(alClock, 1000);

// ── Toast ──
let _alToastTimer;
function alToast(msg, type='info', icon='ℹ️') {
  const colors = { info:'#0D9488', success:'#16A34A', error:'#DC2626', warning:'#D97706' };
  const el = document.getElementById('al-toast');
  document.getElementById('al-toast-stripe').style.background = colors[type] || colors.info;
  document.getElementById('al-toast-icon').textContent   = icon;
  document.getElementById('al-toast-text').textContent   = msg;
  el.classList.add('show');
  clearTimeout(_alToastTimer);
  _alToastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── قوائم الهيدر (click toggle) ──
function toggleNavDd(el, event) {
  event.stopPropagation();
  const isOpen = el.classList.contains('dd-open');
  document.querySelectorAll('.al-nav-item.dd-open').forEach(i => i.classList.remove('dd-open'));
  if (!isOpen) el.classList.add('dd-open');
}
// إغلاق عند الضغط خارج القائمة
document.addEventListener('click', function() {
  document.querySelectorAll('.al-nav-item.dd-open').forEach(i => i.classList.remove('dd-open'));
});

// ── التنقل ──
const AL_ROUTES = {
  'customers':             '/accounts/customers/',
  'agents':                null,
  'transit':               null,
  'customers':             null,
  'cost-center':           null,
  'trash':                 null,
  'safe-movement':         null,
  'center-profits':        null,
  'transfer-count':        null,
  'entry-from-to':         null,
  'safes':                 null,
  'payment-voucher':       '/accounts/voucher/payment/',
  'receipt-voucher':       '/accounts/voucher/receipt/',
  'cut-voucher':           '/accounts/voucher/cut/',
  'exchange':              '/accounts/exchange/',
  'close-open':            '/accounts/period/close/',
  'simple-entry':          '/accounts/entry/simple/',
  'advanced-entry':        null,
  'new-entry':             '/accounts/entry/new/',
  /* 'unreceived-transfers' moved to AL_PANELS */
  /* 'received-transfers' moved to AL_PANELS */
  /* 'all-transfers' moved to AL_PANELS */
  /* 'account-statement' moved to AL_PANELS */
  'cost-center':           '/accounts/cost-center/',
  'debt-limit':            '/accounts/debt-limit/',
  'new-movement':          '/accounts/movement/new/',
  'cut-transfer':          '/accounts/transfer/cut/',
  'sawa-transfer':         '/accounts/transfer/sawa/',
  'send-credit':           '/accounts/credit/send/',
  /* 'internal-credit' moved to AL_PANELS */
  /* 'external-credit' moved to AL_PANELS */
  'vouchers':              '/accounts/vouchers/',
  'delivery-entry':        '/accounts/delivery/entry/',
  /* 'delivered' moved to AL_PANELS */
  /* 'edit-packages' moved to AL_PANELS */
  /* 'cut-prices'   moved to AL_PANELS */
  /* 'cut-prices' moved to AL_PANELS */
  /* 'advanced-search' moved to AL_PANELS */
  /* 'voucher-verify'  moved to AL_PANELS */
  'chart':                 '/accounts/chart/',
  'work-monitor':          '/accounts/monitor/',
  'whatsapp':              null,
};

// ── خريطة الأيقونات التي تفتح لوحة داخلية ──
const AL_PANELS = {
  'safes': {
    title: 'جميع الصناديق',
    color: '#16A34A',
    section: 'sp-safes',
    url:    '/accounting/safes/',
    load:   () => spLoadSafes(),
  },
  'agents': {
    title: 'الوكلاء',
    color: '#2563EB',
    section: 'sp-agents',
    url:    '/accounting/agents/',
    load:   () => agLoadAgents(),
  },
  'transit': {
    title: 'العوابر',
    color: '#D97706',
    section: 'sp-transit',
    url:    '/accounting/transit/',
    load:   () => trLoad(),
  },
  'customers': {
    title: 'العملاء',
    color: '#EA580C',
    section: 'sp-customers',
    url:    '/accounting/customers/',
    load:   () => cuLoad(),
  },
  'cost-center': {
    title: 'المراكز',
    color: '#7C3AED',
    section: 'sp-cost-center',
    url:    '/accounting/cost-center/',
    load:   () => ccLoad(),
  },
  'trash': {
    title: 'المراكز المحذوفة',
    color: '#DC2626',
    section: 'sp-trash',
    url:    '/accounting/trash/',
    load:   () => trashLoad(),
  },
  'safe-movement': {
    title: 'حركة الصناديق',
    color: '#0D9488',
    section: 'sp-safe-movement',
    url:    '/accounting/safe-movement/',
    load:   () => smLoad(),
  },
  'center-profits': {
    title: 'أرباح من المراكز',
    color: '#D97706',
    section: 'sp-center-profits',
    url:    '/accounting/center-profits/',
    load:   () => cpInit(),
  },
  'transfer-count': {
    title: 'عدد حوالات المراكز',
    color: '#0891B2',
    section: 'sp-transfer-count',
    url:    '/accounting/transfer-count/',
    load:   () => tcInit(),
  },
  'entry-from-to': {
    title: 'قيد جديد',
    color: '#7C3AED',
    section: 'sp-entry-from-to',
    url:    '/accounting/entry-from-to/',
    load:   () => efLoad(),
  },
  'advanced-entry': {
    title: 'قيد متقدم',
    color: '#0891B2',
    section: 'sp-advanced-entry',
    url:    '/accounting/advanced-entry/',
    load:   () => aeLoad(),
  },
  'settlement-move': {
    title: 'حركة تسوية',
    color: '#D97706',
    section: 'sp-settlement-move',
    url:    '/accounting/settlement-move/',
    load:   () => sm2Load(),
  },
  'opening-entry': {
    title: 'قيد افتتاحي',
    color: '#0891B2',
    section: 'sp-opening-entry',
    url:    '/accounting/opening-entry/',
    load:   () => oeLoad(),
  },
  'receipt-voucher': {
    title: 'سند قبض',
    color: '#DC2626',
    section: 'sp-receipt-voucher',
    url:    '/accounting/receipt-voucher/',
    load:   () => rvLoad(),
  },
  'payment-voucher': {
    title: 'سند دفع',
    color: '#7C3AED',
    section: 'sp-payment-voucher',
    url:    '/accounting/payment-voucher/',
    load:   () => pvLoad(),
  },
  'exchange': {
    title: 'تبديل عملة',
    color: '#0891B2',
    section: 'sp-exchange',
    url:    '/accounting/exchange/',
    load:   () => cxLoad(),
  },
  'outgoing-move': {
    title: 'حركة صادرة جديدة',
    color: '#2563EB',
    section: 'sp-outgoing-move',
    url:    '/accounting/outgoing-move/',
    load:   () => otLoad(),
  },
  'new-credit': {
    title: 'اعتماد جديد',
    color: '#16A34A',
    section: 'sp-new-credit',
    url:    '/accounting/new-credit/',
    load:   () => ncLoad(),
  },
  'ops-monitor': {
    title: 'مراقبة العمليات',
    color: '#1E3A5F',
    section: 'sp-ops-monitor',
    url:    '/accounting/ops-monitor/',
    load:   () => omLoad(),
  },
  'entry-audit': {
    title: 'تدقيق القيود',
    color: '#1E3A5F',
    section: 'sp-entry-audit',
    url:    '/accounting/entry-audit/',
    load:   () => eaInit(),
  },
  'trial-balance': {
    title: 'ميزان المراجعة',
    color: '#1E3A5F',
    section: 'sp-trial-balance',
    url:    '/accounting/trial-balance/',
    load:   () => tbInit(),
  },
  'profit-per-safe': {
    title: 'أرباح من كل صندوق',
    color: '#D97706',
    section: 'sp-profit-per-safe',
    url:    '/accounting/profit-per-safe/',
    load:   () => ppsInit(),
  },
  'balance-report': {
    title: 'تقرير الأرصدة',
    color: '#0D9488',
    section: 'sp-balance-report',
    url:    '/accounting/balance-report/',
    load:   () => brLoad(),
  },
  'cut-centers': {
    title: 'مراكز القطع',
    color: '#EA580C',
    section: 'sp-cut-centers',
    url:    '/accounting/cut-centers/',
    load:   () => cutLoad(),
  },
  'profit-transfer': {
    title: 'ترحيل الأرباح',
    color: '#7C3AED',
    section: 'sp-profit-transfer',
    url:    '/accounting/profit-transfer/',
    load:   () => ptLoad(),
  },
  'account-statement': {
    title: 'كشف حساب',
    color: '#4338CA',
    section: 'sp-account-statement',
    url:    '/accounting/account-statement/',
    load:   () => asInit(),
  },
  'all-entries': {
    title: 'جميع القيود',
    color: '#1A3D5C',
    section: 'sp-all-entries',
    url:    '/accounting/all-entries/',
    load:   () => enInit(),
  },
  'losing-moves': {
    title: 'حركات خاسرة',
    color: '#DC2626',
    section: 'sp-losing-moves',
    url:    '/accounting/losing-moves/',
    load:   () => lmInit(),
  },
  'entries': {
    title: 'القيود',
    color: '#1A3D5C',
    section: 'sp-entries',
    url:    '/accounting/entries/',
    load:   () => jrnInit(),
  },
  'internal-credit': {
    title: 'اعتمادات داخلية',
    color: '#0369A1',
    section: 'sp-internal-credit',
    url:    '/accounting/internal-credit/',
    load:   () => crInit('internal'),
  },
  'external-credit': {
    title: 'اعتمادات خارجية',
    color: '#0F766E',
    section: 'sp-external-credit',
    url:    '/accounting/external-credit/',
    load:   () => crInit('external'),
  },
  'all-transfers': {
    title: 'جميع الحوالات',
    color: '#1A3D5C',
    section: 'sp-all-transfers',
    url:    '/accounting/all-transfers/',
    load:   () => atInit(),
  },
  'received-transfers': {
    title: 'الحوالات المستلمة',
    color: '#16A34A',
    section: 'sp-received-transfers',
    url:    '/accounting/received-transfers/',
    load:   () => rtInit(),
  },
  'unreceived-transfers': {
    title: 'حوالات غير مستلمة',
    color: '#D97706',
    section: 'sp-unreceived-transfers',
    url:    '/accounting/unreceived-transfers/',
    load:   () => utInit(),
  },
  'deleted-transfers': {
    title: 'الحوالات المحذوفة',
    color: '#DC2626',
    section: 'sp-deleted-transfers',
    url:    '/accounting/deleted-transfers/',
    load:   () => dtInit(),
  },
  'advanced-transfers': {
    title: 'حوالات متقدمة',
    color: '#6D28D9',
    section: 'sp-advanced-transfers',
    url:    '/accounting/advanced-transfers/',
    load:   () => advInit(),
  },
  'reserved-transfers': {
    title: 'الحوالات المحجوزة',
    color: '#0369A1',
    section: 'sp-reserved-transfers',
    url:    '/accounting/reserved-transfers/',
    load:   () => rsvInit(),
  },
  'delivery-internal': {
    title: 'حركات قيد التسليم - داخلي',
    color: '#0F766E',
    section: 'sp-delivery-internal',
    url:    '/accounting/delivery-internal/',
    load:   () => dlvLoad('internal'),
  },
  'delivery-external': {
    title: 'حركات قيد التسليم - خارجي',
    color: '#0F766E',
    section: 'sp-delivery-external',
    url:    '/accounting/delivery-external/',
    load:   () => dlvLoad('external'),
  },
  'delivered': {
    title: 'تم تسليمها',
    color: '#16A34A',
    section: 'sp-delivered',
    url:    '/accounting/delivered/',
    load:   () => deliveredInit(),
  },
  'deleted-entries': {
    title: 'قيود محذوفة نهائياً',
    color: '#DC2626',
    section: 'sp-deleted-entries',
    url:    '/accounting/deleted-entries/',
    load:   () => delEntInit(),
  },
  'edit-packages': {
    title: 'تعديل الباقات',
    color: '#0369A1',
    section: 'sp-edit-packages',
    url:    '/accounting/edit-packages/',
    load:   () => pkgInit(),
  },
  'cut-prices': {
    title: 'أسعار القص',
    color: '#7C3AED',
    section: 'sp-cut-prices',
    url:    '/accounting/cut-prices/',
    load:   () => ctpInit(),
  },
  'cut-distribution': {
    title: 'تفريق القص',
    color: '#0369A1',
    section: 'sp-cut-distribution',
    url:    '/accounting/cut-distribution/',
    load:   () => cdInit(),
  },
  'currencies-manage': {
    title: 'إدارة العملات',
    color: '#0F766E',
    section: 'sp-currencies-manage',
    url:    '/accounting/currencies/',
    load:   () => cmInit(),
  },
  'users-manage': {
    title: 'إدارة المستخدمين',
    color: '#1D4ED8',
    section: 'sp-users-manage',
    url:    '/system/users/',
    load:   () => umInit(),
  },
  'advanced-search': {
    title: 'البحث المتقدم',
    color: '#15803D',
    section: 'sp-advanced-search',
    url:    '/accounting/advanced-search/',
    load:   () => bsInit(),
  },
  'voucher-verify': {
    title: 'مصادقة القيود',
    color: '#1D4ED8',
    section: 'sp-voucher-verify',
    url:    '/accounting/voucher-verify/',
    load:   () => vvInit(),
  },
  'advanced-entry-ops': {
    title: 'عملات القيد المتقدم',
    color: '#162455',
    section: 'sp-advanced-entry-ops',
    url:    '/accounting/advanced-entry-ops/',
    load:   () => aeoInit(),
  },
  'events-log': {
    title: 'سجل الأحداث',
    color: '#C2410C',
    section: 'sp-events-log',
    url:    '/accounting/events-log/',
    load:   () => elInit(),
  },
};

function alGo(key) {
  // هل لها لوحة داخلية؟
  if (AL_PANELS[key]) {
    openSubPanel(key);
    return;
  }
  const url = AL_ROUTES[key];
  if (url) {
    window.location.href = url;
  } else {
    alToast('🚧 هذه الوحدة قيد الإنشاء', 'warning', '🚧');
  }
}

// ── فتح اللوحة الداخلية ──
function openSubPanel(key) {
  const cfg = AL_PANELS[key];
  if (!cfg) return;
  document.querySelectorAll('.sp-section').forEach(s => s.style.setProperty('display', 'none', 'important'));
  const sec = document.getElementById(cfg.section);
  if (sec) { sec.style.removeProperty('display'); sec.style.display = 'block'; }
  document.getElementById('sp-dot').style.background = cfg.color;
  document.getElementById('sp-title').textContent     = cfg.title;
  document.getElementById('sp-count').textContent     = '';
  const panel = document.getElementById('al-sub-panel');
  panel.removeAttribute('hidden');
  panel.style.setProperty('display', 'block', 'important');
  setTimeout(() => panel.scrollIntoView({behavior:'smooth', block:'nearest'}), 80);
  // لا نغير الـ URL لتفادي 404 عند تحديث الصفحة
  cfg.load();
}

function closeSubPanel() {
  const panel = document.getElementById('al-sub-panel');
  panel.style.setProperty('display', 'none', 'important');
}

// عند الضغط على زر الرجوع في المتصفح
window.addEventListener('popstate', function(e) {
  const panel = document.getElementById('al-sub-panel');
  if (e.state && e.state.panel) {
    openSubPanel(e.state.panel);
  } else {
    panel.style.setProperty('display', 'none', 'important');
  }
});

// ══ الصناديق (القديم — محذوف، استُبدل بـ sf* أدناه) ══

// ══ الصناديق (sf*) — التصميم الجديد ══
let _sfAll = [], _sfFiltered = [], _sfSortCol = 'id', _sfSortAsc = true, _sfPage = 1;
let _sfCurrency = 'dollar';
const _sfHiddenCols = new Set();
const SF_CUR_LABELS = {
  dollar:'دولار', euro:'يورو', lira_tr:'ليرة تركية', shekel:'شيكل',
  dinar_jo:'دينار أردني', riyal_sa:'ريال سعودي', pound_eg:'جنيه مصري', dirham_ae:'درهم اماراتي',
};

function sfChangeCurrency() {
  const sel = document.getElementById('sf-currency');
  if (!sel) return;
  _sfCurrency = sel.value;
  const label = SF_CUR_LABELS[_sfCurrency] || _sfCurrency;
  const els = { net:'sf-th-net', us:'sf-th-us', them:'sf-th-them' };
  const texts = { net:`مقوم ${label}`, us:`${label} لنا`, them:`${label} علينا` };
  Object.entries(els).forEach(([k,id]) => { const e = document.getElementById(id); if(e) e.textContent = texts[k]; });
  const btns = { net:'sf-col-net', us:'sf-col-us', them:'sf-col-them' };
  Object.entries(btns).forEach(([k,id]) => { const e = document.getElementById(id); if(e) e.textContent = texts[k]; });
  sfRender(1);
}

function sfToggleCol(col) {
  const btn = document.getElementById('sf-col-' + col);
  if (_sfHiddenCols.has(col)) {
    _sfHiddenCols.delete(col);
    if (btn) btn.classList.remove('sf-col-hidden');
  } else {
    _sfHiddenCols.add(col);
    if (btn) btn.classList.add('sf-col-hidden');
  }
  sfRender(1);
}
function _sfColVis(col) { return !_sfHiddenCols.has(col); }

async function spLoadSafes() {
  document.getElementById('sf-tbody').innerHTML =
    '<tr><td colspan="8" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/cost-centers/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    _sfAll = list; _sfFiltered = [..._sfAll];
    sfRender(1);
  } catch {
    _sfAll = []; _sfFiltered = [];
    document.getElementById('sf-tbody').innerHTML =
      '<tr><td colspan="8" class="sp-empty">📭 لا توجد بيانات</td></tr>';
  }
}

function sfRender(p) {
  if (p !== undefined) _sfPage = p;
  const total   = _sfFiltered.length;
  const perPage = parseInt(document.getElementById('sf-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _sfPage = Math.min(Math.max(1, _sfPage), maxPage);
  const start = (_sfPage - 1) * perPage;
  const slice = _sfFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('sf-tbody');
  if (!tbody) return;

  // رؤوس الأعمدة
  const colMap = {id:'sfh-id',city:'sfh-city',name:'sfh-name',net:'sfh-net',us:'sfh-us',them:'sfh-them',debt:'sfh-debt',stmt:'sfh-stmt'};
  Object.entries(colMap).forEach(([k,hid]) => {
    const h = document.getElementById(hid);
    if (h) h.style.display = _sfColVis(k) ? '' : 'none';
  });

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="8" class="sp-empty">📭 لا توجد بيانات متاحة في الجدول</td></tr>';
    document.getElementById('sf-showing').textContent = '—';
    document.getElementById('sf-pages').innerHTML = '';
    document.getElementById('sf-prev').disabled = true;
    document.getElementById('sf-next').disabled = true;
    return;
  }

  const fmt = v => Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const cur = _sfCurrency;

  tbody.innerHTML = slice.map((m) => {
    const usVal   = parseFloat(m[cur]) || 0;
    const themVal = 0;
    const netVal  = usVal - themVal;
    const debtVal = netVal < 0 ? Math.abs(netVal) : 0;
    const isDebt  = netVal < 0;
    const netColor  = netVal >= 0 ? '#16A34A' : '#DC2626';
    const debtColor = isDebt ? '#DC2626' : '#94A3B8';
    return `<tr>
      ${_sfColVis('id')   ? `<td style="color:#94A3B8;font-size:11px">${m.id}</td>` : ''}
      ${_sfColVis('city') ? `<td style="color:#475569">${m.city||'—'}</td>` : ''}
      ${_sfColVis('name') ? `<td style="color:#0F172A;font-weight:700">${m.name||'—'}</td>` : ''}
      ${_sfColVis('net')  ? `<td style="color:${netColor};font-weight:700;font-variant-numeric:tabular-nums">${fmt(netVal)}</td>` : ''}
      ${_sfColVis('us')   ? `<td style="color:#16A34A;font-weight:600;font-variant-numeric:tabular-nums">${fmt(usVal)}</td>` : ''}
      ${_sfColVis('them') ? `<td style="color:#DC2626;font-weight:600;font-variant-numeric:tabular-nums">${fmt(themVal)}</td>` : ''}
      ${_sfColVis('debt') ? `<td style="color:${debtColor};font-weight:${isDebt?'700':'400'};font-variant-numeric:tabular-nums">${isDebt?fmt(debtVal):'—'}</td>` : ''}
      ${_sfColVis('stmt') ? `<td style="text-align:center"><button onclick="sfViewStatement(${m.id},'${(m.name||'').replace(/'/g,'')}')" style="background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;border-radius:5px;padding:3px 12px;cursor:pointer;font-size:11px;font-family:inherit;font-weight:700">كشف</button></td>` : ''}
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('sf-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pg = document.getElementById('sf-pages');
  pg.innerHTML = '';
  const maxV = 7;
  let s = Math.max(1, _sfPage-3), e2 = Math.min(maxPage, s+maxV-1);
  if (e2-s < maxV-1) s = Math.max(1, e2-maxV+1);
  for (let i=s; i<=e2; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i===_sfPage?' active':'');
    btn.textContent = i;
    btn.onclick = () => sfRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('sf-prev').disabled = _sfPage <= 1;
  document.getElementById('sf-next').disabled = _sfPage >= maxPage;
}

function sfFilter(q) {
  const t = q.trim().toLowerCase();
  _sfFiltered = !t ? [..._sfAll] : _sfAll.filter(m =>
    (m.name||'').toLowerCase().includes(t) || (m.city||'').toLowerCase().includes(t)
  );
  sfRender(1);
}

function sfSort(col) {
  if (_sfSortCol === col) _sfSortAsc = !_sfSortAsc;
  else { _sfSortCol = col; _sfSortAsc = true; }
  document.querySelectorAll('.sf-sa').forEach(a => a.textContent = '↕');
  const cur = _sfCurrency;
  const colToField = { id:'id', city:'city', name:'name', net:cur, us:cur, them:'them', debt:'debt' };
  const field = colToField[col] || col;
  const el = document.getElementById('sf-sa-' + col); if (el) el.textContent = _sfSortAsc ? '↑' : '↓';
  _sfFiltered.sort((a,b) => {
    const av = a[field]??'', bv = b[field]??'';
    if (typeof av === 'number' || !isNaN(av)) return _sfSortAsc ? av-bv : bv-av;
    return _sfSortAsc ? String(av).localeCompare(String(bv),'ar') : String(bv).localeCompare(String(av),'ar');
  });
  sfRender(1);
}

function sfExportCSV() {
  const cur = _sfCurrency;
  const label = SF_CUR_LABELS[cur] || cur;
  const hdr = ['#','المدينة','الاسم',`صافي ${label}`,`${label} لنا`,`${label} علينا`,'المديونية'].join(',');
  const rows = _sfFiltered.map(m => {
    const us=m[cur]||0, net=us, debt=net<0?Math.abs(net):0;
    return [m.id, m.city||'', m.name||'', net, us, 0, debt].join(',');
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿'+hdr+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8;'}));
  a.download = 'الصناديق.csv'; a.click();
}
function sfExportExcel() { sfExportCSV(); }
function sfExportPDF()   { window.print(); }
function sfCopyTable() {
  const cur = _sfCurrency, label = SF_CUR_LABELS[cur]||cur;
  const hdr = ['#','المدينة','الاسم',`صافي ${label}`,`${label} لنا`,`${label} علينا`,'المديونية'].join('\t');
  const rows = _sfFiltered.map(m => { const us=m[cur]||0; return [m.id,m.city||'',m.name||'',us,us,0,0].join('\t'); });
  navigator.clipboard.writeText(hdr+'\n'+rows.join('\n'))
    .then(()=>alToast('تم النسخ','success','📋')).catch(()=>alToast('فشل النسخ','error','❌'));
}

// Modal
function spOpenAdd() {
  document.getElementById('sp-modal-title').textContent = 'إضافة مركز جديد';
  ['sp-b-id','sp-b-name','sp-b-country','sp-b-location','sp-b-manager','sp-b-phone','sp-b-notes']
    .forEach(id => { const e = document.getElementById(id); if(e) e.value=''; });
  document.getElementById('sp-b-status').value   = 'active';
  document.getElementById('sp-b-currency').value = 'USD';
  document.getElementById('sp-modal').classList.add('open');
}

function spOpenEdit(id) {
  const b = _spAll.find(x => x.id === id); if (!b) return;
  document.getElementById('sp-modal-title').textContent = 'تعديل المركز';
  document.getElementById('sp-b-id').value       = b.id;
  document.getElementById('sp-b-name').value     = b.name || '';
  document.getElementById('sp-b-location').value = b.location || '';
  document.getElementById('sp-b-manager').value  = b.manager || '';
  document.getElementById('sp-b-phone').value    = b.phone || '';
  document.getElementById('sp-b-notes').value    = b.notes || '';
  document.getElementById('sp-b-status').value   = b.status || 'active';
  document.getElementById('sp-b-currency').value = b.currency || 'USD';
  document.getElementById('sp-modal').classList.add('open');
}

function spCloseModal() { document.getElementById('sp-modal').classList.remove('open'); }

async function spSave() {
  const id   = document.getElementById('sp-b-id').value;
  const name = document.getElementById('sp-b-name').value.trim();
  if (!name) { alToast('اسم المركز مطلوب','error','❌'); return; }
  const body = {
    name,
    location: document.getElementById('sp-b-location').value.trim(),
    manager:  document.getElementById('sp-b-manager').value.trim(),
    phone:    document.getElementById('sp-b-phone').value.trim(),
    notes:    document.getElementById('sp-b-notes').value.trim(),
    status:   document.getElementById('sp-b-status').value,
    currency: document.getElementById('sp-b-currency').value,
  };
  const url = id ? `/api/branches/${id}` : '/api/branches';
  const method = id ? 'PATCH' : 'POST';
  try {
    const r = await fetch(url, {
      method, credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify(body),
    });
    // اقرأ النص أولاً لكشف أي خطأ غير JSON (صفحة خطأ HTML مثلاً)
    const raw = await r.text();
    let d;
    try { d = JSON.parse(raw); }
    catch {
      alToast(`خطأ ${r.status}: ${raw.slice(0,120)}`,'error','❌');
      console.error('Branch save — non-JSON response:', r.status, raw.slice(0,500));
      return;
    }
    if (d.success) {
      alToast(id ? 'تم التحديث بنجاح' : 'تمت الإضافة بنجاح','success','✅');
      spCloseModal(); spLoadSafes();
    } else {
      alToast(d.error || d.message || `خطأ ${r.status}`,'error','❌');
    }
  } catch (e) {
    alToast('تعذر الوصول للسيرفر: ' + e.message,'error','❌');
    console.error('Branch save fetch error:', e);
  }
}

async function spDelete(id, name) {
  if (!confirm(`هل تريد حذف "${name}"؟`)) return;
  try {
    const r = await fetch(`/api/branches/${id}`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    const d = await r.json();
    if (d.success) { alToast('تم الحذف بنجاح','success','✅'); spLoadSafes(); }
    else alToast(d.error||'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

function _getCsrf() {
  const v = document.cookie.match('(^|;)\\s*csrftoken\\s*=\\s*([^;]+)');
  return v ? v.pop() : '';
}

// إغلاق modal بالضغط خارجه
const _spModalEl = document.getElementById('sp-modal');
if (_spModalEl) {
  _spModalEl.addEventListener('click', e => {
    if (e.target === _spModalEl) _spModalEl.classList.remove('open');
  });
}

// ── فتح اللوحة تلقائياً حسب الـ URL عند أول تحميل ──
(function() {
  const map = {
    '/accounting/safes/':  'safes',
    '/accounting/agents/':  'agents',
    '/accounting/transit/':   'transit',
    '/accounting/customers/':   'customers',
    '/accounting/cost-center/': 'cost-center',
    '/accounting/trash/':         'trash',
    '/accounting/safe-movement/':   'safe-movement',
    '/accounting/center-profits/':  'center-profits',
    '/accounting/transfer-count/':  'transfer-count',
    '/accounting/entry-from-to/':   'entry-from-to',
    '/accounting/advanced-entry/':   'advanced-entry',
    '/accounting/settlement-move/':  'settlement-move',
    '/accounting/opening-entry/':    'opening-entry',
    '/accounting/receipt-voucher/':  'receipt-voucher',
    '/accounting/payment-voucher/':  'payment-voucher',
    '/accounting/exchange/':         'exchange',
    '/accounting/outgoing-move/':    'outgoing-move',
    '/accounting/new-credit/':       'new-credit',
    '/accounting/ops-monitor/':      'ops-monitor',
    '/accounting/entry-audit/':      'entry-audit',
    '/accounting/trial-balance/':    'trial-balance',
    '/accounting/profit-per-safe/':  'profit-per-safe',
  };
  const key = map[location.pathname];
  if (key) openSubPanel(key);
})();

// ══ قيد من الى ══
let _efAll = [], _efFiltered = [], _efSortCol = 'id', _efSortAsc = true, _efPage = 1;

// خريطة: معرّف المركز → اسم الشركة (لترجمة القيود القديمة المخزّنة بالأرقام)
let _efCenterMap = {};

async function efLoadCenters() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.records || d.results || d.centers || []);
    const fromSel = document.getElementById('ef-from-center');
    const toSel   = document.getElementById('ef-to-center');
    const fromVal = fromSel.value;
    const toVal   = toSel.value;
    _efCenterMap = {};
    [fromSel, toSel].forEach(sel => {
      sel.innerHTML = '<option value="">— اختر المركز —</option>';
      list.forEach(c => {
        const cid  = c.id ?? c.name ?? c.center_name ?? '';
        const cname = c.name ?? c.center_name ?? c.title ?? '';
        if (cid !== '') _efCenterMap[String(cid)] = cname;
        const opt = document.createElement('option');
        opt.value = cid;
        opt.textContent = cname;
        sel.appendChild(opt);
      });
    });
    if (fromVal) fromSel.value = fromVal;
    if (toVal)   toSel.value   = toVal;
  } catch { /* لا مشكلة — الـ dropdown تبقى فارغة */ }
}

// يُرجع اسم الشركة: إن كانت القيمة رقماً (id) يترجمها، وإلا يعيدها كما هي (اسم)
function _efCenterName(v) {
  if (v == null || v === '') return '—';
  const s = String(v);
  // إن كانت رقماً وموجودة في الخريطة → ترجمها لاسم
  if (/^\d+$/.test(s) && _efCenterMap[s]) return _efCenterMap[s];
  return s;  // أصلاً اسم
}

async function efLoad() {
  await efLoadCenters();   // ننتظر تحميل خريطة أسماء الشركات أولاً
  document.getElementById('ef-tbody').innerHTML =
    '<tr><td colspan="10" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/am/entry-from-to/?per_page=200', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.records || d.results || d.entries || []);
    _efAll = list; _efFiltered = [..._efAll];
    document.getElementById('sp-count').textContent = `— ${_efAll.length} قيد`;
    efRender(1);
  } catch {
    _efAll = []; _efFiltered = [];
    document.getElementById('ef-tbody').innerHTML =
      '<tr><td colspan="12" class="sp-empty">📭 لا توجد قيود</td></tr>';
    document.getElementById('ef-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('ef-pages').innerHTML = '';
  }
}

function efRender(p) {
  const total   = _efFiltered.length;
  const perPage = parseInt(document.getElementById('ef-per-page').value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _efPage = Math.min(Math.max(1, p), maxPage);
  const start = (_efPage - 1) * perPage;
  const slice = _efFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('ef-tbody');

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="12" class="sp-empty">📭 لا توجد قيود</td></tr>';
    document.getElementById('ef-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('ef-pages').innerHTML = '';
    document.getElementById('ef-prev').disabled = true;
    document.getElementById('ef-next').disabled = true;
    return;
  }

  const fmtNum = v => v != null ? Number(v).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
  const fmtProfit = v => v != null
    ? `<span style="color:${Number(v)>=0?'#4ADE80':'#FCA5A5'};font-weight:700">${fmtNum(v)}</span>`
    : '—';

  tbody.innerHTML = slice.map((e,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td class="sp-num" style="color:#fff;font-size:10.5px">${e.refNumber || e.id}</td>
    <td style="font-weight:700;color:#fff">${_efCenterName(e.fromCenter)}</td>
    <td style="font-size:11px;color:#fff;font-weight:600">${e.fromCurrency||''} ${fmtNum(e.fromAmount)}</td>
    <td style="color:#fff;font-weight:600">${e.fromBeneficiary || '—'}</td>
    <td style="font-weight:700;color:#fff">${_efCenterName(e.toCenter)}</td>
    <td style="font-size:11px;color:#fff;font-weight:600">${e.toCurrency||''} ${fmtNum(e.toAmount)}</td>
    <td class="sp-num" style="color:#fff">${e.fromFee ? fmtNum(e.fromFee) : '—'}</td>
    <td class="sp-num" style="color:#fff">${e.toFee ? fmtNum(e.toFee) : '—'}</td>
    <td class="sp-num">${fmtProfit(e.netProfit)}</td>
    <td style="font-size:11px;color:#fff">${e.createdAt || '—'}</td>
    <td style="font-size:11px;color:#fff">${e.fromNotes||e.toNotes||'—'}</td>
    <td>
      <button onclick="efDelete(${e.id},'${(e.refNumber||'').replace(/'/g,'')}')"
        style="padding:2px 8px;border:1px solid rgba(252,165,165,.3);background:rgba(252,165,165,.15);color:#FCA5A5;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit">حذف</button>
    </td>
  </tr>`; }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('ef-showing').textContent = `يعرض ${start+1} إلى ${end} من أصل ${total}`;

  const pg = document.getElementById('ef-pages');
  pg.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _efPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => efRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('ef-prev').disabled = _efPage <= 1;
  document.getElementById('ef-next').disabled = _efPage >= maxPage;
}

function efFilter(q) {
  const t = q.trim().toLowerCase();
  _efFiltered = !t ? [..._efAll] : _efAll.filter(e =>
    (e.fromCenter    || '').toLowerCase().includes(t) ||
    (e.toCenter      || '').toLowerCase().includes(t) ||
    (e.fromBeneficiary || '').toLowerCase().includes(t) ||
    (e.fromNotes     || '').toLowerCase().includes(t) ||
    (e.toNotes       || '').toLowerCase().includes(t) ||
    (e.refNumber     || '').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_efFiltered.length} قيد`;
  efRender(1);
}

function efSort(col) {
  if (_efSortCol === col) _efSortAsc = !_efSortAsc;
  else { _efSortCol = col; _efSortAsc = true; }
  document.querySelectorAll('.ef-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('ef-sa-' + col); if (el) el.textContent = _efSortAsc ? '↑' : '↓';
  _efFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    return _efSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  efRender(1);
}

function efExportCSV() {
  const hdr  = ['رقم','المركز المرسل','المبلغ المرسل','العملة','المستفيد','المركز المستلم','المبلغ المستلم','العملة','أجور تصدير','أجور تسليم','الربح','التاريخ','ملاحظات'].join(',');
  const rows = _efFiltered.map(e =>
    [e.refNumber, e.fromCenter||'', e.fromAmount||0, e.fromCurrency||'',
     e.fromBeneficiary||'', e.toCenter||'', e.toAmount||0, e.toCurrency||'',
     e.fromFee||0, e.toFee||0, e.netProfit||0, e.createdAt||'',
     (e.fromNotes||e.toNotes||'').replace(/,/g,' ')].join(','));
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'قيد_جديد.csv'; a.click();
}

// ── نافذة تأكيد عامة قابلة لإعادة الاستخدام ──
// title: عنوان النافذة، rows: [{label, value, color}]
function amConfirmDialog(title, rows) {
  return new Promise(resolve => {
    document.getElementById('am-confirm-overlay')?.remove();

    const rowsHtml = rows.map((r, i) => `
      <div style="display:flex;justify-content:space-between;padding:9px 0;${i < rows.length-1 ? 'border-bottom:1px solid #f1f5f9' : ''}">
        <span style="color:#64748b;font-size:.85rem">${r.label}</span>
        <span style="color:${r.color || '#1e293b'};font-weight:${r.color ? '800' : '700'}">${r.value}</span>
      </div>`).join('');

    const overlay = document.createElement('div');
    overlay.id = 'am-confirm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(3,6,20,.7);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;direction:rtl';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;width:90%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,.4);overflow:hidden;font-family:'Cairo',sans-serif">
        <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:18px 24px;text-align:center">
          <div style="font-size:1.6rem">📋</div>
          <h3 style="color:#fff;margin:6px 0 0;font-size:1.1rem;font-weight:800">${title}</h3>
          <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:.8rem">يرجى مراجعة التفاصيل قبل التأكيد</p>
        </div>
        <div style="padding:22px 24px">${rowsHtml}</div>
        <div style="display:flex;gap:10px;padding:0 24px 22px">
          <button id="am-confirm-cancel" style="flex:1;padding:12px;border:1px solid #e2e8f0;background:#f1f5f9;color:#475569;border-radius:10px;font-family:'Cairo',sans-serif;font-weight:700;cursor:pointer">إلغاء</button>
          <button id="am-confirm-ok" style="flex:1;padding:12px;border:none;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;border-radius:10px;font-family:'Cairo',sans-serif;font-weight:700;cursor:pointer">✓ تأكيد وتسجيل</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelector('#am-confirm-ok').onclick     = () => close(true);
    overlay.querySelector('#am-confirm-cancel').onclick = () => close(false);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

const _fmtConfirm = v => Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

// نافذة تأكيد القيد الأساسي (تستخدم الدالة العامة)
function efConfirmDialog(info) {
  return amConfirmDialog('تأكيد تسجيل القيد', [
    { label:'المركز المرسل (من)', value: info.fromCenter || '—' },
    { label:'المبلغ المرسل',      value: `${_fmtConfirm(info.fromAmount)} ${info.fromCur}`, color:'#16a34a' },
    { label:'المركز المستلم (الى)', value: info.toCenter || '—' },
    { label:'المبلغ المستلم',     value: `${_fmtConfirm(info.toAmount)} ${info.toCur}`, color:'#dc2626' },
  ]);
}

async function efSave() {
  const fromSel = document.getElementById('ef-from-center');
  const toSel   = document.getElementById('ef-to-center');
  // نحفظ اسم الشركة (النص الظاهر) وليس المعرّف
  const fromCenter = fromSel.options[fromSel.selectedIndex]?.text.trim() || fromSel.value.trim();
  const toCenter   = toSel.options[toSel.selectedIndex]?.text.trim() || toSel.value.trim();
  const fromAmount = parseFloat(document.getElementById('ef-from-amount').value) || 0;

  if (!fromSel.value) { alToast('يرجى اختيار المركز المرسل','error','❌'); return; }
  if (!toSel.value)   { alToast('يرجى اختيار المركز المستلم','error','❌'); return; }
  if (fromSel.value === toSel.value) { alToast('يجب أن يكون المركزان مختلفَين','error','❌'); return; }
  if (fromAmount <= 0)         { alToast('يرجى إدخال مبلغ صحيح','error','❌'); return; }

  const fromCur = document.getElementById('ef-from-currency').value;
  const toCur   = document.getElementById('ef-to-currency').value;
  const toAmount = parseFloat(document.getElementById('ef-to-amount').value) || 0;

  // ── نافذة تأكيد قبل تسجيل القيد ──
  const confirmed = await efConfirmDialog({
    fromCenter, fromCur, fromAmount,
    toCenter, toCur, toAmount,
  });
  if (!confirmed) return;   // ألغى المستخدم

  const body = {
    fromCenter:      fromCenter,
    fromCurrency:    fromCur,
    fromAmount:      fromAmount,
    fromFee:         parseFloat(document.getElementById('ef-from-fees').value) || 0,
    fromBeneficiary: document.getElementById('ef-from-beneficiary').value.trim(),
    fromNotes:       document.getElementById('ef-from-notes').value.trim(),
    cutRate:         parseFloat(document.getElementById('ef-from-cut-val').value) || 1,
    cutDir:          document.getElementById('ef-from-cut-type').value,
    toCenter:        toCenter,
    toCurrency:      toCur,
    toFee:           parseFloat(document.getElementById('ef-to-fees').value) || 0,
    toNotes:         document.getElementById('ef-to-notes').value.trim(),
  };

  try {
    const r = await fetch('/api/am/entry-from-to/', {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type':'application/json', 'X-CSRFToken': _getCsrf()},
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.success) {
      const profit = d.netProfit != null ? Number(d.netProfit).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
      alToast(`✅ تم القيد ${d.record?.refNumber || ''} — الربح: ${profit}`, 'success', '✅');
      // تنظيف الحقول
      ['ef-from-amount','ef-from-fees','ef-from-beneficiary',
       'ef-from-notes','ef-to-amount','ef-to-fees','ef-to-notes']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
      document.getElementById('ef-from-cut-val').value = '1';
      efLoad();
    } else {
      alToast(d.message || 'حدث خطأ أثناء الحفظ','error','❌');
    }
  } catch { alToast('خطأ في الاتصال بالخادم','error','❌'); }
}

async function efDelete(id, ref) {
  if (!confirm(`هل تريد حذف القيد ${ref}؟`)) return;
  try {
    const r = await fetch(`/api/am/entry-from-to/${id}/`, {
      method: 'DELETE', credentials: 'include',
      headers: {'X-CSRFToken': _getCsrf()},
    });
    const d = await r.json();
    if (d.success) { alToast(d.message, 'success', '🗑️'); efLoad(); }
    else alToast(d.message || 'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

// ══ قيد من-الى: حساب المبلغ المستلم تلقائياً ══
/* عند إدخال المبلغ المرسل + القص، يُحسب المبلغ المستلم ويظهر فوراً */
function efCalc() {
  const fromAmt = parseFloat(document.getElementById('ef-from-amount')?.value) || 0;
  const cutVal  = parseFloat(document.getElementById('ef-from-cut-val')?.value) || 1;
  const cutType = document.getElementById('ef-from-cut-type')?.value || 'multiply';

  const toEl = document.getElementById('ef-to-amount');
  if (!toEl) return;

  // إذا عدّل المستخدم المبلغ المستلم يدوياً، لا نكتب فوقه
  if (toEl.dataset.manual === '1') return;

  // المبلغ المستلم = القسمة أو الضرب حسب اتجاه القص
  let toAmt = cutType === 'divide'
    ? (cutVal ? fromAmt / cutVal : 0)
    : fromAmt * cutVal;

  toEl.value = toAmt > 0 ? toAmt.toFixed(4).replace(/\.?0+$/, '') : '';
}

// ══ قيد متقدم ══
let _aeAll = [], _aeFiltered = [], _aeSortCol = 'refNumber', _aeSortAsc = false, _aePage = 1;

/* حساب حي للربح بمجرد تغيير أي حقل */
function aeCalc() {
  const fromAmt  = parseFloat(document.getElementById('ae-from-amount')?.value) || 0;
  const cutRate  = parseFloat(document.getElementById('ae-cut-rate')?.value)    || 1;
  const cutDir   = document.getElementById('ae-cut-dir')?.value || 'mul';
  const fromFee  = parseFloat(document.getElementById('ae-from-fee')?.value)    || 0;
  const toFee    = parseFloat(document.getElementById('ae-to-fee')?.value)      || 0;
  const fromCur  = document.getElementById('ae-from-currency')?.value || 'USD';
  const toCur    = document.getElementById('ae-to-currency')?.value   || 'USD';

  // احسب المبلغ المستلم
  let toAmt = cutDir === 'div'
    ? (cutRate ? fromAmt / cutRate : 0)
    : fromAmt * cutRate;

  // اعرضه في حقل الاستلام إذا لم يعدّله المستخدم يدوياً
  const toAmtEl = document.getElementById('ae-to-amount');
  if (toAmtEl && !toAmtEl.dataset.manual) {
    toAmtEl.value = toAmt > 0 ? toAmt.toFixed(4) : '';
  } else if (toAmtEl?.dataset.manual) {
    toAmt = parseFloat(toAmtEl.value) || toAmt;
  }

  // فرق القص: أعد تحويل toAmt → fromCur
  let toInFrom;
  if (fromCur === toCur) {
    toInFrom = toAmt;
  } else {
    toInFrom = cutDir === 'div'
      ? toAmt * cutRate
      : (cutRate ? toAmt / cutRate : 0);
  }
  const cutDiff = Math.abs(fromAmt - toInFrom);

  // أجور تسليم → fromCur
  let toFeeBase;
  const toFeeCur = document.getElementById('ae-to-fee-cur')?.value || 'USD';
  if (fromCur === toFeeCur) {
    toFeeBase = toFee;
  } else {
    toFeeBase = cutDir === 'div'
      ? toFee * cutRate
      : (cutRate ? toFee / cutRate : 0);
  }

  const netProfit = cutDiff + fromFee + toFeeBase;

  // عرض الأرقام
  const fmt = v => v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const el  = id => document.getElementById(id);

  if (el('ae-cut-diff'))     el('ae-cut-diff').textContent     = fmt(cutDiff);
  if (el('ae-fee-from-show'))el('ae-fee-from-show').textContent= fmt(fromFee);
  if (el('ae-fee-to-show'))  el('ae-fee-to-show').textContent  = fmt(toFeeBase);
  if (el('ae-net-profit')) {
    el('ae-net-profit').textContent = fmt(netProfit);
    el('ae-net-profit').style.color = netProfit >= 0 ? '#16A34A' : '#DC2626';
  }
  const fromCenterName = el('ae-from-center')?.selectedOptions?.[0]?.text || '';
  const toCenterName   = el('ae-to-center')?.selectedOptions?.[0]?.text   || '';
  if (el('ae-from-live')) el('ae-from-live').textContent = fromAmt > 0 ? `${fmt(fromAmt)} ${fromCur}` : '';
  if (el('ae-to-live'))   el('ae-to-live').textContent   = toAmt   > 0 ? `${fmt(toAmt)} ${toCur}` : '';
  if (el('ae-sum-from'))  el('ae-sum-from').textContent  = fromCenterName ? `من: ${fromCenterName} — ${fmt(fromAmt)} ${fromCur}` : 'من: —';
  if (el('ae-sum-to'))    el('ae-sum-to').textContent    = toCenterName   ? `الى: ${toCenterName} — ${fmt(toAmt)} ${toCur}` : 'الى: —';
  if (el('ae-sum-profit'))el('ae-sum-profit').textContent= `الربح: ${fmt(netProfit)} ${fromCur}`;
}

/* تحميل قوائم المراكز */
async function aeLoadCenters() {
  try {
    const r = await fetch('/api/am/adv-entry/?per_page=1', {credentials:'include'});
    // نجلب المراكز من endpoint المراكز
    const rc = await fetch('/api/am/cost-center/', {credentials:'include'});
    const dc = await rc.json();
    const list = Array.isArray(dc) ? dc : (dc.results || dc.centers || []);
    ['ae-from-center','ae-to-center'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">— اختر —</option>';
      list.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name ?? c.center_name ?? c.id ?? '';
        opt.textContent = c.name ?? c.center_name ?? c.title ?? '';
        sel.appendChild(opt);
      });
      if (cur) sel.value = cur;
    });
  } catch {}
}

/* تحميل السجل */
async function aeLoad() {
  aeLoadCenters();
  document.getElementById('ae-tbody').innerHTML =
    '<tr><td colspan="13" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/am/adv-entry/?per_page=200', {credentials:'include'});
    const d = await r.json();
    _aeAll = d.records || d.results || [];
    _aeFiltered = [..._aeAll];
    document.getElementById('sp-count').textContent = `— ${_aeAll.length} قيد`;
    const tp = d.totalProfit ?? 0;
    const tpEl = document.getElementById('ae-total-profit');
    if (tpEl) tpEl.textContent = `إجمالي الربح: ${Number(tp).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    aeRender(1);
  } catch {
    _aeAll = []; _aeFiltered = [];
    document.getElementById('ae-tbody').innerHTML =
      '<tr><td colspan="13" class="sp-empty">📭 لا توجد قيود</td></tr>';
  }
}

function aeRender(p) {
  const total   = _aeFiltered.length;
  const perPage = parseInt(document.getElementById('ae-per-page').value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _aePage = Math.min(Math.max(1, p), maxPage);
  const start = (_aePage - 1) * perPage;
  const slice = _aeFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('ae-tbody');
  const fmt   = v => Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtP  = v => `<span style="color:${Number(v||0)>=0?'#4ADE80':'#FCA5A5'};font-weight:700">${fmt(v)}</span>`;

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">📭 لا توجد قيود</td></tr>';
    document.getElementById('ae-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('ae-pages').innerHTML = '';
    document.getElementById('ae-prev').disabled = true;
    document.getElementById('ae-next').disabled = true;
    return;
  }

  tbody.innerHTML = slice.map((e,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td style="font-size:10.5px;color:rgba(255,255,255,.7)">${e.refNumber||e.id}</td>
    <td style="font-weight:700;color:#fff">${e.fromCenter||'—'}</td>
    <td style="font-size:11px;color:#fff">${e.fromName||'—'}</td>
    <td class="sp-num" style="color:#4ADE80">${e.fromCurrency||''} ${fmt(e.fromAmount)}</td>
    <td class="sp-num" style="color:#fff">${e.fromFee?fmt(e.fromFee):'—'}</td>
    <td style="font-weight:700;color:#67E8F9">${e.toCenter||'—'}</td>
    <td style="color:#fff">${e.toBeneficiary||'—'}</td>
    <td class="sp-num" style="color:#FCA5A5">${e.toCurrency||''} ${fmt(e.toAmount)}</td>
    <td class="sp-num" style="color:#fff">${e.toFee?fmt(e.toFee):'—'}</td>
    <td class="sp-num" style="color:#93C5FD">${fmt(e.cutDiff)}</td>
    <td class="sp-num">${fmtP(e.netProfit)}</td>
    <td style="font-size:11px;color:rgba(255,255,255,.7)">${e.createdAt||'—'}</td>
    <td>
      <button onclick="aeDelete(${e.id},'${(e.refNumber||'').replace(/'/g,'')}')"
        style="padding:2px 8px;border:1px solid rgba(252,165,165,.3);background:rgba(252,165,165,.15);color:#FCA5A5;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit">حذف</button>
    </td>
  </tr>`; }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('ae-showing').textContent = `يعرض ${start+1} إلى ${end} من أصل ${total}`;

  const pg = document.getElementById('ae-pages');
  pg.innerHTML = '';
  const maxVisible = 7;
  let s = Math.max(1, _aePage - 3), e2 = Math.min(maxPage, s + maxVisible - 1);
  if (e2 - s < maxVisible - 1) s = Math.max(1, e2 - maxVisible + 1);
  for (let i = s; i <= e2; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _aePage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => aeRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('ae-prev').disabled = _aePage <= 1;
  document.getElementById('ae-next').disabled = _aePage >= maxPage;
}

function aeFilter(q) {
  const t = q.trim().toLowerCase();
  _aeFiltered = !t ? [..._aeAll] : _aeAll.filter(e =>
    (e.fromCenter||'').toLowerCase().includes(t) ||
    (e.toCenter||'').toLowerCase().includes(t) ||
    (e.fromName||'').toLowerCase().includes(t) ||
    (e.toBeneficiary||'').toLowerCase().includes(t) ||
    (e.refNumber||'').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_aeFiltered.length} قيد`;
  aeRender(1);
}

function aeSort(col) {
  if (_aeSortCol === col) _aeSortAsc = !_aeSortAsc;
  else { _aeSortCol = col; _aeSortAsc = true; }
  document.querySelectorAll('.ae-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('ae-sa-' + col); if (el) el.textContent = _aeSortAsc ? '↑' : '↓';
  _aeFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    return _aeSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  aeRender(1);
}

function aeExportCSV() {
  const hdr = ['رقم','المركز المرسل','اسم المرسل','مبلغ الإرسال','العملة','أجور تصدير','المركز المستلم','المستفيد','مبلغ الاستلام','العملة','أجور تسليم','فرق القص','الربح الكلي','التاريخ'].join(',');
  const rows = _aeFiltered.map(e =>
    [e.refNumber,e.fromCenter||'',e.fromName||'',e.fromAmount||0,e.fromCurrency||'',
     e.fromFee||0,e.toCenter||'',e.toBeneficiary||'',e.toAmount||0,e.toCurrency||'',
     e.toFee||0,e.cutDiff||0,e.netProfit||0,e.createdAt||''].join(','));
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = 'قيد_متقدم.csv'; a.click();
}

async function aeSave() {
  const fromCenter = document.getElementById('ae-from-center').value.trim();
  const toCenter   = document.getElementById('ae-to-center').value.trim();
  const fromAmount = parseFloat(document.getElementById('ae-from-amount').value) || 0;
  const cutRate    = parseFloat(document.getElementById('ae-cut-rate').value)    || 1;

  if (!fromCenter) { alToast('يرجى اختيار المركز المرسل','error','❌'); return; }
  if (!toCenter)   { alToast('يرجى اختيار المركز المستلم','error','❌'); return; }
  if (fromCenter === toCenter) { alToast('يجب أن يكون المركزان مختلفَين','error','❌'); return; }
  if (fromAmount <= 0)         { alToast('يرجى إدخال مبلغ صحيح','error','❌'); return; }
  if (cutRate <= 0)            { alToast('سعر القص غير صالح','error','❌'); return; }

  const aeFromCur = document.getElementById('ae-from-currency').value;
  const aeToCur   = document.getElementById('ae-to-currency').value;
  const aeToAmt   = parseFloat(document.getElementById('ae-to-amount').value) || 0;
  const confirmedAe = await amConfirmDialog('تأكيد تسجيل القيد المتقدم', [
    { label:'المركز المرسل (من)', value: fromCenter || '—' },
    { label:'المبلغ المرسل',      value: `${_fmtConfirm(fromAmount)} ${aeFromCur}`, color:'#16a34a' },
    { label:'المركز المستلم (الى)', value: toCenter || '—' },
    { label:'المبلغ المستلم',     value: `${_fmtConfirm(aeToAmt)} ${aeToCur}`, color:'#dc2626' },
  ]);
  if (!confirmedAe) return;

  const body = {
    fromCenter:      fromCenter,
    fromName:        document.getElementById('ae-from-name').value.trim(),
    fromCurrency:    document.getElementById('ae-from-currency').value,
    fromAmount:      fromAmount,
    fromFee:         parseFloat(document.getElementById('ae-from-fee').value) || 0,
    fromFeeCur:      document.getElementById('ae-from-fee-cur').value,
    fromNotes:       document.getElementById('ae-from-notes').value.trim(),
    cutRate:         cutRate,
    cutDir:          document.getElementById('ae-cut-dir').value,
    toCenter:        toCenter,
    toBeneficiary:   document.getElementById('ae-to-beneficiary').value.trim(),
    toCurrency:      document.getElementById('ae-to-currency').value,
    toFee:           parseFloat(document.getElementById('ae-to-fee').value) || 0,
    toFeeCur:        document.getElementById('ae-to-fee-cur').value,
    toNotes:         document.getElementById('ae-to-notes').value.trim(),
  };

  try {
    const r = await fetch('/api/am/adv-entry/', {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type':'application/json', 'X-CSRFToken': _getCsrf()},
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.success) {
      const profit = Number(d.netProfit||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      const ref = d.record?.refNumber || '';
      if (document.getElementById('ae-sum-ref')) document.getElementById('ae-sum-ref').textContent = `آخر قيد: ${ref}`;
      alToast(`✅ تم القيد ${ref} — الربح: ${profit}`, 'success', '✅');
      // تنظيف الحقول
      ['ae-from-name','ae-from-amount','ae-from-fee','ae-from-notes',
       'ae-to-beneficiary','ae-to-amount','ae-to-fee','ae-to-notes']
        .forEach(id => { const el = document.getElementById(id); if(el){ el.value=''; delete el.dataset.manual; } });
      document.getElementById('ae-cut-rate').value = '1';
      aeCalc();
      aeLoad();
    } else {
      alToast(d.message || 'حدث خطأ أثناء الحفظ','error','❌');
    }
  } catch { alToast('خطأ في الاتصال بالخادم','error','❌'); }
}

async function aeDelete(id, ref) {
  if (!confirm(`هل تريد حذف القيد ${ref}؟`)) return;
  try {
    const r = await fetch(`/api/am/adv-entry/${id}/`, {
      method: 'DELETE', credentials: 'include',
      headers: {'X-CSRFToken': _getCsrf()},
    });
    const d = await r.json();
    if (d.success) { alToast(d.message || 'تم الحذف', 'success', '🗑️'); aeLoad(); }
    else alToast(d.message || 'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

/* تفعيل التعديل اليدوي لحقل المبلغ المستلم */
document.addEventListener('DOMContentLoaded', () => {
  const toAmtEl = document.getElementById('ae-to-amount');
  if (toAmtEl) {
    toAmtEl.addEventListener('input', () => { toAmtEl.dataset.manual = '1'; aeCalc(); });
    toAmtEl.addEventListener('focus', () => { toAmtEl.dataset.manual = '1'; });
  }
  // ملء قوائم العملات في كل القيود من العملات المُدارة
  loadCurrencyOptions();
});

// ══ تحميل العملات وملء كل قوائم اختيار العملة في القيود ══
// كل قائمة عملة في القيود لها هذا المعرّف — تُملأ تلقائياً من ManagedCurrency
const _CURRENCY_SELECT_IDS = [
  'ef-from-currency','ef-to-currency',
  'ae-from-currency','ae-to-currency','ae-from-fee-cur','ae-to-fee-cur',
  'oe-currency','nc-currency',
  'rv-from-currency','rv-to-currency',
  'pv-from-currency','pv-to-currency',
  'ot-send-currency','ot-recv-currency',
];

// أسماء عربية افتراضية للرموز الشائعة (للعرض)
const _CUR_AR = {
  USD:'دولار', EUR:'يورو', TRY:'ليرة تركية', ILS:'شيكل', JOD:'دينار اردني',
  SAR:'ريال سعودي', AED:'درهم', GBP:'جنيه', SYP:'ليرة سورية', EGP:'جنيه مصري',
};

async function loadCurrencyOptions() {
  let currencies = [];
  try {
    const r = await fetch('/api/currencies/?active=1', {credentials:'include'});
    const d = await r.json();
    currencies = (d.currencies || []).filter(c => c.isActive !== false);
  } catch { /* عند الفشل نُبقي العملات الافتراضية في HTML */ }

  // إن لم توجد عملات مُدارة، لا نلمس القوائم الثابتة
  if (!currencies.length) return;

  _CURRENCY_SELECT_IDS.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;  // حافظ على الاختيار الحالي
    sel.innerHTML = '';
    currencies.forEach(c => {
      const sym = (c.symbol || '').toUpperCase();
      if (!sym) return;
      const label = c.name ? `${_CUR_AR[sym] || c.name}` : (_CUR_AR[sym] || sym);
      const opt = document.createElement('option');
      opt.value = sym;
      opt.textContent = label;
      sel.appendChild(opt);
    });
    // استعد الاختيار السابق إن كان لا يزال موجوداً، وإلا أول عملة
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  });
}

// ══ حركة تسوية ══
let _sm2All = [], _sm2Filtered = [], _sm2SortCol = 'refNumber', _sm2SortAsc = false, _sm2Page = 1;
let _sm2RowId = 0;

const SM2_CURRENCIES = ['USD','EUR','TRY','ILS','JOD','SAR','AED','GBP'];

function sm2CurSelect(selected = 'USD', id = '') {
  return `<select id="${id}" onchange="sm2Calc()" style="width:100%;padding:4px 6px;border:1px solid #D1D5DB;border-radius:5px;font-size:11px;font-family:inherit;outline:none;background:#fff">
    ${SM2_CURRENCIES.map(c => `<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join('')}
  </select>`;
}

function sm2AddRow(data = {}) {
  const rid = ++_sm2RowId;
  const cur = data.currency || 'USD';
  const div = document.createElement('div');
  div.id = `sm2-row-${rid}`;
  div.style.cssText = 'display:grid;grid-template-columns:90px 1fr 90px 1fr 1fr 1fr 1fr 36px;gap:5px;margin-bottom:4px;align-items:center';
  div.innerHTML = `
    <div>${sm2CurSelect(cur, `sm2-cur-${rid}`)}</div>
    <input type="number" id="sm2-amt-${rid}" step="0.01" placeholder="0.00" oninput="sm2Calc()"
      value="${data.amount||''}"
      style="padding:5px 8px;border:1px solid #D1D5DB;border-radius:5px;font-size:11.5px;font-family:inherit;outline:none;width:100%">
    <input type="number" id="sm2-fee-us-${rid}" step="0.01" placeholder="0.00" oninput="sm2Calc()"
      value="${data.feeUs||''}"
      style="padding:5px 8px;border:1px solid #BBF7D0;border-radius:5px;font-size:11.5px;font-family:inherit;outline:none;width:100%;background:#F0FDF4">
    <input type="text" id="sm2-dest-${rid}" placeholder="الوجهة"
      value="${data.destination||''}"
      style="padding:5px 8px;border:1px solid #D1D5DB;border-radius:5px;font-size:11.5px;font-family:inherit;outline:none;width:100%">
    <input type="text" id="sm2-benef-${rid}" placeholder="المستفيد"
      value="${data.beneficiary||''}"
      style="padding:5px 8px;border:1px solid #D1D5DB;border-radius:5px;font-size:11.5px;font-family:inherit;outline:none;width:100%">
    <input type="text" id="sm2-rnotes-${rid}" placeholder="ملاحظات"
      value="${data.notes||''}"
      style="padding:5px 8px;border:1px solid #D1D5DB;border-radius:5px;font-size:11.5px;font-family:inherit;outline:none;width:100%">
    <input type="number" id="sm2-fee-them-${rid}" step="0.01" placeholder="0.00" oninput="sm2Calc()"
      value="${data.feeThem||''}"
      style="padding:5px 8px;border:1px solid #FECACA;border-radius:5px;font-size:11.5px;font-family:inherit;outline:none;width:100%;background:#FEF2F2">
    <button onclick="sm2RemoveRow(${rid})" title="حذف الصف"
      style="width:28px;height:28px;border:none;background:#FEE2E2;color:#DC2626;border-radius:5px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;font-family:inherit">×</button>
  `;
  document.getElementById('sm2-rows').appendChild(div);
  sm2Calc();
}

function sm2RemoveRow(rid) {
  const el = document.getElementById(`sm2-row-${rid}`);
  if (el) el.remove();
  sm2Calc();
}

function sm2GetRows() {
  return [...document.getElementById('sm2-rows').children].map(row => {
    const rid = row.id.replace('sm2-row-','');
    return {
      currency:    document.getElementById(`sm2-cur-${rid}`)?.value      || 'USD',
      amount:      parseFloat(document.getElementById(`sm2-amt-${rid}`)?.value)      || 0,
      feeUs:       parseFloat(document.getElementById(`sm2-fee-us-${rid}`)?.value)   || 0,
      destination: document.getElementById(`sm2-dest-${rid}`)?.value     || '',
      beneficiary: document.getElementById(`sm2-benef-${rid}`)?.value    || '',
      notes:       document.getElementById(`sm2-rnotes-${rid}`)?.value   || '',
      feeThem:     parseFloat(document.getElementById(`sm2-fee-them-${rid}`)?.value) || 0,
    };
  });
}

function sm2Calc() {
  const rows = sm2GetRows();
  const totalUs   = rows.reduce((s,r) => s + r.feeUs,   0);
  const totalThem = rows.reduce((s,r) => s + r.feeThem, 0);
  const netProfit = totalUs - totalThem;
  const fmt = v => Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  const el = id => document.getElementById(id);
  if (el('sm2-live-us'))     el('sm2-live-us').textContent     = fmt(totalUs);
  if (el('sm2-live-them'))   el('sm2-live-them').textContent   = fmt(totalThem);
  if (el('sm2-live-profit')) {
    el('sm2-live-profit').textContent = fmt(netProfit);
    el('sm2-live-profit').style.color = netProfit >= 0 ? '#16A34A' : '#DC2626';
  }
  const cName = el('sm2-center')?.selectedOptions?.[0]?.text || '—';
  if (el('sm2-sum-center'))  el('sm2-sum-center').textContent  = `المركز: ${cName}`;
  if (el('sm2-sum-us'))      el('sm2-sum-us').textContent      = `لنا: ${fmt(totalUs)}`;
  if (el('sm2-sum-them'))    el('sm2-sum-them').textContent    = `علينا: ${fmt(totalThem)}`;
  if (el('sm2-sum-profit'))  el('sm2-sum-profit').textContent  = `الربح: ${fmt(netProfit)}`;

  // شريط الربح
  const bar = el('sm2-profit-bar');
  if (bar) {
    const pct = totalUs > 0 ? Math.min(100, (netProfit / totalUs) * 100) : 0;
    bar.style.width = Math.max(0, pct) + '%';
    bar.style.background = netProfit >= 0 ? '#16A34A' : '#DC2626';
  }
}

async function sm2LoadCenters() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    const sel = document.getElementById('sm2-center');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— اختر المركز —</option>';
    list.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name ?? c.center_name ?? c.id ?? '';
      opt.textContent = c.name ?? c.center_name ?? c.title ?? '';
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  } catch {}
}

async function sm2Load() {
  sm2LoadCenters();
  // أضف صفاً افتراضياً إذا كان الجدول فارغاً
  if (!document.getElementById('sm2-rows')?.children.length) sm2AddRow();
  sm2Calc();

  document.getElementById('sm2-tbody').innerHTML =
    '<tr><td colspan="9" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/am/settlement/?per_page=200', {credentials:'include'});
    const d = await r.json();
    _sm2All = d.records || d.results || [];
    _sm2Filtered = [..._sm2All];
    document.getElementById('sp-count').textContent = `— ${_sm2All.length} سند`;
    const tp = d.totalProfit ?? 0;
    const tpEl = document.getElementById('sm2-total-profit');
    if (tpEl) tpEl.textContent = `إجمالي الربح: ${Number(tp).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    sm2Render(1);
  } catch {
    _sm2All = []; _sm2Filtered = [];
    document.getElementById('sm2-tbody').innerHTML =
      '<tr><td colspan="9" class="sp-empty">📭 لا توجد سندات</td></tr>';
  }
}

function sm2Render(p) {
  const total   = _sm2Filtered.length;
  const perPage = parseInt(document.getElementById('sm2-per-page').value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _sm2Page = Math.min(Math.max(1, p), maxPage);
  const start = (_sm2Page - 1) * perPage;
  const slice = _sm2Filtered.slice(start, start + perPage);
  const tbody = document.getElementById('sm2-tbody');
  const fmt   = v => Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtP  = v => `<span style="color:${Number(v||0)>=0?'#4ADE80':'#FCA5A5'};font-weight:700">${fmt(v)}</span>`;

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">📭 لا توجد سندات</td></tr>';
    document.getElementById('sm2-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('sm2-pages').innerHTML = '';
    document.getElementById('sm2-prev').disabled = true;
    document.getElementById('sm2-next').disabled = true;
    return;
  }

  tbody.innerHTML = slice.map((e,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td style="font-size:10.5px;color:rgba(255,255,255,.7)">${e.refNumber||e.id}</td>
    <td style="font-weight:700;color:#fff">${e.centerName||'—'}</td>
    <td style="font-size:11px;color:rgba(255,255,255,.7)">${e.createdAt||'—'}</td>
    <td class="sp-num" style="color:#4ADE80">${fmt(e.totalUs)}</td>
    <td class="sp-num" style="color:#FCA5A5">${fmt(e.totalThem)}</td>
    <td class="sp-num" style="color:#93C5FD">${fmt(e.netProfit)}</td>
    <td class="sp-num">${fmtP(e.netProfit)}</td>
    <td style="font-size:11px;color:rgba(255,255,255,.7)">${e.notes||'—'}</td>
    <td style="white-space:nowrap">
      <button onclick="sm2Reverse(${e.id},'${(e.refNumber||'').replace(/'/g,'')}')"
        style="padding:2px 8px;border:1px solid rgba(147,197,253,.3);background:rgba(147,197,253,.15);color:#93C5FD;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit;margin-left:4px">🔄 عكس قيد</button>
      <button onclick="sm2Edit(${e.id})"
        style="padding:2px 8px;border:1px solid rgba(74,222,128,.3);background:rgba(74,222,128,.15);color:#4ADE80;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit;margin-left:4px">✎ تعديل</button>
      <button onclick="sm2Delete(${e.id},'${(e.refNumber||'').replace(/'/g,'')}')"
        style="padding:2px 8px;border:1px solid rgba(252,165,165,.3);background:rgba(252,165,165,.15);color:#FCA5A5;border-radius:4px;font-size:10px;cursor:pointer;font-family:inherit">✕ حذف قيد</button>
    </td>
  </tr>`; }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('sm2-showing').textContent = `يعرض ${start+1} إلى ${end} من أصل ${total}`;

  const pg = document.getElementById('sm2-pages');
  pg.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _sm2Page ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => sm2Render(i);
    pg.appendChild(btn);
  }
  document.getElementById('sm2-prev').disabled = _sm2Page <= 1;
  document.getElementById('sm2-next').disabled = _sm2Page >= maxPage;
}

function sm2Filter(q) {
  const t = q.trim().toLowerCase();
  _sm2Filtered = !t ? [..._sm2All] : _sm2All.filter(e =>
    (e.centerName||'').toLowerCase().includes(t) ||
    (e.refNumber||'').toLowerCase().includes(t)  ||
    (e.notes||'').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_sm2Filtered.length} سند`;
  sm2Render(1);
}

function sm2Sort(col) {
  if (_sm2SortCol === col) _sm2SortAsc = !_sm2SortAsc;
  else { _sm2SortCol = col; _sm2SortAsc = true; }
  document.querySelectorAll('.sm2-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('sm2-sa-' + col); if (el) el.textContent = _sm2SortAsc ? '↑' : '↓';
  _sm2Filtered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    return _sm2SortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  sm2Render(1);
}

function sm2ExportCSV() {
  const hdr = ['رقم','المركز','لنا','علينا','الربح','التاريخ','ملاحظات'].join(',');
  const rows = _sm2Filtered.map(e =>
    [e.refNumber,e.centerName||'',e.totalUs||0,e.totalThem||0,e.netProfit||0,e.createdAt||'',(e.notes||'').replace(/,/g,' ')].join(','));
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = 'حركة_تسوية.csv'; a.click();
}

async function sm2Save() {
  const center = document.getElementById('sm2-center').value.trim();
  if (!center) { alToast('يرجى اختيار المركز','error','❌'); return; }

  const rows = sm2GetRows().filter(r => r.amount > 0);
  if (!rows.length) { alToast('يرجى إضافة صف واحد على الأقل بمبلغ','error','❌'); return; }

  const body = {
    centerName: center,
    notes:      document.getElementById('sm2-notes').value.trim(),
    rows:       rows,
  };

  try {
    const r = await fetch('/api/am/settlement/', {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.success) {
      const ref = d.record?.refNumber || '';
      const profit = Number(d.record?.netProfit||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      if (document.getElementById('sm2-sum-ref')) document.getElementById('sm2-sum-ref').textContent = `آخر سند: ${ref}`;
      alToast(`✅ تم السند ${ref} — الربح: ${profit}`, 'success', '✅');
      if (d.warning) alToast(d.warning, 'warning', '⚠️');
      // تنظيف
      document.getElementById('sm2-center').value = '';
      document.getElementById('sm2-notes').value  = '';
      document.getElementById('sm2-rows').innerHTML = '';
      _sm2RowId = 0;
      sm2AddRow();
      sm2Calc();
      sm2Load();
    } else {
      alToast(d.message || 'حدث خطأ','error','❌');
    }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function sm2Delete(id, ref) {
  if (!confirm(`هل تريد حذف السند ${ref}؟`)) return;
  try {
    const r = await fetch(`/api/am/settlement/${id}/`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    const d = await r.json();
    if (d.success) { alToast(d.message||'تم الحذف','success','🗑️'); sm2Load(); }
    else alToast(d.message||'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function sm2Edit(id) {
  try {
    const r = await fetch(`/api/am/settlement/${id}/`, {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast('تعذّر تحميل السند','error','❌'); return; }
    const v = d.record;
    document.getElementById('sm2-center').value = v.centerName || '';
    document.getElementById('sm2-notes').value  = v.notes || '';
    document.getElementById('sm2-rows').innerHTML = '';
    _sm2RowId = 0;
    (v.rows || []).forEach(row => sm2AddRow(row));
    sm2Calc();
    document.getElementById('sp-settlement-move')?.scrollIntoView({behavior:'smooth',block:'start'});
    alToast('تم تحميل بيانات السند — عدّل ثم اضغط موافق لحفظ سند جديد','warning','✏️');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function sm2Reverse(id, ref) {
  if (!confirm(`هل تريد عكس القيد ${ref}؟ سيُنشئ سند جديد بالقيم المعكوسة.`)) return;
  try {
    const r = await fetch(`/api/am/settlement/${id}/`, {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast('تعذّر تحميل السند','error','❌'); return; }
    const v = d.record;
    document.getElementById('sm2-center').value = v.centerName || '';
    document.getElementById('sm2-notes').value  = `عكس ${v.refNumber}`;
    document.getElementById('sm2-rows').innerHTML = '';
    _sm2RowId = 0;
    // عكس الأجور: لنا ↔ علينا
    (v.rows || []).forEach(row => sm2AddRow({
      ...row,
      feeUs:   row.feeThem,
      feeThem: row.feeUs,
    }));
    sm2Calc();
    document.getElementById('sp-settlement-move')?.scrollIntoView({behavior:'smooth',block:'start'});
    alToast('تم تحميل القيد المعكوس — راجع البيانات ثم اضغط موافق','warning','🔄');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

// ══════════════════════════════════════════════════════════════════
// قيد افتتاحي
// ══════════════════════════════════════════════════════════════════
let _oeAll = [], _oeFiltered = [], _oePage = 1, _oePerPage = 20;
let _oeSortCol = 'id', _oeSortAsc = false;

async function oeLoadCenters() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    const sel = document.getElementById('oe-center');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">اختر المركز</option>';
    list.forEach(c => {
      const nm = c.name || c.center_name || c.centerName || String(c);
      const op = document.createElement('option');
      op.value = nm; op.textContent = nm;
      sel.appendChild(op);
    });
    if (cur) sel.value = cur;
  } catch {}
}

function oeCalc() {
  // حساب الرصيد الحي من الحقول المدخلة فقط (يُحدَّث عند تحميل القائمة)
  const totUs   = _oeAll.filter(r=>r.entryType==='us').reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const totThem = _oeAll.filter(r=>r.entryType==='them').reduce((s,r)=>s+parseFloat(r.amount||0),0);
  const bal     = totUs - totThem;
  const fmt = v => v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const balEl = document.getElementById('oe-live-balance');
  if (balEl) {
    balEl.textContent = (bal >= 0 ? '+' : '') + fmt(bal);
    balEl.style.color = bal >= 0 ? '#16A34A' : '#DC2626';
  }
  const usEl  = document.getElementById('oe-tot-us');
  const thEl  = document.getElementById('oe-tot-them');
  const blEl  = document.getElementById('oe-tot-bal');
  if (usEl)  usEl.textContent  = `لنا: ${fmt(totUs)}`;
  if (thEl)  thEl.textContent  = `علينا: ${fmt(totThem)}`;
  if (blEl) {
    blEl.textContent = `الميزان: ${(bal>=0?'+':'')}${fmt(bal)}`;
    blEl.style.color = bal>=0?'#86EFAC':'#FCA5A5';
  }
}

function oeFilter(q) {
  const term = (q || document.getElementById('oe-search')?.value || '').trim().toLowerCase();
  _oeFiltered = term
    ? _oeAll.filter(r =>
        (r.centerName||'').toLowerCase().includes(term) ||
        (r.refNumber||'').toLowerCase().includes(term)  ||
        (r.notes||'').toLowerCase().includes(term))
    : [..._oeAll];
  _oePage = 1;
  oeRender();
}

function oeSort(col) {
  if (_oeSortCol === col) _oeSortAsc = !_oeSortAsc;
  else { _oeSortCol = col; _oeSortAsc = true; }
  _oeFiltered.sort((a,b) => {
    let va = a[col]||'', vb = b[col]||'';
    if (!isNaN(va) && !isNaN(vb)) { va = parseFloat(va); vb = parseFloat(vb); }
    if (va < vb) return _oeSortAsc ? -1 : 1;
    if (va > vb) return _oeSortAsc ?  1 : -1;
    return 0;
  });
  oeRender();
}

function oeRender(page) {
  if (page !== undefined) _oePage = page;
  const perPageEl = document.getElementById('oe-per-page');
  if (perPageEl) _oePerPage = parseInt(perPageEl.value) || 20;
  const tbody = document.getElementById('oe-tbody');
  if (!tbody) return;
  const total = _oeFiltered.length;
  const pages = Math.max(1, Math.ceil(total / _oePerPage));
  _oePage = Math.min(Math.max(1, _oePage), pages);
  const offset = (_oePage - 1) * _oePerPage;
  const slice  = _oeFiltered.slice(offset, offset + _oePerPage);

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">لا توجد سجلات</td></tr>';
  } else {
    tbody.innerHTML = slice.map((r, i) => {
      const typeLabel = r.entryType === 'us'
        ? '<span style="background:rgba(74,222,128,.15);color:#4ADE80;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;border:1px solid rgba(74,222,128,.3)">لنا</span>'
        : '<span style="background:rgba(252,165,165,.15);color:#FCA5A5;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;border:1px solid rgba(252,165,165,.3)">علينا</span>';
      const amt = parseFloat(r.amount||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      const bg = i%2===0?'#1E3A5F':'#162d4a';
      return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
        <td style="padding:7px 10px;font-size:12px;color:rgba(255,255,255,.7)">${r.refNumber||'-'}</td>
        <td style="padding:7px 10px;text-align:center">${typeLabel}</td>
        <td style="padding:7px 10px;font-size:12.5px;font-weight:600;color:#fff">${r.centerName||'-'}</td>
        <td style="padding:7px 10px;font-size:13px;font-weight:700;color:${r.entryType==='us'?'#4ADE80':'#FCA5A5'}">${amt} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.currency||''}</span></td>
        <td style="padding:7px 10px;font-size:12px;color:#fff">${r.entryDate||'-'}</td>
        <td style="padding:7px 10px;font-size:11.5px;color:rgba(255,255,255,.7);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes||'-'}</td>
        <td style="padding:7px 10px;text-align:center">
          <button onclick="oeDelete(${r.id},'${r.refNumber}')" style="background:rgba(252,165,165,.15);color:#FCA5A5;border:1px solid rgba(252,165,165,.3);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px">✕</button>
        </td>
      </tr>`;
    }).join('');
  }

  const prevBtn  = document.getElementById('oe-prev');
  const nextBtn  = document.getElementById('oe-next');
  const pagesEl  = document.getElementById('oe-pages');
  const showEl   = document.getElementById('oe-showing');
  if (prevBtn) prevBtn.disabled = _oePage <= 1;
  if (nextBtn) nextBtn.disabled = _oePage >= pages;
  if (pagesEl) pagesEl.textContent = `${_oePage} / ${pages}`;
  if (showEl)  showEl.textContent  = total ? `${offset+1}–${Math.min(offset+_oePerPage,total)} من ${total}` : '—';
}

function oeExportCSV() {
  if (!_oeFiltered.length) { alToast('لا توجد بيانات للتصدير','warning','⚠️'); return; }
  const headers = ['رقم القيد','النوع','المركز','المبلغ','العملة','التاريخ','ملاحظات'];
  const rows = _oeFiltered.map(r => [
    r.refNumber||'', r.entryType==='us'?'لنا':'علينا',
    r.centerName||'', r.amount||0, r.currency||'',
    r.entryDate||'', (r.notes||'').replace(/,/g,' '),
  ]);
  const csv = '﻿' + [headers, ...rows].map(r=>r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'opening-entry.csv';
  a.click();
}

async function oeLoad() {
  oeLoadCenters();
  const dateEl = document.getElementById('oe-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  try {
    const r = await fetch('/api/am/opening-entry/?per_page=500', {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast(d.message||'خطأ','error','❌'); return; }
    _oeAll = d.records || [];
    _oeFiltered = [..._oeAll];
    oeCalc();
    oeRender();
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function oeSave() {
  const centerName = document.getElementById('oe-center')?.value || '';
  const currency   = document.getElementById('oe-currency')?.value || 'USD';
  const amount     = parseFloat(document.getElementById('oe-amount')?.value || 0);
  const entryType  = document.getElementById('oe-type')?.value || 'us';
  const notes      = document.getElementById('oe-notes')?.value?.trim() || '';
  const entryDate  = document.getElementById('oe-date')?.value || '';

  if (!centerName) { alToast('اختر المركز / العميل','warning','⚠️'); return; }
  if (!amount || amount <= 0) { alToast('أدخل مبلغاً أكبر من الصفر','warning','⚠️'); return; }

  try {
    const r = await fetch('/api/am/opening-entry/', {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify({centerName, currency, amount, entryType, notes, entryDate}),
    });
    const d = await r.json();
    if (d.success) {
      alToast(d.message || 'تم إنشاء القيد الافتتاحي','success','✅');
      // إعادة تعيين الحقول
      document.getElementById('oe-center').value = '';
      document.getElementById('oe-amount').value = '';
      document.getElementById('oe-notes').value  = '';
      document.getElementById('oe-type').value   = 'us';
      oeLoad();
    } else {
      alToast(d.message || 'حدث خطأ','error','❌');
    }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function oeDelete(id, ref) {
  if (!confirm(`هل تريد حذف القيد ${ref}؟`)) return;
  try {
    const r = await fetch(`/api/am/opening-entry/${id}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {'X-CSRFToken':_getCsrf()},
    });
    const d = await r.json();
    if (d.success) { alToast(d.message||'تم الحذف','success','🗑️'); oeLoad(); }
    else alToast(d.message||'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

// ══════════════════════════════════════════════════════════════════
// سند قبض
// ══════════════════════════════════════════════════════════════════
let _rvAll = [], _rvFiltered = [], _rvPage = 1, _rvPerPage = 10;
let _rvSortCol = 'id', _rvSortAsc = false;

async function rvLoadCenters() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    ['rv-from-center','rv-to-center'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">اختر المركز</option>';
      list.forEach(c => {
        const nm = c.name || c.center_name || c.centerName || String(c);
        const op = document.createElement('option');
        op.value = nm; op.textContent = nm;
        sel.appendChild(op);
      });
      if (cur) sel.value = cur;
    });
  } catch {}
}

function rvCalc() {
  const fromAmt  = parseFloat(document.getElementById('rv-from-amount')?.value) || 0;
  const cutRate  = parseFloat(document.getElementById('rv-cut-val')?.value) || 1;
  const cutDir   = document.getElementById('rv-cut-dir')?.value || 'mul';
  const fromFee  = parseFloat(document.getElementById('rv-from-fee')?.value) || 0;
  const toFee    = parseFloat(document.getElementById('rv-to-fee')?.value) || 0;
  const fromCur  = document.getElementById('rv-from-currency')?.value || 'USD';
  const toCur    = document.getElementById('rv-to-currency')?.value || 'USD';

  // حساب مبلغ الاستلام
  const toAmt = cutDir === 'mul' ? fromAmt * cutRate : fromAmt / cutRate;
  const toEl  = document.getElementById('rv-to-amount');
  if (toEl && !toEl.dataset.manual) toEl.value = toAmt ? toAmt.toFixed(3) : '';

  // شريط تقدم أصفر
  const maxAmt = Math.max(fromAmt, toAmt, 1);
  const fromBarEl = document.getElementById('rv-from-bar');
  const toBarEl   = document.getElementById('rv-to-bar');
  if (fromBarEl) fromBarEl.style.width = Math.min(100, (fromAmt/maxAmt)*100) + '%';
  if (toBarEl)   toBarEl.style.width   = Math.min(100, (toAmt/maxAmt)*100) + '%';

  // تحديث رقم المرجع التوقعي
  const refBadge = document.getElementById('rv-ref-badge');
  if (refBadge) refBadge.textContent = 'RV-' + new Date().toISOString().slice(2,8).replace(/-/g,'') + '-XXXX';
}

function rvFilter(q) {
  const term = (q || '').trim().toLowerCase();
  _rvFiltered = term
    ? _rvAll.filter(r =>
        (r.refNumber||'').toLowerCase().includes(term)  ||
        (r.fromCenter||'').toLowerCase().includes(term) ||
        (r.toCenter||'').toLowerCase().includes(term)   ||
        (r.fromNotes||'').toLowerCase().includes(term))
    : [..._rvAll];
  _rvPage = 1;
  rvRender();
}

function rvSort(col) {
  if (_rvSortCol === col) _rvSortAsc = !_rvSortAsc;
  else { _rvSortCol = col; _rvSortAsc = true; }
  _rvFiltered.sort((a,b) => {
    let va = a[col]||'', vb = b[col]||'';
    if (!isNaN(va) && !isNaN(vb)) { va = parseFloat(va); vb = parseFloat(vb); }
    if (va < vb) return _rvSortAsc ? -1 : 1;
    if (va > vb) return _rvSortAsc ?  1 : -1;
    return 0;
  });
  rvRender();
}

function rvRender(page) {
  if (page !== undefined) _rvPage = page;
  const perPageEl = document.getElementById('rv-per-page');
  if (perPageEl) _rvPerPage = parseInt(perPageEl.value) || 10;
  const tbody = document.getElementById('rv-tbody');
  if (!tbody) return;
  const total  = _rvFiltered.length;
  const pages  = Math.max(1, Math.ceil(total / _rvPerPage));
  _rvPage = Math.min(Math.max(1, _rvPage), pages);
  const offset = (_rvPage - 1) * _rvPerPage;
  const slice  = _rvFiltered.slice(offset, offset + _rvPerPage);
  const fmt    = v => parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">لا توجد سجلات</td></tr>';
  } else {
    tbody.innerHTML = slice.map((r,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
      <td style="padding:7px 10px;font-size:11.5px;color:rgba(255,255,255,.7)">${r.refNumber||'-'}</td>
      <td style="padding:7px 10px;font-size:12px;font-weight:600;color:#fff">${r.fromCenter||'-'}</td>
      <td style="padding:7px 10px;font-size:12px;font-weight:600;color:#fff">${r.toCenter||'-'}</td>
      <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#4ADE80">${fmt(r.fromAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.fromCurrency||''}</span></td>
      <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#FCA5A5">${fmt(r.toAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.toCurrency||''}</span></td>
      <td style="padding:7px 10px;font-size:12px;color:#fff">${r.entryDate||'-'}</td>
      <td style="padding:7px 10px;font-size:11.5px;color:rgba(255,255,255,.7);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.fromNotes||'-'}</td>
      <td style="padding:7px 10px;text-align:center">
        <button onclick="rvDelete(${r.id},'${r.refNumber}')" style="background:rgba(252,165,165,.15);color:#FCA5A5;border:1px solid rgba(252,165,165,.3);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px">✕</button>
      </td>
    </tr>`; }).join('');
  }

  const prevBtn = document.getElementById('rv-prev');
  const nextBtn = document.getElementById('rv-next');
  const pagesEl = document.getElementById('rv-pages');
  const showEl  = document.getElementById('rv-showing');
  if (prevBtn) prevBtn.disabled = _rvPage <= 1;
  if (nextBtn) nextBtn.disabled = _rvPage >= pages;
  if (pagesEl) pagesEl.textContent = `${_rvPage} / ${pages}`;
  if (showEl)  showEl.textContent  = total ? `${offset+1}–${Math.min(offset+_rvPerPage,total)} من ${total}` : '—';

  // تحديث شريط الملخص
  const totFrom   = _rvAll.reduce((s,r)=>s+parseFloat(r.fromAmount||0),0);
  const totTo     = _rvAll.reduce((s,r)=>s+parseFloat(r.toAmount||0),0);
  const totProfit = _rvAll.reduce((s,r)=>s+parseFloat(r.netProfit||0),0);
  const fmtN = v => v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const sumFromEl   = document.getElementById('rv-sum-from');
  const sumToEl     = document.getElementById('rv-sum-to');
  const sumProfEl   = document.getElementById('rv-sum-profit');
  if (sumFromEl)  sumFromEl.textContent   = `لنا: ${fmtN(totFrom)}`;
  if (sumToEl)    sumToEl.textContent     = `علينا: ${fmtN(totTo)}`;
  if (sumProfEl)  sumProfEl.textContent   = `الربح: ${fmtN(totProfit)}`;
}

async function rvLoad() {
  rvLoadCenters();
  const dateEl = document.getElementById('rv-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  rvCalc();
  try {
    const r = await fetch('/api/am/receipt-voucher/?per_page=500', {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast(d.message||'خطأ','error','❌'); return; }
    _rvAll      = d.records || [];
    _rvFiltered = [..._rvAll];
    rvRender();
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function rvSave() {
  const fromCenter   = document.getElementById('rv-from-center')?.value || '';
  const fromCurrency = document.getElementById('rv-from-currency')?.value || 'USD';
  const fromAmount   = parseFloat(document.getElementById('rv-from-amount')?.value || 0);
  const fromFee      = parseFloat(document.getElementById('rv-from-fee')?.value || 0);
  const fromNotes    = document.getElementById('rv-from-notes')?.value?.trim() || '';
  const cutRate      = parseFloat(document.getElementById('rv-cut-val')?.value || 1);
  const cutDir       = document.getElementById('rv-cut-dir')?.value || 'mul';
  const toCenter     = document.getElementById('rv-to-center')?.value || '';
  const toCurrency   = document.getElementById('rv-to-currency')?.value || 'USD';
  const toAmount     = parseFloat(document.getElementById('rv-to-amount')?.value || 0);
  const toFee        = parseFloat(document.getElementById('rv-to-fee')?.value || 0);
  const toNotes      = document.getElementById('rv-to-notes')?.value?.trim() || '';
  const entryDate    = document.getElementById('rv-date')?.value || '';

  if (!fromCenter)        { alToast('اختر المركز المرسل','warning','⚠️'); return; }
  if (!toCenter)          { alToast('اختر المركز المستلم','warning','⚠️'); return; }
  if (!fromAmount || fromAmount <= 0) { alToast('أدخل مبلغاً أكبر من الصفر','warning','⚠️'); return; }

  const confirmedRv = await amConfirmDialog('تأكيد سند القبض', [
    { label:'المركز المرسل (من)', value: fromCenter || '—' },
    { label:'المبلغ المرسل',      value: `${_fmtConfirm(fromAmount)} ${fromCurrency}`, color:'#16a34a' },
    { label:'المركز المستلم (الى)', value: toCenter || '—' },
    { label:'المبلغ المستلم',     value: `${_fmtConfirm(toAmount)} ${toCurrency}`, color:'#dc2626' },
  ]);
  if (!confirmedRv) return;

  try {
    const r = await fetch('/api/am/receipt-voucher/', {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify({fromCenter, fromCurrency, fromAmount, fromFee, fromNotes,
                            cutRate, cutDir, toCenter, toCurrency, toAmount, toFee, toNotes, entryDate}),
    });
    const d = await r.json();
    if (d.success) {
      alToast(d.message || 'تم إنشاء سند القبض','success','✅');
      // إعادة تعيين الحقول
      ['rv-from-amount','rv-from-fee','rv-to-amount','rv-to-fee','rv-from-notes','rv-to-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = el.type==='number'&&el.id.includes('fee')?'0':''; delete el.dataset.manual; }
      });
      document.getElementById('rv-cut-val').value = '1';
      document.getElementById('rv-ref-badge').textContent = d.record?.refNumber || 'XXX';
      rvLoad();
    } else {
      alToast(d.message || 'حدث خطأ','error','❌');
    }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function rvDelete(id, ref) {
  if (!confirm(`هل تريد حذف سند القبض ${ref}؟`)) return;
  try {
    const r = await fetch(`/api/am/receipt-voucher/${id}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {'X-CSRFToken':_getCsrf()},
    });
    const d = await r.json();
    if (d.success) { alToast(d.message||'تم الحذف','success','🗑️'); rvLoad(); }
    else alToast(d.message||'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

function rvExportCSV() {
  if (!_rvFiltered.length) { alToast('لا توجد بيانات للتصدير','warning','⚠️'); return; }
  const headers = ['رقم السند','من','الى','المبلغ لنا','العملة','المبلغ علينا','العملة','التاريخ','ملاحظات'];
  const rows = _rvFiltered.map(r => [
    r.refNumber||'', r.fromCenter||'', r.toCenter||'',
    r.fromAmount||0, r.fromCurrency||'', r.toAmount||0, r.toCurrency||'',
    r.entryDate||'', (r.fromNotes||'').replace(/,/g,' '),
  ]);
  const csv = '﻿' + [headers,...rows].map(r=>r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = 'receipt-voucher.csv';
  a.click();
}

// ══════════════════════════════════════════════════════════════════
// سند دفع
// ══════════════════════════════════════════════════════════════════
let _pvAll = [], _pvFiltered = [], _pvPage = 1, _pvPerPage = 10;
let _pvSortCol = 'id', _pvSortAsc = false;

async function pvLoadCenters() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    ['pv-from-center','pv-to-center'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">اختر المركز</option>';
      list.forEach(c => {
        const nm = c.name || c.center_name || c.centerName || String(c);
        const op = document.createElement('option');
        op.value = nm; op.textContent = nm;
        sel.appendChild(op);
      });
      if (cur) sel.value = cur;
    });
  } catch {}
}

function pvCalc() {
  const fromAmt = parseFloat(document.getElementById('pv-from-amount')?.value) || 0;
  const cutRate = parseFloat(document.getElementById('pv-cut-val')?.value) || 1;
  const cutDir  = document.getElementById('pv-cut-dir')?.value || 'mul';

  const toAmt = cutDir === 'mul' ? fromAmt * cutRate : fromAmt / cutRate;
  const toEl  = document.getElementById('pv-to-amount');
  if (toEl && !toEl.dataset.manual) toEl.value = toAmt ? toAmt.toFixed(3) : '';

  const maxAmt = Math.max(fromAmt, toAmt, 1);
  const fbEl = document.getElementById('pv-from-bar');
  const tbEl = document.getElementById('pv-to-bar');
  if (fbEl) fbEl.style.width = Math.min(100,(fromAmt/maxAmt)*100)+'%';
  if (tbEl) tbEl.style.width = Math.min(100,(toAmt/maxAmt)*100)+'%';

  const refBadge = document.getElementById('pv-ref-badge');
  if (refBadge) refBadge.textContent = 'PV-'+new Date().toISOString().slice(2,8).replace(/-/g,'')+'-XXXX';
}

function pvFilter(q) {
  const term = (q||'').trim().toLowerCase();
  _pvFiltered = term
    ? _pvAll.filter(r =>
        (r.refNumber||'').toLowerCase().includes(term)  ||
        (r.fromCenter||'').toLowerCase().includes(term) ||
        (r.toCenter||'').toLowerCase().includes(term)   ||
        (r.fromNotes||'').toLowerCase().includes(term))
    : [..._pvAll];
  _pvPage = 1;
  pvRender();
}

function pvSort(col) {
  if (_pvSortCol === col) _pvSortAsc = !_pvSortAsc;
  else { _pvSortCol = col; _pvSortAsc = true; }
  _pvFiltered.sort((a,b) => {
    let va = a[col]||'', vb = b[col]||'';
    if (!isNaN(va)&&!isNaN(vb)){ va=parseFloat(va); vb=parseFloat(vb); }
    if (va<vb) return _pvSortAsc?-1:1;
    if (va>vb) return _pvSortAsc?1:-1;
    return 0;
  });
  pvRender();
}

function pvRender(page) {
  if (page !== undefined) _pvPage = page;
  const perPageEl = document.getElementById('pv-per-page');
  if (perPageEl) _pvPerPage = parseInt(perPageEl.value)||10;
  const tbody = document.getElementById('pv-tbody');
  if (!tbody) return;
  const total  = _pvFiltered.length;
  const pages  = Math.max(1, Math.ceil(total/_pvPerPage));
  _pvPage = Math.min(Math.max(1,_pvPage), pages);
  const offset = (_pvPage-1)*_pvPerPage;
  const slice  = _pvFiltered.slice(offset, offset+_pvPerPage);
  const fmt    = v => parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  tbody.innerHTML = slice.length ? slice.map((r,i)=>{ const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td style="padding:7px 10px;font-size:11.5px;color:rgba(255,255,255,.7)">${r.refNumber||'-'}</td>
    <td style="padding:7px 10px;font-size:12px;font-weight:600;color:#fff">${r.fromCenter||'-'}</td>
    <td style="padding:7px 10px;font-size:12px;font-weight:600;color:#fff">${r.toCenter||'-'}</td>
    <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#4ADE80">${fmt(r.fromAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.fromCurrency||''}</span></td>
    <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#C4B5FD">${fmt(r.toAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.toCurrency||''}</span></td>
    <td style="padding:7px 10px;font-size:12px;color:#fff">${r.entryDate||'-'}</td>
    <td style="padding:7px 10px;font-size:11.5px;color:rgba(255,255,255,.7);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.fromNotes||'-'}</td>
    <td style="padding:7px 10px;text-align:center">
      <button onclick="pvDelete(${r.id},'${r.refNumber}')" style="background:rgba(196,181,253,.15);color:#C4B5FD;border:1px solid rgba(196,181,253,.3);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px">✕</button>
    </td>
  </tr>`; }).join('') : '<tr><td colspan="8" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">لا توجد سجلات</td></tr>';

  const prevBtn = document.getElementById('pv-prev');
  const nextBtn = document.getElementById('pv-next');
  const pagesEl = document.getElementById('pv-pages');
  const showEl  = document.getElementById('pv-showing');
  if (prevBtn) prevBtn.disabled = _pvPage<=1;
  if (nextBtn) nextBtn.disabled = _pvPage>=pages;
  if (pagesEl) pagesEl.textContent = `${_pvPage} / ${pages}`;
  if (showEl)  showEl.textContent  = total ? `${offset+1}–${Math.min(offset+_pvPerPage,total)} من ${total}` : '—';

  const fmtN = v => v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const totFrom   = _pvAll.reduce((s,r)=>s+parseFloat(r.fromAmount||0),0);
  const totTo     = _pvAll.reduce((s,r)=>s+parseFloat(r.toAmount||0),0);
  const totProfit = _pvAll.reduce((s,r)=>s+parseFloat(r.netProfit||0),0);
  const sfEl = document.getElementById('pv-sum-from');
  const stEl = document.getElementById('pv-sum-to');
  const spEl = document.getElementById('pv-sum-profit');
  if (sfEl) sfEl.textContent = `لنا: ${fmtN(totFrom)}`;
  if (stEl) stEl.textContent = `علينا: ${fmtN(totTo)}`;
  if (spEl) spEl.textContent = `الربح: ${fmtN(totProfit)}`;
}

async function pvLoad() {
  pvLoadCenters();
  const dateEl = document.getElementById('pv-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  pvCalc();
  try {
    const r = await fetch('/api/am/payment-voucher/?per_page=500', {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast(d.message||'خطأ','error','❌'); return; }
    _pvAll = d.records||[];
    _pvFiltered = [..._pvAll];
    pvRender();
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function pvSave() {
  const fromCenter   = document.getElementById('pv-from-center')?.value||'';
  const fromCurrency = document.getElementById('pv-from-currency')?.value||'USD';
  const fromAmount   = parseFloat(document.getElementById('pv-from-amount')?.value||0);
  const fromFee      = parseFloat(document.getElementById('pv-from-fee')?.value||0);
  const fromNotes    = document.getElementById('pv-from-notes')?.value?.trim()||'';
  const cutRate      = parseFloat(document.getElementById('pv-cut-val')?.value||1);
  const cutDir       = document.getElementById('pv-cut-dir')?.value||'mul';
  const toCenter     = document.getElementById('pv-to-center')?.value||'';
  const toCurrency   = document.getElementById('pv-to-currency')?.value||'USD';
  const toAmount     = parseFloat(document.getElementById('pv-to-amount')?.value||0);
  const toFee        = parseFloat(document.getElementById('pv-to-fee')?.value||0);
  const toNotes      = document.getElementById('pv-to-notes')?.value?.trim()||'';
  const entryDate    = document.getElementById('pv-date')?.value||'';

  if (!fromCenter) { alToast('اختر المركز المرسل','warning','⚠️'); return; }
  if (!toCenter)   { alToast('اختر المركز المستلم','warning','⚠️'); return; }
  if (!fromAmount||fromAmount<=0) { alToast('أدخل مبلغاً أكبر من الصفر','warning','⚠️'); return; }

  const confirmedPv = await amConfirmDialog('تأكيد سند الدفع', [
    { label:'المركز المرسل (من)', value: fromCenter || '—' },
    { label:'المبلغ المرسل',      value: `${_fmtConfirm(fromAmount)} ${fromCurrency}`, color:'#16a34a' },
    { label:'المركز المستلم (الى)', value: toCenter || '—' },
    { label:'المبلغ المستلم',     value: `${_fmtConfirm(toAmount)} ${toCurrency}`, color:'#dc2626' },
  ]);
  if (!confirmedPv) return;

  try {
    const r = await fetch('/api/am/payment-voucher/', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify({fromCenter,fromCurrency,fromAmount,fromFee,fromNotes,
                            cutRate,cutDir,toCenter,toCurrency,toAmount,toFee,toNotes,entryDate}),
    });
    const d = await r.json();
    if (d.success) {
      alToast(d.message||'تم إنشاء سند الدفع','success','✅');
      ['pv-from-amount','pv-from-fee','pv-to-amount','pv-to-fee','pv-from-notes','pv-to-notes'].forEach(id=>{
        const el = document.getElementById(id);
        if (el){ el.value = el.type==='number'&&el.id.includes('fee')?'0':''; delete el.dataset.manual; }
      });
      document.getElementById('pv-cut-val').value = '1';
      document.getElementById('pv-ref-badge').textContent = d.record?.refNumber||'XXX';
      pvLoad();
    } else { alToast(d.message||'حدث خطأ','error','❌'); }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function pvDelete(id, ref) {
  if (!confirm(`هل تريد حذف سند الدفع ${ref}؟`)) return;
  try {
    const r = await fetch(`/api/am/payment-voucher/${id}/`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    const d = await r.json();
    if (d.success) { alToast(d.message||'تم الحذف','success','🗑️'); pvLoad(); }
    else alToast(d.message||'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

function pvExportCSV() {
  if (!_pvFiltered.length) { alToast('لا توجد بيانات للتصدير','warning','⚠️'); return; }
  const headers = ['رقم السند','من','الى','المبلغ لنا','العملة','المبلغ علينا','العملة','التاريخ','ملاحظات'];
  const rows = _pvFiltered.map(r=>[
    r.refNumber||'', r.fromCenter||'', r.toCenter||'',
    r.fromAmount||0, r.fromCurrency||'', r.toAmount||0, r.toCurrency||'',
    r.entryDate||'', (r.fromNotes||'').replace(/,/g,' '),
  ]);
  const csv = '﻿'+[headers,...rows].map(r=>r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = 'payment-voucher.csv';
  a.click();
}

// ══ عدد حوالات المراكز ══
let _tcAll = [], _tcFiltered = [], _tcSortCol = 'id', _tcSortAsc = true, _tcPage = 1;

function tcInit() {
  const today = new Date();
  const from  = new Date(today); from.setMonth(from.getMonth() - 1);
  const fmt   = d => d.toISOString().split('T')[0];
  const fromEl = document.getElementById('tc-date-from');
  const toEl   = document.getElementById('tc-date-to');
  if (fromEl && !fromEl.value) fromEl.value = fmt(from);
  if (toEl   && !toEl.value)   toEl.value   = fmt(today);
  document.getElementById('tc-tbody').innerHTML =
    '<tr><td colspan="10" class="sp-empty">اختر نطاق تاريخ واضغط بحث</td></tr>';
  document.getElementById('tc-showing').textContent = '—';
  document.getElementById('tc-pages').innerHTML = '';
}

async function tcLoad() {
  const from = document.getElementById('tc-date-from').value;
  const to   = document.getElementById('tc-date-to').value;
  if (!from || !to) { alToast('يرجى تحديد التاريخين','error','❌'); return; }
  document.getElementById('tc-tbody').innerHTML =
    '<tr><td colspan="10" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch(`/api/transfer-count/?from=${from}&to=${to}`, {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.counts || []);
    _tcAll = list; _tcFiltered = [..._tcAll];
    document.getElementById('sp-count').textContent = `— ${_tcAll.length} مركز`;
    tcRender(1);
  } catch {
    _tcAll = []; _tcFiltered = [];
    document.getElementById('tc-tbody').innerHTML =
      '<tr><td colspan="10" class="sp-empty">📭 لا توجد بيانات لهذه الفترة</td></tr>';
    document.getElementById('tc-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('tc-pages').innerHTML = '';
  }
}

function tcRender(p) {
  const total   = _tcFiltered.length;
  const perPage = parseInt(document.getElementById('tc-per-page').value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _tcPage = Math.min(Math.max(1, p), maxPage);
  const start = (_tcPage - 1) * perPage;
  const slice = _tcFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('tc-tbody');

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="10" class="sp-empty">📭 لا توجد بيانات لهذه الفترة</td></tr>';
    document.getElementById('tc-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('tc-pages').innerHTML = '';
    document.getElementById('tc-prev').disabled = true;
    document.getElementById('tc-next').disabled = true;
    return;
  }

  const fmtOut = v => v != null && v !== 0
    ? `<span style="color:#FCA5A5;font-weight:700">${Number(v).toLocaleString('en-US')}</span>`
    : '<span style="color:rgba(255,255,255,.3)">0</span>';
  const fmtIn = v => v != null && v !== 0
    ? `<span style="color:#4ADE80;font-weight:700">${Number(v).toLocaleString('en-US')}</span>`
    : '<span style="color:rgba(255,255,255,.3)">0</span>';
  const fmtTotal = v => v != null && v !== 0
    ? `<span style="font-weight:900;font-size:12px;color:#93C5FD">${Number(v).toLocaleString('en-US')}</span>`
    : '<span style="color:rgba(255,255,255,.3)">0</span>';

  tbody.innerHTML = slice.map((c,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td class="sp-num" style="color:rgba(255,255,255,.7)">${c.id}</td>
    <td style="color:#fff"><strong>${c.name || '—'}</strong></td>
    <td class="sp-num">${fmtOut(c.out_lira)}</td>
    <td class="sp-num">${fmtOut(c.out_dollar)}</td>
    <td class="sp-num">${fmtOut(c.out_euro)}</td>
    <td class="sp-num" style="background:rgba(252,165,165,.08)">${fmtTotal(c.out_total)}</td>
    <td class="sp-num">${fmtIn(c.in_lira)}</td>
    <td class="sp-num">${fmtIn(c.in_dollar)}</td>
    <td class="sp-num">${fmtIn(c.in_euro)}</td>
    <td class="sp-num" style="background:rgba(74,222,128,.08)">${fmtTotal(c.in_total)}</td>
  </tr>`; }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('tc-showing').textContent = `يعرض ${start+1} إلى ${end} من أصل ${total}`;

  const pg = document.getElementById('tc-pages');
  pg.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _tcPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => tcRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('tc-prev').disabled = _tcPage <= 1;
  document.getElementById('tc-next').disabled = _tcPage >= maxPage;
}

function tcFilter(q) {
  const t = q.trim().toLowerCase();
  _tcFiltered = !t ? [..._tcAll] : _tcAll.filter(c =>
    (c.name||'').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_tcFiltered.length} مركز`;
  tcRender(1);
}

function tcSort(col) {
  if (_tcSortCol === col) _tcSortAsc = !_tcSortAsc;
  else { _tcSortCol = col; _tcSortAsc = true; }
  document.querySelectorAll('.tc-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('tc-sa-' + col); if (el) el.textContent = _tcSortAsc ? '↑' : '↓';
  _tcFiltered.sort((a, b) => {
    const va = a[col] ?? 0, vb = b[col] ?? 0;
    return _tcSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  tcRender(1);
}

function tcExportCSV() {
  const hdr  = ['#','الاسم','صادر تركي','صادر دولار','صادر يورو','صادر كلي',
                'وارد تركي','وارد دولار','وارد يورو','وارد كلي'].join(',');
  const rows = _tcFiltered.map(c =>
    [c.id, c.name||'', c.out_lira||0, c.out_dollar||0, c.out_euro||0, c.out_total||0,
     c.in_lira||0, c.in_dollar||0, c.in_euro||0, c.in_total||0].join(','));
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'عدد_حوالات_المراكز.csv'; a.click();
}

function tcCopyTable() {
  const hdr  = ['#','الاسم','صادر تركي','صادر دولار','صادر يورو','صادر كلي',
                'وارد تركي','وارد دولار','وارد يورو','وارد كلي'].join('\t');
  const rows = _tcFiltered.map(c =>
    [c.id, c.name||'', c.out_lira||0, c.out_dollar||0, c.out_euro||0, c.out_total||0,
     c.in_lira||0, c.in_dollar||0, c.in_euro||0, c.in_total||0].join('\t'));
  navigator.clipboard.writeText(hdr + '\n' + rows.join('\n'))
    .then(() => alToast('تم النسخ إلى الحافظة','success','📋'))
    .catch(() => alToast('فشل النسخ','error','❌'));
}

// ══ أرباح من المراكز ══
let _cpAll = [], _cpFiltered = [], _cpSortCol = 'id', _cpSortAsc = true, _cpPage = 1;

const CP_COLS = ['lira_tr','dollar','euro','dirham_ae','dinar_dz','pound_eg',
                 'shekel','dinar_jo','riyal_sa','dinar_tn','vodafone_cash',
                 'pound_ps','shekel_bank','shekel_tf','total_profit'];

function cpInit() {
  // ضبط التواريخ الافتراضية: من شهر مضى حتى اليوم
  const today = new Date();
  const from  = new Date(today); from.setMonth(from.getMonth() - 1);
  const fmt   = d => d.toISOString().split('T')[0];
  const fromEl = document.getElementById('cp-date-from');
  const toEl   = document.getElementById('cp-date-to');
  if (fromEl && !fromEl.value) fromEl.value = fmt(from);
  if (toEl   && !toEl.value)   toEl.value   = fmt(today);
  // لا نحمّل تلقائياً — ننتظر ضغط بحث
  document.getElementById('cp-tbody').innerHTML =
    '<tr><td colspan="17" class="sp-empty">اختر نطاق تاريخ واضغط بحث</td></tr>';
  document.getElementById('cp-showing').textContent = '—';
  document.getElementById('cp-pages').innerHTML = '';
}

async function cpLoad() {
  const from = document.getElementById('cp-date-from').value;
  const to   = document.getElementById('cp-date-to').value;
  if (!from || !to) { alToast('يرجى تحديد التاريخين','error','❌'); return; }
  document.getElementById('cp-tbody').innerHTML =
    '<tr><td colspan="17" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch(`/api/center-profits/?from=${from}&to=${to}`, {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.profits || []);
    _cpAll = list; _cpFiltered = [..._cpAll];
    document.getElementById('sp-count').textContent = `— ${_cpAll.length} مركز`;
    cpRender(1);
  } catch {
    _cpAll = []; _cpFiltered = [];
    document.getElementById('cp-tbody').innerHTML =
      '<tr><td colspan="17" class="sp-empty">📭 لا توجد بيانات لهذه الفترة</td></tr>';
    document.getElementById('cp-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('cp-pages').innerHTML = '';
  }
}

function cpRender(p) {
  const total   = _cpFiltered.length;
  const perPage = parseInt(document.getElementById('cp-per-page').value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _cpPage = Math.min(Math.max(1, p), maxPage);
  const start = (_cpPage - 1) * perPage;
  const slice = _cpFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('cp-tbody');

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="17" class="sp-empty">📭 لا توجد بيانات لهذه الفترة</td></tr>';
    document.getElementById('cp-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('cp-pages').innerHTML = '';
    document.getElementById('cp-prev').disabled = true;
    document.getElementById('cp-next').disabled = true;
    return;
  }

  const fmt = v => v != null && v !== 0
    ? `<span style="color:#4ADE80;font-weight:700">${Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`
    : '<span style="color:rgba(255,255,255,.3)">—</span>';
  const fmtTotal = v => v != null && v !== 0
    ? `<span style="color:#93C5FD;font-weight:900;font-size:12px">${Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`
    : '<span style="color:rgba(255,255,255,.3)">—</span>';

  tbody.innerHTML = slice.map((c,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td class="sp-num" style="color:rgba(255,255,255,.7)">${c.id}</td>
    <td style="color:#fff"><strong>${c.name || '—'}</strong></td>
    <td class="sp-num">${fmt(c.lira_tr)}</td>
    <td class="sp-num">${fmt(c.dollar)}</td>
    <td class="sp-num">${fmt(c.euro)}</td>
    <td class="sp-num">${fmt(c.dirham_ae)}</td>
    <td class="sp-num">${fmt(c.dinar_dz)}</td>
    <td class="sp-num">${fmt(c.pound_eg)}</td>
    <td class="sp-num">${fmt(c.shekel)}</td>
    <td class="sp-num">${fmt(c.dinar_jo)}</td>
    <td class="sp-num">${fmt(c.riyal_sa)}</td>
    <td class="sp-num">${fmt(c.dinar_tn)}</td>
    <td class="sp-num">${fmt(c.vodafone_cash)}</td>
    <td class="sp-num">${fmt(c.pound_ps)}</td>
    <td class="sp-num">${fmt(c.shekel_bank)}</td>
    <td class="sp-num">${fmt(c.shekel_tf)}</td>
    <td class="sp-num" style="background:rgba(74,222,128,.08)">${fmtTotal(c.total_profit)}</td>
  </tr>`; }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('cp-showing').textContent = `يعرض ${start+1} إلى ${end} من أصل ${total}`;

  const pg = document.getElementById('cp-pages');
  pg.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _cpPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => cpRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('cp-prev').disabled = _cpPage <= 1;
  document.getElementById('cp-next').disabled = _cpPage >= maxPage;
}

function cpFilter(q) {
  const t = q.trim().toLowerCase();
  _cpFiltered = !t ? [..._cpAll] : _cpAll.filter(c =>
    (c.name||'').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_cpFiltered.length} مركز`;
  cpRender(1);
}

function cpSort(col) {
  if (_cpSortCol === col) _cpSortAsc = !_cpSortAsc;
  else { _cpSortCol = col; _cpSortAsc = true; }
  document.querySelectorAll('.cp-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('cp-sa-' + col); if (el) el.textContent = _cpSortAsc ? '↑' : '↓';
  _cpFiltered.sort((a, b) => {
    const va = a[col] ?? 0, vb = b[col] ?? 0;
    return _cpSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  cpRender(1);
}

function cpExportCSV() {
  const hdr  = ['#','الاسم','ليره تركيه','دولار','يورو','درهم اماراتي','دينار جزائري',
                'جنيه مصر','شيكل','دينار اردني','ريال سعودي','دينار تونسي',
                'فودافون كاش','جنيه فلسطين','شيكل بنك','شيكل تالف','الربح الكلي'].join(',');
  const rows = _cpFiltered.map(c =>
    [c.id, c.name||'', ...CP_COLS.map(k => c[k]||0)].join(','));
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'أرباح_المراكز.csv'; a.click();
}

function cpCopyTable() {
  const hdr  = ['#','الاسم','ليره تركيه','دولار','يورو','درهم اماراتي','دينار جزائري',
                'جنيه مصر','شيكل','دينار اردني','ريال سعودي','دينار تونسي',
                'فودافون كاش','جنيه فلسطين','شيكل بنك','شيكل تالف','الربح الكلي'].join('\t');
  const rows = _cpFiltered.map(c =>
    [c.id, c.name||'', ...CP_COLS.map(k => c[k]||0)].join('\t'));
  navigator.clipboard.writeText(hdr + '\n' + rows.join('\n'))
    .then(() => alToast('تم النسخ إلى الحافظة','success','📋'))
    .catch(() => alToast('فشل النسخ','error','❌'));
}

// ══ الصناديق ══
let _smAll = [], _smFiltered = [], _smSortCol = 'id', _smSortAsc = true, _smPage = 1;
let _smCurrency = 'dollar';
const _smHiddenCols = new Set();

// خريطة العملة → تسمية العمود
const SM_CUR_LABELS = {
  dollar:'دولار', euro:'يورو', lira_tr:'ليرة تركية', shekel:'شيكل',
  dinar_jo:'دينار أردني', riyal_sa:'ريال سعودي', pound_eg:'جنيه مصري', dirham_ae:'درهم اماراتي',
};

function smChangeCurrency() {
  const sel = document.getElementById('sm-currency');
  if (!sel) return;
  _smCurrency = sel.value;
  const label = SM_CUR_LABELS[_smCurrency] || _smCurrency;
  // رؤوس الأعمدة
  const netEl  = document.getElementById('sm-th-net');
  const usEl   = document.getElementById('sm-th-us');
  const themEl = document.getElementById('sm-th-them');
  if (netEl)  netEl.textContent  = `مقوم ${label}`;
  if (usEl)   usEl.textContent   = `${label} لنا`;
  if (themEl) themEl.textContent = `${label} علينا`;
  // نصوص أزرار الإظهار/الإخفاء
  const netBtn  = document.getElementById('sm-col-net');
  const usBtn   = document.getElementById('sm-col-us');
  const themBtn = document.getElementById('sm-col-them');
  if (netBtn)  netBtn.textContent  = `مقوم ${label}`;
  if (usBtn)   usBtn.textContent   = `${label} لنا`;
  if (themBtn) themBtn.textContent = `${label} علينا`;
  smRender(1);
}

function smToggleCol(col) {
  const btn = document.getElementById('sm-col-' + col);
  if (_smHiddenCols.has(col)) {
    _smHiddenCols.delete(col);
    if (btn) btn.classList.remove('sm-col-hidden');
  } else {
    _smHiddenCols.add(col);
    if (btn) btn.classList.add('sm-col-hidden');
  }
  smRender(1);
}

function _smColVis(col) { return !_smHiddenCols.has(col); }

async function smLoad() {
  document.getElementById('sm-tbody').innerHTML =
    '<tr><td colspan="8" class="sm-empty"><div class="sm-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/cost-centers/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    _smAll = list; _smFiltered = [..._smAll];
    document.getElementById('sp-count').textContent = `— ${_smAll.length} صندوق`;
    smRender(1);
  } catch {
    _smAll = []; _smFiltered = [];
    document.getElementById('sm-tbody').innerHTML =
      '<tr><td colspan="8" class="sm-empty">📭 لا توجد بيانات متاحة في الجدول</td></tr>';
    document.getElementById('sm-showing').textContent = '—';
    document.getElementById('sm-pages').innerHTML = '';
  }
}

function smRender(p) {
  if (p !== undefined) _smPage = p;
  const total   = _smFiltered.length;
  const perPage = parseInt(document.getElementById('sm-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _smPage = Math.min(Math.max(1, _smPage), maxPage);
  const start = (_smPage - 1) * perPage;
  const slice = _smFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('sm-tbody');
  if (!tbody) return;

  // إظهار/إخفاء رؤوس الأعمدة
  const colMap = {id:'smh-id', city:'smh-city', name:'smh-name', net:'smh-net', us:'smh-us', them:'smh-them', debt:'smh-debt', stmt:'smh-stmt'};
  Object.entries(colMap).forEach(([k,hid]) => {
    const h = document.getElementById(hid);
    if (h) h.style.display = _smColVis(k) ? '' : 'none';
  });

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="8" class="sm-empty">📭 لا توجد بيانات متاحة في الجدول</td></tr>';
    document.getElementById('sm-showing').textContent = '—';
    document.getElementById('sm-pages').innerHTML = '';
    document.getElementById('sm-prev').disabled = true;
    document.getElementById('sm-next').disabled = true;
    return;
  }

  const fmt = v => v != null ? Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
  const cur = _smCurrency;

  tbody.innerHTML = slice.map((m) => {
    const usVal   = m[cur] || 0;
    const themVal = 0;
    const netVal  = usVal - themVal;
    const debtVal = netVal < 0 ? Math.abs(netVal) : 0;
    const isDebt  = netVal < 0;
    const netColor  = netVal >= 0 ? '#16A34A' : '#DC2626';
    const usColor   = '#16A34A';
    const themColor = '#DC2626';
    const debtColor = isDebt ? '#D97706' : '#CBD5E1';
    return `<tr>
      ${_smColVis('id')   ? `<td class="sm-num" style="color:#94A3B8;font-size:11px">${m.id}</td>` : ''}
      ${_smColVis('city') ? `<td style="color:#64748B">${m.city||'—'}</td>` : ''}
      ${_smColVis('name') ? `<td style="color:#1E293B;font-weight:700">${m.name||'—'}</td>` : ''}
      ${_smColVis('net')  ? `<td class="sm-num" style="color:${netColor};font-weight:700">${fmt(netVal)}</td>` : ''}
      ${_smColVis('us')   ? `<td class="sm-num" style="color:${usColor};font-weight:600">${fmt(usVal)}</td>` : ''}
      ${_smColVis('them') ? `<td class="sm-num" style="color:${themColor};font-weight:600">${fmt(themVal)}</td>` : ''}
      ${_smColVis('debt') ? `<td class="sm-num" style="color:${debtColor};font-weight:${isDebt?'700':'400'}">${isDebt?fmt(debtVal):'—'}</td>` : ''}
      ${_smColVis('stmt') ? `<td style="text-align:center"><button onclick="smViewStatement(${m.id},'${(m.name||'').replace(/'/g,'')}')" style="background:#EEF4FF;color:#2563EB;border:1px solid #BFDBFE;border-radius:5px;padding:3px 12px;cursor:pointer;font-size:11px;font-family:inherit;font-weight:700">كشف</button></td>` : ''}
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('sm-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pg = document.getElementById('sm-pages');
  pg.innerHTML = '';
  const maxV = 7;
  let s = Math.max(1, _smPage-3), e = Math.min(maxPage, s+maxV-1);
  if (e-s < maxV-1) s = Math.max(1, e-maxV+1);
  for (let i=s; i<=e; i++) {
    const btn = document.createElement('button');
    btn.className = 'sm-page-btn' + (i===_smPage?' active':'');
    btn.textContent = i;
    btn.onclick = () => smRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('sm-prev').disabled = _smPage <= 1;
  document.getElementById('sm-next').disabled = _smPage >= maxPage;
}

function smFilter(q) {
  const t = q.trim().toLowerCase();
  _smFiltered = !t ? [..._smAll] : _smAll.filter(m =>
    (m.name||'').toLowerCase().includes(t) ||
    (m.city||m.location||'').toLowerCase().includes(t) ||
    (m.type||'').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_smFiltered.length} صندوق`;
  smRender(1);
}

function smSort(col) {
  if (_smSortCol === col) _smSortAsc = !_smSortAsc;
  else { _smSortCol = col; _smSortAsc = true; }
  document.querySelectorAll('.sm-sa').forEach(a => a.textContent = '↕');
  const cur = _smCurrency;
  const colToField = { id:'id', city:'city', name:'name', net:cur, us:cur, them:'them', debt:'debt' };
  const field = colToField[col] || col;
  const el = document.getElementById('sm-sa-' + col); if (el) el.textContent = _smSortAsc ? '↑' : '↓';
  _smFiltered.sort((a, b) => {
    const va = a[field] ?? 0, vb = b[field] ?? 0;
    if (typeof va === 'string') return _smSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _smSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  smRender(1);
}

function smExportCSV() {
  const cur = _smCurrency;
  const label = SM_CUR_LABELS[cur] || cur;
  const hdr  = ['#','المدينة','الاسم',`صافي ${label}`,`${label} لنا`,`${label} علينا`,'المديونية'].join(',');
  const rows = _smFiltered.map(m => {
    const us = m[cur]||0, them = 0, net = us-them, debt = net<0?Math.abs(net):0;
    return [m.id, m.city||m.location||'', m.name||'', net, us, them, debt].join(',');
  });
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'الصناديق.csv'; a.click();
}

function smExportExcel() { smExportCSV(); }
function smExportPDF()   { window.print(); }

function smCopyTable() {
  const cur = _smCurrency;
  const label = SM_CUR_LABELS[cur] || cur;
  const hdr  = ['#','المدينة','الاسم',`صافي ${label}`,`${label} لنا`,`${label} علينا`,'المديونية'].join('\t');
  const rows = _smFiltered.map(m => {
    const us = m[cur]||0, them = 0, net = us-them, debt = net<0?Math.abs(net):0;
    return [m.id, m.city||m.location||'', m.name||'', net, us, them, debt].join('\t');
  });
  navigator.clipboard.writeText(hdr + '\n' + rows.join('\n'))
    .then(() => alToast('تم النسخ إلى الحافظة','success','📋'))
    .catch(() => alToast('فشل النسخ','error','❌'));
}

// ══ سلة المحذوفات ══
let _trashAll = [], _trashFiltered = [], _trashSortCol = 'id', _trashSortAsc = true, _trashPage = 1;

async function trashLoad() {
  document.getElementById('trash-tbody').innerHTML =
    '<tr><td colspan="7" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/cost-centers/?deleted=true', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || d.deleted || []);
    _trashAll = list; _trashFiltered = [..._trashAll];
    document.getElementById('sp-count').textContent = `— ${_trashAll.length} مركز محذوف`;
    trashRender(1);
  } catch {
    _trashAll = []; _trashFiltered = [];
    document.getElementById('trash-tbody').innerHTML =
      '<tr><td colspan="7" class="sp-empty">📭 لا توجد مراكز محذوفة</td></tr>';
    document.getElementById('trash-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('trash-pages').innerHTML = '';
  }
}

function trashRender(p) {
  const total   = _trashFiltered.length;
  const perPage = parseInt(document.getElementById('trash-per-page').value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _trashPage = Math.min(Math.max(1, p), maxPage);
  const start = (_trashPage - 1) * perPage;
  const slice = _trashFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('trash-tbody');

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="7" class="sp-empty">📭 لا توجد مراكز محذوفة</td></tr>';
    document.getElementById('trash-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('trash-pages').innerHTML = '';
    document.getElementById('trash-prev').disabled = true;
    document.getElementById('trash-next').disabled = true;
    return;
  }

  tbody.innerHTML = slice.map((c,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td class="sp-num" style="color:rgba(255,255,255,.7)">${c.id}</td>
    <td style="color:#fff"><strong>${c.name || '—'}</strong></td>
    <td style="color:rgba(255,255,255,.7)">${c.country || '—'}</td>
    <td style="color:#fff">${c.city || '—'}</td>
    <td style="color:rgba(255,255,255,.7)">${c.address || c.location || '—'}</td>
    <td style="color:rgba(255,255,255,.7)">${c.phone || '—'}</td>
    <td style="display:flex;gap:4px;align-items:center">
      <button class="sp-tbar-btn" onclick="trashRestore(${c.id},'${(c.name||'').replace(/'/g,"\\'")}' )" style="background:rgba(74,222,128,.15);color:#4ADE80;border-color:rgba(74,222,128,.3)">
        ↩️ استعادة
      </button>
      <button class="sp-tbar-btn" onclick="trashPermanentDelete(${c.id},'${(c.name||'').replace(/'/g,"\\'")}' )" style="background:rgba(252,165,165,.15);color:#FCA5A5;border-color:rgba(252,165,165,.3)">
        🗑️ حذف نهائي
      </button>
    </td>
  </tr>`; }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('trash-showing').textContent = `يعرض ${start+1} إلى ${end} من أصل ${total}`;

  const pg = document.getElementById('trash-pages');
  pg.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _trashPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => trashRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('trash-prev').disabled = _trashPage <= 1;
  document.getElementById('trash-next').disabled = _trashPage >= maxPage;
}

function trashFilter(q) {
  const t = q.trim().toLowerCase();
  _trashFiltered = !t ? [..._trashAll] : _trashAll.filter(c =>
    (c.name||'').toLowerCase().includes(t) ||
    (c.country||'').toLowerCase().includes(t) ||
    (c.city||'').toLowerCase().includes(t) ||
    (c.address||c.location||'').toLowerCase().includes(t) ||
    (c.phone||'').toLowerCase().includes(t)
  );
  trashRender(1);
}

function trashSort(col) {
  if (_trashSortCol === col) _trashSortAsc = !_trashSortAsc;
  else { _trashSortCol = col; _trashSortAsc = true; }
  document.querySelectorAll('.trash-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('trash-sa-' + col); if (el) el.textContent = _trashSortAsc ? '↑' : '↓';
  _trashFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    return _trashSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  trashRender(1);
}

async function trashRestore(id, name) {
  if (!confirm(`هل تريد استعادة "${name}"؟`)) return;
  try {
    const r = await fetch(`/api/cost-centers/${id}/restore/`, {
      method:'POST', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    if (r.ok) {
      alToast('تمت الاستعادة بنجاح','success','✅'); trashLoad();
    } else {
      const d = await r.json().catch(() => ({}));
      alToast(d.error||d.detail||'فشلت الاستعادة','error','❌');
    }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function trashPermanentDelete(id, name) {
  if (!confirm(`تحذير: سيتم حذف "${name}" نهائياً ولا يمكن التراجع. هل أنت متأكد؟`)) return;
  try {
    const r = await fetch(`/api/cost-centers/${id}/force-delete/`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    if (r.status === 204 || r.ok) {
      alToast('تم الحذف النهائي','success','✅'); trashLoad();
    } else {
      const d = await r.json().catch(() => ({}));
      alToast(d.error||d.detail||'فشل الحذف','error','❌');
    }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

// ══ المراكز ══
let _ccAll = [], _ccFiltered = [], _ccSortCol = 'id', _ccSortAsc = true, _ccPage = 1;

async function ccLoad() {
  document.getElementById('cc-tbody').innerHTML =
    '<tr><td colspan="8" class="cc-empty"><div class="cc-spin"></div></td></tr>';
  try {
    const r = await fetch('/api/cost-centers/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    _ccAll = list; _ccFiltered = [..._ccAll];
    document.getElementById('sp-count').textContent = `— ${_ccAll.length} مركز`;
    ccRender(1);
  } catch {
    _ccAll = []; _ccFiltered = [];
    document.getElementById('cc-tbody').innerHTML =
      '<tr><td colspan="8" class="cc-empty">📭 لا توجد بيانات متاحة في الجدول</td></tr>';
    document.getElementById('cc-showing').textContent = '—';
    document.getElementById('cc-pages').innerHTML = '';
  }
}

function ccShowBranches() { alToast('عرض المراكز الفرعية — قيد الإنشاء','warning','🚧'); }
function ccShowDeleted()  { alToast('عرض المراكز المحذوفة — قيد الإنشاء','warning','🚧'); }
function ccShowBalances() { alToast('اظهار الأرصدة — قيد الإنشاء','warning','💰'); }

function ccRender(p) {
  const total   = _ccFiltered.length;
  const perPage = parseInt(document.getElementById('cc-per-page').value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _ccPage = Math.min(Math.max(1, p), maxPage);
  const start = (_ccPage - 1) * perPage;
  const slice = _ccFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('cc-tbody');

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="8" class="cc-empty">📭 لا توجد بيانات متاحة في الجدول</td></tr>';
    document.getElementById('cc-showing').textContent = '—';
    document.getElementById('cc-pages').innerHTML = '';
    document.getElementById('cc-prev').disabled = true;
    document.getElementById('cc-next').disabled = true;
    return;
  }

  const lockBadge = v => v
    ? '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:#FEE2E2;color:#B91C1C;border-radius:20px;font-size:10.5px;font-weight:800">🔒 مقفل</span>'
    : '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:#DCFCE7;color:#15803D;border-radius:20px;font-size:10.5px;font-weight:800">🔓 مفتوح</span>';
  const docLink = url => url
    ? `<a href="${url}" target="_blank" style="color:#2563EB;font-size:11px;text-decoration:underline">🔗 فتح</a>`
    : '<span style="color:#CBD5E1;font-size:11px">—</span>';

  tbody.innerHTML = slice.map((c) => `<tr>
    <td style="color:#64748B;font-size:11px">${c.id}</td>
    <td style="font-weight:700;color:#1E293B">${c.name || '—'}</td>
    <td>${c.type || '—'}</td>
    <td>${c.country || '—'}</td>
    <td>${c.city || '—'}</td>
    <td>${c.phone || '—'}</td>
    <td>${lockBadge(c.lock)}</td>
    <td style="display:flex;gap:4px;align-items:center">
      ${docLink(c.doc_url)}
      <button onclick="ccOpenEdit(${c.id})" style="padding:3px 10px;border:1px solid #BFDBFE;background:#EFF6FF;color:#1D4ED8;border-radius:5px;cursor:pointer;font-size:11px;font-family:inherit;font-weight:700">تعديل</button>
      <button onclick="ccDelete(${c.id},'${(c.name||'').replace(/'/g,"\\'")}' )" style="padding:3px 10px;border:1px solid #FECACA;background:#FEF2F2;color:#B91C1C;border-radius:5px;cursor:pointer;font-size:11px;font-family:inherit;font-weight:700">حذف</button>
    </td>
  </tr>`).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('cc-showing').textContent = `يعرض ${start+1} إلى ${end} من أصل ${total}`;

  const pg = document.getElementById('cc-pages');
  pg.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'cc-pg-btn' + (i === _ccPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => ccRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('cc-prev').disabled = _ccPage <= 1;
  document.getElementById('cc-next').disabled = _ccPage >= maxPage;
}

function ccFilter(q) {
  const t = q.trim().toLowerCase();
  _ccFiltered = !t ? [..._ccAll] : _ccAll.filter(c =>
    (c.name||'').toLowerCase().includes(t) ||
    (c.type||'').toLowerCase().includes(t) ||
    (c.country||'').toLowerCase().includes(t) ||
    (c.city||'').toLowerCase().includes(t) ||
    (c.phone||'').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_ccFiltered.length} مركز`;
  ccRender(1);
}

function ccSort(col) {
  if (_ccSortCol === col) _ccSortAsc = !_ccSortAsc;
  else { _ccSortCol = col; _ccSortAsc = true; }
  document.querySelectorAll('.cc-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('cc-sa-' + col); if (el) el.textContent = _ccSortAsc ? '↑' : '↓';
  _ccFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    return _ccSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  ccRender(1);
}

function ccExportCSV() {
  const hdr  = ['#','الاسم','النوع','الدولة','المدينة','الهاتف','يورو','ليره تركيه','دولار'].join(',');
  const rows = _ccFiltered.map(c =>
    [c.id, c.name||'', c.type||'', c.country||'', c.city||'', c.phone||'',
     c.euro||0, c.lira_tr||0, c.dollar||0].join(','));
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'المراكز.csv'; a.click();
}

function ccCopyTable() {
  const hdr  = ['#','الاسم','النوع','الدولة','المدينة','الهاتف','يورو','ليره تركيه','دولار'].join('\t');
  const rows = _ccFiltered.map(c =>
    [c.id, c.name||'', c.type||'', c.country||'', c.city||'', c.phone||'',
     c.euro||0, c.lira_tr||0, c.dollar||0].join('\t'));
  navigator.clipboard.writeText(hdr + '\n' + rows.join('\n'))
    .then(() => alToast('تم النسخ إلى الحافظة','success','📋'))
    .catch(() => alToast('فشل النسخ','error','❌'));
}

function ccOpenAdd() {
  document.getElementById('cc-modal-title').textContent = 'اضافة مركز جديد';
  ['cc-b-id','cc-b-name','cc-b-country','cc-b-city','cc-b-phone','cc-b-doc_url','cc-b-notes','cc-b-euro','cc-b-lira_tr','cc-b-dollar']
    .forEach(id => { const e = document.getElementById(id); if(e) e.value=''; });
  document.getElementById('cc-b-type').value   = 'main';
  document.getElementById('cc-b-status').value = 'active';
  document.getElementById('cc-modal').classList.add('open');
}

function ccOpenEdit(id) {
  const c = _ccAll.find(x => x.id === id); if (!c) return;
  document.getElementById('cc-modal-title').textContent = 'تعديل المركز';
  document.getElementById('cc-b-id').value      = c.id;
  document.getElementById('cc-b-name').value    = c.name || '';
  document.getElementById('cc-b-country').value = c.country || '';
  document.getElementById('cc-b-city').value    = c.city || '';
  document.getElementById('cc-b-phone').value   = c.phone || '';
  document.getElementById('cc-b-doc_url').value = c.doc_url || '';
  document.getElementById('cc-b-notes').value   = c.notes || '';
  document.getElementById('cc-b-euro').value    = c.euro || '';
  document.getElementById('cc-b-lira_tr').value = c.lira_tr || '';
  document.getElementById('cc-b-dollar').value  = c.dollar || '';
  document.getElementById('cc-b-type').value    = c.type || 'main';
  document.getElementById('cc-b-status').value  = c.status || 'active';
  document.getElementById('cc-modal').classList.add('open');
}

function ccCloseModal() { document.getElementById('cc-modal').classList.remove('open'); }

async function ccSave() {
  const id   = document.getElementById('cc-b-id').value;
  const name = document.getElementById('cc-b-name').value.trim();
  if (!name) { alToast('اسم المركز مطلوب','error','❌'); return; }
  const body = {
    name,
    type:    document.getElementById('cc-b-type').value,
    status:  document.getElementById('cc-b-status').value,
    country: document.getElementById('cc-b-country').value.trim(),
    city:    document.getElementById('cc-b-city').value.trim(),
    phone:   document.getElementById('cc-b-phone').value.trim(),
    doc_url: document.getElementById('cc-b-doc_url').value.trim(),
    notes:   document.getElementById('cc-b-notes').value.trim(),
    euro:    parseFloat(document.getElementById('cc-b-euro').value) || 0,
    lira_tr: parseFloat(document.getElementById('cc-b-lira_tr').value) || 0,
    dollar:  parseFloat(document.getElementById('cc-b-dollar').value) || 0,
  };
  const url    = id ? `/api/cost-centers/${id}/` : '/api/cost-centers/';
  const method = id ? 'PATCH' : 'POST';
  try {
    const r = await fetch(url, {
      method, credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.success !== false && !d.error && !d.detail) {
      alToast(id ? 'تم التحديث بنجاح' : 'تمت الإضافة بنجاح','success','✅');
      ccCloseModal(); ccLoad();
    } else alToast(d.error||d.detail||'حدث خطأ','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function ccDelete(id, name) {
  if (!confirm(`هل تريد حذف المركز "${name}"؟`)) return;
  try {
    const r = await fetch(`/api/cost-centers/${id}/`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    if (r.status === 204 || r.ok) {
      alToast('تم الحذف بنجاح','success','✅'); ccLoad();
    } else {
      const d = await r.json().catch(() => ({}));
      alToast(d.error||d.detail||'فشل الحذف','error','❌');
    }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

const _ccModalEl = document.getElementById('cc-modal');
if (_ccModalEl) {
  _ccModalEl.addEventListener('click', e => {
    if (e.target === _ccModalEl) _ccModalEl.classList.remove('open');
  });
}

// ══ العملاء ══
let _cuAll = [], _cuFiltered = [], _cuSortCol = 'id', _cuSortAsc = true, _cuPage = 1;

async function cuLoad() {
  document.getElementById('cu-tbody').innerHTML =
    '<tr><td colspan="11" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/customers/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.customers || []);
    _cuAll = list;
    _cuFiltered = [..._cuAll];
    document.getElementById('sp-count').textContent = `— ${_cuAll.length} عميل`;
    cuRender(1);
  } catch {
    _cuAll = []; _cuFiltered = [];
    document.getElementById('cu-tbody').innerHTML =
      '<tr><td colspan="11" class="sp-empty">📭 لا توجد بيانات متاحة في الجدول</td></tr>';
    document.getElementById('cu-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('cu-pages').innerHTML = '';
  }
}

function cuShowBranches() { alToast('عرض المراكز الفرعية — قيد الإنشاء','warning','🚧'); }
function cuShowDeleted()  { alToast('عرض المراكز المحذوفة — قيد الإنشاء','warning','🚧'); }

function cuRender(p) {
  const total   = _cuFiltered.length;
  const perPage = parseInt(document.getElementById('cu-per-page').value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _cuPage = Math.min(Math.max(1, p), maxPage);
  const start = (_cuPage - 1) * perPage;
  const slice = _cuFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('cu-tbody');

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="11" class="sp-empty">📭 لا توجد بيانات متاحة في الجدول</td></tr>';
    document.getElementById('cu-showing').textContent = 'يعرض 0 إلى 0 من أصل 0';
    document.getElementById('cu-pages').innerHTML = '';
    document.getElementById('cu-prev').disabled = true;
    document.getElementById('cu-next').disabled = true;
    return;
  }

  const fmtNum = v => v != null ? Number(v).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
  const lockBadge = v => v
    ? '<span class="sp-badge sp-badge-red">🔒 مقفل</span>'
    : '<span class="sp-badge sp-badge-green">🔓 مفتوح</span>';
  const docLink = url => url
    ? `<a href="${url}" target="_blank" class="sp-tbar-btn" style="font-size:10px;color:#93C5FD;border-color:rgba(147,197,253,.3)">🔗 فتح</a>`
    : '<span style="color:rgba(255,255,255,.3);font-size:11px">—</span>';

  tbody.innerHTML = slice.map((c,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td class="sp-num" style="color:rgba(255,255,255,.7)">${c.id}</td>
    <td style="color:#fff"><strong>${c.name || '—'}</strong></td>
    <td style="color:rgba(255,255,255,.7)">${c.type || '—'}</td>
    <td style="color:#fff">${c.country || '—'}</td>
    <td style="color:rgba(255,255,255,.7)">${c.city || '—'}</td>
    <td style="color:rgba(255,255,255,.7)">${c.phone || '—'}</td>
    <td class="sp-num" style="color:#93C5FD">${fmtNum(c.euro)}</td>
    <td class="sp-num" style="color:#93C5FD">${fmtNum(c.lira_tr)}</td>
    <td class="sp-num" style="color:#93C5FD">${fmtNum(c.dollar)}</td>
    <td>${lockBadge(c.lock)}</td>
    <td style="display:flex;gap:4px;align-items:center">
      ${docLink(c.doc_url)}
      <button class="sp-tbar-btn" onclick="cuOpenEdit(${c.id})" style="background:rgba(147,197,253,.15);color:#93C5FD;border-color:rgba(147,197,253,.3)">تعديل</button>
      <button class="sp-tbar-btn" onclick="cuDelete(${c.id},'${(c.name||'').replace(/'/g,"\\'")}' )" style="background:rgba(252,165,165,.15);color:#FCA5A5;border-color:rgba(252,165,165,.3)">حذف</button>
    </td>
  </tr>`; }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('cu-showing').textContent = `يعرض ${start+1} إلى ${end} من أصل ${total}`;

  const pg = document.getElementById('cu-pages');
  pg.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _cuPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => cuRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('cu-prev').disabled = _cuPage <= 1;
  document.getElementById('cu-next').disabled = _cuPage >= maxPage;
}

function cuFilter(q) {
  const t = q.trim().toLowerCase();
  _cuFiltered = !t ? [..._cuAll] : _cuAll.filter(c =>
    (c.name||'').toLowerCase().includes(t) ||
    (c.type||'').toLowerCase().includes(t) ||
    (c.country||'').toLowerCase().includes(t) ||
    (c.city||'').toLowerCase().includes(t) ||
    (c.phone||'').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_cuFiltered.length} عميل`;
  cuRender(1);
}

function cuSort(col) {
  if (_cuSortCol === col) _cuSortAsc = !_cuSortAsc;
  else { _cuSortCol = col; _cuSortAsc = true; }
  document.querySelectorAll('.cu-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('cu-sa-' + col); if (el) el.textContent = _cuSortAsc ? '↑' : '↓';
  _cuFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    return _cuSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  cuRender(1);
}

function cuExportCSV() {
  const hdr  = ['#','الاسم','النوع','الدولة','المدينة','الهاتف','يورو','ليره تركيه','دولار'].join(',');
  const rows = _cuFiltered.map(c =>
    [c.id, c.name||'', c.type||'', c.country||'', c.city||'', c.phone||'',
     c.euro||0, c.lira_tr||0, c.dollar||0].join(','));
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'العملاء.csv'; a.click();
}

function cuCopyTable() {
  const hdr  = ['#','الاسم','النوع','الدولة','المدينة','الهاتف','يورو','ليره تركيه','دولار'].join('\t');
  const rows = _cuFiltered.map(c =>
    [c.id, c.name||'', c.type||'', c.country||'', c.city||'', c.phone||'',
     c.euro||0, c.lira_tr||0, c.dollar||0].join('\t'));
  navigator.clipboard.writeText(hdr + '\n' + rows.join('\n'))
    .then(() => alToast('تم النسخ إلى الحافظة','success','📋'))
    .catch(() => alToast('فشل النسخ','error','❌'));
}

// Modal العملاء
function cuOpenAdd() {
  document.getElementById('cu-modal-title').textContent = 'اضافة مركز جديد';
  ['cu-b-id','cu-b-name','cu-b-country','cu-b-city','cu-b-phone','cu-b-doc_url','cu-b-notes','cu-b-euro','cu-b-lira_tr','cu-b-dollar']
    .forEach(id => { const e = document.getElementById(id); if(e) e.value=''; });
  document.getElementById('cu-b-type').value   = 'individual';
  document.getElementById('cu-b-status').value = 'active';
  document.getElementById('cu-modal').classList.add('open');
}

function cuOpenEdit(id) {
  const c = _cuAll.find(x => x.id === id); if (!c) return;
  document.getElementById('cu-modal-title').textContent = 'تعديل العميل';
  document.getElementById('cu-b-id').value      = c.id;
  document.getElementById('cu-b-name').value    = c.name || '';
  document.getElementById('cu-b-country').value = c.country || '';
  document.getElementById('cu-b-city').value    = c.city || '';
  document.getElementById('cu-b-phone').value   = c.phone || '';
  document.getElementById('cu-b-doc_url').value = c.doc_url || '';
  document.getElementById('cu-b-notes').value   = c.notes || '';
  document.getElementById('cu-b-euro').value    = c.euro || '';
  document.getElementById('cu-b-lira_tr').value = c.lira_tr || '';
  document.getElementById('cu-b-dollar').value  = c.dollar || '';
  document.getElementById('cu-b-type').value    = c.type || 'individual';
  document.getElementById('cu-b-status').value  = c.status || 'active';
  document.getElementById('cu-modal').classList.add('open');
}

function cuCloseModal() { document.getElementById('cu-modal').classList.remove('open'); }

async function cuSave() {
  const id   = document.getElementById('cu-b-id').value;
  const name = document.getElementById('cu-b-name').value.trim();
  if (!name) { alToast('الاسم مطلوب','error','❌'); return; }
  const body = {
    name,
    type:        document.getElementById('cu-b-type').value,
    status:      document.getElementById('cu-b-status').value,
    country:     document.getElementById('cu-b-country').value.trim(),
    city:        document.getElementById('cu-b-city').value.trim(),
    phone:       document.getElementById('cu-b-phone').value.trim(),
    doc_url:     document.getElementById('cu-b-doc_url').value.trim(),
    notes:       document.getElementById('cu-b-notes').value.trim(),
    euro:        parseFloat(document.getElementById('cu-b-euro').value) || 0,
    lira_tr:     parseFloat(document.getElementById('cu-b-lira_tr').value) || 0,
    dollar:      parseFloat(document.getElementById('cu-b-dollar').value) || 0,
  };
  const url    = id ? `/api/customers/${id}/` : '/api/customers/';
  const method = id ? 'PATCH' : 'POST';
  try {
    const r = await fetch(url, {
      method, credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.success !== false && !d.error && !d.detail) {
      alToast(id ? 'تم التحديث بنجاح' : 'تمت الإضافة بنجاح','success','✅');
      cuCloseModal(); cuLoad();
    } else alToast(d.error||d.detail||'حدث خطأ','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function cuDelete(id, name) {
  if (!confirm(`هل تريد حذف "${name}"؟`)) return;
  try {
    const r = await fetch(`/api/customers/${id}/`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    if (r.status === 204 || r.ok) {
      alToast('تم الحذف بنجاح','success','✅'); cuLoad();
    } else {
      const d = await r.json().catch(() => ({}));
      alToast(d.error||d.detail||'فشل الحذف','error','❌');
    }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

const _cuModalEl = document.getElementById('cu-modal');
if (_cuModalEl) {
  _cuModalEl.addEventListener('click', e => {
    if (e.target === _cuModalEl) _cuModalEl.classList.remove('open');
  });
}

// ══ العوابر ══
let _trAll = [], _trFiltered = [], _trSortCol = 'id', _trSortAsc = true, _trPage = 1;

async function trLoad() {
  document.getElementById('tr-tbody').innerHTML =
    '<tr><td colspan="8" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/transit/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.transit || []);
    _trAll = list;
    _trFiltered = [..._trAll];
    document.getElementById('sp-count').textContent = `— ${_trAll.length} عابر`;
    trRender(1);
  } catch {
    _trAll = []; _trFiltered = [];
    document.getElementById('tr-tbody').innerHTML =
      '<tr><td colspan="8" class="sp-empty">📭 لا توجد بيانات متاحة في الجدول</td></tr>';
    document.getElementById('tr-showing').textContent = `يعرض 0 إلى 0 من أصل 0`;
    document.getElementById('tr-pages').innerHTML = '';
  }
}

function trRender(p) {
  const total   = _trFiltered.length;
  const perPage = parseInt(document.getElementById('tr-per-page').value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _trPage = Math.min(Math.max(1, p), maxPage);
  const start = (_trPage - 1) * perPage;
  const slice = _trFiltered.slice(start, start + perPage);
  const tbody = document.getElementById('tr-tbody');

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="8" class="sp-empty">📭 ليست هناك بيانات متاحة في الجدول</td></tr>';
    document.getElementById('tr-showing').textContent = `يعرض 0 إلى 0 من أصل 0`;
    document.getElementById('tr-pages').innerHTML = '';
    document.getElementById('tr-prev').disabled = true;
    document.getElementById('tr-next').disabled = true;
    return;
  }

  tbody.innerHTML = slice.map((t,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td class="sp-num" style="color:rgba(255,255,255,.7)">${t.id}</td>
    <td style="color:#fff"><strong>${t.name || '—'}</strong></td>
    <td style="color:rgba(255,255,255,.7)">${t.country || '—'}</td>
    <td style="color:#fff">${t.city || '—'}</td>
    <td style="color:rgba(255,255,255,.7)">${t.address || '—'}</td>
    <td style="color:rgba(255,255,255,.7)">${t.phone || '—'}</td>
    <td style="color:#fff">${t.main_center || '—'}</td>
    <td style="display:flex;gap:4px;align-items:center">
      <button class="sp-tbar-btn" onclick="trOpenEdit(${t.id})" style="background:rgba(147,197,253,.15);color:#93C5FD;border-color:rgba(147,197,253,.3)">تعديل</button>
      <button class="sp-tbar-btn" onclick="trDelete(${t.id},'${(t.name||'').replace(/'/g,"\\'")}' )" style="background:rgba(252,165,165,.15);color:#FCA5A5;border-color:rgba(252,165,165,.3)">حذف</button>
    </td>
  </tr>`; }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('tr-showing').textContent = `يعرض ${start+1} إلى ${end} من أصل ${total}`;

  const pg = document.getElementById('tr-pages');
  pg.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _trPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => trRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('tr-prev').disabled = _trPage <= 1;
  document.getElementById('tr-next').disabled = _trPage >= maxPage;
}

function trFilter(q) {
  const t = q.trim().toLowerCase();
  _trFiltered = !t ? [..._trAll] : _trAll.filter(r =>
    (r.name||'').toLowerCase().includes(t) ||
    (r.country||'').toLowerCase().includes(t) ||
    (r.city||'').toLowerCase().includes(t) ||
    (r.address||'').toLowerCase().includes(t) ||
    (r.phone||'').toLowerCase().includes(t) ||
    (r.main_center||'').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_trFiltered.length} عابر`;
  trRender(1);
}

function trSort(col) {
  if (_trSortCol === col) _trSortAsc = !_trSortAsc;
  else { _trSortCol = col; _trSortAsc = true; }
  document.querySelectorAll('.tr-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('tr-sa-' + col); if (el) el.textContent = _trSortAsc ? '↑' : '↓';
  _trFiltered.sort((a, b) => {
    const va = a[col]||'', vb = b[col]||'';
    return _trSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  trRender(1);
}

function trExportCSV() {
  const hdr  = ['#','اسم العابر','الدولة','المدينة','العنوان','الهاتف','المركز الرئيسي'].join(',');
  const rows = _trFiltered.map(t =>
    [t.id, t.name||'', t.country||'', t.city||'', t.address||'', t.phone||'', t.main_center||''].join(','));
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'العوابر.csv'; a.click();
}

function trExportExcel() { trExportCSV(); }

function trCopyTable() {
  const hdr  = ['#','اسم العابر','الدولة','المدينة','العنوان','الهاتف','المركز الرئيسي'].join('\t');
  const rows = _trFiltered.map(t =>
    [t.id, t.name||'', t.country||'', t.city||'', t.address||'', t.phone||'', t.main_center||''].join('\t'));
  navigator.clipboard.writeText(hdr + '\n' + rows.join('\n'))
    .then(() => alToast('تم النسخ إلى الحافظة','success','📋'))
    .catch(() => alToast('فشل النسخ','error','❌'));
}

// Modal العوابر
function trOpenAdd() {
  document.getElementById('tr-modal-title').textContent = 'اضافة عابر جديد';
  ['tr-b-id','tr-b-name','tr-b-country','tr-b-city','tr-b-address','tr-b-phone','tr-b-main_center','tr-b-notes']
    .forEach(id => { const e = document.getElementById(id); if(e) e.value=''; });
  document.getElementById('tr-b-status').value = 'active';
  document.getElementById('tr-modal').classList.add('open');
}

function trOpenEdit(id) {
  const t = _trAll.find(x => x.id === id); if (!t) return;
  document.getElementById('tr-modal-title').textContent = 'تعديل العابر';
  document.getElementById('tr-b-id').value          = t.id;
  document.getElementById('tr-b-name').value        = t.name || '';
  document.getElementById('tr-b-country').value     = t.country || '';
  document.getElementById('tr-b-city').value        = t.city || '';
  document.getElementById('tr-b-address').value     = t.address || '';
  document.getElementById('tr-b-phone').value       = t.phone || '';
  document.getElementById('tr-b-main_center').value = t.main_center || '';
  document.getElementById('tr-b-notes').value       = t.notes || '';
  document.getElementById('tr-b-status').value      = t.status || 'active';
  document.getElementById('tr-modal').classList.add('open');
}

function trCloseModal() { document.getElementById('tr-modal').classList.remove('open'); }

async function trSave() {
  const id   = document.getElementById('tr-b-id').value;
  const name = document.getElementById('tr-b-name').value.trim();
  if (!name) { alToast('اسم العابر مطلوب','error','❌'); return; }
  const body = {
    name,
    country:     document.getElementById('tr-b-country').value.trim(),
    city:        document.getElementById('tr-b-city').value.trim(),
    address:     document.getElementById('tr-b-address').value.trim(),
    phone:       document.getElementById('tr-b-phone').value.trim(),
    main_center: document.getElementById('tr-b-main_center').value.trim(),
    notes:       document.getElementById('tr-b-notes').value.trim(),
    status:      document.getElementById('tr-b-status').value,
  };
  const url    = id ? `/api/transit/${id}/` : '/api/transit/';
  const method = id ? 'PATCH' : 'POST';
  try {
    const r = await fetch(url, {
      method, credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.success !== false && !d.error && !d.detail) {
      alToast(id ? 'تم التحديث بنجاح' : 'تمت الإضافة بنجاح','success','✅');
      trCloseModal(); trLoad();
    } else alToast(d.error||d.detail||'حدث خطأ','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function trDelete(id, name) {
  if (!confirm(`هل تريد حذف العابر "${name}"؟`)) return;
  try {
    const r = await fetch(`/api/transit/${id}/`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    if (r.status === 204 || r.ok) {
      alToast('تم الحذف بنجاح','success','✅'); trLoad();
    } else {
      const d = await r.json().catch(() => ({}));
      alToast(d.error||d.detail||'فشل الحذف','error','❌');
    }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

// إغلاق modal العوابر بالضغط خارجه
const _trModalEl = document.getElementById('tr-modal');
if (_trModalEl) {
  _trModalEl.addEventListener('click', e => {
    if (e.target === _trModalEl) _trModalEl.classList.remove('open');
  });
}

// ══ الوكلاء ══
let _agAll = [], _agFiltered = [], _agSortCol = 'id', _agSortAsc = true, _agPage = 1;
let _agShowBalances = false;

async function agLoadAgents() {
  document.getElementById('ag-tbody').innerHTML =
    '<tr><td colspan="8" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/ts/agents', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.agents || d.results || []);
    _agAll = list;
    _agFiltered = [..._agAll];
    document.getElementById('sp-count').textContent = `— ${_agAll.length} وكيل`;
    agRender(1);
  } catch { alToast('خطأ في تحميل الوكلاء','error','❌'); }
}

function agRender(p) {
  _agPage = p;
  const perPage = parseInt(document.getElementById('ag-per-page').value) || 10;
  const start   = (p - 1) * perPage;
  const slice   = _agFiltered.slice(start, start + perPage);
  const tbody   = document.getElementById('ag-tbody');

  if (!_agFiltered.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="sp-empty">📭 لا توجد نتائج</td></tr>';
    document.getElementById('ag-showing').textContent = '0 نتائج';
    document.getElementById('ag-pages').innerHTML = '';
    return;
  }

  tbody.innerHTML = slice.map((a,i) => {
    const typeBadge = a.type === 'external'
      ? '<span class="sp-badge sp-badge-gray">🌍 خارجي</span>'
      : '<span class="sp-badge sp-badge-green">🏠 داخلي</span>';
    const lockBadge = a.is_locked
      ? '<span class="sp-badge sp-badge-red">🔒 مقفل</span>'
      : '<span class="sp-badge sp-badge-green">🔓 مفتوح</span>';
    const docLink = a.doc_url
      ? `<a href="${a.doc_url}" target="_blank" class="sp-tbar-btn" style="font-size:10px;color:#93C5FD;border-color:rgba(147,197,253,.3)">🔗 فتح</a>`
      : '<span style="color:rgba(255,255,255,.3);font-size:11px">—</span>';
    const bg = i%2===0?'#1E3A5F':'#162d4a';
    return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
      <td class="sp-num" style="color:rgba(255,255,255,.7)">${a.id}</td>
      <td style="color:#fff"><strong>${a.name || a.username || '—'}</strong></td>
      <td>${typeBadge}</td>
      <td style="color:#fff">${a.main_center || a.branch_name || '—'}</td>
      <td style="color:rgba(255,255,255,.7)">${a.city || a.location || '—'}</td>
      <td style="color:rgba(255,255,255,.7)">${a.phone || '—'}</td>
      <td>${lockBadge}</td>
      <td style="display:flex;gap:4px;align-items:center">
        ${docLink}
        <button class="sp-tbar-btn" onclick="agOpenEdit(${a.id})" style="background:rgba(147,197,253,.15);color:#93C5FD;border-color:rgba(147,197,253,.3)">✏️ تعديل</button>
        <button class="sp-tbar-btn" onclick="agDelete(${a.id},'${(a.name||a.username||'').replace(/'/g,"\\'")}' )" style="background:rgba(252,165,165,.15);color:#FCA5A5;border-color:rgba(252,165,165,.3)">🗑️ حذف</button>
      </td>
    </tr>`;
  }).join('');

  const total = _agFiltered.length, pages = Math.ceil(total / perPage);
  document.getElementById('ag-showing').textContent =
    `عرض ${start + 1}–${Math.min(start + perPage, total)} من ${total}`;
  const pg = document.getElementById('ag-pages');
  pg.innerHTML = '';
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _agPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => agRender(i);
    pg.appendChild(btn);
  }
}

function agFilter(q) {
  const t = q.trim().toLowerCase();
  _agFiltered = !t ? [..._agAll] : _agAll.filter(a =>
    (a.name||'').toLowerCase().includes(t) ||
    (a.username||'').toLowerCase().includes(t) ||
    (a.main_center||'').toLowerCase().includes(t) ||
    (a.city||'').toLowerCase().includes(t) ||
    (a.phone||'').toLowerCase().includes(t)
  );
  document.getElementById('sp-count').textContent = `— ${_agFiltered.length} وكيل`;
  agRender(1);
}

function agSort(col) {
  if (_agSortCol === col) _agSortAsc = !_agSortAsc;
  else { _agSortCol = col; _agSortAsc = true; }
  document.querySelectorAll('.ag-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('ag-sa-' + col); if (el) el.textContent = _agSortAsc ? '↑' : '↓';
  _agFiltered.sort((a, b) => {
    const va = a[col]||'', vb = b[col]||'';
    return _agSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  agRender(1);
}

function agToggleBalances() {
  _agShowBalances = !_agShowBalances;
  alToast(_agShowBalances ? 'تم إظهار الأرصدة' : 'تم إخفاء الأرصدة', 'info', '💰');
}

function agExportCSV() {
  const hdr  = ['#','الاسم','النوع','المركز الرئيسي','المدينة','الهاتف'].join(',');
  const rows = _agFiltered.map(a =>
    [a.id, a.name||a.username||'', a.type||'', a.main_center||'', a.city||'', a.phone||''].join(','));
  const csv = '﻿' + hdr + '\n' + rows.join('\n');
  const el = document.createElement('a');
  el.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  el.download = 'الوكلاء.csv'; el.click();
}

function agCopyTable() {
  const hdr  = ['#','الاسم','النوع','المركز الرئيسي','المدينة','الهاتف'].join('\t');
  const rows = _agFiltered.map(a =>
    [a.id, a.name||a.username||'', a.type||'', a.main_center||'', a.city||'', a.phone||''].join('\t'));
  navigator.clipboard.writeText(hdr + '\n' + rows.join('\n'))
    .then(() => alToast('تم النسخ إلى الحافظة','success','📋'))
    .catch(() => alToast('فشل النسخ','error','❌'));
}

// Modal الوكلاء
function agOpenAdd() {
  document.getElementById('ag-modal-title').textContent = 'اضافة وكيل جديد';
  ['ag-b-id','ag-b-name','ag-b-main_center','ag-b-city','ag-b-phone','ag-b-doc_url','ag-b-notes']
    .forEach(id => { const e = document.getElementById(id); if(e) e.value=''; });
  document.getElementById('ag-b-type').value   = 'internal';
  document.getElementById('ag-b-status').value = 'active';
  document.getElementById('ag-modal').classList.add('open');
}

function agOpenEdit(id) {
  const a = _agAll.find(x => x.id === id); if (!a) return;
  document.getElementById('ag-modal-title').textContent = 'تعديل الوكيل';
  document.getElementById('ag-b-id').value          = a.id;
  document.getElementById('ag-b-name').value        = a.name || a.username || '';
  document.getElementById('ag-b-main_center').value = a.main_center || '';
  document.getElementById('ag-b-city').value        = a.city || '';
  document.getElementById('ag-b-phone').value       = a.phone || '';
  document.getElementById('ag-b-doc_url').value     = a.doc_url || '';
  document.getElementById('ag-b-notes').value       = a.notes || '';
  document.getElementById('ag-b-type').value        = a.type || 'internal';
  document.getElementById('ag-b-status').value      = a.status || 'active';
  document.getElementById('ag-modal').classList.add('open');
}

function agCloseModal() { document.getElementById('ag-modal').classList.remove('open'); }

async function agSave() {
  const id   = document.getElementById('ag-b-id').value;
  const name = document.getElementById('ag-b-name').value.trim();
  if (!name) { alToast('اسم الوكيل مطلوب','error','❌'); return; }
  const body = {
    name,
    main_center: document.getElementById('ag-b-main_center').value.trim(),
    city:        document.getElementById('ag-b-city').value.trim(),
    phone:       document.getElementById('ag-b-phone').value.trim(),
    doc_url:     document.getElementById('ag-b-doc_url').value.trim(),
    notes:       document.getElementById('ag-b-notes').value.trim(),
    type:        document.getElementById('ag-b-type').value,
    status:      document.getElementById('ag-b-status').value,
  };
  const url    = id ? `/api/ts/agents/${id}` : '/api/ts/agents';
  const method = id ? 'PATCH' : 'POST';
  try {
    const r = await fetch(url, {
      method, credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.success !== false && !d.error) {
      alToast(id ? 'تم التحديث بنجاح' : 'تمت الإضافة بنجاح','success','✅');
      agCloseModal(); agLoadAgents();
    } else alToast(d.error||d.detail||'حدث خطأ','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function agDelete(id, name) {
  if (!confirm(`هل تريد حذف الوكيل "${name}"؟`)) return;
  try {
    const r = await fetch(`/api/ts/agents/${id}`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    const d = await r.json();
    if (d.success !== false && !d.error) {
      alToast('تم الحذف بنجاح','success','✅'); agLoadAgents();
    } else alToast(d.error||d.detail||'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

// إغلاق modal الوكلاء بالضغط خارجه
const _agModalEl = document.getElementById('ag-modal');
if (_agModalEl) {
  _agModalEl.addEventListener('click', e => {
    if (e.target === _agModalEl) _agModalEl.classList.remove('open');
  });
}

// ── بحث ──
function alSearch(q) {
  const term = q.trim();
  document.querySelectorAll('.al-ic').forEach(ic => {
    const lbl = ic.dataset.label || ic.querySelector('.al-ic-lbl')?.textContent || '';
    ic.style.display = (!term || lbl.includes(term)) ? '' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════════
// تبديل عملة
// ══════════════════════════════════════════════════════════════════
let _cxAll = [], _cxFiltered = [], _cxPage = 1, _cxPerPage = 10;
let _cxSortCol = 'id', _cxSortAsc = false;

async function cxLoadCenters() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    ['cx-center1','cx-center2'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">اختر المركز</option>';
      list.forEach(c => {
        const nm = c.name || c.center_name || c.centerName || String(c);
        const op = document.createElement('option');
        op.value = nm; op.textContent = nm;
        sel.appendChild(op);
      });
      if (cur) sel.value = cur;
    });
  } catch {}
}

function cxFilter(q) {
  const term = (q||'').trim().toLowerCase();
  _cxFiltered = term
    ? _cxAll.filter(r =>
        (r.refNumber||'').toLowerCase().includes(term) ||
        (r.center1||'').toLowerCase().includes(term)   ||
        (r.center2||'').toLowerCase().includes(term)   ||
        (r.notes||'').toLowerCase().includes(term))
    : [..._cxAll];
  _cxPage = 1;
  cxRender();
}

function cxSort(col) {
  if (_cxSortCol === col) _cxSortAsc = !_cxSortAsc;
  else { _cxSortCol = col; _cxSortAsc = true; }
  _cxFiltered.sort((a,b) => {
    let va = a[col]||'', vb = b[col]||'';
    if (!isNaN(va)&&!isNaN(vb)){ va=parseFloat(va); vb=parseFloat(vb); }
    if (va<vb) return _cxSortAsc?-1:1;
    if (va>vb) return _cxSortAsc?1:-1;
    return 0;
  });
  cxRender();
}

function cxRender(page) {
  if (page !== undefined) _cxPage = page;
  const perPageEl = document.getElementById('cx-per-page');
  if (perPageEl) _cxPerPage = parseInt(perPageEl.value)||10;
  const tbody = document.getElementById('cx-tbody');
  if (!tbody) return;
  const total  = _cxFiltered.length;
  const pages  = Math.max(1, Math.ceil(total/_cxPerPage));
  _cxPage = Math.min(Math.max(1,_cxPage), pages);
  const offset = (_cxPage-1)*_cxPerPage;
  const slice  = _cxFiltered.slice(offset, offset+_cxPerPage);
  const fmt    = v => parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  tbody.innerHTML = slice.length ? slice.map((r,i)=>{ const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td style="padding:7px 10px;font-size:11px;color:rgba(255,255,255,.7)">${r.refNumber||'-'}</td>
    <td style="padding:7px 10px;font-size:12px;color:#fff">${r.entryDate||'-'}</td>
    <td style="padding:7px 10px;font-size:12px;font-weight:600;color:#fff">${r.center1||'-'}</td>
    <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#4ADE80">${fmt(r.amount1)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.currency1||''}</span></td>
    <td style="padding:7px 10px;font-size:12px;font-weight:600;color:#fff">${r.center2||'-'}</td>
    <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#67E8F9">${fmt(r.amount2)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.currency2||''}</span></td>
    <td style="padding:7px 10px;font-size:11.5px;color:rgba(255,255,255,.4)">—</td>
    <td style="padding:7px 10px;font-size:11.5px;color:rgba(255,255,255,.4)">—</td>
    <td style="padding:7px 10px;font-size:11.5px;color:rgba(255,255,255,.7);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes||'-'}</td>
    <td style="padding:7px 10px;text-align:center">
      <button onclick="cxDelete(${r.id},'${r.refNumber}')" style="background:rgba(103,232,249,.15);color:#67E8F9;border:1px solid rgba(103,232,249,.3);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px">✕</button>
    </td>
  </tr>`; }).join('') : '<tr><td colspan="10" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">لا توجد سجلات</td></tr>';

  const prevBtn = document.getElementById('cx-prev');
  const nextBtn = document.getElementById('cx-next');
  const pagesEl = document.getElementById('cx-pages');
  const showEl  = document.getElementById('cx-showing');
  if (prevBtn) prevBtn.disabled = _cxPage<=1;
  if (nextBtn) nextBtn.disabled = _cxPage>=pages;
  if (pagesEl) pagesEl.textContent = `${_cxPage} / ${pages}`;
  if (showEl)  showEl.textContent  = total ? `${offset+1}–${Math.min(offset+_cxPerPage,total)} من ${total}` : '—';
}

async function cxLoad() {
  cxLoadCenters();
  const dateEl = document.getElementById('cx-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  try {
    const r = await fetch('/api/am/currency-exchange/?per_page=500', {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast(d.message||'خطأ','error','❌'); return; }
    _cxAll = d.records||[];
    _cxFiltered = [..._cxAll];
    cxRender();
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function cxSave() {
  const center1   = document.getElementById('cx-center1')?.value||'';
  const currency1 = document.getElementById('cx-currency1')?.value||'USD';
  const amount1   = parseFloat(document.getElementById('cx-amount1')?.value||0);
  const notes     = document.getElementById('cx-notes')?.value?.trim()||'';
  const center2   = document.getElementById('cx-center2')?.value||'';
  const currency2 = document.getElementById('cx-currency2')?.value||'EUR';
  const amount2   = parseFloat(document.getElementById('cx-amount2')?.value||0);
  const entryDate = new Date().toISOString().split('T')[0];

  if (!center1)  { alToast('اختر المركز الأول','warning','⚠️'); return; }
  if (!center2)  { alToast('اختر المركز الثاني','warning','⚠️'); return; }
  if (!amount1||amount1<=0) { alToast('أدخل المبلغ الأول','warning','⚠️'); return; }
  if (!amount2||amount2<=0) { alToast('أدخل المبلغ الثاني','warning','⚠️'); return; }

  try {
    const r = await fetch('/api/am/currency-exchange/', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify({center1,currency1,amount1,notes,center2,currency2,amount2,entryDate}),
    });
    const d = await r.json();
    if (d.success) {
      alToast(d.message||'تم إنشاء سند التبديل','success','✅');
      ['cx-amount1','cx-amount2','cx-notes'].forEach(id=>{
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('cx-ref-badge').textContent = d.record?.refNumber||'XXX';
      cxLoad();
    } else { alToast(d.message||'حدث خطأ','error','❌'); }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function cxDelete(id, ref) {
  if (!confirm(`هل تريد حذف سند التبديل ${ref}؟`)) return;
  try {
    const r = await fetch(`/api/am/currency-exchange/${id}/`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    const d = await r.json();
    if (d.success) { alToast(d.message||'تم الحذف','success','🗑️'); cxLoad(); }
    else alToast(d.message||'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

function cxExportCSV() {
  if (!_cxFiltered.length) { alToast('لا توجد بيانات للتصدير','warning','⚠️'); return; }
  const headers = ['رقم السند','المركز الأول','العملة','المبلغ','المركز الثاني','العملة','المبلغ','التاريخ','ملاحظات'];
  const rows = _cxFiltered.map(r=>[
    r.refNumber||'', r.center1||'', r.currency1||'', r.amount1||0,
    r.center2||'', r.currency2||'', r.amount2||0,
    r.entryDate||'', (r.notes||'').replace(/,/g,' '),
  ]);
  const csv = '﻿'+[headers,...rows].map(r=>r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = 'currency-exchange.csv';
  a.click();
}

// ══ حركة صادرة ══
let _otAll = [], _otFiltered = [], _otSortCol = 'id', _otSortAsc = true, _otPage = 1, _otPerPage = 10;

async function otLoadCenters() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    ['ot-source','ot-destination'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">اختر المركز</option>';
      list.forEach(c => {
        const nm = c.name || c.center_name || c;
        const op = document.createElement('option');
        op.value = nm; op.textContent = nm;
        sel.appendChild(op);
      });
      if (cur) sel.value = cur;
    });
  } catch {}
}

function otCalc() {
  const send    = parseFloat(document.getElementById('ot-send-amount')?.value  || 0) || 0;
  const expFee  = parseFloat(document.getElementById('ot-export-fee')?.value   || 0) || 0;
  const delFee  = parseFloat(document.getElementById('ot-delivery-fee')?.value || 0) || 0;
  const total   = send + expFee + delFee;
  const totEl   = document.getElementById('ot-total');
  if (totEl) totEl.value = total ? total.toFixed(3) : '';
}

async function otLoad() {
  otLoadCenters();
  const dateEl = document.getElementById('ot-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  try {
    const r = await fetch('/api/am/outgoing-transfer/?per_page=500', {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast(d.message||'خطأ','error','❌'); return; }
    _otAll = d.records||[];
    _otFiltered = [..._otAll];
    otRender(1);
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function otSave() {
  const sourceCenter    = document.getElementById('ot-source')?.value||'';
  const beneficiaryName = document.getElementById('ot-bname')?.value?.trim()||'';
  const beneficiaryPhone= document.getElementById('ot-bphone')?.value?.trim()||'';
  const destination     = document.getElementById('ot-destination')?.value||'';
  const address         = document.getElementById('ot-address')?.value?.trim()||'';
  const sendCurrency    = document.getElementById('ot-send-currency')?.value||'USD';
  const sendAmount      = parseFloat(document.getElementById('ot-send-amount')?.value||0)||0;
  const receiveCurrency = document.getElementById('ot-recv-currency')?.value||'USD';
  const receiveAmount   = parseFloat(document.getElementById('ot-recv-amount')?.value||0)||0;
  const exportFee       = parseFloat(document.getElementById('ot-export-fee')?.value||0)||0;
  const deliveryFee     = parseFloat(document.getElementById('ot-delivery-fee')?.value||0)||0;
  const exchangeRate    = parseFloat(document.getElementById('ot-rate')?.value||1)||1;
  const notes           = document.getElementById('ot-notes')?.value?.trim()||'';
  const entryDate       = document.getElementById('ot-date')?.value || new Date().toISOString().split('T')[0];

  if (!sourceCenter)    { alToast('اختر المصدر','warning','⚠️'); return; }
  if (!beneficiaryName) { alToast('أدخل اسم المستفيد','warning','⚠️'); return; }
  if (!sendAmount||sendAmount<=0) { alToast('أدخل مبلغ الإرسال','warning','⚠️'); return; }

  try {
    const r = await fetch('/api/am/outgoing-transfer/', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json','X-CSRFToken':_getCsrf()},
      body: JSON.stringify({
        sourceCenter, beneficiaryName, beneficiaryPhone, destination, address,
        sendCurrency, sendAmount, receiveCurrency, receiveAmount,
        exportFee, deliveryFee, exchangeRate, notes, entryDate,
      }),
    });
    const d = await r.json();
    if (d.success) {
      alToast(d.message||'تم إنشاء الحركة الصادرة','success','✅');
      ['ot-bname','ot-bphone','ot-address','ot-send-amount','ot-recv-amount',
       'ot-export-fee','ot-delivery-fee','ot-total','ot-rate','ot-notes'].forEach(id=>{
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('ot-ref-badge').textContent = d.record?.refNumber||'XXX';
      otLoad();
    } else { alToast(d.message||'حدث خطأ','error','❌'); }
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

async function otDelete(id, ref) {
  if (!confirm(`هل تريد حذف الحركة ${ref}؟`)) return;
  try {
    const r = await fetch(`/api/am/outgoing-transfer/${id}/`, {
      method:'DELETE', credentials:'include',
      headers:{'X-CSRFToken':_getCsrf()},
    });
    const d = await r.json();
    if (d.success) { alToast(d.message||'تم الحذف','success','🗑️'); otLoad(); }
    else alToast(d.message||'فشل الحذف','error','❌');
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

function otFilter(q) {
  const term = (q||'').trim().toLowerCase();
  _otFiltered = term
    ? _otAll.filter(r =>
        (r.refNumber||'').toLowerCase().includes(term)        ||
        (r.sourceCenter||'').toLowerCase().includes(term)     ||
        (r.beneficiaryName||'').toLowerCase().includes(term)  ||
        (r.beneficiaryPhone||'').toLowerCase().includes(term) ||
        (r.destination||'').toLowerCase().includes(term)      ||
        (r.notes||'').toLowerCase().includes(term))
    : [..._otAll];
  _otPage = 1;
  otRender();
}

function otSort(col) {
  if (_otSortCol === col) _otSortAsc = !_otSortAsc;
  else { _otSortCol = col; _otSortAsc = true; }
  _otFiltered.sort((a,b) => {
    let va = a[col]||'', vb = b[col]||'';
    if (!isNaN(va)&&!isNaN(vb)){ va=parseFloat(va); vb=parseFloat(vb); }
    if (va<vb) return _otSortAsc?-1:1;
    if (va>vb) return _otSortAsc?1:-1;
    return 0;
  });
  otRender();
}

function otRender(page) {
  if (page !== undefined) _otPage = page;
  const perPageEl = document.getElementById('ot-per-page');
  if (perPageEl) _otPerPage = parseInt(perPageEl.value)||10;
  const tbody = document.getElementById('ot-tbody');
  if (!tbody) return;
  const total  = _otFiltered.length;
  const pages  = Math.max(1, Math.ceil(total/_otPerPage));
  _otPage = Math.min(Math.max(1,_otPage), pages);
  const offset = (_otPage-1)*_otPerPage;
  const slice  = _otFiltered.slice(offset, offset+_otPerPage);
  const fmt    = v => parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  tbody.innerHTML = slice.length ? slice.map((r,i)=>{ const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td style="padding:7px 10px;font-size:11px;color:rgba(255,255,255,.7)">${r.refNumber||'-'}</td>
    <td style="padding:7px 10px;font-size:12px;color:#fff">${r.entryDate||'-'}</td>
    <td style="padding:7px 10px;font-size:12px;font-weight:600;color:#fff">${r.sourceCenter||'-'}</td>
    <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#4ADE80">${fmt(r.sendAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.sendCurrency||''}</span></td>
    <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#FCA5A5">${fmt(r.receiveAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.receiveCurrency||''}</span></td>
    <td style="padding:7px 10px;font-size:12px">
      <div style="font-weight:600;color:#fff">${r.beneficiaryName||'-'}</div>
      <div style="font-size:10px;color:rgba(255,255,255,.5)">${r.beneficiaryPhone||''}</div>
    </td>
    <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#93C5FD">${fmt(r.total)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.sendCurrency||''}</span></td>
    <td style="padding:7px 10px;font-size:11.5px;color:rgba(255,255,255,.7);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes||'-'}</td>
    <td style="padding:7px 10px;text-align:center">
      <button onclick="otDelete(${r.id},'${r.refNumber}')" style="background:rgba(147,197,253,.15);color:#93C5FD;border:1px solid rgba(147,197,253,.3);border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px">✕</button>
    </td>
  </tr>`; }).join('') : '<tr><td colspan="9" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">لا توجد سجلات</td></tr>';

  const prevBtn = document.getElementById('ot-prev');
  const nextBtn = document.getElementById('ot-next');
  const pagesEl = document.getElementById('ot-pages');
  const showEl  = document.getElementById('ot-showing');
  if (prevBtn) prevBtn.disabled = _otPage<=1;
  if (nextBtn) nextBtn.disabled = _otPage>=pages;
  if (pagesEl) pagesEl.textContent = `${_otPage} / ${pages}`;
  if (showEl)  showEl.textContent  = total ? `${offset+1}–${Math.min(offset+_otPerPage,total)} من ${total}` : '—';
}

function otExportCSV() {
  if (!_otFiltered.length) { alToast('لا توجد بيانات للتصدير','warning','⚠️'); return; }
  const headers = ['رقم الحركة','التاريخ','المصدر','اسم المستفيد','هاتف المستفيد','الوجهة','مبلغ الإرسال','العملة','مبلغ التسليم','عملة التسليم','أجور تصدير','أجور تسليم','المجموع','الصرف','ملاحظات'];
  const rows = _otFiltered.map(r=>[
    r.refNumber||'', r.entryDate||'', r.sourceCenter||'',
    r.beneficiaryName||'', r.beneficiaryPhone||'', r.destination||'',
    r.sendAmount||0, r.sendCurrency||'',
    r.receiveAmount||0, r.receiveCurrency||'',
    r.exportFee||0, r.deliveryFee||0, r.total||0, r.exchangeRate||1,
    (r.notes||'').replace(/,/g,' '),
  ]);
  const csv = '﻿'+[headers,...rows].map(r=>r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = 'outgoing-transfers.csv';
  a.click();
}

// ══ اعتماد جديد ══
async function ncLoadCenters() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    ['nc-source','nc-safe'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      const ph = selId === 'nc-source' ? 'اختر المركز' : 'اختر وجهة الاعتماد';
      sel.innerHTML = `<option value="">${ph}</option>`;
      list.forEach(c => {
        const nm = c.name || c.center_name || c;
        const op = document.createElement('option');
        op.value = nm; op.textContent = nm;
        sel.appendChild(op);
      });
    });
  } catch {}
}

function ncLoad() {
  ncLoadCenters();
}

async function ncSave() {
  const company  = document.getElementById('nc-company')?.value?.trim() || '';
  const source   = document.getElementById('nc-source')?.value || '';
  const currency = document.getElementById('nc-currency')?.value || '';
  const amount   = parseFloat(document.getElementById('nc-amount')?.value || 0) || 0;
  const safe     = document.getElementById('nc-safe')?.value || '';
  const notes    = document.getElementById('nc-notes')?.value?.trim() || '';
  const fees     = parseFloat(document.getElementById('nc-fees')?.value || 0) || 0;
  const entryDate = new Date().toISOString().split('T')[0];

  if (!company)        { alToast('أدخل اسم الشركة', 'warning', '⚠️'); return; }
  if (!source)         { alToast('اختر المصدر', 'warning', '⚠️'); return; }
  if (!currency)       { alToast('اختر العملة', 'warning', '⚠️'); return; }
  if (!amount || amount <= 0) { alToast('أدخل المبلغ', 'warning', '⚠️'); return; }
  if (!safe)           { alToast('اختر الصندوق', 'warning', '⚠️'); return; }

  try {
    const r = await fetch('/api/am/new-credit/', {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type':'application/json', 'X-CSRFToken': _getCsrf()},
      body: JSON.stringify({company, source, currency, amount, safe, notes, fees, entryDate}),
    });
    const d = await r.json();
    if (d.success) {
      alToast(d.message || 'تم إنشاء الاعتماد', 'success', '✅');
      ['nc-company','nc-amount','nc-notes','nc-fees'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      ['nc-source','nc-safe','nc-currency'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.selectedIndex = 0;
      });
    } else {
      alToast(d.message || 'حدث خطأ', 'error', '❌');
    }
  } catch { alToast('خطأ في الاتصال', 'error', '❌'); }
}

// ══ ميزان المراجعة ══
function tbInit() {
  const today = new Date().toISOString().split('T')[0];
  const df = document.getElementById('tb-date-from');
  const dt = document.getElementById('tb-date-to');
  if (df && !df.value) df.value = today;
  if (dt && !dt.value) dt.value = today;
  tbLoad();
}

async function tbLoad() {
  const statusEl = document.getElementById('tb-status');
  if (statusEl) statusEl.textContent = '⏳ جارٍ التحميل...';

  const df = document.getElementById('tb-date-from')?.value || '';
  const dt = document.getElementById('tb-date-to')?.value   || '';
  let url = '/api/am/trial-balance/';
  const params = [];
  if (df) params.push(`date_from=${df}`);
  if (dt) params.push(`date_to=${dt}`);
  if (params.length) url += '?' + params.join('&');

  try {
    const r = await fetch(url, {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast(d.message||'خطأ','error','❌'); return; }

    const fmt  = (v,c='') => parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3}) + (c?' '+c:'');
    const fmtB = v => { const n=parseFloat(v||0); return (n>=0?'':'')+fmt(Math.abs(n)); };
    const tbRow = (i) => `background:${i%2===0?'#1E3A5F':'#162d4a'};border-bottom:1px solid rgba(255,255,255,.08)`;
    const empty = '<tr><td colspan="4" style="text-align:center;padding:12px;color:rgba(255,255,255,.4);font-size:11.5px">لا توجد بيانات</td></tr>';

    // ميزان المراجعة
    const tbEl = document.getElementById('tb-tbody');
    if (tbEl) tbEl.innerHTML = d.trialBalance?.length
      ? d.trialBalance.map((r,i)=>`<tr style="${tbRow(i)}" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${i%2===0?'#1E3A5F':'#162d4a'}'">
          <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#93C5FD">${r.currency}</td>
          <td style="padding:8px 14px;font-size:12px;font-weight:600;color:#fff">${fmt(r.total)}</td>
          <td style="padding:8px 14px;font-size:12px;color:#FCA5A5;font-weight:600">${fmt(r.credit)}</td>
          <td style="padding:8px 14px;font-size:12px;color:#4ADE80;font-weight:600">${fmt(r.debit)}</td>
        </tr>`).join('') : empty;

    // صافي المركز لكل عملة منفصلة (لا يُجمع عملات مختلفة في رقم واحد)
    const badgeEl = document.getElementById('tb-balance-badge');
    if (badgeEl) {
      const balByCur = d.balanceByCurrency || {};
      const parts = Object.keys(balByCur)
        .filter(c => Math.abs(balByCur[c]) > 0.0001)
        .map(c => `${c}: ${fmtB(balByCur[c])}`);
      badgeEl.textContent = parts.length ? ('صافي المركز — ' + parts.join(' · ')) : 'لا يوجد رصيد';
      badgeEl.style.color = '#93C5FD';
    }

    // أرصدة الزبائن
    const zbnEl = document.getElementById('tb-zbn-tbody');
    if (zbnEl) zbnEl.innerHTML = d.clientBalances?.length
      ? d.clientBalances.map((r,i)=>`<tr style="${tbRow(i)}" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${i%2===0?'#1E3A5F':'#162d4a'}'">
          <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#93C5FD">${r.currency}</td>
          <td style="padding:8px 14px;font-size:12px;color:#fff">${fmt(r.total)}</td>
        </tr>`).join('')
      : '<tr><td colspan="2" style="text-align:center;padding:12px;color:rgba(255,255,255,.4);font-size:11.5px">لا توجد بيانات</td></tr>';

    // مراكز القطع
    const cutEl = document.getElementById('tb-cut-tbody');
    if (cutEl) cutEl.innerHTML = d.cutCenters?.length
      ? d.cutCenters.map((r,i)=>`<tr style="${tbRow(i)}" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${i%2===0?'#1E3A5F':'#162d4a'}'">
          <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#93C5FD">${r.currency}</td>
        </tr>`).join('')
      : '<tr><td style="text-align:center;padding:12px;color:rgba(255,255,255,.4);font-size:11.5px">لا توجد بيانات</td></tr>';

    // حوالات غير مسلمة
    const unEl = document.getElementById('tb-unrcv-tbody');
    if (unEl) unEl.innerHTML = d.unreceived?.length
      ? d.unreceived.map((r,i)=>`<tr style="${tbRow(i)}" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${i%2===0?'#1E3A5F':'#162d4a'}'">
          <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#93C5FD">${r.currency}</td>
          <td style="padding:8px 14px;font-size:12px;color:#FDE047;font-weight:600">${fmt(r.total)}</td>
        </tr>`).join('')
      : '<tr><td colspan="2" style="text-align:center;padding:12px;color:rgba(255,255,255,.4);font-size:11.5px">لا توجد بيانات</td></tr>';

    // الأرباح
    const prEl = document.getElementById('tb-profit-tbody');
    if (prEl) prEl.innerHTML = d.profitItems?.length
      ? d.profitItems.map((p,i)=>`<tr style="${tbRow(i)}" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${i%2===0?'#1E3A5F':'#162d4a'}'">
          <td style="padding:8px 14px;font-size:11.5px;color:#fff">${p.label||'—'}</td>
          <td style="padding:8px 14px;font-size:11.5px;font-weight:600;color:#93C5FD">${p.currency||''}</td>
          <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#4ADE80">${fmt(p.amount)}</td>
        </tr>`).join('')
      : '<tr><td colspan="3" style="text-align:center;padding:12px;color:rgba(255,255,255,.4);font-size:11.5px">لا توجد أرباح</td></tr>';

    // صافي الأرباح
    const tpEl = document.getElementById('tb-total-profit');
    const npEl = document.getElementById('tb-net-profit');
    if (tpEl) tpEl.textContent = fmt(d.totalProfit) + ' USD';
    if (npEl) npEl.textContent = fmt(d.netProfit)   + ' USD';

    if (statusEl) statusEl.textContent = `آخر تحديث: ${new Date().toLocaleTimeString('ar')}`;
  } catch (e) {
    alToast('خطأ في الاتصال','error','❌');
    if (statusEl) statusEl.textContent = 'فشل التحميل';
  }
}

// ══ تدقيق القيود ══
let _eaAll = [], _eaFiltered = [], _eaSortCol = 'entryDate', _eaSortAsc = false, _eaPage = 1, _eaPerPage = 20;

async function eaInit() {
  // تعبئة dropdown المراكز
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    const sel = document.getElementById('ea-center');
    if (sel) {
      sel.innerHTML = '<option value="">اختر المركز</option>';
      list.forEach(c => {
        const nm = c.name || c.center_name || c;
        const op = document.createElement('option');
        op.value = nm; op.textContent = nm;
        sel.appendChild(op);
      });
    }
  } catch {}
  // تعيين تاريخ اليوم افتراضياً
  const today = new Date().toISOString().split('T')[0];
  const df = document.getElementById('ea-date-from');
  const dt = document.getElementById('ea-date-to');
  if (df && !df.value) df.value = today;
  if (dt && !dt.value) dt.value = today;
}

async function eaSearch() {
  const tbody = document.getElementById('ea-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px"><div class="sp-spinner"></div></td></tr>';

  const center   = document.getElementById('ea-center')?.value   || '';
  const dateFrom = document.getElementById('ea-date-from')?.value || '';
  const dateTo   = document.getElementById('ea-date-to')?.value   || '';

  let url = '/api/am/outgoing-transfer/?per_page=500';
  if (dateFrom) url += `&date_from=${dateFrom}`;
  if (dateTo)   url += `&date_to=${dateTo}`;

  try {
    const r = await fetch(url, {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast(d.message||'خطأ','error','❌'); return; }
    let records = d.records || [];
    // فلتر المركز
    if (center) records = records.filter(r => r.sourceCenter === center || r.destination === center);
    _eaAll      = records;
    _eaFiltered = [...records];
    eaUpdateTotals();
    eaRender(1);
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

function eaFilter(q) {
  const term = (q||'').trim().toLowerCase();
  _eaFiltered = term
    ? _eaAll.filter(r =>
        (r.refNumber||'').toLowerCase().includes(term)        ||
        (r.beneficiaryName||'').toLowerCase().includes(term)  ||
        (r.sourceCenter||'').toLowerCase().includes(term)     ||
        (r.destination||'').toLowerCase().includes(term)      ||
        (r.notes||'').toLowerCase().includes(term))
    : [..._eaAll];
  eaRender(1);
}

function eaSort(col) {
  if (_eaSortCol === col) _eaSortAsc = !_eaSortAsc;
  else { _eaSortCol = col; _eaSortAsc = true; }
  _eaFiltered.sort((a,b) => {
    let va = a[col]||'', vb = b[col]||'';
    if (!isNaN(va)&&!isNaN(vb)){ va=parseFloat(va); vb=parseFloat(vb); }
    if (va<vb) return _eaSortAsc?-1:1;
    if (va>vb) return _eaSortAsc?1:-1;
    return 0;
  });
  eaRender();
}

function eaUpdateTotals() {
  const totDiv  = document.getElementById('ea-totals');
  const totUs   = document.getElementById('ea-total-us');
  const totThem = document.getElementById('ea-total-them');
  const totCnt  = document.getElementById('ea-total-count');
  if (!totDiv) return;
  if (!_eaAll.length) { totDiv.style.display = 'none'; return; }
  const fmt = v => parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const sumUs   = _eaAll.reduce((s,r) => s + parseFloat(r.sendAmount||0),    0);
  const sumThem = _eaAll.reduce((s,r) => s + parseFloat(r.receiveAmount||0), 0);
  if (totUs)   totUs.textContent   = fmt(sumUs);
  if (totThem) totThem.textContent = fmt(sumThem);
  if (totCnt)  totCnt.textContent  = _eaAll.length;
  totDiv.style.display = 'flex';
}

function eaRender(page) {
  if (page !== undefined) _eaPage = page;
  const tbody = document.getElementById('ea-tbody');
  if (!tbody) return;
  const total  = _eaFiltered.length;
  const pages  = Math.max(1, Math.ceil(total / _eaPerPage));
  _eaPage = Math.min(Math.max(1, _eaPage), pages);
  const offset = (_eaPage - 1) * _eaPerPage;
  const slice  = _eaFiltered.slice(offset, offset + _eaPerPage);
  const fmt    = v => parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  tbody.innerHTML = slice.length ? slice.map((r,i) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,.08);background:${i%2===0?'#1E3A5F':'#162d4a'}" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${i%2===0?'#1E3A5F':'#162d4a'}'">
      <td style="padding:8px 12px;font-size:11px;color:#fff;font-family:monospace;white-space:nowrap">${r.refNumber||'—'}</td>
      <td style="padding:8px 12px;font-size:11.5px;color:#fff;white-space:nowrap">${r.entryDate||'—'}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#4ADE80;white-space:nowrap">${fmt(r.sendAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.sendCurrency||''}</span></td>
      <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap">${r.sourceCenter||'—'}</td>
      <td style="padding:8px 12px;font-size:12px;color:#fff">
        <div style="font-weight:600">${r.beneficiaryName||'—'}</div>
        ${r.beneficiaryPhone?`<div style="font-size:10px;color:rgba(255,255,255,.5)">${r.beneficiaryPhone}</div>`:''}
      </td>
      <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#FCA5A5;white-space:nowrap">${fmt(r.receiveAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.receiveCurrency||''}</span></td>
      <td style="padding:8px 12px;font-size:12px;color:#fff;white-space:nowrap">${r.destination||'—'}</td>
      <td style="padding:8px 12px;font-size:11.5px;color:rgba(255,255,255,.7);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.notes||''}">${r.notes||'—'}</td>
      <td style="padding:8px 12px;text-align:center">
        <span style="background:rgba(96,165,250,.2);color:#93C5FD;border-radius:20px;padding:2px 10px;font-size:10.5px;font-weight:600;white-space:nowrap;border:1px solid rgba(96,165,250,.3)">صادر</span>
      </td>
    </tr>`).join('')
  : '<tr><td colspan="9" style="text-align:center;padding:40px;color:#94A3B8;font-size:12px">📭 لا توجد نتائج</td></tr>';

  const prevBtn = document.getElementById('ea-prev');
  const nextBtn = document.getElementById('ea-next');
  const pagesEl = document.getElementById('ea-pages');
  const showEl  = document.getElementById('ea-showing');
  if (prevBtn) prevBtn.disabled = _eaPage <= 1;
  if (nextBtn) nextBtn.disabled = _eaPage >= pages;
  if (pagesEl) pagesEl.textContent = total ? `${_eaPage} / ${pages}` : '—';
  if (showEl)  showEl.textContent  = total ? `${offset+1}–${Math.min(offset+_eaPerPage,total)} من ${total}` : '—';
}

// ══ مراقبة العمليات ══
let _omAll = [], _omFiltered = [], _omSortCol = 'entryDate', _omSortAsc = false, _omPage = 1, _omPerPage = 20;

async function omLoad() {
  const tbody = document.getElementById('om-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:30px"><div class="sp-spinner"></div></td></tr>';

  const dateFrom = document.getElementById('om-date-from')?.value || '';
  const dateTo   = document.getElementById('om-date-to')?.value   || '';

  let url = '/api/am/outgoing-transfer/?per_page=500';
  if (dateFrom) url += `&date_from=${dateFrom}`;
  if (dateTo)   url += `&date_to=${dateTo}`;

  try {
    const r = await fetch(url, {credentials:'include'});
    const d = await r.json();
    if (!d.success) { alToast(d.message||'خطأ في التحميل','error','❌'); return; }
    _omAll      = d.records || [];
    _omFiltered = [..._omAll];
    const showEl = document.getElementById('om-showing');
    if (showEl) showEl.textContent = `${_omAll.length} عملية`;
    omRender(1);
  } catch { alToast('خطأ في الاتصال','error','❌'); }
}

function omFilter(q) {
  const term   = (typeof q === 'string' ? q : (document.getElementById('om-search')?.value||'')).trim().toLowerCase();
  const status = document.getElementById('om-status-filter')?.value || '';
  _omFiltered = _omAll.filter(r => {
    const matchText = !term || (
      (r.refNumber||'').toLowerCase().includes(term)       ||
      (r.beneficiaryName||'').toLowerCase().includes(term) ||
      (r.sourceCenter||'').toLowerCase().includes(term)    ||
      (r.destination||'').toLowerCase().includes(term)     ||
      (r.notes||'').toLowerCase().includes(term)
    );
    const matchStatus = !status || (r.status||'pending') === status;
    return matchText && matchStatus;
  });
  omRender(1);
}

function omSort(col) {
  if (_omSortCol === col) _omSortAsc = !_omSortAsc;
  else { _omSortCol = col; _omSortAsc = true; }
  _omFiltered.sort((a,b) => {
    let va = a[col]||'', vb = b[col]||'';
    if (!isNaN(va)&&!isNaN(vb)){ va=parseFloat(va); vb=parseFloat(vb); }
    if (va<vb) return _omSortAsc?-1:1;
    if (va>vb) return _omSortAsc?1:-1;
    return 0;
  });
  omRender();
}

function omRender(page) {
  if (page !== undefined) _omPage = page;
  const perPageEl = document.getElementById('om-per-page');
  if (perPageEl) _omPerPage = parseInt(perPageEl.value)||20;
  const tbody = document.getElementById('om-tbody');
  if (!tbody) return;

  const total  = _omFiltered.length;
  const pages  = Math.max(1, Math.ceil(total / _omPerPage));
  _omPage = Math.min(Math.max(1, _omPage), pages);
  const offset = (_omPage - 1) * _omPerPage;
  const slice  = _omFiltered.slice(offset, offset + _omPerPage);
  const fmt    = v => parseFloat(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  const statusBadge = s => {
    const map = {
      pending:   ['rgba(253,224,71,.15)','#FDE047','بانتظار'],
      completed: ['rgba(74,222,128,.15)','#4ADE80','مكتمل'],
      cancelled: ['rgba(252,165,165,.15)','#FCA5A5','ملغي'],
    };
    const [bg,color,label] = map[s]||['rgba(148,163,184,.15)','rgba(255,255,255,.6)', s||'—'];
    return `<span style="background:${bg};color:${color};border-radius:20px;padding:2px 10px;font-size:10.5px;font-weight:600;white-space:nowrap;border:1px solid ${color}33">${label}</span>`;
  };

  tbody.innerHTML = slice.length ? slice.map((r,i) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,.08);background:${i%2===0?'#1E3A5F':'#162d4a'};transition:background .1s" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${i%2===0?'#1E3A5F':'#162d4a'}'">
      <td style="padding:9px 12px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap">${r.sourceCenter||'—'}</td>
      <td style="padding:9px 12px;font-size:12px;color:#fff;white-space:nowrap">${r.destination||'—'}</td>
      <td style="padding:9px 12px;font-size:12px;font-weight:700;color:#4ADE80;white-space:nowrap">${fmt(r.sendAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.sendCurrency||''}</span></td>
      <td style="padding:9px 12px;font-size:12px;font-weight:700;color:#FCA5A5;white-space:nowrap">${fmt(r.receiveAmount)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.receiveCurrency||''}</span></td>
      <td style="padding:9px 12px;font-size:12px;font-weight:700;color:#93C5FD;white-space:nowrap">${fmt(r.total)} <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.5)">${r.sendCurrency||''}</span></td>
      <td style="padding:9px 12px;font-size:11.5px;color:#fff;white-space:nowrap">${r.entryDate||'—'}</td>
      <td style="padding:9px 12px;font-size:11.5px;color:rgba(255,255,255,.5);white-space:nowrap">—</td>
      <td style="padding:9px 12px;font-size:11px;color:rgba(255,255,255,.7);white-space:nowrap;font-family:monospace">${r.refNumber||'—'}</td>
      <td style="padding:9px 12px;font-size:12px;color:#fff">
        <div style="font-weight:600">${r.beneficiaryName||'—'}</div>
        ${r.beneficiaryPhone?`<div style="font-size:10px;color:rgba(255,255,255,.5)">${r.beneficiaryPhone}</div>`:''}
      </td>
      <td style="padding:9px 12px;font-size:11.5px;color:rgba(255,255,255,.7);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.notes||''}">${r.notes||'—'}</td>
      <td style="padding:9px 12px;text-align:center">${statusBadge(r.status||'pending')}</td>
    </tr>`).join('')
  : '<tr><td colspan="11" style="text-align:center;padding:40px;color:rgba(255,255,255,.4);font-size:12px">📭 لا توجد عمليات</td></tr>';

  const prevBtn = document.getElementById('om-prev');
  const nextBtn = document.getElementById('om-next');
  const pagesEl = document.getElementById('om-pages');
  const showB   = document.getElementById('om-showing-b');
  if (prevBtn) prevBtn.disabled = _omPage <= 1;
  if (nextBtn) nextBtn.disabled = _omPage >= pages;
  if (pagesEl) pagesEl.textContent = total ? `${_omPage} / ${pages}` : '—';
  if (showB)   showB.textContent   = total ? `${offset+1}–${Math.min(offset+_omPerPage,total)} من ${total}` : '—';
}

// ══ أرباح من كل صندوق ══
let _ppsAll = [], _ppsFiltered = [], _ppsSortCol = 'id', _ppsSortAsc = true, _ppsPage = 1, _ppsPerPage = 10;

function ppsInit() {
  const today = new Date();
  const from  = new Date(today); from.setMonth(from.getMonth() - 1);
  const fmt   = d => d.toISOString().split('T')[0];
  const fromEl = document.getElementById('pps-date-from');
  const toEl   = document.getElementById('pps-date-to');
  if (fromEl && !fromEl.value) fromEl.value = fmt(from);
  if (toEl   && !toEl.value)   toEl.value   = fmt(today);
  document.getElementById('pps-tbody').innerHTML =
    '<tr><td colspan="17" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">اختر نطاق تاريخ واضغط بحث</td></tr>';
  document.getElementById('pps-showing').textContent = '—';
  document.getElementById('pps-pages').innerHTML = '';
}

async function ppsLoad() {
  const from = document.getElementById('pps-date-from')?.value || '';
  const to   = document.getElementById('pps-date-to')?.value   || '';
  if (!from || !to) { alToast('يرجى تحديد التاريخين','error','❌'); return; }
  document.getElementById('pps-tbody').innerHTML =
    '<tr><td colspan="17" style="text-align:center;padding:30px"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch(`/api/center-profits/?from=${from}&to=${to}`, {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || []);
    _ppsAll = list; _ppsFiltered = [..._ppsAll];
    document.getElementById('sp-count').textContent = `— ${_ppsAll.length} صندوق`;
    ppsRender(1);
  } catch {
    _ppsAll = []; _ppsFiltered = [];
    document.getElementById('pps-tbody').innerHTML =
      '<tr><td colspan="17" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">📭 لا توجد بيانات لهذه الفترة</td></tr>';
    document.getElementById('pps-showing').textContent = '—';
  }
}

function ppsRender(p) {
  if (p !== undefined) _ppsPage = p;
  const perPageEl = document.getElementById('pps-per-page');
  if (perPageEl) _ppsPerPage = parseInt(perPageEl.value) || 10;
  const tbody = document.getElementById('pps-tbody');
  if (!tbody) return;

  const total  = _ppsFiltered.length;
  const pages  = Math.max(1, Math.ceil(total / _ppsPerPage));
  _ppsPage = Math.min(Math.max(1, _ppsPage), pages);
  const offset = (_ppsPage - 1) * _ppsPerPage;
  const slice  = _ppsFiltered.slice(offset, offset + _ppsPerPage);

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="17" style="text-align:center;padding:30px;color:rgba(255,255,255,.4);font-size:12px">📭 لا توجد بيانات لهذه الفترة</td></tr>';
    document.getElementById('pps-showing').textContent = '—';
    document.getElementById('pps-pages').innerHTML = '';
    document.getElementById('pps-prev').disabled = true;
    document.getElementById('pps-next').disabled = true;
    return;
  }

  const fmt = v => v != null && v !== 0
    ? `<span style="color:#4ADE80;font-weight:700">${Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`
    : '<span style="color:rgba(255,255,255,.3)">—</span>';
  const fmtTotal = v => v != null && v !== 0
    ? `<span style="color:#FDE047;font-weight:900;font-size:12px">${Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`
    : '<span style="color:rgba(255,255,255,.3)">—</span>';

  tbody.innerHTML = slice.map((c,i) => { const bg=i%2===0?'#1E3A5F':'#162d4a'; return `<tr style="background:${bg};border-bottom:1px solid rgba(255,255,255,.08)" onmouseover="this.style.background='#243f6b'" onmouseout="this.style.background='${bg}'">
    <td class="sp-num" style="color:rgba(255,255,255,.7)">${c.id}</td>
    <td style="color:#fff;font-weight:600"><strong>${c.name || '—'}</strong></td>
    <td class="sp-num">${fmt(c.lira_tr)}</td>
    <td class="sp-num">${fmt(c.dollar)}</td>
    <td class="sp-num">${fmt(c.euro)}</td>
    <td class="sp-num">${fmt(c.dirham_ae)}</td>
    <td class="sp-num">${fmt(c.dinar_dz)}</td>
    <td class="sp-num">${fmt(c.pound_eg)}</td>
    <td class="sp-num">${fmt(c.shekel)}</td>
    <td class="sp-num">${fmt(c.dinar_jo)}</td>
    <td class="sp-num">${fmt(c.riyal_sa)}</td>
    <td class="sp-num">${fmt(c.dinar_tn)}</td>
    <td class="sp-num">${fmt(c.vodafone_cash)}</td>
    <td class="sp-num">${fmt(c.pound_ps)}</td>
    <td class="sp-num">${fmt(c.shekel_bank)}</td>
    <td class="sp-num">${fmt(c.shekel_tf)}</td>
    <td class="sp-num" style="background:rgba(253,224,71,.08)">${fmtTotal(c.total_profit)}</td>
  </tr>`; }).join('');

  document.getElementById('pps-showing').textContent = `يعرض ${offset+1}–${Math.min(offset+_ppsPerPage,total)} من ${total}`;
  const pg = document.getElementById('pps-pages');
  pg.innerHTML = '';
  const maxVisible = 7;
  let s = Math.max(1, _ppsPage-3), e = Math.min(pages, s+maxVisible-1);
  if (e-s < maxVisible-1) s = Math.max(1, e-maxVisible+1);
  for (let i=s; i<=e; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i===_ppsPage?' active':'');
    btn.textContent = i;
    btn.onclick = () => ppsRender(i);
    pg.appendChild(btn);
  }
  document.getElementById('pps-prev').disabled = _ppsPage <= 1;
  document.getElementById('pps-next').disabled = _ppsPage >= pages;
}

function ppsFilter(q) {
  const t = q.trim().toLowerCase();
  _ppsFiltered = !t ? [..._ppsAll] : _ppsAll.filter(c =>
    (c.name||'').toLowerCase().includes(t)
  );
  ppsRender(1);
}

function ppsSort(col) {
  if (_ppsSortCol === col) _ppsSortAsc = !_ppsSortAsc;
  else { _ppsSortCol = col; _ppsSortAsc = true; }
  document.querySelectorAll('.pps-sa').forEach(a => a.textContent = '↕');
  const el = document.getElementById('pps-sa-' + col); if (el) el.textContent = _ppsSortAsc ? '↑' : '↓';
  _ppsFiltered.sort((a, b) => {
    const va = a[col] ?? 0, vb = b[col] ?? 0;
    if (typeof va === 'string') return _ppsSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _ppsSortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  ppsRender();
}

function ppsExportCSV() {
  if (!_ppsFiltered.length) { alToast('لا توجد بيانات للتصدير','warning','⚠️'); return; }
  const headers = ['#','الاسم','ليرة تركية','دولار','يورو','درهم','دينار جزائري','جنيه مصر','شيكل','دينار أردني','ريال سعودي','دينار تونسي','فودافون','جنيه فلسطين','شيكل بنك','شيكل تالف','الربح الكلي'];
  const keys = ['id','name','lira_tr','dollar','euro','dirham_ae','dinar_dz','pound_eg','shekel','dinar_jo','riyal_sa','dinar_tn','vodafone_cash','pound_ps','shekel_bank','shekel_tf','total_profit'];
  const csv = [headers.join(','), ..._ppsFiltered.map(r => keys.map(k => `"${r[k]??''}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
  a.download = 'profit-per-safe.csv';
  a.click();
}

// ══ تقرير الأرصدة ══
let _brAll = [], _brFiltered = [], _brSortCol = 'id', _brSortAsc = true, _brPage = 1;
let _brCurrency = 'dollar';
const _brHiddenCols = new Set();

const BR_CUR_LABELS = {
  dollar:'دولار', euro:'يورو', lira_tr:'ليرة تركية', shekel:'شيكل',
  dinar_jo:'دينار أردني', riyal_sa:'ريال سعودي', pound_eg:'جنيه مصري', dirham_ae:'درهم اماراتي',
};

async function brLoad() {
  document.getElementById('br-tbody').innerHTML =
    '<tr><td colspan="7" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/cost-centers/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    _brAll = list; _brFiltered = [..._brAll];
    brRender(1);
  } catch {
    _brAll = []; _brFiltered = [];
    document.getElementById('br-tbody').innerHTML =
      '<tr><td colspan="7" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function brFilter(q) {
  const s = q.trim().toLowerCase();
  _brFiltered = s ? _brAll.filter(m =>
    (m.name||'').toLowerCase().includes(s) ||
    (m.city||'').toLowerCase().includes(s) ||
    String(m.id).includes(s)
  ) : [..._brAll];
  brRender(1);
}

function brSort(col) {
  if (_brSortCol === col) _brSortAsc = !_brSortAsc;
  else { _brSortCol = col; _brSortAsc = true; }
  document.querySelectorAll('.br-sa').forEach(e => e.textContent = '⇅');
  const arrow = document.getElementById('br-sa-' + col);
  if (arrow) arrow.textContent = _brSortAsc ? '▲' : '▼';
  _brFiltered.sort((a,b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (typeof va === 'number') return _brSortAsc ? va-vb : vb-va;
    return _brSortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
  brRender();
}

function brToggleCol(col) {
  const btn = document.getElementById('br-col-' + col);
  if (_brHiddenCols.has(col)) {
    _brHiddenCols.delete(col);
    if (btn) btn.classList.remove('br-col-hidden');
  } else {
    _brHiddenCols.add(col);
    if (btn) btn.classList.add('br-col-hidden');
  }
  brRender();
}
function _brColVis(col) { return !_brHiddenCols.has(col); }

function brChangeCurrency() {
  _brCurrency = document.getElementById('br-currency').value;
  const lbl = BR_CUR_LABELS[_brCurrency] || _brCurrency;
  ['br-th-us','br-th-them'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (i===0 ? lbl+' لنا' : lbl+' علينا');
  });
  ['br-col-us','br-col-them'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (i===0 ? lbl+' لنا' : lbl+' علينا');
  });
  brRender();
}

function brRender(p) {
  if (p !== undefined) _brPage = p;
  const total   = _brFiltered.length;
  const perPage = parseInt(document.getElementById('br-per-page')?.value) || 10;
  const start   = (_brPage - 1) * perPage;
  const page    = _brFiltered.slice(start, start + perPage);

  const fmt = n => {
    const v = parseFloat(n) || 0;
    return v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  };

  const colMap = {id:'brh-id', city:'brh-city', name:'brh-name', cur:'brh-cur', us:'brh-us', them:'brh-them', debt:'brh-debt'};
  Object.entries(colMap).forEach(([k,hid]) => {
    const h = document.getElementById(hid);
    if (h) h.style.display = _brColVis(k) ? '' : 'none';
  });

  if (!total) {
    document.getElementById('br-tbody').innerHTML =
      '<tr><td colspan="7" class="sp-empty">لا توجد بيانات</td></tr>';
    document.getElementById('br-showing').textContent = '—';
    document.getElementById('br-pages').innerHTML = '';
    return;
  }

  const cur = _brCurrency;
  document.getElementById('br-tbody').innerHTML = page.map(m => {
    const usVal   = parseFloat(m[cur] || 0);
    const themVal = 0;
    const debtVal = usVal < 0 ? Math.abs(usVal) : 0;
    const isDebt  = usVal < 0;
    const usColor   = usVal >= 0 ? '#16A34A' : '#DC2626';
    const debtColor = isDebt ? '#DC2626' : '#94A3B8';
    return `<tr>
      ${_brColVis('id')   ? `<td style="color:#94A3B8;font-size:11px">${m.id}</td>` : ''}
      ${_brColVis('city') ? `<td style="color:#475569">${m.city||'—'}</td>` : ''}
      ${_brColVis('name') ? `<td style="color:#0F172A;font-weight:700">${m.name||'—'}</td>` : ''}
      ${_brColVis('cur')  ? `<td><span style="display:inline-block;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${BR_CUR_LABELS[cur]||cur}</span></td>` : ''}
      ${_brColVis('us')   ? `<td style="color:${usColor};font-weight:700;font-variant-numeric:tabular-nums">${fmt(usVal)}</td>` : ''}
      ${_brColVis('them') ? `<td style="color:#DC2626;font-weight:600;font-variant-numeric:tabular-nums">${fmt(themVal)}</td>` : ''}
      ${_brColVis('debt') ? `<td style="color:${debtColor};font-weight:${isDebt?'700':'400'};font-variant-numeric:tabular-nums">${isDebt?fmt(debtVal):'—'}</td>` : ''}
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('br-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const totalPages = Math.ceil(total / perPage);
  const pagesDiv = document.getElementById('br-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i===_brPage?' active':'');
    btn.textContent = i;
    btn.onclick = () => brRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('br-prev').disabled = _brPage <= 1;
  document.getElementById('br-next').disabled = _brPage >= totalPages;
}

function brCopyTable() {
  const rows = [...document.querySelectorAll('#br-tbody tr')];
  const text = rows.map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()).join('\t')).join('\n');
  navigator.clipboard.writeText(text).then(() => alToast('تم النسخ إلى الحافظة','success','✅'));
}

function brExportCSV() {
  if (!_brFiltered.length) { alToast('لا توجد بيانات','warning','⚠️'); return; }
  const cur = _brCurrency;
  const headers = ['#','المدينة','الاسم','العملة',`${BR_CUR_LABELS[cur]} لنا`,`${BR_CUR_LABELS[cur]} علينا`,'المديونية'];
  const csv = [headers.join(','), ..._brFiltered.map(m => {
    const us = parseFloat(m[cur]||0);
    return [m.id, m.city||'', m.name||'', BR_CUR_LABELS[cur]||cur, us.toFixed(2), '0.00', us<0?Math.abs(us).toFixed(2):'0.00'].map(v=>`"${v}"`).join(',');
  })].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
  a.download = 'balance-report.csv';
  a.click();
}

// ══ مراكز القطع ══
let _cutAll = [], _cutFiltered = [], _cutSortCol = 'id', _cutSortAsc = true, _cutPage = 1;
let _cutShowFilter = false;

async function cutLoad() {
  document.getElementById('cut-tbody').innerHTML =
    '<tr><td colspan="6" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  document.getElementById('cut-ops-tbody').innerHTML =
    '<tr><td colspan="7" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/cut-centers/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || d.data || []);
    _cutAll = list; _cutFiltered = [..._cutAll];
    cutRender(1);
    cutLoadOps();
  } catch {
    _cutAll = []; _cutFiltered = [];
    document.getElementById('cut-tbody').innerHTML =
      '<tr><td colspan="6" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

async function cutLoadOps() {
  try {
    const r = await fetch('/api/cut-centers/operations/', {credentials:'include'});
    const d = await r.json();
    const ops = Array.isArray(d) ? d : (d.results || d.operations || []);
    const fmt = n => Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    if (!ops.length) {
      document.getElementById('cut-ops-tbody').innerHTML =
        '<tr><td colspan="7" class="sp-empty">لا توجد عمليات</td></tr>';
      return;
    }
    document.getElementById('cut-ops-tbody').innerHTML = ops.map(op => `<tr>
      <td style="color:#94A3B8;font-size:11px">${op.id||'—'}</td>
      <td style="color:#475569">${op.date||'—'}</td>
      <td style="color:#16A34A;font-weight:700;font-variant-numeric:tabular-nums">${fmt(op.us||op.lna||0)}</td>
      <td style="color:#DC2626;font-weight:700;font-variant-numeric:tabular-nums">${fmt(op.them||op.alayna||0)}</td>
      <td style="color:#0F172A;font-weight:600">${op.client||op.customer||'—'}</td>
      <td style="color:${parseFloat(op.profit||0)>=0?'#16A34A':'#DC2626'};font-weight:700;font-variant-numeric:tabular-nums">${fmt(op.profit||0)}</td>
      <td style="color:#64748B;font-size:11px">${op.notes||op.note||'—'}</td>
    </tr>`).join('');
  } catch {
    document.getElementById('cut-ops-tbody').innerHTML =
      '<tr><td colspan="7" class="sp-empty">⚠️ فشل تحميل العمليات</td></tr>';
  }
}

function cutFilter(q) {
  const s = q.trim().toLowerCase();
  _cutFiltered = s ? _cutAll.filter(m =>
    (m.name||'').toLowerCase().includes(s) ||
    (m.currency||'').toLowerCase().includes(s) ||
    String(m.id).includes(s)
  ) : [..._cutAll];
  cutRender(1);
}

function cutSort(col) {
  if (_cutSortCol === col) _cutSortAsc = !_cutSortAsc;
  else { _cutSortCol = col; _cutSortAsc = true; }
  document.querySelectorAll('.cut-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('cut-sa-' + col);
  if (arrow) arrow.textContent = _cutSortAsc ? '▲' : '▼';
  _cutFiltered.sort((a,b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _cutSortAsc ? parseFloat(va)-parseFloat(vb) : parseFloat(vb)-parseFloat(va);
    return _cutSortAsc ? String(va).localeCompare(String(vb),'ar') : String(vb).localeCompare(String(va),'ar');
  });
  cutRender();
}

function cutToggleFilter() {
  _cutShowFilter = !_cutShowFilter;
  alToast(_cutShowFilter ? 'تم تفعيل التفصيل' : 'تم إلغاء التفصيل', 'info', '🔍');
}

function cutRender(p) {
  if (p !== undefined) _cutPage = p;
  const total   = _cutFiltered.length;
  const perPage = parseInt(document.getElementById('cut-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _cutPage = Math.min(Math.max(1, _cutPage), maxPage);
  const start = (_cutPage - 1) * perPage;
  const slice = _cutFiltered.slice(start, start + perPage);

  const fmt = n => Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  if (!total) {
    document.getElementById('cut-tbody').innerHTML =
      '<tr><td colspan="6" class="sp-empty">لا توجد بيانات</td></tr>';
    document.getElementById('cut-showing').textContent = '—';
    document.getElementById('cut-pages').innerHTML = '';
    return;
  }

  document.getElementById('cut-tbody').innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || m.profit_loss || 0);
    const pColor = profit >= 0 ? '#16A34A' : '#DC2626';
    return `<tr>
      <td style="color:#94A3B8;font-size:11px">${m.id}</td>
      <td style="color:#0F172A;font-weight:700">${m.name||'—'}</td>
      <td><span style="display:inline-block;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${m.currency||'—'}</span></td>
      <td style="color:#1D4ED8;font-weight:700;font-variant-numeric:tabular-nums">${fmt(m.dollar||m.amount||0)}</td>
      <td style="color:#475569;font-variant-numeric:tabular-nums">${fmt(m.cost||0)}</td>
      <td style="color:${pColor};font-weight:700;font-variant-numeric:tabular-nums">${fmt(profit)}</td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('cut-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('cut-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i===_cutPage?' active':'');
    btn.textContent = i;
    btn.onclick = () => cutRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('cut-prev').disabled = _cutPage <= 1;
  document.getElementById('cut-next').disabled = _cutPage >= maxPage;
}

function cutCopyTable() {
  const rows = [...document.querySelectorAll('#cut-tbody tr')];
  const text = rows.map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()).join('\t')).join('\n');
  navigator.clipboard.writeText(text).then(() => alToast('تم النسخ إلى الحافظة','success','✅'));
}

function cutExportCSV() {
  if (!_cutFiltered.length) { alToast('لا توجد بيانات','warning','⚠️'); return; }
  const headers = ['#','الاسم','العملة','دولار','الكلفة','ربح - خساره'];
  const csv = [headers.join(','), ..._cutFiltered.map(m => {
    const profit = parseFloat(m.profit || m.profit_loss || 0);
    return [m.id, m.name||'', m.currency||'', m.dollar||0, m.cost||0, profit].map(v=>`"${v}"`).join(',');
  })].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
  a.download = 'cut-centers.csv';
  a.click();
}

function cutExportExcel() { alToast('تصدير Excel — قيد الإنشاء','warning','⚠️'); }
function cutExportPDF()   { alToast('تصدير PDF — قيد الإنشاء','warning','⚠️'); }

// ══ ترحيل الأرباح ══
let _ptAll = [], _ptFiltered = [], _ptSortCol = 'name', _ptSortAsc = true, _ptPage = 1;

const PT_COLS = [
  {key:'dirham_ae',  label:'درهم اماراتي'},
  {key:'dinar_dz',   label:'دينار جزائري'},
  {key:'pound_eg',   label:'جنيه مصر'},
  {key:'pound_ps',   label:'جنيه فلسطين'},
  {key:'euro',       label:'يورو'},
  {key:'shekel',     label:'شيكل'},
  {key:'shekel_bank',label:'شيكل بنك'},
  {key:'shekel_tf',  label:'شيكل تالف'},
  {key:'dinar_jo',   label:'دينار أردني'},
  {key:'dinar_jo_cash', label:'دينار أردني كاش'},
  {key:'riyal_sa',   label:'ريال سعودي'},
  {key:'lira_tr',    label:'ليرة تركيه'},
  {key:'dinar_tn',   label:'دينار تونسي'},
  {key:'dollar',     label:'دولار'},
  {key:'dollar_bank',label:'دولار بنك'},
  {key:'dollar_cash',label:'دولار كاش'},
  {key:'usdt',       label:'يو اس USDT'},
  {key:'vodafone_cash', label:'فودافون'},
  {key:'gold_24',    label:'ذهب عيار 24'},
  {key:'gold_21',    label:'ذهب عيار 21'},
];

async function ptLoad() {
  document.getElementById('pt-tbody').innerHTML =
    `<tr><td colspan="21" class="sp-empty"><div class="sp-spinner"></div></td></tr>`;
  try {
    const r = await fetch('/api/profit-transfer/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || d.data || []);
    _ptAll = list; _ptFiltered = [..._ptAll];
    ptRender(1);
  } catch {
    _ptAll = []; _ptFiltered = [];
    document.getElementById('pt-tbody').innerHTML =
      `<tr><td colspan="21" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>`;
  }
}

function ptFilter(q) {
  const s = q.trim().toLowerCase();
  _ptFiltered = s
    ? _ptAll.filter(m => (m.name||'').toLowerCase().includes(s))
    : [..._ptAll];
  ptRender(1);
}

function ptSort(col) {
  if (_ptSortCol === col) _ptSortAsc = !_ptSortAsc;
  else { _ptSortCol = col; _ptSortAsc = true; }
  document.querySelectorAll('.pt-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('pt-sa-' + col);
  if (arrow) arrow.textContent = _ptSortAsc ? '▲' : '▼';
  _ptFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _ptSortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    return _ptSortAsc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
  });
  ptRender();
}

function ptRender(p) {
  if (p !== undefined) _ptPage = p;
  const total   = _ptFiltered.length;
  const perPage = parseInt(document.getElementById('pt-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _ptPage = Math.min(Math.max(1, _ptPage), maxPage);
  const start = (_ptPage - 1) * perPage;
  const slice = _ptFiltered.slice(start, start + perPage);

  const fmt = n => {
    const v = parseFloat(n) || 0;
    if (v === 0) return '<span class="pt-zero">—</span>';
    const cls = v > 0 ? 'pt-pos' : 'pt-neg';
    return `<span class="${cls}">${v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;
  };

  if (!total) {
    document.getElementById('pt-tbody').innerHTML =
      `<tr><td colspan="21" class="sp-empty">لا توجد بيانات</td></tr>`;
    document.getElementById('pt-showing').textContent = '—';
    document.getElementById('pt-pages').innerHTML = '';
    return;
  }

  document.getElementById('pt-tbody').innerHTML = slice.map(m => `<tr>
    <td>${m.name||'—'}</td>
    ${PT_COLS.map(c => `<td>${fmt(m[c.key])}</td>`).join('')}
  </tr>`).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('pt-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('pt-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _ptPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => ptRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('pt-prev').disabled = _ptPage <= 1;
  document.getElementById('pt-next').disabled = _ptPage >= maxPage;
}

function ptCopyTable() {
  const rows = [...document.querySelectorAll('#pt-tbody tr')];
  const text = rows.map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()).join('\t')).join('\n');
  navigator.clipboard.writeText(text).then(() => alToast('تم النسخ إلى الحافظة', 'success', '✅'));
}

function ptExportCSV() {
  if (!_ptFiltered.length) { alToast('لا توجد بيانات', 'warning', '⚠️'); return; }
  const headers = ['الاسم', ...PT_COLS.map(c => c.label)];
  const csv = [headers.join(','), ..._ptFiltered.map(m =>
    [m.name||'', ...PT_COLS.map(c => parseFloat(m[c.key]||0).toFixed(2))].map(v => `"${v}"`).join(',')
  )].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
  a.download = 'profit-transfer.csv';
  a.click();
}

// ══ كشف حساب ══
let _asData = [];

async function asInit() {
  // تعيين التواريخ الافتراضية (آخر 30 يوم)
  const today = new Date();
  const from  = new Date(today); from.setDate(from.getDate() - 30);
  const toStr   = today.toISOString().split('T')[0];
  const fromStr = from.toISOString().split('T')[0];
  const df = document.getElementById('as-date-from');
  const dt = document.getElementById('as-date-to');
  if (df && !df.value) df.value = fromStr;
  if (dt && !dt.value) dt.value = toStr;

  // تحميل قائمة العملاء والمراكز
  await Promise.all([asLoadClients(), asLoadCenters()]);
}

async function asLoadClients() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    const sel = document.getElementById('as-client');
    if (!sel) return;
    sel.innerHTML = '<option value="">— اختر العميل —</option>' +
      list.map(c => `<option value="${c.id}">${c.name||''}</option>`).join('');
  } catch {}
}

async function asLoadCenters() {
  try {
    const r = await fetch('/api/am/cost-center/', {credentials:'include'});
    const d = await r.json();
    const list = Array.isArray(d) ? d : (d.results || d.centers || []);
    const dl = document.getElementById('as-center-list');
    if (dl) dl.innerHTML = list.map(c => `<option value="${c.name||''}" data-id="${c.id}">`).join('');
  } catch {}
}

function asFilterCenter(val) { /* datalist handles filtering */ }

function asTimeRangeChange() {
  const range = document.getElementById('as-time-range').value;
  const row   = document.getElementById('as-date-row');
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];

  if (range === 'custom') {
    if (row) row.style.display = '';
    return;
  }
  if (row) row.style.display = 'none';

  const df = document.getElementById('as-date-from');
  const dt = document.getElementById('as-date-to');
  if (!df || !dt) return;

  dt.value = fmt(today);
  if (range === 'today') {
    df.value = fmt(today);
  } else if (range === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - d.getDay());
    df.value = fmt(d);
  } else if (range === 'month') {
    df.value = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
  } else if (range === 'year') {
    df.value = fmt(new Date(today.getFullYear(), 0, 1));
  } else if (range === 'all') {
    df.value = '2000-01-01';
  }
}

async function asLoadStatement() {
  const clientId    = document.getElementById('as-client')?.value || '';
  const currency    = document.getElementById('as-currency')?.value || 'dollar';
  const dateFrom    = document.getElementById('as-date-from')?.value || '';
  const dateTo      = document.getElementById('as-date-to')?.value || '';
  const inclUnsent  = document.getElementById('as-include-unsent')?.checked ? '1' : '0';

  if (!clientId) { alToast('الرجاء اختيار العميل', 'warning', '⚠️'); return; }

  const result = document.getElementById('as-result');
  const tbody  = document.getElementById('as-tbody');
  if (result) result.style.display = 'block';
  if (tbody)  tbody.innerHTML = '<tr><td colspan="8" class="sp-empty"><div class="sp-spinner"></div></td></tr>';

  const params = new URLSearchParams({
    center: clientId, currency, date_from: dateFrom, date_to: dateTo, include_unsent: inclUnsent
  });

  try {
    const r = await fetch(`/api/account-statement/?${params}`, {credentials:'include'});
    const d = await r.json();
    _asData = Array.isArray(d) ? d : (d.records || d.results || d.entries || d.data || []);
    asRenderTable();
  } catch {
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function asRenderTable() {
  const tbody = document.getElementById('as-tbody');
  if (!tbody) return;

  const fmt = n => Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  if (!_asData.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="sp-empty">لا توجد بيانات للفترة المحددة</td></tr>';
    document.getElementById('as-totals').innerHTML = '';
    return;
  }

  let totalDebit = 0, totalCredit = 0, balance = 0;

  tbody.innerHTML = _asData.map((row, i) => {
    const debit  = parseFloat(row.debit  || row.us   || 0);
    const credit = parseFloat(row.credit || row.them || 0);
    balance += debit - credit;
    totalDebit  += debit;
    totalCredit += credit;
    const balColor = balance >= 0 ? '#16A34A' : '#DC2626';
    return `<tr>
      <td style="color:#94A3B8;font-size:11px">${i+1}</td>
      <td style="color:#475569">${row.date||row.created_at||'—'}</td>
      <td><span style="display:inline-block;background:#F1F5F9;color:#475569;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${row.type||row.entry_type||'—'}</span></td>
      <td style="color:#1E293B;font-weight:600">${row.description||row.note||row.notes||'—'}</td>
      <td style="color:#16A34A;font-weight:700;font-variant-numeric:tabular-nums">${debit?fmt(debit):'—'}</td>
      <td style="color:#DC2626;font-weight:700;font-variant-numeric:tabular-nums">${credit?fmt(credit):'—'}</td>
      <td style="color:${balColor};font-weight:800;font-variant-numeric:tabular-nums">${fmt(Math.abs(balance))} ${balance<0?'(د)':''}</td>
      <td style="color:#64748B;font-size:11px">${row.remarks||row.memo||'—'}</td>
    </tr>`;
  }).join('');

  const totDiv = document.getElementById('as-totals');
  if (totDiv) {
    const balColor = balance >= 0 ? 'pos' : 'neg';
    totDiv.innerHTML = `
      <div class="as-total-item"><span class="as-total-lbl">إجمالي المدين:</span><span class="as-total-val pos">${fmt(totalDebit)}</span></div>
      <div class="as-total-item"><span class="as-total-lbl">إجمالي الدائن:</span><span class="as-total-val neg">${fmt(totalCredit)}</span></div>
      <div class="as-total-item"><span class="as-total-lbl">الرصيد النهائي:</span><span class="as-total-val ${balColor}">${fmt(Math.abs(balance))} ${balance<0?'(مدين)':'(دائن)'}</span></div>
    `;
  }
}

function asCopyTable() {
  const rows = [...document.querySelectorAll('#as-tbody tr')];
  const text = rows.map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()).join('\t')).join('\n');
  navigator.clipboard.writeText(text).then(() => alToast('تم النسخ إلى الحافظة','success','✅'));
}

function asExportCSV() {
  if (!_asData.length) { alToast('لا توجد بيانات','warning','⚠️'); return; }
  const headers = ['#','التاريخ','النوع','البيان','مدين','دائن','الرصيد','ملاحظات'];
  let balance = 0;
  const csv = [headers.join(','), ..._asData.map((row,i) => {
    const d = parseFloat(row.debit||row.us||0);
    const c = parseFloat(row.credit||row.them||0);
    balance += d - c;
    return [i+1, row.date||'', row.type||'', row.description||row.note||'',
      d.toFixed(2), c.toFixed(2), balance.toFixed(2), row.remarks||''].map(v=>`"${v}"`).join(',');
  })].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
  a.download = 'account-statement.csv';
  a.click();
}

// تحديث sfViewStatement و smViewStatement لفتح كشف الحساب مباشرة
function sfViewStatement(id, name) {
  openSubPanel('account-statement');
  setTimeout(() => {
    const sel = document.getElementById('as-client');
    if (sel) { sel.value = id; }
  }, 200);
}
function smViewStatement(id, name) {
  openSubPanel('account-statement');
  setTimeout(() => {
    const sel = document.getElementById('as-client');
    if (sel) { sel.value = id; }
  }, 200);
}

// ══ جميع القيود ══
let _enAll = [], _enFiltered = [], _enSortCol = 'id', _enSortAsc = false, _enPage = 1;

function enInit() {
  // تعيين تواريخ افتراضية (اليوم)
  const today = new Date().toISOString().split('T')[0];
  const df = document.getElementById('en-date-from');
  const dt = document.getElementById('en-date-to');
  if (df && !df.value) df.value = today;
  if (dt && !dt.value) dt.value = today;
}

async function enSearch() {
  const type     = document.getElementById('en-type')?.value || '';
  const dateFrom = document.getElementById('en-date-from')?.value || '';
  const dateTo   = document.getElementById('en-date-to')?.value || '';

  document.getElementById('en-tbody').innerHTML =
    '<tr><td colspan="10" class="sp-empty"><div class="sp-spinner"></div></td></tr>';

  const params = new URLSearchParams();
  if (type)     params.set('type', type);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo)   params.set('date_to', dateTo);

  try {
    const r = await fetch(`/api/all-entries/?${params}`, {credentials:'include'});
    const d = await r.json();
    _enAll = Array.isArray(d) ? d : (d.records || d.results || d.entries || d.data || []);
    _enFiltered = [..._enAll];
    enRender(1);
  } catch {
    _enAll = []; _enFiltered = [];
    document.getElementById('en-tbody').innerHTML =
      '<tr><td colspan="10" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function enFilter(q) {
  const s = q.trim().toLowerCase();
  _enFiltered = s ? _enAll.filter(m =>
    String(m.id||'').includes(s) ||
    (m.from||m.source||'').toLowerCase().includes(s) ||
    (m.to||m.destination||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    (m.notes||m.note||'').toLowerCase().includes(s) ||
    (m.type||'').toLowerCase().includes(s)
  ) : [..._enAll];
  enRender(1);
}

function enSort(col) {
  if (_enSortCol === col) _enSortAsc = !_enSortAsc;
  else { _enSortCol = col; _enSortAsc = true; }
  document.querySelectorAll('.en-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('en-sa-' + col);
  if (arrow) arrow.textContent = _enSortAsc ? '▲' : '▼';
  _enFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _enSortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    return _enSortAsc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
  });
  enRender();
}

function enRender(p) {
  if (p !== undefined) _enPage = p;
  const total   = _enFiltered.length;
  const perPage = parseInt(document.getElementById('en-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _enPage = Math.min(Math.max(1, _enPage), maxPage);
  const start = (_enPage - 1) * perPage;
  const slice = _enFiltered.slice(start, start + perPage);

  const fmt = n => {
    const v = parseFloat(n) || 0;
    return v ? v.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
  };

  const TYPE_LABELS = {
    transfer:'تحويل', exchange:'صرافة', receipt:'سند قبض',
    payment:'سند دفع', entry:'قيد يومية'
  };
  const TYPE_COLORS = {
    transfer:'#1D4ED8', exchange:'#0D9488', receipt:'#16A34A',
    payment:'#DC2626',  entry:'#7C3AED'
  };

  if (!total) {
    document.getElementById('en-tbody').innerHTML =
      '<tr><td colspan="10" class="sp-empty">لا توجد قيود للفترة المحددة</td></tr>';
    document.getElementById('en-showing').textContent = '—';
    document.getElementById('en-pages').innerHTML = '';
    return;
  }

  document.getElementById('en-tbody').innerHTML = slice.map(m => {
    const usVal     = parseFloat(m.us  || m.debit  || 0);
    const themVal   = parseFloat(m.them || m.credit || 0);
    const profit    = parseFloat(m.profit || 0);
    const pColor    = profit > 0 ? '#16A34A' : profit < 0 ? '#DC2626' : '#94A3B8';
    const typeKey   = m.type || '';
    const typeLabel = TYPE_LABELS[typeKey] || typeKey || '—';
    const typeColor = TYPE_COLORS[typeKey] || '#64748B';
    return `<tr>
      <td style="color:#94A3B8;font-size:11px">${m.id||'—'}</td>
      <td style="color:#475569">${m.date||m.created_at||'—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.from||m.source||'—'}</td>
      <td style="color:#16A34A;font-weight:700;font-variant-numeric:tabular-nums">${usVal?fmt(usVal):'—'}</td>
      <td style="color:#DC2626;font-weight:700;font-variant-numeric:tabular-nums">${themVal?fmt(themVal):'—'}</td>
      <td style="color:#1E293B;font-weight:600">${m.beneficiary||m.client||'—'}</td>
      <td style="color:#475569">${m.to||m.destination||'—'}</td>
      <td style="color:${pColor};font-weight:700;font-variant-numeric:tabular-nums">${profit?fmt(profit):'—'}</td>
      <td style="color:#64748B;font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis">${m.notes||m.note||'—'}</td>
      <td><span style="display:inline-block;background:${typeColor}18;color:${typeColor};border:1px solid ${typeColor}40;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap">${typeLabel}</span></td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('en-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('en-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _enPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => enRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('en-prev').disabled = _enPage <= 1;
  document.getElementById('en-next').disabled = _enPage >= maxPage;
}

function enCopyTable() {
  const rows = [...document.querySelectorAll('#en-tbody tr')];
  const text = rows.map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()).join('\t')).join('\n');
  navigator.clipboard.writeText(text).then(() => alToast('تم النسخ إلى الحافظة', 'success', '✅'));
}

function enExportExcel() { alToast('تصدير Excel — قيد الإنشاء', 'warning', '⚠️'); }

// ══ حركات خاسرة — lm* ══
let _lmAll = [], _lmFiltered = [], _lmSortCol = 'id', _lmSortAsc = true, _lmPage = 1;

function lmInit() {
  const today = new Date().toISOString().slice(0,10);
  const from  = document.getElementById('lm-date-from');
  const to    = document.getElementById('lm-date-to');
  if (from && !from.value) from.value = today;
  if (to   && !to.value)   to.value   = today;
}

async function lmSearch() {
  const from = document.getElementById('lm-date-from')?.value || '';
  const to   = document.getElementById('lm-date-to')?.value   || '';
  const tbody = document.getElementById('lm-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to });
    const r = await fetch(`/api/losing-moves/?${params}`, {credentials:'include'});
    const d = await r.json();
    _lmAll = Array.isArray(d) ? d : (d.results || d.data || []);
    _lmFiltered = [..._lmAll];
    document.getElementById('lm-search').value = '';
    lmRender(1);
  } catch {
    _lmAll = []; _lmFiltered = [];
    tbody.innerHTML = '<tr><td colspan="9" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function lmFilter(q) {
  const s = q.trim().toLowerCase();
  _lmFiltered = s ? _lmAll.filter(m =>
    (m.from||'').toLowerCase().includes(s) ||
    (m.to||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    (m.notes||'').toLowerCase().includes(s) ||
    String(m.id||'').includes(s)
  ) : [..._lmAll];
  lmRender(1);
}

function lmSort(col) {
  if (_lmSortCol === col) _lmSortAsc = !_lmSortAsc;
  else { _lmSortCol = col; _lmSortAsc = true; }
  document.querySelectorAll('.lm-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('lm-sa-' + col);
  if (arrow) arrow.textContent = _lmSortAsc ? '▲' : '▼';
  _lmFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _lmSortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    return _lmSortAsc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
  });
  lmRender();
}

function lmRender(p) {
  if (p !== undefined) _lmPage = p;
  const total   = _lmFiltered.length;
  const perPage = parseInt(document.getElementById('lm-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _lmPage       = Math.min(Math.max(1, _lmPage), maxPage);
  const start   = (_lmPage - 1) * perPage;
  const slice   = _lmFiltered.slice(start, start + perPage);

  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  if (!total) {
    document.getElementById('lm-tbody').innerHTML =
      '<tr><td colspan="9" class="sp-empty">لا توجد حركات خاسرة</td></tr>';
    document.getElementById('lm-showing').textContent = '—';
    document.getElementById('lm-pages').innerHTML = '';
    return;
  }

  document.getElementById('lm-tbody').innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || 0);
    const profitColor = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    return `<tr>
      <td style="color:#94A3B8;font-size:11px">${m.id||'—'}</td>
      <td style="color:#475569">${m.date||'—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.from||'—'}</td>
      <td style="font-variant-numeric:tabular-nums">${m.us != null ? fmt(m.us) : '—'}</td>
      <td style="font-variant-numeric:tabular-nums">${m.them != null ? fmt(m.them) : '—'}</td>
      <td style="color:#1D4ED8">${m.beneficiary||'—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.to||'—'}</td>
      <td style="color:${profitColor};font-weight:700;font-variant-numeric:tabular-nums">${profit ? fmt(profit) : '—'}</td>
      <td style="color:#64748B;font-size:11px">${m.notes||'—'}</td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('lm-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('lm-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _lmPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => lmRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('lm-prev').disabled = _lmPage <= 1;
  document.getElementById('lm-next').disabled = _lmPage >= maxPage;
}

function lmCopyTable() {
  const rows = [...document.querySelectorAll('#lm-tbody tr')];
  const text = rows.map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()).join('\t')).join('\n');
  navigator.clipboard.writeText(text).then(() => alToast('تم النسخ إلى الحافظة', 'success', '✅'));
}

function lmExportExcel() { alToast('تصدير Excel — قيد الإنشاء', 'warning', '⚠️'); }

// ══ جميع الحوالات — at* ══
let _atAll = [], _atFiltered = [], _atSortCol = 'id', _atSortAsc = true, _atPage = 1;

function atInit() {
  const today    = new Date().toISOString().slice(0,10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const from = document.getElementById('at-date-from');
  const to   = document.getElementById('at-date-to');
  if (from && !from.value) from.value = yesterday;
  if (to   && !to.value)   to.value   = today;
}

async function atSearch() {
  const from = document.getElementById('at-date-from')?.value || '';
  const to   = document.getElementById('at-date-to')?.value   || '';
  const tbody = document.getElementById('at-tbody');
  tbody.innerHTML = '<tr><td colspan="10" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to });
    const r = await fetch(`/api/all-transfers/?${params}`, {credentials:'include'});
    const d = await r.json();
    _atAll = Array.isArray(d) ? d : (d.results || d.data || []);
    _atFiltered = [..._atAll];
    document.getElementById('at-search').value = '';
    atRender(1);
  } catch {
    _atAll = []; _atFiltered = [];
    tbody.innerHTML = '<tr><td colspan="10" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function atFilter(q) {
  const s = q.trim().toLowerCase();
  _atFiltered = s ? _atAll.filter(m =>
    (m.from||'').toLowerCase().includes(s) ||
    (m.to||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    (m.notes||'').toLowerCase().includes(s) ||
    String(m.id||'').includes(s) ||
    String(m.transfer_num||'').includes(s)
  ) : [..._atAll];
  atRender(1);
}

function atSort(col) {
  if (_atSortCol === col) _atSortAsc = !_atSortAsc;
  else { _atSortCol = col; _atSortAsc = true; }
  document.querySelectorAll('.at-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('at-sa-' + col);
  if (arrow) arrow.textContent = _atSortAsc ? '▲' : '▼';
  _atFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _atSortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    return _atSortAsc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
  });
  atRender();
}

function atRender(p) {
  if (p !== undefined) _atPage = p;
  const total   = _atFiltered.length;
  const perPage = parseInt(document.getElementById('at-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _atPage       = Math.min(Math.max(1, _atPage), maxPage);
  const start   = (_atPage - 1) * perPage;
  const slice   = _atFiltered.slice(start, start + perPage);

  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  const STATUS = {
    pending:  {label:'قيد الانتظار', bg:'#FEF9C3', color:'#CA8A04', border:'#FDE047'},
    received: {label:'مستلمة',       bg:'#DCFCE7', color:'#16A34A', border:'#86EFAC'},
    rejected: {label:'مرفوضة',       bg:'#FEE2E2', color:'#DC2626', border:'#FCA5A5'},
    cancelled:{label:'ملغاة',        bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1'},
  };

  if (!total) {
    document.getElementById('at-tbody').innerHTML =
      '<tr><td colspan="10" class="sp-empty">لا توجد حوالات</td></tr>';
    document.getElementById('at-showing').textContent = '—';
    document.getElementById('at-pages').innerHTML = '';
    return;
  }

  document.getElementById('at-tbody').innerHTML = slice.map(m => {
    const st     = STATUS[m.status] || {label: m.status||'—', bg:'#F1F5F9', color:'#475569', border:'#CBD5E1'};
    const profit = parseFloat(m.profit || 0);
    const profitColor = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    return `<tr>
      <td style="font-variant-numeric:tabular-nums">${m.us != null ? fmt(m.us) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.from||'—'}</td>
      <td style="color:#1D4ED8">${m.beneficiary||'—'}</td>
      <td style="font-variant-numeric:tabular-nums">${m.them != null ? fmt(m.them) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.to||'—'}</td>
      <td style="color:${profitColor};font-weight:700;font-variant-numeric:tabular-nums">${profit ? fmt(profit) : '—'}</td>
      <td style="color:#475569">${m.transfer_date||'—'}</td>
      <td style="color:#475569">${m.receive_date||'—'}</td>
      <td style="color:#94A3B8;font-size:11px">${m.transfer_num||m.id||'—'}</td>
      <td><span class="at-badge" style="background:${st.bg};color:${st.color};border:1px solid ${st.border}">${st.label}</span></td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('at-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('at-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _atPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => atRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('at-prev').disabled = _atPage <= 1;
  document.getElementById('at-next').disabled = _atPage >= maxPage;
}

function atCopyTable() {
  const rows = [...document.querySelectorAll('#at-tbody tr')];
  const text = rows.map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()).join('\t')).join('\n');
  navigator.clipboard.writeText(text).then(() => alToast('تم النسخ إلى الحافظة', 'success', '✅'));
}

function atExportExcel() { alToast('تصدير Excel — قيد الإنشاء', 'warning', '⚠️'); }

// ══ الحوالات المستلمة — rt* ══
let _rtAll = [], _rtFiltered = [], _rtSortCol = 'us', _rtSortAsc = true, _rtPage = 1;

function rtInit() {
  const today     = new Date().toISOString().slice(0,10);
  const twoDaysAgo = new Date(Date.now() - 2*86400000).toISOString().slice(0,10);
  const from = document.getElementById('rt-date-from');
  const to   = document.getElementById('rt-date-to');
  if (from && !from.value) from.value = twoDaysAgo;
  if (to   && !to.value)   to.value   = today;
}

async function rtSearch() {
  const from  = document.getElementById('rt-date-from')?.value || '';
  const to    = document.getElementById('rt-date-to')?.value   || '';
  const tbody = document.getElementById('rt-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to, status: 'received' });
    const r = await fetch(`/api/all-transfers/?${params}`, {credentials:'include'});
    const d = await r.json();
    _rtAll = Array.isArray(d) ? d : (d.results || d.data || []);
    _rtFiltered = [..._rtAll];
    document.getElementById('rt-search').value = '';
    rtRender(1);
  } catch {
    _rtAll = []; _rtFiltered = [];
    tbody.innerHTML = '<tr><td colspan="11" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function rtFilter(q) {
  const s = q.trim().toLowerCase();
  _rtFiltered = s ? _rtAll.filter(m =>
    (m.from||'').toLowerCase().includes(s) ||
    (m.to||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    (m.notes||'').toLowerCase().includes(s) ||
    String(m.transfer_num||'').includes(s) ||
    String(m.id||'').includes(s)
  ) : [..._rtAll];
  rtRender(1);
}

function rtSort(col) {
  if (_rtSortCol === col) _rtSortAsc = !_rtSortAsc;
  else { _rtSortCol = col; _rtSortAsc = true; }
  document.querySelectorAll('.rt-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('rt-sa-' + col);
  if (arrow) arrow.textContent = _rtSortAsc ? '▲' : '▼';
  _rtFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _rtSortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    return _rtSortAsc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
  });
  rtRender();
}

function rtRender(p) {
  if (p !== undefined) _rtPage = p;
  const total   = _rtFiltered.length;
  const perPage = 25;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _rtPage       = Math.min(Math.max(1, _rtPage), maxPage);
  const start   = (_rtPage - 1) * perPage;
  const slice   = _rtFiltered.slice(start, start + perPage);

  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  if (!total) {
    document.getElementById('rt-tbody').innerHTML =
      '<tr><td colspan="11" class="sp-empty">لا توجد حوالات مستلمة</td></tr>';
    document.getElementById('rt-showing').textContent = '—';
    document.getElementById('rt-pages').innerHTML = '';
    return;
  }

  document.getElementById('rt-tbody').innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || 0);
    const profitColor = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    const card = m.card || m.id_card || m.national_id || '—';
    return `<tr>
      <td style="font-variant-numeric:tabular-nums">${m.us != null ? fmt(m.us) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.from||'—'}</td>
      <td style="color:#1D4ED8">${m.beneficiary||'—'}</td>
      <td style="font-variant-numeric:tabular-nums">${m.them != null ? fmt(m.them) : '—'}</td>
      <td style="color:#475569">${m.sender||'—'}</td>
      <td style="color:${profitColor};font-weight:700;font-variant-numeric:tabular-nums">${profit ? fmt(profit) : '—'}</td>
      <td style="color:#475569">${m.transfer_date||'—'}</td>
      <td style="color:#475569">${m.receive_date||'—'}</td>
      <td style="color:#94A3B8;font-size:11px">${m.transfer_num||m.id||'—'}</td>
      <td style="color:#64748B;font-size:11px">${m.notes||'—'}</td>
      <td style="color:#475569;font-size:11px">${card}</td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('rt-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('rt-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _rtPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => rtRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('rt-prev').disabled = _rtPage <= 1;
  document.getElementById('rt-next').disabled = _rtPage >= maxPage;
}

// ══ حوالات غير مستلمة — ut* ══
let _utAll = [], _utFiltered = [], _utSortCol = 'us', _utSortAsc = true, _utPage = 1;

function utInit() {
  const today      = new Date().toISOString().slice(0,10);
  const twoDaysAgo = new Date(Date.now() - 2*86400000).toISOString().slice(0,10);
  const from = document.getElementById('ut-date-from');
  const to   = document.getElementById('ut-date-to');
  if (from && !from.value) from.value = twoDaysAgo;
  if (to   && !to.value)   to.value   = today;
}

async function utSearch() {
  const from  = document.getElementById('ut-date-from')?.value || '';
  const to    = document.getElementById('ut-date-to')?.value   || '';
  const tbody = document.getElementById('ut-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to, status: 'pending' });
    const r = await fetch(`/api/all-transfers/?${params}`, {credentials:'include'});
    const d = await r.json();
    _utAll = Array.isArray(d) ? d : (d.results || d.data || []);
    _utFiltered = [..._utAll];
    document.getElementById('ut-search').value = '';
    utRender(1);
  } catch {
    _utAll = []; _utFiltered = [];
    tbody.innerHTML = '<tr><td colspan="11" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function utFilter(q) {
  const s = q.trim().toLowerCase();
  _utFiltered = s ? _utAll.filter(m =>
    (m.from||'').toLowerCase().includes(s) ||
    (m.to||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    (m.notes||'').toLowerCase().includes(s) ||
    String(m.transfer_num||'').includes(s) ||
    String(m.id||'').includes(s)
  ) : [..._utAll];
  utRender(1);
}

function utSort(col) {
  if (_utSortCol === col) _utSortAsc = !_utSortAsc;
  else { _utSortCol = col; _utSortAsc = true; }
  document.querySelectorAll('.ut-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('ut-sa-' + col);
  if (arrow) arrow.textContent = _utSortAsc ? '▲' : '▼';
  _utFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _utSortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    return _utSortAsc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
  });
  utRender();
}

function utRender(p) {
  if (p !== undefined) _utPage = p;
  const total   = _utFiltered.length;
  const perPage = 25;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _utPage       = Math.min(Math.max(1, _utPage), maxPage);
  const start   = (_utPage - 1) * perPage;
  const slice   = _utFiltered.slice(start, start + perPage);

  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  if (!total) {
    document.getElementById('ut-tbody').innerHTML =
      '<tr><td colspan="11" class="sp-empty">لا توجد حوالات غير مستلمة</td></tr>';
    document.getElementById('ut-showing').textContent = '—';
    document.getElementById('ut-pages').innerHTML = '';
    return;
  }

  document.getElementById('ut-tbody').innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || 0);
    const profitColor = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    const card = m.card || m.id_card || m.national_id || '—';
    return `<tr>
      <td style="font-variant-numeric:tabular-nums">${m.us != null ? fmt(m.us) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.from||'—'}</td>
      <td style="color:#1D4ED8">${m.beneficiary||'—'}</td>
      <td style="font-variant-numeric:tabular-nums">${m.them != null ? fmt(m.them) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.to||'—'}</td>
      <td style="color:${profitColor};font-weight:700;font-variant-numeric:tabular-nums">${profit ? fmt(profit) : '—'}</td>
      <td style="color:#475569">${m.transfer_date||'—'}</td>
      <td style="color:#475569">${m.receive_date||'—'}</td>
      <td style="color:#94A3B8;font-size:11px">${m.transfer_num||m.id||'—'}</td>
      <td style="color:#64748B;font-size:11px">${m.notes||'—'}</td>
      <td style="color:#475569;font-size:11px">${card}</td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('ut-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('ut-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _utPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => utRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('ut-prev').disabled = _utPage <= 1;
  document.getElementById('ut-next').disabled = _utPage >= maxPage;
}

// ══ الحوالات المحذوفة — dt* ══
let _dtAll = [], _dtFiltered = [], _dtSortCol = 'us', _dtSortAsc = true, _dtPage = 1;

function dtInit() {
  const today      = new Date().toISOString().slice(0,10);
  const twoDaysAgo = new Date(Date.now() - 2*86400000).toISOString().slice(0,10);
  const from = document.getElementById('dt-date-from');
  const to   = document.getElementById('dt-date-to');
  if (from && !from.value) from.value = twoDaysAgo;
  if (to   && !to.value)   to.value   = today;
}

async function dtSearch() {
  const from  = document.getElementById('dt-date-from')?.value || '';
  const to    = document.getElementById('dt-date-to')?.value   || '';
  const tbody = document.getElementById('dt-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to, deleted: 'true' });
    const r = await fetch(`/api/all-transfers/?${params}`, {credentials:'include'});
    const d = await r.json();
    _dtAll = Array.isArray(d) ? d : (d.results || d.data || []);
    _dtFiltered = [..._dtAll];
    document.getElementById('dt-search').value = '';
    dtRender(1);
  } catch {
    _dtAll = []; _dtFiltered = [];
    tbody.innerHTML = '<tr><td colspan="11" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function dtFilter(q) {
  const s = q.trim().toLowerCase();
  _dtFiltered = s ? _dtAll.filter(m =>
    (m.from||'').toLowerCase().includes(s) ||
    (m.to||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    (m.notes||'').toLowerCase().includes(s) ||
    String(m.transfer_num||'').includes(s) ||
    String(m.id||'').includes(s)
  ) : [..._dtAll];
  dtRender(1);
}

function dtSort(col) {
  if (_dtSortCol === col) _dtSortAsc = !_dtSortAsc;
  else { _dtSortCol = col; _dtSortAsc = true; }
  document.querySelectorAll('.dt-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('dt-sa-' + col);
  if (arrow) arrow.textContent = _dtSortAsc ? '▲' : '▼';
  _dtFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _dtSortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    return _dtSortAsc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
  });
  dtRender();
}

function dtRender(p) {
  if (p !== undefined) _dtPage = p;
  const total   = _dtFiltered.length;
  const perPage = 25;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _dtPage       = Math.min(Math.max(1, _dtPage), maxPage);
  const start   = (_dtPage - 1) * perPage;
  const slice   = _dtFiltered.slice(start, start + perPage);

  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  const STATUS = {
    pending:  {label:'قيد الانتظار', bg:'#FEF9C3', color:'#CA8A04', border:'#FDE047'},
    received: {label:'مستلمة',       bg:'#DCFCE7', color:'#16A34A', border:'#86EFAC'},
    deleted:  {label:'محذوفة',       bg:'#FEE2E2', color:'#DC2626', border:'#FCA5A5'},
    cancelled:{label:'ملغاة',        bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1'},
  };

  if (!total) {
    document.getElementById('dt-tbody').innerHTML =
      '<tr><td colspan="11" class="sp-empty">لا توجد حوالات محذوفة</td></tr>';
    document.getElementById('dt-showing').textContent = '—';
    document.getElementById('dt-pages').innerHTML = '';
    return;
  }

  document.getElementById('dt-tbody').innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || 0);
    const profitColor = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    const st = STATUS[m.status] || {label: m.status||'محذوفة', bg:'#FEE2E2', color:'#DC2626', border:'#FCA5A5'};
    return `<tr style="opacity:.85">
      <td style="font-variant-numeric:tabular-nums">${m.us != null ? fmt(m.us) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.from||'—'}</td>
      <td style="color:#1D4ED8">${m.beneficiary||'—'}</td>
      <td style="font-variant-numeric:tabular-nums">${m.them != null ? fmt(m.them) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.to||'—'}</td>
      <td style="color:${profitColor};font-weight:700;font-variant-numeric:tabular-nums">${profit ? fmt(profit) : '—'}</td>
      <td style="color:#475569">${m.transfer_date||'—'}</td>
      <td style="color:#475569">${m.receive_date||'—'}</td>
      <td style="color:#94A3B8;font-size:11px">${m.transfer_num||m.id||'—'}</td>
      <td style="color:#64748B;font-size:11px">${m.notes||'—'}</td>
      <td><span style="display:inline-block;background:${st.bg};color:${st.color};border:1px solid ${st.border};border-radius:5px;padding:2px 10px;font-size:11px;font-weight:700">${st.label}</span></td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('dt-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('dt-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _dtPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => dtRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('dt-prev').disabled = _dtPage <= 1;
  document.getElementById('dt-next').disabled = _dtPage >= maxPage;
}

// ══ حوالات متقدمة — adv* ══
let _advAll = [], _advFiltered = [], _advSortCol = 'us', _advSortAsc = true, _advPage = 1;

function advInit() {
  const today      = new Date().toISOString().slice(0,10);
  const yesterday  = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const from = document.getElementById('adv-date-from');
  const to   = document.getElementById('adv-date-to');
  if (from && !from.value) from.value = yesterday;
  if (to   && !to.value)   to.value   = today;
}

async function advSearch() {
  const from  = document.getElementById('adv-date-from')?.value || '';
  const to    = document.getElementById('adv-date-to')?.value   || '';
  const tbody = document.getElementById('adv-tbody');
  tbody.innerHTML = '<tr><td colspan="10" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to, advanced: 'true' });
    const r = await fetch(`/api/all-transfers/?${params}`, {credentials:'include'});
    const d = await r.json();
    _advAll = Array.isArray(d) ? d : (d.results || d.data || []);
    _advFiltered = [..._advAll];
    document.getElementById('adv-search').value = '';
    advRender(1);
  } catch {
    _advAll = []; _advFiltered = [];
    tbody.innerHTML = '<tr><td colspan="10" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function advFilter(q) {
  const s = q.trim().toLowerCase();
  _advFiltered = s ? _advAll.filter(m =>
    (m.from||'').toLowerCase().includes(s) ||
    (m.to||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    (m.notes||'').toLowerCase().includes(s) ||
    String(m.transfer_num||'').includes(s) ||
    String(m.id||'').includes(s)
  ) : [..._advAll];
  advRender(1);
}

function advSort(col) {
  if (_advSortCol === col) _advSortAsc = !_advSortAsc;
  else { _advSortCol = col; _advSortAsc = true; }
  document.querySelectorAll('.adv-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('adv-sa-' + col);
  if (arrow) arrow.textContent = _advSortAsc ? '▲' : '▼';
  _advFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _advSortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    return _advSortAsc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
  });
  advRender();
}

function advRender(p) {
  if (p !== undefined) _advPage = p;
  const total   = _advFiltered.length;
  const perPage = parseInt(document.getElementById('adv-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _advPage      = Math.min(Math.max(1, _advPage), maxPage);
  const start   = (_advPage - 1) * perPage;
  const slice   = _advFiltered.slice(start, start + perPage);

  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  const STATUS = {
    pending:  {label:'قيد الانتظار', bg:'#FEF9C3', color:'#CA8A04', border:'#FDE047'},
    received: {label:'مستلمة',       bg:'#DCFCE7', color:'#16A34A', border:'#86EFAC'},
    rejected: {label:'مرفوضة',       bg:'#FEE2E2', color:'#DC2626', border:'#FCA5A5'},
    cancelled:{label:'ملغاة',        bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1'},
    advanced: {label:'متقدمة',       bg:'#EDE9FE', color:'#6D28D9', border:'#C4B5FD'},
  };

  if (!total) {
    document.getElementById('adv-tbody').innerHTML =
      '<tr><td colspan="10" class="sp-empty">لا توجد حوالات متقدمة</td></tr>';
    document.getElementById('adv-showing').textContent = '—';
    document.getElementById('adv-pages').innerHTML = '';
    return;
  }

  document.getElementById('adv-tbody').innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || 0);
    const profitColor = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    const st = STATUS[m.status] || {label: m.status||'—', bg:'#EDE9FE', color:'#6D28D9', border:'#C4B5FD'};
    return `<tr>
      <td style="font-variant-numeric:tabular-nums">${m.us != null ? fmt(m.us) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.from||'—'}</td>
      <td style="color:#1D4ED8">${m.beneficiary||'—'}</td>
      <td style="font-variant-numeric:tabular-nums">${m.them != null ? fmt(m.them) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.to||'—'}</td>
      <td style="color:${profitColor};font-weight:700;font-variant-numeric:tabular-nums">${profit ? fmt(profit) : '—'}</td>
      <td style="color:#475569">${m.transfer_date||'—'}</td>
      <td style="color:#475569">${m.receive_date||'—'}</td>
      <td style="color:#94A3B8;font-size:11px">${m.transfer_num||m.id||'—'}</td>
      <td><span style="display:inline-block;background:${st.bg};color:${st.color};border:1px solid ${st.border};border-radius:5px;padding:2px 10px;font-size:11px;font-weight:700">${st.label}</span></td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('adv-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('adv-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _advPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => advRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('adv-prev').disabled = _advPage <= 1;
  document.getElementById('adv-next').disabled = _advPage >= maxPage;
}

// ══ الحوالات المحجوزة — rsv* ══
let _rsvAll = [], _rsvFiltered = [], _rsvSortCol = 'us', _rsvSortAsc = true, _rsvPage = 1;

function rsvInit() {
  const today    = new Date().toISOString().slice(0,10);
  const monthAgo = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  const from = document.getElementById('rsv-date-from');
  const to   = document.getElementById('rsv-date-to');
  if (from && !from.value) from.value = monthAgo;
  if (to   && !to.value)   to.value   = today;
}

async function rsvSearch() {
  const from  = document.getElementById('rsv-date-from')?.value || '';
  const to    = document.getElementById('rsv-date-to')?.value   || '';
  const tbody = document.getElementById('rsv-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to, status: 'reserved' });
    const r = await fetch(`/api/all-transfers/?${params}`, {credentials:'include'});
    const d = await r.json();
    _rsvAll = Array.isArray(d) ? d : (d.results || d.data || []);
    _rsvFiltered = [..._rsvAll];
    document.getElementById('rsv-search').value = '';
    rsvRender(1);
  } catch {
    _rsvAll = []; _rsvFiltered = [];
    tbody.innerHTML = '<tr><td colspan="9" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function rsvFilter(q) {
  const s = q.trim().toLowerCase();
  _rsvFiltered = s ? _rsvAll.filter(m =>
    (m.from||'').toLowerCase().includes(s) ||
    (m.to||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    String(m.transfer_num||'').includes(s) ||
    String(m.pin||'').includes(s) ||
    String(m.id||'').includes(s)
  ) : [..._rsvAll];
  rsvRender(1);
}

function rsvSort(col) {
  if (_rsvSortCol === col) _rsvSortAsc = !_rsvSortAsc;
  else { _rsvSortCol = col; _rsvSortAsc = true; }
  document.querySelectorAll('.rsv-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('rsv-sa-' + col);
  if (arrow) arrow.textContent = _rsvSortAsc ? '▲' : '▼';
  _rsvFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _rsvSortAsc ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    return _rsvSortAsc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
  });
  rsvRender();
}

function rsvRender(p) {
  if (p !== undefined) _rsvPage = p;
  const total   = _rsvFiltered.length;
  const perPage = parseInt(document.getElementById('rsv-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _rsvPage      = Math.min(Math.max(1, _rsvPage), maxPage);
  const start   = (_rsvPage - 1) * perPage;
  const slice   = _rsvFiltered.slice(start, start + perPage);

  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  const STATUS = {
    reserved: {label:'محجوزة',       bg:'#E0F2FE', color:'#0369A1', border:'#7DD3FC'},
    pending:  {label:'قيد الانتظار', bg:'#FEF9C3', color:'#CA8A04', border:'#FDE047'},
    received: {label:'مستلمة',       bg:'#DCFCE7', color:'#16A34A', border:'#86EFAC'},
    cancelled:{label:'ملغاة',        bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1'},
  };

  if (!total) {
    document.getElementById('rsv-tbody').innerHTML =
      '<tr><td colspan="9" class="sp-empty">لا توجد حوالات محجوزة</td></tr>';
    document.getElementById('rsv-showing').textContent = '—';
    document.getElementById('rsv-pages').innerHTML = '';
    return;
  }

  document.getElementById('rsv-tbody').innerHTML = slice.map(m => {
    const st  = STATUS[m.status] || {label: m.status||'—', bg:'#E0F2FE', color:'#0369A1', border:'#7DD3FC'};
    const pin = m.pin || m.secret || m.secret_num || '—';
    return `<tr>
      <td style="font-variant-numeric:tabular-nums">${m.us != null ? fmt(m.us) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.from||'—'}</td>
      <td style="color:#1D4ED8">${m.beneficiary||'—'}</td>
      <td style="font-variant-numeric:tabular-nums">${m.them != null ? fmt(m.them) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.to||'—'}</td>
      <td style="color:#475569">${m.transfer_date||'—'}</td>
      <td style="color:#94A3B8;font-size:11px">${m.transfer_num||m.id||'—'}</td>
      <td><span style="display:inline-block;background:${st.bg};color:${st.color};border:1px solid ${st.border};border-radius:5px;padding:2px 10px;font-size:11px;font-weight:700">${st.label}</span></td>
      <td class="rsv-pin">${pin}</td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('rsv-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('rsv-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _rsvPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => rsvRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('rsv-prev').disabled = _rsvPage <= 1;
  document.getElementById('rsv-next').disabled = _rsvPage >= maxPage;
}

// ══ حركات قيد التسليم — dlv* ══
const _DLV_BILL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="28" viewBox="0 0 38 28" fill="none">
  <rect x="1" y="1" width="36" height="26" rx="4" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
  <rect x="5" y="5" width="28" height="18" rx="2" fill="#E2E8F0"/>
  <circle cx="19" cy="14" r="5" fill="#CBD5E1"/>
  <rect x="1" y="10" width="4" height="8" rx="1" fill="#CBD5E1"/>
  <rect x="33" y="10" width="4" height="8" rx="1" fill="#CBD5E1"/>
</svg>`;

const DLV_CURRENCIES = [
  {key:'usd',   icon:'$',   svg:false, label:'دولار'},
  {key:'try',   icon:'₺',   svg:false, label:'ليرة تركيه'},
  {key:'jod',   icon:null,  svg:true,  label:'دينار اردني'},
  {key:'ils',   icon:null,  svg:true,  label:'شيكل'},
  {key:'eur',   icon:'€',   svg:false, label:'يورو'},
  {key:'egp',   icon:'£',   svg:false, label:'جنيه مصري'},
  {key:'sar',   icon:'﷼',   svg:false, label:'ريال سعودي'},
  {key:'vod',   icon:null,  svg:true,  label:'فودافون كاش'},
];

let _dlvIntAll = [], _dlvIntFiltered = [], _dlvIntSortCol = 'id', _dlvIntSortAsc = true, _dlvIntPage = 1;
let _dlvExtAll = [], _dlvExtFiltered = [], _dlvExtSortCol = 'id', _dlvExtSortAsc = true, _dlvExtPage = 1;

async function dlvLoad(type) {
  const suffix = type === 'internal' ? 'int' : 'ext';
  const cardsEl = document.getElementById(`dlv-${suffix}-cards`);
  const tbody   = document.getElementById(`dlv-${suffix}-tbody`);
  cardsEl.innerHTML = '<div class="sp-empty" style="padding:20px"><div class="sp-spinner"></div></div>';
  tbody.innerHTML   = `<tr><td colspan="9" class="sp-empty"><div class="sp-spinner"></div></td></tr>`;
  try {
    const r = await fetch(`/api/delivery-moves/?type=${type}`, {credentials:'include'});
    const d = await r.json();
    const rows = Array.isArray(d) ? d : (d.results || d.data || []);
    const summary = d.summary || {};
    if (type === 'internal') { _dlvIntAll = rows; _dlvIntFiltered = [...rows]; }
    else                     { _dlvExtAll = rows; _dlvExtFiltered = [...rows]; }
    dlvRenderCards(suffix, summary);
    dlvRender(type, 1);
  } catch {
    cardsEl.innerHTML = '';
    tbody.innerHTML   = `<tr><td colspan="9" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>`;
  }
}

function dlvRenderCards(suffix, summary) {
  const el = document.getElementById(`dlv-${suffix}-cards`);
  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0});
  const cards = DLV_CURRENCIES.map(c => {
    const val = parseFloat(summary[c.key] ?? 0);
    const cls = val < 0 ? 'neg' : val > 0 ? 'pos' : '';
    const iconHtml = c.svg
      ? `<div class="dlv-card-svg">${_DLV_BILL_SVG}</div>`
      : `<div class="dlv-card-sym">${c.icon}</div>`;
    return `<div class="dlv-card">
      ${iconHtml}
      <div class="dlv-card-amount ${cls}">${fmt(val)}</div>
      <div class="dlv-card-label ${val < 0 ? 'dlv-lbl-neg' : ''}">${c.label}</div>
    </div>`;
  });
  el.innerHTML = cards.join('') || '<div style="padding:12px;color:#94A3B8;font-size:13px">لا توجد أرصدة</div>';
}

function dlvFilter(type, q) {
  const s = q.trim().toLowerCase();
  if (type === 'internal') {
    _dlvIntFiltered = s ? _dlvIntAll.filter(m =>
      (m.from||'').toLowerCase().includes(s) || (m.to||'').toLowerCase().includes(s) ||
      (m.beneficiary||'').toLowerCase().includes(s) || String(m.id||'').includes(s)
    ) : [..._dlvIntAll];
    dlvRender('internal', 1);
  } else {
    _dlvExtFiltered = s ? _dlvExtAll.filter(m =>
      (m.from||'').toLowerCase().includes(s) || (m.to||'').toLowerCase().includes(s) ||
      (m.beneficiary||'').toLowerCase().includes(s) || String(m.id||'').includes(s)
    ) : [..._dlvExtAll];
    dlvRender('external', 1);
  }
}

function dlvSort(type, col) {
  const suffix = type === 'internal' ? 'int' : 'ext';
  if (type === 'internal') {
    if (_dlvIntSortCol === col) _dlvIntSortAsc = !_dlvIntSortAsc;
    else { _dlvIntSortCol = col; _dlvIntSortAsc = true; }
    document.querySelectorAll(`#sp-delivery-internal .dlv-sa`).forEach(e => e.textContent = '↕');
    const arrow = document.getElementById(`dlv-int-sa-${col}`);
    if (arrow) arrow.textContent = _dlvIntSortAsc ? '▲' : '▼';
    _dlvIntFiltered.sort((a,b) => {
      const va = a[col]??'', vb = b[col]??'';
      if (!isNaN(parseFloat(va))) return _dlvIntSortAsc ? parseFloat(va)-parseFloat(vb) : parseFloat(vb)-parseFloat(va);
      return _dlvIntSortAsc ? String(va).localeCompare(String(vb),'ar') : String(vb).localeCompare(String(va),'ar');
    });
  } else {
    if (_dlvExtSortCol === col) _dlvExtSortAsc = !_dlvExtSortAsc;
    else { _dlvExtSortCol = col; _dlvExtSortAsc = true; }
    document.querySelectorAll(`#sp-delivery-external .dlv-sa`).forEach(e => e.textContent = '↕');
    const arrow = document.getElementById(`dlv-ext-sa-${col}`);
    if (arrow) arrow.textContent = _dlvExtSortAsc ? '▲' : '▼';
    _dlvExtFiltered.sort((a,b) => {
      const va = a[col]??'', vb = b[col]??'';
      if (!isNaN(parseFloat(va))) return _dlvExtSortAsc ? parseFloat(va)-parseFloat(vb) : parseFloat(vb)-parseFloat(va);
      return _dlvExtSortAsc ? String(va).localeCompare(String(vb),'ar') : String(vb).localeCompare(String(va),'ar');
    });
  }
  dlvRender(type);
}

function dlvRender(type, p) {
  const suffix   = type === 'internal' ? 'int' : 'ext';
  const filtered = type === 'internal' ? _dlvIntFiltered : _dlvExtFiltered;
  let   page     = type === 'internal' ? _dlvIntPage     : _dlvExtPage;

  if (p !== undefined) page = p;
  const perPage = parseInt(document.getElementById(`dlv-${suffix}-per-page`)?.value) || 10;
  const total   = filtered.length;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  page = Math.min(Math.max(1, page), maxPage);
  if (type === 'internal') _dlvIntPage = page; else _dlvExtPage = page;
  const start = (page-1) * perPage;
  const slice = filtered.slice(start, start + perPage);
  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const tbody = document.getElementById(`dlv-${suffix}-tbody`);

  if (!total) {
    tbody.innerHTML = `<tr><td colspan="9" class="sp-empty">لا توجد حركات</td></tr>`;
    document.getElementById(`dlv-${suffix}-showing`).textContent = '—';
    document.getElementById(`dlv-${suffix}-pages`).innerHTML = '';
    return;
  }

  tbody.innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || 0);
    const profitColor = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    const col8 = type === 'external'
      ? `<td style="color:${profitColor};font-weight:700;font-variant-numeric:tabular-nums">${profit ? fmt(profit) : '—'}</td>`
      : `<td style="color:#475569">${m.sender||'—'}</td>`;
    return `<tr>
    <td style="color:#94A3B8;font-size:11px">${m.id||'—'}</td>
    <td style="color:#475569">${m.transfer_date||'—'}</td>
    <td style="font-variant-numeric:tabular-nums">${m.us != null ? fmt(m.us) : '—'}</td>
    <td style="color:#0F172A;font-weight:600">${m.from||'—'}</td>
    <td style="color:#1D4ED8">${m.beneficiary||'—'}</td>
    <td style="font-variant-numeric:tabular-nums">${m.them != null ? fmt(m.them) : '—'}</td>
    <td style="color:#0F172A;font-weight:600">${m.to||'—'}</td>
    ${col8}
    <td style="color:#64748B;font-size:11px">${m.notes||'—'}</td>
  </tr>`;
  }).join('');

  const end = Math.min(start+perPage, total);
  document.getElementById(`dlv-${suffix}-showing`).textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById(`dlv-${suffix}-pages`);
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === page ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => dlvRender(type, i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById(`dlv-${suffix}-prev`).disabled = page <= 1;
  document.getElementById(`dlv-${suffix}-next`).disabled = page >= maxPage;
}

function dlvCopy(type) {
  const suffix = type === 'internal' ? 'int' : 'ext';
  const rows = [...document.querySelectorAll(`#dlv-${suffix}-tbody tr`)];
  const text = rows.map(r => [...r.querySelectorAll('td')].map(c => c.textContent.trim()).join('\t')).join('\n');
  navigator.clipboard.writeText(text).then(() => alToast('تم النسخ إلى الحافظة', 'success', '✅'));
}

function dlvExcel(type) { alToast('تصدير Excel — قيد الإنشاء', 'warning', '⚠️'); }

function dlvNewMove(type) { alToast('إضافة حركة جديدة — قيد الإنشاء', 'info', 'ℹ️'); }

// ══ تم تسليمها — ded* ══
let _dedAll = [], _dedFiltered = [], _dedSortCol = 'us', _dedSortAsc = true, _dedPage = 1;

function deliveredInit() {
  const today      = new Date().toISOString().slice(0,10);
  const twoDaysAgo = new Date(Date.now() - 2*86400000).toISOString().slice(0,10);
  const from = document.getElementById('ded-date-from');
  const to   = document.getElementById('ded-date-to');
  if (from && !from.value) from.value = twoDaysAgo;
  if (to   && !to.value)   to.value   = today;
}

async function deliveredSearch() {
  const from  = document.getElementById('ded-date-from')?.value || '';
  const to    = document.getElementById('ded-date-to')?.value   || '';
  const tbody = document.getElementById('ded-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to, status: 'delivered' });
    const r = await fetch(`/api/all-transfers/?${params}`, {credentials:'include'});
    const d = await r.json();
    _dedAll = Array.isArray(d) ? d : (d.results || d.data || []);
    _dedFiltered = [..._dedAll];
    document.getElementById('ded-search').value = '';
    deliveredRender(1);
  } catch {
    _dedAll = []; _dedFiltered = [];
    tbody.innerHTML = '<tr><td colspan="11" class="sp-empty">⚠️ فشل تحميل البيانات</td></tr>';
  }
}

function deliveredFilter(q) {
  const s = q.trim().toLowerCase();
  _dedFiltered = s ? _dedAll.filter(m =>
    (m.from||'').toLowerCase().includes(s) ||
    (m.to||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    (m.sender||'').toLowerCase().includes(s) ||
    String(m.transfer_num||'').includes(s) ||
    String(m.id||'').includes(s)
  ) : [..._dedAll];
  deliveredRender(1);
}

function deliveredSort(col) {
  if (_dedSortCol === col) _dedSortAsc = !_dedSortAsc;
  else { _dedSortCol = col; _dedSortAsc = true; }
  document.querySelectorAll('.ded-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('ded-sa-' + col);
  if (arrow) arrow.textContent = _dedSortAsc ? '▲' : '▼';
  _dedFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _dedSortAsc ? parseFloat(va)-parseFloat(vb) : parseFloat(vb)-parseFloat(va);
    return _dedSortAsc ? String(va).localeCompare(String(vb),'ar') : String(vb).localeCompare(String(va),'ar');
  });
  deliveredRender();
}

function deliveredRender(p) {
  if (p !== undefined) _dedPage = p;
  const total   = _dedFiltered.length;
  const perPage = parseInt(document.getElementById('ded-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _dedPage      = Math.min(Math.max(1, _dedPage), maxPage);
  const start   = (_dedPage - 1) * perPage;
  const slice   = _dedFiltered.slice(start, start + perPage);
  const fmt     = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  if (!total) {
    document.getElementById('ded-tbody').innerHTML =
      '<tr><td colspan="11" class="sp-empty">لا توجد حوالات مسلّمة</td></tr>';
    document.getElementById('ded-showing').textContent = '—';
    document.getElementById('ded-pages').innerHTML = '';
    return;
  }

  document.getElementById('ded-tbody').innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || 0);
    const profitColor = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    const card = m.card || m.id_card || m.national_id || '—';
    return `<tr>
      <td style="font-variant-numeric:tabular-nums">${m.us != null ? fmt(m.us) : '—'}</td>
      <td style="color:#0F172A;font-weight:600">${m.from||'—'}</td>
      <td style="color:#1D4ED8">${m.beneficiary||'—'}</td>
      <td style="font-variant-numeric:tabular-nums">${m.them != null ? fmt(m.them) : '—'}</td>
      <td style="color:#475569">${m.sender||'—'}</td>
      <td style="color:${profitColor};font-weight:700;font-variant-numeric:tabular-nums">${profit ? fmt(profit) : '—'}</td>
      <td style="color:#475569">${m.transfer_date||'—'}</td>
      <td style="color:#475569">${m.receive_date||'—'}</td>
      <td style="color:#94A3B8;font-size:11px">${m.transfer_num||m.id||'—'}</td>
      <td style="color:#64748B;font-size:11px">${m.notes||'—'}</td>
      <td style="color:#475569;font-size:11px">${card}</td>
    </tr>`;
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('ded-showing').textContent = `يعرض ${start+1}–${end} من ${total}`;

  const pagesDiv = document.getElementById('ded-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _dedPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => deliveredRender(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('ded-prev').disabled = _dedPage <= 1;
  document.getElementById('ded-next').disabled = _dedPage >= maxPage;
}

// ══ القيود — jrn* ══
let _jrnAll = [], _jrnFiltered = [], _jrnSortCol = 'id', _jrnSortAsc = true, _jrnPage = 1;

const JRN_TYPES = {
  transfer: {label:'تحويل',    bg:'#EFF6FF', color:'#1D4ED8', border:'#BFDBFE'},
  exchange: {label:'صرافة',    bg:'#F0FDF4', color:'#16A34A', border:'#86EFAC'},
  receipt:  {label:'سند قبض', bg:'#ECFDF5', color:'#059669', border:'#6EE7B7'},
  payment:  {label:'سند دفع', bg:'#FEF9C3', color:'#CA8A04', border:'#FDE047'},
  journal:  {label:'قيد يومية',bg:'#F5F3FF', color:'#6D28D9', border:'#C4B5FD'},
  credit:   {label:'ائتمان',  bg:'#FFF7ED', color:'#EA580C', border:'#FDBA74'},
};

function jrnInit() {
  const today = new Date().toISOString().slice(0,10);
  const from  = document.getElementById('jrn-date-from');
  const to    = document.getElementById('jrn-date-to');
  if (from && !from.value) from.value = today;
  if (to   && !to.value)   to.value   = today;
}

async function jrnSearch() {
  const type = document.getElementById('jrn-type')?.value     || '';
  const from = document.getElementById('jrn-date-from')?.value || '';
  const to   = document.getElementById('jrn-date-to')?.value   || '';
  const tbody = document.getElementById('jrn-tbody');
  tbody.innerHTML = '<tr><td colspan="10" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ type, date_from: from, date_to: to });
    const r = await fetch('/api/all-entries/?' + params, {credentials:'include'});
    const d = await r.json();
    _jrnAll = Array.isArray(d) ? d : (d.results || d.data || []);
    _jrnFiltered = [..._jrnAll];
    document.getElementById('jrn-search').value = '';
    jrnRender(1);
  } catch {
    _jrnAll = []; _jrnFiltered = [];
    tbody.innerHTML = '<tr><td colspan="10" class="sp-empty">فشل تحميل البيانات</td></tr>';
  }
}

function jrnFilter(q) {
  const s = q.trim().toLowerCase();
  _jrnFiltered = s ? _jrnAll.filter(m =>
    (m.from||'').toLowerCase().includes(s) ||
    (m.to||'').toLowerCase().includes(s) ||
    (m.beneficiary||'').toLowerCase().includes(s) ||
    (m.notes||'').toLowerCase().includes(s) ||
    String(m.id||'').includes(s)
  ) : [..._jrnAll];
  jrnRender(1);
}

function jrnSort(col) {
  if (_jrnSortCol === col) _jrnSortAsc = !_jrnSortAsc;
  else { _jrnSortCol = col; _jrnSortAsc = true; }
  document.querySelectorAll('.jrn-sa').forEach(e => e.textContent = '↕');
  const arrow = document.getElementById('jrn-sa-' + col);
  if (arrow) arrow.textContent = _jrnSortAsc ? '▲' : '▼';
  _jrnFiltered.sort((a, b) => {
    const va = a[col] ?? '', vb = b[col] ?? '';
    if (!isNaN(parseFloat(va))) return _jrnSortAsc ? parseFloat(va)-parseFloat(vb) : parseFloat(vb)-parseFloat(va);
    return _jrnSortAsc ? String(va).localeCompare(String(vb),'ar') : String(vb).localeCompare(String(va),'ar');
  });
  jrnRender();
}

function jrnRender(p) {
  if (p !== undefined) _jrnPage = p;
  const total   = _jrnFiltered.length;
  const perPage = parseInt(document.getElementById('jrn-per-page')?.value) || 10;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _jrnPage      = Math.min(Math.max(1, _jrnPage), maxPage);
  const start   = (_jrnPage - 1) * perPage;
  const slice   = _jrnFiltered.slice(start, start + perPage);
  const fmt     = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

  if (!total) {
    document.getElementById('jrn-tbody').innerHTML =
      '<tr><td colspan="10" class="sp-empty">لا توجد قيود</td></tr>';
    document.getElementById('jrn-showing').textContent = '—';
    document.getElementById('jrn-pages').innerHTML = '';
    return;
  }

  document.getElementById('jrn-tbody').innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || 0);
    const profitColor = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    const tp = JRN_TYPES[m.type] || {label: m.type||'—', bg:'#F1F5F9', color:'#475569', border:'#CBD5E1'};
    return '<tr>' +
      '<td style="color:#94A3B8;font-size:11px">' + (m.id||'—') + '</td>' +
      '<td style="color:#475569">' + (m.transfer_date||m.date||'—') + '</td>' +
      '<td style="font-variant-numeric:tabular-nums">' + (m.us != null ? fmt(m.us) : '—') + '</td>' +
      '<td style="color:#0F172A;font-weight:600">' + (m.from||'—') + '</td>' +
      '<td style="color:#1D4ED8">' + (m.beneficiary||'—') + '</td>' +
      '<td style="font-variant-numeric:tabular-nums">' + (m.them != null ? fmt(m.them) : '—') + '</td>' +
      '<td style="color:#0F172A;font-weight:600">' + (m.to||'—') + '</td>' +
      '<td style="color:' + profitColor + ';font-weight:700;font-variant-numeric:tabular-nums">' + (profit ? fmt(profit) : '—') + '</td>' +
      '<td style="color:#64748B;font-size:11px">' + (m.notes||'—') + '</td>' +
      '<td><span style="display:inline-block;background:' + tp.bg + ';color:' + tp.color + ';border:1px solid ' + tp.border + ';border-radius:5px;padding:2px 10px;font-size:11px;font-weight:700">' + tp.label + '</span></td>' +
      '</tr>';
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('jrn-showing').textContent = 'يعرض ' + (start+1) + '-' + end + ' من ' + total;

  const pagesDiv = document.getElementById('jrn-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _jrnPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = (function(pg){ return function(){ jrnRender(pg); }; })(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('jrn-prev').disabled = _jrnPage <= 1;
  document.getElementById('jrn-next').disabled = _jrnPage >= maxPage;
}

function jrnCopy() {
  const rows = [...document.querySelectorAll('#jrn-tbody tr')];
  const text = rows.map(function(r){ return [...r.querySelectorAll('td')].map(function(c){ return c.textContent.trim(); }).join('\t'); }).join('\n');
  navigator.clipboard.writeText(text).then(function(){ alToast('تم النسخ إلى الحافظة', 'success', '✅'); });
}

function jrnExcel() { alToast('تصدير Excel - قيد الإنشاء', 'warning', '⚠️'); }

// ══ اعتمادات داخلية / خارجية — cr* ══
let _crIntAll = [], _crIntFiltered = [], _crIntSortCol = 'id', _crIntSortAsc = true, _crIntPage = 1;
let _crExtAll = [], _crExtFiltered = [], _crExtSortCol = 'id', _crExtSortAsc = true, _crExtPage = 1;

const CR_STATUS = {
  pending:   {label:'قيد الانتظار', bg:'#FEF9C3', color:'#CA8A04', border:'#FDE047'},
  active:    {label:'نشط',          bg:'#DCFCE7', color:'#16A34A', border:'#86EFAC'},
  completed: {label:'مكتمل',        bg:'#EFF6FF', color:'#1D4ED8', border:'#BFDBFE'},
  cancelled: {label:'ملغى',         bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1'},
  rejected:  {label:'مرفوض',        bg:'#FEE2E2', color:'#DC2626', border:'#FCA5A5'},
};

function crInit(type) {
  const today     = new Date().toISOString().slice(0,10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const px = type === 'internal' ? 'int' : 'ext';
  const from = document.getElementById('cr-' + px + '-date-from');
  const to   = document.getElementById('cr-' + px + '-date-to');
  if (from && !from.value) from.value = yesterday;
  if (to   && !to.value)   to.value   = today;
}

async function crSearch(type) {
  const px    = type === 'internal' ? 'int' : 'ext';
  const from  = document.getElementById('cr-' + px + '-date-from')?.value || '';
  const to    = document.getElementById('cr-' + px + '-date-to')?.value   || '';
  const tbody = document.getElementById('cr-' + px + '-tbody');
  tbody.innerHTML = '<tr><td colspan="11" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const params = new URLSearchParams({ type: type, date_from: from, date_to: to });
    const r = await fetch('/api/credits/?' + params, {credentials:'include'});
    const d = await r.json();
    const rows = Array.isArray(d) ? d : (d.results || d.data || []);
    if (type === 'internal') { _crIntAll = rows; _crIntFiltered = [...rows]; }
    else                     { _crExtAll = rows; _crExtFiltered = [...rows]; }
    document.getElementById('cr-' + px + '-search').value = '';
    crRender(type, 1);
  } catch {
    if (type === 'internal') { _crIntAll = []; _crIntFiltered = []; }
    else                     { _crExtAll = []; _crExtFiltered = []; }
    tbody.innerHTML = '<tr><td colspan="11" class="sp-empty">فشل تحميل البيانات</td></tr>';
  }
}

function crFilter(type, q) {
  const s  = q.trim().toLowerCase();
  const px = type === 'internal' ? 'int' : 'ext';
  const all = type === 'internal' ? _crIntAll : _crExtAll;
  const filtered = s ? all.filter(function(m) {
    return (m.from||'').toLowerCase().includes(s) ||
           (m.to||'').toLowerCase().includes(s) ||
           String(m.credit_num||'').includes(s) ||
           String(m.id||'').includes(s);
  }) : [...all];
  if (type === 'internal') _crIntFiltered = filtered;
  else                     _crExtFiltered = filtered;
  crRender(type, 1);
}

function crSort(type, col) {
  const px = type === 'internal' ? 'int' : 'ext';
  if (type === 'internal') {
    if (_crIntSortCol === col) _crIntSortAsc = !_crIntSortAsc;
    else { _crIntSortCol = col; _crIntSortAsc = true; }
  } else {
    if (_crExtSortCol === col) _crExtSortAsc = !_crExtSortAsc;
    else { _crExtSortCol = col; _crExtSortAsc = true; }
  }
  const asc = type === 'internal' ? _crIntSortAsc : _crExtSortAsc;
  document.querySelectorAll('#sp-' + type + '-credit .cr-sa').forEach(function(e){ e.textContent = '↕'; });
  const arrow = document.getElementById('cr-' + px + '-sa-' + col);
  if (arrow) arrow.textContent = asc ? '▲' : '▼';
  const arr = type === 'internal' ? _crIntFiltered : _crExtFiltered;
  arr.sort(function(a, b) {
    const va = a[col] != null ? a[col] : '', vb = b[col] != null ? b[col] : '';
    if (!isNaN(parseFloat(va))) return asc ? parseFloat(va)-parseFloat(vb) : parseFloat(vb)-parseFloat(va);
    return asc ? String(va).localeCompare(String(vb),'ar') : String(vb).localeCompare(String(va),'ar');
  });
  crRender(type);
}

function crRender(type, p) {
  const px       = type === 'internal' ? 'int' : 'ext';
  const filtered = type === 'internal' ? _crIntFiltered : _crExtFiltered;
  let   page     = type === 'internal' ? _crIntPage     : _crExtPage;
  if (p !== undefined) page = p;
  const perPage  = parseInt(document.getElementById('cr-' + px + '-per-page')?.value) || 10;
  const total    = filtered.length;
  const maxPage  = Math.max(1, Math.ceil(total / perPage));
  page = Math.min(Math.max(1, page), maxPage);
  if (type === 'internal') _crIntPage = page; else _crExtPage = page;
  const start  = (page-1) * perPage;
  const slice  = filtered.slice(start, start + perPage);
  const fmt    = function(n){ return Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); };
  const tbody  = document.getElementById('cr-' + px + '-tbody');

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="11" class="sp-empty">لا توجد اعتمادات</td></tr>';
    document.getElementById('cr-' + px + '-showing').textContent = '—';
    document.getElementById('cr-' + px + '-pages').innerHTML = '';
    return;
  }

  tbody.innerHTML = slice.map(function(m) {
    const profit = parseFloat(m.profit || 0);
    const pc = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    const st = CR_STATUS[m.status] || {label: m.status||'—', bg:'#F1F5F9', color:'#475569', border:'#CBD5E1'};
    return '<tr>' +
      '<td style="color:#94A3B8;font-size:11px">' + (m.id||'—') + '</td>' +
      '<td style="font-variant-numeric:tabular-nums">' + (m.us != null ? fmt(m.us) : '—') + '</td>' +
      '<td style="color:#0F172A;font-weight:600">' + (m.from||'—') + '</td>' +
      '<td style="font-variant-numeric:tabular-nums">' + (m.them != null ? fmt(m.them) : '—') + '</td>' +
      '<td style="color:#0F172A;font-weight:600">' + (m.to||'—') + '</td>' +
      '<td style="color:' + pc + ';font-weight:700;font-variant-numeric:tabular-nums">' + (profit ? fmt(profit) : '—') + '</td>' +
      '<td style="color:#475569">' + (m.transfer_date||'—') + '</td>' +
      '<td style="color:#475569">' + (m.receive_date||'—') + '</td>' +
      '<td style="color:#94A3B8;font-size:11px">' + (m.credit_num||m.ref_number||m.id||'—') + '</td>' +
      '<td><span style="display:inline-block;background:' + st.bg + ';color:' + st.color + ';border:1px solid ' + st.border + ';border-radius:5px;padding:2px 10px;font-size:11px;font-weight:700">' + st.label + '</span></td>' +
      '<td style="color:#64748B;font-size:11px">' + (m.notes||'—') + '</td>' +
      '</tr>';
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('cr-' + px + '-showing').textContent = 'يعرض ' + (start+1) + '-' + end + ' من ' + total;

  const pagesDiv = document.getElementById('cr-' + px + '-pages');
  pagesDiv.innerHTML = '';
  for (var i = 1; i <= maxPage; i++) {
    var btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === page ? ' active' : '');
    btn.textContent = i;
    (function(pg, t){ btn.onclick = function(){ crRender(t, pg); }; })(i, type);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('cr-' + px + '-prev').disabled = page <= 1;
  document.getElementById('cr-' + px + '-next').disabled = page >= maxPage;
}

// ══════════════════════════════════════════════════════════
// قيود محذوفة نهائياً — delEnt*
// ══════════════════════════════════════════════════════════
let _delEntData = [], _delEntFiltered = [], _delEntPage = 1;
let _delEntSort = { col: 'transfer_date', dir: -1 };

function delEntInit() {
  _delEntData = []; _delEntFiltered = []; _delEntPage = 1;
  delEntRender(1);
  delEntSearch();
}

async function delEntSearch() {
  const from = document.getElementById('de-date-from')?.value || '';
  const to   = document.getElementById('de-date-to')?.value   || '';
  const tbody = document.getElementById('de-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="sp-spinner">&#9696; جاري التحميل...</td></tr>';
  try {
    let url = '/api/all-entries/?deleted=true';
    if (from) url += '&date_from=' + from;
    if (to)   url += '&date_to='   + to;
    const r = await fetch(url, { credentials: 'include' });
    const d = await r.json();
    _delEntData     = d.data || d.entries || d.results || [];
    _delEntFiltered = [..._delEntData];
    _delEntPage     = 1;
    delEntRender(1);
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="9" class="sp-empty">تعذّر تحميل البيانات</td></tr>';
  }
}

function delEntFilter(q) {
  const s = (q || '').toLowerCase();
  _delEntFiltered = s
    ? _delEntData.filter(m =>
        String(m.from||'').toLowerCase().includes(s) ||
        String(m.to||'').toLowerCase().includes(s) ||
        String(m.beneficiary||'').toLowerCase().includes(s) ||
        String(m.notes||'').toLowerCase().includes(s) ||
        String(m.transfer_date||'').includes(s)
      )
    : [..._delEntData];
  _delEntPage = 1;
  delEntRender(1);
}

function delEntSort(col) {
  if (_delEntSort.col === col) _delEntSort.dir *= -1;
  else { _delEntSort.col = col; _delEntSort.dir = 1; }
  document.querySelectorAll('.de-sa').forEach(el => el.textContent = '↕');
  const sa = document.getElementById('de-sa-' + col);
  if (sa) sa.textContent = _delEntSort.dir === 1 ? '▲' : '▼';
  _delEntFiltered.sort((a, b) => {
    const av = a[col] ?? '', bv = b[col] ?? '';
    if (!isNaN(parseFloat(av)) && !isNaN(parseFloat(bv)))
      return (parseFloat(av) - parseFloat(bv)) * _delEntSort.dir;
    return String(av).localeCompare(String(bv), 'ar') * _delEntSort.dir;
  });
  delEntRender(1);
}

function delEntRender(p) {
  if (p !== undefined) _delEntPage = p;
  const perPage = parseInt(document.getElementById('de-per-page')?.value) || 10;
  const total   = _delEntFiltered.length;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _delEntPage   = Math.min(Math.max(1, _delEntPage), maxPage);
  const start   = (_delEntPage - 1) * perPage;
  const slice   = _delEntFiltered.slice(start, start + perPage);
  const fmt     = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const tbody   = document.getElementById('de-tbody');

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="9" class="sp-empty">لا توجد قيود محذوفة</td></tr>';
    document.getElementById('de-showing').textContent = '—';
    document.getElementById('de-pages').innerHTML = '';
    return;
  }

  tbody.innerHTML = slice.map(m => {
    const profit = parseFloat(m.profit || 0);
    const pc = profit < 0 ? '#DC2626' : profit > 0 ? '#16A34A' : '#94A3B8';
    return '<tr>' +
      '<td style="color:#94A3B8;font-size:11px">' + (m.id || '—') + '</td>' +
      '<td style="color:#475569">' + (m.transfer_date || '—') + '</td>' +
      '<td style="font-variant-numeric:tabular-nums">' + (m.us != null ? fmt(m.us) : '—') + '</td>' +
      '<td style="color:#0F172A;font-weight:600">' + (m.from || '—') + '</td>' +
      '<td style="color:#0F172A;font-weight:600">' + (m.beneficiary || '—') + '</td>' +
      '<td style="font-variant-numeric:tabular-nums">' + (m.them != null ? fmt(m.them) : '—') + '</td>' +
      '<td style="color:#0F172A;font-weight:600">' + (m.to || '—') + '</td>' +
      '<td style="color:' + pc + ';font-weight:700;font-variant-numeric:tabular-nums">' + (profit ? fmt(profit) : '—') + '</td>' +
      '<td style="color:#64748B;font-size:11px">' + (m.notes || '—') + '</td>' +
      '</tr>';
  }).join('');

  const end = Math.min(start + perPage, total);
  document.getElementById('de-showing').textContent = 'يعرض ' + (start+1) + '-' + end + ' من ' + total;

  const pagesDiv = document.getElementById('de-pages');
  pagesDiv.innerHTML = '';
  for (let i = 1; i <= maxPage; i++) {
    const btn = document.createElement('button');
    btn.className = 'sp-page-btn' + (i === _delEntPage ? ' active' : '');
    btn.textContent = i;
    (function(pg){ btn.onclick = () => delEntRender(pg); })(i);
    pagesDiv.appendChild(btn);
  }
  document.getElementById('de-prev').disabled = _delEntPage <= 1;
  document.getElementById('de-next').disabled = _delEntPage >= maxPage;
}

function delEntCopy() {
  const rows = _delEntFiltered.map(m =>
    [m.id, m.transfer_date, m.us, m.from, m.beneficiary, m.them, m.to, m.profit, m.notes].join('\t')
  );
  navigator.clipboard.writeText(rows.join('\n'))
    .then(() => alToast('تم النسخ إلى الحافظة', 'success', '✓'))
    .catch(() => alToast('فشل النسخ', 'error', '✗'));
}

function delEntExcel() { alToast('تصدير Excel - قيد الإنشاء', 'warning', '⚠️'); }

// ══════════════════════════════════════════════════════════
// تعديل الباقات — pkg*
// القوالب تُخزَّن في localStorage كـ JSON
// ══════════════════════════════════════════════════════════

const PKG_STORAGE_KEY = 'entr_user_tpls';

const PKG_BUILT_IN = [
  { key:'hawala_usd', label:'حوالة دولار',  fromCur:'USD', toCur:'USD', cutVal:'1',   cutOp:'mul', builtIn:true },
  { key:'hawala_ils', label:'حوالة شيكل',  fromCur:'ILS', toCur:'ILS', cutVal:'1',   cutOp:'mul', builtIn:true },
  { key:'hawala_jod', label:'حوالة دينار', fromCur:'JOD', toCur:'JOD', cutVal:'1',   cutOp:'mul', builtIn:true },
  { key:'exchange',   label:'صرافة',        fromCur:'USD', toCur:'ILS', cutVal:'3.7', cutOp:'mul', builtIn:true },
  { key:'deposit',    label:'إيداع',        fromCur:'USD', toCur:'USD', cutVal:'1',   cutOp:'mul', builtIn:true },
  { key:'withdraw',   label:'سحب',          fromCur:'USD', toCur:'USD', cutVal:'1',   cutOp:'mul', builtIn:true },
];

const PKG_OP_LABELS  = { mul: 'ضرب ×', div: 'قسمة ÷', add: 'جمع +', sub: 'طرح −' };
const PKG_CURRENCIES = ['USD','ILS','JOD','EUR','GBP','SAR','AED','TRY','SYP','EGP'];

let _pkgUserTpls  = [];
let _pkgFiltered  = [];
let _pkgSearch    = '';
let _pkgEditIdx   = null;   // null = إضافة جديدة، رقم = تعديل موجود

function pkgInit() {
  _pkgUserTpls = JSON.parse(localStorage.getItem(PKG_STORAGE_KEY) || '[]');
  _pkgSearch   = '';
  const inp = document.getElementById('pkg-search');
  if (inp) inp.value = '';
  pkgRender();
}

function pkgFilter(q) {
  _pkgSearch = (q || '').toLowerCase();
  pkgRender();
}

function pkgRender() {
  const all = [...PKG_BUILT_IN, ..._pkgUserTpls.map((t, i) => ({ ...t, _userIdx: i }))];
  _pkgFiltered = _pkgSearch
    ? all.filter(p => p.label.toLowerCase().includes(_pkgSearch) || (p.fromCur||'').toLowerCase().includes(_pkgSearch) || (p.toCur||'').toLowerCase().includes(_pkgSearch))
    : all;

  document.getElementById('pkg-count').textContent = _pkgFiltered.length;

  const tbody = document.getElementById('pkg-tbody');
  if (!_pkgFiltered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="sp-empty">لا توجد باقات</td></tr>';
    return;
  }

  tbody.innerHTML = _pkgFiltered.map((p, i) => {
    const typeBadge = p.builtIn
      ? '<span style="display:inline-block;background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE;border-radius:5px;padding:2px 9px;font-size:11px;font-weight:700">مدمج</span>'
      : '<span style="display:inline-block;background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0;border-radius:5px;padding:2px 9px;font-size:11px;font-weight:700">مخصص</span>';

    const opLabel = PKG_OP_LABELS[p.cutOp] || p.cutOp || '—';
    const actions = p.builtIn
      ? '<span style="color:#94A3B8;font-size:11px">للعرض فقط</span>'
      : `<button class="pkg-btn-edit" onclick="pkgOpenEdit(${p._userIdx})">✏️ تعديل</button>
         <button class="pkg-btn-del"  onclick="pkgDelete(${p._userIdx})">🗑 حذف</button>`;

    return `<tr>
      <td style="color:#94A3B8;font-size:11px">${i + 1}</td>
      <td style="font-weight:700;color:#1E293B">${p.label}</td>
      <td><span style="font-weight:600;color:#0369A1">${p.fromCur || '—'}</span> → <span style="font-weight:600;color:#0F766E">${p.toCur || '—'}</span></td>
      <td style="color:#475569;font-size:12px">${opLabel} ${p.cutVal || '1'}</td>
      <td>${typeBadge}</td>
      <td style="display:flex;gap:6px;align-items:center;justify-content:flex-end">${actions}</td>
    </tr>`;
  }).join('');
}

function pkgOpenAdd() {
  _pkgEditIdx = null;
  document.getElementById('pkg-modal-title').textContent = 'إضافة باقة جديدة';
  document.getElementById('pkg-f-label').value   = '';
  document.getElementById('pkg-f-from').value    = 'USD';
  document.getElementById('pkg-f-to').value      = 'USD';
  document.getElementById('pkg-f-cutval').value  = '1';
  document.getElementById('pkg-f-cutop').value   = 'mul';
  document.getElementById('pkg-f-fromfee').value = '';
  document.getElementById('pkg-f-tofee').value   = '';
  document.getElementById('pkg-modal').style.display = 'flex';
  document.getElementById('pkg-f-label').focus();
}

function pkgOpenEdit(userIdx) {
  _pkgEditIdx = userIdx;
  const t = _pkgUserTpls[userIdx];
  if (!t) return;
  document.getElementById('pkg-modal-title').textContent = 'تعديل الباقة';
  document.getElementById('pkg-f-label').value   = t.label   || '';
  document.getElementById('pkg-f-from').value    = t.fromCur || 'USD';
  document.getElementById('pkg-f-to').value      = t.toCur   || 'USD';
  document.getElementById('pkg-f-cutval').value  = t.cutVal  || '1';
  document.getElementById('pkg-f-cutop').value   = t.cutOp   || 'mul';
  document.getElementById('pkg-f-fromfee').value = t.fromFee || '';
  document.getElementById('pkg-f-tofee').value   = t.toFee   || '';
  document.getElementById('pkg-modal').style.display = 'flex';
  document.getElementById('pkg-f-label').focus();
}

function pkgCloseModal() {
  document.getElementById('pkg-modal').style.display = 'none';
  _pkgEditIdx = null;
}

function pkgSave() {
  const label   = (document.getElementById('pkg-f-label').value   || '').trim();
  const fromCur = (document.getElementById('pkg-f-from').value    || '').trim();
  const toCur   = (document.getElementById('pkg-f-to').value      || '').trim();
  const cutVal  = (document.getElementById('pkg-f-cutval').value  || '1').trim();
  const cutOp   = (document.getElementById('pkg-f-cutop').value   || 'mul');
  const fromFee = (document.getElementById('pkg-f-fromfee').value || '').trim();
  const toFee   = (document.getElementById('pkg-f-tofee').value   || '').trim();

  if (!label) { alToast('اسم الباقة مطلوب', 'error', '✗'); return; }

  const tpl = { label, fromCur, toCur, cutVal, cutOp, fromFee, toFee };

  _pkgUserTpls = JSON.parse(localStorage.getItem(PKG_STORAGE_KEY) || '[]');
  if (_pkgEditIdx !== null) {
    _pkgUserTpls[_pkgEditIdx] = tpl;
    alToast('تم تحديث الباقة بنجاح', 'success', '✓');
  } else {
    _pkgUserTpls.push(tpl);
    alToast('تم إضافة الباقة بنجاح', 'success', '✓');
  }
  localStorage.setItem(PKG_STORAGE_KEY, JSON.stringify(_pkgUserTpls));
  pkgCloseModal();
  pkgInit();
}

function pkgDelete(userIdx) {
  _pkgUserTpls = JSON.parse(localStorage.getItem(PKG_STORAGE_KEY) || '[]');
  const name = _pkgUserTpls[userIdx]?.label || 'الباقة';
  if (!confirm(`هل تريد حذف باقة "${name}" نهائياً؟`)) return;
  _pkgUserTpls.splice(userIdx, 1);
  localStorage.setItem(PKG_STORAGE_KEY, JSON.stringify(_pkgUserTpls));
  alToast('تم حذف الباقة', 'info', '🗑');
  pkgInit();
}

// ══════════════════════════════════════════════════════════
// أسعار القص — ctp*
// ══════════════════════════════════════════════════════════

const CTP_TYPE_LABELS = { screen:'سعر الشاشة', balance:'سعر قص الرصيد', movement:'سعر قص الحركات' };
const CTP_TYPE_COLORS = { screen:'#7C3AED', balance:'#0369A1', movement:'#0F766E' };
const CTP_DIR_LABELS  = { mul:'× ضرب', div:'÷ قسمة' };
const CTP_CURRENCIES  = ['USD','ILS','JOD','EUR','GBP','SAR','AED','TRY','SYP','EGP'];

let _ctpData     = { screen:[], balance:[], movement:[] };
let _ctpEditId   = null;
let _ctpActiveTab = 'screen';

async function ctpInit() {
  _ctpEditId = null;
  await ctpLoad();
}

async function ctpLoad() {
  document.querySelectorAll('.ctp-card-body').forEach(el => {
    el.innerHTML = '<div class="sp-spinner">&#9696; جاري التحميل...</div>';
  });
  try {
    const r = await fetch('/api/cut-prices/', { credentials: 'include' });
    const d = await r.json();
    if (!d.success) throw new Error(d.message || 'خطأ');
    _ctpData = d.grouped || { screen:[], balance:[], movement:[] };
    ctpRenderAll();
  } catch(e) {
    document.querySelectorAll('.ctp-card-body').forEach(el => {
      el.innerHTML = '<div class="sp-empty">تعذّر تحميل البيانات</div>';
    });
  }
}

function ctpRenderAll() {
  ['screen','balance','movement'].forEach(t => ctpRenderCard(t));
  document.getElementById('ctp-total').textContent =
    ((_ctpData.screen||[]).length + (_ctpData.balance||[]).length + (_ctpData.movement||[]).length);
}

function ctpRenderCard(type) {
  const tbody = document.getElementById('ctp-tbody-' + type);
  if (!tbody) return;
  const items = _ctpData[type] || [];
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="sp-empty">لا توجد أسعار — اضغط إضافة</td></tr>';
    document.getElementById('ctp-count-' + type).textContent = '0';
    return;
  }
  document.getElementById('ctp-count-' + type).textContent = items.length;
  const fmt = n => Number(n).toLocaleString('en-US', {minimumFractionDigits:4, maximumFractionDigits:6});
  tbody.innerHTML = items.map(p => {
    const activeBadge = p.isActive
      ? '<span style="background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700">نشط</span>'
      : '<span style="background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700">موقف</span>';
    return `<tr>
      <td style="font-weight:700;color:#0F172A;font-size:13px">${p.currency}</td>
      <td style="font-variant-numeric:tabular-nums;font-weight:700;color:#1A3D5C">${fmt(p.rate)}</td>
      <td style="color:#64748B;font-size:12px">${CTP_DIR_LABELS[p.direction]||p.direction}</td>
      <td>${activeBadge}</td>
      <td style="display:flex;gap:6px;justify-content:flex-end">
        <button class="ctp-btn-edit" onclick="ctpOpenEdit(${p.id})">✏️ تعديل</button>
        <button class="ctp-btn-del"  onclick="ctpDelete(${p.id},'${p.currency}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function ctpOpenAdd(defaultType) {
  _ctpEditId = null;
  document.getElementById('ctp-modal-title').textContent = 'إضافة سعر قص جديد';
  document.getElementById('ctp-f-type').value      = defaultType || _ctpActiveTab || 'screen';
  document.getElementById('ctp-f-currency').value  = 'ILS';
  document.getElementById('ctp-f-rate').value      = '';
  document.getElementById('ctp-f-direction').value = 'div';
  document.getElementById('ctp-f-active').checked  = true;
  document.getElementById('ctp-f-notes').value     = '';
  document.getElementById('ctp-modal').style.display = 'flex';
  document.getElementById('ctp-f-rate').focus();
}

function ctpOpenEdit(id) {
  const allItems = [...(_ctpData.screen||[]), ...(_ctpData.balance||[]), ...(_ctpData.movement||[])];
  const p = allItems.find(x => x.id === id);
  if (!p) return;
  _ctpEditId = id;
  document.getElementById('ctp-modal-title').textContent = 'تعديل سعر القص';
  document.getElementById('ctp-f-type').value      = p.priceType;
  document.getElementById('ctp-f-currency').value  = p.currency;
  document.getElementById('ctp-f-rate').value      = p.rate;
  document.getElementById('ctp-f-direction').value = p.direction;
  document.getElementById('ctp-f-active').checked  = p.isActive;
  document.getElementById('ctp-f-notes').value     = p.notes || '';
  document.getElementById('ctp-modal').style.display = 'flex';
  document.getElementById('ctp-f-rate').focus();
}

function ctpCloseModal() {
  document.getElementById('ctp-modal').style.display = 'none';
  _ctpEditId = null;
}

async function ctpSave() {
  const priceType = document.getElementById('ctp-f-type').value;
  const currency  = document.getElementById('ctp-f-currency').value;
  const rate      = parseFloat(document.getElementById('ctp-f-rate').value);
  const direction = document.getElementById('ctp-f-direction').value;
  const isActive  = document.getElementById('ctp-f-active').checked;
  const notes     = document.getElementById('ctp-f-notes').value.trim();

  if (!rate || rate <= 0) { alToast('السعر يجب أن يكون أكبر من الصفر', 'error', '✗'); return; }

  const body = { priceType, currency, rate, direction, isActive, notes };
  const url    = _ctpEditId ? `/api/cut-prices/${_ctpEditId}/` : '/api/cut-prices/';
  const method = _ctpEditId ? 'PATCH' : 'POST';

  try {
    const r = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrfToken() },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'حدث خطأ', 'error', '✗'); return; }
    alToast(d.message || 'تم الحفظ', 'success', '✓');
    ctpCloseModal();
    await ctpLoad();
  } catch { alToast('تعذّر الاتصال بالخادم', 'error', '✗'); }
}

async function ctpDelete(id, currency) {
  if (!confirm(`هل تريد حذف سعر ${currency} نهائياً؟`)) return;
  try {
    const r = await fetch(`/api/cut-prices/${id}/`, {
      method: 'DELETE', credentials: 'include',
      headers: { 'X-CSRFToken': _csrfToken() },
    });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل الحذف', 'error', '✗'); return; }
    alToast('تم الحذف', 'info', '🗑');
    await ctpLoad();
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

function _csrfToken() {
  const m = document.cookie.match(/csrftoken=([^;]+)/);
  return m ? m[1] : '';
}

// ══════════════════════════════════════════════════════════
// تفريق القص — cd*
// ══════════════════════════════════════════════════════════

const CD_TYPE_LABELS = { balance:'تفريق قص الرصيد', movement:'تفريق قص الحركات', system:'تفريق قص النظام' };
const CD_TYPE_COLORS = { balance:'#0369A1', movement:'#0F766E', system:'#7C3AED' };
const CD_TYPE_BG    = { balance:'#EFF6FF', movement:'#F0FDFA', system:'#F3F0FF' };
const CD_TYPE_BORDER = { balance:'#BFDBFE', movement:'#99F6E4', system:'#DDD6FE' };

let _cdData   = { balance:[], movement:[], system:[] };
let _cdSearch = { balance:'', movement:'', system:'' };
let _cdFiltered = { balance:[], movement:[], system:[] };
let _cdEditId = null;

async function cdInit() {
  _cdEditId = null;
  await cdLoad();
}

async function cdLoad() {
  ['balance','movement','system'].forEach(t => {
    const tb = document.getElementById('cd-tbody-' + t);
    if (tb) tb.innerHTML = '<tr><td colspan="4" class="sp-spinner">&#9696; جاري التحميل...</td></tr>';
  });
  try {
    const r = await fetch('/api/cut-distribution/', { credentials: 'include' });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    _cdData = d.grouped || { balance:[], movement:[], system:[] };
    _cdFiltered = {
      balance:  [..._cdData.balance],
      movement: [..._cdData.movement],
      system:   [..._cdData.system],
    };
    cdRenderAll();
  } catch {
    ['balance','movement','system'].forEach(t => {
      const tb = document.getElementById('cd-tbody-' + t);
      if (tb) tb.innerHTML = '<tr><td colspan="4" class="sp-empty">تعذّر تحميل البيانات</td></tr>';
    });
  }
}

function cdRenderAll() {
  ['balance','movement','system'].forEach(t => cdRenderCard(t));
  const total = (_cdData.balance||[]).length + (_cdData.movement||[]).length + (_cdData.system||[]).length;
  const el = document.getElementById('cd-total');
  if (el) el.textContent = total;
}

function cdFilter(type, q) {
  _cdSearch[type] = (q || '').toLowerCase();
  const s = _cdSearch[type];
  _cdFiltered[type] = s
    ? (_cdData[type] || []).filter(x =>
        (x.centerName||'').toLowerCase().includes(s) ||
        String(x.fromValue||'').includes(s) ||
        String(x.toValue||'').includes(s)
      )
    : [...(_cdData[type] || [])];
  cdRenderCard(type);
}

function cdRenderCard(type) {
  const tbody = document.getElementById('cd-tbody-' + type);
  if (!tbody) return;
  const items = _cdFiltered[type] || [];
  const countEl = document.getElementById('cd-count-' + type);
  if (countEl) countEl.textContent = (_cdData[type]||[]).length;

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="sp-empty">لا توجد بيانات — اضغط إضافة</td></tr>';
    return;
  }

  const fmt = n => Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:4});
  tbody.innerHTML = items.map(x => `
    <tr>
      <td style="font-weight:700;color:#1E293B">${x.centerName || '—'}</td>
      <td style="color:#475569;font-variant-numeric:tabular-nums">${fmt(x.fromValue)}</td>
      <td style="color:#475569;font-variant-numeric:tabular-nums">${fmt(x.toValue)}</td>
      <td style="font-weight:700;color:${CD_TYPE_COLORS[type]};font-variant-numeric:tabular-nums">${fmt(x.distribution)}</td>
      <td style="display:flex;gap:5px;justify-content:flex-end">
        <button class="cd-btn-edit" onclick="cdOpenEdit(${x.id})">✏️</button>
        <button class="cd-btn-del"  onclick="cdDelete(${x.id},'${(x.centerName||'').replace(/'/g,"\\'")}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

function cdOpenAdd(defaultType) {
  _cdEditId = null;
  document.getElementById('cd-modal-title').textContent = 'إضافة تفريق قص جديد';
  document.getElementById('cd-f-type').value         = defaultType || 'balance';
  document.getElementById('cd-f-center').value       = '';
  document.getElementById('cd-f-from').value         = '';
  document.getElementById('cd-f-to').value           = '';
  document.getElementById('cd-f-dist').value         = '';
  document.getElementById('cd-f-notes').value        = '';
  document.getElementById('cd-f-active').checked     = true;
  document.getElementById('cd-modal').style.display  = 'flex';
  document.getElementById('cd-f-center').focus();
}

function cdOpenEdit(id) {
  const all = [...(_cdData.balance||[]), ...(_cdData.movement||[]), ...(_cdData.system||[])];
  const x = all.find(i => i.id === id);
  if (!x) return;
  _cdEditId = id;
  document.getElementById('cd-modal-title').textContent = 'تعديل تفريق القص';
  document.getElementById('cd-f-type').value         = x.distType;
  document.getElementById('cd-f-center').value       = x.centerName || '';
  document.getElementById('cd-f-from').value         = x.fromValue  || '';
  document.getElementById('cd-f-to').value           = x.toValue    || '';
  document.getElementById('cd-f-dist').value         = x.distribution || '';
  document.getElementById('cd-f-notes').value        = x.notes      || '';
  document.getElementById('cd-f-active').checked     = x.isActive;
  document.getElementById('cd-modal').style.display  = 'flex';
  document.getElementById('cd-f-center').focus();
}

function cdCloseModal() {
  document.getElementById('cd-modal').style.display = 'none';
  _cdEditId = null;
}

async function cdSave() {
  const distType    = document.getElementById('cd-f-type').value;
  const centerName  = (document.getElementById('cd-f-center').value || '').trim();
  const fromValue   = parseFloat(document.getElementById('cd-f-from').value) || 0;
  const toValue     = parseFloat(document.getElementById('cd-f-to').value)   || 0;
  const distribution= parseFloat(document.getElementById('cd-f-dist').value) || 0;
  const notes       = (document.getElementById('cd-f-notes').value || '').trim();
  const isActive    = document.getElementById('cd-f-active').checked;

  if (!centerName) { alToast('اسم المركز مطلوب', 'error', '✗'); return; }

  const body   = { distType, centerName, fromValue, toValue, distribution, notes, isActive };
  const url    = _cdEditId ? `/api/cut-distribution/${_cdEditId}/` : '/api/cut-distribution/';
  const method = _cdEditId ? 'PATCH' : 'POST';

  try {
    const r = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrfToken() },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'حدث خطأ', 'error', '✗'); return; }
    alToast(d.message || 'تم الحفظ', 'success', '✓');
    cdCloseModal();
    await cdLoad();
  } catch { alToast('تعذّر الاتصال بالخادم', 'error', '✗'); }
}

async function cdDelete(id, center) {
  if (!confirm(`هل تريد حذف تفريق "${center}" نهائياً؟`)) return;
  try {
    const r = await fetch(`/api/cut-distribution/${id}/`, {
      method: 'DELETE', credentials: 'include',
      headers: { 'X-CSRFToken': _csrfToken() },
    });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل الحذف', 'error', '✗'); return; }
    alToast('تم الحذف', 'info', '🗑');
    await cdLoad();
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// إدارة العملات — cm*
// ══════════════════════════════════════════════════════════════════════════════
let _cmData         = [];
let _cmQuery        = '';
let _cmActiveFilter = '';
let _cmSortCol      = '';
let _cmSortDir      = 1;
let _cmPage         = 1;
let _cmPerPage      = 10;
let _cmEditId       = null;

function cmInit() {
  _cmQuery        = '';
  _cmActiveFilter = '';
  _cmSortCol      = '';
  _cmSortDir      = 1;
  _cmPage         = 1;
  const q = document.getElementById('cm-search');
  if (q) q.value = '';
  const af = document.getElementById('cm-filter-active');
  if (af) af.value = '';
  cmLoad();
}

async function cmLoad() {
  const tbody = document.getElementById('cm-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    let url = `/api/currencies/?q=${encodeURIComponent(_cmQuery)}`;
    if (_cmActiveFilter !== '') url += `&active=${_cmActiveFilter}`;
    const r = await fetch(url, { credentials: 'include' });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل التحميل', 'error', '✗'); return; }
    _cmData  = d.currencies || [];
    _cmPage  = 1;
    cmRender();
    document.getElementById('sp-count').textContent = `(${_cmData.length})`;
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

function cmFilter() {
  _cmQuery        = (document.getElementById('cm-search')?.value || '').trim();
  _cmActiveFilter = document.getElementById('cm-filter-active')?.value ?? '';
  _cmPage         = 1;
  cmLoad();
}

function cmSort(col) {
  if (_cmSortCol === col) _cmSortDir *= -1;
  else { _cmSortCol = col; _cmSortDir = 1; }
  cmRender();
}

function cmRender() {
  const tbody   = document.getElementById('cm-tbody');
  const foot    = document.getElementById('cm-foot');
  const showing = document.getElementById('cm-showing');
  if (!tbody) return;

  let rows = [..._cmData];
  if (_cmSortCol) {
    rows.sort((a, b) => {
      let av = a[_cmSortCol], bv = b[_cmSortCol];
      if (typeof av === 'string') return av.localeCompare(bv, 'ar') * _cmSortDir;
      return (parseFloat(av) - parseFloat(bv)) * _cmSortDir;
    });
  }

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / _cmPerPage));
  if (_cmPage > pages) _cmPage = pages;
  const start = (_cmPage - 1) * _cmPerPage;
  const slice = rows.slice(start, start + _cmPerPage);

  // تحديث أسهم الترتيب
  ['name','symbol','multiplier','evalRate'].forEach(col => {
    const el = document.getElementById('cm-sa-' + col);
    if (!el) return;
    if (_cmSortCol !== col) { el.textContent = '⇅'; return; }
    el.textContent = _cmSortDir === 1 ? '▲' : '▼';
  });

  if (showing) showing.textContent = total
    ? `عرض ${start + 1}–${Math.min(start + _cmPerPage, total)} من ${total}`
    : 'لا توجد نتائج';

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="sp-empty" style="padding:30px;color:#94A3B8">لا توجد عملات</td></tr>';
    if (foot) foot.innerHTML = '';
    return;
  }

  const fmt = v => parseFloat(v||0).toLocaleString('en-US', {minimumFractionDigits:4, maximumFractionDigits:6});
  tbody.innerHTML = slice.map((c, i) => `
    <tr style="${i%2===1?'background:#F8FAFC':''}">
      <td style="color:#94A3B8;font-size:11px">${start+i+1}</td>
      <td style="font-weight:700;color:#1E293B;text-align:right;padding-right:16px">${c.name}</td>
      <td><span class="cm2-symbol">${c.symbol}</span></td>
      <td style="font-variant-numeric:tabular-nums;font-weight:700">${fmt(c.multiplier)}</td>
      <td style="font-variant-numeric:tabular-nums;font-weight:700;color:#1D4ED8">${fmt(c.evalRate)}</td>
      <td><span class="${c.isActive?'cm2-active':'cm2-inactive'}">${c.isActive?'نشطة':'معطلة'}</span></td>
      <td>
        <button class="sp-btn sp-btn-primary" style="padding:4px 12px;font-size:11.5px" onclick="cmOpenEdit(${c.id})">تعديل</button>
        <button class="sp-btn sp-btn-danger"  style="padding:4px 12px;font-size:11.5px;margin-right:4px" onclick="cmDelete(${c.id},'${c.name.replace(/'/g,"\\'")}')">حذف</button>
      </td>
    </tr>`).join('');

  if (foot) {
    let btns = '';
    for (let i = 1; i <= pages; i++) {
      btns += `<button class="sp-page-btn${i===_cmPage?' active':''}" onclick="_cmPage=${i};cmRender()">${i}</button>`;
    }
    foot.innerHTML = btns;
  }
}

function cmOpenAdd() {
  _cmEditId = null;
  document.getElementById('cm-modal-title').textContent = 'إضافة عملة جديدة';
  document.getElementById('cm-inp-name').value        = '';
  document.getElementById('cm-inp-symbol').value      = '';
  document.getElementById('cm-inp-multiplier').value  = '1';
  document.getElementById('cm-inp-eval-rate').value   = '1';
  document.getElementById('cm-inp-active').checked    = true;
  document.getElementById('cm-inp-notes').value       = '';
  document.getElementById('cm-modal').style.display   = 'flex';
}

function cmOpenEdit(id) {
  const c = _cmData.find(x => x.id === id);
  if (!c) return;
  _cmEditId = id;
  document.getElementById('cm-modal-title').textContent = 'تعديل العملة';
  document.getElementById('cm-inp-name').value        = c.name;
  document.getElementById('cm-inp-symbol').value      = c.symbol;
  document.getElementById('cm-inp-multiplier').value  = c.multiplier;
  document.getElementById('cm-inp-eval-rate').value   = c.evalRate;
  document.getElementById('cm-inp-active').checked    = c.isActive;
  document.getElementById('cm-inp-notes').value       = c.notes || '';
  document.getElementById('cm-modal').style.display   = 'flex';
}

function cmCloseModal() {
  document.getElementById('cm-modal').style.display = 'none';
}

async function cmSave() {
  const payload = {
    name:       document.getElementById('cm-inp-name').value.trim(),
    symbol:     document.getElementById('cm-inp-symbol').value.trim(),
    multiplier: parseFloat(document.getElementById('cm-inp-multiplier').value) || 1,
    evalRate:   parseFloat(document.getElementById('cm-inp-eval-rate').value)  || 1,
    isActive:   document.getElementById('cm-inp-active').checked,
    notes:      document.getElementById('cm-inp-notes').value.trim(),
  };
  if (!payload.name)   { alToast('اسم العملة مطلوب', 'error', '✗'); return; }
  if (!payload.symbol) { alToast('رمز العملة مطلوب', 'error', '✗'); return; }

  const isEdit = _cmEditId !== null;
  const url    = isEdit ? `/api/currencies/${_cmEditId}/` : '/api/currencies/';
  const method = isEdit ? 'PATCH' : 'POST';

  try {
    const r = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrfToken() },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل الحفظ', 'error', '✗'); return; }
    alToast(d.message || 'تم الحفظ', 'success', '✓');
    cmCloseModal();
    await cmLoad();
    loadCurrencyOptions();   // حدّث قوائم العملات في القيود فوراً
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

async function cmDelete(id, name) {
  if (!confirm(`هل تريد حذف العملة "${name}" نهائياً؟`)) return;
  try {
    const r = await fetch(`/api/currencies/${id}/`, {
      method: 'DELETE', credentials: 'include',
      headers: { 'X-CSRFToken': _csrfToken() },
    });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل الحذف', 'error', '✗'); return; }
    alToast('تم حذف العملة', 'info', '🗑');
    await cmLoad();
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// إدارة المستخدمين — um*
// ══════════════════════════════════════════════════════════════════════════════
const UM_ROLES = [
  { code: 'M01',  label: 'الإدارة العامة' },
  { code: 'M02',  label: 'مشرف التلر' },
  { code: 'M03',  label: 'مشرف الحوالات' },
  { code: 'T01',  label: 'أقسام التلر' },
  { code: 'T02',  label: 'التحويل البنكي' },
  { code: 'T03',  label: 'الحوالات الخارجية' },
  { code: 'IM01', label: 'مدير المبرمجين' },
  { code: 'P01',  label: 'مبرمج' },
];

const UM_ROLE_COLORS = {
  M01:  { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  M02:  { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  M03:  { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  T01:  { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  T02:  { bg: '#FDF4FF', color: '#86198F', border: '#F5D0FE' },
  T03:  { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  IM01: { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
  P01:  { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' },
};

let _umData      = [];
let _umQuery     = '';
let _umRoleFilter = '';
let _umActiveFilter = '';
let _umSortCol   = 'username';
let _umSortDir   = 1;
let _umPage      = 1;
const _umPerPage = 10;
let _umEditUser  = null;
let _umPwdUser   = null;

function umInit() {
  _umQuery        = '';
  _umRoleFilter   = '';
  _umActiveFilter = '';
  _umSortCol      = 'username';
  _umSortDir      = 1;
  _umPage         = 1;
  const q = document.getElementById('um-search');
  if (q) q.value = '';
  const rf = document.getElementById('um-filter-role');
  if (rf) rf.value = '';
  const af = document.getElementById('um-filter-active');
  if (af) af.value = '';
  umLoad();
}

async function umLoad() {
  const wrap = document.getElementById('um-table-wrap');
  if (wrap) wrap.innerHTML = '<div class="sp-spinner"></div>';

  // update role counts badges
  try {
    let url = `/api/users?q=${encodeURIComponent(_umQuery)}`;
    if (_umRoleFilter)   url += `&role=${_umRoleFilter}`;
    const r = await fetch(url, { credentials: 'include' });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل التحميل', 'error', '✗'); return; }

    _umData = d.users || [];

    // filter active locally
    let filtered = _umData;
    if (_umActiveFilter === '1') filtered = _umData.filter(u => u.isActive);
    if (_umActiveFilter === '0') filtered = _umData.filter(u => !u.isActive);
    _umData = filtered;

    _umPage = 1;
    umRenderStats(d.roleCounts || {});
    umRender();
    document.getElementById('sp-count').textContent = `(${_umData.length})`;
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

function umRenderStats(counts) {
  const bar = document.getElementById('um-stats-bar');
  if (!bar) return;
  bar.innerHTML = UM_ROLES.map(r => {
    const c = counts[r.code] || 0;
    const cl = UM_ROLE_COLORS[r.code] || {};
    return `<span class="um-stat-chip" style="background:${cl.bg};color:${cl.color};border:1px solid ${cl.border}">
      ${r.label} <strong>${c}</strong>
    </span>`;
  }).join('');
}

function umFilter() {
  _umQuery        = (document.getElementById('um-search')?.value || '').trim();
  _umRoleFilter   = document.getElementById('um-filter-role')?.value ?? '';
  _umActiveFilter = document.getElementById('um-filter-active')?.value ?? '';
  _umPage         = 1;
  umLoad();
}

function umSort(col) {
  if (_umSortCol === col) _umSortDir *= -1;
  else { _umSortCol = col; _umSortDir = 1; }
  umRender();
}

function umRender() {
  const wrap = document.getElementById('um-table-wrap');
  if (!wrap) return;

  let rows = [..._umData];
  if (_umSortCol) {
    rows.sort((a, b) => {
      let av = a[_umSortCol] || '', bv = b[_umSortCol] || '';
      if (typeof av === 'string') return av.localeCompare(bv, 'ar') * _umSortDir;
      return (av - bv) * _umSortDir;
    });
  }

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / _umPerPage));
  if (_umPage > pages) _umPage = pages;
  const start = (_umPage - 1) * _umPerPage;
  const slice = rows.slice(start, start + _umPerPage);

  const foot    = document.getElementById('um-foot');
  const showing = document.getElementById('um-showing');
  if (showing) showing.textContent = total
    ? `عرض ${start + 1}–${Math.min(start + _umPerPage, total)} من ${total}`
    : '';

  if (!slice.length) {
    wrap.innerHTML = '<div class="sp-empty">لا يوجد مستخدمون</div>';
    if (foot) foot.innerHTML = '';
    return;
  }

  const si = (col) => {
    if (_umSortCol !== col) return '<span class="um-sort-icon">⇅</span>';
    return _umSortDir === 1
      ? '<span class="um-sort-icon active">↑</span>'
      : '<span class="um-sort-icon active">↓</span>';
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
    } catch { return '—'; }
  };

  wrap.innerHTML = `
    <table class="sp-table um-table">
      <thead>
        <tr>
          <th class="um-th-sort" onclick="umSort('name')">الاسم ${si('name')}</th>
          <th class="um-th-sort" onclick="umSort('username')">اسم المستخدم ${si('username')}</th>
          <th class="um-th-sort" onclick="umSort('role')">الدور ${si('role')}</th>
          <th class="um-th-sort" onclick="umSort('email')">البريد الإلكتروني ${si('email')}</th>
          <th>الحالة</th>
          <th class="um-th-sort" onclick="umSort('lastLogin')">آخر دخول ${si('lastLogin')}</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${slice.map(u => {
          const rc = UM_ROLE_COLORS[u.role] || { bg:'#F8FAFC', color:'#475569', border:'#E2E8F0' };
          return `
          <tr class="${u.isActive ? '' : 'um-row-inactive'}">
            <td>
              <div class="um-name-cell">
                <span class="um-avatar" style="background:${rc.bg};color:${rc.color};border:1px solid ${rc.border}">${(u.name||u.username).charAt(0).toUpperCase()}</span>
                <div>
                  <div class="um-name">${u.name || u.username}</div>
                  ${u.email ? `<div class="um-email-sub">${u.email}</div>` : ''}
                </div>
              </div>
            </td>
            <td><code class="um-code">${u.username}</code></td>
            <td><span class="um-role-badge" style="background:${rc.bg};color:${rc.color};border:1px solid ${rc.border}">${u.roleName}</span></td>
            <td class="um-email-cell">${u.email || '—'}</td>
            <td><span class="um-status-badge ${u.isActive ? 'um-active' : 'um-inactive'}">${u.isActive ? 'نشط' : 'معطل'}</span></td>
            <td class="um-date-cell">${fmtDate(u.lastLogin)}</td>
            <td>
              <button class="sp-btn sp-btn-primary um-btn-sm" onclick="umOpenEdit('${u.username}')">تعديل</button>
              <button class="sp-btn um-btn-pwd um-btn-sm" onclick="umOpenPwd('${u.username}')">كلمة المرور</button>
              <button class="sp-btn sp-btn-danger um-btn-sm" onclick="umDelete('${u.username}', '${u.name.replace(/'/g,"\\'")}')">حذف</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  if (foot) {
    let btns = '';
    for (let i = 1; i <= pages; i++) {
      btns += `<button class="sp-page-btn${i===_umPage?' active':''}" onclick="_umPage=${i};umRender()">${i}</button>`;
    }
    foot.innerHTML = btns;
  }
}

function umOpenAdd() {
  _umEditUser = null;
  document.getElementById('um-modal-title').textContent = 'إضافة مستخدم جديد';
  document.getElementById('um-f-username').value    = '';
  document.getElementById('um-f-username').disabled = false;
  document.getElementById('um-f-firstname').value   = '';
  document.getElementById('um-f-lastname').value    = '';
  document.getElementById('um-f-email').value       = '';
  document.getElementById('um-f-role').value        = 'T01';
  document.getElementById('um-f-active').checked    = true;
  document.getElementById('um-pwd-row').style.display = 'grid';
  document.getElementById('um-f-password').value    = '';
  document.getElementById('um-modal').style.display = 'flex';
}

function umOpenEdit(username) {
  const u = _umData.find(x => x.username === username);
  if (!u) return;
  _umEditUser = username;
  document.getElementById('um-modal-title').textContent = 'تعديل المستخدم';
  document.getElementById('um-f-username').value    = u.username;
  document.getElementById('um-f-username').disabled = true;
  document.getElementById('um-f-firstname').value   = u.firstName || '';
  document.getElementById('um-f-lastname').value    = u.lastName  || '';
  document.getElementById('um-f-email').value       = u.email     || '';
  document.getElementById('um-f-role').value        = u.role;
  document.getElementById('um-f-active').checked    = u.isActive;
  document.getElementById('um-pwd-row').style.display = 'none';
  document.getElementById('um-modal').style.display = 'flex';
}

function umCloseModal() {
  document.getElementById('um-modal').style.display = 'none';
}

async function umSave() {
  const isEdit = _umEditUser !== null;
  const payload = {
    firstName: document.getElementById('um-f-firstname').value.trim(),
    lastName:  document.getElementById('um-f-lastname').value.trim(),
    email:     document.getElementById('um-f-email').value.trim(),
    role:      document.getElementById('um-f-role').value,
    isActive:  document.getElementById('um-f-active').checked,
  };

  if (!isEdit) {
    payload.username = document.getElementById('um-f-username').value.trim();
    payload.password = document.getElementById('um-f-password').value.trim();
    if (!payload.username) { alToast('اسم المستخدم مطلوب', 'error', '✗'); return; }
    if (!payload.password) { alToast('كلمة المرور مطلوبة', 'error', '✗'); return; }
  }

  const url    = isEdit ? `/api/users/${_umEditUser}` : '/api/users';
  const method = isEdit ? 'PATCH' : 'POST';

  try {
    const r = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrfToken() },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل الحفظ', 'error', '✗'); return; }
    alToast(isEdit ? 'تم تحديث المستخدم' : `تم إنشاء المستخدم ${payload.username}`, 'success', '✓');
    umCloseModal();
    await umLoad();
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

function umOpenPwd(username) {
  _umPwdUser = username;
  document.getElementById('um-pwd-modal-user').textContent = username;
  document.getElementById('um-pwd-new').value  = '';
  document.getElementById('um-pwd-modal').style.display = 'flex';
}

function umClosePwd() {
  document.getElementById('um-pwd-modal').style.display = 'none';
}

async function umSavePwd() {
  const pwd = document.getElementById('um-pwd-new').value.trim();
  if (!pwd) { alToast('أدخل كلمة المرور الجديدة', 'error', '✗'); return; }
  try {
    const r = await fetch(`/api/users/${_umPwdUser}/password`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrfToken() },
      body: JSON.stringify({ password: pwd }),
    });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل تغيير كلمة المرور', 'error', '✗'); return; }
    alToast('تم تغيير كلمة المرور', 'success', '✓');
    umClosePwd();
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

async function umDelete(username, name) {
  if (!confirm(`هل تريد حذف المستخدم "${name}" (${username}) نهائياً؟`)) return;
  try {
    const r = await fetch(`/api/users/${username}`, {
      method: 'DELETE', credentials: 'include',
      headers: { 'X-CSRFToken': _csrfToken() },
    });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل الحذف', 'error', '✗'); return; }
    alToast('تم حذف المستخدم', 'info', '🗑');
    await umLoad();
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// البحث المتقدم — bs* (بحث شامل)
// ══════════════════════════════════════════════════════════════════════════════
let _bsResults    = [];
let _bsPage       = 1;
let _bsPerPage    = 10;
let _bsTotalPages = 1;
let _bsTotal      = 0;
let _bsSortCol    = '';
let _bsSortDir    = 1;
let _bsInitData   = null;
let _bsTableQuery = '';

const BS_CURRENCIES = ['USD','ILS','JOD','EUR','GBP','SAR','AED','TRY','SYP','EGP'];

const BS_STATUS_MAP = {
  pending:    { label: 'بانتظار',      bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  processing: { label: 'قيد التنفيذ', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  completed:  { label: 'تم التنفيذ',  bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' },
  cancelled:  { label: 'ملغاة',       bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' },
  rejected:   { label: 'مرفوضة',      bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
};

function bsInit() {
  _bsPage    = 1;
  _bsResults = [];
  bsResetForm();
  if (!_bsInitData) bsLoadInit();
}

async function bsLoadInit() {
  try {
    const r = await fetch('/api/am/init/', { credentials: 'include' });
    const d = await r.json();
    if (!d.success) return;
    _bsInitData = d;
    const srcSel = document.getElementById('as-f-source');
    const dstSel = document.getElementById('as-f-dest');
    if (srcSel && dstSel) {
      const opts = (d.branches || []).map(b => `<option value="${b.name}">${b.name}</option>`).join('');
      srcSel.innerHTML = '<option value="">الجميع</option>' + opts;
      dstSel.innerHTML = '<option value="">الجميع</option>' + opts;
    }
    const curSel = document.getElementById('as-f-currency');
    if (curSel) {
      curSel.innerHTML = '<option value="">جميع العملات</option>'
        + BS_CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  } catch {}
}

function bsResetForm() {
  const today     = new Date().toISOString().slice(0, 10);
  const lastMonth = new Date(Date.now() - 30*24*3600*1000).toISOString().slice(0,10);
  const f = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  f('as-f-source', '');      f('as-f-dest', '');
  f('as-f-date-from', lastMonth); f('as-f-date-to', today);
  f('as-f-sender', '');      f('as-f-receiver', '');
  f('as-f-currency', '');    f('as-f-amount-op', 'gte'); f('as-f-amount', '');
  f('as-f-fee-export-op', 'gte'); f('as-f-fee-export', '');
  f('as-f-fee-del-op', 'gte');    f('as-f-fee-del', '');
  f('as-f-status', '');      f('as-f-type', '');  f('as-f-notes', '');
  const wrap = document.getElementById('as-table-wrap');
  if (wrap) wrap.innerHTML = `<table class="as-table"><thead><tr>
    <th>▲</th><th class="as-th-sort">من <span class="as-sort-icon">⇅</span></th>
    <th class="as-th-sort">الى <span class="as-sort-icon">⇅</span></th>
    <th class="as-th-sort">لنا <span class="as-sort-icon">⇅</span></th>
    <th class="as-th-sort">علينا <span class="as-sort-icon">⇅</span></th>
    <th class="as-th-sort">الربح <span class="as-sort-icon">⇅</span></th>
    <th class="as-th-sort">تاريخ التحويل <span class="as-sort-icon">⇅</span></th>
    <th class="as-th-sort">تاريخ الاستلام <span class="as-sort-icon">⇅</span></th>
    <th class="as-th-sort">رقم الحوالة <span class="as-sort-icon">⇅</span></th>
    <th class="as-th-sort">المستفيد <span class="as-sort-icon">⇅</span></th>
    <th class="as-th-sort">الحالة <span class="as-sort-icon">⇅</span></th>
  </tr></thead><tbody><tr><td colspan="11" class="sp-empty" style="padding:40px;color:#94A3B8;font-size:13px">اضغط على زر بحث لعرض النتائج</td></tr></tbody></table>`;
  const foot = document.getElementById('as-foot');
  if (foot) foot.innerHTML = '';
  const inf = document.getElementById('as-info-bar');
  if (inf) { inf.innerHTML = ''; inf.style.display = 'none'; }
  _bsTableQuery = '';
  _bsResults    = [];
}

async function bsSearch(page) {
  _bsPage = page || 1;
  const wrap = document.getElementById('as-table-wrap');
  if (wrap) wrap.innerHTML = '<div class="sp-spinner"></div>';

  const gv = id => (document.getElementById(id)?.value || '').trim();
  const params = new URLSearchParams();
  if (gv('as-f-date-from')) params.set('date_from', gv('as-f-date-from'));
  if (gv('as-f-date-to'))   params.set('date_to',   gv('as-f-date-to'));
  if (gv('as-f-currency'))  params.set('currency',  gv('as-f-currency'));
  if (gv('as-f-status'))    params.set('status',    gv('as-f-status'));
  const qParts = [gv('as-f-sender'), gv('as-f-receiver'), gv('as-f-source'), gv('as-f-dest'), gv('as-f-notes')].filter(Boolean);
  if (qParts.length) params.set('q', qParts.join(' '));
  params.set('page',     _bsPage);
  params.set('per_page', _bsPerPage);

  try {
    const r = await fetch(`/api/am/transfers/?${params}`, { credentials: 'include' });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل البحث', 'error', '✗'); return; }
    _bsResults    = d.transfers || [];
    _bsTotalPages = d.totalPages || 1;
    _bsTotal      = d.summary?.total || 0;
    _bsResults = bsClientFilter(_bsResults, gv);
    bsRenderSummary(d.summary);
    bsRender();
    document.getElementById('sp-count').textContent = `(${_bsTotal})`;
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

function bsClientFilter(rows, gv) {
  const cmp = (op, a, b) => {
    if (!b) return true;
    const bv = parseFloat(b);
    if (isNaN(bv)) return true;
    if (op === 'gte') return a >= bv;
    if (op === 'lte') return a <= bv;
    if (op === 'eq')  return Math.abs(a - bv) < 0.0001;
    return true;
  };
  return rows.filter(t =>
    cmp(gv('as-f-amount-op'),     parseFloat(t.amount)     || 0, gv('as-f-amount')) &&
    cmp(gv('as-f-fee-export-op'), parseFloat(t.commission) || 0, gv('as-f-fee-export')) &&
    cmp(gv('as-f-fee-del-op'),    parseFloat(t.commission) || 0, gv('as-f-fee-del'))
  );
}

function bsRenderSummary(summary) {
  const bar = document.getElementById('as-info-bar');
  if (!bar || !summary) return;
  const fmt = v => parseFloat(v || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  bar.style.display = 'flex';
  bar.innerHTML = `
    <span class="as-stat-chip as-chip-total">الإجمالي: <strong>${summary.total || 0}</strong></span>
    <span class="as-stat-chip as-chip-pending">بانتظار: <strong>${summary.pendingCount || 0}</strong></span>
    <span class="as-stat-chip as-chip-done">تم التنفيذ: <strong>${summary.completedCount || 0}</strong></span>
    <span class="as-stat-chip as-chip-amount">المبلغ الكلي: <strong>${fmt(summary.totalAmount)}</strong></span>
    <span class="as-stat-chip as-chip-comm">العمولة الكلية: <strong>${fmt(summary.totalCommission)}</strong></span>
  `;
}

function bsTableSearch(q) {
  _bsTableQuery = q.trim().toLowerCase();
  bsRender();
}

function bsSort(col) {
  if (_bsSortCol === col) _bsSortDir *= -1;
  else { _bsSortCol = col; _bsSortDir = 1; }
  bsRender();
}

function bsRender() {
  const wrap   = document.getElementById('as-table-wrap');
  const tblBar = document.getElementById('as-tbl-bar');
  const tblScr = document.getElementById('as-tbl-scroll');
  const foot   = document.getElementById('as-foot');
  if (!wrap) return;

  let rows = [..._bsResults];
  if (_bsTableQuery) {
    rows = rows.filter(t =>
      [t.senderName, t.receiverName, t.destination, t.refNumber, t.currency, t.status]
        .some(v => String(v||'').toLowerCase().includes(_bsTableQuery))
    );
  }
  if (_bsSortCol) {
    rows.sort((a, b) => {
      let av = a[_bsSortCol] || '', bv = b[_bsSortCol] || '';
      if (!isNaN(parseFloat(av))) return (parseFloat(av) - parseFloat(bv)) * _bsSortDir;
      return String(av).localeCompare(String(bv), 'ar') * _bsSortDir;
    });
  }

  if (!rows.length) {
    wrap.innerHTML = `<table class="as-table"><thead><tr>
      <th>▲</th><th class="as-th-sort">من</th><th class="as-th-sort">الى</th>
      <th class="as-th-sort">لنا</th><th class="as-th-sort">علينا</th>
      <th class="as-th-sort">الربح</th><th class="as-th-sort">تاريخ التحويل</th>
      <th class="as-th-sort">تاريخ الاستلام</th><th class="as-th-sort">رقم الحوالة</th>
      <th class="as-th-sort">المستفيد</th><th class="as-th-sort">الحالة</th>
    </tr></thead><tbody><tr><td colspan="11" class="sp-empty" style="padding:40px;color:#94A3B8;font-size:13px">لا توجد نتائج</td></tr></tbody></table>`;
    if (foot) foot.innerHTML = '';
    return;
  }

  const fmt = v => parseFloat(v || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const si = col => {
    if (_bsSortCol !== col) return '<span class="as-sort-icon">⇅</span>';
    return _bsSortDir === 1 ? '<span class="as-sort-icon active">↑</span>' : '<span class="as-sort-icon active">↓</span>';
  };
  const fmtDate = iso => iso ? iso.slice(0,16).replace('T',' ') : '—';

  wrap.innerHTML = `
    <table class="as-table">
      <thead>
        <tr>
          <th>▲</th>
          <th class="as-th-sort" onclick="bsSort('senderName')">من ${si('senderName')}</th>
          <th class="as-th-sort" onclick="bsSort('destination')">الى ${si('destination')}</th>
          <th class="as-th-sort" onclick="bsSort('amount')">لنا ${si('amount')}</th>
          <th class="as-th-sort" onclick="bsSort('commission')">علينا ${si('commission')}</th>
          <th class="as-th-sort" onclick="bsSort('_profit')">الربح ${si('_profit')}</th>
          <th class="as-th-sort" onclick="bsSort('createdAt')">تاريخ التحويل ${si('createdAt')}</th>
          <th class="as-th-sort" onclick="bsSort('completedAt')">تاريخ الاستلام ${si('completedAt')}</th>
          <th class="as-th-sort" onclick="bsSort('refNumber')">رقم الحوالة ${si('refNumber')}</th>
          <th class="as-th-sort" onclick="bsSort('receiverName')">المستفيد ${si('receiverName')}</th>
          <th class="as-th-sort" onclick="bsSort('status')">الحالة ${si('status')}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((t, i) => {
          const st = BS_STATUS_MAP[t.status] || { label: t.status, bg:'#F8FAFC', color:'#475569', border:'#E2E8F0' };
          const profit = parseFloat(t.amount||0) - parseFloat(t.commission||0);
          const profitFmt = profit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
          const pc = profit >= 0 ? '#16A34A' : '#DC2626';
          return `
          <tr style="${i%2===1?'background:#F8FAFC':''}">
            <td class="as-idx-cell">${((_bsPage-1)*_bsPerPage)+i+1}</td>
            <td class="as-name-cell">${t.senderName||'—'}</td>
            <td class="as-dest-cell">${t.destination||t.receiverName||'—'}</td>
            <td class="as-amount-cell">${fmt(t.amount)}</td>
            <td class="as-comm-cell">${fmt(t.commission)}</td>
            <td style="color:${pc};font-weight:700">${profitFmt}</td>
            <td class="as-date-cell">${fmtDate(t.createdAt)}</td>
            <td class="as-date-cell">${fmtDate(t.completedAt)}</td>
            <td><code class="as-ref">${t.refNumber}</code></td>
            <td class="as-name-cell">${t.receiverName||'—'}</td>
            <td><span class="as-status-badge" style="background:${st.bg};color:${st.color};border:1px solid ${st.border}">${st.label}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  if (foot) {
    let btns = '';
    for (let i = 1; i <= Math.min(_bsTotalPages, 7); i++) {
      btns += `<button class="sp-page-btn${i===_bsPage?' active':''}" onclick="bsSearch(${i})">${i}</button>`;
    }
    if (_bsTotalPages > 7) btns += `<span style="padding:0 8px;color:#94A3B8">…${_bsTotalPages}</span>`;
    foot.innerHTML = btns;
  }
}

function bsExportCsv() {
  if (!_bsResults.length) { alToast('لا توجد نتائج للتصدير', 'warning', '⚠'); return; }
  const headers = ['#','من','الى','لنا','علينا','الربح','تاريخ التحويل','تاريخ الاستلام','رقم الحوالة','المستفيد','الحالة'];
  const rows = _bsResults.map((t, i) => {
    const st = BS_STATUS_MAP[t.status]?.label || t.status;
    const profit = (parseFloat(t.amount||0) - parseFloat(t.commission||0)).toFixed(2);
    return [i+1, t.senderName, t.destination||t.receiverName||'', parseFloat(t.amount||0).toFixed(2),
            parseFloat(t.commission||0).toFixed(2), profit, t.createdAt||'', t.completedAt||'',
            t.refNumber, t.receiverName, st];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv);
  a.download = `advanced_search_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  alToast('تم تصدير النتائج', 'success', '📥');
}

// ══════════════════════════════════════════════════════════════════════════════
// عملات القيد المتقدم — aeo*
// ══════════════════════════════════════════════════════════════════════════════
let _aeoAll       = [];
let _aeoFiltered  = [];
let _aeoPage      = 1;
let _aeoPerPage   = 10;
let _aeoSortCol   = 'name';
let _aeoSortAsc   = true;

function aeoInit() {
  if (_aeoAll.length) { aeoRender(1); return; }
  aeoLoad();
}

async function aeoLoad() {
  const tbody = document.getElementById('aeo-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="sp-empty"><div class="sp-spinner"></div></td></tr>';
  try {
    const r = await fetch('/api/currencies/', { credentials: 'include' });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل التحميل', 'error', '✗'); return; }
    _aeoAll = d.currencies || [];
    aeoFilter();
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

function aeoFilter(q) {
  const search = (q !== undefined ? q : (document.getElementById('aeo-search')?.value || '')).trim().toLowerCase();
  const active = document.getElementById('aeo-filter-active')?.value || '';
  _aeoFiltered = _aeoAll.filter(c => {
    if (active === '1' && !c.isActive) return false;
    if (active === '0' && c.isActive)  return false;
    if (!search) return true;
    return (c.name||'').toLowerCase().includes(search) || (c.symbol||'').toLowerCase().includes(search);
  });
  aeoSort(_aeoSortCol, true);
}

function aeoSort(col, noToggle) {
  if (!noToggle) {
    if (_aeoSortCol === col) _aeoSortAsc = !_aeoSortAsc;
    else { _aeoSortCol = col; _aeoSortAsc = true; }
  }
  document.querySelectorAll('[id^="aeo-sa-"]').forEach(e => e.textContent = '⇅');
  const arrow = document.getElementById('aeo-sa-' + col);
  if (arrow) arrow.textContent = _aeoSortAsc ? '▲' : '▼';
  _aeoFiltered.sort((a, b) => {
    const av = a[col] ?? '', bv = b[col] ?? '';
    if (!isNaN(parseFloat(av))) return _aeoSortAsc ? parseFloat(av) - parseFloat(bv) : parseFloat(bv) - parseFloat(av);
    return _aeoSortAsc ? String(av).localeCompare(String(bv), 'ar') : String(bv).localeCompare(String(av), 'ar');
  });
  aeoRender(1);
}

function aeoRender(p) {
  if (p !== undefined) _aeoPage = p;
  const total   = _aeoFiltered.length;
  const perPage = _aeoPerPage;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  _aeoPage      = Math.min(Math.max(1, _aeoPage), maxPage);
  const start   = (_aeoPage - 1) * perPage;
  const slice   = _aeoFiltered.slice(start, start + perPage);

  const chip = document.getElementById('aeo-count');
  if (chip) chip.textContent = `${total} عملة`;

  const tbody = document.getElementById('aeo-tbody');
  if (!tbody) return;

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="sp-empty" style="padding:30px;color:#94A3B8">لا توجد عملات</td></tr>';
    const foot = document.getElementById('aeo-foot');
    if (foot) foot.innerHTML = '';
    return;
  }

  const fmt = v => parseFloat(v||0).toLocaleString('en-US', {minimumFractionDigits:4, maximumFractionDigits:6});
  tbody.innerHTML = slice.map((c, i) => `
    <tr style="${i%2===1?'background:#F8FAFC':''}">
      <td class="aeo-idx">${start+i+1}</td>
      <td><span class="aeo-symbol">${c.symbol||'—'}</span></td>
      <td class="aeo-name">${c.name||'—'}</td>
      <td class="aeo-num">${fmt(c.multiplier)}</td>
      <td class="aeo-num" style="color:#1D4ED8">${fmt(c.evalRate)}</td>
      <td><span class="aeo-active-badge ${c.isActive?'on':'off'}">${c.isActive?'نشطة':'معطلة'}</span></td>
      <td>
        <button class="sp-btn sp-btn-primary" style="padding:4px 12px;font-size:11.5px" onclick="aeoOpenEdit(${c.id})">تعديل</button>
        <button class="sp-btn sp-btn-danger"  style="padding:4px 12px;font-size:11.5px;margin-right:4px" onclick="aeoDelete(${c.id},'${(c.name||'').replace(/'/g,"\\'")}')">حذف</button>
      </td>
    </tr>`).join('');

  const foot = document.getElementById('aeo-foot');
  if (foot) {
    let btns = '';
    for (let i = 1; i <= maxPage; i++) {
      btns += `<button class="sp-page-btn${i===_aeoPage?' active':''}" onclick="aeoRender(${i})">${i}</button>`;
    }
    foot.innerHTML = btns;
  }
}

function aeoOpenAdd() {
  document.getElementById('aeo-inp-id').value        = '';
  document.getElementById('aeo-inp-name').value      = '';
  document.getElementById('aeo-inp-symbol').value    = '';
  document.getElementById('aeo-inp-multiplier').value = '1';
  document.getElementById('aeo-inp-eval-rate').value  = '1';
  document.getElementById('aeo-inp-notes').value     = '';
  document.getElementById('aeo-inp-active').checked  = true;
  document.getElementById('aeo-modal-title').textContent = 'إضافة عملة جديدة';
  document.getElementById('aeo-modal').style.display = 'flex';
}

function aeoOpenEdit(id) {
  const c = _aeoAll.find(x => x.id === id);
  if (!c) return;
  document.getElementById('aeo-inp-id').value         = c.id;
  document.getElementById('aeo-inp-name').value       = c.name;
  document.getElementById('aeo-inp-symbol').value     = c.symbol;
  document.getElementById('aeo-inp-multiplier').value = c.multiplier;
  document.getElementById('aeo-inp-eval-rate').value  = c.evalRate;
  document.getElementById('aeo-inp-notes').value      = c.notes || '';
  document.getElementById('aeo-inp-active').checked   = c.isActive;
  document.getElementById('aeo-modal-title').textContent = 'تعديل العملة';
  document.getElementById('aeo-modal').style.display  = 'flex';
}

function aeoCloseModal() {
  document.getElementById('aeo-modal').style.display = 'none';
}

async function aeoSave() {
  const id   = document.getElementById('aeo-inp-id').value;
  const body = {
    name:       document.getElementById('aeo-inp-name').value.trim(),
    symbol:     document.getElementById('aeo-inp-symbol').value.trim().toUpperCase(),
    multiplier: parseFloat(document.getElementById('aeo-inp-multiplier').value) || 1,
    evalRate:   parseFloat(document.getElementById('aeo-inp-eval-rate').value)  || 1,
    notes:      document.getElementById('aeo-inp-notes').value.trim(),
    isActive:   document.getElementById('aeo-inp-active').checked,
  };
  const url    = id ? `/api/currencies/${id}/` : '/api/currencies/';
  const method = id ? 'PATCH' : 'POST';
  try {
    const r = await fetch(url, { method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrfToken() },
      body: JSON.stringify(body) });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل الحفظ', 'error', '✗'); return; }
    alToast(d.message || 'تم الحفظ', 'success', '✓');
    aeoCloseModal();
    _aeoAll = [];
    aeoLoad();
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

async function aeoDelete(id, name) {
  if (!confirm(`هل تريد حذف العملة "${name}"؟`)) return;
  try {
    const r = await fetch(`/api/currencies/${id}/`, { method: 'DELETE', credentials: 'include',
      headers: { 'X-CSRFToken': _csrfToken() } });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل الحذف', 'error', '✗'); return; }
    alToast(d.message || 'تم الحذف', 'info', '🗑');
    _aeoAll = [];
    aeoLoad();
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// مصادقة القيود — vv*
// ══════════════════════════════════════════════════════════════════════════════
let _vvAll        = [];
let _vvFiltered   = [];
let _vvPage       = 1;
let _vvPerPage    = 10;
let _vvTotalPages = 1;
let _vvSortCol    = '';
let _vvSortDir    = 1;
let _vvTableQuery = '';
let _vvApproved   = {};   // id → true  (مصادق عليها محلياً في هذه الجلسة)

function vvInit() {
  const today      = new Date().toISOString().slice(0, 10);
  const threeDays  = new Date(Date.now() - 3*24*3600*1000).toISOString().slice(0, 10);
  const f = (id, v) => { const el = document.getElementById(id); if (el && !el.value) el.value = v; };
  f('vv-date-from', threeDays);
  f('vv-date-to',   today);
  vvSearch(1);
}

async function vvSearch(page) {
  _vvPage = page || 1;
  const tbody = document.getElementById('vv-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="sp-empty"><div class="sp-spinner"></div></td></tr>';

  const gv = id => (document.getElementById(id)?.value || '').trim();
  const params = new URLSearchParams();
  if (gv('vv-date-from')) params.set('date_from', gv('vv-date-from'));
  if (gv('vv-date-to'))   params.set('date_to',   gv('vv-date-to'));
  params.set('page',     _vvPage);
  params.set('per_page', _vvPerPage);

  try {
    const r = await fetch(`/api/am/journal/?${params}`, { credentials: 'include' });
    const d = await r.json();
    if (!d.success) { alToast(d.message || 'فشل التحميل', 'error', '✗'); return; }
    _vvAll      = d.records || [];
    _vvTotalPages = d.totalPages || 1;
    _vvTableQuery = '';
    const srch = document.getElementById('vv-tbl-search');
    if (srch) srch.value = '';
    vvApplyFilter();
    const chip = document.getElementById('vv-count-chip');
    if (chip) chip.textContent = `${d.total} قيد`;
  } catch { alToast('تعذّر الاتصال', 'error', '✗'); }
}

function vvApplyFilter() {
  const pendingOnly = document.getElementById('vv-pending-only')?.checked;
  _vvFiltered = _vvAll.filter(j => {
    if (pendingOnly && _vvApproved[j.id]) return false;
    if (!_vvTableQuery) return true;
    const q = _vvTableQuery;
    return [j.fromAccount?.name, j.toAccount?.name, j.refNumber, j.createdBy]
      .some(v => String(v||'').toLowerCase().includes(q));
  });
  vvRender();
}

function vvTableSearch(q) {
  _vvTableQuery = q.trim().toLowerCase();
  vvApplyFilter();
}

function vvSort(col) {
  if (_vvSortCol === col) _vvSortDir *= -1;
  else { _vvSortCol = col; _vvSortDir = 1; }
  vvRender();
}

function vvRender() {
  const tbody = document.getElementById('vv-tbody');
  const foot  = document.getElementById('vv-foot');
  if (!tbody) return;

  let rows = [..._vvFiltered];
  if (_vvSortCol) {
    rows.sort((a, b) => {
      const getVal = (obj, col) => {
        if (col === 'fromAccount') return obj.fromAccount?.name || '';
        if (col === 'toAccount')   return obj.toAccount?.name   || '';
        return obj[col] || '';
      };
      const av = getVal(a, _vvSortCol), bv = getVal(b, _vvSortCol);
      if (!isNaN(parseFloat(av))) return (parseFloat(av) - parseFloat(bv)) * _vvSortDir;
      return String(av).localeCompare(String(bv), 'ar') * _vvSortDir;
    });
  }

  const perPage = _vvPerPage;
  const maxPage = Math.max(1, Math.ceil(rows.length / perPage));
  _vvPage = Math.min(Math.max(1, _vvPage), maxPage);
  const slice = rows.slice((_vvPage-1)*perPage, _vvPage*perPage);

  const fmt = v => parseFloat(v||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const si  = col => {
    if (_vvSortCol !== col) return '<span class="vv-si">⇅</span>';
    return _vvSortDir === 1 ? '<span class="vv-si" style="opacity:1">↑</span>' : '<span class="vv-si" style="opacity:1">↓</span>';
  };

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="sp-empty" style="padding:30px;color:#94A3B8">لا توجد قيود</td></tr>';
    if (foot) foot.innerHTML = '';
    return;
  }

  tbody.innerHTML = slice.map((j, i) => {
    const approved = !!_vvApproved[j.id];
    const actionCell = approved
      ? `<td><span class="vv-approved-badge">✓ تمت المصادقة</span></td>`
      : `<td><button class="vv-approve-btn" onclick="vvApprove(${j.id})">مصادقة</button></td>`;
    return `<tr style="${i%2===1?'background:#F8FAFC':''}">
      <td class="vv-idx">${(_vvPage-1)*perPage+i+1}</td>
      <td class="vv-amount">${fmt(j.amount)} <small style="color:#94A3B8;font-weight:400">${j.fromCurrency||''}</small></td>
      <td style="font-weight:600;color:#0F172A">${j.fromAccount?.name||'—'}</td>
      <td style="color:#1D4ED8">${j.toAccount?.name||'—'}</td>
      <td class="vv-amount" style="color:#DC2626">${fmt(j.toAmount)} <small style="color:#94A3B8;font-weight:400">${j.toCurrency||''}</small></td>
      <td style="color:#475569">${j.toAccount?.name||'—'}</td>
      <td class="vv-date">${(j.createdAt||'').slice(0,16)}</td>
      <td><code class="vv-ref">${j.refNumber||'—'}</code></td>
      <td class="vv-user">${j.createdBy||'—'}</td>
      ${actionCell}
    </tr>`;
  }).join('');

  if (foot) {
    let btns = '';
    for (let i = 1; i <= Math.min(_vvTotalPages, 7); i++) {
      btns += `<button class="sp-page-btn${i===_vvPage?' active':''}" onclick="vvSearch(${i})">${i}</button>`;
    }
    if (_vvTotalPages > 7) btns += `<span style="padding:0 8px;color:#94A3B8">…${_vvTotalPages}</span>`;
    foot.innerHTML = btns;
  }
}

function vvApprove(id) {
  _vvApproved[id] = true;
  alToast('تمت المصادقة على القيد', 'success', '✓');
  vvApplyFilter();
}

// ══════════════════════════════════════════════
//  سجل الأحداث  (el*)
// ══════════════════════════════════════════════
let _elAll = [], _elFiltered = [];
let _elPage = 1, _elPerPage = 25, _elTotalPages = 1, _elTotal = 0;
let _elSortCol = 'createdAt', _elSortDir = -1;
let _elTableQuery = '';

function elInit() {
  _elAll = []; _elFiltered = [];
  _elPage = 1; _elTableQuery = '';
  const tb = document.getElementById('el-tbody');
  if (tb) tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94A3B8">جارٍ التحميل…</td></tr>';
  elSearch(1);
}

function elSearch(page) {
  _elPage = page || 1;
  const dateFrom = (document.getElementById('el-date-from') || {}).value || '';
  const dateTo   = (document.getElementById('el-date-to')   || {}).value || '';
  const actor    = (document.getElementById('el-actor')     || {}).value || '';
  const center   = (document.getElementById('el-center')    || {}).value || '';

  const ps = new URLSearchParams({ page: _elPage, per_page: _elPerPage });
  if (dateFrom) ps.set('date_from', dateFrom);
  if (dateTo)   ps.set('date_to',   dateTo);
  if (actor)    ps.set('actor',     actor);
  if (center)   ps.set('center',    center);

  fetch(`/api/am/audit-log/?${ps.toString()}`, { credentials: 'include' })
    .then(r => r.json())
    .then(d => {
      if (!d.success) { alToast(d.message || 'حدث خطأ', 'error', '✗'); return; }
      _elAll       = d.records || [];
      _elTotal     = d.total   || 0;
      _elTotalPages = d.totalPages || 1;
      _elPage      = d.page    || 1;
      _elFiltered  = [..._elAll];
      elTableSearch();
      const cnt = document.getElementById('sp-count');
      if (cnt) cnt.textContent = `(${_elTotal.toLocaleString()})`;
    })
    .catch(() => alToast('تعذّر الاتصال بالخادم', 'error', '✗'));
}

function elTableSearch(val) {
  if (val !== undefined) _elTableQuery = val;
  else _elTableQuery = (document.getElementById('el-tbl-search') || {}).value || '';
  _elFiltered = _elAll.filter(r => {
    if (!_elTableQuery) return true;
    const q = _elTableQuery.toLowerCase();
    return (
      (r.actor      || '').toLowerCase().includes(q) ||
      (r.target     || '').toLowerCase().includes(q) ||
      (r.actionLabel|| '').toLowerCase().includes(q) ||
      (r.detail     || '').toLowerCase().includes(q) ||
      (r.ip         || '').toLowerCase().includes(q)
    );
  });
  _elPage = 1;
  elRender();
}

function elSort(col) {
  if (_elSortCol === col) _elSortDir = -_elSortDir;
  else { _elSortCol = col; _elSortDir = 1; }
  elRender();
}

function elRender() {
  const tbody = document.getElementById('el-tbody');
  const foot  = document.getElementById('el-foot');
  if (!tbody) return;

  let rows = [..._elFiltered];
  if (_elSortCol) {
    rows.sort((a, b) => {
      const av = a[_elSortCol] || '', bv = b[_elSortCol] || '';
      return String(av).localeCompare(String(bv), 'ar') * _elSortDir;
    });
  }

  const perPage = _elPerPage;
  const maxPage = Math.max(1, Math.ceil(rows.length / perPage));
  _elPage = Math.min(Math.max(1, _elPage), maxPage);
  const slice = rows.slice((_elPage-1)*perPage, _elPage*perPage);

  const si = col => {
    if (_elSortCol !== col) return '<span class="el-si">⇅</span>';
    return _elSortDir === 1 ? '<span class="el-si" style="opacity:1">↑</span>' : '<span class="el-si" style="opacity:1">↓</span>';
  };

  const ACTION_COLORS = {
    'CREATE': '#16A34A', 'UPDATE': '#2563EB', 'DELETE': '#DC2626',
    'LOGIN':  '#0891B2', 'LOGOUT': '#6D28D9', 'APPROVE': '#D97706',
  };

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="sp-empty" style="padding:30px;color:#94A3B8">لا توجد أحداث</td></tr>';
    if (foot) foot.innerHTML = '';
    const infoEl = document.getElementById('el-showing');
    if (infoEl) infoEl.textContent = '';
    return;
  }

  tbody.innerHTML = slice.map((r, i) => {
    const color = ACTION_COLORS[r.action] || '#64748B';
    return `<tr style="${i%2===1?'background:#F8FAFC':''}">
      <td class="el-idx">${(_elPage-1)*perPage+i+1}</td>
      <td class="el-time">${(r.createdAt||'').slice(0,16)}</td>
      <td class="el-actor">${r.actor||'—'} <small style="color:#94A3B8">${r.actorRole||''}</small></td>
      <td class="el-target">${r.target||'—'}</td>
      <td><span class="el-action-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${r.actionLabel||r.action||'—'}</span></td>
      <td class="el-detail">${r.detail||'—'}</td>
      <td class="el-ip">${r.ip||'—'}</td>
      <td class="el-device">—</td>
    </tr>`;
  }).join('');

  const start = (_elPage-1)*perPage + 1;
  const end   = Math.min(_elPage*perPage, rows.length);
  const info  = document.getElementById('el-showing');
  if (info) info.textContent = `عرض ${start}–${end} من ${rows.length}`;

  if (foot) {
    let btns = '';
    const total = Math.max(1, Math.ceil(rows.length / perPage));
    for (let i = 1; i <= Math.min(total, 7); i++) {
      btns += `<button class="sp-page-btn${i===_elPage?' active':''}" onclick="_elPage=${i};elRender()">${i}</button>`;
    }
    if (total > 7) btns += `<span style="padding:0 8px;color:#94A3B8">…${total}</span>`;
    foot.innerHTML = btns;
  }
}

function elExportCsv() {
  if (!_elFiltered.length) { alToast('لا توجد بيانات للتصدير', 'warning', '⚠'); return; }
  const headers = ['#','الوقت','المستخدم','الدور','المركز','نوع الحدث','ملاحظات','IP'];
  const rows = _elFiltered.map((r, i) => [
    i+1,
    r.createdAt||'',
    r.actor||'',
    r.actorRole||'',
    r.target||'',
    r.actionLabel||r.action||'',
    (r.detail||'').replace(/,/g,'؛'),
    r.ip||'',
  ]);
  const csv = '﻿' + [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `events-log-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}
