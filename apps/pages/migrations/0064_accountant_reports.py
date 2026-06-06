from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone

import apps.pages.models


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0063_daily_report_attachment'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemuser',
            name='employee_type',
            field=models.CharField(
                choices=[('general', 'موظف عادي'), ('accountant', 'محاسب')],
                default='general', max_length=12, verbose_name='نوع الموظف',
            ),
        ),
        migrations.CreateModel(
            name='AccountantReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(default=django.utils.timezone.now, verbose_name='تاريخ التقرير')),
                ('notes', models.TextField(blank=True, verbose_name='ملاحظات')),
                ('status', models.CharField(
                    choices=[('pending', 'قيد المراجعة'), ('reviewed', 'تمت المراجعة'), ('rejected', 'مرفوض')],
                    default='pending', max_length=10, verbose_name='الحالة',
                )),
                ('manager_note', models.TextField(blank=True, verbose_name='ملاحظة المدير')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='وقت الإرسال')),
                ('reviewed_at', models.DateTimeField(blank=True, null=True, verbose_name='وقت المراجعة')),
                ('accountant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='accountant_reports', to=settings.AUTH_USER_MODEL,
                    verbose_name='المحاسب',
                )),
                ('reviewed_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='reviewed_acc_reports', to=settings.AUTH_USER_MODEL,
                    verbose_name='راجعه',
                )),
            ],
            options={
                'verbose_name': 'تقرير محاسب',
                'verbose_name_plural': 'تقارير المحاسبين',
                'ordering': ['-created_at'],
                'unique_together': {('accountant', 'date')},
            },
        ),
        migrations.CreateModel(
            name='SettlementGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, verbose_name='اسم المجموعة')),
                ('country', models.CharField(blank=True, max_length=80, verbose_name='الدولة')),
                ('movements', models.PositiveIntegerField(default=0, verbose_name='عدد الحركات')),
                ('day_date', models.DateField(default=django.utils.timezone.now, verbose_name='تاريخ اليوم')),
                ('report', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='groups', to='pages.accountantreport', verbose_name='التقرير',
                )),
            ],
            options={
                'verbose_name': 'مجموعة إرسال',
                'verbose_name_plural': 'مجموعات الإرسال',
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='AccountantReportAttachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to=apps.pages.models._acc_report_upload_path, verbose_name='الملف')),
                ('kind', models.CharField(
                    choices=[('images', 'صورة'), ('videos', 'فيديو'), ('files', 'ملف')],
                    default='files', max_length=10, verbose_name='النوع',
                )),
                ('name', models.CharField(blank=True, max_length=255, verbose_name='اسم الملف')),
                ('size', models.PositiveIntegerField(default=0, verbose_name='الحجم')),
                ('uploaded_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('report', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='attachments', to='pages.accountantreport', verbose_name='التقرير',
                )),
            ],
            options={
                'verbose_name': 'مرفق تقرير محاسب',
                'verbose_name_plural': 'مرفقات تقارير المحاسبين',
            },
        ),
    ]
