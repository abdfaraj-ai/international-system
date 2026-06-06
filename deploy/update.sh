#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  update.sh — تحديث النظام بأمر واحد بعد رفع تعديلات على GitHub
#  التشغيل:  bash /opt/intl-system/deploy/update.sh
# ══════════════════════════════════════════════════════════════════════════════
set -e
APP_DIR="/opt/intl-system"

echo "═══════════════════════════════════════════════════"
echo "  تحديث نظام انترناشونال"
echo "═══════════════════════════════════════════════════"

cd ${APP_DIR}

echo "→ سحب آخر التعديلات من GitHub..."
git pull

source .venv/bin/activate
set -a; source .env; set +a

echo "→ تثبيت أي مكتبات جديدة..."
pip install -q -r requirements.txt

echo "→ تطبيق تغييرات قاعدة البيانات..."
python manage.py migrate --noinput

echo "→ جمع الملفات الثابتة..."
python manage.py collectstatic --noinput

echo "→ ضبط الصلاحيات..."
chown -R www-data:www-data ${APP_DIR}

echo "→ إعادة تشغيل النظام..."
systemctl restart intl-system

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ تم التحديث بنجاح!"
echo "  حالة النظام:"
systemctl is-active intl-system
echo "═══════════════════════════════════════════════════"
