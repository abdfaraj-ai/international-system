"""
am_center_profits.py — أرباح من كل صندوق/مركز
════════════════════════════════════════════════
GET /api/center-profits/?from=YYYY-MM-DD&to=YYYY-MM-DD
يجمع net_profit من: ReceiptVoucher, PaymentVoucher, AdvancedEntry
مجمّعة حسب from_center وعملة التشغيل
"""
from collections import defaultdict
from decimal import Decimal
from datetime import date

from django.http import JsonResponse
from django.db.models import Q

from ..models import ReceiptVoucher, PaymentVoucher, AdvancedEntry
from core.permissions import require_roles as _require_roles

# أعمدة العملات المعروضة في الجدول (بنفس ترتيب الصورة)
CURRENCY_COLS = [
    ('TRY',  'lira_tr'),
    ('USD',  'dollar'),
    ('EUR',  'euro'),
    ('AED',  'dirham_ae'),
    ('DZD',  'dinar_dz'),
    ('EGP',  'pound_eg'),
    ('ILS',  'shekel'),
    ('JOD',  'dinar_jo'),
    ('SAR',  'riyal_sa'),
    ('TND',  'dinar_tn'),
    ('VOD',  'vodafone_cash'),
    ('PSP',  'pound_ps'),
    ('ILSB', 'shekel_bank'),
    ('ILST', 'shekel_tf'),
]

CURRENCY_TO_FIELD = {cur: field for cur, field in CURRENCY_COLS}
ALL_FIELDS = [f for _, f in CURRENCY_COLS]


def _d(s):
    try:
        return date.fromisoformat(s)
    except Exception:
        return None


def _zero_row(center_id, name):
    r = {'id': center_id, 'name': name, 'total_profit': Decimal('0')}
    for f in ALL_FIELDS:
        r[f] = Decimal('0')
    return r


def api_center_profits(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    date_from = _d(request.GET.get('from', ''))
    date_to   = _d(request.GET.get('to', ''))

    # مجمّع: center_name → row_dict
    centers = {}

    def get_row(name):
        if name not in centers:
            centers[name] = _zero_row(len(centers) + 1, name)
        return centers[name]

    def add_profit(name, currency, profit):
        row = get_row(name)
        field = CURRENCY_TO_FIELD.get(currency)
        if field:
            row[field] += profit
        row['total_profit'] += profit

    # ── سندات القبض ──────────────────────────────────────────────────────────
    rv_qs = ReceiptVoucher.objects.filter(net_profit__gt=0)
    if date_from:
        rv_qs = rv_qs.filter(entry_date__gte=date_from)
    if date_to:
        rv_qs = rv_qs.filter(entry_date__lte=date_to)
    for v in rv_qs:
        add_profit(v.from_center or '—', v.from_currency or 'USD', v.net_profit)

    # ── سندات الدفع ──────────────────────────────────────────────────────────
    pv_qs = PaymentVoucher.objects.filter(net_profit__gt=0)
    if date_from:
        pv_qs = pv_qs.filter(entry_date__gte=date_from)
    if date_to:
        pv_qs = pv_qs.filter(entry_date__lte=date_to)
    for v in pv_qs:
        add_profit(v.from_center or '—', v.from_currency or 'USD', v.net_profit)

    # ── قيود متقدمة ──────────────────────────────────────────────────────────
    ae_qs = AdvancedEntry.objects.filter(net_profit__gt=0)
    if date_from:
        ae_qs = ae_qs.filter(created_at__date__gte=date_from)
    if date_to:
        ae_qs = ae_qs.filter(created_at__date__lte=date_to)
    for e in ae_qs:
        add_profit(e.from_center or '—', e.from_currency or 'USD', e.net_profit)

    # ── تحويل إلى قائمة وترتيب ───────────────────────────────────────────────
    result = []
    for idx, (name, row) in enumerate(sorted(centers.items()), start=1):
        row['id'] = idx
        result.append({
            k: float(v) if isinstance(v, Decimal) else v
            for k, v in row.items()
        })

    return JsonResponse(result, safe=False)
