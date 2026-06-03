"""
portal.py — API endpoints for the public client portal
  - Google OAuth (Sign in with Google)
  - Magic-link fallback via email
"""
import json
import re
import time
import urllib.request
import urllib.parse
from collections import defaultdict
from threading import Lock

from django.conf import settings
from django.core.mail import send_mail
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from core.permissions import parse_json, get_client_ip, role_required
from ..models import PortalToken, PortalCountry, PortalReceivingMethod, PortalTransferRequest


# ── Rate limiter: max 3 emails per address per 10 minutes ─────────────────────
_lock    = Lock()
_buckets: dict[str, list[float]] = defaultdict(list)
_WINDOW  = 600   # 10 min
_MAX     = 3


def _rate_ok(email: str) -> bool:
    now = time.time()
    with _lock:
        _buckets[email] = [t for t in _buckets[email] if now - t < _WINDOW]
        if len(_buckets[email]) >= _MAX:
            return False
        _buckets[email].append(now)
    return True


# ── Views ──────────────────────────────────────────────────────────────────────

@csrf_exempt
def api_portal_request_access(request):
    """POST /api/portal/request-access/ — send magic link to email."""
    if request.method != 'POST':
        return JsonResponse({'success': False}, status=405)

    data, err = parse_json(request)
    if err:
        return err

    email = data.get('email', '').strip().lower()

    # Basic validation
    if not email or '@' not in email or '.' not in email.split('@')[-1]:
        return JsonResponse(
            {'success': False, 'message': 'يرجى إدخال بريد إلكتروني صحيح'},
            status=400
        )

    # Rate limit
    if not _rate_ok(email):
        return JsonResponse(
            {'success': False,
             'message': 'تم إرسال عدة روابط مؤخراً. انتظر 10 دقائق ثم حاول مجدداً.'},
            status=429
        )

    ip  = get_client_ip(request)
    tok = PortalToken.create_for(email, ip=ip)

    scheme = 'https' if request.is_secure() else 'http'
    link   = f'{scheme}://{request.get_host()}/portal/verify/{tok.token}/'

    try:
        send_mail(
            subject      = 'رابط الدخول — بوابة الحوالات',
            message      = _text_body(link, tok.EXPIRY_MINUTES),
            from_email   = None,   # DEFAULT_FROM_EMAIL
            recipient_list = [email],
            html_message = _html_body(link, tok.EXPIRY_MINUTES),
            fail_silently  = False,
        )
        return JsonResponse({'success': True})
    except Exception:
        return JsonResponse(
            {'success': False,
             'message': 'تعذّر إرسال البريد. يرجى التواصل معنا مباشرة.'},
            status=500
        )


@csrf_exempt
def api_portal_google_auth(request):
    """POST /api/portal/google-auth/ — verify Google ID token and start session."""
    if request.method != 'POST':
        return JsonResponse({'success': False}, status=405)

    client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '').strip()
    if not client_id:
        return JsonResponse(
            {'success': False, 'message': 'لم يتم إعداد Google auth بعد'},
            status=503
        )

    data, err = parse_json(request)
    if err:
        return err

    credential = data.get('credential', '').strip()
    if not credential:
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    user_info = _verify_google_token(credential, client_id)
    if not user_info:
        return JsonResponse(
            {'success': False, 'message': 'تعذّر التحقق من الهوية — حاول مجدداً'},
            status=401
        )

    email   = user_info.get('email', '').lower()
    name    = user_info.get('name', '')
    picture = user_info.get('picture', '')

    if not email:
        return JsonResponse(
            {'success': False, 'message': 'لم يُسمح بالوصول إلى البريد الإلكتروني'},
            status=400
        )

    request.session['portal_email']       = email
    request.session['portal_name']        = name
    request.session['portal_picture']     = picture
    request.session['portal_verified_at'] = timezone.now().isoformat()

    return JsonResponse({'success': True, 'email': email, 'name': name, 'picture': picture})


@csrf_exempt
def api_portal_session(request):
    """GET /api/portal/session/ — returns current portal session."""
    email = request.session.get('portal_email')
    if not email:
        return JsonResponse({'success': False}, status=401)
    return JsonResponse({
        'success': True,
        'email':   email,
        'name':    request.session.get('portal_name', ''),
        'picture': request.session.get('portal_picture', ''),
    })


@csrf_exempt
def api_portal_logout(request):
    """POST /api/portal/logout/ — ends portal session."""
    for key in ('portal_email', 'portal_name', 'portal_picture', 'portal_verified_at'):
        request.session.pop(key, None)
    return JsonResponse({'success': True})


# ── Public config endpoint ─────────────────────────────────────────────────────

@csrf_exempt
def api_portal_config(request):
    """GET /api/portal/config/ — returns active countries + methods + rates."""
    countries = (
        PortalCountry.objects
        .filter(is_active=True)
        .prefetch_related('methods')
        .order_by('order', 'name')
    )
    return JsonResponse({'success': True, 'countries': [c.to_dict() for c in countries]})


# ── Supervisor management endpoints (M02 / M01) ───────────────────────────────

@role_required('M02', 'M01')
def api_sv_portal_countries(request):
    """GET /api/sv/portal/countries  — list all (incl. inactive)
       POST                          — create new country"""
    if request.method == 'GET':
        qs = PortalCountry.objects.prefetch_related('methods').order_by('order', 'name')
        # إصلاح تلقائي: أي دولة slug فارغ → نولّد لها slug وندفعه للقاعدة
        for c in qs:
            if not c.slug:
                base = re.sub(r'[^a-z0-9]', '', (c.currency or c.name or 'x').lower())[:8] or 'ctry'
                candidate = base; n = 1
                while PortalCountry.objects.filter(slug=candidate).exclude(pk=c.pk).exists():
                    candidate = f'{base}{n}'; n += 1
                c.slug = candidate
                c.save(update_fields=['slug'])
        return JsonResponse({'success': True, 'countries': [_country_full(c) for c in qs]})

    data, err = parse_json(request)
    if err:
        return err

    name     = (data.get('name') or '').strip()
    currency = (data.get('currency') or '').strip().upper()
    if not name or not currency:
        return JsonResponse({'success': False, 'error': 'name, currency مطلوبان'}, status=400)

    # توليد slug تلقائي من الاسم + العملة (ASCII فقط)
    slug_base = re.sub(r'[^a-z0-9]', '', currency.lower()) or re.sub(r'[^a-z0-9]', '', name.lower()[:8])
    if not slug_base:
        return JsonResponse({'success': False, 'error': 'تعذّر توليد معرّف للدولة — تأكد من كتابة اسم الدولة أو العملة باللغة الإنجليزية'}, status=400)

    slug = slug_base
    n = 1
    while PortalCountry.objects.filter(slug=slug).exists():
        slug = f'{slug_base}{n}'; n += 1

    country = PortalCountry.objects.create(
        slug       = slug,
        name       = name,
        flag       = '🏳',
        currency   = currency,
        rate       = data.get('rate', 1),
        rate_note  = '',
        is_active  = data.get('isActive', True),
        order      = data.get('order', 0),
        updated_by = request.user.username,
    )
    return JsonResponse({'success': True, 'country': _country_full(country)}, status=201)


@role_required('M02', 'M01')
def api_sv_portal_country_detail(request, slug):
    """GET/PUT/DELETE /api/sv/portal/countries/<slug>"""
    try:
        country = PortalCountry.objects.prefetch_related('methods').get(slug=slug)
    except PortalCountry.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'country': _country_full(country)})

    if request.method == 'DELETE':
        country.delete()
        return JsonResponse({'success': True})

    # PUT
    data, err = parse_json(request)
    if err:
        return err

    for field, key in [('name','name'), ('currency','currency'),
                       ('rate','rate'), ('is_active','isActive'), ('order','order')]:
        if key in data:
            val = data[key]
            if key == 'currency':
                val = val.strip().upper()
            elif isinstance(val, str):
                val = val.strip()
            setattr(country, field, val)

    country.updated_by = request.user.username
    country.save()
    return JsonResponse({'success': True, 'country': _country_full(country)})


@role_required('M02', 'M01')
def api_sv_portal_methods(request, slug):
    """GET /api/sv/portal/countries/<slug>/methods  — list methods
       POST                                         — add method"""
    try:
        country = PortalCountry.objects.get(slug=slug)
    except PortalCountry.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'الدولة غير موجودة'}, status=404)

    if request.method == 'GET':
        methods = country.methods.order_by('order')
        return JsonResponse({'success': True, 'methods': [m.to_dict() for m in methods]})

    data, err = parse_json(request)
    if err:
        return err

    if not data.get('name'):
        return JsonResponse({'success': False, 'error': 'اسم الطريقة مطلوب'}, status=400)

    method = PortalReceivingMethod.objects.create(
        country     = country,
        name        = data['name'].strip(),
        bank        = data.get('bank', '').strip(),
        iban        = data.get('iban', '').strip(),
        beneficiary = data.get('beneficiary', '').strip(),
        extra_label = data.get('extraLabel', '').strip(),
        extra_value = data.get('extraValue', '').strip(),
        is_active   = data.get('isActive', True),
        order       = data.get('order', 0),
    )
    return JsonResponse({'success': True, 'method': method.to_dict()}, status=201)


@role_required('M02', 'M01')
def api_sv_portal_method_detail(request, method_id):
    """GET/PUT/DELETE /api/sv/portal/methods/<id>"""
    try:
        method = PortalReceivingMethod.objects.select_related('country').get(id=method_id)
    except PortalReceivingMethod.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'method': method.to_dict()})

    if request.method == 'DELETE':
        method.delete()
        return JsonResponse({'success': True})

    # PUT
    data, err = parse_json(request)
    if err:
        return err

    for field, key in [('name','name'), ('bank','bank'), ('iban','iban'),
                       ('beneficiary','beneficiary'), ('extra_label','extraLabel'),
                       ('extra_value','extraValue'), ('is_active','isActive'),
                       ('order','order')]:
        if key in data:
            val = data[key]
            if isinstance(val, str):
                val = val.strip()
            setattr(method, field, val)

    method.save()
    return JsonResponse({'success': True, 'method': method.to_dict()})


# ── Helper ────────────────────────────────────────────────────────────────────

def _country_full(c: PortalCountry) -> dict:
    return {
        'id':        c.slug,
        'name':      c.name,
        'flag':      c.flag,
        'currency':  c.currency,
        'rate':      float(c.rate),
        'rateNote':  c.rate_note,
        'isActive':  c.is_active,
        'order':     c.order,
        'updatedBy': c.updated_by,
        'updatedAt': c.updated_at.strftime('%Y-%m-%d %H:%M') if c.updated_at else '',
        'methods':   [m.to_dict() for m in c.methods.order_by('order')],
    }


# ── Portal submit ─────────────────────────────────────────────────────────────

@csrf_exempt
def api_portal_submit(request):
    """POST /api/portal/submit/ — العميل يرفع طلب حوالة مع صورة الإيصال."""
    if request.method != 'POST':
        return JsonResponse({'success': False}, status=405)

    # التحقق من الجلسة
    email = request.session.get('portal_email')
    if not email:
        return JsonResponse({'success': False, 'error': 'غير مسجّل الدخول'}, status=401)

    receipt = request.FILES.get('receipt')
    if not receipt:
        return JsonResponse({'success': False, 'error': 'صورة الإيصال مطلوبة'}, status=400)

    # التحقق من حجم الملف (10 MB)
    if receipt.size > 10 * 1024 * 1024:
        return JsonResponse({'success': False, 'error': 'حجم الملف يتجاوز 10 MB'}, status=400)

    country_id  = request.POST.get('countryId', '').strip()
    method_name = request.POST.get('methodName', '').strip()
    currency    = request.POST.get('currency', '').strip()

    # جلب الدولة
    country_obj  = None
    country_name = country_id
    if country_id:
        try:
            country_obj  = PortalCountry.objects.get(slug=country_id)
            country_name = country_obj.name
            if not currency:
                currency = country_obj.currency
        except PortalCountry.DoesNotExist:
            pass

    req = PortalTransferRequest.objects.create(
        tracking_code = PortalTransferRequest.generate_code(),
        client_email  = email,
        client_name   = request.session.get('portal_name', ''),
        country       = country_obj,
        country_name  = country_name,
        method_name   = method_name,
        currency      = currency,
        receipt       = receipt,
        ip_address    = get_client_ip(request),
    )

    # ── WebSocket: أبلغ موظفي الحوالات فورًا ─────────────────────────────
    from ..ws_utils import broadcast_portal_request
    broadcast_portal_request({
        'id':           req.id,
        'trackingCode': req.tracking_code,
        'clientEmail':  req.client_email,
        'clientName':   req.client_name,
        'countryName':  req.country_name,
        'methodName':   req.method_name,
        'currency':     req.currency,
        'createdAt':    req.created_at.isoformat(),
    })

    return JsonResponse({
        'success':      True,
        'trackingCode': req.tracking_code,
        'id':           req.id,
    }, status=201)


@csrf_exempt
def api_portal_track(request):
    """GET /api/portal/track/?code=XXXX-YYYY — يتحقق العميل من حالة طلبه.
    يتحقق أن البريد في الجلسة يطابق بريد الطلب (لا يمكن تتبع طلبات الآخرين).
    """
    code = request.GET.get('code', '').strip().upper()
    if not code:
        return JsonResponse({'success': False, 'error': 'رمز التتبع مطلوب'}, status=400)

    # التحقق من هوية العميل عبر الجلسة
    session_email = request.session.get('portal_email', '')
    if not session_email:
        return JsonResponse({'success': False, 'error': 'يجب تسجيل الدخول للبوابة أولاً'}, status=401)

    try:
        req = PortalTransferRequest.objects.get(tracking_code=code)
    except PortalTransferRequest.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'رمز التتبع غير موجود'}, status=404)

    # تأكد أن الطلب يخص نفس العميل المسجّل
    if req.client_email.lower() != session_email.lower():
        return JsonResponse({'success': False, 'error': 'رمز التتبع غير موجود'}, status=404)

    return JsonResponse({
        'success':      True,
        'trackingCode': req.tracking_code,
        'status':       req.status,
        'statusLabel':  req.get_status_display(),
        'countryName':  req.country_name,
        'methodName':   req.method_name,
        'createdAt':    req.created_at.strftime('%Y-%m-%d %H:%M'),
    })


# ── Staff endpoints — موظف الحوالات (T03 / M03) ───────────────────────────────

@role_required('T03', 'M03', 'M01')
def api_ts_portal_requests(request):
    """GET  /api/ts/portal-requests/  — قائمة الطلبات
       POST /api/ts/portal-requests/  — غير مستخدم"""
    status_filter = request.GET.get('status', '')
    qs = PortalTransferRequest.objects.select_related('country').order_by('-created_at')
    if status_filter:
        qs = qs.filter(status=status_filter)

    return JsonResponse({
        'success':  True,
        'requests': [r.to_dict() for r in qs],
        'counts': {
            'new':       PortalTransferRequest.objects.filter(status='new').count(),
            'reviewing': PortalTransferRequest.objects.filter(status='reviewing').count(),
            'done':      PortalTransferRequest.objects.filter(status='done').count(),
            'rejected':  PortalTransferRequest.objects.filter(status='rejected').count(),
        },
    })


@role_required('T03', 'M03', 'M01')
def api_ts_portal_request_detail(request, req_id):
    """GET /api/ts/portal-requests/<id>/   — تفاصيل طلب
       PUT /api/ts/portal-requests/<id>/   — تحديث الحالة / الملاحظات"""
    try:
        req = PortalTransferRequest.objects.select_related('country').get(id=req_id)
    except PortalTransferRequest.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'الطلب غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'request': req.to_dict()})

    # PUT — تحديث الحالة
    data, err = parse_json(request)
    if err:
        return err

    new_status = data.get('status', '').strip()
    if new_status:
        valid = [s for s, _ in PortalTransferRequest.STATUS_CHOICES]
        if new_status not in valid:
            return JsonResponse({'success': False, 'error': 'حالة غير صالحة'}, status=400)

        # انتقالات الحالة المسموح بها
        _TRANSITIONS = {
            'new':       {'reviewing', 'rejected'},
            'reviewing': {'done', 'rejected', 'new'},
            'done':      set(),          # نهائية — لا تراجع
            'rejected':  {'reviewing'},  # يمكن إعادة فتحه
        }
        allowed = _TRANSITIONS.get(req.status, set())
        if new_status not in allowed:
            return JsonResponse({
                'success': False,
                'error':   f'لا يمكن الانتقال من "{req.status}" إلى "{new_status}"',
            }, status=400)

        req.status     = new_status
        req.handled_by = request.user.username
        req.handled_at = timezone.now()

    if 'notes' in data:
        req.notes = data['notes'].strip()

    req.save()
    return JsonResponse({'success': True, 'request': req.to_dict()})


@role_required('M01')
def api_portal_forward(request, req_id):
    """POST /api/portal-requests/<id>/forward/
    يوجّه إشعار إيصال البوابة إلى موظف (T02 أو T03).
    Body JSON: { "toUserId": <int>, "note": "<str>" }
    """
    from ..models import SystemUser
    try:
        req = PortalTransferRequest.objects.get(id=req_id)
    except PortalTransferRequest.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'الطلب غير موجود'}, status=404)

    data, err = parse_json(request)
    if err:
        return err

    user_id = data.get('toUserId')
    if not user_id:
        return JsonResponse({'success': False, 'error': 'يرجى تحديد الموظف'}, status=400)

    try:
        target = SystemUser.objects.get(id=user_id, role__in=['T02', 'T03'])
    except SystemUser.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'الموظف غير موجود أو غير مؤهل'}, status=404)

    req.forwarded_to   = target
    req.forwarded_at   = timezone.now()
    req.forwarded_by   = request.user.username
    req.forwarded_note = data.get('note', '').strip()
    if req.status == 'new':
        req.status = 'reviewing'
    req.save()

    # إشعار WebSocket للموظف المستهدف
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f'user_{target.id}',
                {
                    'type': 'portal_receipt',
                    'data': {
                        'type':         'portal_receipt_forwarded',
                        'requestId':    req.id,
                        'trackingCode': req.tracking_code,
                        'clientName':   req.client_name,
                        'countryName':  req.country_name,
                        'currency':     req.currency,
                        'receipt':      req.receipt.url if req.receipt else None,
                        'note':         req.forwarded_note,
                    }
                }
            )
    except Exception:
        pass

    return JsonResponse({'success': True, 'request': req.to_dict()})


@role_required('T02', 'T03', 'M01')
def api_my_portal_receipts(request):
    """GET /api/my-portal-receipts/
    يُرجع الإشعارات الموجَّهة لهذا الموظف.
    Query param: ?done=1 لإظهار المنجزة أيضاً
    """
    show_done = request.GET.get('done', '') == '1'
    qs = PortalTransferRequest.objects.filter(
        forwarded_to=request.user
    ).select_related('country').order_by('-forwarded_at')

    if not show_done:
        qs = qs.exclude(status__in=['done', 'rejected'])

    return JsonResponse({
        'success':  True,
        'receipts': [r.to_dict() for r in qs],
        'count':    qs.count(),
    })


# ── Google token verification (no extra dependencies) ─────────────────────────

def _verify_google_token(credential: str, client_id: str) -> dict | None:
    """
    Verifies a Google ID token by calling Google's tokeninfo endpoint.
    Returns the decoded payload dict, or None if invalid.
    """
    url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + urllib.parse.quote(credential)
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            payload = json.loads(resp.read().decode())
        # Verify the token was issued for our app
        if payload.get('aud') != client_id:
            return None
        # email_verified must be true
        if payload.get('email_verified') not in (True, 'true'):
            return None
        return payload
    except Exception:
        return None


# ── Email templates ────────────────────────────────────────────────────────────

def _text_body(link: str, expiry: int) -> str:
    return (
        f'مرحباً،\n\n'
        f'اضغط على الرابط التالي للدخول إلى بوابة الحوالات:\n\n'
        f'{link}\n\n'
        f'الرابط صالح لمدة {expiry} دقيقة ولمرة واحدة فقط.\n\n'
        f'إذا لم تطلب هذا الرابط، تجاهل هذه الرسالة.\n\n'
        f'انترناشونال للصرافة وتحويل الأموال'
    )


def _html_body(link: str, expiry: int) -> str:
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#070e1c;font-family:'Segoe UI',Arial,sans-serif;direction:rtl">
<table width="100%" cellpadding="0" cellspacing="0"
       style="background:linear-gradient(160deg,#070e1c,#0b1730);padding:40px 16px;min-height:100vh">
  <tr><td align="center">
  <table width="100%" style="max-width:500px">

    <!-- Logo -->
    <tr><td style="text-align:center;padding-bottom:24px">
      <table cellpadding="0" cellspacing="0" style="display:inline-table">
        <tr>
          <td style="width:44px;height:44px;border-radius:11px;
                     background:linear-gradient(135deg,#1555e8,#00c6ff);
                     text-align:center;vertical-align:middle;font-size:20px">💸</td>
          <td style="padding-right:12px;text-align:right;vertical-align:middle">
            <div style="font-size:15px;font-weight:800;color:#fff;line-height:1.2">انترناشونال للصرافة</div>
            <div style="font-size:11px;color:#7da8c8">بوابة تحويل الأموال</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Card -->
    <tr><td style="background:rgba(10,20,45,0.95);border:1px solid rgba(30,144,255,0.15);
                   border-radius:18px;overflow:hidden">

      <!-- Card header -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="background:linear-gradient(135deg,#0d1f4a,#112550);
                       padding:26px 32px;border-bottom:1px solid rgba(30,144,255,0.12)">
          <h1 style="margin:0;font-size:18px;font-weight:800;color:#fff">رابط الدخول 🔑</h1>
          <p style="margin:6px 0 0;font-size:12px;color:#7da8c8">بوابة الحوالات الإلكترونية</p>
        </td></tr>
      </table>

      <!-- Card body -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:28px 32px">

          <p style="font-size:14px;color:#b0cce4;line-height:1.75;margin:0 0 26px">
            لقد طلبت الدخول إلى بوابة الحوالات.<br>
            اضغط على الزر أدناه للمتابعة — الرابط صالح
            <strong style="color:#e4eeff">لمدة {expiry} دقيقة</strong>
            ولمرة واحدة فقط.
          </p>

          <!-- Button -->
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center" style="padding-bottom:26px">
              <a href="{link}"
                 style="display:inline-block;
                        background:linear-gradient(135deg,#1755f0,#00c6ff);
                        color:#fff;text-decoration:none;
                        font-size:15px;font-weight:700;
                        padding:15px 44px;border-radius:11px;
                        box-shadow:0 4px 20px rgba(30,144,255,0.38)">
                دخول البوابة &nbsp;→
              </a>
            </td></tr>
          </table>

          <!-- Link fallback -->
          <table cellpadding="0" cellspacing="0" width="100%"
                 style="background:rgba(30,144,255,0.07);
                        border:1px solid rgba(30,144,255,0.14);
                        border-radius:9px;margin-bottom:18px">
            <tr><td style="padding:13px 15px">
              <p style="margin:0 0 6px;font-size:11px;color:#7da8c8">
                إذا لم يعمل الزر، انسخ هذا الرابط في المتصفح:
              </p>
              <p style="margin:0;font-size:11px;color:#1e8fff;
                        word-break:break-all;font-family:monospace">{link}</p>
            </td></tr>
          </table>

          <!-- Warning -->
          <table cellpadding="0" cellspacing="0" width="100%"
                 style="background:rgba(245,197,24,0.07);
                        border:1px solid rgba(245,197,24,0.18);
                        border-radius:9px">
            <tr><td style="padding:12px 14px">
              <p style="margin:0;font-size:12px;color:#c8aa3a;line-height:1.65">
                ⚠️ إذا لم تطلب هذا الرابط، تجاهل هذه الرسالة بأمان.
              </p>
            </td></tr>
          </table>

        </td></tr>
      </table>

      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(30,144,255,0.1);
                       text-align:center">
          <p style="margin:0;font-size:11px;color:#3d607e">
            انترناشونال للصرافة وتحويل الأموال &nbsp;·&nbsp; رسالة تلقائية
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
  </td></tr>
</table>
</body>
</html>"""
