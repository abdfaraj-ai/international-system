/**
 * FLOATING CALCULATOR WIDGET — PREMIUM v2
 * • Double-Space  → open/close
 * • Ctrl+C        → copy result
 * • Ctrl+V        → paste number
 * • Draggable     • No overlay  • Light/Dark
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════
     CSS
  ═══════════════════════════════════════════ */
  const CSS = `
/* ── Panel shell ── */
.calc-panel{
  position:fixed;bottom:28px;left:28px;
  width:280px;
  background:linear-gradient(175deg,#131c2e 0%,#0d1421 60%,#0a1018 100%);
  border:1px solid rgba(50,184,198,0.24);
  border-radius:22px;
  box-shadow:
    0 24px 70px rgba(0,0,0,0.65),
    0 0 0 1px rgba(255,255,255,0.04),
    inset 0 1px 0 rgba(255,255,255,0.07),
    0 0 60px rgba(50,184,198,0.05);
  z-index:10000;user-select:none;
  display:none;flex-direction:column;overflow:hidden;
}
.calc-panel.calc-visible{
  display:flex;
  animation:calc-pop .22s cubic-bezier(.34,1.56,.64,1);
}
@keyframes calc-pop{
  from{opacity:0;transform:scale(.88) translateY(14px);}
  to  {opacity:1;transform:none;}
}
.calc-panel.calc-minimized .calc-body{display:none;}

/* ── Header ── */
.calc-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 14px;
  background:linear-gradient(120deg,rgba(50,184,198,0.18) 0%,rgba(50,184,198,0.04) 100%);
  border-bottom:1px solid rgba(50,184,198,0.15);
  cursor:move;flex-shrink:0;position:relative;overflow:hidden;
}
.calc-header::after{
  content:'';position:absolute;top:-30px;right:-20px;
  width:80px;height:80px;border-radius:50%;
  background:radial-gradient(circle,rgba(50,184,198,0.12),transparent 70%);
  pointer-events:none;
}
.calc-hdr-left{display:flex;align-items:center;gap:9px;z-index:1;}
.calc-hdr-icon{
  width:30px;height:30px;border-radius:9px;
  background:linear-gradient(135deg,#32b8c6,#0891b2);
  box-shadow:0 3px 10px rgba(50,184,198,0.35);
  display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;
}
.calc-hdr-title{font-size:13px;font-weight:900;color:#e9edef;letter-spacing:.2px;}
.calc-hdr-sub{font-size:9px;color:rgba(50,184,198,0.7);font-weight:600;margin-top:1px;}
.calc-hdr-btns{display:flex;gap:5px;z-index:1;}
.calc-hbtn{
  width:24px;height:24px;border-radius:7px;
  border:1px solid rgba(255,255,255,0.1);
  background:rgba(255,255,255,0.07);
  color:rgba(255,255,255,0.45);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;font-size:13px;font-weight:700;
  transition:all .15s;line-height:1;
}
.calc-hbtn:hover{background:rgba(255,255,255,0.15);color:#fff;}
.calc-hbtn-close:hover{background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.35);color:#f87171;}

/* ── Body ── */
.calc-body{padding:14px;display:flex;flex-direction:column;gap:11px;}

/* ── Display ── */
.calc-display{
  background:linear-gradient(160deg,rgba(0,0,0,0.45),rgba(0,0,0,0.3));
  border:1px solid rgba(255,255,255,0.08);
  border-radius:15px;
  padding:12px 14px 14px;
  direction:ltr;position:relative;
  box-shadow:inset 0 2px 8px rgba(0,0,0,0.3);
}
.calc-expr{
  font-size:11px;color:rgba(50,184,198,0.5);
  min-height:15px;margin-bottom:4px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:'Courier New',monospace;letter-spacing:.3px;
  text-align:right;direction:ltr;
}
.calc-num{
  font-size:32px;font-weight:900;
  color:#ffffff;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  line-height:1.1;text-align:right;direction:ltr;
  text-shadow:0 0 20px rgba(50,184,198,0.2);
  font-variant-numeric:tabular-nums;
  letter-spacing:-.5px;
}
.calc-num.calc-num-small{font-size:22px;}

/* Copy/Paste strip */
.calc-cp-strip{
  display:flex;align-items:center;justify-content:flex-end;
  gap:5px;margin-top:7px;
  border-top:1px solid rgba(255,255,255,0.06);
  padding-top:7px;
}
.calc-cp-btn{
  display:flex;align-items:center;gap:4px;
  padding:3px 9px;
  border-radius:7px;
  border:1px solid rgba(255,255,255,0.1);
  background:rgba(255,255,255,0.05);
  color:rgba(255,255,255,0.45);
  font-family:inherit;font-size:10px;font-weight:700;
  cursor:pointer;transition:all .15s;
}
.calc-cp-btn:hover{background:rgba(50,184,198,0.12);border-color:rgba(50,184,198,0.3);color:#32b8c6;}
.calc-copy-toast{
  position:absolute;top:10px;left:50%;transform:translateX(-50%);
  background:rgba(50,184,198,0.9);color:#071318;
  font-size:10px;font-weight:900;padding:3px 12px;border-radius:20px;
  pointer-events:none;opacity:0;transition:opacity .2s;white-space:nowrap;
}
.calc-copy-toast.show{opacity:1;}

/* ── Grid ── */
.calc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;}

.c-btn{
  height:54px;border-radius:13px;border:none;
  font-family:inherit;font-size:17px;font-weight:800;
  cursor:pointer;transition:all .12s cubic-bezier(.4,0,.2,1);
  display:flex;align-items:center;justify-content:center;
  position:relative;overflow:hidden;
}
.c-btn::after{
  content:'';position:absolute;inset:0;border-radius:inherit;
  background:rgba(255,255,255,0);transition:background .1s;
}
.c-btn:hover::after{background:rgba(255,255,255,0.06);}
.c-btn:active{transform:scale(.88);}
.c-btn:active::after{background:rgba(0,0,0,0.1);}

/* Number */
.c-num{
  background:linear-gradient(160deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05));
  color:#e2e8f0;
  border:1px solid rgba(255,255,255,0.09);
  box-shadow:0 1px 3px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.06);
}
.c-num:hover{background:linear-gradient(160deg,rgba(255,255,255,0.14),rgba(255,255,255,0.08));}

/* Operator */
.c-op{
  background:linear-gradient(160deg,rgba(50,184,198,0.18),rgba(50,184,198,0.08));
  color:#4ecbd9;
  border:1px solid rgba(50,184,198,0.22);
  box-shadow:0 1px 3px rgba(0,0,0,0.2),inset 0 1px 0 rgba(50,184,198,0.1);
}
.c-op:hover{background:linear-gradient(160deg,rgba(50,184,198,0.28),rgba(50,184,198,0.14));color:#32b8c6;}
.c-op-active{
  background:linear-gradient(160deg,rgba(50,184,198,0.35),rgba(50,184,198,0.2))!important;
  color:#32b8c6!important;
  border-color:rgba(50,184,198,0.55)!important;
  box-shadow:0 0 14px rgba(50,184,198,0.25)!important;
}

/* Equals */
.c-eq{
  background:linear-gradient(145deg,#32b8c6 0%,#0891b2 100%);
  color:#071318;font-size:22px;font-weight:900;
  box-shadow:0 4px 16px rgba(50,184,198,0.3),inset 0 1px 0 rgba(255,255,255,0.2);
  border:none;
}
.c-eq:hover{box-shadow:0 6px 22px rgba(50,184,198,0.5);}

/* Clear */
.c-clr{
  background:linear-gradient(160deg,rgba(239,68,68,0.14),rgba(239,68,68,0.07));
  color:#f87171;
  border:1px solid rgba(239,68,68,0.22);
  box-shadow:0 1px 3px rgba(0,0,0,0.2);
}
.c-clr:hover{background:linear-gradient(160deg,rgba(239,68,68,0.25),rgba(239,68,68,0.14));}

/* Util (±, %) */
.c-util{
  background:linear-gradient(160deg,rgba(148,163,184,0.1),rgba(148,163,184,0.05));
  color:rgba(255,255,255,0.55);
  border:1px solid rgba(255,255,255,0.09);
}
.c-util:hover{background:linear-gradient(160deg,rgba(148,163,184,0.18),rgba(148,163,184,0.1));color:#fff;}

.c-zero{grid-column:span 2;}

/* Shortcut hint */
.calc-hint{
  text-align:center;font-size:9.5px;
  color:rgba(255,255,255,0.18);font-weight:600;
  padding:0 0 2px;letter-spacing:.3px;
}

/* ── Light Mode (default — no dark attr) ── */
html:not([data-theme="dark"]) .calc-panel{
  background:linear-gradient(175deg,#f8fafd 0%,#eef3f9 100%);
  border-color:rgba(50,184,198,0.3);
  box-shadow:0 24px 70px rgba(0,28,60,0.18),0 0 0 1px rgba(0,28,60,0.04);
}
html:not([data-theme="dark"]) .calc-header{
  background:linear-gradient(120deg,rgba(50,184,198,0.12),rgba(50,184,198,0.03));
  border-bottom-color:rgba(50,184,198,0.15);
}
html:not([data-theme="dark"]) .calc-hdr-title{color:#0f172a;}
html:not([data-theme="dark"]) .calc-hbtn{border-color:rgba(0,28,60,0.12);background:rgba(0,28,60,0.04);color:#64748b;}
html:not([data-theme="dark"]) .calc-hbtn:hover{background:rgba(0,28,60,0.08);color:#0f172a;}
html:not([data-theme="dark"]) .calc-display{
  background:linear-gradient(160deg,#e8f0f8,#eef4fb);
  border-color:rgba(0,28,60,0.1);
  box-shadow:inset 0 2px 6px rgba(0,28,60,0.06);
}
html:not([data-theme="dark"]) .calc-expr{color:rgba(8,145,178,0.6);}
html:not([data-theme="dark"]) .calc-num{color:#0f172a;text-shadow:none;}
html:not([data-theme="dark"]) .calc-cp-btn{border-color:rgba(0,28,60,0.1);background:rgba(0,28,60,0.04);color:#64748b;}
html:not([data-theme="dark"]) .calc-cp-btn:hover{background:rgba(50,184,198,0.1);border-color:rgba(50,184,198,0.3);color:#0891b2;}
html:not([data-theme="dark"]) .calc-cp-strip{border-top-color:rgba(0,28,60,0.07);}
html:not([data-theme="dark"]) .c-num{
  background:linear-gradient(160deg,#ffffff,#f4f8fc);
  color:#1e293b;border-color:rgba(0,28,60,0.1);
  box-shadow:0 1px 3px rgba(0,28,60,0.08),inset 0 1px 0 rgba(255,255,255,0.8);
}
html:not([data-theme="dark"]) .c-num:hover{background:linear-gradient(160deg,#f0f6ff,#e8f2fc);}
html:not([data-theme="dark"]) .c-op{
  background:linear-gradient(160deg,rgba(50,184,198,0.12),rgba(50,184,198,0.06));
  border-color:rgba(50,184,198,0.2);
}
html:not([data-theme="dark"]) .c-util{
  background:linear-gradient(160deg,rgba(0,28,60,0.06),rgba(0,28,60,0.03));
  color:#475569;border-color:rgba(0,28,60,0.1);
}
html:not([data-theme="dark"]) .c-util:hover{background:rgba(0,28,60,0.1);color:#0f172a;}
html:not([data-theme="dark"]) .c-clr{
  background:linear-gradient(160deg,rgba(239,68,68,0.09),rgba(239,68,68,0.04));
  border-color:rgba(239,68,68,0.18);
}
html:not([data-theme="dark"]) .calc-hint{color:rgba(0,28,60,0.22);}

/* ── Trigger button ── */
.calc-trigger-btn{
  display:flex;align-items:center;gap:7px;
  padding:7px 14px 7px 10px;border-radius:10px;
  border:1px solid rgba(50,184,198,0.2);
  background:rgba(50,184,198,0.07);color:#32b8c6;
  font-family:inherit;font-size:12px;font-weight:800;
  cursor:pointer;transition:all .2s;white-space:nowrap;
}
.calc-trigger-btn:hover{background:rgba(50,184,198,0.16);border-color:rgba(50,184,198,0.38);box-shadow:0 2px 10px rgba(50,184,198,0.18);}
`;

  /* ═══════════════════════════════════════════
     HTML
  ═══════════════════════════════════════════ */
  const HTML = `
<div id="calc-panel" class="calc-panel">
  <div class="calc-header" id="calc-drag">
    <div class="calc-hdr-left">
      <div class="calc-hdr-icon">🧮</div>
      <div>
        <div class="calc-hdr-title">الحاسبة</div>
        <div class="calc-hdr-sub">مسافة×2 للفتح</div>
      </div>
    </div>
    <div class="calc-hdr-btns">
      <button class="calc-hbtn" id="calc-min" title="تصغير">−</button>
      <button class="calc-hbtn calc-hbtn-close" id="calc-close" title="إغلاق">✕</button>
    </div>
  </div>

  <div class="calc-body" id="calc-body">

    <!-- Display -->
    <div class="calc-display">
      <div class="calc-copy-toast" id="calc-toast">تم النسخ ✓</div>
      <div class="calc-expr" id="calc-expr"></div>
      <div class="calc-num"  id="calc-num">0</div>
      <div class="calc-cp-strip">
        <button class="calc-cp-btn" id="calc-paste-btn" title="لصق (Ctrl+V)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
          لصق
        </button>
        <button class="calc-cp-btn" id="calc-copy-btn" title="نسخ النتيجة (Ctrl+C)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          نسخ
        </button>
      </div>
    </div>

    <!-- Buttons -->
    <div class="calc-grid">
      <button class="c-btn c-clr"  onclick="calcIn('C')">C</button>
      <button class="c-btn c-util" onclick="calcIn('back')">⌫</button>
      <button class="c-btn c-util" onclick="calcIn('%')">%</button>
      <button class="c-btn c-op"   id="cop-/" onclick="calcIn('/')">÷</button>

      <button class="c-btn c-num"  onclick="calcIn('7')">7</button>
      <button class="c-btn c-num"  onclick="calcIn('8')">8</button>
      <button class="c-btn c-num"  onclick="calcIn('9')">9</button>
      <button class="c-btn c-op"   id="cop-*" onclick="calcIn('*')">×</button>

      <button class="c-btn c-num"  onclick="calcIn('4')">4</button>
      <button class="c-btn c-num"  onclick="calcIn('5')">5</button>
      <button class="c-btn c-num"  onclick="calcIn('6')">6</button>
      <button class="c-btn c-op"   id="cop--" onclick="calcIn('-')">−</button>

      <button class="c-btn c-num"  onclick="calcIn('1')">1</button>
      <button class="c-btn c-num"  onclick="calcIn('2')">2</button>
      <button class="c-btn c-num"  onclick="calcIn('3')">3</button>
      <button class="c-btn c-op"   id="cop-+" onclick="calcIn('+')">+</button>

      <button class="c-btn c-num c-zero" onclick="calcIn('0')">0</button>
      <button class="c-btn c-util"       onclick="calcIn('.')">.</button>
      <button class="c-btn c-eq"         onclick="calcIn('=')">=</button>
    </div>

    <div class="calc-hint">Space×2 — فتح/إغلاق &nbsp;•&nbsp; Ctrl+C نسخ &nbsp;•&nbsp; Ctrl+V لصق</div>
  </div>
</div>`;

  /* ═══════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════ */
  let _s = { cur:'0', prev:null, op:null, fresh:true, expr:'' };

  /* ═══════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════ */
  function _calc(a,b,op){
    a=parseFloat(a); b=parseFloat(b); let r;
    if(op==='+') r=a+b;
    else if(op==='-') r=a-b;
    else if(op==='*') r=a*b;
    else if(op==='/') r=b!==0?a/b:'خطأ';
    if(typeof r==='number') r=Math.round(r*1e10)/1e10;
    return r;
  }
  function _sym(op){ return {'+':'+','-':'−','*':'×','/':'÷'}[op]||op; }
  function _fmt(n){
    const s=String(n);
    if(s==='خطأ'||s.includes('e')||s.includes('n')) return s;
    const p=s.split('.');
    p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
    return p.join('.');
  }
  function _rawNum(){ return _s.cur; }
  function _opHL(op){
    ['+','-','*','/'].forEach(o=>{
      const b=document.getElementById('cop-'+o);
      if(b) b.classList.toggle('c-op-active', o===op);
    });
  }
  function _refresh(){
    const nd=document.getElementById('calc-num');
    const ed=document.getElementById('calc-expr');
    if(!nd) return;
    const txt=_fmt(_s.cur);
    nd.textContent=txt;
    nd.className='calc-num'+(txt.length>10?' calc-num-small':'');
    ed.textContent=_s.expr;
  }

  /* ═══════════════════════════════════════════
     COPY / PASTE
  ═══════════════════════════════════════════ */
  function _showToast(){
    const t=document.getElementById('calc-toast');
    if(!t) return;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid=setTimeout(()=>t.classList.remove('show'),1400);
  }

  function _copyResult(){
    const raw=_s.cur.replace(/,/g,'');
    if(navigator.clipboard){
      navigator.clipboard.writeText(raw).then(_showToast).catch(()=>{});
    } else {
      const ta=document.createElement('textarea');
      ta.value=raw; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
      _showToast();
    }
  }

  function _pasteNumber(){
    if(navigator.clipboard && navigator.clipboard.readText){
      navigator.clipboard.readText().then(txt=>{
        const n=parseFloat(txt.replace(/,/g,'').trim());
        if(!isNaN(n)){ _s.cur=String(n); _s.fresh=false; _refresh(); }
      }).catch(()=>{});
    }
  }

  /* ═══════════════════════════════════════════
     INPUT
  ═══════════════════════════════════════════ */
  window.calcIn = function(v){
    if(v==='C'){
      _s={cur:'0',prev:null,op:null,fresh:true,expr:''};
      _opHL(null);
    } else if(v==='back'){
      if(_s.cur.length>1) _s.cur=_s.cur.slice(0,-1);
      else _s.cur='0';
    } else if(v==='pm'){
      const n=parseFloat(_s.cur);
      if(!isNaN(n)) _s.cur=String(n*-1);
    } else if(v==='%'){
      const n=parseFloat(_s.cur);
      if(!isNaN(n)) _s.cur=String(n/100);
    } else if(['+','-','*','/'].includes(v)){
      if(_s.prev!==null && !_s.fresh){
        const r=_calc(_s.prev,_s.cur,_s.op);
        _s.cur=String(r); _s.prev=parseFloat(r);
      } else {
        _s.prev=parseFloat(_s.cur);
      }
      _s.op=v; _s.fresh=true;
      _s.expr=_fmt(_s.prev)+' '+_sym(v);
      _opHL(v);
    } else if(v==='='){
      if(_s.prev!==null && _s.op){
        _s.expr=_fmt(_s.prev)+' '+_sym(_s.op)+' '+_fmt(_s.cur)+' =';
        const r=_calc(_s.prev,_s.cur,_s.op);
        _s.cur=String(r); _s.prev=null; _s.op=null; _s.fresh=true;
        _opHL(null);
      }
    } else if(v==='.'){
      if(_s.fresh){_s.cur='0.';_s.fresh=false;}
      else if(!_s.cur.includes('.')) _s.cur+='.';
    } else {
      if(_s.fresh||_s.cur==='0'){_s.cur=v;_s.fresh=false;}
      else if(_s.cur.replace(/[^0-9]/g,'').length<14) _s.cur+=v;
    }
    _refresh();
  };

  /* ═══════════════════════════════════════════
     TOGGLE (public)
  ═══════════════════════════════════════════ */
  window.toggleCalc = function(){
    const p=document.getElementById('calc-panel');
    if(!p) return;
    const on=p.classList.contains('calc-visible');
    p.classList.toggle('calc-visible',!on);
    if(!on) p.classList.remove('calc-minimized');
  };

  /* ═══════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════ */
  function init(){
    /* inject styles */
    const s=document.createElement('style');
    s.textContent=CSS; document.head.appendChild(s);

    /* inject panel */
    document.body.insertAdjacentHTML('beforeend',HTML);
    const panel=document.getElementById('calc-panel');

    /* header buttons */
    document.getElementById('calc-close').addEventListener('click',()=>panel.classList.remove('calc-visible'));
    document.getElementById('calc-min').addEventListener('click',()=>{
      const m=panel.classList.toggle('calc-minimized');
      document.getElementById('calc-min').textContent=m?'+':'−';
    });
    document.getElementById('calc-copy-btn').addEventListener('click',_copyResult);
    document.getElementById('calc-paste-btn').addEventListener('click',_pasteNumber);

    /* drag */
    const handle=document.getElementById('calc-drag');
    let drag=false,ox=0,oy=0;
    handle.addEventListener('mousedown',e=>{
      if(e.target.closest('.calc-hbtn')) return;
      drag=true;
      const r=panel.getBoundingClientRect();
      ox=e.clientX-r.left; oy=e.clientY-r.top;
      panel.style.transition='none';
    });
    document.addEventListener('mousemove',e=>{
      if(!drag) return;
      const x=Math.max(0,Math.min(window.innerWidth-panel.offsetWidth,e.clientX-ox));
      const y=Math.max(0,Math.min(window.innerHeight-panel.offsetHeight,e.clientY-oy));
      panel.style.left=x+'px'; panel.style.top=y+'px';
      panel.style.right='auto'; panel.style.bottom='auto';
    });
    document.addEventListener('mouseup',()=>{ drag=false; panel.style.transition=''; });

    /* ── Double-Space → open/close ── */
    let _lastSpace=0;
    document.addEventListener('keydown',e=>{
      const tag=(document.activeElement||{}).tagName||'';
      const inField=tag==='INPUT'||tag==='TEXTAREA'||document.activeElement.isContentEditable;

      /* Double-space shortcut — works even from outside calc */
      if(e.code==='Space' && !inField){
        const now=Date.now();
        if(now-_lastSpace<420){
          e.preventDefault();
          toggleCalc();
          _lastSpace=0; return;
        }
        _lastSpace=now;
      }

      /* Keys below only act when calc is visible */
      if(!panel.classList.contains('calc-visible')) return;

      /* Ctrl+C → copy */
      if(e.key==='c' && (e.ctrlKey||e.metaKey) && !inField){
        e.preventDefault(); _copyResult(); return;
      }
      /* Ctrl+V → paste */
      if(e.key==='v' && (e.ctrlKey||e.metaKey) && !inField){
        e.preventDefault(); _pasteNumber(); return;
      }

      if(inField) return;

      const map={
        '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
        '+':'+','-':'-','*':'*','/':'/','Enter':'=','=':'=','Backspace':'back','.':'.',',':'.'
      };
      if(map[e.key]){ e.preventDefault(); calcIn(map[e.key]); }
      else if(e.key==='Escape') panel.classList.remove('calc-visible');
      else if(e.key==='Delete'){ e.preventDefault(); calcIn('C'); }
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
