"""
am_new_credit.py — API اعتماد جديد
═════════════════════════════════════
GET    /api/am/new-credit/        ← قائمة
POST   /api/am/new-credit/        ← إنشاء
DELETE /api/am/new-credit/<id>/   ← حذف
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db import transaction
from django.utils import timezone

from ..models import NewCredit
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


def api_am_new_credit(request):
    err = _require_roles(request, 'M01', 'M02', 'M03')
    if err:
        return err

    if request.method == 'GET':
        qs = NewCredit.objects.all()
        try:
            page     = max(1, int(request.GET.get('page', 1)))
            per_page = min(200, max(1, int(request.GET.get('per_page', 50))))
        except (ValueError, TypeError):
            page, per_page = 1, 50
        total  = qs.count()
        offset = (page - 1) * per_page
        items  = list(qs[offset: offset + per_page])
        return JsonResponse({
            'success': True,
            'total':   total,
            'records': [r.to_dict() for r in items],
        })

    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        company    = (data.get('company')    or '').strip()
        source     = (data.get('source')     or '').strip()
        currency   = (data.get('currency')   or 'USD').upper().strip()
        amount     = _dec(data.get('amount', 0))
        safe       = (data.get('safe')       or '').strip()
        notes      = (data.get('notes')      or '').strip()
        fees       = _dec(data.get('fees', 0))
        entry_date = (data.get('entryDate')  or _today()).strip()

        errors = []
        if not company:                        errors.append('الشركة مطلوبة')
        if not source:                         errors.append('المصدر مطلوب')
        if not safe:                           errors.append('الصندوق مطلوب')
        if currency not in VALID_CURRENCIES:   errors.append(f'العملة غير مدعومة: {currency}')
        if amount <= 0:                        errors.append('المبلغ يجب أن يكون أكبر من الصفر')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        try:
            from datetime import date
            parsed_date = date.fromisoformat(entry_date)
        except Exception:
            parsed_date = timezone.localdate()

        with transaction.atomic():
            record = NewCredit.objects.create(
                company    = company,
                source     = source,
                currency   = currency,
                amount     = amount,
                safe       = safe,
                notes      = notes,
                fees       = fees,
                entry_date = parsed_date,
                created_by = _caller(request),
            )
        return JsonResponse({
            'success': True,
            'message': f'تم إنشاء الاعتماد {record.ref_number}',
            'record':  record.to_dict(),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_am_new_credit_detail(request, record_id):
    err = _require_roles(request, 'M01', 'M02', 'M03')
    if err:
        return err

    try:
        record = NewCredit.objects.get(id=record_id)
    except NewCredit.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الاعتماد غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'record': record.to_dict()})

    if request.method == 'DELETE':
        ref = record.ref_number
        record.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف الاعتماد {ref}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
