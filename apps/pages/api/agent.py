"""
Agent API — تكامل مع HawalaNet Pro
═══════════════════════════════════════════════════════
GET  /api/agents/<id>/dashboard     ← لوحة الوكيل (رصيد + إحصائيات)
GET  /api/agents/<id>/transfers     ← الحوالات المعلّقة للوكيل
POST /api/agents/<id>/transfers/<tid>/confirm  ← تأكيد التنفيذ + رفع إيصال
POST /api/agents/<id>/balance/deposit          ← إيداع USDT
POST /api/agents/<id>/balance/deduct           ← خصم USDT (بعد تحقق الإدارة)
GET  /api/agents/<id>/balance/history          ← سجل الرصيد
POST /api/agents/<id>/receipts/<tid>/verify    ← تحقق الإدارة من الإيصال
"""
import json
from decimal import Decimal, InvalidOperation
from django.http        import JsonResponse
from django.utils       import timezone
from django.db          import transaction
from django.db.models   import Sum, F, Q

from ..models import (
    ExecutionAgent, HawalaTransfer, AgentBalance, AgentReceipt, AuditLog,
)
from core.permissions import require_roles as _require_roles, parse_json as _parse_json, caller_name as _caller

_COMMISSION_RATE = 0.025   # 2.5% — يطابق HawalaNet Pro


def _get_agent(agent_id):
    """يرجع الوكيل أو None"""
    try:
        return ExecutionAgent.objects.get(id=agent_id)
    except ExecutionAgent.DoesNotExist:
        return None


def _agent_balance(agent, lock=False):
    """الرصيد الحالي = آخر سجل balance_after.
    lock=True يضيف SELECT FOR UPDATE لمنع race condition داخل atomic block.
    """
    qs = AgentBalance.objects.filter(agent=agent)
    if lock:
        qs = qs.select_for_update()
    last = qs.order_by('-created_at').first()
    return last.balance_after if last else 0


# ═══════════════════════════════════════════════════════════════════════════════
# 1. لوحة الوكيل — GET /api/agents/<id>/dashboard
# ═══════════════════════════════════════════════════════════════════════════════

def api_agent_dashboard(request, agent_id):
    """إحصائيات الوكيل: الرصيد + الحوالات + العمولة"""
    err = _require_roles(request, 'M03', 'M01')
    if err: return err

    agent = _get_agent(agent_id)
    if not agent:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    balance = _agent_balance(agent)

    transfers = HawalaTransfer.objects.filter(agent=agent)
    pending   = transfers.filter(status__in=('pending', 'processing')).count()
    completed = transfers.filter(status='completed').count()
    urgent    = transfers.filter(is_urgent=True, status__in=('pending', 'processing')).count()

    # إجمالي العمولة المحقّقة
    total_commission = (
        AgentBalance.objects
        .filter(agent=agent, txn_type='commission')
        .aggregate(total=Sum('amount_usdt'))['total'] or 0
    )

    # أحدث 5 حوالات
    recent = transfers.order_by('-created_at')[:5]

    return JsonResponse({
        'success': True,
        'agent':   agent.to_dict(),
        'balance': {
            'usdt':            round(balance, 4),
            'frozenUsdt':      round(
                transfers.filter(status='processing')
                .aggregate(s=Sum('frozen_usdt'))['s'] or 0, 4
            ),
            'availableUsdt':   round(
                balance - (
                    transfers.filter(status='processing')
                    .aggregate(s=Sum('frozen_usdt'))['s'] or 0
                ), 4
            ),
        },
        'stats': {
            'pending':         pending,
            'completed':       completed,
            'urgent':          urgent,
            'totalCommission': round(total_commission, 4),
        },
        'recentTransfers': [t.to_dict() for t in recent],
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 2. حوالات الوكيل — GET /api/agents/<id>/transfers
# ═══════════════════════════════════════════════════════════════════════════════

def api_agent_transfers(request, agent_id):
    """قائمة الحوالات المُسنَدة للوكيل مع فلترة"""
    err = _require_roles(request, 'M03', 'M01', 'T03')
    if err: return err

    agent = _get_agent(agent_id)
    if not agent:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    qs = HawalaTransfer.objects.filter(agent=agent)

    status = request.GET.get('status', '')
    if status:
        qs = qs.filter(status=status)

    urgent_only = request.GET.get('urgent') == '1'
    if urgent_only:
        qs = qs.filter(is_urgent=True)

    qs = qs.order_by('-is_urgent', '-created_at')

    try:
        page      = max(1, int(request.GET.get('page', 1)))
        page_size = min(100, max(1, int(request.GET.get('pageSize', 20))))
    except (ValueError, TypeError):
        page, page_size = 1, 20

    total = qs.count()
    items = qs[(page - 1) * page_size: page * page_size]

    return JsonResponse({
        'success':   True,
        'total':     total,
        'page':      page,
        'pageSize':  page_size,
        'transfers': [t.to_dict() for t in items],
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 3. تأكيد التنفيذ + رفع الإيصال — POST /api/agents/<id>/transfers/<tid>/confirm
# ═══════════════════════════════════════════════════════════════════════════════

def api_agent_confirm_transfer(request, agent_id, transfer_id):
    """
    الوكيل ينفّذ الحوالة ويرفع الإيصال.
    يُجمّد المبلغ في رصيده حتى يتحقق المشرف.
    """
    err = _require_roles(request, 'M03', 'M01', 'T03')
    if err: return err

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    agent = _get_agent(agent_id)
    if not agent:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    try:
        transfer = HawalaTransfer.objects.get(id=transfer_id, agent=agent)
    except HawalaTransfer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الحوالة غير موجودة أو لا تخص هذا الوكيل'}, status=404)

    if transfer.status == 'completed':
        return JsonResponse({'success': False, 'message': 'الحوالة منفّذة مسبقاً'}, status=400)
    if transfer.status == 'cancelled':
        return JsonResponse({'success': False, 'message': 'الحوالة ملغاة'}, status=400)

    notes = request.POST.get('notes', '').strip()
    image = request.FILES.get('receipt')

    with transaction.atomic():
        # تحديث حالة الحوالة
        transfer.status             = 'processing'
        transfer.agent_confirmed    = True
        transfer.agent_confirmed_at = timezone.now()
        transfer.save(update_fields=['status', 'agent_confirmed', 'agent_confirmed_at'])

        # حفظ الإيصال
        receipt = AgentReceipt.objects.create(
            agent      = agent,
            transfer   = transfer,
            hawala_ref = transfer.ref_number,
            image      = image,
            notes      = notes,
        )

    AuditLog.log('agent_confirm', request=request, target=transfer.ref_number,
                 detail=f'الوكيل {agent.name} أكّد تنفيذ الحوالة {transfer.ref_number}')

    # إشعار فوري لمشرفي الحوالات عبر WebSocket
    try:
        from ..ws_utils import _send
        _send('intl_transactions', {
            'type':        'agent.confirmed',
            'ref':         transfer.ref_number,
            'agentName':   agent.name,
            'transfer':    transfer.to_dict(),
            'receiptId':   receipt.id,
        })
    except Exception:
        pass

    return JsonResponse({
        'success':    True,
        'message':    'تم تسجيل التنفيذ بانتظار التحقق من المشرف',
        'transfer':   transfer.to_dict(),
        'receiptId':  receipt.id,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 4. إيداع USDT للوكيل — POST /api/agents/<id>/balance/deposit
# ═══════════════════════════════════════════════════════════════════════════════

def api_agent_deposit(request, agent_id):
    """M03 / M01 يودع USDT في رصيد الوكيل"""
    err = _require_roles(request, 'M03', 'M01')
    if err: return err

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    agent = _get_agent(agent_id)
    if not agent:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    data, err = _parse_json(request)
    if err: return err

    try:
        amount = Decimal(str(data.get('amount', 0)))
    except (InvalidOperation, ValueError, TypeError):
        return JsonResponse({'success': False, 'message': 'المبلغ غير صالح'}, status=400)

    if amount <= 0 or amount > Decimal('1000000'):
        return JsonResponse({'success': False, 'message': 'المبلغ خارج النطاق المسموح'}, status=400)

    notes = (data.get('notes') or '').strip()

    with transaction.atomic():
        current = _agent_balance(agent, lock=True)
        new_balance = round(current + amount, 4)

        log = AgentBalance.objects.create(
            agent        = agent,
            txn_type     = 'deposit',
            amount_usdt  = amount,
            balance_after= new_balance,
            notes        = notes,
            created_by   = _caller(request),
        )

    AuditLog.log('agent_deposit', request=request, target=agent.name,
                 amount=amount, currency='USDT',
                 detail=f'إيداع {amount} USDT للوكيل {agent.name} — الرصيد: {new_balance}')

    return JsonResponse({
        'success':    True,
        'balanceLog': log.to_dict(),
        'newBalance': new_balance,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 5. التحقق من الإيصال وخصم الرصيد — POST /api/agents/<id>/receipts/<rid>/verify
# ═══════════════════════════════════════════════════════════════════════════════

def api_agent_verify_receipt(request, agent_id, receipt_id):
    """
    M03 / M01 يتحقق من إيصال التنفيذ ويخصم من رصيد الوكيل:
    المبلغ المخصوم = مبلغ الحوالة بالUSDT + عمولة الوكيل
    """
    err = _require_roles(request, 'M03', 'M01')
    if err: return err

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    agent = _get_agent(agent_id)
    if not agent:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    try:
        receipt = AgentReceipt.objects.get(id=receipt_id, agent=agent)
    except AgentReceipt.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الإيصال غير موجود'}, status=404)

    if receipt.is_verified:
        return JsonResponse({'success': False, 'message': 'الإيصال مُتحقَّق منه مسبقاً'}, status=400)

    transfer = receipt.transfer
    if not transfer:
        return JsonResponse({'success': False, 'message': 'لا توجد حوالة مرتبطة بهذا الإيصال'}, status=400)

    # حساب مبلغ الخصم بـ USDT
    # بافتراض المبلغ بالدولار = USDT مباشرة (أو يمكن ربطه بسعر الصرف)
    commission_pct = agent.commission if agent.commission and agent.commission > 0 else _COMMISSION_RATE
    if commission_pct < 0 or commission_pct > 1:
        return JsonResponse({'success': False, 'message': f'نسبة العمولة غير صالحة: {commission_pct}'}, status=400)
    deduct_amount  = round(transfer.amount * (1 + commission_pct), 4)
    commission_amt = round(transfer.amount * commission_pct, 4)

    with transaction.atomic():
        current     = _agent_balance(agent, lock=True)
        if current < deduct_amount:
            return JsonResponse({
                'success': False,
                'message': f'رصيد الوكيل غير كافٍ — المتاح: {current:.4f} USDT، المطلوب: {deduct_amount:.4f} USDT'
            }, status=400)

        new_balance = round(current - deduct_amount, 4)

        # سجل الخصم
        AgentBalance.objects.create(
            agent        = agent,
            txn_type     = 'deduct',
            amount_usdt  = -deduct_amount,
            balance_after= new_balance,
            hawala_ref   = transfer.ref_number,
            notes        = f'تنفيذ حوالة {transfer.ref_number}',
            created_by   = _caller(request),
        )

        # سجل العمولة
        AgentBalance.objects.create(
            agent        = agent,
            txn_type     = 'commission',
            amount_usdt  = commission_amt,
            balance_after= new_balance,
            hawala_ref   = transfer.ref_number,
            notes        = f'عمولة {commission_pct*100:.1f}% على حوالة {transfer.ref_number}',
            created_by   = _caller(request),
        )

        # تحديث الإيصال
        receipt.is_verified = True
        receipt.verified_by = _caller(request)
        receipt.verified_at = timezone.now()
        receipt.save(update_fields=['is_verified', 'verified_by', 'verified_at'])

        # إغلاق الحوالة
        transfer.status       = 'completed'
        transfer.completed_by = _caller(request)
        transfer.completed_at = timezone.now()
        transfer.frozen_usdt  = 0
        transfer.save(update_fields=['status', 'completed_by', 'completed_at', 'frozen_usdt'])

    AuditLog.log('agent_receipt_verified', request=request, target=transfer.ref_number,
                 amount=deduct_amount, currency='USDT',
                 detail=f'تحقق من إيصال الوكيل {agent.name} — خُصم {deduct_amount} USDT — عمولة {commission_amt} USDT')

    # إشعار فوري للمشرفين والموظفين بإتمام الحوالة
    try:
        from ..ws_utils import _send
        _send('intl_transactions', {
            'type':      'transfer.completed',
            'ref':       transfer.ref_number,
            'agentName': agent.name,
            'deducted':  str(deduct_amount),
            'transfer':  transfer.to_dict(),
        })
    except Exception:
        pass

    return JsonResponse({
        'success':      True,
        'message':      'تم التحقق وخصم الرصيد بنجاح',
        'deducted':     deduct_amount,
        'commission':   commission_amt,
        'newBalance':   new_balance,
        'transfer':     transfer.to_dict(),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 6. سجل رصيد الوكيل — GET /api/agents/<id>/balance/history
# ═══════════════════════════════════════════════════════════════════════════════

def api_agent_balance_history(request, agent_id):
    """سجل كل عمليات الإيداع والخصم للوكيل"""
    err = _require_roles(request, 'M03', 'M01')
    if err: return err

    agent = _get_agent(agent_id)
    if not agent:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    qs = AgentBalance.objects.filter(agent=agent).order_by('-created_at')

    try:
        page      = max(1, int(request.GET.get('page', 1)))
        page_size = min(100, max(1, int(request.GET.get('pageSize', 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    total = qs.count()
    items = qs[(page - 1) * page_size: page * page_size]

    current_balance = _agent_balance(agent)

    return JsonResponse({
        'success':        True,
        'currentBalance': round(current_balance, 4),
        'total':          total,
        'page':           page,
        'pageSize':       page_size,
        'logs':           [log.to_dict() for log in items],
    })
