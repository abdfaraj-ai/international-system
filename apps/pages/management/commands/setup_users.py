"""
Create initial system users.
Usage:
    python manage.py setup_users
"""
import sys
import io
from django.core.management.base import BaseCommand
from apps.pages.models import SystemUser


INITIAL_USERS = [
    {'username': 'admin',     'password': 'Admin@2026',  'role': 'M01', 'first_name': 'Admin',    'last_name': 'General',  'is_staff': True, 'is_superuser': True},
    {'username': 'sv_teller', 'password': 'Teller@2026', 'role': 'M02', 'first_name': 'Supervisor','last_name': 'Teller'},
    {'username': 'sv_trx',    'password': 'Trx@2026',    'role': 'M03', 'first_name': 'Supervisor','last_name': 'Trx'},
    {'username': 'teller1',   'password': 'Tell@2026',   'role': 'T01', 'first_name': 'Ahmed',    'last_name': 'Teller'},
    {'username': 'bank1',     'password': 'Bank@2026',   'role': 'T02', 'first_name': 'Mohammed',  'last_name': 'Bank'},
    {'username': 'trx1',      'password': 'Trx1@2026',   'role': 'T03', 'first_name': 'Ali',      'last_name': 'Trx'},
]


class Command(BaseCommand):
    help = 'Create default system users'

    def _out(self, msg):
        try:
            self.stdout.write(msg)
        except UnicodeEncodeError:
            sys.stdout.buffer.write((msg + '\n').encode('utf-8'))

    def handle(self, *args, **options):
        self._out('\n=== Creating System Users ===\n')
        created = 0

        for u in INITIAL_USERS:
            if SystemUser.objects.filter(username=u['username']).exists():
                self._out(f"  SKIP : {u['username']} (already exists)")
                continue

            user = SystemUser.objects.create_user(
                username=u['username'],
                password=u['password'],
                role=u['role'],
                first_name=u.get('first_name', ''),
                last_name=u.get('last_name', ''),
                is_staff=u.get('is_staff', False),
                is_superuser=u.get('is_superuser', False),
            )
            self._out(f"  OK   : {user.username:<15} | {user.role} | {user.role_name}")
            created += 1

        self._out('')
        if created:
            self._out(f'Created {created} user(s) successfully.')
            self._out('WARNING: Change passwords before production deployment!')
        else:
            self._out('No new users created (all already exist).')

        self._out('\n--- Login Credentials ---')
        for u in INITIAL_USERS:
            self._out(f"  {u['role']} | {u['username']:<15} | {u['password']}")
        self._out('')
