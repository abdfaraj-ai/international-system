"""
daily_report.py — API التقرير اليومي للموظفين (E01)
"""
import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db import transaction

from ..models import DailyReport, DailyReportAttachment

# الحد الأقصى لحجم المرفق الواحد (25MB) والأنواع المسموحة
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


def _require_e01(request):
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'غير مصرح'}, status=401)
    if request.user.role != 'E01':
        return JsonResponse({'success': False, 'error': 'صلاحيات غير كافية'}, status=403)
    return None


def _require_m01(request):
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'غير مصرح'}, status=401)
    if request.user.role != 'M01':
        return JsonResponse({'success': False, 'error': 'صلاحيات غير كافية'}, status=403)
    return None


def _report_to_dict(r):
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
        'id':           r.id,
        'employee':     r.employee.get_full_name() or r.employee.username,
        'username':     r.employee.username,
        'date':         r.date.isoformat(),
        'content':      r.content,
        'notes':        r.notes,
        'status':       r.status,
        'statusLabel':  r.get_status_display(),
        'managerNote':  r.manager_note,
        'createdAt':    r.created_at.strftime('%Y-%m-%d %H:%M'),
        'reviewedAt':   r.reviewed_at.strftime('%Y-%m-%d %H:%M') if r.reviewed_at else None,
        'reviewedBy':   r.reviewed_by.get_full_name() if r.reviewed_by else None,
        'attachments':  attachments,
    }


# ── E01: إرسال تقرير يومي ─────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def api_submit_report(request):
    """POST /api/daily-report/submit/ — إرسال تقرير يومي مع مرفقات (multipart)"""
    err = _require_e01(request)
    if err:
        return err

    # يقبل multipart/form-data (مع ملفات) أو JSON عادي
    if request.content_type and request.content_type.startswith('multipart'):
        content  = request.POST.get('content', '').strip()
        notes    = request.POST.get('notes', '').strip()
        date_str = request.POST.get('date', '')
        files    = request.FILES.getlist('attachments')
    else:
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'success': False, 'error': 'بيانات غير صالحة'}, status=400)
        content  = data.get('content', '').strip()
        notes    = data.get('notes', '').strip()
        date_str = data.get('date', '')
        files    = []

    if not content:
        return JsonResponse({'success': False, 'error': 'يرجى كتابة محتوى التقرير'})

    try:
        from datetime import date
        report_date = date.fromisoformat(date_str) if date_str else date.today()
    except ValueError:
        report_date = timezone.now().date()

    # تحقق من عدم وجود تقرير لنفس اليوم
    if DailyReport.objects.filter(employee=request.user, date=report_date).exists():
        return JsonResponse({'success': False, 'error': f'لقد أرسلت تقريراً بالفعل لتاريخ {report_date}'})

    # ── تحقق من المرفقات قبل الحفظ ──
    validated = []
    for f in files:
        if f.size > MAX_FILE_SIZE:
            return JsonResponse({'success': False, 'error': f'الملف {f.name} أكبر من 25MB'}, status=400)
        kind, ext = _detect_kind(f.name)
        if kind is None:
            return JsonResponse({'success': False, 'error': f'نوع الملف غير مدعوم: {f.name}'}, status=400)
        validated.append((f, kind))

    # ── حفظ ذرّي: التقرير + كل المرفقات معاً ──
    # نستخدم create() في حلقة (وليس bulk_create) لأن FileField
    # يحتاج save() لكتابة الملف فعلياً في التخزين
    with transaction.atomic():
        report = DailyReport.objects.create(
            employee=request.user,
            date=report_date,
            content=content,
            notes=notes,
        )
        for f, kind in validated:
            DailyReportAttachment.objects.create(
                report=report, file=f, kind=kind, name=f.name, size=f.size,
            )

    # إشعار المدير عبر WebSocket
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)('intl_general', {
            'type': 'broadcast',
            'data': {
                'type':    'new_daily_report',
                'id':      report.id,
                'from':    request.user.get_full_name() or request.user.username,
                'date':    str(report_date),
                'preview': content[:80],
            }
        })
    except Exception:
        pass

    return JsonResponse({'success': True, 'report': _report_to_dict(report)})


# ── E01: تقاريري ──────────────────────────────────────────────────────────────

@require_http_methods(['GET'])
def api_my_reports(request):
    """GET /api/daily-report/my/ — تقارير الموظف الحالي"""
    err = _require_e01(request)
    if err:
        return err

    reports = DailyReport.objects.filter(employee=request.user).order_by('-date')[:30]
    return JsonResponse({'success': True, 'reports': [_report_to_dict(r) for r in reports]})


# ── M01: كل التقارير ──────────────────────────────────────────────────────────

@require_http_methods(['GET'])
def api_all_reports(request):
    """GET /api/daily-report/all/ — كل التقارير (M01)"""
    err = _require_m01(request)
    if err:
        return err

    status_filter = request.GET.get('status', '')
    date_filter   = request.GET.get('date', '')

    qs = DailyReport.objects.select_related('employee', 'reviewed_by').order_by('-created_at')

    if status_filter:
        qs = qs.filter(status=status_filter)
    if date_filter:
        qs = qs.filter(date=date_filter)

    return JsonResponse({'success': True, 'reports': [_report_to_dict(r) for r in qs[:100]]})


# ── M01: مراجعة تقرير ─────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def api_review_report(request, report_id):
    """POST /api/daily-report/<id>/review/ — مراجعة تقرير"""
    err = _require_m01(request)
    if err:
        return err

    try:
        report = DailyReport.objects.get(id=report_id)
    except DailyReport.DoesNotExist:
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
