"""
accountant_report.py — API تقرير المحاسب (E01 + accountant)
"""
import json
from datetime import date, timedelta
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db import transaction, IntegrityError

from ..models import AccountantReport, SettlementGroup, AccountantReportAttachment

MAX_FILE_SIZE = 25 * 1024 * 1024
ALLOWED_EXT = {
    'images': {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'},
    'videos': {'mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'},
    'files':  {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'ppt', 'pptx'},
}


def _detect_kind(filename):
    ext = (filename.rsplit('.', 1)[-1] if '.' in filename else '').lower()
    for kind, exts in ALLOWED_EXT.items():
        if ext in exts:
            return kind, ext
    return None, ext


def _require_accountant(request):
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'غير مصرح'}, status=401)
    if not (request.user.role == 'E01' and request.user.employee_type == 'accountant'):
        return JsonResponse({'success': False, 'error': 'صلاحيات غير كافية'}, status=403)
    return None


def _require_m01(request):
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'غير مصرح'}, status=401)
    if request.user.role != 'M01':
        return JsonResponse({'success': False, 'error': 'صلاحيات غير كافية'}, status=403)
    return None


def _report_to_dict(r):
    groups = [
        {
            'id':        g.id,
            'name':      g.name,
            'country':   g.country,
            'movements': g.movements,
            'dayDate':   g.day_date.isoformat(),
        }
        for g in r.groups.all()
    ]
    attachments = [
        {
            'id':   a.id,
            'name': a.name or a.file.name.rsplit('/', 1)[-1],
            'url':  a.file.url if a.file else '',
            'kind': a.kind,
            'size': a.size,
        }
        for a in r.attachments.all()
    ]
    return {
        'id':          r.id,
        'accountant':  r.accountant.get_full_name() or r.accountant.username,
        'username':    r.accountant.username,
        'date':        r.date.isoformat(),
        'notes':       r.notes,
        'status':      r.status,
        'statusLabel': r.get_status_display(),
        'managerNote': r.manager_note,
        'createdAt':   r.created_at.strftime('%Y-%m-%d %H:%M'),
        'reviewedAt':  r.reviewed_at.strftime('%Y-%m-%d %H:%M') if r.reviewed_at else None,
        'reviewedBy':  r.reviewed_by.get_full_name() if r.reviewed_by else None,
        'groups':      groups,
        'attachments': attachments,
    }


# ── المحاسب: إرسال تقرير ──────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def api_submit(request):
    """POST /api/accountant-report/submit/ — إرسال تقرير المحاسب (multipart)"""
    err = _require_accountant(request)
    if err:
        return err

    if request.content_type and request.content_type.startswith('multipart'):
        notes      = request.POST.get('notes', '').strip()
        date_str   = request.POST.get('date', '')
        groups_raw = request.POST.get('groups', '[]')
        files      = request.FILES.getlist('attachments')
    else:
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'success': False, 'error': 'بيانات غير صالحة'}, status=400)
        notes      = data.get('notes', '').strip()
        date_str   = data.get('date', '')
        groups_raw = json.dumps(data.get('groups', []))
        files      = []

    try:
        groups = json.loads(groups_raw)
        if not isinstance(groups, list):
            groups = []
    except (json.JSONDecodeError, ValueError):
        groups = []

    if not notes and not groups:
        return JsonResponse({'success': False, 'error': 'يرجى إضافة مجموعات أو ملاحظات'})

    try:
        report_date = date.fromisoformat(date_str) if date_str else date.today()
    except ValueError:
        report_date = timezone.now().date()

    if AccountantReport.objects.filter(accountant=request.user, date=report_date).exists():
        return JsonResponse({'success': False, 'error': f'لقد أرسلت تقريراً بالفعل لتاريخ {report_date}'})

    # تحقق من المرفقات
    validated = []
    for f in files:
        if f.size > MAX_FILE_SIZE:
            return JsonResponse({'success': False, 'error': f'الملف {f.name} أكبر من 25MB'}, status=400)
        kind, _ = _detect_kind(f.name)
        if kind is None:
            return JsonResponse({'success': False, 'error': f'نوع الملف غير مدعوم: {f.name}'}, status=400)
        validated.append((f, kind))

    try:
        with transaction.atomic():
            report = AccountantReport.objects.create(
                accountant=request.user, date=report_date, notes=notes,
            )
            for g in groups:
                name = str(g.get('name', '')).strip()
                if not name:
                    continue
                try:
                    g_date = date.fromisoformat(g.get('dayDate', '')) if g.get('dayDate') else report_date
                except ValueError:
                    g_date = report_date
                SettlementGroup.objects.create(
                    report=report,
                    name=name,
                    country=str(g.get('country', '')).strip(),
                    movements=int(g.get('movements', 0) or 0),
                    day_date=g_date,
                )
            for f, kind in validated:
                AccountantReportAttachment.objects.create(
                    report=report, file=f, kind=kind, name=f.name, size=f.size,
                )
    except IntegrityError:
        return JsonResponse(
            {'success': False, 'error': f'لقد أرسلت تقريراً بالفعل لتاريخ {report_date}'},
            status=409,
        )

    # إشعار المدير
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        async_to_sync(get_channel_layer().group_send)('intl_general', {
            'type': 'broadcast',
            'data': {
                'type': 'new_accountant_report',
                'id':   report.id,
                'from': request.user.get_full_name() or request.user.username,
                'date': str(report_date),
            }
        })
    except Exception:
        pass

    return JsonResponse({'success': True, 'report': _report_to_dict(report)})


# ── المحاسب: تقاريري (آخر أسبوع) ──────────────────────────────────────────────

@require_http_methods(['GET'])
def api_my(request):
    """GET /api/accountant-report/my/ — تقارير المحاسب (آخر أسبوع)"""
    err = _require_accountant(request)
    if err:
        return err

    week_ago = timezone.now().date() - timedelta(days=7)
    reports = (AccountantReport.objects
               .filter(accountant=request.user, date__gte=week_ago)
               .prefetch_related('groups', 'attachments')
               .select_related('reviewed_by')
               .order_by('-date'))
    return JsonResponse({'success': True, 'reports': [_report_to_dict(r) for r in reports]})


# ── المدير: كل تقارير المحاسبين ───────────────────────────────────────────────

@require_http_methods(['GET'])
def api_all(request):
    """GET /api/accountant-report/all/ — كل تقارير المحاسبين (M01)"""
    err = _require_m01(request)
    if err:
        return err

    status_filter = request.GET.get('status', '').strip()
    qs = (AccountantReport.objects
          .select_related('accountant', 'reviewed_by')
          .prefetch_related('groups', 'attachments')
          .order_by('-created_at'))
    if status_filter:
        qs = qs.filter(status=status_filter)

    return JsonResponse({'success': True, 'reports': [_report_to_dict(r) for r in qs[:100]]})


# ── المدير: مراجعة ────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def api_review(request, report_id):
    """POST /api/accountant-report/<id>/review/ — مراجعة (M01)"""
    err = _require_m01(request)
    if err:
        return err

    try:
        report = AccountantReport.objects.get(id=report_id)
    except AccountantReport.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'التقرير غير موجود'}, status=404)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'بيانات غير صالحة'}, status=400)

    status = data.get('status', 'reviewed')
    note   = data.get('note', '').strip()
    if status not in ('reviewed', 'rejected'):
        return JsonResponse({'success': False, 'error': 'حالة غير صالحة'})

    report.status      = status
    report.manager_note = note
    report.reviewed_at = timezone.now()
    report.reviewed_by = request.user
    report.save(update_fields=['status', 'manager_note', 'reviewed_at', 'reviewed_by'])

    return JsonResponse({'success': True, 'report': _report_to_dict(report)})
