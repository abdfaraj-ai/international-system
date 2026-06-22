// ===================== BRANCH PAGE DEFINITIONS =====================
const BRANCH_PAGE_DEFS = {
  tellerMgr:    { icon: '👨‍💼', name: 'مشرف التلر',      sub: 'Teller Supervisor',        color: '#5CB85C', rgb: '92,184,92'   },
  tellerDept:   { icon: '💱',   name: 'أقسام التلر',     sub: 'Teller Departments',       color: '#5BC0DE', rgb: '91,192,222'  },
  bankTransfer: { icon: '🏦',   name: 'التحويل البنكي',  sub: 'Bank Transfer',            color: '#F18F01', rgb: '241,143,1'   },
  transSuper:   { icon: '📋',   name: 'مشرف الحوالات',   sub: 'Transactions Supervisor',  color: '#a78bfa', rgb: '167,139,250' },
  transactions: { icon: '🔄',   name: 'الحوالات',        sub: 'Transactions',             color: '#32b8c6', rgb: '50,184,198'  },
};

// ===================== CURRENCY CONFIG =====================
const CURRENCIES = {
  USD: { symbol: '$', name: 'دولار', flag: '🇺🇸', class: 'cur-usd' },
  ILS: { symbol: '₪', name: 'شيكل', flag: '🇵🇸', class: 'cur-ils' },
  JOD: { symbol: 'د.ا', name: 'دينار', flag: '🇯🇴', class: 'cur-jod' }
};

function fmtCur(amount, currency = 'USD') {
  const c = CURRENCIES[currency] || CURRENCIES.USD;
  return c.symbol + Number(amount).toLocaleString('en-US');
}
function curBadge(currency) {
  const c = CURRENCIES[currency] || CURRENCIES.USD;
  return `<span class="cur-badge ${c.class}">${c.flag} ${c.name}</span>`;
}

// ===================== DATA =====================
let state = {
  mainBox: {
    balances: { USD: 0, ILS: 0, JOD: 0 }, // تُملأ من API: GET /api/main-box
    status: 'active'
  },
  branches:     [], // تُملأ من API: GET /api/branches
  transactions: [], // تُملأ من API: GET /api/transactions-unified
  reports:      [], // تُملأ من API: GET /api/reports
};

// ===================== HELPERS =====================
const fmt = (n) => '$' + Number(n).toLocaleString('en-US');
const allSups = () => state.branches.flatMap(b => b.supervisors);
const allTellers = () => state.branches.flatMap(b => b.tellers);
function totalBalance(balObj) {
  return (balObj.USD || 0) + (balObj.ILS || 0) * 0.27 + (balObj.JOD || 0) * 1.41;
}

function notify(msg, type = 'success') {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.style.borderColor = type === 'error' ? '#FF6B7A' : '#5CB85C';
  el.style.color = type === 'error' ? '#FF6B7A' : '#5CB85C';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ===================== CLOCK =====================
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('ar-EG-u-nu-latn',{hour12:false});
  document.getElementById('dateDisplay').textContent = now.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}
setInterval(updateClock, 1000);
updateClock();

// ===================== SIDEBAR TOGGLE =====================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

// ===================== TABS =====================
const TAB_INFO = [
  { icon: '📊', text: 'لوحة التحكم'      },  // 0
  { icon: '🧾', text: 'الحسابات'         },  // 1
  { icon: '🏢', text: 'الفروع'           },  // 2
  { icon: '👥', text: 'المشرفون'         },  // 3
  { icon: '💼', text: 'صناديق التلرات'   },  // 4
  { icon: '🏦', text: 'الخزينة المركزية' },  // 5
  { icon: '📋', text: 'العمليات'         },  // 6
  { icon: '🗂️', text: 'إدارة الصفحات'  },  // 7 → pane-6 (modal)
  { icon: '🎨', text: 'قسم التصميم'     },  // 8 → pane-8
  { icon: '🏛️', text: 'أقسام النظام'   },  // 9 → pane-9
  { icon: '⚙️', text: 'إدارة النظام'   },  // 10 → pane-10
  { icon: '📈', text: 'مركز التقارير'   },  // 11 → pane-11
];

let activeTab = 0;
// Maps logical tab index → tab-pane element ID (for non-sequential pane IDs)
// index يطابق رقم switchTab — pane-6 و pane-7 فارغان (مودالات), pane-8 = قسم التصميم
const TAB_PANE_IDS = {
  0: 'pane-0',
  1: 'pane-1',
  2: 'pane-2-branches',
  3: 'pane-3-sups',
  4: 'pane-4-boxes',
  5: 'pane-5-mainbox',
  6: 'pane-6-tx',
  7: 'pane-6',
  8: 'pane-8',
  9: 'pane-9',
  10: 'pane-10',
  11: 'pane-11',
};

function switchTab(i) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const targetId = TAB_PANE_IDS[i];
  if (targetId) {
    const pane = document.getElementById(targetId);
    if (pane) pane.classList.add('active');
  }
  document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.toggle('active', parseInt(n.dataset.tab) === i));
  activeTab = i;
  // Update header section name
  const info = TAB_INFO[i] || TAB_INFO[0];
  document.querySelector('#header-section-name .sec-icon').textContent = info.icon;
  document.getElementById('header-sec-text').textContent = info.text;
  // Close sidebar on mobile
  if (window.innerWidth <= 960) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }
  navArrowsUpdate(i);
  renderAll();
  if (i === 10) sysSwitch('pages');
  if (i === 11) renderReports();
}

// ===================== NAV ARROWS — أسهم التنقل =====================

// التبويبات القابلة للتنقل عبر الأسهم (فقط ذات pane حقيقي وليس modal)
const NAV_TABS = [0, 9, 1, 2, 3, 4, 5, 6, 8, 10, 11];
// الترتيب: لوحة التحكم ← أقسام النظام ← الحسابات ← الفروع ← المشرفون ← الصناديق ← الخزينة ← العمليات ← التصميم ← إدارة النظام

function navArrowsInit() {
  const dots = document.getElementById('nav-dots');
  if (!dots) return;

  // أنشئ نقطة لكل تبويب
  NAV_TABS.forEach(function(tabIdx) {
    const info = TAB_INFO[tabIdx] || {};
    const dot  = document.createElement('button');
    dot.className      = 'nav-dot';
    dot.dataset.tab    = tabIdx;
    dot.dataset.label  = info.text || '';
    dot.setAttribute('aria-label', info.text || '');
    dot.onclick = function() { switchTab(tabIdx); };
    dots.appendChild(dot);
  });

  navArrowsUpdate(activeTab);

  // أظهر الأسهم بعد لحظة
  setTimeout(function() {
    var el = document.getElementById('nav-arrows');
    if (el) el.classList.remove('nav-hidden');
  }, 600);

  // إخفاء عند scroll لأسفل، إظهار عند scroll لأعلى
  var _lastScroll = 0;
  var _scrollTimer;
  var _mainContent = document.querySelector('.main-content') || document.documentElement;
  function _onScroll() {
    var curr = _mainContent.scrollTop || document.documentElement.scrollTop;
    var el   = document.getElementById('nav-arrows');
    if (!el) return;
    if (curr > _lastScroll + 8) {
      el.classList.add('nav-hidden');
    } else if (curr < _lastScroll - 4) {
      el.classList.remove('nav-hidden');
    }
    _lastScroll = curr;
    clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(function() {
      if (el) el.classList.remove('nav-hidden');
    }, 1200);
  }
  (_mainContent === document.documentElement ? window : _mainContent)
    .addEventListener('scroll', _onScroll, { passive: true });
}

function navArrowsUpdate(tabIdx) {
  // تحديث النقاط
  document.querySelectorAll('.nav-dot').forEach(function(dot) {
    dot.classList.toggle('active', parseInt(dot.dataset.tab) === tabIdx);
  });

  // تحديث النص والأيقونة
  var info = TAB_INFO[tabIdx] || TAB_INFO[0];
  var iconEl = document.getElementById('nav-page-icon');
  var textEl = document.getElementById('nav-page-text');
  if (iconEl) iconEl.textContent = info.icon || '📄';
  if (textEl) textEl.textContent = info.text  || '';

  // تحديث أزرار السهم (تعطيل عند الطرفين)
  var navIdx  = NAV_TABS.indexOf(tabIdx);
  var prevBtn = document.getElementById('nav-prev');
  var nextBtn = document.getElementById('nav-next');
  if (prevBtn) prevBtn.disabled = navIdx <= 0;
  if (nextBtn) nextBtn.disabled = navIdx >= NAV_TABS.length - 1;

  // flash animation
  var bar = document.getElementById('nav-arrows');
  if (bar) {
    bar.classList.remove('nav-switch');
    void bar.offsetWidth; // reflow
    bar.classList.add('nav-switch');
  }
}

function navArrow(dir) {
  var navIdx = NAV_TABS.indexOf(activeTab);
  if (navIdx === -1) navIdx = 0;
  var next = navIdx + dir;
  if (next < 0 || next >= NAV_TABS.length) return;
  switchTab(NAV_TABS[next]);
  // scroll للأعلى بسلاسة
  var main = document.querySelector('.main-content');
  if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
}

// اختصارات لوحة المفاتيح ← →
document.addEventListener('keydown', function(e) {
  // تجاهل إذا كان المستخدم يكتب في input/textarea
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable)) return;
  // تجاهل إذا كان modal مفتوح
  if (document.querySelector('.modal-bg.active, .modal-bg[style*="flex"]')) return;
  if (e.key === 'ArrowRight' && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    navArrow(-1);
  } else if (e.key === 'ArrowLeft' && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    navArrow(1);
  }
});

// تهيئة الأسهم بعد تحميل DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', navArrowsInit);
} else {
  navArrowsInit();
}

// ===================== MODALS =====================
function selectBmCur(el, val) {
  document.querySelectorAll('.bm-cur-opt').forEach(o => o.classList.remove('bm-cur-sel'));
  el.classList.add('bm-cur-sel');
  document.getElementById('b-currency').value = val;
}

function initBranchPageSelector() {
  const grid = document.getElementById('bmPagesGrid');
  if (!grid) return;
  grid.innerHTML = Object.entries(BRANCH_PAGE_DEFS).map(([key, def]) => `
    <div class="bm-ps-card selected" data-page-key="${key}" style="--bpc:${def.color};--bpcrgb:${def.rgb}"
         onclick="this.classList.toggle('selected')">
      <div class="bm-ps-card-icon">${def.icon}</div>
      <div class="bm-ps-card-name">${def.name}</div>
      <div class="bm-ps-check">✓</div>
    </div>`).join('');
}

function openModal(id) {
  if (id === 'branch-modal') {
    document.getElementById('b-available-label').textContent =
      'متاح: ' + fmt(state.mainBox.balances.USD) + ' | ' +
      fmtCur(state.mainBox.balances.ILS,'ILS') + ' | ' +
      fmtCur(state.mainBox.balances.JOD,'JOD');
    // Reset currency selector to USD
    document.getElementById('b-currency').value = 'USD';
    document.querySelectorAll('.bm-cur-opt').forEach(o => o.classList.remove('bm-cur-sel'));
    const usdOpt = document.querySelector('.bm-cur-opt[data-val="USD"]');
    if (usdOpt) usdOpt.classList.add('bm-cur-sel');
    initBranchPageSelector();
  }
  if (id === 'add-box-modal') {
    const sel = document.getElementById('ab-branch');
    sel.innerHTML = state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    abLoadSups();
  }
  if (id === 'supervisor-modal') {
    const sel = document.getElementById('s-branch');
    sel.innerHTML = state.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
  if (id === 'transfer-modal') {
    document.getElementById('transfer-available-label').innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
        <span class="cur-badge cur-usd">${fmtCur(state.mainBox.balances.USD,'USD')}</span>
        <span class="cur-badge cur-ils">${fmtCur(state.mainBox.balances.ILS,'ILS')}</span>
        <span class="cur-badge cur-jod">${fmtCur(state.mainBox.balances.JOD,'JOD')}</span>
      </div>`;
    const sel = document.getElementById('t-branch');
    const nonMain = state.branches.filter(b => !b.isMain);
    sel.innerHTML = `<option value="">-- اختر الفرع --</option>` + nonMain.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    if (nonMain.length === 0) sel.innerHTML += `<option disabled>لا توجد فروع أخرى - أضف فرعاً أولاً</option>`;
  }
  document.getElementById(id).classList.add('open');
  // Re-trigger animation on bm-shell if present
  if (id === 'branch-modal') {
    const shell = document.querySelector('#branch-modal .bm-shell');
    if (shell) { shell.style.animation = 'none'; shell.offsetHeight; shell.style.animation = ''; }
  }
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeModalOutside(e, id) { if (e.target === document.getElementById(id)) closeModal(id); }

// ── Dashboard Slide Modals ────────────────────────────
function openDashModal(id) {
  // Close any open dashboard modal first
  document.querySelectorAll('.dm-overlay.open').forEach(el => el.classList.remove('open'));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Trigger render for the relevant section
  if (id === 'dm-users')           { renderUsersTable(); renderActiveSessions(); }
  if (id === 'dm-perms')           { loadPermissionsFromServer().then(() => renderActiveSessions()); }
  if (id === 'dm-reports')         { switchTab(11); return; } // redirects to full page
  if (id === 'dm-portal-receipts') { renderPortalReceipts(); }
  if (id === 'dm-portal-settings') { renderPortalSettings(); }
}

function closeDashModal(id) {
  const el = id ? document.getElementById(id) : null;
  if (el) {
    el.classList.remove('open');
  } else {
    document.querySelectorAll('.dm-overlay.open').forEach(e => e.classList.remove('open'));
  }
  document.body.style.overflow = '';
}

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('pdm-overlay')?.classList.contains('pdm-open')) {
      closePdModal();
    } else {
      closeDashModal();
    }
  }
});

// ===================== ACTIONS =====================
async function addBranch() {
  const name = document.getElementById('b-name').value.trim();
  const loc = document.getElementById('b-loc').value.trim();
  const cur = document.getElementById('b-currency').value;
  const bal = Number(document.getElementById('b-balance').value) || 0;
  if (!name || !loc) return notify('يرجى ملء جميع الحقول', 'error');
  if (bal > (state.mainBox.balances[cur]||0)) return notify('رصيد الصندوق الرئيسي غير كافٍ', 'error');
  // Read selected pages from selector
  const selectedPages = {};
  document.querySelectorAll('#bmPagesGrid .bm-ps-card.selected').forEach(card => {
    const key = card.dataset.pageKey;
    if (key) selectedPages[key] = { active: true, features: {1:true,2:true,3:true,4:true} };
  });
  // Fallback: if nothing selected, include all
  const pages = Object.keys(selectedPages).length > 0 ? selectedPages : {
    tellerMgr:    { active: true, features: {1:true,2:true,3:true,4:true} },
    tellerDept:   { active: true, features: {1:true,2:true,3:true,4:true} },
    bankTransfer: { active: true, features: {1:true,2:true,3:true,4:true} }
  };
  // إرسال للخادم — apiBranchCreate تستدعي initDashboard ثم renderAll تلقائياً
  const resp = await apiBranchCreate(name, loc, cur, bal).catch(() => null);
  if (resp && !resp.success) return notify(resp.message || 'فشل إنشاء الفرع', 'error');

  document.getElementById('b-name').value = '';
  document.getElementById('b-loc').value = '';
  document.getElementById('b-balance').value = '';
  closeModal('branch-modal');
  notify('تم إنشاء ' + name + ' بنجاح');
}

function addSupervisor() {
  const name  = document.getElementById('s-name').value.trim();
  const phone = document.getElementById('s-phone').value.trim();
  const type  = document.getElementById('s-type').value;  // 'teller' | 'transfers'
  const shift = document.getElementById('s-shift').value;

  if (!name || !phone) return notify('يرجى ملء جميع الحقول المطلوبة', 'error');

  if (type === 'transfers') {
    // مشرف حوالات → يُحفظ في intl_sv_supervisors
    const list = getTransfersSupervisors();
    const sup  = {
      id:        Date.now(),
      name,
      phone,
      shift,
      type:      'transfers',
      status:    'active',
      createdAt: new Date().toISOString()
    };
    list.push(sup);
    saveTransfersSupervisors(list);
    // حفظ الاسم ليظهر في صفحة transactions-supervisor
    const existing = localStorage.getItem('supervisorName');
    if (!existing) localStorage.setItem('supervisorName', name);
  } else {
    // مشرف تلر → يُحفظ في state.branches
    const branchId = Number(document.getElementById('s-branch').value);
    const sup = { id: allSups().length + 1, name, phone, shift, branchId, type: 'teller', status: 'active' };
    state.branches = state.branches.map(b => b.id === branchId ? { ...b, supervisors: [...b.supervisors, sup] } : b);
  }

  document.getElementById('s-name').value  = '';
  document.getElementById('s-phone').value = '';
  closeModal('supervisor-modal');
  notify('تم إضافة المشرف بنجاح');
  renderAll();
  renderSupervisors();
}

function toggleSupervisorStatus(supId) {
  // Check teller supervisors first
  let found = false;
  state.branches = state.branches.map(b => ({
    ...b,
    supervisors: b.supervisors.map(s => {
      if (s.id === supId) { found = true; return { ...s, status: s.status === 'active' ? 'inactive' : 'active' }; }
      return s;
    })
  }));
  if (!found) {
    // Check transfers supervisors
    const list = getTransfersSupervisors().map(s =>
      s.id === supId ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s
    );
    saveTransfersSupervisors(list);
  }
  notify('تم تحديث حالة المشرف');
  renderAll();
  renderSupervisors();
}

function toggleBoxStatus(boxId) {
  state.branches = state.branches.map(b => ({
    ...b,
    tellers: b.tellers.map(t => t.box.id === boxId ? { ...t, box: { ...t.box, status: t.box.status === 'open' ? 'closed' : 'open' } } : t)
  }));
  notify('تم تحديث حالة الصندوق');
  renderAll();
}

async function doTransfer() {
  const amt = Number(document.getElementById('t-amount').value);
  const branchId = Number(document.getElementById('t-branch').value);
  const cur = document.getElementById('t-currency').value;
  const notes = (document.getElementById('t-note') || {}).value || '';
  if (!amt || amt <= 0) return notify('أدخل مبلغاً صحيحاً', 'error');
  if (!branchId) return notify('اختر الفرع المستقبل', 'error');
  if ((state.mainBox.balances[cur]||0) < amt) return notify('رصيد الصندوق الرئيسي غير كافٍ بهذه العملة', 'error');
  const toName = state.branches.find(b => b.id === branchId)?.name || '';

  // إرسال للخادم
  const resp = await apiBranchTransfer(branchId, amt, cur, notes).catch(() => null);
  if (resp && !resp.success) return notify(resp.message || 'فشل التحويل', 'error');

  // تحديث محلي
  state.mainBox.balances[cur] -= amt;
  state.branches = state.branches.map(b => b.id === branchId ? { ...b, balances: { ...b.balances, [cur]: (b.balances[cur]||0) + amt } } : b);
  state.transactions.push({ id: state.transactions.length + 1, type: 'تحويل بين فروع', from: 'صندوق رئيسي', to: toName, amount: amt, currency: cur, date: new Date().toLocaleString('ar'), status: 'completed' });
  document.getElementById('t-amount').value = '';
  if (document.getElementById('t-note')) document.getElementById('t-note').value = '';
  closeModal('transfer-modal');
  notify('تم التحويل بنجاح');
  renderAll();
}

// ════════════════════════════════════════════════════
//  إضافة رصيد للخزينة المركزية
// ════════════════════════════════════════════════════

function openDepositModal() {
  const mb = state.mainBox.balances;
  document.getElementById('deposit-current-label').innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px">
      <span class="cur-badge cur-usd">${fmtCur(mb.USD,'USD')}</span>
      <span class="cur-badge cur-ils">${fmtCur(mb.ILS,'ILS')}</span>
      <span class="cur-badge cur-jod">${fmtCur(mb.JOD,'JOD')}</span>
    </div><div class="fs-12 text-muted">الرصيد الحالي للخزينة</div>`;
  document.getElementById('dep-amount').value = '';
  document.getElementById('dep-note').value = '';
  openModal('deposit-modal');
}

async function doDeposit() {
  const amt = Number(document.getElementById('dep-amount').value);
  const cur = document.getElementById('dep-currency').value;
  const note = document.getElementById('dep-note').value.trim();
  if (!amt || amt <= 0) return notify('أدخل مبلغاً صحيحاً', 'error');

  const resp = await apiMainBoxDeposit(amt, cur, note).catch(() => null);
  if (resp && !resp.success) return notify(resp.message || 'فشلت العملية', 'error');

  state.mainBox.balances[cur] = (state.mainBox.balances[cur] || 0) + amt;
  state.transactions.push({
    id: state.transactions.length + 1,
    type: 'إيداع خزينة', from: 'خارجي', to: 'الخزينة المركزية',
    amount: amt, currency: cur,
    date: new Date().toLocaleString('ar-EG-u-nu-latn'), status: 'completed'
  });
  closeModal('deposit-modal');
  notify(`تم إضافة ${fmtCur(amt, cur)} للخزينة`);
  renderAll();
}

// ════════════════════════════════════════════════════
//  توزيع رصيد على التلرات
// ════════════════════════════════════════════════════

function openDistributeModal() {
  const mb = state.mainBox.balances;
  document.getElementById('dist-available-label').innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px">
      <span class="cur-badge cur-usd">${fmtCur(mb.USD,'USD')}</span>
      <span class="cur-badge cur-ils">${fmtCur(mb.ILS,'ILS')}</span>
      <span class="cur-badge cur-jod">${fmtCur(mb.JOD,'JOD')}</span>
    </div><div class="fs-12 text-muted">الرصيد المتاح في الخزينة</div>`;
  openModal('distribute-modal');
  renderDistTellers();
}

function renderDistTellers() {
  const tellers = allTellers();
  const cur = document.getElementById('dist-currency').value;
  const container = document.getElementById('dist-tellers-list');
  if (!tellers.length) {
    container.innerHTML = '<div class="fs-13 text-muted" style="text-align:center;padding:20px">لا يوجد تلرات مسجلة</div>';
    return;
  }
  container.innerHTML = tellers.map(t => {
    const branch = state.branches.find(b => (b.tellers||[]).some(tt => tt.id === t.id));
    return `
      <div style="display:grid;grid-template-columns:1fr auto 120px;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border-card)">
        <div>
          <div class="fs-13 fw-700">${t.name}</div>
          <div class="fs-11 text-muted">${branch ? branch.name : ''}</div>
        </div>
        <div class="fs-12 text-muted">رصيد: <span style="color:var(--text-primary)">${fmtCur((t.balances||{})[cur]||0, cur)}</span></div>
        <input type="number" class="input-field dist-amount-inp" data-teller-id="${t.id}" placeholder="0" min="0" style="padding:6px 8px;font-size:13px" />
      </div>`;
  }).join('');
}

async function doDistribute() {
  const cur = document.getElementById('dist-currency').value;
  const inputs = document.querySelectorAll('.dist-amount-inp');
  const distributions = [];
  let total = 0;
  inputs.forEach(inp => {
    const amt = Number(inp.value);
    if (amt > 0) { distributions.push({ tellerId: Number(inp.dataset.tellerId), amount: amt, currency: cur }); total += amt; }
  });
  if (!distributions.length) return notify('أدخل مبلغاً لصندوق واحد على الأقل', 'error');
  if (total > (state.mainBox.balances[cur] || 0)) return notify('الإجمالي يتجاوز رصيد الخزينة', 'error');

  const resp = await apiDistributeToTellers(distributions).catch(() => null);
  if (resp && !resp.success) return notify(resp.message || 'فشلت العملية', 'error');

  // تحديث محلي
  state.mainBox.balances[cur] -= total;
  distributions.forEach(d => {
    state.branches = state.branches.map(b => ({
      ...b,
      tellers: (b.tellers || []).map(t => t.id === d.tellerId
        ? { ...t, balances: { ...(t.balances||{}), [cur]: ((t.balances||{})[cur]||0) + d.amount } }
        : t)
    }));
  });
  state.transactions.push({
    id: state.transactions.length + 1,
    type: 'توزيع تلرات', from: 'الخزينة المركزية', to: `${distributions.length} صندوق`,
    amount: total, currency: cur,
    date: new Date().toLocaleString('ar-EG-u-nu-latn'), status: 'completed'
  });
  closeModal('distribute-modal');
  notify(`تم توزيع ${fmtCur(total, cur)} على ${distributions.length} صندوق`);
  renderAll();
}

// ════════════════════════════════════════════════════
//  إغلاق اليوم — إرجاع أرصدة التلرات للخزينة
// ════════════════════════════════════════════════════

function openEndOfDayModal() {
  const tellers = allTellers();
  const totals = { USD: 0, ILS: 0, JOD: 0 };
  tellers.forEach(t => {
    Object.keys(totals).forEach(cur => { totals[cur] += (t.balances || {})[cur] || 0; });
  });
  const hasBalance = Object.values(totals).some(v => v > 0);
  document.getElementById('eod-summary').innerHTML = hasBalance
    ? `<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:4px">
        ${totals.USD ? `<span class="cur-badge cur-usd">${fmtCur(totals.USD,'USD')}</span>` : ''}
        ${totals.ILS ? `<span class="cur-badge cur-ils">${fmtCur(totals.ILS,'ILS')}</span>` : ''}
        ${totals.JOD ? `<span class="cur-badge cur-jod">${fmtCur(totals.JOD,'JOD')}</span>` : ''}
      </div><div class="fs-12 text-muted">إجمالي الأرصدة المرتجعة من ${tellers.length} تلر</div>`
    : '<div class="fs-13 text-muted">لا توجد أرصدة لدى التلرات حالياً</div>';
  openModal('endofday-modal');
}

async function doEndOfDay() {
  const tellers = allTellers();
  const totals = { USD: 0, ILS: 0, JOD: 0 };
  tellers.forEach(t => {
    Object.keys(totals).forEach(cur => { totals[cur] += (t.balances || {})[cur] || 0; });
  });

  const resp = await apiEndOfDay().catch(() => null);
  if (resp && !resp.success) return notify(resp.message || 'فشلت العملية', 'error');

  // إرجاع الأرصدة للخزينة محلياً
  Object.keys(totals).forEach(cur => { state.mainBox.balances[cur] = (state.mainBox.balances[cur] || 0) + totals[cur]; });
  // تصفير أرصدة التلرات
  state.branches = state.branches.map(b => ({
    ...b,
    tellers: (b.tellers || []).map(t => ({ ...t, balances: { USD: 0, ILS: 0, JOD: 0 } }))
  }));
  const returned = Object.entries(totals).filter(([,v]) => v > 0).map(([c,v]) => fmtCur(v,c)).join(' | ');
  state.transactions.push({
    id: state.transactions.length + 1,
    type: 'إغلاق يومي', from: 'صناديق التلرات', to: 'الخزينة المركزية',
    amount: totals.USD, currency: 'USD',
    date: new Date().toLocaleString('ar-EG-u-nu-latn'), status: 'completed'
  });
  closeModal('endofday-modal');
  notify(returned ? `تم إغلاق اليوم — أُرجع: ${returned}` : 'تم إغلاق اليوم');
  renderAll();
}

// ════════════════════════════════════════════════════
//  إضافة صندوق — Add Box
// ════════════════════════════════════════════════════

function abLoadSups() {
  const branchId = Number(document.getElementById('ab-branch').value);
  const b = state.branches.find(b => b.id === branchId);
  const sel = document.getElementById('ab-sup');
  if (!b) { sel.innerHTML = '<option value="">لا يوجد</option>'; return; }
  sel.innerHTML = `<option value="">بدون مشرف</option>` +
    (b.supervisors || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function addBox() {
  const name    = document.getElementById('ab-name').value.trim();
  const bid     = Number(document.getElementById('ab-branch').value);
  const supId   = Number(document.getElementById('ab-sup').value) || null;
  const cur     = document.getElementById('ab-currency').value;
  const bal     = Number(document.getElementById('ab-balance').value) || 0;
  const limit   = Number(document.getElementById('ab-limit').value) || 50000;

  if (!name) return notify('يرجى إدخال اسم التلر', 'error');
  const b = state.branches.find(b => b.id === bid);
  if (!b) return notify('اختر فرعاً صحيحاً', 'error');

  const newId   = Date.now();
  const boxId   = allTellers().length + 1;
  b.tellers.push({
    id: newId, name, supervisorId: supId, branchId: bid,
    box: { id: boxId, balance: bal, currency: cur, status: 'open', dailyLimit: limit }
  });

  // Clear fields
  ['ab-name','ab-balance','ab-limit'].forEach(id => document.getElementById(id).value = '');
  closeModal('add-box-modal');
  notify('تم إنشاء صندوق ' + name + ' بنجاح');
  renderAll();
}

// ════════════════════════════════════════════════════════════════
//  نظام إدارة الصفحات — Pages Admin Control Panel
// ════════════════════════════════════════════════════════════════

const SYSTEM_PAGES_DEF = {
  tellerMgr:    { icon: '👨‍💼', name: 'مشرف التلر',     sub: 'Teller Supervisor',       color: '#5CB85C', rgb: '92,184,92',   href: '/supervisor/teller/',         role: 'M02', roleColor: '#5CB85C', desc: 'إدارة المشرفين وصناديق التلرات ومتابعة العمليات اليومية' },
  tellerDept:   { icon: '💱',   name: 'أقسام التلر',    sub: 'Teller Departments',      color: '#5BC0DE', rgb: '91,192,222',  href: '/teller/',                    role: 'T01', roleColor: '#5BC0DE', desc: 'واجهة التلر للصرافة والإيداع والسحب والتحويل النقدي' },
  bankTransfer: { icon: '🏦',   name: 'التحويل البنكي', sub: 'Bank Transfer',           color: '#F18F01', rgb: '241,143,1',   href: '/accounts/',                  role: 'T02', roleColor: '#F18F01', desc: 'إدارة حسابات التحويل البنكي والعمليات المصرفية الداخلية' },
  transSuper:   { icon: '📋',   name: 'مشرف الحوالات',  sub: 'Transactions Supervisor', color: '#a78bfa', rgb: '167,139,250', href: '/transactions/supervisor/',   role: 'M03', roleColor: '#a78bfa', desc: 'لوحة مشرف الحوالات — متابعة الوكلاء والحوالات الخارجية' },
  transactions: { icon: '🔄',   name: 'الحوالات',       sub: 'Transactions',            color: '#32b8c6', rgb: '50,184,198',  href: '/transactions/',              role: 'T03', roleColor: '#32b8c6', desc: 'نظام إدارة الحوالات الخارجية وتتبع الوكلاء والعمليات' },
};

let _paEdit = null, _spaFilter = 'all', _spaMatOpen = true;

function renderPagesAdmin() {
  const kpisEl   = document.getElementById('spa-kpis');
  const gridEl   = document.getElementById('spa-pages-grid');
  const brListEl = document.getElementById('spa-branches-list');
  const matrixEl = document.getElementById('pa-matrix');
  if (!kpisEl || !gridEl || !brListEl || !matrixEl) return;
  const branches = state.branches;
  const pageKeys = Object.keys(SYSTEM_PAGES_DEF);
  let totalActive = 0, totalAssigned = 0;
  branches.forEach(b => {
    if (!b.pages) return;
    Object.values(b.pages).forEach(p => { totalAssigned++; if (p.active !== false) totalActive++; });
  });
  const coverage = totalAssigned > 0 ? Math.round(totalActive / totalAssigned * 100) : 0;
  kpisEl.innerHTML = [
    { icon: '🏢', val: branches.length, lbl: 'فرع نشط',      c: '#32b8c6' },
    { icon: '📄', val: pageKeys.length, lbl: 'نوع صفحة',     c: '#a78bfa' },
    { icon: '✅', val: totalActive,     lbl: 'صفحة فعّالة',  c: '#22c55e' },
    { icon: '📊', val: coverage + '%',  lbl: 'نسبة التغطية', c: '#e8c04a' },
  ].map(k => `<div class="spa-kpi" style="--kc:${k.c}"><div class="spa-kpi-icon">${k.icon}</div><div class="spa-kpi-val">${k.val}</div><div class="spa-kpi-lbl">${k.lbl}</div></div>`).join('');

  gridEl.innerHTML = pageKeys.map(key => {
    const def   = SYSTEM_PAGES_DEF[key];
    const count = branches.filter(b => b.pages && b.pages[key] && b.pages[key].active !== false).length;
    const pct   = branches.length ? Math.round(count / branches.length * 100) : 0;
    return '<div class="spa-page-card" style="--bpc:' + def.color + ';--bpcrgb:' + def.rgb + '" onclick="window.open(\'' + def.href + '\',\'_blank\')">'
      + '<div class="spa-pc-glow"></div><div class="spa-pc-topbar"></div>'
      + '<div class="spa-pc-head"><div class="spa-pc-icon-wrap"><span class="spa-pc-icon">' + def.icon + '</span></div>'
      + '<div class="spa-pc-head-info"><div class="spa-pc-name">' + def.name + '</div><div class="spa-pc-sub">' + def.sub + '</div>'
      + '<span class="spa-pc-role" style="color:' + def.roleColor + ';border-color:' + def.roleColor + '44;background:' + def.roleColor + '14">' + def.role + '</span></div>'
      + '<span class="pa-cell-dot dot-on" style="width:9px;height:9px;flex-shrink:0;margin-top:4px"></span></div>'
      + '<div class="spa-pc-desc">' + def.desc + '</div>'
      + '<div class="spa-pc-coverage"><div class="spa-pc-cov-bar"><div class="spa-pc-cov-fill" style="width:' + pct + '%"></div></div>'
      + '<div class="spa-pc-cov-lbl">' + count + '/' + branches.length + ' فرع · ' + pct + '%</div></div>'
      + '<div class="spa-pc-foot"><button class="spa-pc-manage" onclick="event.stopPropagation();spaScrollToBranch()">إدارة</button>'
      + '<div class="spa-pc-open">فتح الصفحة <span>←</span></div></div></div>';
  }).join('');

  let filtered = branches;
  if (_spaFilter === 'active')     filtered = branches.filter(b => b.pages && Object.values(b.pages).some(p => p.active !== false));
  if (_spaFilter === 'incomplete') filtered = branches.filter(b => !b.pages || Object.keys(b.pages).length < pageKeys.length);
  brListEl.innerHTML = filtered.length === 0
    ? '<div class="spa-empty">لا توجد فروع تطابق الفلتر</div>'
    : filtered.map(b => {
        const bPages  = b.pages || {};
        const active  = Object.values(bPages).filter(p => p.active !== false).length;
        const missing = pageKeys.filter(k => !bPages[k]);
        const addChips = missing.map(k => {
          const d = SYSTEM_PAGES_DEF[k];
          return '<button class="spa-add-chip" style="--bpc:' + d.color + ';--bpcrgb:' + d.rgb + '" onclick="paAddPage(' + b.id + ',\'' + k + '\')">' + d.icon + ' ' + d.name + '</button>';
        }).join('');
        const pageChips = pageKeys.map(key => {
          const def = SYSTEM_PAGES_DEF[key], pg = bPages[key], has = !!pg, on = has && pg.active !== false;
          const clickAct = has ? 'paTogglePage(' + b.id + ',\'' + key + '\')' : 'paAddPage(' + b.id + ',\'' + key + '\')';
          const delBtn = has ? '<button class="spc-del" onclick="event.stopPropagation();paDeletePage(' + b.id + ',\'' + key + '\')" title="حذف">✕</button>' : '<span class="spc-plus">+</span>';
          return '<div class="spa-pg-chip ' + (has ? (on ? 'spc-on' : 'spc-off') : 'spc-none') + '" style="--bpc:' + def.color + ';--bpcrgb:' + def.rgb + '" onclick="' + clickAct + '">'
            + '<span class="spc-icon">' + def.icon + '</span>'
            + '<div class="spc-body"><div class="spc-name">' + def.name + '</div><div class="spc-status">' + (has ? (on ? 'نشط' : 'معطّل') : 'غير مضاف') + '</div></div>'
            + delBtn + '</div>';
        }).join('');
        const isMain = b.isMain ? '<span class="pa-mx-main" style="margin-right:8px">رئيسي</span>' : '';
        return '<div class="spa-branch-row" id="spa-br-' + b.id + '">'
          + '<div class="spa-br-hd"><div class="spa-br-hd-left">'
          + '<span class="pa-cell-dot ' + (b.status === 'active' ? 'dot-on' : 'dot-off') + '" style="width:9px;height:9px;flex-shrink:0"></span>'
          + '<div class="spa-br-name">' + b.name + isMain + '</div>'
          + '<div class="spa-br-count"><span style="color:#22c55e">' + active + '</span>/' + pageKeys.length + ' صفحة</div></div>'
          + '<div class="spa-br-hd-right">' + addChips + '</div></div>'
          + '<div class="spa-br-pages">' + pageChips + '</div></div>';
      }).join('');

  let mx = '<div class="pa-mx-grid" style="grid-template-columns:minmax(140px,1.4fr) ' + pageKeys.map(() => '1fr').join(' ') + '">'
    + '<div class="pa-mx-corner">الفرع</div>'
    + pageKeys.map(key => { const d = SYSTEM_PAGES_DEF[key]; return '<div class="pa-mx-col-hd" style="--bpc:' + d.color + '"><span>' + d.icon + '</span>' + d.name + '</div>'; }).join('');
  branches.forEach(b => {
    const isMain = b.isMain ? '<span class="pa-mx-main">رئيسي</span>' : '';
    mx += '<div class="pa-mx-row-hd"><span class="pa-cell-dot ' + (b.status === 'active' ? 'dot-on' : 'dot-off') + '"></span>' + b.name + isMain + '</div>';
    pageKeys.forEach(key => {
      const def = SYSTEM_PAGES_DEF[key], pg = b.pages && b.pages[key], has = !!pg, on = has && pg.active !== false;
      const inner = has
        ? '<span class="pa-cell-dot ' + (on ? 'dot-on' : 'dot-off') + '"></span><span class="pa-cell-lbl">' + (on ? 'نشط' : 'معطّل') + '</span><button class="pa-cell-edit" onclick="event.stopPropagation();openPaEdit(' + b.id + ',\'' + key + '\')">⚙</button>'
        : '<button class="pa-cell-add" onclick="event.stopPropagation();paAddPage(' + b.id + ',\'' + key + '\')">+ إضافة</button>';
      mx += '<div class="pa-mx-cell ' + (has ? (on ? 'cell-on' : 'cell-off') : 'cell-none') + '" style="--bpc:' + def.color + ';--bpcrgb:' + def.rgb + '" onclick="paTogglePage(' + b.id + ',\'' + key + '\')">' + inner + '</div>';
    });
  });
  matrixEl.innerHTML = mx + '</div>';

  const mw = document.getElementById('spa-matrix-wrap');
  if (mw) mw.style.display = _spaMatOpen ? 'block' : 'none';
}

function spaSetFilter(btn, filter) {
  _spaFilter = filter;
  document.querySelectorAll('.spa-filter-btn').forEach(b => b.classList.remove('spa-filter-active'));
  btn.classList.add('spa-filter-active');
  renderPagesAdmin();
}
function spaToggleMatrix() {
  _spaMatOpen = !_spaMatOpen;
  const mw = document.getElementById('spa-matrix-wrap'), ar = document.getElementById('spa-mt-arrow');
  if (mw) mw.style.display = _spaMatOpen ? 'block' : 'none';
  if (ar) ar.textContent = _spaMatOpen ? '▲' : '▼';
}
function spaScrollToBranch() {
  const el = document.getElementById('spa-branches-list');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════════════════════════════════════
//  REPORTS CENTER — Tab 7
// ═══════════════════════════════════════════════════════════════
const RPT_SRC = {
  tellerMgr:    { icon: '👨‍💼', name: 'مشرف التلر',     color: '#5CB85C', rgb: '92,184,92'   },
  tellerDept:   { icon: '💱',   name: 'أقسام التلر',    color: '#5BC0DE', rgb: '91,192,222'  },
  bankTransfer: { icon: '🏦',   name: 'التحويل البنكي', color: '#F18F01', rgb: '241,143,1'   },
  transSuper:   { icon: '📋',   name: 'مشرف الحوالات',  color: '#a78bfa', rgb: '167,139,250' },
  transactions: { icon: '🔄',   name: 'الحوالات',       color: '#32b8c6', rgb: '50,184,198'  },
};

const FILE_ICONS  = { pdf: '📄', excel: '📊', xlsx: '📊', image: '🖼️', doc: '📝', word: '📝', zip: '📦' };
const FILE_COLORS = { pdf: '#f87171', excel: '#4ade80', xlsx: '#4ade80', image: '#a78bfa', doc: '#60a5fa', zip: '#fbbf24' };

// ── Reports state ──────────────────────────────────────
let _rptTypeFilter     = '';
let _rptBranchFilter   = '';
let _rptFileTypeFilter = '';
let _rptView           = 'list'; // 'list' | 'grid'

function rptTypeFilter(val, el) {
  _rptTypeFilter = val;
  document.querySelectorAll('#rpt-type-list .rp-filter-item').forEach(e => e.classList.remove('active'));
  if (el) el.classList.add('active');
  renderReports();
}
function rptBranchFilter(val, el) {
  _rptBranchFilter = val;
  el.closest('.rp-filter-list').querySelectorAll('.rp-filter-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  renderReports();
}
function rptFileTypeFilter(val, el) {
  _rptFileTypeFilter = val;
  el.closest('.rp-filter-list').querySelectorAll('.rp-filter-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  renderReports();
}
function rptSetView(v, btn) {
  _rptView = v;
  document.querySelectorAll('.rp-view-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const body = document.getElementById('rpt-list');
  if (body) body.className = 'rp-body ' + (_rptView === 'grid' ? 'rp-body-grid' : 'rp-body-list');
  renderReports();
}

function renderReports() {
  const kpisEl = document.getElementById('rpt-kpis');
  const listEl = document.getElementById('rpt-list');
  if (!listEl) return;

  const reports = state.reports;
  const today   = new Date().toISOString().slice(0, 10);

  // ── Populate branch filter sidebar ──
  const brList = document.getElementById('rpt-branch-list');
  if (brList && brList.children.length === 1 && state.branches.length) {
    state.branches.forEach(b => {
      const d = document.createElement('div');
      d.className = 'rp-filter-item';
      d.dataset.val = b.id;
      d.innerHTML = `<span class="rp-fi-dot" style="background:#32b8c6"></span> ${b.name}`;
      d.onclick = function() { rptBranchFilter(String(b.id), d); };
      brList.appendChild(d);
    });
  }

  // ── KPI cards ──
  if (kpisEl) {
    const todayCount = reports.filter(r => r.date.startsWith(today)).length;
    const deptSet    = new Set(reports.map(r => r.source));
    const brSet      = new Set(reports.map(r => r.branchId));
    kpisEl.innerHTML = [
      { val: reports.length, lbl: 'إجمالي الملفات', color: '#38bdf8', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>` },
      { val: todayCount,     lbl: 'ملفات اليوم',    color: '#fbbf24', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
      { val: deptSet.size,   lbl: 'أقسام مُرسِلة',  color: '#a78bfa', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>` },
      { val: brSet.size,     lbl: 'فروع مُرسِلة',   color: '#4ade80', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` },
    ].map(k => `
      <div class="rp-kpi-card" style="--rk:${k.color}">
        <div class="rp-kpi-icon" style="color:${k.color}">${k.icon}</div>
        <div class="rp-kpi-val">${k.val}</div>
        <div class="rp-kpi-lbl">${k.lbl}</div>
      </div>`).join('');
  }

  // ── Apply filters ──
  const q = (document.getElementById('rpt-search') || {}).value?.trim().toLowerCase() || '';
  let filtered = reports.filter(r => {
    if (_rptTypeFilter     && r.source   !== _rptTypeFilter)                   return false;
    if (_rptBranchFilter   && String(r.branchId) !== _rptBranchFilter)         return false;
    if (_rptFileTypeFilter && (r.fileType || 'pdf').toLowerCase() !== _rptFileTypeFilter) return false;
    if (q && !r.title.toLowerCase().includes(q)
          && !(r.sender || '').toLowerCase().includes(q)
          && !r.branch.toLowerCase().includes(q)
          && !(r.fileName || '').toLowerCase().includes(q)) return false;
    return true;
  });

  // ── Sort ──
  const sort = (document.getElementById('rpt-sort') || {}).value || 'date-desc';
  if (sort === 'date-desc') filtered.sort((a, b) => b.date.localeCompare(a.date));
  else if (sort === 'date-asc') filtered.sort((a, b) => a.date.localeCompare(b.date));
  else filtered.sort((a, b) => a.title.localeCompare(b.title, 'ar'));

  // update total
  const totalEl = document.getElementById('rpt-total-count');
  if (totalEl) totalEl.textContent = filtered.length;

  // update badge
  const badge = document.getElementById('sb-reports');
  if (badge) badge.textContent = reports.length;

  listEl.className = 'rp-body ' + (_rptView === 'grid' ? 'rp-body-grid' : 'rp-body-list');

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="rp-empty">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <div class="rp-empty-title">لا توجد ملفات</div>
        <div class="rp-empty-sub">جرّب تغيير معايير البحث أو الفلتر</div>
      </div>`;
    return;
  }

  // ── Group by date ──
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const dateLabels = { [today]: 'اليوم', [yest.toISOString().slice(0,10)]: 'أمس' };
  const grouped = {};
  filtered.forEach(r => {
    const d = r.date.slice(0, 10);
    (grouped[d] = grouped[d] || []).push(r);
  });

  const FILE_SVG = {
    pdf:   { svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`, color: '#f87171' },
    excel: { svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`, color: '#4ade80' },
    xlsx:  { svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`, color: '#4ade80' },
    image: { svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`, color: '#a78bfa' },
    doc:   { svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`, color: '#60a5fa' },
  };

  let html = '';
  Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(d => {
    const lbl = dateLabels[d] || new Date(d + 'T12:00').toLocaleDateString('ar-PS', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    html += `<div class="rp-date-hd"><span class="rp-date-hd-line"></span><span class="rp-date-hd-txt">${lbl}</span><span class="rp-date-hd-line"></span></div>`;

    grouped[d].forEach(r => {
      const src      = RPT_SRC[r.source] || { icon: '📄', name: r.source, color: '#64748b' };
      const ft       = (r.fileType || 'pdf').toLowerCase();
      const fInfo    = FILE_SVG[ft] || FILE_SVG.doc;
      const fileName = r.fileName || (r.title + '.pdf');
      const timeStr  = r.date.length > 10 ? r.date.slice(11, 16) : '';

      if (_rptView === 'grid') {
        html += `
          <div class="rp-card" style="--rpc:${src.color};--rpc-file:${fInfo.color}">
            <div class="rp-card-hd">
              <div class="rp-card-file-ico">${fInfo.svg}</div>
              <span class="rp-card-type-badge" style="background:${fInfo.color}22;color:${fInfo.color}">${ft.toUpperCase()}</span>
            </div>
            <div class="rp-card-title">${r.title}</div>
            <div class="rp-card-meta">
              <span style="color:${src.color}">${src.name}</span>
              <span>${r.branch}</span>
            </div>
            <div class="rp-card-footer">
              <span class="rp-card-sender">${r.sender || '—'}</span>
              <div class="rp-card-actions">
                ${timeStr ? `<span class="rp-card-time">${timeStr}</span>` : ''}
                <button class="rp-dl-btn" onclick="event.stopPropagation();rptDownload(${r.id})" title="تنزيل">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              </div>
            </div>
          </div>`;
      } else {
        html += `
          <div class="rp-row" style="--rpc:${src.color};--rpc-file:${fInfo.color}">
            <div class="rp-row-file">
              ${fInfo.svg}
              <span class="rp-row-ft" style="color:${fInfo.color}">${ft.toUpperCase()}</span>
            </div>
            <div class="rp-row-body">
              <div class="rp-row-title">${r.title}</div>
              <div class="rp-row-meta">
                <span class="rp-row-chip" style="background:${src.color}18;color:${src.color}">${src.name}</span>
                <span class="rp-row-branch">${r.branch}</span>
                <span class="rp-row-sender">${r.sender || '—'}</span>
                ${r.fileSize ? `<span class="rp-row-size">${r.fileSize}</span>` : ''}
              </div>
            </div>
            <div class="rp-row-right">
              ${timeStr ? `<span class="rp-row-time">${timeStr}</span>` : ''}
              <button class="rp-dl-btn" onclick="event.stopPropagation();rptDownload(${r.id})" title="تنزيل">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            </div>
          </div>`;
      }
    });
  });

  listEl.innerHTML = html;
}

function rptDownload(id) {
  const r = state.reports.find(r => r.id === id);
  if (!r) return;
  if (r.fileData) {
    // تنزيل حقيقي من الـ base64 المخزّن
    const a = document.createElement('a');
    a.href = r.fileData;
    a.download = r.fileName || (r.title + '.pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify('جاري تنزيل: ' + (r.fileName || r.title));
  } else {
    notify('جاري تنزيل: ' + (r.fileName || r.title));
  }
}

// Global function for other pages to push a report
function addReport(obj) {
  const id = (state.reports.length ? Math.max(...state.reports.map(r => r.id)) : 0) + 1;
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const date = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate())
             + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  state.reports.unshift({ id, date, fileType: 'pdf', fileSize: '—', fileName: obj.title + '.pdf', ...obj });
  if (activeTab === 11) renderReports();
  updateSidebarStats();
  notify('تم استلام ملف جديد: ' + obj.title);
}

function paTogglePage(branchId, pageKey) {
  const b = state.branches.find(b => b.id === branchId);
  if (!b || !b.pages || !b.pages[pageKey]) return;
  const pg = b.pages[pageKey];
  pg.active = !(pg.active !== false);
  const def = SYSTEM_PAGES_DEF[pageKey] || BRANCH_PAGE_DEFS[pageKey];
  notify((pg.active ? 'تم تفعيل ' : 'تم تعطيل ') + def.name + ' في ' + b.name, pg.active ? 'success' : 'error');
  renderPagesAdmin(); updateSidebarStats();
}
function paAddPage(branchId, pageKey) {
  const b = state.branches.find(b => b.id === branchId);
  if (!b) return;
  if (!b.pages) b.pages = {};
  b.pages[pageKey] = { active: true, features: {1:true,2:true,3:true,4:true} };
  notify('تمت إضافة ' + (SYSTEM_PAGES_DEF[pageKey] || BRANCH_PAGE_DEFS[pageKey]).name + ' إلى ' + b.name);
  renderPagesAdmin(); updateSidebarStats();
}
function openPaEdit(branchId, pageKey) {
  const b = state.branches.find(b => b.id === branchId);
  const def = SYSTEM_PAGES_DEF[pageKey] || BRANCH_PAGE_DEFS[pageKey];
  if (!b || !def || !b.pages || !b.pages[pageKey]) return;
  _paEdit = { branchId, pageKey };
  const pg = b.pages[pageKey], on = pg.active !== false;
  document.getElementById('pa-edit-title').textContent = def.icon + ' ' + def.name;
  document.getElementById('pa-edit-sub').textContent = 'الفرع: ' + b.name;
  document.getElementById('pa-edit-status').value = String(on);
  document.getElementById('pa-rc-on').classList.toggle('pa-rc-active', on);
  document.getElementById('pa-rc-off').classList.toggle('pa-rc-active', !on);
  document.getElementById('pa-edit-fields').innerHTML = '<div style="margin-top:4px"><button class="btn btn-sm btn-danger" onclick="paDeletePage(' + branchId + ',\'' + pageKey + '\')">حذف من الفرع</button></div>';
  openModal('pa-edit-modal');
}
function setPaStatus(val) {
  document.getElementById('pa-edit-status').value = String(val);
  document.getElementById('pa-rc-on').classList.toggle('pa-rc-active', val);
  document.getElementById('pa-rc-off').classList.toggle('pa-rc-active', !val);
}
function savePaEdit() {
  if (!_paEdit) return;
  const b = state.branches.find(b => b.id === _paEdit.branchId);
  if (!b || !b.pages || !b.pages[_paEdit.pageKey]) return;
  b.pages[_paEdit.pageKey].active = document.getElementById('pa-edit-status').value === 'true';
  closeModal('pa-edit-modal'); notify('تم حفظ الإعدادات');
  renderPagesAdmin(); updateSidebarStats();
}
function paDeletePage(branchId, pageKey) {
  const b = state.branches.find(b => b.id === branchId);
  if (!b || !b.pages) return;
  const def = SYSTEM_PAGES_DEF[pageKey] || BRANCH_PAGE_DEFS[pageKey];
  delete b.pages[pageKey];
  closeModal('pa-edit-modal');
  notify('تم حذف ' + def.name + ' من ' + b.name, 'error');
  renderPagesAdmin(); updateSidebarStats();
}

// ===================== RENDER =====================
function renderAll() {
  renderDashboard();
  renderBranches();
  renderSupervisors();
  renderTellerBoxes();
  renderBranchTree();
  renderMainBox();
  renderTransactions();
  updateSidebarStats();
  if (typeof updateTreeStats === 'function') updateTreeStats();
  renderPagesAdmin();
  if (typeof accs_loadAccounts === 'function') accs_loadAccounts();
  renderUsersTable();
  renderActiveSessions();
}

function updateSidebarStats() {
  const totalSups = allSups().length + getTransfersSupervisors().length;
  const totalActive = state.branches.reduce((sum, b) => {
    if (!b.pages) return sum;
    return sum + Object.values(b.pages).filter(p => p.active !== false).length;
  }, 0);
  function _set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  _set('sb-branches', state.branches.length);
  _set('sb-pages',    totalActive);
  _set('sb-reports',  state.reports.length);
  _set('sf-branches', state.branches.length);
  _set('sf-sups',     totalSups);
  _set('sf-boxes',    allTellers().length);
}

function branchTotalStr(b) {
  let parts = [];
  if (b.balances.USD) parts.push(fmtCur(b.balances.USD,'USD'));
  if (b.balances.ILS) parts.push(fmtCur(b.balances.ILS,'ILS'));
  if (b.balances.JOD) parts.push(fmtCur(b.balances.JOD,'JOD'));
  return parts.length ? parts.join(' • ') : '$0';
}

function renderDashboard() {
  const sups    = allSups();
  const tellers = allTellers();
  const totalSups = sups.length + getTransfersSupervisors().length;
  const stats = [
    { label: 'الصندوق الرئيسي (USD)', value: fmtCur(state.mainBox.balances.USD,'USD'), icon: '💵', color: '#5CB85C' },
    { label: 'الصندوق الرئيسي (ILS)', value: fmtCur(state.mainBox.balances.ILS,'ILS'), icon: '🇵🇸', color: '#5BC0DE' },
    { label: 'الصندوق الرئيسي (JOD)', value: fmtCur(state.mainBox.balances.JOD,'JOD'), icon: '🇯🇴', color: '#D4AF37' },
    { label: 'الفروع / المشرفون / الصناديق', value: `${state.branches.length} / ${totalSups} / ${tellers.length}`, icon: '🏢', color: '#A23B72' },
  ];
  document.getElementById('stats-grid').innerHTML = stats.map(s => `
    <div class="stat-card" style="--accent:${s.color}">
      <div class="stat-inner">
        <div><div class="stat-label">${s.label}</div><div class="stat-value" style="color:${s.color}">${s.value}</div></div>
        <div class="stat-icon">${s.icon}</div>
      </div>
    </div>`).join('');

  document.getElementById('branches-overview').innerHTML = `
    <div class="flex-between mb20">
      <div class="card-title" style="margin-bottom:0">حالة الفروع</div>
      <button class="btn btn-gold btn-sm" onclick="switchTab(1)">إدارة الفروع</button>
    </div>
    ${state.branches.map(b => `
      <div class="branch-card">
        <div class="flex-between">
          <div>
            <div style="font-weight:700;font-size:14px">${b.name} ${b.isMain ? `<span style="font-size:10px;color:#D4AF37;background:rgba(212,175,55,0.1);padding:2px 8px;border-radius:10px;margin-right:6px">رئيسي</span>` : ''}</div>
            <div class="fs-12 text-muted mt4">${b.location}</div>
          </div>
          <div style="text-align:left">
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
              ${b.balances.USD?`<span class="cur-badge cur-usd">${fmtCur(b.balances.USD,'USD')}</span>`:''}
              ${b.balances.ILS?`<span class="cur-badge cur-ils">${fmtCur(b.balances.ILS,'ILS')}</span>`:''}
              ${b.balances.JOD?`<span class="cur-badge cur-jod">${fmtCur(b.balances.JOD,'JOD')}</span>`:''}
            </div>
            <div class="fs-12 text-muted" style="text-align:left;margin-top:4px">${b.supervisors.length} مشرف • ${b.tellers.length} تلر</div>
          </div>
        </div>
      </div>`).join('')}`;

  document.getElementById('recent-tx').innerHTML = `
    <div class="card-title">آخر العمليات</div>
    ${state.transactions.slice().reverse().slice(0,5).map(t => `
      <div class="flex-between" style="padding:12px 0;border-bottom:1px solid #1E2638">
        <div>
          <div style="font-weight:600;font-size:13px">${t.type}</div>
          <div class="fs-12 text-muted">${t.from} → ${t.to}</div>
          <div class="fs-12 text-muted">${t.date}</div>
        </div>
        <div style="text-align:left">
          <div class="text-gold fw-700" style="font-size:14px">${fmtCur(t.amount, t.currency)}</div>
          <div style="margin-top:4px">${curBadge(t.currency)}</div>
          <span class="badge ${t.status==='completed'?'badge-active':'badge-pending'}" style="margin-top:4px">${t.status==='completed'?'مكتمل':'معلق'}</span>
        </div>
      </div>`).join('')}`;
}

function renderBranches() {
  document.getElementById('branches-list').innerHTML = state.branches.map(b => `
    <div class="card mb20" style="border-color:${b.isMain?'rgba(212,175,55,0.4)':'#252D40'}">
      <div style="display:grid;grid-template-columns:1fr auto;gap:16px;margin-bottom:20px">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
            <div style="font-size:20px;font-weight:900">${b.name}</div>
            ${b.isMain?`<span style="background:linear-gradient(135deg,#D4AF37,#F0C842);color:#0A0E1A;font-size:11px;font-weight:800;padding:3px 10px;border-radius:10px">الفرع الرئيسي</span>`:''}
            <span class="badge ${b.status==='active'?'badge-active':'badge-inactive'}">${b.status==='active'?'نشط':'متوقف'}</span>
          </div>
          <div class="text-muted fs-13">${b.location}</div>
        </div>
        <div style="text-align:left">
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            ${b.balances.USD?`<span class="cur-badge cur-usd" style="font-size:13px">${fmtCur(b.balances.USD,'USD')}</span>`:''}
            ${b.balances.ILS?`<span class="cur-badge cur-ils" style="font-size:13px">${fmtCur(b.balances.ILS,'ILS')}</span>`:''}
            ${b.balances.JOD?`<span class="cur-badge cur-jod" style="font-size:13px">${fmtCur(b.balances.JOD,'JOD')}</span>`:''}
          </div>
          <div class="fs-12 text-muted mt4" style="text-align:left">رصيد الفرع</div>
        </div>
      </div>
      <div class="three-col">
        <div class="dark-box text-center"><div class="fs-28 fw-900 text-blue">${b.supervisors.length}</div><div class="fs-12 text-muted">مشرف</div></div>
        <div class="dark-box text-center"><div class="fs-28 fw-900 text-orange">${b.tellers.length}</div><div class="fs-12 text-muted">تلر</div></div>
        <div class="dark-box text-center"><div class="fs-28 fw-900 text-green">${b.tellers.filter(t=>t.box.status==='open').length}</div><div class="fs-12 text-muted">صندوق مفتوح</div></div>
      </div>
      ${b.tellers.length>0?`
        <div class="mt20">
          <div class="fs-13 fw-700 text-muted mb12">التلرات في هذا الفرع</div>
          <div class="auto-col-sm">
            ${b.tellers.map(t=>`
              <div class="teller-card" style="border-color:${t.box.status==='open'?'rgba(92,184,92,0.3)':'rgba(220,53,69,0.3)'}">
                <div class="flex-between mb8">
                  <div style="font-weight:700;font-size:13px">صندوق ${t.box.id}</div>
                  <span class="badge ${t.box.status==='open'?'badge-active':'badge-inactive'}">${t.box.status==='open'?'مفتوح':'مغلق'}</span>
                </div>
                <div class="fs-12 text-muted">${t.name}</div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
                  <span style="font-size:16px;font-weight:800;color:#D4AF37">${fmtCur(t.box.balance, t.box.currency)}</span>
                  ${curBadge(t.box.currency)}
                </div>
              </div>`).join('')}
          </div>
        </div>`:''}
    </div>`).join('');
}

// ══════════════════════════════════════════════════════
// Supervisor Section — Permissions & Messaging
// ══════════════════════════════════════════════════════

const SV_PERMS_DEF = {
  // تلر فقط
  viewBoxes:         { label: 'عرض الصناديق',             group: 'صناديق التلر', kinds: ['teller'] },
  openCloseBoxes:    { label: 'فتح / إغلاق الصناديق',     group: 'صناديق التلر', kinds: ['teller'] },
  transferFunds:     { label: 'تحويل الأموال بين الصناديق',group: 'صناديق التلر', kinds: ['teller'] },
  manageRates:       { label: 'إدارة التسعيرة',            group: 'صناديق التلر', kinds: ['teller'] },
  // مشترك
  approveRequests:   { label: 'الموافقة على الطلبات',      group: 'العمليات',      kinds: ['teller', 'transfers'] },
  viewReports:       { label: 'عرض التقارير',               group: 'العمليات',      kinds: ['teller', 'transfers'] },
  uploadReports:     { label: 'رفع التقارير للإدارة',       group: 'العمليات',      kinds: ['teller', 'transfers'] },
  manageEmployees:   { label: 'إدارة الموظفين',             group: 'الإعدادات',     kinds: ['teller', 'transfers'] },
  viewFullHistory:   { label: 'سجل كامل العمليات',          group: 'الإعدادات',     kinds: ['teller', 'transfers'] },
  // حوالات فقط
  manageTransfers:   { label: 'إدارة الحوالات الخارجية',   group: 'الحوالات',      kinds: ['transfers'] },
  approveTransfers:  { label: 'الموافقة على الحوالات',      group: 'الحوالات',      kinds: ['transfers'] },
  viewAgents:        { label: 'عرض الوكلاء',                group: 'الحوالات',      kinds: ['transfers'] },
  manageAgents:      { label: 'إدارة الوكلاء',              group: 'الحوالات',      kinds: ['transfers'] },
  viewCompliance:    { label: 'الاطلاع على الامتثال',       group: 'الحوالات',      kinds: ['transfers'] },
};

const SV_PERMS_DEFAULT_TELLER = {
  viewBoxes: true, openCloseBoxes: true, transferFunds: false, manageRates: false,
  approveRequests: true, viewReports: true, uploadReports: true,
  manageEmployees: false, viewFullHistory: false,
};
const SV_PERMS_DEFAULT_TRANSFERS = {
  approveRequests: true, viewReports: true, uploadReports: true,
  manageEmployees: false, viewFullHistory: false,
  manageTransfers: true, approveTransfers: true, viewAgents: true,
  manageAgents: false, viewCompliance: false,
};

function loadSvPerms(supId, kind) {
  const def = kind === 'transfers' ? SV_PERMS_DEFAULT_TRANSFERS : SV_PERMS_DEFAULT_TELLER;
  try { return JSON.parse(localStorage.getItem('intl_sv_perms_' + supId)) || { ...def }; } catch(e) { return { ...def }; }
}
function saveSvPerms(supId, perms) {
  localStorage.setItem('intl_sv_perms_' + supId, JSON.stringify(perms));
}
function loadSvInstructions(supId) {
  try { return JSON.parse(localStorage.getItem('intl_instr_' + supId)) || []; } catch(e) { return []; }
}
function loadAllSvMsgs() {
  try { return JSON.parse(localStorage.getItem('intl_sv_msgs')) || []; } catch(e) { return []; }
}

let _svCurrentFilter = 'all';
let _svDetailId      = null;
let _svDetailKind    = null;
let _svInstrId       = null;
let _svInstrPriority = 'عادي';

function svFilterSups(type, btn) {
  _svCurrentFilter = type;
  document.querySelectorAll('.sv-ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSupervisors();
}

function renderSupervisors() {
  const tellerSups    = allSups();
  const transfersSups = getTransfersSupervisors();
  const tellers       = allTellers();

  const allSupervisors = [
    ...tellerSups.map(s => ({ ...s, _kind: 'teller' })),
    ...transfersSups.map(s => ({ ...s, _kind: 'transfers' }))
  ];

  // Stats bar
  const totalActive   = allSupervisors.filter(s => s.status === 'active').length;
  const totalInactive = allSupervisors.filter(s => s.status !== 'active').length;
  const totalTeller   = allSupervisors.filter(s => s._kind === 'teller').length;
  const totalTransfers= allSupervisors.filter(s => s._kind === 'transfers').length;
  const statsEl = document.getElementById('sv-stats-bar');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="sv-stat-card"><div class="sv-stat-val" style="color:#D4AF37">${allSupervisors.length}</div><div class="sv-stat-lbl">إجمالي المشرفين</div></div>
      <div class="sv-stat-card"><div class="sv-stat-val" style="color:#5CB85C">${totalActive}</div><div class="sv-stat-lbl">نشطون</div></div>
      <div class="sv-stat-card"><div class="sv-stat-val" style="color:#D4AF37">${totalTeller}</div><div class="sv-stat-lbl">مشرفو التلر</div></div>
      <div class="sv-stat-card"><div class="sv-stat-val" style="color:#32b8c6">${totalTransfers}</div><div class="sv-stat-lbl">مشرفو الحوالات</div></div>`;
  }

  // Filter
  const filtered = _svCurrentFilter === 'all' ? allSupervisors
    : allSupervisors.filter(s => s._kind === _svCurrentFilter);

  const grid = document.getElementById('sv-cards-grid');
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:#8B9BB4;font-size:14px">لا يوجد مشرفون في هذه الفئة</div>`;
    svUpdateInboxBadge();
    return;
  }

  grid.innerHTML = filtered.map(s => {
    const branch   = s._kind === 'teller' ? (state.branches.find(b => b.id === s.branchId)?.name || '—') : 'نظام الحوالات';
    const myTellers = s._kind === 'teller' ? tellers.filter(t => t.supervisorId === s.id) : [];
    const perms    = loadSvPerms(s.id, s._kind);
    const isActive = s.status === 'active';
    const firstLetter = s.name ? s.name.charAt(0) : '?';

    // Teller pills — only for teller supervisors
    const tellerPills = s._kind === 'teller'
      ? (myTellers.length > 0
          ? `<div class="sv-tellers-row">
               <div class="sv-tellers-label">التلرات المكلفون (${myTellers.length})</div>
               <div>${myTellers.map(t => `
                 <span class="sv-teller-pill">
                   <span class="sv-teller-dot" style="background:${t.box && t.box.status === 'open' ? '#5CB85C' : '#ef4444'}"></span>
                   ${t.name}
                 </span>`).join('')}</div>
             </div>`
          : `<div class="sv-tellers-row"><div class="sv-tellers-label" style="text-align:center;padding:6px 0">لا يوجد تلرات مكلفون</div></div>`)
      : '';

    // Perms chips — 4 chips relevant to this supervisor type
    const tellerChipKeys     = ['viewBoxes','openCloseBoxes','approveRequests','viewReports'];
    const transfersChipKeys  = ['manageTransfers','approveTransfers','viewReports','viewAgents'];
    const permKeys = s._kind === 'teller' ? tellerChipKeys : transfersChipKeys;
    const permChips = permKeys.map(k => {
      const on = perms[k] !== undefined ? perms[k] : false;
      const lbl = SV_PERMS_DEF[k] ? SV_PERMS_DEF[k].label : k;
      return `<span class="sv-perm-chip${on ? '' : ' off'}">${lbl}</span>`;
    }).join('');

    return `<div class="sv-card kind-${s._kind}">
      <div class="sv-card-header">
        <div class="sv-avatar kind-${s._kind}">${firstLetter}</div>
        <div style="flex:1;min-width:0">
          <div class="sv-card-name">${s.name}</div>
          <div class="sv-card-phone">${s.phone || ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="sv-badge-type ${s._kind}">${s._kind === 'teller' ? 'تلر' : 'حوالات'}</span>
          <span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">${isActive ? 'نشط' : 'متوقف'}</span>
        </div>
      </div>
      <div class="sv-info-row">
        <span class="sv-badge-shift">${s.shift || 'غير محدد'}</span>
        <span style="font-size:11px;color:#64748b">${branch}</span>
      </div>
      ${tellerPills}
      <div class="sv-perms-row">${permChips}</div>
      <div class="sv-card-footer">
        <button class="sv-card-btn primary" onclick="openSvDetail(${s.id},'${s._kind}')">التفاصيل</button>
        <button class="sv-card-btn" onclick="openSvInstructions(${s.id},'${s.name.replace(/'/g,"\\'")}')">تعليمات</button>
        <button class="sv-card-btn ${isActive ? 'danger' : 'success'}" onclick="toggleSupervisorStatus(${s.id})">${isActive ? 'إيقاف' : 'تفعيل'}</button>
      </div>
    </div>`;
  }).join('');

  svUpdateInboxBadge();
}

function openSvDetail(supId, kind) {
  _svDetailId   = supId;
  _svDetailKind = kind;
  const allS = [
    ...allSups().map(s => ({ ...s, _kind: 'teller' })),
    ...getTransfersSupervisors().map(s => ({ ...s, _kind: 'transfers' }))
  ];
  const sup = allS.find(s => s.id === supId && s._kind === kind);
  if (!sup) return;
  document.getElementById('sv-detail-modal-title').textContent = sup.name;
  document.getElementById('sv-detail-modal-sub').textContent = kind === 'teller' ? 'مشرف التلر' : 'مشرف الحوالات';
  document.getElementById('sv-detail-modal').style.display = 'flex';
  // reset tabs
  document.querySelectorAll('#sv-detail-modal .sv-tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  svRenderDetailTabs('profile');
}

function svRenderDetailTabs(tab) {
  document.querySelectorAll('#sv-detail-modal .sv-tab-btn').forEach(b => {
    const tabMap = { profile: 'الملف الشخصي', tellers: 'التلرات المكلفون', perms: 'الصلاحيات', messages: 'الرسائل' };
    b.classList.toggle('active', b.textContent.trim() === tabMap[tab]);
  });
  const allS = [
    ...allSups().map(s => ({ ...s, _kind: 'teller' })),
    ...getTransfersSupervisors().map(s => ({ ...s, _kind: 'transfers' }))
  ];
  const sup = allS.find(s => s.id === _svDetailId && s._kind === _svDetailKind);
  if (!sup) return;
  const el = document.getElementById('sv-detail-content');
  if (!el) return;

  if (tab === 'profile') {
    const branch = sup._kind === 'teller' ? (state.branches.find(b => b.id === sup.branchId)?.name || '—') : 'نظام الحوالات';
    const isActive = sup.status === 'active';
    el.innerHTML = `
      <div style="display:grid;gap:10px">
        ${[['الاسم الكامل', sup.name], ['رقم الهاتف', sup.phone || '—'], ['الوردية', sup.shift || '—'], ['نوع المشرف', sup._kind === 'teller' ? 'مشرف التلر' : 'مشرف الحوالات'], ['الفرع / القسم', branch]].map(([k,v]) => `
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(50,184,198,0.11);border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:#64748b;font-weight:800">${k}</span>
            <span style="font-size:13px;color:#e9edef;font-weight:600">${v}</span>
          </div>`).join('')}
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(50,184,198,0.11);border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:#64748b;font-weight:800">الحالة</span>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">${isActive ? 'نشط' : 'متوقف'}</span>
            <button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-success'}" onclick="toggleSupervisorStatus(${sup.id});openSvDetail(${sup.id},'${sup._kind}')">${isActive ? 'إيقاف' : 'تفعيل'}</button>
          </div>
        </div>
        <div style="margin-top:6px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px">
          <button class="btn btn-blue" style="flex:1" onclick="svOpenEditForm(${sup.id},'${sup._kind}')">تعديل بيانات المشرف</button>
          <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#f87171" onclick="svDeleteSupervisor(${sup.id},'${sup._kind}','${sup.name.replace(/'/g,"\\'")}')">حذف</button>
        </div>
      </div>`;
  } else if (tab === 'tellers') {
    svRenderTellersTab(sup.id);
  } else if (tab === 'perms') {
    svRenderPermsTab(sup.id);
  } else if (tab === 'messages') {
    svRenderMessagesTab(sup.id);
  }
}

function svRenderTellersTab(supId) {
  const el = document.getElementById('sv-detail-content');
  if (!el) return;
  const myTellers = allTellers().filter(t => t.supervisorId === supId);
  if (myTellers.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:#8696a0">لا يوجد تلرات مكلفون لهذا المشرف</div>`;
    return;
  }
  el.innerHTML = myTellers.map(t => {
    const boxOpen = t.box && t.box.status === 'open';
    return `<div class="sv-instr-item" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
      <div>
        <div style="font-size:14px;font-weight:800;color:#e9edef;margin-bottom:4px">${t.name}</div>
        <div style="font-size:11px;color:#64748b">صندوق #${t.box ? t.box.id : '—'} &nbsp;|&nbsp; ${t.box ? fmtCur(t.box.balance, t.box.currency) : '—'}</div>
      </div>
      <span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:8px;background:${boxOpen ? 'rgba(92,184,92,0.15)' : 'rgba(239,68,68,0.12)'};color:${boxOpen ? '#5CB85C' : '#f87171'};border:1px solid ${boxOpen ? 'rgba(92,184,92,0.3)' : 'rgba(239,68,68,0.25)'}">${boxOpen ? 'مفتوح' : 'مغلق'}</span>
    </div>`;
  }).join('');
}

function svRenderPermsTab(supId) {
  const el = document.getElementById('sv-detail-content');
  if (!el) return;
  const kind  = _svDetailKind;
  const perms = loadSvPerms(supId, kind);
  // Filter perms by this supervisor's kind
  const groups = {};
  Object.entries(SV_PERMS_DEF).forEach(([key, def]) => {
    if (!def.kinds || !def.kinds.includes(kind)) return;
    if (!groups[def.group]) groups[def.group] = [];
    groups[def.group].push({ key, label: def.label, val: !!perms[key] });
  });
  el.innerHTML = Object.entries(groups).map(([grp, items]) => `
    <div class="sv-perm-group">
      <div class="sv-perm-group-title">${grp}</div>
      ${items.map(item => `
        <div class="sv-perm-row">
          <span class="sv-perm-label">${item.label}</span>
          <label class="sv-toggle">
            <input type="checkbox" id="svp_${supId}_${item.key}" ${item.val ? 'checked' : ''}>
            <span class="sv-toggle-slider"></span>
          </label>
        </div>`).join('')}
    </div>`).join('')
  + `<div style="margin-top:16px"><button class="btn btn-gold" onclick="svSavePerms(${supId})">حفظ الصلاحيات</button></div>`;
}

function svSavePerms(supId) {
  const kind = _svDetailKind;
  const newPerms = {};
  Object.entries(SV_PERMS_DEF).forEach(([key, def]) => {
    if (!def.kinds || !def.kinds.includes(kind)) return;
    const chk = document.getElementById('svp_' + supId + '_' + key);
    newPerms[key] = chk ? chk.checked : false;
  });
  saveSvPerms(supId, newPerms);
  notify('تم حفظ الصلاحيات بنجاح', 'success');
  renderSupervisors();
}

function svRenderMessagesTab(supId) {
  const el = document.getElementById('sv-detail-content');
  if (!el) return;
  const instructions = loadSvInstructions(supId);
  const msgs = loadAllSvMsgs().filter(m => m.supId === supId);

  let html = '';
  if (instructions.length > 0) {
    html += `<div style="font-size:11px;font-weight:900;color:#D4AF37;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">التعليمات المرسلة</div>`;
    html += instructions.map(i => `
      <div class="sv-instr-item">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:7px;background:${i.priority==='عاجل جداً'?'rgba(239,68,68,0.15)':i.priority==='مهم'?'rgba(251,191,36,0.15)':'rgba(255,255,255,0.06)'};color:${i.priority==='عاجل جداً'?'#f87171':i.priority==='مهم'?'#fbbf24':'#94a3b8'}">${i.priority}</span>
          <span style="font-size:11px;color:#64748b">${i.date}</span>
        </div>
        <div style="font-size:13px;color:#e9edef;line-height:1.6">${i.text}</div>
        <div style="font-size:11px;color:${i.read?'#5CB85C':'#fbbf24'};margin-top:6px">${i.read?'مقروء':'لم يُقرأ بعد'}</div>
      </div>`).join('');
  }
  if (msgs.length > 0) {
    html += `<div style="font-size:11px;font-weight:900;color:#32b8c6;text-transform:uppercase;letter-spacing:.6px;margin:16px 0 10px">رسائل المشرف</div>`;
    html += msgs.map(m => `
      <div class="sv-msg-item">
        <div style="font-size:13px;color:#e9edef;line-height:1.6;margin-bottom:6px">${m.text}</div>
        <div style="font-size:11px;color:#64748b">${m.date}</div>
      </div>`).join('');
  }
  if (!html) html = `<div style="text-align:center;padding:40px;color:#8696a0">لا توجد رسائل أو تعليمات لهذا المشرف</div>`;
  el.innerHTML = html;
}

// ══════ تعديل بيانات المشرف ══════
function svOpenEditForm(supId, kind) {
  const allS = [
    ...allSups().map(s => ({ ...s, _kind: 'teller' })),
    ...getTransfersSupervisors().map(s => ({ ...s, _kind: 'transfers' }))
  ];
  const sup = allS.find(s => s.id === supId && s._kind === kind);
  if (!sup) return;
  const el = document.getElementById('sv-detail-content');
  if (!el) return;

  const branchOptions = state.branches.map(b =>
    `<option value="${b.id}" ${sup.branchId === b.id ? 'selected' : ''}>${b.name}</option>`
  ).join('');

  const inputStyle = 'width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(50,184,198,0.18);border-radius:10px;color:#e9edef;font-size:13px;font-family:inherit;padding:10px 12px;direction:rtl;outline:none;box-sizing:border-box;transition:border-color .2s';
  const labelStyle = 'font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px;display:block';

  el.innerHTML = `
    <div style="display:grid;gap:14px">
      <div>
        <label style="${labelStyle}">الاسم الكامل</label>
        <input id="sv-edit-name" style="${inputStyle}" value="${sup.name}" placeholder="اسم المشرف">
      </div>
      <div>
        <label style="${labelStyle}">رقم الهاتف</label>
        <input id="sv-edit-phone" style="${inputStyle}" value="${sup.phone || ''}" placeholder="0501234567">
      </div>
      <div>
        <label style="${labelStyle}">الوردية</label>
        <select id="sv-edit-shift" style="${inputStyle}">
          <option value="صباحي" ${sup.shift === 'صباحي' ? 'selected' : ''}>صباحي</option>
          <option value="مسائي" ${sup.shift === 'مسائي' ? 'selected' : ''}>مسائي</option>
          <option value="ليلي"  ${sup.shift === 'ليلي'  ? 'selected' : ''}>ليلي</option>
        </select>
      </div>
      <div>
        <label style="${labelStyle}">نوع المشرف</label>
        <select id="sv-edit-type" style="${inputStyle}" onchange="svEditTypeChange()">
          <option value="teller"    ${kind === 'teller'    ? 'selected' : ''}>مشرف التلر</option>
          <option value="transfers" ${kind === 'transfers' ? 'selected' : ''}>مشرف الحوالات</option>
        </select>
        <div style="font-size:11px;color:#fbbf24;margin-top:6px;padding:8px 10px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:8px">
          تغيير النوع سينقل المشرف بين أقسام النظام ويعيد ضبط صلاحياته
        </div>
      </div>
      <div id="sv-edit-branch-row" style="${kind === 'transfers' ? 'display:none' : ''}">
        <label style="${labelStyle}">الفرع</label>
        <select id="sv-edit-branch" style="${inputStyle}">${branchOptions}</select>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-gold" style="flex:1" onclick="svSaveEdit(${supId},'${kind}')">حفظ التعديلات</button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.04);border:1px solid rgba(50,184,198,0.18);color:#8B9BB4" onclick="svRenderDetailTabs('profile')">إلغاء</button>
      </div>
    </div>`;
}

function svEditTypeChange() {
  const type = document.getElementById('sv-edit-type')?.value;
  const branchRow = document.getElementById('sv-edit-branch-row');
  if (branchRow) branchRow.style.display = type === 'transfers' ? 'none' : '';
}

function svSaveEdit(supId, oldKind) {
  const name  = (document.getElementById('sv-edit-name')?.value  || '').trim();
  const phone = (document.getElementById('sv-edit-phone')?.value || '').trim();
  const shift = document.getElementById('sv-edit-shift')?.value;
  const newKind = document.getElementById('sv-edit-type')?.value;
  const branchId = Number(document.getElementById('sv-edit-branch')?.value);

  if (!name)  return notify('يرجى إدخال اسم المشرف', 'error');
  if (!phone) return notify('يرجى إدخال رقم الهاتف', 'error');
  if (newKind === 'teller' && !branchId) return notify('يرجى اختيار الفرع', 'error');

  if (oldKind === newKind) {
    // Same type — just update fields
    if (oldKind === 'teller') {
      state.branches = state.branches.map(b => ({
        ...b,
        supervisors: b.supervisors.map(s => s.id === supId ? { ...s, name, phone, shift, branchId } : s)
      }));
    } else {
      const list = getTransfersSupervisors().map(s =>
        s.id === supId ? { ...s, name, phone, shift } : s
      );
      saveTransfersSupervisors(list);
    }
  } else {
    // Type changed — move supervisor
    if (oldKind === 'teller') {
      // Remove from teller branches
      let found = null;
      state.branches = state.branches.map(b => ({
        ...b,
        supervisors: b.supervisors.filter(s => { if (s.id === supId) { found = s; return false; } return true; })
      }));
      // Add to transfers
      const trList = getTransfersSupervisors();
      trList.push({ id: supId, name, phone, shift, type: 'transfers', status: (found?.status || 'active'), createdAt: new Date().toISOString() });
      saveTransfersSupervisors(trList);
      // Re-set default perms for new kind
      localStorage.removeItem('intl_sv_perms_' + supId);
    } else {
      // Remove from transfers
      const trList = getTransfersSupervisors().filter(s => s.id !== supId);
      saveTransfersSupervisors(trList);
      // Add to teller branch
      const sup = { id: supId, name, phone, shift, branchId, type: 'teller', status: 'active' };
      state.branches = state.branches.map(b =>
        b.id === branchId ? { ...b, supervisors: [...b.supervisors, sup] } : b
      );
      // Re-set default perms for new kind
      localStorage.removeItem('intl_sv_perms_' + supId);
    }
    _svDetailKind = newKind;
  }

  notify(`تم تحديث بيانات ${name} بنجاح`, 'success');
  renderAll();
  renderSupervisors();
  document.getElementById('sv-detail-modal').style.display = 'none';
}

function svDeleteSupervisor(supId, kind, name) {
  if (!confirm(`هل أنت متأكد من حذف المشرف "${name}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
  if (kind === 'teller') {
    state.branches = state.branches.map(b => ({
      ...b,
      supervisors: b.supervisors.filter(s => s.id !== supId)
    }));
  } else {
    saveTransfersSupervisors(getTransfersSupervisors().filter(s => s.id !== supId));
  }
  localStorage.removeItem('intl_sv_perms_' + supId);
  localStorage.removeItem('intl_instr_' + supId);
  notify(`تم حذف المشرف "${name}" بنجاح`, 'error');
  renderAll();
  renderSupervisors();
  document.getElementById('sv-detail-modal').style.display = 'none';
}

function openSvInstructions(supId, name) {
  _svInstrId = supId;
  _svInstrPriority = 'عادي';
  document.getElementById('sv-instr-modal-sub').textContent = 'إلى: ' + name;
  document.getElementById('sv-instr-text').value = '';
  // reset priority buttons
  document.querySelectorAll('.sv-priority-opt').forEach(b => b.className = 'sv-priority-opt');
  const firstBtn = document.querySelector('.sv-priority-opt');
  if (firstBtn) firstBtn.classList.add('selected-normal');
  document.getElementById('sv-instr-modal').style.display = 'flex';
}

function svSelectPriority(p, btn) {
  _svInstrPriority = p;
  document.querySelectorAll('.sv-priority-opt').forEach(b => b.className = 'sv-priority-opt');
  const cls = p === 'عادي' ? 'selected-normal' : p === 'مهم' ? 'selected-important' : 'selected-urgent';
  btn.classList.add(cls);
}

function svSendInstructions() {
  const text = (document.getElementById('sv-instr-text').value || '').trim();
  if (!text) { notify('يرجى كتابة نص التعليمات', 'warning'); return; }
  const list = loadSvInstructions(_svInstrId);
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  let adminName = 'الإدارة العامة';
  try { const u = (window._currentUser || {}); if (u.username) adminName = u.username; } catch(e) {}
  list.unshift({
    id: Date.now(),
    text,
    priority: _svInstrPriority,
    date: now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate()) + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()),
    read: false,
    adminName
  });
  localStorage.setItem('intl_instr_' + _svInstrId, JSON.stringify(list));
  document.getElementById('sv-instr-modal').style.display = 'none';
  notify('تم إرسال التعليمات بنجاح', 'success');
}

function openSvInbox() {
  const msgs = loadAllSvMsgs();
  const el = document.getElementById('sv-inbox-list');
  if (!el) return;
  if (msgs.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:#8696a0">لا توجد رسائل في الصندوق</div>`;
  } else {
    el.innerHTML = msgs.map(m => `
      <div class="sv-inbox-item${m.read ? '' : ' unread'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:13px;font-weight:800;color:#e9edef">${m.supName || 'مشرف'}</span>
            <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:7px;background:${m.supType==='transfers'?'rgba(50,184,198,0.15)':'rgba(212,175,55,0.15)'};color:${m.supType==='transfers'?'#32b8c6':'#D4AF37'}">${m.supType === 'transfers' ? 'حوالات' : 'تلر'}</span>
            ${!m.read ? '<span style="font-size:9px;font-weight:900;padding:2px 6px;border-radius:6px;background:rgba(239,68,68,0.2);color:#f87171">جديد</span>' : ''}
          </div>
          <span style="font-size:11px;color:#64748b">${m.date}</span>
        </div>
        <div style="font-size:13px;color:#c0c8d4;line-height:1.6">${m.text}</div>
      </div>`).join('');
  }
  document.getElementById('sv-inbox-modal').style.display = 'flex';
}

function svMarkAllRead() {
  const msgs = loadAllSvMsgs().map(m => ({ ...m, read: true }));
  localStorage.setItem('intl_sv_msgs', JSON.stringify(msgs));
  openSvInbox();
  svUpdateInboxBadge();
}

function svUpdateInboxBadge() {
  const msgs = loadAllSvMsgs();
  const unread = msgs.filter(m => !m.read).length;
  const badge = document.getElementById('sv-inbox-badge');
  if (badge) {
    badge.style.display = unread > 0 ? '' : 'none';
    badge.textContent = unread;
  }
}

function renderTellerBoxes() {
  const boxes = [];
  state.branches.forEach(b => b.tellers.forEach(t => boxes.push({ ...t, branch: b })));
  document.getElementById('teller-boxes').innerHTML = boxes.map(t => {
    const pct = Math.min((t.box.balance/t.box.dailyLimit)*100,100);
    const sup = t.branch.supervisors.find(s=>s.id===t.supervisorId);
    return `<div class="card" style="border-color:${t.box.status==='open'?'rgba(92,184,92,0.3)':'rgba(220,53,69,0.3)'}">
      <div class="flex-between mb16">
        <div>
          <div style="font-size:18px;font-weight:900;color:#D4AF37">صندوق #${t.box.id}</div>
          <div style="font-size:13px;margin-top:4px">${t.name}</div>
          <div class="fs-12 text-muted">${t.branch.name}</div>
        </div>
        <div style="text-align:left">
          <span class="badge ${t.box.status==='open'?'badge-active':'badge-inactive'}">${t.box.status==='open'?'مفتوح':'مغلق'}</span>
          <div style="margin-top:6px">${curBadge(t.box.currency)}</div>
        </div>
      </div>
      <div class="dark-box mb16">
        <div style="font-size:24px;font-weight:900;color:#D4AF37">${fmtCur(t.box.balance, t.box.currency)}</div>
        <div class="fs-12 text-muted mt4">الحد اليومي: ${fmtCur(t.box.dailyLimit, t.box.currency)}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct>80?'linear-gradient(90deg,#FF6B7A,#E83845)':'linear-gradient(90deg,#D4AF37,#F0C842)'}"></div></div>
        <div class="fs-12 text-muted mt4">${pct.toFixed(0)}% من الحد اليومي</div>
      </div>
      ${sup?`<div class="fs-12 text-muted mb16">المشرف: <span style="color:#E8EAF0">${sup.name}</span> • ${sup.shift}</div>`:''}
      <button class="btn btn-full ${t.box.status==='open'?'btn-danger':'btn-success'}" onclick="toggleBoxStatus(${t.box.id})">
        ${t.box.status==='open'?'إغلاق الصندوق':'فتح الصندوق'}
      </button>
    </div>`;
  }).join('');
}

function renderMainBox() {
  const mb = state.mainBox.balances;
  document.getElementById('main-box-content').innerHTML = `
    <div class="card card-gold-border">
      <div class="text-center p20">
        <div style="font-size:48px;margin-bottom:16px">🏦</div>
        <div class="fs-13 text-muted mb8">الصندوق الرئيسي — أرصدة بالعملات</div>
        <div style="display:flex;flex-direction:column;gap:12px;align-items:center;margin-top:16px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:28px">🇺🇸</span>
            <span style="font-size:28px;font-weight:900;color:#5CB85C">${fmtCur(mb.USD,'USD')}</span>
            <span class="cur-badge cur-usd">دولار</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:28px">🇵🇸</span>
            <span style="font-size:28px;font-weight:900;color:#5BC0DE">${fmtCur(mb.ILS,'ILS')}</span>
            <span class="cur-badge cur-ils">شيكل</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:28px">🇯🇴</span>
            <span style="font-size:28px;font-weight:900;color:#D4AF37">${fmtCur(mb.JOD,'JOD')}</span>
            <span class="cur-badge cur-jod">دينار</span>
          </div>
        </div>
        <div style="margin-top:20px"><span class="badge badge-active">نشط</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px">
        <div class="dark-box text-center"><div style="font-size:22px;font-weight:900;color:#2E86AB">${state.branches.length}</div><div class="fs-12 text-muted">فروع مرتبطة</div></div>
        <div class="dark-box text-center"><div style="font-size:18px;font-weight:900;color:#F18F01">${allTellers().length}</div><div class="fs-12 text-muted">صندوق تلر</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px">
        <button class="btn btn-gold btn-full" onclick="openModal('transfer-modal')">تحويل للفروع</button>
        <button class="btn btn-full" style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.35);color:#22c55e" onclick="openDepositModal()">القيد الافتتاحي</button>
      </div>
      <div style="margin-top:10px">
        <button class="btn btn-full" style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);color:#60a5fa" onclick="openDistributeModal()">توزيع على التلرات</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">توزيع أرصدة الفروع</div>
      ${state.branches.map(b=>{
        return `<div style="margin-bottom:20px">
          <div class="flex-between" style="margin-bottom:8px">
            <div class="fs-13 fw-700">${b.name}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${b.balances.USD?`<span class="cur-badge cur-usd">${fmtCur(b.balances.USD,'USD')}</span>`:''}
            ${b.balances.ILS?`<span class="cur-badge cur-ils">${fmtCur(b.balances.ILS,'ILS')}</span>`:''}
            ${b.balances.JOD?`<span class="cur-badge cur-jod">${fmtCur(b.balances.JOD,'JOD')}</span>`:''}
            ${!b.balances.USD&&!b.balances.ILS&&!b.balances.JOD?'<span class="fs-12 text-muted">لا يوجد رصيد</span>':''}
          </div>
        </div>`;}).join('')}
    </div>`;
}

// ── TX Source config ──
const TX_SOURCE_CFG = {
  teller:    { label:'أقسام التلر',       color:'#D4AF37', rgb:'212,175,55',  icon:'💼' },
  bank:      { label:'التحويل البنكي',     color:'#5BC0DE', rgb:'91,192,222',  icon:'🏦' },
  transfers: { label:'الحوالات الخارجية', color:'#32b8c6', rgb:'50,184,198',  icon:'🌐' },
};
const TX_STATUS_CFG = {
  completed: { label:'مكتملة', color:'#5CB85C', bg:'rgba(92,184,92,0.12)',    border:'rgba(92,184,92,0.3)'  },
  pending:   { label:'معلقة',  color:'#fbbf24', bg:'rgba(251,191,36,0.12)',   border:'rgba(251,191,36,0.3)' },
  cancelled: { label:'ملغاة',  color:'#94a3b8', bg:'rgba(148,163,184,0.1)',   border:'rgba(148,163,184,0.2)'},
  failed:    { label:'فاشلة',  color:'#f87171', bg:'rgba(239,68,68,0.12)',    border:'rgba(239,68,68,0.3)'  },
};

let _txFilters = { source:'', type:'', status:'', currency:'', search:'' };

function txApplyFilters() {
  _txFilters.source   = document.getElementById('txf-source')?.value   || '';
  _txFilters.type     = document.getElementById('txf-type')?.value     || '';
  _txFilters.status   = document.getElementById('txf-status')?.value   || '';
  _txFilters.currency = document.getElementById('txf-currency')?.value || '';
  _txFilters.search   = (document.getElementById('txf-search')?.value  || '').trim().toLowerCase();
  renderTransactions();
}

function txResetFilters() {
  _txFilters = { source:'', type:'', status:'', currency:'', search:'' };
  ['txf-source','txf-type','txf-status','txf-currency'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const s = document.getElementById('txf-search'); if (s) s.value = '';
  renderTransactions();
}

function renderTransactions() {
  const today = new Date().toISOString().slice(0, 10);
  const allTx = state.transactions.slice().reverse();

  // ── Daily summary ──
  const todayTx = state.transactions.filter(t => t.date.startsWith(today));
  const incoming = todayTx.filter(t =>
    ['إيداع نقدي','SWIFT','تحويل وكيل'].includes(t.type) && t.status === 'completed'
  );
  const outgoing = todayTx.filter(t =>
    ['سحب نقدي','تحويل دولي','تحويل محلي','حوالة خارجية','حوالة داخلية'].includes(t.type) && t.status === 'completed'
  );
  const inAmtUSD  = incoming.filter(t => t.currency==='USD').reduce((s,t) => s+t.amount, 0);
  const outAmtUSD = outgoing.filter(t => t.currency==='USD').reduce((s,t) => s+t.amount, 0);
  const pending   = todayTx.filter(t => t.status === 'pending').length;
  const bySource  = { teller:0, bank:0, transfers:0 };
  todayTx.forEach(t => { if (bySource[t.source]!==undefined) bySource[t.source]++; });

  const summaryEl = document.getElementById('tx-summary-bar');
  if (summaryEl) {
    const mini = (val, lbl, color, icon) =>
      `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(50,184,198,0.13);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(${TX_SOURCE_CFG[color]?.rgb||'255,255,255'},0.1);border:1px solid rgba(${TX_SOURCE_CFG[color]?.rgb||'255,255,255'},0.2);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${icon}</div>
        <div><div style="font-size:18px;font-weight:900;color:${TX_SOURCE_CFG[color]?.color||color}">${val}</div><div style="font-size:10px;color:#64748b;font-weight:700;margin-top:2px">${lbl}</div></div>
      </div>`;
    summaryEl.innerHTML =
      mini(todayTx.length,           'إجمالي اليوم',        'teller',    '📋') +
      mini('$'+inAmtUSD.toLocaleString(),  'واردة (USD)',    'bank',      '📥') +
      mini('$'+outAmtUSD.toLocaleString(), 'صادرة (USD)',    'transfers', '📤') +
      mini(pending,                  'معلقة',                'teller',    '⏳') +
      `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(50,184,198,0.13);border-radius:14px;padding:14px 16px">
        <div style="font-size:10px;color:#64748b;font-weight:700;margin-bottom:8px">توزيع المصادر</div>
        ${Object.entries(bySource).map(([src,cnt]) => {
          const cfg = TX_SOURCE_CFG[src];
          const pct = todayTx.length ? Math.round(cnt/todayTx.length*100) : 0;
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:10px;color:${cfg.color};font-weight:800;width:80px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${cfg.icon} ${cfg.label}</span>
            <div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px"><div style="width:${pct}%;height:100%;background:${cfg.color};border-radius:2px"></div></div>
            <span style="font-size:10px;color:#94a3b8;font-weight:700;width:22px;text-align:left">${cnt}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  // ── Filter ──
  let filtered = allTx.filter(t => {
    if (_txFilters.source   && t.source   !== _txFilters.source)   return false;
    if (_txFilters.type     && t.type     !== _txFilters.type)     return false;
    if (_txFilters.status   && t.status   !== _txFilters.status)   return false;
    if (_txFilters.currency && t.currency !== _txFilters.currency) return false;
    if (_txFilters.search) {
      const q = _txFilters.search;
      if (!(t.from.toLowerCase().includes(q) || t.to.toLowerCase().includes(q) ||
            (t.note||'').toLowerCase().includes(q) || t.type.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // ── Filter chips ──
  const chipsEl = document.getElementById('tx-filter-chips');
  if (chipsEl) {
    const chips = [];
    if (_txFilters.source)   chips.push(`${TX_SOURCE_CFG[_txFilters.source]?.icon} ${TX_SOURCE_CFG[_txFilters.source]?.label}`);
    if (_txFilters.type)     chips.push(_txFilters.type);
    if (_txFilters.status)   chips.push(TX_STATUS_CFG[_txFilters.status]?.label);
    if (_txFilters.currency) chips.push(_txFilters.currency);
    if (_txFilters.search)   chips.push(`"${_txFilters.search}"`);
    chipsEl.innerHTML = chips.map(c =>
      `<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:8px;background:rgba(212,175,55,0.12);color:#D4AF37;border:1px solid rgba(212,175,55,0.25)">${c}</span>`
    ).join('');
  }

  // ── Table ──
  const txTableEl = document.getElementById('tx-table');
  if (!txTableEl) return;

  if (filtered.length === 0) {
    txTableEl.innerHTML = `<div style="text-align:center;padding:60px;color:#64748b;font-size:13px">لا توجد عمليات تطابق الفلاتر المحددة</div>`;
    return;
  }

  txTableEl.innerHTML = `
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(50,184,198,0.13);border-radius:16px;overflow:hidden">
      <div style="display:grid;grid-template-columns:0.4fr 1fr 1fr 1fr 1fr 0.9fr 0.7fr;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.06)">
        ${['#','المصدر','النوع','من','إلى','المبلغ','الحالة'].map(h =>
          `<span style="font-size:10px;color:#64748b;font-weight:900;text-transform:uppercase;letter-spacing:.5px">${h}</span>`
        ).join('')}
      </div>
      ${filtered.map(t => {
        const src = TX_SOURCE_CFG[t.source] || { label:t.source, color:'#8B9BB4', rgb:'139,155,180', icon:'📌' };
        const st  = TX_STATUS_CFG[t.status] || TX_STATUS_CFG.cancelled;
        const isToday = t.date.startsWith(today);
        return `<div style="display:grid;grid-template-columns:0.4fr 1fr 1fr 1fr 1fr 0.9fr 0.7fr;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <div style="font-size:11px;color:#475569;font-weight:700">#${t.id}</div>
          <div>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;padding:3px 8px;border-radius:7px;background:rgba(${src.rgb},0.12);color:${src.color};border:1px solid rgba(${src.rgb},0.25)">${src.icon} ${src.label}</span>
            ${isToday ? '<span style="font-size:9px;color:#fbbf24;margin-right:4px;font-weight:700">اليوم</span>' : ''}
          </div>
          <div style="font-size:12px;font-weight:700;color:#c0c8d4">${t.type}</div>
          <div style="font-size:11px;color:#8B9BB4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:4px" title="${t.from}">${t.from}</div>
          <div style="font-size:11px;color:#8B9BB4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:4px" title="${t.to}">${t.to}</div>
          <div>
            <div style="font-size:13px;font-weight:900;color:#D4AF37">${fmtCur(t.amount, t.currency)}</div>
            <div style="font-size:10px;color:#475569;margin-top:2px">${t.currency}${t.note ? ' · ' + t.note : ''}</div>
          </div>
          <div><span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:8px;background:${st.bg};color:${st.color};border:1px solid ${st.border}">${st.label}</span></div>
        </div>`;
      }).join('')}
    </div>
    <div style="padding:10px 4px;font-size:11px;color:#475569;font-weight:700">
      عرض ${filtered.length} من ${state.transactions.length} عملية
    </div>`;

  const countEl = document.getElementById('tx-result-count');
  if (countEl) countEl.textContent = `عرض ${filtered.length} من ${state.transactions.length} عملية`;
}

// ── helper: get current filtered rows (same logic as renderTransactions) ──
function _txGetFiltered() {
  return state.transactions.slice().reverse().filter(t => {
    if (_txFilters.source   && t.source   !== _txFilters.source)   return false;
    if (_txFilters.type     && t.type     !== _txFilters.type)     return false;
    if (_txFilters.status   && t.status   !== _txFilters.status)   return false;
    if (_txFilters.currency && t.currency !== _txFilters.currency) return false;
    if (_txFilters.search) {
      const q = _txFilters.search;
      if (!(t.from.toLowerCase().includes(q) || t.to.toLowerCase().includes(q) ||
            (t.note||'').toLowerCase().includes(q) || t.type.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

// ── Excel export ──
function txExportExcel() {
  const rows = _txGetFiltered();
  if (!rows.length) { notify('لا توجد بيانات للتصدير', 'error'); return; }

  const statusAr = { completed:'مكتملة', pending:'معلقة', cancelled:'ملغاة', failed:'فاشلة' };
  const sourceAr = { teller:'أقسام التلر', bank:'التحويل البنكي', transfers:'الحوالات الخارجية' };

  const wsData = [
    ['#', 'المصدر', 'نوع العملية', 'من', 'إلى', 'المبلغ', 'العملة', 'الحالة', 'التاريخ', 'ملاحظة'],
    ...rows.map(t => [
      t.id,
      sourceAr[t.source] || t.source,
      t.type,
      t.from,
      t.to,
      t.amount,
      t.currency,
      statusAr[t.status] || t.status,
      t.date,
      t.note || ''
    ])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    {wch:5},{wch:20},{wch:22},{wch:22},{wch:22},{wch:12},{wch:8},{wch:10},{wch:18},{wch:28}
  ];

  // Header row style (bold)
  const headerRange = XLSX.utils.decode_range(ws['!ref']);
  for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = { font:{ bold:true }, fill:{ fgColor:{ rgb:'1A2332' } }, alignment:{ horizontal:'center' } };
  }

  XLSX.utils.book_append_sheet(wb, ws, 'سجل العمليات');

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  XLSX.writeFile(wb, `سجل-العمليات-${stamp}.xlsx`);
  notify(`تم تصدير ${rows.length} عملية إلى Excel`);
}

// ── PDF export ──
function txExportPDF() {
  const rows = _txGetFiltered();
  if (!rows.length) { notify('لا توجد بيانات للتصدير', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const statusAr = { completed:'مكتملة', pending:'معلقة', cancelled:'ملغاة', failed:'فاشلة' };
  const sourceAr = { teller:'أقسام التلر', bank:'التحويل البنكي', transfers:'الحوالات الخارجية' };
  const statusColor = {
    completed: [92,184,92], pending: [251,191,36], cancelled: [148,163,184], failed: [239,68,68]
  };

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  // Header
  doc.setFillColor(13, 23, 36);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('International System — Operations Report', 148, 10, { align: 'center' });
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.text(`Generated: ${stamp}  |  Total: ${rows.length} records`, 148, 17, { align: 'center' });

  // Filters info
  const filterParts = [];
  if (_txFilters.source)   filterParts.push(`Source: ${sourceAr[_txFilters.source]}`);
  if (_txFilters.type)     filterParts.push(`Type: ${_txFilters.type}`);
  if (_txFilters.status)   filterParts.push(`Status: ${statusAr[_txFilters.status]}`);
  if (_txFilters.currency) filterParts.push(`Currency: ${_txFilters.currency}`);
  if (filterParts.length) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('Filters: ' + filterParts.join('  |  '), 148, 25, { align: 'center' });
  }

  // Table
  doc.autoTable({
    startY: filterParts.length ? 29 : 26,
    head: [['#', 'المصدر', 'النوع', 'من', 'إلى', 'المبلغ', 'العملة', 'الحالة', 'التاريخ']],
    body: rows.map(t => [
      t.id,
      sourceAr[t.source] || t.source,
      t.type,
      t.from,
      t.to,
      t.amount.toLocaleString(),
      t.currency,
      statusAr[t.status] || t.status,
      t.date
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
      textColor: [224, 231, 239],
      fillColor: [10, 18, 28],
      lineColor: [30, 45, 65],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [20, 35, 55],
      textColor: [212, 175, 55],
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [13, 23, 36] },
    didParseCell: (data) => {
      // Color status column
      if (data.column.index === 7 && data.section === 'body') {
        const t = rows[data.row.index];
        const c = statusColor[t?.status] || [148,163,184];
        data.cell.styles.textColor = c;
      }
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 32 },
      2: { cellWidth: 30 },
      3: { cellWidth: 38 },
      4: { cellWidth: 38 },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 16 },
      7: { cellWidth: 18 },
      8: { cellWidth: 36 },
    },
    margin: { top: 26, right: 8, bottom: 10, left: 8 },
    // Footer
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(75, 85, 99);
      doc.text(
        `Page ${data.pageNumber}  —  International Exchange System`,
        148, doc.internal.pageSize.height - 5,
        { align: 'center' }
      );
    }
  });

  doc.save(`سجل-العمليات-${stamp}.pdf`);
  notify(`تم تصدير ${rows.length} عملية إلى PDF`);
}

// ===================== TREE HIERARCHY CONTROLS =====================
let treeNodes = {
  'teller-mgr': { active: true, features: { '1': true, '2': true, '3': true, '4': true } },
  'teller-dept': { active: true, features: { '1': true, '2': true, '3': true, '4': true } },
  'bank-transfer': { active: true, features: { '1': true, '2': true, '3': true, '4': true } }
};

const nodeNames = {
  'teller-mgr': 'صفحة مشرف التلر',
  'teller-dept': 'صفحة أقسام التلر',
  'bank-transfer': 'صفحة التحويل البنكي'
};

const featNames = {
  'mgr': { '1': 'إدارة المشرفين', '2': 'إدارة الصناديق', '3': 'التقارير', '4': 'الإعدادات' },
  'dept': { '1': 'قسم الصرافة', '2': 'الحوالات الدولية', '3': 'معاملات إلكترونية', '4': 'تسليم مزدوج' },
  'bank': { '1': 'تحويل محلي', '2': 'تحويل دولي', '3': 'SWIFT', '4': 'كشف حساب' }
};

const featKeyMap = { 'mgr': 'teller-mgr', 'dept': 'teller-dept', 'bank': 'bank-transfer' };

function toggleNode(nodeId) {
  const node = treeNodes[nodeId];
  node.active = !node.active;
  const toggle = document.getElementById('toggle-' + nodeId);
  const card = document.getElementById('node-' + nodeId);
  toggle.classList.toggle('active', node.active);
  card.classList.toggle('node-disabled', !node.active);
  updateTreeStats();
  notify(node.active ? 'تم تفعيل ' + nodeNames[nodeId] : 'تم تعطيل ' + nodeNames[nodeId], node.active ? 'success' : 'error');
}

function toggleNodeFeature(prefix, featId) {
  const nodeId = featKeyMap[prefix];
  const node = treeNodes[nodeId];
  if (!node.active) { notify('يجب تفعيل الصفحة أولاً', 'error'); return; }
  node.features[featId] = !node.features[featId];
  const el = document.getElementById('feat-' + prefix + '-' + featId);
  el.textContent = node.features[featId] ? 'مفعّل' : 'معطّل';
  el.className = 'node-feat-status ' + (node.features[featId] ? 'on' : 'off');
  const name = featNames[prefix]?.[featId] || '';
  notify(node.features[featId] ? 'تم تفعيل ' + name : 'تم تعطيل ' + name, node.features[featId] ? 'success' : 'error');
}

function updateTreeStats() {
  let activeCount = 0;
  state.branches.forEach(b => {
    if (b.pages) {
      Object.values(b.pages).forEach(p => { if (p.active) activeCount++; });
    } else {
      activeCount += 3;
    }
  });
  document.getElementById('trActivePages').textContent = activeCount;
  document.getElementById('trTotalSups').textContent = allSups().length;
  document.getElementById('trTotalTellers').textContent = allTellers().length;
  document.getElementById('trBranches').textContent = state.branches.length;
}

// ═══ شجرة الفروع الديناميكية ═══
let activeBranchId = null;

function genPageCard(b, pageType) {
  const bid = b.id;
  const cfg = BRANCH_PAGE_DEFS[pageType];
  if (!cfg) return '';
  const pg = (b.pages && b.pages[pageType]) ? b.pages[pageType] : { active: true };
  const isActive = pg.active !== false;
  return `
    <div class="bp-nc ${isActive ? 'bp-nc-on' : 'bp-nc-off'}"
         style="--bpc:${cfg.color};--bpcrgb:${cfg.rgb}"
         onclick="event.stopPropagation();openPageDetail(${bid},'${pageType}',this)">
      <div class="bp-nc-glow"></div>
      <div class="bp-nc-top-bar"></div>
      <div class="bp-nc-icon-wrap">
        <span class="bp-nc-icon">${cfg.icon}</span>
      </div>
      <div class="bp-nc-body">
        <div class="bp-nc-name">${cfg.name}</div>
        <div class="bp-nc-sub">${cfg.sub}</div>
      </div>
      <div class="bp-nc-footer">
        <span class="bp-nc-dot ${isActive ? 'dot-on' : 'dot-off'}"></span>
        <span class="bp-nc-status-lbl">${isActive ? 'مفعّل' : 'معطّل'}</span>
        <span class="bp-nc-toggle-hint">${isActive ? '⏸' : '▶'}</span>
      </div>
    </div>`;
}

function renderBranchTree() {
  const row = document.getElementById('dynamic-branches-row');
  const panel = document.getElementById('branch-pages-panel');
  if (!row || !panel) return;

  row.innerHTML = state.branches.map(b => {
    const isSelected = activeBranchId === b.id;

    return `
    <div class="branch-tree-item">
      <div class="tree-branch-connector"></div>
      <div class="bn-card ${isSelected ? 'bn-card-open' : ''} ${b.isMain ? 'bn-card-main' : ''}"
           onclick="toggleBranchPages(${b.id})">

        <!-- Top row: name + actions -->
        <div class="bn-top">
          <div class="bn-top-left">
            <div class="bn-dot ${b.status === 'active' ? 'bn-dot-on' : 'bn-dot-off'}"></div>
            <div class="bn-name">${b.name}</div>
            ${b.isMain ? '<span class="bn-main-badge">رئيسي</span>' : ''}
          </div>
          <div class="bn-top-actions">
            <button class="bn-action-btn" onclick="event.stopPropagation();openBranchPagesManager(${b.id})" title="إدارة الصفحات">
              <span>⚙️</span>
            </button>
            <div class="bn-chevron ${isSelected ? 'bn-chevron-open' : ''}">❯</div>
          </div>
        </div>


      </div>
    </div>`;
  }).join('');

  if (activeBranchId !== null) {
    const branch = state.branches.find(b => b.id === activeBranchId);
    if (branch) {
      panel.style.display = 'block';
      panel.style.animation = 'fadeUp 0.4s ease';
      document.getElementById('active-branch-label').textContent = 'صفحات: ' + branch.name;
      const pageKeys = branch.pages ? Object.keys(branch.pages) : [];
      document.getElementById('active-branch-pages').innerHTML =
        `<div class="bp-nc-grid">` +
        (pageKeys.length
          ? pageKeys.map(k => genPageCard(branch, k)).join('')
          : `<div class="bp-nc-empty">لا توجد صفحات — اضغط للإضافة</div>`) +
        `</div>`;
    }
  } else {
    panel.style.display = 'none';
  }
}

function toggleBranchPages(branchId) {
  if (activeBranchId !== branchId) closePageDetail();
  activeBranchId = activeBranchId === branchId ? null : branchId;
  renderBranchTree();
}

function toggleBranchPage(branchId, pageType) {
  const b = state.branches.find(b => b.id === branchId);
  if (!b) return;
  if (!b.pages) b.pages = {};
  if (!b.pages[pageType]) b.pages[pageType] = {active:true, features:{1:true,2:true,3:true,4:true}};
  b.pages[pageType].active = !b.pages[pageType].active;
  notify(b.pages[pageType].active ? 'تم تفعيل الصفحة' : 'تم تعطيل الصفحة', b.pages[pageType].active ? 'success' : 'error');
  renderBranchTree();
  updateTreeStats();
}

// ═══ Branch Pages Manager ═══
let _bpmBranchId = null;

function openBranchPagesManager(branchId) {
  _bpmBranchId = branchId;
  const b = state.branches.find(b => b.id === branchId);
  if (!b) return;
  const nameEl = document.getElementById('bpmBranchName');
  if (nameEl) nameEl.textContent = b.name;
  renderBranchPagesManager();
  openModal('branch-pages-manager');
}

function renderBranchPagesManager() {
  const b = state.branches.find(b => b.id === _bpmBranchId);
  if (!b) return;
  if (!b.pages) b.pages = {};

  // Current pages list
  const curList = document.getElementById('bpmCurrentPages');
  const pageKeys = Object.keys(b.pages);
  if (curList) {
    if (pageKeys.length === 0) {
      curList.innerHTML = '<div class="bpm-empty">لا توجد صفحات مضافة بعد</div>';
    } else {
      curList.innerHTML = pageKeys.map(key => {
        const def = BRANCH_PAGE_DEFS[key];
        if (!def) return '';
        const pg = b.pages[key];
        const isOn = pg.active !== false;
        return `
          <div class="bpm-cur-card" style="--bpc:${def.color};--bpcrgb:${def.rgb}">
            <div class="bpm-cc-left">
              <div class="bpm-cc-icon">${def.icon}</div>
              <div>
                <div class="bpm-cc-name">${def.name}</div>
                <div class="bpm-cc-sub">${def.sub}</div>
              </div>
            </div>
            <div class="bpm-cc-right">
              <button class="bpm-toggle-btn ${isOn ? 'on' : 'off'}"
                      onclick="bpmTogglePage('${key}')">
                ${isOn ? 'مفعّل' : 'معطّل'}
              </button>
              <button class="bpm-del-btn" onclick="bpmDeletePage('${key}')" title="حذف">✕</button>
            </div>
          </div>`;
      }).join('');
    }
  }

  // Available pages to add (not yet in branch)
  const availRow = document.getElementById('bpmAvailPages');
  const addSection = document.getElementById('bpmAddSection');
  if (availRow) {
    const missing = Object.entries(BRANCH_PAGE_DEFS).filter(([k]) => !b.pages[k]);
    if (missing.length === 0) {
      if (addSection) addSection.style.display = 'none';
    } else {
      if (addSection) addSection.style.display = '';
      availRow.innerHTML = missing.map(([key, def]) => `
        <div class="bpm-avail-chip" style="--bpc:${def.color};--bpcrgb:${def.rgb}"
             onclick="bpmAddPage('${key}')">
          <span class="bpm-ac-plus">+</span>
          <span>${def.icon}</span>
          <span>${def.name}</span>
        </div>`).join('');
    }
  }
}

function bpmAddPage(pageKey) {
  const b = state.branches.find(b => b.id === _bpmBranchId);
  if (!b || !BRANCH_PAGE_DEFS[pageKey]) return;
  if (!b.pages) b.pages = {};
  b.pages[pageKey] = { active: true, features: {1:true,2:true,3:true,4:true} };
  notify('تمت إضافة ' + BRANCH_PAGE_DEFS[pageKey].name);
  renderBranchPagesManager();
  updateTreeStats();
}

function bpmDeletePage(pageKey) {
  const b = state.branches.find(b => b.id === _bpmBranchId);
  if (!b || !b.pages) return;
  const def = BRANCH_PAGE_DEFS[pageKey];
  delete b.pages[pageKey];
  notify('تم حذف ' + (def ? def.name : pageKey), 'error');
  renderBranchPagesManager();
  updateTreeStats();
}

function bpmTogglePage(pageKey) {
  const b = state.branches.find(b => b.id === _bpmBranchId);
  if (!b || !b.pages || !b.pages[pageKey]) return;
  b.pages[pageKey].active = !b.pages[pageKey].active;
  const def = BRANCH_PAGE_DEFS[pageKey];
  const isOn = b.pages[pageKey].active;
  notify((isOn ? 'تم تفعيل ' : 'تم تعطيل ') + (def ? def.name : pageKey), isOn ? 'success' : 'error');
  renderBranchPagesManager();
  updateTreeStats();
}

// ═══ Page Detail Modal ═══
let _pdBranchId = null, _pdPageKey = null;

function openPageDetail(branchId, pageKey, cardEl) {
  const b   = state.branches.find(b => b.id === branchId);
  const def = BRANCH_PAGE_DEFS[pageKey];
  if (!b || !def) return;

  _pdBranchId = branchId;
  _pdPageKey  = pageKey;

  // Apply theme color
  const card = document.getElementById('pdm-card');
  card.style.setProperty('--bpc',    def.color);
  card.style.setProperty('--bpcrgb', def.rgb);

  // Header
  document.getElementById('pdm-icon').textContent      = def.icon;
  document.getElementById('pdm-page-name').textContent = def.name;
  document.getElementById('pdm-branch-tag').textContent = b.name + '  ·  ' + def.sub;

  // Accent bar animated gradient
  document.getElementById('pdm-accent').style.background =
    `linear-gradient(90deg, transparent, ${def.color}, ${def.color}88, transparent)`;

  // Header glow
  document.getElementById('pdm-hd-glow').style.background =
    `radial-gradient(ellipse at 30% 0%, rgba(${def.rgb},0.18) 0%, transparent 70%)`;

  // Icon ring
  document.getElementById('pdm-icon-ring').style.cssText +=
    `;background:rgba(${def.rgb},0.14);border-color:rgba(${def.rgb},0.3)`;

  // Stats + body
  _fillPdModal(b, pageKey, def);

  // Show overlay
  const overlay = document.getElementById('pdm-overlay');
  overlay.classList.add('pdm-open');
  document.body.style.overflow = 'hidden';
}

function closePdModal() {
  document.getElementById('pdm-overlay').classList.remove('pdm-open');
  document.body.style.overflow = '';
  document.querySelectorAll('.bp-nc').forEach(el => el.classList.remove('bp-nc-selected'));
  _pdBranchId = null; _pdPageKey = null;
}

// Alias kept for backward-compat
const closePageDetail = closePdModal;

function _fillPdModal(b, pageKey, def) {
  const statsEl = document.getElementById('pdm-stats-strip');
  const bodyEl  = document.getElementById('pdm-body');

  /* ── helpers ── */
  const stat = (val, lbl, cls='') =>
    `<div class="pdm-stat"><div class="pdm-stat-val ${cls}">${val}</div><div class="pdm-stat-lbl">${lbl}</div></div>`;

  const row = (avatarContent, avatarClass, name, meta, badgeHtml, rightSub) => `
    <div class="pdm-row">
      <div class="pdm-av ${avatarClass}">${avatarContent}</div>
      <div class="pdm-ri">
        <div class="pdm-rname">${name}</div>
        <div class="pdm-rmeta">${meta}</div>
      </div>
      <div class="pdm-rr">
        ${badgeHtml}
        ${rightSub ? `<div class="pdm-rsub">${rightSub}</div>` : ''}
      </div>
    </div>`;

  const badge = (label, type) =>
    `<span class="pdm-badge pdm-badge-${type}">${label}</span>`;

  const empty = msg =>
    `<div class="pdm-empty"><div class="pdm-empty-icon">📭</div><div>${msg}</div></div>`;

  /* ── tellerMgr ── */
  if (pageKey === 'tellerMgr') {
    const sups = b.supervisors || [];
    statsEl.innerHTML =
      stat(sups.length, 'مشرف') +
      stat(sups.filter(s=>s.status==='active').length, 'نشط', 'val-green') +
      stat((b.tellers||[]).length, 'إجمالي التلرات', 'val-blue');
    bodyEl.innerHTML = !sups.length ? empty('لا يوجد مشرفون مضافون بعد') :
      sups.map(s => {
        const cnt = (b.tellers||[]).filter(t=>t.supervisorId===s.id).length;
        return row(s.name.charAt(0), 'av-sup',
          s.name, `${s.phone}  ·  وردية: ${s.shift}`,
          badge(s.status==='active'?'نشط':'غير نشط', s.status==='active'?'on':'off'),
          cnt + ' تلر تحته');
      }).join('');
    return;
  }

  /* ── tellerDept ── */
  if (pageKey === 'tellerDept') {
    const tellers = b.tellers || [];
    const openCnt = tellers.filter(t=>t.box&&t.box.status==='open').length;
    const totalUSD = tellers.reduce((s,t)=> s + (t.box&&t.box.currency==='USD'?t.box.balance:0), 0);
    statsEl.innerHTML =
      stat(tellers.length, 'تلر') +
      stat(openCnt, 'صندوق مفتوح', 'val-green') +
      stat(fmtCur(totalUSD,'USD'), 'إجمالي USD', 'val-blue');
    bodyEl.innerHTML = !tellers.length ? empty('لا توجد تلرات مضافة بعد') :
      tellers.map(t => {
        const sup     = (b.supervisors||[]).find(s=>s.id===t.supervisorId);
        const boxOpen = t.box && t.box.status === 'open';
        return row(t.name.charAt(0), 'av-teller',
          t.name, `${sup?sup.name:'—'}`,
          badge(boxOpen?'مفتوح':'مغلق', boxOpen?'on':'off'),
          fmtCur(t.box?t.box.balance:0, t.box?t.box.currency:'USD'));
      }).join('');
    return;
  }

  /* ── bankTransfer ── */
  if (pageKey === 'bankTransfer') {
    const txs = state.transactions.filter(tx=>tx.type==='تحويل بين فروع');
    statsEl.innerHTML =
      stat(txs.length, 'تحويل') +
      stat(txs.filter(t=>t.status==='completed').length, 'مكتمل', 'val-green') +
      stat(txs.filter(t=>t.status==='pending').length, 'معلق', 'val-orange');
    bodyEl.innerHTML = !txs.length ? empty('لا توجد تحويلات بنكية') :
      txs.map(tx =>
        row('🏦', 'av-bank',
          `${tx.from} ← ${tx.to}`, `${tx.date}`,
          badge(tx.status==='completed'?'مكتمل':'معلق', tx.status==='completed'?'on':'pend'),
          fmtCur(tx.amount, tx.currency))
      ).join('');
    return;
  }

  /* ── transSuper ── */
  if (pageKey === 'transSuper') {
    const sups = b.supervisors || [];
    statsEl.innerHTML =
      stat(sups.length, 'مشرف') +
      stat(state.transactions.filter(t=>t.status==='completed').length, 'حوالة مكتملة', 'val-green') +
      stat(state.transactions.filter(t=>t.status==='pending').length, 'بانتظار الموافقة', 'val-orange');
    bodyEl.innerHTML = !sups.length ? empty('لا يوجد مشرفو حوالات بعد') :
      sups.map(s =>
        row(s.name.charAt(0), 'av-trans',
          s.name, `${s.phone}  ·  وردية: ${s.shift}`,
          badge(s.status==='active'?'نشط':'غير نشط', s.status==='active'?'on':'off'))
      ).join('');
    return;
  }

  /* ── transactions ── */
  if (pageKey === 'transactions') {
    const txs = state.transactions.slice(0, 10);
    statsEl.innerHTML =
      stat(state.transactions.length, 'إجمالي') +
      stat(state.transactions.filter(t=>t.status==='completed').length, 'مكتمل', 'val-green') +
      stat(state.transactions.filter(t=>t.status==='pending').length, 'معلق', 'val-orange');
    bodyEl.innerHTML = !txs.length ? empty('لا توجد حوالات بعد') :
      txs.map(tx =>
        row('🔄', 'av-tx',
          `${tx.type}: ${tx.from} ← ${tx.to}`, `${tx.date}`,
          badge(tx.status==='completed'?'مكتمل':'معلق', tx.status==='completed'?'on':'pend'),
          fmtCur(tx.amount, tx.currency))
      ).join('');
    return;
  }
}

// legacy compat (unused but kept safe)
function toggleBranchPages_legacy() {}

// Init
// ── وضع فاتح/داكن ──
const _SUN_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const _MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
function toggleTheme() { /* dark mode only — light mode disabled */ }


// ═══════════════════════════════════════════════════════
//  USER MANAGEMENT & ACCESS CONTROL — Dashboard Module
// ═══════════════════════════════════════════════════════

const ROLE_NAMES = {
  'M01': 'مدير عام',
  'M02': 'مشرف التلر',
  'M03': 'مشرف الحوالات',
  'T01': 'تلر',
  'T02': 'موظف بنك',
  'T03': 'موظف حوالات'
};

const ROLE_PAGES = {
  'M01': '/dashboard/',
  'M02': '/supervisor/teller/',
  'M03': '/transactions/supervisor/',
  'T01': '/teller/',
  'T02': '/accounts/',
  'T03': '/transactions/'
};

const ROLE_ICONS = {
  'M01': '🏛️', 'M02': '👔', 'M03': '🌐', 'T01': '💼', 'T02': '🏦', 'T03': '🌍'
};

const ALL_PAGES = [
  { id: 'dashboard',              label: 'لوحة التحكم',        icon: '📊', file: '/dashboard/' },
  { id: 'teller-supervisor',      label: 'مشرف التلر',          icon: '👔', file: '/supervisor/teller/' },
  { id: 'transactions-supervisor',label: 'مشرف الحوالات',       icon: '🌐', file: '/transactions/supervisor/' },
  { id: 'teller-departments',     label: 'أقسام التلر',         icon: '💼', file: '/teller/' },
  { id: 'accounts',               label: 'التحويل البنكي',      icon: '🏦', file: '/accounts/' },
  { id: 'transactions',           label: 'الحوالات الخارجية',   icon: '🌍', file: '/transactions/' },
];

renderAll();
updateTreeStats();

// ── بيانات المستخدم وتسجيل الخروج ──
function logout() {
  
  window.location.href = '/logout/';
}
(function() {
  try {
    const u = (window._currentUser || {});
    if (u.username) {
      const el = document.getElementById('userDisplayName');
      const rl = document.getElementById('userDisplayRole');
      if (el) el.textContent = u.username;
      if (rl) rl.textContent = u.roleName || u.role;
    }
  } catch(e) {}
})();


// ── Helpers ──────────────────────────────────────────

function getSystemUsers() {
  try { return JSON.parse(localStorage.getItem('sys_users') || '[]'); } catch(e) { return []; }
}

function saveSystemUsers(users) {
  localStorage.setItem('sys_users', JSON.stringify(users));
}

// تحويل استجابة API → صيغة localStorage المحلية
function _apiUserToLocal(u) {
  return {
    username:  u.username,
    role:      u.role,
    fullname:  (u.name || ((u.firstName || '') + ' ' + (u.lastName || '')).trim()) || u.username,
    active:    u.isActive !== false,
    lastLogin: u.lastLogin || null,
    createdAt: u.dateJoined || null,
    email:     u.email || '',
  };
}

// ── Transfers Supervisors (مشرفو الحوالات) ────────────────
function getTransfersSupervisors() {
  try { return JSON.parse(localStorage.getItem('intl_sv_supervisors') || '[]'); } catch(e) { return []; }
}

function saveTransfersSupervisors(list) {
  localStorage.setItem('intl_sv_supervisors', JSON.stringify(list));
}

const _PERM_DEFAULTS = {
  'M01': ['dashboard','teller-supervisor','transactions-supervisor','teller-departments','accounts','transactions'],
  'M02': ['teller-supervisor','teller-departments'],
  'M03': ['transactions-supervisor','transactions'],
  'T01': ['teller-departments'],
  'T02': ['accounts'],
  'T03': ['transactions']
};

// in-memory cache — loaded once from server on first call
let _permCache = null;

function getPermissions() {
  if (_permCache) return _permCache;
  // sync fallback from localStorage (populated by loadPermissionsFromServer)
  try {
    const saved = JSON.parse(localStorage.getItem('sys_permissions') || 'null');
    return saved || Object.assign({}, _PERM_DEFAULTS);
  } catch(e) { return Object.assign({}, _PERM_DEFAULTS); }
}

function loadPermissionsFromServer() {
  return apiGet('/api/admin/permissions/')
    .then(resp => {
      if (resp.success && resp.permissions) {
        _permCache = resp.permissions;
        localStorage.setItem('sys_permissions', JSON.stringify(_permCache));
        renderPermMatrix();
      }
    })
    .catch(() => {});
}

function _savePermissionsToServer(perms) {
  return apiPost('/api/admin/permissions/', { permissions: perms })
    .then(resp => {
      if (resp.success && resp.permissions) {
        _permCache = resp.permissions;
        localStorage.setItem('sys_permissions', JSON.stringify(_permCache));
      }
      return resp;
    });
}

function savePermissions() {
  const perms = getPermissions();
  _savePermissionsToServer(perms)
    .then(resp => {
      if (resp && resp.success) notify('تم حفظ الصلاحيات بنجاح');
      else notify('حدث خطأ أثناء الحفظ', 'error');
    })
    .catch(() => notify('تعذّر الاتصال بالخادم', 'error'));
}

function resetPermissions() {
  _savePermissionsToServer(_PERM_DEFAULTS)
    .then(resp => {
      _permCache = Object.assign({}, _PERM_DEFAULTS);
      localStorage.setItem('sys_permissions', JSON.stringify(_permCache));
      renderPermMatrix();
      notify('تم إعادة ضبط الصلاحيات');
    })
    .catch(() => {
      localStorage.removeItem('sys_permissions');
      _permCache = null;
      renderPermMatrix();
      notify('تم إعادة الضبط محلياً فقط');
    });
}

// ── Users Stats ──────────────────────────────────────

function renderUsersStats() {
  const users = getSystemUsers();
  const active   = users.filter(u => u.active !== false).length;
  const inactive = users.length - active;
  const withTOTP = users.filter(u => localStorage.getItem('totp_verified_' + u.username)).length;

  const el = document.getElementById('users-stats-row');
  if (!el) return;

  const stats = [
    { val: users.length, label: 'إجمالي المستخدمين', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`, color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
    { val: active,       label: 'مستخدمون نشطون',    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`, color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
    { val: withTOTP,     label: 'مفعّلو المصادقة الثنائية', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    { val: inactive,     label: 'حسابات موقوفة',       icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`, color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  ];

  el.innerHTML = stats.map(s => `
    <div class="um-stat-card" style="--um-sc:${s.color};--um-sc-bg:${s.bg}">
      <div class="um-stat-icon">${s.icon}</div>
      <div>
        <div class="um-stat-val">${s.val}</div>
        <div class="um-stat-label">${s.label}</div>
      </div>
    </div>`).join('');

  // filter tab counts
  const t = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  t('uft-all',      users.length);
  t('uft-active',   active);
  t('uft-inactive', inactive);
  t('uft-2fa',      withTOTP);

  const badge = document.getElementById('sb-users');
  if (badge) badge.textContent = users.length;
}

// ── Users Table ──────────────────────────────────────

function renderUsersTable() {
  const body = document.getElementById('users-table-body');
  if (!body) return;
  body.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b;font-size:13px">جارٍ تحميل المستخدمين...</div>';

  apiGet('/api/users')
    .then(resp => {
      if (resp.success && Array.isArray(resp.users)) {
        const serverUsers = resp.users.map(_apiUserToLocal);
        saveSystemUsers(serverUsers);
        if (resp.roleCounts) {
          try { localStorage.setItem('sys_role_counts', JSON.stringify(resp.roleCounts)); } catch(e) {}
        }
      }
      _renderUsersTableRows();
    })
    .catch(() => _renderUsersTableRows());
}

// avatar gradient colours per letter
const _UM_COLORS = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#0284c7','#0d9488','#b45309','#9333ea'];
function _umAvatarColor(name) { return _UM_COLORS[(name.charCodeAt(0) || 0) % _UM_COLORS.length]; }

let _umFilter = 'all';
let _umSearch = '';

function umSetFilter(f, btn) {
  _umFilter = f;
  document.querySelectorAll('.um-filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _renderUsersTableRows();
}

function umFilter(q) {
  _umSearch = q.trim().toLowerCase();
  _renderUsersTableRows();
}

function _renderUsersTableRows() {
  renderUsersStats();
  let users = getSystemUsers();
  const body   = document.getElementById('users-table-body');
  const empty  = document.getElementById('um-empty');
  if (!body) return;

  // apply filter tab
  if (_umFilter === 'active')   users = users.filter(u => u.active !== false);
  if (_umFilter === 'inactive') users = users.filter(u => u.active === false);
  if (_umFilter === '2fa')      users = users.filter(u => !!localStorage.getItem('totp_verified_' + u.username));

  // apply search
  if (_umSearch) {
    users = users.filter(u =>
      u.username.toLowerCase().includes(_umSearch) ||
      (u.fullname || '').toLowerCase().includes(_umSearch) ||
      (u.role || '').toLowerCase().includes(_umSearch)
    );
  }

  if (users.length === 0) {
    body.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  body.innerHTML = users.map((u, i) => {
    const has2FA   = !!localStorage.getItem('totp_verified_' + u.username);
    const isActive = u.active !== false;
    const lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : '—';
    const roleIcon = ROLE_ICONS[u.role] || '👤';
    const roleName = ROLE_NAMES[u.role] || u.role;
    const avatarBg = _umAvatarColor(u.username);
    const initial  = u.username.charAt(0).toUpperCase();

    const toggleIcon = isActive
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

    return `
    <tr class="${isActive ? '' : 'um-row-inactive'}">
      <td style="color:var(--text-nav,#475569);font-size:12px;text-align:center">${i + 1}</td>
      <td>
        <div class="um-user-cell">
          <div class="um-avatar" style="background:linear-gradient(135deg,${avatarBg},${avatarBg}99)">${initial}</div>
          <div>
            <div class="um-user-name">${u.username}</div>
            <div class="um-user-full">${u.fullname || '—'}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="um-role-badge">${roleIcon} ${u.role} · ${roleName}</span>
      </td>
      <td style="font-size:12px;color:var(--text-nav,#64748b)">${lastLogin}</td>
      <td>
        ${has2FA
          ? `<span class="um-2fa-on">مفعّل</span>`
          : `<span class="um-2fa-off">— غير مفعّل</span>`}
      </td>
      <td>
        <span class="um-status ${isActive ? 'um-status-active' : 'um-status-inactive'}">
          <span class="um-status-dot"></span>
          ${isActive ? 'نشط' : 'موقوف'}
        </span>
      </td>
      <td>
        <div class="um-actions">
          <button class="um-action-btn" onclick="showUserDetail('${u.username}')" title="تفاصيل">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </button>
          <button class="um-action-btn ${isActive ? 'danger' : 'success'}" onclick="toggleUserActive('${u.username}')" title="${isActive ? 'إيقاف' : 'تفعيل'}">
            ${toggleIcon}
          </button>
          <button class="um-action-btn danger" onclick="deleteUser('${u.username}')" title="حذف">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Add User Modal Helpers ─────────────────────────────

function openAddUserModal() {
  // reset fields
  document.getElementById('nu-username').value = '';
  document.getElementById('nu-password').value = '';
  document.getElementById('nu-fullname').value = '';
  document.getElementById('nu-role').value = 'M01';
  // reset role cards
  document.querySelectorAll('#au-roles-grid .au-role-card').forEach(c => c.classList.remove('selected'));
  const first = document.querySelector('#au-roles-grid .au-role-card');
  if (first) first.classList.add('selected');
  // open overlay
  document.getElementById('add-user-modal').classList.add('open');
}

function closeAddUserModal() {
  document.getElementById('add-user-modal').classList.remove('open');
}

function auOverlayClick(e) {
  if (e.target === document.getElementById('add-user-modal')) closeAddUserModal();
}

function auSelectRole(card, role) {
  document.querySelectorAll('#au-roles-grid .au-role-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  document.getElementById('nu-role').value = role;
}

// ── Add User ─────────────────────────────────────────

function addSystemUser() {
  const username  = document.getElementById('nu-username').value.trim();
  const password  = document.getElementById('nu-password').value.trim();
  const role      = document.getElementById('nu-role').value;
  const fullname  = document.getElementById('nu-fullname').value.trim();
  const nameParts = fullname.split(' ');
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';

  if (!username || !password) { notify('يرجى إدخال اسم المستخدم وكلمة المرور'); return; }
  if (password.length < 12)   { notify('كلمة المرور يجب أن تكون 12 حرفاً على الأقل'); return; }

  const btn = document.querySelector('#add-user-modal .btn-gold, #add-user-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الإضافة...'; }

  apiPost('/api/users', { username, password, firstName, lastName, role })
    .then(resp => {
      if (btn) { btn.disabled = false; btn.textContent = 'إضافة المستخدم'; }
      if (!resp.success) { if (!resp._expired) notify(resp.message || 'فشل إضافة المستخدم'); return; }

      // تحديث الـ cache المحلي فوراً
      const users = getSystemUsers();
      if (!users.find(u => u.username === username)) {
        users.push(_apiUserToLocal(resp.user));
        saveSystemUsers(users);
      }

      closeAddUserModal();
      renderUsersTable();
      notify('تم إضافة المستخدم ' + username + ' بنجاح');
    })
    .catch(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'إضافة المستخدم'; }
      notify('لا يوجد اتصال بالخادم');
    });
}

// ── Toggle User Active ────────────────────────────────

function toggleUserActive(username) {
  const users = getSystemUsers();
  const u = users.find(x => x.username === username);
  if (!u) return;
  const newActive = !(u.active !== false);

  // تحديث محلي فوري للـ UI
  u.active = newActive;
  saveSystemUsers(users);
  _renderUsersTableRows();

  // مزامنة مع الخادم
  apiPatch('/api/users/' + encodeURIComponent(username), { isActive: newActive })
    .then(resp => {
      if (!resp.success) notify(resp.message || 'تعذّر تحديث الحالة على الخادم');
    })
    .catch(() => notify('لا اتصال — تم التحديث محلياً فقط'));
}

// ── Delete User ───────────────────────────────────────

function deleteUser(username) {
  if (!confirm('هل أنت متأكد من حذف المستخدم ' + username + '؟')) return;

  apiDelete('/api/users/' + encodeURIComponent(username))
    .then(resp => {
      if (!resp.success) { notify(resp.message || 'فشل حذف المستخدم'); return; }
      const users = getSystemUsers().filter(u => u.username !== username);
      saveSystemUsers(users);
      localStorage.removeItem('totp_' + username);
      localStorage.removeItem('totp_verified_' + username);
      closeModal('user-detail-modal');
      _renderUsersTableRows();
      notify('تم حذف المستخدم ' + username);
    })
    .catch(() => notify('لا يوجد اتصال بالخادم'));
}

// ── Reset 2FA ─────────────────────────────────────────

function reset2FAUser(username) {
  localStorage.removeItem('totp_' + username);
  localStorage.removeItem('totp_verified_' + username);
  closeModal('user-detail-modal');
  renderUsersTable();
  notify('تم إعادة ضبط 2FA للمستخدم ' + username + ' — سيُطلب منه مسح QR عند الدخول التالي');
}

// ══════════════════════════════════════════════════════
// UED — User Edit Drawer
// ══════════════════════════════════════════════════════

let _uedUsername = null;
let _uedUser     = null;

function showUserDetail(username) { uedOpen(username); }

function uedOpen(username) {
  _uedUsername = username;
  _uedUser = null;

  // open drawer
  document.getElementById('ued-overlay').classList.add('open');
  document.getElementById('ued-drawer').classList.add('open');
  uedSwitchTab('info');

  // set placeholder header
  const avatarColor = _umAvatarColor(username);
  const avatarEl = document.getElementById('ued-avatar');
  avatarEl.textContent = username.charAt(0).toUpperCase();
  avatarEl.style.background = `linear-gradient(135deg,${avatarColor},${avatarColor}99)`;
  document.getElementById('ued-hdr-name').textContent = username;
  document.getElementById('ued-hdr-role').textContent = 'جارٍ التحميل...';
  document.getElementById('ued-info-grid').innerHTML =
    '<div style="grid-column:span 2;text-align:center;padding:30px;color:#334155"></div>';

  // fetch from server
  apiGet('/api/users/' + encodeURIComponent(username))
    .then(resp => {
      const raw   = resp.success && resp.user ? resp.user : null;
      const local = getSystemUsers().find(x => x.username === username) || {};
      _uedUser    = raw ? _apiUserToLocal(raw) : (local.username ? local : null);
      if (!_uedUser) return;

      if (raw) {
        const users = getSystemUsers();
        const idx = users.findIndex(x => x.username === username);
        if (idx !== -1) users[idx] = _uedUser; else users.push(_uedUser);
        saveSystemUsers(users);
      }
      _uedRenderInfo();
      _uedFillEditForm();
    })
    .catch(() => {
      const local = getSystemUsers().find(x => x.username === username);
      if (local) { _uedUser = local; _uedRenderInfo(); _uedFillEditForm(); }
    });
}

function uedClose() {
  document.getElementById('ued-overlay').classList.remove('open');
  document.getElementById('ued-drawer').classList.remove('open');
  _uedUsername = null;
  _uedUser = null;
}

function uedSwitchTab(tab) {
  document.querySelectorAll('.ued-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ued-panel').forEach(p => p.classList.remove('active'));
  const tabEl   = document.getElementById('ued-tab-' + tab);
  const panelEl = document.getElementById('ued-panel-' + tab);
  if (tabEl)   tabEl.classList.add('active');
  if (panelEl) panelEl.classList.add('active');
  // clear password fields when switching away
  if (tab !== 'password') {
    ['ued-pw1','ued-pw2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const fill = document.getElementById('ued-pw-fill');
    const lbl  = document.getElementById('ued-pw-lbl');
    if (fill) { fill.style.width = '0'; fill.style.background = ''; }
    if (lbl)  lbl.textContent = '';
  }
}

function _uedRenderInfo() {
  const u = _uedUser;
  if (!u) return;
  const isActive  = u.active !== false;
  const has2FA    = !!localStorage.getItem('totp_verified_' + u.username);
  const roleName  = ROLE_NAMES[u.role] || u.role;
  const createdAt = u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : '—';
  const lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : '—';

  document.getElementById('ued-hdr-role').textContent = (ROLE_ICONS[u.role] || '👤') + ' ' + u.role + ' · ' + roleName;

  const toggleBtn = document.getElementById('ued-toggle-lbl');
  const warnBtn   = document.querySelector('.ued-btn-warning');
  if (toggleBtn) toggleBtn.textContent = isActive ? 'إيقاف الحساب' : 'تفعيل الحساب';
  if (warnBtn)   warnBtn.style.color   = isActive ? '' : '#4ade80';

  const items = [
    { lbl: 'اسم المستخدم', val: u.username },
    { lbl: 'الاسم الكامل', val: u.fullname || '—' },
    { lbl: 'الدور',        val: u.role + ' · ' + roleName },
    { lbl: 'البريد',       val: u.email || '—' },
    { lbl: 'الحالة',       val: isActive
        ? '<span style="color:#4ade80">● نشط</span>'
        : '<span style="color:#f87171">● موقوف</span>' },
    { lbl: 'المصادقة الثنائية', val: has2FA
        ? '<span style="color:#a78bfa">مفعّلة</span>'
        : '<span style="color:#475569">— غير مفعّلة</span>' },
    { lbl: 'تاريخ الإنشاء', val: createdAt },
    { lbl: 'آخر دخول',     val: lastLogin },
  ];

  document.getElementById('ued-info-grid').innerHTML =
    items.map(it => `
      <div class="ued-info-card">
        <div class="ued-info-lbl">${it.lbl}</div>
        <div class="ued-info-val">${it.val}</div>
      </div>`).join('');
}

function _uedFillEditForm() {
  const u = _uedUser;
  if (!u) return;

  const fullname   = u.fullname || '';
  const parts      = fullname.split(' ');
  document.getElementById('ued-firstname').value = parts[0] || '';
  document.getElementById('ued-lastname').value  = parts.slice(1).join(' ') || '';
  document.getElementById('ued-email').value     = u.email || '';
  document.getElementById('ued-role').value      = u.role  || '';

  // Build role cards
  const grid = document.getElementById('ued-role-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(ROLE_NAMES).map(([code, name]) => `
    <div class="ued-role-card ${u.role === code ? 'selected' : ''}"
         onclick="uedSelectRole('${code}',this)">
      <div class="ued-role-card-code">${ROLE_ICONS[code] || ''} ${code}</div>
      <div class="ued-role-card-name">${name}</div>
    </div>`).join('');
}

function uedSelectRole(code, el) {
  document.querySelectorAll('.ued-role-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('ued-role').value = code;
}

// ── Save edit ──────────────────────────────────────────
function uedSaveEdit(e) {
  e.preventDefault();
  const btn = document.getElementById('ued-save-btn');
  const firstName = document.getElementById('ued-firstname').value.trim();
  const lastName  = document.getElementById('ued-lastname').value.trim();
  const email     = document.getElementById('ued-email').value.trim();
  const role      = document.getElementById('ued-role').value;

  btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';

  apiPatch('/api/users/' + encodeURIComponent(_uedUsername), { firstName, lastName, email, role })
    .then(resp => {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> حفظ التعديلات`;
      if (!resp.success) { notify(resp.message || 'فشل الحفظ'); return; }
      // update local cache
      if (resp.user) {
        _uedUser = _apiUserToLocal(resp.user);
        const users = getSystemUsers();
        const idx = users.findIndex(x => x.username === _uedUsername);
        if (idx !== -1) users[idx] = _uedUser; else users.push(_uedUser);
        saveSystemUsers(users);
      }
      notify('تم حفظ التعديلات بنجاح');
      _uedRenderInfo();
      _uedFillEditForm();
      _renderUsersTableRows();
      uedSwitchTab('info');
    })
    .catch(() => {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg> حفظ التعديلات`;
      notify('لا يوجد اتصال');
    });
}

// ── Save password ──────────────────────────────────────
function uedSavePassword(e) {
  e.preventDefault();
  const pw1 = document.getElementById('ued-pw1').value;
  const pw2 = document.getElementById('ued-pw2').value;
  if (!pw1) { notify('أدخل كلمة المرور الجديدة'); return; }
  if (pw1.length < 12) { notify('كلمة المرور يجب ألا تقل عن 12 حرفاً'); return; }
  if (pw1 !== pw2) { notify('كلمتا المرور غير متطابقتين'); return; }

  const btn = document.getElementById('ued-pw-save-btn');
  btn.disabled = true; btn.textContent = 'جارٍ التغيير...';

  apiPost('/api/users/' + encodeURIComponent(_uedUsername) + '/password', { password: pw1 })
    .then(resp => {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> تغيير كلمة المرور`;
      if (!resp.success) { notify(resp.message || 'فشل تغيير كلمة المرور'); return; }
      notify('تم تغيير كلمة المرور وإلغاء جميع الجلسات');
      document.getElementById('ued-pw1').value = '';
      document.getElementById('ued-pw2').value = '';
      uedSwitchTab('info');
    })
    .catch(() => {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> تغيير كلمة المرور`;
      notify('لا يوجد اتصال');
    });
}

// ── Password strength ──────────────────────────────────
function uedPwStrength() {
  const pw   = document.getElementById('ued-pw1').value;
  const fill = document.getElementById('ued-pw-fill');
  const lbl  = document.getElementById('ued-pw-lbl');
  if (!fill || !lbl) return;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { w: '0%',   c: '',        t: '' },
    { w: '25%',  c: '#f87171', t: 'ضعيفة' },
    { w: '50%',  c: '#fb923c', t: 'مقبولة' },
    { w: '75%',  c: '#fbbf24', t: 'جيدة' },
    { w: '90%',  c: '#4ade80', t: 'قوية' },
    { w: '100%', c: '#4ade80', t: 'ممتازة' },
  ];
  const lvl = levels[Math.min(score, 5)];
  fill.style.width      = lvl.w;
  fill.style.background = lvl.c;
  lbl.textContent       = lvl.t;
  lbl.style.color       = lvl.c;
}

function uedTogglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.style.color = isHidden ? '#38bdf8' : '#475569';
}

// ── Toggle active ──────────────────────────────────────
function uedToggleActive() {
  if (!_uedUsername) return;
  const isActive = _uedUser ? _uedUser.active !== false : true;
  const newActive = !isActive;

  apiPatch('/api/users/' + encodeURIComponent(_uedUsername), { isActive: newActive })
    .then(resp => {
      if (!resp.success) { notify(resp.message || 'تعذّر التحديث'); return; }
      const users = getSystemUsers();
      const u = users.find(x => x.username === _uedUsername);
      if (u) { u.active = newActive; saveSystemUsers(users); }
      if (_uedUser) _uedUser.active = newActive;
      _uedRenderInfo();
      _renderUsersTableRows();
      notify(newActive ? 'تم تفعيل الحساب' : 'تم إيقاف الحساب');
    })
    .catch(() => notify('لا يوجد اتصال'));
}

// ── Reset 2FA ──────────────────────────────────────────
function uedReset2FA() {
  if (!_uedUsername) return;
  localStorage.removeItem('totp_' + _uedUsername);
  localStorage.removeItem('totp_verified_' + _uedUsername);
  _uedRenderInfo();
  _renderUsersTableRows();
  notify('تم إعادة ضبط 2FA — سيُطلب من المستخدم إعادة المسح');
}

// ── Delete user ────────────────────────────────────────
function uedDeleteUser() {
  if (!_uedUsername) return;
  if (!confirm('هل أنت متأكد من حذف المستخدم ' + _uedUsername + '؟\nلا يمكن التراجع عن هذا الإجراء.')) return;
  deleteUser(_uedUsername);
  uedClose();
}

// ── Legacy wrappers ────────────────────────────────────
function reset2FAUser(username) { uedReset2FA(); }

// ── Permission Matrix ────────────────────────────────

// ── Per-role colour palette ──
const ROLE_COLORS = {
  'M01': { c:'#e8c04a', rgb:'232,192,74',  bg:'rgba(232,192,74,0.10)',  border:'rgba(232,192,74,0.25)'  },
  'M02': { c:'#32b8c6', rgb:'50,184,198',  bg:'rgba(50,184,198,0.10)',  border:'rgba(50,184,198,0.25)'  },
  'M03': { c:'#60a5fa', rgb:'96,165,250',  bg:'rgba(96,165,250,0.10)',  border:'rgba(96,165,250,0.25)'  },
  'T01': { c:'#a78bfa', rgb:'167,139,250', bg:'rgba(167,139,250,0.10)', border:'rgba(167,139,250,0.25)' },
  'T02': { c:'#4ade80', rgb:'74,222,128',  bg:'rgba(74,222,128,0.10)',  border:'rgba(74,222,128,0.25)'  },
  'T03': { c:'#fb923c', rgb:'251,146,60',  bg:'rgba(251,146,60,0.10)',  border:'rgba(251,146,60,0.25)'  }
};

// ── Consistent SVG icons — same style (20px, stroke-width 1.65, round caps) ──
const S = `viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"`;
const ROLE_SVG = {
  // M01 الإدارة — shield
  'M01': `<svg ${S}><path d="M10 2l7 3v5c0 4-3 7-7 8C7 17 4 14 4 10V5l6-3z"/></svg>`,
  // M02 مشرف تلر — user with badge
  'M02': `<svg ${S}><circle cx="10" cy="7" r="3.5"/><path d="M4 18c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5"/><circle cx="15" cy="5" r="2.2" stroke-width="1.4"/><path d="M14.2 4.8l.8.8 1.5-1.5" stroke-width="1.4"/></svg>`,
  // M03 مشرف حوالات — globe
  'M03': `<svg ${S}><circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15"/><path d="M10 2.5C8 5 7 7.3 7 10s1 5 3 7.5"/><path d="M10 2.5C12 5 13 7.3 13 10s-1 5-3 7.5"/></svg>`,
  // T01 أقسام تلر — briefcase
  'T01': `<svg ${S}><rect x="2" y="7" width="16" height="11" rx="2"/><path d="M7 7V5.5A2.5 2.5 0 0 1 13 5.5V7"/><line x1="10" y1="11.5" x2="10" y2="14.5"/><line x1="8.5" y1="13" x2="11.5" y2="13"/></svg>`,
  // T02 تحويل بنكي — credit card
  'T02': `<svg ${S}><rect x="2" y="5" width="16" height="12" rx="2.5"/><path d="M2 9.5h16"/><path d="M5.5 13.5h3"/><circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none"/></svg>`,
  // T03 حوالات — send arrow
  'T03': `<svg ${S}><path d="M3 10h14"/><path d="M11 4l6 6-6 6"/><path d="M3 6l2 4-2 4" stroke-width="1.2" opacity=".5"/></svg>`
};

// SVG icons per page
const PAGE_SVG = {
  'dashboard':               `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>`,
  'teller-supervisor':       `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="7" r="3.5"/><path d="M3 18c0-3 3.1-5.5 7-5.5s7 2.5 7 5.5"/><path d="M14 4l1.5 1.5L17 4"/></svg>`,
  'transactions-supervisor': `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M2 10h16M10 2a13 13 0 0 1 0 16M10 2a13 13 0 0 0 0 16"/></svg>`,
  'teller-departments':      `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="16" height="11" rx="2"/><path d="M6 6V5a4 4 0 0 1 8 0v1"/><line x1="10" y1="11" x2="10" y2="14"/></svg>`,
  'accounts':                `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="16" height="12" rx="2"/><path d="M2 9h16"/><circle cx="6" cy="13" r="1" fill="currentColor" stroke="none"/></svg>`,
  'transactions':            `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M4 6l3-3M4 6l3 3"/><path d="M16 14H4M16 14l-3-3M16 14l-3 3"/></svg>`
};

const ROLE_DESC = {
  'M01': 'وصول كامل لجميع أقسام النظام',
  'M02': 'إدارة التلرات والعمليات اليومية',
  'M03': 'إشراف على الحوالات الخارجية',
  'T01': 'تنفيذ عمليات أقسام التلر',
  'T02': 'إدارة التحويلات البنكية',
  'T03': 'تنفيذ الحوالات الخارجية'
};

let _pmActiveRole = 'M01';

function renderPermMatrix() {
  _pmRenderRolesList();
  _pmRenderMain();
}

function _pmRenderRolesList() {
  const list = document.getElementById('pm-roles-list');
  if (!list) return;
  const perms = getPermissions();
  list.innerHTML = Object.keys(ROLE_NAMES).map(r => {
    const col   = ROLE_COLORS[r];
    const count = (perms[r] || []).length;
    const sel   = r === _pmActiveRole;
    return `
    <div class="pm-role-item ${sel ? 'active' : ''}" id="pm-role-${r}"
         onclick="pmSelectRole('${r}')"
         style="--pmrc:${col.c};--pmrc-bg:${col.bg};--pmrc-border:${col.border};--pmrc-glow:rgba(${col.rgb},0.25)">
      <div class="pm-role-icon">
        <div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center">${ROLE_SVG[r]}</div>
      </div>
      <div class="pm-role-name">${ROLE_NAMES[r]}</div>
      <span class="pm-role-count" id="pm-count-${r}">${count}/${ALL_PAGES.length}</span>
    </div>`;
  }).join('');
}

function _pmRenderMain() {
  const perms   = getPermissions();
  const role    = _pmActiveRole;
  const col     = ROLE_COLORS[role];
  const allowed = perms[role] || [];
  const onCount = allowed.length;
  const allOn   = ALL_PAGES.every(p => allowed.includes(p.id));

  // Topbar
  const topbar = document.getElementById('pm-topbar');
  if (topbar) topbar.innerHTML = `
    <div class="pm-topbar-role">
      <div class="pm-topbar-icon" style="background:${col.bg};border:1px solid ${col.border};box-shadow:0 0 14px rgba(${col.rgb},0.2)">
        <div style="width:20px;height:20px;color:${col.c};display:flex;align-items:center;justify-content:center">${ROLE_SVG[role]}</div>
      </div>
      <div>
        <div class="pm-topbar-name">${ROLE_NAMES[role]}</div>
        <div class="pm-topbar-desc">${ROLE_DESC[role]}</div>
      </div>
    </div>
    <div class="pm-topbar-actions">
      <button class="pm-btn ${allOn ? 'pm-btn-all-off' : 'pm-btn-all-on'}" onclick="pmToggleAll('${role}')">
        ${allOn
          ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> إيقاف الكل`
          : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg> تفعيل الكل`}
      </button>
      <button class="pm-btn pm-btn-reset" onclick="resetPermissions()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        إعادة الضبط
      </button>
    </div>`;

  // Stats bar
  const statsbar = document.getElementById('pm-statsbar');
  if (statsbar) statsbar.innerHTML = `
    <span class="pm-stat-pill pm-stat-on"><span class="pm-stat-dot"></span>${onCount} صفحة مفعّلة</span>
    <span class="pm-stat-pill pm-stat-off"><span class="pm-stat-dot"></span>${ALL_PAGES.length - onCount} موقفة</span>`;

  // Pages grid
  const grid = document.getElementById('pm-pages-col');
  if (!grid) return;
  grid.style.setProperty('--pmrc',       col.c);
  grid.style.setProperty('--pmrc-bg',    col.bg);
  grid.style.setProperty('--pmrc-border',col.border);
  grid.style.setProperty('--pmrc-glow',  `rgba(${col.rgb},0.25)`);

  grid.innerHTML = ALL_PAGES.map(page => {
    const on = allowed.includes(page.id);
    return `
    <div class="pm-page-card ${on ? 'on' : ''}" onclick="pmTogglePage('${role}','${page.id}')">
      <div class="pm-page-ico">
        <div style="display:flex;align-items:center;justify-content:center">${PAGE_SVG[page.id] || PAGE_SVG['dashboard']}</div>
      </div>
      <div class="pm-page-info">
        <div class="pm-page-name">${page.label}</div>
        <div class="pm-page-file">${page.file}</div>
      </div>
      <div class="pm-toggle">
        <div class="pm-toggle-knob"></div>
      </div>
    </div>`;
  }).join('');
}

function pmSelectRole(role) {
  _pmActiveRole = role;
  document.querySelectorAll('.pm-role-item').forEach(el => el.classList.remove('active'));
  const item = document.getElementById('pm-role-' + role);
  if (item) item.classList.add('active');
  _pmRenderMain();
}

function _pmUpdateCount(role) {
  const perms = getPermissions();
  const el = document.getElementById('pm-count-' + role);
  if (el) el.textContent = (perms[role] || []).length + '/' + ALL_PAGES.length;
}

function pmTogglePage(role, pageId) {
  const perms = getPermissions();
  if (!perms[role]) perms[role] = [];
  const idx = perms[role].indexOf(pageId);
  if (idx === -1) perms[role].push(pageId); else perms[role].splice(idx, 1);
  if (_permCache) _permCache[role] = perms[role];
  localStorage.setItem('sys_permissions', JSON.stringify(perms));
  _pmRenderMain();
  _pmUpdateCount(role);
  // persist single-role change to server
  apiPost('/api/admin/permissions/', { role, pages: perms[role] }).catch(() => {});
}

function pmToggleAll(role) {
  const perms = getPermissions();
  const allOn = ALL_PAGES.every(p => (perms[role] || []).includes(p.id));
  perms[role] = allOn ? [] : ALL_PAGES.map(p => p.id);
  if (_permCache) _permCache[role] = perms[role];
  localStorage.setItem('sys_permissions', JSON.stringify(perms));
  _pmRenderMain();
  _pmUpdateCount(role);
  // persist to server
  apiPost('/api/admin/permissions/', { role, pages: perms[role] }).catch(() => {});
}

// ── Active Sessions ───────────────────────────────────

function renderActiveSessions() {
  const el = document.getElementById('active-sessions');
  if (!el) return;
  const users = getSystemUsers();

  // Check who has a recent intl_user session (within last 8 hours)
  const now = Date.now();
  const sessions = users.filter(u => {
    if (!u.lastLogin) return false;
    return (now - new Date(u.lastLogin).getTime()) < 8 * 3600 * 1000;
  });

  if (sessions.length === 0) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#4d6080">لا توجد جلسات نشطة حالياً</div>';
    return;
  }

  el.innerHTML = sessions.map(u => {
    const ago = Math.round((now - new Date(u.lastLogin).getTime()) / 60000);
    return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:10px;height:10px;border-radius:50%;background:#5CB85C;box-shadow:0 0 0 3px rgba(92,184,92,0.2)"></div>
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#32b8c6,#1a8c96);display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff">${u.username.charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-weight:700">${u.username}</div>
          <div class="text-muted fs-12">${ROLE_NAMES[u.role] || u.role}</div>
        </div>
      </div>
      <div class="text-muted fs-12">منذ ${ago} دقيقة</div>
    </div>`;
  }).join('');
}



// ── Update lastLogin when user logs in ───────────────

function updateLastLogin(username) {
  const users = getSystemUsers();
  const u = users.find(x => x.username === username);
  if (u) { u.lastLogin = new Date().toISOString(); saveSystemUsers(users); }
}

// Auto-update lastLogin for current user
(function() {
  try {
    const sess = (window._currentUser || null);
    if (sess && sess.username) updateLastLogin(sess.username);
  } catch(e) {}

  // Update users badge
  setTimeout(function() {
    const users = getSystemUsers();
    const badge = document.getElementById('sb-users');
    if (badge) badge.textContent = users.length;
  }, 500);
})();

// ══ إدارة النظام — قائمة جانبية داخلية ══
function sysSwitch(key) {
  // تحديث عناصر القائمة
  document.querySelectorAll('.sys-nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('sysnav-' + key);
  if (navEl) navEl.classList.add('active');

  // تحديث الـ panes
  document.querySelectorAll('.sys-pane').forEach(el => el.classList.remove('active'));
  const paneEl = document.getElementById('syspane-' + key);
  if (paneEl) paneEl.classList.add('active');

  // تحميل البيانات عند الحاجة
  if (key === 'users')  { renderUsersTable(); renderUsersStats(); }
  if (key === 'perms')  { loadPermissionsFromServer().then(() => renderActiveSessions()); }
  if (key === 'devreq')   { _sysRenderDevReqs(); }
  if (key === 'pages')    { _sysRenderPages(); }
  if (key === 'supboxes') { sbRenderBoxes(true); }
}

function _sysRenderPages() {
  const listEl = document.getElementById('sys-pages-list');
  if (!listEl) return;
  const pages = typeof ALL_PAGES !== 'undefined' ? ALL_PAGES : [];
  if (!pages.length) {
    listEl.innerHTML = '<div style="color:#4a6280;font-size:12px;padding:12px 0;">لا توجد بيانات</div>';
    return;
  }
  listEl.innerHTML = pages.map(p => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <span style="font-size:16px;">${p.icon || '📄'}</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#e9edef;">${p.name || p.id}</div>
        <div style="font-size:11px;color:#4a6280;">${p.id}</div>
      </div>
      <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;
        background:rgba(34,197,94,0.12);color:#4ade80;">نشطة</span>
    </div>`).join('');
}

function _sysRenderDevReqs() {
  const el = document.getElementById('devreq-inner-list');
  if (!el) return;
  el.innerHTML = '<div style="color:#4a6280;font-size:12px;padding:20px 0;text-align:center;">جاري التحميل...</div>';
  fetch('/api/dev-requests/')
    .then(r => r.json())
    .then(d => {
      const reqs = d.requests || d.results || [];
      if (!reqs.length) {
        el.innerHTML = '<div style="color:#4a6280;font-size:12px;padding:40px;text-align:center;">لا توجد طلبات</div>';
        return;
      }
      const statusColors = { pending:'#fbbf24', completed:'#4ade80', rejected:'#f87171' };
      const statusText   = { pending:'قيد الانتظار', completed:'مكتمل', rejected:'مرفوض' };
      el.innerHTML = reqs.map(r => `
        <div style="padding:14px 16px;margin-bottom:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:700;color:#e9edef;flex:1;">${r.title || r.subject || '—'}</span>
            <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;
              background:${(statusColors[r.status]||'#8696a0')}22;color:${statusColors[r.status]||'#8696a0'};">
              ${statusText[r.status] || r.status}
            </span>
          </div>
          <div style="font-size:11px;color:#4a6280;">${r.created_at || r.createdAt || ''} · ${r.created_by || r.createdBy || '—'}</div>
        </div>`).join('');
    })
    .catch(() => {
      el.innerHTML = '<div style="color:#f87171;font-size:12px;padding:20px;text-align:center;">تعذّر التحميل</div>';
    });
}

// ── Post-hook switchTab for user tabs ──
const _orig6 = switchTab;
switchTab = function(idx) {
  _orig6(idx);
  if (idx === 1) { accs_loadAccounts(); }
  if (idx === 8) { setTimeout(function(){ if(typeof design_render==='function') design_render(); }, 50); }
};

// ══════════════════════════════════════════════════════════════════════════════
// قسم الحسابات — وكلاء / زبائن / شركات / أخرى  +  KYC
// ══════════════════════════════════════════════════════════════════════════════
(function() {

  const CUR = {
    USD: { symbol: '$',    name: 'دولار', flag: '🇺🇸' },
    JOD: { symbol: 'د.ا', name: 'دينار', flag: '🇯🇴' },
    ILS: { symbol: '₪',   name: 'شيكل',  flag: '🇵🇸' },
  };

  const CAT_CFG = {
    agent:    { label: 'وكيل',   icon: '👤', color: '#32b8c6', bg: 'rgba(50,184,198,0.12)',  border: 'rgba(50,184,198,0.3)'  },
    customer: { label: 'زبون',   icon: '🙋', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
    company:  { label: 'شركة',   icon: '🏢', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
    other:    { label: 'أخرى',   icon: '📂', color: '#8696a0', bg: 'rgba(134,150,160,0.12)', border: 'rgba(134,150,160,0.3)' },
  };

  const KYC_CFG = {
    verified: { label: 'موثّق',    color: '#4ade80', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)'  },
    pending:  { label: 'معلّق',    color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)' },
    rejected: { label: 'مرفوض',   color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'  },
  };

  // ── KYC fields per category ─────────────────────────────────────────────────
  const KYC_FIELDS = {
    agent: [
      { id: 'kyc-id',         label: 'رقم الهوية *',         type: 'text'   },
      { id: 'kyc-nationality', label: 'الجنسية',              type: 'text'   },
      { id: 'kyc-dob',        label: 'تاريخ الميلاد',        type: 'date'   },
      { id: 'kyc-contract',   label: 'رقم عقد الوكالة',       type: 'text'   },
      { id: 'kyc-limit',      label: 'الحد الائتماني (USD)',  type: 'number' },
    ],
    customer: [
      { id: 'kyc-id',         label: 'رقم الهوية *',         type: 'text' },
      { id: 'kyc-nationality', label: 'الجنسية',              type: 'text' },
      { id: 'kyc-dob',        label: 'تاريخ الميلاد',        type: 'date' },
      { id: 'kyc-id-expiry',  label: 'تاريخ انتهاء الهوية',  type: 'date' },
    ],
    company: [
      { id: 'kyc-trade-name', label: 'الاسم التجاري *',       type: 'text' },
      { id: 'kyc-reg-num',    label: 'رقم السجل التجاري *',   type: 'text' },
      { id: 'kyc-rep-name',   label: 'اسم المفوّض',            type: 'text' },
      { id: 'kyc-rep-id',     label: 'هوية المفوّض',           type: 'text' },
      { id: 'kyc-address',    label: 'عنوان المقر',            type: 'text' },
    ],
    other: [
      { id: 'kyc-desc',       label: 'وصف الحساب *',          type: 'text' },
      { id: 'kyc-ref',        label: 'مرجع / رقم',            type: 'text' },
    ],
  };

  let _accounts = [];

  let _currentCat = 'agent';
  let _editId      = null;
  let _selectedType = 'agent';

  // ── عام ─────────────────────────────────────────────────────────────────────
  window.accs_loadAccounts = function() { _renderStats(); _renderTable(); };

  window.accs_switchCat = function(cat) {
    _currentCat = cat;
    document.querySelectorAll('.accs-tab-btn').forEach(b => {
      const active = b.dataset.cat === cat;
      b.style.color       = active ? '#818cf8' : '#5a7090';
      b.style.borderBottom = active ? '2px solid #6366f1' : '2px solid transparent';
    });
    document.getElementById('accs-search').value = '';
    document.getElementById('accs-kyc-filter').value = '';
    document.getElementById('accs-cur-filter').value = '';
    _renderTable();
  };

  window.accs_filterTable = function(q) { _renderTable(q); };

  // ── إحصاء ───────────────────────────────────────────────────────────────────
  function _renderStats() {
    const el = id => document.getElementById(id);
    if (!el('accs-total')) return;
    el('accs-total').textContent       = _accounts.length;
    el('accs-kyc-ok').textContent      = _accounts.filter(a => a.kyc === 'verified').length;
    el('accs-kyc-pending').textContent = _accounts.filter(a => a.kyc === 'pending').length;
    el('accs-kyc-rejected').textContent= _accounts.filter(a => a.kyc === 'rejected').length;
  }

  // ── جدول ────────────────────────────────────────────────────────────────────
  function _renderTable(q) {
    const tbody   = document.getElementById('accs-tbody');
    if (!tbody) return;
    const search  = (q !== undefined ? q : (document.getElementById('accs-search')?.value || '')).toLowerCase();
    const kycVal  = document.getElementById('accs-kyc-filter')?.value || '';
    const curVal  = document.getElementById('accs-cur-filter')?.value || '';

    const list = _accounts.filter(a => {
      if (a.cat !== _currentCat) return false;
      if (kycVal && a.kyc !== kycVal) return false;
      if (curVal && a.currency !== curVal) return false;
      if (search) {
        const haystack = (a.name + a.phone + (a.kycData['kyc-id']||'')).toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="padding:40px;text-align:center;color:#2d4060;font-size:13px;">لا توجد حسابات في هذا القسم</td></tr>`;
      return;
    }

    const td = 'padding:10px 13px;border-bottom:1px solid rgba(255,255,255,0.03);vertical-align:middle;white-space:nowrap;';
    tbody.innerHTML = list.map((a, i) => {
      const cur  = CUR[a.currency] || CUR.USD;
      const kyc  = KYC_CFG[a.kyc] || KYC_CFG.pending;
      const absV = Math.abs(a.balance).toLocaleString();
      const bal  = a.balance >= 0
        ? `<span style="color:#4ade80;font-weight:800;">${cur.symbol}${absV}</span>`
        : `<span style="color:#f87171;font-weight:800;">(${cur.symbol}${absV})</span>`;
      const idNum = a.kycData?.['kyc-id'] || a.kycData?.['kyc-reg-num'] || '—';
      const nat   = a.kycData?.['kyc-nationality'] || a.kycData?.['kyc-address'] || '—';
      const bg    = i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent';
      return `<tr style="background:${bg};transition:background .15s;"
                  onmouseover="this.style.background='rgba(99,102,241,0.05)'"
                  onmouseout="this.style.background='${bg}'">
        <td style="${td}color:#4f5eb5;font-size:11px;text-align:center;">${i+1}</td>
        <td style="${td}font-weight:700;color:#d8e8f8;">${a.name}</td>
        <td style="${td}font-family:monospace;color:#818cf8;font-size:11px;">${idNum}</td>
        <td style="${td}color:#8696a0;font-size:11px;">${nat}</td>
        <td style="${td}color:#8696a0;font-size:11px;">${a.phone}</td>
        <td style="${td}text-align:center;"><span style="font-size:11px;font-weight:700;color:#8696a0;">${cur.flag} ${cur.name}</span></td>
        <td style="${td}text-align:center;">${bal}</td>
        <td style="${td}text-align:center;">
          <span style="background:${kyc.bg};color:${kyc.color};border:1px solid ${kyc.border};border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;cursor:pointer;"
                onclick="accs_openKycModal(${a.id})">${kyc.label}</span>
        </td>
        <td style="${td}text-align:center;">
          <button onclick="accs_openEditModal(${a.id})" style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);color:#818cf8;border-radius:7px;padding:4px 9px;cursor:pointer;font-size:11px;font-family:inherit;margin-left:4px;">✏️</button>
          <button onclick="accs_deleteAccount(${a.id})" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#f87171;border-radius:7px;padding:4px 9px;cursor:pointer;font-size:11px;font-family:inherit;">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Modal إضافة / تعديل ──────────────────────────────────────────────────────
  window.accs_openAddModal = function() {
    _editId = null;
    document.getElementById('accs-modal-title').textContent = 'حساب جديد';
    _clearModal();
    accs_selectType(_currentCat);
    document.getElementById('accs-modal').style.display = 'flex';
  };

  window.accs_openEditModal = function(id) {
    const acc = _accounts.find(a => a.id === id);
    if (!acc) return;
    _editId = id;
    document.getElementById('accs-modal-title').textContent = 'تعديل الحساب';
    accs_selectType(acc.cat);
    document.getElementById('accs-f-name').value    = acc.name;
    document.getElementById('accs-f-phone').value   = acc.phone;
    document.getElementById('accs-f-cur').value     = acc.currency;
    document.getElementById('accs-f-balance').value = acc.balance;
    document.getElementById('accs-f-notes').value   = acc.notes || '';
    Object.entries(acc.kycData || {}).forEach(([k, v]) => {
      const el = document.getElementById(k);
      if (el) el.value = v;
    });
    document.getElementById('accs-modal').style.display = 'flex';
  };

  window.accs_closeModal = function() {
    document.getElementById('accs-modal').style.display = 'none';
    _editId = null;
  };

  window.accs_selectType = function(type) {
    _selectedType = type;
    document.querySelectorAll('.accs-type-btn').forEach(b => {
      const sel = b.dataset.type === type;
      b.style.borderColor  = sel ? '#6366f1' : 'rgba(255,255,255,0.08)';
      b.style.background   = sel ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)';
      b.style.color        = sel ? '#818cf8' : '#5a7090';
    });
    _renderKycFields(type);
  };

  function _renderKycFields(type) {
    const wrap = document.getElementById('accs-kyc-fields');
    if (!wrap) return;
    const fields = KYC_FIELDS[type] || [];
    if (!fields.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div style="border-top:1px solid rgba(99,102,241,0.15);padding-top:14px;margin-top:4px;">
        <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">بيانات KYC</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${fields.map(f => `
            <div>
              <label style="display:block;font-size:11px;color:#5a7090;margin-bottom:4px;font-weight:700;">${f.label}</label>
              <input id="${f.id}" type="${f.type}" style="width:100%;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(99,102,241,0.18);color:#e9edef;font-size:12px;outline:none;font-family:inherit;box-sizing:border-box;">
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function _clearModal() {
    ['accs-f-name','accs-f-phone','accs-f-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const bal = document.getElementById('accs-f-balance'); if (bal) bal.value = '0';
    const cur = document.getElementById('accs-f-cur');     if (cur) cur.value = 'USD';
  }

  // ── حفظ الحساب ──────────────────────────────────────────────────────────────
  window.accs_saveAccount = function() {
    const name  = (document.getElementById('accs-f-name')?.value || '').trim();
    const phone = (document.getElementById('accs-f-phone')?.value || '').trim();
    if (!name) return notify('الاسم مطلوب', 'error');

    const kycData = {};
    (KYC_FIELDS[_selectedType] || []).forEach(f => {
      const el = document.getElementById(f.id);
      if (el && el.value.trim()) kycData[f.id] = el.value.trim();
    });

    const accData = {
      cat:      _selectedType,
      name,
      phone:    phone || '—',
      currency: document.getElementById('accs-f-cur')?.value || 'USD',
      balance:  Number(document.getElementById('accs-f-balance')?.value) || 0,
      kyc:      'pending',
      kycData,
      notes:    document.getElementById('accs-f-notes')?.value || '',
      createdAt: new Date().toISOString().slice(0,10),
    };

    if (_editId) {
      const idx = _accounts.findIndex(a => a.id === _editId);
      if (idx !== -1) { accData.id = _editId; accData.kyc = _accounts[idx].kyc; _accounts[idx] = accData; }
    } else {
      accData.id = Date.now();
      _accounts.push(accData);
    }

    accs_closeModal();
    _currentCat = _selectedType;
    accs_loadAccounts();
    accs_switchCat(_selectedType);
    notify(_editId ? 'تم تحديث الحساب' : 'تم إضافة الحساب بنجاح — في انتظار توثيق KYC', 'success');
  };

  // ── حذف ─────────────────────────────────────────────────────────────────────
  window.accs_deleteAccount = function(id) {
    if (!confirm('هل تريد حذف هذا الحساب نهائياً؟')) return;
    _accounts = _accounts.filter(a => a.id !== id);
    accs_loadAccounts();
    _renderTable();
  };

  // ── Modal KYC للمدير ─────────────────────────────────────────────────────────
  window.accs_openKycModal = function(id) {
    const acc = _accounts.find(a => a.id === id);
    if (!acc) return;
    const cat  = CAT_CFG[acc.cat] || CAT_CFG.other;
    const kyc  = KYC_CFG[acc.kyc] || KYC_CFG.pending;
    const cur  = CUR[acc.currency] || CUR.USD;
    const fields = KYC_FIELDS[acc.cat] || [];

    const rows = fields.map(f => {
      const val = acc.kycData?.[f.id] || '—';
      return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="color:#5a7090;font-size:12px;">${f.label.replace(' *','')}</span>
        <span style="color:#d8e8f8;font-size:12px;font-weight:700;">${val}</span>
      </div>`;
    }).join('');

    document.getElementById('accs-kyc-detail').innerHTML = `
      <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <div style="width:44px;height:44px;border-radius:12px;background:${cat.bg};border:1px solid ${cat.border};display:flex;align-items:center;justify-content:center;font-size:20px;">${cat.icon}</div>
          <div>
            <div style="font-size:15px;font-weight:800;color:#e9edef;">${acc.name}</div>
            <div style="font-size:11px;color:#8696a0;margin-top:2px;">${cat.label} · ${acc.phone} · ${cur.flag} ${cur.name}</div>
          </div>
          <span style="margin-right:auto;background:${kyc.bg};color:${kyc.color};border:1px solid ${kyc.border};border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;">${kyc.label}</span>
        </div>
        ${rows}
        ${acc.notes ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);"><span style="color:#5a7090;font-size:11px;">ملاحظات: </span><span style="color:#8696a0;font-size:11px;">${acc.notes}</span></div>` : ''}
      </div>`;

    document.getElementById('accs-kyc-actions').innerHTML = `
      <button onclick="accs_closeKycModal()" style="flex:1;padding:9px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#8696a0;font-family:inherit;font-size:12px;cursor:pointer;">إغلاق</button>
      <button onclick="accs_setKyc(${id},'rejected')" style="flex:1;padding:9px;border-radius:9px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:#f87171;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">رفض</button>
      <button onclick="accs_setKyc(${id},'verified')" style="flex:2;padding:9px;border-radius:9px;border:none;background:linear-gradient(135deg,#22c55e,#15803d);color:#fff;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 3px 12px rgba(34,197,94,0.3);">توثيق KYC</button>`;

    document.getElementById('accs-kyc-modal').style.display = 'flex';
  };

  window.accs_closeKycModal = function() {
    document.getElementById('accs-kyc-modal').style.display = 'none';
  };

  window.accs_setKyc = function(id, status) {
    const acc = _accounts.find(a => a.id === id);
    if (!acc) return;
    acc.kyc = status;
    accs_closeKycModal();
    accs_loadAccounts();
    _renderTable();
    notify(status === 'verified' ? `تم توثيق حساب "${acc.name}"` : `تم رفض حساب "${acc.name}"`, status === 'verified' ? 'success' : 'error');
  };

})();

// ── استقبال تقارير صفحات أخرى (مشرف التلر، ...) عبر localStorage ──
(function(){
  // استيراد أي تقارير مخزّنة مسبقاً عند التحميل
  try {
    const pending = JSON.parse(localStorage.getItem('intl_admin_reports') || '[]');
    if (pending.length) {
      pending.forEach(obj => addReport(obj));
      localStorage.removeItem('intl_admin_reports');
    }
  } catch(e) {}

  // الاستماع للتقارير الواردة في الوقت الفعلي
  window.addEventListener('storage', function(e) {
    if (e.key === 'intl_admin_reports' && e.newValue) {
      try {
        const list = JSON.parse(e.newValue);
        if (Array.isArray(list) && list.length) {
          list.forEach(obj => addReport(obj));
          localStorage.removeItem('intl_admin_reports');
        }
      } catch(err) {}
    }
  });
})();


/* ══ User Dropdown ══ */
function toggleUserDropdown(e){e.stopPropagation();document.getElementById("userDropdown").classList.toggle("open");}
document.addEventListener("click",function(){var d=document.getElementById("userDropdown");if(d)d.classList.remove("open");});
document.addEventListener("DOMContentLoaded",function(){
  var obs=new MutationObserver(function(){
    var n=document.getElementById("userDisplayName"),r=document.getElementById("userDisplayRole");
    var mn=document.getElementById("ud-menu-name"),mr=document.getElementById("ud-menu-role");
    if(n&&mn)mn.textContent=n.textContent;
    if(r&&mr)mr.textContent=r.textContent;
  });
  var n=document.getElementById("userDisplayName"),r=document.getElementById("userDisplayRole");
  if(n)obs.observe(n,{childList:true,characterData:true,subtree:true});
  if(r)obs.observe(r,{childList:true,characterData:true,subtree:true});
});

/* ══ التعديلات البرمجية ══ */
(function(){
var TL={improve:'تحسين',feature:'ميزة جديدة',bug:'مشكلة',تصميم:'تصميم',تحسين:'تحسين','وظيفة جديدة':'ميزة','إصلاح':'إصلاح'};
var PROP_AR={color:'لون النص',backgroundColor:'لون الخلفية',fontSize:'حجم الخط',fontWeight:'وزن الخط',lineHeight:'تباعد السطور',textAlign:'المحاذاة',transform:'الإزاحة',width:'العرض',height:'الارتفاع',paddingTop:'تباعد داخلي ↑',paddingBottom:'تباعد داخلي ↓',paddingLeft:'تباعد داخلي →',paddingRight:'تباعد داخلي ←',marginTop:'هامش ↑',marginBottom:'هامش ↓',marginLeft:'هامش →',marginRight:'هامش ←',borderWidth:'سمك الحد',borderStyle:'نوع الحد',borderColor:'لون الحد',borderRadius:'انحناء الزوايا',opacity:'الشفافية',boxShadow:'الظل',visibility:'الظهور',textContent:'النص'};
var PROP_ICON={color:'🎨',backgroundColor:'🎨',fontSize:'🔤',fontWeight:'🔤',lineHeight:'🔤',textAlign:'🔤',transform:'✋',width:'📐',height:'📐',paddingTop:'📦',paddingBottom:'📦',paddingLeft:'📦',paddingRight:'📦',marginTop:'📦',marginBottom:'📦',marginLeft:'📦',marginRight:'📦',borderWidth:'🔲',borderStyle:'🔲',borderColor:'🔲',borderRadius:'🔲',opacity:'✨',boxShadow:'✨',visibility:'👁',textContent:'✏️'};
var PROP_COLOR_KEYS=['color','backgroundColor','borderColor'];

// getR / saveR — للطلبات المحلية من المحرر البصري فقط
function getR(){return JSON.parse(localStorage.getItem('devRequests')||'[]');}
function saveR(a){localStorage.setItem('devRequests',JSON.stringify(a));}
// خريطة للطلبات المعروضة حالياً (id → item) لاستخدامها في updDRStatus
var _devReqMap={};
function fmtDate(iso){
  var d=new Date(iso);
  if(isNaN(d)){return iso||'';}
  return d.toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'})+' '+d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
}
function isColorProp(prop){return PROP_COLOR_KEYS.indexOf(prop)!==-1;}
function isHex(v){return /^#[0-9a-fA-F]{3,8}$/.test(v);}

/* ── renderDevReqs — يجمع طلبات API + طلبات المحرر البصري من localStorage ── */
window.renderDevReqs=function(){
  // طلبات المحرر البصري المحلية
  var localReqs=getR().filter(function(r){return r.source==='visual-editor';});

  fetch('/api/dev-requests/')
    .then(function(res){return res.json();})
    .then(function(data){
      // تحويل تنسيق API إلى التنسيق المتوقع في buildCard
      var apiReqs=(data.requests||[]).map(function(r){
        return {
          id:r.id, title:r.title, type:r.type,
          description:r.description, desc:r.description,
          sender:r.sender, senderPage:r.senderPage,
          date:r.createdAt,
          // API يستخدم in_progress لكن buildCard يتوقع inprogress
          status:r.status==='in_progress'?'inprogress':r.status,
          source:'api',
        };
      });

      var all=apiReqs.concat(localReqs);

      // بناء الخريطة
      _devReqMap={};
      all.forEach(function(r){_devReqMap[r.id]=r;});

      _renderDevReqsList(all);
    })
    .catch(function(){
      // fallback عند فشل الاتصال: إظهار المحلية فقط
      _devReqMap={};
      localReqs.forEach(function(r){_devReqMap[r.id]=r;});
      _renderDevReqsList(localReqs);
    });
};

function _renderDevReqsList(all){
  var ft=(document.getElementById('devreq-ft')||{value:''}).value;
  var fs=(document.getElementById('devreq-fs')||{value:''}).value;
  var f=all.filter(function(r){
    var rs=r.status==='pending'?'new':r.status;
    return(!ft||r.type===ft)&&(!fs||rs===fs||r.status===fs);
  });
  var countEl=document.getElementById('devreq-count');
  var statsEl=document.getElementById('devreq-stats');
  var badge  =document.getElementById('sb-devreq');
  if(countEl)countEl.textContent=f.length+' طلب';
  var newCount=all.filter(function(r){return r.status==='new'||r.status==='pending';}).length;
  if(statsEl)statsEl.textContent='الإجمالي: '+all.length+' • جديد: '+newCount+' • مكتمل: '+all.filter(function(r){return r.status==='done';}).length;
  if(badge){badge.textContent=newCount;badge.style.display=newCount?'':'none';}
  var list=document.getElementById('devreq-list');
  if(!list)return;
  if(!f.length){list.innerHTML='<div class="devreq-empty"><div style="font-size:40px;margin-bottom:12px">📭</div><div style="font-size:14px;font-weight:700">لا توجد طلبات</div></div>';return;}
  list.innerHTML=f.map(function(r){return buildCard(r);}).join('');
}

function buildCard(r){
  var isVisual=r.source==='visual-editor';
  var typeLbl=TL[r.type]||r.type||'طلب';
  var descText=r.desc||r.description||'';
  var senderText=r.sender?(r.sender):(r.pageTitle?(r.pageTitle):'');
  var dateText=r.date?fmtDate(r.date):(r.submittedAt||'');
  var rs=r.status==='pending'?'new':r.status;

  // Decision summary dots
  var dotsHtml='';
  var decisionBar='';
  if(isVisual&&r.changes&&r.changes.length){
    var decs=r.changeDecisions||{};
    var nAcc=0,nRej=0,nPend=0;
    r.changes.forEach(function(c){
      var d=decs[c.id]||'pending';
      if(d==='accepted')nAcc++;
      else if(d==='rejected')nRej++;
      else nPend++;
    });
    var dots=r.changes.map(function(c){
      var d=decs[c.id]||'pending';
      return '<div class="dr-dec-dot '+d.replace('accepted','acc').replace('rejected','rej').replace('pending','pend')+'" title="'+c.label+'"></div>';
    }).join('');
    decisionBar='<div style="margin-top:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 12px;">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
        '<div style="font-size:11px;color:#32b8c6;font-weight:700;display:flex;align-items:center;gap:5px"><span style="background:#e94560;width:7px;height:7px;border-radius:50%;display:inline-block"></span>'+r.changes.length+' تعديل بصري مقترح</div>'+
        '<button class="dr-view-btn" onclick="openDRDetail('+r.id+')">مراجعة التعديلات</button>'+
      '</div>'+
      '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:8px">'+dots+'</div>'+
      '<div style="display:flex;gap:8px;font-size:11px">'+
        '<span style="color:#22c55e">'+nAcc+' مقبول</span>'+
        '<span style="color:#ef4444">'+nRej+' مرفوض</span>'+
        '<span style="color:#f59e0b">'+nPend+' بانتظار</span>'+
      '</div>'+
    '</div>';
  }

  var att=r.attachments&&r.attachments.length?'<div class="devreq-attach-row">'+r.attachments.map(function(a){return'<span class="devreq-attach-pill">'+a+'</span>';}).join('')+'</div>':'';
  var visualBadge=isVisual?'<span style="background:rgba(233,69,96,.15);color:#e94560;font-size:10px;padding:2px 7px;border-radius:10px;margin-left:6px;border:1px solid rgba(233,69,96,.3)">محرر بصري</span>':'';

  return '<div class="devreq-card" id="drc-'+r.id+'">'+
    '<div class="devreq-top">'+visualBadge+'<span class="devreq-badge '+(r.type||'')+'">'+typeLbl+'</span><div class="devreq-title">'+esc(r.title)+'</div></div>'+
    (descText?'<div class="devreq-desc">'+esc(descText)+'</div>':'')+
    decisionBar+att+
    '<div class="devreq-meta" style="margin-top:10px">'+
      '<span>'+senderText+'</span>'+
      '<span>'+dateText+'</span>'+
      '<select class="devreq-status-sel" onchange="updDRStatus('+r.id+',this.value)">'+
        '<option value="new"'+(rs==='new'?' selected':'')+'>جديد</option>'+
        '<option value="inprogress"'+(rs==='inprogress'?' selected':'')+'>قيد المعالجة</option>'+
        '<option value="done"'+(rs==='done'?' selected':'')+'>مكتمل</option>'+
        '<option value="rejected"'+(rs==='rejected'?' selected':'')+'>مرفوض</option>'+
      '</select>'+
    '</div>'+
  '</div>';
}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ── Detail Modal with Live iframe Preview ── */
var PAGE_FILE={'accounts':'/accounts/','teller-departments':'/teller/','teller-supervisor':'/supervisor/teller/','transactions':'/transactions/','transactions-supervisor':'/transactions/supervisor/'};

/* CSS injected into iframe */
var IFRAME_CSS=[
  /* permanent marker on every changed element */
  '.__dr_changed{outline:2px dashed rgba(233,69,96,.5)!important;outline-offset:3px!important;',
  'box-shadow:0 0 0 5px rgba(233,69,96,.08)!important;',
  'animation:__drPulse 2s ease-in-out infinite!important;}',
  /* hover highlight */
  '.__dr_hl{outline:3px solid #e94560!important;outline-offset:3px!important;',
  'box-shadow:0 0 0 8px rgba(233,69,96,.22)!important;',
  'animation:__drPulse 1s ease-in-out infinite!important;}',
  /* accepted = green outline */
  '.__dr_acc{outline:2px solid #22c55e!important;outline-offset:2px!important;',
  'box-shadow:0 0 0 5px rgba(34,197,94,.12)!important;animation:none!important;}',
  /* rejected = faded */
  '.__dr_rej{opacity:.3!important;filter:grayscale(.8)!important;animation:none!important;}',
  /* pulse animation */
  '@keyframes __drPulse{0%,100%{box-shadow:0 0 0 5px rgba(233,69,96,.08);}',
  '50%{box-shadow:0 0 0 10px rgba(233,69,96,.18);}}',
].join('');

function findInFrame(doc,change){
  if(!doc)return null;
  // Primary: use CSS selector built by buildSelector
  if(change.elPath){
    try{var el=doc.querySelector(change.elPath);if(el)return el;}catch(e){}
  }
  // Fallback for text changes only: match by exact textContent (safe, specific)
  if(change.type==='text'&&change.oldVal&&change.elTag){
    var els=doc.getElementsByTagName(change.elTag);
    for(var i=0;i<els.length;i++){
      if(els[i].textContent.trim()===String(change.oldVal).trim())return els[i];
    }
  }
  // No fallback to first-of-tag — that causes wrong elements to be highlighted/changed
  return null;
}

function applyInFrame(doc,change,apply){
  var el=findInFrame(doc,change);
  if(!el)return false;

  if(apply){
    // ── APPLY: use saved afterStyle/afterText for 100% accurate result ──
    if(change.type==='text'){
      el.textContent=change.afterText||change.newVal||'';
    } else {
      // Apply full inline style captured at submission (most reliable)
      if(change.afterStyle!==undefined&&change.afterStyle!==null){
        el.setAttribute('style',change.afterStyle);
        // Force important on the specific property in case afterStyle gets overridden
        if(change.property){
          var kebab=change.property.replace(/([A-Z])/g,function(m){return'-'+m.toLowerCase();});
          try{ el.style.setProperty(kebab,String(change.newVal),'important'); }catch(e){}
        }
      } else {
        // Fallback: apply single property with !important
        var prop=change.property;
        var val=String(change.newVal||'');
        var keb=prop.replace(/([A-Z])/g,function(m){return'-'+m.toLowerCase();});
        try{ el.style.setProperty(keb,val,'important'); }catch(e){ el.style[prop]=val; }
      }
    }
  } else {
    // ── REVERT: remove inline style to restore CSS defaults ──
    if(change.type==='text'){
      el.textContent=String(change.oldVal||'');
    } else {
      var prop2=change.property;
      var keb2=prop2.replace(/([A-Z])/g,function(m){return'-'+m.toLowerCase();});
      if(change.oldVal){
        try{ el.style.setProperty(keb2,String(change.oldVal),'important'); }
        catch(e){ el.style[prop2]=String(change.oldVal); }
      } else {
        el.style.removeProperty(keb2);
      }
    }
  }
  return true;
}

function highlightInFrame(doc,change,on){
  if(!doc)return;
  var el=findInFrame(doc,change);
  if(!el)return;
  if(on){
    el.classList.add('__dr_hl');
    // Only scroll if element is not already visible in the iframe viewport
    var rect=el.getBoundingClientRect?el.getBoundingClientRect():null;
    if(!rect||rect.top<0||rect.bottom>doc.documentElement.clientHeight){
      el.scrollIntoView({behavior:'smooth',block:'center'});
    }
  } else {
    el.classList.remove('__dr_hl');
  }
}

function refreshFrameDecClasses(doc,changes,decs){
  if(!doc)return;
  doc.querySelectorAll('.__dr_acc,.__dr_rej').forEach(function(e){e.classList.remove('__dr_acc','__dr_rej');});
  changes.forEach(function(c){
    var d=decs[c.id]||'pending';
    var el=findInFrame(doc,c);
    if(!el)return;
    // always keep the changed marker
    el.classList.add('__dr_changed');
    if(d==='accepted'){el.classList.add('__dr_acc');el.classList.remove('__dr_changed');}
    else if(d==='rejected'){el.classList.add('__dr_rej');el.classList.remove('__dr_changed');applyInFrame(doc,c,false);}
    else applyInFrame(doc,c,true);
  });
}

window.openDRDetail=function(id){
  var all=getR();
  var r=null;
  for(var i=0;i<all.length;i++){if(all[i].id===id){r=all[i];break;}}
  if(!r)return;

  var changes=r.changes||[];
  var decs=JSON.parse(JSON.stringify(r.changeDecisions||{}));
  var srFilter='all';
  var iframeDoc=null;

  function countDecs(){
    var acc=0,rej=0,pend=0;
    changes.forEach(function(c){var d=decs[c.id]||'pending';if(d==='accepted')acc++;else if(d==='rejected')rej++;else pend++;});
    return{acc:acc,rej:rej,pend:pend,total:changes.length};
  }

  function updateStats(){
    var ct=countDecs();
    ['total','pend','acc','rej'].forEach(function(k){
      var el=document.getElementById('dr-n-'+k);
      if(el)el.textContent=k==='total'?ct.total:ct[k];
    });
  }

  function renderPanel(){
    var listEl=document.getElementById('dr-ch-list');
    if(!listEl)return;
    var filtered=changes.filter(function(c){
      var d=decs[c.id]||'pending';
      return srFilter==='all'||
             (srFilter==='pend'&&d==='pending')||
             (srFilter==='acc'&&d==='accepted')||
             (srFilter==='rej'&&d==='rejected');
    });
    if(!filtered.length){
      listEl.innerHTML='<div style="text-align:center;padding:28px;color:#8696a0;font-size:12px">لا توجد تعديلات في هذا التصنيف</div>';
      return;
    }
    listEl.innerHTML=filtered.map(function(c){
      var d=decs[c.id]||'pending';
      var propAr=PROP_AR[c.property]||c.property||c.type;
      var icon=PROP_ICON[c.property]||'🔧';
      var isColor=isColorProp(c.property);
      var itemCls='dr-ch-item'+(d==='accepted'?' acc-ch':d==='rejected'?' rej-ch':'');
      var badgeCls=d==='accepted'?'acc':d==='rejected'?'rej':'pend';
      var badgeLbl=d==='accepted'?'مقبول':d==='rejected'?'مرفوض':'بانتظار';
      var shortEl=(c.elTag||'')+(c.elPath?' '+c.elPath.split('>').pop().trim():'');

      function bval(val,isAft){
        if(val===undefined||val===null||val==='')return '<span style="color:#555;font-size:10px">فارغ</span>';
        var v=String(val);
        var sw='';
        if(isColor&&(isHex(v)||v.startsWith('rgb')))sw='<span class="dr-clr-sw" style="background:'+v+'"></span>';
        var s=v.length>22?v.substring(0,22)+'…':v;
        return sw+'<span>'+esc(s)+'</span>';
      }

      return '<div class="'+itemCls+'" id="dr-item-'+c.id+'"'+
        ' onmouseenter="drHoverChange('+id+','+c.id+',true)"'+
        ' onmouseleave="drHoverChange('+id+','+c.id+',false)"'+
        ' onclick="drJumpTo('+id+','+c.id+')" style="cursor:pointer">'+
        '<div class="dr-chi-hd">'+
          '<div class="dr-chi-ico">'+icon+'</div>'+
          '<div style="flex:1;min-width:0"><div class="dr-chi-prop">'+esc(propAr)+'</div>'+
          '<div class="dr-chi-el" title="'+esc(c.elPath||'')+'">'+esc(shortEl)+'</div></div>'+
          '<span class="dr-chi-badge '+badgeCls+'">'+badgeLbl+'</span>'+
          '<span style="font-size:10px;color:#555;margin-right:4px" title="انقر للانتقال">🎯</span>'+
        '</div>'+
        '<div class="dr-chi-ba">'+
          '<div class="dr-ba-box before"><div class="dr-ba-box-lbl">قبل</div><div class="dr-ba-box-val">'+bval(c.oldVal,false)+'</div></div>'+
          '<div class="dr-ba-mid">→</div>'+
          '<div class="dr-ba-box after"><div class="dr-ba-box-lbl">بعد</div><div class="dr-ba-box-val">'+bval(c.newVal,true)+'</div></div>'+
        '</div>'+
        '<div class="dr-chi-foot">'+
          '<button class="dr-dec-btn accept'+(d==='accepted'?' selected':'')+'" onclick="drDecide('+id+','+c.id+',\'accepted\')">قبول</button>'+
          '<button class="dr-dec-btn reject'+(d==='rejected'?' selected':'')+'" onclick="drDecide('+id+','+c.id+',\'rejected\')">رفض</button>'+
        '</div>'+
      '</div>';
    }).join('');

    // refresh iframe visual classes
    if(iframeDoc)refreshFrameDecClasses(iframeDoc,changes,decs);
    updateStats();
  }

  /* Build full-screen modal HTML */
  var ct=countDecs();
  var pageFile=PAGE_FILE[r.page]||'';
  var html='<div class="dr-overlay" id="dr-overlay">'+
    // Top Bar
    '<div class="dr-topbar">'+
      '<div class="dr-topbar-brand"><div class="dr-topbar-icon">✏️</div>'+
      '<div class="dr-topbar-title">'+esc(r.title)+'</div></div>'+
      '<div class="dr-topbar-tags">'+
        '<span class="dr-meta-tag visual">محرر بصري</span>'+
        (r.pageTitle?'<span class="dr-meta-tag page">'+esc(r.pageTitle)+'</span>':'')+
        '<span class="dr-meta-tag date">'+(r.submittedAt||fmtDate(r.date)||'')+'</span>'+
      '</div>'+
      '<div class="dr-topbar-actions">'+
        '<button class="dr-tb-btn accept-all" onclick="drDecideAll('+id+',\'accepted\')">قبول الكل</button>'+
        '<button class="dr-tb-btn reject-all" onclick="drDecideAll('+id+',\'rejected\')">رفض الكل</button>'+
        '<button class="dr-tb-btn save" onclick="drSaveFinal('+id+')">حفظ القرار</button>'+
        '<button class="dr-close" onclick="closeDRDetail()">✕</button>'+
      '</div>'+
    '</div>'+
    // Stats row
    '<div class="dr-stats-row">'+
      '<div class="dr-sr-item all active" id="dr-sr-all" onclick="drFilter(\'all\')"><span class="n" id="dr-n-total">'+ct.total+'</span> الكل</div>'+
      '<div class="dr-sr-sep"></div>'+
      '<div class="dr-sr-item pend" id="dr-sr-pend" onclick="drFilter(\'pend\')"><span class="n" id="dr-n-pend">'+ct.pend+'</span> بانتظار</div>'+
      '<div class="dr-sr-item acc"  id="dr-sr-acc"  onclick="drFilter(\'acc\')" ><span class="n" id="dr-n-acc" >'+ct.acc+'</span> مقبول</div>'+
      '<div class="dr-sr-item rej"  id="dr-sr-rej"  onclick="drFilter(\'rej\')" ><span class="n" id="dr-n-rej" >'+ct.rej+'</span> مرفوض</div>'+
      '<div class="dr-preview-note"><div class="dr-pn-dot"></div>التغييرات المقبولة تظهر بإطار أخضر — المرفوضة تتلاشى</div>'+
    '</div>'+
    // Body
    '<div class="dr-body">'+
      // iframe side
      '<div class="dr-iframe-wrap">'+
        '<div class="dr-loading" id="dr-loading"><div class="dr-loading-ring"></div><div class="dr-loading-txt">جاري تحميل الصفحة…</div></div>'+
        (pageFile?'<iframe id="dr-preview-iframe" src="'+pageFile+'" sandbox="allow-scripts allow-same-origin"></iframe>':'<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:14px">لا يوجد ملف معاينة لهذه الصفحة</div>')+
      '</div>'+
      // panel
      '<div class="dr-panel">'+
        '<div class="dr-panel-hd">'+
          '<h4>التعديلات المقترحة</h4>'+
          (r.description?'<div class="dr-panel-desc">'+esc(r.description)+'</div>':'')+
        '</div>'+
        '<div class="dr-changes-list" id="dr-ch-list"></div>'+
      '</div>'+
    '</div>'+
  '</div>';

  var ex=document.getElementById('dr-overlay');if(ex&&ex.parentNode)ex.parentNode.removeChild(ex);
  document.body.insertAdjacentHTML('beforeend',html);
  renderPanel();

  // iframe onload → inject CSS + apply all changes
  var iframeEl=document.getElementById('dr-preview-iframe');
  if(iframeEl){
    iframeEl.addEventListener('load',function(){
      try{
        iframeDoc=iframeEl.contentDocument||iframeEl.contentWindow.document;
        // Inject CSS immediately
        var s=iframeDoc.createElement('style');
        s.textContent=IFRAME_CSS;
        iframeDoc.head.appendChild(s);
        // Block navigation/button side-effects only
        iframeEl.contentWindow.addEventListener('click',function(e){
          var a=e.target;
          while(a&&a.tagName!=='A'&&a!==iframeDoc.body)a=a.parentElement;
          if(a&&a.tagName==='A'){e.preventDefault();e.stopPropagation();return;}
          var b=e.target;
          while(b&&b.tagName!=='BUTTON'&&b!==iframeDoc.body)b=b.parentElement;
          if(b&&b.tagName==='BUTTON'){e.preventDefault();e.stopPropagation();}
        },true);
        // Wait for page scripts to finish before applying changes
        setTimeout(function(){
          try{
            // Apply all changes + mark every changed element
            var applied=0,failed=0;
            changes.forEach(function(c){
              var ok=applyInFrame(iframeDoc,c,true);
              if(ok){
                applied++;
                var el=findInFrame(iframeDoc,c);
                if(el)el.classList.add('__dr_changed');
              } else { failed++; }
            });
            refreshFrameDecClasses(iframeDoc,changes,decs);
            // Scroll to first changed element
            var firstEl=findInFrame(iframeDoc,changes[0]);
            if(firstEl){
              var iWin=iframeEl.contentWindow;
              var rect=firstEl.getBoundingClientRect();
              var scrollTop=iWin.pageYOffset||iframeDoc.documentElement.scrollTop||0;
              var target=rect.top+scrollTop-Math.max(0,(iframeEl.clientHeight-rect.height)/2);
              iWin.scrollTo({top:Math.max(0,target),behavior:'smooth'});
            }
            // Hide loading — show applied count
            var ld=document.getElementById('dr-loading');
            if(ld){
              if(applied===0&&failed>0){
                ld.innerHTML='<div style="color:#f59e0b;font-size:12px;text-align:center;padding:12px">'+
                  'لم يتم إيجاد العناصر المُعدَّلة في الصفحة<br>'+
                  '<span style="color:#555;font-size:10px;margin-top:4px;display:block">'+
                  'قد تكون العناصر ديناميكية أو تغيّرت بنية الصفحة</span></div>';
              } else {
                ld.style.display='none';
              }
            }
          }catch(e2){
            var ld=document.getElementById('dr-loading');
            if(ld)ld.innerHTML='<div style="color:#ef4444;font-size:13px">تعذّر تطبيق التعديلات</div>';
          }
        },500);
      }catch(e){
        var ld=document.getElementById('dr-loading');
        if(ld)ld.innerHTML='<div style="color:#ef4444;font-size:13px">تعذّر تحميل المعاينة (قيد أمان المتصفح)</div>';
      }
    });
  }

  // ── exposed functions ──
  window.drFilter=function(f){
    srFilter=f;
    ['all','pend','acc','rej'].forEach(function(k){
      var el=document.getElementById('dr-sr-'+k);
      if(el)el.classList.toggle('active',k===f);
    });
    renderPanel();
  };

  window.drHoverChange=function(reqId,chId,on){
    var c=null;
    for(var i=0;i<changes.length;i++){if(changes[i].id===chId){c=changes[i];break;}}
    if(!c)return;
    document.querySelectorAll('.dr-ch-item').forEach(function(el){el.classList.remove('hovered');});
    if(on){var item=document.getElementById('dr-item-'+chId);if(item)item.classList.add('hovered');}
    if(iframeDoc)highlightInFrame(iframeDoc,c,on);
  };

  window.drJumpTo=function(reqId,chId){
    var c=null;
    for(var i=0;i<changes.length;i++){if(changes[i].id===chId){c=changes[i];break;}}
    if(!c||!iframeDoc)return;
    // Highlight panel item
    document.querySelectorAll('.dr-ch-item').forEach(function(el){el.classList.remove('hovered');});
    var item=document.getElementById('dr-item-'+chId);if(item)item.classList.add('hovered');
    // Find element in iframe
    var el=findInFrame(iframeDoc,c);
    if(el){
      // scroll using iframe window for reliability
      var iWin=document.getElementById('dr-preview-iframe');
      iWin=iWin?iWin.contentWindow:null;
      if(iWin){
        var rect=el.getBoundingClientRect();
        var scrollTop=(iWin.pageYOffset||0);
        var viewH=iWin.innerHeight||600;
        var target=rect.top+scrollTop-Math.max(0,(viewH-rect.height)/2);
        iWin.scrollTo({top:Math.max(0,target),behavior:'smooth'});
      } else {
        el.scrollIntoView({behavior:'smooth',block:'center'});
      }
      iframeDoc.querySelectorAll('.__dr_hl').forEach(function(e){e.classList.remove('__dr_hl');});
      el.classList.add('__dr_hl');
      el.classList.add('__dr_changed');
    }
    // Show visual before/after comparison card
    showCompareCard(c,el);
  };

  /* ── Visual before/after comparison card ── */
  function showCompareCard(c,el){
    var wrap=document.querySelector('.dr-iframe-wrap');
    if(!wrap)return;
    // remove existing
    var ex=document.getElementById('dr-cp');if(ex&&ex.parentNode)ex.parentNode.removeChild(ex);

    var propAr=PROP_AR[c.property]||c.property||c.type;
    var elTag=(c.elTag||'').toLowerCase();

    // Build before and after visual HTML
    var beforeHtml=buildVisualSide(c,el,false);
    var afterHtml =buildVisualSide(c,el,true);

    var pop=document.createElement('div');
    pop.id='dr-cp'; pop.className='dr-cp';
    pop.innerHTML=
      '<div class="dr-cp-topbar">'+
        '<span class="dr-cp-title">'+esc(propAr)+'</span>'+
        (elTag?'<span class="dr-cp-eltag">&lt;'+esc(elTag)+'&gt;</span>':'')+
        '<button class="dr-cp-close" onclick="var e=document.getElementById(\'dr-cp\');if(e&&e.parentNode)e.parentNode.removeChild(e)">✕</button>'+
      '</div>'+
      '<div class="dr-cp-body">'+
        '<div class="dr-cp-half before">'+
          '<div class="dr-cp-half-lbl">قبل التعديل</div>'+
          '<div class="dr-cp-frame">'+beforeHtml+'</div>'+
        '</div>'+
        '<div class="dr-cp-arrow">→</div>'+
        '<div class="dr-cp-half after">'+
          '<div class="dr-cp-half-lbl">بعد التعديل</div>'+
          '<div class="dr-cp-frame">'+afterHtml+'</div>'+
        '</div>'+
      '</div>';
    wrap.appendChild(pop);
  }

  function buildVisualSide(c,el,isAfter){
    var val=String(isAfter?c.newVal:c.oldVal||'');
    var prop=c.property||'';

    // ── Text change ──
    if(c.type==='text'){
      return '<div class="dr-cp-text '+(isAfter?'new':'old')+'">'+esc(val)+'</div>';
    }

    // ── Color change ──
    if(isColorProp(prop)&&(isHex(val)||val.startsWith('rgb'))){
      return '<div style="text-align:center">'+
        '<span class="dr-cp-swatch" style="background:'+esc(val)+'"></span>'+
        '<div style="font-size:11px;color:#8696a0;margin-top:8px;font-family:monospace">'+esc(val)+'</div>'+
      '</div>';
    }

    // ── Numeric/size props — show large value ──
    var sizeProps=['fontSize','lineHeight','letterSpacing','borderWidth','borderRadius','opacity'];
    if(sizeProps.indexOf(prop)!==-1){
      return '<div style="text-align:center">'+
        '<div class="dr-cp-val '+(isAfter?'new':'old')+'">'+esc(val)+'</div>'+
        '<div style="font-size:10px;color:#555;margin-top:6px">'+esc(PROP_AR[prop]||prop)+'</div>'+
      '</div>';
    }

    // ── Spacing/box model ──
    var spaceProps=['paddingTop','paddingBottom','paddingLeft','paddingRight',
                    'marginTop','marginBottom','marginLeft','marginRight','width','height'];
    if(spaceProps.indexOf(prop)!==-1){
      return '<div style="text-align:center">'+
        '<div class="dr-cp-val '+(isAfter?'new':'old')+'">'+esc(val)+'</div>'+
        '<div style="font-size:10px;color:#555;margin-top:6px">'+esc(PROP_AR[prop]||prop)+'</div>'+
      '</div>';
    }

    // ── Element clone with computed styles ── (generic fallback)
    if(!el||!iframeDoc)return '<div class="dr-cp-val '+(isAfter?'new':'old')+'">'+esc(val)+'</div>';
    try{
      var clone=el.cloneNode(true);
      clone.classList.remove('__dr_hl','__dr_acc','__dr_rej');
      // Capture key computed styles from iframe and apply inline
      var iWin=iframeDoc.defaultView||iframeDoc.parentWindow;
      if(iWin){
        var cs=iWin.getComputedStyle(el);
        var captureProps=['fontFamily','fontSize','fontWeight','fontStyle','color',
          'backgroundColor','lineHeight','textAlign','letterSpacing','textDecoration',
          'padding','paddingTop','paddingRight','paddingBottom','paddingLeft',
          'borderRadius','border','opacity','boxShadow','textTransform'];
        captureProps.forEach(function(p){
          var v=cs.getPropertyValue(p);
          if(v)clone.style.setProperty(p,v,'important');
        });
      }
      // Apply the specific changed property with before or after value
      if(prop)clone.style.setProperty(prop,val,'important');
      // Constrain size
      clone.style.setProperty('max-width','100%','important');
      clone.style.setProperty('max-height','150px','important');
      clone.style.setProperty('overflow','hidden','important');
      clone.style.setProperty('margin','0','important');
      clone.style.setProperty('position','static','important');
      return '<div class="dr-cp-el-wrap">'+clone.outerHTML+'</div>';
    }catch(e){
      return '<div class="dr-cp-val '+(isAfter?'new':'old')+'">'+esc(val)+'</div>';
    }
  }

  window.drDecide=function(reqId,chId,decision){
    decs[chId]=decision;
    // persist
    var all2=getR();
    for(var i=0;i<all2.length;i++){
      if(all2[i].id===reqId){
        if(!all2[i].changeDecisions)all2[i].changeDecisions={};
        all2[i].changeDecisions[chId]=decision;
        saveR(all2);break;
      }
    }
    // update iframe: apply if accepted, revert if rejected
    if(iframeDoc){
      var c=null;for(var j=0;j<changes.length;j++){if(changes[j].id===chId){c=changes[j];break;}}
      if(c){
        applyInFrame(iframeDoc,c,decision==='accepted'||decision==='pending');
        refreshFrameDecClasses(iframeDoc,changes,decs);
      }
    }
    renderPanel();
    // refresh card in list behind modal
    var cardEl=document.getElementById('drc-'+reqId);
    if(cardEl){var allR=getR();for(var k=0;k<allR.length;k++){if(allR[k].id===reqId){cardEl.outerHTML=buildCard(allR[k]);break;}}}
  };

  window.drDecideAll=function(reqId,decision){
    changes.forEach(function(c){decs[c.id]=decision;});
    var all2=getR();
    for(var i=0;i<all2.length;i++){
      if(all2[i].id===reqId){
        if(!all2[i].changeDecisions)all2[i].changeDecisions={};
        changes.forEach(function(c){all2[i].changeDecisions[c.id]=decision;});
        saveR(all2);break;
      }
    }
    if(iframeDoc){
      changes.forEach(function(c){applyInFrame(iframeDoc,c,decision==='accepted');});
      refreshFrameDecClasses(iframeDoc,changes,decs);
    }
    renderPanel();
    var cardEl=document.getElementById('drc-'+reqId);
    if(cardEl){var allR=getR();for(var k=0;k<allR.length;k++){if(allR[k].id===reqId){cardEl.outerHTML=buildCard(allR[k]);break;}}}
  };

  window.drSaveFinal=function(reqId){
    var all2=getR();
    for(var i=0;i<all2.length;i++){
      if(all2[i].id===reqId){
        var chs=all2[i].changes||[];
        var allAcc=chs.every(function(c){return decs[c.id]==='accepted';});
        var allRej=chs.every(function(c){return decs[c.id]==='rejected';});
        var anyPend=chs.some(function(c){return !decs[c.id]||decs[c.id]==='pending';});
        all2[i].changeDecisions=decs;
        if(allAcc)all2[i].status='done';
        else if(allRej)all2[i].status='rejected';
        else if(!anyPend)all2[i].status='inprogress';
        else all2[i].status='inprogress';
        saveR(all2);break;
      }
    }
    closeDRDetail();
    renderDevReqs();
  };
};

window.closeDRDetail=function(){
  var ov=document.getElementById('dr-overlay');
  if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);
  // clean up globals set inside openDRDetail
  ['drFilter','drHoverChange','drJumpTo','drDecide','drDecideAll','drSaveFinal'].forEach(function(k){
    if(window[k])delete window[k];
  });
};

window.updDRStatus=function(id,status){
  var item=_devReqMap&&_devReqMap[id];
  if(item&&item.source==='visual-editor'){
    // طلب محرر بصري — تحديث localStorage
    var all=getR();
    for(var i=0;i<all.length;i++){if(all[i].id===id){all[i].status=status;break;}}
    saveR(all);renderDevReqs();
  } else {
    // طلب API — PATCH للخادم (نحوّل inprogress → in_progress)
    var apiStatus=status==='inprogress'?'in_progress':status;
    var csrf=(document.cookie.split(';').find(function(c){return c.trim().startsWith('csrftoken=');})||'').split('=')[1]||'';
    fetch('/api/dev-requests/'+id+'/',{
      method:'PATCH',
      headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
      body:JSON.stringify({status:apiStatus})
    }).then(function(){renderDevReqs();}).catch(function(){renderDevReqs();});
  }
};

// تحميل أول للبادج عند فتح الصفحة
setTimeout(function(){renderDevReqs();},400);

// ══════════════════════════════════════════════════════════════════════════════
// مسح جميع البيانات الوهمية — من localStorage + قاعدة البيانات (عبر API)
// ══════════════════════════════════════════════════════════════════════════════

window.openClearDummyModal = function() {
  var html = `
  <div id="clearDummyModal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;">
    <div style="background:var(--card-bg,#1e293b);border:1px solid #ef4444;border-radius:12px;padding:32px;max-width:480px;width:90%;color:var(--text,#f1f5f9);">
      <h2 style="color:#ef4444;margin:0 0 12px;font-size:1.2rem;">مسح جميع البيانات الوهمية</h2>
      <p style="margin:0 0 16px;line-height:1.7;font-size:.92rem;">
        سيتم حذف:<br>
        — جميع العمليات (صرافة، حوالات، معاملات نقدية، تحويلات)<br>
        — جميع المستخدمين الوهميين<br>
        — جميع ملفات التلرات وأرصدتهم وصلاحياتهم<br>
        — جميع الفروع التجريبية<br>
        — جميع بيانات localStorage للنظام
      </p>
      <p style="color:#fbbf24;font-size:.85rem;margin:0 0 20px;">سيُبقي النظام على المستخدمين الرسميين فقط (admin, sv_teller, sv_trx, teller1, bank1, trx1)</p>
      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button onclick="document.getElementById('clearDummyModal').remove()" style="padding:8px 20px;border-radius:8px;border:1px solid #475569;background:transparent;color:inherit;cursor:pointer;">إلغاء</button>
        <button onclick="executeClearDummyData()" style="padding:8px 20px;border-radius:8px;border:none;background:#ef4444;color:#fff;cursor:pointer;font-weight:600;">مسح الآن</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
};

window.executeClearDummyData = function() {
  var modal = document.getElementById('clearDummyModal');
  if (modal) modal.remove();

  // 1) مسح localStorage — جميع مفاتيح intl_ و sys_ و totp_ و devRequests و transferHistory
  var keysToRemove = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && (
      k.startsWith('intl_') ||
      k.startsWith('sys_') ||
      k.startsWith('totp_') ||
      k === 'devRequests' ||
      k === 'transferHistory' ||
      k === 'supervisorName' ||
      k === 'balanceLogs' ||
      k === 'operations'
    )) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(function(k){ localStorage.removeItem(k); });

  // 2) مسح قاعدة البيانات عبر API
  apiPost('/api/admin/clear-dummy-data', {})
    .then(function(resp) {
      if (resp && resp.success) {
        notify('تم مسح ' + (resp.deleted || 0) + ' سجل من قاعدة البيانات و' + keysToRemove.length + ' مفتاح من localStorage بنجاح');
        // إعادة رسم أي قوائم مفتوحة
        setTimeout(function() { location.reload(); }, 1500);
      } else {
        notify('تم مسح localStorage (' + keysToRemove.length + ' مفتاح). لمسح قاعدة البيانات شغّل: python manage.py clear_dummy_data --confirm', 'warn');
      }
    })
    .catch(function() {
      notify('تم مسح localStorage (' + keysToRemove.length + ' مفتاح). لمسح قاعدة البيانات شغّل: python manage.py clear_dummy_data --confirm', 'warn');
    });
};

})(); // ← نهاية IIFE التعديلات البرمجية — Portal Receipts تأتي بعدها في النطاق العام

// ══════════════════════════════════════════════════════════════════════════════
// Portal Receipts — إشعارات البوابة الخارجية  (global scope)
// ══════════════════════════════════════════════════════════════════════════════

var _prAllReceipts = [];
var _fwdEmployees  = [];
var PR_STATUS_LABEL = { new:'جديد', reviewing:'قيد المراجعة', done:'منفّذ', rejected:'مرفوض' };

function renderPortalReceipts() {
  const listEl  = document.getElementById('pr-list');
  const statsEl = document.getElementById('pr-modal-stats');
  const countEl = document.getElementById('pr-count');
  if (!listEl) return;

  listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#8696a0;">جاري التحميل...</div>';

  fetch('/api/ts/portal-requests/', { credentials: 'include' })
    .then(r => r.json())
    .then(data => {
      _prAllReceipts = data.requests || [];
      _applyPortalReceiptsFilter();

      // sidebar badge: count unforwarded new receipts
      const pending = _prAllReceipts.filter(r => r.status === 'new' && !r.forwardedTo).length;
      const badge = document.getElementById('sb-portal-receipts');
      if (badge) {
        badge.textContent = pending;
        badge.style.display = pending > 0 ? '' : 'none';
      }

      // stats line
      const total   = _prAllReceipts.length;
      const fwdDone = _prAllReceipts.filter(r => r.forwardedTo).length;
      if (statsEl) statsEl.textContent = 'إجمالي: ' + total + ' — موجَّه: ' + fwdDone + ' — غير موجَّه: ' + (total - fwdDone);
    })
    .catch(function() {
      if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">فشل في تحميل الطلبات</div>';
    });
}

function _applyPortalReceiptsFilter() {
  const listEl  = document.getElementById('pr-list');
  const countEl = document.getElementById('pr-count');
  if (!listEl) return;

  const statusF   = (document.getElementById('pr-filter-status')   || {}).value || '';
  const fwdFilter = (document.getElementById('pr-filter-forwarded') || {}).value || '';

  let items = _prAllReceipts;
  if (statusF)           items = items.filter(function(r) { return r.status === statusF; });
  if (fwdFilter === 'yes') items = items.filter(function(r) { return r.forwardedTo; });
  if (fwdFilter === 'no')  items = items.filter(function(r) { return !r.forwardedTo; });

  if (countEl) countEl.textContent = items.length + ' طلب';

  if (items.length === 0) {
    listEl.innerHTML = '<div class="devreq-empty">لا توجد إشعارات مطابقة للفلتر</div>';
    return;
  }

  listEl.innerHTML = items.map(function(r) {
    var imgThumb = r.receipt
      ? '<a href="' + r.receipt + '" target="_blank" style="display:block;width:70px;height:70px;border-radius:8px;overflow:hidden;border:1px solid #2a3942;flex-shrink:0"><img src="' + r.receipt + '" style="width:100%;height:100%;object-fit:cover;" alt="إيصال"></a>'
      : '<div style="width:70px;height:70px;border-radius:8px;background:#0d1825;border:1px solid #2a3942;display:flex;align-items:center;justify-content:center;color:#8696a0;font-size:20px;flex-shrink:0">🖼️</div>';

    var fwdTag = r.forwardedTo
      ? '<span style="font-size:11px;padding:2px 8px;border-radius:5px;background:rgba(72,199,142,0.12);color:#48c78e;border:1px solid rgba(72,199,142,0.25);">موجَّه → ' + (r.forwardedTo.fullName || r.forwardedTo.username) + '</span>'
      : '<span style="font-size:11px;padding:2px 8px;border-radius:5px;background:rgba(99,179,237,0.1);color:#63b3ed;border:1px solid rgba(99,179,237,0.2);">غير موجَّه</span>';

    var statusTag = '<span style="font-size:11px;padding:2px 8px;border-radius:5px;background:rgba(255,255,255,0.05);color:#8696a0;border:1px solid #2a3942;">' + (PR_STATUS_LABEL[r.status] || r.status) + '</span>';

    var safeName  = (r.clientName  || '—').replace(/'/g, "\\'");
    var safeExtra = ((r.currency || '') + ' ' + (r.countryName || '')).trim().replace(/'/g, "\\'");

    var fwdBtn = (r.status !== 'done' && r.status !== 'rejected')
      ? '<button onclick="openForwardPicker(' + r.id + ',\'' + safeName + '\',\'' + safeExtra + '\')" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:7px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">توجيه</button>'
      : '';

    var dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-SA') : '';
    var noteRow = r.forwardedTo ? '<div style="font-size:11px;color:#8696a0;">' + (r.forwardedNote || 'بدون ملاحظة') + '</div>' : '';

    return '<div style="display:flex;gap:14px;align-items:flex-start;background:#0d1825;border:1px solid #1e2d3d;border-radius:10px;padding:14px 16px;margin-bottom:10px;">'
      + imgThumb
      + '<div style="flex:1;min-width:0;">'
      +   '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">'
      +     '<span style="font-weight:800;color:#e9edef;font-size:14px;">' + (r.clientName || '—') + '</span>'
      +     statusTag + fwdTag
      +   '</div>'
      +   '<div style="font-size:12px;color:#8696a0;margin-bottom:4px;">' + (r.countryName || '—') + ' &nbsp;|&nbsp; ' + (r.currency || '—') + ' &nbsp;|&nbsp; ' + (r.trackingCode || '—') + '</div>'
      +   noteRow
      + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">'
      +   fwdBtn
      +   '<span style="font-size:10px;color:#8696a0">' + dateStr + '</span>'
      + '</div>'
      + '</div>';
  }).join('');
}

// ── Open forward-picker modal ─────────────────────────────────────────────────
function openForwardPicker(reqId, clientName, extra) {
  document.getElementById('fwd-req-id').value = reqId;
  document.getElementById('fwd-req-info').textContent = clientName + ' — ' + extra;
  document.getElementById('fwd-note').value = '';
  document.getElementById('fwd-emp-id').value = '';

  var empList = document.getElementById('fwd-emp-list');
  empList.innerHTML = '<div style="color:#8696a0;font-size:13px;padding:8px">جاري تحميل الموظفين...</div>';

  // Open the picker modal (keep portal receipts modal open in background)
  document.getElementById('dm-forward-pick').classList.add('open');

  // Fetch T02 + T03 employees
  Promise.all([
    fetch('/api/users/?role=T02', { credentials: 'include' }).then(function(r) { return r.json(); }),
    fetch('/api/users/?role=T03', { credentials: 'include' }).then(function(r) { return r.json(); }),
  ]).then(function(results) {
    _fwdEmployees = [].concat(results[0].users || [], results[1].users || []);
    _renderFwdEmpList();
  }).catch(function() {
    empList.innerHTML = '<div style="color:#ef4444;font-size:13px;padding:8px">فشل تحميل الموظفين</div>';
  });
}

function _renderFwdEmpList() {
  var empList  = document.getElementById('fwd-emp-list');
  var selected = document.getElementById('fwd-emp-id').value;
  if (!empList) return;

  var ROLE_LABEL = { T02: 'التحويل البنكي', T03: 'الحوالات الخارجية' };
  if (!_fwdEmployees.length) {
    empList.innerHTML = '<div style="color:#8696a0;font-size:13px;padding:8px">لا يوجد موظفون من نوع T02/T03</div>';
    return;
  }
  empList.innerHTML = _fwdEmployees.map(function(u) {
    var isSel = String(u.id) === String(selected);
    return '<div onclick="selectFwdEmp(' + u.id + ')" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;cursor:pointer;'
      + 'background:' + (isSel ? 'rgba(99,179,237,0.12)' : 'rgba(255,255,255,0.03)') + ';'
      + 'border:1px solid ' + (isSel ? 'rgba(99,179,237,0.4)' : '#2a3942') + ';transition:background 0.15s">'
      + '<div style="width:36px;height:36px;border-radius:50%;background:rgba(99,179,237,0.15);display:flex;align-items:center;justify-content:center;font-size:16px;">👤</div>'
      + '<div>'
      +   '<div style="font-weight:700;color:#e9edef;font-size:13px;">' + (u.fullName || u.username) + '</div>'
      +   '<div style="font-size:11px;color:#8696a0;">' + (ROLE_LABEL[u.role] || u.role) + '</div>'
      + '</div>'
      + (isSel ? '<div style="margin-right:auto;color:#63b3ed;font-size:18px;">✓</div>' : '')
      + '</div>';
  }).join('');
}

function selectFwdEmp(empId) {
  document.getElementById('fwd-emp-id').value = empId;
  _renderFwdEmpList();
}

function confirmForward() {
  var reqId = document.getElementById('fwd-req-id').value;
  var empId = document.getElementById('fwd-emp-id').value;
  var note  = document.getElementById('fwd-note').value.trim();

  if (!reqId) { notify('خطأ: لم يتم تحديد الطلب', 'error'); return; }
  if (!empId) { notify('يرجى اختيار موظف أولاً', 'warn'); return; }

  fetch('/api/portal-requests/' + reqId + '/forward/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': (document.cookie.split(';').find(function(c){return c.trim().startsWith('csrftoken=');})||'').split('=')[1]||'' },
    body: JSON.stringify({ toUserId: parseInt(empId, 10), note: note }),
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        notify('تم توجيه الإشعار بنجاح');
        closeDashModal('dm-forward-pick');
        renderPortalReceipts();   // refresh list
      } else {
        notify(data.message || 'حدث خطأ أثناء التوجيه', 'error');
      }
    })
    .catch(function() { notify('فشل الاتصال بالخادم', 'error'); });
}

// ══════════════════════════════════════════════════════════════════════════════
// Portal Settings — إعدادات البوابة (الدول + طرق الاستلام)
// ══════════════════════════════════════════════════════════════════════════════

var _psCountries = [];          // cache: قائمة الدول المحملة
var _psExpanded  = {};          // { slug: true/false } حالة الطي/البسط

// ── تحميل وعرض الدول ─────────────────────────────────────────────────────────
function renderPortalSettings() {
  var listEl  = document.getElementById('ps-countries-list');
  var statsEl = document.getElementById('ps-stats');
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#8696a0;">جاري التحميل...</div>';

  fetch('/api/sv/portal/countries', { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _psCountries = data.countries || [];
      var active = _psCountries.filter(function(c) { return c.isActive; }).length;
      if (statsEl) statsEl.textContent = 'إجمالي: ' + _psCountries.length + ' دولة — نشطة: ' + active;
      _renderCountriesList();
    })
    .catch(function() {
      listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">فشل تحميل الدول</div>';
    });
}

function _renderCountriesList() {
  var listEl = document.getElementById('ps-countries-list');
  if (!listEl) return;

  if (!_psCountries.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#8696a0;">'
      + '<div style="font-size:40px;margin-bottom:12px;">🌍</div>'
      + '<div style="font-size:14px;font-weight:600;">لا توجد دول مضافة بعد</div>'
      + '<div style="font-size:12px;margin-top:6px;">اضغط "إضافة دولة" لإضافة أول دولة</div>'
      + '</div>';
    return;
  }

  listEl.innerHTML = _psCountries.map(function(c, idx) {
    var isExp       = !!_psExpanded[c.id];
    var isActive    = !!c.isActive;
    var safeName    = (c.name || '').replace(/'/g, "\\'");

    // ── Methods sub-table ──────────────────────────────────────────────────
    var methodsBlock = '';
    if (isExp) {
      var mHeader = '<div style="display:grid;grid-template-columns:2fr 1.5fr 1.5fr 1fr 120px;gap:0;'
        + 'background:#04090f;padding:8px 28px 8px 20px;border-top:1px solid #1e2d3d;border-bottom:1px solid #1e2d3d;">'
        + '<div style="font-size:10px;font-weight:700;color:#4d6080;letter-spacing:0.4px;">الطريقة</div>'
        + '<div style="font-size:10px;font-weight:700;color:#4d6080;letter-spacing:0.4px;">البنك</div>'
        + '<div style="font-size:10px;font-weight:700;color:#4d6080;letter-spacing:0.4px;direction:ltr;text-align:left;">IBAN</div>'
        + '<div style="font-size:10px;font-weight:700;color:#4d6080;text-align:center;letter-spacing:0.4px;">الحالة</div>'
        + '<div style="font-size:10px;font-weight:700;color:#4d6080;text-align:center;letter-spacing:0.4px;">إجراءات</div>'
        + '</div>';

      var mRows = (c.methods || []).map(function(m) {
        var mActive = m.isActive !== false;
        return '<div style="display:grid;grid-template-columns:2fr 1.5fr 1.5fr 1fr 120px;gap:0;'
          + 'align-items:center;padding:11px 28px 11px 20px;border-bottom:1px solid rgba(255,255,255,0.03);'
          + 'background:rgba(255,255,255,0.01);transition:background 0.15s;" '
          + 'onmouseenter="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseleave="this.style.background=\'rgba(255,255,255,0.01)\'">'
          + '<div style="font-weight:700;color:#e9edef;font-size:13px;">' + (m.name || '—') + '</div>'
          + '<div style="font-size:12px;color:#8696a0;">' + (m.bank || '—') + '</div>'
          + '<div style="font-size:11px;color:#8696a0;direction:ltr;text-align:left;font-family:monospace;">' + (m.iban ? m.iban.substring(0,22) + (m.iban.length > 22 ? '…' : '') : '—') + '</div>'
          + '<div style="text-align:center;">'
          +   '<span style="font-size:10px;padding:3px 9px;border-radius:20px;font-weight:700;'
          +   'background:' + (mActive ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.08)') + ';'
          +   'color:' + (mActive ? '#34d399' : '#ef4444') + ';'
          +   'border:1px solid ' + (mActive ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.2)') + ';">'
          +   (mActive ? 'نشطة' : 'متوقفة') + '</span>'
          + '</div>'
          + '<div style="display:flex;gap:6px;justify-content:center;">'
          +   '<button onclick="openEditMethodForm(\'' + c.id + '\',\'' + safeName + '\',' + m.id + ')" '
          +   'style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:6px;padding:5px 10px;color:#fbbf24;cursor:pointer;font-size:11px;font-weight:600;">تعديل</button>'
          +   '<button onclick="deleteMethod(' + m.id + ',\'' + c.id + '\')" '
          +   'style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:6px;padding:5px 10px;color:#ef4444;cursor:pointer;font-size:11px;font-weight:600;">حذف</button>'
          + '</div>'
          + '</div>';
      }).join('');

      var addMethodRow = '<div style="padding:12px 28px 12px 20px;background:#04090f;border-top:1px solid #1e2d3d;">'
        + '<button onclick="openAddMethodForm(\'' + c.id + '\',\'' + safeName + '\')" '
        + 'style="display:flex;align-items:center;gap:6px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);'
        + 'border-radius:7px;padding:7px 16px;color:#fbbf24;cursor:pointer;font-size:12px;font-weight:700;">'
        + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
        + ' إضافة طريقة استلام</button>'
        + '</div>';

      methodsBlock = mHeader
        + (mRows || '<div style="padding:20px;text-align:center;font-size:12px;color:#8696a0;background:rgba(255,255,255,0.01);">لا توجد طرق استلام بعد</div>')
        + addMethodRow;
    }

    // ── Country row (table row style) ──────────────────────────────────────
    var rowBg = idx % 2 === 0 ? '#0a111a' : '#080f17';
    return '<div style="border-bottom:1px solid #1e2d3d;">'
      // Main row
      + '<div style="display:grid;grid-template-columns:2fr 80px 120px 80px 90px 160px;gap:0;align-items:center;'
      + 'padding:14px 28px;background:' + rowBg + ';cursor:pointer;transition:background 0.15s;" '
      + 'onmouseenter="this.style.background=\'#0d1825\'" onmouseleave="this.style.background=\'' + rowBg + '\'">'

      // Name
      + '<div style="display:flex;align-items:center;gap:10px;">'
      +   '<div style="width:32px;height:32px;border-radius:8px;background:rgba(99,179,237,0.08);border:1px solid rgba(99,179,237,0.15);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">' + (c.flag || '🏳') + '</div>'
      +   '<div>'
      +     '<div style="font-weight:700;color:#e9edef;font-size:14px;">' + (c.name || '—') + '</div>'
      +     '<div style="font-size:10px;color:#4d6080;margin-top:1px;">' + c.id + '</div>'
      +   '</div>'
      + '</div>'

      // Currency
      + '<div style="text-align:center;">'
      +   '<span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:6px;background:rgba(99,179,237,0.08);color:#63b3ed;border:1px solid rgba(99,179,237,0.15);">' + (c.currency || '—') + '</span>'
      + '</div>'

      // Rate
      + '<div style="text-align:center;font-size:12px;color:#8696a0;">'
      +   '1 USD = <span style="color:#e9edef;font-weight:600;">' + (parseFloat(c.rate)||0).toFixed(4) + '</span>'
      + '</div>'

      // Methods count
      + '<div style="text-align:center;">'
      +   '<span style="font-size:13px;font-weight:800;color:#e9edef;">' + (c.methods||[]).length + '</span>'
      +   '<span style="font-size:10px;color:#4d6080;margin-right:3px;"> طريقة</span>'
      + '</div>'

      // Status toggle
      + '<div style="text-align:center;">'
      +   '<button onclick="toggleCountryActive(\'' + c.id + '\',' + !isActive + ');event.stopPropagation()" '
      +   'style="font-size:11px;padding:5px 12px;border-radius:20px;font-weight:700;cursor:pointer;white-space:nowrap;border:1px solid;transition:all 0.2s;'
      +   'background:' + (isActive ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.08)') + ';'
      +   'color:' + (isActive ? '#34d399' : '#ef4444') + ';'
      +   'border-color:' + (isActive ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.25)') + ';">'
      +   (isActive ? '● نشطة' : '○ متوقفة')
      +   '</button>'
      + '</div>'

      // Actions
      + '<div style="display:flex;align-items:center;gap:6px;justify-content:center;">'
      +   '<button onclick="toggleExpand(\'' + c.id + '\');event.stopPropagation()" '
      +   'style="background:rgba(255,255,255,0.04);border:1px solid #2a3942;border-radius:6px;padding:5px 10px;color:#8696a0;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap;">'
      +   (isExp ? 'إخفاء' : 'الطرق') + '</button>'
      +   '<button onclick="openEditCountryForm(\'' + c.id + '\');event.stopPropagation()" '
      +   'style="background:rgba(99,179,237,0.08);border:1px solid rgba(99,179,237,0.2);border-radius:6px;padding:5px 12px;color:#63b3ed;cursor:pointer;font-size:11px;font-weight:700;">تعديل</button>'
      +   '<button onclick="deleteCountry(\'' + c.id + '\',\'' + safeName + '\');event.stopPropagation()" '
      +   'style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:6px;padding:5px 10px;color:#ef4444;cursor:pointer;font-size:11px;font-weight:700;">حذف</button>'
      + '</div>'

      + '</div>'
      + methodsBlock
      + '</div>';
  }).join('');
}

// ── Expand/Collapse ──────────────────────────────────────────────────────────
function toggleExpand(slug) {
  _psExpanded[slug] = !_psExpanded[slug];
  _renderCountriesList();
}

// ── Toggle active ────────────────────────────────────────────────────────────
function toggleCountryActive(slug, newActive) {
  fetch('/api/sv/portal/countries/' + slug, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrf() },
    body: JSON.stringify({ isActive: newActive }),
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) { notify(newActive ? 'تم تفعيل الدولة' : 'تم إيقاف الدولة'); renderPortalSettings(); }
      else notify(d.error || 'حدث خطأ', 'error');
    })
    .catch(function() { notify('فشل الاتصال', 'error'); });
}

// ── Delete country ───────────────────────────────────────────────────────────
function deleteCountry(slug, name) {
  if (!confirm('هل تريد حذف دولة "' + name + '" وجميع طرق استلامها؟')) return;
  fetch('/api/sv/portal/countries/' + slug, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-CSRFToken': _csrf() },
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) { notify('تم حذف الدولة'); renderPortalSettings(); }
      else notify(d.error || 'حدث خطأ', 'error');
    })
    .catch(function() { notify('فشل الاتصال', 'error'); });
}

// ── Add country form ─────────────────────────────────────────────────────────
function openAddCountryForm() {
  document.getElementById('psf-slug').value     = '';
  document.getElementById('psf-name').value     = '';
  document.getElementById('psf-currency').value = '';
  document.getElementById('psf-rate').value     = '';
  document.getElementById('ps-form-title').textContent = 'إضافة دولة جديدة';
  document.getElementById('ps-save-btn').textContent   = 'حفظ الدولة';
  document.getElementById('ps-country-form').style.display = '';
}

function openEditCountryForm(slug) {
  var c = _psCountries.find(function(x) { return x.id === slug; });
  if (!c) return;
  document.getElementById('psf-slug').value     = slug;
  document.getElementById('psf-name').value     = c.name     || '';
  document.getElementById('psf-currency').value = c.currency || '';
  document.getElementById('psf-rate').value     = c.rate     || '';
  document.getElementById('ps-form-title').textContent = 'تعديل: ' + c.name;
  document.getElementById('ps-save-btn').textContent   = 'حفظ التعديلات';
  document.getElementById('ps-country-form').style.display = '';
}

function cancelCountryForm() {
  document.getElementById('ps-country-form').style.display = 'none';
}

function saveCountryForm() {
  var slug     = document.getElementById('psf-slug').value.trim();
  var name     = document.getElementById('psf-name').value.trim();
  var currency = document.getElementById('psf-currency').value.trim().toUpperCase();
  var rate     = parseFloat(document.getElementById('psf-rate').value) || 1;

  if (!name)     { notify('اسم الدولة مطلوب', 'warn'); return; }
  if (!currency) { notify('رمز العملة مطلوب', 'warn'); return; }

  var isEdit = !!slug;
  var url    = isEdit ? '/api/sv/portal/countries/' + slug : '/api/sv/portal/countries';
  var method = isEdit ? 'PUT' : 'POST';
  var body   = { name: name, currency: currency, rate: rate };

  fetch(url, {
    method: method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrf() },
    body: JSON.stringify(body),
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        notify(isEdit ? 'تم تحديث الدولة' : 'تم إضافة الدولة');
        cancelCountryForm();
        renderPortalSettings();
      } else {
        notify(d.error || 'حدث خطأ', 'error');
      }
    })
    .catch(function() { notify('فشل الاتصال', 'error'); });
}

// ── Method form ──────────────────────────────────────────────────────────────
function openAddMethodForm(countrySlug, countryName) {
  if (!countrySlug) {
    notify('هذه الدولة لا تملك معرّفاً — احذفها وأعد إضافتها', 'error');
    return;
  }
  document.getElementById('mf-method-id').value      = '';
  document.getElementById('mf-country-slug').value   = countrySlug;
  document.getElementById('mf-country-name').textContent = countryName || countrySlug;
  document.getElementById('mf-title').textContent    = 'إضافة طريقة استلام';
  document.getElementById('mf-name').value           = '';
  document.getElementById('mf-bank').value           = '';
  document.getElementById('mf-iban').value           = '';
  document.getElementById('mf-beneficiary').value    = '';
  document.getElementById('mf-extra-label').value    = '';
  document.getElementById('mf-extra-value').value    = '';
  document.getElementById('mf-active').checked       = true;
  document.getElementById('dm-method-form').classList.add('open');
}

function openEditMethodForm(countrySlug, countryName, methodId) {
  // Fetch method data from cached countries
  var country = _psCountries.find(function(c) { return c.id === countrySlug; });
  var m = country && country.methods.find(function(x) { return x.id === methodId; });
  if (!m) return;

  document.getElementById('mf-method-id').value      = methodId;
  document.getElementById('mf-country-slug').value   = countrySlug;
  document.getElementById('mf-country-name').textContent = countryName || countrySlug;
  document.getElementById('mf-title').textContent    = 'تعديل: ' + m.name;
  document.getElementById('mf-name').value           = m.name        || '';
  document.getElementById('mf-bank').value           = m.bank        || '';
  document.getElementById('mf-iban').value           = m.iban        || '';
  document.getElementById('mf-beneficiary').value    = m.beneficiary || '';
  document.getElementById('mf-extra-label').value    = m.extraLabel  || '';
  document.getElementById('mf-extra-value').value    = m.extraValue  || '';
  document.getElementById('mf-active').checked       = m.isActive !== false;
  document.getElementById('dm-method-form').classList.add('open');
}

function saveMethodForm() {
  var methodId    = document.getElementById('mf-method-id').value;
  var countrySlug = document.getElementById('mf-country-slug').value;
  var name        = document.getElementById('mf-name').value.trim();

  if (!countrySlug) { notify('خطأ: لم يتم تحديد الدولة — أعد فتح النموذج', 'error'); return; }
  if (!name) { notify('اسم الطريقة مطلوب', 'warn'); return; }

  var body = {
    name:        name,
    bank:        document.getElementById('mf-bank').value.trim(),
    iban:        document.getElementById('mf-iban').value.trim(),
    beneficiary: document.getElementById('mf-beneficiary').value.trim(),
    extraLabel:  document.getElementById('mf-extra-label').value.trim(),
    extraValue:  document.getElementById('mf-extra-value').value.trim(),
    isActive:    document.getElementById('mf-active').checked,
  };

  var isEdit = !!methodId;
  var url    = isEdit ? '/api/sv/portal/methods/' + methodId : '/api/sv/portal/countries/' + countrySlug + '/methods';
  var method = isEdit ? 'PUT' : 'POST';

  fetch(url, {
    method: method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrf() },
    body: JSON.stringify(body),
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        notify(isEdit ? 'تم تحديث الطريقة' : 'تم إضافة الطريقة');
        closeDashModal('dm-method-form');
        _psExpanded[countrySlug] = true;   // keep expanded after save
        renderPortalSettings();
      } else {
        notify(d.error || 'حدث خطأ', 'error');
      }
    })
    .catch(function() { notify('فشل الاتصال', 'error'); });
}

function deleteMethod(methodId, countrySlug) {
  if (!confirm('هل تريد حذف هذه الطريقة؟')) return;
  fetch('/api/sv/portal/methods/' + methodId, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-CSRFToken': _csrf() },
  })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        notify('تم حذف الطريقة');
        _psExpanded[countrySlug] = true;
        renderPortalSettings();
      } else {
        notify(d.error || 'حدث خطأ', 'error');
      }
    })
    .catch(function() { notify('فشل الاتصال', 'error'); });
}

// ── CSRF helper ──────────────────────────────────────────────────────────────
function _csrf() {
  return (document.cookie.split(';').find(function(c) {
    return c.trim().startsWith('csrftoken=');
  }) || '').split('=')[1] || '';
}

// ══════════════════════════════════════════════════════════════════════════════
// VOICE COMMAND SSE — يستمع للأوامر الصوتية القادمة من تطبيق الأندرويد
// ══════════════════════════════════════════════════════════════════════════════
(function _initVoiceSSE() {
  var TAB_NAMES = ['لوحة التحكم','الحسابات','الفروع','المشرفون','صناديق التلرات','الخزينة المركزية','العمليات','إدارة الصفحات','قسم التصميم'];
  var _sse = null;
  var _retryDelay = 2000;

  function _showVoiceBanner(text, tabName) {
    var old = document.getElementById('voiceCmdBanner');
    if (old) old.remove();

    var banner = document.createElement('div');
    banner.id = 'voiceCmdBanner';
    banner.style.cssText = [
      'position:fixed','bottom:24px','left:50%','transform:translateX(-50%)',
      'z-index:99999','background:linear-gradient(135deg,#0d1b2a,#1a2f45)',
      'border:1px solid rgba(50,184,198,0.4)','border-radius:16px',
      'padding:12px 22px','display:flex','align-items:center','gap:12px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)','font-family:Tajawal,sans-serif',
      'animation:vcSlideUp .3s cubic-bezier(.34,1.56,.64,1)',
    ].join(';');

    banner.innerHTML = '<style>@keyframes vcSlideUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>'
      + '<span style="font-size:22px">🎤</span>'
      + '<div>'
      + '<div style="font-size:13px;font-weight:700;color:#32b8c6;">' + (tabName ? 'انتقال إلى: ' + tabName : 'أمر صوتي') + '</div>'
      + '<div style="font-size:11px;color:#8696a0;margin-top:2px;">"' + text + '"</div>'
      + '</div>';

    document.body.appendChild(banner);
    setTimeout(function() { if (banner.parentNode) banner.remove(); }, 3000);
  }

  function _handleEvent(event) {
    var data;
    try { data = JSON.parse(event.data); } catch(e) { return; }

    if (data.action === 'ping') return;

    // الخادم أغلق الـ stream بعد مدته القصوى — أعد الاتصال فوراً
    if (data.action === 'reconnect') {
      if (_sse) { try { _sse.close(); } catch(e) {} _sse = null; }
      setTimeout(_connect, 500);
      return;
    }

    if (data.action === 'switch_tab' && typeof data.value === 'number') {
      if (typeof switchTab === 'function') {
        switchTab(data.value);
        _showVoiceBanner(data.text || '', TAB_NAMES[data.value] || '');
        try { new Audio('/static/sounds/ding.mp3').play().catch(function(){}); } catch(e) {}
      }
    }
  }

  function _connect() {
    if (_sse) { try { _sse.close(); } catch(e) {} _sse = null; }

    _sse = new EventSource('/api/voice-cmd/stream/');

    _sse.onmessage = _handleEvent;

    _sse.onerror = function() {
      try { _sse.close(); } catch(e) {}
      _sse = null;
      setTimeout(_connect, _retryDelay);
      _retryDelay = Math.min(_retryDelay * 1.5, 30000);
    };

    _sse.onopen = function() { _retryDelay = 2000; };
  }

  // أغلق الـ SSE نظيفاً عند مغادرة الصفحة لتجنب تحذير ASGI
  window.addEventListener('beforeunload', function() {
    if (_sse) { try { _sse.close(); } catch(e) {} _sse = null; }
  });

  // ابدأ الاتصال بعد تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _connect);
  } else {
    _connect();
  }

}());

// ══════════════════════════════════════════════════════════════════
// صناديق المشرفين — Supervisor Boxes (Admin view)
// ══════════════════════════════════════════════════════════════════

var _sbBoxes = [];

window.sbRenderBoxes = function sbRenderBoxes(alsoLoadLog) {
  var grid = document.getElementById('sb-boxes-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);">جاري التحميل...</div>';
  fetch('/api/supervisor-boxes', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _sbBoxes = data.boxes || [];
      if (alsoLoadLog) sbRenderLog();
      if (!_sbBoxes.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);">لا توجد صناديق — سيظهر الصندوق تلقائياً عند أول إيداع</div>';
        return;
      }
      grid.innerHTML = _sbBoxes.map(function(b) {
        return '<div style="background:var(--surface-card);border:1px solid var(--border-card);border-radius:14px;padding:20px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
              '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#059669,#047857);display:flex;align-items:center;justify-content:center;">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>' +
              '</div>' +
              '<div>' +
                '<div style="font-weight:700;font-size:14px;">' + b.name + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">@' + b.username + '</div>' +
              '</div>' +
            '</div>' +
            '<button onclick="sbOpenDepositModal(\'' + b.username + '\')" style="padding:6px 12px;border-radius:8px;border:none;background:linear-gradient(135deg,#059669,#047857);color:#fff;font-size:11px;font-weight:700;cursor:pointer;">إيداع</button>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">' +
            _sbBalancePill('USD', b.balanceUSD) +
            _sbBalancePill('ILS', b.balanceILS) +
            _sbBalancePill('JOD', b.balanceJOD) +
          '</div>' +
          '<div style="margin-top:12px;text-align:left;">' +
            '<a href="#" onclick="sbViewLog(\'' + b.username + '\');return false;" style="font-size:11px;color:var(--accent-blue);text-decoration:none;">عرض السجل ›</a>' +
          '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function() {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:#f87171;">تعذّر تحميل البيانات</div>';
    });
}

function _sbBalancePill(currency, amount) {
  var flags = { USD: '🇺🇸', ILS: '🇵🇸', JOD: '🇯🇴' };
  var color = amount > 0 ? '#10b981' : 'var(--text-muted)';
  return '<div style="background:var(--surface-raised,rgba(255,255,255,0.04));border-radius:8px;padding:8px;text-align:center;">' +
    '<div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;">' + (flags[currency] || '') + ' ' + currency + '</div>' +
    '<div style="font-weight:800;font-size:14px;color:' + color + ';">' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div>' +
  '</div>';
}

window.sbRenderLog = function sbRenderLog(username) {
  var body = document.getElementById('sb-log-body');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">جاري التحميل...</td></tr>';
  var url = username ? '/api/supervisor-boxes/' + username + '/log' : '/api/supervisor-boxes/' + 'all/log';
  // fallback: load first supervisor or generic endpoint
  var allBoxes = _sbBoxes;
  if (!username && allBoxes.length) username = allBoxes[0].username;
  if (!username) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد بيانات</td></tr>';
    return;
  }
  fetch('/api/supervisor-boxes/' + username + '/log', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var logs = data.log || [];
      if (!logs.length) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد حركات بعد</td></tr>';
        return;
      }
      var typeLabels = { deposit: 'إيداع', distribute: 'توزيع', reclaim: 'استرداد' };
      var typeColors = { deposit: '#10b981', distribute: '#f59e0b', reclaim: '#6366f1' };
      body.innerHTML = logs.map(function(l) {
        var dt = new Date(l.createdAt || l.created_at);
        var dtStr = dt.toLocaleDateString('ar-SA') + ' ' + dt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        var opType = l.type || l.op_type;
        var color = typeColors[opType] || 'var(--text-muted)';
        return '<tr style="border-bottom:1px solid var(--border-card);">' +
          '<td style="padding:10px 14px;">' + (l.supervisor || l.supervisor_username || '—') + '</td>' +
          '<td style="padding:10px 14px;"><span style="color:' + color + ';font-weight:700;">' + (typeLabels[opType] || opType) + '</span></td>' +
          '<td style="padding:10px 14px;">' + l.currency + '</td>' +
          '<td style="padding:10px 14px;font-weight:700;">' + Number(l.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
          '<td style="padding:10px 14px;">' + (l.teller || '—') + '</td>' +
          '<td style="padding:10px 14px;">' + (l.createdBy || l.created_by || '—') + '</td>' +
          '<td style="padding:10px 14px;font-size:11px;color:var(--text-muted);">' + dtStr + '</td>' +
        '</tr>';
      }).join('');
    })
    .catch(function() {
      body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#f87171;">تعذّر تحميل السجل</td></tr>';
    });
}

window.sbViewLog = function sbViewLog(username) {
  sbRenderLog(username);
  var logWrap = document.getElementById('sb-log-wrap');
  if (logWrap) logWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _sbGetModal() {
  var m = document.getElementById('sb-deposit-modal');
  if (m) return m;
  // بناء المودال من الصفر وإضافته مباشرة إلى body
  m = document.createElement('div');
  m.id = 'sb-deposit-modal';
  m.onclick = function(e) { if (e.target === m) _sbModalClose(); };
  m.innerHTML = [
    '<div style="background:var(--surface-modal,#1a2235);border:1px solid var(--border-card,rgba(255,255,255,0.1));border-radius:16px;padding:28px;width:90%;max-width:460px;">',
      '<div style="font-size:18px;font-weight:900;color:#e2e8f0;margin-bottom:6px;">إيداع في صندوق المشرف</div>',
      '<div style="font-size:12px;color:rgba(200,210,220,0.6);margin-bottom:20px;">تحويل مبلغ من الإدارة إلى صندوق المشرف</div>',
      '<div style="display:flex;flex-direction:column;gap:14px;">',
        '<div><label style="font-size:11px;color:rgba(200,210,220,0.7);display:block;margin-bottom:5px;">المشرف *</label>',
          '<select id="sb-dep-supervisor" style="width:100%;padding:9px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#e2e8f0;font-size:13px;font-family:Cairo,sans-serif;"></select></div>',
        '<div><label style="font-size:11px;color:rgba(200,210,220,0.7);display:block;margin-bottom:5px;">العملة *</label>',
          '<select id="sb-dep-currency" style="width:100%;padding:9px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#e2e8f0;font-size:13px;font-family:Cairo,sans-serif;">',
            '<option value="USD">دولار (USD)</option>',
            '<option value="ILS">شيكل (ILS)</option>',
            '<option value="JOD">دينار (JOD)</option>',
          '</select></div>',
        '<div><label style="font-size:11px;color:rgba(200,210,220,0.7);display:block;margin-bottom:5px;">المبلغ *</label>',
          '<input id="sb-dep-amount" type="number" min="0.01" step="0.01" placeholder="0.00" style="width:100%;padding:9px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#e2e8f0;font-size:13px;font-family:Cairo,sans-serif;box-sizing:border-box;"></div>',
        '<div><label style="font-size:11px;color:rgba(200,210,220,0.7);display:block;margin-bottom:5px;">ملاحظات</label>',
          '<input id="sb-dep-notes" type="text" placeholder="اختياري" style="width:100%;padding:9px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#e2e8f0;font-size:13px;font-family:Cairo,sans-serif;box-sizing:border-box;"></div>',
        '<div style="display:flex;gap:10px;margin-top:4px;">',
          '<button onclick="sbDoDeposit()" style="flex:1;padding:10px;background:linear-gradient(135deg,#d97706,#b45309);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:Cairo,sans-serif;">تأكيد الإيداع</button>',
          '<button onclick="_sbModalClose()" style="flex:1;padding:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#e2e8f0;font-size:13px;font-weight:700;cursor:pointer;font-family:Cairo,sans-serif;">إلغاء</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(m);
  return m;
}

function _sbModalOpen() {
  var m = _sbGetModal();
  m.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:rgba(5,10,25,0.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;direction:rtl;';
}
function _sbModalClose() {
  var m = document.getElementById('sb-deposit-modal');
  if (m) m.style.display = 'none';
}

window.sbOpenDepositModal = function sbOpenDepositModal(username) {
  var sel   = document.getElementById('sb-dep-supervisor');
  var amt   = document.getElementById('sb-dep-amount');
  var notes = document.getElementById('sb-dep-notes');

  if (amt)   amt.value   = '';
  if (notes) notes.value = '';

  if (_sbBoxes.length) {
    _sbFillDepositSel(username);
    _sbModalOpen();
    return;
  }

  if (sel) sel.innerHTML = '<option>جاري التحميل...</option>';
  fetch('/api/supervisor-boxes', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      _sbBoxes = data.boxes || [];
      _sbFillDepositSel(username);
      _sbModalOpen();
    })
    .catch(function() {
      if (typeof showToast === 'function') showToast('تعذّر تحميل قائمة المشرفين', 'error');
    });
}

function _sbFillDepositSel(preselect) {
  var sel = document.getElementById('sb-dep-supervisor');
  if (!sel) return;
  sel.innerHTML = _sbBoxes.map(function(b) {
    var selected = b.username === preselect ? ' selected' : '';
    return '<option value="' + b.username + '"' + selected + '>' + b.name + ' (@' + b.username + ')</option>';
  }).join('');
  // if no boxes, allow manual entry fallback
  if (!_sbBoxes.length) {
    sel.innerHTML = '<option value="">لا يوجد مشرفون</option>';
  }
}

window.sbDoDeposit = function sbDoDeposit() {
  var username = document.getElementById('sb-dep-supervisor').value;
  var currency = document.getElementById('sb-dep-currency').value;
  var amount   = parseFloat(document.getElementById('sb-dep-amount').value);
  var notes    = document.getElementById('sb-dep-notes').value;
  if (!username) { if (typeof showToast === 'function') showToast('اختر المشرف', 'warn'); return; }
  if (!amount || amount <= 0) { if (typeof showToast === 'function') showToast('أدخل مبلغاً صحيحاً', 'warn'); return; }
  fetch('/api/supervisor-boxes/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': (document.cookie.split(';').find(function(c){return c.trim().startsWith('csrftoken=');})||'').split('=')[1]||'' },
    body: JSON.stringify({ supervisor: username, currency: currency, amount: amount, notes: notes })
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success || data.ok) {
        _sbModalClose();
        if (typeof showToast === 'function') showToast('تم الإيداع بنجاح', 'ok');
        sbRenderBoxes();
        sbRenderLog(username);
      } else {
        if (typeof showToast === 'function') showToast(data.message || data.error || 'فشل الإيداع', 'error');
      }
    })
    .catch(function() {
      if (typeof showToast === 'function') showToast('خطأ في الاتصال', 'error');
    });
}

// ══ إدارة المراكز والعمليات الحسابية ══
function accAction(key) {
  const routes = {
    'customers':         '/accounts/customers/',
    'agents':            '/accounts/agents/',
    'safes':             '/accounts/safes/',
    'debt-limit':        '/accounts/debt-limit/',
    'cost-center':       '/accounts/cost-center/',
    'account-statement': '/accounts/statement/',
    'all-transfers':     '/accounts/transfers/',
    'received-transfers':'/accounts/transfers/?status=received',
    'unreceived-transfers':'/accounts/transfers/?status=pending',
    'new-entry':         '/accounts/entry/new/',
    'advanced-entry':    '/accounts/entry/advanced/',
    'simple-entry':      '/accounts/entry/simple/',
    'cut-voucher':       '/accounts/voucher/cut/',
    'close-open':        '/accounts/period/close/',
    'exchange':          '/accounts/exchange/',
    'payment-voucher':   '/accounts/voucher/payment/',
    'receipt-voucher':   '/accounts/voucher/receipt/',
    'new-movement':      '/accounts/movement/new/',
    'cut-transfer':      '/accounts/transfer/cut/',
    'sawa-transfer':     '/accounts/transfer/sawa/',
    'send-credit':       '/accounts/credit/send/',
    'internal-credit':   '/accounts/credit/internal/',
    'external-credit':   '/accounts/credit/external/',
    'vouchers':          '/accounts/vouchers/',
    'delivery-entry':    '/accounts/delivery/entry/',
    'delivered':         '/accounts/delivery/done/',
    'edit-packages':     '/accounts/packages/edit/',
    'cut-prices':        '/accounts/prices/cut/',
    'advanced-search':   '/accounts/search/',
    'chart':             '/accounts/chart/',
    'voucher-verify':    '/accounts/vouchers/verify/',
    'work-monitor':      '/accounts/monitor/',
    'fax':               '/accounts/fax/',
  };
  const url = routes[key];
  if (url) {
    showToast('هذه الوحدة قيد الإنشاء', 'warning');
  }
}
