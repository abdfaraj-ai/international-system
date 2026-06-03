"""
dev.py — إعدادات بيئة التطوير
استخدام: DJANGO_SETTINGS_MODULE=core.settings.dev
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
        # python-dotenv غير مثبت — تحميل يدوي بسيط
        with open(_env_file, encoding='utf-8') as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith('#') and '=' in _line:
                    _k, _v = _line.split('=', 1)
                    os.environ.setdefault(_k.strip(), _v.strip())

from .base import *  # noqa

DEBUG = True

# استخدم SMTP إذا كانت بيانات البريد موجودة، وإلا اطبع في الـ terminal
EMAIL_BACKEND = (
    'django.core.mail.backends.smtp.EmailBackend'
    if os.environ.get('EMAIL_HOST_PASSWORD')
    else 'django.core.mail.backends.console.EmailBackend'
)

ALLOWED_HOSTS = ['127.0.0.1', 'localhost', '::1', '192.168.1.26']

# ── قاعدة البيانات (PostgreSQL) ───────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME':     'international_db',
        'USER':     'postgres',
        'PASSWORD': 'international',
        'HOST':     'localhost',
        'PORT':     '5432',
    }
}

# ── CORS (مفتوح للتطوير) ──────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS  = True
CORS_ALLOW_CREDENTIALS  = True

# ── Logging (تفاصيل في التطوير) ──────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}
