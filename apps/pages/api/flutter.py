"""
API endpoints للتطبيق Flutter
GET  /api/rates        ← أسعار الصرف
POST /api/transcribe   ← تحويل الصوت لنص (Whisper)
POST /api/exchange     ← حفظ عملية الصرف
POST /api/upload-image ← رفع الصور
"""
import json
import base64
import os
import tempfile
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django.core.files.base import ContentFile
from django.utils import timezone
from django.conf import settings
from ..models import ExchangeOperation, UploadedImage, HawalaOperation, CashTransaction, ExchangeRate, TellerRequest, TellerBalance, TellerProfile, TellerPermission
from .auth_api import require_flutter_auth, SUPERVISOR_ROLES


def _require_app_key(request):
    """
    يتحقق من مفتاح التطبيق في header: X-App-Key
    يُطبَّق على كل endpoints الكتابة في flutter.py
    """
    expected = getattr(settings, 'FLUTTER_API_KEY', '')
    if not expected:
        # إذا لم يُضبط المفتاح في الإعدادات — ارفض بشكل صريح
        return JsonResponse({'success': False, 'message': 'FLUTTER_API_KEY غير مضبوط في الإعدادات'}, status=503)
    provided = request.headers.get('X-App-Key', '')
    if not provided or provided != expected:
        return JsonResponse({'success': False, 'message': 'مفتاح التطبيق غير صالح'}, status=401)
    return None


# ── أسعار الصرف الافتراضية ────────────────────────────────────────────────────
# عدّلها يدوياً أو اربطها بقاعدة بيانات لاحقاً

_DEFAULT_RATES = {
    # دولار أمريكي USD
    'usd_ils': 3.70,  'usd_jod': 0.71,  'usd_eur': 0.92,
    'usd_gbp': 0.79,  'usd_try': 32.50, 'usd_egp': 48.50,
    'usd_sar': 3.75,  'usd_aed': 3.67,  'usd_kwd': 0.307,
    'usd_bhd': 0.376, 'usd_qar': 3.64,  'usd_omr': 0.385,
    'usd_cad': 1.36,  'usd_aud': 1.53,  'usd_chf': 0.90,
    # شيكل ILS
    'ils_usd': 0.270, 'ils_jod': 0.192, 'ils_eur': 0.249,
    'ils_gbp': 0.213, 'ils_try': 8.78,  'ils_egp': 13.10,
    'ils_sar': 1.01,  'ils_aed': 0.991,
    # دينار أردني JOD
    'jod_usd': 1.41,  'jod_ils': 5.21,  'jod_eur': 1.30,
    'jod_gbp': 1.11,  'jod_sar': 5.29,  'jod_aed': 5.18,
    # يورو EUR
    'eur_usd': 1.087, 'eur_ils': 4.02,  'eur_jod': 0.77,
    'eur_gbp': 0.857, 'eur_try': 35.30, 'eur_sar': 4.07,
    # جنيه إسترليني GBP
    'gbp_usd': 1.268, 'gbp_ils': 4.69,  'gbp_eur': 1.167,
    'gbp_jod': 0.899, 'gbp_sar': 4.75,
    # ليرة تركية TRY
    'try_usd': 0.0308,'try_ils': 0.114, 'try_eur': 0.0283,
    # جنيه مصري EGP
    'egp_usd': 0.0206,'egp_ils': 0.0763,'egp_jod': 0.0146,
    # ريال سعودي SAR
    'sar_usd': 0.267, 'sar_ils': 0.987, 'sar_jod': 0.189,
    'sar_aed': 0.979,
    # درهم إماراتي AED
    'aed_usd': 0.272, 'aed_ils': 1.008, 'aed_sar': 1.021,
    # دينار كويتي KWD
    'kwd_usd': 3.257, 'kwd_ils': 12.05, 'kwd_sar': 12.21,
    # ريال قطري QAR
    'qar_usd': 0.275, 'qar_ils': 1.016,
    # دولار كندي CAD
    'cad_usd': 0.735, 'cad_ils': 2.72,
    # دولار أسترالي AUD
    'aud_usd': 0.654, 'aud_ils': 2.42,
    # فرنك سويسري CHF
    'chf_usd': 1.112, 'chf_ils': 4.11, 'chf_eur': 1.022,
}


@require_GET
def api_rates(request):
    """GET /api/rates — يرجع أسعار الصرف من DB (يسقط على الافتراضي إن لم توجد)"""
    latest = ExchangeRate.objects.filter(rate_type=ExchangeRate.RATE_TELLER).order_by('-created_at').first()
    if latest and latest.rates_json:
        try:
            import json as _json
            rates = _json.loads(latest.rates_json) if isinstance(latest.rates_json, str) else latest.rates_json
            return JsonResponse({'success': True, 'data': rates, 'source': 'db', 'setBy': latest.set_by})
        except Exception:
            pass
    return JsonResponse({'success': True, 'data': _DEFAULT_RATES, 'source': 'default'})


@csrf_exempt
@require_POST
def api_transcribe(request):
    """POST /api/transcribe — يستقبل ملف صوتي ويرجع النص بالعربي"""
    auth_err, _ = require_flutter_auth(request)
    if auth_err:
        return auth_err
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return JsonResponse({'success': False, 'message': 'لم يُرسل ملف صوتي'}, status=400)

    # حفظ الملف مؤقتاً
    suffix = os.path.splitext(audio_file.name)[1] or '.aac'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        for chunk in audio_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        from django.conf import settings
        openai_key = getattr(settings, 'OPENAI_API_KEY', '') or os.environ.get('OPENAI_API_KEY', '')

        if openai_key:
            # ── Whisper API السحابي (أسرع، لا يستهلك ذاكرة الخادم) ──
            import urllib.request, urllib.parse
            with open(tmp_path, 'rb') as f:
                audio_bytes = f.read()

            boundary = b'----FormBoundary7MA4YWxkTrZu0gW'
            body = (
                b'--' + boundary + b'\r\n'
                b'Content-Disposition: form-data; name="file"; filename="audio' + suffix.encode() + b'"\r\n'
                b'Content-Type: application/octet-stream\r\n\r\n' +
                audio_bytes + b'\r\n'
                b'--' + boundary + b'\r\n'
                b'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n'
                b'--' + boundary + b'\r\n'
                b'Content-Disposition: form-data; name="language"\r\n\r\nar\r\n'
                b'--' + boundary + b'\r\n'
                b'Content-Disposition: form-data; name="prompt"\r\n\r\n'
                b'\xd8\xb5\xd8\xb1\xd9\x81 \xd8\xaf\xd9\x88\xd9\x84\xd8\xa7\xd8\xb1 \xd8\xb4\xd9\x8a\xd9\x83\xd9\x84 \xd8\xaf\xd9\x8a\xd9\x86\xd8\xa7\xd8\xb1 \xd9\x8a\xd9\x88\xd8\xb1\xd9\x88 \xd8\xb1\xd9\x8a\xd8\xa7\xd9\x84 \xd8\xaf\xd8\xb1\xd9\x87\xd9\x85 \xd8\xa5\xd8\xb3\xd8\xaa\xd8\xb1\xd9\x84\xd9\x8a\xd9\x86\xd9\x8a \xd9\x85\xd9\x8a\xd8\xa9 \xd9\x85\xd8\xa6\xd8\xa9 \xd8\xa3\xd9\x84\xd9\x81 \xd8\xae\xd9\x85\xd8\xb3\xd9\x85\xd8\xa6\xd8\xa9 \xd8\xad\xd9\x88\xd8\xa7\xd9\x84\xd8\xa9 \xd8\xb3\xd8\xad\xd8\xa8 \xd8\xa5\xd9\x8a\xd8\xaf\xd8\xa7\xd8\xb9 \xd8\xb7\xd8\xa8\xd8\xa7\xd8\xb9\xd8\xa9 \xd8\xb4\xd9\x88\xd8\xa7\xd9\x83\xd9\x84 \xd8\xaf\xd9\x86\xd8\xa7\xd9\x86\xd9\x8a\xd8\xb1 \xd9\x82\xd8\xb1\xd9\x88\xd8\xb4\r\n'
                b'--' + boundary + b'--\r\n'
            )
            req = urllib.request.Request(
                'https://api.openai.com/v1/audio/transcriptions',
                data=body,
                headers={
                    'Authorization': f'Bearer {openai_key}',
                    'Content-Type': f'multipart/form-data; boundary=----FormBoundary7MA4YWxkTrZu0gW',
                },
                method='POST',
            )
            import json as _json
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = _json.loads(resp.read())
            text = (result.get('text') or '').strip()
        else:
            # ── Whisper محلي كاحتياط (يتطلب: pip install openai-whisper) ──
            try:
                import whisper
                model = whisper.load_model('small')
                result = model.transcribe(tmp_path, language='ar', fp16=False,
                                          initial_prompt='صرف دولار شيكل دينار يورو ريال درهم إسترليني مية مئة ألف خمسمئة حوالة سحب إيداع طباعة')
                text = (result.get('text') or '').strip()
            except ImportError:
                return JsonResponse({
                    'success': False,
                    'message': 'يرجى ضبط OPENAI_API_KEY في البيئة أو تثبيت openai-whisper',
                }, status=503)

        if not text:
            return JsonResponse({'success': False, 'message': 'لم يُتعرف على كلام واضح'})
        return JsonResponse({'success': True, 'text': text})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@csrf_exempt
def api_last_exchange(request):
    """GET /api/last-exchange — يرجع آخر عملية صرافة"""
    auth_err, _ = require_flutter_auth(request)
    if auth_err:
        return auth_err
    try:
        op = ExchangeOperation.objects.order_by('-created_at').first()
        if not op:
            return JsonResponse({'success': False, 'message': 'لا توجد عمليات سابقة'})
        return JsonResponse({
            'success': True,
            'id':     op.id,
            'from':   op.from_currency,
            'to':     op.to_currency,
            'amount': float(op.amount),
            'result': float(op.result),
            'rate':   float(op.rate),
            'operator': op.operator or 'تلر',
            'label':  f"{op.amount} {op.from_currency} = {op.result} {op.to_currency}",
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_exchange(request):
    """POST /api/exchange — يحفظ عملية الصرف في قاعدة البيانات"""
    auth_err, auth_user = require_flutter_auth(request)
    if auth_err:
        return auth_err
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    try:
        op = ExchangeOperation.objects.create(
            from_currency = data.get('from_currency', ''),
            to_currency   = data.get('to_currency', ''),
            amount        = float(data.get('amount', 0)),
            result        = float(data.get('result', 0)),
            rate          = float(data.get('rate', 0)),
            method        = data.get('method', 'app'),
            operator      = auth_user.get_full_name() or auth_user.username,
        )
        return JsonResponse({'success': True, 'id': op.id})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


def _parse_with_gpt(text, openai_key):
    """
    يستخدم GPT لفهم النص بأي لغة أو لهجة وتحويله لـ JSON منظم.
    يرجع dict أو None إذا فشل.
    """
    import urllib.request as _ur
    import json as _j

    system_prompt = """أنت مساعد صرافة ذكي. مهمتك تحليل أوامر الصرافة بأي لغة أو لهجة عربية أو إنجليزية وتحويلها لـ JSON.

أنواع العمليات المدعومة:
- exchange: تصريف/تحويل عملة لأخرى
- hawala: إرسال حوالة مالية لشخص
- withdrawal: سحب نقدي
- deposit: إيداع نقدي

العملات المدعومة: USD, ILS, JOD, EUR, GBP, SAR, AED, EGP, TRY, KWD, QAR, OMR, CAD, AUD, CHF

أرجع JSON فقط بهذا الشكل حسب نوع العملية:

لعملية exchange:
{"type":"exchange","from":"USD","to":"ILS","amount":100}

لعملية hawala:
{"type":"hawala","sender":"اسم المرسل","receiver":"اسم المستلم","amount":100,"currency":"USD","destination":""}

لعملية withdrawal:
{"type":"withdrawal","client":"اسم العميل","amount":100,"currency":"USD"}

لعملية deposit:
{"type":"deposit","client":"اسم العميل","amount":100,"currency":"USD"}

إذا لم تتعرف على العملية: {"type":"unknown","message":"السبب"}

قواعد مهمة:
- إذا ذُكرت عملة واحدة فقط في صرف، افترض الاتجاه من السياق
- إذا لم تُذكر عملة، افترض USD
- الأرقام المكتوبة بالكلمات (مية، ألف، hundred، thousand) حوّلها لأرقام
- لا تُرجع أي نص خارج الـ JSON"""

    body = _j.dumps({
        'model': 'gpt-4o-mini',
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user',   'content': text},
        ],
        'temperature': 0,
        'max_tokens': 200,
    }).encode()

    req = _ur.Request(
        'https://api.openai.com/v1/chat/completions',
        data=body,
        headers={
            'Authorization': f'Bearer {openai_key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with _ur.urlopen(req, timeout=15) as resp:
            data = _j.loads(resp.read())
        content = data['choices'][0]['message']['content'].strip()
        # نظّف أي markdown حول JSON
        content = content.strip('`').replace('json\n', '').replace('```', '').strip()
        parsed = _j.loads(content)
        if parsed.get('type') == 'unknown':
            return None
        return parsed
    except Exception:
        return None


def _gpt_to_command(gpt):
    """يحوّل نتيجة GPT لصيغة _parse_teller_command"""
    t = gpt.get('type')
    if t == 'exchange':
        return {'type': 'exchange', 'data': {
            'from':   gpt.get('from', 'USD'),
            'to':     gpt.get('to', 'ILS'),
            'amount': float(gpt.get('amount') or 0),
        }}
    if t == 'hawala':
        return {'type': 'hawala', 'data': {
            'sender':      gpt.get('sender', ''),
            'receiver':    gpt.get('receiver', ''),
            'amount':      float(gpt.get('amount') or 0),
            'currency':    gpt.get('currency', 'USD'),
            'destination': gpt.get('destination', ''),
        }}
    if t in ('withdrawal', 'deposit'):
        return {'type': t, 'data': {
            'client':   gpt.get('client', ''),
            'amount':   float(gpt.get('amount') or 0),
            'currency': gpt.get('currency', 'USD'),
        }}
    return None


@csrf_exempt
@require_POST
def api_voice_teller(request):
    """
    POST /api/voice-teller
    يستقبل النص المحوَّل من الصوت ويحلله ويحفظ العملية المناسبة
    Body: { "text": "نص الأمر", "operator": "اسم التلر" }
    """
    auth_err, auth_user = require_flutter_auth(request)
    if auth_err:
        return auth_err
    if auth_user.role in {'M02', 'M03'}:
        return JsonResponse({'success': False, 'message': 'هذه الصلاحية للتلر فقط'}, status=403)
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    text     = (data.get('text') or '').strip()
    operator = (data.get('operator') or 'تلر').strip()

    if not text:
        return JsonResponse({'success': False, 'message': 'النص فارغ'}, status=400)

    openai_key = getattr(__import__('django.conf', fromlist=['settings']).settings,
                         'OPENAI_API_KEY', '') or os.environ.get('OPENAI_API_KEY', '')

    # ── 1. جرّب GPT أولاً (أفضل فهم لأي لغة/لهجة) ──────────────────────────
    parsed = None
    used_gpt = False
    if openai_key:
        gpt_result = _parse_with_gpt(text, openai_key)
        if gpt_result:
            parsed  = _gpt_to_command(gpt_result)
            used_gpt = True

    # ── 2. احتياط: المحلل اليدوي إذا فشل GPT ────────────────────────────────
    if parsed is None:
        parsed = _parse_teller_command(text)

    if parsed is None:
        return JsonResponse({
            'success': False,
            'message': 'لم أتعرف على نوع العملية\nقل: صرف / حوالة / سحب / إيداع',
            'raw_text': text,
        })

    op_type = parsed['type']
    result  = {'success': True, 'type': op_type, 'raw_text': text, 'parsed_by': 'gpt' if used_gpt else 'regex'}

    try:
        result.update(_save_teller_operation(parsed, operator, method='voice'))
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'خطأ الحفظ: {e}'}, status=500)

    return JsonResponse(result)


# ── حفظ عملية التلر (مشترك بين الصوت والـ OCR) ───────────────────────────────

def _save_teller_operation(parsed, operator, method='voice'):
    """يحفظ العملية في DB ويرجع dict بالبيانات — يُستخدم من voice وOCR"""
    op_type = parsed['type']
    result  = {'type': op_type}

    if op_type == 'exchange':
        r        = parsed['data']
        rate_key = f"{r['from'].lower()}_{r['to'].lower()}"
        rate     = _DEFAULT_RATES.get(rate_key, 0)
        amount   = r['amount']
        res_val  = round(amount * rate, 2)
        op = ExchangeOperation.objects.create(
            from_currency=r['from'], to_currency=r['to'],
            amount=amount, result=res_val, rate=rate,
            method=method, operator=operator,
        )
        result.update({'id': op.id, 'from': r['from'], 'to': r['to'],
                       'amount': amount, 'result': res_val, 'rate': rate,
                       'operator': operator,
                       'label': f"صرف {amount} {r['from']} = {res_val} {r['to']}"})

    elif op_type == 'hawala':
        op = HawalaOperation.objects.create(
            sender_name=parsed['data'].get('sender', ''),
            receiver_name=parsed['data'].get('receiver', ''),
            amount=parsed['data'].get('amount', 0),
            currency=parsed['data'].get('currency', 'USD'),
            destination=parsed['data'].get('destination', ''),
            operator=operator, method=method,
        )
        result.update({'id': op.id,
                       'sender': op.sender_name, 'receiver': op.receiver_name,
                       'amount': op.amount, 'currency': op.currency,
                       'destination': op.destination, 'operator': operator,
                       'label': f"حوالة {op.amount} {op.currency} من {op.sender_name} إلى {op.receiver_name}"})

    elif op_type in ('withdrawal', 'deposit'):
        r = parsed['data']
        op = CashTransaction.objects.create(
            transaction_type=op_type,
            client_name=r.get('client', ''),
            amount=r.get('amount', 0),
            currency=r.get('currency', 'USD'),
            operator=operator, method=method,
        )
        label_ar = 'سحب' if op_type == 'withdrawal' else 'إيداع'
        result.update({'id': op.id, 'client': op.client_name,
                       'amount': op.amount, 'currency': op.currency,
                       'operator': operator,
                       'label': f"{label_ar} {op.amount} {op.currency} — {op.client_name}"})

    return result


# ── OCR بالذكاء الاصطناعي ─────────────────────────────────────────────────────

@csrf_exempt
@require_POST
def api_ocr(request):
    """
    POST /api/ocr
    يستقبل صورة Base64 → يُرسلها لـ GPT-4 Vision → يستخرج النص → يُحلّله → يحفظه
    Body: { "image_base64": "...", "operator": "اسم التلر" }
    يرجع: { success, extracted_text, type, label, ... }
    """
    auth_err, auth_user = require_flutter_auth(request)
    if auth_err:
        return auth_err
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    image_b64 = (data.get('image_base64') or '').strip()
    operator  = (auth_user.get_full_name() or auth_user.username)

    if not image_b64:
        return JsonResponse({'success': False, 'message': 'لم تُرسل صورة'}, status=400)

    # ── استخراج النص عبر Tesseract OCR (محلي، بدون API، بدون numpy) ──
    try:
        import base64 as _b64, io
        import pytesseract
        from PIL import Image as _Img

        # مسار Tesseract — يُقرأ من متغير البيئة أو يُكتشف تلقائياً
        import shutil as _shutil
        _tess_env = os.environ.get('TESSERACT_CMD', '')
        if _tess_env:
            pytesseract.pytesseract.tesseract_cmd = _tess_env
        elif _shutil.which('tesseract'):
            pytesseract.pytesseract.tesseract_cmd = _shutil.which('tesseract')
        else:
            # مسار افتراضي على Windows فقط
            pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

        raw_bytes = _b64.b64decode(image_b64)
        img = _Img.open(io.BytesIO(raw_bytes)).convert('RGB')

        # استخراج النص بالعربي والإنجليزي
        extracted_text = pytesseract.image_to_string(img, lang='ara+eng', config='--psm 6').strip()
        extracted_text = ' '.join(extracted_text.split())  # تنظيف المسافات والأسطر
        print(f'[OCR] نص مستخرج: {extracted_text}')
    except Exception as e:
        print(f'[OCR ERROR] {e}')
        return JsonResponse({'success': False, 'message': f'خطأ OCR: {e}'}, status=500)

    if not extracted_text:
        return JsonResponse({'success': False, 'message': 'لم يتم التعرف على أي نص'}, status=400)

    # ── تحليل النص المستخرج ──
    parsed = _parse_teller_command(extracted_text)
    if parsed is None:
        return JsonResponse({
            'success': True,
            'extracted_text': extracted_text,
            'parsed': False,
            'message': 'تم استخراج النص — لم يُعرف نوع العملية، عدّل النص وأعد المحاولة',
        })

    # ── حفظ في قاعدة البيانات ──
    try:
        save_result = _save_teller_operation(parsed, operator, method='ocr')
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'خطأ الحفظ: {e}'}, status=500)

    return JsonResponse({
        'success': True,
        'extracted_text': extracted_text,
        'parsed': True,
        **save_result,
    })


# ── محلل الأوامر الصوتية ──────────────────────────────────────────────────────

def _normalize_dialect(text):
    """يحوّل جميع اللهجات العربية إلى فصحى يفهمها المحلل"""
    import re
    t = text

    # ── تطبيع الهمزات والتشكيل ───────────────────────────────────────────────
    t = re.sub(r'[ًٌٍَُِّْ]', '', t)          # حذف التشكيل
    t = t.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
    t = t.replace('ة', 'ه').replace('ى', 'ي')

    # ── كلمات الصرف (فلسطيني/أردني/لبناني/مصري/خليجي) ───────────────────────
    exchange_words = [
        'بدي صرف', 'بدي اصرف', 'بدك تصرف', 'بده يصرف',
        'صرفلي', 'صرف لي', 'اصرفلي', 'اصرف لي',
        'غيرلي', 'غير لي', 'غيره', 'غيرها',
        'حوللي', 'حول لي', 'بدي حول', 'حولها', 'حولهم',
        'كم بيساوي', 'كم يساوي', 'كم يعادل', 'بيساوي كم',
        'بكم', 'بقديش', 'قديش', 'اديش',
        'convert', 'exchange',
        'عايز اصرف', 'عاوز اصرف', 'ابي اصرف',
    ]
    for w in exchange_words:
        if w in t:
            t = t.replace(w, 'صرف')

    # ── كلمات الحوالة ────────────────────────────────────────────────────────
    hawala_words = [
        'بعت فلوس', 'بعت مصاري', 'بدي ابعت', 'ابعت',
        'ارسل', 'ارسللي', 'بدي ارسل', 'راح ارسل',
        'تحويل', 'بدي تحويل', 'عايز ابعت', 'عاوز ابعت',
        'ابي ارسل', 'وين بعت',
    ]
    for w in hawala_words:
        if w in t:
            t = t.replace(w, 'حواله')

    # ── كلمات السحب ──────────────────────────────────────────────────────────
    withdrawal_words = [
        'بدي اسحب', 'اسحبلي', 'اسحب لي',
        'طلع', 'بدي طلع', 'طلعلي', 'اطلع',
        'سحبت', 'بدي سحب',
        'عايز اسحب', 'عاوز اسحب', 'ابي اسحب',
    ]
    for w in withdrawal_words:
        if w in t:
            t = t.replace(w, 'سحب')

    # ── كلمات الإيداع ────────────────────────────────────────────────────────
    deposit_words = [
        'حط', 'بدي حط', 'حطلي', 'حطها',
        'ضيف', 'بدي ضيف', 'ضيفلي',
        'بدي ودع', 'ودعت',
        'ادخل فلوس', 'ادخل مصاري',
        'عايز ادخل', 'عاوز ادخل',
    ]
    for w in deposit_words:
        if w in t:
            t = t.replace(w, 'ايداع')

    # ── تطبيع أسماء العملات ──────────────────────────────────────────────────
    currency_map = {
        'دولارات': 'دولار', 'دولاره': 'دولار', 'دولارا': 'دولار',
        'شيقل': 'شيكل', 'شواكل': 'شيكل', 'شيكلات': 'شيكل', 'شيقلات': 'شيكل',
        'دنانير': 'دينار', 'دينارا': 'دينار',
        'يوروهات': 'يورو', 'يورو هات': 'يورو',
        'ريالات': 'ريال', 'دراهم': 'درهم',
        'جنيهات': 'جنيه', 'ليرات': 'ليره',
        'فلوس': '', 'مصاري': '', 'نقود': '', 'كاش': '',
    }
    for dialect, standard in currency_map.items():
        t = t.replace(dialect, standard)

    # ── تطبيع حروف الجر والاتجاه ─────────────────────────────────────────────
    direction_words = [
        'الى ', 'إلى ', 'لـ ', ' ل ', 'ع ', 'على ',
        'to ', 'نحو ', 'باتجاه ',
    ]
    for w in direction_words:
        t = t.replace(w, ' إلى ')

    # ── تطبيع الواو العاطفة في الأرقام المركبة ───────────────────────────────
    # مثال: "خمسة وعشرين" → "خمسة وعشرين" (تبقى كما هي للـ _extract_amount)
    t = re.sub(r'\s+و\s+', ' و', t)

    return t.strip()


def _parse_teller_command(text):
    """يحلل النص ويحدد نوع العملية والبيانات"""
    t = _normalize_dialect(text.strip())

    # ─ تصريف ─
    if any(w in t for w in ['صرف', 'تصريف', 'exchange', 'اصرف', 'غير', 'حول']):
        return {'type': 'exchange', 'data': _parse_exchange(t)}

    # ─ حوالة ─
    if any(w in t for w in ['حوالة', 'حواله', 'حوالا', 'تحويل', 'hawala', 'ارسل']):
        return {'type': 'hawala', 'data': _parse_hawala(t)}

    # ─ سحب ─
    if any(w in t for w in ['سحب', 'سحبت', 'اسحب', 'سحوبات', 'طلع']):
        return {'type': 'withdrawal', 'data': _parse_cash(t)}

    # ─ إيداع ─
    if any(w in t for w in ['إيداع', 'ايداع', 'ودع', 'وديعة', 'ادخل', 'deposit', 'حط', 'ضيف']):
        return {'type': 'deposit', 'data': _parse_cash(t)}

    return None


def _extract_amount(t):
    """يستخرج المبلغ من النص — يدعم جميع اللهجات العربية والأرقام المركبة"""
    import re

    # ── 1. أرقام عربية/فارسية → لاتينية ──────────────────────────────────────
    t2 = ''.join(str(ord(c) - ord('٠')) if '٠' <= c <= '٩' else c for c in t)

    # ── 2. قاموس شامل لكل اللهجات ─────────────────────────────────────────────
    # الآحاد
    ONES = {
        'صفر': 0, 'واحد': 1, 'وحدة': 1, 'واحده': 1,
        'اثنين': 2, 'اثنان': 2, 'اتنين': 2, 'اثنتين': 2,
        'ثلاثة': 3, 'ثلاثه': 3, 'تلاتة': 3, 'تلاته': 3,
        'اربعة': 4, 'اربعه': 4, 'أربعة': 4, 'اربع': 4,
        'خمسة': 5, 'خمسه': 5, 'خمس': 5,
        'ستة': 6, 'سته': 6, 'ست': 6,
        'سبعة': 7, 'سبعه': 7, 'سبع': 7,
        'ثمانية': 8, 'ثمانيه': 8, 'تمانية': 8, 'ثماني': 8, 'تماني': 8,
        'تسعة': 9, 'تسعه': 9, 'تسع': 9,
    }
    # العشرات
    TENS = {
        'عشرة': 10, 'عشره': 10, 'عشر': 10,
        'أحد عشر': 11, 'احد عشر': 11, 'حداشر': 11,
        'اثنا عشر': 12, 'اتناشر': 12, 'اثني عشر': 12,
        'ثلاثة عشر': 13, 'تلتاشر': 13,
        'أربعة عشر': 14, 'أربعتاشر': 14, 'اربعتاشر': 14,
        'خمسة عشر': 15, 'خمستاشر': 15,
        'ستة عشر': 16, 'ستاشر': 16,
        'سبعة عشر': 17, 'سبعتاشر': 17,
        'ثمانية عشر': 18, 'تمانتاشر': 18,
        'تسعة عشر': 19, 'تسعتاشر': 19,
        'عشرين': 20, 'عشرون': 20,
        'خمسة وعشرين': 25, 'خمسة وعشرون': 25,
        'ثلاثين': 30, 'تلاتين': 30,
        'أربعين': 40, 'اربعين': 40,
        'خمسين': 50,
        'ستين': 60,
        'سبعين': 70,
        'ثمانين': 80, 'تمانين': 80,
        'تسعين': 90,
    }
    # المئات — فلسطيني/أردني/لبناني/مصري/خليجي
    HUNDREDS = {
        'مية': 100, 'مئة': 100, 'مائة': 100, 'ميه': 100,
        'مئتين': 200, 'ميتين': 200, 'مائتين': 200, 'مييتين': 200, 'مئتان': 200,
        'تلت مية': 300, 'ثلاثمية': 300, 'ثلاثمائة': 300, 'تلتميه': 300,
        'أربعمية': 400, 'اربعمية': 400, 'أربعمائة': 400, 'اربعميه': 400,
        'خمسمية': 500, 'خمسمائة': 500, 'خمسميه': 500,
        'ستمية': 600, 'ستمائة': 600, 'ستميه': 600,
        'سبعمية': 700, 'سبعمائة': 700, 'سبعميه': 700,
        'تمانمية': 800, 'ثمانمية': 800, 'ثمانمائة': 800, 'تمانميه': 800,
        'تسعمية': 900, 'تسعمائة': 900, 'تسعميه': 900,
    }
    # الآلاف
    THOUSANDS = {
        'الف': 1000, 'ألف': 1000, 'ألفاً': 1000, 'الفا': 1000,
        'الفين': 2000, 'ألفين': 2000,
        'تلت الاف': 3000, 'ثلاثة آلاف': 3000,
        'اربعة آلاف': 4000, 'أربعة آلاف': 4000,
        'خمسة آلاف': 5000, 'خمس آلاف': 5000,
        'عشرة آلاف': 10000, 'عشر آلاف': 10000,
        'خمسة عشر الف': 15000, 'خمسطعش الف': 15000,
        'عشرين الف': 20000,
        'خمسين الف': 50000,
        'مية الف': 100000, 'مئة الف': 100000,
    }

    # ── 3. ابحث عن أطول تطابق من الأكبر للأصغر ──────────────────────────────
    all_words = {}
    all_words.update(THOUSANDS)
    all_words.update(HUNDREDS)
    all_words.update(TENS)
    all_words.update(ONES)

    # رتّب من الأطول نصاً للأقصر لتجنب التطابق الجزئي
    for w, v in sorted(all_words.items(), key=lambda x: -len(x[0])):
        if w in t:
            return float(v)

    # ── 4. ابحث عن رقم مكتوب (123 أو 1,500 أو 1.5) ──────────────────────────
    m = re.search(r'\d[\d,\.]*', t2)
    if m:
        num_str = m.group().replace(',', '')
        try:
            return float(num_str)
        except ValueError:
            pass

    return 0.0


def _extract_currency(t):
    """يستخرج العملة من النص — يدعم جميع العملات الرئيسية"""
    t = t.lower()
    cur_map = [
        ('USD', ['دولار أمريكي','دولار','دولارات','dollar','dollars','usd']),
        ('ILS', ['شيكل','شيقل','شواكل','شيكل إسرائيلي','shekel','shekels','ils']),
        ('JOD', ['دينار أردني','دينار','دنانير','dinar','dinars','jod']),
        ('EUR', ['يورو','يوروهات','euro','eur']),
        ('GBP', ['جنيه إسترليني','جنيه استرليني','إسترليني','استرليني','pound','gbp']),
        ('TRY', ['ليرة تركية','ليرة','lira','try']),
        ('EGP', ['جنيه مصري','جنيه','egp','egyptian']),
        ('SAR', ['ريال سعودي','ريال','sar','saudi']),
        ('AED', ['درهم إماراتي','درهم','aed','dirham']),
        ('KWD', ['دينار كويتي','kwd','kuwaiti']),
        ('BHD', ['دينار بحريني','bhd','bahraini']),
        ('QAR', ['ريال قطري','qar','qatari']),
        ('OMR', ['ريال عماني','omr','omani']),
        ('CAD', ['دولار كندي','كندي','cad','canadian']),
        ('AUD', ['دولار أسترالي','أسترالي','aud','australian']),
        ('CHF', ['فرنك سويسري','فرنك','chf','franc']),
    ]
    for code, keywords in cur_map:
        if any(kw in t for kw in keywords):
            return code
    return 'USD'


def _extract_name(t, after_keywords, before_keywords=None):
    """يستخرج اسم من النص بعد كلمة مفتاحية"""
    import re
    for kw in after_keywords:
        idx = t.find(kw)
        if idx != -1:
            rest = t[idx + len(kw):].strip()
            # اقطع عند الكلمة التالية
            stops = (before_keywords or []) + ['من', 'الى', 'إلى', 'لـ', ' ل ', 'مبلغ', 'دولار', 'شيكل', 'دينار']
            for s in stops:
                si = rest.find(s)
                if si != -1:
                    rest = rest[:si]
            name = re.sub(r'\s+', ' ', rest).strip()
            if name:
                return name
    return ''


def _find_currencies_positioned(t):
    """يجد جميع العملات في النص مرتبة حسب موضع أول ظهور لها"""
    import re
    s = t.lower()
    patterns = [
        ('KWD', r'دينار كويتي|kwd'),
        ('BHD', r'دينار بحريني|bhd'),
        ('JOD', r'دينار أردني|دينار اردني|jod|دينار'),
        ('EGP', r'جنيه مصري|جنيه مصر|egp'),
        ('GBP', r'جنيه إسترليني|جنيه استرليني|إسترليني|استرليني|gbp'),
        ('EGP', r'جنيه'),
        ('QAR', r'ريال قطري|qar'),
        ('OMR', r'ريال عماني|omr'),
        ('SAR', r'ريال سعودي|ريال|sar'),
        ('CAD', r'دولار كندي|كندي|cad'),
        ('AUD', r'دولار أسترالي|دولار استرالي|أسترالي|aud'),
        ('USD', r'دولار أمريكي|دولار|dollar|usd'),
        ('ILS', r'شيكل|شيقل|ils'),
        ('EUR', r'يورو|euro|eur'),
        ('TRY', r'ليرة تركية|ليرة|try'),
        ('AED', r'درهم إماراتي|درهم|aed'),
        ('CHF', r'فرنك سويسري|فرنك|chf'),
    ]
    found      = []
    used_chars = set()
    for code, pattern in patterns:
        m = re.search(pattern, s)
        if m and m.start() not in used_chars:
            found.append((m.start(), code))
            for i in range(m.start(), m.end()):
                used_chars.add(i)
    found.sort(key=lambda x: x[0])
    return found


def _parse_exchange(t):
    import re
    from_c = 'USD'
    to_c   = 'ILS'

    # ابحث عن فاصل: الى / إلى / لـ? / to — مع أو بدون مسافة بعده
    sep_match = re.search(r'\s+(?:الى|إلى|لـ?|to)\s*', t)
    if sep_match:
        before = t[:sep_match.start()]
        after  = t[sep_match.end():]
        from_c = _extract_currency(before)
        to_c   = _extract_currency(after)
    else:
        # بدون فاصل — استخرج العملات حسب ترتيب ظهورها في النص
        positions = _find_currencies_positioned(t)
        if len(positions) >= 2:
            from_c = positions[0][1]
            to_c   = positions[1][1]
        elif len(positions) == 1:
            from_c = positions[0][1]

    return {'from': from_c, 'to': to_c, 'amount': _extract_amount(t)}


def _parse_hawala(t):
    dest = ''
    for d in ['الأردن', 'الاردن', 'فلسطين', 'مصر', 'السعودية', 'تركيا', 'الامارات', 'الإمارات']:
        if d in t:
            dest = d
            break
    return {
        'sender':      _extract_name(t, ['من ', 'المرسل ']),
        'receiver':    _extract_name(t, ['الى ', 'إلى ', 'لـ ', 'لـ', 'المستلم ']),
        'amount':      _extract_amount(t),
        'currency':    _extract_currency(t),
        'destination': dest,
    }


def _parse_cash(t):
    return {
        'client':   _extract_name(t, ['من ', 'لـ ', 'الى ', 'إلى ', 'لحساب ', 'حساب ', 'عميل ']),
        'amount':   _extract_amount(t),
        'currency': _extract_currency(t),
    }


@csrf_exempt
@require_POST
def api_voice_execute(request):
    """
    POST /api/voice-execute
    نقطة نهاية موحدة للأندرويد:
      1. يستقبل ملف صوتي (multipart: audio=<file>, operator=<name>)
      2. يحوّله لنص عبر Whisper
      3. يحلل النص ويعرف نوع العملية
      4. يحفظ العملية في DB
      5. يرجع النتيجة كاملة

    الحقول:
      audio    — ملف صوتي (aac/mp3/wav/m4a)
      operator — اسم التلر (اختياري، افتراضي: 'تلر')
    """
    auth_err, auth_user = require_flutter_auth(request)
    if auth_err:
        return auth_err

    # M02 وM03 فقط ممنوعون — M01 وIM01 لهم صلاحية كاملة
    if auth_user.role in {'M02', 'M03'}:
        return JsonResponse({'success': False, 'message': 'هذه الصلاحية للتلر فقط، وليس للمشرفين'}, status=403)

    operator   = auth_user.get_full_name() or auth_user.username
    text       = (request.POST.get('text') or '').strip()
    tmp_path   = None
    openai_key = getattr(settings, 'OPENAI_API_KEY', '') or os.environ.get('OPENAI_API_KEY', '')

    try:
        # ── 1. الحصول على النص (من العميل مباشرة أو عبر Whisper) ─────────────
        if not text:
            audio_file = request.FILES.get('audio')
            if not audio_file:
                return JsonResponse({'success': False, 'message': 'يجب إرسال نص أو ملف صوتي'}, status=400)

            suffix = os.path.splitext(audio_file.name)[1] or '.aac'
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                for chunk in audio_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name
            if openai_key:
                import urllib.request as _ur
                import json as _json
                with open(tmp_path, 'rb') as f:
                    audio_bytes = f.read()
                boundary = b'----FormBoundary7MA4YWxkTrZu0gW'
                body = (
                    b'--' + boundary + b'\r\n'
                    b'Content-Disposition: form-data; name="file"; filename="audio' + suffix.encode() + b'"\r\n'
                    b'Content-Type: application/octet-stream\r\n\r\n' +
                    audio_bytes + b'\r\n'
                    b'--' + boundary + b'\r\n'
                    b'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n'
                    b'--' + boundary + b'\r\n'
                    b'Content-Disposition: form-data; name="language"\r\n\r\nar\r\n'
                    b'--' + boundary + b'\r\n'
                    b'Content-Disposition: form-data; name="prompt"\r\n\r\n'
                    b'\xd8\xb5\xd8\xb1\xd9\x81 \xd8\xaf\xd9\x88\xd9\x84\xd8\xa7\xd8\xb1 \xd8\xb4\xd9\x8a\xd9\x83\xd9\x84 \xd8\xaf\xd9\x8a\xd9\x86\xd8\xa7\xd8\xb1 \xd9\x8a\xd9\x88\xd8\xb1\xd9\x88 \xd8\xb1\xd9\x8a\xd8\xa7\xd9\x84 \xd8\xaf\xd8\xb1\xd9\x87\xd9\x85 \xd8\xa5\xd8\xb3\xd8\xaa\xd8\xb1\xd9\x84\xd9\x8a\xd9\x86\xd9\x8a \xd9\x85\xd9\x8a\xd8\xa9 \xd9\x85\xd8\xa6\xd8\xa9 \xd8\xa3\xd9\x84\xd9\x81 \xd8\xae\xd9\x85\xd8\xb3\xd9\x85\xd8\xa6\xd8\xa9 \xd8\xad\xd9\x88\xd8\xa7\xd9\x84\xd8\xa9 \xd8\xb3\xd8\xad\xd8\xa8 \xd8\xa5\xd9\x8a\xd8\xaf\xd8\xa7\xd8\xb9 \xd8\xb7\xd8\xa8\xd8\xa7\xd8\xb9\xd8\xa9 \xd8\xb4\xd9\x88\xd8\xa7\xd9\x83\xd9\x84 \xd8\xaf\xd9\x86\xd8\xa7\xd9\x86\xd9\x8a\xd8\xb1 \xd9\x82\xd8\xb1\xd9\x88\xd8\xb4\r\n'
                    b'--' + boundary + b'--\r\n'
                )
                req_oa = _ur.Request(
                    'https://api.openai.com/v1/audio/transcriptions',
                    data=body,
                    headers={
                        'Authorization': f'Bearer {openai_key}',
                        'Content-Type': 'multipart/form-data; boundary=----FormBoundary7MA4YWxkTrZu0gW',
                    },
                    method='POST',
                )
                with _ur.urlopen(req_oa, timeout=30) as resp:
                    text = (_json.loads(resp.read()).get('text') or '').strip()
            else:
                try:
                    import whisper as _wh
                    model = _wh.load_model('small')
                    text = (_wh.transcribe(model, tmp_path, language='ar', fp16=False,
                                           initial_prompt='صرف دولار شيكل دينار يورو ريال درهم إسترليني مية مئة ألف خمسمئة حوالة سحب إيداع طباعة').get('text') or '').strip()
                except ImportError:
                    return JsonResponse({'success': False, 'message': 'لم يُضبط OPENAI_API_KEY ولم تُثبَّت مكتبة whisper'}, status=503)

        if not text:
            return JsonResponse({'success': False, 'message': 'لم يُتعرف على كلام واضح'})

        # ── 3. تحليل النص (GPT أولاً، ثم regex) ──────────────────────────────
        parsed = None
        used_gpt = False
        if openai_key:
            gpt_result = _parse_with_gpt(text, openai_key)
            if gpt_result:
                parsed = _gpt_to_command(gpt_result)
                used_gpt = True
        if parsed is None:
            parsed = _parse_teller_command(text)

        if parsed is None:
            return JsonResponse({
                'success':  False,
                'message':  'لم أتعرف على نوع العملية\nقل: صرف / حوالة / سحب / إيداع',
                'text':     text,
            })

        # ── 4. حفظ العملية في DB ──────────────────────────────────────────────
        save_result = _save_teller_operation(parsed, operator, method='voice')

        # ── 5. بث النتيجة لصفحة أقسام التلر عبر WebSocket ───────────────────
        from ..ws_utils import broadcast_voice_result
        broadcast_voice_result({
            'success':   True,
            'text':      text,
            'operator':  operator,
            'parsed_by': 'gpt' if used_gpt else 'regex',
            **save_result,
        })

        return JsonResponse({
            'success':   True,
            'text':      text,
            'parsed_by': 'gpt' if used_gpt else 'regex',
            **save_result,
        })

    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


@csrf_exempt
@require_POST
def api_voice_rates(request):
    """
    POST /api/voice-rates
    يستقبل ملف صوتي من تطبيق الأندرويد (مشرف) لتحديث أسعار الصرف:
      1. Whisper يحوّل الصوت لنص
      2. GPT يستخرج الأسعار من النص
      3. يحفظها في ExchangeRate
      4. يبثّها عبر WebSocket لصفحات المشرفين

    الحقول:
      audio    — ملف صوتي (m4a/aac/mp3)
      operator — اسم المشرف (اختياري)
    """
    from .auth_api import require_supervisor as _require_supervisor
    err, auth_user = _require_supervisor(request)
    if err:
        return err

    operator   = auth_user.get_full_name() or auth_user.username
    text       = (request.POST.get('text') or '').strip()
    tmp_path   = None
    openai_key = getattr(settings, 'OPENAI_API_KEY', '') or os.environ.get('OPENAI_API_KEY', '')

    try:
        # ── 1. الحصول على النص ───────────────────────────────────────────────
        if not text:
            audio_file = request.FILES.get('audio')
            if not audio_file:
                return JsonResponse({'success': False, 'message': 'يجب إرسال نص أو ملف صوتي'}, status=400)

            suffix = os.path.splitext(audio_file.name)[1] or '.m4a'
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                for chunk in audio_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            if openai_key:
                import urllib.request as _ur, json as _json
                with open(tmp_path, 'rb') as f:
                    audio_bytes = f.read()
                boundary = b'----FormBoundary7MA4YWxkTrZu0gW'
                body = (
                    b'--' + boundary + b'\r\n'
                    b'Content-Disposition: form-data; name="file"; filename="audio' + suffix.encode() + b'"\r\n'
                    b'Content-Type: application/octet-stream\r\n\r\n' +
                    audio_bytes + b'\r\n'
                    b'--' + boundary + b'\r\n'
                    b'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n'
                    b'--' + boundary + b'\r\n'
                    b'Content-Disposition: form-data; name="language"\r\n\r\nar\r\n'
                    b'--' + boundary + b'\r\n'
                    b'Content-Disposition: form-data; name="prompt"\r\n\r\n'
                    b'\xd8\xaf\xd9\x88\xd9\x84\xd8\xa7\xd8\xb1 \xd8\xb4\xd9\x8a\xd9\x83\xd9\x84 \xd8\xaf\xd9\x8a\xd9\x86\xd8\xa7\xd8\xb1 \xd9\x8a\xd9\x88\xd8\xb1\xd9\x88 \xd8\xb1\xd9\x8a\xd8\xa7\xd9\x84 \xd8\xaf\xd8\xb1\xd9\x87\xd9\x85 \xd8\xa5\xd8\xb3\xd8\xaa\xd8\xb1\xd9\x84\xd9\x8a\xd9\x86\xd9\x8a \xd8\xb3\xd8\xb9\xd8\xb1 \xd8\xa3\xd8\xb3\xd8\xb9\xd8\xa7\xd8\xb1 \xd8\xb5\xd8\xb1\xd9\x81 \xd9\x81\xd9\x84\xd8\xb3 \xd9\x82\xd8\xb1\xd8\xb4 \xd8\xa8\xd9\x86\xd8\xb3\xd9\x87 \xd9\x88\xd9\x86\xd8\xb5\r\n'
                    b'--' + boundary + b'--\r\n'
                )
                req_oa = _ur.Request(
                    'https://api.openai.com/v1/audio/transcriptions',
                    data=body,
                    headers={
                        'Authorization': f'Bearer {openai_key}',
                        'Content-Type': 'multipart/form-data; boundary=----FormBoundary7MA4YWxkTrZu0gW',
                    },
                    method='POST',
                )
                with _ur.urlopen(req_oa, timeout=30) as resp:
                    text = (_json.loads(resp.read()).get('text') or '').strip()
            else:
                try:
                    import whisper as _wh
                    model = _wh.load_model('small')
                    text = (_wh.transcribe(model, tmp_path, language='ar', fp16=False,
                                           initial_prompt='دولار شيكل دينار يورو ريال درهم إسترليني سعر أسعار صرف فلس قرش بنسه ونص').get('text') or '').strip()
                except ImportError:
                    return JsonResponse({'success': False, 'message': 'لم يُضبط OPENAI_API_KEY'}, status=503)

        if not text:
            return JsonResponse({'success': False, 'message': 'لم يُتعرف على كلام واضح'})

        # ── 2. استخراج الأسعار (GPT أولاً، ثم regex) ────────────────────────
        rates = None
        if openai_key:
            rates = _parse_rates_with_gpt(text, openai_key)
        if not rates:
            rates = _parse_rates_regex(text)

        if not rates:
            return JsonResponse({
                'success': False,
                'message': 'لم أتعرف على أسعار في النص\nقل مثلاً: الشيكل 3.63 والدينار 0.71',
                'text': text,
            })

        # ── 3. حفظ في DB (ExchangeRate) بنوع hawala ──────────────────────────
        import json as _json
        from ..models import ExchangeRate
        rate_obj = ExchangeRate.objects.create(
            rate_type  = ExchangeRate.RATE_HAWALA,
            set_by     = operator,
            rates_json = rates,
        )
        # إبقاء آخر 30 سجلاً من نوع hawala فقط
        old_ids = list(
            ExchangeRate.objects.filter(rate_type=ExchangeRate.RATE_HAWALA)
            .order_by('-created_at').values_list('id', flat=True)[30:]
        )
        if old_ids:
            ExchangeRate.objects.filter(id__in=old_ids).delete()

        # ── 4. بث عبر WebSocket لصفحات المشرفين ─────────────────────────────
        from ..ws_utils import broadcast_voice_rates
        broadcast_voice_rates({
            'success':    True,
            'text':       text,
            'operator':   operator,
            'updated_at': rate_obj.created_at.isoformat(),
            **rates,
        })

        return JsonResponse({
            'success':    True,
            'text':       text,
            'operator':   operator,
            'updated_at': rate_obj.created_at.isoformat(),
            **rates,
        })

    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


def _parse_rates_with_gpt(text, openai_key):
    """يستخدم GPT لاستخراج أسعار الصرف من نص صوتي عربي."""
    import urllib.request as _ur, json as _j

    system_prompt = (
        'أنت مساعد يستخرج أسعار الصرف من نص عربي.\n'
        'المطلوب: أرجع JSON يحتوي فقط على الأسعار التي ذُكرت.\n'
        'الأسعار بالنسبة للدولار الأمريكي USD.\n'
        'الحقول المسموحة:\n'
        '  ILS = شيكل إسرائيلي\n'
        '  JOD = دينار أردني\n'
        '  EUR = يورو\n'
        '  GBP = جنيه إسترليني\n'
        '  EGP = جنيه مصري\n'
        '  TND = دينار تونسي\n'
        '  AED = درهم إماراتي\n'
        '  VOD = فودافون كاش (مصر)\n'
        'أمثلة:\n'
        '  "الدينار بصفر فاصل سبعة واحد" → {"JOD": 0.71}\n'
        '  "فودافون بثمانية وأربعين" → {"VOD": 48.0}\n'
        '  "الجنيه المصري ثمانية وأربعين وخمسة" → {"EGP": 48.5}\n'
        '  "الدينار التونسي ثلاثة وعشرة سنتيم" → {"TND": 3.10}\n'
        '  "الدرهم ثلاثة وسبعمائة وسبعة وستين" → {"AED": 3.767}\n'
        'أرجع JSON فقط بدون نص إضافي. إذا لم تجد أسعاراً أرجع {}.'
    )

    body = _j.dumps({
        'model': 'gpt-4o-mini',
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user',   'content': text},
        ],
        'temperature': 0,
        'max_tokens': 150,
    }).encode()

    req = _ur.Request(
        'https://api.openai.com/v1/chat/completions',
        data=body,
        headers={'Authorization': f'Bearer {openai_key}', 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with _ur.urlopen(req, timeout=15) as resp:
            data = _j.loads(resp.read())
        content = data['choices'][0]['message']['content'].strip()
        content = content.strip('`').replace('json\n', '').replace('```', '').strip()
        parsed = _j.loads(content)
        if not isinstance(parsed, dict) or not parsed:
            return None
        result = {}
        for key in ('ILS', 'JOD', 'EUR', 'GBP', 'EGP', 'TND', 'AED', 'VOD'):
            if key in parsed:
                try:
                    result[key] = float(parsed[key])
                except (ValueError, TypeError):
                    pass
        return result if result else None
    except Exception:
        return None


def _parse_rates_regex(text):
    """استخراج بسيط للأسعار من النص — احتياط عند غياب GPT."""
    import re
    t = text.replace('،', ',').replace('٫', '.').replace('٠', '0').replace('١', '1') \
            .replace('٢', '2').replace('٣', '3').replace('٤', '4').replace('٥', '5') \
            .replace('٦', '6').replace('٧', '7').replace('٨', '8').replace('٩', '9')

    result = {}
    patterns = [
        ('ILS', r'(?:شيكل|شيقل|ils)\D{0,15}?(\d+[\.,]\d+|\d+)'),
        ('JOD', r'(?:دينار\s*أردني|دينار\s*اردني|jod)\D{0,15}?(\d+[\.,]\d+|\d+)'),
        ('EUR', r'(?:يورو|eur)\D{0,15}?(\d+[\.,]\d+|\d+)'),
        ('GBP', r'(?:جنيه\s*إسترليني|جنيه\s*استرليني|إسترليني|gbp)\D{0,15}?(\d+[\.,]\d+|\d+)'),
        ('EGP', r'(?:جنيه\s*مصري|egp)\D{0,15}?(\d+[\.,]\d+|\d+)'),
        ('TND', r'(?:دينار\s*تونسي|تونسي|tnd)\D{0,15}?(\d+[\.,]\d+|\d+)'),
        ('AED', r'(?:درهم|aed)\D{0,15}?(\d+[\.,]\d+|\d+)'),
        ('VOD', r'(?:فودافون|vodafone|vod)\D{0,15}?(\d+[\.,]\d+|\d+)'),
    ]
    for key, pat in patterns:
        m = re.search(pat, t, re.IGNORECASE)
        if m:
            try:
                result[key] = float(m.group(1).replace(',', '.'))
            except ValueError:
                pass
    return result if result else None


@require_GET
def api_pending_operation(request):
    """
    GET /api/pending-operation
    تُرجع أحدث عملية صوتية لم تُطبَّق على الويب بعد، وتضع علامة applied عليها
    تستخدمها صفحة أقسام التلر للاستقبال الفوري من الهاتف
    """
    from django.utils import timezone as tz
    import datetime

    # العمليات خلال آخر 60 دقيقة
    cutoff = tz.now() - datetime.timedelta(minutes=60)

    op = None
    data = {}

    # بحث بالترتيب: صرف → حوالة → معاملة نقدية
    ex = ExchangeOperation.objects.filter(web_applied=False, created_at__gte=cutoff).first()
    if ex:
        ex.web_applied = True
        ex.save(update_fields=['web_applied'])
        data = {
            'type': 'exchange',
            'from': ex.from_currency,
            'to':   ex.to_currency,
            'amount': ex.amount,
            'result': ex.result,
            'rate':   ex.rate,
            'operator': ex.operator,
            'label': f'صرف {ex.amount} {ex.from_currency} = {ex.result:.2f} {ex.to_currency}',
        }
        op = ex

    if not op:
        hw = HawalaOperation.objects.filter(web_applied=False, created_at__gte=cutoff).first()
        if hw:
            hw.web_applied = True
            hw.save(update_fields=['web_applied'])
            data = {
                'type':        'hawala',
                'sender':      hw.sender_name,
                'receiver':    hw.receiver_name,
                'amount':      hw.amount,
                'currency':    hw.currency,
                'destination': hw.destination,
                'operator':    hw.operator,
                'label': f'حوالة {hw.amount} {hw.currency} من {hw.sender_name} إلى {hw.receiver_name}',
            }
            op = hw

    if not op:
        ct = CashTransaction.objects.filter(web_applied=False, created_at__gte=cutoff).first()
        if ct:
            ct.web_applied = True
            ct.save(update_fields=['web_applied'])
            t_label = 'سحب' if ct.transaction_type == 'withdrawal' else 'إيداع'
            data = {
                'type':             ct.transaction_type,
                'client':           ct.client_name,
                'amount':           ct.amount,
                'currency':         ct.currency,
                'operator':         ct.operator,
                'label': f'{t_label} {ct.amount} {ct.currency} — {ct.client_name}',
            }
            op = ct

    if not op:
        return JsonResponse({'success': False, 'pending': False})

    return JsonResponse({'success': True, 'pending': True, **data})


@csrf_exempt
@require_POST
def api_upload_image(request):
    """POST /api/upload-image — يستقبل صورة Base64 ويحفظها"""
    auth_err, _ = require_flutter_auth(request)
    if auth_err:
        return auth_err
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    image_b64 = data.get('image_base64', '')
    filename   = data.get('filename', 'image.jpg')
    desc       = data.get('description', '')
    location   = data.get('location', '')
    user_id    = data.get('user_id', '')

    if not image_b64:
        return JsonResponse({'success': False, 'message': 'لم تُرسل صورة'}, status=400)

    # التحقق من الامتداد المسموح به
    _ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
    _MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in _ALLOWED_EXTENSIONS:
        return JsonResponse(
            {'success': False, 'message': f'نوع الملف غير مسموح. الأنواع المقبولة: {", ".join(_ALLOWED_EXTENSIONS)}'},
            status=400
        )
    # تعقيم اسم الملف: إزالة المسارات والمحارف الخطرة
    safe_filename = base64.b64encode(filename.encode()).decode()[:20] + '.' + ext

    try:
        image_data = base64.b64decode(image_b64)

        # التحقق من الحجم بعد فك التشفير
        if len(image_data) > _MAX_SIZE_BYTES:
            return JsonResponse(
                {'success': False, 'message': f'حجم الصورة يتجاوز الحد المسموح ({_MAX_SIZE_BYTES // (1024*1024)} MB)'},
                status=400
            )

        # التحقق من Magic Bytes (أول بايتات الملف)
        _MAGIC = {
            b'\xff\xd8\xff': 'jpg',    # JPEG
            b'\x89PNG':      'png',    # PNG
            b'GIF8':         'gif',    # GIF
            b'RIFF':         'webp',   # WebP (تقريبي)
        }
        is_valid_magic = any(image_data.startswith(magic) for magic in _MAGIC)
        if not is_valid_magic and ext not in ('webp',):
            return JsonResponse({'success': False, 'message': 'محتوى الملف لا يتطابق مع نوع الصورة'}, status=400)

        img = UploadedImage(
            description = desc,
            location    = location,
            user_id     = user_id,
        )
        img.image.save(safe_filename, ContentFile(image_data), save=True)
        return JsonResponse({
            'success': True,
            'id':      img.id,
            'url':     request.build_absolute_uri(img.image.url),
            'message': 'تم رفع الصورة بنجاح',
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


# ── أسعار الصرف — مشرف التلر ─────────────────────────────────────────────────

@csrf_exempt
def api_sv_rates(request):
    """
    GET  /api/sv/rates  ← يرجع آخر أسعار صرف نشرها المشرف
    POST /api/sv/rates  ← المشرف يحفظ أسعاراً جديدة في قاعدة البيانات
    """
    rate_type = request.GET.get('type', 'teller') if request.method == 'GET' else 'teller'

    if request.method == 'GET':
        rate_obj = ExchangeRate.objects.filter(rate_type=rate_type).order_by('-created_at').first()
        if rate_obj:
            return JsonResponse({'success': True, 'data': rate_obj.rates_json,
                                 'set_by': rate_obj.set_by,
                                 'rate_type': rate_obj.rate_type,
                                 'updated_at': rate_obj.created_at.isoformat()})
        return JsonResponse({'success': False, 'message': 'لا توجد أسعار محفوظة بعد'}, status=200)

    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

        rates_payload = data.get('rates')
        if not rates_payload or not isinstance(rates_payload, dict):
            return JsonResponse({'success': False, 'message': 'حقل rates مطلوب'}, status=400)

        rate_type_post = data.get('rate_type', 'teller')
        if rate_type_post not in ('teller', 'hawala'):
            rate_type_post = 'teller'

        rate_obj = ExchangeRate.objects.create(
            rate_type  = rate_type_post,
            set_by     = request.user.get_full_name() or request.user.username,
            rates_json = rates_payload,
        )
        old_ids = list(
            ExchangeRate.objects.filter(rate_type=rate_type_post)
            .order_by('-created_at').values_list('id', flat=True)[30:]
        )
        if old_ids:
            ExchangeRate.objects.filter(id__in=old_ids).delete()

        print(f'[RATES] {rate_obj.set_by} نشر أسعار {rate_type_post}')
        return JsonResponse({'success': True, 'message': 'تم حفظ الأسعار بنجاح',
                             'id': rate_obj.id,
                             'rate_type': rate_type_post,
                             'updated_at': rate_obj.created_at.isoformat()})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# طلبات التلرات — TellerRequest API
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_teller_requests(request):
    """
    POST /api/teller/requests  ← التلر يُنشئ طلباً جديداً
    GET  /api/teller/requests  ← المشرف يجلب كل الطلبات
                                  ?filter=pending|approved|rejected|resolved|all
                                  ?teller=<اسم التلر>
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

        request_id   = data.get('id', '').strip()
        request_type = data.get('type', 'general').strip()
        teller_name  = data.get('tellerName', '').strip()
        text         = data.get('text', '').strip()
        requested_rate = data.get('requestedRate', '').strip()

        if not request_id or not teller_name or not text:
            return JsonResponse({'success': False, 'message': 'id و tellerName و text مطلوبة'}, status=400)

        # تجنب التكرار إن أُعيد الإرسال
        obj, created = TellerRequest.objects.get_or_create(
            request_id=request_id,
            defaults={
                'request_type':   request_type,
                'teller_name':    teller_name,
                'text':           text,
                'requested_rate': requested_rate,
            }
        )
        print(f'[REQUEST] {"جديد" if created else "موجود"} — {teller_name}: {text[:50]}')
        return JsonResponse({'success': True, 'created': created, 'request': obj.to_dict()})

    if request.method == 'GET':
        qs = TellerRequest.objects.all()

        status_filter = request.GET.get('filter', 'all')
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)

        teller_filter = request.GET.get('teller', '').strip()
        if teller_filter:
            qs = qs.filter(teller_name=teller_filter)

        # آخر 200 طلب فقط
        qs = qs[:200]
        return JsonResponse({'success': True, 'requests': [r.to_dict() for r in qs]})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


@csrf_exempt
def api_teller_request_detail(request, request_id):
    """
    GET   /api/teller/requests/<request_id>  ← التلر يتحقق من حالة طلبه
    PATCH /api/teller/requests/<request_id>  ← المشرف يرد (approve/reject/resolve)
    """
    try:
        obj = TellerRequest.objects.get(request_id=request_id)
    except TellerRequest.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'الطلب غير موجود'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'request': obj.to_dict()})

    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

        new_status = data.get('status', '').strip()
        reply_text = data.get('reply', '').strip()

        valid_statuses = {'approved', 'rejected', 'resolved'}
        if new_status not in valid_statuses:
            return JsonResponse({'success': False,
                                 'message': f'status يجب أن يكون: {", ".join(valid_statuses)}'}, status=400)

        obj.status = new_status
        if reply_text:
            obj.reply = reply_text
        elif new_status == 'approved':
            obj.reply = 'تمت الموافقة على طلبك ✅'
        elif new_status == 'rejected':
            obj.reply = 'عذراً، تم رفض الطلب ❌'

        resolved_by = data.get('resolvedBy', '')
        if not resolved_by and request.user.is_authenticated:
            resolved_by = request.user.get_full_name() or request.user.username
        obj.resolved_by = resolved_by
        obj.resolved_at = timezone.now()
        obj.save()

        print(f'[REQUEST] رد المشرف على {obj.teller_name}: {new_status}')
        return JsonResponse({'success': True, 'request': obj.to_dict()})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# أرصدة صناديق التلرات — TellerBalance API
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_sv_balances(request):
    """
    POST /api/sv/balances           ← المشرف يعيّن/يضيف رصيد لتلر
    GET  /api/sv/balances           ← المشرف يجلب آخر رصيد لكل التلرات
    GET  /api/sv/balances?teller=x  ← التلر يجلب رصيده الخاص
    """
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)

        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

        teller_username = data.get('teller', '').strip()
        teller_name     = data.get('name', teller_username).strip()
        usd             = float(data.get('USD', 0) or 0)
        ils             = float(data.get('ILS', 0) or 0)
        jod             = float(data.get('JOD', 0) or 0)
        action          = data.get('action', 'set').strip()
        session_id      = data.get('sessionId', '').strip()

        if not teller_username:
            return JsonResponse({'success': False, 'message': 'حقل teller مطلوب'}, status=400)
        if usd <= 0 and ils <= 0 and jod <= 0:
            return JsonResponse({'success': False, 'message': 'يجب إدخال رصيد لعملة واحدة على الأقل'}, status=400)
        if action not in ('set', 'add'):
            action = 'set'

        sv_name = request.user.get_full_name() or request.user.username

        balance_obj = TellerBalance.objects.create(
            teller_username = teller_username,
            teller_name     = teller_name,
            usd             = usd,
            ils             = ils,
            jod             = jod,
            action          = action,
            set_by          = sv_name,
            session_id      = session_id,
        )

        # إبقاء آخر 100 سجل رصيد فقط
        old_ids = list(TellerBalance.objects.order_by('-created_at').values_list('id', flat=True)[100:])
        if old_ids:
            TellerBalance.objects.filter(id__in=old_ids).delete()

        print(f'[BALANCE] {sv_name} → {teller_username}: {action} USD={usd} ILS={ils} JOD={jod}')
        return JsonResponse({'success': True, 'balance': balance_obj.to_dict()})

    if request.method == 'GET':
        teller_filter = request.GET.get('teller', '').strip()

        # دعم ?teller=me — يستخدم الجلسة للتعرف على التلر
        if teller_filter == 'me':
            if not request.user.is_authenticated:
                return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)
            teller_filter = request.user.username

        if teller_filter:
            # التلر يجلب آخر رصيد له
            obj = TellerBalance.objects.filter(teller_username=teller_filter).order_by('-created_at').first()
            if obj:
                return JsonResponse({'success': True, 'balance': obj.to_dict()})
            return JsonResponse({'success': False, 'message': 'لا يوجد رصيد محدد لهذا التلر'}, status=200)

        # المشرف — آخر رصيد لكل تلر
        from django.db.models import Max
        latest_ids = (
            TellerBalance.objects
            .values('teller_username')
            .annotate(latest_id=Max('id'))
            .values_list('latest_id', flat=True)
        )
        objs = TellerBalance.objects.filter(id__in=latest_ids).order_by('teller_username')
        return JsonResponse({'success': True, 'balances': [o.to_dict() for o in objs]})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


# ══════════════════════════════════════════════════════════════════════════════
# قائمة التلرات — TellerProfile API
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_sv_tellers(request):
    """
    GET  /api/sv/tellers  ← جلب كل التلرات
    POST /api/sv/tellers  ← إضافة تلر جديد
    """
    if request.method == 'GET':
        tellers = TellerProfile.objects.all()
        return JsonResponse({'success': True, 'tellers': [t.to_dict() for t in tellers]})

    if request.method == 'POST':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

        name     = data.get('name', '').strip()
        username = data.get('username', '').strip()
        phone    = data.get('phone', '').strip()

        if not name or not username:
            return JsonResponse({'success': False, 'message': 'name و username مطلوبان'}, status=400)

        password = data.get('password', '').strip()
        if not password:
            return JsonResponse({'success': False, 'message': 'كلمة المرور مطلوبة'}, status=400)

        if TellerProfile.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': 'اسم المستخدم مستخدم مسبقاً'}, status=400)

        from ..models import SystemUser
        if SystemUser.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': 'اسم المستخدم محجوز في النظام'}, status=400)

        # التحقق الكامل من قوة كلمة المرور
        from django.contrib.auth.password_validation import validate_password as _vp
        from django.core.exceptions import ValidationError as _VE
        try:
            _vp(password)
        except _VE as e:
            return JsonResponse({'success': False, 'message': ' | '.join(e.messages)}, status=400)

        # توليد ID تلقائي (T001, T002, ...)
        last = TellerProfile.objects.order_by('-teller_id').first()
        if last:
            try:
                num = int(last.teller_id.replace('T', '')) + 1
            except ValueError:
                num = TellerProfile.objects.count() + 1
        else:
            num = 1
        teller_id = 'T' + str(num).zfill(3)

        # إنشاء حساب تسجيل الدخول
        SystemUser.objects.create_user(
            username   = username,
            password   = password,
            first_name = name,
            role       = 'T01',
        )

        teller = TellerProfile.objects.create(
            teller_id = teller_id,
            name      = name,
            username  = username,
            phone     = phone,
        )

        # إرسال SMS إذا كان هناك رقم هاتف
        from .sms import send_teller_credentials
        site_url   = request.build_absolute_uri('/login/')
        sms_result = send_teller_credentials(phone, name, username, password, site_url)

        print(f'[TELLERS] إضافة تلر جديد: {name} ({username}) | SMS: {sms_result["sent"]}')
        return JsonResponse({
            'success':  True,
            'teller':   teller.to_dict(),
            'smsSent':  sms_result['sent'],
            'smsError': sms_result['error'],
            'siteUrl':  site_url,
        })

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


@csrf_exempt
def api_sv_teller_detail(request, username):
    """
    PATCH  /api/sv/tellers/<username>  ← تحديث بيانات التلر (status, balance, ops, ...)
    DELETE /api/sv/tellers/<username>  ← حذف التلر
    """
    try:
        teller = TellerProfile.objects.get(username=username)
    except TellerProfile.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التلر غير موجود'}, status=404)

    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

        # تحديث الحقول المُرسَلة فقط
        changed = []
        if 'status' in data:
            teller.status = data['status']
            changed.append('status')
        if 'balance' in data:
            teller.balance = float(data['balance'] or 0)
            changed.append('balance')
        if 'ops' in data:
            teller.ops = int(data['ops'] or 0)
            changed.append('ops')
        if 'loginTime' in data:
            teller.login_time = data['loginTime'] or '—'
            changed.append('login_time')
        if 'lastOp' in data:
            teller.last_op = data['lastOp'] or '—'
            changed.append('last_op')
        if 'currency' in data:
            teller.currency = data['currency'] or 'USD'
            changed.append('currency')

        if changed:
            teller.save(update_fields=changed)

        return JsonResponse({'success': True, 'teller': teller.to_dict()})

    if request.method == 'DELETE':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)
        name = teller.name
        teller.delete()
        # حذف حساب الدخول أيضاً
        from ..models import SystemUser
        SystemUser.objects.filter(username=username).delete()
        print(f'[TELLERS] حذف التلر: {name} ({username})')
        return JsonResponse({'success': True, 'message': f'تم حذف التلر {name}'})

    return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)


@csrf_exempt
def api_sv_teller_password(request, username):
    """
    POST /api/sv/tellers/<username>/password  ← المشرف يغيّر كلمة مرور التلر
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    password = data.get('password', '').strip()
    if not password:
        return JsonResponse({'success': False, 'message': 'كلمة المرور مطلوبة'}, status=400)

    # التحقق الكامل من قوة كلمة المرور
    from django.contrib.auth.password_validation import validate_password as _vp
    from django.core.exceptions import ValidationError as _VE

    from ..models import SystemUser
    try:
        user = SystemUser.objects.get(username=username)
    except SystemUser.DoesNotExist:
        user = None

    try:
        _vp(password, user=user)
    except _VE as e:
        return JsonResponse({'success': False, 'message': ' | '.join(e.messages)}, status=400)

    if user is None:
        # إنشاء حساب إذا لم يكن موجوداً (تلر قديم أُضيف قبل هذه الميزة)
        teller_name = username
        try:
            teller_name = TellerProfile.objects.get(username=username).name
        except TellerProfile.DoesNotExist:
            pass
        SystemUser.objects.create_user(
            username   = username,
            password   = password,
            first_name = teller_name,
            role       = 'T01',
        )
        print(f'[TELLERS] إنشاء حساب جديد لـ {username}')
        return JsonResponse({'success': True, 'message': 'تم إنشاء حساب الدخول وتعيين كلمة المرور'})

    user.set_password(password)
    user.save(update_fields=['password'])

    # إلغاء جلسات المستخدم النشطة
    try:
        from django.contrib.sessions.models import Session
        from django.utils import timezone as tz
        for session in Session.objects.filter(expire_date__gte=tz.now()):
            if session.get_decoded().get('_auth_user_id') == str(user.pk):
                session.delete()
    except Exception:
        pass

    print(f'[TELLERS] تغيير كلمة مرور: {username}')
    return JsonResponse({'success': True, 'message': 'تم تغيير كلمة المرور وإلغاء الجلسات النشطة'})


# ══════════════════════════════════════════════════════════════════════════════
# صلاحيات التلرات — TellerPermission API
# ══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
def api_sv_permissions(request):
    """
    GET /api/sv/permissions          ← جلب صلاحيات كل التلرات (للمشرف)
    GET /api/sv/permissions?teller=x ← جلب صلاحيات تلر محدد (للتلر نفسه)
    """
    teller_filter = request.GET.get('teller', '').strip()

    # دعم ?teller=me — يستخدم الجلسة للتعرف على التلر
    if teller_filter == 'me':
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)
        teller_filter = request.user.username

    if teller_filter:
        obj, _ = TellerPermission.objects.get_or_create(
            teller_username=teller_filter,
            defaults={'exchange': True, 'international': True, 'electronic': True,
                      'special_price': False, 'double_delivery': False}
        )
        return JsonResponse({'success': True, 'permissions': obj.to_dict()})

    # كل التلرات
    perms = TellerPermission.objects.all()
    return JsonResponse({'success': True, 'permissions': [p.to_dict() for p in perms]})


@csrf_exempt
def api_sv_permission_detail(request, username):
    """
    PUT /api/sv/permissions/<username> ← المشرف يحفظ صلاحيات تلر
    """
    if request.method != 'PUT':
        return JsonResponse({'success': False, 'message': 'طريقة غير مدعومة'}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'يجب تسجيل الدخول'}, status=401)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    obj, _ = TellerPermission.objects.get_or_create(teller_username=username)
    obj.exchange        = bool(data.get('exchange',       obj.exchange))
    obj.international   = bool(data.get('international',  obj.international))
    obj.electronic      = bool(data.get('electronic',     obj.electronic))
    obj.special_price   = bool(data.get('specialPrice',   obj.special_price))
    obj.double_delivery = bool(data.get('doubleDelivery', obj.double_delivery))
    obj.updated_by      = request.user.get_full_name() or request.user.username
    obj.updated_at      = timezone.now()
    obj.save()

    print(f'[PERMS] {obj.updated_by} → {username}: {data}')
    return JsonResponse({'success': True, 'permissions': obj.to_dict()})
