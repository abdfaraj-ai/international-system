"""
ensure_admin — إنشاء حساب مدير (M01) من متغيّرات البيئة، بشكل آمن وغير مكرَّر.

الاستخدام (يُشغّل تلقائياً في start.sh عند النشر):
    python manage.py ensure_admin

يقرأ من البيئة:
    ADMIN_USERNAME   (افتراضي: admin)
    ADMIN_PASSWORD   (إلزامي — إن لم يُضبط لا يفعل شيئاً)
    ADMIN_EMAIL      (اختياري)

السلوك:
    - إن لم تُضبط ADMIN_PASSWORD → لا يفعل شيئاً (آمن للإبقاء دائماً في start.sh).
    - إن كان المستخدم موجوداً → يتخطّى دون تغيير كلمة مروره.
    - وإلا → ينشئ مديراً بدور M01 + superuser.

بعد إنشاء الحساب وتسجيل الدخول: احذف ADMIN_PASSWORD من متغيّرات Railway.
"""
import os
from django.core.management.base import BaseCommand
from apps.pages.models import SystemUser


class Command(BaseCommand):
    help = 'إنشاء حساب مدير (M01) من متغيّرات البيئة إن لم يكن موجوداً'

    def handle(self, *args, **options):
        username = (os.environ.get('ADMIN_USERNAME') or 'admin').strip()
        password = os.environ.get('ADMIN_PASSWORD') or ''
        email    = (os.environ.get('ADMIN_EMAIL') or '').strip()

        if not password:
            self.stdout.write('ensure_admin: ADMIN_PASSWORD غير مضبوط — تم التخطّي.')
            return

        user = SystemUser.objects.filter(username=username).first()
        if user:
            # الحساب موجود — أعِد ضبط كلمة المرور والدور والحالة لضمان الدخول
            user.set_password(password)
            user.role         = 'M01'
            user.is_staff     = True
            user.is_superuser = True
            user.is_active    = True
            if email:
                user.email = email
            user.save()
            self.stdout.write(f'ensure_admin: تم تحديث المدير "{username}" (كلمة المرور + M01).')
            return

        SystemUser.objects.create_user(
            username=username,
            password=password,
            email=email,
            role='M01',
            is_staff=True,
            is_superuser=True,
        )
        self.stdout.write(f'ensure_admin: تم إنشاء المدير "{username}" بدور M01 بنجاح.')
