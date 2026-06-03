from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0049_add_accounts_permission'),
    ]

    operations = [
        migrations.CreateModel(
            name='EntryFromTo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ref_number',       models.CharField(blank=True, max_length=30, unique=True, verbose_name='رقم المرجع')),
                ('from_center',      models.CharField(max_length=200, verbose_name='المركز المرسل')),
                ('from_currency',    models.CharField(default='USD', max_length=10, verbose_name='عملة الإرسال')),
                ('from_amount',      models.DecimalField(decimal_places=4, max_digits=14, verbose_name='مبلغ الإرسال')),
                ('from_fee',         models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='أجور تصدير')),
                ('from_beneficiary', models.CharField(blank=True, max_length=200, verbose_name='المستفيد')),
                ('from_notes',       models.TextField(blank=True, verbose_name='ملاحظات الإرسال')),
                ('cut_rate',         models.DecimalField(decimal_places=6, default=1, max_digits=14, verbose_name='سعر القص')),
                ('cut_dir',          models.CharField(choices=[('mul', '× ضرب'), ('div', '÷ قسمة')], default='mul', max_length=3, verbose_name='اتجاه القص')),
                ('to_center',        models.CharField(max_length=200, verbose_name='المركز المستلم')),
                ('to_currency',      models.CharField(default='USD', max_length=10, verbose_name='عملة الاستلام')),
                ('to_amount',        models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='مبلغ الاستلام')),
                ('to_fee',           models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='أجور تسليم')),
                ('to_notes',         models.TextField(blank=True, verbose_name='ملاحظات الاستلام')),
                ('cut_diff',         models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='فرق القص')),
                ('net_profit',       models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='صافي الربح')),
                ('created_by',       models.CharField(blank=True, max_length=150)),
                ('created_at',       models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                'verbose_name': 'قيد جديد',
                'ordering': ['-created_at'],
            },
        ),
    ]
