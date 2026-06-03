"""
consumers.py — WebSocket Consumer الموحد لنظام انترناشونال

المجموعات (Channel Groups):
    intl_rates          ← المشرف يُرسل، التلرات تستقبل
    intl_sv_requests    ← التلرات تُرسل، المشرف يستقبل
    intl_sv_status      ← التلرات تُرسل حالة الاتصال، المشرف يستقبل
    intl_portal_new     ← بوابة العملاء تُرسل، T03/M03 يستقبلون
    intl_accounts_new   ← التلرات تُرسل حوالة، M04 يستقبل
    intl_transactions   ← أحداث الحوالات (تأكيد وكيل، إتمام) لـ T03/M03
    intl_tasks          ← أحداث المهام للمدراء
    user_{username}     ← إشعارات شخصية لكل مستخدم
"""
import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer

_PING_INTERVAL = 30   # ثانية — يُرسل ping للعميل
_PONG_TIMEOUT  = 15   # ثانية — إذا لم يرد يُغلق الاتصال


# ── مساعدات ───────────────────────────────────────────────────────────────────

def _get_role(user) -> str:
    if not user or not user.is_authenticated:
        return ''
    return getattr(user, 'role', '') or ''


def _user_group(username: str) -> str:
    safe = username.replace(' ', '_').replace('.', '_')
    return f'user_{safe}'


# ── المجموعات لكل دور ─────────────────────────────────────────────────────────

def _groups_for_role(role: str, username: str) -> list[str]:
    personal = _user_group(username)
    if role == 'T01':
        return ['intl_rates', 'intl_voice', personal]
    elif role == 'M02':
        return ['intl_sv_requests', 'intl_sv_status', 'intl_sv_rates', personal]
    elif role == 'T02':
        return ['intl_accounts_new', personal]
    elif role == 'T03':
        return ['intl_portal_new', 'intl_transactions', personal]
    elif role == 'M03':
        return ['intl_portal_new', 'intl_transactions', 'intl_sv_rates', personal]
    elif role == 'M01':
        return ['intl_portal_new', 'intl_accounts_new', 'intl_tasks', 'intl_transactions', 'intl_sv_rates', personal]
    elif role == 'IM01':
        return ['intl_tasks', personal]
    elif role == 'P01':
        return ['intl_tasks', personal]
    return [personal]


# ── Consumer الرئيسي ──────────────────────────────────────────────────────────

class IntlConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope.get('user')
        role = _get_role(user)

        if not role:
            await self.close(code=4001)
            return

        self._groups   = _groups_for_role(role, user.username)
        self._role     = role
        self._username = user.username

        for g in self._groups:
            await self.channel_layer.group_add(g, self.channel_name)

        await self.accept()

        self._pong_received = True
        self._heartbeat_task = asyncio.ensure_future(self._heartbeat())

        if role == 'T01':
            await self.channel_layer.group_send('intl_sv_status', {
                'type':     'teller.status',
                'username': user.username,
                'online':   True,
            })

    async def disconnect(self, close_code):
        task = getattr(self, '_heartbeat_task', None)
        if task:
            task.cancel()
        for g in getattr(self, '_groups', []):
            await self.channel_layer.group_discard(g, self.channel_name)

        if getattr(self, '_role', '') == 'T01':
            await self.channel_layer.group_send('intl_sv_status', {
                'type':     'teller.status',
                'username': getattr(self, '_username', ''),
                'online':   False,
            })

    async def _heartbeat(self):
        """يُرسل ping كل 30 ث — يُغلق الاتصال إذا لم يصل pong خلال 15 ث."""
        try:
            while True:
                await asyncio.sleep(_PING_INTERVAL)
                self._pong_received = False
                await self.send(json.dumps({'type': 'ping'}))
                await asyncio.sleep(_PONG_TIMEOUT)
                if not self._pong_received:
                    await self.close(code=4000)
                    return
        except (asyncio.CancelledError, Exception):
            pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (ValueError, TypeError):
            return
        if data.get('type') == 'pong':
            self._pong_received = True
        elif data.get('type') == 'ping':
            await self.send(json.dumps({'type': 'pong'}))

    # ── معالجات الرسائل الواردة من المجموعات ──────────────────────────────────

    async def rates_update(self, event):
        await self.send(json.dumps({'type': 'rates_update', 'rates': event['rates']}))

    async def teller_request_new(self, event):
        await self.send(json.dumps({'type': 'teller_request_new', 'request': event['request']}))

    async def teller_request_response(self, event):
        """رد المشرف على طلب التلر (approve/reject) — يصل للتلر شخصياً."""
        await self.send(json.dumps({
            'type':    'teller_request_response',
            'request': event['request'],
        }))

    async def teller_box_opened(self, event):
        """المشرف فتح الصندوق وعيّن الرصيد — يصل للتلر شخصياً فوراً."""
        await self.send(json.dumps({
            'type':    'teller_box_opened',
            'payload': event.get('payload', {}),
        }))

    async def portal_request_new(self, event):
        await self.send(json.dumps({'type': 'portal_request_new', 'request': event['request']}))

    async def accounts_transfer_new(self, event):
        """حوالة بنكية جديدة — يصل لموظف التحويل البنكي."""
        await self.send(json.dumps({
            'type':     'accounts_transfer_new',
            'transfer': event['transfer'],
        }))

    async def teller_status(self, event):
        await self.send(json.dumps({
            'type':     'teller_status',
            'username': event['username'],
            'online':   event['online'],
        }))

    async def notification(self, event):
        """إشعار عام شخصي — يُستخدم لأي رسالة موجّهة لمستخدم بعينه."""
        await self.send(json.dumps({
            'type':    'notification',
            'level':   event.get('level', 'info'),
            'title':   event.get('title', ''),
            'message': event.get('message', ''),
        }))

    async def task_event(self, event):
        """حدث مهمة — يصل للمدير وللمبرمج المعني."""
        await self.send(json.dumps({
            'type':  'task_event',
            'event': event.get('event'),
            'data':  event.get('data'),
        }))

    async def voice_result(self, event):
        """نتيجة أمر صوتي — تصل لصفحة أقسام التلر فقط (T01)."""
        await self.send(json.dumps({
            'type':   'voice_result',
            'result': event.get('result', {}),
        }))

    async def voice_rates(self, event):
        """أسعار صرف محدَّثة بالصوت — تصل لصفحات مشرف التلر ومشرف الحوالات."""
        await self.send(json.dumps({
            'type':  'voice_rates',
            'rates': event.get('rates', {}),
        }))

    async def agent_confirmed(self, event):
        """الوكيل أكّد تنفيذ الحوالة — يصل لـ T03/M03/M01 فوراً."""
        await self.send(json.dumps({
            'type':      'agent_confirmed',
            'ref':       event.get('ref'),
            'agentName': event.get('agentName'),
            'transfer':  event.get('transfer', {}),
            'receiptId': event.get('receiptId'),
        }))

    async def transfer_completed(self, event):
        """المشرف تحقق من الإيصال وأغلق الحوالة — يصل للجميع."""
        await self.send(json.dumps({
            'type':      'transfer_completed',
            'ref':       event.get('ref'),
            'agentName': event.get('agentName'),
            'deducted':  event.get('deducted'),
            'transfer':  event.get('transfer', {}),
        }))
