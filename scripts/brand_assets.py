#!/usr/bin/env python3
"""Make the app's brand files from the official artwork in public/.

  public/Ormoc_City_Logo.png, public/Ormoc_CDRRMO_Logo.png  ->  public/brand/*-seal-{64..512}.webp
  public/App_Banner.png                                       ->  public/brand/app-banner-{800,1600}.{webp,jpg}
  CDRRMO seal                                                 ->  public/icons/*, public/favicon.png

Seals are cut to a circle (anti-aliased, transparent corners). Run after replacing any
original: python3 scripts/brand_assets.py   (needs Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT, ICONS = ROOT / 'public', ROOT / 'public' / 'brand', ROOT / 'public' / 'icons'


def seal(name: str, slug: str) -> Image.Image:
    im = Image.open(SRC / name).convert('RGB')
    x0, y0, x1, y1 = im.convert('L').point(lambda v: 255 if v < 235 else 0).getbbox()   # the seal's extent
    cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) / 2 + 6
    c = im.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r)))
    s = c.size[0]
    mask = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    rgba = c.convert('RGBA')
    rgba.putalpha(mask.resize((s, s), Image.LANCZOS))
    for px in (64, 128, 256, 512):
        rgba.resize((px, px), Image.LANCZOS).save(OUT / f'{slug}-{px}.webp', quality=86, method=6)
    return rgba


def banner() -> None:
    b = Image.open(SRC / 'App_Banner.png').convert('RGB')
    w, h = b.size
    x = 0   # drop the solid blue strip on the left edge of the artwork
    while x < w // 10:
        col = [b.getpixel((x, y)) for y in range(0, h, 64)]
        if sum(1 for p in col if p[2] > 150 and p[0] < 60 and p[1] < 40) >= len(col) * 0.8:
            x += 1
        else:
            break
    b = b.crop((x, 0, w, h))
    for width in (800, 1600):
        r = b.resize((width, round(b.size[1] * width / b.size[0])), Image.LANCZOS)
        r.save(OUT / f'app-banner-{width}.webp', quality=72, method=6)
        r.save(OUT / f'app-banner-{width}.jpg', quality=74, optimize=True, progressive=True)


def icon(base: Image.Image, px: int, pad: float, bg, path: Path) -> None:
    canvas = Image.new('RGBA', (px, px), bg)
    s = int(px * (1 - 2 * pad))
    canvas.alpha_composite(base.resize((s, s), Image.LANCZOS), ((px - s) // 2, (px - s) // 2))
    canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    seal('Ormoc_City_Logo.png', 'ormoc-city-seal')
    cd = seal('Ormoc_CDRRMO_Logo.png', 'cdrrmo-seal')
    banner()
    icon(cd, 192, 0.02, (0, 0, 0, 0), ICONS / 'icon-192.png')
    icon(cd, 512, 0.02, (0, 0, 0, 0), ICONS / 'icon-512.png')
    icon(cd, 512, 0.12, (232, 243, 251, 255), ICONS / 'icon-maskable-512.png')   # Android safe zone
    icon(cd, 180, 0.06, (255, 255, 255, 255), ICONS / 'apple-touch-icon.png')    # iOS ignores transparency
    icon(cd, 64, 0.0, (0, 0, 0, 0), SRC / 'favicon.png')
    print('brand assets written to', OUT)
