"""
gl_posting.py — منطق الترحيل المحاسبي المعياري (قيد مزدوج)
═══════════════════════════════════════════════════════════════
يحوّل عمليات الصرافة/الحوالات إلى قيود متوازنة في دفتر الأستاذ الموحّد:

  • كل صندوق  → حساب أصل نقدي (تحت "النقدية والصناديق")
  • كل مركز/عميل → حساب جارٍ (تحت "ذمم المراكز")
  • الصرافة متعددة العملات تتوازن عبر "حساب مركز صرف العملات"

كل الدوال تستدعي post_gl() الذي يفرض توازن المدين=الدائن لكل عملة.
"""
from .gl_utils import post_gl
from ..models import Account


# رموز حسابات الجذر (من دليل الحسابات المبذور)
ACC_BOXES_PARENT   = '11'   # النقدية والصناديق
ACC_CENTERS_PARENT = '12'   # ذمم مدينة (مراكز وعملاء)
ACC_FX_POSITION    = '13'   # مركز صرف العملات (يُنشأ تلقائياً)
ACC_REV_EXCHANGE   = '41'   # أرباح الصرافة
ACC_REV_FEES       = '42'   # عمولات وأجور الحوالات


def _ensure_group(code, name, type_):
    obj, _ = Account.objects.get_or_create(
        code=code, defaults={'name': name, 'type': type_, 'is_group': True})
    return obj


def _ensure_leaf(parent, name, type_, currency, prefix):
    """يجلب/يُنشئ حساباً فرعياً قابلاً للترحيل باسمٍ معيّن تحت حساب أب."""
    name = (name or '').strip()
    if not name:
        return None
    acc = Account.objects.filter(parent=parent, name=name).first()
    if acc:
        return acc
    n = Account.objects.filter(code__startswith=prefix + '-').count() + 1
    code = f'{prefix}-{n:04d}'
    while Account.objects.filter(code=code).exists():
        n += 1
        code = f'{prefix}-{n:04d}'
    return Account.objects.create(code=code, name=name, type=type_,
                                  parent=parent, currency=currency, is_group=False)


def ensure_box(name, currency='USD'):
    """حساب صندوق نقدي."""
    parent = _ensure_group(ACC_BOXES_PARENT, 'النقدية والصناديق', 'asset')
    return _ensure_leaf(parent, name, 'asset', currency, 'BOX')


def ensure_center(name, currency='USD'):
    """حساب جارٍ لمركز/عميل."""
    parent = _ensure_group(ACC_CENTERS_PARENT, 'ذمم مدينة (مراكز وعملاء)', 'asset')
    return _ensure_leaf(parent, name, 'asset', currency, 'CTR')


def _fx_account():
    """حساب مركز صرف العملات (يوازن العمليات متعددة العملات)."""
    obj, _ = Account.objects.get_or_create(
        code=ACC_FX_POSITION,
        defaults={'name': 'مركز صرف العملات', 'type': 'asset', 'is_group': False})
    return obj


def _revenue(code, name):
    obj, _ = Account.objects.get_or_create(
        code=code, defaults={'name': name, 'type': 'revenue', 'is_group': False})
    return obj


# ══════════════════════════════════════════════════════════════════════════════
#  الترحيلات المعيارية — كلها قيود متوازنة
# ══════════════════════════════════════════════════════════════════════════════

def post_receipt(*, box, center, amount, currency='USD', source='receipt',
                 source_id=None, description='', created_by='', date=None):
    """استلام نقد من عميل: الصندوق مدين، حساب العميل دائن."""
    b = ensure_box(box, currency)
    c = ensure_center(center, currency)
    return post_gl(lines=[
        {'account': b, 'debit': amount,  'currency': currency, 'center': box,    'note': 'استلام نقد'},
        {'account': c, 'credit': amount, 'currency': currency, 'center': center, 'note': 'حساب العميل'},
    ], source=source, source_id=source_id,
       description=description or f'سند قبض — {center}', created_by=created_by, date=date)


def post_payment(*, box, center, amount, currency='USD', source='payment',
                 source_id=None, description='', created_by='', date=None):
    """دفع نقد لعميل: الصندوق دائن، حساب العميل مدين."""
    b = ensure_box(box, currency)
    c = ensure_center(center, currency)
    return post_gl(lines=[
        {'account': c, 'debit': amount,  'currency': currency, 'center': center, 'note': 'حساب العميل'},
        {'account': b, 'credit': amount, 'currency': currency, 'center': box,    'note': 'دفع نقد'},
    ], source=source, source_id=source_id,
       description=description or f'سند دفع — {center}', created_by=created_by, date=date)


def post_center_transfer(*, from_center, to_center, amount, currency='USD', fee=0,
                         source='transfer', source_id=None, description='',
                         created_by='', date=None):
    """
    حوالة من مركز لمركز (نفس العملة) + أجور اختيارية كإيراد.
    المُرسِل مدين بالمبلغ+الأجور · المستلم دائن بالمبلغ · الأجور إيراد دائن.
    """
    f = ensure_center(from_center, currency)
    t = ensure_center(to_center, currency)
    lines = [
        {'account': f, 'debit': _d(amount) + _d(fee), 'currency': currency,
         'center': from_center, 'note': 'المُرسِل'},
        {'account': t, 'credit': _d(amount), 'currency': currency,
         'center': to_center, 'note': 'المستلم'},
    ]
    if _d(fee) > 0:
        lines.append({'account': _revenue(ACC_REV_FEES, 'عمولات وأجور الحوالات'),
                      'credit': _d(fee), 'currency': currency, 'note': 'أجور الحوالة'})
    return post_gl(lines=lines, source=source, source_id=source_id,
                   description=description or f'حوالة {from_center} ← {to_center}',
                   created_by=created_by, date=date)


def post_exchange(*, box, give_currency, give_amount, get_currency, get_amount,
                  source='exchange', source_id=None, description='',
                  created_by='', date=None):
    """
    صرافة: العميل يدفع give، يستلم get (عملتان مختلفتان).
    تتوازن كل عملة عبر "مركز صرف العملات":
      - عملة give: الصندوق مدين / مركز الصرف دائن
      - عملة get:  الصندوق دائن / مركز الصرف مدين
    الربح يُحقَّق لاحقاً من إعادة تقييم مركز الصرف.
    """
    b = ensure_box(box, give_currency)
    b2 = ensure_box(box, get_currency)
    fx = _fx_account()
    return post_gl(lines=[
        {'account': b,  'debit': give_amount,  'currency': give_currency, 'center': box, 'note': 'استلام عملة'},
        {'account': fx, 'credit': give_amount, 'currency': give_currency, 'note': 'مركز الصرف'},
        {'account': b2, 'credit': get_amount,  'currency': get_currency,  'center': box, 'note': 'تسليم عملة'},
        {'account': fx, 'debit': get_amount,   'currency': get_currency,  'note': 'مركز الصرف'},
    ], source=source, source_id=source_id,
       description=description or f'صرافة {give_currency}→{get_currency}',
       created_by=created_by, date=date)


def _d(v):
    from decimal import Decimal
    try:
        return Decimal(str(v if v not in (None, '') else 0))
    except Exception:
        return Decimal('0')
