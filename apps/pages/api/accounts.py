"""
Accounts API — صفحة التحويل البنكي (T02)
══════════════════════════════════════════════════════════════════
GET/POST        /api/bk/transfers                ← كل التحويلات البنكية
PATCH/DELETE    /api/bk/transfers/<id>           ← تعديل/حذف
POST            /api/bk/transfers/<id>/complete  ← تنفيذ الحوالة
POST            /api/bk/transfers/<id>/reject    ← رفض الحوالة
GET             /api/bk/stats                    ← إحصائيات اليوم
GET/POST        /api/bk/reports                  ← تقارير موظف T02
"""
import json
import datetime
from decimal import Decimal, InvalidOperation
from django.http        import JsonResponse
from django.utils       import timezone
from django.db.models   import Q, Count, Sum

from ..models import (
    SystemUser, BankTransfer, SupervisorReport, AuditLog,
)
from core.permissions import require_roles as _require_roles, parse_json as _parse_raw, caller_name as _caller


# ─── local alias ──────────────────────────────────────────────────────────────

def _parse(request):
    data, _ = _parse_raw(request)
    return data or {}


# ═══════════════════════════════════════════════════════════════════════════════
# 1. إحصائيات اليوم — GET /api/bk/stats
# ═══════════════════════════════════════════════════════════════════════════════

def api_bk_stats(request):
    """إحصائيات التحويلات البنكية لليوم الحالي"""
    err = _require_roles(request, 'T02', 'M01', 'M02')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    qs_today = BankTransfer.objects.filter(created_at__gte=today_start)
    qs_all   = BankTransfer.objects.all()

    def _counts(qs):
        return {
            'total':     qs.count(),
            'pending':   qs.filter(status='pending').count(),
            'completed': qs.filter(status='completed').count(),
            'cancelled': qs.filter(status='cancelled').count(),
            'rejected':  qs.filter(status='rejected').count(),
        }

    def _amounts(qs):
        totals = {}
        for currency in ['USD', 'ILS', 'JOD', 'EUR', 'GBP']:
            agg = qs.filter(currency=currency, status='completed').aggregate(s=Sum('amount'))
            totals[currency] = agg['s'] or 0
        return totals

    # تفصيل حسب النوع
    type_breakdown = {}
    for ttype in ['incoming', 'outgoing', 'buy', 'sell']:
        type_breakdown[ttype] = {
            'today': qs_today.filter(transfer_type=ttype).count(),
            'total': qs_all.filter(transfer_type=ttype).count(),
        }

    return JsonResponse({
        'success': True,
        'today':  _counts(qs_today),
        'all':    _counts(qs_all),
        'completedAmounts': _amounts(qs_today),
        'byType': type_breakdown,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# 2. قائمة التحويلات البنكية — GET/POST /api/bk/transfers
# ═══════════════════════════════════════════════════════════════════════════════

def api_bk_transfers(request):
    err = _require_roles(request, 'T02', 'M01', 'M02')
    if err:
        return err

    # ── GET: عرض القائمة ──────────────────────────────────────────────────────
    if request.method == 'GET':
        qs = BankTransfer.objects.all()
        # T02 يرى فقط التحويلات التي أنشأها هو
        if getattr(request.user, 'role', '') == 'T02':
            qs = qs.filter(created_by=request.user.username)

        # فلاتر
        status = request.GET.get('status')        # pending | completed | cancelled | rejected
        ttype  = request.GET.get('type')          # incoming | outgoing | buy | sell
        q      = request.GET.get('q', '').strip() # بحث نصي
        date   = request.GET.get('date')          # YYYY-MM-DD
        currency = request.GET.get('currency')

        VALID_STATUSES = ('pending', 'processing', 'completed', 'rejected', 'cancelled')
        if status:
            if status not in VALID_STATUSES:
                return JsonResponse({'success': False, 'message': 'حالة غير صالحة'}, status=400)
            qs = qs.filter(status=status)
        if ttype:
            qs = qs.filter(transfer_type=ttype)
        if currency:
            qs = qs.filter(currency=currency)
        if q:
            qs = qs.filter(
                Q(ref_number__icontains=q) |
                Q(sender_name__icontains=q) |
                Q(receiver_name__icontains=q) |
                Q(bank_name__icontains=q) |
                Q(account_number__icontains=q) |
                Q(iban__icontains=q)
            )
        if date:
            try:
                d = datetime.date.fromisoformat(date)
                qs = qs.filter(created_at__date=d)
            except ValueError:
                pass

        # ترقيم الصفحات
        try:
            page      = max(1, int(request.GET.get('page', 1)))
            page_size = min(200, max(1, int(request.GET.get('pageSize', 20))))
        except (ValueError, TypeError):
            page, page_size = 1, 20
        total     = qs.count()
        qs        = qs[(page - 1) * page_size: page * page_size]

        return JsonResponse({
            'success': True,
            'total':   total,
            'page':    page,
            'pageSize': page_size,
            'items':   [t.to_dict() for t in qs],
        })

    # ── POST: إنشاء تحويل جديد ─────────────────────────────────────────────
    if request.method == 'POST':
        data = _parse(request)

        required = ['transferType', 'amount', 'currency']
        for f in required:
            if not data.get(f):
                return JsonResponse({'success': False, 'message': f'الحقل مطلوب: {f}'}, status=400)

        transfer_type = data['transferType']
        if transfer_type not in ('incoming', 'outgoing', 'buy', 'sell'):
            return JsonResponse({'success': False, 'message': 'نوع التحويل غير صالح'}, status=400)

        try:
            amount = Decimal(str(data['amount']))
        except (InvalidOperation, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'المبلغ غير صالح'}, status=400)

        MAX_AMOUNT = Decimal('10000000')
        if amount <= 0:
            return JsonResponse({'success': False, 'message': 'المبلغ يجب أن يكون أكبر من صفر'}, status=400)
        if amount > MAX_AMOUNT:
            return JsonResponse({'success': False, 'message': f'المبلغ يتجاوز الحد الأقصى (10,000,000)'}, status=400)

        VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP')
        currency = data.get('currency', 'USD').upper()
        if currency not in VALID_CURRENCIES:
            return JsonResponse({'success': False, 'message': 'عملة غير مدعومة'}, status=400)

        try:
            exchange_rate = Decimal(str(data.get('exchangeRate', 1)))
            if exchange_rate <= 0 or exchange_rate > 10000:
                raise ValueError
        except (InvalidOperation, ValueError, TypeError):
            return JsonResponse({'success': False, 'message': 'سعر الصرف غير صالح'}, status=400)

        t = BankTransfer(
            transfer_type  = transfer_type,
            sender_name    = data.get('senderName', ''),
            receiver_name  = data.get('receiverName', ''),
            amount         = amount,
            currency       = currency,
            exchange_rate  = exchange_rate,
            bank_name      = data.get('bankName', ''),
            account_number = data.get('accountNumber', ''),
            iban           = data.get('iban', ''),
            swift_code     = data.get('swiftCode', ''),
            notes          = data.get('notes', ''),
            created_by     = _caller(request),
            status         = 'pending',
        )
        t.save()
        AuditLog.log('bk_create', request=request, target=t.ref_number,
                     amount=amount, currency=t.currency,
                     detail=f'{t.sender_name} → {t.receiver_name} — {t.bank_name}')
        try:
            from ..ws_utils import broadcast_accounts_transfer
            broadcast_accounts_transfer(t.to_dict())
        except Exception:
            pass
        return JsonResponse({'success': True, 'transfer': t.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. تفاصيل تحويل بعينه — PATCH/DELETE /api/bk/transfers/<id>
# ═══════════════════════════════════════════════════════════════════════════════

def api_bk_transfer_detail(request, transfer_id):
    err = _require_roles(request, 'T02', 'M01', 'M02')
    if err:
        return err

    try:
        t = BankTransfer.objects.get(pk=transfer_id)
    except BankTransfer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التحويل غير موجود'}, status=404)

    # T02 لا يعدل أو يحذف تحويلات الآخرين
    if getattr(request.user, 'role', '') == 'T02' and t.created_by != request.user.username:
        return JsonResponse({'success': False, 'message': 'التحويل غير موجود'}, status=404)

    # ── PATCH: تعديل ─────────────────────────────────────────────────────────
    if request.method == 'PATCH':
        data = _parse(request)
        editable = [
            'senderName', 'receiverName', 'bankName', 'accountNumber',
            'iban', 'swiftCode', 'notes', 'exchangeRate',
        ]
        field_map = {
            'senderName':    'sender_name',
            'receiverName':  'receiver_name',
            'bankName':      'bank_name',
            'accountNumber': 'account_number',
            'iban':          'iban',
            'swiftCode':     'swift_code',
            'notes':         'notes',
            'exchangeRate':  'exchange_rate',
        }
        for key in editable:
            if key in data:
                setattr(t, field_map[key], data[key])
        t.save()
        return JsonResponse({'success': True, 'transfer': t.to_dict()})

    # ── DELETE ────────────────────────────────────────────────────────────────
    if request.method == 'DELETE':
        if t.status == 'completed':
            return JsonResponse({'success': False, 'message': 'لا يمكن حذف تحويل مكتمل'}, status=400)
        t.delete()
        return JsonResponse({'success': True})

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. تنفيذ حوالة واردة — POST /api/bk/transfers/<id>/complete
# ═══════════════════════════════════════════════════════════════════════════════

def api_bk_transfer_complete(request, transfer_id):
    """تغيير حالة التحويل إلى 'مكتمل' مع تسجيل المرجع البنكي"""
    err = _require_roles(request, 'T02', 'M01')
    if err:
        return err
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    try:
        t = BankTransfer.objects.get(pk=transfer_id)
    except BankTransfer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التحويل غير موجود'}, status=404)

    if t.status == 'completed':
        return JsonResponse({'success': False, 'message': 'التحويل مكتمل مسبقاً'}, status=400)

    data = _parse(request)
    # تحديث الرقم المرجعي البنكي إن وُجد
    if data.get('bankRef'):
        t.notes = f"[Ref: {data['bankRef']}] " + t.notes
    if data.get('notes'):
        t.notes = (t.notes + '\n' + data['notes']).strip()

    t.status       = 'completed'
    t.completed_by = _caller(request)
    t.completed_at = timezone.now()
    t.save()
    AuditLog.log('bk_complete', request=request, target=t.ref_number,
                 amount=t.amount, currency=t.currency,
                 detail=f'مرجع بنكي: {data.get("bankRef", "—")}')
    return JsonResponse({'success': True, 'transfer': t.to_dict()})


# ═══════════════════════════════════════════════════════════════════════════════
# 5. رفض حوالة — POST /api/bk/transfers/<id>/reject
# ═══════════════════════════════════════════════════════════════════════════════

def api_bk_transfer_reject(request, transfer_id):
    err = _require_roles(request, 'T02', 'M01')
    if err:
        return err
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    try:
        t = BankTransfer.objects.get(pk=transfer_id)
    except BankTransfer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التحويل غير موجود'}, status=404)

    if t.status in ('completed', 'rejected'):
        return JsonResponse({'success': False, 'message': 'لا يمكن تغيير الحالة'}, status=400)

    data = _parse(request)
    if data.get('reason'):
        t.notes = (t.notes + '\n[رفض]: ' + data['reason']).strip()

    t.status       = 'rejected'
    t.completed_by = _caller(request)
    t.completed_at = timezone.now()
    t.save()
    AuditLog.log('bk_reject', request=request, target=t.ref_number,
                 amount=t.amount, currency=t.currency,
                 detail=f'سبب الرفض: {data.get("reason", "—")}')
    return JsonResponse({'success': True, 'transfer': t.to_dict()})


# ═══════════════════════════════════════════════════════════════════════════════
# 6. تغيير الحالة بشكل عام — POST /api/bk/transfers/<id>/status
# ═══════════════════════════════════════════════════════════════════════════════

def api_bk_transfer_status(request, transfer_id):
    """تغيير حالة التحويل: pending → in_progress → completed/rejected/cancelled"""
    err = _require_roles(request, 'T02', 'M01', 'M02')
    if err:
        return err
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    try:
        t = BankTransfer.objects.get(pk=transfer_id)
    except BankTransfer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التحويل غير موجود'}, status=404)

    data      = _parse(request)
    new_status = data.get('status')

    # جدول الانتقالات المسموح بها فقط (لا رجعة من completed/rejected/cancelled)
    TRANSITIONS = {
        'pending':     ('in_progress', 'cancelled', 'rejected'),
        'in_progress': ('completed',   'cancelled', 'rejected'),
        'completed':   (),
        'rejected':    (),
        'cancelled':   (),
    }
    allowed = TRANSITIONS.get(t.status, ())
    if new_status not in allowed:
        return JsonResponse({
            'success': False,
            'message': f'لا يمكن الانتقال من [{t.status}] إلى [{new_status}]',
        }, status=400)

    t.status = new_status
    if new_status in ('completed', 'rejected', 'cancelled'):
        t.completed_by = _caller(request)
        t.completed_at = timezone.now()
    if data.get('notes'):
        t.notes = (t.notes + '\n' + data['notes']).strip()

    t.save()
    AuditLog.log(f'bk_status_{new_status}', request=request, target=t.ref_number,
                 detail=f'تغيير الحالة إلى: {new_status}')
    return JsonResponse({'success': True, 'transfer': t.to_dict()})


# ═══════════════════════════════════════════════════════════════════════════════
# 7. التقارير — GET/POST /api/bk/reports
# ═══════════════════════════════════════════════════════════════════════════════

def api_bk_reports(request):
    err = _require_roles(request, 'T02', 'M01', 'M02')
    if err:
        return err

    # ── GET: استعراض التقارير ─────────────────────────────────────────────────
    if request.method == 'GET':
        role = request.user.role
        if role == 'M01':
            qs = SupervisorReport.objects.filter(page='bankTransfer')
        else:
            qs = SupervisorReport.objects.filter(
                page='bankTransfer',
                submitted_by=_caller(request)
            )
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

    # ── POST: رفع تقرير جديد ──────────────────────────────────────────────────
    if request.method == 'POST':
        data = _parse(request)
        title = data.get('title', '').strip()
        body  = data.get('body', '').strip()
        if not title or not body:
            return JsonResponse({'success': False, 'message': 'العنوان والمحتوى مطلوبان'}, status=400)

        r = SupervisorReport.objects.create(
            page         = 'bankTransfer',
            title        = title,
            body         = body,
            branch       = data.get('branch', ''),
            submitted_by = _caller(request),
        )
        return JsonResponse({
            'success': True,
            'report': {
                'id':          r.id,
                'title':       r.title,
                'body':        r.body,
                'branch':      r.branch,
                'submittedBy': r.submitted_by,
                'isRead':      r.is_read,
                'createdAt':   r.created_at.isoformat(),
            },
        }, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 8. تعليمات الإدارة لموظف T02 — GET /api/bk/instructions
# ═══════════════════════════════════════════════════════════════════════════════

def api_bk_instructions(request):
    err = _require_roles(request, 'T02', 'M01')
    if err:
        return err

    from ..models import AdminInstruction

    if request.method == 'GET':
        caller = _caller(request)
        role   = request.user.role

        if role == 'M01':
            qs = AdminInstruction.objects.filter(target_role='T02').order_by('-created_at')
        else:
            # موظف T02 يرى التعليمات الموجهة لدوره أو له شخصياً
            qs = AdminInstruction.objects.filter(
                Q(target_role='T02') | Q(target_user=caller)
            ).order_by('-created_at')

        return JsonResponse({
            'success': True,
            'instructions': [
                {
                    'id':         instr.id,
                    'title':      instr.title,
                    'body':       instr.body,
                    'priority':   instr.priority,
                    'targetRole': instr.target_role,
                    'targetUser': instr.target_user,
                    'isRead':     instr.is_read,
                    'createdBy':  instr.created_by,
                    'createdAt':  instr.created_at.isoformat(),
                }
                for instr in qs
            ],
        })

    if request.method == 'POST':
        # فقط M01 يستطيع إنشاء تعليمات
        if request.user.role != 'M01':
            return JsonResponse({'success': False, 'message': 'غير مصرَّح لك'}, status=403)

        from ..models import AdminInstruction
        data  = _parse(request)
        title = data.get('title', '').strip()
        body  = data.get('body', '').strip()
        if not title or not body:
            return JsonResponse({'success': False, 'message': 'العنوان والمحتوى مطلوبان'}, status=400)

        instr = AdminInstruction.objects.create(
            title       = title,
            body        = body,
            priority    = data.get('priority', 'normal'),
            target_role = data.get('targetRole', 'T02'),
            target_user = data.get('targetUser', ''),
            created_by  = _caller(request),
        )
        return JsonResponse({
            'success': True,
            'instruction': {
                'id':         instr.id,
                'title':      instr.title,
                'body':       instr.body,
                'priority':   instr.priority,
                'targetRole': instr.target_role,
                'targetUser': instr.target_user,
                'createdBy':  instr.created_by,
                'createdAt':  instr.created_at.isoformat(),
            },
        }, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════════
# 9. تعليمة مقروءة — PATCH /api/bk/instructions/<id>/read
# ═══════════════════════════════════════════════════════════════════════════════

def api_bk_instruction_read(request, instr_id):
    err = _require_roles(request, 'T02', 'M01')
    if err:
        return err
    if request.method != 'PATCH':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    from ..models import AdminInstruction
    try:
        instr = AdminInstruction.objects.get(pk=instr_id)
    except AdminInstruction.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التعليمة غير موجودة'}, status=404)

    instr.is_read  = True
    instr.read_by  = _caller(request)
    instr.read_at  = timezone.now()
    instr.save()
    return JsonResponse({'success': True})
