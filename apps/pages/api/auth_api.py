"""
auth_api.py — مصادقة تطبيق Flutter
POST /api/auth/login/   ← تسجيل الدخول → يرجع token + بيانات المستخدم
GET  /api/auth/me/      ← جلب بيانات المستخدم الحالي
POST /api/auth/logout/  ← تسجيل الخروج وإلغاء الـ token
"""
import secrets
import hashlib
from datetime import timedelta

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.contrib.auth import authenticate
from django.utils import timezone
from django.conf import settings

from ..models import SystemUser, FlutterAuthToken


# ── الصلاحيات المسموحة لكل دور ───────────────────────────────────────────────

ROLE_PERMISSIONS = {
    # الإدارة العامة ومدير البرمجة — صلاحية كاملة
    'M01':  ['voice_execute', 'voice_rates', 'ocr', 'upload', 'rates', 'dashboard'],
    'IM01': ['voice_execute', 'voice_rates', 'ocr', 'upload', 'rates', 'dashboard'],
    # مشرفو التلر والحوالات — الأسعار فقط، لا تنفيذ أوامر التلر
    'M02': ['voice_rates', 'ocr', 'upload', 'rates'],
    'M03': ['voice_rates', 'ocr', 'upload', 'rates'],
    # التلر — تنفيذ الأوامر فقط، لا تحديث الأسعار
    'T01': ['voice_execute', 'ocr', 'upload', 'rates'],
    'T02': ['voice_execute', 'ocr', 'upload', 'rates'],
    'T03': ['voice_execute', 'ocr', 'upload', 'rates'],
    'P01': ['voice_execute', 'ocr', 'upload', 'rates'],
}

# الأدوار التي تملك صلاحية تحديث الأسعار
SUPERVISOR_ROLES = {'M01', 'M02', 'M03', 'IM01'}

TOKEN_EXPIRY_HOURS = 12


def _require_app_key(request):
    expected = getattr(settings, 'FLUTTER_API_KEY', '')
    if not expected:
        return JsonResponse({'success': False, 'message': 'FLUTTER_API_KEY غير مضبوط'}, status=503)
    provided = request.headers.get('X-App-Key', '')
    if not provided or provided != expected:
        return JsonResponse({'success': False, 'message': 'مفتاح التطبيق غير صالح'}, status=401)
    return None


def require_flutter_auth(request):
    """
    يتحقق من X-App-Key + Authorization: Bearer <token>
    يرجع (None, user) عند النجاح أو (JsonResponse, None) عند الفشل
    """
    err = _require_app_key(request)
    if err:
        return err, None

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول أولاً'}, status=401), None

    raw_token = auth_header.split(' ', 1)[1].strip()
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    try:
        token_obj = FlutterAuthToken.objects.select_related('user').get(
            token_hash=token_hash,
            is_active=True,
        )
    except FlutterAuthToken.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الجلسة غير صالحة، سجّل الدخول مجدداً'}, status=401), None

    if token_obj.expires_at < timezone.now():
        token_obj.is_active = False
        token_obj.save(update_fields=['is_active'])
        return JsonResponse({'success': False, 'message': 'انتهت صلاحية الجلسة، سجّل الدخول مجدداً'}, status=401), None

    if not token_obj.user.is_active:
        return JsonResponse({'success': False, 'message': 'الحساب موقوف، تواصل مع المشرف'}, status=403), None

    # تحديث آخر استخدام
    token_obj.last_used = timezone.now()
    token_obj.save(update_fields=['last_used'])

    return None, token_obj.user


def require_supervisor(request):
    """يتحقق من تسجيل الدخول + صلاحية المشرف"""
    err, user = require_flutter_auth(request)
    if err:
        return err, None
    if user.role not in SUPERVISOR_ROLES and not user.is_superuser:
        return JsonResponse({'success': False, 'message': 'هذه الصلاحية للمشرفين فقط'}, status=403), None
    return None, user


# ── تسجيل الدخول ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_POST
def api_login(request):
    """POST /api/auth/login/ — يستقبل username + password ويرجع token"""
    import json

    err = _require_app_key(request)
    if err:
        return err

    try:
        body = json.loads(request.body)
        username = (body.get('username') or '').strip()
        password = (body.get('password') or '')
    except Exception:
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    if not username or not password:
        return JsonResponse({'success': False, 'message': 'أدخل اسم المستخدم وكلمة المرور'}, status=400)

    user = authenticate(username=username, password=password)

    if user is None:
        return JsonResponse({'success': False, 'message': 'اسم المستخدم أو كلمة المرور غلط'}, status=401)

    if not user.is_active:
        return JsonResponse({'success': False, 'message': 'الحساب موقوف، تواصل مع المشرف'}, status=403)

    # إلغاء الجلسات القديمة لنفس المستخدم على هذا الجهاز (اختياري — يمنع تعدد الجلسات)
    device_id = request.headers.get('X-Device-Id', '')
    if device_id:
        FlutterAuthToken.objects.filter(user=user, device_id=device_id, is_active=True).update(is_active=False)

    # إنشاء token جديد
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = timezone.now() + timedelta(hours=TOKEN_EXPIRY_HOURS)

    FlutterAuthToken.objects.create(
        user=user,
        token_hash=token_hash,
        device_id=device_id,
        expires_at=expires_at,
        last_used=timezone.now(),
    )

    permissions = ROLE_PERMISSIONS.get(user.role, ['voice_execute', 'rates'])

    return JsonResponse({
        'success': True,
        'token': raw_token,
        'expires_at': expires_at.isoformat(),
        'user': {
            'id': user.id,
            'username': user.username,
            'name': user.get_full_name() or user.username,
            'role': user.role,
            'role_name': user.role_name,
            'is_supervisor': user.role in SUPERVISOR_ROLES or user.is_superuser,
            'permissions': permissions,
        },
    })


# ── بيانات المستخدم الحالي ────────────────────────────────────────────────────

@csrf_exempt
def api_me(request):
    """GET /api/auth/me/ — يرجع بيانات المستخدم المسجّل"""
    err, user = require_flutter_auth(request)
    if err:
        return err

    permissions = ROLE_PERMISSIONS.get(user.role, ['voice_execute', 'rates'])

    return JsonResponse({
        'success': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'name': user.get_full_name() or user.username,
            'role': user.role,
            'role_name': user.role_name,
            'is_supervisor': user.role in SUPERVISOR_ROLES or user.is_superuser,
            'permissions': permissions,
        },
    })


# ── تسجيل الخروج ─────────────────────────────────────────────────────────────

@csrf_exempt
@require_POST
def api_logout(request):
    """POST /api/auth/logout/ — يلغي الـ token الحالي"""
    err = _require_app_key(request)
    if err:
        return err

    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        raw_token = auth_header.split(' ', 1)[1].strip()
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        FlutterAuthToken.objects.filter(token_hash=token_hash).update(is_active=False)

    return JsonResponse({'success': True, 'message': 'تم تسجيل الخروج'})
