"""
ws_utils.py — دوال مساعدة لإرسال رسائل WebSocket من داخل Views العادية (sync)
"""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _send(group: str, payload: dict):
    try:
        layer = get_channel_layer()
        if layer is None:
            return
        async_to_sync(layer.group_send)(group, payload)
    except Exception:
        pass


def _user_group(username: str) -> str:
    safe = username.replace(' ', '_').replace('.', '_')
    return f'user_{safe}'


def broadcast_rates(rates: dict):
    _send('intl_rates', {'type': 'rates.update', 'rates': rates})


def broadcast_teller_request(request_data: dict):
    _send('intl_sv_requests', {'type': 'teller.request.new', 'request': request_data})


def broadcast_box_opened(username: str, payload: dict):
    """يُبلّغ التلر فوراً بأن المشرف فتح صندوقه وعيّن الرصيد الافتتاحي."""
    _send(_user_group(username), {'type': 'teller.box.opened', 'payload': payload})


def broadcast_teller_response(username: str, request_data: dict):
    """يُبلّغ التلر شخصياً برد المشرف على طلبه (approve/reject)."""
    _send(_user_group(username), {
        'type':    'teller.request.response',
        'request': request_data,
    })


def broadcast_portal_request(request_data: dict):
    _send('intl_portal_new', {'type': 'portal.request.new', 'request': request_data})


def broadcast_accounts_transfer(transfer_data: dict):
    """يُبلّغ موظف التحويل البنكي بحوالة بنكية جديدة."""
    _send('intl_accounts_new', {
        'type':     'accounts.transfer.new',
        'transfer': transfer_data,
    })


def notify_user(username: str, title: str, message: str, level: str = 'info'):
    """إشعار شخصي لمستخدم معين (يظهر كـ toast)."""
    _send(_user_group(username), {
        'type':    'notification',
        'level':   level,
        'title':   title,
        'message': message,
    })


def broadcast_task_event(event: str, data: dict):
    """يُبثّ حدث مهمة لمجموعة المدراء + المبرمج المعني."""
    _send('intl_tasks', {'type': 'task.event', 'event': event, 'data': data})


def broadcast_voice_result(result: dict):
    """يُبثّ نتيجة أمر صوتي لصفحة أقسام التلر."""
    _send('intl_voice', {'type': 'voice.result', 'result': result})


def broadcast_voice_rates(rates: dict):
    """يُبثّ أسعار الصرف المحدَّثة بالصوت لصفحات المشرفين."""
    _send('intl_sv_rates', {'type': 'voice.rates', 'rates': rates})
