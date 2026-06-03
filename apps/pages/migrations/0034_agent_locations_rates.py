from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0033_agent_portal_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='AgentLocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('country', models.CharField(max_length=100, verbose_name='البلد')),
                ('city', models.CharField(blank=True, max_length=100, verbose_name='المدينة / المنطقة')),
                ('is_primary', models.BooleanField(default=False, verbose_name='المنطقة الرئيسية')),
                ('notes', models.TextField(blank=True, verbose_name='ملاحظات')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('agent', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                            related_name='locations',
                                            to='pages.executionagent',
                                            verbose_name='الوكيل')),
            ],
            options={
                'verbose_name': 'منطقة عمل',
                'verbose_name_plural': 'مناطق العمل',
                'ordering': ['-is_primary', 'country', 'city'],
            },
        ),
        migrations.AddConstraint(
            model_name='agentlocation',
            constraint=models.UniqueConstraint(
                fields=['agent', 'country', 'city'],
                name='unique_agent_location',
            ),
        ),
        migrations.CreateModel(
            name='AgentTransferRate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('country', models.CharField(max_length=100, verbose_name='البلد')),
                ('currency', models.CharField(default='USD', max_length=10, verbose_name='العملة')),
                ('rate', models.DecimalField(decimal_places=6, default=1, max_digits=14, verbose_name='سعر الصرف (وحدة / USD)')),
                ('fee_flat', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='رسوم ثابتة')),
                ('fee_pct', models.DecimalField(decimal_places=3, default=0, max_digits=6, verbose_name='عمولة %')),
                ('min_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12, verbose_name='الحد الأدنى للحوالة')),
                ('max_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12, verbose_name='الحد الأقصى (0 = بلا حد)')),
                ('is_active', models.BooleanField(default=True, verbose_name='مفعّل')),
                ('notes', models.TextField(blank=True, verbose_name='ملاحظات')),
                ('updated_by', models.CharField(blank=True, max_length=150, verbose_name='آخر تعديل بواسطة')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('agent', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                            related_name='transfer_rates',
                                            to='pages.executionagent',
                                            verbose_name='الوكيل')),
            ],
            options={
                'verbose_name': 'سعر حوالة',
                'verbose_name_plural': 'أسعار الحوالات',
                'ordering': ['country', 'currency'],
            },
        ),
        migrations.AddConstraint(
            model_name='agenttransferrate',
            constraint=models.UniqueConstraint(
                fields=['agent', 'country', 'currency'],
                name='unique_agent_country_currency',
            ),
        ),
    ]
