/* ══════════════════════════════════════════════════════════════════
   Agent Dashboard — JavaScript
   ══════════════════════════════════════════════════════════════════ */

'use strict';

/* ── State ─────────────────────────────────────────────────────── */
let _agentId       = null;
let _agentData     = null;
let _transfers     = [];
let _balanceLogs   = [];
let _tfFilter      = 'all';
let _tfQuery       = '';
let _balFilter     = 'all';
let _tfPage        = 1;
let _balPage       = 1;
const PAGE_SIZE    = 20;
let _confirmTxId   = null;
let _verifyRcpId   = null;
let _verifyTxId    = null;
let _selectedFile  = null;

/* ── Init ──────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setDate();
  loadCurrentUser();
  loadAgents();

  // Close modals on overlay click
  ['ag-deposit-overlay','ag-confirm-overlay','ag-verify-overlay'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target.id === id) closeModal(id);
    });
  });
});

function setDate() {
  const el = document.getElementById('ag-date');
  if (el) el.textContent = new Date().toLocaleDateString('ar-EG', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
}

function loadCurrentUser() {
  fetch('/api/me/')
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        const el = document.getElementById('ag-center-name');
        if (el) el.textContent = d.user?.full_name || d.user?.username || '—';
      }
    }).catch(() => {});
}

/* ── Load Agents List ──────────────────────────────────────────── */
function loadAgents(refresh = false) {
  fetch('/api/ts/agents')
    .then(r => r.json())
    .then(d => {
      if (!d.success) return;
      const sel = document.getElementById('ag-select');
      const prev = sel.value;
      sel.innerHTML = '<option value="">— اختر وكيلاً —</option>';
      (d.agents || []).forEach(ag => {
        const opt = document.createElement('option');
        opt.value = ag.id;
        opt.textContent = `${ag.name} — ${ag.country || ''}`;
        sel.appendChild(opt);
      });
      // Restore selection
      if (prev && sel.querySelector(`option[value="${prev}"]`)) {
        sel.value = prev;
        if (refresh && _agentId) loadDashboard(_agentId);
      }
      if (refresh) agToast('تم تحديث قائمة الوكلاء', 'success');
    }).catch(() => agToast('تعذّر تحميل قائمة الوكلاء', 'warn'));
}

/* ── Select Agent ──────────────────────────────────────────────── */
function selectAgent(id) {
  _agentId = id || null;
  if (!id) {
    showEmpty();
    return;
  }
  loadDashboard(id);
  loadTransfers(id, 1);
  loadBalanceHistory(id, 1);
}

function showEmpty() {
  document.getElementById('ag-empty').style.display = 'flex';
  document.getElementById('ag-dash').style.display  = 'none';
  document.getElementById('ag-sidebar-card').style.display = 'none';
}

/* ── Dashboard Data ────────────────────────────────────────────── */
function loadDashboard(id) {
  fetch(`/api/agents/${id}/dashboard`)
    .then(r => r.json())
    .then(d => {
      if (!d.success) { agToast(d.message || 'خطأ في تحميل البيانات', 'warn'); return; }
      _agentData = d;
      renderDashboard(d);
    })
    .catch(() => agToast('تعذّر الاتصال بالخادم', 'warn'));
}

function renderDashboard(d) {
  const ag  = d.agent  || {};
  const bal = d.balance || {};
  const st  = d.stats   || {};

  // Show content
  document.getElementById('ag-empty').style.display = 'none';
  document.getElementById('ag-dash').style.display  = 'flex';
  document.getElementById('ag-dash').style.flexDirection = 'column';
  document.getElementById('ag-dash').style.gap = '18px';

  // Title
  document.getElementById('ag-title').textContent    = `لوحة الوكيل — ${ag.name || ''}`;
  document.getElementById('ag-subtitle').textContent = `${ag.country || ''} | عمولة 2.5%`;

  // Stat cards
  setText('c-balance',    fmt4(bal.usdt));
  setText('c-frozen',     fmt4(bal.frozenUsdt));
  setText('c-available',  fmt4(bal.availableUsdt));
  setText('c-pending',    st.pending   || 0);
  setText('c-urgent',     st.urgent    || 0);
  setText('c-commission', fmt4(st.totalCommission));

  // Agent info panel
  setText('inf-name',    ag.name    || '—');
  setText('inf-country', ag.country || '—');
  setText('inf-phone',   ag.phone   || '—');
  setText('inf-email',   ag.email   || '—');
  setText('inf-joined',  ag.joined_at ? fmtDate(ag.joined_at) : '—');

  const statusEl = document.getElementById('inf-status');
  if (statusEl) statusEl.innerHTML = statusBadge(ag.status || 'active');

  const rate = ag.completion_rate || 0;
  setText('inf-rate-pct', rate + '%');
  const fill = document.getElementById('inf-rate-fill');
  if (fill) fill.style.width = Math.min(rate, 100) + '%';

  // Sidebar card
  const card = document.getElementById('ag-sidebar-card');
  if (card) {
    card.style.display = 'block';
    const av = document.getElementById('ag-sidebar-avatar');
    if (av) av.textContent = (ag.name || 'و')[0];
    setText('ag-sidebar-name',      ag.name    || '—');
    setText('ag-sidebar-country',   ag.country || '—');
    setText('ag-sidebar-available', fmt4(bal.availableUsdt) + ' USDT');
    setText('ag-sidebar-rate-pct',  rate + '%');
    const prog = document.getElementById('ag-sidebar-prog');
    if (prog) prog.style.width = Math.min(rate, 100) + '%';
  }

  // Recent transfers
  renderRecentTransfers(d.recentTransfers || []);

  // Pending badge
  const pb = document.getElementById('ag-nav-pending-badge');
  if (pb) {
    pb.textContent    = st.pending || 0;
    pb.style.display  = (st.pending > 0) ? 'inline' : 'none';
  }

  // Transfers section subtitle
  setText('tf-agent-name', `وكيل: ${ag.name || ''}`);
}

function renderRecentTransfers(list) {
  const tb = document.getElementById('ag-recent-tbody');
  if (!tb) return;
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="4" class="ag-empty-row">لا توجد حوالات بعد</td></tr>';
    return;
  }
  tb.innerHTML = list.map(t => `
    <tr>
      <td style="font-size:11px;font-weight:700;color:#60a5fa;">${t.ref_number || t.id}</td>
      <td>${t.receiver_name || '—'}</td>
      <td style="color:#fcd34d;font-weight:700;">${fmt4(t.amount_usdt)}</td>
      <td>${statusBadge(t.status)}</td>
    </tr>`).join('');
}

/* ── Transfers Section ─────────────────────────────────────────── */
function loadTransfers(id, page = 1) {
  if (!id) return;
  _tfPage = page;
  let url = `/api/agents/${id}/transfers?page=${page}&pageSize=${PAGE_SIZE}`;
  if (_tfFilter && _tfFilter !== 'all' && _tfFilter !== 'urgent')
    url += `&status=${_tfFilter}`;
  if (_tfFilter === 'urgent') url += '&urgent=1';

  fetch(url)
    .then(r => r.json())
    .then(d => {
      if (!d.success) return;
      _transfers = d.transfers || [];
      renderTransfers(_transfers, d.total || 0, page);
      // Update pending badge
      const badge = document.getElementById('tf-badge-pending');
      if (badge && _tfFilter === 'all') badge.textContent = '';
    })
    .catch(() => agToast('تعذّر تحميل الحوالات', 'warn'));
}

function filterTf(f, btn) {
  _tfFilter = f;
  _tfQuery  = '';
  document.getElementById('tf-search').value = '';
  document.querySelectorAll('#ag-sec-transfers .sv-filter-btn')
          .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadTransfers(_agentId, 1);
}

function searchTf(q) {
  _tfQuery = q.toLowerCase().trim();
  const filtered = _transfers.filter(t =>
    (t.ref_number || '').toLowerCase().includes(_tfQuery) ||
    (t.receiver_name || '').toLowerCase().includes(_tfQuery) ||
    (t.sender_name || '').toLowerCase().includes(_tfQuery)
  );
  renderTransferRows(filtered);
}

function renderTransfers(list, total, page) {
  renderTransferRows(list);
  renderFooter('ag-tf-footer', total, page, PAGE_SIZE, p => loadTransfers(_agentId, p));
}

function renderTransferRows(list) {
  const tb = document.getElementById('ag-tf-tbody');
  if (!tb) return;
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="9" class="ag-empty-row">لا توجد حوالات مطابقة</td></tr>';
    return;
  }
  tb.innerHTML = list.map(t => {
    const urgent = t.is_urgent
      ? '<span class="ag-urgent-badge"><i class="fa-solid fa-triangle-exclamation"></i> مستعجل</span>'
      : '<span style="color:#475569;font-size:11px;">عادي</span>';

    const actions = buildTransferActions(t);

    return `
    <tr>
      <td style="font-weight:800;color:#60a5fa;">${t.ref_number || t.id}</td>
      <td>${t.sender_name || '—'}</td>
      <td style="font-weight:700;">${t.receiver_name || '—'}</td>
      <td style="color:#fcd34d;font-weight:800;">${fmt4(t.amount_usdt)}</td>
      <td>${t.country || '—'}</td>
      <td>${urgent}</td>
      <td>${statusBadge(t.status)}</td>
      <td style="font-size:10px;color:#475569;">${fmtDate(t.created_at)}</td>
      <td><div class="sv-action-btns">${actions}</div></td>
    </tr>`;
  }).join('');
}

function buildTransferActions(t) {
  let html = '';
  if (t.status === 'pending' || t.status === 'processing') {
    html += `<button class="sv-btn sv-btn-edit"
               onclick="openConfirmModal(${t.id})">
               <i class="fa-solid fa-check"></i> تنفيذ
             </button>`;
  }
  if (t.status === 'processing' && t.receipt_id) {
    html += `<button class="sv-btn sv-btn-details"
               onclick="openVerifyModal(${t.receipt_id},${t.id})">
               <i class="fa-solid fa-shield-check"></i> تحقق
             </button>`;
  }
  if (!html) html = '<span style="color:#475569;font-size:11px;">—</span>';
  return html;
}

/* ── Balance History ───────────────────────────────────────────── */
function loadBalanceHistory(id, page = 1) {
  if (!id) return;
  _balPage = page;
  fetch(`/api/agents/${id}/balance/history?page=${page}&pageSize=${PAGE_SIZE}`)
    .then(r => r.json())
    .then(d => {
      if (!d.success) return;
      _balanceLogs = d.logs || [];
      renderBalance(_balanceLogs, d.total || 0, page, d.currentBalance);
    })
    .catch(() => {});
}

function filterBal(f, btn) {
  _balFilter = f;
  document.querySelectorAll('#ag-sec-balance .sv-filter-btn')
          .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = _balFilter === 'all'
    ? _balanceLogs
    : _balanceLogs.filter(l => l.txn_type === _balFilter);
  renderBalanceRows(filtered);
}

function renderBalance(list, total, page, currentBalance) {
  renderBalanceRows(list);
  renderFooter('ag-bal-footer', total, page, PAGE_SIZE, p => loadBalanceHistory(_agentId, p));

  // Summary
  const sumEl = document.getElementById('ag-bal-summary');
  if (sumEl && currentBalance !== undefined) {
    sumEl.innerHTML = `
      <span class="ag-bal-item">
        <span class="ag-bal-dot" style="background:#34d399;"></span>
        الرصيد الحالي: <strong style="color:#34d399;">${fmt4(currentBalance)} USDT</strong>
      </span>`;
  }
}

function renderBalanceRows(list) {
  const tb = document.getElementById('ag-bal-tbody');
  if (!tb) return;
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="6" class="ag-empty-row">لا توجد سجلات</td></tr>';
    return;
  }
  tb.innerHTML = list.map(l => {
    const typeMap = {
      deposit:    ['إيداع',  'ag-type-deposit',    '+'],
      deduction:  ['خصم',    'ag-type-deduction',   '-'],
      commission: ['عمولة',  'ag-type-commission',  '+'],
    };
    const [lbl, cls, sign] = typeMap[l.txn_type] || [l.txn_type, '', ''];
    return `
    <tr>
      <td><span class="${cls}">${lbl}</span></td>
      <td style="font-weight:800;${cls==='ag-type-deduction'?'color:#f87171;':'color:#34d399;'}">
        ${sign}${fmt4(l.amount_usdt)} USDT
      </td>
      <td style="font-weight:700;">${fmt4(l.balance_after)} USDT</td>
      <td style="color:var(--text-secondary);font-size:11px;">${l.notes || '—'}</td>
      <td style="font-size:11px;">${l.created_by || '—'}</td>
      <td style="font-size:10px;color:#475569;">${fmtDate(l.created_at)}</td>
    </tr>`;
  }).join('');
}

/* ── Navigation ────────────────────────────────────────────────── */
function agNav(btn, section = 'overview') {
  document.querySelectorAll('.sv-nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.ag-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`ag-sec-${section}`);
  if (target) target.classList.add('active');

  // Reload if agent is selected
  if (_agentId) {
    if (section === 'transfers') loadTransfers(_agentId, 1);
    if (section === 'balance')   loadBalanceHistory(_agentId, 1);
  }
}

/* ── Deposit Modal ─────────────────────────────────────────────── */
function openDepositModal() {
  if (!_agentId) { agToast('اختر وكيلاً أولاً', 'warn'); return; }
  const name = _agentData?.agent?.name || '—';
  setText('dep-agent-name', name);
  document.getElementById('dep-amount').value = '';
  document.getElementById('dep-notes').value  = '';
  openModal('ag-deposit-overlay');
}

function submitDeposit() {
  const amount = parseFloat(document.getElementById('dep-amount').value);
  const notes  = document.getElementById('dep-notes').value.trim();

  if (!amount || amount <= 0) { agToast('أدخل مبلغاً صحيحاً', 'warn'); return; }

  const csrf = getCsrf();
  fetch(`/api/agents/${_agentId}/balance/deposit`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-CSRFToken': csrf },
    body: JSON.stringify({ amount, notes }),
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      agToast(`تم الإيداع بنجاح | الرصيد الجديد: ${fmt4(d.newBalance)} USDT`, 'success');
      closeModal('ag-deposit-overlay');
      loadDashboard(_agentId);
      loadBalanceHistory(_agentId, 1);
    } else {
      agToast(d.message || 'فشل الإيداع', 'warn');
    }
  })
  .catch(() => agToast('خطأ في الاتصال', 'warn'));
}

/* ── Confirm Transfer Modal ────────────────────────────────────── */
function openConfirmModal(transferId) {
  _confirmTxId   = transferId;
  _selectedFile  = null;
  document.getElementById('confirm-notes').value = '';
  const fileZone  = document.getElementById('ag-file-zone');
  const fileLabel = document.getElementById('ag-file-label');
  fileZone.classList.remove('has-file');
  fileLabel.textContent = 'اضغط لرفع صورة الإيصال';
  document.getElementById('ag-file-input').value = '';

  // Find transfer info
  const t = _transfers.find(x => x.id === transferId);
  const card = document.getElementById('confirm-transfer-card');
  if (card && t) {
    card.innerHTML = `
      <div class="ag-tc-row">
        <span class="ag-tc-lbl">رقم المرجع</span>
        <span class="ag-tc-val" style="color:#60a5fa;">${t.ref_number || t.id}</span>
      </div>
      <div class="ag-tc-row">
        <span class="ag-tc-lbl">المستفيد</span>
        <span class="ag-tc-val">${t.receiver_name || '—'}</span>
      </div>
      <div class="ag-tc-row">
        <span class="ag-tc-lbl">المبلغ</span>
        <span class="ag-tc-val amount">${fmt4(t.amount_usdt)} USDT</span>
      </div>
      <div class="ag-tc-row">
        <span class="ag-tc-lbl">الدولة</span>
        <span class="ag-tc-val">${t.country || '—'}</span>
      </div>
      ${t.is_urgent ? '<div class="ag-tc-row"><span class="ag-tc-lbl">الأولوية</span><span class="ag-tc-val urgent"><i class="fa-solid fa-triangle-exclamation"></i> مستعجل</span></div>' : ''}`;
  }
  openModal('ag-confirm-overlay');
}

function onFileSelect(input) {
  if (!input.files.length) return;
  _selectedFile = input.files[0];
  const zone  = document.getElementById('ag-file-zone');
  const label = document.getElementById('ag-file-label');
  zone.classList.add('has-file');
  label.textContent = _selectedFile.name;
}

function submitConfirm() {
  if (!_confirmTxId) return;
  if (!_selectedFile) { agToast('يرجى رفع صورة الإيصال', 'warn'); return; }

  const formData = new FormData();
  formData.append('receipt', _selectedFile);
  formData.append('notes',   document.getElementById('confirm-notes').value.trim());

  fetch(`/api/agents/${_agentId}/transfers/${_confirmTxId}/confirm`, {
    method: 'POST',
    headers: { 'X-CSRFToken': getCsrf() },
    body: formData,
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      agToast('تم تسجيل التنفيذ بنجاح — بانتظار تحقق المشرف', 'success');
      closeModal('ag-confirm-overlay');
      loadTransfers(_agentId, _tfPage);
      loadDashboard(_agentId);
    } else {
      agToast(d.message || 'فشل التنفيذ', 'warn');
    }
  })
  .catch(() => agToast('خطأ في الاتصال', 'warn'));
}

/* ── Verify Receipt Modal ──────────────────────────────────────── */
function openVerifyModal(receiptId, transferId) {
  _verifyRcpId = receiptId;
  _verifyTxId  = transferId;

  const t   = _transfers.find(x => x.id === transferId);
  const card = document.getElementById('verify-card');
  if (card && t) {
    card.innerHTML = `
      <div style="margin-bottom:10px;font-size:12px;color:var(--text-secondary);">
        <i class="fa-solid fa-circle-info" style="color:#a78bfa;margin-left:6px;"></i>
        سيتم خصم <strong style="color:#a78bfa;">${fmt4(t.amount_usdt)} USDT</strong>
        من رصيد الوكيل وإضافة العمولة عند التأكيد.
      </div>
      <div class="ag-tc-row">
        <span class="ag-tc-lbl">رقم المرجع</span>
        <span class="ag-tc-val" style="color:#60a5fa;">${t.ref_number || t.id}</span>
      </div>
      <div class="ag-tc-row">
        <span class="ag-tc-lbl">المستفيد</span>
        <span class="ag-tc-val">${t.receiver_name || '—'}</span>
      </div>
      <div class="ag-tc-row">
        <span class="ag-tc-lbl">المبلغ</span>
        <span class="ag-tc-val amount">${fmt4(t.amount_usdt)} USDT</span>
      </div>`;
  }
  openModal('ag-verify-overlay');
}

function submitVerify() {
  if (!_verifyRcpId) return;
  fetch(`/api/agents/${_agentId}/receipts/${_verifyRcpId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'X-CSRFToken': getCsrf() },
    body: JSON.stringify({}),
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      agToast(`تم التحقق | خُصم: ${fmt4(d.deducted)} USDT | عمولة: ${fmt4(d.commission)} USDT`, 'success');
      closeModal('ag-verify-overlay');
      loadDashboard(_agentId);
      loadTransfers(_agentId, _tfPage);
      loadBalanceHistory(_agentId, 1);
    } else {
      agToast(d.message || 'فشل التحقق', 'warn');
    }
  })
  .catch(() => agToast('خطأ في الاتصال', 'warn'));
}

/* ── Modal Helpers ─────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* ── Pagination Footer ─────────────────────────────────────────── */
function renderFooter(elId, total, page, size, onPage) {
  const el    = document.getElementById(elId);
  if (!el) return;
  const pages = Math.ceil(total / size) || 1;
  el.innerHTML = `
    <span>${total} سجل | صفحة ${page} من ${pages}</span>
    <div class="ag-page-btns">
      <button class="ag-page-btn" onclick="(${onPage})(${page - 1})"
              ${page <= 1 ? 'disabled' : ''}>
        <i class="fa-solid fa-angle-right"></i>
      </button>
      ${buildPageNums(page, pages, onPage)}
      <button class="ag-page-btn" onclick="(${onPage})(${page + 1})"
              ${page >= pages ? 'disabled' : ''}>
        <i class="fa-solid fa-angle-left"></i>
      </button>
    </div>`;
}

function buildPageNums(current, total, fn) {
  let html = '';
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
    html += `<button class="ag-page-btn ${i === current ? 'active' : ''}"
                     onclick="(${fn})(${i})">${i}</button>`;
  }
  return html;
}

/* ── Utility ───────────────────────────────────────────────────── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function fmt4(n) {
  const v = parseFloat(n);
  return isNaN(v) ? '0.0000' : v.toLocaleString('en-US', { minimumFractionDigits:4, maximumFractionDigits:4 });
}

function fmtDate(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleString('ar-EG', {
      year:'numeric', month:'short', day:'numeric',
      hour:'2-digit', minute:'2-digit',
    });
  } catch { return str; }
}

function statusBadge(status) {
  const map = {
    pending:    ['معلّق',      'pending'],
    processing: ['قيد التنفيذ','processing'],
    completed:  ['منجز',       'done'],
    cancelled:  ['ملغى',       'cancelled'],
    failed:     ['فشل',        'failed'],
    active:     ['نشط',        'online'],
    inactive:   ['غير نشط',   'offline'],
    suspended:  ['موقوف',      'failed'],
  };
  const [lbl, cls] = map[status] || [status, 'offline'];
  return `<span class="sv-badge ${cls}"><span class="sv-badge-dot"></span>${lbl}</span>`;
}

function getCsrf() {
  return (document.cookie.split(';').find(c => c.trim().startsWith('csrftoken=')) || '').split('=')[1] || '';
}

/* ── Toast ─────────────────────────────────────────────────────── */
function agToast(msg, type = 'info') {
  const wrap = document.getElementById('ag-toast-wrap');
  if (!wrap) return;
  const icons = { success:'✅', warn:'⚠️', info:'ℹ️' };
  const t = document.createElement('div');
  t.className = `sv-toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
