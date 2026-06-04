"""
email_utils.py — إرسال البريد الإلكتروني عبر Resend HTTP API
يُستخدم بدلاً من SMTP لأن Railway يحظر منافذ SMTP الصادرة.
"""
import os
import logging
import requests
from django.conf import settings

log = logging.getLogger('intl.email')

RESEND_API_URL = 'https://api.resend.com/emails'


def send_email(to, subject, text, html=None):
    """
    يرسل بريداً إلكترونياً عبر Resend API.
    يُرجع (success: bool, error: str|None)
    """
    api_key = os.environ.get('RESEND_API_KEY', '')
    from_email = os.environ.get('RESEND_FROM', 'onboarding@resend.dev')

    if not api_key:
        log.error('RESEND_API_KEY غير مُعرّف')
        return False, 'إعدادات البريد غير مكتملة على الخادم'

    payload = {
        'from':    from_email,
        'to':      [to] if isinstance(to, str) else to,
        'subject': subject,
        'text':    text,
    }
    if html:
        payload['html'] = html

    try:
        resp = requests.post(
            RESEND_API_URL,
            json=payload,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type':  'application/json',
            },
            timeout=20,
        )
        if resp.status_code in (200, 201):
            log.info('EMAIL_SENT to=%s subject=%s', to, subject)
            return True, None
        else:
            log.error('EMAIL_FAILED status=%s body=%s', resp.status_code, resp.text[:300])
            # استخرج رسالة Resend التفصيلية
            try:
                detail = resp.json().get('message', resp.text[:200])
            except Exception:
                detail = resp.text[:200]
            return False, f'(رمز {resp.status_code}) {detail}'
    except Exception as e:
        log.error('EMAIL_EXCEPTION: %s', e, exc_info=True)
        return False, str(e)
