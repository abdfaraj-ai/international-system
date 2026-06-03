"""
python manage.py setup_2fa <username>
يولّد مفتاح TOTP ويعرض QR code URL لمسحه بـ Google Authenticator
"""
import pyotp
import qrcode
import io
import os
from django.core.management.base import BaseCommand, CommandError
from apps.pages.models import SystemUser


class Command(BaseCommand):
    help = 'إعداد المصادقة الثنائية لمستخدم'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='اسم المستخدم')
        parser.add_argument('--disable', action='store_true', help='إلغاء تفعيل 2FA')

    def handle(self, *args, **options):
        username = options['username']

        try:
            user = SystemUser.objects.get(username=username)
        except SystemUser.DoesNotExist:
            raise CommandError(f'المستخدم "{username}" غير موجود')

        if options['disable']:
            user.totp_secret  = ''
            user.totp_enabled = False
            user.save(update_fields=['totp_secret', 'totp_enabled'])
            self.stdout.write(self.style.SUCCESS(f'✅ تم إلغاء 2FA للمستخدم: {username}'))
            return

        # توليد مفتاح جديد
        secret = pyotp.random_base32()
        totp   = pyotp.TOTP(secret)
        uri    = totp.provisioning_uri(name=username, issuer_name='انترناشونال')

        # حفظ في قاعدة البيانات مباشرة
        user.totp_secret  = secret
        user.totp_enabled = True
        user.save(update_fields=['totp_secret', 'totp_enabled'])

        # طباعة QR code في الـ Terminal (ASCII)
        qr = qrcode.QRCode(border=1)
        qr.add_data(uri)
        qr.make(fit=True)

        self.stdout.write('\n' + '='*60)
        self.stdout.write(f'  2FA مُفعَّل للمستخدم: {username}')
        self.stdout.write('='*60)
        self.stdout.write('\nامسح هذا الرمز بتطبيق Google Authenticator:\n')
        qr.print_ascii(out=self.stdout._out if hasattr(self.stdout, '_out') else None)

        # طباعة QR في الـ terminal
        import sys
        qr.print_ascii(out=sys.stdout)

        self.stdout.write(f'\nأو أدخل المفتاح يدوياً:')
        self.stdout.write(self.style.WARNING(f'  {secret}'))
        self.stdout.write(f'\nرابط الإعداد:')
        self.stdout.write(f'  {uri}')
        self.stdout.write('\n' + self.style.SUCCESS('✅ تم الحفظ — يمكنك تسجيل الدخول الآن باستخدام Google Authenticator'))
        self.stdout.write('='*60 + '\n')
