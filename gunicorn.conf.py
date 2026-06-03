# ══════════════════════════════════════════════════════════════
#  gunicorn.conf.py — إعدادات خادم Gunicorn للإنتاج
# ══════════════════════════════════════════════════════════════
import multiprocessing

# ── الاتصال ───────────────────────────────────────────────────
# Railway يمرر PORT كمتغير بيئة — نقرأه وإلا نستخدم 8000
import os as _os
bind             = f"0.0.0.0:{_os.environ.get('PORT', '8000')}"
backlog          = 512

# ── العمال (Workers) ──────────────────────────────────────────
# القاعدة الموصى بها: (2 × عدد المعالجات) + 1
workers          = multiprocessing.cpu_count() * 2 + 1
worker_class     = "sync"
worker_connections = 1000
timeout          = 120          # ثانية قبل إعادة تشغيل العامل
graceful_timeout = 30
keepalive        = 5

# ── الأداء ───────────────────────────────────────────────────
max_requests         = 1000     # إعادة تشغيل العامل بعد N طلب (يمنع memory leaks)
max_requests_jitter  = 100      # عشوائية لمنع إعادة التشغيل في نفس الوقت
preload_app          = True     # تحميل التطبيق قبل fork → أسرع

# ── السجلات ───────────────────────────────────────────────────
# على Railway نرسل السجلات لـ stdout حتى تظهر في لوحة التحكم
accesslog        = "-"
errorlog         = "-"
loglevel         = "warning"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)sµs'

# ── الأمان ───────────────────────────────────────────────────
limit_request_line   = 4096
limit_request_fields = 100
forwarded_allow_ips  = "*"  # Railway يمرر الطلبات عبر proxy داخلي

# ── PID ──────────────────────────────────────────────────────
pidfile = "/tmp/gunicorn.pid"
