"""
core/validators.py — متحقق كلمة المرور المخصص
يُضاف إلى AUTH_PASSWORD_VALIDATORS في base.py
"""
import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class PasswordComplexityValidator:
    """
    يتحقق أن كلمة المرور تحتوي على:
      - حرف كبير واحد على الأقل (A-Z)
      - حرف صغير واحد على الأقل (a-z)
      - رقم واحد على الأقل (0-9)
      - رمز خاص واحد على الأقل (!@#$%^&*...)
    """

    SPECIAL = r'[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/\\\'"`~]'

    def validate(self, password, user=None):
        errors = []
        if not re.search(r'[A-Z]', password):
            errors.append('حرف كبير واحد على الأقل (A-Z)')
        if not re.search(r'[a-z]', password):
            errors.append('حرف صغير واحد على الأقل (a-z)')
        if not re.search(r'[0-9]', password):
            errors.append('رقم واحد على الأقل (0-9)')
        if not re.search(self.SPECIAL, password):
            errors.append('رمز خاص واحد على الأقل (!@#$...)')
        if errors:
            raise ValidationError(
                'كلمة المرور يجب أن تحتوي على: ' + '، '.join(errors),
                code='password_too_simple',
            )

    def get_help_text(self):
        return 'يجب أن تحتوي على حرف كبير وصغير ورقم ورمز خاص.'
