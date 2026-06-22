/**
 * wa-bridge.js
 * يجلب الرسائل من Django (الذي يستقبلها من Baileys)
 * ويعرضها في لوحة الحوالات
 */
(function () {
  'use strict';

  const POLL_INTERVAL = 3000;   // كل 3 ثوانٍ
  let   _lastTs       = 0;
  let   _pollTimer    = null;
  let   _groups       = {};     // jid → name
  let   _connected    = false;

  // ── عرض حالة الاتصال ───────────────────────────────────────────────────────
  function _setStatus(connected) {
    _connected = connected;
    const badge = document.getElementById('wa-bridge-status');
    if (!badge) return;
    badge.textContent   = connected ? 'واتساب متصل' : 'واتساب غير متصل';
    badge.style.color   = connected ? '#25d366' : '#f87171';
  }

  // ── جلب المجموعات ──────────────────────────────────────────────────────────
  async function _fetchGroups() {
    try {
      const r = await fetch('/api/wa/groups/');
      const d = await r.json();
      if (d.ok && d.groups) {
        _groups = {};
        d.groups.forEach(g => { _groups[g.jid] = g.name; });
        _renderGroupTabs();
        _updateGroupSelectorUI(_groups);
      }
    } catch (e) {}
  }

  // ── رسم تبويبات المجموعات ──────────────────────────────────────────────────
  function _renderGroupTabs() {
    const container = document.getElementById('wa-dynamic-tabs');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(_groups).forEach(([jid, name]) => {
      const btn = document.createElement('button');
      btn.className       = 'wa-src-tab';
      btn.dataset.jid     = jid;
      btn.textContent     = name;
      btn.onclick         = () => _filterByJid(jid, btn);
      container.appendChild(btn);
    });
  }

  // ── فلتر حسب الـ JID ───────────────────────────────────────────────────────
  function _filterByJid(jid, btn) {
    document.querySelectorAll('.wa-src-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // أعد رسم القائمة بالمجموعة المحددة
    _renderMessages(_cachedMessages.filter(m => m.jid === jid));
  }

  let _cachedMessages = [];

  // ── جلب الرسائل الجديدة ────────────────────────────────────────────────────
  async function _poll() {
    try {
      const r = await fetch(`/api/wa/messages/?since=${_lastTs}`);
      const d = await r.json();
      if (!d.ok) return;
      _setStatus(true);

      if (d.messages && d.messages.length > 0) {
        // أضف للـ cache
        d.messages.forEach(m => {
          if (!_cachedMessages.find(c => c.id === m.id)) {
            _cachedMessages.push(m);
          }
        });
        // اضبط آخر timestamp
        _lastTs = Math.max(...d.messages.map(m => m.timestamp));
        // عرض الرسائل الجديدة
        _appendMessages(d.messages);
        // تحديث المجموعات
        await _fetchGroups();
      }
    } catch (e) {
      _setStatus(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── نظام تصنيف الرسائل: حوالة حقيقية أم كلام عادي ────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // قائمة الانتظار — رسائل مشكوك فيها تنتظر مراجعة المدير
  const _pendingReview = [];

  // ─ أنماط الرفض الفوري (كلام عادي مؤكد) ─────────────────────────────────
  const _REJECT_PATTERNS = [
    /^(صباح|مساء|السلام|وعليكم|أهلاً|اهلاً|مرحبا|هلا|يسعد|تمام|ماشي|حسناً|حسنا|ان شاء الله|إن شاء الله|شكراً|شكرا|جزاك|بارك الله|الله يعطيك|يعطيك العافية|ممتاز|عظيم|رائع|ولله|يا شيخ|حبيبي|يسلمو|الحمد|سبحان|الله اكبر)\b/i,
    /https?:\/\//i,       // رابط
    /^(نعم|لا|أوك|ok|okay|yes|no|👍|✅|☑|✓)\s*$/i,
    /^.{0,8}$/,           // أقل من 8 أحرف (ناتج تقليص بالـ trim لاحقاً)
  ];

  // فحص إذا كانت الرسالة تتكون من إيموجي ومسافات فقط (بديل آمن للـ regex المعطوب)
  function _isEmojiOnly(text) {
    return text.replace(/\p{Emoji}/gu, '').replace(/\s/g, '').length === 0;
  }

  // ─ كلمات العملات (لازم واحدة منها على الأقل للحوالة) ──────────────────
  const _CURRENCY_RX = /دولار|dollar|usd|\$|يورو|euro|eur|€|دينار|dinar|jod|iqd|شيكل|shekel|ils|ليرة|lira|try|ريال|sar|درهم|aed|جنيه|egp|tnd|mad/i;

  // ─ كلمات تعزّز احتمال الحوالة ─────────────────────────────────────────
  const _HAWALA_KEYWORDS = /حوالة|تحويل|إرسال|ارسال|استلام|دفع|صرف|حساب|وصلت|يوصل|موصلة|ارقام|اليوم|عنده|عندها|لصاحبه|للمستلم|بنك|ايبان|iban|محفظة|usdt|trc|تيثر|باي/i;

  // ─ كلمات تدل على رد (تأكيد) لا حوالة جديدة ───────────────────────────
  const _REPLY_INDICATORS = /تم|تمام|ماشي|وصل|تسلم|استلم|مزبوط|موصل|شكرا|✅|👍|تفضل|تحت امرك/i;

  /**
   * _scoreMsg(text) → { score, reasons }
   * نظام النقاط:
   *   +3  وجود عملة
   *   +2  رقم هاتف (7+ خانات)
   *   +2  مبلغ (رقم 2-6 خانات)
   *   +1  اسم عربي (كلمتان+)
   *   +2  كلمة من _HAWALA_KEYWORDS
   *   -3  نمط رد/تأكيد
   *   الحد الأدنى للقبول: 4 نقاط
   *   المنطقة الرمادية (انتظار مراجعة): 2-3 نقاط
   */
  function _scoreMsg(text) {
    const norm = text.replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660)).trim();
    let score = 0;
    const reasons = [];

    if (_CURRENCY_RX.test(norm))      { score += 3; reasons.push('عملة'); }
    if (_HAWALA_KEYWORDS.test(norm))  { score += 2; reasons.push('كلمة حوالة'); }
    if (_REPLY_INDICATORS.test(norm)) { score -= 3; reasons.push('رد/تأكيد'); }

    // رقم هاتف (7-15 خانة)
    const phoneM = norm.match(/\b\d{7,15}\b/g) || [];
    if (phoneM.length > 0) { score += 2; reasons.push('هاتف'); }

    // مبلغ (2-6 خانات)
    const amountM = norm.match(/\b\d{2,6}(\.\d{1,3})?\b/g) || [];
    if (amountM.length > 0) { score += 2; reasons.push('مبلغ'); }

    // اسم عربي (كلمتان أو أكثر)
    if (/[؀-ۿ]{2,}\s+[؀-ۿ]{2,}/.test(norm)) { score += 1; reasons.push('اسم'); }

    return { score, reasons };
  }

  /**
   * _classifyMsg(text) → 'hawala' | 'pending' | 'ignore'
   *   hawala  = score ≥ 4  → أضف مباشرة للحوالات
   *   pending = score 2-3  → أضف لقائمة الانتظار
   *   ignore  = score < 2  → تجاهل تام
   */
  function _classifyMsg(text) {
    try {
      const trimmed = (text || '').trim();

      // رفض فوري قبل الحساب
      for (const rx of _REJECT_PATTERNS) {
        if (rx.test(trimmed)) return 'ignore';
      }
      // رسالة تتكون من إيموجي فقط
      if (_isEmojiOnly(trimmed)) return 'ignore';
      // رسالة قصيرة جداً (أقل من 8 أحرف بعد إزالة المسافات)
      if (trimmed.replace(/\s/g,'').length < 8) return 'ignore';

      const { score } = _scoreMsg(trimmed);
      if (score >= 4) return 'hawala';
      if (score >= 2) return 'pending';
      return 'ignore';
    } catch (e) {
      console.warn('wa-bridge: _classifyMsg error', e);
      return 'ignore';
    }
  }

  // ── تحليل نص الرسالة لاستخراج البيانات ──────────────────────────────────
  function _parseMsg(text) {
    // تحويل الأرقام العربية-الهندية إلى غربية
    const n = text.replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660));
    const lines = n.split(/\n/);

    // ── 1. العملة ────────────────────────────────────────────────────────────
    const CURRENCIES = [
      [/دولار|dollar|usd|\$/i,              'USD'],
      [/يورو|euro|eur|€/i,                  'EUR'],
      [/دينار\s*أردني|دينار\s*اردني|jod/i,  'JOD'],
      [/دينار\s*عراقي|iqd/i,               'IQD'],
      [/دينار|dinar/i,                      'JOD'],
      [/شيكل|shekel|ils/i,                  'ILS'],
      [/ليرة\s*تركية|try/i,                 'TRY'],
      [/ريال\s*سعودي|sar/i,                 'SAR'],
      [/ريال/i,                             'SAR'],
      [/درهم\s*إماراتي|درهم\s*اماراتي|aed/i,'AED'],
      [/جنيه\s*مصري|egp/i,                 'EGP'],
      [/جنيه/i,                             'EGP'],
      [/دينار\s*تونسي|tnd/i,               'TND'],
      [/درهم\s*مغربي|mad/i,                'MAD'],
      [/درهم/i,                             'AED'],
    ];
    let currency = 'USD';
    for (const [pat, cur] of CURRENCIES) {
      if (pat.test(n)) { currency = cur; break; }
    }

    // ── 2. استخراج الأرقام مع سياق كل سطر ───────────────────────────────────
    const allNums = [];
    lines.forEach(line => {
      const nearCur      = _CURRENCY_RX.test(line);
      const nearPhone    = /هاتف|جوال|موبايل|رقم|تلفون|phone|mobile|واتساب|whatsapp/i.test(line);
      const nearAmount   = /مبلغ|قيمة|مجموع|يرسل|ارسل|حوالة|تحويل|يستلم|دفع/i.test(line);
      const nearYear     = /20\d{2}|19\d{2}/.test(line);  // سنة ميلادية

      const matches = [...line.matchAll(/(\d[\d,.]*)/g)];
      matches.forEach(m => {
        const raw    = m[1].replace(/,/g, '');
        const val    = parseFloat(raw);
        if (isNaN(val) || val <= 0) return;
        const digits = raw.replace('.', '').replace('-','').length;
        allNums.push({ val, digits, nearCur, nearPhone, nearAmount, nearYear, line, raw });
      });
    });

    // ── 3. استخراج أرقام الهواتف بدقة ────────────────────────────────────────
    // الكود الدولي: 962(الأردن) 970(فلسطين) 972(إسرائيل) 966(السعودية)
    //               971(الإمارات) 20(مصر) 90(تركيا) 1(أمريكا) 44(بريطانيا)
    const PHONE_RX = /(?:\+|00)?(962|970|972|966|971|973|974|965|968|20|90|1|44|216|212|218)\d{7,12}/g;
    const phoneMatches = [...n.matchAll(PHONE_RX)];

    let phone = '';
    if (phoneMatches.length > 0) {
      // أول رقم هاتف دولي موثوق
      phone = phoneMatches[0][0].replace(/\D/g, '');
    } else {
      // fallback: رقم 10-15 خانة لا يبدأ بـ 20xx (سنة)
      const phoneCandidates = allNums.filter(x => {
        if (x.digits < 9 || x.digits > 15) return false;
        if (x.nearYear && x.digits === 4)   return false; // سنة
        // تجنب السنوات 2000-2099
        if (/^20\d{2}$/.test(x.raw))        return false;
        return true;
      });
      // فضّل الرقم الذي في سطر "هاتف / رقم"
      const onPhoneLine = phoneCandidates.filter(x => x.nearPhone);
      if (onPhoneLine.length > 0) {
        phone = String(onPhoneLine[0].val);
      } else if (phoneCandidates.length > 0) {
        phoneCandidates.sort((a, b) => b.digits - a.digits);
        phone = String(phoneCandidates[0].val);
      }
    }
    phone = phone.replace(/\D/g, '');

    // ── 4. استخراج المبلغ بدقة ───────────────────────────────────────────────
    let amount = 0;

    // أولوية 1: رقم في سطر يحتوي عملة + كلمة مبلغ
    const highConf = allNums.filter(x =>
      x.nearCur && x.nearAmount && x.digits >= 1 && x.digits <= 7 &&
      String(x.val) !== phone
    );
    if (highConf.length > 0) {
      amount = highConf[0].val;
    }

    // أولوية 2: رقم في سطر يحتوي عملة فقط (2-6 خانات، ليس هاتف، ليس سنة)
    if (!amount) {
      const withCur = allNums.filter(x => {
        if (!x.nearCur) return false;
        if (x.digits < 1 || x.digits > 6) return false;
        if (String(x.val) === phone) return false;
        if (/^20\d{2}$/.test(x.raw)) return false; // سنة
        return true;
      });
      if (withCur.length > 0) {
        // أكبر قيمة (لا نريد 5 بدل 500)
        amount = Math.max(...withCur.map(x => x.val));
      }
    }

    // أولوية 3: أصغر رقم مستقل (2-6 خانات) لا يبدو رقم هاتف
    if (!amount) {
      const shortNums = allNums.filter(x => {
        if (x.digits < 2 || x.digits > 6) return false;
        if (String(x.val) === phone) return false;
        if (/^20\d{2}$/.test(x.raw)) return false;
        if (x.val < 1) return false;
        return true;
      });
      if (shortNums.length > 0) {
        // أكبر رقم قصير (يكون المبلغ عادةً)
        amount = Math.max(...shortNums.map(x => x.val));
      }
    }

    // ── 5. استخراج الاسم بدقة ────────────────────────────────────────────────
    let name = '';

    // الكلمات التي تشير إلى عنوان أو موضوع وليست اسماً
    const NAME_BLACKLIST = /إلى|الى|عبر|من خلال|بنك|محفظة|حساب|مجموعة|مشروع|مكتب|شركة|جهة|مكان|عنوان|مدينة|دولة|بلد/;

    // أولوية 1: سطر مسبوق بـ "اسم:" أو "المستفيد:" أو "باسم:"
    for (const line of lines) {
      const m = line.match(/(?:اسم|المستفيد|باسم|صاحب|لصالح|لحساب)\s*[:：]\s*([؀-ۿ][؀-ۿ\s]{3,})/);
      if (m) { name = m[1].trim(); break; }
    }

    // أولوية 2: سطر يحتوي فقط أحرفاً عربية (كلمتان أو أكثر) بلا أرقام
    if (!name) {
      for (const line of lines) {
        const t = line.trim();
        // يجب أن يكون عربياً خالصاً، كلمتان+، بلا أرقام، بلا كلمات سوداء
        if (
          /^[؀-ۿ\s]{5,}$/.test(t) &&
          /[؀-ۿ]{2,}\s+[؀-ۿ]{2,}/.test(t) &&
          !/\d/.test(t) &&
          !NAME_BLACKLIST.test(t)
        ) {
          name = t;
          break;
        }
      }
    }

    // أولوية 3: أول تسلسل كلمتين عربيتين من النص
    if (!name) {
      const m = n.match(/[؀-ۿ]{2,}(?:\s+[؀-ۿ]{2,}){1,3}/);
      if (m && !NAME_BLACKLIST.test(m[0])) name = m[0].trim();
    }

    // تنظيف: احذف الكلمات الإجرائية من بداية الاسم ونهايته
    name = name
      .replace(/^(اسم|المستفيد|باسم|صاحب|لصالح|لحساب)\s*/i, '')
      .replace(/\s+(يرسل|يحول|يطلب|يريد).*$/i, '')
      .trim();

    // حد أقصى 4 كلمات للاسم
    const nameWords = name.split(/\s+/).filter(Boolean);
    if (nameWords.length > 4) name = nameWords.slice(0, 4).join(' ');

    // ── 6. محفظة / IBAN / TRC20 ──────────────────────────────────────────────
    let wallet = null;
    const trc  = n.match(/T[A-Za-z0-9]{25,34}/);
    const iban = n.match(/\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/);
    if (trc)       wallet = { type: 'ewallet', number: trc[0] };
    else if (iban) wallet = { type: 'iban',    number: iban[0] };

    return { amount, currency, name, phone, wallet };
  }

  // ── تحويل رسالة واتساب إلى كائن transfer وإضافته للقائمة ─────────────────
  function _addToTransfers(msg) {
    if (typeof transfers === 'undefined') return;

    // تجنب التكرار
    if (transfers.find(t => t.waId === msg.id)) return;
    if (_pendingReview.find(p => p.msg.id === msg.id)) return;

    // ── تصنيف الرسالة ──────────────────────────────────────────────────────
    const classification = _classifyMsg(msg.text || '');
    const { score, reasons } = _scoreMsg(msg.text || '');

    if (classification === 'ignore') {
      console.log(`🚫 wa-bridge: تم تجاهل "${(msg.text||'').slice(0,40)}" | نقاط: ${score}`);
      if (msg.dbId) _updateDbType(msg.dbId, 'ignore');
      return;
    }

    if (classification === 'pending') {
      console.log(`⏳ wa-bridge: انتظار مراجعة "${(msg.text||'').slice(0,40)}" | نقاط: ${score} | ${reasons.join(', ')}`);
      _pendingReview.push({ msg, score, reasons, addedAt: Date.now() });
      _renderPendingBadge();
      if (msg.dbId) _updateDbType(msg.dbId, 'chat');
      return;
    }

    console.log(`✅ wa-bridge: حوالة "${(msg.text||'').slice(0,40)}" | نقاط: ${score} | ${reasons.join(', ')}`);
    if (msg.dbId) _updateDbType(msg.dbId, 'hawala');

    _buildTransfer(msg, score, reasons);
  }

  // ── تحديث نوع الرسالة في DB ──────────────────────────────────────────────
  function _updateDbType(dbId, type) {
    fetch(`/api/wa/msg/${dbId}/type/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    }).catch(() => {});
  }

  // ── بناء كائن الحوالة وإضافته للقائمة ────────────────────────────────────
  function _buildTransfer(msg, score, reasons) {
    if (typeof transfers === 'undefined') return;
    if (transfers.find(t => t.waId === msg.id)) return;

    const parsed = _parseMsg(msg.text);
    const time   = msg.timestamp
      ? new Date(msg.timestamp * 1000).toLocaleTimeString('ar', { hour:'2-digit', minute:'2-digit' })
      : '';

    // حدد المجموعة بناءً على اسمها
    const gName = (msg.groupName || '').toLowerCase();
    let group = 'random';
    if (gName.includes('أساور') || gName.includes('اساور') || gName.includes('aswar'))         group = 'aswar';
    else if (gName.includes('هاشم') || gName.includes('hashim') || gName.includes('abuhashim')) group = 'abuhashim';

    const newId = Date.now() + Math.floor(Math.random()*1000);

    const replyJid   = msg.senderJid || msg.jid || '';
    const replyPhone = replyJid.replace('@s.whatsapp.net','').replace('@g.us','');

    const transfer = {
      id:         newId,
      waId:       msg.id,
      dbId:       msg.dbId || null,   // ID في قاعدة البيانات إذا أتت من الـ feed
      group,
      name:       parsed.name || msg.senderName,
      amount:     parsed.amount || 0,
      currency:   parsed.currency,
      msg:        msg.text,
      time,
      status:     'new',
      phone:      parsed.phone || replyPhone,
      wallet:     parsed.wallet || null,
      groupName:  msg.groupName || '',
      sender:     msg.senderName,
      jid:        msg.jid || '',
      senderJid:  msg.senderJid || '',
      replyPhone: replyPhone,
    };

    transfers.unshift(transfer);

    if (typeof renderTransfers === 'function') renderTransfers(true);

    const badge = document.getElementById('incomingCount');
    if (badge) badge.textContent = transfers.filter(t => t.status === 'new').length;

    return newId;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── نافذة السياق: ساعتان من محادثة القروب قبل الحوالة ────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  let _contextModal = null;

  window.waBridgeOpenContext = async function(dbId, transferData) {
    // أنشئ المودال إذا لم يكن موجوداً
    if (!_contextModal) {
      _contextModal = document.createElement('div');
      _contextModal.id = 'wa-context-modal';
      _contextModal.style.cssText = `
        display:none;position:fixed;inset:0;z-index:9999;
        background:rgba(10,14,26,.85);align-items:center;justify-content:center;
      `;
      _contextModal.innerHTML = `
        <div style="background:#141929;border:1px solid rgba(255,255,255,.1);border-radius:18px;
                    width:min(680px,95vw);max-height:85vh;display:flex;flex-direction:column;overflow:hidden">
          <div style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.07);
                      display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
            <div>
              <div style="font-weight:700;font-size:15px;color:#e2e8f0">سياق المحادثة</div>
              <div id="wa-ctx-subtitle" style="font-size:11px;color:#9aa3b8;margin-top:2px">ساعتان قبل الحوالة</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button onclick="waBridgeFillFromContext()" id="wa-ctx-fill-btn"
                style="background:#2563eb;color:#fff;border:none;border-radius:8px;
                       padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">
                تعبئة الفورم
              </button>
              <button onclick="waBridgeCloseContext()"
                style="background:rgba(255,255,255,.06);color:#9aa3b8;border:none;
                       border-radius:8px;width:30px;height:30px;font-size:16px;cursor:pointer">×</button>
            </div>
          </div>
          <div id="wa-ctx-body" style="overflow-y:auto;padding:14px 16px;flex:1;
                                        display:flex;flex-direction:column;gap:6px">
            <div style="text-align:center;color:#9aa3b8;padding:40px;font-size:13px">جاري التحميل...</div>
          </div>
        </div>
      `;
      document.body.appendChild(_contextModal);
    }

    _contextModal._transferData = transferData;
    _contextModal._contextMsgs  = [];
    _contextModal.style.display = 'flex';

    const body = document.getElementById('wa-ctx-body');
    body.innerHTML = '<div style="text-align:center;color:#9aa3b8;padding:40px;font-size:13px">جاري التحميل...</div>';

    // جلب السياق من DB
    try {
      let url = '';
      if (dbId) {
        url = `/api/wa/context/${dbId}/`;
      } else {
        // بديل: جلب feed القروب في آخر 3 ساعات
        const jid = transferData.jid || '';
        url = `/api/wa/feed/?jid=${encodeURIComponent(jid)}&hours=3`;
      }

      const r = await fetch(url);
      const d = await r.json();
      if (!d.ok) throw new Error('فشل الجلب');

      const msgs = d.messages || [];
      _contextModal._contextMsgs = msgs;

      const subtitle = document.getElementById('wa-ctx-subtitle');
      if (subtitle) subtitle.textContent = `${msgs.length} رسالة — ${transferData.groupName || ''}`;

      if (msgs.length === 0) {
        body.innerHTML = '<div style="text-align:center;color:#9aa3b8;padding:40px">لا توجد رسائل محفوظة</div>';
        return;
      }

      body.innerHTML = msgs.map(m => {
        const isHawala  = m.type === 'hawala';
        const timeStr   = m.timestamp
          ? new Date(m.timestamp * 1000).toLocaleTimeString('ar', { hour:'2-digit', minute:'2-digit' })
          : (m.receivedAt ? m.receivedAt.slice(11,16) : '');
        const bgColor   = isHawala ? 'rgba(37,99,235,.15)' : 'rgba(255,255,255,.03)';
        const border    = isHawala ? '1px solid rgba(37,99,235,.4)' : '1px solid rgba(255,255,255,.06)';
        const badge     = isHawala ? '<span style="background:#2563eb;color:#fff;font-size:9px;padding:1px 6px;border-radius:4px;margin-right:6px">حوالة</span>' : '';

        return `
          <div style="background:${bgColor};border:${border};border-radius:10px;padding:10px 13px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <div style="font-size:11px;font-weight:600;color:#7c8db5">
                ${badge}${_esc(m.senderName || '')}
              </div>
              <div style="font-size:10px;color:#586285">${timeStr}</div>
            </div>
            <div style="font-size:13px;color:#c8d3ea;line-height:1.6;white-space:pre-wrap;word-break:break-word">
              ${_esc(m.text)}
            </div>
          </div>`;
      }).join('');

    } catch(e) {
      body.innerHTML = `<div style="text-align:center;color:#f87171;padding:40px">خطأ في جلب السياق: ${e.message}</div>`;
    }
  };

  window.waBridgeCloseContext = function() {
    if (_contextModal) _contextModal.style.display = 'none';
  };

  // تعبئة الفورم من السياق الكامل للمحادثة
  window.waBridgeFillFromContext = function() {
    if (!_contextModal) return;
    const msgs     = _contextModal._contextMsgs || [];
    const transfer = _contextModal._transferData || {};

    // دمج كل نصوص المحادثة في نص واحد للتحليل
    const combinedText = msgs.map(m => m.text).join('\n');

    // استخدم _parseMsg على النص المدمج
    // نحتاج تصدير الدالة مؤقتاً
    const parsed = _parseMsg(combinedText);

    // أكمل البيانات الناقصة من الـ transfer الأصلي
    const name     = parsed.name     || transfer.name     || '';
    const phone    = parsed.phone    || transfer.phone    || '';
    const amount   = parsed.amount   || transfer.amount   || 0;
    const currency = parsed.currency || transfer.currency || 'USD';

    // تعبئة الفورم
    _fillForm({ name, phone, amount, currency, wallet: parsed.wallet });
    waBridgeCloseContext();
  };

  function _fillForm(data) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }
    };
    setVal('src-name',     data.name);
    setVal('src-phone',    data.phone);
    setVal('src-amount',   data.amount);
    setVal('src-currency', data.currency);
    if (data.wallet) setVal('src-wallet', data.wallet.number);
  }

  function _esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── شارة قائمة الانتظار ────────────────────────────────────────────────────
  function _renderPendingBadge() {
    let badge = document.getElementById('wa-pending-badge');
    if (!badge) return;
    const count = _pendingReview.length;
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  // ── فتح نافذة مراجعة الانتظار (يستدعيها transactions.js) ──────────────────
  window.waBridgeOpenPending = function() {
    const modal = document.getElementById('wa-pending-modal');
    if (!modal) return;
    _renderPendingModal();
    modal.style.display = 'flex';
  };

  window.waBridgeClosePending = function() {
    const modal = document.getElementById('wa-pending-modal');
    if (modal) modal.style.display = 'none';
  };

  function _renderPendingModal() {
    const list = document.getElementById('wa-pending-list');
    if (!list) return;
    if (_pendingReview.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:#9aa3b8;padding:32px;font-size:13px">لا توجد رسائل في الانتظار</div>';
      return;
    }
    list.innerHTML = _pendingReview.map((p, idx) => {
      const preview = (p.msg.text || '').slice(0, 120).replace(/\n/g, ' ');
      const timeStr = p.msg.timestamp
        ? new Date(p.msg.timestamp * 1000).toLocaleTimeString('ar', { hour:'2-digit', minute:'2-digit' })
        : '';
      const tagsHtml = p.reasons.map(r => `<span style="background:rgba(201,168,76,.15);color:#c9a84c;border-radius:4px;padding:1px 6px;font-size:10px">${r}</span>`).join(' ');
      return `
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:12px;font-weight:700;color:#e8eaf0">${p.msg.senderName || 'مجهول'}</span>
              <span style="font-size:10px;color:#9aa3b8">${p.msg.groupName || ''} · ${timeStr}</span>
              <span style="font-size:10px;color:#64748b">نقاط: ${p.score}</span>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              ${tagsHtml}
            </div>
          </div>
          <div style="font-size:12px;color:#cbd5e1;line-height:1.6;word-break:break-word;direction:rtl">${preview}</div>
          <div style="display:flex;gap:8px">
            <button onclick="waBridgeConfirmPending(${idx})"
              style="flex:1;padding:7px;border-radius:8px;border:none;background:linear-gradient(135deg,#00c97a,#059669);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">
              قبول كحوالة
            </button>
            <button onclick="waBridgeRejectPending(${idx})"
              style="flex:1;padding:7px;border-radius:8px;border:1px solid rgba(255,77,106,.3);background:transparent;color:#ff4d6a;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">
              تجاهل
            </button>
          </div>
        </div>`;
    }).join('');
  }

  window.waBridgeConfirmPending = function(idx) {
    const item = _pendingReview[idx];
    if (!item) return;
    _pendingReview.splice(idx, 1);
    _buildTransfer(item.msg, item.score, item.reasons);
    _renderPendingBadge();
    _renderPendingModal();
    console.log('✅ wa-bridge: قُبلت رسالة الانتظار يدوياً');
  };

  window.waBridgeRejectPending = function(idx) {
    const item = _pendingReview[idx];
    if (!item) return;
    _pendingReview.splice(idx, 1);
    _renderPendingBadge();
    _renderPendingModal();
    console.log('🗑 wa-bridge: رُفضت رسالة الانتظار');
  };

  // ── إضافة رسائل جديدة ──────────────────────────────────────────────────────
  function _appendMessages(messages) {
    messages.forEach(msg => {
      _cachedMessages.push(msg);
      _addToTransfers(msg);
    });
  }

  // ── فلتر بالمجموعة ─────────────────────────────────────────────────────────
  function _renderMessages(messages) {
    if (typeof renderTransfers === 'function') renderTransfers(true);
  }

  // ── استخدام رسالة في النموذج ───────────────────────────────────────────────
  window.waBridgeUseMsg = function (waId) {
    const msg = _cachedMessages.find(m => m.id === waId);
    if (!msg) return;

    // ابحث عن الـ transfer المقابل في القائمة
    const t = transfers.find(x => x.waId === waId);
    if (t && typeof selectTransfer === 'function') {
      selectTransfer(t.id);
    }
  };

  // ── مساعدات ─────────────────────────────────────────────────────────────────
  function _escHtml(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _escAttr(s) {
    return String(s || '').replace(/'/g,"\\'").replace(/\n/g,' ');
  }

  // ── إرسال حوالة لوكيل عبر واتساب ──────────────────────────────────────────
  window.waBridgeSendToAgent = async function({ toNumber, message, transferCode, agentId }) {
    // تنظيف الرقم قبل الإرسال
    const cleanedNumber = (toNumber || '').replace(/[^0-9]/g, '');
    if (!cleanedNumber) {
      console.error('wa-bridge: رقم الهاتف فارغ أو غير صالح:', toNumber);
      return { ok: false, error: 'رقم الهاتف فارغ — تأكد من اختيار حوالة بها رقم مرسل' };
    }

    console.log(`📤 wa-bridge: محاولة إرسال → رقم أصلي: "${toNumber}" | رقم نظيف: "${cleanedNumber}"`);

    try {
      const r = await fetch('/api/wa/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:            cleanedNumber,
          message:       message,
          transfer_code: transferCode || '',
          agent_id:      agentId || '',
        }),
      });
      const d = await r.json();
      console.log(`wa-bridge /api/wa/send/ status=${r.status} ok=${d.ok} sent_to=${d.sent_to} error="${d.error||''}" cleaned="${d.cleaned||''}"`);

      if (d.ok) {
        console.log(`✅ wa-bridge: أُرسلت إلى ${d.sent_to}`);
        if (transferCode) _watchReceipt(transferCode);
      } else {
        console.error(`❌ wa-bridge: فشل الإرسال — ${d.error} (رقم: ${cleanedNumber})`);
      }
      return d;
    } catch(e) {
      console.error('wa-bridge send error:', e);
      return { ok: false, error: 'خطأ في الاتصال بالسيرفر: ' + e.message };
    }
  };

  // ── التحقق من رقم واتساب (للتشخيص من الواجهة) ──────────────────────────
  window.waBridgeCheckNumber = async function(toNumber) {
    const cleaned = (toNumber || '').replace(/[^0-9]/g, '');
    try {
      const r = await fetch('/api/wa/check-number/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: cleaned }),
      });
      return await r.json();
    } catch(e) {
      return { ok: false, error: e.message };
    }
  };

  // ── مراقبة الإيصال — polling كل 8 ثوانٍ حتى التأكيد ─────────────────────
  const _receiptWatchers = {};

  function _watchReceipt(code) {
    if (_receiptWatchers[code]) return;
    let attempts = 0;
    const maxAttempts = 45; // 45 × 8s = 6 دقائق

    _receiptWatchers[code] = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch(`/api/wa/check/${encodeURIComponent(code)}/`);
        const d = await r.json();

        if (d.ok && d.status === 'confirmed') {
          clearInterval(_receiptWatchers[code]);
          delete _receiptWatchers[code];
          console.log(`✅ wa-bridge: إيصال مؤكد للكود ${code}`);
          // أشعر transactions.js
          if (typeof onReceiptConfirmed === 'function') {
            onReceiptConfirmed(code, d.receipt, d.confirmedAt);
          }
        }
      } catch(e) {}

      if (attempts >= maxAttempts) {
        clearInterval(_receiptWatchers[code]);
        delete _receiptWatchers[code];
        console.warn(`⏰ wa-bridge: انتهى وقت انتظار الإيصال للكود ${code}`);
      }
    }, 8000);
  }

  // ── تحديث المجموعات الحقيقية في قائمة الإرسال ───────────────────────────
  function _updateGroupSelectorUI(groups) {
    const sel = document.getElementById('groupSelector');
    const hint = document.getElementById('wa-no-groups-hint');
    const countBadge = document.getElementById('wa-groups-count');
    if (!sel) return;

    if (!groups || Object.keys(groups).length === 0) return;

    if (hint) hint.remove();
    if (countBadge) countBadge.textContent = Object.keys(groups).length + ' مجموعة';

    Object.entries(groups).forEach(([jid, name]) => {
      if (sel.querySelector(`[data-jid="${jid}"]`)) return; // موجودة مسبقاً
      const div = document.createElement('div');
      div.className = 'msg-group-btn';
      div.dataset.jid = jid;
      div.dataset.group = jid;
      div.onclick = () => selectMsgGroup(div, jid);
      div.style.cssText = 'display:flex;align-items:center;gap:9px;padding:10px 12px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.09);border-radius:13px;cursor:pointer;transition:all .22s;';
      div.innerHTML = `
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#32b8c6,#0891b2);display:flex;align-items:center;justify-content:center;font-size:16px;">💬</div>
        <div><div style="font-size:12px;font-weight:700;color:#e9edef;">${name}</div><div style="font-size:9px;color:#25D366;">نشطة</div></div>
      `;
      sel.appendChild(div);
    });
  }

  // ── تشغيل وإيقاف ───────────────────────────────────────────────────────────
  function start() {
    if (_pollTimer) return;
    _fetchGroups();
    _poll();
    _pollTimer = setInterval(_poll, POLL_INTERVAL);
    console.log('📡 wa-bridge: polling started');
  }

  function stop() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ابدأ تلقائياً عند تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.waBridge = { start, stop };

  // تصدير الدوال والبيانات لتستخدمها باقي الملفات
  window._waBridgeParseMsg    = _parseMsg;
  window._waBridgeClassify    = _classifyMsg;
  window._cachedMessages      = _cachedMessages;  // مرجع مباشر للـ array
})();
