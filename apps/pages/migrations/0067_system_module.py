import django.utils.timezone
from django.db import migrations, models


# الوحدات الأولية — أقسام النظام الحالية تُسجَّل كوحدات قابلة للتحكّم
INITIAL_MODULES = [
    {'key': 'hawala',     'name': 'الحوالات',          'description': 'نظام الحوالات الخارجية وتتبّع الوكلاء', 'icon': '🌍', 'color': '#16a34a', 'url': '/transactions/', 'roles': 'M03,T03',            'order': 1},
    {'key': 'teller',     'name': 'أقسام التلر',       'description': 'واجهة التلر للعمليات النقدية اليومية',  'icon': '💱', 'color': '#0891b2', 'url': '/teller/',       'roles': 'T01,M02',            'order': 2},
    {'key': 'bank',       'name': 'التحويل البنكي',     'description': 'العمليات المصرفية والحسابات الداخلية',  'icon': '🏦', 'color': '#7c3aed', 'url': '/accounts/',     'roles': 'T02',                'order': 3},
    {'key': 'attendance', 'name': 'الحضور والانصراف',   'description': 'متابعة حضور الموظفين وإحصائيات البصمة', 'icon': '🕐', 'color': '#d97706', 'url': '/attendance/',   'roles': 'M01',                'order': 4},
    {'key': 'accounting', 'name': 'المحاسبة',           'description': 'القيود والسندات والتسويات وكشوف الحساب', 'icon': '🧮', 'color': '#6366f1', 'url': '/accounting/',   'roles': 'M01,M02,M03,T02,T03', 'order': 5},
    {'key': 'wallet',     'name': 'المحفظة الرقمية',     'description': 'إدارة المحافظ الرقمية والأرصدة',        'icon': '👛', 'color': '#2563eb', 'url': '',               'roles': 'M01',                'order': 6},
]


def seed_modules(apps, schema_editor):
    SystemModule = apps.get_model('pages', 'SystemModule')
    for m in INITIAL_MODULES:
        SystemModule.objects.update_or_create(
            key=m['key'],
            defaults={k: v for k, v in m.items() if k != 'key'},
        )


def unseed_modules(apps, schema_editor):
    SystemModule = apps.get_model('pages', 'SystemModule')
    keys = [m['key'] for m in INITIAL_MODULES]
    SystemModule.objects.filter(key__in=keys).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0066_center_ledger'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemModule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.SlugField(max_length=40, unique=True, verbose_name='المعرّف')),
                ('name', models.CharField(max_length=100, verbose_name='اسم الوحدة')),
                ('description', models.CharField(blank=True, max_length=255, verbose_name='الوصف')),
                ('icon', models.CharField(default='📦', max_length=20, verbose_name='الأيقونة')),
                ('color', models.CharField(default='#2563eb', max_length=20, verbose_name='اللون')),
                ('url', models.CharField(blank=True, max_length=200, verbose_name='الرابط')),
                ('roles', models.CharField(blank=True, help_text='أكواد الأدوار مفصولة بفواصل، مثل: M03,T03', max_length=200, verbose_name='الأدوار المسموحة')),
                ('is_enabled', models.BooleanField(default=True, verbose_name='مفعّلة')),
                ('order', models.PositiveIntegerField(default=0, verbose_name='الترتيب')),
                ('settings', models.JSONField(blank=True, default=dict, verbose_name='إعدادات الوحدة')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'وحدة النظام',
                'verbose_name_plural': 'وحدات النظام (البرامج)',
                'ordering': ['order', 'name'],
            },
        ),
        migrations.RunPython(seed_modules, unseed_modules),
    ]
