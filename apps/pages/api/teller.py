"""
Teller API — صفحة أقسام التلر (T01)
══════════════════════════════════════════════════════════════════
# عمليات الصرافة
GET/POST        /api/tl/exchange             ← عمليات الصرافة
GET             /api/tl/exchange/<id>        ← تفاصيل عملية

# الحوالات الدولية
GET/POST        /api/tl/hawala              ← حوالات التلر الدولية
GET/PATCH       /api/tl/hawala/<id>

# السحب والإيداع
GET/POST        /api/tl/cash               ← معاملات نقدية

# صندوق التلر
GET             /api/tl/balance            ← رصيد الصندوق الحالي + الافتتاحي
GET             /api/tl/stats              ← إحصائيات التلر لليوم

# تقارير التلر
GET/POST        /api/tl/reports
"""
import json
import datetime
from decimal import Decimal, InvalidOperation
from django.http        import JsonResponse
from django.utils       import timezone
from django.db.models   import Q, Sum

from ..models import (
    SystemUser, TellerProfile, TellerBalance, TellerPermission,
    TellerRequest, ExchangeRate, ExchangeOperation, HawalaOperation,
    CashTransaction, SupervisorReport, AuditLog, TellerSession,
)
from core.permissions import require_roles as _require_roles, parse_json as _parse_raw, caller_name as _caller


# ─── local alias ──────────────────────────────────────────────────────────────

def _parse(request):
    data, _ = _parse_raw(request)
    return data or {}


def _to_decimal(value, field=''):
    """تحويل آمن لـ Decimal — يمنع فقدان الدقة من float."""
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f'قيمة غير صالحة في حقل {field}: {value}')


def _teller_profile(username):
    """إرجاع TellerProfile للتلر أو None"""
    try:
        return TellerProfile.objects.get(username=username)
    except TellerProfile.DoesNotExist:
        return None


def _teller_permissions(username):
    """إرجاع TellerPermission للتلر أو None"""
    try:
        return TellerPermission.objects.get(teller_username=username)
    except TellerPermission.DoesNotExist:
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# 1. إحصائيات التلر — GET /api/tl/stats
# ═══════════════════════════════════════════════════════════════════════════════

def api_tl_stats(request):
    """إحصائيات التلر الحالي لليوم"""
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    caller     = _caller(request)
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # عمليات الصرافة
    exchange_qs = ExchangeOperation.objects.filter(
        operator=caller, created_at__gte=today_start
    )
    # حوالات دولية
    hawala_qs = HawalaOperation.objects.filter(
        operator=caller, created_at__gte=today_start
    )
    # سحب وإيداع
    cash_qs = CashTransaction.objects.filter(
        operator=caller, created_at__gte=today_start
    )

    total_ops = exchange_qs.count() + hawala_qs.count() + cash_qs.count()

    # إجمالي الصرافة بالعملات
    exchange_totals = {}
    for currency in ['USD', 'ILS', 'JOD', 'EUR', 'GBP']:
        bought = exchange_qs.filter(to_currency=currency).aggregate(s=Sum('result'))['s'] or 0
        sold   = exchange_qs.filter(from_currency=currency).aggregate(s=Sum('amount'))['s'] or 0
        exchange_totals[currency] = {'bought': bought, 'sold': sold}

    # رصيد الصندوق الافتتاحي — يحسب set + add بعده
    last_set = TellerBalance.objects.filter(
        teller_username=caller, action='set'
    ).order_by('-created_at').first()

    opening = {'usd': 0, 'ils': 0, 'jod': 0}
    if last_set:
        usd = last_set.usd
        ils = last_set.ils
        jod = last_set.jod
        adds = TellerBalance.objects.filter(
            teller_username=caller,
            action='add',
            created_at__gt=last_set.created_at,
        )
        for entry in adds:
            usd += entry.usd
            ils += entry.ils
            jod += entry.jod
        opening = {'usd': usd, 'ils': ils, 'jod': jod}

    return JsonResponse({
        'success':       True,
        'totalOps':      total_ops,
        'exchangeOps':   exchange_qs.count(),
        'hawalaOps':     hawala_qs.count(),
        'cashOps':       cash_qs.count(),
        'exchangeTotals': exchange_totals,
        'openingBalance': opening,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 2. رصيد الصندوق — GET /api/tl/balance
# ═══════════════════════════════════════════════════════════════════════════════

def api_tl_balance(request):
    """رصيد الصندوق الافتتاحي للتلر + الصلاحيات + أسعار الصرف"""
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    caller      = _caller(request)           # الاسم الكامل — للعرض والسجلات
    caller_uname = request.user.username      # username الفعلي — للبحث عن الصلاحيات

    # حساب الرصيد الحقيقي:
    # 1. ابحث عن آخر سجل action='set' (نقطة الانطلاق)
    # 2. اجمع كل سجلات action='add' التي جاءت بعده
    all_balances = TellerBalance.objects.filter(
        teller_username=caller
    ).order_by('-created_at')

    last_set = all_balances.filter(action='set').first()

    balance = {'usd': 0, 'ils': 0, 'jod': 0, 'setBy': '', 'sessionId': '', 'setAt': None}
    if last_set:
        usd = last_set.usd
        ils = last_set.ils
        jod = last_set.jod
        # أضف كل سجلات 'add' التي جاءت بعد آخر 'set'
        adds = TellerBalance.objects.filter(
            teller_username=caller,
            action='add',
            created_at__gt=last_set.created_at,
        )
        for entry in adds:
            usd += entry.usd
            ils += entry.ils
            jod += entry.jod
        balance = {
            'usd':       usd,
            'ils':       ils,
            'jod':       jod,
            'setBy':     last_set.set_by,
            'sessionId': last_set.session_id,
            'setAt':     last_set.created_at.isoformat(),
        }

    # الصلاحيات — البحث بـ username أولاً ثم بالاسم الكامل
    perm = _teller_permissions(caller_uname) or _teller_permissions(caller)
    permissions = {
        'exchange':      True,
        'international': True,
        'electronic':    True,
        'accounts':      True,
        'specialPrice':  False,
        'doubleDelivery': False,
    }
    if perm:
        permissions = perm.to_dict()

    # أسعار الصرف (آخر سعر منشور)
    rate_record = ExchangeRate.objects.order_by('-created_at').first()
    rates = rate_record.rates_json if rate_record else {}

    return JsonResponse({
        'success':     True,
        'teller':      caller,
        'balance':     balance,
        'permissions': permissions,
        'rates':       rates,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 3. عمليات الصرافة — GET/POST /api/tl/exchange
# ═══════════════════════════════════════════════════════════════════════════════

def api_tl_exchange(request):
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err

    caller = _caller(request)

    if request.method == 'GET':
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        qs = ExchangeOperation.objects.filter(operator=caller, created_at__gte=today_start)

        # فلتر اختياري بالتاريخ
        date = request.GET.get('date')
        if date:
            try:
                d = datetime.date.fromisoformat(date)
                qs = ExchangeOperation.objects.filter(operator=caller, created_at__date=d)
            except ValueError:
                pass

        ops = [
            {
                'id':           op.id,
                'fromCurrency': op.from_currency,
                'toCurrency':   op.to_currency,
                'amount':       op.amount,
                'result':       op.result,
                'rate':         op.rate,
                'method':       op.method,
                'operator':     op.operator,
                'createdAt':    op.created_at.isoformat(),
            }
            for op in qs
        ]
        return JsonResponse({'success': True, 'operations': ops, 'total': len(ops)})

    if request.method == 'POST':
        # فحص صلاحية قسم الصرافة
        perm = _teller_permissions(request.user.username) or _teller_permissions(caller)
        if perm and not perm.exchange:
            return JsonResponse({'success': False, 'message': 'غير مصرّح: ليس لديك صلاحية قسم الصرافة'}, status=403)

        data = _parse(request)
        required = ['fromCurrency', 'toCurrency', 'amount', 'result', 'rate']
        for f in required:
            if data.get(f) is None:
                return JsonResponse({'success': False, 'message': f'الحقل مطلوب: {f}'}, status=400)

        try:
            amount = _to_decimal(data['amount'], 'amount')
            result = _to_decimal(data['result'], 'result')
            rate   = _to_decimal(data['rate'],   'rate')
        except ValueError as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=400)

        if amount <= 0 or result <= 0 or rate <= 0:
            return JsonResponse({'success': False, 'message': 'القيم يجب أن تكون أكبر من صفر'}, status=400)

        op = ExchangeOperation.objects.create(
            from_currency = data['fromCurrency'],
            to_currency   = data['toCurrency'],
            amount        = amount,
            result        = result,
            rate          = rate,
            method        = data.get('method', 'web'),
            operator      = caller,
            web_applied   = True,
        )
        AuditLog.log('tl_exchange', request=request,
                     target=f'{data["fromCurrency"]}→{data["toCurrency"]}',
                     amount=amount, currency=data['fromCurrency'],
                     detail=f'ناتج: {result} — سعر: {rate}')

        # تحديث عدد العمليات في ملف التلر
        profile = _teller_profile(caller)
        if profile:
            profile.ops += 1
            profile.last_op = timezone.now().strftime('%H:%M')
            profile.save()

        return JsonResponse({
            'success': True,
            'operation': {
                'id':           op.id,
                'fromCurrency': op.from_currency,
                'toCurrency':   op.to_currency,
                'amount':       op.amount,
                'result':       op.result,
                'rate':         op.rate,
                'createdAt':    op.created_at.isoformat(),
            },
        }, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. حوالات دولية (التلر) — GET/POST /api/tl/hawala
# ═══════════════════════════════════════════════════════════════════════════════

def api_tl_hawala(request):
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err

    caller = _caller(request)

    if request.method == 'GET':
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        qs = HawalaOperation.objects.filter(operator=caller, created_at__gte=today_start)

        date = request.GET.get('date')
        if date:
            try:
                d = datetime.date.fromisoformat(date)
                qs = HawalaOperation.objects.filter(operator=caller, created_at__date=d)
            except ValueError:
                pass

        ops = [
            {
                'id':           op.id,
                'senderName':   op.sender_name,
                'receiverName': op.receiver_name,
                'amount':       op.amount,
                'fee':          op.fee,
                'currency':     op.currency,
                'country':      op.destination,
                'direction':    op.direction,
                'recvMethod':   op.recv_method,
                'operator':     op.operator,
                'method':       op.method,
                'notes':        op.notes,
                'status':       op.status,
                'createdAt':    op.created_at.isoformat(),
            }
            for op in qs
        ]
        return JsonResponse({'success': True, 'operations': ops, 'total': len(ops)})

    if request.method == 'POST':
        # فحص صلاحية الحوالات الدولية
        perm = _teller_permissions(request.user.username) or _teller_permissions(caller)
        if perm and not perm.international:
            return JsonResponse({'success': False, 'message': 'غير مصرّح: ليس لديك صلاحية الحوالات الدولية'}, status=403)

        data = _parse(request)
        required = ['senderName', 'receiverName', 'amount', 'currency']
        for f in required:
            if not data.get(f):
                return JsonResponse({'success': False, 'message': f'الحقل مطلوب: {f}'}, status=400)

        try:
            amount = _to_decimal(data['amount'], 'amount')
            fee    = _to_decimal(data.get('fee') or 0, 'fee')
        except ValueError as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=400)

        if amount <= 0:
            return JsonResponse({'success': False, 'message': 'المبلغ يجب أن يكون أكبر من صفر'}, status=400)
        if fee < 0:
            return JsonResponse({'success': False, 'message': 'العمولة لا يمكن أن تكون سالبة'}, status=400)

        country = data.get('country') or data.get('destination', '')
        op = HawalaOperation.objects.create(
            sender_name   = data['senderName'],
            receiver_name = data['receiverName'],
            amount        = amount,
            fee           = fee,
            currency      = data.get('currency', 'USD'),
            destination   = country,
            direction     = data.get('direction', 'out'),
            recv_method   = data.get('recvMethod', ''),
            operator      = caller,
            method        = data.get('method', 'web'),
            notes         = data.get('notes', ''),
            status        = 'pending',
            web_applied   = True,
        )
        AuditLog.log('tl_hawala', request=request,
                     target=f'{data["senderName"]} → {data["receiverName"]}',
                     amount=amount, currency=data.get('currency', 'USD'),
                     detail=f'وجهة: {country} — عمولة: {fee}')

        profile = _teller_profile(caller)
        if profile:
            profile.ops += 1
            profile.last_op = timezone.now().strftime('%H:%M')
            profile.save()

        return JsonResponse({
            'success': True,
            'operation': {
                'id':           op.id,
                'senderName':   op.sender_name,
                'receiverName': op.receiver_name,
                'amount':       op.amount,
                'fee':          op.fee,
                'currency':     op.currency,
                'country':      op.destination,
                'direction':    op.direction,
                'createdAt':    op.created_at.isoformat(),
            },
        }, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


def api_tl_hawala_detail(request, op_id):
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err

    try:
        op = HawalaOperation.objects.get(pk=op_id)
    except HawalaOperation.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الحوالة غير موجودة'}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            'success': True,
            'operation': {
                'id':           op.id,
                'senderName':   op.sender_name,
                'receiverName': op.receiver_name,
                'amount':       op.amount,
                'currency':     op.currency,
                'destination':  op.destination,
                'operator':     op.operator,
                'method':       op.method,
                'notes':        op.notes,
                'status':       op.status,
                'createdAt':    op.created_at.isoformat(),
            },
        })

    if request.method == 'PATCH':
        data = _parse(request)
        if 'status' in data and data['status'] in ('pending', 'completed', 'cancelled'):
            op.status = data['status']
        if 'notes' in data:
            op.notes = data['notes']
        op.save()
        return JsonResponse({'success': True})

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. معاملات نقدية — GET/POST /api/tl/cash
# ═══════════════════════════════════════════════════════════════════════════════

def api_tl_cash(request):
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err

    caller = _caller(request)

    if request.method == 'GET':
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        qs = CashTransaction.objects.filter(operator=caller, created_at__gte=today_start)

        date = request.GET.get('date')
        if date:
            try:
                d = datetime.date.fromisoformat(date)
                qs = CashTransaction.objects.filter(operator=caller, created_at__date=d)
            except ValueError:
                pass

        txns = [
            {
                'id':          t.id,
                'type':        t.transaction_type,
                'client':      t.client_name,
                'account':     t.account,
                'amount':      t.amount,
                'fee':         t.fee,
                'currency':    t.currency,
                'payType':     t.pay_type,
                'rate':        t.exchange_rate,
                'ref':         t.ref_number,
                'platform':    t.platform,
                'operator':    t.operator,
                'notes':       t.notes,
                'createdAt':   t.created_at.isoformat(),
            }
            for t in qs
        ]
        return JsonResponse({'success': True, 'transactions': txns, 'total': len(txns)})

    if request.method == 'POST':
        data = _parse(request)
        ttype = (data.get('type') or data.get('transactionType') or '').strip()
        # قبول 'withdraw' كاسم مستعار لـ 'withdrawal'
        if ttype == 'withdraw':
            ttype = 'withdrawal'
        client = (data.get('client') or data.get('clientName') or '').strip()
        if not ttype or not client or not data.get('amount') or not data.get('currency'):
            return JsonResponse({'success': False, 'message': 'type/client/amount/currency مطلوبة'}, status=400)
        if ttype not in ('withdrawal', 'deposit', 'electronic'):
            return JsonResponse({'success': False, 'message': 'نوع المعاملة غير صالح'}, status=400)

        # فحص صلاحية المعاملات الإلكترونية
        if ttype == 'electronic':
            perm = _teller_permissions(request.user.username) or _teller_permissions(caller)
            if perm and not perm.electronic:
                return JsonResponse({'success': False, 'message': 'غير مصرّح: ليس لديك صلاحية المعاملات الإلكترونية'}, status=403)

        try:
            amount = _to_decimal(data['amount'], 'amount')
            fee    = _to_decimal(data.get('fee') or 0, 'fee')
            rate   = _to_decimal(data.get('rate') or 0, 'rate')
        except ValueError as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=400)

        if amount <= 0:
            return JsonResponse({'success': False, 'message': 'المبلغ يجب أن يكون أكبر من صفر'}, status=400)
        if fee < 0:
            return JsonResponse({'success': False, 'message': 'العمولة لا يمكن أن تكون سالبة'}, status=400)

        t = CashTransaction.objects.create(
            transaction_type = ttype,
            client_name      = client,
            account          = data.get('account', ''),
            amount           = amount,
            fee              = fee,
            currency         = data.get('currency', 'USD'),
            pay_type         = data.get('payType', 'cash'),
            exchange_rate    = rate,
            ref_number       = data.get('ref', ''),
            platform         = data.get('platform', ''),
            operator         = caller,
            method           = data.get('method', 'web'),
            notes            = data.get('notes', ''),
            web_applied      = True,
        )
        labels = {'withdrawal': 'سحب', 'deposit': 'إيداع', 'electronic': 'إلكترونية'}
        AuditLog.log('tl_cash', request=request,
                     target=client,
                     amount=amount, currency=data.get('currency', 'USD'),
                     detail=f'نوع: {labels.get(ttype, ttype)}')

        profile = _teller_profile(caller)
        if profile:
            profile.ops += 1
            profile.last_op = timezone.now().strftime('%H:%M')
            profile.save()

        return JsonResponse({
            'success': True,
            'transaction': {
                'id':       t.id,
                'type':     t.transaction_type,
                'client':   t.client_name,
                'amount':   t.amount,
                'currency': t.currency,
                'createdAt': t.created_at.isoformat(),
            },
        }, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 6. تقارير التلر — GET/POST /api/tl/reports
# ═══════════════════════════════════════════════════════════════════════════════

def api_tl_reports(request):
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err

    caller = _caller(request)

    if request.method == 'GET':
        role = request.user.role
        if role == 'M01':
            qs = SupervisorReport.objects.filter(page='tellerDept')
        else:
            qs = SupervisorReport.objects.filter(page='tellerDept', submitted_by=caller)

        return JsonResponse({
            'success': True,
            'reports': [
                {
                    'id':          r.id,
                    'title':       r.title,
                    'body':        r.body,
                    'branch':      r.branch,
                    'submittedBy': r.submitted_by,
                    'isRead':      r.is_read,
                    'createdAt':   r.created_at.isoformat(),
                }
                for r in qs
            ],
        })

    if request.method == 'POST':
        data = _parse(request)
        title = data.get('title', '').strip()
        body  = data.get('body', '').strip()
        if not title or not body:
            return JsonResponse({'success': False, 'message': 'العنوان والمحتوى مطلوبان'}, status=400)

        r = SupervisorReport.objects.create(
            page         = 'tellerDept',
            title        = title,
            body         = body,
            branch       = data.get('branch', ''),
            submitted_by = caller,
        )
        return JsonResponse({
            'success': True,
            'report': {
                'id':          r.id,
                'title':       r.title,
                'body':        r.body,
                'submittedBy': r.submitted_by,
                'createdAt':   r.created_at.isoformat(),
            },
        }, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 7. طلبات التلر للمشرف — GET/POST /api/tl/requests
# ═══════════════════════════════════════════════════════════════════════════════

def api_tl_requests(request):
    """إرسال طلب للمشرف (رصيد / سعر مميز / عام) وعرض الطلبات القديمة"""
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err

    caller = _caller(request)

    if request.method == 'GET':
        qs = TellerRequest.objects.filter(teller_name=caller).order_by('-created_at')[:50]
        return JsonResponse({
            'success':  True,
            'requests': [r.to_dict() for r in qs],
        })

    if request.method == 'POST':
        data = _parse(request)
        text  = data.get('text', '').strip()
        rtype = data.get('type', 'general')

        if not text:
            return JsonResponse({'success': False, 'message': 'نص الطلب مطلوب'}, status=400)

        if rtype not in ('special_price', 'urgent', 'general', 'balance', 'reconcile'):
            rtype = 'general'

        import random
        prefix_map = {'special_price':'SP','urgent':'UR','reconcile':'RC','balance':'BL'}
        prefix = prefix_map.get(rtype, 'GR')
        req_id = f'{prefix}-{timezone.now().strftime("%y%m%d%H%M%S")}-{random.randint(100,999)}'

        req = TellerRequest.objects.create(
            request_id     = req_id,
            request_type   = rtype,
            teller_name    = caller,
            text           = text,
            requested_rate = data.get('requestedRate', ''),
            status         = 'pending',
        )

        # ── WebSocket: أبلغ مشرف التلر فورًا ──────────────────────────────
        from ..ws_utils import broadcast_teller_request
        broadcast_teller_request(req.to_dict())

        return JsonResponse({'success': True, 'request': req.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 8. أسعار الصرف — GET /api/tl/rates
# ═══════════════════════════════════════════════════════════════════════════════

def api_tl_rates(request):
    """أسعار الصرف الحالية المنشورة من المشرف"""
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    rate_record = ExchangeRate.objects.order_by('-created_at').first()
    if not rate_record:
        return JsonResponse({'success': True, 'rates': {}, 'setBy': '', 'setAt': None})

    return JsonResponse({
        'success': True,
        'rates':   rate_record.rates_json,
        'setBy':   rate_record.set_by,
        'setAt':   rate_record.created_at.isoformat(),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# جلسات الصندوق
# ═══════════════════════════════════════════════════════════════════════════════

def api_tl_session(request):
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err
    caller = _caller(request)
    session = TellerSession.objects.filter(
        teller_username=caller, status__in=['pending', 'open']
    ).order_by('-opened_at').first()
    latest_balance = TellerBalance.objects.filter(
        teller_username=caller
    ).order_by('-created_at').first()
    # أرسل notify فقط عندما توجد جلسة pending (رصيد عُيِّن لكن التلر لم يؤكد بعد)
    notify = None
    if latest_balance and session and session.status == 'pending':
        notify = {
            'hasNew':      True,
            'amountUSD':   float(latest_balance.usd),
            'amountILS':   float(latest_balance.ils),
            'amountJOD':   float(latest_balance.jod),
            'setBy':       latest_balance.set_by,
            'supervisorName': latest_balance.set_by,
            'timestamp':   latest_balance.created_at.isoformat(),
        }
    return JsonResponse({
        'success': True,
        'session': session.to_dict() if session else None,
        'notify':  notify,
    })


def api_tl_session_open(request):
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'POST only'}, status=405)
    caller = _caller(request)
    existing = TellerSession.objects.filter(teller_username=caller, status='open').first()
    if existing:
        return JsonResponse({'success': True, 'session': existing.to_dict(), 'alreadyOpen': True})
    session = TellerSession.objects.filter(teller_username=caller, status='pending').first()
    if not session:
        bal = TellerBalance.objects.filter(teller_username=caller).first()
        if not bal:
            return JsonResponse({'success': False, 'message': 'لم يتم تعيين رصيد بعد'}, status=400)
        profile = TellerProfile.objects.filter(username=caller).first()
        import secrets as _sec
        while True:
            sid = f'SES-{timezone.now().strftime("%y%m%d")}-{_sec.randbelow(9000)+1000}'
            if not TellerSession.objects.filter(session_id=sid).exists():
                break
        session = TellerSession.objects.create(
            session_id=sid,
            teller_username=caller,
            teller_name=profile.name if profile else caller,
            opened_by=caller,
            status='pending',
            opening_usd=bal.usd,
            opening_ils=bal.ils,
            opening_jod=bal.jod,
        )
    session.status = 'open'
    session.confirmed_at = timezone.now()
    session.save()
    return JsonResponse({'success': True, 'session': session.to_dict()})


def api_tl_session_close(request):
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'POST only'}, status=405)
    caller = _caller(request)
    data = _parse(request)
    session = TellerSession.objects.filter(teller_username=caller, status='open').first()
    if not session:
        return JsonResponse({'success': False, 'message': 'لا توجد جلسة مفتوحة'}, status=404)
    def _d(v):
        try: return Decimal(str(v))
        except: return Decimal('0')
    session.closing_usd = _d(data.get('USD', 0))
    session.closing_ils = _d(data.get('ILS', 0))
    session.closing_jod = _d(data.get('JOD', 0))
    session.closing_note = data.get('note', '')
    session.status = 'closed'
    session.closed_at = timezone.now()
    session.save()
    return JsonResponse({'success': True, 'session': session.to_dict()})


def api_tl_notify(request):
    err = _require_roles(request, 'T01', 'M01', 'M02')
    if err:
        return err
    caller = _caller(request)
    last_session = TellerSession.objects.filter(teller_username=caller).first()
    latest_bal = TellerBalance.objects.filter(teller_username=caller).first()
    if not latest_bal:
        return JsonResponse({'success': True, 'hasNotify': False})
    has_notify = (
        last_session is None or
        last_session.status == 'pending' or
        (last_session.status == 'closed' and latest_bal.created_at > last_session.closed_at)
    )
    return JsonResponse({
        'success':       True,
        'hasNotify':     has_notify,
        'supervisorName': latest_bal.set_by,
        'amountUSD':     float(latest_bal.usd),
        'amountILS':     float(latest_bal.ils),
        'amountJOD':     float(latest_bal.jod),
        'timestamp':     latest_bal.created_at.isoformat(),
    })
