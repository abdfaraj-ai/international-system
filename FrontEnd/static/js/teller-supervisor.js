// ═══════════════════════════════════════════
// مزامنة localStorage — الجسر مع صفحة التلرات
// ═══════════════════════════════════════════
const LS_SV_TELLERS  = 'intl_sv_tellers';
const LS_REQUESTS    = 'intl_teller_requests';
const LS_SV_OPS      = 'intl_sv_ops';
const LS_SV_BALANCES = 'intl_sv_balances';
const LS_PERMS       = 'intl_teller_perms';

function _svSave(key,data){try{localStorage.setItem(key,JSON.stringify(data))}catch(e){}}
function _svLoad(key,fallback){try{const r=localStorage.getItem(key);return r?JSON.parse(r):fallback}catch(e){return fallback}}

function _saveTellers(){_svSave(LS_SV_TELLERS,tellers)}
function _saveRequests(){_svSave(LS_REQUESTS,requests)}
function _saveOps(){_svSave(LS_SV_OPS,operations)}

function _loadTellers(silent){
    // جلب من الخادم أولاً، fallback إلى localStorage
    fetch('/api/sv2/tellers')
        .then(r=>{
            if(!r.ok) throw new Error('HTTP '+r.status);
            return r.json();
        })
        .then(resp=>{
            if(resp.success&&Array.isArray(resp.tellers)){
                tellers.length=0;
                resp.tellers.forEach(t=>tellers.push(t));
                _saveTellers();
                renderTellers();
                populateTellerSelects();
                updateStats();
            } else {
                throw new Error('bad response');
            }
        })
        .catch(()=>{
            // fallback من localStorage
            const saved=_svLoad(LS_SV_TELLERS,null);
            if(saved&&Array.isArray(saved)&&saved.length>0){
                tellers.length=0;saved.forEach(t=>tellers.push(t));
                renderTellers();populateTellerSelects();updateStats();
                if(!silent) showToast('لا اتصال بالخادم — جارٍ عرض البيانات المحفوظة محلياً','warning','📴');
            } else {
                if(!silent) showToast('تعذّر جلب قائمة التلرات من الخادم','error','❌');
            }
        });
}

// إرسال PATCH لتحديث حقول التلر في الخادم
function _patchTeller(username, fields){
    const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
    fetch('/api/sv2/tellers/'+encodeURIComponent(username),{
        method:'PATCH',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body:JSON.stringify(fields)
    }).catch(()=>{});
}
function _loadRequests(){
    // جلب الطلبات من الخادم أولاً
    fetch('/api/sv2/requests?filter=all')
        .then(r=>r.json())
        .then(resp=>{
            if(resp.success&&Array.isArray(resp.requests)){
                requests.length=0;
                resp.requests.forEach(r=>requests.push(r));
                // تحديث localStorage كـ cache
                try{localStorage.setItem(LS_REQUESTS,JSON.stringify(requests));}catch(e){}
                renderRequests();updateStats();
            }
        })
        .catch(()=>{
            // fallback: localStorage
            const saved=_svLoad(LS_REQUESTS,null);
            if(saved&&Array.isArray(saved)){requests.length=0;saved.forEach(r=>requests.push(r));}
        });
}
function _mergeOpsFromLS(){
    const lsOps=_svLoad(LS_SV_OPS,[]);
    lsOps.forEach(op=>{if(!operations.find(x=>x.id===op.id))operations.unshift(op)});
    operations.sort((a,b)=>(b.time||'').localeCompare(a.time||''));
}

// استماع للتحديثات الفورية من صفحة التلرات
window.addEventListener('storage',function(e){
    if(e.key===LS_REQUESTS&&e.newValue){
        try{
            const nr=JSON.parse(e.newValue);
            requests.length=0;nr.forEach(r=>requests.push(r));
            renderRequests();updateStats();
            const newPending=requests.filter(r=>r.status==='pending');
            if(newPending.length>0)showToast('طلب جديد من أحد التلرات: '+newPending[0].tellerName,'warning','🔔');
        }catch(err){}
    }
    if(e.key===LS_SV_OPS&&e.newValue){
        try{
            _mergeOpsFromLS();
            if(document.getElementById('sec-operations').classList.contains('active'))renderOps();
        }catch(err){}
    }
    if(e.key==='intl_sv_close_notify'&&e.newValue){
        try{
            const n=JSON.parse(e.newValue);
            const t=tellers.find(x=>(x.username||x.name)===n.tellerUsername);
            const name=t?t.name:n.tellerUsername;
            const icon=n.diffTotal<0.01?'✅':'⚠️';
            showToast(`${icon} ${name} أغلق الصندوق — ${n.status}`,'success','🔒');
            renderTellers();
        }catch(err){}
    }
});

// ═══════════════════════════════════════════
// البيانات
// ═══════════════════════════════════════════
const SYMBOLS = {USD:'$',ILS:'₪',EUR:'€',JOD:'JD',GBP:'£'};
const CURRENCY_AR = {USD:'دولار',ILS:'شيكل',EUR:'يورو',JOD:'دينار',GBP:'جنيه'};

let tellers = [];
let balanceLogs = [];
let operations = [];
let requests = [];

let bankPrices = {USD:{buy:3.60,sell:3.64},EUR:{buy:3.92,sell:3.97},JOD:{buy:5.08,sell:5.14},GBP:{buy:4.55,sell:4.61}};
let cashPrices = {USD:{buy:3.58,sell:3.66},EUR:{buy:3.90,sell:3.99},JOD:{buy:5.06,sell:5.16},GBP:{buy:4.53,sell:4.63}};

var pricingCurrencies = [
    {code:'USD',name:'دولار أمريكي',flag:'🇺🇸'},
    {code:'EUR',name:'يورو',flag:'🇪🇺'},
    {code:'JOD',name:'دينار أردني',flag:'🇯🇴'},
    {code:'GBP',name:'جنيه إسترليني',flag:'🇬🇧'},
];

let pendingBalance = null;
let replyTargetId = null;

// ═══════════════════════════════════════════
// الساعة
// ═══════════════════════════════════════════
function updateClock(){const n=new Date();var c=document.getElementById('clock');var d=document.getElementById('date');if(c)c.textContent=n.toLocaleTimeString('ar-EG-u-nu-latn',{hour12:false});if(d)d.textContent=n.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
setInterval(updateClock,1000);updateClock();

// ═══════════════════════════════════════════
// التنقل
// ═══════════════════════════════════════════
function switchPage(page){
    document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.getElementById('sec-'+page).classList.add('active');
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
    if(page==='operations')renderOps();
    if(page==='requests')renderRequests();
    if(page==='admin-msgs')svRenderInstructions();
}

// ═══════════════════════════════════════════
// إدارة التلرات
// ═══════════════════════════════════════════
function _getLastClosingReport(username){
    try{
        const reports=JSON.parse(localStorage.getItem('intl_sv_closing_reports')||'[]');
        return reports.find(r=>r.teller===username)||null;
    }catch(e){return null;}
}
function _renderClosingReportCard(report, tellerUsername){
    if(!report) return '';
    const diff=report.diff||{};
    const diffTotal=Math.abs(diff.USD||0)+Math.abs((diff.ILS||0)/3.62)+Math.abs((diff.JOD||0)/0.709);
    const matched=diffTotal<0.01;
    const btnCls=matched?'':'has-diff';
    const badgeCls=matched?'matched':'diff';
    const badgeTxt=matched?'✅ متطابق':`⚠️ فارق $${diffTotal.toFixed(2)}`;
    return `<div class="cr-btn-wrap">
        <button class="cr-open-btn ${btnCls}" onclick="openClosingReportModal('${tellerUsername}')">
            <div class="cr-open-btn-left">
                <div class="cr-open-btn-icon">📋</div>
                <span>تقرير الصندوق الختامي</span>
                <span class="cr-open-btn-badge ${badgeCls}">${badgeTxt}</span>
            </div>
            <span class="cr-open-btn-arrow">◀</span>
        </button>
    </div>`;
}

function openClosingReportModal(tellerUsername){
    const report=_getLastClosingReport(tellerUsername);
    if(!report){showToast('لا يوجد تقرير متاح','warning','📋');return;}
    const t=tellers.find(x=>(x.username||x.name)===tellerUsername);
    const tellerName=t?t.name:tellerUsername;
    const diff=report.diff||{};
    const act=report.actualBalance||{};
    const exp=report.expectedBalance||{};
    const op=report.openingBalance||{};
    const diffTotal=Math.abs(diff.USD||0)+Math.abs((diff.ILS||0)/3.62)+Math.abs((diff.JOD||0)/0.709);
    const matched=diffTotal<0.01;
    // تعبئة الهيدر
    document.getElementById('crModalAvatar').textContent=tellerName[0]||'T';
    document.getElementById('crModalTellerName').textContent=tellerName;
    document.getElementById('crModalSessionId').textContent=report.id+' — '+new Date(report.closedAt||0).toLocaleDateString('ar-EG');
    const st=document.getElementById('crModalStatus');
    st.textContent=matched?'✅ صندوق متطابق':'⚠️ يوجد فارق';
    st.className='cr-modal-status '+(matched?'matched':'diff');
    // الوقت
    document.getElementById('crModalStart').textContent=report.startTime||'—';
    document.getElementById('crModalEnd').textContent=report.endTime||'—';
    document.getElementById('crModalOps').textContent=(report.opsCount||0)+' عملية';
    const dur=(()=>{try{const ms=new Date(report.closedAt)-new Date(report.startTimestamp||0);const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);return h>0?h+'س '+m+'د':m+' دقيقة';}catch(e){return '—';}})();
    document.getElementById('crModalDuration').textContent=dur;
    // عملات
    const curData=[{code:'USD',flag:'🇺🇸',sym:'$'},{code:'ILS',flag:'🇵🇸',sym:'₪'},{code:'JOD',flag:'🇯🇴',sym:'JD '}];
    document.getElementById('crModalCurrencies').innerHTML=curData.map(({code,flag,sym})=>{
        const a=act[code]||0, e=exp[code]||0, o=op[code]||0, d=diff[code]||0;
        const hasDiff=Math.abs(d)>0.01;
        const diffCls=hasDiff?(d>0?'diff-pos':'diff-neg'):'diff-zero';
        const diffTxt=hasDiff?((d>0?'+':'')+sym+Math.abs(d).toFixed(2)):'✓ مطابق';
        return `<div class="cr-modal-cur-row${hasDiff?' has-diff':''}">
            <span class="cr-modal-cur-flag">${flag}</span>
            <div class="cr-modal-cur-cell">
                <span class="cr-modal-cur-lbl">الأرصدة</span>
                <span class="cr-modal-cur-val actual" dir="ltr">${sym}${e.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            </div>
            <div class="cr-modal-cur-cell">
                <span class="cr-modal-cur-lbl">فعلي (عدّ)</span>
                <span class="cr-modal-cur-val actual" dir="ltr">${sym}${a.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            </div>
        </div>`;
    }).join('');
    // ملخص الفوارق
    const dr=document.getElementById('crModalDiffRow');
    dr.className='cr-modal-diff-row '+(matched?'matched':'diff');
    dr.innerHTML=matched
        ?`<span class="cr-modal-diff-text matched">✅ الصندوق متطابق — لا يوجد أي فوارق</span><span class="cr-modal-diff-sub">عمل ممتاز</span>`
        :`<span class="cr-modal-diff-text diff">⚠️ إجمالي الفارق ≈ $${diffTotal.toFixed(2)}</span><span class="cr-modal-diff-sub">يستلزم المراجعة</span>`;
    // الملاحظة
    const noteWrap=document.getElementById('crModalNote');
    const noteTxt=report.note||'';
    if(noteTxt){noteWrap.style.display='flex';document.getElementById('crModalNoteText').textContent=noteTxt;}
    else{noteWrap.style.display='none';}
    // افتح النافذة
    document.getElementById('crModal').classList.add('visible');
}
function closeCrModal(){document.getElementById('crModal').classList.remove('visible');}
function renderTellers(){
    const grid=document.getElementById('tellersGrid');
    const empty=document.getElementById('tellersEmptyState');
    if(empty) empty.style.display=tellers.length===0?'block':'none';
    grid.innerHTML=tellers.map(t=>{
        const pct=Math.min(100,Math.round((t.ops/50)*100));
        const isOnline=t.status==='online';
        const closingReport=_getLastClosingReport(t.username||t.name);
        return`<div class="tc2 ${t.status}">
            <!-- Header -->
            <div class="tc2-header">
                <div class="tc2-avatar-wrap">
                    <div class="tc2-avatar ${t.status}">${t.name[0]}</div>
                    ${isOnline?'<div class="tc2-pulse"></div><div class="tc2-online-dot"></div>':''}
                </div>
                <div class="tc2-identity">
                    <div class="tc2-name">${t.name}</div>
                    <div class="tc2-tid">${t.id}</div>
                </div>
                <div class="tc2-badge ${t.status}">${isOnline?'🟢 متصل':'🔴 غير متصل'}</div>
            </div>
            <!-- Main stats -->
            <div class="tc2-main-stats">
                <div class="tc2-stat" style="flex:2">
                    <div class="tc2-stat-lbl">رصيد الصندوق</div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:3px;">
                        ${[['USD','🇺🇸',t.balanceUSD||0],['ILS','🇵🇸',t.balanceILS||0],['JOD','🇯🇴',t.balanceJOD||0]].map(([cur,flag,val])=>{
                            const color = val>0?'#0d9488':'#CBD5E1';
                            return `<div style="text-align:center;min-width:60px;">
                                <div style="font-size:10px;color:#94A3B8;">${flag} ${cur}</div>
                                <div style="font-size:14px;font-weight:800;color:${color};">${Number(val).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
                <div class="tc2-stat-divider"></div>
                <div class="tc2-stat">
                    <div class="tc2-stat-lbl">عمليات اليوم</div>
                    <div class="tc2-stat-val v-ops">${t.ops}</div>
                </div>
            </div>
            <!-- Meta -->
            <div class="tc2-meta">
                <div class="tc2-meta-cell">
                    <span class="tc2-meta-lbl">🕐 وقت الدخول</span>
                    <span class="tc2-meta-val">${t.loginTime}</span>
                </div>
                <div class="tc2-meta-cell">
                    <span class="tc2-meta-lbl">⚡ آخر عملية</span>
                    <span class="tc2-meta-val">${t.lastOp}</span>
                </div>
            </div>
            <!-- Progress (online only) -->
            ${isOnline?`<div class="tc2-progress">
                <div class="tc2-progress-head">
                    <span class="tc2-prog-title">معدل الإنجاز اليومي</span>
                    <span class="tc2-prog-count">${t.ops} / 50 عملية</span>
                </div>
                <div class="tc2-prog-track">
                    <div class="tc2-prog-fill" style="width:${pct}%"></div>
                </div>
            </div>`:''}
            <!-- Actions -->
            <div class="tc2-actions">
                ${isOnline?`
                    <div class="tc2-row">
                        <button class="tc2-btn tc2-btn-bal" onclick="openBalanceForTeller('${t.name}')">💰 رصيد</button>
                        <button class="tc2-btn tc2-btn-log" onclick="viewTellerOps('${t.name}')">📜 عمليات</button>
                        <button class="tc2-btn tc2-btn-perm" onclick="openPermissions('${t.id||t.username||t.name}')">🔐 صلاحيات</button>
                    </div>
                    <button class="tc2-btn-exit" onclick="toggleTeller('${t.id||t.username||t.name}')">🚫 إخراج التلر من النظام</button>
                `:`
                    <div class="tc2-row">
                        <button class="tc2-btn-enter" onclick="toggleTeller('${t.id||t.username||t.name}')">✅ إدخال التلر للنظام</button>
                        <button class="tc2-btn-perm-sm" onclick="openPermissions('${t.id||t.username||t.name}')">🔐</button>
                        <button class="tc2-btn-perm-sm" onclick="openChangePwd('${t.username||t.name}','${t.name}')" title="تغيير كلمة المرور">🔑</button>
                        <button class="tc2-btn-perm-sm" onclick="deleteTeller('${t.username||t.name}')" style="background:rgba(248,113,113,0.12);border-color:rgba(248,113,113,0.3);color:#f87171" title="حذف التلر">🗑️</button>
                    </div>
                `}
            </div>
            ${_renderClosingReportCard(closingReport, t.username||t.name)}
        </div>`;
    }).join('');
    updateStats();
}

function toggleTeller(id){
    let t=tellers.find(x=>x.id===id);
    if(!t) t=tellers.find(x=>x.username===id||x.name===id);
    if(!t)return;
    if(t.status==='online'){
        t.status='offline'; t.balance=0; t.ops=0; t.loginTime='—'; t.lastOp='—';
        showToast(`تم إخراج ${t.name} من النظام`,'warning','🚫');
        _patchTeller(t.username||t.name,{status:'offline',balance:0,ops:0,loginTime:'—',lastOp:'—'});
    } else {
        const now=new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
        t.status='online'; t.loginTime=now; t.lastOp='—';
        showToast(`تم إدخال ${t.name} إلى النظام`,'success','✅');
        _patchTeller(t.username||t.name,{status:'online',loginTime:now,lastOp:'—'});
    }
    _saveTellers();
    renderTellers();
    populateTellerSelects();
}

function openBalanceForTeller(name){
    switchPage('balances');
    const sel=document.getElementById('balTeller');
    if(sel){for(let o of sel.options){if(o.text.startsWith(name)){o.selected=true;break}}}
    showToast('جاري فتح نموذج الرصيد لـ '+name,'info','💰');
}

function viewTellerOps(name){
    switchPage('operations');
    document.getElementById('filterTeller').value=name;
    renderOps();
}

function updateStats(){
    const online=tellers.filter(t=>t.status==='online');
    const offline=tellers.filter(t=>t.status==='offline');
    document.getElementById('sOnline').textContent=online.length;
    document.getElementById('sOffline').textContent=offline.length;
    const totalUSD=tellers.reduce((s,t)=>s+(t.balanceUSD||0),0);
    const totalILS=tellers.reduce((s,t)=>s+(t.balanceILS||0),0);
    const totalJOD=tellers.reduce((s,t)=>s+(t.balanceJOD||0),0);
    const el=document.getElementById('sTotalBal');
    if(el) el.innerHTML=`<span style="font-size:12px">$${totalUSD.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`+
        (totalILS?` <span style="font-size:11px;opacity:.7">₪${totalILS.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`:'');
    document.getElementById('sTotalOps').textContent=online.reduce((s,t)=>s+t.ops,0);
    const pendingCount=requests.filter(r=>r.status==='pending').length;
    document.getElementById('sPending').textContent=pendingCount;
    document.getElementById('headerOnline').textContent=`🟢 ${online.length} تلر متصل`;
    document.getElementById('reqBadge').textContent=pendingCount;
}

// ═══════════════════════════════════════════
// أرصدة الصناديق
// ═══════════════════════════════════════════
function populateTellerSelects(){
    // جميع التلرات تظهر في قائمة تعيين الرصيد (بغض النظر عن الحالة)
    const opts=tellers.map(t=>{
        const statusLabel=t.status==='online'?'🟢':'🔴';
        return `<option value="${t.username||t.name}">${statusLabel} ${t.name} (${t.id})</option>`;
    }).join('');
    document.getElementById('balTeller').innerHTML='<option value="">اختر التلر</option>'+opts;
    const filterSel=document.getElementById('filterTeller');
    filterSel.innerHTML='<option value="all">جميع التلرات</option>'+tellers.map(t=>`<option value="${t.username||t.name}">${t.name}</option>`).join('');
}

function setBalAction(action){
    document.getElementById('balActSet').classList.toggle('active',action==='set');
    document.getElementById('balActAdd').classList.toggle('active',action==='add');
    document.getElementById('balActSet').dataset.action=action;
    _balAction=action;
}
function selectBalCur(btn,cur){
    document.querySelectorAll('.bal-cur-chip').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('balCurrency').value=cur;
    const symMap={USD:'$',ILS:'₪',JOD:'JD',EUR:'€'};
    const s=document.getElementById('balAmountSym');
    if(s) s.textContent=symMap[cur]||'$';
}
let _balAction='set';
function svUpdatePreview(){
    const usd=parseFloat(document.getElementById('balAmtUSD').value)||0;
    const ils=parseFloat(document.getElementById('balAmtILS').value)||0;
    const jod=parseFloat(document.getElementById('balAmtJOD').value)||0;
    const total=usd+(ils/3.62)+(jod/0.709);
    const el=document.getElementById('svTotalPreview');
    if(!el)return;
    if(usd===0&&ils===0&&jod===0){el.textContent='—';return;}
    let parts=[];
    if(usd>0)parts.push('$'+usd.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2}));
    if(ils>0)parts.push('₪'+ils.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2}));
    if(jod>0)parts.push('JD '+jod.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2}));
    el.textContent=parts.join(' + ')+' ≈ $'+total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function assignBalance(){
    const sel=document.getElementById('balTeller');
    const username=sel.value;
    const displayName=sel.options[sel.selectedIndex]?.text?.split('(')[0]?.trim()||username;
    const amtUSD=parseFloat(document.getElementById('balAmtUSD').value)||0;
    const amtILS=parseFloat(document.getElementById('balAmtILS').value)||0;
    const amtJOD=parseFloat(document.getElementById('balAmtJOD').value)||0;
    if(!username){showToast('اختر التلر أولاً','error','❌');return;}
    if(amtUSD<=0&&amtILS<=0&&amtJOD<=0){showToast('أدخل رصيداً لعملة واحدة على الأقل','error','❌');return;}
    const actionLabel=_balAction==='set'?'تعيين':'إضافة';
    pendingBalance={username,displayName,amtUSD,amtILS,amtJOD,action:_balAction};
    document.getElementById('balConfirmText').textContent=`هل تريد فتح الصندوق لـ ${displayName} مع الرصيد الافتتاحي:\n$${amtUSD.toLocaleString()} — ₪${amtILS.toLocaleString()} — JD ${amtJOD.toLocaleString()}؟`;
    document.getElementById('balanceModal').classList.add('visible');
}

function confirmBalance(){
    if(!pendingBalance)return;
    const{username,displayName,amtUSD,amtILS,amtJOD,action}=pendingBalance;
    const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
    closeModal('balanceModal');
    pendingBalance=null;
    fetch('/api/sv2/balances',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body:JSON.stringify({teller:username,name:displayName,USD:amtUSD,ILS:amtILS,JOD:amtJOD,action})
    })
    .then(r=>r.json())
    .then(d=>{
        if(!d.success){showToast('فشل تعيين الرصيد: '+(d.message||''),'error','❌');return;}
        ['balAmtUSD','balAmtILS','balAmtJOD'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
        showToast(`تم فتح الصندوق لـ ${displayName||username} ✅`,'success','🔓');
        _loadTellers();
        loadBalanceLog();
    })
    .catch(()=>showToast('لا يوجد اتصال بالخادم','error','❌'));
}

function loadBalanceLog(){
    fetch('/api/sv2/balances',{headers:{'X-Requested-With':'XMLHttpRequest'}})
    .then(r=>r.json())
    .then(d=>{
        if(!d.success) return;
        _renderBalTellerCards(d.balances);
        _renderBalLogTable(d.balances);
    })
    .catch(()=>{});
}
function _renderBalLogTable(balances){
    const body=document.getElementById('balLogBody');
    if(!body) return;
    if(!balances||!balances.length){
        body.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد سجلات</td></tr>';
        document.getElementById('balLogCount').textContent='0 سجل';
        return;
    }
    body.innerHTML=balances.map(b=>`<tr>
        <td>${b.name||b.teller}</td>
        <td style="font-weight:700;direction:ltr;text-align:right;color:var(--primary-light)">${b.usd?'$'+Number(b.usd).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):''} ${b.ils?'₪'+Number(b.ils).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):''} ${b.jod?'JD '+Number(b.jod).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):''}</td>
        <td>متعدد</td>
        <td style="direction:ltr;text-align:right;font-size:12px">${b.setAt?new Date(b.setAt).toLocaleString('ar-EG'):''}</td>
        <td><span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:rgba(34,197,94,0.1);color:var(--success)">✅ معيّن</span></td>
    </tr>`).join('');
    document.getElementById('balLogCount').textContent=balances.length+' سجل';
}
function _renderBalTellerCards(balances){
    const grid=document.getElementById('balTellerCards');
    if(!grid) return;
    const balMap={};
    (balances||[]).forEach(b=>{ balMap[b.teller]=b; });
    grid.innerHTML=tellers.map(t=>{
        const b=balMap[t.username]||{usd:0,ils:0,jod:0};
        const total=((b.usd||0)+(b.ils||0)/3.62+(b.jod||0)/0.709);
        const curs=[['USD','$',b.usd],['ILS','₪',b.ils],['JOD','JD ',b.jod]]
            .filter(([,, v])=>v>0)
            .map(([,sym,v])=>`<span class="bal-tc-cur">${sym}${Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`)
            .join('');
        return`<div class="bal-tc ${t.status}">
            <div class="bal-tc-top">
                <div class="bal-tc-info">
                    <div class="bal-tc-avatar ${t.status}">${t.name[0]}</div>
                    <div><div class="bal-tc-name">${t.name}</div><div class="bal-tc-id">${t.id}</div></div>
                </div>
                <div class="bal-tc-total">$${Math.round(total).toLocaleString()}</div>
            </div>
            <div class="bal-tc-currencies">${curs||'<span class="bal-tc-cur" style="color:var(--text-muted)">لا يوجد رصيد</span>'}</div>
        </div>`;
    }).join('');
}
function renderBalanceLog(){ loadBalanceLog(); }

// ═══════════════════════════════════════════
// سجل العمليات
// ═══════════════════════════════════════════
const TYPE_AR={send:'إرسال',receive:'استقبال',convert:'تحويل عملات'};
const STATUS_AR2={completed:'مكتملة',pending:'معلقة',failed:'فاشلة'};

function renderOps(){
    const tFilter=document.getElementById('filterTeller').value;
    const tyFilter=document.getElementById('filterType').value;
    const stFilter=document.getElementById('filterStatus').value;
    const search=(document.getElementById('filterSearch').value||'').toLowerCase();
    let filtered=operations.filter(o=>{
        if(tFilter!=='all'&&o.teller!==tFilter)return false;
        if(tyFilter!=='all'&&o.type!==tyFilter)return false;
        if(stFilter!=='all'&&o.status!==stFilter)return false;
        if(search&&!o.desc.toLowerCase().includes(search)&&!o.id.toLowerCase().includes(search)&&!o.teller.toLowerCase().includes(search))return false;
        return true;
    });
    document.getElementById('opsBody').innerHTML=filtered.map(o=>{
        const neg=o.amount<0;
        return`<tr>
            <td style="font-variant-numeric:tabular-nums;font-size:12px;color:var(--text-muted)">${o.id}</td>
            <td style="font-weight:700">${o.teller}</td>
            <td><span class="op-type ${o.type}">${TYPE_AR[o.type]}</span></td>
            <td>${o.desc}</td>
            <td class="op-amount ${neg?'neg':'pos'}">${neg?'':'+'} ${SYMBOLS[o.currency]}${Math.abs(o.amount).toLocaleString()}</td>
            <td><span class="op-type" style="background:rgba(${o.status==='completed'?'34,197,94':o.status==='pending'?'245,158,11':'239,68,68'},0.1);color:var(--${o.status==='completed'?'success':o.status==='pending'?'warning':'danger'})">${STATUS_AR2[o.status]}</span></td>
            <td style="font-size:12px;color:var(--text-muted);direction:ltr;text-align:right">${o.time}</td>
        </tr>`;
    }).join('');
    document.getElementById('opsCount').textContent=filtered.length+' عملية';
}

// ═══════════════════════════════════════════
// طلبات التلرات
// ═══════════════════════════════════════════
let _reqFilter='all';
function filterRequests(btn,filter){
    _reqFilter=filter;
    document.querySelectorAll('.rqs-pill').forEach(b=>b.classList.remove('active','active-urgent','active-special','active-done'));
    if(btn){
        const cls=filter==='urgent'?'active-urgent':filter==='special_price'?'active-special':filter==='resolved'?'active-done':'active';
        btn.classList.add(cls);
    }
    renderRequests();
}
function renderRequests(){
    const list=document.getElementById('requestsList');
    if(!list) return;
    const isDone=r=>r.status==='resolved'||r.status==='approved'||r.status==='rejected';
    const pending=requests.filter(r=>r.status==='pending');
    const urgent=requests.filter(r=>r.type==='urgent'&&!isDone(r));
    const done=requests.filter(r=>isDone(r));
    // update mini stats
    const ep=document.getElementById('rqsPending');if(ep)ep.textContent=pending.length;
    const eu=document.getElementById('rqsUrgent');if(eu)eu.textContent=urgent.length;
    const ed=document.getElementById('rqsDone');if(ed)ed.textContent=done.length;
    const ec=document.getElementById('reqCount');if(ec)ec.textContent=pending.length;
    // filter
    let filtered=requests;
    if(_reqFilter==='pending') filtered=requests.filter(r=>r.status==='pending');
    else if(_reqFilter==='urgent') filtered=requests.filter(r=>r.type==='urgent');
    else if(_reqFilter==='special_price') filtered=requests.filter(r=>r.type==='special_price');
    else if(_reqFilter==='resolved') filtered=requests.filter(r=>isDone(r));
    if(filtered.length===0){
        list.innerHTML=`<div class="rqs-empty"><div class="rqs-empty-icon">📭</div><div class="rqs-empty-title">لا توجد طلبات هنا</div><div class="rqs-empty-sub">سيظهر هنا أي طلب جديد من التلرات فور إرساله</div></div>`;
        return;
    }
    const typeLabel={urgent:'🔴 عاجل',normal:'🟡 عادي',general:'🟡 عادي',special_price:'⭐ سعر مميز',reconcile:'⚖️ مطابقة صندوق',balance:'💰 رصيد'};
    const statusLabel={approved:'✅ موافقة',rejected:'❌ مرفوض',resolved:'✅ تم الرد'};
    list.innerHTML=filtered.map((r,i)=>{
        const name=r.from||r.tellerName||'—';
        const done=isDone(r);
        const cardType=done?r.status:r.type;
        const tagText=done?statusLabel[r.status]:(typeLabel[r.type]||'🟡 عادي');
        const tagCls=done?r.status:r.type;
        return`<div class="rq-card rq-${cardType}" style="animation-delay:${i*0.05}s">
            <div class="rq-top">
                <div class="rq-sender">
                    <div class="rq-av rq-${cardType}">${name[0]||'؟'}</div>
                    <div>
                        <div class="rq-sender-name">${name}</div>
                        <div class="rq-sender-id">${r.id}</div>
                    </div>
                </div>
                <div class="rq-right-meta">
                    <span class="rq-type-tag rq-${tagCls}">${tagText}</span>
                    <span class="rq-time">🕐 ${r.time}</span>
                </div>
            </div>
            <div class="rq-body">
                <div class="rq-message">${r.text}</div>
            </div>
            ${r.reply?`<div class="rq-reply">
                <div class="rq-reply-arrow">↩</div>
                <div class="rq-reply-content">
                    <div class="rq-reply-label">ردك على الطلب</div>
                    <div class="rq-reply-text">${r.reply}</div>
                </div>
            </div>`:''}
            <div class="rq-footer">
                ${!done?`
                    <button class="rq-btn rq-btn-reply" onclick="openReply('${r.id}')">💬 رد على الطلب</button>
                    <button class="rq-btn rq-btn-approve" onclick="approveRequest('${r.id}')">✅ موافقة</button>
                    <button class="rq-btn rq-btn-reject" onclick="rejectRequest('${r.id}')">❌ رفض</button>
                `:`<span class="rq-done-label">✅ تم الرد على هذا الطلب</span>`}
            </div>
        </div>`;
    }).join('');
}

function openReply(id){replyTargetId=id;document.getElementById('replyText').value='';document.getElementById('replyModal').classList.add('visible');}
function _patchRequest(id, payload, onSuccess){
    const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
    fetch('/api/sv2/requests/'+id,{
        method:'PATCH',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body:JSON.stringify(payload)
    })
    .then(r=>r.json())
    .then(resp=>{
        if(resp.success){
            // تحديث الـ cache المحلي بالبيانات الجديدة من الخادم
            const idx=requests.findIndex(x=>String(x.id)===String(id));
            if(idx!==-1) requests[idx]=resp.request;
            try{localStorage.setItem(LS_REQUESTS,JSON.stringify(requests));}catch(e){}
            renderRequests();updateStats();
            if(onSuccess) onSuccess();
        } else {
            console.warn('[REQUEST] فشل تحديث الطلب:',resp.message);
        }
    })
    .catch(()=>{
        // fallback: تحديث localStorage فقط
        _saveRequests();renderRequests();updateStats();
        if(onSuccess) onSuccess();
    });
}

function sendReply(){
    const text=document.getElementById('replyText').value.trim();
    if(!text){showToast('اكتب نص الرد','error','❌');return;}
    const r=requests.find(x=>String(x.id)===String(replyTargetId));
    if(r){r.status='resolved';r.reply=text;r.resolvedAt=new Date().toISOString();}
    closeModal('replyModal');
    _patchRequest(replyTargetId,{status:'resolved',reply:text},()=>showToast('تم إرسال الرد بنجاح','success','💬'));
}
function approveRequest(id){
    const r=requests.find(x=>String(x.id)===String(id));
    if(r){r.status='approved';r.reply='تمت الموافقة على طلبك ✅';r.resolvedAt=new Date().toISOString();}
    _patchRequest(id,{status:'approved'},()=>showToast('تمت الموافقة على الطلب','success','✅'));
}
function rejectRequest(id){
    const r=requests.find(x=>String(x.id)===String(id));
    if(r){r.status='rejected';r.reply='عذراً، تم رفض الطلب ❌';r.resolvedAt=new Date().toISOString();}
    _patchRequest(id,{status:'rejected'},()=>showToast('تم رفض الطلب','warning','❌'));
}

// ═══════════════════════════════════════════
// صلاحيات التلرات
// ═══════════════════════════════════════════
let _permTargetId=null;
const PERM_DEFS=[
    {key:'exchange',label:'قسم الصرافة',icon:'💱'},
    {key:'international',label:'الحوالات الدولية',icon:'🌍'},
    {key:'electronic',label:'المعاملات الإلكترونية',icon:'📲'},
    {key:'accounts',label:'إدارة الحسابات',icon:'📒'},
    {key:'specialPrice',label:'السعر المميز',icon:'⭐'},
    {key:'doubleDelivery',label:'التسليم المزدوج',icon:'📋'},
];
function openPermissions(id){
    // البحث بـ id أو username أو name (مرونة مع البيانات القديمة)
    let t=tellers.find(x=>x.id===id);
    if(!t) t=tellers.find(x=>x.username===id||x.name===id);
    if(!t){
        if(tellers.length===0)
            showToast('لا يوجد تلرات محملة — انتظر قليلاً وأعد المحاولة','warning','⏳');
        else
            showToast('لم يُعثر على التلر. أعد تحميل الصفحة وحاول مجدداً','error','❌');
        return;
    }
    _permTargetId=t.id;
    document.getElementById('permTellerName').textContent=t.name;
    const uname=t.username||t.name;
    // تعيين القيم الافتراضية فوراً قبل انتظار الخادم
    PERM_DEFS.forEach(p=>{const cb=document.getElementById('perm_'+p.key);if(cb)cb.checked=true;});
    // جلب الصلاحيات من الخادم
    fetch('/api/sv2/permissions/'+encodeURIComponent(uname))
        .then(r=>r.json())
        .then(resp=>{
            const cur=resp.success?resp.permissions:{exchange:true,international:true,electronic:true,accounts:true,specialPrice:false,doubleDelivery:false};
            PERM_DEFS.forEach(p=>{const cb=document.getElementById('perm_'+p.key);if(cb)cb.checked=!!cur[p.key];});
            // cache محلي
            const all=_svLoad(LS_PERMS,{});all[uname]=cur;_svSave(LS_PERMS,all);
        })
        .catch(()=>{
            const all=_svLoad(LS_PERMS,{});
            const cur=all[uname]||{exchange:true,international:true,electronic:true,accounts:true,specialPrice:false,doubleDelivery:false};
            PERM_DEFS.forEach(p=>{const cb=document.getElementById('perm_'+p.key);if(cb)cb.checked=!!cur[p.key];});
        });
    document.getElementById('permissionsModal').classList.add('visible');
}

function savePermissions(){
    let t=tellers.find(x=>x.id===_permTargetId);
    if(!t) t=tellers.find(x=>x.username===_permTargetId||x.name===_permTargetId);
    if(!t){showToast('خطأ: لم يُعثر على التلر','error','❌');return;}
    const uname=t.username||t.name;
    const perms={};
    PERM_DEFS.forEach(p=>{const cb=document.getElementById('perm_'+p.key);perms[p.key]=cb?cb.checked:true;});

    // حفظ محلي فوري
    const all=_svLoad(LS_PERMS,{});all[uname]=perms;_svSave(LS_PERMS,all);
    closeModal('permissionsModal');
    showToast('تم حفظ صلاحيات '+t.name,'success','🔐');
    renderPermOverlay();

    // حفظ في قاعدة البيانات
    const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
    fetch('/api/sv2/permissions/'+encodeURIComponent(uname),{
        method:'PATCH',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body:JSON.stringify(perms)
    })
    .then(r=>r.json())
    .then(d=>{
        if(!d.success) showToast('⚠️ خطأ في حفظ الصلاحيات: '+(d.message||'خطأ غير معروف'),'error','❌');
        else showToast('✅ تم حفظ صلاحيات '+t.name+' في قاعدة البيانات','success','💾');
    })
    .catch(()=>showToast('⚠️ لا اتصال بالخادم — تم الحفظ محلياً فقط','warning','📴'));
}

function closePermOverlay(){
    document.getElementById('permOverlay').classList.remove('open');
}
function permOverlayClick(e){
    if(e.target===document.getElementById('permOverlay')) closePermOverlay();
}
function renderPermOverlay(serverPerms){
    const grid=document.getElementById('permTellersList');
    if(!grid) return;
    const PERM_LABELS={exchange:'الصرافة',international:'الحوالات',electronic:'الإلكترونية',accounts:'الحسابات',specialPrice:'سعر مميز',doubleDelivery:'تسليم مزدوج'};
    // بناء خريطة username → perms من بيانات الخادم أو localStorage
    const permMap={};
    if(serverPerms&&Array.isArray(serverPerms)){
        serverPerms.forEach(p=>permMap[p.teller]=p);
    }
    const lsPerms=_svLoad(LS_PERMS,{});
    grid.innerHTML=tellers.map(t=>{
        const uname=t.username||t.name;
        const perms=permMap[uname]||lsPerms[uname]||{exchange:true,international:true,electronic:true,accounts:true,specialPrice:false,doubleDelivery:false};
        const tags=Object.entries(PERM_LABELS).map(([k,lbl])=>`<span class="ptc-perm-tag ${perms[k]!==false?'on':'off'}">${lbl}</span>`).join('');
        const tid=t.id||t.username||t.name;
        return`<div class="perm-teller-card ${t.status}" onclick="openPermissions('${tid}');closePermOverlay()">
            <div class="ptc-top">
                <div class="ptc-avatar ${t.status}">${t.name[0]}</div>
                <div><div class="ptc-name">${t.name}</div><div class="ptc-id">${t.id||''} · ${t.status==='online'?'🟢 متصل':'🔴 غير متصل'}</div></div>
            </div>
            <div class="ptc-perms">${tags}</div>
            <button class="ptc-edit-btn" onclick="event.stopPropagation();openPermissions('${tid}')">✏️ تعديل الصلاحيات</button>
        </div>`;
    }).join('');
}
function openPermOverlay(){
    document.getElementById('permOverlay').classList.add('open');
    // جلب كل الصلاحيات من الخادم قبل العرض
    fetch('/api/sv2/permissions')
        .then(r=>r.json())
        .then(resp=>{
            renderPermOverlay(resp.success?resp.permissions:null);
            // تحديث cache
            if(resp.success&&Array.isArray(resp.permissions)){
                const all=_svLoad(LS_PERMS,{});
                resp.permissions.forEach(p=>{all[p.teller]=p;});
                _svSave(LS_PERMS,all);
            }
        })
        .catch(()=>{
            renderPermOverlay(null);
            showToast('تعذّر جلب الصلاحيات من الخادم','warning','⚠️');
        });
}

// ═══════════════════════════════════════════
// التسعيرة
// ═══════════════════════════════════════════
function renderPricing(){
    ['bank','cash'].forEach(type=>{
        const prices=type==='bank'?bankPrices:cashPrices;
        const container=document.getElementById(type+'Pricing');
        container.innerHTML=`
            <div class="price-row" style="margin-bottom:4px">
                <div></div>
                <div class="price-label">سعر الشراء (₪)</div>
                <div class="price-label">سعر البيع (₪)</div>
            </div>
            ${pricingCurrencies.map(c=>`
                <div class="price-row">
                    <div class="price-currency">${c.flag} ${c.name}</div>
                    <input type="number" step="0.01" class="price-input" id="${type}_buy_${c.code}" value="${prices[c.code].buy}" dir="ltr">
                    <input type="number" step="0.01" class="price-input" id="${type}_sell_${c.code}" value="${prices[c.code].sell}" dir="ltr">
                </div>
            `).join('')}
        `;
    });
}

function savePricing(){saveAllRates()}

function prcHighlight(rowId){
    var el=document.getElementById(rowId);
    if(!el) return;
    el.classList.remove('changed');
    void el.offsetWidth;
    el.classList.add('changed');
}

function saveAllRates(){
    try{
        const g=id=>document.getElementById(id);
        const mainILS=parseFloat((g('svMainILS')||{}).value)||3.62;
        const mainJOD=parseFloat((g('svMainJOD')||{}).value)||0.709;
        const mainEUR=parseFloat((g('svMainEUR')||{}).value)||0.92;
        const mainGBP=parseFloat((g('svMainGBP')||{}).value)||0.79;
        const ddCash=parseFloat((g('svDdCash')||{}).value)||3.55;
        const ddBank=parseFloat((g('svDdBank')||{}).value)||3.52;
        pricingCurrencies.forEach(c=>{
            bankPrices[c.code]={
                buy: parseFloat((g('bank_buy_'+c.code)||{}).value)||0,
                sell:parseFloat((g('bank_sell_'+c.code)||{}).value)||0
            };
            cashPrices[c.code]={
                buy: parseFloat((g('cash_buy_'+c.code)||{}).value)||0,
                sell:parseFloat((g('cash_sell_'+c.code)||{}).value)||0
            };
        });
        const ratesData={
            ILS:mainILS,JOD:mainJOD,EUR:mainEUR,GBP:mainGBP,
            cashRate:ddCash,bankRate:ddBank,bankPrices,cashPrices,
            time:new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}),
            timestamp:new Date().toISOString()
        };
        // حفظ في الذاكرة فوراً
        window._intlCache = window._intlCache || {};
        window._intlCache.sv_rates = ratesData;
        // إظهار النتيجة فوراً بدون انتظار الخادم
        const st=g('svPublishStatus');
        if(st){st.style.display='block';st.textContent='✅ تم نشر الأسعار لجميع التلرات — '+ratesData.time;setTimeout(()=>{st.style.display='none'},6000);}
        showToast('تم نشر جميع الأسعار لأقسام التلر','success','🚀');
        // حفظ في قاعدة البيانات في الخلفية
        const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
        fetch('/api/sv2/rates',{
            method:'POST',
            headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
            body:JSON.stringify({rates:ratesData,rate_type:'teller'})
        })
        .then(r=>r.json())
        .then(d=>{
            if(d.success) console.log('[RATES] تم الحفظ في قاعدة البيانات ✅');
            else console.warn('[RATES] فشل الحفظ في الخادم:',d.message);
        })
        .catch(err=>console.warn('[RATES] لا يوجد اتصال بالخادم — تم الحفظ محلياً فقط'));
    }catch(err){
        console.error('[saveAllRates] خطأ:',err);
        showToast('خطأ في نشر الأسعار: '+err.message,'error','❌');
    }
}

function resetPricing(){resetAllRates()}
function resetAllRates(){
    document.getElementById('svMainILS').value=3.62;
    document.getElementById('svMainJOD').value=0.709;
    document.getElementById('svMainEUR').value=0.92;
    document.getElementById('svMainGBP').value=0.79;
    document.getElementById('svDdCash').value=3.55;
    document.getElementById('svDdBank').value=3.52;
    bankPrices={USD:{buy:3.60,sell:3.64},EUR:{buy:3.92,sell:3.97},JOD:{buy:5.08,sell:5.14},GBP:{buy:4.55,sell:4.61}};
    cashPrices={USD:{buy:3.58,sell:3.66},EUR:{buy:3.90,sell:3.99},JOD:{buy:5.06,sell:5.16},GBP:{buy:4.53,sell:4.63}};
    renderPricing();
    showToast('تم إعادة جميع الأسعار للقيم الافتراضية','info','♻️');
}
document.addEventListener('input',function(e){if(e.target.id==='svDdCash'||e.target.id==='svDdBank'){const c=parseFloat(document.getElementById('svDdCash').value)||0,b=parseFloat(document.getElementById('svDdBank').value)||0;const diff=(c-b);const d=document.getElementById('svDdDiff');if(d)d.textContent=diff.toFixed(3);const db=document.querySelector('.prc-diff-badge');if(db)db.textContent=diff>=0?'لصالح الكاش ✓':'لصالح البنكي ✓';}});

// ═══════════════════════════════════════════
// أدوات
// ═══════════════════════════════════════════
function closeModal(id){document.getElementById(id).classList.remove('visible');}
document.querySelectorAll('.modal-overlay').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)});});

function showToast(msg,type='info',icon='ℹ️'){
    const c=document.getElementById('toastContainer');
    if(!c)return;
    const t=document.createElement('div');
    t.className=`toast ${type}`;
    t.innerHTML=`<div class="toast-body"><div class="toast-icon-wrap">${icon}</div><span class="toast-text">${msg}</span></div><button class="toast-close" onclick="this.closest('.toast').classList.add('exit');setTimeout(()=>this.closest('.toast').remove(),280)">✕</button>`;
    c.appendChild(t);
    setTimeout(()=>{t.classList.add('exit');setTimeout(()=>t.remove(),280)},3800);
}

// الجزيئات
const canvas=document.getElementById('particles'),ctx=canvas.getContext('2d');let parts=[];
function resizeC(){canvas.width=innerWidth;canvas.height=innerHeight}resizeC();addEventListener('resize',resizeC);
class P{constructor(){this.x=Math.random()*canvas.width;this.y=Math.random()*canvas.height;this.s=Math.random()*1.2+0.3;this.sx=(Math.random()-0.5)*0.25;this.sy=(Math.random()-0.5)*0.25;this.o=Math.random()*0.15+0.03}update(){this.x+=this.sx;this.y+=this.sy;if(this.x>canvas.width)this.x=0;if(this.x<0)this.x=canvas.width;if(this.y>canvas.height)this.y=0;if(this.y<0)this.y=canvas.height}draw(){ctx.beginPath();ctx.arc(this.x,this.y,this.s,0,Math.PI*2);ctx.fillStyle=`rgba(50,184,198,${this.o})`;ctx.fill()}}
function initP(){parts=[];for(let i=0;i<Math.min(50,canvas.width*canvas.height/25000);i++)parts.push(new P)}initP();
function connectP(){for(let a=0;a<parts.length;a++)for(let b=a+1;b<parts.length;b++){const d=Math.hypot(parts[a].x-parts[b].x,parts[a].y-parts[b].y);if(d<90){ctx.beginPath();ctx.strokeStyle=`rgba(50,184,198,${0.025*(1-d/90)})`;ctx.lineWidth=0.4;ctx.moveTo(parts[a].x,parts[a].y);ctx.lineTo(parts[b].x,parts[b].y);ctx.stroke()}}}
function animP(){ctx.clearRect(0,0,canvas.width,canvas.height);parts.forEach(p=>{p.update();p.draw()});connectP();requestAnimationFrame(animP)}animP();

// ═══════════════════════════════════════════
// التشغيل
// ═══════════════════════════════════════════
// ── وضع فاتح/داكن ──
const _SUN_SVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const _MOON_SVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
function toggleTheme() { /* dark mode only — light mode disabled */ }


_loadTellers();
setInterval(()=>_loadTellers(true), 30000); // تحديث صامت كل 30 ثانية
_loadRequests();
_mergeOpsFromLS();
renderTellers();
populateTellerSelects();
loadBalanceLog();
renderOps();
renderRequests();
renderPricing();

setTimeout(()=>showToast('مرحباً بك في لوحة تحكم مشرف التلر','info','📋'),800);
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-overlay.visible').forEach(m=>closeModal(m.id))});

// ── بيانات المستخدم وتسجيل الخروج ──
function logout(){window.location.href='/logout/';}
(function(){try{const u=(window._currentUser||{});if(u.username){const el=document.getElementById('userDisplayName');const rl=document.getElementById('userDisplayRole');if(el)el.textContent=u.username;if(rl)rl.textContent=u.roleName||u.role;}}catch(e){}})();

// ══════════════════════════════════════════
// رفع التقارير للإدارة العامة
// ══════════════════════════════════════════
let _rptFileData = null;   // base64 data URL
let _rptFileMeta = null;   // { name, size, type }

function openReportModal(){
    const modal=document.getElementById('reportUploadModal');
    if(!modal)return;
    try{
        const rptTitle=document.getElementById('rptTitle');
        if(rptTitle)rptTitle.value='';
        _rptFileData=null; _rptFileMeta=null;
        rptClearFile();
        const u=(window._currentUser||{});
        const branchEl=document.getElementById('rptBranchDisplay');
        if(branchEl&&u.branch)branchEl.textContent=u.branch;
    }catch(e){}
    modal.classList.add('visible');
}
function closeReportModal(){
    const modal=document.getElementById('reportUploadModal');
    if(modal)modal.classList.remove('visible');
}

// — خريطة امتدادات الملفات —
const _RPT_EXT_MAP={
    'application/pdf':'pdf','application/vnd.ms-excel':'excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'excel',
    'application/msword':'word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'word',
    'image/png':'image','image/jpeg':'image','image/jpg':'image','image/gif':'image','image/webp':'image'
};
const _RPT_ICONS={pdf:'📄',excel:'📊',word:'📝',image:'🖼️',other:'📁'};

function _rptFormatSize(bytes){
    if(bytes<1024)return bytes+' B';
    if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';
    return (bytes/1048576).toFixed(1)+' MB';
}
function _rptDetectType(mimeType,fileName){
    if(_RPT_EXT_MAP[mimeType])return _RPT_EXT_MAP[mimeType];
    const ext=(fileName||'').split('.').pop().toLowerCase();
    if(ext==='pdf')return 'pdf';
    if(['xls','xlsx','csv'].includes(ext))return 'excel';
    if(['doc','docx'].includes(ext))return 'word';
    if(['png','jpg','jpeg','gif','webp'].includes(ext))return 'image';
    return 'other';
}
function _rptShowPreview(name,size,type){
    const preview=document.getElementById('rptFilePreview');
    const dz=document.getElementById('rptDropZone');
    document.getElementById('rptFileIcon').textContent=_RPT_ICONS[type]||'📁';
    document.getElementById('rptFileNameDisplay').textContent=name;
    document.getElementById('rptFileSizeDisplay').textContent=_rptFormatSize(size);
    if(dz)dz.style.display='none';
    if(preview){preview.style.display='flex';}
}
function rptClearFile(){
    _rptFileData=null; _rptFileMeta=null;
    const inp=document.getElementById('rptFileInput');
    if(inp)inp.value='';
    const preview=document.getElementById('rptFilePreview');
    const dz=document.getElementById('rptDropZone');
    if(preview)preview.style.display='none';
    if(dz)dz.style.display='';
}
function _rptReadFile(file){
    if(file.size>10*1024*1024){showToast('حجم الملف يتجاوز 10 MB','error','❌');return;}
    const type=_rptDetectType(file.type,file.name);
    _rptFileMeta={name:file.name,size:file.size,type:type};
    _rptShowPreview(file.name,file.size,type);
    const reader=new FileReader();
    reader.onload=function(ev){_rptFileData=ev.target.result;};
    reader.readAsDataURL(file);
}
function rptFileChosen(input){
    if(input.files&&input.files[0])_rptReadFile(input.files[0]);
}
function rptFileDrop(event){
    const files=event.dataTransfer.files;
    if(files&&files[0]){
        document.getElementById('rptFileInput').files; // reset value
        _rptReadFile(files[0]);
    }
}

function submitReport(){
    const title=document.getElementById('rptTitle').value.trim();
    if(!title){showToast('يرجى إدخال عنوان التقرير','error','❌');return;}
    if(!_rptFileData||!_rptFileMeta){showToast('يرجى اختيار ملف للرفع','error','❌');return;}

    const branchEl=document.getElementById('rptBranchDisplay');
    const branch=branchEl?branchEl.textContent:'الفرع الرئيسي';
    let senderName='مشرف التلر';
    try{const u=(window._currentUser||{});if(u.username)senderName=u.username;}catch(e){}

    const now=new Date();
    const pad=n=>String(n).padStart(2,'0');
    const date=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())
               +' '+pad(now.getHours())+':'+pad(now.getMinutes());

    const reportObj={
        source:'tellerMgr',
        title: title,
        fileName: _rptFileMeta.name,
        fileType: _rptFileMeta.type,
        fileSize: _rptFormatSize(_rptFileMeta.size),
        fileData: _rptFileData,   // base64 للتنزيل المباشر
        sender: senderName,
        department: 'مشرف التلر',
        branch: branch,
        branchId: 1,
        date: date
    };

    // حفظ في localStorage لاستقباله في لوحة الإدارة
    try{
        const existing=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');
        existing.unshift(reportObj);
        localStorage.setItem('intl_admin_reports',JSON.stringify(existing));
    }catch(storageErr){
        // إذا تجاوز حد localStorage (ملف كبير جداً) نرسل بدون fileData
        try{
            reportObj.fileData=null;
            reportObj.fileSize=_rptFormatSize(_rptFileMeta.size)+' (غير متاح للتنزيل)';
            const existing2=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');
            existing2.unshift(reportObj);
            localStorage.setItem('intl_admin_reports',JSON.stringify(existing2));
        }catch(e){}
    }

    // حفظ في قاعدة البيانات في الخلفية
    if (typeof apiSubmitReport === 'function') {
        apiSubmitReport('tellerMgr', title, reportObj.fileSize + ' | ' + _rptFileMeta.name, branch)
            .then(d => { if (!d.success) console.warn('[REPORT] server save failed:', d.message); })
            .catch(() => {});
    }

    closeReportModal();
    showToast('تم إرسال الملف "'+_rptFileMeta.name+'" للإدارة بنجاح','success','📤');
}

// ══════════════════════════════════════════════════
// تعليمات الإدارة — Teller Supervisor
// ══════════════════════════════════════════════════

function svGetMyId() {
  try { const u = (window._currentUser || {}); return u.svId || u.id || 1; } catch(e) { return 1; }
}

function svLoadInstructions() {
  const id = svGetMyId();
  try { return JSON.parse(localStorage.getItem('intl_instr_' + id)) || []; } catch(e) { return []; }
}

function svRenderInstructions() {
  const el = document.getElementById('sv-instr-list');
  if (!el) return;
  const fetchFn = typeof apiSv2InstructionsGet === 'function'
    ? apiSv2InstructionsGet
    : () => Promise.resolve({ success: false });

  fetchFn().then(resp => {
    const list = resp.success && Array.isArray(resp.instructions) ? resp.instructions : svLoadInstructions();
    const unread = list.filter(i => !i.isRead && !i.read).length;
    const badge = document.getElementById('instrBadge');
    if (badge) { badge.style.display = unread > 0 ? '' : 'none'; badge.textContent = unread; }

    list.forEach(instr => {
      if (!instr.isRead && !instr.read && typeof apiSv2InstructionRead === 'function')
        apiSv2InstructionRead(instr.id);
    });

    const PS = {
      urgent:  { border:'rgba(239,68,68,0.3)',   bg:'rgba(239,68,68,0.15)',   color:'#f87171', label:'عاجل'  },
      high:    { border:'rgba(251,191,36,0.3)',  bg:'rgba(251,191,36,0.15)',  color:'#fbbf24', label:'مهم'   },
      normal:  { border:'rgba(255,255,255,0.07)',bg:'rgba(255,255,255,0.06)', color:'#94a3b8', label:'عادي'  },
    };

    el.innerHTML = list.length === 0
      ? '<div style="text-align:center;padding:40px;color:#8696a0;font-size:14px">لا توجد تعليمات من الإدارة</div>'
      : list.map(instr => {
          const p = PS[instr.priority] || PS.normal;
          const dateStr = instr.createdAt ? new Date(instr.createdAt).toLocaleDateString('ar-EG') : (instr.date || '');
          return '<div style="background:rgba(255,255,255,0.03);border:1px solid ' + p.border + ';border-radius:14px;padding:16px;margin-bottom:12px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
              '<span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:8px;background:' + p.bg + ';color:' + p.color + '">' + p.label + '</span>' +
              '<span style="font-size:11px;color:#64748b">' + dateStr + '</span>' +
            '</div>' +
            '<div style="font-weight:700;font-size:13px;color:#e9edef;margin-bottom:6px">' + (instr.title || '') + '</div>' +
            '<div style="font-size:13px;line-height:1.7;color:#e9edef">' + (instr.body || instr.text || '') + '</div>' +
            '<div style="font-size:11px;color:#64748b;margin-top:8px">من: ' + (instr.createdBy || instr.adminName || 'الإدارة العامة') + '</div>' +
          '</div>';
        }).join('');
  }).catch(() => {
    const list = svLoadInstructions();
    svCheckNewInstructions();
    el.innerHTML = list.length === 0
      ? '<div style="text-align:center;padding:40px;color:#8696a0;font-size:14px">لا توجد تعليمات من الإدارة</div>'
      : '<div style="text-align:center;padding:20px;color:#fbbf24;font-size:12px">⚠️ لا اتصال — يُعرض المحفوظ محلياً</div>';
  });
}

function svCheckNewInstructions() {
  const id = svGetMyId();
  const list = JSON.parse(localStorage.getItem('intl_instr_' + id) || '[]');
  const unread = list.filter(i => !i.read).length;
  const badge = document.getElementById('instrBadge');
  if (badge) {
    badge.style.display = unread > 0 ? '' : 'none';
    badge.textContent = unread;
  }
}

function svSendMessageToAdmin() {
  document.getElementById('svMsgModal').style.display = 'flex';
}

function svDoSendMsg() {
  const text = (document.getElementById('svMsgText').value || '').trim();
  if (!text) { showToast('يرجى كتابة رسالة', 'error'); return; }
  let name = 'مشرف التلر';
  try { const u = (window._currentUser || {}); if (u.username) name = u.username; } catch(e) {}
  const msgs = JSON.parse(localStorage.getItem('intl_sv_msgs') || '[]');
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  msgs.unshift({
    id: Date.now(),
    supId: svGetMyId(),
    supName: name,
    supType: 'teller',
    text,
    date: now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate()) + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()),
    read: false
  });
  localStorage.setItem('intl_sv_msgs', JSON.stringify(msgs));
  document.getElementById('svMsgText').value = '';
  document.getElementById('svMsgModal').style.display = 'none';
  showToast('تم إرسال رسالتك للإدارة', 'success', '✅');
}

// Listen for new instructions from admin
window.addEventListener('storage', function(e) {
  if (e.key && e.key.startsWith('intl_instr_')) svCheckNewInstructions();
});

// Initial check on load
svCheckNewInstructions();

// ══ إضافة تلر جديد ══
let _tellerIdCounter=1;
function _nextTellerId(){
    const ids=tellers.map(t=>parseInt((t.id||'T000').replace(/\D/g,''))||0);
    const max=ids.length?Math.max(...ids):0;
    return 'T'+(String(max+1).padStart(3,'0'));
}
function openAddTellerModal(){
    document.getElementById('addTellerName').value='';
    document.getElementById('addTellerUsername').value='';
    document.getElementById('addTellerPhone').value='';
    document.getElementById('addTellerPassword').value='';
    document.getElementById('addTellerModal').classList.add('visible');
}
function closeAddTellerModal(){
    document.getElementById('addTellerModal').classList.remove('visible');
}
function togglePwdVisibility(inputId, btn){
    const inp=document.getElementById(inputId);
    if(!inp) return;
    inp.type=inp.type==='password'?'text':'password';
    btn.textContent=inp.type==='password'?'👁':'🙈';
}
function confirmAddTeller(){
    const name    =(document.getElementById('addTellerName').value||'').trim();
    const username=(document.getElementById('addTellerUsername').value||'').trim();
    const phone   =(document.getElementById('addTellerPhone').value||'').trim();
    const password=(document.getElementById('addTellerPassword').value||'').trim();
    if(!name)    {showToast('أدخل اسم التلر','error','❌');return;}
    if(!username){showToast('أدخل اسم المستخدم','error','❌');return;}
    if(!password||password.length<6){showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل','error','❌');return;}
    if(tellers.find(t=>t.username===username)){showToast('اسم المستخدم مستخدم مسبقاً','error','❌');return;}

    const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
    fetch('/api/sv2/tellers',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body:JSON.stringify({name,username,phone,password})
    })
    .then(r=>r.json())
    .then(resp=>{
        if(!resp.success){showToast(resp.message||'فشل الإضافة','error','❌');return;}
        tellers.push(resp.teller);
        _saveTellers();renderTellers();populateTellerSelects();updateStats();
        closeAddTellerModal();
        _showCredsModal(username, password, resp.smsSent, resp.smsError, resp.siteUrl||window.location.origin+'/login/');
    })
    .catch(()=>showToast('لا يوجد اتصال بالخادم','error','❌'));
}

function _showCredsModal(username, password, smsSent, smsError, siteUrl){
    document.getElementById('credsUsername').textContent=username;
    document.getElementById('credsPassword').textContent=password;
    document.getElementById('credsSiteUrl').textContent=siteUrl;
    document.getElementById('tellerCredsSmsSent').style.display=smsSent?'block':'none';
    document.getElementById('tellerCredsSmsFail').style.display=smsSent?'none':'block';
    if(!smsSent&&smsError) document.getElementById('tellerCredsSmsFail').textContent='⚠️ '+smsError+' — شارك بيانات الدخول يدوياً';
    document.getElementById('tellerCredsModal').classList.add('visible');
}

function copyTellerCreds(){
    const u=document.getElementById('credsUsername').textContent;
    const p=document.getElementById('credsPassword').textContent;
    const s=document.getElementById('credsSiteUrl').textContent;
    const text=`رابط النظام: ${s}\nاسم المستخدم: ${u}\nكلمة المرور: ${p}`;
    navigator.clipboard.writeText(text).then(()=>showToast('تم نسخ بيانات الدخول','success','📋')).catch(()=>showToast('فشل النسخ','error','❌'));
}

// ── تغيير كلمة مرور تلر موجود ──
let _changePwdTarget='';
function openChangePwd(username, name){
    _changePwdTarget=username;
    document.getElementById('changePwdTellerName').textContent='التلر: '+name+' ('+username+')';
    document.getElementById('changePwdInput').value='';
    document.getElementById('changePwdModal').classList.add('visible');
}
function confirmChangePwd(){
    const password=(document.getElementById('changePwdInput').value||'').trim();
    if(!password||password.length<6){showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل','error','❌');return;}
    const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
    fetch('/api/sv2/tellers/'+encodeURIComponent(_changePwdTarget)+'/password',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body:JSON.stringify({password})
    })
    .then(r=>r.json())
    .then(resp=>{
        if(resp.success){
            closeModal('changePwdModal');
            showToast('تم تغيير كلمة المرور بنجاح 🔑','success','🔑');
        } else {
            showToast(resp.message||'فشل تغيير كلمة المرور','error','❌');
        }
    })
    .catch(()=>showToast('لا يوجد اتصال بالخادم','error','❌'));
}
function deleteTeller(username){
    const t=tellers.find(x=>(x.username||x.name)===username);
    if(!t) return;
    if(!confirm(`هل تريد حذف التلر "${t.name}"؟`)) return;

    const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
    fetch('/api/sv2/tellers/'+encodeURIComponent(t.username||t.name),{
        method:'DELETE',
        headers:{'X-CSRFToken':csrf}
    }).catch(()=>{});

    // تحديث محلي فوري بدون انتظار الخادم
    tellers.splice(tellers.indexOf(t),1);
    _saveTellers();
    renderTellers();
    populateTellerSelects();
    updateStats();
    showToast(`تم حذف التلر "${t.name}"`,'warning','🗑️');
}

// ══════════════════════════════════════════════════════════════════════════════
// استطلاع دوري للطلبات الجديدة من الخادم — يعمل عبر الأجهزة المختلفة
// ══════════════════════════════════════════════════════════════════════════════
let _svLastRequestCount = 0;

function _pollNewRequests(){
    fetch('/api/sv2/requests?filter=pending')
        .then(r=>r.json())
        .then(resp=>{
            if(!resp.success||!Array.isArray(resp.requests)) return;
            const incoming=resp.requests;
            // تحديث الطلبات الواردة (دمج مع الموجودة)
            incoming.forEach(inReq=>{
                const existing=requests.find(x=>String(x.id)===String(inReq.id));
                if(!existing){
                    requests.unshift(inReq);
                    showToast('طلب جديد من '+inReq.tellerName+': '+inReq.text.substring(0,30),'warning','🔔');
                }
            });
            // تحديث حالة الطلبات المنتهية في الـ cache المحلي
            requests.forEach(r=>{
                if(r.status==='pending'){
                    // إذا لم يعد في القائمة الواردة — ربما حُذف أو حُدّث من جهاز آخر
                    const still=incoming.find(x=>String(x.id)===String(r.id));
                    // لا نحذفه — فقط نُحدّث إن تغيّرت الحالة
                }
            });
            if(incoming.length!==_svLastRequestCount){
                _svLastRequestCount=incoming.length;
                try{localStorage.setItem(LS_REQUESTS,JSON.stringify(requests));}catch(e){}
                renderRequests();updateStats();
            }
        })
        .catch(()=>{});
}

// استطلاع كل 10 ثوانٍ (fallback إذا انقطع WS)
setInterval(_pollNewRequests, 10000);

// ══════════════════════════════════════════════════════════════
// WebSocket — إشعارات فورية: طلبات التلر + حالة الاتصال
// ══════════════════════════════════════════════════════════════
(function initSupervisorWS() {
    var _ws = null;
    var _pingInterval = null;
    var _reconnectTimer = null;
    var _reconnectDelay = 3000;

    function _wsUrl() {
        var proto = location.protocol === 'https:' ? 'wss' : 'ws';
        return proto + '://' + location.host + '/ws/intl/';
    }

    function connect() {
        try { _ws = new WebSocket(_wsUrl()); } catch(e) { scheduleReconnect(); return; }

        _ws.onopen = function() {
            _reconnectDelay = 3000;
            _pingInterval = setInterval(function() {
                if (_ws && _ws.readyState === WebSocket.OPEN)
                    _ws.send(JSON.stringify({type:'ping'}));
            }, 25000);
        };

        _ws.onmessage = function(e) {
            var msg;
            try { msg = JSON.parse(e.data); } catch(x) { return; }

            if (msg.type === 'teller_request_new') {
                // أضف الطلب وحدّث الشاشة فورًا
                _loadRequests();
                var r = msg.request || {};
                var typeLabel = {special_price:'سعر مميز', urgent:'مستعجل', balance:'رصيد', general:'عام', reconcile:'مطابقة صندوق'}[r.request_type] || 'طلب';
                var isReconcile = r.request_type === 'reconcile';
                if (typeof showToast === 'function') {
                    if (isReconcile)
                        showToast('⚖️ ' + (r.teller_name||'تلر') + ' أجرى مطابقة الصندوق', 'success', '⚖️');
                    else
                        showToast('طلب جديد من ' + (r.teller_name||'تلر') + ' — ' + typeLabel + ' ⚡', 'warning', '📨');
                }
                // صوت تنبيه
                try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA').play().catch(()=>{}); } catch(x){}
            }

            if (msg.type === 'teller_status') {
                // حدّث مؤشر الاتصال لهذا التلر في القائمة
                _updateTellerOnlineStatus(msg.username, msg.online);
            }
        };

        _ws.onclose = function() {
            clearInterval(_pingInterval);
            scheduleReconnect();
        };
        _ws.onerror = function() { _ws.close(); };
    }

    function _updateTellerOnlineStatus(username, online) {
        // حدّث حالة التلر في مصفوفة البيانات المحلية إن وُجدت
        if (typeof window._tellers !== 'undefined') {
            window._tellers.forEach(function(t) {
                if (t.username === username || t.name === username)
                    t.status = online ? 'online' : 'offline';
            });
        }
        // حدّث الـ DOM مباشرة للتلر المعني
        var dot = document.querySelector('[data-teller="'+username+'"] .tc2-online-dot');
        var badge = document.querySelector('[data-teller="'+username+'"] .tc2-badge');
        if (dot) dot.style.display = online ? '' : 'none';
        if (badge) {
            badge.className = 'tc2-badge ' + (online ? 'online' : 'offline');
            badge.textContent = online ? '🟢 متصل' : '🔴 غير متصل';
        }
        // حدّث عداد المتصلين
        if (typeof updateStats === 'function') updateStats();
        if (typeof showToast === 'function')
            showToast((online ? '🟢 ' : '🔴 ') + username + (online ? ' اتصل بالنظام' : ' غادر النظام'), 'info', '👤');
    }

    function scheduleReconnect() {
        clearTimeout(_reconnectTimer);
        _reconnectTimer = setTimeout(function() {
            _reconnectDelay = Math.min(_reconnectDelay * 1.5, 30000);
            connect();
        }, _reconnectDelay);
    }

    document.addEventListener('DOMContentLoaded', connect);
})();

// ══════════════════════════════════════════════════════════════════
// صندوقي — My Supervisor Box
// ══════════════════════════════════════════════════════════════════

(function() {
  function _csrf() {
    return (document.cookie.split(';').find(function(c) { return c.trim().startsWith('csrftoken='); }) || '').split('=')[1] || '';
  }

  function myboxLoadAll() {
    myboxLoadBalances();
    myboxLoadLog();
    myboxPopulateTellerSelects();
  }
  window.myboxLoadAll = myboxLoadAll;

  function myboxLoadBalances() {
    var el = document.getElementById('mybox-balances');
    if (!el) return;
    fetch('/api/sv2/my-box', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success || data.ok) {
          var b = data.box;
          var flags = { USD: '🇺🇸', ILS: '🇵🇸', JOD: '🇯🇴' };
          var currencies = [
            { key: 'balanceUSD', label: 'USD' },
            { key: 'balanceILS', label: 'ILS' },
            { key: 'balanceJOD', label: 'JOD' }
          ];
          el.innerHTML = currencies.map(function(c) {
            var amount = b[c.key] || 0;
            var color = amount > 0 ? '#10b981' : 'rgba(200,210,220,0.4)';
            return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:18px;text-align:center;">' +
              '<div style="font-size:22px;margin-bottom:6px;">' + (flags[c.label] || '') + '</div>' +
              '<div style="font-size:11px;color:rgba(200,210,220,0.6);margin-bottom:6px;">' + c.label + '</div>' +
              '<div style="font-size:22px;font-weight:900;color:' + color + ';">' +
                Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
              '</div>' +
            '</div>';
          }).join('');
        }
      })
      .catch(function() {
        if (el) el.innerHTML = '<div style="color:#f87171;padding:16px;">تعذّر تحميل الرصيد</div>';
      });
  }

  function myboxLoadLog() {
    var body = document.getElementById('mybox-log-body');
    if (!body) return;
    fetch('/api/sv2/my-box/log', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var logs = data.log || [];
        if (!logs.length) {
          body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:rgba(200,210,220,0.4);">لا توجد حركات بعد</td></tr>';
          return;
        }
        var typeLabels = { deposit: 'إيداع من الإدارة', distribute: 'توزيع على تلر', reclaim: 'استرداد من تلر' };
        var typeColors = { deposit: '#10b981', distribute: '#f59e0b', reclaim: '#6366f1' };
        body.innerHTML = logs.map(function(l) {
          var dt = new Date(l.createdAt || l.created_at);
          var dtStr = dt.toLocaleDateString('ar-SA') + ' ' + dt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
          var opType = l.type || l.op_type;
          var color = typeColors[opType] || 'rgba(200,210,220,0.6)';
          return '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">' +
            '<td style="padding:10px 14px;color:' + color + ';font-weight:700;">' + (typeLabels[opType] || opType) + '</td>' +
            '<td style="padding:10px 14px;">' + l.currency + '</td>' +
            '<td style="padding:10px 14px;font-weight:800;">' + Number(l.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
            '<td style="padding:10px 14px;color:rgba(200,210,220,0.6);">' + Number(l.balAfter || l.balance_after || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
            '<td style="padding:10px 14px;">' + (l.teller || l.teller_username || '—') + '</td>' +
            '<td style="padding:10px 14px;font-size:11px;color:rgba(200,210,220,0.5);">' + dtStr + '</td>' +
          '</tr>';
        }).join('');
      })
      .catch(function() {
        if (body) body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#f87171;">تعذّر تحميل السجل</td></tr>';
      });
  }

  function myboxPopulateTellerSelects() {
    var distSel   = document.getElementById('mybox-dist-teller');
    var reclaimSel = document.getElementById('mybox-reclaim-teller');
    if (!distSel && !reclaimSel) return;
    // Use the already-loaded tellers array from the main script
    var list = typeof tellers !== 'undefined' ? tellers : [];
    if (!list.length) {
      // try fetching fresh
      fetch('/api/sv2/tellers', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var arr = data.tellers || [];
          _fillTellerSel(distSel, arr);
          _fillTellerSel(reclaimSel, arr);
        });
      return;
    }
    _fillTellerSel(distSel, list);
    _fillTellerSel(reclaimSel, list);
  }

  function _fillTellerSel(sel, list) {
    if (!sel) return;
    sel.innerHTML = list.map(function(t) {
      var name = t.name || t.username || t;
      var uname = t.username || t;
      return '<option value="' + uname + '">' + name + '</option>';
    }).join('');
    if (!list.length) sel.innerHTML = '<option value="">لا يوجد تلرات</option>';
  }

  window.myboxDistribute = function() {
    var teller   = document.getElementById('mybox-dist-teller').value;
    var currency = document.getElementById('mybox-dist-currency').value;
    var amount   = parseFloat(document.getElementById('mybox-dist-amount').value);
    if (!teller)         { if (typeof showToast === 'function') showToast('⚠️ اختر التلر', 'warn'); return; }
    if (!amount || amount <= 0) { if (typeof showToast === 'function') showToast('⚠️ أدخل مبلغاً صحيحاً', 'warn'); return; }
    fetch('/api/sv2/my-box/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrf() },
      body: JSON.stringify({ teller: teller, currency: currency, amount: amount })
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success || data.ok) {
          if (typeof showToast === 'function') showToast('✓ تم التوزيع بنجاح', 'ok');
          document.getElementById('mybox-dist-amount').value = '';
          myboxLoadAll();
        } else {
          if (typeof showToast === 'function') showToast('✗ ' + (data.message || data.error || 'فشل التوزيع'), 'error');
        }
      })
      .catch(function() { if (typeof showToast === 'function') showToast('✗ خطأ في الاتصال', 'error'); });
  };

  window.myboxReclaim = function() {
    var teller   = document.getElementById('mybox-reclaim-teller').value;
    var currency = document.getElementById('mybox-reclaim-currency').value;
    if (!teller) { if (typeof showToast === 'function') showToast('⚠️ اختر التلر', 'warn'); return; }
    if (!confirm('هل تريد استرداد رصيد ' + teller + ' بعملة ' + currency + ' إلى صندوقك؟')) return;
    fetch('/api/sv2/my-box/reclaim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrf() },
      body: JSON.stringify({ teller: teller, currency: currency })
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success || data.ok) {
          if (typeof showToast === 'function') showToast('✓ تم الاسترداد بنجاح', 'ok');
          myboxLoadAll();
        } else {
          if (typeof showToast === 'function') showToast('✗ ' + (data.message || data.error || 'فشل الاسترداد'), 'error');
        }
      })
      .catch(function() { if (typeof showToast === 'function') showToast('✗ خطأ في الاتصال', 'error'); });
  };

})();

// ══ رصيد صندوق المشرف — خارج الـ IIFE ══
function svLoadMyBox() {
  var el = document.getElementById('sv-mybox-balances');
  if (!el) return;
  fetch('/api/sv2/my-box', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.success && !data.ok) return;
      var b = data.box;
      var items = [
        { label: '🇺🇸 USD', val: b.balanceUSD },
        { label: '🇵🇸 ILS', val: b.balanceILS },
        { label: '🇯🇴 JOD', val: b.balanceJOD }
      ];
      el.innerHTML = items.map(function(i) {
        var color = i.val > 0 ? '#10b981' : 'rgba(200,210,220,0.4)';
        return '<div style="text-align:center;min-width:90px;">' +
          '<div style="font-size:10px;color:rgba(200,210,220,0.6);margin-bottom:3px;">' + i.label + '</div>' +
          '<div style="font-size:18px;font-weight:900;color:' + color + ';">' +
            Number(i.val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
          '</div>' +
        '</div>';
      }).join('<div style="width:1px;background:rgba(255,255,255,0.1);margin:0 4px;"></div>');
    })
    .catch(function() {});
}

// تحميل فوري + عند التنقل لقسم الأرصدة
setTimeout(svLoadMyBox, 300);
(function() {
  var _orig = window.switchPage;
  window.switchPage = function(page) {
    if (typeof _orig === 'function') _orig(page);
    if (page === 'balances') { svLoadMyBox(); loadBalanceLog(); }
  };
})();
