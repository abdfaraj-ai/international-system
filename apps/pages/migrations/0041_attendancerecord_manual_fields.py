from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0040_whatsappmessage_receipt_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendancerecord',
            name='is_manual',
            field=models.BooleanField(default=False, verbose_name='بصمة يدوية'),
        ),
        migrations.AddField(
            model_name='attendancerecord',
            name='manual_reason',
            field=models.CharField(blank=True, max_length=255, verbose_name='سبب البصمة اليدوية'),
        ),
        migrations.AddField(
            model_name='attendancerecord',
            name='added_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='manual_punches',
                to=settings.AUTH_USER_MODEL,
                verbose_name='أضيفت بواسطة',
            ),
        ),
    ]
