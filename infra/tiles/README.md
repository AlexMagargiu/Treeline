# Tiles

Three files feed the map: one Romania basemap, and contours plus terrain for each massif.
`build.sh` makes all three. Nothing here runs on the VPS.

| File | What it is | Size |
| --- | --- | --- |
| `romania.pmtiles` | Protomaps basemap, Romania, zoom 0 to 14 | 643,351,801 bytes, 614 MiB |
| `bucegi-contours.pmtiles` | 20 m contours, zoom 10 to 14 | 8,156,614 bytes, 7.8 MiB |
| `bucegi-terrain.pmtiles` | Mapbox Terrain-RGB, zoom 8 to 12 | 14,833,458 bytes, 14.1 MiB |

Total 666,341,873 bytes, 635.5 MiB, against the 15 GB budget in `SUPERVISOR_PROMPT.md`.
That is 4.1 percent. A massif costs about 23 MiB, so the budget is not the constraint and
will not become one.

## Build it on your machine, never on the box

The VPS has 4 vCPU, 8 GB of memory and a live trading bot on it. A tile build is the
heaviest thing this project does. Build here, ship the files up. This is the same reason
the deploy never builds images there.

## What the map needs to know

A style that guesses these renders nothing, so they are written down rather than inferred.

| Source | Layer | Attributes | Encoding |
| --- | --- | --- | --- |
| `romania.pmtiles` | the Protomaps basemap layers | as published | MVT, gzip |
| `bucegi-contours.pmtiles` | `contours` | `elev`, metres, integer | MVT, gzip |
| `bucegi-terrain.pmtiles` | none, it is raster | none | **Mapbox Terrain-RGB**, PNG |

The terrain encoding is **Mapbox Terrain-RGB and not Terrarium**:

```
height = -10000 + (R * 65536 + G * 256 + B) * 0.1
```

In MapLibre that is `"encoding": "mapbox"` on a `raster-dem` source. Terrarium is a
different formula, and a map configured for the wrong one draws a psychedelic mess rather
than raising an error, so this is worth getting right the first time.

Verified, and the method matters because the obvious check gives the wrong answer. The
highest pixel of the z12 terrain tile `12/2337/1466` decodes to **2505.40 m** at
45.44598, 25.45627, against a DEM maximum of 2506.16 m. The Terrarium formula on the same
pixel gives -32279 m, so the encoding is unambiguous.

Do not verify by decoding the pixel at Omu's published coordinate: at z12 with 512 pixel
tiles the ground resolution is 13.4 m, resampling flattens the summit, and that pixel reads
2486.10 m. Nothing is wrong when it does.

The contour layer carries `elev` and nothing else. `gdal_contour` also writes a sequential
`ID` that means nothing to a map and would be carried in every tile, so tippecanoe drops
it. Style index contours by filtering `elev % 100 == 0` and thin the rest at low zoom;
tippecanoe drops the densest lines to fit a tile at zoom 10 and 11, so do not rely on every
line being present up there.

Declare all three sources with `tileSize` 512. MapLibre measures zoom against a 512 pixel
tile, rio-rgbify writes 512 pixel PNGs, and Protomaps and tippecanoe both write 512 extent
vector tiles.

## Pinned images

Moving any of these changes the output, so they are values in a checked-in file and never a
floating tag.

| Image | Used for |
| --- | --- |
| `protomaps/go-pmtiles:v1.31.2` | `pmtiles extract`, `pmtiles convert`, `pmtiles show` |
| `ghcr.io/osgeo/gdal:ubuntu-small-3.13.3` | base of the toolbox below |
| `treeline-tiles:1`, built here from `Dockerfile` | `gdalwarp`, `gdal_contour`, `tippecanoe` 2.79.0, `rio-rgbify` 0.4.0 |

GDAL, tippecanoe, rio-rgbify and the PMTiles CLI are not installed on any machine. Every
step is a `docker run`. The only things the host needs are `bash` and `docker`.

tippecanoe and rio-rgbify have no maintained published image, so `Dockerfile` builds them
from pinned versions. `Dockerfile` also carries a one-line patch to rio-rgbify, explained
in a comment there: it asks GDAL to reproject bounds with `densify_pts=0`, GDAL refuses
that for a geographic target, and every tile fails. The package is dead upstream and
pinning older versions does not help, because the refusal is in GDAL rather than in
rasterio. Both were measured before the patch was chosen.

## The Protomaps build date

The basemap was cut from **`https://build.protomaps.com/20260920.pmtiles`**, the daily
build of 2026-09-20. Its own metadata reports `planetiler:version 0.10.2` and
`planetiler:osm:osmosisreplicationtime 2026-09-20T04:00:00Z`.

build.protomaps.com keeps roughly a week of dailies. 2026-09-13 already returned 404 while
this was being built, so that exact URL will not work for long. When it stops working, put
a current date in `PROTOMAPS_BUILD` in `build.sh` and in this file. "The basemap" with no
date is not reproducible.

Planetiler is deliberately not run. `pmtiles extract` reads only the byte ranges a bounding
box needs over HTTP, so cutting Romania out of a 138 GB planet file is a 71 second download
rather than a multi-hour job with a large memory appetite.

## Zoom ceilings, and why they are where they are

Romania stops at zoom 14. Measured with `pmtiles extract --dry-run`: zoom 13 gives 360 MB,
14 gives 643 MB, 15 gives 1.2 GB. Protomaps first draws footpaths and building footprints
at 14, which is the zoom that matters for finding a trailhead. A range request only fetches
the tiles in view, so a higher ceiling costs disk and the one-time transfer, never a
phone's data.

Terrain stops at zoom 12. With 512 pixel tiles at 45.4 N, zoom 11 is 26.8 m per pixel,
which is the Copernicus GLO-30 DEM's own resolution. Zoom 12 is 13.4 m per pixel, a 2.2
times oversample, which keeps hillshade smooth without storing relief the DEM does not
contain. Zoom 13 would be 4.5 times and, measured on Bucegi, 41.6 MB against 14.2 MB. A
phone fetches one 512 pixel tile either way, about 200 to 300 KB, so the ceiling is a disk
decision rather than a bandwidth one.

Rounding the DEM to whole metres before encoding was measured as well, on the theory that
0.1 m precision on a DEM with metre-level accuracy is noise. It saved 8 percent, 41.6 MB to
38.1 MB, which did not justify a non-standard source raster. Not done.

## What a phone actually downloads

Measured by reading the archives' own directories: the tiles covering a 390 x 844 viewport,
plus the 16 KB pmtiles.js reads on open, plus any leaf directory a lookup touches. Cold
cache.

| View | Bytes | At 1 Mbit/s |
| --- | --- | --- |
| Romania at zoom 5, basemap only | 274.4 KB | 2.2 s |
| Omu at zoom 14, all three sources | 398.0 KB | 3.3 s |

The walking view breaks down as 37.9 KB basemap, 31.5 KB contours, 328.5 KB terrain. The
terrain tile is most of it, and there is one of them.

## How long it takes, and on what

Measured on a 12 core machine with 15 GB of memory and a domestic connection.

| Step | Time |
| --- | --- |
| `docker build` of the toolbox, first time | 1m 47s |
| `basemap`: `pmtiles extract`, 675 MB over 135 requests | 1m 11s |
| `massif`: DEM clip from AWS over `/vsicurl` | 7s |
| `massif`: `gdal_contour` | 2s |
| `massif`: `tippecanoe` | 4s |
| `massif`: `gdalwarp` to EPSG:3857 | 1s |
| `massif`: `rio rgbify` | 2s |
| `massif`: `pmtiles convert` | under 1s |

A whole massif is under 20 seconds once the toolbox image exists. The basemap is the only
slow step and it is run once.

## Running it

```bash
cd infra/tiles
docker build -t treeline-tiles:1 .     # once, about two minutes

./build.sh list                        # the massifs it knows, with their bounding boxes
./build.sh basemap                     # Romania, once
./build.sh massif bucegi               # contours and terrain for one massif
./build.sh massif bucegi --force       # rebuild even if the output is there
```

Output lands in `infra/tiles/out/`, working files in `infra/tiles/work/`. Both are
gitignored. The repository holds the script and this file; the volume holds the data. Never
commit a tile file.

A second run skips whatever exists and says so. Every output is written to a `.partial`
name and moved into place only after the tool that wrote it exited 0, so a killed build
leaves a `.partial` that the skip check ignores rather than a truncated file that looks
finished.

### Adding a massif

Add a line to `massif_bbox()` in `build.sh` and run `./build.sh massif <name>`. The DEM
tiles are worked out from the bounding box, so a box that crosses a degree line takes both
tiles rather than clipping the map at a longitude.

## Getting the files onto the box

Built here, shipped up. The box only receives.

```bash
# 1. Copy the files to the box. 636 MB, so expect a few minutes.
scp -i ~/.ssh/github infra/tiles/out/*.pmtiles root@89.167.90.189:/root/treeline/tiles-staging/

# 2. Load them into the named volume. This is the part that is not obvious: a named
#    volume has no path you can scp to, so a throwaway container mounts both the volume
#    and the staging directory and copies between them.
ssh -i ~/.ssh/github root@89.167.90.189 \
  'docker run --rm \
     -v treeline_tiles:/dest \
     -v /root/treeline/tiles-staging:/src:ro \
     alpine:3.20 sh -c "cp /src/*.pmtiles /dest/ && ls -l /dest"'

# 3. Check the free disk, then remove the staging copy so the files are not on the box
#    twice. The box had 48 GB free on 2026-09-19 and this takes 636 MB.
ssh -i ~/.ssh/github root@89.167.90.189 \
  'df -h /var/lib/docker && rm -rf /root/treeline/tiles-staging'
```

The volume is `treeline_tiles`: Compose prefixes the project name. `proxy` mounts it
read-only at `/srv/tiles`, so nothing in the stack can write to it.

Locally the same load command is:

```bash
docker run --rm -v treeline_tiles:/dest -v "$PWD/infra/tiles/out:/src:ro" \
  alpine:3.20 sh -c 'cp /src/*.pmtiles /dest/'
```

## How they are served

The URLs, which the map prompt pastes rather than infers:

```
pmtiles://https://<TREELINE_HOST>/tiles/romania.pmtiles
pmtiles://https://<TREELINE_HOST>/tiles/bucegi-contours.pmtiles
pmtiles://https://<TREELINE_HOST>/tiles/bucegi-terrain.pmtiles
```

`TREELINE_HOST` is `89-167-90-189.sslip.io` on the box and `localhost` locally, the same
value the Caddyfile reads, so the map never hard-codes a hostname either.

Caddy serves `/tiles/*` from `/srv/tiles` with a plain `file_server`. Verified against all
three files: a request with no `Range` returns 200 with the full `Content-Length` and
`Accept-Ranges: bytes`, and `Range: bytes=0-16383` returns 206 with a correct
`Content-Range`. A byte range fetched over HTTPS was decoded back to a 512 pixel PNG whose
highest pixel reads 2505.40 m, the same value the local file gives, so the ranges return
the bytes they claim to.

`encode` is scoped to everything except `/tiles/*`. A PMTiles archive holds gzipped tiles
already, so compressing it again buys nothing, and a compressed response cannot carry a
byte range, which is the one thing the whole design needs.

### The cache is immutable, so a rebuild needs a new name

`Cache-Control: public, max-age=31536000, immutable`. A tile file does not change until it
is rebuilt, and the file name carries no hash. **After replacing a file in the volume, a
browser that has seen it will keep the old one for a year.** Either rename the file and
change the style, or hard reload. This is a real trap and it will not announce itself.

### These files are served without a session, on purpose

They sit behind Caddy, not behind the Next.js middleware, so anyone who knows the hostname
can fetch them. That is deliberate and acceptable: they are OpenStreetMap and Copernicus
data, they contain nothing personal, and putting them behind the gate would mean proxying
every range request through Next for no benefit. Do not "fix" this.

Note that this is about the tiles only. Route geometry, tracks and photos are the user's
own and go through the API, behind the session, as they always did.

## Licence and attribution

Both licences require credit, neither is optional, and both belong on the map screen where
a reader sees them rather than in a file nobody opens. Paste these strings; do not invent
your own.

Basemap, OpenStreetMap, ODbL:

```
© OpenStreetMap contributors
```

as a link, which is how the Protomaps archive itself declares it:

```html
<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>
```

Contours and hillshade, Copernicus DEM:

```
© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA, all rights reserved
```

A shorter form is acceptable on a small screen as long as the full text is reachable:

```
Elevation: Copernicus DEM © DLR e.V., Airbus DS, EU and ESA
```

This is rule 5 in `CLAUDE.md` in another form. OSM-derived geometry stays separable from
the user's own recorded tracks, and the same applies to what the map credits: the basemap
and the relief are somebody else's data under somebody else's licence.

## Sources

- Basemap: Protomaps daily build, `https://build.protomaps.com/20260920.pmtiles`, derived
  from OpenStreetMap and Natural Earth.
- Elevation: Copernicus GLO-30 DEM on AWS Open Data,
  `https://copernicus-dem-30m.s3.amazonaws.com/`. No key and no account. Tiles are one
  degree squares; Bucegi sits inside `N45 E025`.
