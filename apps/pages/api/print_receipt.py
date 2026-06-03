"""
Print Receipt API — طباعة مباشرة بدون نافذة
POST /api/print/receipt/
"""
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.permissions import require_roles as _require_roles, parse_json as _parse_json

# ─── مسارات ─────────────────────────────────────────────────────────────────
_API_DIR      = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(_API_DIR)))
LOGO_PATH     = os.path.join(_PROJECT_ROOT, 'FrontEnd', 'static', 'images', 'ختم للشعار تبع الشركة-03.png')

# ─── أبعاد الورقة (80 mm @ 203 DPI ≈ 576 px) ────────────────────────────────
PW = 576
M  = 26   # هامش جانبي

# ─── خطوط (Segoe UI — دعم عربي ممتاز) ───────────────────────────────────────
_FONTS_R = [r'C:\Windows\Fonts\segoeui.ttf',  r'C:\Windows\Fonts\tahoma.ttf',
            r'C:\Windows\Fonts\calibri.ttf']
_FONTS_B = [r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\tahomabd.ttf',
            r'C:\Windows\Fonts\calibrib.ttf']


# ═══════════════════════════════════════════════════════════════════════════
@csrf_exempt
def api_print_receipt(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Method Not Allowed'}, status=405)
    data, err = _parse_json(request)
    if err: return err
    try:
        _check_deps()
        _print(_build(data))
        return JsonResponse({'success': True, 'message': 'تمت الطباعة بنجاح'})
    except ImportError as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=503)
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'خطأ في الطباعة: {e}'}, status=500)


# ─── فحص المكتبات ────────────────────────────────────────────────────────────
def _check_deps():
    missing = []
    try:    import win32print       # noqa
    except ImportError: missing.append('pywin32')
    try:    from PIL import Image   # noqa
    except ImportError: missing.append('Pillow')
    try:    import arabic_reshaper  # noqa
    except ImportError: missing.append('arabic-reshaper')
    try:    from bidi.algorithm import get_display  # noqa
    except ImportError: missing.append('python-bidi')
    if missing:
        raise ImportError(f'يرجى تثبيت: pip install {" ".join(missing)}')


# ─── معالجة النص العربي ──────────────────────────────────────────────────────
def _ar(text):
    """إعادة تشكيل النص العربي للعرض الصحيح في Pillow"""
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
        return get_display(arabic_reshaper.reshape(str(text)))
    except Exception:
        return str(text)


def _has_arabic(text):
    return any('\u0600' <= c <= '\u06FF' for c in str(text))


def _t(text):
    """معالجة تلقائية: عربي → _ar() | غير عربي → كما هو"""
    s = str(text)
    return _ar(s) if _has_arabic(s) else s


# ─── تحميل الخطوط ────────────────────────────────────────────────────────────
def _load_fonts():
    from PIL import ImageFont as IF

    def pick(paths, size):
        for p in paths:
            if os.path.exists(p):
                return IF.truetype(p, size)
        return IF.load_default()

    return {
        'tiny':  pick(_FONTS_R, 18),
        'sm':    pick(_FONTS_R, 21),
        'md':    pick(_FONTS_R, 25),
        'bsm':   pick(_FONTS_B, 21),
        'bmd':   pick(_FONTS_B, 25),
        'blg':   pick(_FONTS_B, 30),
        'bxl':   pick(_FONTS_B, 36),
        'hero':  pick(_FONTS_B, 52),
    }


# ─── تحميل الشعار ────────────────────────────────────────────────────────────
def _load_logo(target_h=130):
    from PIL import Image
    if not os.path.exists(LOGO_PATH):
        return None
    try:
        src = Image.open(LOGO_PATH)
        # إذا كانت الصورة RGBA استخدم القناة الشفافة، وإلا حوّل مباشرة
        if src.mode == 'RGBA':
            w   = int(src.width * target_h / src.height)
            src = src.resize((w, target_h), Image.LANCZOS)
            bg  = Image.new('L', (w, target_h), 255)
            bg.paste(src.convert('L'), mask=src.split()[3])
            return bg
        else:
            w   = int(src.width * target_h / src.height)
            src = src.resize((w, target_h), Image.LANCZOS)
            return src.convert('L')
    except Exception:
        return None


# ─── بناء الإيصال ────────────────────────────────────────────────────────────
def _build(d):
    from PIL import Image, ImageDraw
    F  = _load_fonts()
    lg = _load_logo()

    # رسمة أولى لحساب الارتفاع
    tmp  = Image.new('L', (PW, 1900), 255)
    h    = _render(ImageDraw.Draw(tmp), tmp, d, F, lg)

    # رسمة نهائية بالحجم الصحيح
    img  = Image.new('L', (PW, h + 28), 255)
    _render(ImageDraw.Draw(img), img, d, F, lg)
    return img


# ─── رسم كامل محتوى الإيصال ──────────────────────────────────────────────────
def _render(draw, canvas, d, F, lg):
    y = 0

    # ══ شعار + اسم الشركة ═══════════════════════════════════════════════════
    if lg:
        canvas.paste(lg, ((PW - lg.width) // 2, y))
        y += lg.height + 8

    y = _ctr(draw, y, 'شركة انترناشونال', F['bxl'])
    y = _ctr(draw, y + 1, 'للخدمات المالية والمجوهرات', F['sm'])
    y += 6

    _double_line(draw, y);  y += 14

    # ══ رقم الإيصال / التاريخ / الوقت ══════════════════════════════════════
    meta = [
        ('رقم الإيصال', f"# {d.get('txNum','')}"),
        ('التاريخ',      d.get('dateStr', '')),
        ('الوقت',        d.get('timeStr', '')),
    ]
    for lbl, val in meta:
        y = _kv_row(draw, y, lbl, val, F)

    _line(draw, y);  y += 10

    # ══ شريط نوع العملية (كامل العرض) ══════════════════════════════════════
    is_buy   = d.get('opType') == 'buy'
    op_text  = ('▲  عملية شراء' if is_buy else '▼  عملية بيع')
    op_h     = _th(draw, _ar(op_text), F['blg']) + 20
    draw.rectangle([(0, y), (PW, y + op_h)], fill=0)
    # زخرفة — خطوط بيضاء رفيعة داخل الشريط
    draw.line([(0, y + 2),      (PW, y + 2)],      fill=50, width=1)
    draw.line([(0, y + op_h-3), (PW, y + op_h-3)], fill=50, width=1)
    y = _ctr(draw, y + 10, op_text, F['blg'], fill=255)
    y += 8

    # ══ بيانات العميل ═══════════════════════════════════════════════════════
    y += 4
    y = _section(draw, y, 'بيانات العميل', F)
    y = _table(draw, y, [
        ('الاسم',      d.get('client',   '—')),
        ('رقم الهوية', d.get('clientId', '—')),
    ], F)

    # ══ تفاصيل العملية ══════════════════════════════════════════════════════
    y += 6
    fc = d.get('from', '')
    tc = d.get('to',   '')
    y = _section(draw, y, 'تفاصيل العملية', F)
    y = _table(draw, y, [
        ('المبلغ المدفوع', f"{d.get('amt', '')}  {fc}"),
        ('سعر الصرف',      f"1 {fc}  =  {d.get('rateNum', '')}  {tc}"),
    ], F)

    y += 10
    _double_line(draw, y);  y += 16

    # ══ صندوق المبلغ المستلم ════════════════════════════════════════════════
    res_str = f"{d.get('result', '')}  {tc}"
    lbl_h   = _th(draw, _ar('المبلغ المستلم'), F['bsm'])
    res_h   = _th(draw, _ar(res_str),           F['hero'])
    box_h   = lbl_h + res_h + 80   # هامش موسّع أعلى وأسفل

    draw.rectangle([(0, y), (PW, y + box_h)], fill=0)
    # إطار أبيض زخرفي داخل الصندوق
    draw.rectangle([(M - 4, y + 4), (PW - M + 4, y + box_h - 4)],
                   outline=60, width=1)
    y += 18
    y = _ctr(draw, y, 'المبلغ المستلم', F['bsm'], fill=180)
    y += 6
    y = _ctr(draw, y, res_str, F['hero'], fill=255)
    y += 32

    _double_line(draw, y);  y += 14

    # ══ ذيل الإيصال ═════════════════════════════════════════════════════════
    y += 4
    y = _ctr(draw, y, 'شكراً لتعاملكم معنا', F['blg'])
    y += 2
    y = _ctr(draw, y, 'يُرجى الاحتفاظ بالإيصال', F['sm'])
    y += 10

    # فاصل منقط
    y = _ctr(draw, y, ('- ' * 30).strip(), F['tiny'])
    y += 4
    y = _ctr(draw, y, 'نظام انترناشونال الموحد', F['tiny'])

    return y


# ─── مساعدات الرسم ────────────────────────────────────────────────────────────

def _tw(draw, text, font):
    b = draw.textbbox((0, 0), text, font=font)
    return b[2] - b[0]

def _th(draw, text, font):
    b = draw.textbbox((0, 0), text, font=font)
    return b[3] - b[1]

def _ctr(draw, y, text, font, fill=0):
    t = _ar(text) if _has_arabic(text) else str(text)
    w = _tw(draw, t, font)
    h = _th(draw, t, font)
    draw.text(((PW - w) // 2, y), t, font=font, fill=fill)
    return y + h + 6

def _line(draw, y, fill=0, thick=1):
    draw.line([(M, y), (PW - M, y)], fill=fill, width=thick)

def _double_line(draw, y):
    draw.line([(M, y),     (PW - M, y)],     fill=0, width=3)
    draw.line([(M, y + 7), (PW - M, y + 7)], fill=0, width=1)

def _kv_row(draw, y, lbl, val, F):
    """صف: العنوان يمين / القيمة يسار"""
    t_lbl = _ar(lbl)
    t_val = _t(val)
    h_lbl = _th(draw, t_lbl, F['md'])
    h_val = _th(draw, t_val, F['bmd'])
    row_h = max(h_lbl, h_val) + 14

    # العنوان — يمين
    lw = _tw(draw, t_lbl, F['md'])
    draw.text((PW - M - lw - 4, y + (row_h - h_lbl) // 2),
              t_lbl, font=F['md'], fill=0)

    # القيمة — يسار
    draw.text((M + 4, y + (row_h - h_val) // 2),
              t_val, font=F['bmd'], fill=0)

    _line(draw, y + row_h - 1, fill=180)
    return y + row_h

def _section(draw, y, title, F):
    """رأس القسم — خلفية سوداء، نص أبيض يمين، مربع أبيض زخرفي يسار"""
    t  = _ar(title)
    th = _th(draw, t, F['bmd']) + 14
    draw.rectangle([(M, y), (PW - M, y + th)], fill=0)
    # مربع أبيض صغير (زخرفة يسار)
    bx = M + 6
    draw.rectangle([(bx, y + 6), (bx + 14, y + th - 6)], fill=255)
    # نص يمين
    tw = _tw(draw, t, F['bmd'])
    draw.text((PW - M - tw - 10, y + 7), t, font=F['bmd'], fill=255)
    return y + th + 4

def _table(draw, y, rows, F):
    """
    جدول ببيانات: rows = [(label, value), ...]
    - العنوان (label) يمين
    - القيمة (value) يسار
    """
    # حساب ارتفاع كل صف
    heights = []
    for lbl, val in rows:
        t_lbl = _ar(lbl)
        t_val = _t(val)
        h = max(_th(draw, t_lbl, F['md']),
                _th(draw, t_val, F['bmd'])) + 16
        heights.append(h)

    total_h = sum(heights)

    # إطار خارجي
    draw.rectangle([(M, y), (PW - M, y + total_h)], outline=0, width=1)

    y0 = y
    for i, ((lbl, val), rh) in enumerate(zip(rows, heights)):
        t_lbl = _ar(lbl)
        t_val = _t(val)
        h_lbl = _th(draw, t_lbl, F['md'])
        h_val = _th(draw, t_val, F['bmd'])

        # فاصل أفقي بين الصفوف
        if i > 0:
            draw.line([(M, y), (PW - M, y)], fill=0, width=1)

        # فاصل عمودي خفيف في المنتصف
        mid = PW // 2
        draw.line([(mid, y + 4), (mid, y + rh - 4)], fill=200, width=1)

        # العنوان — يمين
        lw = _tw(draw, t_lbl, F['md'])
        draw.text((PW - M - lw - 8, y + (rh - h_lbl) // 2),
                  t_lbl, font=F['md'], fill=0)

        # القيمة — يسار
        draw.text((M + 8, y + (rh - h_val) // 2),
                  t_val, font=F['bmd'], fill=0)

        y += rh

    return y + 2


# ─── إرسال للطابعة ───────────────────────────────────────────────────────────
def _print(img):
    import win32print

    bmp    = img.convert('1', dither=0)
    iw, ih = bmp.size
    pixels = bmp.load()

    buf  = bytearray()
    buf += b'\x1b\x40'          # Initialize
    buf += b'\x1b\x61\x01'      # Center align

    xb   = (iw + 7) // 8
    buf += bytes([0x1D, 0x76, 0x30, 0x00,
                  xb & 0xFF, (xb >> 8) & 0xFF,
                  ih & 0xFF, (ih >> 8) & 0xFF])

    for row in range(ih):
        for col in range(0, iw, 8):
            byte = 0
            for bit in range(8):
                if col + bit < iw and pixels[col + bit, row] == 0:
                    byte |= (0x80 >> bit)
            buf.append(byte)

    buf += b'\x1d\x56\x41\x00'  # Full cut

    p  = win32print.GetDefaultPrinter()
    hp = win32print.OpenPrinter(p)
    try:
        win32print.StartDocPrinter(hp, 1, ('Receipt', None, 'RAW'))
        try:
            win32print.StartPagePrinter(hp)
            win32print.WritePrinter(hp, bytes(buf))
            win32print.EndPagePrinter(hp)
        finally:
            win32print.EndDocPrinter(hp)
    finally:
        win32print.ClosePrinter(hp)
