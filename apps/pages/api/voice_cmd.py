"""
voice_cmd.py — أوامر صوتية عبر SSE
POST /api/voice-cmd/        ← تطبيق Flutter يرسل نصاً أو ملفاً صوتياً
GET  /api/voice-cmd/stream/ ← Dashboard يستمع عبر SSE
"""
import asyncio
import json
import os
import re
import sys
import tempfile
import time
import threading
import urllib.request as _ur

from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings

# ── قاموس الأوامر → أرقام التبويبات ──────────────────────────────────────────
COMMANDS = {
    # الرئيسية
    'الرئيسية':        ('switch_tab', 0),
    'الصفحة الرئيسية': ('switch_tab', 0),
    'هوم':             ('switch_tab', 0),
    'home':            ('switch_tab', 0),
    # الفروع
    'الفروع':          ('switch_tab', 2),
    'فروع':            ('switch_tab', 2),
    'branches':        ('switch_tab', 2),
    # المشرفون
    'المشرفون':        ('switch_tab', 3),
    'مشرفون':          ('switch_tab', 3),
    'supervisors':     ('switch_tab', 3),
    # الصناديق
    'الصناديق':        ('switch_tab', 4),
    'صناديق':          ('switch_tab', 4),
    'صناديق التلرات':  ('switch_tab', 4),
    'boxes':           ('switch_tab', 4),
    # الخزينة
    'الخزينة':         ('switch_tab', 5),
    'خزينة':           ('switch_tab', 5),
    'الخزينة المركزية':('switch_tab', 5),
    'treasury':        ('switch_tab', 5),
    # العمليات
    'العمليات':        ('switch_tab', 6),
    'عمليات':          ('switch_tab', 6),
    'operations':      ('switch_tab', 6),
    # الحضور
    'الحضور':          ('switch_tab', 7),
    'حضور':            ('switch_tab', 7),
    'attendance':      ('switch_tab', 7),
    # الحسابات
    'الحسابات':        ('switch_tab', 1),
    'حسابات':          ('switch_tab', 1),
    'قسم الحسابات':    ('switch_tab', 1),
    'accounts':        ('switch_tab', 1),
    # التصميم
    'التصميم':         ('switch_tab', 8),
    'قسم التصميم':     ('switch_tab', 8),
    'تصميم':           ('switch_tab', 8),
    'design':          ('switch_tab', 8),
    'الاعلانات':       ('switch_tab', 8),
    'إعلانات':         ('switch_tab', 8),
}

# ── قائمة المستمعين النشطين (SSE connections) ────────────────────────────────
_listeners: list = []
_listeners_lock = threading.Lock()


def _broadcast(event: dict):
    """يبث حدثاً لجميع المستمعين — يضع في asyncio.Queue بشكل thread-safe."""
    payload = f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    with _listeners_lock:
        dead = []
        for entry in _listeners:
            try:
                loop = entry['aqueue']._loop
                loop.call_soon_threadsafe(entry['aqueue'].put_nowait, payload)
            except Exception:
                dead.append(entry)
        for entry in dead:
            _listeners.remove(entry)


def _whisper_transcribe(audio_path: str, suffix: str) -> str:
    """يحوّل الملف الصوتي لنص عبر OpenAI Whisper."""
    openai_key = getattr(settings, 'OPENAI_API_KEY', '') or os.environ.get('OPENAI_API_KEY', '')
    if not openai_key:
        return ''
    with open(audio_path, 'rb') as f:
        audio_bytes = f.read()
    boundary = b'----VCBoundary'
    # prompt يساعد Whisper على التعرف على أسماء الأقسام العربية
    prompt_ar = 'لوحة التحكم الفروع المشرفون الصناديق الخزينة العمليات الحسابات'.encode()
    body = (
        b'--' + boundary + b'\r\n'
        b'Content-Disposition: form-data; name="file"; filename="cmd' + suffix.encode() + b'"\r\n'
        b'Content-Type: application/octet-stream\r\n\r\n' + audio_bytes + b'\r\n'
        b'--' + boundary + b'\r\n'
        b'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n'
        b'--' + boundary + b'\r\n'
        b'Content-Disposition: form-data; name="language"\r\n\r\nar\r\n'
        b'--' + boundary + b'\r\n'
        b'Content-Disposition: form-data; name="prompt"\r\n\r\n' + prompt_ar + b'\r\n'
        b'--' + boundary + b'--\r\n'
    )
    req = _ur.Request(
        'https://api.openai.com/v1/audio/transcriptions',
        data=body,
        headers={
            'Authorization': f'Bearer {openai_key}',
            'Content-Type': 'multipart/form-data; boundary=----VCBoundary',
        },
        method='POST',
    )
    try:
        with _ur.urlopen(req, timeout=30) as resp:
            return (json.loads(resp.read()).get('text') or '').strip()
    except Exception as e:
        print(f'[voice-cmd] whisper error: {e}', file=sys.stderr)
        return ''


def _parse_command(text: str):
    """يحلل النص ويعيد (action, value) أو None."""
    text = text.strip()
    text = re.sub(r'[،,\.\!\?؟]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip().lower()

    # مطابقة مباشرة
    for keyword, result in COMMANDS.items():
        if keyword.lower() in text:
            return result

    # مطابقة مرنة: تجاهل كلمات التوجيه
    prefixes = r'(?:افتح|اذهب\s+(?:إلى|الى)|روح|انتقل\s+(?:إلى|الى)|اريد|أريد|اعرض|اظهر|شوف|قسم|صفحة|تبويب)\s*'
    clean = re.sub(prefixes, '', text).strip()
    for keyword, result in COMMANDS.items():
        if keyword.lower() in clean:
            return result

    return None


# ── POST /api/voice-cmd/ ──────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def api_voice_cmd(request):
    if request.method == 'OPTIONS':
        resp = JsonResponse({})
        resp['Access-Control-Allow-Origin']  = '*'
        resp['Access-Control-Allow-Headers'] = 'Content-Type, X-App-Key, Authorization'
        resp['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        return resp

    # التحقق من المفتاح
    expected = getattr(settings, 'FLUTTER_API_KEY', '')
    provided = request.headers.get('X-App-Key', '')
    if expected and provided != expected:
        return JsonResponse({'success': False, 'message': 'مفتاح غير صالح'}, status=401)

    tmp_path = None
    try:
        # ── قراءة النص: إما JSON body أو multipart (ملف صوتي) ─────────────────
        content_type = request.content_type or ''
        if 'multipart' in content_type:
            # ملف صوتي مباشر → Whisper
            audio_file = request.FILES.get('audio')
            if not audio_file:
                return JsonResponse({'success': False, 'message': 'لم يُرسَل ملف صوتي'}, status=400)
            suffix = os.path.splitext(audio_file.name)[1] or '.m4a'
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                for chunk in audio_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name
            text = _whisper_transcribe(tmp_path, suffix)
            if not text:
                return JsonResponse({'success': False, 'message': 'لم يُتعرف على الكلام'}, status=422)
        else:
            # JSON body { "text": "..." }
            try:
                body = json.loads(request.body)
            except Exception:
                return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)
            text = (body.get('text') or '').strip()
            if not text:
                return JsonResponse({'success': False, 'message': 'النص فارغ'}, status=400)

        print(f'[voice-cmd] text: {repr(text)}', flush=True, file=sys.stderr)

        result = _parse_command(text)
        if not result:
            return JsonResponse({
                'success':   False,
                'message':   f'لم أفهم الأمر: "{text}"',
                'available': list(COMMANDS.keys()),
            }, status=422)

        action, value = result
        event = {'action': action, 'value': value, 'text': text, 'ts': int(time.time())}
        _broadcast(event)

        return JsonResponse({'success': True, 'action': action, 'value': value, 'transcript': text})

    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


# ── GET /api/voice-cmd/stream/ ────────────────────────────────────────────────
async def api_voice_cmd_stream(request):
    """SSE stream async — لا يحجب event loop."""

    aqueue: asyncio.Queue = asyncio.Queue()
    entry = {'aqueue': aqueue}

    with _listeners_lock:
        _listeners.append(entry)

    # أقصى مدة للـ stream: 25 دقيقة — يُغلق تلقائياً وينشئ المتصفح واحداً جديداً
    MAX_STREAM_SECONDS = 25 * 60
    KEEPALIVE_INTERVAL = 15

    async def event_stream():
        yield "data: {\"action\":\"ping\"}\n\n"
        deadline = asyncio.get_event_loop().time() + MAX_STREAM_SECONDS
        try:
            while True:
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 0:
                    # أرسل إشارة إعادة اتصال ثم أغلق
                    yield "data: {\"action\":\"reconnect\"}\n\n"
                    break
                wait = min(KEEPALIVE_INTERVAL, remaining)
                try:
                    msg = await asyncio.wait_for(aqueue.get(), timeout=wait)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            with _listeners_lock:
                if entry in _listeners:
                    _listeners.remove(entry)

    resp = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    resp['Cache-Control']               = 'no-cache'
    resp['X-Accel-Buffering']           = 'no'
    resp['Access-Control-Allow-Origin'] = '*'
    return resp
