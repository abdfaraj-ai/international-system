// ══════════════════════════════════════════════════════
//  قسم التصميم — Design Section  (Tab 8)
// ══════════════════════════════════════════════════════

  // ── بيانات تجريبية ─────────────────────────────────
  var _posts = [
    {
      id: 1,
      title: 'سعر الذهب — 7 مايو 2026',
      type: 'gold',
      caption: 'أسعار الذهب لهذا اليوم:\n🥇 عيار 21: $58.40/غ\n🥇 عيار 18: $50.07/غ\n🥇 عيار 24: $66.74/غ\n\nللاستفسار والشراء تواصل معنا 📲',
      status: 'published',
      platforms: ['facebook', 'instagram', 'whatsapp'],
      date: '2026-05-07',
      time: '09:00',
      image: null,
      notes: '',
    },
    {
      id: 2,
      title: 'عرض خاص — شراء الذهب',
      type: 'promo',
      caption: 'فرصة ذهبية لا تفوّتك! 🌟\nنشتري الذهب بأفضل الأسعار في المنطقة\n📍 شركة انترناشونال للصرافة',
      status: 'pending',
      platforms: ['facebook', 'instagram'],
      date: '2026-05-08',
      time: '11:00',
      image: null,
      notes: 'يرجى مراجعة السعر قبل النشر',
    },
    {
      id: 3,
      title: 'إعلان: أوقات الدوام',
      type: 'news',
      caption: 'إعلان هام 📢\nأوقات عملنا: السبت - الخميس\n🕘 9:00 صباحاً — 5:00 مساءً',
      status: 'draft',
      platforms: ['whatsapp', 'telegram'],
      date: '2026-05-09',
      time: '08:00',
      image: null,
      notes: '',
    },
    {
      id: 4,
      title: 'سعر الذهب — 6 مايو 2026',
      type: 'gold',
      caption: 'أسعار الذهب لهذا اليوم:\n🥇 عيار 21: $57.90/غ\n🥇 عيار 18: $49.63/غ',
      status: 'published',
      platforms: ['facebook', 'whatsapp'],
      date: '2026-05-06',
      time: '09:00',
      image: null,
      notes: '',
    },
    {
      id: 5,
      title: 'تهنئة رمضان',
      type: 'custom',
      caption: 'كل عام وأنتم بخير 🌙\nتهنئة بمناسبة شهر رمضان المبارك',
      status: 'scheduled',
      platforms: ['facebook', 'instagram', 'whatsapp', 'telegram'],
      date: '2026-05-15',
      time: '06:00',
      image: null,
      notes: '',
    },
  ];
  var _nextId = 6;

  var STATUS_LBL = {
    draft:     'مسودة',
    pending:   'بانتظار الموافقة',
    approved:  'مقبول',
    scheduled: 'مجدول',
    published: 'منشور',
    rejected:  'مرفوض',
  };
  var PLATFORM_ICON = { facebook: '📘', instagram: '📸', whatsapp: '💬', telegram: '✈️' };
  var TYPE_ICON     = { gold: '🥇', promo: '🎁', news: '📢', custom: '✏️' };

  // ── helpers ─────────────────────────────────────────
  function _getFilter(id) { var el = document.getElementById(id); return el ? el.value : ''; }

  function _statsCount() {
    var total = _posts.length, pending = 0, published = 0, scheduled = 0;
    _posts.forEach(function(p) {
      if (p.status === 'pending')   pending++;
      if (p.status === 'published') published++;
      if (p.status === 'scheduled') scheduled++;
    });
    return { total: total, pending: pending, published: published, scheduled: scheduled };
  }

  function _platformCounts() {
    var c = { facebook: 0, instagram: 0, whatsapp: 0, telegram: 0 };
    _posts.forEach(function(p) {
      if (p.status !== 'published') return;
      (p.platforms || []).forEach(function(pl) { if (c[pl] !== undefined) c[pl]++; });
    });
    return c;
  }

  function _setEl(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }

  // ── public: load ────────────────────────────────────
  window.design_load = function() { design_render(); };

  // ── render grid ─────────────────────────────────────
  window.design_render = function() {
    var q        = (_getFilter('ds-search') || '').toLowerCase();
    var fStatus  = _getFilter('ds-filter-status');
    var fPlat    = _getFilter('ds-filter-platform');
    var fType    = _getFilter('ds-filter-type');

    var filtered = _posts.filter(function(p) {
      if (fStatus && p.status !== fStatus) return false;
      if (fType   && p.type   !== fType)   return false;
      if (fPlat   && !(p.platforms || []).includes(fPlat)) return false;
      if (q && !(p.title.toLowerCase().includes(q) || p.caption.toLowerCase().includes(q))) return false;
      return true;
    });

    var grid  = document.getElementById('ds-grid');
    var empty = document.getElementById('ds-empty');
    if (!grid) return;

    if (!filtered.length) {
      grid.innerHTML = '';
      if (empty) empty.style.display = '';
    } else {
      if (empty) empty.style.display = 'none';
      grid.innerHTML = filtered.map(function(p) {
        var platIcons = (p.platforms || []).map(function(pl) {
          return '<span title="' + pl + '">' + (PLATFORM_ICON[pl] || pl) + '</span>';
        }).join('');
        var thumbContent = p.image
          ? '<img src="' + p.image + '" alt="">'
          : '<div class="ds-post-thumb-placeholder">' + (TYPE_ICON[p.type] || '🖼️') + '</div>';
        var isManager = true; // TODO: wire to role
        var actionBtns = '';
        if (p.status === 'pending' && isManager) {
          actionBtns = '<button class="ds-post-btn approve" onclick="event.stopPropagation();design_openReview(' + p.id + ')">مراجعة</button>';
        } else {
          actionBtns = '<button class="ds-post-btn" onclick="event.stopPropagation();design_openEditPost(' + p.id + ')">تعديل</button>'
            + '<button class="ds-post-btn reject" onclick="event.stopPropagation();design_deletePost(' + p.id + ')">🗑</button>';
        }
        return '<div class="ds-post-card" onclick="design_openEditPost(' + p.id + ')">'
          + '<div class="ds-post-thumb">' + thumbContent
          + '<span class="ds-post-status-badge ds-status-' + p.status + '">' + (STATUS_LBL[p.status] || p.status) + '</span>'
          + '</div>'
          + '<div class="ds-post-body">'
          + '<div class="ds-post-title">' + p.title + '</div>'
          + '<div class="ds-post-caption">' + p.caption.replace(/\n/g, ' ') + '</div>'
          + '<div class="ds-post-footer">'
          + '<div class="ds-post-platforms">' + platIcons + '</div>'
          + '<div class="ds-post-date">' + p.date + '</div>'
          + '</div>'
          + '<div class="ds-post-actions">' + actionBtns + '</div>'
          + '</div></div>';
      }).join('');
    }

    // update stats
    var s = _statsCount();
    _setEl('ds-stat-total',     s.total);
    _setEl('ds-stat-pending',   s.pending);
    _setEl('ds-stat-published', s.published);
    _setEl('ds-stat-scheduled', s.scheduled);

    var pc = _platformCounts();
    _setEl('dsp-fb', pc.facebook);
    _setEl('dsp-ig', pc.instagram);
    _setEl('dsp-wa', pc.whatsapp);
    _setEl('dsp-tg', pc.telegram);

    // sidebar badge
    var badge = document.getElementById('sb-design');
    if (badge) {
      var pend = s.pending;
      badge.textContent = pend;
      badge.style.display = pend ? '' : 'none';
    }
  };

  // ── new/edit post modal ──────────────────────────────
  function _fillModal(post) {
    document.getElementById('ds-modal-title').textContent = post ? 'تعديل المنشور' : 'منشور جديد';
    document.getElementById('dsm-post-id').value  = post ? post.id : '';
    document.getElementById('dsm-title').value    = post ? post.title : '';
    document.getElementById('dsm-type').value     = post ? post.type : 'custom';
    document.getElementById('dsm-caption').value  = post ? post.caption : '';
    document.getElementById('dsm-date').value     = post ? post.date : new Date().toISOString().split('T')[0];
    document.getElementById('dsm-time').value     = post ? (post.time || '09:00') : '09:00';
    document.getElementById('dsm-notes').value    = post ? (post.notes || '') : '';
    var plats = post ? (post.platforms || []) : ['facebook'];
    document.querySelectorAll('#dsm-platforms input[type=checkbox]').forEach(function(cb) {
      cb.checked = plats.includes(cb.value);
    });
    var preview  = document.getElementById('dsm-img-preview');
    var prevWrap = document.getElementById('dsm-img-preview-wrap');
    var placeholder = document.getElementById('dsm-img-placeholder');
    if (post && post.image) {
      preview.src = post.image;
      prevWrap.style.display = '';
      placeholder.style.display = 'none';
    } else {
      prevWrap.style.display = 'none';
      placeholder.style.display = '';
    }
  }

  window.design_openNewPost = function() {
    _fillModal(null);
    document.getElementById('ds-post-modal').classList.add('open');
  };

  window.design_openEditPost = function(id) {
    var post = _posts.find(function(p) { return p.id === id; });
    if (!post) return;
    _fillModal(post);
    document.getElementById('ds-post-modal').classList.add('open');
  };

  window.design_closePostModal = function() {
    document.getElementById('ds-post-modal').classList.remove('open');
  };

  window.design_previewImg = function(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('dsm-img-preview').src = e.target.result;
      document.getElementById('dsm-img-preview-wrap').style.display = '';
      document.getElementById('dsm-img-placeholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
  };

  window.design_savePost = function(statusOverride) {
    var title = (document.getElementById('dsm-title').value || '').trim();
    if (!title) { notify('يرجى إدخال عنوان المنشور', 'error'); return; }
    var id       = document.getElementById('dsm-post-id').value;
    var caption  = document.getElementById('dsm-caption').value || '';
    var type     = document.getElementById('dsm-type').value;
    var date     = document.getElementById('dsm-date').value;
    var time     = document.getElementById('dsm-time').value;
    var notes    = document.getElementById('dsm-notes').value || '';
    var platforms = Array.from(document.querySelectorAll('#dsm-platforms input[type=checkbox]:checked')).map(function(cb) { return cb.value; });
    var imgPreview = document.getElementById('dsm-img-preview').src;
    var image = (imgPreview && imgPreview.startsWith('data:')) ? imgPreview : null;

    if (id) {
      var existing = _posts.find(function(p) { return p.id == id; });
      if (existing) {
        existing.title     = title;
        existing.type      = type;
        existing.caption   = caption;
        existing.date      = date;
        existing.time      = time;
        existing.notes     = notes;
        existing.platforms = platforms;
        if (image) existing.image = image;
        if (statusOverride) existing.status = statusOverride;
        notify('تم تحديث المنشور بنجاح');
      }
    } else {
      _posts.unshift({
        id:        _nextId++,
        title:     title,
        type:      type,
        caption:   caption,
        status:    statusOverride || 'draft',
        platforms: platforms,
        date:      date,
        time:      time,
        image:     image,
        notes:     notes,
      });
      notify('تم إنشاء المنشور بنجاح');
    }
    design_closePostModal();
    design_render();
  };

  window.design_deletePost = function(id) {
    if (!confirm('هل تريد حذف هذا المنشور؟')) return;
    _posts = _posts.filter(function(p) { return p.id !== id; });
    design_render();
    notify('تم حذف المنشور');
  };

  // ── review (manager) modal ───────────────────────────
  window.design_openReview = function(id) {
    var post = _posts.find(function(p) { return p.id === id; });
    if (!post) return;
    document.getElementById('dsrev-post-id').value = id;
    document.getElementById('dsrev-title').textContent = post.title;
    document.getElementById('dsrev-caption').textContent = post.caption;
    document.getElementById('dsrev-note').value = '';
    var platNames = (post.platforms || []).map(function(pl) { return PLATFORM_ICON[pl] + ' ' + pl; }).join('  ');
    document.getElementById('dsrev-meta').textContent = 'النوع: ' + (TYPE_ICON[post.type] || '') + '  |  المنصات: ' + platNames + '  |  التاريخ: ' + post.date;
    var imgWrap = document.getElementById('dsrev-img-wrap');
    if (post.image) {
      document.getElementById('dsrev-img').src = post.image;
      imgWrap.style.display = '';
    } else {
      imgWrap.style.display = 'none';
    }
    document.getElementById('ds-review-modal').classList.add('open');
  };

  window.design_closeReviewModal = function() {
    document.getElementById('ds-review-modal').classList.remove('open');
  };

  window.design_approvePost = function(statusOverride) {
    var id   = document.getElementById('dsrev-post-id').value;
    var post = _posts.find(function(p) { return p.id == id; });
    if (!post) return;
    post.status = statusOverride || 'published';
    design_closeReviewModal();
    design_render();
    notify(statusOverride === 'scheduled' ? 'تم جدولة المنشور' : 'تم الموافقة والنشر');
  };

  window.design_rejectPost = function() {
    var id   = document.getElementById('dsrev-post-id').value;
    var note = (document.getElementById('dsrev-note').value || '').trim();
    var post = _posts.find(function(p) { return p.id == id; });
    if (!post) return;
    post.status = 'rejected';
    if (note) post.notes = note;
    design_closeReviewModal();
    design_render();
    notify('تم رفض المنشور', 'error');
  };

  // ── gold generator shortcut ──────────────────────────
  window.design_openGoldGen = function() {
    document.getElementById('dsg-k21').focus();
  };

  window.design_generateGold = function() {
    var k21 = document.getElementById('dsg-k21').value;
    var k18 = document.getElementById('dsg-k18').value;
    var k24 = document.getElementById('dsg-k24').value;
    if (!k21 && !k18 && !k24) { notify('يرجى إدخال سعر واحد على الأقل', 'error'); return; }
    var today  = new Date();
    var dateStr = today.toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });
    var lines  = ['أسعار الذهب ليوم ' + dateStr + ':'];
    if (k21) lines.push('🥇 عيار 21: $' + Number(k21).toFixed(2) + '/غ');
    if (k18) lines.push('🥇 عيار 18: $' + Number(k18).toFixed(2) + '/غ');
    if (k24) lines.push('🥇 عيار 24: $' + Number(k24).toFixed(2) + '/غ');
    lines.push('\nللاستفسار والشراء تواصل معنا 📲\nشركة انترناشونال للصرافة');
    _posts.unshift({
      id:        _nextId++,
      title:     'سعر الذهب — ' + today.toISOString().split('T')[0],
      type:      'gold',
      caption:   lines.join('\n'),
      status:    'pending',
      platforms: ['facebook', 'instagram', 'whatsapp'],
      date:      today.toISOString().split('T')[0],
      time:      '09:00',
      image:     null,
      notes:     'مولّد تلقائياً',
    });
    design_render();
    notify('تم توليد منشور سعر الذهب — بانتظار الموافقة');
  };

  // ── AI caption (sidebar) ─────────────────────────────
  window.design_generateCaption = function() {
    var prompt = (document.getElementById('ds-ai-prompt').value || '').trim();
    var tone   = document.getElementById('ds-ai-tone').value;
    if (!prompt) { notify('يرجى كتابة فكرة المنشور', 'error'); return; }
    var resultEl = document.getElementById('ds-ai-result');
    resultEl.style.display = '';
    resultEl.innerHTML = '<span style="color:#8696a0;font-size:12px">جاري التوليد...</span>';

    fetch('/api/admin/voice/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'اكتب كابشن احترافي بالعربي للنشر على السوشال ميديا. النبرة: ' + tone + '. الفكرة: ' + prompt
              + '\n\nاكتب الكابشن فقط بدون أي مقدمة أو شرح. الكابشن:'
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var text = d.reply || d.response || d.answer || d.text || '';
      if (!text) text = 'لم يتم توليد كابشن، يرجى المحاولة مجدداً.';
      resultEl.innerHTML = '<button class="ds-ai-copy-btn" onclick="navigator.clipboard.writeText(this.nextSibling.textContent);notify(\'تم النسخ\')">نسخ</button>'
        + '<span style="display:block;margin-top:4px">' + text.replace(/\n/g, '<br>') + '</span>';
    })
    .catch(function() {
      resultEl.innerHTML = '<span style="color:#ef4444;font-size:12px">خطأ في الاتصال بالخادم</span>';
    });
  };

  // ── AI caption inside new-post modal ────────────────
  window.design_aiCaption_modal = function() {
    var title  = (document.getElementById('dsm-title').value || '').trim();
    var type   = document.getElementById('dsm-type').value;
    if (!title) { notify('يرجى كتابة عنوان المنشور أولاً', 'error'); return; }
    var captionEl = document.getElementById('dsm-caption');
    captionEl.value = 'جاري التوليد...';

    fetch('/api/admin/voice/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'اكتب كابشن احترافي بالعربي للنشر على السوشال ميديا عن: ' + title
              + '. نوع المنشور: ' + type + '\nاكتب الكابشن فقط بدون مقدمة. الكابشن:'
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var text = d.reply || d.response || d.answer || d.text || '';
      captionEl.value = text || 'لم يتم توليد كابشن.';
    })
    .catch(function() { captionEl.value = 'خطأ في الاتصال بالخادم'; });
  };

  // ── calendar modal ───────────────────────────────────
  window.design_openCalendar = function() {
    _renderCalendar();
    document.getElementById('ds-calendar-modal').classList.add('open');
  };

  function _renderCalendar() {
    var today   = new Date();
    var year    = today.getFullYear();
    var month   = today.getMonth();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var firstDay    = new Date(year, month, 1).getDay();

    var dayNames = ['أح','إث','ثل','أر','خم','جم','سب'];
    var grid = document.getElementById('ds-calendar-grid');
    var list = document.getElementById('ds-calendar-list');
    if (!grid) return;

    var html = dayNames.map(function(d) {
      return '<div style="text-align:center;font-size:10px;font-weight:700;color:#8696a0;padding:4px">' + d + '</div>';
    }).join('');

    for (var i = 0; i < firstDay; i++) html += '<div></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var dayPosts = _posts.filter(function(p) { return p.date === dateStr; });
      var isToday  = d === today.getDate();
      var hasPosts = dayPosts.length > 0;
      html += '<div style="text-align:center;padding:6px 2px;border-radius:7px;font-size:12px;cursor:' + (hasPosts ? 'pointer' : 'default')
        + ';background:' + (isToday ? 'rgba(236,72,153,0.15)' : (hasPosts ? 'rgba(99,102,241,0.1)' : 'transparent'))
        + ';color:' + (isToday ? '#ec4899' : (hasPosts ? '#818cf8' : '#8696a0'))
        + ';font-weight:' + (isToday || hasPosts ? '700' : '400') + '">'
        + d + (hasPosts ? '<br><span style="font-size:8px">●</span>' : '') + '</div>';
    }
    grid.innerHTML = html;

    // Upcoming scheduled/pending list
    var upcoming = _posts
      .filter(function(p) { return (p.status === 'scheduled' || p.status === 'pending') && p.date >= today.toISOString().split('T')[0]; })
      .sort(function(a, b) { return (a.date + a.time).localeCompare(b.date + b.time); })
      .slice(0, 8);

    if (!upcoming.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:#8696a0;font-size:12px">لا توجد منشورات مجدولة قادمة</div>';
    } else {
      list.innerHTML = '<div style="font-size:11px;font-weight:700;color:#8696a0;margin-bottom:8px">المنشورات القادمة</div>'
        + upcoming.map(function(p) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:6px">'
            + '<span style="font-size:18px">' + (TYPE_ICON[p.type] || '🖼️') + '</span>'
            + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:#e9edef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + p.title + '</div>'
            + '<div style="font-size:10px;color:#8696a0">' + p.date + ' ' + (p.time || '') + '</div></div>'
            + '<span class="ds-post-status-badge ds-status-' + p.status + '">' + (STATUS_LBL[p.status] || p.status) + '</span>'
            + '</div>';
        }).join('');
    }
  }

  // ── init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  if (typeof design_render === 'function') design_render();
});
