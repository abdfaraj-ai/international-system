"""
am_currencies.py — API إدارة العملات
GET    /api/currencies/           ← قائمة العملات
POST   /api/currencies/           ← إضافة عملة جديدة
PATCH  /api/currencies/<id>/      ← تعديل عملة
DELETE /api/currencies/<id>/      ← حذف عملة
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Q
from ..models import ManagedCurrency
from core.permissions import require_roles as _require_roles, caller_name as _caller


def _dec(v, default='1'):
    try:
        return Decimal(str(v))
    except (InvalidOperation, TypeError):
        return Decimal(default)


def _parse(request):
    try:
        return json.loads(request.body), None
    except Exception:
        return None, JsonResponse({'success': False, 'message': 'JSON غير صالح'}, status=400)


def api_currencies(request):
    err = _require_roles(request, 'M01', 'M02', 'M03')
    if err:
        return err

    if request.method == 'GET':
        q      = request.GET.get('q', '').strip()
        active = request.GET.get('active', '').strip()

        qs = ManagedCurrency.objects.all()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(symbol__icontains=q))
        if active == '1':
            qs = qs.filter(is_active=True)
        elif active == '0':
            qs = qs.filter(is_active=False)

        return JsonResponse({
            'success':    True,
            'currencies': [c.to_dict() for c in qs],
            'count':      qs.count(),
        })

    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        name       = (data.get('name')     or '').strip()
        symbol     = (data.get('symbol')   or '').strip().upper()
        multiplier = _dec(data.get('multiplier', 1))
        eval_rate  = _dec(data.get('evalRate',   1))
        is_active  = bool(data.get('isActive', True))
        notes      = (data.get('notes') or '').strip()

        errors = []
        if not name:   errors.append('اسم العملة مطلوب')
        if not symbol: errors.append('رمز العملة مطلوب')
        if multiplier <= 0: errors.append('المعامل يجب أن يكون أكبر من الصفر')
        if eval_rate <= 0:  errors.append('سعر التقييم يجب أن يكون أكبر من الصفر')
        if ManagedCurrency.objects.filter(symbol__iexact=symbol).exists():
            errors.append(f'الرمز {symbol} مستخدم مسبقاً')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        with transaction.atomic():
            c = ManagedCurrency.objects.create(
                name       = name,
                symbol     = symbol,
                multiplier = multiplier,
                eval_rate  = eval_rate,
                is_active  = is_active,
                notes      = notes,
                created_by = _caller(request),
                updated_by = _caller(request),
            )
        return JsonResponse({'success': True, 'message': f'تم إضافة العملة {name}', 'currency': c.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_currency_detail(request, currency_id):
    err = _require_roles(request, 'M01', 'M02', 'M03')
    if err:
        return err

    try:
        c = ManagedCurrency.objects.get(id=currency_id)
    except ManagedCurrency.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'العملة غير موجودة'}, status=404)

    if request.method == 'PATCH':
        data, err = _parse(request)
        if err:
            return err

        if 'name' in data:
            n = (data['name'] or '').strip()
            if not n:
                return JsonResponse({'success': False, 'message': 'اسم العملة مطلوب'}, status=400)
            c.name = n

        if 'symbol' in data:
            s = (data['symbol'] or '').strip().upper()
            if not s:
                return JsonResponse({'success': False, 'message': 'رمز العملة مطلوب'}, status=400)
            if ManagedCurrency.objects.filter(symbol__iexact=s).exclude(id=currency_id).exists():
                return JsonResponse({'success': False, 'message': f'الرمز {s} مستخدم مسبقاً'}, status=400)
            c.symbol = s

        if 'multiplier' in data:
            m = _dec(data['multiplier'])
            if m <= 0:
                return JsonResponse({'success': False, 'message': 'المعامل يجب أن يكون أكبر من الصفر'}, status=400)
            c.multiplier = m

        if 'evalRate' in data:
            r = _dec(data['evalRate'])
            if r <= 0:
                return JsonResponse({'success': False, 'message': 'سعر التقييم يجب أن يكون أكبر من الصفر'}, status=400)
            c.eval_rate = r

        if 'isActive' in data: c.is_active = bool(data['isActive'])
        if 'notes'    in data: c.notes     = (data['notes'] or '').strip()

        c.updated_by = _caller(request)
        with transaction.atomic():
            c.save()
        return JsonResponse({'success': True, 'message': 'تم تحديث العملة', 'currency': c.to_dict()})

    if request.method == 'DELETE':
        name = c.name
        c.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف العملة {name}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
