from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt
def health_check(request):
    return HttpResponse('ok', content_type='text/plain', status=200)


urlpatterns = [
    path('health/', health_check),
    path('admin/', admin.site.urls),
    path('', include('apps.pages.urls')),
] + static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0]) \
  + static(settings.MEDIA_URL,  document_root=settings.MEDIA_ROOT)
