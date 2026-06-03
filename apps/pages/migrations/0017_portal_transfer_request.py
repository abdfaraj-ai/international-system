from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0016_portal_country_method'),
    ]

    operations = [
        migrations.CreateModel(
            name='PortalTransferRequest',
            fields=[
                ('id',            models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('tracking_code', models.CharField(max_length=20, unique=True, verbose_name='رمز التتبع')),
                ('client_email',  models.EmailField(verbose_name='بريد العميل')),
                ('client_name',   models.CharField(blank=True, max_length=200, verbose_name='اسم العميل')),
                ('country',       models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='pages.portalcountry', verbose_name='الدولة')),
                ('country_name',  models.CharField(blank=True, max_length=100, verbose_name='اسم الدولة')),
                ('method_name',   models.CharField(blank=True, max_length=100, verbose_name='طريقة الاستقبال')),
                ('currency',      models.CharField(blank=True, max_length=10, verbose_name='العملة')),
                ('receipt',       models.ImageField(blank=True, null=True, upload_to='portal/receipts/%Y/%m/%d/', verbose_name='صورة الإيصال')),
                ('status',        models.CharField(choices=[('new','جديد'),('reviewing','قيد المراجعة'),('done','منفّذ'),('rejected','مرفوض')], default='new', max_length=12, verbose_name='الحالة')),
                ('notes',         models.TextField(blank=True, verbose_name='ملاحظات الموظف')),
                ('handled_by',    models.CharField(blank=True, max_length=150, verbose_name='معالَج بواسطة')),
                ('handled_at',    models.DateTimeField(blank=True, null=True, verbose_name='وقت المعالجة')),
                ('created_at',    models.DateTimeField(default=django.utils.timezone.now, verbose_name='وقت الإرسال')),
                ('ip_address',    models.GenericIPAddressField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'طلب حوالة — البوابة',
                'verbose_name_plural': 'طلبات الحوالة — البوابة',
                'ordering': ['-created_at'],
            },
        ),
    ]
