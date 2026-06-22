// ========== DATA ==========
const transfers = [];   // تُملأ من واتساب الحقيقي عبر wa-bridge.js

const executions = [];

// ========== STATE ==========
let smartMode        = false;   // manual is the default
let _botRunning      = false;   // true while smart-mode pipeline is active
let currentFilter    = 'all';
let _selectedId      = null;
let _searchQuery     = '';

let execTransfers      = [];
let currentExecFilter  = 'all';
let _execSearchQuery   = '';

let transferHistory    = [];   // completed transfers log
let _historySearch     = '';

const _agentColors = { barhoum: '#60a5fa', agent2: '#4ade80', agent3: '#fde047' };
const _agentIcons  = { barhoum: '🔵', agent2: '🟢', agent3: '🟡' };
const _agentNames  = { barhoum: 'برهوم تونس', agent2: 'وكيل 2', agent3: 'وكيل 3' };

const walletConfig = {
  instapay: { label: 'InstaPay',     icon: '💳', color: '#32b8c6' },
  vodafone: { label: 'Vodafone',     icon: '🔴', color: '#e53e3e' },
  etisalat: { label: 'Etisalat',    icon: '🟢', color: '#38a169' },
  orange:   { label: 'Orange',      icon: '🟠', color: '#ed8936' },
  bankak:   { label: 'Bankak',      icon: '🏦', color: '#667eea' },
  // Types from message parser
  phone:    { label: 'هاتف',        icon: '📱', color: '#25D366' },
  ewallet:  { label: 'محفظة',       icon: '💰', color: '#fbbf24' },
  iban:     { label: 'IBAN',        icon: '🏦', color: '#60a5fa' },
  bank:     { label: 'حساب بنكي',   icon: '🏦', color: '#a78bfa' },
};

// ========== HELPERS ==========
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getGroupLabel(g)  { return { aswar: 'الأساور', abuhashim: 'أبو هاشم', random: 'عشوائية' }[g] || g; }
function getGroupIcon(g)   { return { aswar: '🟣', abuhashim: '🔵', random: '🟡' }[g] || '⚪'; }
function getGroupColor(g)  { return { aswar: '#c084fc', abuhashim: '#60a5fa', random: '#fde047' }[g] || '#25D366'; }
function getStatusLabel(s) { return { waiting: 'بانتظار التنفيذ', executed: 'تم التنفيذ', 'sent-back': 'تم إرجاع الإشعار' }[s] || s; }
function generateCode()    { return `${Math.floor(100+Math.random()*900)}-${Math.floor(100+Math.random()*900)}`; }

// ========== FILL WALLET/PHONE FROM BUBBLE CLICK ==========
function fillWalletFromBubble(transferId, walletType, walletNumber) {
  // select the transfer first if not selected
  if (_selectedId !== transferId) {
    selectTransfer(transferId);
    // delay fill until selectTransfer's 300ms timeout finishes
    setTimeout(() => _doFillWallet(walletType, walletNumber), 450);
  } else {
    _doFillWallet(walletType, walletNumber);
  }
}

function _doFillWallet(walletType, walletNumber) {
  const wt = document.getElementById('walletType');
  const wn = document.getElementById('walletNumber');
  const wr = document.getElementById('walletRow');

  if (wt) { wt.value = walletType; wt.disabled = false; }
  if (wn) {
    wn.value = walletNumber;
    wn.disabled = false;
    wn.classList.add('auto-filled');
    // flash highlight
    wn.style.transition = 'box-shadow .25s';
    wn.style.boxShadow  = '0 0 0 3px rgba(37,211,102,0.45)';
    setTimeout(() => { wn.style.boxShadow = ''; wn.classList.remove('auto-filled'); }, 2200);
  }
  if (wr) {
    wr.style.transition = 'background .3s';
    wr.style.background = 'rgba(37,211,102,0.08)';
    setTimeout(() => { wr.style.background = ''; }, 1800);
  }

  const typeLabel = walletType === 'phone'
    ? 'رقم الجوال'
    : (walletConfig[walletType]?.label ? `${walletConfig[walletType].icon} ${walletConfig[walletType].label}` : 'رقم المحفظة');
  showToast(`${typeLabel} → تم التعبئة تلقائياً`, 'success');
}


// ========== RENDER THROTTLE ==========
// Prevents the list from rebuilding more than once every 5s — calm, no flicker
let _rtThrottleTimer = null;
let _rtLastRun = 0;
const _RT_INTERVAL = 5000; // ms between rebuilds

function renderTransfers(force) {
  if (force) {
    // Immediate rebuild (e.g. after delete)
    clearTimeout(_rtThrottleTimer);
    _rtLastRun = Date.now();
    _renderTransfersNow();
    return;
  }
  const now = Date.now();
  if (now - _rtLastRun >= _RT_INTERVAL) {
    // Enough time has passed — render now
    _rtLastRun = now;
    _renderTransfersNow();
  } else if (!_rtThrottleTimer) {
    // Schedule a deferred render at the next interval boundary
    const wait = _RT_INTERVAL - (now - _rtLastRun);
    _rtThrottleTimer = setTimeout(() => {
      _rtThrottleTimer = null;
      _rtLastRun = Date.now();
      _renderTransfersNow();
    }, wait);
  }
  // If a deferred render is already scheduled, just let it run — no extra work
}

// ========== RENDER SOURCE MESSAGES ==========
function _renderTransfersNow() {
  const list = document.getElementById('transfersList');
  if (!list) return;

  let filtered = currentFilter === 'all'
    ? transfers
    : transfers.filter(t => t.group === currentFilter);

  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.name.toLowerCase().includes(q) ||
      String(t.amount).includes(q) ||
      t.msg.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#4d6080;padding:30px;font-size:12px">لا توجد رسائل</div>';
    document.getElementById('incomingCount').textContent = '0';
    return;
  }

  // Capture which IDs are already in the DOM before rebuild
  const _existingIds = new Set(
    [...list.querySelectorAll('[id^="tItem-"]')].map(el => el.id)
  );

  list.innerHTML = filtered.map(t => {
    const isSelected  = t.id === _selectedId;
    const color       = getGroupColor(t.group);
    const icon        = getGroupIcon(t.group);
    const statusBadge =
      t.status === 'new'          ? `<span style="background:#25D366;color:#000;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700;margin-right:4px">جديدة</span>` :
      t.status === 'processing'   ? `<span style="background:#f59e0b;color:#000;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700;margin-right:4px">قيد التنفيذ</span>` :
      t.status === 'sent-to-exec' ? `<span style="background:rgba(37,99,235,0.7);color:#bfdbfe;border-radius:8px;padding:1px 8px;font-size:9px;font-weight:700;margin-right:4px;">أُرسلت للتنفيذ</span>` :
      t.status === 'done'         ? `<span style="background:#065f46;color:#34d399;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700;margin-right:4px">اكتملت</span>` :
                                    `<span style="color:#8696a0;font-size:9px;margin-right:4px">منجزة</span>`;
    const statusBadgeHtml = `<span data-status-badge>${statusBadge}</span>`;

    // ── Phone chip (clickable) ──
    const phoneChip = t.phone
      ? `<button
           onclick="event.stopPropagation(); fillWalletFromBubble(${t.id},'phone','${t.phone.replace(/\s/g,'')}')"
           title="اضغط لتعبئة رقم الجوال في النموذج"
           style="
             display:inline-flex;align-items:center;gap:5px;
             padding:4px 9px;border-radius:20px;border:1px solid rgba(37,211,102,0.4);
             background:rgba(37,211,102,0.09);color:#25D366;
             font-size:11px;font-weight:700;cursor:pointer;
             transition:all .2s;direction:ltr;font-family:monospace;
             margin-left:4px;
           "
           onmouseover="this.style.background='rgba(37,211,102,0.2)';this.style.transform='translateY(-1px)';this.style.boxShadow='0 3px 8px rgba(37,211,102,0.3)'"
           onmouseout="this.style.background='rgba(37,211,102,0.09)';this.style.transform='';this.style.boxShadow=''">
           ${escapeHtml(t.phone)}
         </button>` : '';

    // ── Wallet chip (clickable) ──
    const wCfg = t.wallet ? (walletConfig[t.wallet.type] || { icon:'💳', label:'رقم', color:'#32b8c6' }) : null;
    const walletChip = t.wallet
      ? `<button
           onclick="event.stopPropagation(); fillWalletFromBubble(${t.id},'${t.wallet.type}','${t.wallet.number}')"
           title="اضغط لتعبئة رقم المحفظة/الحساب في النموذج"
           style="
             display:inline-flex;align-items:center;gap:5px;
             padding:4px 9px;border-radius:20px;border:1px solid ${wCfg.color}55;
             background:${wCfg.color}18;color:${wCfg.color};
             font-size:11px;font-weight:700;cursor:pointer;
             transition:all .2s;direction:ltr;font-family:monospace;
             margin-left:4px;
           "
           onmouseover="this.style.background='${wCfg.color}30';this.style.transform='translateY(-1px)';this.style.boxShadow='0 3px 8px ${wCfg.color}44'"
           onmouseout="this.style.background='${wCfg.color}18';this.style.transform='';this.style.boxShadow=''">
           ${wCfg.icon} ${escapeHtml(t.wallet.number)}
         </button>` : '';

    // ── Chips row (only if at least one exists) ──
    const chipsRow = (phoneChip || walletChip)
      ? `<div style="margin-top:7px;display:flex;flex-wrap:wrap;gap:4px;padding-top:7px;border-top:1px solid rgba(255,255,255,0.06);">
           ${walletChip}${phoneChip}
           <span style="font-size:9px;color:#8696a0;align-self:center;margin-right:auto;">اضغط للتعبئة</span>
         </div>` : '';

    const isSentToExec = t.status === 'sent-to-exec';
    const isDone       = t.status === 'done';
    const bgCard =
      isSelected    ? '#0d2235' :
      isSentToExec  ? '#0a1a2e' : '#0f1923';
    const borderCard =
      isSelected    ? 'rgba(37,211,102,0.5)' :
      isSentToExec  ? 'rgba(96,165,250,0.45)' : 'rgba(50,184,198,0.12)';
    const execOverlay = isSentToExec
      ? `<div style="margin-top:7px;padding:5px 10px;background:rgba(37,99,235,0.12);border:1px solid rgba(96,165,250,0.25);border-radius:8px;font-size:10px;color:#93c5fd;display:flex;align-items:center;gap:6px;">
           <span style="display:inline-block;width:7px;height:7px;background:#3b82f6;border-radius:50%;opacity:0.7;"></span>
           جارٍ التنفيذ لدى المنفذ — في انتظار التأكيد
         </div>` : '';

    return `<div
      id="tItem-${t.id}"
      onclick="selectTransfer(${t.id})"
      class="msg-bubble-anim"
      style="margin-bottom:10px;cursor:pointer;opacity:${isDone ? 0.6 : 1};transition:opacity 0.4s,transform 0.15s,max-height 0.6s,margin 0.6s;${isSelected ? 'transform:scale(1.01)' : ''}"
    >
      <div style="font-size:10px;color:${color};margin-bottom:3px;font-weight:700;display:flex;align-items:center;gap:4px">
        ${icon} ${escapeHtml(t.groupName || getGroupLabel(t.group))} ${statusBadgeHtml}
      </div>
      <div style="background:${bgCard};border:1px solid ${borderCard};border-radius:0 12px 12px 12px;padding:10px 12px;word-break:break-word;transition:all 0.3s;${isSentToExec ? 'box-shadow:0 0 12px rgba(59,130,246,0.15)' : ''}">
        <div style="font-size:11px;color:#8696a0;margin-bottom:5px">${escapeHtml(t.sender || t.name)}</div>
        <div style="font-size:13px;color:${isSentToExec ? '#93c5fd' : '#e9edef'};direction:rtl;line-height:1.5;margin-bottom:6px">"${escapeHtml(t.msg)}"</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:900;color:#e8c04a;font-size:14px">${t.amount.toLocaleString()} <span style="font-size:11px;color:#32b8c6">${t.currency}</span></span>
          <span style="font-size:10px;color:#8696a0">${t.time}</span>
        </div>
        ${chipsRow}
        ${execOverlay}
        ${isSelected && !isSentToExec ? '<div style="margin-top:6px;font-size:10px;color:#25D366;font-weight:700">محددة • تحقق من البيانات في المنتصف</div>' : ''}
        <div style="margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.05)">
          <button
            onclick="event.stopPropagation(); _openTransferContext(${t.id})"
            style="background:rgba(99,102,241,.13);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);
                   border-radius:8px;padding:4px 12px;font-size:10px;font-weight:600;
                   cursor:pointer;width:100%;transition:background .2s;"
            onmouseover="this.style.background='rgba(99,102,241,.28)'"
            onmouseout="this.style.background='rgba(99,102,241,.13)'">
            عرض سياق المحادثة
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('incomingCount').textContent = filtered.length;

  // Mark only truly new items with gentle fade-in (no jump)
  list.querySelectorAll('[id^="tItem-"]').forEach(el => {
    if (!_existingIds.has(el.id)) {
      el.classList.add('fresh-in');
      el.addEventListener('animationend', () => el.classList.remove('fresh-in'), { once: true });
    }
  });
}

// ── لوحة السياق المضمّنة ───────────────────────────────────────────────────────
let _ctxPanelXfer = null;
let _ctxCache     = {};  // transferId → messages[]

function _openTransferContext(transferId) {
  const t = transfers.find(x => x.id === transferId);
  if (!t) return;
  _showCtxPanel(t);
}

function _showCtxPanel(t) {
  _ctxPanelXfer = t;
  const panel       = document.getElementById('ctxPanel');
  const placeholder = document.getElementById('ctxPlaceholder');
  const label       = document.getElementById('ctxGroupLabel');
  const body        = document.getElementById('ctxPanelBody');
  if (!panel || !body) return;

  const scrollY = window.scrollY;  // احفظ موضع الصفحة

  if (label) label.textContent = t.groupName || '—';
  panel.style.display = 'flex';
  if (placeholder) placeholder.style.display = 'none';

  window.scrollTo({ top: scrollY, behavior: 'instant' });  // أعد الموضع فوراً

  body.innerHTML = '<div style="color:#4d6080;font-size:11px;text-align:center;padding:30px 0;">جارٍ التحميل...</div>';

  if (_ctxCache[t.id]) {
    _renderCtxPanel(t, _ctxCache[t.id]);
  } else {
    _fetchCtxPanel(t);
  }
}

async function _fetchCtxPanel(t) {
  const body = document.getElementById('ctxPanelBody');
  try {
    let url = '';
    if (t.dbId) {
      url = `/api/wa/context/${t.dbId}/`;
    } else if (t.jid) {
      url = `/api/wa/feed/?jid=${encodeURIComponent(t.jid)}&hours=3`;
    } else {
      if (body) body.innerHTML = '<div style="color:#4d6080;font-size:11px;text-align:center;padding:20px 0;">لا يوجد سياق محفوظ — الرسائل تُحفظ منذ الآن</div>';
      return;
    }
    const r = await fetch(url);
    const d = await r.json();
    if (!d.ok) throw new Error('failed');
    _ctxCache[t.id] = d.messages || [];
    _renderCtxPanel(t, _ctxCache[t.id]);
  } catch(e) {
    if (body) body.innerHTML = '<div style="color:#f87171;font-size:11px;text-align:center;padding:20px 0;">تعذّر تحميل السياق</div>';
  }
}

function _renderCtxPanel(t, msgs) {
  const body = document.getElementById('ctxPanelBody');
  const label = document.getElementById('ctxGroupLabel');
  if (!body) return;

  if (label) label.textContent = `${t.groupName || ''} — ${msgs.length} رسالة`;

  if (!msgs.length) {
    body.innerHTML = '<div style="color:#4d6080;font-size:11px;text-align:center;padding:20px 0;">لا توجد رسائل محفوظة بعد</div>';
    return;
  }

  body.innerHTML = msgs.map(m => {
    const isCurrent = m.msgId === t.waId;
    const isHawala  = m.type === 'hawala' && !isCurrent;
    const timeStr   = m.timestamp
      ? new Date(m.timestamp * 1000).toLocaleTimeString('ar', { hour:'2-digit', minute:'2-digit' })
      : (m.receivedAt ? m.receivedAt.slice(11,16) : '');

    const bg     = isCurrent ? 'rgba(37,211,102,.12)'  : isHawala ? 'rgba(99,102,241,.08)'  : 'rgba(255,255,255,.02)';
    const border = isCurrent ? '1px solid rgba(37,211,102,.4)' : isHawala ? '1px solid rgba(99,102,241,.25)' : '1px solid rgba(255,255,255,.05)';

    const badge = isCurrent
      ? '<span style="background:#25D366;color:#000;font-size:8px;padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:700;">هذه</span>'
      : isHawala
        ? '<span style="background:#6366f1;color:#fff;font-size:8px;padding:1px 5px;border-radius:3px;margin-left:4px;">حوالة</span>'
        : '';

    const sender  = (m.senderName||'').replace(/</g,'&lt;');
    const msgText = (m.text||'').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');

    return `<div style="background:${bg};border:${border};border-radius:8px;padding:8px 10px;flex-shrink:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
        <span style="font-size:10px;font-weight:600;color:#7b8faa;">${badge}${sender}</span>
        <span style="font-size:9px;color:#3d4f5e;">${timeStr}</span>
      </div>
      <div style="font-size:11.5px;color:#b8c4d0;line-height:1.6;word-break:break-word;">${msgText}</div>
    </div>`;
  }).join('');

  // سكرول داخل اللوحة فقط — لا نحرك الصفحة
  requestAnimationFrame(() => {
    const cur = body.querySelector('[style*="rgba(37,211,102"]');
    if (cur) {
      const top = cur.offsetTop - body.offsetHeight / 2 + cur.offsetHeight / 2;
      body.scrollTop = Math.max(0, top);
    }
  });
}

function _closeCtxPanel() {
  const panel       = document.getElementById('ctxPanel');
  const placeholder = document.getElementById('ctxPlaceholder');
  if (panel)       panel.style.display       = 'none';
  if (placeholder) placeholder.style.display = 'flex';
  _ctxPanelXfer = null;
}

function _ctxPanelFill() {
  const t    = _ctxPanelXfer;
  const msgs = t ? _ctxCache[t.id] : null;
  if (!msgs || !msgs.length) return;

  const combined = msgs.map(m => m.text || '').join('\n');
  const parsed   = typeof window._waBridgeParseMsg === 'function'
    ? window._waBridgeParseMsg(combined) : null;
  if (!parsed) { showToast('تعذّر التحليل', 'warn'); return; }

  const set = (id, val) => {
    if (!val) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val;
    el.classList.add('auto-filled');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  set('mainAmount', parsed.amount   || t.amount   || '');
  set('clientName', parsed.name     || t.name     || '');
  set('currency',   parsed.currency || t.currency || 'USD');
  if (parsed.wallet) set('walletNumber', parsed.wallet.number);

  showToast('تم التعبئة من سياق المحادثة', 'success');
}

// ========== renderExecutions (legacy stub) ==========
function renderExecutions() {
  renderExecBubbles(); // execBubblesList is the real container
}

// ========== HISTORY (سجل الحوالات) ==========
function renderHistory() {
  const tbody  = document.getElementById('transferHistoryBody');
  const badge  = document.getElementById('historyCount');
  if (!tbody) return;

  const q = _historySearch.toLowerCase();
  const filtered = q
    ? transferHistory.filter(h =>
        (h.name      || '').toLowerCase().includes(q) ||
        (h.code      || '').toLowerCase().includes(q) ||
        (h.source    || '').toLowerCase().includes(q) ||
        (h.phone     || '').includes(q) ||
        (h.agent     || '').toLowerCase().includes(q) ||
        String(h.amount || '').includes(q)
      )
    : transferHistory;

  if (badge) badge.textContent = transferHistory.length;

  // stats strip
  const totalAmountEl   = document.getElementById('histStatTotal');
  const sumAmountEl     = document.getElementById('histStatAmount');
  const receiptsCountEl = document.getElementById('histStatReceipts');
  if (totalAmountEl)   totalAmountEl.textContent   = transferHistory.length;
  if (sumAmountEl)     sumAmountEl.textContent      = Number(transferHistory.reduce((s,h) => s + (Number(h.amount)||0), 0)).toLocaleString();
  if (receiptsCountEl) receiptsCountEl.textContent  = transferHistory.filter(h => h.receiptImageUrl || h.receipt).length;

  const info = document.getElementById('historySearchInfo');
  if (info) info.textContent = q ? `${filtered.length} نتيجة من ${transferHistory.length}` : '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="hist-empty">${q ? 'لا توجد نتائج للبحث' : 'لا توجد حوالات في السجل بعد'}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((h, i) => {
    const agentColor = _agentColors[h.agentId || h.agent] || '#32b8c6';
    const agentName  = h.agent || _agentNames[h.agentId] || '—';

    // receipt cell
    const hasReceipt  = h.receipt || h.receiptImageUrl;
    const hData = JSON.stringify(h).replace(/"/g,'&quot;');
    const receiptCell = hasReceipt
      ? `<div class="hrc-cell" onclick="_openReceiptViewer(${hData})" title="عرض الإيصال">
          ${h.receiptImageUrl
            ? `<img src="${h.receiptImageUrl}" class="hrc-thumb">`
            : `<span style="font-size:18px;flex-shrink:0;"></span>`
          }
          <div style="min-width:0;">
            <div class="hrc-label">${h.receiptImageUrl ? 'إيصال مرفق' : 'إيصال نصي'}</div>
            <div class="hrc-sub">${escapeHtml((h.receipt || '').substring(0,36) || 'اضغط للعرض')}</div>
          </div>
          ${h.receiptVerified === true  ? '<span class="hrc-verified">مطابق</span>'   : ''}
          ${h.receiptVerified === false ? '<span class="hrc-mismatch">غير مطابق</span>' : ''}
        </div>`
      : '<span style="color:#2d4060;font-size:12px;">—</span>';

    // phone number display
    const phone = h.phone ? `<span class="hc-phone">${escapeHtml(h.phone)}</span>` : '<span style="color:#2d4060;">—</span>';

    return `
    <tr>
      <td class="hc-num">${h.num || (filtered.length - i)}</td>
      <td class="hc-time">${escapeHtml(h.time || '--')}</td>
      <td class="hc-name">${escapeHtml(h.name || '--')}</td>
      <td>${phone}</td>
      <td class="hc-amount hc-center">${Number(h.amount||0).toLocaleString()}</td>
      <td class="hc-currency hc-center">${escapeHtml(h.currency || '--')}</td>
      <td class="hc-source">${escapeHtml(h.source || h.group || '—')}</td>
      <td class="hc-agent"><span style="color:${agentColor};">${escapeHtml(agentName)}</span></td>
      <td class="hc-center"><span class="hst-badge hst-done">مُنفَّذة</span></td>
      <td>${receiptCell}</td>
      <td class="hc-center">
        <button class="hist-print-btn" onclick="printHistoryRow('${escapeHtml(String(h.id || h.num || i))}')" title="طباعة">طباعة</button>
      </td>
    </tr>`;
  }).join('');
}

function searchHistory(q) {
  _historySearch = (q || '').trim();
  renderHistory();
}

function _addToHistory(execBubble) {
  const now = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', hour12: true });
  const receiptMsg = [
    'تم تنفيذ الحوالة',
    '━━━━━━━━━━━━━━━━━━',
    `الاسم   : ${execBubble.name || '--'}`,
    `المبلغ  : ${execBubble.amount} ${execBubble.currency}`,
    `الكود   : ${execBubble.code || '--'}`,
    `الوقت   : ${now}`,
    '━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  const entry = {
    id:          execBubble.id,
    num:         transferHistory.length + 1,
    code:        execBubble.code,
    name:        execBubble.name,
    phone:       execBubble.phone || execBubble.receiver_phone || '',
    amount:      execBubble.amount,
    currency:    execBubble.currency,
    agent:       _agentNames[execBubble.agent] || execBubble.agent,
    agentId:     execBubble.agent,
    source:      execBubble.source || '—',
    group:       execBubble.source || '—',
    status:      'تم التنفيذ',
    receipt:     receiptMsg,
    time:        now,
    completedAt: Date.now(),
  };
  transferHistory.unshift(entry);
  // Persist to localStorage (cache)
  try { localStorage.setItem('transferHistory', JSON.stringify(transferHistory)); } catch (_) {}

  // إرسال للخادم — تسجيل الحوالة المنفذة
  if (typeof apiMyTransferCreate === 'function') {
    apiMyTransferCreate({
      senderName:   execBubble.source || 'عميل',
      receiverName: execBubble.name   || '',
      amount:       execBubble.amount || 0,
      currency:     execBubble.currency || 'USD',
      destination:  execBubble.agent  || '',
      notes:        execBubble.code   || '',
    }).catch(() => {});
  }

  renderHistory();
  if (typeof renderHistoryStats === 'function') renderHistoryStats();
  computeStats();
}

function printHistoryRow(id) {
  const h = transferHistory.find(e => e.id === id);
  if (!h) return;
  const html = [
    '<html dir="rtl"><head><meta charset="utf-8"><title>إشعار حوالة</title></head>',
    '<body style="font-family:Arial;padding:20px;direction:rtl">',
    '<h3>إشعار حوالة</h3>',
    `<p><b>الاسم:</b> ${escapeHtml(h.name)}</p>`,
    `<p><b>المبلغ:</b> ${escapeHtml(String(h.amount))} ${escapeHtml(h.currency)}</p>`,
    `<p><b>الكود:</b> ${escapeHtml(h.code)}</p>`,
    `<p><b>الوقت:</b> ${escapeHtml(h.time)}</p>`,
    `<p><b>المُرسلة:</b> ${escapeHtml(h.source)}</p>`,
    `<p><b>المستقبلة:</b> ${escapeHtml(_agentNames[h.agent] || h.agent)}</p>`,
    '<p><b>الحالة:</b> مُنفَّذة</p>',
    '</body></html>',
  ].join('');
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const w    = window.open(url, '_blank', 'width=420,height=340');
  if (w) w.addEventListener('load', () => { w.print(); URL.revokeObjectURL(url); });
}

function clearHistory() {
  if (!confirm('مسح سجل الحوالات المنفذة؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
  transferHistory.length = 0;
  try { localStorage.removeItem('transferHistory'); } catch (_) {}
  renderHistory();
  if (typeof renderHistoryStats === 'function') renderHistoryStats();
  computeStats();
}

// ========== MIGRATION (ترحيل السجل) ==========
let _migFormat = 'json';

function openMigrationModal() {
  if (transferHistory.length === 0) {
    showToast('السجل فارغ — لا توجد حوالات للترحيل', 'warning');
    return;
  }

  _migFormat = 'json';
  _refreshMigFormatUI();

  // Summary cards
  const total   = transferHistory.length;
  const byAgent = {};
  const byCurr  = {};
  transferHistory.forEach(h => {
    byAgent[h.agent] = (byAgent[h.agent] || 0) + 1;
    if (!byCurr[h.currency]) byCurr[h.currency] = 0;
    byCurr[h.currency] += parseFloat(h.amount) || 0;
  });
  const topAgent = Object.entries(byAgent).sort((a,b) => b[1]-a[1])[0];
  const summaryEl = document.getElementById('migrationSummary');
  if (summaryEl) {
    const card = (icon, label, val, color) => `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(50,184,198,0.13);border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:20px;margin-bottom:4px;">${icon}</div>
        <div style="font-size:18px;font-weight:800;color:${color};">${val}</div>
        <div style="font-size:10px;color:#4d6080;margin-top:2px;">${label}</div>
      </div>`;
    const amtSummary = Object.entries(byCurr).map(([c,a]) => `${Math.round(a).toLocaleString()} ${c}`).join(' / ');
    summaryEl.innerHTML =
      card('', 'إجمالي الحوالات', total, '#e8c04a') +
      card('', 'المبالغ', amtSummary || '--', '#25D366') +
      card('', 'أكثر وكيل', topAgent ? (_agentNames[topAgent[0]] || topAgent[0]) : '--', '#60a5fa');
  }

  // Date range
  const dateRangeEl = document.getElementById('migrationDateRange');
  if (dateRangeEl) {
    const dates = transferHistory.map(h => h.completedAt).filter(Boolean).sort();
    const fmt = ts => ts ? new Date(ts).toLocaleString('ar-IQ') : '--';
    dateRangeEl.innerHTML = dates.length
      ? `<span style="color:#e9edef;font-weight:600;">نطاق الترحيل:</span> من ${fmt(dates[0])} &nbsp;→&nbsp; ${fmt(dates[dates.length-1])}`
      : 'لا تتوفر معلومات التاريخ';
  }

  // Reset toggle
  const cb = document.getElementById('migClearAfter');
  if (cb) {
    cb.checked = false;
    _syncMigToggle(false);
    cb.onchange = () => _syncMigToggle(cb.checked);
  }

  const ov = document.getElementById('migrationOverlay');
  if (ov) { ov.style.display = 'flex'; }
}

function closeMigrationModal() {
  const ov = document.getElementById('migrationOverlay');
  if (ov) ov.style.display = 'none';
}

function selectMigFormat(fmt) {
  _migFormat = fmt;
  _refreshMigFormatUI();
}

function _refreshMigFormatUI() {
  document.querySelectorAll('.mig-fmt-btn').forEach(btn => {
    const active = btn.dataset.val === _migFormat;
    btn.style.borderColor  = active ? 'rgba(232,192,74,0.5)' : 'rgba(255,255,255,0.08)';
    btn.style.background   = active ? 'rgba(232,192,74,0.1)' : 'rgba(255,255,255,0.03)';
    btn.querySelector('div:nth-child(2)').style.color = active ? '#e8c04a' : '#8696a0';
  });
}

function _syncMigToggle(on) {
  const track = document.getElementById('migToggleTrack');
  const thumb = document.getElementById('migToggleThumb');
  if (track) track.style.background = on ? 'rgba(232,192,74,0.35)' : 'rgba(255,255,255,0.08)';
  if (thumb) { thumb.style.background = on ? '#e8c04a' : '#4d6080'; thumb.style.right = on ? 'calc(100% - 19px)' : '3px'; }
}

function executeMigration() {
  if (transferHistory.length === 0) { closeMigrationModal(); return; }

  const now     = new Date();
  const stamp   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  const count   = transferHistory.length;

  // Build export payload with full metadata
  const payload = {
    exportedAt:   now.toISOString(),
    exportedBy:   'International Transfers System',
    totalRecords: count,
    records:      transferHistory.map(h => ({
      id:          h.id,
      code:        h.code,
      name:        h.name,
      amount:      h.amount,
      currency:    h.currency,
      source:      h.source,
      agent:       _agentNames[h.agent] || h.agent,
      agentId:     h.agent,
      time:        h.time,
      completedAt: h.completedAt ? new Date(h.completedAt).toISOString() : null,
      status:      'completed',
    })),
  };

  let blob, filename;

  if (_migFormat === 'json') {
    blob     = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    filename = `ترحيل_حوالات_${stamp}.json`;

  } else if (_migFormat === 'csv') {
    const header = ['id','code','name','amount','currency','source','agent','time','completedAt'];
    const rows   = payload.records.map(r => header.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(','));
    blob     = new Blob(['\uFEFF' + [header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    filename = `ترحيل_حوالات_${stamp}.csv`;

  } else {
    const lines = payload.records.map((r,i) =>
      `[${i+1}] ${r.time} | ${r.name} | ${r.amount} ${r.currency} | ${r.source} ← ${r.agent} | كود: ${r.code}`
    );
    const header = `=== ترحيل سجل الحوالات ===\nالتاريخ: ${now.toLocaleString('ar-IQ')}\nالإجمالي: ${count} حوالة\n${'─'.repeat(60)}\n`;
    blob     = new Blob([header + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    filename = `ترحيل_حوالات_${stamp}.txt`;
  }

  // Download
  const a = document.createElement('a');
  a.href  = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);

  // Clear if toggled
  const clearAfter = document.getElementById('migClearAfter')?.checked;
  closeMigrationModal();

  if (clearAfter) {
    transferHistory.length = 0;
    renderHistory();
    computeStats();
    showToast(`تم ترحيل ${count} حوالة وتفريغ السجل`, 'success');
  } else {
    showToast(`تم ترحيل ${count} حوالة — السجل محفوظ`, 'success');
  }
}

function clearHistorySearch() {
  const inp = document.getElementById('historySearchInput');
  if (inp) inp.value = '';
  _historySearch = '';
  renderHistory();
}

function exportHistory() {
  if (transferHistory.length === 0) { showToast('السجل فارغ', 'warning'); return; }
  const header = ['#', 'الوقت', 'الاسم', 'المبلغ', 'العملة', 'المرسلة', 'المستقبلة', 'الكود'];
  const rows = transferHistory.map((h, i) => [
    transferHistory.length - i,
    h.time || '--',
    h.name || '--',
    h.amount || '--',
    h.currency || '--',
    h.source || '--',
    _agentNames[h.agent] || h.agent || '--',
    h.code || '--',
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `سجل_الحوالات_${new Date().toLocaleDateString('ar')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportNotificationsFile() {
  if (transferHistory.length === 0) { showToast('السجل فارغ', 'warning'); return; }
  const lines = transferHistory.map(h =>
    `[${h.time || '--'}] ${h.name || '--'} | ${h.amount} ${h.currency} | ${_agentNames[h.agent] || h.agent} | كود: ${h.code}`
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `إشعارات_التحويل_${new Date().toLocaleDateString('ar')}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ========== SELECT TRANSFER ==========
function selectTransfer(id) {
  const t = transfers.find(x => x.id === id);
  if (!t) return;

  _selectedId = id;

  // Always update source chat display + context panel
  setTimeout(() => {
    showSourceChat(t);
    renderTransfers();
    if (t.dbId || t.jid) _showCtxPanel(t);
  }, 50);

  // ── If form is in manual mode: skip auto-fill, just show source message ──
  if (_formMode === 'manual') {
    showToast('رسالة المصدر معروضة — الوضع اليدوي للنموذج نشط', 'info');
    return;
  }

  // ── Form is in smart mode: auto-fill all fields ──
  const ai = document.getElementById('aiStatus');
  if (ai) ai.style.display = 'flex';
  _updateFormModeStrip();

  setTimeout(() => {
    const amt  = document.getElementById('mainAmount');
    const name = document.getElementById('clientName');
    const curr = document.getElementById('currency');
    const grp  = document.getElementById('sourceGroup');
    const comm = document.getElementById('commission');

    if (amt)  { amt.value  = t.amount;   amt.classList.add('auto-filled'); }
    if (name) { name.value = t.name;     name.classList.add('auto-filled'); }
    if (curr) curr.value = t.currency;
    if (grp && t.groupName) {
      // Add option if not already present, then select it
      if (!Array.from(grp.options).some(o => o.value === t.groupName)) {
        const opt = document.createElement('option');
        opt.value = t.groupName;
        opt.textContent = t.groupName;
        grp.appendChild(opt);
      }
      grp.value = t.groupName;
    }

    // Auto commission
    const commRates = { aswar: 2, abuhashim: 1.5, random: 3 };
    const commVal = (t.amount * (commRates[t.group] || 2) / 100).toFixed(2);
    if (comm) { comm.value = commVal; comm.classList.add('auto-filled'); }

    // ── Auto-fill wallet/phone ──
    const wt = document.getElementById('walletType');
    const wn = document.getElementById('walletNumber');
    if (t.wallet && wt && wn) {
      wt.value = t.wallet.type;  wt.disabled = false;
      wn.value = t.wallet.number; wn.disabled = false;
      wn.classList.add('auto-filled');
    } else if (!t.wallet && t.phone && wt && wn) {
      wt.value = 'phone'; wt.disabled = false;
      wn.value = t.phone.replace(/\s/g,''); wn.disabled = false;
      wn.classList.add('auto-filled');
    } else if (wt && wn) {
      wt.value = ''; wt.disabled = true;
      wn.value = ''; wn.disabled = true;
    }

    document.getElementById('secCode').textContent = generateCode();
    calculateNet();
    showToast('تم تحليل الرسالة وملء البيانات تلقائياً', 'info');
  }, 300);

  setTimeout(() => {
    document.querySelectorAll('.auto-filled').forEach(el => el.classList.remove('auto-filled'));
  }, 3000);
}

// ========== SHOW SOURCE CHAT ==========
function showSourceChat(t) {
  const groupLbl   = document.getElementById('sourceChatGroup');
  const rawBox     = document.getElementById('rawMsgBox');
  const groupFull  = { aswar: 'الأساور', abuhashim: 'أبو هاشم', random: 'عشوائية' };
  const groupColor = { aswar: '#c084fc', abuhashim: '#60a5fa', random: '#fde047' };

  const label = t.groupName || groupFull[t.group] || t.group;
  const color = groupColor[t.group] || '#25D366';

  if (groupLbl) { groupLbl.textContent = label; groupLbl.style.color = color; }

  if (rawBox) {
    const walletLine = t.wallet
      ? `\n${walletConfig[t.wallet.type]?.icon || '💳'} ${walletConfig[t.wallet.type]?.label || 'رقم'}: ${t.wallet.number}` : '';
    rawBox.textContent =
      `${label}  •  ${t.time || ''}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `${t.name}\n\n` +
      `${t.msg || t.message || ''}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `${Number(t.amount).toLocaleString()} ${t.currency}` + walletLine;
  }
}

// ========== CALCULATE NET ==========
function calculateNet() {
  const amount   = parseFloat(document.getElementById('mainAmount')?.value)   || 0;
  const comm     = parseFloat(document.getElementById('commission')?.value)   || 0;
  const net      = amount - comm;
  const currency = document.getElementById('currency')?.value || 'USD';
  const netEl    = document.getElementById('netAmount');
  const detailEl = document.getElementById('netDetail');
  if (netEl)    netEl.textContent    = `${currency} ${net.toFixed(2)}`;
  if (detailEl) detailEl.textContent = `المبلغ: ${currency} ${amount.toFixed(2)} | العمولة: ${currency} ${comm.toFixed(2)}`;
}

const _calcNetNow = calculateNet;

// ========== FILTER SOURCE GROUP ==========
function filterGroup(group, el) {
  currentFilter = group;
  _searchQuery  = '';
  const si = document.getElementById('transferSearch');
  if (si) si.value = '';
  ['gtab-all','gtab-aswar','gtab-abuhashim','gtab-random'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('active');
  });
  if (el) el.classList.add('active');
  renderTransfers(true); // user action — immediate
}

const searchTransfers = debounce((q) => {
  _searchQuery = q.trim();
  renderTransfers(true); // user typed — immediate
}, 200);

// ========== EXECUTE TRANSFER ==========
function executeTransfer() {
  const name = document.getElementById('clientName')?.value?.trim();
  const agentEl = document.getElementById('execAgent');
  const agent = agentEl ? agentEl.selectedOptions[0]?.text : 'برهوم تونس';
  if (!name) { showToast('اختر حوالة من القائمة أولاً', 'warning'); return; }
  const confirmText = document.getElementById('confirmText');
  if (confirmText) confirmText.innerHTML = `هل تريد إرسال حوالة <b>${escapeHtml(name)}</b> إلى <b>${escapeHtml(agent)}</b> للتنفيذ الفوري؟`;
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.add('show');
  else confirmExecution();
}

function confirmExecution() {
  const name     = document.getElementById('clientName')?.value?.trim()   || '';
  const amount   = parseFloat(document.getElementById('mainAmount')?.value)|| 0;
  const currency = document.getElementById('currency')?.value              || 'USD';

  // ── Supervisor limit check ──
  const _svCheck = _checkSupervisorLimits(amount, currency);
  if (!_svCheck.ok) {
    showToast(_svCheck.reason, 'error');
    return;
  }

  closeModal();
  const code     = document.getElementById('secCode')?.textContent?.trim() || generateCode();
  const agentEl  = document.getElementById('execAgent');
  const agentId  = agentEl?.value || 'barhoum';
  const source   = document.getElementById('sourceGroup')?.selectedOptions[0]?.text || '—';

  // Deduplication check — block same transfer within 10 minutes
  if (_checkExecDuplicate(name, amount, currency)) {
    showToast('تحذير: يبدو أن هذه الحوالة أُرسلت مسبقاً خلال آخر 10 دقائق!', 'warning');
    // Still allow but mark as potential duplicate
  }

  // wallet info
  const walletTypeEl = document.getElementById('walletType');
  const walletNumEl  = document.getElementById('walletNumber');
  const walletInfo   = (walletTypeEl?.value && walletNumEl?.value)
    ? { type: walletTypeEl.value, number: walletNumEl.value } : null;

  const now = Date.now();
  const newEntry = {
    id:        `E${String(executions.length + execTransfers.length + 1).padStart(3,'0')}`,
    code,
    name,
    amount,
    currency,
    agent:     agentId,
    agentName: _agentNames[agentId] || agentId,
    status:    'waiting',
    steps:     1,
    source:    source.replace(/[^\u0600-\u06FF\s]/g, '').trim(),
    time:      new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', hour12: true }),
    wallet:    walletInfo,
    createdAt: now
  };

  executions.unshift(newEntry);

  const isDuplicate = _checkExecDuplicate(name, amount, currency);
  const execBubble = {
    id:              newEntry.id,
    agent:           agentId,
    name,
    amount,
    currency,
    code,
    status:          'waiting',
    priority:        'normal',
    time:            newEntry.time,
    source:          newEntry.source,
    wallet:          walletInfo,
    phone:           walletInfo?.number || '',
    createdAt:       now,
    sourceTransferId: _selectedId,
    isDuplicate:     isDuplicate
  };
  execTransfers.unshift(execBubble);
  _reorderExecQueue();
  _saveExecTransfers();
  // Use setTimeout(0) to ensure DOM updates AFTER the current call stack clears
  setTimeout(() => {
    renderExecBubbles();
    if (typeof computeStats === 'function') computeStats();
  }, 0);

  // Mark source as sent-to-exec with visual indicator
  if (_selectedId) {
    const src = transfers.find(t => t.id === _selectedId);
    if (src) { src.status = 'sent-to-exec'; renderTransfers(true); } // status change — immediate
  }

  // Update agent load indicators
  _renderAgentLoadBadges();

  showToast(`تم إرسال الحوالة إلى ${_agentNames[agentId] || agentId} — كود: ${code}`, 'success');

  // ── إرسال عبر واتساب تلقائياً إذا للوكيل رقم ──
  _sendViaWhatsApp({ agentId, agentEl, name, amount, currency, code, walletInfo });

  // Generate new code
  const scEl = document.getElementById('secCode');
  if (scEl) scEl.textContent = generateCode();
}

// ── إرسال الحوالة عبر واتساب للوكيل المختار ────────────────────────────────
async function _sendViaWhatsApp({ agentId, agentEl, name, amount, currency, code, walletInfo }) {
  // استخرج رقم واتساب من data-whatsapp على الـ option
  const selectedOpt = agentEl ? agentEl.selectedOptions[0] : null;
  const waNumber = selectedOpt ? (selectedOpt.dataset.whatsapp || '') : '';

  if (!waNumber) {
    showToast('لا يوجد رقم واتساب لهذا الوكيل — أضفه من صفحة المشرف', 'warning');
    return;
  }

  const agentName = selectedOpt?.text || agentId;

  // بناء نص الرسالة
  const walletLine = walletInfo
    ? `\n${walletInfo.type === 'phone' ? 'هاتف' : walletInfo.type === 'iban' ? 'IBAN' : 'محفظة'}: ${walletInfo.number}`
    : '';

  const message = [
    'حوالة جديدة من انترناشونال للصرافة',
    '━━━━━━━━━━━━━━━━━━━━',
    `الاسم   : ${name}`,
    `المبلغ  : ${amount.toLocaleString()} ${currency}`,
    `الكود   : ${code}`,
    walletLine,
    '━━━━━━━━━━━━━━━━━━━━',
    'يرجى التنفيذ وإرسال الإيصال متضمناً الكود أعلاه',
  ].filter(Boolean).join('\n');

  // أرسل عبر Baileys
  try {
    const result = await window.waBridgeSendToAgent({
      toNumber:     waNumber,
      message:      message,
      transferCode: code,
      agentId:      agentId,
    });

    console.log('📤 wa-send result:', JSON.stringify(result));
    if (result && result.ok) {
      showToast(`تم إرسال الحوالة لـ ${agentName} عبر واتساب`, 'success');
    } else {
      const errMsg = result?.error || result?.message || JSON.stringify(result) || 'خطأ غير معروف';
      console.error('wa-send failed:', errMsg, 'waNumber:', waNumber);
      showToast(`فشل الإرسال: ${errMsg}`, 'warning');
    }
  } catch(e) {
    console.error('wa-send exception:', e);
    showToast(`تعذر الاتصال بجسر واتساب: ${e.message}`, 'warning');
  }
}

// ── عند تأكيد الإيصال من الوكيل عبر واتساب ─────────────────────────────────
function onReceiptConfirmed(code, receiptText, confirmedAt) {
  // ابحث عن الحوالة في قائمة التنفيذ بالكود
  const exec = execTransfers.find(e => e.code === code);
  if (!exec) return;

  exec.status       = 'done';
  exec.receiptText  = receiptText;
  exec.confirmedAt  = confirmedAt;

  // حدّث حالة الحوالة الأصلية
  if (exec.sourceTransferId) {
    const src = transfers.find(t => t.id === exec.sourceTransferId);
    if (src) { src.status = 'done'; renderTransfers(true); }
  }

  renderExecBubbles();
  _addToHistory(exec);
  showToast(`تم التأكيد من الوكيل — كود: ${code}`, 'success');
  computeStats();
}

function closeModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('show');
}

// ========== EDIT TRANSFER ==========
function editTransfer() {
  const name = document.getElementById('clientName')?.value?.trim();
  if (!name) { showToast('لا توجد بيانات لتعديلها', 'warning'); return; }
  ['mainAmount', 'clientName', 'commission'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.removeAttribute('readonly'); el.classList.add('auto-filled'); }
  });
  showToast('وضع التعديل — عدّل البيانات ثم أرسل للتنفيذ', 'info');
}

// ========== SEND RECEIPT ==========
function sendReceipt() {
  const name = document.getElementById('clientName')?.value?.trim();
  if (!name) { showToast('لا توجد بيانات لإرسالها', 'warning'); return; }
  showToast('تم إرسال الوصل عبر واتساب بنجاح', 'success');
}

// ========== CLEAR FORM ==========
function clearForm() {
  ['mainAmount', 'clientName', 'commission'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('auto-filled', 'valid', 'invalid'); }
  });
  ['currency', 'sourceGroup', 'execAgent'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.selectedIndex = 0;
  });
  calculateNet();

  const sc = document.getElementById('secCode');
  if (sc) sc.textContent = generateCode();

  const ai = document.getElementById('aiStatus');
  if (ai) ai.style.display = 'none';
  _updateFormModeStrip();

  const groupLbl = document.getElementById('sourceChatGroup');
  if (groupLbl) { groupLbl.textContent = '—'; groupLbl.style.color = ''; }

  const rawBox = document.getElementById('rawMsgBox');
  if (rawBox) rawBox.innerHTML = '<div class="raw-msg-placeholder">اضغط على رسالة لعرضها هنا</div>';

  _selectedId = null;
  renderTransfers(true); // user cleared form — immediate
  showToast('تم مسح النموذج', 'info');
}

// ========== COPY SEC CODE ==========
function copySecCode() {
  const code = document.getElementById('secCode')?.textContent?.trim();
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    showToast(`تم نسخ الرمز: ${code}`, 'success');
  }).catch(() => {
    showToast(`الرمز: ${code}`, 'info');
  });
}

// ========== FORM MODE — independent from global smartMode ==========
// Controls ONLY whether the bot can auto-fill the form fields.
// Has NO effect on the global bot/simulator/pipeline.
let _formMode = 'smart';       // 'smart' | 'manual'
let _formModePausedBot = false; // did form-manual pause a running bot?

// ── Form countdown timer state ──
const FC_SECONDS  = 10;
let _fcInterval   = null;   // setInterval handle
let _fcRemaining  = 0;      // seconds left
let _fcCallback   = null;   // function to call at 0
let _botProcessing = false; // guard: prevent concurrent _botAutoProcess runs

/* ══════════════════════════════════════════════════
   SUPERVISOR SYNC — إعدادات المشرف
   Reads intl_botSettings from localStorage and applies
   to the running transactions page in real-time.
══════════════════════════════════════════════════ */
let _botSettings = {};      // current applied settings from supervisor

function _loadBotSettings() {
  try {
    const raw = localStorage.getItem('intl_botSettings');
    if (!raw) return;
    const s = JSON.parse(raw);
    _botSettings = s;

    // 1. Bot master switch
    if (typeof s.master === 'boolean') {
      _botRunning = s.master;
      if (!s.master && smartMode) {
        smartMode = false;
        setFormMode('manual', true);
      }
    }

    // 2. Auto-execution (smart mode)
    if (typeof s.autoexec === 'boolean' && !s.autoexec && smartMode) {
      smartMode = false;
      setFormMode('manual', true);
    }

    // 3. Default currency — update form field if open
    if (s.defaultCurrency) {
      const curEl = document.getElementById('currency');
      if (curEl && !curEl.dataset.userModified) curEl.value = s.defaultCurrency;
    }

    // 4. Default agent — update form field if open
    if (s.defaultAgent && s.defaultAgent !== 'auto') {
      const agEl = document.getElementById('agent');
      if (agEl && !agEl.dataset.userModified) agEl.value = s.defaultAgent;
    }

    // 5. Default priority
    if (s.defaultPriority) {
      const priEl = document.getElementById('priority');
      if (priEl && !priEl.dataset.userModified) priEl.value = s.defaultPriority;
    }

    // 6. Re-render exec bubbles if SLA settings changed
    if (s.slaTimeoutMs && typeof renderExecBubbles === 'function') {
      renderExecBubbles();
    }

    // 7. Show supervisor control indicator in header
    _updateSupervisorBadge(s.master);

  } catch(e) { console.warn('_loadBotSettings error:', e); }
}

function _updateSupervisorBadge(active) {
  // Update the existing bot-status-indicator in the header
  const sub = document.getElementById('botStatusSub');
  const ind = document.getElementById('botStatusIndicator');
  if (sub) sub.textContent = active ? 'نشط' : 'متوقف';
  if (ind) {
    const dot = ind.querySelector('.bot-status-dot-anim');
    if (dot) dot.style.background = active ? '#22c55e' : '#ef4444';
    ind.title = active ? 'البوت نشط — يُدار من قِبَل المشرف' : 'البوت متوقف — أُوقف من المشرف';
  }
}

/* Cross-tab sync — fires when supervisor saves settings */
window.addEventListener('storage', function(e) {
  if (e.key === 'intl_botSettings') {
    _loadBotSettings();
    if (typeof showToast === 'function')
      showToast('تم تحديث إعدادات البوت من المشرف', 'info');
  }
  // Supervisor reading execTransfers / transferHistory is automatic (shared localStorage)
});

/* Validate transfer amount against supervisor limits */
function _checkSupervisorLimits(amount, currency) {
  if (!_botSettings) return { ok: true };
  if (_botSettings.minTransferAmount && amount < _botSettings.minTransferAmount) {
    return { ok: false, reason: 'المبلغ أقل من الحد الأدنى المسموح: ' + _botSettings.minTransferAmount + ' $' };
  }
  if (_botSettings.maxTransferAmount && amount > _botSettings.maxTransferAmount) {
    return { ok: false, reason: 'المبلغ يتجاوز الحد الأقصى المسموح: ' + _botSettings.maxTransferAmount.toLocaleString() + ' $' };
  }
  if (_botSettings.allowedCurrencies && !_botSettings.allowedCurrencies.includes(currency)) {
    return { ok: false, reason: 'العملة ' + currency + ' غير مسموح بها من قِبل المشرف' };
  }
  return { ok: true };
}

/* Get agent capacity from supervisor settings */
function _getSupervisorAgentCap(agentId) {
  if (_botSettings.agentCaps && _botSettings.agentCaps[agentId] !== undefined) {
    return _botSettings.agentCaps[agentId];
  }
  return 5; // default
}



/* ══════════════════════════════════════════════════
   EMPLOYEE SYNC — ربط الموظفين بصفحة الحوالات
   Reads intl_employees from localStorage (set by supervisor)
══════════════════════════════════════════════════ */
let _currentEmployee = null; // logged-in employee for this session

function _loadEmployeeList() {
  try {
    const employees_raw = (window._intlCache && window._intlCache.employees) || null;
    if (!employees_raw) return;
    const raw = JSON.stringify(employees_raw); // للتوافق مع بقية الكود
    const employees = JSON.parse(raw);
    // Populate agent dropdown with active employees
    const agentEl = document.getElementById('agent');
    if (!agentEl) return;
    const activeEmps = employees.filter(e => e.status !== 'suspended');
    // Keep existing options then add employees not already listed
    const existing = Array.from(agentEl.options).map(o => o.value);
    activeEmps.forEach(emp => {
      if (!existing.includes(emp.username)) {
        const opt = document.createElement('option');
        opt.value = emp.username;
        opt.textContent = emp.name + ' (' + emp.role + ')';
        agentEl.appendChild(opt);
      }
    });
  } catch(e) { console.warn('_loadEmployeeList error:', e); }
}

function _checkEmployeePermission(action) {
  if (!_currentEmployee) return true; // no restriction if no employee selected
  const perms = _currentEmployee.permissions || {};
  const map = { send:'send', edit:'edit', cancel:'cancel', export:'export', bot:'bot' };
  return perms[map[action]] !== false;
}

function _applyEmployeeRestrictions(emp) {
  // Disable bot mode if not permitted
  const botToggle = document.getElementById('modeToggle');
  if (botToggle && emp.permissions && !emp.permissions.bot) {
    botToggle.style.display = 'none';
  }
  // Apply amount limits to form
  if (emp.maxSingle) {
    const amountEl = document.getElementById('amount');
    if (amountEl) amountEl.max = emp.maxSingle;
  }
}

/* Listen for supervisor employee updates */
window.addEventListener('storage', function(e) {
  if (e.key === 'intl_employees') {
    _loadEmployeeList();
    if (typeof showToast === 'function')
      showToast('تم تحديث قائمة الموظفين من المشرف', 'info');
  }
});

document.addEventListener('DOMContentLoaded', function() {
  _loadEmployeeList();
});

/* Load on page start */
document.addEventListener('DOMContentLoaded', function() {
  _loadBotSettings();
});


function _fcSetIdle() {
  // Badge stays visible — just resets to standby appearance
  const badge   = document.getElementById('fcBadge');
  const numEl   = document.getElementById('fcSeconds');
  const bar     = document.getElementById('fcBar');
  const dot     = document.getElementById('fcDot');
  const label   = document.getElementById('fcLabel');
  const stopBtn = document.getElementById('fcStopBtn');
  if (!badge) return;
  badge.style.background   = 'rgba(255,255,255,0.03)';
  badge.style.borderColor  = 'rgba(255,255,255,0.08)';
  if (bar)     { bar.style.transition = 'width 0.4s ease, background 0.4s'; bar.style.width = '0%'; bar.style.background = 'rgba(37,211,102,0.08)'; }
  if (numEl)   { numEl.textContent = '--'; numEl.style.color = '#4b5e6e'; }
  if (dot)     { dot.style.background = '#2d3f4a'; }
  if (label)   { label.style.color = '#4b5e6e'; }
  if (stopBtn) { stopBtn.style.opacity = '0'; stopBtn.style.pointerEvents = 'none'; }
}

function startFormCountdown(onComplete) {
  stopFormCountdown();

  _fcRemaining = FC_SECONDS;
  _fcCallback  = onComplete;

  const badge   = document.getElementById('fcBadge');
  const numEl   = document.getElementById('fcSeconds');
  const bar     = document.getElementById('fcBar');
  const dot     = document.getElementById('fcDot');
  const label   = document.getElementById('fcLabel');
  const stopBtn = document.getElementById('fcStopBtn');

  if (!badge) {
    // Fallback: run immediately if element missing
    setTimeout(() => { if (typeof onComplete === 'function') onComplete(); }, FC_SECONDS * 1000);
    return;
  }

  // Activate badge (always visible — just transition to active state)
  badge.style.transition  = 'background 0.4s ease, border-color 0.4s ease';
  badge.style.background  = 'rgba(37,211,102,0.08)';
  badge.style.borderColor = 'rgba(37,211,102,0.3)';

  // Init bar full without transition, then re-enable
  if (bar)   { bar.style.transition = 'none'; bar.style.width = '100%'; bar.style.background = 'rgba(37,211,102,0.18)'; }
  if (numEl) { numEl.textContent = FC_SECONDS; numEl.style.color = '#25D366'; }
  if (dot)   { dot.style.background = '#25D366'; }
  if (label) { label.style.color = '#25D366'; }
  if (stopBtn) { stopBtn.style.opacity = '1'; stopBtn.style.pointerEvents = 'auto'; }

  requestAnimationFrame(() => {
    if (bar) bar.style.transition = 'width 1s linear, background 0.4s';
  });

  _fcInterval = setInterval(() => {
    _fcRemaining--;
    const pct   = (_fcRemaining / FC_SECONDS) * 100;
    const color = _fcRemaining <= 1 ? '#ef4444'
                : _fcRemaining <= 3 ? '#fbbf24'
                : '#25D366';
    if (numEl) { numEl.textContent = _fcRemaining; numEl.style.color = color; }
    if (bar)   { bar.style.width = pct + '%'; bar.style.background = _fcRemaining <= 1 ? 'rgba(239,68,68,0.15)' : _fcRemaining <= 3 ? 'rgba(251,191,36,0.12)' : 'rgba(37,211,102,0.18)'; }
    if (dot)   { dot.style.background = color; }
    if (label) { label.style.color = color; }

    if (_fcRemaining <= 0) {
      const cb = _fcCallback;
      stopFormCountdown();
      if (typeof cb === 'function') cb();
    }
  }, 1000);
}

function stopFormCountdown() {
  if (_fcInterval) { clearInterval(_fcInterval); _fcInterval = null; }
  _fcCallback    = null;
  _fcRemaining   = 0;
  _botProcessing = false;
  _fcSetIdle(); // Reset to idle — badge stays visible
}

function _updateFormModeStrip() {
  const strip     = document.getElementById('formModeStrip');
  const icon      = document.getElementById('formModeIcon');
  const label     = document.getElementById('formModeLabel');
  const sub       = document.getElementById('formModeSub');
  const btnManual = document.getElementById('formBtnManual');
  const btnSmart  = document.getElementById('formBtnSmart');
  if (!strip) return;

  if (_formMode === 'smart') {
    strip.style.background   = 'rgba(37,211,102,0.05)';
    strip.style.borderColor  = 'rgba(37,211,102,0.25)';
    if (icon)  icon.textContent = '🤖';
    if (label) { label.textContent = 'وضع ذكي';  label.style.color = '#25D366'; }
    if (sub)   { sub.textContent  = 'البوت يجلب الرسائل ويملأ الحقول تلقائياً'; sub.style.color = 'rgba(37,211,102,0.6)'; }
    if (btnManual) {
      btnManual.style.background  = 'rgba(255,255,255,0.05)';
      btnManual.style.color       = '#4d6080';
      btnManual.style.borderColor = 'rgba(255,255,255,0.08)';
    }
    if (btnSmart) {
      btnSmart.style.background  = 'rgba(37,211,102,0.18)';
      btnSmart.style.color       = '#25D366';
      btnSmart.style.borderColor = 'rgba(37,211,102,0.4)';
    }
  } else {
    strip.style.background   = 'rgba(245,158,11,0.06)';
    strip.style.borderColor  = 'rgba(245,158,11,0.25)';
    if (icon)  icon.textContent = '✋';
    if (label) { label.textContent = 'وضع يدوي'; label.style.color = '#fbbf24'; }
    if (sub)   { sub.textContent  = 'البوت متوقف — تحكم يدوي بالرسائل والحقول'; sub.style.color = 'rgba(245,158,11,0.6)'; }
    if (btnManual) {
      btnManual.style.background  = 'rgba(245,158,11,0.18)';
      btnManual.style.color       = '#fbbf24';
      btnManual.style.borderColor = 'rgba(245,158,11,0.35)';
    }
    if (btnSmart) {
      btnSmart.style.background  = 'rgba(255,255,255,0.05)';
      btnSmart.style.color       = '#4d6080';
      btnSmart.style.borderColor = 'rgba(255,255,255,0.08)';
    }
  }
}

// Show/hide pause state on the source messages panel
function _setSourcePausedOverlay(show) {
  const panel   = document.getElementById('sourceMsgsPanel');
  const statusEl = document.getElementById('sourceBotStatus');
  let overlay   = document.getElementById('sourcePauseOverlay');

  if (show) {
    // Update header status indicator
    if (statusEl) {
      statusEl.style.color = '#fbbf24';
      statusEl.innerHTML   = 'البوت متوقف مؤقتاً (يدوي) • <span id="incomingCount">' +
        (document.getElementById('incomingCount')?.textContent || '0') + '</span> رسالة';
    }
    // Build overlay if not already present
    if (!overlay && panel) {
      overlay = document.createElement('div');
      overlay.id = 'sourcePauseOverlay';
      overlay.style.cssText = `
        position:absolute;inset:0;z-index:10;
        background:rgba(11,20,26,0.72);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:12px;backdrop-filter:blur(3px);
        opacity:0;transition:opacity 0.35s ease;
        pointer-events:none;
      `;
      overlay.innerHTML = `
        <div style="
          padding:18px 24px;border-radius:16px;text-align:center;
          background:rgba(20,28,34,0.9);
          border:1px solid rgba(245,158,11,0.25);
          box-shadow:0 8px 32px rgba(0,0,0,0.5);
        ">
          <div style="font-size:13px;font-weight:700;color:#fbbf24;margin-bottom:4px;">وضع يدوي</div>
          <div style="font-size:10px;color:#64748b;margin-bottom:16px;line-height:1.6;">
            البوت متوقف عن جلب الرسائل<br>والتحقق منها
          </div>
          <button onclick="setFormMode('smart')" style="
            padding:7px 20px;border-radius:20px;
            background:rgba(37,211,102,0.15);color:#25D366;
            font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;
            border:1px solid rgba(37,211,102,0.3);transition:all .2s;
            pointer-events:auto;
          "
          onmouseover="this.style.background='rgba(37,211,102,0.28)'"
          onmouseout="this.style.background='rgba(37,211,102,0.15)'">
            تشغيل البوت
          </button>
        </div>
      `;
      panel.appendChild(overlay);
      // Trigger fade-in on next frame
      requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    }
  } else {
    // Restore header status
    if (statusEl) {
      statusEl.style.color = '#25D366';
      statusEl.innerHTML   = 'البوت نشط • <span id="incomingCount">' +
        (document.getElementById('incomingCount')?.textContent || '0') + '</span> رسالة';
    }
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay?.remove(), 370);
    }
  }
}

// Toggle form mode — controls form fill + source message bot independently from global mode
function setFormMode(mode) {
  if (_formMode === mode) return;
  _formMode = mode;
  _updateFormModeStrip();

  if (mode === 'manual') {
    // ── Pause bot locally ──
    // Remember if a bot was running so we can restore it later
    _formModePausedBot = _botRunning;
    if (_botRunning) {
      _botRunning = false;
      // Stop simulator from sending new messages
      if (window.whatsappBotSimulator && typeof window.whatsappBotSimulator.stop === 'function') {
        window.whatsappBotSimulator.stop();
      }
    }
    const ai = document.getElementById('aiStatus');
    if (ai) ai.style.display = 'none';
    // Stop countdown timer if running
    stopFormCountdown();
    // Show pause overlay on source messages panel
    _setSourcePausedOverlay(true);
    showToast('وضع يدوي — البوت متوقف، تحكم يدوي بالرسائل والحقول', 'warning');

  } else {
    // ── Resume bot if it was running before ──
    if (_formModePausedBot && smartMode) {
      _botRunning = true;
      if (window.whatsappBotSimulator) {
        window.whatsappBotSimulator.resume();
      }
      _botAutoProcess();
    }
    _formModePausedBot = false;
    // Remove pause overlay
    _setSourcePausedOverlay(false);
    showToast('وضع ذكي — البوت يجلب الرسائل ويملأ الحقول تلقائياً', 'success');
  }
}

// ========== TOGGLE MODE (global bot — does NOT affect form mode) ==========
function toggleMode() {
  smartMode = !smartMode;
  const btn = document.getElementById('modeToggle');
  if (smartMode) {
    if (btn) { btn.className = 'mode-badge mode-smart'; btn.innerHTML = 'وضع ذكي'; }
    _botRunning = true;
    if (window.whatsappBotSimulator) {
      const lims = window._bcState?.maxMsgsPerGroup || { aswar:9, abuhashim:9, random:9 };
      window.whatsappBotSimulator._groupCounts = { aswar:0, abuhashim:0, random:0 };
      window.whatsappBotSimulator._groupLimits = Object.assign({}, lims);
      window.whatsappBotSimulator._usedIndexes.clear();
      window.whatsappBotSimulator.start();
    }
    renderTransfers(true); // mode switch — immediate
    _botAutoProcess();
  } else {
    _botRunning    = false;
    _botProcessing = false;
    stopFormCountdown();
    if (btn) { btn.className = 'mode-badge mode-manual'; btn.innerHTML = 'وضع يدوي'; }
    showToast('وضع يدوي — البوت متوقف', 'warning');
    renderTransfers(true); // mode switch — immediate
  }
}

// ═══════════════════════════════════════════════════════════════
//  BOT VALIDATION & AUTO-CORRECTION ENGINE
//  Compares each transfer's stored fields against its original
//  source message. Any mismatch is corrected automatically.
// ═══════════════════════════════════════════════════════════════

// ── Currency keywords map (mirrors parseWhatsAppMessage logic) ──
const _CURRENCY_MAP = {
  USD: /دولار|dollar|usd|\$|أمريكي/i,
  ILS: /شيكل|شكل|ils|₪/i,
  JOD: /دينار|jod|أردني/i,
  EUR: /يورو|euro|eur|€/i,
  EGP: /جنيه|egp|مصري/i,
};

// ── Parse currency from raw message ──
function _parseCurrency(text) {
  for (const [code, rx] of Object.entries(_CURRENCY_MAP)) {
    if (rx.test(text)) return code;
  }
  return null; // not detected
}

// ── Parse amount from raw message ──
function _parseAmount(text) {
  // prefer amount after trigger keywords like "سلم X 500"
  const kw = text.match(/(?:سلم|حول|أرسل|send|transfer)\s+\S+\s+([\d,]+(?:\.\d+)?)/i);
  if (kw) return parseFloat(kw[1].replace(/,/g, ''));
  const m = text.match(/(\d[\d,]*(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}

// ── Parse name from raw message ──
function _parseName(text) {
  const m = text.match(
    /(?:سلم|حول|لـ?|الى|إلى|to|send\s+\d+\s+\w+\s+to|على\s*اسم)\s+([^\d\n،,]{3,40}?)(?=\s*\d|\s*$)/i
  );
  if (m && m[1].trim().length > 1) return m[1].trim();
  const words = text.replace(/\d+/g, '').match(/[\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,})+/);
  return words ? words[0].trim() : null;
}

// ── Parse wallet from raw message (re-implementation for corrections) ──
function _parseWallet(text) {
  const ibanM   = text.match(/\b([A-Z]{2}\d{2}[A-Z0-9]{4,30})\b/);
  if (ibanM) return { type: 'iban', number: ibanM[1] };
  const intlM   = text.match(/(\+\d{3}[\s\-]?\d{7,12})/);
  if (intlM)  return { type: 'phone', number: intlM[1].replace(/[\s\-]/g, '') };
  const locM    = text.match(/\b(0[57]\d{7,9})\b/);
  if (locM) {
    const isWallet = /محفظة|wallet|ووري|ooredoo|jawwal|بايمنت/i.test(text);
    return { type: isWallet ? 'ewallet' : 'phone', number: locM[1] };
  }
  const longM   = text.match(/\b(\d{8,14})\b/);
  if (longM)  return { type: 'bank', number: longM[1] };
  return null;
}

// ── Name similarity (word-overlap ratio) ──
function _nameSim(a, b) {
  if (!a || !b) return 0;
  const norm = s => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const na = norm(a), nb = norm(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wa = na.split(' '), wb = nb.split(' ');
  const common = wa.filter(w => wb.includes(w)).length;
  return common / Math.max(wa.length, wb.length);
}

// ── Flash a form field red→normal to highlight a correction ──
function _flashFieldCorrected(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.transition = 'box-shadow .2s, background .2s';
  el.style.boxShadow  = '0 0 0 3px rgba(251,191,36,0.55)';
  el.style.background = 'rgba(251,191,36,0.08)';
  el.classList.add('auto-filled');
  setTimeout(() => {
    el.style.boxShadow  = '';
    el.style.background = '';
    el.classList.remove('auto-filled');
  }, 2600);
}

// ── Show bot correction report panel ──
function _showCorrectionReport(transferName, corrections) {
  // Remove any existing report
  const old = document.getElementById('bot-correction-report');
  if (old) old.remove();

  const panel = document.createElement('div');
  panel.id = 'bot-correction-report';
  panel.style.cssText = `
    position:fixed; bottom:24px; left:24px; z-index:9500;
    width:320px; background:#111827;
    border:1px solid rgba(251,191,36,0.35); border-radius:14px;
    box-shadow:0 12px 40px rgba(0,0,0,0.6); overflow:hidden;
    animation:mcSlideUp .35s cubic-bezier(.22,1,.36,1);
    font-family:inherit;
  `;

  const rows = corrections.map(c => {
    const icon  = c.severity === 'error' ? '🔴' : '🟡';
    const arrow = `<span style="color:#64748b;margin:0 6px">→</span>`;
    return `<div style="padding:7px 14px;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:6px;font-size:11px;">
      <span>${icon}</span>
      <span style="color:#94a3b8;min-width:80px;">${c.label}</span>
      <span style="color:#ef4444;text-decoration:line-through;font-family:monospace;font-size:10px;">${c.old}</span>
      ${arrow}
      <span style="color:#22c55e;font-family:monospace;font-size:10px;font-weight:700;">${c.new}</span>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div style="background:rgba(251,191,36,0.1);padding:10px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(251,191,36,0.2);">
      <div style="flex:1;">
        <div style="font-size:11px;font-weight:700;color:#fbbf24;">تصحيح تلقائي</div>
        <div style="font-size:9px;color:#64748b;">${escapeHtml(transferName)}</div>
      </div>
      <button onclick="this.closest('#bot-correction-report').remove()"
        style="background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;padding:2px 4px;">✕</button>
    </div>
    ${rows}
    <div style="padding:8px 14px;font-size:9px;color:#475569;text-align:center;">
      تم التصحيح تلقائياً من رسالة المصدر
    </div>`;

  document.body.appendChild(panel);
  setTimeout(() => {
    panel.style.transition = 'opacity .5s, transform .5s';
    panel.style.opacity    = '0';
    panel.style.transform  = 'translateY(10px)';
    setTimeout(() => panel.remove(), 500);
  }, 6000);
}

// ══════════════════════════════════════════════════════════════
//  CORE: Validate transfer data against its source message
//  Returns: { valid, fatal, corrections[] }
// ══════════════════════════════════════════════════════════════
function _botValidateAndCorrect(t) {
  const msg = (t.msg || t.message || '').trim();
  const corrections = [];

  // ── No message at all ──
  if (!msg) {
    return { valid: !!t.name && t.amount > 0, fatal: !t.name || !t.amount, corrections,
             reason: 'لا توجد رسالة مصدر للتحقق' };
  }

  // ── Re-parse source message ──
  const parsedAmount   = _parseAmount(msg);
  const parsedCurrency = _parseCurrency(msg);
  const parsedName     = _parseName(msg);
  const parsedWallet   = _parseWallet(msg);

  // Helper to apply form correction
  const applyField = (elId, value) => {
    const el = document.getElementById(elId);
    if (el) { el.value = value; _flashFieldCorrected(elId); }
  };

  // ── 1. AMOUNT ──
  if (parsedAmount && parsedAmount > 0 && Math.abs(parsedAmount - t.amount) > 0.01) {
    corrections.push({ field:'amount', label:'المبلغ',
      old: String(t.amount), new: String(parsedAmount), severity:'error' });
    t.amount = parsedAmount;
    applyField('mainAmount', parsedAmount);
    if (typeof calculateNet === 'function') setTimeout(calculateNet, 50);
  }

  // ── 2. CURRENCY ──
  if (parsedCurrency && parsedCurrency !== t.currency) {
    corrections.push({ field:'currency', label:'العملة',
      old: t.currency, new: parsedCurrency, severity:'error' });
    t.currency = parsedCurrency;
    applyField('currency', parsedCurrency);
    if (typeof calculateNet === 'function') setTimeout(calculateNet, 50);
  }

  // ── 3. NAME (fuzzy — only correct on low similarity) ──
  if (parsedName && parsedName !== 'مجهول') {
    const sim = _nameSim(parsedName, t.name);
    if (sim < 0.65) {
      const sev = sim < 0.35 ? 'error' : 'warning';
      corrections.push({ field:'name', label:'الاسم',
        old: t.name || '—', new: parsedName, severity: sev });
      if (sev === 'error') {
        t.name = parsedName;
        applyField('clientName', parsedName);
      }
    }
  }

  // ── 4. WALLET ──
  if (parsedWallet) {
    const storedNum = t.wallet?.number || '';
    if (parsedWallet.number !== storedNum) {
      corrections.push({ field:'wallet', label:'رقم الحساب',
        old: storedNum || '—', new: parsedWallet.number, severity:'warning' });
      t.wallet = parsedWallet;
      const wt = document.getElementById('walletType');
      const wn = document.getElementById('walletNumber');
      if (wt) { wt.value = parsedWallet.type; wt.disabled = false; }
      if (wn) { wn.value = parsedWallet.number; wn.disabled = false; _flashFieldCorrected('walletNumber'); }
    }
  }

  // ── 5. Final completeness check ──
  const fatal = !t.name?.trim() || !(t.amount > 0) || !t.currency;
  return {
    valid:           !fatal,
    fatal,
    corrections,
    reason:          fatal ? 'بيانات أساسية مفقودة لا يمكن استخراجها من الرسالة' : null,
    correctionCount: corrections.filter(c => c.severity === 'error').length,
  };
}

// ========== BOT AUTO-PROCESS PIPELINE ==========
function _botAutoProcess() {
  // Guards
  if (!smartMode || !_botRunning)       return;
  if (_formMode === 'manual')            return;
  if (_botProcessing)                    return; // already running — new msg will be picked up after current finishes

  const next = transfers.find(t => t.status === 'new');
  if (!next) return; // nothing to process

  _botProcessing = true;

  // ── Step 1: mark + select (fills form via selectTransfer) ──
  next.status = 'processing';
  const itemEl = document.getElementById('tItem-' + next.id);
  if (itemEl) {
    const badge = itemEl.querySelector('[data-status-badge]');
    if (badge) badge.innerHTML = '<span style="background:#f59e0b;color:#000;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700;">قيد الفحص</span>';
  }
  selectTransfer(next.id); // fills form at +300ms

  // ── Step 2: validate at +500ms (after form fill) ──
  setTimeout(() => {
    if (!_botRunning || _formMode === 'manual') {
      _botProcessing = false; return;
    }
    const result = _botValidateAndCorrect(next);
    if (result.fatal) {
      next.status = 'new';
      next._botError = true;
      const el2 = document.getElementById('tItem-' + next.id);
      if (el2) {
        const b2 = el2.querySelector('[data-status-badge]');
        if (b2) b2.innerHTML = '<span style="background:#7f1d1d;color:#fca5a5;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700;">خطأ</span>';
      }
      stopFormCountdown();
      _botProcessing = false;
      return;
    }
    if (result.corrections.length > 0) {
      _showCorrectionReport(next.name, result.corrections);
    }
  }, 500);

  // ── Step 3: start real countdown at +650ms ──
  setTimeout(() => {
    if (!_botRunning || _formMode === 'manual' || next._botError) {
      _botProcessing = false; return;
    }

    startFormCountdown(() => {
      // ─ countdown hit 0 → execute ─
      if (!_botRunning || _formMode === 'manual') {
        _botProcessing = false; return;
      }
      const best = _suggestBestAgent();
      const agentEl = document.getElementById('execAgent');
      if (agentEl && best) agentEl.value = best;
      confirmExecution();
      _botProcessing = false;

      // ── pick the next pending transfer after a short pause ──
      setTimeout(() => {
        if (_botRunning && smartMode) _botAutoProcess();
      }, 600);
    });
  }, 650);
}

// ========== SHOW TOAST ==========
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== THEME ==========
const _SUN_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const _MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
function toggleTheme() { /* dark mode only — light mode disabled */ }
(function () {
  const _t = localStorage.getItem('theme');
  const btn = document.getElementById('themeToggle');
  if (_t === 'light') {
    /* theme via data-theme attr */;
    if (btn) btn.innerHTML = _MOON_SVG;
  } else {
    if (btn) btn.innerHTML = _SUN_SVG;
  }
})();

// ========== LOGOUT ==========
function logout() {
  
  window.location.href = '/logout/';
}

// ========== EXEC PANEL STATUS BADGE ==========
function _execStatusBadge(status) {
  const map = {
    'executed':   ['#065f46','#34d399','نُفّذت'],
    'sent-back':  ['#1e3a5f','#60a5fa','أُرجعت'],
    'cancelled':  ['#3b0f0f','#ef4444','ملغاة'],
    'reassigned': ['#1a2a1a','#a3e635','محوّلة'],
  };
  const [bg, color, label] = map[status] || ['#44330a','#fbbf24','انتظار'];
  return `<span style="background:${bg};color:${color};border-radius:6px;padding:1px 6px;font-size:9px;font-weight:700">${label}</span>`;
}

// ========== STATE MACHINE ==========
const _EXEC_SM = {
  waiting:    ['executed', 'cancelled', 'reassigned'],
  executed:   ['sent-back'],
  reassigned: ['executed', 'cancelled'],
  'sent-back': [],
  cancelled:  [],
  expired:    []
};

function execCanTransition(currentStatus, action) {
  return (_EXEC_SM[currentStatus] || []).includes(action);
}

// ── Gentle DOM-only removal helpers (no full list re-render) ──

// Update exec bubble count badge
function _updateExecBadge() {
  const active = execTransfers.filter(e => ['waiting','executed','reassigned'].includes(e.status)).length;
  const badge  = document.getElementById('execCount') || document.getElementById('execBadge');
  if (badge) badge.textContent = active;
}

// Ultra-calm removal — slow fade only, zero movement of surrounding elements
function _fadeRemove(el, cb) {
  if (!el) { if (cb) cb(); return; }
  el.style.transition    = 'opacity 0.7s ease';
  el.style.opacity       = '0';
  el.style.pointerEvents = 'none';
  setTimeout(() => {
    // Element is fully invisible — remove instantly, no collapse animation
    // Surrounding items shift in one frame while eye is tracking nothing
    el.remove();
    if (cb) cb();
  }, 720);
}

// Remove a source transfer from DOM + array without re-rendering list
function _softRemoveTransfer(id) {
  const idx = transfers.findIndex(t => t.id === id);
  if (idx !== -1) transfers.splice(idx, 1);
  const el = document.getElementById('tItem-' + id);
  if (el) el.remove();
  // Update count badge
  const badge = document.getElementById('incomingCount');
  if (badge) badge.textContent = transfers.filter(t => currentFilter === 'all' || t.group === currentFilter).length;
}

// Remove an exec entry from both arrays and re-render
function _removeExecEntry(id, skipDomRemove) {
  const i1 = execTransfers.findIndex(e => e.id === id);
  if (i1 !== -1) execTransfers.splice(i1, 1);
  const i2 = executions.findIndex(e => e.id === id);
  if (i2 !== -1) executions.splice(i2, 1);
  // Remove DOM element directly — no full list re-render
  if (!skipDomRemove) {
    const el = document.getElementById('eBubble-' + id);
    if (el) el.remove();
  }
  // Update count badge + persist
  _updateExecBadge();
  _saveExecTransfers();
}

// ========== MANUAL ACTION HANDLER ==========
function execManualAction(id, action) {
  const execBubble = execTransfers.find(e => e.id === id);
  const execEntry  = executions.find(e => e.id === id);
  if (!execBubble) return;

  if (!execCanTransition(execBubble.status, action)) {
    showToast('هذا الإجراء غير متاح في الوضع الحالي', 'warning');
    return;
  }

  if (action === 'executed') {
    execBubble.status = 'executed';
    if (execEntry) { execEntry.status = 'executed'; execEntry.steps = 3; }
    _saveExecTransfers();
    const agentName = _agentNames[execBubble.agent] || execBubble.agent;
    showToast(`${agentName} أكد التنفيذ — يتم إرسال الإشعار…`, 'success');

    // Update the bubble visually to show "executed" state briefly
    const execElConfirmed = document.getElementById('eBubble-' + id);
    if (execElConfirmed) {
      const statusStrip = execElConfirmed.querySelector('[data-exec-status]');
      if (statusStrip) {
        statusStrip.style.background  = 'rgba(37,211,102,0.08)';
        statusStrip.style.borderColor = 'rgba(37,211,102,0.25)';
        statusStrip.innerHTML = `<span style="color:#25D366;font-size:10px;font-weight:700;">${agentName} أكد التنفيذ</span>`;
      }
      const btnRow = execElConfirmed.querySelector('[data-exec-actions]');
      if (btnRow) btnRow.innerHTML = '<span style="font-size:10px;color:#4d6080;">جارٍ إرسال الإشعار…</span>';
    }

    // Auto: deliver notification to source and remove from exec panel after 1.8s
    setTimeout(() => { execManualAction(id, 'sent-back'); }, 1800);
    return; // skip the bottom re-render

  } else if (action === 'sent-back') {
    execBubble.status = 'sent-back';
    if (execEntry) { execEntry.status = 'sent-back'; execEntry.steps = 4; }
    _saveExecTransfers();

    // ── Record in history log ──
    _addToHistory(execBubble);

    if (execBubble.sourceTransferId) {
      const srcId  = execBubble.sourceTransferId;
      const srcIdx = transfers.findIndex(t => t.id === srcId);
      if (srcIdx !== -1) {
        // 1) Quietly update badge on source item only (no full re-render)
        transfers[srcIdx].status = 'done';
        const srcDomEl = document.getElementById('tItem-' + srcId);
        if (srcDomEl) {
          const badge = srcDomEl.querySelector('[data-status-badge]');
          if (badge) badge.innerHTML = '<span style="background:#065f46;color:#34d399;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700;">اكتملت</span>';
        }
        showToast('تم تسليم الإشعار وتسجيل الحوالة في السجل', 'success');

        // 2) After 1.2s, fade both out quietly
        setTimeout(() => {
          const srcEl  = document.getElementById('tItem-' + srcId);
          const execEl = document.getElementById('eBubble-' + execBubble.id);

          _fadeRemove(srcEl, () => {
            _softRemoveTransfer(srcId);
            computeStats();
          });
          _fadeRemove(execEl, () => {
            _removeExecEntry(id, true); // true = DOM already removed
            computeStats();
          });
        }, 1200);
      } else {
        // No source found — remove exec bubble only
        const execEl = document.getElementById('eBubble-' + execBubble.id);
        _fadeRemove(execEl, () => { _removeExecEntry(id, true); computeStats(); });
      }
    } else {
      // No source link — remove exec bubble only
      showToast('تم تسليم الإشعار وتسجيل الحوالة في السجل', 'success');
      setTimeout(() => {
        const execEl = document.getElementById('eBubble-' + execBubble.id);
        _fadeRemove(execEl, () => { _removeExecEntry(id, true); computeStats(); });
      }, 1200);
    }
    return; // must return — card is being removed, skip bottom re-render

  } else if (action === 'cancelled') {
    execBubble.status = 'cancelled';
    if (execEntry) execEntry.status = 'cancelled';
    _saveExecTransfers();
    if (execBubble.sourceTransferId) {
      const src = transfers.find(t => t.id === execBubble.sourceTransferId);
      if (src && ['processing','sent-to-exec'].includes(src.status)) {
        src.status = 'new';
        // Update badge in-place — no full re-render
        const srcEl = document.getElementById('tItem-' + execBubble.sourceTransferId);
        if (srcEl) {
          const badge = srcEl.querySelector('[data-status-badge]');
          if (badge) badge.innerHTML = '<span style="background:#25D366;color:#000;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700;">جديدة</span>';
          srcEl.style.opacity = '1';
        }
      }
    }
    // Fade exec card out
    const cancelEl = document.getElementById('eBubble-' + id);
    _fadeRemove(cancelEl, () => { _removeExecEntry(id, true); computeStats(); });
    showToast('تم إلغاء الحوالة وإعادة حالة المصدر', 'warning');
    _renderAgentLoadBadges();
    return; // skip renderExecBubbles below

  } else if (action === 'reassigned') {
    const best = _suggestBestAgent();
    if (best === execBubble.agent) {
      showToast(`المنفذ الحالي (${_agentNames[best] || best}) هو الأقل حملاً`, 'info');
      return;
    }
    execBubble.agent  = best;
    execBubble.status = 'reassigned';
    if (execEntry) execEntry.agent = best;
    _saveExecTransfers();
    _renderAgentLoadBadges();
    showToast(`تم تحويل الحوالة إلى ${_agentNames[best] || best}`, 'success');
  }

  // Update only the specific card's status strip — no full re-render
  const updatedEl = document.getElementById('eBubble-' + id);
  if (updatedEl) {
    const statusStrip = updatedEl.querySelector('[data-exec-status]');
    if (statusStrip && action === 'executed') {
      statusStrip.style.background = 'rgba(34,197,94,0.12)';
      statusStrip.style.borderColor = 'rgba(34,197,94,0.3)';
      statusStrip.innerHTML = `<span style="color:#22c55e;font-size:10px;font-weight:700;">تم التنفيذ</span>`;
    } else if (statusStrip && action === 'reassigned') {
      statusStrip.style.background = 'rgba(163,230,53,0.1)';
      statusStrip.style.borderColor = 'rgba(163,230,53,0.3)';
      const agentName = _agentNames[execBubble.agent] || execBubble.agent;
      statusStrip.innerHTML = `<span style="color:#a3e635;font-size:10px;font-weight:700;">نُقل إلى ${agentName}</span>`;
    }
    // Refresh action buttons
    const btnRow = updatedEl.querySelector('[data-exec-actions]');
    if (btnRow) {
      const allowed = _EXEC_SM[execBubble.status] || [];
      const btnStyle = (bg,c) => `style="padding:5px 10px;border-radius:7px;border:1px solid ${c}44;background:${bg};color:${c};font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;"`;
      const btns = [];
      if (allowed.includes('executed'))   btns.push(`<button ${btnStyle('#065f46','#34d399')} onclick="execManualAction('${id}','executed')">تأكيد التنفيذ</button>`);
      if (allowed.includes('sent-back'))  btns.push(`<button ${btnStyle('#1e3a5f','#60a5fa')} onclick="execManualAction('${id}','sent-back')">إرسال للمصدر</button>`);
      if (allowed.includes('reassigned')) btns.push(`<button ${btnStyle('#1a2a1a','#a3e635')} onclick="execManualAction('${id}','reassigned')">تحويل</button>`);
      if (allowed.includes('cancelled'))  btns.push(`<button ${btnStyle('#3b0f0f','#ef4444')} onclick="execManualAction('${id}','cancelled')">إلغاء</button>`);
      btnRow.innerHTML = btns.join('');
    }
  }
  _renderAgentLoadBadges();
  if (typeof computeStats === 'function') computeStats();
}

// ========== SET EXEC PRIORITY ==========
function execSetPriority(id, priority) {
  const execBubble = execTransfers.find(e => e.id === id);
  if (!execBubble || !['waiting','reassigned'].includes(execBubble.status)) return;
  execBubble.priority = priority;
  _reorderExecQueue();
  _saveExecTransfers();
  renderExecBubbles();
  const labels = { high: 'أولوية عالية', normal: 'أولوية عادية', low: 'أولوية منخفضة' };
  showToast(`${labels[priority] || priority} — تم تعيين الأولوية`, 'info');
}

// ========== LOAD BALANCER ==========
function _getAgentLoad() {
  const counts = {};
  execTransfers.forEach(e => {
    if (['waiting','executed','reassigned'].includes(e.status))
      counts[e.agent] = (counts[e.agent] || 0) + 1;
  });
  return counts;
}

function _suggestBestAgent() {
  const agents = ['barhoum', 'agent2', 'agent3'];
  const loads  = _getAgentLoad();
  return agents.reduce((a, b) => (loads[a] || 0) <= (loads[b] || 0) ? a : b);
}

function _renderAgentLoadBadges() {
  const loads = _getAgentLoad();
  ['barhoum','agent2','agent3'].forEach(id => {
    const badge = document.getElementById('load-' + id);
    if (!badge) return;
    const n = loads[id] || 0;
    badge.textContent = n;
    badge.style.background = n === 0 ? '#065f46' : n < 3 ? '#44330a' : '#3b0f0f';
    badge.style.color      = n === 0 ? '#34d399' : n < 3 ? '#fbbf24' : '#ef4444';
  });
}

// ========== DEDUPLICATION ==========
function _checkExecDuplicate(name, amount, currency) {
  const WINDOW = 10 * 60 * 1000;
  const now    = Date.now();
  return execTransfers.some(e =>
    e.name === name &&
    e.amount === amount &&
    e.currency === currency &&
    (now - (e.createdAt || 0)) < WINDOW &&
    e.status !== 'cancelled'
  );
}

// ── Persist execTransfers to localStorage ──
function _saveExecTransfers() {
  try {
    // Only save active entries (not removed ones)
    localStorage.setItem('execTransfers', JSON.stringify(execTransfers));
  } catch (_) {}
}

// ========== PRIORITY QUEUE REORDER ==========
// High priority first → within same priority: newest at top (descending createdAt)
function _reorderExecQueue() {
  const order = { high: 0, normal: 1, low: 2 };
  execTransfers.sort((a, b) => {
    const pa = order[a.priority || 'normal'];
    const pb = order[b.priority || 'normal'];
    if (pa !== pb) return pa - pb;
    return (b.createdAt || 0) - (a.createdAt || 0); // newest first
  });
}

// ========== SLA COUNTDOWN (1 minute per transfer) ==========
const SLA_LIMIT_MS = 60000; // 1 minute hard deadline

function _elapsedTime(createdAt) {
  if (!createdAt) return { label: '1:00', color: '#4d6080', pct: 100 };
  const remaining = Math.max(0, SLA_LIMIT_MS - (Date.now() - createdAt));
  const totalSec  = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const label = `${min}:${String(sec).padStart(2,'0')}`;
  const pct   = Math.round((remaining / SLA_LIMIT_MS) * 100);
  // Calm color scale — no pulse, no flash
  if (remaining < 10000) return { label, color: '#f87171', pct }; // soft red
  if (remaining < 25000) return { label, color: '#fbbf24', pct }; // amber
  return                        { label, color: '#4d6080', pct }; // muted blue-grey (not bright green)
}

// ========== EXEC STATS BAR ==========
function renderExecStatsBar() {
  const el = document.getElementById('execStatsBar');
  if (!el) return;
  const total     = execTransfers.length;
  const waiting   = execTransfers.filter(e => e.status === 'waiting').length;
  const executed  = execTransfers.filter(e => e.status === 'executed').length;
  const done      = execTransfers.filter(e => e.status === 'sent-back').length;
  const cancelled = execTransfers.filter(e => e.status === 'cancelled').length;
  const high      = execTransfers.filter(e => e.priority === 'high' && ['waiting','executed','reassigned'].includes(e.status)).length;
  el.innerHTML = `
    <span>الكل: <b style="color:#e9edef">${total}</b></span>
    <span style="color:#fbbf24"><b>${waiting}</b></span>
    <span style="color:#25D366"><b>${executed}</b></span>
    <span style="color:#60a5fa"><b>${done}</b></span>
    ${cancelled > 0 ? `<span style="color:#ef4444"><b>${cancelled}</b></span>` : ''}
    ${high > 0 ? `<span style="color:#f97316">أولوية: <b>${high}</b></span>` : ''}
  `;
}

// ========== SLA LIVE TICKER + AUTO-CANCEL ENGINE ==========
const _slaTickerInterval = setInterval(() => {
  const toExpire = [];

  execTransfers.forEach(e => {
    if (!['waiting','executed','reassigned'].includes(e.status) || !e.createdAt) return;

    const { label, color, pct } = _elapsedTime(e.createdAt);

    // Update countdown text — color transitions smoothly via CSS
    const timerEl = document.getElementById('sla-' + e.id);
    if (timerEl) {
      timerEl.textContent = `${label}`;
      timerEl.style.color = color;
      timerEl.style.animation = 'none'; // no pulse — too distracting
    }

    // Update progress bar — CSS transition handles smooth width change
    const barEl = document.getElementById('sla-bar-' + e.id);
    if (barEl) {
      barEl.style.width      = pct + '%';
      barEl.style.background = color;
      barEl.style.boxShadow  = 'none'; // no glow flash
    }

    // No border flash — removed (was causing eye strain)

    // Mark expired — use <= 0 to avoid floating-point exact-zero miss
    if (pct <= 0) toExpire.push(e);
  });

  // Auto-cancel expired transfers
  toExpire.forEach(e => {
    // Mark in memory immediately so ticker skips it next tick
    e.status = 'expired';

    showToast(`انتهى وقت تنفيذ حوالة "${e.name}" — تم الإلغاء تلقائياً`, 'warning');

    // Restore source transfer to 'new' so bot can re-process
    if (e.sourceTransferId) {
      const src = transfers.find(t => t.id === e.sourceTransferId);
      if (src && ['processing','sent-to-exec'].includes(src.status)) {
        src.status = 'new';
        delete src._botError;
      }
    }

    // Fade out quietly then remove — also restore source badge if still in DOM
    if (e.sourceTransferId) {
      const src = transfers.find(t => t.id === e.sourceTransferId);
      if (src) {
        const srcEl = document.getElementById('tItem-' + e.sourceTransferId);
        if (srcEl) {
          const badge = srcEl.querySelector('[data-status-badge]');
          if (badge) badge.innerHTML = '<span style="background:#166534;color:#4ade80;border-radius:8px;padding:1px 6px;font-size:9px;font-weight:700;">جديدة</span>';
        }
      }
    }
    const cardEl = document.getElementById('eBubble-' + e.id);
    const doRemove = () => {
      _removeExecEntry(e.id, true); // DOM already removed by _fadeRemove
      computeStats();
      if (typeof smartMode !== 'undefined' && smartMode && typeof _botRunning !== 'undefined' && _botRunning) {
        setTimeout(() => _botAutoProcess(), 1200);
      }
    };

    _fadeRemove(cardEl, doRemove);
  });
}, 4000); // 4s interval — calm, easy on the eyes
window.addEventListener('beforeunload', () => clearInterval(_slaTickerInterval));

// ========== RENDER EXEC BUBBLES (source-panel style, no chat) ==========
function renderExecBubbles() {
  const list = document.getElementById('execBubblesList');
  if (!list) return;

  let filtered = currentExecFilter === 'all'
    ? execTransfers
    : execTransfers.filter(e => e.agent === currentExecFilter);

  if (_execSearchQuery) {
    const q = _execSearchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(q) ||
      String(e.amount).includes(q) ||
      e.code.toLowerCase().includes(q)
    );
  }

  const countEl = document.getElementById('execCount');
  if (countEl) countEl.textContent = execTransfers.length;

  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#4d6080;padding:30px;font-size:12px">لا توجد حوالات تنفيذ</div>';
    return;
  }

  renderExecStatsBar();

  list.innerHTML = filtered.map(e => {
    const color = _agentColors[e.agent] || '#32b8c6';
    const icon  = _agentIcons[e.agent]  || '⚡';
    const label = _agentNames[e.agent]  || e.agent;
    const isActive = ['waiting','executed','reassigned'].includes(e.status);
    const bgCard =
      e.status === 'executed'   ? '#0d2a1a' :
      e.status === 'sent-back'  ? '#0a1929' :
      e.status === 'cancelled'  ? '#1a0808' :
      e.status === 'reassigned' ? '#0f1f10' : '#1f2c34';
    const borderClr =
      e.status === 'executed'   ? 'rgba(37,211,102,0.45)' :
      e.status === 'sent-back'  ? 'rgba(96,165,250,0.4)'  :
      e.status === 'cancelled'  ? 'rgba(239,68,68,0.35)'  :
      e.status === 'reassigned' ? 'rgba(163,230,53,0.35)' : 'rgba(255,255,255,0.04)';
    const ticks =
      e.status === 'executed'   ? '<span style="color:#25D366">✓✓</span>' :
      e.status === 'sent-back'  ? '<span style="color:#60a5fa">✓✓</span>' :
      e.status === 'cancelled'  ? '<span style="color:#ef4444">✗</span>'  :
                                  '<span style="color:#8696a0">✓</span>';

    const walletHtml = e.wallet
      ? `<div style="margin-bottom:7px;padding:5px 9px;background:rgba(255,255,255,0.04);border-radius:7px;border:1px solid rgba(50,184,198,0.13);font-size:11px;display:flex;align-items:center;gap:8px;">
          <span style="color:${walletConfig[e.wallet.type]?.color||'#32b8c6'}">${walletConfig[e.wallet.type]?.icon||'💳'}</span>
          <span style="color:#8696a0">${walletConfig[e.wallet.type]?.label||'رقم'}:</span>
          <span style="font-family:monospace;color:#e9edef;direction:ltr;">${escapeHtml(e.wallet.number)}</span>
        </div>` : '';

    // Priority badge
    const priMap = { high: ['#f97316','عالية'], normal: ['#fbbf24','عادية'], low: ['#22c55e','منخفضة'] };
    const [priColor, priLabel] = priMap[e.priority || 'normal'] || priMap.normal;
    const priBadge = `<span style="color:${priColor};font-size:9px;font-weight:600">${priLabel}</span>`;

    // SLA countdown timer + progress bar
    const sla = _elapsedTime(e.createdAt);
    const slaHtml = isActive
      ? `<span id="sla-${e.id}" style="font-size:9px;color:${sla.color};font-family:monospace;font-weight:700;">${sla.label}</span>`
      : '';
    // Progress bar — transition matches ticker interval (3.8s) for smooth drain with no jump
    const slaBarHtml = isActive ? `
      <div style="margin:6px 0 2px;height:2px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
        <div id="sla-bar-${e.id}"
          style="height:100%;border-radius:2px;transition:width 3.8s ease,background 2s ease;
                 width:${sla.pct}%;background:${sla.color};">
        </div>
      </div>` : '';

    // Dedup warning
    const dupWarning = e.isDuplicate
      ? `<div style="margin-bottom:5px;padding:3px 8px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:6px;font-size:9px;color:#fbbf24;">تحذير: قد تكون مكررة</div>`
      : '';

    // Control buttons based on state machine
    const allowed = _EXEC_SM[e.status] || [];
    const btnStyle = (bg, color) => `style="padding:4px 10px;border:none;border-radius:12px;font-size:10px;font-weight:700;cursor:pointer;background:${bg};color:${color};transition:opacity 0.2s" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1"`;
    const ctrlBtns = [];
    if (allowed.includes('executed'))   ctrlBtns.push(`<button ${btnStyle('#065f46','#34d399')} onclick="execManualAction('${e.id}','executed')">تأكيد التنفيذ</button>`);
    if (allowed.includes('sent-back'))  ctrlBtns.push(`<button ${btnStyle('#1e3a5f','#60a5fa')} onclick="execManualAction('${e.id}','sent-back')">إرسال للمصدر</button>`);
    if (allowed.includes('reassigned')) ctrlBtns.push(`<button ${btnStyle('#1a2a1a','#a3e635')} onclick="execManualAction('${e.id}','reassigned')">تحويل</button>`);
    if (allowed.includes('cancelled'))  ctrlBtns.push(`<button ${btnStyle('#3b0f0f','#ef4444')} onclick="execManualAction('${e.id}','cancelled')">إلغاء</button>`);

    // Priority change buttons (only for active waiting items)
    const priCtrl = (e.status === 'waiting' || e.status === 'reassigned')
      ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
           <span style="font-size:9px;color:#8696a0;align-self:center">أولوية:</span>
           <button ${btnStyle(e.priority==='high'?'#7c2d12':'#1a1a1a', e.priority==='high'?'#f97316':'#666')} onclick="execSetPriority('${e.id}','high')">🔴</button>
           <button ${btnStyle(e.priority==='normal'?'#44330a':'#1a1a1a', e.priority==='normal'?'#fbbf24':'#666')} onclick="execSetPriority('${e.id}','normal')">🟡</button>
           <button ${btnStyle(e.priority==='low'?'#052e16':'#1a1a1a', e.priority==='low'?'#22c55e':'#666')} onclick="execSetPriority('${e.id}','low')">🟢</button>
         </div>`
      : '';

    const ctrlRow = (ctrlBtns.length > 0 || priCtrl)
      ? `<div style="margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,0.05);">
           ${priCtrl}
           <div data-exec-actions style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;">${ctrlBtns.join('')}</div>
         </div>`
      : '';

    return `<div
      id="eBubble-${e.id}"
      class="msg-bubble-anim"
      style="margin-bottom:10px;opacity:${['sent-back','cancelled'].includes(e.status) ? 0.7 : 1};transition:all 0.35s;"
    >
      <div data-exec-status style="font-size:10px;color:${color};margin-bottom:3px;font-weight:700;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:3px;">
        <span>${icon} ${escapeHtml(label)}</span>
        <div style="display:flex;align-items:center;gap:5px;">${priBadge} ${slaHtml} ${_execStatusBadge(e.status)}</div>
      </div>
      ${slaBarHtml}
      <div style="background:${bgCard};border:1px solid ${borderClr};border-radius:0 12px 12px 12px;padding:10px 12px;word-break:break-word;transition:all 0.35s;">
        ${dupWarning}
        <div style="font-size:11px;color:#8696a0;margin-bottom:5px">${escapeHtml(e.name)}</div>
        <div style="font-size:13px;color:#e9edef;direction:rtl;line-height:1.5;margin-bottom:6px">
          "تنفيذ: <b style="color:#e8c04a">${escapeHtml(e.name)}</b>"
        </div>
        ${walletHtml}
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:900;color:#e8c04a;font-size:14px">${Number(e.amount).toLocaleString()} <span style="font-size:11px;color:#32b8c6">${e.currency}</span></span>
          <span style="font-size:10px;color:#8696a0">${e.time} ${ticks}</span>
        </div>
        <div style="margin-top:5px;font-size:10px;color:#8696a0;">
          <span>${e.code}</span>
        </div>
        ${ctrlRow}
      </div>
    </div>`;
  }).join('');

  // Scroll to top so newest entry (at top after sort) is always visible
  requestAnimationFrame(() => { list.scrollTop = 0; });
}

// ========== FILTER EXEC ==========
function filterExec(agent, el) {
  currentExecFilter = agent;
  _execSearchQuery  = '';
  const si = document.getElementById('execSearch');
  if (si) si.value = '';
  ['etab-all','etab-barhoum','etab-agent2','etab-agent3'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('active');
  });
  if (el) el.classList.add('active');
  renderExecBubbles();
}

const searchExecBubbles = debounce((q) => {
  _execSearchQuery = q.trim();
  renderExecBubbles();
}, 200);

function execChatClear() {
  execTransfers = [];
  _saveExecTransfers();
  renderExecBubbles();
  showToast('تم مسح قائمة التنفيذ', 'info');
}

// ========== STATS ==========
function computeStats() {
  // ── تم التنفيذ: كل حوالة وصلت للسجل (transferHistory) ──
  const done = transferHistory.length;

  // ── قيد التنفيذ: ما هو نشط حالياً في لوحة حوالات التنفيذ ──
  const activeExec = execTransfers.filter(
    e => ['waiting', 'executed', 'reassigned'].includes(e.status)
  ).length;

  // ── جديدة: رسائل المصدر التي لم تُعالج بعد ──
  const newT = transfers.filter(t => t.status === 'new').length;

  // ── إجمالي اليوم: كل ما تم استقباله (منجز + نشط في المسار) ──
  const total = done + transfers.length;

  _animateCounter('stat-done',    done);
  _animateCounter('stat-pending', activeExec);
  _animateCounter('stat-new',     newT);
  _animateCounter('stat-total',   total);
}

const _counterTimers = {};
function _animateCounter(id, to) {
  const el = document.getElementById(id);
  if (!el) return;
  // Cancel any running animation for this element
  if (_counterTimers[id]) { clearInterval(_counterTimers[id]); delete _counterTimers[id]; }
  const from  = parseInt(el.textContent) || 0;
  if (from === to) { el.textContent = to; return; }
  const step  = to > from ? 1 : -1;
  const steps = Math.abs(to - from);
  const delay = Math.max(20, Math.min(80, 400 / steps));
  let cur = from;
  _counterTimers[id] = setInterval(() => {
    cur += step;
    el.textContent = cur;
    if (cur === to) { clearInterval(_counterTimers[id]); delete _counterTimers[id]; }
  }, delay);
}

// ========== CLOCK ==========
function updateClock() {
  const now    = new Date();
  const timeEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('ar-EG-u-nu-latn', { hour12: false });
  if (dateEl) dateEl.textContent = now.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
updateClock();
setInterval(updateClock, 1000);

// ========== SYNC PANEL HEIGHTS ==========
function syncPanelHeights() {
  const center = document.querySelector('.panel-center');
  const left   = document.querySelector('.panel-left');
  const right  = document.querySelector('.panel-right');
  if (!center || !left || !right) return;
  const h = center.offsetHeight;
  if (h > 0) {
    left.style.height  = h + 'px';
    right.style.height = h + 'px';
  }
}
window.addEventListener('load',   syncPanelHeights);
window.addEventListener('resize', debounce(syncPanelHeights, 120));

// ========== INIT ==========
// Seed from initial executions:
//   - sent-back / cancelled  → transferHistory (completed log)
//   - everything else        → execTransfers   (active exec panel)
executions.forEach(e => {
  const mapped = {
    id:              e.id,
    agent:           e.agent,
    name:            e.name,
    amount:          e.amount,
    currency:        e.currency,
    code:            e.code,
    agentName:       e.agentName || _agentNames[e.agent] || e.agent,
    status:          e.status,
    priority:        'normal',
    time:            e.time || '--',
    createdAt:       Date.now() - Math.floor(Math.random() * 15 * 60 * 1000),
    source:          e.source || '',
    sourceTransferId: null,
    isDuplicate:     false,
  };
  if (e.status === 'sent-back' || e.status === 'cancelled') {
    transferHistory.push(mapped); // already done — goes to log
  } else {
    execTransfers.push(mapped);   // active — show in exec panel
  }
});

// ── Restore execTransfers from localStorage (overrides seed data) ──
(function _loadExecTransfers() {
  try {
    const saved = JSON.parse(localStorage.getItem('execTransfers') || '[]');
    if (Array.isArray(saved) && saved.length > 0) {
      execTransfers.length = 0;
      saved.forEach(e => execTransfers.push(e));
    }
  } catch (_) { /* keep seed data */ }
})();

// ── Restore transferHistory from localStorage (overrides seed data) ──
(function _loadTransferHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem('transferHistory') || '[]');
    if (Array.isArray(saved) && saved.length > 0) {
      transferHistory.length = 0;
      saved.forEach(e => transferHistory.push(e));
    }
  } catch (_) { /* keep seed data */ }
})();

renderTransfers(true);
renderExecutions();
renderHistory();
computeStats();
_updateFormModeStrip();
// Run after browser has painted
requestAnimationFrame(() => requestAnimationFrame(syncPanelHeights));

// الرسائل تأتي من واتساب الحقيقي عبر wa-bridge.js فقط

// ========== RECEIPT POLLING — كشف الإيصالات الواردة ==========
const _seenReceiptCodes = new Set();  // أكواد شاهدناها مسبقاً

async function _pollReceipts() {
  try {
    const r = await fetch('/api/wa/receipts/new/');
    const d = await r.json();
    if (!d.ok || !d.receipts) return;

    for (const receipt of d.receipts) {
      if (_seenReceiptCodes.has(receipt.code)) continue;
      _seenReceiptCodes.add(receipt.code);
      _showReceiptNotification(receipt);
    }
  } catch(e) { /* البوت غير متصل */ }
}

function _showReceiptNotification(receipt) {
  const code    = receipt.code;
  const sender  = receipt.senderName || 'مجهول';
  const hasImg  = receipt.hasImage;
  const imgUrl  = receipt.receiptImageUrl || '';

  // اعثر على الحوالة في سجل الحوالات وأضف الإيصال عليها
  const histEntry = transferHistory.find(h =>
    (h.code || '').toUpperCase() === code.toUpperCase()
  );
  if (histEntry) {
    histEntry.receipt         = receipt.receipt || histEntry.receipt || '';
    histEntry.receiptImageUrl = imgUrl;
    renderHistory();
  }

  // أضف badge على بطاقة الحوالة في القائمة اليسرى إن وجدت
  const t = transfers.find(x =>
    (x.secCode || x.code || '').toString().toUpperCase() === code.toUpperCase()
  );
  if (t) {
    const itemEl = document.getElementById('tItem-' + t.id);
    if (itemEl && !itemEl.querySelector('[data-receipt-badge]')) {
      const badge = document.createElement('div');
      badge.setAttribute('data-receipt-badge', '1');
      badge.style.cssText = `margin-top:6px;padding:5px 10px;border-radius:8px;
        background:rgba(37,211,102,0.12);border:1px solid rgba(37,211,102,0.3);
        font-size:10px;font-weight:700;color:#25D366;
        display:flex;align-items:center;gap:6px;cursor:pointer;`;
      badge.innerHTML = `
        ${imgUrl ? `<img src="${imgUrl}" style="width:28px;height:28px;object-fit:cover;border-radius:5px;">` : `<span style="font-size:13px;">🧾</span>`}
        <span>إيصال وصل من ${sender.replace(/</g,'&lt;')}</span>
      `;
      badge.onclick = () => _openReceiptViewer({ code, receipt: receipt.receipt, receiptImageUrl: imgUrl, senderName: sender });
      itemEl.appendChild(badge);
    }
  }

  showToast(`إيصال وصل للكود ${code} — من: ${sender}`, 'success');
  try { new Audio('/static/sounds/ding.mp3').play().catch(()=>{}); } catch(e) {}

  // افتح النافذة تلقائياً فور وصول الإيصال
  _openReceiptViewer({ code, receipt: receipt.receipt, receiptImageUrl: imgUrl, senderName: sender });
}

// ── عارض الإيصال — نافذة ثابتة بدون تغبيش ──────────────────────────────────
function _openReceiptViewer(h) {
  const imgUrl = h.receiptImageUrl || '';
  const code   = h.code || '';
  const sender = h.senderName || '';
  const txt    = h.receipt || '';

  let existing = document.getElementById('receiptViewerPanel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'receiptViewerPanel';
  panel.style.cssText = `
    position:fixed;
    bottom:16px;
    right:16px;
    width:300px;
    max-height:480px;
    z-index:9999;
    display:flex;
    flex-direction:column;
    background:linear-gradient(145deg,#0d1b26,#091420);
    border:1px solid rgba(37,211,102,0.35);
    border-radius:16px;
    overflow:hidden;
    box-shadow:0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(37,211,102,0.1);
    animation:receiptSlideUp 0.3s cubic-bezier(.34,1.56,.64,1);
  `;

  panel.innerHTML = `
    <style>
      @keyframes receiptSlideUp {
        from { opacity:0; transform:translateY(20px) scale(.97); }
        to   { opacity:1; transform:translateY(0) scale(1); }
      }
    </style>
    <!-- رأس -->
    <div style="padding:10px 12px;background:rgba(37,211,102,0.08);border-bottom:1px solid rgba(37,211,102,0.15);
                display:flex;align-items:center;gap:8px;flex-shrink:0;">
      <div style="width:28px;height:28px;border-radius:8px;background:rgba(37,211,102,0.15);
                  border:1px solid rgba(37,211,102,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:700;color:#25D366;">إيصال وصل</div>
        <div style="font-size:9px;color:#4d8060;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${code ? `كود: <span style="color:#a7f3c0;font-weight:700;">${escapeHtml(code)}</span>` : ''}
          ${sender ? ` · ${escapeHtml(sender)}` : ''}
        </div>
      </div>
      <button onclick="document.getElementById('receiptViewerPanel').remove()"
        style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:6px;
               color:#4d6080;cursor:pointer;width:24px;height:24px;font-size:13px;display:flex;
               align-items:center;justify-content:center;flex-shrink:0;transition:color .2s;"
        onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='#4d6080'">✕</button>
    </div>
    <!-- صورة -->
    <div style="flex:1;overflow-y:auto;padding:10px;">
      ${imgUrl
        ? `<img src="${imgUrl}" alt="إيصال"
             style="width:100%;border-radius:10px;border:1px solid rgba(37,211,102,0.2);
                    cursor:zoom-in;display:block;"
             onclick="window.open('${imgUrl}','_blank')"
             title="اضغط للعرض الكامل">`
        : ''
      }
      ${txt && txt !== '📎 إيصال'
        ? `<div style="margin-top:${imgUrl?'8px':'0'};background:rgba(255,255,255,0.03);
                       border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:8px;
                       font-size:11px;color:#c9d1de;line-height:1.6;white-space:pre-wrap;">
             ${escapeHtml(txt)}</div>`
        : ''
      }
    </div>
    <!-- أزرار -->
    ${imgUrl ? `
    <div style="padding:8px 10px;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:6px;flex-shrink:0;">
      <a href="${imgUrl}" download target="_blank"
         style="flex:1;text-align:center;padding:6px;border-radius:8px;
                background:rgba(37,211,102,0.1);color:#25D366;border:1px solid rgba(37,211,102,0.2);
                font-size:10px;font-weight:700;text-decoration:none;">تحميل</a>
      <button onclick="window.open('${imgUrl}','_blank')"
         style="flex:1;padding:6px;border-radius:8px;background:rgba(50,184,198,0.08);
                color:#32b8c6;border:1px solid rgba(50,184,198,0.2);font-size:10px;font-weight:700;cursor:pointer;">
        تكبير</button>
    </div>` : ''}
  `;

  document.body.appendChild(panel);
}

// فحص كل 5 ثوانٍ
setInterval(_pollReceipts, 5000);
_pollReceipts();

// ========== USER DISPLAY ==========
(function () {
  try {
    const u  = (window._currentUser || {});
    const el = document.getElementById('userDisplayName');
    const rl = document.getElementById('userDisplayRole');
    if (u.username && el) el.textContent = u.username;
    if (u.roleName  && rl) rl.textContent = u.roleName || u.role;
  } catch (e) {}
})();


/* ══════════════════════════════════════════════════
   CLIENTS & AGENTS SYNC — ربط العملاء والوكلاء
   Reads intl_clients / intl_agents from localStorage
   and applies them to the running transactions page
══════════════════════════════════════════════════ */

function _renderSrcAgentSelector(agents) {
  const sel = document.getElementById('groupSelector');
  const hint = document.getElementById('wa-no-agents-hint');
  const badge = document.getElementById('wa-agents-count');
  if (!sel) return;

  // امسح القائمة القديمة وابق فقط العناصر غير الديناميكية
  Array.from(sel.querySelectorAll('[data-dynamic-agent]')).forEach(el => el.remove());
  if (hint) hint.remove();

  if (!agents || agents.length === 0) {
    sel.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#4d6080;font-size:11px;padding:14px;">لا يوجد وكلاء نشطون — أضف وكيلاً من صفحة المشرف</div>';
    if (badge) badge.textContent = '0 وكلاء';
    return;
  }

  if (badge) badge.textContent = agents.length + ' وكيل';

  agents.forEach(a => {
    const key = a.responsible || ('agt' + a.id);
    const hasWA = !!a.whatsappNumber;
    const div = document.createElement('div');
    div.className = 'msg-group-btn';
    div.dataset.dynamicAgent = '1';
    div.dataset.agentKey = key;
    div.dataset.whatsapp = a.whatsappNumber || '';
    div.dataset.group = key;
    div.dataset.agentName = a.name;
    div.onclick = () => selectMsgGroup(div, key);
    div.style.cssText = 'display:flex;align-items:center;gap:9px;padding:10px 12px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.09);border-radius:13px;cursor:pointer;transition:all .22s;';
    div.innerHTML = `
      <div style="position:relative;flex-shrink:0;">
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,${a.color||'#32b8c6'},${a.color||'#32b8c6'}88);display:flex;align-items:center;justify-content:center;font-size:16px;">${a.icon||'🤝'}</div>
        <div style="position:absolute;bottom:0;right:0;width:9px;height:9px;border-radius:50%;background:${hasWA?'#25D366':'#f59e0b'};border:2px solid #0a1410;" title="${hasWA?'واتساب متاح':'لا يوجد رقم واتساب'}"></div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#e9edef;" data-name="${a.name}">${a.name}</div>
        <div style="font-size:9px;color:${hasWA?'#25D366':'#f59e0b'};">${hasWA?'واتساب متاح':'لا يوجد رقم'}</div>
      </div>
    `;
    sel.appendChild(div);
  });
}

function _renderExecAgentSelector(agents) {
  const sel = document.getElementById('execAgentSelector');
  const hint = document.getElementById('wa-no-exec-agents-hint');
  const badge = document.getElementById('wa-exec-agents-count');
  if (!sel) return;

  Array.from(sel.querySelectorAll('[data-dynamic-exec-agent]')).forEach(el => el.remove());
  if (hint) hint.remove();

  if (!agents || agents.length === 0) {
    sel.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#4d6080;font-size:11px;padding:14px;">لا يوجد وكلاء نشطون — أضف وكيلاً من صفحة المشرف</div>';
    if (badge) badge.textContent = '0 وكلاء';
    return;
  }

  if (badge) badge.textContent = agents.length + ' وكيل';

  agents.forEach(a => {
    const key = a.responsible || ('agt' + a.id);
    const hasWA = !!a.whatsappNumber;
    const div = document.createElement('div');
    div.className = 'exec-agent-btn';
    div.dataset.dynamicExecAgent = '1';
    div.dataset.agent = key;
    div.dataset.whatsapp = a.whatsappNumber || '';
    div.dataset.agentName = a.name;
    div.onclick = () => selectExecAgent(div, key);
    div.style.cssText = 'display:flex;align-items:center;gap:9px;padding:10px 12px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.09);border-radius:13px;cursor:pointer;transition:all .22s;';
    div.innerHTML = `
      <div style="position:relative;flex-shrink:0;">
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,${a.color||'#32b8c6'},${a.color||'#32b8c6'}88);display:flex;align-items:center;justify-content:center;font-size:16px;">${a.icon||'🤝'}</div>
        <div style="position:absolute;bottom:0;right:0;width:9px;height:9px;border-radius:50%;background:${hasWA?'#25D366':'#f59e0b'};border:2px solid #09141f;" title="${hasWA?'واتساب متاح':'لا يوجد رقم واتساب'}"></div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:#e9edef;" data-name="${a.name}">${a.name}</div>
        <div style="font-size:9px;color:${hasWA?'#25D366':'#f59e0b'};">${hasWA?'واتساب متاح':'لا يوجد رقم'}</div>
      </div>
    `;
    sel.appendChild(div);
  });
}

async function _syncClientsAgents() {
  try {
    // ── 1. Sync Agents من قاعدة البيانات مباشرة ──
    const r = await fetch('/api/ts/agents/');
    const d = await r.json();
    if (d.success && d.agents) {
      const agents = d.agents;
      agents.forEach(a => {
        const key = a.responsible || ('agt' + a.id);
        if (typeof _agentNames  !== 'undefined') _agentNames[key]  = a.name;
        if (typeof _agentColors !== 'undefined') _agentColors[key] = a.color;
        if (typeof _agentIcons  !== 'undefined') _agentIcons[key]  = a.icon;
      });
      // Refresh agent select dropdowns
      const activeAgents = agents.filter(a => a.status === 'active');

      ['agent', 'execAgent'].forEach(selId => {
        const agentSel = document.getElementById(selId);
        if (!agentSel) return;
        Array.from(agentSel.options).forEach(opt => {
          if (opt.dataset.fromSupervisor) opt.remove();
        });
        activeAgents.forEach(a => {
          const key = a.responsible || ('agt' + a.id);
          if (!Array.from(agentSel.options).some(o => o.value === key)) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = a.name + (a.currencies && a.currencies.length ? ' (' + a.currencies.join('/') + ')' : '');
            opt.dataset.fromSupervisor = '1';
            opt.dataset.whatsapp  = a.whatsappNumber || '';
            opt.dataset.agentDbId = a.id;
            agentSel.appendChild(opt);
          }
        });
      });

      // ── ملء قائمة "الوكيل المستهدف" في panel الإرسال (مراسلة المصدر + مراسلة المنفذ) ──
      _renderSrcAgentSelector(activeAgents);
      _renderExecAgentSelector(activeAgents);
    }

    // ── 2. Sync Clients → update group labels in UI ──
    const rawClients = localStorage.getItem('intl_clients');
    if (rawClients) {
      const clients = JSON.parse(rawClients);
      clients.forEach(c => {
        const tabEl = document.querySelector('[data-group="' + c.key + '"]');
        if (tabEl) tabEl.textContent = c.name;
      });
    }
  } catch(e) { console.warn('_syncClientsAgents error:', e); }
}

/* Listen for supervisor updates */
window.addEventListener('storage', function(e) {
  if (e.key === 'intl_agents' || e.key === 'intl_clients') {
    _syncClientsAgents();
    if (typeof showToast === 'function') {
      const label = e.key === 'intl_agents' ? 'الوكلاء' : 'مجموعات العملاء';
      showToast('تم تحديث ' + label + ' من المشرف', 'info');
    }
  }
});

document.addEventListener('DOMContentLoaded', function() {
  _syncClientsAgents();
  // جلب الحوالات والوكلاء من الخادم
  if (typeof initTransactions === 'function') initTransactions();
});

// ══════ رفع التقرير — قسم الحوالات ══════
let _trxRptFileData=null,_trxRptFileMeta=null;
const _TRX_RPT_EMOJIS={pdf:'📄',excel:'📊',word:'📝',image:'🖼️',other:'📁'};
const _TRX_RPT_MIME={'application/pdf':'pdf','application/vnd.ms-excel':'excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'excel','application/msword':'word','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'word','image/png':'image','image/jpeg':'image','image/jpg':'image','image/gif':'image','image/webp':'image'};
function _trxRptFmtSz(b){if(b<1024)return b+' B';if(b<1048576)return (b/1024).toFixed(1)+' KB';return (b/1048576).toFixed(1)+' MB';}
function _trxRptType(m,n){if(_TRX_RPT_MIME[m])return _TRX_RPT_MIME[m];const e=(n||'').split('.').pop().toLowerCase();if(e==='pdf')return 'pdf';if(['xls','xlsx','csv'].includes(e))return 'excel';if(['doc','docx'].includes(e))return 'word';if(['png','jpg','jpeg','gif','webp'].includes(e))return 'image';return 'other';}
function trxRptClearFile(){_trxRptFileData=null;_trxRptFileMeta=null;const i=document.getElementById('trxRptFileInput');if(i)i.value='';const _p=document.getElementById('trxRptFilePreview');const _dz=document.getElementById('trxRptDropZone');if(_p)_p.style.display='none';if(_dz)_dz.style.display='';}
function _trxRptShowPreview(n,s,t){document.getElementById('trxRptFileIcon').textContent=_TRX_RPT_EMOJIS[t]||'📁';document.getElementById('trxRptFileNameDisplay').textContent=n;document.getElementById('trxRptFileSizeDisplay').textContent=_trxRptFmtSz(s);document.getElementById('trxRptDropZone').style.display='none';document.getElementById('trxRptFilePreview').style.display='flex';}
function _trxRptRead(file){if(file.size>10*1024*1024){showToast('حجم الملف يتجاوز 10 MB','warning');return;}const t=_trxRptType(file.type,file.name);_trxRptFileMeta={name:file.name,size:file.size,type:t};_trxRptShowPreview(file.name,file.size,t);const r=new FileReader();r.onload=ev=>{_trxRptFileData=ev.target.result;};r.readAsDataURL(file);}
function trxRptFileChosen(i){if(i.files&&i.files[0])_trxRptRead(i.files[0]);}
function trxRptFileDrop(e){const f=e.dataTransfer.files;if(f&&f[0])_trxRptRead(f[0]);}
function trxOpenReportModal(){const overlay=document.getElementById('trxReportOverlay');if(!overlay)return;try{_trxRptFileData=null;_trxRptFileMeta=null;const t=document.getElementById('trxRptTitle');if(t)t.value='';trxRptClearFile();}catch(e){}try{const u=(window._currentUser||{});const el=document.getElementById('trxRptSenderDisplay');if(el&&u.username)el.textContent=u.username;}catch(e){}overlay.style.display='flex';}
function trxCloseReportModal(){document.getElementById('trxReportOverlay').style.display='none';}
function trxSubmitReport(){const title=(document.getElementById('trxRptTitle').value||'').trim();if(!title){showToast('يرجى إدخال عنوان التقرير','warning');return;}if(!_trxRptFileData||!_trxRptFileMeta){showToast('يرجى اختيار ملف للرفع','warning');return;}let sender='موظف الحوالات';try{const u=(window._currentUser||{});if(u.username)sender=u.username;}catch(e){}const now=new Date();const p=n=>String(n).padStart(2,'0');const date=now.getFullYear()+'-'+p(now.getMonth()+1)+'-'+p(now.getDate())+' '+p(now.getHours())+':'+p(now.getMinutes());const obj={source:'transfers',title,fileName:_trxRptFileMeta.name,fileType:_trxRptFileMeta.type,fileSize:_trxRptFmtSz(_trxRptFileMeta.size),fileData:_trxRptFileData,sender,department:'قسم الحوالات',branch:'الفرع الرئيسي',branchId:1,date};try{const ex=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');ex.unshift(obj);localStorage.setItem('intl_admin_reports',JSON.stringify(ex));}catch(err){try{obj.fileData=null;const ex2=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');ex2.unshift(obj);localStorage.setItem('intl_admin_reports',JSON.stringify(ex2));}catch(e){}}trxCloseReportModal();showToast('تم إرسال الملف "'+_trxRptFileMeta.name+'" للإدارة بنجاح','success');}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('trxReportOverlay').style.display==='flex')trxCloseReportModal();});
