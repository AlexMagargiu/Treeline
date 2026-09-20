#!/usr/bin/env bash
#
# Builds the tile files the map reads: one Romania basemap, and contours plus terrain
# per massif. Everything runs in a container, so the only things this machine needs are
# bash and docker.
#
# Run it here, never on the box. A tile build is the heaviest thing this project does and
# the box runs a live trading bot on 4 vCPU. See infra/tiles/README.md for how to ship the
# output up.
#
#   ./build.sh basemap          cut Romania out of the Protomaps daily build
#   ./build.sh massif bucegi    contours and terrain for one massif
#   ./build.sh list             the massifs this script knows
#
# Add --force to rebuild something that already exists.

set -euo pipefail

# This script does its arithmetic in awk, and awk reads decimals through the locale. On a
# machine set to ro_RO, mawk parses the bounding box "25.75" as 25 and the DEM tile list
# comes out empty. Bounding boxes and pixel resolutions are data, not display, so the
# numeric locale is pinned rather than inherited.
export LC_ALL=C

# --- pins -------------------------------------------------------------------------
# Moving any of these changes the output, so they are values in a checked-in file and
# never a floating tag.

PMTILES_IMAGE="protomaps/go-pmtiles:v1.31.2"
TOOLBOX_IMAGE="treeline-tiles:1"

# The Protomaps daily build this basemap was cut from. build.protomaps.com keeps roughly
# a week of dailies, so an older date returns 404 and the basemap has to be recut from a
# current one. Record the new date here and in the README when that happens.
PROTOMAPS_BUILD="20260920"

ROMANIA_BBOX="20.2,43.6,29.7,48.3"

# The source build carries zoom 0 to 15. Measured with `pmtiles extract --dry-run` on the
# 20260920 build: zoom 13 gives 360 MB, 14 gives 643 MB, 15 gives 1.2 GB. Protomaps first
# draws footpaths and building footprints at 14, which is the zoom that matters for finding
# a trailhead in Bușteni. A range request only ever fetches the tiles in view, so a higher
# maximum costs disk and the one-time transfer, never a phone's data.
BASEMAP_MAXZOOM=14

CONTOUR_INTERVAL=20
CONTOUR_MINZOOM=10
CONTOUR_MAXZOOM=14
CONTOUR_LAYER="contours"
CONTOUR_ATTRIBUTE="elev"

# rio-rgbify writes 512 pixel tiles, and MapLibre measures zoom against a 512 pixel tile
# too, so a tile at zoom z paints 512 CSS pixels. At 45.4 N that puts the Copernicus
# GLO-30 DEM's own 30 m resolution at zoom 11, 26.8 m per pixel. Zoom 12 is 13.4 m per
# pixel, a 2.2 times oversample: enough headroom to keep hillshade smooth without storing
# relief the DEM does not contain. Zoom 13 would be 4.5 times and three times the disk for
# interpolation. MapLibre overzooms hillshade past maxzoom itself, and a shaded surface
# survives that where a contour line would not.
#
# Measured on Bucegi: zoom 11 gives 4.2 MB, zoom 12 gives 14.2 MB, zoom 13 gives 41.6 MB.
# A phone fetches one 512 pixel tile either way, about 200 KB, so the ceiling is a disk
# decision and not a bandwidth one.
TERRAIN_MINZOOM=8
TERRAIN_MAXZOOM=12

# Mapbox Terrain-RGB, not Terrarium: height = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1
TERRAIN_BASE=-10000
TERRAIN_INTERVAL=0.1

# --- the massifs this script knows ------------------------------------------------
# lon_min,lat_min,lon_max,lat_max in EPSG:4326.
#
# Bucegi reaches south and east past the summit plateau on purpose, so the contours
# carry the Prahova valley floor at Sinaia and Comarnic rather than stopping at a
# contour line halfway down the mountain.

MASSIFS="bucegi"

massif_bbox() {
	case "$1" in
	bucegi) echo "25.28,45.15,25.75,45.55" ;;
	*) return 1 ;;
	esac
}

# --- paths ------------------------------------------------------------------------

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/out"
WORK="$HERE/work"
FORCE=0

# --- helpers ----------------------------------------------------------------------

say() { printf '\n==> %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
die() {
	printf '\nbuild.sh: %s\n' "$*" >&2
	exit 1
}

size_of() { du -h --apparent-size "$1" | cut -f1; }

# Every output is written to a .partial name and moved into place only after the tool
# that wrote it exited 0. A killed build leaves a .partial behind, which the skip check
# ignores, so the next run redoes the step instead of trusting a truncated file.
partial_of() { echo "${1%.pmtiles}.partial.pmtiles"; }

# Returns 0 when the step should run, 1 when it should be skipped.
should_build() {
	local target=$1
	if [ -e "$target" ] && [ "$FORCE" -eq 0 ]; then
		note "skip: $(basename "$target") exists, $(size_of "$target"). Use --force to rebuild."
		return 1
	fi
	rm -f "$(partial_of "$target")"
	return 0
}

finish() {
	local target=$1 partial
	partial="$(partial_of "$target")"
	[ -s "$partial" ] || die "$(basename "$partial") is missing or empty, so the step failed"
	mv "$partial" "$target"
	note "wrote $(basename "$target"), $(size_of "$target")"
}

# docker run as the invoking user, so the output is not left owned by root.
run_toolbox() {
	docker run --rm \
		--user "$(id -u):$(id -g)" \
		-e GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR \
		-e GDAL_HTTP_MULTIPLEX=YES \
		-e HOME=/tmp \
		-v "$OUT:/out" \
		-v "$WORK:/work" \
		"$TOOLBOX_IMAGE" "$@"
}

run_pmtiles() {
	docker run --rm \
		--user "$(id -u):$(id -g)" \
		-v "$OUT:/out" \
		-v "$WORK:/work" \
		"$PMTILES_IMAGE" "$@"
}

timed() {
	local label=$1
	shift
	local started elapsed
	started=$(date +%s)
	"$@"
	elapsed=$(($(date +%s) - started))
	note "$label took $((elapsed / 60))m $((elapsed % 60))s"
}

# The Copernicus GLO-30 tiles are one degree squares on AWS Open Data, no key and no
# account. A bounding box that crosses a degree line needs both tiles, so the whole
# covering set is computed rather than assumed to be one.
dem_sources() {
	awk -F, '
	function floor(x) { return (x == int(x)) ? x : (x < 0 ? int(x) - 1 : int(x)) }
	{
		lonmin = floor($1); latmin = floor($2)
		# A max that lands exactly on a degree line belongs to the tile below it.
		lonmax = floor($3); if (lonmax == $3) lonmax--
		latmax = floor($4); if (latmax == $4) latmax--
		for (lat = latmin; lat <= latmax; lat++)
			for (lon = lonmin; lon <= lonmax; lon++) {
				ns = (lat < 0) ? "S" : "N"; alat = (lat < 0) ? -lat : lat
				ew = (lon < 0) ? "W" : "E"; alon = (lon < 0) ? -lon : lon
				name = sprintf("Copernicus_DSM_COG_10_%s%02d_00_%s%03d_00_DEM", ns, alat, ew, alon)
				printf "/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/%s/%s.tif\n", name, name
			}
	}' <<<"$1"
}

# EPSG:3857 units per pixel for a 512 pixel tile at a zoom level, which is the grid
# rio-rgbify renders onto. The halving is what makes it 512 rather than the 256 the bare
# formula gives, and leaving it out warps the DEM one level too coarse and makes every
# tile an upsample of an upsample.
resolution_at_zoom() {
	awk -v z="$1" 'BEGIN { printf "%.10f", 156543.03392804097 / (2 ^ z) / 2 }'
}

# --- the basemap ------------------------------------------------------------------

build_basemap() {
	local target="$OUT/romania.pmtiles" partial
	partial="$(partial_of "$target")"

	say "Basemap: Romania out of the Protomaps build of $PROTOMAPS_BUILD"
	should_build "$target" || return 0

	note "bbox $ROMANIA_BBOX, zoom 0 to $BASEMAP_MAXZOOM"
	note "pmtiles extract reads only the byte ranges the box needs, so this is a"
	note "download and not a Planetiler run."

	timed "extract" run_pmtiles extract \
		"https://build.protomaps.com/${PROTOMAPS_BUILD}.pmtiles" \
		"/out/$(basename "$partial")" \
		--bbox="$ROMANIA_BBOX" \
		--maxzoom="$BASEMAP_MAXZOOM"

	finish "$target"
}

# --- one massif -------------------------------------------------------------------

build_dem() {
	local name=$1 bbox=$2
	local dem="$WORK/${name}-dem-4326.tif"
	local lon_min lat_min lon_max lat_max

	IFS=, read -r lon_min lat_min lon_max lat_max <<<"$bbox"

	if [ -e "$dem" ] && [ "$FORCE" -eq 0 ]; then
		note "skip: $(basename "$dem") exists, $(size_of "$dem")"
		return 0
	fi

	say "DEM: Copernicus GLO-30 clipped to $name"
	local sources
	mapfile -t sources < <(dem_sources "$bbox")
	note "${#sources[@]} source tile(s):"
	local s
	for s in "${sources[@]}"; do note "  ${s##*/}"; done

	rm -f "$dem.partial.tif"
	timed "dem clip" run_toolbox gdalwarp \
		-te "$lon_min" "$lat_min" "$lon_max" "$lat_max" \
		-te_srs EPSG:4326 -t_srs EPSG:4326 \
		-co COMPRESS=DEFLATE -co TILED=YES \
		-overwrite \
		"${sources[@]}" "/work/$(basename "$dem").partial.tif"

	[ -s "$dem.partial.tif" ] || die "the DEM clip produced nothing"
	mv "$dem.partial.tif" "$dem"
	note "wrote $(basename "$dem"), $(size_of "$dem")"
}

build_contours() {
	local name=$1
	local dem="$WORK/${name}-dem-4326.tif"
	local lines="$WORK/${name}-contours.geojsonl"
	local target="$OUT/${name}-contours.pmtiles" partial
	partial="$(partial_of "$target")"

	say "Contours: $name at ${CONTOUR_INTERVAL} m"
	should_build "$target" || return 0

	rm -f "$lines"
	timed "gdal_contour" run_toolbox gdal_contour \
		-a "$CONTOUR_ATTRIBUTE" -i "$CONTOUR_INTERVAL" \
		-f GeoJSONSeq \
		"/work/$(basename "$dem")" "/work/$(basename "$lines")"

	# gdal_contour also writes a sequential ID onto every line. It means nothing to the map
	# and it is carried in every tile, so tippecanoe drops it and the layer ships one
	# attribute: the elevation the style needs to label index contours and thin the rest.
	note "layer $CONTOUR_LAYER, attribute $CONTOUR_ATTRIBUTE, zoom $CONTOUR_MINZOOM to $CONTOUR_MAXZOOM"
	timed "tippecanoe" run_toolbox tippecanoe \
		-o "/out/$(basename "$partial")" \
		-l "$CONTOUR_LAYER" \
		-Z "$CONTOUR_MINZOOM" -z "$CONTOUR_MAXZOOM" \
		--drop-densest-as-needed \
		-x ID \
		--force \
		"/work/$(basename "$lines")"

	finish "$target"
}

# rio-rgbify writes name, description, version, type and format into the mbtiles metadata
# and nothing else. With no bounds row, `pmtiles convert` falls back to the whole world, so
# the archive claims to cover every ocean and MapLibre asks for tiles that are not there.
# The bounding box is already known here, so it is written in before the conversion.
MBTILES_METADATA_PY='
import sqlite3, sys
path, name, bbox, minz, maxz = sys.argv[1:6]
lon_min, lat_min, lon_max, lat_max = (float(v) for v in bbox.split(","))
rows = {
    "name": name,
    "description": name,
    "bounds": "%s,%s,%s,%s" % (lon_min, lat_min, lon_max, lat_max),
    "center": "%s,%s,%s" % ((lon_min + lon_max) / 2, (lat_min + lat_max) / 2, maxz),
    "minzoom": minz,
    "maxzoom": maxz,
}
db = sqlite3.connect(path)
for key, value in rows.items():
    db.execute("delete from metadata where name = ?", (key,))
    db.execute("insert into metadata (name, value) values (?, ?)", (key, str(value)))
db.commit()
db.close()
'

build_terrain() {
	local name=$1 bbox=$2
	local dem="$WORK/${name}-dem-4326.tif"
	local dem3857="$WORK/${name}-dem-3857.tif"
	local mbtiles="$WORK/${name}-terrain.mbtiles"
	local target="$OUT/${name}-terrain.pmtiles" partial
	partial="$(partial_of "$target")"

	say "Terrain: $name as Mapbox Terrain-RGB"
	should_build "$target" || return 0

	# rio-rgbify tiles a web-mercator raster, so the DEM is warped first, onto the pixel
	# grid of the maximum zoom so no step resamples twice.
	local res
	res="$(resolution_at_zoom "$TERRAIN_MAXZOOM")"
	note "warping to EPSG:3857 at ${res} m per pixel, the zoom ${TERRAIN_MAXZOOM} grid"
	rm -f "$dem3857"
	timed "warp" run_toolbox gdalwarp \
		-t_srs EPSG:3857 -tr "$res" "$res" -r bilinear \
		-co COMPRESS=DEFLATE -co TILED=YES \
		-overwrite \
		"/work/$(basename "$dem")" "/work/$(basename "$dem3857")"

	note "encoding: Mapbox Terrain-RGB, base $TERRAIN_BASE, interval $TERRAIN_INTERVAL"
	note "zoom $TERRAIN_MINZOOM to $TERRAIN_MAXZOOM"
	rm -f "$mbtiles"
	timed "rio rgbify" run_toolbox rio rgbify \
		-b "$TERRAIN_BASE" -i "$TERRAIN_INTERVAL" \
		--min-z "$TERRAIN_MINZOOM" --max-z "$TERRAIN_MAXZOOM" \
		--format png \
		-j "$(nproc)" \
		"/work/$(basename "$dem3857")" "/work/$(basename "$mbtiles")"

	[ -s "$mbtiles" ] || die "rio rgbify produced no mbtiles"

	note "writing bounds $bbox into the mbtiles metadata"
	run_toolbox python3 -c "$MBTILES_METADATA_PY" \
		"/work/$(basename "$mbtiles")" "${name} terrain" \
		"$bbox" "$TERRAIN_MINZOOM" "$TERRAIN_MAXZOOM"

	timed "pmtiles convert" run_pmtiles convert \
		"/work/$(basename "$mbtiles")" "/out/$(basename "$partial")"

	finish "$target"
}

build_massif() {
	local name=$1 bbox
	bbox="$(massif_bbox "$name")" || die "unknown massif '$name'. Known: $MASSIFS"

	say "Massif $name, bbox $bbox"
	build_dem "$name" "$bbox"
	build_contours "$name"
	build_terrain "$name" "$bbox"
}

# --- entry ------------------------------------------------------------------------

main() {
	local args=()
	local a
	for a in "$@"; do
		case "$a" in
		--force) FORCE=1 ;;
		*) args+=("$a") ;;
	esac
	done
	set -- ${args[@]+"${args[@]}"}

	[ $# -ge 1 ] || die "usage: build.sh {basemap|massif <name>|list} [--force]"

	command -v docker >/dev/null || die "docker is not on PATH. Every step runs in a container."
	docker image inspect "$PMTILES_IMAGE" >/dev/null 2>&1 || docker pull "$PMTILES_IMAGE"
	docker image inspect "$TOOLBOX_IMAGE" >/dev/null 2>&1 ||
		die "$TOOLBOX_IMAGE is missing. Build it: docker build -t $TOOLBOX_IMAGE $HERE"

	mkdir -p "$OUT" "$WORK"

	case "$1" in
	basemap)
		build_basemap
		;;
	massif)
		[ $# -ge 2 ] || die "usage: build.sh massif <name>. Known: $MASSIFS"
		build_massif "$2"
		;;
	list)
		local m
		for m in $MASSIFS; do printf '%s\t%s\n' "$m" "$(massif_bbox "$m")"; done
		;;
	*)
		die "unknown command '$1'. usage: build.sh {basemap|massif <name>|list} [--force]"
		;;
	esac

	say "Output in $OUT"
	if [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then
		du -h --apparent-size "$OUT"/*.pmtiles 2>/dev/null || true
		printf '    total %s\n' "$(du -sh --apparent-size "$OUT" | cut -f1)"
	fi
}

main "$@"
