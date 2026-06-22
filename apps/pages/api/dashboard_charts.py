"""
dashboard_charts.py — توليد الرسوم البيانية للوحة التحكم باستخدام Plotly + pandas.

GET /api/dash/charts  →  { success, charts: { ops_daily, balance_currency, branch_compare } }

كل رسم يُعاد كـ Plotly figure JSON (data + layout) لتعرضه الواجهة عبر Plotly.js.
"""
import json
from datetime import timedelta

import pandas as pd
import plotly.graph_objects as go

from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Sum, Count
from django.db.models.functions import TruncDate

from ..models import Branch, ExchangeOperation, HawalaOperation, CashTransaction
from core.permissions import require_roles


# ── سمة داكنة موحّدة لكل الرسوم ───────────────────────────────────────────────
def _theme(title):
    return dict(
        title=dict(text=title, font=dict(size=15, color='#e8eaf0')),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(color='#cbd5e1', family='Cairo, sans-serif', size=12),
        margin=dict(l=50, r=20, t=50, b=40),
        xaxis=dict(gridcolor='rgba(255,255,255,0.06)', zeroline=False),
        yaxis=dict(gridcolor='rgba(255,255,255,0.06)', zeroline=False),
        legend=dict(orientation='h', y=-0.18, font=dict(size=11)),
    )


def _daily_counts(model, since):
    """عدّ السجلّات يومياً لنموذج معيّن منذ تاريخ."""
    rows = (model.objects
            .filter(created_at__gte=since)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(c=Count('id')))
    return {r['day']: r['c'] for r in rows}


def api_dash_charts(request):
    """يولّد رسوم لوحة التحكم — للإدارة العامة فقط."""
    err = require_roles(request, 'M01')
    if err:
        return err

    today = timezone.localdate()
    since = timezone.now() - timedelta(days=29)

    # ── 1) العمليات اليومية (آخر 30 يوماً) ──────────────────────────────────
    ex = _daily_counts(ExchangeOperation, since)
    hw = _daily_counts(HawalaOperation, since)
    ca = _daily_counts(CashTransaction, since)

    days   = [today - timedelta(days=i) for i in range(29, -1, -1)]
    df = pd.DataFrame({
        'label':  [d.strftime('%m-%d') for d in days],
        'صرف':    [ex.get(d, 0) for d in days],
        'حوالات': [hw.get(d, 0) for d in days],
        'نقدي':   [ca.get(d, 0) for d in days],
    })

    _fill = {'صرف': 'rgba(34,197,94,0.10)', 'حوالات': 'rgba(59,130,246,0.10)', 'نقدي': 'rgba(245,158,11,0.10)'}
    fig_ops = go.Figure()
    for col, color in [('صرف', '#22c55e'), ('حوالات', '#3b82f6'), ('نقدي', '#f59e0b')]:
        fig_ops.add_trace(go.Scatter(
            x=df['label'], y=df[col], name=col, mode='lines',
            line=dict(width=2.5, color=color), fill='tozeroy', fillcolor=_fill[col]))
    fig_ops.update_layout(**_theme('العمليات اليومية — آخر 30 يوماً'))

    # ── 2) توزيع الأرصدة حسب العملة (دائري) ────────────────────────────────
    bal = Branch.objects.aggregate(
        usd=Sum('balance_usd'), ils=Sum('balance_ils'), jod=Sum('balance_jod'))
    fig_bal = go.Figure(go.Pie(
        labels=['دولار USD', 'شيكل ILS', 'دينار JOD'],
        values=[float(bal['usd'] or 0), float(bal['ils'] or 0), float(bal['jod'] or 0)],
        hole=0.55, marker=dict(colors=['#22c55e', '#3b82f6', '#f59e0b']),
        textinfo='label+percent', textfont=dict(size=11)))
    fig_bal.update_layout(**_theme('توزيع الأرصدة حسب العملة'))

    # ── 3) مقارنة الفروع (أعلى 8 بالرصيد بالدولار) ─────────────────────────
    branches = list(Branch.objects.values('name', 'balance_usd').order_by('-balance_usd')[:8])
    names = [b['name'] for b in branches][::-1]
    vals  = [float(b['balance_usd'] or 0) for b in branches][::-1]
    fig_br = go.Figure(go.Bar(
        x=vals, y=names, orientation='h',
        marker=dict(color='#6366f1'), text=vals, textposition='auto'))
    fig_br.update_layout(**_theme('أعلى الفروع رصيداً (USD)'))

    return JsonResponse({
        'success': True,
        'charts': {
            'ops_daily':        json.loads(fig_ops.to_json()),
            'balance_currency': json.loads(fig_bal.to_json()),
            'branch_compare':   json.loads(fig_br.to_json()),
        },
    })
