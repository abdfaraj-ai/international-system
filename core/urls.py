from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.static import serve as _serve


@csrf_exempt
def health_check(request):
    return HttpResponse('ok', content_type='text/plain', status=200)


urlpatterns = [
    path('health/', health_check),
    path('admin/', admin.site.urls),
    path('', include('apps.pages.urls')),
] + static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])

# ── خدمة ملفات الوسائط (المرفقات) — تعمل حتى مع DEBUG=False ──
# لأن static() لا يخدم الوسائط في الإنتاج، نضيف مساراً صريحاً
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', _serve, {'document_root': settings.MEDIA_ROOT}),
]
