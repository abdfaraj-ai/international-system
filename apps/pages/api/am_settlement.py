"""
am_settlement.py — API قيد التسوية
════════════════════════════════════
GET  /api/am/settlement/        ← قائمة سندات التسوية
POST /api/am/settlement/        ← إنشاء سند تسوية جديد
GET  /api/am/settlement/<id>/   ← تفاصيل سند واحد
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import Q

from ..models import SettlementVoucher, SettlementRow
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


def _row_dict(r):
    return {
        'id':          r.id,
        'currency':    r.currency,
        'amount':      float(r.amount),
        'feeUs':       float(r.fee_us),
        'beneficiary': r.beneficiary,
        'notes':       r.notes,
        'destination': r.destination,
        'feeThem':     float(r.fee_them),
    }


def _voucher_dict(v, include_rows=True):
    d = {
        'id':          v.id,
        'refNumber':   v.ref_number,
        'centerName':  v.center_name,
        'totalUs':     float(v.total_us),
        'totalThem':   float(v.total_them),
        'netProfit':   float(v.net_profit),
        'notes':       v.notes,
        'createdBy':   v.created_by,
        'createdAt':   v.created_at.strftime('%Y-%m-%d %H:%M'),
    }
    if include_rows:
        d['rows'] = [_row_dict(r) for r in v.rows.all()]
    return d


# ══════════════════════════════════════════════════════════════════════════════
# GET + POST  /api/am/settlement/
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_am_settlement(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    if request.method == 'GET':
        qs = SettlementVoucher.objects.all()

        q         = request.GET.get('q', '').strip()
        date_from = request.GET.get('date_from', '').strip()
        date_to   = request.GET.get('date_to', '').strip()

        if q:
            qs = qs.filter(
                Q(ref_number__icontains=q) |
                Q(center_name__icontains=q)
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
        items  = list(qs.order_by('-created_at')[offset: offset + per_page])

        from django.db.models import Sum
        profit_sum = qs.aggregate(t=Sum('net_profit'))['t'] or 0

        return JsonResponse({
            'success':     True,
            'total':       total,
            'totalProfit': float(profit_sum),
            'page':        page,
            'totalPages':  max(1, (total + per_page - 1) // per_page),
            'records':     [_voucher_dict(v, include_rows=False) for v in items],
        })

    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        center_name = (data.get('centerName') or '').strip()
        notes       = (data.get('notes')      or '').strip()
        rows_data   = data.get('rows', [])

        errors = []
        if not center_name:
            errors.append('اسم المركز مطلوب')
        if not isinstance(rows_data, list) or len(rows_data) == 0:
            errors.append('يجب إضافة صف واحد على الأقل')

        # تحقق من الصفوف
        validated_rows = []
        for i, row in enumerate(rows_data):
            currency    = (row.get('currency') or '').upper().strip()
            amount      = _dec(row.get('amount', 0))
            fee_us      = _dec(row.get('feeUs', 0))
            beneficiary = (row.get('beneficiary') or '').strip()
            row_notes   = (row.get('notes') or '').strip()
            destination = (row.get('destination') or '').strip()
            fee_them    = _dec(row.get('feeThem', 0))

            if currency not in VALID_CURRENCIES:
                errors.append(f'صف {i+1}: عملة غير مدعومة ({currency})')
            if amount <= 0:
                errors.append(f'صف {i+1}: المبلغ يجب أن يكون أكبر من الصفر')

            validated_rows.append({
                'currency':    currency,
                'amount':      amount,
                'fee_us':      fee_us,
                'beneficiary': beneficiary,
                'notes':       row_notes,
                'destination': destination,
                'fee_them':    fee_them,
            })

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        # احسب الإجماليات — كلا الأجرَين يُفترض أنهما بنفس العملة (USD افتراضياً)
        # إذا اختُلطت العملات فالمسؤولية على المستخدم (يُعرَض تحذير في الواجهة)
        total_us   = sum(r['fee_us']   for r in validated_rows)
        total_them = sum(r['fee_them'] for r in validated_rows)
        net_profit = total_us - total_them

        # تحذير إذا تعددت العملات في الصفوف
        unique_currencies = set(r['currency'] for r in validated_rows)
        mixed_warning = len(unique_currencies) > 1

        with transaction.atomic():
            voucher = SettlementVoucher.objects.create(
                center_name = center_name,
                total_us    = total_us,
                total_them  = total_them,
                net_profit  = net_profit,
                notes       = notes,
                created_by  = _caller(request),
            )
            SettlementRow.objects.bulk_create([
                SettlementRow(
                    voucher     = voucher,
                    currency    = r['currency'],
                    amount      = r['amount'],
                    fee_us      = r['fee_us'],
                    beneficiary = r['beneficiary'],
                    notes       = r['notes'],
                    destination = r['destination'],
                    fee_them    = r['fee_them'],
                )
                for r in validated_rows
            ])

        resp = {
            'success': True,
            'message': f'تم حفظ سند التسوية {voucher.ref_number}',
            'record':  _voucher_dict(voucher),
        }
        if mixed_warning:
            resp['warning'] = 'تحذير: الصفوف تحتوي على عملات مختلطة — تحقق من صحة الأرباح'
        return JsonResponse(resp, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# GET  /api/am/settlement/<id>/
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_am_settlement_detail(request, voucher_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err
    try:
        voucher = SettlementVoucher.objects.prefetch_related('rows').get(id=voucher_id)
    except SettlementVoucher.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'السند غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'record': _voucher_dict(voucher)})

    if request.method == 'DELETE':
        ref = voucher.ref_number
        voucher.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف السند {ref}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
