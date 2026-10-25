# Р РёСЃСѓРµС‚ РёРєРѕРЅРєРё РїСЂРёР»РѕР¶РµРЅРёСЏ (PWA) Р±РµР· РІРЅРµС€РЅРёС… РєР°СЂС‚РёРЅРѕРє.
# Р—Р°РїСѓСЃРє: python tools/make-icons.py
from PIL import Image, ImageDraw, ImageFilter
import math
import os
import random

S = 1024
BG = (20, 17, 16)
CRUST = (219, 156, 82)
CRUST_HI = (240, 187, 118)
CRUST_LO = (168, 108, 42)
SAUCE = (170, 55, 38)
SAUCE_HI = (196, 74, 50)
MOZZ = (248, 240, 222)
MOZZ_SH = (226, 210, 178)
BASIL = (104, 158, 58)
BASIL_DARK = (78, 120, 42)
CHAR = (96, 58, 20)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')


def layer():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


def over(img, lay):
    return Image.alpha_composite(img, lay)


def blob(draw, x, y, r, fill, seed, rough=0.30, n=15):
    """РќРµСЂРѕРІРЅРѕРµ РїСЏС‚РЅРѕ РІРјРµСЃС‚Рѕ СЂРѕРІРЅРѕРіРѕ РєСЂСѓРіР° вЂ” С‚Р°Рє СЃС‹СЂ Рё СЃРѕСѓСЃ РІС‹РіР»СЏРґСЏС‚ Р¶РёРІС‹РјРё."""
    rnd = random.Random(seed)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r * (1.0 - rough / 2 + rough * rnd.random())
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a)))
    draw.polygon(pts, fill=fill)


def basil_leaf(r, ang, seed=0):
    """Р›РёСЃС‚РёРє Р±Р°Р·РёР»РёРєР° СЃ Р¶РёР»РєРѕР№, РїРѕРІС‘СЂРЅСѓС‚С‹Р№ РЅР° ang РіСЂР°РґСѓСЃРѕРІ."""
    size = int(math.ceil(r * 2.4))
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = cy = size / 2
    w, h = r, r * 0.62
    d.ellipse([cx - w, cy - h, cx + w, cy + h], fill=BASIL + (255,))
    # РјСЏРіРєР°СЏ СЃРІРµС‚Р»Р°СЏ РїРѕР»РѕРІРёРЅР° вЂ” РѕР±СЉС‘Рј
    hi = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(hi).ellipse([cx - w * 0.85, cy - h * 0.95, cx + w * 0.25, cy + h * 0.10],
                               fill=(150, 200, 96, 130))
    im = Image.alpha_composite(im, hi.filter(ImageFilter.GaussianBlur(r * 0.22)))
    d = ImageDraw.Draw(im)
    d.line([cx - w * 0.80, cy, cx + w * 0.80, cy], fill=BASIL_DARK + (120,), width=max(2, int(r * 0.09)))
    return im.rotate(ang, expand=False, resample=Image.BICUBIC)


def render(width_ratio):
    """РџРёС†С†Р° РјР°СЂРіР°СЂРёС‚Р° СЃРІРµСЂС…Сѓ: РєРѕСЂРѕС‡РєР°, СЃРѕСѓСЃ, РјРѕС†Р°СЂРµР»Р»Р°, Р±Р°Р·РёР»РёРє."""
    img = Image.new('RGBA', (S, S), BG + (255,))
    cx = cy = S / 2

    # 1. С‚С‘РїР»РѕРµ СЃРІРµС‡РµРЅРёРµ РїРѕР·Р°РґРё вЂ” С„РѕРЅ РЅРµ РїР»РѕСЃРєРёР№
    glow = layer()
    gd = ImageDraw.Draw(glow)
    for i in range(40, 0, -1):
        rr = S * 0.80 * i / 40
        gd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(226, 150, 52, 2))
    img = over(img, glow.filter(ImageFilter.GaussianBlur(S * 0.075)))

    R = S * width_ratio / 2

    # 2. РјСЏРіРєР°СЏ С‚РµРЅСЊ
    sh = layer()
    ImageDraw.Draw(sh).ellipse([cx - R * 0.97, cy - R * 0.70, cx + R * 0.97, cy + R * 1.20],
                               fill=(0, 0, 0, 170))
    img = over(img, sh.filter(ImageFilter.GaussianBlur(S * 0.032)))

    # 3. РєРѕСЂРѕС‡РєР°
    crust = layer()
    cd = ImageDraw.Draw(crust)
    cd.ellipse([cx - R, cy - R, cx + R, cy + R], fill=CRUST + (255,))
    hi = layer()
    ImageDraw.Draw(hi).ellipse([cx - R * 0.92, cy - R * 1.00, cx + R * 0.50, cy + R * 0.30],
                               fill=CRUST_HI + (120,))
    crust = over(crust, hi.filter(ImageFilter.GaussianBlur(S * 0.022)))
    lo = layer()
    ImageDraw.Draw(lo).ellipse([cx - R * 0.40, cy + R * 0.44, cx + R * 1.04, cy + R * 1.04],
                               fill=CRUST_LO + (140,))
    crust = over(crust, lo.filter(ImageFilter.GaussianBlur(S * 0.024)))

    # 4. РїРѕРґРїР°Р»РёРЅС‹ РЅР° РєРѕСЂРѕС‡РєРµ вЂ” РјРµР»РєРёРµ, СЂР°Р·РјС‹С‚С‹Рµ, РЅРµСЂРµРіСѓР»СЏСЂРЅС‹Рµ
    ch = layer()
    chd = ImageDraw.Draw(ch)
    for k in range(13):
        a = (k * 137.5 + 18) * math.pi / 180
        rr = R * (0.885 + 0.038 * math.sin(k * 2.7))
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        r = R * (0.016 + 0.013 * ((k * 7) % 5) / 4)
        chd.ellipse([x - r, y - r * 0.9, x + r, y + r * 0.9], fill=CHAR + (150,))

    # 5. СЃРѕСѓСЃ РІРЅСѓС‚СЂРё вЂ” С‡СѓС‚СЊ РјРµРЅСЊС€РёР№ РєСЂСѓРі
    Rs = R * 0.800
    sauce = layer()
    sd = ImageDraw.Draw(sauce)
    sd.ellipse([cx - Rs, cy - Rs, cx + Rs, cy + Rs], fill=SAUCE + (255,))
    for (dx, dy, rr, s) in ((-0.30, -0.34, 0.34, 1), (0.38, -0.10, 0.30, 2), (-0.05, 0.42, 0.32, 3)):
        blob(sd, cx + Rs * dx, cy + Rs * dy, Rs * rr, SAUCE_HI + (255,), s, rough=0.45)

    img = over(img, crust)
    img = over(img, ch.filter(ImageFilter.GaussianBlur(3.0)))
    img = over(img, sauce)

    # 6. РјРѕС†Р°СЂРµР»Р»Р° вЂ” РЅРµСЂРѕРІРЅС‹Рµ, РЅРѕ СЃРєСЂСѓРіР»С‘РЅРЅС‹Рµ РїСЏС‚РЅР°
    mozz = layer()
    md = ImageDraw.Draw(mozz)
    for (dx, dy, rr, s) in ((-0.36, -0.06, 0.19, 11), (0.20, -0.44, 0.17, 12),
                            (0.42, 0.26, 0.16, 13), (-0.20, 0.42, 0.17, 14),
                            (0.02, -0.02, 0.14, 15), (-0.56, 0.28, 0.11, 16),
                            (0.58, -0.22, 0.10, 17)):
        blob(md, cx + Rs * dx, cy + Rs * dy, Rs * rr, MOZZ + (255,), s, rough=0.10, n=30)
    img = over(img, mozz.filter(ImageFilter.GaussianBlur(1.6)))

    # С‚РµРЅСЊ РїРѕРґ СЃС‹СЂРѕРј вЂ” РѕР±СЉС‘Рј
    shd = layer()
    ImageDraw.Draw(shd).ellipse([cx - Rs * 0.95, cy - Rs * 0.80, cx + Rs * 0.95, cy + Rs * 1.10],
                                fill=MOZZ_SH + (36,))
    img = over(img, shd.filter(ImageFilter.GaussianBlur(S * 0.012)))

    # 7. Р±Р°Р·РёР»РёРє
    for (dx, dy, rr, ang, s) in ((0.04, -0.56, 0.150, -22, 1), (0.58, 0.06, 0.135, 38, 2),
                                 (-0.50, -0.40, 0.125, 12, 3), (0.16, 0.58, 0.125, 16, 5)):
        leaf = basil_leaf(Rs * rr, ang, s)
        img.alpha_composite(leaf, (int(cx + Rs * dx - leaf.size[0] / 2),
                                   int(cy + Rs * dy - leaf.size[1] / 2)))

    return img.convert('RGB')


def save(width_ratio, size, name):
    path = os.path.join(OUT, name)
    render(width_ratio).resize((size, size), Image.LANCZOS).save(path, 'PNG', optimize=True)
    print('%-22s %4d x %4d  %6d bytes' % (name, size, size, os.path.getsize(path)))


os.makedirs(OUT, exist_ok=True)
save(0.86, 512, 'icon-512.png')
save(0.86, 192, 'icon-192.png')
save(0.86, 180, 'icon-180.png')      # apple-touch-icon
save(0.66, 512, 'maskable-512.png')  # СЃ Р·Р°РїР°СЃРѕРј РїРѕРґ РєСЂСѓРіР»СѓСЋ РѕР±СЂРµР·РєСѓ Android
