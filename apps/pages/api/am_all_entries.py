"""
am_all_entries.py — API «جميع القيود» (كل قيود من/إلى عبر جميع الشركات)
════════════════════════════════════════════════════════════════════════
GET /api/all-entries/?type=&date_from=&date_to=

يعيد كل قيود EntryFromTo (المسجَّلة بين المراكز/الشركات) بلا تقييد بمركز،
مرتّبة من الأحدث. أي قيد جديد يُنشأ يظهر هنا تلقائياً.
"""
from django.http import JsonResponse

from ..models import EntryFromTo
from core.permissions import require_roles as _require_roles


def api_all_entries(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    type_f    = (request.GET.get('type', '')      or '').strip()
    date_from = (request.GET.get('date_from', '')  or '').strip()
    date_to   = (request.GET.get('date_to', '')    or '').strip()

    rows = []

    # قيود من/إلى = نوع «تحويل». (الأنواع الأخرى تُضاف عند ربط عملياتها لاحقاً)
    if type_f in ('', 'transfer'):
        qs = EntryFromTo.objects.all()
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        qs = qs.order_by('-created_at', '-id')

        for e in qs:
            rows.append({
                'id':            e.ref_number or e.id,
                'transfer_date': e.created_at.strftime('%Y-%m-%d %H:%M'),
                'us':            float(e.from_amount),   # لنا  (المبلغ المرسل)
                'from':          e.from_center,          # من
                'beneficiary':   e.from_beneficiary or '—',
                'them':          float(e.to_amount),     # علينا (المبلغ المستلم)
                'to':            e.to_center,            # الى
                'profit':        float(e.net_profit),    # الربح
                'notes':         e.from_notes or e.to_notes or '',
                'type':          'transfer',
            })

    return JsonResponse({'success': True, 'count': len(rows), 'results': rows})
