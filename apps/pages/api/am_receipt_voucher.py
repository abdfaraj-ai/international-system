"""
am_receipt_voucher.py — API سند قبض
════════════════════════════════════
GET    /api/am/receipt-voucher/        ← قائمة السندات
POST   /api/am/receipt-voucher/        ← إنشاء سند جديد
GET    /api/am/receipt-voucher/<id>/   ← تفاصيل سند
DELETE /api/am/receipt-voucher/<id>/   ← حذف سند
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from ..models import ReceiptVoucher
from core.permissions import require_roles as _require_roles, caller_name as _caller


def _norm_dir(v):
    s = (v or 'mul').strip().lower()
    if s in ('mul', 'multiply', 'x', '*'):
        return 'mul'
    if s in ('div', 'divide', '/'):
        return 'div'
    return s


VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'SYP', 'EGP')
VALID_CUT_DIR    = ('mul', 'div')


def _dec(v, d='0') -> Decimal:
    try:
        return Decimal(str(v if v is not None else d))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(d)


def _parse(request):
    try:
        return json.loads(request.body), None
    except Exception:
        return None, JsonResponse({'success': False, 'message': 'JSON غير صالح'}, status=400)


def _today():
    return timezone.localdate().strftime('%Y-%m-%d')


def _calc_profit(from_amt, from_fee, to_amt, to_fee, from_cur, to_cur, cut_rate, cut_dir):
    """حساب فرق القص والربح الكلي"""
    if from_cur == to_cur:
        to_in_from = to_amt
    else:
        to_in_from = to_amt * cut_rate if cut_dir == 'div' else to_amt / cut_rate
    cut_diff  = abs(float(from_amt) - float(to_in_from))
    net_profit = cut_diff + float(from_fee) + float(to_fee)
    return Decimal(str(round(cut_diff, 4))), Decimal(str(round(net_profit, 4)))


# ══════════════════════════════════════════════════════════════════════════════
# GET + POST  /api/am/receipt-voucher/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_receipt_voucher(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    # ── GET ───────────────────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = ReceiptVoucher.objects.all()

        q         = request.GET.get('q', '').strip()
        date_from = request.GET.get('date_from', '').strip()
        date_to   = request.GET.get('date_to', '').strip()

        if q:
            qs = qs.filter(
                Q(ref_number__icontains=q)   |
                Q(from_center__icontains=q)  |
                Q(to_center__icontains=q)    |
                Q(from_notes__icontains=q)   |
                Q(to_notes__icontains=q)
            )
        if date_from:
            try: qs = qs.filter(entry_date__gte=date_from)
            except Exception: pass
        if date_to:
            try: qs = qs.filter(entry_date__lte=date_to)
            except Exception: pass

        try:
            page     = max(1, int(request.GET.get('page', 1)))
            per_page = min(200, max(1, int(request.GET.get('per_page', 20))))
        except (ValueError, TypeError):
            page, per_page = 1, 20

        total  = qs.count()
        offset = (page - 1) * per_page
        items  = list(qs[offset: offset + per_page])

        agg_from = qs.aggregate(t=Sum('from_amount'))['t'] or 0
        agg_profit = qs.aggregate(t=Sum('net_profit'))['t'] or 0

        return JsonResponse({
            'success':    True,
            'total':      total,
            'totalFrom':  float(agg_from),
            'totalProfit':float(agg_profit),
            'page':       page,
            'totalPages': max(1, (total + per_page - 1) // per_page),
            'records':    [r.to_dict() for r in items],
        })

    # ── POST ──────────────────────────────────────────────────────────────────
    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        from_center   = (data.get('fromCenter')   or '').strip()
        from_currency = (data.get('fromCurrency') or 'USD').upper().strip()
        from_amount   = _dec(data.get('fromAmount', 0))
        from_fee      = _dec(data.get('fromFee', 0))
        from_notes    = (data.get('fromNotes')    or '').strip()

        cut_rate = _dec(data.get('cutRate', 1))
        cut_dir  = _norm_dir(data.get('cutDir'))

        to_center   = (data.get('toCenter')   or '').strip()
        to_currency = (data.get('toCurrency') or 'USD').upper().strip()
        to_amount   = _dec(data.get('toAmount', 0))
        to_fee      = _dec(data.get('toFee', 0))
        to_notes    = (data.get('toNotes')    or '').strip()

        entry_date = (data.get('entryDate') or _today()).strip()

        errors = []
        if not from_center:                    errors.append('المركز المرسل مطلوب')
        if not to_center:                      errors.append('المركز المستلم مطلوب')
        if from_currency not in VALID_CURRENCIES: errors.append(f'عملة الإرسال غير مدعومة: {from_currency}')
        if to_currency not in VALID_CURRENCIES:   errors.append(f'عملة الاستلام غير مدعومة: {to_currency}')
        if from_amount <= 0:                   errors.append('مبلغ الإرسال يجب أن يكون أكبر من الصفر')
        if cut_dir not in VALID_CUT_DIR:       errors.append('اتجاه القص غير صالح')
        if cut_rate <= 0:                      errors.append('سعر القص يجب أن يكون أكبر من الصفر')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        # حساب مبلغ الاستلام إذا لم يُرسَل
        if to_amount <= 0:
            to_amount = from_amount * cut_rate if cut_dir == 'mul' else from_amount / cut_rate

        cut_diff, net_profit = _calc_profit(
            from_amount, from_fee, to_amount, to_fee,
            from_currency, to_currency, cut_rate, cut_dir
        )

        try:
            from datetime import date
            parsed_date = date.fromisoformat(entry_date)
        except Exception:
            parsed_date = timezone.localdate()

        with transaction.atomic():
            record = ReceiptVoucher.objects.create(
                from_center   = from_center,
                from_currency = from_currency,
                from_amount   = from_amount,
                from_fee      = from_fee,
                from_notes    = from_notes,
                cut_rate      = cut_rate,
                cut_dir       = cut_dir,
                to_center     = to_center,
                to_currency   = to_currency,
                to_amount     = to_amount,
                to_fee        = to_fee,
                to_notes      = to_notes,
                entry_date    = parsed_date,
                cut_diff      = cut_diff,
                net_profit    = net_profit,
                created_by    = _caller(request),
            )

        return JsonResponse({
            'success': True,
            'message': f'تم إنشاء سند القبض {record.ref_number}',
            'record':  record.to_dict(),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# GET + DELETE  /api/am/receipt-voucher/<id>/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_receipt_voucher_detail(request, voucher_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    try:
        record = ReceiptVoucher.objects.get(id=voucher_id)
    except ReceiptVoucher.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'السند غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'record': record.to_dict()})

    if request.method == 'DELETE':
        ref = record.ref_number
        record.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف السند {ref}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
