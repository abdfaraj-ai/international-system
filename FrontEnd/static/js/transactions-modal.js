/* ══════════════════════════════════════════════
   SHARED MODAL CORE LOGIC
══════════════════════════════════════════════ */

/* ── Tab switcher ── */
function mcSwitchTab(modal, panel, btn) {
  const prefix = modal === 'exec' ? 'exec' : 'src';
  ['send','history','schedule'].forEach(p => {
    const el = document.getElementById(`${prefix}-panel-${p}`);
    const tb = document.getElementById(`${prefix}-tab-${p}`);
    if (el) el.style.display = p === panel ? (p === 'send' ? 'flex' : 'block') : 'none';
    if (tb) {
      const c = modal === 'exec' ? '#32b8c6' : '#25D366';
      tb.style.color = p === panel ? c : '#8696a0';
      tb.style.borderBottomColor = p === panel ? c : 'transparent';
    }
  });
}

/* ── Emoji toggle ── */
function mcToggleEmoji(modal) {
  const id = modal === 'exec' ? 'execEmojiRow' : 'srcEmojiRow';
  const btn = document.getElementById(modal === 'exec' ? 'execEmojiToggleBtn' : 'srcEmojiToggleBtn');
  const el = document.getElementById(id);
  const isVisible = el.style.display !== 'none';
  el.style.display = isVisible ? 'none' : 'flex';
  const c = modal === 'exec' ? 'rgba(50,184,198,0.3)' : 'rgba(37,211,102,0.3)';
  btn.style.background = isVisible ? (modal === 'exec' ? 'rgba(50,184,198,0.08)' : 'rgba(37,211,102,0.08)') : c;
}

/* ── Insert emoji at cursor ── */
function mcInsertEmoji(modal, emoji) {
  const ta = document.getElementById(modal === 'exec' ? 'execMsgText' : 'msgText');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0,s) + emoji + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + emoji.length;
  ta.focus();
  modal === 'exec' ? mcTextInput('exec', ta) : mcTextInput('src', ta);
}

/* ── Format (bold/italic with markdown) ── */
function mcFormat(modal, type) {
  const ta = document.getElementById(modal === 'exec' ? 'execMsgText' : 'msgText');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e) || 'نص';
  const wrap = type === 'bold' ? '*' : '_';
  const wrapped = `${wrap}${sel}${wrap}`;
  ta.value = ta.value.slice(0,s) + wrapped + ta.value.slice(e);
  ta.selectionStart = s + 1; ta.selectionEnd = s + 1 + sel.length;
  ta.focus();
  modal === 'exec' ? mcTextInput('exec', ta) : mcTextInput('src', ta);
}

/* ── Textarea auto-grow + char bar ── */
function mcTextInput(modal, el) {
  // auto-grow
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  const len = el.value.length;
  const pct = Math.min(len / 500 * 100, 100);
  const barColor = len > 450 ? 'linear-gradient(90deg,#ef4444,#dc2626)' : len > 350 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : (modal === 'exec' ? 'linear-gradient(90deg,#32b8c6,#0e6b7a)' : 'linear-gradient(90deg,#25D366,#075E54)');
  const countColor = len > 450 ? '#ef4444' : len > 350 ? '#f59e0b' : '#8696a0';
  if (modal === 'exec') {
    document.getElementById('execCharBar').style.width = pct + '%';
    document.getElementById('execCharBar').style.background = barColor;
    document.getElementById('execCharCount').textContent = `${len} / 500`;
    document.getElementById('execCharCount').style.color = countColor;
  } else {
    document.getElementById('srcCharBar').style.width = pct + '%';
    document.getElementById('srcCharBar').style.background = barColor;
    document.getElementById('charCount').textContent = `${len} / 500`;
    document.getElementById('charCount').style.color = countColor;
  }
}

/* ── Ctrl+Enter to send ── */
function mcKeyDown(modal, e) {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    modal === 'exec' ? sendExecMsg() : sendMsgToGroup();
  }
}

/* ══════════════════════════════════════════════
   مراسلة المنفذ – Logic
══════════════════════════════════════════════ */
let _selectedExecAgent = '';
let _selectedExecAgentLabel = '';
let _selectedExecAgentWhatsapp = '';
let _execMsgType = 'instruction';
let _execPriority = 'normal';
let _execSentCount = 0;
const _execTypeLabels  = { instruction:'📋 تعليمات', urgent:'🚨 عاجل', confirm:'✅ تأكيد', cancel:'❌ إلغاء', query:'❓ استفسار' };

function openExecMsgModal() {
  const m = document.getElementById('execMsgModal');
  m.style.display = 'flex';
  mcSwitchTab('exec','send', document.getElementById('exec-tab-send'));
  const activeTab = document.querySelector('.wa-src-tab.active[id^="etab"]');
  if (activeTab) {
    const g = activeTab.id.replace('etab-','');
    const card = document.querySelector(`.exec-agent-btn[data-agent="${g}"]`);
    if (card) selectExecAgent(card, g);
  }
  setTimeout(()=>{ const t=document.getElementById('execMsgText'); if(t)t.focus(); },220);
}

function closeExecMsgModal() {
  const m = document.getElementById('execMsgModal');
  m.style.opacity='0'; m.style.transition='opacity .18s';
  setTimeout(()=>{ m.style.display='none'; m.style.opacity=''; m.style.transition=''; },180);
}

function selectExecAgent(el, agent) {
  _selectedExecAgent = agent;
  const nameEl = el.querySelector('[data-name]');
  _selectedExecAgentLabel = (nameEl ? nameEl.dataset.name : null)
    || el.dataset.agentName
    || agent;
  _selectedExecAgentWhatsapp = el.dataset.whatsapp || '';
  document.querySelectorAll('.exec-agent-btn').forEach(b => b.classList.remove('exec-active-agent'));
  el.classList.add('exec-active-agent');
  const lbl = document.getElementById('execSelectedAgentLabel');
  if (lbl) lbl.textContent = _selectedExecAgentLabel;
}

function setExecMsgType(el, type) {
  _execMsgType = type;
  document.querySelectorAll('.exec-type-chip').forEach(b => b.classList.remove('exec-type-active'));
  el.classList.add('exec-type-active');
}

function setExecPriority(el, priority, label, bg, color, border) {
  _execPriority = priority;
  document.querySelectorAll('#execPriorityBar .mc-pri-btn').forEach(b => {
    b.classList.remove('exec-pri-active');
    b.style.background='rgba(255,255,255,0.04)'; b.style.color='#8696a0'; b.style.borderColor='rgba(255,255,255,0.1)';
  });
  el.style.background=bg; el.style.color=color; el.style.borderColor=border;
  el.classList.add('exec-pri-active');
  const lbl = document.getElementById('execPriorityLabel');
  lbl.textContent=label; lbl.style.color=color; lbl.style.background=bg; lbl.style.borderColor=border;
}

function insertExecQuickMsg(text) {
  const t = document.getElementById('execMsgText');
  if (!t) return;
  t.value = text; mcTextInput('exec', t); t.focus();
}

function clearExecMsgText() {
  const t = document.getElementById('execMsgText');
  if (t) { t.value=''; t.style.height='auto'; mcTextInput('exec',t); }
}

function clearExecHistory() {
  const l = document.getElementById('execHistoryList');
  if (l) l.innerHTML='<div style="text-align:center;padding:30px;color:#4d6080;font-size:11px;">السجل فارغ</div>';
}

function addExecScheduledMsg() {
  const txt = document.getElementById('execScheduleText').value.trim();
  const date = document.getElementById('execScheduleDate').value;
  const time = document.getElementById('execScheduleTime').value;
  if (!txt || !date || !time) return;
  const list = document.getElementById('execScheduledList');
  const item = document.createElement('div');
  item.className='mc-sched-item';
  item.innerHTML=`<span style="font-size:16px;">⏰</span><div style="flex:1"><div style="font-size:11px;font-weight:700;color:#e9edef;">${txt.substring(0,40)}${txt.length>40?'...':''}</div><div style="font-size:10px;color:#32b8c6;margin-top:2px;">${date} الساعة ${time} → ${_selectedExecAgentLabel}</div></div><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#8696a0;cursor:pointer;font-size:14px;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#8696a0'">✕</button>`;
  const empty = list.querySelector('div[style*="text-align:center"]');
  if (empty) empty.remove();
  list.appendChild(item);
  document.getElementById('execScheduleText').value='';
}

function sendExecMsg() {
  const txt = (document.getElementById('execMsgText')||{}).value || '';
  if (!txt.trim()) {
    const cb = document.getElementById('execComposeBox');
    cb.style.borderColor='#ef4444'; cb.style.boxShadow='0 0 0 3px rgba(239,68,68,0.12)';
    setTimeout(()=>{ cb.style.borderColor='rgba(50,184,198,0.18)'; cb.style.boxShadow='none'; },1800);
    return;
  }
  const btn = document.getElementById('sendExecMsgBtn');
  const dot = document.getElementById('execSendingDot');
  const lbl = document.getElementById('sendExecMsgLabel');
  btn.disabled=true; dot.style.display='block';
  lbl.textContent='جاري الإرسال...';
  btn.style.background='linear-gradient(135deg,#2a9aaa,#0a5060)';
  setTimeout(()=>{
    // add to history
    const hl = document.getElementById('execHistoryList');
    const empty = hl.querySelector('div[style*="text-align:center"]');
    if (empty) empty.remove();
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
    const item = document.createElement('div');
    item.className='mc-history-item'; item.style.animation='mcFadeIn .4s ease';
    item.innerHTML=`<div class="mc-hi-meta"><span class="mc-hi-group">${_selectedExecAgentLabel}</span><span class="mc-hi-time">${timeStr}</span></div><div class="mc-hi-bubble" style="background:rgba(50,184,198,0.1);border-right:3px solid #32b8c6;">${txt}</div><div class="mc-hi-status"><span class="mc-ticks sent">✓</span> مُرسل</div>`;
    hl.insertBefore(item, hl.firstChild);
    // update counter
    _execSentCount++;
    document.getElementById('execSentTodayCount').textContent = _execSentCount;
    closeExecMsgModal();
    const ta = document.getElementById('execMsgText');
    ta.value=''; ta.style.height='auto'; mcTextInput('exec',ta);
    btn.disabled=false; dot.style.display='none';
    lbl.textContent='إرسال التعليمات';
    btn.style.background='linear-gradient(135deg,#32b8c6,#0e6b7a)';
    if (typeof showToast==='function')
      showToast(`⚡ تم إرسال التعليمات إلى ${_selectedExecAgentLabel}`, 'success');
  }, 1400);
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('execMsgModal').addEventListener('click', function(e){ if(e.target===this) closeExecMsgModal(); });
});

/* ══════════════════════════════════════════════
   مراسلة المصدر – Logic
══════════════════════════════════════════════ */
let _selectedMsgGroup = '';
let _selectedMsgGroupLabel = '';
let _selectedMsgGroupWhatsapp = '';
let _srcPriority = 'normal';
let _srcSentCount = 0;

function openMsgModal() {
  const m = document.getElementById('msgModal');
  m.style.display = 'flex';
  mcSwitchTab('src','send', document.getElementById('src-tab-send'));

  // حدد المصدر تلقائياً من الحوالة المختارة حالياً
  if (typeof _selectedId !== 'undefined' && _selectedId !== null && typeof transfers !== 'undefined') {
    const t = transfers.find(x => x.id === _selectedId);
    if (t) {
      const srcPhone = (t.replyPhone || '')
        || (t.senderJid || '').replace(/@\S+/g,'')
        || (t.jid || '').replace(/@\S+/g,'')
        || (t.phone || '');
      const srcName = String(t.sender || t.name || t.groupName || t.senderName || srcPhone || 'مصدر غير معروف');
      _selectedMsgGroup         = srcPhone || 'src';
      _selectedMsgGroupLabel    = srcName;
      _selectedMsgGroupWhatsapp = srcPhone;
      const lbl = document.getElementById('selectedGroupLabel');
      if (lbl) lbl.textContent = srcName + (srcPhone ? ` (${srcPhone})` : ' ⚠️ لا يوجد رقم');
      console.log('mraslat almasdar: id=' + t.id + ' phone=' + srcPhone + ' name=' + srcName + ' sender=' + t.sender + ' jid=' + t.jid + ' senderJid=' + t.senderJid);
    } else {
      console.warn('⚠️ openMsgModal: لم يُعثر على transfer للـ id:', _selectedId);
    }
  }

  setTimeout(()=>{ const t=document.getElementById('msgText'); if(t)t.focus(); },220);
}

function closeMsgModal() {
  const m = document.getElementById('msgModal');
  m.style.opacity='0'; m.style.transition='opacity .18s';
  setTimeout(()=>{ m.style.display='none'; m.style.opacity=''; m.style.transition=''; },180);
}

function selectMsgGroup(el, group) {
  _selectedMsgGroup = group;
  // اقرأ الاسم من data-name أو من النص المرئي الأول داخل البطاقة
  const nameEl = el.querySelector('[data-name]');
  _selectedMsgGroupLabel = (nameEl ? nameEl.dataset.name : null)
    || el.dataset.agentName
    || group;
  _selectedMsgGroupWhatsapp = el.dataset.whatsapp || '';
  document.querySelectorAll('.msg-group-btn').forEach(b => b.classList.remove('active-group'));
  el.classList.add('active-group');
  const lbl = document.getElementById('selectedGroupLabel');
  if (lbl) lbl.textContent = _selectedMsgGroupLabel;
}

function setSrcPriority(el, priority, label, bg, color, border) {
  _srcPriority = priority;
  document.querySelectorAll('#srcPriorityBar .mc-pri-btn').forEach(b => {
    b.classList.remove('src-pri-active');
    b.style.background='rgba(255,255,255,0.04)'; b.style.color='#8696a0'; b.style.borderColor='rgba(255,255,255,0.1)';
  });
  el.style.background=bg; el.style.color=color; el.style.borderColor=border;
  el.classList.add('src-pri-active');
  const lbl = document.getElementById('srcPriorityLabel');
  lbl.textContent=label; lbl.style.color=color; lbl.style.background=bg; lbl.style.borderColor=border;
}

function insertQuickMsg(text) {
  const t = document.getElementById('msgText');
  if (!t) return;
  t.value = text; mcTextInput('src', t); t.focus();
}

function clearMsgText() {
  const t = document.getElementById('msgText');
  if (t) { t.value=''; t.style.height='auto'; mcTextInput('src',t); }
}

function clearSrcHistory() {
  const l = document.getElementById('srcHistoryList');
  if (l) l.innerHTML='<div style="text-align:center;padding:30px;color:#4d6080;font-size:11px;">السجل فارغ</div>';
}

function addSrcScheduledMsg() {
  const txt = document.getElementById('srcScheduleText').value.trim();
  const date = document.getElementById('srcScheduleDate').value;
  const time = document.getElementById('srcScheduleTime').value;
  if (!txt || !date || !time) return;
  const list = document.getElementById('srcScheduledList');
  const item = document.createElement('div');
  item.className='mc-sched-item';
  item.innerHTML=`<span style="font-size:16px;">⏰</span><div style="flex:1"><div style="font-size:11px;font-weight:700;color:#e9edef;">${txt.substring(0,40)}${txt.length>40?'...':''}</div><div style="font-size:10px;color:#25D366;margin-top:2px;">${date} الساعة ${time} → ${_selectedMsgGroupLabel}</div></div><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#8696a0;cursor:pointer;font-size:14px;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#8696a0'">✕</button>`;
  const empty = list.querySelector('div[style*="text-align:center"]');
  if (empty) empty.remove();
  list.appendChild(item);
  document.getElementById('srcScheduleText').value='';
}

async function sendMsgToGroup() {
  const txt = (document.getElementById('msgText')||{}).value || '';
  if (!txt.trim()) {
    const cb = document.getElementById('srcComposeBox');
    cb.style.borderColor='#ef4444'; cb.style.boxShadow='0 0 0 3px rgba(239,68,68,0.12)';
    setTimeout(()=>{ cb.style.borderColor='rgba(37,211,102,0.18)'; cb.style.boxShadow='none'; },1800);
    return;
  }
  console.log('sendMsgToGroup state: group=' + _selectedMsgGroup + ' | label=' + _selectedMsgGroupLabel + ' | phone=' + _selectedMsgGroupWhatsapp);
  if (!_selectedMsgGroupWhatsapp) {
    if (typeof showToast==='function') showToast('⚠️ لا يوجد رقم واتساب للمصدر — اختر حوالة أولاً أو تحقق من بيانات المرسل', 'error');
    return;
  }
  const btn = document.getElementById('sendMsgBtn');
  const dot = document.getElementById('srcSendingDot');
  const lbl = document.getElementById('sendMsgLabel');
  btn.disabled=true; dot.style.display='block';
  lbl.textContent='جاري الإرسال...';
  btn.style.background='linear-gradient(135deg,#1aaa52,#054a38)';
  try {
    const result = await waBridgeSendToAgent({
      toNumber: _selectedMsgGroupWhatsapp,
      message: txt,
      transferCode: '',
      agentId: _selectedMsgGroup,
    });
    const hl = document.getElementById('srcHistoryList');
    const empty = hl.querySelector('div[style*="text-align:center"]');
    if (empty) empty.remove();
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
    const item = document.createElement('div');
    item.className='mc-history-item'; item.style.animation='mcFadeIn .4s ease';
    const statusHtml = result.ok
      ? '<div class="mc-hi-status"><span class="mc-ticks sent">✓✓</span> مُرسل عبر واتساب</div>'
      : `<div class="mc-hi-status" style="color:#ef4444;">⚠️ فشل: ${result.error||'خطأ'}</div>`;
    item.innerHTML=`<div class="mc-hi-meta"><span class="mc-hi-group">${_selectedMsgGroupLabel}</span><span class="mc-hi-time">${timeStr}</span></div><div class="mc-hi-bubble" style="background:rgba(37,211,102,0.1);border-right:3px solid #25D366;">${txt}</div>${statusHtml}`;
    hl.insertBefore(item, hl.firstChild);
    _srcSentCount++;
    document.getElementById('srcSentTodayCount').textContent = _srcSentCount;
    closeMsgModal();
    const ta = document.getElementById('msgText');
    ta.value=''; ta.style.height='auto'; mcTextInput('src',ta);
    btn.disabled=false; dot.style.display='none';
    lbl.textContent='إرسال'; btn.style.background='linear-gradient(135deg,#25D366,#075E54)';
    if (result.ok) {
      mcShowSuccess('rgb(37,211,102)', `إلى: ${_selectedMsgGroupLabel}`);
      if (typeof showToast==='function') showToast(`✅ تم إرسال الرسالة إلى ${_selectedMsgGroupLabel}`, 'success');
    } else {
      if (typeof showToast==='function') showToast(`⚠️ فشل الإرسال: ${result.error||'خطأ'}`, 'error');
    }
  } catch(e) {
    btn.disabled=false; dot.style.display='none';
    lbl.textContent='إرسال'; btn.style.background='linear-gradient(135deg,#25D366,#075E54)';
    if (typeof showToast==='function') showToast('⚠️ خطأ في الإرسال', 'error');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('msgModal').addEventListener('click', function(e){ if(e.target===this) closeMsgModal(); });

  // Escape closes whichever modal is open
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    if (document.getElementById('execMsgModal').style.display==='flex') closeExecMsgModal();
    if (document.getElementById('msgModal').style.display==='flex') closeMsgModal();
  });

  document.getElementById('sendExecMsgBtn').addEventListener('mousedown', function(e){ mcRipple(e,this); });
  document.getElementById('sendMsgBtn').addEventListener('mousedown', function(e){ mcRipple(e,this); });
});

// Legacy compat
function updateCharCount(el){ mcTextInput('src',el); }
function updateExecCharCount(el){ mcTextInput('exec',el); }

/* ── تشخيص رقم الهاتف ── */
async function debugCheckSrcNumber() {
  const phone = _selectedMsgGroupWhatsapp;
  if (!phone) {
    if (typeof showToast==='function') showToast('⚠️ لا يوجد رقم — اختر حوالة أولاً', 'error');
    return;
  }
  if (typeof showToast==='function') showToast('🔍 جاري فحص الرقم ' + phone + ' ...', 'info');
  try {
    const r = await waBridgeCheckNumber(phone);
    if (r.ok && r.exists) {
      if (typeof showToast==='function') showToast('✅ الرقم ' + r.cleaned + ' مسجّل على واتساب', 'success');
    } else if (r.ok && r.exists === false) {
      if (typeof showToast==='function') showToast('❌ الرقم ' + r.cleaned + ' غير موجود على واتساب', 'error');
    } else {
      if (typeof showToast==='function') showToast('⚠️ ' + (r.error || 'خطأ في الفحص'), 'error');
    }
    console.log('debugCheckSrcNumber result:', JSON.stringify(r));
  } catch(e) {
    if (typeof showToast==='function') showToast('⚠️ خطأ: ' + e.message, 'error');
  }
}

/* ══════════════════════════════════════════════
   RIPPLE EFFECT on send buttons
══════════════════════════════════════════════ */
function mcRipple(e, btn) {
  const r = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,0.25);transform:scale(0);animation:ripple .55s ease-out forwards;top:${e.clientY-rect.top-size/2}px;left:${e.clientX-rect.left-size/2}px;pointer-events:none;`;
  btn.appendChild(r);
  setTimeout(()=>r.remove(), 600);
}

/* ══════════════════════════════════════════════
   SUCCESS OVERLAY
══════════════════════════════════════════════ */
function mcShowSuccess(color, label) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);animation:mcFadeIn .15s ease;`;
  overlay.innerHTML = `
    <div style="text-align:center;animation:mcSlideUp .3s cubic-bezier(.34,1.56,.64,1);">
      <div style="width:80px;height:80px;border-radius:50%;background:${color};margin:0 auto 16px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 12px ${color.replace(')',',0.2)').replace('rgb','rgba')},0 8px 32px ${color.replace(')',',0.5)').replace('rgb','rgba')};animation:sendSuccess .4s cubic-bezier(.34,1.56,.64,1);">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      </div>
      <div style="font-size:15px;font-weight:800;color:#e9edef;letter-spacing:.3px;">${label}</div>
      <div style="font-size:11px;color:#8696a0;margin-top:6px;">تم الإرسال بنجاح ✓</div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(()=>{ overlay.style.opacity='0'; overlay.style.transition='opacity .2s'; setTimeout(()=>overlay.remove(),200); }, 1200);
}

/* ══════════════════════════════════════════════
   LIVE PREVIEW in send tab
══════════════════════════════════════════════ */
function mcRefreshPreview(modal) {
  const txtId  = modal === 'exec' ? 'execMsgText' : 'msgText';
  const boxId  = modal === 'exec' ? 'execLivePreview' : 'srcLivePreview';
  const textId = modal === 'exec' ? 'execLivePreviewText' : 'srcLivePreviewText';
  const metaId = modal === 'exec' ? 'execLivePreviewMeta' : 'srcLivePreviewMeta';
  const color  = modal === 'exec' ? '#32b8c6' : '#25D366';
  const ta     = document.getElementById(txtId);
  const box    = document.getElementById(boxId);
  if (!ta || !box) return;
  const txt = ta.value.trim();
  box.style.display = txt ? 'block' : 'none';
  if (!txt) return;
  const now = new Date();
  const time = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  const target = modal === 'exec' ? (_selectedExecAgentLabel||'الكل') : (_selectedMsgGroupLabel||'الكل');
  document.getElementById(textId).textContent = txt;
  document.getElementById(metaId).innerHTML = `<span style="color:${color};">${target}</span> • ${time}`;
}

// Hook into mcTextInput for live preview
const _origMcTextInput = mcTextInput;
window.mcTextInput = function(modal, el) {
  _origMcTextInput(modal, el);
  mcRefreshPreview(modal);
};
// Hook into selectMsgGroup / selectExecAgent for live preview update
const _origSelectMsgGroup = selectMsgGroup;
window.selectMsgGroup = function(el, group) {
  _origSelectMsgGroup(el, group);
  mcRefreshPreview('src');
};
const _origSelectExecAgent = selectExecAgent;
window.selectExecAgent = function(el, agent) {
  _origSelectExecAgent(el, agent);
  mcRefreshPreview('exec');
};

// Hook sendExecMsg to send via WhatsApp and show success overlay
const _origSendExecMsg = sendExecMsg;
window.sendExecMsg = async function() {
  const txt = (document.getElementById('execMsgText')||{}).value||'';
  if (!txt.trim()) { _origSendExecMsg(); return; }
  if (!_selectedExecAgentWhatsapp) {
    if (typeof showToast==='function') showToast('⚠️ اختر وكيلاً أولاً', 'error');
    return;
  }
  const btn = document.getElementById('sendExecMsgBtn');
  const lbl = document.getElementById('sendExecMsgLabel');
  const dot = document.getElementById('execSendingDot');
  btn.disabled=true; dot.style.display='block'; lbl.textContent='جاري الإرسال...';
  btn.style.background='linear-gradient(135deg,#2a9aaa,#0a5060)';
  try {
    const result = await waBridgeSendToAgent({
      toNumber: _selectedExecAgentWhatsapp,
      message: txt,
      transferCode: '',
      agentId: _selectedExecAgent,
    });
    const hl = document.getElementById('execHistoryList');
    const empty = hl.querySelector('div[style*="text-align:center"]');
    if (empty) empty.remove();
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
    const item = document.createElement('div');
    item.className='mc-history-item'; item.style.animation='mcFadeIn .4s ease';
    const statusHtml = result.ok
      ? '<div class="mc-hi-status"><span class="mc-ticks sent">✓✓</span> مُرسل عبر واتساب</div>'
      : `<div class="mc-hi-status" style="color:#ef4444;">⚠️ فشل: ${result.error||'خطأ'}</div>`;
    item.innerHTML=`<div class="mc-hi-meta"><span class="mc-hi-group">${_selectedExecAgentLabel}</span><span class="mc-hi-time">${timeStr}</span></div><div class="mc-hi-bubble" style="background:rgba(50,184,198,0.1);border-right:3px solid #32b8c6;">${txt}</div>${statusHtml}`;
    hl.insertBefore(item, hl.firstChild);
    _execSentCount++;
    document.getElementById('execSentTodayCount').textContent = _execSentCount;
    closeExecMsgModal();
    const ta = document.getElementById('execMsgText');
    ta.value=''; ta.style.height='auto'; mcTextInput('exec',ta);
    btn.disabled=false; dot.style.display='none'; lbl.textContent='إرسال التعليمات';
    btn.style.background='linear-gradient(135deg,#32b8c6,#0e6b7a)';
    if (result.ok) {
      mcShowSuccess('rgb(50,184,198)', `إلى: ${_selectedExecAgentLabel}`);
      if (typeof showToast==='function') showToast(`⚡ تم إرسال التعليمات إلى ${_selectedExecAgentLabel}`, 'success');
    } else {
      if (typeof showToast==='function') showToast(`⚠️ فشل الإرسال: ${result.error||'خطأ'}`, 'error');
    }
  } catch(e) {
    btn.disabled=false; dot.style.display='none'; lbl.textContent='إرسال التعليمات';
    btn.style.background='linear-gradient(135deg,#32b8c6,#0e6b7a)';
    if (typeof showToast==='function') showToast('⚠️ خطأ في الإرسال', 'error');
  }
};
