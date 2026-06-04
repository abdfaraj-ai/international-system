"""
support.py — الدعم الفني
POST /api/support/ ← يُرسل بريد إلكتروني لفريق الدعم
"""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.conf import settings

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

    from_email = getattr(settings, 'EMAIL_HOST_USER', '') or getattr(settings, 'DEFAULT_FROM_EMAIL', '')

    # تحقق من إعدادات الإيميل
    if not from_email or not getattr(settings, 'EMAIL_HOST_PASSWORD', ''):
        import logging
        logging.getLogger(__name__).error(
            'Support email NOT configured: EMAIL_HOST_USER=%r has_password=%s',
            getattr(settings, 'EMAIL_HOST_USER', ''),
            bool(getattr(settings, 'EMAIL_HOST_PASSWORD', '')),
        )
        return JsonResponse({
            'success': False,
            'message': 'إعدادات البريد غير مكتملة على الخادم — يرجى التواصل مع المشرف'
        }, status=500)

    try:
        send_mail(
            subject=f'[Support] {subject}',
            message=body,
            from_email=from_email,
            recipient_list=[SUPPORT_EMAIL],
            fail_silently=False,
        )
        return JsonResponse({'success': True, 'message': 'تم إرسال رسالتك بنجاح، سنتواصل معك قريباً'})
    except Exception as e:
        import logging
        logging.getLogger(__name__).error('Support email error: %s', e, exc_info=True)
        return JsonResponse({'success': False, 'message': f'تعذّر الإرسال: {str(e)}'})
