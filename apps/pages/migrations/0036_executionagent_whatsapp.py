from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0035_remove_default_agents'),
    ]

    operations = [
        migrations.AddField(
            model_name='executionagent',
            name='whatsapp_number',
            field=models.CharField(
                max_length=30, blank=True,
                verbose_name='رقم واتساب',
                help_text='الرقم الدولي بدون + مثال: 962791234567'
            ),
        ),
    ]
