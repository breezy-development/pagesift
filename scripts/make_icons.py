"""Render src/icons/icon{16,32,48,128}.png and store/icon-store-128.png. Needs Pillow."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 1024
TOP, BOTTOM = (124, 92, 255), (79, 60, 230)


def gradient() -> Image.Image:
    img = Image.new("RGB", (S, S))
    px = img.load()
    for y in range(S):
        t = y / (S - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM))
        for x in range(S):
            px[x, y] = c
    return img


def sparkle(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill) -> None:
    w = r * 0.28
    d.polygon(
        [(cx, cy - r), (cx + w, cy - w), (cx + r, cy), (cx + w, cy + w),
         (cx, cy + r), (cx - w, cy + w), (cx - r, cy), (cx - w, cy - w)],
        fill=fill,
    )


def icon(simple: bool) -> Image.Image:
    pad = 0 if simple else 64
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((pad, pad, S - pad, S - pad), radius=220, fill=255)
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    tile.paste(gradient(), (0, 0), mask)

    d = ImageDraw.Draw(tile)
    white = (255, 255, 255, 255)
    soft = (255, 255, 255, 150)
    x0, x1 = 230, 790
    y0, row = 330 if not simple else 300, 130
    stroke = 44 if not simple else 70
    rows = 3
    # header bar
    d.rounded_rectangle((x0, y0, x1 - (0 if simple else 150), y0 + row - 20), radius=36, fill=white)
    for i in range(1, rows + 1):
        y = y0 + i * row + 10
        d.rounded_rectangle((x0, y, x0 + 190, y + stroke), radius=stroke // 2, fill=soft)
        d.rounded_rectangle((x0 + 240, y, x1 - (i % 2) * 120, y + stroke), radius=stroke // 2, fill=soft)
    if not simple:
        sparkle(d, 755, 330, 110, white)
        sparkle(d, 860, 205, 48, white)
    return tile


def main() -> None:
    out = ROOT / "src" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    detailed, simple = icon(False), icon(True)
    for size in (16, 32, 48, 128):
        src = simple if size <= 32 else detailed
        src.resize((size, size), Image.LANCZOS).save(out / f"icon{size}.png", optimize=True)
    store = ROOT / "store"
    store.mkdir(exist_ok=True)
    # CWS store icon: 128x128 with the artwork inside a 96x96 area.
    canvas = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    canvas.paste(icon(True).resize((96, 96), Image.LANCZOS), (16, 16))
    canvas.save(store / "icon-store-128.png", optimize=True)
    detailed.resize((512, 512), Image.LANCZOS).save(store / "icon-512.png", optimize=True)
    print("icons written")


if __name__ == "__main__":
    main()
