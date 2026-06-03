/* ══════════════════════════════════════════════
   accounts_manage.js  —  إدارة الحسابات
   ══════════════════════════════════════════════ */

// ══ أداة التبديل المركزية ══
const _amPanes = {
  'entry':      'pane-entry',
  'adv-entry':  'pane-adv-entry',
  'unreceived': 'pane-transfers',
  'received':   'pane-transfers',
  'all':        'pane-transfers',
  'statement':  'pane-statement',
  'new-move':   'pane-new-move',
  'exchange':   'pane-exchange',
  'cut':        'pane-cut',
  'receipt':    'pane-wip',
  'settle':     'pane-settle',
};
let _amCurrent = null;

function amSwitch(key) {
  document.querySelectorAll('.am-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#am-content-area > div').forEach(p => p.style.display = 'none');

  if (!key) {
    document.getElementById('pane-none').style.display = '';
    _amCurrent = null;
    return;
  }

  const btn = document.getElementById('btn-' + key);
  if (btn) btn.classList.add('active');

  const paneId = _amPanes[key] || 'pane-none';
  document.getElementById(paneId).style.display = '';

  if (key === 'unreceived' || key === 'received' || key === 'all') {
    _trType = key;
    document.getElementById('tr-status-filter').style.display = key === 'all' ? 'block' : 'none';
    trFetch();
  }
  if (key === 'entry')    entr_renderTemplates();
  if (key === 'adv-entry') adv_calc();
  if (key === 'new-move') nm_calc();
  if (key === 'exchange') ex_calc();
  if (key === 'cut')      cut_calc();
  if (key === 'settle')   stl_calc();

  _amCurrent = key;
  if (btn) btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}

// ══ قيد جديد ══
const _entr_tpl = [
  { name:'حوالة خارجية', from_cur:'USD', to_cur:'JOD', dir:'mul', rate:'0.71' },
  { name:'حوالة داخلية', from_cur:'JOD', to_cur:'ILS', dir:'mul', rate:'5.1'  },
  { name:'تبديل عملة',   from_cur:'USD', to_cur:'TRY', dir:'mul', rate:'32.5' },
  { name:'قص وكيل',      from_cur:'USD', to_cur:'USD', dir:'mul', rate:'1'    },
  { name:'تحويل بنكي',   from_cur:'USD', to_cur:'USD', dir:'mul', rate:'1'    },
];

function entr_renderTemplates() {
  const custom = JSON.parse(localStorage.getItem('entr_custom_tpl') || '[]');
  const all = [..._entr_tpl, ...custom];
  document.getElementById('entr-templates').innerHTML = all.map((t, i) =>
    `<button class="am-tpl-btn" onclick="entr_applyTpl(${i})">${t.name}</button>`
  ).join('');
}

function entr_applyTpl(i) {
  const custom = JSON.parse(localStorage.getItem('entr_custom_tpl') || '[]');
  const t = [..._entr_tpl, ...custom][i];
  if (!t) return;
  if (t.from_cur) document.getElementById('entr-from-cur').value = t.from_cur;
  if (t.to_cur)   document.getElementById('entr-to-cur').value   = t.to_cur;
  if (t.rate)     document.getElementById('entr-cut-rate').value  = t.rate;
  if (t.dir)      document.getElementById('entr-cut-dir').value   = t.dir;
  entr_calc();
}

function entr_calc() {
  const from = parseFloat(document.getElementById('entr-from-amount').value) || 0;
  const rate  = parseFloat(document.getElementById('entr-cut-rate').value)   || 1;
  const dir   = document.getElementById('entr-cut-dir').value;
  const to    = dir === 'mul' ? from * rate : (rate > 0 ? from / rate : 0);
  document.getElementById('entr-to-amount').value = to > 0 ? to.toFixed(4) : '';
  document.getElementById('entr-profit-display').textContent = Math.abs(from - to).toFixed(2);
}

function entr_saveTemplate() {
  const name = prompt('اسم القالب الجديد:');
  if (!name) return;
  const custom = JSON.parse(localStorage.getItem('entr_custom_tpl') || '[]');
  custom.push({
    name,
    from_cur: document.getElementById('entr-from-cur').value,
    to_cur:   document.getElementById('entr-to-cur').value,
    rate:     document.getElementById('entr-cut-rate').value,
    dir:      document.getElementById('entr-cut-dir').value,
  });
  localStorage.setItem('entr_custom_tpl', JSON.stringify(custom));
  entr_renderTemplates();
  showNotification('تم حفظ القالب', 'success');
}

function entr_save() {
  const fromId  = document.getElementById('entr-from-account')?.value;
  const toId    = document.getElementById('entr-to-account')?.value;
  const amount  = parseFloat(document.getElementById('entr-from-amount')?.value) || 0;
  const fromCur = document.getElementById('entr-from-cur')?.value  || 'USD';
  const toCur   = document.getElementById('entr-to-cur')?.value    || 'USD';
  const cutRate = parseFloat(document.getElementById('entr-cut-rate')?.value) || 1;
  const cutDir  = document.getElementById('entr-cut-dir')?.value   || 'mul';
  const notes   = document.getElementById('entr-notes')?.value     || '';

  if (!fromId)     { showNotification('يرجى اختيار حساب المدين',  'error'); return; }
  if (!toId)       { showNotification('يرجى اختيار حساب الدائن',  'error'); return; }
  if (amount <= 0) { showNotification('يرجى إدخال المبلغ',        'error'); return; }

  fetch('/api/am/journal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _getCsrf() },
    body: JSON.stringify({ fromAccountId: fromId, toAccountId: toId,
      amount, fromCurrency: fromCur, toCurrency: toCur,
      cutRate, cutDir, notes }),
  })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        showNotification('تم تنفيذ القيد ' + d.record.refNumber, 'success');
        entr_reset();
      } else {
        showNotification(d.message || 'خطأ في الحفظ', 'error');
      }
    })
    .catch(() => showNotification('تعذّر الاتصال بالخادم', 'error'));
}

function entr_reset() {
  ['entr-from-account','entr-to-account','entr-from-amount','entr-cut-rate','entr-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  entr_calc();
}

// ══ قيد متقدم ══
function adv_calc() {
  const fromAmt = parseFloat(document.getElementById('adv-from-amount').value) || 0;
  const rate    = parseFloat(document.getElementById('adv-cut-rate').value)    || 1;
  const dir     = document.getElementById('adv-cut-dir').value;
  const fromFee = parseFloat(document.getElementById('adv-from-fee').value)    || 0;
  const toFee   = parseFloat(document.getElementById('adv-to-fee').value)      || 0;
  const fromCur = document.getElementById('adv-from-cur').value || 'USD';
  const toCur   = document.getElementById('adv-to-cur').value   || 'USD';

  const toAmt   = dir === 'mul' ? fromAmt * rate : (rate > 0 ? fromAmt / rate : 0);
  const cutDiff = fromAmt > 0 ? Math.abs(fromAmt - toAmt) : 0;
  const profit  = cutDiff + fromFee + toFee;
  const fmt     = (n, c) => n > 0 ? n.toLocaleString('ar', {maximumFractionDigits:2}) + ' ' + c : '—';

  document.getElementById('adv-to-amount').value            = toAmt > 0 ? toAmt.toFixed(4) : '';
  document.getElementById('adv-profit-bar').textContent     = fmt(profit, fromCur);
  document.getElementById('adv-from-display').textContent   = fmt(fromAmt, fromCur);
  document.getElementById('adv-to-display').textContent     = fmt(toAmt, toCur);
  document.getElementById('adv-cut-display').textContent    = rate > 0 ? rate.toFixed(4) : '—';
  document.getElementById('adv-cut-dir-display').textContent= dir === 'mul' ? '× ضرب' : '÷ قسمة';
  document.getElementById('adv-sum-from-fee').textContent   = fmt(fromFee, fromCur);
  document.getElementById('adv-sum-to-fee').textContent     = fmt(toFee, toCur);
  document.getElementById('adv-sum-cut-diff').textContent   = fmt(cutDiff, fromCur);
}

function adv_reset() {
  ['adv-from-center','adv-from-name','adv-cut-rate','adv-from-amount','adv-from-fee','adv-from-notes',
   'adv-to-center','adv-to-beneficiary','adv-to-fee','adv-to-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  adv_calc();
}

function adv_save() {
  const fromCenter = (document.getElementById('adv-from-center')?.value || '').trim();
  const toCenter   = (document.getElementById('adv-to-center')?.value   || '').trim();
  const fromAmt    = parseFloat(document.getElementById('adv-from-amount')?.value) || 0;

  if (!fromCenter) { showNotification('يرجى اختيار المركز المُرسل',  'error'); return; }
  if (!toCenter)   { showNotification('يرجى اختيار المركز المستلم',  'error'); return; }
  if (fromAmt <= 0){ showNotification('يرجى إدخال المبلغ المُرسَل',  'error'); return; }

  const payload = {
    fromCenter,
    fromName:      document.getElementById('adv-from-name')?.value     || '',
    fromCurrency:  document.getElementById('adv-from-cur')?.value      || 'USD',
    fromAmount:    fromAmt,
    fromFee:       parseFloat(document.getElementById('adv-from-fee')?.value) || 0,
    fromFeeCur:    document.getElementById('adv-from-fee-cur')?.value  || 'USD',
    fromNotes:     document.getElementById('adv-from-notes')?.value    || '',
    cutRate:       parseFloat(document.getElementById('adv-cut-rate')?.value) || 1,
    cutDir:        document.getElementById('adv-cut-dir')?.value       || 'mul',
    toCenter,
    toBeneficiary: document.getElementById('adv-to-beneficiary')?.value|| '',
    toCurrency:    document.getElementById('adv-to-cur')?.value        || 'USD',
    toFee:         parseFloat(document.getElementById('adv-to-fee')?.value)   || 0,
    toFeeCur:      document.getElementById('adv-to-fee-cur')?.value    || 'USD',
    toNotes:       document.getElementById('adv-to-notes')?.value      || '',
  };

  fetch('/api/am/adv-entry/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _getCsrf() },
    body: JSON.stringify(payload),
  })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        showNotification('تم تنفيذ القيد ' + d.record.refNumber, 'success');
        adv_reset();
      } else {
        showNotification(d.message || 'خطأ في الحفظ', 'error');
      }
    })
    .catch(() => showNotification('تعذّر الاتصال بالخادم', 'error'));
}

// ══ الحوالات ══
let _trPage = 1, _trType = 'all', _trTotalPages = 1;

function trFilter() {
  _trPage = 1;
  trFetch();
}

function trFetch() {
  const q   = (document.getElementById('tr-search')?.value || '').trim();
  const df  = document.getElementById('tr-date-from')?.value || '';
  const dt  = document.getElementById('tr-date-to')?.value   || '';
  const cur = document.getElementById('tr-currency')?.value  || '';

  const statusMap = { unreceived: 'pending', received: 'completed', all: '' };
  const status = statusMap[_trType] || '';

  const params = new URLSearchParams({ page: _trPage, per_page: 20 });
  if (status) params.set('status', status);
  if (q)      params.set('q', q);
  if (df)     params.set('date_from', df);
  if (dt)     params.set('date_to', dt);
  if (cur)    params.set('currency', cur);

  const tbody = document.getElementById('tr-tbody');
  tbody.innerHTML = '<tr><td colspan="10" style="padding:40px;text-align:center;color:#4a6280;">جاري التحميل...</td></tr>';

  fetch('/api/am/transfers/?' + params)
    .then(r => r.json())
    .then(d => {
      if (!d.success) { showNotification(d.message || 'خطأ في التحميل', 'error'); return; }
      _trTotalPages = d.totalPages || 1;
      trRender(d);
    })
    .catch(() => {
      tbody.innerHTML = '<tr><td colspan="10" style="padding:40px;text-align:center;color:#f87171;">تعذّر الاتصال بالخادم</td></tr>';
    });
}

function trRender(d) {
  const s = d.summary || {};
  document.getElementById('tr-count').textContent  = s.total || 0;
  document.getElementById('tr-total').textContent  = (s.totalAmount || 0).toLocaleString('ar') + ' $';
  document.getElementById('tr-profit').textContent = (s.totalCommission || 0).toLocaleString('ar') + ' $';

  const tbody = document.getElementById('tr-tbody');
  const items = d.transfers || [];
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="padding:40px;text-align:center;color:#2d4060;">لا توجد حوالات</td></tr>';
  } else {
    tbody.innerHTML = items.map((r, i) => {
      const isCompleted = r.status === 'completed';
      return `<tr>
        <td>${(_trPage-1)*20 + i + 1}</td>
        <td style="font-size:11px;color:#4a6280;">${r.createdAt||'—'}</td>
        <td style="color:#e9edef;font-weight:600;">${r.senderName||'—'}</td>
        <td style="color:#e9edef;">${r.receiverName||'—'}</td>
        <td style="color:#8696a0;">${r.destination||'—'}</td>
        <td style="text-align:center;color:#60a5fa;font-weight:700;">${(r.amount||0).toLocaleString('ar')}</td>
        <td style="text-align:center;color:#4a6280;">${r.currency||'USD'}</td>
        <td style="text-align:center;color:#4ade80;font-weight:600;">${(r.commission||0).toLocaleString('ar')}</td>
        <td style="text-align:center;">
          <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;
            background:${isCompleted?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'};
            color:${isCompleted?'#4ade80':'#f87171'};">
            ${isCompleted?'مستلمة':'غير مستلمة'}
          </span>
        </td>
        <td style="text-align:center;">
          ${!isCompleted
            ? `<button onclick="trReceive(${r.id})"
                style="padding:4px 10px;border-radius:7px;background:rgba(34,197,94,0.1);
                border:1px solid rgba(34,197,94,0.3);color:#4ade80;font-size:11px;cursor:pointer;font-family:inherit;">
                ✓ استلام</button>`
            : `<span style="font-size:10px;color:#2d4060;">${r.completedAt||'—'}</span>`}
        </td>
      </tr>`;
    }).join('');
  }

  // ترقيم الصفحات
  document.getElementById('tr-pagination').innerHTML = _trTotalPages > 1
    ? Array.from({length: _trTotalPages}, (_, i) =>
        `<button onclick="_trPage=${i+1};trFetch()"
          style="padding:6px 12px;border-radius:8px;
          border:1px solid rgba(255,255,255,${i+1===_trPage?'0.2':'0.07'});
          background:rgba(255,255,255,${i+1===_trPage?'0.1':'0.03'});
          color:${i+1===_trPage?'#e9edef':'#4a6280'};cursor:pointer;font-size:12px;">${i+1}</button>`
      ).join('')
    : '';
}

function trReceive(id) {
  if (!confirm('تأكيد استلام الحوالة؟')) return;
  fetch(`/api/am/transfers/${id}/receive/`, {
    method: 'PATCH',
    headers: { 'X-CSRFToken': _getCsrf() },
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) { showNotification('✅ تم تأكيد الاستلام', 'success'); trFetch(); }
    else           { showNotification(d.message || 'خطأ', 'error'); }
  })
  .catch(() => showNotification('تعذّر الاتصال', 'error'));
}

// ══ كشف الحساب ══
let _stmCenter = null, _stmData = null;

function stmSearch(q) {
  const dd = document.getElementById('stm-dd');
  if (!q || q.length < 1) { dd.style.display = 'none'; return; }
  fetch('/api/am/statement/centers/?q=' + encodeURIComponent(q))
    .then(r => r.json())
    .then(d => {
      if (!d.success || !d.centers.length) { dd.style.display = 'none'; return; }
      dd.innerHTML = d.centers.map(name =>
        `<div onclick="stmSelect('${name.replace(/'/g, "\\'")}')"
          style="padding:9px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);
          font-size:12px;color:#e9edef;transition:background .15s;"
          onmouseover="this.style.background='rgba(255,255,255,0.06)'"
          onmouseout="this.style.background=''">${name}</div>`
      ).join('');
      dd.style.display = 'block';
    })
    .catch(() => { dd.style.display = 'none'; });
}

function stmSelect(name) {
  _stmCenter = name;
  document.getElementById('stm-search').value = name;
  document.getElementById('stm-dd').style.display = 'none';
  const sel = document.getElementById('stm-selected');
  sel.style.display = 'flex';
  document.getElementById('stm-sel-name').textContent = name;
}

function stmClear() {
  _stmCenter = null;
  _stmData   = null;
  document.getElementById('stm-search').value = '';
  document.getElementById('stm-selected').style.display = 'none';
  document.getElementById('stm-summary').style.display = 'none';
  document.getElementById('stm-tbody').innerHTML =
    '<tr><td colspan="11" style="padding:60px;text-align:center;color:#2d4060;">اختر مركزاً واضغط كشف حساب</td></tr>';
}

function stmSetPeriod(v) {
  const today = new Date(), fmt = d => d.toISOString().slice(0, 10);
  let from = new Date(today), to = new Date(today);
  if (v === 'week')    from = new Date(+today - 7*86400000);
  else if (v === 'month')   from = new Date(+today - 30*86400000);
  else if (v === '3months') from = new Date(+today - 90*86400000);
  else if (v === 'year')    from = new Date(today.getFullYear(), 0, 1);
  if (v) {
    document.getElementById('stm-date-from').value = fmt(from);
    document.getElementById('stm-date-to').value   = fmt(to);
  }
}

function stmGenerate() {
  if (!_stmCenter) { showNotification('يرجى اختيار مركز أولاً', 'error'); return; }

  const params = new URLSearchParams({
    center:             _stmCenter,
    period:             document.getElementById('stm-period')?.value          || '',
    date_from:          document.getElementById('stm-date-from')?.value       || '',
    date_to:            document.getElementById('stm-date-to')?.value         || '',
    currency:           document.getElementById('stm-currency')?.value        || '',
    include_unreceived: document.getElementById('stm-include-unreceived')?.checked ? '1' : '0',
  });

  const tbody = document.getElementById('stm-tbody');
  tbody.innerHTML = '<tr><td colspan="11" style="padding:40px;text-align:center;color:#4a6280;">جاري التحميل...</td></tr>';
  document.getElementById('stm-summary').style.display = 'none';

  fetch('/api/am/statement/?' + params)
    .then(r => r.json())
    .then(d => {
      if (!d.success) { showNotification(d.message || 'خطأ في التحميل', 'error'); return; }
      _stmData = d;
      stmRender(d);
    })
    .catch(() => {
      tbody.innerHTML = '<tr><td colspan="11" style="padding:40px;text-align:center;color:#f87171;">تعذّر الاتصال بالخادم</td></tr>';
    });
}

function stmRender(d) {
  const fmt  = n => n.toLocaleString('ar', {minimumFractionDigits:2, maximumFractionDigits:2});
  const summary = document.getElementById('stm-summary');
  summary.style.display = 'flex';
  document.getElementById('stm-total-in').textContent    = fmt(d.totalIn)    + ' ' + (d.currency !== 'الكل' ? d.currency : '');
  document.getElementById('stm-total-out').textContent   = fmt(d.totalOut)   + ' ' + (d.currency !== 'الكل' ? d.currency : '');
  document.getElementById('stm-total-fee').textContent   = fmt(d.totalFee);
  document.getElementById('stm-net-balance').textContent = fmt(d.netBalance) + ' ' + (d.currency !== 'الكل' ? d.currency : '');
  document.getElementById('stm-count').textContent       = d.count;

  const tbody = document.getElementById('stm-tbody');
  if (!d.movements.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="padding:40px;text-align:center;color:#2d4060;">لا توجد حركات في هذه الفترة</td></tr>';
    return;
  }

  const typeColors = {
    'حوالة':         '#60a5fa',
    'تبديل عملات':   '#a78bfa',
    'قص وإغلاق':     '#fbbf24',
    'قيد متقدم':     '#f472b6',
    'قيد تسوية':     '#34d399',
    'قيد جديد':      '#818cf8',
  };

  tbody.innerHTML = d.movements.map((m, i) => {
    const isIn = m.side === 'in';
    const tc   = typeColors[m.type] || '#8696a0';
    const statusColor = m.status === 'completed' ? '#4ade80' : '#f87171';
    const statusText  = m.status === 'completed' ? 'مكتملة' : 'معلقة';
    return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);transition:background .15s;"
              onmouseover="this.style.background='rgba(255,255,255,0.03)'"
              onmouseout="this.style.background=''">
      <td style="padding:9px 14px;color:#4a6280;">${i+1}</td>
      <td style="padding:9px 14px;color:#4a6280;font-size:11px;white-space:nowrap;">${m.date}</td>
      <td style="padding:9px 14px;">
        <span style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;
          background:${tc}22;color:${tc};">${m.type}</span>
      </td>
      <td style="padding:9px 14px;font-size:11px;color:#8696a0;font-family:monospace;">${m.ref}</td>
      <td style="padding:9px 14px;color:#e9edef;font-size:12px;">${m.counterpart || '—'}</td>
      <td style="padding:9px 14px;color:#5a7090;font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.notes || '—'}</td>
      <td style="padding:9px 14px;text-align:center;font-weight:700;color:#4ade80;">
        ${isIn ? fmt(m.amount) : '—'}
      </td>
      <td style="padding:9px 14px;text-align:center;font-weight:700;color:#f87171;">
        ${!isIn ? fmt(m.amount) : '—'}
      </td>
      <td style="padding:9px 14px;text-align:center;color:#fbbf24;">
        ${m.fee > 0 ? fmt(m.fee) : '—'}
      </td>
      <td style="padding:9px 14px;text-align:center;color:#8696a0;font-size:11px;">${m.currency}</td>
      <td style="padding:9px 14px;text-align:center;">
        <span style="padding:2px 8px;border-radius:20px;font-size:10px;
          background:${statusColor}22;color:${statusColor};">${statusText}</span>
      </td>
    </tr>`;
  }).join('');
}

function stmPrint() {
  if (!_stmData) { showNotification('يرجى توليد كشف الحساب أولاً', 'warning'); return; }
  window.print();
}

// ══ حوالة جديدة ══
function nm_calc() {
  const sendAmt = parseFloat(document.getElementById('nm-send-amt').value)    || 0;
  const rate    = parseFloat(document.getElementById('nm-rate').value)         || 1;
  const feeExp  = parseFloat(document.getElementById('nm-fee-export').value)   || 0;
  const feeDel  = parseFloat(document.getElementById('nm-fee-delivery').value) || 0;
  const recv    = document.getElementById('nm-recv-amt');
  const recvAmt = sendAmt * rate;
  if (recv && document.activeElement !== recv) recv.value = recvAmt ? recvAmt.toFixed(2) : '';
  const total = sendAmt + feeExp + feeDel;
  document.getElementById('nm-total').textContent = total ? total.toLocaleString('ar') : '0';
}

function nm_send() {
  const source   = document.getElementById('nm-source').value;
  const dest     = document.getElementById('nm-dest').value;
  const receiver = document.getElementById('nm-benef-name').value.trim();
  const phone    = document.getElementById('nm-benef-phone').value.trim();
  const address  = document.getElementById('nm-address').value.trim();
  const sendAmt  = parseFloat(document.getElementById('nm-send-amt').value) || 0;
  const recvAmt  = parseFloat(document.getElementById('nm-recv-amt').value) || 0;
  const sendCur  = document.getElementById('nm-send-cur').value;
  const recvCur  = document.getElementById('nm-recv-cur').value;
  const feeExp   = parseFloat(document.getElementById('nm-fee-export').value)   || 0;
  const feeDel   = parseFloat(document.getElementById('nm-fee-delivery').value) || 0;
  const rate     = parseFloat(document.getElementById('nm-rate').value) || 1;
  const notes    = document.getElementById('nm-notes').value.trim();

  if (!source)   { showNotification('يرجى اختيار المصدر', 'error'); return; }
  if (!dest)     { showNotification('يرجى اختيار الوجهة', 'error'); return; }
  if (!receiver) { showNotification('يرجى إدخال اسم المستفيد', 'error'); return; }
  if (!sendAmt)  { showNotification('يرجى إدخال مبلغ الإرسال', 'error'); return; }
  if (!sendCur)  { showNotification('يرجى اختيار عملة الإرسال', 'error'); return; }

  // تعطيل الزر أثناء الإرسال
  const btn = document.querySelector('#pane-new-move .am-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الإرسال...'; }

  fetch('/api/am/transfers/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _getCsrf() },
    body: JSON.stringify({
      senderName:    source,         // اسم المصدر كمرسِل
      receiverName:  receiver,
      receiverPhone: phone,
      destination:   dest,
      currencySend:  sendCur,
      currencyRecv:  recvCur,
      amountSend:    sendAmt,
      amountRecv:    recvAmt,
      feeExport:     feeExp,
      feeDelivery:   feeDel,
      rate:          rate,
      address:       address,
      notes:         notes,
      sourceBranch:  source,
      destBranch:    dest,
    }),
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showNotification(`✅ تم إنشاء الحوالة ${d.transfer.refNumber}`, 'success');
      nm_reset();
      amSwitch(null);
      // حدّث قائمة الحوالات إن كانت مفتوحة
      if (_amCurrent === 'unreceived' || _amCurrent === 'all') trFetch();
    } else {
      showNotification(d.message || 'حدث خطأ', 'error');
    }
  })
  .catch(() => showNotification('تعذّر الاتصال بالخادم', 'error'))
  .finally(() => {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-left:6px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> إرسال'; }
  });
}

function nm_reset() {
  ['nm-source','nm-dest','nm-benef-name','nm-benef-phone','nm-address',
   'nm-send-amt','nm-recv-amt','nm-fee-export','nm-fee-delivery','nm-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const rateEl = document.getElementById('nm-rate');
  if (rateEl) rateEl.value = '1';
  document.getElementById('nm-total').textContent = '0';
}

// ══ تبديل عملات ══
function ex_calc() {
  const amt1 = parseFloat(document.getElementById('ex-amt1').value) || 0;
  const rate  = parseFloat(document.getElementById('ex-rate').value)  || 1;
  const el = document.getElementById('ex-amt2');
  el.value = (amt1 * rate) ? (amt1 * rate).toFixed(2) : '';
}

function ex_submit() {
  const c1   = document.getElementById('ex-center1').value;
  const c2   = document.getElementById('ex-center2').value;
  const a1   = parseFloat(document.getElementById('ex-amt1').value) || 0;
  const cur1 = document.getElementById('ex-cur1').value;
  const cur2 = document.getElementById('ex-cur2').value;
  const rate = parseFloat(document.getElementById('ex-rate').value) || 1;
  const notes= document.getElementById('ex-notes')?.value?.trim() || '';

  if (!c1)           { showNotification('يرجى اختيار المركز الأول', 'error'); return; }
  if (!c2)           { showNotification('يرجى اختيار المركز الثاني', 'error'); return; }
  if (c1 === c2)     { showNotification('المركزان متطابقان', 'error'); return; }
  if (!a1)           { showNotification('يرجى إدخال المبلغ الأول', 'error'); return; }
  if (cur1 === cur2) { showNotification('العملتان متطابقتان', 'error'); return; }

  const btn = document.querySelector('#pane-exchange .am-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري التنفيذ...'; }

  fetch('/api/am/exchange/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _getCsrf() },
    body: JSON.stringify({
      center1: c1, center2: c2,
      currency1: cur1, currency2: cur2,
      amount1: a1, rate: rate, notes: notes,
    }),
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      showNotification(`✅ ${d.message}`, 'success');
      ex_reset();
      amSwitch(null);
    } else {
      showNotification(d.message || 'حدث خطأ', 'error');
    }
  })
  .catch(() => showNotification('تعذّر الاتصال بالخادم', 'error'))
  .finally(() => {
    if (btn) { btn.disabled = false; btn.textContent = 'موافق'; }
  });
}

function ex_reset() {
  ['ex-center1','ex-center2','ex-amt1','ex-amt2','ex-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const rateEl = document.getElementById('ex-rate');
  if (rateEl) rateEl.value = '1';
}

// ══ قص وإغلاق ══
function _cutToUSD(amt, rate, dir) {
  if (!amt || !rate) return null;
  return dir === 'div' ? amt / rate : amt * rate;
}

function cut_calc() {
  const buyAmt   = parseFloat(document.getElementById('cut-buy-amt').value)   || 0;
  const buyRate  = parseFloat(document.getElementById('cut-buy-rate').value)  || 0;
  const buyDir   = document.getElementById('cut-buy-dir').value;
  const sellAmt  = parseFloat(document.getElementById('cut-sell-amt').value)  || 0;
  const sellRate = parseFloat(document.getElementById('cut-sell-rate').value) || 0;
  const sellDir  = document.getElementById('cut-sell-dir').value;
  const buyUSD   = _cutToUSD(buyAmt,  buyRate,  buyDir);
  const sellUSD  = _cutToUSD(sellAmt, sellRate, sellDir);
  const fmt = v => v != null ? v.toLocaleString('ar', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
  document.getElementById('cut-buy-usd').textContent      = fmt(buyUSD);
  document.getElementById('cut-sell-usd').textContent     = fmt(sellUSD);
  document.getElementById('cut-buy-usd-bar').textContent  = fmt(buyUSD);
  document.getElementById('cut-sell-usd-bar').textContent = fmt(sellUSD);
  const profit = (buyUSD != null && sellUSD != null) ? buyUSD - sellUSD : null;
  const profEl = document.getElementById('cut-profit');
  profEl.textContent = fmt(profit);
  profEl.style.color = (profit != null && profit >= 0) ? '#4ade80' : '#f87171';
}

function cut_submit() {
  const bc  = document.getElementById('cut-buy-center').value;
  const sc  = document.getElementById('cut-sell-center').value;
  const ba  = parseFloat(document.getElementById('cut-buy-amt').value)   || 0;
  const br  = parseFloat(document.getElementById('cut-buy-rate').value)  || 0;
  const bd  = document.getElementById('cut-buy-dir').value;
  const bn  = document.getElementById('cut-buy-notes')?.value?.trim()   || '';
  const sa  = parseFloat(document.getElementById('cut-sell-amt').value)  || 0;
  const sr  = parseFloat(document.getElementById('cut-sell-rate').value) || 0;
  const sd  = document.getElementById('cut-sell-dir').value;
  const sn  = document.getElementById('cut-sell-notes')?.value?.trim()  || '';
  const bc_ = document.getElementById('cut-buy-cur').value;
  const sc_ = document.getElementById('cut-sell-cur').value;

  if (!bc) { showNotification('يرجى اختيار مركز الشراء', 'error'); return; }
  if (!sc) { showNotification('يرجى اختيار مركز البيع',  'error'); return; }
  if (!ba) { showNotification('يرجى إدخال مبلغ الشراء',  'error'); return; }
  if (!br) { showNotification('يرجى إدخال سعر قص الشراء','error'); return; }
  if (!sa) { showNotification('يرجى إدخال مبلغ البيع',   'error'); return; }
  if (!sr) { showNotification('يرجى إدخال سعر قص البيع', 'error'); return; }

  const btn = document.querySelector('#pane-cut .am-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري التنفيذ...'; }

  fetch('/api/am/cut/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _getCsrf() },
    body: JSON.stringify({
      buyCenter:    bc,  buyCurrency:  bc_, buyAmount:  ba, buyRate:  br, buyDir:  bd, buyNotes:  bn,
      sellCenter:   sc,  sellCurrency: sc_, sellAmount: sa, sellRate: sr, sellDir: sd, sellNotes: sn,
    }),
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      const profit = d.profitUsd >= 0
        ? `ربح: ${d.profitUsd.toLocaleString('ar')} $`
        : `خسارة: ${Math.abs(d.profitUsd).toLocaleString('ar')} $`;
      showNotification(`✅ ${d.message} — ${profit}`, 'success');
      cut_reset();
      amSwitch(null);
    } else {
      showNotification(d.message || 'حدث خطأ', 'error');
    }
  })
  .catch(() => showNotification('تعذّر الاتصال بالخادم', 'error'))
  .finally(() => {
    if (btn) { btn.disabled = false; btn.textContent = 'موافق وإغلاق'; }
  });
}

function cut_reset() {
  ['cut-buy-center','cut-buy-amt','cut-buy-rate','cut-buy-notes',
   'cut-sell-center','cut-sell-amt','cut-sell-rate','cut-sell-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['cut-buy-usd','cut-sell-usd','cut-buy-usd-bar','cut-sell-usd-bar'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '—';
  });
  const profEl = document.getElementById('cut-profit');
  if (profEl) { profEl.textContent = '—'; profEl.style.color = '#4ade80'; }
}

// ══ قيد تسوية ══
let _stlIdx = 1;

function stl_rowHTML(idx) {
  const opts = ['USD دولار','JOD دينار','ILS شيكل','EUR يورو','TRY ليرة','AED درهم','SYP سوري']
    .map(o => { const [v, l] = o.split(' '); return `<option value="${v}">${l}</option>`; }).join('');
  const destOpts = `<option value="">الوجهة</option><option value="main">الرئيسي</option><option value="branch1">فرع 1</option><option value="agent">وكيل</option>`;
  return `<tr class="stl-row" data-idx="${idx}">
    <td style="padding:6px 8px;"><select class="nm-input stl-cur" onchange="stl_calc()" style="min-width:90px;cursor:pointer;">${opts}</select></td>
    <td style="padding:6px 8px;"><input type="number" class="nm-input stl-amt" placeholder="0" oninput="stl_calc()" style="min-width:100px;color:#e9edef;font-weight:700;"></td>
    <td style="padding:6px 8px;"><input type="number" class="nm-input stl-fee" placeholder="0" oninput="stl_calc()" style="min-width:70px;color:#fbbf24;"></td>
    <td style="padding:6px 8px;"><input type="text"   class="nm-input stl-benef" placeholder="اسم المستفيد" style="min-width:130px;"></td>
    <td style="padding:6px 8px;"><input type="text"   class="nm-input stl-notes" placeholder="ملاحظات..." style="min-width:130px;"></td>
    <td style="padding:6px 8px;"><select class="nm-input stl-dest" style="min-width:110px;cursor:pointer;">${destOpts}</select></td>
    <td style="padding:6px 8px;"><input type="number" class="nm-input stl-del-fee" placeholder="0" oninput="stl_calc()" style="min-width:70px;color:#f87171;"></td>
    <td style="padding:6px 8px;text-align:center;">
      <button onclick="stl_removeRow(this)" title="حذف"
        style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#f87171;
        border-radius:7px;width:28px;height:28px;cursor:pointer;font-size:14px;line-height:1;">×</button>
    </td>
  </tr>`;
}

function stl_addRow() {
  const tbody = document.getElementById('stl-tbody');
  const tmp   = document.createElement('tbody');
  tmp.innerHTML = stl_rowHTML(_stlIdx++);
  tbody.appendChild(tmp.firstChild);
}

function stl_removeRow(btn) {
  const tbody = document.getElementById('stl-tbody');
  if (tbody.querySelectorAll('tr').length <= 1) {
    showNotification('يجب أن يبقى صف واحد على الأقل', 'warning'); return;
  }
  btn.closest('tr').remove();
  stl_calc();
}

function stl_calc() {
  let sumFee = 0, sumDelFee = 0;
  document.querySelectorAll('#stl-tbody .stl-row').forEach(row => {
    sumFee    += parseFloat(row.querySelector('.stl-fee')?.value)     || 0;
    sumDelFee += parseFloat(row.querySelector('.stl-del-fee')?.value) || 0;
  });
  const prof = sumFee - sumDelFee;
  const fmt  = v => v.toLocaleString('ar', {minimumFractionDigits:2, maximumFractionDigits:2});
  document.getElementById('stl-sum-us').textContent   = fmt(sumFee);
  document.getElementById('stl-sum-them').textContent = fmt(sumDelFee);
  const profEl = document.getElementById('stl-profit');
  profEl.textContent = fmt(prof);
  profEl.style.color = prof >= 0 ? '#4ade80' : '#f87171';
}

function stl_submit() {
  const center = (document.getElementById('stl-center')?.value || '').trim();
  if (!center) { showNotification('يرجى اختيار المركز', 'error'); return; }

  const rows = [];
  let valid = true;
  document.querySelectorAll('#stl-tbody .stl-row').forEach(row => {
    const currency    = row.querySelector('.stl-cur')?.value      || 'USD';
    const amount      = parseFloat(row.querySelector('.stl-amt')?.value)     || 0;
    const feeUs       = parseFloat(row.querySelector('.stl-fee')?.value)     || 0;
    const beneficiary = row.querySelector('.stl-benef')?.value    || '';
    const notes       = row.querySelector('.stl-notes')?.value    || '';
    const destination = row.querySelector('.stl-dest')?.value     || '';
    const feeThem     = parseFloat(row.querySelector('.stl-del-fee')?.value) || 0;
    if (amount <= 0) valid = false;
    rows.push({ currency, amount, feeUs, beneficiary, notes, destination, feeThem });
  });
  if (!valid) { showNotification('يرجى إدخال المبالغ في جميع الصفوف', 'error'); return; }

  showNotification('جاري حفظ قيد التسوية...', 'info');

  fetch('/api/am/settlement/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _getCsrf() },
    body: JSON.stringify({ centerName: center, rows }),
  })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        showNotification('تم حفظ ' + d.record.refNumber, 'success');
        // إعادة تعيين الجدول
        document.getElementById('stl-tbody').innerHTML = '';
        _stlIdx = 1;
        stl_addRow();
        stl_calc();
      } else {
        showNotification(d.message || 'خطأ في الحفظ', 'error');
      }
    })
    .catch(() => showNotification('تعذّر الاتصال بالخادم', 'error'));
}

// ══ إشعارات ══
function showNotification(msg, type = 'info') {
  const n = document.getElementById('notification');
  if (!n) return;
  const colors = { success:'#00c97a', error:'#ff4d6a', warning:'#f59e0b', info:'#3b82f6' };
  n.textContent = msg;
  n.style.cssText = `display:block;position:fixed;top:20px;left:50%;transform:translateX(-50%);
    background:${colors[type]||colors.info};color:#fff;padding:12px 24px;
    border-radius:10px;font-size:13px;font-weight:700;z-index:9999;
    box-shadow:0 6px 20px rgba(0,0,0,0.4);`;
  setTimeout(() => { n.style.display = 'none'; }, 3000);
}

// ══ CSRF Helper ══
function _getCsrf() {
  const m = document.cookie.match(/csrftoken=([^;]+)/);
  return m ? m[1] : '';
}

// ══ تهيئة ══
document.addEventListener('DOMContentLoaded', () => {
  // تحميل الفروع والوكلاء لتعبئة قوائم "حوالة جديدة"
  fetch('/api/am/init/')
    .then(r => r.ok ? r.json() : {})
    .then(d => {
      if (!d.success) return;
      const branchSelects = ['nm-source', 'nm-dest', 'ex-center1', 'ex-center2',
                             'cut-buy-center', 'cut-sell-center', 'stl-center',
                             'adv-from-center', 'adv-to-center'];
      branchSelects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        // احتفظ بالخيار الأول الفارغ ثم أضف الفروع
        while (sel.options.length > 1) sel.remove(1);
        (d.branches || []).forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.name;
          opt.textContent = b.name + (b.location ? ` — ${b.location}` : '');
          sel.appendChild(opt);
        });
      });
    })
    .catch(() => {});

  // تحميل دليل الحسابات لقيد جديد
  fetch('/api/am/accounts/?active=1&per_page=100')
    .then(r => r.ok ? r.json() : {})
    .then(d => {
      if (!d.success) return;
      const accSelects = ['entr-from-account', 'entr-to-account'];
      accSelects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        while (sel.options.length > 1) sel.remove(1);
        (d.records || []).forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = `${a.name} (${a.accountNo}) — ${a.currency}`;
          sel.appendChild(opt);
        });
      });
    })
    .catch(() => {});

});
