/* svTransfers populated exclusively from transactions page via localStorage */
const svTransfers = [];
const svTellers=[{name:'أحمد الموظف',role:'صراف رئيسي',transfers:18,volume:'$42,100',avgTime:'3.8م',status:'online'},{name:'سارة المحاسبة',role:'صرافة',transfers:15,volume:'$38,500',avgTime:'4.1م',status:'online'},{name:'محمود الكاشير',role:'صراف',transfers:14,volume:'$47,850',avgTime:'3.5م',status:'online'},{name:'ليلى العمليات',role:'مشغّلة',transfers:0,volume:'$0',avgTime:'—',status:'offline'},{name:'عمر المدقق',role:'مدقق',transfers:0,volume:'$0',avgTime:'—',status:'offline'}];
function svBadge(s){const m={pending:['pending','معلقة'],done:['done','مكتملة'],completed:['done','مكتملة'],failed:['failed','فاشلة'],cancelled:['failed','ملغاة'],bot:['bot','بوت'],online:['online','نشط'],offline:['offline','غير نشط']};const[c,l]=m[s]||['pending','—'];return '<span class="sv-badge '+c+'"><span class="sv-badge-dot"></span>'+l+'</span>';}
let svCF='all',svCS='';
function svRenderTransfers(){
  const tb = document.getElementById('sv-transfers-body');
  if(!tb) return;
  if(!svTransfers.length){
    tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:36px;color:#475569;"><i class="fa-solid fa-inbox" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3;"></i>لا توجد حوالات — ستظهر هنا تلقائياً عند إرسالها من صفحة الحوالات</td></tr>';
    return;
  }
  let d = svTransfers.slice();
  if(svCF !== 'all') d = d.filter(t => t.status === svCF);
  if(svCS){
    const q = svCS.toLowerCase();
    d = d.filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.sender.toLowerCase().includes(q) ||
      t.receiver.toLowerCase().includes(q)
    );
  }
  const countEl = document.getElementById('sv-table-count');
  if(countEl) countEl.textContent = 'عرض ' + d.length + ' من ' + svTransfers.length + ' حوالة';
  tb.innerHTML = d.map(t => {
    return '<tr>' +
      '<td><span style="font-size:11px;font-weight:800;color:#32b8c6;font-family:monospace;">' + t.id + '</span></td>' +
      '<td><div style="font-size:12px;font-weight:600;color:#e2e8f0;">' + t.sender + '</div>' +
          '<div style="font-size:10px;color:#475569;">' + (t.source||'') + '</div></td>' +
      '<td style="font-size:12px;color:#cbd5e1;">' + t.receiver + '</td>' +
      '<td><span style="font-weight:800;color:#fcd34d;">' + t.amount.toLocaleString() + '</span></td>' +
      '<td><span style="font-size:10px;font-weight:700;background:rgba(59,130,246,0.1);color:#60a5fa;padding:2px 8px;border-radius:6px;border:1px solid rgba(59,130,246,0.2);">' + t.currency + '</span></td>' +
      '<td>' + svBadge(t.status) + '</td>' +
      '<td style="font-size:11px;color:#94a3b8;">' + t.agent + '</td>' +
      '<td style="font-size:11px;color:#475569;">' + t.date + '</td>' +
      '<td><div class="sv-action-btns">' +
        '<button class="sv-btn sv-btn-view"    data-id="' + t.id + '" onclick="svView(this.dataset.id)"><i class="fa-solid fa-eye"></i></button>' +
        '<button class="sv-btn sv-btn-edit"    data-id="' + t.id + '" onclick="openEditTransfer(this.dataset.id)"><i class="fa-solid fa-pen"></i></button>' +
        '<button class="sv-btn sv-btn-details" data-id="' + t.id + '" onclick="svView(this.dataset.id)"><i class="fa-solid fa-circle-info"></i></button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

function svFilter(f,b){svCF=f;document.querySelectorAll('.sv-filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');svRenderTransfers();}
function svSearch(q){svCS=q;svRenderTransfers();}
function svRenderTellers(){
  const tb=document.getElementById('sv-tellers-body');
  if(!tb) return;
  let emps=[];
  try { emps = (window._intlCache && window._intlCache.employees) || []; } catch(_){}
  if(!emps.length){
    tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:24px;color:#475569;font-size:11px;">لا يوجد موظفون — أضف من قسم إدارة الموظفين</td></tr>';
    return;
  }
  const cols=['#60a5fa','#34d399','#a78bfa','#fcd34d','#f87171'];
  tb.innerHTML=emps.map((emp,i)=>{
    const col=cols[i%cols.length];
    const t=emp.transfersToday||0;
    const p=Math.min(Math.round(t/20*100),100);
    return '<tr><td><div style="display:flex;align-items:center;gap:8px;"><div class="teller-avatar" style="background:linear-gradient(135deg,'+col+'33,'+col+'22);color:'+col+';">👤</div><div><div class="teller-name">'+emp.name+'</div><div class="teller-sub">موظف حوالات</div></div></div></td>'+
      '<td><div style="display:flex;align-items:center;gap:8px;"><div class="mini-prog"><div class="mini-prog-fill" style="width:'+p+'%;background:'+col+';"></div></div><span style="font-weight:700;color:'+col+';">'+t+'</span></div></td>'+
      '<td style="font-size:11px;color:#94a3b8;">'+emp.lastSeen+'</td>'+
      '<td>'+svBadge(emp.status)+'</td>'+
      '<td><div class="sv-action-btns"><button class="sv-btn sv-btn-view" onclick="svToast(\''+emp.name+'\',\'info\')"><i class="fa-solid fa-user"></i></button></div></td></tr>';
  }).join('');
}
function svView(id){const t=svTransfers.find(x=>x.id===id);if(!t)return;const rows=[['رقم الحوالة','<span style="font-family:monospace;color:#32b8c6;">'+t.id+'</span>'],['المرسل',t.sender],['المستلم',t.receiver],['المبلغ','<span style="color:#fcd34d;font-weight:800;">'+t.amount.toLocaleString()+' '+t.currency+'</span>'],['الحالة',svBadge(t.status)],['المنفذ',t.agent],['مصدر الحوالة',t.source],['التاريخ',t.date]];document.getElementById('sv-modal-body').innerHTML=rows.map(([k,v])=>'<div class="sv-modal-row"><span class="sv-modal-key">'+k+'</span><span class="sv-modal-val">'+v+'</span></div>').join('');document.getElementById('sv-modal').classList.add('open');}
function closeSvModal(){document.getElementById('sv-modal').classList.remove('open');}

function svNav(el, section) {
  document.querySelectorAll('.sv-nav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  const botSection       = document.getElementById('sv-bot-section');
  const dashContent      = document.getElementById('sv-dash-content');
  const transfersSection = document.getElementById('sv-transfers-section');
  const employeesSection = document.getElementById('sv-employees-section');
  // hide all sections
  if (botSection)       botSection.style.display = 'none';
  if (dashContent)      dashContent.style.display = 'none';
  if (transfersSection) transfersSection.classList.remove('active');
  if (employeesSection) employeesSection.classList.remove('active');
  const clientsSection2 = document.getElementById('sv-clients-section');
  const agentsSection2  = document.getElementById('sv-agents-section');
  if (clientsSection2) clientsSection2.classList.remove('active');
  if (agentsSection2)  agentsSection2.classList.remove('active');
  const adminMsgsSection = document.getElementById('sv-admin-msgs-section');
  if (adminMsgsSection) adminMsgsSection.classList.remove('active');
  // show target
  if (section === 'bot') {
    if (botSection) botSection.style.display = 'block';
  } else if (section === 'transfers') {
    if (transfersSection) { transfersSection.classList.add('active'); mgmtRender(); }
  } else if (section === 'employees') {
    if (employeesSection) { employeesSection.classList.add('active'); empRender(); }
  } else if (section === 'clients') {
    const clientsSection = document.getElementById('sv-clients-section');
    if (clientsSection) { clientsSection.classList.add('active'); cltRender(); }
  } else if (section === 'agents') {
    const agentsSection = document.getElementById('sv-agents-section');
    if (agentsSection) { agentsSection.classList.add('active'); agtRender(); }
  } else if (section === 'admin-msgs') {
    if (adminMsgsSection) { adminMsgsSection.classList.add('active'); svTrRenderInstructions(); }
  } else {
    if (dashContent) { dashContent.style.display = 'contents'; svRenderTransfers(); svRenderTellers(); }
  }
}
function openRatesModal() {
  const modal = document.getElementById('sv-rates-modal');
  if (modal) { modal.style.display = 'block'; document.body.style.overflow = 'hidden'; }
  // تحميل أسعار الصرف
  fetch('/api/sv2/rates?type=hawala')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.rates) {
        const map = { JOD: 'sv-rate-jod', VOD: 'sv-rate-vod', EGP: 'sv-rate-egp', TND: 'sv-rate-tnd', AED: 'sv-rate-aed', EUR: 'sv-rate-eur' };
        Object.entries(map).forEach(([k, id]) => {
          if (data.rates[k] != null) { const el = document.getElementById(id); if (el) el.value = data.rates[k]; }
        });
      }
    })
    .catch(() => {});
  // تحميل عمولات الدول
  svLoadFees();
}

function svLoadFees() {
  const list = document.getElementById('sv-fee-list');
  if (!list) return;
  list.innerHTML = '<div style="color:#475569;font-size:12px;padding:20px;text-align:center;grid-column:1/-1;">جاري التحميل...</div>';
  fetch('/api/ts/portal-pricing')
    .then(r => r.json())
    .then(data => {
      if (!data.success || !data.countries.length) {
        list.innerHTML = '<div style="color:#475569;font-size:12px;padding:20px;text-align:center;grid-column:1/-1;">لا توجد دول مضافة في البوابة بعد</div>';
        return;
      }
      list.innerHTML = data.countries.map(c => `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.15);border-radius:12px;padding:14px 14px 12px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">${c.flag}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;color:#e2e8f0;font-family:Tajawal,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
            <div style="font-size:10px;color:#64748b;margin-top:1px;">${c.currency} · ${c.isActive ? '<span style="color:#34d399;">نشطة</span>' : '<span style="color:#ef4444;">مخفية</span>'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <input type="number" data-slug="${c.slug}" value="${c.feePct}" min="0" max="100" step="0.1"
              style="width:52px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);border-radius:7px;color:#d4af37;font-size:13px;font-weight:700;padding:4px 6px;text-align:center;font-family:inherit;"
              oninput="this.style.borderColor='rgba(212,175,55,0.6)'">
            <span style="font-size:11px;color:#64748b;">%</span>
          </div>
        </div>
      `).join('');
    })
    .catch(() => {
      list.innerHTML = '<div style="color:#ef4444;font-size:12px;padding:20px;text-align:center;grid-column:1/-1;">تعذر تحميل البيانات</div>';
    });
}

async function svSaveFees() {
  const inputs = document.querySelectorAll('#sv-fee-list input[data-slug]');
  if (!inputs.length) return;
  const items = Array.from(inputs).map(inp => ({ slug: inp.dataset.slug, feePct: parseFloat(inp.value) || 0 }));
  const csrf = (document.cookie.split(';').find(c => c.trim().startsWith('csrftoken=')) || '').split('=')[1] || '';
  try {
    const res  = await fetch('/api/ts/portal-pricing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify(items),
    });
    const data = await res.json();
    const st = document.getElementById('sv-fee-status');
    if (data.success) {
      inputs.forEach(inp => inp.style.borderColor = 'rgba(52,211,153,0.5)');
      if (st) { st.textContent = 'تم حفظ عمولات البوابة'; st.style.display = 'block'; setTimeout(() => st.style.display = 'none', 4000); }
      svToast('تم حفظ العمولات بنجاح', 'success');
    } else {
      svToast('فشل الحفظ', 'error');
    }
  } catch {
    svToast('تعذر الاتصال بالخادم', 'error');
  }
}

function closeRatesModal() {
  const modal = document.getElementById('sv-rates-modal');
  if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

function svRateHighlight(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.add('sv-rate-highlight');
  setTimeout(() => card.classList.remove('sv-rate-highlight'), 2000);
}

function svResetRates() {
  const defaults = { jod: 0.709, vod: 48.00, egp: 48.50, tnd: 3.10, aed: 3.672, eur: 0.92 };
  Object.entries(defaults).forEach(([k, v]) => {
    const inp = document.getElementById('sv-rate-' + k);
    if (inp) inp.value = v;
  });
  svToast('تم إعادة تعيين الأسعار للقيم الافتراضية', 'info');
}

async function svSaveRates() {
  const g = id => parseFloat(document.getElementById(id)?.value) || 0;
  const rates = {
    JOD: g('sv-rate-jod'),
    VOD: g('sv-rate-vod'),
    EGP: g('sv-rate-egp'),
    TND: g('sv-rate-tnd'),
    AED: g('sv-rate-aed'),
    EUR: g('sv-rate-eur'),
  };
  const csrf = (document.cookie.split(';').find(c => c.trim().startsWith('csrftoken=')) || '').split('=')[1] || '';
  try {
    const res = await fetch('/api/sv2/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify({ rates, rate_type: 'hawala' }),
    });
    const data = await res.json();
    const st = document.getElementById('sv-rates-status');
    const lu = document.getElementById('sv-rates-last-updated');
    if (data.success) {
      if (st) { st.textContent = 'تم نشر الأسعار على النظام — ' + new Date().toLocaleTimeString('ar'); st.style.display = 'block'; setTimeout(() => st.style.display = 'none', 5000); }
      if (lu) lu.textContent = 'Last updated: ' + new Date().toLocaleString('ar');
      svToast('تم نشر الأسعار بنجاح', 'success');
      setTimeout(closeRatesModal, 1200);
    } else {
      svToast(data.message || 'فشل الحفظ', 'error');
    }
  } catch (e) {
    svToast('تعذر الاتصال بالخادم', 'error');
  }
}

function svToast(msg,type='info'){const wrap=document.getElementById('sv-toast-wrap');const t=document.createElement('div');t.className='sv-toast '+type;t.innerHTML='<span>'+(type==='success'?'✅':type==='warn'?'⚠️':'ℹ️')+'</span><span>'+msg+'</span>';wrap.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity 0.3s';setTimeout(()=>t.remove(),300);},2800);}
function svLogout(){if(confirm('تأكيد تسجيل الخروج؟'))location.href='/logout/';}
function logout(){location.href='/logout/';}

// ========== THEME (داكن / فاتح) ==========
const _SUN_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const _MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
function toggleTheme() { /* dark mode only — light mode disabled */ }
function toggleSvTheme() {
  toggleTheme();
}
// Restore dark mode on load


// ========== MIGRATION (ترحيل السجل) ==========
let _svMigFormat = 'json';

function svOpenMigrationModal() {
  const history = JSON.parse(localStorage.getItem('transferHistory') || '[]');
  if (history.length === 0) { svToast('السجل فارغ — لا توجد حوالات للترحيل', 'warn'); return; }
  _svMigFormat = 'json';
  _svRefreshMigFormatUI();
  const total = history.length;
  const byAgent = {}, byCurr = {};
  history.forEach(h => {
    byAgent[h.agent] = (byAgent[h.agent] || 0) + 1;
    byCurr[h.currency] = (byCurr[h.currency] || 0) + (parseFloat(h.amount) || 0);
  });
  const topAgent = Object.entries(byAgent).sort((a,b) => b[1]-a[1])[0];
  const summaryEl = document.getElementById('sv-migSummary');
  if (summaryEl) {
    const card = (icon, label, val, color) => `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(50,184,198,0.13);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:20px;margin-bottom:4px;">${icon}</div><div style="font-size:18px;font-weight:800;color:${color};">${val}</div><div style="font-size:10px;color:#4d6080;margin-top:2px;">${label}</div></div>`;
    const amtSummary = Object.entries(byCurr).map(([c,a]) => `${Math.round(a).toLocaleString()} ${c}`).join(' / ');
    summaryEl.innerHTML = card('📋','إجمالي الحوالات',total,'#e8c04a') + card('💰','المبالغ',amtSummary||'--','#25D366') + card('🔵','أكثر وكيل',topAgent?topAgent[0]:'--','#60a5fa');
  }
  const dateRangeEl = document.getElementById('sv-migDateRange');
  if (dateRangeEl) {
    const dates = history.map(h => h.completedAt).filter(Boolean).sort();
    const fmt = ts => ts ? new Date(ts).toLocaleString('ar-IQ') : '--';
    dateRangeEl.innerHTML = dates.length ? `<span style="color:#e9edef;font-weight:600;">نطاق الترحيل:</span> من ${fmt(dates[0])} &nbsp;→&nbsp; ${fmt(dates[dates.length-1])}` : 'لا تتوفر معلومات التاريخ';
  }
  const cb = document.getElementById('sv-migClearAfter');
  if (cb) { cb.checked = false; _svSyncMigToggle(false); cb.onchange = () => _svSyncMigToggle(cb.checked); }
  const ov = document.getElementById('sv-migrationOverlay');
  if (ov) ov.style.display = 'flex';
}

function svCloseMigrationModal() {
  const ov = document.getElementById('sv-migrationOverlay');
  if (ov) ov.style.display = 'none';
}

function svSelectMigFormat(fmt) { _svMigFormat = fmt; _svRefreshMigFormatUI(); }

function _svRefreshMigFormatUI() {
  document.querySelectorAll('.sv-mig-fmt-btn').forEach(btn => {
    const active = btn.dataset.val === _svMigFormat;
    btn.style.borderColor = active ? 'rgba(232,192,74,0.5)' : 'rgba(255,255,255,0.08)';
    btn.style.background  = active ? 'rgba(232,192,74,0.1)' : 'rgba(255,255,255,0.03)';
    btn.querySelector('div:nth-child(2)').style.color = active ? '#e8c04a' : '#8696a0';
  });
}

function _svSyncMigToggle(on) {
  const track = document.getElementById('sv-migToggleTrack');
  const thumb = document.getElementById('sv-migToggleThumb');
  if (track) track.style.background = on ? 'rgba(232,192,74,0.35)' : 'rgba(255,255,255,0.08)';
  if (thumb) { thumb.style.background = on ? '#e8c04a' : '#4d6080'; thumb.style.right = on ? 'calc(100% - 19px)' : '3px'; }
}

function svExecuteMigration() {
  const history = JSON.parse(localStorage.getItem('transferHistory') || '[]');
  if (history.length === 0) { svCloseMigrationModal(); return; }
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  const count = history.length;
  const payload = {
    exportedAt: now.toISOString(), exportedBy: 'International Transfers System — Supervisor',
    totalRecords: count,
    records: history.map(h => ({ id:h.id, code:h.code, name:h.name, amount:h.amount, currency:h.currency, source:h.source, agent:h.agent, time:h.time, completedAt:h.completedAt?new Date(h.completedAt).toISOString():null, status:'completed' }))
  };
  let blob, filename;
  if (_svMigFormat === 'json') {
    blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json;charset=utf-8'});
    filename = `ترحيل_حوالات_${stamp}.json`;
  } else if (_svMigFormat === 'csv') {
    const hdr = ['id','code','name','amount','currency','source','agent','time','completedAt'];
    const rows = payload.records.map(r => hdr.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(','));
    blob = new Blob(['\uFEFF'+[hdr.join(','),...rows].join('\n')], {type:'text/csv;charset=utf-8'});
    filename = `ترحيل_حوالات_${stamp}.csv`;
  } else {
    const lines = payload.records.map((r,i) => `[${i+1}] ${r.time} | ${r.name} | ${r.amount} ${r.currency} | ${r.source} ← ${r.agent} | كود: ${r.code}`);
    const hdr2 = `=== ترحيل سجل الحوالات ===\nالتاريخ: ${now.toLocaleString('ar-IQ')}\nالإجمالي: ${count} حوالة\n${'─'.repeat(60)}\n`;
    blob = new Blob([hdr2+lines.join('\n')], {type:'text/plain;charset=utf-8'});
    filename = `ترحيل_حوالات_${stamp}.txt`;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  const clearAfter = document.getElementById('sv-migClearAfter')?.checked;
  svCloseMigrationModal();
  if (clearAfter) {
    localStorage.removeItem('transferHistory');
    svToast(`تم ترحيل ${count} حوالة وتفريغ السجل`, 'success');
    _svLoadLiveData();
  } else {
    svToast(`تم ترحيل ${count} حوالة — السجل محفوظ`, 'success');
  }
}
function svClock(){const now=new Date();const ts=now.toLocaleTimeString('ar-EG-u-nu-latn',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});const ds=now.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long',year:'numeric',month:'long',day:'numeric'});const _ck=document.getElementById('sv-clock');const _dt=document.getElementById('sv-date');if(_ck)_ck.textContent=ts;if(_dt)_dt.textContent=ds;const badge=document.getElementById('sv-date-badge');if(badge)badge.textContent=now.toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
setInterval(svClock,1000);svClock();
function animCount(id,target){const el=document.getElementById(id);if(!el)return;let c=0;const s=Math.max(1,Math.round(target/40));const t=setInterval(()=>{c=Math.min(c+s,target);el.textContent=c.toLocaleString();if(c>=target)clearInterval(t);},30);}


/* ══════════════════════════════════════════════════
   LIVE STATS — بيانات حية من صفحة الحوالات
   Reads transferHistory & execTransfers from localStorage
══════════════════════════════════════════════════ */
function _svLoadLiveData() {
  try {
    const history   = JSON.parse(localStorage.getItem('transferHistory')  || '[]');
    const execs     = JSON.parse(localStorage.getItem('execTransfers')    || '[]');
    const employees = (window._intlCache && window._intlCache.employees) || [];
    const agents    = _agents.length ? _agents : [];
    const settings  = JSON.parse(localStorage.getItem('intl_botSettings') || 'null');

    // Rebuild svTransfers from history (completed transfers)
    svTransfers.length = 0;
    history.forEach(h => {
      svTransfers.push({
        id:       h.id || h.code || 'TRF-???',
        sender:   h.source || h.group || '—',
        receiver: h.name   || '—',
        amount:   parseFloat(h.amount) || 0,
        currency: h.currency || 'USD',
        status:   'completed',
        agent:    h.agent  || '—',
        date:     h.time   || '—',
        source:   h.group  || h.source || '—'
      });
    });

    // Compute real stats
    const execActive    = execs.filter(e => ['waiting','executed','reassigned'].includes(e.status));
    const execCancelled = execs.filter(e => e.status === 'cancelled').length;
    const total         = history.length + execActive.length;
    const empActive     = employees.filter(e => e.status === 'online').length;
    const agtActive     = agents.filter(a => a.status === 'active').length;

    const setCard = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = String(v); };
    setCard('card-total',     total);
    setCard('card-exec',      execActive.length);
    setCard('card-done',      history.length);
    setCard('card-cancelled', execCancelled);
    setCard('card-employees', empActive);
    setCard('card-agents',    agtActive);

    // Render agent load panel
    const agentsPanel = document.getElementById('dash-agents-panel');
    if (agentsPanel) {
      if (!agents.length) {
        agentsPanel.innerHTML = '<div style="text-align:center;color:#475569;padding:20px;font-size:11px;">لا يوجد وكلاء — أضف من قسم وكلاء التنفيذ</div>';
      } else {
        agentsPanel.innerHTML = agents.map(a => {
          const activeCount = execs.filter(e => e.agent === a.key && ['waiting','executed','reassigned'].includes(e.status)).length;
          const cap   = a.capacity || 10;
          const pct   = Math.min(Math.round(activeCount / cap * 100), 100);
          const loadClr = pct > 80 ? '#f87171' : pct > 50 ? '#fcd34d' : '#34d399';
          const stMap = { active:'#22c55e', busy:'#fcd34d', offline:'#64748b', suspended:'#ef4444' };
          const stColor = stMap[a.status] || '#64748b';
          return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.04);">' +
            '<div style="width:32px;height:32px;border-radius:50%;background:' + a.color + '22;display:flex;align-items:center;justify-content:center;font-size:14px;">' + (a.icon || '⚡') + '</div>' +
            '<div style="flex:1;">' +
              '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
                '<span style="font-size:11px;font-weight:700;color:#e2e8f0;">' + a.name + '</span>' +
                '<span style="font-size:10px;font-weight:700;color:' + loadClr + ';">' + activeCount + '/' + cap + '</span>' +
              '</div>' +
              '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">' +
                '<div style="height:100%;width:' + pct + '%;background:' + loadClr + ';border-radius:2px;transition:width 0.5s;"></div>' +
              '</div>' +
            '</div>' +
            '<span style="width:8px;height:8px;border-radius:50%;background:' + stColor + ';flex-shrink:0;"></span>' +
          '</div>';
        }).join('');
      }
    }

    // Render recent history panel (last 5)
    const histPanel = document.getElementById('dash-history-panel');
    if (histPanel) {
      if (!history.length) {
        histPanel.innerHTML = '<div style="text-align:center;color:#475569;padding:20px;font-size:11px;">لا توجد حوالات منفذة بعد</div>';
      } else {
        histPanel.innerHTML = history.slice(0, 5).map(h => {
          return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.04);">' +
            '<div style="width:28px;height:28px;border-radius:50%;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;color:#34d399;font-weight:700;">✓</div>' +
            '<div style="flex:1;">' +
              '<div style="font-size:11px;font-weight:700;color:#e2e8f0;">' + (h.name || '—') + '</div>' +
              '<div style="font-size:10px;color:#64748b;">' + (h.agent || '—') + ' · ' + (h.source || h.group || '—') + '</div>' +
            '</div>' +
            '<div style="text-align:left;">' +
              '<div style="font-size:11px;font-weight:700;color:#fcd34d;">' + Number(h.amount || 0).toLocaleString() + ' ' + (h.currency || '') + '</div>' +
              '<div style="font-size:9px;color:#475569;">' + (h.time || '—') + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    // Compute real perf stats
    if (total > 0) {
      const donePct = Math.round(history.length / total * 100);
      const execPct = Math.round(execActive.length / total * 100);
      const cancPct = Math.round(execCancelled / total * 100);
      [['perf-done', donePct], ['perf-pend', execPct], ['perf-fail', cancPct]].forEach(([id, pct]) => {
        const el = document.getElementById(id);
        if (el) setTimeout(() => { el.style.width = pct + '%'; }, 300);
      });
      const setText = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
      setText('perf-done-txt', donePct + '%');
      setText('perf-pend-txt', execPct + '%');
      setText('perf-fail-txt', cancPct + '%');
      if (history.length > 0) {
        const avg = Math.round(history.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0) / history.length);
        setText('perf-avg-amount', '$' + avg.toLocaleString());
      }
    }

    // Bot status indicator
    if (settings) {
      const dotEl = document.getElementById('bc-status-dot');
      const lblEl = document.getElementById('bc-status-label');
      if (dotEl) dotEl.style.background = settings.master ? '#22c55e' : '#ef4444';
      if (lblEl) lblEl.textContent = settings.master
        ? 'نظام الذكاء الاصطناعي نشط • يراقب جميع المجموعات'
        : 'البوت متوقف — تم إيقافه من المشرف';
    }

    if (typeof svRenderTransfers === 'function') svRenderTransfers();

  } catch(e) { console.warn('_svLoadLiveData error:', e); }
}

/* Sync when transactions page updates localStorage */
window.addEventListener('storage', function(e) {
  if (['transferHistory','execTransfers','intl_botSettings'].includes(e.key)) {
    _svLoadLiveData();
  }
});

document.addEventListener('DOMContentLoaded',()=>{
  // Attach modal close on overlay click
  const svModal = document.getElementById('sv-modal');
  if(svModal) svModal.addEventListener('click', function(e){ if(e.target===this) closeSvModal(); });
  // Sync supervisor name to center header
  const savedName = localStorage.getItem('supervisorName');
  if(savedName){
    const el = document.getElementById('sv-center-name');
    if(el) el.textContent = savedName;
  }
  // Restore theme button text
  const themeBtn = document.getElementById('sv-theme-btn');
  if (themeBtn) themeBtn.innerHTML = document.documentElement.getAttribute('data-theme') === 'dark' ? _MOON_SVG : _SUN_SVG;
  _svLoadLiveData();
  svRenderTransfers(); svRenderTellers();
  // جلب البيانات الحقيقية من الخادم (تحل محل localStorage تدريجياً)
  if (typeof initTransactionsSupervisor === 'function') initTransactionsSupervisor();
});

/* ════════════════════════════════════════════════
   TRANSFERS MANAGEMENT — إدارة الحوالات
════════════════════════════════════════════════ */
let _mgmtFilter = 'all';
let _mgmtQuery  = '';
let _mgmtPage   = 1;
const _mgmtPerPage = 12;
let _mgmtCancelId  = null;

function mgmtFilter(f, btn) {
  _mgmtFilter = f;
  _mgmtPage   = 1;
  document.querySelectorAll('.sv-mgmt-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  mgmtRender();
}

function mgmtSearch(q) {
  _mgmtQuery = q.toLowerCase().trim();
  _mgmtPage  = 1;
  mgmtRender();
}

function mgmtRender() {
  // pull data from svTransfers (shared mock data)
  const all = (typeof svTransfers !== 'undefined') ? svTransfers : [];

  // filter by status
  let filtered = all.filter(t => {
    if (_mgmtFilter === 'all') return true;
    if (_mgmtFilter === 'completed') return t.status === 'done' || t.status === 'completed';
    if (_mgmtFilter === 'cancelled') return t.status === 'cancelled';
    if (_mgmtFilter === 'failed')    return t.status === 'failed';
    if (_mgmtFilter === 'pending')   return t.status === 'pending';
    return true;
  });

  // filter by search query
  if (_mgmtQuery) {
    filtered = filtered.filter(t =>
      t.id.toLowerCase().includes(_mgmtQuery) ||
      t.sender.toLowerCase().includes(_mgmtQuery) ||
      t.receiver.toLowerCase().includes(_mgmtQuery) ||
      String(t.amount).includes(_mgmtQuery)
    );
  }

  // update mini counters
  const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('mgmt-total',     all.length);
  setEl('mgmt-pending',   all.filter(t => t.status === 'pending').length);
  setEl('mgmt-done',      all.filter(t => t.status === 'completed' || t.status === 'done').length);
  setEl('mgmt-cancelled', all.filter(t => t.status === 'cancelled').length);

  // pagination
  const total  = filtered.length;
  const pages  = Math.max(1, Math.ceil(total / _mgmtPerPage));
  _mgmtPage    = Math.min(_mgmtPage, pages);
  const start  = (_mgmtPage - 1) * _mgmtPerPage;
  const slice  = filtered.slice(start, start + _mgmtPerPage);

  setEl('mgmt-count',    'عرض ' + slice.length + ' من ' + total + ' حوالة');
  setEl('mgmt-page-lbl', 'صفحة ' + _mgmtPage + ' من ' + pages);

  const prev = document.getElementById('mgmt-prev');
  const next = document.getElementById('mgmt-next');
  if (prev) prev.disabled = _mgmtPage <= 1;
  if (next) next.disabled = _mgmtPage >= pages;

  const tbody = document.getElementById('mgmt-tbody');
  if (!tbody) return;

  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:28px;color:#475569;">لا توجد حوالات مطابقة</td></tr>';
    return;
  }

  tbody.innerHTML = slice.map(t => {
    const canEdit   = t.status === 'pending';
    const canCancel = t.status === 'pending' || t.status === 'failed';
    const editBtn   = canEdit   ? '<button class="sv-action-edit"   data-id="' + t.id + '" onclick="openEditTransfer(this.dataset.id)">تعديل</button>' : '';
    const cancelBtn = canCancel ? '<button class="sv-action-cancel" data-id="' + t.id + '" onclick="openCancelConfirm(this.dataset.id)">إلغاء</button>' : '';
    return '<tr>' +
      '<td><span style="font-family:monospace;font-size:11px;color:#32b8c6;">' + t.id + '</span></td>' +
      '<td style="font-size:12px;">' + t.sender + '</td>' +
      '<td style="font-size:12px;color:#cbd5e1;">' + t.receiver + '</td>' +
      '<td><span style="color:#fcd34d;font-weight:800;">' + t.amount.toLocaleString() + '</span></td>' +
      '<td><span style="font-size:10px;font-weight:700;background:rgba(59,130,246,0.1);color:#60a5fa;padding:2px 8px;border-radius:6px;border:1px solid rgba(59,130,246,0.2);">' + t.currency + '</span></td>' +
      '<td>' + svBadge(t.status) + '</td>' +
      '<td style="font-size:11px;color:#94a3b8;">' + (t.agent || '—') + '</td>' +
      '<td style="font-size:10px;color:#64748b;">' + (t.source || '—') + '</td>' +
      '<td style="font-size:10px;color:#64748b;">' + t.date + '</td>' +
      '<td><div class="sv-mgmt-actions-col">' +
        '<button class="sv-action-view" data-id="' + t.id + '" onclick="svView(this.dataset.id)">عرض</button>' +
        editBtn + cancelBtn +
      '</div></td>' +
    '</tr>';
  }).join('');
}

function mgmtPrev() { if (_mgmtPage > 1) { _mgmtPage--; mgmtRender(); } }
function mgmtNext() { _mgmtPage++; mgmtRender(); }

/* ── Send new transfer ── */
function openSendTransfer() {
  document.getElementById('sv-edit-id').value = '';
  document.getElementById('sv-send-title').innerHTML = '<i class="fa-solid fa-paper-plane" style="color:#32b8c6;margin-left:6px;"></i>إرسال حوالة جديدة';
  document.getElementById('sv-submit-lbl').textContent = 'إرسال الحوالة';
  ['sv-f-sender','sv-f-receiver','sv-f-amount','sv-f-notes'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('sv-f-currency').value = 'USD';
  document.getElementById('sv-f-agent').value    = '';
  document.getElementById('sv-f-priority').value = 'عادية';
  document.getElementById('sv-f-source').value   = 'إدخال مشرف';
  document.getElementById('sv-f-status').value   = 'pending';
  document.getElementById('sv-send-overlay').classList.add('open');
}

/* ── Edit existing transfer ── */
function openEditTransfer(id) {
  const t = (typeof svTransfers !== 'undefined') ? svTransfers.find(x => x.id === id) : null;
  if (!t) return;
  document.getElementById('sv-edit-id').value = id;
  document.getElementById('sv-send-title').innerHTML = '<i class="fa-solid fa-pen" style="color:#818cf8;margin-left:6px;"></i>تعديل الحوالة — ' + id;
  document.getElementById('sv-submit-lbl').textContent = 'حفظ التعديلات';
  document.getElementById('sv-f-sender').value   = t.sender;
  document.getElementById('sv-f-receiver').value = t.receiver;
  document.getElementById('sv-f-amount').value   = t.amount;
  document.getElementById('sv-f-currency').value = t.currency;
  document.getElementById('sv-f-agent').value    = t.agent || '';
  document.getElementById('sv-f-priority').value = t.priority || 'عادية';
  document.getElementById('sv-f-source').value   = t.source || 'إدخال مشرف';
  const sMap = { pending:'pending', completed:'completed', failed:'failed', cancelled:'pending' };
  document.getElementById('sv-f-status').value = sMap[t.status] || 'pending';
  document.getElementById('sv-f-notes').value   = t.notes || '';
  document.getElementById('sv-send-overlay').classList.add('open');
}

function closeSendTransfer() {
  document.getElementById('sv-send-overlay').classList.remove('open');
}

function submitTransfer() {
  const editId   = document.getElementById('sv-edit-id').value;
  const sender   = document.getElementById('sv-f-sender').value.trim();
  const receiver = document.getElementById('sv-f-receiver').value.trim();
  const amount   = parseFloat(document.getElementById('sv-f-amount').value);
  const currency = document.getElementById('sv-f-currency').value;
  const agent    = document.getElementById('sv-f-agent').value;
  const priority = document.getElementById('sv-f-priority').value;
  const source   = document.getElementById('sv-f-source').value;
  const status   = document.getElementById('sv-f-status').value;
  const notes    = document.getElementById('sv-f-notes').value.trim();

  if (!sender || !receiver || !amount || amount <= 0) {
    svToast('يرجى ملء جميع الحقول المطلوبة (المرسل، المستلم، المبلغ)', 'warn');
    return;
  }

  if (typeof svTransfers === 'undefined') { svToast('خطأ في البيانات', 'warn'); return; }

  if (editId) {
    // edit existing
    const idx = svTransfers.findIndex(t => t.id === editId);
    if (idx !== -1) {
      svTransfers[idx] = Object.assign(svTransfers[idx], { sender, receiver, amount, currency, agent, priority, source, status, notes });
      svToast('تم تعديل الحوالة ' + editId + ' بنجاح', 'success');
    }
  } else {
    // create new
    const newId = 'TRF-' + String(Date.now()).slice(-6);
    const now   = new Date();
    const dateStr = now.toLocaleDateString('ar-EG') + ' ' + now.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
    svTransfers.unshift({ id: newId, sender, receiver, amount, currency, agent, priority, source, status, notes, date: dateStr });
    svToast('تم إرسال الحوالة ' + newId + ' بنجاح', 'success');
  }

  closeSendTransfer();
  mgmtRender();
  // also refresh dashboard table if visible
  if (typeof svRenderTransfers === 'function') svRenderTransfers();
}

/* ── Cancel transfer ── */
function openCancelConfirm(id) {
  _mgmtCancelId = id;
  const t = (typeof svTransfers !== 'undefined') ? svTransfers.find(x => x.id === id) : null;
  const sub = t ? 'إلغاء الحوالة <strong style="color:#f87171;">' + id + '</strong><br>' + t.sender + ' ← ' + t.receiver + ' — ' + t.amount + ' ' + t.currency : 'هل أنت متأكد؟';
  document.getElementById('sv-cancel-sub').innerHTML = sub;
  document.getElementById('sv-cancel-overlay').classList.add('open');
}

function closeCancelConfirm() {
  _mgmtCancelId = null;
  document.getElementById('sv-cancel-overlay').classList.remove('open');
}

function confirmCancel() {
  if (!_mgmtCancelId) return;
  if (typeof svTransfers !== 'undefined') {
    const idx = svTransfers.findIndex(t => t.id === _mgmtCancelId);
    if (idx !== -1) svTransfers[idx].status = 'cancelled';
  }
  svToast('تم إلغاء الحوالة ' + _mgmtCancelId, 'warn');
  closeCancelConfirm();
  mgmtRender();
  if (typeof svRenderTransfers === 'function') svRenderTransfers();
}


/* ════════════════════════════════════════════════
   EMPLOYEE MANAGEMENT — إدارة الموظفين
════════════════════════════════════════════════ */

let _employees = [];

function _loadEmployees() {
  _employees = (window._intlCache && window._intlCache.employees && window._intlCache.employees.length)
    ? JSON.parse(JSON.stringify(window._intlCache.employees))
    : [];
}

function _saveEmployees() {
  window._intlCache = window._intlCache || {};
  window._intlCache.employees = JSON.parse(JSON.stringify(_employees));
}

/* ── Filter + search state ── */
let _empFilter = 'all';
let _empQuery  = '';
let _empViewId = null; // for permission view modal

function empFilter(f, btn) {
  _empFilter = f;
  document.querySelectorAll('.sv-emp-filter').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  empRender();
}

function empSearch(q) {
  _empQuery = q.toLowerCase().trim();
  empRender();
}

function empRender() {
  _loadEmployees();
  let list = _employees.slice();
  if (_empFilter !== 'all') list = list.filter(e => e.status === _empFilter);
  if (_empQuery) list = list.filter(e =>
    e.name.toLowerCase().includes(_empQuery) ||
    e.username.toLowerCase().includes(_empQuery) ||
    e.role.includes(_empQuery)
  );

  // Update stat cards
  const setEl = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  setEl('emp-total',     _employees.length);
  setEl('emp-online',    _employees.filter(e => e.status==='online').length);
  setEl('emp-suspended', _employees.filter(e => e.status==='suspended').length);
  setEl('emp-today-total', _employees.reduce((s,e) => s + (e.transfersToday||0), 0));
  setEl('emp-nav-badge', _employees.length);

  const tbody = document.getElementById('emp-tbody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:#475569;">لا يوجد موظفون مطابقون</td></tr>';
    return;
  }

  const colors = ['#60a5fa','#34d399','#a78bfa','#fcd34d','#f87171','#fb923c','#22d3ee','#e879f9'];
  const permNames = {
    send:'إرسال', viewAll:'عرض الكل', edit:'تعديل', cancel:'إلغاء',
    bot:'البوت', export:'تصدير', history:'السجل', multiCurrency:'متعدد العملات'
  };

  tbody.innerHTML = list.map((emp, idx) => {
    const col = colors[idx % colors.length];
    const initials = emp.name.split(' ').slice(0,2).map(w=>w[0]).join('');
    const statusDotClass = emp.status === 'online' ? 'online' : emp.status === 'suspended' ? 'suspended' : 'offline';
    const statusLabel    = emp.status === 'online' ? 'نشط' : emp.status === 'suspended' ? 'موقوف' : 'غير نشط';

    const permChips = Object.entries(emp.permissions || {}).map(([k,v]) =>
      '<span class="perm-chip' + (v ? '' : ' off') + '">' + (permNames[k]||k) + '</span>'
    ).join('');

    const suspendBtn = emp.status !== 'suspended'
      ? '<button class="emp-btn emp-btn-suspend" data-id="' + emp.id + '" onclick="empToggleSuspend(this.dataset.id)"><i class="fa-solid fa-ban"></i> إيقاف</button>'
      : '<button class="emp-btn emp-btn-activate" data-id="' + emp.id + '" onclick="empToggleSuspend(this.dataset.id)"><i class="fa-solid fa-check"></i> تفعيل</button>';

    return '<tr>' +
      '<td><div class="emp-name-cell">' +
        '<div class="emp-avatar" style="background:' + col + '22;color:' + col + ';">' + initials + '</div>' +
        '<div><div class="emp-name-lbl">' + emp.name + '</div><div class="emp-id-lbl">' + emp.id + '</div></div>' +
      '</div></td>' +
      '<td style="font-size:11px;color:#64748b;font-family:monospace;">' + emp.username + '</td>' +
      '<td style="font-size:12px;color:#94a3b8;">' + emp.role + '</td>' +
      '<td><span style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--text-primary);"><span class="emp-status-dot ' + statusDotClass + '"></span>' + statusLabel + '</span></td>' +
      '<td style="font-weight:700;color:#fcd34d;">' + (emp.transfersToday||0) + '</td>' +
      '<td><div class="perm-chips">' + permChips + '</div></td>' +
      '<td style="font-size:10px;color:#475569;">' + (emp.lastSeen||'—') + '</td>' +
      '<td><div class="emp-action-btns">' +
        '<button class="emp-btn emp-btn-edit" data-id="' + emp.id + '" onclick="openEditEmployee(this.dataset.id)"><i class="fa-solid fa-pen"></i> تعديل</button>' +
        '<button class="emp-btn emp-btn-perms" data-id="' + emp.id + '" onclick="openPermView(this.dataset.id)"><i class="fa-solid fa-shield-halved"></i> صلاحيات</button>' +
        suspendBtn +
      '</div></td>' +
    '</tr>';
  }).join('');
}

/* ── Add / Edit modal ── */
function openAddEmployee() {
  document.getElementById('sv-emp-id').value = '';
  document.getElementById('sv-emp-title').innerHTML = '<i class="fa-solid fa-user-plus" style="color:#34d399;margin-left:6px;"></i>إضافة موظف جديد';
  document.getElementById('sv-emp-submit-lbl').textContent = 'حفظ الموظف';
  ['sv-emp-name','sv-emp-username','sv-emp-pin'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  // default permissions
  document.getElementById('perm-send').checked         = true;
  document.getElementById('perm-view-all').checked     = false;
  document.getElementById('perm-edit').checked         = false;
  document.getElementById('perm-cancel').checked       = false;
  document.getElementById('perm-bot').checked          = true;
  document.getElementById('perm-export').checked       = false;
  document.getElementById('perm-history').checked      = true;
  document.getElementById('perm-multi-currency').checked = false;
  document.getElementById('sv-emp-overlay').classList.add('open');
}

function openEditEmployee(id) {
  _loadEmployees();
  const emp = _employees.find(e => e.id === id);
  if (!emp) return;
  document.getElementById('sv-emp-id').value = emp.id;
  document.getElementById('sv-emp-title').innerHTML = '<i class="fa-solid fa-pen" style="color:#a78bfa;margin-left:6px;"></i>تعديل الموظف — ' + emp.name;
  document.getElementById('sv-emp-submit-lbl').textContent = 'حفظ التعديلات';
  document.getElementById('sv-emp-name').value      = emp.name;
  document.getElementById('sv-emp-username').value  = emp.username;
  document.getElementById('sv-emp-pin').value       = emp.pin || '';
  const p = emp.permissions || {};
  document.getElementById('perm-send').checked         = !!p.send;
  document.getElementById('perm-view-all').checked     = !!p.viewAll;
  document.getElementById('perm-edit').checked         = !!p.edit;
  document.getElementById('perm-cancel').checked       = !!p.cancel;
  document.getElementById('perm-bot').checked          = !!p.bot;
  document.getElementById('perm-export').checked       = !!p.export;
  document.getElementById('perm-history').checked      = !!p.history;
  document.getElementById('perm-multi-currency').checked = !!p.multiCurrency;
  document.getElementById('sv-emp-overlay').classList.add('open');
}

function closeEmpModal() {
  document.getElementById('sv-emp-overlay').classList.remove('open');
}

function submitEmployee() {
  const editId  = document.getElementById('sv-emp-id').value;
  const name    = document.getElementById('sv-emp-name').value.trim();
  const username = document.getElementById('sv-emp-username').value.trim();
  const pin     = document.getElementById('sv-emp-pin').value.trim();
  const role    = 'موظف حوالات';

  if (!name || !username || !pin) {
    svToast('يرجى ملء جميع الحقول المطلوبة (الاسم، اسم المستخدم، PIN)', 'warn');
    return;
  }
  if (pin.length < 4) {
    svToast('رمز PIN يجب أن يكون 4 أرقام على الأقل', 'warn');
    return;
  }

  const permissions = {
    send:         document.getElementById('perm-send').checked,
    viewAll:      document.getElementById('perm-view-all').checked,
    edit:         document.getElementById('perm-edit').checked,
    cancel:       document.getElementById('perm-cancel').checked,
    bot:          document.getElementById('perm-bot').checked,
    export:       document.getElementById('perm-export').checked,
    history:      document.getElementById('perm-history').checked,
    multiCurrency:document.getElementById('perm-multi-currency').checked
  };

  _loadEmployees();

  if (editId) {
    const idx = _employees.findIndex(e => e.id === editId);
    if (idx !== -1) {
      _employees[idx] = Object.assign(_employees[idx], { name, username, pin, role, permissions });
      svToast('تم تعديل بيانات ' + name + ' بنجاح', 'success');
    }
  } else {
    // Check username uniqueness
    if (_employees.find(e => e.username === username)) {
      svToast('اسم المستخدم "' + username + '" مستخدم بالفعل', 'warn');
      return;
    }
    const newId = 'EMP-' + String(_employees.length + 1).padStart(3,'0');
    const now   = new Date();
    _employees.push({
      id: newId, name, username, pin, role, status:'offline',
      transfersToday:0, lastSeen: '—',
      permissions
    });
    svToast('تم إضافة الموظف ' + name + ' بنجاح', 'success');
  }

  _saveEmployees();
  closeEmpModal();
  empRender();
}

/* ── Suspend / Activate ── */
function empToggleSuspend(id) {
  _loadEmployees();
  const emp = _employees.find(e => e.id === id);
  if (!emp) return;
  if (emp.status === 'suspended') {
    emp.status = 'offline';
    svToast('تم تفعيل حساب ' + emp.name, 'success');
  } else {
    emp.status = 'suspended';
    svToast('تم إيقاف حساب ' + emp.name + ' مؤقتاً', 'warn');
  }
  _saveEmployees();
  empRender();
}

/* ── Permissions View ── */
function openPermView(id) {
  _loadEmployees();
  const emp = _employees.find(e => e.id === id);
  if (!emp) return;
  _empViewId = id;

  document.getElementById('sv-perm-emp-name').innerHTML =
    '<i class="fa-solid fa-shield-halved" style="color:#a78bfa;margin-left:6px;"></i>صلاحيات — ' + emp.name;

  const permDefs = [
    ['send',         'fa-paper-plane',       '#32b8c6', 'إرسال حوالات'],
    ['viewAll',      'fa-eye',               '#60a5fa', 'عرض جميع الحوالات'],
    ['edit',         'fa-pen',               '#a78bfa', 'تعديل الحوالات'],
    ['cancel',       'fa-ban',               '#f87171', 'إلغاء الحوالات'],
    ['bot',          'fa-robot',             '#fcd34d', 'استخدام وضع البوت'],
    ['export',       'fa-file-export',       '#34d399', 'تصدير التقارير'],
    ['history',      'fa-clock-rotate-left', '#fb923c', 'عرض السجل الكامل'],
    ['multiCurrency','fa-coins',             '#fbbf24', 'التعامل بعدة عملات'],
  ];

  const p = emp.permissions || {};
  document.getElementById('sv-perm-view-body').innerHTML =
    permDefs.map(([key, icon, color, label]) =>
      '<div class="perm-view-row">' +
        '<span class="perm-view-lbl"><i class="fa-solid ' + icon + '" style="color:' + color + ';width:14px;"></i> ' + label + '</span>' +
        '<span class="perm-view-val ' + (p[key] ? 'yes' : 'no') + '">' + (p[key] ? '✓ مسموح' : '✗ محظور') + '</span>' +
      '</div>'
    ).join('');

  document.getElementById('sv-perm-overlay').classList.add('open');
}

function closePermView() {
  _empViewId = null;
  document.getElementById('sv-perm-overlay').classList.remove('open');
}

function editEmpFromPerm() {
  if (!_empViewId) return;
  closePermView();
  openEditEmployee(_empViewId);
}


/* ════════════════════════════════════════════════
   CLIENTS MANAGEMENT — مجموعات العملاء
════════════════════════════════════════════════ */

let _clients = [];
let _cltFilter = 'all';
let _cltQuery  = '';
let _cltSelectedColor = '#60a5fa';

function _loadClients() {
  try {
    const saved = localStorage.getItem('intl_clients');
    _clients = saved ? JSON.parse(saved) : [];
  } catch(e) {
    _clients = [];
  }
}

function _saveClients() {
  try {
    localStorage.setItem('intl_clients', JSON.stringify(_clients));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'intl_clients', newValue: JSON.stringify(_clients), storageArea: localStorage
    }));
  } catch(e) {}
}

function cltFilter(f, btn) {
  _cltFilter = f;
  document.querySelectorAll('#sv-clients-section .sv-emp-filter').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  cltRender();
}

function cltSearch(q) { _cltQuery = q.toLowerCase().trim(); cltRender(); }

function cltRender() {
  _loadClients();
  let list = _clients.slice();
  if (_cltFilter !== 'all') list = list.filter(c => c.status === _cltFilter);
  if (_cltQuery) list = list.filter(c =>
    c.name.toLowerCase().includes(_cltQuery) ||
    (c.key||'').toLowerCase().includes(_cltQuery) ||
    (c.contactName||'').toLowerCase().includes(_cltQuery)
  );

  const setEl = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  setEl('clt-total',  _clients.length);
  setEl('clt-active', _clients.filter(c=>c.status==='active').length);
  setEl('clt-today',  _clients.reduce((s,c)=>s+(c.transfersToday||0),0));
  const vol = _clients.reduce((s,c)=>s+(c.volumeToday||0),0);
  setEl('clt-volume', '$' + vol.toLocaleString());
  setEl('clt-nav-badge', _clients.length);

  const tbody = document.getElementById('clt-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:28px;color:#475569;">لا توجد مجموعات</td></tr>';
    return;
  }

  const statusMap = {active:['نشطة','#22c55e'],paused:['موقوفة','#f87171']};

  tbody.innerHTML = list.map(c => {
    const [stLbl, stClr] = statusMap[c.status] || ['غير معروف','#475569'];
    const toggleBtn = c.status === 'active'
      ? '<button class="emp-btn emp-btn-suspend" data-id="' + c.id + '" onclick="cltToggle(this.dataset.id)"><i class="fa-solid fa-pause"></i> إيقاف</button>'
      : '<button class="emp-btn emp-btn-activate" data-id="' + c.id + '" onclick="cltToggle(this.dataset.id)"><i class="fa-solid fa-play"></i> تفعيل</button>';
    return '<tr>' +
      '<td><div class="emp-name-cell">' +
        '<div class="emp-avatar" style="background:' + c.color + '22;color:' + c.color + ';font-size:11px;">' + c.name.slice(0,3) + '</div>' +
        '<div><div class="emp-name-lbl">' + c.name + '</div><div class="emp-id-lbl">' + c.id + '</div></div>' +
      '</div></td>' +
      '<td><span class="cur-chip">' + c.currency + '</span></td>' +
      '<td><span style="color:' + stClr + ';font-size:12px;font-weight:700;">' + stLbl + '</span></td>' +
      '<td style="font-weight:700;color:#fcd34d;">' + (c.transfersToday||0) + '</td>' +
      '<td style="font-size:11px;color:#64748b;">' + (c.contactName||'—') + '</td>' +
      '<td><div class="emp-action-btns">' +
        '<button class="emp-btn emp-btn-edit" data-id="' + c.id + '" onclick="openEditClient(this.dataset.id)"><i class="fa-solid fa-pen"></i> تعديل</button>' +
        toggleBtn +
      '</div></td>' +
    '</tr>';
  }).join('');
}

function openAddClient() {
  document.getElementById('sv-clt-id').value='';
  document.getElementById('sv-clt-title').innerHTML='<i class="fa-solid fa-plus" style="color:#60a5fa;margin-left:6px;"></i>إضافة مجموعة عميل';
  document.getElementById('sv-clt-submit-lbl').textContent='حفظ المجموعة';
  ['sv-clt-name','sv-clt-contact','sv-clt-notes'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('sv-clt-currency').value='USD';
  _cltSelectedColor='#60a5fa';
  document.getElementById('sv-clt-color').value='#60a5fa';
  document.querySelectorAll('#sv-clt-color-picker .cg-color-opt').forEach(el=>el.classList.remove('selected'));
  const first=document.querySelector('#sv-clt-color-picker .cg-color-opt');
  if(first) first.classList.add('selected');
  document.getElementById('sv-clt-overlay').classList.add('open');
}

function openEditClient(id) {
  _loadClients();
  const c = _clients.find(x=>x.id===id);
  if(!c) return;
  document.getElementById('sv-clt-id').value=c.id;
  document.getElementById('sv-clt-title').innerHTML='<i class="fa-solid fa-pen" style="color:#60a5fa;margin-left:6px;"></i>تعديل المجموعة — '+c.name;
  document.getElementById('sv-clt-submit-lbl').textContent='حفظ التعديلات';
  document.getElementById('sv-clt-name').value=c.name;
  document.getElementById('sv-clt-key').value=c.key||'';
  document.getElementById('sv-clt-contact').value=c.contactName||'';
  document.getElementById('sv-clt-notes').value=c.notes||'';
  document.getElementById('sv-clt-currency').value=c.currency||'USD';
  _cltSelectedColor=c.color||'#60a5fa';
  document.getElementById('sv-clt-color').value=_cltSelectedColor;
  document.querySelectorAll('#sv-clt-color-picker .cg-color-opt').forEach(el=>{
    el.classList.toggle('selected', el.dataset.color===_cltSelectedColor);
  });
  document.getElementById('sv-clt-overlay').classList.add('open');
}

function closeCltModal() { document.getElementById('sv-clt-overlay').classList.remove('open'); }

function submitClient() {
  const editId      = document.getElementById('sv-clt-id').value;
  const name        = document.getElementById('sv-clt-name').value.trim();
  const currency    = document.getElementById('sv-clt-currency').value;
  const contactName = document.getElementById('sv-clt-contact').value.trim();
  const notes       = document.getElementById('sv-clt-notes').value.trim();
  const color       = document.getElementById('sv-clt-color').value||'#60a5fa';

  if(!name) { svToast('يرجى إدخال اسم المجموعة','warn'); return; }
  _loadClients();

  if(editId) {
    const idx=_clients.findIndex(c=>c.id===editId);
    if(idx!==-1) {
      _clients[idx]=Object.assign(_clients[idx],{name,currency,contactName,notes,color});
    }
    svToast('تم تعديل مجموعة '+name+' بنجاح','success');
  } else {
    const newId='CLT-'+String(_clients.length+1).padStart(3,'0');
    const key = newId.replace('CLT-','clt').toLowerCase();
    _clients.push({id:newId,key,name,status:'active',currency,contactName,color,transfersToday:0,volumeToday:0,notes});
    svToast('تمت إضافة المجموعة '+name+' بنجاح','success');
  }
  _saveClients(); closeCltModal(); cltRender();
}

function cltToggle(id) {
  _loadClients();
  const c=_clients.find(x=>x.id===id);
  if(!c) return;
  c.status = c.status==='active' ? 'paused' : 'active';
  svToast(c.status==='active' ? 'تم تفعيل '+c.name : 'تم إيقاف '+c.name, c.status==='active'?'success':'warn');
  _saveClients(); cltRender();
}


/* ════════════════════════════════════════════════
   AGENTS MANAGEMENT — وكلاء التنفيذ
════════════════════════════════════════════════ */

let _agents = [];
let _agtFilter = 'all';
let _agtQuery  = '';
let _agtSelectedColor = '#60a5fa';
let _agtSelectedIcon  = '🔵';
const _iconMap = {'#60a5fa':'🔵','#34d399':'🟢','#fcd34d':'🟡','#f87171':'🔴','#a78bfa':'🟣','#fb923c':'🟠'};

function _dbAgentToLocal(a) {
  return {
    id:            'AGT-' + String(a.id).padStart(3,'0'),
    dbId:          a.id,
    key:           a.responsible || '',
    name:          a.name,
    status:        a.status || 'offline',
    capacity:      a.maxCapacity || 20,
    currentLoad:   a.currentLoad || 0,
    commissionRate:a.commission || 0,
    contactName:   a.responsible || '',
    phone:         a.phone || '',
    color:         a.color || '#60a5fa',
    icon:          a.icon  || '🔵',
    currencies:    Array.isArray(a.currencies) ? a.currencies : (a.currencies||'').split(',').filter(Boolean),
    transfersToday:0,
    notes:         a.notes || '',
    portalActive:  a.portalActive || false,
    email:         a.email || '',
    country:       a.country || '',
  };
}

async function _loadAgents() {
  // مسح أي وكلاء وهميين مخزّنين محلياً من نسخ قديمة
  try { localStorage.removeItem('intl_agents'); } catch(e) {}

  try {
    const r = await fetch('/api/ts/agents/');
    const d = await r.json();
    _agents = (d.success && d.agents) ? d.agents.map(_dbAgentToLocal) : [];
  } catch(e) {
    _agents = [];
  }
  // نشر التحديث لبقية الصفحة (bot panel مثلاً)
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'intl_agents', newValue: JSON.stringify(_agents), storageArea: localStorage
    }));
  } catch(e) {}
}

function _saveAgents() {
  // المصدر الرئيسي هو قاعدة البيانات — هذه الدالة للتوافق فقط مع bot panel
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'intl_agents', newValue: JSON.stringify(_agents), storageArea: localStorage
    }));
  } catch(e) {}
}

function agtFilter(f,btn) {
  _agtFilter=f;
  document.querySelectorAll('#sv-agents-section .sv-emp-filter').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  agtRender();
}

function agtSearch(q) { _agtQuery=q.toLowerCase().trim(); agtRender(); }

async function agtRender() {
  await _loadAgents();
  let list=_agents.slice();
  if(_agtFilter!=='all') list=list.filter(a=>a.status===_agtFilter);
  if(_agtQuery) list=list.filter(a=>
    a.name.toLowerCase().includes(_agtQuery)||
    (a.key||'').toLowerCase().includes(_agtQuery)||
    (a.contactName||'').toLowerCase().includes(_agtQuery)
  );

  const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setEl('agt-total',  _agents.length);
  setEl('agt-active', _agents.filter(a=>a.status==='active').length);
  setEl('agt-today',  _agents.reduce((s,a)=>s+(a.transfersToday||0),0));
  const totalCap  = _agents.reduce((s,a)=>s+(a.capacity||1),0);
  const totalLoad = _agents.reduce((s,a)=>s+(a.currentLoad||0),0);
  setEl('agt-load', Math.round(totalLoad/totalCap*100)+'%');
  setEl('agt-nav-badge', _agents.length);

  const tbody=document.getElementById('agt-tbody');
  if(!tbody) return;
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:28px;color:#475569;">لا يوجد وكلاء</td></tr>';
    return;
  }

  const stMap={active:['نشط','#22c55e'],busy:['مشغول','#fcd34d'],offline:['غير متاح','#64748b']};

  tbody.innerHTML=list.map(a=>{
    const [stLbl,stClr]=stMap[a.status]||['—','#475569'];
    const loadPct=Math.round((a.currentLoad||0)/(a.capacity||1)*100);
    const loadClr=loadPct>80?'#f87171':loadPct>50?'#fcd34d':'#34d399';
    const curChips=(a.currencies||[]).map(c=>'<span class="cur-chip">'+c+'</span>').join('');
    const statusBtns = a.status !== 'offline'
      ? `<button class="emp-btn emp-btn-suspend" data-id="${a.id}" data-status="offline" onclick="agtToggle(this.dataset.id,this.dataset.status)"><i class="fa-solid fa-ban"></i></button>`
      : `<button class="emp-btn emp-btn-activate" data-id="${a.id}" data-status="active" onclick="agtToggle(this.dataset.id,this.dataset.status)"><i class="fa-solid fa-check"></i></button>`;
    return '<tr>'+
      '<td><div class="emp-name-cell">'+
        '<div class="emp-avatar" style="background:'+a.color+'22;color:'+a.color+';font-size:16px;">'+a.icon+'</div>'+
        '<div><div class="emp-name-lbl">'+a.name+'</div><div class="emp-id-lbl">'+a.id+'</div></div>'+
      '</div></td>'+
      '<td><span style="color:'+stClr+';font-size:12px;font-weight:700;">'+stLbl+'</span></td>'+
      '<td><div style="display:flex;align-items:center;gap:5px;"><div style="width:14px;height:14px;border-radius:50%;background:'+a.color+';"></div><span style="font-size:13px;">'+a.icon+'</span></div></td>'+
      '<td><div class="agt-load-bar-wrap">'+
        '<div class="agt-load-bar"><div class="agt-load-fill" style="width:'+loadPct+'%;background:'+loadClr+';"></div></div>'+
        '<span style="font-size:11px;color:'+loadClr+';font-weight:700;">'+(a.currentLoad||0)+'/'+a.capacity+'</span>'+
      '</div></td>'+
      '<td style="font-size:12px;font-weight:700;color:#94a3b8;">'+a.capacity+'</td>'+
      '<td><div style="display:flex;gap:3px;flex-wrap:wrap;">'+curChips+'</div></td>'+
      '<td style="font-size:12px;color:#fcd34d;font-weight:700;">'+(a.commissionRate||0)+'%</td>'+
      '<td style="font-size:11px;color:#64748b;">'+(a.contactName||'—')+'</td>'+
      '<td><div class="emp-action-btns">'+
        '<button class="emp-btn emp-btn-edit" data-id="'+a.id+'" onclick="openEditAgent(this.dataset.id)"><i class="fa-solid fa-pen"></i> تعديل</button>'+
        statusBtns+
        '<button class="emp-btn" data-dbid="'+(a.dbId||'')+'" data-name="'+encodeURIComponent(a.name)+'" onclick="openAgtRates(this.dataset.dbid,decodeURIComponent(this.dataset.name))" style="background:rgba(50,184,198,0.12);border-color:rgba(50,184,198,0.3);color:#32b8c6;"><i class="fa-solid fa-coins"></i> تسعير</button>'+
        '<button class="emp-btn" data-name="'+encodeURIComponent(a.name)+'" onclick="openPortalSetup(decodeURIComponent(this.dataset.name))" style="background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.35);color:#818cf8;"><i class="fa-solid fa-key"></i> بوابة</button>'+
      '</div></td>'+
    '</tr>';
  }).join('');
}

function _agtClearPinBoxes() {
  document.querySelectorAll('#sv-agt-pin-boxes .agt-pin-box').forEach(b=>b.value='');
  const s=document.getElementById('sv-agt-pin-status'); if(s) s.textContent='';
}

function agtPinMove(el, idx) {
  el.value = el.value.replace(/[^0-9]/g,'');
  if(el.value.length===1) {
    const boxes = document.querySelectorAll('#sv-agt-pin-boxes .agt-pin-box');
    if(idx<5) boxes[idx+1].focus();
  }
  const boxes=document.querySelectorAll('#sv-agt-pin-boxes .agt-pin-box');
  const filled=Array.from(boxes).filter(b=>b.value).length;
  const s=document.getElementById('sv-agt-pin-status');
  if(s) s.textContent = filled===6 ? 'PIN مكتمل (6 أرقام)' : filled>0 ? filled+' من 6' : '';
}

function agtPinBack(el, idx, e) {
  if(e.key==='Backspace' && !el.value && idx>0) {
    const boxes=document.querySelectorAll('#sv-agt-pin-boxes .agt-pin-box');
    boxes[idx-1].focus(); boxes[idx-1].value='';
  }
}

function _agtGetPin() {
  return Array.from(document.querySelectorAll('#sv-agt-pin-boxes .agt-pin-box')).map(b=>b.value).join('');
}

function openAddAgent() {
  document.getElementById('sv-agt-id').value='';
  document.getElementById('sv-agt-title').innerHTML='<i class="fa-solid fa-plus" style="color:#34d399;margin-left:6px;"></i>إضافة وكيل تنفيذ';
  document.getElementById('sv-agt-submit-lbl').textContent='حفظ الوكيل';
  ['sv-agt-name','sv-agt-contact','sv-agt-notes','sv-agt-email','sv-agt-portal-country'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const phoneEl=document.getElementById('sv-agt-phone'); if(phoneEl) phoneEl.value='';
  const waEl=document.getElementById('sv-agt-whatsapp'); if(waEl) waEl.value='';
  document.getElementById('sv-agt-capacity').value='20';
  document.getElementById('sv-agt-commission').value='2.5';
  ['USD','EUR','TRY','IQD','JOD','ILS'].forEach(cur=>{
    const el=document.getElementById('agt-cur-'+cur); if(el) el.checked=(cur==='USD');
  });
  _agtSelectedColor='#60a5fa'; _agtSelectedIcon='🔵';
  document.getElementById('sv-agt-color').value='#60a5fa';
  document.getElementById('sv-agt-icon').value='🔵';
  document.querySelectorAll('#sv-agt-color-picker .cg-color-opt').forEach(el=>el.classList.remove('selected'));
  const first=document.querySelector('#sv-agt-color-picker .cg-color-opt');
  if(first) first.classList.add('selected');
  const locWrap=document.getElementById('sv-agt-locations'); if(locWrap) locWrap.innerHTML='';
  const activeToggle=document.getElementById('sv-agt-portal-active'); if(activeToggle) activeToggle.checked=false;
  _agtClearPinBoxes();
  document.getElementById('sv-agt-overlay').classList.add('open');
}

function openEditAgent(id) {
  const a=_agents.find(x=>x.id===id);
  if(!a) return;
  document.getElementById('sv-agt-id').value=a.dbId||a.id;
  document.getElementById('sv-agt-title').innerHTML='<i class="fa-solid fa-pen" style="color:#34d399;margin-left:6px;"></i>تعديل الوكيل — '+a.name;
  document.getElementById('sv-agt-submit-lbl').textContent='حفظ التعديلات';
  document.getElementById('sv-agt-name').value=a.name;
  document.getElementById('sv-agt-key').value=a.key||'';
  document.getElementById('sv-agt-contact').value=a.contactName||'';
  document.getElementById('sv-agt-notes').value=a.notes||'';
  document.getElementById('sv-agt-capacity').value=a.capacity||20;
  document.getElementById('sv-agt-commission').value=a.commissionRate||2.5;
  const phoneEl = document.getElementById('sv-agt-phone');
  if(phoneEl) phoneEl.value = a.phone||'';
  const waEl = document.getElementById('sv-agt-whatsapp');
  if(waEl) waEl.value = a.whatsappNumber||'';
  const curList=a.currencies||[];
  ['USD','EUR','TRY','IQD','JOD','ILS'].forEach(cur=>{
    const el=document.getElementById('agt-cur-'+cur); if(el) el.checked=curList.includes(cur);
  });
  _agtSelectedColor=a.color||'#60a5fa'; _agtSelectedIcon=a.icon||'🔵';
  document.getElementById('sv-agt-color').value=_agtSelectedColor;
  document.getElementById('sv-agt-icon').value=_agtSelectedIcon;
  document.querySelectorAll('#sv-agt-color-picker .cg-color-opt').forEach(el=>{
    el.classList.toggle('selected', el.dataset.color===_agtSelectedColor);
  });
  // بيانات البوابة
  const emailEl=document.getElementById('sv-agt-email'); if(emailEl) emailEl.value=a.email||'';
  const portalCountryEl=document.getElementById('sv-agt-portal-country'); if(portalCountryEl) portalCountryEl.value=a.country||'';
  const activeToggle=document.getElementById('sv-agt-portal-active'); if(activeToggle) activeToggle.checked=!!a.portalActive;
  _agtClearPinBoxes();
  const pinStatus=document.getElementById('sv-agt-pin-status');
  if(pinStatus) pinStatus.textContent = a.portalActive ? 'PIN محفوظ — اتركه فارغاً للإبقاء عليه' : 'اختياري — أدخل PIN لتفعيل البوابة';
  // تحميل مناطق العمل
  const locWrap = document.getElementById('sv-agt-locations');
  if(locWrap) { locWrap.innerHTML=''; }
  if(a.dbId) {
    fetch(`/api/ts/agents/${a.dbId}/locations/`)
      .then(r=>r.json()).then(d=>{
        if(d.success && d.locations && locWrap) {
          d.locations.forEach(l=>agtAddLocationRow(l.country, l.city, l.isPrimary, l.id));
        }
      }).catch(()=>{});
  }
  document.getElementById('sv-agt-overlay').classList.add('open');
}

function closeAgtModal() { document.getElementById('sv-agt-overlay').classList.remove('open'); }

// ── location rows inside add/edit modal ──────────────────────────────────────
function agtAddLocationRow(country='', city='', isPrimary=false, locId=null) {
  const wrap = document.getElementById('sv-agt-locations');
  if (!wrap) return;
  const div = document.createElement('div');
  div.dataset.locId = locId || '';
  div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto auto;gap:8px;align-items:center;background:rgba(255,255,255,0.03);border:1px solid rgba(50,184,198,0.15);border-radius:10px;padding:8px 10px;';
  div.innerHTML =
    '<input type="text" placeholder="البلد *" value="'+country+'" style="background:rgba(255,255,255,0.04);border:1.5px solid rgba(50,184,198,0.18);border-radius:8px;padding:7px 10px;color:#e2e8f0;font-size:12px;font-family:inherit;outline:none;" class="loc-country">'+
    '<input type="text" placeholder="المدينة / المنطقة" value="'+city+'" style="background:rgba(255,255,255,0.04);border:1.5px solid rgba(50,184,198,0.18);border-radius:8px;padding:7px 10px;color:#e2e8f0;font-size:12px;font-family:inherit;outline:none;" class="loc-city">'+
    '<label title="رئيسية" style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px;color:#94a3b8;white-space:nowrap;"><input type="radio" name="loc-primary" '+(isPrimary?'checked':'')+' style="accent-color:#34d399;"> رئيسي</label>'+
    '<button type="button" onclick="this.closest(\'div\').remove()" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:7px;color:#f87171;width:26px;height:26px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;">✕</button>';
  wrap.appendChild(div);
}

function _getLocationRows() {
  const wrap = document.getElementById('sv-agt-locations');
  if (!wrap) return [];
  return Array.from(wrap.children).map(div => ({
    locId:     div.dataset.locId || null,
    country:   (div.querySelector('.loc-country')||{}).value||'',
    city:      (div.querySelector('.loc-city')||{}).value||'',
    isPrimary: !!(div.querySelector('input[type=radio]')||{}).checked,
  })).filter(l => l.country.trim());
}

async function submitAgent() {
  const editDbId       = document.getElementById('sv-agt-id').value;
  const name           = document.getElementById('sv-agt-name').value.trim();
  const phone          = (document.getElementById('sv-agt-phone')||{}).value||'';
  const whatsappNumber = (document.getElementById('sv-agt-whatsapp')||{}).value||'';
  const capacity       = parseInt(document.getElementById('sv-agt-capacity').value)||20;
  const commRate    = parseFloat(document.getElementById('sv-agt-commission').value)||2.5;
  const contactName = document.getElementById('sv-agt-contact').value.trim();
  const notes       = document.getElementById('sv-agt-notes').value.trim();
  const color       = document.getElementById('sv-agt-color').value||'#60a5fa';
  const icon        = document.getElementById('sv-agt-icon').value||'🔵';
  const currencies  = ['USD','EUR','TRY','IQD','JOD','ILS'].filter(cur=>{
    const el=document.getElementById('agt-cur-'+cur); return el && el.checked;
  });
  const locations = _getLocationRows();

  if(!name){ svToast('يرجى إدخال اسم الوكيل','warn'); return; }
  if(!currencies.length){ svToast('يرجى اختيار عملة واحدة على الأقل','warn'); return; }

  const csrf = (document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
  const body = JSON.stringify({
    name, color, icon, currencies,
    phone:           phone.trim(),
    whatsappNumber:  whatsappNumber.replace(/[^0-9]/g,''),
    maxCapacity:     capacity,
    commission:      commRate,
    responsible:     contactName,
    notes,
    status: editDbId ? undefined : 'active',
  });

  const btn = document.getElementById('sv-agt-submit-lbl');
  if(btn) btn.textContent = 'جارٍ الحفظ...';

  try {
    let r, d, agentDbId = editDbId;
    if(editDbId) {
      r = await fetch(`/api/ts/agents/${editDbId}/`, {
        method: 'PATCH',
        headers: {'Content-Type':'application/json','X-CSRFToken':csrf},
        body,
      });
      d = await r.json();
      if(d.success || d.agent) svToast('تم تعديل بيانات الوكيل '+name+' بنجاح','success');
      else { svToast(d.message||'حدث خطأ أثناء التعديل','error'); return; }
    } else {
      r = await fetch('/api/ts/agents/', {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-CSRFToken':csrf},
        body,
      });
      d = await r.json();
      if(d.success || d.agent) {
        agentDbId = d.agent.id;
        svToast('تمت إضافة الوكيل '+name+' بنجاح','success');
      } else { svToast(d.message||'حدث خطأ أثناء الإضافة','error'); return; }
    }
    // حفظ المناطق
    if(agentDbId && locations.length) {
      for(const loc of locations) {
        await fetch(`/api/ts/agents/${agentDbId}/locations/`, {
          method: 'POST',
          headers: {'Content-Type':'application/json','X-CSRFToken':csrf},
          body: JSON.stringify({country:loc.country, city:loc.city, isPrimary:loc.isPrimary}),
        });
      }
    }
    // إعداد البوابة (PIN + بريد)
    const pin           = _agtGetPin();
    const portalEmail   = (document.getElementById('sv-agt-email')||{}).value||'';
    const portalCountry = (document.getElementById('sv-agt-portal-country')||{}).value||'';
    const portalChecked = !!(document.getElementById('sv-agt-portal-active')||{}).checked;
    // إذا أدخل PIN يُفعَّل تلقائياً حتى لو لم يُعلَّم الـ checkbox
    const portalActive  = portalChecked || pin.length===6;
    if(agentDbId && (pin.length===6 || portalEmail || portalChecked)) {
      const pr = await fetch(`/api/ts/agents/${agentDbId}/portal-setup/`, {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-CSRFToken':csrf},
        body: JSON.stringify({
          pin:           pin.length===6 ? pin : undefined,
          email:         portalEmail,
          country:       portalCountry,
          portalActive:  portalActive,
        }),
      });
      const pd = await pr.json();
      if(pd.success && pin.length===6 && !editDbId) {
        // عرض بيانات الدخول مرة واحدة فقط عند إنشاء الوكيل
        const overlay = document.getElementById('sv-agt-creds-overlay');
        const origin  = window.location.origin;
        document.getElementById('sv-creds-link').textContent  = origin + (pd.portalLink || '/agent/login/');
        document.getElementById('sv-creds-email').textContent = portalEmail || name;
        document.getElementById('sv-creds-pin').textContent   = pin;
        if(overlay) overlay.style.display='flex';
      }
    }
    closeAgtModal(); await agtRender();
  } catch(e) {
    svToast('تعذّر الاتصال بالخادم','error');
  } finally {
    if(btn) btn.textContent = editDbId ? 'حفظ التعديلات' : 'حفظ الوكيل';
  }
}

async function agtToggle(id, newStatus) {
  const a=_agents.find(x=>x.id===id);
  if(!a) return;
  const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
  try {
    const r = await fetch(`/api/ts/agents/${a.dbId}/`, {
      method: 'PATCH',
      headers: {'Content-Type':'application/json','X-CSRFToken':csrf},
      body: JSON.stringify({status: newStatus}),
    });
    const d = await r.json();
    if(d.success || d.agent) {
      svToast(newStatus==='suspended'?'تم إيقاف الوكيل '+a.name:'تم تفعيل الوكيل '+a.name, newStatus==='suspended'?'warn':'success');
      await agtRender();
    } else {
      svToast(d.message||'حدث خطأ','error');
    }
  } catch(e) {
    svToast('تعذّر الاتصال بالخادم','error');
  }
}

// ══════════════════════════════════════════
// تسعير الحوالات لكل وكيل
// ══════════════════════════════════════════
let _sarAgentDbId = null;

async function openAgtRates(dbId, agentName) {
  if(!dbId) { svToast('الوكيل غير محفوظ في قاعدة البيانات بعد','warn'); return; }
  _sarAgentDbId = dbId;
  const overlay = document.getElementById('sv-agt-rates-overlay');
  if(!overlay) return;
  const lbl = document.getElementById('sar-agent-label');
  if(lbl) lbl.textContent = agentName || '';
  // reset inputs
  ['sar-country','sar-rate','sar-fee-pct','sar-fee-flat','sar-min','sar-max','sar-notes'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const cur=document.getElementById('sar-currency'); if(cur) cur.value='USD';
  overlay.style.display='flex';
  await sarLoadRates();
}

function closeAgtRates() {
  const overlay=document.getElementById('sv-agt-rates-overlay');
  if(overlay) overlay.style.display='none';
  _sarAgentDbId=null;
}

async function sarLoadRates() {
  if(!_sarAgentDbId) return;
  const list=document.getElementById('sar-rates-list');
  if(list) list.innerHTML='<div style="text-align:center;color:#475569;padding:20px;font-size:12px;">جارٍ التحميل...</div>';
  try {
    const r=await fetch(`/api/ts/agents/${_sarAgentDbId}/rates/`);
    const d=await r.json();
    if(!list) return;
    if(!d.success || !d.rates.length) {
      list.innerHTML='<div style="text-align:center;color:#475569;padding:20px;font-size:12px;">لا يوجد أسعار محفوظة — أضف أول دولة أعلاه</div>';
      return;
    }
    list.innerHTML = d.rates.map(rate=>`
      <div style="display:grid;grid-template-columns:1fr 80px 80px 80px 80px auto;gap:8px;align-items:center;background:rgba(255,255,255,0.03);border:1px solid rgba(50,184,198,0.12);border-radius:10px;padding:10px 12px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;">${rate.country} <span style="font-size:10px;color:#64748b;margin-right:6px;">${rate.currency}</span>${rate.isActive?'':'<span style="font-size:10px;color:#f87171;margin-right:4px;">(موقوف)</span>'}</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px;">${rate.notes||''}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:#64748b;">صرف</div>
          <div style="font-size:12px;font-weight:700;color:#32b8c6;">${rate.rate}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:#64748b;">عمولة%</div>
          <div style="font-size:12px;font-weight:700;color:#fcd34d;">${rate.feePct}%</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:#64748b;">رسوم ثابتة</div>
          <div style="font-size:12px;font-weight:700;color:#94a3b8;">${rate.feeFlat}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:#64748b;">حد أدنى</div>
          <div style="font-size:12px;font-weight:700;color:#94a3b8;">${rate.minAmount||'—'}</div>
        </div>
        <div style="display:flex;gap:5px;">
          <button onclick="sarEditRate(${rate.id},'${rate.country}','${rate.currency}',${rate.rate},${rate.feePct},${rate.feeFlat},${rate.minAmount},${rate.maxAmount},'${(rate.notes||'').replace(/'/g,'')}')" style="background:rgba(50,184,198,0.1);border:1px solid rgba(50,184,198,0.25);border-radius:7px;color:#32b8c6;padding:5px 10px;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;">تعديل</button>
          <button onclick="sarDeleteRate(${rate.id})" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:7px;color:#f87171;padding:5px 8px;cursor:pointer;font-size:11px;font-family:inherit;">✕</button>
        </div>
      </div>
    `).join('');
  } catch(e) {
    if(list) list.innerHTML='<div style="text-align:center;color:#f87171;padding:16px;font-size:12px;">تعذّر التحميل</div>';
  }
}

function sarEditRate(id,country,currency,rate,feePct,feeFlat,minAmt,maxAmt,notes) {
  document.getElementById('sar-country').value=country;
  document.getElementById('sar-currency').value=currency;
  document.getElementById('sar-rate').value=rate;
  document.getElementById('sar-fee-pct').value=feePct;
  document.getElementById('sar-fee-flat').value=feeFlat;
  document.getElementById('sar-min').value=minAmt;
  document.getElementById('sar-max').value=maxAmt;
  document.getElementById('sar-notes').value=notes;
  document.getElementById('sar-country').dataset.editId=id;
  document.getElementById('sar-country').focus();
}

async function sarSaveRate() {
  if(!_sarAgentDbId) return;
  const country  = (document.getElementById('sar-country')||{}).value?.trim();
  const currency = (document.getElementById('sar-currency')||{}).value||'USD';
  const rate     = (document.getElementById('sar-rate')||{}).value||'1';
  const feePct   = (document.getElementById('sar-fee-pct')||{}).value||'0';
  const feeFlat  = (document.getElementById('sar-fee-flat')||{}).value||'0';
  const minAmt   = (document.getElementById('sar-min')||{}).value||'0';
  const maxAmt   = (document.getElementById('sar-max')||{}).value||'0';
  const notes    = (document.getElementById('sar-notes')||{}).value||'';

  if(!country) { svToast('يرجى إدخال اسم البلد','warn'); return; }

  const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
  const btn=document.querySelector('[onclick="sarSaveRate()"]');
  if(btn){btn.disabled=true;btn.textContent='جارٍ...';}
  try {
    const r=await fetch(`/api/ts/agents/${_sarAgentDbId}/rates/`,{
      method:'POST',
      headers:{'Content-Type':'application/json','X-CSRFToken':csrf},
      body:JSON.stringify({country,currency,rate,feePct,feeFlat:feeFlat,minAmount:minAmt,maxAmount:maxAmt,notes}),
    });
    const d=await r.json();
    if(d.success){
      svToast('تم حفظ السعر — '+country,'success');
      ['sar-country','sar-rate','sar-fee-pct','sar-fee-flat','sar-min','sar-max','sar-notes'].forEach(id=>{
        const el=document.getElementById(id); if(el){el.value=''; delete el.dataset.editId;}
      });
      await sarLoadRates();
    } else {
      svToast(d.message||'حدث خطأ','error');
    }
  } catch(e){ svToast('تعذّر الاتصال','error'); }
  finally{ if(btn){btn.disabled=false;btn.textContent='حفظ السعر';} }
}

async function sarDeleteRate(rateId) {
  if(!_sarAgentDbId) return;
  const csrf=(document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
  try {
    const r=await fetch(`/api/ts/agents/${_sarAgentDbId}/rates/${rateId}/`,{
      method:'DELETE', headers:{'X-CSRFToken':csrf},
    });
    const d=await r.json();
    if(d.success){ svToast('تم حذف السعر','warn'); await sarLoadRates(); }
    else svToast(d.message||'حدث خطأ','error');
  } catch(e){ svToast('تعذّر الاتصال','error'); }
}

// ══════════════════════════════════════════
// بوابة الوكيل الخارجي — إعداد PIN
// ══════════════════════════════════════════
let _portalSetupDbId = null;

async function openPortalSetup(agentName) {
  _portalSetupDbId = null;
  const overlay = document.getElementById('sv-portal-setup-overlay');
  if (!overlay) return;

  // Reset fields
  ['sp-email','sp-country','sp-p1','sp-p2','sp-p3','sp-p4','sp-p5','sp-p6'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const activeToggle = document.getElementById('sp-active');
  if (activeToggle) activeToggle.checked = true;
  document.getElementById('sp-agent-name').textContent = agentName;
  document.getElementById('sp-status-msg').textContent = '';
  document.getElementById('sp-status-msg').style.display = 'none';

  // Lookup Django ID by name
  try {
    const r = await fetch('/api/ts/agents/');
    const d = await r.json();
    if (d.success && d.agents) {
      const match = d.agents.find(a => a.name === agentName);
      if (match) {
        _portalSetupDbId = match.id;
        if (match.email)        document.getElementById('sp-email').value   = match.email;
        if (match.country)      document.getElementById('sp-country').value = match.country;
        if (activeToggle)       activeToggle.checked = !!match.portalActive;
        const badge = document.getElementById('sp-portal-badge');
        if (badge) {
          badge.textContent = match.portalActive ? 'مفعّل' : 'غير مفعّل';
          badge.style.color = match.portalActive ? '#34d399' : '#f87171';
        }
      }
    }
  } catch(e) {}

  overlay.style.display = 'flex';
}

function closePortalSetup() {
  const overlay = document.getElementById('sv-portal-setup-overlay');
  if (overlay) overlay.style.display = 'none';
}

function _spGetPin() {
  return ['sp-p1','sp-p2','sp-p3','sp-p4','sp-p5','sp-p6']
    .map(id => { const el = document.getElementById(id); return el ? el.value : ''; }).join('');
}

async function savePortalSetup() {
  if (!_portalSetupDbId) {
    svToast('لم يتم العثور على الوكيل في قاعدة البيانات — تأكد من إضافته أولاً عبر النظام', 'warn');
    return;
  }
  const pin     = _spGetPin();
  const email   = (document.getElementById('sp-email')  || {}).value || '';
  const country = (document.getElementById('sp-country')|| {}).value || '';
  const active  = (document.getElementById('sp-active') || {}).checked !== false;

  if (pin && pin.length < 4) { svToast('PIN يجب أن يكون 4 أرقام على الأقل', 'warn'); return; }

  const csrf = (document.cookie.split(';').find(c=>c.trim().startsWith('csrftoken='))||'').split('=')[1]||'';
  const btn  = document.getElementById('sp-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الحفظ...'; }

  try {
    const r = await fetch(`/api/ts/agents/${_portalSetupDbId}/portal-setup/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify({ pin: pin || undefined, email, country, portalActive: active }),
    });
    const d = await r.json();
    if (d.success) {
      svToast(d.message || 'تم تفعيل بوابة الوكيل', 'success');
      const msg = document.getElementById('sp-status-msg');
      if (msg) {
        msg.textContent = 'رابط البوابة: ' + window.location.origin + '/agent/login/';
        msg.style.display = 'block';
        msg.style.color = '#34d399';
      }
    } else {
      svToast(d.message || 'حدث خطأ', 'error');
    }
  } catch(e) {
    svToast('تعذّر الاتصال بالخادم', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'حفظ الإعدادات'; }
  }
}

/* ── Shared color picker helper ── */
function selectColor(prefix, color, el) {
  if(prefix==='clt') { _cltSelectedColor=color; document.getElementById('sv-clt-color').value=color; }
  if(prefix==='agt') {
    _agtSelectedColor=color; _agtSelectedIcon=_iconMap[color]||'🔵';
    document.getElementById('sv-agt-color').value=color;
    document.getElementById('sv-agt-icon').value=_agtSelectedIcon;
  }
  const picker=document.getElementById('sv-'+prefix+'-color-picker');
  if(picker) picker.querySelectorAll('.cg-color-opt').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');
}

// ══════════════════════════════════════════
// رفع التقارير للإدارة العامة
// ══════════════════════════════════════════
let _svRptFileData = null;
let _svRptFileMeta = null;

const _SV_RPT_EXT_MAP = {
  'application/pdf':'pdf',
  'application/vnd.ms-excel':'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'excel',
  'application/msword':'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'word',
  'image/png':'image','image/jpeg':'image','image/jpg':'image','image/gif':'image','image/webp':'image'
};
const _SV_RPT_ICONS = {pdf:'📄',excel:'📊',word:'📝',image:'🖼️',other:'📁'};

function _svRptFormatSize(bytes){
  if(bytes<1024)return bytes+' B';
  if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1048576).toFixed(1)+' MB';
}
function _svRptDetectType(mimeType,fileName){
  if(_SV_RPT_EXT_MAP[mimeType])return _SV_RPT_EXT_MAP[mimeType];
  const ext=(fileName||'').split('.').pop().toLowerCase();
  if(ext==='pdf')return 'pdf';
  if(['xls','xlsx','csv'].includes(ext))return 'excel';
  if(['doc','docx'].includes(ext))return 'word';
  if(['png','jpg','jpeg','gif','webp'].includes(ext))return 'image';
  return 'other';
}
function svRptClearFile(){
  _svRptFileData=null; _svRptFileMeta=null;
  const inp=document.getElementById('svRptFileInput');
  if(inp)inp.value='';
  const preview=document.getElementById('svRptFilePreview');
  const dz=document.getElementById('svRptDropZone');
  if(preview)preview.style.display='none';
  if(dz)dz.style.display='';
}
function _svRptShowPreview(name,size,type){
  document.getElementById('svRptFileIcon').textContent=_SV_RPT_ICONS[type]||'📁';
  document.getElementById('svRptFileNameDisplay').textContent=name;
  document.getElementById('svRptFileSizeDisplay').textContent=_svRptFormatSize(size);
  document.getElementById('svRptDropZone').style.display='none';
  const preview=document.getElementById('svRptFilePreview');
  if(preview)preview.style.display='flex';
}
function _svRptReadFile(file){
  if(file.size>10*1024*1024){svToast('حجم الملف يتجاوز 10 MB','warn');return;}
  const type=_svRptDetectType(file.type,file.name);
  _svRptFileMeta={name:file.name,size:file.size,type:type};
  _svRptShowPreview(file.name,file.size,type);
  const reader=new FileReader();
  reader.onload=function(ev){_svRptFileData=ev.target.result;};
  reader.readAsDataURL(file);
}
function svRptFileChosen(input){
  if(input.files&&input.files[0])_svRptReadFile(input.files[0]);
}
function svRptFileDrop(event){
  const files=event.dataTransfer.files;
  if(files&&files[0])_svRptReadFile(files[0]);
}
function svOpenReportModal(){
  const overlay=document.getElementById('svReportOverlay');
  if(!overlay)return;
  try{
    _svRptFileData=null; _svRptFileMeta=null;
    const titleEl=document.getElementById('svRptTitle');
    if(titleEl)titleEl.value='';
    svRptClearFile();
    const u=(window._currentUser||{});
    const senderEl=document.getElementById('svRptSenderDisplay');
    if(senderEl&&u.username)senderEl.textContent=u.username;
  }catch(e){}
  overlay.style.setProperty('display','flex','important');
}
function svCloseReportModal(){
  const overlay=document.getElementById('svReportOverlay');
  if(overlay)overlay.style.setProperty('display','none','important');
}
function svSubmitReport(){
  const title=(document.getElementById('svRptTitle').value||'').trim();
  if(!title){svToast('يرجى إدخال عنوان التقرير','warn');return;}
  if(!_svRptFileData||!_svRptFileMeta){svToast('يرجى اختيار ملف للرفع','warn');return;}

  let senderName='مشرف الحوالات';
  try{const u=(window._currentUser||{});if(u.username)senderName=u.username;}catch(e){}

  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const date=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())
             +' '+pad(now.getHours())+':'+pad(now.getMinutes());

  const reportObj={
    source:'transfersMgr',
    title:title,
    fileName:_svRptFileMeta.name,
    fileType:_svRptFileMeta.type,
    fileSize:_svRptFormatSize(_svRptFileMeta.size),
    fileData:_svRptFileData,
    sender:senderName,
    department:'مشرف الحوالات',
    branch:'الفرع الرئيسي',
    branchId:1,
    date:date
  };

  try{
    const existing=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');
    existing.unshift(reportObj);
    localStorage.setItem('intl_admin_reports',JSON.stringify(existing));
  }catch(storageErr){
    try{
      reportObj.fileData=null;
      reportObj.fileSize=_svRptFormatSize(_svRptFileMeta.size)+' (غير متاح للتنزيل)';
      const existing2=JSON.parse(localStorage.getItem('intl_admin_reports')||'[]');
      existing2.unshift(reportObj);
      localStorage.setItem('intl_admin_reports',JSON.stringify(existing2));
    }catch(e){}
  }

  svCloseReportModal();
  svToast('تم إرسال الملف "'+_svRptFileMeta.name+'" للإدارة بنجاح','success');
}

// ══════════════════════════════════════════════════
// تعليمات الإدارة — Transfers Supervisor
// ══════════════════════════════════════════════════

function svTrGetMyId() {
  try { const u = (window._currentUser || {}); return u.svId || u.id || 2; } catch(e) { return 2; }
}

function svTrLoadInstructions() {
  const id = svTrGetMyId();
  try { return JSON.parse(localStorage.getItem('intl_instr_' + id)) || []; } catch(e) { return []; }
}

function svTrRenderInstructions() {
  const list = svTrLoadInstructions();
  const el = document.getElementById('sv-instr-list-tr');
  if (!el) return;
  // mark all as read
  const id = svTrGetMyId();
  const updated = list.map(i => ({ ...i, read: true }));
  localStorage.setItem('intl_instr_' + id, JSON.stringify(updated));
  const badge = document.getElementById('svInstrBadge');
  if (badge) badge.style.display = 'none';

  el.innerHTML = list.length === 0
    ? '<div style="text-align:center;padding:40px;color:#8696a0;font-size:14px">لا توجد تعليمات من الإدارة</div>'
    : list.map(function(instr) {
        var borderColor = instr.priority === 'عاجل جداً' ? 'rgba(239,68,68,0.3)' : instr.priority === 'مهم' ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.07)';
        var bgColor     = instr.priority === 'عاجل جداً' ? 'rgba(239,68,68,0.15)'  : instr.priority === 'مهم' ? 'rgba(251,191,36,0.15)'  : 'rgba(255,255,255,0.06)';
        var textColor   = instr.priority === 'عاجل جداً' ? '#f87171'               : instr.priority === 'مهم' ? '#fbbf24'                 : '#94a3b8';
        return '<div style="background:rgba(255,255,255,0.03);border:1px solid ' + borderColor + ';border-radius:14px;padding:16px;margin-bottom:12px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
            '<span style="font-size:11px;font-weight:800;padding:3px 10px;border-radius:8px;background:' + bgColor + ';color:' + textColor + '">' + instr.priority + '</span>' +
            '<span style="font-size:11px;color:#64748b">' + instr.date + '</span>' +
          '</div>' +
          '<div style="font-size:13px;line-height:1.7;color:#e9edef">' + instr.text + '</div>' +
          '<div style="font-size:11px;color:#64748b;margin-top:8px">من: ' + (instr.adminName || 'الإدارة العامة') + '</div>' +
        '</div>';
      }).join('');
}

function svTrCheckNewInstructions() {
  const id = svTrGetMyId();
  const list = JSON.parse(localStorage.getItem('intl_instr_' + id) || '[]');
  const unread = list.filter(function(i) { return !i.read; }).length;
  const badge = document.getElementById('svInstrBadge');
  if (badge) {
    badge.style.display = unread > 0 ? '' : 'none';
    badge.textContent = unread;
  }
}

function svSendMessageToAdmin() {
  document.getElementById('svTrMsgModal').style.display = 'flex';
}

function svTrDoSendMsg() {
  const text = (document.getElementById('svTrMsgText').value || '').trim();
  if (!text) { svToast('يرجى كتابة رسالة', 'warn'); return; }
  let name = 'مشرف الحوالات';
  try { const u = (window._currentUser || {}); if (u.username) name = u.username; } catch(e) {}
  const msgs = JSON.parse(localStorage.getItem('intl_sv_msgs') || '[]');
  const now = new Date();
  const p = function(n) { return String(n).padStart(2, '0'); };
  msgs.unshift({
    id: Date.now(),
    supId: svTrGetMyId(),
    supName: name,
    supType: 'transfers',
    text: text,
    date: now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate()) + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()),
    read: false
  });
  localStorage.setItem('intl_sv_msgs', JSON.stringify(msgs));
  document.getElementById('svTrMsgText').value = '';
  document.getElementById('svTrMsgModal').style.display = 'none';
  svToast('تم إرسال رسالتك للإدارة', 'success');
}

// Listen for new instructions from admin
window.addEventListener('storage', function(e) {
  if (e.key && e.key.startsWith('intl_instr_')) svTrCheckNewInstructions();
});

// Initial check on load
svTrCheckNewInstructions();
