"""
agent_portal.py — بوابة الوكيل الخارجي
تسجيل الدخول بـ PIN + لوحة الحوالات + رفع الإيصالات
"""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone

from ..models import ExecutionAgent, HawalaTransfer, AgentReceipt, AgentBalance


# ── helpers ───────────────────────────────────────────────────────────────────

def _agent_session(request):
    """يُعيد الوكيل المسجّل دخوله أو None."""
    agent_id = request.session.get('agent_portal_id')
    if not agent_id:
        return None
    try:
        return ExecutionAgent.objects.get(id=agent_id, portal_active=True)
    except ExecutionAgent.DoesNotExist:
        return None


def _agent_balance(agent):
    last = agent.balance_logs.order_by('-created_at').first()
    return float(last.balance_after) if last else 0.0


def _require_agent(func):
    def wrapper(request, *args, **kwargs):
        agent = _agent_session(request)
        if not agent:
            return JsonResponse({'error': 'غير مصادق', 'redirect': '/agent/login/'}, status=401)
        return func(request, agent, *args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper


# ── تسجيل الدخول ─────────────────────────────────────────────────────────────

@csrf_exempt
def api_agent_portal_login(request):
    """POST /api/agent/login/ — دخول الوكيل بـ PIN"""
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'بيانات غير صالحة'}, status=400)

    identifier = data.get('identifier', '').strip()  # اسم أو إيميل أو هاتف
    raw_pin    = data.get('pin', '').strip()

    if not identifier or not raw_pin:
        return JsonResponse({'error': 'يرجى إدخال المعرّف ورمز PIN'}, status=400)

    if len(raw_pin) < 4:
        return JsonResponse({'error': 'رمز PIN يجب أن يكون 4 أرقام على الأقل'}, status=400)

    # ابحث عن الوكيل بالاسم أو الإيميل أو الهاتف
    agent = (
        ExecutionAgent.objects
        .filter(portal_active=True)
        .filter(
            models_q(name__iexact=identifier) |
            models_q(email__iexact=identifier) |
            models_q(phone=identifier)
        )
        .first()
    )

    if not agent or not agent.pin_hash or not agent.check_pin(raw_pin):
        return JsonResponse({'error': 'المعرّف أو رمز PIN غير صحيح'}, status=401)

    # حفظ الجلسة
    request.session['agent_portal_id']   = agent.id
    request.session['agent_portal_name'] = agent.name
    request.session.set_expiry(28800)  # 8 ساعات

    # تحديث آخر ظهور
    agent.last_seen = timezone.now()
    agent.save(update_fields=['last_seen'])

    return JsonResponse({
        'success': True,
        'agent': {
            'id':      agent.id,
            'name':    agent.name,
            'country': agent.country,
            'icon':    agent.icon,
            'color':   agent.color,
        }
    })


@csrf_exempt
def api_agent_portal_logout(request):
    """POST /api/agent/logout/"""
    request.session.flush()
    return JsonResponse({'success': True})


def api_agent_portal_session(request):
    """GET /api/agent/session/ — فحص الجلسة"""
    agent = _agent_session(request)
    if not agent:
        return JsonResponse({'authenticated': False}, status=401)

    agent.last_seen = timezone.now()
    agent.save(update_fields=['last_seen'])

    return JsonResponse({
        'authenticated': True,
        'agent': {
            'id':      agent.id,
            'name':    agent.name,
            'country': agent.country,
            'icon':    agent.icon,
            'color':   agent.color,
            'status':  agent.status,
            'balance': _agent_balance(agent),
        }
    })


# ── لوحة البيانات ─────────────────────────────────────────────────────────────

@_require_agent
def api_agent_portal_dashboard(request, agent):
    """GET /api/agent/dashboard/"""
    balance = _agent_balance(agent)

    transfers = HawalaTransfer.objects.filter(
        agent=agent, is_deleted=False
    )
    pending    = transfers.filter(status='pending').count()
    processing = transfers.filter(status='processing').count()
    completed  = transfers.filter(status='completed').count()
    total      = transfers.count()

    # آخر 5 حوالات
    recent = transfers.order_by('-created_at')[:5]
    recent_list = []
    for t in recent:
        recent_list.append({
            'id':           t.id,
            'ref':          t.ref_number,
            'sender':       t.sender_name,
            'receiver':     t.receiver_name,
            'amount':       float(t.amount),
            'currency':     t.currency,
            'destination':  t.destination,
            'status':       t.status,
            'isUrgent':     t.is_urgent,
            'createdAt':    t.created_at.strftime('%Y-%m-%d %H:%M'),
        })

    return JsonResponse({
        'agent': {
            'id':          agent.id,
            'name':        agent.name,
            'country':     agent.country,
            'status':      agent.status,
            'icon':        agent.icon,
            'color':       agent.color,
            'commission':  float(agent.commission),
            'currencies':  agent.currencies.split(',') if agent.currencies else [],
        },
        'balance':    balance,
        'stats': {
            'total':      total,
            'pending':    pending,
            'processing': processing,
            'completed':  completed,
        },
        'recentTransfers': recent_list,
    })


# ── الحوالات ──────────────────────────────────────────────────────────────────

@_require_agent
def api_agent_portal_transfers(request, agent):
    """GET /api/agent/transfers/?status=pending"""
    status   = request.GET.get('status', '')
    page     = max(1, int(request.GET.get('page', 1)))
    per_page = 20

    qs = HawalaTransfer.objects.filter(agent=agent, is_deleted=False).order_by('-created_at')

    if status in ('pending', 'processing', 'completed', 'cancelled'):
        qs = qs.filter(status=status)

    total = qs.count()
    start = (page - 1) * per_page
    items = qs[start:start + per_page]

    transfers = []
    for t in items:
        has_receipt = hasattr(t, 'receipt') and t.receipt is not None
        transfers.append({
            'id':          t.id,
            'ref':         t.ref_number,
            'sender':      t.sender_name,
            'senderPhone': t.sender_phone,
            'receiver':    t.receiver_name,
            'receiverPhone': t.receiver_phone,
            'amount':      float(t.amount),
            'currency':    t.currency,
            'destination': t.destination,
            'status':      t.status,
            'isUrgent':    t.is_urgent,
            'hasReceipt':  has_receipt,
            'receiptVerified': t.receipt.is_verified if has_receipt else False,
            'notes':       t.notes,
            'createdAt':   t.created_at.strftime('%Y-%m-%d %H:%M'),
        })

    return JsonResponse({
        'transfers': transfers,
        'total':     total,
        'page':      page,
        'pages':     (total + per_page - 1) // per_page,
    })


# ── قبول / رفض الحوالة ───────────────────────────────────────────────────────

@csrf_exempt
@_require_agent
def api_agent_portal_accept(request, agent, transfer_id):
    """POST /api/agent/transfers/<id>/accept/ — الوكيل يقبل الحوالة"""
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    try:
        t = HawalaTransfer.objects.get(id=transfer_id, agent=agent, is_deleted=False)
    except HawalaTransfer.DoesNotExist:
        return JsonResponse({'error': 'الحوالة غير موجودة'}, status=404)

    if t.status != 'pending':
        return JsonResponse({'error': 'لا يمكن قبول هذه الحوالة — حالتها الحالية: ' + t.get_status_display()}, status=400)

    t.status = 'processing'
    t.save(update_fields=['status'])

    return JsonResponse({'success': True, 'status': 'processing'})


@csrf_exempt
@_require_agent
def api_agent_portal_reject(request, agent, transfer_id):
    """POST /api/agent/transfers/<id>/reject/ — الوكيل يرفض الحوالة"""
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    try:
        t = HawalaTransfer.objects.get(id=transfer_id, agent=agent, is_deleted=False)
    except HawalaTransfer.DoesNotExist:
        return JsonResponse({'error': 'الحوالة غير موجودة'}, status=404)

    if t.status != 'pending':
        return JsonResponse({'error': 'لا يمكن رفض هذه الحوالة'}, status=400)

    try:
        body = json.loads(request.body)
        reason = body.get('reason', '').strip()
    except Exception:
        reason = ''

    t.status = 'pending'
    t.agent  = None
    if reason:
        t.notes = (t.notes + f'\nرفض الوكيل: {reason}').strip()
    t.save(update_fields=['status', 'agent', 'notes'])

    return JsonResponse({'success': True})


# ── رفع الإيصال ──────────────────────────────────────────────────────────────

@csrf_exempt
@_require_agent
def api_agent_portal_upload_receipt(request, agent, transfer_id):
    """POST /api/agent/transfers/<id>/receipt/ — الوكيل يرفع إيصال التنفيذ"""
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    try:
        t = HawalaTransfer.objects.get(id=transfer_id, agent=agent, is_deleted=False)
    except HawalaTransfer.DoesNotExist:
        return JsonResponse({'error': 'الحوالة غير موجودة'}, status=404)

    if t.status not in ('pending', 'processing'):
        return JsonResponse({'error': 'لا يمكن رفع إيصال لهذه الحوالة'}, status=400)

    image = request.FILES.get('image')
    notes = request.POST.get('notes', '').strip()

    if not image:
        return JsonResponse({'error': 'يرجى رفع صورة الإيصال'}, status=400)

    # حذف الإيصال القديم إن وجد
    AgentReceipt.objects.filter(transfer=t).delete()

    receipt = AgentReceipt.objects.create(
        agent      = agent,
        transfer   = t,
        hawala_ref = t.ref_number,
        image      = image,
        notes      = notes,
    )

    # تغيير حالة الحوالة لـ "بانتظار التحقق"
    t.status             = 'processing'
    t.agent_confirmed    = True
    t.agent_confirmed_at = timezone.now()
    t.save(update_fields=['status', 'agent_confirmed', 'agent_confirmed_at'])

    return JsonResponse({
        'success':   True,
        'receiptId': receipt.id,
        'message':   'تم رفع الإيصال بنجاح — بانتظار مراجعة المشرف',
    })


# ── سجل الرصيد ───────────────────────────────────────────────────────────────

@_require_agent
def api_agent_portal_balance(request, agent):
    """GET /api/agent/balance/"""
    page     = max(1, int(request.GET.get('page', 1)))
    per_page = 20

    qs    = agent.balance_logs.order_by('-created_at')
    total = qs.count()
    start = (page - 1) * per_page
    items = qs[start:start + per_page]

    logs = []
    for b in items:
        logs.append({
            'id':          b.id,
            'type':        b.txn_type,
            'typeLabel':   b.get_txn_type_display(),
            'amount':      float(b.amount_usdt),
            'balanceAfter': float(b.balance_after),
            'hawalaRef':   b.hawala_ref,
            'notes':       b.notes,
            'createdAt':   b.created_at.strftime('%Y-%m-%d %H:%M'),
        })

    return JsonResponse({
        'balance': _agent_balance(agent),
        'logs':    logs,
        'total':   total,
        'page':    page,
        'pages':   (total + per_page - 1) // per_page,
    })


# ── تغيير PIN ────────────────────────────────────────────────────────────────

@csrf_exempt
@_require_agent
def api_agent_portal_change_pin(request, agent):
    """POST /api/agent/change-pin/"""
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'بيانات غير صالحة'}, status=400)

    old_pin = data.get('oldPin', '').strip()
    new_pin = data.get('newPin', '').strip()

    if not old_pin or not new_pin:
        return JsonResponse({'error': 'يرجى إدخال الرمز القديم والجديد'}, status=400)

    if not agent.check_pin(old_pin):
        return JsonResponse({'error': 'رمز PIN القديم غير صحيح'}, status=401)

    if len(new_pin) < 4:
        return JsonResponse({'error': 'رمز PIN يجب أن يكون 4 أرقام على الأقل'}, status=400)

    agent.set_pin(new_pin)
    agent.save(update_fields=['pin_hash'])

    return JsonResponse({'success': True, 'message': 'تم تغيير رمز PIN بنجاح'})


# ── import داخلي ─────────────────────────────────────────────────────────────
from django.db.models import Q as models_q
