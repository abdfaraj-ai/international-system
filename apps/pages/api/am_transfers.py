"""
am_transfers.py — API حوالة جديدة (صفحة إدارة الحسابات)
═══════════════════════════════════════════════════════════
GET  /api/am/init/          ← فروع + وكلاء + عملات (لتعبئة القوائم)
POST /api/am/transfers/     ← إنشاء حوالة جديدة
GET  /api/am/transfers/     ← قائمة الحوالات مع فلتر
PATCH /api/am/transfers/<id>/receive/  ← تأكيد استلام حوالة
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db import transaction
from django.utils import timezone
from django.db.models import Q, Sum, Count

from ..models import (
    HawalaTransfer, Branch, ExecutionAgent, SystemUser,
)
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


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/am/init/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_init(request):
    """يُعيد بيانات التهيئة: الفروع + الوكلاء + العملات"""
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'GET فقط'}, status=405)

    branches = list(
        Branch.objects.filter(status='active')
        .values('id', 'name', 'location', 'currency',
                'balance_usd', 'balance_ils', 'balance_jod')
        .order_by('name')
    )

    agents = list(
        ExecutionAgent.objects.filter(status='active')
        .values('id', 'name', 'phone', 'currencies')
        .order_by('name')
    )

    return JsonResponse({
        'success':    True,
        'branches':   branches,
        'agents':     agents,
        'currencies': list(VALID_CURRENCIES),
    })


# ══════════════════════════════════════════════════════════════════════════════
# GET + POST /api/am/transfers/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_transfers(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    # ── GET: قائمة الحوالات ───────────────────────────────────────────────────
    if request.method == 'GET':
        qs = HawalaTransfer.objects.filter(is_deleted=False).select_related('agent')

        status   = request.GET.get('status', '').strip()
        q        = request.GET.get('q', '').strip()
        date_from= request.GET.get('date_from', '').strip()
        date_to  = request.GET.get('date_to', '').strip()
        currency = request.GET.get('currency', '').strip().upper()

        # فلتر الحالة — pending = غير مستلمة، completed = مستلمة
        if status == 'pending':
            qs = qs.filter(status='pending')
        elif status == 'completed':
            qs = qs.filter(status='completed')

        if currency:
            qs = qs.filter(currency=currency)
        if q:
            qs = qs.filter(
                Q(sender_name__icontains=q)   |
                Q(receiver_name__icontains=q) |
                Q(ref_number__icontains=q)    |
                Q(destination__icontains=q)
            )
        if date_from:
            try:
                qs = qs.filter(created_at__date__gte=date_from)
            except Exception:
                pass
        if date_to:
            try:
                qs = qs.filter(created_at__date__lte=date_to)
            except Exception:
                pass

        try:
            page     = max(1, int(request.GET.get('page', 1)))
            per_page = min(100, max(1, int(request.GET.get('per_page', 20))))
        except (ValueError, TypeError):
            page, per_page = 1, 20

        # إحصائيات سريعة
        summary = qs.aggregate(
            total=Count('id'),
            pending_count=Count('id', filter=Q(status='pending')),
            completed_count=Count('id', filter=Q(status='completed')),
            total_amount=Sum('amount'),
            total_commission=Sum('commission'),
        )

        total  = summary['total'] or 0
        offset = (page - 1) * per_page
        items  = list(qs.order_by('-created_at')[offset: offset + per_page])

        return JsonResponse({
            'success':    True,
            'summary':    {
                'total':           total,
                'pendingCount':    summary['pending_count']    or 0,
                'completedCount':  summary['completed_count']  or 0,
                'totalAmount':     float(summary['total_amount']     or 0),
                'totalCommission': float(summary['total_commission'] or 0),
            },
            'page':       page,
            'perPage':    per_page,
            'totalPages': max(1, (total + per_page - 1) // per_page),
            'transfers':  [_transfer_dict(t) for t in items],
        })

    # ── POST: إنشاء حوالة جديدة ──────────────────────────────────────────────
    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        # ── التحقق من الحقول المطلوبة ─────────────────────────────────────────
        sender       = (data.get('senderName')   or '').strip()
        receiver     = (data.get('receiverName') or '').strip()
        recv_phone   = (data.get('receiverPhone')or '').strip()
        send_phone   = (data.get('senderPhone')  or '').strip()
        destination  = (data.get('destination')  or '').strip()
        notes        = (data.get('notes')        or '').strip()
        address      = (data.get('address')      or '').strip()
        currency_send= (data.get('currencySend') or 'USD').upper().strip()
        currency_recv= (data.get('currencyRecv') or 'USD').upper().strip()
        amount_send  = _dec(data.get('amountSend', 0))
        amount_recv  = _dec(data.get('amountRecv', 0))
        fee_export   = _dec(data.get('feeExport', 0))
        fee_delivery = _dec(data.get('feeDelivery', 0))
        rate         = _dec(data.get('rate', 1))
        source_branch= (data.get('sourceBranch') or '').strip()
        dest_branch  = (data.get('destBranch')   or '').strip()

        errors = []
        if not sender:      errors.append('اسم المُرسِل مطلوب')
        if not receiver:    errors.append('اسم المستفيد مطلوب')
        if not destination: errors.append('الوجهة مطلوبة')
        if amount_send <= 0: errors.append('مبلغ الإرسال يجب أن يكون أكبر من الصفر')
        if currency_send not in VALID_CURRENCIES:
            errors.append(f'عملة الإرسال غير مدعومة: {currency_send}')
        if currency_recv not in VALID_CURRENCIES:
            errors.append(f'عملة التسليم غير مدعومة: {currency_recv}')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        # ── إنشاء الحوالة ─────────────────────────────────────────────────────
        commission = fee_export + fee_delivery
        full_notes = (
            f'مصدر: {source_branch} | وجهة: {dest_branch}\n'
            f'عملة إرسال: {currency_send} | سعر: {rate} | عملة تسليم: {currency_recv}\n'
            f'أجور تصدير: {fee_export} | أجور تسليم: {fee_delivery}\n'
            f'عنوان: {address}\n'
            + notes
        ).strip()

        with transaction.atomic():
            transfer = HawalaTransfer.objects.create(
                sender_name    = sender,
                sender_phone   = send_phone,
                receiver_name  = receiver,
                receiver_phone = recv_phone,
                amount         = amount_send,
                currency       = currency_send,
                destination    = destination,
                commission     = commission,
                notes          = full_notes,
                created_by     = _caller(request),
                status         = 'pending',
            )

        return JsonResponse({
            'success':  True,
            'message':  f'تم إنشاء الحوالة {transfer.ref_number}',
            'transfer': _transfer_dict(transfer),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /api/am/transfers/<id>/receive/   ← تأكيد الاستلام
# ══════════════════════════════════════════════════════════════════════════════

def api_am_transfer_receive(request, transfer_id):
    """يُغيِّر حالة الحوالة من pending إلى completed"""
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err
    if request.method != 'PATCH':
        return JsonResponse({'success': False, 'message': 'PATCH فقط'}, status=405)

    try:
        transfer = HawalaTransfer.objects.get(id=transfer_id, is_deleted=False)
    except HawalaTransfer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الحوالة غير موجودة'}, status=404)

    if transfer.status == 'completed':
        return JsonResponse({'success': False, 'message': 'الحوالة مُسلَّمة مسبقاً'}, status=400)

    with transaction.atomic():
        transfer.status       = 'completed'
        transfer.completed_by = _caller(request)
        transfer.completed_at = timezone.now()
        transfer.save(update_fields=['status', 'completed_by', 'completed_at'])

    return JsonResponse({
        'success':  True,
        'message':  'تم تأكيد الاستلام',
        'transfer': _transfer_dict(transfer),
    })


# ══════════════════════════════════════════════════════════════════════════════
# Helper
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# GET /api/delivery-moves/?type=internal|external
# يُعيد الحوالات قيد التسليم (status=pending) مع ملخص الأرصدة بالعملات
# ══════════════════════════════════════════════════════════════════════════════

def api_delivery_moves(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'GET فقط'}, status=405)

    move_type = request.GET.get('type', 'internal').strip()

    qs = HawalaTransfer.objects.filter(is_deleted=False, status='pending')

    # فلتر النوع: internal = لا يوجد وكيل خارجي، external = يوجد وكيل
    if move_type == 'internal':
        qs = qs.filter(agent__isnull=True)
    elif move_type == 'external':
        qs = qs.filter(agent__isnull=False)

    qs = qs.select_related('agent').order_by('-created_at')

    rows = []
    summary = {}
    for t in qs:
        cur = (t.currency or 'USD').lower()
        summary[cur] = summary.get(cur, 0) + float(t.amount)
        rows.append({
            'id':          t.id,
            'transfer_num': t.ref_number,
            'transfer_date': t.created_at.strftime('%Y-%m-%d'),
            'receive_date':  t.completed_at.strftime('%Y-%m-%d') if t.completed_at else None,
            'us':           float(t.amount),
            'them':         float(t.commission),
            'from':         t.sender_name,
            'beneficiary':  t.receiver_name,
            'to':           t.destination,
            'sender':       t.created_by,
            'notes':        t.notes,
            'status':       t.status,
        })

    return JsonResponse({'data': rows, 'summary': summary}, safe=False)


def _transfer_dict(t: HawalaTransfer) -> dict:
    return {
        'id':            t.id,
        'refNumber':     t.ref_number,
        'senderName':    t.sender_name,
        'senderPhone':   t.sender_phone,
        'receiverName':  t.receiver_name,
        'receiverPhone': t.receiver_phone,
        'amount':        float(t.amount),
        'currency':      t.currency,
        'destination':   t.destination,
        'commission':    float(t.commission),
        'status':        t.status,
        'notes':         t.notes,
        'createdBy':     t.created_by,
        'completedBy':   t.completed_by,
        'createdAt':     t.created_at.strftime('%Y-%m-%d %H:%M'),
        'completedAt':   t.completed_at.strftime('%Y-%m-%d %H:%M') if t.completed_at else None,
        'agentName':     t.agent.name if t.agent else None,
    }
