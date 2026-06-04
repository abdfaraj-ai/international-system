import json
import logging
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.utils import timezone

from .models import ROLE_HOME, AuditLog, TellerProfile, PasswordResetToken
from core.permissions import (
    role_required as _role_required,
    check_rate_limit, get_client_ip,
    check_account_lockout, record_failed_login, reset_failed_logins,
)

security_log = logging.getLogger('intl.security')
app_log      = logging.getLogger('intl.app')


# ── Auth Views ────────────────────────────────────────────────────────────────

@ensure_csrf_cookie
def login_view(request):
    """صفحة تسجيل الدخول — GET فقط (المصادقة عبر /api/login/)."""
    if request.user.is_authenticated:
        return redirect(request.user.home_page)
    return render(request, 'pages/login.html')


@csrf_exempt
@require_POST
def api_login(request):
    """API endpoint: التحقق من بيانات الاعتماد وبدء الجلسة."""
    # ── Rate limiting: حماية من brute-force ──
    rate_err = check_rate_limit(get_client_ip(request))
    if rate_err:
        return rate_err

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'بيانات غير صالحة'}, status=400)

    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    role     = data.get('role', '').strip()

    if not username or not password or not role:
        return JsonResponse({'success': False, 'error': 'يرجى ملء جميع الحقول'})

    # ── Account lockout: حماية من brute-force بالحساب ──
    lockout_err = check_account_lockout(username)
    if lockout_err:
        return lockout_err

    user = authenticate(request, username=username, password=password)

    ip = get_client_ip(request)

    if user is None:
        record_failed_login(username)
        AuditLog.log('login_failed', request=request, actor=username,
                     detail=f'كلمة مرور خاطئة — الدور المُختار: {role}')
        security_log.warning('LOGIN_FAILED ip=%s username=%s reason=wrong_password', ip, username)
        return JsonResponse({'success': False, 'error': 'اسم المستخدم أو كلمة المرور غير صحيحة'})

    if not user.is_active:
        AuditLog.log('login_failed', request=request, actor=username,
                     detail='حساب معطّل')
        security_log.warning('LOGIN_FAILED ip=%s username=%s reason=inactive', ip, username)
        return JsonResponse({'success': False, 'error': 'هذا الحساب معطّل، يرجى التواصل مع المشرف'})

    if user.role != role:
        AuditLog.log('login_failed', request=request, actor=username,
                     detail=f'دور مُختار غير مطابق: {role} ≠ {user.role}')
        security_log.warning('LOGIN_FAILED ip=%s username=%s reason=role_mismatch selected=%s actual=%s',
                              ip, username, role, user.role)
        return JsonResponse({
            'success': False,
            'error': 'الصلاحية المختارة لا تتطابق مع حسابك في النظام'
        })

    # ── T01: يجب أن يكون مسجلاً في قائمة التلرات من قِبَل المشرف ──
    if user.role == 'T01':
        if not TellerProfile.objects.filter(username=username).exists():
            AuditLog.log('login_failed', request=request, actor=username,
                         detail='تلر غير مسجل في قائمة التلرات')
            security_log.warning('LOGIN_FAILED ip=%s username=%s reason=teller_not_registered', ip, username)
            return JsonResponse({
                'success': False,
                'error':   'حسابك غير مفعّل — يرجى التواصل مع المشرف لتفعيل حسابك'
            })

    # ── 2FA: إذا مفعّل — لا تُكمل تسجيل الدخول، انتظر الكود ──
    if user.totp_enabled:
        request.session['pending_2fa_user'] = user.username
        return JsonResponse({'success': True, 'requires_2fa': True})

    reset_failed_logins(username)
    login(request, user)
    request.session.modified = True
    request.session.save()
    AuditLog.log('login', request=request)
    security_log.info('LOGIN_SUCCESS ip=%s username=%s role=%s', ip, username, user.role)
    resp = JsonResponse({
        'success': True,
        'role':     user.role,
        'username': user.username,
        'name':     f'{user.first_name} {user.last_name}'.strip() or user.username,
        'home':     user.home_page,
    })
    resp['X-Session-Saved'] = 'ok'
    return resp


@csrf_exempt
@require_POST
def api_forgot_password(request):
    """POST /api/forgot-password/ — إرسال رابط إعادة تعيين كلمة المرور"""
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'بيانات غير صالحة'}, status=400)

    username = data.get('username', '').strip()
    if not username:
        return JsonResponse({'success': False, 'error': 'يرجى إدخال اسم المستخدم'})

    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({'success': True, 'message': 'إذا كان الحساب موجوداً سيصلك الرابط'})

    if not user.email:
        return JsonResponse({'success': False, 'error': 'لا يوجد بريد إلكتروني مرتبط بهذا الحساب'})

    from django.core.mail import send_mail
    from django.conf import settings
    import os

    token_obj   = PasswordResetToken.create_for(user)
    site_url    = os.environ.get('SITE_URL', 'https://international-system-production.up.railway.app')
    reset_link  = f'{site_url}/reset-password/?token={token_obj.token}'

    try:
        send_mail(
            subject='إعادة تعيين كلمة المرور — نظام انترناشونال',
            message=f'مرحباً {user.get_full_name() or user.username}،\n\nاضغط على الرابط التالي لإعادة تعيين كلمة المرور:\n{reset_link}\n\nالرابط صالح لمدة 30 دقيقة فقط.\n\nإذا لم تطلب هذا، تجاهل هذه الرسالة.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        security_log.info('PASSWORD_RESET_SENT username=%s email=%s', username, user.email)
        return JsonResponse({'success': True, 'message': 'تم إرسال رابط الاستعادة إلى بريدك الإلكتروني'})
    except Exception as e:
        security_log.error('PASSWORD_RESET_FAILED username=%s error=%s', username, e)
        return JsonResponse({'success': False, 'error': 'تعذر إرسال الإيميل، يرجى التواصل مع المشرف'}, status=500)


@csrf_exempt
def api_reset_password(request):
    """GET /reset-password/ — صفحة إعادة تعيين كلمة المرور
       POST /api/reset-password/ — حفظ كلمة المرور الجديدة"""
    if request.method == 'GET':
        return render(request, 'pages/reset_password.html')

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'success': False, 'error': 'بيانات غير صالحة'}, status=400)

        token_str    = data.get('token', '').strip()
        new_password = data.get('password', '').strip()

        if not token_str or not new_password:
            return JsonResponse({'success': False, 'error': 'بيانات ناقصة'})

        if len(new_password) < 6:
            return JsonResponse({'success': False, 'error': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'})

        try:
            token_obj = PasswordResetToken.objects.get(token=token_str)
        except PasswordResetToken.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'الرابط غير صالح'})

        if not token_obj.is_valid:
            return JsonResponse({'success': False, 'error': 'انتهت صلاحية الرابط، يرجى طلب رابط جديد'})

        token_obj.user.set_password(new_password)
        token_obj.user.save()
        token_obj.used = True
        token_obj.save()

        security_log.info('PASSWORD_RESET_SUCCESS username=%s', token_obj.user.username)
        return JsonResponse({'success': True, 'message': 'تم تغيير كلمة المرور بنجاح'})


@require_POST
def api_impersonate(request):
    """POST /api/impersonate/ — يسمح للمدير (M01) بالدخول بصلاحيات أي موظف."""
    from .models import SystemUser
    if not request.user.is_authenticated or request.user.role != 'M01':
        return JsonResponse({'success': False, 'error': 'غير مصرّح'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'بيانات غير صالحة'}, status=400)

    target_username = data.get('username', '').strip()
    target_password = data.get('password', '').strip()

    if not target_username or not target_password:
        return JsonResponse({'success': False, 'error': 'يرجى إدخال اسم المستخدم وكلمة المرور'})

    target_user = authenticate(request, username=target_username, password=target_password)
    if target_user is None:
        return JsonResponse({'success': False, 'error': 'بيانات الموظف غير صحيحة'})

    if not target_user.is_active:
        return JsonResponse({'success': False, 'error': 'حساب الموظف معطّل'})

    if target_user.role == 'M01':
        return JsonResponse({'success': False, 'error': 'لا يمكن انتحال صلاحية مدير آخر'})

    admin_username = request.user.username
    login(request, target_user)
    request.session['impersonated_by'] = admin_username
    request.session.modified = True
    request.session.save()

    ip = get_client_ip(request)
    AuditLog.log('impersonate', request=request,
                 detail=f'المدير {admin_username} دخل بصلاحية {target_user.username} ({target_user.role})')
    security_log.info('IMPERSONATE admin=%s target=%s role=%s ip=%s',
                      admin_username, target_user.username, target_user.role, ip)

    return JsonResponse({
        'success': True,
        'role':     target_user.role,
        'username': target_user.username,
        'name':     f'{target_user.first_name} {target_user.last_name}'.strip() or target_user.username,
        'home':     target_user.home_page,
    })


def logout_view(request):
    """تسجيل الخروج وإنهاء الجلسة."""
    if request.user.is_authenticated:
        security_log.info('LOGOUT username=%s', request.user.username)
    AuditLog.log('logout', request=request)
    logout(request)
    return redirect('/login/')


def api_me(request):
    """GET /api/me/ — بيانات المستخدم الحالي من الجلسة (session)."""
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'غير مسجّل الدخول'}, status=401)
    u = request.user
    return JsonResponse({
        'success':  True,
        'username': u.username,
        'name':     f'{u.first_name} {u.last_name}'.strip() or u.username,
        'role':     u.role,
        'roleName': u.role_name,
        'id':       u.id,
    })


# ── Page Views ────────────────────────────────────────────────────────────────

@ensure_csrf_cookie
@_role_required('M01')
def dashboard_view(request):
    return render(request, 'pages/dashboard.html')


@ensure_csrf_cookie
@_role_required('E01')
def daily_report_view(request):
    return render(request, 'pages/daily_report.html')


@ensure_csrf_cookie
@_role_required('M01')
def daily_reports_admin_view(request):
    return render(request, 'pages/daily_reports_admin.html')


@_role_required('T02', 'M01')
def accounts_view(request):
    return render(request, 'pages/accounts.html')


@_role_required('M01', 'M02', 'M03', 'T02', 'T03')
def accounts_manage_view(request):
    return render(request, 'pages/accounts_manage.html')


@_role_required('M01')
def users_manage_view(request):
    return render(request, 'pages/users_manage.html')


@_role_required('M01')
def permissions_manage_view(request):
    return render(request, 'pages/permissions_manage.html')


@_role_required('T01', 'M01')
def teller_departments_view(request):
    return render(request, 'pages/teller-departments.html')


@_role_required('M02', 'M01')
def teller_supervisor_view(request):
    return render(request, 'pages/teller-supervisor.html')


@_role_required('T03', 'M01')
def transactions_view(request):
    return render(request, 'pages/transactions.html')


@_role_required('M03', 'M01')
def transactions_supervisor_view(request):
    return render(request, 'pages/transactions-supervisor.html')

@_role_required('M03', 'M01')
def agent_dashboard_view(request):
    return render(request, 'pages/agent-dashboard.html')


@ensure_csrf_cookie
@_role_required('M01', 'IM01')
def tasks_admin_view(request):
    return render(request, 'pages/tasks-admin.html')


@ensure_csrf_cookie
@_role_required('M01', 'IM01', 'M02', 'M03', 'T01', 'T02', 'T03', 'P01')
def tasks_developer_view(request):
    return render(request, 'pages/tasks-developer.html')


# ── Client Portal ─────────────────────────────────────────────────────────────

@ensure_csrf_cookie
def portal_view(request):
    """بوابة الحوالات الخارجية — الصفحة الرئيسية."""
    from django.conf import settings
    return render(request, 'pages/portal.html', {
        'google_client_id': getattr(settings, 'GOOGLE_CLIENT_ID', ''),
    })


def portal_verify_view(request, token):
    """GET /portal/verify/<token>/ — يتحقق من رمز البريد ويبدأ الجلسة."""
    from .models import PortalToken
    try:
        tok = PortalToken.objects.get(token=token)
    except PortalToken.DoesNotExist:
        return redirect('/portal/?err=invalid')

    if not tok.is_valid:
        return redirect('/portal/?err=expired')

    tok.used = True
    tok.save(update_fields=['used'])

    request.session['portal_email']       = tok.email
    request.session['portal_verified_at'] = timezone.now().isoformat()

    return redirect('/portal/?ok=1')


@_role_required('M01')
def attendance_view(request):
    """صفحة الحضور والانصراف — مقيّدة بـ M01 فقط"""
    return render(request, 'pages/attendance.html')


@ensure_csrf_cookie
def agent_portal_login_view(request):
    """بوابة الوكيل الخارجي — صفحة تسجيل الدخول"""
    from .api.agent_portal import _agent_session
    if _agent_session(request):
        return redirect('/agent/portal/')
    return render(request, 'pages/agent_portal_login.html')


@ensure_csrf_cookie
def agent_portal_view(request):
    """بوابة الوكيل الخارجي — اللوحة الرئيسية"""
    from .api.agent_portal import _agent_session
    if not _agent_session(request):
        return redirect('/agent/login/')
    return render(request, 'pages/agent_portal.html')


@ensure_csrf_cookie
@_role_required('M01')
def accounting_launcher_view(request):
    """مشغّل النظام المحاسبي — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_safes_view(request):
    """جميع الصناديق — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_agents_view(request):
    """الوكلاء — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_transit_view(request):
    """العوابر — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_customers_view(request):
    """العملاء — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_cost_center_view(request):
    """المراكز — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_trash_view(request):
    """سلة المحذوفات — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_safe_movement_view(request):
    """حركة الصناديق — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_center_profits_view(request):
    """أرباح من المراكز — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_transfer_count_view(request):
    """عدد حوالات المراكز — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_entry_from_to_view(request):
    """قيد من الى — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_advanced_entry_view(request):
    """قيد متقدم — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_settlement_move_view(request):
    """حركة تسوية — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_opening_entry_view(request):
    """قيد افتتاحي — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_receipt_voucher_view(request):
    """سند قبض — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_payment_voucher_view(request):
    """سند دفع — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_currency_exchange_view(request):
    """تبديل عملة — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_outgoing_transfer_view(request):
    """حركة صادرة — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_new_credit_view(request):
    """اعتماد جديد — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_ops_monitor_view(request):
    """مراقبة العمليات — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_entry_audit_view(request):
    """تدقيق القيود — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_trial_balance_view(request):
    """ميزان المراجعة — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')


@ensure_csrf_cookie
@_role_required('M01')
def am_profit_per_safe_view(request):
    """أرباح من كل صندوق — M01 فقط"""
    return render(request, 'pages/accounting_launcher.html')
