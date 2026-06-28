const RATES={USD:1,ILS:3.62,JOD:0.709,EUR:0.92,GBP:0.79};
const SYMBOLS={USD:'$',ILS:'₪',JOD:'JD ',EUR:'€',GBP:'£'};
let exMode='buy',exFilterMode='all',specialPriceActive=false;
let exCounter=1001,itCounter=5001,elCounter=9001;
let pendingAction=null;
let tellerBalances={USD:0,ILS:0,JOD:0};

// بيانات القارات
const continentData={
    asia:{name:'آسيا',countries:[{flag:'🇯🇴',name:'الأردن'},{flag:'🇵🇸',name:'فلسطين'},{flag:'🇸🇦',name:'السعودية'},{flag:'🇦🇪',name:'الإمارات'},{flag:'🇮🇶',name:'العراق'},{flag:'🇱🇧',name:'لبنان'},{flag:'🇸🇾',name:'سوريا'},{flag:'🇹🇷',name:'تركيا'},{flag:'🇮🇷',name:'إيران'},{flag:'🇰🇼',name:'الكويت'},{flag:'🇶🇦',name:'قطر'},{flag:'🇧🇭',name:'البحرين'},{flag:'🇴🇲',name:'عمان'},{flag:'🇾🇪',name:'اليمن'},{flag:'🇮🇳',name:'الهند'},{flag:'🇵🇰',name:'باكستان'},{flag:'🇨🇳',name:'الصين'},{flag:'🇯🇵',name:'اليابان'},{flag:'🇰🇷',name:'كوريا الجنوبية'},{flag:'🇲🇾',name:'ماليزيا'},{flag:'🇮🇩',name:'إندونيسيا'}]},
    europe:{name:'أوروبا',countries:[{flag:'🇩🇪',name:'ألمانيا'},{flag:'🇬🇧',name:'بريطانيا'},{flag:'🇫🇷',name:'فرنسا'},{flag:'🇮🇹',name:'إيطاليا'},{flag:'🇪🇸',name:'إسبانيا'},{flag:'🇳🇱',name:'هولندا'},{flag:'🇧🇪',name:'بلجيكا'},{flag:'🇸🇪',name:'السويد'},{flag:'🇳🇴',name:'النرويج'},{flag:'🇩🇰',name:'الدنمارك'},{flag:'🇦🇹',name:'النمسا'},{flag:'🇨🇭',name:'سويسرا'},{flag:'🇵🇱',name:'بولندا'},{flag:'🇷🇴',name:'رومانيا'},{flag:'🇺🇦',name:'أوكرانيا'}]},
    africa:{name:'أفريقيا',countries:[{flag:'🇪🇬',name:'مصر'},{flag:'🇲🇦',name:'المغرب'},{flag:'🇹🇳',name:'تونس'},{flag:'🇩🇿',name:'الجزائر'},{flag:'🇱🇾',name:'ليبيا'},{flag:'🇸🇩',name:'السودان'},{flag:'🇸🇴',name:'الصومال'},{flag:'🇳🇬',name:'نيجيريا'},{flag:'🇿🇦',name:'جنوب أفريقيا'},{flag:'🇰🇪',name:'كينيا'},{flag:'🇪🇹',name:'إثيوبيا'},{flag:'🇬🇭',name:'غانا'}]},
    americas:{name:'الأمريكتين',countries:[{flag:'🇺🇸',name:'أمريكا'},{flag:'🇨🇦',name:'كندا'},{flag:'🇲🇽',name:'المكسيك'},{flag:'🇧🇷',name:'البرازيل'},{flag:'🇦🇷',name:'الأرجنتين'},{flag:'🇨🇴',name:'كولومبيا'},{flag:'🇨🇱',name:'تشيلي'},{flag:'🇵🇪',name:'بيرو'},{flag:'🇻🇪',name:'فنزويلا'}]}
};

let exTxCounter=0;
let exLogs=[];
let itLogs=[];
let elLogs=[];
let allRecent=[];
let itDirection='out',itFilterMode='all',elFilterMode='all';
let ddActive={ex:false,el:false};
let selectedRecvMethod='';

// بيانات طرق الاستلام حسب الدولة
const countryRecvMethods={
    'الأردن':[{icon:'💵',name:'كاش — فروع الصرافة'},{icon:'🏦',name:'حساب بنكي'},{icon:'📱',name:'محفظة إلكترونية — JoMoPay'},{icon:'🏪',name:'وكيل معتمد'}],
    'مصر':[{icon:'💵',name:'كاش — فودافون كاش'},{icon:'🏦',name:'حساب بنكي'},{icon:'📱',name:'فودافون كاش'},{icon:'🏪',name:'فوري — نقاط البيع'}],
    'تركيا':[{icon:'💵',name:'كاش'},{icon:'🏦',name:'حساب بنكي — IBAN'},{icon:'📱',name:'Papara'},{icon:'💳',name:'PTT — البريد التركي'}],
    'السعودية':[{icon:'💵',name:'كاش'},{icon:'🏦',name:'حساب بنكي'},{icon:'📱',name:'STC Pay'},{icon:'🏪',name:'الراجحي — تحويل سريع'}],
    'الإمارات':[{icon:'💵',name:'كاش'},{icon:'🏦',name:'حساب بنكي'},{icon:'📱',name:'محفظة — PayIt'},{icon:'💳',name:'صراف آلي — ADQ'}],
    'العراق':[{icon:'💵',name:'كاش — وكيل'},{icon:'📱',name:'زين كاش'},{icon:'🏪',name:'آسيا حوالة'},{icon:'💳',name:'فاست باي'}],
    'لبنان':[{icon:'💵',name:'كاش — فرش دولار'},{icon:'📱',name:'OMT'},{icon:'🏦',name:'حساب بنكي'},{icon:'🏪',name:'ويسترن يونيون'}],
    'سوريا':[{icon:'💵',name:'كاش — وكيل'},{icon:'🏪',name:'الهرم للحوالات'},{icon:'📱',name:'حوالات سريعة'}],
    'ألمانيا':[{icon:'🏦',name:'حساب بنكي — IBAN'},{icon:'📱',name:'PayPal'},{icon:'💳',name:'Wise Transfer'},{icon:'🏪',name:'Western Union'}],
    'بريطانيا':[{icon:'🏦',name:'حساب بنكي — Sort Code'},{icon:'📱',name:'PayPal'},{icon:'💳',name:'Wise'},{icon:'🏪',name:'MoneyGram'}],
    'أمريكا':[{icon:'🏦',name:'حساب بنكي — Routing'},{icon:'📱',name:'Zelle / PayPal'},{icon:'💳',name:'Wise Transfer'},{icon:'🏪',name:'Western Union'}],
    '_default':[{icon:'💵',name:'كاش'},{icon:'🏦',name:'حساب بنكي'},{icon:'📱',name:'محفظة إلكترونية'},{icon:'🏪',name:'وكيل معتمد'}]
};

// ═══ ساعة ═══
function updateClock(){const n=new Date();const c=document.getElementById('clock');const d=document.getElementById('date');if(c)c.textContent=n.toLocaleTimeString('ar-EG-u-nu-latn',{hour12:false});if(d)d.textContent=n.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
setInterval(updateClock,1000);updateClock();

var deptNames={main:'القسم الرئيسي',exchange:'قسم الصرافة',international:'الحوالات الدولية',electronic:'المعاملات الإلكترونية',cashdesk:'السحب والإيداع',acctmgr:'إدارة الحسابات'};
var deptIcons={main:'🏠',exchange:'💱',international:'🌍',electronic:'📲',cashdesk:'🏦',acctmgr:'📒'};

function switchDept(dept){
    // التحقق من الصلاحية قبل الانتقال
    const _permKey={exchange:'exchange',international:'international',electronic:'electronic',acctmgr:'accounts'};
    const _pk=_permKey[dept];
    if(_pk){
        const _cachedPerms=(window._intlCache&&window._intlCache.teller_perms)||{};
        const _perms=_cachedPerms[_getTellerUser()]||_cachedPerms['me'];
        if(_perms&&_perms[_pk]===false) return; // الانتقال محظور
    }

    // إزالة لون الخلفية الخاص عند مغادرة قسم إدارة الحسابات
    document.querySelector('.main-area').style.background = '';

    // قسم إدارة الحسابات يفتح الواجهة مباشرة
    if(dept==='acctmgr'){
        document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
        document.querySelector('.nav-tab[data-dept="acctmgr"]').classList.add('active');
        document.querySelector('.main-area').style.background = '#EFF6FF';
        if(typeof apOpen === 'function') apOpen();
        return;
    }
    document.querySelectorAll('.dept-section').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.getElementById('dept-'+dept).classList.add('active');
    document.querySelector(`.nav-tab[data-dept="${dept}"]`).classList.add('active');
    document.getElementById('deptNameHeader').textContent=deptIcons[dept]+' '+deptNames[dept];
    if(dept==='exchange')renderExLogs();if(dept==='international')renderItLogs();if(dept==='electronic')renderElLogs();if(dept==='cashdesk')renderCdLogs();
    updateCounts();
}

function updateCounts(){
    document.getElementById('exchCount').textContent=exLogs.length;
    document.getElementById('intlCount').textContent=itLogs.length;
    document.getElementById('elecCount').textContent=elLogs.length;
    document.getElementById('cdCount').textContent=cdLogs.length;
    document.getElementById('exLogCount').textContent=exLogs.length+' عملية';
    document.getElementById('itLogCount').textContent=itLogs.length+' حوالة';
    document.getElementById('elLogCount').textContent=elLogs.length+' معاملة';
    document.getElementById('tsBuyCount').textContent=exLogs.filter(l=>l.mode==='buy').length;
    document.getElementById('tsSellCount').textContent=exLogs.filter(l=>l.mode==='sell').length;
    document.getElementById('tsTotalOps').textContent=exLogs.length;
    // حوالات
    const itOut=itLogs.filter(l=>l.direction==='out').length;
    const itIn=itLogs.filter(l=>l.direction==='in').length;
    ['','2'].forEach(s=>{
        const eo=document.getElementById('tsItOut'+s);if(eo)eo.textContent=itOut;
        const ei=document.getElementById('tsItIn'+s);if(ei)ei.textContent=itIn;
        const et=document.getElementById('tsItTotal'+s);if(et)et.textContent=itLogs.length;
    });
    document.getElementById('tsElCount').textContent=elLogs.length;
    const elVol=elLogs.reduce((s,l)=>s+l.amount,0);
    document.getElementById('tsElVol').textContent='$'+elVol.toLocaleString();
}

let mainLogFilter='all';
function renderMainRecent(){
    const SYMBOLS_LOCAL={USD:'$',ILS:'₪',JOD:'JD ',EUR:'€',GBP:'£',USDT:'USDT '};
    let rows=[];
    // صرافة
    exLogs.forEach(l=>{
        rows.push({dept:'exchange',deptName:'صرافة',deptTag:'tag-buy',client:l.client,
            detail:`${l.mode==='buy'?'شراء':'بيع'} ${SYMBOLS_LOCAL[l.from]||''}${l.fromAmt.toLocaleString()} → ${SYMBOLS_LOCAL[l.to]||''}${l.toAmt.toLocaleString()}`,
            amount:(l.mode==='buy'?'+':'-')+(SYMBOLS_LOCAL[l.to]||'')+l.toAmt.toLocaleString(),
            cls:l.mode==='buy'?'pos':'neg',time:l.time,id:l.id});
    });
    // حوالات
    itLogs.forEach(l=>{
        rows.push({dept:'international',deptName:l.direction==='out'?'صادرة':'واردة',deptTag:l.direction==='out'?'tag-send':'tag-receive',client:l.sender||l.recipient,
            detail:`${l.direction==='out'?'إرسال إلى':'استقبال من'} ${l.country}`,
            amount:(SYMBOLS_LOCAL[l.currency]||'$')+l.amount.toLocaleString(),
            cls:l.direction==='out'?'neg':'pos',time:l.time,id:l.id});
    });
    // إلكترونية
    elLogs.forEach(l=>{
        rows.push({dept:'electronic',deptName:l.platform,deptTag:'tag-elec',client:l.client,
            detail:`${l.platform} — ${l.status==='completed'?'مكتملة':'معلقة'}`,
            amount:(SYMBOLS_LOCAL[l.currency]||'$')+l.amount.toLocaleString(),
            cls:'neg',time:l.time,id:l.id});
    });
    // فلتر
    if(mainLogFilter!=='all') rows=rows.filter(r=>r.dept===mainLogFilter);
    // ترتيب حسب الوقت (الأحدث أولاً)
    rows.sort((a,b)=>(b.time||'').localeCompare(a.time||''));
    const body=document.getElementById('mainLogBody');
    const empty=document.getElementById('mainLogEmpty');
    const count=document.getElementById('mainLogCount');
    if(rows.length===0){
        body.innerHTML='';
        if(empty)empty.style.display='block';
        if(count)count.textContent='';
    }else{
        if(empty)empty.style.display='none';
        if(count)count.textContent=`عرض ${rows.length} عملية`;
        body.innerHTML=rows.map(r=>`<tr>
            <td style="font-size:11px;color:#0F172A;font-weight:700">${r.id}</td>
            <td><span class="tag ${r.deptTag}">${r.deptName}</span></td>
            <td style="font-weight:800;color:#0F172A">${r.client}</td>
            <td style="font-size:12px;color:#0F172A;font-weight:600">${r.detail}</td>
            <td class="amount-cell ${r.cls}" dir="ltr">${r.amount}</td>
            <td style="font-size:11px;color:#0F172A;font-weight:700">${r.time}</td>
        </tr>`).join('');
    }
}
function filterMainLog(el,mode){
    mainLogFilter=mode;
    document.querySelectorAll('.main-log-tab').forEach(t=>t.classList.remove('mlt-active'));
    el.classList.add('mlt-active');
    renderMainRecent();
}

// ═══ تسليم مزدوج ═══
function toggleDoubleDelivery(section){
    ddActive[section]=!ddActive[section];
    const toggle=document.querySelector(`#${section}DdSwitch`).closest('.double-delivery-toggle');
    const fields=document.getElementById(`${section}DdFields`);
    toggle.classList.toggle('dd-active',ddActive[section]);
    fields.classList.toggle('open',ddActive[section]);
    showToast(ddActive[section]?'تم تفعيل التسليم المزدوج':'تم إلغاء التسليم المزدوج',ddActive[section]?'success':'info','📋');
}
// ═══ أسعار التسليم المزدوج — يحددها المشرف ═══
const supervisorRates={cashRate:3.55, bankRate:3.52};

function initDdRates(){
    ['ex','el'].forEach(sec=>{
        const cashDisp=document.getElementById(sec+'DdCashRateDisplay');
        const bankDisp=document.getElementById(sec+'DdBankRateDisplay');
        const cashHid=document.getElementById(sec+'DdCashRate');
        const bankHid=document.getElementById(sec+'DdBankRate');
        if(cashDisp)cashDisp.textContent=supervisorRates.cashRate.toFixed(3);
        if(bankDisp)bankDisp.textContent=supervisorRates.bankRate.toFixed(3);
        if(cashHid)cashHid.value=supervisorRates.cashRate;
        if(bankHid)bankHid.value=supervisorRates.bankRate;
    });
}

// ═══ تطبيق بيانات الأسعار على واجهة التلر ═══
function _applyRatesData(d){
    if(d.ILS) RATES.ILS=d.ILS;
    if(d.JOD) RATES.JOD=d.JOD;
    if(d.EUR) RATES.EUR=d.EUR;
    if(d.GBP) RATES.GBP=d.GBP;
    if(d.cashRate) supervisorRates.cashRate=d.cashRate;
    if(d.bankRate) supervisorRates.bankRate=d.bankRate;
    initDdRates();calcExchange();calcDdExchange();calcDdElec();calcElecFee();updatePairRates();updateTellerBox();
}

// ═══ تحميل الأسعار من localStorage (فوري) ═══
function loadSupervisorPrices(){
    return _loadRatesFromLocalStorage();
}

function _loadRatesFromLocalStorage(){
    try{
        const d = window._intlCache && window._intlCache.tl_rates;
        if(!d) return false;
        _applyRatesData(d);
        const ts=d.time||'';
        showToast('تم تحديث الأسعار من المشرف — '+ts,'success','🔐');
        return true;
    }catch(e){return false}
}

// ═══ جلب الأسعار من الخادم في الخلفية (يعمل عبر الأجهزة المختلفة) ═══
function _fetchRatesFromServer(silent){
    fetch('/api/tl/rates')
        .then(r=>r.json())
        .then(resp=>{
            if(resp.success && resp.rates){
                const d=resp.rates;
                // تحديث الـ timestamp حتى لا يُطبَّق مرتين في الـ polling
                if(resp.setAt) _lastRatesTimestamp=resp.setAt;
                _applyRatesData(d);
                window._intlCache.tl_rates = d;
                if(!silent){const ts=d.time||'';showToast('تم تحديث الأسعار من الخادم — '+ts,'success','🔐');}
            }
        })
        .catch(()=>{});
}

// ═══ مساعد: اسم التلر الحالي ═══
function _getTellerUser(){
    try{
        // الأولوية: هوية التلر المحددة صراحةً في هذه الصفحة
        var identity=localStorage.getItem('intl_teller_identity');
        if(identity) return identity;
        var u=(window._currentUser||{});
        return u.username||u.fullname||'';
    }catch(e){return '';}
}
function _setTellerIdentity(username){
    if(!username) return;
    localStorage.setItem('intl_teller_identity',username);
    _session=null; _loadSession(); _updateSessionBar();
    // تحديث اسم العرض في الهيدر
    var el=document.getElementById('userDisplayName');
    var tellers=[];
    try{tellers=JSON.parse(localStorage.getItem('intl_sv_tellers')||'[]');}catch(e){}
    var t=tellers.find(function(x){return(x.username||x.name)===username;});
    if(el&&t) el.textContent=t.name||username;
    else if(el) el.textContent=username;
}

// تحميل الأرصدة من مشرف التلر (من الذاكرة أو الخادم)
function loadSupervisorBalance(){
    try{
        const name=_getTellerUser();
        const allBalances = (window._intlCache && window._intlCache.sv_balances) || {};
        const d = Array.isArray(allBalances)
          ? allBalances.find(b => (b.teller||b.username)===name)
          : allBalances[name];
        if(!d) return false;
        if(d.USD!==undefined) tellerBalances.USD=d.USD;
        if(d.ILS!==undefined) tellerBalances.ILS=d.ILS;
        if(d.JOD!==undefined) tellerBalances.JOD=d.JOD;
        updateTellerBox();updateMainBalances();
        showToast('تم تحديث أرصدة الصندوق من المشرف','success','💰');
        return true;
    }catch(e){return false}
}

// جلب الرصيد من الخادم (يعمل عبر الأجهزة المختلفة)
var _lastBalanceTimestamp='';
function _fetchBalanceFromServer(){
    fetch('/api/tl/balance')
        .then(r=>r.json())
        .then(resp=>{
            if(!resp.success||!resp.balance) return;
            const b=resp.balance;
            const ts=b.setAt||b.timestamp||'';
            if(ts&&ts===_lastBalanceTimestamp) return; // لا جديد
            if(ts) _lastBalanceTimestamp=ts;
            // الخادم يُرجع أحرفاً صغيرة
            if(b.usd!==undefined) tellerBalances.USD=b.usd;
            if(b.ils!==undefined) tellerBalances.ILS=b.ils;
            if(b.jod!==undefined) tellerBalances.JOD=b.jod;
            // تطبيق الصلاحيات إذا وُجدت وتخزينها
            if(resp.permissions&&typeof _applyPermsData==='function'){
                const _all=window._intlCache.teller_perms||{};
                _all['me']=resp.permissions;
                const _n=_getTellerUser();if(_n)_all[_n]=resp.permissions;
                window._intlCache.teller_perms=_all;
                _applyPermsData(resp.permissions);
            }
            updateTellerBox();updateMainBalances();
        })
        .catch(()=>{});
}
// جلب الصلاحيات مبكراً + الرصيد + استطلاع دوري
// _fetchBalanceFromServer يُرجع الصلاحيات ضمن الاستجابة أيضاً
setTimeout(applyPermissions, 50);
setTimeout(_fetchBalanceFromServer, 1200);
setInterval(_fetchBalanceFromServer, 10000);

// تطبيق الصلاحيات من المشرف
function _applyPermsData(perms){
    if(!perms) return;
    try{
        // التبويبات المرتبطة بالصلاحيات
        const tabMap={
            exchange:     '.nav-tab[data-dept="exchange"]',
            international:'.nav-tab[data-dept="international"]',
            electronic:   '.nav-tab[data-dept="electronic"]',
            accounts:     '.nav-tab[data-dept="acctmgr"]',
        };

        // إخفاء/إظهار التبويبات
        Object.entries(tabMap).forEach(([key,sel])=>{
            const el=document.querySelector(sel);
            if(el) el.style.display=perms[key]===false?'none':'';
        });

        // إذا كان التلر في قسم محظور → انقله إلى الرئيسي
        const activeDeptEl=document.querySelector('.dept-section.active');
        if(activeDeptEl){
            const activeDept=activeDeptEl.id.replace('dept-','');
            // رسم الخريطة: مفتاح الصلاحية → id القسم
            const deptKey={exchange:'exchange',international:'international',electronic:'electronic',acctmgr:'accounts'};
            const keyForActive=deptKey[activeDept];
            if(keyForActive && perms[keyForActive]===false){
                switchDept('main');
            }
        }

        // زر السعر المميز
        const spBtn=document.getElementById('specialPriceBtn');
        if(spBtn) spBtn.style.display=perms.specialPrice===false?'none':'';

        // أزرار التسليم المزدوج
        const ddBtns=document.querySelectorAll('[id$="DdSwitch"],[id^="exDdSwitch"],[id^="elDdSwitch"]');
        ddBtns.forEach(b=>{if(b)b.style.display=perms.doubleDelivery===false?'none':''});

    }catch(e){}
}

function applyPermissions(){
    fetch('/api/tl/balance')
        .then(r=>r.json())
        .then(resp=>{
            if(!resp.success||!resp.permissions) return;
            const perms=resp.permissions;
            // خزّن بمفتاح 'me' وبالاسم معاً لضمان العثور عليها
            const all=window._intlCache.teller_perms||{};
            all['me']=perms;
            const name=_getTellerUser();
            if(name) all[name]=perms;
            window._intlCache.teller_perms=all;
            _applyPermsData(perms);
        })
        .catch(()=>{
            const all=window._intlCache.teller_perms||{};
            const name=_getTellerUser();
            _applyPermsData(all[name]||all['me']);
        });
}

// دفع عملية إلى سجل المشرف
function _pushToSvOps(id,type,desc,amount,currency){
    try{
        const name=_getTellerUser();
        const lsOps=JSON.parse(localStorage.getItem('intl_sv_ops')||'[]');
        lsOps.unshift({id,teller:name,type,desc,amount,currency,status:'completed',time:new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})});
        localStorage.setItem('intl_sv_ops',JSON.stringify(lsOps.slice(0,200)));
    }catch(e){}
}

// استطلاع دوري للأسعار من الخادم كل 5 ثوانٍ (يعمل عبر الأجهزة المختلفة)
let _lastRatesTimestamp='';
setTimeout(()=>_fetchRatesFromServer(true), 800);  // جلب فوري عند تحميل الصفحة
setInterval(function(){
    fetch('/api/tl/rates').then(r=>r.json()).then(resp=>{
        if(resp.success&&resp.setAt&&resp.setAt!==_lastRatesTimestamp){
            _lastRatesTimestamp=resp.setAt;
            _applyRatesData(resp.rates);
            window._intlCache.tl_rates = resp.rates;
            const ts=(resp.rates&&resp.rates.time)||'';
            showToast('تم تحديث الأسعار من المشرف — '+ts,'success','🔐');
        }
    }).catch(()=>{});
},5000);

// مراقبة التحديثات الفورية من المشرف (نفس الجهاز — نفس المتصفح تبويب آخر)
// نستخدم localStorage مباشرة لأن البيانات موجودة فيه قبل أن يكتمل الـ POST للخادم
window.addEventListener('storage',function(e){
    // الأسعار والأرصدة والصلاحيات تأتي عبر الخادم مباشرةً (polling) — لا عبر localStorage
    // الجلسات والإشعارات تأتي من الخادم عبر polling — لا تعتمد على localStorage
    if(e.key==='intl_teller_requests'&&e.newValue){
        // التحقق من موافقة/رفض المشرف على طلب السعر المميز
        try{
            const reqs=JSON.parse(e.newValue);
            const name=_getTellerUser();
            reqs.filter(r=>r.tellerName===name&&(r.status==='approved'||r.status==='rejected')&&r._notified!==true).forEach(r=>{
                if(r.status==='approved'&&r.type==='special_price'){
                    _handleSpApproved(r);
                }else if(r.status==='rejected'&&r.type==='special_price'){
                    _handleSpRejected(r);
                }
            });
        }catch(err){}
    }
});


function calcDdExchange(){
    // المبلغ الأصلي من حقل الصرافة الرئيسي (ما يدفعه العميل)
    const totalAmt=parseFloat(document.getElementById('exFrom')?.value)||0;
    const fromCur=document.getElementById('exFromCur')?.value||'USD';
    const SYM={USD:'$',ILS:'₪',JOD:'JD ',EUR:'€',GBP:'£'};
    const s=SYM[fromCur]||'$';
    // عرض المبلغ المراد تصريفه
    const srcEl=document.getElementById('exDdSourceAmt');
    if(srcEl) srcEl.textContent=s+totalAmt.toLocaleString();
    // كاش: مبلغ × سعر الكاش = ما يستلمه شيكل
    const cashAmt=parseFloat(document.getElementById('exDdCashAmt')?.value)||0;
    const cashRate=parseFloat(document.getElementById('exDdCashRate')?.value)||0;
    const cashResult=cashAmt*cashRate;
    const cashEl=document.getElementById('exDdCashResult');
    if(cashEl) cashEl.textContent='₪'+cashResult.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    // بنكي: مبلغ × سعر البنكي = ما يستلمه شيكل بنك
    const bankAmt=parseFloat(document.getElementById('exDdBankAmt')?.value)||0;
    const bankRate=parseFloat(document.getElementById('exDdBankRate')?.value)||0;
    const bankResult=bankAmt*bankRate;
    const bankEl=document.getElementById('exDdBankResult');
    if(bankEl) bankEl.textContent='₪'+bankResult.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    // ملخص
    const used=cashAmt+bankAmt;
    const remain=totalAmt-used;
    const usedEl=document.getElementById('exDdUsedAmt');
    if(usedEl) usedEl.textContent=s+used.toLocaleString();
    const remainEl=document.getElementById('exDdRemain');
    if(remainEl){
        remainEl.textContent=s+remain.toLocaleString();
        remainEl.className='dd-sum-val dd-sum-remain'+(remain===0?' zero':remain<0?' over':'');
    }
    const totalEl=document.getElementById('exDdTotalResult');
    if(totalEl) totalEl.textContent='₪'+(cashResult+bankResult).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}

function calcDdElec(){
    // المبلغ الأصلي من حقل الإلكتروني الرئيسي
    const totalAmt=parseFloat(document.getElementById('elAmount')?.value)||0;
    const fromCur=document.getElementById('elCurrency')?.value||'USDT';
    const SYM={USD:'$',USDT:'USDT ',ILS:'₪',EUR:'€'};
    const s=SYM[fromCur]||'$';
    const srcEl=document.getElementById('elDdSourceAmt');
    if(srcEl) srcEl.textContent=s+totalAmt.toLocaleString();
    // كاش
    const cashAmt=parseFloat(document.getElementById('elDdCashAmt')?.value)||0;
    const cashRate=parseFloat(document.getElementById('elDdCashRate')?.value)||0;
    const cashResult=cashAmt*cashRate;
    const cashEl=document.getElementById('elDdCashResult');
    if(cashEl) cashEl.textContent='₪'+cashResult.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    // بنكي
    const bankAmt=parseFloat(document.getElementById('elDdBankAmt')?.value)||0;
    const bankRate=parseFloat(document.getElementById('elDdBankRate')?.value)||0;
    const bankResult=bankAmt*bankRate;
    const bankEl=document.getElementById('elDdBankResult');
    if(bankEl) bankEl.textContent='₪'+bankResult.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    // ملخص
    const used=cashAmt+bankAmt;
    const remain=totalAmt-used;
    const usedEl=document.getElementById('elDdUsedAmt');
    if(usedEl) usedEl.textContent=s+used.toLocaleString();
    const remainEl=document.getElementById('elDdRemain');
    if(remainEl){
        remainEl.textContent=s+remain.toLocaleString();
        remainEl.className='dd-sum-val dd-sum-remain'+(remain===0?' zero':remain<0?' over':'');
    }
    const totalEl=document.getElementById('elDdTotalResult');
    if(totalEl) totalEl.textContent='₪'+(cashResult+bankResult).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}

function handleBankNotice(input,section){
    const file=input.files[0];
    const label=document.getElementById(section+'BankUploadLabel');
    const nameSpan=document.getElementById(section+'BankFileName');
    if(file){
        label.classList.add('has-file');
        nameSpan.textContent=file.name;
        showToast('تم تحميل إشعار البنك: '+file.name,'success','📎');
    }else{
        label.classList.remove('has-file');
        nameSpan.textContent='';
    }
}

// ═══ سعر مميز ═══
let spApproved=false;
function toggleSpecialPrice(){
    specialPriceActive=!specialPriceActive;
    const box=document.getElementById('specialPriceBox');
    box.style.display=specialPriceActive?'block':'none';
    document.getElementById('specialPriceBtn').style.background=specialPriceActive?'rgba(232,182,36,0.2)':'rgba(232,182,36,0.08)';
    if(!specialPriceActive){
        document.getElementById('specialRateInput').value='';
        document.getElementById('specialRateInput').disabled=true;
        spApproved=false;
        document.getElementById('spStatus').style.display='none';
        const sendBtn=document.getElementById('spSendBtn');
        if(sendBtn){sendBtn.disabled=false;sendBtn.innerHTML='إرسال طلب للمشرف'}
        const lockMsg=document.getElementById('spLockMsg');if(lockMsg)lockMsg.style.display='block';
        const appMsg=document.getElementById('spApprovedMsg');if(appMsg)appMsg.style.display='none';
        const reqRate=document.getElementById('spRequestedRate');if(reqRate)reqRate.value='';
        const reqReason=document.getElementById('spRequestReason');if(reqReason)reqReason.value='';
        calcExchange();
    }
    showToast(specialPriceActive?'تم تفعيل السعر المميز':'تم إلغاء السعر المميز',specialPriceActive?'warning':'info','⭐');
}
// ═══ باص تلر — Pass Teller ═══
let _ptLogs=[];
let _ptCounter=1;

function openPassTeller(){
    // Read current exchange form values
    const clientEl=document.getElementById('exClient');const client=(clientEl&&clientEl.value.trim())||'';
    const clientIdEl=document.getElementById('exClientId');const clientId=(clientIdEl&&clientIdEl.value.trim())||'';
    const fromAmt=parseFloat(document.getElementById('exFrom').value)||0;
    const toAmt=parseFloat(document.getElementById('exTo').textContent.replace(/[^0-9.]/g,''))||0;
    const mode=document.getElementById('exSubmitBtn').textContent.includes('شراء')?'buy':'sell';
    const pair=document.querySelector('.pair-card.active-pair');
    const pairText=pair?pair.querySelector('.pair-flags')?.textContent||'—':'—';
    const rateEl=document.getElementById('exRate');const rate=(rateEl&&rateEl.value)||'—';
    const sym1=document.querySelector('.from-sym');const sym2=document.querySelector('.to-sym');
    // Fill strip
    document.getElementById('ptTxType').textContent=mode==='buy'?'شراء':'بيع';
    document.getElementById('ptTxFrom').textContent=fromAmt>0?(sym1?sym1.textContent:'$')+fromAmt.toLocaleString():'—';
    document.getElementById('ptTxTo').textContent=toAmt>0?(sym2?sym2.textContent:'₪')+toAmt.toLocaleString():'—';
    document.getElementById('ptTxRate').textContent=rate!=='—'?rate:'—';
    // Fill client
    document.getElementById('ptClientName').textContent=client||'لم يتم إدخال العميل';
    document.getElementById('ptClientId').textContent=clientId||'—';
    document.getElementById('ptClientAvatar').textContent=client?client[0].toUpperCase():'؟';
    const badge=document.getElementById('ptModeBadge');
    badge.textContent=mode==='buy'?'شراء':'بيع';
    badge.className='pt-client-badge'+(mode==='sell'?' sell':'');
    // Populate teller select from localStorage
    const select=document.getElementById('ptTargetTeller');
    select.innerHTML='<option value="">— اختر التلر —</option>';
    try{const tellers=JSON.parse(localStorage.getItem('intl_sv_tellers')||'[]');
        tellers.filter(t=>t.status==='online').forEach(t=>{const opt=document.createElement('option');opt.value=t.id;opt.textContent=`${t.name} (${t.id})`;select.appendChild(opt)});
        if(tellers.filter(t=>t.status==='online').length===0){
            ['تلر 1','تلر 2','تلر 3'].forEach((n,i)=>{const opt=document.createElement('option');opt.value='TL-'+(i+1);opt.textContent=n;select.appendChild(opt)});
        }
    }catch(e){['تلر 1','تلر 2','تلر 3'].forEach((n,i)=>{const opt=document.createElement('option');opt.value='TL-'+(i+1);opt.textContent=n;select.appendChild(opt)})}
    // Store current data for confirm
    document.getElementById('passTellerModal')._ptData={client,clientId,fromAmt,toAmt,mode,rate,pairText};
    document.getElementById('passTellerModal').classList.add('visible');
    showToast('تأكد من بيانات العملية قبل التحويل','info','🔄');
}

function confirmPassTeller(){
    const select=document.getElementById('ptTargetTeller');
    if(!select.value){showToast('يرجى اختيار التلر المستلم','error','❌');select.classList.add('error');setTimeout(()=>select.classList.remove('error'),600);return}
    const note=(document.getElementById('ptNote').value||'').trim();
    const data=document.getElementById('passTellerModal')._ptData||{};
    const tellerOpt=select.options[select.selectedIndex];
    const targetName=tellerOpt.textContent;
    const id='PT-'+_ptCounter++;
    const now=new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
    _ptLogs.unshift({id,client:data.client||'—',targetTeller:targetName,mode:data.mode,fromAmt:data.fromAmt,toAmt:data.toAmt,rate:data.rate,note,time:now});
    // Push to supervisor ops
    _pushToSvOps(id,'pass',`باص تلر → ${targetName} — ${data.client||'عميل'} (${data.mode==='buy'?'شراء':'بيع'} ${data.fromAmt})`,data.fromAmt,'USD');
    // Push notification to localStorage for target teller
    try{
        const ptQueue=JSON.parse(localStorage.getItem('intl_pt_queue')||'[]');
        ptQueue.unshift({id,from:_getTellerUser()||'تلر',to:select.value,toName:targetName,client:data.client,mode:data.mode,fromAmt:data.fromAmt,toAmt:data.toAmt,rate:data.rate,note,time:now,status:'pending'});
        localStorage.setItem('intl_pt_queue',JSON.stringify(ptQueue.slice(0,50)));
    }catch(e){}
    closeModal('passTellerModal');
    document.getElementById('ptNote').value='';document.getElementById('ptTargetTeller').value='';
    showToast(`تم تحويل العملية إلى ${targetName}`,'success','🔄');
    allRecent.unshift({icon:'🔄',type:'pass',name:`باص تلر → ${targetName}`,desc:data.client||'—',time:now,amount:data.fromAmt?`$${data.fromAmt}`:'—',cls:'neg'});
    renderMainRecent();
}

let _spPollInterval=null;
let _spPendingReqId=null;
function requestSpecialPrice(){
    const reqRate=document.getElementById('spRequestedRate');
    const reqReason=document.getElementById('spRequestReason');
    if(reqRate&&!reqRate.value){showToast('أدخل السعر المطلوب أولاً','error','❌');return}
    const btn=document.getElementById('spSendBtn');
    const status=document.getElementById('spStatus');
    const statusIcon=document.getElementById('spStatusIcon');
    const statusText=document.getElementById('spStatusText');
    btn.disabled=true;btn.innerHTML='جاري الإرسال...';
    status.style.display='flex';status.className='sp-status';
    if(statusIcon)statusIcon.textContent='⏳';
    if(statusText)statusText.textContent='في انتظار موافقة المشرف...';
    showToast('تم إرسال طلب السعر المميز للمشرف','info','📨');
    const name=_getTellerUser();
    const newId='SP-'+Date.now();
    _spPendingReqId=newId;
    const payload={
        id:newId,type:'special_price',tellerName:name,from:name,
        text:'طلب سعر مميز: '+reqRate.value+(reqReason&&reqReason.value?' — '+reqReason.value:''),
        requestedRate:reqRate.value,time:'الآن',status:'pending',reply:''
    };
    // حفظ في localStorage كـ fallback محلي
    try{const r=JSON.parse(localStorage.getItem('intl_teller_requests')||'[]');r.unshift(payload);localStorage.setItem('intl_teller_requests',JSON.stringify(r));}catch(e){}
    // إرسال للخادم
    const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
    fetch('/api/tl/requests',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify(payload)})
        .catch(()=>{});
    _pollSpecialPrice(newId);
}
function _pollSpecialPrice(reqId){
    if(_spPollInterval) clearInterval(_spPollInterval);
    _spPollInterval=setInterval(()=>{
        // استطلاع من الخادم — GET كل الطلبات وفلتر بـ reqId
        fetch('/api/tl/requests')
            .then(r=>r.json())
            .then(resp=>{
                if(!resp.success||!Array.isArray(resp.requests)) return;
                const r=resp.requests.find(x=>String(x.id)===String(reqId)||x.requestId===reqId);
                if(!r) return;
                if(r.status==='approved'){clearInterval(_spPollInterval);_spPollInterval=null;_handleSpApproved(r);}
                else if(r.status==='rejected'){clearInterval(_spPollInterval);_spPollInterval=null;_handleSpRejected(r);}
            })
            .catch(()=>{
                // fallback: localStorage
                try{
                    const reqs=JSON.parse(localStorage.getItem('intl_teller_requests')||'[]');
                    const r=reqs.find(x=>x.id===reqId);
                    if(r&&r.status==='approved'){clearInterval(_spPollInterval);_spPollInterval=null;_handleSpApproved(r);}
                    else if(r&&r.status==='rejected'){clearInterval(_spPollInterval);_spPollInterval=null;_handleSpRejected(r);}
                }catch(e){}
            });
    },2000);
    setTimeout(()=>{if(_spPollInterval){clearInterval(_spPollInterval);_spPollInterval=null;}},300000);
}
function _handleSpApproved(r){
    const btn=document.getElementById('spSendBtn');
    const status=document.getElementById('spStatus');
    const statusIcon=document.getElementById('spStatusIcon');
    const statusText=document.getElementById('spStatusText');
    if(status){status.className='sp-status approved';}
    if(statusIcon)statusIcon.textContent='✅';
    if(statusText)statusText.textContent='تمت الموافقة من المشرف!';
    if(btn){btn.innerHTML='تمت الموافقة';}
    const rateInput=document.getElementById('specialRateInput');
    if(rateInput){rateInput.disabled=false;if(r.requestedRate)rateInput.value=r.requestedRate;}
    const lockMsg=document.getElementById('spLockMsg');if(lockMsg)lockMsg.style.display='none';
    const appMsg=document.getElementById('spApprovedMsg');if(appMsg)appMsg.style.display='block';
    applySpecialRate();
    showToast('تمت موافقة المشرف على السعر المميز!','success','✅');
}
function _handleSpRejected(r){
    const btn=document.getElementById('spSendBtn');
    const status=document.getElementById('spStatus');
    const statusIcon=document.getElementById('spStatusIcon');
    const statusText=document.getElementById('spStatusText');
    if(status){status.className='sp-status';}
    if(statusIcon)statusIcon.textContent='❌';
    if(statusText)statusText.textContent='رفض المشرف الطلب'+(r.reply?' — '+r.reply:'');
    if(btn){btn.disabled=false;btn.innerHTML='إعادة الطلب';}
    showToast('رفض المشرف طلب السعر المميز','error','❌');
}
function applySpecialRate(){calcExchange()}

// ═══ صرافة ═══
function setExMode(mode){
    exMode=mode;
    const card=document.getElementById('exchangeToolCard'),label=document.getElementById('modeLabel'),btn=document.getElementById('exSubmitBtn');
    document.querySelectorAll('.bs-btn').forEach(b=>b.classList.remove('active'));
    if(mode==='buy'){
        document.querySelector('.buy-btn').classList.add('active');
        card.className='tool-card mode-buy';
        label.textContent='شراء';
        label.style.cssText='background:rgba(34,197,94,0.1);color:var(--success);border:1px solid rgba(34,197,94,0.2)';
        if(btn){btn.style.background='linear-gradient(135deg,var(--success),#16a34a)';btn.textContent='تنفيذ عملية الشراء';}
        document.getElementById('fromLabel').textContent='العميل يدفع';
        document.getElementById('toLabel').textContent='العميل يستلم';
    } else {
        document.querySelector('.sell-btn').classList.add('active');
        card.className='tool-card mode-sell';
        label.textContent='بيع';
        label.style.cssText='background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2)';
        if(btn){btn.style.background='linear-gradient(135deg,var(--danger),#dc2626)';btn.textContent='تنفيذ عملية البيع';}
        document.getElementById('fromLabel').textContent='العميل يبيع';
        document.getElementById('toLabel').textContent='العميل يستلم';
    }
    showToast(mode==='buy'?'وضع الشراء':'وضع البيع',mode==='buy'?'success':'error',mode==='buy'?'📈':'📉');
}

function toggleWorldPrices(){document.getElementById('wpBody').classList.toggle('open');document.getElementById('wpArrow').classList.toggle('open')}

function calcExchange(){
    const amt=parseFloat(document.getElementById('exFrom').value)||0;
    const from=document.getElementById('exFromCur').value,to=document.getElementById('exToCur').value;
    let rate=RATES[to]/RATES[from];
    const specialRate=parseFloat(document.getElementById('specialRateInput').value);
    if(specialPriceActive&&specialRate>0)rate=specialRate;
    document.getElementById('exTo').textContent=(amt*rate).toFixed(2);
    document.getElementById('exRate').textContent=`1 ${from} = ${rate.toFixed(4)} ${to}`;
    updateActivePair(from,to);updatePairRates();
    if(ddActive.ex) calcDdExchange();
}
function swapEx(){
  const a=document.getElementById('exFromCur'),b=document.getElementById('exToCur');
  const t=a.value; a.value=b.value; b.value=t;
  calcExchange();
}
function setCur(side,cur,btn){
  const selId=side==='from'?'exFromCur':'exToCur';
  const tabsId=side==='from'?'fromCurTabs':'toCurTabs';
  document.getElementById(selId).value=cur;
  document.querySelectorAll('#'+tabsId+' .calc-cur-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  calcExchange();
}
function selectPair(f,t){document.getElementById('exFromCur').value=f;document.getElementById('exToCur').value=t;calcExchange();document.getElementById('exFrom').focus();document.getElementById('exFrom').value='';document.getElementById('exTo').textContent='0.00';showToast(`تم اختيار ${f}/${t}`,'success','⚡')}
function updateActivePair(from,to){document.querySelectorAll('.pair-card').forEach(c=>c.classList.remove('active-pair'));const el=document.getElementById(`pair-${from}-${to}`)||document.getElementById(`pair-${to}-${from}`);if(el)el.classList.add('active-pair')}
function updatePairRates(){
  [['USD','JOD'],['USD','ILS'],['ILS','JOD']].forEach(([a,b])=>{
    const r=RATES[b]/RATES[a];
    const el=document.getElementById(`pairRate-${a}-${b}`);
    if(el)el.textContent=`1 ${a} = ${(r<1?r.toFixed(4):r.toFixed(3))} ${b}`;
  });
  /* تحديث أسعار شبكة QX */
  [['USD','JOD'],['USD','ILS'],['ILS','JOD'],['JOD','USD'],['JOD','ILS'],['ILS','USD']].forEach(([a,b])=>{
    const el=document.getElementById(`qxRate-${a}-${b}`);
    if(el&&RATES[a]&&RATES[b]){const r=RATES[b]/RATES[a];el.textContent=(r<1?r.toFixed(4):r.toFixed(3));}
  });
}
function updateTellerBox(){
    document.getElementById('tellerUSD').textContent='$'+tellerBalances.USD.toLocaleString();
    document.getElementById('tellerILS').textContent='₪'+tellerBalances.ILS.toLocaleString();
    document.getElementById('tellerJOD').textContent='JD '+tellerBalances.JOD.toLocaleString();
    const tot=tellerBalances.USD+(tellerBalances.ILS/RATES.ILS)+(tellerBalances.JOD/RATES.JOD);
    document.getElementById('tellerTotal').textContent='$'+Math.round(tot).toLocaleString();
    // Sync all teller boxes
    document.querySelectorAll('.teller-total-sync').forEach(e=>e.textContent='$'+Math.round(tot).toLocaleString());
    document.querySelectorAll('.teller-usd-sync').forEach(e=>e.textContent='$'+tellerBalances.USD.toLocaleString());
    document.querySelectorAll('.teller-ils-sync').forEach(e=>e.textContent='₪'+tellerBalances.ILS.toLocaleString());
    document.querySelectorAll('.teller-jod-sync').forEach(e=>e.textContent='JD '+tellerBalances.JOD.toLocaleString());
    if(typeof updateMainBalances==='function')updateMainBalances();
}

function submitExchange(){
    const amt=parseFloat(document.getElementById('exFrom').value)||0;const client=document.getElementById('exClient').value.trim()||'—';
    if(amt<=0){showToast('أدخل مبلغاً صحيحاً','error','❌');return}
    const from=document.getElementById('exFromCur').value,to=document.getElementById('exToCur').value,result=document.getElementById('exTo').textContent;
    let rate=RATES[to]/RATES[from];const sr=parseFloat(document.getElementById('specialRateInput').value);if(specialPriceActive&&sr>0)rate=sr;
    pendingAction={type:'exchange',data:{client,from,to,fromAmt:amt,toAmt:parseFloat(result),rate:rate.toFixed(4),mode:exMode,special:specialPriceActive,dd:ddActive.ex,ddAmt2:ddActive.ex?parseFloat(document.getElementById('exDdAmount2')?.value)||0:0,ddCur2:ddActive.ex?(document.getElementById('exDdCur2')?.value||''):''}};
    document.getElementById('cmIcon').textContent=exMode==='buy'?'📈':'📉';document.getElementById('cmTitle').textContent=exMode==='buy'?'تأكيد شراء':'تأكيد بيع';
    let ddHtml='';
    if(ddActive.ex&&pendingAction.data.ddAmt2>0){ddHtml=`<div class="confirm-row"><span class="c-l">تسليم ثاني</span><span class="c-v" dir="ltr" style="color:var(--primary)">${SYMBOLS[pendingAction.data.ddCur2]||''}${pendingAction.data.ddAmt2.toFixed(2)}</span></div>`}
    document.getElementById('cmDetails').innerHTML=`<div class="confirm-row"><span class="c-l">النوع</span><span class="c-v" style="color:${exMode==='buy'?'var(--success)':'var(--danger)'}">${exMode==='buy'?'شراء':'بيع'}</span></div>${specialPriceActive?'<div class="confirm-row"><span class="c-l">سعر مميز</span><span class="c-v" style="color:var(--accent)">نعم</span></div>':''}<div class="confirm-row"><span class="c-l">العميل</span><span class="c-v">${client}</span></div><div class="confirm-row"><span class="c-l">يدفع</span><span class="c-v" dir="ltr">${SYMBOLS[from]}${amt.toFixed(2)}</span></div><div class="confirm-row"><span class="c-l">يستلم</span><span class="c-v" dir="ltr" style="color:var(--success)">${SYMBOLS[to]}${result}</span></div>${ddHtml}<div class="confirm-row"><span class="c-l">السعر</span><span class="c-v" dir="ltr">${rate.toFixed(4)}</span></div>`;
    document.getElementById('confirmModal').classList.add('visible');
}
function clearExchange(){['exFrom','exClient','exClientId','exNote'].forEach(id=>document.getElementById(id).value='');document.getElementById('exTo').textContent='0.00';if(ddActive.ex){ddActive.ex=false;document.getElementById('exDdSwitch').closest('.double-delivery-toggle').classList.remove('dd-active');document.getElementById('exDdFields').classList.remove('open')};const dd2=document.getElementById('exDdAmount2');if(dd2)dd2.value='';const ddr=document.getElementById('exDdResult2');if(ddr)ddr.textContent='0.00';showToast('تم مسح النموذج','info','♻️')}
function filterExLogs(el,mode){exFilterMode=mode;el.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('fc-on'));el.classList.add('fc-on');renderExLogs()}
function renderExLogs(){let data=exLogs;if(exFilterMode==='buy')data=exLogs.filter(l=>l.mode==='buy');else if(exFilterMode==='sell')data=exLogs.filter(l=>l.mode==='sell');document.getElementById('exLogBody').innerHTML=data.map(l=>`<tr><td style="font-size:12px;color:var(--text-muted)">${l.id}</td><td><span class="tag ${l.mode==='buy'?'tag-buy':'tag-sell'}">${l.mode==='buy'?'شراء':'بيع'}</span></td><td style="font-weight:700">${l.client}</td><td class="amount-cell neg">-${SYMBOLS[l.from]}${l.fromAmt.toLocaleString()}</td><td class="amount-cell pos">+${SYMBOLS[l.to]}${l.toAmt.toLocaleString()}</td><td dir="ltr" style="text-align:right;font-weight:600">${l.rate}</td><td style="font-size:12px;color:var(--text-muted)">${l.time}</td></tr>`).join('')}

// ═══ القارات ═══
function buildCountryLists(){
    // بناء قوائم الدول للإرسال والاستقبال
    Object.keys(continentData).forEach(key=>{
        const el=document.getElementById('countries-'+key);
        if(el)el.innerHTML=continentData[key].countries.map(c=>`<div class="country-item" onclick="selectCountryNew('${c.name}','${key}','${c.flag}','out')"><span class="cf">${c.flag}</span> ${c.name}</div>`).join('');
        const elR=document.getElementById('countries-recv-'+key);
        if(elR)elR.innerHTML=continentData[key].countries.map(c=>`<div class="country-item" onclick="selectCountryNew('${c.name}','${key}','${c.flag}','in')"><span class="cf">${c.flag}</span> ${c.name}</div>`).join('');
    });
    // بناء قائمة الدول المنسدلة للإرسال
    const sel=document.getElementById('itRecvCountry');
    const allCountries=[];
    Object.values(continentData).forEach(cont=>cont.countries.forEach(c=>{if(!allCountries.find(x=>x.name===c.name))allCountries.push(c)}));
    allCountries.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    if(sel)sel.innerHTML='<option value="">اختر الدولة</option>'+allCountries.map(c=>`<option value="${c.name}" data-flag="${c.flag}">${c.flag} ${c.name}</option>`).join('');
}

let openContinentSend=null,openContinentRecv=null;
let selectedSendCountry=null,selectedRecvCountry=null;

function selectContinentNew(key,mode){
    if(mode==='out'){
        const prefix='';
        document.querySelectorAll('#intlSendPanel .continent-card').forEach(c=>c.classList.remove('active-cont'));
        document.querySelectorAll('#intlSendPanel .countries-list').forEach(c=>c.classList.remove('open'));
        if(openContinentSend===key){openContinentSend=null;return}
        openContinentSend=key;
        document.getElementById('cont-'+key).classList.add('active-cont');
        document.getElementById('countries-'+key).classList.add('open');
    }else{
        document.querySelectorAll('#intlRecvPanel .continent-card').forEach(c=>c.classList.remove('active-cont'));
        document.querySelectorAll('#intlRecvPanel .countries-list').forEach(c=>c.classList.remove('open'));
        if(openContinentRecv===key){openContinentRecv=null;return}
        openContinentRecv=key;
        document.getElementById('cont-recv-'+key).classList.add('active-cont');
        document.getElementById('countries-recv-'+key).classList.add('open');
    }
    showToast('قارة '+continentData[key].name,'info','🌍');
}

function selectCountryNew(name,continent,flag,mode){
    if(mode==='out'){
        selectedSendCountry={name,flag,continent};
        document.getElementById('itRecvCountry').value=name;
        document.getElementById('sendDestFlag').textContent=flag;
        document.getElementById('sendDestCountry').textContent=name;
        document.getElementById('sendSelectedDest').style.display='flex';
        showSendMethods(name);
        onSendCountryChange(name);
        showToast('وجهة الإرسال: '+name,'success','🗺️');
        setTimeout(()=>{document.getElementById('itSenderName').scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('itSenderName').focus()},300);
    }else{
        selectedRecvCountry={name,flag,continent};
        document.getElementById('itRecvFromCountry').value=name;
        document.getElementById('recvDestFlag').textContent=flag;
        document.getElementById('recvDestCountry').textContent=name;
        document.getElementById('recvSelectedDest').style.display='flex';
        showRecvMethodsNew(name);
        showToast('دولة المصدر: '+name,'success','🗺️');
        setTimeout(()=>{document.getElementById('itRecvName').scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('itRecvName').focus()},300);
    }
}

function onSendCountryChange(countryName){
    if(countryName){
        showSendMethods(countryName);
        // تحديث الوجهة المختارة
        const allCountries=[];
        Object.values(continentData).forEach(cont=>cont.countries.forEach(c=>allCountries.push(c)));
        const found=allCountries.find(c=>c.name===countryName);
        if(found){
            document.getElementById('sendDestFlag').textContent=found.flag;
            document.getElementById('sendDestCountry').textContent=countryName;
            document.getElementById('sendSelectedDest').style.display='flex';
        }
    }
}

function showSendMethods(country){
    const methods=countryRecvMethods[country]||countryRecvMethods['_default'];
    const area=document.getElementById('sendMethodsArea');
    const grid=document.getElementById('sendMethodsGrid');
    area.style.display='block';
    grid.innerHTML=methods.map((m,i)=>`<div class="send-method-card" onclick="selectSendMethod(this,'${m.name}')"><div class="method-card-check">✓</div><div class="method-card-icon">${m.icon}</div><div class="method-card-name">${m.name}</div></div>`).join('');
    const methodSel=document.getElementById('itMethod');
    if(methodSel) methodSel.innerHTML='<option value="">اختر طريقة</option>'+methods.map(m=>`<option value="${m.name}">${m.icon} ${m.name}</option>`).join('');
}

function showRecvMethodsNew(country){
    const methods=countryRecvMethods[country]||countryRecvMethods['_default'];
    const area=document.getElementById('recvMethodsArea');
    const grid=document.getElementById('recvMethodsGrid');
    area.style.display='block';
    grid.innerHTML=methods.map((m,i)=>`<div class="recv-method-card" onclick="selectRecvMethodNew(this,'${m.name}')"><div class="method-card-check">✓</div><div class="method-card-icon">${m.icon}</div><div class="method-card-name">${m.name}</div></div>`).join('');
    const methodSel=document.getElementById('itRecvMethod');
    if(methodSel) methodSel.innerHTML='<option value="">اختر طريقة</option>'+methods.map(m=>`<option value="${m.name}">${m.icon} ${m.name}</option>`).join('');
}

function selectSendMethod(el,method){
    document.querySelectorAll('.send-method-card').forEach(c=>c.classList.remove('method-active'));
    el.classList.add('method-active');
    selectedRecvMethod=method;
    const methodSel=document.getElementById('itMethod');
    if(methodSel) for(let opt of methodSel.options){if(opt.value===method){opt.selected=true;break}}
    showToast('طريقة الإرسال: '+method,'success','📦');
}

function selectRecvMethodNew(el,method){
    document.querySelectorAll('.recv-method-card').forEach(c=>c.classList.remove('method-active'));
    el.classList.add('method-active');
    const methodSel=document.getElementById('itRecvMethod');
    if(methodSel) for(let opt of methodSel.options){if(opt.value===method){opt.selected=true;break}}
    showToast('طريقة الاستقبال: '+method,'success','📦');
}

function clearSendDest(){
    selectedSendCountry=null;
    document.getElementById('sendSelectedDest').style.display='none';
    document.getElementById('sendMethodsArea').style.display='none';
    document.getElementById('itRecvCountry').value='';
}
function clearRecvDest(){
    selectedRecvCountry=null;
    document.getElementById('recvSelectedDest').style.display='none';
    document.getElementById('recvMethodsArea').style.display='none';
    document.getElementById('itRecvFromCountry').value='';
}

// تبديل وضع إرسال/استقبال
function switchIntlMode(mode){
    itDirection=mode;
    document.getElementById('intlModeOut').classList.toggle('intl-mode-active',mode==='out');
    document.getElementById('intlModeIn').classList.toggle('intl-mode-active',mode==='in');
    document.getElementById('intlSendPanel').style.display=mode==='out'?'block':'none';
    document.getElementById('intlRecvPanel').style.display=mode==='in'?'block':'none';
    showToast(mode==='out'?'وضع الإرسال':'وضع الاستقبال','info',mode==='out'?'📤':'📥');
}

// ═══ حوالات دولية ═══
function calcIntlFee(){const amt=parseFloat(document.getElementById('itAmount').value)||0;const cur=document.getElementById('itCurrency').value;const fee=amt*0.02;document.getElementById('itAmtDisp').textContent=SYMBOLS[cur]+amt.toFixed(2);document.getElementById('itFeeDisp').textContent=SYMBOLS[cur]+fee.toFixed(2);document.getElementById('itTotalDisp').textContent=SYMBOLS[cur]+(amt+fee).toFixed(2)}
function calcRecvIntlFee(){const amt=parseFloat(document.getElementById('itRecvAmount').value)||0;const cur=document.getElementById('itRecvCurrency').value;const fee=amt*0.02;document.getElementById('itRecvAmtDisp').textContent=SYMBOLS[cur]+amt.toFixed(2);document.getElementById('itRecvFeeDisp').textContent=SYMBOLS[cur]+fee.toFixed(2);document.getElementById('itRecvTotalDisp').textContent=SYMBOLS[cur]+(amt+fee).toFixed(2)}

function submitIntlSend(){
    const sender=document.getElementById('itSenderName').value.trim();
    const phone=document.getElementById('itSenderPhone').value.trim();
    const country=document.getElementById('itRecvCountry').value;
    const amt=parseFloat(document.getElementById('itAmount').value)||0;
    const cur=document.getElementById('itCurrency').value;
    if(!country||amt<=0||!phone){showToast('يرجى ملء جميع الحقول المطلوبة','error','❌');return}
    const fee=amt*0.02;
    pendingAction={type:'international',data:{sender,recv:country,country,amt,cur,fee,direction:'out',recvMethod:selectedRecvMethod||document.getElementById('itMethod').value}};
    document.getElementById('cmIcon').textContent='📤';document.getElementById('cmTitle').textContent='تأكيد إرسال الحوالة';
    document.getElementById('cmDetails').innerHTML=`<div class="confirm-row"><span class="c-l">النوع</span><span class="c-v">إرسال</span></div><div class="confirm-row"><span class="c-l">المرسل</span><span class="c-v">${sender}</span></div><div class="confirm-row"><span class="c-l">الوجهة</span><span class="c-v">${country}</span></div><div class="confirm-row"><span class="c-l">التواصل</span><span class="c-v" dir="ltr">${phone}</span></div>${pendingAction.data.recvMethod?`<div class="confirm-row"><span class="c-l">طريقة الإرسال</span><span class="c-v" style="color:var(--primary)">${pendingAction.data.recvMethod}</span></div>`:''}<div class="confirm-row"><span class="c-l">المبلغ</span><span class="c-v" dir="ltr">${SYMBOLS[cur]}${amt.toFixed(2)}</span></div><div class="confirm-row"><span class="c-l">الرسوم</span><span class="c-v" dir="ltr">${SYMBOLS[cur]}${fee.toFixed(2)}</span></div><div class="confirm-row"><span class="c-l" style="font-weight:700">الإجمالي</span><span class="c-v" dir="ltr" style="color:var(--accent);font-weight:800">${SYMBOLS[cur]}${(amt+fee).toFixed(2)}</span></div>`;
    document.getElementById('confirmModal').classList.add('visible');
}

function submitIntlRecv(){
    const recv=document.getElementById('itRecvName').value.trim();
    const phone=document.getElementById('itRecvPhone').value.trim();
    const fromCountry=document.getElementById('itRecvFromCountry').value;
    const amt=parseFloat(document.getElementById('itRecvAmount').value)||0;
    const cur=document.getElementById('itRecvCurrency').value;
    if(!recv||!phone||amt<=0){showToast('يرجى ملء جميع الحقول المطلوبة','error','❌');return}
    const fee=amt*0.02;
    pendingAction={type:'international',data:{sender:fromCountry||'خارجي',recv,country:fromCountry||'—',amt,cur,fee,direction:'in',recvMethod:document.getElementById('itRecvMethod')?.value||'كاش'}};
    document.getElementById('cmIcon').textContent='📥';document.getElementById('cmTitle').textContent='تأكيد استقبال الحوالة';
    document.getElementById('cmDetails').innerHTML=`<div class="confirm-row"><span class="c-l">النوع</span><span class="c-v" style="color:var(--success)">استقبال</span></div><div class="confirm-row"><span class="c-l">المستلم</span><span class="c-v">${recv}</span></div><div class="confirm-row"><span class="c-l">دولة المصدر</span><span class="c-v">${fromCountry||'—'}</span></div><div class="confirm-row"><span class="c-l">التواصل</span><span class="c-v" dir="ltr">${phone}</span></div><div class="confirm-row"><span class="c-l">المبلغ</span><span class="c-v" dir="ltr">${SYMBOLS[cur]}${amt.toFixed(2)}</span></div><div class="confirm-row"><span class="c-l">الرسوم</span><span class="c-v" dir="ltr">${SYMBOLS[cur]}${fee.toFixed(2)}</span></div><div class="confirm-row"><span class="c-l" style="font-weight:700">الإجمالي</span><span class="c-v" dir="ltr" style="color:var(--accent);font-weight:800">${SYMBOLS[cur]}${(amt+fee).toFixed(2)}</span></div>`;
    document.getElementById('confirmModal').classList.add('visible');
}

function clearIntlSend(){['itSenderName','itSenderPhone','itAmount'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});document.getElementById('itRecvCountry').value='';document.getElementById('itFeeDisp').textContent='$0.00';document.getElementById('itAmtDisp').textContent='$0.00';document.getElementById('itTotalDisp').textContent='$0.00';clearSendDest();selectedRecvMethod='';showToast('تم مسح النموذج','info','♻️')}
function clearIntlRecv(){['itRecvName','itRecvPhone','itRecvAmount'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});document.getElementById('itRecvFromCountry').value='';document.getElementById('itRecvFeeDisp').textContent='$0.00';document.getElementById('itRecvAmtDisp').textContent='$0.00';document.getElementById('itRecvTotalDisp').textContent='$0.00';clearRecvDest();showToast('تم مسح النموذج','info','♻️')}

function filterItLogs(el,mode){itFilterMode=mode;el.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('fc-on'));el.classList.add('fc-on');renderItLogs()}

// ═══ نظام صفحات سجل الحوالات ═══
const IT_PAGE_SIZE=10;
let _itPagedData={}; // { pageIndex: [transfers...] }

function renderItLogs(){
    let data=itLogs;
    if(itFilterMode==='completed') data=itLogs.filter(l=>l.status==='completed');
    else if(itFilterMode==='pending') data=itLogs.filter(l=>l.status==='pending');
    else if(itFilterMode==='out') data=itLogs.filter(l=>l.direction==='out');
    else if(itFilterMode==='in') data=itLogs.filter(l=>l.direction==='in');
    _renderItPageCards(data);
}

function _renderItPageCards(data){
    const grid=document.getElementById('itPageCardsGrid');
    const empty=document.getElementById('itPageEmpty');
    if(!grid) return;

    _itPagedData={};

    if(!data||data.length===0){
        grid.innerHTML='';
        if(empty) empty.style.display='block';
        return;
    }
    if(empty) empty.style.display='none';

    const totalPages=Math.ceil(data.length/IT_PAGE_SIZE);
    let html='';

    for(let p=0;p<totalPages;p++){
        const pageItems=data.slice(p*IT_PAGE_SIZE,(p+1)*IT_PAGE_SIZE);
        _itPagedData[p]=pageItems;

        const inCount=pageItems.filter(l=>l.direction==='in').length;
        const outCount=pageItems.filter(l=>l.direction==='out').length;
        const firstId=pageItems[0].id;
        const lastId=pageItems[pageItems.length-1].id;
        const timeRange=pageItems.length>1
            ? pageItems[pageItems.length-1].time+' — '+pageItems[0].time
            : pageItems[0].time;
        const hasNew=p===0;

        html+=`
        <div class="it-page-card${hasNew?' it-page-card--new':''}" onclick="_openItPageModal(${p})" title="فتح صفحة ${p+1}">
            <div class="it-pc-header">
                <div class="it-pc-num">صفحة ${p+1}</div>
                <div class="it-pc-range">${lastId} ← ${firstId}</div>
            </div>
            <div class="it-pc-stats">
                <div class="it-pc-stat in">
                    <span class="it-pc-stat-val">${inCount}</span>
                    <span class="it-pc-stat-lbl">واردة</span>
                </div>
                <div class="it-pc-stat out">
                    <span class="it-pc-stat-val">${outCount}</span>
                    <span class="it-pc-stat-lbl">صادرة</span>
                </div>
                <div class="it-pc-stat total">
                    <span class="it-pc-stat-val">${pageItems.length}</span>
                    <span class="it-pc-stat-lbl">المجموع</span>
                </div>
            </div>
            <div class="it-pc-footer">
                <span>${timeRange}</span>
                <span class="it-pc-arrow">◀</span>
            </div>
        </div>`;
    }

    grid.innerHTML=html;
}

function _openItPageModal(pageIndex){
    const items=_itPagedData[pageIndex];
    if(!items) return;

    const inCount=items.filter(l=>l.direction==='in').length;
    const outCount=items.filter(l=>l.direction==='out').length;

    document.getElementById('itPmTitle').textContent='صفحة '+(pageIndex+1);
    document.getElementById('itPmSub').textContent=items.length+' حوالة · '+items[items.length-1].id+' — '+items[0].id;
    document.getElementById('itPmBadgeIn').textContent=inCount+' واردة';
    document.getElementById('itPmBadgeOut').textContent=outCount+' صادرة';

    document.getElementById('itPmBody').innerHTML=items.map(l=>`
        <tr>
            <td style="font-size:12px;color:var(--text-muted)">${l.id}</td>
            <td><span class="tag ${l.direction==='in'?'tag-receive':'tag-send'}">${l.direction==='in'?'واردة':'صادرة'}</span></td>
            <td style="font-weight:700">${l.sender}</td>
            <td>${l.recipient}</td>
            <td>${l.country}</td>
            <td class="amount-cell ${l.direction==='in'?'pos':'neg'}">${l.direction==='in'?'+':'-'}${SYMBOLS[l.currency]}${Number(l.amount).toLocaleString()}</td>
            <td dir="ltr" style="text-align:right">${SYMBOLS[l.currency]}${l.fee}</td>
            <td><span class="tag tag-${l.status}">${l.status==='completed'?'مكتملة':'معلقة'}</span></td>
            <td style="font-size:12px;color:var(--text-muted)">${l.time}</td>
        </tr>`).join('');

    const modal=document.getElementById('itPageModal');
    modal.style.display='flex';
}

function closeItPageModal(){
    const modal=document.getElementById('itPageModal');
    modal.style.animation='none';
    modal.offsetHeight; // reflow
    modal.style.display='none';
}

function sendIntlWhatsApp(){
    const sender=document.getElementById('itSenderName').value.trim()||'—';
    const country=document.getElementById('itRecvCountry').value||'—';
    const amt=document.getElementById('itAmount').value||'0';const cur=document.getElementById('itCurrency').value;
    const msg=encodeURIComponent(`*حوالة دولية — نظام انترناشونال*\n\nالمرسل: ${sender}\nالوجهة: ${country}\nالمبلغ: ${SYMBOLS[cur]}${amt}\nالتاريخ: ${new Date().toLocaleDateString('ar-EG')}\n\n_شركة انترناشونال للخدمات المالية_`);
    window.open('https://wa.me/?text='+msg,'_blank');
    showToast('جاري فتح واتساب...','success','📱');
}

function sendRecvWhatsApp(){
    const recv=document.getElementById('itRecvName').value.trim()||'—';
    const fromCountry=document.getElementById('itRecvFromCountry').value||'—';
    const amt=document.getElementById('itRecvAmount').value||'0';const cur=document.getElementById('itRecvCurrency').value;
    const msg=encodeURIComponent(`*استقبال حوالة — نظام انترناشونال*\n\nالمستلم: ${recv}\nالمصدر: ${fromCountry}\nالمبلغ: ${SYMBOLS[cur]}${amt}\nالتاريخ: ${new Date().toLocaleDateString('ar-EG')}\n\n_شركة انترناشونال للخدمات المالية_`);
    window.open('https://wa.me/?text='+msg,'_blank');
    showToast('جاري فتح واتساب...','success','📱');
}

// ═══ إلكترونية ═══
function selectPlatform(name){
    document.querySelectorAll('.platform-card').forEach(c=>c.classList.remove('active-plat'));
    document.getElementById('plat-'+name.toLowerCase()).classList.add('active-plat');
    document.getElementById('elPlatform').value=name;
    document.getElementById('elPlatLabel').textContent=name;
    // USDT → إظهار QR أسفل صندوق التلر + علامة التحقق في الأداة
    const qrSide=document.getElementById('elecQrSide');
    const layout=document.getElementById('elecSplitLayout');
    const ddZone=document.getElementById('elDdZone');
    const clientReq=document.getElementById('elClientReq');
    const verifyBadge=document.getElementById('elVerifyBadge');
    if(name==='USDT'){
        qrSide.style.display='flex';
        qrSide.style.animation='fadeInUp 0.4s ease';
        layout.classList.remove('with-qr');
        if(verifyBadge) verifyBadge.style.display='inline-flex';
        generateQRCode();
        // إخفاء إلزامية الاسم
        if(clientReq) clientReq.style.display='none';
        // تفعيل التسليم المزدوج تلقائياً وإظهاره
        if(ddZone) ddZone.style.display='block';
        if(!ddActive.el){
            ddActive.el=true;
            const toggle=document.getElementById('elDdToggle');
            if(toggle) toggle.classList.add('dd-active');
            const fields=document.getElementById('elDdFields');
            if(fields) fields.classList.add('open');
        }
    }else{
        qrSide.style.display='none';
        layout.classList.remove('with-qr');
        if(verifyBadge) verifyBadge.style.display='none';
        // إرجاع إلزامية الاسم
        if(clientReq) clientReq.style.display='inline';
        // إخفاء التسليم المزدوج
        if(ddZone) ddZone.style.display='none';
        if(ddActive.el){
            ddActive.el=false;
            const toggle=document.getElementById('elDdToggle');
            if(toggle) toggle.classList.remove('dd-active');
            const fields=document.getElementById('elDdFields');
            if(fields) fields.classList.remove('open');
        }
    }
    showToast('تم اختيار '+name,'success','⚡');
    setTimeout(()=>{document.getElementById('elClient').scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('elClient').focus()},200);
}

// ═══ QR Code Generator (بسيط بدون مكتبات) ═══
const COMPANY_TRC20='TJYk9nGd5LPa4TfBkgR3wMeSiUpwCBJzgf';
function generateQRCode(){
    const addr=USDT_NETWORKS[currentUsdtNet]?.address||COMPANY_TRC20;
    document.getElementById('companyTrcAddress').textContent=addr;
    const canvas=document.getElementById('qrCanvas');
    const ctx=canvas.getContext('2d');
    const size=180;
    canvas.width=size;canvas.height=size;
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=function(){ctx.drawImage(img,0,0,size,size)};
    img.onerror=function(){
        ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);
        const data=addr;const cellSize=Math.floor(size/25);
        ctx.fillStyle='#000';
        function drawFinder(x,y,s){ctx.fillRect(x,y,s*7,s);ctx.fillRect(x,y,s,s*7);ctx.fillRect(x+s*6,y,s,s*7);ctx.fillRect(x,y+s*6,s*7,s);ctx.fillRect(x+s*2,y+s*2,s*3,s*3)}
        drawFinder(cellSize,cellSize,cellSize);
        drawFinder(size-cellSize*8,cellSize,cellSize);
        drawFinder(cellSize,size-cellSize*8,cellSize);
        for(let i=0;i<data.length;i++){const cc=data.charCodeAt(i);for(let b=0;b<8;b++){if((cc>>b)&1){const px=(((i*8+b)*7)%17+4)*cellSize;const py=(((i*8+b)*11)%17+4)*cellSize;if(px<size-cellSize&&py<size-cellSize)ctx.fillRect(px,py,cellSize,cellSize)}}}
        ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.strokeRect(0,0,size,size);
    };
    img.src='https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(addr);
}

function copyTrcAddress(){
    const addr=USDT_NETWORKS[currentUsdtNet]?.address||COMPANY_TRC20;
    if(navigator.clipboard){
        navigator.clipboard.writeText(addr).then(()=>showToast('تم نسخ العنوان!','success','📋')).catch(()=>fallbackCopy(addr));
    }else{fallbackCopy(addr)}
}
function fallbackCopy(text){
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    showToast('تم نسخ العنوان!','success','📋');
}

// ═══ شبكات USDT ═══
const USDT_NETWORKS={
    'TRC-20':{address:'TJYk9nGd5LPa4TfBkgR3wMeSiUpwCBJzgf',label:'TRON (TRC-20)',color:'#ef4444',fee:'~1 USDT',speed:'~3 دقائق',explorer:'https://tronscan.org/#/transaction/'},
    'ERC-20':{address:'0x8A3dE5e6c02F3B64B2C743A4E92f1cB8E5F7D9A1',label:'Ethereum (ERC-20)',color:'#3b82f6',fee:'~5-15 USDT',speed:'~5 دقائق',explorer:'https://etherscan.io/tx/'},
    'BEP-20':{address:'0x8A3dE5e6c02F3B64B2C743A4E92f1cB8E5F7D9A1',label:'BSC (BEP-20)',color:'#f59e0b',fee:'~0.5 USDT',speed:'~1 دقيقة',explorer:'https://bscscan.com/tx/'}
};
let currentUsdtNet='TRC-20';

function switchUsdtNetwork(el,net){
    document.querySelectorAll('.qr-net-tab').forEach(t=>t.classList.remove('qr-net-active'));
    el.classList.add('qr-net-active');
    currentUsdtNet=net;
    const info=USDT_NETWORKS[net];
    document.getElementById('companyTrcAddress').textContent=info.address;
    document.getElementById('usdtNetBadge').textContent=info.label;
    document.getElementById('usdtNetBadge').style.background=`${info.color}15`;
    document.getElementById('usdtNetBadge').style.borderColor=`${info.color}40`;
    document.getElementById('usdtNetBadge').style.color=info.color;
    document.getElementById('usdtNetLabel').textContent=net;
    generateQRCode();
    showToast(`شبكة ${net} — رسوم ${info.fee} — سرعة ${info.speed}`,'info','🔗');
}

function shareUsdtAddress(){
    const info=USDT_NETWORKS[currentUsdtNet];
    const text=`عنوان استقبال USDT — ${info.label}\n\nالعنوان:\n${info.address}\n\nأرسل فقط USDT عبر شبكة ${currentUsdtNet}\n\nشركة انترناشونال للخدمات المالية`;
    if(navigator.share){
        navigator.share({title:'عنوان USDT',text}).catch(()=>{});
    }else{
        const msg=encodeURIComponent(text);
        window.open('https://wa.me/?text='+msg,'_blank');
    }
    showToast('جاري المشاركة...','info','📤');
}

function verifyUsdtTx(){
    const hash=document.getElementById('usdtTxHash').value.trim();
    if(!hash){showToast('أدخل TX Hash أولاً','error','❌');return}
    const status=document.getElementById('usdtTxStatus');
    status.style.display='block';
    status.className='qr-tx-status tx-pending';
    status.innerHTML='<strong>التحقق اليدوي مطلوب</strong> — تحقّق من المعاملة عبر مستكشف الشبكة (Tronscan / Etherscan) باستخدام الـ TX Hash أعلاه';
}

function calcElecFee(){const amt=parseFloat(document.getElementById('elAmount').value)||0;const cur=document.getElementById('elCurrency').value;const fee=amt*0.03;document.getElementById('elAmtDisp').textContent=(SYMBOLS[cur]||'$')+amt.toFixed(2);document.getElementById('elFeeDisp').textContent=(SYMBOLS[cur]||'$')+fee.toFixed(2);document.getElementById('elTotalDisp').textContent=(SYMBOLS[cur]||'$')+(amt+fee).toFixed(2);if(ddActive.el)calcDdElec()}

function submitElec(){
    const platform=document.getElementById('elPlatform').value;const client=document.getElementById('elClient').value.trim();
    const amt=parseFloat(document.getElementById('elAmount').value)||0;const cur=document.getElementById('elCurrency').value;
    if(!platform){showToast('اختر منصة أولاً','error','❌');return}if(amt<=0){showToast('أدخل مبلغاً','error','❌');return}
    const fee=amt*0.03;
    pendingAction={type:'electronic',data:{client,platform,amt,cur,fee,dd:ddActive.el,ddAmt2:ddActive.el?parseFloat(document.getElementById('elDdAmount2')?.value)||0:0,ddCur2:ddActive.el?(document.getElementById('elDdCur2')?.value||''):'',ddNote2:ddActive.el?document.getElementById('elDdNote2')?.value||'':''}};
    document.getElementById('cmIcon').textContent='📲';document.getElementById('cmTitle').textContent='تأكيد المعاملة';
    let ddHtml='';
    if(ddActive.el&&pendingAction.data.ddAmt2>0){ddHtml=`<div class="confirm-row"><span class="c-l">تسليم ثاني</span><span class="c-v" dir="ltr" style="color:var(--blue)">${SYMBOLS[pendingAction.data.ddCur2]||''}${pendingAction.data.ddAmt2.toFixed(2)}</span></div>`}
    document.getElementById('cmDetails').innerHTML=`<div class="confirm-row"><span class="c-l">العميل</span><span class="c-v">${client}</span></div><div class="confirm-row"><span class="c-l">المنصة</span><span class="c-v">${platform}</span></div><div class="confirm-row"><span class="c-l">المبلغ</span><span class="c-v" dir="ltr">${SYMBOLS[cur]}${amt.toFixed(2)}</span></div>${ddHtml}<div class="confirm-row"><span class="c-l">الرسوم</span><span class="c-v" dir="ltr">${SYMBOLS[cur]}${fee.toFixed(2)}</span></div><div class="confirm-row"><span class="c-l" style="font-weight:700">الإجمالي</span><span class="c-v" dir="ltr" style="color:var(--accent);font-weight:800">${SYMBOLS[cur]}${(amt+fee).toFixed(2)}</span></div>`;
    document.getElementById('confirmModal').classList.add('visible');
}
function clearElec(){['elClient','elClientId','elAccount','elAmount','elNote'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});document.getElementById('elPlatform').value='';document.getElementById('elPlatLabel').textContent='اختر منصة';document.getElementById('elFeeDisp').textContent='$0.00';document.getElementById('elAmtDisp').textContent='$0.00';document.getElementById('elTotalDisp').textContent='$0.00';document.querySelectorAll('.platform-card').forEach(c=>c.classList.remove('active-plat'));if(ddActive.el){ddActive.el=false;const tgl=document.getElementById('elDdToggle');if(tgl)tgl.classList.remove('dd-active');document.getElementById('elDdFields').classList.remove('open')};['elDdCashAmt','elDdBankAmt'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});const qrs=document.getElementById('elecQrSide');if(qrs)qrs.style.display='none';const lay=document.getElementById('elecSplitLayout');if(lay)lay.classList.remove('with-qr');const ddz=document.getElementById('elDdZone');if(ddz)ddz.style.display='none';const cr=document.getElementById('elClientReq');if(cr)cr.style.display='inline';showToast('تم مسح النموذج','info','♻️')}
function filterElLogs(el,mode){elFilterMode=mode;el.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('fc-on'));el.classList.add('fc-on');renderElLogs()}
function renderElLogs(){let data=elLogs;if(elFilterMode==='completed')data=elLogs.filter(l=>l.status==='completed');else if(elFilterMode==='pending')data=elLogs.filter(l=>l.status==='pending');document.getElementById('elLogBody').innerHTML=data.map(l=>`<tr><td style="font-size:12px;color:var(--text-muted)">${l.id}</td><td style="font-weight:700">${l.client}</td><td><span class="tag tag-e-wallet">${l.platform}</span></td><td class="amount-cell neg">-${SYMBOLS[l.currency]}${l.amount.toLocaleString()}</td><td dir="ltr" style="text-align:right">${SYMBOLS[l.currency]}${l.fee}</td><td><span class="tag tag-${l.status}">${l.status==='completed'?'مكتملة':'معلقة'}</span></td><td style="font-size:12px;color:var(--text-muted)">${l.time}</td></tr>`).join('')}

function sendElecWhatsApp(){
    const client=document.getElementById('elClient').value.trim()||'—';const platform=document.getElementById('elPlatform').value||'—';
    const amt=document.getElementById('elAmount').value||'0';const cur=document.getElementById('elCurrency').value;
    const msg=encodeURIComponent(`*معاملة إلكترونية — نظام انترناشونال*\n\nالعميل: ${client}\nالمنصة: ${platform}\nالمبلغ: ${SYMBOLS[cur]}${amt}\nالتاريخ: ${new Date().toLocaleDateString('ar-EG')}\n\n_شركة انترناشونال للخدمات المالية_`);
    window.open('https://wa.me/?text='+msg,'_blank');
    showToast('جاري فتح واتساب...','success','📱');
}

// ═══ تأكيد ═══
async function confirmAction(){
    closeModal('confirmModal');if(!pendingAction)return;
    // ── فحص الجلسة ──
    if(!_sessionIsOpen()){
        showToast('يجب فتح الصندوق أولاً قبل تنفيذ أي عملية','error','🔒');
        pendingAction=null; return;
    }
    const{type,data}=pendingAction;const now=new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
    if(type==='exchange'){
        // ── فحص الرصيد السالب ──
        if(data.mode==='buy'){ if(!_checkBalance(data.to,data.toAmt)){pendingAction=null;return;} }
        else { if(!_checkBalance(data.from,data.fromAmt)){pendingAction=null;return;} }
        const id='EX-'+exCounter++;
        exLogs.unshift({id,client:data.client,mode:data.mode,from:data.from,to:data.to,fromAmt:data.fromAmt,toAmt:data.toAmt,rate:data.rate,time:now});
        if(data.mode==='buy'){tellerBalances[data.from]=(tellerBalances[data.from]||0)+data.fromAmt;tellerBalances[data.to]=(tellerBalances[data.to]||0)-data.toAmt}else{tellerBalances[data.from]=(tellerBalances[data.from]||0)-data.fromAmt;tellerBalances[data.to]=(tellerBalances[data.to]||0)+data.toAmt}
        // ── قيد مزدوج ──
        if(data.mode==='buy'){
            _addJournalEntry({sym:SYMBOLS[data.from],amount:data.fromAmt},{sym:SYMBOLS[data.to],amount:data.toAmt},'صرافة شراء — '+data.client+' ('+data.from+'→'+data.to+')',now);
        } else {
            _addJournalEntry({sym:SYMBOLS[data.to],amount:data.toAmt},{sym:SYMBOLS[data.from],amount:data.fromAmt},'صرافة بيع — '+data.client+' ('+data.from+'→'+data.to+')',now);
        }
        updateTellerBox();
        allRecent.unshift({icon:data.mode==='buy'?'📈':'📉',type:'conv',name:`${data.mode==='buy'?'شراء':'بيع'} — ${data.client}`,desc:`${SYMBOLS[data.from]}${data.fromAmt} → ${SYMBOLS[data.to]}${data.toAmt}`,time:now,amount:`${SYMBOLS[data.from]}${data.fromAmt}`,cls:data.mode==='buy'?'pos':'neg'});
        _pushToSvOps(id,'convert',`صرافة ${data.mode==='buy'?'شراء':'بيع'} — ${data.client}: ${SYMBOLS[data.from]}${data.fromAmt} → ${SYMBOLS[data.to]}${data.toAmt}`,data.fromAmt,data.from);
        showSuccess(data.mode==='buy'?'تم الشراء بنجاح':'تم البيع بنجاح',`${SYMBOLS[data.from]}${data.fromAmt} → ${SYMBOLS[data.to]}${data.toAmt}`,id);clearExchange();renderExLogs();
        // ── حفظ في الخادم ──
        if(typeof apiTlExchangeCreate==='function'){
            apiTlExchangeCreate({fromCurrency:data.from,toCurrency:data.to,amount:data.fromAmt,result:data.toAmt,rate:parseFloat(data.rate),method:data.mode,client:data.client}).catch(()=>{});
        }
    }else if(type==='international'){
        // ── فحص الرصيد (إرسال فقط) ──
        if(data.direction==='out'){ if(!_checkBalance(data.cur,data.amt+data.fee)){pendingAction=null;return;} }
        const id='IT-'+itCounter++;
        itLogs.unshift({id,sender:data.sender,recipient:data.recv,country:data.country,amount:data.amt,currency:data.cur,fee:data.fee,status:'completed',direction:data.direction||'out',time:now});
        allRecent.unshift({icon:'🌍',type:'intl',name:`حوالة — ${data.sender}`,desc:`${data.recv} (${data.country})`,time:now,amount:`-${SYMBOLS[data.cur]}${data.amt}`,cls:'neg'});
        _pushToSvOps(id,data.direction==='out'?'send':'receive',`حوالة — ${data.sender} → ${data.recv} (${data.country})`,data.amt,data.cur);
        // ── قيد مزدوج ──
        if(data.direction==='out'){
            tellerBalances[data.cur]=(tellerBalances[data.cur]||0)-(data.amt+data.fee);
            _addJournalEntry({sym:SYMBOLS[data.cur],amount:data.fee},{sym:SYMBOLS[data.cur],amount:data.amt+data.fee},'حوالة صادرة — '+data.sender+' → '+data.recv,now);
        } else {
            _addJournalEntry({sym:SYMBOLS[data.cur],amount:data.amt},{sym:SYMBOLS[data.cur],amount:data.fee},'حوالة واردة — '+data.sender+' → '+data.recv,now);
        }
        updateTellerBox();
        showSuccess('تمت الحوالة بنجاح',`${SYMBOLS[data.cur]}${data.amt} → ${data.recv}`,id);if(data.direction==='out'){clearIntlSend()}else{clearIntlRecv()};renderItLogs();
        // ── حفظ في الخادم ──
        if(typeof apiTlHawalaCreate==='function'){
            apiTlHawalaCreate({senderName:data.sender,receiverName:data.recv,country:data.country,amount:data.amt,currency:data.cur,fee:data.fee,direction:data.direction||'out',recvMethod:data.recvMethod||''}).catch(()=>{});
        }
    }else if(type==='electronic'){
        // ── فحص الرصيد ──
        if(!_checkBalance(data.cur,data.amt+data.fee)){pendingAction=null;return;}
        const id='EL-'+elCounter++;
        elLogs.unshift({id,client:data.client,platform:data.platform,amount:data.amt,currency:data.cur,fee:data.fee,status:'completed',time:now});
        allRecent.unshift({icon:'📲',type:'elec',name:`إلكترونية — ${data.client}`,desc:data.platform,time:now,amount:`-${SYMBOLS[data.cur]}${data.amt}`,cls:'neg'});
        _pushToSvOps(id,'electronic',`إلكترونية — ${data.client} (${data.platform})`,data.amt,data.cur);
        tellerBalances[data.cur]=(tellerBalances[data.cur]||0)-(data.amt+data.fee);
        // ── قيد مزدوج ──
        _addJournalEntry({sym:SYMBOLS[data.cur],amount:data.fee},{sym:SYMBOLS[data.cur],amount:data.amt+data.fee},'إلكترونية — '+data.client+' ('+data.platform+')',now);
        updateTellerBox();
        showSuccess('تمت المعاملة بنجاح',`${data.platform} — ${SYMBOLS[data.cur]}${data.amt}`,id);clearElec();renderElLogs();
        // ── حفظ في الخادم ──
        if(typeof apiTlCashCreate==='function'){
            apiTlCashCreate({type:'electronic',client:data.client,platform:data.platform,amount:data.amt,currency:data.cur,fee:data.fee}).catch(()=>{});
        }
    }else if(type==='cashdesk'){
        const isD=data.mode==='deposit';
        // ── فحص الرصيد (سحب فقط) ──
        if(!isD && !_checkBalance(data.cur,data.amt)){pendingAction=null;return;}
        const id=(isD?'DEP':'WDR')+'-'+cdCounter++;
        const sign=isD?1:-1;
        tellerBalances[data.cur]=(tellerBalances[data.cur]||0)+(sign*data.amt);
        cdLogs.unshift({id,mode:data.mode,payType:data.payType||'cash',client:data.client,amount:data.amt,currency:data.cur,rate:data.rate||0,ref:data.ref,time:now});
        const payLabel=data.payType==='bank'?'بنكي':'كاش';
        allRecent.unshift({icon:isD?'📥':'📤',type:'cashdesk',name:`${isD?'إيداع':'سحب'} ${payLabel} — ${data.client}`,desc:`${SYMBOLS[data.cur]}${data.amt}`,time:now,amount:`${isD?'+':'-'}${SYMBOLS[data.cur]}${data.amt}`,cls:isD?'pos':'neg'});
        _pushToSvOps(id,isD?'deposit':'withdraw',`${isD?'إيداع':'سحب'} (${payLabel}) — ${data.client}: ${SYMBOLS[data.cur]}${data.amt}`,data.amt,data.cur);
        // ── قيد مزدوج ──
        if(isD) _addJournalEntry({sym:SYMBOLS[data.cur],amount:data.amt},null,'إيداع '+payLabel+' — '+data.client,now);
        else    _addJournalEntry(null,{sym:SYMBOLS[data.cur],amount:data.amt},'سحب '+payLabel+' — '+data.client,now);
        updateTellerBox();updateCd2Balances();
        showSuccess(isD?'تم الإيداع بنجاح':'تم السحب بنجاح',`${SYMBOLS[data.cur]}${data.amt} — ${data.client}`,id);
        clearCashDesk();renderCdLogs();
        // ── حفظ في الخادم ──
        if(typeof apiTlCashCreate==='function'){
            apiTlCashCreate({type:data.mode,payType:data.payType||'cash',client:data.client,amount:data.amt,currency:data.cur,rate:data.rate||0,ref:data.ref||''}).catch(()=>{});
        }
    }
    renderMainRecent();updateCounts();pendingAction=null;
}
function showSuccess(title,desc,id){document.getElementById('smTitle').textContent=title;document.getElementById('smDesc').textContent=desc;document.getElementById('smDetails').innerHTML=`<div class="confirm-row"><span class="c-l">رقم العملية</span><span class="c-v" style="color:var(--primary)">${id}</span></div><div class="confirm-row"><span class="c-l">التاريخ</span><span class="c-v">${new Date().toLocaleString('ar-EG')}</span></div>`;document.getElementById('successModal').classList.add('visible');showToast(title,'success','✅')}
function closeModal(id){document.getElementById(id).classList.remove('visible')}
document.querySelectorAll('.modal-overlay').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)})});
function showToast(msg,type='info',icon='ℹ️'){
  const c=document.getElementById('toastContainer');
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerHTML=`<div class="toast-body"><div class="toast-icon-wrap">${icon}</div><span class="toast-text">${msg}</span></div><button class="toast-close" onclick="this.closest('.toast').classList.add('exit');setTimeout(()=>this.closest('.toast').remove(),280)">✕</button>`;
  c.appendChild(t);
  setTimeout(()=>{t.classList.add('exit');setTimeout(()=>t.remove(),280)},3800);
}

// ═══ طلبات المشرف ═══
let _grType='normal';
function openGeneralRequest(type){
    _grType=type;
    const lbl=document.getElementById('grTypeLabel');
    if(lbl){
        lbl.textContent=type==='urgent'?'طلب عاجل':'طلب عادي';
        lbl.style.background=type==='urgent'?'rgba(239,68,68,0.1)':'rgba(245,158,11,0.1)';
        lbl.style.color=type==='urgent'?'#f87171':'#fbbf24';
        lbl.style.border=type==='urgent'?'1px solid rgba(239,68,68,0.3)':'1px solid rgba(245,158,11,0.3)';
    }
    const icon=document.getElementById('grIcon');
    if(icon) icon.textContent=type==='urgent'?'🔴':'📨';
    const ta=document.getElementById('grText');if(ta) ta.value='';
    document.getElementById('generalRequestModal').classList.add('visible');
}
function sendGeneralRequest(){
    const text=(document.getElementById('grText').value||'').trim();
    if(!text){showToast('اكتب نص الطلب أولاً','error','❌');return;}
    const name=_getTellerUser();
    const payload={id:'GR-'+Date.now(),type:_grType,tellerName:name,from:name,text,time:'الآن',status:'pending',reply:''};
    // localStorage fallback
    try{const r=JSON.parse(localStorage.getItem('intl_teller_requests')||'[]');r.unshift(payload);localStorage.setItem('intl_teller_requests',JSON.stringify(r));}catch(e){}
    // إرسال للخادم
    if(typeof apiTlRequestCreate==='function'){
        apiTlRequestCreate(payload).catch(()=>{});
    } else {
        const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
        fetch('/api/tl/requests',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify(payload)}).catch(()=>{});
    }
    closeModal('generalRequestModal');
    showToast('تم إرسال الطلب للمشرف بنجاح','success','📨');
}

// ═══ جزيئات ═══
const canvas=document.getElementById('particles'),ctx=canvas.getContext('2d');let pts=[];
function resC(){canvas.width=innerWidth;canvas.height=innerHeight}resC();addEventListener('resize',resC);
class Pt{constructor(){this.x=Math.random()*canvas.width;this.y=Math.random()*canvas.height;this.s=Math.random()*1.2+0.3;this.sx=(Math.random()-0.5)*0.25;this.sy=(Math.random()-0.5)*0.25;this.o=Math.random()*0.15+0.03}update(){this.x+=this.sx;this.y+=this.sy;if(this.x>canvas.width)this.x=0;if(this.x<0)this.x=canvas.width;if(this.y>canvas.height)this.y=0;if(this.y<0)this.y=canvas.height}draw(){ctx.beginPath();ctx.arc(this.x,this.y,this.s,0,Math.PI*2);ctx.fillStyle=`rgba(50,184,198,${this.o})`;ctx.fill()}}
function initPt(){pts=[];for(let i=0;i<Math.min(45,canvas.width*canvas.height/25000);i++)pts.push(new Pt)}initPt();
function conPt(){for(let a=0;a<pts.length;a++)for(let b=a+1;b<pts.length;b++){const d=Math.hypot(pts[a].x-pts[b].x,pts[a].y-pts[b].y);if(d<90){ctx.beginPath();ctx.strokeStyle=`rgba(50,184,198,${0.02*(1-d/90)})`;ctx.lineWidth=0.4;ctx.moveTo(pts[a].x,pts[a].y);ctx.lineTo(pts[b].x,pts[b].y);ctx.stroke()}}}
function animPt(){ctx.clearRect(0,0,canvas.width,canvas.height);pts.forEach(p=>{p.update();p.draw()});conPt();requestAnimationFrame(animPt)}animPt();

// ═══ الصندوق الافتتاحي والنهائي ═══
let openingBalances={USD:0,ILS:0,JOD:0};

function _loadSavedOpeningBalance(){
    try{
        const myName=_getTellerUser();
        const saved=JSON.parse(localStorage.getItem('intl_opening_'+myName)||'null');
        if(saved){
            openingBalances=Object.assign({USD:0,ILS:0,JOD:0},saved.balances||{});
            tellerBalances=Object.assign({USD:0,ILS:0,JOD:0},saved.current||saved.balances||{});
            return true;
        }
    }catch(e){}
    return false;
}

function initOpeningBox(){
    const timeEl=document.getElementById('openingTime');
    if(timeEl){
        if(_session && _session.openedAt){
            timeEl.textContent=new Date(_session.openedAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
        } else {
            timeEl.textContent='--:--';
        }
    }
    const isZero=openingBalances.USD===0&&openingBalances.ILS===0&&openingBalances.JOD===0;
    document.getElementById('openingUSD').textContent=isZero?'$0':'$'+openingBalances.USD.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    document.getElementById('openingILS').textContent=isZero?'₪0':'₪'+openingBalances.ILS.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    document.getElementById('openingJOD').textContent=isZero?'JD 0':'JD '+openingBalances.JOD.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const tot=openingBalances.USD+(openingBalances.ILS/RATES.ILS)+(openingBalances.JOD/RATES.JOD);
    document.getElementById('openingTotal').textContent='$'+Math.round(tot).toLocaleString();
}

function _applyOpeningBalance(data){
    var usd=Number(data.amountUSD||data.amount||0);
    var ils=Number(data.amountILS||0);
    var jod=Number(data.amountJOD||0);
    openingBalances={USD:usd,ILS:ils,JOD:jod};
    tellerBalances=Object.assign({},openingBalances);
    initOpeningBox();
    updateTellerBox();
    updateMainBalances();
    showToast('تم تثبيت الصندوق الافتتاحي','success','🏦');
}
function updateMainBalances(){
    const tot=tellerBalances.USD+(tellerBalances.ILS/RATES.ILS)+(tellerBalances.JOD/RATES.JOD);
    document.getElementById('mBalance').textContent='$'+Math.round(tot).toLocaleString();
    document.getElementById('mBalanceUSD').textContent='$'+tellerBalances.USD.toLocaleString();
    document.getElementById('mBalanceILS').textContent='₪'+tellerBalances.ILS.toLocaleString();
    document.getElementById('mBalanceJOD').textContent='JD '+tellerBalances.JOD.toLocaleString();
    document.getElementById('closingUSD').textContent='$'+tellerBalances.USD.toLocaleString();
    document.getElementById('closingILS').textContent='₪'+tellerBalances.ILS.toLocaleString();
    document.getElementById('closingJOD').textContent='JD '+tellerBalances.JOD.toLocaleString();
    document.getElementById('closingTotal').textContent='$'+Math.round(tot).toLocaleString();
    const openTot=openingBalances.USD+(openingBalances.ILS/RATES.ILS)+(openingBalances.JOD/RATES.JOD);
    const diff=Math.round(tot)-Math.round(openTot);
    const diffEl=document.getElementById('closingDiff');
    if(diff!==0){
        diffEl.innerHTML=`${diff>0?'ربح':'خسارة'}: <span dir="ltr">$${Math.abs(diff).toLocaleString()}</span>`;
        diffEl.className='cl-diff '+(diff>0?'positive':'negative');
    }else{diffEl.innerHTML='';diffEl.className='cl-diff'}
}
function carryoverBalances(){
    if(!confirm('هل تريد ترحيل الأرصدة الحالية كأرصدة افتتاحية لليوم التالي؟'))return;
    openingBalances={USD:tellerBalances.USD,ILS:tellerBalances.ILS,JOD:tellerBalances.JOD};
    initOpeningBox();
    showToast('تم ترحيل الأرصدة بنجاح!','success','🔄');
}

// ═══ أزواج عملات إضافية ═══
let addedPairs=[];
function toggleExtraPairs(){document.getElementById('epBody').classList.toggle('open');document.getElementById('epArrow').classList.toggle('open')}
function addExtraPair(from,to,flag1,flag2,name,btn){
    if(btn.classList.contains('added'))return;
    const pairId=`pair-${from}-${to}`;
    if(document.getElementById(pairId))return showToast('هذا الزوج موجود بالفعل','warning','⚠️');
    const rate=RATES[to]/RATES[from];
    const pairHtml=`<div class="pair-card" onclick="selectPair('${from}','${to}')" id="${pairId}"><div class="pair-flags">${flag1} <span class="pair-arrow">⇄</span> ${flag2}</div><div class="pair-name">${name}</div><div class="pair-rate" id="pairRate-${from}-${to}">1 ${from} = ${rate<1?rate.toFixed(4):rate.toFixed(3)} ${to}</div><div class="pair-code">${from}/${to}</div></div>`;
    const wpDropdown=document.querySelector('#dept-exchange .right-column .world-prices-dropdown');
    wpDropdown.insertAdjacentHTML('beforebegin',pairHtml);
    btn.classList.add('added');btn.textContent='تمت الإضافة';
    addedPairs.push({from,to});
    showToast(`تمت إضافة زوج ${from}/${to}`,'success','✅');
}

// ═══ حقول العميل المنسدلة ═══
let clientFieldsOpen=false;
function toggleClientFields(){
    clientFieldsOpen=!clientFieldsOpen;
    const fields=document.getElementById('exClientFields');
    const toggle=document.getElementById('exClientToggle');
    const arrow=document.getElementById('clientArrow');
    if(clientFieldsOpen){
        fields.classList.add('open');
        toggle.classList.add('open');
        if(arrow)arrow.textContent='▲';
    }else{
        fields.classList.remove('open');
        toggle.classList.remove('open');
        if(arrow)arrow.textContent='▼';
    }
}

// ═══ طباعة إيصال الصرافة ═══
async function printExchangeReceipt(){
    const client=document.getElementById('exClient').value.trim()||'—';
    const clientId=document.getElementById('exClientId').value.trim()||'—';
    const from=document.getElementById('exFromCur').value,to=document.getElementById('exToCur').value;
    const amt=document.getElementById('exFrom').value||'0';
    const result=document.getElementById('exTo').textContent;
    const rate=document.getElementById('exRate').textContent;
    exTxCounter++;
    const txNum=exTxCounter;
    const now=new Date();
    const dateStr=now.toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'});
    const timeStr=now.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});

    // تحميل الشعار وتحويله إلى Base64 لضمان ظهوره في نافذة الطباعة
    const _logoUrl = window.location.origin + '/static/images/%D8%A7%D9%84%D8%B4%D8%B9%D8%A7%D8%B1.png';
    let logoSrc = _logoUrl;
    try{
        const resp = await fetch(_logoUrl);
        if(resp.ok){
            const blob = await resp.blob();
            logoSrc = await new Promise(res=>{
                const r = new FileReader();
                r.onload = e => res(e.target.result);
                r.readAsDataURL(blob);
            });
        }
    }catch(e){ logoSrc = _logoUrl; }

    // استخراج rateNum من نص السعر
    const rateParts = rate.split(' = ');
    const rateNum = rateParts.length > 1 ? rateParts[1].split(' ')[0] : rate;

    // أولاً: طباعة صامتة عبر Django backend
    try{
        const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
        const resp = await fetch('/api/print/receipt/',{
            method:'POST',
            headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
            body:JSON.stringify({txNum,dateStr,timeStr,client,clientId,from,to,amt,result,rateNum,opType:exMode})
        });
        const data = await resp.json();
        if(data.success){
            showToast('تمت الطباعة بنجاح — إيصال #'+txNum,'success','🖨️');
            return;
        }
        showToast(data.message||'فشل الطباعة المباشرة، سيتم فتح نافذة الطباعة','warning','⚠️');
    }catch(e){
        console.warn('backend print failed:', e);
    }

    // fallback: نافذة طباعة المتصفح
    _openReceiptWindow(_buildExchangeReceiptHtml({
        txNum,dateStr,timeStr,client,clientId,from,to,amt,result,rate,logoSrc,now
    }),'إيصال صرافة #'+txNum);
    showToast('جاري تجهيز الطباعة... إيصال #'+txNum,'info','🖨️');
}

function _buildExchangeReceiptHtml({txNum,dateStr,timeStr,client,clientId,from,to,amt,result,rate,logoSrc,now}){
    const curName=c=>c==='USD'?'دولار أمريكي':c==='ILS'?'شيكل إسرائيلي':c==='JOD'?'دينار أردني':c==='EUR'?'يورو':c==='GBP'?'جنيه إسترليني':c;
    return `
    <div class="receipt">
        <div class="r-top">
            <img class="r-logo-img" src="${logoSrc}" alt="شعار انترناشونال">
            <div class="r-company">شركة انترناشونال</div>
            <div class="r-subtitle">للخدمات المالية والمجوهرات</div>
        </div>
        <div class="r-meta">
            <span class="r-meta-l">${dateStr} — ${timeStr}</span>
            <span class="r-meta-r r-tx">#${txNum}</span>
        </div>
        <div class="r-type-banner ${exMode==='buy'?'r-type-buy':'r-type-sell'}">
            ${exMode==='buy'?'▲ عملية شراء':'▼ عملية بيع'}
        </div>
        <div class="r-section">
            <div class="r-section-title">بيانات العميل</div>
            <div class="r-row"><span class="r-label">الاسم</span><span class="r-val">${client}</span></div>
            <div class="r-row"><span class="r-label">رقم الهوية</span><span class="r-val">${clientId}</span></div>
        </div>
        <div class="r-section">
            <div class="r-section-title">تفاصيل العملية</div>
            <div class="r-row"><span class="r-label">المبلغ المدفوع</span><span class="r-val r-debit">${SYMBOLS[from]}${parseFloat(amt).toLocaleString()}</span></div>
            <div class="r-row"><span class="r-label">العملة المدفوعة</span><span class="r-val">${curName(from)}</span></div>
            <div class="r-row"><span class="r-label">1 ${from}</span><span class="r-val">${(()=>{const p=rate.split(' = ');return p.length>1?'= '+p[1]:rate})()}</span></div>
        </div>
        <div class="r-total-box">
            <div class="r-total-label">المبلغ المستلم</div>
            <div class="r-total-val">${SYMBOLS[to]}${result}</div>
            <div class="r-total-sub">${curName(to)}</div>
        </div>
        <hr class="r-divider">
        <div class="r-footer">
            <div class="r-thanks">شكراً لتعاملكم معنا</div>
            <div class="r-note">يُرجى الاحتفاظ بالإيصال لحين الحاجة</div>
            <div class="r-barcode">| ${txNum} |</div>
            <div class="r-copy">نظام انترناشونال الموحد &copy; ${now.getFullYear()}</div>
        </div>
    </div>`;
}

// طباعة مباشرة عبر QZ Tray (بدون نافذة) أو fallback لنافذة المتصفح
async function _openReceiptWindow(bodyHtml, title){
    // إذا QZ Tray متاح — طباعة صامتة مباشرة
    if(typeof qz !== 'undefined'){
        try{
            if(!qz.websocket.isActive()) await qz.websocket.connect();
            const printer = await qz.printers.getDefault();
            const cfg = qz.configs.create(printer, {
                colorType: 'blackWhite',
                duplex: false,
                margins: {top:0, right:0, bottom:0, left:0}
            });
            const fullHtml = _buildPrintHtml(bodyHtml, title);
            await qz.print(cfg, [{type:'pixel', format:'html', flavor:'plain', data: fullHtml}]);
            return;
        }catch(e){
            console.warn('QZ Tray error, falling back:', e);
        }
    }
    // fallback — نافذة طباعة عادية
    const printWindow=window.open('','_blank','width=340,height=620');
    printWindow.document.write(_buildPrintHtml(bodyHtml, title));
    printWindow.document.close();
}

function _buildPrintHtml(bodyHtml, title){return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
@page{size:80mm auto;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:80mm;margin:0 auto;direction:rtl;text-align:right;
  font-size:13px;color:#000;background:#fff;line-height:1.55;
  font-family:'Segoe UI',Tahoma,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
body{padding:2mm 0}
.receipt{width:76mm;margin:0 auto;padding:0}
.r-top{text-align:center;padding-bottom:7px;margin-bottom:6px;border-bottom:2px solid #000}
.r-logo-img{width:58px;height:58px;margin:0 auto 4px;display:block;object-fit:contain}
.r-company{font-size:14px;font-weight:900;color:#000;margin-bottom:1px}
.r-subtitle{font-size:11px;color:#000;font-weight:700}
.r-meta{display:table;width:100%;padding:5px 0;font-size:11px;color:#000;font-weight:800;border-bottom:1.5px solid #000}
.r-meta-l{display:table-cell;text-align:right;font-weight:800}
.r-meta-r{display:table-cell;text-align:left;font-weight:900}
.r-tx{font-weight:900;font-size:12px}
.r-type-banner{text-align:center;padding:5px;margin:5px 0;font-weight:900;font-size:12px;border:2px solid #000;background:#000;color:#fff}
.r-type-buy{background:#000;color:#fff}
.r-type-sell{background:#000;color:#fff}
.r-section{margin-bottom:7px}
.r-section-title{font-size:11px;font-weight:900;color:#000;
  margin-bottom:4px;padding-bottom:3px;border-bottom:2px solid #000;letter-spacing:0.3px}
.r-row{width:100%;display:table;table-layout:fixed;padding:4px 0}
.r-row:not(:last-child){border-bottom:1px solid #000}
.r-label{display:table-cell;width:44%;font-size:12px;font-weight:800;
  color:#000;text-align:right;vertical-align:top;word-break:break-word}
.r-val{display:table-cell;width:56%;font-size:13px;font-weight:900;
  color:#000;text-align:right;vertical-align:top;word-break:break-word}
.r-debit{font-weight:900;font-size:13px}
.r-total-box{background:#000;border:2.5px solid #000;padding:5px 10px;margin:6px auto;
  text-align:center;display:inline-block;min-width:55%;
  position:relative;right:50%;transform:translateX(50%)}
.r-total-label{font-size:10px;font-weight:900;margin-bottom:2px;letter-spacing:0.3px;color:#fff}
.r-total-val{font-size:15px;font-weight:900;word-break:break-all;white-space:nowrap;color:#fff}
.r-total-sub{font-size:10px;font-weight:800;margin-top:2px;color:#ddd}
.r-divider{border:none;border-top:1.5px dashed #000;margin:5px 0}
.r-footer{text-align:center;padding-top:5px;border-top:2px solid #000}
.r-thanks{font-size:12px;font-weight:900;color:#000;margin-bottom:2px}
.r-note{font-size:10px;color:#000;font-weight:700;margin-bottom:3px}
.r-barcode{font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;
  font-weight:900;display:block;margin:3px auto;text-align:center}
.r-copy{font-size:9px;color:#000;font-weight:700;margin-top:2px}
@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  html,body{width:80mm!important;margin:0 auto!important;padding:2mm 0!important}
  .receipt{width:76mm!important;margin:0 auto!important;padding:0!important}
  .r-type-buy{background:#000!important;color:#fff!important}
}
</style></head><body>
${bodyHtml}
<script>window.onload=function(){setTimeout(function(){window.print()},400)};<\/script>
</body></html>`;}


// ═══════════════════════════════════════════════
// قسم السحب والإيداع v2 — Cash Desk
// ═══════════════════════════════════════════════
let cdLogs=[];
let cdCounter=1;
let cdMode='deposit';      // 'deposit' | 'withdraw'
let cdPayType='cash';      // 'cash' | 'bank'
let cdCurrency='USD';
let cdFilterMode='all';
const CD_CUR_NAMES={USD:'دولار أمريكي',JOD:'دينار أردني',ILS:'شيكل إسرائيلي'};

function _cd2UpdateBadge(){
    const isD=cdMode==='deposit';const isCash=cdPayType==='cash';
    const icon=isD?'📥':'📤';const typeLabel=isCash?'كاش':'بنكي';
    const label=`${typeLabel} · ${isD?'إيداع':'سحب'}`;
    const badge=document.getElementById('cd2OpBadge');
    if(badge){badge.textContent=label;badge.style.background=isD?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)';badge.style.color=isD?'var(--success)':'var(--danger)';badge.style.border=isD?'1px solid rgba(34,197,94,0.25)':'1px solid rgba(239,68,68,0.25)'}
    const cardIcon=document.getElementById('cd2CardIcon');if(cardIcon)cardIcon.textContent=icon;
    const cardTitle=document.getElementById('cd2CardTitle');if(cardTitle)cardTitle.textContent=isD?'تفاصيل الإيداع':'تفاصيل السحب';
    const btn=document.getElementById('cd2SubmitBtn');
    if(btn){btn.textContent=isD?'تنفيذ الإيداع':'تنفيذ السحب';btn.style.background=isD?'linear-gradient(135deg,var(--success),#16a34a)':'linear-gradient(135deg,var(--danger),#b91c1c)'}
    const calcType=document.getElementById('cd2CalcType');if(calcType)calcType.textContent=`${typeLabel} · ${isD?'إيداع':'سحب'}`;
    const calcIcon=document.getElementById('cd2CalcIcon');if(calcIcon)calcIcon.textContent=isCash?'💵':'🏦';
}

function switchCd2Mode(mode){
    cdMode=mode;const isD=mode==='deposit';
    document.getElementById('cd2ModeDeposit').classList.toggle('cd2-active',isD);
    document.getElementById('cd2ModeWithdraw').classList.toggle('cd2-active',!isD);
    _cd2UpdateBadge();updateCd2Calc();
}

function selectCd2Type(type){
    cdPayType=type;const isCash=type==='cash';
    document.getElementById('cd2TypeCash').classList.toggle('cd2-tc-active',isCash);
    document.getElementById('cd2TypeBank').classList.toggle('cd2-tc-active',!isCash);
    document.getElementById('cd2CashBadge').classList.toggle('hidden',!isCash);
    document.getElementById('cd2BankBadge').classList.toggle('hidden',isCash);
    _cd2UpdateBadge();updateCd2Calc();
}

function selectCd2Cur(el,cur){
    cdCurrency=cur;
    document.querySelectorAll('.cd2-cur-card').forEach(c=>c.classList.remove('cd2-cc-active'));
    el.classList.add('cd2-cc-active');
    const sym=SYMBOLS[cur]||cur;
    const s=document.getElementById('cd2Sym');if(s)s.textContent=sym;
    updateCd2Calc();
}

function _cd2Rate(){
    return parseFloat(cdPayType==='cash'?document.getElementById('cd2CashRate').value:document.getElementById('cd2BankRate').value)||0;
}

function updateCd2Calc(){
    const amt=parseFloat(document.getElementById('cd2Amount').value)||0;
    const rate=_cd2Rate();const sym=SYMBOLS[cdCurrency]||cdCurrency;
    // Calc panel
    const amtEl=document.getElementById('cd2CalcAmt');if(amtEl)amtEl.textContent=amt>0?`${sym}${amt.toLocaleString(undefined,{minimumFractionDigits:2})}`:'—';
    const rateEl=document.getElementById('cd2CalcRate');if(rateEl)rateEl.textContent=rate>0?`${rate} ₪/${cdCurrency}`:cdCurrency==='ILS'?'عملة أساسية':'—';
    let equivText='—';
    if(cdCurrency==='ILS'&&amt>0){equivText=`₪${amt.toLocaleString(undefined,{minimumFractionDigits:2})}`}
    else if(rate>0&&amt>0){equivText=`₪${(amt*rate).toLocaleString(undefined,{minimumFractionDigits:2})}`}
    const equivEl=document.getElementById('cd2CalcEquiv');if(equivEl){equivEl.textContent=equivText;equivEl.style.color=equivText==='—'?'var(--text-muted)':'var(--primary)'}
    // Balance
    updateCd2Balances();
    const bal=tellerBalances[cdCurrency]||0;
    const balEl=document.getElementById('cd2CalcBal');if(balEl)balEl.textContent=`${sym}${bal.toLocaleString(undefined,{minimumFractionDigits:2})}`;
}

function updateCd2Balances(){
    ['USD','JOD','ILS'].forEach(cur=>{
        const el=document.getElementById('cd2Bal'+cur);
        if(el){const sym=SYMBOLS[cur]||cur;const bal=tellerBalances[cur]||0;el.textContent=`${sym}${bal.toLocaleString(undefined,{minimumFractionDigits:2})}`}
    });
}

function submitCd2(){
    const client=(document.getElementById('cd2Client').value||'').trim();
    const amt=parseFloat(document.getElementById('cd2Amount').value)||0;
    if(!amt||amt<=0){document.getElementById('cd2Amount').classList.add('error');setTimeout(()=>document.getElementById('cd2Amount').classList.remove('error'),600);showToast('يرجى إدخال مبلغ صحيح','error','❌');return}
    if(cdMode==='withdraw'&&(tellerBalances[cdCurrency]||0)<amt){showToast('رصيد الصندوق غير كافٍ للسحب','error','⚠️');return}
    const rate=_cd2Rate();const ref=(document.getElementById('cd2Ref').value||'').trim();const note=(document.getElementById('cd2Note').value||'').trim();
    const sym=SYMBOLS[cdCurrency]||cdCurrency;const isD=cdMode==='deposit';const isCash=cdPayType==='cash';
    let equivText='—';
    if(cdCurrency==='ILS') equivText=`₪${amt.toLocaleString(undefined,{minimumFractionDigits:2})}`;
    else if(rate>0) equivText=`₪${(amt*rate).toLocaleString(undefined,{minimumFractionDigits:2})}`;
    const details=`<div class="confirm-row"><span class="c-l">العملية</span><span class="c-v" style="color:${isD?'var(--success)':'var(--danger)'}">${isD?'إيداع':'سحب'}</span></div><div class="confirm-row"><span class="c-l">الطريقة</span><span class="c-v">${isCash?'كاش':'بنكي'}</span></div><div class="confirm-row"><span class="c-l">العميل</span><span class="c-v">${client}</span></div><div class="confirm-row"><span class="c-l">المبلغ</span><span class="c-v" style="font-size:18px;font-weight:900;color:${isD?'var(--success)':'var(--danger)'};">${sym}${amt.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>${rate>0?`<div class="confirm-row"><span class="c-l">السعر</span><span class="c-v">${rate} ₪/${cdCurrency}</span></div>`:''}${equivText!=='—'?`<div class="confirm-row"><span class="c-l">المعادل</span><span class="c-v" style="color:var(--primary);font-weight:900">${equivText}</span></div>`:''}${ref?`<div class="confirm-row"><span class="c-l">المرجع</span><span class="c-v">${ref}</span></div>`:''}`;
    document.getElementById('cmIcon').textContent=isD?'📥':'📤';
    document.getElementById('cmTitle').textContent=isD?'تأكيد الإيداع':'تأكيد السحب';
    document.getElementById('cmDetails').innerHTML=details;
    pendingAction={type:'cashdesk',data:{mode:cdMode,payType:cdPayType,client,amt,cur:cdCurrency,rate,ref,note}};
    document.getElementById('confirmModal').classList.add('visible');
}

function clearCd2(){
    ['cd2Client','cd2ClientId','cd2Amount','cd2Ref','cd2Note'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
    updateCd2Calc();showToast('تم مسح النموذج','info','♻️');
}

// Keep old name aliases for confirmAction compatibility
function clearCashDesk(){clearCd2();}

function filterCdLogs(el,mode){
    cdFilterMode=mode;
    el.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('fc-on'));
    el.classList.add('fc-on');renderCdLogs();
}

function renderCdLogs(){
    let data=cdLogs;
    if(cdFilterMode==='deposit')data=cdLogs.filter(l=>l.mode==='deposit');
    else if(cdFilterMode==='withdraw')data=cdLogs.filter(l=>l.mode==='withdraw');
    else if(cdFilterMode==='cash')data=cdLogs.filter(l=>l.payType==='cash');
    else if(cdFilterMode==='bank')data=cdLogs.filter(l=>l.payType==='bank');
    const el=document.getElementById('cdLogBody');if(!el)return;
    el.innerHTML=data.map(l=>{
        const sym=SYMBOLS[l.currency]||l.currency;const isD=l.mode==='deposit';const isCash=l.payType==='cash';
        let equiv='—';
        if(l.currency==='ILS')equiv=`₪${l.amount.toLocaleString(undefined,{minimumFractionDigits:2})}`;
        else if(l.rate>0)equiv=`₪${(l.amount*l.rate).toLocaleString(undefined,{minimumFractionDigits:2})}`;
        return`<tr><td style="font-size:12px;color:var(--text-muted)">${l.id}</td><td><span class="tag ${isD?'tag-deposit':'tag-withdraw'}">${isD?'إيداع':'سحب'}</span></td><td><span class="tag ${isCash?'tag-cash-type':'tag-bank-type'}">${isCash?'كاش':'بنكي'}</span></td><td style="font-weight:700">${l.client}</td><td class="amount-cell ${isD?'pos':'neg'}">${isD?'+':'-'}${sym}${l.amount.toLocaleString(undefined,{minimumFractionDigits:2})}</td><td style="direction:ltr;text-align:right;font-weight:700">${l.rate||'—'}</td><td class="amount-cell pos">${equiv}</td><td style="font-size:12px;color:var(--text-muted)">${l.ref||'—'}</td><td style="font-size:12px;color:var(--text-muted)">${l.time}</td></tr>`;
    }).join('');
    document.getElementById('cdLogCount').textContent=cdLogs.length+' عملية';
}

// ═══ تشغيل ═══
// ── وضع فاتح/داكن ──
const _SUN_SVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const _MOON_SVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
function toggleTheme() { /* dark mode only — light mode disabled */ }


// تحميل الرصيد المحفوظ + الجلسة عند تحميل الصفحة
_loadSavedOpeningBalance();
_loadSession();
buildCountryLists();renderMainRecent();renderExLogs();renderItLogs();renderElLogs();renderCdLogs();updateCounts();calcExchange();updateTellerBox();updateMainBalances();initOpeningBox();updateCd2Balances();_cd2UpdateBadge();
_updateSessionBar();
if(_session&&_session.journal){var jb=document.getElementById('journalCount');if(jb)jb.textContent=_session.journal.length;}
if(!loadSupervisorPrices()) initDdRates();
loadSupervisorBalance();
applyPermissions();
_checkBoxNotify();
setTimeout(()=>showToast('مرحباً بك في أقسام التلر — نظام انترناشونال','info','💎'),800);
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-overlay.visible').forEach(m=>closeModal(m.id))});

// ── بيانات المستخدم وتسجيل الخروج ──
function logout(){window.location.href='/logout/';}
(function(){try{const u=(window._currentUser||{});if(u.username){const el=document.getElementById('userDisplayName');const rl=document.getElementById('userDisplayRole');if(el)el.textContent=u.username;if(rl)rl.textContent=u.roleName||u.role;}}catch(e){}})();

// ══════ رفع التقرير — قسم التلر ══════
let _tdRptFileData=null,_tdRptFileMeta=null;
const _TD_RPT_EMOJIS={pdf:'📄',excel:'📊',word:'📝',image:'🖼️',other:'📁'};
const _TD_RPT_MIME={'application/pdf':'pdf','application/vnd.ms-excel':'excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'excel','application/msword':'word','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'word','image/png':'image','image/jpeg':'image','image/jpg':'image','image/gif':'image','image/webp':'image'};
function _tdRptFmtSz(b){if(b<1024)return b+' B';if(b<1048576)return (b/1024).toFixed(1)+' KB';return (b/1048576).toFixed(1)+' MB';}
function _tdRptType(m,n){if(_TD_RPT_MIME[m])return _TD_RPT_MIME[m];const e=(n||'').split('.').pop().toLowerCase();if(e==='pdf')return 'pdf';if(['xls','xlsx','csv'].includes(e))return 'excel';if(['doc','docx'].includes(e))return 'word';if(['png','jpg','jpeg','gif','webp'].includes(e))return 'image';return 'other';}
function tdRptClearFile(){_tdRptFileData=null;_tdRptFileMeta=null;const i=document.getElementById('tdRptFileInput');if(i)i.value='';const _p=document.getElementById('tdRptFilePreview');const _dz=document.getElementById('tdRptDropZone');if(_p)_p.style.display='none';if(_dz)_dz.style.display='';}
function _tdRptShowPreview(n,s,t){document.getElementById('tdRptFileIcon').textContent=_TD_RPT_EMOJIS[t]||'📁';document.getElementById('tdRptFileNameDisplay').textContent=n;document.getElementById('tdRptFileSizeDisplay').textContent=_tdRptFmtSz(s);document.getElementById('tdRptDropZone').style.display='none';document.getElementById('tdRptFilePreview').style.display='flex';}
function _tdRptRead(file){if(file.size>10*1024*1024){showToast('حجم الملف يتجاوز 10 MB','error','❌');return;}const t=_tdRptType(file.type,file.name);_tdRptFileMeta={name:file.name,size:file.size,type:t};_tdRptShowPreview(file.name,file.size,t);const r=new FileReader();r.onload=ev=>{_tdRptFileData=ev.target.result;};r.readAsDataURL(file);}
function tdRptFileChosen(i){if(i.files&&i.files[0])_tdRptRead(i.files[0]);}
function tdRptFileDrop(e){const f=e.dataTransfer.files;if(f&&f[0])_tdRptRead(f[0]);}
function tdOpenReportModal(){const overlay=document.getElementById('tdReportOverlay');if(!overlay)return;try{_tdRptFileData=null;_tdRptFileMeta=null;const t=document.getElementById('tdRptTitle');if(t)t.value='';tdRptClearFile();}catch(e){}try{const u=(window._currentUser||{});const el=document.getElementById('tdRptSenderDisplay');if(el&&u.username)el.textContent=u.username;const dl=document.getElementById('tdRptDeptDisplay');const dept=document.querySelector('.nav-tab.active span:last-child');if(dl&&dept)dl.textContent=dept.textContent||'قسم التلر';}catch(e){}overlay.style.display='flex';}
function tdCloseReportModal(){document.getElementById('tdReportOverlay').style.display='none';}
function tdSubmitReport(){const title=(document.getElementById('tdRptTitle').value||'').trim();if(!title){showToast('يرجى إدخال عنوان التقرير','error','❌');return;}if(!_tdRptFileData||!_tdRptFileMeta){showToast('يرجى اختيار ملف للرفع','error','❌');return;}let sender='موظف التلر';try{const u=(window._currentUser||{});if(u.username)sender=u.username;}catch(e){}const dept=document.getElementById('tdRptDeptDisplay');const deptName=dept?dept.textContent:'قسم التلر';const now=new Date();const p=n=>String(n).padStart(2,'0');const date=now.getFullYear()+'-'+p(now.getMonth()+1)+'-'+p(now.getDate())+' '+p(now.getHours())+':'+p(now.getMinutes());const obj={source:'teller',title,fileName:_tdRptFileMeta.name,fileType:_tdRptFileMeta.type,fileSize:_tdRptFmtSz(_tdRptFileMeta.size),fileData:_tdRptFileData,sender,department:deptName,branch:'الفرع الرئيسي',branchId:1,date};try{const ex=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');ex.unshift(obj);localStorage.setItem('intl_admin_reports',JSON.stringify(ex));}catch(err){try{obj.fileData=null;const ex2=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');ex2.unshift(obj);localStorage.setItem('intl_admin_reports',JSON.stringify(ex2));}catch(e){}}tdCloseReportModal();showToast('تم إرسال الملف "'+_tdRptFileMeta.name+'" للإدارة بنجاح','success','📤');}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('tdReportOverlay').style.display==='flex')tdCloseReportModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('itPageModal')?.style.display==='flex')closeItPageModal();});

// ── زر التقاط الصورة ──────────────────────────────────
function captureSection(targetId) {
  const el = targetId ? document.getElementById(targetId) : document.querySelector('.dept-section.active');
  if (!el) return;
  // بصري مؤقت — الوظيفة الكاملة ستُضاف لاحقاً
  el.style.outline = '2px solid #32b8c6';
  el.style.boxShadow = '0 0 0 4px rgba(50,184,198,0.18)';
  setTimeout(() => { el.style.outline = ''; el.style.boxShadow = ''; }, 800);
}

// ══ الصندوق الافتتاحي — إشعار من المشرف ══
const _BOX_SYMBOLS = {USD:'$',ILS:'₪',JOD:'JD'};
const _BOX_CUR_AR  = {USD:'دولار أمريكي',ILS:'شيكل إسرائيلي',JOD:'دينار أردني'};

function _checkBoxNotify(){
    // الإشعارات الآن تأتي من _loadSession عبر الخادم — هذه الدالة للتوافق فقط
}

function _showBoxOpenModal(data){
    window._pendingBoxNotify=data;
    var ts=data.timestamp||data.setAt||new Date().toISOString();
    var d=new Date(ts);
    var timeStr=d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
    var usd=Number(data.amountUSD||data.amount||0);
    var ils=Number(data.amountILS||0);
    var jod=Number(data.amountJOD||0);
    var el=function(i){return document.getElementById(i);};
    if(el('boxOpenUSD')) el('boxOpenUSD').textContent='$'+usd.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    if(el('boxOpenILS')) el('boxOpenILS').textContent='₪'+ils.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    if(el('boxOpenJOD')) el('boxOpenJOD').textContent='JD '+jod.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    if(el('boxOpenSupervisor')) el('boxOpenSupervisor').textContent=data.supervisorName||data.setBy||'المشرف';
    if(el('boxOpenTime')) el('boxOpenTime').textContent=timeStr;
    var modal=document.getElementById('boxOpenModal');
    if(modal){ modal.style.display='flex'; void modal.offsetWidth; }
}

function closeBoxOpenModal(){
    const modal=document.getElementById('boxOpenModal');
    if(!modal) return;
    const box=document.getElementById('boxOpenBox');
    if(box){ box.style.animation='boxOpenIn .25s cubic-bezier(.55,.06,.68,.19) reverse both'; }
    setTimeout(()=>{ modal.style.display='none'; if(box) box.style.animation=''; },230);
    // تفعيل الجلسة أو تطبيق الرصيد
    if(!_session) _loadSession();
    if(_session&&_session.status==='pending'){
        _confirmOpeningAndStart();
    } else if(window._pendingBoxNotify){
        _applyOpeningBalance(window._pendingBoxNotify);
    }
    window._pendingBoxNotify=null;
}

// ══ مطابقة الصندوق ══
function openReconcileModal(){
    // جمع أرصدة الافتتاحي والحالي
    const opening={
        USD: parseFloat((document.getElementById('openingUSD')||{}).textContent?.replace(/[^0-9.]/g,'')||0),
        ILS: parseFloat((document.getElementById('openingILS')||{}).textContent?.replace(/[^0-9.]/g,'')||0),
        JOD: parseFloat((document.getElementById('openingJOD')||{}).textContent?.replace(/[^0-9.]/g,'')||0),
    };
    const current={
        USD: tellerBalances.USD||0,
        ILS: tellerBalances.ILS||0,
        JOD: tellerBalances.JOD||0,
    };
    const syms={USD:'$',ILS:'₪',JOD:'JD'};
    const names={USD:'دولار',ILS:'شيكل',JOD:'دينار'};
    const flags={USD:'🇺🇸',ILS:'🇵🇸',JOD:'🇯🇴'};
    const rows=document.getElementById('reconcileRows');
    if(!rows) return;
    rows.innerHTML=['USD','ILS','JOD'].map(cur=>{
        const diff=current[cur]-opening[cur];
        const isPos=diff>=0;
        const diffColor=diff===0?'#94a3b8':isPos?'#22c55e':'#f87171';
        const diffSign=diff>0?'+':'';
        return `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;padding:12px 14px;border-top:1px solid rgba(255,255,255,0.05);align-items:center">
            <div style="display:flex;align-items:center;gap:6px"><span>${flags[cur]}</span><span style="font-size:12px;font-weight:700;color:#cbd5e1">${names[cur]}</span></div>
            <div style="text-align:center;font-size:12px;font-weight:600;color:#94a3b8;direction:ltr">${syms[cur]}${opening[cur].toLocaleString()}</div>
            <div style="text-align:center;font-size:12px;font-weight:700;color:#e2e8f0;direction:ltr">${syms[cur]}${current[cur].toLocaleString()}</div>
            <div style="text-align:center;font-size:13px;font-weight:800;color:${diffColor};direction:ltr">${diffSign}${syms[cur]}${Math.abs(diff).toLocaleString()}</div>
        </div>`;
    }).join('');
    const noteEl=document.getElementById('reconcileNote');
    if(noteEl) noteEl.value='';
    const modal=document.getElementById('reconcileModal');
    if(modal){ modal.style.display='flex'; void modal.offsetWidth; }
}

function closeReconcileModal(){
    const modal=document.getElementById('reconcileModal');
    const box=document.getElementById('reconcileBox');
    if(box){ box.style.animation='boxOpenIn .22s cubic-bezier(.55,.06,.68,.19) reverse both'; }
    setTimeout(()=>{ if(modal) modal.style.display='none'; if(box) box.style.animation=''; },200);
}

function submitReconcile(){
    const note=(document.getElementById('reconcileNote')||{}).value||'';
    const name=_getTellerUser();

    // قراءة الأرصدة الافتتاحية والحالية
    const opening={
        USD: parseFloat((document.getElementById('openingUSD')||{}).textContent?.replace(/[^0-9.]/g,'')||0),
        ILS: parseFloat((document.getElementById('openingILS')||{}).textContent?.replace(/[^0-9.]/g,'')||0),
        JOD: parseFloat((document.getElementById('openingJOD')||{}).textContent?.replace(/[^0-9.]/g,'')||0),
    };
    const current={USD:tellerBalances.USD||0,ILS:tellerBalances.ILS||0,JOD:tellerBalances.JOD||0};
    const diff={
        USD:(current.USD-opening.USD).toFixed(2),
        ILS:(current.ILS-opening.ILS).toFixed(2),
        JOD:(current.JOD-opening.JOD).toFixed(2),
    };

    // حفظ سجل المطابقة في localStorage
    try{
        const rec={time:new Date().toLocaleString('ar-EG'),teller:name,opening,current,diff,note};
        const recs=JSON.parse(localStorage.getItem('intl_reconcile_log')||'[]');
        recs.unshift(rec);
        localStorage.setItem('intl_reconcile_log',JSON.stringify(recs.slice(0,50)));
    }catch(e){}

    // إرسال إشعار المطابقة للمشرف عبر API
    const text = 'مطابقة الصندوق\n'
        + 'الافتتاحي: $'+opening.USD+' | ₪'+opening.ILS+' | JD'+opening.JOD+'\n'
        + 'الحالي:    $'+current.USD+' | ₪'+current.ILS+' | JD'+current.JOD+'\n'
        + 'الفارق:    $'+diff.USD+' | ₪'+diff.ILS+' | JD'+diff.JOD
        + (note ? '\nملاحظة: '+note : '');

    const payload={
        id:'RC-'+Date.now(),
        type:'reconcile',
        tellerName:name,
        from:name,
        text,
        time:'الآن',
        status:'pending',
        reply:''
    };

    const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
    fetch('/api/tl/requests',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body:JSON.stringify(payload)
    }).catch(()=>{});

    closeReconcileModal();
    showToast('تمت المطابقة وأُرسل الإشعار للمشرف','success','⚖️');
}


// ==============================================
// إدارة الجلسة — من الخادم فقط
// ==============================================
var _session = null;

function _loadSession(){
    fetch('/api/tl/session', {headers:{'X-Requested-With':'XMLHttpRequest'}})
    .then(function(r){ return r.json(); })
    .then(function(d){
        if(!d.success) return;
        var prev = _session ? _session.status : null;
        var prevNull = (_session === null);
        _session = d.session || null;
        var newStatus = _session ? _session.status : null;
        // دائماً حدّث شريط الجلسة إذا تغيّرت الحالة أو انتقلنا من null
        if(prevNull || newStatus !== prev) _updateSessionBar();
        // أظهر modal رصيد جديد فقط مرة واحدة (لا تكرر إذا كانت الجلسة مفتوحة بالفعل)
        if(d.notify && d.notify.hasNew && newStatus === 'pending') _showBoxOpenModal(d.notify);
    })
    .catch(function(){});
}
function _saveSession(){ /* الجلسة تُحفظ في الخادم — لا localStorage */ }
function _sessionIsOpen(){ return _session && _session.status==='open'; }
function _getNextSessionId(){ return 'SES-...'; /* يُحدَّد من الخادم */ }
function _getElapsed(iso){
    try{ var sec=(Date.now()-new Date(iso).getTime())/1000; var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60); return h>0?h+'h '+m+'m':m+' دقيقة'; }catch(e){ return ''; }
}

function _updateSessionBar(){
    var bar=document.getElementById('sessionBar'); if(!bar) return;
    if(_session && _session.status==='pending'){
        // في انتظار تأكيد التلر للصندوق الافتتاحي
        var ob=(_session&&_session.openingBalance)||{};
        bar.style.background='linear-gradient(135deg,rgba(245,158,11,0.1),rgba(234,179,8,0.06))';
        bar.style.borderColor='rgba(245,158,11,0.3)';
        bar.innerHTML='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
            +'<span style="width:9px;height:9px;border-radius:50%;background:#f59e0b;display:inline-block;animation:pulse 1.2s ease infinite;flex-shrink:0"></span>'
            +'<span style="font-size:13px;font-weight:800;color:#f59e0b">صندوق افتتاحي جاهز — في انتظار التأكيد</span>'
            +'<span style="font-size:11px;color:rgba(200,210,220,0.55);direction:ltr">$'+(ob.USD||0)+' / ₪'+(ob.ILS||0)+' / JD '+(ob.JOD||0)+'</span>'
            +'</div>'
            +'<button onclick="_confirmOpeningAndStart()" style="display:flex;align-items:center;gap:6px;padding:8px 18px;background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(234,179,8,0.12));border:1px solid rgba(245,158,11,0.35);border-radius:10px;color:#f59e0b;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">تأكيد الصندوق والبدء</button>';
    } else if(_sessionIsOpen()){
        bar.style.background='linear-gradient(135deg,rgba(34,197,94,0.1),rgba(16,185,129,0.07))';
        bar.style.borderColor='rgba(34,197,94,0.25)';
        bar.innerHTML='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
            +'<span style="width:9px;height:9px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse 1.2s ease infinite;flex-shrink:0"></span>'
            +'<span style="font-size:13px;font-weight:800;color:#22c55e">الصندوق مفتوح</span>'
            +'<span style="font-size:12px;color:rgba(200,210,220,0.7);font-weight:700;background:rgba(34,197,94,0.1);padding:2px 10px;border-radius:8px;border:1px solid rgba(34,197,94,0.2)">'+_session.id+'</span>'
            +'<span style="font-size:11px;color:rgba(200,210,220,0.45)">بدأت: '+(_session.confirmedAt?new Date(_session.confirmedAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}):_session.startTime||'')+ ' • مضى: '+_getElapsed(_session.confirmedAt||_session.startTimestamp||_session.openedAt)+'</span>'
            +'</div>'
            +'<button onclick="openCloseSessionModal()" style="display:flex;align-items:center;gap:6px;padding:8px 18px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.3);border-radius:10px;color:#f87171;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap">إغلاق الصندوق</button>';
    } else {
        bar.style.background='linear-gradient(135deg,rgba(100,116,139,0.08),rgba(71,85,105,0.05))';
        bar.style.borderColor='rgba(100,116,139,0.2)';
        bar.innerHTML='<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
            +'<span style="width:9px;height:9px;border-radius:50%;background:#64748b;display:inline-block;flex-shrink:0"></span>'
            +'<span style="font-size:13px;font-weight:800;color:#94a3b8">في انتظار المشرف لفتح الصندوق</span>'
            +'</div>';
    }
}
// polling كل 8 ثوانٍ — يجلب الجلسة والإشعارات من الخادم
setInterval(_loadSession, 8000);
setInterval(function(){ if(_sessionIsOpen()) _updateSessionBar(); }, 60000);

function openSessionModal(){
    if(_sessionIsOpen()){ showToast('الصندوق مفتوح بالفعل','warning','⚠️'); return; }
    var ob=(_session&&_session.openingBalance)||{};
    var hasOp=(ob.USD||0)>0||(ob.ILS||0)>0||(ob.JOD||0)>0;
    if(!hasOp){ showToast('يجب أن يقوم المشرف بتعيين الرصيد الافتتاحي أولاً','error','🏦'); return; }
    document.getElementById('sessionOpenNum').textContent=(_session&&_session.id)||'—';
    document.getElementById('sessionOpenUSD').textContent='$'+Number(ob.USD||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    document.getElementById('sessionOpenILS').textContent='₪'+Number(ob.ILS||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    document.getElementById('sessionOpenJOD').textContent='JD '+Number(ob.JOD||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    document.getElementById('sessionOpenModal').style.display='flex';
}

function confirmOpenSession(){
    document.getElementById('sessionOpenModal').style.display='none';
    _confirmOpeningAndStart();
}

function _confirmOpeningAndStart(){
    if(!_session){showToast('لا يوجد صندوق افتتاحي — انتظر المشرف','warning','⚠️');return;}
    if(_session.status==='open'){showToast('الصندوق مفتوح بالفعل','info','ℹ️');return;}
    var csrf=(document.cookie.split(';').find(function(c){return c.trim().startsWith('csrftoken=');})||'').split('=')[1]||'';
    fetch('/api/tl/session/open',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body:JSON.stringify({})
    })
    .then(function(r){return r.json();})
    .then(function(d){
        if(!d.success){showToast('فشل فتح الجلسة: '+(d.message||''),'error','❌');return;}
        _session = d.session;
        var ob = _session.openingBalance || {};
        openingBalances={USD:Number(ob.USD)||0,ILS:Number(ob.ILS)||0,JOD:Number(ob.JOD)||0};
        tellerBalances=Object.assign({},openingBalances);
        _updateSessionBar();
        initOpeningBox();
        updateTellerBox();
        updateMainBalances();
        showToast('تم تأكيد الصندوق الافتتاحي — الصندوق مفتوح الآن','success','🔓');
    })
    .catch(function(){showToast('لا يوجد اتصال بالخادم','error','❌');});
}

function openCloseSessionModal(){
    // أعد تحميل الجلسة من localStorage إذا لم تكن محملة في الذاكرة
    if(!_session) _loadSession();
    if(!_sessionIsOpen()){ showToast('الصندوق غير مفتوح — افتح الصندوق أولاً','warning','⚠️'); _updateSessionBar(); return; }
    document.getElementById('csExpUSD').textContent='$'+tellerBalances.USD.toLocaleString();
    document.getElementById('csExpILS').textContent='₪'+tellerBalances.ILS.toLocaleString();
    document.getElementById('csExpJOD').textContent='JD '+tellerBalances.JOD.toLocaleString();
    ['csActUSD','csActILS','csActJOD','csNote'].forEach(function(id){ var e=document.getElementById(id); if(e)e.value=''; });
    ['csDiffUSD','csDiffILS','csDiffJOD'].forEach(function(id){ var e=document.getElementById(id); if(e){e.textContent='—';e.style.color='#94a3b8';} });
    var ind=document.getElementById('csMatchIndicator'); if(ind) ind.textContent='';
    document.getElementById('closeSessionModal').style.display='flex';
}

function calcSessionDiff(){
    var syms={USD:'$',ILS:'₪',JOD:'JD '}; var total=0;
    ['USD','ILS','JOD'].forEach(function(cur){
        var act=parseFloat(document.getElementById('csAct'+cur).value)||0;
        var exp=tellerBalances[cur]||0; var diff=act-exp; total+=Math.abs(diff);
        var el=document.getElementById('csDiff'+cur);
        if(el){ el.textContent=(diff>=0?'+':'')+syms[cur]+Math.abs(diff).toFixed(2); el.style.color=diff===0?'#22c55e':diff>0?'#fbbf24':'#f87171'; }
    });
    var ind=document.getElementById('csMatchIndicator');
    if(ind) ind.innerHTML=total<0.01
        ?'<span style="color:#22c55e;font-size:14px">الصندوق متطابق تماماً</span>'
        :'<span style="color:#f87171;font-size:13px">فارق إجمالي: $'+total.toFixed(2)+'</span>';
}

function confirmCloseSession(){
    document.getElementById('closeSessionModal').style.display='none';
    if(!_session){_updateSessionBar();return;}
    var actUSD=parseFloat(document.getElementById('csActUSD').value)||0;
    var actILS=parseFloat(document.getElementById('csActILS').value)||0;
    var actJOD=parseFloat(document.getElementById('csActJOD').value)||0;
    var note=document.getElementById('csNote').value||'';
    var csrf=(document.cookie.split(';').find(function(c){return c.trim().startsWith('csrftoken=');})||'').split('=')[1]||'';
    fetch('/api/tl/session/close',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
        body:JSON.stringify({USD:actUSD,ILS:actILS,JOD:actJOD,note:note})
    })
    .then(function(r){return r.json();})
    .then(function(d){
        if(!d.success){showToast('فشل إغلاق الجلسة: '+(d.message||''),'error','❌');return;}
        var diff=d.session.closingBalance;
        var ob=d.session.openingBalance||{};
        var diffTotal=diff?Math.abs((diff.USD||0)-(ob.USD||0))+Math.abs((diff.ILS||0)-(ob.ILS||0))+Math.abs((diff.JOD||0)-(ob.JOD||0)):0;
        var statusText=diffTotal<0.01?'متطابق':'فارق $'+diffTotal.toFixed(2);
        _session=null;
        _updateSessionBar();
        showToast('تم إغلاق الصندوق — '+statusText,'success','🔒');
    })
    .catch(function(){showToast('لا يوجد اتصال بالخادم','error','❌');});
}

// ══ دفتر القيود المزدوج ══
function _addJournalEntry(debit, credit, desc, time){
    if(!_session) return;
    if(!_session.journal) _session.journal=[];
    _session.journal.push({time:time,desc:desc,debit:debit,credit:credit});
    _saveSession();
    var badge=document.getElementById('journalCount'); if(badge) badge.textContent=_session.journal.length;
}

function openJournalModal(){
    var entries=(_session&&_session.journal)||[];
    document.getElementById('journalSessionId').textContent=_session?_session.id:'لا توجد جلسة';
    var container=document.getElementById('journalEntries');
    if(!entries.length){
        container.innerHTML='<div style="text-align:center;padding:40px;color:rgba(200,210,220,0.35);font-size:13px">لا توجد قيود في هذه الجلسة بعد</div>';
        document.getElementById('journalTotals').innerHTML='';
        document.getElementById('journalModal').style.display='flex'; return;
    }
    var totalD=0,totalC=0;
    container.innerHTML=entries.map(function(e,i){
        var dAmt=e.debit?Number(e.debit.amount||0):0;
        var cAmt=e.credit?Number(e.credit.amount||0):0;
        totalD+=dAmt; totalC+=cAmt;
        var bg=i%2===0?'rgba(255,255,255,0.02)':'transparent';
        var dStr=e.debit?'<span style="color:#22c55e;font-weight:800;direction:ltr">'+(e.debit.sym||'')+dAmt.toLocaleString()+'</span>':'—';
        var cStr=e.credit?'<span style="color:#f87171;font-weight:800;direction:ltr">'+(e.credit.sym||'')+cAmt.toLocaleString()+'</span>':'—';
        return '<div style="display:grid;grid-template-columns:90px 1fr 90px 90px;align-items:center;padding:9px 12px;background:'+bg+';border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px">'
            +'<span style="color:rgba(200,210,220,0.45)">'+e.time+'</span>'
            +'<span style="color:#cbd5e1;font-weight:600">'+e.desc+'</span>'
            +'<div style="text-align:center">'+dStr+'</div>'
            +'<div style="text-align:center">'+cStr+'</div></div>';
    }).join('');
    document.getElementById('journalTotals').innerHTML=
        '<span style="color:rgba(200,210,220,0.5)">الإجماليات</span><span></span>'
        +'<span style="text-align:center;color:#22c55e">'+totalD.toLocaleString()+'</span>'
        +'<span style="text-align:center;color:#f87171">'+totalC.toLocaleString()+'</span>';
    document.getElementById('journalModal').style.display='flex';
}

// ══ فحص الرصيد السالب ══
function _checkBalance(cur, needed){
    var avail=tellerBalances[cur]||0;
    if(avail<needed){
        showToast('رصيد '+cur+' غير كافٍ — المتاح: '+(SYMBOLS[cur]||'')+avail.toLocaleString()+' / المطلوب: '+(SYMBOLS[cur]||'')+needed.toLocaleString(),'error','🚫');
        return false;
    }
    return true;
}


// ════════════════════════════════════════════════════════════════════
// حوالة بنكية — Top-Sheet Bank Transfer Panel
// ════════════════════════════════════════════════════════════════════

function openBankTransferModal() {
    const modal = document.getElementById('bankTransferModal');
    const card  = document.getElementById('bankTransferCard');
    if (!modal) return;
    btmCloseAllDropdowns();
    modal.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
        card.style.transform = 'scale(1)';
        card.style.opacity   = '1';
    }));
    setTimeout(() => { const f = document.getElementById('btm-sender'); if (f) f.focus(); }, 280);
    document.addEventListener('click', btmOutsideClick, true);
}

function closeBankTransferModal() {
    const modal = document.getElementById('bankTransferModal');
    const card  = document.getElementById('bankTransferCard');
    if (!modal) return;
    card.style.transform = 'scale(0.88)';
    card.style.opacity   = '0';
    document.removeEventListener('click', btmOutsideClick, true);
    btmCloseAllDropdowns();
    setTimeout(() => {
        modal.style.display = 'none';
        ['btm-sender','btm-sender-id','btm-receiver','btm-iban','btm-amount','btm-notes'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const bankHid = document.getElementById('btm-bank');     if (bankHid) bankHid.value = '';
        const curHid  = document.getElementById('btm-currency'); if (curHid)  curHid.value  = 'USD';
        const bankLbl = document.getElementById('btm-bank-label'); if (bankLbl) { bankLbl.textContent = 'اختر البنك...'; bankLbl.style.color = '#64748b'; }
        const curLbl  = document.getElementById('btm-cur-label');  if (curLbl)  curLbl.innerHTML = '🇺🇸 <span style="color:#60a5fa;">USD</span>';
        const feeBox  = document.getElementById('btm-fee-box'); if (feeBox) feeBox.style.display = 'none';
        const trigger = document.getElementById('btm-cur-trigger'); if (trigger) trigger.style.color = '#60a5fa';
        const bankTr  = document.getElementById('btm-bank-trigger'); if (bankTr) { bankTr.style.borderColor = 'rgba(251,191,36,0.22)'; bankTr.style.color = '#64748b'; }
    }, 260);
}

// ── Custom Dropdown Logic ──────────────────────────────────────────

function btmToggle(which) {
    const menu    = document.getElementById('btm-' + which + '-menu');
    const trigger = document.getElementById('btm-' + which + '-trigger');
    const arrow   = document.getElementById('btm-' + which + '-arrow');
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    btmCloseAllDropdowns();
    if (!isOpen) {
        menu.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        trigger.style.borderColor = which === 'bank' ? 'rgba(251,191,36,0.65)' : 'rgba(96,165,250,0.65)';
    }
}

function btmCloseAllDropdowns() {
    ['bank','cur'].forEach(w => {
        const m = document.getElementById('btm-' + w + '-menu');
        const a = document.getElementById('btm-' + w + '-arrow');
        if (m) m.style.display = 'none';
        if (a) a.style.transform = '';
    });
}

function btmOutsideClick(e) {
    const wraps = ['btm-bank-wrap','btm-cur-wrap'];
    if (!wraps.some(id => document.getElementById(id)?.contains(e.target))) {
        btmCloseAllDropdowns();
    }
}

function btmPickBank(name, color, icon) {
    document.getElementById('btm-bank').value = name;
    const lbl = document.getElementById('btm-bank-label');
    lbl.innerHTML = icon + ' <span style="color:' + color + '">' + name + '</span>';
    const trigger = document.getElementById('btm-bank-trigger');
    trigger.style.borderColor = color;
    trigger.style.color = color;
    btmCloseAllDropdowns();
}

function btmPickCur(val, labelHtml, color) {
    document.getElementById('btm-currency').value = val;
    document.getElementById('btm-cur-label').innerHTML = labelHtml;
    const trigger = document.getElementById('btm-cur-trigger');
    trigger.style.color = color;
    trigger.style.borderColor = color.replace(')',',0.55)').replace('rgb','rgba');
    btmCloseAllDropdowns();
    btmCalcFee();
}

// ── Fee Calculation ────────────────────────────────────────────────

function btmCalcFee() {
    const amt    = parseFloat(document.getElementById('btm-amount')?.value || 0);
    const cur    = document.getElementById('btm-currency')?.value || 'USD';
    const feeBox = document.getElementById('btm-fee-box');
    if (!feeBox) return;
    if (!amt || amt <= 0) { feeBox.style.display = 'none'; return; }
    const fee   = Math.round(amt * 0.015 * 100) / 100;
    const total = Math.round((amt + fee) * 100) / 100;
    const sym   = cur === 'ILS' ? '₪' : cur === 'JOD' ? 'JD ' : '$';
    const fmt   = n => sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('btm-fee-amt').textContent   = fmt(amt);
    document.getElementById('btm-fee-fee').textContent   = fmt(fee);
    document.getElementById('btm-fee-total').textContent = fmt(total);
    feeBox.style.display = 'block';
}

// ── Submit ─────────────────────────────────────────────────────────

async function submitBankTransferFromTeller() {
    const sender   = (document.getElementById('btm-sender')?.value   || '').trim();
    const receiver = (document.getElementById('btm-receiver')?.value || '').trim();
    const iban     = (document.getElementById('btm-iban')?.value     || '').trim();
    const bank     = document.getElementById('btm-bank')?.value      || '';
    const amount   = parseFloat(document.getElementById('btm-amount')?.value || 0);
    const currency = document.getElementById('btm-currency')?.value  || 'USD';
    const notes    = (document.getElementById('btm-notes')?.value    || '').trim();

    const errors = [];
    if (!sender)            errors.push('اسم المُرسِل مطلوب');
    if (!receiver)          errors.push('اسم المستفيد مطلوب');
    if (!iban)              errors.push('رقم الحساب / IBAN مطلوب');
    if (!bank)              errors.push('يرجى اختيار البنك المستقبل');
    if (!amount || amount <= 0) errors.push('المبلغ يجب أن يكون أكبر من الصفر');
    if (errors.length) { showToast(errors[0], 'error', '⚠️'); return; }

    const btn = document.getElementById('btm-submit-btn');
    const SEND_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>';
    if (btn) { btn.disabled = true; btn.innerHTML = 'جاري الإرسال...'; btn.style.opacity = '0.7'; }

    try {
        const resp = await apiBkTransferCreate({
            transferType: 'outgoing',
            senderName: sender, receiverName: receiver,
            iban, bankName: bank, amount, currency, notes,
        });
        if (resp && resp.success) {
            const ref = resp.transfer?.refNumber || 'BNK-' + Date.now();
            closeBankTransferModal();
            showToast('تم إرسال الحوالة البنكية بنجاح — ' + ref, 'success', '🏦');
        } else {
            showToast((resp && resp.message) || 'فشل إرسال التحويل البنكي', 'error', '❌');
            if (btn) { btn.disabled = false; btn.innerHTML = SEND_ICON + ' إرسال للبنك'; btn.style.opacity = '1'; }
        }
    } catch (e) {
        showToast('خطأ في الاتصال بالخادم', 'error', '🔌');
        if (btn) { btn.disabled = false; btn.innerHTML = SEND_ICON + ' إرسال للبنك'; btn.style.opacity = '1'; }
    }
}

// ══════════════════════════════════════════════════════════════
// WebSocket — تحديث الأسعار الفوري من المشرف
// ══════════════════════════════════════════════════════════════
(function initTellerWS() {
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
            // ping كل 25 ث لمنع قطع الاتصال
            _pingInterval = setInterval(function() {
                if (_ws && _ws.readyState === WebSocket.OPEN)
                    _ws.send(JSON.stringify({type:'ping'}));
            }, 25000);
        };

        _ws.onmessage = function(e) {
            var msg;
            try { msg = JSON.parse(e.data); } catch(x) { return; }

            if (msg.type === 'rates_update' && msg.rates) {
                _applyRatesData(msg.rates);
                showToast('تم تحديث الأسعار من المشرف', 'success', '💱');
            }

            if (msg.type === 'teller_box_opened' && msg.payload) {
                // المشرف فتح الصندوق — حدّث الجلسة والأرصدة فوراً
                var p = msg.payload;
                showToast(
                    'فتح المشرف صندوقك — $' + (p.usd||0) + ' | ₪' + (p.ils||0) + ' | JD' + (p.jod||0),
                    'success', '🏦'
                );
                // اجلب الجلسة الجديدة من الخادم مباشرة
                _loadSession();
                setTimeout(_loadSession, 1500);
            }

            if (msg.type === 'teller_request_response' && msg.request) {
                // رد المشرف على طلب (موافقة/رفض/سعر مميز)
                var req = msg.request;
                if (req.request_type === 'special_price') {
                    if (req.status === 'approved') {
                        if (typeof _onSpecialPriceApproved === 'function') _onSpecialPriceApproved(req);
                    } else if (req.status === 'rejected') {
                        if (typeof _onSpecialPriceRejected === 'function') _onSpecialPriceRejected(req);
                    }
                } else {
                    var lvl = req.status === 'approved' ? 'success' : (req.status === 'rejected' ? 'error' : 'info');
                    showToast('رد المشرف: ' + (req.reply || req.status), lvl, '💬');
                }
            }

            if (msg.type === 'voice_result' && msg.result) {
                if (typeof showVoicePopup   === 'function') showVoicePopup(msg.result);
                if (typeof _applyVoiceResult === 'function') _applyVoiceResult(msg.result);
            }
        };

        _ws.onclose = function() {
            clearInterval(_pingInterval);
            scheduleReconnect();
        };

        _ws.onerror = function() { _ws.close(); };
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

// ── تهيئة بيانات التلر من الخادم ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    if (typeof initTeller === 'function') initTeller();
});
