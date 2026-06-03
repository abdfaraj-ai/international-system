"""
مسح جميع البيانات الوهمية / التجريبية من قاعدة البيانات.
يُبقي فقط المستخدمين المُعرَّفين في setup_users.py (admin + sv_teller + sv_trx + teller1 + bank1 + trx1).

Usage:
    python manage.py clear_dummy_data            # عرض ما سيُمسح فقط (dry-run)
    python manage.py clear_dummy_data --confirm  # تنفيذ فعلي
"""
import sys
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.pages.models import (
    SystemUser,
    Branch, BranchTransfer,
    ExchangeOperation, HawalaOperation, CashTransaction,
    TellerRequest, ExchangeRate, TellerPermission, TellerProfile,
)

# المستخدمون الرسميون الذين يجب الإبقاء عليهم
KEEP_USERNAMES = {'admin', 'sv_teller', 'sv_trx', 'teller1', 'bank1', 'trx1'}

# نحاول استيراد النماذج الاختيارية (قد لا تكون موجودة في كل البيئات)
_optional_models = {}
try:
    from apps.pages.models import HawalaTransfer
    _optional_models['HawalaTransfer'] = HawalaTransfer
except ImportError:
    pass
try:
    from apps.pages.models import BankTransfer
    _optional_models['BankTransfer'] = BankTransfer
except ImportError:
    pass
try:
    from apps.pages.models import AdminInstruction
    _optional_models['AdminInstruction'] = AdminInstruction
except ImportError:
    pass
try:
    from apps.pages.models import SupervisorReport
    _optional_models['SupervisorReport'] = SupervisorReport
except ImportError:
    pass
try:
    from apps.pages.models import TellerBalance
    _optional_models['TellerBalance'] = TellerBalance
except ImportError:
    pass
try:
    from apps.pages.models import ClientGroup
    _optional_models['ClientGroup'] = ClientGroup
except ImportError:
    pass
try:
    from apps.pages.models import ExecutionAgent
    _optional_models['ExecutionAgent'] = ExecutionAgent
except ImportError:
    pass


def _count(qs):
    try:
        return qs.count()
    except Exception:
        return 0


class Command(BaseCommand):
    help = 'مسح جميع البيانات الوهمية/التجريبية — استخدم --confirm للتنفيذ الفعلي'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            default=False,
            help='تنفيذ الحذف الفعلي (بدونها: dry-run فقط)',
        )

    def _out(self, msg):
        try:
            self.stdout.write(msg)
        except UnicodeEncodeError:
            sys.stdout.buffer.write((msg + '\n').encode('utf-8'))

    def handle(self, *args, **options):
        confirm = options['confirm']
        mode = 'تنفيذ فعلي' if confirm else 'DRY-RUN (عرض فقط، لا حذف)'
        self._out(f'\n=== مسح البيانات الوهمية — {mode} ===\n')

        # ── 1. المستخدمون الوهميون ────────────────────────────────────────────
        fake_users_qs = SystemUser.objects.exclude(username__in=KEEP_USERNAMES)
        fake_users_count = _count(fake_users_qs)
        self._out(f'  المستخدمون الوهميون    : {fake_users_count}')

        # ── 2. عمليات الصرافة ─────────────────────────────────────────────────
        exch_qs = ExchangeOperation.objects.all()
        exch_count = _count(exch_qs)
        self._out(f'  عمليات الصرافة         : {exch_count}')

        # ── 3. حوالات داخلية (HawalaOperation) ───────────────────────────────
        hawala_op_qs = HawalaOperation.objects.all()
        hawala_op_count = _count(hawala_op_qs)
        self._out(f'  حوالات داخلية          : {hawala_op_count}')

        # ── 4. معاملات نقدية ──────────────────────────────────────────────────
        cash_qs = CashTransaction.objects.all()
        cash_count = _count(cash_qs)
        self._out(f'  معاملات نقدية          : {cash_count}')

        # ── 5. طلبات التلرات ──────────────────────────────────────────────────
        tr_qs = TellerRequest.objects.all()
        tr_count = _count(tr_qs)
        self._out(f'  طلبات التلرات          : {tr_count}')

        # ── 6. سجلات أسعار الصرف (كلها وهمية في التجربة) ────────────────────
        er_qs = ExchangeRate.objects.all()
        er_count = _count(er_qs)
        self._out(f'  سجلات أسعار الصرف      : {er_count}')

        # ── 7. الفروع التجريبية ───────────────────────────────────────────────
        branch_qs = Branch.objects.all()
        branch_count = _count(branch_qs)
        self._out(f'  الفروع التجريبية       : {branch_count}')

        # ── 8. تحويلات الفروع ─────────────────────────────────────────────────
        bt_qs = BranchTransfer.objects.all()
        bt_count = _count(bt_qs)
        self._out(f'  تحويلات الفروع         : {bt_count}')

        # ── 9. ملفات التلرات وصلاحياتهم وأرصدتهم ─────────────────────────────
        tp_qs = TellerProfile.objects.all()
        tp_count = _count(tp_qs)
        self._out(f'  ملفات التلرات          : {tp_count}')

        tperm_qs = TellerPermission.objects.all()
        tperm_count = _count(tperm_qs)
        self._out(f'  صلاحيات التلرات        : {tperm_count}')

        # ── 10. النماذج الاختيارية ────────────────────────────────────────────
        optional_counts = {}
        labels = {
            'HawalaTransfer':   'حوالات خارجية (HawalaTransfer)',
            'BankTransfer':     'تحويلات بنكية (BankTransfer)',
            'AdminInstruction': 'تعليمات المشرف',
            'SupervisorReport': 'تقارير المشرف',
            'TellerBalance':    'أرصدة التلرات',
            'ClientGroup':      'مجموعات العملاء',
            'ExecutionAgent':   'وكلاء التنفيذ',
        }
        for key, model in _optional_models.items():
            qs = model.objects.all()
            c = _count(qs)
            optional_counts[key] = (qs, c)
            self._out(f'  {labels.get(key, key):<30}: {c}')

        # ── الملخص ────────────────────────────────────────────────────────────
        self._out('')
        if not confirm:
            self._out('  ℹ️  لتنفيذ الحذف الفعلي، أضف --confirm لأمر التشغيل:')
            self._out('       python manage.py clear_dummy_data --confirm')
            self._out('')
            return

        # ── التنفيذ ───────────────────────────────────────────────────────────
        self._out('  جارٍ الحذف...')
        with transaction.atomic():
            # النماذج الاختيارية أولاً (قد تعتمد على فروع أو مستخدمين)
            for key, (qs, c) in optional_counts.items():
                if c:
                    qs.delete()
                    self._out(f'  [OK] حُذف {c} سجل من {key}')

            # المعاملات والعمليات
            for label, qs, c in [
                ('ExchangeOperation',  exch_qs,    exch_count),
                ('HawalaOperation',    hawala_op_qs, hawala_op_count),
                ('CashTransaction',    cash_qs,    cash_count),
                ('TellerRequest',      tr_qs,      tr_count),
                ('ExchangeRate',       er_qs,      er_count),
                ('TellerPermission',   tperm_qs,   tperm_count),
                ('TellerProfile',      tp_qs,      tp_count),
                ('BranchTransfer',     bt_qs,      bt_count),
                ('Branch',             branch_qs,  branch_count),
            ]:
                if c:
                    qs.delete()
                    self._out(f'  [OK] حُذف {c} سجل من {label}')

            # المستخدمون الوهميون أخيراً
            if fake_users_count:
                names = list(fake_users_qs.values_list('username', flat=True))
                fake_users_qs.delete()
                self._out(f'  [OK] حُذف {fake_users_count} مستخدم وهمي: {", ".join(names)}')

        self._out('')
        self._out('  تم مسح جميع البيانات الوهمية بنجاح.')
        self._out('  يمكنك الآن تشغيل: python manage.py setup_users  لإنشاء المستخدمين الرسميين.')
        self._out('')
