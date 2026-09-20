#!/usr/bin/env python3
"""Draw the Treeline app icons.

A monogram, not a photograph. The mark is the letter T set in IBM Plex Sans SemiBold,
which is the same face the interface uses, on the light theme's accent. There is no
photograph of a mountain here and there will not be one: the only photographs this
product ever shows are the user's own.

Run it again if the accent in docs/design.md ever moves:

    python3 scripts/make-icons.py

Needs Pillow and one download of the font. Writes into apps/web/public/icons/.
"""

import io
import pathlib
import urllib.request

from PIL import Image, ImageDraw, ImageFont

# The light theme's --primary, from section 6 of docs/design.md.
ACCENT = (0x2A, 0x5F, 0x87)
# The light theme's --primary-foreground. Not pure white.
INK = (0xF8, 0xFA, 0xFB)

FONT_URL = (
    'https://github.com/google/fonts/raw/main/ofl/ibmplexsans/'
    'IBMPlexSans%5Bwdth%2Cwght%5D.ttf'
)

OUT = pathlib.Path(__file__).resolve().parent.parent / 'apps' / 'web' / 'public' / 'icons'


def load_font(size: int) -> ImageFont.FreeTypeFont:
    cached = pathlib.Path('/tmp/treeline-plex-sans.ttf')
    if not cached.exists():
        with urllib.request.urlopen(FONT_URL) as response:
            cached.write_bytes(response.read())
    font = ImageFont.truetype(io.BytesIO(cached.read_bytes()), size)
    # The file is a variable font, and the axis order is Weight then Width rather than
    # the alphabetical order the filename suggests. Read it rather than assume it: the
    # wrong order silently draws the mark at Thin, which is what happened first.
    axes = [axis['default'] for axis in font.get_variation_axes()]
    for index, axis in enumerate(font.get_variation_axes()):
        if axis['name'] == b'Weight':
            axes[index] = 600.0
    font.set_variation_by_axes(axes)
    return font


def draw(size: int, glyph_fraction: float) -> Image.Image:
    """A square of accent with the T centred on it.

    `glyph_fraction` is how much of the square the letter occupies. A maskable icon is
    cropped to a circle by the launcher, so its glyph is drawn smaller to stay inside the
    safe area.
    """
    image = Image.new('RGB', (size, size), ACCENT)
    canvas = ImageDraw.Draw(image)
    font = load_font(int(size * glyph_fraction))

    left, top, right, bottom = canvas.textbbox((0, 0), 'T', font=font)
    canvas.text(
        ((size - (right - left)) / 2 - left, (size - (bottom - top)) / 2 - top),
        'T',
        font=font,
        fill=INK,
    )
    return image


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size, fraction in [
        ('icon-192.png', 192, 0.62),
        ('icon-512.png', 512, 0.62),
        # 40 percent keeps the glyph inside the 80 percent safe circle every launcher
        # mask is guaranteed to leave alone.
        ('icon-512-maskable.png', 512, 0.40),
        ('apple-touch-icon.png', 180, 0.62),
    ]:
        draw(size, fraction).save(OUT / name, 'PNG', optimize=True)
        print(f'wrote {OUT / name}')


if __name__ == '__main__':
    main()
