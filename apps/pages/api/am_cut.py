"""
am_cut.py — API قص وإغلاق (صفحة إدارة الحسابات)
═══════════════════════════════════════════════════
POST /api/am/cut/      ← تنفيذ قص وإغلاق
GET  /api/am/cut/      ← سجل عمليات القص
GET  /api/am/cut/<id>/ ← تفاصيل سند واحد
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..models import CutAndClose
from core.permissions import require_roles as _require_roles, caller_name as _caller

VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'SYP', 'EGP')
VALID_DIRS       = ('mul', 'div')


def _dec(v, d='0') -> Decimal:
    try:
        return Decimal(str(v if v is not None else d))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(d)


def _to_usd(amount: Decimal, rate: Decimal, direction: str) -> Decimal:
    """يحوّل المبلغ للدولار حسب اتجاه القص."""
    if rate == 0:
        return Decimal('0')
    return amount / rate if direction == 'div' else amount * rate


def _parse(request):
    try:
        return json.loads(request.body), None
    except Exception:
        return None, JsonResponse({'success': False, 'message': 'JSON غير صالح'}, status=400)


# ══════════════════════════════════════════════════════════════════════════════
# GET + POST  /api/am/cut/
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_am_cut(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    # ── GET: سجل العمليات ─────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = CutAndClose.objects.all()

        q        = request.GET.get('q', '').strip()
        date_from= request.GET.get('date_from', '').strip()
        date_to  = request.GET.get('date_to', '').strip()

        if q:
            from django.db.models import Q
            qs = qs.filter(
                Q(ref_number__icontains=q) |
                Q(buy_center__icontains=q) |
                Q(sell_center__icontains=q)
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

        total  = qs.count()
        offset = (page - 1) * per_page
        items  = list(qs[offset: offset + per_page])

        # إحصائيات الربح الإجمالي
        from django.db.models import Sum
        profit_sum = qs.aggregate(total_profit=Sum('profit_usd'))['total_profit'] or 0

        return JsonResponse({
            'success':     True,
            'total':       total,
            'totalProfit': float(profit_sum),
            'page':        page,
            'totalPages':  max(1, (total + per_page - 1) // per_page),
            'records':     [r.to_dict() for r in items],
        })

    # ── POST: تنفيذ قص وإغلاق جديد ───────────────────────────────────────────
    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        buy_center  = (data.get('buyCenter')   or '').strip()
        buy_cur     = (data.get('buyCurrency') or '').upper().strip()
        buy_amt     = _dec(data.get('buyAmount',  0))
        buy_rate    = _dec(data.get('buyRate',    1))
        buy_dir     = (data.get('buyDir')      or 'div').strip()
        buy_notes   = (data.get('buyNotes')    or '').strip()

        sell_center = (data.get('sellCenter')   or '').strip()
        sell_cur    = (data.get('sellCurrency') or '').upper().strip()
        sell_amt    = _dec(data.get('sellAmount',  0))
        sell_rate   = _dec(data.get('sellRate',    1))
        sell_dir    = (data.get('sellDir')      or 'div').strip()
        sell_notes  = (data.get('sellNotes')    or '').strip()

        # ── التحقق ────────────────────────────────────────────────────────────
        errors = []
        if not buy_center:                  errors.append('مركز الشراء مطلوب')
        if not sell_center:                 errors.append('مركز البيع مطلوب')
        if buy_cur  not in VALID_CURRENCIES: errors.append(f'عملة الشراء غير مدعومة: {buy_cur}')
        if sell_cur not in VALID_CURRENCIES: errors.append(f'عملة البيع غير مدعومة: {sell_cur}')
        if buy_amt  <= 0:                   errors.append('مبلغ الشراء يجب أن يكون أكبر من الصفر')
        if sell_amt <= 0:                   errors.append('مبلغ البيع يجب أن يكون أكبر من الصفر')
        if buy_rate <= 0:                   errors.append('سعر قص الشراء غير صالح')
        if sell_rate <= 0:                  errors.append('سعر قص البيع غير صالح')
        if buy_dir  not in VALID_DIRS:      errors.append('اتجاه قص الشراء غير صالح')
        if sell_dir not in VALID_DIRS:      errors.append('اتجاه قص البيع غير صالح')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        # ── الحساب ────────────────────────────────────────────────────────────
        buy_usd  = _to_usd(buy_amt,  buy_rate,  buy_dir)
        sell_usd = _to_usd(sell_amt, sell_rate, sell_dir)
        profit   = buy_usd - sell_usd

        record = CutAndClose.objects.create(
            buy_center   = buy_center,
            buy_currency = buy_cur,
            buy_amount   = buy_amt,
            buy_rate     = buy_rate,
            buy_dir      = buy_dir,
            buy_usd      = buy_usd,
            buy_notes    = buy_notes,
            sell_center  = sell_center,
            sell_currency= sell_cur,
            sell_amount  = sell_amt,
            sell_rate    = sell_rate,
            sell_dir     = sell_dir,
            sell_usd     = sell_usd,
            sell_notes   = sell_notes,
            profit_usd   = profit,
            created_by   = _caller(request),
        )

        return JsonResponse({
            'success':   True,
            'message':   f'تم تنفيذ القص {record.ref_number}',
            'profitUsd': float(profit),
            'record':    record.to_dict(),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/am/cut/<id>/   ← تفاصيل سند واحد (للطباعة لاحقاً)
# ══════════════════════════════════════════════════════════════════════════════

def api_am_cut_detail(request, cut_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'GET فقط'}, status=405)
    try:
        record = CutAndClose.objects.get(id=cut_id)
    except CutAndClose.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'السند غير موجود'}, status=404)
    return JsonResponse({'success': True, 'record': record.to_dict()})
