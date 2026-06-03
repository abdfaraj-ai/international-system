"""
Supervisor API — صفحة مشرف التلر (M02)
══════════════════════════════════════════════════════════════════
# أسعار الصرف
GET/POST        /api/sv2/rates              ← عرض وتحديث الأسعار

# أرصدة الصناديق
GET             /api/sv2/balances           ← أرصدة كل الصناديق
POST            /api/sv2/balances           ← تعيين/إضافة رصيد لتلر

# قائمة التلرات
GET             /api/sv2/tellers            ← قائمة التلرات
POST            /api/sv2/tellers            ← إضافة تلر جديد
GET/PATCH/DELETE /api/sv2/tellers/<username>
POST            /api/sv2/tellers/<username>/password

# صلاحيات التلرات
GET             /api/sv2/permissions        ← كل الصلاحيات
GET/PATCH       /api/sv2/permissions/<username>

# طلبات التلرات
GET             /api/sv2/requests           ← كل الطلبات (فلتر بالحالة)
PATCH           /api/sv2/requests/<id>      ← الرد على طلب

# عمليات التلرات (سجل)
GET             /api/sv2/operations         ← جميع عمليات التلرات

# التقارير
GET/POST        /api/sv2/reports

# إحصائيات
GET             /api/sv2/stats
"""
import json
import datetime
from decimal import Decimal, InvalidOperation
from django.http        import JsonResponse
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils       import timezone
from django.db          import transaction
from django.db.models   import Q, Sum, F, OuterRef, Subquery
from django.db.models.functions import Coalesce

from ..models import (
    SystemUser, TellerProfile, TellerBalance, TellerPermission,
    TellerRequest, ExchangeRate, ExchangeOperation, HawalaOperation,
    CashTransaction, SupervisorReport, AdminInstruction,
    SupervisorBox, SupervisorBoxLog, TellerSession,
)
from core.permissions import require_roles as _require_roles, parse_json as _parse_raw, caller_name as _caller


# ─── local alias ──────────────────────────────────────────────────────────────

def _parse(request):
    data, _ = _parse_raw(request)
    return data or {}


# ═══════════════════════════════════════════════════════════════════════════════
# 1. إحصائيات — GET /api/sv2/stats
# ═══════════════════════════════════════════════════════════════════════════════

def api_sv2_stats(request):
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    tellers_count  = TellerProfile.objects.count()
    online_count   = TellerProfile.objects.filter(status='online').count()
    pending_reqs   = TellerRequest.objects.filter(status='pending').count()

    exchange_today = ExchangeOperation.objects.filter(created_at__gte=today_start).count()
    hawala_today   = HawalaOperation.objects.filter(created_at__gte=today_start).count()
    cash_today     = CashTransaction.objects.filter(created_at__gte=today_start).count()

    # آخر نشر للأسعار
    rate_record = ExchangeRate.objects.order_by('-created_at').first()

    return JsonResponse({
        'success':      True,
        'tellersCount': tellers_count,
        'onlineCount':  online_count,
        'pendingReqs':  pending_reqs,
        'opsToday':     exchange_today + hawala_today + cash_today,
        'exchangeToday': exchange_today,
        'hawalaToday':  hawala_today,
        'cashToday':    cash_today,
        'ratesLastUpdate': rate_record.created_at.isoformat() if rate_record else None,
        'ratesSetBy':   rate_record.set_by if rate_record else '',
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 2. أسعار الصرف — GET/POST /api/sv2/rates
# ═══════════════════════════════════════════════════════════════════════════════

def api_sv2_rates(request):
    err = _require_roles(request, 'M02', 'M03', 'M01')
    if err:
        return err

    # نوع الأسعار: teller (للصرافة) أو hawala (للحوالات) — افتراضي teller
    rate_type = request.GET.get('type', 'teller') if request.method == 'GET' else None

    if request.method == 'GET':
        if rate_type not in ('teller', 'hawala'):
            rate_type = 'teller'
        record = ExchangeRate.objects.filter(rate_type=rate_type).order_by('-created_at').first()
        if not record:
            return JsonResponse({'success': True, 'rates': {}, 'setBy': '', 'setAt': None, 'rateType': rate_type})
        return JsonResponse({
            'success':  True,
            'rates':    record.rates_json,
            'setBy':    record.set_by,
            'setAt':    record.created_at.isoformat(),
            'rateType': record.rate_type,
        })

    if request.method == 'POST':
        data  = _parse(request)
        rates = data.get('rates')
        if not rates or not isinstance(rates, dict):
            return JsonResponse({'success': False, 'message': 'بيانات الأسعار مطلوبة'}, status=400)

        rate_type = data.get('rate_type', 'teller')
        if rate_type not in ('teller', 'hawala'):
            rate_type = 'teller'

        record = ExchangeRate.objects.create(
            rate_type  = rate_type,
            set_by     = _caller(request),
            rates_json = rates,
        )

        # إبقاء آخر 30 سجلاً لكل نوع فقط
        old_ids = list(
            ExchangeRate.objects.filter(rate_type=rate_type)
            .order_by('-created_at').values_list('id', flat=True)[30:]
        )
        if old_ids:
            ExchangeRate.objects.filter(id__in=old_ids).delete()

        # WebSocket: أسعار التلر → تصل لجميع التلرات | أسعار الحوالات → تصل للمشرفين فقط
        try:
            if rate_type == 'teller':
                from ..ws_utils import broadcast_rates
                broadcast_rates(record.rates_json)
            else:
                from ..ws_utils import broadcast_voice_rates
                broadcast_voice_rates({'success': True, **record.rates_json, 'operator': record.set_by})
        except Exception:
            pass

        return JsonResponse({
            'success':  True,
            'rates':    record.rates_json,
            'setBy':    record.set_by,
            'setAt':    record.created_at.isoformat(),
            'rateType': record.rate_type,
        }, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. أرصدة الصناديق — GET/POST /api/sv2/balances
# ═══════════════════════════════════════════════════════════════════════════════

def api_sv2_balances(request):
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err

    if request.method == 'GET':
        # subquery: آخر سجل رصيد لكل تلر — استعلام واحد بدلاً من N
        latest_id = (
            TellerBalance.objects
            .filter(teller_username=OuterRef('username'))
            .order_by('-created_at')
            .values('id')[:1]
        )
        tellers = TellerProfile.objects.annotate(
            latest_balance_id=Subquery(latest_id)
        )

        balance_map = {
            b.id: b
            for b in TellerBalance.objects.filter(
                id__in=[t.latest_balance_id for t in tellers if t.latest_balance_id]
            )
        }

        result = []
        for tp in tellers:
            bal = balance_map.get(tp.latest_balance_id)
            result.append({
                'teller':   tp.username,
                'name':     tp.name,
                'status':   tp.status,
                'usd':      float(bal.usd)  if bal else 0,
                'ils':      float(bal.ils)  if bal else 0,
                'jod':      float(bal.jod)  if bal else 0,
                'setBy':    bal.set_by if bal else '',
                'setAt':    bal.created_at.isoformat() if bal else None,
            })
        return JsonResponse({'success': True, 'balances': result})

    if request.method == 'POST':
        data     = _parse(request)
        username = data.get('teller', '').strip()
        if not username:
            return JsonResponse({'success': False, 'message': 'اسم المستخدم مطلوب'}, status=400)

        def _to_dec(v):
            try:
                return Decimal(str(v)) if v not in (None, '', False) else Decimal('0')
            except (InvalidOperation, ValueError, TypeError):
                return None

        usd = _to_dec(data.get('usd') or data.get('USD') or 0)
        ils = _to_dec(data.get('ils') or data.get('ILS') or 0)
        jod = _to_dec(data.get('jod') or data.get('JOD') or 0)
        if usd is None or ils is None or jod is None:
            return JsonResponse({'success': False, 'message': 'قيم الرصيد غير صالحة'}, status=400)

        action = data.get('action', 'set')
        if action not in ('set', 'add'):
            action = 'set'

        MAX_BALANCE = Decimal('10000000')
        if usd > MAX_BALANCE or ils > MAX_BALANCE or jod > MAX_BALANCE:
            return JsonResponse({'success': False, 'message': 'القيمة تتجاوز الحد الأقصى المسموح'}, status=400)

        with transaction.atomic():
            # إذا إضافة، اجمع مع الرصيد الحالي — بـ select_for_update لمنع race condition
            if action == 'add':
                prev = (TellerBalance.objects
                        .select_for_update()
                        .filter(teller_username=username)
                        .order_by('-created_at')
                        .first())
                if prev:
                    usd += prev.usd
                    ils += prev.ils
                    jod += prev.jod

            name = data.get('name', '')
            if not name:
                tp = TellerProfile.objects.filter(username=username).first()
                if tp:
                    name = tp.name

            record = TellerBalance.objects.create(
                teller_username = username,
                teller_name     = name,
                usd             = usd,
                ils             = ils,
                jod             = jod,
                action          = action,
                set_by          = _caller(request),
                session_id      = data.get('sessionId', ''),
            )

            # أنشئ جلسة pending للتلر إذا لم تكن هناك جلسة مفتوحة
            active = TellerSession.objects.filter(
                teller_username=username,
                status__in=['pending', 'open']
            ).first()
            if not active:
                import secrets as _sec
                while True:
                    sid = f'SES-{timezone.now().strftime("%y%m%d")}-{_sec.randbelow(9000)+1000}'
                    if not TellerSession.objects.filter(session_id=sid).exists():
                        break
                TellerSession.objects.create(
                    session_id      = sid,
                    teller_username = username,
                    teller_name     = name,
                    opened_by       = _caller(request),
                    status          = 'pending',
                    opening_usd     = usd,
                    opening_ils     = ils,
                    opening_jod     = jod,
                )

        # ── أبلغ التلر فوراً عبر WebSocket ──────────────────────────────────────
        try:
            from ..ws_utils import broadcast_box_opened
            # اجلب الجلسة الحالية (قد تكون الجديدة أو الموجودة مسبقاً)
            current_session = TellerSession.objects.filter(
                teller_username=username,
                status__in=['pending', 'open']
            ).order_by('-created_at').first()
            broadcast_box_opened(username, {
                'usd':       float(usd),
                'ils':       float(ils),
                'jod':       float(jod),
                'setBy':     _caller(request),
                'sessionId': current_session.session_id if current_session else '',
                'supervisorName': _caller(request),
                'time':      timezone.now().strftime('%H:%M'),
            })
        except Exception:
            pass

        return JsonResponse({'success': True, 'balance': record.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. قائمة التلرات — GET/POST /api/sv2/tellers
# ═══════════════════════════════════════════════════════════════════════════════

def api_sv2_tellers(request):
    if request.method == 'GET':
        err = _require_roles(request, 'M02', 'M01')
        if err:
            return err
        tellers = TellerProfile.objects.all()
        return JsonResponse({
            'success': True,
            'tellers': [t.to_dict() for t in tellers],
        })

    if request.method == 'POST':
        # إنشاء تلر جديد — المشرف أو الإدارة
        err = _require_roles(request, 'M02', 'M01')
        if err:
            return err
        data = _parse(request)
        username = data.get('username', '').strip()
        name     = data.get('name', '').strip()
        password = data.get('password', '').strip()

        if not username or not name or not password:
            return JsonResponse({'success': False, 'message': 'الاسم واسم المستخدم وكلمة المرور مطلوبة'}, status=400)

        if SystemUser.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': 'اسم المستخدم مستخدم مسبقاً'}, status=400)

        try:
            validate_password(password)
        except DjangoValidationError as e:
            return JsonResponse({'success': False, 'message': ' | '.join(e.messages)}, status=400)

        # توليد معرف التلر التلقائي
        last = TellerProfile.objects.order_by('-teller_id').first()
        teller_id = 'T001'
        if last:
            try:
                num = int(last.teller_id[1:]) + 1
                teller_id = f'T{num:03d}'
            except (ValueError, IndexError):
                pass

        # إنشاء مستخدم Django
        user = SystemUser.objects.create(
            username   = username,
            first_name = name,
            role       = 'T01',
            password   = make_password(password),
        )

        # إنشاء ملف التلر
        profile = TellerProfile.objects.create(
            teller_id = teller_id,
            name      = name,
            username  = username,
            phone     = data.get('phone', ''),
            status    = 'offline',
        )

        # إنشاء صلاحيات افتراضية
        TellerPermission.objects.create(
            teller_username = username,
            updated_by      = _caller(request),
        )

        return JsonResponse({'success': True, 'teller': profile.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


def api_sv2_teller_detail(request, username):
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err

    try:
        profile = TellerProfile.objects.get(username=username)
    except TellerProfile.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التلر غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'teller': profile.to_dict()})

    if request.method == 'PATCH':
        data = _parse(request)
        if 'name' in data:
            profile.name      = data['name']
        if 'phone' in data:
            profile.phone     = data['phone']
        if 'status' in data and data['status'] in ('online', 'offline', 'busy'):
            profile.status    = data['status']
        if 'balance' in data:
            try: profile.balance = float(data['balance'])
            except (ValueError, TypeError): pass
        if 'ops' in data:
            try: profile.ops = int(data['ops'])
            except (ValueError, TypeError): pass
        if 'loginTime' in data:
            profile.login_time = str(data['loginTime'])[:20]
        if 'lastOp' in data:
            profile.last_op   = str(data['lastOp'])[:20]
        profile.save()

        # تحديث اسم المستخدم الأول إن تغيّر
        try:
            user = SystemUser.objects.get(username=username)
            if 'name' in data:
                user.first_name = data['name']
                user.save()
        except SystemUser.DoesNotExist:
            pass

        return JsonResponse({'success': True, 'teller': profile.to_dict()})

    if request.method == 'DELETE':
        try:
            user = SystemUser.objects.get(username=username)
            user.is_active = False
            user.save()
        except SystemUser.DoesNotExist:
            pass
        profile.delete()
        return JsonResponse({'success': True})

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


def api_sv2_teller_password(request, username):
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    data     = _parse(request)
    new_pass = data.get('password', '').strip()
    if not new_pass:
        return JsonResponse({'success': False, 'message': 'كلمة المرور مطلوبة'}, status=400)

    try:
        user = SystemUser.objects.get(username=username, role='T01')
    except SystemUser.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التلر غير موجود'}, status=404)

    try:
        validate_password(new_pass, user=user)
    except DjangoValidationError as e:
        return JsonResponse({'success': False, 'message': ' | '.join(e.messages)}, status=400)

    user.password = make_password(new_pass)
    user.save()
    return JsonResponse({'success': True})


# ═══════════════════════════════════════════════════════════════════════════════
# 5. صلاحيات التلرات — GET/PATCH /api/sv2/permissions[/<username>]
# ═══════════════════════════════════════════════════════════════════════════════

def api_sv2_permissions(request):
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    perms = TellerPermission.objects.all()
    return JsonResponse({'success': True, 'permissions': [p.to_dict() for p in perms]})


def api_sv2_permission_detail(request, username):
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err

    perm, _ = TellerPermission.objects.get_or_create(
        teller_username=username,
        defaults={'updated_by': _caller(request)},
    )

    if request.method == 'GET':
        return JsonResponse({'success': True, 'permissions': perm.to_dict()})

    if request.method == 'PATCH':
        data = _parse(request)
        bool_fields = {
            'exchange':      'exchange',
            'international': 'international',
            'electronic':    'electronic',
            'accounts':      'accounts',
            'specialPrice':  'special_price',
            'doubleDelivery': 'double_delivery',
        }
        for key, attr in bool_fields.items():
            if key in data:
                setattr(perm, attr, bool(data[key]))
        perm.updated_by = _caller(request)
        perm.updated_at = timezone.now()
        perm.save()
        return JsonResponse({'success': True, 'permissions': perm.to_dict()})

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 6. طلبات التلرات — GET /api/sv2/requests   PATCH /api/sv2/requests/<id>
# ═══════════════════════════════════════════════════════════════════════════════

def api_sv2_requests(request):
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    qs = TellerRequest.objects.all()
    # يقبل ?status= أو ?filter= (من الفرونت اند القديم والجديد)
    status_filter = request.GET.get('status') or request.GET.get('filter', '')
    if status_filter and status_filter not in ('all', ''):
        qs = qs.filter(status=status_filter)

    qs = qs.order_by('-created_at')
    try:
        page      = max(1, int(request.GET.get('page', 1)))
        page_size = min(100, max(1, int(request.GET.get('pageSize', 50))))
    except (ValueError, TypeError):
        page, page_size = 1, 50

    total = qs.count()
    items = qs[(page - 1) * page_size: page * page_size]

    return JsonResponse({
        'success':  True,
        'total':    total,
        'page':     page,
        'pageSize': page_size,
        'requests': [r.to_dict() for r in items],
    })


def api_sv2_request_detail(request, request_id):
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err
    if request.method != 'PATCH':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    try:
        req = TellerRequest.objects.get(request_id=request_id)
    except TellerRequest.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الطلب غير موجود'}, status=404)

    data   = _parse(request)
    status = data.get('status')
    if status not in ('approved', 'rejected', 'resolved'):
        return JsonResponse({'success': False, 'message': 'الحالة غير صالحة'}, status=400)

    teller_username = req.teller_name
    req.status      = status
    req.reply       = data.get('reply', '')
    req.resolved_by = _caller(request)
    req.resolved_at = timezone.now()
    req.save()

    req_dict = req.to_dict()
    try:
        from ..ws_utils import broadcast_teller_response
        broadcast_teller_response(teller_username, req_dict)
    except Exception:
        pass

    return JsonResponse({'success': True, 'request': req_dict})


# ═══════════════════════════════════════════════════════════════════════════════
# 7. سجل عمليات التلرات — GET /api/sv2/operations
# ═══════════════════════════════════════════════════════════════════════════════

def api_sv2_operations(request):
    """عرض جميع عمليات التلرات: صرافة + حوالات + سحب/إيداع"""
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    op_type  = request.GET.get('type', '').strip()  # exchange | hawala | cash
    teller   = request.GET.get('teller', '').strip()
    date     = request.GET.get('date', '').strip()

    try:
        page      = max(1, int(request.GET.get('page', 1)))
        page_size = min(100, max(1, int(request.GET.get('pageSize', 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    if op_type not in ('', 'exchange', 'hawala', 'cash'):
        return JsonResponse({'success': False, 'message': 'نوع العملية غير صالح'}, status=400)

    def _apply_filters(qs, operator_field='operator'):
        if teller:
            qs = qs.filter(**{operator_field: teller})
        if date:
            try:
                d = datetime.date.fromisoformat(date)
                qs = qs.filter(created_at__date=d)
            except ValueError:
                pass
        return qs.order_by('-created_at')

    # عند طلب نوع واحد فقط — ترقيم مباشر على DB (أسرع بكثير)
    if op_type == 'exchange':
        qs    = _apply_filters(ExchangeOperation.objects.all())
        total = qs.count()
        items = qs[(page-1)*page_size : page*page_size]
        ops   = [{'type':'exchange','id':op.id,'fromCurrency':op.from_currency,
                  'toCurrency':op.to_currency,'amount':op.amount,'result':op.result,
                  'rate':op.rate,'operator':op.operator,'createdAt':op.created_at.isoformat()}
                 for op in items]
        return JsonResponse({'success':True,'total':total,'page':page,'pageSize':page_size,'items':ops})

    if op_type == 'hawala':
        qs    = _apply_filters(HawalaOperation.objects.all())
        total = qs.count()
        items = qs[(page-1)*page_size : page*page_size]
        ops   = [{'type':'hawala','id':op.id,'senderName':op.sender_name,
                  'receiverName':op.receiver_name,'amount':op.amount,'currency':op.currency,
                  'destination':op.destination,'operator':op.operator,'status':op.status,
                  'createdAt':op.created_at.isoformat()}
                 for op in items]
        return JsonResponse({'success':True,'total':total,'page':page,'pageSize':page_size,'items':ops})

    if op_type == 'cash':
        qs    = _apply_filters(CashTransaction.objects.all())
        total = qs.count()
        items = qs[(page-1)*page_size : page*page_size]
        ops   = [{'type':'cash','id':op.id,'txnType':op.transaction_type,
                  'clientName':op.client_name,'amount':op.amount,'currency':op.currency,
                  'operator':op.operator,'createdAt':op.created_at.isoformat()}
                 for op in items]
        return JsonResponse({'success':True,'total':total,'page':page,'pageSize':page_size,'items':ops})

    # الكل: نجلب آخر DB_CAP سجل من كل نوع لتجنب تحميل الذاكرة بالكامل
    DB_CAP = page * page_size + 200   # كافٍ لأي صفحة مطلوبة + هامش

    ops = []

    qs = _apply_filters(ExchangeOperation.objects.all())
    for op in qs[:DB_CAP]:
        ops.append({
            'type':         'exchange',
            'id':           op.id,
            'fromCurrency': op.from_currency,
            'toCurrency':   op.to_currency,
            'amount':       op.amount,
            'result':       op.result,
            'rate':         op.rate,
            'operator':     op.operator,
            'createdAt':    op.created_at.isoformat(),
        })

    qs = _apply_filters(HawalaOperation.objects.all())
    for op in qs[:DB_CAP]:
        ops.append({
            'type':         'hawala',
            'id':           op.id,
            'senderName':   op.sender_name,
            'receiverName': op.receiver_name,
            'amount':       op.amount,
            'currency':     op.currency,
            'destination':  op.destination,
            'operator':     op.operator,
            'status':       op.status,
            'createdAt':    op.created_at.isoformat(),
        })

    qs = _apply_filters(CashTransaction.objects.all())
    for op in qs[:DB_CAP]:
        ops.append({
            'type':        'cash',
            'id':          op.id,
            'txnType':     op.transaction_type,
            'clientName':  op.client_name,
            'amount':      op.amount,
            'currency':    op.currency,
            'operator':    op.operator,
                'createdAt':   op.created_at.isoformat(),
            })

    # فرز وترقيم
    ops.sort(key=lambda x: x['createdAt'], reverse=True)
    total = len(ops)
    ops   = ops[(page - 1) * page_size: page * page_size]

    return JsonResponse({
        'success':  True,
        'total':    total,
        'page':     page,
        'pageSize': page_size,
        'items':    ops,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 8. تقارير مشرف التلر — GET/POST /api/sv2/reports
# ═══════════════════════════════════════════════════════════════════════════════

def api_sv2_reports(request):
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err

    caller = _caller(request)

    if request.method == 'GET':
        role = request.user.role
        if role == 'M01':
            qs = SupervisorReport.objects.filter(page='tellerMgr')
        else:
            qs = SupervisorReport.objects.filter(page='tellerMgr', submitted_by=caller)

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
        data  = _parse(request)
        title = data.get('title', '').strip()
        body  = data.get('body', '').strip()
        if not title or not body:
            return JsonResponse({'success': False, 'message': 'العنوان والمحتوى مطلوبان'}, status=400)

        r = SupervisorReport.objects.create(
            page         = 'tellerMgr',
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


# ══════════════════════════════════════════════════════════════════════════════
# التعليمات الإدارية (M01 → M02)
# ══════════════════════════════════════════════════════════════════════════════

def api_sv2_instructions(request):
    """
    GET  /api/sv2/instructions  ← المشرف يطّلع على التعليمات الموجّهة له
    POST /api/sv2/instructions  ← الإدارة (M01) تُنشئ تعليمة جديدة
    """
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err

    if request.method == 'GET':
        role = request.user.role
        if role == 'M01':
            qs = AdminInstruction.objects.all().order_by('-created_at')
        else:
            uname = request.user.username
            qs = AdminInstruction.objects.filter(
                Q(target_role='M02') | Q(target_role='') |
                Q(target_user=uname)
            ).order_by('-created_at')

        return JsonResponse({
            'success': True,
            'instructions': [
                {
                    'id':        instr.id,
                    'title':     instr.title,
                    'body':      instr.body,
                    'priority':  instr.priority,
                    'isRead':    request.user.username in (instr.read_by or ''),
                    'createdBy': instr.created_by,
                    'createdAt': instr.created_at.isoformat(),
                }
                for instr in qs
            ],
        })

    if request.method == 'POST':
        err2 = _require_roles(request, 'M01')
        if err2:
            return err2
        data  = _parse(request)
        title = data.get('title', '').strip()
        body  = data.get('body', '').strip()
        if not title or not body:
            return JsonResponse({'success': False, 'message': 'العنوان والمحتوى مطلوبان'}, status=400)

        instr = AdminInstruction.objects.create(
            title       = title,
            body        = body,
            priority    = data.get('priority', 'normal'),
            target_role = data.get('targetRole', 'M02'),
            created_by  = _caller(request),
        )
        return JsonResponse({
            'success': True,
            'instruction': {
                'id':        instr.id,
                'title':     instr.title,
                'priority':  instr.priority,
                'createdAt': instr.created_at.isoformat(),
            },
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_sv2_instruction_read(request, instr_id):
    """PATCH /api/sv2/instructions/<id>/read — تمييز التعليمة كمقروءة"""
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err
    if request.method != 'PATCH':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)

    try:
        instr = AdminInstruction.objects.get(pk=instr_id)
    except AdminInstruction.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التعليمة غير موجودة'}, status=404)

    # read_by is a comma-separated CharField
    existing = set(filter(None, (instr.read_by or '').split(',')))
    existing.add(request.user.username)
    instr.read_by = ','.join(existing)
    instr.is_read = True
    instr.read_at = timezone.now()
    instr.save()

    return JsonResponse({'success': True, 'message': 'تم التمييز كمقروء'})


# ══════════════════════════════════════════════════════════════════════════════
# صندوق المشرف — M02 يوزع على تلراته ويسترد في نهاية اليوم
# GET  /api/sv2/my-box                ← رصيد صندوق المشرف الحالي
# POST /api/sv2/my-box/distribute     ← توزيع مبلغ على تلر (يخصم من صندوق المشرف)
# POST /api/sv2/my-box/reclaim        ← استرداد رصيد تلر لصندوق المشرف (نهاية اليوم)
# GET  /api/sv2/my-box/log            ← سجل حركات الصندوق
# ══════════════════════════════════════════════════════════════════════════════

def api_sv2_my_box(request):
    """GET /api/sv2/my-box — رصيد صندوق المشرف"""
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err

    username = request.user.username
    sup = request.user
    box, _ = SupervisorBox.objects.get_or_create(
        supervisor_username=username,
        defaults={'supervisor_name': sup.get_full_name() or username}
    )
    return JsonResponse({'success': True, 'box': box.to_dict()})


def api_sv2_box_distribute(request):
    """POST /api/sv2/my-box/distribute — المشرف يوزع مبلغاً على تلر من صندوقه"""
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'POST فقط'}, status=405)

    data     = _parse_raw(request)
    teller   = (data.get('teller') or '').strip()
    currency = (data.get('currency') or 'USD').upper().strip()
    try:
        amount = Decimal(str(data.get('amount', 0)))
    except InvalidOperation:
        return JsonResponse({'success': False, 'message': 'مبلغ غير صالح'}, status=400)

    if not teller:
        return JsonResponse({'success': False, 'message': 'حدد التلر'}, status=400)
    if currency not in ('USD', 'ILS', 'JOD'):
        return JsonResponse({'success': False, 'message': 'عملة غير صالحة'}, status=400)
    if amount <= 0:
        return JsonResponse({'success': False, 'message': 'المبلغ يجب أن يكون أكبر من صفر'}, status=400)

    supervisor_username = request.user.username

    with transaction.atomic():
        box = SupervisorBox.objects.select_for_update().get_or_create(
            supervisor_username=supervisor_username,
            defaults={'supervisor_name': request.user.get_full_name() or supervisor_username}
        )[0]

        field        = f'balance_{currency.lower()}'
        box_balance  = getattr(box, field)

        if box_balance < amount:
            return JsonResponse({
                'success': False,
                'message': f'رصيد غير كافٍ في صندوقك — المتاح: {box_balance:.2f} {currency}'
            }, status=400)

        # خصم من صندوق المشرف
        new_box_balance = box_balance - amount
        setattr(box, field, new_box_balance)
        box.save()

        # إضافة لصندوق التلر
        last = TellerBalance.objects.filter(teller_username=teller).first()
        teller_name = ''
        cur_usd = cur_ils = cur_jod = Decimal('0')
        if last:
            cur_usd  = last.usd
            cur_ils  = last.ils
            cur_jod  = last.jod
            teller_name = last.teller_name

        if currency == 'USD':
            cur_usd += amount
        elif currency == 'ILS':
            cur_ils += amount
        else:
            cur_jod += amount

        TellerBalance.objects.create(
            teller_username=teller,
            teller_name=teller_name,
            usd=cur_usd, ils=cur_ils, jod=cur_jod,
            action='add',
            set_by=supervisor_username,
        )

        # سجل حركة الصندوق
        SupervisorBoxLog.objects.create(
            supervisor_username=supervisor_username,
            op_type='distribute',
            currency=currency,
            amount=amount,
            balance_after=new_box_balance,
            teller_username=teller,
            notes=data.get('notes', ''),
            created_by=supervisor_username,
        )

    return JsonResponse({'success': True, 'box': box.to_dict()})


def api_sv2_box_reclaim(request):
    """POST /api/sv2/my-box/reclaim — المشرف يسترد رصيد تلر لصندوقه (نهاية اليوم)"""
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'POST فقط'}, status=405)

    data     = _parse_raw(request)
    teller   = (data.get('teller') or '').strip()
    currency = (data.get('currency') or 'USD').upper().strip()

    # إذا لم يُحدَّد مبلغ، نسترد كل الرصيد
    amount_raw = data.get('amount')
    amount = None
    if amount_raw is not None:
        try:
            amount = Decimal(str(amount_raw))
        except InvalidOperation:
            return JsonResponse({'success': False, 'message': 'مبلغ غير صالح'}, status=400)

    if not teller:
        return JsonResponse({'success': False, 'message': 'حدد التلر'}, status=400)
    if currency not in ('USD', 'ILS', 'JOD'):
        return JsonResponse({'success': False, 'message': 'عملة غير صالحة'}, status=400)

    supervisor_username = request.user.username

    with transaction.atomic():
        # الرصيد الحالي للتلر
        last = TellerBalance.objects.filter(teller_username=teller).first()
        if not last:
            return JsonResponse({'success': False, 'message': 'لا يوجد رصيد لهذا التلر'}, status=404)

        cur_usd  = last.usd
        cur_ils  = last.ils
        cur_jod  = last.jod
        teller_name = last.teller_name

        if currency == 'USD':
            reclaim_amount = amount if amount is not None else cur_usd
            if reclaim_amount > cur_usd:
                return JsonResponse({'success': False, 'message': f'رصيد التلر {cur_usd:.2f} USD أقل من المطلوب'}, status=400)
            cur_usd -= reclaim_amount
        elif currency == 'ILS':
            reclaim_amount = amount if amount is not None else cur_ils
            if reclaim_amount > cur_ils:
                return JsonResponse({'success': False, 'message': f'رصيد التلر {cur_ils:.2f} ILS أقل من المطلوب'}, status=400)
            cur_ils -= reclaim_amount
        else:
            reclaim_amount = amount if amount is not None else cur_jod
            if reclaim_amount > cur_jod:
                return JsonResponse({'success': False, 'message': f'رصيد التلر {cur_jod:.2f} JOD أقل من المطلوب'}, status=400)
            cur_jod -= reclaim_amount

        # تحديث صندوق التلر
        TellerBalance.objects.create(
            teller_username=teller,
            teller_name=teller_name,
            usd=cur_usd, ils=cur_ils, jod=cur_jod,
            action='set',
            set_by=supervisor_username,
        )

        # إضافة للصندوق المشرف
        box = SupervisorBox.objects.select_for_update().get_or_create(
            supervisor_username=supervisor_username,
            defaults={'supervisor_name': request.user.get_full_name() or supervisor_username}
        )[0]

        field = f'balance_{currency.lower()}'
        new_box_balance = getattr(box, field) + reclaim_amount
        setattr(box, field, new_box_balance)
        box.save()

        SupervisorBoxLog.objects.create(
            supervisor_username=supervisor_username,
            op_type='reclaim',
            currency=currency,
            amount=reclaim_amount,
            balance_after=new_box_balance,
            teller_username=teller,
            notes=data.get('notes', ''),
            created_by=supervisor_username,
        )

    return JsonResponse({'success': True, 'box': box.to_dict()})


def api_sv2_box_log(request):
    """GET /api/sv2/my-box/log — سجل حركات صندوق المشرف"""
    err = _require_roles(request, 'M02', 'M01')
    if err:
        return err

    logs = SupervisorBoxLog.objects.filter(
        supervisor_username=request.user.username
    ).order_by('-created_at')[:100]
    return JsonResponse({'success': True, 'log': [l.to_dict() for l in logs]})
