#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  deploy.sh — سكريبت النشر على خادم الإنتاج
#  الاستخدام: bash deploy.sh
#  المتطلبات: docker, docker compose, git
# ══════════════════════════════════════════════════════════════

set -e  # أوقف عند أي خطأ

# ── الألوان ───────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✖]${NC} $1"; exit 1; }

# ── التحقق من المتطلبات ───────────────────────────────────────
command -v docker        >/dev/null 2>&1 || err "Docker غير مثبت"
command -v docker        >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || err "Docker Compose غير مثبت"

[ -f ".env.prod" ] || err "ملف .env.prod غير موجود. انسخ .env.prod.example وعبِّئه."

log "بدء النشر..."

# ── سحب آخر التغييرات ─────────────────────────────────────────
log "سحب آخر التغييرات من Git..."
git pull origin main

# ── بناء الصور ────────────────────────────────────────────────
log "بناء Docker images..."
docker compose -f docker-compose.prod.yml build --no-cache

# ── إيقاف الحاويات القديمة ────────────────────────────────────
log "إيقاف الحاويات الحالية..."
docker compose -f docker-compose.prod.yml down --remove-orphans

# ── تشغيل الحاويات الجديدة ────────────────────────────────────
log "تشغيل الحاويات..."
docker compose -f docker-compose.prod.yml up -d

# ── انتظار قاعدة البيانات ─────────────────────────────────────
log "الانتظار حتى تجهز قاعدة البيانات..."
sleep 5

# ── Migrations ────────────────────────────────────────────────
log "تطبيق migrations..."
docker compose -f docker-compose.prod.yml exec web python manage.py migrate --noinput

# ── جمع الملفات الثابتة ───────────────────────────────────────
log "جمع الملفات الثابتة..."
docker compose -f docker-compose.prod.yml exec web python manage.py collectstatic --noinput --clear

# ── التحقق من الصحة ───────────────────────────────────────────
log "التحقق من صحة الخدمات..."
docker compose -f docker-compose.prod.yml ps

log "تم النشر بنجاح! 🚀"
warn "تأكد من أن شهادة SSL موجودة في nginx/ssl/"
