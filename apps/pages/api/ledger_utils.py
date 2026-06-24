"""
ledger_utils.py — أدوات سجل حركات المراكز (CenterLedger)
═══════════════════════════════════════════════════════════
الدالة المركزية post_ledger() تُسجّل حركة على مركز، وتُستخدم من كل
العمليات المحاسبية (قيود، سندات، حوالات، صرف) لربطها بالأرصدة.

اصطلاح القيد المزدوج:
  - المركز المُرسل (from): يخرج منه المال  → credit
  - المركز المستلم (to):   يدخل إليه المال → debit
"""
from decimal import Decimal
from django.db.models import Sum, F

from ..models import CenterLedger


def _dec(v):
    try:
        return Decimal(str(v or 0))
    except Exception:
        return Decimal('0')


def post_ledger(center, currency, *, debit=0, credit=0,
                source='manual', source_id=None, ref_number='', note='', created_by=''):
    """
    يُسجّل حركة واحدة على مركز. يجب استدعاؤها داخل transaction.atomic().
    debit  = مبلغ يدخل للمركز (يزيد رصيده)
    credit = مبلغ يخرج من المركز (ينقص رصيده)
    """
    center = (center or '').strip()
    currency = (currency or 'USD').upper().strip()
    if not center:
        return None
    deb = _dec(debit)
    crd = _dec(credit)
    if deb == 0 and crd == 0:
        return None
    return CenterLedger.objects.create(
        center=center, currency=currency,
        debit=deb, credit=crd,
        source=source, source_id=source_id,
        ref_number=ref_number or '', note=note or '',
        created_by=created_by or '',
    )


def post_transfer(from_center, to_center, *, from_currency, from_amount,
                  to_currency, to_amount, source, source_id=None,
                  ref_number='', note='', created_by=''):
    """
    يُسجّل حركتي تحويل: خروج من المُرسل ودخول للمستلم.
    يدعم اختلاف العملات (صرف): يخرج from_amount بعملة from_currency،
    ويدخل to_amount بعملة to_currency.
    """
    post_ledger(
        from_center, from_currency, credit=from_amount,
        source=source, source_id=source_id, ref_number=ref_number,
        note=note or 'تحويل صادر', created_by=created_by,
    )
    post_ledger(
        to_center, to_currency, debit=to_amount,
        source=source, source_id=source_id, ref_number=ref_number,
        note=note or 'تحويل وارد', created_by=created_by,
    )


def reverse_ledger(source, source_id):
    """
    يعكس كل حركات عملية معيّنة (عند حذف العملية).
    يُنشئ حركات معاكسة بدلاً من حذف الأصلية (للحفاظ على سجل المراجعة).
    يجب استدعاؤها داخل transaction.atomic().
    """
    rows = list(CenterLedger.objects.filter(source=source, source_id=source_id))
    # حماية من العكس المزدوج: إن وُجدت أي حركة عكسية مسبقاً فالعملية مُعكوسة — لا تُعكس ثانيةً
    if any(r.note.startswith('عكس ') for r in rows):
        return 0
    reversed_count = 0
    for r in rows:
        if r.note.startswith('عكس '):
            continue
        CenterLedger.objects.create(
            center=r.center, currency=r.currency,
            debit=r.credit, credit=r.debit,   # معكوس
            source=r.source, source_id=r.source_id,
            ref_number=r.ref_number,
            note=f'عكس {r.note}'.strip(),
            created_by=r.created_by,
        )
        reversed_count += 1
    return reversed_count


def center_balances(center):
    """
    يُرجع أرصدة مركز لكل عملاته: {currency: balance}
    balance = sum(debit) - sum(credit)
    """
    center = (center or '').strip()
    rows = (CenterLedger.objects
            .filter(center=center)
            .values('currency')
            .annotate(d=Sum('debit'), c=Sum('credit')))
    out = {}
    for r in rows:
        bal = (r['d'] or Decimal('0')) - (r['c'] or Decimal('0'))
        out[r['currency']] = float(bal)
    return out


def all_centers_balances():
    """يُرجع أرصدة كل المراكز: {center: {currency: balance}}"""
    rows = (CenterLedger.objects
            .values('center', 'currency')
            .annotate(d=Sum('debit'), c=Sum('credit')))
    out = {}
    for r in rows:
        bal = float((r['d'] or Decimal('0')) - (r['c'] or Decimal('0')))
        out.setdefault(r['center'], {})[r['currency']] = bal
    return out
