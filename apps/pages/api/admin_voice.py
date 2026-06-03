"""
admin_voice.py — الميزة الصوتية للإدارة العامة
POST /api/admin/voice/  ← يستقبل صوت المدير، Whisper يحوّله لنص،
                          GPT-4o-mini يفهم الطلب وينفّذه على DB
"""
import json
import os
import tempfile
import traceback
import urllib.request as _ur

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.conf import settings
from django.db.models import Sum, Count, Q

from ..models import (
    ExchangeOperation, HawalaOperation, CashTransaction,
    HawalaTransfer, BankTransfer, CentralTreasury,
    AdminInstruction, SystemUser, TellerProfile,
)
from .auth_api import require_flutter_auth

ADMIN_ROLES = {'M01', 'IM01'}


# ── أدوات Claude ─────────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "get_daily_stats",
        "description": "يجلب إحصائيات اليوم: إجمالي عمليات الصرف والحوالات والمبالغ",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "التاريخ بصيغة YYYY-MM-DD، افتراضياً اليوم"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_weekly_stats",
        "description": "يجلب إحصائيات الأسبوع الحالي مقارنةً بالأسبوع الماضي",
        "input_schema": {"type": "object", "properties": {}, "required": []}
    },
    {
        "name": "get_treasury_balance",
        "description": "يجلب رصيد الخزينة المركزية الحالي",
        "input_schema": {"type": "object", "properties": {}, "required": []}
    },
    {
        "name": "get_top_tellers",
        "description": "يجلب أكثر التلر نشاطاً اليوم حسب عدد العمليات",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "عدد التلر، افتراضياً 5"}
            },
            "required": []
        }
    },
    {
        "name": "send_instruction",
        "description": "يرسل تعليمة أو تنبيه من المدير للمشرفين أو موظف محدد",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "نص التعليمة أو التنبيه"
                },
                "target_role": {
                    "type": "string",
                    "description": "الدور المستهدف: M02 أو M03 أو all للجميع",
                    "enum": ["M02", "M03", "all"]
                }
            },
            "required": ["message", "target_role"]
        }
    },
    {
        "name": "search_transfer",
        "description": "يبحث عن حوالة باسم المرسل أو المستلم",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "اسم المرسل أو المستلم للبحث"
                }
            },
            "required": ["name"]
        }
    },
]


# ── تنفيذ الأدوات ─────────────────────────────────────────────────────────────

def _execute_tool(name: str, inputs: dict, admin_user) -> str:
    today = timezone.now().date()

    if name == "get_daily_stats":
        date_str = inputs.get("date", "")
        try:
            from datetime import date as dt
            target = dt.fromisoformat(date_str) if date_str else today
        except ValueError:
            target = today

        ex = ExchangeOperation.objects.filter(created_at__date=target)
        hw = HawalaOperation.objects.filter(created_at__date=target)
        ct = CashTransaction.objects.filter(created_at__date=target)

        ex_count   = ex.count()
        ex_total   = ex.aggregate(t=Sum("amount"))["t"] or 0
        hw_count   = hw.count()
        hw_total   = hw.aggregate(t=Sum("amount_usd"))["t"] or 0
        wd_count   = ct.filter(type="withdrawal").count()
        dep_count  = ct.filter(type="deposit").count()

        label = "اليوم" if target == today else str(target)
        return (
            f"إحصائيات {label}:\n"
            f"• عمليات الصرف: {ex_count} عملية — إجمالي ${ex_total:,.2f}\n"
            f"• الحوالات: {hw_count} حوالة — إجمالي ${hw_total:,.2f}\n"
            f"• عمليات السحب: {wd_count}\n"
            f"• عمليات الإيداع: {dep_count}\n"
            f"• المجموع الكلي للعمليات: {ex_count + hw_count + wd_count + dep_count}"
        )

    elif name == "get_weekly_stats":
        from datetime import timedelta
        week_start      = today - timezone.timedelta(days=today.weekday())
        last_week_start = week_start - timedelta(days=7)
        last_week_end   = week_start - timedelta(days=1)

        this_ex   = ExchangeOperation.objects.filter(created_at__date__gte=week_start).count()
        this_hw   = HawalaOperation.objects.filter(created_at__date__gte=week_start).count()
        last_ex   = ExchangeOperation.objects.filter(
            created_at__date__gte=last_week_start, created_at__date__lte=last_week_end).count()
        last_hw   = HawalaOperation.objects.filter(
            created_at__date__gte=last_week_start, created_at__date__lte=last_week_end).count()

        this_total = this_ex + this_hw
        last_total = last_ex + last_hw
        diff       = this_total - last_total
        trend      = f"↑ زيادة {diff}" if diff > 0 else (f"↓ نقص {abs(diff)}" if diff < 0 else "= نفس العدد")

        return (
            f"مقارنة الأسبوع:\n"
            f"هذا الأسبوع: {this_ex} صرف + {this_hw} حوالة = {this_total} عملية\n"
            f"الأسبوع الماضي: {last_ex} صرف + {last_hw} حوالة = {last_total} عملية\n"
            f"الفرق: {trend}"
        )

    elif name == "get_treasury_balance":
        try:
            treasury = CentralTreasury.objects.first()
            if not treasury:
                return "لا توجد بيانات للخزينة المركزية."
            return (
                f"رصيد الخزينة المركزية:\n"
                f"• دولار: ${treasury.usd_balance:,.2f}\n"
                f"• شيكل: ₪{treasury.ils_balance:,.2f}\n"
                f"• دينار: {treasury.jod_balance:,.3f} JOD"
            )
        except Exception as e:
            return f"خطأ في جلب رصيد الخزينة: {e}"

    elif name == "get_top_tellers":
        try:
            limit = min(int(inputs.get("limit", 5)), 10)
        except (ValueError, TypeError):
            limit = 5
        results = (
            ExchangeOperation.objects
            .filter(created_at__date=today)
            .values("operator")
            .annotate(ops=Count("id"))
            .order_by("-ops")[:limit]
        )
        if not results:
            return "لا توجد عمليات مسجلة اليوم."
        lines = ["أكثر التلر نشاطاً اليوم:"]
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. {r['operator']} — {r['ops']} عملية")
        return "\n".join(lines)

    elif name == "send_instruction":
        message     = inputs.get("message", "").strip()[:1000]
        target_role = inputs.get("target_role", "all")
        if target_role not in ("M02", "M03", "all"):
            target_role = "all"

        if not message:
            return "نص التعليمة فارغ."

        role_label = {"M02": "مشرف التلر", "M03": "مشرف الحوالات", "all": "جميع المشرفين"}

        if target_role == "all":
            targets = SystemUser.objects.filter(role__in=["M02", "M03"], is_active=True)
        else:
            targets = SystemUser.objects.filter(role=target_role, is_active=True)

        count = 0
        for target_user in targets:
            AdminInstruction.objects.create(
                sender=admin_user,
                recipient=target_user,
                body=message,
            )
            count += 1

        if count == 0:
            return f"لا يوجد مستخدمون نشطون بدور {role_label.get(target_role, target_role)}."

        return f"✓ تم إرسال التعليمة لـ {count} من {role_label.get(target_role, 'المشرفين')}:\n\"{message}\""

    elif name == "search_transfer":
        name_q = inputs.get("name", "").strip()[:100]
        if not name_q:
            return "أدخل اسماً للبحث."

        results = HawalaOperation.objects.filter(
            Q(sender_name__icontains=name_q) | Q(receiver_name__icontains=name_q)
        ).order_by("-created_at")[:5]

        if not results.exists():
            return f"لم يتم العثور على حوالات باسم '{name_q}'."

        lines = [f"نتائج البحث عن '{name_q}':"]
        for r in results:
            lines.append(
                f"• {r.sender_name} → {r.receiver_name} | "
                f"${r.amount_usd} | {r.created_at.strftime('%Y-%m-%d')}"
            )
        return "\n".join(lines)

    return "أداة غير معروفة."


# ── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "أنت مساعد صوتي ذكي للمدير العام في شركة انترناشونال للصرافة.\n"
    "مهمتك فهم أوامر المدير وتنفيذها:\n"
    "- الاستعلام عن إحصائيات اليوم والأسبوع\n"
    "- جلب رصيد الخزينة\n"
    "- معرفة أكثر التلر نشاطاً\n"
    "- إرسال تعليمات للمشرفين\n"
    "- البحث عن حوالات بالاسم\n\n"
    "قواعد:\n"
    "- أجب دائماً بالعربية بأسلوب مختصر ومهني\n"
    "- استخدم الأدوات للحصول على البيانات الحقيقية\n"
    "- إذا لم تفهم الطلب اطلب توضيحاً"
)


# ── Endpoint ──────────────────────────────────────────────────────────────────

def _auto_execute(text: str, admin_user) -> str:
    """يكتشف نوع الطلب ويشغّل الأداة المناسبة مباشرة."""
    t = text.lower()
    if any(k in t for k in ['إحصائيات', 'اليوم', 'كم عملية', 'عمليات اليوم']):
        return _execute_tool('get_daily_stats', {}, admin_user)
    if any(k in t for k in ['أسبوع', 'مقارنة', 'الأسبوع']):
        return _execute_tool('get_weekly_stats', {}, admin_user)
    if any(k in t for k in ['خزينة', 'رصيد', 'الخزينة']):
        return _execute_tool('get_treasury_balance', {}, admin_user)
    if any(k in t for k in ['تلر', 'أكثر', 'نشاط', 'موظف']):
        return _execute_tool('get_top_tellers', {}, admin_user)
    if any(k in t for k in ['بحث', 'ابحث', 'حوالة', 'اسم']):
        # استخراج الاسم: الكلمة بعد "عن" أو "باسم"
        import re
        m = re.search(r'(?:عن|باسم)\s+(\S+)', text)
        name = m.group(1) if m else text.split()[-1]
        return _execute_tool('search_transfer', {'name': name}, admin_user)
    return ''


def _openai_chat(openai_key: str, messages: list) -> str:
    """استدعاء GPT-4o-mini عبر urllib (بدون مكتبات خارجية إضافية)."""
    payload = json.dumps({
        "model": "gpt-4o-mini",
        "max_tokens": 1024,
        "messages": messages,
    }, ensure_ascii=False).encode()
    req = _ur.Request(
        'https://api.openai.com/v1/chat/completions',
        data=payload,
        headers={
            'Authorization': f'Bearer {openai_key}',
            'Content-Type':  'application/json',
        },
        method='POST',
    )
    with _ur.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return (data['choices'][0]['message']['content'] or '').strip()


def _whisper_transcribe(openai_key: str, tmp_path: str, suffix: str) -> str:
    """تحويل الصوت لنص عبر Whisper API."""
    with open(tmp_path, 'rb') as f:
        audio_bytes = f.read()
    boundary = b'----Boundary7MA4YWxkTrZu0gW'
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
        b'\xd8\xa5\xd8\xad\xd8\xb5\xd8\xa7\xd8\xa6\xd9\x8a\xd8\xa7\xd8\xaa \xd8\xad\xd9\x88\xd8\xa7\xd9\x84\xd8\xa7\xd8\xaa \xd8\xae\xd8\xb2\xd9\x8a\xd9\x86\xd8\xa9 \xd8\xaa\xd9\x84\xd8\xb1 \xd8\xb5\xd8\xb1\xd9\x81 \xd8\xaf\xd9\x88\xd9\x84\xd8\xa7\xd8\xb1\r\n'
        b'--' + boundary + b'--\r\n'
    )
    req = _ur.Request(
        'https://api.openai.com/v1/audio/transcriptions',
        data=body,
        headers={
            'Authorization': f'Bearer {openai_key}',
            'Content-Type': 'multipart/form-data; boundary=----Boundary7MA4YWxkTrZu0gW',
        },
        method='POST',
    )
    with _ur.urlopen(req, timeout=30) as resp:
        return (json.loads(resp.read()).get('text') or '').strip()


@csrf_exempt
@require_POST
def api_admin_voice(request):
    """POST /api/admin/voice/ — الميزة الصوتية للمدير العام"""
    auth_err, auth_user = require_flutter_auth(request)
    if auth_err:
        return auth_err

    if auth_user.role not in ADMIN_ROLES:
        return JsonResponse({'success': False, 'message': 'هذه الميزة للإدارة العامة فقط'}, status=403)

    openai_key = getattr(settings, 'OPENAI_API_KEY', '') or os.environ.get('OPENAI_API_KEY', '')
    if not openai_key:
        return JsonResponse({'success': False, 'message': 'OPENAI_API_KEY غير مضبوط'}, status=503)

    tmp_path = None

    try:
        # ── 1. تحويل الصوت لنص (Whisper) ────────────────────────────────────
        text = (request.POST.get('text') or '').strip()

        if not text:
            audio_file = request.FILES.get('audio')
            if not audio_file:
                return JsonResponse({'success': False, 'message': 'أرسل ملف صوتي أو نصاً'}, status=400)

            suffix = os.path.splitext(audio_file.name)[1] or '.m4a'
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                for chunk in audio_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            text = _whisper_transcribe(openai_key, tmp_path, suffix)

        if not text:
            return JsonResponse({'success': False, 'message': 'لم يُتعرف على كلام واضح'})

        # ── 2. تنفيذ الأدوات يدوياً ثم إرسال النتيجة لـ GPT ─────────────────
        tool_result = _auto_execute(text, auth_user)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": text},
        ]
        if tool_result:
            messages.append({"role": "assistant", "content": f"[بيانات من النظام]\n{tool_result}"})
            messages.append({"role": "user",      "content": "بناءً على هذه البيانات أعطِني إجابة مختصرة واضحة."})

        reply = _openai_chat(openai_key, messages)

        return JsonResponse({
            'success':    True,
            'transcript': text,
            'reply':      reply,
            'operator':   auth_user.get_full_name() or auth_user.username,
        })

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': f'خطأ: {e}'}, status=500)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
