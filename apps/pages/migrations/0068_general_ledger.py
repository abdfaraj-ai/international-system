import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


# دليل حسابات أساسي معياري (code, name, type, parent_code, is_group)
_COA = [
    ('1',  'الأصول',                    'asset',     None, True),
    ('11', 'النقدية والصناديق',          'asset',     '1',  True),
    ('12', 'ذمم مدينة (مراكز وعملاء)',    'asset',     '1',  True),
    ('2',  'الخصوم',                     'liability', None, True),
    ('21', 'ذمم دائنة (مراكز وعملاء)',    'liability', '2',  True),
    ('3',  'حقوق الملكية',               'equity',    None, True),
    ('31', 'رأس المال',                  'equity',    '3',  False),
    ('32', 'الأرباح المحتجزة',           'equity',    '3',  False),
    ('4',  'الإيرادات',                  'revenue',   None, True),
    ('41', 'أرباح الصرافة',              'revenue',   '4',  False),
    ('42', 'عمولات وأجور الحوالات',      'revenue',   '4',  False),
    ('5',  'المصروفات',                  'expense',   None, True),
    ('51', 'مصروفات تشغيلية',            'expense',   '5',  False),
    ('52', 'فروقات عملة',                'expense',   '5',  False),
]


def seed_coa(apps, schema_editor):
    Account = apps.get_model('pages', 'Account')
    created = {}
    for code, name, typ, parent_code, is_group in _COA:
        parent = created.get(parent_code) if parent_code else None
        obj, _ = Account.objects.update_or_create(
            code=code,
            defaults={'name': name, 'type': typ, 'parent': parent, 'is_group': is_group},
        )
        created[code] = obj


def unseed_coa(apps, schema_editor):
    Account = apps.get_model('pages', 'Account')
    Account.objects.filter(code__in=[r[0] for r in _COA]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('pages', '0067_system_module'),
    ]

    operations = [
        migrations.CreateModel(
            name='Account',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=20, unique=True, verbose_name='رقم الحساب')),
                ('name', models.CharField(max_length=200, verbose_name='اسم الحساب')),
                ('type', models.CharField(choices=[('asset', 'أصول'), ('liability', 'خصوم'), ('equity', 'حقوق ملكية'), ('revenue', 'إيرادات'), ('expense', 'مصروفات')], max_length=15, verbose_name='النوع')),
                ('currency', models.CharField(default='USD', max_length=10, verbose_name='العملة')),
                ('is_group', models.BooleanField(default=False, verbose_name='حساب رئيسي (مجموعة)')),
                ('is_active', models.BooleanField(default=True, verbose_name='نشط')),
                ('notes', models.TextField(blank=True, verbose_name='ملاحظات')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='children', to='pages.account', verbose_name='الحساب الأب')),
            ],
            options={'verbose_name': 'حساب', 'verbose_name_plural': 'دليل الحسابات', 'ordering': ['code']},
        ),
        migrations.CreateModel(
            name='GLTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ref_number', models.CharField(max_length=40, unique=True, verbose_name='رقم القيد')),
                ('date', models.DateField(default=django.utils.timezone.now, verbose_name='التاريخ')),
                ('description', models.CharField(blank=True, max_length=300, verbose_name='البيان')),
                ('source', models.CharField(default='manual', max_length=40, verbose_name='المصدر')),
                ('source_id', models.IntegerField(blank=True, null=True, verbose_name='معرّف المصدر')),
                ('is_posted', models.BooleanField(default=True, verbose_name='مُرحَّل')),
                ('created_by', models.CharField(blank=True, max_length=150, verbose_name='بواسطة')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={'verbose_name': 'قيد دفتر الأستاذ', 'verbose_name_plural': 'دفتر الأستاذ العام', 'ordering': ['-date', '-id']},
        ),
        migrations.CreateModel(
            name='GLLine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('currency', models.CharField(default='USD', max_length=10, verbose_name='العملة')),
                ('debit', models.DecimalField(decimal_places=4, default=0, max_digits=18, verbose_name='مدين')),
                ('credit', models.DecimalField(decimal_places=4, default=0, max_digits=18, verbose_name='دائن')),
                ('center', models.CharField(blank=True, max_length=200, verbose_name='المركز')),
                ('note', models.CharField(blank=True, max_length=300, verbose_name='ملاحظة')),
                ('account', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='lines', to='pages.account', verbose_name='الحساب')),
                ('transaction', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lines', to='pages.gltransaction', verbose_name='القيد')),
            ],
            options={'verbose_name': 'سطر قيد', 'verbose_name_plural': 'سطور القيود'},
        ),
        migrations.AddIndex(
            model_name='gltransaction',
            index=models.Index(fields=['source', 'source_id'], name='gl_source_idx'),
        ),
        migrations.AddIndex(
            model_name='gltransaction',
            index=models.Index(fields=['date'], name='gl_date_idx'),
        ),
        migrations.AddIndex(
            model_name='glline',
            index=models.Index(fields=['account', 'currency'], name='gl_line_acc_cur_idx'),
        ),
        migrations.RunPython(seed_coa, unseed_coa),
    ]
