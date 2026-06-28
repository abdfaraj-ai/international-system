"""
adms.py — استقبال بصمات ZKTeco عبر بروتوكول Push / ADMS (iclock)
═══════════════════════════════════════════════════════════════════
الجهاز يدفع البصمات تلقائياً إلى هذه النقاط — لا وكيل ولا سحب.
المعيار العالمي للبصمة السحابية.

نقاط الجهاز:
  GET  /iclock/cdata?SN=...            ← المصافحة (يطلب الجهاز إعداداته)
  POST /iclock/cdata?SN=...&table=ATTLOG ← الجهاز يدفع البصمات
  GET  /iclock/getrequest?SN=...       ← الجهاز يستعلم عن أوامر

ملاحظة: هذه نقاط عامة (الجهاز لا يسجّل دخولاً) ومُعفاة من CSRF.
"""
import os
from datetime import datetime

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone

from ..models import ZKDevice, ZKEmployee, AttendanceRecord


ZK_IP   = os.environ.get('ZK_IP',   '192.168.1.201')
ZK_PORT = int(os.environ.get('ZK_PORT', 4370))


def _ok(text='OK'):
    return HttpResponse(text, content_type='text/plain')


def _device(sn=''):
    """يربط بصمات ADMS بالجهاز الرئيسي (للأجهزة المتعددة يلزم حقل serial لاحقاً)."""
    dev, _ = ZKDevice.objects.get_or_create(
        ip=ZK_IP, defaults={'name': 'الجهاز الرئيسي', 'port': ZK_PORT, 'password': 0})
    return dev


def _parse_dt(s):
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M'):
        try:
            return datetime.strptime((s or '').strip(), fmt)
        except Exception:
            continue
    return None


def _save_attlog(sn, body):
    """يحفظ سطور ATTLOG: pin \\t time \\t status \\t verify ..."""
    dev = _device(sn)
    n = 0
    for line in (body or '').splitlines():
        parts = line.split('\t')
        if len(parts) < 2:
            continue
        pin = (parts[0] or '').strip()
        dt  = _parse_dt(parts[1])
        if not pin or dt is None:
            continue
        ts = timezone.make_aware(dt) if timezone.is_naive(dt) else dt
        try:
            status = int(parts[3]) if len(parts) > 3 and str(parts[3]).strip().lstrip('-').isdigit() else 0
        except Exception:
            status = 0
        emp, _ = ZKEmployee.objects.get_or_create(
            device=dev, user_id=pin,
            defaults={'name': pin, 'uid': int(pin) if pin.isdigit() else 0})
        _, created = AttendanceRecord.objects.get_or_create(
            device=dev, user_id=pin, timestamp=ts,
            defaults={'employee': emp, 'punch': status})
        if created:
            n += 1
    dev.last_sync = timezone.now()
    dev.save(update_fields=['last_sync'])
    return n


@csrf_exempt
def iclock_cdata(request):
    sn = request.GET.get('SN', '')

    if request.method == 'GET':
        # المصافحة — إعدادات الجهاز (تجعله يبدأ بالدفع اللحظي)
        cfg = (
            f'GET OPTION FROM: {sn}\n'
            'Stamp=9999\n'
            'OpStamp=9999\n'
            'ErrorDelay=30\n'
            'Delay=10\n'
            'TransTimes=00:00;14:05\n'
            'TransInterval=1\n'
            'TransFlag=1111000000\n'
            'TimeZone=3\n'
            'Realtime=1\n'
            'Encrypt=0\n'
        )
        return _ok(cfg)

    # POST — دفع بيانات
    table = (request.GET.get('table', '') or '').upper()
    body  = request.body.decode('utf-8', errors='ignore')
    if table == 'ATTLOG':
        n = _save_attlog(sn, body)
        return _ok(f'OK: {n}')
    # جداول أخرى (OPERLOG / مستخدمون...) — نقبلها دون معالجة الآن
    return _ok('OK')


@csrf_exempt
def iclock_getrequest(request):
    # لا أوامر من الخادم للجهاز حالياً
    return _ok('OK')


@csrf_exempt
def iclock_generic(request):
    # نقاط iclock أخرى (ping / devicecmd / fdata) — ردّ مقبول
    return _ok('OK')
