"""
routing.py — مسارات WebSocket
"""
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/intl/$', consumers.IntlConsumer.as_asgi()),
]
