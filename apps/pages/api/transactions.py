"""
Transactions API — صفحتا مشرف الحوالات (M03) والحوالات (T03)
═══════════════════════════════════════════════════════════════
# مشرف الحوالات (M03)
GET/POST        /api/ts/transfers               ← الحوالات
PATCH/DELETE    /api/ts/transfers/<id>           ← تعديل/حذف حوالة
GET/POST        /api/ts/employees               ← الموظفون
PATCH/DELETE    /api/ts/employees/<username>     ← تعديل/حذف موظف
POST            /api/ts/employees/<username>/password
GET/POST        /api/ts/agents                  ← وكلاء التنفيذ
PATCH/DELETE    /api/ts/agents/<id>              ← تعديل/حذف وكيل
GET/POST        /api/ts/client-groups           ← مجموعات العملاء
PATCH/DELETE    /api/ts/client-groups/<id>
GET             /api/ts/stats                   ← إحصائيات مشرف الحوالات

# مشترك (T03 + M03)
GET/POST        /api/ts/my-transfers            ← حوالات موظف بعينه
GET             /api/ts/my-stats                ← إحصائيات الموظف

# التقارير والتعليمات
GET/POST        /api/reports                    ← تقارير المشرفين
GET/POST        /api/instructions               ← تعليمات الإدارة
PATCH           /api/instructions/<id>/read     ← تعليمة مقروءة
"""
import json
import datetime
from decimal import Decimal, InvalidOperation
from django.http        import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from django.utils       import timezone
from django.db.models   import Q, Count, Sum, F

from ..models import (
    SystemUser, HawalaTransfer, ExecutionAgent, ClientGroup,
    AdminInstruction, SupervisorReport, ROLE_CHOICES, PortalCountry,
    AgentLocation, AgentTransferRate, AuditLog,
)
from core.permissions import require_roles as _require_roles, parse_json as _parse_json, caller_name as _caller


# ─── local aliases for backward-compat within this file ───────────────────────

def _parse(request):
    data, err = _parse_json(request)
    return data, err


def _dec(value, default='0') -> Decimal:
    """تحويل آمن إلى Decimal — يرجع Decimal('0') عند الفشل."""
    try:
        return Decimal(str(value if value is not None else default))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(default)


# ══════════════════════════════════════════════════════════════════════════════
# الحوالات — HawalaTransfer
# ══════════════════════════════════════════════════════════════════════════════

def api_ts_transfers(request):
    """
    GET  /api/ts/transfers               ← كل الحوالات (M03)
    POST /api/ts/transfers               ← إنشاء حوالة جديدة (T03 | M03)

    Query params للـ GET:
        status, currency, agent_id, client_group_id,
        q (بحث), date_from, date_to, page, per_page
    """
    if request.method == 'GET':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        qs = HawalaTransfer.objects.select_related('agent', 'client_group').filter(is_deleted=False)

        status   = request.GET.get('status', '').strip()
        currency = request.GET.get('currency', '').strip().upper()
        agent_id = request.GET.get('agent_id', '').strip()
        cg_id    = request.GET.get('client_group_id', '').strip()
        q        = request.GET.get('q', '').strip()
        date_from= request.GET.get('date_from', '').strip()
        date_to  = request.GET.get('date_to',   '').strip()

        VALID_STATUSES = ('pending', 'processing', 'completed', 'cancelled')
        if status:
            if status not in VALID_STATUSES:
                return JsonResponse({'success': False, 'message': 'حالة غير صالحة'}, status=400)
            qs = qs.filter(status=status)
        if currency: qs = qs.filter(currency=currency)
        if agent_id: qs = qs.filter(agent_id=agent_id)
        if cg_id:    qs = qs.filter(client_group_id=cg_id)
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
            per_page = min(200, max(1, int(request.GET.get('per_page', 50))))
        except (ValueError, TypeError):
            page, per_page = 1, 50

        # aggregate واحد يعطي العدد الإجمالي + تفصيل الحالات دفعة واحدة
        summary = qs.aggregate(
            total=Count('id'),
            pending=Count('id', filter=Q(status='pending')),
            processing=Count('id', filter=Q(status='processing')),
            completed=Count('id', filter=Q(status='completed')),
            cancelled=Count('id', filter=Q(status='cancelled')),
        )
        total = summary['total']
        qs = qs[(page-1)*per_page : page*per_page]

        return JsonResponse({
            'success':    True,
            'summary':    summary,
            'total':      total,
            'page':       page,
            'perPage':    per_page,
            'totalPages': (total + per_page - 1) // per_page if per_page else 1,
            'transfers':  [t.to_dict() for t in qs],
        })

    if request.method == 'POST':
        err = _require_roles(request, 'M03', 'T03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        sender   = (data.get('senderName') or '').strip()
        receiver = (data.get('receiverName') or '').strip()
        amount   = _dec(data.get('amount', 0))
        currency = (data.get('currency') or 'USD').upper().strip()

        if not sender or not receiver:
            return JsonResponse({'success': False,
                                 'message': 'senderName و receiverName مطلوبان'}, status=400)
        MAX_AMOUNT = Decimal('10000000')
        if amount <= 0:
            return JsonResponse({'success': False,
                                 'message': 'المبلغ يجب أن يكون أكبر من الصفر'}, status=400)
        if amount > MAX_AMOUNT:
            return JsonResponse({'success': False,
                                 'message': 'المبلغ يتجاوز الحد الأقصى (10,000,000)'}, status=400)

        VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'EGP')
        currency = currency.upper()
        if currency not in VALID_CURRENCIES:
            return JsonResponse({'success': False, 'message': 'عملة غير مدعومة'}, status=400)

        agent = None
        if data.get('agentId'):
            try:
                agent = ExecutionAgent.objects.get(id=data['agentId'])
            except ExecutionAgent.DoesNotExist:
                pass

        client_group = None
        if data.get('clientGroupId'):
            try:
                client_group = ClientGroup.objects.get(id=data['clientGroupId'])
            except ClientGroup.DoesNotExist:
                pass

        transfer = HawalaTransfer.objects.create(
            sender_name   = sender,
            sender_phone  = (data.get('senderPhone') or '').strip(),
            receiver_name = receiver,
            receiver_phone= (data.get('receiverPhone') or '').strip(),
            amount        = amount,
            currency      = currency,
            destination   = (data.get('destination') or '').strip(),
            agent         = agent,
            client_group  = client_group,
            commission    = _dec(data.get('commission', 0)),
            notes         = (data.get('notes') or '').strip(),
            created_by    = _caller(request),
            status        = data.get('status', 'pending'),
        )

        # تحديث عداد تحميل الوكيل — F() يمنع race condition
        if agent:
            ExecutionAgent.objects.filter(id=agent.id).update(
                current_load=F('current_load') + 1
            )

        return JsonResponse({'success': True, 'transfer': transfer.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_ts_transfer_detail(request, transfer_id):
    """
    PATCH  /api/ts/transfers/<id>  ← تعديل حوالة (تغيير الحالة، الوكيل، الملاحظات)
    DELETE /api/ts/transfers/<id>  ← حذف حوالة
    """
    try:
        transfer = HawalaTransfer.objects.get(id=transfer_id)
    except HawalaTransfer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الحوالة غير موجودة'}, status=404)

    if request.method == 'PATCH':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        changed = []
        old_agent_id = transfer.agent_id

        if 'status' in data:
            new_status = data['status']
            valid = {'pending', 'processing', 'completed', 'cancelled', 'rejected'}
            if new_status not in valid:
                return JsonResponse({'success': False,
                                     'message': f'الحالة يجب أن تكون: {", ".join(valid)}'}, status=400)
            transfer.status = new_status
            changed.append('status')
            # تعيين وقت الإنجاز
            if new_status == 'completed' and not transfer.completed_at:
                transfer.completed_at  = timezone.now()
                transfer.completed_by  = _caller(request)
                changed += ['completed_at', 'completed_by']
                # تقليل عداد تحميل الوكيل — F() يمنع race condition
                if transfer.agent_id:
                    ExecutionAgent.objects.filter(
                        id=transfer.agent_id, current_load__gt=0
                    ).update(current_load=F('current_load') - 1)

        for field, model_field in [
            ('senderName',   'sender_name'),
            ('senderPhone',  'sender_phone'),
            ('receiverName', 'receiver_name'),
            ('receiverPhone','receiver_phone'),
            ('destination',  'destination'),
            ('notes',        'notes'),
            ('currency',     'currency'),
        ]:
            if field in data:
                setattr(transfer, model_field, (data[field] or '').strip())
                changed.append(model_field)

        if 'amount' in data:
            transfer.amount = _dec(data['amount'])
            changed.append('amount')

        if 'agentId' in data:
            new_aid = data['agentId']
            if new_aid:
                try:
                    transfer.agent = ExecutionAgent.objects.get(id=new_aid)
                except ExecutionAgent.DoesNotExist:
                    return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)
            else:
                transfer.agent = None
            changed.append('agent')

        if 'clientGroupId' in data:
            cg_id = data['clientGroupId']
            if cg_id:
                try:
                    transfer.client_group = ClientGroup.objects.get(id=cg_id)
                except ClientGroup.DoesNotExist:
                    return JsonResponse({'success': False, 'message': 'المجموعة غير موجودة'}, status=404)
            else:
                transfer.client_group = None
            changed.append('client_group')

        if changed:
            transfer.save(update_fields=changed)

        return JsonResponse({'success': True, 'transfer': transfer.to_dict()})

    if request.method == 'DELETE':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err
        if transfer.status == 'completed':
            return JsonResponse({'success': False, 'message': 'لا يمكن حذف حوالة مكتملة'}, status=400)
        # Soft delete — لا نحذف السجل المالي نهائياً
        transfer.is_deleted = True
        transfer.deleted_at = timezone.now()
        transfer.deleted_by = _caller(request)
        transfer.status     = 'cancelled'
        transfer.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by', 'status'])
        AuditLog.log('ts_transfer_delete', request=request, target=transfer.ref_number,
                     detail=f'حذف ناعم للحوالة {transfer.ref_number}')
        return JsonResponse({'success': True, 'message': f'تم حذف الحوالة {transfer.ref_number}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# الحوالات — واجهة الموظف (T03)
# ══════════════════════════════════════════════════════════════════════════════

def api_ts_my_transfers(request):
    """
    GET  /api/ts/my-transfers  ← حوالات الموظف المسجَّل دخوله
    POST /api/ts/my-transfers  ← موظف ينشئ حوالة جديدة
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)

    if request.method == 'GET':
        base_qs = HawalaTransfer.objects.filter(created_by=request.user.username)
        qs = base_qs.select_related('agent', 'client_group').order_by('-created_at')[:100]

        today = timezone.now().date()
        stats = {
            'total':     base_qs.count(),
            'today':     HawalaTransfer.objects.filter(
                             created_by=request.user.username,
                             created_at__date=today
                         ).count(),
            'completed': HawalaTransfer.objects.filter(
                             created_by=request.user.username,
                             status='completed'
                         ).count(),
            'pending':   HawalaTransfer.objects.filter(
                             created_by=request.user.username,
                             status='pending'
                         ).count(),
        }

        return JsonResponse({
            'success':   True,
            'stats':     stats,
            'transfers': [t.to_dict() for t in qs],
        })

    if request.method == 'POST':
        err = _require_roles(request, 'T03', 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        sender   = (data.get('senderName') or '').strip()
        receiver = (data.get('receiverName') or '').strip()
        amount   = _dec(data.get('amount', 0))

        if not sender or not receiver or amount <= 0:
            return JsonResponse({'success': False,
                                 'message': 'senderName و receiverName والمبلغ مطلوبة'}, status=400)

        transfer = HawalaTransfer.objects.create(
            sender_name   = sender,
            sender_phone  = (data.get('senderPhone') or '').strip(),
            receiver_name = receiver,
            receiver_phone= (data.get('receiverPhone') or '').strip(),
            amount        = amount,
            currency      = (data.get('currency') or 'USD').upper(),
            destination   = (data.get('destination') or '').strip(),
            notes         = (data.get('notes') or '').strip(),
            commission    = _dec(data.get('commission', 0)),
            created_by    = request.user.username,
            status        = 'pending',
        )
        return JsonResponse({'success': True, 'transfer': transfer.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# إحصائيات مشرف الحوالات
# ══════════════════════════════════════════════════════════════════════════════

@require_GET
def api_ts_stats(request):
    """GET /api/ts/stats — إحصائيات شاملة لمشرف الحوالات"""
    today = timezone.now().date()

    total     = HawalaTransfer.objects.count()
    today_cnt = HawalaTransfer.objects.filter(created_at__date=today).count()
    pending   = HawalaTransfer.objects.filter(status='pending').count()
    processing= HawalaTransfer.objects.filter(status='processing').count()
    completed = HawalaTransfer.objects.filter(status='completed').count()
    cancelled = HawalaTransfer.objects.filter(status='cancelled').count()

    employees_total  = SystemUser.objects.filter(role='T03', is_active=True).count()
    agents_total     = ExecutionAgent.objects.count()
    agents_active    = ExecutionAgent.objects.filter(status='active').count()
    client_groups    = ClientGroup.objects.count()

    # إجمالي مبالغ اليوم
    today_amounts = HawalaTransfer.objects.filter(created_at__date=today).aggregate(
        usd=Sum('amount', filter=Q(currency='USD')),
        ils=Sum('amount', filter=Q(currency='ILS')),
        jod=Sum('amount', filter=Q(currency='JOD')),
    )

    return JsonResponse({
        'success': True,
        'stats': {
            'transfers': {
                'total':      total,
                'today':      today_cnt,
                'pending':    pending,
                'processing': processing,
                'completed':  completed,
                'cancelled':  cancelled,
            },
            'employees': {
                'total':  employees_total,
            },
            'agents': {
                'total':  agents_total,
                'active': agents_active,
            },
            'clientGroups': client_groups,
            'todayAmounts': {
                'USD': round(today_amounts['usd'] or 0, 2),
                'ILS': round(today_amounts['ils'] or 0, 2),
                'JOD': round(today_amounts['jod'] or 0, 2),
            },
        }
    })


# ══════════════════════════════════════════════════════════════════════════════
# إحصائيات الموظف نفسه (T03)
# ══════════════════════════════════════════════════════════════════════════════

def api_ts_my_stats(request):
    """GET /api/ts/my-stats — إحصائيات الموظف الحالي لليوم"""
    err = _require_roles(request, 'T03')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)

    today = timezone.now().date()
    caller = _caller(request)
    qs = HawalaTransfer.objects.filter(created_by=caller, created_at__date=today)

    total     = qs.count()
    pending   = qs.filter(status='pending').count()
    processing= qs.filter(status='processing').count()
    completed = qs.filter(status='completed').count()

    amounts = qs.aggregate(
        usd=Sum('amount', filter=Q(currency='USD')),
        ils=Sum('amount', filter=Q(currency='ILS')),
        jod=Sum('amount', filter=Q(currency='JOD')),
    )

    return JsonResponse({
        'success': True,
        'today': {
            'total':      total,
            'pending':    pending,
            'processing': processing,
            'completed':  completed,
        },
        'amounts': {
            'USD': round(amounts['usd'] or 0, 2),
            'ILS': round(amounts['ils'] or 0, 2),
            'JOD': round(amounts['jod'] or 0, 2),
        },
    })


# ══════════════════════════════════════════════════════════════════════════════
# الموظفون (T03) — يُديرهم مشرف الحوالات
# ══════════════════════════════════════════════════════════════════════════════

def api_ts_employees(request):
    """
    GET  /api/ts/employees  ← قائمة موظفي الحوالات
    POST /api/ts/employees  ← إضافة موظف جديد
    """
    if request.method == 'GET':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        today = timezone.now().date()

        # query واحد بدلاً من N+1 (annotate بعدد حوالات اليوم لكل موظف)
        today_counts = {
            row['created_by']: row['cnt']
            for row in HawalaTransfer.objects
                .filter(created_at__date=today)
                .values('created_by')
                .annotate(cnt=Count('id'))
        }
        employees = SystemUser.objects.filter(role='T03')

        result = []
        for emp in employees:
            d = emp.to_dict()
            d['todayTransfers'] = today_counts.get(emp.username, 0)
            result.append(d)

        stats = {
            'total':     employees.count(),
            'active':    employees.filter(is_active=True).count(),
            'suspended': employees.filter(is_active=False).count(),
        }

        return JsonResponse({'success': True, 'employees': result, 'stats': stats})

    if request.method == 'POST':
        # إنشاء موظف حوالات — الإدارة العامة فقط
        err = _require_roles(request, 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        username   = (data.get('username') or '').strip()
        password   = (data.get('password') or '').strip()
        first_name = (data.get('name') or data.get('firstName') or '').strip()

        if not username or not password:
            return JsonResponse({'success': False,
                                 'message': 'username وpassword مطلوبان'}, status=400)
        if len(password) < 12:
            return JsonResponse({'success': False,
                                 'message': 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل'}, status=400)
        if SystemUser.objects.filter(username=username).exists():
            return JsonResponse({'success': False,
                                 'message': 'اسم المستخدم مستخدم مسبقاً'}, status=400)

        user = SystemUser.objects.create_user(
            username   = username,
            password   = password,
            first_name = first_name,
            role       = 'T03',
        )
        return JsonResponse({'success': True, 'employee': user.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_ts_employee_detail(request, username):
    """PATCH/DELETE /api/ts/employees/<username>"""
    try:
        user = SystemUser.objects.get(username=username, role='T03')
    except SystemUser.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الموظف غير موجود'}, status=404)

    if request.method == 'PATCH':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        changed = []
        if 'firstName' in data or 'name' in data:
            user.first_name = (data.get('firstName') or data.get('name') or '').strip()
            changed.append('first_name')
        if 'isActive' in data:
            user.is_active = bool(data['isActive'])
            changed.append('is_active')
        if changed:
            user.save(update_fields=changed)
        return JsonResponse({'success': True, 'employee': user.to_dict()})

    if request.method == 'DELETE':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err
        uname = user.username
        user.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف الموظف: {uname}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_ts_employee_password(request, username):
    """POST /api/ts/employees/<username>/password"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
    err = _require_roles(request, 'M03', 'M01')
    if err: return err

    data, err = _parse(request)
    if err: return err

    password = (data.get('password') or '').strip()
    if not password or len(password) < 12:
        return JsonResponse({'success': False,
                             'message': 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل'}, status=400)
    try:
        user = SystemUser.objects.get(username=username)
    except SystemUser.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الموظف غير موجود'}, status=404)

    user.set_password(password)
    user.save(update_fields=['password'])
    return JsonResponse({'success': True, 'message': 'تم تغيير كلمة المرور بنجاح'})


# ══════════════════════════════════════════════════════════════════════════════
# وكلاء التنفيذ
# ══════════════════════════════════════════════════════════════════════════════

def api_ts_agents(request):
    """GET/POST /api/ts/agents"""
    if request.method == 'GET':
        qs = ExecutionAgent.objects.all()
        status_f = request.GET.get('status', '').strip()
        if status_f:
            qs = qs.filter(status=status_f)

        stats = {
            'total':  qs.count(),
            'active': ExecutionAgent.objects.filter(status='active').count(),
            'busy':   ExecutionAgent.objects.filter(status='busy').count(),
            'offline':ExecutionAgent.objects.filter(status='offline').count(),
        }
        return JsonResponse({'success': True, 'agents': [a.to_dict() for a in qs],
                             'stats': stats})

    if request.method == 'POST':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        name = (data.get('name') or '').strip()
        if not name:
            return JsonResponse({'success': False, 'message': 'اسم الوكيل مطلوب'}, status=400)

        currencies = data.get('currencies', [])
        if isinstance(currencies, list):
            currencies = ','.join(currencies)

        agent = ExecutionAgent.objects.create(
            name             = name,
            color            = data.get('color', '#34d399'),
            icon             = data.get('icon', '🤝'),
            status           = data.get('status', 'active'),
            phone            = (data.get('phone') or '').strip(),
            whatsapp_number  = (data.get('whatsappNumber') or '').strip().lstrip('+'),
            currencies       = currencies or 'USD,ILS,JOD',
            commission       = _dec(data.get('commission', 0)),
            max_capacity     = int(data.get('maxCapacity', 50) or 50),
            responsible      = (data.get('responsible') or '').strip(),
            notes            = (data.get('notes') or '').strip(),
            created_by       = _caller(request),
        )
        return JsonResponse({'success': True, 'agent': agent.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_ts_agent_detail(request, agent_id):
    """PATCH/DELETE /api/ts/agents/<id>"""
    try:
        agent = ExecutionAgent.objects.get(id=agent_id)
    except ExecutionAgent.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    if request.method == 'PATCH':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        changed = []
        simple_fields = {
            'name': ('name', str), 'color': ('color', str), 'icon': ('icon', str),
            'status': ('status', str), 'phone': ('phone', str),
            'whatsappNumber': ('whatsapp_number', str),
            'responsible': ('responsible', str), 'notes': ('notes', str),
            'commission': ('commission', float), 'maxCapacity': ('max_capacity', int),
            'currentLoad': ('current_load', int),
        }
        for json_key, (model_field, cast) in simple_fields.items():
            if json_key in data:
                setattr(agent, model_field, cast(data[json_key] or (0 if cast in (float, int) else '')))
                changed.append(model_field)

        if 'currencies' in data:
            c = data['currencies']
            agent.currencies = ','.join(c) if isinstance(c, list) else str(c)
            changed.append('currencies')

        if changed:
            agent.save(update_fields=changed)
        return JsonResponse({'success': True, 'agent': agent.to_dict()})

    if request.method == 'DELETE':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err
        name = agent.name
        agent.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف الوكيل: {name}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


@csrf_exempt
def api_ts_agent_portal_setup(request, agent_id):
    """POST /api/ts/agents/<id>/portal-setup/ — M03 يضبط PIN ويفعّل بوابة الوكيل"""
    err = _require_roles(request, 'M03', 'M01')
    if err: return err

    try:
        agent = ExecutionAgent.objects.get(id=agent_id)
    except ExecutionAgent.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    data, err = _parse(request)
    if err: return err

    pin     = (data.get('pin') or '').strip()
    email   = (data.get('email') or '').strip()
    country = (data.get('country') or '').strip()
    active  = data.get('portalActive', True)

    save_fields = ['email', 'country', 'portal_active']

    if pin:
        if len(pin) < 4:
            return JsonResponse({'success': False, 'message': 'PIN يجب أن يكون 4 أرقام على الأقل'}, status=400)
        agent.set_pin(pin)
        save_fields.append('pin_hash')

    if email:   agent.email   = email
    if country: agent.country = country
    agent.portal_active = bool(active)

    agent.save(update_fields=save_fields)

    return JsonResponse({
        'success': True,
        'message': f'تم تفعيل بوابة الوكيل: {agent.name}',
        'portalLink': f'/agent/login/',
    })


# ══════════════════════════════════════════════════════════════════════════════
# مجموعات العملاء
# ══════════════════════════════════════════════════════════════════════════════

def api_ts_client_groups(request):
    """GET/POST /api/ts/client-groups"""
    if request.method == 'GET':
        qs = ClientGroup.objects.all()
        return JsonResponse({'success': True,
                             'groups': [g.to_dict() for g in qs],
                             'count': qs.count()})

    if request.method == 'POST':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        name = (data.get('name') or '').strip()
        if not name:
            return JsonResponse({'success': False, 'message': 'اسم المجموعة مطلوب'}, status=400)

        group = ClientGroup.objects.create(
            name        = name,
            color       = data.get('color', '#32b8c6'),
            icon        = data.get('icon', '👥'),
            description = (data.get('description') or '').strip(),
            count       = int(data.get('count', 0) or 0),
            created_by  = _caller(request),
        )
        return JsonResponse({'success': True, 'group': group.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_ts_client_group_detail(request, group_id):
    """PATCH/DELETE /api/ts/client-groups/<id>"""
    try:
        group = ClientGroup.objects.get(id=group_id)
    except ClientGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'المجموعة غير موجودة'}, status=404)

    if request.method == 'PATCH':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        changed = []
        for key, field in [('name','name'),('color','color'),('icon','icon'),
                           ('description','description')]:
            if key in data:
                setattr(group, field, (data[key] or '').strip())
                changed.append(field)
        if 'count' in data:
            group.count = int(data['count'] or 0)
            changed.append('count')
        if changed:
            group.save(update_fields=changed)
        return JsonResponse({'success': True, 'group': group.to_dict()})

    if request.method == 'DELETE':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err
        name = group.name
        group.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف المجموعة: {name}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════════════════
# تسعيرة الدول — عمولة البوابة (M03 / M01)
# ══════════════════════════════════════════════════════════════════════════════

def api_ts_portal_pricing(request):
    """
    GET  /api/ts/portal-pricing   ← قائمة الدول مع عمولتها
    PUT  /api/ts/portal-pricing   ← تحديث عمولة دولة أو أكثر دفعة واحدة
    """
    err = _require_roles(request, 'M03', 'M01')
    if err:
        return err

    if request.method == 'GET':
        countries = PortalCountry.objects.order_by('order', 'name')
        return JsonResponse({'success': True, 'countries': [
            {
                'slug':     c.slug,
                'name':     c.name,
                'flag':     c.flag,
                'currency': c.currency,
                'rate':     float(c.rate),
                'feePct':   float(c.fee_pct),
                'isActive': c.is_active,
            }
            for c in countries
        ]})

    # PUT — تحديث عمولة دولة واحدة أو قائمة
    data, err = _parse_json(request)
    if err:
        return err

    # يقبل: {"slug": "sa", "feePct": 2.5}
    # أو:   [{"slug": "sa", "feePct": 2.5}, {"slug": "tr", "feePct": 1.0}]
    items = data if isinstance(data, list) else [data]
    updated = []
    for item in items:
        slug    = (item.get('slug') or '').strip().lower()
        fee_pct = item.get('feePct')
        if not slug or fee_pct is None:
            continue
        try:
            fee_val = Decimal(str(fee_pct))
            if fee_val < 0 or fee_val > 100:
                continue
            country = PortalCountry.objects.get(slug=slug)
            country.fee_pct    = fee_val
            country.updated_by = request.user.username
            country.save(update_fields=['fee_pct', 'updated_by', 'updated_at'])
            updated.append({'slug': slug, 'feePct': float(fee_val)})
        except (PortalCountry.DoesNotExist, Exception):
            continue

    return JsonResponse({'success': True, 'updated': updated})


def api_ts_portal_pricing_detail(request, slug):
    """
    GET   /api/ts/portal-pricing/<slug>  ← تفاصيل دولة
    PATCH /api/ts/portal-pricing/<slug>  ← تعديل عمولة دولة واحدة
    """
    err = _require_roles(request, 'M03', 'M01')
    if err:
        return err

    try:
        country = PortalCountry.objects.get(slug=slug)
    except PortalCountry.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'الدولة غير موجودة'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'country': {
            'slug':     country.slug,
            'name':     country.name,
            'flag':     country.flag,
            'currency': country.currency,
            'rate':     float(country.rate),
            'feePct':   float(country.fee_pct),
            'isActive': country.is_active,
            'updatedBy': country.updated_by,
            'updatedAt': country.updated_at.isoformat(),
        }})

    # PATCH
    data, err = _parse_json(request)
    if err:
        return err

    fee_pct = data.get('feePct')
    if fee_pct is None:
        return JsonResponse({'success': False, 'error': 'feePct مطلوب'}, status=400)

    try:
        fee_val = Decimal(str(fee_pct))
        if fee_val < 0 or fee_val > 100:
            return JsonResponse({'success': False, 'error': 'نسبة العمولة يجب أن تكون بين 0 و 100'}, status=400)
    except Exception:
        return JsonResponse({'success': False, 'error': 'قيمة غير صالحة'}, status=400)

    country.fee_pct    = fee_val
    country.updated_by = request.user.username
    country.save(update_fields=['fee_pct', 'updated_by', 'updated_at'])

    return JsonResponse({'success': True, 'slug': slug, 'feePct': float(fee_val)})


# ══════════════════════════════════════════════════════════════════════════════
# التقارير — SupervisorReport
# ══════════════════════════════════════════════════════════════════════════════

def api_reports(request):
    """
    GET  /api/reports  ← M01 يجلب كل التقارير
    POST /api/reports  ← أي مشرف يرفع تقرير
    GET  /api/reports?page=tellerMgr  ← فلترة حسب الصفحة
    GET  /api/reports?unread=1        ← غير المقروءة فقط
    """
    if request.method == 'GET':
        err = _require_roles(request, 'M01')
        if err: return err

        qs = SupervisorReport.objects.all()
        page_f  = request.GET.get('page', '').strip()
        unread  = request.GET.get('unread', '').strip()
        branch  = request.GET.get('branch', '').strip()
        q       = request.GET.get('q', '').strip()

        if page_f:  qs = qs.filter(page=page_f)
        if unread:  qs = qs.filter(is_read=False)
        if branch:  qs = qs.filter(branch__icontains=branch)
        if q:
            qs = qs.filter(
                Q(title__icontains=q) |
                Q(body__icontains=q)  |
                Q(submitted_by__icontains=q)
            )

        unread_count = SupervisorReport.objects.filter(is_read=False).count()
        return JsonResponse({
            'success':     True,
            'reports':     [r.to_dict() for r in qs],
            'count':       qs.count(),
            'unreadCount': unread_count,
        })

    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)

        data, err = _parse(request)
        if err: return err

        title = (data.get('title') or '').strip()
        body  = (data.get('body')  or '').strip()
        page  = (data.get('page')  or '').strip()

        if not title or not body:
            return JsonResponse({'success': False,
                                 'message': 'title و body مطلوبان'}, status=400)

        report = SupervisorReport.objects.create(
            page         = page,
            title        = title,
            body         = body,
            branch       = (data.get('branch') or '').strip(),
            submitted_by = _caller(request),
        )
        return JsonResponse({'success': True, 'report': report.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_report_read(request, report_id):
    """PATCH /api/reports/<id>/read — تعليم تقرير كمقروء"""
    if request.method != 'PATCH':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
    err = _require_roles(request, 'M01')
    if err: return err

    try:
        report = SupervisorReport.objects.get(id=report_id)
    except SupervisorReport.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التقرير غير موجود'}, status=404)

    report.is_read = True
    report.save(update_fields=['is_read'])
    return JsonResponse({'success': True, 'report': report.to_dict()})


# ══════════════════════════════════════════════════════════════════════════════
# تعليمات الإدارة — AdminInstruction
# ══════════════════════════════════════════════════════════════════════════════

def api_instructions(request):
    """
    GET  /api/instructions              ← M01 يجلب كل التعليمات
                                          M02/M03 يجلب تعليماته فقط
    POST /api/instructions              ← M01 ينشئ تعليمة
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)

    if request.method == 'GET':
        user = request.user
        if user.role == 'M01':
            qs = AdminInstruction.objects.all()
        else:
            # المشرف يرى التعليمات الموجهة لدوره أو له شخصياً أو للكل
            qs = AdminInstruction.objects.filter(
                Q(target_role='') |
                Q(target_role=user.role) |
                Q(target_user=user.username)
            )

        priority_f = request.GET.get('priority', '').strip()
        unread_f   = request.GET.get('unread', '').strip()
        if priority_f: qs = qs.filter(priority=priority_f)
        if unread_f:   qs = qs.filter(is_read=False)

        return JsonResponse({
            'success':      True,
            'instructions': [i.to_dict() for i in qs],
            'count':        qs.count(),
            'unread':       qs.filter(is_read=False).count(),
        })

    if request.method == 'POST':
        err = _require_roles(request, 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        title = (data.get('title') or '').strip()
        body  = (data.get('body')  or '').strip()
        if not title or not body:
            return JsonResponse({'success': False,
                                 'message': 'title و body مطلوبان'}, status=400)

        instr = AdminInstruction.objects.create(
            title       = title,
            body        = body,
            priority    = data.get('priority', 'normal'),
            target_role = (data.get('targetRole') or '').strip(),
            target_user = (data.get('targetUser') or '').strip(),
            created_by  = _caller(request),
        )
        return JsonResponse({'success': True, 'instruction': instr.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_instruction_read(request, instr_id):
    """PATCH /api/instructions/<id>/read"""
    if request.method != 'PATCH':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)

    try:
        instr = AdminInstruction.objects.get(id=instr_id)
    except AdminInstruction.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التعليمة غير موجودة'}, status=404)

    instr.is_read = True
    instr.read_by = _caller(request)
    instr.read_at = timezone.now()
    instr.save(update_fields=['is_read', 'read_by', 'read_at'])
    return JsonResponse({'success': True, 'instruction': instr.to_dict()})


# ══════════════════════════════════════════════════════════════════════════════
# مناطق عمل الوكيل  —  AgentLocation
# ══════════════════════════════════════════════════════════════════════════════

def api_ts_agent_locations(request, agent_id):
    """
    GET  /api/ts/agents/<id>/locations/   ← قائمة مناطق الوكيل
    POST /api/ts/agents/<id>/locations/   ← إضافة منطقة جديدة
    """
    try:
        agent = ExecutionAgent.objects.get(id=agent_id)
    except ExecutionAgent.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    if request.method == 'GET':
        locs = agent.locations.all()
        return JsonResponse({'success': True, 'locations': [l.to_dict() for l in locs]})

    if request.method == 'POST':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        country = (data.get('country') or '').strip()
        city    = (data.get('city') or '').strip()
        if not country:
            return JsonResponse({'success': False, 'message': 'البلد مطلوب'}, status=400)

        loc, created = AgentLocation.objects.get_or_create(
            agent=agent, country=country, city=city,
            defaults={
                'is_primary': data.get('isPrimary', False),
                'notes':      (data.get('notes') or '').strip(),
            }
        )
        if not created:
            return JsonResponse({'success': False, 'message': 'هذه المنطقة موجودة مسبقاً'}, status=400)

        if loc.is_primary:
            agent.locations.exclude(id=loc.id).update(is_primary=False)

        return JsonResponse({'success': True, 'location': loc.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_ts_agent_location_detail(request, agent_id, loc_id):
    """
    PATCH  /api/ts/agents/<id>/locations/<loc_id>/   ← تعديل منطقة
    DELETE /api/ts/agents/<id>/locations/<loc_id>/   ← حذف منطقة
    """
    try:
        loc = AgentLocation.objects.get(id=loc_id, agent_id=agent_id)
    except AgentLocation.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'المنطقة غير موجودة'}, status=404)

    if request.method == 'PATCH':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        changed = []
        for key, field in [('country','country'), ('city','city'), ('notes','notes')]:
            if key in data:
                setattr(loc, field, (data[key] or '').strip())
                changed.append(field)
        if 'isPrimary' in data:
            loc.is_primary = bool(data['isPrimary'])
            changed.append('is_primary')
            if loc.is_primary:
                AgentLocation.objects.filter(agent_id=agent_id).exclude(id=loc_id).update(is_primary=False)
        if changed:
            loc.save(update_fields=changed)
        return JsonResponse({'success': True, 'location': loc.to_dict()})

    if request.method == 'DELETE':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err
        loc.delete()
        return JsonResponse({'success': True, 'message': 'تم حذف المنطقة'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# تسعير الحوالات لكل وكيل  —  AgentTransferRate
# ══════════════════════════════════════════════════════════════════════════════

def api_ts_agent_rates(request, agent_id):
    """
    GET  /api/ts/agents/<id>/rates/   ← أسعار الوكيل
    POST /api/ts/agents/<id>/rates/   ← إضافة / تحديث سعر لدولة+عملة
    """
    try:
        agent = ExecutionAgent.objects.get(id=agent_id)
    except ExecutionAgent.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الوكيل غير موجود'}, status=404)

    if request.method == 'GET':
        rates = agent.transfer_rates.all()
        return JsonResponse({'success': True, 'rates': [r.to_dict() for r in rates]})

    if request.method == 'POST':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        country  = (data.get('country') or '').strip()
        currency = (data.get('currency') or 'USD').strip().upper()
        if not country:
            return JsonResponse({'success': False, 'message': 'البلد مطلوب'}, status=400)

        rate_obj, _ = AgentTransferRate.objects.get_or_create(
            agent=agent, country=country, currency=currency,
            defaults={'updated_by': _caller(request)}
        )
        # تحديث الحقول سواء كان جديداً أو موجوداً
        rate_obj.rate       = _dec(data.get('rate', rate_obj.rate))
        rate_obj.fee_flat   = _dec(data.get('feeFlat', rate_obj.fee_flat))
        rate_obj.fee_pct    = _dec(data.get('feePct', rate_obj.fee_pct))
        rate_obj.min_amount = _dec(data.get('minAmount', rate_obj.min_amount))
        rate_obj.max_amount = _dec(data.get('maxAmount', rate_obj.max_amount))
        rate_obj.is_active  = bool(data.get('isActive', rate_obj.is_active))
        rate_obj.notes      = (data.get('notes') or rate_obj.notes or '').strip()
        rate_obj.updated_by = _caller(request)
        rate_obj.save()

        return JsonResponse({'success': True, 'rate': rate_obj.to_dict()})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_ts_agent_rate_detail(request, agent_id, rate_id):
    """
    PATCH  /api/ts/agents/<id>/rates/<rate_id>/
    DELETE /api/ts/agents/<id>/rates/<rate_id>/
    """
    try:
        rate_obj = AgentTransferRate.objects.get(id=rate_id, agent_id=agent_id)
    except AgentTransferRate.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'السعر غير موجود'}, status=404)

    if request.method == 'PATCH':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err

        data, err = _parse(request)
        if err: return err

        for key, field, cast in [
            ('country',   'country',   str),
            ('currency',  'currency',  str),
            ('rate',      'rate',      _dec),
            ('feeFlat',   'fee_flat',  _dec),
            ('feePct',    'fee_pct',   _dec),
            ('minAmount', 'min_amount',_dec),
            ('maxAmount', 'max_amount',_dec),
            ('notes',     'notes',     str),
        ]:
            if key in data:
                setattr(rate_obj, field, cast(data[key] or (0 if cast is _dec else '')))

        if 'isActive' in data:
            rate_obj.is_active = bool(data['isActive'])

        rate_obj.updated_by = _caller(request)
        rate_obj.save()
        return JsonResponse({'success': True, 'rate': rate_obj.to_dict()})

    if request.method == 'DELETE':
        err = _require_roles(request, 'M03', 'M01')
        if err: return err
        rate_obj.delete()
        return JsonResponse({'success': True, 'message': 'تم حذف السعر'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_ts_all_agent_rates(request):
    """
    GET /api/ts/agent-rates/   ← كل أسعار كل الوكلاء (للمشرف — جدول عام)
    """
    err = _require_roles(request, 'M03', 'M01')
    if err: return err

    qs = AgentTransferRate.objects.select_related('agent').all()
    country_f = (request.GET.get('country') or '').strip()
    agent_f   = request.GET.get('agent')
    if country_f:
        qs = qs.filter(country__icontains=country_f)
    if agent_f:
        qs = qs.filter(agent_id=agent_f)

    return JsonResponse({'success': True, 'rates': [r.to_dict() for r in qs]})
