"""
am_audit_log.py — API سجل الأحداث
GET /api/am/audit-log/  ← قائمة الأحداث مع فلاتر
"""
from django.http import JsonResponse
from django.db.models import Q
from ..models import AuditLog
from core.permissions import require_roles as _require_roles


def api_am_audit_log(request):
    err = _require_roles(request, 'M01', 'M02', 'M03')
    if err:
        return err

    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)

    date_from = request.GET.get('date_from', '').strip()
    date_to   = request.GET.get('date_to',   '').strip()
    actor     = request.GET.get('actor',     '').strip()
    center    = request.GET.get('center',    '').strip()
    action    = request.GET.get('action',    '').strip()
    q         = request.GET.get('q',         '').strip()

    try:
        page     = max(1, int(request.GET.get('page',     1)))
        per_page = min(200, max(1, int(request.GET.get('per_page', 25))))
    except (ValueError, TypeError):
        page, per_page = 1, 25

    qs = AuditLog.objects.all()

    if date_from:
        try: qs = qs.filter(created_at__date__gte=date_from)
        except Exception: pass
    if date_to:
        try: qs = qs.filter(created_at__date__lte=date_to)
        except Exception: pass
    if actor:
        qs = qs.filter(actor__icontains=actor)
    if center:
        qs = qs.filter(Q(target__icontains=center) | Q(detail__icontains=center))
    if action:
        qs = qs.filter(action=action)
    if q:
        qs = qs.filter(
            Q(actor__icontains=q) |
            Q(target__icontains=q) |
            Q(detail__icontains=q) |
            Q(ip_address__icontains=q)
        )

    total  = qs.count()
    offset = (page - 1) * per_page
    items  = list(qs.order_by('-created_at')[offset: offset + per_page])

    # قائمة كل المنفِّذين المتاحين للفلتر
    actors = list(
        AuditLog.objects.values_list('actor', flat=True)
        .distinct().order_by('actor')[:200]
    )

    records = []
    for e in items:
        records.append({
            'id':        e.id,
            'action':    e.action,
            'actionLabel': e.get_action_display(),
            'actor':     e.actor,
            'actorRole': e.actor_role,
            'target':    e.target,
            'amount':    float(e.amount) if e.amount is not None else None,
            'currency':  e.currency,
            'detail':    e.detail,
            'ip':        str(e.ip_address) if e.ip_address else '',
            'createdAt': e.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        })

    return JsonResponse({
        'success':    True,
        'total':      total,
        'page':       page,
        'totalPages': max(1, (total + per_page - 1) // per_page),
        'records':    records,
        'actors':     actors,
    })
