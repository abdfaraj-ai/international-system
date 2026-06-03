"""
SMS Utility — إرسال رسائل SMS لتلرات النظام
=============================================
قابل للتوصيل: غيّر PROVIDER في settings.py أو هنا لتفعيل مزود حقيقي.

PROVIDER = 'none'     ← بدون إرسال (الوضع الافتراضي)
PROVIDER = 'twilio'   ← Twilio
PROVIDER = 'unifonic' ← Unifonic (الخليج العربي)
PROVIDER = 'vonage'   ← Vonage
"""

from django.conf import settings


def send_teller_credentials(phone: str, name: str, username: str, password: str, site_url: str = '') -> dict:
    """
    يُرسل بيانات الدخول للتلر عبر SMS.
    يُعيد: {'sent': bool, 'provider': str, 'error': str|None}
    """
    if not phone:
        return {'sent': False, 'provider': 'none', 'error': 'لا يوجد رقم هاتف'}

    provider = getattr(settings, 'SMS_PROVIDER', 'none').lower()
    message  = _build_message(name, username, password, site_url)

    if provider == 'twilio':
        return _send_twilio(phone, message)
    elif provider == 'unifonic':
        return _send_unifonic(phone, message)
    elif provider == 'vonage':
        return _send_vonage(phone, message)
    else:
        # وضع التطوير — طباعة فقط
        print(f'[SMS-STUB] إلى {phone}:\n{message}')
        return {'sent': False, 'provider': 'none', 'error': 'SMS غير مفعّل — راجع SMS_PROVIDER في settings.py'}


def _build_message(name, username, password, site_url):
    lines = [
        f'مرحباً {name}،',
        f'تم إنشاء حسابك في نظام انترناشونال.',
        f'اسم المستخدم: {username}',
        f'كلمة المرور: {password}',
    ]
    if site_url:
        lines.append(f'الرابط: {site_url}')
    lines.append('يُرجى تغيير كلمة المرور بعد أول تسجيل دخول.')
    return '\n'.join(lines)


def _send_twilio(phone, message):
    try:
        from twilio.rest import Client
        account_sid = settings.TWILIO_ACCOUNT_SID
        auth_token  = settings.TWILIO_AUTH_TOKEN
        from_number = settings.TWILIO_FROM_NUMBER
        client = Client(account_sid, auth_token)
        client.messages.create(body=message, from_=from_number, to=phone)
        return {'sent': True, 'provider': 'twilio', 'error': None}
    except ImportError:
        return {'sent': False, 'provider': 'twilio', 'error': 'مكتبة twilio غير مثبّتة — pip install twilio'}
    except Exception as e:
        return {'sent': False, 'provider': 'twilio', 'error': str(e)}


def _send_unifonic(phone, message):
    try:
        import requests
        resp = requests.post('https://el.cloud.unifonic.com/rest/SMS/messages', data={
            'AppSid':      settings.UNIFONIC_APP_SID,
            'SenderID':    getattr(settings, 'UNIFONIC_SENDER_ID', 'International'),
            'Body':        message,
            'Recipient':   phone,
            'responseType': 'JSON',
        }, timeout=10)
        data = resp.json()
        if data.get('Success'):
            return {'sent': True, 'provider': 'unifonic', 'error': None}
        return {'sent': False, 'provider': 'unifonic', 'error': data.get('Message', 'خطأ غير معروف')}
    except Exception as e:
        return {'sent': False, 'provider': 'unifonic', 'error': str(e)}


def _send_vonage(phone, message):
    try:
        import vonage
        client  = vonage.Client(key=settings.VONAGE_API_KEY, secret=settings.VONAGE_API_SECRET)
        sms     = vonage.Sms(client)
        sender  = getattr(settings, 'VONAGE_FROM', 'International')
        resp    = sms.send_message({'from': sender, 'to': phone, 'text': message})
        if resp['messages'][0]['status'] == '0':
            return {'sent': True, 'provider': 'vonage', 'error': None}
        return {'sent': False, 'provider': 'vonage', 'error': resp['messages'][0].get('error-text')}
    except Exception as e:
        return {'sent': False, 'provider': 'vonage', 'error': str(e)}
