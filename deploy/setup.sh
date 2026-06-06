#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  setup.sh — تثبيت نظام انترناشونال على DigitalOcean (Ubuntu 24.04)
#  التشغيل:  sudo bash setup.sh
# ══════════════════════════════════════════════════════════════════════════════
set -e

# ── الإعدادات (عدّلها) ──────────────────────────────────────────────
DB_NAME="intl_db"
DB_USER="intl_user"
DB_PASS="$(openssl rand -base64 18 | tr -d '/+=')"   # كلمة مرور عشوائية قوية
SECRET_KEY="$(openssl rand -base64 50 | tr -d '/+=' | cut -c1-50)"
REPO="https://github.com/International-Company/international-system.git"
APP_DIR="/opt/intl-system"
DOMAIN="${1:-}"   # يُمرّر كأول وسيط (اختياري)

echo "═══════════════════════════════════════════════════"
echo "  تثبيت نظام انترناشونال"
echo "═══════════════════════════════════════════════════"

# ── 1. تحديث وتثبيت المتطلبات ──────────────────────────────────────
apt update && apt upgrade -y
apt install -y python3 python3-venv python3-pip postgresql postgresql-contrib \
  nginx git build-essential libpq-dev libjpeg-dev libpng-dev curl

# ── 2. قاعدة البيانات ──────────────────────────────────────────────
sudo -u postgres psql <<SQL
CREATE DATABASE ${DB_NAME};
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';
ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';
ALTER ROLE ${DB_USER} SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
SQL

# ── 3. سحب المشروع ─────────────────────────────────────────────────
mkdir -p ${APP_DIR}
git clone ${REPO} ${APP_DIR} || (cd ${APP_DIR} && git pull)
cd ${APP_DIR}

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# ── 4. ملف البيئة ──────────────────────────────────────────────────
cat > ${APP_DIR}/.env <<ENV
DJANGO_SETTINGS_MODULE=core.settings.prod
DJANGO_SECRET_KEY=${SECRET_KEY}
ALLOWED_HOSTS=${DOMAIN:-_},$(curl -s ifconfig.me),localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=https://${DOMAIN}
HTTPS_ENABLED=false
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_HOST=localhost
DB_PORT=5432
DB_SSLMODE=disable
SITE_URL=https://${DOMAIN}
# ── البريد عبر Gmail (يعمل مباشرة على VPS) ──
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_SSL=false
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
ENV

# ── 5. الترحيل والملفات الثابتة ────────────────────────────────────
set -a; source ${APP_DIR}/.env; set +a
python manage.py migrate --noinput
python manage.py collectstatic --noinput

# ── 6. الصلاحيات ───────────────────────────────────────────────────
mkdir -p ${APP_DIR}/logs ${APP_DIR}/media ${APP_DIR}/staticfiles
chown -R www-data:www-data ${APP_DIR}

# ── 7. systemd service (Daphne) ────────────────────────────────────
cp ${APP_DIR}/deploy/intl-system.service /etc/systemd/system/intl-system.service
systemctl daemon-reload
systemctl enable intl-system
systemctl restart intl-system

# ── 8. Nginx ───────────────────────────────────────────────────────
cp ${APP_DIR}/deploy/nginx.conf /etc/nginx/sites-available/intl-system
sed -i "s/SERVER_NAME_PLACEHOLDER/${DOMAIN:-_}/g" /etc/nginx/sites-available/intl-system
ln -sf /etc/nginx/sites-available/intl-system /etc/nginx/sites-enabled/intl-system
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تم التثبيت بنجاح!"
echo "═══════════════════════════════════════════════════"
echo "  رابط النظام:  http://$(curl -s ifconfig.me)/"
echo "  قاعدة البيانات:  ${DB_NAME}"
echo "  مستخدم القاعدة:  ${DB_USER}"
echo "  كلمة مرور القاعدة:  ${DB_PASS}"
echo "  (احفظها في مكان آمن)"
echo ""
echo "  الخطوة التالية — أنشئ حساب المدير:"
echo "  cd ${APP_DIR} && source .venv/bin/activate"
echo "  set -a; source .env; set +a"
echo "  python manage.py createsuperuser"
echo "═══════════════════════════════════════════════════"
