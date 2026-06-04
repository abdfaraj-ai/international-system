"""
prod.py — إعدادات بيئة الإنتاج
استخدام: DJANGO_SETTINGS_MODULE=core.settings.prod
"""
import os
import urllib.parse
from .base import *  # noqa

DEBUG = False

ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', '*').split(',') if h.strip()]

CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']  # إلزامي في الإنتاج

# ── الملفات الثابتة (WhiteNoise) ─────────────────────────────────────────────
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# WhiteNoise يُضاف بعد SecurityMiddleware مباشرةً
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')  # noqa: F821

# ── قاعدة البيانات (PostgreSQL للإنتاج) ──────────────────────────────────────
# Railway يرسل DATABASE_URL تلقائياً — نقرأه أولاً، وإلا نستخدم المتغيرات المنفصلة
_db_url = os.environ.get('DATABASE_URL', '')
if _db_url:
    _u = urllib.parse.urlparse(_db_url)
    _db_name = _u.path.lstrip('/')
    _db_user = _u.username or 'postgres'
    _db_pass = _u.password or ''
    _db_host = _u.hostname or 'localhost'
    _db_port = str(_u.port or 5432)
else:
    _db_name = os.environ.get('DB_NAME',     'international_db')
    _db_user = os.environ.get('DB_USER',     'postgres')
    _db_pass = os.environ.get('DB_PASSWORD', '')
    _db_host = os.environ.get('DB_HOST',     'localhost')
    _db_port = os.environ.get('DB_PORT',     '5432')

DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME':     _db_name,
        'USER':     _db_user,
        'PASSWORD': _db_pass,
        'HOST':     _db_host,
        'PORT':     _db_port,
        'OPTIONS':  {
            'sslmode':  os.environ.get('DB_SSLMODE', 'prefer'),  # 'require' إذا كان DB على سيرفر منفصل
            'connect_timeout': 10,
        },
        'CONN_MAX_AGE': 60,  # إعادة استخدام الاتصال لتقليل التعرض
    }
}

# ── البريد الإلكتروني (Gmail) ─────────────────────────────────────────────────
# Railway يحظر منفذ 587 (TLS) — نستخدم 465 (SSL) افتراضياً
EMAIL_BACKEND        = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST           = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT           = int(os.environ.get('EMAIL_PORT', 465))
EMAIL_USE_SSL        = os.environ.get('EMAIL_USE_SSL', 'true').lower() == 'true'
EMAIL_USE_TLS        = not EMAIL_USE_SSL
EMAIL_HOST_USER      = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD  = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_TIMEOUT        = 20
DEFAULT_FROM_EMAIL   = os.environ.get('EMAIL_HOST_USER', 'noreply@international-system.com')

# ── CORS (مقيّد للإنتاج) ──────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS   = [o for o in os.environ.get('CORS_ORIGINS', '').split(',') if o.strip()]
CORS_ALLOW_CREDENTIALS = True

# ── الأمان — حماية من MITM وهجمات التنصت ────────────────────────────────────

# HTTPS إلزامي — يمنع تخفيض الاتصال لـ HTTP
SECURE_SSL_REDIRECT             = False  # Railway proxy handles HTTPS
SECURE_SSL_HOST                 = os.environ.get('ALLOWED_HOSTS', '').split(',')[0].strip() or None

# HSTS — يخبر المتصفح بعدم قبول HTTP أبداً لمدة سنة
SECURE_HSTS_SECONDS             = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS  = True
SECURE_HSTS_PRELOAD             = True          # للتسجيل في قائمة HSTS Preload

# منع Sniffing نوع المحتوى
SECURE_CONTENT_TYPE_NOSNIFF     = True
SECURE_BROWSER_XSS_FILTER       = True

# Clickjacking protection
X_FRAME_OPTIONS                 = 'DENY'

# Referrer — لا نكشف URL الداخلية لمواقع خارجية
SECURE_REFERRER_POLICY          = 'strict-origin-when-cross-origin'

# Session Cookie — لا يُرسَل إلا عبر HTTPS ولا يقرأه JS
SESSION_COOKIE_SECURE           = True
SESSION_COOKIE_HTTPONLY         = True
SESSION_COOKIE_SAMESITE         = 'Lax'
SESSION_COOKIE_AGE              = 28800          # 8 ساعات

# CSRF Cookie — لا يُرسَل إلا عبر HTTPS
CSRF_COOKIE_SECURE              = True
CSRF_COOKIE_HTTPONLY            = True

# قبول Proxy Headers من Nginx فقط
SECURE_PROXY_SSL_HEADER         = ('HTTP_X_FORWARDED_PROTO', 'https')

# ── Logging (ملفات في الإنتاج) ───────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'class':     'logging.FileHandler',
            'filename':  BASE_DIR / 'logs' / 'django.log',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['file'],
        'level': 'WARNING',
    },
}
