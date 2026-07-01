"""
am_center_ledger.py — API أرصدة المراكز وكشف الحساب
═══════════════════════════════════════════════════════
GET /api/am/center-balances/           ← أرصدة كل المراكز (لكل عملة)
GET /api/am/center-balances/<name>/    ← رصيد مركز محدد
GET /api/am/center-ledger/<name>/      ← كشف حساب مركز (كل الحركات)
"""
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from ..models import CenterLedger
from .ledger_utils import center_balances, all_centers_balances
from core.permissions import require_roles as _require_roles


@require_GET
def api_center_balances(request):
    """GET /api/am/center-balances/ — أرصدة كل المراكز مجمّعة حسب العملة"""
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01', 'T02', 'T03')
    if err:
        return err

    data = all_centers_balances()
    rows = [{'center': c, 'balances': b} for c, b in sorted(data.items())]
    return JsonResponse({'success': True, 'centers': rows, 'count': len(rows)})


@require_GET
def api_center_balance_detail(request, center_name):
    """GET /api/am/center-balances/<name>/ — رصيد مركز واحد لكل عملاته"""
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01', 'T02', 'T03')
    if err:
        return err

    balances = center_balances(center_name)
    return JsonResponse({'success': True, 'center': center_name, 'balances': balances})


@require_GET
def api_center_ledger(request, center_name):
    """GET /api/am/center-ledger/<name>/ — كشف حساب: كل حركات المركز"""
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01', 'T02', 'T03')
    if err:
        return err

    currency = request.GET.get('currency', '').strip().upper()

    qs = CenterLedger.objects.filter(center=center_name.strip())
    if currency:
        qs = qs.filter(currency=currency)
    qs = qs.order_by('created_at', 'id')

    # حساب الرصيد التراكمي (running balance) لكل عملة
    running = {}
    rows = []
    for r in qs:
        d = r.to_dict()
        cur = r.currency
        running[cur] = running.get(cur, 0) + d['balance']
        d['runningBalance'] = round(running[cur], 4)
        rows.append(d)

    # عكس الترتيب لعرض الأحدث أولاً مع الإبقاء على الرصيد التراكمي الصحيح
    rows.reverse()

    return JsonResponse({
        'success':  True,
        'center':   center_name,
        'balances': center_balances(center_name),
        'movements': rows,
        'count':    len(rows),
    })
