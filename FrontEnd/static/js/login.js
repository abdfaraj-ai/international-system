  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ø§Ù„Ø³Ø§Ø¹Ø© ÙˆØ§Ù„ØªØ§Ø±ÙŠØ®
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function updateClock() {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString('ar-EG-u-nu-latn', { hour12: false });
        document.getElementById('date').textContent = now.toLocaleDateString('ar-EG-u-nu-latn', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø£Ø±Ù‚Ø§Ù… Ø¹Ø´ÙˆØ§Ø¦ÙŠØ§Ù‹
    setInterval(() => {
        const online = 20 + Math.floor(Math.random() * 10);
        const elOnline = document.getElementById('onlineUsers');
        const elText   = document.getElementById('onlineText');
        const elTx     = document.getElementById('todayTx');
        if (elOnline) elOnline.textContent = online;
        if (elText)   elText.textContent   = `${online} Ù…Ø³ØªØ®Ø¯Ù… Ù†Ø´Ø· Ø­Ø§Ù„ÙŠØ§Ù‹ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…`;
        if (elTx)     elTx.textContent     = 180 + Math.floor(Math.random() * 20);
    }, 8000);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ø§Ù„Ø¬Ø²ÙŠØ¦Ø§Øª Ø§Ù„Ù…ØªØ­Ø±ÙƒØ©
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ø§Ù„Ø­Ø§Ù„Ø©
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    let selectedRole = null;
    let rememberMe = false;

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ø¯ÙˆØ±
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    window.setRole = function(btn, role) {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedRole = role;
        document.getElementById('username').focus();
        showToast(`ØªÙ… Ø§Ø®ØªÙŠØ§Ø±: ${role}`, 'info', 'ðŸ’¡');
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ø¥Ø¸Ù‡Ø§Ø±/Ø¥Ø®ÙØ§Ø¡ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    window.togglePassword = function() {
        const passInput = document.getElementById('password');
        const btn = document.querySelector('.toggle-pass');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            btn.textContent = 'ðŸ™ˆ';
        } else {
            passInput.type = 'password';
            btn.textContent = 'ðŸ‘ï¸';
        }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ØªØ°ÙƒØ±Ù†ÙŠ
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    window.toggleRemember = function() {
        rememberMe = !rememberMe;
        const check = document.getElementById('rememberCheck');
        check.classList.toggle('checked', rememberMe);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ø§Ù„Ø¥Ø±Ø³Ø§Ù„
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    window.handleSubmit = function() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const btn = document.getElementById('mainBtn');

        // Ø§Ù„ØªØ­Ù‚Ù‚
        if (!selectedRole) {
            showToast('ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± ØµÙ„Ø§Ø­ÙŠØªÙƒ Ø£ÙˆÙ„Ø§Ù‹', 'warning', 'âš ï¸');
            shakeElement(document.querySelector('.roles-grid'));
            return;
        }

        if (!username) {
            showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…', 'error', 'âŒ');
            shakeElement(document.getElementById('username'));
            document.getElementById('username').classList.add('error');
            setTimeout(() => document.getElementById('username').classList.remove('error'), 2000);
            return;
        }

        if (!password) {
            showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±', 'error', 'âŒ');
            shakeElement(document.getElementById('password'));
            document.getElementById('password').classList.add('error');
            setTimeout(() => document.getElementById('password').classList.remove('error'), 2000);
            return;
        }

        // ØªØ­Ù…ÙŠÙ„
        btn.classList.add('loading');

        // â”€â”€ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¹Ø¨Ø± API â”€â”€
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
                showToast('ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ù†Ø¬Ø§Ø­! Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­ÙˆÙŠÙ„...', 'success', String.fromCodePoint(0x2705));
                setTimeout(function() {
                    const targetPage = data.home || ROLE_PAGES[selectedRole];
                    if (targetPage) window.location.href = targetPage;
                }, 800);
            } else {
                showToast(data.error || 'Ø®Ø·Ø£ ÙÙŠ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„', 'error', 'âŒ');
                shakeElement(document.getElementById('username'));
            }
        })
        .catch(() => {
            btn.classList.remove('loading');
            showToast('ØªØ¹Ø°Ù‘Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø³ÙŠØ±ÙØ±ØŒ ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø¬Ø¯Ø¯Ø§Ù‹', 'error', 'âŒ');
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ø¯Ø®ÙˆÙ„ Ø¨ØµÙ„Ø§Ø­ÙŠØ© Ù…ÙˆØ¸Ù (Impersonate) â€” Ù„Ù„Ù…Ø¯ÙŠØ± ÙÙ‚Ø·
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function openImpersonateModal() {
        const m = document.getElementById('impersonateModal');
        if (m) { m.style.display = 'flex'; document.getElementById('impUser').focus(); }
    }

    function closeImpersonateModal() {
        const m = document.getElementById('impersonateModal');
        if (m) m.style.display = 'none';
        // Ø¥Ø°Ø§ Ø£ØºÙ„Ù‚ Ø§Ù„Ù…Ø¯ÙŠØ± Ø§Ù„Ù†Ø§ÙØ°Ø© Ø¯ÙˆÙ† Ø§Ø®ØªÙŠØ§Ø± Ù…ÙˆØ¸Ù â€” Ø§Ø°Ù‡Ø¨ Ù„Ù„Ø¯Ø§Ø´Ø¨ÙˆØ±Ø¯
        window.location.href = '/dashboard/';
    }

    function doImpersonate() {
        const username = document.getElementById('impUser').value.trim();
        const password = document.getElementById('impPass').value.trim();
        const btn = document.getElementById('impBtn');

        if (!username || !password) {
            showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ¸Ù', 'warning', 'âš ï¸');
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
                showToast('Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨ØµÙ„Ø§Ø­ÙŠØ© ' + (data.name || data.username) + '...', 'success', 'ðŸ”‘');
                setTimeout(function() {
                    window.location.href = data.home || '/dashboard/';
                }, 800);
            } else {
                showToast(data.error || 'Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª', 'error', 'âŒ');
            }
        })
        .catch(() => {
            btn.classList.remove('loading');
            showToast('ØªØ¹Ø°Ù‘Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø³ÙŠØ±ÙØ±', 'error', 'âŒ');
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ù†Ø§ÙØ°Ø© Ù†Ø³ÙŠØª ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    window.showForgotModal = function() {
        document.getElementById('forgotModal').classList.add('visible');
    };

    window.closeForgotModal = function() {
        document.getElementById('forgotModal').classList.remove('visible');
    };

    window.handleForgot = function() {
        const username = document.getElementById('forgotUsername').value.trim();
        if (!username) {
            showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…', 'error', 'âŒ');
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
                showToast(data.message || 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø§Ø¨Ø· Ø§Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø¥Ù„Ù‰ Ø¨Ø±ÙŠØ¯Ùƒ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ', 'success', 'ðŸ“§');
                setTimeout(window.closeForgotModal, 2000);
            } else {
                showToast(data.error || 'Ø­Ø¯Ø« Ø®Ø·Ø£', 'error', 'âŒ');
            }
        })
        .catch(() => showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø³ÙŠØ±ÙØ±', 'error', 'âŒ'));
    };

    // Ø¥ØºÙ„Ø§Ù‚ Ø¨Ø§Ù„Ù†Ù‚Ø± Ø®Ø§Ø±Ø¬ Ø§Ù„Ù†Ø§ÙØ°Ø©
    document.getElementById('forgotModal').addEventListener('click', function(e) {
        if (e.target === this) closeForgotModal();
    });

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ØªØ£Ø«ÙŠØ± Ø§Ù„Ø§Ù‡ØªØ²Ø§Ø²
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function shakeElement(el) {
        el.style.transition = 'none';
        el.style.animation = 'none';
        el.offsetHeight; // reflow
        el.style.animation = 'shake 0.5s ease';
    }

    // Ø¥Ø¶Ø§ÙØ© keyframe Ø§Ù„Ø§Ù‡ØªØ²Ø§Ø²
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª (Toast)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function showToast(message, type = 'info', icon = null) {
        const defaultIcons = { success: 'âœ…', error: 'âŒ', warning: 'âš ï¸', info: 'ðŸ’Ž' };
        const finalIcon = icon || defaultIcons[type] || 'â„¹ï¸';

        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-body">
                <div class="toast-icon-wrap">${finalIcon}</div>
                <span class="toast-text">${message}</span>
            </div>
            <button class="toast-close" onclick="this.closest('.toast').classList.add('exit'); setTimeout(()=>this.closest('.toast').remove(),280)">âœ•</button>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('exit');
            setTimeout(() => toast.remove(), 280);
        }, 3800);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Ø§Ø®ØªØµØ§Ø±Ø§Øª Ù„ÙˆØ­Ø© Ø§Ù„Ù…ÙØ§ØªÙŠØ­
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ØªØ£Ø«ÙŠØ± Ø§Ù„ØªØ±ÙƒÙŠØ² Ø¹Ù„Ù‰ Ø§Ù„Ø­Ù‚ÙˆÙ„
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    document.querySelectorAll('.input-group input').forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.style.transform = 'scale(1.01)';
        });
        input.addEventListener('blur', () => {
            input.parentElement.style.transform = 'scale(1)';
        });
    });

    function toggleTheme() { /* dark mode only */ }


    // Ø±Ø³Ø§Ù„Ø© ØªØ±Ø­ÙŠØ¨
    setTimeout(() => {
        showToast('Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø¨Ùƒ ÙÙŠ Ø´Ø±ÙƒØ© Ø§Ù†ØªØ±Ù†Ø§Ø´ÙˆÙ†Ø§Ù„ Ù„Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„Ù…Ø§Ù„ÙŠØ© ÙˆØ§Ù„Ù…Ø¬ÙˆÙ‡Ø±Ø§Øª', 'info', 'ðŸ’Ž');
    }, 1200);


    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Google Authenticator â€” TOTP Engine
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
            showToast('Ø£Ø¯Ø®Ù„ 6 Ø£Ø±Ù‚Ø§Ù… Ù…Ù† Ø§Ù„ØªØ·Ø¨ÙŠÙ‚', 'error', 'âŒ');
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
                showToast('ØªÙ… Ø§Ù„ØªØ­Ù‚Ù‚ Ø¨Ù†Ø¬Ø§Ø­! Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­ÙˆÙŠÙ„...', 'success', 'âœ…');
                setTimeout(function() {
                    window.location.href = data.redirect || '/';
                }, 800);
            } else {
                showToast(data.message || 'Ø§Ù„ÙƒÙˆØ¯ ØºÙŠØ± ØµØ­ÙŠØ­', 'error', 'âŒ');
                document.getElementById('totpInput').value = '';
                document.getElementById('totpInput').focus();
            }
        } catch (e) {
            btn.classList.remove('loading');
            showToast('ØªØ¹Ø°Ù‘Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø³ÙŠØ±ÙØ±', 'error', 'âŒ');
        }
    }

    window.close2FAModal = function() {
        document.getElementById('twoFAModal').style.display = 'none';
        document.getElementById('totpInput').value = '';
    }
