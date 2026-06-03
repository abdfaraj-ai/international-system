# ══════════════════════════════════════════════════════════════
#  Dockerfile — نظام انترناشونال الموحد
#  بناء: docker build -t intl-system .
# ══════════════════════════════════════════════════════════════

# ── المرحلة الأساسية ──────────────────────────────────────────
FROM python:3.11-slim AS base

# متغيرات البيئة
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# تثبيت التبعيات اللازمة للمكتبات (psycopg2, pillow)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# ── تثبيت المكتبات ────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# ── نسخ كود المشروع ───────────────────────────────────────────
COPY . .

# إنشاء المجلدات اللازمة
RUN mkdir -p logs media staticfiles

# جمع الملفات الثابتة
RUN DJANGO_SETTINGS_MODULE=core.settings.prod \
    DJANGO_SECRET_KEY=build-collect-static-placeholder \
    DB_NAME=placeholder DB_USER=placeholder DB_PASSWORD=placeholder \
    DB_HOST=placeholder DB_PORT=5432 \
    python manage.py collectstatic --noinput --clear 2>/dev/null || true

# مستخدم غير root للأمان
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
RUN chown -R appuser:appgroup /app
USER appuser

# ── الإعدادات الافتراضية ──────────────────────────────────────
EXPOSE 8000

CMD ["gunicorn", "core.wsgi:application", \
     "--config", "gunicorn.conf.py"]
