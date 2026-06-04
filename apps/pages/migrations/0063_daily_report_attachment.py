import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models

import apps.pages.models


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0062_daily_report_e01'),
    ]

    operations = [
        migrations.CreateModel(
            name='DailyReportAttachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to=apps.pages.models._report_upload_path, verbose_name='الملف')),
                ('kind', models.CharField(
                    choices=[('images', 'صورة'), ('videos', 'فيديو'), ('files', 'ملف')],
                    default='files', max_length=10, verbose_name='النوع',
                )),
                ('name', models.CharField(blank=True, max_length=255, verbose_name='اسم الملف')),
                ('size', models.PositiveIntegerField(default=0, verbose_name='الحجم')),
                ('uploaded_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('report', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='attachments',
                    to='pages.dailyreport',
                    verbose_name='التقرير',
                )),
            ],
            options={
                'verbose_name': 'مرفق تقرير',
                'verbose_name_plural': 'مرفقات التقارير',
            },
        ),
    ]
