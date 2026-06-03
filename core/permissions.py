"""
core/permissions.py — مساعدات الصلاحيات المشتركة بين جميع طبقات التطبيق
"""
import json
import time
from collections import defaultdict
from threading   import Lock
from django.http     import JsonResponse
from django.shortcuts import redirect


# ─── Rate Limiter #1: Login — حماية brute-force (IP) ─────────────────────────
# يحمي /api/login/ من هجمات brute-force
# يُخزَّن في ذاكرة العملية — يُعاد ضبطه عند إعادة تشغيل الخادم

_rate_lock    = Lock()
_rate_buckets: dict[str, list[float]] = defaultdict(list)

_RATE_WINDOW  = 300    # ثانية (5 دقائق)
_RATE_MAX     = 10     # أقصى عدد محاولات في النافذة
_RATE_BLOCK   = 900    # مدة الحظر بعد تجاوز الحد (15 دقيقة)
_blocked_ips:  dict[str, float] = {}

# ─── Account Lockout: Login — حماية brute-force (username) ───────────────────
# يحظر الحساب بعد 5 محاولات فاشلة متتالية — مستقل عن IP
_acct_lock_mutex  = Lock()
_acct_fail_count: dict[str, int]   = defaultdict(int)
_acct_locked_until: dict[str, float] = {}

_ACCT_MAX_FAILS  = 5     # محاولات فاشلة قبل الحظر
_ACCT_LOCK_TIME  = 900   # مدة الحظر: 15 دقيقة


# ─── Rate Limiter #2: API عامة — حماية الـ endpoints من الاستدعاء المفرط ──────
# يُطبَّق على كل POST/PATCH/DELETE عبر middleware
# المفتاح: user_id أو IP (للزوار)

_api_rate_lock     = Lock()
_api_rate_buckets: dict[str, list[float]] = defaultdict(list)
_api_blocked:      dict[str, float]       = {}

_API_RATE_WINDOW   = 60     # ثانية (نافذة دقيقة واحدة)
_API_RATE_MAX      = 120    # أقصى 120 طلب في الدقيقة لكل مستخدم
_API_RATE_BLOCK    = 300    # حظر 5 دقائق


def check_api_rate_limit(key: str) -> JsonResponse | None:
    """
    Rate limiter للـ API العامة (POST/PATCH/DELETE).
    المفتاح: user_{id} أو ip_{address}.
    """
    now = time.time()
    with _api_rate_lock:
        if key in _api_blocked:
            if now < _api_blocked[key]:
                remaining = int(_api_blocked[key] - now)
                return JsonResponse(
                    {'success': False,
                     'error': f'طلبات كثيرة جداً. انتظر {remaining} ثانية.'},
                    status=429
                )
            else:
                del _api_blocked[key]
                _api_rate_buckets[key] = []

        _api_rate_buckets[key] = [t for t in _api_rate_buckets[key] if now - t < _API_RATE_WINDOW]
        _api_rate_buckets[key].append(now)

        if len(_api_rate_buckets[key]) > _API_RATE_MAX:
            _api_blocked[key] = now + _API_RATE_BLOCK
            _api_rate_buckets[key] = []
            return JsonResponse(
                {'success': False,
                 'error': 'تم تجاوز حد الطلبات المسموح به. سيتم رفع الحظر تلقائياً بعد 5 دقائق.'},
                status=429
            )
    return None


def check_rate_limit(ip: str) -> JsonResponse | None:
    """
    يتحقق من أن عنوان IP لم يتجاوز حد المحاولات.
    يُعيد None إذا كان مسموحاً، أو JsonResponse(429) إذا كان محظوراً.
    """
    now = time.time()
    with _rate_lock:
        # هل ما زال محظوراً؟
        if ip in _blocked_ips:
            if now < _blocked_ips[ip]:
                remaining = int(_blocked_ips[ip] - now)
                return JsonResponse(
                    {'success': False,
                     'error': f'تم تجاوز عدد المحاولات المسموح. انتظر {remaining // 60} دقيقة.'},
                    status=429
                )
            else:
                del _blocked_ips[ip]
                _rate_buckets[ip] = []

        # تنظيف المحاولات القديمة خارج النافذة
        _rate_buckets[ip] = [t for t in _rate_buckets[ip] if now - t < _RATE_WINDOW]

        # تسجيل المحاولة الحالية
        _rate_buckets[ip].append(now)

        # هل تجاوز الحد؟
        if len(_rate_buckets[ip]) > _RATE_MAX:
            _blocked_ips[ip] = now + _RATE_BLOCK
            _rate_buckets[ip] = []
            return JsonResponse(
                {'success': False,
                 'error': 'تم تجاوز عدد المحاولات المسموح. سيتم رفع الحظر تلقائياً بعد 15 دقيقة.'},
                status=429
            )
    return None


def check_account_lockout(username: str) -> JsonResponse | None:
    """
    يتحقق إذا كان الحساب محظوراً بسبب محاولات فاشلة متكررة.
    يُعيد None إذا كان مسموحاً، أو JsonResponse(429) إذا كان محظوراً.
    """
    now = time.time()
    username = username.lower().strip()
    with _acct_lock_mutex:
        if username in _acct_locked_until:
            if now < _acct_locked_until[username]:
                remaining = int(_acct_locked_until[username] - now)
                return JsonResponse(
                    {'success': False,
                     'error': f'الحساب مقفل مؤقتاً بسبب محاولات فاشلة متكررة. انتظر {remaining // 60} دقيقة.'},
                    status=429
                )
            else:
                del _acct_locked_until[username]
                _acct_fail_count[username] = 0
    return None


def record_failed_login(username: str) -> None:
    """يسجّل محاولة دخول فاشلة ويقفل الحساب عند تجاوز الحد."""
    now = time.time()
    username = username.lower().strip()
    with _acct_lock_mutex:
        _acct_fail_count[username] += 1
        if _acct_fail_count[username] >= _ACCT_MAX_FAILS:
            _acct_locked_until[username] = now + _ACCT_LOCK_TIME
            _acct_fail_count[username] = 0


def reset_failed_logins(username: str) -> None:
    """يُعيد ضبط عداد الفشل عند نجاح تسجيل الدخول."""
    username = username.lower().strip()
    with _acct_lock_mutex:
        _acct_fail_count.pop(username, None)
        _acct_locked_until.pop(username, None)


def get_client_ip(request) -> str:
    """استخراج IP العميل مع مراعاة الـ proxies."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


# ─── Page-level decorator (used in views.py) ──────────────────────────────────

def role_required(*roles):
    """
    Decorator للـ views: يشترط تسجيل الدخول + امتلاك أحد الأدوار المحددة.
    يُعيد redirect('/login/') إذا لم يكن المستخدم مسجَّلاً،
    ويُعيد redirect(home_page) إذا كان الدور غير مسموح.
    """
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('/login/')
            if request.user.role not in roles:
                return redirect(request.user.home_page)
            return view_func(request, *args, **kwargs)
        wrapper.__name__ = view_func.__name__
        return wrapper
    return decorator


# ─── API-level helpers (used in api/*.py) ─────────────────────────────────────

def require_roles(request, *roles):
    """
    يتحقق من تسجيل الدخول والدور.
    يُعيد None إذا كان الطلب مسموحاً، أو JsonResponse بالخطأ.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)
    if request.user.role not in roles:
        return JsonResponse({'success': False, 'message': 'غير مصرَّح لك'}, status=403)
    return None


def parse_json(request):
    """
    يحلّل جسم الطلب JSON.
    يُعيد (data, None) عند النجاح، أو (None, JsonResponse) عند الفشل.
    """
    try:
        return json.loads(request.body), None
    except (json.JSONDecodeError, ValueError):
        return None, JsonResponse({'success': False, 'message': 'بيانات JSON غير صالحة'}, status=400)


def caller_name(request):
    """يُعيد اسم المستخدم الحالي (الاسم الكامل أو username)."""
    if request.user.is_authenticated:
        return request.user.get_full_name() or request.user.username
    return '—'
