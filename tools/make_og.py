#!/usr/bin/env python3
"""Generate images/og-default.png — the RentShepherd share card (1200x630).

Text-only brand card: near-black forest background, the brand crook-in-house
mark and the RentShepherd wordmark in the emerald-to-teal brand gradient,
tagline beneath, subtle border. Rendered at 2x and downscaled for crisp edges.

Usage:  python3 tools/make_og.py
"""

import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "og-default.png")

# Final size and supersample factor
W, H = 1200, 630
S = 2
CW, CH = W * S, H * S

# Brand palette (matches css/style.css)
BG = (4, 10, 7)            # --bg-0 #040a07
BG_GLOW = (16, 185, 129)   # emerald glow tint
EMERALD = (52, 211, 153)   # #34d399
TEAL = (45, 212, 191)      # #2dd4bf
TEXT = (238, 247, 242)     # --text #eef7f2
MUTED = (230, 244, 238)    # --muted base (alpha applied separately)


def find_font(bold=True):
    """Best available premium sans on this machine, with sane fallbacks."""
    candidates = []
    avenir = "/System/Library/Fonts/Avenir Next.ttc"
    if os.path.exists(avenir):
        want = ("Bold", "Demi Bold") if bold else ("Medium", "Regular")
        for idx in range(24):
            try:
                f = ImageFont.truetype(avenir, 10, index=idx)
            except OSError:
                break
            fam, style = f.getname()
            if fam == "Avenir Next" and style in want:
                # prefer first entry in `want` order
                candidates.append((want.index(style), avenir, idx))
        if candidates:
            candidates.sort()
            return candidates[0][1], candidates[0][2]
    for path in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ):
        if os.path.exists(path):
            return path, 0
    raise SystemExit("No usable font found for the OG card.")


def gradient_strip(width, height, c1, c2):
    """Horizontal linear gradient image c1 -> c2."""
    grad = Image.new("RGB", (width, 1))
    px = grad.load()
    for x in range(width):
        t = x / max(width - 1, 1)
        px[x, 0] = tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))
    return grad.resize((width, height))


def gradient_text(img, xy, text, font, c1, c2, anchor="la"):
    """Paint `text` filled with a horizontal c1->c2 gradient onto img."""
    # Measure via a throwaway draw
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    box = probe.textbbox(xy, text, font=font, anchor=anchor)
    x0, y0, x1, y1 = (int(v) for v in box)
    w, h = x1 - x0, y1 - y0
    mask = Image.new("L", (w, h), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.text((xy[0] - x0, xy[1] - y0), text, font=font, fill=255, anchor=anchor)
    strip = gradient_strip(w, h, c1, c2)
    img.paste(strip, (x0, y0), mask)
    return box


def draw_mark(img, cx, cy, size):
    """Brand mark: house outline + shepherd's crook, in the gradient colors.

    Geometry mirrors the site's SVG (viewBox 0 0 48 48) scaled to `size`.
    """
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    u = size / 48.0
    ox, oy = cx - size / 2.0, cy - size / 2.0

    def pt(x, y):
        return (ox + x * u, oy + y * u)

    lw = max(int(2.6 * u), 3)
    # House: apex (24,6), eaves (42.5,20)/(5.5,20), base corners (42.5,42.5)/(5.5,42.5)
    house = [pt(24, 6), pt(42.5, 20), pt(42.5, 42.5), pt(5.5, 42.5), pt(5.5, 20), pt(24, 6)]
    d.line(house, fill=EMERALD + (255,), width=lw, joint="curve")
    # Crook: vertical stem (19.5, 35.5)->(19.5, 19.5), arc over to (31.5, 19.5)->(31.5, 22.5)
    d.line([pt(19.5, 35.5), pt(19.5, 19.6)], fill=TEAL + (255,), width=lw)
    d.arc([pt(19.5, 13.5)[0], pt(19.5, 13.5)[1], pt(31.5, 25.5)[0], pt(31.5, 25.5)[1]],
          start=180, end=360, fill=TEAL + (255,), width=lw)
    d.line([pt(31.5, 19.6), pt(31.5, 22.5)], fill=TEAL + (255,), width=lw)
    img.alpha_composite(layer)


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)

    img = Image.new("RGBA", (CW, CH), BG + (255,))

    # Soft aurora glows — subtle, premium, off-center
    glow = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([CW * 0.52, -CH * 0.55, CW * 1.25, CH * 0.45], fill=BG_GLOW + (46,))
    gd.ellipse([-CW * 0.22, CH * 0.62, CW * 0.38, CH * 1.5], fill=TEAL + (28,))
    glow = glow.filter(ImageFilter.GaussianBlur(160 * S))
    img.alpha_composite(glow)

    draw = ImageDraw.Draw(img)

    # Fonts
    head_path, head_idx = find_font(bold=True)
    body_path, body_idx = find_font(bold=False)
    f_word = ImageFont.truetype(head_path, 126 * S, index=head_idx)
    f_tag = ImageFont.truetype(body_path, 34 * S, index=body_idx)
    f_url = ImageFont.truetype(body_path, 24 * S, index=body_idx)

    cx = CW // 2

    # Brand mark, centered above the wordmark
    draw_mark(img, cx, 172 * S, 128 * S)
    draw = ImageDraw.Draw(img)

    # Wordmark in the brand gradient
    gradient_text(img, (cx, 332 * S), "RentShepherd", f_word, EMERALD, TEAL, anchor="mm")
    draw = ImageDraw.Draw(img)

    # Tagline
    draw.text((cx, 428 * S), "The AI property manager — one rental to whole portfolios",
              font=f_tag, fill=MUTED + (188,), anchor="mm")
    draw.text((cx, 478 * S),
              "24/7 tenant answering · repair triage · rent on autopilot",
              font=f_tag, fill=MUTED + (128,), anchor="mm")

    # URL footer
    draw.text((cx, 566 * S), "rentshepherd.com", font=f_url,
              fill=EMERALD + (200,), anchor="mm")

    # Subtle rounded border, inset
    inset = 26 * S
    draw.rounded_rectangle([inset, inset, CW - inset, CH - inset],
                           radius=30 * S, outline=EMERALD + (64,), width=2 * S)

    final = img.resize((W, H), Image.LANCZOS).convert("RGB")
    final.save(OUT, "PNG", optimize=True)
    print("Wrote %s (%dx%d, %.1f KB)" % (OUT, W, H, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
