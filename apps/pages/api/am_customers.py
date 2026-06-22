"""
am_customers.py — API العملاء / الزبائن
════════════════════════════════════════
GET    /api/customers/            ← قائمة العملاء (deleted=true للمحذوفين)
POST   /api/customers/            ← إضافة عميل
PATCH  /api/customers/<id>/       ← تعديل عميل
DELETE /api/customers/<id>/       ← حذف ناعم (is_deleted=True)
POST   /api/customers/<id>/restore/      ← استعادة عميل محذوف
DELETE /api/customers/<id>/force-delete/ ← حذف نهائي
"""
import json
from django.http import JsonResponse

from ..models import Customer
from core.permissions import require_roles as _require_roles


def _parse(request):
    try:
        return json.loads(request.body)
    except Exception:
        return {}


def _serialize(c):
    return c.to_dict()


def api_customers(request):
    err = _require_roles(request, 'M01')
    if err:
        return err

    if request.method == 'GET':
        deleted = request.GET.get('deleted', '').lower() in ('1', 'true', 'yes')
        qs = Customer.objects.filter(is_deleted=deleted).order_by('name')
        return JsonResponse([_serialize(c) for c in qs], safe=False)

    if request.method == 'POST':
        data = _parse(request)
        name = (data.get('name') or '').strip()
        if not name:
            return JsonResponse({'success': False, 'message': 'الاسم مطلوب'}, status=400)
        c = Customer.objects.create(
            name    = name,
            type    = data.get('type', 'main'),
            status  = data.get('status', 'active'),
            country = (data.get('country') or '').strip(),
            city    = (data.get('city') or '').strip(),
            phone   = (data.get('phone') or '').strip(),
            doc_url = (data.get('doc_url') or '').strip(),
            notes   = (data.get('notes') or '').strip(),
            dollar  = float(data.get('dollar') or 0),
            euro    = float(data.get('euro') or 0),
            lira_tr = float(data.get('lira_tr') or 0),
        )
        return JsonResponse({'success': True, 'customer': _serialize(c)}, status=201)

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


def api_customer_detail(request, customer_id):
    err = _require_roles(request, 'M01')
    if err:
        return err

    try:
        c = Customer.objects.get(pk=customer_id)
    except Customer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'العميل غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse(_serialize(c))

    if request.method == 'PATCH':
        data = _parse(request)
        name = (data.get('name') or '').strip()
        if not name:
            return JsonResponse({'success': False, 'message': 'الاسم مطلوب'}, status=400)
        c.name    = name
        c.type    = data.get('type', c.type)
        c.status  = data.get('status', c.status)
        c.country = (data.get('country') or '').strip()
        c.city    = (data.get('city') or '').strip()
        c.phone   = (data.get('phone') or '').strip()
        c.doc_url = (data.get('doc_url') or '').strip()
        c.notes   = (data.get('notes') or '').strip()
        c.dollar  = float(data.get('dollar') or 0)
        c.euro    = float(data.get('euro') or 0)
        c.lira_tr = float(data.get('lira_tr') or 0)
        c.save()
        return JsonResponse({'success': True, 'customer': _serialize(c)})

    if request.method == 'DELETE':
        c.is_deleted = True
        c.save()
        return JsonResponse({'success': True})

    return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)


def api_customer_restore(request, customer_id):
    err = _require_roles(request, 'M01')
    if err:
        return err
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)
    try:
        c = Customer.objects.get(pk=customer_id, is_deleted=True)
    except Customer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'العميل غير موجود'}, status=404)
    c.is_deleted = False
    c.save()
    return JsonResponse({'success': True})


def api_customer_force_delete(request, customer_id):
    err = _require_roles(request, 'M01')
    if err:
        return err
    if request.method != 'DELETE':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)
    try:
        c = Customer.objects.get(pk=customer_id)
    except Customer.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'العميل غير موجود'}, status=404)
    c.delete()
    return JsonResponse({}, status=204)
