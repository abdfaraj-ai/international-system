"""
am_entry_from_to.py — API قيد جديد (من → الى)
═══════════════════════════════════════════════
GET  /api/am/entry-from-to/        ← سجل القيود
POST /api/am/entry-from-to/        ← إنشاء قيد جديد
GET  /api/am/entry-from-to/<id>/   ← تفاصيل قيد واحد
DELETE /api/am/entry-from-to/<id>/ ← حذف قيد
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import Q, Sum

from ..models import EntryFromTo
from core.permissions import require_roles as _require_roles, caller_name as _caller

VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'SYP', 'EGP')
VALID_DIRS       = ('mul', 'div')


def _norm_dir(v):
    """تطبيع اتجاه القص — يقبل multiply/divide و mul/div و ضرب/قسمة."""
    s = (v or 'mul').strip().lower()
    if s in ('mul', 'multiply', 'x', '*', 'ضرب'):
        return 'mul'
    if s in ('div', 'divide', '/', 'قسمة'):
        return 'div'
    return s  # يبقى كما هو ليُرفض إن كان غير معروف


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


def _to_amount(from_amt: Decimal, rate: Decimal, direction: str) -> Decimal:
    """احسب مبلغ الاستلام بعد تطبيق القص."""
    if rate == 0:
        return Decimal('0')
    return from_amt / rate if direction == 'div' else from_amt * rate


def _calc_profit(from_amt: Decimal, to_amt: Decimal,
                 from_cur: str, to_cur: str,
                 cut_rate: Decimal, cut_dir: str,
                 from_fee: Decimal, to_fee: Decimal) -> tuple[Decimal, Decimal]:
    """
    يُعيد (cut_diff, net_profit).
    cut_diff  = الفرق الناتج عن سعر الصرف (بعملة الإرسال).
    net_profit = cut_diff + أجور التصدير + أجور التسليم (محوَّلة لعملة الإرسال).
    """
    # حوّل to_amount → عملة الإرسال للمقارنة
    if from_cur == to_cur:
        to_in_from = to_amt
    else:
        if cut_dir == 'div':
            to_in_from = to_amt * cut_rate if cut_rate != 0 else Decimal('0')
        else:
            to_in_from = to_amt / cut_rate if cut_rate != 0 else Decimal('0')

    cut_diff = abs(from_amt - to_in_from)

    # أجور التسليم → عملة الإرسال (تقريبي عبر سعر القص)
    if from_cur != to_cur and to_fee:
        if cut_dir == 'div':
            to_fee_base = to_fee * cut_rate if cut_rate != 0 else to_fee
        else:
            to_fee_base = to_fee / cut_rate if cut_rate != 0 else to_fee
    else:
        to_fee_base = to_fee

    net_profit = cut_diff + from_fee + to_fee_base
    return cut_diff, net_profit


# ══════════════════════════════════════════════════════════════════════════════
# GET + POST  /api/am/entry-from-to/
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_am_entry_from_to(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    # ── GET: سجل القيود ───────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = EntryFromTo.objects.all()

        q         = request.GET.get('q', '').strip()
        date_from = request.GET.get('date_from', '').strip()
        date_to   = request.GET.get('date_to', '').strip()

        if q:
            qs = qs.filter(
                Q(ref_number__icontains=q)       |
                Q(from_center__icontains=q)      |
                Q(to_center__icontains=q)        |
                Q(from_beneficiary__icontains=q)
            )
        if date_from:
            try: qs = qs.filter(created_at__date__gte=date_from)
            except Exception: pass
        if date_to:
            try: qs = qs.filter(created_at__date__lte=date_to)
            except Exception: pass

        try:
            page     = max(1, int(request.GET.get('page', 1)))
            per_page = min(200, max(1, int(request.GET.get('per_page', 20))))
        except (ValueError, TypeError):
            page, per_page = 1, 20

        total      = qs.count()
        offset     = (page - 1) * per_page
        items      = list(qs[offset: offset + per_page])
        profit_sum = qs.aggregate(t=Sum('net_profit'))['t'] or 0

        return JsonResponse({
            'success':     True,
            'total':       total,
            'totalProfit': float(profit_sum),
            'page':        page,
            'totalPages':  max(1, (total + per_page - 1) // per_page),
            'records':     [r.to_dict() for r in items],
        })

    # ── POST: تنفيذ قيد جديد ─────────────────────────────────────────────────
    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        from_center  = (data.get('fromCenter')      or '').strip()
        from_cur     = (data.get('fromCurrency')    or 'USD').upper().strip()
        from_amt     = _dec(data.get('fromAmount',   0))
        from_fee     = _dec(data.get('fromFee',      0))
        from_benef   = (data.get('fromBeneficiary') or '').strip()
        from_notes   = (data.get('fromNotes')       or '').strip()

        cut_rate     = _dec(data.get('cutRate', 1))
        cut_dir      = _norm_dir(data.get('cutDir'))

        to_center    = (data.get('toCenter')   or '').strip()
        to_cur       = (data.get('toCurrency') or 'USD').upper().strip()
        to_fee       = _dec(data.get('toFee',  0))
        to_notes     = (data.get('toNotes')    or '').strip()

        # ── التحقق من المدخلات ────────────────────────────────────────────────
        errors = []
        if not from_center:                    errors.append('المركز المُرسل مطلوب')
        if not to_center:                      errors.append('المركز المستلم مطلوب')
        if from_center == to_center:           errors.append('المركز المُرسل والمستلم يجب أن يكونا مختلفَين')
        if from_amt <= 0:                      errors.append('مبلغ الإرسال يجب أن يكون أكبر من الصفر')
        if cut_rate <= 0:                      errors.append('سعر القص غير صالح')
        if cut_dir not in VALID_DIRS:          errors.append('اتجاه القص غير صالح')
        if from_cur not in VALID_CURRENCIES:   errors.append(f'عملة الإرسال غير مدعومة: {from_cur}')
        if to_cur   not in VALID_CURRENCIES:   errors.append(f'عملة الاستلام غير مدعومة: {to_cur}')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        # ── الحساب المحاسبي ───────────────────────────────────────────────────
        to_amt                = _to_amount(from_amt, cut_rate, cut_dir)
        cut_diff, net_profit  = _calc_profit(
            from_amt, to_amt, from_cur, to_cur,
            cut_rate, cut_dir, from_fee, to_fee,
        )

        with transaction.atomic():
            record = EntryFromTo.objects.create(
                from_center      = from_center,
                from_currency    = from_cur,
                from_amount      = from_amt,
                from_fee         = from_fee,
                from_beneficiary = from_benef,
                from_notes       = from_notes,
                cut_rate         = cut_rate,
                cut_dir          = cut_dir,
                to_center        = to_center,
                to_currency      = to_cur,
                to_amount        = to_amt,
                to_fee           = to_fee,
                to_notes         = to_notes,
                cut_diff         = cut_diff,
                net_profit       = net_profit,
                created_by       = _caller(request),
            )

        return JsonResponse({
            'success':   True,
            'message':   f'تم تنفيذ القيد {record.ref_number}',
            'netProfit': float(net_profit),
            'toAmount':  float(to_amt),
            'record':    record.to_dict(),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# GET + DELETE  /api/am/entry-from-to/<id>/
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_am_entry_from_to_detail(request, entry_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    try:
        record = EntryFromTo.objects.get(id=entry_id)
    except EntryFromTo.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'القيد غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'record': record.to_dict()})

    if request.method == 'DELETE':
        ref = record.ref_number
        record.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف القيد {ref}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
