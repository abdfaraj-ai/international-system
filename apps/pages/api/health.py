"""
apps/pages/api/health.py — Health Check Endpoint
GET /api/health/  →  حالة النظام، قاعدة البيانات، الذاكرة
"""
import time
import platform
from django.http        import JsonResponse
from django.db          import connection, OperationalError
from django.views.decorators.http  import require_GET
from django.views.decorators.csrf  import csrf_exempt


@csrf_exempt
@require_GET
def api_health(request):
    """
    Endpoint للمراقبة — يُعيد حالة كل مكوّن.
    200 = كل شيء يعمل
    503 = مشكلة في أحد المكوّنات
    """
    start   = time.monotonic()
    status  = 'ok'
    checks  = {}

    # ── 1. قاعدة البيانات ────────────────────────────────────
    try:
        t0 = time.monotonic()
        with connection.cursor() as cur:
            cur.execute('SELECT 1')
        db_ms = round((time.monotonic() - t0) * 1000, 1)
        checks['database'] = {'status': 'ok', 'latency_ms': db_ms}
    except OperationalError as e:
        checks['database'] = {'status': 'error', 'detail': str(e)}
        status = 'degraded'

    # ── 2. الذاكرة ────────────────────────────────────────────
    try:
        import psutil
        mem  = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        checks['memory'] = {
            'status':         'ok' if mem.percent < 90 else 'warning',
            'used_percent':   round(mem.percent, 1),
            'available_mb':   round(mem.available / 1024 / 1024, 1),
        }
        checks['disk'] = {
            'status':         'ok' if disk.percent < 90 else 'warning',
            'used_percent':   round(disk.percent, 1),
            'free_gb':        round(disk.free / 1024 / 1024 / 1024, 2),
        }
        if mem.percent >= 90 or disk.percent >= 90:
            status = 'degraded'
    except ImportError:
        checks['memory'] = {'status': 'unknown', 'detail': 'psutil not installed'}
        checks['disk']   = {'status': 'unknown', 'detail': 'psutil not installed'}

    # ── 3. معلومات النظام ─────────────────────────────────────
    total_ms = round((time.monotonic() - start) * 1000, 1)

    http_status = 200 if status == 'ok' else 503

    return JsonResponse({
        'status':       status,
        'checks':       checks,
        'response_ms':  total_ms,
        'python':       platform.python_version(),
    }, status=http_status)
