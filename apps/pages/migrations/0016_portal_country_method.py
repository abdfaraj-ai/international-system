from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0015_portal_token'),
    ]

    operations = [
        migrations.CreateModel(
            name='PortalCountry',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug',       models.SlugField(max_length=10, unique=True, verbose_name='المعرّف')),
                ('name',       models.CharField(max_length=100, verbose_name='اسم الدولة')),
                ('flag',       models.CharField(default='🏳', max_length=10, verbose_name='العلم (Emoji)')),
                ('currency',   models.CharField(max_length=10, verbose_name='رمز العملة')),
                ('rate',       models.DecimalField(decimal_places=4, default=1, max_digits=14, verbose_name='سعر الصرف (مقابل USD)')),
                ('rate_note',  models.CharField(blank=True, max_length=200, verbose_name='ملاحظة السعر')),
                ('is_active',  models.BooleanField(default=True, verbose_name='نشطة')),
                ('order',      models.PositiveSmallIntegerField(default=0, verbose_name='الترتيب')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.CharField(blank=True, max_length=150, verbose_name='آخر تعديل بواسطة')),
            ],
            options={
                'verbose_name': 'دولة — البوابة',
                'verbose_name_plural': 'دول البوابة',
                'ordering': ['order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='PortalReceivingMethod',
            fields=[
                ('id',          models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('country',     models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='methods', to='pages.portalcountry', verbose_name='الدولة')),
                ('name',        models.CharField(max_length=100, verbose_name='اسم الطريقة')),
                ('bank',        models.CharField(blank=True, max_length=200, verbose_name='اسم البنك / الجهة')),
                ('iban',        models.CharField(blank=True, max_length=200, verbose_name='رقم الحساب / IBAN')),
                ('beneficiary', models.CharField(blank=True, max_length=200, verbose_name='اسم المستفيد')),
                ('extra_label', models.CharField(blank=True, max_length=100, verbose_name='حقل إضافي (تسمية)')),
                ('extra_value', models.CharField(blank=True, max_length=200, verbose_name='حقل إضافي (قيمة)')),
                ('is_active',   models.BooleanField(default=True, verbose_name='نشطة')),
                ('order',       models.PositiveSmallIntegerField(default=0, verbose_name='الترتيب')),
            ],
            options={
                'verbose_name': 'طريقة استقبال — البوابة',
                'verbose_name_plural': 'طرق الاستقبال — البوابة',
                'ordering': ['order'],
            },
        ),
    ]
