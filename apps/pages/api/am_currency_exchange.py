"""
am_currency_exchange.py — API تبديل عملة
══════════════════════════════════════════
GET    /api/am/currency-exchange/        ← قائمة
POST   /api/am/currency-exchange/        ← إنشاء
GET    /api/am/currency-exchange/<id>/   ← تفاصيل
DELETE /api/am/currency-exchange/<id>/   ← حذف
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from ..models import CurrencyExchange
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


def _today():
    return timezone.localdate().strftime('%Y-%m-%d')


# ══════════════════════════════════════════════════════════════════════════════
def api_am_currency_exchange(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    # ── GET ──────────────────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = CurrencyExchange.objects.all()

        q         = request.GET.get('q', '').strip()
        date_from = request.GET.get('date_from', '').strip()
        date_to   = request.GET.get('date_to', '').strip()

        if q:
            qs = qs.filter(
                Q(ref_number__icontains=q) |
                Q(center1__icontains=q)    |
                Q(center2__icontains=q)    |
                Q(notes__icontains=q)
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

        return JsonResponse({
            'success':    True,
            'total':      total,
            'page':       page,
            'totalPages': max(1, (total + per_page - 1) // per_page),
            'records':    [r.to_dict() for r in items],
        })

    # ── POST ─────────────────────────────────────────────────────────────────
    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        center1    = (data.get('center1')   or '').strip()
        currency1  = (data.get('currency1') or 'USD').upper().strip()
        amount1    = _dec(data.get('amount1', 0))
        notes      = (data.get('notes')     or '').strip()
        center2    = (data.get('center2')   or '').strip()
        currency2  = (data.get('currency2') or 'EUR').upper().strip()
        amount2    = _dec(data.get('amount2', 0))
        entry_date = (data.get('entryDate') or _today()).strip()

        errors = []
        if not center1:                       errors.append('المركز الأول مطلوب')
        if not center2:                       errors.append('المركز الثاني مطلوب')
        if currency1 not in VALID_CURRENCIES: errors.append(f'العملة الأولى غير مدعومة: {currency1}')
        if currency2 not in VALID_CURRENCIES: errors.append(f'العملة الثانية غير مدعومة: {currency2}')
        if amount1 <= 0:                      errors.append('المبلغ الأول يجب أن يكون أكبر من الصفر')
        if amount2 <= 0:                      errors.append('المبلغ الثاني يجب أن يكون أكبر من الصفر')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        try:
            from datetime import date
            parsed_date = date.fromisoformat(entry_date)
        except Exception:
            parsed_date = timezone.localdate()

        with transaction.atomic():
            record = CurrencyExchange.objects.create(
                center1    = center1,
                currency1  = currency1,
                amount1    = amount1,
                notes      = notes,
                center2    = center2,
                currency2  = currency2,
                amount2    = amount2,
                entry_date = parsed_date,
                created_by = _caller(request),
            )

        return JsonResponse({
            'success': True,
            'message': f'تم إنشاء سند تبديل العملة {record.ref_number}',
            'record':  record.to_dict(),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
def api_am_currency_exchange_detail(request, record_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    try:
        record = CurrencyExchange.objects.get(id=record_id)
    except CurrencyExchange.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'السند غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'record': record.to_dict()})

    if request.method == 'DELETE':
        ref = record.ref_number
        record.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف السند {ref}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
