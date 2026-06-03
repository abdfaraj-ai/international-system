@echo off
chcp 65001 >nul
title نظام انترناشونال الموحد

echo.
echo  ==========================================
echo   نظام انترناشونال الموحد
echo   International Financial Services System
echo  ==========================================
echo.

:: تفعيل البيئة الافتراضية إن وُجدت
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
    echo  [OK] تم تفعيل البيئة الافتراضية
) else (
    echo  [INFO] لم يتم العثور على .venv - يستخدم Python العام
)

:: تعيين إعدادات النظام الداخلي
set DJANGO_SETTINGS_MODULE=core.settings.internal

:: تنفيذ الـ migrations
echo.
echo  [1/3] تطبيق تحديثات قاعدة البيانات...
python manage.py migrate --run-syncdb
if errorlevel 1 (
    echo  [ERROR] فشل تطبيق التحديثات
    pause
    exit /b 1
)

:: إنشاء المستخدمين الأساسيين إن لم يكونوا موجودين
echo.
echo  [2/3] التحقق من المستخدمين...
python manage.py setup_users

:: الحصول على عنوان IP المحلي
echo.
echo  [3/3] تشغيل الخادم...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address" /C:"عنوان IPv4"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo.
echo  ==========================================
echo   الخادم يعمل الآن
if defined LOCAL_IP (
    echo   الشبكة المحلية : http://%LOCAL_IP%:8000
)
echo   الجهاز الحالي  : http://127.0.0.1:8000
echo   لوحة الإدارة   : http://127.0.0.1:8000/admin/
echo.
echo   اضغط Ctrl+C لإيقاف الخادم
echo  ==========================================
echo.

:: تشغيل الخادم على جميع الواجهات (0.0.0.0) ليكون متاحاً على الشبكة
python manage.py runserver 0.0.0.0:8000

pause
