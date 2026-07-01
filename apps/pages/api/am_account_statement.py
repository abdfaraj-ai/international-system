"""
am_account_statement.py — API كشف حساب المركز
══════════════════════════════════════════════
GET /api/account-statement/?center=<id|name>&currency=<key>&date_from=&date_to=&include_unsent=

يعرض جميع الحركات المسجّلة على مركز (من CenterLedger) بعملة محدّدة خلال فترة،
مع رصيد افتتاحي (ما قبل الفترة) ورصيد جارٍ تراكمي والإجماليات.
"""
from decimal import Decimal
from django.http import JsonResponse
from django.db.models import Sum

from ..models import CostCenter, CenterLedger, ManagedCurrency, EntryFromTo
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

    # ── إثراء البيان باسمَي الشركتين (الصادر/الوارد) من عملية القيد المصدر ──
    ledger_rows = list(qs)
    entry_ids   = [r.source_id for r in ledger_rows if r.source == 'entry' and r.source_id]
    entry_map   = ({e.id: e for e in EntryFromTo.objects.filter(id__in=entry_ids)}
                   if entry_ids else {})

    for r in ledger_rows:
        running      += r.debit - r.credit
        total_debit  += r.debit
        total_credit += r.credit

        from_center = to_center = ''
        desc = r.note or r.ref_number or '—'
        e = entry_map.get(r.source_id) if r.source == 'entry' else None
        if e:
            from_center = e.from_center   # الصادر (يخرج منه)
            to_center   = e.to_center     # الوارد (يدخل إليه)
            desc = f'صادر: {from_center} — وارد: {to_center}'

        records.append({
            'id':          r.id,
            'date':        r.created_at.strftime('%Y-%m-%d %H:%M'),
            'type':        r.get_source_display(),
            'description': desc,
            'fromCenter':  from_center,   # الصادر
            'toCenter':    to_center,     # الوارد
            'debit':       float(r.debit),
            'credit':      float(r.credit),
            'balance':     float(running),
            'remarks':     r.ref_number or '',
        })

    # ── الرصيد المقوّم بالدولار: صافي كل عملات المركز مقوَّمة عبر «سعر التقييم» ──
    #   الاصطلاح: سعر التقييم = عدد وحدات العملة مقابل دولار واحد ⇒ قيمة الدولار = الرصيد ÷ السعر
    rates = {(c.symbol or '').upper(): (c.eval_rate or Decimal('1'))
             for c in ManagedCurrency.objects.all()}
    val_qs = CenterLedger.objects.filter(center=center_name)
    if date_to:
        val_qs = val_qs.filter(created_at__date__lte=date_to)

    val_rows  = []
    total_usd = Decimal('0')
    for row in val_qs.values('currency').annotate(d=Sum('debit'), c=Sum('credit')).order_by('currency'):
        bal = (row['d'] or Decimal('0')) - (row['c'] or Decimal('0'))
        if bal == 0:
            continue
        cur  = row['currency']
        rate = rates.get((cur or '').upper()) or Decimal('1')
        if rate <= 0:
            rate = Decimal('1')
        usd = bal / rate
        total_usd += usd
        val_rows.append({
            'currency': cur,
            'balance':  float(bal),
            'rate':     float(rate),
            'usd':      float(usd),
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
        'valuation':    {
            'base':     'USD',
            'totalUsd': float(total_usd),
            'rows':     val_rows,
        },
    })
