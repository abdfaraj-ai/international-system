/**
 * Visual Editor v3 — المحرر البصري
 * إصلاح جذري للمشاكل المعمارية:
 * ✓ لا capture div → التمرير يعمل بشكل طبيعي
 * ✓ اكتشاف العناصر عبر document events → لا حلقة مفرغة
 * ✓ الشريط الجانبي على اليمين (RTL)
 * ✓ تراجع / تقدم كامل
 * ✓ سحب لتحريك العناصر
 * ✓ مقابض تغيير الحجم
 */
(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════════════
     EDITOR UI DETECTION — نتجاهل عناصر المحرر ذاتها
  ═══════════════════════════════════════════════════ */
  function isEditorEl(el) {
    var cur = el;
    while (cur && cur !== document.body) {
      var id  = cur.id   || '';
      var cls = (typeof cur.className === 'string') ? cur.className : '';
      if (id.startsWith('ve-') || cls.indexOf('ve-') !== -1) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  /* ═══════════════════════════════════════════════════
     CSS
  ═══════════════════════════════════════════════════ */
  var CSS = `
  /* ── Banner ── */
  .ve-banner{position:fixed;top:0;left:0;right:0;height:52px;
    background:linear-gradient(90deg,#0d0d1a,#111127,#0f1535);
    border-bottom:2px solid #e94560;display:flex;align-items:center;
    padding:0 16px;z-index:99999;font-family:'Segoe UI',Tahoma,sans-serif;
    direction:rtl;gap:10px;box-shadow:0 4px 24px rgba(0,0,0,.5)}
  .ve-banner-brand{display:flex;align-items:center;gap:8px;flex-shrink:0}
  .ve-banner-icon{width:30px;height:30px;background:linear-gradient(135deg,#e94560,#a01535);
    border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:15px}
  .ve-banner-label{color:#fff;font-size:13px;font-weight:700}
  .ve-banner-page{color:#32b8c6;font-size:11px;background:rgba(50,184,198,.12);
    border:1px solid rgba(50,184,198,.25);border-radius:10px;padding:2px 9px}
  .ve-tools{display:flex;gap:3px;background:rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:3px}
  .ve-tool{width:32px;height:26px;border-radius:5px;border:none;background:transparent;
    color:#aaa;cursor:pointer;font-size:13px;transition:all .15s;position:relative;
    display:flex;align-items:center;justify-content:center}
  .ve-tool:hover{background:rgba(255,255,255,.1);color:#fff}
  .ve-tool.active{background:linear-gradient(135deg,#e94560,#c62a47);color:#fff}
  .ve-tool-tip{position:absolute;bottom:-26px;left:50%;transform:translateX(-50%);
    background:#1a1a2e;color:#fff;font-size:10px;white-space:nowrap;padding:2px 7px;
    border-radius:4px;pointer-events:none;opacity:0;transition:opacity .12s;z-index:1}
  .ve-tool:hover .ve-tool-tip{opacity:1}
  .ve-banner-actions{display:flex;align-items:center;gap:5px;flex-shrink:0;margin-right:auto}
  .ve-hbtn{width:28px;height:26px;border-radius:5px;border:1px solid rgba(255,255,255,.1);
    background:rgba(255,255,255,.06);color:#aaa;cursor:pointer;font-size:12px;
    display:flex;align-items:center;justify-content:center;transition:all .15s}
  .ve-hbtn:hover:not(:disabled){background:rgba(255,255,255,.14);color:#fff}
  .ve-hbtn:disabled{opacity:.3;cursor:default}
  .ve-changes-pill{background:rgba(50,184,198,.12);color:#32b8c6;
    border:1px solid rgba(50,184,198,.3);border-radius:12px;font-size:11px;
    padding:3px 10px;font-weight:700;min-width:60px;text-align:center}
  .ve-btn{padding:6px 13px;border-radius:7px;border:none;cursor:pointer;
    font-size:12px;font-family:inherit;font-weight:700;transition:all .18s}
  .ve-btn-submit{background:linear-gradient(135deg,#e94560,#c62a47);color:#fff;
    box-shadow:0 2px 10px rgba(233,69,96,.35)}
  .ve-btn-submit:hover{transform:translateY(-1px);box-shadow:0 4px 18px rgba(233,69,96,.55)}
  .ve-btn-close{background:rgba(255,255,255,.07);color:#999;
    border:1px solid rgba(255,255,255,.1)}
  .ve-btn-close:hover{background:rgba(220,50,50,.2);color:#ff6b6b}
  /* ── Mode cursor ── */
  body.ve-mode-move *{cursor:move!important}
  body.ve-mode-move .ve-sidebar,body.ve-mode-move .ve-banner,
  body.ve-mode-move .ve-handle,body.ve-mode-move .ve-qtb{cursor:default!important}
  /* ── Hover / Selection Boxes ── */
  .ve-hover-box{position:fixed;pointer-events:none;z-index:99990;
    border:2px dashed rgba(50,184,198,.75);background:rgba(50,184,198,.05);
    border-radius:3px;transition:top .05s,left .05s,width .05s,height .05s}
  .ve-selected-box{position:fixed;pointer-events:none;z-index:99991;
    border:2px solid #e94560;background:rgba(233,69,96,.06);
    box-shadow:0 0 0 4px rgba(233,69,96,.12);border-radius:3px}
  /* ── Resize Handles ── */
  .ve-handle{position:fixed;z-index:99992;width:10px;height:10px;
    background:#e94560;border:2px solid #fff;border-radius:2px;
    box-shadow:0 1px 5px rgba(0,0,0,.5);cursor:nwse-resize}
  .ve-handle[data-d="n"],.ve-handle[data-d="s"]{cursor:ns-resize}
  .ve-handle[data-d="e"],.ve-handle[data-d="w"]{cursor:ew-resize}
  .ve-handle[data-d="ne"],.ve-handle[data-d="sw"]{cursor:nesw-resize}
  .ve-handle:hover{background:#fff;border-color:#e94560;transform:scale(1.35)}
  /* ── Quick Toolbar ── */
  .ve-qtb{position:fixed;z-index:99993;background:#0e0e1a;
    border:1px solid #2a2a4a;border-radius:8px;display:none;
    align-items:center;gap:1px;padding:3px;
    box-shadow:0 4px 20px rgba(0,0,0,.6)}
  .ve-qtb-btn{width:28px;height:26px;border-radius:5px;border:none;
    background:transparent;color:#aaa;cursor:pointer;font-size:13px;
    display:flex;align-items:center;justify-content:center;transition:all .15s;
    position:relative}
  .ve-qtb-btn:hover{background:rgba(255,255,255,.1);color:#fff}
  .ve-qtb-sep{width:1px;height:16px;background:#2a2a4a;margin:0 2px}
  .ve-qtb-btn .ve-tool-tip{bottom:-24px}
  /* ── Sidebar — يمين الشاشة ── */
  .ve-sidebar{position:fixed;top:52px;right:0;width:300px;
    height:calc(100vh - 52px);background:#0a0a14;
    border-left:2px solid #151530;z-index:99994;overflow-y:auto;
    font-family:'Segoe UI',Tahoma,sans-serif;direction:rtl;
    transform:translateX(310px);transition:transform .25s cubic-bezier(.4,0,.2,1);
    display:flex;flex-direction:column}
  .ve-sidebar.ve-open{transform:translateX(0)}
  .ve-sidebar::-webkit-scrollbar{width:3px}
  .ve-sidebar::-webkit-scrollbar-thumb{background:#1e1e3a;border-radius:3px}
  /* Sidebar open = margin on right side */
  body.ve-sb-open{margin-right:300px;transition:margin-right .25s}
  /* ── Sidebar Header ── */
  .ve-sh{padding:12px 14px 10px;background:#070710;
    border-bottom:1px solid #151530;flex-shrink:0}
  .ve-sh h4{margin:0;color:#32b8c6;font-size:13px;font-weight:700}
  .ve-el-path{color:#555;font-size:10px;margin-top:3px;
    word-break:break-all;font-family:monospace;line-height:1.4}
  .ve-el-breadcrumb{display:flex;flex-wrap:wrap;gap:3px;margin-top:6px}
  .ve-bread-btn{background:#111128;border:1px solid #1e1e3a;color:#888;
    font-size:10px;padding:2px 7px;border-radius:10px;cursor:pointer;transition:all .15s;
    font-family:inherit}
  .ve-bread-btn:hover{border-color:#32b8c6;color:#32b8c6}
  .ve-bread-btn.current{background:rgba(50,184,198,.1);
    border-color:rgba(50,184,198,.35);color:#32b8c6}
  /* ── Sections ── */
  .ve-sec{border-bottom:1px solid #111128}
  .ve-sec-hd{padding:9px 14px;display:flex;align-items:center;
    justify-content:space-between;cursor:pointer;user-select:none;
    background:#0c0c1a;transition:background .15s}
  .ve-sec-hd:hover{background:#101024}
  .ve-sec-title{color:#aaa;font-size:11px;font-weight:700;
    letter-spacing:.7px;display:flex;align-items:center;gap:5px}
  .ve-sec-title::before{content:'';width:3px;height:10px;
    background:#e94560;border-radius:2px}
  .ve-sec-arrow{color:#555;font-size:10px;transition:transform .2s}
  .ve-sec-body{padding:10px 12px;display:none}
  .ve-sec-body.open{display:block}
  /* ── Fields ── */
  .ve-row{display:flex;gap:6px;margin-bottom:8px;align-items:center}
  .ve-row label{color:#888;font-size:11px;min-width:52px;flex-shrink:0}
  .ve-inp{flex:1;background:#111128;border:1px solid #1e2040;color:#e0e0e0;
    border-radius:6px;padding:5px 8px;font-size:12px;font-family:inherit;
    outline:none;direction:ltr;transition:border-color .15s}
  .ve-inp:focus{border-color:#32b8c6}
  .ve-inp-sm{width:60px;flex:none}
  .ve-textarea{width:100%;box-sizing:border-box;background:#111128;
    border:1px solid #1e2040;color:#e0e0e0;border-radius:6px;padding:6px 8px;
    font-size:12px;font-family:inherit;outline:none;direction:rtl;
    resize:vertical;min-height:56px;transition:border-color .15s}
  .ve-textarea:focus{border-color:#32b8c6}
  .ve-sel{flex:1;background:#111128;border:1px solid #1e2040;color:#e0e0e0;
    border-radius:6px;padding:5px 8px;font-size:12px;font-family:inherit;
    outline:none;direction:rtl;cursor:pointer}
  .ve-sel option{background:#111128}
  input[type=range].ve-range{flex:1;accent-color:#32b8c6;cursor:pointer}
  .ve-range-val{color:#32b8c6;font-size:11px;width:34px;text-align:center;
    flex-shrink:0;font-weight:700}
  /* ── Color Row ── */
  .ve-clr-row{display:flex;align-items:center;gap:6px;margin-bottom:8px}
  .ve-clr-row label{color:#888;font-size:11px;min-width:52px;flex-shrink:0}
  .ve-cpick{width:34px;height:28px;border:1px solid #1e2040;border-radius:6px;
    background:#111128;cursor:pointer;padding:2px;flex-shrink:0}
  .ve-cpick-txt{flex:1;background:#111128;border:1px solid #1e2040;color:#e0e0e0;
    border-radius:6px;padding:5px 8px;font-size:11px;font-family:monospace;
    outline:none;direction:ltr;transition:border-color .15s}
  .ve-cpick-txt:focus{border-color:#32b8c6}
  /* ── Box Model ── */
  .ve-bm{background:#0c0c1c;border:1px solid #1e2040;border-radius:8px;
    padding:8px;margin-bottom:8px}
  .ve-bm-lbl{text-align:center;font-size:9px;color:#555;letter-spacing:.5px;margin-bottom:3px}
  .ve-bm-margin{border:2px dashed #2a3a4a;border-radius:6px;padding:5px}
  .ve-bm-padding{border:2px solid #1e3a2a;border-radius:5px;padding:5px;
    background:#0a1410;margin-top:2px}
  .ve-bm-el{background:#1a2a1a;border:1px solid #2a4a2a;border-radius:4px;
    padding:6px;text-align:center;font-size:10px;color:#32b8c6;font-weight:700}
  .ve-bm-top,.ve-bm-bottom{display:flex;justify-content:center}
  .ve-bm-mid{display:flex;align-items:center;gap:4px}
  .ve-bm-inp{width:34px;background:#111128;border:1px solid #1e2040;color:#e0e0e0;
    border-radius:4px;padding:2px 4px;font-size:11px;text-align:center;
    font-family:inherit;outline:none;direction:ltr}
  .ve-bm-inp:focus{border-color:#32b8c6}
  /* ── Apply Button ── */
  .ve-apply{width:100%;padding:7px;background:linear-gradient(135deg,#1a2f50,#0f2a4a);
    color:#32b8c6;border:1px solid rgba(50,184,198,.25);border-radius:7px;
    cursor:pointer;font-size:12px;font-family:inherit;font-weight:700;
    margin-top:2px;transition:all .18s}
  .ve-apply:hover{background:linear-gradient(135deg,#223a64,#1a3a60);
    box-shadow:0 2px 10px rgba(50,184,198,.2)}
  /* ── Align ── */
  .ve-align-row{display:flex;gap:3px;margin-bottom:8px}
  .ve-align-btn{flex:1;padding:5px 0;background:#111128;border:1px solid #1e2040;
    color:#888;border-radius:5px;cursor:pointer;font-size:12px;transition:all .15s}
  .ve-align-btn:hover,.ve-align-btn.active{background:rgba(50,184,198,.12);
    border-color:rgba(50,184,198,.35);color:#32b8c6}
  /* ── Changes list ── */
  .ve-cl{padding:8px 12px}
  .ve-ci{display:flex;align-items:center;gap:6px;padding:5px 0;
    border-bottom:1px solid #111128}
  .ve-ci:last-child{border-bottom:none}
  .ve-ci-dot{width:6px;height:6px;border-radius:50%;background:#e94560;flex-shrink:0}
  .ve-ci-lbl{color:#aaa;font-size:11px;flex:1;line-height:1.3}
  .ve-ci-undo{background:none;border:none;color:#555;cursor:pointer;
    font-size:13px;padding:0 3px;transition:color .15s}
  .ve-ci-undo:hover{color:#e94560}
  /* ── Empty ── */
  .ve-empty{text-align:center;padding:24px 16px;color:#555;font-size:12px;line-height:1.7}
  .ve-empty-icon{font-size:28px;margin-bottom:8px;opacity:.4}
  /* ── Submit Modal ── */
  .ve-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:100000;
    display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px)}
  .ve-modal{background:#0e0e1a;border:1px solid #1e1e3a;border-radius:14px;
    padding:24px;width:420px;max-width:95vw;direction:rtl;
    font-family:'Segoe UI',Tahoma,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.65)}
  .ve-modal h3{margin:0 0 4px;color:#fff;font-size:16px}
  .ve-modal-sub{color:#666;font-size:11px;margin-bottom:16px}
  .ve-mf{margin-bottom:11px}
  .ve-mf label{display:block;color:#aaa;font-size:12px;margin-bottom:4px}
  .ve-mf input,.ve-mf textarea,.ve-mf select{width:100%;box-sizing:border-box;
    background:#14141f;border:1px solid #2a2a4a;color:#e0e0e0;border-radius:7px;
    padding:8px 10px;font-size:13px;font-family:inherit;outline:none;direction:rtl}
  .ve-mf textarea{min-height:70px;resize:vertical}
  .ve-modal-actions{display:flex;gap:8px;margin-top:16px}
  .ve-m-submit{flex:1;padding:9px;background:linear-gradient(135deg,#e94560,#c62a47);
    color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;
    font-family:inherit;font-weight:700;transition:all .2s}
  .ve-m-submit:hover{transform:translateY(-1px);box-shadow:0 4px 18px rgba(233,69,96,.5)}
  .ve-m-cancel{padding:9px 16px;background:#1a1a2e;color:#aaa;
    border:1px solid #2a2a4a;border-radius:8px;cursor:pointer;
    font-size:13px;font-family:inherit;transition:all .2s}
  .ve-m-cancel:hover{color:#fff}
  /* ── Toast ── */
  .ve-toast{position:fixed;top:62px;left:50%;
    transform:translateX(-50%) translateY(-8px);
    background:#1a2a1a;color:#4caf50;
    border:1px solid rgba(76,175,80,.35);padding:7px 18px;border-radius:18px;
    font-size:12px;font-family:'Segoe UI',Tahoma,sans-serif;
    z-index:100001;opacity:0;transition:all .25s;pointer-events:none}
  .ve-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  .ve-toast.err{background:#2a1a1a;color:#f44336;border-color:rgba(244,67,54,.35)}
  /* ── Drag active ── */
  body.ve-dragging{user-select:none!important}
  body.ve-dragging *{cursor:grabbing!important}
  `;

  /* ═══════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════ */
  var ve = {
    active: false, pageName: '', pageTitle: '',
    mode: 'select',
    selectedEl: null,
    hoverEl: null,
    // DOM refs
    hoverBoxEl: null, selectedBoxEl: null,
    bannerEl: null, sidebarEl: null, qtbEl: null, toastEl: null, styleTag: null,
    handles: [],
    countPill: null, undoBtn: null, redoBtn: null,
    // History
    changes: [], redoStack: [], changeCounter: 0,
    // Drag
    isDragging: false,
    dragEl: null, dragStartMX: 0, dragStartMY: 0, dragOrigTX: 0, dragOrigTY: 0,
    // Resize
    isResizing: false, resizeDir: '', resizeEl: null,
    resizeStartMX: 0, resizeStartMY: 0, resizeOrigW: 0, resizeOrigH: 0,
    // Originals
    origBodyPT: '', origBodyMR: ''
  };

  /* ═══════════════════════════════════════════════════
     UTILITIES
  ═══════════════════════════════════════════════════ */
  function positionBox(boxEl, targetEl) {
    if (!targetEl) { boxEl.style.display = 'none'; return; }
    var r = targetEl.getBoundingClientRect();
    boxEl.style.display  = 'block';
    boxEl.style.top      = (r.top  - 2) + 'px';
    boxEl.style.left     = (r.left - 2) + 'px';
    boxEl.style.width    = (r.width  + 4) + 'px';
    boxEl.style.height   = (r.height + 4) + 'px';
  }

  function buildSelector(el) {
    // Build a unique CSS selector — walks up to body, anchors at nearest ID ancestor
    if (!el || el === document.body) return 'body';
    if (el.id) return '#' + el.id.replace(/([^\w-])/g, '\\$1');
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body) {
      var tag = cur.tagName.toLowerCase();
      if (cur.id) {
        // Found an ID ancestor — anchor here and stop
        parts.unshift('#' + cur.id.replace(/([^\w-])/g, '\\$1'));
        return parts.join(' > ');
      }
      var siblings = cur.parentElement
        ? Array.prototype.slice.call(cur.parentElement.children)
        : [];
      var idx = siblings.indexOf(cur) + 1;
      parts.unshift(tag + ':nth-child(' + idx + ')');
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function elLabel(el) {
    if (!el) return '';
    var tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      var cls = el.className.trim().split(/\s+/)[0];
      if (cls) return tag + '.' + cls;
    }
    return tag;
  }

  function elBreadcrumb(el) {
    var list = [], cur = el;
    while (cur && cur !== document.body && list.length < 5) {
      list.push(cur); cur = cur.parentElement;
    }
    return list;
  }

  function parseTranslate(el) {
    var t = el.style.transform || '';
    var m = t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    if (m) return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
    var m3 = t.match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/);
    if (m3) return { x: parseFloat(m3[1]), y: parseFloat(m3[2]) };
    return { x: 0, y: 0 };
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
    if (/^#/.test(rgb)) return rgb;
    var m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#000000';
    return '#' + [m[1], m[2], m[3]].map(function(v) {
      return ('0' + parseInt(v).toString(16)).slice(-2);
    }).join('');
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function showToast(msg, isErr) {
    var t = ve.toastEl; if (!t) return;
    t.textContent = msg;
    t.className = 've-toast' + (isErr ? ' err' : '');
    setTimeout(function() { t.classList.add('show'); }, 10);
    setTimeout(function() { t.classList.remove('show'); }, 2000);
  }

  /* ═══════════════════════════════════════════════════
     CHANGE HISTORY
  ═══════════════════════════════════════════════════ */
  function applyChange(c, dir) {
    var val = dir === 'undo' ? c.oldVal : c.newVal;
    if (c.type === 'text')  c.el.textContent     = val;
    else if (c.type === 'style') c.el.style[c.property] = val;
  }

  function recordChange(type, el, prop, oldVal, newVal, label) {
    if (String(oldVal) === String(newVal)) return;
    // If oldVal is empty, capture the actual computed value so the admin can see the real "before"
    var realOld = oldVal;
    if ((realOld === '' || realOld == null) && type === 'style') {
      try {
        var cv = window.getComputedStyle(el).getPropertyValue(
          prop.replace(/([A-Z])/g, function(m){ return '-'+m.toLowerCase(); })
        );
        if (cv) realOld = cv;
      } catch(e) {}
    }
    ve.changeCounter++;
    ve.changes.push({ id: ve.changeCounter, type: type, el: el,
      property: prop, oldVal: realOld, newVal: newVal, label: label,
      selector: buildSelector(el), elTag: el.tagName });
    ve.redoStack = [];
    updateHistoryUI();
    refreshChangesList();
  }

  function undoById(id) {
    for (var i = 0; i < ve.changes.length; i++) {
      if (ve.changes[i].id === id) {
        var c = ve.changes.splice(i, 1)[0];
        applyChange(c, 'undo');
        ve.redoStack.push(c);
        break;
      }
    }
    updateHistoryUI(); refreshChangesList();
    showToast('تم التراجع');
  }

  function undoLast() {
    if (!ve.changes.length) return;
    var c = ve.changes.pop();
    applyChange(c, 'undo');
    ve.redoStack.push(c);
    updateHistoryUI(); refreshChangesList();
    showToast('تراجع');
  }

  function redoLast() {
    if (!ve.redoStack.length) return;
    var c = ve.redoStack.pop();
    applyChange(c, 'redo');
    ve.changes.push(c);
    updateHistoryUI(); refreshChangesList();
    showToast('تقدم');
  }

  function revertAll() {
    for (var i = ve.changes.length - 1; i >= 0; i--) applyChange(ve.changes[i], 'undo');
    ve.changes = []; ve.redoStack = [];
    updateHistoryUI();
  }

  function updateHistoryUI() {
    if (ve.countPill) ve.countPill.textContent = ve.changes.length + ' تعديل';
    if (ve.undoBtn) ve.undoBtn.disabled = !ve.changes.length;
    if (ve.redoBtn) ve.redoBtn.disabled = !ve.redoStack.length;
  }

  /* ═══════════════════════════════════════════════════
     OVERLAYS SYNC
  ═══════════════════════════════════════════════════ */
  var HANDLE_DIRS = ['nw','n','ne','e','se','s','sw','w'];

  function syncOverlays() {
    var el = ve.selectedEl;
    if (!el) { hideAllOverlays(); return; }
    var r = el.getBoundingClientRect();

    // Selected box
    var sb = ve.selectedBoxEl;
    sb.style.display = 'block';
    sb.style.top     = (r.top  - 3) + 'px';
    sb.style.left    = (r.left - 3) + 'px';
    sb.style.width   = (r.width  + 6) + 'px';
    sb.style.height  = (r.height + 6) + 'px';

    // Handles
    var hp = {
      nw:[r.left-5,r.top-5],      n:[r.left+r.width/2-5,r.top-5],
      ne:[r.left+r.width-5,r.top-5], e:[r.left+r.width-5,r.top+r.height/2-5],
      se:[r.left+r.width-5,r.top+r.height-5], s:[r.left+r.width/2-5,r.top+r.height-5],
      sw:[r.left-5,r.top+r.height-5], w:[r.left-5,r.top+r.height/2-5]
    };
    ve.handles.forEach(function(h) {
      var p = hp[h.dataset.d];
      h.style.left = p[0] + 'px'; h.style.top = p[1] + 'px';
      h.style.display = 'block';
    });

    // Quick toolbar
    var qtb = ve.qtbEl;
    if (qtb) {
      var qtbW = qtb.offsetWidth || 155;
      var tx = r.left + r.width / 2 - qtbW / 2;
      var ty = r.top - 42;
      if (ty < 58) ty = r.bottom + 8;
      if (tx < 4) tx = 4;
      qtb.style.left    = tx + 'px';
      qtb.style.top     = ty + 'px';
      qtb.style.display = 'flex';
    }
  }

  function hideAllOverlays() {
    ve.selectedBoxEl.style.display = 'none';
    if (ve.hoverBoxEl) ve.hoverBoxEl.style.display = 'none';
    ve.handles.forEach(function(h) { h.style.display = 'none'; });
    if (ve.qtbEl) ve.qtbEl.style.display = 'none';
  }

  /* ═══════════════════════════════════════════════════
     DOCUMENT EVENT HANDLERS (no capture layer)
  ═══════════════════════════════════════════════════ */
  function onDocMouseMove(e) {
    if (!ve.active) return;

    // Handle drag
    if (ve.isDragging && ve.dragEl) {
      var dx = e.clientX - ve.dragStartMX;
      var dy = e.clientY - ve.dragStartMY;
      ve.dragEl.style.transform =
        'translate(' + (ve.dragOrigTX + dx) + 'px,' + (ve.dragOrigTY + dy) + 'px)';
      syncOverlays();
      return;
    }

    // Handle resize
    if (ve.isResizing && ve.resizeEl) {
      var dx2 = e.clientX - ve.resizeStartMX;
      var dy2 = e.clientY - ve.resizeStartMY;
      var d = ve.resizeDir;
      var nW = ve.resizeOrigW, nH = ve.resizeOrigH;
      if (d.indexOf('e') !== -1) nW = Math.max(20, ve.resizeOrigW + dx2);
      if (d.indexOf('w') !== -1) nW = Math.max(20, ve.resizeOrigW - dx2);
      if (d.indexOf('s') !== -1) nH = Math.max(8,  ve.resizeOrigH + dy2);
      if (d.indexOf('n') !== -1) nH = Math.max(8,  ve.resizeOrigH - dy2);
      ve.resizeEl.style.width  = nW + 'px';
      ve.resizeEl.style.height = nH + 'px';
      syncOverlays();
      return;
    }

    // Hover highlight
    var target = e.target;
    if (isEditorEl(target)) {
      if (ve.hoverBoxEl) ve.hoverBoxEl.style.display = 'none';
      return;
    }
    if (target && target !== document.body && target !== document.documentElement) {
      ve.hoverEl = target;
      positionBox(ve.hoverBoxEl, target);
    } else {
      if (ve.hoverBoxEl) ve.hoverBoxEl.style.display = 'none';
    }
  }

  function onDocMouseDown(e) {
    if (!ve.active) return;
    var target = e.target;
    if (isEditorEl(target)) return; // let editor UI handle its own events

    // In move mode — start drag
    if (ve.mode === 'move') {
      e.preventDefault();
      var orig = parseTranslate(target);
      var cs = window.getComputedStyle(target);
      if (cs.position === 'static') target.style.position = 'relative';
      ve.isDragging  = true;
      ve.dragEl      = target;
      ve.dragStartMX = e.clientX;
      ve.dragStartMY = e.clientY;
      ve.dragOrigTX  = orig.x;
      ve.dragOrigTY  = orig.y;
      document.body.classList.add('ve-dragging');
      selectElement(target);
      return;
    }

    // Select mode — select element on click
    e.preventDefault();
    selectElement(target);
  }

  function onDocMouseUp() {
    if (!ve.active) return;

    if (ve.isDragging && ve.dragEl) {
      var origT = 'translate(' + ve.dragOrigTX + 'px,' + ve.dragOrigTY + 'px)';
      var curT  = ve.dragEl.style.transform;
      if (origT !== curT) {
        var t = parseTranslate(ve.dragEl);
        recordChange('style', ve.dragEl, 'transform', origT, curT,
          'تحريك ' + elLabel(ve.dragEl) + ': (' + Math.round(t.x) + ', ' + Math.round(t.y) + ')');
        buildSidebarContent();
      }
      ve.isDragging = false;
      ve.dragEl = null;
      document.body.classList.remove('ve-dragging');
    }

    if (ve.isResizing && ve.resizeEl) {
      recordChange('style', ve.resizeEl, 'width',
        ve.resizeOrigW + 'px', ve.resizeEl.style.width, 'عرض: ' + ve.resizeEl.style.width);
      recordChange('style', ve.resizeEl, 'height',
        ve.resizeOrigH + 'px', ve.resizeEl.style.height, 'ارتفاع: ' + ve.resizeEl.style.height);
      ve.isResizing = false; ve.resizeEl = null;
      buildSidebarContent();
    }
  }

  /* ═══════════════════════════════════════════════════
     SELECT
  ═══════════════════════════════════════════════════ */
  function selectElement(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    ve.selectedEl = el;
    syncOverlays();
    ve.sidebarEl.classList.add('ve-open');
    document.body.classList.add('ve-sb-open');
    buildSidebarContent();
  }

  /* ═══════════════════════════════════════════════════
     SIDEBAR
  ═══════════════════════════════════════════════════ */
  function buildSidebarContent() {
    var sb = ve.sidebarEl;
    var el = ve.selectedEl;

    if (!el) {
      sb.innerHTML =
        '<div class="ve-empty"><div class="ve-empty-icon">🖱️</div>' +
        'انقر على أي عنصر في الصفحة لتحريره</div>' +
        changesHtml();
      bindChangesBtns();
      return;
    }

    var cs   = window.getComputedStyle(el);
    var ancs = elBreadcrumb(el);
    var breadHtml = ancs.map(function(a, i) {
      return '<button class="ve-bread-btn' + (i === 0 ? ' current' : '') +
        '" data-idx="' + i + '">' + esc(elLabel(a)) + '</button>';
    }).join('');

    var hasText = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3;
    var tx   = Math.round(parseTranslate(el).x);
    var ty   = Math.round(parseTranslate(el).y);
    var cW   = Math.round(parseFloat(cs.width))  || '';
    var cH   = Math.round(parseFloat(cs.height)) || '';
    var cFS  = parseInt(cs.fontSize) || 14;
    var cFW  = cs.fontWeight;
    var cTA  = cs.textAlign || 'right';
    var cC   = rgbToHex(cs.color);
    var cBg  = rgbToHex(cs.backgroundColor);
    var cOp  = parseFloat(cs.opacity || 1);
    var cBR  = parseInt(cs.borderRadius) || 0;
    var cBW  = parseInt(cs.borderWidth)  || 0;
    var cBS  = cs.borderStyle || 'none';
    var cBC  = rgbToHex(cs.borderColor);
    var cSh  = el.style.boxShadow || '';
    var pt=parseInt(cs.paddingTop)||0, pr=parseInt(cs.paddingRight)||0,
        pb=parseInt(cs.paddingBottom)||0, pl=parseInt(cs.paddingLeft)||0;
    var mt=parseInt(cs.marginTop)||0, mr=parseInt(cs.marginRight)||0,
        mb=parseInt(cs.marginBottom)||0, ml=parseInt(cs.marginLeft)||0;

    sb.innerHTML =
      '<div class="ve-sh">' +
        '<h4>تعديل: ' + esc(elLabel(el)) + '</h4>' +
        '<div class="ve-el-path">' + esc(el.tagName.toLowerCase()) + '</div>' +
        '<div class="ve-el-breadcrumb" id="ve-breadcrumb">' + breadHtml + '</div>' +
      '</div>' +

      sec('الموضع والحجم', true,
        row('X', '<input class="ve-inp ve-inp-sm" type="number" id="ve-tx" value="'+tx+'">') +
        row('Y', '<input class="ve-inp ve-inp-sm" type="number" id="ve-ty" value="'+ty+'">') +
        row('عرض', '<input class="ve-inp ve-inp-sm" type="number" id="ve-w" value="'+cW+'">') +
        row('ارتفاع', '<input class="ve-inp ve-inp-sm" type="number" id="ve-h" value="'+cH+'">') +
        '<button class="ve-apply" onclick="veApplyPos()">تطبيق الموضع والحجم</button>'
      ) +

      (hasText ? sec('النص', true,
        '<textarea class="ve-textarea" id="ve-text-val">'+esc(el.textContent)+'</textarea>' +
        '<div class="ve-align-row" style="margin-top:5px">' +
          '<button class="ve-align-btn'+(cTA==='right'?' active':'')+'" onclick="veTextAlign(\'right\')">يمين←</button>' +
          '<button class="ve-align-btn'+(cTA==='center'?' active':'')+'" onclick="veTextAlign(\'center\')">⊙</button>' +
          '<button class="ve-align-btn'+(cTA==='left'?' active':'')+'" onclick="veTextAlign(\'left\')">→يسار</button>' +
        '</div>' +
        '<button class="ve-apply" onclick="veApplyText()">تطبيق النص</button>'
      ) : '') +

      sec('الطباعة', false,
        row('حجم', '<input class="ve-inp ve-inp-sm" type="number" id="ve-fs" value="'+cFS+'"><span style="color:#555;font-size:10px;margin-right:3px">px</span>') +
        row('وزن',
          '<select class="ve-sel" id="ve-fw">' +
            ['300','400','500','600','700','800'].map(function(w) {
              return '<option value="'+w+'"'+(parseInt(cFW)===parseInt(w)?' selected':'')+'>'+w+'</option>';
            }).join('') +
          '</select>'
        ) +
        '<button class="ve-apply" onclick="veApplyTypo()">تطبيق الطباعة</button>'
      ) +

      sec('الألوان', false,
        clrRow('النص',    'clr',  cC) +
        clrRow('الخلفية', 'bg',   cBg) +
        '<button class="ve-apply" onclick="veApplyColors()">تطبيق الألوان</button>'
      ) +

      sec('التباعد', false,
        '<div class="ve-bm">' +
          '<div class="ve-bm-lbl">MARGIN</div>' +
          '<div class="ve-bm-margin">' +
            '<div class="ve-bm-top"><input class="ve-bm-inp" id="ve-mt" type="number" value="'+mt+'"></div>' +
            '<div class="ve-bm-mid">' +
              '<input class="ve-bm-inp" id="ve-ml" type="number" value="'+ml+'">' +
              '<div style="flex:1">' +
                '<div class="ve-bm-lbl" style="margin-top:3px">PADDING</div>' +
                '<div class="ve-bm-padding">' +
                  '<div class="ve-bm-top"><input class="ve-bm-inp" id="ve-pt" type="number" value="'+pt+'"></div>' +
                  '<div class="ve-bm-mid"><input class="ve-bm-inp" id="ve-pl" type="number" value="'+pl+'">' +
                  '<div class="ve-bm-el">'+el.tagName.toLowerCase()+'</div>' +
                  '<input class="ve-bm-inp" id="ve-pr" type="number" value="'+pr+'"></div>' +
                  '<div class="ve-bm-bottom"><input class="ve-bm-inp" id="ve-pb" type="number" value="'+pb+'"></div>' +
                '</div>' +
              '</div>' +
              '<input class="ve-bm-inp" id="ve-mr" type="number" value="'+mr+'">' +
            '</div>' +
            '<div class="ve-bm-bottom"><input class="ve-bm-inp" id="ve-mb" type="number" value="'+mb+'"></div>' +
          '</div>' +
        '</div>' +
        '<button class="ve-apply" onclick="veApplySpacing()">تطبيق التباعد</button>'
      ) +

      sec('الحدود', false,
        row('سمك', '<input class="ve-inp ve-inp-sm" type="number" id="ve-bw" value="'+cBW+'"><span style="color:#555;font-size:10px;margin-right:3px">px</span>') +
        row('نوع',
          '<select class="ve-sel" id="ve-bs">' +
            ['none','solid','dashed','dotted','double'].map(function(s) {
              return '<option value="'+s+'"'+(cBS===s?' selected':'')+'>'+s+'</option>';
            }).join('') +
          '</select>'
        ) +
        clrRow('لون', 'bc', cBC) +
        row('انحناء',
          '<input class="ve-range" type="range" id="ve-br" min="0" max="50" value="'+cBR+'">' +
          '<span class="ve-range-val" id="ve-br-v">'+cBR+'px</span>'
        ) +
        '<button class="ve-apply" onclick="veApplyBorder()">تطبيق الحدود</button>'
      ) +

      sec('التأثيرات', false,
        row('شفافية',
          '<input class="ve-range" type="range" id="ve-op" min="0" max="1" step="0.05" value="'+cOp+'">' +
          '<span class="ve-range-val" id="ve-op-v">'+Math.round(cOp*100)+'%</span>'
        ) +
        '<div class="ve-row"><label>ظل</label>' +
          '<input class="ve-inp" type="text" id="ve-shadow" placeholder="0 4px 12px rgba(0,0,0,.4)" value="'+esc(cSh)+'"></div>' +
        '<button class="ve-apply" onclick="veApplyEffects()">تطبيق التأثيرات</button>'
      ) +

      '<div class="ve-sec"><div class="ve-sec-hd" onclick="veSec(this)">' +
        '<div class="ve-sec-title">التعديلات المسجلة</div>' +
        '<span class="ve-sec-arrow">▼</span></div>' +
        '<div class="ve-sec-body open">' + changesHtml() + '</div>' +
      '</div>';

    // Range live preview
    bindRange('ve-br', 've-br-v', function(v) { return v + 'px'; });
    bindRange('ve-op', 've-op-v', function(v) { return Math.round(v * 100) + '%'; });

    // Breadcrumb clicks
    var bc = document.getElementById('ve-breadcrumb');
    if (bc) bc.addEventListener('click', function(e) {
      var btn = e.target.closest('.ve-bread-btn');
      if (!btn) return;
      var ancs2 = elBreadcrumb(ve.selectedEl);
      var a = ancs2[parseInt(btn.dataset.idx)];
      if (a) selectElement(a);
    });

    bindChangesBtns();
  }

  function sec(title, open, body) {
    return '<div class="ve-sec"><div class="ve-sec-hd" onclick="veSec(this)">' +
      '<div class="ve-sec-title">' + title + '</div>' +
      '<span class="ve-sec-arrow">' + (open ? '▼' : '▶') + '</span>' +
      '</div><div class="ve-sec-body' + (open ? ' open' : '') + '">' + body + '</div></div>';
  }
  function row(label, inp) {
    return '<div class="ve-row"><label>' + label + '</label>' + inp + '</div>';
  }
  function clrRow(label, id, val) {
    return '<div class="ve-clr-row"><label>' + label + '</label>' +
      '<input type="color" class="ve-cpick" id="ve-' + id + '-p" value="' + val + '" oninput="veCS(\'' + id + '\')">' +
      '<input type="text"  class="ve-cpick-txt" id="ve-' + id + '-t" value="' + val + '" oninput="veCST(\'' + id + '\')">' +
      '</div>';
  }
  function changesHtml() {
    if (!ve.changes.length) {
      return '<div class="ve-empty" style="padding:12px"><div class="ve-empty-icon" style="font-size:20px">📭</div>لا توجد تعديلات</div>';
    }
    return '<div class="ve-cl">' +
      ve.changes.slice().reverse().map(function(c) {
        return '<div class="ve-ci">' +
          '<div class="ve-ci-dot"></div>' +
          '<div class="ve-ci-lbl">' + esc(c.label) + '</div>' +
          '<button class="ve-ci-undo" data-chid="' + c.id + '">↩</button>' +
        '</div>';
      }).join('') +
      '</div>';
  }
  function bindChangesBtns() {
    document.querySelectorAll('.ve-ci-undo').forEach(function(btn) {
      btn.addEventListener('click', function() {
        undoById(parseInt(btn.dataset.chid));
        buildSidebarContent();
      });
    });
  }
  function bindRange(rid, vid, fmt) {
    var r = document.getElementById(rid), v = document.getElementById(vid);
    if (r && v) r.addEventListener('input', function() { v.textContent = fmt(r.value); });
  }
  function refreshChangesList() {
    if (ve.sidebarEl && ve.sidebarEl.classList.contains('ve-open')) {
      buildSidebarContent();
    }
    updateHistoryUI();
  }

  /* ═══════════════════════════════════════════════════
     GLOBAL APPLY FUNCTIONS
  ═══════════════════════════════════════════════════ */
  global.veSec = function(hd) {
    var b = hd.nextElementSibling;
    var a = hd.querySelector('.ve-sec-arrow');
    b.classList.toggle('open');
    if (a) a.textContent = b.classList.contains('open') ? '▼' : '▶';
  };
  global.veCS  = function(id) { var p=document.getElementById('ve-'+id+'-p'),t=document.getElementById('ve-'+id+'-t'); if(p&&t)t.value=p.value; };
  global.veCST = function(id) { var t=document.getElementById('ve-'+id+'-t'),p=document.getElementById('ve-'+id+'-p'); if(t&&p&&/^#[0-9a-fA-F]{6}$/.test(t.value))p.value=t.value; };

  global.veApplyPos = function() {
    var el = ve.selectedEl; if (!el) return;
    var tx = document.getElementById('ve-tx'), ty = document.getElementById('ve-ty');
    var wi = document.getElementById('ve-w'),  hi = document.getElementById('ve-h');
    if (tx && ty) {
      var nT = 'translate('+tx.value+'px,'+ty.value+'px)';
      var cs = window.getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      recordChange('style', el, 'transform', el.style.transform||'', nT, 'موضع: ('+tx.value+','+ty.value+')');
      el.style.transform = nT;
    }
    if (wi && wi.value) { recordChange('style',el,'width', el.style.width||'',wi.value+'px','عرض: '+wi.value+'px'); el.style.width=wi.value+'px'; }
    if (hi && hi.value) { recordChange('style',el,'height',el.style.height||'',hi.value+'px','ارتفاع: '+hi.value+'px'); el.style.height=hi.value+'px'; }
    syncOverlays(); showToast('الموضع والحجم');
  };

  global.veApplyText = function() {
    var el = ve.selectedEl; if (!el) return;
    var inp = document.getElementById('ve-text-val'); if (!inp) return;
    var old = el.textContent, nv = inp.value;
    el.textContent = nv;
    recordChange('text', el, 'textContent', old, nv, 'نص: "'+nv.substring(0,20)+'"');
    showToast('النص'); syncOverlays();
  };

  global.veTextAlign = function(align) {
    var el = ve.selectedEl; if (!el) return;
    var old = el.style.textAlign || '';
    el.style.textAlign = align;
    recordChange('style', el, 'textAlign', old, align, 'محاذاة: '+align);
    buildSidebarContent();
  };

  global.veApplyTypo = function() {
    var el = ve.selectedEl; if (!el) return;
    var fs = document.getElementById('ve-fs'), fw = document.getElementById('ve-fw');
    if (fs&&fs.value) { recordChange('style',el,'fontSize',el.style.fontSize||'',fs.value+'px','حجم الخط: '+fs.value+'px'); el.style.fontSize=fs.value+'px'; }
    if (fw)           { recordChange('style',el,'fontWeight',el.style.fontWeight||'',fw.value,'وزن الخط: '+fw.value); el.style.fontWeight=fw.value; }
    showToast('الطباعة'); syncOverlays();
  };

  global.veApplyColors = function() {
    var el = ve.selectedEl; if (!el) return;
    var ct = document.getElementById('ve-clr-t'), bt = document.getElementById('ve-bg-t');
    if (ct) { recordChange('style',el,'color',el.style.color||'',ct.value,'لون النص: '+ct.value); el.style.color=ct.value; }
    if (bt) { recordChange('style',el,'backgroundColor',el.style.backgroundColor||'',bt.value,'لون الخلفية: '+bt.value); el.style.backgroundColor=bt.value; }
    showToast('الألوان');
  };

  global.veApplySpacing = function() {
    var el = ve.selectedEl; if (!el) return;
    [['ve-pt','paddingTop'],['ve-pr','paddingRight'],['ve-pb','paddingBottom'],['ve-pl','paddingLeft'],
     ['ve-mt','marginTop'], ['ve-mr','marginRight'], ['ve-mb','marginBottom'],['ve-ml','marginLeft']
    ].forEach(function(f) {
      var inp = document.getElementById(f[0]); if (!inp) return;
      var nv = inp.value + 'px';
      recordChange('style',el,f[1],el.style[f[1]]||'',nv,f[1]+': '+nv);
      el.style[f[1]] = nv;
    });
    showToast('التباعد'); syncOverlays();
  };

  global.veApplyBorder = function() {
    var el = ve.selectedEl; if (!el) return;
    var bw=document.getElementById('ve-bw'), bs=document.getElementById('ve-bs'),
        bc=document.getElementById('ve-bc-t'), br=document.getElementById('ve-br');
    if (bw) { recordChange('style',el,'borderWidth',el.style.borderWidth||'',bw.value+'px','سمك الحد: '+bw.value+'px'); el.style.borderWidth=bw.value+'px'; }
    if (bs) { recordChange('style',el,'borderStyle',el.style.borderStyle||'',bs.value,'نوع الحد: '+bs.value); el.style.borderStyle=bs.value; }
    if (bc) { recordChange('style',el,'borderColor',el.style.borderColor||'',bc.value,'لون الحد: '+bc.value); el.style.borderColor=bc.value; }
    if (br) { recordChange('style',el,'borderRadius',el.style.borderRadius||'',br.value+'px','انحناء: '+br.value+'px'); el.style.borderRadius=br.value+'px'; }
    showToast('الحدود'); syncOverlays();
  };

  global.veApplyEffects = function() {
    var el = ve.selectedEl; if (!el) return;
    var op=document.getElementById('ve-op'), sh=document.getElementById('ve-shadow');
    if (op) { recordChange('style',el,'opacity',el.style.opacity||'',op.value,'شفافية: '+Math.round(op.value*100)+'%'); el.style.opacity=op.value; }
    if (sh) { recordChange('style',el,'boxShadow',el.style.boxShadow||'',sh.value,'ظل'); el.style.boxShadow=sh.value; }
    showToast('التأثيرات');
  };

  /* ═══════════════════════════════════════════════════
     KEYBOARD
  ═══════════════════════════════════════════════════ */
  function onKeyDown(e) {
    if (!ve.active) return;
    var tag = (e.target.tagName || '').toLowerCase();
    var inInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'Escape') {
      if (document.getElementById('ve-submit-modal')) { global.veCloseModal(); return; }
      if (ve.sidebarEl.classList.contains('ve-open')) {
        ve.sidebarEl.classList.remove('ve-open');
        document.body.classList.remove('ve-sb-open');
        ve.selectedEl = null;
        hideAllOverlays();
        return;
      }
      global.veCloseEditor(); return;
    }
    if (inInput) return;
    if ((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='z') { e.preventDefault(); undoLast(); return; }
    if ((e.ctrlKey||e.metaKey) && (e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))) { e.preventDefault(); redoLast(); return; }
    // Arrow nudge
    if (ve.selectedEl && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key) !== -1) {
      e.preventDefault();
      var el = ve.selectedEl;
      var cs = window.getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      var t = parseTranslate(el);
      var step = e.shiftKey ? 10 : 1;
      if (e.key==='ArrowLeft')  t.x -= step;
      if (e.key==='ArrowRight') t.x += step;
      if (e.key==='ArrowUp')    t.y -= step;
      if (e.key==='ArrowDown')  t.y += step;
      el.style.transform = 'translate('+t.x+'px,'+t.y+'px)';
      syncOverlays();
    }
    if (!e.ctrlKey && e.key.toLowerCase() === 's') setMode('select');
    if (!e.ctrlKey && e.key.toLowerCase() === 'm') setMode('move');
  }

  /* ═══════════════════════════════════════════════════
     MODE
  ═══════════════════════════════════════════════════ */
  function setMode(m) {
    ve.mode = m;
    document.body.classList.remove('ve-mode-select','ve-mode-move');
    document.body.classList.add('ve-mode-'+m);
    document.querySelectorAll('.ve-tool').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.mode === m);
    });
    showToast(m === 'move' ? 'وضع التحريك — اسحب العناصر' : 'وضع الاختيار');
  }

  /* ═══════════════════════════════════════════════════
     SUBMIT MODAL
  ═══════════════════════════════════════════════════ */
  function openSubmitModal() {
    if (!ve.changes.length) { showToast('لا توجد تعديلات لإرسالها', true); return; }
    var modal = document.createElement('div');
    modal.className = 've-modal-bg'; modal.id = 've-submit-modal';
    modal.innerHTML =
      '<div class="ve-modal">' +
        '<h3>إرسال طلب التعديل</h3>' +
        '<div class="ve-modal-sub">' + ve.changes.length + ' تعديل — ' + esc(ve.pageTitle) + '</div>' +
        '<div class="ve-mf"><label>عنوان الطلب *</label><input type="text" id="ve-req-t" placeholder="مثال: تعديل ألوان القسم الرئيسي"></div>' +
        '<div class="ve-mf"><label>النوع</label><select id="ve-req-tp"><option>تصميم</option><option>تحسين</option><option>وظيفة جديدة</option><option>إصلاح</option></select></div>' +
        '<div class="ve-mf"><label>الوصف</label><textarea id="ve-req-d" placeholder="اشرح سبب هذه التعديلات..."></textarea></div>' +
        '<div class="ve-modal-actions">' +
          '<button class="ve-m-submit" onclick="veDoSubmit()">إرسال للإدارة</button>' +
          '<button class="ve-m-cancel" onclick="veCloseModal()">إلغاء</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  global.veDoSubmit = function() {
    var t = document.getElementById('ve-req-t');
    if (!t || !t.value.trim()) { showToast('أدخل عنوان الطلب', true); return; }
    var tp = document.getElementById('ve-req-tp');
    var d  = document.getElementById('ve-req-d');
    var ser = ve.changes.map(function(c) {
      // afterStyle = full inline style of the element AT SUBMISSION TIME (all changes applied)
      // This lets the admin see the exact visual result regardless of DOM structure
      var afterStyle = '';
      var afterText  = '';
      try {
        if (c.el) {
          afterStyle = c.el.getAttribute('style') || '';
          if (c.type === 'text') afterText = c.el.textContent || '';
        }
      } catch(e) {}
      return { id:c.id, type:c.type, property:c.property, oldVal:c.oldVal, newVal:c.newVal,
        label:c.label, elPath:c.selector, elTag:c.elTag,
        afterStyle: afterStyle, afterText: afterText };
    });
    var req = { id: Date.now(), title: t.value.trim(), type: tp ? tp.value : 'تصميم',
      description: d ? d.value.trim() : '', page: ve.pageName, pageTitle: ve.pageTitle,
      changes: ser, changesCount: ser.length, status: 'pending',
      submittedAt: new Date().toLocaleString('ar-SA'), source: 'visual-editor' };
    var all = [];
    try { all = JSON.parse(localStorage.getItem('devRequests') || '[]'); } catch(ex) {}
    all.unshift(req);
    localStorage.setItem('devRequests', JSON.stringify(all));
    global.veCloseModal();
    showToast('تم الإرسال للإدارة');
    setTimeout(function() { closeEditor(false); }, 1400);
  };

  global.veCloseModal = function() {
    var m = document.getElementById('ve-submit-modal');
    if (m && m.parentNode) m.parentNode.removeChild(m);
  };

  /* ═══════════════════════════════════════════════════
     CLOSE
  ═══════════════════════════════════════════════════ */
  function closeEditor(revert) {
    if (!ve.active) return;
    if (revert !== false) revertAll();
    ['ve-banner','ve-hover-box','ve-selected-box','ve-sidebar',
     've-toast','ve-quick-toolbar','ve-submit-modal'].forEach(function(id) {
      var el = document.getElementById(id); if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    ve.handles.forEach(function(h) { if (h.parentNode) h.parentNode.removeChild(h); });
    ve.handles = [];
    if (ve.styleTag && ve.styleTag.parentNode) ve.styleTag.parentNode.removeChild(ve.styleTag);
    document.body.style.paddingTop = ve.origBodyPT || '';
    document.body.classList.remove('ve-dragging','ve-sb-open','ve-mode-move','ve-mode-select');
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousemove', onDocMouseMove, true);
    document.removeEventListener('mousedown', onDocMouseDown, true);
    document.removeEventListener('mouseup', onDocMouseUp);
    window.removeEventListener('scroll', syncOverlays, true);
    window.removeEventListener('resize', syncOverlays);
    ve.active = false; ve.selectedEl = null; ve.hoverEl = null;
    ve.changes = []; ve.redoStack = [];
    ve.hoverBoxEl = null; ve.selectedBoxEl = null;
    ve.bannerEl = null; ve.sidebarEl = null; ve.qtbEl = null;
    ve.toastEl = null; ve.styleTag = null;
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC ENTRY
  ═══════════════════════════════════════════════════ */
  global.openVisualEditor = function(pageName, pageTitle) {
    if (ve.active) return;
    ve.active = true; ve.pageName = pageName || 'page'; ve.pageTitle = pageTitle || 'صفحة';
    ve.changes = []; ve.redoStack = []; ve.changeCounter = 0;
    ve.selectedEl = null; ve.hoverEl = null; ve.handles = [];

    // Inject CSS
    var style = document.createElement('style');
    style.id = 've-styles'; style.textContent = CSS;
    document.head.appendChild(style); ve.styleTag = style;

    // Push page down for banner
    ve.origBodyPT = document.body.style.paddingTop || '';
    document.body.style.paddingTop = '52px';

    // ── Banner
    var banner = document.createElement('div');
    banner.className = 've-banner'; banner.id = 've-banner';
    banner.innerHTML =
      '<div class="ve-banner-brand">' +
        '<div class="ve-banner-icon">✏️</div>' +
        '<span class="ve-banner-label">المحرر البصري</span>' +
        '<span class="ve-banner-page">' + esc(pageTitle) + '</span>' +
      '</div>' +
      '<div class="ve-tools">' +
        '<button class="ve-tool active" data-mode="select" onclick="veSetMode(\'select\')">' +
          '🖱️<span class="ve-tool-tip">اختيار (S)</span></button>' +
        '<button class="ve-tool" data-mode="move" onclick="veSetMode(\'move\')">' +
          '✋<span class="ve-tool-tip">تحريك (M)</span></button>' +
      '</div>' +
      '<div class="ve-banner-actions">' +
        '<button class="ve-hbtn" id="ve-undo-btn" onclick="veUndoLast()" disabled title="تراجع Ctrl+Z">↩</button>' +
        '<button class="ve-hbtn" id="ve-redo-btn" onclick="veRedoLast()" disabled title="تقدم Ctrl+Y">↪</button>' +
        '<span class="ve-changes-pill" id="ve-count-pill">0 تعديل</span>' +
        '<button class="ve-btn ve-btn-submit" onclick="veOpenSubmit()">إرسال</button>' +
        '<button class="ve-btn ve-btn-close"  onclick="veCloseEditor()">إغلاق</button>' +
      '</div>';
    document.body.insertBefore(banner, document.body.firstChild);
    ve.bannerEl  = banner;
    ve.countPill = document.getElementById('ve-count-pill');
    ve.undoBtn   = document.getElementById('ve-undo-btn');
    ve.redoBtn   = document.getElementById('ve-redo-btn');

    // ── Hover box
    var hb = document.createElement('div');
    hb.className = 've-hover-box'; hb.id = 've-hover-box'; hb.style.display = 'none';
    document.body.appendChild(hb); ve.hoverBoxEl = hb;

    // ── Selected box
    var sb2 = document.createElement('div');
    sb2.className = 've-selected-box'; sb2.id = 've-selected-box'; sb2.style.display = 'none';
    document.body.appendChild(sb2); ve.selectedBoxEl = sb2;

    // ── 8 Resize handles
    HANDLE_DIRS.forEach(function(d) {
      var h = document.createElement('div');
      h.className = 've-handle'; h.dataset.d = d; h.style.display = 'none';
      h.addEventListener('mousedown', function(e) {
        e.preventDefault(); e.stopPropagation();
        if (!ve.selectedEl) return;
        var r = ve.selectedEl.getBoundingClientRect();
        ve.isResizing = true; ve.resizeDir = d; ve.resizeEl = ve.selectedEl;
        ve.resizeStartMX = e.clientX; ve.resizeStartMY = e.clientY;
        ve.resizeOrigW   = r.width;   ve.resizeOrigH   = r.height;
        ve.selectedEl.style.width  = r.width  + 'px';
        ve.selectedEl.style.height = r.height + 'px';
      });
      document.body.appendChild(h);
      ve.handles.push(h);
    });

    // ── Quick toolbar
    var qtb = document.createElement('div');
    qtb.className = 've-qtb'; qtb.id = 've-quick-toolbar';
    qtb.innerHTML =
      '<button class="ve-qtb-btn" onclick="veSetMode(\'select\')">🖱️<span class="ve-tool-tip">اختيار</span></button>' +
      '<button class="ve-qtb-btn" onclick="veSetMode(\'move\')" >✋<span class="ve-tool-tip">تحريك</span></button>' +
      '<div class="ve-qtb-sep"></div>' +
      '<button class="ve-qtb-btn" onclick="veQtbParent()">⬆️<span class="ve-tool-tip">الأب</span></button>' +
      '<div class="ve-qtb-sep"></div>' +
      '<button class="ve-qtb-btn" onclick="veQtbHide()">🙈<span class="ve-tool-tip">إخفاء</span></button>' +
      '<button class="ve-qtb-btn" onclick="veQtbReset()">🔄<span class="ve-tool-tip">إعادة ضبط</span></button>';
    document.body.appendChild(qtb); ve.qtbEl = qtb;

    // ── Sidebar (right side)
    var sidebar = document.createElement('div');
    sidebar.className = 've-sidebar'; sidebar.id = 've-sidebar';
    document.body.appendChild(sidebar); ve.sidebarEl = sidebar;
    buildSidebarContent();

    // ── Toast
    var toast = document.createElement('div');
    toast.className = 've-toast'; toast.id = 've-toast';
    document.body.appendChild(toast); ve.toastEl = toast;

    // ── Document-level events (NO capture layer)
    document.addEventListener('mousemove', onDocMouseMove, true);
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('mouseup',   onDocMouseUp);
    document.addEventListener('keydown',   onKeyDown);
    window.addEventListener('scroll', syncOverlays, true);
    window.addEventListener('resize', syncOverlays);

    document.body.classList.add('ve-mode-select');

    showToast('انقر على أي عنصر لتعديله');
  };

  // Banner buttons
  global.veSetMode     = function(m) { setMode(m); };
  global.veUndoLast    = function()  { undoLast(); };
  global.veRedoLast    = function()  { redoLast(); };
  global.veOpenSubmit  = function()  { openSubmitModal(); };
  global.veCloseEditor = function()  {
    if (ve.changes.length && !confirm('إغلاق المحرر؟ سيتم التراجع عن كل التعديلات.')) return;
    closeEditor(true);
  };
  global.veQtbParent = function() {
    if (ve.selectedEl && ve.selectedEl.parentElement && ve.selectedEl.parentElement !== document.body)
      selectElement(ve.selectedEl.parentElement);
  };
  global.veQtbHide = function() {
    if (!ve.selectedEl) return;
    var old = ve.selectedEl.style.visibility || '';
    ve.selectedEl.style.visibility = 'hidden';
    recordChange('style', ve.selectedEl, 'visibility', old, 'hidden', 'إخفاء: '+elLabel(ve.selectedEl));
    showToast('تم إخفاء العنصر');
  };
  global.veQtbReset = function() {
    if (!ve.selectedEl) return;
    ['transform','width','height','fontSize','fontWeight','color','backgroundColor',
     'padding','margin','border','opacity','visibility','borderRadius','boxShadow'
    ].forEach(function(p) { ve.selectedEl.style[p] = ''; });
    showToast('تمت إعادة الضبط');
    syncOverlays(); buildSidebarContent();
  };

  // ══════════════════════════════════════════════════════════════
  //  SHARED NAVBAR FUNCTIONS  —  loaded on every page
  //  Theme system: [data-theme="dark"] on <html> = dark mode
  //                no attribute (or removed)     = light mode
  // ══════════════════════════════════════════════════════════════

  var _SUN_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var _MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  // Central toggle — used by all pages via this global function
  global.toggleTheme = function() {
    var html    = document.documentElement;
    var isDark  = html.getAttribute('data-theme') === 'dark';
    var btn     = document.getElementById('themeToggle');

    if (isDark) {
      // Switch to LIGHT
      html.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      if (btn) { btn.innerHTML = _SUN_SVG; }
    } else {
      // Switch to DARK
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      if (btn) { btn.innerHTML = _MOON_SVG; }
    }

    if (btn) {
      btn.classList.add('spinning');
      setTimeout(function() { btn.classList.remove('spinning'); }, 500);
    }
  };

  // Sync toggle button icon to current theme
  (function syncToggleIcon() {
    var btn    = document.getElementById('themeToggle');
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (btn) btn.innerHTML = isDark ? _MOON_SVG : _SUN_SVG;
  })();

  // ── Dropdown ──────────────────────────────────────────────────
  global.toggleUserDropdown = function(e) {
    if (e) e.stopPropagation();
    var dd = document.getElementById('userDropdown');
    if (dd) dd.classList.toggle('open');
  };
  document.addEventListener('click', function(e) {
    var dd = document.getElementById('userDropdown');
    if (dd && dd.classList.contains('open') && !dd.contains(e.target)) {
      dd.classList.remove('open');
    }
  });

  document.addEventListener('DOMContentLoaded', function() {

    // Sync toggle icon again after DOM ready (in case icon rendered before script)
    var btn    = document.getElementById('themeToggle');
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (btn) btn.innerHTML = isDark ? _MOON_SVG : _SUN_SVG;

    // ── Clock ─────────────────────────────────────────────────
    if (!window._navClockStarted) {
      window._navClockStarted = true;
      var clockEl = document.getElementById('clock');
      var dateEl  = document.getElementById('dateDisplay');
      if (clockEl || dateEl) {
        function navTick() {
          var now = new Date();
          if (clockEl) clockEl.textContent = now.toLocaleTimeString('ar-EG-u-nu-latn', { hour12: false });
          if (dateEl)  dateEl.textContent  = now.toLocaleDateString('ar-EG-u-nu-latn', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          });
        }
        navTick();
        setInterval(navTick, 1000);
      }
    }

    // ── تحميل بيانات المستخدم من الـ session (مرة واحدة لكل صفحة) ──
    if (!window._currentUser) {
      fetch('/api/me/', { credentials: 'same-origin' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (data && data.success) {
            window._currentUser = {
              username: data.username,
              name:     data.name,
              role:     data.role,
              roleName: data.roleName,
              id:       data.id,
            };
            // تحديث عناصر الـ navbar
            var nameEl = document.getElementById('userDisplayName');
            var roleEl = document.getElementById('userDisplayRole');
            var mnEl   = document.getElementById('ud-menu-name');
            var mrEl   = document.getElementById('ud-menu-role');
            if (nameEl) nameEl.textContent = data.name     || data.username;
            if (roleEl) roleEl.textContent = data.roleName || data.role;
            if (mnEl)   mnEl.textContent   = data.name     || data.username;
            if (mrEl)   mrEl.textContent   = data.roleName || data.role;
          }
        })
        .catch(function() {});
    }

    // ── Sync user name/role into ud-menu (fallback for pre-filled elements) ──
    function syncUdMenu() {
      var name = document.getElementById('userDisplayName');
      var role = document.getElementById('userDisplayRole');
      var mn   = document.getElementById('ud-menu-name');
      var mr   = document.getElementById('ud-menu-role');
      if (name && mn && name.textContent.trim() && name.textContent.trim() !== '---')
        mn.textContent = name.textContent;
      if (role && mr && role.textContent.trim() && role.textContent.trim() !== '---')
        mr.textContent = role.textContent;
    }
    syncUdMenu();
    var nameEl = document.getElementById('userDisplayName');
    var roleEl = document.getElementById('userDisplayRole');
    if (nameEl || roleEl) {
      var obs = new MutationObserver(syncUdMenu);
      var cfg = { childList: true, characterData: true, subtree: true };
      if (nameEl) obs.observe(nameEl, cfg);
      if (roleEl) obs.observe(roleEl, cfg);
    }

  });

})(window);
