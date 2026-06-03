"""
am_exchange.py — API تبديل عملات (صفحة إدارة الحسابات)
═══════════════════════════════════════════════════════════
POST /api/am/exchange/      ← تنفيذ عملية تبديل عملة
GET  /api/am/exchange/      ← سجل عمليات التبديل
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count, Sum

from ..models import CurrencySwap
from core.permissions import require_roles as _require_roles, caller_name as _caller

VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'SYP', 'EGP')


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


@csrf_exempt
def api_am_exchange(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    # ── GET: سجل التبديلات ────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = CurrencySwap.objects.all()

        q        = request.GET.get('q', '').strip()
        date_from= request.GET.get('date_from', '').strip()
        date_to  = request.GET.get('date_to', '').strip()

        if q:
            qs = qs.filter(
                center1_name__icontains=q,
            ) | CurrencySwap.objects.filter(center2_name__icontains=q) | \
                CurrencySwap.objects.filter(ref_number__icontains=q)
            qs = qs.distinct()

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

        return JsonResponse({
            'success':    True,
            'total':      total,
            'page':       page,
            'totalPages': max(1, (total + per_page - 1) // per_page),
            'swaps':      [s.to_dict() for s in items],
        })

    # ── POST: تنفيذ تبديل جديد ────────────────────────────────────────────────
    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        center1  = (data.get('center1') or '').strip()
        center2  = (data.get('center2') or '').strip()
        cur1     = (data.get('currency1') or '').upper().strip()
        cur2     = (data.get('currency2') or '').upper().strip()
        amt1     = _dec(data.get('amount1', 0))
        rate     = _dec(data.get('rate', 1))
        notes    = (data.get('notes') or '').strip()

        # ── التحقق ────────────────────────────────────────────────────────────
        errors = []
        if not center1:               errors.append('المركز الأول مطلوب')
        if not center2:               errors.append('المركز الثاني مطلوب')
        if center1 == center2:        errors.append('المركزان متطابقان')
        if cur1 not in VALID_CURRENCIES: errors.append(f'عملة المركز الأول غير مدعومة: {cur1}')
        if cur2 not in VALID_CURRENCIES: errors.append(f'عملة المركز الثاني غير مدعومة: {cur2}')
        if cur1 == cur2:              errors.append('العملتان متطابقتان — لا داعي للتبديل')
        if amt1 <= 0:                 errors.append('المبلغ يجب أن يكون أكبر من الصفر')
        if rate <= 0:                 errors.append('سعر الصرف غير صالح')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        # ── الحساب: amount2 = amount1 × rate ──────────────────────────────────
        amt2 = amt1 * rate

        swap = CurrencySwap.objects.create(
            center1_name = center1,
            center2_name = center2,
            currency1    = cur1,
            currency2    = cur2,
            amount1      = amt1,
            amount2      = amt2,
            rate         = rate,
            notes        = notes,
            created_by   = _caller(request),
        )

        return JsonResponse({
            'success': True,
            'message': f'تم تنفيذ التبديل {swap.ref_number}',
            'swap':    swap.to_dict(),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
