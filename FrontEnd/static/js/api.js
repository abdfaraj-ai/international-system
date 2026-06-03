/**
 * api.js — طبقة الاتصال بالباك اند
 * ربط جميع صفحات الفرونت اند بـ Django REST APIs
 */

// ── In-memory secure cache (replaces localStorage for sensitive data) ────────
window._intlCache = window._intlCache || {};

// ── CSRF helper ──────────────────────────────────────────────────────────────
function getCsrf() {
  const match = document.cookie.split(';').find(c => c.trim().startsWith('csrftoken='));
  return match ? match.split('=')[1].trim() : '';
}

// ── Session expiry handler ────────────────────────────────────────────────────
let _sessionExpiredShown = false;
function _handleAuthError(status) {
  if (status === 401 && !_sessionExpiredShown) {
    _sessionExpiredShown = true;
    _apiToast('انتهت جلستك — سيتم توجيهك لتسجيل الدخول', 'error');
    setTimeout(() => { window.location.href = '/login/'; }, 1500);
  }
}

// ── Generic fetch helpers ─────────────────────────────────────────────────────
async function apiGet(url, params = {}) {
  const q = new URLSearchParams(params).toString();
  const fullUrl = q ? `${url}?${q}` : url;
  const r = await fetch(fullUrl, { credentials: 'same-origin' });
  if (r.status === 401) { _handleAuthError(401); return { success: false, _expired: true }; }
  return r.json();
}

async function apiPost(url, data = {}) {
  const r = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
    body:    JSON.stringify(data),
    credentials: 'same-origin',
  });
  if (r.status === 401) { _handleAuthError(401); return { success: false, _expired: true }; }
  return r.json();
}

async function apiPatch(url, data = {}) {
  const r = await fetch(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
    body:    JSON.stringify(data),
    credentials: 'same-origin',
  });
  if (r.status === 401) { _handleAuthError(401); return { success: false, _expired: true }; }
  return r.json();
}

async function apiDelete(url) {
  const r = await fetch(url, {
    method:  'DELETE',
    headers: { 'X-CSRFToken': getCsrf() },
    credentials: 'same-origin',
  });
  if (r.status === 401) { _handleAuthError(401); return { success: false, _expired: true }; }
  return r.json();
}

// ── toast/notify universal ────────────────────────────────────────────────────
function _apiToast(msg, type = 'success') {
  if (typeof notify    === 'function') { notify(msg, type);           return; }
  if (typeof showToast === 'function') { showToast(msg, type, '⚠️'); return; }
  console.log(`[api ${type}] ${msg}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// DASHBOARD (M01)
// ════════════════════════════════════════════════════════════════════════════════
async function initDashboard() {
  try {
    const [branchesResp, mainBoxResp, supervisorsResp, statsResp, txResp, reportsResp] = await Promise.all([
      apiGet('/api/branches'),
      apiGet('/api/main-box'),
      apiGet('/api/supervisors'),
      apiGet('/api/dash/stats'),
      apiGet('/api/transactions-unified', { per_page: 100 }),
      apiGet('/api/reports'),
    ]);

    // ── الفروع ──
    if (branchesResp.success && Array.isArray(branchesResp.branches)) {
      state.branches = branchesResp.branches.map(b => ({
        id:          b.id,
        name:        b.name,
        location:    b.location || '',
        isMain:      b.isMain || false,
        status:      b.status || 'active',
        currency:    b.currency || 'USD',
        balances:    { USD: b.balanceUsd || 0, ILS: b.balanceIls || 0, JOD: b.balanceJod || 0 },
        pages:       b.pages || {
          tellerMgr:    { active: true },
          tellerDept:   { active: true },
          bankTransfer: { active: true },
        },
        supervisors: [],
        tellers:     [],
      }));
    }

    // ── المشرفون → توزيعهم على الفروع ──
    if (supervisorsResp.success && Array.isArray(supervisorsResp.users)) {
      const tellerSups    = supervisorsResp.users.filter(u => u.role === 'M02');
      const transfersSups = supervisorsResp.users.filter(u => u.role === 'M03');

      tellerSups.forEach(u => {
        const branch = state.branches[0];
        if (branch) branch.supervisors.push({
          id:       u.id || u.username,
          name:     (u.firstName + ' ' + u.lastName).trim() || u.username,
          phone:    u.phone || '',
          status:   u.isActive !== false ? 'active' : 'inactive',
          shift:    'صباحي',
          branchId: branch.id,
          username: u.username,
          role:     'M02',
        });
      });

      if (typeof saveTransfersSupervisors === 'function') {
        saveTransfersSupervisors(transfersSups.map(u => ({
          id:        u.id || u.username,
          name:      (u.firstName + ' ' + u.lastName).trim() || u.username,
          phone:     u.phone || '',
          shift:     'صباحي',
          type:      'transfers',
          status:    u.isActive !== false ? 'active' : 'inactive',
          username:  u.username,
          createdAt: u.dateJoined || new Date().toISOString(),
        })));
      }
    }

    // ── الخزينة المركزية ──
    if (mainBoxResp.success && mainBoxResp.mainBox) {
      const bal = mainBoxResp.mainBox.balances || mainBoxResp.mainBox.total || {};
      state.mainBox.balances.USD = bal.USD || 0;
      state.mainBox.balances.ILS = bal.ILS || 0;
      state.mainBox.balances.JOD = bal.JOD || 0;
    }

    // ── تحديث أرقام الشجرة ──
    if (statsResp.success) {
      const el = id => document.getElementById(id);
      if (el('trBranches'))     el('trBranches').textContent     = statsResp.branches   || state.branches.length;
      if (el('trTotalSups'))    el('trTotalSups').textContent    = statsResp.supervisors || 0;
      if (el('trTotalTellers')) el('trTotalTellers').textContent = statsResp.tellerBoxes || 0;
      if (el('trActivePages'))  el('trActivePages').textContent  = statsResp.activePages || 3;
    }

    // ── العمليات الموحدة ──
    if (txResp && txResp.success && Array.isArray(txResp.items)) {
      state.transactions = txResp.items.map(t => ({
        id:       t.id,
        source:   t.source   || 'teller',
        type:     t.type     || '—',
        from:     t.from     || '—',
        to:       t.to       || '—',
        amount:   t.amount   || 0,
        currency: t.currency || 'USD',
        date:     t.createdAt ? t.createdAt.replace('T', ' ').slice(0, 16) : '—',
        status:   t.status   || 'completed',
        note:     t.note     || t.notes || '',
      }));
    }

    // ── التقارير ──
    if (reportsResp && reportsResp.success && Array.isArray(reportsResp.reports)) {
      state.reports = reportsResp.reports.map(r => ({
        id:       r.id,
        source:   r.page        || '',
        title:    r.title       || '',
        fileName: r.title + '.txt',
        fileType: 'text',
        fileSize: '—',
        branch:   r.branch      || '',
        branchId: 0,
        sender:   r.submittedBy || '—',
        date:     r.createdAt   ? r.createdAt.replace('T', ' ').slice(0, 16) : '—',
        isRead:   r.isRead      || false,
      }));
    }

    if (typeof renderAll === 'function') renderAll();

  } catch (e) {
    console.warn('[initDashboard] fallback to static data:', e.message);
    if (typeof renderAll === 'function') renderAll();
  }
}

// ── إضافة فرع عبر API ────────────────────────────────────────────────────────
async function apiBranchCreate(name, location, currency, balance) {
  const payload = { name, location, currency };
  if (currency === 'USD') payload.balanceUsd = balance;
  else if (currency === 'ILS') payload.balanceIls = balance;
  else if (currency === 'JOD') payload.balanceJod = balance;
  const resp = await apiPost('/api/branches', payload);
  if (resp.success) await initDashboard();
  return resp;
}

// ── تحويل للفرع عبر API ──────────────────────────────────────────────────────
async function apiBranchTransfer(toBranchId, amount, currency, notes = '') {
  const resp = await apiPost('/api/branches/transfer', {
    fromBranchId: 0,   // الصندوق الرئيسي
    toBranchId, amount, currency, notes,
  });
  if (resp.success) await initDashboard();
  return resp;
}

// ── إضافة رصيد للخزينة المركزية ──────────────────────────────────────────────
async function apiMainBoxDeposit(amount, currency, notes = '') {
  const resp = await apiPost('/api/main-box/deposit', { amount, currency, notes });
  if (resp.success) await initDashboard();
  return resp;
}

// ── توزيع رصيد للتلرات ────────────────────────────────────────────────────────
async function apiDistributeToTellers(distributions) {
  // distributions = [{tellerId, amount, currency}, ...]
  const resp = await apiPost('/api/main-box/distribute', { distributions });
  if (resp.success) await initDashboard();
  return resp;
}

// ── إغلاق اليوم: إرجاع أرصدة التلرات للخزينة ────────────────────────────────
async function apiEndOfDay() {
  const resp = await apiPost('/api/main-box/end-of-day', {});
  if (resp.success) await initDashboard();
  return resp;
}

// ── حذف فرع عبر API ──────────────────────────────────────────────────────────
async function apiBranchDelete(id) {
  const resp = await apiDelete(`/api/branches/${id}`);
  if (resp.success) {
    state.branches = state.branches.filter(b => b.id !== id);
    if (typeof renderAll === 'function') renderAll();
  }
  return resp;
}

// ── إضافة مستخدم (مشرف) عبر API ─────────────────────────────────────────────
async function apiUserCreate(data) {
  const resp = await apiPost('/api/users', data);
  if (resp.success) await initDashboard();
  return resp;
}

// ════════════════════════════════════════════════════════════════════════════════
// ACCOUNTS (T02) — /api/bk/*
// ════════════════════════════════════════════════════════════════════════════════
async function initAccounts() {
  try {
    const [statsResp, transfersResp] = await Promise.all([
      apiGet('/api/bk/stats'),
      apiGet('/api/bk/transfers', { pageSize: 100 }),
    ]);

    if (transfersResp.success && Array.isArray(transfersResp.items)) {
      const pending   = transfersResp.items.filter(t => t.status === 'pending' && !['buy','sell'].includes(t.type));
      const completed = transfersResp.items.filter(t => t.status === 'completed' && !['buy','sell'].includes(t.type));
      const buySell   = transfersResp.items.filter(t => ['buy','sell'].includes(t.type));

      state.queue     = pending.map(_mapBkTransfer);
      state.completed = completed.map(_mapBkTransfer);
      state.buySell   = buySell.map(_mapBkBuySell);
    }

    // تحديث عدادات الإحصائيات
    if (statsResp.success) {
      const el = id => document.getElementById(id);
      if (el('stat-pending'))   el('stat-pending').textContent   = statsResp.today?.pending   || 0;
      if (el('stat-completed')) el('stat-completed').textContent = statsResp.today?.completed || 0;
      if (el('stat-total'))     el('stat-total').textContent     = statsResp.today?.total     || 0;
    }

    if (typeof renderAll === 'function') renderAll();

  } catch (e) {
    console.warn('[initAccounts] fallback:', e.message);
    if (typeof renderAll === 'function') renderAll();
  }
}

function _mapBkTransfer(t) {
  return {
    id:       t.id,
    ref:      t.refNumber,
    type:     t.type,
    sender:   t.senderName   || '',
    receiver: t.receiverName || '',
    account:  t.iban || t.accountNumber || '',
    bank:     t.bankName     || '',
    amount:   t.amount,
    currency: t.currency,
    status:   t.status,
    notes:    t.notes        || '',
    date:     t.createdAt    ? t.createdAt.replace('T',' ').slice(0,16) : '',
    bankRef:  t.completedBy  || '',
    priority: 'normal',
  };
}

function _mapBkBuySell(t) {
  return {
    id:       t.id,
    type:     t.type,
    currency: t.currency,
    amount:   t.amount,
    rate:     t.exchangeRate || 1,
    party:    t.senderName || t.receiverName || '',
    ref:      t.refNumber,
    notes:    t.notes || '',
    date:     t.createdAt ? t.createdAt.replace('T',' ').slice(0,16) : '',
    status:   t.status,
  };
}

async function apiBkTransferCreate(data) {
  const resp = await apiPost('/api/bk/transfers', data);
  if (resp.success) await initAccounts();
  return resp;
}

async function apiBkTransferComplete(id, bankRef = '') {
  const resp = await apiPost(`/api/bk/transfers/${id}/complete`, { bankRef });
  if (resp.success) await initAccounts();
  return resp;
}

async function apiBkTransferReject(id, reason = '') {
  const resp = await apiPost(`/api/bk/transfers/${id}/reject`, { reason });
  if (resp.success) await initAccounts();
  return resp;
}

// ════════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS SUPERVISOR (M03) — /api/ts/*
// ════════════════════════════════════════════════════════════════════════════════
async function initTransactionsSupervisor() {
  try {
    const [transfersResp, employeesResp, agentsResp, statsResp] = await Promise.all([
      apiGet('/api/ts/transfers', { pageSize: 100 }),
      apiGet('/api/ts/employees'),
      apiGet('/api/ts/agents'),
      apiGet('/api/ts/stats'),
    ]);

    if (transfersResp.success && Array.isArray(transfersResp.items)) {
      if (typeof svTransfers !== 'undefined') {
        svTransfers.length = 0;
        transfersResp.items.forEach(t => svTransfers.push(_mapHawala(t)));
      }
    }

    if (employeesResp.success && Array.isArray(employeesResp.users)) {
      window._intlCache.employees = employeesResp.users.map(u => ({
        name:           (u.firstName + ' ' + u.lastName).trim() || u.username,
        username:       u.username,
        status:         u.isActive ? 'online' : 'offline',
        transfersToday: 0,
        lastSeen:       '—',
      }));
    }

    if (agentsResp.success && Array.isArray(agentsResp.agents)) {
      window._svAgents = agentsResp.agents;
    }

    if (typeof svRenderTransfers === 'function') svRenderTransfers();
    if (typeof svRenderTellers   === 'function') svRenderTellers();
    if (typeof svRenderStats     === 'function' && statsResp.success) svRenderStats(statsResp);

  } catch (e) {
    console.warn('[initTransactionsSupervisor] fallback:', e.message);
    if (typeof svRenderTransfers === 'function') svRenderTransfers();
  }
}

function _mapHawala(t) {
  return {
    id:          t.refNumber || String(t.id),
    _dbId:       t.id,
    sender:      t.senderName   || '',
    receiver:    t.receiverName || '',
    amount:      t.amount,
    currency:    t.currency,
    status:      t.status === 'completed' ? 'done' : (t.status === 'in_progress' ? 'processing' : t.status),
    agent:       t.agent ? (t.agent.name || '—') : '—',
    agentId:     t.agentId || null,
    date:        t.createdAt ? t.createdAt.replace('T',' ').slice(0,16) : '',
    source:      t.clientGroup ? (t.clientGroup.name || '') : '',
    destination: t.destination || '',
    commission:  t.commission  || 0,
  };
}

async function apiTsTransferCreate(data) {
  return apiPost('/api/ts/transfers', data);
}

async function apiTsTransferUpdate(id, data) {
  return apiPatch(`/api/ts/transfers/${id}`, data);
}

async function apiTsTransferDelete(id) {
  return apiDelete(`/api/ts/transfers/${id}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS (T03) — /api/ts/my-transfers
// ════════════════════════════════════════════════════════════════════════════════
async function initTransactions() {
  try {
    const [myResp, agentsResp, groupsResp] = await Promise.all([
      apiGet('/api/ts/my-transfers', { pageSize: 100 }),
      apiGet('/api/ts/agents'),
      apiGet('/api/ts/client-groups'),
    ]);

    if (myResp.success && Array.isArray(myResp.items) && typeof transfers !== 'undefined') {
      transfers.length = 0;
      myResp.items.forEach(t => transfers.push({
        id:       t.id,
        _dbId:    t.id,
        group:    t.clientGroup ? (t.clientGroup.name || 'random') : 'random',
        name:     t.receiverName || '',
        amount:   t.amount,
        currency: t.currency,
        msg:      `${t.senderName} ← ${t.receiverName} ${t.amount} ${t.currency}`,
        time:     t.createdAt ? t.createdAt.slice(11,16) : '',
        status:   t.status === 'completed' ? 'done' : (t.status === 'in_progress' ? 'processing' : 'new'),
        phone:    t.receiverPhone || '',
      }));
    }

    if (agentsResp.success && Array.isArray(agentsResp.agents)) {
      window._agents = agentsResp.agents;
    }

    if (groupsResp.success && Array.isArray(groupsResp.groups)) {
      window._clientGroups = groupsResp.groups;
    }

    if (typeof renderAll          === 'function') renderAll();
    else if (typeof renderTransfers === 'function') renderTransfers();

  } catch (e) {
    console.warn('[initTransactions] fallback:', e.message);
    if (typeof renderTransfers === 'function') renderTransfers();
  }
}

async function apiMyTransferCreate(data) {
  const resp = await apiPost('/api/ts/my-transfers', data);
  if (resp.success) await initTransactions();
  return resp;
}

// ════════════════════════════════════════════════════════════════════════════════
// TELLER (T01) — /api/tl/*
// ════════════════════════════════════════════════════════════════════════════════

async function initTeller() {
  try {
    // جلب الرصيد + الصلاحيات + الأسعار
    const balResp = await apiGet('/api/tl/balance');
    if (balResp.success) {
      // ── تطبيق الأسعار ──
      if (balResp.rates && typeof _applyRatesData === 'function') {
        _applyRatesData(balResp.rates);
        window._intlCache.tl_rates = balResp.rates;
      }
      // ── تطبيق الصلاحيات ──
      if (balResp.permissions && typeof _applyPermsData === 'function') {
        _applyPermsData(balResp.permissions);
        const permsAll = window._intlCache.teller_perms || {};
        const key = balResp.teller || '';
        if (key) permsAll[key] = balResp.permissions;
        window._intlCache.teller_perms = permsAll;
      }
      // ── تطبيق الرصيد الافتتاحي ──
      if (balResp.balance && typeof tellerBalances !== 'undefined') {
        const b = balResp.balance;
        if (b.usd !== undefined) tellerBalances.USD = b.usd;
        if (b.ils !== undefined) tellerBalances.ILS = b.ils;
        if (b.jod !== undefined) tellerBalances.JOD = b.jod;
        if (typeof updateTellerBox     === 'function') updateTellerBox();
        if (typeof updateMainBalances  === 'function') updateMainBalances();
      }
    }

    // جلب عمليات اليوم
    const [exchResp, hawalaResp, cashResp] = await Promise.all([
      apiGet('/api/tl/exchange'),
      apiGet('/api/tl/hawala'),
      apiGet('/api/tl/cash'),
    ]);

    if (exchResp.success  && Array.isArray(exchResp.operations)  && typeof exLogs  !== 'undefined') {
      exLogs.length = 0;
      exchResp.operations.forEach(op => exLogs.push({
        id:       'EX-' + op.id,
        client:   op.client || '—',
        mode:     op.method === 'sell' ? 'sell' : 'buy',
        from:     op.fromCurrency,
        to:       op.toCurrency,
        fromAmt:  op.amount,
        toAmt:    op.result,
        rate:     String(op.rate),
        time:     op.createdAt ? op.createdAt.slice(11, 16) : '',
      }));
    }

    if (hawalaResp.success && Array.isArray(hawalaResp.operations) && typeof itLogs !== 'undefined') {
      itLogs.length = 0;
      hawalaResp.operations.forEach(op => itLogs.push({
        id:        'IT-' + op.id,
        sender:    op.senderName    || '—',
        recipient: op.receiverName  || '—',
        country:   op.country       || op.destination || '—',
        amount:    op.amount,
        currency:  op.currency,
        fee:       op.fee           || 0,
        status:    op.status        || 'completed',
        direction: op.direction     || 'out',
        time:      op.createdAt ? op.createdAt.slice(11, 16) : '',
      }));
    }

    if (cashResp.success && Array.isArray(cashResp.transactions)) {
      if (typeof cdLogs !== 'undefined') cdLogs.length = 0;
      if (typeof elLogs !== 'undefined') elLogs.length = 0;
      cashResp.transactions.forEach(op => {
        if (op.type === 'electronic') {
          if (typeof elLogs !== 'undefined') {
            elLogs.push({
              id:       'EL-' + op.id,
              client:   op.client    || '—',
              platform: op.platform  || '—',
              amount:   op.amount,
              currency: op.currency,
              fee:      op.fee       || 0,
              status:   'completed',
              time:     op.createdAt ? op.createdAt.slice(11, 16) : '',
            });
          }
        } else {
          if (typeof cdLogs !== 'undefined') {
            const prefix = op.type === 'deposit' ? 'DEP' : 'WDR';
            cdLogs.push({
              id:       prefix + '-' + op.id,
              mode:     op.type,
              payType:  op.payType  || 'cash',
              client:   op.client   || '—',
              amount:   op.amount,
              currency: op.currency,
              rate:     op.rate     || 0,
              ref:      op.ref      || '',
              time:     op.createdAt ? op.createdAt.slice(11, 16) : '',
            });
          }
        }
      });
    }

    if (typeof renderExLogs      === 'function') renderExLogs();
    if (typeof renderItLogs      === 'function') renderItLogs();
    if (typeof renderCdLogs      === 'function') renderCdLogs();
    if (typeof renderElLogs      === 'function') renderElLogs();
    if (typeof renderMainRecent  === 'function') renderMainRecent();
    if (typeof updateCounts      === 'function') updateCounts();

  } catch(e) {
    console.warn('[initTeller] fallback:', e.message);
  }
}

// ── Mutation helpers ──────────────────────────────────────────────────────────

async function apiTlExchangeCreate(data) {
  return apiPost('/api/tl/exchange', data).catch(() => ({ success: false }));
}

async function apiTlHawalaCreate(data) {
  return apiPost('/api/tl/hawala', data).catch(() => ({ success: false }));
}

async function apiTlCashCreate(data) {
  return apiPost('/api/tl/cash', data).catch(() => ({ success: false }));
}

async function apiTlRequestCreate(data) {
  return apiPost('/api/tl/requests', data).catch(() => ({ success: false }));
}

// ════════════════════════════════════════════════════════════════════════════════
// مشترك: تقارير
// ════════════════════════════════════════════════════════════════════════════════
async function apiSubmitReport(page, title, body, branch = '') {
  const url = page === 'bankTransfer' ? '/api/bk/reports'
            : page === 'tellerMgr'   ? '/api/sv2/reports'
            : '/api/reports';
  return apiPost(url, { title, body, branch });
}

// ════════════════════════════════════════════════════════════════════════════════
// SUPERVISOR (M02) — مشرف التلر
// ════════════════════════════════════════════════════════════════════════════════
async function initSupervisor() {
  try {
    const [ratesResp, balsResp, opsResp] = await Promise.all([
      apiGet('/api/sv2/rates'),
      apiGet('/api/sv2/balances'),
      apiGet('/api/sv2/operations'),
    ]);

    // ── الأسعار ──────────────────────────────────────────────────────────────
    if (ratesResp.success && ratesResp.rates) {
      const r = ratesResp.rates;
      const sv = id => document.getElementById(id);
      if (r.ILS      !== undefined && sv('svMainILS'))  sv('svMainILS').value  = r.ILS;
      if (r.JOD      !== undefined && sv('svMainJOD'))  sv('svMainJOD').value  = r.JOD;
      if (r.EUR      !== undefined && sv('svMainEUR'))  sv('svMainEUR').value  = r.EUR;
      if (r.GBP      !== undefined && sv('svMainGBP'))  sv('svMainGBP').value  = r.GBP;
      if (r.cashRate !== undefined && sv('svDdCash'))   sv('svDdCash').value   = r.cashRate;
      if (r.bankRate !== undefined && sv('svDdBank'))   sv('svDdBank').value   = r.bankRate;
      if (r.bankPrices && typeof bankPrices !== 'undefined') Object.assign(bankPrices, r.bankPrices);
      if (r.cashPrices && typeof cashPrices !== 'undefined') Object.assign(cashPrices, r.cashPrices);
      if (typeof renderPricing === 'function') renderPricing();
      window._intlCache.sv_rates = r;
    }

    // ── سجل الأرصدة ──────────────────────────────────────────────────────────
    if (balsResp.success && Array.isArray(balsResp.balances) && typeof balanceLogs !== 'undefined') {
      balanceLogs.length = 0;
      balsResp.balances.forEach(b => balanceLogs.push({
        teller:   b.teller || b.username || '—',
        amtUSD:   b.USD || 0,
        amtILS:   b.ILS || 0,
        amtJOD:   b.JOD || 0,
        currency: 'multi',
        action:   b.action || 'set',
        date:     b.assignedAt || b.createdAt || '—',
        status:   'session_opened',
      }));
      window._intlCache.sv_balances = balsResp.balances;
      if (typeof renderBalanceLog === 'function') renderBalanceLog();
    }

    // ── سجل العمليات ─────────────────────────────────────────────────────────
    if (opsResp.success && Array.isArray(opsResp.operations) && typeof operations !== 'undefined') {
      opsResp.operations.forEach(op => {
        if (!operations.find(x => String(x.id) === String(op.id))) {
          operations.push({
            id:       op.id,
            teller:   op.operator || op.teller || '—',
            type:     op.opType || op.type || 'convert',
            desc:     op.description || op.desc || op.notes || '—',
            amount:   parseFloat(op.amount) || 0,
            currency: op.currency || 'USD',
            status:   op.status || 'completed',
            time:     op.createdAt
              ? new Date(op.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
              : '—',
          });
        }
      });
      operations.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
      if (typeof renderOps === 'function') renderOps();
    }
  } catch(e) {
    console.warn('[initSupervisor] fallback:', e.message);
  }
}

// ── Supervisor mutation helpers ───────────────────────────────────────────────
async function apiSv2TellerCreate(data)             { return apiPost('/api/sv2/tellers', data).catch(() => ({ success: false })); }
async function apiSv2TellerPatch(username, data)    { return apiPatch(`/api/sv2/tellers/${encodeURIComponent(username)}`, data).catch(() => ({ success: false })); }
async function apiSv2TellerDelete(username)         { return apiDelete(`/api/sv2/tellers/${encodeURIComponent(username)}`).catch(() => ({ success: false })); }
async function apiSv2TellerPassword(username, pwd)  { return apiPost(`/api/sv2/tellers/${encodeURIComponent(username)}/password`, { password: pwd }).catch(() => ({ success: false })); }
async function apiSv2PermissionsGet(username)       { return apiGet(`/api/sv2/permissions/${encodeURIComponent(username)}`).catch(() => ({ success: false })); }
async function apiSv2PermissionsGetAll()            { return apiGet('/api/sv2/permissions').catch(() => ({ success: false })); }
async function apiSv2PermissionsPatch(username, p)  { return apiPatch(`/api/sv2/permissions/${encodeURIComponent(username)}`, p).catch(() => ({ success: false })); }
async function apiSv2BalancesSet(data)              { return apiPost('/api/sv2/balances', data).catch(() => ({ success: false })); }
async function apiSv2RatesSave(data)                { return apiPost('/api/sv2/rates', data).catch(() => ({ success: false })); }
async function apiSv2RequestPatch(id, data)         { return apiPatch(`/api/sv2/requests/${id}`, data).catch(() => ({ success: false })); }
async function apiSv2InstructionsGet()              { return apiGet('/api/sv2/instructions').catch(() => ({ success: false })); }
async function apiSv2InstructionRead(id)            { return apiPatch(`/api/sv2/instructions/${id}/read`, {}).catch(() => ({ success: false })); }

// ════════════════════════════════════════════════════════════════════════════════
// تهيئة تلقائية حسب الصفحة الحالية
// ════════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if      (path.includes('dashboard'))               initDashboard();
  else if (path.includes('accounts'))                initAccounts();
  else if (path.includes('transactions-supervisor')) initTransactionsSupervisor();
  else if (path.includes('transactions'))            initTransactions();
  else if (path.includes('teller-departments'))      initTeller();
  else if (path.includes('supervisor/teller'))       initSupervisor();
});
