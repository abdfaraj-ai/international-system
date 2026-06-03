// ════════════════════════════════════════════════════════════════════
//  bot-extension.js  —  WhatsApp Bot Simulator (12 Features)
//  Pure frontend, no API, no backend.
// ════════════════════════════════════════════════════════════════════

'use strict';

// ── FEATURE 9: transferHistory is declared in transactions.js (shared global)
// Do NOT redeclare here — bot-extension.js uses the same array.
let currentGroupId  = 'aswar';       // tracks active group for corrections
let _nextBotId      = 1000;          // auto-increment id for bot-created transfers

// ════════════════════════════════════════════════════════════════════
//  FEATURE 2 — MESSAGE PARSER
// ════════════════════════════════════════════════════════════════════
function parseWhatsAppMessage(text) {
    // ── Currency ──
    let currency = 'USD';
    if (/دولار|dollar|usd/i.test(text))       currency = 'USD';
    else if (/شيكل|شكل|ils/i.test(text))      currency = 'ILS';
    else if (/دينار|jod/i.test(text))          currency = 'JOD';

    // ── Amount ──
    const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

    // ── Name — after trigger keywords ──
    const nameMatch = text.match(
        /(?:سلم|حول|لـ?|الى|إلى|to|send\s+\d+\s+\w+\s+to|على\s+اسم)\s+([^\d\n،,]+?)(?=\s*\d|\s*$)/i
    );
    let name = 'مجهول';
    if (nameMatch && nameMatch[1].trim().length > 1) {
        name = nameMatch[1].trim();
    } else {
        // fallback: grab 2+ consecutive Arabic/English words not near a number
        const words = text.replace(/\d+/g, '').match(/[\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,})+/);
        if (words) name = words[0].trim();
    }

    // ── Wallet / Bank Account — detect number, then classify by message context ──
    let wallet = null;

    // Priority 1: IBAN (PS92 / JO94 / SA00...)
    const ibanMatch = text.match(/\b([A-Z]{2}\d{2}[A-Z0-9]{4,30})\b/);

    // Priority 2: International phone (+972... / +962...)
    const intlPhoneMatch = !ibanMatch && text.match(/(\+\d{3}[\s\-]?\d{7,12})/);

    // Priority 3: Local mobile 05x / 07x  (Palestinian / Jordanian)
    const localMobileMatch = !ibanMatch && !intlPhoneMatch && text.match(/\b(0[57]\d{7,9})\b/);

    // Priority 4: Long digit string 8–14 digits (bank account)
    const longNumMatch = !ibanMatch && !intlPhoneMatch && !localMobileMatch && text.match(/\b(\d{8,14})\b/);

    if (ibanMatch) {
        wallet = { type: 'iban', number: ibanMatch[1] };
    } else if (intlPhoneMatch) {
        wallet = { type: 'phone', number: intlPhoneMatch[1].replace(/[\s\-]/g, '') };
    } else if (localMobileMatch) {
        // Distinguish ewallet vs phone-transfer by keywords in message
        const ewalletKw = /محفظة|wallet|ووري|ooredoo|jawwal\s*pay|فلسطين\s*بايمنت|بايمنت/i.test(text);
        const phoneKw   = /هاتف|جوال|موبايل|phone|mobile|على\s*الجوال|التحويل\s*الهاتفي/i.test(text);
        wallet = { type: phoneKw && !ewalletKw ? 'phone' : 'ewallet', number: localMobileMatch[1] };
    } else if (longNumMatch) {
        // Classify as bank (default for long numeric strings)
        wallet = { type: 'bank', number: longNumMatch[1] };
    }

    return { name, amount, currency, wallet };
}

// ════════════════════════════════════════════════════════════════════
//  FEATURE 5 — SECURITY CODE GENERATOR
// ════════════════════════════════════════════════════════════════════
function generateSecurityCode() {
    const ts  = Date.now() % 1000;
    const rnd = Math.floor(100 + Math.random() * 900);
    return `${String(ts).padStart(3,'0')}-${rnd}`;
}

// ════════════════════════════════════════════════════════════════════
//  FEATURE 3 — MESSAGE SCREENSHOT (html2canvas with SVG fallback)
// ════════════════════════════════════════════════════════════════════
async function captureMessageScreenshot(transfer) {
    // Populate hidden container
    const groupLabels = { aswar: '🟣 مجموعة الأساور', abuhashim: '🔵 مجموعة أبو هاشم', random: '🟡 عشوائية' };
    const ssSource = document.getElementById('wa-screenshot-source');
    if (!ssSource) return _fallbackScreenshot(transfer);

    document.getElementById('ss-group').textContent  = groupLabels[transfer.group] || transfer.group;
    document.getElementById('ss-sender').textContent = transfer.name;
    document.getElementById('ss-text').textContent   = transfer.message;
    document.getElementById('ss-time').textContent   = transfer.time;

    try {
        const canvas = await html2canvas(ssSource, { backgroundColor: '#0b141a', scale: 2 });
        return canvas.toDataURL('image/png');
    } catch (_) {
        return _fallbackScreenshot(transfer);
    }
}

function _fallbackScreenshot(t) {
    const svg = `<svg width="340" height="120" xmlns="http://www.w3.org/2000/svg" font-family="Arial,sans-serif">
  <rect width="340" height="120" fill="%231f2c34" rx="12"/>
  <text x="320" y="22" text-anchor="end" fill="%2325D366" font-size="11">${t.group === 'aswar' ? '🟣 الأساور' : t.group === 'abuhashim' ? '🔵 أبو هاشم' : '🟡 عشوائية'}</text>
  <text x="320" y="44" text-anchor="end" fill="%238696a0" font-size="11">${t.name}</text>
  <rect x="10" y="52" width="320" height="44" fill="%232a3942" rx="8"/>
  <text x="316" y="72" text-anchor="end" fill="%23e9edef" font-size="12">${t.message.substring(0, 45)}</text>
  <text x="316" y="88" text-anchor="end" fill="%238696a0" font-size="10">${t.amount} ${t.currency}</text>
  <text x="320" y="112" text-anchor="end" fill="%238696a0" font-size="10">${t.time}</text>
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ════════════════════════════════════════════════════════════════════
//  FEATURE 4 — AUTO-FILL FORM  (quiet sequential fill)
// ════════════════════════════════════════════════════════════════════
function autoFillForm(transfer) {
    const commRates = { aswar: 2, abuhashim: 1.5, random: 3 };
    const comm = ((transfer.amount * (commRates[transfer.group] || 2)) / 100).toFixed(2);

    // Fields filled one by one, 80ms apart — eye barely notices
    const fields = [
        ['clientName',  transfer.name],
        ['mainAmount',  transfer.amount],
        ['currency',    transfer.currency],
        ['commission',  comm],
        ['sourceGroup', transfer.group],
    ];

    fields.forEach(([id, val], i) => {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = val;
            // Subtle tint — no border flash, no sudden color
            el.classList.remove('auto-filled-done');
            el.classList.add('auto-filled');
            // Quietly fade back to normal after 2.5s
            setTimeout(() => {
                el.classList.add('auto-filled-done');
                setTimeout(() => {
                    el.classList.remove('auto-filled', 'auto-filled-done');
                }, 2000);
            }, 2500);
        }, i * 80);
    });

    // Wallet fields — after last main field
    const walletDelay = fields.length * 80 + 40;
    if (transfer.wallet && typeof _doFillWallet === 'function') {
        setTimeout(() => _doFillWallet(transfer.wallet.type, transfer.wallet.number), walletDelay);
    }

    // Security code — silent update, no color change
    const sc = document.getElementById('secCode');
    if (sc) {
        setTimeout(() => { sc.textContent = transfer.securityCode; }, walletDelay + 40);
    }

    // calculateNet after all fields are set
    setTimeout(() => {
        if (typeof calculateNet === 'function') calculateNet();
    }, walletDelay + 80);

    // AI indicator — tiny, static, no pulse
    const aiStatus = document.getElementById('aiStatus');
    if (aiStatus) {
        aiStatus.style.display = 'flex';
        aiStatus.style.opacity = '0';
        aiStatus.style.transition = 'opacity 0.8s ease';
        aiStatus.innerHTML = '<span class="ai-dot"></span>'
            + '<span>بيانات مستخرجة تلقائياً</span>';
        // Fade in gently
        setTimeout(() => { aiStatus.style.opacity = '1'; }, 50);
        // Fade out quietly after 4s
        setTimeout(() => {
            aiStatus.style.opacity = '0';
            setTimeout(() => { aiStatus.style.display = 'none'; }, 800);
        }, 4000);
    }
}

// ════════════════════════════════════════════════════════════════════
//  FEATURE 6 — SEND MESSAGE TO GROUP (simulated)
// ════════════════════════════════════════════════════════════════════
function sendMessageToGroup(groupId, text) {
    const logEl = document.getElementById('wa-chat-log');
    const msgs  = document.getElementById('chat-log-messages');
    if (!logEl || !msgs) return;

    logEl.style.display = 'flex';

    const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
    const groupLabels = { aswar: '🟣 الأساور', abuhashim: '🔵 أبو هاشم', random: '🟡 عشوائية', agent: '📤 برهوم' };

    const bubble = document.createElement('div');
    bubble.style.cssText = 'margin-bottom:10px;';
    bubble.innerHTML = `
        <div style="font-size:10px;color:#25D366;margin-bottom:3px;font-weight:700">
            ← ${groupLabels[groupId] || groupId}
        </div>
        <div style="
            background:#005c4b;border-radius:12px 12px 0 12px;
            padding:8px 12px 6px;display:inline-block;max-width:95%;
        ">
            <pre style="margin:0;white-space:pre-wrap;font-size:12px;color:#e9edef;
                        direction:rtl;text-align:right;">${text}</pre>
            <div style="font-size:10px;color:#8696a0;margin-top:3px;text-align:left">${now} ✓✓</div>
        </div>`;
    msgs.appendChild(bubble);
    msgs.scrollTop = msgs.scrollHeight;

    if (typeof showToast === 'function')
        showToast('📤 تم إرسال الرسالة للجروب: ' + (groupLabels[groupId] || groupId), 'success');
}

// ════════════════════════════════════════════════════════════════════
//  FEATURE 7 — SEND CORRECTION MESSAGE
// ════════════════════════════════════════════════════════════════════
function sendCorrectionMessage(groupId, message) {
    if (!message || !message.trim()) {
        if (typeof showToast === 'function') showToast('⚠️ أدخل نص التصحيح', 'warning');
        return;
    }

    const corrText = `⚠️ تصحيح من موظف التلر:\n${message.trim()}`;
    sendMessageToGroup(groupId, corrText);

    const input = document.getElementById('correction-input');
    if (input) input.value = '';
    document.getElementById('correction-bar').style.display = 'none';
}

// ════════════════════════════════════════════════════════════════════
//  FEATURE 9 + 10 + 11 — HISTORY: array, localStorage, renderHistory
// ════════════════════════════════════════════════════════════════════
// addToHistory() — delegates to _addToHistory in transactions.js which
// handles localStorage, renderHistory, renderHistoryStats, and computeStats.
function addToHistory(entry) {
    if (typeof _addToHistory === 'function') { _addToHistory(entry); return; }
    // Fallback: direct push + render
    transferHistory.unshift(entry);
    try { localStorage.setItem('transferHistory', JSON.stringify(transferHistory)); } catch (_) {}
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof renderHistoryStats === 'function') renderHistoryStats();
    if (typeof computeStats === 'function') computeStats();
}

// renderHistory() is defined in transactions.js — do not redefine here.

// ── Show full receipt popup ───────────────────────────────────────
function showReceiptPopup(num) {
    const h = transferHistory.find(e => e.num === num);
    if (!h || !h.receipt) return;

    // Remove any existing popup
    const old = document.getElementById('_receiptPopup');
    if (old) old.remove();

    const groupLabels = { aswar: '🟣 مجموعة الأساور', abuhashim: '🔵 مجموعة أبو هاشم', random: '🟡 عشوائية' };

    const overlay = document.createElement('div');
    overlay.id = '_receiptPopup';
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;
        animation:fadeIn .2s ease;
    `;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
      <div style="
        background:#1f2c34;border-radius:16px;padding:0;width:340px;max-width:92vw;
        border:1px solid rgba(37,211,102,0.25);
        box-shadow:0 24px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(37,211,102,0.08);
        animation:bcSlideUp .3s cubic-bezier(.22,1,.36,1);overflow:hidden;
      ">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0d2a1a,#0a1f14);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(37,211,102,0.12);">
          <div>
            <div style="font-size:13px;font-weight:800;color:#25D366;">✅ إشعار التأكيد</div>
            <div style="font-size:10px;color:#4d8c6a;margin-top:2px;">حوالة #${num} • ${groupLabels[h.group] || h.group}</div>
          </div>
          <button onclick="document.getElementById('_receiptPopup').remove()" style="
            background:rgba(255,255,255,0.06);border:none;border-radius:8px;
            width:28px;height:28px;cursor:pointer;color:#7b96be;font-size:14px;
            display:flex;align-items:center;justify-content:center;transition:background .2s;
          " onmouseover="this.style.background='rgba(255,255,255,0.12)'"
             onmouseout="this.style.background='rgba(255,255,255,0.06)'">✕</button>
        </div>
        <!-- Receipt bubble -->
        <div style="padding:16px 18px;">
          <div style="
            background:rgba(37,211,102,0.06);
            border:1px solid rgba(37,211,102,0.2);
            border-radius:12px;padding:14px 16px;
            font-family:monospace;font-size:12px;
            color:#a7f3c0;line-height:1.8;white-space:pre;
            overflow-x:auto;
          ">${h.receipt.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          <div style="margin-top:10px;font-size:10px;color:#4d6080;text-align:center;">
            أُرسل من: ${h.agent || '—'} &nbsp;•&nbsp; ${h.time}
          </div>
        </div>
        <!-- Footer -->
        <div style="padding:12px 18px;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:8px;justify-content:flex-end;">
          <button onclick="exportSingleNotification(${num});document.getElementById('_receiptPopup').remove()" style="
            padding:7px 14px;border-radius:9px;border:1px solid rgba(139,92,246,0.3);
            background:rgba(139,92,246,0.1);color:#a78bfa;font-size:11px;font-weight:700;
            cursor:pointer;font-family:inherit;transition:all .2s;
          " onmouseover="this.style.background='rgba(139,92,246,0.22)'"
             onmouseout="this.style.background='rgba(139,92,246,0.1)'">📄 تصدير</button>
          <button onclick="document.getElementById('_receiptPopup').remove()" style="
            padding:7px 14px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);
            background:rgba(255,255,255,0.05);color:#7b96be;font-size:11px;font-weight:700;
            cursor:pointer;font-family:inherit;transition:all .2s;
          " onmouseover="this.style.background='rgba(255,255,255,0.1)'"
             onmouseout="this.style.background='rgba(255,255,255,0.05)'">إغلاق</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
}

// ── Search history by transfer number ────────────────────────────
function searchHistory(query) {
    const q      = query.trim();
    const rows   = document.querySelectorAll('#transferHistoryBody tr[data-num]');
    let visible  = 0;

    rows.forEach(row => {
        const num = row.getAttribute('data-num') || '';
        const match = !q || num.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
    });

    const info = document.getElementById('historySearchInfo');
    if (info) {
        info.textContent = q
            ? (visible > 0 ? `✅ ${visible} نتيجة` : '❌ لا توجد نتائج')
            : '';
        info.style.color = visible > 0 ? '#22c55e' : '#ef4444';
    }
    const countEl = document.getElementById('historyCount');
    if (countEl) countEl.textContent = q ? visible : transferHistory.length;
}

function clearHistorySearch() {
    const si = document.getElementById('historySearchInput');
    if (si) { si.value = ''; searchHistory(''); }
}

// ── Export single transfer notification (opens print window) ─────
function exportSingleNotification(num) {
    const h = transferHistory.find(x => (x.num || 0) == num);
    if (!h) { if (typeof showToast === 'function') showToast('⚠️ لم يتم العثور على الحوالة', 'warning'); return; }
    _printNotification([h]);
}

// ── Export all visible transfers as notifications file ────────────
function exportNotificationsFile() {
    const rows   = document.querySelectorAll('#transferHistoryBody tr[data-num]');
    const nums   = [...rows]
        .filter(r => r.style.display !== 'none')
        .map(r => parseInt(r.getAttribute('data-num')));

    const list = transferHistory.filter(h => nums.includes(h.num || 0));
    if (list.length === 0) {
        if (typeof showToast === 'function') showToast('⚠️ لا توجد حوالات لتصديرها', 'warning');
        return;
    }
    _printNotification(list);
}

// ── Core: build and open the printable notification HTML ──────────
function _printNotification(list) {
    const groupLabels = { aswar: 'مجموعة الأساور', abuhashim: 'مجموعة أبو هاشم', random: 'عشوائية' };
    const now = new Date().toLocaleDateString('ar-IQ', { year:'numeric', month:'long', day:'numeric' });

    const cards = list.map(h => {
        const num = h.num || '—';
        return `
        <div class="notif-card">
          <div class="notif-header">
            <div class="notif-logo">🏦 شركة إنترناشيونال للحوالات</div>
            <div class="notif-ref">رقم الحوالة: <strong>#${num}</strong></div>
          </div>
          <div class="notif-title">إشعار تحويل أموال</div>
          <div class="notif-grid">
            <div class="notif-field"><span class="nf-label">👤 اسم المستفيد</span><span class="nf-value">${h.name || '—'}</span></div>
            <div class="notif-field"><span class="nf-label">💰 المبلغ</span><span class="nf-value amount">${Number(h.amount).toLocaleString()} ${h.currency}</span></div>
            <div class="notif-field"><span class="nf-label">📤 المجموعة المرسلة</span><span class="nf-value">${groupLabels[h.group] || h.group || '—'}</span></div>
            <div class="notif-field"><span class="nf-label">📥 جهة التنفيذ</span><span class="nf-value">${h.agent || '—'}</span></div>
            <div class="notif-field"><span class="nf-label">🕐 وقت التنفيذ</span><span class="nf-value">${h.time || '—'}</span></div>
            <div class="notif-field"><span class="nf-label">📅 التاريخ</span><span class="nf-value">${now}</span></div>
            <div class="notif-field full"><span class="nf-label">✅ الحالة</span><span class="nf-value status">${h.status || 'تم التنفيذ'}</span></div>
          </div>
          <div class="notif-footer">
            تم إصدار هذا الإشعار إلكترونياً من نظام شركة إنترناشيونال — ${now}
          </div>
        </div>`;
    }).join('<div class="page-break"></div>');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>إشعارات التحويل — شركة إنترناشيونال</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; background:#f0f4f8; color:#1a202c; padding:30px; }
  .notif-card {
    background:#fff; border-radius:16px; padding:32px 36px;
    box-shadow:0 4px 24px rgba(0,0,0,0.08); margin-bottom:32px;
    border:1px solid #e2e8f0; max-width:700px; margin-inline:auto;
  }
  .notif-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:16px; border-bottom:2px solid #e8c04a; }
  .notif-logo { font-size:18px; font-weight:800; color:#1a202c; }
  .notif-ref  { font-size:13px; color:#718096; font-family:monospace; }
  .notif-title { font-size:22px; font-weight:800; color:#1a365d; text-align:center; margin-bottom:24px; letter-spacing:.5px; }
  .notif-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px; }
  .notif-field { background:#f7fafc; border-radius:10px; padding:12px 16px; border:1px solid #e2e8f0; }
  .notif-field.full { grid-column:span 2; }
  .nf-label { display:block; font-size:11px; color:#718096; margin-bottom:4px; font-weight:600; }
  .nf-value  { display:block; font-size:15px; font-weight:700; color:#1a202c; }
  .nf-value.amount { color:#d97706; font-size:20px; }
  .nf-value.status { color:#16a34a; }
  .notif-footer { text-align:center; font-size:10px; color:#a0aec0; padding-top:16px; border-top:1px solid #e2e8f0; }
  .page-break { page-break-after:always; height:0; }
  @media print {
    body { background:#fff; padding:10px; }
    .notif-card { box-shadow:none; border:1px solid #ccc; }
    .page-break { page-break-after:always; }
  }
</style>
</head>
<body>${cards}
<script>window.onload=()=>{ window.print(); }<\/script>
</body></html>`;

    const win = window.open('', '_blank', 'width=780,height=900');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        // Fallback: download as HTML file
        const blob = new Blob([html], { type:'text/html;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `transfer-notifications-${Date.now()}.html`;
        a.click();
    }
    if (typeof showToast === 'function')
        showToast(`📄 تم إنشاء ${list.length} إشعار`, 'success');
}

function renderHistoryStats() {
    const el = document.getElementById('history-stats');
    if (!el || transferHistory.length === 0) return;

    const totalUSD = transferHistory
        .filter(h => h.currency === 'USD')
        .reduce((s, h) => s + Number(h.amount), 0);
    const totalILS = transferHistory
        .filter(h => h.currency === 'ILS')
        .reduce((s, h) => s + Number(h.amount), 0);
    const totalJOD = transferHistory
        .filter(h => h.currency === 'JOD')
        .reduce((s, h) => s + Number(h.amount), 0);

    const stats = [
        { label: 'إجمالي الحوالات', val: transferHistory.length, color: '#32b8c6' },
        { label: 'مجموع USD',       val: '$' + totalUSD.toLocaleString(), color: '#5CB85C' },
        { label: 'مجموع ILS',       val: '₪' + totalILS.toLocaleString(), color: '#5BC0DE' },
        { label: 'مجموع JOD',       val: 'د.ا' + totalJOD.toLocaleString(), color: '#e8c04a' },
    ];

    el.innerHTML = stats.map(s => `
        <div style="
            background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
            border-radius:10px;padding:10px 16px;flex:1;min-width:120px;
        ">
            <div style="font-size:10px;color:#4d6080;margin-bottom:4px">${s.label}</div>
            <div style="font-size:18px;font-weight:900;color:${s.color}">${s.val}</div>
        </div>`).join('');
}

function openHistoryScreenshot(src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    overlay.onclick = () => document.body.removeChild(overlay);
    overlay.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:90vh;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.8)">`;
    document.body.appendChild(overlay);
}

// clearHistory() and exportHistory() are defined in transactions.js.

// Load history from localStorage on startup — mutate in-place (don't reassign)
(function loadHistory() {
    try {
        const saved = JSON.parse(localStorage.getItem('transferHistory') || '[]');
        if (Array.isArray(saved) && saved.length > 0) {
            transferHistory.length = 0;
            saved.forEach(e => transferHistory.push(e));
        }
    } catch (_) { /* leave transferHistory as-is */ }
    if (typeof renderHistory === 'function') renderHistory();
    renderHistoryStats();
})();

// ════════════════════════════════════════════════════════════════════
//  FEATURE 12 — PATCH confirmExecution to call addToHistory
// ════════════════════════════════════════════════════════════════════
// patchConfirmExecution removed — history is now correctly recorded in
// transactions.js _addToHistory() when the 'sent-back' action fires,
// ensuring entries are only logged after full completion, not on dispatch.

// ════════════════════════════════════════════════════════════════════
//  FEATURE 1 — WHATSAPP BOT SIMULATOR MODULE
// ════════════════════════════════════════════════════════════════════
const whatsappBotSimulator = {

    // Sample messages pool
    messagePool: [
        // ── بدون رقم حساب ──
        { group: 'aswar',     text: 'سلم محمد احمد 500 دولار'                                               },
        { group: 'aswar',     text: 'حول 300 USD الى احمد سعيد'                                             },
        { group: 'aswar',     text: 'سلم خالد محمود 200 شيكل ضروري'                                         },
        { group: 'abuhashim', text: 'send 200 usd to khaled ibrahim'                                        },
        { group: 'abuhashim', text: 'حوالة لـ يوسف عمر 750 دينار'                                          },
        { group: 'abuhashim', text: 'سلم نادية عبدالله 400 دولار'                                           },
        { group: 'random',    text: 'حول 1000 USD الى سامي الخطيب'                                          },
        { group: 'random',    text: 'send 350 ILS to omar farouq'                                           },
        { group: 'random',    text: 'أرسل 600 دولار على اسم ريم سلمان'                                      },
        { group: 'aswar',     text: 'سلم إبراهيم خليل 900 شيكل وبسرعة'                                      },
        { group: 'abuhashim', text: 'حوالة عاجلة لـ عماد فتحي 250 JOD'                                     },
        { group: 'random',    text: 'transfer 800 usd to fadi ibrahim please'                               },

        // ── محفظة إلكترونية (05x / 07x) ──
        { group: 'aswar',     text: 'سلم وليد الحسن 350 دولار\nالمحفظة: 0592847361'                         },
        { group: 'aswar',     text: 'حول 500 شيكل لـ سارة منصور\nرقم المحفظة الإلكترونية: 0568192047'      },
        { group: 'abuhashim', text: 'حوالة لـ فراس عوض 700 دولار\nالمحفظة: 0591234567'                     },
        { group: 'abuhashim', text: 'سلم ليلى الخطيب 450 USD\nووري / المحفظة: 0796543210'                  },
        { group: 'random',    text: 'أرسل 200 دولار لـ أنس البشير\nرقم jawwal pay: 0597654321'              },
        { group: 'random',    text: 'حول 300 شيكل لـ رنا سليمان\nبايمنت / محفظة: 0568007412'              },
        { group: 'aswar',     text: 'سلم تامر عزيز 600 دينار\nالمحفظة الإلكترونية: 0797654123'              },

        // ── حساب بنكي (8-14 رقم) ──
        { group: 'aswar',     text: 'سلم محمد الزيدي 800 دولار\nرقم الحساب البنكي: 10283746502'             },
        { group: 'abuhashim', text: 'حوالة بنكية لـ كريم سعيد 1200 USD\nالحساب: 20394817650'                },
        { group: 'abuhashim', text: 'أرسل 500 دولار لـ نور الدين\nبنك القدس — رقم الحساب: 98271645300'      },
        { group: 'random',    text: 'حول 950 JOD لـ سمر الأحمد\nالبنك العربي — حساب: 30192847561'           },
        { group: 'random',    text: 'تحويل 400 EUR لـ حمدي القادري\nرقم حسابه في البنك: 11029384756'        },
        { group: 'aswar',     text: 'سلم إياد عمر 650 دولار\nبنك فلسطين — رقم الحساب: 00201938475'         },

        // ── IBAN ──
        { group: 'abuhashim', text: 'حوالة لـ ديما سلامة 2000 USD\nIBAN: PS92PALS000000099123456702'        },
        { group: 'random',    text: 'أرسل 1500 دولار لـ باسل الحسيني\nIBAN: JO94CBJO0010000000000131000302' },
        { group: 'aswar',     text: 'تحويل 900 EUR لـ منى الشيخ\nIBAN: PS92PALS000000001234567890'          },

        // ── هاتف دولي (تحويل هاتفي) ──
        { group: 'random',    text: 'حوالة لـ عمر السيد 300 دولار\nحوّل على الجوال: +970592018374'          },
        { group: 'abuhashim', text: 'سلم خالد نصر 450 شيكل\nالتحويل الهاتفي: +972523019284'                },
        { group: 'aswar',     text: 'أرسل 250 دينار لـ رامي الكيلاني\nرقم الهاتف للتحويل: +962791234567'   },
    ],

    _usedIndexes: new Set(),

    // Per-group received message counts
    _groupCounts: { aswar: 0, abuhashim: 0, random: 0 },

    // Per-group limits (synced from _bcState.maxMsgsPerGroup)
    _groupLimits: { aswar: 9, abuhashim: 9, random: 9 },

    // Called by bcUpdateMaxMsgs when user changes a limit
    syncLimits() {
        const state = window._bcState;
        if (!state || !state.maxMsgsPerGroup) return;
        Object.assign(this._groupLimits, state.maxMsgsPerGroup);
    },

    // Check whether all active groups have reached their limit
    _allGroupsDone() {
        const state = window._bcState;
        const groups = ['aswar', 'abuhashim', 'random'];
        return groups.every(g => {
            // skip if group is disabled
            if (state && state['grp-' + g] === false) return true;
            return this._groupCounts[g] >= this._groupLimits[g];
        });
    },

    // Pick a random message from groups that haven't hit their limit yet
    _pickMessage() {
        const state = window._bcState;
        // Filter pool to groups that still have capacity
        const available = this.messagePool.filter(m => {
            if (state && state['grp-' + m.group] === false) return false;
            return this._groupCounts[m.group] < this._groupLimits[m.group];
        });
        if (available.length === 0) return null;

        // Prefer not-yet-used messages; reset when all available are used
        let pool = available.filter(m => !this._usedIndexes.has(this.messagePool.indexOf(m)));
        if (pool.length === 0) {
            this._usedIndexes.clear();
            pool = available;
        }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        this._usedIndexes.add(this.messagePool.indexOf(pick));
        return pick;
    },

    // ── Main: simulate one incoming message ──────────────────────────
    async simulateIncoming() {
        // Respect manual pause from form mode
        if (this._paused) return;

        // Sync limits from _bcState before each message
        this.syncLimits();

        // Stop entirely when all groups hit their limit
        if (this._allGroupsDone()) {
            if (typeof showToast === 'function')
                showToast('✅ البوت: وصل عدد الرسائل إلى الحد المحدد في صلاحيات البوت', 'success');
            return; // do NOT reschedule
        }

        const raw = this._pickMessage();
        if (!raw) return; // safety guard — no eligible message
        const parsed    = parseWhatsAppMessage(raw.text);
        const secCode   = generateSecurityCode();
        const now       = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

        // Build transfer object (Features 1 + 5)
        const transfer = {
            id:           ++_nextBotId,
            group:        raw.group,
            name:         parsed.name,
            amount:       parsed.amount || Math.floor(100 + Math.random() * 900),
            currency:     parsed.currency,
            message:      raw.text,
            msg:          raw.text,
            time:         now,
            status:       'new',
            securityCode: secCode,
            screenshot:   null,
            wallet:       parsed.wallet || null,
        };

        // Feature 3: capture screenshot
        transfer.screenshot = await captureMessageScreenshot(transfer);

        // Push into existing transfers array & refresh list
        transfers.unshift(transfer);
        if (typeof renderTransfers === 'function') renderTransfers();
        if (typeof computeStats    === 'function') computeStats();

        // If smart mode is active — trigger auto-process pipeline
        if (typeof smartMode !== 'undefined' && smartMode &&
            typeof _botRunning !== 'undefined' && _botRunning &&
            typeof _botAutoProcess === 'function') {
            _botAutoProcess();
        }

        // Increment per-group counter
        this._groupCounts[raw.group] = (this._groupCounts[raw.group] || 0) + 1;
        const reached = this._groupCounts[raw.group] >= this._groupLimits[raw.group];

        // Mark unread badge on source group tab
        const srcTab = document.getElementById('gtab-' + raw.group);
        if (srcTab && typeof currentFilter !== 'undefined' && currentFilter !== raw.group && currentFilter !== 'all') {
            const n = parseInt(srcTab.getAttribute('data-unread') || '0') + 1;
            srcTab.setAttribute('data-unread', n);
        }

        // Toast notification only (no form touch)
        const groupNames = { aswar: 'الأساور', abuhashim: 'أبو هاشم', random: 'العشوائية' };
        if (typeof showToast === 'function')
            showToast(`📥 رسالة جديدة من ${groupNames[raw.group]}: ${transfer.name} — ${transfer.amount} ${transfer.currency}`, 'warning');

        // Notify user when a group hits its limit
        if (reached && typeof showToast === 'function')
            showToast(`🔔 ${groupNames[raw.group]}: وصل عدد الرسائل إلى الحد المحدد (${this._groupLimits[raw.group]})`, 'info');

        // Only reschedule if there are still groups with remaining capacity
        if (!this._allGroupsDone()) {
            this._scheduleNext();
        } else {
            if (typeof showToast === 'function')
                showToast('✅ البوت: تم استقبال الحد الأقصى من الرسائل لجميع المجموعات', 'success');
        }
    },

    _scheduleNext() {
        if (this._paused) return; // respect pause
        const delay = 6000 + Math.random() * 4000;
        setTimeout(() => this.simulateIncoming(), delay);
    },

    stop() {
        this._paused = true;
    },

    resume() {
        if (!this._paused) return;
        this._paused = false;
        // Resume after a short delay
        setTimeout(() => this.simulateIncoming(), 2000);
    },

    // ── Start the simulator ──────────────────────────────────────────
    start() {
        this._paused = false;
        // First message after 5 seconds
        setTimeout(() => this.simulateIncoming(), 5000);
    },
};

// ── Extend existing sendReceipt() to use sendMessageToGroup ──────────
(function patchSendReceipt() {
    window.sendReceipt = function () {
        const name     = document.getElementById('clientName')?.value   || '';
        const amount   = document.getElementById('mainAmount')?.value   || 0;
        const currency = document.getElementById('currency')?.value     || 'USD';
        const code     = document.getElementById('secCode')?.textContent || '';
        const group    = document.getElementById('sourceGroup')?.value  || 'aswar';

        if (!name) {
            if (typeof showToast === 'function') showToast('⚠️ لا توجد بيانات لإرسالها', 'warning');
            return;
        }

        // وصل للمصدر — بدون ذكر جهة التنفيذ
        const msg = `✅ تم تنفيذ الحوالة
━━━━━━━━━━━━━━━━━━
👤 الاسم   : ${name}
💰 المبلغ  : ${amount} ${currency}
🔐 الكود   : ${code}
━━━━━━━━━━━━━━━━━━`;

        sendMessageToGroup(group, msg);
        currentGroupId = group;
    };
})();

// Simulator disabled — using real WhatsApp via wa-bridge.js
// document.addEventListener('DOMContentLoaded', () => {
//     whatsappBotSimulator.start();
// });

// ════════════════════════════════════════════════════════════════════
//  WA CHAT PANEL — embedded WhatsApp-style chat in panel-right
// ════════════════════════════════════════════════════════════════════
const waChat = {
    activeInbox: 'aswar',
    activeAgent: 'barhoum',
    _seq: 0,

    // Per-channel message stores
    messages: {
        inbox: { aswar: [], abuhashim: [], random: [] },
        agent: { barhoum: [], agent2: [], agent3: [] }
    },

    inboxLabels: { aswar: '🟣 الأساور', abuhashim: '🔵 أبو هاشم', random: '🟡 عشوائية' },
    agentLabels: { barhoum: 'برهوم تونس', agent2: 'وكيل 2', agent3: 'وكيل 3' },

    _now() {
        return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
    },

    // Render ONLY outgoing (agent) messages in #waChatMessages (right panel)
    // Incoming messages are now shown in #sourceChatArea (center left column)
    _render() {
        const box = document.getElementById('waChatMessages');
        if (!box) return;

        const agentMsgs = this.messages.agent[this.activeAgent] || [];

        if (agentMsgs.length === 0) {
            box.innerHTML = '<div style="text-align:center;color:#4d6080;font-size:11px;padding:24px 10px;">📤 أرسل حوالة من الوسط لتظهر هنا</div>';
            return;
        }

        box.innerHTML = agentMsgs.map(m => `
            <div style="margin-bottom:10px;display:flex;flex-direction:column;align-items:flex-end;">
                <div style="font-size:10px;color:#32b8c6;margin-bottom:2px;font-weight:700">${m.agent || 'أنت'}</div>
                <div style="background:#005c4b;border-radius:12px 12px 0 12px;padding:8px 12px;display:inline-block;max-width:92%;word-break:break-word;">
                    <pre style="margin:0;white-space:pre-wrap;font-size:12px;color:#e9edef;direction:rtl;text-align:right;font-family:inherit">${m.text}</pre>
                    <div style="font-size:10px;color:#8696a0;margin-top:3px;text-align:left">${m.time} ✓✓</div>
                </div>
            </div>`).join('');

        box.scrollTop = box.scrollHeight;
    },

    _updateTitle() {
        const el = document.getElementById('waChatTitle');
        if (el) el.textContent = '📤 ' + (this.agentLabels[this.activeAgent] || 'جهة التنفيذ');
    },

    // ── Add incoming message — stored only; center column is updated by selectTransfer() ──
    addIncoming(groupId, text, senderName) {
        if (this.messages.inbox[groupId]) {
            this.messages.inbox[groupId].push({
                seq: ++this._seq, text, sender: senderName || 'عميل', time: this._now()
            });
        }
        // Note: center source column (#sourceChatArea) is updated only when the employee
        // explicitly clicks a transfer bubble in the right panel (selectTransfer in transactions.js)
    },

    // ── Add outgoing message to an agent ──
    addOutgoing(agentId, text) {
        if (!this.messages.agent[agentId]) return;
        this.messages.agent[agentId].push({
            seq: ++this._seq, text, agent: this.agentLabels[agentId] || agentId, time: this._now()
        });
        if (agentId === this.activeAgent) this._render();

        const strip = document.getElementById('exec-strip');
        if (strip) strip.textContent = '✅ تم الإرسال لـ ' + (this.agentLabels[agentId] || agentId) + ' — ' + this._now();
    },

    // ── Switch incoming group tab ──
    selectInbox(groupId, tabEl) {
        this.activeInbox = groupId;
        document.querySelectorAll('.wa-inbox-tab').forEach(t => t.classList.remove('active'));
        if (tabEl) {
            tabEl.classList.add('active');
            tabEl.removeAttribute('data-unread');
        }
        this._updateTitle();
        this._render();
    },

    // ── Switch agent tab ──
    selectAgent(agentId, tabEl) {
        this.activeAgent = agentId;
        document.querySelectorAll('.wa-agent-tab').forEach(t => t.classList.remove('active'));
        if (tabEl) {
            tabEl.classList.add('active');
            tabEl.removeAttribute('data-unread');
        }
        this._updateTitle();
        this._render();
    },

    // ── Send manual message from input ──
    sendManual() {
        const input = document.getElementById('waMsgInput');
        const text = input?.value?.trim();
        if (!text) return;
        this.addOutgoing(this.activeAgent, text);
        if (input) input.value = '';
    },

    // ── Send quick receipt from current form data ──
    sendQuickReceipt() {
        const name   = document.getElementById('clientName')?.value   || '—';
        const amount = document.getElementById('mainAmount')?.value   || '0';
        const curr   = document.getElementById('currency')?.value     || 'USD';
        const code   = document.getElementById('secCode')?.textContent || '—';
        const msg    = `✅ تم تنفيذ الحوالة\n━━━━━━━━━━━━━━━━━━\n👤 ${name}\n💰 ${amount} ${curr}\n🔐 ${code}\n━━━━━━━━━━━━━━━━━━`;
        this.addOutgoing(this.activeAgent, msg);
    },

    // ── Clear current view ──
    clear() {
        this.messages.inbox[this.activeInbox] = [];
        this.messages.agent[this.activeAgent] = [];
        this._render();
    },

    init() {
        this._updateTitle();
    }
};

// Global adapter functions (called from HTML onclick attributes)
function waSelectInbox(groupId, el) { waChat.selectInbox(groupId, el); }
function waSelectAgent(agentId, el) { waChat.selectAgent(agentId, el); }
function waSendManual()            { waChat.sendManual(); }
function waSendQuickReceipt()      { waChat.sendQuickReceipt(); }
function waChatClear()             { waChat.clear(); }

// Initialise chat panel after DOM is ready
waChat.init = function() {
    this._render();
    this._updateTitle();
};
document.addEventListener('DOMContentLoaded', () => {
    waChat.init();
    // Re-render history now that DOM is available
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof renderHistoryStats === 'function') renderHistoryStats();
});
