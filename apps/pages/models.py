import secrets
from datetime import timedelta
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


ROLE_CHOICES = [
    ('M01',  'الإدارة العامة'),
    ('M02',  'مشرف التلر'),
    ('M03',  'مشرف الحوالات'),
    ('T01',  'أقسام التلر'),
    ('T02',  'التحويل البنكي'),
    ('T03',  'الحوالات الخارجية'),
    ('IM01', 'مدير المبرمجين'),
    ('P01',  'مبرمج'),
    ('E01',  'موظف'),
]

ROLE_HOME = {
    'M01':  '/dashboard/',
    'M02':  '/supervisor/teller/',
    'M03':  '/transactions/supervisor/',
    'T01':  '/teller/',
    'T02':  '/accounts/',
    'T03':  '/transactions/',
    'IM01': '/tasks/admin/',
    'P01':  '/tasks/my/',
    'E01':  '/daily-report/',
}


EMPLOYEE_TYPE_CHOICES = [
    ('general',    'موظف عادي'),
    ('accountant', 'محاسب'),
]


class SystemUser(AbstractUser):
    role = models.CharField(
        max_length=4,
        choices=ROLE_CHOICES,
        default='T01',
        verbose_name='الصلاحية',
    )
    # نوع الموظف — يُستخدم فقط مع دور E01 للتمييز بين الموظف العادي والمحاسب
    employee_type = models.CharField(
        max_length=12,
        choices=EMPLOYEE_TYPE_CHOICES,
        default='general',
        verbose_name='نوع الموظف',
    )
    totp_secret  = models.CharField(max_length=64, blank=True, verbose_name='مفتاح 2FA')
    totp_enabled = models.BooleanField(default=False, verbose_name='2FA مفعّل')

    class Meta:
        verbose_name = 'مستخدم النظام'
        verbose_name_plural = 'مستخدمو النظام'

    @property
    def home_page(self):
        # المحاسب (E01 + accountant) يذهب لصفحة المحاسب
        if self.role == 'E01' and self.employee_type == 'accountant':
            return '/accountant-report/'
        return ROLE_HOME.get(self.role, '/login/')

    @property
    def is_accountant(self):
        return self.role == 'E01' and self.employee_type == 'accountant'

    @property
    def role_name(self):
        return dict(ROLE_CHOICES).get(self.role, self.role)

    def __str__(self):
        return f'{self.username} ({self.role_name})'

    def to_dict(self):
        return {
            'id':          self.id,
            'username':    self.username,
            'name':        f'{self.first_name} {self.last_name}'.strip() or self.username,
            'firstName':   self.first_name,
            'lastName':    self.last_name,
            'email':       self.email,
            'role':        self.role,
            'roleName':    self.role_name,
            'isActive':    self.is_active,
            'isStaff':     self.is_staff,
            'lastLogin':   self.last_login.isoformat() if self.last_login else None,
            'dateJoined':  self.date_joined.isoformat(),
        }


# ── الفروع ────────────────────────────────────────────────────────────────────

class Branch(models.Model):
    """فرع من فروع الشركة — يُنشأ ويُدار من الإدارة العامة"""

    STATUS_CHOICES = [
        ('active',   'نشط'),
        ('inactive', 'غير نشط'),
        ('pending',  'قيد الإنشاء'),
    ]

    name       = models.CharField(max_length=200, verbose_name='اسم الفرع')
    location   = models.CharField(max_length=300, blank=True, verbose_name='الموقع')
    currency   = models.CharField(max_length=5, default='USD', verbose_name='العملة الأساسية')
    balance_usd= models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد دولار')
    balance_ils= models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد شيكل')
    balance_jod= models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد دينار')
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active',
                                  verbose_name='الحالة')
    manager    = models.CharField(max_length=150, blank=True, verbose_name='مدير الفرع')
    phone      = models.CharField(max_length=30, blank=True, verbose_name='هاتف')
    notes      = models.TextField(blank=True, verbose_name='ملاحظات')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'فرع'
        verbose_name_plural = 'الفروع'

    def __str__(self):
        return f'{self.name} — {self.location}'

    def to_dict(self):
        return {
            'id':         self.id,
            'name':       self.name,
            'location':   self.location,
            'currency':   self.currency,
            'balanceUSD': float(self.balance_usd),
            'balanceILS': float(self.balance_ils),
            'balanceJOD': float(self.balance_jod),
            'status':     self.status,
            'manager':    self.manager,
            'phone':      self.phone,
            'notes':      self.notes,
            'createdAt':  self.created_at.isoformat(),
        }


# ── الخزينة المركزية (Singleton) ─────────────────────────────────────────────

class CentralTreasury(models.Model):
    """الخزينة المركزية للشركة — سجل واحد فقط (singleton)"""

    balance_usd = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد دولار')
    balance_ils = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد شيكل')
    balance_jod = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد دينار')
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'الخزينة المركزية'
        verbose_name_plural = 'الخزينة المركزية'

    def __str__(self):
        return f'الخزينة المركزية — ${self.balance_usd:,.2f}'

    @classmethod
    def get(cls):
        """دائماً يُرجع السجل الوحيد — ينشئه إذا لم يكن موجوداً"""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def to_dict(self):
        return {
            'USD': round(self.balance_usd, 2),
            'ILS': round(self.balance_ils, 2),
            'JOD': round(self.balance_jod, 2),
        }


# ── سجل إيداعات الخزينة المركزية ─────────────────────────────────────────────

class TreasuryDeposit(models.Model):
    """كل مبلغ يُضاف للخزينة المركزية يُسجَّل هنا"""

    CURRENCY_CHOICES = [('USD','دولار'),('ILS','شيكل'),('JOD','دينار')]

    amount     = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ')
    currency   = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    notes      = models.TextField(blank=True, verbose_name='ملاحظة')
    created_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'إيداع خزينة'
        verbose_name_plural = 'إيداعات الخزينة'

    def __str__(self):
        return f'+{self.amount} {self.currency}'


# ── سجل تحويلات الفروع ────────────────────────────────────────────────────────

class BranchTransfer(models.Model):
    """تسجيل كل تحويل مالي بين الفروع أو من الخزينة المركزية للفروع"""

    from_branch  = models.ForeignKey(Branch, null=True, blank=True,
                                     related_name='transfers_out',
                                     on_delete=models.SET_NULL,
                                     verbose_name='من فرع')
    to_branch    = models.ForeignKey(Branch, null=True, blank=True,
                                     related_name='transfers_in',
                                     on_delete=models.SET_NULL,
                                     verbose_name='إلى فرع')
    amount       = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ')
    currency     = models.CharField(max_length=5, default='USD', verbose_name='العملة')
    notes        = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by   = models.CharField(max_length=150, blank=True, verbose_name='بواسطة')
    created_at   = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'تحويل فرع'
        verbose_name_plural = 'تحويلات الفروع'

    def __str__(self):
        fr = self.from_branch.name if self.from_branch else 'الخزينة'
        to = self.to_branch.name   if self.to_branch   else '—'
        return f'{fr} → {to}: {self.amount} {self.currency}'

    def to_dict(self):
        return {
            'id':         self.id,
            'fromBranch': self.from_branch.name if self.from_branch else 'الخزينة المركزية',
            'toBranch':   self.to_branch.name   if self.to_branch   else '—',
            'amount':     self.amount,
            'currency':   self.currency,
            'notes':      self.notes,
            'createdBy':  self.created_by,
            'createdAt':  self.created_at.isoformat(),
        }


# ── عمليات الصرافة من التطبيق ─────────────────────────────────────────────────

class ExchangeOperation(models.Model):
    from_currency = models.CharField(max_length=10)
    to_currency   = models.CharField(max_length=10)
    amount        = models.DecimalField(max_digits=14, decimal_places=4)
    result        = models.DecimalField(max_digits=14, decimal_places=4)
    rate          = models.DecimalField(max_digits=14, decimal_places=6)
    method        = models.CharField(max_length=20, default='voice')
    operator      = models.CharField(max_length=100, blank=True)
    web_applied   = models.BooleanField(default=False)
    created_at    = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'عملية صرف'
        verbose_name_plural = 'عمليات الصرف'
        indexes = [
            models.Index(fields=['operator', 'created_at'], name='ex_op_operator_date_idx'),
            models.Index(fields=['created_at'],              name='ex_op_date_idx'),
        ]

    def __str__(self):
        return f'{self.amount} {self.from_currency} → {self.result:.2f} {self.to_currency}'


# ── عمليات الحوالات من التطبيق ────────────────────────────────────────────────

class HawalaOperation(models.Model):
    sender_name    = models.CharField(max_length=200, verbose_name='اسم المرسل')
    receiver_name  = models.CharField(max_length=200, verbose_name='اسم المستلم')
    amount         = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ')
    fee            = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='العمولة')
    currency       = models.CharField(max_length=10, default='USD', verbose_name='العملة')
    destination    = models.CharField(max_length=200, blank=True, verbose_name='الوجهة / الدولة')
    direction      = models.CharField(max_length=10, default='out', verbose_name='الاتجاه')
    recv_method    = models.CharField(max_length=200, blank=True, verbose_name='طريقة الاستلام')
    operator       = models.CharField(max_length=100, blank=True, verbose_name='التلر')
    method         = models.CharField(max_length=20, default='voice', verbose_name='الطريقة')
    notes          = models.TextField(blank=True, verbose_name='ملاحظات')
    status         = models.CharField(max_length=20, default='pending', verbose_name='الحالة')
    web_applied    = models.BooleanField(default=False)
    created_at     = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'حوالة'
        verbose_name_plural = 'الحوالات'
        indexes = [
            models.Index(fields=['operator', 'created_at'], name='hw_op_operator_date_idx'),
        ]

    def __str__(self):
        return f'حوالة {self.amount} {self.currency} من {self.sender_name} إلى {self.receiver_name}'


# ── عمليات السحب والإيداع من التطبيق ──────────────────────────────────────────

class CashTransaction(models.Model):
    TYPES = [('withdrawal', 'سحب'), ('deposit', 'إيداع'), ('electronic', 'إلكترونية')]

    transaction_type = models.CharField(max_length=20, choices=TYPES, verbose_name='النوع')
    client_name      = models.CharField(max_length=200, verbose_name='اسم العميل')
    account          = models.CharField(max_length=100, blank=True, verbose_name='الحساب')
    amount           = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ')
    fee              = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='العمولة')
    currency         = models.CharField(max_length=10, default='USD', verbose_name='العملة')
    pay_type         = models.CharField(max_length=20, default='cash', verbose_name='طريقة الدفع')
    exchange_rate    = models.DecimalField(max_digits=14, decimal_places=6, default=0, verbose_name='سعر الصرف')
    ref_number       = models.CharField(max_length=100, blank=True, verbose_name='رقم المرجع')
    platform         = models.CharField(max_length=100, blank=True, verbose_name='المنصة')
    operator         = models.CharField(max_length=100, blank=True, verbose_name='التلر')
    method           = models.CharField(max_length=20, default='voice', verbose_name='الطريقة')
    notes            = models.TextField(blank=True, verbose_name='ملاحظات')
    web_applied      = models.BooleanField(default=False)
    created_at       = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'معاملة نقدية'
        verbose_name_plural = 'المعاملات النقدية'
        indexes = [
            models.Index(fields=['operator', 'created_at'], name='cash_operator_date_idx'),
            models.Index(fields=['transaction_type'],        name='cash_type_idx'),
        ]

    def __str__(self):
        labels = {'withdrawal': 'سحب', 'deposit': 'إيداع', 'electronic': 'إلكترونية'}
        t = labels.get(self.transaction_type, self.transaction_type)
        return f'{t} {self.amount} {self.currency} — {self.client_name}'


# ── طلبات التلرات للمشرف ──────────────────────────────────────────────────────

class TellerRequest(models.Model):
    """طلب يُرسله التلر للمشرف ويستطيع المشرف الرد عليه"""

    TYPE_CHOICES = [
        ('special_price', 'سعر مميز'),
        ('urgent',        'عاجل'),
        ('general',       'عام'),
        ('balance',       'رصيد'),
    ]
    STATUS_CHOICES = [
        ('pending',  'بانتظار'),
        ('approved', 'موافق'),
        ('rejected', 'مرفوض'),
        ('resolved', 'تم الرد'),
    ]

    request_id     = models.CharField(max_length=60, unique=True)   # SP-<timestamp> / GR-<timestamp>
    request_type   = models.CharField(max_length=20, choices=TYPE_CHOICES, default='general')
    teller_name    = models.CharField(max_length=150)
    text           = models.TextField()
    requested_rate = models.CharField(max_length=30, blank=True)     # للسعر المميز فقط

    status         = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    reply          = models.TextField(blank=True)
    resolved_by    = models.CharField(max_length=150, blank=True)

    created_at     = models.DateTimeField(default=timezone.now)
    resolved_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'طلب تلر'
        verbose_name_plural = 'طلبات التلرات'

    def __str__(self):
        return f'[{self.request_type}] {self.teller_name} — {self.status}'

    def to_dict(self):
        return {
            'id':            self.request_id,
            'type':          self.request_type,
            'tellerName':    self.teller_name,
            'from':          self.teller_name,
            'text':          self.text,
            'requestedRate': self.requested_rate,
            'status':        self.status,
            'reply':         self.reply,
            'resolvedBy':    self.resolved_by,
            'time':          self.created_at.strftime('%H:%M'),
            'createdAt':     self.created_at.isoformat(),
            'resolvedAt':    self.resolved_at.isoformat() if self.resolved_at else None,
        }


# ── أسعار الصرف — تُحدَّث من مشرف التلر وتُقرأ من كل التلرات ─────────────────

class ExchangeRate(models.Model):
    """أسعار الصرف التي نشرها المشرف — نوعان: teller (للصرافة) و hawala (للحوالات)"""

    RATE_TELLER = 'teller'
    RATE_HAWALA = 'hawala'
    RATE_TYPE_CHOICES = [
        (RATE_TELLER, 'تلر — صرافة'),
        (RATE_HAWALA, 'حوالات'),
    ]

    rate_type  = models.CharField(max_length=20, choices=RATE_TYPE_CHOICES, default=RATE_TELLER, verbose_name='نوع الأسعار', db_index=True)
    set_by     = models.CharField(max_length=150, blank=True, verbose_name='نشر بواسطة')
    rates_json = models.JSONField(default=dict, verbose_name='بيانات الأسعار')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'أسعار صرف'
        verbose_name_plural = 'سجلات أسعار الصرف'

    def __str__(self):
        t = self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else ''
        return f'أسعار {t} — بواسطة {self.set_by}'


# ── صلاحيات التلرات — تُعيَّن من المشرف وتُقرأ من التلر ─────────────────────

class TellerPermission(models.Model):
    """صلاحيات تلر محدد — سجل واحد لكل تلر يُحدَّث عند التغيير"""

    teller_username  = models.CharField(max_length=150, unique=True, verbose_name='اسم المستخدم')
    exchange         = models.BooleanField(default=True,  verbose_name='قسم الصرافة')
    international    = models.BooleanField(default=True,  verbose_name='الحوالات الدولية')
    electronic       = models.BooleanField(default=True,  verbose_name='المعاملات الإلكترونية')
    accounts         = models.BooleanField(default=True,  verbose_name='إدارة الحسابات')
    special_price    = models.BooleanField(default=False, verbose_name='السعر المميز')
    double_delivery  = models.BooleanField(default=False, verbose_name='التسليم المزدوج')
    updated_by       = models.CharField(max_length=150, blank=True, verbose_name='عُدِّل بواسطة')
    updated_at       = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = 'صلاحيات تلر'
        verbose_name_plural = 'صلاحيات التلرات'

    def __str__(self):
        return f'صلاحيات {self.teller_username}'

    def to_dict(self):
        return {
            'teller':         self.teller_username,
            'exchange':       self.exchange,
            'international':  self.international,
            'electronic':     self.electronic,
            'accounts':       self.accounts,
            'specialPrice':   self.special_price,
            'doubleDelivery': self.double_delivery,
            'updatedBy':      self.updated_by,
            'updatedAt':      self.updated_at.isoformat(),
        }


# ── صلاحيات الصفحات لكل دور — تُدار من الإدارة العامة ────────────────────────

class RolePagePermission(models.Model):
    """صلاحيات الصفحات المسموح بها لكل دور — سجل واحد لكل دور"""

    role       = models.CharField(max_length=4, unique=True, verbose_name='الدور')
    pages      = models.JSONField(default=list, verbose_name='الصفحات المسموح بها')
    updated_by = models.CharField(max_length=150, blank=True, verbose_name='عُدِّل بواسطة')
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = 'صلاحيات دور'
        verbose_name_plural = 'صلاحيات الأدوار'

    def __str__(self):
        return f'صلاحيات {self.role}'


# ── قائمة التلرات — تُدار من مشرف التلر ─────────────────────────────────────

class TellerProfile(models.Model):
    """بيانات التلر الثابتة — تُنشأ وتُحذف من المشرف"""

    teller_id  = models.CharField(max_length=10, unique=True, verbose_name='رقم التلر')   # T001
    name       = models.CharField(max_length=150, verbose_name='الاسم المعروض')
    username   = models.CharField(max_length=150, unique=True, verbose_name='اسم المستخدم')
    phone      = models.CharField(max_length=20, blank=True, verbose_name='رقم الهاتف')
    status     = models.CharField(max_length=10, default='offline', verbose_name='الحالة')
    balance    = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد الصندوق (دولار تقريبي)')
    currency   = models.CharField(max_length=5, default='USD')
    ops        = models.IntegerField(default=0, verbose_name='عمليات اليوم')
    login_time = models.CharField(max_length=20, default='—', verbose_name='وقت الدخول')
    last_op    = models.CharField(max_length=20, default='—', verbose_name='آخر عملية')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['teller_id']
        verbose_name = 'ملف تلر'
        verbose_name_plural = 'ملفات التلرات'

    def __str__(self):
        return f'{self.teller_id} — {self.name} ({self.username})'

    def to_dict(self):
        bal = TellerBalance.objects.filter(teller_username=self.username).first()
        return {
            'id':        self.teller_id,
            'name':      self.name,
            'username':  self.username,
            'phone':     self.phone,
            'status':    self.status,
            'balance':   float(bal.usd) if bal else float(self.balance),
            'currency':  self.currency,
            'balanceUSD': float(bal.usd) if bal else 0,
            'balanceILS': float(bal.ils) if bal else 0,
            'balanceJOD': float(bal.jod) if bal else 0,
            'ops':       self.ops,
            'loginTime': self.login_time,
            'lastOp':    self.last_op,
        }


# ── أرصدة صناديق التلرات — تُحدَّث من مشرف التلر ────────────────────────────

class TellerBalance(models.Model):
    """رصيد الصندوق الافتتاحي لتلر محدد — يُعيَّن من المشرف"""

    ACTION_CHOICES = [
        ('set', 'تعيين'),
        ('add', 'إضافة'),
    ]

    teller_username = models.CharField(max_length=150, verbose_name='اسم المستخدم للتلر')
    teller_name     = models.CharField(max_length=150, blank=True, verbose_name='الاسم المعروض')
    usd             = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='دولار')
    ils             = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='شيكل')
    jod             = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='دينار')
    action          = models.CharField(max_length=5, choices=ACTION_CHOICES, default='set')
    set_by          = models.CharField(max_length=150, blank=True, verbose_name='عُيِّن بواسطة')
    session_id      = models.CharField(max_length=60, blank=True, verbose_name='معرف الجلسة')
    created_at      = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'رصيد تلر'
        verbose_name_plural = 'أرصدة التلرات'
        indexes = [
            models.Index(fields=['teller_username', 'action', 'created_at'],
                         name='tbal_username_action_idx'),
        ]

    def __str__(self):
        return f'{self.teller_username} — ${self.usd} ₪{self.ils} JD{self.jod}'

    def to_dict(self):
        return {
            'teller':    self.teller_username,
            'name':      self.teller_name,
            'USD':       self.usd,
            'ILS':       self.ils,
            'JOD':       self.jod,
            'action':    self.action,
            'setBy':     self.set_by,
            'sessionId': self.session_id,
            'timestamp': self.created_at.isoformat(),
        }


# ── جلسات صناديق التلرات ─────────────────────────────────────────────────────

class TellerSession(models.Model):
    """جلسة صندوق التلر — تُفتح من المشرف وتُغلق من التلر"""

    STATUS_CHOICES = [
        ('pending', 'في انتظار التأكيد'),
        ('open',    'مفتوحة'),
        ('closed',  'مغلقة'),
    ]

    session_id       = models.CharField(max_length=30, unique=True, verbose_name='رقم الجلسة')
    teller_username  = models.CharField(max_length=150, db_index=True, verbose_name='التلر')
    teller_name      = models.CharField(max_length=150, blank=True)
    opened_by        = models.CharField(max_length=150, blank=True, verbose_name='فُتحت بواسطة')
    status           = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    opening_usd      = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    opening_ils      = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    opening_jod      = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    closing_usd      = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    closing_ils      = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    closing_jod      = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    closing_note     = models.TextField(blank=True)
    opened_at        = models.DateTimeField(default=timezone.now)
    confirmed_at     = models.DateTimeField(null=True, blank=True)
    closed_at        = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-opened_at']
        verbose_name = 'جلسة تلر'
        verbose_name_plural = 'جلسات التلرات'

    def __str__(self):
        return f'{self.session_id} — {self.teller_username} ({self.status})'

    def to_dict(self):
        return {
            'id':           self.session_id,
            'teller':       self.teller_username,
            'tellerName':   self.teller_name,
            'openedBy':     self.opened_by,
            'status':       self.status,
            'openingBalance': {
                'USD': float(self.opening_usd),
                'ILS': float(self.opening_ils),
                'JOD': float(self.opening_jod),
            },
            'closingBalance': {
                'USD': float(self.closing_usd) if self.closing_usd is not None else None,
                'ILS': float(self.closing_ils) if self.closing_ils is not None else None,
                'JOD': float(self.closing_jod) if self.closing_jod is not None else None,
            } if self.closing_usd is not None else None,
            'openedAt':     self.opened_at.isoformat(),
            'confirmedAt':  self.confirmed_at.isoformat() if self.confirmed_at else None,
            'closedAt':     self.closed_at.isoformat() if self.closed_at else None,
        }


# ── صندوق المشرف — يُموَّل من الإدارة ويوزع على التلرات ──────────────────────

class SupervisorBox(models.Model):
    """صندوق كل مشرف تلر — الإدارة تضع فيه، والمشرف يوزع على تلراته"""

    supervisor_username = models.CharField(max_length=150, unique=True, verbose_name='اسم مستخدم المشرف')
    supervisor_name     = models.CharField(max_length=150, blank=True,  verbose_name='الاسم المعروض')
    balance_usd         = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد دولار')
    balance_ils         = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد شيكل')
    balance_jod         = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='رصيد دينار')
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'صندوق مشرف'
        verbose_name_plural = 'صناديق المشرفين'

    def __str__(self):
        return f'صندوق {self.supervisor_name or self.supervisor_username}'

    def to_dict(self):
        return {
            'username':   self.supervisor_username,
            'name':       self.supervisor_name,
            'balanceUSD': float(self.balance_usd),
            'balanceILS': float(self.balance_ils),
            'balanceJOD': float(self.balance_jod),
            'updatedAt':  self.updated_at.isoformat(),
        }


class SupervisorBoxLog(models.Model):
    """سجل كل عملية على صندوق المشرف — إيداع أو توزيع أو استرداد"""

    TYPE_CHOICES = [
        ('deposit',   'إيداع من الإدارة'),
        ('distribute','توزيع على تلر'),
        ('reclaim',   'استرداد من تلر'),
    ]
    CURRENCY_CHOICES = [('USD','دولار'),('ILS','شيكل'),('JOD','دينار')]

    supervisor_username = models.CharField(max_length=150, verbose_name='المشرف')
    op_type             = models.CharField(max_length=12, choices=TYPE_CHOICES)
    currency            = models.CharField(max_length=3,  choices=CURRENCY_CHOICES, default='USD')
    amount              = models.DecimalField(max_digits=14, decimal_places=4)
    balance_after       = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    teller_username     = models.CharField(max_length=150, blank=True, verbose_name='التلر (عند التوزيع)')
    notes               = models.TextField(blank=True)
    created_by          = models.CharField(max_length=150, blank=True)
    created_at          = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering            = ['-created_at']
        verbose_name        = 'حركة صندوق مشرف'
        verbose_name_plural = 'حركات صناديق المشرفين'

    def to_dict(self):
        return {
            'id':         self.pk,
            'supervisor': self.supervisor_username,
            'type':       self.op_type,
            'currency':   self.currency,
            'amount':     float(self.amount),
            'balAfter':   float(self.balance_after),
            'teller':     self.teller_username,
            'notes':      self.notes,
            'createdBy':  self.created_by,
            'createdAt':  self.created_at.isoformat(),
        }


# ── مجموعات العملاء — تُدار من مشرف الحوالات ─────────────────────────────────

class ClientGroup(models.Model):
    """مجموعة عملاء ترتبط بمشرف الحوالات — تُستخدم لتصنيف المرسلين"""

    name        = models.CharField(max_length=200, verbose_name='اسم المجموعة')
    color       = models.CharField(max_length=20, default='#32b8c6', verbose_name='اللون')
    icon        = models.CharField(max_length=10, default='👥', verbose_name='الأيقونة')
    description = models.TextField(blank=True, verbose_name='وصف')
    count       = models.IntegerField(default=0, verbose_name='عدد العملاء')
    created_by  = models.CharField(max_length=150, blank=True, verbose_name='أنشأها')
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['name']
        verbose_name = 'مجموعة عملاء'
        verbose_name_plural = 'مجموعات العملاء'

    def __str__(self):
        return self.name

    def to_dict(self):
        return {
            'id':          self.id,
            'name':        self.name,
            'color':       self.color,
            'icon':        self.icon,
            'description': self.description,
            'count':       self.count,
            'createdBy':   self.created_by,
            'createdAt':   self.created_at.isoformat(),
        }


# ── وكلاء التنفيذ — يُديرهم مشرف الحوالات ───────────────────────────────────

class ExecutionAgent(models.Model):
    """وكيل تنفيذ يستقبل الحوالات وينفذها ميدانياً"""

    STATUS_CHOICES = [
        ('active',  'نشط'),
        ('busy',    'مشغول'),
        ('offline', 'غير متاح'),
    ]

    name         = models.CharField(max_length=200, verbose_name='اسم الوكيل')
    color        = models.CharField(max_length=20, default='#34d399', verbose_name='اللون')
    icon         = models.CharField(max_length=10, default='🤝', verbose_name='الأيقونة')
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active',
                                    verbose_name='الحالة')
    phone        = models.CharField(max_length=30, blank=True, verbose_name='رقم الهاتف')
    currencies   = models.CharField(max_length=100, default='USD,ILS,JOD',
                                    verbose_name='العملات المدعومة')
    commission   = models.DecimalField(max_digits=6, decimal_places=4, default=0, verbose_name='عمولة %')
    max_capacity = models.IntegerField(default=50, verbose_name='الطاقة القصوى')
    current_load = models.IntegerField(default=0, verbose_name='التحميل الحالي')
    responsible  = models.CharField(max_length=150, blank=True, verbose_name='المسؤول')
    notes        = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by   = models.CharField(max_length=150, blank=True, verbose_name='أنشأه')
    created_at   = models.DateTimeField(default=timezone.now)

    # ── تواصل واتساب ─────────────────────────────────────────────────────────
    whatsapp_number = models.CharField(max_length=30, blank=True,
                                       verbose_name='رقم واتساب',
                                       help_text='الرقم الدولي بدون + مثال: 962791234567')

    # ── بوابة الوكيل الخارجي ─────────────────────────────────────────────────
    email        = models.EmailField(blank=True, verbose_name='البريد الإلكتروني')
    country      = models.CharField(max_length=100, blank=True, verbose_name='البلد')
    pin_hash     = models.CharField(max_length=128, blank=True, verbose_name='رمز PIN')
    portal_active = models.BooleanField(default=False, verbose_name='بوابة مفعّلة')
    last_seen    = models.DateTimeField(null=True, blank=True, verbose_name='آخر ظهور')

    class Meta:
        ordering = ['name']
        verbose_name = 'وكيل تنفيذ'
        verbose_name_plural = 'وكلاء التنفيذ'

    def __str__(self):
        return f'{self.name} ({self.get_status_display()})'

    def set_pin(self, raw_pin: str):
        import hashlib
        self.pin_hash = hashlib.sha256(raw_pin.strip().encode()).hexdigest()

    def check_pin(self, raw_pin: str) -> bool:
        import hashlib
        return self.pin_hash == hashlib.sha256(raw_pin.strip().encode()).hexdigest()

    def to_dict(self):
        return {
            'id':           self.id,
            'name':         self.name,
            'color':        self.color,
            'icon':         self.icon,
            'status':       self.status,
            'phone':          self.phone,
            'whatsappNumber': self.whatsapp_number,
            'email':          self.email,
            'country':        self.country,
            'currencies':   self.currencies.split(',') if self.currencies else [],
            'commission':   float(self.commission),
            'maxCapacity':  self.max_capacity,
            'currentLoad':  self.current_load,
            'responsible':  self.responsible,
            'notes':        self.notes,
            'portalActive': self.portal_active,
            'lastSeen':     self.last_seen.isoformat() if self.last_seen else None,
            'createdBy':    self.created_by,
            'createdAt':    self.created_at.isoformat(),
        }


# ── رصيد الوكيل (USDT) — تكامل مع HawalaNet Pro ──────────────────────────────

class AgentBalance(models.Model):
    """سجل رصيد USDT للوكيل — كل عملية إيداع أو خصم تُحفظ كسجل منفصل"""

    TXN_CHOICES = [
        ('deposit',    'إيداع'),
        ('deduct',     'خصم - تنفيذ حوالة'),
        ('commission', 'عمولة'),
        ('refund',     'استرداد'),
    ]

    agent        = models.ForeignKey('ExecutionAgent', on_delete=models.CASCADE,
                                     related_name='balance_logs', verbose_name='الوكيل')
    txn_type     = models.CharField(max_length=15, choices=TXN_CHOICES, verbose_name='نوع العملية')
    amount_usdt  = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ USDT')
    balance_after= models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='الرصيد بعد العملية')
    hawala_ref   = models.CharField(max_length=50, blank=True, verbose_name='رقم الحوالة')
    notes        = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by   = models.CharField(max_length=150, blank=True, verbose_name='بواسطة')
    created_at   = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'رصيد وكيل'
        verbose_name_plural = 'أرصدة الوكلاء'

    def __str__(self):
        return f'{self.agent.name} | {self.txn_type} | {self.amount_usdt} USDT'

    def to_dict(self):
        return {
            'id':           self.id,
            'agentId':      self.agent_id,
            'agentName':    self.agent.name,
            'txnType':      self.txn_type,
            'txnLabel':     self.get_txn_type_display(),
            'amountUsdt':   self.amount_usdt,
            'balanceAfter': self.balance_after,
            'hawalaRef':    self.hawala_ref,
            'notes':        self.notes,
            'createdBy':    self.created_by,
            'createdAt':    self.created_at.isoformat(),
        }


class AgentReceipt(models.Model):
    """إيصال تنفيذ الحوالة الذي يرفعه الوكيل كإثبات"""

    agent        = models.ForeignKey('ExecutionAgent', on_delete=models.CASCADE,
                                     related_name='receipts', verbose_name='الوكيل')
    transfer     = models.OneToOneField('HawalaTransfer', on_delete=models.CASCADE,
                                        related_name='receipt', verbose_name='الحوالة',
                                        null=True, blank=True)
    hawala_ref   = models.CharField(max_length=50, blank=True, verbose_name='رقم الحوالة')
    image        = models.ImageField(upload_to='receipts/%Y/%m/', null=True, blank=True,
                                     verbose_name='صورة الإيصال')
    notes        = models.TextField(blank=True, verbose_name='ملاحظات')
    is_verified  = models.BooleanField(default=False, verbose_name='تم التحقق')
    verified_by  = models.CharField(max_length=150, blank=True, verbose_name='تحقق بواسطة')
    verified_at  = models.DateTimeField(null=True, blank=True, verbose_name='وقت التحقق')
    created_at   = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'إيصال تنفيذ'
        verbose_name_plural = 'إيصالات التنفيذ'

    def to_dict(self):
        return {
            'id':          self.id,
            'agentId':     self.agent_id,
            'agentName':   self.agent.name,
            'hawalaRef':   self.hawala_ref,
            'imageUrl':    self.image.url if self.image else '',
            'notes':       self.notes,
            'isVerified':  self.is_verified,
            'verifiedBy':  self.verified_by,
            'verifiedAt':  self.verified_at.isoformat() if self.verified_at else None,
            'createdAt':   self.created_at.isoformat(),
        }


# ── مناطق عمل الوكيل ─────────────────────────────────────────────────────��───

class AgentLocation(models.Model):
    """منطقة عمل وكيل التنفيذ — بلد + مدينة"""

    agent       = models.ForeignKey('ExecutionAgent', on_delete=models.CASCADE,
                                    related_name='locations', verbose_name='الوكيل')
    country     = models.CharField(max_length=100, verbose_name='البلد')
    city        = models.CharField(max_length=100, blank=True, verbose_name='المدينة / المنطقة')
    is_primary  = models.BooleanField(default=False, verbose_name='المنطقة الرئيسية')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-is_primary', 'country', 'city']
        verbose_name = 'منطقة عمل'
        verbose_name_plural = 'مناطق العمل'
        unique_together = [('agent', 'country', 'city')]

    def __str__(self):
        return f'{self.agent.name} — {self.country} / {self.city}'

    def to_dict(self):
        return {
            'id':        self.id,
            'agentId':   self.agent_id,
            'country':   self.country,
            'city':      self.city,
            'isPrimary': self.is_primary,
            'notes':     self.notes,
            'createdAt': self.created_at.isoformat(),
        }


# ── تسعير الحوالات لكل وكيل ───────────────────────────────────────────────────

class AgentTransferRate(models.Model):
    """سعر الحوالة لوكيل معين في بلد معين — يضبطه مشرف الحوالات يدوياً"""

    agent         = models.ForeignKey('ExecutionAgent', on_delete=models.CASCADE,
                                      related_name='transfer_rates', verbose_name='الوكيل')
    country       = models.CharField(max_length=100, verbose_name='البلد')
    currency      = models.CharField(max_length=10, default='USD', verbose_name='العملة')
    rate          = models.DecimalField(max_digits=14, decimal_places=6, default=1,
                                        verbose_name='سعر الصرف (وحدة / USD)')
    fee_flat      = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                        verbose_name='رسوم ثابتة')
    fee_pct       = models.DecimalField(max_digits=6, decimal_places=3, default=0,
                                        verbose_name='عمولة %')
    min_amount    = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                        verbose_name='الحد الأدنى للحوالة')
    max_amount    = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                        verbose_name='الحد الأقصى (0 = بلا حد)')
    is_active     = models.BooleanField(default=True, verbose_name='مفعّل')
    notes         = models.TextField(blank=True, verbose_name='ملاحظات')
    updated_by    = models.CharField(max_length=150, blank=True, verbose_name='آخر تعديل بواسطة')
    updated_at    = models.DateTimeField(auto_now=True)
    created_at    = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['country', 'currency']
        verbose_name = 'سعر حوالة'
        verbose_name_plural = 'أسعار الحوالات'
        unique_together = [('agent', 'country', 'currency')]

    def __str__(self):
        return f'{self.agent.name} | {self.country} | {self.currency} @ {self.rate}'

    def to_dict(self):
        return {
            'id':        self.id,
            'agentId':   self.agent_id,
            'agentName': self.agent.name,
            'country':   self.country,
            'currency':  self.currency,
            'rate':      float(self.rate),
            'feeFlat':   float(self.fee_flat),
            'feePct':    float(self.fee_pct),
            'minAmount': float(self.min_amount),
            'maxAmount': float(self.max_amount),
            'isActive':  self.is_active,
            'notes':     self.notes,
            'updatedBy': self.updated_by,
            'updatedAt': self.updated_at.isoformat(),
        }


# ── سجل الحوالات الكاملة — يُدار من مشرف الحوالات وموظفيه ──────────────────

class HawalaTransfer(models.Model):
    """سجل حوالة مالية كامل مع تتبع التنفيذ والوكيل"""

    STATUS_CHOICES = [
        ('pending',    'بانتظار'),
        ('processing', 'قيد التنفيذ'),
        ('completed',  'تم التنفيذ'),
        ('cancelled',  'ملغاة'),
        ('rejected',   'مرفوضة'),
    ]

    ref_number   = models.CharField(max_length=30, unique=True, verbose_name='رقم الحوالة')
    sender_name  = models.CharField(max_length=200, verbose_name='اسم المرسل')
    sender_phone = models.CharField(max_length=30, blank=True, verbose_name='هاتف المرسل')
    receiver_name= models.CharField(max_length=200, verbose_name='اسم المستلم')
    receiver_phone=models.CharField(max_length=30, blank=True, verbose_name='هاتف المستلم')
    amount       = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ')
    currency     = models.CharField(max_length=5, default='USD', verbose_name='العملة')
    destination  = models.CharField(max_length=200, blank=True, verbose_name='الوجهة')
    status       = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending',
                                    verbose_name='الحالة')
    agent        = models.ForeignKey(ExecutionAgent, null=True, blank=True,
                                     on_delete=models.SET_NULL, verbose_name='الوكيل المنفذ')
    client_group = models.ForeignKey(ClientGroup, null=True, blank=True,
                                     on_delete=models.SET_NULL, verbose_name='مجموعة العميل')
    commission      = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='العمولة')
    notes           = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by      = models.CharField(max_length=150, blank=True, verbose_name='أنشأها')
    completed_by    = models.CharField(max_length=150, blank=True, verbose_name='نفّذها')
    created_at      = models.DateTimeField(default=timezone.now)
    completed_at    = models.DateTimeField(null=True, blank=True)
    # ── حقول تكامل HawalaNet Pro ───────────────────────────────────────────────
    frozen_usdt     = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='USDT مجمّد عند الوكيل')
    agent_confirmed = models.BooleanField(default=False, verbose_name='أكد الوكيل التنفيذ')
    agent_confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name='وقت تأكيد الوكيل')
    is_urgent       = models.BooleanField(default=False, verbose_name='مستعجل')
    # ── Soft Delete — لا نحذف السجل المالي أبداً ─────────────────────────────
    is_deleted      = models.BooleanField(default=False, verbose_name='محذوف')
    deleted_at      = models.DateTimeField(null=True, blank=True, verbose_name='وقت الحذف')
    deleted_by      = models.CharField(max_length=150, blank=True, verbose_name='حذفها')

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'حوالة'
        verbose_name_plural = 'الحوالات'
        indexes = [
            models.Index(fields=['status', 'created_at'],  name='hw_tr_status_date_idx'),
            models.Index(fields=['agent', 'status'],       name='hw_tr_agent_status_idx'),
            models.Index(fields=['is_deleted'],            name='hw_tr_deleted_idx'),
        ]

    def __str__(self):
        return f'{self.ref_number} — {self.sender_name} → {self.receiver_name}'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            import secrets
            self.ref_number = f'HW-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000) + 1000}'
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id':            self.id,
            'refNumber':     self.ref_number,
            'senderName':    self.sender_name,
            'senderPhone':   self.sender_phone,
            'receiverName':  self.receiver_name,
            'receiverPhone': self.receiver_phone,
            'amount':        self.amount,
            'currency':      self.currency,
            'destination':   self.destination,
            'status':        self.status,
            'agent':         self.agent.to_dict() if self.agent else None,
            'agentId':       self.agent_id,
            'clientGroup':   self.client_group.to_dict() if self.client_group else None,
            'clientGroupId': self.client_group_id,
            'commission':       self.commission,
            'notes':            self.notes,
            'createdBy':        self.created_by,
            'completedBy':      self.completed_by,
            'createdAt':        self.created_at.isoformat(),
            'completedAt':      self.completed_at.isoformat() if self.completed_at else None,
            # حقول HawalaNet Pro
            'isUrgent':         self.is_urgent,
            'frozenUsdt':       self.frozen_usdt,
            'agentConfirmed':   self.agent_confirmed,
            'agentConfirmedAt': self.agent_confirmed_at.isoformat() if self.agent_confirmed_at else None,
        }


# ── التحويلات البنكية — يُديرها موظف T02 ─────────────────────────────────────

class BankTransfer(models.Model):
    """عملية تحويل بنكي (واردة أو صادرة — محلي أو دولي)"""

    TYPE_CHOICES = [
        ('incoming', 'حوالة واردة'),
        ('outgoing', 'تحويل صادر'),
        ('buy',      'شراء عبر البنك'),
        ('sell',     'بيع عبر البنك'),
    ]
    STATUS_CHOICES = [
        ('pending',     'بانتظار'),
        ('in_progress', 'قيد التنفيذ'),
        ('completed',   'مكتمل'),
        ('cancelled',   'ملغى'),
        ('rejected',    'مرفوض'),
    ]

    ref_number    = models.CharField(max_length=30, unique=True, verbose_name='رقم العملية')
    transfer_type = models.CharField(max_length=10, choices=TYPE_CHOICES, verbose_name='النوع')
    sender_name   = models.CharField(max_length=200, blank=True, verbose_name='اسم المرسل/المشتري')
    receiver_name = models.CharField(max_length=200, blank=True, verbose_name='اسم المستلم/البائع')
    amount        = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ')
    currency      = models.CharField(max_length=5, default='USD', verbose_name='العملة')
    exchange_rate = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر الصرف')
    bank_name     = models.CharField(max_length=200, blank=True, verbose_name='اسم البنك')
    account_number= models.CharField(max_length=100, blank=True, verbose_name='رقم الحساب')
    iban          = models.CharField(max_length=50, blank=True, verbose_name='IBAN')
    swift_code    = models.CharField(max_length=20, blank=True, verbose_name='SWIFT')
    status        = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending',
                                     verbose_name='الحالة')
    notes         = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by    = models.CharField(max_length=150, blank=True, verbose_name='أنشأها')
    completed_by  = models.CharField(max_length=150, blank=True, verbose_name='أكملها')
    created_at    = models.DateTimeField(default=timezone.now)
    completed_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'تحويل بنكي'
        verbose_name_plural = 'التحويلات البنكية'

    def __str__(self):
        return f'{self.ref_number} — {self.get_transfer_type_display()} {self.amount} {self.currency}'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            import secrets
            self.ref_number = f'BK-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000) + 1000}'
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id':            self.id,
            'refNumber':     self.ref_number,
            'type':          self.transfer_type,
            'typeDisplay':   self.get_transfer_type_display(),
            'senderName':    self.sender_name,
            'receiverName':  self.receiver_name,
            'amount':        self.amount,
            'currency':      self.currency,
            'exchangeRate':  self.exchange_rate,
            'bankName':      self.bank_name,
            'accountNumber': self.account_number,
            'iban':          self.iban,
            'swiftCode':     self.swift_code,
            'status':        self.status,
            'notes':         self.notes,
            'createdBy':     self.created_by,
            'completedBy':   self.completed_by,
            'createdAt':     self.created_at.isoformat(),
            'completedAt':   self.completed_at.isoformat() if self.completed_at else None,
        }


# ── تعليمات الإدارة العامة للمشرفين ──────────────────────────────────────────

class AdminInstruction(models.Model):
    """رسالة أو تعليمة من الإدارة العامة (M01) لمشرف محدد أو لكل المشرفين"""

    PRIORITY_CHOICES = [
        ('normal', 'عادية'),
        ('high',   'عالية'),
        ('urgent', 'عاجلة'),
    ]

    title       = models.CharField(max_length=300, verbose_name='العنوان')
    body        = models.TextField(verbose_name='نص التعليمة')
    priority    = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal',
                                   verbose_name='الأولوية')
    target_role = models.CharField(max_length=5, blank=True,
                                   verbose_name='الدور المستهدف (فارغ = كل المشرفين)')
    target_user = models.CharField(max_length=150, blank=True,
                                   verbose_name='المستخدم المستهدف (اختياري)')
    is_read     = models.BooleanField(default=False, verbose_name='تمت القراءة')
    read_by     = models.CharField(max_length=150, blank=True, verbose_name='قرأها')
    read_at     = models.DateTimeField(null=True, blank=True)
    created_by  = models.CharField(max_length=150, blank=True, verbose_name='أنشأها')
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'تعليمة إدارية'
        verbose_name_plural = 'تعليمات الإدارة'

    def __str__(self):
        return f'[{self.priority}] {self.title}'

    def to_dict(self):
        return {
            'id':         self.id,
            'title':      self.title,
            'body':       self.body,
            'priority':   self.priority,
            'targetRole': self.target_role,
            'targetUser': self.target_user,
            'isRead':     self.is_read,
            'readBy':     self.read_by,
            'readAt':     self.read_at.isoformat() if self.read_at else None,
            'createdBy':  self.created_by,
            'createdAt':  self.created_at.isoformat(),
        }


# ── تقارير المشرفين للإدارة العامة ───────────────────────────────────────────

class SupervisorReport(models.Model):
    """تقرير يرفعه المشرف للإدارة العامة من أي صفحة"""

    PAGE_CHOICES = [
        ('tellerMgr',    'مشرف التلر'),
        ('tellerDept',   'أقسام التلر'),
        ('transSuper',   'مشرف الحوالات'),
        ('transactions', 'الحوالات'),
        ('bankTransfer', 'التحويل البنكي'),
    ]

    page        = models.CharField(max_length=20, choices=PAGE_CHOICES, verbose_name='الصفحة')
    title       = models.CharField(max_length=300, verbose_name='عنوان التقرير')
    body        = models.TextField(verbose_name='محتوى التقرير')
    branch      = models.CharField(max_length=200, blank=True, verbose_name='الفرع')
    submitted_by= models.CharField(max_length=150, blank=True, verbose_name='قدّمه')
    is_read     = models.BooleanField(default=False, verbose_name='قرأه المدير')
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'تقرير مشرف'
        verbose_name_plural = 'تقارير المشرفين'

    def __str__(self):
        return f'[{self.page}] {self.title} — {self.submitted_by}'

    def to_dict(self):
        return {
            'id':          self.id,
            'page':        self.page,
            'pageDisplay': self.get_page_display(),
            'title':       self.title,
            'body':        self.body,
            'branch':      self.branch,
            'submittedBy': self.submitted_by,
            'isRead':      self.is_read,
            'createdAt':   self.created_at.isoformat(),
        }


# ── الصور المرفوعة من التطبيق ─────────────────────────────────────────────────

class UploadedImage(models.Model):
    image       = models.ImageField(upload_to='uploads/%Y/%m/%d/')
    description = models.TextField(blank=True)
    location    = models.CharField(max_length=255, blank=True)
    user_id     = models.CharField(max_length=100, blank=True)
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'صورة مرفوعة'
        verbose_name_plural = 'الصور المرفوعة'

    def __str__(self):
        return f'صورة {self.id} — {self.uploaded_at:%Y-%m-%d %H:%M}'


# ── سجل المراجعة (Audit Log) ──────────────────────────────────────────────────

class AuditLog(models.Model):
    """
    يُسجَّل تلقائياً لكل عملية مالية أو إدارية مهمة.
    لا يُحذف ولا يُعدَّل — للقراءة فقط.
    """

    ACTION_CHOICES = [
        # مصادقة
        ('login',            'تسجيل دخول'),
        ('logout',           'تسجيل خروج'),
        ('login_failed',     'محاولة دخول فاشلة'),
        # تحويلات بنكية
        ('bk_create',        'إنشاء تحويل بنكي'),
        ('bk_complete',      'تنفيذ تحويل بنكي'),
        ('bk_reject',        'رفض تحويل بنكي'),
        ('bk_status',        'تغيير حالة تحويل بنكي'),
        # التلر
        ('tl_exchange',      'عملية صرافة'),
        ('tl_hawala',        'حوالة دولية'),
        ('tl_cash',          'إيداع/سحب نقدي'),
        ('tl_session_open',  'فتح جلسة تلر'),
        ('tl_session_close', 'إغلاق جلسة تلر'),
        # الحوالات
        ('ts_create',        'إنشاء حوالة'),
        ('ts_update',        'تعديل حوالة'),
        ('ts_delete',        'حذف حوالة'),
        # إدارة المستخدمين
        ('user_create',      'إنشاء مستخدم'),
        ('user_update',      'تعديل مستخدم'),
        ('user_delete',      'حذف مستخدم'),
        ('user_password',    'تغيير كلمة مرور'),
        # الفروع
        ('branch_create',    'إنشاء فرع'),
        ('branch_update',    'تعديل فرع'),
        ('branch_transfer',  'تحويل رصيد بين فروع'),
        # أخرى
        ('other',            'أخرى'),
    ]

    action      = models.CharField(max_length=30, choices=ACTION_CHOICES, verbose_name='الإجراء')
    actor       = models.CharField(max_length=150, verbose_name='المنفِّذ')         # username
    actor_role  = models.CharField(max_length=10,  blank=True, verbose_name='دوره')
    target      = models.CharField(max_length=300, blank=True, verbose_name='الهدف')  # ref / username / id
    amount      = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    currency    = models.CharField(max_length=5, blank=True)
    detail      = models.TextField(blank=True, verbose_name='تفاصيل')
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    created_at  = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering       = ['-created_at']
        verbose_name   = 'سجل مراجعة'
        verbose_name_plural = 'سجل المراجعة'

    def __str__(self):
        return f'[{self.created_at:%Y-%m-%d %H:%M}] {self.actor} — {self.get_action_display()}'

    @classmethod
    def log(cls, action: str, request=None, actor: str = '—',
            target: str = '', amount=None, currency: str = '',
            detail: str = ''):
        """
        دالة مساعدة لتسجيل حدث بسرعة من أي مكان في الكود:

            AuditLog.log('bk_complete', request=request,
                         target=transfer.ref_number,
                         amount=transfer.amount, currency=transfer.currency)
        """
        ip = None
        role = ''
        resolved_actor = actor

        if request is not None:
            from core.permissions import get_client_ip
            ip = get_client_ip(request)
            if request.user.is_authenticated:
                resolved_actor = request.user.get_full_name() or request.user.username
                role           = request.user.role

        try:
            cls.objects.create(
                action     = action,
                actor      = resolved_actor,
                actor_role = role,
                target     = str(target)[:300],
                amount     = amount,
                currency   = currency[:5] if currency else '',
                detail     = detail[:2000],
                ip_address = ip,
            )
        except Exception:
            pass   # لا نوقف العملية المالية بسبب خطأ في التسجيل


# ══════════════════════════════════════════════════════════════════════════════
#  PortalToken — رموز الدخول السحري للبوابة الخارجية
# ══════════════════════════════════════════════════════════════════════════════

class PortalToken(models.Model):
    """رمز دخول مؤقت يُرسَل عبر البريد الإلكتروني — يُستخدم مرة واحدة فقط."""
    email      = models.EmailField(db_index=True, verbose_name='البريد الإلكتروني')
    token      = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    EXPIRY_MINUTES = 15

    class Meta:
        verbose_name        = 'رمز دخول — البوابة'
        verbose_name_plural = 'رموز الدخول — البوابة'
        ordering            = ['-created_at']

    def __str__(self):
        status = 'مُستخدَم' if self.used else ('منتهي' if not self.is_valid else 'صالح')
        return f'{self.email} [{status}] — {self.created_at:%Y-%m-%d %H:%M}'

    @property
    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at

    @classmethod
    def create_for(cls, email: str, ip: str = None):
        """ينشئ رمزاً جديداً ويُلغي الرموز القديمة — atomic لمنع race condition."""
        from django.db import transaction as _tx
        with _tx.atomic():
            # قفل صفوف هذا البريد لمنع طلبين متزامنين من إنشاء رمزين
            cls.objects.select_for_update().filter(email=email, used=False).update(used=True)
            return cls.objects.create(
                email      = email,
                token      = secrets.token_urlsafe(32),
                expires_at = timezone.now() + timedelta(minutes=cls.EXPIRY_MINUTES),
                ip_address = ip,
            )


# ══════════════════════════════════════════════════════════════════════════════
#  DailyReport — التقرير اليومي للموظفين (E01)
# ══════════════════════════════════════════════════════════════════════════════

class DailyReport(models.Model):
    STATUS_CHOICES = [
        ('pending',  'قيد المراجعة'),
        ('reviewed', 'تمت المراجعة'),
        ('rejected', 'مرفوض'),
    ]

    employee    = models.ForeignKey('SystemUser', on_delete=models.CASCADE,
                                    related_name='daily_reports', verbose_name='الموظف')
    date        = models.DateField(default=timezone.now, verbose_name='تاريخ التقرير')
    content     = models.TextField(verbose_name='محتوى التقرير')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات إضافية')
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES,
                                   default='pending', verbose_name='الحالة')
    manager_note = models.TextField(blank=True, verbose_name='ملاحظة المدير')
    created_at  = models.DateTimeField(default=timezone.now, verbose_name='وقت الإرسال')
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='وقت المراجعة')
    reviewed_by = models.ForeignKey('SystemUser', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='reviewed_reports',
                                    verbose_name='راجعه')

    class Meta:
        verbose_name        = 'تقرير يومي'
        verbose_name_plural = 'التقارير اليومية'
        ordering            = ['-created_at']
        unique_together     = [('employee', 'date')]

    def __str__(self):
        return f'{self.employee.get_full_name() or self.employee.username} — {self.date}'


def _report_upload_path(instance, filename):
    return f'daily_reports/{instance.report.employee_id}/{instance.report.date}/{filename}'


class DailyReportAttachment(models.Model):
    KIND_CHOICES = [
        ('images', 'صورة'),
        ('videos', 'فيديو'),
        ('files',  'ملف'),
    ]
    report     = models.ForeignKey('DailyReport', on_delete=models.CASCADE,
                                   related_name='attachments', verbose_name='التقرير')
    file       = models.FileField(upload_to=_report_upload_path, verbose_name='الملف')
    kind       = models.CharField(max_length=10, choices=KIND_CHOICES, default='files', verbose_name='النوع')
    name       = models.CharField(max_length=255, blank=True, verbose_name='اسم الملف')
    size       = models.PositiveIntegerField(default=0, verbose_name='الحجم')
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name        = 'مرفق تقرير'
        verbose_name_plural = 'مرفقات التقارير'

    def __str__(self):
        return self.name or self.file.name


# ══════════════════════════════════════════════════════════════════════════════
#  AccountantReport — التقرير اليومي للمحاسب (E01 + accountant)
# ══════════════════════════════════════════════════════════════════════════════

class AccountantReport(models.Model):
    STATUS_CHOICES = [
        ('pending',  'قيد المراجعة'),
        ('reviewed', 'تمت المراجعة'),
        ('rejected', 'مرفوض'),
    ]

    accountant  = models.ForeignKey('SystemUser', on_delete=models.CASCADE,
                                    related_name='accountant_reports', verbose_name='المحاسب')
    date        = models.DateField(default=timezone.now, verbose_name='تاريخ التقرير')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES,
                                   default='pending', verbose_name='الحالة')
    manager_note = models.TextField(blank=True, verbose_name='ملاحظة المدير')
    created_at  = models.DateTimeField(default=timezone.now, verbose_name='وقت الإرسال')
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='وقت المراجعة')
    reviewed_by = models.ForeignKey('SystemUser', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='reviewed_acc_reports',
                                    verbose_name='راجعه')

    class Meta:
        verbose_name        = 'تقرير محاسب'
        verbose_name_plural = 'تقارير المحاسبين'
        ordering            = ['-created_at']
        unique_together     = [('accountant', 'date')]

    def __str__(self):
        return f'{self.accountant.get_full_name() or self.accountant.username} — {self.date}'


class SettlementGroup(models.Model):
    """مجموعة إرسال داخل تقرير المحاسب (اسم المجموعة · الدولة · عدد الحركات)"""
    report      = models.ForeignKey('AccountantReport', on_delete=models.CASCADE,
                                    related_name='groups', verbose_name='التقرير')
    name        = models.CharField(max_length=120, verbose_name='اسم المجموعة')
    country     = models.CharField(max_length=80, blank=True, verbose_name='الدولة')
    movements   = models.PositiveIntegerField(default=0, verbose_name='عدد الحركات')
    day_date    = models.DateField(default=timezone.now, verbose_name='تاريخ اليوم')

    class Meta:
        verbose_name        = 'مجموعة إرسال'
        verbose_name_plural = 'مجموعات الإرسال'
        ordering            = ['id']

    def __str__(self):
        return f'{self.name} ({self.country})'


def _acc_report_upload_path(instance, filename):
    return f'accountant_reports/{instance.report.accountant_id}/{instance.report.date}/{filename}'


class AccountantReportAttachment(models.Model):
    KIND_CHOICES = [
        ('images', 'صورة'),
        ('videos', 'فيديو'),
        ('files',  'ملف'),
    ]
    report     = models.ForeignKey('AccountantReport', on_delete=models.CASCADE,
                                   related_name='attachments', verbose_name='التقرير')
    file       = models.FileField(upload_to=_acc_report_upload_path, verbose_name='الملف')
    kind       = models.CharField(max_length=10, choices=KIND_CHOICES, default='files', verbose_name='النوع')
    name       = models.CharField(max_length=255, blank=True, verbose_name='اسم الملف')
    size       = models.PositiveIntegerField(default=0, verbose_name='الحجم')
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name        = 'مرفق تقرير محاسب'
        verbose_name_plural = 'مرفقات تقارير المحاسبين'

    def __str__(self):
        return self.name or self.file.name


# ══════════════════════════════════════════════════════════════════════════════
#  PasswordResetToken — رموز إعادة تعيين كلمة المرور
# ══════════════════════════════════════════════════════════════════════════════

class PasswordResetToken(models.Model):
    user       = models.ForeignKey('SystemUser', on_delete=models.CASCADE, related_name='reset_tokens')
    token      = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)

    EXPIRY_MINUTES = 30

    class Meta:
        verbose_name        = 'رمز إعادة تعيين كلمة المرور'
        verbose_name_plural = 'رموز إعادة تعيين كلمة المرور'
        ordering            = ['-created_at']

    @property
    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at

    @classmethod
    def create_for(cls, user):
        from django.db import transaction as _tx
        with _tx.atomic():
            cls.objects.select_for_update().filter(user=user, used=False).update(used=True)
            return cls.objects.create(
                user       = user,
                token      = secrets.token_urlsafe(32),
                expires_at = timezone.now() + timedelta(minutes=cls.EXPIRY_MINUTES),
            )


# ── طلبات الحوالة من بوابة العملاء ───────────────────────────────────────────

class PortalTransferRequest(models.Model):
    """طلب حوالة يرفعه عميل عبر بوابة الحوالات الخارجية."""

    STATUS_CHOICES = [
        ('new',        'جديد'),
        ('reviewing',  'قيد المراجعة'),
        ('done',       'منفّذ'),
        ('rejected',   'مرفوض'),
    ]

    # معلومات التتبع
    tracking_code = models.CharField(max_length=20, unique=True, verbose_name='رمز التتبع')

    # بيانات العميل (من الجلسة)
    client_email  = models.EmailField(verbose_name='بريد العميل')
    client_name   = models.CharField(max_length=200, blank=True, verbose_name='اسم العميل')

    # الدولة وطريقة الاستقبال
    country       = models.ForeignKey(
        'PortalCountry', null=True, blank=True,
        on_delete=models.SET_NULL, verbose_name='الدولة',
    )
    country_name  = models.CharField(max_length=100, blank=True, verbose_name='اسم الدولة')
    method_name   = models.CharField(max_length=100, blank=True, verbose_name='طريقة الاستقبال')
    currency      = models.CharField(max_length=10, blank=True, verbose_name='العملة')

    # صورة الإيصال
    receipt       = models.ImageField(
        upload_to='portal/receipts/%Y/%m/%d/',
        null=True, blank=True,
        verbose_name='صورة الإيصال',
    )

    # الحالة والمعالجة
    status        = models.CharField(
        max_length=12, choices=STATUS_CHOICES, default='new',
        verbose_name='الحالة',
    )
    notes         = models.TextField(blank=True, verbose_name='ملاحظات الموظف')
    handled_by    = models.CharField(max_length=150, blank=True, verbose_name='معالَج بواسطة')
    handled_at    = models.DateTimeField(null=True, blank=True, verbose_name='وقت المعالجة')

    # التوجيه الداخلي
    forwarded_to  = models.ForeignKey(
        'SystemUser', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='forwarded_receipts',
        verbose_name='موجَّه إلى',
    )
    forwarded_at  = models.DateTimeField(null=True, blank=True, verbose_name='وقت التوجيه')
    forwarded_by  = models.CharField(max_length=150, blank=True, verbose_name='وجَّهه')
    forwarded_note = models.TextField(blank=True, verbose_name='ملاحظة التوجيه')

    # توقيت
    created_at    = models.DateTimeField(default=timezone.now, verbose_name='وقت الإرسال')
    ip_address    = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering            = ['-created_at']
        verbose_name        = 'طلب حوالة — البوابة'
        verbose_name_plural = 'طلبات الحوالة — البوابة'

    def __str__(self):
        return f'{self.tracking_code} | {self.client_email} | {self.get_status_display()}'

    @classmethod
    def generate_code(cls) -> str:
        """كود عشوائي غير قابل للتخمين — تاريخ + 8 أحرف hex."""
        import secrets
        from django.utils import timezone as _tz
        prefix = _tz.now().strftime('%y%m%d')
        while True:
            code = f'PT-{prefix}-{secrets.token_hex(4).upper()}'
            if not cls.objects.filter(tracking_code=code).exists():
                return code

    def to_dict(self):
        fwd = self.forwarded_to
        return {
            'id':              self.id,
            'trackingCode':    self.tracking_code,
            'clientEmail':     self.client_email,
            'clientName':      self.client_name,
            'countryName':     self.country_name,
            'methodName':      self.method_name,
            'currency':        self.currency,
            'receipt':         self.receipt.url if self.receipt else None,
            'status':          self.status,
            'statusLabel':     self.get_status_display(),
            'notes':           self.notes,
            'handledBy':       self.handled_by,
            'handledAt':       self.handled_at.isoformat() if self.handled_at else None,
            'createdAt':       self.created_at.isoformat(),
            'forwardedTo':     {'id': fwd.id, 'username': fwd.username,
                                'fullName': fwd.full_name, 'role': fwd.role} if fwd else None,
            'forwardedAt':     self.forwarded_at.isoformat() if self.forwarded_at else None,
            'forwardedBy':     self.forwarded_by,
            'forwardedNote':   self.forwarded_note,
        }


# ── إعدادات بوابة العملاء — تُدار من مشرف التلر ────────────────────────────

class PortalCountry(models.Model):
    """دولة متاحة في بوابة الحوالات — يُنشئها ويُعدّلها مشرف التلر"""

    slug        = models.SlugField(max_length=10, unique=True, verbose_name='المعرّف')
    name        = models.CharField(max_length=100, verbose_name='اسم الدولة')
    flag        = models.CharField(max_length=10, default='🏳', verbose_name='العلم (Emoji)')
    currency    = models.CharField(max_length=10, verbose_name='رمز العملة')
    rate        = models.DecimalField(
        max_digits=14, decimal_places=4, default=1,
        verbose_name='سعر الصرف (مقابل USD)',
    )
    rate_note   = models.CharField(
        max_length=200, blank=True,
        verbose_name='ملاحظة السعر',
        help_text='مثال: 1 USD = 3.75 SAR',
    )
    fee_pct     = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        verbose_name='نسبة العمولة %',
        help_text='مثال: 2.5 تعني 2.5%، 0 تعني بدون عمولة',
    )
    is_active   = models.BooleanField(default=True, verbose_name='نشطة')
    order       = models.PositiveSmallIntegerField(default=0, verbose_name='الترتيب')
    updated_at  = models.DateTimeField(auto_now=True)
    updated_by  = models.CharField(max_length=150, blank=True, verbose_name='آخر تعديل بواسطة')

    class Meta:
        ordering            = ['order', 'name']
        verbose_name        = 'دولة — البوابة'
        verbose_name_plural = 'دول البوابة'

    def __str__(self):
        return f'{self.flag} {self.name} ({self.currency})'

    def to_dict(self):
        return {
            'id':        self.slug,
            'name':      self.name,
            'flag':      self.flag,
            'currency':  self.currency,
            'rate':      float(self.rate),
            'rateNote':  self.rate_note,
            'feePct':    float(self.fee_pct),
            'methods':   [m.to_dict() for m in self.methods.filter(is_active=True).order_by('order')],
        }


class PortalReceivingMethod(models.Model):
    """طريقة استقبال داخل دولة معيّنة في بوابة الحوالات"""

    country     = models.ForeignKey(
        PortalCountry, on_delete=models.CASCADE,
        related_name='methods', verbose_name='الدولة',
    )
    name        = models.CharField(max_length=100, verbose_name='اسم الطريقة')
    bank        = models.CharField(max_length=200, blank=True, verbose_name='اسم البنك / الجهة')
    iban        = models.CharField(max_length=200, blank=True, verbose_name='رقم الحساب / IBAN')
    beneficiary = models.CharField(max_length=200, blank=True, verbose_name='اسم المستفيد')
    extra_label = models.CharField(max_length=100, blank=True, verbose_name='حقل إضافي (تسمية)')
    extra_value = models.CharField(max_length=200, blank=True, verbose_name='حقل إضافي (قيمة)')
    is_active   = models.BooleanField(default=True, verbose_name='نشطة')
    order       = models.PositiveSmallIntegerField(default=0, verbose_name='الترتيب')

    class Meta:
        ordering            = ['order']
        verbose_name        = 'طريقة استقبال — البوابة'
        verbose_name_plural = 'طرق الاستقبال — البوابة'

    def __str__(self):
        return f'{self.country.name} — {self.name}'

    def to_dict(self):
        return {
            'id':          self.id,
            'name':        self.name,
            'bank':        self.bank,
            'iban':        self.iban,
            'beneficiary': self.beneficiary,
            'extraLabel':  self.extra_label,
            'extraValue':  self.extra_value,
            'isActive':    self.is_active,
            'order':       self.order,
        }


# ── طلبات التطوير — ترسلها كل الأدوار للإدارة ────────────────────────────

class DevRequest(models.Model):
    """طلب تعديل برمجي — يرسله أي موظف، تستعرضه الإدارة (M01)"""

    TYPE_CHOICES = [
        ('improve', 'تحسين'),
        ('feature', 'ميزة جديدة'),
        ('bug',     'بلاغ خطأ'),
    ]
    STATUS_CHOICES = [
        ('new',         'جديد'),
        ('in_progress', 'قيد التنفيذ'),
        ('done',        'منجز'),
        ('rejected',    'مرفوض'),
    ]

    title        = models.CharField(max_length=200, verbose_name='العنوان')
    type         = models.CharField(max_length=10, choices=TYPE_CHOICES, default='improve', verbose_name='النوع')
    description  = models.TextField(verbose_name='الوصف')
    status       = models.CharField(max_length=12, choices=STATUS_CHOICES, default='new', verbose_name='الحالة')
    sender       = models.CharField(max_length=150, verbose_name='المُرسِل (username)')
    sender_role  = models.CharField(max_length=3, verbose_name='دور المُرسِل')
    sender_page  = models.CharField(max_length=100, blank=True, verbose_name='الصفحة المُرسِلة')
    admin_notes  = models.TextField(blank=True, verbose_name='ملاحظات الإدارة')
    created_at   = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإرسال')
    updated_at   = models.DateTimeField(auto_now=True, verbose_name='آخر تحديث')

    class Meta:
        ordering            = ['-created_at']
        verbose_name        = 'طلب تطوير'
        verbose_name_plural = 'طلبات التطوير'

    def __str__(self):
        return f'[{self.get_type_display()}] {self.title} — {self.sender}'

    def to_dict(self):
        return {
            'id':          self.id,
            'title':       self.title,
            'type':        self.type,
            'typeLabel':   self.get_type_display(),
            'description': self.description,
            'status':      self.status,
            'statusLabel': self.get_status_display(),
            'sender':      self.sender,
            'senderRole':  self.sender_role,
            'senderPage':  self.sender_page,
            'adminNotes':  self.admin_notes,
            'createdAt':   self.created_at.strftime('%Y-%m-%d %H:%M'),
            'updatedAt':   self.updated_at.strftime('%Y-%m-%d %H:%M'),
        }


# ══════════════════════════════════════════════════════════════════════════════
#  نظام المهام الداخلي — Task Management
# ══════════════════════════════════════════════════════════════════════════════

class Task(models.Model):
    """مهمة يُسندها المدير لمبرمج — يستلمها وينفّذها ويُرسل التنفيذ"""

    PRIORITY_CHOICES = [
        ('low',    'عادية'),
        ('medium', 'مهمة'),
        ('high',   'عالية'),
        ('urgent', 'عاجلة'),
    ]
    STATUS_CHOICES = [
        ('new',         'جديدة'),
        ('in_progress', 'قيد التنفيذ'),
        ('submitted',   'مُسلَّمة'),
        ('accepted',    'مقبولة'),
        ('rejected',    'مرفوضة'),
    ]

    title        = models.CharField(max_length=300, verbose_name='عنوان المهمة')
    description  = models.TextField(verbose_name='الوصف التفصيلي')
    created_by   = models.ForeignKey(
        SystemUser, on_delete=models.CASCADE,
        related_name='created_tasks', verbose_name='أنشأها',
    )
    assigned_to  = models.ForeignKey(
        SystemUser, on_delete=models.CASCADE,
        related_name='assigned_tasks', verbose_name='مُكلَّف به',
    )
    priority     = models.CharField(max_length=10, choices=PRIORITY_CHOICES,
                                    default='medium', verbose_name='الأولوية')
    status       = models.CharField(max_length=15, choices=STATUS_CHOICES,
                                    default='new', verbose_name='الحالة')
    deadline     = models.DateTimeField(null=True, blank=True, verbose_name='الموعد النهائي')
    attachment   = models.FileField(upload_to='tasks/attachments/%Y/%m/',
                                    null=True, blank=True, verbose_name='مرفق من المدير')
    admin_notes  = models.TextField(blank=True, verbose_name='ملاحظات الإدارة عند الرفض')
    created_at   = models.DateTimeField(default=timezone.now)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'مهمة'
        verbose_name_plural = 'المهام'

    def __str__(self):
        return f'[{self.get_priority_display()}] {self.title} → {self.assigned_to.username}'

    def to_dict(self, include_comments=False):
        d = {
            'id':           self.id,
            'title':        self.title,
            'description':  self.description,
            'createdBy':    self.created_by.username,
            'createdByName': (f'{self.created_by.first_name} {self.created_by.last_name}'.strip()
                              or self.created_by.username),
            'assignedTo':   self.assigned_to.username,
            'assignedToName': (f'{self.assigned_to.first_name} {self.assigned_to.last_name}'.strip()
                               or self.assigned_to.username),
            'priority':     self.priority,
            'priorityLabel': self.get_priority_display(),
            'status':       self.status,
            'statusLabel':  self.get_status_display(),
            'deadline':     self.deadline.isoformat() if self.deadline else None,
            'attachment':   self.attachment.url if self.attachment else None,
            'adminNotes':   self.admin_notes,
            'createdAt':    self.created_at.isoformat(),
            'updatedAt':    self.updated_at.isoformat(),
            'submission':   self.submissions.last().to_dict() if self.submissions.exists() else None,
        }
        if include_comments:
            d['comments'] = [c.to_dict() for c in self.comments.order_by('created_at')]
        return d


class TaskSubmission(models.Model):
    """تسليم المبرمج للمهمة — ملف أو نص أو كلاهما"""

    task         = models.ForeignKey(Task, on_delete=models.CASCADE,
                                     related_name='submissions', verbose_name='المهمة')
    submitted_by = models.ForeignKey(SystemUser, on_delete=models.CASCADE,
                                     related_name='task_submissions', verbose_name='قدّمه')
    note         = models.TextField(blank=True, verbose_name='ملاحظات التسليم')
    file         = models.FileField(upload_to='tasks/submissions/%Y/%m/',
                                    null=True, blank=True, verbose_name='ملف التنفيذ')
    submitted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-submitted_at']
        verbose_name = 'تسليم مهمة'
        verbose_name_plural = 'تسليمات المهام'

    def __str__(self):
        return f'تسليم #{self.task_id} — {self.submitted_by.username}'

    def to_dict(self):
        return {
            'id':            self.id,
            'taskId':        self.task_id,
            'submittedBy':   self.submitted_by.username,
            'submittedByName': (f'{self.submitted_by.first_name} {self.submitted_by.last_name}'.strip()
                                or self.submitted_by.username),
            'note':          self.note,
            'file':          self.file.url if self.file else None,
            'submittedAt':   self.submitted_at.isoformat(),
        }


class TaskComment(models.Model):
    """تعليق بين المدير والمبرمج داخل المهمة"""

    task       = models.ForeignKey(Task, on_delete=models.CASCADE,
                                   related_name='comments', verbose_name='المهمة')
    author     = models.ForeignKey(SystemUser, on_delete=models.CASCADE,
                                   related_name='task_comments', verbose_name='الكاتب')
    body       = models.TextField(verbose_name='نص التعليق')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'تعليق مهمة'
        verbose_name_plural = 'تعليقات المهام'

    def __str__(self):
        return f'#{self.task_id} — {self.author.username}'

    def to_dict(self):
        return {
            'id':         self.id,
            'taskId':     self.task_id,
            'author':     self.author.username,
            'authorName': (f'{self.author.first_name} {self.author.last_name}'.strip()
                           or self.author.username),
            'body':       self.body,
            'createdAt':  self.created_at.isoformat(),
        }


class FlutterAuthToken(models.Model):
    """جلسة مصادقة لتطبيق Flutter — token مخزَّن كـ hash للأمان"""

    user       = models.ForeignKey(SystemUser, on_delete=models.CASCADE,
                                   related_name='flutter_tokens', verbose_name='المستخدم')
    token_hash = models.CharField(max_length=64, unique=True, verbose_name='hash الـ token')
    device_id  = models.CharField(max_length=200, blank=True, default='', verbose_name='معرف الجهاز')
    is_active  = models.BooleanField(default=True, verbose_name='نشط')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاريخ الإنشاء')
    expires_at = models.DateTimeField(verbose_name='تاريخ الانتهاء')
    last_used  = models.DateTimeField(null=True, blank=True, verbose_name='آخر استخدام')

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'جلسة Flutter'
        verbose_name_plural = 'جلسات Flutter'

    def __str__(self):
        return f'{self.user.username} — {"نشط" if self.is_active else "منتهي"}'


# ── نظام الحضور والانصراف — جهاز ZKTeco ──────────────────────────────────────

class ZKDevice(models.Model):
    """إعدادات جهاز البصمة ZKTeco"""

    name       = models.CharField(max_length=100, default='الجهاز الرئيسي', verbose_name='اسم الجهاز')
    ip         = models.GenericIPAddressField(verbose_name='عنوان IP')
    port       = models.PositiveIntegerField(default=4370, verbose_name='المنفذ')
    password   = models.PositiveIntegerField(default=0, verbose_name='كلمة المرور')
    is_active  = models.BooleanField(default=True, verbose_name='نشط')
    last_sync  = models.DateTimeField(null=True, blank=True, verbose_name='آخر مزامنة')

    class Meta:
        verbose_name        = 'جهاز بصمة'
        verbose_name_plural = 'أجهزة البصمة'

    def __str__(self):
        return f'{self.name} ({self.ip})'


class ZKEmployee(models.Model):
    """موظف مسجّل في جهاز البصمة"""

    device     = models.ForeignKey(ZKDevice, on_delete=models.CASCADE,
                                   related_name='employees', verbose_name='الجهاز')
    uid        = models.PositiveIntegerField(verbose_name='رقم في الجهاز')
    name       = models.CharField(max_length=150, verbose_name='الاسم')
    user_id    = models.CharField(max_length=50, verbose_name='معرف المستخدم')
    system_user = models.ForeignKey(SystemUser, null=True, blank=True,
                                    on_delete=models.SET_NULL,
                                    related_name='zk_profile', verbose_name='حساب النظام')

    class Meta:
        unique_together     = [('device', 'uid')]
        verbose_name        = 'موظف البصمة'
        verbose_name_plural = 'موظفو البصمة'

    def __str__(self):
        return f'{self.name} (UID: {self.uid})'


class AttendanceRecord(models.Model):
    """سجل حضور وانصراف من جهاز البصمة"""

    PUNCH_CHOICES = [
        (0, 'دخول'),
        (1, 'خروج'),
        (4, 'استراحة خروج'),
        (5, 'استراحة دخول'),
    ]

    device     = models.ForeignKey(ZKDevice, on_delete=models.CASCADE,
                                   related_name='records', verbose_name='الجهاز')
    employee   = models.ForeignKey(ZKEmployee, null=True, blank=True,
                                   on_delete=models.SET_NULL,
                                   related_name='records', verbose_name='الموظف')
    user_id    = models.CharField(max_length=50, verbose_name='معرف المستخدم')
    timestamp  = models.DateTimeField(verbose_name='وقت البصمة')
    punch      = models.SmallIntegerField(choices=PUNCH_CHOICES, default=0, verbose_name='نوع البصمة')
    synced_at     = models.DateTimeField(default=timezone.now, verbose_name='وقت المزامنة')
    is_manual     = models.BooleanField(default=False, verbose_name='بصمة يدوية')
    manual_reason = models.CharField(max_length=255, blank=True, verbose_name='سبب البصمة اليدوية')
    added_by      = models.ForeignKey('SystemUser', null=True, blank=True,
                                      on_delete=models.SET_NULL,
                                      related_name='manual_punches', verbose_name='أضيفت بواسطة')

    class Meta:
        unique_together     = [('device', 'user_id', 'timestamp')]
        ordering            = ['-timestamp']
        verbose_name        = 'سجل حضور'
        verbose_name_plural = 'سجلات الحضور'

    def __str__(self):
        punch_label = dict(self.PUNCH_CHOICES).get(self.punch, str(self.punch))
        return f'{self.user_id} — {punch_label} — {self.timestamp.strftime("%Y-%m-%d %H:%M")}'


class EmployeeNote(models.Model):
    """ملاحظات إدارية على الموظف"""

    NOTE_TYPES = [
        ('note',    'ملاحظة'),
        ('warning', 'تحذير'),
        ('praise',  'شكر وتقدير'),
    ]

    employee   = models.ForeignKey(ZKEmployee, on_delete=models.CASCADE,
                                   related_name='notes', verbose_name='الموظف')
    note_type  = models.CharField(max_length=10, choices=NOTE_TYPES, default='note',
                                  verbose_name='نوع الملاحظة')
    body       = models.TextField(verbose_name='نص الملاحظة')
    created_by = models.ForeignKey(SystemUser, null=True, blank=True,
                                   on_delete=models.SET_NULL,
                                   related_name='employee_notes', verbose_name='أضافها')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاريخ الإضافة')

    class Meta:
        ordering            = ['-created_at']
        verbose_name        = 'ملاحظة موظف'
        verbose_name_plural = 'ملاحظات الموظفين'

    def __str__(self):
        return f'{self.employee.name} — {self.get_note_type_display()} — {self.created_at.strftime("%Y-%m-%d")}'


class ExcusedAbsence(models.Model):
    """إذن غياب بعذر (إجازة، مرض، إلخ)"""

    ABSENCE_TYPES = [
        ('sick',      'إجازة مرضية'),
        ('annual',    'إجازة سنوية'),
        ('emergency', 'إجازة طارئة'),
        ('unpaid',    'غياب بدون راتب'),
        ('other',     'أخرى'),
    ]

    employee     = models.ForeignKey(ZKEmployee, on_delete=models.CASCADE,
                                     related_name='excused_absences', verbose_name='الموظف')
    absence_type = models.CharField(max_length=15, choices=ABSENCE_TYPES, default='annual',
                                    verbose_name='نوع الغياب')
    date_from    = models.DateField(verbose_name='من تاريخ')
    date_to      = models.DateField(verbose_name='إلى تاريخ')
    reason       = models.TextField(blank=True, verbose_name='السبب')
    approved_by  = models.ForeignKey(SystemUser, null=True, blank=True,
                                     on_delete=models.SET_NULL,
                                     related_name='approved_absences', verbose_name='اعتمدها')
    created_at   = models.DateTimeField(default=timezone.now, verbose_name='تاريخ التسجيل')

    class Meta:
        ordering            = ['-date_from']
        verbose_name        = 'إذن غياب'
        verbose_name_plural = 'أذونات الغياب'

    def __str__(self):
        return f'{self.employee.name} — {self.get_absence_type_display()} — {self.date_from} / {self.date_to}'


# ══════════════════════════════════════════════════════════════════════════════
#  WhatsApp Messages — رسائل واتساب الواردة (دائمة في قاعدة البيانات)
# ══════════════════════════════════════════════════════════════════════════════

class WhatsAppMessage(models.Model):
    """رسالة واتساب واردة من Baileys — تُحفظ دائماً في DB لا في الـ Cache"""

    TYPE_HAWALA = 'hawala'
    TYPE_CHAT   = 'chat'
    TYPE_IGNORE = 'ignore'

    TYPE_CHOICES = [
        (TYPE_HAWALA, 'حوالة'),
        (TYPE_CHAT,   'محادثة'),
        (TYPE_IGNORE, 'مُهمَل'),
    ]

    msg_id      = models.CharField(max_length=200, unique=True, db_index=True, verbose_name='معرف الرسالة')
    jid         = models.CharField(max_length=200, db_index=True, verbose_name='JID المجموعة/الشخص')
    is_group    = models.BooleanField(default=False, verbose_name='من مجموعة')
    group_name  = models.CharField(max_length=300, blank=True, verbose_name='اسم المجموعة')
    sender_jid  = models.CharField(max_length=200, blank=True, verbose_name='JID المرسل')
    sender_name = models.CharField(max_length=300, blank=True, verbose_name='اسم المرسل')
    text        = models.TextField(verbose_name='نص الرسالة')
    wa_timestamp= models.BigIntegerField(default=0, db_index=True, verbose_name='توقيت واتساب (unix)')
    received_at = models.DateTimeField(default=timezone.now, db_index=True, verbose_name='وقت الاستقبال')
    msg_type    = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_CHAT,
                                   db_index=True, verbose_name='نوع الرسالة')
    score       = models.SmallIntegerField(default=0, verbose_name='نقاط التصنيف')
    has_image     = models.BooleanField(default=False, verbose_name='تحتوي صورة')
    matched_code  = models.CharField(max_length=20, blank=True, verbose_name='كود الحوالة المطابق')
    receipt_image = models.ImageField(upload_to='receipts/', blank=True, null=True, verbose_name='صورة الإيصال')

    class Meta:
        ordering            = ['-received_at']
        verbose_name        = 'رسالة واتساب'
        verbose_name_plural = 'رسائل واتساب'
        indexes = [
            models.Index(fields=['jid', 'received_at'], name='wa_jid_time_idx'),
            models.Index(fields=['msg_type', 'received_at'], name='wa_type_time_idx'),
        ]

    def __str__(self):
        return f'[{self.group_name or self.jid}] {self.sender_name}: {self.text[:60]}'

    def to_dict(self):
        return {
            'id':          self.id,
            'msgId':       self.msg_id,
            'jid':         self.jid,
            'isGroup':     self.is_group,
            'groupName':   self.group_name,
            'senderJid':   self.sender_jid,
            'senderName':  self.sender_name,
            'text':        self.text,
            'timestamp':   self.wa_timestamp,
            'receivedAt':  self.received_at.isoformat(),
            'type':        self.msg_type,
            'score':       self.score,
            'hasImage':     self.has_image,
            'matchedCode':  self.matched_code,
            'receiptImage': self.receipt_image.url if self.receipt_image else None,
        }


# ── دليل الحسابات ──────────────────────────────────────────────────────────────

class AccountLedger(models.Model):
    """حساب في دليل الحسابات — عميل، وكيل، فرع، خزينة..."""
    TYPE_CHOICES = [
        ('client',   'عميل'),
        ('agent',    'وكيل'),
        ('branch',   'فرع'),
        ('treasury', 'خزينة'),
        ('other',    'أخرى'),
    ]
    name         = models.CharField(max_length=200, verbose_name='اسم الحساب')
    account_no   = models.CharField(max_length=30, unique=True, verbose_name='رقم الحساب')
    account_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='client', verbose_name='نوع الحساب')
    currency     = models.CharField(max_length=10, default='USD', verbose_name='العملة الأساسية')
    balance      = models.DecimalField(max_digits=16, decimal_places=4, default=0, verbose_name='الرصيد')
    phone        = models.CharField(max_length=30, blank=True, verbose_name='هاتف')
    notes        = models.TextField(blank=True, verbose_name='ملاحظات')
    is_active    = models.BooleanField(default=True, verbose_name='نشط')
    created_by   = models.CharField(max_length=150, blank=True, verbose_name='أنشأه')
    created_at   = models.DateTimeField(default=timezone.now)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'حساب'
        verbose_name_plural = 'دليل الحسابات'

    def save(self, *args, **kwargs):
        if not self.account_no:
            import secrets as _s
            self.account_no = f'AC-{timezone.now().strftime("%y%m%d")}-{_s.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.account_no} | {self.name} ({self.get_account_type_display()})'

    def to_dict(self):
        return {
            'id':         self.id,
            'accountNo':  self.account_no,
            'name':       self.name,
            'type':       self.account_type,
            'typeName':   self.get_account_type_display(),
            'currency':   self.currency,
            'balance':    float(self.balance),
            'phone':      self.phone,
            'notes':      self.notes,
            'isActive':   self.is_active,
            'createdAt':  self.created_at.strftime('%Y-%m-%d'),
        }


# ── القيود المحاسبية ────────────────────────────────────────────────────────────

class JournalEntry(models.Model):
    """قيد محاسبي مزدوج — دَين / دائن بين حسابين"""
    CUT_DIR = [('mul', '× ضرب'), ('div', '÷ قسمة')]

    ref_number    = models.CharField(max_length=30, unique=True, verbose_name='رقم القيد')
    from_account  = models.ForeignKey(AccountLedger, on_delete=models.PROTECT,
                                      related_name='entries_from', verbose_name='حساب المصدر (دَين)')
    to_account    = models.ForeignKey(AccountLedger, on_delete=models.PROTECT,
                                      related_name='entries_to',   verbose_name='حساب الوجهة (دائن)')
    amount        = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ')
    from_currency = models.CharField(max_length=10, default='USD', verbose_name='عملة المصدر')
    to_currency   = models.CharField(max_length=10, default='USD', verbose_name='عملة الوجهة')
    cut_rate      = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر القص')
    cut_dir       = models.CharField(max_length=3, choices=CUT_DIR, default='mul', verbose_name='اتجاه القص')
    to_amount     = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='المبلغ المحوَّل')
    profit        = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='الربح')
    notes         = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by    = models.CharField(max_length=150, blank=True, verbose_name='بواسطة')
    created_at    = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'قيد محاسبي'
        verbose_name_plural = 'القيود المحاسبية'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            import secrets as _s
            self.ref_number = f'JE-{timezone.now().strftime("%y%m%d")}-{_s.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.ref_number} | {self.from_account.name} → {self.to_account.name}'

    def to_dict(self):
        return {
            'id':            self.id,
            'refNumber':     self.ref_number,
            'fromAccount':   self.from_account.name,
            'fromAccountId': self.from_account.id,
            'toAccount':     self.to_account.name,
            'toAccountId':   self.to_account.id,
            'amount':        float(self.amount),
            'fromCurrency':  self.from_currency,
            'toCurrency':    self.to_currency,
            'cutRate':       float(self.cut_rate),
            'cutDir':        self.cut_dir,
            'toAmount':      float(self.to_amount),
            'profit':        float(self.profit),
            'notes':         self.notes,
            'createdBy':     self.created_by,
            'createdAt':     self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ── قيود التسوية ────────────────────────────────────────────────────────────────

class SettlementVoucher(models.Model):
    """سند تسوية — مركز واحد يُسوِّي ديوناً مع عدة جهات"""
    ref_number  = models.CharField(max_length=30, unique=True, verbose_name='رقم السند')
    center_name = models.CharField(max_length=200, verbose_name='المركز المرسل')
    total_us    = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='إجمالي لنا')
    total_them  = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='إجمالي علينا')
    net_profit  = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='صافي الربح')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by  = models.CharField(max_length=150, blank=True, verbose_name='بواسطة')
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'قيد تسوية'
        verbose_name_plural = 'قيود التسوية'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            import secrets as _s
            self.ref_number = f'ST-{timezone.now().strftime("%y%m%d")}-{_s.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.ref_number} | {self.center_name} | ربح: {self.net_profit}'

    def to_dict(self):
        return {
            'id':         self.id,
            'refNumber':  self.ref_number,
            'centerName': self.center_name,
            'totalUs':    float(self.total_us),
            'totalThem':  float(self.total_them),
            'netProfit':  float(self.net_profit),
            'notes':      self.notes,
            'rows':       [r.to_dict() for r in self.rows.all()],
            'createdBy':  self.created_by,
            'createdAt':  self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


class SettlementRow(models.Model):
    """صف واحد في قيد التسوية"""
    voucher     = models.ForeignKey(SettlementVoucher, on_delete=models.CASCADE,
                                    related_name='rows', verbose_name='السند')
    currency    = models.CharField(max_length=10, default='USD', verbose_name='العملة')
    amount      = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ')
    fee_us      = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور لنا')
    beneficiary = models.CharField(max_length=200, blank=True, verbose_name='المستفيد')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    destination = models.CharField(max_length=200, blank=True, verbose_name='الوجهة')
    fee_them    = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور علينا')

    class Meta:
        verbose_name = 'صف تسوية'
        verbose_name_plural = 'صفوف التسوية'

    def to_dict(self):
        return {
            'id':          self.id,
            'currency':    self.currency,
            'amount':      float(self.amount),
            'feeUs':       float(self.fee_us),
            'beneficiary': self.beneficiary,
            'notes':       self.notes,
            'destination': self.destination,
            'feeThem':     float(self.fee_them),
        }


# ── قص وإغلاق بين مركزين ──────────────────────────────────────────────────────

class CutAndClose(models.Model):
    """
    سند قص وإغلاق — المركز الأول يشتري عملة بسعر قصه
    والمركز الثاني يبيع عملة بسعر قصه،
    والفارق بالدولار هو ربح/خسارة الشركة.
    """
    CUT_DIR = [('mul', '× ضرب'), ('div', '÷ قسمة')]

    ref_number      = models.CharField(max_length=30, unique=True, verbose_name='رقم السند')

    # جانب الشراء (أخضر)
    buy_center      = models.CharField(max_length=200, verbose_name='مركز الشراء')
    buy_currency    = models.CharField(max_length=10,  verbose_name='عملة الشراء')
    buy_amount      = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='مبلغ الشراء')
    buy_rate        = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر قص الشراء')
    buy_dir         = models.CharField(max_length=3, choices=CUT_DIR, default='div', verbose_name='اتجاه قص الشراء')
    buy_usd         = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='قيمة الشراء بالدولار')
    buy_notes       = models.TextField(blank=True, verbose_name='ملاحظات الشراء')

    # جانب البيع (أحمر)
    sell_center     = models.CharField(max_length=200, verbose_name='مركز البيع')
    sell_currency   = models.CharField(max_length=10,  verbose_name='عملة البيع')
    sell_amount     = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='مبلغ البيع')
    sell_rate       = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر قص البيع')
    sell_dir        = models.CharField(max_length=3, choices=CUT_DIR, default='div', verbose_name='اتجاه قص البيع')
    sell_usd        = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='قيمة البيع بالدولار')
    sell_notes      = models.TextField(blank=True, verbose_name='ملاحظات البيع')

    # الملخص
    profit_usd      = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='الربح بالدولار')
    created_by      = models.CharField(max_length=150, blank=True, verbose_name='بواسطة')
    created_at      = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'قص وإغلاق'
        verbose_name_plural = 'سندات القص والإغلاق'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            import secrets as _s
            self.ref_number = f'QS-{timezone.now().strftime("%y%m%d")}-{_s.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.ref_number} | {self.buy_center} ↔ {self.sell_center} | ربح: {self.profit_usd} $'

    def to_dict(self):
        return {
            'id':          self.id,
            'refNumber':   self.ref_number,
            'buyCenter':   self.buy_center,
            'buyCurrency': self.buy_currency,
            'buyAmount':   float(self.buy_amount),
            'buyRate':     float(self.buy_rate),
            'buyDir':      self.buy_dir,
            'buyUsd':      float(self.buy_usd),
            'buyNotes':    self.buy_notes,
            'sellCenter':  self.sell_center,
            'sellCurrency':self.sell_currency,
            'sellAmount':  float(self.sell_amount),
            'sellRate':    float(self.sell_rate),
            'sellDir':     self.sell_dir,
            'sellUsd':     float(self.sell_usd),
            'sellNotes':   self.sell_notes,
            'profitUsd':   float(self.profit_usd),
            'createdBy':   self.created_by,
            'createdAt':   self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ── تبديل عملات بين مركزين ────────────────────────────────────────────────────

class CurrencySwap(models.Model):
    """تبديل عملة بين مركزين — المركز الأول يعطي A ويستلم B والعكس"""

    ref_number    = models.CharField(max_length=30, unique=True, verbose_name='رقم العملية')
    center1_name  = models.CharField(max_length=200, verbose_name='المركز الأول')
    center2_name  = models.CharField(max_length=200, verbose_name='المركز الثاني')
    currency1     = models.CharField(max_length=10, verbose_name='عملة المركز الأول')
    currency2     = models.CharField(max_length=10, verbose_name='عملة المركز الثاني')
    amount1       = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='مبلغ المركز الأول')
    amount2       = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='مبلغ المركز الثاني')
    rate          = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر الصرف')
    notes         = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by    = models.CharField(max_length=150, blank=True, verbose_name='بواسطة')
    created_at    = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'تبديل عملة'
        verbose_name_plural = 'تبديلات العملات'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            import secrets as _s
            self.ref_number = f'SW-{timezone.now().strftime("%y%m%d")}-{_s.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.ref_number} | {self.center1_name} ⇄ {self.center2_name}'

    def to_dict(self):
        return {
            'id':          self.id,
            'refNumber':   self.ref_number,
            'center1':     self.center1_name,
            'center2':     self.center2_name,
            'currency1':   self.currency1,
            'currency2':   self.currency2,
            'amount1':     float(self.amount1),
            'amount2':     float(self.amount2),
            'rate':        float(self.rate),
            'notes':       self.notes,
            'createdBy':   self.created_by,
            'createdAt':   self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ══════════════════════════════════════════════════════════════════════════════
# قيد متقدم  — AE-YYMMDD-XXXX
# ══════════════════════════════════════════════════════════════════════════════
class AdvancedEntry(models.Model):
    CUT_DIR = [('mul', '× ضرب'), ('div', '÷ قسمة')]

    ref_number    = models.CharField(max_length=30, unique=True, blank=True)

    # جانب الإرسال
    from_center   = models.CharField(max_length=200)
    from_name     = models.CharField(max_length=200, blank=True)
    from_currency = models.CharField(max_length=10, default='USD')
    from_amount   = models.DecimalField(max_digits=14, decimal_places=4)
    from_fee      = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    from_fee_cur  = models.CharField(max_length=10, default='USD')
    from_notes    = models.TextField(blank=True)

    # القص
    cut_rate      = models.DecimalField(max_digits=14, decimal_places=6, default=1)
    cut_dir       = models.CharField(max_length=3, choices=CUT_DIR, default='mul')

    # جانب الاستلام
    to_center     = models.CharField(max_length=200)
    to_beneficiary= models.CharField(max_length=200, blank=True)
    to_currency   = models.CharField(max_length=10, default='USD')
    to_amount     = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    to_fee        = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    to_fee_cur    = models.CharField(max_length=10, default='USD')
    to_notes      = models.TextField(blank=True)

    # ملخص الربح
    cut_diff      = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    net_profit    = models.DecimalField(max_digits=14, decimal_places=4, default=0)

    created_by    = models.CharField(max_length=150, blank=True)
    created_at    = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.ref_number:
            self.ref_number = f'AE-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id':           self.id,
            'refNumber':    self.ref_number,
            'fromCenter':   self.from_center,
            'fromName':     self.from_name,
            'fromCurrency': self.from_currency,
            'fromAmount':   float(self.from_amount),
            'fromFee':      float(self.from_fee),
            'fromFeeCur':   self.from_fee_cur,
            'fromNotes':    self.from_notes,
            'cutRate':      float(self.cut_rate),
            'cutDir':       self.cut_dir,
            'toCenter':     self.to_center,
            'toBeneficiary':self.to_beneficiary,
            'toCurrency':   self.to_currency,
            'toAmount':     float(self.to_amount),
            'toFee':        float(self.to_fee),
            'toFeeCur':     self.to_fee_cur,
            'toNotes':      self.to_notes,
            'cutDiff':      float(self.cut_diff),
            'netProfit':    float(self.net_profit),
            'createdBy':    self.created_by,
            'createdAt':    self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ══════════════════════════════════════════════════════════════════════════════
# قيد افتتاحي  — OE-YYMMDD-XXXX
# ══════════════════════════════════════════════════════════════════════════════
class OpeningEntry(models.Model):
    """قيد افتتاحي لمركز — يُحدِّد رصيده الافتتاحي بعملة ونوع (لنا / علينا)"""

    ENTRY_TYPE = [('us', 'لنا'), ('them', 'علينا')]

    ref_number  = models.CharField(max_length=30, unique=True, blank=True, verbose_name='رقم القيد')
    center_name = models.CharField(max_length=200, verbose_name='المركز / العميل')
    currency    = models.CharField(max_length=10, default='USD', verbose_name='العملة')
    amount      = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ')
    entry_type  = models.CharField(max_length=5, choices=ENTRY_TYPE, default='us', verbose_name='النوع')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    entry_date  = models.DateField(verbose_name='تاريخ القيد')
    created_by  = models.CharField(max_length=150, blank=True)
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering     = ['-created_at']
        verbose_name = 'قيد افتتاحي'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            self.ref_number = f'OE-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.ref_number} | {self.center_name} | {self.get_entry_type_display()} | {self.amount} {self.currency}'

    def to_dict(self):
        return {
            'id':          self.id,
            'refNumber':   self.ref_number,
            'centerName':  self.center_name,
            'currency':    self.currency,
            'amount':      float(self.amount),
            'entryType':   self.entry_type,
            'entryTypeLabel': self.get_entry_type_display(),
            'notes':       self.notes,
            'entryDate':   self.entry_date.strftime('%Y-%m-%d') if self.entry_date else '',
            'createdBy':   self.created_by,
            'createdAt':   self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ══════════════════════════════════════════════════════════════════════════════
# قيد جديد (من → الى)  — EFT-YYMMDD-XXXX
# ══════════════════════════════════════════════════════════════════════════════
class EntryFromTo(models.Model):
    CUT_DIR = [('mul', '× ضرب'), ('div', '÷ قسمة')]

    ref_number     = models.CharField(max_length=30, unique=True, blank=True, verbose_name='رقم المرجع')

    # جانب الإرسال (من - لنا)
    from_center    = models.CharField(max_length=200, verbose_name='المركز المرسل')
    from_currency  = models.CharField(max_length=10, default='USD', verbose_name='عملة الإرسال')
    from_amount    = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='مبلغ الإرسال')
    from_fee       = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور تصدير')
    from_beneficiary = models.CharField(max_length=200, blank=True, verbose_name='المستفيد')
    from_notes     = models.TextField(blank=True, verbose_name='ملاحظات الإرسال')

    # القص
    cut_rate       = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر القص')
    cut_dir        = models.CharField(max_length=3, choices=CUT_DIR, default='mul', verbose_name='اتجاه القص')

    # جانب الاستلام (الى - علينا - ربح)
    to_center      = models.CharField(max_length=200, verbose_name='المركز المستلم')
    to_currency    = models.CharField(max_length=10, default='USD', verbose_name='عملة الاستلام')
    to_amount      = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='مبلغ الاستلام')
    to_fee         = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور تسليم')
    to_notes       = models.TextField(blank=True, verbose_name='ملاحظات الاستلام')

    # الربح المحسوب
    cut_diff       = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='فرق القص')
    net_profit     = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='صافي الربح')

    created_by     = models.CharField(max_length=150, blank=True)
    created_at     = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering    = ['-created_at']
        verbose_name = 'قيد جديد'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            self.ref_number = f'EFT-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id':              self.id,
            'refNumber':       self.ref_number,
            'fromCenter':      self.from_center,
            'fromCurrency':    self.from_currency,
            'fromAmount':      float(self.from_amount),
            'fromFee':         float(self.from_fee),
            'fromBeneficiary': self.from_beneficiary,
            'fromNotes':       self.from_notes,
            'cutRate':         float(self.cut_rate),
            'cutDir':          self.cut_dir,
            'toCenter':        self.to_center,
            'toCurrency':      self.to_currency,
            'toAmount':        float(self.to_amount),
            'toFee':           float(self.to_fee),
            'toNotes':         self.to_notes,
            'cutDiff':         float(self.cut_diff),
            'netProfit':       float(self.net_profit),
            'createdBy':       self.created_by,
            'createdAt':       self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ══════════════════════════════════════════════════════════════════════════════
# سند قبض  — RV-YYMMDD-XXXX
# ══════════════════════════════════════════════════════════════════════════════
class ReceiptVoucher(models.Model):
    """سند قبض — من (لنا) وإلى (علينا أرباح) مع قص عملة"""

    CUT_DIR = [('mul', '× ضرب'), ('div', '÷ قسمة')]

    ref_number       = models.CharField(max_length=30, unique=True, blank=True, verbose_name='رقم السند')

    # جانب من - لنا
    from_center      = models.CharField(max_length=200, verbose_name='المركز المرسل')
    from_currency    = models.CharField(max_length=10, default='USD', verbose_name='عملة الإرسال')
    from_amount      = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='مبلغ الإرسال')
    from_fee         = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور تصدير')
    from_notes       = models.TextField(blank=True, verbose_name='ملاحظات من')

    # القص
    cut_rate         = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر القص')
    cut_dir          = models.CharField(max_length=3, choices=CUT_DIR, default='mul', verbose_name='اتجاه القص')

    # جانب إلى - علينا أرباح
    to_center        = models.CharField(max_length=200, verbose_name='المركز المستلم')
    to_currency      = models.CharField(max_length=10, default='USD', verbose_name='عملة الاستلام')
    to_amount        = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='مبلغ الاستلام')
    to_fee           = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور تسليم')
    to_notes         = models.TextField(blank=True, verbose_name='ملاحظات إلى')

    # التاريخ والمحاسبة
    entry_date       = models.DateField(verbose_name='تاريخ السند')
    cut_diff         = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='فرق القص')
    net_profit       = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='صافي الربح')

    created_by       = models.CharField(max_length=150, blank=True)
    created_at       = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering     = ['-created_at']
        verbose_name = 'سند قبض'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            self.ref_number = f'RV-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id':           self.id,
            'refNumber':    self.ref_number,
            'fromCenter':   self.from_center,
            'fromCurrency': self.from_currency,
            'fromAmount':   float(self.from_amount),
            'fromFee':      float(self.from_fee),
            'fromNotes':    self.from_notes,
            'cutRate':      float(self.cut_rate),
            'cutDir':       self.cut_dir,
            'toCenter':     self.to_center,
            'toCurrency':   self.to_currency,
            'toAmount':     float(self.to_amount),
            'toFee':        float(self.to_fee),
            'toNotes':      self.to_notes,
            'entryDate':    self.entry_date.strftime('%Y-%m-%d'),
            'cutDiff':      float(self.cut_diff),
            'netProfit':    float(self.net_profit),
            'createdBy':    self.created_by,
            'createdAt':    self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ══════════════════════════════════════════════════════════════════════════════
# تبديل عملة  — CX-YYMMDD-XXXX
# ══════════════════════════════════════════════════════════════════════════════
class CurrencyExchange(models.Model):
    """تبديل عملة — مركز أول بعملة أولى مقابل مركز ثانٍ بعملة ثانية"""

    ref_number  = models.CharField(max_length=30, unique=True, blank=True, verbose_name='رقم السند')
    center1     = models.CharField(max_length=200, verbose_name='المركز الأول')
    currency1   = models.CharField(max_length=10, default='USD', verbose_name='العملة الأولى')
    amount1     = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ الأول')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    center2     = models.CharField(max_length=200, verbose_name='المركز الثاني')
    currency2   = models.CharField(max_length=10, default='EUR', verbose_name='العملة الثانية')
    amount2     = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='المبلغ الثاني')
    entry_date  = models.DateField(verbose_name='تاريخ التبديل')
    created_by  = models.CharField(max_length=150, blank=True)
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering     = ['-created_at']
        verbose_name = 'تبديل عملة'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            self.ref_number = f'CX-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id':        self.id,
            'refNumber': self.ref_number,
            'center1':   self.center1,
            'currency1': self.currency1,
            'amount1':   float(self.amount1),
            'notes':     self.notes,
            'center2':   self.center2,
            'currency2': self.currency2,
            'amount2':   float(self.amount2),
            'entryDate': self.entry_date.strftime('%Y-%m-%d'),
            'createdBy': self.created_by,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ══════════════════════════════════════════════════════════════════════════════
# اعتماد جديد  — CR-YYMMDD-XXXX
# ══════════════════════════════════════════════════════════════════════════════
class NewCredit(models.Model):
    """اعتماد جديد — إرسال اعتماد من مركز إلى صندوق"""

    ref_number  = models.CharField(max_length=30, unique=True, blank=True, verbose_name='رقم الاعتماد')
    company     = models.CharField(max_length=300, verbose_name='الشركة')
    source      = models.CharField(max_length=200, verbose_name='المصدر')
    currency    = models.CharField(max_length=10, default='USD', verbose_name='العملة')
    amount      = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='المبلغ')
    safe        = models.CharField(max_length=200, verbose_name='الصندوق')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    fees        = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='الأجور')
    entry_date  = models.DateField(verbose_name='تاريخ الاعتماد')
    created_by  = models.CharField(max_length=150, blank=True)
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering     = ['-created_at']
        verbose_name = 'اعتماد جديد'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            self.ref_number = f'CR-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id':        self.id,
            'refNumber': self.ref_number,
            'company':   self.company,
            'source':    self.source,
            'currency':  self.currency,
            'amount':    float(self.amount),
            'safe':      self.safe,
            'notes':     self.notes,
            'fees':      float(self.fees),
            'entryDate': self.entry_date.strftime('%Y-%m-%d'),
            'createdBy': self.created_by,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ══════════════════════════════════════════════════════════════════════════════
# حركة صادرة  — OT-YYMMDD-XXXX
# ══════════════════════════════════════════════════════════════════════════════
class OutgoingTransfer(models.Model):
    """حركة صادرة — إرسال حوالة خارجية"""

    ref_number        = models.CharField(max_length=30, unique=True, blank=True, verbose_name='رقم الحركة')
    source_center     = models.CharField(max_length=200, verbose_name='المصدر')
    beneficiary_name  = models.CharField(max_length=200, verbose_name='اسم المستفيد')
    beneficiary_phone = models.CharField(max_length=50, blank=True, verbose_name='هاتف المستفيد')
    destination       = models.CharField(max_length=200, blank=True, verbose_name='الوجهة')
    address           = models.CharField(max_length=300, blank=True, verbose_name='العنوان')
    send_currency     = models.CharField(max_length=10, default='USD', verbose_name='عملة الإرسال')
    send_amount       = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='مبلغ الإرسال')
    receive_currency  = models.CharField(max_length=10, default='USD', verbose_name='عملة التسليم')
    receive_amount    = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='مبلغ التسليم')
    export_fee        = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور تصدير')
    delivery_fee      = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور تسليم')
    total             = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='المجموع')
    exchange_rate     = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر الصرف')
    notes             = models.TextField(blank=True, verbose_name='ملاحظات')
    entry_date        = models.DateField(verbose_name='تاريخ الحركة')
    created_by        = models.CharField(max_length=150, blank=True)
    created_at        = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering     = ['-created_at']
        verbose_name = 'حركة صادرة'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            self.ref_number = f'OT-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id':               self.id,
            'refNumber':        self.ref_number,
            'sourceCenter':     self.source_center,
            'beneficiaryName':  self.beneficiary_name,
            'beneficiaryPhone': self.beneficiary_phone,
            'destination':      self.destination,
            'address':          self.address,
            'sendCurrency':     self.send_currency,
            'sendAmount':       float(self.send_amount),
            'receiveCurrency':  self.receive_currency,
            'receiveAmount':    float(self.receive_amount),
            'exportFee':        float(self.export_fee),
            'deliveryFee':      float(self.delivery_fee),
            'total':            float(self.total),
            'exchangeRate':     float(self.exchange_rate),
            'notes':            self.notes,
            'entryDate':        self.entry_date.strftime('%Y-%m-%d'),
            'createdBy':        self.created_by,
            'createdAt':        self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


# ══════════════════════════════════════════════════════════════════════════════
# سند دفع  — PV-YYMMDD-XXXX
# ══════════════════════════════════════════════════════════════════════════════
class PaymentVoucher(models.Model):
    """سند دفع — من (علينا) وإلى (لنا) مع قص عملة"""

    CUT_DIR = [('mul', '× ضرب'), ('div', '÷ قسمة')]

    ref_number    = models.CharField(max_length=30, unique=True, blank=True, verbose_name='رقم السند')
    from_center   = models.CharField(max_length=200, verbose_name='المركز المرسل')
    from_currency = models.CharField(max_length=10, default='USD', verbose_name='عملة الإرسال')
    from_amount   = models.DecimalField(max_digits=14, decimal_places=4, verbose_name='مبلغ الإرسال')
    from_fee      = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور تصدير')
    from_notes    = models.TextField(blank=True, verbose_name='ملاحظات من')
    cut_rate      = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر القص')
    cut_dir       = models.CharField(max_length=3, choices=CUT_DIR, default='mul', verbose_name='اتجاه القص')
    to_center     = models.CharField(max_length=200, verbose_name='المركز المستلم')
    to_currency   = models.CharField(max_length=10, default='USD', verbose_name='عملة الاستلام')
    to_amount     = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='مبلغ الاستلام')
    to_fee        = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='أجور تسليم')
    to_notes      = models.TextField(blank=True, verbose_name='ملاحظات إلى')
    entry_date    = models.DateField(verbose_name='تاريخ السند')
    cut_diff      = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='فرق القص')
    net_profit    = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='صافي الربح')
    created_by    = models.CharField(max_length=150, blank=True)
    created_at    = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering     = ['-created_at']
        verbose_name = 'سند دفع'

    def save(self, *args, **kwargs):
        if not self.ref_number:
            self.ref_number = f'PV-{timezone.now().strftime("%y%m%d")}-{secrets.randbelow(9000)+1000}'
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id':           self.id,
            'refNumber':    self.ref_number,
            'fromCenter':   self.from_center,
            'fromCurrency': self.from_currency,
            'fromAmount':   float(self.from_amount),
            'fromFee':      float(self.from_fee),
            'fromNotes':    self.from_notes,
            'cutRate':      float(self.cut_rate),
            'cutDir':       self.cut_dir,
            'toCenter':     self.to_center,
            'toCurrency':   self.to_currency,
            'toAmount':     float(self.to_amount),
            'toFee':        float(self.to_fee),
            'toNotes':      self.to_notes,
            'entryDate':    self.entry_date.strftime('%Y-%m-%d'),
            'cutDiff':      float(self.cut_diff),
            'netProfit':    float(self.net_profit),
            'createdBy':    self.created_by,
            'createdAt':    self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


class CostCenter(models.Model):
    """مركز تكلفة / صندوق — يُدار من صفحة الحسابات"""
    TYPE_CHOICES   = [('main', 'رئيسي'), ('branch', 'فرعي')]
    STATUS_CHOICES = [('active', 'نشط'), ('inactive', 'غير نشط')]

    name       = models.CharField(max_length=200, verbose_name='الاسم')
    type       = models.CharField(max_length=20, choices=TYPE_CHOICES, default='main')
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    country    = models.CharField(max_length=100, blank=True, default='')
    city       = models.CharField(max_length=100, blank=True, default='')
    phone      = models.CharField(max_length=50, blank=True, default='')
    doc_url    = models.URLField(blank=True, default='')
    notes      = models.TextField(blank=True, default='')

    dollar     = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    euro       = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    lira_tr    = models.DecimalField(max_digits=18, decimal_places=4, default=0)

    lock       = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'مركز تكلفة'

    def __str__(self):
        return self.name

    def to_dict(self):
        return {
            'id':       self.id,
            'name':     self.name,
            'type':     self.type,
            'status':   self.status,
            'country':  self.country,
            'city':     self.city,
            'phone':    self.phone,
            'doc_url':  self.doc_url,
            'notes':    self.notes,
            'dollar':   float(self.dollar),
            'euro':     float(self.euro),
            'lira_tr':  float(self.lira_tr),
            'lock':     self.lock,
            'is_deleted': self.is_deleted,
        }


class CenterLedger(models.Model):
    """
    حركة محاسبية على مركز — السجل الأساسي الذي تُبنى منه أرصدة المراكز.
    كل عملية (قيد/سند/حوالة) تُسجّل حركة أو أكثر هنا.
    رصيد المركز بعملة ما = مجموع (debit - credit) لكل حركاته بتلك العملة.
    اصطلاح: debit يزيد رصيد المركز (دخل له)، credit ينقصه (خرج منه).
    """
    SOURCE_CHOICES = [
        ('entry',      'قيد من-الى'),
        ('adv_entry',  'قيد متقدم'),
        ('receipt',    'سند قبض'),
        ('payment',    'سند دفع'),
        ('exchange',   'صرف عملات'),
        ('hawala',     'حوالة'),
        ('opening',    'قيد افتتاحي'),
        ('manual',     'تسوية يدوية'),
    ]

    # المركز يُخزَّن بالاسم (متوافق مع طريقة تخزين القيود الحالية)
    center      = models.CharField(max_length=200, db_index=True, verbose_name='المركز')
    currency    = models.CharField(max_length=8, db_index=True, verbose_name='العملة')
    debit       = models.DecimalField(max_digits=18, decimal_places=4, default=0, verbose_name='مدين (دخل)')
    credit      = models.DecimalField(max_digits=18, decimal_places=4, default=0, verbose_name='دائن (خرج)')

    source      = models.CharField(max_length=12, choices=SOURCE_CHOICES, default='manual', db_index=True)
    source_id   = models.PositiveIntegerField(null=True, blank=True, verbose_name='معرّف العملية المصدر')
    ref_number  = models.CharField(max_length=60, blank=True, default='', verbose_name='رقم المرجع')
    note        = models.CharField(max_length=255, blank=True, default='', verbose_name='ملاحظة')

    created_by  = models.CharField(max_length=120, blank=True, default='')
    created_at  = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        verbose_name        = 'حركة مركز'
        verbose_name_plural = 'حركات المراكز'
        ordering            = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['center', 'currency']),
            models.Index(fields=['source', 'source_id']),
        ]

    def __str__(self):
        return f'{self.center} [{self.currency}] +{self.debit} -{self.credit}'

    def to_dict(self):
        return {
            'id':        self.id,
            'center':    self.center,
            'currency':  self.currency,
            'debit':     float(self.debit),
            'credit':    float(self.credit),
            'balance':   float(self.debit - self.credit),
            'source':    self.source,
            'sourceLabel': self.get_source_display(),
            'sourceId':  self.source_id,
            'refNumber': self.ref_number,
            'note':      self.note,
            'createdBy': self.created_by,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M'),
        }


class Customer(models.Model):
    """عميل / زبون — يُدار من صفحة الحسابات (نفس بنية مركز التكلفة)"""
    TYPE_CHOICES   = [('main', 'رئيسي'), ('branch', 'فرعي'), ('client', 'عميل'), ('agent', 'وكيل')]
    STATUS_CHOICES = [('active', 'نشط'), ('inactive', 'غير نشط')]

    name       = models.CharField(max_length=200, verbose_name='الاسم')
    type       = models.CharField(max_length=20, choices=TYPE_CHOICES, default='main')
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    country    = models.CharField(max_length=100, blank=True, default='')
    city       = models.CharField(max_length=100, blank=True, default='')
    phone      = models.CharField(max_length=50, blank=True, default='')
    doc_url    = models.URLField(blank=True, default='')
    notes      = models.TextField(blank=True, default='')

    dollar     = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    euro       = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    lira_tr    = models.DecimalField(max_digits=18, decimal_places=4, default=0)

    lock       = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'عميل'

    def __str__(self):
        return self.name

    def to_dict(self):
        return {
            'id':       self.id,
            'name':     self.name,
            'type':     self.type,
            'status':   self.status,
            'country':  self.country,
            'city':     self.city,
            'phone':    self.phone,
            'doc_url':  self.doc_url,
            'notes':    self.notes,
            'dollar':   float(self.dollar),
            'euro':     float(self.euro),
            'lira_tr':  float(self.lira_tr),
            'lock':     self.lock,
            'is_deleted': self.is_deleted,
        }


class CutPrice(models.Model):
    """
    سعر القص — ثلاثة أنواع:
      screen   = سعر الشاشة
      balance  = سعر قص الرصيد
      movement = سعر قص الحركات
    """
    PRICE_TYPES = [
        ('screen',   'سعر الشاشة'),
        ('balance',  'سعر قص الرصيد'),
        ('movement', 'سعر قص الحركات'),
    ]
    DIRECTIONS = [('mul', '× ضرب'), ('div', '÷ قسمة')]

    price_type  = models.CharField(max_length=20, choices=PRICE_TYPES, verbose_name='نوع السعر')
    currency    = models.CharField(max_length=10, verbose_name='العملة')
    rate        = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='السعر')
    direction   = models.CharField(max_length=3, choices=DIRECTIONS, default='div', verbose_name='الاتجاه')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    is_active   = models.BooleanField(default=True, verbose_name='نشط')
    created_by  = models.CharField(max_length=150, blank=True)
    updated_by  = models.CharField(max_length=150, blank=True)
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['price_type', 'currency']
        verbose_name = 'سعر قص'
        verbose_name_plural = 'أسعار القص'

    def __str__(self):
        return f'{self.get_price_type_display()} | {self.currency} | {self.rate}'

    def to_dict(self):
        return {
            'id':         self.id,
            'priceType':  self.price_type,
            'typeLabel':  self.get_price_type_display(),
            'currency':   self.currency,
            'rate':       float(self.rate),
            'direction':  self.direction,
            'dirLabel':   self.get_direction_display(),
            'notes':      self.notes,
            'isActive':   self.is_active,
            'createdBy':  self.created_by,
            'updatedBy':  self.updated_by,
            'createdAt':  self.created_at.strftime('%Y-%m-%d %H:%M'),
            'updatedAt':  self.updated_at.strftime('%Y-%m-%d %H:%M'),
        }


class CutDistribution(models.Model):
    """
    تفريق القص — توزيع نسبة القص على مركز معين
    dist_type:
      balance  = تفريق قص الرصيد
      movement = تفريق قص الحركات
      system   = تفريق قص النظام
    """
    DIST_TYPES = [
        ('balance',  'تفريق قص الرصيد'),
        ('movement', 'تفريق قص الحركات'),
        ('system',   'تفريق قص النظام'),
    ]

    dist_type   = models.CharField(max_length=20, choices=DIST_TYPES, verbose_name='نوع التفريق')
    center_name = models.CharField(max_length=200, verbose_name='المركز')
    from_value  = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='من')
    to_value    = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='إلى')
    distribution = models.DecimalField(max_digits=14, decimal_places=4, default=0, verbose_name='التفريق')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    is_active   = models.BooleanField(default=True)
    created_by  = models.CharField(max_length=150, blank=True)
    updated_by  = models.CharField(max_length=150, blank=True)
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['dist_type', 'center_name']
        verbose_name = 'تفريق قص'
        verbose_name_plural = 'تفريقات القص'

    def __str__(self):
        return f'{self.get_dist_type_display()} | {self.center_name} | {self.distribution}'

    def to_dict(self):
        return {
            'id':           self.id,
            'distType':     self.dist_type,
            'typeLabel':    self.get_dist_type_display(),
            'centerName':   self.center_name,
            'fromValue':    float(self.from_value),
            'toValue':      float(self.to_value),
            'distribution': float(self.distribution),
            'notes':        self.notes,
            'isActive':     self.is_active,
            'createdBy':    self.created_by,
            'updatedBy':    self.updated_by,
            'createdAt':    self.created_at.strftime('%Y-%m-%d %H:%M'),
            'updatedAt':    self.updated_at.strftime('%Y-%m-%d %H:%M'),
        }


class ManagedCurrency(models.Model):
    """
    إدارة العملات — تعريف العملات المستخدمة في النظام
    مع معامل التحويل وسعر التقييم
    """
    name        = models.CharField(max_length=100, verbose_name='اسم العملة')
    symbol      = models.CharField(max_length=10,  verbose_name='الرمز')
    multiplier  = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='المعامل')
    eval_rate   = models.DecimalField(max_digits=14, decimal_places=6, default=1, verbose_name='سعر التقييم')
    is_active   = models.BooleanField(default=True, verbose_name='نشط')
    notes       = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by  = models.CharField(max_length=150, blank=True)
    updated_by  = models.CharField(max_length=150, blank=True)
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'عملة'
        verbose_name_plural = 'العملات'

    def __str__(self):
        return f'{self.name} ({self.symbol})'

    def to_dict(self):
        return {
            'id':         self.id,
            'name':       self.name,
            'symbol':     self.symbol,
            'multiplier': float(self.multiplier),
            'evalRate':   float(self.eval_rate),
            'isActive':   self.is_active,
            'notes':      self.notes,
            'createdBy':  self.created_by,
            'updatedBy':  self.updated_by,
            'createdAt':  self.created_at.strftime('%Y-%m-%d %H:%M'),
            'updatedAt':  self.updated_at.strftime('%Y-%m-%d %H:%M'),
        }
