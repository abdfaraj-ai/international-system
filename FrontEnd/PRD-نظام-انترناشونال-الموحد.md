# وثيقة متطلبات المنتج (PRD)
## نظام انترناشونال الموحد — International Unified System

**الإصدار:** 2.0 — شامل Backend Django
**التاريخ:** 2026-03-24
**الحالة:** مسودة تفصيلية
**المُعِد:** Claude Code — بناءً على تحليل الكود الكامل

---

## 1. الملخص التنفيذي

نظام انترناشونال الموحد هو منصة إدارة مالية شاملة مصمّمة لشركات الصرافة وتحويل الأموال. يُتيح النظام إدارة عمليات التلرات، التحويلات البنكية، الحوالات الدولية، وعمليات البيع والشراء بعملات متعددة.

**المرحلة الحالية (v1):** واجهة أمامية HTML/CSS/JS مع localStorage
**المرحلة القادمة (v2):** ربط بـ Django Backend + PostgreSQL + REST API + WebSocket

---

## 2. نطاق المنتج وأهدافه

### الأهداف الرئيسية
- أتمتة سير عمل التحويلات المالية داخلياً وخارجياً
- توفير لوحة تحكم مركزية للإدارة العليا
- تمكين الرقابة الفورية من المشرفين على التلرات والحوالات
- تسريع معالجة الحوالات الواردة عبر واتساب
- ضمان دقة الأرصدة والتسويات اليومية
- توحيد إدارة الفروع والموظفين في منصة واحدة

### ما هو خارج النطاق (v2.0)
- تطبيق جوال (يأتي في v3)
- بوابة للعملاء النهائيين (يأتي في v3)
- تكامل SWIFT تلقائي (يأتي في v3)

---

## 3. المستخدمون والأدوار

| الدور | الصفحة | الصلاحيات |
|---|---|---|
| **مدير النظام** | `dashboard.html` | كاملة — كل شيء |
| **موظف التحويل البنكي** | `accounts.html` | تنفيذ التحويلات، بيع/شراء |
| **موظف التلر** | `teller-departments.html` | صرافة، حوالات، إيداع/سحب |
| **مشرف التلر** | `teller-supervisor.html` | إدارة التلرات، التسعيرة، الصلاحيات |
| **موظف الحوالات** | `transactions.html` | معالجة الحوالات عبر واتساب |
| **مشرف الحوالات** | `transactions-supervisor.html` | الإشراف على موظفي الحوالات |

---

## 4. المتطلبات الوظيفية (Frontend)

### 4.1 لوحة التحكم الإدارية
- F-DASH-001: شجرة تنظيمية حية للفروع والمشرفين والتلرات
- F-DASH-002: إدارة الفروع (إضافة، تعديل، تفعيل الصفحات)
- F-DASH-003: إدارة المشرفين (نوع، وردية، فرع)
- F-DASH-004: إدارة صناديق التلرات (حد يومي، رصيد)
- F-DASH-005: مصفوفة صلاحيات المستخدمين
- F-DASH-006: استعراض التقارير المرفوعة
- F-DASH-007: متابعة طلبات التعديل البرمجي
- F-DASH-008: تحويل أرصدة بين الفروع
- F-DASH-009: إحصاءات حية شاملة

### 4.2 قسم التحويل البنكي
- F-ACCT-001: قائمة الحوالات الواردة مع فلتر وبحث
- F-ACCT-002 ~ F-ACCT-011: [كما في v1]

### 4.3 ~ 4.5 بقية الأقسام
- [كما في v1 — تفاصيل محفوظة]

---

## 5. المتطلبات غير الوظيفية

| المتطلب | التفاصيل |
|---|---|
| **اللغة** | عربي RTL كامل |
| **الأداء** | API response < 200ms، WebSocket latency < 50ms |
| **التوافق** | Chrome 90+، Edge 90+، Firefox 88+ |
| **الأمان** | JWT Auth، HTTPS، CORS، Rate Limiting |
| **الاستجابة** | Responsive 768px+ |
| **العملات** | USD، ILS، JOD، EUR، GBP |
| **قاعدة البيانات** | PostgreSQL (production)، SQLite (dev) |

---

---

# ═══════════════════════════════════════════
# الجزء الثاني — تخطيط Backend Django (v2)
# ═══════════════════════════════════════════

---

## 6. هيكل مشروع Django

```
international_system/                  ← مجلد المشروع الرئيسي
│
├── config/                            ← إعدادات Django
│   ├── __init__.py
│   ├── settings/
│   │   ├── base.py                    ← إعدادات مشتركة
│   │   ├── development.py             ← إعدادات التطوير
│   │   └── production.py             ← إعدادات الإنتاج
│   ├── urls.py                        ← URLs الرئيسية
│   ├── wsgi.py
│   └── asgi.py                        ← للـ WebSocket (Django Channels)
│
├── apps/
│   ├── users/                         ← المستخدمون والمصادقة
│   ├── branches/                      ← الفروع
│   ├── tellers/                       ← التلرات والصناديق
│   ├── supervisors/                   ← المشرفون
│   ├── transfers/                     ← الحوالات البنكية
│   ├── exchange/                      ← عمليات الصرافة
│   ├── international_transfers/       ← الحوالات الدولية
│   ├── electronic/                    ← المعاملات الإلكترونية
│   ├── cash_desk/                     ← سحب وإيداع
│   ├── reports/                       ← التقارير والمرفقات
│   ├── dev_requests/                  ← طلبات التعديل البرمجي
│   └── notifications/                 ← الإشعارات الفورية
│
├── frontend/                          ← الواجهة الأمامية (HTML/CSS/JS)
│   └── templates/
│       └── pages/
│
├── media/                             ← ملفات المستخدمين (تقارير، مرفقات)
├── static/                            ← ملفات CSS/JS/Images
├── requirements/
│   ├── base.txt
│   ├── development.txt
│   └── production.txt
├── manage.py
├── .env                               ← متغيرات البيئة (لا تُرفع لـ Git)
└── docker-compose.yml                 ← Docker (اختياري)
```

---

## 7. المكتبات والتبعيات المطلوبة

### `requirements/base.txt`
```
Django==5.0.x
djangorestframework==3.15.x          # REST API
djangorestframework-simplejwt==5.3.x  # JWT Authentication
django-cors-headers==4.3.x            # CORS للفرونت اند
channels==4.0.x                       # WebSocket
channels-redis==4.2.x                 # Redis كـ Channel Layer
daphne==4.0.x                         # ASGI Server
psycopg2-binary==2.9.x                # PostgreSQL Driver
Pillow==10.x                          # معالجة الصور
python-decouple==3.8                  # إدارة .env
django-filter==23.x                   # فلترة متقدمة في API
```

### `requirements/production.txt`
```
-r base.txt
gunicorn==21.x                        # WSGI Server
whitenoise==6.x                       # تقديم الملفات الثابتة
redis==5.x                            # Redis Client
boto3==1.x                            # AWS S3 (للملفات — اختياري)
```

---

## 8. نماذج قاعدة البيانات (Django Models)

### 8.1 تطبيق `users`

```python
# apps/users/models.py

from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    """مستخدم النظام مع دور محدد"""

    ROLE_CHOICES = [
        ('admin',           'مدير النظام'),
        ('bank_officer',    'موظف التحويل البنكي'),
        ('teller',          'موظف التلر'),
        ('teller_sup',      'مشرف التلر'),
        ('transfer_officer','موظف الحوالات'),
        ('transfer_sup',    'مشرف الحوالات'),
    ]

    role        = models.CharField(max_length=20, choices=ROLE_CHOICES)
    phone       = models.CharField(max_length=20, blank=True)
    branch      = models.ForeignKey('branches.Branch', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='users')
    avatar      = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    last_seen   = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users'
        verbose_name = 'مستخدم'
        verbose_name_plural = 'المستخدمون'

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"
```

---

### 8.2 تطبيق `branches`

```python
# apps/branches/models.py

class Branch(models.Model):
    CURRENCY_CHOICES = [
        ('USD', 'دولار أمريكي'),
        ('ILS', 'شيكل إسرائيلي'),
        ('JOD', 'دينار أردني'),
    ]

    name            = models.CharField(max_length=100)
    location        = models.CharField(max_length=200)
    main_currency   = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    balance_usd     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_ils     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_jod     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    is_active       = models.BooleanField(default=True)

    # الصفحات المفعّلة لهذا الفرع
    page_teller         = models.BooleanField(default=True)
    page_bank_transfer  = models.BooleanField(default=True)
    page_transactions   = models.BooleanField(default=True)

    phone       = models.CharField(max_length=20, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'branches'
        verbose_name = 'فرع'
        verbose_name_plural = 'الفروع'

    def __str__(self):
        return self.name
```

---

### 8.3 تطبيق `tellers`

```python
# apps/tellers/models.py

class TellerBox(models.Model):
    """صندوق التلر — الوحدة المالية للتلر"""

    teller      = models.OneToOneField('users.User', on_delete=models.CASCADE,
                                        related_name='box', limit_choices_to={'role': 'teller'})
    supervisor  = models.ForeignKey('users.User', on_delete=models.SET_NULL,
                                     null=True, related_name='supervised_boxes',
                                     limit_choices_to={'role': 'teller_sup'})
    branch      = models.ForeignKey('branches.Branch', on_delete=models.CASCADE)

    balance_usd     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_ils     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_jod     = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    daily_limit_usd = models.DecimalField(max_digits=15, decimal_places=2, default=50000)
    is_open         = models.BooleanField(default=False)
    opened_at       = models.DateTimeField(null=True, blank=True)
    closed_at       = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'teller_boxes'


class TellerPermissions(models.Model):
    """صلاحيات التلر المحددة من المشرف"""

    teller              = models.OneToOneField('users.User', on_delete=models.CASCADE,
                                                related_name='permissions')
    can_exchange        = models.BooleanField(default=True)
    can_international   = models.BooleanField(default=True)
    can_electronic      = models.BooleanField(default=False)
    can_cash_desk       = models.BooleanField(default=True)
    special_pricing     = models.BooleanField(default=False)

    updated_at  = models.DateTimeField(auto_now=True)
    updated_by  = models.ForeignKey('users.User', on_delete=models.SET_NULL,
                                     null=True, related_name='permission_updates')

    class Meta:
        db_table = 'teller_permissions'


class BoxSession(models.Model):
    """جلسة يومية للصندوق — افتتاح وإغلاق"""

    box                 = models.ForeignKey(TellerBox, on_delete=models.CASCADE,
                                             related_name='sessions')
    date                = models.DateField()

    opening_usd         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    opening_ils         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    opening_jod         = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    closing_usd         = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    closing_ils         = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    closing_jod         = models.DecimalField(max_digits=15, decimal_places=2, null=True)

    STATUS_CHOICES = [('open', 'مفتوح'), ('closed', 'مغلق'), ('reconciled', 'مُسوَّى')]
    status      = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')
    opened_at   = models.DateTimeField(auto_now_add=True)
    closed_at   = models.DateTimeField(null=True, blank=True)
    notes       = models.TextField(blank=True)

    class Meta:
        db_table = 'box_sessions'
        unique_together = ['box', 'date']
```

---

### 8.4 تطبيق `exchange`

```python
# apps/exchange/models.py

class ExchangeRate(models.Model):
    """تسعيرة اليوم — يحددها المشرف"""

    supervisor  = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    branch      = models.ForeignKey('branches.Branch', on_delete=models.CASCADE)
    date        = models.DateField()

    usd_buy     = models.DecimalField(max_digits=10, decimal_places=4)  # سعر شراء الدولار
    usd_sell    = models.DecimalField(max_digits=10, decimal_places=4)  # سعر بيع الدولار
    jod_buy     = models.DecimalField(max_digits=10, decimal_places=4)
    jod_sell    = models.DecimalField(max_digits=10, decimal_places=4)
    eur_buy     = models.DecimalField(max_digits=10, decimal_places=4, null=True)
    eur_sell    = models.DecimalField(max_digits=10, decimal_places=4, null=True)
    gbp_buy     = models.DecimalField(max_digits=10, decimal_places=4, null=True)
    gbp_sell    = models.DecimalField(max_digits=10, decimal_places=4, null=True)

    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exchange_rates'
        unique_together = ['branch', 'date']
        ordering = ['-date']


class ExchangeOperation(models.Model):
    """عملية صرافة منفذة من تلر"""

    TYPE_CHOICES = [('buy', 'شراء'), ('sell', 'بيع')]
    CURRENCY_CHOICES = [('USD','دولار'),('ILS','شيكل'),('JOD','دينار'),
                        ('EUR','يورو'),('GBP','إسترليني')]

    teller          = models.ForeignKey('users.User', on_delete=models.SET_NULL,
                                         null=True, related_name='exchange_ops')
    branch          = models.ForeignKey('branches.Branch', on_delete=models.CASCADE)
    session         = models.ForeignKey('tellers.BoxSession', on_delete=models.CASCADE,
                                         null=True, related_name='exchange_ops')

    operation_type  = models.CharField(max_length=4, choices=TYPE_CHOICES)
    from_currency   = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    to_currency     = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    amount_from     = models.DecimalField(max_digits=15, decimal_places=2)
    amount_to       = models.DecimalField(max_digits=15, decimal_places=2)
    rate            = models.DecimalField(max_digits=10, decimal_places=4)
    profit          = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    is_special_rate = models.BooleanField(default=False)
    customer_name   = models.CharField(max_length=100, blank=True)
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exchange_operations'
        ordering = ['-created_at']
```

---

### 8.5 تطبيق `transfers` (الحوالات البنكية)

```python
# apps/transfers/models.py

class BankTransfer(models.Model):
    """حوالة بنكية — ترسل من التلر وتُنفَّذ من الموظف البنكي"""

    PRIORITY_CHOICES = [('normal', 'عادي'), ('urgent', 'مستعجل')]
    STATUS_CHOICES   = [
        ('pending',    'بانتظار'),
        ('processing', 'قيد التنفيذ'),
        ('completed',  'مكتمل'),
        ('rejected',   'مرفوض'),
    ]
    CURRENCY_CHOICES = [('USD','دولار'),('ILS','شيكل'),('JOD','دينار'),
                        ('EUR','يورو'),('GBP','إسترليني')]

    # مرجع فريد
    ref             = models.CharField(max_length=30, unique=True)

    # بيانات المُرسِل
    sender_name     = models.CharField(max_length=100)
    sender_id       = models.CharField(max_length=30)

    # بيانات المستفيد
    receiver_name   = models.CharField(max_length=100)
    receiver_account= models.CharField(max_length=50)
    receiver_bank   = models.CharField(max_length=100)

    # بيانات التحويل
    amount          = models.DecimalField(max_digits=15, decimal_places=2)
    currency        = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    priority        = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')
    status          = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')

    # المسؤولون
    submitted_by    = models.ForeignKey('users.User', on_delete=models.SET_NULL,
                                         null=True, related_name='submitted_transfers')
    processed_by    = models.ForeignKey('users.User', on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='processed_transfers')
    branch          = models.ForeignKey('branches.Branch', on_delete=models.CASCADE)

    # بيانات التنفيذ
    bank_ref        = models.CharField(max_length=50, blank=True)  # الرقم المرجعي البنكي
    notes           = models.TextField(blank=True)
    rejection_reason= models.TextField(blank=True)

    # الوقت
    created_at      = models.DateTimeField(auto_now_add=True)
    processed_at    = models.DateTimeField(null=True, blank=True)
    completed_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bank_transfers'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.ref:
            from django.utils import timezone
            year  = timezone.now().year
            count = BankTransfer.objects.filter(
                created_at__year=year).count() + 1
            self.ref = f"BT-{year}-{str(count).zfill(4)}"
        super().save(*args, **kwargs)


class BuySellOperation(models.Model):
    """عملية بيع/شراء عملة عبر البنك"""

    TYPE_CHOICES     = [('buy', 'شراء'), ('sell', 'بيع')]
    CURRENCY_CHOICES = [('USD','دولار'),('ILS','شيكل'),('JOD','دينار')]

    ref             = models.CharField(max_length=30, unique=True)
    operation_type  = models.CharField(max_length=4, choices=TYPE_CHOICES)
    currency        = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    amount          = models.DecimalField(max_digits=15, decimal_places=2)
    rate            = models.DecimalField(max_digits=10, decimal_places=4)
    party_name      = models.CharField(max_length=100)
    notes           = models.TextField(blank=True)

    officer         = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True)
    branch          = models.ForeignKey('branches.Branch', on_delete=models.CASCADE)

    STATUS_CHOICES  = [('pending','بانتظار'),('completed','مكتمل')]
    status          = models.CharField(max_length=15, choices=STATUS_CHOICES, default='completed')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'buy_sell_operations'
        ordering = ['-created_at']
```

---

### 8.6 تطبيق `international_transfers`

```python
# apps/international_transfers/models.py

class InternationalTransfer(models.Model):
    """حوالة دولية — تُنجز من صفحة الحوالات"""

    STATUS_CHOICES = [
        ('new',        'جديدة'),
        ('verifying',  'قيد التحقق'),
        ('processing', 'قيد التنفيذ'),
        ('completed',  'مكتملة'),
        ('failed',     'فاشلة'),
        ('cancelled',  'ملغاة'),
    ]

    SOURCE_CHOICES = [
        ('whatsapp',   'واتساب'),
        ('manual',     'يدوي'),
    ]

    RECEIVE_METHOD = [
        ('cash',    'نقداً'),
        ('bank',    'تحويل بنكي'),
        ('wallet',  'محفظة إلكترونية'),
        ('agent',   'وكيل'),
    ]

    ref             = models.CharField(max_length=30, unique=True)
    security_code   = models.CharField(max_length=10)

    # المصدر
    source          = models.CharField(max_length=15, choices=SOURCE_CHOICES, default='whatsapp')
    whatsapp_group  = models.CharField(max_length=50, blank=True)
    raw_message     = models.TextField(blank=True)   # الرسالة الأصلية

    # بيانات المُرسِل
    sender_name     = models.CharField(max_length=100)
    sender_phone    = models.CharField(max_length=20, blank=True)
    sender_country  = models.CharField(max_length=50, blank=True)

    # بيانات المستفيد
    receiver_name   = models.CharField(max_length=100)
    receiver_phone  = models.CharField(max_length=20, blank=True)
    receiver_country= models.CharField(max_length=50)
    receive_method  = models.CharField(max_length=10, choices=RECEIVE_METHOD)
    receiver_account= models.CharField(max_length=50, blank=True)

    # بيانات المبلغ
    amount          = models.DecimalField(max_digits=15, decimal_places=2)
    currency        = models.CharField(max_length=3)
    commission      = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # خيارات إضافية
    double_delivery = models.BooleanField(default=False)
    is_auto         = models.BooleanField(default=False)  # وضع الذكاء

    status          = models.CharField(max_length=15, choices=STATUS_CHOICES, default='new')
    officer         = models.ForeignKey('users.User', on_delete=models.SET_NULL,
                                         null=True, related_name='intl_transfers')
    branch          = models.ForeignKey('branches.Branch', on_delete=models.CASCADE)

    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    completed_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'international_transfers'
        ordering = ['-created_at']
```

---

### 8.7 تطبيق `reports`

```python
# apps/reports/models.py

class Report(models.Model):
    """تقرير مرفوع من موظف"""

    REPORT_TYPE = [
        ('daily',   'تقرير يومي'),
        ('issue',   'مشكلة'),
        ('summary', 'ملخص'),
        ('other',   'أخرى'),
    ]
    STATUS_CHOICES = [
        ('pending',  'بانتظار المراجعة'),
        ('reviewed', 'تمت المراجعة'),
        ('archived', 'مؤرشف'),
    ]

    title       = models.CharField(max_length=200)
    report_type = models.CharField(max_length=10, choices=REPORT_TYPE, default='daily')
    content     = models.TextField(blank=True)
    file        = models.FileField(upload_to='reports/%Y/%m/', null=True, blank=True)
    status      = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')

    submitted_by= models.ForeignKey('users.User', on_delete=models.CASCADE,
                                     related_name='reports')
    branch      = models.ForeignKey('branches.Branch', on_delete=models.CASCADE)
    reviewed_by = models.ForeignKey('users.User', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='reviewed_reports')

    created_at  = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'reports'
        ordering = ['-created_at']


class DevRequest(models.Model):
    """طلب تعديل برمجي من موظف للإدارة"""

    TYPE_CHOICES = [
        ('bug',      'مشكلة'),
        ('feature',  'ميزة جديدة'),
        ('improve',  'تحسين'),
    ]
    STATUS_CHOICES = [
        ('pending',     'بانتظار المراجعة'),
        ('in_progress', 'قيد التنفيذ'),
        ('done',        'منفّذ'),
        ('rejected',    'مرفوض'),
    ]

    title       = models.CharField(max_length=200)
    req_type    = models.CharField(max_length=10, choices=TYPE_CHOICES)
    description = models.TextField()
    attachment  = models.FileField(upload_to='dev_requests/', null=True, blank=True)
    status      = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')

    submitted_by= models.ForeignKey('users.User', on_delete=models.CASCADE)
    admin_notes = models.TextField(blank=True)

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'dev_requests'
        ordering = ['-created_at']
```

---

## 9. REST API Endpoints

### 9.1 المصادقة — `/api/v1/auth/`

| الطريقة | الـ Endpoint | الوصف |
|---|---|---|
| `POST` | `/auth/login/` | تسجيل الدخول → يُعيد access + refresh token |
| `POST` | `/auth/refresh/` | تجديد الـ access token |
| `POST` | `/auth/logout/` | تسجيل الخروج (إلغاء الـ token) |
| `GET`  | `/auth/me/` | بيانات المستخدم الحالي + دوره |

**مثال response لـ `/auth/me/`:**
```json
{
  "id": 5,
  "username": "faisal.teller",
  "full_name": "فيصل عبدالله",
  "role": "teller",
  "role_display": "موظف التلر",
  "branch": { "id": 1, "name": "الفرع الرئيسي" },
  "redirect_to": "/teller-departments"
}
```

---

### 9.2 الفروع — `/api/v1/branches/`

| الطريقة | الـ Endpoint | الصلاحيات | الوصف |
|---|---|---|---|
| `GET`    | `/branches/` | admin | قائمة الفروع |
| `POST`   | `/branches/` | admin | إنشاء فرع جديد |
| `GET`    | `/branches/{id}/` | admin | تفاصيل فرع |
| `PATCH`  | `/branches/{id}/` | admin | تعديل فرع |
| `DELETE` | `/branches/{id}/` | admin | حذف فرع |
| `GET`    | `/branches/{id}/stats/` | admin | إحصاءات الفرع |
| `POST`   | `/branches/transfer/` | admin | تحويل رصيد بين فرعين |

---

### 9.3 التلرات والصناديق — `/api/v1/tellers/`

| الطريقة | الـ Endpoint | الصلاحيات | الوصف |
|---|---|---|---|
| `GET`   | `/tellers/` | teller_sup, admin | قائمة التلرات |
| `POST`  | `/tellers/` | admin | إضافة تلر جديد |
| `GET`   | `/tellers/{id}/box/` | teller, teller_sup | بيانات الصندوق |
| `POST`  | `/tellers/{id}/box/open/` | teller | فتح الصندوق |
| `POST`  | `/tellers/{id}/box/close/` | teller | إغلاق الصندوق |
| `POST`  | `/tellers/{id}/box/reconcile/` | teller | تسوية الصندوق |
| `GET`   | `/tellers/{id}/permissions/` | teller_sup | صلاحيات التلر |
| `PATCH` | `/tellers/{id}/permissions/` | teller_sup | تحديث الصلاحيات |
| `GET`   | `/tellers/{id}/session/today/` | teller | جلسة اليوم |

---

### 9.4 التسعيرة — `/api/v1/rates/`

| الطريقة | الـ Endpoint | الصلاحيات | الوصف |
|---|---|---|---|
| `GET`   | `/rates/today/` | all | تسعيرة اليوم للفرع |
| `POST`  | `/rates/` | teller_sup | تحديث التسعيرة |
| `GET`   | `/rates/history/` | teller_sup, admin | تاريخ التسعيرات |

---

### 9.5 عمليات الصرافة — `/api/v1/exchange/`

| الطريقة | الـ Endpoint | الصلاحيات | الوصف |
|---|---|---|---|
| `GET`   | `/exchange/` | teller, teller_sup | قائمة العمليات |
| `POST`  | `/exchange/` | teller | إجراء عملية صرافة |
| `GET`   | `/exchange/{id}/` | teller | تفاصيل عملية |
| `GET`   | `/exchange/stats/` | teller_sup | إحصاءات الصرافة |

**مثال request لإجراء صرافة:**
```json
POST /api/v1/exchange/
{
  "operation_type": "buy",
  "from_currency": "ILS",
  "to_currency": "USD",
  "amount_from": 3670,
  "rate": 3.67,
  "customer_name": "محمد أحمد",
  "is_special_rate": false
}
```

---

### 9.6 الحوالات البنكية — `/api/v1/transfers/`

| الطريقة | الـ Endpoint | الصلاحيات | الوصف |
|---|---|---|---|
| `GET`   | `/transfers/` | bank_officer, admin | قائمة الحوالات |
| `POST`  | `/transfers/` | teller, bank_officer | إنشاء حوالة |
| `GET`   | `/transfers/{id}/` | bank_officer | تفاصيل الحوالة |
| `PATCH` | `/transfers/{id}/status/` | bank_officer | تغيير الحالة |
| `GET`   | `/transfers/pending/` | bank_officer | الحوالات المعلّقة |
| `POST`  | `/transfers/{id}/execute/` | bank_officer | تنفيذ الحوالة |
| `POST`  | `/transfers/{id}/reject/` | bank_officer | رفض الحوالة |
| `GET`   | `/transfers/stats/` | bank_officer, admin | الإحصاءات |

---

### 9.7 الحوالات الدولية — `/api/v1/international/`

| الطريقة | الـ Endpoint | الصلاحيات | الوصف |
|---|---|---|---|
| `GET`   | `/international/` | transfer_officer | قائمة الحوالات |
| `POST`  | `/international/` | transfer_officer | إنشاء حوالة |
| `PATCH` | `/international/{id}/verify/` | transfer_officer | التحقق من الحوالة |
| `POST`  | `/international/{id}/execute/` | transfer_officer | تنفيذ الحوالة |
| `GET`   | `/international/receipt/{id}/` | transfer_officer | الإيصال |

---

### 9.8 التلر — طلبات للمشرف — `/api/v1/teller-requests/`

| الطريقة | الـ Endpoint | الصلاحيات | الوصف |
|---|---|---|---|
| `GET`   | `/teller-requests/` | teller_sup | قائمة الطلبات |
| `POST`  | `/teller-requests/` | teller | إرسال طلب للمشرف |
| `PATCH` | `/teller-requests/{id}/approve/` | teller_sup | قبول الطلب |
| `PATCH` | `/teller-requests/{id}/reject/` | teller_sup | رفض الطلب |

---

### 9.9 التقارير وطلبات التطوير — `/api/v1/reports/`

| الطريقة | الـ Endpoint | الصلاحيات | الوصف |
|---|---|---|---|
| `GET`   | `/reports/` | admin | قائمة التقارير |
| `POST`  | `/reports/` | all | رفع تقرير جديد |
| `PATCH` | `/reports/{id}/review/` | admin | مراجعة التقرير |
| `GET`   | `/dev-requests/` | admin | طلبات التطوير |
| `POST`  | `/dev-requests/` | all | إرسال طلب تطوير |
| `PATCH` | `/dev-requests/{id}/status/` | admin | تحديث حالة الطلب |

---

## 10. نظام المصادقة والصلاحيات (Authentication & Permissions)

### 10.1 JWT Authentication

```python
# config/settings/base.py

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=8),    # يوم عمل كامل
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
}
```

### 10.2 Custom Permissions

```python
# apps/users/permissions.py

from rest_framework.permissions import BasePermission

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'admin'

class IsTeller(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'teller'

class IsTellerSupervisor(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ('teller_sup', 'admin')

class IsBankOfficer(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ('bank_officer', 'admin')

class IsTransferOfficer(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ('transfer_officer', 'transfer_sup', 'admin')

class SameBranchOnly(BasePermission):
    """يسمح فقط بالوصول لبيانات الفرع نفسه"""
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        return obj.branch == request.user.branch
```

---

## 11. WebSocket — الإشعارات الفورية (Django Channels)

### 11.1 الـ Consumers

```python
# apps/notifications/consumers.py

import json
from channels.generic.websocket import AsyncWebsocketConsumer

class BranchConsumer(AsyncWebsocketConsumer):
    """قناة للفرع — تُوزَّع على جميع موظفي الفرع"""

    async def connect(self):
        user        = self.scope['user']
        branch_id   = user.branch_id
        self.group  = f"branch_{branch_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data):
        pass  # العميل لا يُرسل، فقط يستقبل

    # ─── نوع الرسائل ───────────────────────────────
    async def transfer_update(self, event):
        """حوالة بنكية تغيّرت حالتها"""
        await self.send(text_data=json.dumps({
            'type': 'transfer_update',
            'data': event['data']
        }))

    async def rate_update(self, event):
        """المشرف غيّر التسعيرة"""
        await self.send(text_data=json.dumps({
            'type': 'rate_update',
            'data': event['data']
        }))

    async def teller_request(self, event):
        """التلر أرسل طلب جديد للمشرف"""
        await self.send(text_data=json.dumps({
            'type': 'teller_request',
            'data': event['data']
        }))

    async def notification(self, event):
        """إشعار عام"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))
```

### 11.2 إرسال حدث من الـ View

```python
# كيفية إرسال تحديث عند تنفيذ حوالة
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def execute_transfer(transfer):
    # ... تنفيذ الحوالة ...
    transfer.status = 'completed'
    transfer.save()

    # أرسل تحديثاً لجميع موظفي الفرع
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"branch_{transfer.branch_id}",
        {
            "type": "transfer.update",
            "data": {
                "id":     transfer.id,
                "ref":    transfer.ref,
                "status": transfer.status,
            }
        }
    )
```

### 11.3 إضافة WebSocket في الـ Frontend

```javascript
// static/js/ws-client.js — يُضاف لكل صفحة

const ws = new WebSocket(`ws://${location.host}/ws/branch/`);

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'transfer_update') {
        // تحديث قائمة الحوالات في accounts.html
        updateTransferStatus(msg.data);
    }
    if (msg.type === 'rate_update') {
        // تحديث التسعيرة في teller-departments.html
        applyNewRates(msg.data);
    }
    if (msg.type === 'notification') {
        notify(msg.data.message, msg.data.level || 'info');
    }
};
```

---

## 12. هيكل URLs

```python
# config/urls.py

from django.urls import path, include

urlpatterns = [
    path('admin/',      admin.site.urls),
    path('api/v1/',     include([
        path('auth/',           include('apps.users.urls')),
        path('branches/',       include('apps.branches.urls')),
        path('tellers/',        include('apps.tellers.urls')),
        path('rates/',          include('apps.exchange.urls.rates')),
        path('exchange/',       include('apps.exchange.urls.ops')),
        path('transfers/',      include('apps.transfers.urls')),
        path('international/',  include('apps.international_transfers.urls')),
        path('reports/',        include('apps.reports.urls')),
        path('dev-requests/',   include('apps.dev_requests.urls')),
        path('notifications/',  include('apps.notifications.urls')),
    ])),
    # WebSocket
    # (يُعرَّف في asgi.py عبر Django Channels)

    # Frontend Pages
    path('',            include('frontend.urls')),
]
```

```python
# config/asgi.py

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path
from apps.notifications.consumers import BranchConsumer

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter([
            path("ws/branch/", BranchConsumer.as_asgi()),
        ])
    ),
})
```

---

## 13. قاعدة البيانات — مخطط العلاقات (ERD ملخص)

```
User (المستخدم)
  ├── branch FK → Branch
  ├── box   1:1 → TellerBox        (إذا كان تلر)
  └── perms 1:1 → TellerPermissions (إذا كان تلر)

Branch (الفرع)
  ├── users       1:N → User
  ├── sessions    1:N → BoxSession
  ├── rates       1:N → ExchangeRate
  ├── transfers   1:N → BankTransfer
  └── ex_ops      1:N → ExchangeOperation

TellerBox (صندوق التلر)
  ├── teller   1:1 → User
  ├── supervisor FK → User
  └── sessions 1:N → BoxSession

BoxSession (جلسة يومية)
  ├── box         FK → TellerBox
  ├── exchange_ops 1:N → ExchangeOperation
  └── cash_ops    1:N → CashDeskOperation

BankTransfer (حوالة بنكية)
  ├── submitted_by FK → User
  ├── processed_by FK → User
  └── branch       FK → Branch

InternationalTransfer (حوالة دولية)
  ├── officer FK → User
  └── branch  FK → Branch

Report (تقرير)
  ├── submitted_by FK → User
  └── branch       FK → Branch

DevRequest (طلب تطوير)
  └── submitted_by FK → User
```

---

## 14. إعدادات البيئة (.env)

```env
# Django
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database
DB_ENGINE=django.db.backends.postgresql
DB_NAME=international_db
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=5432

# Redis (للـ WebSocket وCache)
REDIS_URL=redis://localhost:6379/0

# Email (للإشعارات)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your@email.com
EMAIL_HOST_PASSWORD=your-app-password

# Media Files
MEDIA_URL=/media/
MEDIA_ROOT=/var/www/international/media/

# JWT
JWT_ACCESS_HOURS=8
JWT_REFRESH_DAYS=30

# CORS — عناوين الفرونت اند المسموحة
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## 15. خطة النشر (Deployment)

### الإعداد المقترح للإنتاج

```
┌─────────────────────────────────────────────┐
│                   Client                    │
│           Browser (HTML/JS/CSS)             │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────┐
│              Nginx (Reverse Proxy)          │
│   Static Files ──────────────────────────  │
│   /api/*  → Daphne:8000                    │
│   /ws/*   → Daphne:8000 (WebSocket)        │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Daphne (ASGI Server)              │
│         Django + Django Channels            │
└──────┬───────────────────────┬──────────────┘
       │                       │
┌──────▼──────┐        ┌───────▼────────┐
│ PostgreSQL  │        │     Redis      │
│  (Database) │        │  (WebSocket    │
│             │        │   Channel)     │
└─────────────┘        └────────────────┘
```

### خطوات الـ Setup

```bash
# 1. إنشاء البيئة الافتراضية
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# 2. تثبيت المتطلبات
pip install -r requirements/production.txt

# 3. إعداد قاعدة البيانات
python manage.py migrate

# 4. إنشاء مستخدم الإدارة
python manage.py createsuperuser

# 5. جمع الملفات الثابتة
python manage.py collectstatic

# 6. تشغيل السيرفر
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

---

## 16. مسار التطوير الكامل

```
v1.0 ✅ (مكتمل — حالياً)
  • واجهة أمامية HTML/CSS/JS
  • localStorage للتواصل بين الصفحات
  • 6 صفحات لـ 6 أدوار

v2.0 ⏳ (Django Backend)
  • Django 5 + DRF + JWT
  • PostgreSQL + Redis
  • REST API لجميع العمليات
  • WebSocket للإشعارات الفورية
  • ربط الفرونت اند بالـ API
  • نظام تسجيل دخول حقيقي
  • لوحة Django Admin

v2.5 🔜 (تحسينات)
  • تقارير PDF تلقائية
  • إشعارات بريد إلكتروني
  • نظام Audit Log لكل العمليات
  • Export بصيغ Excel/CSV
  • نظام Backup تلقائي

v3.0 🔮 (مستقبلي)
  • تطبيق جوال (React Native)
  • WhatsApp Business API
  • تكامل مع أنظمة بنكية
  • بوابة عملاء
  • تقارير ذكية (AI-powered)
```

---

## 17. معايير القبول — Backend

| السيناريو | معيار القبول |
|---|---|
| تسجيل الدخول | يُعيد JWT token خلال < 500ms |
| صلاحيات الدور | التلر لا يمكنه الوصول لـ API الإدارة (403) |
| تنفيذ حوالة | يُحدَّث الرصيد ويُرسَل WebSocket event فورياً |
| تحديث التسعيرة | ينعكس على جميع التلرات خلال ثوانٍ عبر WebSocket |
| رفع ملف | يُحفظ بشكل آمن ويُعاد مسار الملف في الـ response |
| إغلاق الصندوق | يُسجَّل في BoxSession ولا يمكن فتح جلسة ثانية بنفس اليوم |
| CORS | الطلبات من الفرونت اند مقبولة، الطلبات الأجنبية مرفوضة |

---

*تم إعداد هذه الوثيقة بناءً على تحليل شامل للكود المصدري + تصميم Backend Django كامل.*
*آخر تحديث: 2026-03-24*
