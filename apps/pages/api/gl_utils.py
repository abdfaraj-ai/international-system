"""
gl_utils.py — محرّك دفتر الأستاذ العام (قيد مزدوج مفروض)
══════════════════════════════════════════════════════════
الدالة المركزية post_gl() تُنشئ قيداً متوازناً (مدين = دائن لكل عملة).
ترفض أي قيد غير متوازن — هذا يضمن سلامة القيد المزدوج على مستوى البيانات.

كل العمليات المحاسبية (سندات، صرف، حوالات، قص...) يجب أن تُرحَّل عبر هذه
الدالة لتصبح في مصدر حقيقة واحد: دفتر الأستاذ العام (GLTransaction/GLLine).
"""
from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from ..models import Account, GLTransaction, GLLine


_EPS = Decimal('0.0001')   # سماحية تقريب


def _dec(v):
    try:
        return Decimal(str(v if v not in (None, '') else 0))
    except Exception:
        return Decimal('0')


class UnbalancedEntry(Exception):
    """يُرفع عند محاولة ترحيل قيد غير متوازن."""
    pass


def _next_ref(source):
    """يولّد رقم قيد فريد: GL-YYMMDD-NNNN."""
    today = timezone.now()
    prefix = f'GL-{today:%y%m%d}-'
    last = (GLTransaction.objects
            .filter(ref_number__startswith=prefix)
            .order_by('-ref_number').first())
    n = 1
    if last:
        try:
            n = int(last.ref_number.split('-')[-1]) + 1
        except Exception:
            n = 1
    return f'{prefix}{n:04d}'


@transaction.atomic
def post_gl(*, lines, date=None, description='', source='manual',
            source_id=None, ref_number='', created_by=''):
    """
    يُنشئ قيداً متوازناً في دفتر الأستاذ العام.

    lines: قائمة سطور، كل سطر dict:
        { 'account': <Account|code|id>, 'currency': 'USD',
          'debit': 0, 'credit': 0, 'center': '', 'note': '' }

    يفرض: مجموع المدين = مجموع الدائن لكل عملة، وإلا UnbalancedEntry.
    يُرجع GLTransaction المُنشأ.
    """
    if not lines:
        raise UnbalancedEntry('لا توجد سطور للقيد')

    # ── تطبيع السطور والتحقّق من توازن كل عملة ──
    norm = []
    bal = defaultdict(lambda: [Decimal('0'), Decimal('0')])   # cur -> [debit, credit]
    for ln in lines:
        acc = _resolve_account(ln.get('account'))
        if acc is None:
            raise UnbalancedEntry(f"حساب غير موجود: {ln.get('account')}")
        if acc.is_group:
            raise UnbalancedEntry(f'لا يجوز الترحيل لحساب رئيسي (مجموعة): {acc.code}')
        cur = (ln.get('currency') or acc.currency or 'USD').upper().strip()
        deb = _dec(ln.get('debit'))
        crd = _dec(ln.get('credit'))
        if deb < 0 or crd < 0:
            raise UnbalancedEntry('المبالغ يجب أن تكون موجبة')
        if deb and crd:
            raise UnbalancedEntry('السطر لا يكون مديناً ودائناً معاً')
        if deb == 0 and crd == 0:
            continue
        bal[cur][0] += deb
        bal[cur][1] += crd
        norm.append({'account': acc, 'currency': cur, 'debit': deb, 'credit': crd,
                     'center': ln.get('center', '') or '', 'note': ln.get('note', '') or ''})

    if not norm:
        raise UnbalancedEntry('كل السطور صفرية')

    for cur, (d, c) in bal.items():
        if abs(d - c) > _EPS:
            raise UnbalancedEntry(f'القيد غير متوازن بعملة {cur}: مدين {d} ≠ دائن {c}')

    # ── إنشاء القيد وسطوره ──
    txn = GLTransaction.objects.create(
        ref_number=ref_number or _next_ref(source),
        date=date or timezone.now().date(),
        description=description or '',
        source=source, source_id=source_id,
        created_by=created_by or '',
    )
    GLLine.objects.bulk_create([
        GLLine(transaction=txn, account=ln['account'], currency=ln['currency'],
               debit=ln['debit'], credit=ln['credit'],
               center=ln['center'], note=ln['note'])
        for ln in norm
    ])
    return txn


def _resolve_account(ref):
    """يقبل Account أو code أو id ويُرجع كائن Account."""
    if ref is None:
        return None
    if isinstance(ref, Account):
        return ref
    try:
        if isinstance(ref, int) or str(ref).isdigit():
            return Account.objects.filter(id=int(ref)).first()
        return Account.objects.filter(code=str(ref).strip()).first()
    except Exception:
        return None


@transaction.atomic
def reverse_gl(source, source_id):
    """يعكس كل قيود عملية (عند حذفها) بقيد عكسي — محصّن ضد العكس المزدوج."""
    txns = list(GLTransaction.objects.filter(source=source, source_id=source_id))
    # حماية: إن وُجد قيد عكسي مسبقاً فالعملية مُعكوسة
    if any(t.description.startswith('عكس ') for t in txns):
        return 0
    n = 0
    for t in txns:
        rev = GLTransaction.objects.create(
            ref_number=_next_ref(source),
            date=timezone.now().date(),
            description=f'عكس {t.description}'.strip(),
            source=source, source_id=source_id, created_by=t.created_by,
        )
        GLLine.objects.bulk_create([
            GLLine(transaction=rev, account=l.account, currency=l.currency,
                   debit=l.credit, credit=l.debit,   # معكوس
                   center=l.center, note=f'عكس {l.note}'.strip())
            for l in t.lines.all()
        ])
        n += 1
    return n


def account_balance(account, currency=None):
    """رصيد حساب = مجموع المدين − مجموع الدائن (لكل عملة أو عملة محدّدة)."""
    acc = _resolve_account(account)
    if acc is None:
        return {}
    qs = GLLine.objects.filter(account=acc)
    if currency:
        qs = qs.filter(currency=currency.upper())
    rows = qs.values('currency').annotate(d=Sum('debit'), c=Sum('credit'))
    out = {}
    for r in rows:
        out[r['currency']] = (r['d'] or Decimal('0')) - (r['c'] or Decimal('0'))
    if currency:
        return out.get(currency.upper(), Decimal('0'))
    return out


def trial_balance(date_from=None, date_to=None):
    """ميزان مراجعة من الدفتر الموحّد — مجمّع حسب الحساب والعملة."""
    qs = GLLine.objects.all()
    if date_from:
        qs = qs.filter(transaction__date__gte=date_from)
    if date_to:
        qs = qs.filter(transaction__date__lte=date_to)
    rows = (qs.values('account__code', 'account__name', 'currency')
              .annotate(d=Sum('debit'), c=Sum('credit'))
              .order_by('account__code'))
    out = []
    for r in rows:
        d = r['d'] or Decimal('0')
        c = r['c'] or Decimal('0')
        out.append({
            'code': r['account__code'], 'name': r['account__name'],
            'currency': r['currency'],
            'debit': float(d), 'credit': float(c), 'balance': float(d - c),
        })
    return out
