"""
base.py — الإعدادات المشتركة بين جميع البيئات
"""
from pathlib import Path
import os
from dotenv import load_dotenv

# المسار الجذري للمشروع (مستويان فوق هذا الملف: core/settings/base.py → ROOT)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# تحميل ملف .env من جذر المشروع
load_dotenv(BASE_DIR / '.env')

# يجب ضبط DJANGO_SECRET_KEY كمتغير بيئة في ملف .env أو في إعدادات الخادم
# لإنشاء مفتاح جديد: python -c "import secrets; print(secrets.token_urlsafe(50))"
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(
        'DJANGO_SECRET_KEY غير مضبوط. أضفه كمتغير بيئة قبل تشغيل الخادم.'
    )

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'channels',
    'apps.pages',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'core.middleware.ApiRateLimitMiddleware',   # حماية API من الاستدعاء المفرط
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'FrontEnd' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.template.context_processors.static',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION  = 'core.asgi.application'

# ── WebSocket Channel Layer (InMemory — بدون Redis) ───────────────────────────
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# ── المصادقة ──────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'pages.SystemUser'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 12},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'core.validators.PasswordComplexityValidator',
    },
]

LOGIN_URL = '/login/'

# ── الجلسة ────────────────────────────────────────────────────────────────────
SESSION_COOKIE_AGE        = 28800   # 8 ساعات
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

# ── اللغة والتوقيت ────────────────────────────────────────────────────────────
LANGUAGE_CODE = 'ar'
TIME_ZONE     = 'Asia/Jerusalem'
USE_I18N      = True
USE_TZ        = True

# ── الملفات الثابتة ───────────────────────────────────────────────────────────
STATIC_URL       = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'FrontEnd' / 'static']
STATIC_ROOT      = BASE_DIR / 'staticfiles'

# ── الوسائط ───────────────────────────────────────────────────────────────────
MEDIA_URL  = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Logging المنظم ────────────────────────────────────────────────────────────
import logging, os as _os
_LOGS_DIR = BASE_DIR / 'logs'
_LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    'formatters': {
        # نص بشري للتطوير
        'verbose': {
            'format': '[{levelname}] {asctime} {module}:{lineno} — {message}',
            'style':  '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        # JSON مضغوط للإنتاج (سهل التحليل بأدوات المراقبة)
        'json': {
            '()': 'django.utils.log.ServerFormatter',
            'format': '{{"time":"{asctime}","level":"{levelname}","module":"{module}",'
                      '"line":{lineno},"msg":{message!r}}}',
            'style': '{',
        },
    },

    'filters': {
        'require_debug_false': {'()': 'django.utils.log.RequireDebugFalse'},
        'require_debug_true':  {'()': 'django.utils.log.RequireDebugTrue'},
    },

    'handlers': {
        # كونسول للتطوير فقط
        'console': {
            'class':     'logging.StreamHandler',
            'formatter': 'verbose',
            'filters':   ['require_debug_true'],
        },
        # ملف دوار للأخطاء (5 MB × 5 نسخ)
        'file_error': {
            'class':       'logging.handlers.RotatingFileHandler',
            'filename':    str(_LOGS_DIR / 'errors.log'),
            'maxBytes':    5 * 1024 * 1024,
            'backupCount': 5,
            'formatter':   'verbose',
            'level':       'ERROR',
        },
        # ملف دوار لكل الأحداث
        'file_info': {
            'class':       'logging.handlers.RotatingFileHandler',
            'filename':    str(_LOGS_DIR / 'app.log'),
            'maxBytes':    10 * 1024 * 1024,
            'backupCount': 3,
            'formatter':   'verbose',
            'level':       'INFO',
        },
        # ملف خاص بطلبات الأمان (login/logout/403/429)
        'file_security': {
            'class':       'logging.handlers.RotatingFileHandler',
            'filename':    str(_LOGS_DIR / 'security.log'),
            'maxBytes':    5 * 1024 * 1024,
            'backupCount': 5,
            'formatter':   'verbose',
            'level':       'INFO',
        },
    },

    'loggers': {
        # Django الأساسي
        'django': {
            'handlers': ['console', 'file_error'],
            'level':    'WARNING',
            'propagate': False,
        },
        # طلبات HTTP
        'django.request': {
            'handlers': ['file_error', 'console'],
            'level':    'ERROR',
            'propagate': False,
        },
        # قاعدة البيانات (فقط في DEBUG)
        'django.db.backends': {
            'handlers': ['console'],
            'level':    'DEBUG',
            'filters':  ['require_debug_true'],
            'propagate': False,
        },
        # سجل الأمان الخاص بالتطبيق
        'intl.security': {
            'handlers': ['file_security', 'console'],
            'level':    'INFO',
            'propagate': False,
        },
        # سجل عمليات التطبيق العامة
        'intl.app': {
            'handlers': ['file_info', 'console'],
            'level':    'INFO',
            'propagate': False,
        },
        # كتم تحذير "took too long to shut down" من SSE connections — سلوك طبيعي
        'daphne': {
            'handlers': ['console'],
            'level':    'ERROR',
            'propagate': False,
        },
        'django.channels': {
            'handlers': ['console'],
            'level':    'ERROR',
            'propagate': False,
        },
    },
}

# ── Google OAuth — بوابة العملاء ─────────────────────────────────────────────
# أنشئ Client ID من: console.cloud.google.com → APIs & Services → Credentials
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')

# ── إيميل الدعم ──────────────────────────────────────────────────────────────
SUPPORT_EMAIL = os.environ.get('SUPPORT_EMAIL', 'abdullafaraj57@gmail.com')

# ── Groq — شات بوت البوابة الخارجية ─────────────────────────────────────────
# احصل على مفتاحك من: console.groq.com/keys
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')

# ── Google Gemini (احتياطي) ───────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

# ── Anthropic — Claude AI للشات بوت ─────────────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

# ── OpenAI — Whisper API للتعرف على الصوت ────────────────────────────────────
# احصل على مفتاحك من: platform.openai.com/api-keys
# إذا كان فارغاً يُستخدم Whisper المحلي كاحتياط (يتطلب pip install openai-whisper)
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

# ── تطبيق الموبايل — مفتاح API ────────────────────────────────────────────────
# يُرسَل في كل طلب من التطبيق: header X-App-Key
# أنشئ مفتاحاً: python -c "import secrets; print(secrets.token_urlsafe(32))"
FLUTTER_API_KEY = os.environ.get('FLUTTER_API_KEY', '')

# ── البريد الإلكتروني ─────────────────────────────────────────────────────────
# يُستخدم لإرسال روابط الدخول السحري لبوابة العملاء
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = os.environ.get('EMAIL_HOST',     'smtp.gmail.com')
EMAIL_PORT          = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS       = os.environ.get('EMAIL_USE_TLS',  'true').lower() == 'true'
EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER',     '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get('DEFAULT_FROM_EMAIL',  EMAIL_HOST_USER)
