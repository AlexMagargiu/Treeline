# Basemap glyphs and sprites

MapLibre draws no label at all without glyph PBFs, and the icons the Protomaps style uses
for one-way arrows, road shields and place dots come from a sprite sheet. Neither is a
tile, so neither is in `infra/tiles/README.md` and neither is in the `treeline_tiles`
volume. They are here, served by Next, because the alternative is the Protomaps default,
which points at `protomaps.github.io`: that is the one external service at runtime that
self-hosting the tiles exists to remove, and a map that loses every label when a host is
unreachable is the wrong shape for a site meant to work where the network does not.

A phone downloads only the ranges a label on its screen actually uses.

## What is here

| Path | What | Source |
| --- | --- | --- |
| `fonts/Noto Sans {Regular,Medium,Italic}/*.pbf` | SDF glyph ranges | `protomaps.github.io/basemaps-assets/fonts/` |
| `sprites/{grayscale,black}{,@2x}.{json,png}` | icon sheets | `protomaps.github.io/basemaps-assets/sprites/v4/` |

## Licences, and a correction

Both licence texts are vendored beside the files they cover, in `licences/`, because the
OFL requires its text to travel with any redistributed copy of the font and the MIT licence
requires its notice to travel with the icons. A prose credit is not the licence.

| What | Licence | Text |
| --- | --- | --- |
| `fonts/Noto Sans *` | SIL Open Font Licence 1.1 | `licences/OFL-1.1-Noto-Sans.txt` |
| `sprites/*` | MIT, derived from `tangrams/icons` | `licences/MIT-tangrams-icons.txt` |

This file previously said the sprites were BSD 3-Clause. They are not. The
`protomaps/basemaps-assets` repository carries no licence file of its own and its README
states the licence per directory: the fonts are OFL, and the sprites are "derived from
MIT-licensed tangrams/icons". Checked against the upstream repository on 2026-09-20.

## The ranges, and why these ones

Seven ranges per face, which is what the map on screen asks for and nothing more. The
first three are not optional: Romanian needs all three at once.

| Range | Holds | Why it is here |
| --- | --- | --- |
| `0-255` | Latin-1 | `â` U+00E2 and `î` U+00EE |
| `256-511` | Latin Extended-A | `ă` U+0103 |
| `512-767` | Latin Extended-B | `ș` U+0219 and `ț` U+021B |
| `768-1023` | combining marks and Greek | a decomposed `s` plus U+0326 lives here |
| `1024-1279` | Cyrillic | Ukraine, Moldova, Serbia and Bulgaria, all on screen at country zoom |

Five ranges per face, not seven. The country view also asks for Arabic (`1536-1791`) and
Georgian (`11520-11775`), for labels at the far edge of the frame, and those two cost
412 KB across the three faces. Measured on slow 3G on 2026-09-20 they were a tenth of the
whole screen's transfer, to spell a Turkish and a Georgian place name that are outside the
country this product is about. They are left out, and MapLibre draws those characters with
a local font instead, which it says so in the console and then does correctly.

The five that are here were chosen the same way: the country view requests them, and a
missing range is a different letterform in the middle of a Bulgarian or Ukrainian name.

Only the two sprite flavours the map uses are kept, `grayscale` for the light and high
contrast themes and `black` for the dark one. The other three Protomaps ships are not
referenced by anything here.

## Replacing them

```bash
cd apps/web
for f in "Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic"; do
  enc=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$f")
  for r in 0-255 256-511 512-767 768-1023 1024-1279 1536-1791 11520-11775; do
    curl -sfS -o "public/basemap/fonts/$f/$r.pbf" \
      "https://protomaps.github.io/basemaps-assets/fonts/$enc/$r.pbf"
  done
done
for s in grayscale black; do
  for n in "$s" "$s@2x"; do
    for ext in json png; do
      curl -sfS -o "public/basemap/sprites/$n.$ext" \
        "https://protomaps.github.io/basemaps-assets/sprites/v4/$n.$ext"
    done
  done
done
```

These are committed rather than fetched at build time, so a build needs no network beyond
the package registry and the image is reproducible from the repository alone.

`next.config.ts` serves `/basemap/*` with a one year immutable cache, for the same reason
Caddy does it for `/tiles/*` and with the same trap: a browser that has seen a file keeps
it for a year, so replacing one means renaming it or hard reloading.
