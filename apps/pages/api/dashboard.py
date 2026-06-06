"""
Dashboard API endpoints — الإدارة العامة (M01)
═══════════════════════════════════════════════
GET  /api/dash/stats               ← إحصائيات لوحة التحكم
GET  /api/dash/org-tree            ← بيانات الهيكل التنظيمي

GET  /api/branches                 ← قائمة الفروع
POST /api/branches                 ← إضافة فرع جديد
PATCH/DELETE /api/branches/<id>    ← تعديل / حذف فرع
POST /api/branches/transfer        ← تحويل أموال بين الفروع
GET  /api/branches/<id>/transfers  ← سجل تحويلات فرع

GET  /api/supervisors              ← قائمة المشرفين (M02 + M03)
POST /api/supervisors              ← إضافة مشرف جديد
PATCH/DELETE /api/supervisors/<username>  ← تعديل / حذف

GET  /api/users                    ← كل مستخدمي النظام
POST /api/users                    ← إضافة مستخدم بأي دور
PATCH/DELETE /api/users/<username> ← تعديل / حذف مستخدم
POST /api/users/<username>/password← تغيير كلمة مرور

GET  /api/transactions-unified     ← عمليات موحدة من كل المصادر
GET  /api/main-box                 ← الخزينة المركزية
GET  /api/sessions                 ← الجلسات النشطة (تقريبي)
"""
import datetime
import logging
from decimal import Decimal, InvalidOperation
from django.http        import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from django.utils       import timezone
from django.db          import transaction
from django.db.models   import Sum, Count, Q, F
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

_log     = logging.getLogger('intl.app')
_sec_log = logging.getLogger('intl.security')


def _to_decimal(value, default=Decimal('0')) -> Decimal:
    """تحويل آمن لـ Decimal مع حماية من القيم غير الصالحة."""
    try:
        return Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError):
        return default

from ..models import (
    SystemUser, Branch, BranchTransfer,
    TellerProfile, TellerBalance, TellerPermission,
    ExchangeOperation, HawalaOperation, CashTransaction,
    TellerRequest, ExchangeRate, ROLE_CHOICES,
    CentralTreasury, TreasuryDeposit, AuditLog,
    SupervisorBox, SupervisorBoxLog,
)
from core.permissions import require_roles as _require_roles, parse_json as _parse_json

# نستورد النماذج الاختيارية بشكل آمن
try:
    from ..models import HawalaTransfer as _HawalaTransfer
except ImportError:
    _HawalaTransfer = None
try:
    from ..models import BankTransfer as _BankTransfer
except ImportError:
    _BankTransfer = None
try:
    from ..models import AdminInstruction as _AdminInstruction
except ImportError:
    _AdminInstruction = None
try:
    from ..models import SupervisorReport as _SupervisorReport
except ImportError:
    _SupervisorReport = None


# ─── local aliases ────────────────────────────────────────────────────────────

def _require_m01(request):
    return _require_roles(request, 'M01')


# ══════════════════════════════════════════════════════════════════════════════
# إحصائيات لوحة التحكم
# ══════════════════════════════════════════════════════════════════════════════

@require_GET
def api_dash_stats(request):
    """GET /api/dash/stats — إحصائيات فورية للوحة التحكم"""
    today = timezone.now().date()
    today_start = timezone.make_aware(datetime.datetime.combine(today, datetime.time.min))

    branches_count   = Branch.objects.filter(status='active').count()
    total_branches   = Branch.objects.count()

    # المشرفون النشطون (M02 + M03)
    supervisors_count = SystemUser.objects.filter(
        role__in=['M02', 'M03'], is_active=True
    ).count()

    # صناديق التلرات
    teller_boxes = TellerProfile.objects.count()
    online_tellers = TellerProfile.objects.filter(status='online').count()

    # العمليات اليوم
    ops_today = (
        ExchangeOperation.objects.filter(created_at__gte=today_start).count() +
        HawalaOperation.objects.filter(created_at__gte=today_start).count() +
        CashTransaction.objects.filter(created_at__gte=today_start).count()
    )

    # إجمالي المستخدمين
    total_users = SystemUser.objects.filter(is_active=True).count()

    # أرصدة الفروع الإجمالية
    bal = Branch.objects.aggregate(
        total_usd=Sum('balance_usd'),
        total_ils=Sum('balance_ils'),
        total_jod=Sum('balance_jod'),
    )

    # طلبات التلرات المعلقة
    pending_requests = TellerRequest.objects.filter(status='pending').count()

    return JsonResponse({
        'success': True,
        'stats': {
            'activeBranches':  branches_count,
            'totalBranches':   total_branches,
            'supervisors':     supervisors_count,
            'tellerBoxes':     teller_boxes,
            'onlineTellers':   online_tellers,
            'opsToday':        ops_today,
            'totalUsers':      total_users,
            'pendingRequests': pending_requests,
            'balances': {
                'USD': round(bal['total_usd'] or 0, 2),
                'ILS': round(bal['total_ils'] or 0, 2),
                'JOD': round(bal['total_jod'] or 0, 2),
            },
        }
    })


@require_GET
def api_org_tree(request):
    """GET /api/dash/org-tree — بيانات الهيكل التنظيمي للداشبورد"""
    branches = Branch.objects.all()
    sups = SystemUser.objects.filter(role__in=['M02', 'M03'], is_active=True)
    tellers = TellerProfile.objects.all()

    return JsonResponse({
        'success': True,
        'tree': {
            'activeBranches': branches.filter(status='active').count(),
            'totalSupervisors': sups.count(),
            'tellerSupervisors': sups.filter(role='M02').count(),
            'transferSupervisors': sups.filter(role='M03').count(),
            'totalTellers': tellers.count(),
            'onlineTellers': tellers.filter(status='online').count(),
            'branches': [b.to_dict() for b in branches],
        }
    })


# ══════════════════════════════════════════════════════════════════════════════
# إدارة الفروع
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_branches(request):
    """
    GET  /api/branches  ← قائمة الفروع
    POST /api/branches  ← إضافة فرع جديد
    """
    if request.method == 'GET':
        branches = Branch.objects.all()
        return JsonResponse({
            'success': True,
            'branches': [b.to_dict() for b in branches],
            'count': branches.count(),
        })

    if request.method == 'POST':
        err = _require_m01(request)
        if err: return err

        data, err = _parse_json(request)
        if err: return err

        name     = (data.get('name') or '').strip()
        location = (data.get('location') or '').strip()
        if not name:
            return JsonResponse({'success': False, 'message': 'اسم الفرع مطلوب'}, status=400)

        MAX_BALANCE = Decimal('10000000')
        bal_usd = _to_decimal(data.get('balanceUSD', 0))
        bal_ils = _to_decimal(data.get('balanceILS', 0))
        bal_jod = _to_decimal(data.get('balanceJOD', 0))
        if any(b < 0 or b > MAX_BALANCE for b in (bal_usd, bal_ils, bal_jod)):
            return JsonResponse({'success': False, 'message': 'قيمة الرصيد خارج النطاق المسموح'}, status=400)

        branch = Branch.objects.create(
            name        = name,
            location    = location,
            currency    = data.get('currency', 'USD'),
            balance_usd = bal_usd,
            balance_ils = bal_ils,
            balance_jod = bal_jod,
            manager     = (data.get('manager') or '').strip(),
            phone       = (data.get('phone') or '').strip(),
            notes       = (data.get('notes') or '').strip(),
            status      = data.get('status', 'active'),
        )
        AuditLog.log('branch_create', request=request, target=name,
                     detail=f'فرع جديد: {name} — {location}')
        return JsonResponse({'success': True, 'branch': branch.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


@csrf_exempt
def api_branch_detail(request, branch_id):
    """
    PATCH  /api/branches/<id>  ← تعديل بيانات الفرع
    DELETE /api/branches/<id>  ← حذف الفرع
    """
    try:
        branch = Branch.objects.get(id=branch_id)
    except Branch.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الفرع غير موجود'}, status=404)

    if request.method == 'PATCH':
        err = _require_m01(request)
        if err: return err

        data, err = _parse_json(request)
        if err: return err

        changed = []
        fields_map = {
            'name':       ('name',        str),
            'location':   ('location',    str),
            'currency':   ('currency',    str),
            'balanceUSD': ('balance_usd', float),
            'balanceILS': ('balance_ils', float),
            'balanceJOD': ('balance_jod', float),
            'manager':    ('manager',     str),
            'phone':      ('phone',       str),
            'notes':      ('notes',       str),
            'status':     ('status',      str),
        }
        for json_key, (model_field, cast) in fields_map.items():
            if json_key in data:
                if cast == float:
                    setattr(branch, model_field, _to_decimal(data[json_key] or 0))
                else:
                    setattr(branch, model_field, cast(data[json_key] or ''))
                changed.append(model_field)

        if changed:
            branch.save(update_fields=changed)
            AuditLog.log('branch_update', request=request, target=branch.name,
                         detail=f'تعديل فرع: {branch.name} — الحقول: {", ".join(changed)}')

        return JsonResponse({'success': True, 'branch': branch.to_dict()})

    if request.method == 'DELETE':
        err = _require_m01(request)
        if err: return err

        name = branch.name
        AuditLog.log('branch_delete', request=request, target=name,
                     detail=f'حذف فرع: {name}')
        branch.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف الفرع: {name}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


@csrf_exempt
def api_branch_transfer(request):
    """
    POST /api/branches/transfer
    Body: { fromBranchId, toBranchId, amount, currency, notes }
    يُحوّل من الخزينة المركزية إذا fromBranchId = null
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)

    err = _require_m01(request)
    if err: return err

    data, err = _parse_json(request)
    if err: return err

    amount   = _to_decimal(data.get('amount', 0))
    currency = (data.get('currency') or 'USD').upper().strip()
    notes    = (data.get('notes') or '').strip()

    if amount <= 0:
        return JsonResponse({'success': False, 'message': 'المبلغ يجب أن يكون أكبر من الصفر'}, status=400)
    if currency not in ('USD', 'ILS', 'JOD'):
        return JsonResponse({'success': False, 'message': 'العملة يجب أن تكون USD أو ILS أو JOD'}, status=400)

    from_branch_id = data.get('fromBranchId')
    to_branch_id   = data.get('toBranchId')

    if not to_branch_id:
        return JsonResponse({'success': False, 'message': 'يجب تحديد الفرع المُستقبِل'}, status=400)

    MAX_TRANSFER = Decimal('10000000')
    if amount > MAX_TRANSFER:
        return JsonResponse({'success': False, 'message': f'المبلغ يتجاوز الحد الأقصى ({MAX_TRANSFER:,})'}, status=400)

    bal_field = {'USD': 'balance_usd', 'ILS': 'balance_ils', 'JOD': 'balance_jod'}[currency]

    with transaction.atomic():
        from_branch = None
        if from_branch_id:
            try:
                from_branch = Branch.objects.select_for_update().get(id=from_branch_id)
            except Branch.DoesNotExist:
                return JsonResponse({'success': False, 'message': 'الفرع المُرسِل غير موجود'}, status=404)

        try:
            to_branch = Branch.objects.select_for_update().get(id=to_branch_id)
        except Branch.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'الفرع المُستقبِل غير موجود'}, status=404)

        # التحقق من الرصيد الكافي في الفرع المُرسِل
        if from_branch:
            current = _to_decimal(getattr(from_branch, bal_field))
            if current < amount:
                return JsonResponse({
                    'success': False,
                    'message': f'رصيد الفرع غير كافٍ — المتاح: {current:.2f} {currency}'
                }, status=400)
            setattr(from_branch, bal_field, current - amount)
            from_branch.save(update_fields=[bal_field])

        # إضافة الرصيد للفرع المُستقبِل
        current_to = _to_decimal(getattr(to_branch, bal_field))
        setattr(to_branch, bal_field, current_to + amount)
        to_branch.save(update_fields=[bal_field])

        # تسجيل الحركة
        transfer = BranchTransfer.objects.create(
            from_branch = from_branch,
            to_branch   = to_branch,
            amount      = amount,
            currency    = currency,
            notes       = notes,
            created_by  = request.user.get_full_name() or request.user.username,
        )

        from_name = from_branch.name if from_branch else 'الخزينة المركزية'
        AuditLog.log('branch_transfer', request=request,
                     amount=amount, currency=currency,
                     detail=f'تحويل {amount:,.2f} {currency} من [{from_name}] إلى [{to_branch.name}] — {notes}')

    return JsonResponse({'success': True, 'transfer': transfer.to_dict()}, status=201)


@require_GET
def api_branch_transfers(request, branch_id):
    """GET /api/branches/<id>/transfers — سجل تحويلات فرع معين"""
    try:
        branch = Branch.objects.get(id=branch_id)
    except Branch.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الفرع غير موجود'}, status=404)

    qs = (
        BranchTransfer.objects
        .filter(Q(from_branch=branch) | Q(to_branch=branch))
        .select_related('from_branch', 'to_branch')
        .order_by('-created_at')
    )

    try:
        page      = max(1, int(request.GET.get('page', 1)))
        page_size = min(100, max(1, int(request.GET.get('pageSize', 50))))
    except (ValueError, TypeError):
        page, page_size = 1, 50

    total = qs.count()
    items = list(qs[(page - 1) * page_size: page * page_size])

    return JsonResponse({
        'success':   True,
        'branch':    branch.name,
        'total':     total,
        'page':      page,
        'pageSize':  page_size,
        'transfers': [t.to_dict() for t in items],
    })


# ══════════════════════════════════════════════════════════════════════════════
# إدارة المشرفين
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_supervisors(request):
    """
    GET  /api/supervisors         ← قائمة المشرفين
    POST /api/supervisors         ← إضافة مشرف جديد
    GET  /api/supervisors?role=M02 ← فلترة حسب الدور
    """
    if request.method == 'GET':
        qs = SystemUser.objects.filter(role__in=['M02', 'M03'])
        role_filter = request.GET.get('role', '').strip()
        if role_filter in ('M02', 'M03'):
            qs = qs.filter(role=role_filter)
        return JsonResponse({
            'success': True,
            'supervisors': [u.to_dict() for u in qs],
            'count': qs.count(),
        })

    if request.method == 'POST':
        err = _require_m01(request)
        if err: return err

        data, err = _parse_json(request)
        if err: return err

        username   = (data.get('username') or '').strip()
        password   = (data.get('password') or '').strip()
        first_name = (data.get('firstName') or '').strip()
        last_name  = (data.get('lastName') or '').strip()
        email      = (data.get('email') or '').strip()
        role       = (data.get('role') or 'M02').strip()
        phone      = (data.get('phone') or '').strip()

        if not username or not password:
            return JsonResponse({'success': False, 'message': 'username وpassword مطلوبان'}, status=400)
        if role not in ('M02', 'M03'):
            return JsonResponse({'success': False, 'message': 'الدور يجب أن يكون M02 أو M03'}, status=400)
        if SystemUser.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': 'اسم المستخدم مستخدم مسبقاً'}, status=400)

        # التحقق الكامل من قوة كلمة المرور
        try:
            validate_password(password)
        except DjangoValidationError as e:
            return JsonResponse({'success': False, 'message': ' | '.join(e.messages)}, status=400)

        user = SystemUser.objects.create_user(
            username   = username,
            password   = password,
            first_name = first_name,
            last_name  = last_name,
            email      = email,
            role       = role,
        )

        # إرسال SMS إذا توفر رقم هاتف
        sms_sent = False
        if phone:
            from .sms import send_teller_credentials
            site_url   = request.build_absolute_uri('/login/')
            name_full  = f'{first_name} {last_name}'.strip() or username
            sms_result = send_teller_credentials(phone, name_full, username, password, site_url)
            sms_sent   = sms_result.get('sent', False)

        AuditLog.log('supervisor_create', request=request, target=username,
                     detail=f'مشرف جديد: {username} — الدور: {role}')
        return JsonResponse({
            'success':  True,
            'supervisor': user.to_dict(),
            'smsSent': sms_sent,
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


@csrf_exempt
def api_supervisor_detail(request, username):
    """
    PATCH  /api/supervisors/<username>  ← تعديل بيانات المشرف
    DELETE /api/supervisors/<username>  ← حذف المشرف
    """
    try:
        user = SystemUser.objects.get(username=username, role__in=['M02', 'M03'])
    except SystemUser.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'المشرف غير موجود'}, status=404)

    if request.method == 'PATCH':
        err = _require_m01(request)
        if err: return err

        data, err = _parse_json(request)
        if err: return err

        changed = []
        if 'firstName' in data:
            user.first_name = (data['firstName'] or '').strip()
            changed.append('first_name')
        if 'lastName' in data:
            user.last_name = (data['lastName'] or '').strip()
            changed.append('last_name')
        if 'email' in data:
            user.email = (data['email'] or '').strip()
            changed.append('email')
        if 'isActive' in data:
            user.is_active = bool(data['isActive'])
            changed.append('is_active')
        if 'role' in data and data['role'] in ('M02', 'M03'):
            user.role = data['role']
            changed.append('role')

        if changed:
            user.save(update_fields=changed)
            AuditLog.log('supervisor_update', request=request, target=user.username,
                         detail=f'تعديل مشرف: {user.username} — الحقول: {", ".join(changed)}')

        return JsonResponse({'success': True, 'supervisor': user.to_dict()})

    if request.method == 'DELETE':
        err = _require_m01(request)
        if err: return err

        uname = user.username
        AuditLog.log('supervisor_delete', request=request, target=uname,
                     detail=f'حذف مشرف: {uname} — الدور: {user.role}')
        user.delete()
        return JsonResponse({'success': True, 'message': f'تم حذف المشرف: {uname}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# إدارة المستخدمين (كل الأدوار)
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_users(request):
    """
    GET  /api/users         ← كل المستخدمين
    POST /api/users         ← إضافة مستخدم بأي دور
    GET  /api/users?role=x  ← فلترة حسب الدور
    GET  /api/users?q=x     ← بحث بالاسم أو username
    """
    if request.method == 'GET':
        err = _require_m01(request)
        if err: return err
        qs = SystemUser.objects.all().order_by('role', 'username')
        role_filter = request.GET.get('role', '').strip()
        if role_filter:
            qs = qs.filter(role=role_filter)
        q = request.GET.get('q', '').strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q)
            )

        # ملخص لكل دور
        role_counts = {r[0]: 0 for r in ROLE_CHOICES}
        for u in SystemUser.objects.values('role').annotate(cnt=Count('id')):
            role_counts[u['role']] = u['cnt']

        return JsonResponse({
            'success': True,
            'users':  [u.to_dict() for u in qs],
            'count':  qs.count(),
            'roleCounts': role_counts,
        })

    if request.method == 'POST':
        err = _require_m01(request)
        if err: return err

        data, err = _parse_json(request)
        if err: return err

        username   = (data.get('username') or '').strip()
        password   = (data.get('password') or '').strip()
        first_name = (data.get('firstName') or '').strip()
        last_name  = (data.get('lastName') or '').strip()
        email      = (data.get('email') or '').strip()
        role       = (data.get('role') or 'T01').strip()

        if not username or not password:
            return JsonResponse({'success': False, 'message': 'username وpassword مطلوبان'}, status=400)
        if len(password) < 12:
            return JsonResponse({'success': False, 'message': 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل'}, status=400)
        if role not in dict(ROLE_CHOICES):
            return JsonResponse({'success': False, 'message': f'الدور غير صالح. الأدوار المتاحة: {list(dict(ROLE_CHOICES).keys())}'}, status=400)
        if SystemUser.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': 'اسم المستخدم مستخدم مسبقاً'}, status=400)

        with transaction.atomic():
            user = SystemUser.objects.create_user(
                username   = username,
                password   = password,
                first_name = first_name,
                last_name  = last_name,
                email      = email,
                role       = role,
            )

            # إذا كان دوره T01 أنشئ له TellerProfile تلقائياً
            if role == 'T01':
                last = TellerProfile.objects.order_by('-teller_id').first()
                try:
                    num = int(last.teller_id.replace('T', '')) + 1 if last else 1
                except (ValueError, AttributeError):
                    num = TellerProfile.objects.count() + 1
                TellerProfile.objects.get_or_create(
                    username=username,
                    defaults={
                        'teller_id': 'T' + str(num).zfill(3),
                        'name': f'{first_name} {last_name}'.strip() or username,
                    }
                )
                _log.info('user_create: تم إنشاء TellerProfile للمستخدم %s', username)

        AuditLog.log('user_create', request=request, target=username,
                     detail=f'مستخدم جديد: {username} — الدور: {role}')
        return JsonResponse({'success': True, 'user': user.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


@csrf_exempt
def api_user_detail(request, username):
    """
    PATCH  /api/users/<username>  ← تعديل بيانات المستخدم
    DELETE /api/users/<username>  ← حذف المستخدم
    """
    err = _require_m01(request)
    if err: return err

    try:
        user = SystemUser.objects.get(username=username)
    except SystemUser.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'المستخدم غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'user': user.to_dict()})

    if request.method == 'PATCH':

        data, err = _parse_json(request)
        if err: return err

        changed = []
        if 'firstName' in data:
            user.first_name = (data['firstName'] or '').strip()
            changed.append('first_name')
        if 'lastName' in data:
            user.last_name = (data['lastName'] or '').strip()
            changed.append('last_name')
        if 'email' in data:
            user.email = (data['email'] or '').strip()
            changed.append('email')
        if 'isActive' in data:
            user.is_active = bool(data['isActive'])
            changed.append('is_active')
        if 'role' in data and data['role'] in dict(ROLE_CHOICES):
            user.role = data['role']
            changed.append('role')
        if changed:
            user.save(update_fields=changed)
            AuditLog.log('user_update', request=request, target=user.username,
                         detail=f'تعديل مستخدم: {user.username} — الحقول: {", ".join(changed)}')

        return JsonResponse({'success': True, 'user': user.to_dict()})

    if request.method == 'DELETE':
        err = _require_m01(request)
        if err: return err

        # لا نسمح بحذف حساب M01 الوحيد
        if user.role == 'M01' and SystemUser.objects.filter(role='M01', is_active=True).count() <= 1:
            return JsonResponse({
                'success': False,
                'message': 'لا يمكن حذف آخر مستخدم بصلاحية M01 — يجب إنشاء مستخدم M01 بديل أولاً'
            }, status=400)

        uname = user.username
        user_role = user.role
        with transaction.atomic():
            TellerProfile.objects.filter(username=uname).delete()
            user.delete()
        AuditLog.log('user_delete', request=request, target=uname,
                     detail=f'حذف مستخدم: {uname} — الدور: {user_role}')
        return JsonResponse({'success': True, 'message': f'تم حذف المستخدم: {uname}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


@csrf_exempt
def api_user_password(request, username):
    """POST /api/users/<username>/password ← تغيير كلمة المرور"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)

    err = _require_m01(request)
    if err: return err

    data, err = _parse_json(request)
    if err: return err

    password = (data.get('password') or '').strip()
    if not password:
        return JsonResponse({'success': False, 'message': 'كلمة المرور مطلوبة'}, status=400)

    try:
        user = SystemUser.objects.get(username=username)
    except SystemUser.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'المستخدم غير موجود'}, status=404)

    # التحقق الكامل من قوة كلمة المرور
    try:
        validate_password(password, user=user)
    except DjangoValidationError as e:
        return JsonResponse({'success': False, 'message': ' | '.join(e.messages)}, status=400)

    user.set_password(password)
    user.save(update_fields=['password'])

    # إلغاء جميع جلسات المستخدم الحالية فوراً
    # نبحث في جدول الجلسات مباشرة بدون decode يدوي — أسرع وأكثر موثوقية
    try:
        from django.contrib.sessions.models import Session
        deleted_count = 0
        for session in Session.objects.filter(expire_date__gte=timezone.now()):
            try:
                decoded = session.get_decoded()
                if str(decoded.get('_auth_user_id', '')) == str(user.pk):
                    session.delete()
                    deleted_count += 1
            except Exception:
                continue  # جلسة تالفة — نتجاهلها بأمان
        _sec_log.info('password_change: أُلغيت %d جلسة للمستخدم %s', deleted_count, username)
    except Exception as exc:
        _sec_log.warning('فشل إلغاء الجلسات للمستخدم %s: %s', username, exc)

    AuditLog.log('password_change', request=request, target=username,
                 detail=f'تغيير كلمة مرور المستخدم: {username} — إلغاء الجلسات النشطة')
    return JsonResponse({'success': True, 'message': 'تم تغيير كلمة المرور وإلغاء جميع الجلسات النشطة'})


# ══════════════════════════════════════════════════════════════════════════════
# العمليات الموحدة من كل المصادر
# ══════════════════════════════════════════════════════════════════════════════

@require_GET
def api_transactions_unified(request):
    """
    GET /api/transactions-unified
    يجمع عمليات الصرف + الحوالات + المعاملات النقدية في قائمة موحدة مرتبة بالوقت

    Query params:
        source   = teller | hawala | cash (الكل افتراضياً)
        type     = نوع العملية (نص حر)
        status   = completed | pending | cancelled
        currency = USD | ILS | JOD
        q        = بحث نصي في أسماء الأطراف / الملاحظات
        date_from= YYYY-MM-DD
        date_to  = YYYY-MM-DD
        page     = رقم الصفحة (افتراضي 1)
        per_page = عدد السجلات (افتراضي 50، أقصى 200)
    """
    source   = request.GET.get('source',   '').strip()
    tx_type  = request.GET.get('type',     '').strip()
    status   = request.GET.get('status',   '').strip()
    currency = request.GET.get('currency', '').strip().upper()
    q        = request.GET.get('q',        '').strip()
    date_from= request.GET.get('date_from','').strip()
    date_to  = request.GET.get('date_to',  '').strip()

    try:
        page     = max(1, int(request.GET.get('page', 1)))
        per_page = min(200, max(1, int(request.GET.get('per_page', 50))))
    except (ValueError, TypeError):
        page, per_page = 1, 50

    results = []

    # ── تحليل فلتر التاريخ ──
    dt_from = dt_to = None
    if date_from:
        try:
            dt_from = timezone.make_aware(
                datetime.datetime.strptime(date_from, '%Y-%m-%d')
            )
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = timezone.make_aware(
                datetime.datetime.combine(
                    datetime.datetime.strptime(date_to, '%Y-%m-%d').date(),
                    datetime.time.max
                )
            )
        except ValueError:
            pass

    # ── عمليات الصرافة ──
    if not source or source == 'teller':
        qs = ExchangeOperation.objects.all()
        if dt_from: qs = qs.filter(created_at__gte=dt_from)
        if dt_to:   qs = qs.filter(created_at__lte=dt_to)
        if currency:
            qs = qs.filter(Q(from_currency=currency) | Q(to_currency=currency))
        if tx_type and tx_type != 'صرافة':
            qs = qs.none()
        if q:
            qs = qs.filter(
                Q(from_currency__icontains=q) |
                Q(to_currency__icontains=q)   |
                Q(operator__icontains=q)
            )
        for op in qs:
            results.append({
                'id':        f'EX-{op.id}',
                'source':    'teller',
                'type':      'صرافة',
                'status':    'completed',
                'amount':    op.amount,
                'currency':  op.from_currency,
                'result':    op.result,
                'toCurrency':op.to_currency,
                'rate':      op.rate,
                'from':      op.operator or '—',
                'to':        f'{op.from_currency} → {op.to_currency}',
                'notes':     '',
                'operator':  op.operator,
                'method':    op.method,
                'createdAt': op.created_at.isoformat(),
                'label':     f'صرف {op.amount} {op.from_currency} = {op.result:.2f} {op.to_currency}',
            })

    # ── عمليات الحوالات ──
    if not source or source == 'hawala':
        qs = HawalaOperation.objects.all()
        if dt_from: qs = qs.filter(created_at__gte=dt_from)
        if dt_to:   qs = qs.filter(created_at__lte=dt_to)
        if currency: qs = qs.filter(currency=currency)
        if status:
            qs = qs.filter(status=status)
        if tx_type and tx_type not in ('حوالة', 'حوالة خارجية', 'حوالة داخلية'):
            qs = qs.none()
        if q:
            qs = qs.filter(
                Q(sender_name__icontains=q)   |
                Q(receiver_name__icontains=q) |
                Q(destination__icontains=q)   |
                Q(operator__icontains=q)       |
                Q(notes__icontains=q)
            )
        for op in qs:
            results.append({
                'id':        f'HW-{op.id}',
                'source':    'hawala',
                'type':      'حوالة',
                'status':    op.status,
                'amount':    op.amount,
                'currency':  op.currency,
                'from':      op.sender_name,
                'to':        op.receiver_name,
                'destination': op.destination,
                'notes':     op.notes,
                'operator':  op.operator,
                'method':    op.method,
                'createdAt': op.created_at.isoformat(),
                'label':     f'حوالة {op.amount} {op.currency} | {op.sender_name} ← {op.receiver_name}',
            })

    # ── المعاملات النقدية ──
    if not source or source == 'cash':
        qs = CashTransaction.objects.all()
        if dt_from: qs = qs.filter(created_at__gte=dt_from)
        if dt_to:   qs = qs.filter(created_at__lte=dt_to)
        if currency: qs = qs.filter(currency=currency)
        if tx_type:
            type_map = {'إيداع نقدي': 'deposit', 'سحب نقدي': 'withdrawal'}
            if tx_type in type_map:
                qs = qs.filter(transaction_type=type_map[tx_type])
            elif tx_type not in ('إيداع نقدي', 'سحب نقدي'):
                qs = qs.none()
        if q:
            qs = qs.filter(
                Q(client_name__icontains=q) |
                Q(account__icontains=q)     |
                Q(operator__icontains=q)    |
                Q(notes__icontains=q)
            )
        for op in qs:
            type_ar = 'إيداع نقدي' if op.transaction_type == 'deposit' else 'سحب نقدي'
            results.append({
                'id':        f'CT-{op.id}',
                'source':    'cash',
                'type':      type_ar,
                'status':    'completed',
                'amount':    op.amount,
                'currency':  op.currency,
                'from':      op.client_name if op.transaction_type == 'deposit' else '—',
                'to':        op.client_name if op.transaction_type == 'withdrawal' else '—',
                'account':   op.account,
                'notes':     op.notes,
                'operator':  op.operator,
                'method':    op.method,
                'createdAt': op.created_at.isoformat(),
                'label':     f'{type_ar} {op.amount} {op.currency} — {op.client_name}',
            })

    # ── تحويلات الحوالات الخارجية (HawalaTransfer) — مع فلترة المحذوفة ──
    if _HawalaTransfer and (not source or source == 'transfers'):
        qs = _HawalaTransfer.objects.filter(is_deleted=False)
        if dt_from: qs = qs.filter(created_at__gte=dt_from)
        if dt_to:   qs = qs.filter(created_at__lte=dt_to)
        if currency: qs = qs.filter(currency=currency)
        if status:   qs = qs.filter(status=status)
        if q:
            qs = qs.filter(
                Q(sender_name__icontains=q) |
                Q(receiver_name__icontains=q) |
                Q(destination__icontains=q)
            )
        for op in qs.select_related():
            results.append({
                'id':        f'HT-{op.id}',
                'source':    'transfers',
                'type':      'حوالة خارجية',
                'status':    getattr(op, 'status', 'completed'),
                'amount':    float(op.amount),
                'currency':  op.currency,
                'from':      getattr(op, 'sender_name', '—'),
                'to':        getattr(op, 'receiver_name', '—'),
                'destination': getattr(op, 'destination', ''),
                'notes':     getattr(op, 'notes', ''),
                'createdAt': op.created_at.isoformat(),
                'label':     f'حوالة خارجية {op.amount} {op.currency}',
            })

    # ── ترتيب موحد بالتاريخ (الأحدث أولاً) ──
    results.sort(key=lambda x: x['createdAt'], reverse=True)

    total = len(results)
    start = (page - 1) * per_page
    end   = start + per_page
    page_data = results[start:end]

    # ── ملخص يومي ──
    today = timezone.now().date().isoformat()
    today_results = [r for r in results if r['createdAt'][:10] == today]
    summary = {
        'total':       total,
        'today':       len(today_results),
        'exchange':    sum(1 for r in results if r['source'] == 'teller'),
        'hawala':      sum(1 for r in results if r['source'] == 'hawala'),
        'cash':        sum(1 for r in results if r['source'] == 'cash'),
    }

    return JsonResponse({
        'success':    True,
        'summary':    summary,
        'page':       page,
        'perPage':    per_page,
        'totalPages': (total + per_page - 1) // per_page if per_page else 1,
        'total':      total,
        'transactions': page_data,
    })


# ══════════════════════════════════════════════════════════════════════════════
# الخزينة المركزية
# ══════════════════════════════════════════════════════════════════════════════

@require_GET
def api_main_box(request):
    """GET /api/main-box — الخزينة المركزية"""
    treasury = CentralTreasury.get()

    from django.db.models import Max
    latest_ids = (
        TellerBalance.objects
        .values('teller_username')
        .annotate(latest_id=Max('id'))
        .values_list('latest_id', flat=True)
    )
    teller_bal = TellerBalance.objects.filter(id__in=latest_ids).aggregate(
        usd=Sum('usd'), ils=Sum('ils'), jod=Sum('jod'),
    )
    t_usd = round(teller_bal['usd'] or 0, 2)
    t_ils = round(teller_bal['ils'] or 0, 2)
    t_jod = round(teller_bal['jod'] or 0, 2)

    branches      = [b.to_dict() for b in Branch.objects.filter(status='active')]
    recent_transfers = [
        t.to_dict() for t in
        BranchTransfer.objects.select_related('from_branch', 'to_branch').order_by('-created_at')[:20]
    ]
    recent_deposits  = list(TreasuryDeposit.objects.values(
        'id','amount','currency','notes','created_by','created_at')[:20])

    return JsonResponse({
        'success': True,
        'mainBox': {
            'balances':    treasury.to_dict(),
            'tellerBoxes': {'USD': t_usd, 'ILS': t_ils, 'JOD': t_jod},
            'branchCount': Branch.objects.filter(status='active').count(),
            'tellerCount': TellerProfile.objects.count(),
        },
        'branchDetails':   branches,
        'recentTransfers': recent_transfers,
        'recentDeposits':  recent_deposits,
    })


def api_main_box_deposit(request):
    """POST /api/main-box/deposit — إضافة رصيد للخزينة"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)
    data, err = _parse_json(request)
    if err: return err
    amount   = _to_decimal(data.get('amount', 0))
    currency = data.get('currency', 'USD').upper()
    notes    = data.get('notes', '')
    if amount <= 0:
        return JsonResponse({'success': False, 'message': 'المبلغ يجب أن يكون أكبر من صفر'})
    if currency not in ('USD', 'ILS', 'JOD'):
        return JsonResponse({'success': False, 'message': 'عملة غير مدعومة'})

    MAX_AMOUNT = Decimal('10000000')
    if amount > MAX_AMOUNT:
        return JsonResponse({'success': False, 'message': f'المبلغ يتجاوز الحد الأقصى المسموح ({MAX_AMOUNT:,}'})

    with transaction.atomic():
        treasury = CentralTreasury.objects.select_for_update().get(pk=1)
        if currency == 'USD':   treasury.balance_usd = _to_decimal(treasury.balance_usd) + amount
        elif currency == 'ILS': treasury.balance_ils = _to_decimal(treasury.balance_ils) + amount
        elif currency == 'JOD': treasury.balance_jod = _to_decimal(treasury.balance_jod) + amount
        treasury.save()

        TreasuryDeposit.objects.create(
            amount=amount, currency=currency, notes=notes,
            created_by=getattr(request.user, 'username', ''),
        )
        AuditLog.log('treasury_deposit', request=request,
                     amount=amount, currency=currency,
                     detail=f'إيداع {amount:,.2f} {currency} في الخزينة المركزية — {notes}')
    return JsonResponse({'success': True, 'balances': treasury.to_dict()})


def api_main_box_distribute(request):
    """POST /api/main-box/distribute — توزيع رصيد على التلرات"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)
    data, err = _parse_json(request)
    if err: return err
    distributions = data.get('distributions', [])   # [{tellerId, amount, currency}]
    if not distributions:
        return JsonResponse({'success': False, 'message': 'لا توجد بيانات توزيع'})
    if len(distributions) > 50:
        return JsonResponse({'success': False, 'message': 'لا يمكن توزيع على أكثر من 50 تلر في طلب واحد'}, status=400)

    with transaction.atomic():
        treasury = CentralTreasury.objects.select_for_update().get(pk=1)

        # التحقق من الرصيد لكل عملة داخل نفس الـ transaction
        totals: dict[str, Decimal] = {}
        for d in distributions:
            cur = (d.get('currency') or 'USD').upper()
            if cur not in ('USD', 'ILS', 'JOD'):
                return JsonResponse({'success': False, 'message': f'عملة غير مدعومة: {cur}'}, status=400)
            amt = _to_decimal(d.get('amount', 0))
            if amt <= 0:
                return JsonResponse({'success': False, 'message': 'المبلغ يجب أن يكون أكبر من صفر'}, status=400)
            totals[cur] = totals.get(cur, Decimal('0')) + amt

        for cur, total in totals.items():
            avail = _to_decimal(getattr(treasury, f'balance_{cur.lower()}', 0))
            if total > avail:
                return JsonResponse({'success': False, 'message': f'رصيد الخزينة غير كافٍ بـ {cur} — المتاح: {avail:,.2f}'}, status=400)

        # جمع أسماء التلرات المطلوبة دفعة واحدة
        teller_ids = [d.get('tellerId') for d in distributions if d.get('tellerId')]
        teller_map = {tp.id: tp for tp in TellerProfile.objects.filter(id__in=teller_ids)}

        # قفل جميع TellerBalance المتأثرة في عملية واحدة
        teller_usernames = [tp.username for tp in teller_map.values()]
        from django.db.models import Max as _Max
        latest_ids = (
            TellerBalance.objects
            .filter(teller_username__in=teller_usernames)
            .values('teller_username')
            .annotate(latest_id=_Max('id'))
            .values_list('latest_id', flat=True)
        )
        last_balances = {
            tb.teller_username: tb
            for tb in TellerBalance.objects.select_for_update().filter(id__in=latest_ids)
        }

        # الخصم من الخزينة
        for cur, total in totals.items():
            field = f'balance_{cur.lower()}'
            setattr(treasury, field, _to_decimal(getattr(treasury, field)) - total)
        treasury.save()

        # الإضافة لأرصدة التلرات — كل البيانات محجوزة مسبقاً بقفل واحد
        new_balances = []
        for d in distributions:
            teller_id = d.get('tellerId')
            cur       = (d.get('currency') or 'USD').upper()
            amount    = _to_decimal(d.get('amount', 0))
            tp = teller_map.get(teller_id)
            if not tp:
                continue
            last = last_balances.get(tp.username)
            usd = _to_decimal(last.usd if last else 0) + (amount if cur == 'USD' else Decimal('0'))
            ils = _to_decimal(last.ils if last else 0) + (amount if cur == 'ILS' else Decimal('0'))
            jod = _to_decimal(last.jod if last else 0) + (amount if cur == 'JOD' else Decimal('0'))
            new_balances.append(TellerBalance(teller_username=tp.username, usd=usd, ils=ils, jod=jod))

        TellerBalance.objects.bulk_create(new_balances)

    total_str = ', '.join(f'{v:,.2f} {k}' for k, v in totals.items())
    AuditLog.log('treasury_distribute', request=request,
                 detail=f'توزيع على {len(distributions)} تلر — الإجمالي: {total_str}')
    return JsonResponse({'success': True, 'balances': treasury.to_dict()})


def api_main_box_end_of_day(request):
    """POST /api/main-box/end-of-day — إرجاع أرصدة التلرات للخزينة"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)

    from django.db.models import Max
    with transaction.atomic():
        treasury = CentralTreasury.objects.select_for_update().get(pk=1)

        latest_ids = (
            TellerBalance.objects
            .values('teller_username')
            .annotate(latest_id=Max('id'))
            .values_list('latest_id', flat=True)
        )
        teller_bal = TellerBalance.objects.filter(id__in=latest_ids).aggregate(
            usd=Sum('usd'), ils=Sum('ils'), jod=Sum('jod'),
        )
        ret_usd = _to_decimal(teller_bal['usd'] or 0)
        ret_ils = _to_decimal(teller_bal['ils'] or 0)
        ret_jod = _to_decimal(teller_bal['jod'] or 0)

        treasury.balance_usd = _to_decimal(treasury.balance_usd) + ret_usd
        treasury.balance_ils = _to_decimal(treasury.balance_ils) + ret_ils
        treasury.balance_jod = _to_decimal(treasury.balance_jod) + ret_jod
        treasury.save()

        # تصفير أرصدة التلرات بإنشاء سجل صفري لكل تلر
        for tp in TellerProfile.objects.all():
            TellerBalance.objects.create(teller_username=tp.username, usd=0, ils=0, jod=0)

        AuditLog.log('treasury_end_of_day', request=request,
                     detail=f'إغلاق اليوم — أُعيد للخزينة: {ret_usd:,.2f} USD | {ret_ils:,.2f} ILS | {ret_jod:,.2f} JOD')

    return JsonResponse({
        'success': True,
        'returned': {'USD': ret_usd, 'ILS': ret_ils, 'JOD': ret_jod},
        'balances': treasury.to_dict(),
    })


# ══════════════════════════════════════════════════════════════════════════════
# الجلسات النشطة (تقريبية)
# ══════════════════════════════════════════════════════════════════════════════

@require_GET
def api_sessions(request):
    """
    GET /api/sessions
    يعرض المستخدمين الذين سجّلوا دخولهم مؤخراً (آخر 8 ساعات)
    Django لا يحفظ الجلسات per-user بشكل مباشر — نستخدم last_login كمرجع تقريبي
    """
    cutoff = timezone.now() - datetime.timedelta(hours=8)
    active_users = SystemUser.objects.filter(
        last_login__gte=cutoff,
        is_active=True
    ).order_by('-last_login')

    sessions = []
    for u in active_users:
        sessions.append({
            'username':  u.username,
            'name':      f'{u.first_name} {u.last_name}'.strip() or u.username,
            'role':      u.role,
            'roleName':  u.role_name,
            'lastLogin': u.last_login.isoformat() if u.last_login else None,
        })

    return JsonResponse({
        'success':  True,
        'count':    len(sessions),
        'sessions': sessions,
    })


# ══════════════════════════════════════════════════════════════════════════════
# مسح البيانات الوهمية — POST /api/admin/clear-dummy-data
# ══════════════════════════════════════════════════════════════════════════════

_KEEP_USERNAMES = {'admin', 'sv_teller', 'sv_trx', 'teller1', 'bank1', 'trx1'}

def api_clear_dummy_data(request):
    """POST /api/admin/clear-dummy-data — يمسح جميع البيانات التجريبية (M01 فقط)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'POST only'}, status=405)
    err = _require_m01(request)
    if err:
        return err

    deleted = 0
    try:
        with transaction.atomic():
            # النماذج الاختيارية
            for model in [_HawalaTransfer, _BankTransfer, _AdminInstruction, _SupervisorReport]:
                if model is not None:
                    c, _ = model.objects.all().delete()
                    deleted += c

            # العمليات الأساسية
            for model in [
                ExchangeOperation, HawalaOperation, CashTransaction,
                TellerRequest, ExchangeRate,
                TellerPermission, TellerBalance, TellerProfile,
                BranchTransfer, Branch,
            ]:
                c, _ = model.objects.all().delete()
                deleted += c

            # المستخدمون الوهميون
            c, _ = SystemUser.objects.exclude(username__in=_KEEP_USERNAMES).delete()
            deleted += c

        _log.info('clear_dummy_data: حُذفت %d سجل بواسطة %s', deleted, request.user.username)
        AuditLog.log('clear_dummy_data', request=request, detail=f'حُذفت {deleted} سجل تجريبي')
    except Exception as exc:
        _log.exception('clear_dummy_data: فشل الحذف — %s', exc)
        return JsonResponse({'success': False, 'message': 'فشل حذف البيانات — راجع السجلات'}, status=500)

    return JsonResponse({'success': True, 'deleted': deleted})


# ══════════════════════════════════════════════════════════════════════════
# Dev Requests API — طلبات التطوير البرمجي
# GET  /api/dev-requests/            ← قائمة الطلبات (M01 فقط)
# POST /api/dev-requests/            ← إرسال طلب جديد (أي دور)
# PATCH /api/dev-requests/<id>/      ← تحديث الحالة (M01 فقط)
# ══════════════════════════════════════════════════════════════════════════

def api_dev_requests(request):
    from ..models import DevRequest
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'غير مصرح'}, status=401)

    if request.method == 'GET':
        if request.user.role != 'M01':
            return JsonResponse({'success': False, 'message': 'غير مصرح'}, status=403)
        qs = DevRequest.objects.all().order_by('-created_at')
        status_filter = request.GET.get('status', '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        return JsonResponse({'success': True, 'requests': [r.to_dict() for r in qs]})

    if request.method == 'POST':
        data, err = _parse_json(request)
        if err: return err

        title       = (data.get('title') or '').strip()
        description = (data.get('description') or '').strip()
        req_type    = data.get('type', 'improve')

        if not title or not description:
            return JsonResponse({'success': False, 'message': 'العنوان والوصف مطلوبان'}, status=400)
        if req_type not in ('improve', 'feature', 'bug'):
            req_type = 'improve'

        dev_req = DevRequest.objects.create(
            title       = title,
            type        = req_type,
            description = description,
            sender      = request.user.username,
            sender_role = request.user.role,
            sender_page = (data.get('senderPage') or '').strip(),
        )
        return JsonResponse({'success': True, 'id': dev_req.id}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_dev_request_detail(request, req_id):
    from ..models import DevRequest
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'غير مصرح'}, status=401)
    if request.user.role != 'M01':
        return JsonResponse({'success': False, 'message': 'غير مصرح'}, status=403)

    try:
        dev_req = DevRequest.objects.get(id=req_id)
    except DevRequest.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الطلب غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'request': dev_req.to_dict()})

    if request.method == 'PATCH':
        data, err = _parse_json(request)
        if err: return err

        new_status = data.get('status')
        if new_status and new_status in ('new', 'in_progress', 'done', 'rejected'):
            dev_req.status = new_status
        admin_notes = data.get('adminNotes')
        if admin_notes is not None:
            dev_req.admin_notes = (admin_notes or '').strip()
        dev_req.save()
        return JsonResponse({'success': True, 'request': dev_req.to_dict()})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# صناديق المشرفين — الإدارة العامة (M01)
# GET  /api/supervisor-boxes          ← قائمة صناديق جميع المشرفين
# POST /api/supervisor-boxes/deposit  ← إيداع في صندوق مشرف
# GET  /api/supervisor-boxes/<username>/log ← سجل حركات صندوق مشرف
# ══════════════════════════════════════════════════════════════════════════════

def api_supervisor_boxes(request):
    """GET /api/supervisor-boxes — قائمة صناديق المشرفين (M01 فقط)"""
    err = _require_roles(request, 'M01')
    if err:
        return err

    supervisors = SystemUser.objects.filter(role='M02')
    result = []
    for sup in supervisors:
        box, _ = SupervisorBox.objects.get_or_create(
            supervisor_username=sup.username,
            defaults={'supervisor_name': sup.get_full_name() or sup.username}
        )
        d = box.to_dict()
        result.append(d)

    return JsonResponse({'success': True, 'boxes': result})


@csrf_exempt
def api_supervisor_box_deposit(request):
    """POST /api/supervisor-boxes/deposit — الإدارة تودع في صندوق مشرف"""
    err = _require_roles(request, 'M01')
    if err:
        return err

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'POST فقط'}, status=405)

    data, err2 = _parse_json(request)
    if err2: return err2
    supervisor_username = (data.get('supervisor') or '').strip()
    currency            = (data.get('currency') or 'USD').upper().strip()
    try:
        amount = Decimal(str(data.get('amount', 0)))
    except InvalidOperation:
        return JsonResponse({'success': False, 'message': 'مبلغ غير صالح'}, status=400)

    if not supervisor_username:
        return JsonResponse({'success': False, 'message': 'حدد المشرف'}, status=400)
    if currency not in ('USD', 'ILS', 'JOD'):
        return JsonResponse({'success': False, 'message': 'عملة غير صالحة'}, status=400)
    if amount <= 0:
        return JsonResponse({'success': False, 'message': 'المبلغ يجب أن يكون أكبر من صفر'}, status=400)

    try:
        supervisor = SystemUser.objects.get(username=supervisor_username, role='M02')
    except SystemUser.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'المشرف غير موجود'}, status=404)

    with transaction.atomic():
        box, _ = SupervisorBox.objects.select_for_update().get_or_create(
            supervisor_username=supervisor_username,
            defaults={'supervisor_name': supervisor.get_full_name() or supervisor_username}
        )
        field = f'balance_{currency.lower()}'
        new_balance = getattr(box, field) + amount
        setattr(box, field, new_balance)
        box.save()

        SupervisorBoxLog.objects.create(
            supervisor_username=supervisor_username,
            op_type='deposit',
            currency=currency,
            amount=amount,
            balance_after=new_balance,
            notes=data.get('notes', ''),
            created_by=request.user.username,
        )

    return JsonResponse({'success': True, 'box': box.to_dict()})


def api_supervisor_box_log(request, username):
    """GET /api/supervisor-boxes/<username>/log — سجل حركات صندوق مشرف (M01)"""
    err = _require_roles(request, 'M01')
    if err:
        return err

    logs = SupervisorBoxLog.objects.filter(supervisor_username=username).order_by('-created_at')[:100]
    return JsonResponse({'success': True, 'log': [l.to_dict() for l in logs]})


# ═══════════════════════════════════════════════════════════════════════════════
# صلاحيات الصفحات — GET/POST /api/admin/permissions/
# ═══════════════════════════════════════════════════════════════════════════════

_DEFAULT_PERMISSIONS = {
    'M01': ['dashboard', 'teller-supervisor', 'transactions-supervisor', 'teller-departments', 'accounts', 'transactions'],
    'M02': ['teller-supervisor', 'teller-departments'],
    'M03': ['transactions-supervisor', 'transactions'],
    'T01': ['teller-departments'],
    'T02': ['accounts'],
    'T03': ['transactions'],
}


def _get_all_role_permissions():
    from ..models import RolePagePermission
    result = dict(_DEFAULT_PERMISSIONS)
    for rec in RolePagePermission.objects.all():
        result[rec.role] = rec.pages
    return result


def api_admin_permissions(request):
    """
    GET  /api/admin/permissions/ — إرجاع صلاحيات الصفحات لكل الأدوار
    POST /api/admin/permissions/ — حفظ صلاحيات صفحة واحدة أو كل الأدوار
    """
    from ..models import RolePagePermission
    err = _require_roles(request, 'M01')
    if err:
        return err

    if request.method == 'GET':
        return JsonResponse({'success': True, 'permissions': _get_all_role_permissions()})

    if request.method == 'POST':
        data, _ = _parse_json(request)
        if not data:
            return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

        caller = request.user.username

        # دعم حفظ دور واحد: {"role": "M02", "pages": [...]}
        if 'role' in data and 'pages' in data:
            role  = data['role']
            pages = data['pages']
            if not isinstance(pages, list):
                return JsonResponse({'success': False, 'message': 'pages يجب أن تكون قائمة'}, status=400)
            rec, _ = RolePagePermission.objects.update_or_create(
                role=role,
                defaults={'pages': pages, 'updated_by': caller, 'updated_at': timezone.now()},
            )
            AuditLog.log('perm_update', request=request,
                         detail=f'صلاحيات {role}: {", ".join(pages)}')
            return JsonResponse({'success': True, 'permissions': _get_all_role_permissions()})

        # دعم حفظ كل الأدوار دفعة واحدة: {"permissions": {"M01": [...], ...}}
        all_perms = data.get('permissions')
        if isinstance(all_perms, dict):
            for role, pages in all_perms.items():
                if isinstance(pages, list):
                    RolePagePermission.objects.update_or_create(
                        role=role,
                        defaults={'pages': pages, 'updated_by': caller, 'updated_at': timezone.now()},
                    )
            AuditLog.log('perm_update_bulk', request=request,
                         detail=f'تحديث صلاحيات {len(all_perms)} دور')
            return JsonResponse({'success': True, 'permissions': _get_all_role_permissions()})

        return JsonResponse({'success': False, 'message': 'البيانات غير صالحة'}, status=400)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)
