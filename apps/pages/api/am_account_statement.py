"""
am_account_statement.py — API كشف حساب المركز
══════════════════════════════════════════════
GET /api/account-statement/?center=<id|name>&currency=<key>&date_from=&date_to=&include_unsent=

يعرض جميع الحركات المسجّلة على مركز (من CenterLedger) بعملة محدّدة خلال فترة،
مع رصيد افتتاحي (ما قبل الفترة) ورصيد جارٍ تراكمي والإجماليات.
"""
from decimal import Decimal
from django.http import JsonResponse

from ..models import CostCenter, CenterLedger
from core.permissions import require_roles as _require_roles


# أسماء العملة الرمزية في الواجهة → رموز CenterLedger
_CUR_MAP = {
    'dollar':    'USD', 'euro':      'EUR', 'lira_tr':   'TRY',
    'shekel':    'ILS', 'dinar_jo':  'JOD', 'riyal_sa':  'SAR',
    'pound_eg':  'EGP', 'dirham_ae': 'AED',
}


def _resolve_center(raw):
    """يحوّل معرّف/اسم المركز القادم من الواجهة إلى اسم المركز المخزَّن في الحركات."""
    raw = (raw or '').strip()
    if not raw:
        return ''
    if raw.isdigit():
        cc = CostCenter.objects.filter(id=int(raw)).first()
        return cc.name if cc else ''
    return raw  # مُرِّر الاسم مباشرةً


def api_account_statement(request):
    err = _require_roles(request, 'M01')
    if err:
        return err

    center_name = _resolve_center(request.GET.get('center', ''))
    cur_key     = (request.GET.get('currency', 'dollar') or 'dollar').strip()
    code        = _CUR_MAP.get(cur_key, cur_key.upper())
    date_from   = (request.GET.get('date_from', '') or '').strip()
    date_to     = (request.GET.get('date_to', '')   or '').strip()

    if not center_name:
        return JsonResponse({'success': False, 'message': 'المركز غير موجود', 'records': []}, status=400)

    base = CenterLedger.objects.filter(center=center_name, currency=code)

    # ── الرصيد الافتتاحي: صافي كل الحركات قبل بداية الفترة ──
    opening = Decimal('0')
    if date_from:
        for r in base.filter(created_at__date__lt=date_from).values('debit', 'credit'):
            opening += (r['debit'] or Decimal('0')) - (r['credit'] or Decimal('0'))

    qs = base
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    qs = qs.order_by('created_at', 'id')

    records = []
    running      = opening
    total_debit  = Decimal('0')
    total_credit = Decimal('0')

    # صف الرصيد الافتتاحي (يظهر فقط عند وجود فترة برصيد سابق)
    if date_from and opening != 0:
        records.append({
            'id':          0,
            'date':        date_from,
            'type':        'رصيد افتتاحي',
            'description': 'رصيد ما قبل الفترة',
            'debit':       float(opening) if opening > 0 else 0,
            'credit':      float(-opening) if opening < 0 else 0,
            'balance':     float(opening),
            'remarks':     '',
        })

    for r in qs:
        running      += r.debit - r.credit
        total_debit  += r.debit
        total_credit += r.credit
        records.append({
            'id':          r.id,
            'date':        r.created_at.strftime('%Y-%m-%d %H:%M'),
            'type':        r.get_source_display(),
            'description': r.note or r.ref_number or '—',
            'debit':       float(r.debit),
            'credit':      float(r.credit),
            'balance':     float(running),
            'remarks':     r.ref_number or '',
        })

    return JsonResponse({
        'success':      True,
        'center':       center_name,
        'currency':     code,
        'opening':      float(opening),
        'totalDebit':   float(total_debit),
        'totalCredit':  float(total_credit),
        'balance':      float(running),
        'count':        len(records),
        'records':      records,
    })
