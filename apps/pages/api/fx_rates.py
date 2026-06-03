"""
fx_rates.py — شريط أسعار العملات والذهب
- العملات: open.er-api.com   (مجاني، بلا API key، استدعاء واحد)
- الذهب:   Yahoo Finance      (مجاني، بلا API key)
كل شيء مخزَّن في Django cache لمدة ساعة.
"""
import logging
import urllib.request
import json as _json

from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.http import require_GET

_log = logging.getLogger('intl.app')

_UA         = {'User-Agent': 'Mozilla/5.0 (compatible; intl-fx/1.0)'}
_CACHE_KEY  = 'fx_rates_ticker'
_CACHE_SECS = 3600

# ── أزواج العملات (كلها بالنسبة لـ USD كـ base) ──────────────────────────────
# (quote, label_ar)  — السعر = كم وحدة من quote تساوي 1 USD
_USD_PAIRS = [
    ('ILS', 'دولار / شيكل'),
    ('EGP', 'دولار / جنيه مصري'),
    ('TRY', 'دولار / ليرة تركية'),
    ('SAR', 'دولار / ريال سعودي'),
    ('AED', 'دولار / درهم إماراتي'),
    ('QAR', 'دولار / ريال قطري'),
    ('MAD', 'دولار / درهم مغربي'),
    ('DZD', 'دولار / دينار جزائري'),
    ('EUR', 'دولار / يورو'),
    ('TND', 'دولار / دينار تونسي'),
]

# أزواج مشتقة (نحسبها من أسعار USD)
# (base, quote, label_ar)
_CROSS_PAIRS = [
    ('JOD', 'USD', 'دينار أردني / دولار'),   # 1 JOD = 1/0.709 USD
    ('JOD', 'ILS', 'دينار أردني / شيكل'),
    ('EUR', 'ILS', 'يورو / شيكل'),
]

_JOD_RATE = 0.709   # ثابت رسمي (الدينار الأردني مربوط بالدولار)


def _http_get(url: str) -> dict:
    req = urllib.request.Request(url, headers=_UA)
    with urllib.request.urlopen(req, timeout=10) as r:
        return _json.loads(r.read())


def _fetch_gold_usd() -> float | None:
    try:
        data = _http_get('https://api.gold-api.com/price/XAU')
        price = float(data['price'])
        return round(price, 2)
    except Exception as exc:
        _log.warning('fx_rates: فشل جلب الذهب — %s', exc)
        return None


def _build_all() -> list[dict]:
    # ── جلب أسعار USD في استدعاء واحد ──────────────────────────────────────
    rates_vs_usd: dict[str, float] = {}
    try:
        data = _http_get('https://open.er-api.com/v6/latest/USD')
        rates_vs_usd = {k: float(v) for k, v in data.get('rates', {}).items()}
    except Exception as exc:
        _log.warning('fx_rates: فشل جلب العملات — %s', exc)

    result = []

    # ── الذهب أولاً ─────────────────────────────────────────────────────────
    gold = _fetch_gold_usd()
    if gold:
        result.append({'base': 'XAU', 'quote': 'USD', 'label': 'ذهب (أونصة) / دولار', 'rate': gold})

    # ── أزواج USD مباشرة ─────────────────────────────────────────────────────
    for quote, label in _USD_PAIRS:
        rate = rates_vs_usd.get(quote)
        if rate:
            result.append({'base': 'USD', 'quote': quote, 'label': label, 'rate': round(rate, 4)})

    # ── أزواج مشتقة ──────────────────────────────────────────────────────────
    ils = rates_vs_usd.get('ILS', 0)
    eur_rate = rates_vs_usd.get('EUR', 0)  # USD/EUR

    # دينار أردني / دولار = 1 / JOD_RATE
    result.append({'base': 'JOD', 'quote': 'USD', 'label': 'دينار أردني / دولار',
                   'rate': round(1 / _JOD_RATE, 4)})

    # دينار أردني / شيكل:
    # 1 JOD = (1/_JOD_RATE) USD = (ils/_JOD_RATE) ILS
    if ils:
        jod_ils = round(ils / _JOD_RATE, 4)
        result.append({'base': 'JOD', 'quote': 'ILS', 'label': 'دينار أردني / شيكل',
                       'rate': jod_ils})

    # يورو / شيكل
    if ils and eur_rate:
        eur_ils = round(ils / eur_rate, 4)
        result.append({'base': 'EUR', 'quote': 'ILS', 'label': 'يورو / شيكل',
                       'rate': eur_ils})

    return result


@require_GET
def api_fx_rates(request):
    """GET /api/fx-rates/ — أسعار العملات والذهب (cache ساعة)."""
    if request.GET.get('refresh') == '1':
        cache.delete(_CACHE_KEY)

    data = cache.get(_CACHE_KEY)
    # لا نعتمد على كاش ناقص (أقل من 5 أزواج يعني فشل سابق)
    if not data or len(data) < 5:
        data = _build_all()
        if len(data) >= 5:
            cache.set(_CACHE_KEY, data, _CACHE_SECS)

    return JsonResponse({'success': True, 'pairs': data, 'ttl': _CACHE_SECS})
