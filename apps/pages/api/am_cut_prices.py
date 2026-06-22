"""
am_cut_prices.py — API أسعار القص
GET    /api/cut-prices/           ← قائمة الأسعار
POST   /api/cut-prices/           ← إضافة سعر جديد
PATCH  /api/cut-prices/<id>/      ← تعديل سعر
DELETE /api/cut-prices/<id>/      ← حذف سعر
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db import transaction
from ..models import CutPrice
from core.permissions import require_roles as _require_roles, caller_name as _caller

VALID_TYPES      = ('screen', 'balance', 'movement')
VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'SYP', 'EGP')
VALID_DIRS       = ('mul', 'div')


def _dec(v):
    try:
        return Decimal(str(v))
    except (InvalidOperation, TypeError):
        return Decimal('1')


def _parse(request):
    try:
        return json.loads(request.body), None
    except Exception:
        return None, JsonResponse({'success': False, 'message': 'JSON غير صالح'}, status=400)


def api_cut_prices(request):
    err = _require_roles(request, 'M01', 'M02', 'M03')
    if err:
        return err

    if request.method == 'GET':
        price_type = request.GET.get('type', '').strip()
        currency   = request.GET.get('currency', '').strip().upper()

        qs = CutPrice.objects.all()
        if price_type in VALID_TYPES:
            qs = qs.filter(price_type=price_type)
        if currency:
            qs = qs.filter(currency=currency)

        # تجميع حسب النوع
        grouped = {'screen': [], 'balance': [], 'movement': []}
        for cp in qs:
            grouped[cp.price_type].append(cp.to_dict())

        return JsonResponse({
            'success': True,
            'prices':  [cp.to_dict() for cp in qs],
            'grouped': grouped,
            'counts': {k: len(v) for k, v in grouped.items()},
        })

    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        price_type = (data.get('priceType') or '').strip()
        currency   = (data.get('currency')   or '').strip().upper()
        direction  = (data.get('direction')  or 'div').strip()
        rate       = _dec(data.get('rate', 1))
        notes      = (data.get('notes') or '').strip()
        is_active  = bool(data.get('isActive', True))

        errors = []
        if price_type not in VALID_TYPES:
            errors.append(f'نوع السعر غير صحيح: {price_type}')
        if currency not in VALID_CURRENCIES:
            errors.append(f'العملة غير مدعومة: {currency}')
        if direction not in VALID_DIRS:
            errors.append('اتجاه السعر غير صحيح')
        if rate <= 0:
            errors.append('السعر يجب أن يكون أكبر من الصفر')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        with transaction.atomic():
            cp = CutPrice.objects.create(
                price_type = price_type,
                currency   = currency,
                rate       = rate,
                direction  = direction,
                notes      = notes,
                is_active  = is_active,
                created_by = _caller(request),
                updated_by = _caller(request),
            )
        return JsonResponse({'success': True, 'message': 'تم إضافة السعر', 'price': cp.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_cut_price_detail(request, price_id):
    err = _require_roles(request, 'M01', 'M02', 'M03')
    if err:
        return err

    try:
        cp = CutPrice.objects.get(id=price_id)
    except CutPrice.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'السعر غير موجود'}, status=404)

    if request.method == 'PATCH':
        data, err = _parse(request)
        if err:
            return err

        if 'priceType' in data:
            pt = (data['priceType'] or '').strip()
            if pt not in VALID_TYPES:
                return JsonResponse({'success': False, 'message': 'نوع السعر غير صحيح'}, status=400)
            cp.price_type = pt

        if 'currency' in data:
            cur = (data['currency'] or '').strip().upper()
            if cur not in VALID_CURRENCIES:
                return JsonResponse({'success': False, 'message': 'العملة غير مدعومة'}, status=400)
            cp.currency = cur

        if 'direction' in data:
            d = (data['direction'] or '').strip()
            if d not in VALID_DIRS:
                return JsonResponse({'success': False, 'message': 'الاتجاه غير صحيح'}, status=400)
            cp.direction = d

        if 'rate' in data:
            r = _dec(data['rate'])
            if r <= 0:
                return JsonResponse({'success': False, 'message': 'السعر يجب أن يكون أكبر من الصفر'}, status=400)
            cp.rate = r

        if 'notes'    in data: cp.notes    = (data['notes'] or '').strip()
        if 'isActive' in data: cp.is_active = bool(data['isActive'])

        cp.updated_by = _caller(request)
        with transaction.atomic():
            cp.save()
        return JsonResponse({'success': True, 'message': 'تم التحديث', 'price': cp.to_dict()})

    if request.method == 'DELETE':
        cp.delete()
        return JsonResponse({'success': True, 'message': 'تم الحذف'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
