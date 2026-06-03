from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0054_currency_exchange'),
    ]

    operations = [
        migrations.CreateModel(
            name='OutgoingTransfer',
            fields=[
                ('id',                models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ref_number',        models.CharField(blank=True, max_length=30, unique=True, verbose_name='رقم الحركة')),
                ('source_center',     models.CharField(max_length=200, verbose_name='المصدر')),
                ('beneficiary_name',  models.CharField(max_length=200, verbose_name='اسم المستفيد')),
                ('beneficiary_phone', models.CharField(blank=True, max_length=50, verbose_name='هاتف المستفيد')),
                ('destination',       models.CharField(blank=True, max_length=200, verbose_name='الوجهة')),
                ('address',           models.CharField(blank=True, max_length=300, verbose_name='العنوان')),
                ('send_currency',     models.CharField(default='USD', max_length=10, verbose_name='عملة الإرسال')),
                ('send_amount',       models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='مبلغ الإرسال')),
                ('receive_currency',  models.CharField(default='USD', max_length=10, verbose_name='عملة التسليم')),
                ('receive_amount',    models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='مبلغ التسليم')),
                ('export_fee',        models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='أجور تصدير')),
                ('delivery_fee',      models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='أجور تسليم')),
                ('total',             models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='المجموع')),
                ('exchange_rate',     models.DecimalField(decimal_places=6, default=1, max_digits=14, verbose_name='سعر الصرف')),
                ('notes',             models.TextField(blank=True, verbose_name='ملاحظات')),
                ('entry_date',        models.DateField(verbose_name='تاريخ الحركة')),
                ('created_by',        models.CharField(blank=True, max_length=150)),
                ('created_at',        models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={'verbose_name': 'حركة صادرة', 'ordering': ['-created_at']},
        ),
    ]
