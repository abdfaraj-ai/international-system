"""
gl_api.py — واجهات دفتر الأستاذ العام الموحّد
═══════════════════════════════════════════════
GET  /api/gl/accounts/        ← دليل الحسابات (للقوائم)
GET  /api/gl/journal/         ← قائمة القيود
POST /api/gl/journal/         ← قيد يومي يدوي (يُرحَّل بقيد مزدوج مفروض)
GET  /api/gl/journal/<id>/    ← تفاصيل قيد + سطوره
GET  /api/gl/trial-balance/   ← ميزان مراجعة من الدفتر الموحّد (متوازن)
GET  /api/gl/account/<code>/  ← كشف حساب (حركات + رصيد)
"""
from datetime import date

from django.http import JsonResponse

from core.permissions import require_roles, parse_json, caller_name
from ..models import Account, GLTransaction, GLLine
from .gl_utils import post_gl, reverse_gl, trial_balance, account_balance, UnbalancedEntry


def _parse_date(s):
    try:
        return date.fromisoformat((s or '').strip())
    except Exception:
        return None


def api_gl_accounts(request):
    """قائمة دليل الحسابات."""
    err = require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err
    accts = Account.objects.filter(is_active=True).order_by('code')
    return JsonResponse({'success': True, 'accounts': [
        {'id': a.id, 'code': a.code, 'name': a.name, 'type': a.type,
         'currency': a.currency, 'isGroup': a.is_group, 'postable': a.is_postable}
        for a in accts
    ]})


def _txn_dict(t, with_lines=False):
    d = {
        'id': t.id, 'ref': t.ref_number, 'date': t.date.isoformat(),
        'description': t.description, 'source': t.source,
        'createdBy': t.created_by,
    }
    if with_lines:
        d['lines'] = [{
            'account': l.account.code, 'accountName': l.account.name,
            'currency': l.currency, 'debit': float(l.debit), 'credit': float(l.credit),
            'center': l.center, 'note': l.note,
        } for l in t.lines.select_related('account').all()]
    return d


def api_gl_journal(request):
    """GET قائمة القيود · POST قيد يومي يدوي."""
    err = require_roles(request, 'M01')
    if err:
        return err

    if request.method == 'GET':
        txns = GLTransaction.objects.all()[:200]
        return JsonResponse({'success': True,
                             'transactions': [_txn_dict(t) for t in txns]})

    if request.method == 'POST':
        data, perr = parse_json(request)
        if perr:
            return perr
        raw_lines = data.get('lines') or []
        if len(raw_lines) < 2:
            return JsonResponse({'success': False, 'message': 'القيد يحتاج سطرين على الأقل'}, status=400)
        lines = [{
            'account':  l.get('account') or l.get('code'),
            'currency': l.get('currency') or 'USD',
            'debit':    l.get('debit', 0),
            'credit':   l.get('credit', 0),
            'center':   l.get('center', '') or '',
            'note':     l.get('note', '') or '',
        } for l in raw_lines]
        try:
            txn = post_gl(
                lines=lines,
                date=_parse_date(data.get('date')),
                description=(data.get('description') or '').strip(),
                source='manual',
                created_by=caller_name(request),
            )
        except UnbalancedEntry as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=400)
        return JsonResponse({'success': True, 'ref': txn.ref_number, 'id': txn.id})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_gl_journal_detail(request, txn_id):
    """تفاصيل قيد + سطوره · حذف (عكس)."""
    err = require_roles(request, 'M01')
    if err:
        return err
    try:
        t = GLTransaction.objects.get(id=txn_id)
    except GLTransaction.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'القيد غير موجود'}, status=404)

    if request.method == 'DELETE':
        reverse_gl(t.source, t.source_id if t.source_id is not None else t.id)
        return JsonResponse({'success': True, 'message': 'تم عكس القيد'})

    return JsonResponse({'success': True, 'transaction': _txn_dict(t, with_lines=True)})


def api_gl_trial_balance(request):
    """ميزان مراجعة من الدفتر الموحّد — متوازن (مجموع المدين = مجموع الدائن لكل عملة)."""
    err = require_roles(request, 'M01')
    if err:
        return err
    df = _parse_date(request.GET.get('date_from'))
    dt = _parse_date(request.GET.get('date_to'))
    rows = trial_balance(df, dt)

    # تجميع لكل عملة للتحقّق من التوازن
    by_cur = {}
    for r in rows:
        c = r['currency']
        by_cur.setdefault(c, {'debit': 0.0, 'credit': 0.0})
        by_cur[c]['debit']  += r['debit']
        by_cur[c]['credit'] += r['credit']
    totals = [{'currency': c, 'debit': round(v['debit'], 4), 'credit': round(v['credit'], 4),
               'balanced': abs(v['debit'] - v['credit']) < 0.01}
              for c, v in sorted(by_cur.items())]

    return JsonResponse({'success': True, 'rows': rows, 'totals': totals})


def api_gl_account_statement(request, code):
    """كشف حساب — كل حركات حساب معيّن + رصيده."""
    err = require_roles(request, 'M01', 'M02', 'M03', 'T02', 'T03')
    if err:
        return err
    acc = Account.objects.filter(code=str(code).strip()).first()
    if not acc:
        return JsonResponse({'success': False, 'message': 'الحساب غير موجود'}, status=404)
    lines = (GLLine.objects.filter(account=acc)
             .select_related('transaction').order_by('transaction__date', 'id'))
    movements = [{
        'date': l.transaction.date.isoformat(), 'ref': l.transaction.ref_number,
        'description': l.transaction.description, 'currency': l.currency,
        'debit': float(l.debit), 'credit': float(l.credit),
        'center': l.center, 'note': l.note,
    } for l in lines]
    balances = {c: float(b) for c, b in account_balance(acc).items()}
    return JsonResponse({'success': True,
                         'account': {'code': acc.code, 'name': acc.name, 'type': acc.type},
                         'movements': movements, 'balances': balances})
