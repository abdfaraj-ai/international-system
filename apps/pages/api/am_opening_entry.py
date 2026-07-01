"""
am_opening_entry.py — API قيد افتتاحي
═══════════════════════════════════════
GET    /api/am/opening-entry/        ← قائمة القيود
POST   /api/am/opening-entry/        ← إنشاء قيد جديد
GET    /api/am/opening-entry/<id>/   ← تفاصيل قيد
PUT    /api/am/opening-entry/<id>/   ← تعديل قيد
DELETE /api/am/opening-entry/<id>/   ← حذف قيد
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from ..models import OpeningEntry
from core.permissions import require_roles as _require_roles, caller_name as _caller

VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'SYP', 'EGP')
VALID_TYPES      = ('us', 'them')


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
# GET + POST  /api/am/opening-entry/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_opening_entry(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    # ── GET ───────────────────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = OpeningEntry.objects.all()

        q          = request.GET.get('q', '').strip()
        date_from  = request.GET.get('date_from', '').strip()
        date_to    = request.GET.get('date_to', '').strip()
        entry_type = request.GET.get('type', '').strip()
        currency   = request.GET.get('currency', '').strip().upper()

        if q:
            qs = qs.filter(
                Q(ref_number__icontains=q)  |
                Q(center_name__icontains=q) |
                Q(notes__icontains=q)
            )
        if date_from:
            try: qs = qs.filter(entry_date__gte=date_from)
            except Exception: pass
        if date_to:
            try: qs = qs.filter(entry_date__lte=date_to)
            except Exception: pass
        if entry_type in VALID_TYPES:
            qs = qs.filter(entry_type=entry_type)
        if currency in VALID_CURRENCIES:
            qs = qs.filter(currency=currency)

        try:
            page     = max(1, int(request.GET.get('page', 1)))
            per_page = min(200, max(1, int(request.GET.get('per_page', 20))))
        except (ValueError, TypeError):
            page, per_page = 1, 20

        total      = qs.count()
        offset     = (page - 1) * per_page
        items      = list(qs[offset: offset + per_page])

        # مجاميع لنا وعلينا
        agg_us   = qs.filter(entry_type='us').aggregate(t=Sum('amount'))['t']   or 0
        agg_them = qs.filter(entry_type='them').aggregate(t=Sum('amount'))['t'] or 0

        return JsonResponse({
            'success':    True,
            'total':      total,
            'totalUs':    float(agg_us),
            'totalThem':  float(agg_them),
            'balance':    float(agg_us) - float(agg_them),
            'page':       page,
            'totalPages': max(1, (total + per_page - 1) // per_page),
            'records':    [r.to_dict() for r in items],
        })

    # ── POST ──────────────────────────────────────────────────────────────────
    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        center_name = (data.get('centerName') or '').strip()
        currency    = (data.get('currency')   or 'USD').upper().strip()
        amount      = _dec(data.get('amount', 0))
        entry_type  = (data.get('entryType')  or 'us').strip()
        notes       = (data.get('notes')      or '').strip()
        entry_date  = (data.get('entryDate')  or _today()).strip()

        errors = []
        if not center_name:                    errors.append('اسم المركز/العميل مطلوب')
        if currency not in VALID_CURRENCIES:   errors.append(f'العملة غير مدعومة: {currency}')
        if amount <= 0:                        errors.append('المبلغ يجب أن يكون أكبر من الصفر')
        if entry_type not in VALID_TYPES:      errors.append('النوع غير صالح — لنا أو علينا فقط')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        try:
            from datetime import date
            parsed_date = date.fromisoformat(entry_date)
        except Exception:
            parsed_date = timezone.localdate()

        with transaction.atomic():
            record = OpeningEntry.objects.create(
                center_name = center_name,
                currency    = currency,
                amount      = amount,
                entry_type  = entry_type,
                notes       = notes,
                entry_date  = parsed_date,
                created_by  = _caller(request),
            )

        return JsonResponse({
            'success': True,
            'message': f'تم إنشاء القيد الافتتاحي {record.ref_number}',
            'record':  record.to_dict(),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# GET + PUT + DELETE  /api/am/opening-entry/<id>/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_opening_entry_detail(request, entry_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    try:
        record = OpeningEntry.objects.get(id=entry_id)
    except OpeningEntry.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'القيد غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'record': record.to_dict()})

    if request.method == 'PUT':
        data, err = _parse(request)
        if err:
            return err

        if 'centerName' in data:
            record.center_name = (data['centerName'] or '').strip()
        if 'currency' in data:
            cur = (data['currency'] or '').upper().strip()
            if cur in VALID_CURRENCIES:
                record.currency = cur
        if 'amount' in data:
            amt = _dec(data['amount'])
            if amt > 0:
                record.amount = amt
        if 'entryType' in data:
            t = (data['entryType'] or '').strip()
            if t in VALID_TYPES:
                record.entry_type = t
        if 'notes' in data:
            record.notes = (data['notes'] or '').strip()
        if 'entryDate' in data:
            try:
                from datetime import date
                record.entry_date = date.fromisoformat(data['entryDate'])
            except Exception:
                pass

        if not record.center_name:
            return JsonResponse({'success': False, 'message': 'اسم المركز مطلوب'}, status=400)

        with transaction.atomic():
            record.save()
        return JsonResponse({'success': True, 'message': 'تم التحديث', 'record': record.to_dict()})

    if request.method == 'DELETE':
        ref = record.ref_number
        record.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف القيد {ref}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
