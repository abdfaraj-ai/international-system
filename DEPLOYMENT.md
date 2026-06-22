# دليل النشر على Railway

## ما تم إعداده تلقائياً ✅
- `railway.json` — إعدادات Railway
- `gunicorn.conf.py` — يقرأ PORT من Railway تلقائياً
- `core/settings/prod.py` — يقرأ DATABASE_URL من Railway تلقائياً
- `/health/` endpoint — للتحقق من صحة التطبيق
- `.env.prod` — متغيرات البيئة جاهزة (عدّل النطاق فقط)

---

## الخطوات المتبقية (تنفّذ مرة واحدة فقط)

### 1. رفع الكود على GitHub

افتح PowerShell في مجلد المشروع:

```powershell
git init
git add .
git commit -m "ready for deployment"
```

اذهب إلى github.com → New repository → اسمه: `international-system`
ثم:
```powershell
git remote add origin https://github.com/YOUR_USERNAME/international-system.git
git push -u origin main
```

---

### 2. النشر على Railway

1. اذهب إلى **railway.app** وسجّل دخول بـ GitHub
2. اضغط **New Project** → **Deploy from GitHub repo**
3. اختر `international-system`
4. Railway سيكتشف `Dockerfile` تلقائياً

---

### 3. إضافة PostgreSQL

في مشروعك على Railway:
- اضغط **New** → **Database** → **Add PostgreSQL**
- Railway سيضيف `DATABASE_URL` تلقائياً ✅

---

### 4. إضافة متغيرات البيئة

في Railway → Variables → أضف هذه المتغيرات:

```
DJANGO_SETTINGS_MODULE = core.settings.prod
DJANGO_SECRET_KEY      = <ضع هنا مفتاحاً جديداً — أنشئه بالأمر أدناه>
ALLOWED_HOSTS          = your-app.up.railway.app
CSRF_TRUSTED_ORIGINS   = https://your-app.up.railway.app
```

> ⚠️ **لا تضع مفتاحاً حقيقياً في هذا الملف أبداً** (يُرفع إلى المستودع). أنشئ المفتاح وقت النشر فقط:
> ```powershell
> python -c "import secrets; print(secrets.token_urlsafe(50))"
> ```
> وألصِقه مباشرةً في Railway → Variables.

> بعد معرفة رابط التطبيق من Railway، عدّل ALLOWED_HOSTS و CSRF_TRUSTED_ORIGINS

---

### 5. بعد النشر — إنشاء المدير

في Railway → مشروعك → زر **Railway CLI** أو **Shell**:
```bash
python manage.py createsuperuser
```

---

### 6. ربط نطاقك الخاص (اختياري)

في Railway → Settings → Custom Domain → أضف `yourdomain.com`
ثم في مزود النطاق أضف CNAME record كما يوضحه Railway.

بعدها عدّل في Variables:
```
ALLOWED_HOSTS        = your-app.up.railway.app,yourdomain.com
CSRF_TRUSTED_ORIGINS = https://your-app.up.railway.app,https://yourdomain.com
```

---

## ملاحظة عن SECRET_KEY
⚠️ **مهم:** أي مفتاح كان مكتوباً سابقاً في هذا الملف يُعتبر الآن **مكشوفاً ويجب عدم استخدامه**.
احتفظ بالمفتاح في `.env.prod` المحلي فقط (وهو مستثنى من Git)، ولا تكتبه في أي ملف يُرفع للمستودع.

**استخدم مفتاحاً جديداً وفريداً على Railway** — أنشئ واحداً:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(50))"
```
