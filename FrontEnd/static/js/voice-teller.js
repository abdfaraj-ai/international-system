/**
 * voice-teller.js
 * تعرف على الصوت عبر Web Speech API وملء حقول نماذج التلر تلقائياً
 * يعمل في Chrome / Edge — بدون Whisper أو أي سيرفر
 */

(function () {
  'use strict';

  // ── إعداد Web Speech API ─────────────────────────────────────────────────────
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API غير مدعومة في هذا المتصفح');
    return;
  }

  let recognition         = null;
  let activeTarget        = null;   // القسم المستهدف: exchange | international | cashdesk | electronic
  let overlayEl           = null;
  let _needsConfirmListen = false;  // علامة: هل ننتظر تأكيداً صوتياً بعد انتهاء الجلسة الأولى

  // ── إنشاء الواجهة ─────────────────────────────────────────────────────────────

  function buildUI() {
    // CSS
    const style = document.createElement('style');
    style.textContent = `
      .vt-fab {
        position: fixed; left: 22px; bottom: 90px; z-index: 9000;
        width: 52px; height: 52px; border-radius: 50%;
        background: linear-gradient(135deg,#32b8c6,#1a8a95);
        border: none; cursor: pointer; box-shadow: 0 4px 18px rgba(50,184,198,.45);
        display: flex; align-items: center; justify-content: center;
        transition: transform .2s, box-shadow .2s;
      }
      .vt-fab:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(50,184,198,.6); }
      .vt-fab svg { width: 22px; height: 22px; fill: #fff; }

      .vt-overlay {
        position: fixed; inset: 0; z-index: 9500;
        background: rgba(0,0,0,.65); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        animation: vtFadeIn .2s ease;
      }
      @keyframes vtFadeIn { from { opacity:0 } to { opacity:1 } }

      .vt-modal {
        background: linear-gradient(160deg,#1a2740,#0d1b2a);
        border: 1px solid rgba(50,184,198,.25);
        border-radius: 20px; padding: 30px 28px 24px;
        width: min(92vw, 420px); text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,.5);
      }
      .vt-title { color:#32b8c6; font-size:17px; font-weight:800; margin-bottom:6px; }
      .vt-sub   { color:#ffffff55; font-size:12px; margin-bottom:22px; }

      .vt-mic-btn {
        width: 100px; height: 100px; border-radius: 50%; border: none; cursor: pointer;
        background: linear-gradient(135deg,#32b8c6,#1a8a95);
        box-shadow: 0 0 0 0 rgba(50,184,198,.4);
        display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        transition: background .3s;
      }
      .vt-mic-btn.listening {
        background: linear-gradient(135deg,#e53935,#b71c1c);
        animation: vtPulse 1s infinite;
      }
      .vt-mic-btn svg { width: 40px; height: 40px; fill: #fff; }
      @keyframes vtPulse {
        0%   { box-shadow: 0 0 0 0   rgba(229,57,53,.5); }
        70%  { box-shadow: 0 0 0 18px rgba(229,57,53,0); }
        100% { box-shadow: 0 0 0 0   rgba(229,57,53,0); }
      }

      .vt-status   { color:#ffffff99; font-size:13px; min-height:20px; margin-bottom:10px; }
      .vt-spoken   {
        background: rgba(50,184,198,.08); border: 1px solid rgba(50,184,198,.2);
        border-radius: 10px; padding: 10px 14px; color:#fff; font-size:15px;
        font-weight:700; min-height:44px; margin-bottom:14px; display:none;
      }
      .vt-result   {
        background: rgba(76,175,80,.08); border: 1px solid rgba(76,175,80,.25);
        border-radius: 10px; padding: 10px 14px; color:#81c784; font-size:13px;
        margin-bottom:16px; display:none; text-align:right; line-height:1.7;
      }
      .vt-hints {
        background: rgba(255,255,255,.04); border-radius:10px; padding:12px 14px;
        margin-bottom:16px; text-align:right;
      }
      .vt-hints p   { color:#D4AF37; font-size:11px; font-weight:700; margin:0 0 7px; }
      .vt-hints span { color:#ffffff55; font-size:12px; display:block; margin-bottom:4px; }

      .vt-btn-row { display:flex; gap:10px; justify-content:center; }
      .vt-btn {
        flex:1; padding:10px; border-radius:10px; border:none; cursor:pointer;
        font-family:inherit; font-size:13px; font-weight:700;
      }
      .vt-btn-cancel { background:rgba(255,255,255,.07); color:#ffffff88; }
      .vt-btn-apply  { background:linear-gradient(135deg,#32b8c6,#1a8a95); color:#fff; display:none; }

      .vt-dept-tabs {
        display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap; justify-content:center;
      }
      .vt-dept-tab {
        padding:6px 12px; border-radius:20px; border:1px solid rgba(50,184,198,.25);
        color:#ffffff77; font-size:12px; cursor:pointer; transition:all .2s;
        background:transparent;
      }
      .vt-dept-tab.active {
        background:rgba(50,184,198,.15); border-color:rgba(50,184,198,.5); color:#32b8c6; font-weight:700;
      }
    `;
    document.head.appendChild(style);

    // FAB مخفي — الصوت يعمل عبر vb-bar المدمج في كل قسم
    // const fab = document.createElement('button'); // disabled
  }

  // ── فتح/إغلاق النافذة ────────────────────────────────────────────────────────

  function openOverlay() {
    // تحديد القسم النشط تلقائياً
    const activeDept = document.querySelector('.dept-section.active');
    activeTarget = activeDept ? activeDept.id.replace('dept-', '') : 'exchange';

    overlayEl = document.createElement('div');
    overlayEl.className = 'vt-overlay';
    overlayEl.innerHTML = buildModalHTML();
    document.body.appendChild(overlayEl);

    // أحداث الأزرار
    overlayEl.querySelector('.vt-btn-cancel').addEventListener('click', closeOverlay);
    overlayEl.querySelector('.vt-mic-btn').addEventListener('click', toggleListening);
    overlayEl.querySelector('.vt-btn-apply').addEventListener('click', applyResult);
    overlayEl.querySelectorAll('.vt-dept-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        overlayEl.querySelectorAll('.vt-dept-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTarget = tab.dataset.dept;
        updateHints();
      });
    });

    // تعيين التبويب النشط
    const activeTab = overlayEl.querySelector(`.vt-dept-tab[data-dept="${activeTarget}"]`);
    if (activeTab) activeTab.classList.add('active');
    updateHints();
  }

  function closeOverlay() {
    _needsConfirmListen = false;
    stopListening();
    stopConfirmListening();
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  function buildModalHTML() {
    return `
      <div class="vt-modal" dir="rtl">
        <div class="vt-title">الأمر الصوتي</div>
        <div class="vt-sub">اختر القسم ثم اضغط الميكروفون وتحدث</div>

        <div class="vt-dept-tabs">
          <button class="vt-dept-tab" data-dept="exchange">صرافة</button>
          <button class="vt-dept-tab" data-dept="international">حوالات</button>
          <button class="vt-dept-tab" data-dept="cashdesk">سحب/إيداع</button>
          <button class="vt-dept-tab" data-dept="electronic">إلكترونية</button>
        </div>

        <button class="vt-mic-btn">
          <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 17.93V21h2v-2.07A8 8 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z"/></svg>
        </button>

        <div class="vt-status">اضغط للاستماع</div>
        <div class="vt-spoken" id="vtSpoken"></div>
        <div class="vt-result" id="vtResult"></div>
        <div class="vt-hints" id="vtHints"></div>

        <div class="vt-btn-row">
          <button class="vt-btn vt-btn-cancel">إلغاء</button>
          <button class="vt-btn vt-btn-apply" id="vtApplyBtn">تطبيق</button>
        </div>
      </div>`;
  }

  function updateHints() {
    const el = overlayEl.querySelector('#vtHints');
    const hints = {
      exchange:      `<p>أمثلة — الصرافة:</p>
                      <span>• اشتري مية دولار</span>
                      <span>• بيع خمسمية شيكل لعميل أحمد</span>
                      <span>• صرف مية دولار لشيكل</span>`,
      international: `<p>أمثلة — الحوالات:</p>
                      <span>• حوالة الى الأردن مية دولار من أحمد</span>
                      <span>• ارسل خمسمية دولار لمحمد في تركيا</span>`,
      cashdesk:      `<p>أمثلة — سحب/إيداع:</p>
                      <span>• سحب مئتي دولار من حساب خالد</span>
                      <span>• إيداع ثلاثمية شيكل لحساب سالم</span>`,
      electronic:    `<p>أمثلة — الإلكترونية:</p>
                      <span>• تحويل مية دولار PayPal لعميل ياسر</span>
                      <span>• إيداع خمسين دولار USDT</span>`,
    };
    el.innerHTML = hints[activeTarget] || '';
  }

  // ── التعرف على الصوت ──────────────────────────────────────────────────────────

  let parsedData = null;

  function toggleListening() {
    if (!overlayEl) return;
    const btn = overlayEl.querySelector('.vt-mic-btn');
    if (btn.classList.contains('listening')) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    if (!overlayEl) return;
    parsedData          = null;
    _needsConfirmListen = false;
    stopConfirmListening();
    const btn    = overlayEl.querySelector('.vt-mic-btn');
    const status = overlayEl.querySelector('.vt-status');
    const spoken = overlayEl.querySelector('#vtSpoken');
    const result = overlayEl.querySelector('#vtResult');
    const apply  = overlayEl.querySelector('#vtApplyBtn');

    spoken.style.display = 'none';
    result.style.display = 'none';
    apply.style.display  = 'none';
    status.textContent   = 'جاري الاستماع... تحدث الآن';
    btn.classList.add('listening');

    recognition = new SpeechRecognition();
    recognition.lang           = 'ar-PS';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      spoken.textContent   = text;
      spoken.style.display = 'block';
      status.textContent   = 'جاري التحليل...';
      btn.classList.remove('listening');

      parsedData = parseCommand(text, activeTarget);

      // ── أمر تنقل — نفّذ فوراً ──
      if (parsedData && parsedData.dept === 'nav') {
        if (typeof switchDept === 'function') switchDept(parsedData.target);
        const name = NAV_DEPT_NAMES[parsedData.target] || parsedData.target;
        speakArabic('انتقلت إلى ' + name);
        closeOverlay();
        showToast('انتقلت إلى ' + name);
        parsedData = null;
        return;
      }

      // ── أمر طباعة — نفّذ فوراً بدون تأكيد ──
      if (parsedData && parsedData.dept === 'print') {
        closeOverlay();
        speakArabic('جاري طباعة الإيصال');
        showToast('جاري طباعة الإيصال...', 'info');
        setTimeout(() => {
          if (typeof printExchangeReceipt === 'function') {
            printExchangeReceipt();
          } else {
            showToast('لا توجد عملية صرافة لطباعتها', 'warning');
            speakArabic('لا توجد عملية صرافة لطباعتها');
          }
        }, 300);
        parsedData = null;
        return;
      }

      if (parsedData) {
        result.innerHTML     = formatResult(parsedData);
        result.style.display = 'block';
        apply.textContent    = 'تطبيق';
        apply.style.display  = 'block';

        if (parsedData.autoConfirm) {
          status.textContent = 'تم اكتشاف تأكيد — جاري التنفيذ...';
        } else {
          status.textContent = 'قل "تأكيد" أو "موافق" للتنفيذ — أو "إلغاء" للتراجع';
        }
        // في كلا الحالتين نعتمد على onend لتنفيذ الخطوة التالية
        _needsConfirmListen = true;
      } else {
        result.style.display = 'none';
        apply.style.display  = 'none';
        status.textContent   = 'لم أتعرف على العملية، حاول مجدداً';
      }
    };

    recognition.onerror = (e) => {
      btn.classList.remove('listening');
      status.textContent = e.error === 'no-speech' ? 'لم يُسمع كلام، حاول مجدداً' : 'خطأ: ' + e.error;
    };

    recognition.onend = () => {
      btn.classList.remove('listening');
      // الجلسة الأولى انتهت رسمياً — الآن نبدأ الثانية بأمان
      if (_needsConfirmListen) {
        _needsConfirmListen = false;
        if (parsedData && parsedData.autoConfirm) {
          setTimeout(() => applyResult(), 300);
        } else {
          setTimeout(() => startConfirmListening(), 200);
        }
      }
    };

    recognition.start();
  }

  function stopListening() {
    if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
    if (overlayEl) {
      const btn = overlayEl.querySelector('.vt-mic-btn');
      if (btn) btn.classList.remove('listening');
    }
  }

  // ── الاستماع للتأكيد بعد ظهور النتيجة ──────────────────────────────────────
  let confirmRec          = null;
  let _confirmShouldRetry = false;  // علامة: أعد تشغيل الاستماع من onend فقط
  let _confirmPending     = null;   // 'apply' | 'cancel' | null

  function startConfirmListening() {
    if (!overlayEl || !parsedData) return;
    // إذا كان هناك جلسة سابقة، أوقفها — onend سيُطلَق ويبدأ جلسة جديدة
    if (confirmRec) {
      _confirmShouldRetry = true;
      try { confirmRec.stop(); } catch (_) {}
      return;
    }

    _confirmShouldRetry = false;
    _confirmPending     = null;

    const statusEl = overlayEl.querySelector('.vt-status');
    const micBtn   = overlayEl.querySelector('.vt-mic-btn');
    if (micBtn) micBtn.style.boxShadow = '0 0 0 6px rgba(76,175,80,.35)';

    confirmRec = new SpeechRecognition();
    confirmRec.lang            = 'ar-PS';
    confirmRec.interimResults  = false;
    confirmRec.maxAlternatives = 3;

    confirmRec.onresult = (e) => {
      const allTexts = Array.from(e.results[0])
        .map(r => r.transcript.trim().replace(/[أإآ]/g, 'ا').toLowerCase())
        .join(' ');

      const isConfirm = /تاكيد|اكيد|موافق|صح|صحيح|اوكيه|اوك|نعم|تمام|امضي|تنفيذ/.test(allTexts);
      const isCancel  = /الغاء|لا|وقف|توقف|مسح|رجع/.test(allTexts);

      if (isConfirm) {
        _confirmPending = 'apply';
        if (statusEl) statusEl.textContent = 'تم التأكيد — جاري التنفيذ...';
        // لا نستدعي شيئاً هنا — ننتظر onend
      } else if (isCancel) {
        _confirmPending = 'cancel';
        if (statusEl) statusEl.textContent = 'تم الإلغاء';
      } else {
        // كلام غير معروف — أعد الاستماع عبر onend
        _confirmShouldRetry = true;
        const heard = e.results[0][0].transcript;
        if (statusEl) statusEl.textContent = `لم أفهم "${heard}" — قل "تأكيد" أو "إلغاء"`;
      }
    };

    confirmRec.onerror = (e) => {
      if (e.error === 'no-speech') {
        // صمت — أعد الاستماع عبر onend
        _confirmShouldRetry = true;
        if (statusEl && overlayEl) statusEl.textContent = 'في انتظار تأكيدك... قل "تأكيد" أو "موافق"';
      }
    };

    confirmRec.onend = () => {
      confirmRec = null;  // الجلسة انتهت رسمياً

      if (_confirmPending === 'apply') {
        _confirmPending = null;
        stopConfirmListening();
        setTimeout(() => applyResult(), 150);

      } else if (_confirmPending === 'cancel') {
        _confirmPending = null;
        stopConfirmListening();
        setTimeout(() => closeOverlay(), 500);

      } else if (_confirmShouldRetry && overlayEl && parsedData) {
        // أعد الاستماع — الجلسة انتهت الآن فيمكن البدء بأمان
        setTimeout(() => startConfirmListening(), 250);
      }
    };

    try { confirmRec.start(); } catch (_) {}
  }

  function stopConfirmListening() {
    _confirmShouldRetry = false;
    _confirmPending     = null;
    if (confirmRec) { try { confirmRec.stop(); } catch (_) {} confirmRec = null; }
    if (overlayEl) {
      const micBtn = overlayEl.querySelector('.vt-mic-btn');
      if (micBtn) micBtn.style.boxShadow = '';
    }
  }

  // ── خريطة أسماء العملات بالعربي ─────────────────────────────────────────────
  const CURRENCY_AR = {
    USD:'دولار', ILS:'شيكل', JOD:'دينار', EUR:'يورو', GBP:'جنيه إسترليني',
    TRY:'ليرة تركية', EGP:'جنيه مصري', SAR:'ريال سعودي', AED:'درهم إماراتي',
    KWD:'دينار كويتي', BHD:'دينار بحريني', QAR:'ريال قطري', OMR:'ريال عماني',
    CAD:'دولار كندي', AUD:'دولار أسترالي', CHF:'فرنك سويسري',
  };
  function currencyAr(code) { return CURRENCY_AR[code] || code; }

  // TTS معطّل — دالة فارغة
  function speakArabic(_text) {}
  function _unlockTTS() {}

  // ── محلل الأوامر ──────────────────────────────────────────────────────────────

  // أوامر التنقل بين الأقسام
  const NAV_MAP = [
    { keywords: ['الصرافة','صرافة','قسم الصرف','الصرف'],         target: 'exchange' },
    { keywords: ['الحوالات','حوالات','حوالة دولية','الدولية'],    target: 'international' },
    { keywords: ['السحب','الإيداع','إيداع','ايداع','سحب وإيداع','الكاشديسك'], target: 'cashdesk' },
    { keywords: ['الإلكترونية','إلكترونية','الكترونية','إلكتروني'], target: 'electronic' },
    { keywords: ['الرئيسية','الرئيسي','البداية','الرئيس'],        target: 'main' },
  ];
  const NAV_DEPT_NAMES = {
    exchange:'قسم الصرافة', international:'الحوالات الدولية',
    cashdesk:'السحب والإيداع', electronic:'المعاملات الإلكترونية', main:'القسم الرئيسي',
  };

  function parseNavigation(t) {
    // أمر التنقل فقط إذا لم يوجد مبلغ (وإلا فهو أمر عملية)
    if (extractAmount(t)) return null;
    for (const { keywords, target } of NAV_MAP) {
      if (keywords.some(kw => t.includes(kw))) return { dept: 'nav', target };
    }
    return null;
  }

  function parseCommand(text, dept) {
    let t = text.trim().toLowerCase();

    // ── كشف كلمة تأكيد في نهاية الجملة فقط ──
    // نطبّع: أ/إ/آ → ا لمعالجة اختلاف التعرف الصوتي
    let autoConfirm = false;
    const tNorm = t.replace(/[أإآ]/g, 'ا');
    // نبحث في نهاية الجملة فقط (آخر كلمة أو كلمتين) لتجنب التعارض مع كلمات مثل "تنفيذ" في منتصف الأمر
    const CONFIRM_WORDS = /(?:تاكيد|اكيد|موافق|صحيح|اوكيه|اوك|نعم نفذ|نفذ الان)$/;
    if (CONFIRM_WORDS.test(tNorm.trim())) {
      autoConfirm = true;
      t = tNorm.trim().replace(CONFIRM_WORDS, '').trim();
    }

    // ── أمر الطباعة ──
    const PRINT_WORDS = [
      'اطبع', 'اطبعلي', 'طبعلي', 'طبع', 'طباعة',
      'اطبع الايصال', 'اطبع الإيصال', 'اطبع الفاتورة', 'اطبع الوصل',
      'طبعلي الايصال', 'طبعلي الفاتورة', 'طبعلي الوصل',
      'بدي اطبع', 'بدي طباعة', 'بدي طبع',
      'print', 'print receipt', 'print invoice',
      'فاتورة', 'الفاتوره', 'ايصال', 'وصل',
    ];
    const tNormPrint = t.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    if (PRINT_WORDS.some(w => tNormPrint.includes(w.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')))) return { dept: 'print' };

    // ── أوامر التنقل ──
    const nav = parseNavigation(t);
    if (nav) return nav;

    let result = null;
    if (dept === 'exchange')      result = parseExchange(t);
    else if (dept === 'international') result = parseInternational(t);
    else if (dept === 'cashdesk')      result = parseCashdesk(t);
    else if (dept === 'electronic')    result = parseElectronic(t);

    if (result) result.autoConfirm = autoConfirm;
    return result;
  }

  // أدوات مشتركة
  function extractAmount(t) {
    const words = {
      'واحد':1,'اثنين':2,'ثلاثة':3,'اربعة':4,'خمسة':5,
      'ستة':6,'سبعة':7,'ثمانية':8,'تسعة':9,'عشرة':10,
      'عشرين':20,'ثلاثين':30,'اربعين':40,'خمسين':50,
      'ستين':60,'سبعين':70,'ثمانين':80,'تسعين':90,
      'مية':100,'مئة':100,'مائة':100,'مئتين':200,'مييتين':200,
      'ثلاثمية':300,'اربعمية':400,'خمسمية':500,'ستمية':600,
      'سبعمية':700,'ثمانمية':800,'تسعمية':900,
      'الف':1000,'ألف':1000,'الفين':2000,'ألفين':2000
    };
    for (const [w, v] of Object.entries(words)) { if (t.includes(w)) return v; }
    const m = t.replace(/[٠-٩]/g, d => d.charCodeAt(0) - '٠'.charCodeAt(0)).match(/\d+\.?\d*/);
    return m ? parseFloat(m[0]) : null;
  }

  // قائمة أنماط العملات — من الأكثر تحديداً للأقل
  const CURRENCY_PATTERNS = [
    ['KWD', /دينار كويتي|kwd/],
    ['BHD', /دينار بحريني|bhd/],
    ['JOD', /دينار أردني|دينار اردني|jod|دينار/],
    ['EGP', /جنيه مصري|جنيه مصر|egp/],
    ['GBP', /جنيه إسترليني|جنيه استرليني|إسترليني|استرليني|gbp/],
    ['EGP', /جنيه/],
    ['QAR', /ريال قطري|qar/],
    ['OMR', /ريال عماني|omr/],
    ['SAR', /ريال سعودي|ريال|sar/],
    ['CAD', /دولار كندي|كندي|cad/],
    ['AUD', /دولار أسترالي|دولار استرالي|أسترالي|استرالي|aud/],
    ['USD', /دولار أمريكي|دولار|dollar|usd/],
    ['ILS', /شيكل|شيقل|ils/],
    ['EUR', /يورو|euro|eur/],
    ['TRY', /ليرة تركية|ليرة|try/],
    ['AED', /درهم إماراتي|درهم|aed/],
    ['CHF', /فرنك سويسري|فرنك|chf/],
  ];

  function extractCurrency(t) {
    const s = t.toLowerCase();
    for (const [code, re] of CURRENCY_PATTERNS) {
      if (re.test(s)) return code;
    }
    return 'USD';
  }

  // يجد جميع العملات في النص مرتبة حسب موضع أول ظهور لها
  function findCurrenciesPositioned(t) {
    const s = t.toLowerCase();
    const results   = [];
    const usedStart = new Set();
    for (const [code, re] of CURRENCY_PATTERNS) {
      const m = s.match(re);
      if (m && !usedStart.has(m.index)) {
        results.push({ code, index: m.index });
        for (let i = m.index; i < m.index + m[0].length; i++) usedStart.add(i);
      }
    }
    results.sort((a, b) => a.index - b.index);
    return results;
  }

  function extractName(t, afterWords) {
    for (const kw of afterWords) {
      const i = t.indexOf(kw);
      if (i === -1) continue;
      let rest = t.slice(i + kw.length).trim();
      const stops = ['من','الى','إلى','مبلغ','دولار','شيكل','دينار','يورو','في',' ل '];
      for (const s of stops) { const si = rest.indexOf(s); if (si > 0) rest = rest.slice(0, si); }
      const name = rest.trim().replace(/\s+/g,' ');
      if (name.length > 1) return name;
    }
    return '';
  }

  function extractCountry(t) {
    const countries = ['الأردن','الاردن','فلسطين','مصر','السعودية','تركيا','الإمارات','الامارات',
                       'العراق','لبنان','سوريا','ألمانيا','المغرب','تونس'];
    for (const c of countries) { if (t.includes(c)) return c.replace('الاردن','الأردن').replace('الامارات','الإمارات'); }
    return '';
  }

  // ─ صرافة
  function parseExchange(t) {
    const amount = extractAmount(t);
    if (!amount) return null;
    let mode = 'buy';
    if (/بيع|باع/.test(t)) mode = 'sell';

    let from = null, to = null;

    // ابحث عن فاصل: الى / إلى / لـ? / to — مع أو بدون مسافة بعده
    const sepMatch = t.match(/\s+(الى|إلى|لـ?|to)\s*/);
    if (sepMatch) {
      const before = t.slice(0, sepMatch.index);
      const after  = t.slice(sepMatch.index + sepMatch[0].length);
      from = extractCurrency(before);
      to   = extractCurrency(after);
    } else {
      // بدون فاصل — استخرج العملات حسب ترتيب ظهورها في النص
      const currencies = findCurrenciesPositioned(t);
      if (currencies.length >= 2) { from = currencies[0].code; to = currencies[1].code; }
      else if (currencies.length === 1) { from = currencies[0].code; }
    }

    from = from || 'USD';
    to   = to   || 'ILS';
    if (from === to) to = from === 'USD' ? 'ILS' : 'USD';

    const client = extractName(t, ['لعميل ', 'عميل ', 'باسم ']);
    return { dept: 'exchange', mode, from, to, amount, client };
  }

  // ─ حوالات
  function parseInternational(t) {
    const amount  = extractAmount(t);
    const country = extractCountry(t);
    const sender  = extractName(t, ['من ','المرسل ']);
    const recv    = extractName(t, ['لـ ','الى ','إلى ','المستلم ']);
    return { dept:'international', amount, currency: extractCurrency(t), country, sender, recv };
  }

  // ─ سحب/إيداع
  function parseCashdesk(t) {
    const amount = extractAmount(t);
    let type = 'withdrawal';
    if (/إيداع|ايداع|ودع|اضف/.test(t)) type = 'deposit';
    const client = extractName(t, ['من حساب ','لحساب ','حساب ','من ','لـ ','عميل ']);
    return { dept:'cashdesk', type, amount, currency: extractCurrency(t), client };
  }

  // ─ إلكترونية
  function parseElectronic(t) {
    const amount   = extractAmount(t);
    const client   = extractName(t, ['لعميل ','عميل ','باسم ']);
    let platform = '';
    if (t.includes('paypal') || t.includes('باي بال')) platform = 'PayPal';
    else if (t.includes('usdt') || t.includes('تيثر'))  platform = 'USDT';
    else if (t.includes('wise'))                         platform = 'Wise';
    else if (t.includes('western'))                      platform = 'Western Union';
    return { dept:'electronic', amount, currency: extractCurrency(t), client, platform };
  }

  // ── تنسيق النتيجة ────────────────────────────────────────────────────────────

  function formatResult(d) {
    const rows = [];
    const row  = (k, v) => v ? `<div><b>${k}:</b> ${v}</div>` : '';
    if (d.dept === 'exchange') {
      rows.push(row('النوع',   d.mode === 'buy' ? 'شراء' : 'بيع'));
      rows.push(row('المبلغ',  d.amount + ' ' + currencyAr(d.from)));
      rows.push(row('الى',     currencyAr(d.to)));
      rows.push(row('العميل',  d.client));
    } else if (d.dept === 'international') {
      rows.push(row('المبلغ',   d.amount + ' ' + currencyAr(d.currency)));
      rows.push(row('الوجهة',   d.country));
      rows.push(row('المرسل',   d.sender));
      rows.push(row('المستلم',  d.recv));
    } else if (d.dept === 'cashdesk') {
      rows.push(row('النوع',   d.type === 'withdrawal' ? 'سحب' : 'إيداع'));
      rows.push(row('المبلغ',  d.amount + ' ' + currencyAr(d.currency)));
      rows.push(row('العميل',  d.client));
    } else if (d.dept === 'electronic') {
      rows.push(row('المبلغ',    d.amount + ' ' + currencyAr(d.currency)));
      rows.push(row('المنصة',    d.platform));
      rows.push(row('العميل',    d.client));
    } else if (d.dept === 'print') {
      rows.push(`<div style="text-align:center;color:#34d399;font-weight:700">طباعة إيصال آخر عملية صرافة</div>`);
    }
    if (d.autoConfirm) {
      rows.push(`<div style="margin-top:8px;padding:6px 10px;background:rgba(255,160,0,.15);border-radius:8px;color:#FFB300;font-size:12px;font-weight:700">تأكيد تلقائي مُفعَّل</div>`);
    }
    return rows.join('');
  }

  // ── تطبيق النتيجة على الحقول ─────────────────────────────────────────────────

  // فحص الجلسة قبل التنفيذ التلقائي
  function _voiceAutoSubmit(submitFn, confirmMsg) {
    if (typeof _sessionIsOpen === 'function' && !_sessionIsOpen()) {
      showToast('افتح الصندوق أولاً لتفعيل التنفيذ التلقائي');
      speakArabic('يجب فتح الصندوق أولاً');
      return;
    }
    submitFn();
    setTimeout(() => {
      if (typeof confirmAction === 'function') confirmAction();
      speakArabic(confirmMsg);
    }, 350);
  }

  function applyResult() {
    if (!parsedData) return;
    const d = parsedData;
    const FILL_DELAY   = 350;  // انتظار انيميشن تبديل القسم
    const SUBMIT_DELAY = 600;  // بعد ملء الحقول

    if (d.dept === 'exchange') {
      if (typeof switchDept === 'function') switchDept('exchange');
      setTimeout(() => {
        const fromInput = document.getElementById('exFrom');
        const fromCur   = document.getElementById('exFromCur');
        const toCur     = document.getElementById('exToCur');
        if (fromCur)   { fromCur.value = d.from; fromCur.dispatchEvent(new Event('change')); }
        if (toCur)     { toCur.value = d.to;     toCur.dispatchEvent(new Event('change')); }
        if (fromInput) { fromInput.value = d.amount; fromInput.dispatchEvent(new Event('input')); }
        if (d.client) {
          const toggle = document.getElementById('exClientToggle');
          const fields = document.getElementById('exClientFields');
          if (fields && fields.style.display === 'none') toggle && toggle.click();
          const clientEl = document.getElementById('exClient');
          if (clientEl) clientEl.value = d.client;
        }
        if (d.autoConfirm) {
          setTimeout(() => {
            const toAmt = document.getElementById('exTo')?.textContent || '';
            _voiceAutoSubmit(
              () => { if (typeof submitExchange === 'function') submitExchange(); },
              `تم تنفيذ صرف ${d.amount} ${currencyAr(d.from)} يساوي ${toAmt} ${currencyAr(d.to)}`
            );
          }, SUBMIT_DELAY);
        }
      }, FILL_DELAY);

    } else if (d.dept === 'international') {
      if (typeof switchDept === 'function') switchDept('international');
      setTimeout(() => {
        const amt     = document.getElementById('itAmount');
        const cur     = document.getElementById('itCurrency');
        const sender  = document.getElementById('itSenderName');
        const country = document.getElementById('itRecvCountry');
        if (cur && d.currency)  { cur.value = d.currency; cur.dispatchEvent(new Event('change')); }
        if (amt)    { amt.value = d.amount; amt.dispatchEvent(new Event('input')); }
        if (sender && d.sender) sender.value = d.sender;
        if (country && d.country) {
          const opt = Array.from(country.options).find(o => o.text.includes(d.country) || d.country.includes(o.text));
          if (opt) { country.value = opt.value; country.dispatchEvent(new Event('change')); }
        }
        if (d.autoConfirm) {
          setTimeout(() => {
            _voiceAutoSubmit(
              () => { if (typeof submitIntlSend === 'function') submitIntlSend(); },
              `تم إرسال حوالة ${d.amount} ${currencyAr(d.currency)} إلى ${d.country || ''}`
            );
          }, SUBMIT_DELAY);
        }
      }, FILL_DELAY);

    } else if (d.dept === 'cashdesk') {
      if (typeof switchDept === 'function') switchDept('cashdesk');
      setTimeout(() => {
        const wBtn = document.querySelector('[onclick*="setCdMode"][onclick*="withdraw"], [data-cd="withdraw"]');
        const dBtn = document.querySelector('[onclick*="setCdMode"][onclick*="deposit"],  [data-cd="deposit"]');
        if (d.type === 'withdrawal' && wBtn) wBtn.click();
        if (d.type === 'deposit'    && dBtn) dBtn.click();
        const amt    = document.getElementById('cd2Amount') || document.getElementById('cdAmount');
        const client = document.getElementById('cd2Client') || document.getElementById('cdClient');
        if (amt)    { amt.value = d.amount; amt.dispatchEvent(new Event('input')); }
        if (client && d.client) client.value = d.client;
        if (d.autoConfirm) {
          setTimeout(() => {
            const opType = d.type === 'withdrawal' ? 'سحب' : 'إيداع';
            _voiceAutoSubmit(
              () => { if (typeof submitCd2 === 'function') submitCd2(); },
              `تم تنفيذ ${opType} ${d.amount} ${currencyAr(d.currency)}`
            );
          }, SUBMIT_DELAY);
        }
      }, FILL_DELAY);

    } else if (d.dept === 'electronic') {
      if (typeof switchDept === 'function') switchDept('electronic');
      setTimeout(() => {
        const amt    = document.getElementById('elAmount');
        const client = document.getElementById('elClient');
        if (amt)    { amt.value = d.amount; amt.dispatchEvent(new Event('input')); }
        if (client && d.client) client.value = d.client;
        if (d.autoConfirm) {
          setTimeout(() => {
            _voiceAutoSubmit(
              () => { if (typeof submitElec === 'function') submitElec(); },
              `تم تنفيذ معاملة إلكترونية ${d.amount} ${currencyAr(d.currency)}`
            );
          }, SUBMIT_DELAY);
        }
      }, FILL_DELAY);

    } else if (d.dept === 'print') {
      closeOverlay();
      speakArabic('جاري طباعة الإيصال');
      showToast('جاري طباعة الإيصال...', 'info');
      setTimeout(() => {
        if (typeof printExchangeReceipt === 'function') {
          printExchangeReceipt();
        } else {
          showToast('لا توجد عملية صرافة لطباعتها', 'warning');
          speakArabic('لا توجد عملية صرافة لطباعتها');
        }
      }, 300);
      return;
    }

    closeOverlay();
    showToast(d.autoConfirm ? 'جاري التنفيذ التلقائي...' : 'تم ملء الحقول — راجعها وأكد التنفيذ');
  }

  // ── إشعار مؤقت ───────────────────────────────────────────────────────────────

  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed', bottom:'80px', left:'50%', transform:'translateX(-50%)',
      background:'linear-gradient(135deg,#32b8c6,#1a8a95)', color:'#fff',
      padding:'10px 20px', borderRadius:'20px', fontSize:'13px', fontWeight:'700',
      zIndex:'9999', boxShadow:'0 4px 20px rgba(50,184,198,.4)',
      transition:'opacity .4s', fontFamily:'Tajawal,sans-serif',
    });
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
  }

  // ── استقبال العمليات من الهاتف (polling) ────────────────────────────────────

  function startPolling() {
    setInterval(async () => {
      try {
        const res  = await fetch('/api/pending-operation');
        const data = await res.json();
        if (!data.success || !data.pending) return;
        handleIncomingOperation(data);
      } catch (_) {}
    }, 3000);
  }

  function handleIncomingOperation(data) {
    const type  = data.type;
    const DELAY = 350; // انتظر انتهاء انيميشن تبديل القسم

    if (type === 'exchange') {
      if (typeof switchDept === 'function') switchDept('exchange');
      setTimeout(() => {
        const fromCur = document.getElementById('exFromCur');
        const toCur   = document.getElementById('exToCur');
        const fromAmt = document.getElementById('exFrom');
        // 1) اختر العملات أولاً
        if (fromCur && data.from) { setSelectValue(fromCur, data.from); fromCur.dispatchEvent(new Event('change')); }
        if (toCur   && data.to)   { setSelectValue(toCur,   data.to);   toCur.dispatchEvent(new Event('change')); }
        // 2) ثم ضع المبلغ واحسب
        if (fromAmt && data.amount != null) {
          fromAmt.value = data.amount;
          fromAmt.dispatchEvent(new Event('input'));
          // استدعاء دالة الحساب مباشرة إن وُجدت
          if (typeof calcExchange === 'function') calcExchange();
        }
        // 3) اسم العميل
        if (data.client) {
          const fields = document.getElementById('exClientFields');
          const toggle = document.getElementById('exClientToggle');
          if (fields && fields.style.display === 'none') toggle && toggle.click();
          const clientEl = document.getElementById('exClient');
          if (clientEl) clientEl.value = data.client;
        }
      }, DELAY);

    } else if (type === 'hawala') {
      if (typeof switchDept === 'function') switchDept('international');
      setTimeout(() => {
        const amt     = document.getElementById('itAmount');
        const cur     = document.getElementById('itCurrency');
        const sender  = document.getElementById('itSenderName');
        const country = document.getElementById('itRecvCountry');
        if (cur && data.currency)  { setSelectValue(cur, data.currency); cur.dispatchEvent(new Event('change')); }
        if (amt && data.amount != null) { amt.value = data.amount; amt.dispatchEvent(new Event('input')); if (typeof calcIntlFee === 'function') calcIntlFee(); }
        if (sender && data.sender) sender.value = data.sender;
        if (country && data.destination) {
          const opt = Array.from(country.options).find(o =>
            o.text.includes(data.destination) || data.destination.includes(o.text.trim()));
          if (opt) { country.value = opt.value; country.dispatchEvent(new Event('change')); }
        }
      }, DELAY);

    } else if (type === 'withdrawal' || type === 'deposit') {
      if (typeof switchDept === 'function') switchDept('cashdesk');
      setTimeout(() => {
        // محاولة النقر على زر نوع العملية
        document.querySelectorAll('[onclick]').forEach(el => {
          const fn = el.getAttribute('onclick') || '';
          if (type === 'withdrawal' && (fn.includes('withdraw') || fn.includes('سحب'))) el.click();
          if (type === 'deposit'    && (fn.includes('deposit')  || fn.includes('إيداع') || fn.includes('ايداع'))) el.click();
        });
        const amt    = document.getElementById('cd2Amount') || document.getElementById('cdAmount');
        const client = document.getElementById('cd2Client') || document.getElementById('cdClient');
        const cur    = document.getElementById('cd2Currency') || document.getElementById('cdCurrency');
        if (cur && data.currency)  { setSelectValue(cur, data.currency); }
        if (amt && data.amount != null) { amt.value = data.amount; amt.dispatchEvent(new Event('input')); }
        if (client && data.client) client.value = data.client;
      }, DELAY);
    }

    showPhoneNotification(data.operator || 'التلر', data.label || '', type);
  }

  function setSelectValue(sel, val) {
    const opt = Array.from(sel.options).find(o => o.value === val);
    if (opt) sel.value = val;
  }

  function showPhoneNotification(operator, label, type) {
    const icons = { exchange:'💱', hawala:'🌍', withdrawal:'⬆️', deposit:'⬇️' };
    const colors = { exchange:'#1565C0', hawala:'#6A1B9A', withdrawal:'#B71C1C', deposit:'#1B5E20' };
    const icon  = icons[type]  || '📱';
    const color = colors[type] || '#32b8c6';

    const notif = document.createElement('div');
    notif.dir = 'rtl';
    notif.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">${icon}</span>
        <div>
          <div style="font-weight:800;font-size:13px;margin-bottom:2px">من هاتف ${operator}</div>
          <div style="font-size:12px;opacity:.85">${label}</div>
        </div>
      </div>`;
    Object.assign(notif.style, {
      position:'fixed', top:'80px', left:'50%', transform:'translateX(-50%)',
      background:`linear-gradient(135deg,${color}dd,${color}99)`,
      border:`1px solid ${color}`,
      color:'#fff', padding:'14px 20px', borderRadius:'14px',
      fontSize:'13px', fontFamily:'Tajawal,sans-serif',
      zIndex:'9999', boxShadow:`0 8px 28px ${color}55`,
      minWidth:'280px', transition:'opacity .5s',
    });
    document.body.appendChild(notif);
    setTimeout(() => { notif.style.opacity = '0'; setTimeout(() => notif.remove(), 500); }, 5000);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // الشريط الصوتي المدمج (inline) — بدون overlay
  // ══════════════════════════════════════════════════════════════════════════════

  const _inlineRec = {};   // dept → SpeechRecognition instance
  const _inlineData = {};  // dept → parsedData

  const _inlineColors = {
    international: '#a78bfa',
    electronic:    '#3b82f6',
    cashdesk:      '#22c55e',
  };

  // بدء الاستماع من الشريط المدمج
  function vtInlineStart(dept) {
    if (!SpeechRecognition) {
      _vtInlineSetLabel(dept, 'المتصفح لا يدعم الصوت');
      return;
    }
    // إذا كان يستمع بالفعل — أوقف
    if (_inlineRec[dept]) {
      try { _inlineRec[dept].stop(); } catch (_) {}
      return;
    }

    const bar    = document.getElementById('vbBar-' + dept);
    const micBtn = document.getElementById('vbMic-' + dept);
    const resultBar = document.getElementById('vbResult-' + dept);

    if (bar)    bar.classList.add('vb-listening');
    if (micBtn) micBtn.classList.add('vb-listening');
    if (resultBar) resultBar.style.display = 'none';

    _vtInlineSetLabel(dept, 'جاري الاستماع...');
    _vtInlineHideSpoken(dept);
    _inlineData[dept] = null;

    const rec = new SpeechRecognition();
    rec.lang            = 'ar-PS';
    rec.interimResults  = false;
    rec.maxAlternatives = 1;
    _inlineRec[dept] = rec;

    rec.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      _vtInlineShowSpoken(dept, text);
      _vtInlineSetLabel(dept, 'جاري التحليل...');

      const parsed = parseCommand(text, dept);
      _inlineData[dept] = parsed;

      if (parsed && parsed.dept === dept) {
        _vtInlineShowResult(dept, parsed);
        _vtInlineSetLabel(dept, 'تم — راجع النتيجة وطبّق');
        if (parsed.autoConfirm) {
          setTimeout(() => vtInlineApply(dept), 400);
        }
      } else if (parsed && parsed.dept === 'nav') {
        if (typeof switchDept === 'function') switchDept(parsed.target);
        _vtInlineSetLabel(dept, 'انتقلت إلى قسم آخر');
      } else {
        _vtInlineSetLabel(dept, 'لم أتعرف على الأمر — حاول مجدداً');
      }
    };

    rec.onerror = (e) => {
      _vtInlineSetLabel(dept, e.error === 'no-speech' ? 'لم يُسمع كلام' : 'خطأ: ' + e.error);
    };

    rec.onend = () => {
      _inlineRec[dept] = null;
      const b = document.getElementById('vbBar-' + dept);
      const m = document.getElementById('vbMic-' + dept);
      if (b) b.classList.remove('vb-listening');
      if (m) m.classList.remove('vb-listening');
      // إذا لم تظهر نتيجة — أعد الـ label للحالة الافتراضية بعد 3 ثوانٍ
      if (!_inlineData[dept]) {
        setTimeout(() => _vtInlineResetLabel(dept), 3000);
      }
    };

    try { rec.start(); } catch (_) {
      _vtInlineSetLabel(dept, 'تعذر تشغيل الميكروفون');
    }
  }

  // تطبيق النتيجة من الشريط المدمج على حقول القسم
  function vtInlineApply(dept) {
    const d = _inlineData[dept];
    if (!d) return;

    if (dept === 'international') {
      const amt     = document.getElementById('itAmount');
      const cur     = document.getElementById('itCurrency');
      const sender  = document.getElementById('itSenderName');
      const country = document.getElementById('itRecvCountry');
      if (cur && d.currency) { cur.value = d.currency; cur.dispatchEvent(new Event('change')); }
      if (amt && d.amount)   { amt.value = d.amount;   amt.dispatchEvent(new Event('input')); }
      if (sender && d.sender)  sender.value = d.sender;
      if (country && d.country) {
        const opt = Array.from(country.options).find(o => o.text.includes(d.country) || d.country.includes(o.text.trim()));
        if (opt) { country.value = opt.value; country.dispatchEvent(new Event('change')); }
      }
      if (d.autoConfirm && typeof submitIntlSend === 'function') {
        setTimeout(() => _voiceAutoSubmit(() => submitIntlSend(), 'تم إرسال الحوالة'), 500);
      }
    } else if (dept === 'electronic') {
      const amt    = document.getElementById('elAmount');
      const client = document.getElementById('elClient');
      const cur    = document.getElementById('elCurrency');
      if (amt && d.amount)    { amt.value = d.amount; amt.dispatchEvent(new Event('input')); }
      if (client && d.client)   client.value = d.client;
      if (cur && d.currency)  { cur.value = d.currency; cur.dispatchEvent(new Event('change')); }
      if (d.platform) {
        if (typeof selectPlatform === 'function') selectPlatform(d.platform);
      }
      if (d.autoConfirm && typeof submitElec === 'function') {
        setTimeout(() => _voiceAutoSubmit(() => submitElec(), 'تم تنفيذ المعاملة الإلكترونية'), 500);
      }
    } else if (dept === 'cashdesk') {
      if (d.type === 'withdrawal') {
        const wBtn = document.getElementById('cd2ModeWithdraw');
        if (wBtn) wBtn.click();
      } else {
        const dBtn = document.getElementById('cd2ModeDeposit');
        if (dBtn) dBtn.click();
      }
      const amt    = document.getElementById('cd2Amount');
      const client = document.getElementById('cd2Client');
      if (amt && d.amount)   { amt.value = d.amount; amt.dispatchEvent(new Event('input')); }
      if (client && d.client)  client.value = d.client;
      if (d.autoConfirm && typeof submitCd2 === 'function') {
        setTimeout(() => _voiceAutoSubmit(() => submitCd2(), 'تم التنفيذ'), 500);
      }
    }

    _vtInlineResetLabel(dept);
    document.getElementById('vbResult-' + dept).style.display = 'none';
    _inlineData[dept] = null;
    showToast('تم ملء الحقول — راجع وأكد التنفيذ');
  }

  // مسح نتيجة الشريط المدمج
  function vtInlineClear(dept) {
    _inlineData[dept] = null;
    const rb = document.getElementById('vbResult-' + dept);
    if (rb) rb.style.display = 'none';
    _vtInlineResetLabel(dept);
  }

  // تبديل وضع اليدوي (يُخفي/يُظهر hint)
  function vtToggleManual(dept) {
    const btn  = document.querySelector(`#vbBar-${dept} .vb-toggle-btn`);
    const hint = document.getElementById('vbHint-' + dept);
    if (!btn) return;
    const isManual = btn.classList.toggle('vb-manual-active');
    if (hint) hint.textContent = isManual ? 'وضع الكتابة اليدوية — الحقول أدناه قابلة للتعديل' : _vtDefaultHint(dept);
  }

  function _vtDefaultHint(dept) {
    const hints = {
      international: 'مثال: "حوالة 500 دولار إلى تركيا من أحمد"',
      electronic:    'مثال: "تحويل 200 دولار PayPal لعميل سالم"',
      cashdesk:      'مثال: "سحب 300 دولار من حساب خالد"',
    };
    return hints[dept] || '';
  }

  function _vtInlineSetLabel(dept, text) {
    const el = document.getElementById('vbLabel-' + dept);
    if (el) el.textContent = text;
  }

  function _vtInlineResetLabel(dept) {
    _vtInlineSetLabel(dept, 'اضغط وتحدث');
  }

  function _vtInlineShowSpoken(dept, text) {
    const wrap = document.getElementById('vbSpokenWrap-' + dept);
    const span = document.getElementById('vbSpokenText-' + dept);
    if (wrap && span) { span.textContent = text; wrap.style.display = 'block'; }
  }

  function _vtInlineHideSpoken(dept) {
    const wrap = document.getElementById('vbSpokenWrap-' + dept);
    if (wrap) wrap.style.display = 'none';
  }

  function _vtInlineShowResult(dept, d) {
    const rb     = document.getElementById('vbResult-' + dept);
    const fields = document.getElementById('vbResultFields-' + dept);
    if (!rb || !fields) return;

    const chips = [];
    const chip = (label, val, color) =>
      val ? `<div class="vb-result-field"><span class="vb-rf-label">${label}</span><span class="vb-rf-val" style="color:${color||'#34d399'}">${val}</span></div>` : '';

    if (dept === 'international') {
      chips.push(chip('المبلغ',  d.amount ? d.amount + ' ' + (d.currency||'USD') : null, '#fcd34d'));
      chips.push(chip('الوجهة', d.country, '#60a5fa'));
      chips.push(chip('المرسل', d.sender,  '#a78bfa'));
      chips.push(chip('المستلم', d.recv,   '#34d399'));
    } else if (dept === 'electronic') {
      chips.push(chip('المبلغ',   d.amount ? d.amount + ' ' + (d.currency||'USD') : null, '#fcd34d'));
      chips.push(chip('المنصة',  d.platform, '#60a5fa'));
      chips.push(chip('العميل',  d.client,   '#a78bfa'));
    } else if (dept === 'cashdesk') {
      chips.push(chip('النوع',   d.type === 'deposit' ? 'إيداع' : 'سحب', d.type === 'deposit' ? '#34d399' : '#f87171'));
      chips.push(chip('المبلغ',  d.amount ? d.amount + ' ' + (d.currency||'USD') : null, '#fcd34d'));
      chips.push(chip('العميل',  d.client, '#a78bfa'));
    }

    if (d.autoConfirm) chips.push(chip('', 'تأكيد تلقائي', '#FFB300'));

    fields.innerHTML = chips.join('');
    rb.style.display = 'flex';
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // استقبال عمليات الهاتف عبر WebSocket (بدلاً من polling)
  // ══════════════════════════════════════════════════════════════════════════════

  function startWsListener() {
    // ws-notifications.js يُطلق CustomEvent 'ws:voice_result' عند كل رسالة من النوع voice_result
    window.addEventListener('ws:voice_result', (e) => {
      const data = e.detail || {};
      handleIncomingOperation(data);
    });
  }

  // ── تشغيل ────────────────────────────────────────────────────────────────────

  // كشف globals للاستخدام الخارجي (من HTML onclick)
  window.vtInlineStart  = vtInlineStart;
  window.vtInlineApply  = vtInlineApply;
  window.vtInlineClear  = vtInlineClear;
  window.vtToggleManual = vtToggleManual;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { buildUI(); startPolling(); startWsListener(); });
  } else {
    buildUI();
    startPolling();
    startWsListener();
  }

})();
