from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0037_employeenote_excusedabsence'),
    ]

    operations = [
        migrations.CreateModel(
            name='WhatsAppMessage',
            fields=[
                ('id',           models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('msg_id',       models.CharField(db_index=True, max_length=200, unique=True, verbose_name='معرف الرسالة')),
                ('jid',          models.CharField(db_index=True, max_length=200, verbose_name='JID المجموعة/الشخص')),
                ('is_group',     models.BooleanField(default=False, verbose_name='من مجموعة')),
                ('group_name',   models.CharField(blank=True, max_length=300, verbose_name='اسم المجموعة')),
                ('sender_jid',   models.CharField(blank=True, max_length=200, verbose_name='JID المرسل')),
                ('sender_name',  models.CharField(blank=True, max_length=300, verbose_name='اسم المرسل')),
                ('text',         models.TextField(verbose_name='نص الرسالة')),
                ('wa_timestamp', models.BigIntegerField(db_index=True, default=0, verbose_name='توقيت واتساب (unix)')),
                ('received_at',  models.DateTimeField(db_index=True, default=django.utils.timezone.now, verbose_name='وقت الاستقبال')),
                ('msg_type',     models.CharField(choices=[('hawala', 'حوالة'), ('chat', 'محادثة'), ('ignore', 'مُهمَل')],
                                                  db_index=True, default='chat', max_length=10, verbose_name='نوع الرسالة')),
                ('score',        models.SmallIntegerField(default=0, verbose_name='نقاط التصنيف')),
            ],
            options={
                'verbose_name':        'رسالة واتساب',
                'verbose_name_plural': 'رسائل واتساب',
                'ordering':            ['-received_at'],
            },
        ),
        migrations.AddIndex(
            model_name='whatsappmessage',
            index=models.Index(fields=['jid', 'received_at'], name='wa_jid_time_idx'),
        ),
        migrations.AddIndex(
            model_name='whatsappmessage',
            index=models.Index(fields=['msg_type', 'received_at'], name='wa_type_time_idx'),
        ),
    ]
