from django.apps import AppConfig


class PagesConfig(AppConfig):
    name              = 'apps.pages'
    label             = 'pages'          # يحافظ على أسماء جداول DB والـ migrations
    default_auto_field = 'django.db.models.BigAutoField'
    verbose_name      = 'النظام الموحد'
