import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0065_customer'),
    ]

    operations = [
        migrations.CreateModel(
            name='CenterLedger',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('center', models.CharField(db_index=True, max_length=200, verbose_name='المركز')),
                ('currency', models.CharField(db_index=True, max_length=8, verbose_name='العملة')),
                ('debit', models.DecimalField(decimal_places=4, default=0, max_digits=18, verbose_name='مدين (دخل)')),
                ('credit', models.DecimalField(decimal_places=4, default=0, max_digits=18, verbose_name='دائن (خرج)')),
                ('source', models.CharField(
                    choices=[
                        ('entry', 'قيد من-الى'), ('adv_entry', 'قيد متقدم'),
                        ('receipt', 'سند قبض'), ('payment', 'سند دفع'),
                        ('exchange', 'صرف عملات'), ('hawala', 'حوالة'),
                        ('opening', 'قيد افتتاحي'), ('manual', 'تسوية يدوية'),
                    ],
                    db_index=True, default='manual', max_length=12,
                )),
                ('source_id', models.PositiveIntegerField(blank=True, null=True, verbose_name='معرّف العملية المصدر')),
                ('ref_number', models.CharField(blank=True, default='', max_length=60, verbose_name='رقم المرجع')),
                ('note', models.CharField(blank=True, default='', max_length=255, verbose_name='ملاحظة')),
                ('created_by', models.CharField(blank=True, default='', max_length=120)),
                ('created_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
            ],
            options={
                'verbose_name': 'حركة مركز',
                'verbose_name_plural': 'حركات المراكز',
                'ordering': ['-created_at', '-id'],
            },
        ),
        migrations.AddIndex(
            model_name='centerledger',
            index=models.Index(fields=['center', 'currency'], name='pages_cente_center_idx'),
        ),
        migrations.AddIndex(
            model_name='centerledger',
            index=models.Index(fields=['source', 'source_id'], name='pages_cente_source_idx'),
        ),
    ]
