"""
WhatsApp Bridge API
POST /api/wa/message/         ← Baileys يرسل الرسائل الواردة هنا
GET  /api/wa/messages/        ← الصفحة تجلب الرسائل الجديدة (cache)
GET  /api/wa/groups/          ← قائمة المجموعات
POST /api/wa/send/            ← إرسال رسالة عبر Baileys لرقم محدد
POST /api/wa/receipt/         ← Baileys يرسل إيصال وارد من وكيل للتحقق
GET  /api/wa/pending/         ← الحوالات المرسلة وتنتظر تأكيداً
GET  /api/wa/context/<id>/    ← سياق ساعتين قبل رسالة حوالة (من DB)
GET  /api/wa/feed/            ← feed المصدر: حوالات + محادثة حسب القروب (من DB)
"""
import base64
import json
import os
import re
import uuid
import requests
import anthropic
from datetime import timedelta
from django.conf import settings
from django.core.files.base import ContentFile
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
from django.utils import timezone
from ..models import WhatsAppMessage

# عنوان Baileys HTTP server
BAILEYS_URL = 'http://127.0.0.1:3001'

CACHE_KEY_MSGS     = 'wa_messages'
CACHE_KEY_GROUPS   = 'wa_groups'
CACHE_KEY_PENDING  = 'wa_pending_transfers'  # حوالات أُرسلت وتنتظر إيصال
CACHE_KEY_RECEIPTS = 'wa_incoming_receipts'  # كل الإيصالات الواردة (صور + أكواد)
MAX_MESSAGES       = 500


# ─────────────────────────────────────────────────────────────────────────────
# استقبال الرسائل الواردة من Baileys
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
def api_wa_inbound(request):
    """POST /api/wa/message/ — Baileys يرسل هنا كل رسالة واردة"""
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)

    is_image = data.get('isImage', False)
    msg = {
        'id':          data.get('messageId', ''),
        'jid':         data.get('jid', ''),
        'isGroup':     data.get('isGroup', False),
        'groupName':   data.get('groupName', ''),
        'senderJid':   data.get('senderJid', ''),
        'senderName':  data.get('senderName', ''),
        'text':        data.get('text', '') or ('📎 إيصال' if is_image else ''),
        'isImage':     is_image,
        'imageBase64': data.get('imageBase64', ''),
        'imageMime':   data.get('imageMime', 'image/jpeg'),
        'timestamp':   data.get('timestamp', 0),
        'receivedAt':  timezone.now().isoformat(),
    }

    if not msg['jid']:
        return JsonResponse({'ok': False, 'reason': 'empty'})
    if not msg['text'] and not is_image:
        return JsonResponse({'ok': False, 'reason': 'empty'})

    messages = cache.get(CACHE_KEY_MSGS) or []
    existing_ids = {m['id'] for m in messages}
    if msg['id'] and msg['id'] in existing_ids:
        return JsonResponse({'ok': True, 'duplicate': True})

    messages.append(msg)
    if len(messages) > MAX_MESSAGES:
        messages = messages[-MAX_MESSAGES:]
    cache.set(CACHE_KEY_MSGS, messages, timeout=86400)

    if msg['isGroup'] and msg['groupName']:
        groups = cache.get(CACHE_KEY_GROUPS) or {}
        groups[msg['jid']] = msg['groupName']
        cache.set(CACHE_KEY_GROUPS, groups, timeout=86400)

    # حفظ في قاعدة البيانات (دائم)
    _save_to_db(msg)

    # هل هذه رسالة من وكيل يحمل إيصالاً؟ — نفحصها تلقائياً
    _check_for_receipt(msg)

    return JsonResponse({'ok': True})


def _save_to_db(msg):
    """يحفظ الرسالة في DB — يتجاهل التكرار بصمت"""
    try:
        if not msg.get('id'):
            return
        obj, created = WhatsAppMessage.objects.get_or_create(
            msg_id=msg['id'],
            defaults={
                'jid':         msg.get('jid', ''),
                'is_group':    msg.get('isGroup', False),
                'group_name':  msg.get('groupName', ''),
                'sender_jid':  msg.get('senderJid', ''),
                'sender_name': msg.get('senderName', ''),
                'text':        msg.get('text', ''),
                'wa_timestamp':msg.get('timestamp', 0),
                'has_image':   msg.get('isImage', False),
                'msg_type':    'chat',
            }
        )
        # حفظ الصورة إن وُجدت وكان السجل جديداً
        if created and msg.get('imageBase64') and msg.get('isImage'):
            _save_receipt_image(obj, msg['imageBase64'], msg.get('imageMime', 'image/jpeg'))
    except Exception:
        pass


def _save_receipt_image(wa_msg_obj, b64_data, mime_type):
    """يحوّل base64 إلى ملف ويحفظه في media/receipts/"""
    try:
        ext = 'jpg'
        if 'png' in mime_type:  ext = 'png'
        elif 'pdf' in mime_type: ext = 'pdf'
        elif 'webp' in mime_type: ext = 'webp'

        filename  = f"{uuid.uuid4().hex}.{ext}"
        img_bytes = base64.b64decode(b64_data)
        wa_msg_obj.receipt_image.save(filename, ContentFile(img_bytes), save=True)
    except Exception as e:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# جلب الرسائل الواردة
# ─────────────────────────────────────────────────────────────────────────────
def api_wa_messages(request):
    """GET /api/wa/messages/?since=<timestamp>&group=<jid>"""
    since     = int(request.GET.get('since', 0))
    group_jid = request.GET.get('group', '')

    messages = cache.get(CACHE_KEY_MSGS) or []
    if since:
        messages = [m for m in messages if m['timestamp'] > since]
    if group_jid:
        messages = [m for m in messages if m['jid'] == group_jid]

    return JsonResponse({'ok': True, 'messages': messages, 'count': len(messages)})


# ─────────────────────────────────────────────────────────────────────────────
# قائمة المجموعات
# ─────────────────────────────────────────────────────────────────────────────
def api_wa_groups(request):
    """GET /api/wa/groups/"""
    groups = cache.get(CACHE_KEY_GROUPS) or {}
    result = [{'jid': jid, 'name': name} for jid, name in groups.items()]
    return JsonResponse({'ok': True, 'groups': result})


# ─────────────────────────────────────────────────────────────────────────────
# إرسال رسالة واتساب عبر Baileys
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
def api_wa_send(request):
    """
    POST /api/wa/send/
    body: { "to": "962791234567", "message": "نص", "transfer_code": "123-456" }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)

    to_number     = (data.get('to') or '').strip().lstrip('+')
    message_text  = (data.get('message') or '').strip()
    transfer_code = (data.get('transfer_code') or '').strip()
    agent_id      = data.get('agent_id')

    if not to_number or not message_text:
        return JsonResponse({'ok': False, 'error': 'to و message مطلوبان'}, status=400)

    # تنظيف الرقم على مستوى Django أيضاً
    to_number = re.sub(r'[^0-9]', '', to_number)
    if not to_number:
        return JsonResponse({'ok': False, 'error': 'رقم الهاتف فارغ بعد التنظيف'}, status=400)

    # أرسل لـ Baileys
    try:
        resp = requests.post(
            f'{BAILEYS_URL}/send',
            json={'to': to_number, 'message': message_text},
            timeout=35,
        )
        try:
            baileys_data = resp.json()
        except Exception:
            baileys_data = {}

        baileys_ok = resp.status_code == 200 and baileys_data.get('ok', False)

        if not baileys_ok:
            err_msg = baileys_data.get('error') or f'Baileys HTTP {resp.status_code}'
            cleaned = baileys_data.get('cleaned', to_number)
            return JsonResponse({
                'ok':      False,
                'error':   err_msg,
                'to':      to_number,
                'cleaned': cleaned,
            }, status=resp.status_code if resp.status_code in (400,404,503,504) else 502)

    except requests.exceptions.ConnectionError:
        return JsonResponse({'ok': False, 'error': 'البوت غير مشغّل — شغّل whatsapp-bridge أولاً'}, status=503)
    except requests.exceptions.Timeout:
        return JsonResponse({'ok': False, 'error': 'انتهت مهلة الإرسال (35 ثانية) — تحقق من اتصال الواتساب'}, status=504)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': f'خطأ: {str(e)}'}, status=503)

    # احفظ الحوالة في قائمة الانتظار إذا نجح الإرسال
    if transfer_code:
        pending = cache.get(CACHE_KEY_PENDING) or {}
        pending[transfer_code] = {
            'transfer_code': transfer_code,
            'agent_id':      agent_id,
            'to_number':     to_number,
            'message':       message_text,
            'sent_at':       timezone.now().isoformat(),
            'status':        'waiting',
            'receipt':       None,
        }
        cache.set(CACHE_KEY_PENDING, pending, timeout=86400)

    return JsonResponse({
        'ok':      True,
        'sent_to': baileys_data.get('sent_to', to_number),
        'code':    transfer_code,
    })


# ─────────────────────────────────────────────────────────────────────────────
# التحقق من رقم واتساب (تشخيص)
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
def api_wa_check_number(request):
    """
    POST /api/wa/check-number/
    body: { "to": "962791234567" }
    يتحقق عبر Baileys هل الرقم مسجّل على واتساب
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)

    to_number = re.sub(r'[^0-9]', '', (data.get('to') or '').strip())
    if not to_number:
        return JsonResponse({'ok': False, 'error': 'رقم فارغ'}, status=400)

    try:
        resp = requests.post(
            f'{BAILEYS_URL}/check-number',
            json={'to': to_number},
            timeout=15,
        )
        return JsonResponse(resp.json(), status=resp.status_code)
    except requests.exceptions.ConnectionError:
        return JsonResponse({'ok': False, 'error': 'البوت غير مشغّل'}, status=503)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=503)


# ─────────────────────────────────────────────────────────────────────────────
# جلب الحوالات المعلّقة (تنتظر إيصال)
# ─────────────────────────────────────────────────────────────────────────────
def api_wa_pending(request):
    """GET /api/wa/pending/ — الحوالات المرسلة وتنتظر تأكيداً"""
    pending = cache.get(CACHE_KEY_PENDING) or {}
    return JsonResponse({'ok': True, 'pending': list(pending.values())})


# ─────────────────────────────────────────────────────────────────────────────
# التحقق من الإيصال الوارد
# ─────────────────────────────────────────────────────────────────────────────
def _check_for_receipt(msg):
    """
    تُستدعى مع كل رسالة واردة.
    إذا احتوت صورة + كود → تحفظ الإيصال وتُشعر الواجهة فوراً.
    """
    text     = msg.get('text', '') or ''
    is_image = msg.get('isImage', False)

    # استخرج الأكواد بصيغة XXX-XXX أو 000-000
    codes_in_text = re.findall(r'\b([A-Z0-9]{3}-[A-Z0-9]{3})\b', text, re.IGNORECASE)
    codes_in_text += re.findall(r'\b(\d{3}-\d{3})\b', text)
    codes_in_text = list(set(c.upper() for c in codes_in_text))

    # لا شيء نفعله إذا لا صورة ولا كود
    if not is_image and not codes_in_text:
        return

    now_iso      = timezone.now().isoformat()
    image_url    = ''
    matched_code = codes_in_text[0] if codes_in_text else ''

    # احفظ الصورة في DB وجلب URL
    if is_image and msg.get('id'):
        try:
            wa_obj = WhatsAppMessage.objects.filter(msg_id=msg['id']).first()
            if wa_obj:
                if matched_code:
                    wa_obj.matched_code = matched_code
                wa_obj.has_image = True
                wa_obj.save(update_fields=['matched_code', 'has_image'])
                if msg.get('imageBase64') and not wa_obj.receipt_image:
                    _save_receipt_image(wa_obj, msg['imageBase64'], msg.get('imageMime', 'image/jpeg'))
                    wa_obj.refresh_from_db()
                if wa_obj.receipt_image:
                    image_url = wa_obj.receipt_image.url
        except Exception:
            pass

    # أضف لـ cache الإيصالات المستقل — الواجهة تقرأه كل 15 ثانية
    receipt_entry = {
        'code':            matched_code,
        'senderName':      msg.get('senderName', ''),
        'senderJid':       msg.get('senderJid', ''),
        'hasImage':        is_image,
        'receipt':         text,
        'receiptImageUrl': image_url,
        'confirmedAt':     now_iso,
        'agentId':         None,
        'seen':            False,
    }
    receipts = cache.get(CACHE_KEY_RECEIPTS) or []
    receipts.append(receipt_entry)
    if len(receipts) > 100:
        receipts = receipts[-100:]
    cache.set(CACHE_KEY_RECEIPTS, receipts, timeout=86400)

    # إذا كان الكود موجوداً في pending → حدّثه أيضاً
    if matched_code:
        pending = cache.get(CACHE_KEY_PENDING) or {}
        if matched_code in pending and pending[matched_code].get('status') == 'waiting':
            pending[matched_code].update({
                'status':           'confirmed',
                'receipt':          text,
                'receipt_jid':      msg.get('jid', ''),
                'has_image':        is_image,
                'sender_name':      msg.get('senderName', ''),
                'confirmed_at':     now_iso,
                'receipt_image_url': image_url,
            })
            cache.set(CACHE_KEY_PENDING, pending, timeout=86400)


@csrf_exempt
def api_wa_receipt(request):
    """
    POST /api/wa/receipt/
    يُستدعى من Baileys عند ورود رسالة تحتوي كود حوالة من وكيل.
    body: { "transfer_code": "123-456", "receipt_text": "نص الإيصال", "from": "962..." }
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)

    code         = (data.get('transfer_code') or '').strip()
    receipt_text = (data.get('receipt_text')  or '').strip()
    from_number  = (data.get('from')          or '').strip()

    pending = cache.get(CACHE_KEY_PENDING) or {}

    if code not in pending:
        return JsonResponse({'ok': False, 'reason': 'كود غير موجود في الانتظار'})

    pending[code]['status']       = 'confirmed'
    pending[code]['receipt']      = receipt_text
    pending[code]['from_number']  = from_number
    pending[code]['confirmed_at'] = timezone.now().isoformat()
    cache.set(CACHE_KEY_PENDING, pending, timeout=86400)

    return JsonResponse({'ok': True, 'code': code, 'status': 'confirmed'})


@csrf_exempt
def api_wa_parse(request):
    """
    POST /api/wa/parse/
    body: { "text": "نص الرسالة" }
    يستخدم Claude لاستخراج: amount, currency, name, phone, wallet
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)

    text = (data.get('text') or '').strip()
    if not text:
        return JsonResponse({'ok': False, 'error': 'text مطلوب'}, status=400)

    try:
        client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY', ''))
        message = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=256,
            messages=[{
                'role': 'user',
                'content': f"""استخرج المعلومات التالية من رسالة حوالة مالية واتساب وأعدها بصيغة JSON فقط بدون أي نص إضافي:

الرسالة:
{text}

أعد JSON بهذا الشكل بالضبط:
{{
  "amount": <رقم المبلغ أو 0>,
  "currency": "<USD|EUR|JOD|ILS|TRY|SAR|AED|EGP|TND|MAD>",
  "name": "<اسم المستفيد أو فارغ>",
  "phone": "<رقم الهاتف بالأرقام فقط أو فارغ>",
  "wallet": "<رقم المحفظة أو IBAN أو فارغ>"
}}

قواعد:
- المبلغ هو الرقم الصغير (عادة 1-99999) وليس رقم الهاتف
- رقم الهاتف عادة 10-15 رقم ويبدأ برمز دولة
- إذا لم تجد قيمة اكتب null"""
            }]
        )

        raw = message.content[0].text.strip()
        # استخرج JSON من الرد
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if not json_match:
            raise ValueError('لم يعد Claude JSON صحيح')

        parsed = json.loads(json_match.group())
        return JsonResponse({'ok': True, 'parsed': parsed})

    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=500)


@csrf_exempt
def api_wa_check_receipt(request, code):
    """GET /api/wa/check/<code>/ — الصفحة تسأل: هل وصل إيصال لهذا الكود؟"""
    pending = cache.get(CACHE_KEY_PENDING) or {}
    entry = pending.get(code)
    if not entry:
        return JsonResponse({'ok': False, 'found': False})

    return JsonResponse({
        'ok':         True,
        'found':      True,
        'status':     entry.get('status', 'waiting'),
        'receipt':    entry.get('receipt'),
        'hasImage':   entry.get('has_image', False),
        'senderName': entry.get('sender_name', ''),
        'confirmedAt': entry.get('confirmed_at'),
    })


def api_wa_receipts_new(request):
    """
    GET /api/wa/receipts/new/
    يُرجع الإيصالات الجديدة غير المشاهدة.
    بعد الإرجاع يضعها كـ seen=True.
    """
    receipts = cache.get(CACHE_KEY_RECEIPTS) or []
    unseen   = [r for r in receipts if not r.get('seen')]

    # ضع كلها كـ seen
    if unseen:
        for r in receipts:
            r['seen'] = True
        cache.set(CACHE_KEY_RECEIPTS, receipts, timeout=86400)

    return JsonResponse({'ok': True, 'receipts': unseen, 'count': len(unseen)})


# ─────────────────────────────────────────────────────────────────────────────
# feed المصدر: حوالات + محادثة مدمجة حسب القروب (من DB)
# ─────────────────────────────────────────────────────────────────────────────
def api_wa_feed(request):
    """
    GET /api/wa/feed/?jid=<jid>&hours=<hours>
    يُرجع آخر N ساعة من رسائل القروب مُدمجة:
      - رسائل عادية (chat)
      - رسائل حوالة (hawala) — مع علامة مميزة
    """
    jid   = request.GET.get('jid', '')
    hours = int(request.GET.get('hours', 4))
    hours = min(max(hours, 1), 48)   # بين 1 و 48 ساعة

    since = timezone.now() - timedelta(hours=hours)
    qs    = WhatsAppMessage.objects.filter(received_at__gte=since).exclude(msg_type='ignore')

    if jid:
        qs = qs.filter(jid=jid)

    qs = qs.order_by('received_at')

    messages = [m.to_dict() for m in qs]
    return JsonResponse({'ok': True, 'messages': messages, 'count': len(messages)})


# ─────────────────────────────────────────────────────────────────────────────
# سياق ساعتين قبل رسالة حوالة
# ─────────────────────────────────────────────────────────────────────────────
def api_wa_context(request, msg_id):
    """
    GET /api/wa/context/<msg_id>/
    يُرجع رسائل القروب في ساعتين قبل رسالة الحوالة وساعة بعدها
    لتوفير السياق الكامل عند الضغط على الحوالة
    """
    try:
        hawala_msg = WhatsAppMessage.objects.get(id=msg_id)
    except WhatsAppMessage.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'رسالة غير موجودة'}, status=404)

    ref_time   = hawala_msg.received_at
    since      = ref_time - timedelta(hours=2)
    until      = ref_time + timedelta(hours=1)

    context_qs = WhatsAppMessage.objects.filter(
        jid=hawala_msg.jid,
        received_at__gte=since,
        received_at__lte=until,
    ).exclude(msg_type='ignore').order_by('received_at')

    context_msgs = [m.to_dict() for m in context_qs]

    return JsonResponse({
        'ok':       True,
        'hawalaId': msg_id,
        'jid':      hawala_msg.jid,
        'refTime':  ref_time.isoformat(),
        'messages': context_msgs,
        'count':    len(context_msgs),
    })


# ─────────────────────────────────────────────────────────────────────────────
# تحديث نوع الرسالة (حوالة / محادثة)
# ─────────────────────────────────────────────────────────────────────────────
@csrf_exempt
def api_wa_update_type(request, msg_id):
    """
    POST /api/wa/msg/<msg_id>/type/
    body: { "type": "hawala" | "chat" | "ignore" }
    يسمح للمستخدم بتصحيح تصنيف الرسالة يدوياً
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)
    try:
        data     = json.loads(request.body)
        new_type = data.get('type', '')
        if new_type not in ('hawala', 'chat', 'ignore'):
            return JsonResponse({'ok': False, 'error': 'نوع غير صحيح'}, status=400)
        updated = WhatsAppMessage.objects.filter(id=msg_id).update(msg_type=new_type)
        if not updated:
            return JsonResponse({'ok': False, 'error': 'رسالة غير موجودة'}, status=404)
        return JsonResponse({'ok': True, 'id': msg_id, 'type': new_type})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=400)
