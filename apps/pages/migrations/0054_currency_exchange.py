from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0053_payment_voucher'),
    ]

    operations = [
        migrations.CreateModel(
            name='CurrencyExchange',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ref_number', models.CharField(blank=True, max_length=30, unique=True, verbose_name='رقم السند')),
                ('center1',    models.CharField(max_length=200, verbose_name='المركز الأول')),
                ('currency1',  models.CharField(default='USD', max_length=10, verbose_name='العملة الأولى')),
                ('amount1',    models.DecimalField(decimal_places=4, max_digits=14, verbose_name='المبلغ الأول')),
                ('notes',      models.TextField(blank=True, verbose_name='ملاحظات')),
                ('center2',    models.CharField(max_length=200, verbose_name='المركز الثاني')),
                ('currency2',  models.CharField(default='EUR', max_length=10, verbose_name='العملة الثانية')),
                ('amount2',    models.DecimalField(decimal_places=4, max_digits=14, verbose_name='المبلغ الثاني')),
                ('entry_date', models.DateField(verbose_name='تاريخ التبديل')),
                ('created_by', models.CharField(blank=True, max_length=150)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={'verbose_name': 'تبديل عملة', 'ordering': ['-created_at']},
        ),
    ]
