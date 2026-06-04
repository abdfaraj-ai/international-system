  // ═══════════════════════════════════════
    // الساعة والتاريخ
    // ═══════════════════════════════════════
    function updateClock() {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString('ar-EG-u-nu-latn', { hour12: false });
        document.getElementById('date').textContent = now.toLocaleDateString('ar-EG-u-nu-latn', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // تحديث الأرقام عشوائياً
    setInterval(() => {
        const online = 20 + Math.floor(Math.random() * 10);
        const elOnline = document.getElementById('onlineUsers');
        const elText   = document.getElementById('onlineText');
        const elTx     = document.getElementById('todayTx');
        if (elOnline) elOnline.textContent = online;
        if (elText)   elText.textContent   = `${online} مستخدم نشط حالياً في النظام`;
        if (elTx)     elTx.textContent     = 180 + Math.floor(Math.random() * 20);
    }, 8000);

    // ═══════════════════════════════════════
    // الجزيئات المتحركة
    // ═══════════════════════════════════════
    const canvas = document.getElementById('particles');
    const ctx = canvas.getContext('2d');
    let particlesArray = [];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.opacity = Math.random() * 0.3 + 0.05;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x > canvas.width) this.x = 0;
            if (this.x < 0) this.x = canvas.width;
            if (this.y > canvas.height) this.y = 0;
            if (this.y < 0) this.y = canvas.height;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(50, 184, 198, ${this.opacity})`;
            ctx.fill();
        }
    }

    function initParticles() {
        particlesArray = [];
        const count = Math.min(80, Math.floor(canvas.width * canvas.height / 15000));
        for (let i = 0; i < count; i++) {
            particlesArray.push(new Particle());
        }
    }
    initParticles();

    function connectParticles() {
        for (let a = 0; a < particlesArray.length; a++) {
            for (let b = a + 1; b < particlesArray.length; b++) {
                const dx = particlesArray[a].x - particlesArray[b].x;
                const dy = particlesArray[a].y - particlesArray[b].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(50, 184, 198, ${0.04 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particlesArray.forEach(p => { p.update(); p.draw(); });
        connectParticles();
        requestAnimationFrame(animateParticles);
    }
    animateParticles();

    // ═══════════════════════════════════════
    // الحالة
    // ═══════════════════════════════════════
    let selectedRole = null;
    let rememberMe = false;

    // ═══════════════════════════════════════
    // اختيار الدور
    // ═══════════════════════════════════════
    window.setRole = function(btn, role) {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedRole = role;
        document.getElementById('username').focus();
        showToast(`تم اختيار: ${role}`, 'info', '💡');
    }

    // ═══════════════════════════════════════
    // إظهار/إخفاء كلمة المرور
    // ═══════════════════════════════════════
    window.togglePassword = function() {
        const passInput = document.getElementById('password');
        const btn = document.querySelector('.toggle-pass');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            btn.textContent = '🙈';
        } else {
            passInput.type = 'password';
            btn.textContent = '👁️';
        }
    }

    // ═══════════════════════════════════════
    // تذكرني
    // ═══════════════════════════════════════
    window.toggleRemember = function() {
        rememberMe = !rememberMe;
        const check = document.getElementById('rememberCheck');
        check.classList.toggle('checked', rememberMe);
    }

    // ═══════════════════════════════════════
    // الإرسال
    // ═══════════════════════════════════════
    window.handleSubmit = function() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const btn = document.getElementById('mainBtn');

        // التحقق
        if (!selectedRole) {
            showToast('يرجى اختيار صلاحيتك أولاً', 'warning', '⚠️');
            shakeElement(document.querySelector('.roles-grid'));
            return;
        }

        if (!username) {
            showToast('يرجى إدخال اسم المستخدم', 'error', '❌');
            shakeElement(document.getElementById('username'));
            document.getElementById('username').classList.add('error');
            setTimeout(() => document.getElementById('username').classList.remove('error'), 2000);
            return;
        }

        if (!password) {
            showToast('يرجى إدخال كلمة المرور', 'error', '❌');
            shakeElement(document.getElementById('password'));
            document.getElementById('password').classList.add('error');
            setTimeout(() => document.getElementById('password').classList.remove('error'), 2000);
            return;
        }

        // تحميل
        btn.classList.add('loading');

        // ── تسجيل الدخول عبر API ──
        const csrfToken = (document.cookie.split(';').find(c => c.trim().startsWith('csrftoken=')) || '').split('=')[1] || '';

        fetch('/api/login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            credentials: 'same-origin',
            body: JSON.stringify({ username, password, role: selectedRole }),
        })
        .then(r => r.json())
        .then(data => {
            btn.classList.remove('loading');
            if (data.success) {
                if (data.requires_2fa) {
                    show2FAModal();
                    return;
                }
                const ROLE_PAGES = {
                    'M01': '/dashboard/',
                    'M02': '/supervisor/teller/',
                    'M03': '/transactions/supervisor/',
                    'T01': '/teller/', 'T02': '/accounts/', 'T03': '/transactions/'
                };
                showToast('تم تسجيل الدخول بنجاح! جاري التحويل...', 'success', String.fromCodePoint(0x2705));
                setTimeout(function() {
                    const targetPage = data.home || ROLE_PAGES[selectedRole];
                    if (targetPage) window.location.href = targetPage;
                }, 800);
            } else {
                showToast(data.error || 'خطأ في تسجيل الدخول', 'error', '❌');
                shakeElement(document.getElementById('username'));
            }
        })
        .catch(() => {
            btn.classList.remove('loading');
            showToast('تعذّر الاتصال بالسيرفر، يرجى المحاولة مجدداً', 'error', '❌');
        });
    }

    // ═══════════════════════════════════════
    // دخول بصلاحية موظف (Impersonate) — للمدير فقط
    // ═══════════════════════════════════════
    function openImpersonateModal() {
        const m = document.getElementById('impersonateModal');
        if (m) { m.style.display = 'flex'; document.getElementById('impUser').focus(); }
    }

    function closeImpersonateModal() {
        const m = document.getElementById('impersonateModal');
        if (m) m.style.display = 'none';
        // إذا أغلق المدير النافذة دون اختيار موظف — اذهب للداشبورد
        window.location.href = '/dashboard/';
    }

    function doImpersonate() {
        const username = document.getElementById('impUser').value.trim();
        const password = document.getElementById('impPass').value.trim();
        const btn = document.getElementById('impBtn');

        if (!username || !password) {
            showToast('يرجى إدخال بيانات الموظف', 'warning', '⚠️');
            return;
        }

        btn.classList.add('loading');
        const csrfToken = (document.cookie.split(';').find(c => c.trim().startsWith('csrftoken=')) || '').split('=')[1] || '';

        fetch('/api/impersonate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            credentials: 'same-origin',
            body: JSON.stringify({ username, password }),
        })
        .then(r => r.json())
        .then(data => {
            btn.classList.remove('loading');
            if (data.success) {
                showToast('جاري الدخول بصلاحية ' + (data.name || data.username) + '...', 'success', '🔑');
                setTimeout(function() {
                    window.location.href = data.home || '/dashboard/';
                }, 800);
            } else {
                showToast(data.error || 'خطأ في البيانات', 'error', '❌');
            }
        })
        .catch(() => {
            btn.classList.remove('loading');
            showToast('تعذّر الاتصال بالسيرفر', 'error', '❌');
        });
    }

    // ═══════════════════════════════════════
    // نافذة نسيت كلمة المرور
    // ═══════════════════════════════════════
    window.showForgotModal = function() {
        document.getElementById('forgotModal').classList.add('visible');
    }

    window.closeForgotModal = function() {
        document.getElementById('forgotModal').classList.remove('visible');
    }

    window.handleForgot = function() {
        const username = document.getElementById('forgotUsername').value.trim();
        if (!username) {
            showToast('يرجى إدخال اسم المستخدم', 'error', '❌');
            return;
        }

        fetch('/api/forgot-password/', {
            method:  'POST',
            headers: {'Content-Type': 'application/json'},
            body:    JSON.stringify({ username }),
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast(data.message || 'تم إرسال رابط الاستعادة إلى بريدك الإلكتروني', 'success', '📧');
                setTimeout(closeForgotModal, 2000);
            } else {
                showToast(data.error || 'حدث خطأ', 'error', '❌');
            }
        })
        .catch(() => showToast('تعذر الاتصال بالسيرفر', 'error', '❌'));
    }

    // إغلاق بالنقر خارج النافذة
    document.getElementById('forgotModal').addEventListener('click', function(e) {
        if (e.target === this) closeForgotModal();
    });

    // ═══════════════════════════════════════
    // تأثير الاهتزاز
    // ═══════════════════════════════════════
    function shakeElement(el) {
        el.style.transition = 'none';
        el.style.animation = 'none';
        el.offsetHeight; // reflow
        el.style.animation = 'shake 0.5s ease';
    }

    // إضافة keyframe الاهتزاز
    const shakeStyle = document.createElement('style');
    shakeStyle.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-5px); }
            80% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(shakeStyle);

    // ═══════════════════════════════════════
    // الإشعارات (Toast)
    // ═══════════════════════════════════════
    function showToast(message, type = 'info', icon = null) {
        const defaultIcons = { success: '✅', error: '❌', warning: '⚠️', info: '💎' };
        const finalIcon = icon || defaultIcons[type] || 'ℹ️';

        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-body">
                <div class="toast-icon-wrap">${finalIcon}</div>
                <span class="toast-text">${message}</span>
            </div>
            <button class="toast-close" onclick="this.closest('.toast').classList.add('exit'); setTimeout(()=>this.closest('.toast').remove(),280)">✕</button>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('exit');
            setTimeout(() => toast.remove(), 280);
        }, 3800);
    }

    // ═══════════════════════════════════════
    // اختصارات لوحة المفاتيح
    // ═══════════════════════════════════════
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (document.getElementById('forgotModal').classList.contains('visible')) {
                handleForgot();
            } else {
                handleSubmit();
            }
        }
        if (e.key === 'Escape') {
            if (document.getElementById('forgotModal').classList.contains('visible')) {
                closeForgotModal();
            }
        }
    });

    // ═══════════════════════════════════════
    // تأثير التركيز على الحقول
    // ═══════════════════════════════════════
    document.querySelectorAll('.input-group input').forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.style.transform = 'scale(1.01)';
        });
        input.addEventListener('blur', () => {
            input.parentElement.style.transform = 'scale(1)';
        });
    });

    function toggleTheme() { /* dark mode only */ }


    // رسالة ترحيب
    setTimeout(() => {
        showToast('مرحباً بك في شركة انترناشونال للخدمات المالية والمجوهرات', 'info', '💎');
    }, 1200);


    // ═══════════════════════════════════════
    // Google Authenticator — TOTP Engine
    // ═══════════════════════════════════════

    let pending2FAUser = null;

    function _csrf() {
        return (document.cookie.split(';').find(c => c.trim().startsWith('csrftoken=')) || '').split('=')[1] || '';
    }

        function show2FAModal() {
        document.getElementById('twoFAModal').style.display = 'flex';
        document.getElementById('qrSetupStep').style.display = 'none';
        document.getElementById('codeInputStep').style.display = 'block';
        document.getElementById('totpInput').value = '';
        setTimeout(function() { document.getElementById('totpInput').focus(); }, 100);
    }

    window.confirmQRScanned = function() {
        document.getElementById('qrSetupStep').style.display = 'none';
        document.getElementById('codeInputStep').style.display = 'block';
        setTimeout(function() { document.getElementById('totpInput').focus(); }, 100);
    }

    window.verify2FA = async function() {
        const code = document.getElementById('totpInput').value.trim();
        if (code.length !== 6) {
            showToast('أدخل 6 أرقام من التطبيق', 'error', '❌');
            return;
        }
        const btn = document.getElementById('verifyBtn');
        btn.classList.add('loading');

        try {
            const res = await fetch('/api/2fa/verify/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': _csrf() },
                body: JSON.stringify({ code }),
            });
            const data = await res.json();
            btn.classList.remove('loading');

            if (data.success) {
                document.getElementById('twoFAModal').style.display = 'none';
                showToast('تم التحقق بنجاح! جاري التحويل...', 'success', '✅');
                setTimeout(function() {
                    window.location.href = data.redirect || '/';
                }, 800);
            } else {
                showToast(data.message || 'الكود غير صحيح', 'error', '❌');
                document.getElementById('totpInput').value = '';
                document.getElementById('totpInput').focus();
            }
        } catch (e) {
            btn.classList.remove('loading');
            showToast('تعذّر الاتصال بالسيرفر', 'error', '❌');
        }
    }

    window.close2FAModal = function() {
        document.getElementById('twoFAModal').style.display = 'none';
        document.getElementById('totpInput').value = '';
    }
