from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0061_password_reset_token'),
    ]

    operations = [
        migrations.AlterField(
            model_name='systemuser',
            name='role',
            field=models.CharField(
                choices=[
                    ('M01', 'الإدارة العامة'),
                    ('M02', 'مشرف التلر'),
                    ('M03', 'مشرف الحوالات'),
                    ('T01', 'أقسام التلر'),
                    ('T02', 'التحويل البنكي'),
                    ('T03', 'الحوالات الخارجية'),
                    ('IM01', 'مدير المبرمجين'),
                    ('P01', 'مبرمج'),
                    ('E01', 'موظف'),
                ],
                default='T01',
                max_length=4,
                verbose_name='الصلاحية',
            ),
        ),
        migrations.CreateModel(
            name='DailyReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(default=django.utils.timezone.now, verbose_name='تاريخ التقرير')),
                ('content', models.TextField(verbose_name='محتوى التقرير')),
                ('notes', models.TextField(blank=True, verbose_name='ملاحظات إضافية')),
                ('status', models.CharField(
                    choices=[('pending', 'قيد المراجعة'), ('reviewed', 'تمت المراجعة'), ('rejected', 'مرفوض')],
                    default='pending', max_length=10, verbose_name='الحالة',
                )),
                ('manager_note', models.TextField(blank=True, verbose_name='ملاحظة المدير')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='وقت الإرسال')),
                ('reviewed_at', models.DateTimeField(blank=True, null=True, verbose_name='وقت المراجعة')),
                ('employee', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='daily_reports',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='الموظف',
                )),
                ('reviewed_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='reviewed_reports',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='راجعه',
                )),
            ],
            options={
                'verbose_name': 'تقرير يومي',
                'verbose_name_plural': 'التقارير اليومية',
                'ordering': ['-created_at'],
                'unique_together': {('employee', 'date')},
            },
        ),
    ]
