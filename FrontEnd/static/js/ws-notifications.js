/**
 * ws-notifications.js — WebSocket الإشعارات الموحد
 * أضفه في كل صفحة تحتاج إشعارات فورية:
 *   <script src="/static/js/ws-notifications.js"></script>
 *
 * يُعالج تلقائياً:
 *   - notification      → toast شخصي
 *   - teller_request_response → رد المشرف على طلب التلر
 *   - accounts_transfer_new   → حوالة بنكية جديدة
 *   - rates_update            → يُشغّل حدث مخصص على window
 *   - teller_request_new      → يُشغّل حدث مخصص على window
 *   - portal_request_new      → يُشغّل حدث مخصص على window
 *   - teller_status           → يُشغّل حدث مخصص على window
 */
(function () {
    'use strict';

    var _ws = null;
    var _reconnectTimer = null;
    var _pingTimer = null;
    var _badgeCount = 0;

    // ── Toast Container ───────────────────────────────────────────────────────

    function _ensureContainer() {
        var c = document.getElementById('wsNotifContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'wsNotifContainer';
            c.style.cssText = [
                'position:fixed', 'top:70px', 'left:20px', 'z-index:99999',
                'display:flex', 'flex-direction:column', 'gap:8px',
                'max-width:340px', 'pointer-events:none'
            ].join(';');
            document.body.appendChild(c);
        }
        return c;
    }

    var LEVEL_STYLES = {
        info:    { bg: '#1e3a5f', border: '#3b7dd8', icon: 'ℹ️' },
        success: { bg: '#1a3a2a', border: '#2ecc71', icon: '✅' },
        warning: { bg: '#3a2a00', border: '#f39c12', icon: '⚠️' },
        error:   { bg: '#3a1a1a', border: '#e74c3c', icon: '❌' },
    };

    function showToast(title, message, level) {
        level = level || 'info';
        var s = LEVEL_STYLES[level] || LEVEL_STYLES.info;
        var c = _ensureContainer();

        var el = document.createElement('div');
        el.style.cssText = [
            'background:' + s.bg,
            'border-right:4px solid ' + s.border,
            'border-radius:8px',
            'padding:12px 14px',
            'color:#e8eaf0',
            'font-family:inherit',
            'font-size:13px',
            'direction:rtl',
            'pointer-events:all',
            'box-shadow:0 4px 16px rgba(0,0,0,.45)',
            'opacity:0',
            'transform:translateX(-20px)',
            'transition:all .3s ease',
            'cursor:pointer',
        ].join(';');

        el.innerHTML =
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:' + (message ? '4px' : '0') + '">' +
            '<span style="font-size:16px">' + s.icon + '</span>' +
            '<strong>' + (title || '') + '</strong>' +
            '</div>' +
            (message ? '<div style="opacity:.8;font-size:12px;padding-right:24px">' + message + '</div>' : '');

        el.onclick = function () { _dismissToast(el); };
        c.appendChild(el);

        requestAnimationFrame(function () {
            el.style.opacity = '1';
            el.style.transform = 'translateX(0)';
        });

        setTimeout(function () { _dismissToast(el); }, 5000);
        _updateBadge(1);
    }

    function _dismissToast(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-20px)';
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }

    // ── Badge (عداد الإشعارات) ────────────────────────────────────────────────

    function _updateBadge(delta) {
        _badgeCount = Math.max(0, _badgeCount + delta);
        var badge = document.getElementById('wsNotifBadge');
        if (badge) {
            badge.textContent = _badgeCount > 0 ? _badgeCount : '';
            badge.style.display = _badgeCount > 0 ? 'flex' : 'none';
        }
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    function _wsUrl() {
        var proto = location.protocol === 'https:' ? 'wss' : 'ws';
        return proto + '://' + location.host + '/ws/intl/';
    }

    function connect() {
        if (_ws && (_ws.readyState === WebSocket.CONNECTING || _ws.readyState === WebSocket.OPEN)) return;
        clearTimeout(_reconnectTimer);

        try { _ws = new WebSocket(_wsUrl()); } catch (e) { _scheduleReconnect(); return; }

        _ws.onopen = function () {
            clearTimeout(_reconnectTimer);
            _pingTimer = setInterval(function () {
                if (_ws && _ws.readyState === WebSocket.OPEN)
                    _ws.send(JSON.stringify({ type: 'ping' }));
            }, 25000);
        };

        _ws.onmessage = function (e) {
            var msg;
            try { msg = JSON.parse(e.data); } catch (ex) { return; }
            _handle(msg);
        };

        _ws.onclose = function () {
            clearInterval(_pingTimer);
            _scheduleReconnect();
        };

        _ws.onerror = function () { _ws.close(); };
    }

    function _scheduleReconnect() {
        clearTimeout(_reconnectTimer);
        _reconnectTimer = setTimeout(connect, 4000);
    }

    // ── معالج الرسائل ─────────────────────────────────────────────────────────

    function _handle(msg) {
        switch (msg.type) {

            case 'notification':
                showToast(msg.title, msg.message, msg.level);
                break;

            case 'teller_request_response':
                var req = msg.request || {};
                var isApproved = req.status === 'approved';
                showToast(
                    isApproved ? 'تمت الموافقة على طلبك' : 'تم رفض طلبك',
                    req.reply || '',
                    isApproved ? 'success' : 'error'
                );
                window.dispatchEvent(new CustomEvent('ws:teller_request_response', { detail: msg }));
                break;

            case 'accounts_transfer_new':
                showToast('حوالة بنكية جديدة', _transferSummary(msg.transfer), 'info');
                window.dispatchEvent(new CustomEvent('ws:accounts_transfer_new', { detail: msg }));
                break;

            case 'rates_update':
                window.dispatchEvent(new CustomEvent('ws:rates_update', { detail: msg }));
                break;

            case 'teller_request_new':
                showToast('طلب جديد من تلر', (msg.request || {}).text || '', 'warning');
                window.dispatchEvent(new CustomEvent('ws:teller_request_new', { detail: msg }));
                break;

            case 'portal_request_new':
                showToast('طلب بوابة جديد', _portalSummary(msg.request), 'info');
                window.dispatchEvent(new CustomEvent('ws:portal_request_new', { detail: msg }));
                break;

            case 'teller_status':
                window.dispatchEvent(new CustomEvent('ws:teller_status', { detail: msg }));
                break;

            case 'voice_result':
                window.dispatchEvent(new CustomEvent('ws:voice_result', { detail: msg }));
                break;

            case 'voice_rates':
                window.dispatchEvent(new CustomEvent('ws:voice_rates', { detail: msg }));
                break;
        }
    }

    function _transferSummary(t) {
        if (!t) return '';
        return (t.senderName || '') + ' ← ' + (t.amount || '') + ' ' + (t.currency || '');
    }

    function _portalSummary(r) {
        if (!r) return '';
        return (r.beneficiary || r.name || '') + ' — ' + (r.amount || '') + ' ' + (r.currency || '');
    }

    // ── تشغيل تلقائي ─────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }

    // ── API عامة ─────────────────────────────────────────────────────────────

    window.WsNotif = {
        showToast: showToast,
        connect: connect,
        resetBadge: function () { _badgeCount = 0; _updateBadge(0); },
    };

})();
