"""
support.py — الدعم الفني
POST /api/support/ ← يُرسل بريد إلكتروني لفريق الدعم
"""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

SUPPORT_EMAIL = 'abdullafaraj57@gmail.com'


@csrf_exempt
def api_support(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)

    name    = data.get('name', '').strip() or 'زائر'
    email   = data.get('email', '').strip()
    subject = data.get('subject', '').strip() or 'طلب دعم فني'
    message = data.get('message', '').strip()

    if not message:
        return JsonResponse({'success': False, 'message': 'يرجى كتابة رسالتك'})

    # معلومات المستخدم المسجّل
    user = request.user
    if user and user.is_authenticated:
        name  = f'{user.first_name} {user.last_name}'.strip() or user.username
        email = email or user.email

    body = f"""
رسالة دعم فني جديدة من نظام انترناشونال
{'='*50}

الاسم:     {name}
البريد:    {email or 'غير محدد'}
الموضوع:   {subject}

الرسالة:
{message}

{'='*50}
الوقت: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    from ..email_utils import send_email
    ok, err = send_email(
        to=SUPPORT_EMAIL,
        subject=f'[Support] {subject}',
        text=body,
    )
    if ok:
        return JsonResponse({'success': True, 'message': 'تم إرسال رسالتك بنجاح، سنتواصل معك قريباً'})
    return JsonResponse({'success': False, 'message': f'تعذّر الإرسال: {err}'}, status=500)
