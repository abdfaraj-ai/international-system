"""
am_outgoing_transfer.py — API حركة صادرة
══════════════════════════════════════════
GET    /api/am/outgoing-transfer/        ← قائمة
POST   /api/am/outgoing-transfer/        ← إنشاء
GET    /api/am/outgoing-transfer/<id>/   ← تفاصيل
DELETE /api/am/outgoing-transfer/<id>/   ← حذف
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from ..models import OutgoingTransfer
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
@csrf_exempt
def api_am_outgoing_transfer(request):
    err = _require_roles(request, 'M01', 'M02', 'M03')
    if err:
        return err

    # ── GET ──────────────────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = OutgoingTransfer.objects.all()

        q         = request.GET.get('q', '').strip()
        date_from = request.GET.get('date_from', '').strip()
        date_to   = request.GET.get('date_to', '').strip()

        if q:
            qs = qs.filter(
                Q(ref_number__icontains=q)        |
                Q(source_center__icontains=q)     |
                Q(beneficiary_name__icontains=q)  |
                Q(beneficiary_phone__icontains=q) |
                Q(destination__icontains=q)       |
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

        source_center     = (data.get('sourceCenter')    or '').strip()
        beneficiary_name  = (data.get('beneficiaryName') or '').strip()
        beneficiary_phone = (data.get('beneficiaryPhone')or '').strip()
        destination       = (data.get('destination')     or '').strip()
        address           = (data.get('address')         or '').strip()
        send_currency     = (data.get('sendCurrency')    or 'USD').upper().strip()
        send_amount       = _dec(data.get('sendAmount', 0))
        receive_currency  = (data.get('receiveCurrency') or 'USD').upper().strip()
        receive_amount    = _dec(data.get('receiveAmount', 0))
        export_fee        = _dec(data.get('exportFee', 0))
        delivery_fee      = _dec(data.get('deliveryFee', 0))
        exchange_rate     = _dec(data.get('exchangeRate', 1))
        notes             = (data.get('notes')           or '').strip()
        entry_date        = (data.get('entryDate')       or _today()).strip()

        # حساب المجموع
        total = send_amount + export_fee + delivery_fee

        errors = []
        if not source_center:                       errors.append('المصدر مطلوب')
        if not beneficiary_name:                    errors.append('اسم المستفيد مطلوب')
        if send_currency not in VALID_CURRENCIES:   errors.append(f'عملة الإرسال غير مدعومة: {send_currency}')
        if receive_currency not in VALID_CURRENCIES: errors.append(f'عملة التسليم غير مدعومة: {receive_currency}')
        if send_amount <= 0:                        errors.append('مبلغ الإرسال يجب أن يكون أكبر من الصفر')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        try:
            from datetime import date
            parsed_date = date.fromisoformat(entry_date)
        except Exception:
            parsed_date = timezone.localdate()

        with transaction.atomic():
            record = OutgoingTransfer.objects.create(
                source_center     = source_center,
                beneficiary_name  = beneficiary_name,
                beneficiary_phone = beneficiary_phone,
                destination       = destination,
                address           = address,
                send_currency     = send_currency,
                send_amount       = send_amount,
                receive_currency  = receive_currency,
                receive_amount    = receive_amount,
                export_fee        = export_fee,
                delivery_fee      = delivery_fee,
                total             = total,
                exchange_rate     = exchange_rate,
                notes             = notes,
                entry_date        = parsed_date,
                created_by        = _caller(request),
            )

        return JsonResponse({
            'success': True,
            'message': f'تم إنشاء الحركة الصادرة {record.ref_number}',
            'record':  record.to_dict(),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
@csrf_exempt
def api_am_outgoing_transfer_detail(request, record_id):
    err = _require_roles(request, 'M01', 'M02', 'M03')
    if err:
        return err

    try:
        record = OutgoingTransfer.objects.get(id=record_id)
    except OutgoingTransfer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الحركة غير موجودة'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'record': record.to_dict()})

    if request.method == 'DELETE':
        ref = record.ref_number
        record.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف الحركة {ref}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
