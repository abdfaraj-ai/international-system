"""
internal.py — إعدادات التشغيل الداخلي (شبكة الشركة المحلية)
استخدام: DJANGO_SETTINGS_MODULE=core.settings.internal

يُستخدم هذا الملف عند تشغيل النظام على جهاز داخلي في الشركة
متاح عبر الشبكة المحلية (LAN) لجميع الموظفين.
"""
import os
from pathlib import Path

# تحميل .env تلقائياً إن وُجد
_env_file = Path(__file__).resolve().parent.parent.parent / '.env'
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file)
    except ImportError:
        with open(_env_file, encoding='utf-8') as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith('#') and '=' in _line:
                    _k, _v = _line.split('=', 1)
                    os.environ.setdefault(_k.strip(), _v.strip())

from .base import *  # noqa

DEBUG = False

# ── ALLOWED_HOSTS ──────────────────────────────────────────────────────────────
_extra = os.environ.get('ALLOWED_HOSTS', '')
_extra_hosts = [h.strip() for h in _extra.split(',') if h.strip()]

# اكتشاف IP الخادم تلقائياً وإضافته
import socket as _socket
_local_ips = []
try:
    _s = _socket.socket(_socket.AF_INET, _socket.SOCK_DGRAM)
    _s.connect(('8.8.8.8', 80))
    _local_ips.append(_s.getsockname()[0])
    _s.close()
except Exception:
    pass

ALLOWED_HOSTS = (
    ['127.0.0.1', 'localhost']
    + _local_ips
    + _extra_hosts
)

# ── CSRF Trusted Origins ───────────────────────────────────────────────────────
# يشمل ngrok وأي نطاق خارجي يُستخدم للوصول للنظام
_trusted_raw = os.environ.get('CSRF_TRUSTED_ORIGINS', '')
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _trusted_raw.split(',') if o.strip()]

# ── قاعدة البيانات ────────────────────────────────────────────────────────────
# إذا كان DB_HOST مضبوطاً في .env → PostgreSQL
# وإلا → SQLite كاحتياط للتطوير السريع
_db_host = os.environ.get('DB_HOST', '')

if _db_host:
    DATABASES = {
        'default': {
            'ENGINE':   'django.db.backends.postgresql',
            'NAME':     os.environ.get('DB_NAME',     'intl_system_db'),
            'USER':     os.environ.get('DB_USER',     'intl_user'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST':     _db_host,
            'PORT':     os.environ.get('DB_PORT',     '5432'),
            'CONN_MAX_AGE': 60,   # إعادة استخدام الاتصال لمدة دقيقة
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ── الملفات الثابتة — WhiteNoise (ضغط + تخزين مؤقت) ──────────────────────────
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS  = False
CORS_ALLOWED_ORIGINS    = []   # لا حاجة لـ CORS على شبكة داخلية
CORS_ALLOW_CREDENTIALS  = True

# ── الأمان (بدون SSL على الشبكة الداخلية) ────────────────────────────────────
SECURE_BROWSER_XSS_FILTER   = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS             = 'SAMEORIGIN'
SECURE_SSL_REDIRECT         = False   # لا SSL داخلياً
SESSION_COOKIE_SECURE       = False
CSRF_COOKIE_SECURE          = False
CSRF_COOKIE_HTTPONLY        = False   # يحتاجه JS للقراءة

# ── الجلسة: تبقى نشطة طوال وردية عمل واحدة ──────────────────────────────────
SESSION_COOKIE_AGE          = 28800   # 8 ساعات (وردية كاملة)
SESSION_EXPIRE_AT_BROWSER_CLOSE = True   # تنتهي الجلسة عند إغلاق المتصفح

# ── Logging ────────────────────────────────────────────────────────────────────
_logs_dir = BASE_DIR / 'logs'
_logs_dir.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '[{asctime}] {levelname} {module}: {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
        'file': {
            'class':     'logging.handlers.RotatingFileHandler',
            'filename':  str(_logs_dir / 'app.log'),
            'maxBytes':  5 * 1024 * 1024,   # 5 MB
            'backupCount': 3,
            'formatter': 'standard',
            'encoding':  'utf-8',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'WARNING',
    },
    'loggers': {
        'django.request': {
            'handlers': ['console', 'file'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}
