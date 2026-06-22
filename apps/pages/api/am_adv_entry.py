"""
am_adv_entry.py — API القيد المتقدم
═════════════════════════════════════
GET  /api/am/adv-entry/        ← سجل القيود المتقدمة
POST /api/am/adv-entry/        ← إنشاء قيد متقدم جديد
GET  /api/am/adv-entry/<id>/   ← تفاصيل قيد واحد
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Q, Sum

from ..models import AdvancedEntry
from core.permissions import require_roles as _require_roles, caller_name as _caller

VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'SYP', 'EGP')
VALID_DIRS       = ('mul', 'div')


def _norm_dir(v):
    s = (v or 'mul').strip().lower()
    if s in ('mul', 'multiply', 'x', '*'):
        return 'mul'
    if s in ('div', 'divide', '/'):
        return 'div'
    return s



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
    if rate == 0:
        return Decimal('0')
    return from_amt / rate if direction == 'div' else from_amt * rate


# ══════════════════════════════════════════════════════════════════════════════
# GET + POST  /api/am/adv-entry/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_adv_entry(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    # ── GET: سجل القيود ───────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = AdvancedEntry.objects.all()

        q         = request.GET.get('q', '').strip()
        date_from = request.GET.get('date_from', '').strip()
        date_to   = request.GET.get('date_to', '').strip()

        if q:
            qs = qs.filter(
                Q(ref_number__icontains=q)    |
                Q(from_center__icontains=q)   |
                Q(to_center__icontains=q)     |
                Q(from_name__icontains=q)     |
                Q(to_beneficiary__icontains=q)
            )
        if date_from:
            try: qs = qs.filter(created_at__date__gte=date_from)
            except Exception: pass
        if date_to:
            try: qs = qs.filter(created_at__date__lte=date_to)
            except Exception: pass

        try:
            page     = max(1, int(request.GET.get('page', 1)))
            per_page = min(100, max(1, int(request.GET.get('per_page', 20))))
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

    # ── POST: تنفيذ قيد متقدم جديد ───────────────────────────────────────────
    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        from_center = (data.get('fromCenter')   or '').strip()
        from_name   = (data.get('fromName')     or '').strip()
        from_cur    = (data.get('fromCurrency') or 'USD').upper().strip()
        from_amt    = _dec(data.get('fromAmount', 0))
        from_fee    = _dec(data.get('fromFee',   0))
        from_fee_cur= (data.get('fromFeeCur')   or 'USD').upper().strip()
        from_notes  = (data.get('fromNotes')    or '').strip()

        cut_rate    = _dec(data.get('cutRate', 1))
        cut_dir     = _norm_dir(data.get('cutDir'))

        to_center   = (data.get('toCenter')      or '').strip()
        to_benef    = (data.get('toBeneficiary') or '').strip()
        to_cur      = (data.get('toCurrency')    or 'USD').upper().strip()
        to_fee      = _dec(data.get('toFee',   0))
        to_fee_cur  = (data.get('toFeeCur')      or 'USD').upper().strip()
        to_notes    = (data.get('toNotes')       or '').strip()

        # ── التحقق ────────────────────────────────────────────────────────────
        errors = []
        if not from_center:                    errors.append('المركز المُرسل مطلوب')
        if not to_center:                      errors.append('المركز المستلم مطلوب')
        if from_amt <= 0:                      errors.append('مبلغ الإرسال يجب أن يكون أكبر من الصفر')
        if cut_rate <= 0:                      errors.append('سعر القص غير صالح')
        if cut_dir not in VALID_DIRS:          errors.append('اتجاه القص غير صالح')
        if from_cur not in VALID_CURRENCIES:   errors.append(f'عملة الإرسال غير مدعومة: {from_cur}')
        if to_cur   not in VALID_CURRENCIES:   errors.append(f'عملة الاستلام غير مدعومة: {to_cur}')
        if from_fee_cur not in VALID_CURRENCIES: errors.append(f'عملة أجور الإرسال غير مدعومة: {from_fee_cur}')
        if to_fee_cur   not in VALID_CURRENCIES: errors.append(f'عملة أجور الاستلام غير مدعومة: {to_fee_cur}')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        # ── الحساب ────────────────────────────────────────────────────────────
        to_amt = _to_amount(from_amt, cut_rate, cut_dir)

        # فارق القص: نحوّل to_amt لعملة from_cur ثم نحسب الفرق
        if from_cur == to_cur:
            cut_diff = abs(from_amt - to_amt)
        else:
            # أعد تحويل to_amt → from_cur عبر عكس القص
            if cut_dir == 'div':
                to_in_from = to_amt * cut_rate if cut_rate != 0 else Decimal('0')
            else:
                to_in_from = to_amt / cut_rate if cut_rate != 0 else Decimal('0')
            cut_diff = abs(from_amt - to_in_from)

        # تحويل الأجور للعملة الأساسية (from_cur) قبل جمعها
        def _fee_to_base(fee: Decimal, fee_cur: str) -> Decimal:
            if not fee or fee_cur == from_cur:
                return fee
            # تحويل تقريبي: أجور to_cur → from_cur عبر سعر القص
            if fee_cur == to_cur:
                if cut_dir == 'div':
                    return fee * cut_rate if cut_rate != 0 else fee
                else:
                    return fee / cut_rate if cut_rate != 0 else fee
            return fee  # عملة أخرى: نأخذها كما هي (تحسين مستقبلي)

        from_fee_base = _fee_to_base(from_fee, from_fee_cur)
        to_fee_base   = _fee_to_base(to_fee,   to_fee_cur)
        profit        = cut_diff + from_fee_base + to_fee_base

        with transaction.atomic():
            record = AdvancedEntry.objects.create(
                from_center    = from_center,
                from_name      = from_name,
                from_currency  = from_cur,
                from_amount    = from_amt,
                from_fee       = from_fee,
                from_fee_cur   = from_fee_cur,
                from_notes     = from_notes,
                cut_rate       = cut_rate,
                cut_dir        = cut_dir,
                to_center      = to_center,
                to_beneficiary = to_benef,
                to_currency    = to_cur,
                to_amount      = to_amt,
                to_fee         = to_fee,
                to_fee_cur     = to_fee_cur,
                to_notes       = to_notes,
                cut_diff       = cut_diff,
                net_profit     = profit,
                created_by     = _caller(request),
            )
            # ── الربط المحاسبي: تسجيل حركتي التحويل على المركزين ──
            from .ledger_utils import post_transfer
            post_transfer(
                from_center, to_center,
                from_currency=from_cur, from_amount=from_amt,
                to_currency=to_cur,     to_amount=to_amt,
                source='adv_entry', source_id=record.id,
                ref_number=record.ref_number,
                created_by=_caller(request),
            )

        return JsonResponse({
            'success':   True,
            'message':   f'تم تنفيذ القيد {record.ref_number}',
            'netProfit': float(profit),
            'record':    record.to_dict(),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# GET + DELETE /api/am/adv-entry/<id>/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_adv_entry_detail(request, entry_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err
    try:
        record = AdvancedEntry.objects.get(id=entry_id)
    except AdvancedEntry.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'القيد غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'record': record.to_dict()})

    if request.method == 'DELETE':
        ref = record.ref_number
        # عكس الحركات المحاسبية قبل الحذف
        from .ledger_utils import reverse_ledger
        with transaction.atomic():
            reverse_ledger('adv_entry', record.id)
            record.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف القيد {ref}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
