"""
asgi.py — نقطة دخول ASGI للنظام (HTTP + WebSocket)
يُستخدم بدلاً من wsgi.py عند تشغيل النظام مع django-channels
"""
import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.prod')

# يجب استيراد Django أولاً قبل routing
django_asgi_app = get_asgi_application()

from apps.pages import routing  # noqa: E402 — بعد django setup

application = ProtocolTypeRouter({
    'http':      django_asgi_app,
    'websocket': AuthMiddlewareStack(
        URLRouter(routing.websocket_urlpatterns)
    ),
})
