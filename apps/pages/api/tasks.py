"""
tasks.py — نظام المهام الداخلي
IM01 / M01 : مدير المهام — ينشئ ويكلّف ويراجع
P01 / أي دور: يستلم المهام وينفّذها ويسلّمها
"""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from ..models import Task, TaskSubmission, TaskComment, SystemUser

MANAGER_ROLES = ('M01', 'IM01')


def _ok(data=None, **kw):
    return JsonResponse({'success': True, **(data or {}), **kw})


def _err(msg, status=400):
    return JsonResponse({'success': False, 'message': msg}, status=status)


def _require_login(request):
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)


# ── إنشاء مهمة — M01 فقط ─────────────────────────────────────────────────────
@csrf_exempt
def api_task_create(request):
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)
    if request.user.role not in ('M01', 'IM01'):
        return _err('للإدارة فقط', 403)
    if request.method != 'POST':
        return _err('Method Not Allowed', 405)

    title       = request.POST.get('title', '').strip()
    description = request.POST.get('description', '').strip()
    assigned_to = request.POST.get('assignedTo', '').strip()
    priority    = request.POST.get('priority', 'medium').strip()
    deadline    = request.POST.get('deadline', '').strip()

    if not title or not description or not assigned_to:
        return _err('العنوان والوصف والمكلَّف مطلوبون')

    try:
        assignee = SystemUser.objects.get(username=assigned_to)
    except SystemUser.DoesNotExist:
        return _err('المستخدم غير موجود')

    task = Task(
        title       = title,
        description = description,
        created_by  = request.user,
        assigned_to = assignee,
        priority    = priority,
    )
    if deadline:
        try:
            from django.utils.dateparse import parse_datetime
            task.deadline = parse_datetime(deadline)
        except Exception:
            pass
    if request.FILES.get('attachment'):
        task.attachment = request.FILES['attachment']

    task.save()

    # إشعار WebSocket للمبرمج فوراً
    try:
        from ..ws_utils import notify_user
        notify_user(
            assignee.username,
            title   = 'مهمة جديدة',
            message = f'تم إسناد مهمة إليك: {title}',
            level   = 'info',
        )
        from ..ws_utils import broadcast_task_event
        broadcast_task_event('task_assigned', task.to_dict())
    except Exception:
        pass

    return _ok({'task': task.to_dict()})


# ── قائمة المهام ──────────────────────────────────────────────────────────────
@csrf_exempt
def api_task_list(request):
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)
    if request.method != 'GET':
        return _err('Method Not Allowed', 405)

    user = request.user

    # المدير يرى كل المهام — غيره يرى مهامه فقط
    if user.role in MANAGER_ROLES:
        qs = Task.objects.select_related('created_by', 'assigned_to').all()
    else:
        qs = Task.objects.select_related('created_by', 'assigned_to').filter(
            assigned_to=user
        )

    # فلترة اختيارية
    status   = request.GET.get('status')
    priority = request.GET.get('priority')
    assigned = request.GET.get('assignedTo')

    if status:
        qs = qs.filter(status=status)
    if priority:
        qs = qs.filter(priority=priority)
    if assigned and user.role in MANAGER_ROLES:
        qs = qs.filter(assigned_to__username=assigned)

    tasks = [t.to_dict() for t in qs[:100]]
    return _ok({'tasks': tasks, 'total': len(tasks)})


# ── تفاصيل مهمة ──────────────────────────────────────────────────────────────
@csrf_exempt
def api_task_detail(request, task_id):
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)

    try:
        task = Task.objects.select_related('created_by', 'assigned_to').get(pk=task_id)
    except Task.DoesNotExist:
        return _err('المهمة غير موجودة', 404)

    # صلاحية الوصول
    user = request.user
    if user.role not in MANAGER_ROLES and task.assigned_to != user:
        return _err('غير مصرح', 403)

    if request.method == 'GET':
        return _ok({'task': task.to_dict(include_comments=True)})

    # PATCH — تغيير حالة (المبرمج يغيّر إلى in_progress فقط)
    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
        except Exception:
            return _err('بيانات غير صالحة')

        new_status = data.get('status')
        if new_status:
            allowed = {
                'M01': ['new', 'in_progress', 'accepted', 'rejected'],
            }
            # المبرمج يستطيع فقط تحديث إلى in_progress
            if user.role not in MANAGER_ROLES and new_status not in ['in_progress']:
                return _err('غير مصرح بتغيير هذه الحالة', 403)

            task.status = new_status
            if new_status == 'rejected':
                task.admin_notes = data.get('adminNotes', task.admin_notes)
            task.save()

            # إشعار
            try:
                from ..ws_utils import notify_user, broadcast_task_event
                target = task.assigned_to.username if user.role in MANAGER_ROLES else task.created_by.username
                labels = {'accepted': 'مقبولة ✓', 'rejected': 'مرفوضة ✗', 'in_progress': 'قيد التنفيذ'}
                notify_user(target, title='تحديث مهمة',
                            message=f'المهمة "{task.title}" — {labels.get(new_status, new_status)}',
                            level='success' if new_status == 'accepted' else 'warning')
                broadcast_task_event('task_updated', task.to_dict())
            except Exception:
                pass

        return _ok({'task': task.to_dict()})

    return _err('Method Not Allowed', 405)


# ── تسليم المهمة — المبرمج فقط ───────────────────────────────────────────────
@csrf_exempt
def api_task_submit(request, task_id):
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)
    if request.method != 'POST':
        return _err('Method Not Allowed', 405)

    try:
        task = Task.objects.select_related('created_by', 'assigned_to').get(pk=task_id)
    except Task.DoesNotExist:
        return _err('المهمة غير موجودة', 404)

    if task.assigned_to != request.user:
        return _err('غير مصرح', 403)

    if task.status not in ['new', 'in_progress', 'rejected']:
        return _err('لا يمكن تسليم مهمة بهذه الحالة')

    note = request.POST.get('note', '').strip()
    sub  = TaskSubmission(task=task, submitted_by=request.user, note=note)
    if request.FILES.get('file'):
        sub.file = request.FILES['file']
    sub.save()

    task.status = 'submitted'
    task.save()

    # إشعار المدير
    try:
        from ..ws_utils import notify_user, broadcast_task_event
        notify_user(
            task.created_by.username,
            title   = 'تسليم مهمة',
            message = f'المبرمج {request.user.username} سلّم المهمة: {task.title}',
            level   = 'success',
        )
        broadcast_task_event('task_submitted', task.to_dict())
    except Exception:
        pass

    return _ok({'task': task.to_dict(), 'submission': sub.to_dict()})


# ── إضافة تعليق ──────────────────────────────────────────────────────────────
@csrf_exempt
def api_task_comment(request, task_id):
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)
    if request.method != 'POST':
        return _err('Method Not Allowed', 405)

    try:
        task = Task.objects.select_related('created_by', 'assigned_to').get(pk=task_id)
    except Task.DoesNotExist:
        return _err('المهمة غير موجودة', 404)

    user = request.user
    if user.role not in MANAGER_ROLES and task.assigned_to != user:
        return _err('غير مصرح', 403)

    try:
        data = json.loads(request.body)
    except Exception:
        return _err('بيانات غير صالحة')

    body = data.get('body', '').strip()
    if not body:
        return _err('نص التعليق مطلوب')

    comment = TaskComment.objects.create(task=task, author=user, body=body)

    # إشعار الطرف الآخر
    try:
        from ..ws_utils import notify_user, broadcast_task_event
        target = task.assigned_to.username if user.role in MANAGER_ROLES else task.created_by.username
        notify_user(target, title='تعليق جديد على مهمة',
                    message=f'"{task.title}" — {user.username}: {body[:60]}',
                    level='info')
        broadcast_task_event('task_comment', {'taskId': task_id, 'comment': comment.to_dict()})
    except Exception:
        pass

    return _ok({'comment': comment.to_dict()})


# ── قائمة المستخدمين القابلين للتكليف — M01 فقط ─────────────────────────────
@csrf_exempt
def api_task_assignees(request):
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)
    if request.user.role not in ('M01', 'IM01'):
        return _err('للإدارة فقط', 403)

    users = SystemUser.objects.filter(is_active=True).exclude(
        username=request.user.username
    ).values('username', 'first_name', 'last_name', 'role')

    result = [
        {
            'username': u['username'],
            'name': f"{u['first_name']} {u['last_name']}".strip() or u['username'],
            'role': u['role'],
        }
        for u in users
    ]
    return _ok({'users': result})


# ── إدارة المبرمجين — IM01 يُضيف / يحذف / يعدّل P01 ─────────────────────────
@csrf_exempt
def api_task_developers(request):
    """
    GET  /api/tasks/developers/  ← قائمة المبرمجين (P01)
    POST /api/tasks/developers/  ← إضافة مبرمج جديد (IM01 فقط)
    """
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)
    if request.user.role not in MANAGER_ROLES:
        return _err('للإدارة فقط', 403)

    if request.method == 'GET':
        devs = SystemUser.objects.filter(role='P01', is_active=True).order_by('username')
        return _ok({'developers': [u.to_dict() for u in devs]})

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except Exception:
            return _err('بيانات غير صالحة')

        username   = (data.get('username') or '').strip()
        password   = (data.get('password') or '').strip()
        first_name = (data.get('firstName') or '').strip()
        last_name  = (data.get('lastName') or '').strip()
        email      = (data.get('email') or '').strip()

        if not username or not password:
            return _err('اسم المستخدم وكلمة المرور مطلوبان')
        if len(password) < 8:
            return _err('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
        if SystemUser.objects.filter(username=username).exists():
            return _err('اسم المستخدم مستخدم مسبقاً')

        user = SystemUser.objects.create_user(
            username   = username,
            password   = password,
            first_name = first_name,
            last_name  = last_name,
            email      = email,
            role       = 'P01',
        )
        return _ok({'developer': user.to_dict()}, status=201)

    return _err('Method Not Allowed', 405)


@csrf_exempt
def api_task_developer_detail(request, username):
    """
    PATCH  /api/tasks/developers/<username>/  ← تعديل البيانات
    DELETE /api/tasks/developers/<username>/  ← حذف المبرمج
    POST   /api/tasks/developers/<username>/password/ ← تغيير كلمة المرور
    """
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)
    if request.user.role not in MANAGER_ROLES:
        return _err('للإدارة فقط', 403)

    try:
        dev = SystemUser.objects.get(username=username, role='P01')
    except SystemUser.DoesNotExist:
        return _err('المبرمج غير موجود', 404)

    if request.method == 'GET':
        return _ok({'developer': dev.to_dict()})

    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
        except Exception:
            return _err('بيانات غير صالحة')
        changed = []
        for field, attr in [('firstName','first_name'),('lastName','last_name'),('email','email')]:
            if field in data:
                setattr(dev, attr, (data[field] or '').strip())
                changed.append(attr)
        if 'isActive' in data:
            dev.is_active = bool(data['isActive'])
            changed.append('is_active')
        if changed:
            dev.save(update_fields=changed)
        return _ok({'developer': dev.to_dict()})

    if request.method == 'DELETE':
        dev.delete()
        return _ok({'message': 'تم حذف المبرمج'})

    return _err('Method Not Allowed', 405)


@csrf_exempt
def api_task_developer_password(request, username):
    """POST /api/tasks/developers/<username>/password/"""
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)
    if request.user.role not in MANAGER_ROLES:
        return _err('للإدارة فقط', 403)
    try:
        dev = SystemUser.objects.get(username=username, role='P01')
    except SystemUser.DoesNotExist:
        return _err('المبرمج غير موجود', 404)
    if request.method != 'POST':
        return _err('Method Not Allowed', 405)
    try:
        data = json.loads(request.body)
    except Exception:
        return _err('بيانات غير صالحة')
    new_pw = (data.get('password') or '').strip()
    if len(new_pw) < 8:
        return _err('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    dev.set_password(new_pw)
    dev.save(update_fields=['password'])
    return _ok({'message': 'تم تغيير كلمة المرور'})


# ── إحصائيات المهام ───────────────────────────────────────────────────────────
@csrf_exempt
def api_task_stats(request):
    if not request.user.is_authenticated:
        return _err('غير مصرح', 403)

    user = request.user
    if user.role in MANAGER_ROLES:
        qs = Task.objects.all()
    else:
        qs = Task.objects.filter(assigned_to=user)

    stats = {
        'total':      qs.count(),
        'new':        qs.filter(status='new').count(),
        'inProgress': qs.filter(status='in_progress').count(),
        'submitted':  qs.filter(status='submitted').count(),
        'accepted':   qs.filter(status='accepted').count(),
        'rejected':   qs.filter(status='rejected').count(),
    }
    return _ok({'stats': stats})
