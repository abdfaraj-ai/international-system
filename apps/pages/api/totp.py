"""
totp.py — نظام المصادقة الثنائية (Google Authenticator)

POST /api/2fa/setup/    ← توليد مفتاح جديد وإرجاع QR code
POST /api/2fa/confirm/  ← التحقق من الكود وتفعيل 2FA
POST /api/2fa/verify/   ← التحقق عند تسجيل الدخول
POST /api/2fa/disable/  ← إلغاء تفعيل 2FA
GET  /api/2fa/status/   ← هل 2FA مفعّل؟
"""
import io
import base64
import pyotp
import qrcode
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import login

from ..models import SystemUser


def _user(request):
    if request.user and request.user.is_authenticated:
        return request.user
    return None


# ═══════════════════════════════════════════════════════
# 1. توليد مفتاح جديد + QR code
# ═══════════════════════════════════════════════════════
@csrf_exempt
def api_2fa_setup(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    user = _user(request)
    if not user:
        return JsonResponse({'success': False, 'message': 'غير مصرح'}, status=401)

    # توليد مفتاح جديد في كل مرة (لم يُحفظ بعد — يُحفظ عند التأكيد)
    secret = pyotp.random_base32()
    request.session['pending_totp_secret'] = secret

    totp = pyotp.TOTP(secret)
    issuer = 'انترناشونال'
    uri = totp.provisioning_uri(name=user.username, issuer_name=issuer)

    # توليد QR code كـ base64
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    return JsonResponse({
        'success': True,
        'secret':  secret,
        'qr':      f'data:image/png;base64,{qr_b64}',
        'uri':     uri,
    })


# ═══════════════════════════════════════════════════════
# 2. تأكيد الكود وحفظ المفتاح
# ═══════════════════════════════════════════════════════
@csrf_exempt
def api_2fa_confirm(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    user = _user(request)
    if not user:
        return JsonResponse({'success': False, 'message': 'غير مصرح'}, status=401)

    import json
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    code   = str(data.get('code', '')).strip()
    secret = request.session.get('pending_totp_secret', '')

    if not secret:
        return JsonResponse({'success': False, 'message': 'لم يتم بدء الإعداد'}, status=400)

    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        return JsonResponse({'success': False, 'message': 'الكود غير صحيح'})

    user.totp_secret  = secret
    user.totp_enabled = True
    user.save(update_fields=['totp_secret', 'totp_enabled'])
    del request.session['pending_totp_secret']

    return JsonResponse({'success': True, 'message': 'تم تفعيل المصادقة الثنائية بنجاح'})


# ═══════════════════════════════════════════════════════
# 3. التحقق عند تسجيل الدخول
# ═══════════════════════════════════════════════════════
@csrf_exempt
def api_2fa_verify(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    import json
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    code     = str(data.get('code', '')).strip()
    username = request.session.get('pending_2fa_user')

    if not username:
        return JsonResponse({'success': False, 'message': 'انتهت الجلسة'}, status=400)

    try:
        user = SystemUser.objects.get(username=username)
    except SystemUser.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'المستخدم غير موجود'}, status=404)

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code, valid_window=1):
        return JsonResponse({'success': False, 'message': 'الكود غير صحيح أو منتهي الصلاحية'})

    # إتمام تسجيل الدخول
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    del request.session['pending_2fa_user']

    return JsonResponse({
        'success':  True,
        'role':     user.role,
        'username': user.username,
        'name':     f'{user.first_name} {user.last_name}'.strip() or user.username,
        'redirect': user.home_page,
    })


# ═══════════════════════════════════════════════════════
# 4. إلغاء تفعيل 2FA
# ═══════════════════════════════════════════════════════
@csrf_exempt
def api_2fa_disable(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    user = _user(request)
    if not user:
        return JsonResponse({'success': False, 'message': 'غير مصرح'}, status=401)

    import json
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    password = data.get('password', '')
    if not user.check_password(password):
        return JsonResponse({'success': False, 'message': 'كلمة المرور غير صحيحة'})

    user.totp_secret  = ''
    user.totp_enabled = False
    user.save(update_fields=['totp_secret', 'totp_enabled'])

    return JsonResponse({'success': True, 'message': 'تم إلغاء المصادقة الثنائية'})


# ═══════════════════════════════════════════════════════
# 5. حالة 2FA للمستخدم الحالي
# ═══════════════════════════════════════════════════════
def api_2fa_status(request):
    user = _user(request)
    if not user:
        return JsonResponse({'success': False, 'message': 'غير مصرح'}, status=401)
    return JsonResponse({'success': True, 'enabled': user.totp_enabled})
