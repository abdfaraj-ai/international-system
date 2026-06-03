"""
portal_chat.py — شات بوت ذكي للبوابة الخارجية
يستخدم Groq API (llama-3.1-8b-instant) مع Function Calling
"""
import json
import urllib.request
import urllib.error
from django.conf import settings
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ..models import PortalCountry, PortalTransferRequest


# ── أدوات الوكيل (Tools لـ Groq / OpenAI format) ─────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_countries_and_rates",
            "description": "يجلب قائمة الدول المتاحة للتحويل مع أسعار الصرف وطرق الاستقبال",
            "parameters": {
                "type": "object",
                "properties": {},
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "track_transfer",
            "description": "يتتبع حالة طلب حوالة برمز التتبع. استخدمها عندما يذكر العميل رمزاً مثل PT-240101-ABCD1234",
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_code": {
                        "type": "string",
                        "description": "رمز تتبع الحوالة مثل PT-240101-ABCD1234"
                    }
                },
                "required": ["tracking_code"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_amount",
            "description": "يحسب المبلغ الذي سيصل للمستفيد بعد تحويل الدولار لعملة الدولة المطلوبة",
            "parameters": {
                "type": "object",
                "properties": {
                    "country_slug": {
                        "type": "string",
                        "description": "معرف الدولة مثل sa او tr او eg"
                    },
                    "amount_usd": {
                        "type": "number",
                        "description": "المبلغ بالدولار"
                    }
                },
                "required": ["country_slug", "amount_usd"]
            }
        }
    }
]


# ── تنفيذ الأدوات ─────────────────────────────────────────────────────────────

def execute_tool(name: str, inputs: dict) -> str:
    if name == "get_countries_and_rates":
        countries = (
            PortalCountry.objects
            .filter(is_active=True)
            .prefetch_related("methods")
            .order_by("order", "name")
        )
        if not countries.exists():
            return "لا توجد دول متاحة حالياً للتحويل."
        lines = ["الدول المتاحة للتحويل:\n"]
        for c in countries:
            methods = [m.name for m in c.methods.filter(is_active=True)]
            methods_str = " / ".join(methods) if methods else "لا توجد طرق متاحة"
            rate_label  = c.rate_note or f"1 USD = {c.rate} {c.currency}"
            lines.append(f"- {c.flag} {c.name} ({c.currency}) | {rate_label} | طرق: {methods_str}")
        return "\n".join(lines)

    elif name == "track_transfer":
        code = inputs.get("tracking_code", "").strip().upper()
        try:
            req = PortalTransferRequest.objects.get(tracking_code=code)
            status_map = {
                "new":       "جديد - في انتظار المراجعة",
                "reviewing": "قيد المراجعة - يعمل عليه الفريق",
                "done":      "منفذ - تم إرسال الحوالة",
                "rejected":  "مرفوض - تواصل معنا للمزيد",
            }
            return (
                f"رمز التتبع: {req.tracking_code}\n"
                f"الحالة: {status_map.get(req.status, req.get_status_display())}\n"
                f"الدولة: {req.country_name}\n"
                f"طريقة الاستقبال: {req.method_name}\n"
                f"تاريخ الطلب: {req.created_at.strftime('%Y-%m-%d %H:%M')}"
            )
        except PortalTransferRequest.DoesNotExist:
            return f"لم يتم العثور على طلب برمز '{code}'. تأكد من الرمز وحاول مجدداً."

    elif name == "calculate_amount":
        slug       = inputs.get("country_slug", "").strip().lower()
        amount_usd = float(inputs.get("amount_usd", 0))
        try:
            country   = PortalCountry.objects.get(slug=slug, is_active=True)
            fee_pct   = float(country.fee_pct)
            fee_usd   = round(amount_usd * fee_pct / 100, 2)
            net_usd   = round(amount_usd - fee_usd, 2)
            local_amt = round(net_usd * float(country.rate), 2)
            lines = [
                f"حساب التحويل الى {country.flag} {country.name}:",
                f"المبلغ المرسل: ${amount_usd:.2f}",
            ]
            if fee_pct > 0:
                lines.append(f"العمولة ({fee_pct}%): ${fee_usd:.2f}")
                lines.append(f"الصافي بعد العمولة: ${net_usd:.2f}")
            lines.append(f"يصل للمستفيد: {local_amt:,.2f} {country.currency}")
            lines.append(f"سعر الصرف: {country.rate_note or f'1 USD = {country.rate} {country.currency}'}")
            return "\n".join(lines)
        except PortalCountry.DoesNotExist:
            return f"الدولة '{slug}' غير متاحة. استخدم get_countries_and_rates لرؤية الدول المتاحة."

    return "أداة غير معروفة."


# ── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "انت مساعد ذكي لبوابة الحوالات الدولية في شركة انترناشونال للصرافة.\n"
    "مهمتك مساعدة العملاء في:\n"
    "- الاستفسار عن الدول المتاحة للتحويل واسعار الصرف\n"
    "- تتبع حالة الحوالات برمز التتبع\n"
    "- حساب المبلغ الذي سيصل للمستفيد\n"
    "- الاجابة على الاسئلة العامة حول خدمات الشركة\n\n"
    "قواعد مهمة:\n"
    "- تحدث دائماً بالعربية باسلوب ودي ومهني\n"
    "- لا تخترع معلومات - استخدم الادوات للحصول على البيانات الحقيقية\n"
    "- اذا لم تعرف الاجابة قل ذلك وانصح العميل بالتواصل المباشر\n"
    "- رمز التتبع يبدا بـ PT- متبوعاً بالتاريخ ثم احرف عشوائية مثل PT-240101-ABCD1234\n"
    "- اوقات العمل: الاحد - الخميس 8 صباحاً - 7 مساءً بتوقيت القدس\n"
    "- للتواصل المباشر يمكن للعميل استخدام نموذج الارسال في البوابة"
)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"
GROQ_MAX_HISTORY = 6   # آخر N رسائل فقط للتوفير في الـ tokens
GROQ_MAX_TOKENS  = 512


# ── Groq API Helper ───────────────────────────────────────────────────────────

def _call_groq(api_key: str, messages: list) -> dict:
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "tools": TOOLS,
        "tool_choice": "auto",
        "max_tokens": GROQ_MAX_TOKENS,
        "temperature": 0.7,
    }

    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req  = urllib.request.Request(
        GROQ_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "python-httpx/0.27.0",
        },
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ── Endpoint الرئيسي ──────────────────────────────────────────────────────────

@csrf_exempt
@require_POST
def api_portal_chat(request):
    """POST /api/portal/chat/ — شات بوت البوابة مع Groq llama"""
    api_key = getattr(settings, "GROQ_API_KEY", "").strip()
    if not api_key:
        return JsonResponse(
            {"error": "GROQ_API_KEY غير مضبوط. أضفه في ملف .env"},
            status=503
        )

    try:
        body    = json.loads(request.body)
        history = body.get("messages", [])
    except Exception:
        return JsonResponse({"error": "بيانات غير صالحة"}, status=400)

    if not history:
        return JsonResponse({"error": "لا توجد رسائل"}, status=400)

    def stream_response():
        # بناء قائمة الرسائل — آخر N رسائل فقط لتوفير الـ tokens
        trimmed = history[-GROQ_MAX_HISTORY:] if len(history) > GROQ_MAX_HISTORY else history
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in trimmed:
            role    = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, str):
                messages.append({"role": role, "content": content})

        for _ in range(6):
            try:
                result  = _call_groq(api_key, messages)
                choice  = result.get("choices", [{}])[0]
                message = choice.get("message", {})
                reason  = choice.get("finish_reason", "stop")

                tool_calls = message.get("tool_calls") or []
                text       = (message.get("content") or "").strip()

                # أرسل النص إن وجد
                if text:
                    yield f"data: {json.dumps({'type': 'text', 'text': text}, ensure_ascii=False)}\n\n"

                if tool_calls:
                    # أضف رد المساعد للمحادثة
                    messages.append({
                        "role":       "assistant",
                        "content":    text or None,
                        "tool_calls": tool_calls,
                    })

                    # نفّذ كل أداة
                    for tc in tool_calls:
                        fn   = tc.get("function", {})
                        name = fn.get("name", "")
                        try:
                            args = json.loads(fn.get("arguments", "{}"))
                        except Exception:
                            args = {}

                        yield f"data: {json.dumps({'type': 'tool', 'name': name}, ensure_ascii=False)}\n\n"

                        tool_result = execute_tool(name, args)

                        messages.append({
                            "role":         "tool",
                            "tool_call_id": tc.get("id", ""),
                            "content":      tool_result,
                        })

                    continue

                # انتهى الرد
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8") if e.fp else str(e)
                try:
                    err_msg = json.loads(err_body).get("error", {}).get("message", err_body)
                except Exception:
                    err_msg = err_body
                yield f"data: {json.dumps({'type': 'text', 'text': f'عذراً، حدث خطأ: {err_msg}'}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return
            except Exception as exc:
                yield f"data: {json.dumps({'type': 'text', 'text': f'عذراً، حدث خطأ: {exc}'}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    response = StreamingHttpResponse(
        stream_response(),
        content_type="text/event-stream"
    )
    response["Cache-Control"]     = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
