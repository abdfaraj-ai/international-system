from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from django.utils import timezone
from .models import (
    SystemUser, ExchangeOperation, HawalaOperation, CashTransaction,
    UploadedImage, ExchangeRate, TellerRequest, TellerBalance,
    TellerProfile, TellerPermission, AuditLog,
    PortalTransferRequest, PortalCountry, PortalReceivingMethod,
    DevRequest, SystemModule,
)

# ─── Admin Site Branding ──────────────────────────────────────────────────────
admin.site.site_header  = 'نظام انترناشونال الموحد'
admin.site.site_title   = 'نظام انترناشونال'
admin.site.index_title  = 'لوحة إدارة النظام — International Financial Services'


# ═══════════════════════════════════════════════════════════════════════════════
#  Shared helpers
# ═══════════════════════════════════════════════════════════════════════════════

_CURRENCY_BG = {
    'USD': '#166534', 'ILS': '#78350f', 'JOD': '#164e63',
    'EUR': '#312e81', 'GBP': '#4a1d96',
}
_CURRENCY_FG = {
    'USD': '#4ade80', 'ILS': '#fbbf24', 'JOD': '#67e8f9',
    'EUR': '#a5b4fc', 'GBP': '#d8b4fe',
}

def _badge(label, bg='#1e293b', fg='#94a3b8'):
    return format_html(
        '<span style="display:inline-block;background:{bg};color:{fg};font-size:10px;'
        'font-weight:800;padding:2px 9px;border-radius:5px;letter-spacing:.4px">{label}</span>',
        bg=bg, fg=fg, label=label,
    )

def _currency_badge(currency):
    bg = _CURRENCY_BG.get(currency, '#1e293b')
    fg = _CURRENCY_FG.get(currency, '#94a3b8')
    return _badge(currency, bg, fg)

def _status_badge(status):
    MAP = {
        'pending':   ('#78350f', '#fcd34d', 'بانتظار'),
        'approved':  ('#14532d', '#4ade80', 'موافق'),
        'rejected':  ('#7f1d1d', '#f87171', 'مرفوض'),
        'resolved':  ('#0c4a6e', '#38bdf8', 'تم الرد'),
        'online':    ('#14532d', '#4ade80', 'متصل'),
        'offline':   ('#1e293b', '#64748b', 'غير متصل'),
        'completed': ('#14532d', '#4ade80', 'مكتمل'),
        'cancelled': ('#7f1d1d', '#f87171', 'ملغى'),
    }
    bg, fg, label = MAP.get(status, ('#1e293b', '#94a3b8', status))
    return _badge(label, bg, fg)

def _bool_col(val, true_label='نعم', false_label='لا'):
    if val:
        return format_html(
            '<span style="color:#16a34a;font-weight:800;font-size:12px">{}</span>', true_label)
    return format_html(
        '<span style="color:#dc2626;font-weight:800;font-size:12px">{}</span>', false_label)

def _money(val, symbol='', color='#0f172a'):
    try:
        v = float(val)
        s = f'{v:,.2f}' if v != int(v) else f'{int(v):,}'
        if symbol:
            return format_html(
                '<span style="color:#64748b;font-size:11px">{} </span>'
                '<span style="color:{};font-weight:700;font-family:monospace">{}</span>',
                symbol, color, s)
        return format_html('<span style="color:{};font-weight:700;font-family:monospace">{}</span>', color, s)
    except Exception:
        return format_html('<span style="color:#64748b">—</span>')

def _ts(dt):
    if not dt:
        return format_html('<span style="color:#475569">—</span>')
    return format_html(
        '<span style="color:#475569;font-size:11px;font-family:monospace">{}</span>',
        dt.strftime('%Y-%m-%d %H:%M'))

def _muted(text, size=12):
    if not text:
        return format_html('<span style="color:#475569">—</span>')
    return format_html(
        '<span style="color:#475569;font-size:{}px">{}</span>', size, text)


# ═══════════════════════════════════════════════════════════════════════════════
#  SystemUser
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(SystemUser)
class SystemUserAdmin(UserAdmin):
    list_display   = ('username_col', 'role_badge', 'status_col', 'staff_col', 'joined_col')
    list_filter    = ('role', 'is_active', 'is_staff')
    search_fields  = ('username', 'email', 'first_name', 'last_name')
    ordering       = ('username',)
    list_per_page  = 30

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('المعلومات الشخصية', {'fields': ('first_name', 'last_name', 'email')}),
        ('الدور في النظام', {'fields': ('role',)}),
        ('الأذونات', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('التواريخ', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('username', 'role', 'password1', 'password2')}),
    )

    def username_col(self, obj):
        return format_html(
            '<span style="font-weight:700;color:#e2e8f0">👤 {}</span>', obj.username)
    username_col.short_description = 'المستخدم'
    username_col.admin_order_field = 'username'

    def role_badge(self, obj):
        COLORS = {
            'M01': ('#713f12', '#fde68a'),
            'M02': ('#164e63', '#67e8f9'),
            'M03': ('#312e81', '#a5b4fc'),
            'T01': ('#14532d', '#4ade80'),
            'T02': ('#78350f', '#fcd34d'),
            'T03': ('#4a1d96', '#d8b4fe'),
        }
        bg, fg = COLORS.get(obj.role, ('#1e293b', '#94a3b8'))
        return _badge(obj.role_name, bg, fg)
    role_badge.short_description = 'الدور'
    role_badge.admin_order_field = 'role'

    def status_col(self, obj):
        return _bool_col(obj.is_active, 'مفعّل', 'معطّل')
    status_col.short_description = 'الحالة'

    def staff_col(self, obj):
        return _bool_col(obj.is_staff, 'إداري', 'موظف')
    staff_col.short_description = 'المستوى'

    def joined_col(self, obj):
        return _ts(obj.date_joined)
    joined_col.short_description = 'تاريخ الانضمام'
    joined_col.admin_order_field = 'date_joined'


# ═══════════════════════════════════════════════════════════════════════════════
#  ExchangeOperation
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(ExchangeOperation)
class ExchangeOperationAdmin(admin.ModelAdmin):
    list_display   = ('id', 'pair_col', 'amount_col', 'result_col', 'rate_col', 'method_col', 'operator_col', 'time_col')
    list_filter    = ('from_currency', 'to_currency', 'method')
    search_fields  = ('operator',)
    ordering       = ('-created_at',)
    list_per_page  = 30
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)

    def pair_col(self, obj):
        return format_html(
            '{} <span style="color:#32b8c6;font-weight:900;font-size:16px;vertical-align:middle">⇄</span> {}',
            _currency_badge(obj.from_currency), _currency_badge(obj.to_currency))
    pair_col.short_description = 'زوج العملة'

    def amount_col(self, obj):
        return _money(obj.amount, obj.from_currency)
    amount_col.short_description = 'المبلغ'
    amount_col.admin_order_field = 'amount'

    def result_col(self, obj):
        return _money(obj.result, obj.to_currency, '#67e8f9')
    result_col.short_description = 'الناتج'

    def rate_col(self, obj):
        return format_html(
            '<span style="color:#D4AF37;font-weight:700;font-family:monospace">{:.4f}</span>',
            obj.rate)
    rate_col.short_description = 'السعر'

    def method_col(self, obj):
        M = {'buy': ('#14532d','#4ade80','↓ شراء'), 'sell': ('#7f1d1d','#f87171','↑ بيع'),
             'voice': ('#0c4a6e','#38bdf8','🎙 صوتي')}
        bg, fg, lbl = M.get(obj.method, ('#1e293b','#94a3b8', obj.method))
        return _badge(lbl, bg, fg)
    method_col.short_description = 'الطريقة'

    def operator_col(self, obj):
        return _muted(obj.operator)
    operator_col.short_description = 'التلر'

    def time_col(self, obj):
        return _ts(obj.created_at)
    time_col.short_description = 'الوقت'
    time_col.admin_order_field = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  HawalaOperation
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(HawalaOperation)
class HawalaOperationAdmin(admin.ModelAdmin):
    list_display   = ('id', 'sender_col', 'receiver_col', 'amount_col', 'destination_col', 'operator_col', 'status_col', 'time_col')
    list_filter    = ('currency', 'status', 'destination')
    search_fields  = ('sender_name', 'receiver_name', 'operator')
    ordering       = ('-created_at',)
    list_per_page  = 30
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)

    def sender_col(self, obj):
        return format_html('<span style="font-weight:700;color:#e2e8f0">📤 {}</span>', obj.sender_name)
    sender_col.short_description = 'المُرسِل'
    sender_col.admin_order_field = 'sender_name'

    def receiver_col(self, obj):
        return format_html('<span style="color:#94a3b8;font-weight:600">📥 {}</span>', obj.receiver_name)
    receiver_col.short_description = 'المستلم'
    receiver_col.admin_order_field = 'receiver_name'

    def amount_col(self, obj):
        return format_html(
            '{} {}',
            _money(obj.amount, color='#fde68a'),
            _currency_badge(obj.currency))
    amount_col.short_description = 'المبلغ'
    amount_col.admin_order_field = 'amount'

    def destination_col(self, obj):
        return format_html(
            '<span style="color:#475569;font-size:12px">{}</span>',
            obj.destination or '—')
    destination_col.short_description = 'الوجهة'

    def operator_col(self, obj):
        return _muted(obj.operator)
    operator_col.short_description = 'التلر'

    def status_col(self, obj):
        return _status_badge(obj.status)
    status_col.short_description = 'الحالة'
    status_col.admin_order_field = 'status'

    def time_col(self, obj):
        return _ts(obj.created_at)
    time_col.short_description = 'الوقت'
    time_col.admin_order_field = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  CashTransaction
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(CashTransaction)
class CashTransactionAdmin(admin.ModelAdmin):
    list_display   = ('id', 'type_col', 'client_col', 'amount_col', 'operator_col', 'time_col')
    list_filter    = ('transaction_type', 'currency')
    search_fields  = ('client_name', 'operator')
    ordering       = ('-created_at',)
    list_per_page  = 30
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)

    def type_col(self, obj):
        if obj.transaction_type == 'withdrawal':
            return _badge('↑ سحب', '#7f1d1d', '#f87171')
        return _badge('↓ إيداع', '#14532d', '#4ade80')
    type_col.short_description = 'النوع'
    type_col.admin_order_field = 'transaction_type'

    def client_col(self, obj):
        return format_html('<span style="font-weight:700;color:#e2e8f0">👤 {}</span>', obj.client_name)
    client_col.short_description = 'العميل'
    client_col.admin_order_field = 'client_name'

    def amount_col(self, obj):
        return format_html('{} {}', _money(obj.amount), _currency_badge(obj.currency))
    amount_col.short_description = 'المبلغ'
    amount_col.admin_order_field = 'amount'

    def operator_col(self, obj):
        return _muted(obj.operator)
    operator_col.short_description = 'التلر'

    def time_col(self, obj):
        return _ts(obj.created_at)
    time_col.short_description = 'الوقت'
    time_col.admin_order_field = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  ExchangeRate
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display    = ('id', 'publisher_col', 'rates_preview', 'time_col')
    ordering        = ('-created_at',)
    list_per_page   = 20
    date_hierarchy  = 'created_at'
    readonly_fields = ('created_at', 'rates_detail')

    def publisher_col(self, obj):
        return format_html(
            '<span style="color:#D4AF37;font-weight:700">👤 {}</span>', obj.set_by or '—')
    publisher_col.short_description = 'نشر بواسطة'

    def rates_preview(self, obj):
        if not obj.rates_json:
            return format_html('<span style="color:#475569">—</span>')
        parts = []
        for k, v in list(obj.rates_json.items())[:5]:
            parts.append(
                f'<span style="color:#64748b;font-size:10px">{k}:</span> '
                f'<span style="color:#D4AF37;font-weight:700;font-family:monospace;font-size:12px">{v}</span>'
            )
        return format_html('<span style="display:flex;gap:10px;flex-wrap:wrap">{}</span>', ' '.join(parts))
    rates_preview.short_description = 'الأسعار'

    def rates_detail(self, obj):
        if not obj.rates_json:
            return '—'
        rows = []
        for k, v in obj.rates_json.items():
            rows.append(
                f'<tr><td style="padding:6px 16px;color:#94a3b8;border-bottom:1px solid rgba(50,184,198,0.08)">{k}</td>'
                f'<td style="padding:6px 16px;color:#D4AF37;font-weight:700;font-family:monospace;border-bottom:1px solid rgba(50,184,198,0.08)">{v}</td></tr>'
            )
        return format_html(
            '<table style="width:auto;border-collapse:collapse;background:rgba(50,184,198,0.04);'
            'border-radius:8px;overflow:hidden">{}</table>',
            ''.join(rows))
    rates_detail.short_description = 'جدول الأسعار الكامل'

    def time_col(self, obj):
        return _ts(obj.created_at)
    time_col.short_description = 'الوقت'
    time_col.admin_order_field = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  TellerRequest
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(TellerRequest)
class TellerRequestAdmin(admin.ModelAdmin):
    list_display    = ('request_id', 'type_col', 'teller_col', 'text_preview', 'status_col', 'resolved_by_col', 'time_col')
    list_filter     = ('status', 'request_type')
    search_fields   = ('teller_name', 'text', 'request_id')
    ordering        = ('-created_at',)
    list_per_page   = 30
    date_hierarchy  = 'created_at'
    readonly_fields = ('request_id', 'created_at', 'resolved_at')

    def type_col(self, obj):
        M = {
            'special_price': ('#713f12', '#fde68a', '💰 سعر مميز'),
            'urgent':        ('#7f1d1d', '#f87171', 'عاجل'),
            'general':       ('#164e63', '#67e8f9', 'عام'),
            'balance':       ('#14532d', '#4ade80', 'رصيد'),
        }
        bg, fg, lbl = M.get(obj.request_type, ('#1e293b', '#94a3b8', obj.request_type))
        return _badge(lbl, bg, fg)
    type_col.short_description = 'النوع'
    type_col.admin_order_field = 'request_type'

    def teller_col(self, obj):
        return format_html('<span style="font-weight:700;color:#e2e8f0">🖥️ {}</span>', obj.teller_name)
    teller_col.short_description = 'التلر'

    def text_preview(self, obj):
        txt = (obj.text[:55] + '…') if len(obj.text) > 55 else obj.text
        return _muted(txt, 12)
    text_preview.short_description = 'نص الطلب'

    def status_col(self, obj):
        return _status_badge(obj.status)
    status_col.short_description = 'الحالة'
    status_col.admin_order_field = 'status'

    def resolved_by_col(self, obj):
        if obj.resolved_by:
            return format_html(
                '<span style="color:#475569;font-size:12px">{}</span>', obj.resolved_by)
        return format_html('<span style="color:#475569">—</span>')
    resolved_by_col.short_description = 'أُغلق بواسطة'

    def time_col(self, obj):
        return _ts(obj.created_at)
    time_col.short_description = 'الوقت'
    time_col.admin_order_field = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  TellerBalance
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(TellerBalance)
class TellerBalanceAdmin(admin.ModelAdmin):
    list_display    = ('teller_col', 'usd_col', 'ils_col', 'jod_col', 'action_col', 'set_by_col', 'time_col')
    list_filter     = ('action',)
    search_fields   = ('teller_username', 'teller_name')
    ordering        = ('-created_at',)
    list_per_page   = 30
    date_hierarchy  = 'created_at'
    readonly_fields = ('created_at',)

    def teller_col(self, obj):
        name = f' ({obj.teller_name})' if obj.teller_name else ''
        return format_html(
            '<span style="font-weight:700;color:#e2e8f0">🖥️ {}</span>'
            '<span style="color:#475569;font-size:11px">{}</span>',
            obj.teller_username, name)
    teller_col.short_description = 'التلر'
    teller_col.admin_order_field = 'teller_username'

    def usd_col(self, obj):
        c = '#4ade80' if obj.usd > 0 else '#475569'
        return _money(obj.usd, '$', c)
    usd_col.short_description = 'دولار'
    usd_col.admin_order_field = 'usd'

    def ils_col(self, obj):
        c = '#fcd34d' if obj.ils > 0 else '#475569'
        return _money(obj.ils, '₪', c)
    ils_col.short_description = 'شيكل'
    ils_col.admin_order_field = 'ils'

    def jod_col(self, obj):
        c = '#67e8f9' if obj.jod > 0 else '#475569'
        return _money(obj.jod, 'JD', c)
    jod_col.short_description = 'دينار'
    jod_col.admin_order_field = 'jod'

    def action_col(self, obj):
        if obj.action == 'set':
            return _badge('⬤ تعيين', '#312e81', '#a5b4fc')
        return _badge('+ إضافة', '#14532d', '#4ade80')
    action_col.short_description = 'الإجراء'

    def set_by_col(self, obj):
        return _muted(obj.set_by)
    set_by_col.short_description = 'عُيِّن بواسطة'

    def time_col(self, obj):
        return _ts(obj.created_at)
    time_col.short_description = 'الوقت'
    time_col.admin_order_field = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  TellerProfile
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(TellerProfile)
class TellerProfileAdmin(admin.ModelAdmin):
    list_display    = ('id_col', 'name_col', 'username_col', 'phone_col', 'status_col', 'balance_col', 'ops_col', 'has_login_col')
    list_filter     = ('status',)
    search_fields   = ('name', 'username', 'phone')
    ordering        = ('teller_id',)
    list_per_page   = 30
    readonly_fields = ('teller_id', 'created_at', 'has_login_col')
    fields          = ('teller_id', 'name', 'username', 'phone', 'status',
                       'balance', 'currency', 'ops', 'login_time', 'last_op',
                       'has_login_col', 'created_at')

    def id_col(self, obj):
        return format_html(
            '<span style="background:rgba(50,184,198,0.12);color:#32b8c6;'
            'font-weight:900;padding:3px 10px;border-radius:6px;font-size:11px;'
            'font-family:monospace;letter-spacing:.5px">{}</span>',
            obj.teller_id)
    id_col.short_description = 'رقم التلر'
    id_col.admin_order_field = 'teller_id'

    def name_col(self, obj):
        return format_html('<span style="font-weight:700;color:#e2e8f0">👤 {}</span>', obj.name)
    name_col.short_description = 'الاسم'
    name_col.admin_order_field = 'name'

    def username_col(self, obj):
        return format_html(
            '<span style="color:#94a3b8;font-family:monospace;font-size:12px">@{}</span>',
            obj.username)
    username_col.short_description = 'المستخدم'
    username_col.admin_order_field = 'username'

    def phone_col(self, obj):
        return _muted(obj.phone, 12)
    phone_col.short_description = 'الهاتف'

    def status_col(self, obj):
        return _status_badge(obj.status)
    status_col.short_description = 'الحالة'
    status_col.admin_order_field = 'status'

    def balance_col(self, obj):
        c = '#4ade80' if obj.balance > 0 else '#475569'
        return _money(obj.balance, '$', c)
    balance_col.short_description = 'الرصيد'
    balance_col.admin_order_field = 'balance'

    def ops_col(self, obj):
        c = '#67e8f9' if obj.ops > 0 else '#475569'
        return format_html(
            '<span style="color:{};font-weight:700;font-family:monospace">{}</span>',
            c, obj.ops)
    ops_col.short_description = 'العمليات'
    ops_col.admin_order_field = 'ops'

    def has_login_col(self, obj):
        from .models import SystemUser
        exists = SystemUser.objects.filter(username=obj.username).exists()
        return _bool_col(exists, 'حساب مرتبط', 'لا يوجد')
    has_login_col.short_description = 'حساب الدخول'

    def delete_queryset(self, request, queryset):
        from .models import SystemUser
        deleted_names = []
        for profile in queryset:
            deleted_names.append(profile.name)
            SystemUser.objects.filter(username=profile.username).delete()
            TellerPermission.objects.filter(teller_username=profile.username).delete()
            TellerBalance.objects.filter(teller_username=profile.username).delete()
        count = queryset.count()
        queryset.delete()
        self.message_user(
            request,
            f'تم حذف {count} تلر: {", ".join(deleted_names)} — وجميع البيانات المرتبطة',
            messages.SUCCESS)

    def delete_model(self, request, obj):
        from .models import SystemUser
        name = obj.name
        SystemUser.objects.filter(username=obj.username).delete()
        TellerPermission.objects.filter(teller_username=obj.username).delete()
        TellerBalance.objects.filter(teller_username=obj.username).delete()
        obj.delete()
        self.message_user(
            request,
            f'تم حذف التلر "{name}" وجميع بياناته (حساب الدخول، الصلاحيات، الأرصدة)',
            messages.SUCCESS)


# ═══════════════════════════════════════════════════════════════════════════════
#  TellerPermission
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(TellerPermission)
class TellerPermissionAdmin(admin.ModelAdmin):
    list_display    = ('teller_col', 'exchange_col', 'international_col', 'electronic_col',
                       'special_col', 'double_col', 'updated_by_col', 'updated_col')
    search_fields   = ('teller_username',)
    ordering        = ('teller_username',)
    list_per_page   = 30
    readonly_fields = ('updated_at',)

    def teller_col(self, obj):
        return format_html(
            '<span style="font-weight:700;color:#e2e8f0">🖥️ {}</span>', obj.teller_username)
    teller_col.short_description = 'التلر'
    teller_col.admin_order_field = 'teller_username'

    def exchange_col(self, obj):
        return _bool_col(obj.exchange)
    exchange_col.short_description = 'الصرافة'

    def international_col(self, obj):
        return _bool_col(obj.international)
    international_col.short_description = 'حوالات دولية'

    def electronic_col(self, obj):
        return _bool_col(obj.electronic)
    electronic_col.short_description = 'إلكتروني'

    def special_col(self, obj):
        return _bool_col(obj.special_price, 'مفعّل', 'محظور')
    special_col.short_description = 'سعر مميز'

    def double_col(self, obj):
        return _bool_col(obj.double_delivery, 'مفعّل', 'محظور')
    double_col.short_description = 'تسليم مزدوج'

    def updated_by_col(self, obj):
        return _muted(obj.updated_by)
    updated_by_col.short_description = 'عُدِّل بواسطة'

    def updated_col(self, obj):
        return _ts(obj.updated_at)
    updated_col.short_description = 'آخر تحديث'
    updated_col.admin_order_field = 'updated_at'

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user.username
        obj.updated_at = timezone.now()
        super().save_model(request, obj, form, change)


# ═══════════════════════════════════════════════════════════════════════════════
#  UploadedImage
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(UploadedImage)
class UploadedImageAdmin(admin.ModelAdmin):
    list_display    = ('id', 'thumb_col', 'description_col', 'location_col', 'user_col', 'time_col')
    ordering        = ('-uploaded_at',)
    list_per_page   = 20
    date_hierarchy  = 'uploaded_at'
    readonly_fields = ('uploaded_at', 'thumb_col')

    def thumb_col(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="width:44px;height:44px;object-fit:cover;'
                'border-radius:8px;border:1px solid rgba(50,184,198,0.25)">',
                obj.image.url)
        return format_html('<span style="color:#475569;font-size:11px">—</span>')
    thumb_col.short_description = 'الصورة'

    def description_col(self, obj):
        txt = (obj.description[:50] + '…') if len(obj.description) > 50 else obj.description
        return _muted(txt or '—', 12)
    description_col.short_description = 'الوصف'

    def location_col(self, obj):
        return format_html(
            '<span style="color:#a5b4fc;font-size:12px">{}</span>', obj.location or '—')
    location_col.short_description = 'الموقع'

    def user_col(self, obj):
        return format_html(
            '<span style="color:#D4AF37;font-size:12px">👤 {}</span>', obj.user_id or '—')
    user_col.short_description = 'المستخدم'

    def time_col(self, obj):
        return _ts(obj.uploaded_at)
    time_col.short_description = 'وقت الرفع'
    time_col.admin_order_field = 'uploaded_at'


# ═══════════════════════════════════════════════════════════════════════════════
#  AuditLog
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display    = ('time_col', 'action_col', 'actor_col', 'target_col', 'amount_col', 'ip_col')
    list_filter     = ('action', 'actor_role')
    search_fields   = ('actor', 'target', 'detail', 'ip_address')
    ordering        = ('-created_at',)
    list_per_page   = 50
    date_hierarchy  = 'created_at'
    readonly_fields = ('action', 'actor', 'actor_role', 'target', 'amount', 'currency',
                       'detail', 'ip_address', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def time_col(self, obj):
        return _ts(obj.created_at)
    time_col.short_description = 'الوقت'
    time_col.admin_order_field = 'created_at'

    def action_col(self, obj):
        MAP = {
            'login':        ('#14532d', '#4ade80', 'دخول'),
            'login_failed': ('#7f1d1d', '#f87171', 'فشل الدخول'),
            'logout':       ('#164e63', '#67e8f9', 'خروج'),
            'bk_create':    ('#312e81', '#a5b4fc', 'تحويل جديد'),
            'bk_complete':  ('#14532d', '#4ade80', 'إتمام تحويل'),
            'bk_reject':    ('#7f1d1d', '#f87171', 'رفض'),
            'tl_exchange':  ('#78350f', '#fcd34d', 'صرافة'),
            'tl_hawala':    ('#4a1d96', '#d8b4fe', 'حوالة'),
            'tl_cash':      ('#164e63', '#67e8f9', 'نقدي'),
        }
        bg, fg, lbl = MAP.get(obj.action, ('#1e293b', '#94a3b8', obj.action))
        return _badge(lbl, bg, fg)
    action_col.short_description = 'الحدث'
    action_col.admin_order_field = 'action'

    def actor_col(self, obj):
        role = f' [{obj.actor_role}]' if obj.actor_role else ''
        return format_html(
            '<span style="font-weight:700;color:#0f172a">{}</span>'
            '<span style="color:#64748b;font-size:11px">{}</span>',
            obj.actor, role)
    actor_col.short_description = 'المنفِّذ'
    actor_col.admin_order_field = 'actor'

    def target_col(self, obj):
        return _muted(obj.target or obj.detail[:50] if obj.detail else '—', 12)
    target_col.short_description = 'الهدف / التفاصيل'

    def amount_col(self, obj):
        if obj.amount:
            return format_html('{} {}', _money(obj.amount), _currency_badge(obj.currency) if obj.currency else '')
        return format_html('<span style="color:#475569">—</span>')
    amount_col.short_description = 'المبلغ'
    amount_col.admin_order_field = 'amount'

    def ip_col(self, obj):
        return format_html(
            '<span style="color:#475569;font-size:11px;font-family:monospace">{}</span>',
            obj.ip_address or '—')
    ip_col.short_description = 'IP'


# ═══════════════════════════════════════════════════════════════════════════════
#  Portal Admin — بوابة العملاء
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(PortalCountry)
class PortalCountryAdmin(admin.ModelAdmin):
    list_display  = ('name', 'currency', 'rate', 'is_active', 'order', 'updated_at')
    list_filter   = ('is_active',)
    search_fields = ('name', 'currency')
    ordering      = ('order', 'name')


@admin.register(PortalReceivingMethod)
class PortalReceivingMethodAdmin(admin.ModelAdmin):
    list_display  = ('name', 'country', 'bank', 'iban', 'is_active', 'order')
    list_filter   = ('is_active', 'country')
    search_fields = ('name', 'bank', 'iban')
    ordering      = ('country', 'order')


@admin.register(PortalTransferRequest)
class PortalTransferRequestAdmin(admin.ModelAdmin):
    list_display   = ('tracking_code', 'client_email', 'client_name',
                      'country_name', 'method_name', 'status', 'created_at', 'handled_by')
    list_filter    = ('status',)
    search_fields  = ('tracking_code', 'client_email', 'client_name')
    ordering       = ('-created_at',)
    readonly_fields = ('tracking_code', 'client_email', 'client_name',
                       'country', 'country_name', 'method_name', 'currency',
                       'receipt', 'ip_address', 'created_at')
    fieldsets = (
        ('بيانات الطلب', {'fields': ('tracking_code', 'client_email', 'client_name',
                                      'country', 'country_name', 'method_name', 'currency', 'receipt', 'ip_address', 'created_at')}),
        ('إدارة الطلب', {'fields': ('status', 'notes', 'handled_by', 'handled_at')}),
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Dev Requests Admin — طلبات التطوير البرمجي
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(DevRequest)
class DevRequestAdmin(admin.ModelAdmin):
    list_display   = ('title', 'type', 'status', 'sender', 'sender_role', 'sender_page', 'created_at')
    list_filter    = ('status', 'type', 'sender_role', 'sender_page')
    search_fields  = ('title', 'description', 'sender')
    ordering       = ('-created_at',)
    readonly_fields = ('sender', 'sender_role', 'sender_page', 'created_at', 'updated_at')
    fieldsets = (
        ('بيانات الطلب', {'fields': ('title', 'type', 'description', 'sender', 'sender_role', 'sender_page', 'created_at', 'updated_at')}),
        ('إدارة الطلب', {'fields': ('status', 'admin_notes')}),
    )


@admin.register(SystemModule)
class SystemModuleAdmin(admin.ModelAdmin):
    """التحكّم بوحدات/برامج النظام — تشغيل/إيقاف/ترتيب من لوحة الإدارة."""
    list_display   = ('icon_badge', 'name', 'key', 'url', 'roles', 'is_enabled', 'order')
    list_editable  = ('is_enabled', 'order')
    list_filter    = ('is_enabled',)
    search_fields  = ('name', 'key', 'description', 'roles')
    ordering       = ('order', 'name')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('بيانات الوحدة', {'fields': ('key', 'name', 'description', 'icon', 'color', 'url')}),
        ('التحكّم والصلاحيات', {'fields': ('is_enabled', 'roles', 'order')}),
        ('إعدادات متقدّمة', {'fields': ('settings', 'created_at', 'updated_at')}),
    )
    actions = ['enable_modules', 'disable_modules']

    @admin.display(description='الوحدة')
    def icon_badge(self, obj):
        return format_html(
            '<span style="font-size:18px;background:{}1a;border:1px solid {}40;'
            'border-radius:8px;padding:3px 9px">{}</span>',
            obj.color, obj.color, obj.icon,
        )

    @admin.action(description='تفعيل الوحدات المحدّدة')
    def enable_modules(self, request, queryset):
        n = queryset.update(is_enabled=True)
        self.message_user(request, f'تم تفعيل {n} وحدة.', messages.SUCCESS)

    @admin.action(description='إيقاف الوحدات المحدّدة')
    def disable_modules(self, request, queryset):
        n = queryset.update(is_enabled=False)
        self.message_user(request, f'تم إيقاف {n} وحدة.', messages.WARNING)


# ═══════════════════════════════════════════════════════════════════════════════
#  تجميع قوائم الإدارة في مجموعات مسمّاة (قوائم منسدلة)
# ═══════════════════════════════════════════════════════════════════════════════
# كل مجموعة = (الاسم، [أسماء النماذج بحروف صغيرة])
_ADMIN_GROUPS = [
    ('إدارة النظام', ['systemmodule', 'systemuser', 'auditlog', 'devrequest', 'uploadedimage', 'group']),
    ('الصرافة',      ['exchangeoperation', 'exchangerate', 'cashtransaction',
                      'tellerprofile', 'tellerbalance', 'tellerpermission', 'tellerrequest']),
    ('الحوالات',     ['hawalaoperation', 'portaltransferrequest', 'portalcountry', 'portalreceivingmethod']),
    ('المحاسبة',     []),  # تُملأ لاحقاً عند تسجيل نماذج المحاسبة
]

_orig_get_app_list = admin.site.get_app_list


def _grouped_get_app_list(request, app_label=None):
    """يعيد تنظيم نماذج الإدارة في مجموعات مسمّاة بدل التجميع حسب التطبيق."""
    try:
        original = (_orig_get_app_list(request, app_label) if app_label
                    else _orig_get_app_list(request))
        # فهرسة كل النماذج بالاسم البرمجي
        index = {}
        for app in original:
            for m in app.get('models', []):
                index[(m.get('object_name') or '').lower()] = m

        used, grouped = set(), []
        for gname, keys in _ADMIN_GROUPS:
            models = [index[k] for k in keys if k in index]
            used.update(keys)
            if models:
                grouped.append({
                    'name': gname,
                    'app_label': 'grp_' + gname,
                    'app_url': '',
                    'has_module_perms': True,
                    'models': models,
                })
        # النماذج غير المصنّفة → "أخرى"
        others = [m for k, m in index.items() if k not in used]
        if others:
            grouped.append({'name': 'أخرى', 'app_label': 'grp_other',
                            'app_url': '', 'has_module_perms': True, 'models': others})
        return grouped or original
    except Exception:
        return (_orig_get_app_list(request, app_label) if app_label
                else _orig_get_app_list(request))


admin.site.get_app_list = _grouped_get_app_list
