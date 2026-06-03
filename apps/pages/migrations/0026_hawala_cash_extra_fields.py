from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0025_float_to_decimal'),
    ]

    operations = [
        # ── HawalaOperation ──────────────────────────────────────────────────────
        migrations.AddField(
            model_name='hawalaoperation',
            name='fee',
            field=models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='العمولة'),
        ),
        migrations.AddField(
            model_name='hawalaoperation',
            name='direction',
            field=models.CharField(default='out', max_length=10, verbose_name='الاتجاه'),
        ),
        migrations.AddField(
            model_name='hawalaoperation',
            name='recv_method',
            field=models.CharField(blank=True, max_length=200, verbose_name='طريقة الاستلام'),
        ),
        migrations.AlterField(
            model_name='hawalaoperation',
            name='destination',
            field=models.CharField(blank=True, max_length=200, verbose_name='الوجهة / الدولة'),
        ),
        # ── CashTransaction ──────────────────────────────────────────────────────
        migrations.AddField(
            model_name='cashtransaction',
            name='fee',
            field=models.DecimalField(decimal_places=4, default=0, max_digits=14, verbose_name='العمولة'),
        ),
        migrations.AddField(
            model_name='cashtransaction',
            name='pay_type',
            field=models.CharField(default='cash', max_length=20, verbose_name='طريقة الدفع'),
        ),
        migrations.AddField(
            model_name='cashtransaction',
            name='exchange_rate',
            field=models.DecimalField(decimal_places=6, default=0, max_digits=14, verbose_name='سعر الصرف'),
        ),
        migrations.AddField(
            model_name='cashtransaction',
            name='ref_number',
            field=models.CharField(blank=True, max_length=100, verbose_name='رقم المرجع'),
        ),
        migrations.AddField(
            model_name='cashtransaction',
            name='platform',
            field=models.CharField(blank=True, max_length=100, verbose_name='المنصة'),
        ),
        migrations.AlterField(
            model_name='cashtransaction',
            name='transaction_type',
            field=models.CharField(
                choices=[('withdrawal', 'سحب'), ('deposit', 'إيداع'), ('electronic', 'إلكترونية')],
                max_length=20,
                verbose_name='النوع',
            ),
        ),
    ]
