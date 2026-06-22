// dashboard-charts.js — جلب رسوم Plotly من /api/dash/charts وعرضها في لوحة التحكم
(function () {
  'use strict';

  var IDS = {
    'chart-ops-daily':        'ops_daily',
    'chart-balance-currency': 'balance_currency',
    'chart-branch-compare':   'branch_compare',
  };

  window.loadDashCharts = async function loadDashCharts() {
    var msg = document.getElementById('dash-charts-msg');
    if (!window.Plotly) { if (msg) msg.textContent = 'تعذّر تحميل مكتبة الرسوم (Plotly).'; return; }
    if (msg) msg.textContent = 'جاري تحميل الرسوم...';

    try {
      var r = await fetch('/api/dash/charts', { credentials: 'same-origin' });
      if (r.status === 401 || r.status === 403) { if (msg) msg.textContent = 'هذه الرسوم متاحة للإدارة العامة فقط.'; return; }
      var d = await r.json();
      if (!d || !d.success || !d.charts) { if (msg) msg.textContent = 'تعذّر تحميل بيانات الرسوم.'; return; }

      var cfg = { responsive: true, displayModeBar: false };
      Object.keys(IDS).forEach(function (elId) {
        var fig = d.charts[IDS[elId]];
        var el  = document.getElementById(elId);
        if (el && fig) Plotly.react(el, fig.data, fig.layout, cfg);
      });
      if (msg) msg.textContent = '';
    } catch (e) {
      if (msg) msg.textContent = 'خطأ في تحميل الرسوم.';
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    // تأخير بسيط حتى تكتمل تهيئة اللوحة
    setTimeout(window.loadDashCharts, 400);
  });

  // إعادة ضبط مقاس الرسوم عند تغيير حجم النافذة
  window.addEventListener('resize', function () {
    if (!window.Plotly) return;
    Object.keys(IDS).forEach(function (elId) {
      var el = document.getElementById(elId);
      if (el && el.data) Plotly.Plots.resize(el);
    });
  });
})();
