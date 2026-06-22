// ═══════════════════════════════════════
// CURRENCY
// ═══════════════════════════════════════
const CUR={USD:{s:'$',n:'دولار',f:'🇺🇸',c:'cur-usd'},ILS:{s:'₪',n:'شيكل',f:'🇵🇸',c:'cur-ils'},JOD:{s:'د.ا',n:'دينار',f:'🇯🇴',c:'cur-jod'}};
const fc=(a,c='USD')=>(CUR[c]||CUR.USD).s+Number(a).toLocaleString('en-US');
const cb=(c)=>{const x=CUR[c]||CUR.USD;return `<span class="cur-badge ${x.c}">${x.f} ${x.n}</span>`};

// ═══════════════════════════════════════
// DATA
// ═══════════════════════════════════════
let nextId = 100;
let state = {
  queue:     [], // تُملأ من API: GET /api/bk/transfers
  completed: [], // تُملأ من API: GET /api/bk/transfers
  buySell:   [], // تُملأ من API: GET /api/bk/transfers
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function notify(msg, type='success') {
  const el=document.getElementById('notification');
  el.textContent=msg;
  el.style.borderColor=type==='error'?'#FF6B7A':type==='warning'?'#FFC107':'#5CB85C';
  el.style.color=type==='error'?'#FF6B7A':type==='warning'?'#FFC107':'#5CB85C';
  el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3000);
}
function genRef(){return 'BT-2025-'+String(++nextId).padStart(4,'0')}

// Clock
window._navClockStarted = true;
function updateClock(){const now=new Date();const _c=document.getElementById('clock');const _d=document.getElementById('dateD')||document.getElementById('dateDisplay');if(_c)_c.textContent=now.toLocaleTimeString('ar-EG-u-nu-latn',{hour12:false});if(_d)_d.textContent=now.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
setInterval(updateClock,1000);updateClock();

// ═══════════════════════════════════════
// SIDEBAR & TABS
// ═══════════════════════════════════════
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sidebarOverlay').classList.toggle('open')}

const TAB_INFO=[
  {i:'📊',t:'لوحة التحكم'},{i:'📨',t:'الحوالات الواردة'},{i:'💸',t:'تنفيذ تحويل جديد'},
  {i:'🔄',t:'بيع وشراء عبر البنك'},{i:'📋',t:'سجل العمليات'}
];
let activeTab=0;
function switchTab(i){
  document.querySelectorAll('.tab-pane').forEach((p,idx)=>p.classList.toggle('active',idx===i));
  document.querySelectorAll('.nav-item[data-tab]').forEach((n,idx)=>n.classList.toggle('active',idx===i));
  activeTab=i;
  const inf=TAB_INFO[i]||TAB_INFO[0];
  document.getElementById('hsi').textContent=inf.i;document.getElementById('hst').textContent=inf.t;
  if(window.innerWidth<=960){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('open')}
  renderAll();
}

// ═══════════════════════════════════════
// MODALS
// ═══════════════════════════════════════
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
function closeModalOut(e,id){if(e.target===document.getElementById(id))closeModal(id)}

// ═══════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════
async function submitNewTransfer(){
  const sender=document.getElementById('nf-sender').value.trim();
  const receiver=document.getElementById('nf-receiver').value.trim();
  const account=document.getElementById('nf-account').value.trim();
  const bank=document.getElementById('nf-bank').value;
  const amount=Number(document.getElementById('nf-amount').value);
  const currency=document.getElementById('nf-currency').value;
  const notes=document.getElementById('nf-notes').value.trim();
  if(!sender||!receiver||!account||!bank||!amount) return notify('يرجى ملء جميع الحقول المطلوبة','error');

  const resp = await apiBkTransferCreate({
    transferType: 'outgoing',
    senderName:   sender,
    receiverName: receiver,
    iban:         account,
    bankName:     bank,
    amount, currency, notes,
  }).catch(()=>null);

  if(resp && !resp.success) return notify(resp.message||'فشل إنشاء التحويل','error');
  const ref = resp?.transfer?.refNumber || genRef();
  const t={id: resp?.transfer?.id || ++nextId, ref, sender, receiver, account, bank, amount, currency, notes, status:'pending', date:new Date().toLocaleString('ar-PS')};
  if(!resp?.success) state.queue.push(t);
  clearNewForm();
  notify('تم إرسال التحويل للبنك بنجاح — '+ref);
  switchTab(1);
}

function clearNewForm(){['nf-sender','nf-sender-id','nf-receiver','nf-account','nf-amount','nf-notes'].forEach(id=>document.getElementById(id).value='')}

function doQuickTransfer(){
  const recv=document.getElementById('qf-recv').value.trim();
  const acc=document.getElementById('qf-acc').value.trim();
  const bank=document.getElementById('qf-bank').value;
  const amt=Number(document.getElementById('qf-amt').value);
  const cur=document.getElementById('qf-cur').value;
  if(!recv||!acc||!amt) return notify('يرجى ملء الحقول المطلوبة','error');
  const t={id:++nextId,ref:genRef(),sender:'تحويل سريع',senderId:'',receiver:recv,account:acc,bank,amount:amt,currency:cur,teller:'مباشر',priority:'normal',notes:'تحويل سريع',status:'processing',date:new Date().toLocaleString('ar-PS')};
  state.queue.push(t);
  ['qf-recv','qf-acc','qf-amt'].forEach(id=>document.getElementById(id).value='');
  closeModal('quick-transfer-modal');
  notify('تم إرسال التحويل السريع — '+t.ref);
  renderAll();
}

function processTransfer(id){
  const t=state.queue.find(x=>x.id===id);
  if(!t)return;
  document.getElementById('process-modal-content').innerHTML=`
    <div class="modal-title">تنفيذ التحويل ${t.ref}</div>
    <div class="modal-sub">مراجعة وتأكيد إرسال الحوالة للبنك</div>
    <div style="background:#0A0F1C;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px">
        <div><span class="text-muted">المرسل:</span> <strong>${t.sender}</strong></div>
        <div><span class="text-muted">المستفيد:</span> <strong>${t.receiver}</strong></div>
        <div><span class="text-muted">الحساب:</span> <strong style="direction:ltr;display:inline-block">${t.account}</strong></div>
        <div><span class="text-muted">البنك:</span> <strong>${t.bank}</strong></div>
        <div><span class="text-muted">المبلغ:</span> <strong class="text-gold" style="font-size:16px">${fc(t.amount,t.currency)}</strong> ${cb(t.currency)}</div>
        <div><span class="text-muted">التلر:</span> <strong>${t.teller}</strong></div>
      </div>
      ${t.notes?`<div style="margin-top:10px;padding:8px;background:rgba(50,184,198,0.05);border-radius:8px;font-size:11px;color:#7B8DB5">${t.notes}</div>`:''}
    </div>
    <div class="form-group">
      <div><label class="field-label">رقم المرجع البنكي</label><input class="field-input" id="proc-ref" placeholder="رقم المرجع من البنك" style="direction:ltr;text-align:left"/></div>
      <div><label class="field-label">ملاحظات الموظف</label><textarea class="field-input" id="proc-notes" placeholder="ملاحظات..."></textarea></div>
      <div class="form-btn-row">
        <button class="btn btn-gold" onclick="confirmProcess(${t.id})">تأكيد التنفيذ</button>
        <button class="btn btn-danger" onclick="rejectTransfer(${t.id})">رفض</button>
        <button class="btn btn-gray" onclick="closeModal('process-modal')">إلغاء</button>
      </div>
    </div>`;
  openModal('process-modal');
}

async function confirmProcess(id){
  const t=state.queue.find(x=>x.id===id);
  if(!t)return;
  const bankRef=document.getElementById('proc-ref').value.trim()||'';

  const resp = await apiBkTransferComplete(id, bankRef).catch(()=>null);
  if(resp && !resp.success) return notify(resp.message||'فشل تنفيذ التحويل','error');

  t.status='completed'; t.bankRef=bankRef;
  state.completed.push({...t, type:'transfer'});
  state.queue=state.queue.filter(x=>x.id!==id);
  closeModal('process-modal');
  notify('تم تنفيذ التحويل بنجاح — '+t.ref);
  renderAll();
}

async function rejectTransfer(id){
  const t=state.queue.find(x=>x.id===id);
  if(!t)return;

  const resp = await apiBkTransferReject(id, 'رفض من الموظف').catch(()=>null);
  if(resp && !resp.success) return notify(resp.message||'فشل رفض التحويل','error');

  t.status='rejected';
  state.queue=state.queue.filter(x=>x.id!==id);
  closeModal('process-modal');
  notify('تم رفض التحويل — '+t.ref,'error');
  renderAll();
}

function markProcessing(id){
  const t=state.queue.find(x=>x.id===id);
  if(t){t.status='processing';notify('تم تحويل الحالة إلى قيد التنفيذ','warning');renderAll()}
}

function submitBuySell(){
  const type=document.getElementById('bs-type').value;
  const cur=document.getElementById('bs-cur').value;
  const amt=Number(document.getElementById('bs-amt').value);
  const rate=Number(document.getElementById('bs-rate').value)||0;
  const party=document.getElementById('bs-party').value.trim();
  const ref=document.getElementById('bs-ref').value.trim();
  const notes=document.getElementById('bs-notes').value.trim();
  if(!amt) return notify('أدخل المبلغ','error');
  state.buySell.push({id:++nextId,type,currency:cur,amount:amt,rate,party:party||'—',ref:ref||'—',notes,date:new Date().toLocaleString('ar-PS'),status:'completed'});
  ['bs-amt','bs-rate','bs-party','bs-ref','bs-notes'].forEach(id=>document.getElementById(id).value='');
  closeModal('buysell-modal');
  notify(`تم تسجيل عملية ${type==='buy'?'الشراء':'البيع'} بنجاح`);
  renderAll();
}

// ═══════════════════════════════════════
// QUEUE FILTER
// ═══════════════════════════════════════
let queueFilter='all';
function filterQueue(f){
  queueFilter=f;
  ['all','pending','processing','urgent'].forEach(x=>{
    const b=document.getElementById('iqft-'+x);
    if(!b)return;
    b.classList.remove('iq-ftab-active','iq-ftab-urg-active');
    if(x===f){
      b.classList.add(f==='urgent'?'iq-ftab-urg-active':'iq-ftab-active');
    }
  });
  renderQueue();
}

// ═══════════════════════════════════════
// QUEUE HELPERS
// ═══════════════════════════════════════
function calcElapsed(dateStr){
  const d=new Date(dateStr.replace(' ','T'));
  const mins=Math.floor((Date.now()-d)/60000);
  if(mins<1) return{text:'الآن',cls:'iq-timer-green'};
  if(mins<15) return{text:mins+' دقيقة',cls:'iq-timer-green'};
  if(mins<60) return{text:mins+' دقيقة',cls:'iq-timer-amber'};
  if(mins<1440) return{text:Math.floor(mins/60)+' ساعة',cls:'iq-timer-red'};
  return{text:Math.floor(mins/1440)+' يوم',cls:'iq-timer-red'};
}
function updateQueueStats(){
  const all=state.queue.filter(t=>t.status!=='completed'&&t.status!=='rejected');
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('iq-s-total',all.length);
  set('iq-s-urgent',all.filter(t=>t.priority==='urgent').length);
  set('iq-s-pending',all.filter(t=>t.status==='pending').length);
  set('iq-s-proc',all.filter(t=>t.status==='processing').length);
  const tot=all.reduce((s,t)=>s+(t.amount||0),0);
  set('iq-s-amt','$'+tot.toLocaleString());
}

// ═══════════════════════════════════════
// RENDER
// ═══════════════════════════════════════
function renderAll(){renderStats();renderDashBuySell();renderDashRecent();renderQueue();renderBuySell();renderOpsLog();updateSBStats()}

function updateSBStats(){
  const pending=state.queue.filter(t=>t.status==='pending'||t.status==='processing').length;
  const done=state.completed.length;
  const buys=state.buySell.filter(x=>x.type==='buy').length;
  const sells=state.buySell.filter(x=>x.type==='sell').length;
  document.getElementById('sb-pending').textContent=pending;
  document.getElementById('sb-ops').textContent=state.completed.length+state.buySell.length;
  document.getElementById('sf-done').textContent=done;
  document.getElementById('sf-pend').textContent=pending;
  document.getElementById('sf-buy').textContent=buys;
  document.getElementById('sf-sell').textContent=sells;
}

function renderStats(){
  const pending=state.queue.filter(t=>t.status==='pending').length;
  const processing=state.queue.filter(t=>t.status==='processing').length;
  const totalCompleted=state.completed.length;
  const totalBuy=state.buySell.filter(x=>x.type==='buy').reduce((s,x)=>s+x.amount,0);
  const totalSell=state.buySell.filter(x=>x.type==='sell').reduce((s,x)=>s+x.amount,0);
  const stats=[
    {l:'حوالات بانتظار',v:pending,i:'📨',c:'#32b8c6'},
    {l:'قيد التنفيذ',v:processing,i:'⏳',c:'#5BC0DE'},
    {l:'تم التنفيذ',v:totalCompleted,i:'✅',c:'#5CB85C'},
    {l:'إجمالي الشراء اليوم',v:'$'+totalBuy.toLocaleString(),i:'📥',c:'#5CB85C'},
    {l:'إجمالي البيع اليوم',v:'$'+totalSell.toLocaleString(),i:'📤',c:'#FF6B7A'},
  ];
  document.getElementById('stats-row').innerHTML=stats.map(s=>`
    <div class="scard" style="--sc-color:${s.c}"><div class="scard-inner"><div><div class="scard-label">${s.l}</div><div class="scard-val" style="color:${s.c}">${s.v}</div></div><div class="scard-icon">${s.i}</div></div></div>`).join('');
}

function renderDashBuySell(){
  const buys=state.buySell.filter(x=>x.type==='buy');
  const sells=state.buySell.filter(x=>x.type==='sell');
  const totalBuy=buys.reduce((s,x)=>s+x.amount,0);
  const totalSell=sells.reduce((s,x)=>s+x.amount,0);
  // Per currency
  const buyCur={USD:0,ILS:0,JOD:0},sellCur={USD:0,ILS:0,JOD:0};
  buys.forEach(x=>buyCur[x.currency]=(buyCur[x.currency]||0)+x.amount);
  sells.forEach(x=>sellCur[x.currency]=(sellCur[x.currency]||0)+x.amount);

  document.getElementById('dash-buysell').innerHTML=`
    <div class="card-title"><span class="cti"></span>ملخص البيع والشراء عبر البنك</div>
    <div class="bs-grid">
      <div class="bs-col bs-buy">
        <div class="bs-title">الشراء (إيداع)</div>
        <div class="bs-amount">$${totalBuy.toLocaleString()}</div>
        <div class="bs-count">${buys.length} عملية</div>
        <div class="bs-sub">
          ${buyCur.USD?`<span class="cur-badge cur-usd">${fc(buyCur.USD,'USD')}</span>`:''}
          ${buyCur.ILS?`<span class="cur-badge cur-ils">${fc(buyCur.ILS,'ILS')}</span>`:''}
          ${buyCur.JOD?`<span class="cur-badge cur-jod">${fc(buyCur.JOD,'JOD')}</span>`:''}
        </div>
      </div>
      <div class="bs-col bs-sell">
        <div class="bs-title">البيع (سحب)</div>
        <div class="bs-amount">$${totalSell.toLocaleString()}</div>
        <div class="bs-count">${sells.length} عملية</div>
        <div class="bs-sub">
          ${sellCur.USD?`<span class="cur-badge cur-usd">${fc(sellCur.USD,'USD')}</span>`:''}
          ${sellCur.ILS?`<span class="cur-badge cur-ils">${fc(sellCur.ILS,'ILS')}</span>`:''}
          ${sellCur.JOD?`<span class="cur-badge cur-jod">${fc(sellCur.JOD,'JOD')}</span>`:''}
        </div>
      </div>
    </div>
    <div style="margin-top:14px;text-align:center">
      <button class="btn btn-sm btn-outline" onclick="switchTab(3)">عرض التفاصيل ←</button>
    </div>`;
}

function renderDashRecent(){
  const all=[...state.completed.map(x=>({...x,_type:'transfer'})),...state.buySell.map(x=>({...x,_type:x.type}))].sort((a,b)=>b.id-a.id).slice(0,6);
  document.getElementById('dash-recent').innerHTML=`
    <div class="card-title"><span class="cti"></span>آخر العمليات</div>
    ${all.map(t=>{
      const typeLabel=t._type==='transfer'?'تحويل بنكي':t._type==='buy'?'شراء':'بيع';
      const typeCls=t._type==='transfer'?'text-blue':t._type==='buy'?'text-green':'text-red';
      return `<div class="flex-between" style="padding:10px 0;border-bottom:1px solid #141D32">
        <div>
          <div style="font-weight:600;font-size:12px" class="${typeCls}">${typeLabel}</div>
          <div class="fs-11 text-muted">${t.receiver||t.party||'—'}</div>
          <div class="fs-10 text-muted">${t.date}</div>
        </div>
        <div style="text-align:left">
          <div class="fw-700 text-gold" style="font-size:13px">${fc(t.amount,t.currency)}</div>
          ${cb(t.currency)}
        </div>
      </div>`;
    }).join('')}
    <div style="margin-top:12px;text-align:center"><button class="btn btn-sm btn-outline" onclick="switchTab(4)">جميع العمليات ←</button></div>`;
}

function renderQueue(){
  let items=state.queue.filter(t=>t.status!=='completed'&&t.status!=='rejected');
  if(queueFilter==='pending')    items=items.filter(t=>t.status==='pending');
  if(queueFilter==='processing') items=items.filter(t=>t.status==='processing');
  if(queueFilter==='urgent')     items=items.filter(t=>t.priority==='urgent');

  // Search
  const q=(document.getElementById('iq-search')||{value:''}).value.trim();
  if(q){
    const ql=q.toLowerCase();
    items=items.filter(t=>
      t.sender.includes(q)||t.receiver.includes(q)||
      t.ref.toLowerCase().includes(ql)||t.bank.includes(q)||
      (t.senderId||'').includes(q)||(t.account||'').includes(ql)
    );
  }

  items.sort((a,b)=>{
    if(a.priority==='urgent'&&b.priority!=='urgent')return -1;
    if(b.priority==='urgent'&&a.priority!=='urgent')return 1;
    return b.id-a.id;
  });

  updateQueueStats();
  const list=document.getElementById('queue-list');
  if(!list)return;

  if(items.length===0){
    list.innerHTML=`
      <div class="iq-empty">
        <div class="iq-empty-title">لا توجد حوالات</div>
        <div class="iq-empty-sub">جميع الحوالات تمت معالجتها أو لا توجد نتائج للبحث</div>
      </div>`;
    return;
  }

  list.innerHTML='<div class="iq-grid">'+items.map(t=>{
    const isUrgent=t.priority==='urgent';
    const isPending=t.status==='pending';
    const tm=calcElapsed(t.date);
    const shortAcc=t.account.length>16?t.account.slice(0,8)+'…'+t.account.slice(-5):t.account;
    const senderInit=t.sender.trim().charAt(0);
    const receiverInit=t.receiver.trim().charAt(0);
    const tellerName=t.teller.split('—')[1]?.trim()||t.teller.split('—')[0].trim();
    return `
    <div class="iq-card${isUrgent?' iq-card-urgent':''}">

      ${isUrgent?'<div class="iq-card-glow"></div>':''}

      <!-- Header -->
      <div class="iq-hdr iq-hdr-${isUrgent?'urgent':'normal'}">
        <span class="iq-ref-chip">${t.ref}</span>
        <span class="iq-timer ${tm.cls}">${tm.text}</span>
      </div>

      <!-- Body -->
      <div class="iq-body">
        <div class="iq-flow">

          <!-- Sender -->
          <div class="iq-party">
            <div class="iq-avatar iq-av-sender">${senderInit}</div>
            <div class="iq-party-info">
              <span class="iq-party-label">المُرسِل</span>
              <span class="iq-party-name">${t.sender}</span>
              <span class="iq-party-id">${t.senderId||'—'}</span>
            </div>
          </div>

          <!-- Amount strip -->
          <div class="iq-flow-center">
            <div class="iq-flow-line"></div>
            <div class="iq-flow-amount">
              <span class="iq-amt-val">${fc(t.amount,t.currency)}</span>
              ${cb(t.currency)}
            </div>
            <div class="iq-flow-line"></div>
          </div>

          <!-- Receiver -->
          <div class="iq-party">
            <div class="iq-avatar iq-av-receiver">${receiverInit}</div>
            <div class="iq-party-info">
              <span class="iq-party-label">المستفيد</span>
              <span class="iq-party-name iq-recv-name">${t.receiver}</span>
              <span class="iq-party-id" dir="ltr">${shortAcc}</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Footer -->
      <div class="iq-footer">
        <div class="iq-footer-meta">
          <span class="iq-meta-bank">${t.bank}</span>
          <span class="iq-meta-sep">•</span>
          <span class="iq-meta-teller">${tellerName}</span>
          ${isUrgent?'<span class="iq-badge-urg">مستعجل</span>':''}
          <span class="iq-status-pill iq-sp-${isPending?'pending':'proc'}">${isPending?'بانتظار':'قيد التنفيذ'}</span>
        </div>
        <div class="iq-footer-actions">
          <button class="iq-btn-exec" onclick="processTransfer(${t.id})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            تنفيذ التحويل
          </button>
          ${isPending?`<button class="iq-btn-icon iq-btn-proc" title="قيد التنفيذ" onclick="markProcessing(${t.id})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>`:''}
          <button class="iq-btn-icon iq-btn-rej" title="رفض" onclick="rejectTransfer(${t.id})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

    </div>`;
  }).join('')+'</div>';
}

function renderBuySell(){
  const buys=state.buySell.filter(x=>x.type==='buy');
  const sells=state.buySell.filter(x=>x.type==='sell');
  // Summary cards per currency
  const curList=['USD','ILS','JOD'];
  document.getElementById('bs-summary').innerHTML=curList.map(c=>{
    const bAmt=buys.filter(x=>x.currency===c).reduce((s,x)=>s+x.amount,0);
    const sAmt=sells.filter(x=>x.currency===c).reduce((s,x)=>s+x.amount,0);
    const net=bAmt-sAmt;
    return `<div class="card" style="--card-accent:${c==='USD'?'#5CB85C':c==='ILS'?'#5BC0DE':'#32b8c6'}">
      <div class="flex-between mb12"><div class="card-title" style="margin-bottom:0">${CUR[c].f} ${CUR[c].n}</div>${cb(c)}</div>
      <div class="bs-grid" style="margin-top:0">
        <div class="bs-col bs-buy" style="padding:12px">
          <div class="bs-title" style="font-size:10px">شراء</div>
          <div class="bs-amount" style="font-size:18px">${fc(bAmt,c)}</div>
        </div>
        <div class="bs-col bs-sell" style="padding:12px">
          <div class="bs-title" style="font-size:10px">بيع</div>
          <div class="bs-amount" style="font-size:18px">${fc(sAmt,c)}</div>
        </div>
      </div>
      <div style="text-align:center;margin-top:10px;font-size:12px;font-weight:700;color:${net>=0?'#5CB85C':'#FF6B7A'}">الصافي: ${net>=0?'+':''}${fc(net,c)}</div>
    </div>`;
  }).join('');

  // Table
  const sorted=[...state.buySell].sort((a,b)=>b.id-a.id);
  document.getElementById('bs-table-wrap').innerHTML=`
    <div class="card-title"><span class="cti"></span>سجل عمليات البيع والشراء</div>
    <div style="overflow-x:auto">
    <table class="tbl">
      <thead><tr><th>#</th><th>النوع</th><th>العملة</th><th>المبلغ</th><th>سعر الصرف</th><th>الطرف الآخر</th><th>المرجع</th><th>التاريخ</th><th>الحالة</th></tr></thead>
      <tbody>
        ${sorted.map(x=>`<tr>
          <td class="text-muted">${x.id}</td>
          <td><span style="font-weight:700;color:${x.type==='buy'?'#5CB85C':'#FF6B7A'}">${x.type==='buy'?'شراء':'بيع'}</span></td>
          <td>${cb(x.currency)}</td>
          <td class="amount-cell" style="color:${x.type==='buy'?'#5CB85C':'#FF6B7A'};font-size:13px">${x.type==='buy'?'+':'−'}${fc(x.amount,x.currency)}</td>
          <td class="text-muted">${x.rate||'—'}</td>
          <td>${x.party}</td>
          <td style="direction:ltr;font-size:11px">${x.ref}</td>
          <td class="text-muted fs-11">${x.date}</td>
          <td><span class="badge badge-active">مكتمل</span></td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}

function renderOpsLog(){
  const fType=document.getElementById('filter-type')?.value||'all';
  const fStatus=document.getElementById('filter-status')?.value||'all';
  const fCur=document.getElementById('filter-cur')?.value||'all';

  let all=[
    ...state.completed.map(x=>({...x,_t:'transfer',_tl:'تحويل بنكي'})),
    ...state.buySell.map(x=>({...x,_t:x.type,_tl:x.type==='buy'?'شراء عبر البنك':'بيع عبر البنك',receiver:x.party})),
    ...state.queue.filter(x=>x.status!=='completed').map(x=>({...x,_t:'transfer',_tl:'تحويل بنكي'}))
  ];
  if(fType!=='all') all=all.filter(x=>fType==='transfer'?x._t==='transfer':x._t===fType);
  if(fStatus!=='all') all=all.filter(x=>x.status===fStatus);
  if(fCur!=='all') all=all.filter(x=>x.currency===fCur);
  all.sort((a,b)=>b.id-a.id);

  document.getElementById('ops-log-wrap').innerHTML=`
    <div style="overflow-x:auto">
    <table class="tbl">
      <thead><tr><th>المرجع</th><th>النوع</th><th>العملة</th><th>المبلغ</th><th>المستفيد / الطرف</th><th>البنك</th><th>التاريخ</th><th>الحالة</th></tr></thead>
      <tbody>
        ${all.length===0?`<tr><td colspan="8" style="text-align:center;padding:30px;color:#4A5575">لا توجد عمليات مطابقة</td></tr>`:''}
        ${all.map(x=>{
          const stBadge=x.status==='completed'?'badge-active':x.status==='pending'?'badge-pending':x.status==='processing'?'badge-process':'badge-inactive';
          const stText=x.status==='completed'?'مكتمل':x.status==='pending'?'بانتظار':x.status==='processing'?'قيد التنفيذ':'مرفوض';
          const tColor=x._t==='transfer'?'#5BC0DE':x._t==='buy'?'#5CB85C':'#FF6B7A';
          return `<tr>
            <td><span class="fw-700 text-gold" style="font-size:11px">${x.ref||'—'}</span></td>
            <td><span style="font-weight:600;color:${tColor};font-size:11px">${x._tl}</span></td>
            <td>${cb(x.currency)}</td>
            <td class="amount-cell" style="font-size:13px;color:#32b8c6">${fc(x.amount,x.currency)}</td>
            <td class="fs-12">${x.receiver||x.party||'—'}</td>
            <td class="fs-11 text-muted">${x.bank||'—'}</td>
            <td class="fs-11 text-muted">${x.date}</td>
            <td><span class="badge ${stBadge}" style="font-size:10px">${stText}</span></td>
          </tr>`;}).join('')}
      </tbody>
    </table></div>`;
}

// ── وضع فاتح/داكن ──
const _SUN_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const _MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
function toggleTheme() { /* dark mode only — light mode disabled */ }


// Init
renderAll();

// ── بيانات المستخدم وتسجيل الخروج ──
function logout() {
  
  window.location.href = '/logout/';
}
(function() {
  try {
    const u = (window._currentUser || {});
    if (u.username) {
      const el = document.getElementById('userDisplayName');
      const rl = document.getElementById('userDisplayRole');
      if (el) el.textContent = u.username;
      if (rl) rl.textContent = u.roleName || u.role;
    }
  } catch(e) {}
})();
// ══════ رفع التقرير — التحويل البنكي ══════
let _acntRptFileData=null,_acntRptFileMeta=null;
const _ACNT_RPT_EMOJIS={pdf:'📄',excel:'📊',word:'📝',image:'🖼️',other:'📁'};
const _ACNT_RPT_MIME={'application/pdf':'pdf','application/vnd.ms-excel':'excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'excel','application/msword':'word','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'word','image/png':'image','image/jpeg':'image','image/jpg':'image','image/gif':'image','image/webp':'image'};
function _acntRptFmtSz(b){if(b<1024)return b+' B';if(b<1048576)return (b/1024).toFixed(1)+' KB';return (b/1048576).toFixed(1)+' MB';}
function _acntRptType(m,n){if(_ACNT_RPT_MIME[m])return _ACNT_RPT_MIME[m];const e=(n||'').split('.').pop().toLowerCase();if(e==='pdf')return 'pdf';if(['xls','xlsx','csv'].includes(e))return 'excel';if(['doc','docx'].includes(e))return 'word';if(['png','jpg','jpeg','gif','webp'].includes(e))return 'image';return 'other';}
function acntRptClearFile(){_acntRptFileData=null;_acntRptFileMeta=null;const i=document.getElementById('acntRptFileInput');if(i)i.value='';const _p=document.getElementById('acntRptFilePreview');const _dz=document.getElementById('acntRptDropZone');if(_p)_p.style.display='none';if(_dz)_dz.style.display='';}
function _acntRptShowPreview(n,s,t){document.getElementById('acntRptFileIcon').textContent=_ACNT_RPT_EMOJIS[t]||'📁';document.getElementById('acntRptFileNameDisplay').textContent=n;document.getElementById('acntRptFileSizeDisplay').textContent=_acntRptFmtSz(s);document.getElementById('acntRptDropZone').style.display='none';document.getElementById('acntRptFilePreview').style.display='flex';}
function _acntRptRead(file){if(file.size>10*1024*1024){notify('حجم الملف يتجاوز 10 MB','error');return;}const t=_acntRptType(file.type,file.name);_acntRptFileMeta={name:file.name,size:file.size,type:t};_acntRptShowPreview(file.name,file.size,t);const r=new FileReader();r.onload=ev=>{_acntRptFileData=ev.target.result;};r.readAsDataURL(file);}
function acntRptFileChosen(i){if(i.files&&i.files[0])_acntRptRead(i.files[0]);}
function acntRptFileDrop(e){const f=e.dataTransfer.files;if(f&&f[0])_acntRptRead(f[0]);}
function acntOpenReportModal(){const overlay=document.getElementById('acntReportOverlay');if(!overlay)return;try{_acntRptFileData=null;_acntRptFileMeta=null;const t=document.getElementById('acntRptTitle');if(t)t.value='';acntRptClearFile();}catch(e){}try{const u=(window._currentUser||{});const el=document.getElementById('acntRptSenderDisplay');if(el&&u.username)el.textContent=u.username;}catch(e){}overlay.style.setProperty('display','flex','important');}
function acntCloseReportModal(){const o=document.getElementById('acntReportOverlay');if(o)o.style.setProperty('display','none','important');}
function acntSubmitReport(){const title=(document.getElementById('acntRptTitle').value||'').trim();if(!title){notify('يرجى إدخال عنوان التقرير','error');return;}if(!_acntRptFileData||!_acntRptFileMeta){notify('يرجى اختيار ملف للرفع','error');return;}let sender='موظف البنك';try{const u=(window._currentUser||{});if(u.username)sender=u.username;}catch(e){}const now=new Date();const p=n=>String(n).padStart(2,'0');const date=now.getFullYear()+'-'+p(now.getMonth()+1)+'-'+p(now.getDate())+' '+p(now.getHours())+':'+p(now.getMinutes());const obj={source:'bank',title,fileName:_acntRptFileMeta.name,fileType:_acntRptFileMeta.type,fileSize:_acntRptFmtSz(_acntRptFileMeta.size),fileData:_acntRptFileData,sender,department:'التحويل البنكي',branch:'الفرع الرئيسي',branchId:1,date};try{const ex=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');ex.unshift(obj);localStorage.setItem('intl_admin_reports',JSON.stringify(ex));}catch(err){try{obj.fileData=null;const ex2=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');ex2.unshift(obj);localStorage.setItem('intl_admin_reports',JSON.stringify(ex2));}catch(e){}}acntCloseReportModal();notify('تم إرسال الملف "'+_acntRptFileMeta.name+'" للإدارة بنجاح','success');}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('acntReportOverlay').style.display==='flex')acntCloseReportModal();});
