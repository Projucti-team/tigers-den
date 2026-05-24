#!/usr/bin/env python3
"""Remove grey backdrop from the badge and export web-ready transparent PNGs."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "tigers-den-logo-source.png"
PUBLIC = ROOT / "public"

BG_RGB = (207, 207, 207)
TOLERANCE = 42
FEATHER = 32


def color_distance(r: int, g: int, b: int) -> float:
    return ((r - BG_RGB[0]) ** 2 + (g - BG_RGB[1]) ** 2 + (b - BG_RGB[2]) ** 2) ** 0.5


def remove_grey_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            dist = color_distance(r, g, b)

            if dist <= TOLERANCE:
                pixels[x, y] = (0, 0, 0, 0)
            elif dist <= TOLERANCE + FEATHER:
                fade = (dist - TOLERANCE) / FEATHER
                pixels[x, y] = (r, g, b, int(min(a, 255 * fade)))

    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source image not found: {SOURCE}")

    master = remove_grey_background(Image.open(SOURCE))

    full = master.copy()
    full.thumbnail((512, 512), Image.Resampling.LANCZOS)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    full.save(PUBLIC / "tigers-den-logo.png", "PNG", optimize=True)

    nav = master.copy()
    nav.thumbnail((96, 96), Image.Resampling.LANCZOS)
    nav.save(PUBLIC / "tigers-den-logo-nav.png", "PNG", optimize=True)

    icon = master.copy()
    icon.thumbnail((512, 512), Image.Resampling.LANCZOS)
    icon.save(ROOT / "app" / "icon.png", "PNG", optimize=True)
    icon.save(ROOT / "app" / "apple-icon.png", "PNG", optimize=True)

    print(f"Saved {PUBLIC / 'tigers-den-logo.png'} ({full.size[0]}×{full.size[1]})")
    print(f"Saved {PUBLIC / 'tigers-den-logo-nav.png'} ({nav.size[0]}×{nav.size[1]})")


if __name__ == "__main__":
    main()
