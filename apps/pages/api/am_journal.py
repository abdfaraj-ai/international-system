"""
am_journal.py — API قيد جديد (دليل الحسابات + القيود المحاسبية)
════════════════════════════════════════════════════════════════
GET  /api/am/accounts/          ← قائمة الحسابات
POST /api/am/accounts/          ← إنشاء حساب جديد
GET  /api/am/accounts/<id>/     ← تفاصيل حساب
PUT  /api/am/accounts/<id>/     ← تعديل حساب
GET  /api/am/journal/           ← قائمة القيود
POST /api/am/journal/           ← إنشاء قيد محاسبي
GET  /api/am/journal/<id>/      ← تفاصيل قيد
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import Q, F

from ..models import AccountLedger, JournalEntry
from core.permissions import require_roles as _require_roles, caller_name as _caller

VALID_CURRENCIES = ('USD', 'ILS', 'JOD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY', 'SYP', 'EGP')
VALID_DIRS       = ('mul', 'div')
VALID_TYPES      = ('client', 'agent', 'branch', 'treasury', 'other')


def _norm_dir(v):
    """تطبيع اتجاه القص — يقبل multiply/divide و mul/div و ضرب/قسمة."""
    s = (v or 'mul').strip().lower()
    if s in ('mul', 'multiply', 'x', '*', 'ضرب'):
        return 'mul'
    if s in ('div', 'divide', '/', 'قسمة'):
        return 'div'
    return s


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


def _account_dict(a):
    return {
        'id':          a.id,
        'name':        a.name,
        'accountNo':   a.account_no,
        'accountType': a.account_type,
        'currency':    a.currency,
        'balance':     float(a.balance),
        'phone':       a.phone,
        'isActive':    a.is_active,
        'createdBy':   a.created_by,
        'createdAt':   a.created_at.strftime('%Y-%m-%d %H:%M'),
    }


def _journal_dict(j):
    return {
        'id':           j.id,
        'refNumber':    j.ref_number,
        'fromAccount':  {'id': j.from_account_id, 'name': j.from_account.name, 'no': j.from_account.account_no},
        'toAccount':    {'id': j.to_account_id,   'name': j.to_account.name,   'no': j.to_account.account_no},
        'amount':       float(j.amount),
        'fromCurrency': j.from_currency,
        'toCurrency':   j.to_currency,
        'cutRate':      float(j.cut_rate),
        'cutDir':       j.cut_dir,
        'toAmount':     float(j.to_amount),
        'profit':       float(j.profit),
        'notes':        j.notes,
        'createdBy':    j.created_by,
        'createdAt':    j.created_at.strftime('%Y-%m-%d %H:%M'),
    }


# ══════════════════════════════════════════════════════════════════════════════
# GET + POST  /api/am/accounts/
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_am_accounts(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    if request.method == 'GET':
        qs = AccountLedger.objects.all()

        q = request.GET.get('q', '').strip()
        acc_type = request.GET.get('type', '').strip()
        active_only = request.GET.get('active', '').strip()

        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(account_no__icontains=q) | Q(phone__icontains=q))
        if acc_type:
            qs = qs.filter(account_type=acc_type)
        if active_only == '1':
            qs = qs.filter(is_active=True)

        try:
            page     = max(1, int(request.GET.get('page', 1)))
            per_page = min(100, max(1, int(request.GET.get('per_page', 20))))
        except (ValueError, TypeError):
            page, per_page = 1, 20

        total  = qs.count()
        offset = (page - 1) * per_page
        items  = list(qs.order_by('-created_at')[offset: offset + per_page])

        return JsonResponse({
            'success':    True,
            'total':      total,
            'page':       page,
            'totalPages': max(1, (total + per_page - 1) // per_page),
            'records':    [_account_dict(a) for a in items],
        })

    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        name     = (data.get('name') or '').strip()
        acc_type = (data.get('accountType') or 'client').strip()
        currency = (data.get('currency') or 'USD').upper().strip()
        phone    = (data.get('phone') or '').strip()

        errors = []
        if not name:                         errors.append('اسم الحساب مطلوب')
        if acc_type not in VALID_TYPES:      errors.append('نوع الحساب غير صالح')
        if currency not in VALID_CURRENCIES: errors.append(f'العملة غير مدعومة: {currency}')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        account = AccountLedger.objects.create(
            name         = name,
            account_type = acc_type,
            currency     = currency,
            phone        = phone,
            created_by   = _caller(request),
        )

        return JsonResponse({
            'success': True,
            'message': f'تم إنشاء الحساب {account.account_no}',
            'record':  _account_dict(account),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# GET + PUT  /api/am/accounts/<id>/
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_am_account_detail(request, account_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    try:
        account = AccountLedger.objects.get(id=account_id)
    except AccountLedger.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الحساب غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'record': _account_dict(account)})

    if request.method == 'PUT':
        data, err = _parse(request)
        if err:
            return err

        if 'name' in data:
            account.name = (data['name'] or '').strip()
        if 'phone' in data:
            account.phone = (data['phone'] or '').strip()
        if 'isActive' in data:
            account.is_active = bool(data['isActive'])
        if 'currency' in data:
            cur = (data['currency'] or '').upper().strip()
            if cur in VALID_CURRENCIES:
                account.currency = cur
        if 'accountType' in data:
            t = (data['accountType'] or '').strip()
            if t in VALID_TYPES:
                account.account_type = t

        if not account.name:
            return JsonResponse({'success': False, 'message': 'اسم الحساب مطلوب'}, status=400)

        account.save()
        return JsonResponse({'success': True, 'message': 'تم التحديث', 'record': _account_dict(account)})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# GET + POST  /api/am/journal/
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_am_journal(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err

    if request.method == 'GET':
        qs = JournalEntry.objects.select_related('from_account', 'to_account').all()

        q         = request.GET.get('q', '').strip()
        date_from = request.GET.get('date_from', '').strip()
        date_to   = request.GET.get('date_to', '').strip()

        if q:
            qs = qs.filter(
                Q(ref_number__icontains=q) |
                Q(from_account__name__icontains=q) |
                Q(to_account__name__icontains=q)
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
        profit_sum = qs.aggregate(t=Sum('profit'))['t'] or 0

        return JsonResponse({
            'success':     True,
            'total':       total,
            'totalProfit': float(profit_sum),
            'page':        page,
            'totalPages':  max(1, (total + per_page - 1) // per_page),
            'records':     [_journal_dict(j) for j in items],
        })

    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        from_id   = data.get('fromAccountId')
        to_id     = data.get('toAccountId')
        amount    = _dec(data.get('amount', 0))
        from_cur  = (data.get('fromCurrency') or 'USD').upper().strip()
        to_cur    = (data.get('toCurrency')   or 'USD').upper().strip()
        cut_rate  = _dec(data.get('cutRate', 1))
        cut_dir   = _norm_dir(data.get('cutDir'))
        notes     = (data.get('notes') or '').strip()

        errors = []
        if not from_id:                      errors.append('حساب المدين مطلوب')
        if not to_id:                        errors.append('حساب الدائن مطلوب')
        if amount <= 0:                      errors.append('المبلغ يجب أن يكون أكبر من الصفر')
        if from_cur not in VALID_CURRENCIES: errors.append(f'عملة المدين غير مدعومة: {from_cur}')
        if to_cur   not in VALID_CURRENCIES: errors.append(f'عملة الدائن غير مدعومة: {to_cur}')
        if cut_rate <= 0:                    errors.append('سعر القص غير صالح')
        if cut_dir  not in VALID_DIRS:       errors.append('اتجاه القص غير صالح')
        if from_id == to_id:                 errors.append('حساب المدين والدائن يجب أن يكونا مختلفَين')

        try:
            from_acc = AccountLedger.objects.get(id=from_id, is_active=True)
        except AccountLedger.DoesNotExist:
            errors.append('حساب المدين غير موجود أو غير نشط')
            from_acc = None

        try:
            to_acc = AccountLedger.objects.get(id=to_id, is_active=True)
        except AccountLedger.DoesNotExist:
            errors.append('حساب الدائن غير موجود أو غير نشط')
            to_acc = None

        # تحقق من تطابق عملة كل حساب مع عملة طرفه في القيد
        # (لا يجوز خصم مبلغ بعملة من حساب رصيده بعملة أخرى)
        if from_acc and from_acc.currency != from_cur:
            errors.append(f'عملة حساب المدين ({from_acc.currency}) لا تطابق عملة القيد ({from_cur})')
        if to_acc and to_acc.currency != to_cur:
            errors.append(f'عملة حساب الدائن ({to_acc.currency}) لا تطابق عملة القيد ({to_cur})')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        # احسب المبلغ المحوّل وفق اتجاه القص
        if cut_dir == 'div':
            to_amount = amount / cut_rate if cut_rate != 0 else Decimal('0')
        else:
            to_amount = amount * cut_rate

        # الربح = الفرق بين ما أُرسل وما استُلم محوَّلاً للعملة الأساسية
        # إذا العملتان مختلفتان: نحوّل to_amount → from_cur بعكس القص للمقارنة
        if from_cur == to_cur:
            profit = amount - to_amount
        else:
            # أعد تحويل to_amount للعملة الأصلية ثم احسب الفرق
            if cut_dir == 'div':
                to_in_from_cur = to_amount * cut_rate if cut_rate != 0 else Decimal('0')
            else:
                to_in_from_cur = to_amount / cut_rate if cut_rate != 0 else Decimal('0')
            profit = amount - to_in_from_cur

        with transaction.atomic():
            entry = JournalEntry.objects.create(
                from_account  = from_acc,
                to_account    = to_acc,
                amount        = amount,
                from_currency = from_cur,
                to_currency   = to_cur,
                cut_rate      = cut_rate,
                cut_dir       = cut_dir,
                to_amount     = to_amount,
                profit        = profit,
                notes         = notes,
                created_by    = _caller(request),
            )
            # تحديث أرصدة الحسابات: المدين ينقص، الدائن يزيد
            AccountLedger.objects.filter(id=from_acc.id).update(balance=F('balance') - amount)
            AccountLedger.objects.filter(id=to_acc.id).update(balance=F('balance') + to_amount)

        return JsonResponse({
            'success':  True,
            'message':  f'تم إنشاء القيد {entry.ref_number}',
            'record':   _journal_dict(entry),
        }, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/am/journal/<id>/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_journal_detail(request, journal_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'GET فقط'}, status=405)
    try:
        entry = JournalEntry.objects.select_related('from_account', 'to_account').get(id=journal_id)
    except JournalEntry.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'القيد غير موجود'}, status=404)
    return JsonResponse({'success': True, 'record': _journal_dict(entry)})
