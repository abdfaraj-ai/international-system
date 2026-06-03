"""
apps/pages/tests.py — اختبارات النظام الأساسية
تشغيل: python manage.py test apps.pages -v 2
"""
import json
from django.test        import TestCase, Client
from django.urls        import reverse
from django.contrib.auth import get_user_model

from .models import (
    Branch, CentralTreasury, TreasuryDeposit,
    ExchangeRate, TellerProfile, TellerBalance, TellerPermission,
)

User = get_user_model()


# ══════════════════════════════════════════════════════════════
# 1. MODELS — اختبار النماذج
# ══════════════════════════════════════════════════════════════

class SystemUserModelTest(TestCase):

    def test_home_page_per_role(self):
        """كل دور يُوجَّه للصفحة الصحيحة"""
        mapping = {
            'M01': '/dashboard/',
            'M02': '/supervisor/teller/',
            'M03': '/transactions/supervisor/',
            'T01': '/teller/',
            'T02': '/accounts/',
            'T03': '/transactions/',
        }
        for role, expected_url in mapping.items():
            user = User(username=f'user_{role}', role=role)
            self.assertEqual(user.home_page, expected_url,
                             f'الدور {role} يجب أن يوجّه إلى {expected_url}')

    def test_to_dict_fields(self):
        """to_dict يُعيد الحقول المطلوبة"""
        user = User.objects.create_user(
            username='testuser', password='TestPass123!',
            first_name='أحمد', last_name='محمد', role='T01'
        )
        d = user.to_dict()
        for key in ('id', 'username', 'name', 'role', 'roleName', 'isActive'):
            self.assertIn(key, d, f'المفتاح "{key}" مفقود من to_dict')
        self.assertEqual(d['role'], 'T01')
        self.assertEqual(d['name'], 'أحمد محمد')

    def test_role_name_arabic(self):
        """role_name يُعيد الاسم العربي"""
        user = User(role='M01')
        self.assertEqual(user.role_name, 'الإدارة العامة')

    def test_str_representation(self):
        """__str__ يُعيد username + role_name"""
        user = User(username='admin', role='M01')
        self.assertIn('admin', str(user))
        self.assertIn('الإدارة', str(user))


class BranchModelTest(TestCase):

    def setUp(self):
        self.branch = Branch.objects.create(
            name='فرع القدس',
            location='القدس',
            currency='ILS',
            balance_usd=1000.0,
            balance_ils=3500.0,
            balance_jod=700.0,
        )

    def test_branch_created(self):
        self.assertEqual(Branch.objects.count(), 1)
        self.assertEqual(self.branch.name, 'فرع القدس')

    def test_to_dict_balances(self):
        d = self.branch.to_dict()
        self.assertEqual(d['balanceUSD'], 1000.0)
        self.assertEqual(d['balanceILS'], 3500.0)
        self.assertEqual(d['balanceJOD'], 700.0)
        self.assertEqual(d['currency'], 'ILS')

    def test_default_status_is_active(self):
        self.assertEqual(self.branch.status, 'active')

    def test_str_contains_name_and_location(self):
        self.assertIn('فرع القدس', str(self.branch))
        self.assertIn('القدس', str(self.branch))


class CentralTreasuryModelTest(TestCase):

    def test_singleton_pattern(self):
        """get() يُنشئ سجلاً واحداً ثم يُعيده دائماً"""
        t1 = CentralTreasury.get()
        t2 = CentralTreasury.get()
        self.assertEqual(t1.pk, t2.pk)
        self.assertEqual(CentralTreasury.objects.count(), 1)

    def test_default_balances_zero(self):
        treasury = CentralTreasury.get()
        self.assertEqual(treasury.balance_usd, 0)
        self.assertEqual(treasury.balance_ils, 0)
        self.assertEqual(treasury.balance_jod, 0)

    def test_deposit_updates_balance(self):
        treasury = CentralTreasury.get()
        treasury.balance_usd += 5000
        treasury.save()
        refreshed = CentralTreasury.objects.get(pk=1)
        self.assertEqual(refreshed.balance_usd, 5000)


# ══════════════════════════════════════════════════════════════
# 2. AUTH — اختبار تسجيل الدخول
# ══════════════════════════════════════════════════════════════

class LoginAPITest(TestCase):

    def setUp(self):
        self.client = Client(enforce_csrf_checks=False)
        self.user = User.objects.create_user(
            username='teller01',
            password='SecurePass123!',
            role='T01',
            is_active=True,
        )
        self.url = reverse('api-login')

    def _post(self, data):
        return self.client.post(
            self.url,
            json.dumps(data),
            content_type='application/json',
        )

    def test_login_success(self):
        resp = self._post({'username': 'teller01', 'password': 'SecurePass123!', 'role': 'T01'})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['success'], f'فشل تسجيل الدخول: {data}')

    def test_login_wrong_password(self):
        resp = self._post({'username': 'teller01', 'password': 'WrongPass!', 'role': 'T01'})
        data = resp.json()
        self.assertFalse(data['success'])

    def test_login_wrong_role(self):
        """المستخدم يختار دوراً لا يملكه → رفض"""
        resp = self._post({'username': 'teller01', 'password': 'SecurePass123!', 'role': 'M01'})
        data = resp.json()
        self.assertFalse(data['success'])

    def test_login_missing_fields(self):
        resp = self._post({'username': 'teller01'})
        data = resp.json()
        self.assertFalse(data['success'])

    def test_login_inactive_user(self):
        self.user.is_active = False
        self.user.save()
        resp = self._post({'username': 'teller01', 'password': 'SecurePass123!', 'role': 'T01'})
        data = resp.json()
        self.assertFalse(data['success'])

    def test_login_method_get_rejected(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 405)


# ══════════════════════════════════════════════════════════════
# 3. PERMISSIONS — اختبار الصلاحيات
# ══════════════════════════════════════════════════════════════

class PermissionsTest(TestCase):

    def setUp(self):
        self.client = Client(enforce_csrf_checks=False)
        self.admin = User.objects.create_user(
            username='admin01', password='AdminPass123!', role='M01'
        )
        self.teller = User.objects.create_user(
            username='teller01', password='TellerPass123!', role='T01'
        )

    def _login(self, user, password):
        self.client.post(
            reverse('api-login'),
            json.dumps({'username': user.username, 'password': password, 'role': user.role}),
            content_type='application/json',
        )

    def test_unauthenticated_api_returns_401(self):
        resp = self.client.get('/api/branches')
        self.assertIn(resp.status_code, [401, 302, 403])

    def test_wrong_role_returns_403(self):
        """التلر لا يستطيع الوصول لـ API الإدارة"""
        self._login(self.teller, 'TellerPass123!')
        resp = self.client.get('/api/branches')
        self.assertIn(resp.status_code, [403, 401])

    def test_admin_can_access_branches(self):
        """الأدمن يستطيع الوصول لـ API الفروع"""
        self._login(self.admin, 'AdminPass123!')
        resp = self.client.get('/api/branches')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success', False))


# ══════════════════════════════════════════════════════════════
# 4. HEALTH CHECK — اختبار endpoint الصحة
# ══════════════════════════════════════════════════════════════

class HealthCheckTest(TestCase):

    def test_health_returns_200_when_db_ok(self):
        resp = self.client.get('/api/health/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('status', data)
        self.assertIn('checks', data)
        self.assertIn('database', data['checks'])
        self.assertEqual(data['checks']['database']['status'], 'ok')

    def test_health_response_has_latency(self):
        resp = self.client.get('/api/health/')
        data = resp.json()
        self.assertIn('response_ms', data)
        self.assertIn('latency_ms', data['checks']['database'])


# ══════════════════════════════════════════════════════════════
# 5. RATE LIMITING — اختبار حد الطلبات
# ══════════════════════════════════════════════════════════════

class RateLimitTest(TestCase):

    def setUp(self):
        self.client = Client(enforce_csrf_checks=False)

    def test_login_rate_limit_triggers(self):
        """بعد 10 محاولات فاشلة → 429"""
        url = reverse('api-login')
        payload = json.dumps({'username': 'x', 'password': 'wrong', 'role': 'T01'})
        last_resp = None
        for _ in range(12):
            last_resp = self.client.post(url, payload, content_type='application/json')
        # يجب أن تُعيد 429 بعد تجاوز الحد
        self.assertEqual(last_resp.status_code, 429)


# ══════════════════════════════════════════════════════════════
# 6. BRANCH API — اختبار API الفروع
# ══════════════════════════════════════════════════════════════

class BranchAPITest(TestCase):

    def setUp(self):
        self.client = Client(enforce_csrf_checks=False)
        self.admin = User.objects.create_user(
            username='admin01', password='AdminPass123!', role='M01'
        )
        # تسجيل دخول
        self.client.post(
            reverse('api-login'),
            json.dumps({'username': 'admin01', 'password': 'AdminPass123!', 'role': 'M01'}),
            content_type='application/json',
        )

    def test_list_branches_empty(self):
        resp = self.client.get('/api/branches')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['success'])
        self.assertIsInstance(data['branches'], list)

    def test_create_branch(self):
        resp = self.client.post(
            '/api/branches',
            json.dumps({'name': 'فرع رام الله', 'location': 'رام الله', 'currency': 'ILS'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['success'])
        self.assertEqual(Branch.objects.count(), 1)

    def test_create_branch_missing_name(self):
        resp = self.client.post(
            '/api/branches',
            json.dumps({'location': 'رام الله'}),
            content_type='application/json',
        )
        data = resp.json()
        self.assertFalse(data['success'])

    def test_delete_branch(self):
        branch = Branch.objects.create(name='فرع مؤقت', currency='USD')
        resp = self.client.delete(f'/api/branches/{branch.id}')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Branch.objects.count(), 0)


# ══════════════════════════════════════════════════════════════
# 7. CENTRAL TREASURY — اختبار الخزينة المركزية
# ══════════════════════════════════════════════════════════════

class CentralTreasuryAPITest(TestCase):

    def setUp(self):
        self.client = Client(enforce_csrf_checks=False)
        self.admin = User.objects.create_user(
            username='admin01', password='AdminPass123!', role='M01'
        )
        self.client.post(
            reverse('api-login'),
            json.dumps({'username': 'admin01', 'password': 'AdminPass123!', 'role': 'M01'}),
            content_type='application/json',
        )

    def test_get_main_box(self):
        resp = self.client.get('/api/main-box')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['success'])
        self.assertIn('mainBox', data)

    def test_deposit_to_treasury(self):
        resp = self.client.post(
            '/api/main-box/deposit',
            json.dumps({'amount': 1000, 'currency': 'USD', 'notes': 'إيداع تجريبي'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['success'])
        treasury = CentralTreasury.get()
        self.assertEqual(treasury.balance_usd, 1000)

    def test_deposit_invalid_amount(self):
        resp = self.client.post(
            '/api/main-box/deposit',
            json.dumps({'amount': -500, 'currency': 'USD'}),
            content_type='application/json',
        )
        data = resp.json()
        self.assertFalse(data['success'])

    def test_deposit_invalid_currency(self):
        resp = self.client.post(
            '/api/main-box/deposit',
            json.dumps({'amount': 100, 'currency': 'XYZ'}),
            content_type='application/json',
        )
        data = resp.json()
        self.assertFalse(data['success'])
