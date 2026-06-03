from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0055_outgoing_transfer'),
    ]

    operations = [
        migrations.CreateModel(
            name='NewCredit',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ref_number', models.CharField(blank=True, max_length=30, unique=True, verbose_name='رقم الاعتماد')),
                ('company',    models.CharField(max_length=300, verbose_name='الشركة')),
                ('source',     models.CharField(max_length=200, verbose_name='المصدر')),
                ('currency',   models.CharField(default='USD', max_length=10, verbose_name='العملة')),
                ('amount',     models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='المبلغ')),
                ('safe',       models.CharField(max_length=200, verbose_name='الصندوق')),
                ('notes',      models.TextField(blank=True, verbose_name='ملاحظات')),
                ('fees',       models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='الأجور')),
                ('entry_date', models.DateField(verbose_name='تاريخ الاعتماد')),
                ('created_by', models.CharField(blank=True, max_length=150)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={'verbose_name': 'اعتماد جديد', 'ordering': ['-created_at']},
        ),
    ]
