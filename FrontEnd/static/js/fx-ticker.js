/* fx-ticker.js */
(function () {
  'use strict';

  if (window._fxTickerLoaded) return;
  window._fxTickerLoaded = true;

  var API_URL    = '/api/fx-rates/';
  var API_FORCE  = '/api/fx-rates/?refresh=1';
  var PX_PER_SEC = 25;
  var _prev = {};

  function _fmt(r) {
    r = parseFloat(r);
    if (isNaN(r)) return '—';
    if (r >= 1000) return r.toFixed(1);
    if (r >= 100)  return r.toFixed(2);
    if (r >= 10)   return r.toFixed(3);
    return r.toFixed(4);
  }

  function _pairHTML(p) {
    var rate = parseFloat(p.rate);
    if (isNaN(rate)) return '';
    var key  = p.base + '_' + p.quote;
    var prev = _prev[key];
    var dir  = prev == null ? 'flat' : rate > prev ? 'up' : rate < prev ? 'down' : 'flat';
    var arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '●';
    var pct  = (prev != null && prev !== 0)
      ? ((rate - prev) / prev * 100).toFixed(2) + '%' : '—';
    return '<span class="fx-pair">' +
      '<span class="fx-pair-codes">' + p.base + '/' + p.quote + '</span>' +
      '<span class="fx-pair-label">' + p.label + '</span>' +
      '<span class="fx-pair-rate">' + _fmt(rate) + '</span>' +
      '<span class="fx-pair-change ' + dir + '">' +
        '<span class="fx-arrow">' + arrow + '</span>' + pct +
      '</span></span><span class="fx-sep"></span>';
  }

  function _render(pairs) {
    var inner = document.getElementById('fx-ticker-inner');
    if (!inner) return;

    var html = pairs.map(_pairHTML).filter(Boolean).join('');
    if (!html) return;

    var trackW = (inner.parentElement || document.body).offsetWidth;

    /* ── الخطوة 1: ضع نسخة واحدة وقِس عرضها الحقيقي من inner ── */
    inner.style.animation = 'none';
    inner.style.transform = 'none';
    inner.innerHTML = html;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var oneW = inner.scrollWidth;
        if (!oneW || oneW < 10) return;

        /* ── الخطوة 2: ضاعف بعدد كافٍ لتغطية الشاشة + نسخة إضافية ── */
        /* نسخ كافية لتغطية الشاشة 4 مرات على الأقل — لا فراغ أبداً */
        var copies = Math.max(4, Math.ceil((trackW * 4) / oneW));
        var full = html;
        for (var i = 0; i < copies; i++) full += html;
        inner.innerHTML = full;

        /* ── الخطوة 3: keyframes تتحرك -oneW بالضبط ── */
        var styleEl = document.getElementById('fx-kf');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'fx-kf';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent =
          '@keyframes fxScroll{from{transform:translateX(0)}to{transform:translateX(-' + oneW + 'px)}}';

        var dur = (oneW / PX_PER_SEC).toFixed(2);

        requestAnimationFrame(function () {
          inner.style.animation = 'fxScroll ' + dur + 's linear infinite';
        });
      });
    });
  }

  function _fetch(url) {
    var btn = document.getElementById('fx-ticker-refresh');
    if (btn) btn.classList.add('spinning');
    fetch(url || API_URL, { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.success || !Array.isArray(d.pairs) || !d.pairs.length) return;
        d.pairs.forEach(function (p) { _prev[p.base + '_' + p.quote] = p.rate; });
        _render(d.pairs);
        setTimeout(function () { _fetch(API_FORCE); }, 3600000);
      })
      .catch(function (e) { console.warn('fx-ticker:', e); })
      .finally(function () { if (btn) btn.classList.remove('spinning'); });
  }

  function init() {
    if (!document.getElementById('fx-ticker-bar')) return;
    var btn = document.getElementById('fx-ticker-refresh');
    if (btn) btn.addEventListener('click', function () { _prev = {}; _fetch(API_FORCE); });
    _fetch(API_URL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.fxTickerRefresh = function () { _prev = {}; _fetch(API_FORCE); };
})();
