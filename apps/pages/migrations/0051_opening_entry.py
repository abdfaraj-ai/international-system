import datetime
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0050_entry_from_to'),
    ]

    operations = [
        migrations.CreateModel(
            name='OpeningEntry',
            fields=[
                ('id',          models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ref_number',  models.CharField(blank=True, max_length=30, unique=True, verbose_name='رقم القيد')),
                ('center_name', models.CharField(max_length=200, verbose_name='المركز / العميل')),
                ('currency',    models.CharField(default='USD', max_length=10, verbose_name='العملة')),
                ('amount',      models.DecimalField(decimal_places=4, max_digits=14, verbose_name='المبلغ')),
                ('entry_type',  models.CharField(choices=[('us','لنا'),('them','علينا')], default='us', max_length=5, verbose_name='النوع')),
                ('notes',       models.TextField(blank=True, verbose_name='ملاحظات')),
                ('entry_date',  models.DateField(verbose_name='تاريخ القيد')),
                ('created_by',  models.CharField(blank=True, max_length=150)),
                ('created_at',  models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={'verbose_name': 'قيد افتتاحي', 'ordering': ['-created_at']},
        ),
    ]
