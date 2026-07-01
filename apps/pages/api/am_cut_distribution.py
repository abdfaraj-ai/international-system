"""
am_cut_distribution.py — API تفريق القص
GET    /api/cut-distribution/           ← قائمة التفريقات
POST   /api/cut-distribution/           ← إضافة تفريق جديد
PATCH  /api/cut-distribution/<id>/      ← تعديل تفريق
DELETE /api/cut-distribution/<id>/      ← حذف تفريق
"""
import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db.models import Q
from ..models import CutDistribution
from core.permissions import require_roles as _require_roles, caller_name as _caller

VALID_TYPES = ('balance', 'movement', 'system')


def _dec(v, default='0'):
    try:
        return Decimal(str(v))
    except (InvalidOperation, TypeError):
        return Decimal(default)


def _parse(request):
    try:
        return json.loads(request.body), None
    except Exception:
        return None, JsonResponse({'success': False, 'message': 'JSON غير صالح'}, status=400)


def api_cut_distribution(request):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    if request.method == 'GET':
        dist_type = request.GET.get('type', '').strip()
        q         = request.GET.get('q', '').strip()

        qs = CutDistribution.objects.all()
        if dist_type in VALID_TYPES:
            qs = qs.filter(dist_type=dist_type)
        if q:
            qs = qs.filter(
                Q(center_name__icontains=q) | Q(notes__icontains=q)
            )

        grouped = {'balance': [], 'movement': [], 'system': []}
        for cd in qs:
            grouped[cd.dist_type].append(cd.to_dict())

        return JsonResponse({
            'success': True,
            'items':   [cd.to_dict() for cd in qs],
            'grouped': grouped,
            'counts':  {k: len(v) for k, v in grouped.items()},
        })

    if request.method == 'POST':
        data, err = _parse(request)
        if err:
            return err

        dist_type    = (data.get('distType')    or '').strip()
        center_name  = (data.get('centerName')  or '').strip()
        from_value   = _dec(data.get('fromValue',   0))
        to_value     = _dec(data.get('toValue',     0))
        distribution = _dec(data.get('distribution', 0))
        notes        = (data.get('notes') or '').strip()
        is_active    = bool(data.get('isActive', True))

        errors = []
        if dist_type not in VALID_TYPES:
            errors.append(f'نوع التفريق غير صحيح: {dist_type}')
        if not center_name:
            errors.append('اسم المركز مطلوب')

        if errors:
            return JsonResponse({'success': False, 'message': ' | '.join(errors)}, status=400)

        cd = CutDistribution.objects.create(
            dist_type    = dist_type,
            center_name  = center_name,
            from_value   = from_value,
            to_value     = to_value,
            distribution = distribution,
            notes        = notes,
            is_active    = is_active,
            created_by   = _caller(request),
            updated_by   = _caller(request),
        )
        return JsonResponse({'success': True, 'message': 'تم إضافة التفريق', 'item': cd.to_dict()}, status=201)

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


def api_cut_distribution_detail(request, dist_id):
    err = _require_roles(request, 'M01', 'M02', 'M03', 'T01')
    if err:
        return err

    try:
        cd = CutDistribution.objects.get(id=dist_id)
    except CutDistribution.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التفريق غير موجود'}, status=404)

    if request.method == 'PATCH':
        data, err = _parse(request)
        if err:
            return err

        if 'distType' in data:
            dt = (data['distType'] or '').strip()
            if dt not in VALID_TYPES:
                return JsonResponse({'success': False, 'message': 'نوع التفريق غير صحيح'}, status=400)
            cd.dist_type = dt

        if 'centerName'   in data: cd.center_name  = (data['centerName'] or '').strip()
        if 'fromValue'    in data: cd.from_value    = _dec(data['fromValue'])
        if 'toValue'      in data: cd.to_value      = _dec(data['toValue'])
        if 'distribution' in data: cd.distribution  = _dec(data['distribution'])
        if 'notes'        in data: cd.notes         = (data['notes'] or '').strip()
        if 'isActive'     in data: cd.is_active      = bool(data['isActive'])

        if not cd.center_name:
            return JsonResponse({'success': False, 'message': 'اسم المركز مطلوب'}, status=400)

        cd.updated_by = _caller(request)
        cd.save()
        return JsonResponse({'success': True, 'message': 'تم التحديث', 'item': cd.to_dict()})

    if request.method == 'DELETE':
        cd.delete()
        return JsonResponse({'success': True, 'message': 'تم الحذف'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)
