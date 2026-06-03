from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0032_zkdevice_zkemployee_attendancerecord'),
    ]

    operations = [
        migrations.AddField(
            model_name='executionagent',
            name='email',
            field=models.EmailField(blank=True, verbose_name='البريد الإلكتروني'),
        ),
        migrations.AddField(
            model_name='executionagent',
            name='country',
            field=models.CharField(blank=True, max_length=100, verbose_name='البلد'),
        ),
        migrations.AddField(
            model_name='executionagent',
            name='pin_hash',
            field=models.CharField(blank=True, max_length=128, verbose_name='رمز PIN'),
        ),
        migrations.AddField(
            model_name='executionagent',
            name='portal_active',
            field=models.BooleanField(default=False, verbose_name='بوابة مفعّلة'),
        ),
        migrations.AddField(
            model_name='executionagent',
            name='last_seen',
            field=models.DateTimeField(blank=True, null=True, verbose_name='آخر ظهور'),
        ),
    ]
