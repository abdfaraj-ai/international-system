"""
am_statement.py — كشف حساب
════════════════════════════
GET /api/am/statement/        ← كشف حساب مركز أو وكيل
GET /api/am/statement/centers/ ← قائمة المراكز والوكلاء للبحث
"""
from django.http import JsonResponse
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta, date

from ..models import (
    HawalaTransfer, CurrencySwap, CutAndClose,
    AdvancedEntry, JournalEntry, SettlementVoucher
)
from core.permissions import require_roles as _require_roles


def _date_range(period, date_from_str, date_to_str):
    today = date.today()
    if period == 'today':
        return today, today
    elif period == 'week':
        return today - timedelta(days=7), today
    elif period == 'month':
        return today - timedelta(days=30), today
    elif period == '3months':
        return today - timedelta(days=90), today
    elif period == 'year':
        return date(today.year, 1, 1), today
    else:
        df = None
        dt = None
        if date_from_str:
            try: df = date.fromisoformat(date_from_str)
            except ValueError: pass
        if date_to_str:
            try: dt = date.fromisoformat(date_to_str)
            except ValueError: pass
        return df, dt


def _fmt(d):
    return d.strftime('%Y-%m-%d %H:%M') if d else '—'


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/am/statement/centers/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_statement_centers(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01', 'T02', 'T03')
    if err:
        return err

    q = request.GET.get('q', '').strip()

    # اجمع كل أسماء المراكز من جداول مختلفة
    centers = set()

    for field in ['from_branch', 'to_branch']:
        qs = HawalaTransfer.objects.values_list(field, flat=True).distinct()
        if q:
            qs = qs.filter(**{f'{field}__icontains': q})
        centers.update(v for v in qs if v)

    for field in ['center1_name', 'center2_name']:
        qs = CurrencySwap.objects.values_list(field, flat=True).distinct()
        if q:
            qs = qs.filter(**{f'{field}__icontains': q})
        centers.update(v for v in qs if v)

    for field in ['buy_center', 'sell_center']:
        qs = CutAndClose.objects.values_list(field, flat=True).distinct()
        if q:
            qs = qs.filter(**{f'{field}__icontains': q})
        centers.update(v for v in qs if v)

    for field in ['from_center', 'to_center']:
        qs = AdvancedEntry.objects.values_list(field, flat=True).distinct()
        if q:
            qs = qs.filter(**{f'{field}__icontains': q})
        centers.update(v for v in qs if v)

    qs = SettlementVoucher.objects.values_list('center_name', flat=True).distinct()
    if q:
        qs = qs.filter(center_name__icontains=q)
    centers.update(v for v in qs if v)

    sorted_centers = sorted(centers)[:50]
    return JsonResponse({'success': True, 'centers': sorted_centers})


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/am/statement/
# ══════════════════════════════════════════════════════════════════════════════

def api_am_statement(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01', 'T02', 'T03')
    if err:
        return err

    center      = request.GET.get('center', '').strip()
    period      = request.GET.get('period', '').strip()
    date_from_s = request.GET.get('date_from', '').strip()
    date_to_s   = request.GET.get('date_to', '').strip()
    currency    = request.GET.get('currency', '').upper().strip()
    inc_unreceived = request.GET.get('include_unreceived', '0') == '1'

    if not center:
        return JsonResponse({'success': False, 'message': 'يرجى تحديد المركز'}, status=400)

    df, dt = _date_range(period, date_from_s, date_to_s)

    def apply_dates(qs, field='created_at'):
        if df:
            qs = qs.filter(**{f'{field}__date__gte': df})
        if dt:
            qs = qs.filter(**{f'{field}__date__lte': dt})
        return qs

    movements = []

    # ── 1. حوالات (من المركز) ────────────────────────────────────────────────
    tr_qs = HawalaTransfer.objects.filter(
        Q(from_branch=center) | Q(to_branch=center)
    )
    if not inc_unreceived:
        tr_qs = tr_qs.filter(status='completed')
    if currency:
        tr_qs = tr_qs.filter(currency=currency)
    tr_qs = apply_dates(tr_qs)

    for t in tr_qs:
        side = 'out' if t.from_branch == center else 'in'
        movements.append({
            'type':      'حوالة',
            'ref':       t.ref_number if hasattr(t, 'ref_number') else f'HW-{t.id}',
            'date':      _fmt(t.created_at),
            'side':      side,
            'amount':    float(t.amount),
            'currency':  t.currency,
            'fee':       float(t.commission) if hasattr(t, 'commission') else 0,
            'counterpart': t.to_branch if side == 'out' else t.from_branch,
            'notes':     t.receiver_name if hasattr(t, 'receiver_name') else '',
            'status':    t.status,
        })

    # ── 2. تبديل عملات ───────────────────────────────────────────────────────
    sw_qs = CurrencySwap.objects.filter(
        Q(center1_name=center) | Q(center2_name=center)
    )
    if currency:
        sw_qs = sw_qs.filter(Q(currency1=currency) | Q(currency2=currency))
    sw_qs = apply_dates(sw_qs)

    for s in sw_qs:
        side = 'out' if s.center1_name == center else 'in'
        movements.append({
            'type':      'تبديل عملات',
            'ref':       s.ref_number,
            'date':      _fmt(s.created_at),
            'side':      side,
            'amount':    float(s.amount1) if side == 'out' else float(s.amount2),
            'currency':  s.currency1 if side == 'out' else s.currency2,
            'fee':       0,
            'counterpart': s.center2_name if side == 'out' else s.center1_name,
            'notes':     s.notes,
            'status':    'completed',
        })

    # ── 3. قص وإغلاق ─────────────────────────────────────────────────────────
    cut_qs = CutAndClose.objects.filter(
        Q(buy_center=center) | Q(sell_center=center)
    )
    if currency:
        cut_qs = cut_qs.filter(
            Q(buy_currency=currency) | Q(sell_currency=currency)
        )
    cut_qs = apply_dates(cut_qs)

    for c in cut_qs:
        side = 'in' if c.buy_center == center else 'out'
        movements.append({
            'type':      'قص وإغلاق',
            'ref':       c.ref_number,
            'date':      _fmt(c.created_at),
            'side':      side,
            'amount':    float(c.buy_amount) if side == 'in' else float(c.sell_amount),
            'currency':  c.buy_currency if side == 'in' else c.sell_currency,
            'fee':       0,
            'counterpart': c.sell_center if side == 'in' else c.buy_center,
            'notes':     '',
            'status':    'completed',
        })

    # ── 4. قيود متقدمة ───────────────────────────────────────────────────────
    adv_qs = AdvancedEntry.objects.filter(
        Q(from_center=center) | Q(to_center=center)
    )
    if currency:
        adv_qs = adv_qs.filter(
            Q(from_currency=currency) | Q(to_currency=currency)
        )
    adv_qs = apply_dates(adv_qs)

    for a in adv_qs:
        side = 'out' if a.from_center == center else 'in'
        movements.append({
            'type':      'قيد متقدم',
            'ref':       a.ref_number,
            'date':      _fmt(a.created_at),
            'side':      side,
            'amount':    float(a.from_amount) if side == 'out' else float(a.to_amount),
            'currency':  a.from_currency if side == 'out' else a.to_currency,
            'fee':       float(a.from_fee) if side == 'out' else float(a.to_fee),
            'counterpart': a.to_center if side == 'out' else a.from_center,
            'notes':     a.from_name or a.to_beneficiary,
            'status':    'completed',
        })

    # ── 5. قيود التسوية ──────────────────────────────────────────────────────
    stl_qs = SettlementVoucher.objects.filter(center_name=center)
    stl_qs = apply_dates(stl_qs)

    for v in stl_qs:
        movements.append({
            'type':      'قيد تسوية',
            'ref':       v.ref_number,
            'date':      _fmt(v.created_at),
            'side':      'in',
            'amount':    float(v.net_profit),
            'currency':  'USD',
            'fee':       0,
            'counterpart': '—',
            'notes':     v.notes,
            'status':    'completed',
        })

    # ── ترتيب بالتاريخ ───────────────────────────────────────────────────────
    movements.sort(key=lambda x: x['date'], reverse=True)

    # ── ملخص ─────────────────────────────────────────────────────────────────
    total_in  = sum(m['amount'] for m in movements if m['side'] == 'in')
    total_out = sum(m['amount'] for m in movements if m['side'] == 'out')
    total_fee = sum(m['fee']    for m in movements)

    return JsonResponse({
        'success':    True,
        'center':     center,
        'dateFrom':   df.isoformat() if df else None,
        'dateTo':     dt.isoformat() if dt else None,
        'currency':   currency or 'الكل',
        'totalIn':    total_in,
        'totalOut':   total_out,
        'totalFee':   total_fee,
        'netBalance': total_in - total_out,
        'count':      len(movements),
        'movements':  movements,
    })
