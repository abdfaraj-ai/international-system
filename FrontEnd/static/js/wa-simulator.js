
// ════════════════════════════════════════════════════════════
//   WhatsApp Bot Simulator — DISABLED (using real WhatsApp)
// ════════════════════════════════════════════════════════════
// الملف معطّل — الرسائل تأتي من واتساب الحقيقي عبر wa-bridge.js
if (true) { /* simulator disabled */ }

const WA = {

  // ── State ────────────────────────────────────────────────
  panelOpen:    false,
  activeGroup:  'aswar',
  unreadCount:  0,
  msgIdCounter: 100,
  sessionState: 'IDLE',   // IDLE | WAITING_CONFIRM | DONE
  pendingData:  null,

  // ── Group configs ────────────────────────────────────────
  groups: {
    aswar:     { label: '🟣 مجموعة الأساور',    color: '#a855f7', commRate: 2   },
    abuhashim: { label: '🔵 مجموعة أبو هاشم',   color: '#3b82f6', commRate: 1.5 },
    random:    { label: '🟡 مجموعة العشوائية',   color: '#eab308', commRate: 3   },
    agent:     { label: '📤 صادر — برهوم تونس',  color: '#25D366', commRate: 0   },
  },

  // ── Chat history per group ───────────────────────────────
  chats: { aswar: [], abuhashim: [], random: [], agent: [] },

  // ── Sample incoming messages ─────────────────────────────
  sampleMessages: {
    text_simple: [
      { sender: 'أحمد محمد',    text: 'السلام عليكم، أبي أحول 300 دولار على اسم فادي إبراهيم تونس',         amount: 300,  name: 'فادي إبراهيم',    currency: 'USD', dest: 'تونس' },
      { sender: 'خالد العمري',  text: 'ممكن حوالة 500 دولار لـ سمير قاسم من فضلك',                          amount: 500,  name: 'سمير قاسم',       currency: 'USD', dest: 'تونس' },
      { sender: 'ليلى حسن',     text: 'بدي أرسل 200 دينار أردني على اسم نادية عمر، ضروري',                  amount: 200,  name: 'نادية عمر',       currency: 'JOD', dest: 'الأردن' },
      { sender: 'محمود سالم',   text: 'طلب تحويل 750 شيكل لـ عمر فارس، الرقم 059xxxxxxx',                   amount: 750,  name: 'عمر فارس',        currency: 'ILS', dest: 'فلسطين' },
    ],
    text_complex: [
      { sender: 'سعيد البلوشي', text: 'مرحبا، عندي طلب حوالة خارجية:\n• الاسم: يوسف محمود العبدالله\n• المبلغ: 1200 دولار\n• الوجهة: ليبيا — طرابلس\n• الهاتف: 00218xxxxxxxxx\nمع العلم المبلغ عاجل', amount: 1200, name: 'يوسف محمود العبدالله', currency: 'USD', dest: 'ليبيا' },
      { sender: 'فاطمة الزهراء',text: 'احتاج تحويل عاجل:\nالمستفيد: ريم سلمان البكر\nالمبلغ: 850 دولار\nتونس - صفاقس\nإيصال مرفق في الرسالة التالية',                                 amount: 850,  name: 'ريم سلمان البكر',   currency: 'USD', dest: 'تونس' },
    ],
    inquiry: [
      { sender: 'كريم منصور',   text: 'كم سعر الدولار اليوم؟' },
      { sender: 'نور الهدى',    text: 'ممكن تقولي سعر الصرف حق الدينار الأردني؟' },
      { sender: 'عماد فتحي',    text: 'هل تقدرون تحولون لليبيا؟ وكم العمولة؟' },
    ],
    confirm: [
      { sender: 'أحمد محمد',    text: 'تمام نفّذ ✅' },
      { sender: 'خالد العمري',  text: 'موافق، كمّل' },
      { sender: 'ليلى حسن',     text: '👍 تمام' },
    ],
  },

  // ── Fake receipt images (SVG-based, no external files) ──
  generateReceiptSVG(data) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour12: false });
    const dateStr = now.toLocaleDateString('ar-EG');
    return `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`
<svg width="320" height="200" xmlns="http://www.w3.org/2000/svg" font-family="Arial,sans-serif">
  <rect width="320" height="200" fill="%23fff" rx="8"/>
  <rect width="320" height="40" fill="%23128C7E" rx="8"/>
  <rect y="32" width="320" height="8" fill="%23128C7E"/>
  <text x="160" y="26" text-anchor="middle" fill="%23fff" font-size="14" font-weight="bold">🏦 إيصال حوالة</text>
  <line x1="20" y1="55" x2="300" y2="55" stroke="%23eee" stroke-width="1"/>
  <text x="20" y="75" fill="%23333" font-size="12">الاسم:</text>
  <text x="200" y="75" fill="%23000" font-size="12" font-weight="bold">${data.name || 'غير محدد'}</text>
  <text x="20" y="100" fill="%23333" font-size="12">المبلغ:</text>
  <text x="200" y="100" fill="%23128C7E" font-size="14" font-weight="bold">${data.amount} ${data.currency || 'USD'}</text>
  <text x="20" y="125" fill="%23333" font-size="12">الوجهة:</text>
  <text x="200" y="125" fill="%23000" font-size="12">${data.dest || '—'}</text>
  <text x="20" y="150" fill="%23333" font-size="12">التاريخ:</text>
  <text x="200" y="150" fill="%23000" font-size="12">${dateStr}</text>
  <text x="20" y="175" fill="%23333" font-size="12">الوقت:</text>
  <text x="200" y="175" fill="%23000" font-size="12">${timeStr}</text>
  <line x1="20" y1="183" x2="300" y2="183" stroke="%23eee" stroke-width="1"/>
  <text x="160" y="196" text-anchor="middle" fill="%23aaa" font-size="9">محاكاة - International System</text>
</svg>`);
  },

  // ── Security code generator ──────────────────────────────
  generateSecCode(name, amount, group) {
    const seed = `${amount}|${name}|${group}|${Math.floor(Date.now() / 30000)}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const num = Math.abs(hash) % 900000 + 100000;
    return String(num).slice(0, 3) + '-' + String(num).slice(3);
  },

  // ── Panel toggle ─────────────────────────────────────────
  togglePanel() {
    this.panelOpen = !this.panelOpen;
    const panel = document.getElementById('waPanel');
    panel.style.display = this.panelOpen ? 'flex' : 'none';
    if (this.panelOpen) {
      this.unreadCount = 0;
      this.updateBadge();
      this.renderChat();
      setTimeout(() => this.scrollChat(), 100);
    }
  },

  updateBadge() {
    const badge = document.getElementById('waBotBadge');
    if (this.unreadCount > 0) {
      badge.style.display = 'flex';
      badge.textContent = this.unreadCount;
    } else {
      badge.style.display = 'none';
    }
  },

  // ── Group switch ─────────────────────────────────────────
  switchGroup(groupId, btn) {
    this.activeGroup = groupId;
    document.querySelectorAll('.wa-grp-tab').forEach(b => {
      b.style.color = '#8696a0';
      b.style.borderBottom = '2px solid transparent';
    });
    btn.style.color = '#25D366';
    btn.style.borderBottom = '2px solid #25D366';
    this.renderChat();
    this.scrollChat();
  },

  // ── Render chat messages ─────────────────────────────────
  renderChat() {
    const box = document.getElementById('waChatBox');
    if (!box) return;
    const msgs = this.chats[this.activeGroup] || [];
    if (msgs.length === 0) {
      box.innerHTML = `<div style="text-align:center;color:#4a5568;font-size:12px;padding:40px 20px">
        لا توجد رسائل بعد في هذا الجروب.<br>
        اضغط <b style="color:#25D366">رسالة عشوائية</b> لمحاكاة رسالة واردة.
      </div>`;
      return;
    }
    box.innerHTML = msgs.map(m => this.renderBubble(m)).join('');
  },

  renderBubble(m) {
    const isOut = m.direction === 'out';
    const timeStr = new Date(m.ts).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
    const grpConf = this.groups[this.activeGroup];

    if (m.type === 'image') {
      return `
      <div style="display:flex;justify-content:${isOut ? 'flex-end' : 'flex-start'};margin-bottom:10px">
        <div style="max-width:75%">
          ${!isOut ? `<div style="font-size:10px;color:${grpConf?.color || '#25D366'};margin-bottom:3px;font-weight:700">${m.sender}</div>` : ''}
          <div style="background:${isOut ? '#005c4b' : '#1f2c34'};border-radius:${isOut ? '12px 12px 0 12px' : '12px 12px 12px 0'};overflow:hidden;max-width:220px">
            <img src="${m.image}" style="width:100%;display:block;border-radius:8px 8px 0 0" onclick="openReceiptModal('${m.image}')">
            ${m.caption ? `<div style="padding:6px 10px;font-size:11px;color:#e9edef">${m.caption}</div>` : ''}
            <div style="padding:4px 10px 6px;font-size:10px;color:#8696a0;text-align:${isOut ? 'left' : 'right'}">${timeStr} ${isOut ? '✓✓' : ''}</div>
          </div>
        </div>
      </div>`;
    }

    if (m.type === 'system') {
      return `<div style="text-align:center;margin:8px 0">
        <span style="background:rgba(255,255,255,0.06);color:#8696a0;font-size:10px;padding:4px 12px;border-radius:10px">${m.text}</span>
      </div>`;
    }

    if (m.type === 'bot_reply') {
      return `
      <div style="display:flex;justify-content:flex-start;margin-bottom:10px">
        <div style="max-width:82%">
          <div style="font-size:10px;color:#25D366;margin-bottom:3px;font-weight:700">🤖 البوت</div>
          <div style="background:#1f2c34;border-radius:12px 12px 12px 0;padding:10px 14px;border-right:3px solid #25D366">
            <pre style="margin:0;white-space:pre-wrap;font-size:12px;color:#e9edef;direction:rtl;text-align:right">${m.text}</pre>
            <div style="font-size:10px;color:#8696a0;margin-top:4px;text-align:left">${timeStr}</div>
          </div>
        </div>
      </div>`;
    }

    // Regular message
    return `
    <div style="display:flex;justify-content:${isOut ? 'flex-end' : 'flex-start'};margin-bottom:10px">
      <div style="max-width:80%">
        ${!isOut ? `<div style="font-size:10px;color:${grpConf?.color || '#25D366'};margin-bottom:3px;font-weight:700">${m.sender || 'مجهول'}</div>` : ''}
        <div style="
          background:${isOut ? '#005c4b' : '#1f2c34'};
          border-radius:${isOut ? '12px 12px 0 12px' : '12px 12px 12px 0'};
          padding:8px 12px 6px;
        ">
          <div style="font-size:13px;color:#e9edef;white-space:pre-wrap;direction:rtl;text-align:right">${m.text}</div>
          <div style="font-size:10px;color:#8696a0;margin-top:3px;text-align:left">${timeStr} ${isOut ? '✓✓' : ''}</div>
        </div>
        ${m.injected ? `<div style="font-size:10px;color:#25D366;margin-top:3px;text-align:right">تم تحليلها وملء الفورم تلقائياً</div>` : ''}
      </div>
    </div>`;
  },

  // ── Add message to chat ──────────────────────────────────
  addMsg(group, msgObj) {
    msgObj.ts = Date.now();
    msgObj.id = ++this.msgIdCounter;
    this.chats[group].push(msgObj);
    if (this.panelOpen && this.activeGroup === group) {
      this.renderChat();
      this.scrollChat();
    } else if (!this.panelOpen) {
      this.unreadCount++;
      this.updateBadge();
    }
  },

  scrollChat() {
    const box = document.getElementById('waChatBox');
    if (box) box.scrollTop = box.scrollHeight;
  },

  // ── Typing indicator ─────────────────────────────────────
  showTyping(visible) {
    const el = document.getElementById('waTyping');
    if (el) el.style.display = visible ? 'block' : 'none';
  },

  // ══════════════════════════════════════════════════════════
  //  CORE: Process incoming message → fill form
  // ══════════════════════════════════════════════════════════
  processTransferMessage(group, msg, data) {
    // Step 1 — show message in chat
    this.addMsg(group, { direction: 'in', type: 'text', sender: msg.sender, text: msg.text });

    // Step 2 — show "AI processing" indicator
    this.showTyping(true);
    this.setStatus('جاري تحليل الرسالة...');

    setTimeout(() => {
      this.showTyping(false);
      this.setStatus('البوت نشط — يراقب الجروبات');

      // Step 3 — bot sends extracted summary back to group
      const secCode = this.generateSecCode(data.name, data.amount, group);
      const now = new Date();
      const botReply = `✅ تم استخراج بيانات الحوالة:
━━━━━━━━━━━━━━━━━━
👤 الاسم    : ${data.name}
💰 المبلغ   : ${data.amount} ${data.currency}
📍 الوجهة   : ${data.dest || '—'}
🔐 رمز الأمان: ${secCode}
🕐 الوقت    : ${now.toLocaleTimeString('ar-EG', { hour12: true })}
━━━━━━━━━━━━━━━━━━
تم إرسال الطلب للمراجعة من قِبل موظف التلر ✔️`;

      this.addMsg(group, { direction: 'out', type: 'bot_reply', text: botReply });

      // Mark original message as injected
      const msgs = this.chats[group];
      if (msgs.length > 0) msgs[msgs.length - 2].injected = true;
      if (this.panelOpen && this.activeGroup === group) this.renderChat();

      // Step 4 — fill the form
      this.fillForm(data, group, secCode);
      this.pendingData = { ...data, group, secCode };

      // Step 5 — notify user
      if (typeof showToast === 'function')
        showToast('حوالة جديدة وردت من واتساب! تم ملء الفورم تلقائياً', 'success');

      // Step 6 — flash the form
      const form = document.querySelector('.form-card');
      if (form) {
        form.style.transition = 'box-shadow 0.3s';
        form.style.boxShadow = '0 0 0 3px rgba(37,211,102,0.5)';
        setTimeout(() => form.style.boxShadow = '', 1500);
      }

    }, 1800);
  },

  fillForm(data, group, secCode) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('mainAmount', data.amount);
    set('clientName', data.name || '');
    set('currency', data.currency || 'USD');

    // Auto-calculate commission based on group rate
    const rate = this.groups[group]?.commRate || 2;
    const comm = ((data.amount * rate) / 100).toFixed(2);
    set('commission', comm);

    // Set source group
    const sg = document.getElementById('sourceGroup');
    if (sg) { for (let o of sg.options) { if (o.value === group || o.text.includes(this.groups[group]?.label?.replace(/^[🟣🔵🟡📤] /,''))) { sg.value = o.value; break; } } }

    // Update security code display
    const sc = document.getElementById('secCode');
    if (sc) {
      sc.textContent = secCode;
      sc.style.color = '#25D366';
      sc.style.animation = 'pulse 1s ease';
    }

    // Trigger net calculation
    if (typeof calculateNet === 'function') calculateNet();

    // Show AI indicator
    const ai = document.getElementById('aiStatus');
    if (ai) {
      ai.style.display = 'flex';
      ai.innerHTML = '<span class="ai-dot"></span><span style="color:#25D366;font-size:12px">تم التحليل بالذكاء الاصطناعي من واتساب</span>';
    }
  },

  // ══════════════════════════════════════════════════════════
  //  Handle image receipt
  // ══════════════════════════════════════════════════════════
  processImageMessage(group, sender, data) {
    const imgSrc = this.generateReceiptSVG(data);

    // Show image in chat
    this.addMsg(group, { direction: 'in', type: 'image', sender, image: imgSrc, caption: 'إيصال الحوالة' });

    this.showTyping(true);
    this.setStatus('جاري تحليل صورة الإيصال بـ OCR...');

    setTimeout(() => {
      this.showTyping(false);
      this.setStatus('البوت نشط — يراقب الجروبات');

      // Show receipt preview on the page
      this.showReceiptPreview(imgSrc);

      // Process as transfer
      this.processTransferMessage(group,
        { sender, text: `[صورة إيصال]\n${data.name} — ${data.amount} ${data.currency}` },
        data
      );

    }, 2200);
  },

  showReceiptPreview(imgSrc) {
    let container = document.getElementById('receipt-preview');
    if (!container) {
      container = document.createElement('div');
      container.id = 'receipt-preview';
      container.style.cssText = 'margin:10px 0;border-radius:12px;overflow:hidden;border:2px solid rgba(37,211,102,0.4);cursor:pointer;';
      const ocrSection = document.querySelector('.ocr-section');
      if (ocrSection) ocrSection.after(container);
    }
    container.innerHTML = `
      <div style="font-size:11px;color:#25D366;padding:6px 12px;background:rgba(37,211,102,0.08);display:flex;align-items:center;gap:6px">
        <span>صورة الإيصال الواردة من واتساب — اضغط للتكبير</span>
      </div>
      <img src="${imgSrc}" style="width:100%;display:block" onclick="WA.openReceiptModal('${imgSrc}')">`;
  },

  openReceiptModal(src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    overlay.onclick = () => document.body.removeChild(overlay);
    overlay.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.8)">`;
    document.body.appendChild(overlay);
  },

  // ══════════════════════════════════════════════════════════
  //  Handle inquiry
  // ══════════════════════════════════════════════════════════
  processInquiry(group, msg) {
    this.addMsg(group, { direction: 'in', type: 'text', sender: msg.sender, text: msg.text });
    this.showTyping(true);

    setTimeout(() => {
      this.showTyping(false);
      const rates = { USD: '3.67 ريال', ILS: '1.02 دولار', JOD: '1.41 دولار' };
      const reply = `📊 أسعار الصرف الحالية:
💵 الدولار الأمريكي (USD): ${rates.USD}
🇮🇱 الشيكل (ILS): ${rates.ILS}
🇯🇴 الدينار الأردني (JOD): ${rates.JOD}

✅ نعم نحول لجميع الدول
📞 للاستفسار تواصل مع المشرف`;
      this.addMsg(group, { direction: 'out', type: 'bot_reply', text: reply });
    }, 1200);
  },

  // ══════════════════════════════════════════════════════════
  //  Send triggered simulation message
  // ══════════════════════════════════════════════════════════
  sendSimulatedMsg(type) {
    const group = this.activeGroup === 'agent' ? 'aswar' : this.activeGroup;
    if (this.activeGroup === 'agent') this.switchGroup('aswar', document.getElementById('wgt-aswar'));

    if (type === 'inquiry') {
      const items = this.sampleMessages.inquiry;
      const msg = items[Math.floor(Math.random() * items.length)];
      this.processInquiry(group, msg);
      return;
    }

    if (type === 'confirm') {
      const items = this.sampleMessages.confirm;
      const msg = items[Math.floor(Math.random() * items.length)];
      this.addMsg(group, { direction: 'in', type: 'text', sender: msg.sender, text: msg.text });
      this.showTyping(true);
      setTimeout(() => {
        this.showTyping(false);
        this.addMsg(group, { direction: 'out', type: 'bot_reply', text: '✅ تم تسجيل التأكيد. ستُنفَّذ الحوالة قريباً!' });
        showToast && showToast('تم تأكيد الحوالة من الجروب!', 'success');
      }, 1000);
      return;
    }

    if (type === 'image_receipt') {
      const allData = [...this.sampleMessages.text_simple, ...this.sampleMessages.text_complex].filter(x => x.amount);
      const data = allData[Math.floor(Math.random() * allData.length)];
      this.processImageMessage(group, data.sender, data);
      return;
    }

    // text_simple or text_complex
    const pool = this.sampleMessages[type] || this.sampleMessages.text_simple;
    const msg = pool[Math.floor(Math.random() * pool.length)];
    this.processTransferMessage(group, msg, msg);
  },

  triggerRandom() {
    const types = ['text_simple', 'text_simple', 'text_complex', 'image_receipt', 'inquiry'];
    const groups = ['aswar', 'abuhashim', 'random'];
    const group = groups[Math.floor(Math.random() * groups.length)];
    const type  = types[Math.floor(Math.random() * types.length)];

    if (this.activeGroup !== group) {
      const tabId = 'wgt-' + group;
      const tab = document.getElementById(tabId);
      if (tab) this.switchGroup(group, tab);
    }
    this.sendSimulatedMsg(type);
  },

  // ══════════════════════════════════════════════════════════
  //  Send correction BACK to WhatsApp group
  // ══════════════════════════════════════════════════════════
  sendCorrection(note) {
    if (!this.pendingData) { showToast && showToast('لا توجد حوالة نشطة لإرسال تصحيح', 'warning'); return; }
    const { group, name, amount, currency, secCode } = this.pendingData;

    // Show correction outgoing in source group
    this.addMsg(group, {
      direction: 'out', type: 'text',
      text: `⚠️ تصحيح من موظف التلر:\n${note}`
    });

    showToast && showToast('تم إرسال التصحيح للجروب الأصلي', 'success');

    // After correction — send final to agent group
    setTimeout(() => {
      const now = new Date();
      const finalMsg = `⚡ حوالة للتنفيذ
━━━━━━━━━━━━━━━━━━
👤 ${name}
💰 ${amount} ${currency}
🔐 ${secCode}
🕐 ${now.toLocaleTimeString('ar-EG', { hour12: true })}
━━━━━━━━━━━━━━━━━━
✅ موثّقة ومراجعة`;

      this.addMsg('agent', { direction: 'out', type: 'text', text: finalMsg });
      this.switchGroup('agent', document.getElementById('wgt-agent'));
      showToast && showToast('تم إرسال الحوالة المُصحّحة إلى برهوم', 'success');
    }, 800);
  },

  // ══════════════════════════════════════════════════════════
  //  Send custom typed message
  // ══════════════════════════════════════════════════════════
  sendCustomMsg() {
    const input = document.getElementById('waInput');
    const text = input?.value?.trim();
    if (!text) return;
    input.value = '';

    const group = this.activeGroup === 'agent' ? 'agent' : this.activeGroup;
    if (this.activeGroup === 'agent') {
      this.addMsg('agent', { direction: 'out', type: 'text', text });
      return;
    }

    // Simulate as incoming from "مستخدم مجهول"
    const fakeMsg = { sender: 'مستخدم', text };

    // Detect if it looks like a transfer
    const hasAmount = /\d+/.test(text);
    const hasName   = /اسم|على اسم|لـ|حول|إيداع/i.test(text);

    if (hasAmount && hasName) {
      const amount = parseInt(text.match(/\d+/)?.[0] || '0');
      const nameMatch = text.match(/(?:اسم|لـ|على)\s+([^\n،,]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : 'مستخدم مجهول';
      this.processTransferMessage(group, fakeMsg, { name, amount, currency: 'USD', dest: '—' });
    } else if (/سعر|صرف|كم|ممكن|هل/.test(text)) {
      this.processInquiry(group, fakeMsg);
    } else {
      this.addMsg(group, { direction: 'in', type: 'text', sender: 'مستخدم', text });
    }
  },

  setStatus(text) {
    const el = document.getElementById('waBotStatus');
    if (el) el.textContent = text;
  },
};

// Auto-simulate disabled — using real WhatsApp via wa-bridge.js

// ── Add "إرسال تصحيح" button to existing form ───────────────
document.addEventListener('DOMContentLoaded', () => {
  const actionBtns = document.querySelector('.action-buttons');
  if (actionBtns) {
    const corrBtn = document.createElement('button');
    corrBtn.className = 'btn';
    corrBtn.style.cssText = 'background:rgba(37,211,102,0.12);color:#25D366;border:1px solid rgba(37,211,102,0.3);width:100%;margin-top:8px;';
    corrBtn.innerHTML = 'إرسال تصحيح للجروب';
    corrBtn.onclick = () => {
      const note = prompt('أدخل ملاحظة التصحيح:');
      if (note) WA.sendCorrection(note);
    };
    actionBtns.appendChild(corrBtn);
  }
});

// ── Global function aliases (called from HTML) ───────────────
function toggleWAPanel()         { WA.togglePanel(); }
function switchWAGroup(g, btn)   { WA.switchGroup(g, btn); }
function sendSimMsg(type)        { WA.sendSimulatedMsg(type); }
function triggerRandomMessage()  { WA.triggerRandom(); }
function sendCustomWAMsg()       { WA.sendCustomMsg(); }
function openReceiptModal(src)   { WA.openReceiptModal(src); }
