from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0056_new_credit'),
    ]

    operations = [
        migrations.CreateModel(
            name='CostCenter',
            fields=[
                ('id',         models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name',       models.CharField(max_length=200, verbose_name='الاسم')),
                ('type',       models.CharField(choices=[('main', 'رئيسي'), ('branch', 'فرعي')], default='main', max_length=20)),
                ('status',     models.CharField(choices=[('active', 'نشط'), ('inactive', 'غير نشط')], default='active', max_length=20)),
                ('country',    models.CharField(blank=True, default='', max_length=100)),
                ('city',       models.CharField(blank=True, default='', max_length=100)),
                ('phone',      models.CharField(blank=True, default='', max_length=50)),
                ('doc_url',    models.URLField(blank=True, default='')),
                ('notes',      models.TextField(blank=True, default='')),
                ('dollar',     models.DecimalField(decimal_places=4, default=0, max_digits=18)),
                ('euro',       models.DecimalField(decimal_places=4, default=0, max_digits=18)),
                ('lira_tr',    models.DecimalField(decimal_places=4, default=0, max_digits=18)),
                ('lock',       models.BooleanField(default=False)),
                ('is_deleted', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'مركز تكلفة',
                'ordering': ['name'],
            },
        ),
    ]
