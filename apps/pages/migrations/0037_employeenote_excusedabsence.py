from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0036_executionagent_whatsapp'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployeeNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('note_type', models.CharField(
                    choices=[('note', 'ملاحظة'), ('warning', 'تحذير'), ('praise', 'شكر وتقدير')],
                    default='note', max_length=10, verbose_name='نوع الملاحظة')),
                ('body', models.TextField(verbose_name='نص الملاحظة')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='تاريخ الإضافة')),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='employee_notes',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='أضافها')),
                ('employee', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notes',
                    to='pages.zkemployee',
                    verbose_name='الموظف')),
            ],
            options={
                'verbose_name': 'ملاحظة موظف',
                'verbose_name_plural': 'ملاحظات الموظفين',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ExcusedAbsence',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('absence_type', models.CharField(
                    choices=[
                        ('sick',      'إجازة مرضية'),
                        ('annual',    'إجازة سنوية'),
                        ('emergency', 'إجازة طارئة'),
                        ('unpaid',    'غياب بدون راتب'),
                        ('other',     'أخرى'),
                    ],
                    default='annual', max_length=15, verbose_name='نوع الغياب')),
                ('date_from', models.DateField(verbose_name='من تاريخ')),
                ('date_to', models.DateField(verbose_name='إلى تاريخ')),
                ('reason', models.TextField(blank=True, verbose_name='السبب')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='تاريخ التسجيل')),
                ('approved_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='approved_absences',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='اعتمدها')),
                ('employee', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='excused_absences',
                    to='pages.zkemployee',
                    verbose_name='الموظف')),
            ],
            options={
                'verbose_name': 'إذن غياب',
                'verbose_name_plural': 'أذونات الغياب',
                'ordering': ['-date_from'],
            },
        ),
    ]
