// ═══════════════════════════════════════════════
//  BOT CONTROL PANEL — JS
// ═══════════════════════════════════════════════
const _bcState = {
  master:      true,
  notify:      true,
  screenshot:  true,
  seccode:     true,
  autovalidate:true,
  autoexec:    true,
  loadbalance: true,
  dedup:       true,
  autoreceipt: true,
  sla:         true,
  autopriority:true,
  slareassign: false,
  autoarchive: true,
  currencydetect:true,
  supervisorapprove:true,
  autoreject:  false,
  dailywarn:   true,
  dailyfreeze: true,
  patterndetect:true,
  rapidfire:   true,
  crossgroupcheck:true,
  verboselog:  true,
  autoretry:   true,
  autosave:    true,
  soundalert:  false,
  standby:     false,
  multiuser:   false,
  'grp-aswar':      true,
  'grp-abuhashim':  true,
  'grp-random':     true,
  speed:       'normal',
  delayMs:     4000,
  slaTimeoutMs:60000,
  autoPriorityThreshold: 1000,
  maxTransferAmount:     5000,
  dailyLimitAmount:      100000,
  allowedCurrencies:     ['USD','EUR','TRY','IQD'],
  receiptFields:         { name:true, amount:true, code:true, agent:true, time:true, comm:false },
  commRates:         { aswar: 2, abuhashim: 1.5, random: 3 },
  agentCaps:         { barhoum: 5, agent2: 5, agent3: 5 },
  maxMsgsPerGroup:   { aswar: 9, abuhashim: 9, random: 9 },
  defaultAgent:      'auto',
  defaultCurrency:   'USD',
  defaultPriority:   'normal',
  minTransferAmount: 10,
};

/* ── Persist state to localStorage for cross-page sync ── */
function _saveBotSettings() {
  try {
    localStorage.setItem('intl_botSettings', JSON.stringify(_bcState));
    // Dispatch a custom event so other tabs/pages know settings changed
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'intl_botSettings',
      newValue: JSON.stringify(_bcState),
      storageArea: localStorage
    }));
  } catch(e) {}
}
/* ── Load settings from localStorage on startup ── */
(function _initBotSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('intl_botSettings') || 'null');
    if (saved) Object.assign(_bcState, saved);
  } catch(e) {}
})();

let _bcReceived = 0, _bcExecuted = 0, _bcDupes = 0;

function openBotControl() {
  _bcRefreshStats();
  _bcRenderAgents();
  const ov = document.getElementById('botControlOverlay');
  ov.style.display = 'flex';
  // Animate in
  const panel = document.getElementById('botControlPanel');
  panel.style.animation = 'none';
  requestAnimationFrame(() => { panel.style.animation = 'bcSlideUp .35s cubic-bezier(.22,1,.36,1)'; });
}
function closeBotControl() {
  document.getElementById('botControlOverlay').style.display = 'none';
}
function bcSaveAndClose() {
  _saveBotSettings();
  closeBotControl();
  if (typeof showToast === 'function') showToast('✅ تم حفظ إعدادات البوت', 'success');
}

function bcTab(name, btn) {
  document.querySelectorAll('.bc-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bc-panel').forEach(p => p.style.display = 'none');
  btn.classList.add('active');
  document.getElementById('bc-panel-' + name).style.display = '';
  if (name === 'agents') _bcRenderAgents();
}

function bcToggle(el, key) {
  el.classList.toggle('on');
  _bcState[key] = el.classList.contains('on');
  // Apply effect immediately
  _bcApply(key, _bcState[key]);
  _saveBotSettings();
}

function _bcApply(key, val) {
  if (key === 'sla' && typeof _slaEnabled !== 'undefined') window._slaEnabled = val;
  if (key === 'dedup') window._dedupEnabled = val !== false;
  // Log it
  _bcLog(`[البوت] ${key} → ${val ? 'مفعّل' : 'معطّل'}`);
}

function bcToggleMaster() {
  _bcState.master = !_bcState.master;
  _saveBotSettings();
  const track = document.getElementById('bc-master-track');
  const thumb  = document.getElementById('bc-master-thumb');
  const dot    = document.getElementById('bc-status-dot');
  const lbl    = document.getElementById('bc-status-label');
  if (_bcState.master) {
    track.style.background = '#1d4ed8';
    thumb.style.left = '22px';
    dot.style.background = '#22c55e';
    dot.style.animationName = 'onlinePulse';
    lbl.textContent = 'البوت نشط • يراقب جميع المجموعات';
    if (typeof showToast === 'function') showToast('🤖 البوت نشط', 'success');
    _bcLog('[البوت] تم تفعيل البوت');
  } else {
    track.style.background = '#374151';
    thumb.style.left = '3px';
    dot.style.background = '#ef4444';
    dot.style.animationName = 'none';
    lbl.textContent = 'البوت متوقف';
    if (typeof showToast === 'function') showToast('⛔ البوت موقوف', 'warning');
    _bcLog('[البوت] تم إيقاف البوت');
    // stop smart mode if running
    if (typeof _botRunning !== 'undefined') window._botRunning = false;
    if (typeof smartMode !== 'undefined' && smartMode) {
      window.smartMode = false;
      const mb = document.getElementById('modeToggle');
      if (mb) { mb.className = 'mode-badge mode-manual'; mb.innerHTML = '✋ وضع يدوي'; }
    }
  }
}

function bcSetSpeed(speed, btn) {
  _bcState.speed = speed;
  document.querySelectorAll('.bc-speed-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _bcLog(`[البوت] سرعة المحاكاة → ${speed}`);
  // The simulator reads _bcState.speed to vary interval (see hook below)
  _saveBotSettings();
}

function bcUpdateDelay(val) {
  _bcState.delayMs = parseInt(val) * 1000;
  document.getElementById('bc-delay-val').textContent = val + ' ثوانٍ';
  // Push to auto-process pipeline
  if (typeof window.PER_TRANSFER_MS !== 'undefined') window.PER_TRANSFER_MS = _bcState.delayMs;
  _bcLog(`[البوت] مدة معالجة الحوالة → ${val}s`);
  _saveBotSettings();
}

function bcUpdateMinAmount(val) {
  _bcState.minTransferAmount = parseInt(val);
  const el = document.getElementById('bc-minamt-val');
  if (el) el.textContent = parseInt(val) === 0 ? 'بدون حد' : parseInt(val) + ' $';
  _bcLog(`[عام] الحد الأدنى للمبلغ → ${val}$`);
  _saveBotSettings();
}

function bcSetDefaultAgent(agentId, btn) {
  _bcState.defaultAgent = agentId;
  document.querySelectorAll('[id^="bc-agent-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Apply to agent selector in form
  const agentEl = document.getElementById('execAgent');
  if (agentEl && agentId !== 'auto') agentEl.value = agentId;
  _bcLog(`[عام] المنفذ الافتراضي → ${agentId}`);
  _saveBotSettings();
}

function bcSetDefaultCurrency(cur, btn) {
  _bcState.defaultCurrency = cur;
  document.querySelectorAll('[id^="bc-cur-def-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Apply to currency field in form
  const curEl = document.getElementById('currency');
  if (curEl) curEl.value = cur;
  _bcLog(`[عام] العملة الافتراضية → ${cur}`);
  if (typeof showToast === 'function') showToast(`💱 العملة الافتراضية: ${cur}`, 'info');
  _saveBotSettings();
}

function bcSetDefaultPriority(priority, btn) {
  _bcState.defaultPriority = priority;
  document.querySelectorAll('[id^="bc-pri-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _bcLog(`[عام] الأولوية الافتراضية → ${priority}`);
  _saveBotSettings();
}

function bcUpdateComm(group, val) {
  _bcState.commRates[group] = parseFloat(val) || 0;
  _bcLog(`[البوت] عمولة ${group} → ${val}%`);
  _saveBotSettings();
}

function bcUpdateMaxMsgs(group, val) {
  const n = parseInt(val) || 1;
  _bcState.maxMsgsPerGroup[group] = n;
  // Sync to simulator so it can enforce the new limit
  if (window.whatsappBotSimulator) window.whatsappBotSimulator.syncLimits();
  _bcLog(`[البوت] الحد الأقصى للرسائل — ${group} → ${n}`);
  _saveBotSettings();
}

function _bcRenderAgents() {
  const agents = [
    { id:'barhoum', name:'برهوم تونس', icon:'🔵', color:'#60a5fa' },
    { id:'agent2',  name:'وكيل 2',     icon:'🟢', color:'#4ade80' },
    { id:'agent3',  name:'وكيل 3',     icon:'🟡', color:'#fde047' },
  ];
  const loads = (typeof _getAgentLoad === 'function') ? _getAgentLoad() : {};
  const list  = document.getElementById('bc-agents-list');
  const caps  = document.getElementById('bc-agent-caps');

  list.innerHTML = agents.map(a => {
    const load = loads[a.id] || 0;
    const cap  = _bcState.agentCaps[a.id] || 5;
    const pct  = Math.min(100, Math.round((load / cap) * 100));
    const barColor = pct < 60 ? '#22c55e' : pct < 85 ? '#fbbf24' : '#ef4444';
    return `<div class="bc-row">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <div style="width:36px;height:36px;border-radius:10px;background:${a.color}18;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${a.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;color:#cbd5e1;margin-bottom:4px;">${a.name}</div>
          <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .4s;"></div>
          </div>
          <div style="font-size:9px;color:#475569;margin-top:2px;">${load} حوالة نشطة • سعة: ${cap}</div>
        </div>
      </div>
      <div id="bc-t-agent-${a.id}" class="bc-toggle on" onclick="bcToggle(this,'agent-${a.id}')"><div class="bc-tog-thumb"></div></div>
    </div>`;
  }).join('');

  caps.innerHTML = agents.map(a => {
    const cap = _bcState.agentCaps[a.id] || 5;
    return `<div class="bc-agent-cap-row">
      <label>${a.icon} ${a.name}</label>
      <input type="range" min="1" max="15" value="${cap}" step="1"
             oninput="bcSetAgentCap('${a.id}',this.value,this.nextElementSibling)">
      <span>${cap} حوالة</span>
    </div>`;
  }).join('');
}

function bcSetAgentCap(agentId, val, span) {
  _bcState.agentCaps[agentId] = parseInt(val);
  if (span) span.textContent = val + ' حوالة';
  _bcLog(`[البوت] سعة ${agentId} → ${val}`);
  _saveBotSettings();
}

function _bcRefreshStats() {
  // Count from live data
  if (typeof transfers !== 'undefined')
    _bcReceived = transfers.length;
  if (typeof execTransfers !== 'undefined')
    _bcExecuted = execTransfers.filter(e => e.status === 'executed').length;
  if (typeof execTransfers !== 'undefined')
    _bcDupes = execTransfers.filter(e => e.isDuplicate).length;

  const r = document.getElementById('bc-s-received');
  const e = document.getElementById('bc-s-executed');
  const d = document.getElementById('bc-s-dupes');
  if (r) r.textContent = _bcReceived;
  if (e) e.textContent = _bcExecuted;
  if (d) d.textContent = _bcDupes;

  // Extended stats
  const history = (typeof transferHistory !== 'undefined') ? transferHistory : [];
  const totalAmt = history.reduce((s,h) => s + (parseFloat(h.amount)||0), 0);
  const amtEl = document.getElementById('bc-s-amount');
  if (amtEl) amtEl.textContent = totalAmt >= 1000
    ? (totalAmt/1000).toFixed(1) + 'K'
    : totalAmt.toFixed(0);

  const total = _bcReceived + history.length;
  const successRate = total > 0 ? Math.round((history.length / total) * 100) : 0;
  const rateEl = document.getElementById('bc-s-rate');
  if (rateEl) {
    rateEl.textContent = successRate + '%';
    rateEl.style.color = successRate >= 80 ? '#22c55e' : successRate >= 50 ? '#fbbf24' : '#ef4444';
  }

  // Avg processing time from history
  const avgEl = document.getElementById('bc-s-avgtime');
  if (avgEl) avgEl.textContent = history.length ? Math.round(_bcState.delayMs / 1000) + 'ث' : '—';

  // Health bars
  const agentLoad = (typeof _getAgentLoad === 'function') ? _getAgentLoad() : {};
  const totalLoad  = Object.values(agentLoad).reduce((s,v)=>s+v,0);
  const totalCap   = Object.values(_bcState.agentCaps).reduce((s,v)=>s+v,0);
  const agentPct   = totalCap > 0 ? Math.min(100, Math.round((totalLoad/totalCap)*100)) : 0;
  const hAgents    = document.getElementById('bc-h-agents');
  if (hAgents) {
    hAgents.style.width = agentPct + '%';
    hAgents.style.background = agentPct < 60 ? '#22c55e' : agentPct < 85 ? '#fbbf24' : '#ef4444';
  }

  // Risk level
  const riskEl = document.getElementById('bc-risk-level');
  if (riskEl) {
    const flags = [_bcState.supervisorapprove, _bcState.dailyfreeze, _bcState.patterndetect, _bcState.dedup].filter(Boolean).length;
    if (flags >= 4) { riskEl.textContent='● عالي'; riskEl.style.color='#22c55e'; }
    else if (flags >= 2) { riskEl.textContent='● متوسط'; riskEl.style.color='#fbbf24'; }
    else { riskEl.textContent='● منخفض'; riskEl.style.color='#ef4444'; }
  }
}

function bcResetAll() {
  if (!confirm('إعادة تعيين جميع الإعدادات للافتراضي؟')) return;
  Object.assign(_bcState, {
    master:true,notify:true,screenshot:true,seccode:true,
    autovalidate:true,autoexec:true,loadbalance:true,
    dedup:true,autoreceipt:true,sla:true,
    autopriority:true,slareassign:false,autoarchive:true,currencydetect:true,
    supervisorapprove:true,autoreject:false,dailywarn:true,dailyfreeze:true,
    patterndetect:true,rapidfire:true,crossgroupcheck:true,
    verboselog:true,autoretry:true,autosave:true,soundalert:false,standby:false,multiuser:false,
    'grp-aswar':true,'grp-abuhashim':true,'grp-random':true,
    speed:'normal',delayMs:4000,
    slaTimeoutMs:60000,autoPriorityThreshold:1000,
    maxTransferAmount:5000,dailyLimitAmount:100000,
    allowedCurrencies:['USD','EUR','TRY','IQD'],
    receiptFields:{name:true,amount:true,code:true,agent:true,time:true,comm:false},
    commRates:{ aswar:2, abuhashim:1.5, random:3 },
    agentCaps:{ barhoum:5, agent2:5, agent3:5 },
    maxMsgsPerGroup:{ aswar:9, abuhashim:9, random:9 },
    defaultAgent:'auto', defaultCurrency:'USD',
    defaultPriority:'normal', minTransferAmount:10,
  });
  // Reset new general settings UI
  document.querySelectorAll('[id^="bc-agent-"],[id^="bc-cur-def-"],[id^="bc-pri-"]').forEach(b => b.classList.remove('active'));
  const da = document.getElementById('bc-agent-auto');  if(da) da.classList.add('active');
  const dc = document.getElementById('bc-cur-def-USD'); if(dc) dc.classList.add('active');
  const dp = document.getElementById('bc-pri-normal');  if(dp) dp.classList.add('active');
  const ms = document.getElementById('bc-minamt-slider'); if(ms) ms.value=10;
  const mv = document.getElementById('bc-minamt-val');    if(mv) mv.textContent='10 $';
  // Reset new sliders
  const slaSlider = document.getElementById('bc-sla-slider');
  if (slaSlider) { slaSlider.value=60; document.getElementById('bc-sla-val').textContent='60 ثانية'; }
  const priSlider = document.getElementById('bc-autopri-slider');
  if (priSlider) { priSlider.value=1000; document.getElementById('bc-autopri-val').textContent='1,000 $'; }
  const maxSlider = document.getElementById('bc-maxamt-slider');
  if (maxSlider) { maxSlider.value=5000; document.getElementById('bc-maxamt-val').textContent='5,000 $'; }
  const daySlider = document.getElementById('bc-dailylimit-slider');
  if (daySlider) { daySlider.value=100000; document.getElementById('bc-dailylimit-val').textContent='100,000 $'; }
  // Reset simulator counts so it can start fresh
  if (window.whatsappBotSimulator) {
    window.whatsappBotSimulator._groupCounts = { aswar:0, abuhashim:0, random:0 };
    window.whatsappBotSimulator._groupLimits = { aswar:9, abuhashim:9, random:9 };
    window.whatsappBotSimulator._usedIndexes.clear();
  }
  document.getElementById('bc-maxmsgs-aswar').value = 9;
  document.getElementById('bc-maxmsgs-abuhashim').value = 9;
  document.getElementById('bc-maxmsgs-random').value = 9;
  // Reset toggles in DOM
  document.querySelectorAll('.bc-toggle').forEach(t => {
    t.classList.add('on');
    t.querySelector('.bc-tog-thumb').style.left = '21px';
  });
  document.querySelectorAll('.bc-speed-btn').forEach(b => b.classList.remove('active'));
  const norm = document.querySelector('.bc-speed-btn:nth-child(2)');
  if (norm) norm.classList.add('active');
  document.getElementById('bc-delay-slider').value = 4;
  document.getElementById('bc-delay-val').textContent = '4 ثوانٍ';
  document.getElementById('bc-comm-aswar').value = 2;
  document.getElementById('bc-comm-abuhashim').value = 1.5;
  document.getElementById('bc-comm-random').value = 3;
  _bcLog('[البوت] تم إعادة تعيين جميع الإعدادات');
  if (typeof showToast === 'function') showToast('↺ تم إعادة التعيين', 'info');
}

// ── New settings functions ──

function bcUpdateSlaTimeout(val) {
  _bcState.slaTimeoutMs = parseInt(val) * 1000;
  const el = document.getElementById('bc-sla-val');
  if (el) el.textContent = val >= 60 ? Math.floor(val/60) + ' دق' : val + ' ثانية';
  if (typeof window.SLA_LIMIT_MS !== 'undefined') window.SLA_LIMIT_MS = _bcState.slaTimeoutMs;
  _bcLog(`[الأمان] مهلة SLA → ${val}ث`);
  _saveBotSettings();
}

function bcUpdateAutoPriority(val) {
  _bcState.autoPriorityThreshold = parseInt(val);
  const el = document.getElementById('bc-autopri-val');
  if (el) el.textContent = parseInt(val).toLocaleString() + ' $';
  _bcLog(`[المهام] حد الأولوية التلقائية → ${val}$`);
  _saveBotSettings();
}

function bcUpdateMaxAmount(val) {
  _bcState.maxTransferAmount = parseInt(val);
  const el = document.getElementById('bc-maxamt-val');
  if (el) el.textContent = parseInt(val).toLocaleString() + ' $';
  _bcLog(`[الأمان] الحد الأقصى للحوالة → ${val}$`);
  _bcRefreshStats();
  _saveBotSettings();
}

function bcUpdateDailyLimit(val) {
  _bcState.dailyLimitAmount = parseInt(val);
  const el = document.getElementById('bc-dailylimit-val');
  if (el) el.textContent = parseInt(val).toLocaleString() + ' $';
  _bcLog(`[الأمان] الحد اليومي → ${val}$`);
  _saveBotSettings();
}

function bcToggleCurrency(cur, enabled) {
  const chip = document.getElementById('bc-cur-' + cur);
  if (enabled) {
    if (!_bcState.allowedCurrencies.includes(cur)) _bcState.allowedCurrencies.push(cur);
    if (chip) chip.querySelector('input').checked = true;
  } else {
    _bcState.allowedCurrencies = _bcState.allowedCurrencies.filter(c => c !== cur);
    if (chip) chip.querySelector('input').checked = false;
  }
  _bcLog(`[الأمان] عملة ${cur} → ${enabled ? 'مسموح' : 'محظور'}`);
  _saveBotSettings();
}

function bcToggleReceiptField(field, enabled) {
  _bcState.receiptFields[field] = enabled;
  _bcLog(`[متقدم] حقل الوصل "${field}" → ${enabled ? 'مُضمَّن' : 'محذوف'}`);
}

function bcClearHistory() {
  if (typeof clearHistory === 'function') {
    clearHistory(); // delegates to the proper function in transactions.js
  }
  _bcLog('[متقدم] تم مسح سجل الحوالات');
}

function bcClearExec() {
  if (!confirm('مسح جميع حوالات التنفيذ النشطة؟')) return;
  if (typeof execTransfers !== 'undefined') window.execTransfers = [];
  if (typeof executions    !== 'undefined') window.executions    = [];
  if (typeof renderExecutions === 'function') renderExecutions();
  if (typeof renderExecBubbles === 'function') renderExecBubbles();
  if (typeof computeStats === 'function') computeStats();
  _bcLog('[متقدم] تم مسح حوالات التنفيذ');
  if (typeof showToast === 'function') showToast('⚡ تم مسح التنفيذ', 'info');
}

function bcExportLog() {
  const log = document.getElementById('bc-log');
  if (!log) return;
  const lines = Array.from(log.children).map(d => d.textContent).join('\n');
  const blob  = new Blob([lines], { type:'text/plain;charset=utf-8' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = 'bot-log-' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
  URL.revokeObjectURL(url);
  _bcLog('[متقدم] تم تصدير السجل');
}

// Expose security config to transactions.js
window._bcSecurity = () => ({
  maxTransferAmount:    _bcState.maxTransferAmount,
  dailyLimitAmount:     _bcState.dailyLimitAmount,
  supervisorapprove:    _bcState.supervisorapprove,
  autoreject:           _bcState.autoreject,
  allowedCurrencies:    _bcState.allowedCurrencies,
  autoPriorityThreshold:_bcState.autoPriorityThreshold,
  slaTimeoutMs:         _bcState.slaTimeoutMs,
  receiptFields:        _bcState.receiptFields,
});

function _bcLog(msg) {
  const log = document.getElementById('bc-log');
  if (!log) return;
  const d = document.createElement('div');
  const now = new Date().toLocaleTimeString('ar', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  d.textContent = `[${now}] ${msg}`;
  d.style.color = msg.includes('معطّل') || msg.includes('موقوف') ? '#f87171' : '#60a5fa';
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

// ── Hook: expose commission rates to transactions.js ──
window._bcCommRates = () => _bcState.commRates;

// ── Update stats counter when bot receives/executes ──
const _origConfExec = window.confirmExecution;
window.confirmExecution = function() {
  if (typeof _origConfExec === 'function') _origConfExec.apply(this, arguments);
  _bcExecuted++;
};

// Log bot message reception
document.addEventListener('bc-msg-received', () => {
  _bcReceived++;
  _bcLog('[البوت] رسالة جديدة واردة');
});
