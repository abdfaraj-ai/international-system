"""
am_trial_balance.py — ميزان المراجعة
══════════════════════════════════════
GET /api/am/trial-balance/   ← يجمع كل الحركات مجمّعة حسب العملة
"""
from collections import defaultdict
from decimal import Decimal
from django.http import JsonResponse
from django.db.models import Q
from django.utils import timezone
from datetime import date

from ..models import (
    HawalaTransfer, CurrencySwap, CutAndClose,
    AdvancedEntry, JournalEntry, SettlementVoucher,
    OutgoingTransfer, OpeningEntry, ReceiptVoucher, PaymentVoucher,
    EntryFromTo,
)
from core.permissions import require_roles as _require_roles


def _d(date_str):
    try:
        return date.fromisoformat(date_str)
    except Exception:
        return None


def _apply_dates(qs, date_field, df, dt):
    if df:
        qs = qs.filter(**{f'{date_field}__gte': df})
    if dt:
        qs = qs.filter(**{f'{date_field}__lte': dt})
    return qs


def _zero():
    return {'debit': Decimal('0'), 'credit': Decimal('0')}


def api_am_trial_balance(request):
    err = _require_roles(request, 'M01')
    if err:
        return err

    date_from_s = request.GET.get('date_from', '').strip()
    date_to_s   = request.GET.get('date_to', '').strip()
    df = _d(date_from_s)
    dt = _d(date_to_s)

    # مجمّع: currency → {debit, credit}
    tb    = defaultdict(_zero)   # ميزان المراجعة الكلي
    zbn   = defaultdict(_zero)   # أرصدة الزبائن
    cut   = defaultdict(_zero)   # مراكز القطع
    unrcv = defaultdict(_zero)   # حوالات غير مسلمة
    profit_items = []            # عناصر الأرباح

    # ── 1. حوالات خارجية (OutgoingTransfer) ─────────────────────────────────
    ot_qs = _apply_dates(OutgoingTransfer.objects.all(), 'entry_date', df, dt)
    for t in ot_qs:
        c = t.send_currency or 'USD'
        tb[c]['debit']  += t.send_amount
        tb[c]['credit'] += t.receive_amount
        zbn[c]['debit'] += t.send_amount
        fees = t.export_fee + t.delivery_fee
        if fees:
            profit_items.append({'label': f'أجور حوالة {t.ref_number}', 'currency': c, 'amount': float(fees)})

    # ── 2. سند قبض (ReceiptVoucher) ──────────────────────────────────────────
    rv_qs = _apply_dates(ReceiptVoucher.objects.all(), 'entry_date', df, dt)
    for v in rv_qs:
        fc, tc = v.from_currency, v.to_currency
        tb[fc]['debit']  += v.from_amount
        tb[tc]['credit'] += v.to_amount
        if v.net_profit:
            profit_items.append({'label': f'سند قبض {v.ref_number}', 'currency': fc, 'amount': float(v.net_profit)})

    # ── 3. سند دفع (PaymentVoucher) ──────────────────────────────────────────
    pv_qs = _apply_dates(PaymentVoucher.objects.all(), 'entry_date', df, dt)
    for v in pv_qs:
        fc, tc = v.from_currency, v.to_currency
        tb[fc]['credit'] += v.from_amount
        tb[tc]['debit']  += v.to_amount
        if v.net_profit:
            profit_items.append({'label': f'سند دفع {v.ref_number}', 'currency': fc, 'amount': float(v.net_profit)})

    # ── 4. تبديل عملات (CurrencySwap / CutAndClose) ──────────────────────────
    try:
        ca_qs = _apply_dates(CutAndClose.objects.all(), 'created_at__date', df, dt)
        for c_obj in ca_qs:
            bc, sc = c_obj.buy_currency, c_obj.sell_currency
            tb[bc]['debit']  += c_obj.buy_amount
            tb[sc]['credit'] += c_obj.sell_amount
            cut[bc]['debit'] += c_obj.buy_amount
            cut[sc]['credit']+= c_obj.sell_amount
    except Exception:
        pass

    # ── 5. قيد افتتاحي (OpeningEntry) ────────────────────────────────────────
    oe_qs = _apply_dates(OpeningEntry.objects.all(), 'entry_date', df, dt)
    for e in oe_qs:
        c = e.currency or 'USD'
        if e.entry_type == 'us':
            tb[c]['debit'] += e.amount
        else:
            tb[c]['credit'] += e.amount

    # ── 6. حوالات غير مسلمة (HawalaTransfer pending) ─────────────────────────
    try:
        hw_qs = HawalaTransfer.objects.filter(status='pending', is_deleted=False)
        hw_qs = _apply_dates(hw_qs, 'created_at__date', df, dt)
        for h in hw_qs:
            c = h.currency or 'USD'
            unrcv[c]['debit'] += h.amount
    except Exception:
        pass

    # ── 7. القيود المحاسبية (JournalEntry) ───────────────────────────────────
    # كل قيد: المدين (from) يُسجَّل دائناً بعملته، الدائن (to) يُسجَّل مديناً بعملته
    # والفرق (الربح) يُسجَّل كعنصر ربح بعملة المدين
    jr_qs = _apply_dates(JournalEntry.objects.all(), 'created_at__date', df, dt)
    for j in jr_qs:
        fc = j.from_currency or 'USD'
        tc = j.to_currency or 'USD'
        # المبلغ خرج من حساب المدين → credit بعملة المدين
        tb[fc]['credit'] += j.amount
        # المبلغ المحوّل دخل لحساب الدائن → debit بعملة الدائن
        tb[tc]['debit'] += j.to_amount
        if j.profit:
            profit_items.append({
                'label': f'ربح قيد {j.ref_number}',
                'currency': fc,
                'amount': float(j.profit),
            })

    # ── 8. القيد المتقدّم (AdvancedEntry) ────────────────────────────────────
    # كان مفقوداً من ميزان المراجعة رغم استيراده — يُسجَّل كالقيد العادي
    ae_qs = _apply_dates(AdvancedEntry.objects.all(), 'created_at__date', df, dt)
    for e in ae_qs:
        fc = e.from_currency or 'USD'
        tc = e.to_currency or 'USD'
        tb[fc]['credit'] += e.from_amount     # خرج من المُرسِل
        tb[tc]['debit']  += e.to_amount       # دخل للمستلم
        if e.net_profit:
            profit_items.append({'label': f'ربح قيد متقدّم {e.ref_number}',
                                 'currency': fc, 'amount': float(e.net_profit)})

    # ── 9. القيد من/إلى (EntryFromTo) ────────────────────────────────────────
    # كان مفقوداً من ميزان المراجعة — يُسجَّل كالقيد العادي
    eft_qs = _apply_dates(EntryFromTo.objects.all(), 'created_at__date', df, dt)
    for e in eft_qs:
        fc = e.from_currency or 'USD'
        tc = e.to_currency or 'USD'
        tb[fc]['credit'] += e.from_amount
        tb[tc]['debit']  += e.to_amount
        if e.net_profit:
            profit_items.append({'label': f'ربح قيد من/إلى {e.ref_number}',
                                 'currency': fc, 'amount': float(e.net_profit)})

    # ── بناء النتيجة ──────────────────────────────────────────────────────────
    def to_rows(d):
        rows = []
        for currency, vals in sorted(d.items()):
            deb = float(vals['debit'])
            crd = float(vals['credit'])
            rows.append({
                'currency': currency,
                'total':    round(deb + crd, 4),
                'debit':    round(deb, 4),
                'credit':   round(crd, 4),
                'balance':  round(deb - crd, 4),
            })
        return rows

    tb_rows   = to_rows(tb)
    zbn_rows  = [{'currency': c, 'total': round(float(v['debit']+v['credit']),4)} for c,v in sorted(zbn.items())]
    cut_rows  = [{'currency': c} for c in sorted(cut.keys())]
    unrcv_rows= [{'currency': c, 'total': round(float(v['debit']),4)} for c,v in sorted(unrcv.items())]

    # الرصيد الصافي لكل عملة على حدة — لا يجوز جمع عملات مختلفة في رقم واحد.
    # في نظام صرف العملات، الرصيد الصافي لكل عملة = (مدين - دائن) لتلك العملة،
    # وهو يمثّل صافي المركز المفتوح بتلك العملة (طبيعي ألا يكون صفراً).
    balance_by_currency = {r['currency']: r['balance'] for r in tb_rows}

    # الأرباح الإجمالية
    total_profit = sum(p['amount'] for p in profit_items)

    # صافي الأرباح = الأرباح - رسوم (نبسّطه: نفس الأرباح حتى يُوجد نموذج)
    net_profit = total_profit

    return JsonResponse({
        'success':      True,
        'dateFrom':     date_from_s or None,
        'dateTo':       date_to_s   or None,
        'trialBalance': tb_rows,
        # صافي المركز لكل عملة منفصلاً (بدلاً من جمع عملات مختلفة في رقم بلا معنى)
        'balanceByCurrency': balance_by_currency,
        # توافق رجعي: صافي مركز USD فقط (وليس جمع كل العملات)
        'balance':      round(balance_by_currency.get('USD', 0), 4),
        'clientBalances': zbn_rows,
        'cutCenters':   cut_rows,
        'unreceived':   unrcv_rows,
        'profitItems':  profit_items,
        'totalProfit':  round(total_profit, 4),
        'netProfit':    round(net_profit, 4),
    })
