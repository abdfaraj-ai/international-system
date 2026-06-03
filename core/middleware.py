"""
core/middleware.py — Middleware الأمان
"""
import logging
from .permissions import check_api_rate_limit, get_client_ip

security_log = logging.getLogger('intl.security')


class ApiRateLimitMiddleware:
    """
    يُطبّق rate limiting على كل POST/PATCH/DELETE تحت /api/
    المفتاح: user_{id} للمستخدمين المسجَّلين، ip_{address} للزوار.
    يُستثنى: /api/login/ (له rate limiter خاص به في views.py)
    """

    EXEMPT_PATHS = {'/api/login/', '/api/me/'}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.method in ('POST', 'PATCH', 'DELETE')
            and request.path.startswith('/api/')
            and request.path not in self.EXEMPT_PATHS
        ):
            if request.user.is_authenticated:
                key = f'user_{request.user.pk}'
            else:
                key = f'ip_{get_client_ip(request)}'

            err = check_api_rate_limit(key)
            if err:
                security_log.warning(
                    'RATE_LIMIT_EXCEEDED key=%s path=%s method=%s',
                    key, request.path, request.method
                )
                return err

        return self.get_response(request)
