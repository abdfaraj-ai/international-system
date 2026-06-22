/* ══════════════════════════════════════════════
   accounts_panel.js  —  درج إدارة الحسابات (مضمّن في كل صفحة)
   ══════════════════════════════════════════════ */

// ══ الآلة الحاسبة ══
let _apCalcExpr = '', _apCalcResult = '0', _apCalcJustEvaled = false;

function _apCalcRender() {
  const disp = document.getElementById('ap-calc-display');
  const expr = document.getElementById('ap-calc-expr');
  if (disp) {
    disp.textContent = _apCalcResult;
    disp.classList.toggle('zero', _apCalcResult === '0');
  }
  if (expr) expr.textContent = _apCalcExpr;
}

function apCalcInput(k) {
  const ops = ['+', '−', '×', '÷'];
  if (k === 'AC') {
    _apCalcExpr = ''; _apCalcResult = '0'; _apCalcJustEvaled = false;
  } else if (k === '←') {
    if (_apCalcJustEvaled) { _apCalcExpr = ''; _apCalcResult = '0'; _apCalcJustEvaled = false; }
    else { _apCalcResult = _apCalcResult.length > 1 ? _apCalcResult.slice(0,-1) : '0'; }
  } else if (k === '%') {
    const v = parseFloat(_apCalcResult);
    if (!isNaN(v)) { _apCalcResult = String(v / 100); _apCalcJustEvaled = true; }
  } else if (ops.includes(k)) {
    if (_apCalcJustEvaled) { _apCalcExpr = _apCalcResult + ' ' + k + ' '; _apCalcJustEvaled = false; }
    else if (_apCalcExpr && ops.includes(_apCalcExpr.trim().slice(-1))) {
      _apCalcExpr = _apCalcExpr.trim().slice(0,-1).trimEnd() + ' ' + k + ' ';
    } else {
      _apCalcExpr += (_apCalcResult === '0' && !_apCalcExpr ? '' : _apCalcResult) + ' ' + k + ' ';
    }
    _apCalcResult = '0'; _apCalcJustEvaled = false;
  } else if (k === '=') {
    try {
      const expr = _apCalcExpr + _apCalcResult;
      const safe = expr.replace(/÷/g,'/').replace(/×/g,'*').replace(/−/g,'-');
      const res = Function('"use strict";return (' + safe + ')')();
      _apCalcExpr = expr + ' =';
      _apCalcResult = isFinite(res) ? String(+res.toFixed(8)) : 'خطأ';
      _apCalcJustEvaled = true;
    } catch { _apCalcResult = 'خطأ'; }
  } else if (k === '.') {
    if (_apCalcJustEvaled) { _apCalcResult = '0.'; _apCalcJustEvaled = false; }
    else if (!_apCalcResult.includes('.')) _apCalcResult += '.';
  } else {
    if (_apCalcJustEvaled || _apCalcResult === '0') { _apCalcResult = k; _apCalcJustEvaled = false; }
    else _apCalcResult += k;
  }
  _apCalcRender();
}

function apCalcClear() {
  _apCalcExpr = ''; _apCalcResult = '0'; _apCalcJustEvaled = false;
  _apCalcRender();
}

function apCalcTransfer() {
  const val = _apCalcResult;
  if (!val || val === '0' || val === 'خطأ') { apNotify('لا توجد قيمة لنقلها', 'warning'); return; }
  // ابحث عن أول حقل مبلغ مرئي في الأداة النشطة
  const amtFields = [
    'ap-nm-send-amt','ap-nm-recv-amt',
    'ap-ex-amt1',
    'ap-cut-buy-amt','ap-cut-sell-amt',
    'ap-adv-from-amount',
    'ap-entr-from-amount',
  ];
  const pane = document.querySelector('#ap-content > div:not([style*="display:none"]):not(.ap-placeholder)');
  let transferred = false;
  if (pane) {
    const field = pane.querySelector('input[type="number"]');
    if (field && !field.readOnly) {
      field.value = val;
      field.dispatchEvent(new Event('input', {bubbles:true}));
      apNotify('تم نقل ' + val, 'success');
      transferred = true;
    }
  }
  if (!transferred) {
    for (const id of amtFields) {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null && !el.readOnly) {
        el.value = val;
        el.dispatchEvent(new Event('input', {bubbles:true}));
        apNotify('تم نقل ' + val, 'success');
        transferred = true;
        break;
      }
    }
  }
  if (!transferred) apNotify('اختر أداة أولاً ثم انقل القيمة', 'info');
}

// ══ سجل العمليات ══
const _apLog = [];

function apLogAdd(entry) {
  const now = new Date();
  const time = now.toLocaleTimeString('ar', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  _apLog.unshift({ time, ...entry });
  if (_apLog.length > 50) _apLog.pop();
  _apLogRender();
}

function _apLogRender() {
  const tbody = document.getElementById('ap-log-tbody');
  const count = document.getElementById('ap-log-count');
  if (!tbody) return;
  if (count) count.textContent = _apLog.length;
  if (!_apLog.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="ap-log-empty">لا توجد عمليات بعد</td></tr>';
    return;
  }
  const typeColors = {
    'حوالة':'#60a5fa','تبديل عملات':'#34d399','قص وإغلاق':'#22d3ee',
    'قيد جديد':'#f87171','قيد متقدم':'#f472b6','قيد تسوية':'#a78bfa',
  };
  tbody.innerHTML = _apLog.map(r => {
    const tc = typeColors[r.type] || '#8696a0';
    const sc = r.status === 'success' ? '#4ade80' : '#f87171';
    return `<tr>
      <td style="color:#4a6280;">${r.time}</td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${tc}22;color:${tc};">${r.type}</span></td>
      <td style="color:#e9edef;font-weight:700;">${r.amount || '—'}</td>
      <td style="color:#4a6280;">${r.currency || '—'}</td>
      <td style="color:#8696a0;font-size:10px;font-family:monospace;">${r.ref || '—'}</td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:10px;background:${sc}22;color:${sc};">${r.status === 'success' ? 'تم' : 'خطأ'}</span></td>
    </tr>`;
  }).join('');
}

function apLogClear() {
  _apLog.length = 0;
  _apLogRender();
}

// ══ إشعارات ══
function apNotify(msg, type = 'info') {
  // استخدم showNotification الموجودة في الصفحة إن وُجدت
  if (typeof showNotification === 'function') { showNotification(msg, type); return; }
  if (typeof showToast === 'function')        { showToast(msg, type);        return; }
  const colors = { success:'#00c97a', error:'#ff4d6a', warning:'#f59e0b', info:'#3b82f6' };
  let n = document.getElementById('ap-notify-toast');
  if (!n) {
    n = document.createElement('div');
    n.id = 'ap-notify-toast';
    document.body.appendChild(n);
  }
  n.textContent = msg;
  n.style.cssText = `display:block;position:fixed;top:20px;left:50%;transform:translateX(-50%);
    background:${colors[type]||colors.info};color:#fff;padding:12px 24px;
    border-radius:10px;font-size:13px;font-weight:700;z-index:9999;
    box-shadow:0 6px 20px rgba(0,0,0,0.4);`;
  clearTimeout(n._t);
  n._t = setTimeout(() => { n.style.display = 'none'; }, 3000);
}

// ══════════════════════════════════════════════════════════════════
//  لوحة واتساب المدمجة — تعمل فقط في صفحة الحوالات
//  (_waApEnabled = true يُضبط في transactions.html)
// ══════════════════════════════════════════════════════════════════

const _apWa = {
  msgs:        [],   // كل الرسائل المعروضة
  filter:      'all',// jid المجموعة النشطة أو 'all'
  searchQ:     '',
  _pollTimer:  null,
  _syncTimer:  null,
};

/* تهيئة اللوحة — تُستدعى من transactions.html بعد تحميل wa-bridge.js */
function apWaInit() {
  if (!window._waApEnabled) return;

  // أضف class wa-enabled على ap-body لتوسيع الشبكة
  const body = document.querySelector('.ap-body');
  if (body) body.classList.add('wa-enabled');

  // مزامنة حالة الاتصال من wa-bridge كل 2 ثانية
  _apWa._syncTimer = setInterval(_apWaSyncStatus, 2000);
  _apWaSyncStatus();

  // مزامنة الرسائل من _cachedMessages كل 3 ثوانٍ
  _apWa._pollTimer = setInterval(_apWaSyncMsgs, 3000);
  _apWaSyncMsgs();

  console.log('📱 ap-wa: لوحة الواتساب مُفعَّلة');
}

/* مزامنة حالة الاتصال */
function _apWaSyncStatus() {
  const srcBadge = document.getElementById('wa-bridge-status');
  const myBadge  = document.getElementById('ap-wa-status-badge');
  if (!myBadge) return;
  const connected = srcBadge && srcBadge.textContent.includes('متصل') && !srcBadge.textContent.includes('غير');
  myBadge.textContent = connected ? '● متصل' : '● غير متصل';
  myBadge.className   = 'ap-wa-status ' + (connected ? 'on' : 'off');
}

/* مزامنة الرسائل من _cachedMessages التي يملأها wa-bridge */
function _apWaSyncMsgs() {
  const src = window._cachedMessages;
  if (!Array.isArray(src)) return;

  // أضف الرسائل الجديدة فقط
  let added = 0;
  src.forEach(msg => {
    if (_apWa.msgs.find(m => m.id === msg.id)) return;
    // صنّف الرسالة
    const cls = window._waBridgeClassify ? window._waBridgeClassify(msg.text) : 'hawala';
    if (cls === 'ignore') return;
    const parsed = window._waBridgeParseMsg ? window._waBridgeParseMsg(msg.text) : {};
    _apWa.msgs.unshift({ ...msg, _cls: cls, _parsed: parsed });
    added++;
  });

  if (added > 0) {
    _apWaRenderGroups();
    _apWaRenderList();
  }
}

/* تحديث تبويبات المجموعات */
function _apWaRenderGroups() {
  const container = document.getElementById('ap-wa-groups');
  if (!container) return;

  // اجمع المجموعات الفريدة
  const groups = {};
  _apWa.msgs.forEach(m => {
    if (m.jid && m.groupName) groups[m.jid] = m.groupName;
  });

  // احتفظ بزر "الكل" وأضف المجموعات الجديدة فقط
  Object.entries(groups).forEach(([jid, name]) => {
    if (container.querySelector(`[data-jid="${jid}"]`)) return;
    const btn = document.createElement('button');
    btn.className = 'ap-wa-grp-btn';
    btn.dataset.jid = jid;
    btn.textContent = name;
    btn.onclick = () => apWaFilterGroup(jid, btn);
    container.appendChild(btn);
  });
}

/* رسم قائمة الرسائل */
function _apWaRenderList() {
  const list = document.getElementById('ap-wa-list');
  if (!list) return;

  let msgs = _apWa.msgs;

  // فلتر المجموعة
  if (_apWa.filter !== 'all') {
    msgs = msgs.filter(m => m.jid === _apWa.filter);
  }

  // فلتر البحث
  if (_apWa.searchQ) {
    const q = _apWa.searchQ.toLowerCase();
    msgs = msgs.filter(m =>
      (m.text || '').toLowerCase().includes(q) ||
      (m.senderName || '').toLowerCase().includes(q) ||
      (m.groupName  || '').toLowerCase().includes(q)
    );
  }

  if (!msgs.length) {
    list.innerHTML = `
      <div class="ap-wa-empty">
        <div class="ap-wa-empty-icon">💬</div>
        لا توجد رسائل${_apWa.searchQ ? ' مطابقة للبحث' : ''}<br>
        <span style="font-size:10px;color:#112030;">ستظهر الحوالات الواردة هنا تلقائياً</span>
      </div>`;
    return;
  }

  // احتفظ بموضع التمرير
  const scrollTop = list.scrollTop;

  list.innerHTML = msgs.slice(0, 60).map(m => _apWaBuildCard(m)).join('');

  // استعد الموضع إذا لم يكن في الأعلى
  if (scrollTop > 10) list.scrollTop = scrollTop;
}

/* بناء HTML بطاقة رسالة واحدة */
function _apWaBuildCard(m) {
  const p       = m._parsed || {};
  const cls     = m._cls   || 'hawala';
  const timeStr = m.timestamp
    ? new Date(m.timestamp * 1000).toLocaleTimeString('ar', { hour:'2-digit', minute:'2-digit' })
    : '';
  const badge   = cls === 'hawala'
    ? '<span class="ap-wa-msg-badge hawala">حوالة</span>'
    : '<span class="ap-wa-msg-badge pending">انتظار</span>';

  // chips البيانات المستخرجة
  const chips = [];
  if (p.amount)   chips.push(`<span class="ap-wa-chip amount">${p.amount}</span>`);
  if (p.currency) chips.push(`<span class="ap-wa-chip cur">${p.currency}</span>`);
  if (p.name)     chips.push(`<span class="ap-wa-chip name">${_apWaEsc(p.name)}</span>`);
  if (p.phone)    chips.push(`<span class="ap-wa-chip phone" style="cursor:pointer;" onclick="apWaOpen('${p.phone}')" title="فتح واتساب">${p.phone} <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style="opacity:.7"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.549 4.099 1.512 5.826L0 24l6.335-1.486A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 01-5.012-1.375l-.36-.213-3.762.883.925-3.67-.234-.376A9.82 9.82 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg></span>`);

  const textPreview = _apWaEsc((m.text || '').slice(0, 140));
  const hasMore     = (m.text || '').length > 140;
  const safeId      = CSS.escape ? CSS.escape(m.id) : m.id;

  return `
  <div class="ap-wa-msg ${cls}" id="ap-wa-card-${_apWaEscAttr(m.id)}">
    <div class="ap-wa-msg-top">
      <span class="ap-wa-msg-sender">${_apWaEsc(m.senderName || 'مجهول')}</span>
      ${badge}
      <span class="ap-wa-msg-time">${timeStr}</span>
    </div>
    ${m.groupName ? `<div style="font-size:9px;color:#1a3040;margin:-2px 0 1px;">${_apWaEsc(m.groupName)}</div>` : ''}
    <div class="ap-wa-msg-text" id="ap-wa-txt-${_apWaEscAttr(m.id)}">${textPreview}${hasMore ? '<span style="color:#1e3050">…</span>' : ''}</div>
    ${chips.length ? `<div class="ap-wa-msg-parsed">${chips.join('')}</div>` : ''}
    <div class="ap-wa-msg-actions">
      <button class="ap-wa-use-btn" onclick="apWaFill('${_apWaEscAttr(m.id)}')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        استخدم في الأداة
      </button>
      ${p.phone ? `<button class="ap-wa-open-btn" onclick="apWaOpen('${_apWaEscAttr(p.phone)}')" title="فتح محادثة واتساب">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.549 4.099 1.512 5.826L0 24l6.335-1.486A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 01-5.012-1.375l-.36-.213-3.762.883.925-3.67-.234-.376A9.82 9.82 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
      </button>` : ''}
      ${hasMore ? `<button class="ap-wa-expand-btn" onclick="apWaExpand('${_apWaEscAttr(m.id)}')" title="توسيع">⇕</button>` : ''}
    </div>
  </div>`;
}

/* زر توسيع النص */
function apWaExpand(msgId) {
  const msg = _apWa.msgs.find(m => m.id === msgId);
  if (!msg) return;
  const el = document.getElementById('ap-wa-txt-' + msgId);
  if (!el) return;
  el.classList.toggle('expanded');
  if (el.classList.contains('expanded')) {
    el.innerHTML = _apWaEsc(msg.text || '');
  } else {
    el.innerHTML = _apWaEsc((msg.text || '').slice(0, 140)) + '<span style="color:#1e3050">…</span>';
  }
}

/* فلتر مجموعة */
function apWaFilterGroup(jid, btn) {
  _apWa.filter = jid;
  document.querySelectorAll('.ap-wa-grp-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _apWaRenderList();
}

/* بحث */
function apWaSearch(q) {
  _apWa.searchQ = q.trim();
  _apWaRenderList();
}

/* تحديث يدوي */
function apWaRefresh() {
  _apWaSyncStatus();
  _apWaSyncMsgs();
  apNotify('تم التحديث', 'info');
}

/* ══ تعبئة الأداة النشطة من رسالة واتساب ══ */
function apWaFill(msgId) {
  const msg = _apWa.msgs.find(m => m.id === msgId);
  if (!msg) { apNotify('الرسالة غير موجودة', 'error'); return; }

  const p = msg._parsed || {};

  // إذا لم تكن هناك أداة نشطة، افتح "حركة جديدة"
  if (!_apCurrent) {
    apSwitch('new-move');
    setTimeout(() => _apWaDoFill(p, msg), 80);
    return;
  }
  _apWaDoFill(p, msg);
}

function _apWaDoFill(p, msg) {
  const tool = _apCurrent;
  let filled  = [];

  /* ─ خريطة حقول كل أداة ─ */
  const fieldMap = {
    'new-move': [
      { id:'ap-nm-benef-name',  val: p.name,     label:'الاسم' },
      { id:'ap-nm-benef-phone', val: p.phone,    label:'الهاتف' },
      { id:'ap-nm-send-amt',    val: p.amount,   label:'المبلغ' },
      { id:'ap-nm-send-cur',    val: p.currency, label:'العملة', type:'select' },
    ],
    'adv-entry': [
      { id:'ap-adv-from-name',   val: p.name,    label:'المُرسِل' },
      { id:'ap-adv-from-amount', val: p.amount,  label:'المبلغ' },
      { id:'ap-adv-from-cur',    val: p.currency,label:'العملة', type:'select' },
    ],
    'entry': [
      { id:'ap-entr-from-amount', val: p.amount,  label:'المبلغ' },
      { id:'ap-entr-from-cur',    val: p.currency,label:'العملة', type:'select' },
    ],
    'exchange': [
      { id:'ap-ex-amt1',  val: p.amount,   label:'المبلغ' },
      { id:'ap-ex-cur1',  val: p.currency, label:'العملة', type:'select' },
    ],
    'settle': [],
  };

  const fields = fieldMap[tool] || fieldMap['new-move'];

  fields.forEach(f => {
    if (!f.val) return;
    const el = document.getElementById(f.id);
    if (!el) return;
    el.value = f.val;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    // تأثير بصري
    el.classList.add('ap-wa-filled');
    setTimeout(() => el.classList.remove('ap-wa-filled'), 800);
    filled.push(f.label);
  });

  if (filled.length) {
    apNotify('تم نقل: ' + filled.join(' · '), 'success');
    apLogAdd({
      type: 'واتساب → ' + (tool || 'أداة'),
      amount: p.amount || '—',
      currency: p.currency || '—',
      ref: msg.senderName || '—',
      status: 'success',
    });
  } else {
    apNotify('لم يُستخرج أي بيانات من هذه الرسالة', 'warning');
  }
}

/* ══ فتح محادثة واتساب من رقم هاتف ══ */
function apWaOpen(phone) {
  if (!phone) { apNotify('لا يوجد رقم هاتف', 'warning'); return; }
  // تنظيف الرقم — احذف كل ما ليس رقماً
  const clean = String(phone).replace(/[^0-9]/g, '');
  if (clean.length < 7) { apNotify('رقم الهاتف غير صالح', 'warning'); return; }
  window.open('https://wa.me/' + clean, '_blank', 'noopener,noreferrer');
}

/* زر واتساب بجانب حقل الهاتف — يُضاف ديناميكياً عند الكتابة */
function _apWaAttachPhoneBtn(inputId) {
  const inp = document.getElementById(inputId);
  if (!inp || inp._waBtn) return;
  inp._waBtn = true;

  // أنشئ الزر
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'فتح واتساب';
  btn.className = 'ap-wa-phone-btn';
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.549 4.099 1.512 5.826L0 24l6.335-1.486A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 01-5.012-1.375l-.36-.213-3.762.883.925-3.67-.234-.376A9.82 9.82 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>`;
  btn.onclick = () => apWaOpen(inp.value);

  // ضعه في wrapper مع الـ input
  const wrap = document.createElement('div');
  wrap.className = 'ap-wa-phone-wrap';
  inp.parentNode.insertBefore(wrap, inp);
  wrap.appendChild(inp);
  wrap.appendChild(btn);
}

/* مساعدات escape */
function _apWaEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _apWaEscAttr(s) {
  return String(s || '').replace(/'/g,"\\'").replace(/\n/g,' ').replace(/"/g,'&quot;');
}

// ══ CSRF Helper ══
function ap_getCsrf() {
  const m = document.cookie.match(/csrftoken=([^;]+)/);
  return m ? m[1] : '';
}

// ══ فتح وإغلاق الدرج ══
function apOpen() {
  var overlay = document.getElementById('ap-overlay');
  var drawer  = document.getElementById('ap-drawer');
  if (overlay && overlay.parentElement !== document.body) document.body.appendChild(overlay);
  if (drawer  && drawer.parentElement  !== document.body) document.body.appendChild(drawer);
  overlay.classList.add('open');
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/* فتح مباشر مع تفعيل أداة معينة — يُستخدم من صفحة الأقسام */
function apOpenSwitch(key) {
  apOpen();
  // تأخير بسيط لضمان ظهور الدرج قبل تشغيل apSwitch
  setTimeout(() => apSwitch(key), 60);
}

function apClose() {
  document.getElementById('ap-overlay').classList.remove('open');
  document.getElementById('ap-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

// إغلاق بمفتاح Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') apClose(); });

// ══ أداة التبديل المركزية ══
const _apPanes = {
  'entry':            'ap-pane-entry',
  'adv-entry':        'ap-pane-adv-entry',
  'unreceived':       'ap-pane-transfers',
  'received':         'ap-pane-transfers',
  'all':              'ap-pane-transfers',
  'statement':        'ap-pane-statement',
  'new-move':         'ap-pane-new-move',
  'exchange':         'ap-pane-exchange',
  'cut':              'ap-pane-cut',
  'settle':           'ap-pane-settle',
  'delivery-pending': 'ap-pane-delivery-pending',
  'delivery-done':    'ap-pane-delivery-done',
  'cut-voucher':      'ap-pane-cut-voucher',
};
let _apCurrent = null;
let _apTrType = 'all';

function apSwitch(key) {
  document.querySelectorAll('#ap-drawer .ap-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#ap-content > div').forEach(p => p.style.display = 'none');

  if (!key) {
    document.getElementById('ap-pane-none').style.display = '';
    _apCurrent = null;
    return;
  }

  const btn = document.getElementById('ap-btn-' + key);
  if (btn) btn.classList.add('active');

  const paneId = _apPanes[key] || 'ap-pane-none';
  document.getElementById(paneId).style.display = '';

  if (key === 'unreceived' || key === 'received' || key === 'all') {
    _apTrType = key;
    document.getElementById('ap-tr-status-filter').style.display = key === 'all' ? 'block' : 'none';
    ap_trFetch();
  }
  if (key === 'entry')     ap_entr_renderTemplates();
  if (key === 'adv-entry') ap_adv_calc();
  if (key === 'new-move')         { ap_nm_calc(); if (window._waApEnabled) _apWaAttachPhoneBtn('ap-nm-benef-phone'); }
  if (key === 'delivery-pending') ap_dp_fetch();
  if (key === 'delivery-done')    ap_dd_fetch();
  if (key === 'cut-voucher')      ap_cv_calc();
  if (key === 'exchange')  ap_ex_calc();
  if (key === 'cut')       ap_cut_calc();
  if (key === 'settle')    ap_stl_calc();

  _apCurrent = key;
  if (btn) btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}

// ══ قيد جديد ══
const _ap_entr_tpl = [
  { name:'حوالة خارجية', from_cur:'USD', to_cur:'JOD', dir:'mul', rate:'0.71' },
  { name:'حوالة داخلية', from_cur:'JOD', to_cur:'ILS', dir:'mul', rate:'5.1'  },
  { name:'تبديل عملة',   from_cur:'USD', to_cur:'TRY', dir:'mul', rate:'32.5' },
  { name:'قص وكيل',      from_cur:'USD', to_cur:'USD', dir:'mul', rate:'1'    },
  { name:'تحويل بنكي',   from_cur:'USD', to_cur:'USD', dir:'mul', rate:'1'    },
];

function ap_entr_renderTemplates() {
  const custom = JSON.parse(localStorage.getItem('entr_custom_tpl') || '[]');
  const all = [..._ap_entr_tpl, ...custom];
  document.getElementById('ap-entr-templates').innerHTML = all.map((t, i) =>
    `<button class="ap-tpl-btn" onclick="ap_entr_applyTpl(${i})">${t.name}</button>`
  ).join('');
}

function ap_entr_applyTpl(i) {
  const custom = JSON.parse(localStorage.getItem('entr_custom_tpl') || '[]');
  const t = [..._ap_entr_tpl, ...custom][i];
  if (!t) return;
  if (t.from_cur) document.getElementById('ap-entr-from-cur').value = t.from_cur;
  if (t.to_cur)   document.getElementById('ap-entr-to-cur').value   = t.to_cur;
  if (t.rate)     document.getElementById('ap-entr-cut-rate').value  = t.rate;
  if (t.dir)      document.getElementById('ap-entr-cut-dir').value   = t.dir;
  ap_entr_calc();
}

function ap_entr_calc() {
  const from = parseFloat(document.getElementById('ap-entr-from-amount').value) || 0;
  const rate  = parseFloat(document.getElementById('ap-entr-cut-rate').value)   || 1;
  const dir   = document.getElementById('ap-entr-cut-dir').value;
  const to    = dir === 'mul' ? from * rate : (rate > 0 ? from / rate : 0);
  document.getElementById('ap-entr-to-amount').value = to > 0 ? to.toFixed(4) : '';
  const profEl2 = document.getElementById('ap-entr-profit');
  if (profEl2) profEl2.textContent = Math.abs(from - to).toFixed(2);
}

function ap_entr_saveTemplate() {
  const name = prompt('اسم القالب الجديد:');
  if (!name) return;
  const custom = JSON.parse(localStorage.getItem('entr_custom_tpl') || '[]');
  custom.push({
    name,
    from_cur: document.getElementById('ap-entr-from-cur').value,
    to_cur:   document.getElementById('ap-entr-to-cur').value,
    rate:     document.getElementById('ap-entr-cut-rate').value,
    dir:      document.getElementById('ap-entr-cut-dir').value,
  });
  localStorage.setItem('entr_custom_tpl', JSON.stringify(custom));
  ap_entr_renderTemplates();
  apNotify('تم حفظ القالب', 'success');
}

function ap_entr_save() {
  const fromId  = document.getElementById('ap-entr-from-account')?.value;
  const toId    = document.getElementById('ap-entr-to-account')?.value;
  const amount  = parseFloat(document.getElementById('ap-entr-from-amount')?.value) || 0;
  const fromCur = document.getElementById('ap-entr-from-cur')?.value  || 'USD';
  const toCur   = document.getElementById('ap-entr-to-cur')?.value    || 'USD';
  const cutRate = parseFloat(document.getElementById('ap-entr-cut-rate')?.value) || 1;
  const cutDir  = document.getElementById('ap-entr-cut-dir')?.value   || 'mul';
  const notes   = document.getElementById('ap-entr-notes')?.value     || '';

  if (!fromId)     { apNotify('يرجى اختيار حساب المدين',  'error'); return; }
  if (!toId)       { apNotify('يرجى اختيار حساب الدائن',  'error'); return; }
  if (amount <= 0) { apNotify('يرجى إدخال المبلغ',        'error'); return; }

  fetch('/api/am/journal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': ap_getCsrf() },
    body: JSON.stringify({ fromAccountId: fromId, toAccountId: toId,
      amount, fromCurrency: fromCur, toCurrency: toCur,
      cutRate, cutDir, notes }),
  })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        apNotify('تم تنفيذ القيد ' + d.record.refNumber, 'success');
        apLogAdd({ type:'قيد جديد', amount: amount, currency: fromCur, ref: d.record.refNumber, status:'success' });
        ap_entr_reset();
      } else {
        apNotify(d.message || 'خطأ في الحفظ', 'error');
      }
    })
    .catch(() => apNotify('تعذّر الاتصال بالخادم', 'error'));
}

function ap_entr_reset() {
  ['ap-entr-from-account','ap-entr-to-account','ap-entr-from-amount','ap-entr-cut-rate','ap-entr-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ap_entr_calc();
}

// ══ قيد متقدم ══
function ap_adv_calc() {
  const fromAmt = parseFloat(document.getElementById('ap-adv-from-amount').value) || 0;
  const rate    = parseFloat(document.getElementById('ap-adv-cut-rate').value)    || 1;
  const dir     = document.getElementById('ap-adv-cut-dir').value;
  const fromFee = parseFloat(document.getElementById('ap-adv-from-fee').value)    || 0;
  const toFee   = parseFloat(document.getElementById('ap-adv-to-fee').value)      || 0;
  const fromCur = document.getElementById('ap-adv-from-cur').value || 'USD';
  const toCur   = document.getElementById('ap-adv-to-cur').value   || 'USD';

  const toAmt   = dir === 'mul' ? fromAmt * rate : (rate > 0 ? fromAmt / rate : 0);
  const cutDiff = fromAmt > 0 ? Math.abs(fromAmt - toAmt) : 0;
  const profit  = cutDiff + fromFee + toFee;
  const fmt     = (n, c) => n > 0 ? n.toLocaleString('ar', {maximumFractionDigits:2}) + ' ' + c : '—';

  document.getElementById('ap-adv-to-amount').value          = toAmt > 0 ? toAmt.toFixed(4) : '';
  document.getElementById('ap-adv-profit-bar').textContent   = fmt(profit, fromCur);
  document.getElementById('ap-adv-from-display').textContent = fmt(fromAmt, fromCur);
  document.getElementById('ap-adv-to-display').textContent   = fmt(toAmt, toCur);
  document.getElementById('ap-adv-cut-display').textContent  = rate > 0 ? (dir === 'mul' ? '×' : '÷') + ' ' + rate.toFixed(4) : '—';
}

function ap_adv_reset() {
  ['ap-adv-from-center','ap-adv-from-name','ap-adv-cut-rate','ap-adv-from-amount','ap-adv-from-fee','ap-adv-from-notes',
   'ap-adv-to-center','ap-adv-to-beneficiary','ap-adv-to-fee','ap-adv-to-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ap_adv_calc();
}

function ap_adv_save() {
  const fromCenter = (document.getElementById('ap-adv-from-center')?.value || '').trim();
  const toCenter   = (document.getElementById('ap-adv-to-center')?.value   || '').trim();
  const fromAmt    = parseFloat(document.getElementById('ap-adv-from-amount')?.value) || 0;

  if (!fromCenter) { apNotify('يرجى اختيار المركز المُرسل',  'error'); return; }
  if (!toCenter)   { apNotify('يرجى اختيار المركز المستلم',  'error'); return; }
  if (fromAmt <= 0){ apNotify('يرجى إدخال المبلغ المُرسَل',  'error'); return; }

  const payload = {
    fromCenter,
    fromName:      document.getElementById('ap-adv-from-name')?.value     || '',
    fromCurrency:  document.getElementById('ap-adv-from-cur')?.value      || 'USD',
    fromAmount:    fromAmt,
    fromFee:       parseFloat(document.getElementById('ap-adv-from-fee')?.value) || 0,
    fromFeeCur:    document.getElementById('ap-adv-from-fee-cur')?.value  || 'USD',
    fromNotes:     document.getElementById('ap-adv-from-notes')?.value    || '',
    cutRate:       parseFloat(document.getElementById('ap-adv-cut-rate')?.value) || 1,
    cutDir:        document.getElementById('ap-adv-cut-dir')?.value       || 'mul',
    toCenter,
    toBeneficiary: document.getElementById('ap-adv-to-beneficiary')?.value|| '',
    toCurrency:    document.getElementById('ap-adv-to-cur')?.value        || 'USD',
    toFee:         parseFloat(document.getElementById('ap-adv-to-fee')?.value)   || 0,
    toFeeCur:      document.getElementById('ap-adv-to-fee-cur')?.value    || 'USD',
    toNotes:       document.getElementById('ap-adv-to-notes')?.value      || '',
  };

  fetch('/api/am/adv-entry/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': ap_getCsrf() },
    body: JSON.stringify(payload),
  })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        apNotify('تم تنفيذ القيد ' + d.record.refNumber, 'success');
        apLogAdd({ type:'قيد متقدم', amount: fromAmt, currency: document.getElementById('ap-adv-from-cur')?.value || 'USD', ref: d.record.refNumber, status:'success' });
        ap_adv_reset();
      } else {
        apNotify(d.message || 'خطأ في الحفظ', 'error');
      }
    })
    .catch(() => apNotify('تعذّر الاتصال بالخادم', 'error'));
}

// ══ الحوالات ══
let _apTrPage = 1, _apTrTotalPages = 1;

function ap_trFilter() {
  _apTrPage = 1;
  ap_trFetch();
}

function ap_trFetch() {
  const q  = (document.getElementById('ap-tr-search')?.value || '').trim();
  const df = document.getElementById('ap-tr-date-from')?.value || '';
  const dt = document.getElementById('ap-tr-date-to')?.value   || '';
  const cur = '';

  const statusMap = { unreceived: 'pending', received: 'completed', all: '' };
  const status = statusMap[_apTrType] || '';

  const params = new URLSearchParams({ page: _apTrPage, per_page: 20 });
  if (status) params.set('status', status);
  if (q)      params.set('q', q);
  if (df)     params.set('date_from', df);
  if (dt)     params.set('date_to', dt);
  if (cur)    params.set('currency', cur);

  const tbody = document.getElementById('ap-tr-tbody');
  tbody.innerHTML = '<tr><td colspan="10" style="padding:40px;text-align:center;color:#4a6280;">جاري التحميل...</td></tr>';

  fetch('/api/am/transfers/?' + params)
    .then(r => r.json())
    .then(d => {
      if (!d.success) { apNotify(d.message || 'خطأ في التحميل', 'error'); return; }
      _apTrTotalPages = d.totalPages || 1;
      ap_trRender(d);
    })
    .catch(() => {
      tbody.innerHTML = '<tr><td colspan="10" style="padding:40px;text-align:center;color:#f87171;">تعذّر الاتصال بالخادم</td></tr>';
    });
}

function ap_trRender(d) {
  const s = d.summary || {};
  const cntEl = document.getElementById('ap-tr-count');  if (cntEl)  cntEl.textContent  = s.total || 0;
  const totEl = document.getElementById('ap-tr-total');  if (totEl)  totEl.textContent  = (s.totalAmount || 0).toLocaleString('ar') + ' $';
  const prfEl = document.getElementById('ap-tr-profit'); if (prfEl)  prfEl.textContent = (s.totalCommission || 0).toLocaleString('ar') + ' $';

  const tbody = document.getElementById('ap-tr-tbody');
  const items = d.transfers || [];
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="padding:40px;text-align:center;color:#2d4060;">لا توجد حوالات</td></tr>';
  } else {
    tbody.innerHTML = items.map((r, i) => {
      const isCompleted = r.status === 'completed';
      return `<tr>
        <td>${(_apTrPage-1)*20 + i + 1}</td>
        <td style="font-size:11px;color:#4a6280;">${r.createdAt||'—'}</td>
        <td style="color:#e9edef;font-weight:600;">${r.senderName||'—'}</td>
        <td style="color:#e9edef;">${r.receiverName||'—'}</td>
        <td style="color:#8696a0;">${r.destination||'—'}</td>
        <td style="text-align:center;color:#60a5fa;font-weight:700;">${(r.amount||0).toLocaleString('ar')} <span style="font-size:10px;color:#4a6280;">${r.currency||'USD'}</span></td>
        <td style="text-align:center;">
          <span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;
            background:${isCompleted?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)'};
            color:${isCompleted?'#4ade80':'#f87171'};">
            ${isCompleted?'مستلمة':'غير مستلمة'}
          </span>
        </td>
        <td style="text-align:center;">
          ${!isCompleted
            ? `<button onclick="ap_trReceive(${r.id})"
                style="padding:4px 10px;border-radius:7px;background:rgba(34,197,94,0.1);
                border:1px solid rgba(34,197,94,0.3);color:#4ade80;font-size:11px;cursor:pointer;font-family:inherit;">
                استلام</button>`
            : `<span style="font-size:10px;color:#2d4060;">${r.completedAt||'—'}</span>`}
        </td>
      </tr>`;
    }).join('');
  }

  document.getElementById('ap-tr-pagination').innerHTML = _apTrTotalPages > 1
    ? Array.from({length: _apTrTotalPages}, (_, i) =>
        `<button onclick="_apTrPage=${i+1};ap_trFetch()"
          style="padding:6px 12px;border-radius:8px;
          border:1px solid rgba(255,255,255,${i+1===_apTrPage?'0.2':'0.07'});
          background:rgba(255,255,255,${i+1===_apTrPage?'0.1':'0.03'});
          color:${i+1===_apTrPage?'#e9edef':'#4a6280'};cursor:pointer;font-size:12px;">${i+1}</button>`
      ).join('')
    : '';
}

function ap_trReceive(id) {
  if (!confirm('تأكيد استلام الحوالة؟')) return;
  fetch(`/api/am/transfers/${id}/receive/`, {
    method: 'PATCH',
    headers: { 'X-CSRFToken': ap_getCsrf() },
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) { apNotify('تم تأكيد الاستلام', 'success'); ap_trFetch(); }
    else           { apNotify(d.message || 'خطأ', 'error'); }
  })
  .catch(() => apNotify('تعذّر الاتصال', 'error'));
}

// ══ كشف الحساب ══
let _apStmCenter = null, _apStmData = null;

function ap_stmSearch(q) {
  const dd = document.getElementById('ap-stm-dd');
  if (!q || q.length < 1) { dd.style.display = 'none'; return; }
  fetch('/api/am/statement/centers/?q=' + encodeURIComponent(q))
    .then(r => r.json())
    .then(d => {
      if (!d.success || !d.centers.length) { dd.style.display = 'none'; return; }
      dd.innerHTML = d.centers.map(name =>
        `<div onclick="ap_stmSelect('${name.replace(/'/g, "\\'")}')"
          style="padding:9px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);
          font-size:12px;color:#e9edef;transition:background .15s;"
          onmouseover="this.style.background='rgba(255,255,255,0.06)'"
          onmouseout="this.style.background=''">${name}</div>`
      ).join('');
      dd.style.display = 'block';
    })
    .catch(() => { dd.style.display = 'none'; });
}

function ap_stmSelect(name) {
  _apStmCenter = name;
  document.getElementById('ap-stm-search').value = name;
  document.getElementById('ap-stm-dd').style.display = 'none';
  const sel = document.getElementById('ap-stm-selected');
  sel.style.display = 'flex';
  document.getElementById('ap-stm-sel-name').textContent = name;
}

function ap_stmClear() {
  _apStmCenter = null;
  _apStmData   = null;
  document.getElementById('ap-stm-search').value = '';
  document.getElementById('ap-stm-selected').style.display = 'none';
  document.getElementById('ap-stm-summary').style.display = 'none';
  document.getElementById('ap-stm-tbody').innerHTML =
    '<tr><td colspan="8" style="padding:60px;text-align:center;color:#2d4060;">اختر مركزاً واضغط كشف حساب</td></tr>';
}

function ap_stmSetPeriod(v) {
  const today = new Date(), fmt = d => d.toISOString().slice(0, 10);
  let from = new Date(today), to = new Date(today);
  if (v === 'week')       from = new Date(+today - 7*86400000);
  else if (v === 'month')   from = new Date(+today - 30*86400000);
  else if (v === '3months') from = new Date(+today - 90*86400000);
  else if (v === 'year')    from = new Date(today.getFullYear(), 0, 1);
  if (v) {
    document.getElementById('ap-stm-date-from').value = fmt(from);
    document.getElementById('ap-stm-date-to').value   = fmt(to);
  }
}

function ap_stmGenerate() {
  if (!_apStmCenter) { apNotify('يرجى اختيار مركز أولاً', 'error'); return; }

  const params = new URLSearchParams({
    center:    _apStmCenter,
    period:    document.getElementById('ap-stm-period')?.value    || '',
    date_from: document.getElementById('ap-stm-date-from')?.value || '',
    date_to:   document.getElementById('ap-stm-date-to')?.value   || '',
  });

  const tbody = document.getElementById('ap-stm-tbody');
  tbody.innerHTML = '<tr><td colspan="8" style="padding:40px;text-align:center;color:#4a6280;">جاري التحميل...</td></tr>';
  document.getElementById('ap-stm-summary').style.display = 'none';

  fetch('/api/am/statement/?' + params)
    .then(r => r.json())
    .then(d => {
      if (!d.success) { apNotify(d.message || 'خطأ في التحميل', 'error'); return; }
      _apStmData = d;
      ap_stmRender(d);
    })
    .catch(() => {
      tbody.innerHTML = '<tr><td colspan="8" style="padding:40px;text-align:center;color:#f87171;">تعذّر الاتصال بالخادم</td></tr>';
    });
}

function ap_stmRender(d) {
  const fmt  = n => n.toLocaleString('ar', {minimumFractionDigits:2, maximumFractionDigits:2});
  const summary = document.getElementById('ap-stm-summary');
  summary.style.display = 'flex';
  const cur = d.currency !== 'الكل' ? ' ' + d.currency : '';
  const _s = id => document.getElementById(id);
  if (_s('ap-stm-total-in'))    _s('ap-stm-total-in').textContent    = fmt(d.totalIn)    + cur;
  if (_s('ap-stm-total-out'))   _s('ap-stm-total-out').textContent   = fmt(d.totalOut)   + cur;
  if (_s('ap-stm-net-balance')) _s('ap-stm-net-balance').textContent = fmt(d.netBalance) + cur;
  if (_s('ap-stm-count'))       _s('ap-stm-count').textContent       = d.count;

  const tbody = document.getElementById('ap-stm-tbody');
  if (!d.movements.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="padding:40px;text-align:center;color:#2d4060;">لا توجد حركات في هذه الفترة</td></tr>';
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
      <td style="padding:9px 12px;color:#4a6280;">${i+1}</td>
      <td style="padding:9px 12px;color:#4a6280;font-size:11px;white-space:nowrap;">${m.date}</td>
      <td style="padding:9px 12px;">
        <span style="padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;
          background:${tc}22;color:${tc};">${m.type}</span>
      </td>
      <td style="padding:9px 12px;color:#e9edef;font-size:12px;">${m.counterpart || m.ref || '—'}</td>
      <td style="padding:9px 12px;text-align:center;font-weight:700;color:#4ade80;">${isIn ? fmt(m.amount) : '—'}</td>
      <td style="padding:9px 12px;text-align:center;font-weight:700;color:#f87171;">${!isIn ? fmt(m.amount) : '—'}</td>
      <td style="padding:9px 12px;text-align:center;color:#8696a0;font-size:11px;">${m.currency}</td>
      <td style="padding:9px 12px;text-align:center;">
        <span style="padding:2px 8px;border-radius:20px;font-size:10px;
          background:${statusColor}22;color:${statusColor};">${statusText}</span>
      </td>
    </tr>`;
  }).join('');
}

function ap_stmPrint() {
  if (!_apStmData) { apNotify('يرجى توليد كشف الحساب أولاً', 'warning'); return; }
  window.print();
}

// ══ حوالة جديدة ══
function ap_nm_calc() {
  const sendAmt = parseFloat(document.getElementById('ap-nm-send-amt').value)    || 0;
  const rate    = parseFloat(document.getElementById('ap-nm-rate').value)         || 1;
  const feeExp  = parseFloat(document.getElementById('ap-nm-fee-export').value)   || 0;
  const feeDel  = parseFloat(document.getElementById('ap-nm-fee-delivery').value) || 0;
  const recv    = document.getElementById('ap-nm-recv-amt');
  const recvAmt = sendAmt * rate;
  if (recv && document.activeElement !== recv) recv.value = recvAmt ? recvAmt.toFixed(2) : '';
  const total = sendAmt + feeExp + feeDel;
  document.getElementById('ap-nm-total').textContent = total ? total.toLocaleString('ar') : '0';
}

function ap_nm_send() {
  const source   = document.getElementById('ap-nm-source').value;
  const dest     = document.getElementById('ap-nm-dest').value;
  const receiver = document.getElementById('ap-nm-benef-name').value.trim();
  const phone    = document.getElementById('ap-nm-benef-phone').value.trim();
  const address  = document.getElementById('ap-nm-address').value.trim();
  const sendAmt  = parseFloat(document.getElementById('ap-nm-send-amt').value) || 0;
  const recvAmt  = parseFloat(document.getElementById('ap-nm-recv-amt').value) || 0;
  const sendCur  = document.getElementById('ap-nm-send-cur').value;
  const recvCur  = document.getElementById('ap-nm-recv-cur').value;
  const feeExp   = parseFloat(document.getElementById('ap-nm-fee-export').value)   || 0;
  const feeDel   = parseFloat(document.getElementById('ap-nm-fee-delivery').value) || 0;
  const rate     = parseFloat(document.getElementById('ap-nm-rate').value) || 1;
  const notes    = document.getElementById('ap-nm-notes').value.trim();

  if (!source)   { apNotify('يرجى اختيار المصدر', 'error'); return; }
  if (!dest)     { apNotify('يرجى اختيار الوجهة', 'error'); return; }
  if (!receiver) { apNotify('يرجى إدخال اسم المستفيد', 'error'); return; }
  if (!sendAmt)  { apNotify('يرجى إدخال مبلغ الإرسال', 'error'); return; }
  if (!sendCur)  { apNotify('يرجى اختيار عملة الإرسال', 'error'); return; }

  const btn = document.querySelector('#ap-pane-new-move .ap-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الإرسال...'; }

  fetch('/api/am/transfers/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': ap_getCsrf() },
    body: JSON.stringify({
      senderName:    source,
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
      apNotify(`تم إنشاء الحوالة ${d.transfer.refNumber}`, 'success');
      apLogAdd({ type:'حوالة', amount: sendAmt, currency: sendCur, ref: d.transfer.refNumber, status:'success' });
      ap_nm_reset();
      apSwitch(null);
      if (_apCurrent === 'unreceived' || _apCurrent === 'all') ap_trFetch();
    } else {
      apNotify(d.message || 'حدث خطأ', 'error');
    }
  })
  .catch(() => apNotify('تعذّر الاتصال بالخادم', 'error'))
  .finally(() => {
    if (btn) { btn.disabled = false; btn.textContent = 'إرسال'; }
  });
}

function ap_nm_reset() {
  ['ap-nm-source','ap-nm-dest','ap-nm-benef-name','ap-nm-benef-phone','ap-nm-address',
   'ap-nm-send-amt','ap-nm-recv-amt','ap-nm-fee-export','ap-nm-fee-delivery','ap-nm-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const rateEl = document.getElementById('ap-nm-rate');
  if (rateEl) rateEl.value = '1';
  document.getElementById('ap-nm-total').textContent = '0';
}

// ══ تبديل عملات ══
function ap_ex_calc() {
  const amt1 = parseFloat(document.getElementById('ap-ex-amt1').value) || 0;
  const rate  = parseFloat(document.getElementById('ap-ex-rate').value)  || 1;
  const el = document.getElementById('ap-ex-amt2');
  el.value = (amt1 * rate) ? (amt1 * rate).toFixed(2) : '';
}

function ap_ex_submit() {
  const c1   = document.getElementById('ap-ex-center1').value;
  const c2   = document.getElementById('ap-ex-center2').value;
  const a1   = parseFloat(document.getElementById('ap-ex-amt1').value) || 0;
  const cur1 = document.getElementById('ap-ex-cur1').value;
  const cur2 = document.getElementById('ap-ex-cur2').value;
  const rate = parseFloat(document.getElementById('ap-ex-rate').value) || 1;
  const notes= document.getElementById('ap-ex-notes')?.value?.trim() || '';

  if (!c1)           { apNotify('يرجى اختيار المركز الأول', 'error'); return; }
  if (!c2)           { apNotify('يرجى اختيار المركز الثاني', 'error'); return; }
  if (c1 === c2)     { apNotify('المركزان متطابقان', 'error'); return; }
  if (!a1)           { apNotify('يرجى إدخال المبلغ الأول', 'error'); return; }
  if (cur1 === cur2) { apNotify('العملتان متطابقتان', 'error'); return; }

  const btn = document.querySelector('#ap-pane-exchange .ap-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري التنفيذ...'; }

  fetch('/api/am/exchange/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': ap_getCsrf() },
    body: JSON.stringify({
      center1: c1, center2: c2,
      currency1: cur1, currency2: cur2,
      amount1: a1, rate: rate, notes: notes,
    }),
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      apNotify(`${d.message}`, 'success');
      apLogAdd({ type:'تبديل عملات', amount: a1, currency: cur1 + '→' + cur2, ref: d.ref || '—', status:'success' });
      ap_ex_reset();
      apSwitch(null);
    } else {
      apNotify(d.message || 'حدث خطأ', 'error');
    }
  })
  .catch(() => apNotify('تعذّر الاتصال بالخادم', 'error'))
  .finally(() => {
    if (btn) { btn.disabled = false; btn.textContent = 'موافق'; }
  });
}

function ap_ex_reset() {
  ['ap-ex-center1','ap-ex-center2','ap-ex-amt1','ap-ex-amt2','ap-ex-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const rateEl = document.getElementById('ap-ex-rate');
  if (rateEl) rateEl.value = '1';
}

// ══ قص وإغلاق ══
function _ap_cutToUSD(amt, rate, dir) {
  if (!amt || !rate) return null;
  return dir === 'div' ? amt / rate : amt * rate;
}

function ap_cut_calc() {
  const buyAmt   = parseFloat(document.getElementById('ap-cut-buy-amt').value)   || 0;
  const buyRate  = parseFloat(document.getElementById('ap-cut-buy-rate').value)  || 0;
  const buyDir   = document.getElementById('ap-cut-buy-dir').value;
  const sellAmt  = parseFloat(document.getElementById('ap-cut-sell-amt').value)  || 0;
  const sellRate = parseFloat(document.getElementById('ap-cut-sell-rate').value) || 0;
  const sellDir  = document.getElementById('ap-cut-sell-dir').value;
  const buyUSD   = _ap_cutToUSD(buyAmt,  buyRate,  buyDir);
  const sellUSD  = _ap_cutToUSD(sellAmt, sellRate, sellDir);
  const fmt = v => v != null ? v.toLocaleString('ar', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—';
  const buyEl  = document.getElementById('ap-cut-buy-usd');
  const sellEl = document.getElementById('ap-cut-sell-usd');
  if (buyEl)  buyEl.textContent  = fmt(buyUSD);
  if (sellEl) sellEl.textContent = fmt(sellUSD);
  const profit = (buyUSD != null && sellUSD != null) ? buyUSD - sellUSD : null;
  const profEl = document.getElementById('ap-cut-profit');
  if (profEl) { profEl.textContent = fmt(profit); profEl.style.color = (profit != null && profit >= 0) ? '#4ade80' : '#f87171'; }
}

function ap_cut_submit() {
  const bc  = document.getElementById('ap-cut-buy-center').value;
  const sc  = document.getElementById('ap-cut-sell-center').value;
  const ba  = parseFloat(document.getElementById('ap-cut-buy-amt').value)   || 0;
  const br  = parseFloat(document.getElementById('ap-cut-buy-rate').value)  || 0;
  const bd  = document.getElementById('ap-cut-buy-dir').value;
  const bn  = document.getElementById('ap-cut-buy-notes')?.value?.trim()   || '';
  const sa  = parseFloat(document.getElementById('ap-cut-sell-amt').value)  || 0;
  const sr  = parseFloat(document.getElementById('ap-cut-sell-rate').value) || 0;
  const sd  = document.getElementById('ap-cut-sell-dir').value;
  const sn  = document.getElementById('ap-cut-sell-notes')?.value?.trim()  || '';
  const bc_ = document.getElementById('ap-cut-buy-cur').value;
  const sc_ = document.getElementById('ap-cut-sell-cur').value;

  if (!bc) { apNotify('يرجى اختيار مركز الشراء', 'error'); return; }
  if (!sc) { apNotify('يرجى اختيار مركز البيع',  'error'); return; }
  if (!ba) { apNotify('يرجى إدخال مبلغ الشراء',  'error'); return; }
  if (!br) { apNotify('يرجى إدخال سعر قص الشراء','error'); return; }
  if (!sa) { apNotify('يرجى إدخال مبلغ البيع',   'error'); return; }
  if (!sr) { apNotify('يرجى إدخال سعر قص البيع', 'error'); return; }

  const btn = document.querySelector('#ap-pane-cut .ap-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري التنفيذ...'; }

  fetch('/api/am/cut/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': ap_getCsrf() },
    body: JSON.stringify({
      buyCenter:    bc,  buyCurrency:  bc_, buyAmount:  ba, buyRate:  br, buyDir:  bd, buyNotes:  bn,
      sellCenter:   sc,  sellCurrency: sc_, sellAmount: sa, sellRate: sr, sellDir: sd, sellNotes: sn,
    }),
  })
  .then(r => r.json())
  .then(d => {
    if (d.success) {
      apLogAdd({ type:'قص وإغلاق', amount: ba, currency: bc_, ref: d.ref || '—', status:'success' });
      const profit = d.profitUsd >= 0
        ? `ربح: ${d.profitUsd.toLocaleString('ar')} $`
        : `خسارة: ${Math.abs(d.profitUsd).toLocaleString('ar')} $`;
      apNotify(`${d.message} — ${profit}`, 'success');
      ap_cut_reset();
      apSwitch(null);
    } else {
      apNotify(d.message || 'حدث خطأ', 'error');
    }
  })
  .catch(() => apNotify('تعذّر الاتصال بالخادم', 'error'))
  .finally(() => {
    if (btn) { btn.disabled = false; btn.textContent = 'موافق وإغلاق'; }
  });
}

function ap_cut_reset() {
  ['ap-cut-buy-center','ap-cut-buy-amt','ap-cut-buy-rate','ap-cut-buy-notes',
   'ap-cut-sell-center','ap-cut-sell-amt','ap-cut-sell-rate','ap-cut-sell-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['ap-cut-buy-usd','ap-cut-sell-usd'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '—';
  });
  const profEl = document.getElementById('ap-cut-profit');
  if (profEl) { profEl.textContent = '—'; profEl.style.color = '#4ade80'; }
}

// ══ قيد تسوية ══
let _apStlIdx = 1;

function ap_stl_rowHTML(idx) {
  const opts = ['USD دولار','JOD دينار','ILS شيكل','EUR يورو','TRY ليرة','AED درهم','SYP سوري']
    .map(o => { const [v, l] = o.split(' '); return `<option value="${v}">${l}</option>`; }).join('');
  const destOpts = `<option value="">الوجهة</option><option value="main">الرئيسي</option><option value="branch1">فرع 1</option><option value="agent">وكيل</option>`;
  return `<tr class="ap-stl-row" data-idx="${idx}">
    <td style="padding:6px 8px;"><select class="nm-input ap-stl-cur" onchange="ap_stl_calc()" style="min-width:90px;cursor:pointer;">${opts}</select></td>
    <td style="padding:6px 8px;"><input type="number" class="nm-input ap-stl-amt" placeholder="0" oninput="ap_stl_calc()" style="min-width:100px;color:#e9edef;font-weight:700;"></td>
    <td style="padding:6px 8px;"><input type="number" class="nm-input ap-stl-fee" placeholder="0" oninput="ap_stl_calc()" style="min-width:70px;color:#fbbf24;"></td>
    <td style="padding:6px 8px;"><input type="text"   class="nm-input ap-stl-benef" placeholder="اسم المستفيد" style="min-width:130px;"></td>
    <td style="padding:6px 8px;"><input type="text"   class="nm-input ap-stl-notes" placeholder="ملاحظات..." style="min-width:130px;"></td>
    <td style="padding:6px 8px;"><select class="nm-input ap-stl-dest" style="min-width:110px;cursor:pointer;">${destOpts}</select></td>
    <td style="padding:6px 8px;"><input type="number" class="nm-input ap-stl-del-fee" placeholder="0" oninput="ap_stl_calc()" style="min-width:70px;color:#f87171;"></td>
    <td style="padding:6px 8px;text-align:center;">
      <button onclick="ap_stl_removeRow(this)" title="حذف"
        style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#f87171;
        border-radius:7px;width:28px;height:28px;cursor:pointer;font-size:14px;line-height:1;">×</button>
    </td>
  </tr>`;
}

function ap_stl_addRow() {
  const tbody = document.getElementById('ap-stl-tbody');
  const tmp   = document.createElement('tbody');
  tmp.innerHTML = ap_stl_rowHTML(_apStlIdx++);
  tbody.appendChild(tmp.firstChild);
}

function ap_stl_removeRow(btn) {
  const tbody = document.getElementById('ap-stl-tbody');
  if (tbody.querySelectorAll('tr').length <= 1) {
    apNotify('يجب أن يبقى صف واحد على الأقل', 'warning'); return;
  }
  btn.closest('tr').remove();
  ap_stl_calc();
}

function ap_stl_calc() {
  let sumFee = 0, sumDelFee = 0;
  document.querySelectorAll('#ap-stl-tbody .ap-stl-row').forEach(row => {
    sumFee    += parseFloat(row.querySelector('.ap-stl-fee')?.value)     || 0;
    sumDelFee += parseFloat(row.querySelector('.ap-stl-del-fee')?.value) || 0;
  });
  const prof = sumFee - sumDelFee;
  const fmt  = v => v.toLocaleString('ar', {minimumFractionDigits:2, maximumFractionDigits:2});
  document.getElementById('ap-stl-sum-us').textContent   = fmt(sumFee);
  document.getElementById('ap-stl-sum-them').textContent = fmt(sumDelFee);
  const profEl = document.getElementById('ap-stl-profit');
  profEl.textContent = fmt(prof);
  profEl.style.color = prof >= 0 ? '#4ade80' : '#f87171';
}

function ap_stl_submit() {
  const center = (document.getElementById('ap-stl-center')?.value || '').trim();
  if (!center) { apNotify('يرجى اختيار المركز', 'error'); return; }

  const rows = [];
  let valid = true;
  document.querySelectorAll('#ap-stl-tbody .ap-stl-row').forEach(row => {
    const currency    = row.querySelector('.ap-stl-cur')?.value      || 'USD';
    const amount      = parseFloat(row.querySelector('.ap-stl-amt')?.value)     || 0;
    const feeUs       = parseFloat(row.querySelector('.ap-stl-fee')?.value)     || 0;
    const beneficiary = row.querySelector('.ap-stl-benef')?.value    || '';
    const notes       = row.querySelector('.ap-stl-notes')?.value    || '';
    const destination = row.querySelector('.ap-stl-dest')?.value     || '';
    const feeThem     = parseFloat(row.querySelector('.ap-stl-del-fee')?.value) || 0;
    if (amount <= 0) valid = false;
    rows.push({ currency, amount, feeUs, beneficiary, notes, destination, feeThem });
  });
  if (!valid) { apNotify('يرجى إدخال المبالغ في جميع الصفوف', 'error'); return; }

  apNotify('جاري حفظ قيد التسوية...', 'info');

  fetch('/api/am/settlement/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': ap_getCsrf() },
    body: JSON.stringify({ centerName: center, rows }),
  })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        apNotify('تم حفظ ' + d.record.refNumber, 'success');
        if (d.warning) apNotify(d.warning, 'warning');
        apLogAdd({ type:'قيد تسوية', amount: '—', currency: '—', ref: d.record.refNumber, status:'success' });
        document.getElementById('ap-stl-tbody').innerHTML = '';
        _apStlIdx = 1;
        ap_stl_addRow();
        ap_stl_calc();
      } else {
        apNotify(d.message || 'خطأ في الحفظ', 'error');
      }
    })
    .catch(() => apNotify('تعذّر الاتصال بالخادم', 'error'));
}

// ══════════════════════════════════════════════════════════════
//  قيد التسليم — جلب وعرض الحوالات المعلّقة
// ══════════════════════════════════════════════════════════════
let _apDpData = [];

function ap_dp_fetch() {
  fetch('/api/am/transfers/?status=unreceived&per_page=200', { credentials: 'include' })
    .then(r => r.ok ? r.json() : { results: [] })
    .then(d => {
      _apDpData = d.results || d.transfers || [];
      ap_dp_render(_apDpData);
    })
    .catch(() => ap_dp_render([]));
}

function ap_dp_filter() {
  const q    = (document.getElementById('ap-dp-search')?.value || '').toLowerCase();
  const date = document.getElementById('ap-dp-date')?.value || '';
  let rows = _apDpData;
  if (q)    rows = rows.filter(r => (r.beneficiary_name||r.name||'').toLowerCase().includes(q) || (r.phone||'').includes(q));
  if (date) rows = rows.filter(r => (r.created_at||r.date||'').startsWith(date));
  ap_dp_render(rows);
}

function ap_dp_render(rows) {
  const tbody  = document.getElementById('ap-dp-tbody');
  const count  = document.getElementById('ap-dp-count');
  const total  = document.getElementById('ap-dp-total');
  const today  = document.getElementById('ap-dp-today');
  if (!tbody) return;

  const todayStr = new Date().toISOString().slice(0,10);
  const todayRows = rows.filter(r => (r.created_at||r.date||'').startsWith(todayStr));
  if (count) count.textContent = rows.length;
  if (total) total.textContent = rows.reduce((s,r) => s + (+r.amount||0), 0).toFixed(2);
  if (today) today.textContent = todayRows.length;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="padding:40px;text-align:center;color:#2d4060;">لا توجد حوالات في الانتظار</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td style="color:#2d4060;">${i+1}</td>
      <td style="color:#4a6280;">${(r.created_at||r.date||'—').slice(0,10)}</td>
      <td style="color:#e9edef;font-weight:700;">${r.beneficiary_name||r.name||'—'}</td>
      <td style="color:#fbbf24;">${r.phone||'—'}</td>
      <td style="text-align:center;color:#fb923c;font-weight:800;">${r.amount||'—'}</td>
      <td style="text-align:center;color:#4a6280;">${r.currency||'—'}</td>
      <td style="text-align:center;color:#4a6280;">${r.source||r.branch||'—'}</td>
      <td style="text-align:center;">
        <button onclick="ap_dp_deliver(${r.id||0})" style="padding:4px 12px;border-radius:7px;border:none;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">تسليم</button>
      </td>
    </tr>`).join('');
}

function ap_dp_deliver(id) {
  if (!id || !confirm('تأكيد تسليم هذه الحوالة؟')) return;
  fetch(`/api/am/transfers/${id}/deliver/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': ap_getCsrf(), 'Content-Type': 'application/json' },
    credentials: 'include',
  })
    .then(r => r.json())
    .then(d => {
      if (d.success || d.ok) {
        apNotify('تم تسجيل التسليم', 'success');
        apLogAdd({ type:'تسليم حوالة', amount:'—', currency:'—', ref: String(id), status:'success' });
        ap_dp_fetch();
      } else {
        apNotify(d.message||'خطأ', 'error');
      }
    })
    .catch(() => apNotify('تعذّر الاتصال', 'error'));
}

// ══════════════════════════════════════════════════════════════
//  تم التسليم — جلب وعرض الحوالات المسلَّمة
// ══════════════════════════════════════════════════════════════
let _apDdData = [];

function ap_dd_fetch() {
  fetch('/api/am/transfers/?status=received&per_page=200', { credentials: 'include' })
    .then(r => r.ok ? r.json() : { results: [] })
    .then(d => {
      _apDdData = d.results || d.transfers || [];
      ap_dd_render(_apDdData);
    })
    .catch(() => ap_dd_render([]));
}

function ap_dd_filter() {
  const q    = (document.getElementById('ap-dd-search')?.value || '').toLowerCase();
  const date = document.getElementById('ap-dd-date')?.value || '';
  let rows = _apDdData;
  if (q)    rows = rows.filter(r => (r.beneficiary_name||r.name||'').toLowerCase().includes(q) || (r.phone||'').includes(q));
  if (date) rows = rows.filter(r => (r.delivered_at||r.created_at||r.date||'').startsWith(date));
  ap_dd_render(rows);
}

function ap_dd_render(rows) {
  const tbody = document.getElementById('ap-dd-tbody');
  const count = document.getElementById('ap-dd-count');
  const total = document.getElementById('ap-dd-total');
  const today = document.getElementById('ap-dd-today');
  if (!tbody) return;

  const todayStr = new Date().toISOString().slice(0,10);
  const todayRows = rows.filter(r => (r.delivered_at||r.created_at||'').startsWith(todayStr));
  if (count) count.textContent = rows.length;
  if (total) total.textContent = rows.reduce((s,r) => s + (+r.amount||0), 0).toFixed(2);
  if (today) today.textContent = todayRows.length;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="padding:40px;text-align:center;color:#2d4060;">لا توجد سجلات</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td style="color:#2d4060;">${i+1}</td>
      <td style="color:#4a6280;">${(r.created_at||r.date||'—').slice(0,10)}</td>
      <td style="color:#e9edef;font-weight:700;">${r.beneficiary_name||r.name||'—'}</td>
      <td style="color:#fbbf24;">${r.phone||'—'}</td>
      <td style="text-align:center;color:#34d399;font-weight:800;">${r.amount||'—'}</td>
      <td style="text-align:center;color:#4a6280;">${r.currency||'—'}</td>
      <td style="text-align:center;color:#4a6280;">${(r.delivered_at||'—').slice(0,16).replace('T',' ')}</td>
      <td style="text-align:center;color:#4a6280;">${r.delivered_by||r.staff||'—'}</td>
    </tr>`).join('');
}

// ══════════════════════════════════════════════════════════════
//  سند قص — حساب الفرق
// ══════════════════════════════════════════════════════════════
function ap_cv_calc() {
  const toUsd = (amt, rate, dir) => {
    const a = parseFloat(amt) || 0;
    const r = parseFloat(rate) || 1;
    if (dir === 'div') return r ? a / r : 0;
    return a * r;
  };
  const buyUsd  = toUsd(
    document.getElementById('ap-cv-buy-amt')?.value,
    document.getElementById('ap-cv-buy-rate')?.value,
    document.getElementById('ap-cv-buy-dir')?.value
  );
  const sellUsd = toUsd(
    document.getElementById('ap-cv-sell-amt')?.value,
    document.getElementById('ap-cv-sell-rate')?.value,
    document.getElementById('ap-cv-sell-dir')?.value
  );
  const buyEl  = document.getElementById('ap-cv-buy-usd');
  const sellEl = document.getElementById('ap-cv-sell-usd');
  const profEl = document.getElementById('ap-cv-profit');
  if (buyEl)  buyEl.textContent  = buyUsd  ? buyUsd.toFixed(4)  : '—';
  if (sellEl) sellEl.textContent = sellUsd ? sellUsd.toFixed(4) : '—';
  if (profEl) {
    // الربح = ما استلمناه بالدولار − ما دفعناه بالدولار
    const diff = buyUsd - sellUsd;
    profEl.textContent = (buyUsd || sellUsd) ? (diff >= 0 ? '+' : '') + diff.toFixed(4) : '—';
    profEl.style.color = diff >= 0 ? '#4ade80' : '#f87171';
  }
}

function ap_cv_save() {
  const bc  = document.getElementById('ap-cv-buy-center')?.value  || '';
  const sc  = document.getElementById('ap-cv-sell-center')?.value || '';
  const ba  = parseFloat(document.getElementById('ap-cv-buy-amt')?.value)   || 0;
  const br  = parseFloat(document.getElementById('ap-cv-buy-rate')?.value)  || 0;
  const bd  = document.getElementById('ap-cv-buy-dir')?.value     || 'div';
  const bn  = document.getElementById('ap-cv-buy-notes')?.value?.trim()   || '';
  const bcu = document.getElementById('ap-cv-buy-cur')?.value     || 'USD';
  const sa  = parseFloat(document.getElementById('ap-cv-sell-amt')?.value)  || 0;
  const sr  = parseFloat(document.getElementById('ap-cv-sell-rate')?.value) || 0;
  const sd  = document.getElementById('ap-cv-sell-dir')?.value    || 'div';
  const sn  = document.getElementById('ap-cv-sell-notes')?.value?.trim()  || '';
  const scu = document.getElementById('ap-cv-sell-cur')?.value    || 'USD';

  if (!bc) { apNotify('يرجى اختيار مركز الشراء',  'error'); return; }
  if (!sc) { apNotify('يرجى اختيار مركز البيع',   'error'); return; }
  if (!ba) { apNotify('يرجى إدخال مبلغ الشراء',   'error'); return; }
  if (!br) { apNotify('يرجى إدخال سعر قص الشراء', 'error'); return; }
  if (!sa) { apNotify('يرجى إدخال مبلغ البيع',    'error'); return; }
  if (!sr) { apNotify('يرجى إدخال سعر قص البيع',  'error'); return; }

  const btn = document.querySelector('#ap-pane-cut-voucher .ap-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }

  fetch('/api/am/cut/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': ap_getCsrf() },
    credentials: 'include',
    body: JSON.stringify({
      buyCenter:    bc,  buyCurrency:  bcu, buyAmount:  ba, buyRate:  br, buyDir:  bd, buyNotes:  bn,
      sellCenter:   sc,  sellCurrency: scu, sellAmount: sa, sellRate: sr, sellDir: sd, sellNotes: sn,
    }),
  })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        const ref    = d.record?.refNumber || d.ref || '';
        const profit = d.profitUsd >= 0
          ? `ربح: ${d.profitUsd.toLocaleString('ar')} $`
          : `خسارة: ${Math.abs(d.profitUsd).toLocaleString('ar')} $`;
        apNotify(`تم حفظ سند القص ${ref} — ${profit}`, 'success');
        apLogAdd({ type: 'سند قص', amount: ba, currency: bcu, ref, status: 'success' });
        ap_cv_reset();
      } else {
        apNotify(d.message || 'خطأ في الحفظ', 'error');
      }
    })
    .catch(() => apNotify('تعذّر الاتصال بالخادم', 'error'))
    .finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'حفظ السند'; } });
}

function ap_cv_reset() {
  ['ap-cv-buy-center','ap-cv-buy-amt','ap-cv-buy-rate','ap-cv-buy-notes',
   'ap-cv-sell-center','ap-cv-sell-amt','ap-cv-sell-rate','ap-cv-sell-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['ap-cv-buy-usd','ap-cv-sell-usd','ap-cv-profit'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '—';
  });
}

function ap_cv_print() {
  const buy  = `${document.getElementById('ap-cv-buy-amt')?.value||0} ${document.getElementById('ap-cv-buy-cur')?.value||''} ÷×${document.getElementById('ap-cv-buy-rate')?.value||1} = ${document.getElementById('ap-cv-buy-usd')?.textContent||'—'} USD`;
  const sell = `${document.getElementById('ap-cv-sell-amt')?.value||0} ${document.getElementById('ap-cv-sell-cur')?.value||''} ÷×${document.getElementById('ap-cv-sell-rate')?.value||1} = ${document.getElementById('ap-cv-sell-usd')?.textContent||'—'} USD`;
  const prof = document.getElementById('ap-cv-profit')?.textContent || '—';
  const win  = window.open('', '_blank', 'width=420,height=500');
  win.document.write(`<html dir="rtl"><head><title>سند قص</title><style>body{font-family:sans-serif;padding:30px;direction:rtl} h2{text-align:center} table{width:100%;border-collapse:collapse;margin-top:20px} td,th{border:1px solid #ccc;padding:8px 12px;font-size:13px} .profit{font-size:18px;font-weight:bold;text-align:center;margin-top:20px}</style></head><body>
    <h2>سند قص — ${new Date().toLocaleDateString('ar')}</h2>
    <table><tr><th>اشترينا</th><td>${buy}</td></tr><tr><th>بعنا</th><td>${sell}</td></tr></table>
    <div class="profit">الربح: ${prof} USD</div>
    <script>window.print();window.close();<\/script></body></html>`);
  win.document.close();
}

// ══ تهيئة ══
document.addEventListener('DOMContentLoaded', () => {
  // إضافة صف أول في جدول التسوية
  ap_stl_addRow();

  // تحميل الفروع والوكلاء
  fetch('/api/am/init/')
    .then(r => r.ok ? r.json() : {})
    .then(d => {
      if (!d.success) return;
      const branchSelects = [
        'ap-nm-source', 'ap-nm-dest',
        'ap-ex-center1', 'ap-ex-center2',
        'ap-cut-buy-center', 'ap-cut-sell-center',
        'ap-stl-center',
        'ap-adv-from-center', 'ap-adv-to-center',
        'ap-cv-buy-center', 'ap-cv-sell-center',
      ];
      branchSelects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
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

  // تحميل دليل الحسابات
  fetch('/api/am/accounts/?active=1&per_page=100')
    .then(r => r.ok ? r.json() : {})
    .then(d => {
      if (!d.success) return;
      ['ap-entr-from-account', 'ap-entr-to-account'].forEach(id => {
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
