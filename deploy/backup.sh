#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  backup.sh — نسخة احتياطية من قاعدة البيانات + ملفات الوسائط
#  التشغيل اليدوي:  bash /opt/intl-system/deploy/backup.sh
#  للجدولة اليومية:  أضفه إلى crontab (انظر التعليمات أسفل الملف)
# ══════════════════════════════════════════════════════════════════════════════
set -e
BACKUP_DIR="/root/backups"
DB_NAME="intl_db"
APP_DIR="/opt/intl-system"
STAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p ${BACKUP_DIR}

echo "→ نسخ قاعدة البيانات..."
sudo -u postgres pg_dump ${DB_NAME} | gzip > ${BACKUP_DIR}/db_${STAMP}.sql.gz

echo "→ نسخ ملفات الوسائط (المرفقات)..."
tar -czf ${BACKUP_DIR}/media_${STAMP}.tar.gz -C ${APP_DIR} media 2>/dev/null || true

# حذف النسخ الأقدم من 14 يوماً
find ${BACKUP_DIR} -name "*.gz" -mtime +14 -delete

echo "✅ تمت النسخة الاحتياطية:"
ls -lh ${BACKUP_DIR}/*${STAMP}*

# ── للجدولة التلقائية اليومية (3 صباحاً) ──
# نفّذ مرة واحدة:  crontab -e
# ثم أضف السطر:
#   0 3 * * * bash /opt/intl-system/deploy/backup.sh >> /var/log/intl-backup.log 2>&1
